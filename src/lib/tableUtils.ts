import {
  ImportedTableData,
  TableClassification,
  GridCell,
  FixedSlot,
  TaskItem,
  FixedCategory,
  TaskCategory,
} from '@/types';
import { calculatePeriodTimes } from './timeUtils';

const WEEKDAY_NAMES = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜', '月', '火', '水', '木', '金', '土', '日'];
const DAILY_TIMEFRAME_KEYWORDS = ['朝', '昼', '夕', '夜', '午前', '午後', '起床', '就寝', 'タイムテーブル', '日課', 'ルーティン', '1日'];
const CYCLE_KEYWORDS = ['day', 'サイクル', '周期', '分割', 'rot', 'part'];

/**
 * 列ヘッダーの種類（曜日・周期ローテーション・フリー/1列・除外）の型定義
 */
export type ColHeaderType = 'weekday' | 'cycle' | 'free' | 'excluded';

export interface ParsedColHeader {
  type: ColHeaderType;
  dayIndex?: number; // 0..6 (0:月 〜 6:日)
  cycleIndex?: number; // 0..N (Day 1=0, Day 2=1 ...)
  label: string;
}

/**
 * 列ヘッダーの文字列から、曜日/周期/フリー/除外 を正確に判定
 */
export function parseColHeader(header: string, defaultIndex: number): ParsedColHeader {
  const h = (header || '').trim();
  const hLower = h.toLowerCase();

  // 1. 除外
  if (h === '除外' || hLower === 'exclude' || h === 'なし' || h === '無効') {
    return { type: 'excluded', label: h };
  }

  // 2. 曜日（月曜〜土曜、または単独文字「月」〜「土」、そして「日曜」「日」）
  if (h.includes('月曜') || h === '月' || hLower === 'mon' || hLower === 'monday') {
    return { type: 'weekday', dayIndex: 0, label: h };
  }
  if (h.includes('火曜') || h === '火' || hLower === 'tue' || hLower === 'tuesday') {
    return { type: 'weekday', dayIndex: 1, label: h };
  }
  if (h.includes('水曜') || h === '水' || hLower === 'wed' || hLower === 'wednesday') {
    return { type: 'weekday', dayIndex: 2, label: h };
  }
  if (h.includes('木曜') || h === '木' || hLower === 'thu' || hLower === 'thursday') {
    return { type: 'weekday', dayIndex: 3, label: h };
  }
  if (h.includes('金曜') || h === '金' || hLower === 'fri' || hLower === 'friday') {
    return { type: 'weekday', dayIndex: 4, label: h };
  }
  if (h.includes('土曜') || h === '土' || hLower === 'sat' || hLower === 'saturday') {
    return { type: 'weekday', dayIndex: 5, label: h };
  }
  if (h.includes('日曜') || h === '日' || hLower === 'sun' || hLower === 'sunday') {
    return { type: 'weekday', dayIndex: 6, label: h };
  }

  // 3. 周期ローテーション: Day 1, Day 2, サイクル1, 周期1, A, B, C など
  const dayMatch = hLower.match(/^day\s*(\d+)$/i);
  if (dayMatch) {
    const num = parseInt(dayMatch[1], 10);
    return { type: 'cycle', cycleIndex: Math.max(0, num - 1), label: h };
  }
  const cycleMatch = h.match(/^(?:サイクル|周期|rot|part)\s*(\d+)$/i);
  if (cycleMatch) {
    const num = parseInt(cycleMatch[1], 10);
    return { type: 'cycle', cycleIndex: Math.max(0, num - 1), label: h };
  }
  const abcMatch = h.match(/^([A-Ga-g])(?:日|サイクル|周期)?$/);
  if (abcMatch) {
    const charCode = abcMatch[1].toUpperCase().charCodeAt(0) - 65; // A->0, B->1
    return { type: 'cycle', cycleIndex: charCode, label: h };
  }

  // 4. フリー / 1列 / 全日 / リスト
  if (
    h === 'フリー' ||
    h === '全日' ||
    h === '毎日' ||
    h === 'リスト' ||
    h === 'タスク' ||
    h === '日課' ||
    h === 'メニュー'
  ) {
    return { type: 'free', label: h };
  }

  return { type: 'free', label: h };
}

/**
 * 表データが「固定枠」「日（日次タスク）」「週（週次タスク/周期）」のどれに分類されるかを判定
 * - 固定枠: 開始時刻が設定されているもの
 * - 日（日次）: 1日に複数回組み込まれる可能性があるもの (1日メニュー、朝昼晩ルーティン等)
 * - 週（週次）: 週に複数回組み込まれる可能性があるもの (3日周期筋トレ表、週次タスク等)
 */
export function getTableClassification(table: ImportedTableData): TableClassification {
  if (table.classificationOverride) {
    return table.classificationOverride;
  }

  const isStartTimeUnset = !table.axisConfig.startTime || table.axisConfig.startTime === 'unset';
  if (!isStartTimeUnset) {
    return 'fixed_slot';
  }

  const tableNameLower = table.name.toLowerCase();
  const hasDailyName = DAILY_TIMEFRAME_KEYWORDS.some((kw) => tableNameLower.includes(kw));

  const hasDailyHeaders = table.colHeaders.some((h) =>
    DAILY_TIMEFRAME_KEYWORDS.some((kw) => h.toLowerCase().includes(kw)),
  );

  // 1日の区分ヘッダーがある、または表名が1日向けで曜日指定がない場合 ➔ 日次タスク (1日に複数回)
  if (hasDailyHeaders || (hasDailyName && !table.colHeaders.some((h) => WEEKDAY_NAMES.includes(h)))) {
    return 'daily_task';
  }

  // 3日周期や曜日ヘッダー、一般の表 ➔ 週次タスク (週に複数回組み込む)
  return 'weekly_task';
}

/**
 * 表に新しい行を末尾に追加
 */
export function addRowToTable(table: ImportedTableData): ImportedTableData {
  const newRowIdx = table.numRows;
  const newRow: GridCell[] = Array.from({ length: table.numCols }, (_, cIdx) => ({
    dayIndex: cIdx < 7 ? cIdx : 0,
    periodIndex: newRowIdx + 1,
    text: null,
    rawLines: [],
    fullText: '',
    title: '',
    roomOrNote: '',
    startMinutes: 0,
    endMinutes: 0,
  }));

  return {
    ...table,
    numRows: table.numRows + 1,
    rowHeaders: [...table.rowHeaders, `${newRowIdx + 1}`],
    cells: [...table.cells, newRow],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 表の末尾行を削除 (最低1行は残す)
 */
export function removeRowFromTable(table: ImportedTableData): ImportedTableData {
  if (table.numRows <= 1) return table;

  const nextCells = table.cells.slice(0, table.numRows - 1);
  const nextRowHeaders = table.rowHeaders.slice(0, table.numRows - 1);

  return {
    ...table,
    numRows: table.numRows - 1,
    rowHeaders: nextRowHeaders,
    cells: nextCells,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 指定インデックスの行を削除 (最低1行は残す)
 */
export function removeRowAtIndex(table: ImportedTableData, rowIndex: number): ImportedTableData {
  if (table.numRows <= 1 || rowIndex < 0 || rowIndex >= table.numRows) return table;

  const nextCells = table.cells.filter((_, idx) => idx !== rowIndex);
  const nextRowHeaders = nextCells.map((_, idx) => `${idx + 1}`);

  return {
    ...table,
    numRows: table.numRows - 1,
    rowHeaders: nextRowHeaders,
    cells: nextCells,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 表に新しい列を右端に追加
 */
export function addColToTable(table: ImportedTableData): ImportedTableData {
  const newColIdx = table.numCols;
  const nextHeader = newColIdx < 7 ? WEEKDAY_NAMES[newColIdx] : `列 ${newColIdx + 1}`;

  const nextCells = table.cells.map((row, rIdx) => [
    ...row,
    {
      dayIndex: newColIdx < 7 ? newColIdx : 0,
      periodIndex: rIdx + 1,
      text: null,
      rawLines: [],
      fullText: '',
      title: '',
      roomOrNote: '',
      startMinutes: 0,
      endMinutes: 0,
    },
  ]);

  return {
    ...table,
    numCols: table.numCols + 1,
    colHeaders: [...table.colHeaders, nextHeader],
    cells: nextCells,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 表の右端列を削除 (最低1列は残す)
 */
export function removeColFromTable(table: ImportedTableData): ImportedTableData {
  if (table.numCols <= 1) return table;

  const nextHeaders = table.colHeaders.slice(0, table.numCols - 1);
  const nextCells = table.cells.map((row) => row.slice(0, table.numCols - 1));

  return {
    ...table,
    numCols: table.numCols - 1,
    colHeaders: nextHeaders,
    cells: nextCells,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 指定インデックスの列を削除 (最低1列は残す)
 */
export function removeColAtIndex(table: ImportedTableData, colIndex: number): ImportedTableData {
  if (table.numCols <= 1 || colIndex < 0 || colIndex >= table.numCols) return table;

  const nextHeaders = table.colHeaders.filter((_, idx) => idx !== colIndex);
  const nextCells = table.cells.map((row) => row.filter((_, idx) => idx !== colIndex));

  return {
    ...table,
    numCols: table.numCols - 1,
    colHeaders: nextHeaders,
    cells: nextCells,
    updatedAt: new Date().toISOString(),
  };
}

export interface TableScheduleGenerationResult {
  slots: FixedSlot[];
  tasks: TaskItem[];
  slotIds: string[];
  taskIds: string[];
}

/**
 * 表データの分類（固定枠/日課/週次）と付随タスク設定に基づいて、
 * 計画表に反映すべき FixedSlot[] と TaskItem[] を一括生成
 */
export function generateScheduleItemsForTable(table: ImportedTableData): TableScheduleGenerationResult {
  const classification = getTableClassification(table);
  const slots: FixedSlot[] = [];
  const tasks: TaskItem[] = [];

  const tablePeriodTimes =
    classification === 'fixed_slot'
      ? calculatePeriodTimes(table.numRows, table.axisConfig)
      : [];

  const attachedConfig = table.attachedTaskConfig;

  // 各列の属性（曜日、周期、フリー、除外）を事前解析
  const parsedCols = table.colHeaders.map((h, idx) => parseColHeader(h, idx));
  const cycleCols = parsedCols.filter((p) => p.type === 'cycle');
  const cycleCount = cycleCols.length > 0 ? cycleCols.length : (table.numCols > 1 ? table.numCols : 3);

  table.cells.forEach((row, r) => {
    const timeSlot = tablePeriodTimes[r];

    row.forEach((cell, c) => {
      const colInfo = parsedCols[c] || { type: 'free' as ColHeaderType, label: '' };
      if (colInfo.type === 'excluded') return;

      if (!cell.title || !cell.title.trim()) return;

      const title = cell.title.trim();
      const rawCategory = cell.category || (classification === 'fixed_slot' ? 'lecture' : 'routine');
      const fullTitle = cell.roomOrNote
        ? `${title} (${cell.roomOrNote.replace(/\n/g, ' ')})`
        : title;

      const isWeekday = colInfo.type === 'weekday' && colInfo.dayIndex !== undefined;
      const isCycle = colInfo.type === 'cycle' && colInfo.cycleIndex !== undefined;

      if (classification === 'fixed_slot') {
        // 固定枠として生成 (開始時刻・終了時刻あり)
        if (timeSlot && (timeSlot.startMinutes > 0 || timeSlot.endMinutes > 0)) {
          let days: number[] = [];
          if (isWeekday) {
            days = [colInfo.dayIndex!];
          } else if (isCycle) {
            days = [0, 1, 2, 3, 4, 5, 6].filter(
              (d) => d % cycleCount === (colInfo.cycleIndex! % cycleCount),
            );
          } else {
            // フリー・1列・全日: 毎日
            days = [0, 1, 2, 3, 4, 5, 6];
          }

          const slotId = `slot-table-${table.id}-${r}-${c}`;
          const fixedCat: FixedCategory =
            rawCategory === 'lecture' || rawCategory === 'work' || rawCategory === 'routine' || rawCategory === 'meal' || rawCategory === 'sleep'
              ? rawCategory
              : rawCategory === 'study'
              ? 'lecture'
              : rawCategory === 'workout'
              ? 'routine'
              : 'other';

          slots.push({
            id: slotId,
            title: fullTitle,
            category: fixedCat,
            startMinutes: timeSlot.startMinutes,
            endMinutes: timeSlot.endMinutes,
            color: fixedCat === 'lecture' ? '#0284c7' : '#059669',
            daysOfWeek: days,
            sourceTableId: table.id,
            sourceTableName: table.name,
          });
        }
      } else if (classification === 'daily_task') {
        // 日（日次タスク）として生成:
        // - 曜日指定: その曜日だけ行う日次タスク (例: 月曜日の日課)
        // - 周期指定: 日ごとに順番に入れ替える周期日次タスク (例: Day 1, Day 2, Day 3 のローテーション)
        // - フリー/1列: 曜日・周期に関わらず毎日行う日次タスク
        const taskId = `task-table-${table.id}-${r}-${c}`;
        const duration = table.axisConfig.periodMinutes || 30;
        const taskCat: TaskCategory =
          rawCategory === 'workout'
            ? 'workout'
            : rawCategory === 'study' || rawCategory === 'lecture'
            ? 'study'
            : rawCategory === 'work'
            ? 'work'
            : rawCategory === 'hobby'
            ? 'hobby'
            : 'must';

        tasks.push({
          id: taskId,
          title: fullTitle,
          category: taskCat,
          durationSize: duration <= 25 ? 'small' : duration <= 60 ? 'medium' : 'large',
          durationMinutes: duration,
          frequency: 'high',
          period: 'day',
          dailyCount: 1, // 1日の中で組み込む
          startDay: isWeekday ? colInfo.dayIndex : undefined,
          deadlineDay: isWeekday ? colInfo.dayIndex : undefined,
          cycleIndex: isCycle ? colInfo.cycleIndex : undefined,
          cycleCount: isCycle ? cycleCount : undefined,
          priority: 'medium',
          completed: false,
          sourceTableId: table.id,
          sourceTableName: table.name,
        });
      } else {
        // 週（週次タスク / 3日周期）として生成: 週に複数回組み込まれる可能性があるもの
        const taskId = `task-table-${table.id}-${r}-${c}`;
        const duration = table.axisConfig.periodMinutes || 60;
        const taskCat: TaskCategory =
          rawCategory === 'workout'
            ? 'workout'
            : rawCategory === 'study' || rawCategory === 'lecture'
            ? 'study'
            : rawCategory === 'work'
            ? 'work'
            : rawCategory === 'hobby'
            ? 'hobby'
            : 'want';

        const cycleIdx = isCycle ? colInfo.cycleIndex! : c;

        tasks.push({
          id: taskId,
          title: fullTitle,
          category: taskCat,
          durationSize: duration <= 25 ? 'small' : duration <= 60 ? 'medium' : 'large',
          durationMinutes: duration,
          frequency: isWeekday ? 'medium' : 'custom',
          frequencyCount: isWeekday ? undefined : Math.min(table.numCols, 4),
          cycleIndex: cycleIdx,
          cycleCount: cycleCount,
          period: 'week',
          startDay: isWeekday ? colInfo.dayIndex : undefined,
          deadlineDay: isWeekday ? colInfo.dayIndex : undefined,
          priority: 'medium',
          completed: false,
          sourceTableId: table.id,
          sourceTableName: table.name,
        });
      }

      // 付随タスク（セル個別設定 または 表全体設定）の生成
      const cellAttached = cell.attachedTask;
      const isAttachedEnabled = cellAttached?.enabled ?? attachedConfig?.enabled ?? false;

      if (isAttachedEnabled) {
        const attachedTitleTemplate =
          cellAttached?.title || attachedConfig?.titleTemplate || '{title} の記録・確認';
        const attachedDuration =
          cellAttached?.durationMinutes || attachedConfig?.durationMinutes || 15;
        const attachedTaskTitle = attachedTitleTemplate.replace('{title}', title);
        const attachedTaskId = `task-attached-${table.id}-${r}-${c}`;

        if (classification === 'fixed_slot') {
          // 固定枠（講義・バイト等）の場合は週次タスク（課題・準備など）
          const deadlineDay = isWeekday ? (colInfo.dayIndex! - 1 + 7) % 7 : undefined;
          tasks.push({
            id: attachedTaskId,
            title: attachedTaskTitle,
            category: 'must',
            durationSize: attachedDuration <= 25 ? 'small' : 'medium',
            durationMinutes: attachedDuration,
            frequency: 'low',
            taskType: 'assignment',
            startDay: isWeekday ? colInfo.dayIndex : undefined,
            deadlineDay,
            priority: 'high',
            period: 'week',
            completed: false,
            sourceTableId: table.id,
            sourceTableName: table.name,
          });
        } else {
          // 日課や週次タスクの場合は、同日の事後タスク（プロテイン摂取など）
          tasks.push({
            id: attachedTaskId,
            title: attachedTaskTitle,
            category: 'want',
            durationSize: 'small',
            durationMinutes: attachedDuration,
            frequency: classification === 'daily_task' ? 'high' : 'medium',
            period: classification === 'daily_task' ? 'day' : 'week',
            dailyCount: classification === 'daily_task' ? 1 : undefined,
            startDay: isWeekday ? colInfo.dayIndex : undefined,
            deadlineDay: isWeekday ? colInfo.dayIndex : undefined,
            cycleIndex: isCycle ? colInfo.cycleIndex : undefined,
            cycleCount: isCycle ? cycleCount : undefined,
            priority: 'medium',
            completed: false,
            sourceTableId: table.id,
            sourceTableName: table.name,
          });
        }
      }
    });
  });

  return {
    slots,
    tasks,
    slotIds: slots.map((s) => s.id),
    taskIds: tasks.map((t) => t.id),
  };
}
