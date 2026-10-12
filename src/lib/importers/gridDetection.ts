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

export interface TableBoundingBox {
  x: number; // 0.0 〜 1.0 (left ratio)
  y: number; // 0.0 〜 1.0 (top ratio)
  w: number; // 0.0 〜 1.0 (width ratio)
  h: number; // 0.0 〜 1.0 (height ratio)
  hasDetected: boolean;
}

export interface SnapGuidelines {
  verticalLines: number[]; // 昇順の比率 (0.0 〜 1.0)
  horizontalLines: number[]; // 昇順の比率 (0.0 〜 1.0)
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
 * ※ 外枠との余白（端の間隔）は補間せず、内部セル間隔のみを安全に補正
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

  // 全間隔から中央値を算出
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const median = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

  if (median <= 0.02) return peaks;

  const result: number[] = [];

  for (let i = 0; i < allPoints.length - 1; i++) {
    const start = allPoints[i];
    const end = allPoints[i + 1];
    const diff = end - start;

    if (i > 0) {
      result.push(start);
    }

    // 外枠（最初と最後）の間隔は余白の可能性があるため補間しない
    const isOuterGap = i === 0 || i === allPoints.length - 2;
    if (!isOuterGap) {
      // 内部間隔が中央値の約1.8倍〜2.3倍ある場合のみ、中間1本を厳格に補間
      if (diff >= median * 1.8 && diff <= median * 2.3) {
        result.push(Math.round(((start + end) / 2) * 1000) / 1000);
      }
    }
  }

  result.sort((a, b) => a - b);
  return result;
}

export interface DirectionalProjections {
  vertProjection: number[];
  horizProjection: number[];
}

/**
 * 水平・垂直の方向性エッジ勾配（Sobel様差分フィルター）により、
 * 背景色や文字に左右されず、本物の罫線エッジを安定して抽出
 */
export function extractDirectionalEdgeProjections(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bounds: GridAreaBounds = DEFAULT_GRID_BOUNDS,
): DirectionalProjections {
  const minX = Math.max(1, Math.min(width - 2, Math.round(bounds.left * width)));
  const maxX = Math.max(2, Math.min(width - 1, Math.round(bounds.right * width)));
  const minY = Math.max(1, Math.min(height - 2, Math.round(bounds.top * height)));
  const maxY = Math.max(2, Math.min(height - 1, Math.round(bounds.bottom * height)));

  const luminance = new Float32Array(width * height);
  for (let y = minY - 1; y <= maxY + 1; y++) {
    const rowOffset = y * width;
    for (let x = minX - 1; x <= maxX + 1; x++) {
      const idx = (rowOffset + x) * 4;
      luminance[rowOffset + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  const vertProjection = new Array(width).fill(0);
  const horizProjection = new Array(height).fill(0);

  // 垂直罫線 (X軸方向): 水平輝度差分 |L(x+1) - L(x-1)|
  for (let x = minX; x < maxX; x++) {
    let edgeSum = 0;
    for (let y = minY; y < maxY; y++) {
      const rowOffset = y * width;
      const dx = Math.abs(luminance[rowOffset + x + 1] - luminance[rowOffset + x - 1]);
      const isDark = luminance[rowOffset + x] < 180 ? 1 : 0;
      edgeSum += dx + isDark * 15;
    }
    vertProjection[x] = edgeSum;
  }

  // 水平罫線 (Y軸方向): 垂直輝度差分 |L(y+1) - L(y-1)|
  for (let y = minY; y < maxY; y++) {
    let edgeSum = 0;
    const prevRow = (y - 1) * width;
    const nextRow = (y + 1) * width;
    const curRow = y * width;
    for (let x = minX; x < maxX; x++) {
      const dy = Math.abs(luminance[nextRow + x] - luminance[prevRow + x]);
      const isDark = luminance[curRow + x] < 180 ? 1 : 0;
      edgeSum += dy + isDark * 15;
    }
    horizProjection[y] = edgeSum;
  }

  const smooth = (arr: number[], radius = 2) => {
    const res = new Array(arr.length).fill(0);
    for (let i = 0; i < arr.length; i++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const idx = i + k;
        if (idx >= 0 && idx < arr.length) {
          sum += arr[idx];
          count++;
        }
      }
      res[i] = count > 0 ? sum / count : 0;
    }
    return res;
  };

  return {
    vertProjection: smooth(vertProjection),
    horizProjection: smooth(horizProjection),
  };
}

/**
 * 垂直・水平のエッジ射影プロファイルからデータマス本体の矩形領域を算出
 * - 見出し行（曜日）やインデックス列（時限）の存在を検知し、データマス本体のみを自動で囲む
 */
export function findDataTableBoundsFromProjections(
  vertProjection: number[],
  horizProjection: number[],
  width: number,
  height: number,
): TableBoundingBox {
  const avgV =
    vertProjection.length > 0
      ? vertProjection.reduce((a, b) => a + b, 0) / vertProjection.length
      : 1;
  const vPeaks: number[] = [];
  const vRadius = Math.max(2, Math.round(width * 0.015));

  for (let x = vRadius; x < width - vRadius; x++) {
    if (vertProjection[x] > avgV * 1.25) {
      let isPeak = true;
      for (let k = -vRadius; k <= vRadius; k++) {
        if (k !== 0 && vertProjection[x + k] > vertProjection[x]) {
          isPeak = false;
          break;
        }
      }
      if (isPeak) {
        vPeaks.push(x);
      }
    }
  }

  const avgH =
    horizProjection.length > 0
      ? horizProjection.reduce((a, b) => a + b, 0) / horizProjection.length
      : 1;
  const hPeaks: number[] = [];
  const hRadius = Math.max(2, Math.round(height * 0.015));

  for (let y = hRadius; y < height - hRadius; y++) {
    if (horizProjection[y] > avgH * 1.25) {
      let isPeak = true;
      for (let k = -hRadius; k <= hRadius; k++) {
        if (k !== 0 && horizProjection[y + k] > horizProjection[y]) {
          isPeak = false;
          break;
        }
      }
      if (isPeak) {
        hPeaks.push(y);
      }
    }
  }

  if (vPeaks.length < 3 || hPeaks.length < 3) {
    return { x: 0.05, y: 0.05, w: 0.9, h: 0.9, hasDetected: false };
  }

  let leftPx = vPeaks[0];
  const rightPx = vPeaks[vPeaks.length - 1];

  const vIntervals: number[] = [];
  for (let i = 0; i < vPeaks.length - 1; i++) {
    vIntervals.push(vPeaks[i + 1] - vPeaks[i]);
  }
  const sortedVIntervals = [...vIntervals].sort((a, b) => a - b);
  const medianColW = sortedVIntervals[Math.floor(sortedVIntervals.length / 2)] || 50;

  // 最初の列が狭い場合はインデックス列とみなし、2本目の罫線から開始
  if (vIntervals.length >= 3 && vIntervals[0] < medianColW * 0.65) {
    leftPx = vPeaks[1];
  }

  let topPx = hPeaks[0];
  const bottomPx = hPeaks[hPeaks.length - 1];

  const hIntervals: number[] = [];
  for (let i = 0; i < hPeaks.length - 1; i++) {
    hIntervals.push(hPeaks[i + 1] - hPeaks[i]);
  }
  const sortedHIntervals = [...hIntervals].sort((a, b) => a - b);
  const medianRowH = sortedHIntervals[Math.floor(sortedHIntervals.length / 2)] || 40;

  // 最初の一行が低い場合は見出し行とみなし、2本目の罫線から開始
  if (hIntervals.length >= 3 && hIntervals[0] < medianRowH * 0.7) {
    topPx = hPeaks[1];
  }

  // 端近傍（幅・高さの3.5%以内）にあるピークは完全な画像の端 (0.0 または 1.0) にスナップ
  const normLeft = leftPx <= width * 0.035 ? 0.0 : Math.max(0.0, leftPx / width);
  const normRight = rightPx >= width * 0.965 ? 1.0 : Math.min(1.0, rightPx / width);
  const normTop = topPx <= height * 0.035 ? 0.0 : Math.max(0.0, topPx / height);
  const normBottom = bottomPx >= height * 0.965 ? 1.0 : Math.min(1.0, bottomPx / height);

  const normW = normRight - normLeft;
  const normH = normBottom - normTop;

  if (normW < 0.2 || normH < 0.2) {
    return { x: 0.05, y: 0.05, w: 0.9, h: 0.9, hasDetected: false };
  }

  return {
    x: Math.round(normLeft * 1000) / 1000,
    y: Math.round(normTop * 1000) / 1000,
    w: Math.round(normW * 1000) / 1000,
    h: Math.round(normH * 1000) / 1000,
    hasDetected: true,
  };
}

/**
 * 画像内の表（講義・予定が入るデータマス本体）の最外枠バウンディングボックスを完全自動検出
 */
export async function detectTableBoundingBox(imageBlob: Blob): Promise<TableBoundingBox> {
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
    return { x: 0.05, y: 0.05, w: 0.9, h: 0.9, hasDetected: false };
  }

  ctx.drawImage(img, 0, 0, sw, sh);
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  const edges = extractDirectionalEdgeProjections(data, sw, sh, DEFAULT_GRID_BOUNDS);
  return findDataTableBoundsFromProjections(edges.vertProjection, edges.horizProjection, sw, sh);
}

/**
 * 射影プロファイルから局所最大値となるピーク比率を抽出
 */
export function extractPeaksFromProjection(
  projection: number[],
  minThresholdRatio = 1.15,
): number[] {
  const totalLen = projection.length;
  if (totalLen === 0) return [];

  const avgVal = projection.reduce((a, b) => a + b, 0) / totalLen;
  const peaks: number[] = [];
  const radius = Math.max(2, Math.round(totalLen * 0.012));

  for (let i = radius; i < totalLen - radius; i++) {
    const val = projection[i];
    if (val > avgVal * minThresholdRatio) {
      let isPeak = true;
      for (let k = -radius; k <= radius; k++) {
        if (k !== 0 && projection[i + k] > val) {
          isPeak = false;
          break;
        }
      }
      if (isPeak) {
        peaks.push(Math.round((i / totalLen) * 1000) / 1000);
      }
    }
  }

  return peaks;
}

/**
 * 画像から水平・垂直のすべての罫線候補ライン（吸着ガイド線）を抽出
 */
export async function extractSnapGuidelines(imageBlob: Blob): Promise<SnapGuidelines> {
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
    return { verticalLines: [], horizontalLines: [] };
  }

  ctx.drawImage(img, 0, 0, sw, sh);
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  const edges = extractDirectionalEdgeProjections(data, sw, sh, DEFAULT_GRID_BOUNDS);
  const rawVert = extractPeaksFromProjection(edges.vertProjection);
  const rawHoriz = extractPeaksFromProjection(edges.horizProjection);

  // 画像の最外端（0.0 と 1.0）を常にスナップ候補に含める
  // （表の画像が画面いっぱいに広がっているケースに対応）
  const verticalLines = Array.from(new Set([0.0, ...rawVert, 1.0])).sort((a, b) => a - b);
  const horizontalLines = Array.from(new Set([0.0, ...rawHoriz, 1.0])).sort((a, b) => a - b);

  return { verticalLines, horizontalLines };
}

/**
 * 指定された値（比率）に最も近い罫線ピークへ強力に吸着（スナップ）
 * - candidateLines が空の場合はそのまま targetVal を返却
 * - minBound, maxBound を指定した場合はその範囲内のピークのみを対象
 * - ユーザー要望「中途半端な位置には止まらない」に基づき、範囲内の最も近い罫線ピークへ確実にスナップ
 */
export function snapToClosestGuideline(
  targetVal: number,
  candidateLines: number[],
  minBound = 0.0,
  maxBound = 1.0,
): number {
  if (!candidateLines || candidateLines.length === 0) {
    return Math.max(minBound, Math.min(maxBound, targetVal));
  }

  const validLines = candidateLines.filter((line) => line >= minBound && line <= maxBound);
  if (validLines.length === 0) {
    return Math.max(minBound, Math.min(maxBound, targetVal));
  }

  let closest = validLines[0];
  let minDiff = Math.abs(validLines[0] - targetVal);

  for (let i = 1; i < validLines.length; i++) {
    const diff = Math.abs(validLines[i] - targetVal);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validLines[i];
    }
  }

  // 常に最も近い罫線ピークへ強力吸着（中途半端な位置での停止を完全防止）
  return closest;
}

export interface LatticeFitResult {
  bestCount: number;
  dividers: number[];
  score: number;
}

/**
 * 表の数学的規則性（周期格子）の候補 [4, 5, 6, 7, 8] から、
 * 実際の罫線エッジと最も高い一致率を持つ行数・列数を決定し、
 * 各分割線を本物の罫線ピーク位置に1本ずつ高精度吸着（スナップ）
 */
export function fitLatticeToPeaks(
  projection: number[],
  minBound: number,
  maxBound: number,
  candidateCounts: number[] = [4, 5, 6, 7, 8],
  searchWindowRatio = 0.05,
): LatticeFitResult {
  const totalLen = projection.length;
  if (totalLen === 0) {
    return { bestCount: 5, dividers: [], score: 0 };
  }

  const startIdx = Math.round(minBound * totalLen);
  const endIdx = Math.round(maxBound * totalLen);
  const span = Math.max(10, endIdx - startIdx);

  // 探索範囲内の局所ピークを抽出
  const peaks: { idx: number; val: number }[] = [];
  const radius = Math.max(2, Math.round(totalLen * 0.015));

  for (let i = startIdx + radius; i < endIdx - radius; i++) {
    const val = projection[i];
    let isPeak = true;
    for (let k = -radius; k <= radius; k++) {
      if (k !== 0 && projection[i + k] > val) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) {
      peaks.push({ idx: i, val });
    }
  }

  const subSlice = projection.slice(startIdx, endIdx);
  const avgVal = subSlice.length > 0 ? subSlice.reduce((a, b) => a + b, 0) / subSlice.length : 1;

  let bestCount = candidateCounts[0] || 5;
  let bestScore = -Infinity;
  let bestDividers: number[] = [];

  for (const count of candidateCounts) {
    const numDividers = count - 1;
    if (numDividers <= 0) continue;

    let matchCount = 0;
    let scoreSum = 0;
    const currentDividers: number[] = [];
    const windowPx = Math.max(3, Math.round(span * searchWindowRatio));

    for (let d = 1; d <= numDividers; d++) {
      const idealIdx = startIdx + Math.round((d / count) * span);

      // idealIdx の近傍窓で最も強い本物の罫線ピークを探索
      let bestPeak: { idx: number; val: number } | null = null;

      for (const p of peaks) {
        if (Math.abs(p.idx - idealIdx) <= windowPx) {
          if (!bestPeak || p.val > bestPeak.val) {
            bestPeak = p;
          }
        }
      }

      if (bestPeak && bestPeak.val > avgVal * 1.05) {
        // 本物の罫線ピークが存在する場合、その実座標を採用！
        currentDividers.push(Math.round((bestPeak.idx / totalLen) * 1000) / 1000);
        matchCount++;
        const distRatio = Math.abs(bestPeak.idx - idealIdx) / windowPx;
        scoreSum += (bestPeak.val / avgVal) * (1 - distRatio * 0.4);
      } else {
        // ピークが見当たらない場合は理想位置
        currentDividers.push(Math.round((idealIdx / totalLen) * 1000) / 1000);
        scoreSum += 0.2;
      }
    }

    const matchRatio = matchCount / numDividers;
    let totalScore = (scoreSum / numDividers) * Math.pow(Math.max(0.1, matchRatio), 1.5);

    // 時間割の標準（5分割）に対する微小バイアス
    if (count === 5) totalScore *= 1.1;
    if (count === 6) totalScore *= 1.05;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCount = count;
      bestDividers = currentDividers;
    }
  }

  bestDividers.sort((a, b) => a - b);

  return {
    bestCount,
    dividers: bestDividers,
    score: bestScore,
  };
}

/**
 * 画像から水平・垂直の罫線をエッジ格子フィッティングにより高精度検出
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

  const scale = Math.min(1.0, 600 / Math.max(w, h));
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return getDefaultDividers(columns, rows, bounds);
  }

  ctx.drawImage(img, 0, 0, sw, sh);
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  const edges = extractDirectionalEdgeProjections(data, sw, sh, bounds);

  const colFit = fitLatticeToPeaks(edges.vertProjection, bounds.left, bounds.right, [columns]);
  const rowFit = fitLatticeToPeaks(edges.horizProjection, bounds.top, bounds.bottom, [rows]);

  return {
    colDividers: colFit.dividers,
    rowDividers: rowFit.dividers,
  };
}

export interface DetectedTableStructure {
  columns: number;
  rows: number;
  colDividers: number[];
  rowDividers: number[];
}

/**
 * 画像内の罫線から、表の最適な列数・行数・分割線を完全自動推定
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

  // 方向性エッジ射影プロファイルを抽出
  const edges = extractDirectionalEdgeProjections(data, sw, sh, bounds);

  // 最適な列数を全候補 [4, 5, 6, 7, 8] から決定し、各分割線を本物の罫線にスナップ
  const colFit = fitLatticeToPeaks(
    edges.vertProjection,
    bounds.left,
    bounds.right,
    [4, 5, 6, 7, 8],
  );

  // 最適な行数を全候補 [4, 5, 6, 7, 8, 9] から決定し、各分割線を本物の罫線にスナップ
  const rowFit = fitLatticeToPeaks(
    edges.horizProjection,
    bounds.top,
    bounds.bottom,
    [4, 5, 6, 7, 8, 9],
  );

  return {
    columns: colFit.bestCount,
    rows: rowFit.bestCount,
    colDividers: colFit.dividers,
    rowDividers: rowFit.dividers,
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

      // 空白セル判定 (原本の階調・アンチエイリアスを破壊せず、暗いピクセルの比率のみをチェック)
      const imgData = ctx.getImageData(0, 0, innerW, innerH);
      const d = imgData.data;
      let darkPixelCount = 0;

      for (let i = 0; i < d.length; i += 4) {
        const brightness = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (brightness < 160) {
          darkPixelCount++;
        }
      }

      const totalPixels = innerW * innerH;
      // 暗いピクセルが全体の 0.1% 未満の場合のみ空白コマ（文字なし）と安全に判定
      // （わずかな文字でもスキップされないよう閾値を緩和）
      const isEmpty = darkPixelCount / totalPixels < 0.001;

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
 * 日本語（CJK: 漢字・ひらがな・カタカナ・全角記号）の文字判定正規表現
 */
export const CJK_CHAR_REGEX =
  /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]/;

/**
 * 日本語文字同士（漢字・かな・カナ・長音符等）の間に挟まれた不要な空白を自動除去
 * - "プ ロ グ ラ ミ ン グ" -> "プログラミング"
 * - "線 形 代 数" -> "線形代数"
 * - 英文同士 "Data Structure" や英数字との区切り "302 教室" は保持
 */
export function removeCjkInterwordSpaces(text: string): string {
  if (!text) return '';
  const cjkSpacePattern =
    /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF])[\s\u3000]+(?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF])/g;
  return text.replace(cjkSpacePattern, '$1');
}

/**
 * 同一要素内（段落内）の複数行をスマートに連結
 * - 日本語文字同士での改行折り返し（例: "プログラミング\n演習"）はスペースなしで連結（"プログラミング演習"）
 * - 英数字や英単語が絡む場合（例: "線形代数\n302教室"）は半角スペース（"線形代数 302教室"）で連結
 */
export function joinParagraphLines(lines: string[]): string {
  if (lines.length === 0) return '';
  if (lines.length === 1) return removeCjkInterwordSpaces(lines[0]);

  let result = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const prev = result.trimEnd();
    const curr = lines[i].trimStart();

    if (!prev) {
      result = curr;
      continue;
    }
    if (!curr) continue;

    const lastChar = prev.slice(-1);
    const firstChar = curr.slice(0, 1);

    // 前行の末尾と次行の先頭が共に日本語（CJK）の場合はスペースなしで連結
    if (CJK_CHAR_REGEX.test(lastChar) && CJK_CHAR_REGEX.test(firstChar)) {
      result = prev + curr;
    } else {
      result = prev + ' ' + curr;
    }
  }

  return removeCjkInterwordSpaces(result);
}

/**
 * セル内テキストの整形・正規化ルール:
 * - 混入した曜日名・時限名などのヘッダーを自動除去
 * - 日本語文字同士（漢字・かな・カナ）の間の不要な空白を自動除去（"プ ロ グ ラ ミ ン グ" -> "プログラミング"）
 * - 日本語同士の折り返し改行はスペースなしで連結（"プログラミング\n演習" -> "プログラミング演習"）
 * - 英数字が絡む行折り返しは半角スペースで連結（"線形代数\n302教室" -> "線形代数 302教室"）
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
    .map((pLines) => joinParagraphLines(pLines))
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
