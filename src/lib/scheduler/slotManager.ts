import { FixedSlot, FreeSlot, TheoreticalBlock } from '@/types';
import { getCategoryColor } from './constants';

/**
 * 日を跨ぐ固定枠（例: 23:00 - 07:00）を [23:00-24:00] と [00:00-07:00] に分割し、時系列で整頓
 */
export function normalizeFixedSlots(slots: FixedSlot[]): FixedSlot[] {
  const result: FixedSlot[] = [];

  for (const slot of slots) {
    if (slot.startMinutes === slot.endMinutes) {
      continue;
    }

    const isOvernight = slot.startMinutes > slot.endMinutes || slot.endMinutes > 1440;
    const realEnd = slot.endMinutes > 1440 ? slot.endMinutes % 1440 : slot.endMinutes;

    if (isOvernight) {
      result.push({
        ...slot,
        id: `${slot.id}-part1`,
        startMinutes: slot.startMinutes,
        endMinutes: 1440,
      });
      if (realEnd > 0) {
        result.push({
          ...slot,
          id: `${slot.id}-part2`,
          startMinutes: 0,
          endMinutes: realEnd,
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
    if (slot.enabled === false) return false;
    if (!slot.daysOfWeek || slot.daysOfWeek.length === 0) return true;
    return slot.daysOfWeek.includes(dayIndex);
  });
}

/**
 * 週間7日間の固定枠と空き時間スロットを統合管理するスロットマネージャークラス
 */
export class SlotManager {
  private dayAvailableSlots: Record<number, FreeSlot[]> = {};
  private dayNormalizedFixed: Record<number, FixedSlot[]> = {};

  constructor(fixedSlots: FixedSlot[], dayBlocks: Record<number, TheoreticalBlock[]>) {
    this.initialize(fixedSlots, dayBlocks);
  }

  private initialize(fixedSlots: FixedSlot[], dayBlocks: Record<number, TheoreticalBlock[]>): void {
    // 曜日ごとのスロット配列を準備
    const rawSlotsByDay: Record<number, FixedSlot[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };

    for (const slot of fixedSlots) {
      if (slot.enabled === false) continue;
      if (slot.startMinutes === slot.endMinutes) continue;
      const targetDays =
        slot.daysOfWeek && slot.daysOfWeek.length > 0 ? slot.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];

      for (const d of targetDays) {
        const isOvernight = slot.startMinutes > slot.endMinutes || slot.endMinutes > 1440;
        const realEnd = slot.endMinutes > 1440 ? slot.endMinutes % 1440 : slot.endMinutes;

        if (isOvernight) {
          // 日跨ぎ固定枠（例: 23:00 - 07:00 / 1380 - 420 / 1380 - 1860）:
          // 当日夜 (startMinutes -> 1440)
          rawSlotsByDay[d].push({
            ...slot,
            id: `${slot.id}-part1`,
            startMinutes: slot.startMinutes,
            endMinutes: 1440,
          });
          // 翌日朝 (0 -> realEnd): 翌日のインデックス (d + 1) % 7 へ割り当て
          if (realEnd > 0) {
            const nextDay = (d + 1) % 7;
            rawSlotsByDay[nextDay].push({
              ...slot,
              id: `${slot.id}-part2`,
              startMinutes: 0,
              endMinutes: realEnd,
            });
          }
        } else {
          rawSlotsByDay[d].push(slot);
        }
      }
    }

    for (let d = 0; d < 7; d++) {
      const normalized = rawSlotsByDay[d].sort((a, b) => a.startMinutes - b.startMinutes);
      this.dayNormalizedFixed[d] = normalized;

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
          url: slot.url,
        });

        slotsWithBreaks.push(slot);

        // 固定枠に休憩時間が設定されている場合、余白として空き時間から除外
        if (slot.breakMinutes && slot.breakMinutes > 0) {
          const nextSlot = normalized[i + 1];
          const maxBreakEnd = nextSlot
            ? Math.min(slot.endMinutes + slot.breakMinutes, nextSlot.startMinutes)
            : Math.min(slot.endMinutes + slot.breakMinutes, 1440);
          const breakDuration = maxBreakEnd - slot.endMinutes;
          if (breakDuration > 0) {
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
      this.dayAvailableSlots[d] = calculateFreeSlots(slotsWithBreaks);
    }
  }

  public getAvailableSlots(dayIndex: number): FreeSlot[] {
    return this.dayAvailableSlots[dayIndex] || [];
  }

  public getNormalizedFixed(dayIndex: number): FixedSlot[] {
    return this.dayNormalizedFixed[dayIndex] || [];
  }

  public refreshDaySlots(dayIndex: number): void {
    const slots = this.dayAvailableSlots[dayIndex];
    if (slots) {
      this.dayAvailableSlots[dayIndex] = slots
        .filter((s) => s.durationMinutes >= 15)
        .sort((a, b) => a.startMinutes - b.startMinutes);
    }
  }

  public getTotalFreeMinutes(dayIndex: number): number {
    const slots = this.dayAvailableSlots[dayIndex] || [];
    return slots.reduce((sum, s) => sum + s.durationMinutes, 0);
  }

  public getDaysSortedByFreeTime(candidateDays: number[] = [0, 1, 2, 3, 4, 5, 6]): number[] {
    return [...candidateDays].sort(
      (a, b) => this.getTotalFreeMinutes(b) - this.getTotalFreeMinutes(a),
    );
  }
}
