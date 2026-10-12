import { describe, it, expect } from 'vitest';
import {
  getDefaultDividers,
  calculateCellRects,
  snapDividersToPeaks,
  fitLatticeToPeaks,
  findDataTableBoundsFromProjections,
  extractPeaksFromProjection,
  snapToClosestGuideline,
  formatCellText,
  removeCjkInterwordSpaces,
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

  it('fitLatticeToPeaks selects best count and snaps dividers to prominent peaks', () => {
    // 100 ピクセルのプロファイルで、5分割（理想位置: 20, 40, 60, 80）付近に強い罫線ピークがあるケース
    const projection = new Array(100).fill(5);
    projection[21] = 80;
    projection[39] = 90;
    projection[61] = 85;
    projection[80] = 95;

    const res = fitLatticeToPeaks(projection, 0.0, 1.0, [4, 5, 6]);
    expect(res.bestCount).toBe(5);
    expect(res.dividers).toHaveLength(4);
    expect(res.dividers[0]).toBeCloseTo(0.21, 2);
    expect(res.dividers[1]).toBeCloseTo(0.39, 2);
    expect(res.dividers[2]).toBeCloseTo(0.61, 2);
    expect(res.dividers[3]).toBeCloseTo(0.8, 2);
  });

  describe('formatCellText', () => {
    it('joins single newlines with spaces for alphanumeric elements', () => {
      const input = '線形代数\n302教室';
      expect(formatCellText(input)).toBe('線形代数 302教室');
    });

    it('joins Japanese wrapped lines without space while preserving paragraph breaks', () => {
      const input = '  プログラミング\n演習  \n\n  山田先生\n401室  ';
      expect(formatCellText(input)).toBe('プログラミング演習\n山田先生 401室');
    });

    it('removes unwanted spaces between Japanese characters while preserving English word spaces', () => {
      expect(removeCjkInterwordSpaces('プ ロ グ ラ ミ ン グ')).toBe('プログラミング');
      expect(removeCjkInterwordSpaces('線 形 代 数')).toBe('線形代数');
      expect(removeCjkInterwordSpaces('情 報 ネ ッ ト ワ ー ク 論')).toBe('情報ネットワーク論');
      expect(removeCjkInterwordSpaces('Data Structure')).toBe('Data Structure');
      expect(formatCellText('プ ロ グ ラ ミ ン グ')).toBe('プログラミング');
      expect(formatCellText('線 形 代 数')).toBe('線形代数');
      expect(formatCellText('情 報 ネ ッ ト ワ ー ク 論')).toBe('情報ネットワーク論');
      expect(formatCellText('Data Structure')).toBe('Data Structure');
      expect(formatCellText('線形代数 302教室')).toBe('線形代数 302教室');
      expect(formatCellText('英語 I 101教室')).toBe('英語 I 101教室');
    });

    it('preserves empty lines as newlines (paragraphs)', () => {
      const input = '情報システム論\n\n※レポート提出あり';
      expect(formatCellText(input)).toBe('情報システム論\n※レポート提出あり');
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

  describe('findDataTableBoundsFromProjections', () => {
    it('detects table area and skips index column and header row when intervals are narrow', () => {
      const width = 500;
      const height = 400;

      const vert = new Array(width).fill(5);
      // X軸罫線: 20 (表の左端), 50 (時限列の右/データ列の開始), 140, 230, 320, 410 (データ5列, 幅90px)
      vert[20] = 80;
      vert[50] = 90;
      vert[140] = 85;
      vert[230] = 85;
      vert[320] = 85;
      vert[410] = 90;

      const horiz = new Array(height).fill(5);
      // Y軸罫線: 15 (表の上端), 40 (曜日行の下/データ行の開始), 110, 180, 250, 320 (データ5行, 高さ70px)
      horiz[15] = 80;
      horiz[40] = 90;
      horiz[110] = 85;
      horiz[180] = 85;
      horiz[250] = 85;
      horiz[320] = 90;

      const bounds = findDataTableBoundsFromProjections(vert, horiz, width, height);
      expect(bounds.hasDetected).toBe(true);

      // 左端は 50 / 500 = 0.10 （時限列 20-50 をスキップした位置）
      expect(bounds.x).toBeCloseTo(0.1, 2);
      // 幅は (410 - 50) / 500 = 0.72
      expect(bounds.w).toBeCloseTo(0.72, 2);

      // 上端は 40 / 400 = 0.10 （曜日行 15-40 をスキップした位置）
      expect(bounds.y).toBeCloseTo(0.1, 2);
      // 高さは (320 - 40) / 400 = 0.70
      expect(bounds.h).toBeCloseTo(0.7, 2);
    });

    it('encloses entire grid when intervals are already uniform without separate header', () => {
      const width = 500;
      const height = 400;

      const vert = new Array(width).fill(5);
      // 均等5列: 50, 130, 210, 290, 370, 450 (各幅80px)
      [50, 130, 210, 290, 370, 450].forEach((x) => {
        vert[x] = 90;
      });

      const horiz = new Array(height).fill(5);
      // 均等5行: 30, 95, 160, 225, 290, 355 (各高さ65px)
      [30, 95, 160, 225, 290, 355].forEach((y) => {
        horiz[y] = 90;
      });

      const bounds = findDataTableBoundsFromProjections(vert, horiz, width, height);
      expect(bounds.hasDetected).toBe(true);
      // 左端は 50 / 500 = 0.10
      expect(bounds.x).toBeCloseTo(0.1, 2);
      // 右端は 450、幅は (450 - 50) / 500 = 0.80
      expect(bounds.w).toBeCloseTo(0.8, 2);
      // 上端は 30 / 400 = 0.075
      expect(bounds.y).toBeCloseTo(0.075, 2);
      // 下端は 355、高さは (355 - 30) / 400 = 0.8125
      expect(bounds.h).toBeCloseTo(0.813, 2);
    });
  });

  describe('snapToClosestGuideline & extractPeaksFromProjection', () => {
    it('extractPeaksFromProjection extracts prominent ratio positions', () => {
      const projection = new Array(100).fill(10);
      projection[20] = 100;
      projection[50] = 100;
      projection[80] = 100;

      const peaks = extractPeaksFromProjection(projection, 1.2);
      expect(peaks).toEqual([0.2, 0.5, 0.8]);
    });

    it('snapToClosestGuideline snaps powerfully to nearby guideline and prevents stopping mid-way', () => {
      const guidelines = [0.2, 0.4, 0.6, 0.8];

      // 0.38（0.4の近く）は 0.4 に強力吸着
      expect(snapToClosestGuideline(0.38, guidelines)).toBe(0.4);
      // 0.43（0.4の近く）も 0.4 に強力吸着
      expect(snapToClosestGuideline(0.43, guidelines)).toBe(0.4);

      // 0.22（0.2の近く）は 0.2 に強力吸着
      expect(snapToClosestGuideline(0.22, guidelines)).toBe(0.2);

      // 境界制約（minBound: 0.3, maxBound: 0.5）がある場合、0.2 は選ばれず 0.4 が選ばれる
      expect(snapToClosestGuideline(0.25, guidelines, 0.3, 0.5)).toBe(0.4);
    });
  });
});
