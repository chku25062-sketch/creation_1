import { TheoreticalBlock } from '@/types';

export interface CompletionToggleParams {
  targetBlock: TheoreticalBlock;
  allBlocks: TheoreticalBlock[];
  completedBlockIds: Set<string>;
  uncompletedBlockIds: Set<string>;
  todayIdx: number;
  currMinutes: number;
}

export interface CompletionToggleResult {
  nextCompletedIds: Set<string>;
  nextUncompletedIds: Set<string>;
}

/**
 * ブロックの完了・未完了状態トグルを純粋関数として処理するマネージャー
 * 大元ブロックと再配置ブロックの連動、競合防止、ローカルストレージ整合性を一元保証
 */
export function toggleBlockCompletion(params: CompletionToggleParams): CompletionToggleResult {
  const {
    targetBlock,
    allBlocks,
    completedBlockIds,
    uncompletedBlockIds,
    todayIdx,
    currMinutes,
  } = params;

  // 休憩ブロックはトグル不可
  if (targetBlock.isBreak) {
    return {
      nextCompletedIds: new Set(completedBlockIds),
      nextUncompletedIds: new Set(uncompletedBlockIds),
    };
  }

  const nextCompleted = new Set(completedBlockIds);
  const nextUncompleted = new Set(uncompletedBlockIds);

  const isPast =
    targetBlock.dayIndex !== undefined &&
    (targetBlock.dayIndex < todayIdx ||
      (targetBlock.dayIndex === todayIdx && targetBlock.endMinutes <= currMinutes));

  const targetTaskId = targetBlock.taskId;

  // 同一タスクに関連するブロック群を特定
  const relatedBlocks = targetTaskId
    ? allBlocks.filter((b) => b.taskId === targetTaskId)
    : [targetBlock];
  const relatedBlockIds = new Set(relatedBlocks.map((b) => b.id));
  relatedBlockIds.add(targetBlock.id);

  // 大元のブロック（過去に本来配置されていた元ブロック）を特定
  const originalBlock =
    (targetBlock.originalBlockId
      ? allBlocks.find((b) => b.id === targetBlock.originalBlockId)
      : undefined) ||
    (targetBlock.rescheduledFromDay !== undefined
      ? relatedBlocks.find((b) => !b.isRescheduled && b.dayIndex === targetBlock.rescheduledFromDay)
      : undefined) ||
    relatedBlocks.find(
      (b) =>
        !b.isRescheduled &&
        !b.isSubstitute &&
        b.dayIndex !== undefined &&
        (b.dayIndex < todayIdx || (b.dayIndex === todayIdx && b.endMinutes <= currMinutes)),
    ) ||
    (isPast && !targetBlock.isRescheduled && !targetBlock.isSubstitute ? targetBlock : undefined);

  const isCurrentlyCompleted = targetBlock.isCompleted;

  if (isCurrentlyCompleted) {
    // 【現在完了 -> 未完了に戻す】（「まだ終わっていない」）
    for (const id of relatedBlockIds) {
      nextCompleted.delete(id);
    }
    if (targetTaskId) nextCompleted.delete(targetTaskId);

    // 過去枠（または再配置ブロックの大元が過去枠）の場合のみ未完了登録して未来に再配置
    const originalPast = originalBlock || (isPast ? targetBlock : undefined);
    if (originalPast) {
      for (const id of relatedBlockIds) {
        nextUncompleted.delete(id);
      }
      nextUncompleted.add(originalPast.id);
    } else {
      // 未来枠の場合はデフォルト未完了なので、未完了リストからも削除して初期状態へ
      for (const id of relatedBlockIds) {
        nextUncompleted.delete(id);
      }
      if (targetTaskId) nextUncompleted.delete(targetTaskId);
    }
  } else {
    // 【現在未完了 -> 完了にする】（「これはもう終わっている」）
    // 1. 未完了リストからこのタスクに関するすべてのIDを確実に抹消（排他性の完全保証）
    for (const id of relatedBlockIds) {
      nextUncompleted.delete(id);
    }
    if (targetTaskId) nextUncompleted.delete(targetTaskId);

    // 2. 完了リストの更新
    if (targetBlock.isRescheduled) {
      // 再配置ブロックを完了にした場合:
      // 再配置先も完了として残し、大元ブロックも連動して完了にする
      nextCompleted.add(targetBlock.id);
      if (originalBlock) {
        nextCompleted.add(originalBlock.id);
      }
    } else {
      // 大元のタスクを未完了から完了にした場合:
      // 大元タスクを完了にし、不要になった再配置先を取り除く
      for (const b of relatedBlocks) {
        if (b.isRescheduled) {
          nextCompleted.delete(b.id);
        }
      }
      nextCompleted.add(targetBlock.id);
    }
  }

  // 競合ガード: 完了に存在するIDは未完了から完全に除外
  for (const cid of nextCompleted) {
    nextUncompleted.delete(cid);
  }

  return {
    nextCompletedIds: nextCompleted,
    nextUncompletedIds: nextUncompleted,
  };
}

/**
 * 完了・未完了状態をローカルストレージへ安全に保存するヘルパー
 */
export function persistCompletionStates(
  completedBlockIds: Set<string>,
  uncompletedBlockIds: Set<string>,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('app_completed_block_ids', JSON.stringify(Array.from(completedBlockIds)));
    localStorage.setItem(
      'app_uncompleted_block_ids',
      JSON.stringify(Array.from(uncompletedBlockIds)),
    );
  } catch {
    // ignore
  }
}
