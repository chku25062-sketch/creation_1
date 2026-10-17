'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Calendar, Clock, AlertTriangle, Compass, BookOpen, ZoomIn } from 'lucide-react';
import { TheoreticalBlock, TaskItem } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

interface Timeline24hProps {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
  dayBlocks?: Record<number, TheoreticalBlock[]>;
}

const TOTAL_HOURS = 24;
const WEEKDAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];
const HEIGHT_OPTIONS = [
  { label: '標準', value: 60 },
  { label: '拡大', value: 84 },
  { label: '特大', value: 110 },
];

export function Timeline24h({ blocks, unassignedTasks, dayBlocks }: Timeline24hProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [nowTimeString, setNowTimeString] = useState<string>('');
  const [hourHeight, setHourHeight] = useState<number>(84); // デフォルト84px（縦に大きく表示）

  // LocalStorage から保存されたマス高さを復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem('timeline_hour_height');
      if (saved) {
        const val = Number(saved);
        if ([60, 84, 110].includes(val)) {
          setHourHeight(val);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleHourHeightChange = (height: number) => {
    setHourHeight(height);
    try {
      localStorage.setItem('timeline_hour_height', String(height));
    } catch {
      // ignore
    }
  };

  const totalHeight = TOTAL_HOURS * hourHeight;

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
      const targetScroll = Math.max(0, ((currentMinutes - 45) / 60) * hourHeight);
      scrollContainerRef.current.scrollTop = targetScroll;
    }
  }, [hourHeight]);

  const scrollToNow = () => {
    if (scrollContainerRef.current) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetScroll = Math.max(0, ((currentMinutes - 45) / 60) * hourHeight);
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
    <div className="flex flex-1 min-h-0 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs sm:p-2.5">
      {/* Header Bar: 1行ですっきりとまとめ、マス高さ切り替えボタンを配置 */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-900 sm:text-sm">
            週間 24時間マス目スケジュール
          </h3>
          <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.2 text-[11px] text-slate-600 sm:inline-block font-medium">
            {weekRangeString}
          </span>
        </div>

        {/* Legend, Zoom height switcher, & Current Time Scroll Action */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {/* Legend */}
          <div className="hidden items-center gap-2 font-medium md:flex text-[11px]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-slate-300 border border-slate-400" />
              固定枠
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-blue-500 shadow-2xs" />
              目標タスク
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-purple-500 shadow-2xs" />
              課題・提出
            </span>
          </div>

          {/* マスの縦幅（ズーム）切り替えピル */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <span className="px-1.5 text-[10px] font-medium text-slate-500 flex items-center gap-0.5">
              <ZoomIn className="h-3 w-3" />
              <span className="hidden sm:inline">マス高さ:</span>
            </span>
            {HEIGHT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleHourHeightChange(opt.value)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                  hourHeight === opt.value
                    ? 'bg-blue-600 font-bold text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 現在時刻へスクロール */}
          <button
            onClick={scrollToNow}
            title="現在時刻の位置へスクロール"
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Compass className="h-3 w-3 text-blue-600" />
            <span>現在時刻 ({nowTimeString || '今'})</span>
          </button>
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

        {/* Scrollable 24-Hour Grid Area (ノート調方眼罫線) */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 min-h-0 overflow-y-auto overflow-x-auto p-1 sm:p-1.5 bg-[#fdfcf9]"
        >
          <div className="relative flex min-w-[700px]" style={{ height: `${totalHeight}px` }}>
            {/* Left Time Axis Labels (00:00 - 24:00) */}
            <div className="relative w-11 shrink-0 select-none border-r border-slate-200/80 bg-[#fbfaf5]/60 sm:w-14">
              {Array.from({ length: TOTAL_HOURS + 1 }).map((_, hour) => (
                <div
                  key={`time-label-${hour}`}
                  className="absolute right-1.5 -translate-y-1/2 font-mono text-[10px] font-medium text-slate-400 sm:right-2 sm:text-xs"
                  style={{ top: `${hour * hourHeight}px` }}
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
                    className={`relative border-r border-slate-200/70 ${
                      d.dayIndex === 6 ? 'border-r-0' : ''
                    } ${d.isToday ? 'bg-amber-100/15' : ''}`}
                  >
                    {/* 1-hour Horizontal Grid Lines & 30-min dashed lines (ノート罫線) */}
                    {Array.from({ length: TOTAL_HOURS }).map((_, hour) => (
                      <div
                        key={`grid-cell-${d.dayIndex}-${hour}`}
                        className="relative border-b border-slate-200/50"
                        style={{ height: `${hourHeight}px` }}
                      >
                        <div
                          className="absolute inset-x-0 border-b border-dashed border-slate-200/40"
                          style={{ top: `${hourHeight / 2}px` }}
                        />
                      </div>
                    ))}

                    {/* Scheduled Blocks for this Day: 付箋（Sticky Note）風レンダリング */}
                    {currentDayBlocks.map((block) => {
                      const top = (block.startMinutes / 60) * hourHeight;
                      const duration = block.endMinutes - block.startMinutes;
                      const height = (duration / 60) * hourHeight;
                      const isShort = duration < 30 || height < 32;
                      const isAssignment = block.taskType === 'assignment';
                      const isLecture = block.isFixed && block.category === 'lecture';
                      const isRoutineOrSleep = block.isFixed && !isLecture;

                      // 付箋風カラーパレットの判定
                      const stickyNoteClass = isAssignment
                        ? 'bg-[#f5eeff] border-[#d8b4fe] text-[#581c87]' // ラベンダー付箋（課題）
                        : isLecture
                          ? 'bg-[#e0f2fe] border-[#7dd3fc] text-[#0369a1]' // スカイブルー付箋（講義）
                          : isRoutineOrSleep
                            ? 'bg-[#f4efe6] border-[#dfd6c5] text-[#475569]' // クラフトペーパー付箋（生活固定）
                            : 'bg-[#fef9c3] border-[#fde047] text-[#854d0e]'; // イエロー付箋（目標タスク）

                      // のり付けカラーストリップ
                      const stripColor = isAssignment
                        ? '#9333ea'
                        : isLecture
                          ? '#0284c7'
                          : isRoutineOrSleep
                            ? '#94a3b8'
                            : '#eab308';

                      return (
                        <div
                          key={`block-${d.dayIndex}-${block.id}`}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(22, height - 2)}px`,
                          }}
                          className={`group absolute inset-x-0.5 overflow-hidden rounded-md border sticky-note transition-all hover:z-20 sm:inset-x-1 ${stickyNoteClass}`}
                        >
                          {/* 付箋のり付けストリップ (左端) */}
                          <div
                            className="absolute inset-y-0 left-0 w-1.5 opacity-90 shadow-2xs"
                            style={{ backgroundColor: stripColor }}
                          />

                          {/* Block Content */}
                          <div className="flex h-full flex-col justify-between p-1 pl-2.5">
                            <div className="flex items-start justify-between gap-1 overflow-hidden">
                              <span className="truncate text-xs font-bold leading-tight sm:text-[13px]">
                                {block.title}
                              </span>
                              {isAssignment && block.deadlineDay !== undefined && (
                                <span className="shrink-0 rounded bg-rose-200/90 px-1 py-0.2 text-[9px] font-bold text-rose-900 shadow-2xs">
                                  期日:{WEEKDAY_NAMES[block.deadlineDay]}
                                </span>
                              )}
                              {!isShort && !isAssignment && (
                                <span className="hidden shrink-0 rounded bg-white/70 px-1 py-0.2 font-mono text-[9px] text-slate-600 xl:inline-block shadow-2xs">
                                  {formatDuration(duration)}
                                </span>
                              )}
                            </div>

                            {!isShort && (
                              <div className="flex items-center gap-1 font-mono text-[10px] opacity-80 sm:text-[11px]">
                                {isAssignment ? (
                                  <BookOpen className="h-2.5 w-2.5 text-purple-700" />
                                ) : (
                                  <Clock className="h-2.5 w-2.5 text-slate-500" />
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
