export function minutesToTimeString(minutes: number): string {
  const m = Math.max(0, Math.min(1440, Math.floor(minutes)));
  const hours = Math.floor(m / 60) % 24;
  const mins = m % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  return hours * 60 + mins;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

/**
 * 指定された日付（省略時は現在）が属する週の月曜日の日付文字列 (YYYY-MM-DD) を取得
 * 週の切り替わりにおける完了状態の世代分離キーとして使用
 */
export function getMondayKey(date: Date = new Date()): string {
  const d = new Date(date);
  const dayOfWeek = (d.getDay() + 6) % 7; // 0:月 ... 6:日
  d.setDate(d.getDate() - dayOfWeek);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface PeriodTimeSlot {
  periodIndex: number;
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
}

export function calculatePeriodTimes(
  numRows: number,
  config: {
    startTime: string | null;
    periodMinutes: number | null;
    intervalMinutes: number | null;
    hasLunch: boolean;
    lunchAfterPeriod: number;
    lunchMinutes: number;
    customRowTimes?: Record<number, { startMinutes?: number; endMinutes?: number }>;
  },
): PeriodTimeSlot[] {
  const result: PeriodTimeSlot[] = [];
  const isUnset = !config.startTime || config.startTime === 'unset';

  if (isUnset || !config.startTime) {
    for (let r = 0; r < numRows; r++) {
      const periodIndex = r + 1;
      result.push({
        periodIndex,
        startMinutes: 0,
        endMinutes: 0,
        startTime: '',
        endTime: '',
      });
    }
    return result;
  }

  const startBase = timeStringToMinutes(config.startTime);
  let currentStart = startBase;

  for (let r = 0; r < numRows; r++) {
    const periodIndex = r + 1;
    let periodStart = currentStart;
    let periodEnd = currentStart + (config.periodMinutes || 90);

    // カスタム指定があれば上書き
    if (config.customRowTimes && config.customRowTimes[periodIndex]) {
      const custom = config.customRowTimes[periodIndex];
      if (custom.startMinutes !== undefined) periodStart = custom.startMinutes;
      if (custom.endMinutes !== undefined) periodEnd = custom.endMinutes;
    }

    // 日跨ぎ（1440分超）の正規化: 24:00 (1440分) を超える場合は翌日の時刻 (0..1439分) にラップ
    const effectiveStart = periodStart >= 1440 ? periodStart % 1440 : periodStart;
    const effectiveEnd = periodEnd > 1440 ? periodEnd % 1440 : periodEnd;

    result.push({
      periodIndex,
      startMinutes: effectiveStart,
      endMinutes: effectiveEnd,
      startTime: minutesToTimeString(effectiveStart),
      endTime: minutesToTimeString(effectiveEnd),
    });

    // 次のコマの開始時間
    let nextStart = periodEnd + (config.intervalMinutes ?? 10);
    if (config.hasLunch && config.lunchAfterPeriod === periodIndex) {
      nextStart = periodEnd + (config.lunchMinutes || 50);
    }
    currentStart = nextStart;
  }

  return result;
}
