import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from '../types';

/**
 * Phase 2: 日課タスク（日タスク）の再配置
 * 週タスクを配置した残りの空き枠に対して配置。
 * Plan9 原則: 1巡目は1回以上、2巡目は2回以上、3巡目は3回以上のタスク＋自動タスクを公平巡回配置。
 */
export class DailyFairPlacementPhase implements PlacementPhase {
  readonly name = 'DailyFairPlacementPhase';

  execute(ctx: SchedulingExecutionContext): void {
    const { dailyPlans, slotManager, tryPlaceContextInDay, sortDayTaskContexts } = ctx;

    const dailyDayTaskContexts: Record<number, DayTaskContext[]> = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };

    for (let d = 0; d < 7; d++) {
      const dayContexts: DayTaskContext[] = [];

      for (const plan of dailyPlans) {
        if (plan.candidateDays.includes(d)) {
          dayContexts.push({
            plan,
            task: plan.task,
            kind: plan.kind,
            isAuto: plan.isAuto,
            targetCount: plan.isAuto ? Infinity : plan.targetCountPerDay,
            placedCountInDay: plan.placedCountPerDay[d] || 0,
          });
        }
      }

      sortDayTaskContexts(dayContexts);
      dailyDayTaskContexts[d] = dayContexts;
    }

    // Phase 2 配置ループ（日タスク巡回 & 自動敷き詰め）
    for (let d = 0; d < 7; d++) {
      const tasksInDay = dailyDayTaskContexts[d];
      let pass = 0;
      const maxPasses = 100;
      let anyPlacedInDay = true;

      while (anyPlacedInDay && pass < maxPasses) {
        pass++;
        anyPlacedInDay = false;

        const eligibleTasks = tasksInDay.filter((taskCtx) => {
          if (!taskCtx.isAuto && taskCtx.placedCountInDay >= taskCtx.targetCount) return false;
          return taskCtx.targetCount >= pass;
        });
        if (eligibleTasks.length === 0) break;

        for (const taskCtx of eligibleTasks) {
          const placed = tryPlaceContextInDay(d, taskCtx, false);
          if (placed) {
            anyPlacedInDay = true;
          }
        }
      }

      slotManager.refreshDaySlots(d);
    }
  }
}
