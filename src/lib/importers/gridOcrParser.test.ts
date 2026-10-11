import { describe, it, expect } from 'vitest';
import { clusterWordsIntoGrid, WordBBox } from './gridOcrParser';

describe('2D Grid OCR Parser', () => {
  it('座標から曜日列と時限行を正しく判定し、セル内の複数行改行を復元すること', () => {
    // 500x500 の表領域 (1セルあたり 幅100 x 高さ100)
    // 列0: 0〜100 (月), 列1: 100〜200 (火), 列2: 200〜300 (水), ...
    // 行0: 0〜100 (1限), 行1: 100〜200 (2限), ...

    const mockWords: WordBBox[] = [
      // 月曜 1限: 2行構成 ("英語I", "302教室")
      { text: '英語I', bbox: { x0: 20, y0: 20, x1: 60, y1: 35 } },
      { text: '302教室', bbox: { x0: 20, y0: 60, x1: 70, y1: 75 } },

      // 火曜 2限: 1行 ("線形代数")
      // 行1(100〜200), 列1(100〜200)
      { text: '線形代数', bbox: { x0: 120, y0: 130, x1: 180, y1: 150 } },

      // 金曜 5限: 3行構成 ("プログラミング", "情報棟", "PC演習室")
      // 行4(400〜500), 列4(400〜500)
      { text: 'プログラミング', bbox: { x0: 410, y0: 410, x1: 480, y1: 425 } },
      { text: '情報棟', bbox: { x0: 410, y0: 440, x1: 450, y1: 455 } },
      { text: 'PC演習室', bbox: { x0: 410, y0: 470, x1: 470, y1: 485 } },
    ];

    const grid = clusterWordsIntoGrid(mockWords, {
      columns: 5,
      rows: 5,
      tableWidth: 500,
      tableHeight: 500,
    });

    expect(grid).toHaveLength(5); // 5行
    expect(grid[0]).toHaveLength(5); // 5列

    // 月曜 1限 (row 0, col 0)
    const mon1 = grid[0][0];
    expect(mon1.dayIndex).toBe(0);
    expect(mon1.periodIndex).toBe(1);
    expect(mon1.title).toBe('英語I');
    expect(mon1.roomOrNote).toBe('302教室');
    expect(mon1.fullText).toBe('英語I\n302教室');

    // 火曜 2限 (row 1, col 1)
    const tue2 = grid[1][1];
    expect(tue2.dayIndex).toBe(1);
    expect(tue2.periodIndex).toBe(2);
    expect(tue2.title).toBe('線形代数');
    expect(tue2.roomOrNote).toBe('');

    // 金曜 5限 (row 4, col 4)
    const fri5 = grid[4][4];
    expect(fri5.dayIndex).toBe(4);
    expect(fri5.periodIndex).toBe(5);
    expect(fri5.title).toBe('プログラミング');
    expect(fri5.roomOrNote).toBe('情報棟\nPC演習室');
  });
});
