import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from '../types';

/**
 * Phase 1: 週タスクの優先配置
 * 日タスクはいったん除外し、空き枠全体を使って週タスク（付随タスク同日・課題・特定曜日・柔軟）を最優先配置。
 * 第一希望曜日に枠が不足した場合は、他曜日の空き枠へのフォールバック探索を行う。
 */
export class WeeklyPlacementPhase implements PlacementPhase {
  readonly name = 'WeeklyPlacementPhase';

  execute(ctx: SchedulingExecutionContext): void {
    const { weeklyPlans, slotManager, tryPlaceContextInDay, sortDayTaskContexts } = ctx;

    const weeklyDayTaskContexts: Record<number, DayTaskContext[]> = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };

    for (const plan of weeklyPlans) {
      if (plan.kind === 'attached_task') {
        const preferredDays =
          plan.task.parentEndMinutesByDay && Object.keys(plan.task.parentEndMinutesByDay).length > 0
            ? Object.keys(plan.task.parentEndMinutesByDay).map(Number)
            : (plan.task.targetDays && plan.task.targetDays.length > 0
                ? plan.task.targetDays
                : (plan.task.startDay !== undefined ? [plan.task.startDay] : [0]));

        for (const d of plan.candidateDays) {
          const isSameDay = preferredDays.includes(d);
          weeklyDayTaskContexts[d].push({
            plan,
            task: plan.task,
            kind: plan.kind,
            isAuto: false,
            targetCount: 1,
            placedCountInDay: 0,
            isSameDayAsParent: isSameDay,
          });
        }
      } else if (plan.kind === 'assignment') {
        const bestDay = [...plan.candidateDays].sort((a, b) => {
          const needed = (plan.task.durationMinutes || 30) + (plan.task.breakMinutes || 0);
          const slotsA = slotManager.getAvailableSlots(a);
          const slotsB = slotManager.getAvailableSlots(b);
          const fitA = slotsA.some((s) => s.durationMinutes >= needed);
          const fitB = slotsB.some((s) => s.durationMinutes >= needed);
          if (fitA && !fitB) return -1;
          if (!fitA && fitB) return 1;
          const freeA = slotManager.getTotalFreeMinutes(a);
          const freeB = slotManager.getTotalFreeMinutes(b);
          return freeB - freeA;
        })[0];

        if (bestDay !== undefined) {
          weeklyDayTaskContexts[bestDay].push({
            plan,
            task: plan.task,
            kind: plan.kind,
            isAuto: false,
            targetCount: 1,
            placedCountInDay: 0,
          });
        }
      } else if (plan.kind === 'weekly_flexible') {
        const preferred =
          plan.task.targetDays && plan.task.targetDays.length > 0
            ? plan.task.targetDays
            : [];

        const sortedDays = [...plan.candidateDays].sort((a, b) => {
          const needed = (plan.task.durationMinutes || 30) + (plan.task.breakMinutes || 0);
          const slotsA = slotManager.getAvailableSlots(a);
          const slotsB = slotManager.getAvailableSlots(b);
          const fitA = slotsA.some((s) => s.durationMinutes >= needed);
          const fitB = slotsB.some((s) => s.durationMinutes >= needed);

          // 枠に収まる日の中で希望曜日を最優先
          if (fitA && fitB) {
            const isPrefA = preferred.includes(a);
            const isPrefB = preferred.includes(b);
            if (isPrefA && !isPrefB) return -1;
            if (!isPrefA && isPrefB) return 1;
          } else {
            if (fitA && !fitB) return -1;
            if (!fitA && fitB) return 1;
            const isPrefA = preferred.includes(a);
            const isPrefB = preferred.includes(b);
            if (isPrefA && !isPrefB) return -1;
            if (!isPrefA && isPrefB) return 1;
          }

          const freeA = slotManager.getTotalFreeMinutes(a);
          const freeB = slotManager.getTotalFreeMinutes(b);
          return freeB - freeA;
        });

        const assignedDays = sortedDays.slice(0, plan.targetCountWeekly);
        for (const d of assignedDays) {
          weeklyDayTaskContexts[d].push({
            plan,
            task: plan.task,
            kind: plan.kind,
            isAuto: false,
            targetCount: plan.task.dailyCount || 1,
            placedCountInDay: 0,
          });
        }
      } else {
        for (const d of plan.candidateDays) {
          weeklyDayTaskContexts[d].push({
            plan,
            task: plan.task,
            kind: plan.kind,
            isAuto: false,
            targetCount: plan.task.dailyCount || 1,
            placedCountInDay: 0,
          });
        }
      }
    }

    for (let d = 0; d < 7; d++) {
      sortDayTaskContexts(weeklyDayTaskContexts[d]);
    }

    // Phase 1 配置ループ（週タスク巡回）
    for (let d = 0; d < 7; d++) {
      const tasksInDay = weeklyDayTaskContexts[d];
      let pass = 0;
      const maxPasses = 20;
      let anyPlacedInDay = true;

      while (anyPlacedInDay && pass < maxPasses) {
        pass++;
        anyPlacedInDay = false;

        const eligibleTasks = tasksInDay.filter((taskCtx) => {
          if (taskCtx.plan.kind === 'attached_task' && taskCtx.plan.placedCount >= 1) return false;
          // 別日に回された付随タスク（!isSameDayAsParent）は Phase 1 では配置しない
          if (taskCtx.task.isAttachedTask && !taskCtx.isSameDayAsParent) return false;
          if (taskCtx.placedCountInDay >= taskCtx.targetCount) return false;
          if (taskCtx.plan.isComplete) return false;
          return taskCtx.targetCount >= pass;
        });
        if (eligibleTasks.length === 0) break;

        for (const taskCtx of eligibleTasks) {
          const placed = tryPlaceContextInDay(d, taskCtx, true);
          if (placed) {
            anyPlacedInDay = true;
          }
        }
      }

      slotManager.refreshDaySlots(d);
    }

    // Phase 1 フォールバック: 週タスク・課題・再配置プランで未達成のもの（付随タスク別日以外）
    for (const plan of weeklyPlans) {
      if (plan.isAuto || plan.isComplete) continue;
      if (plan.kind === 'attached_task') continue;

      // 第一候補日で収まらなかった場合、他曜日の空き枠もフォールバック候補として試行
      const fallbackDays =
        plan.candidateDays.length < 7
          ? [...plan.candidateDays, ...[0, 1, 2, 3, 4, 5, 6].filter((d) => !plan.candidateDays.includes(d))]
          : plan.candidateDays;

      for (const d of fallbackDays) {
        if (plan.placedCount >= plan.targetCountWeekly) {
          plan.isComplete = true;
          break;
        }
        if ((plan.placedCountPerDay[d] || 0) >= plan.targetCountPerDay) continue;

        const dummyCtx: DayTaskContext = {
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: plan.targetCountPerDay,
          placedCountInDay: plan.placedCountPerDay[d] || 0,
          isSameDayAsParent: false,
        };

        const placed = tryPlaceContextInDay(d, dummyCtx, true);
        if (placed) {
          slotManager.refreshDaySlots(d);
        }
      }
    }
  }
}
