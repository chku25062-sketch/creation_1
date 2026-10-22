import { PlacementPhase, SchedulingExecutionContext, DayTaskContext } from '../types';

/**
 * Phase 2 (週タスク完了フェーズ): 付随タスクの別日フォールバック
 * 親の日に配置できず、別日に回された付随タスクの配置。
 * 日課タスク（日タスク）が動く前に、週タスクとしての枠を別日の空き枠から最優先で確保する。
 */
export class AttachedFallbackPhase implements PlacementPhase {
  readonly name = 'AttachedFallbackPhase';

  execute(ctx: SchedulingExecutionContext): void {
    const { weeklyPlans, slotManager, tryPlaceContextInDay } = ctx;

    for (const plan of weeklyPlans) {
      if (plan.kind !== 'attached_task' || plan.placedCount >= 1) continue;

      for (const d of plan.candidateDays) {
        if (plan.placedCount >= 1) break;

        const dummyCtx: DayTaskContext = {
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: 1,
          placedCountInDay: 0,
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
