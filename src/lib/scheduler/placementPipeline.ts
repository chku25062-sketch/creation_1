import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from './types';
import { getAdjustedDuration, getCategoryColor } from './constants';
import { WeeklyPlacementPhase } from './phases/weeklyPlacementPhase';
import { DailyFairPlacementPhase } from './phases/dailyFairPlacementPhase';
import { AttachedFallbackPhase } from './phases/attachedFallbackPhase';
import { RescuePlacementPhase } from './phases/rescuePlacementPhase';

/**
 * スロットへのタスク配置実行・スロット分割ヘルパー
 */
export function createPlaceContextHelper(ctx: SchedulingExecutionContext) {
  return (d: number, taskCtx: DayTaskContext, isWeekly: boolean): boolean => {
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

      // 再配置プランかつ今日（d === todayIdx）の場合、現在時刻以降にのみ配置
      if (taskCtx.plan.isRescheduledPlan && d === ctx.todayIdx) {
        taskEarliestStartTime = Math.max(taskEarliestStartTime, ctx.currMinutes);
      }

      const effectiveSlotStart = Math.max(slot.startMinutes, taskEarliestStartTime);
      if (effectiveSlotStart >= taskLatestEndTime) continue;

      const requiredMin =
        taskCtx.task.isAttachedTask && taskCtx.task.durationMinutes
          ? taskCtx.task.durationMinutes
          : taskCtx.task.durationSize === 'small'
            ? 15
            : taskCtx.task.durationSize === 'medium'
              ? 30
              : taskCtx.task.durationMinutes || 30;

      const breakMin =
        taskCtx.task.breakMinutes && taskCtx.task.breakMinutes > 0 ? taskCtx.task.breakMinutes : 0;
      const minAcceptable = taskCtx.isAuto ? Math.min(requiredMin, 15) : requiredMin;

      const maxAllowedEnd = Math.min(slot.endMinutes, taskLatestEndTime);
      const availableDuration = maxAllowedEnd - effectiveSlotStart;
      if (availableDuration < minAcceptable + breakMin) continue;

      const effectiveDuration = taskCtx.isAuto
        ? Math.min(
            taskCtx.task.durationMinutes && taskCtx.task.durationMinutes > 0
              ? taskCtx.task.durationMinutes
              : 60,
            Math.max(15, availableDuration - breakMin),
          )
        : getAdjustedDuration(taskCtx.task, availableDuration - breakMin);

      const totalNeeded = effectiveDuration + breakMin;
      if (availableDuration < totalNeeded) continue;

      const taskStart = effectiveSlotStart;
      const taskEnd = taskStart + effectiveDuration;

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
        breakMinutes: breakMin > 0 ? breakMin : undefined,
        color: getCategoryColor(taskCtx.task.category),
        taskId: taskCtx.plan.origTaskId || taskCtx.task.id,
        priority: taskCtx.task.priority,
        taskType: taskCtx.task.taskType || 'task',
        deadlineDay: taskCtx.task.deadlineDay,
        dayIndex: d,
        sourceTableId: taskCtx.task.sourceTableId,
        sourceTableName: taskCtx.task.sourceTableName,
        isWeeklyTask: isWeekly,
        isRescheduled: taskCtx.plan.isRescheduledPlan,
        rescheduledFromDay: taskCtx.plan.rescheduledFromDay,
      });

      // スロット消費 & 分割
      if (effectiveSlotStart > slot.startMinutes) {
        const consumedEnd = taskEnd + breakMin;
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
        slot.startMinutes = taskEnd + breakMin;
        slot.durationMinutes = slot.endMinutes - (taskEnd + breakMin);
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
    new WeeklyPlacementPhase(),
    new DailyFairPlacementPhase(),
    new AttachedFallbackPhase(),
    new RescuePlacementPhase(),
  ]);
}
