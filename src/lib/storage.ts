import { FixedSlot, TaskItem, ScheduleInclusionSettings } from '@/types';
import { calculatePeriodTimes } from './timeUtils';
import { supabase, isSupabaseConfigured } from './supabase';

export const LOCAL_STORAGE_KEY_INCLUSION_SETTINGS = 'schedule_inclusion_settings';

export const INITIAL_FIXED_SLOTS: FixedSlot[] = [
  {
    id: 'fixed-sleep',
    title: '睡眠 (良質な8時間休養)',
    category: 'sleep',
    startMinutes: 23 * 60, // 23:00
    endMinutes: 7 * 60, // 07:00
    color: '#6366f1',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: 'fixed-morning',
    title: '朝のルーティン & 準備',
    category: 'routine',
    startMinutes: 7 * 60, // 07:00
    endMinutes: 8 * 60, // 08:00
    color: '#64748b',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: 'fixed-lecture-mw',
    title: '大学講義 (2限・3限)',
    category: 'lecture',
    startMinutes: 10 * 60 + 40, // 10:40
    endMinutes: 14 * 60 + 40, // 14:40
    color: '#0284c7',
    daysOfWeek: [0, 2], // 月・水
    sourceTableId: 'sample-table-1',
    sourceTableName: 'サンプル時間割 (前期)',
  },
  {
    id: 'fixed-lecture-tuth',
    title: '大学講義 (3限・4限)',
    category: 'lecture',
    startMinutes: 13 * 60, // 13:00
    endMinutes: 16 * 60 + 30, // 16:30
    color: '#0284c7',
    daysOfWeek: [1, 3], // 火・木
    sourceTableId: 'sample-table-1',
    sourceTableName: 'サンプル時間割 (前期)',
  },
  {
    id: 'fixed-dinner',
    title: '夕食 & リフレッシュ',
    category: 'meal',
    startMinutes: 19 * 60, // 19:00
    endMinutes: 20 * 60 + 30, // 20:30
    color: '#f59e0b',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-assignment-1',
    title: '大学講義 (2限・3限) レポート課題',
    taskType: 'assignment',
    startDay: 0, // 月曜出題 (授業日)
    deadlineDay: 6, // 日曜締切 (授業日前日)
    durationMinutes: 90,
    durationSize: 'medium',
    frequency: 'low',
    priority: 'high',
    category: 'must',
    period: 'week',
    sourceTableId: 'sample-table-1',
    sourceTableName: 'サンプル時間割 (前期)',
  },
  {
    id: 'task-study-daily',
    title: '基本情報・資格試験対策',
    taskType: 'task',
    durationMinutes: 60,
    durationSize: 'medium',
    frequency: 'high',
    priority: 'high',
    category: 'must',
    period: 'day',
  },
  {
    id: 'task-workout-daily',
    title: 'ランニング & ストレッチ',
    taskType: 'task',
    durationMinutes: 25,
    durationSize: 'small',
    frequency: 'high',
    priority: 'medium',
    category: 'want',
    period: 'day',
  },
  {
    id: 'task-creative-week',
    title: '個人プロダクト開発・実装',
    taskType: 'task',
    durationMinutes: 90,
    durationSize: 'medium',
    frequency: 'medium',
    priority: 'high',
    category: 'want',
    period: 'week',
  },
  {
    id: 'task-todo-syllabus',
    title: '履修登録・教科書購入',
    taskType: 'todo',
    hasNoDuration: true,
    durationMinutes: 0,
    durationSize: 'small',
    frequency: 'low',
    priority: 'medium',
    category: 'must',
    period: 'week',
  },
];

const LOCAL_STORAGE_KEY_FIXED = 'theoretical_planner_fixed_slots_v1';
const LOCAL_STORAGE_KEY_TASKS = 'theoretical_planner_tasks_v1';
const LOCAL_STORAGE_KEY_IMPORTED_TABLES = 'theoretical_planner_imported_tables_v1';

export function loadLocalData(): { fixedSlots: FixedSlot[]; tasks: TaskItem[] } {
  if (typeof window === 'undefined') {
    return { fixedSlots: INITIAL_FIXED_SLOTS, tasks: INITIAL_TASKS };
  }

  try {
    const rawFixed = localStorage.getItem(LOCAL_STORAGE_KEY_FIXED);
    const rawTasks = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);

    const fixedSlots: FixedSlot[] = rawFixed ? JSON.parse(rawFixed) : INITIAL_FIXED_SLOTS;
    const tasks: TaskItem[] = rawTasks ? JSON.parse(rawTasks) : INITIAL_TASKS;

    return { fixedSlots, tasks };
  } catch (err) {
    console.error('Failed to load data from localStorage', err);
    return { fixedSlots: INITIAL_FIXED_SLOTS, tasks: INITIAL_TASKS };
  }
}

export function saveLocalData(fixedSlots: FixedSlot[], tasks: TaskItem[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_FIXED, JSON.stringify(fixedSlots));
    localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save data to localStorage', err);
  }
}

import { ImportedTableData } from '@/types';

export const INITIAL_IMPORTED_TABLE: ImportedTableData = {
  id: 'sample-table-1',
  name: 'サンプル時間割 (前期)',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  numRows: 5,
  numCols: 5,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜'],
  rowHeaders: ['1限', '2限', '3限', '4限', '5限'],
  axisConfig: {
    startTime: '08:50',
    periodMinutes: 90,
    intervalMinutes: 10,
    hasLunch: true,
    lunchAfterPeriod: 2,
    lunchMinutes: 50,
  },
  cells: [
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: '線形代数学\n3号館301',
        rawLines: ['線形代数学', '3号館301'],
        fullText: '線形代数学\n3号館301',
        title: '線形代数学',
        roomOrNote: '3号館301',
        startMinutes: 530,
        endMinutes: 620,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 530,
        endMinutes: 620,
      },
      {
        dayIndex: 2,
        periodIndex: 1,
        text: '英語コミュニケーション\nLL教室',
        rawLines: ['英語コミュニケーション', 'LL教室'],
        fullText: '英語コミュニケーション\nLL教室',
        title: '英語コミュニケーション',
        roomOrNote: 'LL教室',
        startMinutes: 530,
        endMinutes: 620,
      },
      {
        dayIndex: 3,
        periodIndex: 1,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 530,
        endMinutes: 620,
      },
      {
        dayIndex: 4,
        periodIndex: 1,
        text: '微分積分学\n大講義室A',
        rawLines: ['微分積分学', '大講義室A'],
        fullText: '微分積分学\n大講義室A',
        title: '微分積分学',
        roomOrNote: '大講義室A',
        startMinutes: 530,
        endMinutes: 620,
      },
    ],
    [
      {
        dayIndex: 0,
        periodIndex: 2,
        text: '情報基礎理論\n電算室1',
        rawLines: ['情報基礎理論', '電算室1'],
        fullText: '情報基礎理論\n電算室1',
        title: '情報基礎理論',
        roomOrNote: '電算室1',
        startMinutes: 630,
        endMinutes: 720,
      },
      {
        dayIndex: 1,
        periodIndex: 2,
        text: '統計学入門\n5号館202',
        rawLines: ['統計学入門', '5号館202'],
        fullText: '統計学入門\n5号館202',
        title: '統計学入門',
        roomOrNote: '5号館202',
        startMinutes: 630,
        endMinutes: 720,
      },
      {
        dayIndex: 2,
        periodIndex: 2,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 630,
        endMinutes: 720,
      },
      {
        dayIndex: 3,
        periodIndex: 2,
        text: '物理学実験\n第2実験室',
        rawLines: ['物理学実験', '第2実験室'],
        fullText: '物理学実験\n第2実験室',
        title: '物理学実験',
        roomOrNote: '第2実験室',
        startMinutes: 630,
        endMinutes: 720,
      },
      {
        dayIndex: 4,
        periodIndex: 2,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 630,
        endMinutes: 720,
      },
    ],
    [
      {
        dayIndex: 0,
        periodIndex: 3,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 770,
        endMinutes: 860,
      },
      {
        dayIndex: 1,
        periodIndex: 3,
        text: 'アルゴリズムとデータ構造\n電算室2',
        rawLines: ['アルゴリズムとデータ構造', '電算室2'],
        fullText: 'アルゴリズムとデータ構造\n電算室2',
        title: 'アルゴリズムとデータ構造',
        roomOrNote: '電算室2',
        startMinutes: 770,
        endMinutes: 860,
      },
      {
        dayIndex: 2,
        periodIndex: 3,
        text: '科学技術倫理\n中講堂',
        rawLines: ['科学技術倫理', '中講堂'],
        fullText: '科学技術倫理\n中講堂',
        title: '科学技術倫理',
        roomOrNote: '中講堂',
        startMinutes: 770,
        endMinutes: 860,
      },
      {
        dayIndex: 3,
        periodIndex: 3,
        text: '物理学実験\n第2実験室',
        rawLines: ['物理学実験', '第2実験室'],
        fullText: '物理学実験\n第2実験室',
        title: '物理学実験',
        roomOrNote: '第2実験室',
        startMinutes: 770,
        endMinutes: 860,
      },
      {
        dayIndex: 4,
        periodIndex: 3,
        text: '経済学概論\n1号館101',
        rawLines: ['経済学概論', '1号館101'],
        fullText: '経済学概論\n1号館101',
        title: '経済学概論',
        roomOrNote: '1号館101',
        startMinutes: 770,
        endMinutes: 860,
      },
    ],
    [
      {
        dayIndex: 0,
        periodIndex: 4,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 870,
        endMinutes: 960,
      },
      {
        dayIndex: 1,
        periodIndex: 4,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 870,
        endMinutes: 960,
      },
      {
        dayIndex: 2,
        periodIndex: 4,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 870,
        endMinutes: 960,
      },
      {
        dayIndex: 3,
        periodIndex: 4,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 870,
        endMinutes: 960,
      },
      {
        dayIndex: 4,
        periodIndex: 4,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 870,
        endMinutes: 960,
      },
    ],
    [
      {
        dayIndex: 0,
        periodIndex: 5,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 970,
        endMinutes: 1060,
      },
      {
        dayIndex: 1,
        periodIndex: 5,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 970,
        endMinutes: 1060,
      },
      {
        dayIndex: 2,
        periodIndex: 5,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 970,
        endMinutes: 1060,
      },
      {
        dayIndex: 3,
        periodIndex: 5,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 970,
        endMinutes: 1060,
      },
      {
        dayIndex: 4,
        periodIndex: 5,
        text: null,
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 970,
        endMinutes: 1060,
      },
    ],
  ],
};

export function loadImportedTables(): ImportedTableData[] {
  if (typeof window === 'undefined') {
    return [INITIAL_IMPORTED_TABLE];
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_IMPORTED_TABLES);
    if (!raw) return [INITIAL_IMPORTED_TABLE];
    const parsed: ImportedTableData[] = JSON.parse(raw);
    return parsed.length > 0 ? parsed : [INITIAL_IMPORTED_TABLE];
  } catch (err) {
    console.error('Failed to load imported tables from localStorage', err);
    return [INITIAL_IMPORTED_TABLE];
  }
}

export function saveImportedTables(tables: ImportedTableData[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_IMPORTED_TABLES, JSON.stringify(tables));
  } catch (err) {
    console.error('Failed to save imported tables to localStorage', err);
  }
}

export const DEFAULT_INCLUSION_SETTINGS: ScheduleInclusionSettings = {
  enableSlots: true,
  enableDailyTasks: true,
  enableWeeklyTasks: true,
};

export function loadInclusionSettings(): ScheduleInclusionSettings {
  if (typeof window === 'undefined') return DEFAULT_INCLUSION_SETTINGS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_INCLUSION_SETTINGS);
    if (!raw) return DEFAULT_INCLUSION_SETTINGS;
    return { ...DEFAULT_INCLUSION_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to load inclusion settings from localStorage', err);
    return DEFAULT_INCLUSION_SETTINGS;
  }
}

export function saveInclusionSettings(settings: ScheduleInclusionSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_INCLUSION_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save inclusion settings to localStorage', err);
  }
}

/**
 * Supabaseへのクラウド保存（ログイン済みの場合）
 */
export async function syncWithSupabase(
  userId: string,
  fixedSlots: FixedSlot[],
  tasks: TaskItem[],
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const { error } = await supabase.from('user_schedules').upsert(
      {
        user_id: userId,
        fixed_slots: fixedSlots,
        tasks: tasks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
    return { success: false, error: errorMessage };
  }
}

/**
 * 時間割テーブルのコマから FixedSlot を生成
 */
export function generateSlotsForTable(table: ImportedTableData): FixedSlot[] {
  const tablePeriodTimes = calculatePeriodTimes(table.numRows, table.axisConfig);
  const slots: FixedSlot[] = [];

  table.cells.forEach((row, r) => {
    const timeSlot = tablePeriodTimes[r];
    if (!timeSlot) return;

    row.forEach((cell, c) => {
      const colHeader = table.colHeaders[c] || '';
      let dayIdx = cell.dayIndex;
      if (colHeader.includes('月')) dayIdx = 0;
      else if (colHeader.includes('火')) dayIdx = 1;
      else if (colHeader.includes('水')) dayIdx = 2;
      else if (colHeader.includes('木')) dayIdx = 3;
      else if (colHeader.includes('金')) dayIdx = 4;
      else if (colHeader.includes('土')) dayIdx = 5;
      else if (colHeader.includes('日')) dayIdx = 6;
      else if (colHeader === '除外') dayIdx = -1;

      if (dayIdx >= 0 && cell.title.trim()) {
        const slotId = `slot-table-${table.id}-${r}-${c}`;
        const fullTitle = cell.roomOrNote
          ? `${cell.title} (${cell.roomOrNote.replace(/\n/g, ' ')})`
          : cell.title;

        slots.push({
          id: slotId,
          title: fullTitle,
          category: 'lecture',
          startMinutes: timeSlot.startMinutes,
          endMinutes: timeSlot.endMinutes,
          color: '#0284c7', // 講義カラー
          daysOfWeek: [dayIdx],
          sourceTableId: table.id,
          sourceTableName: table.name,
        });
      }
    });
  });

  return slots;
}

/**
 * 時間割テーブルから自動課題タスクを生成
 */
export function generateAssignmentsForTable(table: ImportedTableData): TaskItem[] {
  const assignments: TaskItem[] = [];

  table.cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      const colHeader = table.colHeaders[c] || '';
      let dayIdx = cell.dayIndex;
      if (colHeader.includes('月')) dayIdx = 0;
      else if (colHeader.includes('火')) dayIdx = 1;
      else if (colHeader.includes('水')) dayIdx = 2;
      else if (colHeader.includes('木')) dayIdx = 3;
      else if (colHeader.includes('金')) dayIdx = 4;
      else if (colHeader.includes('土')) dayIdx = 5;
      else if (colHeader.includes('日')) dayIdx = 6;
      else if (colHeader === '除外') dayIdx = -1;

      if (dayIdx >= 0 && cell.title.trim()) {
        const deadlineDay = (dayIdx - 1 + 7) % 7;
        assignments.push({
          id: `task-assignment-${table.id}-${r}-${c}`,
          title: `${cell.title} レポート課題`,
          category: 'must',
          durationSize: 'medium',
          durationMinutes: 60,
          frequency: 'low',
          taskType: 'assignment',
          startDay: dayIdx,
          deadlineDay,
          priority: 'high',
          period: 'week',
          completed: false,
          sourceTableId: table.id,
          sourceTableName: table.name,
        });
      }
    });
  });

  return assignments;
}
