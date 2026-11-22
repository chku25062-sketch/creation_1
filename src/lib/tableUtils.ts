import {
  ImportedTableData,
  TableClassification,
  TableColumnMode,
  GridCell,
  FixedSlot,
  TaskItem,
} from '@/types';
import { calculatePeriodTimes, timeStringToMinutes, minutesToTimeString, PeriodTimeSlot } from './timeUtils';

const WEEKDAY_NAMES = [
  '月曜',
  '火曜',
  '水曜',
  '木曜',
  '金曜',
  '土曜',
  '日曜',
  '月',
  '火',
  '水',
  '木',
  '金',
  '土',
  '日',
];

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
export function parseColHeader(header: string, _defaultIndex?: number): ParsedColHeader {
  void _defaultIndex;
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
  const dayMatch = hLower.match(/^(?:day|d)\s*[-_:]?\s*(\d+)$/i) || h.match(/^(\d+)\s*日目?$/);
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
 * - 固定枠: 固定配置（placementMode === 'fixed'）または開始時刻が設定されているもの
 * - 週タスク: 自動配置（placementMode === 'auto'）で週の回数（weeklyRepeatCount）が指定されているもの「のみ」
 * - 日課タスク: 自動配置で週の回数が指定されていないもの（未指定・auto）
 */
export function getTableClassification(table: ImportedTableData): TableClassification {
  if (table.classificationOverride) {
    return table.classificationOverride;
  }

  // ★ 固定配置がオン（'fixed'）の場合、固定枠に割り当て
  // placementMode が未指定の場合は、後方互換性のため startTime の有無で判定
  const isFixed =
    table.placementMode === 'fixed' ||
    (table.placementMode === undefined &&
      table.axisConfig.startTime !== null &&
      table.axisConfig.startTime !== undefined &&
      table.axisConfig.startTime !== 'unset' &&
      table.axisConfig.startTime !== '未設定' &&
      table.axisConfig.startTime !== '自動' &&
      table.axisConfig.startTime !== 'auto');

  if (isFixed) {
    return 'fixed_slot';
  }

  // ★ 自動配置の場合: 週の回数（weeklyRepeatCount）が指定されているもの「のみ」を週タスクとして定義
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
 * 表内の行を開始時間順（時系列昇順: 早朝 → 夜）に自動ソート
 * 各行のセルから代表開始時刻を取得し、早い順に並び替える。
 * 開始時刻未指定の行は末尾に配置。
 */
export function sortRowsByTime(table: ImportedTableData): ImportedTableData {
  if (table.numRows <= 1) return table;

  // 各行の代表開始時刻（分）と元のインデックスを計算
  const rowData = table.cells.map((rowCells, origIdx) => {
    let earliestMin = Infinity;

    for (const cell of rowCells) {
      if (!cell.text || cell.text.trim() === '') continue;

      if (cell.customStartTime) {
        const m = timeStringToMinutes(cell.customStartTime);
        if (m < earliestMin) earliestMin = m;
      } else if (cell.startMinutes !== undefined && cell.startMinutes > 0) {
        if (cell.startMinutes < earliestMin) earliestMin = cell.startMinutes;
      }
    }

    // もし有効なテキストセルがなくても、セル自体にcustomStartTimeがある場合
    if (earliestMin === Infinity) {
      for (const cell of rowCells) {
        if (cell.customStartTime) {
          const m = timeStringToMinutes(cell.customStartTime);
          if (m < earliestMin) earliestMin = m;
        }
      }
    }

    return {
      origIdx,
      rowCells,
      earliestMin,
    };
  });

  // 昇順ソート（earliestMinが小さい順、同着なら元のインデックス順を維持）
  rowData.sort((a, b) => {
    if (a.earliestMin !== b.earliestMin) {
      return a.earliestMin - b.earliestMin;
    }
    return a.origIdx - b.origIdx;
  });

  // すでにソート済みか確認（変更がなければオブジェクト参照を維持）
  const isUnchanged = rowData.every((item, idx) => item.origIdx === idx);
  if (isUnchanged) return table;

  // 新しいセル配列（periodIndexを新しい行番号に更新）
  const nextCells = rowData.map((item, newRowIdx) =>
    item.rowCells.map((cell) => ({
      ...cell,
      periodIndex: newRowIdx + 1,
    }))
  );

  // 行ヘッダーの扱い: 通常の連番なら連番のまま、カスタム名なら行と一緒に並び替え
  const isDefaultNumberedHeaders = table.rowHeaders.every((h, idx) => h === `${idx + 1}`);
  const nextRowHeaders = isDefaultNumberedHeaders
    ? nextCells.map((_, idx) => `${idx + 1}`)
    : rowData.map((item) => table.rowHeaders[item.origIdx] || `${item.origIdx + 1}`);

  return {
    ...table,
    cells: nextCells,
    rowHeaders: nextRowHeaders,
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
export function generateScheduleItemsForTable(
  table: ImportedTableData,
): TableScheduleGenerationResult {
  const classification = getTableClassification(table);
  const columnMode = getTableColumnMode(table);
  const slotMap = new Map<string, FixedSlot>();
  const taskMap = new Map<string, TaskItem>();
  const attachedTaskMap = new Map<string, TaskItem>();

  const tablePeriodTimes =
    classification === 'fixed_slot' ? calculatePeriodTimes(table.numRows, table.axisConfig) : [];

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
    : table.numCols > 1
      ? table.numCols
      : 1;

  const tableCategory = table.name || '表タスク';
  const cycleStartDay =
    typeof table.cycleStartDay === 'number' && !isNaN(table.cycleStartDay)
      ? ((table.cycleStartDay % 7) + 7) % 7
      : 0;

  // 日課タスクの各列（各日）ごとの出現回数を正確に集計するためのマップ
  const dailyTaskColOccurrences = new Map<string, Map<number, number>>();

  const tableStartTimeMinutes =
    table.axisConfig.startTime &&
    table.axisConfig.startTime !== 'unset' &&
    table.axisConfig.startTime !== '未設定' &&
    table.axisConfig.startTime !== '自動' &&
    table.axisConfig.startTime !== 'auto'
      ? timeStringToMinutes(table.axisConfig.startTime)
      : undefined;

  const tableEndTimeMinutes =
    table.axisConfig.endTime &&
    table.axisConfig.endTime !== 'unset' &&
    table.axisConfig.endTime !== '未設定' &&
    table.axisConfig.endTime !== '自動' &&
    table.axisConfig.endTime !== 'auto'
      ? timeStringToMinutes(table.axisConfig.endTime)
      : undefined;

  const isAutoRange = tableStartTimeMinutes !== undefined || tableEndTimeMinutes !== undefined;

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

      const isWeekday =
        !isCycleMode && colInfo.type === 'weekday' && colInfo.dayIndex !== undefined;
      const effectiveWeekday =
        isWeekday && colInfo.dayIndex !== undefined
          ? (colInfo.dayIndex + cycleStartDay) % 7
          : undefined;
      const isCycle = isCycleMode;
      const cycleIdx = colInfo.cycleIndex !== undefined ? colInfo.cycleIndex : c;

      // ★ このセルまたは表全体の有効な休憩時間（分）
      // セル個別の breakMinutes があれば優先、なければ表全体の規定（昼休みコマなら昼休み、それ以外は intervalMinutes）を採用
      const isLunchAfterPeriod =
        Boolean(table.axisConfig.hasLunch) &&
        table.axisConfig.lunchAfterPeriod === (r + 1);

      const tableBreakFallback = isLunchAfterPeriod
        ? (table.axisConfig.lunchMinutes ?? 50)
        : table.axisConfig.intervalMinutes;

      const effectiveBreakMinutes =
        cell.breakMinutes !== undefined && cell.breakMinutes > 0
          ? cell.breakMinutes
          : tableBreakFallback !== null &&
              tableBreakFallback !== undefined &&
              tableBreakFallback > 0
            ? tableBreakFallback
            : undefined;

      if (classification === 'fixed_slot') {
        // 固定枠として生成 (開始時刻・終了時刻あり)
        // 終了時刻上限チェック: コマの終了時刻が表の終了時刻（tableEndTimeMinutes）を超える場合は配置しない
        if (
          tableEndTimeMinutes !== undefined &&
          timeSlot &&
          timeSlot.endMinutes > tableEndTimeMinutes
        ) {
          return;
        }

        // 同じ時限（時間帯）かつ同じタイトルのセルは、曜日（daysOfWeek）を結合して1つのスロットに集約
        if (timeSlot && (timeSlot.startMinutes > 0 || timeSlot.endMinutes > 0)) {
          let days: number[];
          if (isWeekday && effectiveWeekday !== undefined) {
            days = [effectiveWeekday];
          } else if (isCycle) {
            if (cycleCount === 1) {
              // 1日分のみのサイクル（毎日同じ固定枠）は全曜日に配置
              days = [0, 1, 2, 3, 4, 5, 6];
            } else {
              days = [0, 1, 2, 3, 4, 5, 6].filter(
                (d) => ((d - cycleStartDay + 7) % 7) % cycleCount === cycleIdx % cycleCount,
              );
            }
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
              existingSlot.breakMinutes = Math.max(
                existingSlot.breakMinutes || 0,
                effectiveBreakMinutes,
              );
            }
            if (cell.url && !existingSlot.url) {
              existingSlot.url = cell.url;
            }
          } else {
            const slotId = `slot-table-${table.id}-${r}-${c}`;
            const slotStart =
              timeSlot.startMinutes >= 1440 ? timeSlot.startMinutes % 1440 : timeSlot.startMinutes;
            const slotEnd =
              timeSlot.endMinutes > 1440 ? timeSlot.endMinutes % 1440 : timeSlot.endMinutes;

            slotMap.set(slotKey, {
              id: slotId,
              title: fullTitle,
              category: tableCategory, // 表の名前でカテゴリを代用
              startMinutes: slotStart,
              endMinutes: slotEnd,
              breakMinutes: effectiveBreakMinutes,
              color: '#0284c7',
              daysOfWeek: days,
              sourceTableId: table.id,
              sourceTableName: table.name,
              url: cell.url || undefined,
            });
          }
        }
      } else if (classification === 'daily_task') {
        // 日（日のタスク）: 表の列の要素がその日の中で繰り返されるもの
        // 表データに「1日の中の繰り返し回数」が指定されていればその値、自動なら同一列（同日）内の重複出現回数の最大値を集計
        const tableDailyCount =
          table.dailyRepeatCount && table.dailyRepeatCount !== 'auto'
            ? Number(table.dailyRepeatCount)
            : undefined;

        const taskKey = fullTitle;
        const existing = taskMap.get(taskKey);

        let colMap = dailyTaskColOccurrences.get(taskKey);
        if (!colMap) {
          colMap = new Map<number, number>();
          dailyTaskColOccurrences.set(taskKey, colMap);
        }
        colMap.set(c, (colMap.get(c) || 0) + 1);
        const maxColCount = Math.max(...Array.from(colMap.values()));

        if (existing) {
          if (!tableDailyCount) {
            existing.dailyRepeatMode = 'auto';
            // 曜日・周期列（各列が異なる日）の場合は同日内（列内）の最大出現回数、フリー列（1日の中の時間帯等）の場合は表内総出現回数
            existing.dailyCount = isWeekday || isCycle ? maxColCount : (existing.dailyCount || 1) + 1;
          } else {
            existing.dailyCount = tableDailyCount;
            existing.dailyRepeatMode = 'custom';
          }
          if (tableStartTimeMinutes !== undefined) {
            existing.earliestStartTime = tableStartTimeMinutes;
          }
          if (tableEndTimeMinutes !== undefined) {
            existing.latestEndTime = tableEndTimeMinutes;
          }
          if (isAutoRange) {
            existing.autoPlaceWithinRange = true;
          }
          if (effectiveBreakMinutes !== undefined) {
            existing.breakMinutes = Math.max(existing.breakMinutes || 0, effectiveBreakMinutes);
          }
          if (isWeekday && effectiveWeekday !== undefined) {
            const curDays = existing.targetDays || [];
            if (!curDays.includes(effectiveWeekday)) {
              existing.targetDays = [...curDays, effectiveWeekday].sort((a, b) => a - b);
            }
          } else if (isCycle) {
            const curCycles = existing.cycleDays || [];
            if (!curCycles.includes(cycleIdx)) {
              existing.cycleDays = [...curCycles, cycleIdx].sort((a, b) => a - b);
            }
          }
        } else {
          const taskId = `task-table-${table.id}-${r}-${c}`;
          const cellCustomStart = cell.customStartTime ? timeStringToMinutes(cell.customStartTime) : undefined;
          const duration =
            cell.customDurationMinutes && cell.customDurationMinutes > 0
              ? cell.customDurationMinutes
              : cell.endMinutes !== undefined &&
                cell.startMinutes !== undefined &&
                cell.endMinutes > cell.startMinutes
                ? cell.endMinutes - cell.startMinutes
                : table.axisConfig.periodMinutes || 30;

          taskMap.set(taskKey, {
            id: taskId,
            title: fullTitle,
            category: tableCategory, // 表の名前でカテゴリを代用
            durationSize: duration <= 25 ? 'small' : duration <= 60 ? 'medium' : 'large',
            durationMinutes: duration,
            breakMinutes: effectiveBreakMinutes,
            frequency: 'high',
            period: 'day',
            dailyCount: tableDailyCount ?? maxColCount,
            dailyRepeatMode: tableDailyCount ? 'custom' : 'auto',
            targetDays:
              isWeekday && effectiveWeekday !== undefined ? [effectiveWeekday] : undefined,
            startDay: isWeekday ? effectiveWeekday : undefined,
            deadlineDay: undefined,
            cycleDays: isCycle ? [cycleIdx] : undefined,
            cycleIndex: isCycle ? cycleIdx : undefined,
            cycleCount: isCycle ? cycleCount : undefined,
            cycleStartDay: table.cycleStartDay,
            cycleStartDate: table.cycleStartDate,
            earliestStartTime: cellCustomStart ?? tableStartTimeMinutes,
            latestEndTime: tableEndTimeMinutes,
            autoPlaceWithinRange: isAutoRange,
            priority: 'medium',
            completed: false,
            sourceTableId: table.id,
            sourceTableName: table.name,
            url: cell.url || undefined,
          });
        }
      } else {
        // 週（週のタスク）: 表の列の要素が、日ごとに繰り返されるもの
        // 同じ表の中で同じタイトルのセルは、複数のday（targetDays / cycleDays）を登録して1つのタスクに集約
        const taskKey = fullTitle;
        const existing = taskMap.get(taskKey);

        const effectiveWeeklyCount =
          cell.targetWeeklyCount !== undefined && cell.targetWeeklyCount > 0
            ? cell.targetWeeklyCount
            : table.weeklyRepeatCount && table.weeklyRepeatCount !== 'auto'
              ? Number(table.weeklyRepeatCount)
              : undefined;

        const tableDailyCount =
          table.dailyRepeatCount && table.dailyRepeatCount !== 'auto'
            ? Number(table.dailyRepeatCount)
            : undefined;

        if (existing) {
          if (tableStartTimeMinutes !== undefined) {
            existing.earliestStartTime = tableStartTimeMinutes;
          }
          if (tableEndTimeMinutes !== undefined) {
            existing.latestEndTime = tableEndTimeMinutes;
          }
          if (isAutoRange) {
            existing.autoPlaceWithinRange = true;
          }
          if (effectiveBreakMinutes !== undefined) {
            existing.breakMinutes = Math.max(existing.breakMinutes || 0, effectiveBreakMinutes);
          }
          if (cell.url && !existing.url) {
            existing.url = cell.url;
          }
          if (tableDailyCount) {
            existing.dailyCount = tableDailyCount;
            existing.dailyRepeatMode = 'custom';
          }
          if (effectiveWeeklyCount) {
            existing.frequency = 'custom';
            existing.frequencyCount = effectiveWeeklyCount;
          }
          if (isWeekday && effectiveWeekday !== undefined) {
            const curDays = existing.targetDays || [];
            if (!curDays.includes(effectiveWeekday)) {
              existing.targetDays = [...curDays, effectiveWeekday].sort((a, b) => a - b);
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
          const cellCustomStart = cell.customStartTime ? timeStringToMinutes(cell.customStartTime) : undefined;
          const duration =
            cell.customDurationMinutes && cell.customDurationMinutes > 0
              ? cell.customDurationMinutes
              : cell.endMinutes !== undefined &&
                cell.startMinutes !== undefined &&
                cell.endMinutes > cell.startMinutes
                ? cell.endMinutes - cell.startMinutes
                : table.axisConfig.periodMinutes || 60;

          taskMap.set(taskKey, {
            id: taskId,
            title: fullTitle,
            category: tableCategory, // 表の名前でカテゴリを代用
            durationSize: duration <= 25 ? 'small' : duration <= 60 ? 'medium' : 'large',
            durationMinutes: duration,
            breakMinutes: effectiveBreakMinutes,
            frequency: effectiveWeeklyCount ? 'custom' : 'medium',
            frequencyCount: effectiveWeeklyCount,
            dailyCount: tableDailyCount ?? 1,
            dailyRepeatMode: tableDailyCount ? 'custom' : 'auto',
            period: 'week',
            targetDays:
              isWeekday && effectiveWeekday !== undefined
                ? [effectiveWeekday]
                : !isCycle && !effectiveWeeklyCount
                  ? [0, 1, 2, 3, 4, 5, 6]
                  : undefined,
            cycleDays: isCycle ? [cycleIdx] : undefined,
            cycleCount: isCycle ? cycleCount : undefined,
            cycleStartDay: table.cycleStartDay,
            cycleStartDate: table.cycleStartDate,
            startDay: isWeekday ? effectiveWeekday : undefined,
            deadlineDay: undefined, // 表の列は開始/対象曜日であり、週タスクの締切ではない（他曜日への柔軟配置を許可）
            cycleIndex: isCycle ? cycleIdx : undefined,
            earliestStartTime: cellCustomStart ?? tableStartTimeMinutes,
            latestEndTime: tableEndTimeMinutes,
            autoPlaceWithinRange: isAutoRange,
            priority: 'medium',
            completed: false,
            sourceTableId: table.id,
            sourceTableName: table.name,
            url: cell.url || undefined,
            expiryWeeks:
              table.weeklyTaskExpiryWeeks ?? table.axisConfig?.weeklyTaskExpiryWeeks ?? 1,
          });
        }
      }

      // 付随タスク（セル個別設定 または 表全体設定）の生成
      const cellAttached = cell.attachedTask;
      const isAttachedEnabled = cellAttached?.enabled ?? attachedConfig?.enabled ?? false;
      if (isAttachedEnabled) {
        let attachedTitleTemplate =
          cellAttached?.title || attachedConfig?.titleTemplate || '{title} のタスク';

        // ★ 付随タスクの名称は「〜のタスク」に統一
        // 過去の保存データ等に「課題レポート」「記録」「準備」等が含まれていた場合でも "{title} のタスク" に自動正規化
        if (
          !attachedTitleTemplate ||
          attachedTitleTemplate.includes('課題レポート') ||
          attachedTitleTemplate.includes('記録') ||
          attachedTitleTemplate.includes('準備') ||
          attachedTitleTemplate.includes('確認') ||
          attachedTitleTemplate.trim() === ''
        ) {
          attachedTitleTemplate = '{title} のタスク';
        }

        const defaultCellDuration = timeSlot
          ? (timeSlot.endMinutes >= timeSlot.startMinutes
              ? timeSlot.endMinutes - timeSlot.startMinutes
              : 1440 - timeSlot.startMinutes + timeSlot.endMinutes)
          : (table.axisConfig.periodMinutes || 90);

        const attachedDuration =
          cellAttached?.durationMinutes || attachedConfig?.durationMinutes || defaultCellDuration;
        const attachedAllowSplit =
          cellAttached?.allowSplit ?? attachedConfig?.allowSplit ?? false;
        const attachedSplitCount =
          cellAttached?.splitCount ?? attachedConfig?.splitCount ?? 2;
        const attachedMinSplit =
          cellAttached?.minSplitMinutes ?? attachedConfig?.minSplitMinutes ?? 15;
        const attachedMaxSplits = attachedConfig?.maxSplits ?? 2;
        const attachedTaskTitle = attachedTitleTemplate.replace('{title}', fullTitle);
        const attachedKey = `${classification}_${attachedTaskTitle}`;

        if (!attachedTaskMap.has(attachedKey)) {
          const attachedTaskId = `task-attached-${table.id}-${r}-${c}`;

          if (classification === 'fixed_slot') {
            const parentEndMinutesByDay: Record<number, number> = {};
            let parentEnd: number | undefined = undefined;
            if (isWeekday && effectiveWeekday !== undefined && timeSlot) {
              parentEnd = timeSlot.endMinutes + (effectiveBreakMinutes || 0);
              parentEndMinutesByDay[effectiveWeekday] = parentEnd;
            }

            attachedTaskMap.set(attachedKey, {
              id: attachedTaskId,
              title: attachedTaskTitle,
              category: tableCategory, // 表の名前でカテゴリを代用
              durationSize: undefined, // 明示的な分数（durationMinutes）を尊重
              durationMinutes: attachedDuration,
              allowSplit: attachedAllowSplit,
              splitCount: attachedSplitCount,
              minSplitMinutes: attachedMinSplit,
              maxSplits: attachedMaxSplits,
              frequency: 'custom',
              frequencyCount: 1, // 週1回
              taskType: 'task',
              isAttachedTask: true,
              parentTitle: fullTitle,
              parentEndMinutesByDay,
              targetDays:
                isWeekday && effectiveWeekday !== undefined ? [effectiveWeekday] : undefined,
              startDay: isWeekday && effectiveWeekday !== undefined ? effectiveWeekday : undefined,
              // ★ 指定日時以降に配置（元タスクより後に時間を設定）
              scheduleAfterEnabled: true,
              scheduleAfterDay:
                isWeekday && effectiveWeekday !== undefined ? effectiveWeekday : undefined,
              scheduleAfterTime:
                parentEnd !== undefined ? minutesToTimeString(parentEnd) : undefined,
              earliestStartTime: parentEnd,
              priority: 'high',
              period: 'week', // 週のタスク
              dailyCount: 1, // 1日の中の繰り返しなし
              dailyRepeatMode: 'custom',
              completed: false,
              sourceTableId: table.id,
              sourceTableName: table.name,
              cycleStartDay: table.cycleStartDay,
              cycleStartDate: table.cycleStartDate,
              expiryWeeks:
                table.weeklyTaskExpiryWeeks ?? table.axisConfig?.weeklyTaskExpiryWeeks ?? 1,
            });
          } else {
            attachedTaskMap.set(attachedKey, {
              id: attachedTaskId,
              title: attachedTaskTitle,
              category: tableCategory, // 表の名前でカテゴリを代用
              durationSize: undefined, // 明示的な分数（durationMinutes）を尊重
              durationMinutes: attachedDuration,
              allowSplit: attachedAllowSplit,
              splitCount: attachedSplitCount,
              minSplitMinutes: attachedMinSplit,
              maxSplits: attachedMaxSplits,
              frequency: 'custom',
              frequencyCount: 1, // 週1回
              period: 'week', // 週のタスク
              dailyCount: 1, // 1日の中の繰り返しなし
              dailyRepeatMode: 'custom',
              targetDays:
                isWeekday && effectiveWeekday !== undefined ? [effectiveWeekday] : undefined,
              startDay: isWeekday && effectiveWeekday !== undefined ? effectiveWeekday : undefined,
              cycleDays: isCycle ? [cycleIdx] : undefined,
              cycleIndex: isCycle ? cycleIdx : undefined,
              cycleCount: isCycle ? cycleCount : undefined,
              cycleStartDay: table.cycleStartDay,
              cycleStartDate: table.cycleStartDate,
              isAttachedTask: true,
              parentTitle: fullTitle,
              taskType: 'task',
              priority: 'high',
              completed: false,
              sourceTableId: table.id,
              sourceTableName: table.name,
              expiryWeeks:
                table.weeklyTaskExpiryWeeks ?? table.axisConfig?.weeklyTaskExpiryWeeks ?? 1,
            });
          }
        } else {
          // 既存付随タスクの日程情報をマージ（週1回・日の繰り返しなしは維持）
          const existingAttached = attachedTaskMap.get(attachedKey)!;
          existingAttached.durationMinutes = attachedDuration;
          existingAttached.durationSize = undefined;
          if (attachedAllowSplit) existingAttached.allowSplit = true;
          if (attachedSplitCount) existingAttached.splitCount = attachedSplitCount;
          if (attachedMinSplit) existingAttached.minSplitMinutes = attachedMinSplit;
          if (attachedMaxSplits) existingAttached.maxSplits = attachedMaxSplits;
          if (classification === 'fixed_slot') {
            if (isWeekday && effectiveWeekday !== undefined) {
              const curDays = existingAttached.targetDays || [];
              if (!curDays.includes(effectiveWeekday)) {
                existingAttached.targetDays = [...curDays, effectiveWeekday].sort((a, b) => a - b);
              }
              if (timeSlot) {
                if (!existingAttached.parentEndMinutesByDay)
                  existingAttached.parentEndMinutesByDay = {};
                const endWithBreak = timeSlot.endMinutes + (effectiveBreakMinutes || 0);
                existingAttached.parentEndMinutesByDay[effectiveWeekday] = Math.max(
                  existingAttached.parentEndMinutesByDay[effectiveWeekday] || 0,
                  endWithBreak,
                );
                existingAttached.scheduleAfterEnabled = true;
                if (existingAttached.scheduleAfterDay === undefined) {
                  existingAttached.scheduleAfterDay = effectiveWeekday;
                }
                if (
                  existingAttached.earliestStartTime === undefined ||
                  endWithBreak > existingAttached.earliestStartTime
                ) {
                  existingAttached.earliestStartTime = endWithBreak;
                  existingAttached.scheduleAfterTime = minutesToTimeString(endWithBreak);
                }
              }
            }
          } else if (classification === 'daily_task') {
            // 週1・日繰り返しなしを維持
            existingAttached.dailyCount = 1;
            existingAttached.dailyRepeatMode = 'custom';
            existingAttached.frequencyCount = 1;
            existingAttached.period = 'week';
          } else {
            if (isWeekday && effectiveWeekday !== undefined) {
              const curDays = existingAttached.targetDays || [];
              if (!curDays.includes(effectiveWeekday)) {
                existingAttached.targetDays = [...curDays, effectiveWeekday].sort((a, b) => a - b);
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
        task.frequency = task.cycleDays.length >= Math.ceil(cycleCount * 0.7) ? 'high' : 'medium';
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

/**
 * 表データ・行・セルから、そのコマに適用されるデフォルトの所要時間（分）を取得する
/**
 * 表データ・行・セルから、そのコマに適用されるデフォルトのコマ分数（所要時間）を取得する
 * 純粋に表の設定（または行設定）から計算される規定値を取得する。
 * 優先順位:
 * 1. 行の計算済みスロットがある場合、その差分（> 0 のときのみ）
 * 2. customRowTimes がある場合、その差分
 * 3. セル固有の開始・終了分がある場合、その差分
 * 4. 表全体のコマ分数（axisConfig.periodMinutes）
 * 5. 表の分類に応じたフォールバック（daily: 30分, weekly: 60分, fixed: 90分）
 */
export function getCellDefaultDuration(
  table: ImportedTableData,
  r: number,
  c?: number,
  periodTimes?: PeriodTimeSlot[],
): number {
  // 行の計算済みスロットがある場合、その差分（> 0 のときのみ）
  if (periodTimes && periodTimes[r]) {
    const diff = periodTimes[r].endMinutes - periodTimes[r].startMinutes;
    if (diff > 0) return diff;
  }

  // customRowTimes がある場合
  const customRow = table.axisConfig.customRowTimes?.[r + 1];
  if (customRow && customRow.startMinutes !== undefined && customRow.endMinutes !== undefined) {
    const diff = customRow.endMinutes - customRow.startMinutes;
    if (diff > 0) return diff;
  }

  // セル固有の開始・終了分（グリッド上の時間）がある場合
  const cell = c !== undefined && table.cells[r] ? table.cells[r][c] : undefined;
  if (cell && cell.startMinutes !== undefined && cell.endMinutes !== undefined) {
    const diff = cell.endMinutes - cell.startMinutes;
    if (diff > 0) return diff;
  }

  // 表全体のコマ分数
  if (
    table.axisConfig.periodMinutes !== null &&
    table.axisConfig.periodMinutes !== undefined &&
    table.axisConfig.periodMinutes > 0
  ) {
    return table.axisConfig.periodMinutes;
  }

  // 表の分類に応じたフォールバック
  const classification = getTableClassification(table);
  if (classification === 'daily_task') return 30;
  if (classification === 'weekly_task') return 60;
  return 90;
}

/**
 * 表データ・行・セルから、そのコマに適用されるデフォルトの開始時刻（"HH:mm"）を取得する
 * 純粋に表の設定（または行設定）から計算される規定開始時刻を取得する。
 * 優先順位:
 * 1. 行の計算済みスロットの startTime（有効な場合）
 * 2. customRowTimes の startMinutes
 * 3. セル固有の startMinutes
 * 4. 表全体の axisConfig.startTime（有効な場合）
 * 5. "09:00"
 */
export function getCellDefaultStartTime(
  table: ImportedTableData,
  r: number,
  c?: number,
  periodTimes?: PeriodTimeSlot[],
): { startTime: string; hasExplicitTime: boolean } {
  // 行の計算済みスロットの startTime が空でなければ使用
  if (periodTimes && periodTimes[r] && periodTimes[r].startTime && periodTimes[r].startTime.trim()) {
    return { startTime: periodTimes[r].startTime, hasExplicitTime: true };
  }

  // customRowTimes
  const customRow = table.axisConfig.customRowTimes?.[r + 1];
  if (customRow && customRow.startMinutes !== undefined) {
    return { startTime: minutesToTimeString(customRow.startMinutes), hasExplicitTime: true };
  }

  // セル固有
  const cell = c !== undefined && table.cells[r] ? table.cells[r][c] : undefined;
  if (cell && cell.startMinutes !== undefined && cell.startMinutes > 0) {
    return { startTime: minutesToTimeString(cell.startMinutes), hasExplicitTime: true };
  }

  // 表全体の開始時刻
  const axisStart = table.axisConfig.startTime;
  if (
    axisStart &&
    axisStart !== 'auto' &&
    axisStart !== 'unset' &&
    axisStart !== '未設定' &&
    axisStart !== '自動'
  ) {
    return { startTime: axisStart, hasExplicitTime: true };
  }

  return { startTime: '09:00', hasExplicitTime: false };
}
