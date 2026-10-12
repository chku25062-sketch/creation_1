'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Grid,
  Check,
  Sliders,
  Calendar,
  Clock,
  Sparkles,
  Loader2,
  Columns,
  Rows,
} from 'lucide-react';
import {
  detectGridDividers,
  getDefaultDividers,
  calculateCellRects,
  GridAreaBounds,
  DEFAULT_GRID_BOUNDS,
} from '@/lib/importers/gridDetection';

interface GridAdjusterProps {
  imageBlob: Blob;
  initialColumns?: number; // 5 (月〜金) or 6 (月〜土)
  initialRows?: number; // 4〜7
  onConfirm: (
    colDividers: number[],
    rowDividers: number[],
    columns: number,
    rows: number,
    bounds: GridAreaBounds,
  ) => void;
  onBack: () => void;
}

const WEEKDAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];

export function GridAdjuster({
  imageBlob,
  initialColumns = 5,
  initialRows = 5,
  onConfirm,
  onBack,
}: GridAdjusterProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [rows, setRows] = useState(initialRows);
  const [bounds, setBounds] = useState<GridAreaBounds>(DEFAULT_GRID_BOUNDS);
  const [colDividers, setColDividers] = useState<number[]>([]);
  const [rowDividers, setRowDividers] = useState<number[]>([]);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState<boolean>(true);

  // ヘッダー除外のクイックトグル状態
  const [excludeTopHeader, setExcludeTopHeader] = useState<boolean>(false);
  const [excludeLeftHeader, setExcludeLeftHeader] = useState<boolean>(false);

  // ドラッグ操作の状態管理
  const [activeDrag, setActiveDrag] = useState<
    | { type: 'col' | 'row'; index: number }
    | { type: 'bound'; edge: 'left' | 'right' | 'top' | 'bottom' }
    | null
  >(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 画像 URL 生成
  useEffect(() => {
    const url = URL.createObjectURL(imageBlob);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  // 初回マウント時または行・列数変更時に自動検出を実行
  const runDetection = useCallback(
    async (targetCols: number, targetRows: number, targetBounds: GridAreaBounds) => {
      setIsDetecting(true);
      try {
        const detected = await detectGridDividers(imageBlob, targetCols, targetRows, targetBounds);
        setColDividers(detected.colDividers);
        setRowDividers(detected.rowDividers);
      } catch (err) {
        console.warn('Grid auto-detection failed, using default', err);
        const defaults = getDefaultDividers(targetCols, targetRows, targetBounds);
        setColDividers(defaults.colDividers);
        setRowDividers(defaults.rowDividers);
      } finally {
        setIsDetecting(false);
      }
    },
    [imageBlob],
  );

  useEffect(() => {
    runDetection(columns, rows, bounds);
  }, [columns, rows, bounds, runDetection]);

  // 均等割りリセット
  const handleResetToEqual = () => {
    const defaults = getDefaultDividers(columns, rows, bounds);
    setColDividers(defaults.colDividers);
    setRowDividers(defaults.rowDividers);
  };

  // 上部曜日ヘッダー除外トグル
  const handleToggleTopHeader = () => {
    const nextExclude = !excludeTopHeader;
    setExcludeTopHeader(nextExclude);
    const newTop = nextExclude ? 0.09 : 0; // 上部9%を除外
    const newBounds = { ...bounds, top: newTop };
    setBounds(newBounds);
    const defaults = getDefaultDividers(columns, rows, newBounds);
    setColDividers(defaults.colDividers);
    setRowDividers(defaults.rowDividers);
  };

  // 左部時限ヘッダー除外トグル
  const handleToggleLeftHeader = () => {
    const nextExclude = !excludeLeftHeader;
    setExcludeLeftHeader(nextExclude);
    const newLeft = nextExclude ? 0.09 : 0; // 左部9%を除外
    const newBounds = { ...bounds, left: newLeft };
    setBounds(newBounds);
    const defaults = getDefaultDividers(columns, rows, newBounds);
    setColDividers(defaults.colDividers);
    setRowDividers(defaults.rowDividers);
  };

  // ドラッグ追従 (Window Listener)
  useEffect(() => {
    if (!activeDrag) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const minMargin = 0.02; // 線同士の最小間隔

      if (activeDrag.type === 'col') {
        const ratioX = (e.clientX - rect.left) / rect.width;
        setColDividers((prev) => {
          const next = [...prev];
          const idx = activeDrag.index;
          const leftBound = idx === 0 ? bounds.left + minMargin : prev[idx - 1] + minMargin;
          const rightBound =
            idx === prev.length - 1 ? bounds.right - minMargin : prev[idx + 1] - minMargin;
          next[idx] = Math.max(leftBound, Math.min(rightBound, ratioX));
          return next;
        });
      } else if (activeDrag.type === 'row') {
        const ratioY = (e.clientY - rect.top) / rect.height;
        setRowDividers((prev) => {
          const next = [...prev];
          const idx = activeDrag.index;
          const topBound = idx === 0 ? bounds.top + minMargin : prev[idx - 1] + minMargin;
          const bottomBound =
            idx === prev.length - 1 ? bounds.bottom - minMargin : prev[idx + 1] - minMargin;
          next[idx] = Math.max(topBound, Math.min(bottomBound, ratioY));
          return next;
        });
      } else if (activeDrag.type === 'bound') {
        const ratioX = (e.clientX - rect.left) / rect.width;
        const ratioY = (e.clientY - rect.top) / rect.height;

        setBounds((prev) => {
          const next = { ...prev };
          if (activeDrag.edge === 'left') {
            const firstCol = colDividers[0] || 0.2;
            next.left = Math.max(0, Math.min(firstCol - minMargin, ratioX));
          } else if (activeDrag.edge === 'right') {
            const lastCol = colDividers[colDividers.length - 1] || 0.8;
            next.right = Math.min(1.0, Math.max(lastCol + minMargin, ratioX));
          } else if (activeDrag.edge === 'top') {
            const firstRow = rowDividers[0] || 0.2;
            next.top = Math.max(0, Math.min(firstRow - minMargin, ratioY));
          } else if (activeDrag.edge === 'bottom') {
            const lastRow = rowDividers[rowDividers.length - 1] || 0.8;
            next.bottom = Math.min(1.0, Math.max(lastRow + minMargin, ratioY));
          }
          return next;
        });
      }
    };

    const onPointerUp = () => {
      setActiveDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [activeDrag, bounds, colDividers, rowDividers]);

  // セル矩形計算
  const cellRects = calculateCellRects(colDividers, rowDividers, bounds);

  return (
    <div className="flex flex-col gap-3">
      {/* ツールバー / 設定 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 曜日数（列） */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-medium text-slate-400">曜日:</span>
            <div className="flex rounded-lg bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setColumns(5)}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  columns === 5
                    ? 'bg-cyan-500 font-semibold text-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                月〜金 (5)
              </button>
              <button
                type="button"
                onClick={() => setColumns(6)}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  columns === 6
                    ? 'bg-cyan-500 font-semibold text-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                月〜土 (6)
              </button>
            </div>
          </div>

          {/* コマ数（行） */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-medium text-slate-400">時限:</span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-800 px-1 py-0.5">
              <button
                type="button"
                disabled={rows <= 4}
                onClick={() => setRows((r) => Math.max(4, r - 1))}
                className="h-5 w-5 rounded font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                -
              </button>
              <span className="w-5 text-center font-bold text-white">{rows}</span>
              <button
                type="button"
                disabled={rows >= 7}
                onClick={() => setRows((r) => Math.min(7, r + 1))}
                className="h-5 w-5 rounded font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          {/* ヘッダー除外クイックボタン */}
          <div className="flex items-center gap-1 border-l border-slate-700/80 pl-2">
            <button
              type="button"
              onClick={handleToggleTopHeader}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 transition ${
                excludeTopHeader
                  ? 'border-cyan-400 bg-cyan-950 font-semibold text-cyan-300'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
              title="表の上端にある曜日ヘッダー文字（月〜金）を区画から除外"
            >
              <Rows className="h-3 w-3" />
              <span>上の曜日行を除外</span>
            </button>
            <button
              type="button"
              onClick={handleToggleLeftHeader}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 transition ${
                excludeLeftHeader
                  ? 'border-cyan-400 bg-cyan-950 font-semibold text-cyan-300'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
              title="表の左端にある時限ヘッダー文字（1〜5限）を区画から除外"
            >
              <Columns className="h-3 w-3" />
              <span>左の時限列を除外</span>
            </button>
          </div>
        </div>

        {/* リセット & 自動検出ボタン */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToEqual}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <Sliders className="h-3 w-3" />
            <span>均等割</span>
          </button>
          <button
            type="button"
            disabled={isDetecting}
            onClick={() => runDetection(columns, rows, bounds)}
            className="flex items-center gap-1 rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-2.5 py-1 font-medium text-cyan-300 transition hover:bg-cyan-900/50"
          >
            {isDetecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 text-cyan-400" />
            )}
            <span>再検出</span>
          </button>
        </div>
      </div>

      {/* ガイドメッセージ */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1 text-cyan-300">
          <Grid className="h-3.5 w-3.5 text-cyan-400" />
          <span>
            破線や外枠をドラッグして、講義が入るマス目（データ領域）に枠を合わせてください
          </span>
        </span>
        <span className="text-slate-400">
          全 {columns * rows} コマ（{columns}曜 × {rows}限）
        </span>
      </div>

      {/* メインプレビューコンテナ */}
      <div
        ref={containerRef}
        className="relative flex max-h-[50vh] min-h-[280px] w-full select-none items-center justify-center overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-2"
      >
        {imageSrc && (
          <div className="relative inline-block touch-none shadow-2xl">
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Grid Adjust Preview"
              draggable={false}
              className="max-h-[48vh] w-auto max-w-full select-none object-contain pointer-events-none block"
            />

            {/* 外枠（ヘッダー除外マスク） */}
            <div
              className="pointer-events-none absolute inset-0 bg-slate-950/60"
              style={{
                clipPath: `polygon(
                  0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                  ${bounds.left * 100}% ${bounds.top * 100}%,
                  ${bounds.right * 100}% ${bounds.top * 100}%,
                  ${bounds.right * 100}% ${bounds.bottom * 100}%,
                  ${bounds.left * 100}% ${bounds.bottom * 100}%,
                  ${bounds.left * 100}% ${bounds.top * 100}%
                )`,
              }}
            />

            {/* 外枠ボーダーライン (ドラッグ可能) */}
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setActiveDrag({ type: 'bound', edge: 'left' });
              }}
              className="group absolute top-0 bottom-0 -ml-2 w-4 cursor-ew-resize"
              style={{ left: `${bounds.left * 100}%` }}
            >
              <div className="absolute top-0 bottom-0 left-2 w-0.5 bg-cyan-400 shadow group-hover:w-1 group-hover:bg-cyan-300" />
            </div>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setActiveDrag({ type: 'bound', edge: 'right' });
              }}
              className="group absolute top-0 bottom-0 -ml-2 w-4 cursor-ew-resize"
              style={{ left: `${bounds.right * 100}%` }}
            >
              <div className="absolute top-0 bottom-0 left-2 w-0.5 bg-cyan-400 shadow group-hover:w-1 group-hover:bg-cyan-300" />
            </div>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setActiveDrag({ type: 'bound', edge: 'top' });
              }}
              className="group absolute left-0 right-0 -mt-2 h-4 cursor-ns-resize"
              style={{ top: `${bounds.top * 100}%` }}
            >
              <div className="absolute left-0 right-0 top-2 h-0.5 bg-blue-400 shadow group-hover:h-1 group-hover:bg-blue-300" />
            </div>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setActiveDrag({ type: 'bound', edge: 'bottom' });
              }}
              className="group absolute left-0 right-0 -mt-2 h-4 cursor-ns-resize"
              style={{ top: `${bounds.bottom * 100}%` }}
            >
              <div className="absolute left-0 right-0 top-2 h-0.5 bg-blue-400 shadow group-hover:h-1 group-hover:bg-blue-300" />
            </div>

            {/* 各セルの曜日・時限ラベルウォーターマーク */}
            {cellRects.map((rowCells, rIdx) =>
              rowCells.map((cell, cIdx) => (
                <div
                  key={`cell-guide-${rIdx}-${cIdx}`}
                  className="pointer-events-none absolute flex items-center justify-center text-[10px] font-bold text-cyan-400/25"
                  style={{
                    left: `${cell.x * 100}%`,
                    top: `${cell.y * 100}%`,
                    width: `${cell.w * 100}%`,
                    height: `${cell.h * 100}%`,
                  }}
                >
                  <span className="rounded bg-black/40 px-1 py-0.5">
                    {WEEKDAY_NAMES[cIdx]}
                    {rIdx + 1}
                  </span>
                </div>
              )),
            )}

            {/* 垂直分割線 (Col Dividers) */}
            {colDividers.map((ratio, idx) => (
              <div
                key={`col-div-${idx}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveDrag({ type: 'col', index: idx });
                }}
                className="group absolute top-0 bottom-0 -ml-2 w-4 cursor-ew-resize"
                style={{
                  left: `${ratio * 100}%`,
                  top: `${bounds.top * 100}%`,
                  bottom: `${(1 - bounds.bottom) * 100}%`,
                }}
              >
                {/* 見た目の線 */}
                <div className="absolute top-0 bottom-0 left-2 w-0.5 border-l-2 border-dashed border-cyan-400 transition group-hover:border-solid group-hover:border-cyan-300" />
                {/* 掴みやすい上下の丸ポッチ */}
                <div className="absolute top-1 left-0.5 h-3 w-3 rounded-full border border-cyan-300 bg-cyan-500 shadow-md transition group-hover:scale-125" />
                <div className="absolute bottom-1 left-0.5 h-3 w-3 rounded-full border border-cyan-300 bg-cyan-500 shadow-md transition group-hover:scale-125" />
              </div>
            ))}

            {/* 水平分割線 (Row Dividers) */}
            {rowDividers.map((ratio, idx) => (
              <div
                key={`row-div-${idx}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveDrag({ type: 'row', index: idx });
                }}
                className="group absolute left-0 right-0 -mt-2 h-4 cursor-ns-resize"
                style={{
                  top: `${ratio * 100}%`,
                  left: `${bounds.left * 100}%`,
                  right: `${(1 - bounds.right) * 100}%`,
                }}
              >
                {/* 見た目の線 */}
                <div className="absolute left-0 right-0 top-2 h-0.5 border-t-2 border-dashed border-blue-400 transition group-hover:border-solid group-hover:border-blue-300" />
                {/* 掴みやすい左右の丸ポッチ */}
                <div className="absolute left-1 top-0.5 h-3 w-3 rounded-full border border-blue-300 bg-blue-500 shadow-md transition group-hover:scale-125" />
                <div className="absolute right-1 top-0.5 h-3 w-3 rounded-full border border-blue-300 bg-blue-500 shadow-md transition group-hover:scale-125" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* フッターアクションバー */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-800 px-3.5 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          トリミングに戻る
        </button>

        <button
          type="button"
          onClick={() => onConfirm(colDividers, rowDividers, columns, rows, bounds)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 transition hover:opacity-95"
        >
          <Check className="h-3.5 w-3.5" />
          <span>この区画で高精度解析を開始 ({columns * rows}コマ)</span>
        </button>
      </div>
    </div>
  );
}
