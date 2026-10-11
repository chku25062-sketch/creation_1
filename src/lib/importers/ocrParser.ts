import { createWorker } from 'tesseract.js';
import { ParsedScheduleItem } from '@/types';
import { parseTextSchedule } from './textParser';

export interface OcrProgress {
  status: string;
  progress: number; // 0〜1
}

export async function parseImageSchedule(
  imageFile: File | Blob,
  onProgress?: (progress: OcrProgress) => void,
): Promise<{ text: string; items: ParsedScheduleItem[] }> {
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
    onProgress?.({ status: '画像からテキストを読み取り中...', progress: 0.5 });
    const ret = await worker.recognize(imageFile);
    const rawText = ret.data.text;

    onProgress?.({ status: '時間割・スケジュール項目を抽出中...', progress: 0.95 });

    // 3. テキストからスケジュール項目を抽出
    const items = parseTextSchedule(rawText);

    onProgress?.({ status: '解析完了', progress: 1.0 });

    return {
      text: rawText,
      items,
    };
  } finally {
    // メモリリーク防止のため Worker を確実に終了
    await worker.terminate();
  }
}
