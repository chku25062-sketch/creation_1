import { describe, expect, it } from 'vitest';
import { generateScheduleItemsForTable, getTableClassification } from '../tableUtils';
import {
  createDailyRoutineTable,
  createFixedSlotTable,
  createWeeklyTaskTable,
} from './tableTemplates';

describe('Table Templates Generator (Plan22 仮実装検証)', () => {
  describe('日課テンプレート (createDailyRoutineTable)', () => {
    it('単一メニュー: 毎日の読書タスクが正しく生成・抽出されること', () => {
      const table = createDailyRoutineTable({
        name: '夜の読書習慣',
        mode: 'single',
        singleTask: {
          title: '読書',
          durationMinutes: 20,
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
      expect(table.axisConfig.periodMinutes).toBe(20);
      expect(table.axisConfig.startTime).toBe('21:00');
      expect(table.axisConfig.endTime).toBe('23:00');

      // スケジューラー解析チェック
      const classification = getTableClassification(table);
      expect(classification).toBe('daily_task');

      const { tasks } = generateScheduleItemsForTable(table);
      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.title).toBe('読書');
      expect(task.durationMinutes).toBe(20);
      expect(task.targetDays).toEqual([0, 1, 2, 3, 4]);
      expect(task.dailyCount).toBe(1);
      expect(task.earliestStartTime).toBe(21 * 60); // 1260
      expect(task.latestEndTime).toBe(23 * 60); // 1380
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
    it('週3回のレポート作成タスクが正しく生成されること', () => {
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
      expect(table.numCols).toBe(3);
      expect(table.colHeaders).toEqual(['Day 1', 'Day 2', 'Day 3']);
      expect(table.weeklyRepeatCount).toBe(3);
      expect(table.weeklyTaskExpiryWeeks).toBe(1);

      const { tasks } = generateScheduleItemsForTable(table);
      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.title).toBe('プログラミング課題');
      expect(task.durationMinutes).toBe(90);
      expect(task.earliestStartTime).toBe(13 * 60);
      expect(task.latestEndTime).toBe(21 * 60);
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
  });
});
