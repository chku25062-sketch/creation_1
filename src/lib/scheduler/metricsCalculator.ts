import { TaskItem, TheoreticalBlock, ScheduleMetrics, CategorySummary } from '@/types';
import { TaskPlacementPlan } from './types';
import { getCategoryColor } from './constants';
import { SlotManager } from './slotManager';

export interface MetricsCalculationResult {
  unassignedTasks: TaskItem[];
  allBlocks: TheoreticalBlock[];
  metrics: ScheduleMetrics;
  categorySummaries: CategorySummary[];
}

export function calculateScheduleMetrics(
  schedulableTasks: TaskItem[],
  plans: TaskPlacementPlan[],
  dayBlocks: Record<number, TheoreticalBlock[]>,
  slotManager: SlotManager,
  scheduledTaskMinutes: number,
): MetricsCalculationResult {
  // 1. 未配置タスクの集計
  const unassignedTasks: TaskItem[] = [];
  const seenUnassignedTaskIds = new Set<string>();
  let assignedTaskCount = 0;

  for (const plan of plans) {
    if (plan.isRescheduledPlan) {
      if (plan.placedCount === 0 && plan.origTaskId) {
        const orig = schedulableTasks.find((t) => t.id === plan.origTaskId);
        if (orig && !seenUnassignedTaskIds.has(orig.id)) {
          seenUnassignedTaskIds.add(orig.id);
          unassignedTasks.push(orig);
        }
      }
      continue;
    }

    if (plan.placedCount > 0) {
      assignedTaskCount++;
    } else {
      if (!seenUnassignedTaskIds.has(plan.task.id)) {
        seenUnassignedTaskIds.add(plan.task.id);
        unassignedTasks.push(plan.task);
      }
    }
  }

  // 2. 各曜日のブロックを時系列順に整頓（新タスク/代行タスクが奥(前)、手前に透明度を上げた完了タスクが後になるようソート）
  const allBlocks: TheoreticalBlock[] = [];
  for (let d = 0; d < 7; d++) {
    dayBlocks[d].sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }
      // 新タスク（代行タスク）を奥（先）、完了タスクを手前（後）に配置
      if (a.isSubstitute && !b.isSubstitute) return -1;
      if (!a.isSubstitute && b.isSubstitute) return 1;
      if (!a.isEarlyCompleted && b.isEarlyCompleted) return -1;
      if (a.isEarlyCompleted && !b.isEarlyCompleted) return 1;
      return a.endMinutes - b.endMinutes;
    });
    allBlocks.push(...dayBlocks[d]);
  }

  // 3. メトリクス計算
  const totalRequestedTaskMinutes = schedulableTasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const unassignedTaskMinutes = unassignedTasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const theoreticalScore =
    totalRequestedTaskMinutes > 0
      ? unassignedTasks.length === 0
        ? 100
        : Math.min(
            100,
            Math.max(
              0,
              Math.round(
                ((totalRequestedTaskMinutes - unassignedTaskMinutes) / totalRequestedTaskMinutes) *
                  100,
              ),
            ),
          )
      : 100;

  const mondayNormalized = slotManager.getNormalizedFixed(0);
  let sleepMinutes = 0;
  let fixedMinutes = 0;
  for (const slot of mondayNormalized) {
    const duration = slot.endMinutes - slot.startMinutes;
    if (slot.category === 'sleep') sleepMinutes += duration;
    else fixedMinutes += duration;
  }
  const freeMinutes = 1440 - (sleepMinutes + fixedMinutes);

  const metrics: ScheduleMetrics = {
    totalDayMinutes: 1440,
    sleepMinutes,
    fixedMinutes,
    freeMinutes,
    scheduledTaskMinutes,
    unassignedTaskMinutes,
    theoreticalScore,
    assignedTaskCount,
    totalTaskCount: schedulableTasks.length,
  };

  // 4. カテゴリ別サマリー
  const categoryMap = new Map<string, number>();
  for (const block of allBlocks) {
    const dur = block.endMinutes - block.startMinutes;
    categoryMap.set(block.category, (categoryMap.get(block.category) || 0) + dur);
  }

  const categoryNameMap: Record<string, string> = {
    must: 'やらなければいけないこと',
    want: 'やりたいこと',
    sleep: '睡眠',
    work: '仕事・学業',
    lecture: '大学講義・授業',
    routine: '日課・身支度',
    meal: '食事・休憩',
    study: '学習・インプット',
    workout: '運動・フィットネス',
    hobby: '趣味・余暇',
    creative: '創作・副業',
    other: 'その他',
  };

  const categorySummaries: CategorySummary[] = Array.from(categoryMap.entries()).map(
    ([cat, mins]) => ({
      name: categoryNameMap[cat] || cat,
      category: cat,
      minutes: mins,
      percentage: Math.round((mins / (1440 * 7)) * 100),
      color: getCategoryColor(cat),
    }),
  );

  return {
    unassignedTasks,
    allBlocks,
    metrics,
    categorySummaries,
  };
}
