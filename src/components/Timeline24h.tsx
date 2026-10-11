'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Calendar, Clock, AlertTriangle, Compass, BookOpen } from 'lucide-react';
import { TheoreticalBlock, TaskItem } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

interface Timeline24hProps {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
  dayBlocks?: Record<number, TheoreticalBlock[]>;
}

const HOUR_HEIGHT = 56; // 1時間あたりのマス目の高さ(px)
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 1344px

const WEEKDAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];

export function Timeline24h({ blocks, unassignedTasks, dayBlocks }: Timeline24hProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [nowTimeString, setNowTimeString] = useState<string>('');

  // 今週（月曜〜日曜）の7日間の日付情報を算出
  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = (now.getDay() + 6) % 7; // 月曜=0 ... 日曜=6
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayOfWeek);

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      return {
        date: d,
        month: d.getMonth() + 1,
        day: d.getDate(),
        dayOfWeek: WEEKDAY_NAMES[i],
        dayIndex: i,
        isToday,
        isSaturday: i === 5,
        isSunday: i === 6,
      };
    });
  }, []);

  // 現在時刻を参照して初期スクロール位置を調整（現在時刻の約45分前を画面上部に持ってくる）
  useEffect(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    setNowTimeString(minutesToTimeString(currentMinutes));

    if (scrollContainerRef.current) {
      const targetScroll = Math.max(0, ((currentMinutes - 45) / 60) * HOUR_HEIGHT);
      scrollContainerRef.current.scrollTop = targetScroll;
    }
  }, []);

  const scrollToNow = () => {
    if (scrollContainerRef.current) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetScroll = Math.max(0, ((currentMinutes - 45) / 60) * HOUR_HEIGHT);
      scrollContainerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
    }
  };

  const weekRangeString = useMemo(() => {
    if (weekDays.length < 7) return '';
    const start = weekDays[0];
    const end = weekDays[6];
    return `${start.month}/${start.day} (${start.dayOfWeek}) 〜 ${end.month}/${end.day} (${end.dayOfWeek})`;
  }, [weekDays]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:p-4">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">
            週間 24時間マス目スケジュール
          </h3>
          <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 md:inline-block font-medium">
            {weekRangeString}
          </span>
        </div>

        {/* Legend & Current Time Scroll Action */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-slate-300 border border-slate-400" />
              固定枠
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-blue-500 shadow-xs" />
              目標タスク
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-purple-500 shadow-xs" />
              課題・提出
            </span>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2.5">
            <button
              onClick={scrollToNow}
              title="現在時刻の位置へスクロール"
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Compass className="h-3 w-3 text-blue-600" />
              <span>現在時刻へ ({nowTimeString || '今'})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unassigned Warning Alert if any */}
      {unassignedTasks.length > 0 && (
        <div className="flex shrink-0 items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold text-amber-900">
              枠不足により本日未配置のタスクがあります（{unassignedTasks.length}件）:
            </span>
            <ul className="mt-0.5 list-inside list-disc text-amber-800">
              {unassignedTasks.map((t) => (
                <li key={t.id}>
                  {t.title} ({formatDuration(t.durationMinutes)}) - 優先度: {t.priority}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 7-Day Vertical Weekly Grid Container */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Sticky Weekday Header Row */}
        <div className="flex shrink-0 border-b border-slate-200 bg-slate-50/90 pr-2 pl-2">
          {/* Time axis header space */}
          <div className="w-12 shrink-0 border-r border-slate-200 py-2 text-center font-mono text-[10px] font-medium text-slate-500 sm:w-14">
            時間
          </div>

          {/* 7 Column Headers */}
          <div className="grid flex-1 grid-cols-7">
            {weekDays.map((d) => (
              <div
                key={`weekday-header-${d.dayIndex}`}
                className={`flex flex-col items-center justify-center border-r border-slate-200 py-1.5 transition ${
                  d.dayIndex === 6 ? 'border-r-0' : ''
                } ${d.isToday ? 'bg-blue-50/70 font-bold' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={`text-xs ${
                      d.isToday
                        ? 'text-blue-700 font-bold'
                        : d.isSaturday
                          ? 'text-blue-600 font-medium'
                          : d.isSunday
                            ? 'text-rose-600 font-medium'
                            : 'text-slate-700 font-medium'
                    }`}
                  >
                    {d.dayOfWeek}
                  </span>
                  {d.isToday && (
                    <span className="rounded bg-blue-100 px-1 py-0.2 text-[9px] font-bold text-blue-700">
                      今日
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {d.month}/{d.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable 24-Hour Grid Area */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2"
        >
          <div className="relative flex min-w-[700px]" style={{ height: `${TOTAL_HEIGHT}px` }}>
            {/* Left Time Axis Labels (00:00 - 24:00) */}
            <div className="relative w-12 shrink-0 select-none border-r border-slate-200 sm:w-14">
              {Array.from({ length: TOTAL_HOURS + 1 }).map((_, hour) => (
                <div
                  key={`time-label-${hour}`}
                  className="absolute right-2 -translate-y-1/2 font-mono text-[10px] font-medium text-slate-400 sm:text-[11px]"
                  style={{ top: `${hour * HOUR_HEIGHT}px` }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* 7 Columns Grid */}
            <div className="relative grid flex-1 grid-cols-7">
              {weekDays.map((d) => {
                // その曜日に割り振られたブロック（dayBlocksがある場合はそれを使用、なければblocks）
                const currentDayBlocks = dayBlocks ? dayBlocks[d.dayIndex] || [] : blocks;

                return (
                  <div
                    key={`weekday-col-${d.dayIndex}`}
                    className={`relative border-r border-slate-200 ${
                      d.dayIndex === 6 ? 'border-r-0' : ''
                    } ${d.isToday ? 'bg-blue-50/20' : ''}`}
                  >
                    {/* 1-hour Horizontal Grid Lines & 30-min dashed lines */}
                    {Array.from({ length: TOTAL_HOURS }).map((_, hour) => (
                      <div
                        key={`grid-cell-${d.dayIndex}-${hour}`}
                        className="relative border-b border-slate-100"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        <div
                          className="absolute inset-x-0 border-b border-dashed border-slate-100"
                          style={{ top: `${HOUR_HEIGHT / 2}px` }}
                        />
                      </div>
                    ))}

                    {/* Scheduled Blocks for this Day */}
                    {currentDayBlocks.map((block) => {
                      const top = (block.startMinutes / 60) * HOUR_HEIGHT;
                      const duration = block.endMinutes - block.startMinutes;
                      const height = (duration / 60) * HOUR_HEIGHT;
                      const isShort = duration <= 30;
                      const isAssignment = block.taskType === 'assignment';

                      return (
                        <div
                          key={`block-${d.dayIndex}-${block.id}`}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(20, height - 2)}px`,
                          }}
                          className={`group absolute inset-x-0.5 overflow-hidden rounded-md border transition-all hover:z-20 hover:shadow-md sm:inset-x-1 ${
                            block.isFixed
                              ? 'border-slate-200 bg-slate-100/90 hover:border-slate-300'
                              : isAssignment
                                ? 'border-purple-200 bg-purple-50/95 hover:border-purple-300 shadow-2xs'
                                : 'border-blue-200 bg-blue-50/95 hover:border-blue-300 shadow-2xs'
                          }`}
                        >
                          {/* Left Color Indicator */}
                          <div
                            className="absolute inset-y-0 left-0 w-1"
                            style={{ backgroundColor: block.color }}
                          />

                          {/* Block Content */}
                          <div className="flex h-full flex-col justify-between p-1 pl-2">
                            <div className="flex items-start justify-between gap-0.5 overflow-hidden">
                              <span
                                className={`truncate text-[11px] font-bold leading-tight ${
                                  block.isFixed
                                    ? 'text-slate-800'
                                    : isAssignment
                                      ? 'text-purple-950'
                                      : 'text-blue-950'
                                }`}
                              >
                                {block.title}
                              </span>
                              {isAssignment && block.deadlineDay !== undefined && (
                                <span className="shrink-0 rounded bg-rose-100 px-1 py-0.2 text-[9px] font-semibold text-rose-700">
                                  期日:{WEEKDAY_NAMES[block.deadlineDay]}
                                </span>
                              )}
                              {!isShort && !isAssignment && (
                                <span className="hidden shrink-0 rounded border border-slate-200 bg-white/80 px-1 py-0.2 font-mono text-[9px] text-slate-600 2xl:inline-block">
                                  {formatDuration(duration)}
                                </span>
                              )}
                            </div>

                            {!isShort && (
                              <div className="flex items-center gap-0.5 font-mono text-[9px] text-slate-500">
                                {isAssignment ? (
                                  <BookOpen className="h-2 w-2 text-purple-600" />
                                ) : (
                                  <Clock className="h-2 w-2 text-slate-400" />
                                )}
                                <span className="truncate">
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
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
