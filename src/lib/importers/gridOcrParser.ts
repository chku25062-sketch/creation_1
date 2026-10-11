import { STANDARD_PERIODS } from './timetablePresets';

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface WordBBox {
  text: string;
  bbox: BoundingBox;
}

export interface GridCell {
  dayIndex: number; // 0:月, 1:火, 2:水, 3:木, 4:金, 5:土
  periodIndex: number; // 1: 1限, 2: 2限, ...
  rawLines: string[]; // 改行ごとのテキスト
  fullText: string; // 改行で結合されたセル内テキスト
  title: string; // 1行目（講義名）
  roomOrNote: string; // 2行目以降（教室・備考）
  startMinutes: number;
  endMinutes: number;
}

export interface GridConfig {
  columns: number; // 5 (月〜金) または 6 (月〜土)
  rows: number; // 4〜6 (コマ数)
  tableWidth: number;
  tableHeight: number;
}

/**
 * 単語・行のバウンディングボックス群から、曜日列 × 時限行の2次元グリッド表データを再構築
 */
export function clusterWordsIntoGrid(words: WordBBox[], config: GridConfig): GridCell[][] {
  const { columns, rows, tableWidth, tableHeight } = config;

  // 各セルの単語バケットを初期化 (rows x columns)
  const cellWords: WordBBox[][][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => []),
  );

  const colWidth = tableWidth / columns;
  const rowHeight = tableHeight / rows;

  // 各単語の中心座標を計算し、どのセル (row, col) に属するか判定
  for (const item of words) {
    const text = item.text.trim();
    if (!text) continue;

    const centerX = (item.bbox.x0 + item.bbox.x1) / 2;
    const centerY = (item.bbox.y0 + item.bbox.y1) / 2;

    const colIndex = Math.min(columns - 1, Math.max(0, Math.floor(centerX / colWidth)));
    const rowIndex = Math.min(rows - 1, Math.max(0, Math.floor(centerY / rowHeight)));

    cellWords[rowIndex][colIndex].push(item);
  }

  // 各セル内の単語を Y座標順（上から下）にソートし、同一行の単語は X座標順に結合して改行を復元
  const grid: GridCell[][] = [];

  for (let r = 0; r < rows; r++) {
    const periodNum = r + 1;
    const periodDef = STANDARD_PERIODS[periodNum] || {
      startMinutes: (9 + r * 1.5) * 60,
      endMinutes: (10.5 + r * 1.5) * 60,
    };

    const rowCells: GridCell[] = [];

    for (let c = 0; c < columns; c++) {
      const wordsInCell = cellWords[r][c];

      // Y座標でソート
      wordsInCell.sort((a, b) => {
        // Y座標がほぼ同じ（差が小さい）なら X座標順
        const yDiff = a.bbox.y0 - b.bbox.y0;
        if (Math.abs(yDiff) < 12) {
          return a.bbox.x0 - b.bbox.x0;
        }
        return yDiff;
      });

      // 行（改行）の推定: Y座標が一定以上離れている場合は新しい行とする
      const lines: string[] = [];
      let currentLineWords: string[] = [];
      let lastY = -1;

      for (const w of wordsInCell) {
        if (lastY === -1) {
          currentLineWords.push(w.text);
          lastY = (w.bbox.y0 + w.bbox.y1) / 2;
        } else {
          const currentY = (w.bbox.y0 + w.bbox.y1) / 2;
          if (Math.abs(currentY - lastY) > 14) {
            // 改行
            lines.push(currentLineWords.join(' '));
            currentLineWords = [w.text];
            lastY = currentY;
          } else {
            currentLineWords.push(w.text);
          }
        }
      }

      if (currentLineWords.length > 0) {
        lines.push(currentLineWords.join(' '));
      }

      const fullText = lines.join('\n').trim();
      const title = lines.length > 0 ? lines[0].trim() : '';
      const roomOrNote = lines.slice(1).join('\n').trim();

      rowCells.push({
        dayIndex: c,
        periodIndex: periodNum,
        rawLines: lines,
        fullText,
        title,
        roomOrNote,
        startMinutes: periodDef.startMinutes,
        endMinutes: periodDef.endMinutes,
      });
    }

    grid.push(rowCells);
  }

  return grid;
}
