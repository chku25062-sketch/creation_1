import {
  FixedSlot,
  TaskItem,
  TheoreticalBlock,
  FreeSlot,
  ScheduleMetrics,
  CategorySummary,
} from '@/types';

const CATEGORY_COLORS: Record<string, string> = {
  sleep: '#6366f1', // Indigo
  work: '#3b82f6', // Blue
  routine: '#64748b', // Slate
  meal: '#f59e0b', // Amber
  study: '#06b6d4', // Cyan
  workout: '#10b981', // Emerald
  hobby: '#ec4899', // Pink
  creative: '#8b5cf6', // Purple
  other: '#94a3b8',
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#38bdf8';
}

/**
 * 日を跨ぐ固定枠（例: 23:00 - 07:00）を [23:00-24:00] と [00:00-07:00] に分割し、時系列で整頓
 */
export function normalizeFixedSlots(slots: FixedSlot[]): FixedSlot[] {
  const result: FixedSlot[] = [];

  for (const slot of slots) {
    if (slot.startMinutes >= slot.endMinutes) {
      // 23:00 -> 24:00
      result.push({
        ...slot,
        id: `${slot.id}-part1`,
        startMinutes: slot.startMinutes,
        endMinutes: 1440,
      });
      // 00:00 -> 07:00
      if (slot.endMinutes > 0) {
        result.push({
          ...slot,
          id: `${slot.id}-part2`,
          startMinutes: 0,
          endMinutes: slot.endMinutes,
        });
      }
    } else {
      result.push(slot);
    }
  }

  return result.sort((a, b) => a.startMinutes - b.startMinutes);
}

/**
 * 24時間（0〜1440分）から固定枠を除外した「自由時間スロット」を算出
 */
export function calculateFreeSlots(normalizedFixedSlots: FixedSlot[]): FreeSlot[] {
  const freeSlots: FreeSlot[] = [];
  let currentPointer = 0;

  for (const slot of normalizedFixedSlots) {
    if (slot.startMinutes > currentPointer) {
      const duration = slot.startMinutes - currentPointer;
      if (duration > 0) {
        freeSlots.push({
          startMinutes: currentPointer,
          endMinutes: slot.startMinutes,
          durationMinutes: duration,
        });
      }
    }
    currentPointer = Math.max(currentPointer, slot.endMinutes);
  }

  if (currentPointer < 1440) {
    freeSlots.push({
      startMinutes: currentPointer,
      endMinutes: 1440,
      durationMinutes: 1440 - currentPointer,
    });
  }

  return freeSlots;
}

export interface SchedulingResult {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
  metrics: ScheduleMetrics;
  categorySummaries: CategorySummary[];
}

/**
 * 理論値自動スケジューリングのコアエンジン
 */
export function generateTheoreticalSchedule(
  fixedSlots: FixedSlot[],
  tasks: TaskItem[],
): SchedulingResult {
  const normalizedSlots = normalizeFixedSlots(fixedSlots);
  const freeSlots = calculateFreeSlots(normalizedSlots);

  // 1. 固定枠をブロックとして登録
  const blocks: TheoreticalBlock[] = normalizedSlots.map((slot) => ({
    id: `block-fixed-${slot.id}`,
    title: slot.title,
    category: slot.category,
    startMinutes: slot.startMinutes,
    endMinutes: slot.endMinutes,
    isFixed: true,
    color: slot.color || getCategoryColor(slot.category),
  }));

  // 2. タスクを優先度順にソート (High -> Medium -> Low), 同一優先度は所要時間の長い順
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  const sortedTasks = [...tasks].sort((a, b) => {
    const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (diff !== 0) return diff;
    return b.durationMinutes - a.durationMinutes;
  });

  const availableSlots = freeSlots.map((s) => ({ ...s }));
  const unassignedTasks: TaskItem[] = [];
  let assignedTaskCount = 0;
  let scheduledTaskMinutes = 0;

  // 3. 空き時間スロットへの最適配置（ビンパッキング）
  for (const task of sortedTasks) {
    let placed = false;

    for (let i = 0; i < availableSlots.length; i++) {
      const slot = availableSlots[i];
      if (slot.durationMinutes >= task.durationMinutes) {
        // スロットに配置
        const taskStart = slot.startMinutes;
        const taskEnd = taskStart + task.durationMinutes;

        blocks.push({
          id: `block-task-${task.id}`,
          title: task.title,
          category: task.category,
          startMinutes: taskStart,
          endMinutes: taskEnd,
          isFixed: false,
          color: getCategoryColor(task.category),
          taskId: task.id,
          priority: task.priority,
        });

        scheduledTaskMinutes += task.durationMinutes;
        assignedTaskCount++;

        // 残余スロットを更新
        slot.startMinutes = taskEnd;
        slot.durationMinutes = slot.endMinutes - taskEnd;

        placed = true;
        break;
      }
    }

    if (!placed) {
      unassignedTasks.push(task);
    }
  }

  // 4. 時系列順にブロックをソート
  blocks.sort((a, b) => a.startMinutes - b.startMinutes);

  // 5. メトリクス計算
  let sleepMinutes = 0;
  let fixedMinutes = 0;

  for (const slot of normalizedSlots) {
    const duration = slot.endMinutes - slot.startMinutes;
    if (slot.category === 'sleep') {
      sleepMinutes += duration;
    } else {
      fixedMinutes += duration;
    }
  }

  const freeMinutes = 1440 - (sleepMinutes + fixedMinutes);
  const totalRequestedTaskMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const unassignedTaskMinutes = unassignedTasks.reduce((sum, t) => sum + t.durationMinutes, 0);

  // 理論値スコア（タスク要求時間に対する消化率、タスクがない場合は100%）
  const theoreticalScore =
    totalRequestedTaskMinutes > 0
      ? Math.round((scheduledTaskMinutes / totalRequestedTaskMinutes) * 100)
      : 100;

  const metrics: ScheduleMetrics = {
    totalDayMinutes: 1440,
    sleepMinutes,
    fixedMinutes,
    freeMinutes,
    scheduledTaskMinutes,
    unassignedTaskMinutes,
    theoreticalScore,
    assignedTaskCount,
    totalTaskCount: tasks.length,
  };

  // 6. カテゴリ別サマリー（円グラフ用）
  const categoryMap = new Map<string, number>();
  for (const block of blocks) {
    const dur = block.endMinutes - block.startMinutes;
    categoryMap.set(block.category, (categoryMap.get(block.category) || 0) + dur);
  }

  const categoryNameMap: Record<string, string> = {
    sleep: '睡眠',
    work: '仕事・学業',
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
      percentage: Math.round((mins / 1440) * 100),
      color: getCategoryColor(cat),
    }),
  );

  return {
    blocks,
    unassignedTasks,
    metrics,
    categorySummaries,
  };
}
