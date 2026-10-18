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

export interface GridCell {
  dayIndex: number; // 0:月, 1:火, 2:水, 3:木, 4:金, 5:土, 6:日
  periodIndex: number; // 1: 1限, 2: 2限, ...
  text: string | null; // セル内の単一要素テキスト (空コマはnull)
  rawLines: string[]; // 改行ごとのテキスト
  fullText: string; // 改行で結合されたセル内テキスト
  title: string; // 講義名（タイトル）
  roomOrNote: string; // 教室・備考
  startMinutes: number;
  endMinutes: number;
}

export interface TableAxisConfig {
  startTime: string; // "09:00"
  periodMinutes: number; // 90
  intervalMinutes: number; // 10
  hasLunch: boolean; // true
  lunchAfterPeriod: number; // 2
  lunchMinutes: number; // 50
  customRowTimes?: Record<number, { startMinutes: number; endMinutes: number }>;
}

export interface ImportedTableData {
  id: string;
  name: string; // 例: "2026年度 前期時間割"
  createdAt: string; // ISO
  updatedAt: string; // ISO
  numRows: number;
  numCols: number;
  colHeaders: string[]; // 各列の曜日・ラベル (例: ["月曜", "火曜", "水曜", "木曜", "金曜"])
  rowHeaders: string[]; // 各行の時限名 (例: ["1限", "2限", "3限", "4限", "5限"])
  axisConfig: TableAxisConfig;
  cells: GridCell[][];
  appliedSlotIds?: string[]; // 計画表に反映した際の固定枠ID群
  isApplied?: boolean; // 計画表に反映中かどうか
}

export interface ScheduleInclusionSettings {
  enableSlots: boolean; // 生活リズム枠 (固定枠)
  enableDailyTasks: boolean; // 日課タスク (毎日)
  enableWeeklyTasks: boolean; // 週次タスク (目標・課題)
}
