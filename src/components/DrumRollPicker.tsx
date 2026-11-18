'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface DrumRollItem<T> {
  value: T;
  label: string;
}

interface DrumRollPickerProps<T> {
  items: DrumRollItem<T>[];
  value: T;
  onChange: (value: T) => void;
  itemHeight?: number; // default: 36px
  visibleCount?: number; // default: 3 or 5 (奇数推奨, default 3)
  className?: string;
  unit?: string;
  ariaLabel?: string;
}

export function DrumRollPicker<T extends string | number>({
  items,
  value,
  onChange,
  itemHeight = 36,
  visibleCount = 3,
  className = '',
  unit,
  ariaLabel,
}: DrumRollPickerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // コンテナの高さ
  const containerHeight = itemHeight * visibleCount;
  // 上下のスペーサー高さ（先頭・末尾が中央に来るようにする）
  const spacerHeight = Math.floor(visibleCount / 2) * itemHeight;

  // 現在選択されているアイテムのインデックス
  const selectedIndex = items.findIndex((it) => it.value === value);
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  // 選択値が変わったときに中央へスクロール（外部からの変更や初期ロード時）
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const container = containerRef.current;
      if (!container) return;
      const targetTop = index * itemHeight;
      if (Math.abs(container.scrollTop - targetTop) > 1) {
        container.scrollTo({
          top: targetTop,
          behavior,
        });
      }
    },
    [itemHeight]
  );

  useEffect(() => {
    // ユーザー自身がスクロール中ではない時のみ外部同期
    if (!isUserScrollingRef.current) {
      scrollToIndex(safeIndex, 'instant');
    }
  }, [safeIndex, scrollToIndex]);

  // スクロールイベントハンドラー
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    isUserScrollingRef.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!container) return;
      const scrollTop = container.scrollTop;
      const newIndex = Math.round(scrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, newIndex));

      if (items[clampedIndex] && items[clampedIndex].value !== value) {
        onChange(items[clampedIndex].value);
      }

      // スナップ位置へ吸い寄せ
      scrollToIndex(clampedIndex, 'smooth');

      // スクロール完了フラグ解除
      setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    }, 100);
  };

  // 前後ボタン
  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (safeIndex > 0) {
      const nextVal = items[safeIndex - 1].value;
      onChange(nextVal);
      scrollToIndex(safeIndex - 1, 'smooth');
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (safeIndex < items.length - 1) {
      const nextVal = items[safeIndex + 1].value;
      onChange(nextVal);
      scrollToIndex(safeIndex + 1, 'smooth');
    }
  };

  return (
    <div
      className={`relative inline-flex items-center select-none rounded-xl border border-slate-300 bg-white shadow-2xs ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {/* ドラムロール本体 */}
      <div
        className="relative overflow-hidden flex-1"
        style={{ height: `${containerHeight}px` }}
      >
        {/* 上部フェードグラデーション */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-linear-to-b from-white via-white/80 to-transparent"
          style={{ height: `${spacerHeight}px` }}
        />

        {/* 中央の選択枠ハイライト */}
        <div
          className="pointer-events-none absolute inset-x-1.5 z-5 rounded-lg border border-blue-400 bg-blue-50/70 shadow-inner"
          style={{
            top: `${spacerHeight}px`,
            height: `${itemHeight}px`,
          }}
        />

        {/* スクロール可能リスト */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto scroll-smooth snap-y snap-mandatory no-scrollbar"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* 上部スペーサー */}
          <div style={{ height: `${spacerHeight}px` }} />

          {/* アイテムリスト */}
          {items.map((item, idx) => {
            const isSelected = idx === safeIndex;
            return (
              <div
                key={String(item.value)}
                onClick={() => {
                  onChange(item.value);
                  scrollToIndex(idx, 'smooth');
                }}
                className={`snap-center flex items-center justify-center cursor-pointer px-4 font-mono transition-all duration-150 ${
                  isSelected
                    ? 'font-bold text-sm text-blue-700 scale-105'
                    : 'text-xs text-slate-400 hover:text-slate-600 scale-95 opacity-60'
                }`}
                style={{ height: `${itemHeight}px` }}
              >
                <span>{item.label}</span>
                {unit && isSelected && (
                  <span className="ml-1 text-xs font-bold text-blue-600">{unit}</span>
                )}
              </div>
            );
          })}

          {/* 下部スペーサー */}
          <div style={{ height: `${spacerHeight}px` }} />
        </div>

        {/* 下部フェードグラデーション */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-white via-white/80 to-transparent"
          style={{ height: `${spacerHeight}px` }}
        />
      </div>

      {/* 微調整用の上・下ボタン */}
      <div className="flex flex-col border-l border-slate-200 bg-slate-50/70">
        <button
          type="button"
          onClick={handlePrev}
          disabled={safeIndex <= 0}
          aria-label="前の値へ"
          className="flex h-[54px] w-7 items-center justify-center text-slate-500 hover:bg-slate-200/70 active:bg-slate-300 disabled:opacity-20 disabled:pointer-events-none transition"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <div className="h-px bg-slate-200 w-full" />
        <button
          type="button"
          onClick={handleNext}
          disabled={safeIndex >= items.length - 1}
          aria-label="次の値へ"
          className="flex h-[54px] w-7 items-center justify-center text-slate-500 hover:bg-slate-200/70 active:bg-slate-300 disabled:opacity-20 disabled:pointer-events-none transition"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
