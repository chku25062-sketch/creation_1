/**
 * 表画像からの罫線・グリッド自動検出およびセル画像切り出しユーティリティ
 */

export interface GridBoundaries {
  colDividers: number[]; // 各列の境界線 (0.0 < divider < 1.0) 昇順。要素数 = columns - 1
  rowDividers: number[]; // 各行の境界線 (0.0 < divider < 1.0) 昇順。要素数 = rows - 1
}

export interface GridAreaBounds {
  left: number; // 0.0 〜 1.0 (デフォルト 0)
  top: number; // 0.0 〜 1.0 (デフォルト 0)
  right: number; // 0.0 〜 1.0 (デフォルト 1.0)
  bottom: number; // 0.0 〜 1.0 (デフォルト 1.0)
}

export const DEFAULT_GRID_BOUNDS: GridAreaBounds = {
  left: 0,
  top: 0,
  right: 1.0,
  bottom: 1.0,
};

export interface CellCropInfo {
  row: number; // 0-indexed
  col: number; // 0-indexed
  blob: Blob;
  isEmpty: boolean; // 白ピクセルのみで文字が無い場合 true
  width: number;
  height: number;
}

/**
 * 画像BlobからHTMLImageElementを非同期ロード
 */
export async function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * 射影ヒストグラムのピークを検出し、指定数の等間隔グリッド線を近傍ピークにスナップ
 */
export function snapDividersToPeaks(
  projection: number[],
  count: number, // 分割線数 (columns - 1 または rows - 1)
  searchRadiusRatio = 0.08, // スナップを探索する範囲 (画像サイズの8%)
): number[] {
  const totalLen = projection.length;
  if (totalLen === 0 || count <= 0) return [];

  const idealStep = totalLen / (count + 1);
  const searchRadius = Math.max(2, Math.round(totalLen * searchRadiusRatio));

  const dividers: number[] = [];

  for (let i = 1; i <= count; i++) {
    const idealIdx = Math.round(i * idealStep);
    const minIdx = Math.max(0, idealIdx - searchRadius);
    const maxIdx = Math.min(totalLen - 1, idealIdx + searchRadius);

    // 探索範囲内で最も射影値（黒ピクセル密度）が高いインデックスを探索
    let peakIdx = idealIdx;
    let maxVal = -1;

    for (let idx = minIdx; idx <= maxIdx; idx++) {
      if (projection[idx] > maxVal) {
        maxVal = projection[idx];
        peakIdx = idx;
      }
    }

    // 周囲の平均より明らかにピークがある場合にスナップ
    const localAvg =
      projection.slice(minIdx, maxIdx + 1).reduce((sum, v) => sum + v, 0) /
      Math.max(1, maxIdx - minIdx + 1);

    const chosenIdx = maxVal > localAvg * 1.3 ? peakIdx : idealIdx;
    dividers.push(Math.max(0.01, Math.min(0.99, chosenIdx / totalLen)));
  }

  // 昇順にソート & 最小間隔の保証
  dividers.sort((a, b) => a - b);
  return dividers;
}

export interface MorphologicalProjections {
  horizProjection: number[];
  vertProjection: number[];
  hasLines: boolean;
}

/**
 * 形態素演算（モルフォロジー線分フィルター: Opening処理）により、
 * 文字やノイズを除去して連続した罫線のみの射影ヒストグラムを抽出
 */
export function extractMorphologicalLineProjections(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bounds: GridAreaBounds = DEFAULT_GRID_BOUNDS,
  brightnessThreshold = 160,
): MorphologicalProjections {
  const minX = Math.max(0, Math.min(width - 1, Math.round(bounds.left * width)));
  const maxX = Math.max(0, Math.min(width, Math.round(bounds.right * width)));
  const minY = Math.max(0, Math.min(height - 1, Math.round(bounds.top * height)));
  const maxY = Math.max(0, Math.min(height, Math.round(bounds.bottom * height)));

  const regionW = Math.max(1, maxX - minX);
  const regionH = Math.max(1, maxY - minY);

  // 二値化バッファ (1: 黒/線/文字, 0: 白/背景)
  const binary = new Uint8Array(width * height);
  for (let y = minY; y < maxY; y++) {
    const rowOffset = y * width;
    for (let x = minX; x < maxX; x++) {
      const idx = (rowOffset + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      if (brightness < brightnessThreshold) {
        binary[rowOffset + x] = 1;
      }
    }
  }

  // 1. 水平罫線オープニング (横長カーネルで文字横画を除去)
  // カーネル長: 対象幅の約 3.5% (最低 10px、最大 50px)
  const kernelH = Math.max(10, Math.min(50, Math.round(regionW * 0.035)));
  const horizMask = new Uint8Array(width * height);

  for (let y = minY; y < maxY; y++) {
    const rowOffset = y * width;
    let runLength = 0;
    for (let x = minX; x < maxX; x++) {
      if (binary[rowOffset + x] === 1) {
        runLength++;
        if (runLength >= kernelH) {
          for (let k = 0; k < kernelH; k++) {
            horizMask[rowOffset + (x - k)] = 1;
          }
        }
      } else {
        runLength = 0;
      }
    }
  }

  // 2. 垂直罫線オープニング (縦長カーネルで文字縦画を除去)
  // カーネル長: 対象高さの約 3.5% (最低 10px、最大 50px)
  const kernelV = Math.max(10, Math.min(50, Math.round(regionH * 0.035)));
  const vertMask = new Uint8Array(width * height);

  for (let x = minX; x < maxX; x++) {
    let runLength = 0;
    for (let y = minY; y < maxY; y++) {
      const idx = y * width + x;
      if (binary[idx] === 1) {
        runLength++;
        if (runLength >= kernelV) {
          for (let k = 0; k < kernelV; k++) {
            vertMask[(y - k) * width + x] = 1;
          }
        }
      } else {
        runLength = 0;
      }
    }
  }

  // 射影ヒストグラムの集計
  const horizProjection = new Array(height).fill(0);
  const vertProjection = new Array(width).fill(0);

  let horizLinePixels = 0;
  let vertLinePixels = 0;

  for (let y = minY; y < maxY; y++) {
    let count = 0;
    const rowOffset = y * width;
    for (let x = minX; x < maxX; x++) {
      if (horizMask[rowOffset + x] === 1) {
        count++;
      }
    }
    horizProjection[y] = count;
    horizLinePixels += count;
  }

  for (let x = minX; x < maxX; x++) {
    let count = 0;
    for (let y = minY; y < maxY; y++) {
      if (vertMask[y * width + x] === 1) {
        count++;
      }
    }
    vertProjection[x] = count;
    vertLinePixels += count;
  }

  // 線分が充分検出されているか判定
  const hasLines = horizLinePixels >= kernelH * 2 && vertLinePixels >= kernelV * 2;

  return {
    horizProjection,
    vertProjection,
    hasLines,
  };
}

/**
 * 検出された罫線ピッチ（周期）を解析し、薄れや点線等で欠落した中間分割線を等間隔補間
 */
export function interpolateMissingDividers(
  peaks: number[],
  minBound = 0.0,
  maxBound = 1.0,
): number[] {
  if (peaks.length === 0) return [];

  const allPoints = [minBound, ...peaks, maxBound];
  const intervals: number[] = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    intervals.push(allPoints[i + 1] - allPoints[i]);
  }

  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const median = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

  if (median <= 0.01) return peaks;

  const result: number[] = [];

  for (let i = 0; i < allPoints.length - 1; i++) {
    const start = allPoints[i];
    const end = allPoints[i + 1];
    const diff = end - start;

    if (i > 0) {
      result.push(start);
    }

    // 間隔が中央値の約1.7倍〜2.4倍ある場合、中間1本を補間
    if (diff >= median * 1.7 && diff <= median * 2.4) {
      result.push(Math.round(((start + end) / 2) * 1000) / 1000);
    } else if (diff > median * 2.4 && diff <= median * 3.4) {
      // 2本補間
      result.push(Math.round((start + diff / 3) * 1000) / 1000);
      result.push(Math.round((start + (diff * 2) / 3) * 1000) / 1000);
    }
  }

  result.sort((a, b) => a - b);
  return result;
}

/**
 * 画像から水平・垂直の罫線を射影ヒストグラムにより自動検出
 */
export async function detectGridDividers(
  imageBlob: Blob,
  columns: number,
  rows: number,
  bounds: GridAreaBounds = DEFAULT_GRID_BOUNDS,
): Promise<GridBoundaries> {
  const img = await loadImageElement(imageBlob);
  const w = img.naturalWidth || 800;
  const h = img.naturalHeight || 800;

  // 計算負荷軽減のため最大幅/高さ 600px 程度にリサイズして解析
  const scale = Math.min(1.0, 600 / Math.max(w, h));
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    // Canvas が取得できない場合は等間隔分割
    return getDefaultDividers(columns, rows, bounds);
  }

  ctx.drawImage(img, 0, 0, sw, sh);
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // モルフォロジー線分抽出を優先（文字ノイズ除去）
  const morph = extractMorphologicalLineProjections(data, sw, sh, bounds);

  let horizProjection: number[];
  let vertProjection: number[];

  if (morph.hasLines) {
    horizProjection = morph.horizProjection;
    vertProjection = morph.vertProjection;
  } else {
    // フォールバック: 全黒画素の集計
    horizProjection = new Array(sh).fill(0);
    vertProjection = new Array(sw).fill(0);

    const minX = Math.round(bounds.left * sw);
    const maxX = Math.round(bounds.right * sw);
    const minY = Math.round(bounds.top * sh);
    const maxY = Math.round(bounds.bottom * sh);

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const idx = (y * sw + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (brightness < 150) {
          horizProjection[y]++;
          vertProjection[x]++;
        }
      }
    }
  }

  const colDividers = snapDividersToPeaks(vertProjection, columns - 1);
  const rowDividers = snapDividersToPeaks(horizProjection, rows - 1);

  // もし検出結果が枠外に出ている場合はデフォルト分割をフォールバック
  const validCols =
    colDividers.length === columns - 1 &&
    colDividers.every((d) => d > bounds.left && d < bounds.right);
  const validRows =
    rowDividers.length === rows - 1 &&
    rowDividers.every((d) => d > bounds.top && d < bounds.bottom);

  if (!validCols || !validRows) {
    return getDefaultDividers(columns, rows, bounds);
  }

  return {
    colDividers,
    rowDividers,
  };
}

/**
 * 射影ヒストグラムから顕著な局所ピーク（罫線）を探索
 */
export function findProminentPeaks(
  projection: number[],
  minDistanceRatio = 0.04,
  prominenceFactor = 1.25,
): number[] {
  const len = projection.length;
  if (len === 0) return [];

  const avg = projection.reduce((a, b) => a + b, 0) / len;
  const threshold = Math.max(10, avg * prominenceFactor);
  const minDistance = Math.max(3, Math.round(len * minDistanceRatio));

  const rawPeaks: { idx: number; val: number }[] = [];

  for (let i = 1; i < len - 1; i++) {
    const val = projection[i];
    if (val > threshold && val >= projection[i - 1] && val >= projection[i + 1]) {
      rawPeaks.push({ idx: i, val });
    }
  }

  rawPeaks.sort((a, b) => b.val - a.val);
  const filteredPeaks: number[] = [];

  for (const p of rawPeaks) {
    const isClose = filteredPeaks.some((existing) => Math.abs(existing - p.idx) < minDistance);
    if (!isClose) {
      filteredPeaks.push(p.idx);
    }
  }

  filteredPeaks.sort((a, b) => a - b);
  return filteredPeaks.map((idx) => Math.round((idx / len) * 1000) / 1000);
}

export interface DetectedTableStructure {
  columns: number;
  rows: number;
  colDividers: number[];
  rowDividers: number[];
}

/**
 * 画像内の罫線から、表の列数・行数・分割線を完全自動推定
 */
export async function autoDetectTableStructure(
  imageBlob: Blob,
  bounds: GridAreaBounds = DEFAULT_GRID_BOUNDS,
): Promise<DetectedTableStructure> {
  const img = await loadImageElement(imageBlob);
  const w = img.naturalWidth || 800;
  const h = img.naturalHeight || 800;

  const scale = Math.min(1.0, 600 / Math.max(w, h));
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return {
      columns: 5,
      rows: 5,
      ...getDefaultDividers(5, 5, bounds),
    };
  }

  ctx.drawImage(img, 0, 0, sw, sh);
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // モルフォロジー線分抽出を優先（文字誤認の防止）
  const morph = extractMorphologicalLineProjections(data, sw, sh, bounds);

  let horizProjection: number[];
  let vertProjection: number[];

  const minX = Math.round(bounds.left * sw);
  const maxX = Math.round(bounds.right * sw);
  const minY = Math.round(bounds.top * sh);
  const maxY = Math.round(bounds.bottom * sh);

  if (morph.hasLines) {
    horizProjection = morph.horizProjection;
    vertProjection = morph.vertProjection;
  } else {
    // 罫線が取れない場合は全暗色ピクセル集計にフォールバック
    horizProjection = new Array(sh).fill(0);
    vertProjection = new Array(sw).fill(0);

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const idx = (y * sw + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (brightness < 150) {
          horizProjection[y]++;
          vertProjection[x]++;
        }
      }
    }
  }

  const subVert = vertProjection.slice(minX, maxX);
  const subHoriz = horizProjection.slice(minY, maxY);

  const rawVertPeaks = findProminentPeaks(subVert, 0.04, 1.25);
  const rawHorizPeaks = findProminentPeaks(subHoriz, 0.04, 1.25);

  // 端（4%以内）の外枠罫線を除外し、bounds 内の内部区切り線を算出
  const widthRatio = bounds.right - bounds.left;
  const heightRatio = bounds.bottom - bounds.top;

  let innerVertPeaks = rawVertPeaks
    .filter((p) => p > 0.04 && p < 0.96)
    .map((p) => bounds.left + p * widthRatio);

  let innerHorizPeaks = rawHorizPeaks
    .filter((p) => p > 0.04 && p < 0.96)
    .map((p) => bounds.top + p * heightRatio);

  // 欠落した罫線の等間隔補間（ハイブリッド補正）
  innerVertPeaks = interpolateMissingDividers(innerVertPeaks, bounds.left, bounds.right);
  innerHorizPeaks = interpolateMissingDividers(innerHorizPeaks, bounds.top, bounds.bottom);

  // 検出された区切り線が1〜14本なら採用、無ければ標準5
  const columns =
    innerVertPeaks.length >= 1 && innerVertPeaks.length <= 14 ? innerVertPeaks.length + 1 : 5;
  const rows =
    innerHorizPeaks.length >= 1 && innerHorizPeaks.length <= 19 ? innerHorizPeaks.length + 1 : 5;

  let colDividers = innerVertPeaks;
  let rowDividers = innerHorizPeaks;

  if (colDividers.length !== columns - 1) {
    colDividers = getDefaultDividers(columns, rows, bounds).colDividers;
  }
  if (rowDividers.length !== rows - 1) {
    rowDividers = getDefaultDividers(columns, rows, bounds).rowDividers;
  }

  return {
    columns,
    rows,
    colDividers,
    rowDividers,
  };
}

/**
 * 等間隔のデフォルト分割線を生成
 */
export function getDefaultDividers(
  columns: number,
  rows: number,
  bounds: GridAreaBounds = DEFAULT_GRID_BOUNDS,
): GridBoundaries {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;

  const colDividers: number[] = [];
  for (let i = 1; i < columns; i++) {
    colDividers.push(bounds.left + (width * i) / columns);
  }

  const rowDividers: number[] = [];
  for (let i = 1; i < rows; i++) {
    rowDividers.push(bounds.top + (height * i) / rows);
  }

  return { colDividers, rowDividers };
}

/**
 * 分割線から各セル（[row][col]）の矩形座標（比率 0〜1）を計算
 */
export function calculateCellRects(
  colDividers: number[],
  rowDividers: number[],
  bounds: GridAreaBounds = DEFAULT_GRID_BOUNDS,
): Array<Array<{ x: number; y: number; w: number; h: number }>> {
  const fullCols = [bounds.left, ...colDividers, bounds.right];
  const fullRows = [bounds.top, ...rowDividers, bounds.bottom];

  const gridRects: Array<Array<{ x: number; y: number; w: number; h: number }>> = [];

  for (let r = 0; r < fullRows.length - 1; r++) {
    const rowRects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const top = fullRows[r];
    const bottom = fullRows[r + 1];
    const height = Math.max(0.01, bottom - top);

    for (let c = 0; c < fullCols.length - 1; c++) {
      const left = fullCols[c];
      const right = fullCols[c + 1];
      const width = Math.max(0.01, right - left);

      rowRects.push({
        x: left,
        y: top,
        w: width,
        h: height,
      });
    }
    gridRects.push(rowRects);
  }

  return gridRects;
}

/**
 * 指定グリッドに基づいて画像から各セルを切り出し（罫線除外パディング付き）
 */
export async function extractCellCrops(
  imageBlob: Blob,
  colDividers: number[],
  rowDividers: number[],
  bounds: GridAreaBounds = DEFAULT_GRID_BOUNDS,
  paddingRatio = 0.04, // 罫線を除去するための内側マージン (4%)
): Promise<CellCropInfo[][]> {
  const img = await loadImageElement(imageBlob);
  const nw = img.naturalWidth || 800;
  const nh = img.naturalHeight || 800;

  const rects = calculateCellRects(colDividers, rowDividers, bounds);
  const rows = rects.length;
  const cols = rects[0]?.length || 0;

  const result: CellCropInfo[][] = [];

  for (let r = 0; r < rows; r++) {
    const rowResults: CellCropInfo[] = [];

    for (let c = 0; c < cols; c++) {
      const rect = rects[r][c];

      // パディングを適用して罫線を切り落とす
      const padX = rect.w * paddingRatio;
      const padY = rect.h * paddingRatio;

      const innerX = Math.round((rect.x + padX) * nw);
      const innerY = Math.round((rect.y + padY) * nh);
      const innerW = Math.max(10, Math.round((rect.w - padX * 2) * nw));
      const innerH = Math.max(10, Math.round((rect.h - padY * 2) * nh));

      const canvas = document.createElement('canvas');
      canvas.width = innerW;
      canvas.height = innerH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        continue;
      }

      ctx.drawImage(img, innerX, innerY, innerW, innerH, 0, 0, innerW, innerH);

      // コントラスト強調 & 空白セル判定 (暗いピクセル比率チェック)
      const imgData = ctx.getImageData(0, 0, innerW, innerH);
      const d = imgData.data;
      let darkPixelCount = 0;

      for (let i = 0; i < d.length; i += 4) {
        const brightness = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (brightness < 160) {
          darkPixelCount++;
        }
        // コントラスト伸長
        const val = brightness > 140 ? 255 : brightness < 90 ? 0 : brightness;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);

      const totalPixels = innerW * innerH;
      // 暗いピクセルが全体の 0.6% 未満なら空白コマ（文字なし）と判定
      const isEmpty = darkPixelCount / totalPixels < 0.006;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || imageBlob), 'image/png');
      });

      rowResults.push({
        row: r,
        col: c,
        blob,
        isEmpty,
        width: innerW,
        height: innerH,
      });
    }

    result.push(rowResults);
  }

  return result;
}

/**
 * セル内テキストから混入した行名（時限番号・時刻）や列名（曜日名）のアーティファクトを除去
 */
export function cleanHeaderArtifacts(text: string): string | null {
  if (!text) return null;

  // 曜日表記: 月, 火, 水, 木, 金, 土, 日, 月曜, (月), Mon, Tue 等
  const dayHeaderFullRegex =
    /^(?:[月火水木金土日](?:曜(?:日)?)?|\([月火水木金土日]\)|mon|tue|wed|thu|fri|sat|sun)(?:[\s\u3000]+|$)/i;
  // 時限表記: 1限, 2限, 第1限, 10:40-12:10 等
  const periodHeaderFullRegex =
    /^(?:第?\d{1,2}限|\d{1,2}:\d{2}\s*[-~〜]\s*\d{1,2}:\d{2})(?:[\s\u3000]+|$)/i;
  // 単独の数字のみ（「1」や「2」が独立している行）
  const singleDigitOnlyRegex = /^\d{1,2}$/;

  const lines = text.split('\n');
  const cleanedLines: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (line === '') {
      cleanedLines.push('');
      continue;
    }

    // 1. 行全体が単なる曜日や時限・時刻ヘッダーそのものの場合 -> 行ごと除外
    if (
      /^(?:[月火水木金土日](?:曜(?:日)?)?|\([月火水木金土日]\)|mon|tue|wed|thu|fri|sat|sun)$/i.test(
        line,
      ) ||
      /^(?:第?\d{1,2}限|\d{1,2}:\d{2}\s*[-~〜]\s*\d{1,2}:\d{2})$/i.test(line) ||
      singleDigitOnlyRegex.test(line) ||
      /^(?:時限|時間|曜日)$/.test(line)
    ) {
      continue;
    }

    // 2. 行頭に曜日ヘッダーが付着している場合（例: "月 英語I", "月曜 線形代数"） -> 先頭の曜日を除去
    line = line.replace(dayHeaderFullRegex, '').trim();

    // 3. 行頭に時限ヘッダーが付着している場合（例: "1限 英語I", "第1限 基礎数学"） -> 先頭の時限を除去
    line = line.replace(periodHeaderFullRegex, '').trim();

    // 4. 行頭に「1 英語」のように単独数字と空白が付着している場合 -> 先頭の数字を除去
    line = line.replace(/^\d{1,2}[\s\u3000]+/, '').trim();

    if (line.length > 0) {
      cleanedLines.push(line);
    }
  }

  if (cleanedLines.length === 0) {
    return null;
  }

  return cleanedLines.join('\n');
}

/**
 * セル内テキストの整形・正規化ルール:
 * - 混入した曜日名・時限名などのヘッダーを自動除去
 * - 単一改行（\n）: 同一要素内の折り返しとみなし、半角スペースで連結
 * - 空行（\n\n以上）: 明確な段落・区切りとみなし、改行として保持
 * - ノイズ記号（ハイフンや縦線のみの行）は除去
 * - 空マス・文字なしの場合は null を返却
 */
export function formatCellText(rawText: string): string | null {
  if (!rawText) return null;

  // 1. 混入ヘッダー（曜日・時限・時刻）のクレンジング
  const cleaned = cleanHeaderArtifacts(rawText);
  if (!cleaned) return null;

  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .map((l) => (/^[-—_|•・=~+*#/\\]+$/.test(l) ? '' : l));

  const paragraphs: string[][] = [];
  let currentParagraph: string[] = [];

  for (const line of lines) {
    if (line === '') {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      }
    } else {
      currentParagraph.push(line);
    }
  }
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  if (paragraphs.length === 0) {
    return null;
  }

  const formattedParagraphs = paragraphs
    .map((pLines) => pLines.join(' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);

  if (formattedParagraphs.length === 0) {
    return null;
  }

  return formattedParagraphs.join('\n');
}

/**
 * 2次元CSVマトリックス型 (行 x 列)
 * 空白コマは null
 */
export type TimetableCsvMatrix = (string | null)[][];

/**
 * マトリックスをCSVテキストに変換
 */
export function matrixToCsv(
  matrix: TimetableCsvMatrix,
  headers: string[] = ['月', '火', '水', '木', '金'],
  rowLabels?: string[],
): string {
  const rows: string[] = [];
  rows.push(['行 / 列', ...headers].join(','));

  matrix.forEach((row, rIdx) => {
    const periodLabel = rowLabels?.[rIdx] || `${rIdx + 1}限`;
    const escapedCells = row.map((cell) => {
      if (cell === null) return '';
      // カンマや改行、ダブルクォートを含む場合はダブルクォートでエスケープ
      if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    rows.push([periodLabel, ...escapedCells].join(','));
  });

  return rows.join('\n');
}
