'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Grid, Check, Sliders, Calendar, Clock, Sparkles, Loader2 } from 'lucide-react';
import {
  detectGridDividers,
  getDefaultDividers,
  calculateCellRects,
} from '@/lib/importers/gridDetection';

interface GridAdjusterProps {
  imageBlob: Blob;
  initialColumns?: number; // 5 (月〜金) or 6 (月〜土)
  initialRows?: number; // 4〜7
  onConfirm: (colDividers: number[], rowDividers: number[], columns: number, rows: number) => void;
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
  const [colDividers, setColDividers] = useState<number[]>([]);
  const [rowDividers, setRowDividers] = useState<number[]>([]);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState<boolean>(true);

  // ドラッグ操作の状態管理
  const [activeDrag, setActiveDrag] = useState<{
    type: 'col' | 'row';
    index: number;
  } | null>(null);

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
    async (targetCols: number, targetRows: number) => {
      setIsDetecting(true);
      try {
        const detected = await detectGridDividers(imageBlob, targetCols, targetRows);
        setColDividers(detected.colDividers);
        setRowDividers(detected.rowDividers);
      } catch (err) {
        console.warn('Grid auto-detection failed, using default', err);
        const defaults = getDefaultDividers(targetCols, targetRows);
        setColDividers(defaults.colDividers);
        setRowDividers(defaults.rowDividers);
      } finally {
        setIsDetecting(false);
      }
    },
    [imageBlob],
  );

  useEffect(() => {
    runDetection(columns, rows);
  }, [columns, rows, runDetection]);

  // 均等割りリセット
  const handleResetToEqual = () => {
    const defaults = getDefaultDividers(columns, rows);
    setColDividers(defaults.colDividers);
    setRowDividers(defaults.rowDividers);
  };

  // ドラッグ開始
  const handlePointerDownDivider = (e: React.PointerEvent, type: 'col' | 'row', index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDrag({ type, index });
  };

  // ドラッグ追従 (Window Listener)
  useEffect(() => {
    if (!activeDrag) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!imgRef.current) return;
      const bounds = imgRef.current.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;

      const minMargin = 0.03; // 線同士の最小間隔 (3%)

      if (activeDrag.type === 'col') {
        const ratioX = (e.clientX - bounds.left) / bounds.width;
        setColDividers((prev) => {
          const next = [...prev];
          const idx = activeDrag.index;
          const leftBound = idx === 0 ? minMargin : prev[idx - 1] + minMargin;
          const rightBound = idx === prev.length - 1 ? 1.0 - minMargin : prev[idx + 1] - minMargin;
          next[idx] = Math.max(leftBound, Math.min(rightBound, ratioX));
          return next;
        });
      } else {
        const ratioY = (e.clientY - bounds.top) / bounds.height;
        setRowDividers((prev) => {
          const next = [...prev];
          const idx = activeDrag.index;
          const topBound = idx === 0 ? minMargin : prev[idx - 1] + minMargin;
          const bottomBound = idx === prev.length - 1 ? 1.0 - minMargin : prev[idx + 1] - minMargin;
          next[idx] = Math.max(topBound, Math.min(bottomBound, ratioY));
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
  }, [activeDrag]);

  // セル矩形計算
  const cellRects = calculateCellRects(colDividers, rowDividers);

  return (
    <div className="flex flex-col gap-3">
      {/* ツールバー / 設定 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-3">
          {/* 曜日数（列） */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-medium text-slate-400">曜日列:</span>
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
            <span className="font-medium text-slate-400">時限行:</span>
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
            onClick={() => runDetection(columns, rows)}
            className="flex items-center gap-1 rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-2.5 py-1 font-medium text-cyan-300 transition hover:bg-cyan-900/50"
          >
            {isDetecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 text-cyan-400" />
            )}
            <span>罫線を再検出</span>
          </button>
        </div>
      </div>

      {/* ガイドメッセージ */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1 text-cyan-300">
          <Grid className="h-3.5 w-3.5 text-cyan-400" />
          <span>水色と青の破線をドラッグして、時間割の行と列の境目に合わせてください</span>
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
                  <span className="rounded bg-black/30 px-1 py-0.5">
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
                onPointerDown={(e) => handlePointerDownDivider(e, 'col', idx)}
                className="group absolute top-0 bottom-0 -ml-2 w-4 cursor-ew-resize"
                style={{ left: `${ratio * 100}%` }}
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
                onPointerDown={(e) => handlePointerDownDivider(e, 'row', idx)}
                className="group absolute left-0 right-0 -mt-2 h-4 cursor-ns-resize"
                style={{ top: `${ratio * 100}%` }}
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
          onClick={() => onConfirm(colDividers, rowDividers, columns, rows)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 transition hover:opacity-95"
        >
          <Check className="h-3.5 w-3.5" />
          <span>この区画で高精度解析を開始 ({columns * rows}コマ)</span>
        </button>
      </div>
    </div>
  );
}
