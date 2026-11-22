import { describe, it, expect } from 'vitest';
import {
  getTableClassification,
  getTableColumnMode,
  setTableColumnMode,
  addRowToTable,
  removeRowFromTable,
  removeRowAtIndex,
  setTableNumRows,
  addColToTable,
  removeColFromTable,
  removeColAtIndex,
  setTableNumCols,
  generateScheduleItemsForTable,
  parseColHeader,
  sortRowsByTime,
  getCellDefaultDuration,
  getCellDefaultStartTime,
} from './tableUtils';
import { ImportedTableData } from '@/types';
import { INITIAL_IMPORTED_TABLES, INITIAL_TASKS, INITIAL_FIXED_SLOTS } from './storage';

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

  it('correctly classifies daily_task when headers or name represent daily timeframe', () => {
    const table = createBaseTable(null);
    table.name = '1日のルーティン';
    table.colHeaders = ['朝', '昼'];
    expect(getTableClassification(table)).toBe('daily_task');
  });

  it('correctly classifies daily_task when weeklyRepeatCount is not specified', () => {
    const table = createBaseTable(null);
    table.colHeaders = ['Day 1', 'Day 2', 'Day 3'];
    expect(getTableClassification(table)).toBe('daily_task');

    const weekdayTable = createBaseTable(null);
    weekdayTable.colHeaders = ['月曜', '火曜'];
    expect(getTableClassification(weekdayTable)).toBe('daily_task');
  });

  it('correctly classifies weekly_task only when weeklyRepeatCount is explicitly set (> 0)', () => {
    const table = createBaseTable(null);
    table.weeklyRepeatCount = 3;
    expect(getTableClassification(table)).toBe('weekly_task');
  });

  it('honors classificationOverride when specified', () => {
    const table = createBaseTable('09:00');
    table.classificationOverride = 'daily_task';
    expect(getTableClassification(table)).toBe('daily_task');
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

  it('generates daily tasks with dailyCount when classified as daily_task', () => {
    const table = createBaseTable(null);
    table.colHeaders = ['朝', '夜'];
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
    expect(res.tasks[0].dailyCount).toBe(1);
    expect(res.tasks[1].title).toBe('胸トレ プロテイン');
    expect(res.tasks[1].durationMinutes).toBe(15);
  });

  it('generates weekly tasks with cycleIndex when classified as weekly_task (3-day cycle)', () => {
    const table = createBaseTable(null);
    table.colHeaders = ['Day 1', 'Day 2'];
    table.weeklyRepeatCount = 3;
    const res = generateScheduleItemsForTable(table);
    expect(res.slots.length).toBe(0);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('胸トレ');
    expect(res.tasks[0].period).toBe('week');
    expect(res.tasks[0].cycleIndex).toBe(0);
  });

  it('correctly parses column headers with parseColHeader', () => {
    expect(parseColHeader('月曜', 0)).toEqual({ type: 'weekday', dayIndex: 0, label: '月曜' });
    expect(parseColHeader('金', 4)).toEqual({ type: 'weekday', dayIndex: 4, label: '金' });
    expect(parseColHeader('Day 1', 0)).toEqual({ type: 'cycle', cycleIndex: 0, label: 'Day 1' });
    expect(parseColHeader('Day 3', 2)).toEqual({ type: 'cycle', cycleIndex: 2, label: 'Day 3' });
    expect(parseColHeader('サイクル2', 1)).toEqual({
      type: 'cycle',
      cycleIndex: 1,
      label: 'サイクル2',
    });
    expect(parseColHeader('A日', 0)).toEqual({ type: 'cycle', cycleIndex: 0, label: 'A日' });
    expect(parseColHeader('フリー', 0)).toEqual({ type: 'free', label: 'フリー' });
    expect(parseColHeader('除外', 0)).toEqual({ type: 'excluded', label: '除外' });
  });

  it('removes row and column at specific index', () => {
    const table = createBaseTable();
    const addedRow = addRowToTable(table); // 3 rows
    const removedRow = removeRowAtIndex(addedRow, 1); // remove row index 1
    expect(removedRow.numRows).toBe(2);
    expect(removedRow.cells.length).toBe(2);

    const addedCol = addColToTable(table); // 3 cols
    const removedCol = removeColAtIndex(addedCol, 0); // remove col index 0
    expect(removedCol.numCols).toBe(2);
    expect(removedCol.colHeaders).toEqual(['火曜', '水曜']);
  });

  it('generates weekday-specific daily tasks when daily table has weekday headers', () => {
    const table = createBaseTable(null);
    table.classificationOverride = 'daily_task';
    table.colHeaders = ['月曜', '火曜'];
    const res = generateScheduleItemsForTable(table);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].period).toBe('day');
    expect(res.tasks[0].startDay).toBe(0); // 月曜限定日課
    expect(res.tasks[0].cycleIndex).toBeUndefined();
  });

  it('generates cyclic daily tasks when daily table has Day headers', () => {
    const table = createBaseTable(null);
    table.classificationOverride = 'daily_task';
    table.colHeaders = ['Day 1', 'Day 2', 'Day 3'];
    const res = generateScheduleItemsForTable(table);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].period).toBe('day');
    expect(res.tasks[0].cycleIndex).toBe(0);
    expect(res.tasks[0].cycleCount).toBe(3);
    expect(res.tasks[0].startDay).toBeUndefined(); // 周期ローテーション日課
  });

  it('generates free daily tasks for single-column list tables', () => {
    const table = createBaseTable(null);
    table.classificationOverride = 'daily_task';
    table.numCols = 1;
    table.colHeaders = ['タスク一覧'];
    table.cells = table.cells.map((row) => row.slice(0, 1));
    const res = generateScheduleItemsForTable(table);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].period).toBe('day');
    expect(res.tasks[0].startDay).toBeUndefined();
    expect(res.tasks[0].cycleIndex).toBeUndefined();
  });

  it('correctly handles columnMode toggling with getTableColumnMode and setTableColumnMode', () => {
    const table = createBaseTable();
    expect(getTableColumnMode(table)).toBe('weekday');

    const cycleTable = setTableColumnMode(table, 'cycle');
    expect(cycleTable.columnMode).toBe('cycle');
    expect(cycleTable.colHeaders).toEqual(['Day 1', 'Day 2']);
    expect(getTableColumnMode(cycleTable)).toBe('cycle');

    const weekdayTable = setTableColumnMode(cycleTable, 'weekday');
    expect(weekdayTable.columnMode).toBe('weekday');
    expect(weekdayTable.colHeaders).toEqual(['月曜', '火曜']);
    expect(getTableColumnMode(weekdayTable)).toBe('weekday');
  });

  it('treats empty columns in a cyclic table as rest days (maintains total cycle length)', () => {
    // 4日周期: Day 1 (胸), Day 2 (背中), Day 3 (空列・何もしないオフ日), Day 4 (脚)
    const table = createBaseTable(null);
    table.columnMode = 'cycle';
    table.classificationOverride = 'daily_task';
    table.numCols = 4;
    table.colHeaders = ['Day 1', 'Day 2', 'Day 3', 'Day 4'];
    table.cells = [
      [
        { ...table.cells[0][0], title: '胸トレ', dayIndex: 0 },
        { ...table.cells[0][1], title: '背中トレ', dayIndex: 1 },
        { ...table.cells[0][0], title: '', text: null, dayIndex: 2 }, // 空列！
        { ...table.cells[0][1], title: '脚トレ', dayIndex: 3 },
      ],
    ];

    const res = generateScheduleItemsForTable(table);
    // 空列にはタスクが生成されないためタスク数は 3 件
    expect(res.tasks.length).toBe(3);

    // 全てのタスクが 4日周期 (cycleCount: 4) を保持していること
    expect(res.tasks[0].title).toBe('胸トレ');
    expect(res.tasks[0].cycleIndex).toBe(0);
    expect(res.tasks[0].cycleCount).toBe(4);

    expect(res.tasks[1].title).toBe('背中トレ');
    expect(res.tasks[1].cycleIndex).toBe(1);
    expect(res.tasks[1].cycleCount).toBe(4);

    expect(res.tasks[2].title).toBe('脚トレ');
    expect(res.tasks[2].cycleIndex).toBe(3); // 4日目の位置 (index 3)
    expect(res.tasks[2].cycleCount).toBe(4);
  });

  it('uses table name as category for all generated slots, tasks, and attached tasks', () => {
    const table = createBaseTable('09:00');
    table.name = '筋トレルーティン表';
    table.attachedTaskConfig = {
      enabled: true,
      titleTemplate: '{title} プロテイン',
      durationMinutes: 10,
    };

    const res = generateScheduleItemsForTable(table);
    expect(res.slots.length).toBe(1);
    expect(res.slots[0].category).toBe('筋トレルーティン表');

    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].category).toBe('筋トレルーティン表');

    // 日課タスク
    const dailyTable = createBaseTable(null);
    dailyTable.name = '日課表';
    dailyTable.classificationOverride = 'daily_task';
    const dailyRes = generateScheduleItemsForTable(dailyTable);
    expect(dailyRes.tasks[0].category).toBe('日課表');
  });

  it('aggregates same-title weekly tasks across multiple weekdays into a single task with targetDays', () => {
    // 週のタスク: 表の列の要素が日ごとに繰り返される
    // 月曜と木曜（2列）に「胸トレ」
    const table = createBaseTable(null);
    table.weeklyRepeatCount = 2;
    table.numCols = 4;
    table.colHeaders = ['月曜', '火曜', '水曜', '木曜'];
    table.cells = [
      [
        { ...table.cells[0][0], title: '胸トレ', dayIndex: 0 },
        { ...table.cells[0][1], title: '', dayIndex: 1 },
        { ...table.cells[0][0], title: '', dayIndex: 2 },
        { ...table.cells[0][1], title: '胸トレ', dayIndex: 3 }, // 木曜にも「胸トレ」
      ],
    ];

    const res = generateScheduleItemsForTable(table);
    // 同一名のタスクは1つにマージされるためタスク数は1件
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('胸トレ');
    expect(res.tasks[0].targetDays).toEqual([0, 3]);
    expect(res.tasks[0].frequencyCount).toBe(2);
  });

  it('aggregates same-title weekly tasks across multiple cycle days into a single task with cycleDays', () => {
    // 3日周期表: Day 1 と Day 3 に「腹筋」
    const table = createBaseTable(null);
    table.weeklyRepeatCount = 2;
    table.columnMode = 'cycle';
    table.numCols = 3;
    table.colHeaders = ['Day 1', 'Day 2', 'Day 3'];
    table.cells = [
      [
        { ...table.cells[0][0], title: '腹筋', dayIndex: 0 },
        { ...table.cells[0][1], title: '背中', dayIndex: 1 },
        { ...table.cells[0][0], title: '腹筋', dayIndex: 2 }, // Day 3 にも「腹筋」
      ],
    ];

    const res = generateScheduleItemsForTable(table);
    // 「腹筋」と「背中」の2タスク
    expect(res.tasks.length).toBe(2);
    const abTask = res.tasks.find((t) => t.title === '腹筋')!;
    expect(abTask).toBeDefined();
    expect(abTask.cycleDays).toEqual([0, 2]);
    expect(abTask.cycleCount).toBe(3);
    expect(abTask.frequencyCount).toBe(2);
  });

  it('aggregates same-title daily tasks within a day into a single task with dailyCount', () => {
    // 日のタスク: 表の列の要素がその日の中で繰り返される (朝・昼・夜)
    // 朝と夜に同じ「プロテイン」
    const table = createBaseTable(null);
    table.classificationOverride = 'daily_task';
    table.numCols = 3;
    table.colHeaders = ['朝', '昼', '夜'];
    table.cells = [
      [
        { ...table.cells[0][0], title: 'プロテイン', dayIndex: 0 },
        { ...table.cells[0][1], title: '昼寝', dayIndex: 1 },
        { ...table.cells[0][0], title: 'プロテイン', dayIndex: 2 }, // 夜にも「プロテイン」
      ],
    ];

    const res = generateScheduleItemsForTable(table);
    expect(res.tasks.length).toBe(2);
    const proteinTask = res.tasks.find((t) => t.title === 'プロテイン')!;
    expect(proteinTask).toBeDefined();
    expect(proteinTask.period).toBe('day');
    expect(proteinTask.dailyCount).toBe(2); // 朝と夜で1日2回！
  });

  it('aggregates fixed slots at the same period with same title across weekdays into daysOfWeek', () => {
    // 固定枠: 1限に月曜と水曜の両方「英語講義」
    const table = createBaseTable('09:00');
    table.numCols = 3;
    table.colHeaders = ['月曜', '火曜', '水曜'];
    table.cells = [
      [
        { ...table.cells[0][0], title: '英語講義', dayIndex: 0 },
        { ...table.cells[0][1], title: '', dayIndex: 1 },
        { ...table.cells[0][0], title: '英語講義', dayIndex: 2 }, // 水曜1限にも「英語講義」
      ],
    ];

    const res = generateScheduleItemsForTable(table);
    expect(res.slots.length).toBe(1);
    expect(res.slots[0].title).toBe('英語講義');
    expect(res.slots[0].daysOfWeek).toEqual([0, 2]); // 月曜と水曜
  });

  it('respects table dailyRepeatCount when explicitly set to a number', () => {
    const table = createBaseTable(null);
    table.classificationOverride = 'daily_task';
    table.dailyRepeatCount = 3; // 1日3回を明示指定
    table.cells[0][0].title = 'ストレッチ';

    const res = generateScheduleItemsForTable(table);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('ストレッチ');
    expect(res.tasks[0].dailyCount).toBe(3);
    expect(res.tasks[0].dailyRepeatMode).toBe('custom');
  });

  it('defaults to auto repeat count when dailyRepeatCount is auto or unset', () => {
    const table = createBaseTable(null);
    table.classificationOverride = 'daily_task';
    table.dailyRepeatCount = 'auto'; // デフォルト「自動」
    table.cells[0][0].title = '瞑想';

    const res = generateScheduleItemsForTable(table);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('瞑想');
    expect(res.tasks[0].dailyCount).toBe(1);
    expect(res.tasks[0].dailyRepeatMode).toBe('auto');
  });

  it('表全体の intervalMinutes がタスクの breakMinutes に正しく反映されること', () => {
    const table = createBaseTable(null);
    table.classificationOverride = 'daily_task';
    table.axisConfig.intervalMinutes = 10; // 表全体の休憩時間 10分
    table.cells[0][0].title = '読書';

    const res = generateScheduleItemsForTable(table);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('読書');
    expect(res.tasks[0].breakMinutes).toBe(10);
  });

  it('セル個別の breakMinutes が表全体の intervalMinutes より優先して反映されること', () => {
    const table = createBaseTable(null);
    table.classificationOverride = 'weekly_task';
    table.axisConfig.intervalMinutes = 10;
    table.cells[0][0].title = 'プログラミング';
    table.cells[0][0].breakMinutes = 20; // セル個別で20分

    const res = generateScheduleItemsForTable(table);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('プログラミング');
    expect(res.tasks[0].breakMinutes).toBe(20);
  });

  it('固定枠 (fixed_slot) にも intervalMinutes / breakMinutes が反映されること', () => {
    const table = createBaseTable('09:00');
    table.axisConfig.intervalMinutes = 15;
    table.cells[0][0].title = '数学講義';

    const res = generateScheduleItemsForTable(table);
    expect(res.slots.length).toBe(1);
    expect(res.slots[0].title).toBe('数学講義');
    expect(res.slots[0].breakMinutes).toBe(15);
  });

  describe('setTableNumRows and setTableNumCols', () => {
    it('行数を直接指定して増減できること', () => {
      const table = createBaseTable();
      expect(table.numRows).toBe(2);

      const expanded = setTableNumRows(table, 5);
      expect(expanded.numRows).toBe(5);
      expect(expanded.cells.length).toBe(5);

      const shrunk = setTableNumRows(expanded, 3);
      expect(shrunk.numRows).toBe(3);
      expect(shrunk.cells.length).toBe(3);
    });

    it('列数を直接指定して増減できること', () => {
      const table = createBaseTable();
      expect(table.numCols).toBe(2);

      const expanded = setTableNumCols(table, 6);
      expect(expanded.numCols).toBe(6);
      expect(expanded.colHeaders.length).toBe(6);

      const shrunk = setTableNumCols(expanded, 1);
      expect(shrunk.numCols).toBe(1);
      expect(shrunk.colHeaders.length).toBe(1);
    });
  });

  describe('1列のDay 1指定による毎日の繰り返し', () => {
    it('列1つでDay 1のみのタスク表はcycleCountが1（毎日繰り返し）になること', () => {
      const table = createBaseTable(null);
      table.numCols = 1;
      table.colHeaders = ['Day 1'];
      table.cells = [
        [
          {
            ...table.cells[0][0],
            title: '筋トレ',
          },
        ],
      ];

      const res = generateScheduleItemsForTable(table);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].cycleDays).toEqual([0]);
      expect(res.tasks[0].cycleCount).toBe(1);
    });

    it('列1つでday1（小文字）のみの固定枠表は全曜日（毎日）に反映されること', () => {
      const table = createBaseTable('09:00');
      table.numCols = 1;
      table.colHeaders = ['day1'];
      table.cells = [
        [
          {
            ...table.cells[0][0],
            title: '朝礼',
          },
        ],
      ];

      const res = generateScheduleItemsForTable(table);
      expect(res.slots.length).toBe(1);
      expect(res.slots[0].daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });

  describe('週の回数 (weeklyRepeatCount) による分類とタスク生成', () => {
    it('表名が日課風でも weeklyRepeatCount が指定されていれば weekly_task に分類されること', () => {
      const table = createBaseTable(null);
      table.name = '毎日のルーティン表'; // 日課系キーワードを含む表名
      table.weeklyRepeatCount = 3;

      const classification = getTableClassification(table);
      expect(classification).toBe('weekly_task');
    });

    it('weeklyRepeatCount が指定された表から生成されたタスクに frequencyCount が反映されること', () => {
      const table = createBaseTable(null);
      table.weeklyRepeatCount = 4;
      table.cells[0][0].title = 'ランニング';

      const res = generateScheduleItemsForTable(table);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].frequency).toBe('custom');
      expect(res.tasks[0].frequencyCount).toBe(4);
    });

    it('weeklyRepeatCount が auto の場合は表名やヘッダーによる通常判定に戻ること', () => {
      const table = createBaseTable(null);
      table.name = '毎日の朝ルーティン';
      table.colHeaders = ['朝', '昼'];
      table.weeklyRepeatCount = 'auto';

      const classification = getTableClassification(table);
      expect(classification).toBe('daily_task');
    });
  });

  describe('終了時刻 (endTime / latestEndTime) の反映と制限', () => {
    it('固定枠で endTime が指定された場合、終了時刻を超えるコマ（行）は配置されないこと', () => {
      // 09:00開始、1コマ90分、休憩10分 ➔
      // 1コマ目: 09:00〜10:30 (540〜630分)
      // 2コマ目: 10:40〜12:10 (640〜730分)
      const table = createBaseTable('09:00');
      // 終了時刻を 11:00 (660分) に指定 ➔ 2コマ目 (終了12:10) は除外される
      table.axisConfig.endTime = '11:00';

      const res = generateScheduleItemsForTable(table);
      // 1コマ目のみ配置される
      expect(res.slots.length).toBe(1);
      expect(res.slots[0].title).toBe('胸トレ');
      expect(res.slots[0].endMinutes).toBe(630);
    });

    it('日のタスク・週のタスクで endTime が指定された場合、生成されるタスクに latestEndTime が設定されること', () => {
      const table = createBaseTable(null);
      table.axisConfig.endTime = '18:00'; // 18:00 = 1080分
      table.weeklyRepeatCount = 3;

      const res = generateScheduleItemsForTable(table);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].latestEndTime).toBe(1080);
    });

    it('endTime が未設定または auto の場合、latestEndTime は undefined（24:00最大値まで）になること', () => {
      const table = createBaseTable(null);
      table.axisConfig.endTime = 'unset';

      const res = generateScheduleItemsForTable(table);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].latestEndTime).toBeUndefined();
    });
  });

  describe('付随タスクの名称統一と同一日連動', () => {
    it('付随タスクの名称はデフォルトで "{title} のタスク" に統一されること', () => {
      const table = createBaseTable('09:00');
      table.attachedTaskConfig = {
        enabled: true,
        titleTemplate: '', // 未指定
        durationMinutes: 15,
      };

      const res = generateScheduleItemsForTable(table);
      const attached = res.tasks.find((t) => t.isAttachedTask);
      expect(attached).toBeDefined();
      expect(attached!.title).toBe('胸トレ のタスク');
      expect(attached!.parentTitle).toBe('胸トレ');
      expect(attached!.targetDays).toEqual([0]); // 月曜（胸トレと同じ曜日）
      expect(attached!.parentEndMinutesByDay).toEqual({ 0: 640 }); // コマ終了630分 + 休憩10分 = 640分
    });

    it('古いテンプレート（課題レポート等）が設定されていても "{title} のタスク" に自動正規化されること', () => {
      const table = createBaseTable('09:00');
      table.attachedTaskConfig = {
        enabled: true,
        titleTemplate: '{title} の課題レポート',
        durationMinutes: 15,
      };

      const res = generateScheduleItemsForTable(table);
      const attached = res.tasks.find((t) => t.isAttachedTask);
      expect(attached).toBeDefined();
      expect(attached!.title).toBe('胸トレ のタスク');
    });

    it('表データで設定された付随タスクの分数（例: 45分）が正確に反映され、durationSizeが未定義であること', () => {
      const table = createBaseTable('09:00');
      table.attachedTaskConfig = {
        enabled: true,
        titleTemplate: '{title} のタスク',
        durationMinutes: 45,
      };

      const res = generateScheduleItemsForTable(table);
      const attached = res.tasks.find((t) => t.isAttachedTask);
      expect(attached).toBeDefined();
      expect(attached!.durationMinutes).toBe(45);
      expect(attached!.durationSize).toBeUndefined();
    });

    it('Plan16: 表データやセルで設定された付随タスクの分割設定（allowSplit, splitCount）が正しくタスクに反映されること', () => {
      const table = createBaseTable('09:00');
      table.attachedTaskConfig = {
        enabled: true,
        titleTemplate: '{title} のタスク',
        durationMinutes: 60,
        allowSplit: true,
        splitCount: 3,
        minSplitMinutes: 20,
        maxSplits: 3,
      };

      const res = generateScheduleItemsForTable(table);
      const attached = res.tasks.find((t) => t.isAttachedTask);
      expect(attached).toBeDefined();
      expect(attached!.allowSplit).toBe(true);
      expect(attached!.splitCount).toBe(3);
    });
  });

  describe('配置方式（placementMode: fixed / auto）による分類と指定区間タスク生成', () => {
    it('placementMode が fixed の場合、開始時刻が未設定でも fixed_slot に分類されること', () => {
      const table = createBaseTable(null); // startTime: null
      table.placementMode = 'fixed';
      expect(getTableClassification(table)).toBe('fixed_slot');
    });

    it('placementMode が auto の場合、開始時刻が設定されていても fixed_slot にならず、タスクに分類されること', () => {
      const table = createBaseTable('09:00');
      table.placementMode = 'auto';
      // weeklyRepeatCount が指定されていないので daily_task
      expect(getTableClassification(table)).toBe('daily_task');

      // weeklyRepeatCount が指定されていれば weekly_task
      table.weeklyRepeatCount = 3;
      expect(getTableClassification(table)).toBe('weekly_task');
    });

    it('placementMode が auto で開始・終了時刻が指定された場合、タスクに指定区間自動配置のオプションが付与されること', () => {
      const table = createBaseTable('09:00'); // 540分
      table.placementMode = 'auto';
      table.axisConfig.endTime = '18:00'; // 1080分
      table.weeklyRepeatCount = 2;

      const res = generateScheduleItemsForTable(table);
      expect(res.slots.length).toBe(0);
      expect(res.tasks.length).toBeGreaterThan(0);

      const task = res.tasks[0];
      expect(task.earliestStartTime).toBe(540);
      expect(task.latestEndTime).toBe(1080);
      expect(task.autoPlaceWithinRange).toBe(true);
    });
  });

  describe('Plan13: 周期の頭（cycleStartDay / cycleStartDate）の位置指定による曜日マッピング', () => {
    it('固定枠（fixed_slot）かつ周期管理の場合、cycleStartDay のオフセットに応じて daysOfWeek がシフトされること', () => {
      const table = createBaseTable('09:00');
      table.columnMode = 'cycle';
      table.numCols = 3;
      table.colHeaders = ['Day 1', 'Day 2', 'Day 3'];
      table.cycleStartDay = 2; // 水曜(2)を周期の頭（Day 1）に設定
      table.cycleStartDate = '2026-11-04';
      table.cells = [
        [
          { ...table.cells[0][0], title: '筋トレA', dayIndex: 0 },
          { ...table.cells[0][1], title: '', dayIndex: 1 },
          { ...table.cells[0][0], title: '', dayIndex: 2 },
        ],
      ];

      const res = generateScheduleItemsForTable(table);
      expect(res.slots.length).toBe(1);
      // Day 1 (cycleIdx=0, cycleCount=3), cycleStartDay=2 (水)
      // ((d - 2 + 7) % 7) % 3 === 0 となる曜日 d:
      // d=0(月): (5)%3=2, d=1(火): (6)%3=0, d=2(水): (0)%3=0, d=5(土): (3)%3=0 -> [1, 2, 5]
      expect(res.slots[0].daysOfWeek).toEqual([1, 2, 5]);
    });

    it('タスク生成時に cycleStartDay および cycleStartDate が TaskItem に引き継がれること', () => {
      const table = createBaseTable(null);
      table.columnMode = 'cycle';
      table.numCols = 3;
      table.colHeaders = ['Day 1', 'Day 2', 'Day 3'];
      table.cycleStartDay = 4; // 金曜(4)始まり
      table.cycleStartDate = '2026-11-06';
      table.cells = [
        [
          { ...table.cells[0][0], title: '有酸素運動', dayIndex: 0 },
          { ...table.cells[0][1], title: '', dayIndex: 1 },
          { ...table.cells[0][0], title: '', dayIndex: 2 },
        ],
      ];

      const res = generateScheduleItemsForTable(table);
      expect(res.tasks.length).toBe(1);
      expect(res.tasks[0].cycleStartDay).toBe(4);
      expect(res.tasks[0].cycleStartDate).toBe('2026-11-06');
      expect(res.tasks[0].cycleDays).toEqual([0]);
      expect(res.tasks[0].cycleCount).toBe(3);
    });
  });

  describe('デフォルトの表（授業・生活・日課・趣味）の初期化とスケジュール生成', () => {
    it('INITIAL_IMPORTED_TABLES に 授業・生活・日課・趣味 の4つの表が存在すること', () => {
      const names = INITIAL_IMPORTED_TABLES.map((t) => t.name);
      expect(names).toEqual(['授業', '生活', '日課', '趣味']);
    });

    it('古いデフォルトタスクおよび古い固定枠が INITIAL_TASKS / INITIAL_FIXED_SLOTS から消去されていること', () => {
      expect(INITIAL_TASKS).toEqual([]);
      expect(INITIAL_FIXED_SLOTS).toEqual([]);
    });

    it('各デフォルト表からスケジュールアイテムが正常に生成されること', () => {
      for (const table of INITIAL_IMPORTED_TABLES) {
        const { slots, tasks } = generateScheduleItemsForTable(table);
        const totalItems = slots.length + tasks.length;
        expect(totalItems).toBeGreaterThan(0);
      }
    });

    it('生活表から生成される固定枠が 朝食・昼食・夕食・睡眠 として正しく配置されること', () => {
      const lifestyleTable = INITIAL_IMPORTED_TABLES.find((t) => t.name === '生活')!;
      const { slots } = generateScheduleItemsForTable(lifestyleTable);
      expect(slots.length).toBe(4);

      const breakfast = slots.find((s) => s.title === '朝食')!;
      expect(breakfast.startMinutes).toBe(8 * 60); // 08:00
      expect(breakfast.endMinutes).toBe(8 * 60 + 30); // 08:30

      const lunch = slots.find((s) => s.title === '昼食')!;
      expect(lunch.startMinutes).toBe(12 * 60 + 10); // 12:10
      expect(lunch.endMinutes).toBe(13 * 60); // 13:00

      const dinner = slots.find((s) => s.title === '夕食')!;
      expect(dinner.startMinutes).toBe(19 * 60 + 30); // 19:30
      expect(dinner.endMinutes).toBe(20 * 60 + 30); // 20:30

      const sleep = slots.find((s) => s.title === '睡眠')!;
      expect(sleep.startMinutes).toBe(0); // 00:00
      expect(sleep.endMinutes).toBe(8 * 60); // 08:00
    });

    it('日課表（2日周期）から生成されるタスクが 2日ローテーション（Day 1: A,B,C / Day 2: D,E,F）の自動配分タスクになること', () => {
      const routineTable = INITIAL_IMPORTED_TABLES.find((t) => t.name === '日課')!;
      expect(routineTable.columnMode).toBe('cycle');
      expect(routineTable.numCols).toBe(2);
      expect(routineTable.colHeaders).toEqual(['Day 1', 'Day 2']);

      const { tasks } = generateScheduleItemsForTable(routineTable);
      expect(tasks.length).toBe(6);

      // Day 1 タスク群
      const day1Tasks = tasks.filter((t) => t.cycleIndex === 0);
      expect(day1Tasks.length).toBe(3);
      for (const t of day1Tasks) {
        expect(t.cycleCount).toBe(2);
        expect(t.period).toBe('day');
      }
      expect(day1Tasks.some((t) => t.title === '日課A (筋トレ・運動)')).toBe(true);
      expect(day1Tasks.some((t) => t.title === '日課B (英語・学習)')).toBe(true);
      expect(day1Tasks.some((t) => t.title === '日課C (片付け・整理)')).toBe(true);

      // Day 2 タスク群
      const day2Tasks = tasks.filter((t) => t.cycleIndex === 1);
      expect(day2Tasks.length).toBe(3);
      for (const t of day2Tasks) {
        expect(t.cycleCount).toBe(2);
        expect(t.period).toBe('day');
      }
      expect(day2Tasks.some((t) => t.title === '日課D (ストレッチ・休養)')).toBe(true);
      expect(day2Tasks.some((t) => t.title === '日課E (読書・教養)')).toBe(true);
      expect(day2Tasks.some((t) => t.title === '日課F (日記・振り返り)')).toBe(true);
    });

    it('趣味表（1日周期）から生成されるタスクが 1日1回・60分の自動配分タスクになること', () => {
      const hobbyTable = INITIAL_IMPORTED_TABLES.find((t) => t.name === '趣味')!;
      expect(hobbyTable.columnMode).toBe('cycle');
      expect(hobbyTable.numCols).toBe(1);
      expect(hobbyTable.colHeaders).toEqual(['Day 1']);
      expect(hobbyTable.dailyRepeatCount).toBe(1);

      const { tasks } = generateScheduleItemsForTable(hobbyTable);
      expect(tasks.length).toBe(1);

      const hobbyTask = tasks[0];
      expect(hobbyTask.title).toBe('自由時間・趣味');
      expect(hobbyTask.durationMinutes).toBe(60);
      expect(hobbyTask.dailyCount).toBe(1);
      expect(hobbyTask.cycleIndex).toBe(0);
      expect(hobbyTask.cycleCount).toBe(1);
    });

    it('授業表の付随タスク生成がオンになっており、各講義の終了後に付随タスクが生成されること', () => {
      const classesTable = INITIAL_IMPORTED_TABLES.find((t) => t.name === '授業')!;
      expect(classesTable.attachedTaskConfig?.enabled).toBe(true);
      const { tasks } = generateScheduleItemsForTable(classesTable);
      const attachedTasks = tasks.filter((t) => t.isAttachedTask);
      expect(attachedTasks.length).toBeGreaterThan(0);
      for (const t of attachedTasks) {
        expect(t.title).toMatch(/.* のタスク$/);
        expect(t.durationMinutes).toBe(90); // 元のコマと同じ90分
        expect(t.scheduleAfterEnabled).toBe(true);
      }
    });

    describe('sortRowsByTime (Plan23: 開始時間ごとの自動並び替え)', () => {
      it('バラバラの開始時刻を持つ行が、早い順（朝 → 昼 → 夜）に正しくソートされること', () => {
        const table: ImportedTableData = {
          id: 'test-sort',
          name: '日課テスト',
          createdAt: '2026-11-18T00:00:00Z',
          updatedAt: '2026-11-18T00:00:00Z',
          numRows: 3,
          numCols: 1,
          colHeaders: ['Day 1'],
          rowHeaders: ['1', '2', '3'],
          placementMode: 'auto',
          columnMode: 'cycle',
          dailyRepeatCount: 1,
          axisConfig: {
            startTime: null,
            endTime: null,
            periodMinutes: 30,
            intervalMinutes: 0,
            hasLunch: false,
            lunchAfterPeriod: 1,
            lunchMinutes: 50,
          },
          cells: [
            // 行0: 夜のストレッチ (21:00)
            [
              {
                dayIndex: 0,
                periodIndex: 1,
                text: '夜のストレッチ',
                title: '夜のストレッチ',
                roomOrNote: '',
                rawLines: ['夜のストレッチ'],
                fullText: '夜のストレッチ',
                customStartTime: '21:00',
                customDurationMinutes: 15,
                startMinutes: 21 * 60,
                endMinutes: 21 * 60 + 15,
              },
            ],
            // 行1: 朝の瞑想 (07:00)
            [
              {
                dayIndex: 0,
                periodIndex: 2,
                text: '朝の瞑想',
                title: '朝の瞑想',
                roomOrNote: '',
                rawLines: ['朝の瞑想'],
                fullText: '朝の瞑想',
                customStartTime: '07:00',
                customDurationMinutes: 10,
                startMinutes: 7 * 60,
                endMinutes: 7 * 60 + 10,
              },
            ],
            // 行2: 昼の散歩 (12:30)
            [
              {
                dayIndex: 0,
                periodIndex: 3,
                text: '昼の散歩',
                title: '昼の散歩',
                roomOrNote: '',
                rawLines: ['昼の散歩'],
                fullText: '昼の散歩',
                customStartTime: '12:30',
                customDurationMinutes: 20,
                startMinutes: 12 * 60 + 30,
                endMinutes: 12 * 60 + 50,
              },
            ],
          ],
        };

        const sorted = sortRowsByTime(table);

        // 朝(07:00) → 昼(12:30) → 夜(21:00) の順序に整列されていること
        expect(sorted.cells[0][0].title).toBe('朝の瞑想');
        expect(sorted.cells[0][0].periodIndex).toBe(1);

        expect(sorted.cells[1][0].title).toBe('昼の散歩');
        expect(sorted.cells[1][0].periodIndex).toBe(2);

        expect(sorted.cells[2][0].title).toBe('夜のストレッチ');
        expect(sorted.cells[2][0].periodIndex).toBe(3);

        // タスク抽出時も個別所要時間・個別開始時刻が反映されていること
        const { tasks } = generateScheduleItemsForTable(sorted);
        expect(tasks).toHaveLength(3);

        const morning = tasks.find((t) => t.title === '朝の瞑想')!;
        expect(morning.durationMinutes).toBe(10);
        expect(morning.earliestStartTime).toBe(7 * 60);

        const lunch = tasks.find((t) => t.title === '昼の散歩')!;
        expect(lunch.durationMinutes).toBe(20);
        expect(lunch.earliestStartTime).toBe(12 * 60 + 30);

        const night = tasks.find((t) => t.title === '夜のストレッチ')!;
        expect(night.durationMinutes).toBe(15);
        expect(night.earliestStartTime).toBe(21 * 60);
      });

      it('getCellDefaultDuration は表全体のコマ分数（例: 20分, 45分）を正しく参照し、誤って90分にフォールバックしないこと', () => {
        // 20分の日課表（startTime は未設定）
        const workoutTable: ImportedTableData = {
          ...createBaseTable(null),
          axisConfig: {
            startTime: null,
            periodMinutes: 20,
            intervalMinutes: 5,
            hasLunch: false,
            lunchAfterPeriod: 2,
            lunchMinutes: 50,
          },
          cells: [
            [
              {
                periodIndex: 1,
                dayIndex: 0,
                text: '瞑想',
                title: '瞑想',
                roomOrNote: '',
                fullText: '瞑想',
                rawLines: ['瞑想'],
                startMinutes: 0,
                endMinutes: 0,
              },
            ],
          ],
        };

        const duration = getCellDefaultDuration(workoutTable, 0, 0);
        // 90分ではなく表の設定である20分が返ること
        expect(duration).toBe(20);

        // 45分の筋トレ表
        const gymTable: ImportedTableData = {
          ...workoutTable,
          axisConfig: {
            ...workoutTable.axisConfig,
            periodMinutes: 45,
          },
        };
        expect(getCellDefaultDuration(gymTable, 0, 0)).toBe(45);
      });

      it('getCellDefaultStartTime は表の開始時刻または行開始時刻を正しく参照すること', () => {
        const tableWithTime: ImportedTableData = {
          ...createBaseTable('08:30'),
          axisConfig: {
            startTime: '08:30',
            periodMinutes: 50,
            intervalMinutes: 10,
            hasLunch: false,
            lunchAfterPeriod: 2,
            lunchMinutes: 50,
          },
        };
        const periodTimes = [
          {
            periodIndex: 1,
            startMinutes: 8 * 60 + 30,
            endMinutes: 9 * 60 + 20,
            startTime: '08:30',
            endTime: '09:20',
          },
        ];

        const { startTime, hasExplicitTime } = getCellDefaultStartTime(tableWithTime, 0, 0, periodTimes);
        expect(startTime).toBe('08:30');
        expect(hasExplicitTime).toBe(true);
      });

      it('昼休み設定（hasLunch: true, lunchAfterPeriod: 2, lunchMinutes: 50）がある場合、昼休み直前コマの休憩時間が50分になること', () => {
        const tableWithLunch: ImportedTableData = {
          ...createBaseTable('09:00'),
          axisConfig: {
            startTime: '09:00',
            periodMinutes: 90,
            intervalMinutes: 10,
            hasLunch: true,
            lunchAfterPeriod: 2,
            lunchMinutes: 50,
          },
          cells: [
            [
              {
                periodIndex: 1,
                dayIndex: 0,
                text: '1限',
                title: '1限',
                roomOrNote: '',
                fullText: '1限',
                rawLines: ['1限'],
                startMinutes: 540,
                endMinutes: 630,
              },
            ],
            [
              {
                periodIndex: 2,
                dayIndex: 0,
                text: '2限',
                title: '2限',
                roomOrNote: '',
                fullText: '2限',
                rawLines: ['2限'],
                startMinutes: 640,
                endMinutes: 730,
              },
            ],
          ],
        };

        const { slots } = generateScheduleItemsForTable(tableWithLunch);
        expect(slots).toHaveLength(2);

        // 1限の直後は通常の休憩時間（10分）
        const slot1 = slots.find((s) => s.title === '1限')!;
        expect(slot1.breakMinutes).toBe(10);

        // 2限の直後は設定された昼休み（50分）
        const slot2 = slots.find((s) => s.title === '2限')!;
        expect(slot2.breakMinutes).toBe(50);
      });

      it('Plan33: 毎日同じ固定枠（1日分・Day 1のみ）が全曜日（月〜日）に正しく割り当てられること', () => {
        const everydayFixedTable: ImportedTableData = {
          id: 'test-everyday-fixed',
          name: '基本生活リズム',
          createdAt: '2026-11-22T00:00:00Z',
          updatedAt: '2026-11-22T00:00:00Z',
          placementMode: 'fixed',
          columnMode: 'cycle',
          numRows: 1,
          numCols: 1,
          colHeaders: ['Day 1'],
          rowHeaders: ['1'],
          axisConfig: {
            startTime: '23:00',
            endTime: '07:00',
            periodMinutes: 480,
            intervalMinutes: 0,
            hasLunch: false,
            lunchAfterPeriod: 1,
            lunchMinutes: 50,
          },
          cells: [
            [
              {
                periodIndex: 1,
                dayIndex: 0,
                text: '睡眠',
                title: '睡眠',
                roomOrNote: '',
                fullText: '睡眠',
                rawLines: ['睡眠'],
                startMinutes: 1380, // 23:00
                endMinutes: 1860, // 翌07:00
              },
            ],
          ],
        };

        const { slots } = generateScheduleItemsForTable(everydayFixedTable);
        expect(slots).toHaveLength(1);
        expect(slots[0].title).toBe('睡眠');
        expect(slots[0].daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]); // 全曜日に配置！
      });

      it('Plan33: サイクル固定枠（シフト勤務）が cycleStartDay に基づいて曜日配列に抽出されること', () => {
        // 4日サイクルのシフト（Day 1: 日勤、Day 2: 夜勤、Day 3: 明け、Day 4: 休み）
        // 月曜(0)をDay 1とした場合、Day 1(日勤)は 月(0), 金(4)
        const shiftFixedTable: ImportedTableData = {
          id: 'test-shift-fixed',
          name: '交代勤務シフト',
          createdAt: '2026-11-23T00:00:00Z',
          updatedAt: '2026-11-23T00:00:00Z',
          placementMode: 'fixed',
          columnMode: 'cycle',
          cycleStartDay: 0,
          cycleStartDate: '2026-11-23',
          numRows: 1,
          numCols: 4,
          colHeaders: ['Day 1', 'Day 2', 'Day 3', 'Day 4'],
          rowHeaders: ['1'],
          axisConfig: {
            startTime: '08:30',
            endTime: '17:00',
            periodMinutes: 510,
            intervalMinutes: 0,
            hasLunch: false,
            lunchAfterPeriod: 1,
            lunchMinutes: 50,
          },
          cells: [
            [
              {
                periodIndex: 1,
                dayIndex: 0,
                text: '日勤',
                title: '日勤',
                roomOrNote: '',
                fullText: '日勤',
                rawLines: ['日勤'],
                startMinutes: 510,
                endMinutes: 1020,
              },
              {
                periodIndex: 1,
                dayIndex: 1,
                text: '夜勤',
                title: '夜勤',
                roomOrNote: '',
                fullText: '夜勤',
                rawLines: ['夜勤'],
                startMinutes: 990,
                endMinutes: 1530,
              },
              {
                periodIndex: 1,
                dayIndex: 2,
                text: null,
                title: '',
                roomOrNote: '',
                fullText: '',
                rawLines: [],
                startMinutes: 0,
                endMinutes: 0,
              },
              {
                periodIndex: 1,
                dayIndex: 3,
                text: null,
                title: '',
                roomOrNote: '',
                fullText: '',
                rawLines: [],
                startMinutes: 0,
                endMinutes: 0,
              },
            ],
          ],
        };

        const { slots } = generateScheduleItemsForTable(shiftFixedTable);
        expect(slots).toHaveLength(2); // 日勤と夜勤

        const dayShift = slots.find((s) => s.title === '日勤')!;
        expect(dayShift).toBeDefined();
        expect(dayShift.daysOfWeek).toEqual([0, 4]);

        const nightShift = slots.find((s) => s.title === '夜勤')!;
        expect(nightShift).toBeDefined();
        expect(nightShift.daysOfWeek).toEqual([1, 5]);
      });
    });

    describe('Plan34: 初回オンボーディングのための仮タスク代入と書き換え誘導', () => {
      it('TABLE_CLASSES の初期タスクが「1限 (講義・業務A)」等の書き換え誘導形式になっており、付随タスクが正常生成されること', () => {
        const classesTable = INITIAL_IMPORTED_TABLES.find((t) => t.name === '授業')!;
        expect(classesTable).toBeDefined();

        const flatCells = classesTable.cells.flat().filter((c) => c.text && c.title);
        expect(flatCells.length).toBeGreaterThan(0);

        // 全てのセルタイトルが「N限 (講義・業務X)」形式であること
        for (const cell of flatCells) {
          expect(cell.title).toMatch(/^\d+限 \(講義・業務[A-Z]\)$/);
        }

        // 付随タスクの生成確認
        const { tasks } = generateScheduleItemsForTable(classesTable);
        const attached = tasks.filter((t) => t.isAttachedTask);
        expect(attached.length).toBe(flatCells.length);
        for (const t of attached) {
          expect(t.title).toMatch(/^\d+限 \(講義・業務[A-Z]\) のタスク$/);
        }
      });
    });

    describe('Plan35/BugFix: 「毎日同じ」を選択した際の1列（Day 1）化とスケジュール生成', () => {
      it('2日周期の日課表から「毎日同じ」に設定変更（1列・Day 1サイクル化）された場合、1列の表として全曜日に毎日タスクが配分されること', () => {
        // 2日周期の日課表（Day 1, Day 2）
        const twoDayTable = INITIAL_IMPORTED_TABLES.find((t) => t.name === '日課')!;
        expect(twoDayTable.numCols).toBe(2);

        // 「毎日同じ」への変換（ウィザードの handleBuildTable と同等の変換処理）
        const everydayTable: ImportedTableData = {
          ...twoDayTable,
          columnMode: 'cycle',
          numCols: 1,
          colHeaders: ['Day 1'],
          cycleStartDay: 0,
          cycleStartDate: undefined,
          cells: twoDayTable.cells.map((rowCells, r) => {
            const meaningfulCell = rowCells.find((c) => Boolean(c.text || c.title)) || rowCells[0];
            return [
              {
                ...meaningfulCell,
                dayIndex: 0,
                periodIndex: r + 1,
              },
            ];
          }),
        };

        expect(everydayTable.numCols).toBe(1);
        expect(everydayTable.colHeaders).toEqual(['Day 1']);
        expect(everydayTable.columnMode).toBe('cycle');
        expect(everydayTable.cells[0].length).toBe(1);

        const { tasks } = generateScheduleItemsForTable(everydayTable);
        // 3行なので3タスク
        expect(tasks.length).toBe(3);
        for (const t of tasks) {
          expect(t.cycleCount).toBe(1);
          expect(t.cycleIndex).toBe(0);
          expect(t.period).toBe('day');
        }
      });
    });
  });
});
