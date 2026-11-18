import { GridCell, ImportedTableData } from '@/types';
import { timeStringToMinutes } from '../timeUtils';
import { sortRowsByTime } from '../tableUtils';

// ========================================================
// テンプレート入力型定義
// ========================================================

export interface TemplateTaskItemInput {
  title: string;
  durationMinutes: number;
  startTime?: string; // 例: "07:00"
  url?: string;
}

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
    startTime?: string;
    isEveryday?: boolean; // true の場合は1行1列の最小表を生成
    targetDays?: number[]; // 曜日指定時（0:月〜6:日）
  };

  // 複数項目（マルチタスクリスト）の場合
  multiTasks?: {
    items: TemplateTaskItemInput[];
    isEveryday?: boolean;
    targetDays?: number[];
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
  name?: string; // 表の表示名
  title?: string;
  durationMinutes?: number;
  weeklyTargetCount?: number | 'auto';
  expiryWeeks?: 1 | 2 | 'none';
  timeRange?: { startTime: string | null; endTime: string | null };

  // 複数項目（マルチタスクリスト）の場合
  multiTasks?: {
    items: TemplateTaskItemInput[];
  };

  // 開始日時（出題日時）の指定オプション
  startConstraint?: {
    enabled: boolean;
    startDay: number; // 0:月〜6:日
    scheduleAfterTime?: string; // 例: "14:30"
  };

  // 配置希望曜日（未指定時は空き枠おまかせ）
  preferredDays?: number[]; // 例: [0, 2, 4] (月, 水, 金)
}

export interface FixedSlotItemInput {
  title: string;
  startTime: string;
  endTime: string;
  targetDays?: number[]; // 0:月〜6:日、未指定時は全曜日
  attachedTask?: {
    enabled: boolean;
    title?: string;
    durationMinutes?: number;
  };
}

export interface FixedSlotTemplateInput {
  name?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  targetDays?: number[]; // 0:月〜6:日
  multiSlots?: {
    items: FixedSlotItemInput[];
  };
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

  // mode === 'single' または複数項目リスト
  const taskItems: TemplateTaskItemInput[] =
    input.multiTasks?.items && input.multiTasks.items.length > 0
      ? input.multiTasks.items
      : [
          {
            title: input.singleTask?.title || input.name || '日課',
            durationMinutes: input.singleTask?.durationMinutes || 30,
            startTime: input.singleTask?.startTime,
          },
        ];

  const firstDuration = taskItems[0]?.durationMinutes || 30;
  const isEveryday =
    input.multiTasks?.isEveryday ??
    input.singleTask?.isEveryday ??
    (!input.singleTask?.targetDays ||
      input.singleTask.targetDays.length === 0 ||
      input.singleTask.targetDays.length === 7);

  const targetDays = input.multiTasks?.targetDays ?? input.singleTask?.targetDays;
  const targetDaysSet = new Set(targetDays || []);

  const numRows = taskItems.length;
  const rowHeaders = Array.from({ length: numRows }, (_, r) => String(r + 1));

  let createdTable: ImportedTableData;

  if (isEveryday) {
    const cells: GridCell[][] = taskItems.map((item, r) => {
      const duration = item.durationMinutes > 0 ? item.durationMinutes : 30;
      const itemStart = item.startTime ? timeStringToMinutes(item.startTime) : startMin;
      return [
        {
          dayIndex: 0,
          periodIndex: r + 1,
          text: item.title,
          title: item.title,
          roomOrNote: '',
          rawLines: [item.title],
          fullText: item.title,
          startMinutes: itemStart,
          endMinutes: itemStart + duration,
          customDurationMinutes: duration,
          customStartTime: item.startTime,
          hasCustomTime: Boolean(item.startTime),
          url: item.url,
        },
      ];
    });

    createdTable = {
      id,
      name: input.name || taskItems[0]?.title || '日課',
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'cycle',
      cycleStartDay: 0,
      dailyRepeatCount: input.dailyRepeatCount ?? 'auto',
      weeklyRepeatCount: 'auto',
      weeklyTaskExpiryWeeks: 1,
      isApplied: true,
      numRows,
      numCols: 1,
      colHeaders: ['Day 1'],
      rowHeaders,
      axisConfig: {
        startTime: startTimeStr,
        endTime: endTimeStr,
        periodMinutes: firstDuration,
        intervalMinutes: 0,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: 1,
      },
      cells,
    };
  } else {
    const cells: GridCell[][] = taskItems.map((item, r) => {
      const duration = item.durationMinutes > 0 ? item.durationMinutes : 30;
      const itemStart = item.startTime ? timeStringToMinutes(item.startTime) : startMin;

      return Array.from({ length: 7 }, (_, c) => {
        const isTarget = targetDaysSet.has(c);
        return {
          dayIndex: c,
          periodIndex: r + 1,
          text: isTarget ? item.title : null,
          title: isTarget ? item.title : '',
          roomOrNote: '',
          rawLines: isTarget ? [item.title] : [],
          fullText: isTarget ? item.title : '',
          startMinutes: isTarget ? itemStart : 0,
          endMinutes: isTarget ? itemStart + duration : 0,
          customDurationMinutes: isTarget ? duration : undefined,
          customStartTime: isTarget ? item.startTime : undefined,
          hasCustomTime: isTarget ? Boolean(item.startTime) : undefined,
          url: isTarget ? item.url : undefined,
        };
      });
    });

    createdTable = {
      id,
      name: input.name || taskItems[0]?.title || '日課',
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'weekday',
      cycleStartDay: 0,
      dailyRepeatCount: input.dailyRepeatCount ?? 'auto',
      weeklyRepeatCount: 'auto',
      weeklyTaskExpiryWeeks: 1,
      isApplied: true,
      numRows,
      numCols: 7,
      colHeaders: [...WEEKDAY_HEADERS],
      rowHeaders,
      axisConfig: {
        startTime: startTimeStr,
        endTime: endTimeStr,
        periodMinutes: firstDuration,
        intervalMinutes: 0,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: 1,
      },
      cells,
    };
  }

  return sortRowsByTime(createdTable);
}

// ========================================================
// 2. 週次タスクテーブル生成
// ========================================================

export function createWeeklyTaskTable(input: WeeklyTaskTemplateInput): ImportedTableData {
  const id = `table-weekly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const taskItems: TemplateTaskItemInput[] =
    input.multiTasks?.items && input.multiTasks.items.length > 0
      ? input.multiTasks.items
      : [
          {
            title: input.title || '週タスク',
            durationMinutes: input.durationMinutes || 60,
          },
        ];

  const firstDuration = taskItems[0]?.durationMinutes || 60;
  const numRows = taskItems.length;
  const rowHeaders = Array.from({ length: numRows }, (_, r) => String(r + 1));
  const tableName = input.name || taskItems[0]?.title || '週タスク';
  const weeklyRepeatCount = input.weeklyTargetCount ?? 'auto';
  const expiryWeeks = input.expiryWeeks ?? 1;

  const startTimeStr = input.timeRange?.startTime ?? null;
  const endTimeStr = input.timeRange?.endTime ?? null;
  const startMin = startTimeStr ? timeStringToMinutes(startTimeStr) : 540;

  const hasConstraint = input.startConstraint?.enabled;
  const preferredDays = input.preferredDays;

  // パターンA: 開始日時指定（出題・開始縛り）がある場合
  if (hasConstraint && input.startConstraint) {
    const startDay = input.startConstraint.startDay;
    const scheduleAfterTimeStr = input.startConstraint.scheduleAfterTime || startTimeStr || '14:30';
    const scheduleStartMin = timeStringToMinutes(scheduleAfterTimeStr);

    const cells: GridCell[][] = taskItems.map((item, r) => {
      const dur = item.durationMinutes > 0 ? item.durationMinutes : 60;
      return Array.from({ length: 7 }, (_, c) => {
        const isEligible = c >= startDay;
        return {
          dayIndex: c,
          periodIndex: r + 1,
          text: isEligible ? item.title : null,
          title: isEligible ? item.title : '',
          roomOrNote: '',
          rawLines: isEligible ? [item.title] : [],
          fullText: isEligible ? item.title : '',
          startMinutes: isEligible ? scheduleStartMin : 0,
          endMinutes: isEligible ? scheduleStartMin + dur : 0,
          customDurationMinutes: isEligible ? dur : undefined,
        };
      });
    });

    return {
      id,
      name: tableName,
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'weekday',
      cycleStartDay: 0,
      dailyRepeatCount: 1,
      weeklyRepeatCount,
      weeklyTaskExpiryWeeks: expiryWeeks,
      isApplied: true,
      numRows,
      numCols: 7,
      colHeaders: [...WEEKDAY_HEADERS],
      rowHeaders,
      axisConfig: {
        startTime: scheduleAfterTimeStr,
        endTime: endTimeStr,
        periodMinutes: firstDuration,
        intervalMinutes: 10,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: expiryWeeks,
      },
      cells,
    };
  }

  // パターンB: 希望曜日の指定がある場合
  if (preferredDays && preferredDays.length > 0 && preferredDays.length < 7) {
    const cells: GridCell[][] = taskItems.map((item, r) => {
      const dur = item.durationMinutes > 0 ? item.durationMinutes : 60;
      return Array.from({ length: 7 }, (_, c) => {
        const isTarget = preferredDays.includes(c);
        return {
          dayIndex: c,
          periodIndex: r + 1,
          text: isTarget ? item.title : null,
          title: isTarget ? item.title : '',
          roomOrNote: '',
          rawLines: isTarget ? [item.title] : [],
          fullText: isTarget ? item.title : '',
          startMinutes: isTarget ? startMin : 0,
          endMinutes: isTarget ? startMin + dur : 0,
          customDurationMinutes: isTarget ? dur : undefined,
        };
      });
    });

    return {
      id,
      name: tableName,
      createdAt: now,
      updatedAt: now,
      placementMode: 'auto',
      columnMode: 'weekday',
      cycleStartDay: 0,
      dailyRepeatCount: 1,
      weeklyRepeatCount,
      weeklyTaskExpiryWeeks: expiryWeeks,
      isApplied: true,
      numRows,
      numCols: 7,
      colHeaders: [...WEEKDAY_HEADERS],
      rowHeaders,
      axisConfig: {
        startTime: startTimeStr,
        endTime: endTimeStr,
        periodMinutes: firstDuration,
        intervalMinutes: 10,
        hasLunch: false,
        lunchAfterPeriod: 1,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: expiryWeeks,
      },
      cells,
    };
  }

  // パターンC: いつでも着手可能（おまかせ・Day 1の1列表）
  const cells: GridCell[][] = taskItems.map((item, r) => {
    const dur = item.durationMinutes > 0 ? item.durationMinutes : 60;
    return [
      {
        dayIndex: 0,
        periodIndex: r + 1,
        text: item.title,
        title: item.title,
        roomOrNote: '',
        rawLines: [item.title],
        fullText: item.title,
        startMinutes: startMin,
        endMinutes: startMin + dur,
        customDurationMinutes: dur,
      },
    ];
  });

  return {
    id,
    name: tableName,
    createdAt: now,
    updatedAt: now,
    placementMode: 'auto',
    columnMode: 'cycle',
    cycleStartDay: 0,
    dailyRepeatCount: 1,
    weeklyRepeatCount,
    weeklyTaskExpiryWeeks: expiryWeeks,
    isApplied: true,
    numRows,
    numCols: 1,
    colHeaders: ['Day 1'],
    rowHeaders,
    axisConfig: {
      startTime: startTimeStr,
      endTime: endTimeStr,
      periodMinutes: firstDuration,
      intervalMinutes: 10,
      hasLunch: false,
      lunchAfterPeriod: 1,
      lunchMinutes: 50,
      weeklyTaskExpiryWeeks: expiryWeeks,
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

  const slotItems: FixedSlotItemInput[] =
    input.multiSlots?.items && input.multiSlots.items.length > 0
      ? input.multiSlots.items
      : [
          {
            title: input.title || '固定枠',
            startTime: input.startTime || '00:00',
            endTime: input.endTime || '08:00',
            targetDays: input.targetDays || [0, 1, 2, 3, 4, 5, 6],
          },
        ];

  const numRows = slotItems.length;
  const rowHeaders = Array.from({ length: numRows }, (_, r) => String(r + 1));
  const tableName = input.name || slotItems[0]?.title || '固定枠';

  const cells: GridCell[][] = slotItems.map((item, r) => {
    const startMin = timeStringToMinutes(item.startTime);
    let endMin = timeStringToMinutes(item.endTime);
    if (endMin <= startMin) {
      endMin += 1440; // 翌朝対応（例: 23:00〜07:00 等）
    }
    const dur = endMin - startMin;
    const targetDaysSet = new Set(item.targetDays || [0, 1, 2, 3, 4, 5, 6]);

    return Array.from({ length: 7 }, (_, c) => {
      const isTarget = targetDaysSet.has(c);
      const hasAttached = isTarget && item.attachedTask?.enabled;
      return {
        dayIndex: c,
        periodIndex: r + 1,
        text: isTarget ? item.title : null,
        title: isTarget ? item.title : '',
        roomOrNote: '',
        rawLines: isTarget ? [item.title] : [],
        fullText: isTarget ? item.title : '',
        startMinutes: isTarget ? startMin : 0,
        endMinutes: isTarget ? endMin : 0,
        customDurationMinutes: isTarget ? dur : undefined,
        customStartTime: isTarget ? item.startTime : undefined,
        hasCustomTime: isTarget ? true : undefined,
        attachedTask: hasAttached
          ? {
              enabled: true,
              title: item.attachedTask?.title?.trim() || `${item.title} の課題`,
              durationMinutes:
                item.attachedTask?.durationMinutes && item.attachedTask.durationMinutes > 0
                  ? item.attachedTask.durationMinutes
                  : 30,
            }
          : undefined,
      };
    });
  });

  const firstStartMin = timeStringToMinutes(slotItems[0]?.startTime || '00:00');
  let firstEndMin = timeStringToMinutes(slotItems[0]?.endTime || '08:00');
  if (firstEndMin <= firstStartMin) {
    firstEndMin += 1440;
  }
  const firstDuration = firstEndMin - firstStartMin;

  const table: ImportedTableData = {
    id,
    name: tableName,
    createdAt: now,
    updatedAt: now,
    placementMode: 'fixed',
    columnMode: 'weekday',
    cycleStartDay: 0,
    dailyRepeatCount: 'auto',
    weeklyRepeatCount: 'auto',
    weeklyTaskExpiryWeeks: 1,
    isApplied: true,
    numRows,
    numCols: 7,
    colHeaders: [...WEEKDAY_HEADERS],
    rowHeaders,
    axisConfig: {
      startTime: slotItems[0]?.startTime || '00:00',
      endTime: slotItems[0]?.endTime || '08:00',
      periodMinutes: firstDuration,
      intervalMinutes: 0,
      hasLunch: false,
      lunchAfterPeriod: 1,
      lunchMinutes: 50,
      weeklyTaskExpiryWeeks: 1,
    },
    cells,
  };

  return sortRowsByTime(table);
}
