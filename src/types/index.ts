export type FixedCategory = 'sleep' | 'work' | 'lecture' | 'routine' | 'meal' | 'other';

export interface FixedSlot {
  id: string;
  title: string;
  category: FixedCategory | string;
  startMinutes: number; // 0 (00:00) 〜 1440 (24:00)
  endMinutes: number;
  color: string;
  daysOfWeek?: number[]; // 0:月, 1:火, 2:水, 3:木, 4:金, 5:土, 6:日。未指定または空なら全日
  breakMinutes?: number; // 固定枠後の休憩時間（分）
  sourceTableId?: string; // 参照元テーブルID
  sourceTableName?: string; // 参照元テーブル名
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
  category: TaskCategory | string;
  period: TaskPeriod;
  frequency?: TaskFrequency; // 'low' | 'medium' | 'high' | 'custom'
  frequencyCount?: number; // カスタム時の週あたり回数
  completed?: boolean;
  taskType?: TaskType; // 'task' | 'assignment' | 'todo'
  hasNoDuration?: boolean; // 所要時間を設けないタスク
  startDay?: number; // 課題用: 出題曜日 (0:月〜6:日)
  deadlineDay?: number; // 課題用: 締切・期日曜日 (0:月〜6:日)
  targetDays?: number[]; // 対象曜日一覧 (0:月〜6:日)。複数曜日の指定に対応
  cycleDays?: number[]; // 対象周期インデックス一覧 (0: Day 1, 1: Day 2, ...)。複数周期日の指定に対応
  dailyCount?: number; // 1日あたりの目標回数 (1, 2, 3...)
  dailyRepeatMode?: 'auto' | 'custom'; // 1日の中の繰り返し回数モード ('auto': 自動, 'custom': 回数指定)
  breakMinutes?: number; // タスク後の休憩時間（分）。0または未指定は休憩なし
  cycleIndex?: number; // 3日周期などのローテーション番号 (単一または代表値)
  cycleCount?: number; // 周期全体の長さ (例: 3日周期なら3)
  sourceTableId?: string; // 参照元テーブルID
  sourceTableName?: string; // 参照元テーブル名
}

export interface TheoreticalBlock {
  id: string;
  title: string;
  category: string;
  startMinutes: number;
  endMinutes: number;
  isFixed: boolean;
  isBreak?: boolean; // 休憩ブロックかどうか
  breakForTaskId?: string; // どのタスクに付随する休憩か
  color: string;
  taskId?: string;
  priority?: TaskPriority;
  taskType?: TaskType;
  deadlineDay?: number;
  dayIndex?: number; // 0:月〜6:日
  sourceTableId?: string; // 参照元テーブルID
  sourceTableName?: string; // 参照元テーブル名
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

export type TableClassification = 'fixed_slot' | 'daily_task' | 'weekly_task';

export interface AttachedTaskConfig {
  enabled: boolean;
  titleTemplate: string; // 例: "{title} の記録・プロテイン", "{title} の課題レポート"
  durationMinutes: number; // 例: 15
}

export interface GridCell {
  dayIndex: number; // 0:月, 1:火, 2:水, 3:木, 4:金, 5:土, 6:日
  periodIndex: number; // 1: 1行目, 2: 2行目, ...
  text: string | null; // セル内の単一要素テキスト (空コマはnull)
  rawLines: string[]; // 改行ごとのテキスト
  fullText: string; // 改行で結合されたセル内テキスト
  title: string; // 講義・タスク名（タイトル）
  roomOrNote: string; // 教室・場所・備考
  startMinutes: number;
  endMinutes: number;
  category?: string; // "lecture", "workout", "routine", "work", "hobby", "study" 等の自由カテゴリ
  breakMinutes?: number; // タスク後の休憩時間（分）
  attachedTask?: {
    enabled: boolean;
    title: string;
    durationMinutes: number;
  };
}

export interface TableAxisConfig {
  startTime: string | null; // "09:00" または null (未設定: アルゴリズム組み込み)
  periodMinutes: number | null; // 90 または null (未設定: アルゴリズムおまかせ伸縮)
  intervalMinutes: number | null; // 10 または null (未設定: アルゴリズムおまかせ)
  hasLunch: boolean; // true
  lunchAfterPeriod: number; // 2
  lunchMinutes: number; // 50
  customRowTimes?: Record<number, { startMinutes?: number; endMinutes?: number }>;
}

export type TableColumnMode = 'weekday' | 'cycle';

export interface ImportedTableData {
  id: string;
  name: string; // 例: "2026年度 前期時間割", "筋トレメニュー"
  createdAt: string; // ISO
  updatedAt: string; // ISO
  numRows: number;
  numCols: number;
  colHeaders: string[]; // 各列の曜日・ラベル (例: ["月曜", "火曜", "水曜", "木曜", "金曜"])
  rowHeaders: string[]; // 各行の番号・ラベル (例: ["1", "2", "3", "4", "5"])
  axisConfig: TableAxisConfig;
  cells: GridCell[][];
  attachedTaskConfig?: AttachedTaskConfig; // ツールバーで設定する表全体の付随タスク設定
  appliedSlotIds?: string[]; // 計画表に反映した際の固定枠ID群
  appliedTaskIds?: string[]; // 計画表に反映した際のタスクID群
  isApplied?: boolean; // 計画表に反映中かどうか
  classificationOverride?: TableClassification; // 手動で日・週・固定枠を明示上書きしたい場合の設定
  columnMode?: TableColumnMode; // 列の管理方式: 曜日で管理 ('weekday') または 周期で管理 ('cycle')
  dailyRepeatCount?: number | 'auto'; // 1日の中の繰り返し回数 (未指定または 'auto' は自動)
  colorIndex?: number; // 割り当てるカラーパレットの番号 (0〜11)
  customColor?: string; // 任意のカスタムカラーHEX (例: '#0284c7')
}

export interface ScheduleInclusionSettings {
  enableSlots: boolean; // 生活リズム枠 (固定枠)
  enableDailyTasks: boolean; // 日課タスク (毎日)
  enableWeeklyTasks: boolean; // 週次タスク (目標・課題)
}
