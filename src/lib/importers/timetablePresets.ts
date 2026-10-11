export interface PeriodTime {
  period: number;
  name: string;
  startMinutes: number;
  endMinutes: number;
}

export const STANDARD_PERIODS: Record<number, { startMinutes: number; endMinutes: number }> = {
  1: { startMinutes: 9 * 60, endMinutes: 10 * 60 + 30 }, // 09:00 - 10:30
  2: { startMinutes: 10 * 60 + 45, endMinutes: 12 * 60 + 15 }, // 10:45 - 12:15
  3: { startMinutes: 13 * 60, endMinutes: 14 * 60 + 30 }, // 13:00 - 14:30
  4: { startMinutes: 14 * 60 + 45, endMinutes: 16 * 60 + 15 }, // 14:45 - 16:15
  5: { startMinutes: 16 * 60 + 30, endMinutes: 18 * 60 }, // 16:30 - 18:00
  6: { startMinutes: 18 * 60 + 15, endMinutes: 19 * 60 + 45 }, // 18:15 - 19:45
};

export const DAY_OF_WEEK_NAMES: Record<string, number> = {
  月: 0,
  月曜: 0,
  月曜日: 0,
  mon: 0,
  monday: 0,
  火: 1,
  火曜: 1,
  火曜日: 1,
  tue: 1,
  tuesday: 1,
  水: 2,
  水曜: 2,
  水曜日: 2,
  wed: 2,
  wednesday: 2,
  木: 3,
  木曜: 3,
  木曜日: 3,
  thu: 3,
  thursday: 3,
  金: 4,
  金曜: 4,
  金曜日: 4,
  fri: 4,
  friday: 4,
  土: 5,
  土曜: 5,
  土曜日: 5,
  sat: 5,
  saturday: 5,
  日: 6,
  日曜: 6,
  日曜日: 6,
  sun: 6,
  sunday: 6,
};
