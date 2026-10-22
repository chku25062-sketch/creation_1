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
  // 未来曜日（今日これ以降〜日曜）を候補日とする再配置プラン（最優先枠）として登録
  if (userUncompletedIds && userUncompletedIds.size > 0) {
    const futureDays: number[] = [];
    for (let d = todayIdx; d < 7; d++) {
      futureDays.push(d);
    }

    if (futureDays.length > 0) {
      const processedTaskIds = new Set<string>();

      for (const id of userUncompletedIds) {
        // 1. 直接 taskId としてマッチするか
        let matchedTask = schedulableTasks.find((t) => t.id === id);
        let fromDay = 0;

        if (!matchedTask) {
          // 2. ブロックID: block-task-${d}-${taskId}-${placedCount}
          const match = id.match(/^block-task-(\d+)-(.+)-(\d+)$/);
          if (match) {
            fromDay = parseInt(match[1], 10);
            const taskIdCandidate = match[2];
            matchedTask = schedulableTasks.find(
              (t) => t.id === taskIdCandidate || id.includes(t.id),
            );
          } else {
            matchedTask = schedulableTasks.find((t) => id.includes(t.id));
          }
        }

        if (matchedTask && !processedTaskIds.has(matchedTask.id)) {
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
            rescheduledFromDay: fromDay,
            origTaskId: matchedTask.id,
          });
        }
      }
    }
  }

  // 日ブロックへの展開（各曜日の箱に入っているタスク群の構築）
  interface DayTaskContext {
    plan: TaskPlacementPlan;
    task: TaskItem;
    kind: string;
    isAuto: boolean;
    targetCount: number;
    placedCountInDay: number;
    isSameDayAsParent?: boolean;
  }

  const dayTaskContexts: Record<number, DayTaskContext[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };

  for (const plan of plans) {
    if (plan.kind === 'attached_task') {
      const preferredDays =
        plan.task.parentEndMinutesByDay && Object.keys(plan.task.parentEndMinutesByDay).length > 0
          ? Object.keys(plan.task.parentEndMinutesByDay).map(Number)
          : (plan.task.targetDays && plan.task.targetDays.length > 0
              ? plan.task.targetDays
              : (plan.task.startDay !== undefined ? [plan.task.startDay] : [0]));

      for (const d of plan.candidateDays) {
        const isSameDay = preferredDays.includes(d);
        dayTaskContexts[d].push({
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
        dayTaskContexts[bestDay].push({
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: false,
          targetCount: 1,
          placedCountInDay: 0,
        });
      }
    } else if (plan.kind === 'weekly_flexible') {
      // 曜日自由な週タスク: 目標回数分、所要時間が収まりやすい空き時間の多い曜日の箱に入れる
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
        dayTaskContexts[d].push({
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: plan.isAuto, // ★ 分類で差別化せず、タスク自体の設定を引き継ぐ
          targetCount: plan.targetCountPerDay, // ★ auto なら Infinity
          placedCountInDay: 0,
        });
      }
    } else {
      // daily_auto, daily_fixed, weekly_specific は candidateDays 全ての日に入れる
      for (const d of plan.candidateDays) {
        dayTaskContexts[d].push({
          plan,
          task: plan.task,
          kind: plan.kind,
          isAuto: plan.isAuto,
          targetCount: plan.targetCountPerDay,
          placedCountInDay: 0,
        });
      }
    }
  }

  // 優先順位ソート（細かさ優先の絶対原則）
  // 分類（日 vs 週）による差別化を排除し、純粋なタスクプロパティ（課題 > Must > Priority > 回数指定 > 所要時間）で決定
  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

  for (let d = 0; d < 7; d++) {
    dayTaskContexts[d].sort((a, b) => {
      // ★ Plan11: 未完了週タスクの再配置プラン（isRescheduledPlan）は最優先で空き枠へ配置！
      const isRescheduledA = a.plan.isRescheduledPlan;
      const isRescheduledB = b.plan.isRescheduledPlan;
      if (isRescheduledA && !isRescheduledB) return -1;
      if (!isRescheduledA && isRescheduledB) return 1;

      // 親タスクと付随タスクの関係：親タスクは自身の付随タスクより先に配置されるべき
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

      // ⓪ 付随タスク（本タスクと同じ日の付随タスク）は最優先！
      const isAttachedSameDayA = a.task.isAttachedTask && a.isSameDayAsParent;
      const isAttachedSameDayB = b.task.isAttachedTask && b.isSameDayAsParent;
      if (isAttachedSameDayA && !isAttachedSameDayB) return -1;
      if (!isAttachedSameDayA && isAttachedSameDayB) return 1;

      // ★ 付随タスクで「別日に回されたもの（!isSameDayAsParent）」は、
      //    その別日のタスクを優先させるため最下位（末尾）にする！
      const isAttachedOtherDayA = a.task.isAttachedTask && !a.isSameDayAsParent;
      const isAttachedOtherDayB = b.task.isAttachedTask && !b.isSameDayAsParent;
      if (isAttachedOtherDayA && !isAttachedOtherDayB) return 1;
      if (!isAttachedOtherDayA && isAttachedOtherDayB) return -1;

      // ① 課題タスク（提出物・締切制約）は最優先
      const isAssignA = a.task.taskType === 'assignment' || a.task.deadlineDay !== undefined;
      const isAssignB = b.task.taskType === 'assignment' || b.task.deadlineDay !== undefined;
      if (isAssignA && !isAssignB) return -1;
      if (!isAssignA && isAssignB) return 1;

      // ② Must > Want
      const isMustA = a.task.category === 'must';
      const isMustB = b.task.category === 'must';
      if (isMustA && !isMustB) return -1;
      if (!isMustA && isMustB) return 1;

      // ③ 優先度（High > Medium > Low）
      const pDiff = (priorityWeight[b.task.priority] || 1) - (priorityWeight[a.task.priority] || 1);
      if (pDiff !== 0) return pDiff;

      // ④ 回数指定タスク（固定回数） > 自動タスク（auto）
      //    （固定回数は必要回数を確実に確保させるため先行）
      if (!a.isAuto && b.isAuto) return -1;
      if (a.isAuto && !b.isAuto) return 1;

      // ⑤ 所要時間＋休憩時間（大きい順）
      const totalA = (a.task.durationMinutes || 0) + (a.task.breakMinutes || 0);
      const totalB = (b.task.durationMinutes || 0) + (b.task.breakMinutes || 0);
      return totalB - totalA;
    });
  }

  let scheduledTaskMinutes = 0;

  // 4. 各日ごとの巡回配置ループ（ステップ2: 時間ブロックの割り振り）
  // 「1巡目ではその日に割り当てられた1回以上繰り返すタスクを配置して、
  //   2巡目では2回以上繰り返すタスクを配置、、、といった感じです」
  for (let d = 0; d < 7; d++) {
    const tasksInDay = dayTaskContexts[d];
    const slots = dayAvailableSlots[d];

    let pass = 0;
    const maxPasses = 100;
    let anyPlacedInDay = true;

    while (anyPlacedInDay && pass < maxPasses) {
      pass++;
      anyPlacedInDay = false;

      // pass巡目では「その日に割り当てられた pass 回以上繰り返すタスク」を配置対象とする
      const eligibleTasks = tasksInDay.filter((ctx) => {
        // 付随タスクは週1回配置済みなら以降の日・パスでは配置しない
        if (ctx.plan.kind === 'attached_task' && ctx.plan.placedCount >= 1) return false;
        if (ctx.placedCountInDay >= ctx.targetCount) return false;
        return ctx.targetCount >= pass;
      });
      if (eligibleTasks.length === 0) break;

      for (const ctx of eligibleTasks) {
        for (const slot of slots) {
          if (slot.durationMinutes < 15) continue;

          // ★ 指定区間の自動配置（earliestStartTime 〜 latestEndTime）制約
          let taskEarliestStartTime = ctx.task.earliestStartTime ?? 0;
          let taskLatestEndTime = ctx.task.latestEndTime ?? 1440;

          // ★ 付随タスク（isAttachedTask）の開始・終了時刻仕様:
          // 「付随タスクの開始時間は、元タスクの終了時間以降で、終了時間は設定なしでお願いします。別日にずれ込む場合は開始時間はなくて大丈夫です」
          if (ctx.task.isAttachedTask) {
            taskLatestEndTime = 1440; // 終了時間は設定なし（深夜制限なし、24:00まで配置可能）

            if (ctx.isSameDayAsParent) {
              // 同じ日の場合: 元タスクの終了時間以降
              let parentEnd = 0;
              if (ctx.task.parentEndMinutesByDay && ctx.task.parentEndMinutesByDay[d] !== undefined) {
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
              // 別日にずれ込む場合: 開始時間はなくて大丈夫（00:00から配置可能）
              taskEarliestStartTime = 0;
            }
          }

          // ★ 再配置プランかつ今日（d === todayIdx）の場合、現在時刻以降にのみ配置
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

          if (availableDuration >= minAcceptable + breakMin) {
            // 自動タスクの場合は空き枠に合わせて柔軟にフィット（最低15分以上あればフィット）
            const effectiveDuration = ctx.isAuto
              ? Math.min(
                  ctx.task.durationMinutes && ctx.task.durationMinutes > 0
                    ? ctx.task.durationMinutes
                    : 60,
                  Math.max(15, availableDuration - breakMin),
                )
              : getAdjustedDuration(ctx.task, availableDuration - breakMin);

            const totalNeeded = effectiveDuration + breakMin;

            if (availableDuration >= totalNeeded) {
              const taskStart = effectiveSlotStart;
              const taskEnd = taskStart + effectiveDuration;

              // ① タスク本体ブロックの配置（休憩・余白時間はタスク自身の属性として保持）
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
                isRescheduled: ctx.plan.isRescheduledPlan,
                rescheduledFromDay: ctx.plan.rescheduledFromDay,
              });

              // スロット消費:
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
              anyPlacedInDay = true;
              scheduledTaskMinutes += effectiveDuration;

              // 目標回数の達成判定
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

              // この巡（pass）ではこのタスクは1回配置完了。次の対象タスクへ
              break;
            }
          }
        }
      }
    }

    // 各日の最新空きスロット状態を確定（15分以上の有効枠のみを時系列昇順で保持）
    dayAvailableSlots[d] = slots
      .filter((s) => s.durationMinutes >= 15)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }

  // フォールバック: 週タスクや課題タスク・付随タスクで目標未達のものがあれば、空き枠のある他の候補日へ配置
  for (const plan of plans) {
    if (plan.isAuto || plan.isComplete) continue;
    if (
      plan.kind !== 'assignment' &&
      plan.kind !== 'weekly_flexible' &&
      plan.kind !== 'attached_task'
    )
      continue;

    for (const d of plan.candidateDays) {
      if (plan.placedCount >= plan.targetCountWeekly) {
        plan.isComplete = true;
        break;
      }
      if ((plan.placedCountPerDay[d] || 0) >= plan.targetCountPerDay) continue;

      const slots = dayAvailableSlots[d];
      for (const slot of slots) {
        if (slot.durationMinutes < 15) continue;

        let taskEarliestStartTime = plan.task.earliestStartTime ?? 0;
        let taskLatestEndTime = plan.task.latestEndTime ?? 1440;

        if (plan.kind === 'attached_task') {
          // 付随タスクのフォールバック配置（別日にずれ込む場合は開始時間はなくて大丈夫、終了時間も設定なし）
          taskEarliestStartTime = 0;
          taskLatestEndTime = 1440;
        }

        const effectiveSlotStart = Math.max(slot.startMinutes, taskEarliestStartTime);
        if (effectiveSlotStart >= taskLatestEndTime) continue;

        const breakMin =
          plan.task.breakMinutes && plan.task.breakMinutes > 0 ? plan.task.breakMinutes : 0;
        const requiredMin = plan.task.durationMinutes || 30;
        const maxAllowedEnd = Math.min(slot.endMinutes, taskLatestEndTime);
        const availableDuration = maxAllowedEnd - effectiveSlotStart;

        if (availableDuration >= requiredMin + breakMin) {
          const effectiveDuration = getAdjustedDuration(plan.task, availableDuration - breakMin);
          const totalNeeded = effectiveDuration + breakMin;
          if (availableDuration >= totalNeeded) {
            const taskStart = effectiveSlotStart;
            const taskEnd = taskStart + effectiveDuration;

            dayBlocks[d].push({
              id: plan.isRescheduledPlan
                ? `block-rescheduled-${d}-${plan.origTaskId || plan.task.id}`
                : `block-task-${d}-${plan.task.id}-${plan.placedCount}`,
              title: plan.task.title,
              category: plan.task.category,
              startMinutes: taskStart,
              endMinutes: taskEnd,
              isFixed: false,
              isBreak: false,
              breakMinutes: breakMin > 0 ? breakMin : undefined,
              color: getCategoryColor(plan.task.category),
              taskId: plan.origTaskId || plan.task.id,
              priority: plan.task.priority,
              taskType: plan.task.taskType || 'task',
              deadlineDay: plan.task.deadlineDay,
              dayIndex: d,
              sourceTableId: plan.task.sourceTableId,
              sourceTableName: plan.task.sourceTableName,
              isRescheduled: plan.isRescheduledPlan,
              rescheduledFromDay: plan.rescheduledFromDay,
            });

            // スロット消費 & 分割（指定時刻制約でスロット途中から開始する場合に対応）
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

            plan.placedCount++;
            plan.placedCountPerDay[d] = (plan.placedCountPerDay[d] || 0) + 1;
            scheduledTaskMinutes += effectiveDuration;
            if (plan.placedCount >= plan.targetCountWeekly) {
              plan.isComplete = true;
            }
            break;
          }
        }
      }
    }
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
    if (block.isFixed || block.isBreak) return false;
    if (block.taskId) {
      const task = taskById.get(block.taskId);
      if (task) {
        if (task.period === 'day' || task.frequency === 'high') return false; // 日課
        return true; // 週タスク
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

      if (isExplicitUncompleted) {
        // 過去の枠でもユーザーが「まだ終わってないよ」とトグルしたもの -> 未完了
        block.isCompleted = false;
        block.isUserToggled = true;
      } else if (isExplicitCompleted) {
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
    // ② 自動敷き詰めタスク
    let substituteTask: TaskItem | undefined;
    for (const plan of plans) {
      if (plan.task.id === earlyBlock.taskId) continue;
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
      // 未配置がなければ、自動敷き詰めタスクを探す
      const autoPlan = plans.find((p) => p.isAuto);
      if (autoPlan) {
        substituteTask = autoPlan.task;
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
