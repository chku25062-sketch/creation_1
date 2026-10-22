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

  // 2. 早期完了された枠への代替タスク（重ね合わせ）配置
  for (const early of earlyCompletedBlocks) {
    const earlyBlock = early.block;
    const earlyDuration = earlyBlock.endMinutes - earlyBlock.startMinutes;

    let substituteTask: TaskItem | undefined;
    for (const plan of plans) {
      if (
        plan.task.id === earlyBlock.taskId ||
        plan.origTaskId === earlyBlock.taskId ||
        plan.task.title === earlyBlock.title
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

    if (!substituteTask) {
      const otherPlan = plans.find(
        (p) =>
          p.task.id !== earlyBlock.taskId &&
          p.origTaskId !== earlyBlock.taskId &&
          p.task.title !== earlyBlock.title,
      );
      if (otherPlan) {
        substituteTask = otherPlan.task;
      }
    }

    if (substituteTask) {
      const substituteBlock: TheoreticalBlock = {
        id: `block-substitute-${early.day}-${substituteTask.id}-${earlyBlock.id}`,
        title: substituteTask.title,
        category: substituteTask.category,
        startMinutes: earlyBlock.startMinutes,
        endMinutes: earlyBlock.endMinutes,
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
      scheduledTaskMinutesDelta += earlyDuration;
    }
  }

  return {
    scheduledTaskMinutesDelta,
  };
}
