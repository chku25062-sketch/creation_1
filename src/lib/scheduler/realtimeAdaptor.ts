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
  const { dayBlocks, plans, tasks, todayIdx, currMinutes, userCompletedIds, userUncompletedIds } =
    params;

  const calcTotalTaskMinutes = (): number => {
    let sum = 0;
    for (let d = 0; d < 7; d++) {
      for (const b of dayBlocks[d] || []) {
        if (!b.isFixed && !b.isBreak && !b.isEarlyCompleted) {
          sum += b.endMinutes - b.startMinutes;
        }
      }
    }
    return sum;
  };

  const initialTaskMinutes = calcTotalTaskMinutes();

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

  // 自動敷き詰め日課タスク（daily_auto）の判定マップ
  const autoTaskIds = new Set<string>();
  const autoPlans: TaskPlacementPlan[] = [];
  for (const p of plans) {
    if (p.isAuto) {
      autoTaskIds.add(p.task.id);
      if (p.origTaskId) autoTaskIds.add(p.origTaskId);
      autoPlans.push(p);
    }
  }

  const isAutoBlock = (block: TheoreticalBlock): boolean => {
    if (block.isFixed || block.isBreak || block.isWeeklyTask || block.isRescheduled) return false;
    if (block.taskId && autoTaskIds.has(block.taskId)) return true;
    const t = block.taskId ? taskById.get(block.taskId) : undefined;
    return t?.dailyRepeatMode === 'auto';
  };

  const isExplicitlyUncompleted = (block: TheoreticalBlock): boolean => {
    if (userUncompletedIds.has(block.id)) return true;
    if (!block.isRescheduled && !block.isFixed && block.taskId) {
      if (userUncompletedIds.has(block.taskId)) return true;
    }
    return false;
  };

  const isExplicitlyCompleted = (block: TheoreticalBlock): boolean => {
    if (userCompletedIds.has(block.id)) return true;
    if (!block.isRescheduled && !block.isFixed && block.taskId) {
      if (userCompletedIds.has(block.taskId)) return true;
    }
    return false;
  };

  const getTaskRawDuration = (task: TaskItem): number => {
    if (task.durationMinutes && task.durationMinutes > 0) return task.durationMinutes;
    if (task.durationSize === 'small') return 25;
    if (task.durationSize === 'medium') return 45;
    if (task.durationSize === 'large') return 120;
    return 30;
  };

  // 1. 各曜日の全ブロックについて基本の完了・未完了状態を判定
  // （※早期完了 isEarlyCompleted については Step 2 で時系列ウェーブ順に処理し、連鎖完了・代行タスク完了にも完全対応）
  for (let d = 0; d < 7; d++) {
    for (const block of dayBlocks[d]) {
      const isPast = isTimePast(d, block.endMinutes);
      const isToggleable = !block.isBreak;

      if (isToggleable && isExplicitlyUncompleted(block)) {
        block.isCompleted = false;
        block.isUserToggled = true;
      } else if (isToggleable && isExplicitlyCompleted(block)) {
        if (isPast) {
          block.isCompleted = true;
          block.isUserToggled = true;
        } else {
          // 未来または進行中の手動完了は Step 2 のウェーブ処理で順番に早期完了＆再配置する
          block.isCompleted = false;
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

  // 2. 早期完了された日におけるタイムライン全体の統合再配置（ウェーブ方式で連鎖完了・代行完了・隙間ゼロ再配置を実現）
  const completedOrderMap = new Map<string, number>();
  let orderIdx = 0;
  for (const cid of userCompletedIds) {
    completedOrderMap.set(cid, orderIdx++);
  }
  const getCompletedOrder = (b: TheoreticalBlock): number => {
    if (completedOrderMap.has(b.id)) return completedOrderMap.get(b.id)!;
    if (b.taskId && completedOrderMap.has(b.taskId)) return completedOrderMap.get(b.taskId)!;
    return Number.MAX_SAFE_INTEGER;
  };

  for (let d = 0; d < 7; d++) {
    const processedEarlyIds = new Set<string>();
    const dayEarlyBlocks: TheoreticalBlock[] = [];
    let wave = 0;
    const maxWaves = 30;

    while (wave < maxWaves) {
      wave++;
      const blocksInDay = dayBlocks[d] || [];

      // この日でまだ早期完了処理されていない手動完了ブロックを、ユーザーの完了操作順（同順なら開始時刻順）で1件取得
      const nextEarlyBlock = blocksInDay
        .filter((b) => {
          if (b.isBreak || b.isEarlyCompleted || processedEarlyIds.has(b.id)) return false;
          if (isTimePast(d, b.endMinutes)) return false;
          return isExplicitlyCompleted(b);
        })
        .sort(
          (a, b) => getCompletedOrder(a) - getCompletedOrder(b) || a.startMinutes - b.startMinutes,
        )[0];

      if (!nextEarlyBlock) break;

      processedEarlyIds.add(nextEarlyBlock.id);
      nextEarlyBlock.isCompleted = true;
      nextEarlyBlock.isUserToggled = true;
      nextEarlyBlock.isEarlyCompleted = true;
      dayEarlyBlocks.push(nextEarlyBlock);

      // 今回の早期完了枠における再配置開始基準時刻（当日の場合は現在時刻 currMinutes を下回らない）
      // ただし枠開始から現在時刻までの経過が15分未満の端数の場合は、15分未満の空白スリバーを防ぐため枠開始時刻から配置する
      const rawWaveStart =
        d === todayIdx
          ? Math.max(nextEarlyBlock.startMinutes, currMinutes)
          : nextEarlyBlock.startMinutes;
      const waveStart =
        d === todayIdx &&
        currMinutes > nextEarlyBlock.startMinutes &&
        currMinutes - nextEarlyBlock.startMinutes < 15
          ? nextEarlyBlock.startMinutes
          : rawWaveStart;

      // ① 早期完了されたブロック群（グレーアウト表示としてその位置に保持、再配置の障害物にはしない）
      const earlyCompletedAnchors = blocksInDay.filter((b) => b.isEarlyCompleted);

      // ② 動かさない障害物錨: 未完了の固定枠（睡眠・未完了講義・休憩等）、過去完了枠、および waveStart より前に開始するブロック
      const obstacleAnchors = blocksInDay
        .filter(
          (b) => !b.isEarlyCompleted && (b.isFixed || b.isCompleted || b.startMinutes < waveStart),
        )
        .sort((a, b) => a.startMinutes - b.startMinutes);

      // ③ 再配置対象の非自動タスク（週タスク・再配置タスク・付随タスク・回数指定日タスク）
      // ※自動敷き詰め日課タスク（isAutoBlock）は後続の Pass 3 で空きスロット全体に隙間なく再敷き詰めする
      const movableNonAutoBlocks = blocksInDay
        .filter(
          (b) =>
            !b.isEarlyCompleted &&
            !b.isFixed &&
            !b.isCompleted &&
            b.startMinutes >= waveStart &&
            !isAutoBlock(b),
        )
        .sort((a, b) => a.startMinutes - b.startMinutes);

      // waveStart の直前に 15分未満の端数空き（元の講義枠の手前で15分未満のため未配置だった5〜10分隙間等）がある場合、
      // 早期完了によって講義枠が開放された際にその端数隙間が残らないよう freeSlots の開始位置に吸収する
      let freeSlotStart = waveStart;
      const prevObstacles = obstacleAnchors.filter(
        (b) => b.endMinutes + (b.breakMinutes || 0) <= waveStart,
      );
      const lastPrevObsEnd =
        prevObstacles.length > 0
          ? Math.max(...prevObstacles.map((b) => b.endMinutes + (b.breakMinutes || 0)))
          : 0;
      if (
        lastPrevObsEnd > 0 &&
        lastPrevObsEnd < waveStart &&
        waveStart - lastPrevObsEnd < 15 &&
        (d !== todayIdx || lastPrevObsEnd >= currMinutes) &&
        !earlyCompletedAnchors.some(
          (eb) =>
            Math.max(lastPrevObsEnd, eb.startMinutes) <
            Math.min(waveStart, eb.endMinutes + (eb.breakMinutes || 0)),
        )
      ) {
        freeSlotStart = lastPrevObsEnd;
      }

      // freeSlotStart 〜 24:00（1440分）までの連続空きスロットを障害物錨から算出
      let freeSlots: { startMinutes: number; endMinutes: number }[] = [
        { startMinutes: freeSlotStart, endMinutes: 1440 },
      ];

      const consumeIntervalFromFreeSlots = (usedStart: number, usedEnd: number) => {
        if (usedEnd <= usedStart) return;
        const nextSlots: { startMinutes: number; endMinutes: number }[] = [];
        for (const s of freeSlots) {
          if (usedEnd <= s.startMinutes || usedStart >= s.endMinutes) {
            nextSlots.push(s);
          } else {
            if (usedStart > s.startMinutes) {
              nextSlots.push({ startMinutes: s.startMinutes, endMinutes: usedStart });
            }
            if (usedEnd < s.endMinutes) {
              nextSlots.push({ startMinutes: usedEnd, endMinutes: s.endMinutes });
            }
          }
        }
        freeSlots = nextSlots.filter((s) => s.endMinutes - s.startMinutes > 0);
      };

      for (const obs of obstacleAnchors) {
        consumeIntervalFromFreeSlots(obs.startMinutes, obs.endMinutes + (obs.breakMinutes || 0));
      }

      const recompactedBlocks: TheoreticalBlock[] = [];

      // ブロック配置時に早期完了枠と重なっていれば代行メタデータを付与するヘルパー
      const findOverlappedEarlyBlock = (
        startMin: number,
        endMin: number,
      ): TheoreticalBlock | undefined => {
        for (let i = dayEarlyBlocks.length - 1; i >= 0; i--) {
          const eb = dayEarlyBlocks[i];
          if (
            Math.max(startMin, eb.startMinutes) <
            Math.min(endMin, eb.endMinutes + (eb.breakMinutes || 0))
          ) {
            return eb;
          }
        }
        return undefined;
      };

      // Pass 1: その日の非自動タスク（週タスク・再配置タスク・回数指定日タスク）を本来の所要時間を維持して上から再配置
      for (const block of movableNonAutoBlocks) {
        const blockDur = block.endMinutes - block.startMinutes;
        const task = block.taskId ? taskById.get(block.taskId) : undefined;
        const breakMin =
          block.breakMinutes !== undefined
            ? block.breakMinutes
            : task?.breakMinutes && task.breakMinutes > 0
              ? task.breakMinutes
              : 0;

        // 付随タスクで親の固定講義がまだ未完了（obstacleAnchors に残っている）場合は、親講義終了後以降にのみ配置
        let minStart = freeSlotStart;
        if (task?.isAttachedTask && task.parentTitle) {
          const activeParent = obstacleAnchors
            .filter(
              (a) =>
                a.isFixed &&
                (a.title === task.parentTitle || a.title.startsWith(task.parentTitle!)),
            )
            .sort((a, b) => b.endMinutes - a.endMinutes)[0];
          if (activeParent) {
            minStart = Math.max(
              minStart,
              activeParent.endMinutes + (activeParent.breakMinutes || 0),
            );
          }
        }

        let placed = false;
        for (const slot of freeSlots) {
          const effectiveStart = Math.max(slot.startMinutes, minStart);
          const avail = slot.endMinutes - effectiveStart;
          if (avail >= blockDur) {
            const placedStart = effectiveStart;
            const placedEnd = placedStart + blockDur;
            const effectiveBreak = Math.max(0, Math.min(breakMin, avail - blockDur));
            const overlappedEarly =
              findOverlappedEarlyBlock(placedStart, placedEnd) ||
              (placedStart < nextEarlyBlock.endMinutes ? nextEarlyBlock : undefined);

            recompactedBlocks.push({
              ...block,
              startMinutes: placedStart,
              endMinutes: placedEnd,
              breakMinutes: effectiveBreak > 0 ? effectiveBreak : undefined,
              isSubstitute: overlappedEarly ? true : block.isSubstitute,
              substitutedForTitle: overlappedEarly
                ? overlappedEarly.title
                : block.substitutedForTitle,
              substitutedForBlockId: overlappedEarly
                ? overlappedEarly.id
                : block.substitutedForBlockId,
            });

            consumeIntervalFromFreeSlots(placedStart, placedEnd + effectiveBreak);
            placed = true;
            break;
          }
        }

        if (!placed) {
          recompactedBlocks.push(block);
          consumeIntervalFromFreeSlots(
            block.startMinutes,
            block.endMinutes + (block.breakMinutes || 0),
          );
        }
      }

      // Pass 2: 今週まだ未配置の非自動プラン（!plan.isComplete && !plan.isAuto）がある場合、開いた空きスロットに配置
      const usedTaskIdsOnDay = new Set<string>();
      for (const b of [...earlyCompletedAnchors, ...obstacleAnchors, ...recompactedBlocks]) {
        if (b.taskId) usedTaskIdsOnDay.add(b.taskId);
      }

      const incompletePlans = [
        ...plans.filter((p) => !p.isComplete && !p.isAuto && p.candidateDays.includes(d)),
        ...plans.filter((p) => !p.isComplete && !p.isAuto && !p.candidateDays.includes(d)),
      ];

      for (const plan of incompletePlans) {
        if (plan.isComplete) continue;
        const taskId = plan.origTaskId || plan.task.id;
        if (usedTaskIdsOnDay.has(taskId) || usedTaskIdsOnDay.has(plan.task.id)) continue;

        const rawDuration = getTaskRawDuration(plan.task);
        const breakMin =
          plan.task.breakMinutes && plan.task.breakMinutes > 0 ? plan.task.breakMinutes : 0;

        for (const slot of freeSlots) {
          const avail = slot.endMinutes - slot.startMinutes;
          if (avail >= rawDuration) {
            const placedStart = slot.startMinutes;
            const placedEnd = placedStart + rawDuration;
            const effectiveBreak = Math.max(0, Math.min(breakMin, avail - rawDuration));
            const overlappedEarly =
              findOverlappedEarlyBlock(placedStart, placedEnd) || nextEarlyBlock;
            const isWeekly = isWeeklyTaskItem(plan.task);

            recompactedBlocks.push({
              id: plan.isRescheduledPlan
                ? `block-rescheduled-${d}-${taskId}`
                : `block-substitute-${d}-${taskId}-${overlappedEarly.id}-${placedStart}`,
              title: plan.task.title,
              category: plan.task.category,
              startMinutes: placedStart,
              endMinutes: placedEnd,
              isFixed: false,
              isBreak: false,
              breakMinutes: effectiveBreak > 0 ? effectiveBreak : undefined,
              isWeeklyTask: isWeekly,
              isRescheduled: plan.isRescheduledPlan,
              rescheduledFromDay: plan.rescheduledFromDay,
              color: isWeekly ? '#8b5cf6' : getCategoryColor(plan.task.category),
              taskId,
              priority: plan.task.priority,
              taskType: plan.task.taskType || 'task',
              deadlineDay: plan.task.deadlineDay,
              dayIndex: d,
              sourceTableId: plan.task.sourceTableId,
              sourceTableName: plan.task.sourceTableName,
              isSubstitute: true,
              substitutedForTitle: overlappedEarly.title,
              substitutedForBlockId: overlappedEarly.id,
              isCompleted: false,
            });

            consumeIntervalFromFreeSlots(placedStart, placedEnd + effectiveBreak);
            usedTaskIdsOnDay.add(taskId);
            plan.placedCount++;
            if (plan.placedCount >= plan.targetCountWeekly) {
              plan.isComplete = true;
            }
            break;
          }
        }
      }

      // Pass 3: 自動敷き詰め日課タスク（daily_auto）がある場合、残りの全空きスロット（freeSlots）に隙間なく再敷き詰め
      // これにより、固定枠や週タスク・代行タスクを完了にした際に1日の予定の途中や末尾に隙間が生まれるのを完全に防ぐ
      const dayAutoPlans = autoPlans.filter((p) => p.candidateDays.includes(d));
      if (dayAutoPlans.length > 0) {
        // 直前に早期完了されたタスクと同じタスクが先頭に来ないようローテーション順序を調整
        const orderedAutoPlans = [...dayAutoPlans];
        if (orderedAutoPlans.length > 1 && nextEarlyBlock.taskId) {
          const sameIdx = orderedAutoPlans.findIndex(
            (p) => (p.origTaskId || p.task.id) === nextEarlyBlock.taskId,
          );
          if (sameIdx === 0) {
            const first = orderedAutoPlans.shift()!;
            orderedAutoPlans.push(first);
          }
        }

        // 各自動タスクのこの日における既存ブロック数をカウント（確定的な一意IDを生成するため）
        const autoCountByTaskId = new Map<string, number>();
        for (const b of [...earlyCompletedAnchors, ...obstacleAnchors, ...recompactedBlocks]) {
          if (b.taskId && autoTaskIds.has(b.taskId)) {
            const matchIdx = b.id.match(/-(\d+)$/);
            const idxNum = matchIdx ? parseInt(matchIdx[1], 10) + 1 : 1;
            const prevMax = autoCountByTaskId.get(b.taskId) || 0;
            autoCountByTaskId.set(b.taskId, Math.max(prevMax, idxNum));
          }
        }

        let planCursor = 0;
        let safetyCounter = 0;
        while (freeSlots.some((s) => s.endMinutes - s.startMinutes >= 15) && safetyCounter < 200) {
          safetyCounter++;
          const targetSlot = freeSlots.find((s) => s.endMinutes - s.startMinutes >= 15);
          if (!targetSlot) break;

          const plan = orderedAutoPlans[planCursor % orderedAutoPlans.length];
          planCursor++;

          const task = plan.task;
          const tid = plan.origTaskId || task.id;
          const requiredMin = getTaskRawDuration(task);
          const breakMin = task.breakMinutes && task.breakMinutes > 0 ? task.breakMinutes : 0;
          const avail = targetSlot.endMinutes - targetSlot.startMinutes;

          if (avail < 15) break;

          let effectiveDuration = Math.min(requiredMin, Math.max(15, avail - breakMin));
          const effectiveBreak = Math.max(0, Math.min(breakMin, avail - effectiveDuration));
          const rem = avail - (effectiveDuration + effectiveBreak);
          if (rem > 0 && rem < 15) {
            if (orderedAutoPlans.length > 1 && effectiveDuration - (15 - rem) >= 15) {
              // 次の自動タスクが最低15分枠として入れるよう調整し、端数隙間をゼロにする
              effectiveDuration = avail - effectiveBreak - 15;
            } else {
              // 15分未満の端数隙間を現在のブロックに吸収して隙間をゼロにする
              effectiveDuration = avail - effectiveBreak;
            }
          }

          const placedStart = targetSlot.startMinutes;
          const placedEnd = placedStart + effectiveDuration;
          const overlappedEarly =
            findOverlappedEarlyBlock(placedStart, placedEnd) ||
            (placedStart < nextEarlyBlock.endMinutes ? nextEarlyBlock : undefined);

          const countIdx = autoCountByTaskId.get(tid) || 0;
          autoCountByTaskId.set(tid, countIdx + 1);

          recompactedBlocks.push({
            id: `block-task-${d}-${tid}-${countIdx}`,
            title: task.title,
            category: task.category,
            startMinutes: placedStart,
            endMinutes: placedEnd,
            isFixed: false,
            isBreak: false,
            breakMinutes: effectiveBreak > 0 ? effectiveBreak : undefined,
            isWeeklyTask: false,
            color: getCategoryColor(task.category),
            taskId: tid,
            priority: task.priority,
            taskType: task.taskType || 'task',
            deadlineDay: task.deadlineDay,
            dayIndex: d,
            sourceTableId: task.sourceTableId,
            sourceTableName: task.sourceTableName,
            isSubstitute: overlappedEarly ? true : undefined,
            substitutedForTitle: overlappedEarly ? overlappedEarly.title : undefined,
            substitutedForBlockId: overlappedEarly ? overlappedEarly.id : undefined,
            isCompleted: false,
          });

          consumeIntervalFromFreeSlots(placedStart, placedEnd + effectiveBreak);
        }

        // Pass 1/Pass 2 の非自動タスク配置後に残った 15分未満の端数空きスロットがあれば、直前または直後の自動タスクに吸収して隙間を完全ゼロにする
        for (const leftover of [...freeSlots]) {
          const gap = leftover.endMinutes - leftover.startMinutes;
          if (gap > 0 && gap < 15) {
            const prevAuto = recompactedBlocks.find(
              (rb) =>
                isAutoBlock(rb) && rb.endMinutes + (rb.breakMinutes || 0) === leftover.startMinutes,
            );
            if (prevAuto) {
              prevAuto.endMinutes += gap;
              consumeIntervalFromFreeSlots(leftover.startMinutes, leftover.endMinutes);
              continue;
            }
            const nextAuto = recompactedBlocks.find(
              (rb) => isAutoBlock(rb) && rb.startMinutes === leftover.endMinutes,
            );
            if (nextAuto) {
              nextAuto.startMinutes -= gap;
              consumeIntervalFromFreeSlots(leftover.startMinutes, leftover.endMinutes);
            }
          }
        }
      } else {
        // Pass 4: 自動敷き詰めタスクが存在せず、早期完了枠にまだ何も配置されていない場合のフォールバック
        for (const eb of dayEarlyBlocks) {
          const hasOverlappingPlaced = recompactedBlocks.some(
            (rb) =>
              Math.max(rb.startMinutes, eb.startMinutes) <
              Math.min(rb.endMinutes, eb.endMinutes + (eb.breakMinutes || 0)),
          );
          if (hasOverlappingPlaced) continue;

          const ebEffectiveStart =
            d === todayIdx ? Math.max(eb.startMinutes, currMinutes) : eb.startMinutes;
          const fallbackPlan = plans.find((p) => {
            const tid = p.origTaskId || p.task.id;
            if (usedTaskIdsOnDay.has(tid) || usedTaskIdsOnDay.has(p.task.id)) return false;
            if (!eb.isFixed && (eb.taskId === tid || eb.title === p.task.title)) return false;
            const dur = getTaskRawDuration(p.task);
            return freeSlots.some((s) => {
              const st = Math.max(s.startMinutes, ebEffectiveStart);
              return st < eb.endMinutes && s.endMinutes - st >= dur;
            });
          });

          if (fallbackPlan) {
            const tid = fallbackPlan.origTaskId || fallbackPlan.task.id;
            const rawDuration = getTaskRawDuration(fallbackPlan.task);
            const breakMin =
              fallbackPlan.task.breakMinutes && fallbackPlan.task.breakMinutes > 0
                ? fallbackPlan.task.breakMinutes
                : 0;
            const targetSlot = freeSlots.find((s) => {
              const st = Math.max(s.startMinutes, ebEffectiveStart);
              return st < eb.endMinutes && s.endMinutes - st >= rawDuration;
            });

            if (targetSlot) {
              const placedStart = Math.max(targetSlot.startMinutes, ebEffectiveStart);
              const placedEnd = placedStart + rawDuration;
              const avail = targetSlot.endMinutes - placedStart;
              const effectiveBreak = Math.max(0, Math.min(breakMin, avail - rawDuration));
              const isWeekly = isWeeklyTaskItem(fallbackPlan.task);

              recompactedBlocks.push({
                id: `block-substitute-${d}-${tid}-${eb.id}-${placedStart}`,
                title: fallbackPlan.task.title,
                category: fallbackPlan.task.category,
                startMinutes: placedStart,
                endMinutes: placedEnd,
                isFixed: false,
                isBreak: false,
                breakMinutes: effectiveBreak > 0 ? effectiveBreak : undefined,
                isWeeklyTask: isWeekly,
                color: isWeekly ? '#8b5cf6' : getCategoryColor(fallbackPlan.task.category),
                taskId: tid,
                priority: fallbackPlan.task.priority,
                taskType: fallbackPlan.task.taskType || 'task',
                deadlineDay: fallbackPlan.task.deadlineDay,
                dayIndex: d,
                sourceTableId: fallbackPlan.task.sourceTableId,
                sourceTableName: fallbackPlan.task.sourceTableName,
                isSubstitute: true,
                substitutedForTitle: eb.title,
                substitutedForBlockId: eb.id,
                isCompleted: false,
              });

              consumeIntervalFromFreeSlots(placedStart, placedEnd + effectiveBreak);
              usedTaskIdsOnDay.add(tid);
            }
          }
        }
      }

      dayBlocks[d] = [...earlyCompletedAnchors, ...obstacleAnchors, ...recompactedBlocks].sort(
        (a, b) => a.startMinutes - b.startMinutes,
      );
    }
  }

  return {
    scheduledTaskMinutesDelta: calcTotalTaskMinutes() - initialTaskMinutes,
  };
}
