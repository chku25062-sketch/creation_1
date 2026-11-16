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
  isApplied: true,
  numRows: 6,
  numCols: 5,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜'],
  rowHeaders: ['1限', '2限', '3限', '4限', '5限', '6限'],
  axisConfig: {
    startTime: '09:00',
    periodMinutes: 90,
    intervalMinutes: 10,
    hasLunch: true,
    lunchAfterPeriod: 2,
    lunchMinutes: 50,
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
        text: '実践プログラミング 2',
        title: '実践プログラミング 2',
        roomOrNote: '',
        rawLines: ['実践プログラミング 2'],
        fullText: '実践プログラミング 2',
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
        text: '情報科学実習 4',
        title: '情報科学実習 4',
        roomOrNote: '',
        rawLines: ['情報科学実習 4'],
        fullText: '情報科学実習 4',
        startMinutes: 640,
        endMinutes: 730,
      },
    ],
    // 3限: 13:00〜14:30 (780〜870)
    [
      {
        dayIndex: 0,
        periodIndex: 3,
        text: '線形代数 2',
        title: '線形代数 2',
        roomOrNote: '',
        rawLines: ['線形代数 2'],
        fullText: '線形代数 2',
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
        text: '解析学 2',
        title: '解析学 2',
        roomOrNote: '',
        rawLines: ['解析学 2'],
        fullText: '解析学 2',
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
        text: 'ソフトウェアクリエイション 2',
        title: 'ソフトウェアクリエイション 2',
        roomOrNote: '',
        rawLines: ['ソフトウェアクリエイション 2'],
        fullText: 'ソフトウェアクリエイション 2',
        startMinutes: 880,
        endMinutes: 970,
      },
    ],
    // 5限: 16:20〜17:50 (980〜1070)
    [
      {
        dayIndex: 0,
        periodIndex: 5,
        text: 'ソフトウェアクリエーション１',
        title: 'ソフトウェアクリエーション１',
        roomOrNote: '',
        rawLines: ['ソフトウェアクリエーション１'],
        fullText: 'ソフトウェアクリエーション１',
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
        text: '英語 8',
        title: '英語 8',
        roomOrNote: '',
        rawLines: ['英語 8'],
        fullText: '英語 8',
        startMinutes: 980,
        endMinutes: 1070,
      },
      {
        dayIndex: 3,
        periodIndex: 5,
        text: '英語 6',
        title: '英語 6',
        roomOrNote: '',
        rawLines: ['英語 6'],
        fullText: '英語 6',
        startMinutes: 980,
        endMinutes: 1070,
      },
      {
        dayIndex: 4,
        periodIndex: 5,
        text: 'データ科学',
        title: 'データ科学',
        roomOrNote: '',
        rawLines: ['データ科学'],
        fullText: 'データ科学',
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

export const TABLE_SLEEP: ImportedTableData = {
  id: 'default-table-sleep',
  name: '睡眠',
  colorIndex: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'fixed',
  isApplied: true,
  numRows: 1,
  numCols: 7,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'],
  rowHeaders: ['睡眠'],
  axisConfig: {
    startTime: '00:00',
    periodMinutes: 480, // 8時間
    intervalMinutes: 0,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 0,
  },
  cells: [
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: '睡眠',
        title: '睡眠',
        roomOrNote: '',
        rawLines: ['睡眠'],
        fullText: '睡眠',
        startMinutes: 0,
        endMinutes: 480,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: '睡眠',
        title: '睡眠',
        roomOrNote: '',
        rawLines: ['睡眠'],
        fullText: '睡眠',
        startMinutes: 0,
        endMinutes: 480,
      },
      {
        dayIndex: 2,
        periodIndex: 1,
        text: '睡眠',
        title: '睡眠',
        roomOrNote: '',
        rawLines: ['睡眠'],
        fullText: '睡眠',
        startMinutes: 0,
        endMinutes: 480,
      },
      {
        dayIndex: 3,
        periodIndex: 1,
        text: '睡眠',
        title: '睡眠',
        roomOrNote: '',
        rawLines: ['睡眠'],
        fullText: '睡眠',
        startMinutes: 0,
        endMinutes: 480,
      },
      {
        dayIndex: 4,
        periodIndex: 1,
        text: '睡眠',
        title: '睡眠',
        roomOrNote: '',
        rawLines: ['睡眠'],
        fullText: '睡眠',
        startMinutes: 0,
        endMinutes: 480,
      },
      {
        dayIndex: 5,
        periodIndex: 1,
        text: '睡眠',
        title: '睡眠',
        roomOrNote: '',
        rawLines: ['睡眠'],
        fullText: '睡眠',
        startMinutes: 0,
        endMinutes: 480,
      },
      {
        dayIndex: 6,
        periodIndex: 1,
        text: '睡眠',
        title: '睡眠',
        roomOrNote: '',
        rawLines: ['睡眠'],
        fullText: '睡眠',
        startMinutes: 0,
        endMinutes: 480,
      },
    ],
  ],
};

export const TABLE_MEAL: ImportedTableData = {
  id: 'default-table-meal',
  name: '食事',
  colorIndex: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'fixed',
  isApplied: true,
  numRows: 3,
  numCols: 7,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'],
  rowHeaders: ['朝食', '昼食', '夕食'],
  axisConfig: {
    startTime: '07:30',
    periodMinutes: 30,
    intervalMinutes: 0,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 0,
    customRowTimes: {
      1: { startMinutes: 450, endMinutes: 480 }, // 07:30〜08:00 (30分)
      2: { startMinutes: 730, endMinutes: 780 }, // 12:10〜13:00 (50分)
      3: { startMinutes: 1140, endMinutes: 1200 }, // 19:00〜20:00 (60分)
    },
  },
  cells: [
    // 1行目: 朝食 (07:30〜08:00)
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: '朝食',
        title: '朝食',
        roomOrNote: '',
        rawLines: ['朝食'],
        fullText: '朝食',
        startMinutes: 450,
        endMinutes: 480,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: '朝食',
        title: '朝食',
        roomOrNote: '',
        rawLines: ['朝食'],
        fullText: '朝食',
        startMinutes: 450,
        endMinutes: 480,
      },
      {
        dayIndex: 2,
        periodIndex: 1,
        text: '朝食',
        title: '朝食',
        roomOrNote: '',
        rawLines: ['朝食'],
        fullText: '朝食',
        startMinutes: 450,
        endMinutes: 480,
      },
      {
        dayIndex: 3,
        periodIndex: 1,
        text: '朝食',
        title: '朝食',
        roomOrNote: '',
        rawLines: ['朝食'],
        fullText: '朝食',
        startMinutes: 450,
        endMinutes: 480,
      },
      {
        dayIndex: 4,
        periodIndex: 1,
        text: '朝食',
        title: '朝食',
        roomOrNote: '',
        rawLines: ['朝食'],
        fullText: '朝食',
        startMinutes: 450,
        endMinutes: 480,
      },
      {
        dayIndex: 5,
        periodIndex: 1,
        text: '朝食',
        title: '朝食',
        roomOrNote: '',
        rawLines: ['朝食'],
        fullText: '朝食',
        startMinutes: 450,
        endMinutes: 480,
      },
      {
        dayIndex: 6,
        periodIndex: 1,
        text: '朝食',
        title: '朝食',
        roomOrNote: '',
        rawLines: ['朝食'],
        fullText: '朝食',
        startMinutes: 450,
        endMinutes: 480,
      },
    ],
    // 2行目: 昼食 (12:10〜13:00)
    [
      {
        dayIndex: 0,
        periodIndex: 2,
        text: '昼食',
        title: '昼食',
        roomOrNote: '',
        rawLines: ['昼食'],
        fullText: '昼食',
        startMinutes: 730,
        endMinutes: 780,
      },
      {
        dayIndex: 1,
        periodIndex: 2,
        text: '昼食',
        title: '昼食',
        roomOrNote: '',
        rawLines: ['昼食'],
        fullText: '昼食',
        startMinutes: 730,
        endMinutes: 780,
      },
      {
        dayIndex: 2,
        periodIndex: 2,
        text: '昼食',
        title: '昼食',
        roomOrNote: '',
        rawLines: ['昼食'],
        fullText: '昼食',
        startMinutes: 730,
        endMinutes: 780,
      },
      {
        dayIndex: 3,
        periodIndex: 2,
        text: '昼食',
        title: '昼食',
        roomOrNote: '',
        rawLines: ['昼食'],
        fullText: '昼食',
        startMinutes: 730,
        endMinutes: 780,
      },
      {
        dayIndex: 4,
        periodIndex: 2,
        text: '昼食',
        title: '昼食',
        roomOrNote: '',
        rawLines: ['昼食'],
        fullText: '昼食',
        startMinutes: 730,
        endMinutes: 780,
      },
      {
        dayIndex: 5,
        periodIndex: 2,
        text: '昼食',
        title: '昼食',
        roomOrNote: '',
        rawLines: ['昼食'],
        fullText: '昼食',
        startMinutes: 730,
        endMinutes: 780,
      },
      {
        dayIndex: 6,
        periodIndex: 2,
        text: '昼食',
        title: '昼食',
        roomOrNote: '',
        rawLines: ['昼食'],
        fullText: '昼食',
        startMinutes: 730,
        endMinutes: 780,
      },
    ],
    // 3行目: 夕食 (19:00〜20:00)
    [
      {
        dayIndex: 0,
        periodIndex: 3,
        text: '夕食',
        title: '夕食',
        roomOrNote: '',
        rawLines: ['夕食'],
        fullText: '夕食',
        startMinutes: 1140,
        endMinutes: 1200,
      },
      {
        dayIndex: 1,
        periodIndex: 3,
        text: '夕食',
        title: '夕食',
        roomOrNote: '',
        rawLines: ['夕食'],
        fullText: '夕食',
        startMinutes: 1140,
        endMinutes: 1200,
      },
      {
        dayIndex: 2,
        periodIndex: 3,
        text: '夕食',
        title: '夕食',
        roomOrNote: '',
        rawLines: ['夕食'],
        fullText: '夕食',
        startMinutes: 1140,
        endMinutes: 1200,
      },
      {
        dayIndex: 3,
        periodIndex: 3,
        text: '夕食',
        title: '夕食',
        roomOrNote: '',
        rawLines: ['夕食'],
        fullText: '夕食',
        startMinutes: 1140,
        endMinutes: 1200,
      },
      {
        dayIndex: 4,
        periodIndex: 3,
        text: '夕食',
        title: '夕食',
        roomOrNote: '',
        rawLines: ['夕食'],
        fullText: '夕食',
        startMinutes: 1140,
        endMinutes: 1200,
      },
      {
        dayIndex: 5,
        periodIndex: 3,
        text: '夕食',
        title: '夕食',
        roomOrNote: '',
        rawLines: ['夕食'],
        fullText: '夕食',
        startMinutes: 1140,
        endMinutes: 1200,
      },
      {
        dayIndex: 6,
        periodIndex: 3,
        text: '夕食',
        title: '夕食',
        roomOrNote: '',
        rawLines: ['夕食'],
        fullText: '夕食',
        startMinutes: 1140,
        endMinutes: 1200,
      },
    ],
  ],
};

export const TABLE_WORKOUT: ImportedTableData = {
  id: 'default-table-workout',
  name: '筋トレ',
  colorIndex: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'auto',
  isApplied: true,
  numRows: 1,
  numCols: 7,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'],
  rowHeaders: ['筋トレ'],
  axisConfig: {
    startTime: null,
    endTime: '21:00',
    periodMinutes: 60,
    intervalMinutes: 10,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 0,
  },
  cells: [
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 0,
        endMinutes: 0,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: '筋トレ',
        title: '筋トレ',
        roomOrNote: '',
        rawLines: ['筋トレ'],
        fullText: '筋トレ',
        startMinutes: 0,
        endMinutes: 0,
      },
      {
        dayIndex: 2,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 0,
        endMinutes: 0,
      },
      {
        dayIndex: 3,
        periodIndex: 1,
        text: '筋トレ',
        title: '筋トレ',
        roomOrNote: '',
        rawLines: ['筋トレ'],
        fullText: '筋トレ',
        startMinutes: 0,
        endMinutes: 0,
      },
      {
        dayIndex: 4,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 0,
        endMinutes: 0,
      },
      {
        dayIndex: 5,
        periodIndex: 1,
        text: '筋トレ',
        title: '筋トレ',
        roomOrNote: '',
        rawLines: ['筋トレ'],
        fullText: '筋トレ',
        startMinutes: 0,
        endMinutes: 0,
      },
      {
        dayIndex: 6,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 0,
        endMinutes: 0,
      },
    ],
  ],
};

export const TABLE_ENGLISH: ImportedTableData = {
  id: 'default-table-english',
  name: '英語',
  colorIndex: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'fixed',
  isApplied: true,
  numRows: 1,
  numCols: 7,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'],
  rowHeaders: ['英語学習'],
  axisConfig: {
    startTime: '20:15',
    periodMinutes: 45,
    intervalMinutes: 10,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 0,
  },
  cells: [
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: '英語',
        title: '英語',
        roomOrNote: '',
        rawLines: ['英語'],
        fullText: '英語',
        startMinutes: 1215,
        endMinutes: 1260,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: '英語',
        title: '英語',
        roomOrNote: '',
        rawLines: ['英語'],
        fullText: '英語',
        startMinutes: 1215,
        endMinutes: 1260,
      },
      {
        dayIndex: 2,
        periodIndex: 1,
        text: '英語',
        title: '英語',
        roomOrNote: '',
        rawLines: ['英語'],
        fullText: '英語',
        startMinutes: 1215,
        endMinutes: 1260,
      },
      {
        dayIndex: 3,
        periodIndex: 1,
        text: '英語',
        title: '英語',
        roomOrNote: '',
        rawLines: ['英語'],
        fullText: '英語',
        startMinutes: 1215,
        endMinutes: 1260,
      },
      {
        dayIndex: 4,
        periodIndex: 1,
        text: '英語',
        title: '英語',
        roomOrNote: '',
        rawLines: ['英語'],
        fullText: '英語',
        startMinutes: 1215,
        endMinutes: 1260,
      },
      {
        dayIndex: 5,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 1215,
        endMinutes: 1260,
      },
      {
        dayIndex: 6,
        periodIndex: 1,
        text: null,
        title: '',
        roomOrNote: '',
        rawLines: [],
        fullText: '',
        startMinutes: 1215,
        endMinutes: 1260,
      },
    ],
  ],
};

export const TABLE_HOBBY: ImportedTableData = {
  id: 'default-table-hobby',
  name: '趣味',
  colorIndex: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  placementMode: 'fixed',
  isApplied: true,
  numRows: 1,
  numCols: 7,
  colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'],
  rowHeaders: ['趣味'],
  axisConfig: {
    startTime: '21:30',
    periodMinutes: 60,
    intervalMinutes: 10,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 0,
  },
  cells: [
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: '趣味',
        title: '趣味',
        roomOrNote: '',
        rawLines: ['趣味'],
        fullText: '趣味',
        startMinutes: 1290,
        endMinutes: 1350,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: '趣味',
        title: '趣味',
        roomOrNote: '',
        rawLines: ['趣味'],
        fullText: '趣味',
        startMinutes: 1290,
        endMinutes: 1350,
      },
      {
        dayIndex: 2,
        periodIndex: 1,
        text: '趣味',
        title: '趣味',
        roomOrNote: '',
        rawLines: ['趣味'],
        fullText: '趣味',
        startMinutes: 1290,
        endMinutes: 1350,
      },
      {
        dayIndex: 3,
        periodIndex: 1,
        text: '趣味',
        title: '趣味',
        roomOrNote: '',
        rawLines: ['趣味'],
        fullText: '趣味',
        startMinutes: 1290,
        endMinutes: 1350,
      },
      {
        dayIndex: 4,
        periodIndex: 1,
        text: '趣味',
        title: '趣味',
        roomOrNote: '',
        rawLines: ['趣味'],
        fullText: '趣味',
        startMinutes: 1290,
        endMinutes: 1350,
      },
      {
        dayIndex: 5,
        periodIndex: 1,
        text: '趣味',
        title: '趣味',
        roomOrNote: '',
        rawLines: ['趣味'],
        fullText: '趣味',
        startMinutes: 1290,
        endMinutes: 1350,
      },
      {
        dayIndex: 6,
        periodIndex: 1,
        text: '趣味',
        title: '趣味',
        roomOrNote: '',
        rawLines: ['趣味'],
        fullText: '趣味',
        startMinutes: 1290,
        endMinutes: 1350,
      },
    ],
  ],
};

export const INITIAL_IMPORTED_TABLES: ImportedTableData[] = [
  TABLE_CLASSES,
  TABLE_SLEEP,
  TABLE_MEAL,
  TABLE_WORKOUT,
  TABLE_ENGLISH,
  TABLE_HOBBY,
];

// 後方互換性用
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

      return {
        ...table,
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
