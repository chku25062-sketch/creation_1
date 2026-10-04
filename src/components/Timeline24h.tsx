'use client';

import React, { useRef, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, ShieldCheck, Flame, Sun, Moon } from 'lucide-react';
import { TheoreticalBlock, TaskItem } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

interface Timeline24hProps {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
}

const HOUR_HEIGHT = 56; // 1時間あたりのマス目の高さ(px)
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 1344px

export function Timeline24h({ blocks, unassignedTasks }: Timeline24hProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 初期スクロール位置を朝07:00付近に設定
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 7 * HOUR_HEIGHT - 20;
    }
  }, []);

  const scrollToHour = (hour: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: hour * HOUR_HEIGHT - 20,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white sm:text-lg">24時間 マス目スケジュール</h3>
        </div>

        {/* Legend & Quick Jump */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-700 border border-slate-600" />
              固定枠
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500 shadow-sm shadow-cyan-500/50" />
              目標タスク
            </span>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
            <button
              onClick={() => scrollToHour(7)}
              title="朝 07:00 にスクロール"
              className="flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              <Sun className="h-3 w-3 text-amber-400" />朝 07:00
            </button>
            <button
              onClick={() => scrollToHour(19)}
              title="夜 19:00 にスクロール"
              className="flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              <Moon className="h-3 w-3 text-indigo-400" />夜 19:00
            </button>
          </div>
        </div>
      </div>

      {/* Unassigned Warning Alert if any */}
      {unassignedTasks.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <span className="font-semibold text-amber-300">
              枠不足により本日未配置のタスクがあります（{unassignedTasks.length}件）:
            </span>
            <ul className="mt-1 list-inside list-disc text-amber-200/90">
              {unassignedTasks.map((t) => (
                <li key={t.id}>
                  {t.title} ({formatDuration(t.durationMinutes)}) - 優先度: {t.priority}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 24-Hour Vertical Grid Container */}
      <div
        ref={scrollContainerRef}
        className="relative max-h-[700px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-2 sm:p-3"
      >
        <div className="relative flex" style={{ height: `${TOTAL_HEIGHT}px` }}>
          {/* Left Time Axis Labels (00:00 - 24:00) */}
          <div className="relative w-12 shrink-0 select-none sm:w-14">
            {Array.from({ length: TOTAL_HOURS + 1 }).map((_, hour) => (
              <div
                key={`time-label-${hour}`}
                className="absolute right-2 -translate-y-1/2 font-mono text-[11px] font-medium text-slate-500"
                style={{ top: `${hour * HOUR_HEIGHT}px` }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Right Grid Column with 1-hour cells */}
          <div className="relative flex-1 border-l border-slate-800">
            {/* 1-hour Horizontal Grid Lines & 30-min dashed sub-lines */}
            {Array.from({ length: TOTAL_HOURS }).map((_, hour) => (
              <div
                key={`grid-row-${hour}`}
                className="relative border-b border-slate-800/80"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {/* 30-minute dashed guide */}
                <div
                  className="absolute inset-x-0 border-b border-dashed border-slate-800/35"
                  style={{ top: `${HOUR_HEIGHT / 2}px` }}
                />
              </div>
            ))}

            {/* Scheduled Blocks Positioned Absolutely */}
            {blocks.map((block) => {
              const top = (block.startMinutes / 60) * HOUR_HEIGHT;
              const duration = block.endMinutes - block.startMinutes;
              const height = (duration / 60) * HOUR_HEIGHT;
              const isShort = duration <= 30;

              return (
                <div
                  key={block.id}
                  style={{
                    top: `${top}px`,
                    height: `${Math.max(22, height - 2)}px`,
                  }}
                  className={`group absolute inset-x-1.5 overflow-hidden rounded-lg border transition-all hover:z-20 hover:shadow-lg ${
                    block.isFixed
                      ? 'border-slate-700/80 bg-slate-900/90 hover:border-slate-600'
                      : 'border-cyan-500/50 bg-slate-800/95 hover:border-cyan-400 hover:shadow-cyan-500/10'
                  }`}
                >
                  {/* Left Accent Color Indicator */}
                  <div
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ backgroundColor: block.color }}
                  />

                  {/* Block Content */}
                  <div className="flex h-full flex-col justify-between p-1.5 pl-3">
                    <div className="flex items-start justify-between gap-1 overflow-hidden">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="truncate text-xs font-bold text-white">{block.title}</span>
                        {block.isFixed ? (
                          <span className="hidden shrink-0 items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1 py-0.2 text-[9px] text-slate-400 sm:inline-flex">
                            <ShieldCheck className="h-2.5 w-2.5 text-slate-400" />
                            固定
                          </span>
                        ) : (
                          <span className="hidden shrink-0 items-center gap-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 px-1 py-0.2 text-[9px] font-medium text-cyan-300 sm:inline-flex">
                            <Flame className="h-2.5 w-2.5 text-cyan-400" />
                            理論値
                          </span>
                        )}
                      </div>

                      <span className="shrink-0 rounded bg-slate-950/60 px-1.5 py-0.2 font-mono text-[10px] text-slate-400">
                        {formatDuration(duration)}
                      </span>
                    </div>

                    {!isShort && (
                      <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                        <Clock className="h-2.5 w-2.5 text-slate-500" />
                        <span>
                          {minutesToTimeString(block.startMinutes)} -{' '}
                          {minutesToTimeString(block.endMinutes)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
