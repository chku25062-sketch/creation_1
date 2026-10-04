import { describe, it, expect } from 'vitest';
import { normalizeFixedSlots, calculateFreeSlots, generateTheoreticalSchedule } from './scheduler';
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
  });
});
