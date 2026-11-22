import { describe, it, expect } from 'vitest';
import {
  minutesToTimeString,
  timeStringToMinutes,
  formatDuration,
  calculatePeriodTimes,
  getCycleIndexForDate,
  getDateStrForDayIndex,
  getLocalDateString,
} from './timeUtils';

describe('timeUtils', () => {
  it('minutesToTimeString and timeStringToMinutes convert reversibly', () => {
    expect(minutesToTimeString(540)).toBe('09:00');
    expect(timeStringToMinutes('09:00')).toBe(540);
    expect(minutesToTimeString(630)).toBe('10:30');
    expect(timeStringToMinutes('10:30')).toBe(630);
  });

  it('formatDuration formats minutes accurately', () => {
    expect(formatDuration(45)).toBe('45分');
    expect(formatDuration(60)).toBe('1時間');
    expect(formatDuration(90)).toBe('1時間30分');
  });

  describe('calculatePeriodTimes', () => {
    it('calculates regular 90-min periods with 10-min interval and lunch', () => {
      const config = {
        startTime: '08:50',
        periodMinutes: 90,
        intervalMinutes: 10,
        hasLunch: true,
        lunchAfterPeriod: 2,
        lunchMinutes: 50,
      };

      const periods = calculatePeriodTimes(4, config);

      expect(periods).toHaveLength(4);

      // 1限: 08:50 (530m) 〜 10:20 (620m)
      expect(periods[0].startTime).toBe('08:50');
      expect(periods[0].endTime).toBe('10:20');
      expect(periods[0].startMinutes).toBe(530);
      expect(periods[0].endMinutes).toBe(620);

      // 2限: 10:30 (630m) 〜 12:00 (720m) [10分休憩後]
      expect(periods[1].startTime).toBe('10:30');
      expect(periods[1].endTime).toBe('12:00');

      // 3限: 12:50 (770m) 〜 14:20 (860m) [2限後、50分昼休み後]
      expect(periods[2].startTime).toBe('12:50');
      expect(periods[2].endTime).toBe('14:20');

      // 4限: 14:30 (870m) 〜 16:00 (960m) [10分休憩後]
      expect(periods[3].startTime).toBe('14:30');
      expect(periods[3].endTime).toBe('16:00');
    });

    it('respects customRowTimes when specified', () => {
      const config = {
        startTime: '09:00',
        periodMinutes: 90,
        intervalMinutes: 10,
        hasLunch: false,
        lunchAfterPeriod: 2,
        lunchMinutes: 50,
        customRowTimes: {
          2: { startMinutes: 660, endMinutes: 750 }, // 11:00 - 12:30
        },
      };

      const periods = calculatePeriodTimes(3, config);

      expect(periods[0].startTime).toBe('09:00');
      expect(periods[0].endTime).toBe('10:30');

      // 2限はカスタム指定値
      expect(periods[1].startTime).toBe('11:00');
      expect(periods[1].endTime).toBe('12:30');
    });
  });

  describe('getCycleIndexForDate', () => {
    it('calculates continuous cycle index without resetting across weeks', () => {
      // 2026-11-16 (月曜) を Day 0 (Day 1) とした3日サイクル
      const startDate = '2026-11-16';
      const cycleLength = 3;

      expect(getCycleIndexForDate('2026-11-16', startDate, cycleLength)).toBe(0); // 月
      expect(getCycleIndexForDate('2026-11-17', startDate, cycleLength)).toBe(1); // 火
      expect(getCycleIndexForDate('2026-11-18', startDate, cycleLength)).toBe(2); // 水
      expect(getCycleIndexForDate('2026-11-19', startDate, cycleLength)).toBe(0); // 木
      expect(getCycleIndexForDate('2026-11-20', startDate, cycleLength)).toBe(1); // 金
      expect(getCycleIndexForDate('2026-11-21', startDate, cycleLength)).toBe(2); // 土
      expect(getCycleIndexForDate('2026-11-22', startDate, cycleLength)).toBe(0); // 日

      // ★ 最重要: 翌週の月曜日 (2026-11-23) は 0 に戻らず 1 (Day 2) になること！
      expect(getCycleIndexForDate('2026-11-23', startDate, cycleLength)).toBe(1); // 翌週月
      expect(getCycleIndexForDate('2026-11-24', startDate, cycleLength)).toBe(2); // 翌週火
      expect(getCycleIndexForDate('2026-11-25', startDate, cycleLength)).toBe(0); // 翌週水
    });

    it('handles negative diff days (dates before cycle start date) safely', () => {
      const startDate = '2026-11-20';
      const cycleLength = 3;
      // 1日前は ( ( -1 % 3 ) + 3 ) % 3 = 2
      expect(getCycleIndexForDate('2026-11-19', startDate, cycleLength)).toBe(2);
      // 2日前は 1
      expect(getCycleIndexForDate('2026-11-18', startDate, cycleLength)).toBe(1);
    });
  });

  describe('getDateStrForDayIndex', () => {
    it('calculates correct YYYY-MM-DD for each dayIndex in the week', () => {
      // 2026-11-22 (日曜日: todayIndex = 6)
      const baseDate = '2026-11-22';
      const baseTodayIndex = 6;

      expect(getDateStrForDayIndex(baseDate, baseTodayIndex, 0)).toBe('2026-11-16'); // 月曜
      expect(getDateStrForDayIndex(baseDate, baseTodayIndex, 1)).toBe('2026-11-17'); // 火曜
      expect(getDateStrForDayIndex(baseDate, baseTodayIndex, 4)).toBe('2026-11-20'); // 金曜
      expect(getDateStrForDayIndex(baseDate, baseTodayIndex, 6)).toBe('2026-11-22'); // 日曜
    });
  });

  describe('getLocalDateString', () => {
    it('returns YYYY-MM-DD in local time', () => {
      const d = new Date(2026, 10, 23, 0, 30); // 2026-11-23 00:30
      expect(getLocalDateString(d)).toBe('2026-11-23');
    });
  });
});
