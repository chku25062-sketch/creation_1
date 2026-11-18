import { GridCell, ImportedTableData } from '@/types';
import { timeStringToMinutes } from '../timeUtils';

// ========================================================
// テンプレート入力型定義
// ========================================================

export interface DailyMenuItem {
  title: string;
  durationMinutes?: number; // 未指定時はデフォルト所要時間を適用
}

export interface DailyRoutineTemplateInput {
  name: string; // 表の表示名（例:「朝の筋トレ」「英語学習」）
  mode: 'single' | 'weekday_rotation' | 'cycle_rotation';

  // 単一メニューの場合（毎日・特定曜日に同じタスク）
  singleTask?: {
    title: string;
    durationMinutes: number;
    isEveryday?: boolean; // true の場合は1行1列の最小表を生成
    targetDays?: number[]; // 曜日指定時（0:月〜6:日）
  };

  // 曜日別ローテーションの場合（月〜日でメニューを変える）
  weekdayRotation?: {
    days: Record<number, DailyMenuItem | null>; // 0:月〜6:日
    defaultDurationMinutes?: number;
  };

  // N日サイクルローテーションの場合（Day 1..N を巡回する）
  cycleRotation?: {
    cycleLength: number; // 周期日数（例: 3, 4）
    items: (DailyMenuItem | null)[]; // 各Dayのメニュー（Day 1 〜 Day N）
    cycleStartDay?: number; // 周期の開始曜日（0:月〜6:日、デフォルト0）
    defaultDurationMinutes?: number;
  };

  dailyRepeatCount?: number | 'auto';
  timeRange?: { startTime: string | null; endTime: string | null };
}

export interface WeeklyTaskTemplateInput {
  title: string;
  durationMinutes: number;
  weeklyTargetCount: number | 'auto';
  expiryWeeks: 1 | 2 | 'none';
  timeRange?: { startTime: string | null; endTime: string | null };

  // 開始日時（出題日時）の指定オプション
  startConstraint?: {
    enabled: boolean;
    startDay: number; // 0:月〜6:日
    scheduleAfterTime?: string; // 例: "14:30"
  };

  // 配置希望曜日（未指定時は空き枠おまかせ）
  preferredDays?: number[]; // 例: [0, 2, 4] (月, 水, 金)
}

export interface FixedSlotTemplateInput {
  title: string;
  startTime: string;
  endTime: string;
  targetDays: number[]; // 0:月〜6:日
}

const WEEKDAY_HEADERS = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];

// ========================================================
// 1. 日課テーブル生成（単一 / 曜日ローテーション / サイクルローテーション）
// ========================================================

export function createDailyRoutineTable(input: DailyRoutineTemplateInput): ImportedTableData {
  const id = `table-daily-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const startTimeStr = input.timeRange?.startTime ?? null;
  const endTimeStr = input.timeRange?.endTime ?? null;
  const startMin = startTimeStr ? timeStringToMinutes(startTimeStr) : 540; // 09:00 fallback

  if (input.mode === 'cycle_rotation') {
    const cycleLength = Math.max(1, input.cycleRotation?.cycleLength || 1);
    const defaultDur = input.cycleRotation?.defaultDurationMinutes || 30;
    const items = input.cycleRotation?.items || [];
    const cycleStartDay = input.cycleRotation?.cycleStartDay ?? 0;

    const colHeaders = Array.from({ length: cycleLength }, (_, i) => `Day ${i + 1}`);
    const cells: GridCell[][] = [
      Array.from({ length: cycleLength }, (_, c) => {
        const item = items[c];
        const hasTask = Boolean(item && item.title && item.title.trim() !== '');
        const duration = item?.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : defaultDur;

        return {
          dayIndex: c,
          periodIndex: 1,
          text: hasTask ? item!.title : null,
          title: hasTask ? item!.title : '',
          roomOrNote: '',
          rawLines: hasTask ? [item!.title] : [],
          fullText: hasTask ? item!.title : '',
          startMinutes: hasTask ? startMin : 0,
          endMinutes: hasTask ? startMin + duration : 0,
        };
      }),
    ];

    return {
      id,
      name: input.name || '日課サイクル',
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'cycle',
      cycleStartDay,
      dailyRepeatCount: input.dailyRepeatCount ?? 'auto',
      weeklyRepeatCount: 'auto',
      weeklyTaskExpiryWeeks: 1,
      isApplied: true,
      numRows: 1,
      numCols: cycleLength,
      colHeaders,
      rowHeaders: ['1'],
      axisConfig: {
        startTime: startTimeStr,
        endTime: endTimeStr,
        periodMinutes: defaultDur,
        intervalMinutes: 0,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: 1,
      },
      cells,
    };
  }

  if (input.mode === 'weekday_rotation') {
    const defaultDur = input.weekdayRotation?.defaultDurationMinutes || 30;
    const daysMap = input.weekdayRotation?.days || {};

    const cells: GridCell[][] = [
      Array.from({ length: 7 }, (_, c) => {
        const item = daysMap[c];
        const hasTask = Boolean(item && item.title && item.title.trim() !== '');
        const duration = item?.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : defaultDur;

        return {
          dayIndex: c,
          periodIndex: 1,
          text: hasTask ? item!.title : null,
          title: hasTask ? item!.title : '',
          roomOrNote: '',
          rawLines: hasTask ? [item!.title] : [],
          fullText: hasTask ? item!.title : '',
          startMinutes: hasTask ? startMin : 0,
          endMinutes: hasTask ? startMin + duration : 0,
        };
      }),
    ];

    return {
      id,
      name: input.name || '曜日別日課',
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'weekday',
      cycleStartDay: 0,
      dailyRepeatCount: input.dailyRepeatCount ?? 'auto',
      weeklyRepeatCount: 'auto',
      weeklyTaskExpiryWeeks: 1,
      isApplied: true,
      numRows: 1,
      numCols: 7,
      colHeaders: [...WEEKDAY_HEADERS],
      rowHeaders: ['1'],
      axisConfig: {
        startTime: startTimeStr,
        endTime: endTimeStr,
        periodMinutes: defaultDur,
        intervalMinutes: 0,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: 1,
      },
      cells,
    };
  }

  // mode === 'single' (単一メニュー)
  const single = input.singleTask || {
    title: input.name || '日課',
    durationMinutes: 30,
    isEveryday: true,
  };
  const duration = single.durationMinutes > 0 ? single.durationMinutes : 30;

  // 毎日実施（Day 1 のみ設定 ＝ 毎日を意味するサイクル表）
  const isEveryday =
    single.isEveryday ??
    (!single.targetDays || single.targetDays.length === 0 || single.targetDays.length === 7);

  if (isEveryday) {
    const cells: GridCell[][] = [
      [
        {
          dayIndex: 0,
          periodIndex: 1,
          text: single.title,
          title: single.title,
          roomOrNote: '',
          rawLines: [single.title],
          fullText: single.title,
          startMinutes: startMin,
          endMinutes: startMin + duration,
        },
      ],
    ];

    return {
      id,
      name: input.name || single.title,
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'cycle',
      cycleStartDay: 0,
      dailyRepeatCount: input.dailyRepeatCount ?? 'auto',
      weeklyRepeatCount: 'auto',
      weeklyTaskExpiryWeeks: 1,
      isApplied: true,
      numRows: 1,
      numCols: 1,
      colHeaders: ['Day 1'],
      rowHeaders: ['1'],
      axisConfig: {
        startTime: startTimeStr,
        endTime: endTimeStr,
        periodMinutes: duration,
        intervalMinutes: 0,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: 1,
      },
      cells,
    };
  }

  // 曜日を指定する場合のみ7列（月〜日）を展開
  const targetDaysSet = new Set(single.targetDays || []);

  const cells: GridCell[][] = [
    Array.from({ length: 7 }, (_, c) => {
      const isTarget = targetDaysSet.has(c);
      return {
        dayIndex: c,
        periodIndex: 1,
        text: isTarget ? single.title : null,
        title: isTarget ? single.title : '',
        roomOrNote: '',
        rawLines: isTarget ? [single.title] : [],
        fullText: isTarget ? single.title : '',
        startMinutes: isTarget ? startMin : 0,
        endMinutes: isTarget ? startMin + duration : 0,
      };
    }),
  ];

  return {
    id,
    name: input.name || single.title,
    createdAt: now,
    updatedAt: now,
    placementMode: 'auto',
    columnMode: 'weekday',
    cycleStartDay: 0,
    dailyRepeatCount: input.dailyRepeatCount ?? 'auto',
    weeklyRepeatCount: 'auto',
    weeklyTaskExpiryWeeks: 1,
    isApplied: true,
    numRows: 1,
    numCols: 7,
    colHeaders: [...WEEKDAY_HEADERS],
    rowHeaders: ['1'],
    axisConfig: {
      startTime: startTimeStr,
      endTime: endTimeStr,
      periodMinutes: duration,
      intervalMinutes: 0,
      hasLunch: false,
      lunchAfterPeriod: 1,
      lunchMinutes: 50,
      weeklyTaskExpiryWeeks: 1,
    },
    cells,
  };
}

// ========================================================
// 2. 週次タスクテーブル生成
// ========================================================

export function createWeeklyTaskTable(input: WeeklyTaskTemplateInput): ImportedTableData {
  const id = `table-weekly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const startTimeStr = input.timeRange?.startTime ?? null;
  const endTimeStr = input.timeRange?.endTime ?? null;
  const duration = input.durationMinutes > 0 ? input.durationMinutes : 60;
  const startMin = startTimeStr ? timeStringToMinutes(startTimeStr) : 540;

  const hasConstraint = input.startConstraint?.enabled;
  const preferredDays = input.preferredDays;

  // パターンA: 開始日時指定（出題・開始縛り）がある場合
  if (hasConstraint && input.startConstraint) {
    const startDay = input.startConstraint.startDay;
    const scheduleAfterTimeStr = input.startConstraint.scheduleAfterTime || startTimeStr || '14:30';
    const scheduleStartMin = timeStringToMinutes(scheduleAfterTimeStr);

    // 7列の曜日モードで、開始曜日以降の曜日にセルを展開
    const cells: GridCell[][] = [
      Array.from({ length: 7 }, (_, c) => {
        const isEligible = c >= startDay;
        return {
          dayIndex: c,
          periodIndex: 1,
          text: isEligible ? input.title : null,
          title: isEligible ? input.title : '',
          roomOrNote: '',
          rawLines: isEligible ? [input.title] : [],
          fullText: isEligible ? input.title : '',
          startMinutes: isEligible ? scheduleStartMin : 0,
          endMinutes: isEligible ? scheduleStartMin + duration : 0,
        };
      }),
    ];

    return {
      id,
      name: input.title,
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'weekday',
      cycleStartDay: 0,
      dailyRepeatCount: 1,
      weeklyRepeatCount: input.weeklyTargetCount,
      weeklyTaskExpiryWeeks: input.expiryWeeks,
      isApplied: true,
      numRows: 1,
      numCols: 7,
      colHeaders: [...WEEKDAY_HEADERS],
      rowHeaders: ['1'],
      axisConfig: {
        startTime: scheduleAfterTimeStr,
        endTime: endTimeStr,
        periodMinutes: duration,
        intervalMinutes: 10,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: input.expiryWeeks,
      },
      cells,
    };
  }

  // パターンB: 希望曜日の指定がある場合
  if (preferredDays && preferredDays.length > 0 && preferredDays.length < 7) {
    const cells: GridCell[][] = [
      Array.from({ length: 7 }, (_, c) => {
        const isTarget = preferredDays.includes(c);
        return {
          dayIndex: c,
          periodIndex: 1,
          text: isTarget ? input.title : null,
          title: isTarget ? input.title : '',
          roomOrNote: '',
          rawLines: isTarget ? [input.title] : [],
          fullText: isTarget ? input.title : '',
          startMinutes: isTarget ? startMin : 0,
          endMinutes: isTarget ? startMin + duration : 0,
        };
      }),
    ];

    return {
      id,
      name: input.title,
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'weekday',
      cycleStartDay: 0,
      dailyRepeatCount: 1,
      weeklyRepeatCount: input.weeklyTargetCount,
      weeklyTaskExpiryWeeks: input.expiryWeeks,
      isApplied: true,
      numRows: 1,
      numCols: 7,
      colHeaders: [...WEEKDAY_HEADERS],
      rowHeaders: ['1'],
      axisConfig: {
        startTime: startTimeStr,
        endTime: endTimeStr,
        periodMinutes: duration,
        intervalMinutes: 10,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: input.expiryWeeks,
      },
      cells,
    };
  }

  // パターンC: いつでも着手可能（おまかせ・Day 1の1列表）
  const cells: GridCell[][] = [
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: input.title,
        title: input.title,
        roomOrNote: '',
        rawLines: [input.title],
        fullText: input.title,
        startMinutes: startMin,
        endMinutes: startMin + duration,
      },
    ],
  ];

  return {
    id,
    name: input.title,
    createdAt: now,
    updatedAt: now,
    placementMode: 'auto',
    columnMode: 'cycle',
    cycleStartDay: 0,
    dailyRepeatCount: 1,
    weeklyRepeatCount: input.weeklyTargetCount,
    weeklyTaskExpiryWeeks: input.expiryWeeks,
    isApplied: true,
    numRows: 1,
    numCols: 1,
    colHeaders: ['Day 1'],
    rowHeaders: ['1'],
    axisConfig: {
      startTime: startTimeStr,
      endTime: endTimeStr,
      periodMinutes: duration,
      intervalMinutes: 10,
      hasLunch: false,
      lunchAfterPeriod: 1,
      lunchMinutes: 50,
      weeklyTaskExpiryWeeks: input.expiryWeeks,
    },
    cells,
  };
}

// ========================================================
// 3. 固定枠テーブル生成
// ========================================================

export function createFixedSlotTable(input: FixedSlotTemplateInput): ImportedTableData {
  const id = `table-fixed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const startMin = timeStringToMinutes(input.startTime);
  let endMin = timeStringToMinutes(input.endTime);
  if (endMin <= startMin) {
    endMin += 1440; // 翌朝対応（例: 23:00〜07:00 等）
  }
  const duration = endMin - startMin;

  const targetDaysSet = new Set(input.targetDays);
  const cells: GridCell[][] = [
    Array.from({ length: 7 }, (_, c) => {
      const isTarget = targetDaysSet.has(c);
      return {
        dayIndex: c,
        periodIndex: 1,
        text: isTarget ? input.title : null,
        title: isTarget ? input.title : '',
        roomOrNote: '',
        rawLines: isTarget ? [input.title] : [],
        fullText: isTarget ? input.title : '',
        startMinutes: isTarget ? startMin : 0,
        endMinutes: isTarget ? endMin : 0,
      };
    }),
  ];

  return {
    id,
    name: input.title,
    createdAt: now,
    updatedAt: now,
    placementMode: 'fixed',
    columnMode: 'weekday',
    cycleStartDay: 0,
    dailyRepeatCount: 'auto',
    weeklyRepeatCount: 'auto',
    weeklyTaskExpiryWeeks: 1,
    isApplied: true,
    numRows: 1,
    numCols: 7,
    colHeaders: [...WEEKDAY_HEADERS],
    rowHeaders: ['1'],
    axisConfig: {
      startTime: input.startTime,
      endTime: input.endTime,
      periodMinutes: duration,
      intervalMinutes: 0,
      hasLunch: false,
      lunchAfterPeriod: 1,
      lunchMinutes: 50,
      weeklyTaskExpiryWeeks: 1,
    },
    cells,
  };
}
