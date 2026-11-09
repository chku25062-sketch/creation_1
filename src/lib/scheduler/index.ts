import { FixedSlot, TaskItem, TheoreticalBlock, WeeklySchedulingResult } from '@/types';
import { SchedulingRealtimeContext, SchedulingExecutionContext } from './types';
import { SlotManager } from './slotManager';
import { generatePlacementPlans } from './planGenerator';
import {
  createDefaultPlacementPipeline,
  createPlaceContextHelper,
  sortDayTaskContexts,
} from './placementPipeline';
import { applyRealtimeAdaptation } from './realtimeAdaptor';
import { calculateScheduleMetrics } from './metricsCalculator';

// 外部公開するユーティリティ・定数・関数の再エクスポート
export * from './constants';
export * from './types';
export * from './slotManager';
export * from './placementPipeline';
export * from './planGenerator';
export * from './realtimeAdaptor';
export * from './metricsCalculator';
export * from './taskClassifier';

/**
 * 1週間（7日間: 月曜=0 〜 日曜=6）の自律的理論値スケジューリングエンジン
 * Plan11: リアルタイム完了状態判定、未完了週タスクの動的再配置、早期完了枠への代行タスク配置に対応
 */
export function generateTheoreticalSchedule(
  fixedSlots: FixedSlot[],
  tasks: TaskItem[],
  realtimeContext?: SchedulingRealtimeContext,
): WeeklySchedulingResult & { blocks: TheoreticalBlock[] } {
  const dayBlocks: Record<number, TheoreticalBlock[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };

  // 1. リアルタイム基準日時の確定
  const now = new Date();
  const todayIdx =
    realtimeContext?.todayIndex !== undefined ? realtimeContext.todayIndex : (now.getDay() + 6) % 7;
  const currMinutes =
    realtimeContext?.currentMinutes !== undefined
      ? realtimeContext.currentMinutes
      : now.getHours() * 60 + now.getMinutes();

  const userCompletedIds = realtimeContext?.completedBlockIds || new Set<string>();
  const userUncompletedIds = realtimeContext?.uncompletedBlockIds || new Set<string>();
  const placementStrategy = realtimeContext?.placementStrategy || 'balanced';

  // 2. 固定枠と空きスロットの統合管理初期化
  const slotManager = new SlotManager(fixedSlots, dayBlocks);

  // 3. タスク計画の策定（分類、課題・付随・日課・週タスク・未完了再配置クローン）
  const { schedulableTasks, plans, weeklyPlans, dailyPlans } = generatePlacementPlans(
    tasks,
    slotManager,
    {
      todayIndex: todayIdx,
      currentMinutes: currMinutes,
      completedBlockIds: userCompletedIds,
      uncompletedBlockIds: userUncompletedIds,
      placementStrategy,
    },
    todayIdx,
    currMinutes,
  );

  // 4. スケジューリング実行コンテキストの構築
  const executionContext: SchedulingExecutionContext = {
    fixedSlots,
    tasks,
    schedulableTasks,
    plans,
    weeklyPlans,
    dailyPlans,
    slotManager,
    dayBlocks,
    scheduledTaskMinutes: 0,
    realtimeContext: {
      todayIndex: todayIdx,
      currentMinutes: currMinutes,
      completedBlockIds: userCompletedIds,
      uncompletedBlockIds: userUncompletedIds,
      placementStrategy,
    },
    todayIdx,
    currMinutes,
    userCompletedIds,
    userUncompletedIds,
    tryPlaceContextInDay: () => false, // 後ほどバインド
    sortDayTaskContexts,
  };

  executionContext.tryPlaceContextInDay = createPlaceContextHelper(executionContext);

  // 5. プラガブル配置パイプラインの実行（Phase 1: 週タスク -> Phase 2: 日課公平巡回 -> Phase 3: 付随別日 -> Phase 4: 最終救済）
  const pipeline = createDefaultPlacementPipeline();
  pipeline.execute(executionContext);

  // 6. リアルタイム完了状態適応 & 早期完了枠への代替タスク配置
  const { scheduledTaskMinutesDelta } = applyRealtimeAdaptation({
    dayBlocks,
    plans,
    tasks,
    todayIdx,
    currMinutes,
    userCompletedIds,
    userUncompletedIds,
  });
  executionContext.scheduledTaskMinutes += scheduledTaskMinutesDelta;

  // 7. 未配置タスク集計・メトリクス・サマリー計算
  const { unassignedTasks, allBlocks, metrics, categorySummaries } = calculateScheduleMetrics(
    schedulableTasks,
    plans,
    dayBlocks,
    slotManager,
    executionContext.scheduledTaskMinutes,
  );

  return {
    dayBlocks,
    allBlocks,
    blocks: dayBlocks[0], // 0(月曜)のブロックをデフォルト互換用として保持
    unassignedTasks,
    metrics,
    categorySummaries,
  };
}
