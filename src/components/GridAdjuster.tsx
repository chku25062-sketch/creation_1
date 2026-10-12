'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Grid, Check, Sliders, Sparkles, Loader2, Magnet } from 'lucide-react';
import {
  getDefaultDividers,
  calculateCellRects,
  autoDetectTableStructure,
  detectGridDividers,
  extractSnapGuidelines,
  snapToClosestGuideline,
  SnapGuidelines,
  GridAreaBounds,
  DEFAULT_GRID_BOUNDS,
} from '@/lib/importers/gridDetection';

interface GridAdjusterProps {
  imageBlob: Blob;
  initialColumns?: number;
  initialRows?: number;
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
  const [snapGuides, setSnapGuides] = useState<SnapGuidelines>({
    verticalLines: [],
    horizontalLines: [],
  });
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState<boolean>(true);
  const [detectedMessage, setDetectedMessage] = useState<string | null>(null);

  // ドラッグ操作の状態管理
  const [activeDrag, setActiveDrag] = useState<
    | { type: 'col' | 'row'; index: number }
    | { type: 'bound'; edge: 'left' | 'right' | 'top' | 'bottom' }
    | null
  >(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialMountRef = useRef<boolean>(true);

  // 画像 URL 生成
  useEffect(() => {
    const url = URL.createObjectURL(imageBlob);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  // 画像の表から行数・列数および区切り線を完全自動推定
  const runFullAutoDetect = useCallback(
    async (targetBounds: GridAreaBounds) => {
      setIsDetecting(true);
      try {
        const [detected, guides] = await Promise.all([
          autoDetectTableStructure(imageBlob, targetBounds),
          extractSnapGuidelines(imageBlob),
        ]);
        setSnapGuides(guides);
        setColumns(detected.columns);
        setRows(detected.rows);
        setColDividers(detected.colDividers);
        setRowDividers(detected.rowDividers);
        setDetectedMessage(
          `画像から ${detected.columns}列 × ${detected.rows}行 の表構造を検出しました（罫線に強力スナップ）`,
        );
        setTimeout(() => setDetectedMessage(null), 3000);
      } catch (err) {
        console.warn('Full auto-detection failed, using defaults', err);
        const defaults = getDefaultDividers(5, 5, targetBounds);
        setColumns(5);
        setRows(5);
        setColDividers(defaults.colDividers);
        setRowDividers(defaults.rowDividers);
      } finally {
        setIsDetecting(false);
      }
    },
    [imageBlob],
  );

  // 指定の行数・列数を適用し、画像内の実際の罫線ピークに精密スナップ
  const handleApplyPreset = async (targetCols: number, targetRows: number) => {
    setIsDetecting(true);
    setColumns(targetCols);
    setRows(targetRows);
    try {
      const snapped = await detectGridDividers(imageBlob, targetCols, targetRows, bounds);
      setColDividers(snapped.colDividers);
      setRowDividers(snapped.rowDividers);
      setDetectedMessage(`${targetCols}列 × ${targetRows}行 の罫線ピークにスナップしました`);
      setTimeout(() => setDetectedMessage(null), 3000);
    } catch {
      const defaults = getDefaultDividers(targetCols, targetRows, bounds);
      setColDividers(defaults.colDividers);
      setRowDividers(defaults.rowDividers);
    } finally {
      setIsDetecting(false);
    }
  };

  // 初回マウント時: 画像の表に合わせたグリッド数を完全自動検出
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      runFullAutoDetect(bounds);
    }
  }, [bounds, runFullAutoDetect]);

  // 行数・列数をユーザーが手動変更した際の区切り線更新
  const handleColumnsChange = (newCols: number) => {
    const validCols = Math.max(1, Math.min(14, newCols));
    setColumns(validCols);
    const defaults = getDefaultDividers(validCols, rows, bounds);
    setColDividers(defaults.colDividers);
  };

  const handleRowsChange = (newRows: number) => {
    const validRows = Math.max(1, Math.min(20, newRows));
    setRows(validRows);
    const defaults = getDefaultDividers(columns, validRows, bounds);
    setRowDividers(defaults.rowDividers);
  };

  // 均等割りリセット
  const handleResetToEqual = () => {
    const defaults = getDefaultDividers(columns, rows, bounds);
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

      const minMargin = 0.02;

      if (activeDrag.type === 'col') {
        const rawRatioX = (e.clientX - rect.left) / rect.width;
        setColDividers((prev) => {
          const next = [...prev];
          const idx = activeDrag.index;
          const leftBound = idx === 0 ? bounds.left + minMargin : prev[idx - 1] + minMargin;
          const rightBound =
            idx === prev.length - 1 ? bounds.right - minMargin : prev[idx + 1] - minMargin;
          next[idx] = snapToClosestGuideline(
            rawRatioX,
            snapGuides.verticalLines,
            leftBound,
            rightBound,
          );
          return next;
        });
      } else if (activeDrag.type === 'row') {
        const rawRatioY = (e.clientY - rect.top) / rect.height;
        setRowDividers((prev) => {
          const next = [...prev];
          const idx = activeDrag.index;
          const topBound = idx === 0 ? bounds.top + minMargin : prev[idx - 1] + minMargin;
          const bottomBound =
            idx === prev.length - 1 ? bounds.bottom - minMargin : prev[idx + 1] - minMargin;
          next[idx] = snapToClosestGuideline(
            rawRatioY,
            snapGuides.horizontalLines,
            topBound,
            bottomBound,
          );
          return next;
        });
      } else if (activeDrag.type === 'bound') {
        const rawRatioX = (e.clientX - rect.left) / rect.width;
        const rawRatioY = (e.clientY - rect.top) / rect.height;

        setBounds((prev) => {
          const next = { ...prev };
          if (activeDrag.edge === 'left') {
            const firstCol = colDividers[0] || 0.2;
            next.left = snapToClosestGuideline(
              rawRatioX,
              snapGuides.verticalLines,
              0.0,
              firstCol - minMargin,
            );
          } else if (activeDrag.edge === 'right') {
            const lastCol = colDividers[colDividers.length - 1] || 0.8;
            next.right = snapToClosestGuideline(
              rawRatioX,
              snapGuides.verticalLines,
              lastCol + minMargin,
              1.0,
            );
          } else if (activeDrag.edge === 'top') {
            const firstRow = rowDividers[0] || 0.2;
            next.top = snapToClosestGuideline(
              rawRatioY,
              snapGuides.horizontalLines,
              0.0,
              firstRow - minMargin,
            );
          } else if (activeDrag.edge === 'bottom') {
            const lastRow = rowDividers[rowDividers.length - 1] || 0.8;
            next.bottom = snapToClosestGuideline(
              rawRatioY,
              snapGuides.horizontalLines,
              lastRow + minMargin,
              1.0,
            );
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
  }, [activeDrag, bounds, colDividers, rowDividers, snapGuides]);

  // セル矩形計算
  const cellRects = calculateCellRects(colDividers, rowDividers, bounds);

  // 列ラベルの算出
  const getColLabel = (cIdx: number) => {
    if (columns <= 7 && cIdx < WEEKDAY_NAMES.length) {
      return WEEKDAY_NAMES[cIdx];
    }
    return `列${cIdx + 1}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ツールバー / 設定 */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-3">
          {/* クイックプリセット */}
          <div className="flex items-center gap-1">
            <span className="font-medium text-slate-400">プリセット:</span>
            {[
              { cols: 5, rows: 5, label: '5×5 (月-金/5限)' },
              { cols: 5, rows: 6, label: '5×6 (月-金/6限)' },
              { cols: 6, rows: 5, label: '6×5 (月-土/5限)' },
              { cols: 7, rows: 5, label: '7×5 (全日/5限)' },
            ].map((preset) => {
              const isCurrent = columns === preset.cols && rows === preset.rows;
              return (
                <button
                  key={`${preset.cols}x${preset.rows}`}
                  type="button"
                  disabled={isDetecting}
                  onClick={() => handleApplyPreset(preset.cols, preset.rows)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    isCurrent
                      ? 'border border-cyan-500/60 bg-cyan-950/70 text-cyan-300 shadow-xs'
                      : 'border border-slate-800 bg-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200'
                  } disabled:opacity-50`}
                  title={`${preset.cols}列 × ${preset.rows}行 に設定し罫線ピークへ精密吸着`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="hidden h-4 w-px bg-slate-800 sm:block" />

          {/* 列数（横マス）コントロール */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-400">列数:</span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-800 px-1 py-0.5">
              <button
                type="button"
                disabled={columns <= 1}
                onClick={() => handleColumnsChange(columns - 1)}
                className="h-5 w-5 rounded font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                -
              </button>
              <span className="min-w-6 text-center font-bold text-cyan-300">{columns}列</span>
              <button
                type="button"
                disabled={columns >= 14}
                onClick={() => handleColumnsChange(columns + 1)}
                className="h-5 w-5 rounded font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                +
              </button>
            </div>
            {/* スマート曜日バッジ */}
            {columns === 5 && (
              <span className="rounded bg-cyan-950/60 px-1.5 py-0.5 text-[10px] text-cyan-300">
                月〜金
              </span>
            )}
            {columns === 6 && (
              <span className="rounded bg-cyan-950/60 px-1.5 py-0.5 text-[10px] text-cyan-300">
                月〜土
              </span>
            )}
            {columns === 7 && (
              <span className="rounded bg-cyan-950/60 px-1.5 py-0.5 text-[10px] text-cyan-300">
                月〜日
              </span>
            )}
          </div>

          {/* 行数（縦マス）コントロール */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-400">行数:</span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-800 px-1 py-0.5">
              <button
                type="button"
                disabled={rows <= 1}
                onClick={() => handleRowsChange(rows - 1)}
                className="h-5 w-5 rounded font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                -
              </button>
              <span className="min-w-6 text-center font-bold text-cyan-300">{rows}行</span>
              <button
                type="button"
                disabled={rows >= 20}
                onClick={() => handleRowsChange(rows + 1)}
                className="h-5 w-5 rounded font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* 自動検出 & スナップ & 均等割ボタン */}
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
            onClick={() => handleApplyPreset(columns, rows)}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
            title="現在の行数・列数を維持したまま、画像内の本物の罫線に再スナップ"
          >
            <Grid className="h-3 w-3 text-cyan-400" />
            <span>罫線に再吸着</span>
          </button>
          <button
            type="button"
            disabled={isDetecting}
            onClick={() => runFullAutoDetect(bounds)}
            className="flex items-center gap-1 rounded-lg border border-cyan-800/60 bg-gradient-to-r from-cyan-950/80 to-blue-950/80 px-2.5 py-1 font-semibold text-cyan-300 shadow transition hover:from-cyan-900/90 hover:to-blue-900/90 disabled:opacity-50"
            title="画像の表の罫線を解析し、行数・列数・境界線を自動判定"
          >
            {isDetecting ? (
              <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
            ) : (
              <Sparkles className="h-3 w-3 text-cyan-400" />
            )}
            <span>表から全自動検出</span>
          </button>
        </div>
      </div>

      {/* ガイドメッセージ / 検出結果アラート */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1 text-cyan-300">
          <Grid className="h-3.5 w-3.5 text-cyan-400" />
          <span>
            {detectedMessage ||
              '画像の表に合わせてグリッド数を自動検出しました。破線や外枠で微調整できます'}
          </span>
        </span>
        <span className="font-mono text-slate-400">
          計 {columns * rows} マス（{columns}列 × {rows}行）
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

            {/* 吸着中インジケーター */}
            {activeDrag && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded bg-cyan-950/95 border border-cyan-400 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200 shadow-xl pointer-events-none whitespace-nowrap z-30">
                <Magnet className="h-3 w-3 text-cyan-400 animate-pulse" />
                <span>罫線ピークに強力吸着中</span>
              </div>
            )}

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

            {/* 各セルのラベルウォーターマーク */}
            {cellRects.map((rowCells, rIdx) =>
              rowCells.map((cell, cIdx) => (
                <div
                  key={`cell-guide-${rIdx}-${cIdx}`}
                  className="pointer-events-none absolute flex items-center justify-center text-[10px] font-bold text-cyan-400/60"
                  style={{
                    left: `${cell.x * 100}%`,
                    top: `${cell.y * 100}%`,
                    width: `${cell.w * 100}%`,
                    height: `${cell.h * 100}%`,
                  }}
                >
                  <span className="rounded bg-black/50 px-1 py-0.5 shadow-xs">
                    {getColLabel(cIdx)}
                    {rIdx + 1}限
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
                <div className="absolute top-0 bottom-0 left-2 w-0.5 border-l-2 border-dashed border-cyan-400 transition group-hover:border-solid group-hover:border-cyan-300" />
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
                <div className="absolute left-0 right-0 top-2 h-0.5 border-t-2 border-dashed border-blue-400 transition group-hover:border-solid group-hover:border-blue-300" />
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
          <span>この区画で高精度解析を開始 ({columns * rows}マス)</span>
        </button>
      </div>
    </div>
  );
}
