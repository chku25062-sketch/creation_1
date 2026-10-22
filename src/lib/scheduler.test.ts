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
        expect(result.dayBlocks[d].some((b) => b.title === '木曜ゼミ (401教室) のタスク')).toBe(false);
        expect(result.dayBlocks[d].some((b) => b.title === '金曜実験 (情報棟) のタスク')).toBe(false);
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
        const uncompletedMonBlock = uncompletedResult.dayBlocks[0].find((b) => b.title === '月曜の数学レポート');
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
        const rescheduledBlock = futureBlocks.find((b) => b.isRescheduled && b.title === '月曜の数学レポート');
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

        const monBlock = normalResult.dayBlocks[0].find((b) => b.title === '月曜の物理実験レポート');
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

        const rescheduled = futureBlocks.find((b) => b.isRescheduled && b.title === '月曜の物理実験レポート');
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
        expect(result.dayBlocks[0].some((b) => b.title === '大学講義 (2限・3限) のタスク')).toBe(true);
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
        const sunMorningBlock = sundayBlocks.find((b) => b.startMinutes === 0 && b.endMinutes === 420);
        const sunNightBlock = sundayBlocks.find((b) => b.startMinutes === 1380 && b.endMinutes === 1440);
        expect(sunMorningBlock).toBeUndefined();
        expect(sunNightBlock).toBeDefined();

        // 翌日の月曜（dayIndex: 0）の朝（00:00〜07:00）に睡眠ブロックが存在すること
        const mondayBlocks = result.dayBlocks[0];
        const monMorningBlock = mondayBlocks.find((b) => b.startMinutes === 0 && b.endMinutes === 420);
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
        const normalResult = generateTheoreticalSchedule([], [morningTask, afternoonTask, wednesdayTask], {
          todayIndex: 1, // 火曜
          currentMinutes: 480, // 08:00
        });

        const tueBlocks = normalResult.dayBlocks[1];
        const morningBlock = tueBlocks.find((b) => b.title === '火曜午前のレポート');
        expect(morningBlock).toBeDefined();

        // ユーザーが火曜午前のレポートを早期完了
        const earlyResult = generateTheoreticalSchedule([], [morningTask, afternoonTask, wednesdayTask], {
          todayIndex: 1,
          currentMinutes: 480,
          completedBlockIds: new Set([morningBlock!.id]),
        });

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
    });
  });
});


