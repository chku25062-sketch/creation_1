import { describe, it, expect } from 'vitest';
import {
  getDefaultDividers,
  calculateCellRects,
  snapDividersToPeaks,
  formatCellText,
  matrixToCsv,
} from './gridDetection';

describe('gridDetection utility', () => {
  it('getDefaultDividers generates equal splits correctly', () => {
    const { colDividers, rowDividers } = getDefaultDividers(5, 4);

    expect(colDividers).toHaveLength(4);
    expect(colDividers).toEqual([0.2, 0.4, 0.6, 0.8]);

    expect(rowDividers).toHaveLength(3);
    expect(rowDividers).toEqual([0.25, 0.5, 0.75]);
  });

  it('calculateCellRects returns expected rows and columns of rects', () => {
    const colDividers = [0.2, 0.4, 0.6, 0.8]; // 5 columns
    const rowDividers = [0.5]; // 2 rows

    const rects = calculateCellRects(colDividers, rowDividers);
    expect(rects).toHaveLength(2); // 2 rows
    expect(rects[0]).toHaveLength(5); // 5 cols

    // First cell (row 0, col 0)
    expect(rects[0][0].x).toBe(0);
    expect(rects[0][0].y).toBe(0);
    expect(rects[0][0].w).toBeCloseTo(0.2);
    expect(rects[0][0].h).toBeCloseTo(0.5);

    // Last cell (row 1, col 4)
    expect(rects[1][4].x).toBeCloseTo(0.8);
    expect(rects[1][4].y).toBeCloseTo(0.5);
    expect(rects[1][4].w).toBeCloseTo(0.2);
    expect(rects[1][4].h).toBeCloseTo(0.5);
  });

  it('snapDividersToPeaks snaps to prominent peaks in projection', () => {
    // 100 pixels length
    const projection = new Array(100).fill(10);
    // Add strong peaks at index 48 and 52
    projection[48] = 100;
    projection[52] = 100;

    // Split into 2 columns (1 divider around 50)
    const dividers = snapDividersToPeaks(projection, 1, 0.1);
    expect(dividers).toHaveLength(1);
    // Should snap close to 48 or 52 (e.g. 0.48 or 0.52)
    expect(dividers[0]).toBeGreaterThanOrEqual(0.45);
    expect(dividers[0]).toBeLessThanOrEqual(0.55);
  });

  describe('formatCellText', () => {
    it('joins single newlines with spaces', () => {
      const input = '線形代数\n302教室';
      expect(formatCellText(input)).toBe('線形代数 302教室');
    });

    it('preserves empty lines as newlines (paragraphs)', () => {
      const input = '情報システム論\n\n※レポート提出あり';
      expect(formatCellText(input)).toBe('情報システム論\n※レポート提出あり');
    });

    it('handles multiple newlines and spaces cleanly', () => {
      const input = '  プログラミング\n演習  \n\n  山田先生\n401室  ';
      expect(formatCellText(input)).toBe('プログラミング 演習\n山田先生 401室');
    });

    it('returns null for empty string or only whitespace', () => {
      expect(formatCellText('')).toBeNull();
      expect(formatCellText('   \n  \n ')).toBeNull();
    });

    it('returns null for isolated noise symbols (like hyphens or vertical bars)', () => {
      expect(formatCellText('-')).toBeNull();
      expect(formatCellText('|')).toBeNull();
      expect(formatCellText('---')).toBeNull();
      expect(formatCellText('  -  \n  |  ')).toBeNull();
    });
  });

  describe('matrixToCsv', () => {
    it('converts matrix to valid CSV representation with null as empty cells', () => {
      const matrix = [
        ['英語I 101教室', null, '数学A', null, null],
        [null, '物理学', null, '化学', null],
      ];
      const csv = matrixToCsv(matrix);
      expect(csv).toContain('時限,月,火,水,木,金');
      expect(csv).toContain('1限,英語I 101教室,,数学A,,');
      expect(csv).toContain('2限,,物理学,,化学,');
    });
  });
});
