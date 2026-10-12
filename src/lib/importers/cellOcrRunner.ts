/**
 * セル個別バッチOCR実行エンジン
 * Tesseract.js (PSM 6) を用いて、セルごとに改行を保持した高精度文字認識を実施
 */

import { createWorker } from 'tesseract.js';
import { GridCell } from './gridOcrParser';
import { STANDARD_PERIODS } from './timetablePresets';
import { extractCellCrops, CellCropInfo, formatCellText } from './gridDetection';

export interface CellOcrProgress {
  status: string;
  progress: number; // 0〜1
  currentCell?: { row: number; col: number; total: number; current: number };
}

export async function runCellBatchOcr(
  imageBlob: Blob,
  colDividers: number[],
  rowDividers: number[],
  onProgress?: (progress: CellOcrProgress) => void,
): Promise<GridCell[][]> {
  const rows = rowDividers.length + 1;
  const cols = colDividers.length + 1;
  const totalCells = rows * cols;

  onProgress?.({
    status: '表のセル画像を個別に切り出し中...',
    progress: 0.05,
  });

  // 1. 各セルの画像を切り出し（罫線除外 + 空白判定）
  const cellGrid = await extractCellCrops(imageBlob, colDividers, rowDividers);

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

  // 単一ブロック用 PSM 6 に設定 (表全体のレイアウト解析による混乱を完全に防ぐ)
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6' as unknown as undefined, // PSM 6: 単一の均一なテキストブロック
    });
  } catch (e) {
    console.warn('Could not set PSM', e);
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

        let cellText = '';
        processedCount++;

        // 空白セルは一瞬でスキップ
        if (cellInfo && !cellInfo.isEmpty) {
          onProgress?.({
            status: `${processedCount}/${totalCells} コマ目を解析中...`,
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
            cellText = ret.data.text.trim();
          } catch (err) {
            console.warn(`Error recognizing cell [${r}, ${c}]`, err);
            cellText = '';
          }
        } else {
          onProgress?.({
            status: `${processedCount}/${totalCells} コマ目をスキップ (空きコマ)`,
            progress: 0.15 + (processedCount / totalCells) * 0.8,
          });
        }

        // セルテキストの整形:
        // - 単一改行はスペースで連結（1つのまとまった要素）
        // - 空行（\n\n）は改行として保持
        // - 空白・ノイズは null
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

    onProgress?.({
      status: '時間割グリッドの構築完了！',
      progress: 1.0,
    });

    return resultGrid;
  } finally {
    await worker.terminate();
  }
}
