import { describe, expect, it } from 'vitest';
import { generateScheduleItemsForTable, getTableClassification } from '../tableUtils';
import { generateTheoreticalSchedule } from '../scheduler';
import {
  createDailyRoutineTable,
  createFixedSlotTable,
  createWeeklyTaskTable,
} from './tableTemplates';

describe('Table Templates Generator (Plan22 仮実装検証)', () => {
  describe('日課テンプレート (createDailyRoutineTable)', () => {
    it('単一メニュー（Day 1のみのサイクル表＝毎日）: 7列展開を省き、Day 1 の1行1列コンパクト表として生成・抽出されること', () => {
      const table = createDailyRoutineTable({
        name: '毎日のストレッチ',
        mode: 'single',
        singleTask: {
          title: 'ストレッチ',
          durationMinutes: 7, // 任意の分数（自由入力）
          isEveryday: true, // 毎日実施
        },
        dailyRepeatCount: 2, // 1日2回
        timeRange: {
          startTime: '07:00',
          endTime: '22:00',
        },
      });

      expect(table.placementMode).toBe('auto');
      expect(table.columnMode).toBe('cycle'); // ★ Day 1 のみ＝毎日を表すサイクルモード
      expect(table.numCols).toBe(1); // ★ 7列ではなく1列の最小表！
      expect(table.colHeaders).toEqual(['Day 1']); // ★ 「毎日」という独自名ではなく正規の Day 1
      expect(table.axisConfig.periodMinutes).toBe(7);
      expect(table.dailyRepeatCount).toBe(2);

      const classification = getTableClassification(table);
      expect(classification).toBe('daily_task');

      const { tasks } = generateScheduleItemsForTable(table);
      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.title).toBe('ストレッチ');
      expect(task.durationMinutes).toBe(7);
      expect(task.dailyCount).toBe(2);
      expect(task.cycleDays).toEqual([0]);
      expect(task.cycleCount).toBe(1);
      expect(task.earliestStartTime).toBe(7 * 60);
      expect(task.latestEndTime).toBe(22 * 60);

      // スケジューラーで全曜日（月〜日）に配置されることを検証
      const schedule = generateTheoreticalSchedule([], [task]);
      for (let day = 0; day < 7; day++) {
        const blocks = schedule.dayBlocks[day];
        expect(blocks.some((b) => b.taskId === task.id)).toBe(true);
      }
    });

    it('単一メニュー（曜日指定時）: 7列展開され、指定曜日のみセルが生成されること', () => {
      const table = createDailyRoutineTable({
        name: '夜の読書習慣',
        mode: 'single',
        singleTask: {
          title: '読書',
          durationMinutes: 20,
          isEveryday: false,
          targetDays: [0, 1, 2, 3, 4], // 平日のみ
        },
        dailyRepeatCount: 1,
        timeRange: {
          startTime: '21:00',
          endTime: '23:00',
        },
      });

      expect(table.placementMode).toBe('auto');
      expect(table.columnMode).toBe('weekday');
      expect(table.numCols).toBe(7);
      expect(table.colHeaders).toEqual(['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜']);
      expect(table.axisConfig.periodMinutes).toBe(20);

      const { tasks } = generateScheduleItemsForTable(table);
      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.title).toBe('読書');
      expect(task.durationMinutes).toBe(20);
      expect(task.targetDays).toEqual([0, 1, 2, 3, 4]);
    });

    it('マルチタスク（複数項目一括設定）: 複数行が生成され、開始時刻順に自動整列（Auto-Sort）されること', () => {
      const table = createDailyRoutineTable({
        name: 'モーニング＆ナイトルーティン',
        mode: 'single',
        multiTasks: {
          items: [
            { title: '夜の筋トレ', durationMinutes: 40, startTime: '21:00' },
            { title: '朝の瞑想', durationMinutes: 10, startTime: '07:00' },
            { title: '昼の読書', durationMinutes: 20, startTime: '12:30' },
          ],
          isEveryday: true,
        },
      });

      expect(table.numRows).toBe(3);
      expect(table.numCols).toBe(1);
      expect(table.colHeaders).toEqual(['Day 1']);

      // 開始時刻順に自動整列されていることを検証 (07:00 -> 12:30 -> 21:00)
      expect(table.cells[0][0].title).toBe('朝の瞑想');
      expect(table.cells[0][0].customStartTime).toBe('07:00');
      expect(table.cells[0][0].customDurationMinutes).toBe(10);

      expect(table.cells[1][0].title).toBe('昼の読書');
      expect(table.cells[1][0].customStartTime).toBe('12:30');
      expect(table.cells[1][0].customDurationMinutes).toBe(20);

      expect(table.cells[2][0].title).toBe('夜の筋トレ');
      expect(table.cells[2][0].customStartTime).toBe('21:00');
      expect(table.cells[2][0].customDurationMinutes).toBe(40);
    });

    it('曜日別ローテーション: 月〜金の科目別学習タスクが各曜日ごとに生成されること', () => {
      const table = createDailyRoutineTable({
        name: '英語学習（曜日別）',
        mode: 'weekday_rotation',
        weekdayRotation: {
          defaultDurationMinutes: 30,
          days: {
            0: { title: '英単語', durationMinutes: 15 },
            1: { title: '英文法', durationMinutes: 30 },
            2: { title: 'リスニング', durationMinutes: 25 },
            3: { title: '長文読解', durationMinutes: 45 },
            4: { title: '過去問演習', durationMinutes: 60 },
            5: null, // 土曜休み
            6: null, // 日曜休み
          },
        },
        timeRange: {
          startTime: '19:00',
          endTime: '21:00',
        },
      });

      expect(table.columnMode).toBe('weekday');
      expect(table.numCols).toBe(7);

      const { tasks } = generateScheduleItemsForTable(table);
      expect(tasks).toHaveLength(5);

      const vocabTask = tasks.find((t) => t.title === '英単語');
      expect(vocabTask).toBeDefined();
      expect(vocabTask?.targetDays).toEqual([0]);
      expect(vocabTask?.durationMinutes).toBe(15);
      expect(vocabTask?.earliestStartTime).toBe(19 * 60);
      expect(vocabTask?.latestEndTime).toBe(21 * 60);

      const pastExamTask = tasks.find((t) => t.title === '過去問演習');
      expect(pastExamTask).toBeDefined();
      expect(pastExamTask?.targetDays).toEqual([4]);
      expect(pastExamTask?.durationMinutes).toBe(60);
    });

    it('N日サイクルローテーション: 4日周期の筋トレ（胸/背中/脚/休）がサイクルタスクとして生成されること', () => {
      const table = createDailyRoutineTable({
        name: '筋トレ分割ルーティン (PPLR)',
        mode: 'cycle_rotation',
        cycleRotation: {
          cycleLength: 4,
          cycleStartDay: 0, // 月曜起算
          defaultDurationMinutes: 45,
          items: [
            { title: '胸・三頭筋', durationMinutes: 45 },
            { title: '背中・二頭筋', durationMinutes: 45 },
            { title: '脚・肩', durationMinutes: 50 },
            null, // 4日目は休息日（タスクなし）
          ],
        },
        timeRange: {
          startTime: null,
          endTime: '22:00',
        },
      });

      expect(table.columnMode).toBe('cycle');
      expect(table.numCols).toBe(4);
      expect(table.colHeaders).toEqual(['Day 1', 'Day 2', 'Day 3', 'Day 4']);
      expect(table.cycleStartDay).toBe(0);

      const { tasks } = generateScheduleItemsForTable(table);
      // 休息日は空セルのため3つのタスクが生成される
      expect(tasks).toHaveLength(3);

      const chestTask = tasks.find((t) => t.title === '胸・三頭筋');
      expect(chestTask).toBeDefined();
      expect(chestTask?.cycleDays).toEqual([0]); // Day 1
      expect(chestTask?.cycleIndex).toBe(0);
      expect(chestTask?.cycleCount).toBe(4);
      expect(chestTask?.durationMinutes).toBe(45);
      expect(chestTask?.latestEndTime).toBe(22 * 60);

      const legTask = tasks.find((t) => t.title === '脚・肩');
      expect(legTask).toBeDefined();
      expect(legTask?.cycleDays).toEqual([2]); // Day 3
      expect(legTask?.cycleCount).toBe(4);
      expect(legTask?.durationMinutes).toBe(50);
    });
  });

  describe('週次タスクテンプレート (createWeeklyTaskTable)', () => {
    it('いつでも着手可能（おまかせ）: Day 1の最小表として生成され、週3回のタスクとして抽出されること', () => {
      const table = createWeeklyTaskTable({
        title: 'プログラミング課題',
        durationMinutes: 90,
        weeklyTargetCount: 3,
        expiryWeeks: 1,
        timeRange: {
          startTime: '13:00',
          endTime: '21:00',
        },
      });

      expect(table.placementMode).toBe('auto');
      expect(table.columnMode).toBe('cycle');
      expect(table.numCols).toBe(1);
      expect(table.colHeaders).toEqual(['Day 1']);
      expect(table.weeklyRepeatCount).toBe(3);
      expect(table.weeklyTaskExpiryWeeks).toBe(1);

      const { tasks } = generateScheduleItemsForTable(table);
      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.title).toBe('プログラミング課題');
      expect(task.durationMinutes).toBe(90);
      expect(task.frequencyCount).toBe(3);
      expect(task.earliestStartTime).toBe(13 * 60);
      expect(task.latestEndTime).toBe(21 * 60);
    });

    it('特定日時以降に着手（水曜 14:30以降）: 7列展開され、水曜以降のセルと開始日時制約が正しく設定されること', () => {
      const table = createWeeklyTaskTable({
        title: '講義後レポート',
        durationMinutes: 60,
        weeklyTargetCount: 2,
        expiryWeeks: 1,
        startConstraint: {
          enabled: true,
          startDay: 2, // 水曜日
          scheduleAfterTime: '14:30',
        },
      });

      expect(table.placementMode).toBe('auto');
      expect(table.columnMode).toBe('weekday');
      expect(table.numCols).toBe(7);
      expect(table.axisConfig.startTime).toBe('14:30');

      // 水曜より前の月・火はセルが null
      expect(table.cells[0][0].text).toBeNull(); // 月曜
      expect(table.cells[0][1].text).toBeNull(); // 火曜
      // 水曜以降はセルが入っている
      expect(table.cells[0][2].text).toBe('講義後レポート'); // 水曜
      expect(table.cells[0][3].text).toBe('講義後レポート'); // 木曜

      const { tasks } = generateScheduleItemsForTable(table);
      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.title).toBe('講義後レポート');
      expect(task.startDay).toBe(2);
      expect(task.targetDays).toEqual([2, 3, 4, 5, 6]);
      expect(task.earliestStartTime).toBe(14 * 60 + 30);
    });

    it('希望曜日指定あり（平日・月水金）: 指定された希望曜日のみセルが生成されること', () => {
      const table = createWeeklyTaskTable({
        title: 'ジム・筋トレ',
        durationMinutes: 60,
        weeklyTargetCount: 3,
        expiryWeeks: 1,
        preferredDays: [0, 2, 4], // 月, 水, 金
      });

      expect(table.columnMode).toBe('weekday');
      expect(table.numCols).toBe(7);
      expect(table.cells[0][0].text).toBe('ジム・筋トレ'); // 月
      expect(table.cells[0][1].text).toBeNull(); // 火
      expect(table.cells[0][2].text).toBe('ジム・筋トレ'); // 水
      expect(table.cells[0][3].text).toBeNull(); // 木
      expect(table.cells[0][4].text).toBe('ジム・筋トレ'); // 金
      expect(table.cells[0][5].text).toBeNull(); // 土
      expect(table.cells[0][6].text).toBeNull(); // 日

      const { tasks } = generateScheduleItemsForTable(table);
      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.targetDays).toEqual([0, 2, 4]);
    });

    it('マルチタスク一括生成（週次）: 複数行が生成され、各行に指定した所要時間が反映されること', () => {
      const table = createWeeklyTaskTable({
        name: '今週の課題セット',
        multiTasks: {
          items: [
            { title: 'レポート課題', durationMinutes: 90 },
            { title: '部屋の掃除', durationMinutes: 30 },
            { title: '英語リスニング', durationMinutes: 45 },
          ],
        },
      });

      expect(table.numRows).toBe(3);
      expect(table.numCols).toBe(1);
      expect(table.name).toBe('今週の課題セット');
      expect(table.weeklyRepeatCount).toBe('auto'); // ★ デフォルト auto

      expect(table.cells[0][0].title).toBe('レポート課題');
      expect(table.cells[0][0].customDurationMinutes).toBe(90);

      expect(table.cells[1][0].title).toBe('部屋の掃除');
      expect(table.cells[1][0].customDurationMinutes).toBe(30);

      expect(table.cells[2][0].title).toBe('英語リスニング');
      expect(table.cells[2][0].customDurationMinutes).toBe(45);
    });
  });

  describe('固定タスクテンプレート (createFixedSlotTable)', () => {
    it('毎日の睡眠固定枠（00:00〜08:00）が正しく固定枠として分類されること', () => {
      const table = createFixedSlotTable({
        title: '睡眠',
        startTime: '00:00',
        endTime: '08:00',
        targetDays: [0, 1, 2, 3, 4, 5, 6],
      });

      expect(table.placementMode).toBe('fixed');
      expect(table.columnMode).toBe('weekday');
      expect(table.numCols).toBe(7);
      expect(table.axisConfig.startTime).toBe('00:00');
      expect(table.axisConfig.endTime).toBe('08:00');
      expect(table.axisConfig.periodMinutes).toBe(480);

      // 固定枠判定
      const classification = getTableClassification(table);
      expect(classification).toBe('fixed_slot');

      const { slots, tasks } = generateScheduleItemsForTable(table);
      expect(slots).toHaveLength(1);
      expect(tasks).toHaveLength(0);
      const slot = slots[0];
      expect(slot.title).toBe('睡眠');
      expect(slot.startMinutes).toBe(0);
      expect(slot.endMinutes).toBe(480);
      expect(slot.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('マルチスロット一括生成（固定枠）: 複数行が生成され、開始時刻順に自動整列（Auto-Sort）されること', () => {
      const table = createFixedSlotTable({
        name: '基本生活リズム',
        multiSlots: {
          items: [
            { title: 'アルバイト', startTime: '17:00', endTime: '21:00', targetDays: [0, 2, 4] },
            { title: '睡眠', startTime: '00:00', endTime: '08:00', targetDays: [0, 1, 2, 3, 4, 5, 6] },
            { title: '昼食', startTime: '12:00', endTime: '13:00', targetDays: [0, 1, 2, 3, 4, 5, 6] },
          ],
        },
      });

      expect(table.numRows).toBe(3);
      expect(table.name).toBe('基本生活リズム');
      expect(table.placementMode).toBe('fixed');

      // 開始時刻順に自動整列 (00:00 睡眠 -> 12:00 昼食 -> 17:00 アルバイト)
      expect(table.cells[0][0].title).toBe('睡眠');
      expect(table.cells[0][0].customStartTime).toBe('00:00');

      expect(table.cells[1][0].title).toBe('昼食');
      expect(table.cells[1][0].customStartTime).toBe('12:00');

      expect(table.cells[2][0].title).toBe('アルバイト');
      expect(table.cells[2][0].customStartTime).toBe('17:00');
      expect(table.cells[2][0].text).toBe('アルバイト'); // 月曜は対象
      expect(table.cells[2][1].text).toBeNull(); // 火曜は非対象
    });
  });
});
