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
 * 週タスクか日課タスクかを厳密に判定
 * - 日課タスク: period === 'day' または frequency === 'high'
 * - 週タスク: 課題 (assignment)、付随タスク、period === 'week'、または頻度が low / medium / custom
 */
export function isWeeklyTaskItem(task: TaskItem): boolean {
  if (task.period === 'day' || task.frequency === 'high') return false;
  if (task.taskType === 'assignment' || task.isAttachedTask) return true;
  if (task.period === 'week') return true;
  if (
    task.frequency === 'low' ||
    task.frequency === 'medium' ||
    task.frequency === 'custom'
  ) {
    return true;
  }
  return false;
}

/**
 * 所要時間（小・中・大）の自動調整: 空きスロットのサイズに合わせていい感じにフィット
 */
export function getAdjustedDuration(task: TaskItem, availableSlotDuration: number): number {
  // ★ 付随タスク（isAttachedTask）または具体的な所要時間（durationMinutes）が指定されているタスクは、
  //    表データやユーザー設定で指定された分数を厳密に使用（25分に固定・上書きしない）
  if (task.isAttachedTask && task.durationMinutes && task.durationMinutes > 0) {
    return Math.min(task.durationMinutes, availableSlotDuration);
  }
  if (task.durationMinutes && task.durationMinutes > 0 && !task.durationSize) {
    return Math.min(task.durationMinutes, availableSlotDuration);
  }

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

export interface SchedulingRealtimeContext {
  todayIndex?: number; // 0:月〜6:日 (未指定時は実行時のシステム曜日)
  currentMinutes?: number; // 0〜1440 (未指定時は実行時のシステム時刻)
  completedBlockIds?: Set<string>; // ユーザーが手動で完了にしたブロックID（早期完了含む）
  uncompletedBlockIds?: Set<string>; // ユーザーが手動で未完了にしたブロックID（過去自動完了の解除含む）
}

/**
 * 1週間（7日間: 月曜=0 〜 日曜=6）の自律的理論値スケジューリングエンジン
 * Plan11: リアルタイム完了状態判定、未完了週タスクの動的再配置、早期完了枠への代行タスク配置に対応
 */
export function generateTheoreticalSchedule(
  fixedSlots: FixedSlot[],
  tasks: TaskItem[],
  realtimeContext?: SchedulingRealtimeContext,
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

  // リアルタイム基準日時（現在時刻・現在の曜日）
  const now = new Date();
  const todayIdx =
    realtimeContext?.todayIndex !== undefined
      ? realtimeContext.todayIndex
      : (now.getDay() + 6) % 7;
  const currMinutes =
    realtimeContext?.currentMinutes !== undefined
      ? realtimeContext.currentMinutes
      : now.getHours() * 60 + now.getMinutes();

  const userCompletedIds = realtimeContext?.completedBlockIds || new Set<string>();
  const userUncompletedIds = realtimeContext?.uncompletedBlockIds || new Set<string>();

  // 1. 各曜日の固定枠と空き時間スロットを初期化
  const dayAvailableSlots: Record<number, FreeSlot[]> = {};
  const dayNormalizedFixed: Record<number, FixedSlot[]> = {};

  for (let d = 0; d < 7; d++) {
    const slotsForThisDay = getFixedSlotsForDay(fixedSlots, d);
    const normalized = normalizeFixedSlots(slotsForThisDay);
    dayNormalizedFixed[d] = normalized;

    // 固定枠ブロックおよび固定枠直後の休憩ブロックを追加
    const slotsWithBreaks: FixedSlot[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const slot = normalized[i];
      dayBlocks[d].push({
        id: `block-fixed-${d}-${slot.id}`,
        title: slot.title,
        category: slot.category,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        isFixed: true,
        isWeeklyTask: false,
        breakMinutes: slot.breakMinutes,
        color: slot.color || getCategoryColor(slot.category),
        dayIndex: d,
        sourceTableId: slot.sourceTableId,
        sourceTableName: slot.sourceTableName,
      });

      slotsWithBreaks.push(slot);

      // 固定枠に休憩時間が設定されている場合、余白として空き時間から除外（タスクを入れない）
      if (slot.breakMinutes && slot.breakMinutes > 0) {
        const nextSlot = normalized[i + 1];
        const maxBreakEnd = nextSlot
          ? Math.min(slot.endMinutes + slot.breakMinutes, nextSlot.startMinutes)
          : Math.min(slot.endMinutes + slot.breakMinutes, 1440);
        const breakDuration = maxBreakEnd - slot.endMinutes;
        if (breakDuration > 0) {
          // 空き時間スロット計算で休憩時間帯を固定枠扱いで除外（タスクが入らない余白にする）
          slotsWithBreaks.push({
            id: `${slot.id}-break`,
            title: `余白`,
            category: 'routine',
            color: '#10b981',
            startMinutes: slot.endMinutes,
            endMinutes: maxBreakEnd,
          });
        }
      }
    }

    slotsWithBreaks.sort((a, b) => a.startMinutes - b.startMinutes);
    dayAvailableSlots[d] = calculateFreeSlots(slotsWithBreaks);
  }

  // 2. タスクを分類（所要時間なしToDoは時間割に配置しない）
  const schedulableTasks = tasks.filter(
    (t) => !t.hasNoDuration && (t.durationMinutes > 0 || t.durationSize !== undefined),
  );

  // 3. 各タスクの配置計画を策定（ステップ1: 日ブロックへの割り振り）
  interface TaskPlacementPlan {
    task: TaskItem;
    kind: 'assignment' | 'weekly_specific' | 'daily_fixed' | 'weekly_flexible' | 'daily_auto' | 'attached_task';
    isAuto: boolean;
    targetCountPerDay: number;
    targetCountWeekly: number;
    candidateDays: number[];
    placedCount: number;
    placedCountPerDay: Record<number, number>;
    isComplete: boolean;
    isRescheduledPlan?: boolean; // 未完了週タスクの再配置プランかどうか
    rescheduledFromDay?: number; // 再スケジュール元の曜日
    origTaskId?: string; // 元のタスクID
  }

  const plans: TaskPlacementPlan[] = schedulableTasks.map((task) => {
    // 課題タスク（提出物・締切制約）判定（付随タスクは課題扱いしない）
    const isAssignment =
      !task.isAttachedTask && (task.taskType === 'assignment' || task.deadlineDay !== undefined);

    // 回数指定 (custom または dailyCount > 1) か判定
    const isCustomDaily =
      (task.dailyRepeatMode === 'custom' && task.dailyCount !== undefined && task.dailyCount > 0) ||
      (task.dailyRepeatMode !== 'auto' && task.dailyCount !== undefined && task.dailyCount > 1);

    // 分類（日 vs 週）による日の中の繰り返し回数の差別化を撤廃。
    // 課題以外は、分類にかかわらず明示的な回数指定がなければ全タスク等しくデフォルト「自動（auto）」
    const isAuto = !isAssignment && !isCustomDaily;
    const targetCountPerDay = isAssignment
      ? (task.dailyCount || 1)
      : isAuto
        ? Infinity
        : (task.dailyCount || 1);

    // 付随タスク判定（週1回・日の繰り返しなし・同一日優先＆別日フォールバック）
    if (task.isAttachedTask) {
      const preferredDays =
        task.parentEndMinutesByDay && Object.keys(task.parentEndMinutesByDay).length > 0
          ? Object.keys(task.parentEndMinutesByDay).map(Number).sort((a, b) => a - b)
          : (task.targetDays && task.targetDays.length > 0 ? [...task.targetDays].sort((a, b) => a - b) : [0]);

      const primaryDay = preferredDays[0];
      // 第一候補日(primaryDay)からその週の終わり（日曜: 6）までの曜日を候補日とする
      // （※元タスクが行われる前の過去の曜日（木金タスクにとっての月火水など）には絶対に配置しない！）
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

    // 日ブロック（どの曜日の箱に割り振るか）の決定
    // ① 曜日明示指定
    if (task.targetDays && task.targetDays.length > 0) {
      const candidateDays = [...task.targetDays];
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

    // ② 周期明示指定
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

    // ③ 課題タスク（出題日〜締切日の範囲）
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

    // ④ 日課タスク（毎日全曜日に適用）
    const isDaily = task.period === 'day' || task.frequency === 'high';
    if (isDaily) {
      let candidateDays = [0, 1, 2, 3, 4, 5, 6];
      if (task.startDay !== undefined) {
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

    // ⑤ 週次タスク（週N回を空き枠の多い曜日に分散配置）
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
      targetCountPerDay,
      targetCountWeekly: targetDaysCount,
      isAuto,
      placedCount: 0,
      placedCountPerDay: {},
      isComplete: false,
    };
  });

  // ★ Plan11: ユーザーが手動で未完了（「まだ終わってないよ」）にしたタスクを特定し、
  // 過去の枠（今日より前の曜日、または今日の現在時刻より前に終了した枠）かつ「週タスク」のみを、
  // 未来曜日（今日これ以降〜日曜）を候補日とする再配置プラン（最優先枠）として登録
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

        // 1. ブロックID: block-task-${d}-${taskId}-${placedCount} または block-rescheduled-${d}-${taskId}
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

        // ★ 要件1: 週タスク以外は再配置対象外（日課タスクや固定枠は再配置しない）
        if (!isWeeklyTaskItem(matchedTask)) continue;

        // ★ 要件3: 未来の週タスクは未完了でも再配置しない！
        // 過去の枠（今日より前の曜日、または今日の現在時刻より前に終了した枠）のみを再配置対象とする
        if (fromDay > todayIdx) {
          // 未来の曜日の予定はこれから実施すれば良いため、再配置しない
          continue;
        }

        if (fromDay === todayIdx) {
          // 当日の場合、終了時刻が現在時刻以前かチェック
          const taskEndTime =
            (matchedTask.earliestStartTime ?? 0) + (matchedTask.durationMinutes || 30);
          if (taskEndTime > currMinutes) {
            // 今日の未来予定なので再配置しない
            continue;
          }
        }

        if (fromDay === -1) {
          // ブロックIDでなく taskId 単体の場合、過去曜日に対象があるか確認
          const hasPastCandidate =
            matchedTask.startDay !== undefined
              ? matchedTask.startDay < todayIdx
              : (matchedTask.targetDays || []).some((d) => d < todayIdx);
          if (!hasPastCandidate && todayIdx > 0) {
            continue;
          }
        }

        if (processedTaskIds.has(matchedTask.id)) continue;
        processedTaskIds.add(matchedTask.id);

        // 再配置タスククローン
        const rescheduledTask: TaskItem = {
          ...matchedTask,
          id: `${matchedTask.id}-rescheduled`,
          title: matchedTask.title,
          period: 'week',
          frequency: 'custom',
          frequencyCount: 1,
          dailyCount: 1,
          targetDays: futureDays,
          isAttachedTask: false, // 別日配置なので親タスク終了時間制約を解除
          parentEndMinutesByDay: undefined,
          priority: 'high', // 最優先
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

  // ★ 要件2: 空きを見つけるロジックとして、日タスクはいったん除外し、
  // 週タスク（再配置含む）を先に空き枠に配置したうえで、その上から日タスクを再配置する（二段階配置）
  const weeklyPlans = plans.filter(
    (p) => p.isRescheduledPlan || isWeeklyTaskItem(p.task) || p.kind === 'weekly_specific',
  );
  const dailyPlans = plans.filter(
    (p) => !p.isRescheduledPlan && !isWeeklyTaskItem(p.task) && p.kind !== 'weekly_specific',
  );

  // 日ブロックへの展開コンテキスト
  interface DayTaskContext {
    plan: TaskPlacementPlan;
    task: TaskItem;
    kind: string;
    isAuto: boolean;
    targetCount: number;
    placedCountInDay: number;
    isSameDayAsParent?: boolean;
  }

  let scheduledTaskMinutes = 0;

  // 優先順位ソート関数
  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sortDayTaskContexts = (contexts: DayTaskContext[]) => {
    contexts.sort((a, b) => {
      // 未完了週タスクの再配置プラン（isRescheduledPlan）は最優先
      const isRescheduledA = a.plan.isRescheduledPlan;
      const isRescheduledB = b.plan.isRescheduledPlan;
      if (isRescheduledA && !isRescheduledB) return -1;
      if (!isRescheduledA && isRescheduledB) return 1;

      // 親タスクと付随タスクの関係
      const isAParentOfB =
        b.task.isAttachedTask &&
        (b.task.parentTitle === a.task.title ||
          (b.task.parentTitle && a.task.title.startsWith(b.task.parentTitle)));
      const isBParentOfA =
        a.task.isAttachedTask &&
        (a.task.parentTitle === b.task.title ||
          (a.task.parentTitle && b.task.title.startsWith(a.task.parentTitle)));
      if (isBParentOfA) return 1;
      if (isAParentOfB) return -1;

      // 付随タスク（同日優先、別日は下位）
      const isAttachedSameDayA = a.task.isAttachedTask && a.isSameDayAsParent;
      const isAttachedSameDayB = b.task.isAttachedTask && b.isSameDayAsParent;
      if (isAttachedSameDayA && !isAttachedSameDayB) return -1;
      if (!isAttachedSameDayA && isAttachedSameDayB) return 1;

      const isAttachedOtherDayA = a.task.isAttachedTask && !a.isSameDayAsParent;
      const isAttachedOtherDayB = b.task.isAttachedTask && !b.isSameDayAsParent;
      if (isAttachedOtherDayA && !isAttachedOtherDayB) return 1;
      if (!isAttachedOtherDayA && isAttachedOtherDayB) return -1;

      // 課題タスク（提出物・締切制約）
      const isAssignA = a.task.taskType === 'assignment' || a.task.deadlineDay !== undefined;
      const isAssignB = b.task.taskType === 'assignment' || b.task.deadlineDay !== undefined;
      if (isAssignA && !isAssignB) return -1;
      if (!isAssignA && isAssignB) return 1;

      // Must > Want
      const isMustA = a.task.category === 'must';
      const isMustB = b.task.category === 'must';
      if (isMustA && !isMustB) return -1;
      if (!isMustA && isMustB) return 1;

      // 優先度（High > Medium > Low）
      const pDiff = (priorityWeight[b.task.priority] || 1) - (priorityWeight[a.task.priority] || 1);
      if (pDiff !== 0) return pDiff;

      // 回数指定タスク > 自動タスク
      if (!a.isAuto && b.isAuto) return -1;
      if (a.isAuto && !b.isAuto) return 1;

      // 所要時間＋休憩時間（大 ➔ 小）
      const totalA = (a.task.durationMinutes || 0) + (a.task.breakMinutes || 0);
      const totalB = (b.task.durationMinutes || 0) + (b.task.breakMinutes || 0);
      return totalB - totalA;
    });
  };

  // スロット配置の共通処理ヘルパー
  const tryPlaceContextInDay = (
    d: number,
    ctx: DayTaskContext,
    isWeekly: boolean,
  ): boolean => {
    const slots = dayAvailableSlots[d];
    if (!slots || slots.length === 0) return false;

    for (const slot of slots) {
      if (slot.durationMinutes < 15) continue;

      let taskEarliestStartTime = ctx.task.earliestStartTime ?? 0;
      let taskLatestEndTime = ctx.task.latestEndTime ?? 1440;

      if (ctx.task.isAttachedTask) {
        taskLatestEndTime = 1440;
        if (ctx.isSameDayAsParent) {
          let parentEnd = 0;
          if (
            ctx.task.parentEndMinutesByDay &&
            ctx.task.parentEndMinutesByDay[d] !== undefined
          ) {
            parentEnd = ctx.task.parentEndMinutesByDay[d];
          } else if (ctx.task.parentTitle) {
            const parentBlock = dayBlocks[d]
              .filter(
                (b) =>
                  b.title === ctx.task.parentTitle ||
                  (ctx.task.parentTitle && b.title.startsWith(ctx.task.parentTitle)),
              )
              .sort((a, b) => b.endMinutes - a.endMinutes)[0];
            if (parentBlock) {
              parentEnd = parentBlock.endMinutes + (parentBlock.breakMinutes || 0);
            }
          }
          if (parentEnd > 0) {
            taskEarliestStartTime = Math.max(taskEarliestStartTime, parentEnd);
          }
        } else {
          taskEarliestStartTime = 0;
        }
      }

      // 再配置プランかつ今日（d === todayIdx）の場合、現在時刻以降にのみ配置
      if (ctx.plan.isRescheduledPlan && d === todayIdx) {
        taskEarliestStartTime = Math.max(taskEarliestStartTime, currMinutes);
      }

      const effectiveSlotStart = Math.max(slot.startMinutes, taskEarliestStartTime);
      if (effectiveSlotStart >= taskLatestEndTime) continue;

      const requiredMin =
        ctx.task.isAttachedTask && ctx.task.durationMinutes
          ? ctx.task.durationMinutes
          : ctx.task.durationSize === 'small'
            ? 15
            : ctx.task.durationSize === 'medium'
              ? 30
              : ctx.task.durationMinutes || 30;

      const breakMin =
        ctx.task.breakMinutes && ctx.task.breakMinutes > 0 ? ctx.task.breakMinutes : 0;
      const minAcceptable = ctx.isAuto ? Math.min(requiredMin, 15) : requiredMin;

      const maxAllowedEnd = Math.min(slot.endMinutes, taskLatestEndTime);
      const availableDuration = maxAllowedEnd - effectiveSlotStart;
      if (availableDuration < minAcceptable + breakMin) continue;

      const effectiveDuration = ctx.isAuto
        ? Math.min(
            ctx.task.durationMinutes && ctx.task.durationMinutes > 0
              ? ctx.task.durationMinutes
              : 60,
            Math.max(15, availableDuration - breakMin),
          )
        : getAdjustedDuration(ctx.task, availableDuration - breakMin);

      const totalNeeded = effectiveDuration + breakMin;
      if (availableDuration < totalNeeded) continue;

      const taskStart = effectiveSlotStart;
      const taskEnd = taskStart + effectiveDuration;

      // タスク本体ブロックの配置
      dayBlocks[d].push({
        id: ctx.plan.isRescheduledPlan
          ? `block-rescheduled-${d}-${ctx.plan.origTaskId || ctx.task.id}`
          : `block-task-${d}-${ctx.task.id}-${ctx.placedCountInDay}`,
        title: ctx.task.title,
        category: ctx.task.category,
        startMinutes: taskStart,
        endMinutes: taskEnd,
        isFixed: false,
        isBreak: false,
        breakMinutes: breakMin > 0 ? breakMin : undefined,
        color: getCategoryColor(ctx.task.category),
        taskId: ctx.plan.origTaskId || ctx.task.id,
        priority: ctx.task.priority,
        taskType: ctx.task.taskType || 'task',
        deadlineDay: ctx.task.deadlineDay,
        dayIndex: d,
        sourceTableId: ctx.task.sourceTableId,
        sourceTableName: ctx.task.sourceTableName,
        isWeeklyTask: isWeekly,
        isRescheduled: ctx.plan.isRescheduledPlan,
        rescheduledFromDay: ctx.plan.rescheduledFromDay,
      });

      // スロット消費 & 分割
      if (effectiveSlotStart > slot.startMinutes) {
        const consumedEnd = taskEnd + breakMin;
        const remainingAfter = slot.endMinutes - consumedEnd;
        slot.endMinutes = effectiveSlotStart;
        slot.durationMinutes = slot.endMinutes - slot.startMinutes;
        if (remainingAfter >= 15) {
          slots.push({
            startMinutes: consumedEnd,
            endMinutes: consumedEnd + remainingAfter,
            durationMinutes: remainingAfter,
          });
          slots.sort((a, b) => a.startMinutes - b.startMinutes);
        }
      } else {
        slot.startMinutes = taskEnd + breakMin;
        slot.durationMinutes = slot.endMinutes - (taskEnd + breakMin);
      }

      ctx.placedCountInDay++;
      ctx.plan.placedCount++;
      ctx.plan.placedCountPerDay[d] = (ctx.plan.placedCountPerDay[d] || 0) + 1;
      scheduledTaskMinutes += effectiveDuration;

      if (!ctx.isAuto) {
        if (
          ctx.kind === 'assignment' ||
          ctx.kind === 'weekly_flexible' ||
          ctx.kind === 'weekly_specific'
        ) {
          if (ctx.plan.placedCount >= ctx.plan.targetCountWeekly) {
            ctx.plan.isComplete = true;
          }
        } else if (ctx.kind === 'daily_fixed') {
          const allDone = ctx.plan.candidateDays.every(
            (cd) => (ctx.plan.placedCountPerDay[cd] || 0) >= ctx.plan.targetCountPerDay,
          );
          if (allDone) {
            ctx.plan.isComplete = true;
          }
        }
      }

      return true;
    }
    return false;
  };

  // -------------------------------------------------------------------------
  // Phase 1: 週タスクの配置（日タスクはいったん除外し、空き枠全体を使って週タスクを最優先配置）
  // -------------------------------------------------------------------------
  const weeklyDayTaskContexts: Record<number, DayTaskContext[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };

  for (const plan of weeklyPlans) {
    if (plan.kind === 'attached_task') {
      const preferredDays =
        plan.task.parentEndMinutesByDay && Object.keys(plan.task.parentEndMinutesByDay).length > 0
          ? Object.keys(plan.task.parentEndMinutesByDay).map(Number)
          : (plan.task.targetDays && plan.task.targetDays.length > 0
              ? plan.task.targetDays
              : (plan.task.startDay !== undefined ? [plan.task.startDay] : [0]));

      for (const d of plan.candidateDays) {
        const isSameDay = preferredDays.includes(d);
        weeklyDayTaskContexts[d].push({
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: 1,
          placedCountInDay: 0,
          isSameDayAsParent: isSameDay,
        });
      }
    } else if (plan.kind === 'assignment') {
      // 課題タスク: 候補日のうち、空きスロットに収まる日を優先して1日選択
      const bestDay = [...plan.candidateDays].sort((a, b) => {
        const needed = (plan.task.durationMinutes || 30) + (plan.task.breakMinutes || 0);
        const slotsA = dayAvailableSlots[a];
        const slotsB = dayAvailableSlots[b];
        const fitA = slotsA.some((s) => s.durationMinutes >= needed);
        const fitB = slotsB.some((s) => s.durationMinutes >= needed);
        if (fitA && !fitB) return -1;
        if (!fitA && fitB) return 1;
        const freeA = slotsA.reduce((s, slot) => s + slot.durationMinutes, 0);
        const freeB = slotsB.reduce((s, slot) => s + slot.durationMinutes, 0);
        return freeB - freeA;
      })[0];
      if (bestDay !== undefined) {
        weeklyDayTaskContexts[bestDay].push({
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: 1,
          placedCountInDay: 0,
        });
      }
    } else if (plan.kind === 'weekly_flexible') {
      const sortedDays = [...plan.candidateDays].sort((a, b) => {
        const needed = (plan.task.durationMinutes || 30) + (plan.task.breakMinutes || 0);
        const slotsA = dayAvailableSlots[a];
        const slotsB = dayAvailableSlots[b];
        const fitA = slotsA.some((s) => s.durationMinutes >= needed);
        const fitB = slotsB.some((s) => s.durationMinutes >= needed);
        if (fitA && !fitB) return -1;
        if (!fitA && fitB) return 1;
        const freeA = slotsA.reduce((s, slot) => s + slot.durationMinutes, 0);
        const freeB = slotsB.reduce((s, slot) => s + slot.durationMinutes, 0);
        return freeB - freeA;
      });
      const assignedDays = sortedDays.slice(0, plan.targetCountWeekly);
      for (const d of assignedDays) {
        weeklyDayTaskContexts[d].push({
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false, // Phase 1 では基本枠（1日あたり目標回数分）を優先確保
          targetCount: plan.task.dailyCount || 1,
          placedCountInDay: 0,
        });
      }
    } else {
      for (const d of plan.candidateDays) {
        weeklyDayTaskContexts[d].push({
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false, // Phase 1 では基本枠を優先確保
          targetCount: plan.task.dailyCount || 1,
          placedCountInDay: 0,
        });
      }
    }
  }

  for (let d = 0; d < 7; d++) {
    sortDayTaskContexts(weeklyDayTaskContexts[d]);
  }

  // Phase 1 配置ループ（週タスク巡回）
  for (let d = 0; d < 7; d++) {
    const tasksInDay = weeklyDayTaskContexts[d];
    let pass = 0;
    const maxPasses = 20;
    let anyPlacedInDay = true;

    while (anyPlacedInDay && pass < maxPasses) {
      pass++;
      anyPlacedInDay = false;

      const eligibleTasks = tasksInDay.filter((ctx) => {
        if (ctx.plan.kind === 'attached_task' && ctx.plan.placedCount >= 1) return false;
        if (ctx.placedCountInDay >= ctx.targetCount) return false;
        if (ctx.plan.isComplete) return false;
        return ctx.targetCount >= pass;
      });
      if (eligibleTasks.length === 0) break;

      for (const ctx of eligibleTasks) {
        const placed = tryPlaceContextInDay(d, ctx, true);
        if (placed) {
          anyPlacedInDay = true;
        }
      }
    }

    // 各日の最新空きスロット状態を更新
    dayAvailableSlots[d] = dayAvailableSlots[d]
      .filter((s) => s.durationMinutes >= 15)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }

  // Phase 1 フォールバック: 週タスク・課題・付随タスク・再配置プランで未達成のもの
  for (const plan of weeklyPlans) {
    if (plan.isAuto || plan.isComplete) continue;

    for (const d of plan.candidateDays) {
      if (plan.placedCount >= plan.targetCountWeekly) {
        plan.isComplete = true;
        break;
      }
      if ((plan.placedCountPerDay[d] || 0) >= plan.targetCountPerDay) continue;

      const dummyCtx: DayTaskContext = {
        plan,
        task: plan.task,
        kind: plan.kind,
        isAuto: false,
        targetCount: plan.targetCountPerDay,
        placedCountInDay: plan.placedCountPerDay[d] || 0,
        isSameDayAsParent: false,
      };

      const placed = tryPlaceContextInDay(d, dummyCtx, true);
      if (placed) {
        dayAvailableSlots[d] = dayAvailableSlots[d]
          .filter((s) => s.durationMinutes >= 15)
          .sort((a, b) => a.startMinutes - b.startMinutes);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: 日タスクの再配置（週タスクを配置した残りの空き枠に対して配置）
  // -------------------------------------------------------------------------
  const dailyDayTaskContexts: Record<number, DayTaskContext[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };

  for (let d = 0; d < 7; d++) {
    const dayContexts: DayTaskContext[] = [];

    // ① 日課タスク（その曜日に対象日が含まれるもの）
    for (const plan of dailyPlans) {
      if (plan.candidateDays.includes(d)) {
        dayContexts.push({
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: plan.isAuto,
          targetCount: plan.isAuto ? Infinity : plan.targetCountPerDay,
          placedCountInDay: plan.placedCountPerDay[d] || 0,
        });
      }
    }

    // ② その曜日に割り当てられている週タスクで、自動敷き詰め（isAuto: true）のもの
    // （※その曜日に割り当てられていない他曜日の週タスクが漏れ出さないように制限）
    for (const ctx of weeklyDayTaskContexts[d]) {
      if (ctx.plan.isAuto) {
        dayContexts.push({
          plan: ctx.plan,
          task: ctx.task,
          kind: ctx.kind,
          isAuto: true,
          targetCount: Infinity,
          placedCountInDay: ctx.plan.placedCountPerDay[d] || 0,
        });
      }
    }

    sortDayTaskContexts(dayContexts);
    dailyDayTaskContexts[d] = dayContexts;
  }

  // Phase 2 配置ループ（日タスク巡回 & 自動敷き詰め）
  for (let d = 0; d < 7; d++) {
    const tasksInDay = dailyDayTaskContexts[d];
    let pass = 0;
    const maxPasses = 100;
    let anyPlacedInDay = true;

    while (anyPlacedInDay && pass < maxPasses) {
      pass++;
      anyPlacedInDay = false;

      const eligibleTasks = tasksInDay.filter((ctx) => {
        // 週あたりの目標回数（例: 週1回など）が設定されているタスクは、目標達成済みならこれ以上敷き詰めない
        if (
          ctx.plan.targetCountWeekly !== Infinity &&
          ctx.plan.placedCount >= ctx.plan.targetCountWeekly
        ) {
          return false;
        }
        if (!ctx.isAuto && ctx.plan.isComplete) return false;
        if (ctx.placedCountInDay >= ctx.targetCount) return false;
        return ctx.targetCount >= pass;
      });
      if (eligibleTasks.length === 0) break;

      for (const ctx of eligibleTasks) {
        const placed = tryPlaceContextInDay(d, ctx, false);
        if (placed) {
          anyPlacedInDay = true;
        }
      }
    }

    // 最終空きスロット状態を確定
    dayAvailableSlots[d] = dayAvailableSlots[d]
      .filter((s) => s.durationMinutes >= 15)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }

  // =========================================================================
  // Plan11: リアルタイム完了状態判定 ＆ 未完了週タスク動的再配置 ＆ 代行タスク生成
  // =========================================================================

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

      // ★ 週タスクのみ手動トグルを反映。日タスクは自動完了・自動未完了のみ
      if (isWeekly && isExplicitUncompleted) {
        // 過去の枠でもユーザーが「まだ終わってないよ」とトグルしたもの -> 未完了
        block.isCompleted = false;
        block.isUserToggled = true;
      } else if (isWeekly && isExplicitCompleted) {
        // ユーザーが「もう終わった」と早期完了
        block.isCompleted = true;
        block.isUserToggled = true;
        if (!isPast) {
          block.isEarlyCompleted = true;
          earlyCompletedBlocks.push({ day: d, block });
        }
      } else {
        // デフォルト: 過去なら自動完了、未来なら未完了
        if (isPast) {
          block.isCompleted = true;
          block.isAutoCompleted = true;
        } else {
          block.isCompleted = false;
        }
      }
    }
  }

  // 3. 早期完了された枠への代替タスク（重ね合わせ）配置
  for (const early of earlyCompletedBlocks) {
    const earlyBlock = early.block;
    const earlyDuration = earlyBlock.endMinutes - earlyBlock.startMinutes;

    // 代替として割り振る候補タスクを探す
    // ① 目標回数未達のプラン（未完了タスク）
    // ② 未配置がなければ他のタスクを前倒し割り振り
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
      // 未配置がなければ、自分以外のタスクから前倒し・追加割り振り
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
        isSubstitute: true, // 代替タスクフラグ
        substitutedForTitle: earlyBlock.title, // 元のタスク名
        substitutedForBlockId: earlyBlock.id,
        isCompleted: false,
      };

      // 元のブロックと同じ曜日の配列に追加（ソート時に元ブロックの後ろに来る）
      dayBlocks[early.day].push(substituteBlock);
      scheduledTaskMinutes += earlyDuration;
    }
  }

  // 5. 配置実績の集計
  const unassignedTasks: TaskItem[] = [];
  let assignedTaskCount = 0;

  for (const plan of plans) {
    if (plan.placedCount > 0) {
      assignedTaskCount++;
      if (!plan.isAuto && !plan.isComplete) {
        unassignedTasks.push(plan.task);
      }
    } else {
      unassignedTasks.push(plan.task);
    }
  }

  // 4. 各曜日のブロックを時系列順に整頓（元タスクが前、代替タスクが後になるよう安定ソート）
  const allBlocks: TheoreticalBlock[] = [];
  for (let d = 0; d < 7; d++) {
    dayBlocks[d].sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }
      // 同じ開始時刻の場合、代替タスク（isSubstitute）を後に配置（DOM上で前面レイヤーへ）
      if (a.isSubstitute && !b.isSubstitute) return 1;
      if (!a.isSubstitute && b.isSubstitute) return -1;
      return a.endMinutes - b.endMinutes;
    });
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
