import { FixedSlot, TaskItem, ScheduleInclusionSettings } from '@/types';
import { calculatePeriodTimes } from './timeUtils';
import { supabase, isSupabaseConfigured } from './supabase';

export const LOCAL_STORAGE_KEY_INCLUSION_SETTINGS = 'schedule_inclusion_settings';

// 初期固定枠・初期タスク: 古いデフォルトタスクは全廃し、空配列とする
export const INITIAL_FIXED_SLOTS: FixedSlot[] = [];
export const INITIAL_TASKS: TaskItem[] = [];

// 過去のローカルストレージデータに残っている旧デフォルトアイテムを自動クリーンアップするためのID一覧
export const LEGACY_DEFAULT_TASK_IDS = new Set([
  'task-attached-lecture',
  'task-study-daily',
  'task-workout-daily',
  'task-creative-week',
  'task-todo-syllabus',
]);

export const LEGACY_DEFAULT_SLOT_IDS = new Set([
  'fixed-sleep',
  'fixed-morning',
  'fixed-lecture-mw',
  'fixed-lecture-tuth',
  'fixed-dinner',
]);

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

    const fixedSlotsRaw: FixedSlot[] = rawFixed ? JSON.parse(rawFixed) : INITIAL_FIXED_SLOTS;
    const rawParsedTasks: TaskItem[] = rawTasks ? JSON.parse(rawTasks) : INITIAL_TASKS;

    // ★ 古いデフォルトタスクおよび旧サンプルテーブル由来のタスクを除去
    const filteredTasks = rawParsedTasks.filter((t) => {
      if (LEGACY_DEFAULT_TASK_IDS.has(t.id)) return false;
      if (t.sourceTableId === 'sample-table-1') return false;
      if (
        t.title === '基本情報・資格試験対策' ||
        t.title === 'ランニング & ストレッチ' ||
        t.title === '個人プロダクト開発・実装' ||
        t.title === '履修登録・教科書購入' ||
        t.title === '大学講義 (2限・3限) のタスク'
      ) {
        return false;
      }
      return true;
    });

    // ★ 古いデフォルト固定枠および旧サンプルテーブル由来のスロットを除去
    const fixedSlots = fixedSlotsRaw.filter((s) => {
      if (LEGACY_DEFAULT_SLOT_IDS.has(s.id)) return false;
      if (s.sourceTableId === 'sample-table-1') return false;
      if (
        s.title === '睡眠 (良質な8時間休養)' ||
        s.title === '朝のルーティン & 準備' ||
        s.title === '大学講義 (2限・3限)' ||
        s.title === '大学講義 (3限・4限)' ||
        s.title === '夕食 & リフレッシュ'
      ) {
        return false;
      }
      return true;
    });

    // ★ 付随タスク名称の自動マイグレーション:
    // 過去のローカルストレージデータにある「〇〇 の課題レポート」「〇〇 レポート課題」を「〇〇 のタスク」に自動正規化
    const tasks: TaskItem[] = filteredTasks.map((t) => {
      if (
        t.title.includes('の課題レポート') ||
        t.title.includes('レポート課題') ||
        (t.isAttachedTask && t.title.includes('レポート'))
      ) {
        const cleanedTitle = t.title
          .replace(' の課題レポート', ' のタスク')
          .replace(' レポート課題', ' のタスク')
          .replace(' の記録・確認', ' のタスク');
        return {
          ...t,
          title: cleanedTitle.endsWith(' のタスク')
            ? cleanedTitle
            : `${t.parentTitle || '講義'} のタスク`,
          taskType: 'task' as const,
          isAttachedTask: true,
          durationMinutes: t.durationMinutes && t.durationMinutes > 0 ? t.durationMinutes : 15,
          durationSize: undefined,
          deadlineDay: undefined,
          startDay: undefined,
        };
      }
      return t;
    });

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

// ========================================================
// デフォルトの6つの表（授業・睡眠・食事・筋トレ・英語・趣味）
// ========================================================

export const TABLE_CLASSES: ImportedTableData = {
  id: 'default-table-classes',
  name: '授業',
  colorIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'fixed',
  columnMode: 'weekday',
  cycleStartDay: 0,
  dailyRepeatCount: 'auto',
  weeklyRepeatCount: 'auto',
  weeklyTaskExpiryWeeks: 1,
  isApplied: true,
  numRows: 6,
  numCols: 5,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜'],
  rowHeaders: ['1限', '2限', '3限', '4限', '5限', '6限'],
  attachedTaskConfig: {
    enabled: true,
    titleTemplate: '{title} のタスク',
    durationMinutes: 90,
  },
  axisConfig: {
    startTime: '09:00',
    endTime: '19:30',
    periodMinutes: 90,
    intervalMinutes: 10,
    hasLunch: true,
    lunchAfterPeriod: 2,
    lunchMinutes: 50,
    weeklyTaskExpiryWeeks: 1,
  },
  cells: [
    // 1限: 09:00〜10:30 (540〜630)
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 540,
        endMinutes: 630,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: '1限 (講義・業務A)',
        title: '1限 (講義・業務A)',
        roomOrNote: '',
        rawLines: ['1限 (講義・業務A)'],
        fullText: '1限 (講義・業務A)',
        startMinutes: 540,
        endMinutes: 630,
      },
      {
        dayIndex: 2,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 540,
        endMinutes: 630,
      },
      {
        dayIndex: 3,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 540,
        endMinutes: 630,
      },
      {
        dayIndex: 4,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 540,
        endMinutes: 630,
      },
    ],
    // 2限: 10:40〜12:10 (640〜730)
    [
      {
        dayIndex: 0,
        periodIndex: 2,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 640,
        endMinutes: 730,
      },
      {
        dayIndex: 1,
        periodIndex: 2,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 640,
        endMinutes: 730,
      },
      {
        dayIndex: 2,
        periodIndex: 2,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 640,
        endMinutes: 730,
      },
      {
        dayIndex: 3,
        periodIndex: 2,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 640,
        endMinutes: 730,
      },
      {
        dayIndex: 4,
        periodIndex: 2,
        text: '2限 (講義・業務B)',
        title: '2限 (講義・業務B)',
        roomOrNote: '',
        rawLines: ['2限 (講義・業務B)'],
        fullText: '2限 (講義・業務B)',
        startMinutes: 640,
        endMinutes: 730,
      },
    ],
    // 3限: 13:00〜14:30 (780〜870)
    [
      {
        dayIndex: 0,
        periodIndex: 3,
        text: '3限 (講義・業務C)',
        title: '3限 (講義・業務C)',
        roomOrNote: '',
        rawLines: ['3限 (講義・業務C)'],
        fullText: '3限 (講義・業務C)',
        startMinutes: 780,
        endMinutes: 870,
      },
      {
        dayIndex: 1,
        periodIndex: 3,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 780,
        endMinutes: 870,
      },
      {
        dayIndex: 2,
        periodIndex: 3,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 780,
        endMinutes: 870,
      },
      {
        dayIndex: 3,
        periodIndex: 3,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 780,
        endMinutes: 870,
      },
      {
        dayIndex: 4,
        periodIndex: 3,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 780,
        endMinutes: 870,
      },
    ],
    // 4限: 14:40〜16:10 (880〜970)
    [
      {
        dayIndex: 0,
        periodIndex: 4,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 880,
        endMinutes: 970,
      },
      {
        dayIndex: 1,
        periodIndex: 4,
        text: '4限 (講義・業務D)',
        title: '4限 (講義・業務D)',
        roomOrNote: '',
        rawLines: ['4限 (講義・業務D)'],
        fullText: '4限 (講義・業務D)',
        startMinutes: 880,
        endMinutes: 970,
      },
      {
        dayIndex: 2,
        periodIndex: 4,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 880,
        endMinutes: 970,
      },
      {
        dayIndex: 3,
        periodIndex: 4,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 880,
        endMinutes: 970,
      },
      {
        dayIndex: 4,
        periodIndex: 4,
        text: '4限 (講義・業務E)',
        title: '4限 (講義・業務E)',
        roomOrNote: '',
        rawLines: ['4限 (講義・業務E)'],
        fullText: '4限 (講義・業務E)',
        startMinutes: 880,
        endMinutes: 970,
      },
    ],
    // 5限: 16:20〜17:50 (980〜1070)
    [
      {
        dayIndex: 0,
        periodIndex: 5,
        text: '5限 (講義・業務F)',
        title: '5限 (講義・業務F)',
        roomOrNote: '',
        rawLines: ['5限 (講義・業務F)'],
        fullText: '5限 (講義・業務F)',
        startMinutes: 980,
        endMinutes: 1070,
      },
      {
        dayIndex: 1,
        periodIndex: 5,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 980,
        endMinutes: 1070,
      },
      {
        dayIndex: 2,
        periodIndex: 5,
        text: '5限 (講義・業務G)',
        title: '5限 (講義・業務G)',
        roomOrNote: '',
        rawLines: ['5限 (講義・業務G)'],
        fullText: '5限 (講義・業務G)',
        startMinutes: 980,
        endMinutes: 1070,
      },
      {
        dayIndex: 3,
        periodIndex: 5,
        text: '5限 (講義・業務H)',
        title: '5限 (講義・業務H)',
        roomOrNote: '',
        rawLines: ['5限 (講義・業務H)'],
        fullText: '5限 (講義・業務H)',
        startMinutes: 980,
        endMinutes: 1070,
      },
      {
        dayIndex: 4,
        periodIndex: 5,
        text: '5限 (講義・業務I)',
        title: '5限 (講義・業務I)',
        roomOrNote: '',
        rawLines: ['5限 (講義・業務I)'],
        fullText: '5限 (講義・業務I)',
        startMinutes: 980,
        endMinutes: 1070,
      },
    ],
    // 6限: 18:00〜19:30 (1080〜1170)
    [
      {
        dayIndex: 0,
        periodIndex: 6,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 1080,
        endMinutes: 1170,
      },
      {
        dayIndex: 1,
        periodIndex: 6,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 1080,
        endMinutes: 1170,
      },
      {
        dayIndex: 2,
        periodIndex: 6,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 1080,
        endMinutes: 1170,
      },
      {
        dayIndex: 3,
        periodIndex: 6,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 1080,
        endMinutes: 1170,
      },
      {
        dayIndex: 4,
        periodIndex: 6,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 1080,
        endMinutes: 1170,
      },
    ],
  ],
};

export const TABLE_LIFESTYLE: ImportedTableData = {
  id: 'default-table-lifestyle',
  name: '生活',
  colorIndex: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'fixed',
  columnMode: 'weekday',
  cycleStartDay: 0,
  dailyRepeatCount: 'auto',
  weeklyRepeatCount: 'auto',
  weeklyTaskExpiryWeeks: 1,
  isApplied: true,
  numRows: 4,
  numCols: 7,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'],
  rowHeaders: ['朝食', '昼食', '夕食', '睡眠'],
  axisConfig: {
    startTime: '08:00',
    endTime: '24:00',
    periodMinutes: 30,
    intervalMinutes: 0,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 50,
    weeklyTaskExpiryWeeks: 1,
    customRowTimes: {
      1: { startMinutes: 480, endMinutes: 510 }, // 朝食: 08:00〜08:30 (30分)
      2: { startMinutes: 730, endMinutes: 780 }, // 昼食: 12:10〜13:00 (50分)
      3: { startMinutes: 1170, endMinutes: 1230 }, // 夕食: 19:30〜20:30 (60分)
      4: { startMinutes: 0, endMinutes: 480 }, // 睡眠: 00:00〜08:00 (480分)
    },
  },
  cells: [
    // 1行目: 朝食 (08:00〜08:30)
    Array.from({ length: 7 }, (_, dayIndex) => ({
      dayIndex,
      periodIndex: 1,
      text: '朝食',
      title: '朝食',
      roomOrNote: '',
      rawLines: ['朝食'],
      fullText: '朝食',
      startMinutes: 480,
      endMinutes: 510,
    })),
    // 2行目: 昼食 (12:10〜13:00)
    Array.from({ length: 7 }, (_, dayIndex) => ({
      dayIndex,
      periodIndex: 2,
      text: '昼食',
      title: '昼食',
      roomOrNote: '',
      rawLines: ['昼食'],
      fullText: '昼食',
      startMinutes: 730,
      endMinutes: 780,
    })),
    // 3行目: 夕食 (19:30〜20:30)
    Array.from({ length: 7 }, (_, dayIndex) => ({
      dayIndex,
      periodIndex: 3,
      text: '夕食',
      title: '夕食',
      roomOrNote: '',
      rawLines: ['夕食'],
      fullText: '夕食',
      startMinutes: 1170,
      endMinutes: 1230,
    })),
    // 4行目: 睡眠 (00:00〜08:00)
    Array.from({ length: 7 }, (_, dayIndex) => ({
      dayIndex,
      periodIndex: 4,
      text: '睡眠',
      title: '睡眠',
      roomOrNote: '',
      rawLines: ['睡眠'],
      fullText: '睡眠',
      startMinutes: 0,
      endMinutes: 480,
    })),
  ],
};



// ========================================================
// 3. 日課（2日周期ローテーション・習慣タスクの柔軟自動配分）
// ========================================================
export const TABLE_ROUTINE: ImportedTableData = {
  id: 'default-table-routine',
  name: '日課',
  colorIndex: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'auto',
  columnMode: 'cycle', // 2日周期ローテーション
  cycleStartDay: 0,
  dailyRepeatCount: 'auto',
  weeklyRepeatCount: 'auto',
  weeklyTaskExpiryWeeks: 1,
  isApplied: true,
  numRows: 3,
  numCols: 2,
  colHeaders: ['Day 1', 'Day 2'],
  rowHeaders: ['日課A', '日課B', '日課C'],
  axisConfig: {
    startTime: null,
    endTime: null,
    periodMinutes: 20,
    intervalMinutes: 0,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 50,
    weeklyTaskExpiryWeeks: 1,
  },
  cells: [
    // 1行目: 筋トレ・運動系 (20分)
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: '日課A (筋トレ・運動)',
        title: '日課A (筋トレ・運動)',
        roomOrNote: '',
        rawLines: ['日課A (筋トレ・運動)'],
        fullText: '日課A (筋トレ・運動)',
        startMinutes: 0,
        endMinutes: 0,
        customDurationMinutes: 20,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: '日課D (ストレッチ・休養)',
        title: '日課D (ストレッチ・休養)',
        roomOrNote: '',
        rawLines: ['日課D (ストレッチ・休養)'],
        fullText: '日課D (ストレッチ・休養)',
        startMinutes: 0,
        endMinutes: 0,
        customDurationMinutes: 20,
      },
    ],
    // 2行目: 学習・教養系 (20分)
    [
      {
        dayIndex: 0,
        periodIndex: 2,
        text: '日課B (英語・学習)',
        title: '日課B (英語・学習)',
        roomOrNote: '',
        rawLines: ['日課B (英語・学習)'],
        fullText: '日課B (英語・学習)',
        startMinutes: 0,
        endMinutes: 0,
        customDurationMinutes: 20,
      },
      {
        dayIndex: 1,
        periodIndex: 2,
        text: '日課E (読書・教養)',
        title: '日課E (読書・教養)',
        roomOrNote: '',
        rawLines: ['日課E (読書・教養)'],
        fullText: '日課E (読書・教養)',
        startMinutes: 0,
        endMinutes: 0,
        customDurationMinutes: 20,
      },
    ],
    // 3行目: 生活改善・整理系 (15分)
    [
      {
        dayIndex: 0,
        periodIndex: 3,
        text: '日課C (片付け・整理)',
        title: '日課C (片付け・整理)',
        roomOrNote: '',
        rawLines: ['日課C (片付け・整理)'],
        fullText: '日課C (片付け・整理)',
        startMinutes: 0,
        endMinutes: 0,
        customDurationMinutes: 15,
      },
      {
        dayIndex: 1,
        periodIndex: 3,
        text: '日課F (日記・振り返り)',
        title: '日課F (日記・振り返り)',
        roomOrNote: '',
        rawLines: ['日課F (日記・振り返り)'],
        fullText: '日課F (日記・振り返り)',
        startMinutes: 0,
        endMinutes: 0,
        customDurationMinutes: 15,
      },
    ],
  ],
};



// ========================================================
// 4. 趣味（1日周期・1日1回の自由時間・自動配分）
// ========================================================
export const TABLE_HOBBY: ImportedTableData = {
  id: 'default-table-hobby',
  name: '趣味',
  colorIndex: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'auto',
  columnMode: 'cycle', // 1日周期
  cycleStartDay: 0,
  dailyRepeatCount: 1, // ユーザー指定: 1日1回の繰り返し
  weeklyRepeatCount: 'auto',
  weeklyTaskExpiryWeeks: 1,
  isApplied: true,
  numRows: 1,
  numCols: 1,
  colHeaders: ['Day 1'],
  rowHeaders: ['趣味'],
  axisConfig: {
    startTime: null,
    endTime: null,
    periodMinutes: 60,
    intervalMinutes: 0,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 50,
    weeklyTaskExpiryWeeks: 1,
  },
  cells: [
    // 1行目: 自由時間・趣味 (60分)
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: '自由時間・趣味',
        title: '自由時間・趣味',
        roomOrNote: '',
        rawLines: ['自由時間・趣味'],
        fullText: '自由時間・趣味',
        startMinutes: 0,
        endMinutes: 0,
        customDurationMinutes: 60,
      },
    ],
  ],
};

export const INITIAL_IMPORTED_TABLES: ImportedTableData[] = [
  TABLE_CLASSES,
  TABLE_LIFESTYLE,
  TABLE_ROUTINE,
  TABLE_HOBBY,
];

// 後方互換性用エイリアス
export const TABLE_SLEEP: ImportedTableData = TABLE_LIFESTYLE;
export const TABLE_MEAL: ImportedTableData = TABLE_LIFESTYLE;
export const TABLE_WORKOUT: ImportedTableData = TABLE_ROUTINE;
export const TABLE_ENGLISH: ImportedTableData = TABLE_ROUTINE;
export const INITIAL_IMPORTED_TABLE: ImportedTableData = TABLE_CLASSES;

export function loadImportedTables(): ImportedTableData[] {
  if (typeof window === 'undefined') {
    return INITIAL_IMPORTED_TABLES;
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_IMPORTED_TABLES);
    if (!raw) return INITIAL_IMPORTED_TABLES;
    const parsed: ImportedTableData[] = JSON.parse(raw);

    // 旧バージョンの単一サンプルテーブル (sample-table-1) のみの場合は新デフォルトに差し替え
    if (parsed.length === 0 || (parsed.length === 1 && parsed[0].id === 'sample-table-1')) {
      saveImportedTables(INITIAL_IMPORTED_TABLES);
      return INITIAL_IMPORTED_TABLES;
    }

    const migratedTables = parsed.map((table) => {
      // 表全体の付随タスク設定の正規化
      let attachedConfig = table.attachedTaskConfig;
      if (attachedConfig) {
        if (
          !attachedConfig.titleTemplate ||
          attachedConfig.titleTemplate.includes('課題レポート') ||
          attachedConfig.titleTemplate.includes('記録') ||
          attachedConfig.titleTemplate.includes('準備') ||
          attachedConfig.titleTemplate.includes('確認')
        ) {
          attachedConfig = {
            ...attachedConfig,
            titleTemplate: '{title} のタスク',
          };
        }
      }

      // 各セルの付随タスク設定の正規化
      const cells = table.cells.map((row) =>
        row.map((cell) => {
          if (cell.attachedTask) {
            let title = cell.attachedTask.title;
            if (
              !title ||
              title.includes('課題レポート') ||
              title.includes('記録') ||
              title.includes('準備') ||
              title.includes('確認')
            ) {
              title = '{title} のタスク';
            }
            return {
              ...cell,
              attachedTask: {
                ...cell.attachedTask,
                title,
              },
            };
          }
          return cell;
        }),
      );

      // axisConfig の設定値の正規化 (UIで通常設定可能な範囲に適合)
      const defaultTableMatch = INITIAL_IMPORTED_TABLES.find((it) => it.id === table.id);
      const axisConfig = {
        ...table.axisConfig,
        endTime:
          table.axisConfig?.endTime !== undefined
            ? table.axisConfig.endTime
            : defaultTableMatch?.axisConfig.endTime ?? null,
        lunchMinutes:
          table.axisConfig?.lunchMinutes !== undefined && table.axisConfig.lunchMinutes > 0
            ? table.axisConfig.lunchMinutes
            : 50,
        lunchAfterPeriod:
          table.axisConfig?.lunchAfterPeriod !== undefined && table.axisConfig.lunchAfterPeriod >= 1
            ? table.axisConfig.lunchAfterPeriod
            : 1,
        weeklyTaskExpiryWeeks:
          table.axisConfig?.weeklyTaskExpiryWeeks !== undefined
            ? table.axisConfig.weeklyTaskExpiryWeeks
            : 1,
      };

      return {
        ...table,
        placementMode: table.placementMode || defaultTableMatch?.placementMode || 'fixed',
        columnMode: table.columnMode || (table.colHeaders.some((h) => h.startsWith('Day ')) ? 'cycle' : 'weekday'),
        cycleStartDay: table.cycleStartDay !== undefined ? table.cycleStartDay : 0,
        dailyRepeatCount: table.dailyRepeatCount !== undefined ? table.dailyRepeatCount : 'auto',
        weeklyRepeatCount: table.weeklyRepeatCount !== undefined ? table.weeklyRepeatCount : 'auto',
        weeklyTaskExpiryWeeks:
          table.weeklyTaskExpiryWeeks !== undefined ? table.weeklyTaskExpiryWeeks : 1,
        axisConfig,
        attachedTaskConfig: attachedConfig,
        cells,
      };
    });

    return migratedTables.length > 0 ? migratedTables : INITIAL_IMPORTED_TABLES;
  } catch (err) {
    console.error('Failed to load imported tables from localStorage', err);
    return INITIAL_IMPORTED_TABLES;
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
  // 開始時刻未設定のテーブルは固定枠（時間帯枠）ではないためスロットを生成しない
  if (!table.axisConfig.startTime || table.axisConfig.startTime === 'unset') {
    return [];
  }

  const tablePeriodTimes = calculatePeriodTimes(table.numRows, table.axisConfig);
  const slots: FixedSlot[] = [];

  table.cells.forEach((row, r) => {
    const timeSlot = tablePeriodTimes[r];
    if (!timeSlot || (timeSlot.startMinutes === 0 && timeSlot.endMinutes === 0)) return;

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
          category: table.name || 'lecture',
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
