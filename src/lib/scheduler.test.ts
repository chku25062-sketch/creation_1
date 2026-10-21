import { describe, it, expect } from 'vitest';
import {
  normalizeFixedSlots,
  calculateFreeSlots,
  generateTheoreticalSchedule,
  getAdjustedDuration,
} from './scheduler';
import { FixedSlot, TaskItem } from '@/types';

describe('Theoretical Scheduler Engine', () => {
  describe('normalizeFixedSlots', () => {
    it('日を跨ぐ睡眠スロット（23:00〜07:00）を正しく2分割すること', () => {
      const slots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 23 * 60, // 1380
          endMinutes: 7 * 60, // 420
          color: '#6366f1',
        },
      ];

      const normalized = normalizeFixedSlots(slots);
      expect(normalized).toHaveLength(2);
      // 00:00 - 07:00
      expect(normalized[0].startMinutes).toBe(0);
      expect(normalized[0].endMinutes).toBe(420);
      // 23:00 - 24:00
      expect(normalized[1].startMinutes).toBe(1380);
      expect(normalized[1].endMinutes).toBe(1440);
    });

    it('通常の日中スロット（09:00〜18:00）は分割されないこと', () => {
      const slots: FixedSlot[] = [
        {
          id: 'work',
          title: '仕事',
          category: 'work',
          startMinutes: 9 * 60,
          endMinutes: 18 * 60,
          color: '#3b82f6',
        },
      ];

      const normalized = normalizeFixedSlots(slots);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].startMinutes).toBe(540);
      expect(normalized[0].endMinutes).toBe(1080);
    });

    it('開始・終了時刻が0分のスロット（00:00〜00:00）が誤って24時間スロットに化けずに除外されること', () => {
      const slots: FixedSlot[] = [
        {
          id: 'zero-slot',
          title: '未設定スロット',
          category: 'routine',
          startMinutes: 0,
          endMinutes: 0,
          color: '#0284c7',
        },
      ];

      const normalized = normalizeFixedSlots(slots);
      // 0分スロットは除外され、24時間（1440分）に膨張しないこと
      expect(normalized).toHaveLength(0);
    });
  });

  describe('calculateFreeSlots', () => {
    it('固定枠の隙間から正確な空き時間スロットを算出すること', () => {
      const normalizedSlots: FixedSlot[] = [
        {
          id: 'sleep-1',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 420, // 07:00
          color: '#6366f1',
        },
        {
          id: 'work',
          title: '仕事',
          category: 'work',
          startMinutes: 540, // 09:00
          endMinutes: 1080, // 18:00
          color: '#3b82f6',
        },
        {
          id: 'sleep-2',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 1380, // 23:00
          endMinutes: 1440,
          color: '#6366f1',
        },
      ];

      const free = calculateFreeSlots(normalizedSlots);
      // 空きスロット1: 07:00〜09:00 (120分)
      // 空きスロット2: 18:00〜23:00 (300分)
      expect(free).toHaveLength(2);
      expect(free[0].startMinutes).toBe(420);
      expect(free[0].endMinutes).toBe(540);
      expect(free[0].durationMinutes).toBe(120);

      expect(free[1].startMinutes).toBe(1080);
      expect(free[1].endMinutes).toBe(1380);
      expect(free[1].durationMinutes).toBe(300);
    });
  });

  describe('generateTheoreticalSchedule', () => {
    it('タスクが優先度順に空き時間スロットに割り振られ、理論値スコア100%となること', () => {
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 1380,
          endMinutes: 420,
          color: '#6366f1',
        },
        {
          id: 'work',
          title: '勤務',
          category: 'work',
          startMinutes: 540,
          endMinutes: 1080,
          color: '#3b82f6',
        },
      ];

      const tasks: TaskItem[] = [
        {
          id: 't1',
          title: '高優先度: 資格勉強',
          durationMinutes: 60,
          priority: 'high',
          category: 'study',
          period: 'day',
        },
        {
          id: 't2',
          title: '中優先度: ジム',
          durationMinutes: 90,
          priority: 'medium',
          category: 'workout',
          period: 'day',
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, tasks);

      expect(result.unassignedTasks).toHaveLength(0);
      expect(result.metrics.theoreticalScore).toBe(100);
      expect(result.metrics.assignedTaskCount).toBe(2);

      // 高優先度タスクが配置されているか
      const studyBlock = result.blocks.find((b) => b.title === '高優先度: 資格勉強');
      expect(studyBlock).toBeDefined();
      expect(studyBlock?.isFixed).toBe(false);
    });

    it('空き時間を超過するタスクがある場合、未割り当てタスクが検出されスコアが算出されること', () => {
      const fixedSlots: FixedSlot[] = [
        {
          id: 'all-day',
          title: '終日拘束',
          category: 'work',
          startMinutes: 0,
          endMinutes: 1380, // 23時間拘束、残り60分のみ
          color: '#3b82f6',
        },
      ];

      const tasks: TaskItem[] = [
        {
          id: 't1',
          title: '読書',
          durationMinutes: 60,
          priority: 'high',
          category: 'study',
          period: 'day',
        },
        {
          id: 't2',
          title: '大作執筆',
          durationMinutes: 120, // 収まらない
          priority: 'low',
          category: 'creative',
          period: 'day',
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, tasks);

      expect(result.metrics.assignedTaskCount).toBe(1);
      expect(result.unassignedTasks).toHaveLength(1);
      expect(result.unassignedTasks[0].title).toBe('大作執筆');
      // 60 / 180 = 33%
      expect(result.metrics.theoreticalScore).toBe(33);
    });

    it('タスクが0件の場合は理論値スコアが100%となり、未配置タスクが0件であること', () => {
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 420,
          color: '#6366f1',
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, []);
      expect(result.metrics.theoreticalScore).toBe(100);
      expect(result.unassignedTasks).toHaveLength(0);
      expect(result.metrics.assignedTaskCount).toBe(0);
    });

    it('同一優先度のタスクは所要時間が長いものから優先して配置されること', () => {
      // 空き時間90分のみ (07:00〜08:30)
      const fixedSlots: FixedSlot[] = [
        {
          id: 'before',
          title: '早朝固定',
          category: 'routine',
          startMinutes: 0,
          endMinutes: 420, // 07:00
          color: '#64748b',
        },
        {
          id: 'after',
          title: '勤務',
          category: 'work',
          startMinutes: 510, // 08:30
          endMinutes: 1440,
          color: '#3b82f6',
        },
      ];

      const tasks: TaskItem[] = [
        {
          id: 't-short',
          title: '短いタスク',
          durationMinutes: 30,
          priority: 'high',
          category: 'study',
          period: 'day',
        },
        {
          id: 't-long',
          title: '長いタスク',
          durationMinutes: 60,
          priority: 'high',
          category: 'workout',
          period: 'day',
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, tasks);
      expect(result.metrics.assignedTaskCount).toBe(2);
      // 長いタスクが先に配置されるため、開始時刻が早い
      const longBlock = result.blocks.find((b) => b.title === '長いタスク');
      const shortBlock = result.blocks.find((b) => b.title === '短いタスク');
      expect(longBlock?.startMinutes).toBe(420);
      expect(shortBlock?.startMinutes).toBe(480);
    });

    it('曜日限定の講義スロット（月・水）が該当曜日のみに配置されること', () => {
      const fixedSlots: FixedSlot[] = [
        {
          id: 'lecture-mw',
          title: '情報工学実験',
          category: 'lecture',
          startMinutes: 13 * 60, // 13:00
          endMinutes: 16 * 60, // 16:00
          color: '#0284c7',
          daysOfWeek: [0, 2], // 月曜(0), 水曜(2)
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, []);

      // 月曜(0)と水曜(2)には講義ブロックが存在
      const monLecture = result.dayBlocks[0].find((b) => b.title === '情報工学実験');
      const wedLecture = result.dayBlocks[2].find((b) => b.title === '情報工学実験');
      // 火曜(1)には存在しない
      const tueLecture = result.dayBlocks[1].find((b) => b.title === '情報工学実験');

      expect(monLecture).toBeDefined();
      expect(wedLecture).toBeDefined();
      expect(tueLecture).toBeUndefined();
    });

    it('課題タスクが出題曜日〜締切曜日の候補期間内に配置され、ToDoタスクは時間割を占有しないこと', () => {
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 420, // 07:00
          color: '#6366f1',
        },
      ];

      const tasks: TaskItem[] = [
        {
          id: 'assignment-1',
          title: '木曜締切レポート',
          taskType: 'assignment',
          startDay: 1, // 火曜出題
          deadlineDay: 3, // 木曜締切
          durationMinutes: 120,
          priority: 'high',
          category: 'study',
          period: 'week',
        },
        {
          id: 'todo-1',
          title: '履修届提出',
          taskType: 'todo',
          hasNoDuration: true,
          durationMinutes: 0,
          priority: 'medium',
          category: 'other',
          period: 'week',
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, tasks);

      // 課題が火曜(1)〜木曜(3)のいずれかに配置されていること
      const assignedDay = [1, 2, 3].find((d) =>
        result.dayBlocks[d].some((b) => b.title === '木曜締切レポート'),
      );
      expect(assignedDay).toBeDefined();

      // 金曜(4)〜日(6)や月曜(0)には配置されていないこと
      const wrongDay = [0, 4, 5, 6].find((d) =>
        result.dayBlocks[d].some((b) => b.title === '木曜締切レポート'),
      );
      expect(wrongDay).toBeUndefined();

      // ToDoタスクはdayBlocks内のいずれの曜日にもブロックとして配置されないこと
      for (let d = 0; d < 7; d++) {
        const todoBlock = result.dayBlocks[d].find((b) => b.title === '履修届提出');
        expect(todoBlock).toBeUndefined();
      }

      // ToDoは未配置エラーとして扱われず、スコアは100%
      expect(result.unassignedTasks).toHaveLength(0);
      expect(result.metrics.theoreticalScore).toBe(100);
    });

    it('📌 Must(やらなければいけないこと)が 🌟 Want(やりたいこと)よりも優先して空き枠に配置されること', () => {
      // 空き枠が60分のみ (07:00〜08:00)
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 420, // 07:00
          color: '#6366f1',
        },
        {
          id: 'work',
          title: '勤務',
          category: 'work',
          startMinutes: 480, // 08:00
          endMinutes: 1440,
          color: '#3b82f6',
        },
      ];

      const tasks: TaskItem[] = [
        {
          id: 'task-want',
          title: 'ゲーム・趣味',
          durationMinutes: 60,
          priority: 'high',
          category: 'want',
          period: 'day',
        },
        {
          id: 'task-must',
          title: '英語小テスト対策',
          durationMinutes: 60,
          priority: 'medium', // 優先度設定がmediumであってもMustが優先
          category: 'must',
          period: 'day',
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, tasks);
      // 空き枠は60分しかないので、Mustタスクのみが配置される
      expect(result.metrics.assignedTaskCount).toBe(1);
      const placedMust = result.blocks.find((b) => b.title === '英語小テスト対策');
      expect(placedMust).toBeDefined();

      // Wantタスクは未割り当てになる
      expect(result.unassignedTasks.some((t) => t.title === 'ゲーム・趣味')).toBe(true);
    });

    it('頻度(frequency: medium)のタスクが複数曜日に分散配置されること', () => {
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 420,
          color: '#6366f1',
        },
      ];

      const tasks: TaskItem[] = [
        {
          id: 'task-fitness',
          title: '筋トレ・ランニング',
          durationMinutes: 60,
          priority: 'high',
          category: 'want',
          period: 'week',
          frequency: 'medium', // 週3回目標
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, tasks);
      const daysWithFitness = [0, 1, 2, 3, 4, 5, 6].filter((d) =>
        result.dayBlocks[d].some((b) => b.title === '筋トレ・ランニング'),
      );
      expect(daysWithFitness.length).toBe(3);
    });
  });

  describe('getAdjustedDuration', () => {
    it('小サイズ: 空き枠が15〜30分の場合は枠長にジャストフィットし、30分以上の枠では25分になること', () => {
      const smallTask: TaskItem = {
        id: 's1',
        title: '単語暗記',
        durationMinutes: 0,
        durationSize: 'small',
        priority: 'medium',
        category: 'must',
        period: 'day',
      };

      // 20分の空き枠 -> 20分
      expect(getAdjustedDuration(smallTask, 20)).toBe(20);
      // 45分の空き枠 -> 25分
      expect(getAdjustedDuration(smallTask, 45)).toBe(25);
    });

    it('中サイズ: 空き枠が30〜60分の場合は枠長にジャストフィットし、60分以上の枠では60分になること', () => {
      const mediumTask: TaskItem = {
        id: 'm1',
        title: 'レポート執筆',
        durationMinutes: 0,
        durationSize: 'medium',
        priority: 'medium',
        category: 'must',
        period: 'week',
      };

      // 40分の空き枠 -> 40分
      expect(getAdjustedDuration(mediumTask, 40)).toBe(40);
      // 90分の空き枠 -> 60分
      expect(getAdjustedDuration(mediumTask, 90)).toBe(60);
    });

    it('大サイズ: 120分基準になること', () => {
      const largeTask: TaskItem = {
        id: 'l1',
        title: 'プロダクト開発',
        durationMinutes: 0,
        durationSize: 'large',
        priority: 'high',
        category: 'want',
        period: 'week',
      };

      expect(getAdjustedDuration(largeTask, 180)).toBe(120);
    });
  });

  describe('Plan8: Multi-insertion and 3-day cycle', () => {
    it('1日に複数回 (dailyCount: 2) 組み込まれること', () => {
      // 空きスロットが複数ある固定枠 (9:00〜12:00, 14:00〜18:00)
      const fixedSlots: FixedSlot[] = [
        {
          id: 'work1',
          title: '午前作業',
          category: 'work',
          startMinutes: 540,
          endMinutes: 720,
          color: '#3b82f6',
        },
        {
          id: 'work2',
          title: '午後作業',
          category: 'work',
          startMinutes: 840,
          endMinutes: 1080,
          color: '#3b82f6',
        },
      ];

      const multiDailyTask: TaskItem = {
        id: 'stretch',
        title: 'ストレッチ・水分補給',
        durationMinutes: 15,
        durationSize: 'small',
        priority: 'high',
        category: 'must',
        period: 'day',
        dailyCount: 2,
      };

      const result = generateTheoreticalSchedule(fixedSlots, [multiDailyTask]);
      // 月曜 (dayIndex: 0) に 2回配置されていること
      const mondayBlocks = result.dayBlocks[0].filter((b) => b.taskId === 'stretch');
      expect(mondayBlocks.length).toBe(2);
    });

    it('3日周期のタスク (cycleIndex) が適切にローテーション配置されること', () => {
      const pushTask: TaskItem = {
        id: 'push',
        title: '胸トレ (Push)',
        durationMinutes: 45,
        priority: 'medium',
        category: 'want',
        period: 'week',
        cycleIndex: 0, // 月(0) / 木(3) 優先
      };

      const pullTask: TaskItem = {
        id: 'pull',
        title: '背中トレ (Pull)',
        durationMinutes: 45,
        priority: 'medium',
        category: 'want',
        period: 'week',
        cycleIndex: 1, // 火(1) / 金(4) 優先
      };

      const result = generateTheoreticalSchedule([], [pushTask, pullTask]);
      const pushMonday = result.dayBlocks[0].some((b) => b.taskId === 'push');
      const pullTuesday = result.dayBlocks[1].some((b) => b.taskId === 'pull');

      expect(pushMonday).toBe(true);
      expect(pullTuesday).toBe(true);
    });

    it('曜日指定の日次タスク (period: day, startDay: 1) がその曜日のみに配置されること', () => {
      const tuesdayOnlyTask: TaskItem = {
        id: 'tuesday-routine',
        title: '火曜専用ルーティン',
        durationMinutes: 30,
        priority: 'high',
        category: 'must',
        period: 'day',
        startDay: 1, // 火曜日限定
      };

      const result = generateTheoreticalSchedule([], [tuesdayOnlyTask]);
      // 月曜(0)には配置されず、火曜(1)にのみ配置されること
      expect(result.dayBlocks[0].some((b) => b.taskId === 'tuesday-routine')).toBe(false);
      expect(result.dayBlocks[1].some((b) => b.taskId === 'tuesday-routine')).toBe(true);
      expect(result.dayBlocks[2].some((b) => b.taskId === 'tuesday-routine')).toBe(false);
    });

    it('周期日次タスク (period: day, cycleIndex: 0, cycleCount: 3) が周期的にローテーション配置されること', () => {
      const cycleDailyTask: TaskItem = {
        id: 'cycle-day1',
        title: 'Day 1 メニュー',
        durationMinutes: 30,
        priority: 'high',
        category: 'must',
        period: 'day',
        cycleIndex: 0,
        cycleCount: 3,
      };

      const result = generateTheoreticalSchedule([], [cycleDailyTask]);
      // 3日周期 (0:月, 3:木, 6:日) にのみ配置されること
      expect(result.dayBlocks[0].some((b) => b.taskId === 'cycle-day1')).toBe(true); // 月 (0%3=0)
      expect(result.dayBlocks[1].some((b) => b.taskId === 'cycle-day1')).toBe(false); // 火 (1%3=1)
      expect(result.dayBlocks[2].some((b) => b.taskId === 'cycle-day1')).toBe(false); // 水 (2%3=2)
      expect(result.dayBlocks[3].some((b) => b.taskId === 'cycle-day1')).toBe(true); // 木 (3%3=0)
      expect(result.dayBlocks[4].some((b) => b.taskId === 'cycle-day1')).toBe(false); // 金 (4%3=1)
      expect(result.dayBlocks[5].some((b) => b.taskId === 'cycle-day1')).toBe(false); // 土 (5%3=2)
      expect(result.dayBlocks[6].some((b) => b.taskId === 'cycle-day1')).toBe(true); // 日 (6%3=0)
    });

    it('1列フリー日課タスク (period: day, startDay/cycleIndex 未指定) が毎日全曜日に配置されること', () => {
      const freeDailyTask: TaskItem = {
        id: 'everyday-habit',
        title: '毎日の習慣',
        durationMinutes: 30,
        priority: 'high',
        category: 'must',
        period: 'day',
      };

      const result = generateTheoreticalSchedule([], [freeDailyTask]);
      for (let d = 0; d < 7; d++) {
        expect(result.dayBlocks[d].some((b) => b.taskId === 'everyday-habit')).toBe(true);
      }
    });

    it('空列（オフ日）を含む4日周期のタスクで、オフ日の曜日には何も配置されないこと', () => {
      // 4日周期: Day 1 (胸: 0), Day 2 (背中: 1), Day 3 はオフ(タスクなし), Day 4 (脚: 3)
      const chestTask: TaskItem = {
        id: 'chest',
        title: '胸トレ',
        durationMinutes: 30,
        priority: 'high',
        category: 'must',
        period: 'day',
        cycleIndex: 0,
        cycleCount: 4,
      };

      const backTask: TaskItem = {
        id: 'back',
        title: '背中トレ',
        durationMinutes: 30,
        priority: 'high',
        category: 'must',
        period: 'day',
        cycleIndex: 1,
        cycleCount: 4,
      };

      const legTask: TaskItem = {
        id: 'leg',
        title: '脚トレ',
        durationMinutes: 30,
        priority: 'high',
        category: 'must',
        period: 'day',
        cycleIndex: 3,
        cycleCount: 4,
      };

      const result = generateTheoreticalSchedule([], [chestTask, backTask, legTask]);

      // 月曜 (d=0, 0%4=0): 胸トレ
      expect(result.dayBlocks[0].some((b) => b.taskId === 'chest')).toBe(true);
      // 火曜 (d=1, 1%4=1): 背中トレ
      expect(result.dayBlocks[1].some((b) => b.taskId === 'back')).toBe(true);
      // 水曜 (d=2, 2%4=2): オフ日（胸・背中・脚のいずれも配置されない）
      expect(result.dayBlocks[2].some((b) => b.taskId === 'chest' || b.taskId === 'back' || b.taskId === 'leg')).toBe(false);
      // 木曜 (d=3, 3%4=3): 脚トレ
      expect(result.dayBlocks[3].some((b) => b.taskId === 'leg')).toBe(true);
      // 金曜 (d=4, 4%4=0): 胸トレ
      expect(result.dayBlocks[4].some((b) => b.taskId === 'chest')).toBe(true);
      // 土曜 (d=5, 5%4=1): 背中トレ
      expect(result.dayBlocks[5].some((b) => b.taskId === 'back')).toBe(true);
      // 日曜 (d=6, 6%4=2): オフ日（胸・背中・脚のいずれも配置されない）
      expect(result.dayBlocks[6].some((b) => b.taskId === 'chest' || b.taskId === 'back' || b.taskId === 'leg')).toBe(false);
    });

    it('複数曜日 targetDays: [0, 3] を持つ週次タスクが月曜と木曜にのみ正確に配置されること', () => {
      const task: TaskItem = {
        id: 'chest-multi-day',
        title: '胸トレ',
        durationMinutes: 45,
        priority: 'high',
        category: '筋トレ表',
        period: 'week',
        targetDays: [0, 3], // 月曜 (0) と 木曜 (3)
        frequencyCount: 2,
      };

      const result = generateTheoreticalSchedule([], [task]);

      expect(result.dayBlocks[0].some((b) => b.taskId === 'chest-multi-day')).toBe(true);
      expect(result.dayBlocks[1].some((b) => b.taskId === 'chest-multi-day')).toBe(false);
      expect(result.dayBlocks[2].some((b) => b.taskId === 'chest-multi-day')).toBe(false);
      expect(result.dayBlocks[3].some((b) => b.taskId === 'chest-multi-day')).toBe(true);
      expect(result.dayBlocks[4].some((b) => b.taskId === 'chest-multi-day')).toBe(false);
      expect(result.dayBlocks[5].some((b) => b.taskId === 'chest-multi-day')).toBe(false);
      expect(result.dayBlocks[6].some((b) => b.taskId === 'chest-multi-day')).toBe(false);
    });

    it('複数周期日 cycleDays: [0, 2] (3日周期) を持つタスクが該当曜日にのみ配置されること', () => {
      // 3日周期: Day 1 (0) と Day 3 (2) のみ実施、Day 2 (1) はオフ
      // 曜日mod3: 月(0), 火(1:オフ), 水(2), 木(0), 金(1:オフ), 土(2), 日(0)
      const task: TaskItem = {
        id: 'cycle-multi',
        title: 'プロテイン摂取',
        durationMinutes: 30,
        priority: 'high',
        category: '日課表',
        period: 'week',
        cycleDays: [0, 2],
        cycleCount: 3,
        frequencyCount: 2,
      };

      const result = generateTheoreticalSchedule([], [task]);

      expect(result.dayBlocks[0].some((b) => b.taskId === 'cycle-multi')).toBe(true); // 月 (0)
      expect(result.dayBlocks[1].some((b) => b.taskId === 'cycle-multi')).toBe(false); // 火 (1: オフ)
      expect(result.dayBlocks[2].some((b) => b.taskId === 'cycle-multi')).toBe(true); // 水 (2)
      expect(result.dayBlocks[3].some((b) => b.taskId === 'cycle-multi')).toBe(true); // 木 (0)
      expect(result.dayBlocks[4].some((b) => b.taskId === 'cycle-multi')).toBe(false); // 金 (1: オフ)
      expect(result.dayBlocks[5].some((b) => b.taskId === 'cycle-multi')).toBe(true); // 土 (2)
      expect(result.dayBlocks[6].some((b) => b.taskId === 'cycle-multi')).toBe(true); // 日 (0)
    });

    it('dailyCount: 2 の日次タスクが1日の中に2回配置されること', () => {
      const task: TaskItem = {
        id: 'daily-twice',
        title: 'プロテイン',
        durationMinutes: 15,
        priority: 'high',
        category: '日課表',
        period: 'day',
        dailyCount: 2, // 1日2回！
      };

      const result = generateTheoreticalSchedule([], [task]);

      // 各曜日に2回ずつ配置されていること
      for (let d = 0; d < 7; d++) {
        const count = result.dayBlocks[d].filter((b) => b.taskId === 'daily-twice').length;
        expect(count).toBe(2);
      }
    });

    it('一日の繰り返し回数が自動(dailyRepeatMode: auto)なタスクは、空き時間に敷き詰められること', () => {
      // 10:00〜12:00 (120分) の空きスロットがある固定枠
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 600, // 00:00〜10:00
          color: '#6366f1',
        },
        {
          id: 'work',
          title: '仕事',
          category: 'work',
          startMinutes: 720, // 12:00〜24:00
          endMinutes: 1440,
          color: '#3b82f6',
        },
      ];

      // 30分の自動日次タスク (10:00〜12:00の120分枠に4回敷き詰められるはず)
      const autoTask: TaskItem = {
        id: 'auto-study',
        title: '自動: 読書・自習',
        durationMinutes: 30,
        priority: 'high',
        category: 'routine',
        period: 'day',
        dailyRepeatMode: 'auto',
      };

      const result = generateTheoreticalSchedule(fixedSlots, [autoTask]);

      // 月曜 (dayIndex: 0) の空き枠 10:00〜12:00 (120分) に 30分タスクが4回敷き詰められる
      const mondayBlocks = result.dayBlocks[0].filter((b) => b.taskId === 'auto-study');
      expect(mondayBlocks.length).toBe(4);
      expect(mondayBlocks[0].startMinutes).toBe(600); // 10:00
      expect(mondayBlocks[0].endMinutes).toBe(630); // 10:30
      expect(mondayBlocks[1].startMinutes).toBe(630); // 10:30
      expect(mondayBlocks[1].endMinutes).toBe(660); // 11:00
      expect(mondayBlocks[2].startMinutes).toBe(660); // 11:00
      expect(mondayBlocks[2].endMinutes).toBe(690); // 11:30
      expect(mondayBlocks[3].startMinutes).toBe(690); // 11:30
      expect(mondayBlocks[3].endMinutes).toBe(720); // 12:00
    });
  });
});

