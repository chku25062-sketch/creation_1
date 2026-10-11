export type FixedCategory = 'sleep' | 'work' | 'lecture' | 'routine' | 'meal' | 'other';

export interface FixedSlot {
  id: string;
  title: string;
  category: FixedCategory;
  startMinutes: number; // 0 (00:00) 〜 1440 (24:00)
  endMinutes: number;
  color: string;
  daysOfWeek?: number[]; // 0:月, 1:火, 2:水, 3:木, 4:金, 5:土, 6:日。未指定または空なら全日
}

export type TaskType = 'task' | 'assignment' | 'todo';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskCategory =
  | 'must' // やらなければいけないこと (課題、日課、義務)
  | 'want' // やりたいこと (趣味、創作、スキルアップ、運動)
  | 'study'
  | 'workout'
  | 'hobby'
  | 'work'
  | 'creative'
  | 'other';

export type TaskDurationSize = 'small' | 'medium' | 'large'; // 小: 15〜30分未満, 中: 30分〜2時間未満, 大: 2時間以上
export type TaskFrequency = 'low' | 'medium' | 'high' | 'custom'; // 低: 週1〜2回, 中: 週3〜4回, 高: 週5回以上, カスタム
export type TaskPeriod = 'day' | 'week' | 'month';

export interface TaskItem {
  id: string;
  title: string;
  durationMinutes: number; // 所要時間（分）。ToDoの場合は0
  durationSize?: TaskDurationSize; // 'small' | 'medium' | 'large'
  priority: TaskPriority;
  category: TaskCategory;
  period: TaskPeriod;
  frequency?: TaskFrequency; // 'low' | 'medium' | 'high' | 'custom'
  frequencyCount?: number; // カスタム時の週あたり回数
  completed?: boolean;
  taskType?: TaskType; // 'task' | 'assignment' | 'todo'
  hasNoDuration?: boolean; // 所要時間を設けないタスク
  startDay?: number; // 課題用: 出題曜日 (0:月〜6:日)
  deadlineDay?: number; // 課題用: 締切・期日曜日 (0:月〜6:日)
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
  taskType?: TaskType;
  deadlineDay?: number;
  dayIndex?: number; // 0:月〜6:日
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

export interface WeeklySchedulingResult {
  dayBlocks: Record<number, TheoreticalBlock[]>; // 曜日 0〜6 ごとのブロック
  allBlocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
  metrics: ScheduleMetrics;
  categorySummaries: CategorySummary[];
}

export interface ParsedScheduleItem {
  id: string;
  title: string;
  type: 'fixed' | 'task';
  startMinutes?: number;
  endMinutes?: number;
  durationMinutes: number;
  category: string;
  priority?: TaskPriority;
  daysOfWeek?: number[];
  confidence?: number;
}
