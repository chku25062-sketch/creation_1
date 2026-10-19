import {
  FixedSlot,
  TaskItem,
  TheoreticalBlock,
  FreeSlot,
  ScheduleMetrics,
  CategorySummary,
  WeeklySchedulingResult,
} from '@/types';

const CATEGORY_COLORS: Record<string, string> = {
  must: '#f59e0b', // Amber (やらなければいけないこと)
  want: '#2563eb', // Royal Blue (やりたいこと)
  sleep: '#6366f1', // Indigo
  work: '#0284c7', // Sky
  lecture: '#0369a1', // Deep Sky (大学講義・授業)
  routine: '#64748b', // Slate
  meal: '#ea580c', // Orange
  study: '#4f46e5', // Indigo
  workout: '#059669', // Emerald
  hobby: '#db2777', // Pink
  creative: '#7c3aed', // Purple
  other: '#64748b',
};

const DYNAMIC_PALETTE = [
  '#0284c7', // Sky
  '#0d9488', // Teal
  '#059669', // Emerald
  '#7c3aed', // Purple
  '#c026d3', // Fuchsia
  '#ea580c', // Orange
  '#4f46e5', // Indigo
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#16a34a', // Green
];

export function getCategoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  if (!category) return '#2563eb';

  // 表名などの任意の文字列に対して、文字列ハッシュで一意のカラーを選択
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash << 5) - hash + category.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DYNAMIC_PALETTE.length;
  return DYNAMIC_PALETTE[index];
}

/**
 * 所要時間（小・中・大）の自動調整: 空きスロットのサイズに合わせていい感じにフィット
 */
export function getAdjustedDuration(task: TaskItem, availableSlotDuration: number): number {
  if (task.durationSize === 'small') {
    // 小: 15〜30分未満。空き枠が15〜30分なら空き枠全体を使い、それ以上なら25分
    if (availableSlotDuration >= 15 && availableSlotDuration < 30) {
      return availableSlotDuration;
    }
    return Math.min(25, availableSlotDuration);
  }
  if (task.durationSize === 'medium') {
    // 中: 30分〜2時間未満。空き枠が30〜60分なら空き枠に合わせ、それ以上なら60分
    if (availableSlotDuration >= 30 && availableSlotDuration < 60) {
      return availableSlotDuration;
    }
    return Math.min(60, availableSlotDuration);
  }
  if (task.durationSize === 'large') {
    // 大: 2時間以上。120分基準
    return 120;
  }
  // 直接指定の場合
  return task.durationMinutes > 0 ? task.durationMinutes : 30;
}

/**
 * 頻度に応じた週あたりの目標配置日数
 */
function getTargetPlacementDays(task: TaskItem): number {
  if (task.period === 'day' || task.frequency === 'high') {
    return 7; // 週5回以上〜毎日
  }
  if (task.frequency === 'medium') {
    return 3; // 週3〜4回
  }
  if (task.frequency === 'low') {
    return 1; // 週1〜2回
  }
  if (task.frequency === 'custom' && task.frequencyCount) {
    return Math.min(7, Math.max(1, task.frequencyCount));
  }
  return 1;
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

/**
 * 特定の曜日に有効な固定枠をフィルタリング
 */
export function getFixedSlotsForDay(fixedSlots: FixedSlot[], dayIndex: number): FixedSlot[] {
  return fixedSlots.filter((slot) => {
    if (!slot.daysOfWeek || slot.daysOfWeek.length === 0) return true;
    return slot.daysOfWeek.includes(dayIndex);
  });
}

/**
 * 1週間（7日間: 月曜=0 〜 日曜=6）の自律的理論値スケジューリングエンジン
 */
export function generateTheoreticalSchedule(
  fixedSlots: FixedSlot[],
  tasks: TaskItem[],
): WeeklySchedulingResult & { blocks: TheoreticalBlock[] } {
  const dayBlocks: Record<number, TheoreticalBlock[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };

  // 1. 各曜日の固定枠と空き時間スロットを初期化
  const dayAvailableSlots: Record<number, FreeSlot[]> = {};
  const dayNormalizedFixed: Record<number, FixedSlot[]> = {};

  for (let d = 0; d < 7; d++) {
    const slotsForThisDay = getFixedSlotsForDay(fixedSlots, d);
    const normalized = normalizeFixedSlots(slotsForThisDay);
    dayNormalizedFixed[d] = normalized;
    dayAvailableSlots[d] = calculateFreeSlots(normalized);

    // 固定枠ブロックを追加
    for (const slot of normalized) {
      dayBlocks[d].push({
        id: `block-fixed-${d}-${slot.id}`,
        title: slot.title,
        category: slot.category,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        isFixed: true,
        color: slot.color || getCategoryColor(slot.category),
        dayIndex: d,
        sourceTableId: slot.sourceTableId,
        sourceTableName: slot.sourceTableName,
      });
    }
  }

  // 2. タスクを分類（所要時間なしToDoは時間割に配置しない）
  const schedulableTasks = tasks.filter(
    (t) => !t.hasNoDuration && (t.durationMinutes > 0 || t.durationSize !== undefined),
  );

  // 優先度ソート: 📌「やらなければいけないこと (Must)」を最優先、次に 🌟「やりたいこと (Want)」
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  const sortedTasks = [...schedulableTasks].sort((a, b) => {
    const isMustA = a.category === 'must' || a.taskType === 'assignment';
    const isMustB = b.category === 'must' || b.taskType === 'assignment';
    if (isMustA && !isMustB) return -1;
    if (!isMustA && isMustB) return 1;

    const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (diff !== 0) return diff;
    return (b.durationMinutes || 0) - (a.durationMinutes || 0);
  });

  const dailyTasks = sortedTasks.filter((t) => t.period === 'day' || t.frequency === 'high');
  const assignmentTasks = sortedTasks.filter(
    (t) =>
      t.period !== 'day' &&
      t.frequency !== 'high' &&
      (t.taskType === 'assignment' || t.deadlineDay !== undefined),
  );
  const generalTasks = sortedTasks.filter(
    (t) =>
      t.period !== 'day' &&
      t.frequency !== 'high' &&
      t.taskType !== 'assignment' &&
      t.deadlineDay === undefined,
  );

  const unassignedTasks: TaskItem[] = [];
  let assignedTaskCount = 0;
  let scheduledTaskMinutes = 0;

  // 3-A. 日次タスク（1日に複数回組み込まれる可能性があるもの）を各曜日の空きスロットに配置
  for (const task of dailyTasks) {
    let placedTotalCount = 0;
    const maxDailyCount = task.dailyCount && task.dailyCount > 0 ? task.dailyCount : 1;

    let targetDays: number[];
    if (task.startDay !== undefined) {
      // 1. 曜日指定の日次タスク: その曜日だけに配置
      targetDays = [task.startDay];
    } else if (task.cycleIndex !== undefined) {
      // 2. 周期的に入れ替える日のタスク (例: Day 1, Day 2, Day 3 のローテーション)
      // 週7日 (0:月 〜 6:日) の中で、d % cycleLength === task.cycleIndex % cycleLength の曜日に配置
      const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
      const primaryMod = task.cycleIndex % cycleLength;
      targetDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d % cycleLength === primaryMod);
    } else {
      // 3. 曜日や周期に関わらず毎日行う日次タスク (1列リスト対応)
      targetDays = [0, 1, 2, 3, 4, 5, 6];
    }

    for (const d of targetDays) {
      let placedToday = 0;
      const slots = dayAvailableSlots[d];

      for (const slot of slots) {
        if (placedToday >= maxDailyCount) break;

        const requiredMin =
          task.durationSize === 'small'
            ? 15
            : task.durationSize === 'medium'
              ? 30
              : task.durationMinutes || 30;
        if (slot.durationMinutes >= requiredMin) {
          const effectiveDuration = getAdjustedDuration(task, slot.durationMinutes);
          const taskStart = slot.startMinutes;
          const taskEnd = taskStart + effectiveDuration;

          dayBlocks[d].push({
            id: `block-task-${d}-${task.id}-${placedToday}`,
            title: task.title,
            category: task.category,
            startMinutes: taskStart,
            endMinutes: taskEnd,
            isFixed: false,
            color: getCategoryColor(task.category),
            taskId: task.id,
            priority: task.priority,
            taskType: task.taskType || 'task',
            dayIndex: d,
            sourceTableId: task.sourceTableId,
            sourceTableName: task.sourceTableName,
          });

          slot.startMinutes = taskEnd;
          slot.durationMinutes = slot.endMinutes - taskEnd;
          placedToday++;
          placedTotalCount++;
        }
      }
    }

    if (placedTotalCount > 0) {
      assignedTaskCount++;
      scheduledTaskMinutes += task.durationMinutes || 30;
    } else {
      unassignedTasks.push(task);
    }
  }

  // 3-B. 課題タスク（assignment: 出題曜日 startDay 〜 締切曜日 deadlineDay）を最適配置
  for (const task of assignmentTasks) {
    const startD = task.startDay !== undefined ? task.startDay : 0;
    const endD = task.deadlineDay !== undefined ? task.deadlineDay : 6;

    const candidateDays: number[] = [];
    if (startD <= endD) {
      for (let d = startD; d <= endD; d++) candidateDays.push(d);
    } else {
      for (let d = startD; d < 7; d++) candidateDays.push(d);
      for (let d = 0; d <= endD; d++) candidateDays.push(d);
    }

    let placed = false;
    for (const d of candidateDays) {
      const slots = dayAvailableSlots[d];
      for (const slot of slots) {
        const requiredMin =
          task.durationSize === 'small'
            ? 15
            : task.durationSize === 'medium'
              ? 30
              : task.durationMinutes || 60;
        if (slot.durationMinutes >= requiredMin) {
          const effectiveDuration = getAdjustedDuration(task, slot.durationMinutes);
          const taskStart = slot.startMinutes;
          const taskEnd = taskStart + effectiveDuration;

          dayBlocks[d].push({
            id: `block-assign-${d}-${task.id}`,
            title: task.title,
            category: task.category,
            startMinutes: taskStart,
            endMinutes: taskEnd,
            isFixed: false,
            color: getCategoryColor(task.category),
            taskId: task.id,
            priority: task.priority,
            taskType: 'assignment',
            deadlineDay: task.deadlineDay,
            dayIndex: d,
            sourceTableId: task.sourceTableId,
            sourceTableName: task.sourceTableName,
          });

          slot.startMinutes = taskEnd;
          slot.durationMinutes = slot.endMinutes - taskEnd;
          placed = true;
          assignedTaskCount++;
          scheduledTaskMinutes += effectiveDuration;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      unassignedTasks.push(task);
    }
  }

  // 3-C. 一般タスク（頻度: 低/中/カスタムに応じて適切な日数分、空き時間の多い曜日に分散配置）
  for (const task of generalTasks) {
    const targetDays = getTargetPlacementDays(task);
    let placedDaysCount = 0;

    // 7日間の探索順序: cycleIndex (3日周期) または startDay を考慮
    let candidateDays = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => {
      const freeA = dayAvailableSlots[a].reduce((s, slot) => s + slot.durationMinutes, 0);
      const freeB = dayAvailableSlots[b].reduce((s, slot) => s + slot.durationMinutes, 0);
      return freeB - freeA;
    });

    if (task.startDay !== undefined) {
      candidateDays = [task.startDay, ...candidateDays.filter((d) => d !== task.startDay)];
    } else if (task.cycleIndex !== undefined) {
      const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
      const cyclePrimary = task.cycleIndex % cycleLength;
      const cycleDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d % cycleLength === cyclePrimary);
      const otherDays = candidateDays.filter((d) => !cycleDays.includes(d));
      candidateDays = [...cycleDays, ...otherDays];
    }

    for (const d of candidateDays) {
      if (placedDaysCount >= targetDays) break;

      const slots = dayAvailableSlots[d];
      for (const slot of slots) {
        const requiredMin =
          task.durationSize === 'small'
            ? 15
            : task.durationSize === 'medium'
              ? 30
              : task.durationMinutes || 30;
        if (slot.durationMinutes >= requiredMin) {
          const effectiveDuration = getAdjustedDuration(task, slot.durationMinutes);
          const taskStart = slot.startMinutes;
          const taskEnd = taskStart + effectiveDuration;

          dayBlocks[d].push({
            id: `block-gen-${d}-${task.id}`,
            title: task.title,
            category: task.category,
            startMinutes: taskStart,
            endMinutes: taskEnd,
            isFixed: false,
            color: getCategoryColor(task.category),
            taskId: task.id,
            priority: task.priority,
            taskType: 'task',
            dayIndex: d,
            sourceTableId: task.sourceTableId,
            sourceTableName: task.sourceTableName,
          });

          slot.startMinutes = taskEnd;
          slot.durationMinutes = slot.endMinutes - taskEnd;
          placedDaysCount++;
          scheduledTaskMinutes += effectiveDuration;
          break;
        }
      }
    }

    if (placedDaysCount > 0) {
      assignedTaskCount++;
    } else {
      unassignedTasks.push(task);
    }
  }

  // 4. 各曜日のブロックを時系列順に整頓
  const allBlocks: TheoreticalBlock[] = [];
  for (let d = 0; d < 7; d++) {
    dayBlocks[d].sort((a, b) => a.startMinutes - b.startMinutes);
    allBlocks.push(...dayBlocks[d]);
  }

  // 5. メトリクス計算（月曜を基準日、全体を代表）
  const totalRequestedTaskMinutes = schedulableTasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const unassignedTaskMinutes = unassignedTasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const theoreticalScore =
    totalRequestedTaskMinutes > 0
      ? Math.round((scheduledTaskMinutes / totalRequestedTaskMinutes) * 100)
      : 100;

  const mondayNormalized = dayNormalizedFixed[0];
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

  // 6. カテゴリ別サマリー
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
    dayBlocks,
    allBlocks,
    blocks: dayBlocks[0], // 0(月曜)のブロックをデフォルト互換用として保持
    unassignedTasks,
    metrics,
    categorySummaries,
  };
}
