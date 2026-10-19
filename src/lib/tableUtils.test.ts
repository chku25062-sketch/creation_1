import { describe, it, expect } from 'vitest';
import {
  getTableClassification,
  addRowToTable,
  removeRowFromTable,
  addColToTable,
  removeColFromTable,
  generateScheduleItemsForTable,
} from './tableUtils';
import { ImportedTableData } from '@/types';

const createBaseTable = (startTime: string | null = '09:00'): ImportedTableData => ({
  id: 'test-table',
  name: 'テスト表',
  createdAt: '2026-10-19T00:00:00Z',
  updatedAt: '2026-10-19T00:00:00Z',
  numRows: 2,
  numCols: 2,
  colHeaders: ['月曜', '火曜'],
  rowHeaders: ['1', '2'],
  axisConfig: {
    startTime,
    periodMinutes: 90,
    intervalMinutes: 10,
    hasLunch: false,
    lunchAfterPeriod: 1,
    lunchMinutes: 50,
  },
  cells: [
    [
      {
        dayIndex: 0,
        periodIndex: 1,
        text: '胸トレ',
        rawLines: ['胸トレ'],
        fullText: '胸トレ',
        title: '胸トレ',
        roomOrNote: '',
        startMinutes: 540,
        endMinutes: 630,
      },
      {
        dayIndex: 1,
        periodIndex: 1,
        text: '',
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 540,
        endMinutes: 630,
      },
    ],
    [
      {
        dayIndex: 0,
        periodIndex: 2,
        text: '',
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 640,
        endMinutes: 730,
      },
      {
        dayIndex: 1,
        periodIndex: 2,
        text: '',
        rawLines: [],
        fullText: '',
        title: '',
        roomOrNote: '',
        startMinutes: 640,
        endMinutes: 730,
      },
    ],
  ],
});

describe('tableUtils', () => {
  it('correctly classifies fixed_slot when startTime is set', () => {
    const table = createBaseTable('09:00');
    expect(getTableClassification(table)).toBe('fixed_slot');
  });

  it('correctly classifies daily_task when startTime is null but weekdays are present', () => {
    const table = createBaseTable(null);
    expect(getTableClassification(table)).toBe('daily_task');
  });

  it('correctly classifies weekly_task when startTime is null and no weekdays in colHeaders', () => {
    const table = createBaseTable(null);
    table.colHeaders = ['タスク1', 'タスク2'];
    expect(getTableClassification(table)).toBe('weekly_task');
  });

  it('adds and removes rows', () => {
    const table = createBaseTable();
    const added = addRowToTable(table);
    expect(added.numRows).toBe(3);
    expect(added.cells.length).toBe(3);
    expect(added.rowHeaders).toEqual(['1', '2', '3']);

    const removed = removeRowFromTable(added);
    expect(removed.numRows).toBe(2);
    expect(removed.cells.length).toBe(2);
    expect(removed.rowHeaders).toEqual(['1', '2']);
  });

  it('adds and removes columns', () => {
    const table = createBaseTable();
    const added = addColToTable(table);
    expect(added.numCols).toBe(3);
    expect(added.colHeaders).toEqual(['月曜', '火曜', '水曜']);
    expect(added.cells[0].length).toBe(3);

    const removed = removeColFromTable(added);
    expect(removed.numCols).toBe(2);
    expect(removed.colHeaders).toEqual(['月曜', '火曜']);
    expect(removed.cells[0].length).toBe(2);
  });

  it('generates fixed slots and attached tasks when classified as fixed_slot', () => {
    const table = createBaseTable('09:00');
    table.attachedTaskConfig = {
      enabled: true,
      titleTemplate: '{title} レポート',
      durationMinutes: 45,
    };
    const res = generateScheduleItemsForTable(table);
    expect(res.slots.length).toBe(1);
    expect(res.slots[0].title).toBe('胸トレ');
    expect(res.slots[0].startMinutes).toBe(540);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('胸トレ レポート');
    expect(res.tasks[0].durationMinutes).toBe(45);
  });

  it('generates daily tasks and attached tasks when classified as daily_task', () => {
    const table = createBaseTable(null);
    table.attachedTaskConfig = {
      enabled: true,
      titleTemplate: '{title} プロテイン',
      durationMinutes: 15,
    };
    const res = generateScheduleItemsForTable(table);
    expect(res.slots.length).toBe(0);
    expect(res.tasks.length).toBe(2); // メインタスク + 付随タスク
    expect(res.tasks[0].title).toBe('胸トレ');
    expect(res.tasks[0].period).toBe('day');
    expect(res.tasks[0].startDay).toBe(0);
    expect(res.tasks[1].title).toBe('胸トレ プロテイン');
    expect(res.tasks[1].durationMinutes).toBe(15);
  });
});
