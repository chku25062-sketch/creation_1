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

const WEEKDAY_NAMES = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];

/**
 * 表データが「固定枠」「日課タスク」「週次タスク」のどれに分類されるかを判定
 */
export function getTableClassification(table: ImportedTableData): TableClassification {
  const isStartTimeUnset = !table.axisConfig.startTime || table.axisConfig.startTime === 'unset';

  if (isStartTimeUnset) {
    // 曜日ヘッダー（月曜〜日曜）が1つでも有効に含まれているか
    const hasWeekdays = table.colHeaders.some((h) => WEEKDAY_NAMES.includes(h));
    return hasWeekdays ? 'daily_task' : 'weekly_task';
  }

  // 開始時刻が指定されている場合は固定枠
  return 'fixed_slot';
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

  table.cells.forEach((row, r) => {
    const timeSlot = tablePeriodTimes[r];

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

      if (!cell.title || !cell.title.trim()) return;

      const title = cell.title.trim();
      const rawCategory = cell.category || (classification === 'fixed_slot' ? 'lecture' : 'routine');
      const fullTitle = cell.roomOrNote
        ? `${title} (${cell.roomOrNote.replace(/\n/g, ' ')})`
        : title;

      if (classification === 'fixed_slot') {
        // 固定枠として生成 (開始時刻・終了時刻あり)
        if (dayIdx >= 0 && timeSlot && (timeSlot.startMinutes > 0 || timeSlot.endMinutes > 0)) {
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
            daysOfWeek: [dayIdx],
            sourceTableId: table.id,
            sourceTableName: table.name,
          });
        }
      } else if (classification === 'daily_task') {
        // 日課タスクとして生成 (特定曜日の空き枠に自動組み込み)
        if (dayIdx >= 0) {
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
            startDay: dayIdx,
            deadlineDay: dayIdx,
            priority: 'medium',
            completed: false,
            sourceTableId: table.id,
            sourceTableName: table.name,
          });
        }
      } else {
        // 週次タスクとして生成 (週全体の空き枠に自動配分)
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

        tasks.push({
          id: taskId,
          title: fullTitle,
          category: taskCat,
          durationSize: duration <= 25 ? 'small' : duration <= 60 ? 'medium' : 'large',
          durationMinutes: duration,
          frequency: 'low',
          period: 'week',
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
          const deadlineDay = dayIdx >= 0 ? (dayIdx - 1 + 7) % 7 : undefined;
          tasks.push({
            id: attachedTaskId,
            title: attachedTaskTitle,
            category: 'must',
            durationSize: attachedDuration <= 25 ? 'small' : 'medium',
            durationMinutes: attachedDuration,
            frequency: 'low',
            taskType: 'assignment',
            startDay: dayIdx >= 0 ? dayIdx : undefined,
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
            frequency: classification === 'daily_task' ? 'high' : 'low',
            period: classification === 'daily_task' ? 'day' : 'week',
            startDay: dayIdx >= 0 ? dayIdx : undefined,
            deadlineDay: dayIdx >= 0 ? dayIdx : undefined,
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
