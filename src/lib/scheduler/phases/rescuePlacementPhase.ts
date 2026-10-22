import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from '../types';
import { isWeeklyTaskItem } from '../constants';

/**
 * Phase 4: 最終救済フォールバック
 * 未だ1回も配置されていないタスク（placedCount === 0）の救済配置。
 * 必要以上に未配置タスクが残るのを防ぐため、空きのある全曜日の残余スロットに対して配置を試みる。
 */
export class RescuePlacementPhase implements PlacementPhase {
  readonly name = 'RescuePlacementPhase';

  execute(ctx: SchedulingExecutionContext): void {
    const { plans, slotManager, tryPlaceContextInDay } = ctx;

    const unplacedPlans = plans.filter((p) => p.placedCount === 0 && !p.isAuto);
    for (const plan of unplacedPlans) {
      if (plan.placedCount > 0) continue;

      // 空き時間の長い曜日から順に試行
      const daysByFree = slotManager.getDaysSortedByFreeTime([0, 1, 2, 3, 4, 5, 6]);

      for (const d of daysByFree) {
        if (plan.placedCount > 0) break;

        const dummyCtx: DayTaskContext = {
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: 1,
          placedCountInDay: 0,
          isSameDayAsParent: false,
        };

        const placed = tryPlaceContextInDay(d, dummyCtx, isWeeklyTaskItem(plan.task));
        if (placed) {
          slotManager.refreshDaySlots(d);
          break;
        }
      }
    }
  }
}
