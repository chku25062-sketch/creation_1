import { describe, it, expect } from 'vitest';
import {
  getDefaultDividers,
  calculateCellRects,
  snapDividersToPeaks,
  findProminentPeaks,
  formatCellText,
  cleanHeaderArtifacts,
  matrixToCsv,
  extractMorphologicalLineProjections,
  interpolateMissingDividers,
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

  it('findProminentPeaks detects number of lines automatically without predefined column count', () => {
    // 100 pixels with peaks at 25, 50, 75
    const projection = new Array(100).fill(5);
    projection[25] = 80;
    projection[50] = 90;
    projection[75] = 85;

    const peaks = findProminentPeaks(projection, 0.05, 1.3);
    expect(peaks).toHaveLength(3);
    expect(peaks[0]).toBeCloseTo(0.25, 1);
    expect(peaks[1]).toBeCloseTo(0.5, 1);
    expect(peaks[2]).toBeCloseTo(0.75, 1);
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

    it('cleanses attached row and column headers from cell contents', () => {
      // 曜日ヘッダーの混入除去
      expect(formatCellText('月 英語I 101教室')).toBe('英語I 101教室');
      expect(formatCellText('月曜\n線形代数')).toBe('線形代数');
      expect(formatCellText('(火) プログラミング')).toBe('プログラミング');

      // 時限・時刻ヘッダーの混入除去
      expect(formatCellText('1限 物理学')).toBe('物理学');
      expect(formatCellText('1\n化学実験')).toBe('化学実験');
      expect(formatCellText('第2限 統計学')).toBe('統計学');
      expect(formatCellText('09:00-10:30 微積分学')).toBe('微積分学');

      // ヘッダー単体のセルは null になる
      expect(formatCellText('月')).toBeNull();
      expect(formatCellText('火曜')).toBeNull();
      expect(formatCellText('1限')).toBeNull();
      expect(formatCellText('1')).toBeNull();
      expect(formatCellText('10:40 - 12:10')).toBeNull();

      // 講義名の一部（末尾のIや1など）は保持される
      expect(formatCellText('英語I')).toBe('英語I');
      expect(formatCellText('情報数学1')).toBe('情報数学1');
    });
  });

  describe('cleanHeaderArtifacts', () => {
    it('strips leading day and period names directly', () => {
      expect(cleanHeaderArtifacts('水 経済学入門')).toBe('経済学入門');
      expect(cleanHeaderArtifacts('3限 ドイツ語')).toBe('ドイツ語');
      expect(cleanHeaderArtifacts('金')).toBeNull();
    });
  });

  describe('calculateCellRects with bounds', () => {
    it('restricts grid rects within specified boundary margins', () => {
      // 左10%（時限列）、上8%（曜日行）を除外
      const bounds = { left: 0.1, top: 0.08, right: 1.0, bottom: 1.0 };
      const colDividers = [0.55]; // 2列
      const rowDividers = [0.54]; // 2行

      const rects = calculateCellRects(colDividers, rowDividers, bounds);
      expect(rects).toHaveLength(2);
      expect(rects[0]).toHaveLength(2);

      // (0,0) セルの左端は 0.1、上端は 0.08
      expect(rects[0][0].x).toBeCloseTo(0.1);
      expect(rects[0][0].y).toBeCloseTo(0.08);
    });
  });

  describe('matrixToCsv', () => {
    it('converts matrix to valid CSV representation with null as empty cells', () => {
      const matrix = [
        ['英語I 101教室', null, '数学A', null, null],
        [null, '物理学', null, '化学', null],
      ];
      const csv = matrixToCsv(matrix);
      expect(csv).toContain('行 / 列,月,火,水,木,金');
      expect(csv).toContain('1限,英語I 101教室,,数学A,,');
      expect(csv).toContain('2限,,物理学,,化学,');
    });

    it('uses custom rowLabels when provided', () => {
      const matrix = [['タスク1', 'タスク2']];
      const csv = matrixToCsv(matrix, ['A', 'B'], ['午前']);
      expect(csv).toContain('行 / 列,A,B');
      expect(csv).toContain('午前,タスク1,タスク2');
    });
  });

  describe('extractMorphologicalLineProjections', () => {
    it('removes short character strokes and preserves continuous table grid lines', () => {
      const width = 100;
      const height = 100;
      const data = new Uint8ClampedArray(width * height * 4).fill(255); // 白背景

      const setPixel = (x: number, y: number, dark: boolean) => {
        const idx = (y * width + x) * 4;
        const val = dark ? 0 : 255;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      };

      // 1. 本物の水平罫線 (y = 50 に長さ 80px の連続黒線)
      for (let x = 10; x <= 90; x++) {
        setPixel(x, 50, true);
      }

      // 2. 本物の垂直罫線 (x = 50 に長さ 80px の連続黒線)
      for (let y = 10; y <= 90; y++) {
        setPixel(50, y, true);
      }

      // 3. 文字を模した短い線分ノイズ (y = 20 に長さ 5px の横棒、x = 20 に長さ 5px の縦棒)
      for (let x = 18; x <= 22; x++) {
        setPixel(x, 20, true);
      }
      for (let y = 18; y <= 22; y++) {
        setPixel(20, y, true);
      }

      const res = extractMorphologicalLineProjections(data, width, height);

      expect(res.hasLines).toBe(true);
      // 水平罫線の y = 50 は 80px のピークが抽出される
      expect(res.horizProjection[50]).toBeGreaterThanOrEqual(80);
      // 文字ノイズの y = 20 はモルフォロジー演算で消去され 0 になる
      expect(res.horizProjection[20]).toBe(0);

      // 垂直罫線の x = 50 は 80px のピークが抽出される
      expect(res.vertProjection[50]).toBeGreaterThanOrEqual(80);
      // 文字ノイズの x = 20 はモルフォロジー演算で消去され 0 になる
      expect(res.vertProjection[20]).toBe(0);
    });
  });

  describe('interpolateMissingDividers', () => {
    it('interpolates missing divider when gap is double the median interval', () => {
      // 0.2, 0.4, 0.8 -> 0.6 の線がかすれて抜けているケース
      const input = [0.2, 0.4, 0.8];
      const result = interpolateMissingDividers(input, 0.0, 1.0);
      expect(result).toEqual([0.2, 0.4, 0.6, 0.8]);
    });

    it('leaves intact when dividers are already regular', () => {
      const input = [0.25, 0.5, 0.75];
      const result = interpolateMissingDividers(input, 0.0, 1.0);
      expect(result).toEqual([0.25, 0.5, 0.75]);
    });
  });
});
