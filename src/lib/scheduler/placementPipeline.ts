import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from './types';
import { getCategoryColor, WEEKLY_TASK_COLOR } from './constants';
import { timeStringToMinutes } from '../timeUtils';
import { classifyWeeklyTask } from './taskClassifier';
import { WeeklyPlacementPhase } from './phases/weeklyPlacementPhase';
import { DailyFairPlacementPhase } from './phases/dailyFairPlacementPhase';
import { AttachedFallbackPhase } from './phases/attachedFallbackPhase';
import { DailyAutoPlacementPhase } from './phases/dailyAutoPlacementPhase';
import { RescuePlacementPhase } from './phases/rescuePlacementPhase';

/**
 * スロットへのタスク配置実行・スロット分割ヘルパー
 */
export function createPlaceContextHelper(ctx: SchedulingExecutionContext) {
  return (d: number, taskCtx: DayTaskContext, isWeekly: boolean): boolean => {
    // 指定日時以降の設定
    const scheduleAfterDay =
      taskCtx.task.scheduleAfterDay ??
      (taskCtx.task.scheduleAfterEnabled ? taskCtx.task.startDay : undefined);

    // 曜日制約: 指定曜日より前の曜日には絶対に配置しない
    if (scheduleAfterDay !== undefined && d < scheduleAfterDay) {
      return false;
    }

    let scheduleAfterMinutes: number | undefined = undefined;
    if (taskCtx.task.scheduleAfterTime !== undefined) {
      scheduleAfterMinutes =
        typeof taskCtx.task.scheduleAfterTime === 'string'
          ? timeStringToMinutes(taskCtx.task.scheduleAfterTime)
          : taskCtx.task.scheduleAfterTime;
    }

    const slots = ctx.slotManager.getAvailableSlots(d);
    if (!slots || slots.length === 0) return false;

    for (const slot of slots) {
      if (slot.durationMinutes < 15) continue;

      let taskEarliestStartTime = taskCtx.task.earliestStartTime ?? 0;
      let taskLatestEndTime = taskCtx.task.latestEndTime ?? 1440;

      if (taskCtx.task.isAttachedTask) {
        taskLatestEndTime = 1440;
        if (taskCtx.isSameDayAsParent) {
          let parentEnd = 0;
          if (
            taskCtx.task.parentEndMinutesByDay &&
            taskCtx.task.parentEndMinutesByDay[d] !== undefined
          ) {
            parentEnd = taskCtx.task.parentEndMinutesByDay[d];
          } else if (taskCtx.task.parentTitle) {
            const parentBlock = ctx.dayBlocks[d]
              .filter(
                (b) =>
                  b.title === taskCtx.task.parentTitle ||
                  (taskCtx.task.parentTitle && b.title.startsWith(taskCtx.task.parentTitle)),
              )
              .sort((a, b) => b.endMinutes - a.endMinutes)[0];
            if (parentBlock) {
              parentEnd = parentBlock.endMinutes + (parentBlock.breakMinutes || 0);
            }
          }
          if (parentEnd > 0) {
            taskEarliestStartTime = Math.max(taskEarliestStartTime, parentEnd);
          }
        } else {
          taskEarliestStartTime = 0;
        }
      }

      // 指定日時以降オプションが有効な場合
      if (scheduleAfterDay !== undefined) {
        if (d === scheduleAfterDay) {
          // 指定曜日と同日の場合: 指定時刻以降（元タスク終了時刻等）に配置を制限
          if (scheduleAfterMinutes !== undefined && scheduleAfterMinutes > 0) {
            taskEarliestStartTime = Math.max(taskEarliestStartTime, scheduleAfterMinutes);
          }
        } else if (d > scheduleAfterDay) {
          // 指定曜日の翌日以降なら、元タスクの終了時刻（同日用の scheduleAfterTime / parentEnd）に縛られず、
          // 朝から夜まで1日の全空き時間をフルに使って配置可能！
          if (taskCtx.task.scheduleAfterEnabled || taskCtx.task.isAttachedTask) {
            taskEarliestStartTime = 0;
          }
        }
      }

      let effectiveLatestEnd = taskLatestEndTime;
      let effectiveEarliestStart = taskEarliestStartTime;

      // 週タスク（課題・レポート・自習等）は、時間割表の枠時間（09:00〜18:00等）に縛られず、
      // 早朝や夜間（18:00〜23:00等）も含めた1日の全空き時間をフルに使って配置できるようにする！
      // ただし、タスク自身が持つ「指定日時以降（taskEarliestStartTime）」は絶対に破壊・リセットしない！
      if (isWeekly) {
        if (taskCtx.task.autoPlaceWithinRange || taskCtx.task.sourceTableId) {
          effectiveEarliestStart = taskEarliestStartTime;
          effectiveLatestEnd = 1440;
        }
      }

      // 再配置プランかつ今日（d === todayIdx）の場合、現在時刻以降にのみ配置
      if (taskCtx.plan.isRescheduledPlan && d === ctx.todayIdx) {
        effectiveEarliestStart = Math.max(effectiveEarliestStart, ctx.currMinutes);
      }

      const effectiveSlotStart = Math.max(slot.startMinutes, effectiveEarliestStart);
      if (effectiveSlotStart >= effectiveLatestEnd) continue;

      // タスク本来の設定所要時間（durationMinutes 最優先、未指定なら durationSize に応じた標準時間）
      const requiredMin =
        taskCtx.task.durationMinutes && taskCtx.task.durationMinutes > 0
          ? taskCtx.task.durationMinutes
          : taskCtx.task.durationSize === 'small'
            ? 25
            : taskCtx.task.durationSize === 'medium'
              ? 45
              : taskCtx.task.durationSize === 'large'
                ? 120
                : 30;

      const breakMin =
        taskCtx.task.breakMinutes && taskCtx.task.breakMinutes > 0 ? taskCtx.task.breakMinutes : 0;

      // 自動敷き詰めタスク（isAuto）のみ、空き枠に合わせて柔軟に可変配置（最低15分〜）を許可。
      // 設定された時間を持つ通常タスク・週タスクは、設定時間（requiredMin）を満たす空き枠にのみ配置する！
      const minAcceptable = taskCtx.isAuto ? Math.min(requiredMin, 15) : requiredMin;

      const maxAllowedEnd = Math.min(slot.endMinutes, effectiveLatestEnd);
      const availableDuration = maxAllowedEnd - effectiveSlotStart;
      // ★ タスク本体の所要時間（minAcceptable / requiredMin）が収まっていれば配置を許可！
      // 休憩が入らないからといってタスク本体の配置を絶対に諦めない！
      if (availableDuration < minAcceptable) continue;

      // 自動敷き詰めタスク以外は、勝手にタスク時間を縮小せず、本来の設定所要時間（requiredMin）を厳密に維持！
      const effectiveDuration = taskCtx.isAuto
        ? Math.min(requiredMin, Math.max(15, availableDuration - breakMin))
        : requiredMin;

      if (availableDuration < effectiveDuration) continue;

      // 休憩時間はスロット内の残り時間に合わせて最大 breakMin を確保（余白がなければ0分〜）
      const effectiveBreak = Math.max(0, Math.min(breakMin, availableDuration - effectiveDuration));

      const taskStart = effectiveSlotStart;
      const taskEnd = taskStart + effectiveDuration;

      // Plan14: 分類の算出（出題中: 現在時刻が付随元のタスクの時間を超えているもの）
      const weeklyClassification = isWeekly
        ? taskCtx.task.weeklyClassification ||
          classifyWeeklyTask(taskCtx.task, ctx.todayIdx, ctx.currMinutes)
        : undefined;

      const isYesterday =
        !isWeekly &&
        (d < ctx.todayIdx ||
          (taskCtx.plan.isRescheduledPlan &&
            taskCtx.plan.rescheduledFromDay !== undefined &&
            taskCtx.plan.rescheduledFromDay < ctx.todayIdx));

      const dailyClassification = !isWeekly ? (isYesterday ? 'yesterday' : 'today') : undefined;

      // タスク本体ブロックの配置
      ctx.dayBlocks[d].push({
        id: taskCtx.plan.isRescheduledPlan
          ? `block-rescheduled-${d}-${taskCtx.plan.origTaskId || taskCtx.task.id}`
          : `block-task-${d}-${taskCtx.task.id}-${taskCtx.placedCountInDay}`,
        title: taskCtx.task.title,
        category: taskCtx.task.category,
        startMinutes: taskStart,
        endMinutes: taskEnd,
        isFixed: false,
        isBreak: false,
        breakMinutes: effectiveBreak > 0 ? effectiveBreak : undefined,
        color: isWeekly ? WEEKLY_TASK_COLOR : getCategoryColor(taskCtx.task.category),
        taskId: taskCtx.plan.origTaskId || taskCtx.task.id,
        priority: taskCtx.task.priority,
        taskType: taskCtx.task.taskType || 'task',
        deadlineDay: taskCtx.task.deadlineDay,
        dayIndex: d,
        sourceTableId: taskCtx.task.sourceTableId,
        sourceTableName: taskCtx.task.sourceTableName,
        url: taskCtx.task.url,
        isWeeklyTask: isWeekly,
        isRescheduled: taskCtx.plan.isRescheduledPlan,
        rescheduledFromDay: taskCtx.plan.rescheduledFromDay,
        originalBlockId: taskCtx.plan.originalBlockId,
        originDayIndex:
          taskCtx.plan.rescheduledFromDay !== undefined ? taskCtx.plan.rescheduledFromDay : d,
        // Plan14: 日付・週の概念による分類情報
        weeklyClassification,
        dailyClassification,
        taskOriginWeek: taskCtx.task.taskOriginWeek,
        isFromLastWeek: taskCtx.task.isFromLastWeek,
        isYesterdayTask: isYesterday,
      });

      // スロット消費 & 分割
      const consumedEnd = taskEnd + effectiveBreak;
      if (effectiveSlotStart > slot.startMinutes) {
        const remainingAfter = slot.endMinutes - consumedEnd;
        slot.endMinutes = effectiveSlotStart;
        slot.durationMinutes = slot.endMinutes - slot.startMinutes;
        if (remainingAfter >= 15) {
          slots.push({
            startMinutes: consumedEnd,
            endMinutes: consumedEnd + remainingAfter,
            durationMinutes: remainingAfter,
          });
          slots.sort((a, b) => a.startMinutes - b.startMinutes);
        }
      } else {
        slot.startMinutes = consumedEnd;
        slot.durationMinutes = slot.endMinutes - consumedEnd;
      }

      taskCtx.placedCountInDay++;
      taskCtx.plan.placedCount++;
      taskCtx.plan.placedCountPerDay[d] = (taskCtx.plan.placedCountPerDay[d] || 0) + 1;
      ctx.scheduledTaskMinutes += effectiveDuration;

      if (!taskCtx.isAuto) {
        if (
          taskCtx.kind === 'assignment' ||
          taskCtx.kind === 'attached_task' ||
          taskCtx.kind === 'weekly_flexible' ||
          taskCtx.kind === 'weekly_specific'
        ) {
          if (taskCtx.plan.placedCount >= taskCtx.plan.targetCountWeekly) {
            taskCtx.plan.isComplete = true;
          }
        } else if (taskCtx.kind === 'daily_fixed') {
          const allDone = taskCtx.plan.candidateDays.every(
            (cd) => (taskCtx.plan.placedCountPerDay[cd] || 0) >= taskCtx.plan.targetCountPerDay,
          );
          if (allDone) {
            taskCtx.plan.isComplete = true;
          }
        }
      }

      return true;
    }
    return false;
  };
}

/**
 * 優先順位ソート関数
 */
export function sortDayTaskContexts(contexts: DayTaskContext[]): void {
  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  contexts.sort((a, b) => {
    // 未完了週タスクの再配置プラン（isRescheduledPlan）は最優先
    const isRescheduledA = a.plan.isRescheduledPlan;
    const isRescheduledB = b.plan.isRescheduledPlan;
    if (isRescheduledA && !isRescheduledB) return -1;
    if (!isRescheduledA && isRescheduledB) return 1;

    // 親タスクと付随タスクの関係
    const isAParentOfB =
      b.task.isAttachedTask &&
      (b.task.parentTitle === a.task.title ||
        (b.task.parentTitle && a.task.title.startsWith(b.task.parentTitle)));
    const isBParentOfA =
      a.task.isAttachedTask &&
      (a.task.parentTitle === b.task.title ||
        (a.task.parentTitle && a.task.title.startsWith(a.task.parentTitle)));
    if (isBParentOfA) return 1;
    if (isAParentOfB) return -1;

    // 付随タスク（同日優先、別日は下位）
    const isAttachedSameDayA = a.task.isAttachedTask && a.isSameDayAsParent;
    const isAttachedSameDayB = b.task.isAttachedTask && b.isSameDayAsParent;
    if (isAttachedSameDayA && !isAttachedSameDayB) return -1;
    if (!isAttachedSameDayA && isAttachedSameDayB) return 1;

    const isAttachedOtherDayA = a.task.isAttachedTask && !a.isSameDayAsParent;
    const isAttachedOtherDayB = b.task.isAttachedTask && !b.isSameDayAsParent;
    if (isAttachedOtherDayA && !isAttachedOtherDayB) return 1;
    if (!isAttachedOtherDayA && isAttachedOtherDayB) return -1;

    // 課題タスク（提出物・締切制約）
    const isAssignA = a.task.taskType === 'assignment' || a.task.deadlineDay !== undefined;
    const isAssignB = b.task.taskType === 'assignment' || b.task.deadlineDay !== undefined;
    if (isAssignA && !isAssignB) return -1;
    if (!isAssignA && isAssignB) return 1;

    // Must > Want
    const isMustA = a.task.category === 'must';
    const isMustB = b.task.category === 'must';
    if (isMustA && !isMustB) return -1;
    if (!isMustA && isMustB) return 1;

    // 優先度（High > Medium > Low）
    const pDiff = (priorityWeight[b.task.priority] || 1) - (priorityWeight[a.task.priority] || 1);
    if (pDiff !== 0) return pDiff;

    // 回数指定タスク > 自動タスク
    if (!a.isAuto && b.isAuto) return -1;
    if (a.isAuto && !b.isAuto) return 1;

    // 所要時間＋休憩時間（大 ➔ 小）
    const totalA = (a.task.durationMinutes || 0) + (a.task.breakMinutes || 0);
    const totalB = (b.task.durationMinutes || 0) + (b.task.breakMinutes || 0);
    return totalB - totalA;
  });
}

/**
 * 配置パイプラインマネージャー
 */
export class PlacementPipeline {
  private phases: PlacementPhase[] = [];

  constructor(phases: PlacementPhase[] = []) {
    this.phases = phases;
  }

  public addPhase(phase: PlacementPhase): this {
    this.phases.push(phase);
    return this;
  }

  public execute(ctx: SchedulingExecutionContext): void {
    for (const phase of this.phases) {
      phase.execute(ctx);
    }
  }
}

/**
 * 標準の4フェーズ配置パイプラインを生成するファクトリ
 */
export function createDefaultPlacementPipeline(): PlacementPipeline {
  return new PlacementPipeline([
    new WeeklyPlacementPhase(), // 1. 週タスクの直接優先配置＆柔軟配置（同日付随、条件合致週タスク、繰り越し、柔軟週タスク）
    new DailyFairPlacementPhase(), // 2. 回数指定日タスクの公平巡回配置（各曜日の日課を確保）
    new AttachedFallbackPhase(), // 3. 当日に入り切らなかった付随タスクの別日フォールバック（自動日タスクが枠を埋める前に最優先確保！）
    new DailyAutoPlacementPhase(), // 4. 自動敷き詰め日タスク（すべての固定枠・週タスク・日課タスク配置後の残りの空き枠のみ）
    new RescuePlacementPhase(), // 5. 最終救済フェーズ
  ]);
}
