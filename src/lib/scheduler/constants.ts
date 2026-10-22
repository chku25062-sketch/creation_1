import { TaskItem } from '@/types';

export const CATEGORY_COLORS: Record<string, string> = {
  must: '#f59e0b', // Amber (やらなければいけないこと)
  want: '#2563eb', // Royal Blue (やりたいこと)
  sleep: '#6366f1', // Indigo
  work: '#0284c7', // Sky
  lecture: '#0369a1', // Deep Sky (大学講義・授業)
  routine: '#64748b', // Slate
  meal: '#ea580c', // Orange
  study: '#4f46e5', // Indigo
  workout: '#059669', // Emerald
  hobby: '#db2777', // Pink
  creative: '#7c3aed', // Purple
  other: '#64748b',
};

export const DYNAMIC_PALETTE = [
  '#0284c7', // Sky
  '#0d9488', // Teal
  '#059669', // Emerald
  '#7c3aed', // Purple
  '#c026d3', // Fuchsia
  '#ea580c', // Orange
  '#4f46e5', // Indigo
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#16a34a', // Green
];

export function getCategoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  if (!category) return '#2563eb';

  // 表名などの任意の文字列に対して、文字列ハッシュで一意のカラーを選択
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash << 5) - hash + category.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DYNAMIC_PALETTE.length;
  return DYNAMIC_PALETTE[index];
}

/**
 * 週タスクか日課タスクかを厳密に判定
 * - 日課タスク: period === 'day' または frequency === 'high'
 * - 週タスク: 課題 (assignment)、付随タスク、period === 'week'、または頻度が low / medium / custom
 */
export function isWeeklyTaskItem(task: TaskItem): boolean {
  if (task.period === 'day' || task.frequency === 'high') return false;
  if (task.taskType === 'assignment' || task.isAttachedTask) return true;
  if (task.period === 'week') return true;
  if (
    task.frequency === 'low' ||
    task.frequency === 'medium' ||
    task.frequency === 'custom'
  ) {
    return true;
  }
  return false;
}

/**
 * 所要時間（小・中・大）の自動調整: 空きスロットのサイズに合わせていい感じにフィット
 */
export function getAdjustedDuration(task: TaskItem, availableSlotDuration: number): number {
  if (task.isAttachedTask && task.durationMinutes && task.durationMinutes > 0) {
    return Math.min(task.durationMinutes, availableSlotDuration);
  }
  if (task.durationMinutes && task.durationMinutes > 0 && !task.durationSize) {
    return Math.min(task.durationMinutes, availableSlotDuration);
  }

  if (task.durationSize === 'small') {
    if (availableSlotDuration >= 15 && availableSlotDuration < 30) {
      return availableSlotDuration;
    }
    return Math.min(25, availableSlotDuration);
  }
  if (task.durationSize === 'medium') {
    if (availableSlotDuration >= 30 && availableSlotDuration < 60) {
      return availableSlotDuration;
    }
    return Math.min(60, availableSlotDuration);
  }
  if (task.durationSize === 'large') {
    return 120;
  }
  return task.durationMinutes > 0 ? task.durationMinutes : 30;
}

/**
 * 頻度に応じた週あたりの目標配置日数
 */
export function getTargetPlacementDays(task: TaskItem): number {
  if (task.period === 'day' || task.frequency === 'high') {
    return 7;
  }
  if (task.frequency === 'medium') {
    return 3;
  }
  if (task.frequency === 'low') {
    return 1;
  }
  if (task.frequency === 'custom' && task.frequencyCount) {
    return Math.min(7, Math.max(1, task.frequencyCount));
  }
  return 1;
}
