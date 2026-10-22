import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from '../types';

/**
 * Phase 1: 週タスクの優先配置
 * 日タスクはいったん除外し、空き枠全体を使って週タスク（付随タスク同日・課題・特定曜日・柔軟）を最優先配置。
 * 第一希望曜日に枠が不足した場合は、他曜日の空き枠へのフォールバック探索を行う。
 */
export class WeeklyPlacementPhase implements PlacementPhase {
  readonly name = 'WeeklyPlacementPhase';

  execute(ctx: SchedulingExecutionContext): void {
    const { weeklyPlans, slotManager, tryPlaceContextInDay } = ctx;

    // 1. 付随タスク（講義同日配置）を最優先で配置
    for (const plan of weeklyPlans) {
      if (plan.kind !== 'attached_task') continue;
      const preferredDays =
        plan.task.parentEndMinutesByDay && Object.keys(plan.task.parentEndMinutesByDay).length > 0
          ? Object.keys(plan.task.parentEndMinutesByDay).map(Number)
          : (plan.task.targetDays && plan.task.targetDays.length > 0
              ? plan.task.targetDays
              : (plan.task.startDay !== undefined ? [plan.task.startDay] : [0]));

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
        }
      }
    }

    // 2. その他の週タスク（課題・特定曜日・柔軟・再配置）の動的即時配置
    // 所要時間の大きい順（大きい枠を必要とするタスクほど先に配置）かつ優先度順にソート（ビンパッキング最良原則）
    const generalWeeklyPlans = weeklyPlans
      .filter((p) => p.kind !== 'attached_task')
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

    for (const plan of generalWeeklyPlans) {
      if (plan.isComplete) continue;

      const neededDuration =
        (plan.task.durationMinutes ||
          (plan.task.durationSize === 'small'
            ? 25
            : plan.task.durationSize === 'medium'
              ? 45
              : plan.task.durationSize === 'large'
                ? 120
                : 30)) + (plan.task.breakMinutes || 0);

      // 第一希望曜日（preferred）
      const preferred =
        plan.task.targetDays && plan.task.targetDays.length > 0
          ? plan.task.targetDays
          : plan.task.startDay !== undefined
            ? [plan.task.startDay]
            : [];

      // 周期指定タスク（cycleDays）は指定周期日（candidateDays）のみを対象とし、オフ日には配置しない
      const isCycleSpecific =
        plan.kind === 'weekly_specific' || (plan.task.cycleDays && plan.task.cycleDays.length > 0);
      const allDays = isCycleSpecific ? [...plan.candidateDays] : [0, 1, 2, 3, 4, 5, 6];

      // 締め切り日（deadlineDay）の考慮（課題タスク等）
      const eligibleDays = allDays.filter((d) => {
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

      // 探索曜日のソート：
      // ① スロットが設定時間を満たす日の中で、第一希望曜日を最優先
      // ② スロットが設定時間を満たす他曜日（空き時間順）
      // ③ それ以外の日（空き時間順）
      const sortedSearchDays = [...eligibleDays].sort((a, b) => {
        const slotsA = slotManager.getAvailableSlots(a);
        const slotsB = slotManager.getAvailableSlots(b);
        const fitA = slotsA.some((s) => s.durationMinutes >= neededDuration);
        const fitB = slotsB.some((s) => s.durationMinutes >= neededDuration);

        if (fitA && !fitB) return -1;
        if (!fitA && fitB) return 1;

        const isPrefA = preferred.includes(a);
        const isPrefB = preferred.includes(b);
        if (isPrefA && !isPrefB) return -1;
        if (!isPrefA && isPrefB) return 1;

        const freeA = slotManager.getTotalFreeMinutes(a);
        const freeB = slotManager.getTotalFreeMinutes(b);
        return freeB - freeA;
      });

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
        }
      }

      // もし締め切り制限等で収まりきらなかった場合、締め切り外の曜日も含めて週全体で救済探索
      if (plan.placedCount < plan.targetCountWeekly && !plan.isComplete) {
        const remainingDays = allDays.filter((d) => !sortedSearchDays.includes(d));
        const sortedRemaining = remainingDays.sort((a, b) => {
          const freeA = slotManager.getTotalFreeMinutes(a);
          const freeB = slotManager.getTotalFreeMinutes(b);
          return freeB - freeA;
        });

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
