import { TaskItem, TheoreticalBlock, WeeklyTaskClassification, DailyTaskClassification } from '@/types';

/**
 * 週タスクの分類を判定
 * - 'last_week' (先週タスク): 先週の課題でまだ有効期限が来ていないもの
 * - 'active' (出題中タスク): 今週の課題で既に出題中のもの
 * - 'upcoming' (未出題タスク): 今週の課題でまだ出題されていないもの
 */
export function classifyWeeklyTask(task: TaskItem, todayIndex: number): WeeklyTaskClassification {
  if (task.weeklyClassification) {
    return task.weeklyClassification;
  }

  // 1. 先週タスクの判定
  if (task.taskOriginWeek === 'last' || task.isFromLastWeek) {
    return 'last_week';
  }

  // 課題で出題曜日 > 締切曜日（例: 木曜出題〜翌週火曜締切など、週跨ぎ課題）
  // 今週の前半（月〜火、todayIndex <= deadlineDay）にいる場合は先週出題分として有効期限内
  if (
    (task.taskType === 'assignment' || task.deadlineDay !== undefined) &&
    task.startDay !== undefined &&
    task.deadlineDay !== undefined &&
    task.startDay > task.deadlineDay &&
    todayIndex <= task.deadlineDay
  ) {
    return 'last_week';
  }

  // 2. 未出題タスクの判定: 今週の課題で出題曜日が現在曜日より未来
  if (task.startDay !== undefined && task.startDay > todayIndex) {
    return 'upcoming';
  }

  // 3. 出題中タスクの判定: 今週の課題ですでに出題中（startDay <= todayIndex、または曜日指定なし）
  return 'active';
}

/**
 * 週タスクブロックの分類を判定
 */
export function classifyWeeklyBlock(
  block: TheoreticalBlock,
  todayIndex: number,
  taskMap?: Map<string, TaskItem>,
): WeeklyTaskClassification {
  if (block.weeklyClassification) {
    return block.weeklyClassification;
  }

  if (block.taskOriginWeek === 'last' || block.isFromLastWeek) {
    return 'last_week';
  }

  if (block.taskId && taskMap) {
    const parentTask = taskMap.get(block.taskId);
    if (parentTask) {
      return classifyWeeklyTask(parentTask, todayIndex);
    }
  }

  // 締切と出題曜日による先週タスク判定
  if (
    block.deadlineDay !== undefined &&
    block.dayIndex !== undefined &&
    block.dayIndex <= block.deadlineDay
  ) {
    // 関連タスク等から週跨ぎ判定
    if (block.rescheduledFromDay !== undefined && block.rescheduledFromDay > block.deadlineDay) {
      return 'last_week';
    }
  }

  // 配置された曜日が今日より未来で、出題前タスクとして配置された場合
  // （通常未出題タスクは出題日以降に配置されるため、出題日以前の曜日のブロックは出題中）
  return 'active';
}

/**
 * 日タスクブロックの分類を判定
 * - 'yesterday' (前日分のタスク): 日付をまたいでいるタスク、前日から持ち越された未完了タスク
 * - 'today' (今日の分のタスク): 今日の日課・タスク
 */
export function classifyDailyBlock(
  block: TheoreticalBlock,
  todayIndex: number,
): DailyTaskClassification {
  if (block.dailyClassification) {
    return block.dailyClassification;
  }

  if (block.isYesterdayTask) {
    return 'yesterday';
  }

  // 前日以前から再スケジュールされたタスク
  if (block.rescheduledFromDay !== undefined && block.rescheduledFromDay < todayIndex) {
    return 'yesterday';
  }

  // 前日のブロック
  if (block.dayIndex !== undefined && block.dayIndex < todayIndex) {
    return 'yesterday';
  }

  return 'today';
}
