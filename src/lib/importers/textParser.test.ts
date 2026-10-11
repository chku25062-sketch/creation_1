import { describe, it, expect } from 'vitest';
import { parseTextSchedule } from './textParser';

describe('Text Schedule Parser', () => {
  it('時刻範囲の記述から固定枠を正しくパースすること', () => {
    const text = `
      09:00 - 10:30 英語講義
      13:00〜17:00 アルバイト
    `;

    const items = parseTextSchedule(text);
    expect(items).toHaveLength(2);

    expect(items[0].title).toBe('英語講義');
    expect(items[0].type).toBe('fixed');
    expect(items[0].startMinutes).toBe(540); // 09:00
    expect(items[0].endMinutes).toBe(630); // 10:30
    expect(items[0].durationMinutes).toBe(90);

    expect(items[1].title).toBe('アルバイト');
    expect(items[1].type).toBe('fixed');
    expect(items[1].startMinutes).toBe(780); // 13:00
    expect(items[1].endMinutes).toBe(1020); // 17:00
  });

  it('大学の時限表記（1限など）と曜日を正しくマッピングすること', () => {
    const text = '月曜 1限 プログラミング演習';
    const items = parseTextSchedule(text);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('プログラミング演習');
    expect(items[0].type).toBe('fixed');
    expect(items[0].category).toBe('lecture');
    expect(items[0].startMinutes).toBe(540); // 1限: 09:00
    expect(items[0].endMinutes).toBe(630); // 1限: 10:30
    expect(items[0].daysOfWeek).toEqual([0]); // 月曜日
  });

  it('所要時間指定から目標タスクを正しくパースすること', () => {
    const text = `
      読書 45分
      筋トレ 1.5時間
      資格勉強 60min
    `;

    const items = parseTextSchedule(text);
    expect(items).toHaveLength(3);

    expect(items[0].title).toBe('読書');
    expect(items[0].type).toBe('task');
    expect(items[0].durationMinutes).toBe(45);

    expect(items[1].title).toBe('筋トレ');
    expect(items[1].type).toBe('task');
    expect(items[1].durationMinutes).toBe(90);

    expect(items[2].title).toBe('資格勉強');
    expect(items[2].type).toBe('task');
    expect(items[2].durationMinutes).toBe(60);
  });

  it('CSV形式の行を正しくパースすること', () => {
    const text = '基本情報試験対策, 90分\n朝のミーティング, 10:00-11:00';
    const items = parseTextSchedule(text);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('基本情報試験対策');
    expect(items[0].type).toBe('task');
    expect(items[0].durationMinutes).toBe(90);

    expect(items[1].title).toBe('朝のミーティング');
    expect(items[1].type).toBe('fixed');
    expect(items[1].startMinutes).toBe(600);
    expect(items[1].endMinutes).toBe(660);
  });

  it('コメント行や空行を無視すること', () => {
    const text = `
      # 今日の予定メモ
      // ここは無視

      08:00-08:30 朝食
    `;

    const items = parseTextSchedule(text);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('朝食');
  });
});
