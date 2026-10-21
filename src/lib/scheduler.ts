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
    // 期間が0分のスロット（00:00〜00:00など）は除外
    if (slot.startMinutes === slot.endMinutes) {
      continue;
    }

    if (slot.startMinutes > slot.endMinutes) {
      // 日跨ぎ固定枠（例: 23:00 -> 07:00）を [23:00-24:00] と [00:00-07:00] に分割
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

  // 3. タスクコンテキスト（TaskContext）の構築
  interface TaskContext {
    task: TaskItem;
    kind: 'assignment' | 'weekly_specific' | 'daily_fixed' | 'weekly_flexible' | 'daily_auto';
    candidateDays: number[];
    targetCountPerDay: number;
    targetCountWeekly: number;
    isAuto: boolean;
    placedCount: number;
    placedCountPerDay: Record<number, number>;
    isComplete: boolean;
  }

  const contexts: TaskContext[] = schedulableTasks.map((task) => {
    const isDaily = task.period === 'day' || task.frequency === 'high';
    // 回数指定 (custom または dailyCount > 1) かどうか判定。指定がなければデフォルト「自動 (auto)」として何巡も敷き詰める
    const isCustomDaily =
      task.dailyRepeatMode === 'custom' ||
      (task.dailyCount !== undefined && task.dailyCount > 1);
    const isAuto = isDaily && !isCustomDaily;

    if (isAuto) {
      let candidateDays: number[];
      if (task.targetDays && task.targetDays.length > 0) {
        candidateDays = task.targetDays;
      } else if (task.cycleDays && task.cycleDays.length > 0) {
        const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
        candidateDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => task.cycleDays!.includes(d % cycleLength));
      } else if (task.startDay !== undefined) {
        candidateDays = [task.startDay];
      } else if (task.cycleIndex !== undefined) {
        const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
        candidateDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d % cycleLength === (task.cycleIndex! % cycleLength));
      } else {
        candidateDays = [0, 1, 2, 3, 4, 5, 6];
      }

      return {
        task,
        kind: 'daily_auto',
        candidateDays,
        targetCountPerDay: Infinity,
        targetCountWeekly: Infinity,
        isAuto: true,
        placedCount: 0,
        placedCountPerDay: {},
        isComplete: false,
      };
    }

    if (isDaily) {
      let candidateDays: number[];
      if (task.targetDays && task.targetDays.length > 0) {
        candidateDays = task.targetDays;
      } else if (task.cycleDays && task.cycleDays.length > 0) {
        const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
        candidateDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => task.cycleDays!.includes(d % cycleLength));
      } else if (task.startDay !== undefined) {
        candidateDays = [task.startDay];
      } else if (task.cycleIndex !== undefined) {
        const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
        candidateDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d % cycleLength === (task.cycleIndex! % cycleLength));
      } else {
        candidateDays = [0, 1, 2, 3, 4, 5, 6];
      }

      const dailyCount = task.dailyCount && task.dailyCount > 0 ? task.dailyCount : 1;
      return {
        task,
        kind: 'daily_fixed',
        candidateDays,
        targetCountPerDay: dailyCount,
        targetCountWeekly: dailyCount * candidateDays.length,
        isAuto: false,
        placedCount: 0,
        placedCountPerDay: {},
        isComplete: false,
      };
    }

    // 週タスク: 課題（assignment）または締切あり
    if (task.taskType === 'assignment' || task.deadlineDay !== undefined) {
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

    // 週タスク: 曜日または周期の明示指定あり
    if ((task.targetDays && task.targetDays.length > 0) || (task.cycleDays && task.cycleDays.length > 0)) {
      let candidateDays: number[];
      if (task.targetDays && task.targetDays.length > 0) {
        candidateDays = [...task.targetDays];
      } else {
        const cycleLength = task.cycleCount && task.cycleCount > 0 ? task.cycleCount : 3;
        candidateDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => task.cycleDays!.includes(d % cycleLength));
      }

      return {
        task,
        kind: 'weekly_specific',
        candidateDays,
        targetCountPerDay: 1,
        targetCountWeekly: candidateDays.length,
        isAuto: false,
        placedCount: 0,
        placedCountPerDay: {},
        isComplete: false,
      };
    }

    // 週タスク: 曜日自由（flexible）
    const targetDaysCount = getTargetPlacementDays(task);
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

    return {
      task,
      kind: 'weekly_flexible',
      candidateDays,
      targetCountPerDay: 1,
      targetCountWeekly: targetDaysCount,
      isAuto: false,
      placedCount: 0,
      placedCountPerDay: {},
      isComplete: false,
    };
  });

  // 優先順位ソート（細かさ優先の絶対原則）
  // 1. Must > Want
  // 2. kind (assignment > weekly_specific > daily_fixed > weekly_flexible > daily_auto)
  // 3. priority (high > medium > low)
  // 4. 所要時間＋休憩時間（大きい順）
  const kindWeight: Record<string, number> = {
    assignment: 5,
    weekly_specific: 4,
    daily_fixed: 3,
    weekly_flexible: 2,
    daily_auto: 1,
  };
  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

  contexts.sort((a, b) => {
    const isMustA = a.task.category === 'must' || a.task.taskType === 'assignment';
    const isMustB = b.task.category === 'must' || b.task.taskType === 'assignment';
    if (isMustA && !isMustB) return -1;
    if (!isMustA && isMustB) return 1;

    const kwDiff = kindWeight[b.kind] - kindWeight[a.kind];
    if (kwDiff !== 0) return kwDiff;

    const pDiff = (priorityWeight[b.task.priority] || 1) - (priorityWeight[a.task.priority] || 1);
    if (pDiff !== 0) return pDiff;

    const totalA = (a.task.durationMinutes || 0) + (a.task.breakMinutes || 0);
    const totalB = (b.task.durationMinutes || 0) + (b.task.breakMinutes || 0);
    return totalB - totalA;
  });

  let scheduledTaskMinutes = 0;

  // 4. ラウンド巡回配置ループ（Pass 1, Pass 2, Pass 3...）
  let pass = 0;
  const maxPasses = 100; // 安全上限
  let anyPlaced = true;

  while (anyPlaced && pass < maxPasses) {
    pass++;
    anyPlaced = false;

    for (const ctx of contexts) {
      if (ctx.isComplete && !ctx.isAuto) continue;

      for (const d of ctx.candidateDays) {
        if (ctx.isComplete && !ctx.isAuto) break;

        const dayPlaced = ctx.placedCountPerDay[d] || 0;
        if (!ctx.isAuto && dayPlaced >= ctx.targetCountPerDay) continue;

        // 週タスクの場合、週目標回数に達していたらこの日はスキップ
        if (
          !ctx.isAuto &&
          (ctx.kind === 'assignment' ||
            ctx.kind === 'weekly_specific' ||
            ctx.kind === 'weekly_flexible')
        ) {
          if (ctx.placedCount >= ctx.targetCountWeekly) {
            ctx.isComplete = true;
            break;
          }
        }

        // 自動タスクが複数ある場合、その日の中での配置回数の公平性を保つ
        // (他の自動タスクの配置回数より多く先行して特定のタスクのみが独占配置されるのを防ぐ)
        if (ctx.isAuto) {
          const autoCtxsInDay = contexts.filter(
            (c) => c.isAuto && c.candidateDays.includes(d),
          );
          if (autoCtxsInDay.length > 1) {
            const minAutoPlaced = Math.min(
              ...autoCtxsInDay.map((c) => c.placedCountPerDay[d] || 0),
            );
            // 最小配置回数よりすでに多く配置されている場合、他の自動タスクが追いつくまでこの日のこの巡ではスキップ
            if (dayPlaced > minAutoPlaced) {
              continue;
            }
          }
        }

        const slots = dayAvailableSlots[d];
        for (const slot of slots) {
          if (slot.durationMinutes < 15) continue;

          const requiredMin =
            ctx.task.durationSize === 'small'
              ? 15
              : ctx.task.durationSize === 'medium'
                ? 30
                : ctx.task.durationMinutes || 30;

          // 休憩時間（分）
          const breakMin =
            ctx.task.breakMinutes && ctx.task.breakMinutes > 0 ? ctx.task.breakMinutes : 0;
          const minAcceptable = ctx.isAuto ? Math.min(requiredMin, 15) : requiredMin;

          if (slot.durationMinutes >= minAcceptable + breakMin) {
            // 自動タスクの場合は空き枠に合わせて柔軟に収める（所要時間より小さくても15分以上あればフィット）
            const effectiveDuration = ctx.isAuto
              ? Math.min(
                  ctx.task.durationMinutes && ctx.task.durationMinutes > 0
                    ? ctx.task.durationMinutes
                    : 60,
                  Math.max(15, slot.durationMinutes - breakMin),
                )
              : getAdjustedDuration(ctx.task, slot.durationMinutes - breakMin);

            const totalNeeded = effectiveDuration + breakMin;

            if (slot.durationMinutes >= totalNeeded) {
              const taskStart = slot.startMinutes;
              const taskEnd = taskStart + effectiveDuration;

              // ① タスク本体ブロックの配置
              dayBlocks[d].push({
                id: `block-task-${d}-${ctx.task.id}-${ctx.placedCount}`,
                title: ctx.task.title,
                category: ctx.task.category,
                startMinutes: taskStart,
                endMinutes: taskEnd,
                isFixed: false,
                isBreak: false,
                color: getCategoryColor(ctx.task.category),
                taskId: ctx.task.id,
                priority: ctx.task.priority,
                taskType: ctx.task.taskType || 'task',
                deadlineDay: ctx.task.deadlineDay,
                dayIndex: d,
                sourceTableId: ctx.task.sourceTableId,
                sourceTableName: ctx.task.sourceTableName,
              });

              // ② 休憩ブロックの配置（休憩時間が設定されている場合）
              if (breakMin > 0) {
                dayBlocks[d].push({
                  id: `block-break-${d}-${ctx.task.id}-${ctx.placedCount}`,
                  title: `☕ 休憩 (${ctx.task.title})`,
                  category: 'routine',
                  startMinutes: taskEnd,
                  endMinutes: taskEnd + breakMin,
                  isFixed: false,
                  isBreak: true,
                  breakForTaskId: ctx.task.id,
                  color: '#10b981',
                  dayIndex: d,
                  sourceTableId: ctx.task.sourceTableId,
                  sourceTableName: ctx.task.sourceTableName,
                });
              }

              // スロット消費
              slot.startMinutes = taskEnd + breakMin;
              slot.durationMinutes = slot.endMinutes - (taskEnd + breakMin);

              ctx.placedCount++;
              ctx.placedCountPerDay[d] = dayPlaced + 1;
              anyPlaced = true;
              scheduledTaskMinutes += effectiveDuration;

              // 目標回数の達成判定
              if (!ctx.isAuto) {
                if (
                  ctx.kind === 'assignment' ||
                  ctx.kind === 'weekly_flexible' ||
                  ctx.kind === 'weekly_specific'
                ) {
                  if (ctx.placedCount >= ctx.targetCountWeekly) {
                    ctx.isComplete = true;
                  }
                } else if (ctx.kind === 'daily_fixed') {
                  const allDone = ctx.candidateDays.every(
                    (cd) => (ctx.placedCountPerDay[cd] || 0) >= ctx.targetCountPerDay,
                  );
                  if (allDone) {
                    ctx.isComplete = true;
                  }
                }
              }

              // 1巡につき1日1回配置できたら次の候補日へ
              break;
            }
          }
        }
      }
    }
  }

  // 5. 配置実績の集計
  const unassignedTasks: TaskItem[] = [];
  let assignedTaskCount = 0;

  for (const ctx of contexts) {
    if (ctx.placedCount > 0) {
      assignedTaskCount++;
      if (!ctx.isAuto && !ctx.isComplete) {
        // 目標回数を満たせなかったタスクは未割り当てリストにも追加
        unassignedTasks.push(ctx.task);
      }
    } else {
      unassignedTasks.push(ctx.task);
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
      ? unassignedTasks.length === 0
        ? 100
        : Math.min(
            100,
            Math.max(
              0,
              Math.round(
                ((totalRequestedTaskMinutes - unassignedTaskMinutes) / totalRequestedTaskMinutes) * 100,
              ),
            ),
          )
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
