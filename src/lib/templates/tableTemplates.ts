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
  targetDays?: number[]; // 対象とする日 (Day 1..N または 曜日 0..6)
  weeklyCount?: number; // 週次タスク: 週あたりの目標回数（例: 週2回なら2）
}

export interface DailyMenuItem {
  title: string;
  durationMinutes?: number; // 未指定時はデフォルト所要時間を適用
}

export interface DailyRoutineTemplateInput {
  name: string; // 表の表示名（例:「朝の筋トレ」「英語学習」）
  mode?: 'single' | 'weekday_rotation' | 'cycle_rotation';

  // 日数・くり返し設定（新統一仕様）
  daysCount?: number; // 何日分の予定を設定するか（1〜14日）
  isRepeat?: boolean; // この予定をくり返すか（true: サイクル巡回、false: 曜日固定等）
  repeatStartDay?: number; // 何曜日から始まるか（0:月〜6:日）

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

  // 日数・くり返し設定（新統一仕様）
  daysCount?: number; // 何日分の予定を設定するか（1〜14日）
  isRepeat?: boolean; // 毎週くり返すか（true: 期限なし/継続、false: 当週限り）
  repeatStartDay?: number; // 何曜日から始まるか（0:月〜6:日）

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
  targetDays?: number[]; // 0:月〜6:日、未指定時は全日
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
  targetDays?: number[]; // 0:月〜6:日 または 0..cycleLength-1
  multiSlots?: {
    items: FixedSlotItemInput[];
  };
  mode?: 'everyday' | 'weekday' | 'cycle'; // 互換性維持
  cycleLength?: number;
  cycleStartDay?: number;

  // 日数・くり返し設定（新統一仕様）
  daysCount?: number; // 何日分の予定を設定するか（1〜14日）
  isRepeat?: boolean; // この予定をくり返すか
  repeatStartDay?: number; // 何曜日から始まるか（0:月〜6:日）
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
  const legacyTargetDays = input.multiTasks?.targetDays ?? input.singleTask?.targetDays;

  // 新統一仕様（daysCount, isRepeat, repeatStartDay）の適用判定
  const days = Math.max(
    1,
    Math.min(
      14,
      input.daysCount ??
        (input.multiTasks?.isEveryday || input.singleTask?.isEveryday
          ? 1
          : (input.multiTasks?.targetDays && input.multiTasks.targetDays.length > 0) ||
              (input.singleTask?.targetDays && input.singleTask.targetDays.length > 0)
            ? 7
            : 1),
    ),
  );
  // daysCount未指定時、isEverydayならくり返し(true)、曜日指定なら曜日固定(false)
  const isRepeat =
    input.isRepeat ??
    (input.daysCount !== undefined
      ? true
      : input.multiTasks?.isEveryday || input.singleTask?.isEveryday
        ? true
        : false);
  const startDay = input.repeatStartDay ?? input.cycleRotation?.cycleStartDay ?? 0;

  const numRows = taskItems.length;
  const rowHeaders = Array.from({ length: numRows }, (_, r) => String(r + 1));

  const numCols: number = days;
  let colHeaders: string[];
  let columnMode: 'weekday' | 'cycle';
  let cycleStartDay: number;

  if (days === 7 && !isRepeat) {
    columnMode = 'weekday';
    colHeaders = [...WEEKDAY_HEADERS];
    cycleStartDay = 0;
  } else {
    columnMode = 'cycle';
    colHeaders = Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
    cycleStartDay = startDay;
  }

  const defaultAllDays = Array.from({ length: numCols }, (_, i) => i);

  const cells: GridCell[][] = taskItems.map((item, r) => {
    const duration = item.durationMinutes > 0 ? item.durationMinutes : 30;
    const itemStart = item.startTime ? timeStringToMinutes(item.startTime) : startMin;
    const itemTargetDays =
      item.targetDays && item.targetDays.length > 0
        ? item.targetDays
        : legacyTargetDays && legacyTargetDays.length > 0
          ? legacyTargetDays
          : defaultAllDays;
    const targetSet = new Set(days === 1 ? [0] : itemTargetDays);

    return Array.from({ length: numCols }, (_, c) => {
      const isTarget = targetSet.has(c);
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

  const createdTable: ImportedTableData = {
    id,
    name: input.name || taskItems[0]?.title || '日課',
    createdAt: now,
    updatedAt: now,
    placementMode: 'auto',
    columnMode,
    cycleStartDay,
    dailyRepeatCount: input.dailyRepeatCount ?? 'auto',
    weeklyRepeatCount: 'auto',
    weeklyTaskExpiryWeeks: 1,
    isApplied: true,
    numRows,
    numCols,
    colHeaders,
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
  const itemWeeklyCounts = taskItems
    .map((t) => t.weeklyCount)
    .filter((c): c is number => typeof c === 'number' && c > 0);
  const maxItemWeeklyCount = itemWeeklyCounts.length > 0 ? Math.max(...itemWeeklyCounts) : undefined;
  const weeklyRepeatCount = input.weeklyTargetCount ?? maxItemWeeklyCount ?? 'auto';
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
          targetWeeklyCount: item.weeklyCount,
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
          targetWeeklyCount: item.weeklyCount,
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

  // パターンC: 日数（daysCount）およびくり返し設定に基づく生成
  const days = Math.max(1, Math.min(14, input.daysCount ?? 1));
  const isRepeat = input.isRepeat ?? true;
  const startDay = input.repeatStartDay ?? 0;

  const numCols: number = days;
  let colHeaders: string[];
  let columnMode: 'weekday' | 'cycle';
  let cycleStartDay: number;

  if (days === 7 && !isRepeat) {
    columnMode = 'weekday';
    colHeaders = [...WEEKDAY_HEADERS];
    cycleStartDay = 0;
  } else {
    columnMode = 'cycle';
    colHeaders = Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
    cycleStartDay = startDay;
  }

  const defaultAllDays = Array.from({ length: numCols }, (_, i) => i);

  const cells: GridCell[][] = taskItems.map((item, r) => {
    const dur = item.durationMinutes > 0 ? item.durationMinutes : 60;
    const itemTargetDays =
      item.targetDays && item.targetDays.length > 0
        ? item.targetDays
        : defaultAllDays;
    const targetSet = new Set(days === 1 ? [0] : itemTargetDays);

    return Array.from({ length: numCols }, (_, c) => {
      const isTarget = targetSet.has(c);
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
        targetWeeklyCount: item.weeklyCount,
      };
    });
  });

  return {
    id,
    name: tableName,
    createdAt: now,
    updatedAt: now,
    placementMode: 'auto',
    columnMode,
    cycleStartDay,
    dailyRepeatCount: 1,
    weeklyRepeatCount,
    weeklyTaskExpiryWeeks: isRepeat ? (input.expiryWeeks ?? 'none') : 1,
    isApplied: true,
    numRows,
    numCols,
    colHeaders,
    rowHeaders,
    axisConfig: {
      startTime: startTimeStr,
      endTime: endTimeStr,
      periodMinutes: firstDuration,
      intervalMinutes: 10,
      hasLunch: false,
      lunchAfterPeriod: 1,
      lunchMinutes: 50,
      weeklyTaskExpiryWeeks: isRepeat ? (input.expiryWeeks ?? 'none') : 1,
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

  // 日数・くり返しモードの決定（新統一仕様 ＆ 従来互換）
  let days: number;
  let isRepeat: boolean;

  if (input.daysCount !== undefined) {
    days = Math.max(1, Math.min(14, input.daysCount));
    isRepeat = input.isRepeat ?? true;
  } else if (input.mode === 'everyday' || input.cycleLength === 1) {
    days = 1;
    isRepeat = true;
  } else if (input.mode === 'cycle' || (input.cycleLength && input.cycleLength > 1)) {
    days = Math.max(2, Math.min(14, input.cycleLength || 3));
    isRepeat = true;
  } else {
    // デフォルト（mode === 'weekday' または未指定）
    days = 7;
    isRepeat = false;
  }

  const startDay = input.repeatStartDay ?? input.cycleStartDay ?? 0;

  const numCols: number = days;
  let colHeaders: string[];
  let columnMode: 'weekday' | 'cycle';
  let cycleStartDay: number;

  if (days === 7 && !isRepeat) {
    // 7日分かつくり返さない場合は標準の曜日固定テーブル（月〜日）
    columnMode = 'weekday';
    colHeaders = [...WEEKDAY_HEADERS];
    cycleStartDay = 0;
  } else {
    // 1日分またはN日サイクル（くり返し）
    columnMode = 'cycle';
    colHeaders = Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
    cycleStartDay = startDay;
  }

  const defaultAllDays = Array.from({ length: numCols }, (_, i) => i);

  const slotItems: FixedSlotItemInput[] =
    input.multiSlots?.items && input.multiSlots.items.length > 0
      ? input.multiSlots.items
      : [
          {
            title: input.title || '固定枠',
            startTime: input.startTime || '00:00',
            endTime: input.endTime || '08:00',
            targetDays: input.targetDays || defaultAllDays,
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
    // 1日かつくり返す（everyday）時は常にDay 1(列0)が対象。それ以外は item.targetDays を参照
    const targetDaysSet =
      days === 1
        ? new Set([0])
        : new Set(item.targetDays && item.targetDays.length > 0 ? item.targetDays : defaultAllDays);

    return Array.from({ length: numCols }, (_, c) => {
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
    columnMode,
    cycleStartDay,
    dailyRepeatCount: 'auto',
    weeklyRepeatCount: 'auto',
    weeklyTaskExpiryWeeks: 1,
    isApplied: true,
    numRows,
    numCols,
    colHeaders,
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
