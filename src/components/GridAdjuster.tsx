'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Grid, Check, Sparkles, Loader2, Magnet } from 'lucide-react';
import {
  getDefaultDividers,
  calculateCellRects,
  autoDetectTableStructure,
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
            next.left =
              rawRatioX <= 0.03
                ? 0.0
                : snapToClosestGuideline(
                    rawRatioX,
                    snapGuides.verticalLines,
                    0.0,
                    firstCol - minMargin,
                  );
          } else if (activeDrag.edge === 'right') {
            const lastCol = colDividers[colDividers.length - 1] || 0.8;
            next.right =
              rawRatioX >= 0.97
                ? 1.0
                : snapToClosestGuideline(
                    rawRatioX,
                    snapGuides.verticalLines,
                    lastCol + minMargin,
                    1.0,
                  );
          } else if (activeDrag.edge === 'top') {
            const firstRow = rowDividers[0] || 0.2;
            next.top =
              rawRatioY <= 0.03
                ? 0.0
                : snapToClosestGuideline(
                    rawRatioY,
                    snapGuides.horizontalLines,
                    0.0,
                    firstRow - minMargin,
                  );
          } else if (activeDrag.edge === 'bottom') {
            const lastRow = rowDividers[rowDividers.length - 1] || 0.8;
            next.bottom =
              rawRatioY >= 0.97
                ? 1.0
                : snapToClosestGuideline(
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
    <div className="flex flex-col flex-1 min-h-0 h-full justify-between gap-1.5">
      {/* メインプレビューコンテナ (ノート調・余白最小化) */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[220px] w-full select-none flex items-center justify-center overflow-auto rounded-xl border border-slate-300 bg-slate-100/90 p-1 sm:p-2 shadow-inner"
      >
        {/* ガイドメッセージ / 検出結果アラート (フロート配置) */}
        <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5 text-[10px] text-slate-700 bg-white/95 border border-slate-200 rounded-md px-2 py-1 shadow-xs pointer-events-none backdrop-blur-xs">
          <Grid className="h-3 w-3 text-blue-600 shrink-0" />
          <span className="truncate max-w-[280px] sm:max-w-none">
            {detectedMessage || '破線をドラッグして時間割の行と列の境目に微調整'}
          </span>
        </div>

        {imageSrc && (
          <div className="relative inline-block touch-none shadow-lg">
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Grid Adjust Preview"
              draggable={false}
              className="max-h-[54vh] sm:max-h-[64vh] w-auto max-w-full select-none object-contain pointer-events-none block"
            />

            {/* 吸着中インジケーター */}
            {activeDrag && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded bg-blue-600 text-white px-2.5 py-0.5 text-[10px] font-bold shadow-lg pointer-events-none whitespace-nowrap z-30">
                <Magnet className="h-3 w-3 text-cyan-200 animate-pulse" />
                <span>罫線ピークに吸着中</span>
              </div>
            )}

            {/* 外枠（ヘッダー除外マスク） */}
            <div
              className="pointer-events-none absolute inset-0 bg-slate-900/40"
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

            {/* 外枠ボーダーライン (ドラッグ可能・広いヒットエリア 24px) */}
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setActiveDrag({ type: 'bound', edge: 'left' });
              }}
              className="group absolute top-0 bottom-0 -ml-3 w-6 cursor-ew-resize z-20"
              style={{ left: `${bounds.left * 100}%` }}
              title="左境界線（ドラッグで調整）"
            >
              <div className="absolute top-0 bottom-0 left-3 w-0.5 bg-blue-600 shadow group-hover:w-1 group-hover:bg-blue-500" />
            </div>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setActiveDrag({ type: 'bound', edge: 'right' });
              }}
              className="group absolute top-0 bottom-0 -ml-3 w-6 cursor-ew-resize z-20"
              style={{ left: `${bounds.right * 100}%` }}
              title="右境界線（ドラッグで調整）"
            >
              <div className="absolute top-0 bottom-0 left-3 w-0.5 bg-blue-600 shadow group-hover:w-1 group-hover:bg-blue-500" />
            </div>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setActiveDrag({ type: 'bound', edge: 'top' });
              }}
              className="group absolute left-0 right-0 -mt-3 h-6 cursor-ns-resize z-20"
              style={{ top: `${bounds.top * 100}%` }}
              title="上境界線（ドラッグで調整）"
            >
              <div className="absolute left-0 right-0 top-3 h-0.5 bg-blue-600 shadow group-hover:h-1 group-hover:bg-blue-500" />
            </div>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setActiveDrag({ type: 'bound', edge: 'bottom' });
              }}
              className="group absolute left-0 right-0 -mt-3 h-6 cursor-ns-resize z-20"
              style={{ top: `${bounds.bottom * 100}%` }}
              title="下境界線（ドラッグで調整）"
            >
              <div className="absolute left-0 right-0 top-3 h-0.5 bg-blue-600 shadow group-hover:h-1 group-hover:bg-blue-500" />
            </div>

            {/* 各セルのラベルウォーターマーク (付箋風バッジ) */}
            {cellRects.map((rowCells, rIdx) =>
              rowCells.map((cell, cIdx) => (
                <div
                  key={`cell-guide-${rIdx}-${cIdx}`}
                  className="pointer-events-none absolute flex items-center justify-center text-[10px] font-bold text-blue-900"
                  style={{
                    left: `${cell.x * 100}%`,
                    top: `${cell.y * 100}%`,
                    width: `${cell.w * 100}%`,
                    height: `${cell.h * 100}%`,
                  }}
                >
                  <span className="rounded bg-white/85 border border-slate-200 px-1 py-0.5 shadow-2xs text-[9px] text-slate-700">
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
                <div className="absolute top-0 bottom-0 left-2 w-0.5 border-l-2 border-dashed border-blue-500 transition group-hover:border-solid group-hover:border-blue-600" />
                <div className="absolute top-1 left-0.5 h-3 w-3 rounded-full border border-white bg-blue-600 shadow-sm transition group-hover:scale-125" />
                <div className="absolute bottom-1 left-0.5 h-3 w-3 rounded-full border border-white bg-blue-600 shadow-sm transition group-hover:scale-125" />
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
                <div className="absolute left-0 right-0 top-2 h-0.5 border-t-2 border-dashed border-indigo-500 transition group-hover:border-solid group-hover:border-indigo-600" />
                <div className="absolute left-1 top-0.5 h-3 w-3 rounded-full border border-white bg-indigo-600 shadow-sm transition group-hover:scale-125" />
                <div className="absolute right-1 top-0.5 h-3 w-3 rounded-full border border-white bg-indigo-600 shadow-sm transition group-hover:scale-125" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 操作パネル（ノート調ホワイトバー：ボタンを「自動」「列」「行」のみに絞り、下部に配置） */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 pt-2">
        {/* 左側: 自動判定ボタン & 列・行コントロール */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* 自動判定ボタン */}
          <button
            type="button"
            disabled={isDetecting}
            onClick={() => runFullAutoDetect(bounds)}
            className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 shadow-2xs transition hover:bg-blue-100 active:scale-95 disabled:opacity-50"
            title="画像の表の罫線を解析し、行数・列数・境界線を自動判定"
          >
            {isDetecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            )}
            <span>自動</span>
          </button>

          {/* 列コントロール */}
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-700 text-xs">列:</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-white p-0.5 border border-slate-300 shadow-2xs">
              <button
                type="button"
                disabled={columns <= 1}
                onClick={() => handleColumnsChange(columns - 1)}
                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded font-bold text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-30 transition"
              >
                -
              </button>
              <span className="min-w-6 text-center font-bold text-blue-700 text-xs">{columns}</span>
              <button
                type="button"
                disabled={columns >= 14}
                onClick={() => handleColumnsChange(columns + 1)}
                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded font-bold text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-30 transition"
              >
                +
              </button>
            </div>
            {columns <= 7 && (
              <span className="rounded bg-blue-50 border border-blue-200 px-1 py-0.5 text-[9px] font-bold text-blue-700 hidden sm:inline-block">
                {columns === 5 ? '月〜金' : columns === 6 ? '月〜土' : '月〜日'}
              </span>
            )}
          </div>

          {/* 行コントロール */}
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-700 text-xs">行:</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-white p-0.5 border border-slate-300 shadow-2xs">
              <button
                type="button"
                disabled={rows <= 1}
                onClick={() => handleRowsChange(rows - 1)}
                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded font-bold text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-30 transition"
              >
                -
              </button>
              <span className="min-w-6 text-center font-bold text-blue-700 text-xs">{rows}</span>
              <button
                type="button"
                disabled={rows >= 20}
                onClick={() => handleRowsChange(rows + 1)}
                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded font-bold text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-30 transition"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* 右側: 戻る / 解析を開始 */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-2xs"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={() => onConfirm(colDividers, rowDividers, columns, rows, bounds)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <Check className="h-4 w-4 text-white" />
            <span>解析を開始 ({columns * rows}マス)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
