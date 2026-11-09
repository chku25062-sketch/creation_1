import { describe, it, expect } from 'vitest';
import { toggleBlockCompletion } from './completionManager';
import { TheoreticalBlock } from '@/types';

describe('completionManager (Plan14)', () => {
  const dummyBlock: TheoreticalBlock = {
    id: 'block-task-2-task-report-0',
    title: 'レポート作成',
    category: 'study',
    startMinutes: 600,
    endMinutes: 660,
    color: '#8b5cf6',
    isFixed: false,
    dayIndex: 2, // 水曜
    taskId: 'task-report',
    isCompleted: false,
  };

  it('未完了のブロックを完了にした場合、completedBlockIds に登録され uncompletedBlockIds から除外されること', () => {
    const res = toggleBlockCompletion({
      targetBlock: dummyBlock,
      allBlocks: [dummyBlock],
      completedBlockIds: new Set(),
      uncompletedBlockIds: new Set([dummyBlock.id]),
      todayIdx: 2,
      currMinutes: 540,
    });

    expect(res.nextCompletedIds.has(dummyBlock.id)).toBe(true);
    expect(res.nextUncompletedIds.has(dummyBlock.id)).toBe(false);
  });

  it('完了済みの未来ブロックを未完了に戻した場合、completedBlockIds から削除され uncompletedBlockIds には登録されないこと（デフォルト未完了へ）', () => {
    const completedFutureBlock = { ...dummyBlock, isCompleted: true };
    const res = toggleBlockCompletion({
      targetBlock: completedFutureBlock,
      allBlocks: [completedFutureBlock],
      completedBlockIds: new Set([completedFutureBlock.id]),
      uncompletedBlockIds: new Set(),
      todayIdx: 2,
      currMinutes: 540, // 540 < 660 (未来枠)
    });

    expect(res.nextCompletedIds.has(completedFutureBlock.id)).toBe(false);
    expect(res.nextUncompletedIds.has(completedFutureBlock.id)).toBe(false);
  });

  it('完了済みの過去ブロックを未完了に戻した場合、未完了セットに登録されて未来への再配置トリガーとなること', () => {
    const completedPastBlock = { ...dummyBlock, dayIndex: 1, isCompleted: true }; // 火曜（過去）
    const res = toggleBlockCompletion({
      targetBlock: completedPastBlock,
      allBlocks: [completedPastBlock],
      completedBlockIds: new Set([completedPastBlock.id]),
      uncompletedBlockIds: new Set(),
      todayIdx: 2,
      currMinutes: 540,
    });

    expect(res.nextCompletedIds.has(completedPastBlock.id)).toBe(false);
    expect(res.nextUncompletedIds.has(completedPastBlock.id)).toBe(true);
  });

  it('再配置ブロックを完了にした場合、大元ブロック（originalBlockId）も連動して完了になること', () => {
    const originalBlock: TheoreticalBlock = {
      id: 'block-task-1-task-report-0',
      title: 'レポート作成',
      category: 'study',
      startMinutes: 600,
      endMinutes: 660,
      color: '#8b5cf6',
      isFixed: false,
      dayIndex: 1, // 火曜
      taskId: 'task-report',
      isCompleted: false,
    };
    const rescheduledBlock: TheoreticalBlock = {
      id: 'block-rescheduled-2-task-report',
      title: 'レポート作成',
      category: 'study',
      startMinutes: 700,
      endMinutes: 760,
      color: '#8b5cf6',
      isFixed: false,
      dayIndex: 2, // 水曜
      taskId: 'task-report',
      isRescheduled: true,
      rescheduledFromDay: 1,
      originalBlockId: originalBlock.id,
      isCompleted: false,
    };

    const res = toggleBlockCompletion({
      targetBlock: rescheduledBlock,
      allBlocks: [originalBlock, rescheduledBlock],
      completedBlockIds: new Set(),
      uncompletedBlockIds: new Set([originalBlock.id]),
      todayIdx: 2,
      currMinutes: 540,
    });

    expect(res.nextCompletedIds.has(rescheduledBlock.id)).toBe(true);
    expect(res.nextCompletedIds.has(originalBlock.id)).toBe(true);
    expect(res.nextUncompletedIds.has(originalBlock.id)).toBe(false);
  });

  it('大元のタスクを完了にした場合、不要になった再配置ブロックの完了IDは除去されること', () => {
    const originalBlock: TheoreticalBlock = {
      id: 'block-task-1-task-report-0',
      title: 'レポート作成',
      category: 'study',
      startMinutes: 600,
      endMinutes: 660,
      color: '#8b5cf6',
      isFixed: false,
      dayIndex: 1,
      taskId: 'task-report',
      isCompleted: false,
    };
    const rescheduledBlock: TheoreticalBlock = {
      id: 'block-rescheduled-2-task-report',
      title: 'レポート作成',
      category: 'study',
      startMinutes: 700,
      endMinutes: 760,
      color: '#8b5cf6',
      isFixed: false,
      dayIndex: 2,
      taskId: 'task-report',
      isRescheduled: true,
      rescheduledFromDay: 1,
      originalBlockId: originalBlock.id,
      isCompleted: false,
    };

    const res = toggleBlockCompletion({
      targetBlock: originalBlock,
      allBlocks: [originalBlock, rescheduledBlock],
      completedBlockIds: new Set([rescheduledBlock.id]),
      uncompletedBlockIds: new Set([originalBlock.id]),
      todayIdx: 2,
      currMinutes: 540,
    });

    expect(res.nextCompletedIds.has(originalBlock.id)).toBe(true);
    expect(res.nextCompletedIds.has(rescheduledBlock.id)).toBe(false);
    expect(res.nextUncompletedIds.has(originalBlock.id)).toBe(false);
  });
});
