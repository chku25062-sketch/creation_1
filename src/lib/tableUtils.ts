import {
  ImportedTableData,
  TableClassification,
  TableColumnMode,
  GridCell,
  FixedSlot,
  TaskItem,
  FixedCategory,
  TaskCategory,
} from '@/types';
import { calculatePeriodTimes } from './timeUtils';

const WEEKDAY_NAMES = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜', '月', '火', '水', '木', '金', '土', '日'];
const CYCLE_KEYWORDS = ['day', 'サイクル', '周期', '分割', 'rot', 'part'];

/**
 * 表が「曜日で管理」か「周期で管理」かを判定
 */
export function getTableColumnMode(table: ImportedTableData): TableColumnMode {
  if (table.columnMode) {
    return table.columnMode;
  }
  const hasCycleHeader = table.colHeaders.some((h) => {
    const parsed = parseColHeader(h, 0);
    return parsed.type === 'cycle';
  });
  return hasCycleHeader ? 'cycle' : 'weekday';
}

/**
 * 表の列管理方式（曜日 ⇄ 周期）を切り替え、列ヘッダーとセルの dayIndex を一括変換
 */
export function setTableColumnMode(
  table: ImportedTableData,
  mode: TableColumnMode,
): ImportedTableData {
  const nextHeaders = table.colHeaders.map((h, idx) => {
    if (h === '除外') return '除外';
    if (mode === 'cycle') {
      return `Day ${idx + 1}`;
    } else {
      return idx < 7 ? WEEKDAY_NAMES[idx] : `列 ${idx + 1}`;
    }
  });

  const nextCells = table.cells.map((row) =>
    row.map((cell, cIdx) => ({
      ...cell,
      dayIndex: mode === 'cycle' ? cIdx : cIdx < 7 ? cIdx : 0,
    })),
  );

  return {
    ...table,
    columnMode: mode,
    colHeaders: nextHeaders,
    cells: nextCells,
    updatedAt: new Date().toISOString(),
  };
}

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
  const dayMatch =
    hLower.match(/^(?:day|d)\s*[-_:]?\s*(\d+)$/i) || h.match(/^(\d+)\s*日目?$/);
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
 * 表データが「固定枠」「日課タスク」「週タスク」のどれに分類されるかを判定
 * - 固定枠: 開始時刻が設定されているもの
 * - 週タスク: 週の回数（weeklyRepeatCount）が指定されているもの「のみ」
 * - 日課タスク: 週の回数が指定されていないもの（未指定・auto）
 */
export function getTableClassification(table: ImportedTableData): TableClassification {
  if (table.classificationOverride) {
    return table.classificationOverride;
  }

  const isStartTimeUnset = !table.axisConfig.startTime || table.axisConfig.startTime === 'unset';
  if (!isStartTimeUnset) {
    return 'fixed_slot';
  }

  // ★ 週の回数（weeklyRepeatCount）が指定されているもの「のみ」を週タスクとして定義
  if (
    table.weeklyRepeatCount !== undefined &&
    table.weeklyRepeatCount !== 'auto' &&
    typeof table.weeklyRepeatCount === 'number' &&
    table.weeklyRepeatCount > 0
  ) {
    return 'weekly_task';
  }

  // ★ 週の回数が指定されていないものはすべて日課タスク
  return 'daily_task';
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
/**
 * 表に新しい列を右端に追加 (曜日モードなら曜日名、周期モードならDay番号)
 */
export function addColToTable(table: ImportedTableData): ImportedTableData {
  const newColIdx = table.numCols;
  const mode = getTableColumnMode(table);
  const nextHeader =
    mode === 'cycle'
      ? `Day ${newColIdx + 1}`
      : newColIdx < 7
        ? WEEKDAY_NAMES[newColIdx]
        : `列 ${newColIdx + 1}`;

  const nextCells = table.cells.map((row, rIdx) => [
    ...row,
    {
      dayIndex: mode === 'cycle' ? newColIdx : newColIdx < 7 ? newColIdx : 0,
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

/**
 * 表の行数を直接指定された数値（1〜50）にリサイズ
 */
export function setTableNumRows(table: ImportedTableData, targetRows: number): ImportedTableData {
  const safeTarget = Math.max(1, Math.min(50, targetRows));
  let current = table;
  while (current.numRows < safeTarget) {
    current = addRowToTable(current);
  }
  while (current.numRows > safeTarget) {
    current = removeRowFromTable(current);
  }
  return current;
}

/**
 * 表の列数を直接指定された数値（1〜30）にリサイズ
 */
export function setTableNumCols(table: ImportedTableData, targetCols: number): ImportedTableData {
  const safeTarget = Math.max(1, Math.min(30, targetCols));
  let current = table;
  while (current.numCols < safeTarget) {
    current = addColToTable(current);
  }
  while (current.numCols > safeTarget) {
    current = removeColFromTable(current);
  }
  return current;
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
 * - 周期管理モードまたは周期列がある場合、空列があっても総列数 (cycleCount) に含め、
 *   その日はタスクが生成されない「何もしない日（オフ日）」として成立させる
 */
export function generateScheduleItemsForTable(table: ImportedTableData): TableScheduleGenerationResult {
  const classification = getTableClassification(table);
  const columnMode = getTableColumnMode(table);
  const slotMap = new Map<string, FixedSlot>();
  const taskMap = new Map<string, TaskItem>();
  const attachedTaskMap = new Map<string, TaskItem>();

  const tablePeriodTimes =
    classification === 'fixed_slot'
      ? calculatePeriodTimes(table.numRows, table.axisConfig)
      : [];

  const attachedConfig = table.attachedTaskConfig;

  // 各列の属性（曜日、周期、フリー、除外）を事前解析
  const parsedCols = table.colHeaders.map((h, idx) => parseColHeader(h, idx));
  const nonExcludedCols = parsedCols.filter((p) => p.type !== 'excluded');
  const isCycleMode = columnMode === 'cycle' || parsedCols.some((p) => p.type === 'cycle');

  // 周期全体の長さ (cycleCount):
  // 周期管理モードの場合は空列（オフ日）も周期日数としてカウントするため、除外列以外の列総数とする
  // 列が1つ（Day 1のみ等）の場合は1日周期（毎日繰り返し）とする
  const cycleCount = isCycleMode
    ? Math.max(1, nonExcludedCols.length)
    : (table.numCols > 1 ? table.numCols : 1);

  const tableCategory = table.name || '表タスク';

  table.cells.forEach((row, r) => {
    const timeSlot = tablePeriodTimes[r];

    row.forEach((cell, c) => {
      const colInfo = parsedCols[c] || { type: 'free' as ColHeaderType, label: '' };
      if (colInfo.type === 'excluded') return;

      if (!cell.title || !cell.title.trim()) return;

      const title = cell.title.trim();
      const fullTitle = cell.roomOrNote
        ? `${title} (${cell.roomOrNote.replace(/\n/g, ' ')})`
        : title;

      const isWeekday = !isCycleMode && colInfo.type === 'weekday' && colInfo.dayIndex !== undefined;
      const isCycle = isCycleMode;
      const cycleIdx = colInfo.cycleIndex !== undefined ? colInfo.cycleIndex : c;

      // ★ このセルまたは表全体の有効な休憩時間（分）
      // セル個別の breakMinutes があれば優先、なければ表全体の axisConfig.intervalMinutes を採用
      const effectiveBreakMinutes =
        cell.breakMinutes !== undefined && cell.breakMinutes > 0
          ? cell.breakMinutes
          : table.axisConfig.intervalMinutes !== null &&
              table.axisConfig.intervalMinutes !== undefined &&
              table.axisConfig.intervalMinutes > 0
            ? table.axisConfig.intervalMinutes
            : undefined;

      if (classification === 'fixed_slot') {
        // 固定枠として生成 (開始時刻・終了時刻あり)
        // 同じ時限（時間帯）かつ同じタイトルのセルは、曜日（daysOfWeek）を結合して1つのスロットに集約
        if (timeSlot && (timeSlot.startMinutes > 0 || timeSlot.endMinutes > 0)) {
          let days: number[] = [];
          if (isWeekday) {
            days = [colInfo.dayIndex!];
          } else if (isCycle) {
            days = [0, 1, 2, 3, 4, 5, 6].filter(
              (d) => d % cycleCount === (cycleIdx % cycleCount),
            );
          } else {
            days = [0, 1, 2, 3, 4, 5, 6];
          }

          const slotKey = `${r}_${fullTitle}`;
          const existingSlot = slotMap.get(slotKey);

          if (existingSlot) {
            existingSlot.daysOfWeek = Array.from(
              new Set([...(existingSlot.daysOfWeek || []), ...days]),
            ).sort((a, b) => a - b);
            if (effectiveBreakMinutes !== undefined) {
              existingSlot.breakMinutes = Math.max(existingSlot.breakMinutes || 0, effectiveBreakMinutes);
            }
          } else {
            const slotId = `slot-table-${table.id}-${r}-${c}`;
            slotMap.set(slotKey, {
              id: slotId,
              title: fullTitle,
              category: tableCategory, // 表の名前でカテゴリを代用
              startMinutes: timeSlot.startMinutes,
              endMinutes: timeSlot.endMinutes,
              breakMinutes: effectiveBreakMinutes,
              color: '#0284c7',
              daysOfWeek: days,
              sourceTableId: table.id,
              sourceTableName: table.name,
            });
          }
        }
      } else if (classification === 'daily_task') {
        // 日（日のタスク）: 表の列の要素がその日の中で繰り返されるもの
        // 表データに「1日の中の繰り返し回数」が指定されていればその値、自動なら表内の重複出現回数を集計
        const tableDailyCount =
          table.dailyRepeatCount && table.dailyRepeatCount !== 'auto'
            ? Number(table.dailyRepeatCount)
            : undefined;

        const taskKey = fullTitle;
        const existing = taskMap.get(taskKey);

        if (existing) {
          if (!tableDailyCount) {
            existing.dailyRepeatMode = 'auto';
            existing.dailyCount = (existing.dailyCount || 1) + 1;
          } else {
            existing.dailyCount = tableDailyCount;
            existing.dailyRepeatMode = 'custom';
          }
          if (effectiveBreakMinutes !== undefined) {
            existing.breakMinutes = Math.max(existing.breakMinutes || 0, effectiveBreakMinutes);
          }
          if (isWeekday && colInfo.dayIndex !== undefined) {
            const curDays = existing.targetDays || [];
            if (!curDays.includes(colInfo.dayIndex)) {
              existing.targetDays = [...curDays, colInfo.dayIndex].sort((a, b) => a - b);
            }
          } else if (isCycle) {
            const curCycles = existing.cycleDays || [];
            if (!curCycles.includes(cycleIdx)) {
              existing.cycleDays = [...curCycles, cycleIdx].sort((a, b) => a - b);
            }
          }
        } else {
          const taskId = `task-table-${table.id}-${r}-${c}`;
          const duration = table.axisConfig.periodMinutes || 30;

          taskMap.set(taskKey, {
            id: taskId,
            title: fullTitle,
            category: tableCategory, // 表の名前でカテゴリを代用
            durationSize: duration <= 25 ? 'small' : duration <= 60 ? 'medium' : 'large',
            durationMinutes: duration,
            breakMinutes: effectiveBreakMinutes,
            frequency: 'high',
            period: 'day',
            dailyCount: tableDailyCount ?? 1,
            dailyRepeatMode: tableDailyCount ? 'custom' : 'auto',
            targetDays: isWeekday ? [colInfo.dayIndex!] : undefined,
            startDay: isWeekday ? colInfo.dayIndex : undefined,
            deadlineDay: isWeekday ? colInfo.dayIndex : undefined,
            cycleDays: isCycle ? [cycleIdx] : undefined,
            cycleIndex: isCycle ? cycleIdx : undefined,
            cycleCount: isCycle ? cycleCount : undefined,
            priority: 'medium',
            completed: false,
            sourceTableId: table.id,
            sourceTableName: table.name,
          });
        }
      } else {
        // 週（週のタスク）: 表の列の要素が、日ごとに繰り返されるもの
        // 同じ表の中で同じタイトルのセルは、複数のday（targetDays / cycleDays）を登録して1つのタスクに集約
        const taskKey = fullTitle;
        const existing = taskMap.get(taskKey);

        const tableWeeklyCount =
          table.weeklyRepeatCount && table.weeklyRepeatCount !== 'auto'
            ? Number(table.weeklyRepeatCount)
            : undefined;

        const tableDailyCount =
          table.dailyRepeatCount && table.dailyRepeatCount !== 'auto'
            ? Number(table.dailyRepeatCount)
            : undefined;

        if (existing) {
          if (effectiveBreakMinutes !== undefined) {
            existing.breakMinutes = Math.max(existing.breakMinutes || 0, effectiveBreakMinutes);
          }
          if (tableDailyCount) {
            existing.dailyCount = tableDailyCount;
            existing.dailyRepeatMode = 'custom';
          }
          if (tableWeeklyCount) {
            existing.frequency = 'custom';
            existing.frequencyCount = tableWeeklyCount;
          }
          if (isWeekday && colInfo.dayIndex !== undefined) {
            const curDays = existing.targetDays || [];
            if (!curDays.includes(colInfo.dayIndex)) {
              existing.targetDays = [...curDays, colInfo.dayIndex].sort((a, b) => a - b);
              existing.startDay = existing.targetDays[0];
            }
          } else if (isCycle) {
            const curCycles = existing.cycleDays || [];
            if (!curCycles.includes(cycleIdx)) {
              existing.cycleDays = [...curCycles, cycleIdx].sort((a, b) => a - b);
              existing.cycleIndex = existing.cycleDays[0];
            }
          }
        } else {
          const taskId = `task-table-${table.id}-${r}-${c}`;
          const duration = table.axisConfig.periodMinutes || 60;

          taskMap.set(taskKey, {
            id: taskId,
            title: fullTitle,
            category: tableCategory, // 表の名前でカテゴリを代用
            durationSize: duration <= 25 ? 'small' : duration <= 60 ? 'medium' : 'large',
            durationMinutes: duration,
            breakMinutes: effectiveBreakMinutes,
            frequency: tableWeeklyCount ? 'custom' : 'medium',
            frequencyCount: tableWeeklyCount,
            dailyCount: tableDailyCount ?? 1,
            dailyRepeatMode: tableDailyCount ? 'custom' : 'auto',
            period: 'week',
            targetDays: isWeekday
              ? [colInfo.dayIndex!]
              : (!isCycle && !tableWeeklyCount ? [0, 1, 2, 3, 4, 5, 6] : undefined),
            cycleDays: isCycle ? [cycleIdx] : undefined,
            cycleCount: isCycle ? cycleCount : undefined,
            startDay: isWeekday ? colInfo.dayIndex : undefined,
            deadlineDay: isWeekday ? colInfo.dayIndex : undefined,
            cycleIndex: isCycle ? cycleIdx : undefined,
            priority: 'medium',
            completed: false,
            sourceTableId: table.id,
            sourceTableName: table.name,
          });
        }
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
        const attachedKey = `${classification}_${attachedTaskTitle}`;

        if (!attachedTaskMap.has(attachedKey)) {
          const attachedTaskId = `task-attached-${table.id}-${r}-${c}`;

          if (classification === 'fixed_slot') {
            const deadlineDay = isWeekday ? (colInfo.dayIndex! - 1 + 7) % 7 : undefined;
            attachedTaskMap.set(attachedKey, {
              id: attachedTaskId,
              title: attachedTaskTitle,
              category: tableCategory, // 表の名前でカテゴリを代用
              durationSize: attachedDuration <= 25 ? 'small' : 'medium',
              durationMinutes: attachedDuration,
              frequency: 'low',
              taskType: 'assignment',
              startDay: isWeekday ? colInfo.dayIndex : undefined,
              targetDays: isWeekday ? [colInfo.dayIndex!] : undefined,
              deadlineDay,
              priority: 'high',
              period: 'week',
              completed: false,
              sourceTableId: table.id,
              sourceTableName: table.name,
            });
          } else {
            attachedTaskMap.set(attachedKey, {
              id: attachedTaskId,
              title: attachedTaskTitle,
              category: tableCategory, // 表の名前でカテゴリを代用
              durationSize: 'small',
              durationMinutes: attachedDuration,
              frequency: classification === 'daily_task' ? 'high' : 'medium',
              period: classification === 'daily_task' ? 'day' : 'week',
              dailyCount: classification === 'daily_task' ? 1 : undefined,
              targetDays: isWeekday ? [colInfo.dayIndex!] : undefined,
              startDay: isWeekday ? colInfo.dayIndex : undefined,
              deadlineDay: isWeekday ? colInfo.dayIndex : undefined,
              cycleDays: isCycle ? [cycleIdx] : undefined,
              cycleIndex: isCycle ? cycleIdx : undefined,
              cycleCount: isCycle ? cycleCount : undefined,
              priority: 'medium',
              completed: false,
              sourceTableId: table.id,
              sourceTableName: table.name,
            });
          }
        } else {
          // 既存付随タスクの日程情報をマージ
          const existingAttached = attachedTaskMap.get(attachedKey)!;
          if (classification === 'daily_task') {
            existingAttached.dailyCount = (existingAttached.dailyCount || 1) + 1;
          } else {
            if (isWeekday && colInfo.dayIndex !== undefined) {
              const curDays = existingAttached.targetDays || [];
              if (!curDays.includes(colInfo.dayIndex)) {
                existingAttached.targetDays = [...curDays, colInfo.dayIndex].sort((a, b) => a - b);
              }
            } else if (isCycle) {
              const curCycles = existingAttached.cycleDays || [];
              if (!curCycles.includes(cycleIdx)) {
                existingAttached.cycleDays = [...curCycles, cycleIdx].sort((a, b) => a - b);
              }
            }
          }
        }
      }
    });
  });

  // 週次タスクの頻度をマージ結果に基づいて更新（カスタム回数指定がない場合のみ）
  taskMap.forEach((task) => {
    if (task.period === 'week' && task.frequency !== 'custom') {
      if (task.targetDays && task.targetDays.length > 0) {
        task.frequencyCount = task.targetDays.length;
        task.frequency =
          task.targetDays.length >= 5 ? 'high' : task.targetDays.length >= 3 ? 'medium' : 'low';
      } else if (task.cycleDays && task.cycleDays.length > 0) {
        task.frequencyCount = task.cycleDays.length;
        task.frequency =
          task.cycleDays.length >= Math.ceil(cycleCount * 0.7) ? 'high' : 'medium';
      }
    }
  });

  const slots = Array.from(slotMap.values());
  const tasks = [...Array.from(taskMap.values()), ...Array.from(attachedTaskMap.values())];

  return {
    slots,
    tasks,
    slotIds: slots.map((s) => s.id),
    taskIds: tasks.map((t) => t.id),
  };
}
