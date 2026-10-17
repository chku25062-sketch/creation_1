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
  onProgress?: (progress: CellOcrProgress) => void,
): Promise<CellBatchOcrResult> {
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

  // 単一ブロック用 PSM 6 & 不要な文字間スペースの保持を無効化
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6' as unknown as undefined,
      preserve_interword_spaces: '0' as unknown as undefined,
    });
  } catch (e) {
    console.warn('Could not set Tesseract parameters', e);
  }

  const resultGrid: GridCell[][] = [];
  let processedCount = 0;

  try {
    for (let r = 0; r < rows; r++) {
      const rowCells: GridCell[] = [];
      const periodNum = r + 1;
      const periodDef = STANDARD_PERIODS[periodNum] || {
        startMinutes: (9 + r * 1.5) * 60,
        endMinutes: (10.5 + r * 1.5) * 60,
      };

      for (let c = 0; c < cols; c++) {
        const cellInfo: CellCropInfo | undefined = cellGrid[r]?.[c];
        processedCount++;

        let cellText = '';

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
            // iOS Safari 等で Blob 転送が不安定なケースを防ぐため、dataUrl (Base64) を優先
            const inputSource = cellInfo.dataUrl || cellInfo.blob;
            const ret = await worker.recognize(inputSource);
            cellText = ret.data.text.trim();
          } catch (err) {
            console.warn(`Error recognizing cell [${r}, ${c}] with dataUrl, trying blob:`, err);
            try {
              const ret = await worker.recognize(cellInfo.blob);
              cellText = ret.data.text.trim();
            } catch (fallbackErr) {
              console.warn(`Fallback blob also failed for cell [${r}, ${c}]:`, fallbackErr);
              cellText = '';
            }
          }
        } else {
          onProgress?.({
            status: `${processedCount}/${totalCells} マス目をスキップ (空き枠)`,
            progress: 0.15 + (processedCount / totalCells) * 0.8,
          });
        }

        const formatted = formatCellText(cellText);
        const title = formatted || '';
        const rawLines = formatted ? formatted.split('\n') : [];
        const roomOrNote =
          formatted && formatted.includes('\n') ? formatted.split('\n').slice(1).join('\n') : '';

        rowCells.push({
          dayIndex: c,
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

    // デフォルトのスマート列名（5〜7列なら月曜〜、それ以外は列1〜）
    const WEEKDAYS = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];
    const colHeaders: string[] = Array.from({ length: cols }, (_, c) =>
      cols <= 7 && c < WEEKDAYS.length ? WEEKDAYS[c] : `列 ${c + 1}`,
    );

    // デフォルトの行名（1限〜）
    const rowHeaders: string[] = Array.from({ length: rows }, (_, r) => `${r + 1}限`);

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
