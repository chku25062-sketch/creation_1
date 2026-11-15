import { describe, it, expect } from 'vitest';
import {
  normalizeFixedSlots,
  calculateFreeSlots,
  generateTheoreticalSchedule,
  getAdjustedDuration,
  classifyWeeklyTask,
  classifyWeeklyBlock,
  classifyDailyBlock,
} from './scheduler';
import { FixedSlot, TaskItem, TheoreticalBlock } from '@/types';

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

    it('タスクの latestEndTime（終了上限時刻）を超えない空き時間にのみタスクが配置されること', () => {
      // 00:00〜08:00 (0〜480分) 睡眠、12:00〜24:00 (720〜1440分) 仕事
      // 空き時間は 08:00〜12:00 (480〜720分) のみ
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 480,
          color: '#6366f1',
        },
        {
          id: 'work',
          title: '仕事',
          category: 'work',
          startMinutes: 720,
          endMinutes: 1440,
          color: '#0284c7',
        },
      ];

      // タスクの終了上限が 10:00 (600分) の場合、08:00〜09:00 に配置可能
      const taskWithLimit: TaskItem = {
        id: 'task-morning',
        title: '朝の学習',
        durationMinutes: 60,
        priority: 'high',
        category: 'study',
        period: 'day',
        dailyCount: 1,
        latestEndTime: 600, // 10:00 まで
      };

      // タスクの終了上限が 08:30 (510分) で所要時間60分の場合、空き時間は480から始まるため510までに完了できず配置不可
      const taskCannotFit: TaskItem = {
        id: 'task-too-late',
        title: '入り切らないタスク',
        durationMinutes: 60,
        priority: 'high',
        category: 'study',
        period: 'day',
        dailyCount: 1,
        latestEndTime: 510, // 08:30 まで (480+60=540分でオーバー)
      };

      const result = generateTheoreticalSchedule(fixedSlots, [taskWithLimit, taskCannotFit]);

      // taskWithLimit は 08:00〜09:00 (480〜540分) に配置され、10:00 (600分) 以内に収まる
      const placedMorning = result.blocks.find((b) => b.title === '朝の学習');
      expect(placedMorning).toBeDefined();
      expect(placedMorning!.endMinutes).toBeLessThanOrEqual(600);

      // taskCannotFit は上限時間を超えてしまうため配置されない
      const placedCannotFit = result.blocks.find((b) => b.title === '入り切らないタスク');
      expect(placedCannotFit).toBeUndefined();
    });

    it('付随タスク（isAttachedTask）は直後である必要はなく空き枠に柔軟に配置され、同じ日のタスクとして優先配置されること', () => {
      // 00:00〜07:00 睡眠
      // 07:00〜09:00 空き枠（本コマの前）
      // 09:00〜10:30 固定枠「線形代数」
      // 10:30〜12:00 空き枠（本コマの後）
      // 12:00〜24:00 その他固定枠
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 420,
          color: '#6366f1',
          daysOfWeek: [0],
        },
        {
          id: 'slot-math',
          title: '線形代数',
          category: 'lecture',
          startMinutes: 540,
          endMinutes: 630, // 10:30
          color: '#0369a1',
          daysOfWeek: [0],
        },
        {
          id: 'slot-other',
          title: 'アルバイト',
          category: 'work',
          startMinutes: 720,
          endMinutes: 1440,
          color: '#0284c7',
          daysOfWeek: [0],
        },
      ];

      // 一般の日常タスク（優先度高）
      const normalTask: TaskItem = {
        id: 'task-normal',
        title: '一般タスク',
        durationMinutes: 30,
        priority: 'high',
        category: 'want',
        period: 'day',
        targetDays: [0],
      };

      // 「線形代数」の付随タスク（所要時間15分）
      // 直後強制はないため、同じ日の空き枠があれば最優先で配置される
      const attachedTask: TaskItem = {
        id: 'task-attached-math',
        title: '線形代数 のタスク',
        durationMinutes: 15,
        priority: 'high',
        category: 'lecture',
        period: 'week',
        frequencyCount: 1,
        dailyCount: 1,
        isAttachedTask: true,
        parentTitle: '線形代数',
        targetDays: [0],
      };

      const result = generateTheoreticalSchedule(fixedSlots, [normalTask, attachedTask]);

      // 月曜日の配置ブロックを確認
      const mondayBlocks = result.dayBlocks[0];
      const placedAttached = mondayBlocks.find((b) => b.title === '線形代数 のタスク');
      expect(placedAttached).toBeDefined();
      // 朝の空き枠（07:00〜09:00 = 420〜540分）ではなく、元タスク終了（630分）以降の空き枠に配置されること
      expect(placedAttached!.startMinutes).toBeGreaterThanOrEqual(630);
      expect(placedAttached!.endMinutes).toBeLessThanOrEqual(720);
    });

    it('タスクの指定区間自動配置（earliestStartTime 〜 latestEndTime）のオプションが正しく機能すること', () => {
      // 00:00〜07:00 睡眠 (0〜420分)
      // 07:00〜09:00 早朝空き枠 (420〜540分)
      // 09:00〜12:00 午前作業 (540〜720分)
      // 12:00〜13:00 昼空き枠 (720〜780分)
      // 13:00〜18:00 午後作業 (780〜1080分)
      // 18:00〜24:00 夜空き枠 (1080〜1440分)
      const fixedSlots: FixedSlot[] = [
        {
          id: 'slot-sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 420,
          color: '#6366f1',
          daysOfWeek: [1], // 火曜
        },
        {
          id: 'slot-work-am',
          title: '午前作業',
          category: 'work',
          startMinutes: 540,
          endMinutes: 720,
          color: '#0284c7',
          daysOfWeek: [1],
        },
        {
          id: 'slot-work-pm',
          title: '午後作業',
          category: 'work',
          startMinutes: 780,
          endMinutes: 1080,
          color: '#0284c7',
          daysOfWeek: [1],
        },
      ];

      // 指定区間: 09:00〜18:00 (540〜1080分) の自動配置タスク
      // 早朝（420〜540）や夜間（1080〜）は区間外のため、昼の空き枠（720〜780分）にのみ自動配置されるはず
      const rangeTask: TaskItem = {
        id: 'task-range-auto',
        title: '日中指定タスク',
        durationMinutes: 45,
        priority: 'high',
        category: 'study',
        period: 'day',
        targetDays: [1],
        earliestStartTime: 540, // 09:00以降
        latestEndTime: 1080, // 18:00まで
        autoPlaceWithinRange: true,
      };

      const result = generateTheoreticalSchedule(fixedSlots, [rangeTask]);
      const tuesdayBlocks = result.dayBlocks[1];
      const placed = tuesdayBlocks.find((b) => b.title === '日中指定タスク');
      expect(placed).toBeDefined();
      expect(placed!.startMinutes).toBe(720); // 12:00〜
      expect(placed!.endMinutes).toBe(765); // 12:45
    });

    it('同一日に空き枠がない場合、別日に回され、その別日ではその日のタスクが優先されること（週1回・日繰り返しなし）', () => {
      // 月曜 (dayIndex: 0):
      // 00:00〜07:00 睡眠
      // 09:00〜10:30 固定枠「物理学」
      // 10:30〜24:00 アルバイト等で月曜日は完全に満杯（空き時間なし）
      // 火曜 (dayIndex: 1):
      // 00:00〜07:00 睡眠
      // 08:00〜09:00 (480〜540分) に火曜の空き枠
      // 09:00〜10:00 (540〜600分) に火曜の通常タスク「火曜レポート」
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep-mon',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 540,
          color: '#6366f1',
          daysOfWeek: [0],
        },
        {
          id: 'slot-physics',
          title: '物理学',
          category: 'lecture',
          startMinutes: 540,
          endMinutes: 630, // 09:00〜10:30
          color: '#0369a1',
          daysOfWeek: [0],
        },
        {
          id: 'work-mon',
          title: 'バイト',
          category: 'work',
          startMinutes: 630,
          endMinutes: 1440, // 10:30以降隙間なし
          color: '#0284c7',
          daysOfWeek: [0],
        },
        // 火曜
        {
          id: 'sleep-tue',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 480,
          color: '#6366f1',
          daysOfWeek: [1],
        },
        {
          id: 'work-tue',
          title: '火曜午後予定',
          category: 'work',
          startMinutes: 540,
          endMinutes: 1440, // 09:00以降埋まり
          color: '#0284c7',
          daysOfWeek: [1],
        },
      ];

      // 火曜日の通常タスク（30分）
      const tuesdayNativeTask: TaskItem = {
        id: 'tue-task',
        title: '火曜の予習',
        durationMinutes: 30,
        priority: 'medium',
        category: 'study',
        period: 'day',
        targetDays: [1],
      };

      // 月曜の「物理学」の付随タスク（所要時間15分、週1回）
      const attachedTask: TaskItem = {
        id: 'task-attached-physics',
        title: '物理学 のタスク',
        durationMinutes: 15,
        priority: 'high',
        category: 'lecture',
        period: 'week',
        frequency: 'custom',
        frequencyCount: 1,
        dailyCount: 1,
        dailyRepeatMode: 'custom',
        isAttachedTask: true,
        parentTitle: '物理学',
        parentEndMinutesByDay: { 0: 630 },
        targetDays: [0],
      };

      const result = generateTheoreticalSchedule(fixedSlots, [tuesdayNativeTask, attachedTask]);

      // 月曜には空きがないため物理学のタスクは入らない
      expect(result.dayBlocks[0].some((b) => b.title === '物理学 のタスク')).toBe(false);

      // 火曜日にフォールバックして配置される
      const tueBlocks = result.dayBlocks[1];
      const placedAttached = tueBlocks.find((b) => b.title === '物理学 のタスク');
      expect(placedAttached).toBeDefined();

      // ★ 別日（火曜）では「その別日のタスク（火曜の予習）」が優先される！
      // 火曜の空き時間は 480〜540分 (08:00〜09:00)。
      // 先に火曜の予習 (30分: 480〜510分) が入り、その後に物理学のタスク (15分: 510〜525分) が入ること！
      const placedTueNative = tueBlocks.find((b) => b.title === '火曜の予習');
      expect(placedTueNative).toBeDefined();
      expect(placedTueNative!.startMinutes).toBe(480);
      expect(placedTueNative!.endMinutes).toBe(510);
      expect(placedAttached!.startMinutes).toBe(510);
      expect(placedAttached!.endMinutes).toBe(525);

      // ★ 週1回のみで、水曜以降には配置されないこと
      for (let d = 2; d < 7; d++) {
        expect(result.dayBlocks[d].some((b) => b.title === '物理学 のタスク')).toBe(false);
      }
    });

    it('付随タスクは元タスクより後の時間帯に配置される週タスクとして、終了時間制限なしで配置されること', () => {
      // 月曜: 09:00〜10:30 (540〜630分) に本タスク「ゼミ」
      // 10:30〜22:00 (630〜1320分) は予定埋まり
      // 22:30〜24:00 (1350〜1440分) に夜の空き枠
      const fixedSlots: FixedSlot[] = [
        {
          id: 'slot-mon-seminar',
          title: 'ゼミ',
          category: 'lecture',
          startMinutes: 540,
          endMinutes: 630,
          color: '#0284c7',
          daysOfWeek: [0],
        },
        {
          id: 'slot-mon-busy',
          title: 'アルバイト',
          category: 'work',
          startMinutes: 630,
          endMinutes: 1350, // 22:30まで埋まっている
          color: '#0284c7',
          daysOfWeek: [0],
        },
      ];

      const attachedTask: TaskItem = {
        id: 'task-attached-seminar',
        title: 'ゼミ のタスク',
        durationMinutes: 15,
        priority: 'high',
        category: 'lecture',
        period: 'week',
        frequencyCount: 1,
        dailyCount: 1,
        isAttachedTask: true,
        parentTitle: 'ゼミ',
        parentEndMinutesByDay: { 0: 630 },
        targetDays: [0],
      };

      const result = generateTheoreticalSchedule(fixedSlots, [attachedTask]);

      // 元タスク終了以降の夜間枠（1350分〜）に終了時刻制限なしで配置されること
      const monBlocks = result.dayBlocks[0];
      const placed = monBlocks.find((b) => b.title === 'ゼミ のタスク');
      expect(placed).toBeDefined();
      expect(placed!.startMinutes).toBe(1350); // 22:30〜
      expect(placed!.endMinutes).toBe(1365); // 22:45 (15分枠)
    });

    it('付随タスクの所要時間が表データで指定された分数（例: 45分や10分）通りに配置され、25分に固定されないこと', () => {
      // 09:00〜10:30 (540〜630分) 本タスク
      // 10:30〜12:00 (630〜720分: 90分間の空き枠)
      const fixedSlots: FixedSlot[] = [
        {
          id: 'slot-lecture',
          title: 'プログラミング演習',
          category: 'lecture',
          startMinutes: 540,
          endMinutes: 630,
          color: '#0284c7',
          daysOfWeek: [0],
        },
      ];

      // 表データで 45分 と指定された付随タスク
      const attachedTask45: TaskItem = {
        id: 'task-attached-45',
        title: 'プログラミング演習 のタスク',
        durationMinutes: 45,
        priority: 'high',
        category: 'lecture',
        period: 'week',
        frequencyCount: 1,
        dailyCount: 1,
        isAttachedTask: true,
        parentTitle: 'プログラミング演習',
        parentEndMinutesByDay: { 0: 630 },
        targetDays: [0],
      };

      const result = generateTheoreticalSchedule(fixedSlots, [attachedTask45]);
      const monBlocks = result.dayBlocks[0];
      const placed = monBlocks.find((b) => b.title === 'プログラミング演習 のタスク');
      expect(placed).toBeDefined();
      expect(placed!.startMinutes).toBe(630);
      // 25分ではなく、指定通りの 45分 (630〜675分) になること！
      expect(placed!.endMinutes).toBe(675);
    });

    it('木曜・金曜の授業への付随タスクが当日に十分な空き時間がある場合、月火水に奪われず確実に当日に配置されること', () => {
      // 月・火・水・木・金すべてに 09:00〜18:00 (540〜1080分) の空き時間がある状態
      // 木曜（3）に 13:00〜14:30 (780〜870分) の木曜講義
      // 金曜（4）に 10:40〜12:10 (640〜730分) の金曜講義
      const fixedSlots: FixedSlot[] = [
        // 睡眠（全曜日 00:00〜08:00 = 0〜480分、23:00〜24:00 = 1380〜1440分）
        {
          id: 'slot-sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 480,
          color: '#6366f1',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
        {
          id: 'slot-night',
          title: '就寝準備',
          category: 'sleep',
          startMinutes: 1380,
          endMinutes: 1440,
          color: '#6366f1',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
        // 木曜講義
        {
          id: 'slot-thu-lecture',
          title: '木曜ゼミ (401教室)',
          category: 'lecture',
          startMinutes: 780,
          endMinutes: 870,
          color: '#0284c7',
          daysOfWeek: [3],
        },
        // 金曜講義
        {
          id: 'slot-fri-lecture',
          title: '金曜実験 (情報棟)',
          category: 'lecture',
          startMinutes: 640,
          endMinutes: 730,
          color: '#0284c7',
          daysOfWeek: [4],
        },
      ];

      // 木曜ゼミの付随タスク（15分）
      const thuAttached: TaskItem = {
        id: 'task-attached-thu',
        title: '木曜ゼミ (401教室) のタスク',
        durationMinutes: 15,
        priority: 'high',
        category: 'lecture',
        period: 'week',
        frequencyCount: 1,
        dailyCount: 1,
        isAttachedTask: true,
        parentTitle: '木曜ゼミ (401教室)',
        parentEndMinutesByDay: { 3: 870 },
        targetDays: [3],
      };

      // 金曜実験の付随タスク（30分）
      const friAttached: TaskItem = {
        id: 'task-attached-fri',
        title: '金曜実験 (情報棟) のタスク',
        durationMinutes: 30,
        priority: 'high',
        category: 'lecture',
        period: 'week',
        frequencyCount: 1,
        dailyCount: 1,
        isAttachedTask: true,
        parentTitle: '金曜実験 (情報棟)',
        parentEndMinutesByDay: { 4: 730 },
        targetDays: [4],
      };

      const result = generateTheoreticalSchedule(fixedSlots, [thuAttached, friAttached]);

      // 月曜(0)、火曜(1)、水曜(2)には絶対に配置されないこと！
      for (const d of [0, 1, 2]) {
        expect(result.dayBlocks[d].some((b) => b.title === '木曜ゼミ (401教室) のタスク')).toBe(
          false,
        );
        expect(result.dayBlocks[d].some((b) => b.title === '金曜実験 (情報棟) のタスク')).toBe(
          false,
        );
      }

      // 木曜（3）に木曜ゼミのタスクが、親タスク終了（870分）以降に配置されること
      const thuBlocks = result.dayBlocks[3];
      const placedThu = thuBlocks.find((b) => b.title === '木曜ゼミ (401教室) のタスク');
      expect(placedThu).toBeDefined();
      expect(placedThu!.startMinutes).toBeGreaterThanOrEqual(870);
      expect(placedThu!.endMinutes - placedThu!.startMinutes).toBe(15);

      // 金曜（4）に金曜実験のタスクが、親タスク終了（730分）以降に配置されること
      const friBlocks = result.dayBlocks[4];
      const placedFri = friBlocks.find((b) => b.title === '金曜実験 (情報棟) のタスク');
      expect(placedFri).toBeDefined();
      expect(placedFri!.startMinutes).toBeGreaterThanOrEqual(730);
      expect(placedFri!.endMinutes - placedFri!.startMinutes).toBe(30);
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
      expect(
        result.dayBlocks[2].some(
          (b) => b.taskId === 'chest' || b.taskId === 'back' || b.taskId === 'leg',
        ),
      ).toBe(false);
      // 木曜 (d=3, 3%4=3): 脚トレ
      expect(result.dayBlocks[3].some((b) => b.taskId === 'leg')).toBe(true);
      // 金曜 (d=4, 4%4=0): 胸トレ
      expect(result.dayBlocks[4].some((b) => b.taskId === 'chest')).toBe(true);
      // 土曜 (d=5, 5%4=1): 背中トレ
      expect(result.dayBlocks[5].some((b) => b.taskId === 'back')).toBe(true);
      // 日曜 (d=6, 6%4=2): オフ日（胸・背中・脚のいずれも配置されない）
      expect(
        result.dayBlocks[6].some(
          (b) => b.taskId === 'chest' || b.taskId === 'back' || b.taskId === 'leg',
        ),
      ).toBe(false);
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

    it('タスク後の休憩時間 (breakMinutes) が設定されたタスクについて、タスク直後に休憩ブロックが自動生成されること', () => {
      // 10:00〜12:00 (120分) の空きスロット
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

      // 45分作業 + 15分休憩 の日次タスク (1日1回)
      const taskWithBreak: TaskItem = {
        id: 'study-with-break',
        title: '集中学習',
        durationMinutes: 45,
        breakMinutes: 15,
        priority: 'high',
        category: 'study',
        period: 'day',
        dailyCount: 1,
        dailyRepeatMode: 'custom',
      };

      const result = generateTheoreticalSchedule(fixedSlots, [taskWithBreak]);
      const mondayBlocks = result.dayBlocks[0];

      // 作業ブロック本体
      const workBlock = mondayBlocks.find((b) => b.taskId === 'study-with-break');
      expect(workBlock).toBeDefined();
      expect(workBlock?.startMinutes).toBe(600); // 10:00
      expect(workBlock?.endMinutes).toBe(645); // 10:45
      expect(workBlock?.breakMinutes).toBe(15); // タスク自身が余白情報を保持

      // 独立した休憩ブロックは生成されないこと（余白としてタスクを入れない空間になる）
      const breakBlock = mondayBlocks.find((b) => b.isBreak);
      expect(breakBlock).toBeUndefined();
    });

    it('自動敷き詰め (dailyRepeatMode: auto) に breakMinutes がある場合、作業＋余白のセットで空き枠に敷き詰められること', () => {
      // 10:00〜12:00 (120分) の空きスロット
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 600,
          color: '#6366f1',
        },
        {
          id: 'work',
          title: '仕事',
          category: 'work',
          startMinutes: 720,
          endMinutes: 1440,
          color: '#3b82f6',
        },
      ];

      // 45分作業 + 15分余白 = 60分セット。120分空きに 2セット配置される
      const autoTask: TaskItem = {
        id: 'pomodoro-task',
        title: 'ポモドーロ作業',
        durationMinutes: 45,
        breakMinutes: 15,
        priority: 'high',
        category: 'routine',
        period: 'day',
        dailyRepeatMode: 'auto',
      };

      const result = generateTheoreticalSchedule(fixedSlots, [autoTask]);
      const mondayBlocks = result.dayBlocks[0];

      const workBlocks = mondayBlocks.filter((b) => b.taskId === 'pomodoro-task');
      const breakBlocks = mondayBlocks.filter((b) => b.isBreak);

      // 2セット配置され、独立した休憩ブロックは0件
      expect(workBlocks.length).toBe(2);
      expect(breakBlocks.length).toBe(0);

      // セット1: 10:00〜10:45 (作業)
      expect(workBlocks[0].startMinutes).toBe(600);
      expect(workBlocks[0].endMinutes).toBe(645);
      expect(workBlocks[0].breakMinutes).toBe(15);

      // セット2: 11:00〜11:45 (余白15分空けた後に開始)
      expect(workBlocks[1].startMinutes).toBe(660); // 10:45〜11:00 はタスクを入れない余白
      expect(workBlocks[1].endMinutes).toBe(705);
      expect(workBlocks[1].breakMinutes).toBe(15);
    });

    it('複数の自動タスクがある場合、1つ目の配置後も特定のタスクのみに偏らず、バランスよく交互・均等に配置されること', () => {
      // 9:00〜18:00 (540分) の空きスロット
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 540,
          color: '#6366f1',
        },
        {
          id: 'night',
          title: '夜・睡眠',
          category: 'sleep',
          startMinutes: 1080,
          endMinutes: 1440,
          color: '#3b82f6',
        },
      ];

      // 所要時間が異なる2つの自動タスク
      const taskA: TaskItem = {
        id: 'auto-task-a',
        title: '自動タスクA (60分)',
        durationMinutes: 60,
        priority: 'high',
        category: 'study',
        period: 'day',
        dailyRepeatMode: 'auto',
      };

      const taskB: TaskItem = {
        id: 'auto-task-b',
        title: '自動タスクB (45分)',
        durationMinutes: 45,
        priority: 'medium',
        category: 'work',
        period: 'day',
        dailyRepeatMode: 'auto',
      };

      const result = generateTheoreticalSchedule(fixedSlots, [taskA, taskB]);
      const mondayBlocks = result.dayBlocks[0].filter((b) => !b.isFixed);

      const countA = mondayBlocks.filter((b) => b.taskId === 'auto-task-a').length;
      const countB = mondayBlocks.filter((b) => b.taskId === 'auto-task-b').length;

      // どちらかのタスクのみに偏らず、両方とも複数回配置され、回数差が最大でも1以内であること
      expect(countA).toBeGreaterThan(1);
      expect(countB).toBeGreaterThan(1);
      expect(Math.abs(countA - countB)).toBeLessThanOrEqual(1);

      // 時系列で見て、同じタスクが不当に連続せず交互に配置されていること
      for (let i = 0; i < mondayBlocks.length - 1; i++) {
        // 直前直後が同一タスク連続にならないこと
        expect(mondayBlocks[i].taskId).not.toBe(mondayBlocks[i + 1].taskId);
      }
    });

    it('1巡目は1回以上のタスク、2巡目は2回以上のタスク、3巡目は3回以上のタスクが順に配置されること', () => {
      // 9:00〜19:00 (600分) の空きスロット
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 540, // 09:00
          color: '#6366f1',
        },
        {
          id: 'night',
          title: '夜',
          category: 'sleep',
          startMinutes: 1140, // 19:00
          endMinutes: 1440,
          color: '#3b82f6',
        },
      ];

      // 4種類のタスク: 1回、2回、3回、自動(auto)
      const task1: TaskItem = {
        id: 'task-1-time',
        title: '1回タスク',
        durationMinutes: 30,
        priority: 'high',
        category: 'study',
        period: 'day',
        dailyCount: 1,
        dailyRepeatMode: 'custom',
      };

      const task2: TaskItem = {
        id: 'task-2-times',
        title: '2回タスク',
        durationMinutes: 30,
        priority: 'high',
        category: 'workout',
        period: 'day',
        dailyCount: 2,
        dailyRepeatMode: 'custom',
      };

      const task3: TaskItem = {
        id: 'task-3-times',
        title: '3回タスク',
        durationMinutes: 30,
        priority: 'high',
        category: 'routine',
        period: 'day',
        dailyCount: 3,
        dailyRepeatMode: 'custom',
      };

      const taskAuto: TaskItem = {
        id: 'task-auto',
        title: '自動タスク',
        durationMinutes: 30,
        priority: 'high',
        category: 'creative',
        period: 'day',
        dailyRepeatMode: 'auto',
      };

      const result = generateTheoreticalSchedule(fixedSlots, [task1, task2, task3, taskAuto]);
      const mondayBlocks = result.dayBlocks[0].filter((b) => !b.isFixed && !b.isBreak);

      // 各タスクの総配置回数
      const count1 = mondayBlocks.filter((b) => b.taskId === 'task-1-time').length;
      const count2 = mondayBlocks.filter((b) => b.taskId === 'task-2-times').length;
      const count3 = mondayBlocks.filter((b) => b.taskId === 'task-3-times').length;
      const countAuto = mondayBlocks.filter((b) => b.taskId === 'task-auto').length;

      // 1回タスクは1回、2回タスクは2回、3回タスクは3回、自動タスクはそれ以上配置されていること
      expect(count1).toBe(1);
      expect(count2).toBe(2);
      expect(count3).toBe(3);
      expect(countAuto).toBeGreaterThanOrEqual(3);

      // 最初の4ブロック（1巡目）には、全4種類のタスクが含まれていること
      const firstPassTasks = mondayBlocks.slice(0, 4).map((b) => b.taskId);
      expect(firstPassTasks).toContain('task-1-time');
      expect(firstPassTasks).toContain('task-2-times');
      expect(firstPassTasks).toContain('task-3-times');
      expect(firstPassTasks).toContain('task-auto');

      // 次の3ブロック（2巡目）には、2回以上繰り返す3種類のタスクが含まれ、1回タスクは含まれないこと
      const secondPassTasks = mondayBlocks.slice(4, 7).map((b) => b.taskId);
      expect(secondPassTasks).not.toContain('task-1-time');
      expect(secondPassTasks).toContain('task-2-times');
      expect(secondPassTasks).toContain('task-3-times');
      expect(secondPassTasks).toContain('task-auto');

      // その次の2ブロック（3巡目）には、3回以上繰り返す2種類のタスクが含まれ、1回・2回タスクは含まれないこと
      const thirdPassTasks = mondayBlocks.slice(7, 9).map((b) => b.taskId);
      expect(thirdPassTasks).not.toContain('task-1-time');
      expect(thirdPassTasks).not.toContain('task-2-times');
      expect(thirdPassTasks).toContain('task-3-times');
      expect(thirdPassTasks).toContain('task-auto');

      // それ以降（4巡目以降）は自動タスクのみが残りの空き枠を埋めていること
      const remainingTasks = mondayBlocks.slice(9).map((b) => b.taskId);
      for (const tId of remainingTasks) {
        expect(tId).toBe('task-auto');
      }
    });

    it('空き枠配置において週タスクが優先配置されたうえで、残りの枠に日タスクが再配置されること', () => {
      // 9:00〜18:00 (540分) の空きスロット
      const fixedSlots: FixedSlot[] = [
        {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 540,
          color: '#6366f1',
        },
        {
          id: 'night',
          title: '夜',
          category: 'sleep',
          startMinutes: 1080,
          endMinutes: 1440,
          color: '#3b82f6',
        },
      ];

      // 「日（day）」に分類されたタスク
      const dailyTask: TaskItem = {
        id: 'daily-task-study',
        title: '資格学習（日タスク）',
        durationMinutes: 60,
        priority: 'high',
        category: 'study',
        period: 'day',
      };

      // 「週（week）」に分類されたタスク（週3回目標、月曜に割り当てられる）
      const weeklyTask: TaskItem = {
        id: 'weekly-task-dev',
        title: 'プロダクト開発（週タスク）',
        durationMinutes: 60,
        priority: 'high',
        category: 'creative',
        period: 'week',
        frequency: 'medium', // 週3回
        targetDays: [0, 2, 4], // 月・水・金
      };

      const result = generateTheoreticalSchedule(fixedSlots, [dailyTask, weeklyTask]);
      const mondayBlocks = result.dayBlocks[0].filter((b) => !b.isFixed && !b.isBreak);

      const dailyCount = mondayBlocks.filter((b) => b.taskId === 'daily-task-study').length;
      const weeklyCount = mondayBlocks.filter((b) => b.taskId === 'weekly-task-dev').length;

      // 週タスクがまず確実に配置され、残りの空き枠に日タスクが再配置・敷き詰められること
      expect(weeklyCount).toBe(1);
      expect(dailyCount).toBeGreaterThanOrEqual(3);

      // 最初のブロックは優先配置された週タスクであること
      expect(mondayBlocks[0].taskId).toBe('weekly-task-dev');
    });

    it('固定枠に breakMinutes が指定されている場合、固定枠直後に休憩ブロックは生成されず余白として確保されること', () => {
      const fixedSlots: FixedSlot[] = [
        {
          id: 'slot-lecture-1',
          title: '数学講義',
          category: 'lecture',
          color: '#0284c7',
          startMinutes: 540, // 09:00
          endMinutes: 630, // 10:30
          breakMinutes: 10, // 10分休憩
          daysOfWeek: [0], // 月曜
        },
      ];

      const result = generateTheoreticalSchedule(fixedSlots, []);
      const mondayBlocks = result.dayBlocks[0];

      const lectureBlock = mondayBlocks.find((b) => b.id === 'block-fixed-0-slot-lecture-1');
      const breakBlock = mondayBlocks.find((b) => b.isBreak);

      expect(lectureBlock).toBeDefined();
      expect(lectureBlock?.startMinutes).toBe(540);
      expect(lectureBlock?.endMinutes).toBe(630);
      expect(lectureBlock?.breakMinutes).toBe(10);

      // 独立した休憩ブロックは生成されないこと（余白として空く）
      expect(breakBlock).toBeUndefined();
    });

    // =========================================================================
    // Plan11: リアルタイム完了状態 ＆ 動的再配置 ＆ 代行タスク（重ね合わせ）テスト
    // =========================================================================
    describe('Plan11: リアルタイム完了状態判定 ＆ 動的再配置 ＆ 代替タスク配置', () => {
      it('今の日付・時刻より前のタスクは週タスク以外は自動で完了状態（isCompleted: true, isAutoCompleted: true）となること', () => {
        // 水曜（dayIndex: 2）の 12:00（720分）を現在時刻コンテキストとする
        const realtimeContext = {
          todayIndex: 2, // 水曜
          currentMinutes: 720, // 12:00
        };

        const fixedSlots: FixedSlot[] = [
          {
            id: 'slot-mon-lecture',
            title: '月曜講義',
            category: 'lecture',
            startMinutes: 540,
            endMinutes: 630,
            color: '#0284c7',
            daysOfWeek: [0], // 月曜（過去）
          },
          {
            id: 'slot-wed-morning',
            title: '水曜午前講義',
            category: 'lecture',
            startMinutes: 540,
            endMinutes: 630,
            color: '#0284c7',
            daysOfWeek: [2], // 水曜（12:00より前 = 過去）
          },
          {
            id: 'slot-wed-afternoon',
            title: '水曜午後講義',
            category: 'lecture',
            startMinutes: 780,
            endMinutes: 870,
            color: '#0284c7',
            daysOfWeek: [2], // 水曜（12:00より後 = 未来）
          },
          {
            id: 'slot-fri-lecture',
            title: '金曜講義',
            category: 'lecture',
            startMinutes: 540,
            endMinutes: 630,
            color: '#0284c7',
            daysOfWeek: [4], // 金曜（未来）
          },
        ];

        // 日課タスク（毎日）
        const dailyRoutineTask: TaskItem = {
          id: 'task-daily-routine',
          title: 'ストレッチ・身支度',
          category: 'routine',
          durationMinutes: 30,
          period: 'day',
          frequency: 'high',
          priority: 'high',
        };

        const result = generateTheoreticalSchedule(fixedSlots, [dailyRoutineTask], realtimeContext);

        // 1. 月曜（過去曜日）の固定枠は自動完了
        const monLecture = result.dayBlocks[0].find((b) => b.title === '月曜講義');
        expect(monLecture).toBeDefined();
        expect(monLecture?.isCompleted).toBe(true);
        expect(monLecture?.isAutoCompleted).toBe(true);

        // 2. 水曜（今日）の12:00より前の固定枠は自動完了
        const wedMorning = result.dayBlocks[2].find((b) => b.title === '水曜午前講義');
        expect(wedMorning).toBeDefined();
        expect(wedMorning?.isCompleted).toBe(true);
        expect(wedMorning?.isAutoCompleted).toBe(true);

        // 3. 水曜（今日）の12:00より後の固定枠は未完了
        const wedAfternoon = result.dayBlocks[2].find((b) => b.title === '水曜午後講義');
        expect(wedAfternoon).toBeDefined();
        expect(wedAfternoon?.isCompleted).toBe(false);

        // 4. 金曜（未来曜日）の固定枠は未完了
        const friLecture = result.dayBlocks[4].find((b) => b.title === '金曜講義');
        expect(friLecture).toBeDefined();
        expect(friLecture?.isCompleted).toBe(false);
      });

      it('過去の週タスクは基本自動完了となるが、ユーザーが「まだ終わってないよ」とトグルした場合は未完了となり現在以降の空き枠へ再配置されること', () => {
        // 水曜（dayIndex: 2）の 10:00（600分）を現在時刻とする
        const mondayWeeklyTask: TaskItem = {
          id: 'task-weekly-assignment-mon',
          title: '月曜の数学レポート',
          category: 'must',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          taskType: 'assignment',
          targetDays: [0], // 月曜に配置
          priority: 'high',
        };

        // 1. 手動オーバーライドなし（デフォルト）の場合: 過去の月曜なので自動完了
        const defaultResult = generateTheoreticalSchedule([], [mondayWeeklyTask], {
          todayIndex: 2, // 水曜
          currentMinutes: 600,
        });
        const monBlock = defaultResult.dayBlocks[0].find((b) => b.title === '月曜の数学レポート');
        expect(monBlock).toBeDefined();
        expect(monBlock?.isCompleted).toBe(true);
        expect(monBlock?.isAutoCompleted).toBe(true);

        // 2. ユーザーが「まだ終わってないよ」と未完了トグルした場合
        const uncompletedResult = generateTheoreticalSchedule([], [mondayWeeklyTask], {
          todayIndex: 2, // 水曜
          currentMinutes: 600,
          uncompletedBlockIds: new Set([monBlock!.id]),
        });

        // 月曜の元ブロックは未完了（isCompleted: false）
        const uncompletedMonBlock = uncompletedResult.dayBlocks[0].find(
          (b) => b.title === '月曜の数学レポート',
        );
        expect(uncompletedMonBlock?.isCompleted).toBe(false);
        expect(uncompletedMonBlock?.isUserToggled).toBe(true);

        // そして、水曜（今日）以降の未来空き枠へ「再配置」ブロックが生成されていること
        const futureBlocks = [
          ...uncompletedResult.dayBlocks[2],
          ...uncompletedResult.dayBlocks[3],
          ...uncompletedResult.dayBlocks[4],
          ...uncompletedResult.dayBlocks[5],
          ...uncompletedResult.dayBlocks[6],
        ];
        const rescheduledBlock = futureBlocks.find(
          (b) => b.isRescheduled && b.title === '月曜の数学レポート',
        );
        expect(rescheduledBlock).toBeDefined();
        expect(rescheduledBlock?.rescheduledFromDay).toBe(0);
        expect(rescheduledBlock?.dayIndex).toBeGreaterThanOrEqual(2);
      });

      it('未来の週タスクを「もう終わっている」と早期完了した場合、その枠に代わりのタスクが重ねて配置されること', () => {
        // 木曜（dayIndex: 3）に予定されている週タスク
        const thursdayTask: TaskItem = {
          id: 'task-thursday-lecture-task',
          title: '木曜の物理演習',
          category: 'study',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          targetDays: [3], // 木曜
          priority: 'medium',
        };

        // 未配置の週タスク（または自動敷き詰めタスク）
        const unassignedTask: TaskItem = {
          id: 'task-extra-certification',
          title: '基本情報・資格対策',
          category: 'study',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          priority: 'low',
        };

        // 通常配置を確認
        const normalResult = generateTheoreticalSchedule([], [thursdayTask, unassignedTask], {
          todayIndex: 1, // 火曜
          currentMinutes: 600,
        });

        const thuBlock = normalResult.dayBlocks[3].find((b) => b.title === '木曜の物理演習');
        expect(thuBlock).toBeDefined();
        expect(thuBlock?.isCompleted).toBe(false);

        // ユーザーが木曜のタスクを「早期完了」トグル
        const earlyResult = generateTheoreticalSchedule([], [thursdayTask, unassignedTask], {
          todayIndex: 1, // 火曜
          currentMinutes: 600,
          completedBlockIds: new Set([thuBlock!.id]),
        });

        const updatedThuBlocks = earlyResult.dayBlocks[3];
        // 元のタスクは完了・前倒し完了フラグがつく
        const origThuBlock = updatedThuBlocks.find((b) => b.id === thuBlock!.id);
        expect(origThuBlock?.isCompleted).toBe(true);
        expect(origThuBlock?.isEarlyCompleted).toBe(true);

        // 同じ木曜の枠に「代わりのタスク（isSubstitute: true）」が重ねて生成されていること
        const substituteBlock = updatedThuBlocks.find((b) => b.isSubstitute);
        expect(substituteBlock).toBeDefined();
        expect(substituteBlock?.title).toBe('基本情報・資格対策');
        expect(substituteBlock?.startMinutes).toBe(origThuBlock?.startMinutes);
        expect(substituteBlock?.endMinutes).toBe(origThuBlock?.endMinutes);
        expect(substituteBlock?.substitutedForTitle).toBe('木曜の物理演習');
      });

      it('日課の自動敷き詰めタスクで空き時間が埋まっている環境でも、過去の週タスクを未完了にした場合に現在以降の枠へ確実に再配置されること', () => {
        // 水曜（dayIndex: 2）の 10:00（600分）を現在時刻とする
        const mondayWeeklyTask: TaskItem = {
          id: 'task-weekly-report-mon',
          title: '月曜の物理実験レポート',
          category: 'must',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          targetDays: [0], // 月曜に配置
          priority: 'high',
        };

        // 毎日空き枠を埋め尽くす日課の自動敷き詰めタスク（複数）
        const dailyAutoTask: TaskItem = {
          id: 'task-daily-fill',
          title: '日常学習',
          category: 'study',
          durationMinutes: 30,
          period: 'day',
          frequency: 'high',
          priority: 'low',
        };

        // 通常配置
        const normalResult = generateTheoreticalSchedule([], [mondayWeeklyTask, dailyAutoTask], {
          todayIndex: 2,
          currentMinutes: 600,
        });

        const monBlock = normalResult.dayBlocks[0].find(
          (b) => b.title === '月曜の物理実験レポート',
        );
        expect(monBlock).toBeDefined();

        // ユーザーが月曜のタスクを「未完了（まだ終わってないよ）」とトグル
        const toggledResult = generateTheoreticalSchedule([], [mondayWeeklyTask, dailyAutoTask], {
          todayIndex: 2, // 水曜
          currentMinutes: 600,
          uncompletedBlockIds: new Set([monBlock!.id]),
        });

        // 水曜（今日）以降の未来枠に再配置ブロックが確実に生成されていること
        const futureBlocks = [
          ...toggledResult.dayBlocks[2],
          ...toggledResult.dayBlocks[3],
          ...toggledResult.dayBlocks[4],
          ...toggledResult.dayBlocks[5],
          ...toggledResult.dayBlocks[6],
        ];

        const rescheduled = futureBlocks.find(
          (b) => b.isRescheduled && b.title === '月曜の物理実験レポート',
        );
        expect(rescheduled).toBeDefined();
        expect(rescheduled?.dayIndex).toBeGreaterThanOrEqual(2);
        // 今日の場合、現在時刻（600分）以降に配置されていること
        if (rescheduled?.dayIndex === 2) {
          expect(rescheduled.startMinutes).toBeGreaterThanOrEqual(600);
        }
      });

      it('未来の週タスクが未完了の場合でも、再配置プランが作成されず余計な再配置ブロックが増殖しないこと', () => {
        // 今日は火曜（dayIndex: 1, 10:00）とする
        const futureFridayTask: TaskItem = {
          id: 'task-friday-report',
          title: '金曜の課題提出',
          category: 'must',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          targetDays: [4], // 金曜（未来）
          priority: 'high',
        };

        const result = generateTheoreticalSchedule([], [futureFridayTask], {
          todayIndex: 1, // 火曜
          currentMinutes: 600,
        });

        // 金曜の枠に予定されていること
        const friBlocks = result.dayBlocks[4];
        const friBlock = friBlocks.find((b) => b.title === '金曜の課題提出');
        expect(friBlock).toBeDefined();
        // 未来なので未完了
        expect(friBlock?.isCompleted).toBe(false);
        expect(friBlock?.isWeeklyTask).toBe(true);

        // もし金曜のブロックIDが未完了リストに入っていたとしても、未来タスクなので再配置（リスケジュール）されないこと
        const toggledResult = generateTheoreticalSchedule([], [futureFridayTask], {
          todayIndex: 1,
          currentMinutes: 600,
          uncompletedBlockIds: new Set([friBlock!.id]),
        });

        // 再スケジュールブロック（isRescheduled: true）が存在しないこと
        const allBlocks = Object.values(toggledResult.dayBlocks).flat();
        const rescheduledBlocks = allBlocks.filter((b) => b.isRescheduled);
        expect(rescheduledBlocks).toHaveLength(0);

        // タスクの総数が1個のままで、二重化・増殖していないこと
        const taskBlocks = allBlocks.filter((b) => b.title === '金曜の課題提出');
        expect(taskBlocks).toHaveLength(1);
      });

      it('日課タスクや固定枠には isWeeklyTask: false が付与され、週タスクのみ isWeeklyTask: true となること', () => {
        const fixed: FixedSlot = {
          id: 'fix-1',
          title: '講義',
          category: 'lecture',
          startMinutes: 540,
          endMinutes: 630,
          color: '#3b82f6',
        };

        const dailyTask: TaskItem = {
          id: 'daily-1',
          title: '毎日の単語暗記',
          category: 'study',
          durationMinutes: 30,
          period: 'day',
          frequency: 'high',
          priority: 'medium',
        };

        const weeklyTask: TaskItem = {
          id: 'weekly-1',
          title: '週末の統計学レポート',
          category: 'must',
          durationMinutes: 90,
          period: 'week',
          frequency: 'low',
          targetDays: [5], // 土曜
          priority: 'high',
        };

        const result = generateTheoreticalSchedule([fixed], [dailyTask, weeklyTask]);

        // 固定枠は isWeeklyTask: false
        const fixedBlock = result.allBlocks.find((b) => b.isFixed);
        expect(fixedBlock?.isWeeklyTask).toBe(false);

        // 日課タスクは isWeeklyTask: false
        const dailyBlock = result.allBlocks.find((b) => b.title === '毎日の単語暗記');
        expect(dailyBlock?.isWeeklyTask).toBe(false);

        // 週タスクは isWeeklyTask: true
        const weeklyBlock = result.allBlocks.find((b) => b.title === '週末の統計学レポート');
        expect(weeklyBlock?.isWeeklyTask).toBe(true);
      });

      it('曜日指定または周期指定された日課タスクでも isWeeklyTask: false となり、該当曜日にのみ日タスクとして配置されること', () => {
        // 月水金の日課
        const mwfDailyTask: TaskItem = {
          id: 'daily-mwf',
          title: '月水金のストレッチ',
          category: 'workout',
          priority: 'medium',
          durationMinutes: 30,
          period: 'day',
          frequency: 'high',
          targetDays: [0, 2, 4],
          dailyCount: 1,
          dailyRepeatMode: 'custom',
        };

        // 3日周期の日課 (0:月, 3:木, 6:日)
        const cycleDailyTask: TaskItem = {
          id: 'daily-cycle-1',
          title: '周期別筋トレ',
          category: 'workout',
          priority: 'medium',
          durationMinutes: 45,
          period: 'day',
          frequency: 'high',
          cycleDays: [0],
          cycleCount: 3,
          dailyCount: 1,
          dailyRepeatMode: 'custom',
        };

        const result = generateTheoreticalSchedule([], [mwfDailyTask, cycleDailyTask]);

        // 月曜(0): 両方配置され、isWeeklyTask: false であること
        const monMwf = result.dayBlocks[0].find((b) => b.title === '月水金のストレッチ');
        const monCycle = result.dayBlocks[0].find((b) => b.title === '周期別筋トレ');
        expect(monMwf).toBeDefined();
        expect(monMwf?.isWeeklyTask).toBe(false);
        expect(monCycle).toBeDefined();
        expect(monCycle?.isWeeklyTask).toBe(false);

        // 火曜(1): どちらも配置されないこと
        expect(result.dayBlocks[1].some((b) => b.title === '月水金のストレッチ')).toBe(false);
        expect(result.dayBlocks[1].some((b) => b.title === '周期別筋トレ')).toBe(false);

        // 水曜(2): 月水金ストレッチのみ配置されること
        expect(result.dayBlocks[2].some((b) => b.title === '月水金のストレッチ')).toBe(true);
        expect(result.dayBlocks[2].some((b) => b.title === '周期別筋トレ')).toBe(false);

        // 木曜(3): 周期別筋トレのみ配置されること
        expect(result.dayBlocks[3].some((b) => b.title === '月水金のストレッチ')).toBe(false);
        expect(result.dayBlocks[3].some((b) => b.title === '周期別筋トレ')).toBe(true);
      });

      it('回数指定 (dailyCount: 1, dailyRepeatMode: custom) の日課タスクが空き枠に敷き詰められず1日1回のみ配置されること', () => {
        const fixedSlot: FixedSlot = {
          id: 'sleep',
          title: '睡眠',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 360, // 06:00
          color: '#6366f1',
        };

        const onceDailyTask: TaskItem = {
          id: 'daily-walk',
          title: '朝の散歩',
          category: 'routine',
          priority: 'medium',
          durationMinutes: 30,
          period: 'day',
          frequency: 'high',
          dailyCount: 1,
          dailyRepeatMode: 'custom',
        };

        const result = generateTheoreticalSchedule([fixedSlot], [onceDailyTask]);

        // 各曜日において1回のみ配置されていること（48回などの誤った敷き詰めにならないこと）
        for (let d = 0; d < 7; d++) {
          const walkBlocks = result.dayBlocks[d].filter((b) => b.title === '朝の散歩');
          expect(walkBlocks).toHaveLength(1);
          expect(walkBlocks[0].isWeeklyTask).toBe(false);
        }
      });

      it('付随タスクがスケジュール内に配置された場合、未配置タスク（unassignedTasks）に含まれず0件となること', () => {
        const fixedSlot: FixedSlot = {
          id: 'lecture-slot',
          title: '大学講義 (2限・3限)',
          category: 'lecture',
          startMinutes: 640,
          endMinutes: 880,
          color: '#0284c7',
          daysOfWeek: [0, 2], // 月・水
        };

        const attachedTask: TaskItem = {
          id: 'task-attached-lecture',
          title: '大学講義 (2限・3限) のタスク',
          taskType: 'task',
          isAttachedTask: true,
          parentTitle: '大学講義 (2限・3限)',
          parentEndMinutesByDay: { 0: 880, 2: 880 },
          durationMinutes: 15,
          frequency: 'custom',
          frequencyCount: 1,
          priority: 'high',
          category: 'lecture',
          period: 'week',
          dailyCount: 1,
          dailyRepeatMode: 'custom',
        };

        const result = generateTheoreticalSchedule([fixedSlot], [attachedTask]);

        // 月曜に配置されていること
        expect(result.dayBlocks[0].some((b) => b.title === '大学講義 (2限・3限) のタスク')).toBe(
          true,
        );
        // 配置されたため未配置タスクは0件であること
        expect(result.unassignedTasks).toHaveLength(0);
        expect(result.metrics.unassignedTaskMinutes).toBe(0);
        expect(result.metrics.theoreticalScore).toBe(100);
      });

      it('特定曜日に枠がない週タスクでも別日にフォールバック救済配置され、必要以上に未配置タスクにならないこと', () => {
        // 月曜(0)は終日固定予定で埋まっている
        const fullMondaySlot: FixedSlot = {
          id: 'busy-monday',
          title: '終日拘束',
          category: 'work',
          startMinutes: 0,
          endMinutes: 1440,
          color: '#3b82f6',
          daysOfWeek: [0],
        };

        // 月曜(0)を指定した週タスク (60分)
        const mondayTask: TaskItem = {
          id: 'task-mon-pref',
          title: '月曜希望のレポート',
          category: 'study',
          priority: 'high',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          targetDays: [0], // 月曜希望
        };

        const result = generateTheoreticalSchedule([fullMondaySlot], [mondayTask]);

        // 月曜には入らないが、空きのある火曜〜日曜のいずれかにフォールバック配置されること
        const totalPlaced = Object.values(result.dayBlocks)
          .flat()
          .filter((b) => b.title === '月曜希望のレポート').length;
        expect(totalPlaced).toBe(1);
        // 未配置タスクにならないこと
        expect(result.unassignedTasks).toHaveLength(0);
        expect(result.metrics.theoreticalScore).toBe(100);
      });

      it('特定曜日の日跨ぎ固定枠（例: 日曜23:00〜07:00）が翌日（月曜）の早朝00:00〜07:00に正しく持ち越され、日曜朝には入らないこと', () => {
        // 日曜日（dayIndex: 6）のみの夜間睡眠スロット (23:00〜07:00)
        const sundayNightSleep: FixedSlot = {
          id: 'sun-sleep',
          title: '日曜夜の睡眠',
          category: 'sleep',
          startMinutes: 23 * 60, // 1380
          endMinutes: 7 * 60, // 420
          daysOfWeek: [6], // 日曜日のみ
          color: '#6366f1',
        };

        const result = generateTheoreticalSchedule([sundayNightSleep], []);

        // 日曜（dayIndex: 6）には夜（23:00〜24:00）のみが存在し、朝（00:00〜07:00）は存在しないこと
        const sundayBlocks = result.dayBlocks[6];
        const sunMorningBlock = sundayBlocks.find(
          (b) => b.startMinutes === 0 && b.endMinutes === 420,
        );
        const sunNightBlock = sundayBlocks.find(
          (b) => b.startMinutes === 1380 && b.endMinutes === 1440,
        );
        expect(sunMorningBlock).toBeUndefined();
        expect(sunNightBlock).toBeDefined();

        // 翌日の月曜（dayIndex: 0）の朝（00:00〜07:00）に睡眠ブロックが存在すること
        const mondayBlocks = result.dayBlocks[0];
        const monMorningBlock = mondayBlocks.find(
          (b) => b.startMinutes === 0 && b.endMinutes === 420,
        );
        expect(monMorningBlock).toBeDefined();
        expect(monMorningBlock?.title).toBe('日曜夜の睡眠');
      });

      it('代行タスクは早期完了された日と同じ日ブロックに割り当てられたタスク（未来予定）が最優先で前倒し配置されること', () => {
        // 火曜（dayIndex: 1）に配置されるタスクA（午前: 09:00〜10:00）とタスクB（午後: 13:00〜14:00）
        const morningTask: TaskItem = {
          id: 'task-morning',
          title: '火曜午前のレポート',
          category: 'must',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          targetDays: [1],
          earliestStartTime: 540, // 09:00〜
          priority: 'high',
        };

        const afternoonTask: TaskItem = {
          id: 'task-afternoon',
          title: '火曜午後のプログラミング学習',
          category: 'study',
          durationMinutes: 60,
          period: 'day',
          dailyCount: 1,
          targetDays: [1],
          earliestStartTime: 780, // 13:00〜
          priority: 'medium',
        };

        // 水曜に配置される別タスクC
        const wednesdayTask: TaskItem = {
          id: 'task-wed',
          title: '水曜の数学演習',
          category: 'study',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          targetDays: [2],
          priority: 'high',
        };

        // 通常実行
        const normalResult = generateTheoreticalSchedule(
          [],
          [morningTask, afternoonTask, wednesdayTask],
          {
            todayIndex: 1, // 火曜
            currentMinutes: 480, // 08:00
          },
        );

        const tueBlocks = normalResult.dayBlocks[1];
        const morningBlock = tueBlocks.find((b) => b.title === '火曜午前のレポート');
        expect(morningBlock).toBeDefined();

        // ユーザーが火曜午前のレポートを早期完了
        const earlyResult = generateTheoreticalSchedule(
          [],
          [morningTask, afternoonTask, wednesdayTask],
          {
            todayIndex: 1,
            currentMinutes: 480,
            completedBlockIds: new Set([morningBlock!.id]),
          },
        );

        // 代替タスクとして、水曜のタスクではなく同じ火曜日の日ブロックに割り当てられている「火曜午後のプログラミング学習」が選ばれること
        const updatedTueBlocks = earlyResult.dayBlocks[1];
        const substituteBlock = updatedTueBlocks.find((b) => b.isSubstitute);
        expect(substituteBlock).toBeDefined();
        expect(substituteBlock?.title).toBe('火曜午後のプログラミング学習');
        expect(substituteBlock?.substitutedForTitle).toBe('火曜午前のレポート');
      });

      it('元の表データの曜日（targetDays）に空き枠がなくても、週タスクが週内の他曜日へ柔軟に配置され枠不足にならないこと', () => {
        // 月曜（0）が24時間固定枠で完全に埋まっている
        const fullMondaySlot: FixedSlot = {
          id: 'fixed-mon-full',
          title: '月曜終日イベント',
          category: 'work',
          startMinutes: 0,
          endMinutes: 1440,
          daysOfWeek: [0],
          color: '#3b82f6',
        };

        // 元の表データでは月曜（0）に存在していた週タスク（レポート）
        const tableImportedWeeklyTask: TaskItem = {
          id: 'table-task-report',
          title: 'インポートされた講義レポート',
          category: 'must',
          durationMinutes: 90,
          period: 'week',
          frequencyCount: 1,
          targetDays: [0], // 表の月曜列にあった
          sourceTableId: 'timetable-1',
          priority: 'high',
        };

        const result = generateTheoreticalSchedule([fullMondaySlot], [tableImportedWeeklyTask]);

        // 月曜は埋まっているが、火曜〜日曜の空いている曜日に自動配置されること
        const placedBlocks = Object.values(result.dayBlocks)
          .flat()
          .filter((b) => b.title === 'インポートされた講義レポート');
        expect(placedBlocks.length).toBe(1);
        expect(placedBlocks[0].dayIndex).not.toBe(0); // 月曜以外
        // 枠不足（未配置）タスクが0件であること
        expect(result.unassignedTasks).toHaveLength(0);
        expect(result.metrics.theoreticalScore).toBe(100);
      });

      it('週タスクに設定された所要時間（例: 90分）がある場合、それより短い空き枠（例: 30分）には短縮配置されず、90分を満たす枠に設定時間通りの長さで配置されること', () => {
        // 月曜（0）に30分の小さな空き枠しかない固定スロット群
        // 00:00〜09:00（固定）、09:30〜24:00（固定） ➔ 空き枠は 09:00〜09:30 (30分のみ)
        const monSlot1: FixedSlot = {
          id: 'mon-fixed-1',
          title: '早朝固定',
          category: 'sleep',
          startMinutes: 0,
          endMinutes: 540, // 09:00
          daysOfWeek: [0],
          color: '#6366f1',
        };
        const monSlot2: FixedSlot = {
          id: 'mon-fixed-2',
          title: '日中〜夜間固定',
          category: 'work',
          startMinutes: 570, // 09:30
          endMinutes: 1440,
          daysOfWeek: [0],
          color: '#3b82f6',
        };

        // 90分の週タスク（月曜を第一希望 targetDays: [0] とする）
        const task90m: TaskItem = {
          id: 'task-long-90m',
          title: 'じっくり取り組むレポート課題',
          category: 'must',
          durationMinutes: 90, // ★ 90分設定！
          period: 'week',
          frequencyCount: 1,
          targetDays: [0], // 月曜希望
          priority: 'high',
        };

        const result = generateTheoreticalSchedule([monSlot1, monSlot2], [task90m]);

        const allBlocks = Object.values(result.dayBlocks)
          .flat()
          .filter((b) => b.title === 'じっくり取り組むレポート課題');

        expect(allBlocks).toHaveLength(1);
        const placedBlock = allBlocks[0];

        // 月曜（30分枠しかない）には無理やり短縮されて入らず、90分が確保できる火曜〜日曜に配置されること
        expect(placedBlock.dayIndex).not.toBe(0);
        // ブロックの長さが設定時間（90分）を正確に満たしていること！
        const blockDuration = placedBlock.endMinutes - placedBlock.startMinutes;
        expect(blockDuration).toBe(90);
        // 枠不足にならず未配置が0件であること
        expect(result.unassignedTasks).toHaveLength(0);
      });

      it('配置優先順位（固定枠 > その日の週タスク > 以前の未完了週タスク > 日タスク）に従って配置されること', () => {
        // 火曜日（1）の 13:00〜14:00 (60分枠) のみに空きがあるスロット設計
        const fixedBefore: FixedSlot = {
          id: 'fix-1',
          title: '午前固定',
          category: 'work',
          startMinutes: 0,
          endMinutes: 13 * 60, // 13:00
          daysOfWeek: [1],
          color: '#3b82f6',
        };
        const fixedAfter: FixedSlot = {
          id: 'fix-2',
          title: '午後固定',
          category: 'work',
          startMinutes: 14 * 60, // 14:00
          endMinutes: 24 * 60,
          daysOfWeek: [1],
          color: '#3b82f6',
        };

        // 月曜（0）から日曜（6）まで、火曜以外は全日固定で埋める
        const otherDayBlocks: FixedSlot[] = [0, 2, 3, 4, 5, 6].map((d) => ({
          id: `full-fix-${d}`,
          title: '終日固定',
          category: 'work',
          startMinutes: 0,
          endMinutes: 1440,
          daysOfWeek: [d],
          color: '#64748b',
        }));

        // 火曜の週タスク（60分）
        const tuesdayWeeklyTask: TaskItem = {
          id: 'tue-task',
          title: '火曜の週タスク',
          category: 'must',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          targetDays: [1],
          priority: 'medium',
        };

        // 過去（月曜）の未完了週タスク（60分）
        const uncompletedPastTask: TaskItem = {
          id: 'past-uncompleted-task',
          title: '月曜の未完了週タスク',
          category: 'must',
          durationMinutes: 60,
          period: 'week',
          frequencyCount: 1,
          targetDays: [0],
          priority: 'medium',
        };

        // 日タスク（60分）
        const dailyTask: TaskItem = {
          id: 'daily-task-item',
          title: '日課タスク',
          category: 'routine',
          durationMinutes: 60,
          period: 'day',
          dailyCount: 1,
          priority: 'high',
        };

        const result = generateTheoreticalSchedule(
          [fixedBefore, fixedAfter, ...otherDayBlocks],
          [tuesdayWeeklyTask, uncompletedPastTask, dailyTask],
          {
            todayIndex: 1, // 今日は火曜
            currentMinutes: 8 * 60,
            uncompletedBlockIds: new Set(['block-task-0-past-uncompleted-task-0']),
          },
        );

        // 火曜のたった1つの空き枠（13:00〜14:00）には、「その日の週タスク」が最優先で配置されること
        const tueBlocks = result.dayBlocks[1];
        const placedTuesdayTask = tueBlocks.find((b) => b.title === '火曜の週タスク');
        expect(placedTuesdayTask).toBeDefined();
        expect(placedTuesdayTask?.startMinutes).toBe(13 * 60);
      });

      it('タスクを完了状態にしたとき、空いた枠に後続のタスク群が前倒しで詰めて再編成されること', () => {
        // 火曜日のスケジュール:
        // タスクA (09:00〜10:30, 90分)
        // タスクB (10:45〜12:15, 90分)
        // タスクC (13:00〜14:00, 60分)
        const taskA: TaskItem = {
          id: 'task-A',
          title: 'タスクA',
          category: 'must',
          priority: 'medium',
          durationMinutes: 90,
          period: 'week',
          targetDays: [1],
        };
        const taskB: TaskItem = {
          id: 'task-B',
          title: 'タスクB',
          category: 'must',
          priority: 'medium',
          durationMinutes: 45,
          period: 'week',
          targetDays: [1],
        };
        const taskC: TaskItem = {
          id: 'task-C',
          title: 'タスクC',
          category: 'must',
          priority: 'medium',
          durationMinutes: 45,
          period: 'week',
          targetDays: [1],
        };

        // 初期配置（現在時刻: 00:00 = 0）
        const initial = generateTheoreticalSchedule([], [taskA, taskB, taskC], {
          todayIndex: 1,
          currentMinutes: 0,
        });

        const initialBlocks = initial.dayBlocks[1].filter((b) => !b.isFixed && !b.isBreak);
        const blockA = initialBlocks.find((b) => b.title === 'タスクA')!;
        expect(blockA).toBeDefined();

        // タスクAを早期完了にする（現在時刻: 00:00 なので未来の枠の早期完了）
        const completedResult = generateTheoreticalSchedule([], [taskA, taskB, taskC], {
          todayIndex: 1,
          currentMinutes: 0,
          completedBlockIds: new Set([blockA.id]),
        });

        const updatedBlocks = completedResult.dayBlocks[1].filter((b) => !b.isFixed && !b.isBreak);
        // タスクAは完了ブロックとして残る
        const compBlockA = updatedBlocks.find((b) => b.id === blockA.id);
        expect(compBlockA?.isCompleted).toBe(true);

        // タスクAの枠にタスクBが代行・前倒しで入る
        const subBlockB = updatedBlocks.find((b) => b.isSubstitute && b.title === 'タスクB');
        expect(subBlockB).toBeDefined();

        // そして、タスクBが前倒しされたことで、タスクCも前倒しされてスケジュール全体が再編成されていること！
        const movedTaskC = updatedBlocks.find((b) => b.title === 'タスクC');
        expect(movedTaskC).toBeDefined();
        // タスクCの開始時刻が、初期配置よりも前に詰められていること
        const initialBlockC = initialBlocks.find((b) => b.title === 'タスクC')!;
        expect(movedTaskC!.startMinutes).toBeLessThanOrEqual(initialBlockC.startMinutes);
      });

      it('週タスクが日ブロックから独立し、各曜日の固定枠配置直後の最もクリーンな空き枠に対して条件を満たす週タスクが直接優先配置されること', () => {
        // 水曜日（2）に固定枠（09:00〜10:30）がある
        const wedFixedSlot: FixedSlot = {
          id: 'wed-lecture',
          title: '水曜専門講義',
          category: 'lecture',
          startMinutes: 9 * 60, // 09:00
          endMinutes: 10 * 60 + 30, // 10:30
          daysOfWeek: [2],
          color: '#0284c7',
        };

        // 水曜日の条件を満たす週タスク（水曜指定のレポート、所要時間90分）
        const wedWeeklyTask: TaskItem = {
          id: 'wed-report-task',
          title: '水曜レポート作成',
          category: 'must',
          durationMinutes: 90,
          period: 'week',
          targetDays: [2],
          priority: 'high',
        };

        // 日ブロック用タスク（自動敷き詰めの高優先度日課タスク）
        const highPriorityDailyTask: TaskItem = {
          id: 'daily-routine-auto',
          title: 'フリー日課タスク（自動敷き詰め）',
          category: 'routine',
          durationMinutes: 45,
          period: 'day',
          dailyRepeatMode: 'auto',
          priority: 'high',
        };

        const result = generateTheoreticalSchedule(
          [wedFixedSlot],
          [wedWeeklyTask, highPriorityDailyTask],
          {
            todayIndex: 0,
            currentMinutes: 0,
          },
        );

        const wedBlocks = result.dayBlocks[2];

        // 1. 固定枠が配置されていること
        const fixedBlock = wedBlocks.find((b) => b.title === '水曜専門講義');
        expect(fixedBlock).toBeDefined();

        // 2. 日ブロック（日課タスク）より前に、週タスクが独立して固定枠直後の空き枠（00:00〜09:00 または 10:30〜）に最優先で配置されていること
        const weeklyBlock = wedBlocks.find((b) => b.title === '水曜レポート作成');
        expect(weeklyBlock).toBeDefined();
        // 90分を満たしていること
        expect(weeklyBlock!.endMinutes - weeklyBlock!.startMinutes).toBe(90);
        expect(weeklyBlock!.isWeeklyTask).toBe(true);

        // 3. 週タスクが配置された残りの枠にのみ、日ブロック（自動敷き詰めタスク）が配置されていること
        const dailyBlocks = wedBlocks.filter((b) => b.title === 'フリー日課タスク（自動敷き詰め）');
        expect(dailyBlocks.length).toBeGreaterThan(0);
        for (const db of dailyBlocks) {
          expect(db.isWeeklyTask).toBe(false);
          // 週タスクと重なっていないこと
          const overlapsWeekly =
            Math.max(db.startMinutes, weeklyBlock!.startMinutes) <
            Math.min(db.endMinutes, weeklyBlock!.endMinutes);
          expect(overlapsWeekly).toBe(false);
        }

        // 未配置タスクがゼロであること
        expect(result.unassignedTasks).toHaveLength(0);
      });
    });

    describe('週タスクの指定日時以降配置オプション（元タスクより後の時間に配置）', () => {
      it('付随タスク（attached_task）作成時に元タスクより後の時間が設定され、講義前の空き枠ではなく講義後に配置されること', () => {
        // 火曜（day 1）
        // 00:00〜09:00 睡眠
        // 09:00〜10:30 空き枠（講義前）
        // 10:30〜12:00 固定枠「人工知能論」（630〜720分）
        // 12:00〜15:00 空き枠（講義後）
        const fixedSlots: FixedSlot[] = [
          {
            id: 'sleep-tue',
            title: '睡眠',
            category: 'sleep',
            startMinutes: 0,
            endMinutes: 540,
            color: '#6366f1',
            daysOfWeek: [1],
          },
          {
            id: 'slot-ai',
            title: '人工知能論',
            category: 'lecture',
            startMinutes: 630, // 10:30
            endMinutes: 720, // 12:00
            color: '#0284c7',
            daysOfWeek: [1],
          },
        ];

        // 人工知能論の付随タスク（60分、元タスクより後に時間を設定）
        const attachedTask: TaskItem = {
          id: 'task-attached-ai',
          title: '人工知能論 のタスク',
          category: 'lecture',
          durationMinutes: 60,
          period: 'week',
          isAttachedTask: true,
          parentTitle: '人工知能論',
          parentEndMinutesByDay: { 1: 720 },
          scheduleAfterEnabled: true,
          scheduleAfterDay: 1,
          scheduleAfterTime: '12:00',
          earliestStartTime: 720,
          startDay: 1,
          targetDays: [1],
          priority: 'high',
          completed: false,
          sourceTableId: 'table-ai',
        };

        const result = generateTheoreticalSchedule(fixedSlots, [attachedTask], {
          todayIndex: 0,
          currentMinutes: 0,
        });

        const tueBlocks = result.dayBlocks[1];
        const placed = tueBlocks.find((b) => b.title === '人工知能論 のタスク');
        expect(placed).toBeDefined();

        // 講義前（09:00〜10:30 = 540〜630分）ではなく、講義終了（720分）以降に配置されていること！
        expect(placed!.startMinutes).toBeGreaterThanOrEqual(720);
        expect(placed!.endMinutes - placed!.startMinutes).toBe(60);
      });

      it('週タスクに指定日時以降（scheduleAfterDay & scheduleAfterTime）が設定された場合、指定日時より前には配置されないこと', () => {
        // 水曜（day 2）の 15:00 以降に配置したい週タスク
        // 月曜（day 0）と火曜（day 1）に広大な空き枠がある
        const fixedSlots: FixedSlot[] = [
          {
            id: 'sleep-all',
            title: '睡眠',
            category: 'sleep',
            startMinutes: 0,
            endMinutes: 480, // 08:00
            color: '#6366f1',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          },
        ];

        const weeklyTaskWithScheduleAfter: TaskItem = {
          id: 'task-after-wed-15',
          title: '水曜午後からの集中課題',
          category: 'study',
          durationMinutes: 90,
          period: 'week',
          scheduleAfterEnabled: true,
          scheduleAfterDay: 2, // 水曜
          scheduleAfterTime: '15:00', // 15:00（900分）以降
          earliestStartTime: 900,
          startDay: 2,
          priority: 'high',
          completed: false,
        };

        const result = generateTheoreticalSchedule(fixedSlots, [weeklyTaskWithScheduleAfter], {
          todayIndex: 0,
          currentMinutes: 0,
        });

        // 月曜（day 0）および火曜（day 1）には配置されていないこと
        const monBlock = result.dayBlocks[0].find((b) => b.title === '水曜午後からの集中課題');
        const tueBlock = result.dayBlocks[1].find((b) => b.title === '水曜午後からの集中課題');
        expect(monBlock).toBeUndefined();
        expect(tueBlock).toBeUndefined();

        // 水曜（day 2）の 15:00（900分）以降に配置されていること
        const wedBlock = result.dayBlocks[2].find((b) => b.title === '水曜午後からの集中課題');
        expect(wedBlock).toBeDefined();
        expect(wedBlock!.startMinutes).toBeGreaterThanOrEqual(900);
        expect(wedBlock!.endMinutes - wedBlock!.startMinutes).toBe(90);
      });

      it('sourceTableIdを持つ週タスクでも、指定日時以降（earliestStartTime）が厳格に守られること', () => {
        // 木曜（day 3）
        // 09:00〜11:00 空き枠
        // 13:00〜17:00 空き枠
        // 13:00（780分）以降に配置設定された表由来の週タスク
        const fixedSlots: FixedSlot[] = [
          {
            id: 'sleep-thu',
            title: '睡眠',
            category: 'sleep',
            startMinutes: 0,
            endMinutes: 540, // 09:00
            color: '#6366f1',
            daysOfWeek: [3],
          },
          {
            id: 'lunch-thu',
            title: '昼食',
            category: 'meal',
            startMinutes: 660, // 11:00
            endMinutes: 780, // 13:00
            color: '#10b981',
            daysOfWeek: [3],
          },
        ];

        const tableWeeklyTask: TaskItem = {
          id: 'task-table-weekly',
          title: '木曜午後演習タスク',
          category: 'study',
          priority: 'medium',
          durationMinutes: 60,
          period: 'week',
          sourceTableId: 'timetable-1',
          autoPlaceWithinRange: true,
          scheduleAfterEnabled: true,
          scheduleAfterDay: 3,
          scheduleAfterTime: '13:00',
          earliestStartTime: 780, // 13:00以降
          startDay: 3,
          targetDays: [3],
          completed: false,
        };

        const result = generateTheoreticalSchedule(fixedSlots, [tableWeeklyTask], {
          todayIndex: 0,
          currentMinutes: 0,
        });

        const thuBlock = result.dayBlocks[3].find((b) => b.title === '木曜午後演習タスク');
        expect(thuBlock).toBeDefined();
        // 午前中の空き枠（09:00〜11:00）ではなく、13:00（780分）以降に配置されていること！
        expect(thuBlock!.startMinutes).toBeGreaterThanOrEqual(780);
      });

      it('空き枠がちょうど60分しかない環境で、休憩15分付きの週タスク（60分）が日タスクに横取りされず最優先で配置されること', () => {
        // 月曜:
        // 00:00〜09:00 睡眠
        // 09:00〜10:00 空き枠（ちょうど60分間！）
        // 10:00〜24:00 固定予定
        const fixedSlots: FixedSlot[] = [
          {
            id: 'sleep-mon',
            title: '睡眠',
            category: 'sleep',
            startMinutes: 0,
            endMinutes: 540, // 09:00
            color: '#6366f1',
            daysOfWeek: [0],
          },
          {
            id: 'busy-mon',
            title: '固定講義・バイト',
            category: 'lecture',
            startMinutes: 600, // 10:00
            endMinutes: 1440,
            color: '#0284c7',
            daysOfWeek: [0],
          },
        ];

        // 週タスク: 所要時間60分 + 休憩15分（本来計75分だが、空き枠は60分しかない）
        const weeklyTask: TaskItem = {
          id: 'task-weekly-60',
          title: '週レポート作成',
          category: 'must',
          priority: 'high',
          durationMinutes: 60,
          breakMinutes: 15, // 休憩15分
          period: 'week',
          targetDays: [0],
          completed: false,
        };

        // 日タスク: 30分（もし週タスクが弾かれたら入り込んでしまうタスク）
        const dailyTask: TaskItem = {
          id: 'task-daily-30',
          title: '日課筋トレ',
          category: 'want',
          priority: 'medium',
          durationMinutes: 30,
          period: 'day',
          completed: false,
        };

        const result = generateTheoreticalSchedule(fixedSlots, [weeklyTask, dailyTask], {
          todayIndex: 0,
          currentMinutes: 0,
        });

        const monBlocks = result.dayBlocks[0];

        // 1. 週タスクが休憩時間のせいで弾かれることなく、60分枠（09:00〜10:00 = 540〜600分）に最優先で配置されていること！
        const placedWeekly = monBlocks.find((b) => b.title === '週レポート作成');
        expect(placedWeekly).toBeDefined();
        expect(placedWeekly!.startMinutes).toBe(540);
        expect(placedWeekly!.endMinutes).toBe(600);
        expect(placedWeekly!.isWeeklyTask).toBe(true);

        // 2. 日タスクはこの60分枠を横取りできていないこと（枠が使い切られたため、月曜には配置されない）
        const placedDaily = monBlocks.find((b) => b.title === '日課筋トレ');
        expect(placedDaily).toBeUndefined();
      });

      it('週5日設定（frequency: high）の週タスクが日タスク化せず、週ボックスとして最優先で配置されること', () => {
        // 月曜〜金曜に1日60分の空き枠
        const fixedSlots: FixedSlot[] = [
          {
            id: 'sleep-all',
            title: '睡眠',
            category: 'sleep',
            startMinutes: 0,
            endMinutes: 540, // 09:00
            color: '#6366f1',
            daysOfWeek: [0, 1, 2, 3, 4],
          },
          {
            id: 'busy-all',
            title: '終日固定枠',
            category: 'work',
            startMinutes: 600, // 10:00
            endMinutes: 1440,
            color: '#0284c7',
            daysOfWeek: [0, 1, 2, 3, 4],
          },
        ];

        // 月〜金の5日を指定した週タスク（UIによって frequency = 'high' が付与された状態）
        const highFreqWeeklyTask: TaskItem = {
          id: 'task-high-freq-weekly',
          title: '平日毎日やる集中英会話',
          category: 'study',
          priority: 'high',
          durationMinutes: 60,
          period: 'week', // 明示的に週タスク
          frequency: 'high', // 週5日のため high が付いている
          frequencyCount: 5,
          targetDays: [0, 1, 2, 3, 4],
          completed: false,
        };

        // 自動敷き詰め日タスク
        const dailyAutoTask: TaskItem = {
          id: 'task-auto-daily',
          title: '自動読書',
          category: 'want',
          priority: 'low',
          durationMinutes: 30,
          period: 'day',
          dailyRepeatMode: 'auto',
          completed: false,
        };

        const result = generateTheoreticalSchedule(
          fixedSlots,
          [highFreqWeeklyTask, dailyAutoTask],
          {
            todayIndex: 0,
            currentMinutes: 0,
          },
        );

        // 月曜〜金曜の全日で、週タスクが日タスクに枠を奪われることなく確実に配置されていること
        for (let d = 0; d < 5; d++) {
          const blocks = result.dayBlocks[d];
          const placedWeekly = blocks.find((b) => b.title === '平日毎日やる集中英会話');
          expect(placedWeekly).toBeDefined();
          expect(placedWeekly!.isWeeklyTask).toBe(true);
          expect(placedWeekly!.startMinutes).toBe(540);
          expect(placedWeekly!.endMinutes).toBe(600);
        }
      });

      it('同日夜に空き枠がない付随タスク（週タスク）が、自動敷き詰め日タスクが存在する環境でも枠を食い潰されず翌日以降へ確実にフォールバック配置されること', () => {
        // 金曜: 09:00〜18:00講義、18:00〜23:30夜固定枠（60分枠が残っていない）
        const fixedSlots: FixedSlot[] = [
          {
            id: 'slot-lecture-fri',
            title: '金曜マクロ経済学',
            daysOfWeek: [4],
            startMinutes: 9 * 60,
            endMinutes: 18 * 60,
            category: 'lecture',
            color: '#6366f1',
          },
          {
            id: 'slot-fri-night',
            title: '金曜夜固定枠',
            daysOfWeek: [4],
            startMinutes: 18 * 60,
            endMinutes: 23 * 60 + 30,
            category: 'fixed',
            color: '#0284c7',
          },
        ];

        // 金曜マクロ経済学の付随タスク（所要時間60分、週1回）
        const attachedTask: TaskItem = {
          id: 'attached-fri',
          title: 'マクロ経済学 課題',
          category: 'must',
          priority: 'high',
          durationMinutes: 60,
          period: 'week',
          frequency: 'low',
          isAttachedTask: true,
          parentTitle: '金曜マクロ経済学',
          parentEndMinutesByDay: { 4: 18 * 60 },
          scheduleAfterEnabled: true,
          scheduleAfterDay: 4,
          scheduleAfterTime: '18:00',
          earliestStartTime: 18 * 60,
          targetDays: [4],
          completed: false,
        };

        // 自動敷き詰め日タスク（空き枠を全て埋めようとするタスク）
        const dailyAutoTask: TaskItem = {
          id: 'daily-task-auto',
          title: '毎日の勉強',
          category: 'must',
          priority: 'medium',
          durationMinutes: 120,
          period: 'day',
          dailyRepeatMode: 'auto',
          completed: false,
        };

        const result = generateTheoreticalSchedule(fixedSlots, [attachedTask, dailyAutoTask], {
          todayIndex: 0,
          currentMinutes: 0,
        });

        // 金曜日には枠が足りないため入らない
        const friBlocks = result.dayBlocks[4];
        expect(friBlocks.some((b) => b.title === 'マクロ経済学 課題')).toBe(false);

        // 自動敷き詰めタスクに枠を埋め尽くされず、翌日（土曜日）に確実に配置されること！
        const satBlocks = result.dayBlocks[5];
        const placedAttached = satBlocks.find((b) => b.title === 'マクロ経済学 課題');
        expect(placedAttached).toBeDefined();
        expect(placedAttached!.isWeeklyTask).toBe(true);

        // 未配置タスクに含まれていないこと
        expect(result.unassignedTasks || []).not.toContain('マクロ経済学 課題');
      });

      it('週タスクは週タスク独自の色（WEEKLY_TASK_COLOR / #8b5cf6）で統一されてブロックが生成されること', () => {
        const weeklyTask: TaskItem = {
          id: 'task-weekly-custom',
          title: '週次プログラミング演習',
          category: 'must', // カテゴリは must でも週タスク独自色で統一
          priority: 'high',
          durationMinutes: 60,
          period: 'week',
          completed: false,
        };

        const result = generateTheoreticalSchedule([], [weeklyTask]);
        const allBlocks = Object.values(result.dayBlocks).flat();
        const block = allBlocks.find((b) => b.title === '週次プログラミング演習');
        expect(block).toBeDefined();
        expect(block!.isWeeklyTask).toBe(true);
        expect(block!.color).toBe('#8b5cf6');
      });

      it('早期完了された枠において、新タスク（isSubstitute: true）が奥(先)、手前に透明度を上げた完了タスクが後になる順序でソートされること', () => {
        const taskA: TaskItem = {
          id: 'task-a',
          title: '木曜のタスクA',
          category: 'must',
          priority: 'high',
          durationMinutes: 60,
          period: 'week',
          targetDays: [3],
          completed: false,
        };
        const taskB: TaskItem = {
          id: 'task-b',
          title: '金曜のタスクB',
          category: 'must',
          priority: 'high',
          durationMinutes: 60,
          period: 'week',
          targetDays: [4],
          completed: false,
        };

        const initial = generateTheoreticalSchedule([], [taskA, taskB]);
        const aBlock = initial.dayBlocks[3].find((b) => b.title === '木曜のタスクA')!;

        // タスクAを早期完了
        const adapted = generateTheoreticalSchedule([], [taskA, taskB], {
          todayIndex: 1, // 火曜
          currentMinutes: 600,
          completedBlockIds: new Set([aBlock.id]),
        });

        const thuBlocks = adapted.dayBlocks[3];
        const subIdx = thuBlocks.findIndex((b) => b.isSubstitute);
        const origIdx = thuBlocks.findIndex((b) => b.id === aBlock.id);

        expect(subIdx).toBeGreaterThanOrEqual(0);
        expect(origIdx).toBeGreaterThanOrEqual(0);
        // 新タスク（代行タスク）が奥（インデックスが小さい）に配置され、完了タスクが手前に重なること
        expect(subIdx).toBeLessThan(origIdx);
      });

      describe('未完了タスクの配分ポリシー（TaskPlacementStrategy）', () => {
        it('集中配置（concentrated）の場合、十分な空きがある直近曜日（今日）に未完了タスクがまとめて配置されること', () => {
          // 月曜(0)に配置されていた2つの週タスク
          const task1: TaskItem = {
            id: 'task-1',
            title: '未完了タスク1',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            targetDays: [0],
            frequencyCount: 1,
            completed: false,
          };
          const task2: TaskItem = {
            id: 'task-2',
            title: '未完了タスク2',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            targetDays: [0],
            frequencyCount: 1,
            completed: false,
          };

          // 今日は火曜(1)。火曜〜日曜まで空き枠が潤沢にある状態。
          // ユーザーが月曜の完了状態だった2つのタスクを「未完了」に解除した。
          const result = generateTheoreticalSchedule([], [task1, task2], {
            todayIndex: 1,
            currentMinutes: 480, // 08:00
            uncompletedBlockIds: new Set(['block-task-0-task-1-0', 'block-task-0-task-2-0']),
            placementStrategy: 'concentrated',
          });

          // concentrated（集中配置）なので、火曜(1)に両方のタスクがまとめて配置されること
          const tueBlocks = result.dayBlocks[1];
          const hasTask1 = tueBlocks.some((b) => b.title === '未完了タスク1');
          const hasTask2 = tueBlocks.some((b) => b.title === '未完了タスク2');
          expect(hasTask1).toBe(true);
          expect(hasTask2).toBe(true);
        });

        it('分散配置（balanced）の場合、1日あたり1タスクの上限が適用され、複数曜日に分散されること', () => {
          const task1: TaskItem = {
            id: 'task-1',
            title: '未完了タスク1',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            targetDays: [0],
            frequencyCount: 1,
            completed: false,
          };
          const task2: TaskItem = {
            id: 'task-2',
            title: '未完了タスク2',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            targetDays: [0],
            frequencyCount: 1,
            completed: false,
          };

          // 今日は火曜(1)。分散配置（balanced）の場合
          const result = generateTheoreticalSchedule([], [task1, task2], {
            todayIndex: 1,
            currentMinutes: 480,
            uncompletedBlockIds: new Set(['block-task-0-task-1-0', 'block-task-0-task-2-0']),
            placementStrategy: 'balanced',
          });

          // balanced（分散配置）なので、火曜(1)には1タスクのみ配置され、もう1タスクは水曜以降に分散される
          const tueBlocks = result.dayBlocks[1].filter((b) => b.title.startsWith('未完了タスク'));
          expect(tueBlocks.length).toBe(1);

          // 全曜日の合計では両方ともスケジュール内に配置されていること
          const allBlocks = Object.values(result.dayBlocks).flat();
          const hasTask1 = allBlocks.some((b) => b.title === '未完了タスク1');
          const hasTask2 = allBlocks.some((b) => b.title === '未完了タスク2');
          expect(hasTask1).toBe(true);
          expect(hasTask2).toBe(true);
        });
      });

      describe('Plan12: 固定枠・週タスク・再配置タスクの完了状態と現在時刻基準の上からの再配置', () => {
        it('授業などの固定枠（isFixed）が予定より早く終わった際、グレーアウト（isCompleted & isEarlyCompleted）となり、現在時刻を考慮して上から後続タスクが再配置されること', () => {
          // 火曜（dayIndex: 1）
          // 00:00〜09:00 睡眠
          // 09:00〜10:30 (540〜630分) 1限講義（固定枠）
          // 10:30〜11:30 (630〜690分) タスクB（60分）
          // 11:30〜12:15 (690〜735分) タスクC（45分）
          const fixedSlots: FixedSlot[] = [
            {
              id: 'sleep-tue',
              title: '睡眠',
              category: 'sleep',
              startMinutes: 0,
              endMinutes: 540, // 09:00
              color: '#6366f1',
              daysOfWeek: [1],
            },
            {
              id: 'lecture-1',
              title: 'データ構造とアルゴリズム',
              category: 'lecture',
              startMinutes: 540, // 09:00
              endMinutes: 630, // 10:30
              color: '#0284c7',
              daysOfWeek: [1],
            },
          ];

          const taskB: TaskItem = {
            id: 'task-b',
            title: 'アルゴリズム演習課題',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            targetDays: [1],
          };

          const taskC: TaskItem = {
            id: 'task-c',
            title: '英語リーディング',
            category: 'study',
            priority: 'medium',
            durationMinutes: 45,
            period: 'day',
            dailyCount: 1,
            targetDays: [1],
          };

          // 初期配置確認
          const initial = generateTheoreticalSchedule(fixedSlots, [taskB, taskC], {
            todayIndex: 1,
            currentMinutes: 580, // 09:40
          });
          const lectureBlock = initial.dayBlocks[1].find(
            (b) => b.title === 'データ構造とアルゴリズム',
          )!;
          expect(lectureBlock).toBeDefined();
          expect(lectureBlock.isFixed).toBe(true);
          expect(lectureBlock.isCompleted).toBe(false);

          // 09:40（580分）時点で授業が早く終わったため、固定枠を完了トグル
          const earlyResult = generateTheoreticalSchedule(fixedSlots, [taskB, taskC], {
            todayIndex: 1,
            currentMinutes: 580, // 09:40
            completedBlockIds: new Set([lectureBlock.id]),
          });

          const tueBlocks = earlyResult.dayBlocks[1];

          // 1. 授業（固定枠）がグレーアウト対象（isCompleted: true, isEarlyCompleted: true）になっていること
          const updatedLecture = tueBlocks.find((b) => b.id === lectureBlock.id)!;
          expect(updatedLecture).toBeDefined();
          expect(updatedLecture.isCompleted).toBe(true);
          expect(updatedLecture.isEarlyCompleted).toBe(true);

          // 2. 現在時刻 09:40（580分）を考慮し、タスクBが 09:40〜10:40（580〜640分）に上から前倒し再配置されていること
          const placedTaskB = tueBlocks.find((b) => b.title === 'アルゴリズム演習課題')!;
          expect(placedTaskB).toBeDefined();
          expect(placedTaskB.startMinutes).toBe(580);
          expect(placedTaskB.endMinutes).toBe(640);

          // 3. タスクCもそれに続いて 10:40〜11:25（640〜685分）へ隙間なく上から再配置されていること
          const placedTaskC = tueBlocks.find((b) => b.title === '英語リーディング')!;
          expect(placedTaskC).toBeDefined();
          expect(placedTaskC.startMinutes).toBe(640);
          expect(placedTaskC.endMinutes).toBe(685);
        });

        it('週タスクが予定より早く終わった際、現在時刻を考慮して上から後続タスクが再配置されること', () => {
          // 水曜（dayIndex: 2）
          // 00:00〜10:00 睡眠・朝固定 (0〜600分)
          // 10:00〜12:00 (600〜720分) 週タスクA（120分）
          // 12:00〜13:00 (720〜780分) 週タスクB（60分）
          const fixedSlots: FixedSlot[] = [
            {
              id: 'sleep-wed',
              title: '睡眠',
              category: 'sleep',
              startMinutes: 0,
              endMinutes: 600, // 10:00
              color: '#6366f1',
              daysOfWeek: [2],
            },
          ];

          const taskA: TaskItem = {
            id: 'weekly-a',
            title: '大型レポート執筆',
            category: 'must',
            priority: 'high',
            durationMinutes: 120,
            period: 'week',
            targetDays: [2],
          };

          const taskB: TaskItem = {
            id: 'weekly-b',
            title: '統計学演習',
            category: 'must',
            priority: 'medium',
            durationMinutes: 60,
            period: 'week',
            targetDays: [2],
          };

          const initial = generateTheoreticalSchedule(fixedSlots, [taskA, taskB], {
            todayIndex: 2,
            currentMinutes: 645, // 10:45
          });
          const blockA = initial.dayBlocks[2].find((b) => b.title === '大型レポート執筆')!;
          expect(blockA.startMinutes).toBe(600);
          expect(blockA.endMinutes).toBe(720);

          // 現在時刻 10:45（645分）に「大型レポート執筆」が早く完了
          const earlyResult = generateTheoreticalSchedule(fixedSlots, [taskA, taskB], {
            todayIndex: 2,
            currentMinutes: 645, // 10:45
            completedBlockIds: new Set([blockA.id]),
          });

          const wedBlocks = earlyResult.dayBlocks[2];
          const compA = wedBlocks.find((b) => b.id === blockA.id)!;
          expect(compA.isCompleted).toBe(true);
          expect(compA.isEarlyCompleted).toBe(true);

          // 後続の「統計学演習」が現在時刻 10:45（645分）を起点に 10:45〜11:45（645〜705分）へ再配置されること
          const movedB = wedBlocks.find((b) => b.title === '統計学演習')!;
          expect(movedB).toBeDefined();
          expect(movedB.startMinutes).toBe(645);
          expect(movedB.endMinutes).toBe(705);
        });

        it('未完了にした週タスクの再配置ブロック（isRescheduled）を完了にした際、大元のタスクも連動して完了状態になり、早期完了時の上からの再配置も適用されること', () => {
          // 全曜日の00:00〜09:00は睡眠固定枠
          const fixedSlots: FixedSlot[] = [
            {
              id: 'sleep-all',
              title: '睡眠',
              category: 'sleep',
              startMinutes: 0,
              endMinutes: 540, // 09:00
              color: '#6366f1',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
          ];

          // 月曜（0）に予定されていた週タスク
          const monTask: TaskItem = {
            id: 'task-mon-report',
            title: '月曜の実験レポート',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            frequencyCount: 1,
            targetDays: [0],
          };

          // 水曜（2）の後続タスク
          const wedTask: TaskItem = {
            id: 'task-wed-study',
            title: '水曜の資格学習',
            category: 'study',
            priority: 'medium',
            durationMinutes: 45,
            period: 'day',
            dailyCount: 1,
            targetDays: [2],
          };

          // ステップ1: 今日は水曜（todayIndex: 2）、現在時刻 09:00（540分）。
          // 月曜のブロック（block-task-0-task-mon-report-0）を未完了にする
          const step1 = generateTheoreticalSchedule(fixedSlots, [monTask, wedTask], {
            todayIndex: 2,
            currentMinutes: 540, // 09:00
            uncompletedBlockIds: new Set(['block-task-0-task-mon-report-0']),
          });

          // 水曜（2）の 09:00〜10:00（540〜600分）に再配置ブロックが生成されていること
          const rescheduledBlock = step1.dayBlocks[2].find(
            (b) => b.isRescheduled && b.title === '月曜の実験レポート',
          )!;
          expect(rescheduledBlock).toBeDefined();
          expect(rescheduledBlock.isCompleted).toBe(false);
          expect(rescheduledBlock.startMinutes).toBe(540);
          expect(rescheduledBlock.endMinutes).toBe(600);

          // ステップ2: 元の月曜タスクは未完了（uncompletedBlockIds に残したまま）で、
          // 水曜の再配置ブロック（rescheduledBlock.id）を現在時刻 09:25（565分）に完了にする！
          const step2 = generateTheoreticalSchedule(fixedSlots, [monTask, wedTask], {
            todayIndex: 2,
            currentMinutes: 565, // 09:25
            uncompletedBlockIds: new Set(['block-task-0-task-mon-report-0']),
            completedBlockIds: new Set([rescheduledBlock.id]),
          });

          // 1. 月曜の元ブロックも再配置先の完了に連動して完了状態（isCompleted: true）になること
          const origMonBlock = step2.dayBlocks[0].find((b) => b.title === '月曜の実験レポート')!;
          expect(origMonBlock).toBeDefined();
          expect(origMonBlock.isCompleted).toBe(true);

          // 2. 水曜の再配置ブロックは消滅せず、完了・早期完了（グレーアウト）状態になっていること
          const compRescheduled = step2.dayBlocks[2].find((b) => b.id === rescheduledBlock.id)!;
          expect(compRescheduled).toBeDefined();
          expect(compRescheduled.isCompleted).toBe(true);
          expect(compRescheduled.isEarlyCompleted).toBe(true);

          // 3. 現在時刻 09:25（565分）を考慮し、後続の「水曜の資格学習（45分）」が 09:25〜10:10（565〜610分）に上から再配置されていること
          const movedWedTask = step2.dayBlocks[2].find((b) => b.title === '水曜の資格学習')!;
          expect(movedWedTask).toBeDefined();
          expect(movedWedTask.startMinutes).toBe(565);
          expect(movedWedTask.endMinutes).toBe(610);
        });

        it('再配置先を完了にした時、大元の過去ブロックも連動して完了になり、未完了リストと競合しても安全に完了が維持されること', () => {
          const fixedSlots: FixedSlot[] = [
            {
              id: 'sleep-all',
              title: '睡眠',
              category: 'sleep',
              startMinutes: 0,
              endMinutes: 540,
              color: '#6366f1',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
          ];

          const reportTask: TaskItem = {
            id: 'task-report-sync',
            title: '月曜の課題レポート',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            frequencyCount: 1,
            targetDays: [0],
          };

          // 水曜時点で月曜のレポートが未完了だったため再配置される
          const step1 = generateTheoreticalSchedule(fixedSlots, [reportTask], {
            todayIndex: 2,
            currentMinutes: 540,
            uncompletedBlockIds: new Set(['block-task-0-task-report-sync-0']),
          });

          const rescheduled = step1.dayBlocks[2].find(
            (b) => b.isRescheduled && b.taskId === 'task-report-sync',
          )!;
          expect(rescheduled).toBeDefined();

          // 再配置先で完了にした場合
          const step2 = generateTheoreticalSchedule(fixedSlots, [reportTask], {
            todayIndex: 2,
            currentMinutes: 540,
            completedBlockIds: new Set([rescheduled.id]),
            uncompletedBlockIds: new Set(['block-task-0-task-report-sync-0']),
          });

          // 大元（月曜）のブロックが完了状態（isCompleted: true）になっていること
          const origMon = step2.dayBlocks[0].find((b) => b.title === '月曜の課題レポート')!;
          expect(origMon.isCompleted).toBe(true);

          // 水曜の再配置ブロックも消滅せず完了状態になっていること
          const compWed = step2.dayBlocks[2].find(
            (b) => b.title === '月曜の課題レポート' && b.isRescheduled,
          )!;
          expect(compWed).toBeDefined();
          expect(compWed.isCompleted).toBe(true);
        });

        it('早期完了によって枠が開いた際、過去に完了した日課タスクや他曜日の日課タスクが代行として未完了で出現しないこと', () => {
          const fixedSlots: FixedSlot[] = [
            {
              id: 'sleep-all',
              title: '睡眠',
              category: 'sleep',
              startMinutes: 0,
              endMinutes: 540,
              color: '#6366f1',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'lecture-wed',
              title: '水曜1限講義',
              category: 'lecture',
              startMinutes: 540, // 09:00
              endMinutes: 630, // 10:30
              color: '#0284c7',
              daysOfWeek: [2],
            },
          ];

          // 月曜（0）に完了した日課タスク
          const monDailyTask: TaskItem = {
            id: 'task-mon-cleaning',
            title: '月曜朝の清掃ルーチン',
            category: 'life',
            priority: 'medium',
            durationMinutes: 45,
            period: 'day',
            targetDays: [0],
          };

          // 水曜（2）のタスクは講義のみ。講義を09:30に早期完了する
          const result = generateTheoreticalSchedule(fixedSlots, [monDailyTask], {
            todayIndex: 2, // 水曜
            currentMinutes: 570, // 09:30
            completedBlockIds: new Set(['lecture-wed', 'block-task-0-task-mon-cleaning-0']),
          });

          // 水曜日のブロックに「月曜朝の清掃ルーチン」が代行タスクとして未完了で引っ張ってこられていないこと
          const wedSubstitute = result.dayBlocks[2].find((b) => b.title === '月曜朝の清掃ルーチン');
          expect(wedSubstitute).toBeUndefined();
        });

        it('再配置先ではなく元のタスクが未完了から完了になった場合、再配置先が完全に取り除かれること', () => {
          const fixedSlots: FixedSlot[] = [
            {
              id: 'sleep-all',
              title: '睡眠',
              category: 'sleep',
              startMinutes: 0,
              endMinutes: 540,
              color: '#6366f1',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
          ];

          const reportTask: TaskItem = {
            id: 'task-report-remove-rescheduled',
            title: '月曜の物理レポート',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            frequencyCount: 1,
            targetDays: [0],
          };

          // ステップ1: 月曜の物理レポートが未完了なので、水曜（2）に再配置される
          const step1 = generateTheoreticalSchedule(fixedSlots, [reportTask], {
            todayIndex: 2,
            currentMinutes: 540,
            uncompletedBlockIds: new Set(['block-task-0-task-report-remove-rescheduled-0']),
          });

          const resWed = step1.dayBlocks[2].find(
            (b) => b.isRescheduled && b.taskId === 'task-report-remove-rescheduled',
          );
          expect(resWed).toBeDefined();

          // ステップ2: ユーザーが大元のタスク（月曜）を完了にした！
          const step2 = generateTheoreticalSchedule(fixedSlots, [reportTask], {
            todayIndex: 2,
            currentMinutes: 540,
            completedBlockIds: new Set(['block-task-0-task-report-remove-rescheduled-0']),
            uncompletedBlockIds: new Set(),
          });

          // 月曜の大元タスクは完了状態になっていること
          const origMon = step2.dayBlocks[0].find((b) => b.title === '月曜の物理レポート')!;
          expect(origMon.isCompleted).toBe(true);

          // 水曜の再配置先は完全に取り除かれて存在しないこと
          const removedResWed = step2.dayBlocks[2].find(
            (b) => b.isRescheduled && b.taskId === 'task-report-remove-rescheduled',
          );
          expect(removedResWed).toBeUndefined();
        });

        it('早期完了時の再配置で、元の枠の残り時間に無理やり別タスクを切り詰めて詰め込んだりせず、本来の所要時間を維持したまま連続再配置および連鎖完了ができること', () => {
          // 火曜（dayIndex: 1）
          // 00:00〜09:00 睡眠 (0〜540分)
          // 09:00〜10:30 1限講義 (540〜630分, 90分)
          // 10:30〜11:30 週タスク1 (630〜690分, 60分)
          // 11:30〜12:30 週タスク2 (690〜750分, 60分)
          const fixedSlots: FixedSlot[] = [
            {
              id: 'sleep-tue',
              title: '睡眠',
              category: 'sleep',
              startMinutes: 0,
              endMinutes: 540,
              color: '#6366f1',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'lecture-1',
              title: '1限: ソフトウェア工学',
              category: 'lecture',
              startMinutes: 540, // 09:00
              endMinutes: 630, // 10:30 (90分)
              color: '#0284c7',
              daysOfWeek: [1],
            },
          ];

          const weekly1: TaskItem = {
            id: 'weekly-1',
            title: '設計書作成タスク',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            targetDays: [1],
          };

          const weekly2: TaskItem = {
            id: 'weekly-2',
            title: '単体テスト実装',
            category: 'must',
            priority: 'medium',
            durationMinutes: 60,
            period: 'week',
            targetDays: [1],
          };

          // 09:00（540分）時点で1限講義（90分枠）を完了にした場合:
          // 旧方式では90分枠に60分のweekly1を入れた後、残り30分（10:00〜10:30）にweekly2を30分に切り詰めて無理やり押し込んでいた。
          // 新方式では、weekly1は 09:00〜10:00（60分）、weekly2は 10:00〜11:00（本来の60分）として正しく連続再配置されること！
          const initial = generateTheoreticalSchedule(fixedSlots, [weekly1, weekly2], {
            todayIndex: 1,
            currentMinutes: 540, // 09:00
          });
          const lectureBlock = initial.dayBlocks[1].find(
            (b) => b.title === '1限: ソフトウェア工学',
          )!;

          const step1 = generateTheoreticalSchedule(fixedSlots, [weekly1, weekly2], {
            todayIndex: 1,
            currentMinutes: 540, // 09:00
            completedBlockIds: new Set([lectureBlock.id]),
          });

          const tueStep1 = step1.dayBlocks[1];
          const movedWeekly1 = tueStep1.find((b) => b.title === '設計書作成タスク')!;
          const movedWeekly2 = tueStep1.find((b) => b.title === '単体テスト実装')!;

          expect(movedWeekly1).toBeDefined();
          expect(movedWeekly1.startMinutes).toBe(540); // 09:00
          expect(movedWeekly1.endMinutes).toBe(600); // 10:00 (60分維持)
          expect(movedWeekly1.isWeeklyTask).toBe(true); // 週タスク属性を維持

          expect(movedWeekly2).toBeDefined();
          expect(movedWeekly2.startMinutes).toBe(600); // 10:00
          expect(movedWeekly2.endMinutes).toBe(660); // 11:00 (30分に切り詰められず60分維持！)
          expect(movedWeekly2.isWeeklyTask).toBe(true);

          // さらに 09:40（580分）に前倒しされた「設計書作成タスク（movedWeekly1）」も早く終わった場合（連鎖早期完了）:
          const step2 = generateTheoreticalSchedule(fixedSlots, [weekly1, weekly2], {
            todayIndex: 1,
            currentMinutes: 580, // 09:40
            completedBlockIds: new Set([lectureBlock.id, movedWeekly1.id]),
          });

          const tueStep2 = step2.dayBlocks[1];
          const reMovedWeekly2 = tueStep2.find(
            (b) => b.title === '単体テスト実装' && !b.isCompleted,
          )!;
          expect(reMovedWeekly2).toBeDefined();
          // 現在時刻 09:40（580分）から 10:40（640分）へ60分維持で再配置されること
          expect(reMovedWeekly2.startMinutes).toBe(580);
          expect(reMovedWeekly2.endMinutes).toBe(640);
        });

        it('デバッグ日時変更（todayIndex・currentMinutesの動的変更）に伴い、自動完了・過去未完了再配置・早期完了再配置が即座に連動すること', () => {
          const fixedSlots: FixedSlot[] = [
            {
              id: 'sleep-all',
              title: '睡眠',
              category: 'sleep',
              startMinutes: 0,
              endMinutes: 540, // 09:00
              color: '#6366f1',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'mon-lecture',
              title: '月曜1限講義',
              category: 'lecture',
              startMinutes: 540, // 09:00
              endMinutes: 630, // 10:30
              color: '#0284c7',
              daysOfWeek: [0],
            },
          ];

          const monReport: TaskItem = {
            id: 'mon-report',
            title: '月曜レポート課題',
            category: 'must',
            priority: 'high',
            durationMinutes: 60,
            period: 'week',
            targetDays: [0],
          };

          // 1. デバッグ日時を「月曜(0) 08:00(480分)」に設定: 講義も課題もすべて未来のため未完了
          const atMonMorning = generateTheoreticalSchedule(fixedSlots, [monReport], {
            todayIndex: 0,
            currentMinutes: 480,
          });
          const monLectureAt0800 = atMonMorning.dayBlocks[0].find(
            (b) => b.title === '月曜1限講義',
          )!;
          const monReportAt0800 = atMonMorning.dayBlocks[0].find(
            (b) => b.title === '月曜レポート課題',
          )!;
          expect(monLectureAt0800.isCompleted).toBe(false);
          expect(monReportAt0800.isCompleted).toBe(false);

          // 2. デバッグ日時を「月曜(0) 11:00(660分)」に進める: 10:30終了の月曜1限講義は自動完了、10:30〜11:30のレポート課題はまだ進行中（未完了）
          const atMon1100 = generateTheoreticalSchedule(fixedSlots, [monReport], {
            todayIndex: 0,
            currentMinutes: 660,
          });
          const monLectureAt1100 = atMon1100.dayBlocks[0].find((b) => b.title === '月曜1限講義')!;
          const monReportAt1100 = atMon1100.dayBlocks[0].find(
            (b) => b.title === '月曜レポート課題',
          )!;
          expect(monLectureAt1100.isCompleted).toBe(true);
          expect(monLectureAt1100.isAutoCompleted).toBe(true);
          expect(monReportAt1100.isCompleted).toBe(false);

          // 3. デバッグ日時を「水曜(2) 10:00(600分)」に進め、月曜レポートを未完了トグルした場合: 水曜10:00以降に再配置されること
          const atWed1000 = generateTheoreticalSchedule(fixedSlots, [monReport], {
            todayIndex: 2,
            currentMinutes: 600,
            uncompletedBlockIds: new Set([monReportAt1100.id]),
          });
          const rescheduledOnWed = atWed1000.dayBlocks[2].find(
            (b) => b.isRescheduled && b.title === '月曜レポート課題',
          );
          expect(rescheduledOnWed).toBeDefined();
          expect(rescheduledOnWed!.startMinutes).toBeGreaterThanOrEqual(600);
        });

        it('固定講義やタスクを早期完了した際に1日の予定に隙間が生まれず（0分）、さらに代行タスク自体も連鎖的に完了状態にできること', () => {
          const testFixedSlots: FixedSlot[] = [
            {
              id: 'fixed-sleep',
              title: '睡眠 (良質な8時間休養)',
              category: 'sleep',
              startMinutes: 23 * 60,
              endMinutes: 7 * 60,
              color: '#6366f1',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'fixed-morning',
              title: '朝のルーティン & 準備',
              category: 'routine',
              startMinutes: 7 * 60,
              endMinutes: 8 * 60,
              color: '#64748b',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              id: 'fixed-lecture-mw',
              title: '大学講義 (2限・3限)',
              category: 'lecture',
              startMinutes: 10 * 60 + 40, // 640
              endMinutes: 14 * 60 + 40, // 880
              color: '#0284c7',
              daysOfWeek: [0, 2],
            },
            {
              id: 'fixed-dinner',
              title: '夕食 & リフレッシュ',
              category: 'meal',
              startMinutes: 19 * 60,
              endMinutes: 20 * 60 + 30,
              color: '#f59e0b',
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            },
          ];

          const testTasks: TaskItem[] = [
            {
              id: 'task-study-daily',
              title: '基本情報・資格試験対策',
              taskType: 'task',
              durationMinutes: 60,
              durationSize: 'medium',
              frequency: 'high',
              priority: 'high',
              category: 'must',
              period: 'day',
            },
            {
              id: 'task-workout-daily',
              title: 'ランニング & ストレッチ',
              taskType: 'task',
              durationMinutes: 25,
              durationSize: 'small',
              frequency: 'high',
              priority: 'medium',
              category: 'want',
              period: 'day',
            },
            {
              id: 'task-creative-week',
              title: '個人プロダクト開発・実装',
              taskType: 'task',
              durationMinutes: 90,
              durationSize: 'medium',
              frequency: 'medium',
              priority: 'high',
              category: 'want',
              period: 'week',
            },
          ];

          const baseResult = generateTheoreticalSchedule(testFixedSlots, testTasks, {
            todayIndex: 0,
            currentMinutes: 540, // 月曜 09:00
          });
          const monInitial = baseResult.dayBlocks[0];
          const lectureBlock = monInitial.find(
            (b) => b.isFixed && b.category === 'lecture' && b.startMinutes === 640,
          )!;
          expect(lectureBlock).toBeDefined();

          // Step 1: 大学講義 (10:40〜14:40) を早期完了にする
          const completedIds = new Set<string>([lectureBlock.id]);
          const wave1Result = generateTheoreticalSchedule(testFixedSlots, testTasks, {
            todayIndex: 0,
            currentMinutes: 540,
            completedBlockIds: completedIds,
          });
          const monWave1Active = wave1Result.dayBlocks[0]
            .filter((b) => !b.isEarlyCompleted)
            .sort((a, b) => a.startMinutes - b.startMinutes);

          // 00:00〜24:00 までアクティブなブロック間に1分も隙間がないことを検証
          for (let i = 0; i < monWave1Active.length - 1; i++) {
            const currEnd = monWave1Active[i].endMinutes + (monWave1Active[i].breakMinutes || 0);
            const nextStart = monWave1Active[i + 1].startMinutes;
            expect(nextStart - currEnd).toBe(0);
          }

          // 講義枠の先頭 (10:40 = 640分) に代行タスクが配置されていること
          const firstSubstitute = monWave1Active.find(
            (b) => b.isSubstitute && b.startMinutes <= 640 && b.endMinutes > 640,
          )!;
          expect(firstSubstitute).toBeDefined();
          expect(firstSubstitute.isCompleted).toBe(false);

          // Step 2: 配置された代行タスク (firstSubstitute) をさらに完了状態にする
          completedIds.add(firstSubstitute.id);
          const wave2Result = generateTheoreticalSchedule(testFixedSlots, testTasks, {
            todayIndex: 0,
            currentMinutes: 540,
            completedBlockIds: completedIds,
          });

          // firstSubstitute が早期完了 (isCompleted: true, isEarlyCompleted: true) になっていること
          const completedSubInWave2 = wave2Result.dayBlocks[0].find(
            (b) => b.id === firstSubstitute.id && b.isEarlyCompleted,
          );
          expect(completedSubInWave2).toBeDefined();
          expect(completedSubInWave2!.isCompleted).toBe(true);

          // 次の代行タスクが引き上げられ、かつ1日を通して隙間がゼロ（0分）であること
          const monWave2Active = wave2Result.dayBlocks[0]
            .filter((b) => !b.isEarlyCompleted)
            .sort((a, b) => a.startMinutes - b.startMinutes);
          for (let i = 0; i < monWave2Active.length - 1; i++) {
            const currEnd = monWave2Active[i].endMinutes + (monWave2Active[i].breakMinutes || 0);
            const nextStart = monWave2Active[i + 1].startMinutes;
            expect(nextStart - currEnd).toBe(0);
          }

          // Step 3: 代行タスクから代行元の早期完了ブロック（lectureBlock）が特定でき、「戻す」操作で代行が解消されること
          expect(firstSubstitute.substitutedForBlockId).toBe(lectureBlock.id);
          expect(firstSubstitute.substitutedForTitle).toBe(lectureBlock.title);

          // 早期完了を解除（completedIds から lectureBlock.id を削除して未完了に戻す）
          completedIds.delete(lectureBlock.id);
          completedIds.delete(firstSubstitute.id);
          const restoredResult = generateTheoreticalSchedule(testFixedSlots, testTasks, {
            todayIndex: 0,
            currentMinutes: 540,
            completedBlockIds: completedIds,
          });

          // 講義ブロックが未完了で復帰し、代行タスクが解消されていること
          const restoredLecture = restoredResult.dayBlocks[0].find((b) => b.id === lectureBlock.id);
          expect(restoredLecture).toBeDefined();
          expect(restoredLecture!.isCompleted).toBe(false);
          expect(restoredLecture!.isEarlyCompleted).toBeFalsy();
          const restoredSubs = restoredResult.dayBlocks[0].filter(
            (b) => b.isSubstitute && b.substitutedForBlockId === lectureBlock.id,
          );
          expect(restoredSubs.length).toBe(0);
        });
      });

      describe('Plan13: タスク管理のON/OFF（enabled）と周期の頭（cycleStartDay）の反映', () => {
        it('enabled: false に設定されたタスクや固定枠は計画表に配置されないこと', () => {
          const slots: FixedSlot[] = [
            {
              id: 'slot-enabled',
              title: '有効な固定枠',
              category: 'lecture',
              startMinutes: 540,
              endMinutes: 600,
              color: '#0284c7',
              daysOfWeek: [0],
              enabled: true,
            },
            {
              id: 'slot-disabled',
              title: 'OFFの固定枠',
              category: 'lecture',
              startMinutes: 600,
              endMinutes: 660,
              color: '#0284c7',
              daysOfWeek: [0],
              enabled: false,
            },
          ];

          const tasks: TaskItem[] = [
            {
              id: 'task-enabled',
              title: '有効なタスク',
              category: 'must',
              durationMinutes: 60,
              priority: 'high',
              period: 'week',
              targetDays: [0],
              frequencyCount: 1,
              enabled: true,
            },
            {
              id: 'task-disabled',
              title: 'OFFのタスク',
              category: 'must',
              durationMinutes: 60,
              priority: 'high',
              period: 'week',
              targetDays: [0],
              frequencyCount: 1,
              enabled: false,
            },
          ];

          const result = generateTheoreticalSchedule(slots, tasks);
          const monTitles = result.dayBlocks[0].map((b) => b.title);
          expect(monTitles).toContain('有効な固定枠');
          expect(monTitles).not.toContain('OFFの固定枠');
          expect(monTitles).toContain('有効なタスク');
          expect(monTitles).not.toContain('OFFのタスク');
        });

        it('cycleStartDay が指定された周期タスクは、指定した開始曜日を Day 1 として配置されること', () => {
          const cyclicTask: TaskItem = {
            id: 'task-cycle-wed',
            title: '水曜始まりの3日周期タスク',
            category: 'want',
            durationMinutes: 60,
            priority: 'high',
            period: 'week',
            cycleDays: [0], // Day 1 のみ
            cycleCount: 3, // 3日周期
            cycleStartDay: 2, // 水曜(2)を Day 1 に設定 -> 水(2), 土(5), 火(1) が該当
          };

          const result = generateTheoreticalSchedule([], [cyclicTask]);
          // 該当曜日: 火(1), 水(2), 土(5) に配置され、月(0), 木(3), 金(4), 日(6) には配置されない
          expect(result.dayBlocks[1].some((b) => b.title === '水曜始まりの3日周期タスク')).toBe(
            true,
          );
          expect(result.dayBlocks[2].some((b) => b.title === '水曜始まりの3日周期タスク')).toBe(
            true,
          );
          expect(result.dayBlocks[5].some((b) => b.title === '水曜始まりの3日周期タスク')).toBe(
            true,
          );
          expect(result.dayBlocks[0].some((b) => b.title === '水曜始まりの3日周期タスク')).toBe(
            false,
          );
          expect(result.dayBlocks[3].some((b) => b.title === '水曜始まりの3日周期タスク')).toBe(
            false,
          );
          expect(result.dayBlocks[4].some((b) => b.title === '水曜始まりの3日周期タスク')).toBe(
            false,
          );
          expect(result.dayBlocks[6].some((b) => b.title === '水曜始まりの3日周期タスク')).toBe(
            false,
          );
        });

        it('日跨ぎ固定枠（23:00〜07:00 / 1380〜420分）が当日の夜と翌日の朝に正しく分割されて配置されること', () => {
          const overnightSlot: FixedSlot = {
            id: 'slot-overnight-sleep',
            title: '睡眠',
            category: 'sleep',
            color: '#6366f1',
            startMinutes: 1380, // 23:00
            endMinutes: 420, // 07:00
            daysOfWeek: [0], // 月曜夜の睡眠
          };

          const schedule = generateTheoreticalSchedule([overnightSlot], []);

          // 月曜（0）の夜: 23:00〜24:00 (1380〜1440分) にブロックが存在すること
          const monSleep = schedule.dayBlocks[0].find(
            (b) => b.title === '睡眠' && b.startMinutes === 1380 && b.endMinutes === 1440,
          );
          expect(monSleep).toBeDefined();

          // 火曜（1）の朝: 00:00〜07:00 (0〜420分) にブロックが存在すること
          const tueSleep = schedule.dayBlocks[1].find(
            (b) => b.title === '睡眠' && b.startMinutes === 0 && b.endMinutes === 420,
          );
          expect(tueSleep).toBeDefined();
        });
      });

      describe('Plan14: 日付・週の概念によるタスク分類と配置制御', () => {
        it('週タスクの分類（先週タスク・出題中タスク・未出題タスク）が正しく判定されること', () => {
          // 基準日: 月曜日 (todayIndex: 0)
          const todayIdx = 0;

          // ① 未出題タスク: 木曜出題 (startDay: 3)
          const upcomingTask: TaskItem = {
            id: 'task-upcoming',
            title: '木曜出題の課題',
            period: 'week',
            startDay: 3,
            deadlineDay: 6,
            durationMinutes: 60,
            priority: 'medium',
            category: 'study',
          };
          expect(classifyWeeklyTask(upcomingTask, todayIdx)).toBe('upcoming');

          // ② 出題中タスク: 月曜出題 (startDay: 0)
          const activeTask: TaskItem = {
            id: 'task-active',
            title: '月曜出題の課題',
            period: 'week',
            startDay: 0,
            deadlineDay: 4,
            durationMinutes: 60,
            priority: 'medium',
            category: 'study',
          };
          expect(classifyWeeklyTask(activeTask, todayIdx)).toBe('active');

          // ③ 先週タスク: 木曜出題〜翌週火曜締切で月曜時点
          const lastWeekTask: TaskItem = {
            id: 'task-last-week',
            title: '前週出題の週跨ぎ課題',
            period: 'week',
            taskType: 'assignment',
            startDay: 3, // 木曜
            deadlineDay: 1, // 翌週火曜
            durationMinutes: 60,
            priority: 'high',
            category: 'study',
          };
          expect(classifyWeeklyTask(lastWeekTask, todayIdx)).toBe('last_week');

          // 明示的な先週フラグ
          const explicitLastWeek: TaskItem = {
            id: 'task-explicit-last',
            title: '先週フラグ付きタスク',
            period: 'week',
            taskOriginWeek: 'last',
            durationMinutes: 60,
            priority: 'medium',
            category: 'study',
          };
          expect(classifyWeeklyTask(explicitLastWeek, todayIdx)).toBe('last_week');

          // ④ 出題中の定義: 現在時刻が付随元のタスクの時間を超えているもの
          // 月曜日の講義（10:30 / 630分 終了）に付随する課題タスク
          const attachedTask: TaskItem = {
            id: 'task-attached-lecture',
            title: '情報数学の課題レポート',
            period: 'week',
            isAttachedTask: true,
            startDay: 0, // 月曜出題
            parentEndMinutesByDay: { 0: 630 }, // 10:30 終了
            durationMinutes: 45,
            priority: 'high',
            category: 'study',
          };

          // 講義中（09:30 / 570分）: まだ付随元タスクの時間を超えていないため「未出題」
          expect(classifyWeeklyTask(attachedTask, 0, 570)).toBe('upcoming');

          // 講義終了後（11:00 / 660分）: 付随元タスクの時間を超えたため「出題中」
          expect(classifyWeeklyTask(attachedTask, 0, 660)).toBe('active');

          // ⑤ 先週の分のタスクが未完了状態のまま持ち越されている場合、先週分のタスクに分類されること
          const lastWeekUncompletedBlock: TheoreticalBlock = {
            id: 'block-rescheduled-1-last-task',
            title: '先週の未完了課題',
            category: 'study',
            startMinutes: 600,
            endMinutes: 660,
            color: '#8b5cf6',
            isFixed: false,
            dayIndex: 1, // 火曜
            isWeeklyTask: true,
            isRescheduled: true,
            isCompleted: false, // 未完了
            taskOriginWeek: 'last',
          };
          expect(classifyWeeklyBlock(lastWeekUncompletedBlock, todayIdx)).toBe('last_week');

          // 週跨ぎ課題（木曜出題〜翌週火曜締切）で未完了のまま持ち越されたブロック
          const crossWeekUncompletedBlock: TheoreticalBlock = {
            id: 'block-task-0-cross-task-0',
            title: '週跨ぎの未完了課題',
            category: 'study',
            startMinutes: 600,
            endMinutes: 660,
            color: '#8b5cf6',
            isFixed: false,
            dayIndex: 0, // 月曜
            isWeeklyTask: true,
            isCompleted: false, // 未完了
            deadlineDay: 1, // 火曜締切
            rescheduledFromDay: 3, // 先週木曜から持ち越し
          };
          expect(classifyWeeklyBlock(crossWeekUncompletedBlock, todayIdx)).toBe('last_week');
        });

        it('未出題タスクが出題曜日より前にフライング配置されないこと', () => {
          // 木曜日（3）に出題される課題タスク
          const task: TaskItem = {
            id: 'thu-assignment',
            title: '木曜日の課題',
            period: 'week',
            taskType: 'assignment',
            startDay: 3, // 木曜
            deadlineDay: 5, // 土曜
            durationMinutes: 90,
            priority: 'high',
            category: 'study',
          };

          // 月曜（todayIndex: 0）時点でスケジューリング
          const schedule = generateTheoreticalSchedule([], [task], {
            todayIndex: 0,
            currentMinutes: 540,
          });

          // 月(0), 火(1), 水(2) には配置されていないこと！
          expect(schedule.dayBlocks[0].some((b) => b.title === '木曜日の課題')).toBe(false);
          expect(schedule.dayBlocks[1].some((b) => b.title === '木曜日の課題')).toBe(false);
          expect(schedule.dayBlocks[2].some((b) => b.title === '木曜日の課題')).toBe(false);

          // 木(3) 以降に配置されていること
          const placedDay3 = schedule.dayBlocks[3].some((b) => b.title === '木曜日の課題');
          const placedDay4 = schedule.dayBlocks[4].some((b) => b.title === '木曜日の課題');
          const placedDay5 = schedule.dayBlocks[5].some((b) => b.title === '木曜日の課題');
          expect(placedDay3 || placedDay4 || placedDay5).toBe(true);
        });

        it('日タスクの分類（前日分のタスクと今日の分のタスク）が正しく識別されること', () => {
          const todayIdx = 2; // 水曜

          // 前日（火曜: 1）から持ち越された再配置タスク
          const yesterdayBlock: TheoreticalBlock = {
            id: 'block-rescheduled-1-task1',
            title: '前日未完了タスク',
            category: 'routine',
            startMinutes: 600,
            endMinutes: 660,
            color: '#64748b',
            isFixed: false,
            dayIndex: todayIdx,
            isRescheduled: true,
            rescheduledFromDay: 1, // 火曜
          };
          expect(classifyDailyBlock(yesterdayBlock, todayIdx)).toBe('yesterday');

          // 今日のタスク
          const todayBlock: TheoreticalBlock = {
            id: 'block-task-2-task2-0',
            title: '今日のタスク',
            category: 'routine',
            startMinutes: 700,
            endMinutes: 760,
            color: '#64748b',
            isFixed: false,
            dayIndex: todayIdx,
          };
          expect(classifyDailyBlock(todayBlock, todayIdx)).toBe('today');
        });

        it('早期完了枠と時間帯が重複していない空き時間に配置されたタスクは代行タスク（isSubstitute）にならないこと', () => {
          // 月曜(dayIndex: 0)
          // 09:00〜10:00 (540〜600分) の固定枠（これが早期完了される）
          // 13:00〜14:00 (780〜840分) に別の空き時間がある
          const fixedSlots: FixedSlot[] = [
            {
              id: 'slot-morning-meeting',
              title: '朝ミーティング',
              category: 'meeting',
              startMinutes: 540,
              endMinutes: 600,
              color: '#3b82f6',
              daysOfWeek: [0],
            },
            {
              id: 'slot-afternoon-work',
              title: '午後枠',
              category: 'study',
              startMinutes: 600,
              endMinutes: 720,
              color: '#10b981',
              daysOfWeek: [0],
            },
          ];

          // 2つの週タスクを用意（1つは代行枠、もう1つは午後の空き枠などに配置される想定）
          const task1: TaskItem = {
            id: 'task-substitute-target',
            title: '代行枠に入るタスク',
            category: 'study',
            period: 'week',
            durationMinutes: 60,
            priority: 'high',
          };
          const task2: TaskItem = {
            id: 'task-normal-target',
            title: '通常空き枠に入るタスク',
            category: 'hobby',
            period: 'week',
            durationMinutes: 60,
            priority: 'low',
          };

          // 朝ミーティングを早期完了にする
          const morningBlockId = 'block-fixed-0-slot-morning-meeting';
          const result = generateTheoreticalSchedule(fixedSlots, [task1, task2], {
            todayIndex: 0,
            currentMinutes: 480,
            completedBlockIds: new Set([morningBlockId]),
          });

          const monBlocks = result.dayBlocks[0];

          // 早期完了枠（540〜600分）と重複した位置にあるタスクは代行タスク
          const substituteBlock = monBlocks.find((b) => b.isSubstitute);
          if (substituteBlock) {
            expect(substituteBlock.startMinutes).toBeLessThan(600);
            expect(substituteBlock.endMinutes).toBeGreaterThan(540);
            expect(substituteBlock.substitutedForBlockId).toBe(morningBlockId);
          }

          // 早期完了枠と重複していない通常枠に配置されたブロックは代行タスクではないこと
          const nonSubstituteTasks = monBlocks.filter(
            (b) => !b.isFixed && b.startMinutes >= 600,
          );
          expect(nonSubstituteTasks.length).toBeGreaterThan(0);
          for (const block of nonSubstituteTasks) {
            expect(block.isSubstitute).toBeFalsy();
            expect(block.substitutedForBlockId).toBeUndefined();
          }
        });

        it('完了状態になっていない未来のタスク枠や固定枠に代行タスクが勝手に発生しないこと', () => {
          // 水曜(dayIndex: 2) 10:00 (600分)
          // 木曜(dayIndex: 3)に日課タスクや固定枠が予定されている
          const fixedSlots: FixedSlot[] = [
            {
              id: 'slot-thu-lecture',
              title: '木曜の講義',
              category: 'lecture',
              startMinutes: 540,
              endMinutes: 630,
              color: '#3b82f6',
              daysOfWeek: [3],
            },
          ];
          const taskA: TaskItem = {
            id: 'task-report',
            title: 'レポート作成',
            category: 'study',
            period: 'week',
            durationMinutes: 60,
            priority: 'high',
          };

          // ユーザーは何も完了にしていない（completedBlockIds は空）
          const result = generateTheoreticalSchedule(fixedSlots, [taskA], {
            todayIndex: 2,
            currentMinutes: 600,
            completedBlockIds: new Set(),
            uncompletedBlockIds: new Set(),
          });

          // 全ての曜日において代行タスク（isSubstitute: true）が0件であること
          for (let d = 0; d < 7; d++) {
            const subs = result.dayBlocks[d].filter((b) => b.isSubstitute);
            expect(subs.length).toBe(0);
          }
        });

        it('過去の再配置タスクを完了にしても、未来の同じタスク枠が早期完了扱いになって代行を発生させないこと', () => {
          // 火曜(1)から水曜(2)に持ち越された再配置タスクを水曜に完了にした場合
          // 木曜(3)にある同じタスク（未完了）が完了扱いになって代行タスクを誘発しないこと
          const fixedSlots: FixedSlot[] = [
            {
              id: 'slot-thu-base',
              title: '木曜固定枠',
              category: 'lecture',
              startMinutes: 540,
              endMinutes: 630,
              color: '#3b82f6',
              daysOfWeek: [3],
            },
          ];
          const repeatedTask: TaskItem = {
            id: 'task-routine-kintore',
            title: '筋トレ',
            category: 'workout',
            period: 'day',
            frequency: 'high',
            durationMinutes: 45,
            priority: 'medium',
          };
          const weeklyTask: TaskItem = {
            id: 'task-extra-study',
            title: '資格勉強',
            category: 'study',
            period: 'week',
            durationMinutes: 60,
            priority: 'high',
          };

          // 水曜日の再配置タスクを完了したID: block-rescheduled-2-task-routine-kintore
          const completedIds = new Set(['block-rescheduled-2-task-routine-kintore']);

          const result = generateTheoreticalSchedule(fixedSlots, [repeatedTask, weeklyTask], {
            todayIndex: 2, // 水曜
            currentMinutes: 600,
            completedBlockIds: completedIds,
          });

          // 木曜(3)の筋トレ（未完了の未来枠）が早期完了扱いになって代行（資格勉強）が発生していないこと
          const thuBlocks = result.dayBlocks[3];
          const thuSubs = thuBlocks.filter((b) => b.isSubstitute);
          expect(thuSubs.length).toBe(0);

          // 木曜の筋トレは通常通り未完了（isCompleted: false）であること
          const thuKintore = thuBlocks.find((b) => b.taskId === 'task-routine-kintore');
          if (thuKintore) {
            expect(thuKintore.isCompleted).toBe(false);
          }
        });

        describe('Plan16: 付随タスクの分割配置機能（スプリット・アロケーション）', () => {
          it('連続した空き枠がない場合でも、allowSplitが有効なら空き枠に合わせて自動分割して同日に配置されること', () => {
            // 月曜（dayIndex: 0）の固定講義: 12:00〜13:30 (720〜810分)
            // 午後に30分の空き枠が2つある環境（13:30〜14:00 / 810〜840分、15:00〜15:30 / 900〜930分）
            // その間（14:00〜15:00、15:30〜24:00）は他の固定予定で埋まっている
            const fixedSlots: FixedSlot[] = [
              {
                id: 'slot-mon-lecture',
                title: 'プログラミング演習',
                category: 'lecture',
                startMinutes: 720,
                endMinutes: 810,
                daysOfWeek: [0],
                color: '#3b82f6',
              },
              {
                id: 'slot-mon-meeting',
                title: 'ミーティング',
                category: 'routine',
                startMinutes: 840,
                endMinutes: 900,
                daysOfWeek: [0],
                color: '#10b981',
              },
              {
                id: 'slot-mon-night',
                title: '夜の固定予定',
                category: 'routine',
                startMinutes: 930,
                endMinutes: 1440,
                daysOfWeek: [0],
                color: '#6366f1',
              },
            ];

            // 所要時間60分の付随タスク（allowSplit: true, splitCount: 2 ➔ 60分を2回で割って30分×2回）
            const attachedTask: TaskItem = {
              id: 'task-attached-prog',
              title: 'プログラミング演習の復習',
              category: 'study',
              durationMinutes: 60,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              isAttachedTask: true,
              parentTitle: 'プログラミング演習',
              parentEndMinutesByDay: { 0: 810 },
              targetDays: [0],
              startDay: 0,
              allowSplit: true,
              splitCount: 2,
            };

            const result = generateTheoreticalSchedule(fixedSlots, [attachedTask], {
              todayIndex: 0,
              currentMinutes: 540,
            });

            const monBlocks = result.dayBlocks[0];
            // 月曜日に2つの分割ブロックとして配置されていること
            const splitBlocks = monBlocks.filter((b) => b.taskId === 'task-attached-prog');
            expect(splitBlocks.length).toBe(2);

            // 1つ目の分割ブロック: 13:30〜14:00 (810〜840) [30分]
            const part1 = splitBlocks.find((b) => b.splitIndex === 1);
            expect(part1).toBeDefined();
            expect(part1?.startMinutes).toBe(810);
            expect(part1?.endMinutes).toBe(840);
            expect(part1?.title).toBe('プログラミング演習の復習 (1/2)');
            expect(part1?.isSplitBlock).toBe(true);
            expect(part1?.totalSplits).toBe(2);

            // 2つ目の分割ブロック: 15:00〜15:30 (900〜930) [30分]
            const part2 = splitBlocks.find((b) => b.splitIndex === 2);
            expect(part2).toBeDefined();
            expect(part2?.startMinutes).toBe(900);
            expect(part2?.endMinutes).toBe(930);
            expect(part2?.title).toBe('プログラミング演習の復習 (2/2)');
            expect(part2?.isSplitBlock).toBe(true);
            expect(part2?.totalSplits).toBe(2);
          });

          it('90分の付随タスクを指定の3分割に設定した場合、30分×3回として均等配置されること', () => {
            // 月曜に30分の空き枠が3つある環境（800〜830, 860〜890, 920〜950）
            const fixedSlots: FixedSlot[] = [
              {
                id: 'slot-mon-lecture',
                title: '物理実験',
                category: 'lecture',
                startMinutes: 700,
                endMinutes: 800,
                daysOfWeek: [0],
                color: '#3b82f6',
              },
              {
                id: 'slot-block-1',
                title: '用事1',
                category: 'routine',
                startMinutes: 830,
                endMinutes: 860,
                daysOfWeek: [0],
                color: '#10b981',
              },
              {
                id: 'slot-block-2',
                title: '用事2',
                category: 'routine',
                startMinutes: 890,
                endMinutes: 920,
                daysOfWeek: [0],
                color: '#10b981',
              },
              {
                id: 'slot-block-3',
                title: '夜の固定予定',
                category: 'routine',
                startMinutes: 950,
                endMinutes: 1440,
                daysOfWeek: [0],
                color: '#6366f1',
              },
            ];

            // 90分の付随タスク（splitCount: 3 ➔ 90 / 3 = 30分×3回）
            const attachedTask: TaskItem = {
              id: 'task-attached-physics',
              title: '物理レポート',
              category: 'study',
              durationMinutes: 90,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              isAttachedTask: true,
              parentTitle: '物理実験',
              parentEndMinutesByDay: { 0: 800 },
              targetDays: [0],
              startDay: 0,
              allowSplit: true,
              splitCount: 3,
            };

            const result = generateTheoreticalSchedule(fixedSlots, [attachedTask], {
              todayIndex: 0,
              currentMinutes: 540,
            });

            const monBlocks = result.dayBlocks[0];
            const splitBlocks = monBlocks.filter((b) => b.taskId === 'task-attached-physics');
            expect(splitBlocks.length).toBe(3);

            expect(splitBlocks[0].title).toBe('物理レポート (1/3)');
            expect(splitBlocks[0].startMinutes).toBe(800);
            expect(splitBlocks[0].endMinutes).toBe(830); // 30分

            expect(splitBlocks[1].title).toBe('物理レポート (2/3)');
            expect(splitBlocks[1].startMinutes).toBe(860);
            expect(splitBlocks[1].endMinutes).toBe(890); // 30分

            expect(splitBlocks[2].title).toBe('物理レポート (3/3)');
            expect(splitBlocks[2].startMinutes).toBe(920);
            expect(splitBlocks[2].endMinutes).toBe(950); // 30分
          });

          it('Plan18改定: 十分な連続空き枠（まとまった時間）がある場合でも、allowSplitが有効なら必ず指定回数に分割されて連続配置されること', () => {
            // 月曜（dayIndex: 0）に60分以上の空き枠がある環境（690〜1440）
            const fixedSlots: FixedSlot[] = [
              {
                id: 'slot-mon-lecture',
                title: '数学講義',
                category: 'lecture',
                startMinutes: 600,
                endMinutes: 690,
                daysOfWeek: [0],
                color: '#3b82f6',
              },
            ];

            const attachedTask: TaskItem = {
              id: 'task-attached-math',
              title: '数学講義の復習',
              category: 'study',
              durationMinutes: 60,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              isAttachedTask: true,
              parentTitle: '数学講義',
              parentEndMinutesByDay: { 0: 690 },
              targetDays: [0],
              startDay: 0,
              allowSplit: true,
              splitCount: 2,
            };

            const result = generateTheoreticalSchedule(fixedSlots, [attachedTask], {
              todayIndex: 0,
              currentMinutes: 540,
            });

            const monBlocks = result.dayBlocks[0];
            const blocks = monBlocks.filter((b) => b.taskId === 'task-attached-math');
            // まとまった時間があっても、ユーザー指定通り2分割されていること！
            expect(blocks.length).toBe(2);

            expect(blocks[0].title).toBe('数学講義の復習 (1/2)');
            expect(blocks[0].startMinutes).toBe(690);
            expect(blocks[0].endMinutes).toBe(720);
            expect(blocks[0].isSplitBlock).toBe(true);

            expect(blocks[1].title).toBe('数学講義の復習 (2/2)');
            expect(blocks[1].startMinutes).toBe(720);
            expect(blocks[1].endMinutes).toBe(750);
            expect(blocks[1].isSplitBlock).toBe(true);
          });

          it('Plan18: 割り切れない分数（余り）がある場合でも、前半スライスに1分ずつ配分され総時間が厳密に一致すること', () => {
            // 月曜（dayIndex: 0）の固定講義: 12:00〜13:00 (720〜780)
            // 20分の空き枠が3つある環境（780〜800, 820〜840, 860〜880）
            const fixedSlots: FixedSlot[] = [
              {
                id: 'slot-mon-lecture',
                title: '化学講義',
                category: 'lecture',
                startMinutes: 720,
                endMinutes: 780,
                daysOfWeek: [0],
                color: '#3b82f6',
              },
              {
                id: 'slot-gap-1',
                title: '予定1',
                category: 'routine',
                startMinutes: 800,
                endMinutes: 820,
                daysOfWeek: [0],
                color: '#10b981',
              },
              {
                id: 'slot-gap-2',
                title: '予定2',
                category: 'routine',
                startMinutes: 840,
                endMinutes: 860,
                daysOfWeek: [0],
                color: '#10b981',
              },
              {
                id: 'slot-night',
                title: '夜の固定予定',
                category: 'routine',
                startMinutes: 880,
                endMinutes: 1440,
                daysOfWeek: [0],
                color: '#6366f1',
              },
            ];

            // 50分の付随タスクを3分割（50 / 3 = 16 余り 2 ➔ 17分, 17分, 16分）
            const attachedTask: TaskItem = {
              id: 'task-attached-chem',
              title: '化学の復習',
              category: 'study',
              durationMinutes: 50,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              isAttachedTask: true,
              parentTitle: '化学講義',
              parentEndMinutesByDay: { 0: 780 },
              targetDays: [0],
              startDay: 0,
              allowSplit: true,
              splitCount: 3,
            };

            const result = generateTheoreticalSchedule(fixedSlots, [attachedTask], {
              todayIndex: 0,
              currentMinutes: 540,
            });

            const monBlocks = result.dayBlocks[0];
            const splitBlocks = monBlocks.filter((b) => b.taskId === 'task-attached-chem');
            expect(splitBlocks.length).toBe(3);

            // スライス1: 17分 (780〜797)
            expect(splitBlocks[0].title).toBe('化学の復習 (1/3)');
            expect(splitBlocks[0].startMinutes).toBe(780);
            expect(splitBlocks[0].endMinutes).toBe(797);
            expect(splitBlocks[0].endMinutes - splitBlocks[0].startMinutes).toBe(17);

            // スライス2: 17分 (820〜837)
            expect(splitBlocks[1].title).toBe('化学の復習 (2/3)');
            expect(splitBlocks[1].startMinutes).toBe(820);
            expect(splitBlocks[1].endMinutes).toBe(837);
            expect(splitBlocks[1].endMinutes - splitBlocks[1].startMinutes).toBe(17);

            // スライス3: 16分 (860〜876)
            expect(splitBlocks[2].title).toBe('化学の復習 (3/3)');
            expect(splitBlocks[2].startMinutes).toBe(860);
            expect(splitBlocks[2].endMinutes).toBe(876);
            expect(splitBlocks[2].endMinutes - splitBlocks[2].startMinutes).toBe(16);

            // 合計時間が50分と厳密に一致すること
            const totalScheduledMinutes = splitBlocks.reduce(
              (sum, b) => sum + (b.endMinutes - b.startMinutes),
              0,
            );
            expect(totalScheduledMinutes).toBe(50);
          });

          it('Plan18: 5回を超える多分割（6分割）でも、上限なく均等配置されること', () => {
            // 月曜に20分の空き枠が6箇所ある環境
            const fixedSlots: FixedSlot[] = [
              {
                id: 'slot-mon-lecture',
                title: '情報数学',
                category: 'lecture',
                startMinutes: 600,
                endMinutes: 700,
                daysOfWeek: [0],
                color: '#3b82f6',
              },
              // 700〜720 空き (20分)
              { id: 'b1', title: '固定1', category: 'routine', startMinutes: 720, endMinutes: 740, daysOfWeek: [0], color: '#aaa' },
              // 740〜760 空き (20分)
              { id: 'b2', title: '固定2', category: 'routine', startMinutes: 760, endMinutes: 780, daysOfWeek: [0], color: '#aaa' },
              // 780〜800 空き (20分)
              { id: 'b3', title: '固定3', category: 'routine', startMinutes: 800, endMinutes: 820, daysOfWeek: [0], color: '#aaa' },
              // 820〜840 空き (20分)
              { id: 'b4', title: '固定4', category: 'routine', startMinutes: 840, endMinutes: 860, daysOfWeek: [0], color: '#aaa' },
              // 860〜880 空き (20分)
              { id: 'b5', title: '固定5', category: 'routine', startMinutes: 880, endMinutes: 900, daysOfWeek: [0], color: '#aaa' },
              // 900〜920 空き (20分)
              { id: 'b6', title: '夜固定', category: 'routine', startMinutes: 920, endMinutes: 1440, daysOfWeek: [0], color: '#aaa' },
            ];

            // 120分の付随タスクを6分割（120 / 6 = 20分×6回）
            const attachedTask: TaskItem = {
              id: 'task-attached-infomath',
              title: '情報数学の演習',
              category: 'study',
              durationMinutes: 120,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              isAttachedTask: true,
              parentTitle: '情報数学',
              parentEndMinutesByDay: { 0: 700 },
              targetDays: [0],
              startDay: 0,
              allowSplit: true,
              splitCount: 6,
            };

            const result = generateTheoreticalSchedule(fixedSlots, [attachedTask], {
              todayIndex: 0,
              currentMinutes: 540,
            });

            const monBlocks = result.dayBlocks[0];
            const splitBlocks = monBlocks.filter((b) => b.taskId === 'task-attached-infomath');
            expect(splitBlocks.length).toBe(6);

            for (let i = 0; i < 6; i++) {
              expect(splitBlocks[i].title).toBe(`情報数学の演習 (${i + 1}/6)`);
              expect(splitBlocks[i].endMinutes - splitBlocks[i].startMinutes).toBe(20);
              expect(splitBlocks[i].isSplitBlock).toBe(true);
              expect(splitBlocks[i].totalSplits).toBe(6);
            }
          });

          it('Plan18: 親講義の開始前（午前中）に空き枠があっても、親講義終了前には配置されないこと', () => {
            // 午前中（480〜600 / 08:00〜10:00）にたっぷり空き枠があるが、親講義は13:00〜14:30 (780〜870)
            const fixedSlots: FixedSlot[] = [
              {
                id: 'slot-lecture-afternoon',
                title: '午後ゼミ',
                category: 'lecture',
                startMinutes: 780,
                endMinutes: 870,
                daysOfWeek: [0],
                color: '#3b82f6',
              },
              {
                id: 'slot-night-routine',
                title: '夜固定',
                category: 'routine',
                startMinutes: 930,
                endMinutes: 1440,
                daysOfWeek: [0],
                color: '#aaa',
              },
            ];

            // 60分の付随タスク（2分割 ➔ 30分×2回）
            // 午後870〜930（60分）に空きがある
            const attachedTask: TaskItem = {
              id: 'task-attached-seminar',
              title: 'ゼミ復習',
              category: 'study',
              durationMinutes: 60,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              isAttachedTask: true,
              parentTitle: '午後ゼミ',
              parentEndMinutesByDay: { 0: 870 },
              targetDays: [0],
              startDay: 0,
              allowSplit: true,
              splitCount: 2,
            };

            const result = generateTheoreticalSchedule(fixedSlots, [attachedTask], {
              todayIndex: 0,
              currentMinutes: 480,
            });

            const monBlocks = result.dayBlocks[0];
            const splitBlocks = monBlocks.filter((b) => b.taskId === 'task-attached-seminar');

            // すべて親講義終了時刻（870分 / 14:30）以降に配置されていること
            expect(splitBlocks.length).toBeGreaterThan(0);
            for (const b of splitBlocks) {
              expect(b.startMinutes).toBeGreaterThanOrEqual(870);
            }
          });

          it('Plan18改定: 当日に1スライスしか入る枠がなかった場合でもタスクが消失せず、残りのスライスが翌日へフォールバックして全スライスが確実に配置されること', () => {
            // 月曜（dayIndex: 0）は30分の空き枠が1箇所しかなく、その後は夜まで埋まっている
            // 火曜（dayIndex: 1）には十分な空き枠がある
            const fixedSlots: FixedSlot[] = [
              {
                id: 'slot-mon-lecture',
                title: '月曜講義',
                category: 'lecture',
                startMinutes: 600,
                endMinutes: 700,
                daysOfWeek: [0],
                color: '#3b82f6',
              },
              // 700〜730 空き (30分)
              {
                id: 'slot-mon-busy',
                title: '月曜予定',
                category: 'routine',
                startMinutes: 730,
                endMinutes: 1440,
                daysOfWeek: [0],
                color: '#aaa',
              },
              // 火曜（dayIndex: 1）は午後が空いている
              {
                id: 'slot-tue-morning',
                title: '火曜午前',
                category: 'routine',
                startMinutes: 540,
                endMinutes: 720,
                daysOfWeek: [1],
                color: '#aaa',
              },
            ];

            // 60分の付随タスク（2分割 ➔ 30分×2回）
            const attachedTask: TaskItem = {
              id: 'task-attached-fallback-test',
              title: '復習スプリット',
              category: 'study',
              durationMinutes: 60,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              isAttachedTask: true,
              parentTitle: '月曜講義',
              parentEndMinutesByDay: { 0: 700 },
              targetDays: [0],
              startDay: 0,
              allowSplit: true,
              splitCount: 2,
            };

            const result = generateTheoreticalSchedule(fixedSlots, [attachedTask], {
              todayIndex: 0,
              currentMinutes: 480,
            });

            // 月曜（0）にスライス1が配置されていること
            const monBlocks = result.dayBlocks[0].filter(
              (b) => b.taskId === 'task-attached-fallback-test',
            );
            expect(monBlocks.length).toBe(1);
            expect(monBlocks[0].title).toBe('復習スプリット (1/2)');
            expect(monBlocks[0].startMinutes).toBe(700);
            expect(monBlocks[0].endMinutes).toBe(730);

            // 火曜（1）にスライス2がフォールバック配置されていること！
            const tueBlocks = result.dayBlocks[1].filter(
              (b) => b.taskId === 'task-attached-fallback-test',
            );
            expect(tueBlocks.length).toBe(1);
            expect(tueBlocks[0].title).toBe('復習スプリット (2/2)');
            expect(tueBlocks[0].endMinutes - tueBlocks[0].startMinutes).toBe(30);
          });
        });

        describe('Plan19: 週の切り替わり・週跨ぎライフサイクル検証', () => {
          it('木曜出題〜翌週火曜締切の週跨ぎ課題が、月曜日（todayIndex = 0）に「先週タスク (last_week)」として火曜までに配置されること', () => {
            const crossWeekTask: TaskItem = {
              id: 'task-assignment-cross',
              title: '物理レポート課題',
              category: 'study',
              durationMinutes: 60,
              period: 'week',
              taskType: 'assignment',
              startDay: 3, // 木曜出題
              deadlineDay: 1, // 翌週火曜締切
              priority: 'high',
            };

            // 月曜（todayIndex: 0）時点のスケジュール生成
            const result = generateTheoreticalSchedule([], [crossWeekTask], {
              todayIndex: 0,
              currentMinutes: 540,
            });

            // 今週の月曜または火曜に配置されていること（水曜以降にはみ出さない）
            const allBlocks = result.allBlocks.filter((b) => b.taskId === 'task-assignment-cross');
            expect(allBlocks.length).toBeGreaterThan(0);
            for (const b of allBlocks) {
              expect(b.dayIndex).toBeLessThanOrEqual(1); // 月曜(0)または火曜(1)
              expect(b.weeklyClassification).toBe('last_week');
            }
          });

          it('expiryWeeks: 2 のタスクは、先週木曜（fromDay: 3）の未完了であっても月曜日（todayIndex = 0）に弾かれず新週へ再配置されること', () => {
            const task: TaskItem = {
              id: 'task-weekly-report-2w',
              title: '2週間有効レポート',
              category: 'study',
              durationMinutes: 60,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              startDay: 3,
              deadlineDay: 1,
              isFromLastWeek: true,
              taskOriginWeek: 'last',
              expiryWeeks: 2,
            };

            const uncompletedIds = new Set<string>(['block-task-3-task-weekly-report-2w']);

            const result = generateTheoreticalSchedule([], [task], {
              todayIndex: 0,
              currentMinutes: 540,
              uncompletedBlockIds: uncompletedIds,
            });

            const rescheduled = result.allBlocks.filter((b) => b.taskId === 'task-weekly-report-2w');
            expect(rescheduled.length).toBeGreaterThan(0);
          });

          it('expiryWeeks: 1 のタスクは、先週からの未完了タスクが週跨ぎで期限切れとなり新週へ再配置されないこと', () => {
            const task: TaskItem = {
              id: 'task-weekly-report-1w',
              title: '1週間限定レポート',
              category: 'study',
              durationMinutes: 60,
              period: 'week',
              taskType: 'task',
              priority: 'high',
              startDay: 3,
              deadlineDay: 1,
              isFromLastWeek: true,
              taskOriginWeek: 'last',
              expiryWeeks: 1, // 1週間限定
            };

            const uncompletedIds = new Set<string>(['block-task-3-task-weekly-report-1w']);

            const result = generateTheoreticalSchedule([], [task], {
              todayIndex: 0,
              currentMinutes: 540,
              uncompletedBlockIds: uncompletedIds,
            });

            const rescheduled = result.allBlocks.filter(
              (b) => b.taskId === 'task-weekly-report-1w' && b.isRescheduled,
            );
            // 期限切れのため再配置されないこと！
            expect(rescheduled.length).toBe(0);
          });
        });
      });
    });
  });
});
