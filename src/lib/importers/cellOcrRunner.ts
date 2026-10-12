/**
 * セル個別バッチOCR実行エンジン
 * Tesseract.js (PSM 6) を用いて、セルごとに改行を保持した高精度文字認識を実施
 */

import { createWorker } from 'tesseract.js';
import { GridCell } from './gridOcrParser';
import { STANDARD_PERIODS } from './timetablePresets';
import {
  extractCellCrops,
  CellCropInfo,
  formatCellText,
  GridAreaBounds,
  DEFAULT_GRID_BOUNDS,
} from './gridDetection';

export interface CellOcrProgress {
  status: string;
  progress: number; // 0〜1
  currentCell?: { row: number; col: number; total: number; current: number };
}

export interface CellBatchOcrOptions {
  hasHeaderRow?: boolean;
  hasHeaderCol?: boolean;
}

export interface CellBatchOcrResult {
  grid: GridCell[][];
  colHeaders: string[];
  rowHeaders: string[];
}

export async function runCellBatchOcr(
  imageBlob: Blob,
  colDividers: number[],
  rowDividers: number[],
  bounds: GridAreaBounds = DEFAULT_GRID_BOUNDS,
  options: CellBatchOcrOptions = {},
  onProgress?: (progress: CellOcrProgress) => void,
): Promise<CellBatchOcrResult> {
  const { hasHeaderRow = false, hasHeaderCol = false } = options;
  const rows = rowDividers.length + 1;
  const cols = colDividers.length + 1;
  const totalCells = rows * cols;

  onProgress?.({
    status: '表のセル画像を個別に切り出し中...',
    progress: 0.05,
  });

  // 1. 各セルの画像を切り出し（罫線除外 + 空白判定 + マージン除外）
  const cellGrid = await extractCellCrops(imageBlob, colDividers, rowDividers, bounds);

  // 空白でないセル数をカウント
  let cellsToRecognizeCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!cellGrid[r][c]?.isEmpty) {
        cellsToRecognizeCount++;
      }
    }
  }

  onProgress?.({
    status: `OCRエンジンを初期化中... (対象セル: ${cellsToRecognizeCount}/${totalCells})`,
    progress: 0.12,
  });

  // 2. Tesseract Worker の初期化 (日本語 + 英語)
  const worker = await createWorker('jpn+eng', 1);

  // 単一ブロック用 PSM 6 に設定
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6' as unknown as undefined,
    });
  } catch (e) {
    console.warn('Could not set PSM', e);
  }

  const rawTextGrid: string[][] = Array.from({ length: rows }, () => new Array(cols).fill(''));

  let processedCount = 0;

  try {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellInfo: CellCropInfo | undefined = cellGrid[r]?.[c];
        processedCount++;

        if (cellInfo && !cellInfo.isEmpty) {
          onProgress?.({
            status: `${processedCount}/${totalCells} マス目を解析中...`,
            progress: 0.15 + (processedCount / totalCells) * 0.8,
            currentCell: {
              row: r,
              col: c,
              total: totalCells,
              current: processedCount,
            },
          });

          try {
            const ret = await worker.recognize(cellInfo.blob);
            rawTextGrid[r][c] = ret.data.text.trim();
          } catch (err) {
            console.warn(`Error recognizing cell [${r}, ${c}]`, err);
            rawTextGrid[r][c] = '';
          }
        } else {
          onProgress?.({
            status: `${processedCount}/${totalCells} マス目をスキップ (空き枠)`,
            progress: 0.15 + (processedCount / totalCells) * 0.8,
          });
        }
      }
    }

    // 3. カラム名（列ヘッダー）の抽出
    const startR = hasHeaderRow && rows > 1 ? 1 : 0;
    const startC = hasHeaderCol && cols > 1 ? 1 : 0;
    const dataCols = cols - startC;

    const colHeaders: string[] = [];
    const WEEKDAYS = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];

    for (let c = startC; c < cols; c++) {
      const dataColIdx = c - startC;
      if (hasHeaderRow) {
        const headerRaw = rawTextGrid[0][c];
        const cleaned = formatCellText(headerRaw);
        if (cleaned) {
          colHeaders.push(cleaned.replace(/\s+/g, ' '));
        } else {
          colHeaders.push(
            dataCols <= 7 && dataColIdx < WEEKDAYS.length
              ? WEEKDAYS[dataColIdx]
              : `列 ${dataColIdx + 1}`,
          );
        }
      } else {
        colHeaders.push(
          dataCols <= 7 && dataColIdx < WEEKDAYS.length
            ? WEEKDAYS[dataColIdx]
            : `列 ${dataColIdx + 1}`,
        );
      }
    }

    // 4. インデックス名（行ヘッダー）の抽出
    const rowHeaders: string[] = [];
    for (let r = startR; r < rows; r++) {
      const dataRowIdx = r - startR;
      if (hasHeaderCol) {
        const headerRaw = rawTextGrid[r][0];
        const cleaned = formatCellText(headerRaw);
        if (cleaned) {
          rowHeaders.push(cleaned.replace(/\s+/g, ' '));
        } else {
          rowHeaders.push(`${dataRowIdx + 1}限`);
        }
      } else {
        rowHeaders.push(`${dataRowIdx + 1}限`);
      }
    }

    // 5. データセルグリッドの構築
    const resultGrid: GridCell[][] = [];

    for (let r = startR; r < rows; r++) {
      const rowCells: GridCell[] = [];
      const dataRowIdx = r - startR;
      const periodNum = dataRowIdx + 1;
      const periodDef = STANDARD_PERIODS[periodNum] || {
        startMinutes: (9 + dataRowIdx * 1.5) * 60,
        endMinutes: (10.5 + dataRowIdx * 1.5) * 60,
      };

      for (let c = startC; c < cols; c++) {
        const dataColIdx = c - startC;
        const cellText = rawTextGrid[r][c];
        const formatted = formatCellText(cellText);
        const title = formatted || '';
        const rawLines = formatted ? formatted.split('\n') : [];
        const roomOrNote =
          formatted && formatted.includes('\n') ? formatted.split('\n').slice(1).join('\n') : '';

        rowCells.push({
          dayIndex: dataColIdx,
          periodIndex: periodNum,
          text: formatted,
          rawLines,
          fullText: title,
          title,
          roomOrNote,
          startMinutes: periodDef.startMinutes,
          endMinutes: periodDef.endMinutes,
        });
      }

      resultGrid.push(rowCells);
    }

    onProgress?.({
      status: '時間割グリッドの構築完了！',
      progress: 1.0,
    });

    return {
      grid: resultGrid,
      colHeaders,
      rowHeaders,
    };
  } finally {
    await worker.terminate();
  }
}
