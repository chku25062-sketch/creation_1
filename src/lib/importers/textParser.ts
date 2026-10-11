import { ParsedScheduleItem } from '@/types';
import { timeStringToMinutes } from '@/lib/timeUtils';
import { STANDARD_PERIODS, DAY_OF_WEEK_NAMES } from './timetablePresets';

export function parseTextSchedule(text: string): ParsedScheduleItem[] {
  const lines = text.split(/\r?\n/);
  const items: ParsedScheduleItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('//')) {
      continue;
    }

    const item = parseSingleLine(rawLine, `item-${i + 1}`);
    if (item) {
      items.push(item);
    }
  }

  return items;
}

function parseSingleLine(line: string, id: string): ParsedScheduleItem | null {
  // 曜日検出
  const days: number[] = [];
  let cleanLine = line;

  for (const [dayStr, dayNum] of Object.entries(DAY_OF_WEEK_NAMES)) {
    const dayRegex = new RegExp(`(^|[\\s,\\[(（])${dayStr}([曜日月]?|[\\s,\\])）]|$)`, 'i');
    if (dayRegex.test(cleanLine)) {
      if (!days.includes(dayNum)) {
        days.push(dayNum);
      }
      cleanLine = cleanLine.replace(dayRegex, ' ').trim();
    }
  }

  // 1. CSV風の判定 (カンマ区切り)
  if (line.includes(',')) {
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      const title = parts[0];
      // 2番目以降に時刻や数値があるか
      const timeRangeMatch = parts[1].match(/(\d{1,2}:\d{2})\s*[-~〜/]\s*(\d{1,2}:\d{2})/);
      if (timeRangeMatch) {
        const start = timeStringToMinutes(timeRangeMatch[1]);
        const end = timeStringToMinutes(timeRangeMatch[2]);
        const duration = end >= start ? end - start : 1440 - start + end;
        return {
          id,
          title,
          type: 'fixed',
          startMinutes: start,
          endMinutes: end,
          durationMinutes: duration,
          category: 'work',
          daysOfWeek: days.length > 0 ? days : undefined,
        };
      }

      // 所要時間（例: "60" または "60分"）
      const durationMatch = parts[1].match(/(\d+)\s*(分|m|min)?/i);
      if (durationMatch) {
        const dur = parseInt(durationMatch[1], 10);
        if (dur > 0) {
          return {
            id,
            title,
            type: 'task',
            durationMinutes: dur,
            category: 'study',
            priority: 'medium',
            daysOfWeek: days.length > 0 ? days : undefined,
          };
        }
      }
    }
  }

  // 2. 時刻範囲の検出 (例: "09:00 - 10:30 講義名" または "講義名 09:00〜10:30")
  const timeRangeRegex = /(\d{1,2}:\d{2})\s*[-~〜ー/]\s*(\d{1,2}:\d{2})/;
  const timeRangeMatch = cleanLine.match(timeRangeRegex);
  if (timeRangeMatch) {
    const start = timeStringToMinutes(timeRangeMatch[1]);
    const end = timeStringToMinutes(timeRangeMatch[2]);
    const duration = end >= start ? end - start : 1440 - start + end;
    const title = cleanLine.replace(timeRangeRegex, '').trim() || '予定';

    return {
      id,
      title,
      type: 'fixed',
      startMinutes: start,
      endMinutes: end,
      durationMinutes: duration,
      category: title.includes('睡眠') ? 'sleep' : title.includes('食') ? 'meal' : 'work',
      daysOfWeek: days.length > 0 ? days : undefined,
    };
  }

  // 3. 時限の検出 (例: "1限 英語", "2時限目 プログラミング")
  const periodRegex = /([1-6])\s*(限|時限|コマ)/;
  const periodMatch = cleanLine.match(periodRegex);
  if (periodMatch) {
    const periodNum = parseInt(periodMatch[1], 10);
    const standard = STANDARD_PERIODS[periodNum];
    if (standard) {
      const title = cleanLine.replace(periodRegex, '').trim() || `${periodNum}限`;
      return {
        id,
        title,
        type: 'fixed',
        startMinutes: standard.startMinutes,
        endMinutes: standard.endMinutes,
        durationMinutes: standard.endMinutes - standard.startMinutes,
        category: 'lecture',
        daysOfWeek: days.length > 0 ? days : undefined,
      };
    }
  }

  // 4. 所要時間の検出 (例: "読書 60分", "筋トレ 1.5時間", "基本情報 45min")
  const hourMatch = cleanLine.match(/(\d+(?:\.\d+)?)\s*(?:時間|h|hours?)/i);
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1]);
    const duration = Math.round(hours * 60);
    const title = cleanLine.replace(hourMatch[0], '').trim() || 'タスク';
    return {
      id,
      title,
      type: 'task',
      durationMinutes: duration,
      category: guessCategory(title),
      priority: 'medium',
      daysOfWeek: days.length > 0 ? days : undefined,
    };
  }

  const minuteMatch = cleanLine.match(/(\d+)\s*(?:分|min(?:utes?)?|m)/i);
  if (minuteMatch) {
    const duration = parseInt(minuteMatch[1], 10);
    const title = cleanLine.replace(minuteMatch[0], '').trim() || 'タスク';
    return {
      id,
      title,
      type: 'task',
      durationMinutes: duration,
      category: guessCategory(title),
      priority: 'medium',
      daysOfWeek: days.length > 0 ? days : undefined,
    };
  }

  // 5. 時間指定がない場合はデフォルト30分のタスクとして抽出
  if (cleanLine.length >= 2) {
    return {
      id,
      title: cleanLine,
      type: 'task',
      durationMinutes: 30,
      category: guessCategory(cleanLine),
      priority: 'medium',
      daysOfWeek: days.length > 0 ? days : undefined,
    };
  }

  return null;
}

function guessCategory(title: string): string {
  if (
    title.includes('勉強') ||
    title.includes('学習') ||
    title.includes('読書') ||
    title.includes('資格') ||
    title.includes('講義') ||
    title.includes('授業')
  ) {
    return 'study';
  }
  if (
    title.includes('筋トレ') ||
    title.includes('ジム') ||
    title.includes('ラン') ||
    title.includes('運動') ||
    title.includes('散歩')
  ) {
    return 'workout';
  }
  if (
    title.includes('仕事') ||
    title.includes('バイト') ||
    title.includes('作業') ||
    title.includes('会議')
  ) {
    return 'work';
  }
  if (
    title.includes('開発') ||
    title.includes('創作') ||
    title.includes('執筆') ||
    title.includes('イラスト')
  ) {
    return 'creative';
  }
  return 'other';
}
