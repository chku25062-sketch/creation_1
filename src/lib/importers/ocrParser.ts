import { createWorker } from 'tesseract.js';
import { ParsedScheduleItem } from '@/types';
import { parseTextSchedule } from './textParser';
import { clusterWordsIntoGrid, GridCell, WordBBox, GridConfig } from './gridOcrParser';

export interface OcrProgress {
  status: string;
  progress: number; // 0〜1
}

export interface ImageOcrResult {
  text: string;
  items: ParsedScheduleItem[];
  grid?: GridCell[][];
  words?: WordBBox[];
}

export async function parseImageSchedule(
  imageFile: File | Blob,
  onProgress?: (progress: OcrProgress) => void,
  gridConfig?: Omit<GridConfig, 'tableWidth' | 'tableHeight'> & {
    width?: number;
    height?: number;
  },
): Promise<ImageOcrResult> {
  // 1. Tesseract Worker の初期化 (日本語 + 英語)
  onProgress?.({ status: 'OCRエンジンを準備中...', progress: 0.1 });

  const worker = await createWorker('jpn+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.({
          status: '文字・表レイアウトを解析中...',
          progress: 0.2 + (m.progress || 0) * 0.7,
        });
      }
    },
  });

  try {
    // 2. 文字認識の実行
    onProgress?.({ status: '画像からテキストと座標を読み取り中...', progress: 0.5 });
    const ret = await worker.recognize(imageFile);
    const rawText = ret.data.text;

    // 単語・行バウンディングボックスの型安全な抽出
    const pageData = ret.data as unknown as {
      words?: Array<{
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }>;
      lines?: Array<{
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        words?: Array<{
          text: string;
          bbox: { x0: number; y0: number; x1: number; y1: number };
        }>;
      }>;
    };

    let words: WordBBox[] = [];
    if (Array.isArray(pageData.words) && pageData.words.length > 0) {
      words = pageData.words.map((w) => ({
        text: w.text,
        bbox: {
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1,
        },
      }));
    } else if (Array.isArray(pageData.lines)) {
      pageData.lines.forEach((line) => {
        if (Array.isArray(line.words) && line.words.length > 0) {
          line.words.forEach((w) => {
            words.push({
              text: w.text,
              bbox: {
                x0: w.bbox.x0,
                y0: w.bbox.y0,
                x1: w.bbox.x1,
                y1: w.bbox.y1,
              },
            });
          });
        } else if (line.text && line.bbox) {
          words.push({
            text: line.text,
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1,
            },
          });
        }
      });
    }

    // 画像の幅・高さの推定
    const imgWidth =
      gridConfig?.width || words.reduce((max, w) => Math.max(max, w.bbox.x1), 0) || 800;
    const imgHeight =
      gridConfig?.height || words.reduce((max, w) => Math.max(max, w.bbox.y1), 0) || 800;

    // 3. グリッドクラスタリング（行・列・改行の復元）
    const columns = gridConfig?.columns || 5;
    const rows = gridConfig?.rows || 5;

    const grid = clusterWordsIntoGrid(words, {
      columns,
      rows,
      tableWidth: imgWidth,
      tableHeight: imgHeight,
    });

    onProgress?.({ status: '時間割・スケジュール項目を抽出中...', progress: 0.95 });

    // グリッドセルから ParsedScheduleItem を生成
    const gridItems: ParsedScheduleItem[] = [];
    grid.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell.title) {
          gridItems.push({
            id: `grid-${rIdx}-${cIdx}-${Date.now()}`,
            title: cell.title,
            type: 'fixed',
            startMinutes: cell.startMinutes,
            endMinutes: cell.endMinutes,
            durationMinutes: cell.endMinutes - cell.startMinutes,
            category: 'lecture',
            daysOfWeek: [cell.dayIndex],
          });
        }
      });
    });

    // テキスト形式でもフォールバック抽出
    const fallbackItems = parseTextSchedule(rawText);
    const items = gridItems.length > 0 ? gridItems : fallbackItems;

    onProgress?.({ status: '解析完了', progress: 1.0 });

    return {
      text: rawText,
      items,
      grid,
      words,
    };
  } finally {
    // メモリリーク防止のため Worker を確実に終了
    await worker.terminate();
  }
}
