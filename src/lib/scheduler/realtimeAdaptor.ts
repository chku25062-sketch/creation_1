import { TaskItem, TheoreticalBlock } from '@/types';
import { TaskPlacementPlan } from './types';
import { isWeeklyTaskItem, getCategoryColor } from './constants';

export interface RealtimeAdaptationParams {
  dayBlocks: Record<number, TheoreticalBlock[]>;
  plans: TaskPlacementPlan[];
  tasks: TaskItem[];
  todayIdx: number;
  currMinutes: number;
  userCompletedIds: Set<string>;
  userUncompletedIds: Set<string>;
}

export function applyRealtimeAdaptation(params: RealtimeAdaptationParams): {
  scheduledTaskMinutesDelta: number;
} {
  const {
    dayBlocks,
    plans,
    tasks,
    todayIdx,
    currMinutes,
    userCompletedIds,
    userUncompletedIds,
  } = params;

  let scheduledTaskMinutesDelta = 0;

  // 過去時刻かどうかの判定ヘルパー
  const isTimePast = (d: number, endMinutes: number): boolean => {
    if (d < todayIdx) return true;
    if (d === todayIdx && endMinutes <= currMinutes) return true;
    return false;
  };

  const taskById = new Map<string, TaskItem>();
  for (const t of tasks) {
    taskById.set(t.id, t);
  }

  // 週タスクかどうかの判定（日課・固定枠以外）
  const isWeeklyTaskBlock = (block: TheoreticalBlock): boolean => {
    if (block.isFixed || block.isBreak || block.isSubstitute) return false;
    if (block.isWeeklyTask !== undefined) return block.isWeeklyTask;
    if (block.taskId) {
      const task = taskById.get(block.taskId);
      if (task) {
        return isWeeklyTaskItem(task);
      }
    }
    return block.taskType === 'assignment';
  };

  // 1. 各曜日の全ブロックについて完了状態の判定
  const earlyCompletedBlocks: { day: number; block: TheoreticalBlock }[] = [];

  for (let d = 0; d < 7; d++) {
    for (const block of dayBlocks[d]) {
      // 再配置されたブロック（未来枠）は未完了として表示
      if (block.isRescheduled) {
        block.isCompleted = false;
        continue;
      }

      const isPast = isTimePast(d, block.endMinutes);
      const isWeekly = isWeeklyTaskBlock(block);

      // ユーザーが手動で未完了（「まだ終わってないよ」）にしたブロックか判定
      const isExplicitUncompleted =
        userUncompletedIds.has(block.id) ||
        (block.taskId ? userUncompletedIds.has(block.taskId) : false) ||
        Array.from(userUncompletedIds).some(
          (uid) => uid.includes(block.id) || (block.taskId && uid.includes(block.taskId)),
        );

      // ユーザーが手動で早期完了（「もう終わった」）にしたブロックか判定
      const isExplicitCompleted =
        userCompletedIds.has(block.id) ||
        (block.taskId ? userCompletedIds.has(block.taskId) : false) ||
        Array.from(userCompletedIds).some(
          (cid) => cid.includes(block.id) || (block.taskId && cid.includes(block.taskId)),
        );

      // 週タスクのみ手動トグルを反映。日タスクは自動完了・自動未完了のみ
      if (isWeekly && isExplicitUncompleted) {
        block.isCompleted = false;
        block.isUserToggled = true;
      } else if (isWeekly && isExplicitCompleted) {
        block.isCompleted = true;
        block.isUserToggled = true;
        if (!isPast) {
          block.isEarlyCompleted = true;
          earlyCompletedBlocks.push({ day: d, block });
        }
      } else {
        if (isPast) {
          block.isCompleted = true;
          block.isAutoCompleted = true;
        } else {
          block.isCompleted = false;
        }
      }
    }
  }

  // 2. 早期完了された枠への代替タスク配置（完全自動配置のし直し）
  // ★ ユーザー指示: 無理やり引き伸ばさず、存在するタスク群を本来の所要時間で順番に自動配置して埋める
  for (const early of earlyCompletedBlocks) {
    const earlyBlock = early.block;
    let slotPointer = earlyBlock.startMinutes;
    const slotLimit = earlyBlock.endMinutes;
    const usedTaskIdsInEarly = new Set<string>();

    while (slotPointer < slotLimit) {
      const remainingDuration = slotLimit - slotPointer;
      if (remainingDuration < 15) break;

      const sameDayBlocks = dayBlocks[early.day] || [];

      // 候補タスクの選定
      // ① 最優先: その日（early.day）のブロックの中で、早期完了枠以降に予定されている未完了タスク（前倒し対象）
      let substituteTask: TaskItem | undefined;
      let matchedBlockIndexToRemove = -1;

      for (let i = 0; i < sameDayBlocks.length; i++) {
        const b = sameDayBlocks[i];
        if (
          !b.isFixed &&
          !b.isBreak &&
          !b.isSubstitute &&
          b.id !== earlyBlock.id &&
          b.taskId !== earlyBlock.taskId &&
          b.title !== earlyBlock.title &&
          b.taskId &&
          !usedTaskIdsInEarly.has(b.taskId) &&
          !b.isCompleted &&
          b.startMinutes >= earlyBlock.endMinutes
        ) {
          const t = tasks.find((item) => item.id === b.taskId);
          if (t) {
            substituteTask = t;
            matchedBlockIndexToRemove = i;
            break;
          }
        }
      }

      // ② 次点: その日（early.day）のブロックにある他の未完了タスク
      if (!substituteTask) {
        for (let i = 0; i < sameDayBlocks.length; i++) {
          const b = sameDayBlocks[i];
          if (
            !b.isFixed &&
            !b.isBreak &&
            !b.isSubstitute &&
            b.id !== earlyBlock.id &&
            b.taskId !== earlyBlock.taskId &&
            b.title !== earlyBlock.title &&
            b.taskId &&
            !usedTaskIdsInEarly.has(b.taskId) &&
            !b.isCompleted
          ) {
            const t = tasks.find((item) => item.id === b.taskId);
            if (t) {
              substituteTask = t;
              matchedBlockIndexToRemove = i;
              break;
            }
          }
        }
      }

      // ③ 次点: その日（early.day）を候補日に含む未完了プラン
      if (!substituteTask) {
        for (const plan of plans) {
          if (
            plan.task.id === earlyBlock.taskId ||
            plan.origTaskId === earlyBlock.taskId ||
            plan.task.title === earlyBlock.title ||
            usedTaskIdsInEarly.has(plan.task.id)
          ) {
            continue;
          }
          if (plan.candidateDays.includes(early.day) && !plan.isComplete) {
            substituteTask = plan.task;
            plan.placedCount++;
            if (plan.placedCount >= plan.targetCountWeekly) {
              plan.isComplete = true;
            }
            break;
          }
        }
      }

      // ④ 次点: 全プランの中の未完了プラン
      if (!substituteTask) {
        for (const plan of plans) {
          if (
            plan.task.id === earlyBlock.taskId ||
            plan.origTaskId === earlyBlock.taskId ||
            plan.task.title === earlyBlock.title ||
            usedTaskIdsInEarly.has(plan.task.id)
          ) {
            continue;
          }
          if (!plan.isComplete) {
            substituteTask = plan.task;
            plan.placedCount++;
            if (plan.placedCount >= plan.targetCountWeekly) {
              plan.isComplete = true;
            }
            break;
          }
        }
      }

      // ⑤ 最終フォールバック: 未完了がなければ他のタスク
      if (!substituteTask) {
        const otherPlan = plans.find(
          (p) =>
            p.task.id !== earlyBlock.taskId &&
            p.origTaskId !== earlyBlock.taskId &&
            p.task.title !== earlyBlock.title &&
            !usedTaskIdsInEarly.has(p.task.id),
        );
        if (otherPlan) {
          substituteTask = otherPlan.task;
        }
      }

      if (!substituteTask) break;

      usedTaskIdsInEarly.add(substituteTask.id);

      // 本来の所要時間を厳密に計算（決して無理に引き伸ばさない！）
      const rawDuration =
        substituteTask.durationMinutes && substituteTask.durationMinutes > 0
          ? substituteTask.durationMinutes
          : substituteTask.durationSize === 'small'
            ? 25
            : substituteTask.durationSize === 'medium'
              ? 45
              : 30;

      const taskDuration = Math.min(rawDuration, remainingDuration);

      // 前倒しで選ばれた元のブロックがあれば、元の未来ブロックを除去（前倒し移動）
      if (matchedBlockIndexToRemove >= 0) {
        dayBlocks[early.day].splice(matchedBlockIndexToRemove, 1);
      }

      const substituteBlock: TheoreticalBlock = {
        id: `block-substitute-${early.day}-${substituteTask.id}-${earlyBlock.id}-${slotPointer}`,
        title: substituteTask.title,
        category: substituteTask.category,
        startMinutes: slotPointer,
        endMinutes: slotPointer + taskDuration,
        isFixed: false,
        isBreak: false,
        isWeeklyTask: false,
        color: getCategoryColor(substituteTask.category),
        taskId: substituteTask.id,
        priority: substituteTask.priority,
        taskType: substituteTask.taskType || 'task',
        dayIndex: early.day,
        sourceTableId: substituteTask.sourceTableId,
        sourceTableName: substituteTask.sourceTableName,
        isSubstitute: true,
        substitutedForTitle: earlyBlock.title,
        substitutedForBlockId: earlyBlock.id,
        isCompleted: false,
      };

      dayBlocks[early.day].push(substituteBlock);
      scheduledTaskMinutesDelta += taskDuration;
      slotPointer += taskDuration;
    }
  }

  return {
    scheduledTaskMinutesDelta,
  };
}
