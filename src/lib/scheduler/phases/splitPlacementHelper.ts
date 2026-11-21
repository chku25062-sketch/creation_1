import { DayTaskContext, SchedulingExecutionContext } from '../types';
import { WEEKLY_TASK_COLOR } from '../constants';
import { classifyWeeklyTask } from '../taskClassifier';

/**
 * Plan16: 付随タスクの等分割配置ヘルパー
 * 設定された総時間を「指定の回数（splitCount: 2回, 3回...）」で均等に割り、
 * 親タスク直後の空き枠へ順番にスライスタスクとして配置する。
 */
export function tryPlaceSplitAttachedTask(
  d: number,
  taskCtx: DayTaskContext,
  ctx: SchedulingExecutionContext,
): boolean {
  const { plan, task } = taskCtx;
  const totalDuration =
    task.durationMinutes && task.durationMinutes > 0 ? task.durationMinutes : 60;
  // ユーザー指定の分割回数（デフォルト: 2回）
  const splitCount = Math.max(2, task.splitCount || 2);

  // 各スライスの所要時間を均等算出（余りは前半スライスに1分ずつ加算して合計時間を厳密に一致させる）
  const baseMinutes = Math.floor(totalDuration / splitCount);
  const remainder = totalDuration % splitCount;
  const sliceDurations = Array.from(
    { length: splitCount },
    (_, i) => baseMinutes + (i < remainder ? 1 : 0),
  );

  // 親タスクの終了時刻（親講義がある曜日の場合、フォールバックフェーズでも常に親講義終了以降にガード）
  let taskEarliestStartTime = task.earliestStartTime ?? 0;
  let parentEnd = 0;
  if (task.parentEndMinutesByDay && task.parentEndMinutesByDay[d] !== undefined) {
    parentEnd = task.parentEndMinutesByDay[d];
  } else if (taskCtx.isSameDayAsParent && task.parentTitle) {
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

  const slots = ctx.slotManager.getAvailableSlots(d);
  if (!slots || slots.length === 0) return false;

  // すでに配置済みのスライス数を確認（plan全体での配置済み総数）
  const alreadyPlacedSplits = plan.placedSplits || 0;
  if (alreadyPlacedSplits >= splitCount) return false;

  let placedThisTurn = 0;

  for (let sliceIdx = alreadyPlacedSplits; sliceIdx < splitCount; sliceIdx++) {
    const sliceDuration = sliceDurations[sliceIdx];

    // 利用可能なスロットを走査（taskEarliestStartTime 以降）
    let targetSlotIndex = -1;
    let targetSlotStart = -1;

    for (let sIdx = 0; sIdx < slots.length; sIdx++) {
      const s = slots[sIdx];
      const effStart = Math.max(s.startMinutes, taskEarliestStartTime);
      const avail = s.endMinutes - effStart;

      if (effStart < s.endMinutes && avail >= sliceDuration) {
        targetSlotIndex = sIdx;
        targetSlotStart = effStart;
        break;
      }
    }

    // このスライスが入る空き枠が同日にこれ以上なければ終了（残りは別日フォールバックへ）
    if (targetSlotIndex === -1) break;

    const slot = slots[targetSlotIndex];
    const taskStart = targetSlotStart;
    const taskEnd = taskStart + sliceDuration;
    const splitIndex = sliceIdx + 1;

    // ブロックを配置
    const splitTitle = `${task.title} (${splitIndex}/${splitCount})`;

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
      url: task.url,
      isAttachedTask: task.isAttachedTask,
      parentTitle: task.parentTitle,
      isWeeklyTask: true,
      isSplitBlock: true,
      splitIndex,
      totalSplits: splitCount,
      weeklyClassification:
        task.weeklyClassification || classifyWeeklyTask(task, ctx.todayIdx, ctx.currMinutes),
    });

    // スロットの消費 & 再構築
    if (taskStart > slot.startMinutes) {
      const remainingBefore = taskStart - slot.startMinutes;
      const remainingAfter = slot.endMinutes - taskEnd;
      slot.endMinutes = taskStart;
      slot.durationMinutes = remainingBefore;

      if (remainingAfter > 0) {
        slots.push({
          startMinutes: taskEnd,
          endMinutes: taskEnd + remainingAfter,
          durationMinutes: remainingAfter,
        });
      }
    } else {
      slot.startMinutes = taskEnd;
      slot.durationMinutes = slot.endMinutes - taskEnd;
    }

    // 有効な空スロットのみを残して開始時刻順にソート
    const validSlots = slots.filter((s) => s.endMinutes > s.startMinutes && s.durationMinutes > 0);
    slots.length = 0;
    slots.push(...validSlots.sort((a, b) => a.startMinutes - b.startMinutes));

    // ★ 次のスライスは、このスライスの終了時刻以降から探索する（同一空き枠の連続分割配置を保証！）
    taskEarliestStartTime = taskEnd;

    ctx.scheduledTaskMinutes += sliceDuration;
    taskCtx.placedCountInDay++;
    plan.placedCountPerDay[d] = (plan.placedCountPerDay[d] || 0) + 1;
    placedThisTurn++;
  }

  if (placedThisTurn > 0) {
    const totalPlaced = (plan.placedSplits || 0) + placedThisTurn;
    plan.placedSplits = totalPlaced;

    // 全スライスが配置完了した場合のみ、週タスクとして完了にする
    if (totalPlaced >= splitCount) {
      plan.placedCount = plan.targetCountWeekly;
      plan.isComplete = true;
    } else {
      plan.isComplete = false;
    }
    return true;
  }

  return false;
}
