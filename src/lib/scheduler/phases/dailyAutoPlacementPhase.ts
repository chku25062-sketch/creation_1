import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from '../types';

/**
 * Phase 4: 自動敷き詰め日タスク（dailyRepeatMode: auto）の余白配置
 * すべての固定枠、週タスク（付随タスクフォールバック含む）、回数指定日タスクが配置された後、
 * 残ったクリーンな余白時間に対して自動敷き詰めタスクを公平巡回配置する。
 */
export class DailyAutoPlacementPhase implements PlacementPhase {
  readonly name = 'DailyAutoPlacementPhase';

  execute(ctx: SchedulingExecutionContext): void {
    const { dailyPlans, slotManager, tryPlaceContextInDay, sortDayTaskContexts } = ctx;

    const autoPlans = dailyPlans.filter((p) => p.isAuto);
    if (autoPlans.length === 0) return;

    for (let d = 0; d < 7; d++) {
      const dayContexts: DayTaskContext[] = [];

      for (const plan of autoPlans) {
        if (plan.candidateDays.includes(d)) {
          dayContexts.push({
            plan,
            task: plan.task,
            kind: plan.kind,
            isAuto: true,
            targetCount: Infinity,
            placedCountInDay: plan.placedCountPerDay[d] || 0,
          });
        }
      }

      if (dayContexts.length === 0) continue;
      sortDayTaskContexts(dayContexts);

      let pass = 0;
      const maxPasses = 100;
      let anyPlacedInDay = true;

      while (anyPlacedInDay && pass < maxPasses) {
        pass++;
        anyPlacedInDay = false;

        for (const taskCtx of dayContexts) {
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
