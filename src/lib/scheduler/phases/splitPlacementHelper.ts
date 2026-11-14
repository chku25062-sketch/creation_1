import { FreeSlot } from '@/types';
import { DayTaskContext, SchedulingExecutionContext } from '../types';
import { WEEKLY_TASK_COLOR } from '../constants';
import { classifyWeeklyTask } from '../taskClassifier';

/**
 * Plan16: 付随タスクの分割配置ヘルパー
 * 連続した空き枠がない場合、設定された最小単位（minSplitMinutes）以上の複数の空き枠へ分割して配置する。
 */
export function tryPlaceSplitAttachedTask(
  d: number,
  taskCtx: DayTaskContext,
  ctx: SchedulingExecutionContext,
): boolean {
  const { plan, task } = taskCtx;
  const totalDuration =
    task.durationMinutes && task.durationMinutes > 0 ? task.durationMinutes : 60;
  const minSplit = task.minSplitMinutes || 15;
  const maxSplits = task.maxSplits || 2;

  // 親タスクの終了時刻（同日の場合）
  let taskEarliestStartTime = task.earliestStartTime ?? 0;
  if (taskCtx.isSameDayAsParent) {
    let parentEnd = 0;
    if (task.parentEndMinutesByDay && task.parentEndMinutesByDay[d] !== undefined) {
      parentEnd = task.parentEndMinutesByDay[d];
    } else if (task.parentTitle) {
      const parentBlock = ctx.dayBlocks[d]
        .filter(
          (b) =>
            b.title === task.parentTitle ||
            (task.parentTitle && b.title.startsWith(task.parentTitle)),
        )
        .sort((a, b) => b.endMinutes - a.endMinutes)[0];
      if (parentBlock) {
        parentEnd = parentBlock.endMinutes + (parentBlock.breakMinutes || 0);
      }
    }
    if (parentEnd > 0) {
      taskEarliestStartTime = Math.max(taskEarliestStartTime, parentEnd);
    }
  }

  const slots = ctx.slotManager.getAvailableSlots(d);
  if (!slots || slots.length === 0) return false;

  // 利用可能なスロットチャンクを抽出
  interface AvailableChunk {
    slot: FreeSlot;
    effectiveStart: number;
    availableMinutes: number;
  }
  const chunks: AvailableChunk[] = [];
  for (const s of slots) {
    const effStart = Math.max(s.startMinutes, taskEarliestStartTime);
    const avail = s.endMinutes - effStart;
    if (effStart < s.endMinutes && avail >= minSplit) {
      chunks.push({ slot: s, effectiveStart: effStart, availableMinutes: avail });
    }
  }

  if (chunks.length === 0) return false;

  // 分割シミュレーション
  let remaining = totalDuration;
  interface SplitAlloc {
    slot: FreeSlot;
    startMinutes: number;
    duration: number;
  }
  const allocs: SplitAlloc[] = [];

  for (const chunk of chunks) {
    if (remaining <= 0) break;
    if (maxSplits > 0 && allocs.length >= maxSplits) break;

    let alloc = Math.min(remaining, chunk.availableMinutes);
    // 残りが minSplit 未満にならないように調整
    if (remaining - alloc > 0 && remaining - alloc < minSplit) {
      if (alloc - minSplit >= minSplit) {
        alloc -= minSplit;
      }
    }

    if (alloc >= minSplit) {
      allocs.push({
        slot: chunk.slot,
        startMinutes: chunk.effectiveStart,
        duration: alloc,
      });
      remaining -= alloc;
    }
  }

  if (allocs.length === 0) return false;

  const totalSplitsCount = allocs.length;

  // ブロックの追加とスロットの消費
  allocs.forEach((item, idx) => {
    const splitIndex = idx + 1;
    const taskStart = item.startMinutes;
    const taskEnd = taskStart + item.duration;

    const splitTitle =
      totalSplitsCount > 1 ? `${task.title} (${splitIndex}/${totalSplitsCount})` : task.title;

    ctx.dayBlocks[d].push({
      id: `block-task-${d}-${task.id}-split-${splitIndex}`,
      title: splitTitle,
      category: task.category,
      startMinutes: taskStart,
      endMinutes: taskEnd,
      isFixed: false,
      isBreak: false,
      color: WEEKLY_TASK_COLOR,
      taskId: task.id,
      priority: task.priority,
      taskType: task.taskType || 'task',
      deadlineDay: task.deadlineDay,
      dayIndex: d,
      sourceTableId: task.sourceTableId,
      sourceTableName: task.sourceTableName,
      isWeeklyTask: true,
      isSplitBlock: totalSplitsCount > 1,
      splitIndex: totalSplitsCount > 1 ? splitIndex : undefined,
      totalSplits: totalSplitsCount > 1 ? totalSplitsCount : undefined,
      weeklyClassification:
        task.weeklyClassification || classifyWeeklyTask(task, ctx.todayIdx, ctx.currMinutes),
    });

    // スロットの消費
    const targetSlot = item.slot;
    if (targetSlot) {
      if (taskStart > targetSlot.startMinutes) {
        const remainingAfter = targetSlot.endMinutes - taskEnd;
        targetSlot.endMinutes = taskStart;
        targetSlot.durationMinutes = targetSlot.endMinutes - targetSlot.startMinutes;
        if (remainingAfter >= 15) {
          slots.push({
            startMinutes: taskEnd,
            endMinutes: taskEnd + remainingAfter,
            durationMinutes: remainingAfter,
          });
        }
      } else {
        targetSlot.startMinutes = taskEnd;
        targetSlot.durationMinutes = targetSlot.endMinutes - taskEnd;
      }
    }

    ctx.scheduledTaskMinutes += item.duration;
  });

  slots.sort((a, b) => a.startMinutes - b.startMinutes);

  taskCtx.placedCountInDay += totalSplitsCount;
  plan.placedCount++;
  plan.placedCountPerDay[d] = (plan.placedCountPerDay[d] || 0) + totalSplitsCount;
  if (remaining <= 0) {
    plan.isComplete = true;
  }

  return true;
}
