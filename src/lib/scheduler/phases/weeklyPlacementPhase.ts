import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from '../types';
import { tryPlaceSplitAttachedTask } from './splitPlacementHelper';

/**
 * Phase 1: 週タスクの優先配置
 * 日タスクはいったん除外し、空き枠全体を使って週タスク（付随タスク同日・課題・特定曜日・柔軟）を最優先配置。
 * 第一希望曜日に枠が不足した場合は、他曜日の空き枠へのフォールバック探索を行う。
 */
export class WeeklyPlacementPhase implements PlacementPhase {
  readonly name = 'WeeklyPlacementPhase';

  execute(ctx: SchedulingExecutionContext): void {
    const { weeklyPlans, slotManager, tryPlaceContextInDay } = ctx;

    // -------------------------------------------------------------
    // ステップ1: 講義同日の付随タスク（attached_task）の最優先配置
    // -------------------------------------------------------------
    for (const plan of weeklyPlans) {
      if (plan.kind !== 'attached_task') continue;
      const preferredDays =
        plan.task.parentEndMinutesByDay && Object.keys(plan.task.parentEndMinutesByDay).length > 0
          ? Object.keys(plan.task.parentEndMinutesByDay).map(Number)
          : plan.task.targetDays && plan.task.targetDays.length > 0
            ? plan.task.targetDays
            : plan.task.startDay !== undefined
              ? [plan.task.startDay]
              : [0];

      for (const d of preferredDays) {
        if (plan.placedCount >= plan.targetCountWeekly) {
          plan.isComplete = true;
          break;
        }
        const taskCtx: DayTaskContext = {
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: 1,
          placedCountInDay: plan.placedCountPerDay[d] || 0,
          isSameDayAsParent: true,
        };
        const placed = tryPlaceContextInDay(d, taskCtx, true);
        if (placed) {
          slotManager.refreshDaySlots(d);
        } else if (plan.task.allowSplit) {
          // ★ Plan16: 連続枠に入らない場合、設定された最小単位に合わせて分割配置
          const splitPlaced = tryPlaceSplitAttachedTask(d, taskCtx, ctx);
          if (splitPlaced) {
            slotManager.refreshDaySlots(d);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // ステップ2: 曜日ごとの「その日の固定枠直後に条件を満たす週タスク」の直接優先配置
    // （ユーザー指示: 週タスクは日ブロックから独立させ、その日の固定枠の配置直後に条件を満たす週タスクを配置）
    // -------------------------------------------------------------
    const normalWeeklyPlans = weeklyPlans
      .filter((p) => !p.isRescheduledPlan && p.kind !== 'attached_task')
      .sort((a, b) => {
        const durA =
          a.task.durationMinutes ||
          (a.task.durationSize === 'small'
            ? 25
            : a.task.durationSize === 'medium'
              ? 45
              : a.task.durationSize === 'large'
                ? 120
                : 30);
        const durB =
          b.task.durationMinutes ||
          (b.task.durationSize === 'small'
            ? 25
            : b.task.durationSize === 'medium'
              ? 45
              : b.task.durationSize === 'large'
                ? 120
                : 30);
        if (durB !== durA) return durB - durA; // 長いタスクを優先
        const prioMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const pA = prioMap[a.task.priority || 'medium'] || 2;
        const pB = prioMap[b.task.priority || 'medium'] || 2;
        return pB - pA;
      });

    // 曜日ごとに、その日の固定枠配置直後のクリーンな空き枠に対して「その日の条件を満たす週タスク」を直接配置
    for (let d = 0; d < 7; d++) {
      const plansForThisDay = normalWeeklyPlans.filter((plan) => {
        if (plan.isComplete) return false;
        const scheduleAfterDay =
          plan.task.scheduleAfterDay ??
          (plan.task.scheduleAfterEnabled ? plan.task.startDay : undefined);
        if (scheduleAfterDay !== undefined && d < scheduleAfterDay) return false;

        const targetDays = plan.task.targetDays || [];
        const isTarget = targetDays.includes(d);
        const isStart = plan.task.startDay === d;
        const isDeadline = plan.task.deadlineDay === d;
        return isTarget || isStart || isDeadline;
      });

      for (const plan of plansForThisDay) {
        if (plan.placedCount >= plan.targetCountWeekly) {
          plan.isComplete = true;
          continue;
        }
        if ((plan.placedCountPerDay[d] || 0) >= plan.targetCountPerDay) continue;

        const taskCtx: DayTaskContext = {
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: plan.targetCountPerDay,
          placedCountInDay: plan.placedCountPerDay[d] || 0,
          isSameDayAsParent: false,
        };

        const placed = tryPlaceContextInDay(d, taskCtx, true);
        if (placed) {
          slotManager.refreshDaySlots(d);
        } else if (plan.task.allowSplit) {
          // ★ Plan16: 連続枠に入らない場合、設定された最小単位に合わせて分割配置
          const splitPlaced = tryPlaceSplitAttachedTask(d, taskCtx, ctx);
          if (splitPlaced) {
            slotManager.refreshDaySlots(d);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // ステップ3: 以前の未完了の週タスク（過去から繰り越された再配置プラン）の配置
    // （今日以降の空き枠に対して配置）
    // -------------------------------------------------------------
    const rescheduledPlans = weeklyPlans
      .filter((p) => p.isRescheduledPlan)
      .sort((a, b) => {
        const durA =
          a.task.durationMinutes ||
          (a.task.durationSize === 'small'
            ? 25
            : a.task.durationSize === 'medium'
              ? 45
              : a.task.durationSize === 'large'
                ? 120
                : 30);
        const durB =
          b.task.durationMinutes ||
          (b.task.durationSize === 'small'
            ? 25
            : b.task.durationSize === 'medium'
              ? 45
              : b.task.durationSize === 'large'
                ? 120
                : 30);
        return durB - durA;
      });

    for (const plan of rescheduledPlans) {
      if (plan.isComplete) continue;
      const candidateDays =
        plan.candidateDays && plan.candidateDays.length > 0
          ? plan.candidateDays
          : [0, 1, 2, 3, 4, 5, 6];
      const isConcentrated = ctx.realtimeContext?.placementStrategy === 'concentrated';
      const sortedDays = isConcentrated
        ? [...candidateDays].sort((a, b) => a - b)
        : slotManager.getDaysSortedByFreeTime(candidateDays);

      for (const d of sortedDays) {
        if (plan.placedCount >= plan.targetCountWeekly) {
          plan.isComplete = true;
          break;
        }
        if ((plan.placedCountPerDay[d] || 0) >= plan.targetCountPerDay) continue;

        const taskCtx: DayTaskContext = {
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: plan.targetCountPerDay,
          placedCountInDay: plan.placedCountPerDay[d] || 0,
          isSameDayAsParent: false,
        };

        const placed = tryPlaceContextInDay(d, taskCtx, true);
        if (placed) {
          slotManager.refreshDaySlots(d);
        } else if (plan.task.allowSplit) {
          // ★ Plan16: 連続枠に入らない場合、設定された最小単位に合わせて分割配置
          const splitPlaced = tryPlaceSplitAttachedTask(d, taskCtx, ctx);
          if (splitPlaced) {
            slotManager.refreshDaySlots(d);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // ステップ4: まだ目標回数に達していない週タスク（柔軟週タスク＆あふれたタスク）の週全体フォールバック救済配置
    // -------------------------------------------------------------
    for (const plan of normalWeeklyPlans) {
      if (plan.isComplete) continue;
      if (plan.placedCount >= plan.targetCountWeekly) {
        plan.isComplete = true;
        continue;
      }

      // 周期指定タスク（cycleDays）は指定周期日（candidateDays）のみを対象とし、オフ日には配置しない
      const isCycleSpecific =
        plan.kind === 'weekly_specific' || (plan.task.cycleDays && plan.task.cycleDays.length > 0);
      const allDays = isCycleSpecific ? [...plan.candidateDays] : [0, 1, 2, 3, 4, 5, 6];

      // 指定日時以降オプションの考慮
      const scheduleAfterDay =
        plan.task.scheduleAfterDay ??
        (plan.task.scheduleAfterEnabled ? plan.task.startDay : undefined);

      // 締め切り日（deadlineDay）および指定日時以降（scheduleAfterDay）の考慮
      const eligibleDays = allDays.filter((d) => {
        if (scheduleAfterDay !== undefined && d < scheduleAfterDay) return false;
        if (plan.task.deadlineDay !== undefined) {
          const startD = plan.task.startDay !== undefined ? plan.task.startDay : 0;
          if (startD <= plan.task.deadlineDay) {
            return d >= startD && d <= plan.task.deadlineDay;
          } else {
            return d >= startD || d <= plan.task.deadlineDay;
          }
        }
        return true;
      });

      // タスク本体の所要時間（休憩抜きで枠に収まるかを判定）
      const neededDuration =
        plan.task.durationMinutes ||
        (plan.task.durationSize === 'small'
          ? 25
          : plan.task.durationSize === 'medium'
            ? 45
            : plan.task.durationSize === 'large'
              ? 120
              : 30);

      // 探索曜日のソート：
      // 付随タスク（attached_task）は親の日に近い直近順（candidateDaysの並び順）
      // 通常週タスクは：
      // ① スロットが設定時間を満たす他曜日（空き時間順）
      // ② それ以外の日（空き時間順）
      let sortedSearchDays: number[];
      if (plan.kind === 'attached_task') {
        const candidateOrder = plan.candidateDays || [0, 1, 2, 3, 4, 5, 6];
        sortedSearchDays = [...eligibleDays].sort((a, b) => {
          const idxA = candidateOrder.indexOf(a);
          const idxB = candidateOrder.indexOf(b);
          return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
        });
      } else if (ctx.realtimeContext?.placementStrategy === 'concentrated') {
        // 集中配置: スロットが収まる直近の曜日（前倒し順）を最優先
        sortedSearchDays = [...eligibleDays].sort((a, b) => {
          const slotsA = slotManager.getAvailableSlots(a);
          const slotsB = slotManager.getAvailableSlots(b);
          const fitA = slotsA.some((s) => s.durationMinutes >= neededDuration);
          const fitB = slotsB.some((s) => s.durationMinutes >= neededDuration);

          if (fitA && !fitB) return -1;
          if (!fitA && fitB) return 1;

          return a - b; // 直近の曜日（今日寄り）を優先
        });
      } else {
        sortedSearchDays = [...eligibleDays].sort((a, b) => {
          const slotsA = slotManager.getAvailableSlots(a);
          const slotsB = slotManager.getAvailableSlots(b);
          const fitA = slotsA.some((s) => s.durationMinutes >= neededDuration);
          const fitB = slotsB.some((s) => s.durationMinutes >= neededDuration);

          if (fitA && !fitB) return -1;
          if (!fitA && fitB) return 1;

          const freeA = slotManager.getTotalFreeMinutes(a);
          const freeB = slotManager.getTotalFreeMinutes(b);
          return freeB - freeA;
        });
      }

      // 目標配置回数に達するまで順次配置
      for (const d of sortedSearchDays) {
        if (plan.placedCount >= plan.targetCountWeekly) {
          plan.isComplete = true;
          break;
        }
        if ((plan.placedCountPerDay[d] || 0) >= plan.targetCountPerDay) continue;

        const taskCtx: DayTaskContext = {
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: plan.targetCountPerDay,
          placedCountInDay: plan.placedCountPerDay[d] || 0,
          isSameDayAsParent: false,
        };

        const placed = tryPlaceContextInDay(d, taskCtx, true);
        if (placed) {
          slotManager.refreshDaySlots(d);
        } else if (plan.task.allowSplit) {
          // ★ Plan16: 連続枠に入らない場合、設定された最小単位に合わせて分割配置
          const splitPlaced = tryPlaceSplitAttachedTask(d, taskCtx, ctx);
          if (splitPlaced) {
            slotManager.refreshDaySlots(d);
          }
        }
      }

      // もし締め切り制限等で収まりきらなかった場合、締め切り外の曜日も含めて週全体で救済探索
      if (plan.placedCount < plan.targetCountWeekly && !plan.isComplete) {
        const remainingDays = allDays.filter((d) => !sortedSearchDays.includes(d));
        const sortedRemaining = slotManager.getDaysSortedByFreeTime(remainingDays);

        for (const d of sortedRemaining) {
          if (plan.placedCount >= plan.targetCountWeekly) {
            plan.isComplete = true;
            break;
          }
          if ((plan.placedCountPerDay[d] || 0) >= plan.targetCountPerDay) continue;

          const taskCtx: DayTaskContext = {
            plan,
            task: plan.task,
            kind: plan.kind,
            isAuto: false,
            targetCount: plan.targetCountPerDay,
            placedCountInDay: plan.placedCountPerDay[d] || 0,
            isSameDayAsParent: false,
          };

          const placed = tryPlaceContextInDay(d, taskCtx, true);
          if (placed) {
            slotManager.refreshDaySlots(d);
          }
        }
      }
    }
  }
}
