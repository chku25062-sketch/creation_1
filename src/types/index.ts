export type FixedCategory = 'sleep' | 'work' | 'routine' | 'meal' | 'other';

export interface FixedSlot {
  id: string;
  title: string;
  category: FixedCategory;
  startMinutes: number; // 0 (00:00) 〜 1440 (24:00)
  endMinutes: number;
  color: string;
}

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskCategory = 'study' | 'workout' | 'hobby' | 'work' | 'creative' | 'other';
export type TaskPeriod = 'day' | 'week' | 'month';

export interface TaskItem {
  id: string;
  title: string;
  durationMinutes: number; // 所要時間（分）
  priority: TaskPriority;
  category: TaskCategory;
  period: TaskPeriod;
  completed?: boolean;
}

export interface TheoreticalBlock {
  id: string;
  title: string;
  category: string;
  startMinutes: number;
  endMinutes: number;
  isFixed: boolean;
  color: string;
  taskId?: string;
  priority?: TaskPriority;
}

export interface FreeSlot {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

export interface ScheduleMetrics {
  totalDayMinutes: number; // 1440
  sleepMinutes: number;
  fixedMinutes: number;
  freeMinutes: number;
  scheduledTaskMinutes: number;
  unassignedTaskMinutes: number;
  theoreticalScore: number; // 0〜100 (%)
  assignedTaskCount: number;
  totalTaskCount: number;
}

export interface CategorySummary {
  name: string;
  category: string;
  minutes: number;
  percentage: number;
  color: string;
}
