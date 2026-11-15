import { TaskItem, TheoreticalBlock, FixedSlot, TaskPlacementStrategy } from '@/types';
import { SlotManager } from './slotManager';

export type { TaskPlacementStrategy } from '@/types';

export interface TaskPlacementPlan {
  task: TaskItem;
  kind:
    | 'assignment'
    | 'weekly_specific'
    | 'daily_fixed'
    | 'weekly_flexible'
    | 'daily_auto'
    | 'attached_task';
  isAuto: boolean;
  targetCountPerDay: number;
  targetCountWeekly: number;
  candidateDays: number[];
  placedCount: number;
  placedCountPerDay: Record<number, number>;
  placedSplits?: number; // ★ 分割タスクの配置済みスライス総数
  isComplete: boolean;
  isRescheduledPlan?: boolean; // 未完了週タスクの再配置プランかどうか
  rescheduledFromDay?: number; // 再スケジュール元の曜日
  origTaskId?: string; // 元のタスクID
  originalBlockId?: string; // 再スケジュール元の大元ブロックID
}

export interface DayTaskContext {
  plan: TaskPlacementPlan;
  task: TaskItem;
  kind: string;
  isAuto: boolean;
  targetCount: number;
  placedCountInDay: number;
  isSameDayAsParent?: boolean;
}

export interface SchedulingRealtimeContext {
  todayIndex?: number; // 0:月〜6:日 (未指定時は実行時のシステム曜日)
  currentMinutes?: number; // 0〜1440 (未指定時は実行時のシステム時刻)
  completedBlockIds?: Set<string>; // ユーザーが手動で完了にしたブロックID（早期完了含む）
  uncompletedBlockIds?: Set<string>; // ユーザーが手動で未完了にしたブロックID（過去自動完了の解除含む）
  placementStrategy?: TaskPlacementStrategy; // 'balanced' (分散) | 'concentrated' (集中)
}

export interface SchedulingExecutionContext {
  fixedSlots: FixedSlot[];
  tasks: TaskItem[];
  schedulableTasks: TaskItem[];
  plans: TaskPlacementPlan[];
  weeklyPlans: TaskPlacementPlan[];
  dailyPlans: TaskPlacementPlan[];
  slotManager: SlotManager;
  dayBlocks: Record<number, TheoreticalBlock[]>;
  scheduledTaskMinutes: number;
  realtimeContext: SchedulingRealtimeContext;
  todayIdx: number;
  currMinutes: number;
  userCompletedIds: Set<string>;
  userUncompletedIds: Set<string>;

  // 共通のタスク配置ヘルパーメソッド
  tryPlaceContextInDay: (d: number, ctx: DayTaskContext, isWeekly: boolean) => boolean;
  sortDayTaskContexts: (contexts: DayTaskContext[]) => void;
}

export interface PlacementPhase {
  readonly name: string;
  execute(ctx: SchedulingExecutionContext): void;
}
