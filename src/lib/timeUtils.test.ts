import { describe, it, expect } from 'vitest';
import {
  minutesToTimeString,
  timeStringToMinutes,
  formatDuration,
  calculatePeriodTimes,
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
});
