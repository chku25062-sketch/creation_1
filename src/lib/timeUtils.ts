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
 * 指定された日付（省略時は現在）のローカルカレンダー日付文字列 (YYYY-MM-DD) を取得
 * UTC (toISOString) による日本時間深夜帯の日付ズレを防止
 */
export function getLocalDateString(date: Date = new Date()): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

/**
 * 対象日のカレンダー日付（targetDateStr: "YYYY-MM-DD"）におけるサイクルインデックスを算出する
 * タイムゾーンや夏時間に影響されない安全なUTC絶対ミリ秒差分を用いて連続日数を算出する
 */
export function getCycleIndexForDate(
  targetDateStr: string,
  cycleStartDateStr: string,
  cycleLength: number,
): number {
  if (cycleLength <= 0) return 0;
  const [y1, m1, d1] = targetDateStr.split('-').map(Number);
  const [y2, m2, d2] = cycleStartDateStr.split('-').map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const diffDays = Math.round((utc1 - utc2) / 86400000);

  // 負の数（開始日より前の日付）にも対応した安全なモジュロ演算
  return ((diffDays % cycleLength) + cycleLength) % cycleLength;
}

/**
 * 基準日（baseDateStr: "YYYY-MM-DD"）と基準曜日（baseTodayIndex: 0..6）から、
 * 対象曜日 d (0:月..6:日) のカレンダー日付文字列 "YYYY-MM-DD" を算出する
 */
export function getDateStrForDayIndex(
  baseDateStr: string,
  baseTodayIndex: number,
  targetDayIndex: number,
): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const baseUtc = Date.UTC(y, m - 1, d);

  // 基準日との曜日インデックス差分日数
  const diffFromToday = targetDayIndex - baseTodayIndex;
  const targetUtc = baseUtc + diffFromToday * 86400000;

  const targetDate = new Date(targetUtc);
  const resY = targetDate.getUTCFullYear();
  const resM = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(targetDate.getUTCDate()).padStart(2, '0');

  return `${resY}-${resM}-${resD}`;
}
