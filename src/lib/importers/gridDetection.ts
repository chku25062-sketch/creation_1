/**
 * 表画像からの罫線・グリッド自動検出およびセル画像切り出しユーティリティ
 */

export interface GridBoundaries {
  colDividers: number[]; // 各列の境界線 (0.0 < divider < 1.0) 昇順。要素数 = columns - 1
  rowDividers: number[]; // 各行の境界線 (0.0 < divider < 1.0) 昇順。要素数 = rows - 1
}

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

/**
 * 画像から水平・垂直の罫線を射影ヒストグラムにより自動検出
 */
export async function detectGridDividers(
  imageBlob: Blob,
  columns: number,
  rows: number,
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
    return getDefaultDividers(columns, rows);
  }

  ctx.drawImage(img, 0, 0, sw, sh);
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // 水平射影 (各行の暗いピクセル数) と 垂直射影 (各列の暗いピクセル数)
  const horizProjection = new Array(sh).fill(0);
  const vertProjection = new Array(sw).fill(0);

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      // 罫線や文字などの暗いピクセル（閾値 150 未満）
      if (brightness < 150) {
        horizProjection[y]++;
        vertProjection[x]++;
      }
    }
  }

  const colDividers = snapDividersToPeaks(vertProjection, columns - 1);
  const rowDividers = snapDividersToPeaks(horizProjection, rows - 1);

  return {
    colDividers,
    rowDividers,
  };
}

/**
 * 等間隔のデフォルト分割線を生成
 */
export function getDefaultDividers(columns: number, rows: number): GridBoundaries {
  const colDividers: number[] = [];
  for (let i = 1; i < columns; i++) {
    colDividers.push(i / columns);
  }

  const rowDividers: number[] = [];
  for (let i = 1; i < rows; i++) {
    rowDividers.push(i / rows);
  }

  return { colDividers, rowDividers };
}

/**
 * 分割線から各セル（[row][col]）の矩形座標（比率 0〜1）を計算
 */
export function calculateCellRects(
  colDividers: number[],
  rowDividers: number[],
): Array<Array<{ x: number; y: number; w: number; h: number }>> {
  const fullCols = [0, ...colDividers, 1.0];
  const fullRows = [0, ...rowDividers, 1.0];

  const gridRects: Array<Array<{ x: number; y: number; w: number; h: number }>> = [];

  for (let r = 0; r < fullRows.length - 1; r++) {
    const rowRects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const top = fullRows[r];
    const bottom = fullRows[r + 1];
    const height = bottom - top;

    for (let c = 0; c < fullCols.length - 1; c++) {
      const left = fullCols[c];
      const right = fullCols[c + 1];
      const width = right - left;

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
  paddingRatio = 0.04, // 罫線を除去するための内側マージン (4%)
): Promise<CellCropInfo[][]> {
  const img = await loadImageElement(imageBlob);
  const nw = img.naturalWidth || 800;
  const nh = img.naturalHeight || 800;

  const rects = calculateCellRects(colDividers, rowDividers);
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
