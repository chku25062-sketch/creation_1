import { describe, it, expect } from 'vitest';
import { getDefaultDividers, calculateCellRects, snapDividersToPeaks } from './gridDetection';

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
});
