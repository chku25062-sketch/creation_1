import { TaskItem, TheoreticalBlock, WeeklyTaskClassification, DailyTaskClassification } from '@/types';
import { timeStringToMinutes } from '../timeUtils';

/**
 * タスクの付随元（本タスク・講義等）の終了時刻（分: 0〜1440）を取得
 */
export function getParentEndTimeForDay(task: TaskItem, dayIndex: number): number | undefined {
  if (task.parentEndMinutesByDay && task.parentEndMinutesByDay[dayIndex] !== undefined) {
    return task.parentEndMinutesByDay[dayIndex];
  }
  if (task.scheduleAfterDay === undefined || task.scheduleAfterDay === dayIndex) {
    if (task.scheduleAfterTime !== undefined) {
      return typeof task.scheduleAfterTime === 'string'
        ? timeStringToMinutes(task.scheduleAfterTime)
        : task.scheduleAfterTime;
    }
  }
  if (task.earliestStartTime !== undefined && task.earliestStartTime > 0) {
    return task.earliestStartTime;
  }
  return undefined;
}

/**
 * タスクの出題曜日を取得
 */
export function getTaskStartDay(task: TaskItem): number | undefined {
  if (task.startDay !== undefined) return task.startDay;
  if (task.scheduleAfterDay !== undefined) return task.scheduleAfterDay;
  if (task.parentEndMinutesByDay && Object.keys(task.parentEndMinutesByDay).length > 0) {
    const days = Object.keys(task.parentEndMinutesByDay).map(Number).sort((a, b) => a - b);
    return days[0];
  }
  if (task.targetDays && task.targetDays.length > 0) {
    return task.targetDays[0];
  }
  return undefined;
}

/**
 * 週タスクの分類を判定
 * - 'last_week' (先週タスク): 先週の課題でまだ有効期限が来ていないもの
 * - 'active' (出題中タスク): 今週の課題で現在時刻が付随元のタスクの時間を超えているもの
 * - 'upcoming' (未出題タスク): 今週の課題でまだ出題されていないもの（未来曜日、または現在時刻が付随元のタスクの時間に達していないもの）
 */
export function classifyWeeklyTask(
  task: TaskItem,
  todayIndex: number,
  currentMinutes?: number,
): WeeklyTaskClassification {
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

  const effectiveStartDay = getTaskStartDay(task);

  // 2. 出題曜日が未来の場合 -> 未出題タスク
  if (effectiveStartDay !== undefined && effectiveStartDay > todayIndex) {
    return 'upcoming';
  }

  // 3. 出題曜日が今日の場合（または曜日未定で今日出題される場合）
  if (effectiveStartDay === undefined || effectiveStartDay === todayIndex) {
    const parentEndTime = getParentEndTimeForDay(task, todayIndex);

    // ★ ユーザー定義: 出題中の定義は「現在時刻が付随元のタスクの時間を超えているもの」
    if (parentEndTime !== undefined && currentMinutes !== undefined) {
      if (currentMinutes < parentEndTime) {
        // まだ付随元のタスクの時間を超えていない（講義前・講義中など）-> 未出題タスク！
        return 'upcoming';
      }
    }
  }

  // 4. 上記以外（過去曜日出題、または現在時刻が付随元のタスクの時間を超えている）-> 出題中タスク！
  return 'active';
}

/**
 * 週タスクブロックの分類を判定
 */
export function classifyWeeklyBlock(
  block: TheoreticalBlock,
  todayIndex: number,
  taskMap?: Map<string, TaskItem>,
  currentMinutes?: number,
): WeeklyTaskClassification {
  // 1. 先週タスクの判定を最優先（ブロック自身のフラグ、または大元タスクの先週フラグ）
  // ★ ユーザー指示: 先週の分のタスクが未完了状態のまま持ち越されている奴は先週分のタスクに入れる！
  if (block.taskOriginWeek === 'last' || block.isFromLastWeek) {
    return 'last_week';
  }

  const parentTask = block.taskId && taskMap ? taskMap.get(block.taskId) : undefined;
  if (parentTask) {
    if (parentTask.taskOriginWeek === 'last' || parentTask.isFromLastWeek) {
      return 'last_week';
    }
  }

  // 再配置ブロック（isRescheduled）で、先週から未完了のまま持ち越されたもの
  if (block.isRescheduled) {
    if (parentTask && (parentTask.taskOriginWeek === 'last' || parentTask.isFromLastWeek)) {
      return 'last_week';
    }
    // 再配置元の曜日が出題曜日や締切曜日より後（週跨ぎで未完了持ち越し）
    if (
      block.rescheduledFromDay !== undefined &&
      block.deadlineDay !== undefined &&
      block.rescheduledFromDay > block.deadlineDay
    ) {
      return 'last_week';
    }
  }

  // 締切と出題曜日による先週タスク判定（木曜出題〜翌週火曜締切など）
  if (
    block.deadlineDay !== undefined &&
    block.dayIndex !== undefined &&
    block.dayIndex <= block.deadlineDay
  ) {
    const startDay = parentTask?.startDay;
    if (startDay !== undefined && startDay > block.deadlineDay) {
      return 'last_week';
    }
    if (block.rescheduledFromDay !== undefined && block.rescheduledFromDay > block.deadlineDay) {
      return 'last_week';
    }
  }

  if (block.weeklyClassification) {
    return block.weeklyClassification;
  }

  if (parentTask) {
    return classifyWeeklyTask(parentTask, todayIndex, currentMinutes);
  }

  // 当日のブロックで、もし付随元タスクがあり開始前なら未出題
  if (block.dayIndex !== undefined && block.dayIndex > todayIndex) {
    // 未来曜日のブロック
    return 'upcoming';
  }

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
