import { TaskItem } from '@/types';
import { TaskPlacementPlan, SchedulingRealtimeContext } from './types';
import { getTargetPlacementDays, isWeeklyTaskItem } from './constants';
import { SlotManager } from './slotManager';

export interface PlanGenerationResult {
  schedulableTasks: TaskItem[];
  plans: TaskPlacementPlan[];
  weeklyPlans: TaskPlacementPlan[];
  dailyPlans: TaskPlacementPlan[];
}

export function generatePlacementPlans(
  tasks: TaskItem[],
  slotManager: SlotManager,
  realtimeContext: SchedulingRealtimeContext,
  todayIdx: number,
  currMinutes: number,
): PlanGenerationResult {
  // 1. 所要時間なしToDoは時間割に配置しない
  const schedulableTasks = tasks.filter(
    (t) => !t.hasNoDuration && (t.durationMinutes > 0 || t.durationSize !== undefined),
  );

  // 2. 各タスクの配置計画を策定
  const plans: TaskPlacementPlan[] = schedulableTasks.map((task) => {
    // 課題タスク（提出物・締切制約）判定（付随タスクは課題扱いしない）
    const isAssignment =
      !task.isAttachedTask && (task.taskType === 'assignment' || task.deadlineDay !== undefined);

    // 回数指定 (custom または dailyCount >= 1) か判定
    const isCustomDaily =
      (task.dailyRepeatMode === 'custom' && task.dailyCount !== undefined && task.dailyCount > 0) ||
      (task.dailyRepeatMode !== 'auto' && task.dailyCount !== undefined && task.dailyCount >= 1);

    // 特定曜日指定 (targetDays) や周期指定 (cycleDays) の有無
    const hasSpecificDays =
      (task.targetDays && task.targetDays.length > 0) ||
      (task.cycleDays && task.cycleDays.length > 0) ||
      task.startDay !== undefined;

    // 自動敷き詰め (isAuto) の判定
    const isAuto =
      !isAssignment &&
      !isCustomDaily &&
      (task.dailyRepeatMode === 'auto' || (!hasSpecificDays && task.dailyCount === undefined));

    const targetCountPerDay = isAssignment
      ? (task.dailyCount || 1)
      : isAuto
        ? Infinity
        : (task.dailyCount || 1);

    // ① 課題タスク（出題日〜締切日の範囲）判定（付随タスクは課題扱いしない）
    if (isAssignment) {
      const startD = task.startDay !== undefined ? task.startDay : 0;
      const endD = task.deadlineDay !== undefined ? task.deadlineDay : 6;
      const candidateDays: number[] = [];
      if (startD <= endD) {
        for (let d = startD; d <= endD; d++) candidateDays.push(d);
      } else {
        for (let d = startD; d < 7; d++) candidateDays.push(d);
        for (let d = 0; d <= endD; d++) candidateDays.push(d);
      }

      return {
        task,
        kind: 'assignment',
        candidateDays,
        targetCountPerDay: 1,
        targetCountWeekly: 1,
        isAuto: false,
        placedCount: 0,
        placedCountPerDay: {},
        isComplete: false,
      };
    }

    // ② 付随タスク判定（週1回・日の繰り返しなし・同一日優先＆別日フォールバック）
    if (task.isAttachedTask) {
      const preferredDays =
        task.parentEndMinutesByDay && Object.keys(task.parentEndMinutesByDay).length > 0
          ? Object.keys(task.parentEndMinutesByDay).map(Number).sort((a, b) => a - b)
          : (task.targetDays && task.targetDays.length > 0 ? [...task.targetDays].sort((a, b) => a - b) : [0]);

      const primaryDay = preferredDays[0];
      const candidateDays: number[] = [];
      for (let d = primaryDay; d < 7; d++) {
        candidateDays.push(d);
      }

      return {
        task,
        kind: 'attached_task',
        candidateDays,
        targetCountPerDay: 1,
        targetCountWeekly: 1, // 週1回
        isAuto: false,
        placedCount: 0,
        placedCountPerDay: {},
        isComplete: false,
      };
    }

    // ③ 日課タスク（日タスク: period === 'day'、または period未指定かつ frequency === 'high'）
    // （※ period === 'week' や課題・付随タスクは絶対に日課タスクにしない！）
    const isDaily =
      task.period === 'day' ||
      (!task.period && task.frequency === 'high' && !isWeeklyTaskItem(task));
    if (isDaily) {
      let candidateDays: number[] = [0, 1, 2, 3, 4, 5, 6];

      if (task.targetDays && task.targetDays.length > 0) {
        candidateDays = [...task.targetDays];
      } else if (task.cycleDays && task.cycleDays.length > 0) {
        const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
        candidateDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => task.cycleDays!.includes(d % cycleLength));
      } else if (task.startDay !== undefined) {
        candidateDays = [task.startDay];
      } else if (task.cycleIndex !== undefined) {
        const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
        candidateDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d % cycleLength === (task.cycleIndex! % cycleLength));
      }

      return {
        task,
        kind: isAuto ? 'daily_auto' : 'daily_fixed',
        candidateDays,
        targetCountPerDay,
        targetCountWeekly: isAuto ? Infinity : targetCountPerDay * candidateDays.length,
        isAuto,
        placedCount: 0,
        placedCountPerDay: {},
        isComplete: false,
      };
    }

    // ④ 週次タスク: 周期明示指定 (cycleDays)
    // 周期指定タスク（例: 3日周期の特定日）は、指定された周期日のみに配置し、オフ日には配置しない
    if (task.cycleDays && task.cycleDays.length > 0) {
      const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
      const candidateDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => task.cycleDays!.includes(d % cycleLength));
      return {
        task,
        kind: 'weekly_specific',
        candidateDays,
        targetCountPerDay,
        targetCountWeekly: candidateDays.length,
        isAuto,
        placedCount: 0,
        placedCountPerDay: {},
        isComplete: false,
      };
    }

    // ⑤ 週次タスク（曜日指定または柔軟週タスク）
    // ★ ユーザー指示: 元の表データの曜日の範囲（targetDays）を週タスクの配置制限として採用しない！
    // 週タスクは週の中でやりくりするものなので、全曜日 [0..6] を配置対象とする。
    // targetDays がある場合は「第一希望として優先探索する曜日」として先頭に並べるが、
    // 候補日自体は全曜日を対象とし、空きのある他曜日へ柔軟に配置して枠不足を防止する。
    const targetDaysCount =
      task.frequencyCount ||
      (task.targetDays && task.targetDays.length > 0
        ? task.targetDays.length
        : getTargetPlacementDays(task));

    const allDaysByFree = slotManager.getDaysSortedByFreeTime([0, 1, 2, 3, 4, 5, 6]);

    let candidateDays: number[];
    if (task.targetDays && task.targetDays.length > 0) {
      // 表データ由来等の指定曜日を最優先としつつ、残りの全曜日を候補日として追加
      const preferred = [...task.targetDays];
      const others = allDaysByFree.filter((d) => !preferred.includes(d));
      candidateDays = [...preferred, ...others];
    } else if (task.startDay !== undefined) {
      candidateDays = [task.startDay, ...allDaysByFree.filter((d) => d !== task.startDay)];
    } else if (task.cycleIndex !== undefined) {
      const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
      const cyclePrimary = task.cycleIndex % cycleLength;
      const cycleDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d % cycleLength === cyclePrimary);
      const others = allDaysByFree.filter((d) => !cycleDays.includes(d));
      candidateDays = [...cycleDays, ...others];
    } else {
      candidateDays = allDaysByFree;
    }

    // 指定日時以降オプションが有効な場合、指定曜日より前の曜日を候補日から除外
    const scheduleAfterDay =
      task.scheduleAfterDay ??
      (task.scheduleAfterEnabled ? task.startDay : undefined);
    if (scheduleAfterDay !== undefined) {
      candidateDays = candidateDays.filter((d) => d >= scheduleAfterDay);
    }

    return {
      task,
      kind: 'weekly_flexible',
      candidateDays,
      targetCountPerDay,
      targetCountWeekly: targetDaysCount,
      isAuto,
      placedCount: 0,
      placedCountPerDay: {},
      isComplete: false,
    };
  });

  // 3. Plan11: ユーザーが手動で未完了にした週タスクの未来再配置プラン
  const userUncompletedIds = realtimeContext.uncompletedBlockIds;
  if (userUncompletedIds && userUncompletedIds.size > 0) {
    const futureDays: number[] = [];
    for (let d = todayIdx; d < 7; d++) {
      futureDays.push(d);
    }

    if (futureDays.length > 0) {
      const processedTaskIds = new Set<string>();

      for (const id of userUncompletedIds) {
        let fromDay = -1;
        let matchedTask: TaskItem | undefined;

        const match = id.match(/^block-(?:task|rescheduled)-(\d+)-(.+?)(?:-(\d+))?$/);
        if (match) {
          fromDay = parseInt(match[1], 10);
          const taskIdCandidate = match[2];
          matchedTask = schedulableTasks.find(
            (t) => t.id === taskIdCandidate || id.includes(t.id),
          );
        } else {
          matchedTask = schedulableTasks.find((t) => t.id === id || id.includes(t.id));
        }

        if (!matchedTask) continue;
        if (!isWeeklyTaskItem(matchedTask)) continue;

        // 未来の枠は未完了でも再配置しない（これから実施するため）
        if (fromDay > todayIdx) continue;

        if (fromDay === todayIdx) {
          const taskEndTime =
            (matchedTask.earliestStartTime ?? 0) + (matchedTask.durationMinutes || 30);
          if (taskEndTime > currMinutes) continue;
        }

        if (fromDay === -1) {
          const hasPastCandidate =
            matchedTask.startDay !== undefined
              ? matchedTask.startDay < todayIdx
              : (matchedTask.targetDays || []).some((d) => d < todayIdx);
          if (!hasPastCandidate && todayIdx > 0) continue;
        }

        if (processedTaskIds.has(matchedTask.id)) continue;
        processedTaskIds.add(matchedTask.id);

        const rescheduledTask: TaskItem = {
          ...matchedTask,
          id: `${matchedTask.id}-rescheduled`,
          title: matchedTask.title,
          period: 'week',
          frequency: 'custom',
          frequencyCount: 1,
          dailyCount: 1,
          targetDays: futureDays,
          isAttachedTask: false,
          parentEndMinutesByDay: undefined,
          priority: 'high',
        };

        plans.push({
          task: rescheduledTask,
          kind: 'weekly_flexible',
          candidateDays: futureDays,
          targetCountPerDay: 1,
          targetCountWeekly: 1,
          isAuto: false,
          placedCount: 0,
          placedCountPerDay: {},
          isComplete: false,
          isRescheduledPlan: true,
          rescheduledFromDay: fromDay >= 0 ? fromDay : undefined,
          origTaskId: matchedTask.id,
        });
      }
    }
  }

  // 4. 週タスクと日課タスクの厳密な分離
  const weeklyPlans = plans.filter(
    (p) => p.isRescheduledPlan || isWeeklyTaskItem(p.task),
  );
  const dailyPlans = plans.filter(
    (p) => !p.isRescheduledPlan && !isWeeklyTaskItem(p.task),
  );

  return {
    schedulableTasks,
    plans,
    weeklyPlans,
    dailyPlans,
  };
}
