'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { TheoreticalBlock, TaskItem } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

interface Timeline24hProps {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
  dayBlocks?: Record<number, TheoreticalBlock[]>;
  focusMode?: 'week' | 'today';
  onToggleFocus?: () => void;
}

const TOTAL_HOURS = 24;
const WEEKDAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];

export function Timeline24h({
  blocks,
  unassignedTasks,
  dayBlocks,
  focusMode = 'today',
}: Timeline24hProps) {
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

  // 今日の曜日インデックス (0=月 ... 6=日)
  const todayIndex = useMemo(() => {
    const now = new Date();
    return (now.getDay() + 6) % 7;
  }, []);

  // フォーカスモードで現在選択されている曜日のインデックス
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayIndex);

  // 表示する曜日配列 (todayフォーカス時は選択された1日、week時は7日間)
  const displayedDays = useMemo(() => {
    if (focusMode === 'today') {
      const target =
        weekDays.find((d) => d.dayIndex === selectedDayIndex) ||
        weekDays.find((d) => d.dayIndex === todayIndex) ||
        weekDays[0];
      return target ? [target] : [weekDays[0]];
    }
    return weekDays;
  }, [focusMode, weekDays, selectedDayIndex, todayIndex]);

  // 現在時刻（リアルタイム更新）
  const [currentMinutes, setCurrentMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      setCurrentMinutes(mins);
      setNowTimeString(minutesToTimeString(mins));
    };
    update();
    const interval = setInterval(update, 30000); // 30秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  // 現在時刻を参照して初期スクロール位置を調整（現在時刻の約45分前を画面上部に持ってくる）
  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetScroll = Math.max(0, ((currentMinutes - 45) / 60) * hourHeight);
      scrollContainerRef.current.scrollTop = targetScroll;
    }
  }, [hourHeight]);

  // 時間軸の統一幅（ヘッダーとグリッドで完全一致させる）
  const timeAxisWidthClass = 'w-13 sm:w-15 shrink-0';

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 sm:p-2 shadow-2xs">
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
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        {/* Sticky Weekday Header Row（スクロールバーの有無によるズレ防止のため overflow-y-scroll コンテナと左右幅完全同期） */}
        <div className="flex shrink-0 border-b border-slate-200 bg-slate-50/95 px-1 sm:px-1.5">
          {/* Time axis header space */}
          <div
            className={`${timeAxisWidthClass} border-r border-slate-200 py-2 text-center font-mono text-[10px] font-medium text-slate-500`}
          >
            時間
          </div>

          {/* Column Headers: フォーカスモード(1日) ⇄ 週間全体(7列) */}
          {focusMode === 'today' ? (
            /* フォーカスモード（1日拡大）ヘッダー */
            <div className="flex flex-1 items-center justify-between px-1.5 sm:px-2 py-1 bg-amber-50/40">
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setSelectedDayIndex((prev) => (prev + 6) % 7)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition"
                  title="前の曜日へ"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {/* 曜日セレクターピル (月〜日) */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {weekDays.map((d) => (
                    <button
                      key={`day-pill-${d.dayIndex}`}
                      onClick={() => setSelectedDayIndex(d.dayIndex)}
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold transition ${
                        d.dayIndex === selectedDayIndex
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : d.isToday
                            ? 'bg-amber-200 text-amber-950 font-bold'
                            : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      {d.dayOfWeek}
                      {d.isToday && (
                        <span className="hidden sm:inline text-[9px] ml-0.5 opacity-90">
                          (今日)
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedDayIndex((prev) => (prev + 1) % 7)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition"
                  title="次の曜日へ"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center text-xs font-bold text-slate-800 shrink-0">
                <span className="font-mono text-slate-600 text-[11px]">
                  {displayedDays[0]?.month}/{displayedDays[0]?.day} ({displayedDays[0]?.dayOfWeek})
                </span>
              </div>
            </div>
          ) : (
            /* 週間全体（7列）ヘッダー */
            <div className="grid flex-1 grid-cols-7">
              {weekDays.map((d) => (
                <div
                  key={`weekday-header-${d.dayIndex}`}
                  className={`flex flex-col items-center justify-center border-r border-slate-200 py-1.5 transition ${
                    d.dayIndex === 6 ? 'border-r-0' : ''
                  } ${d.isToday ? 'bg-amber-100/40 font-bold' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs ${
                        d.isToday
                          ? 'text-amber-900 font-bold'
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
                      <span className="rounded bg-amber-400/90 px-1 py-0.2 text-[9px] font-bold text-amber-950">
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
          )}
        </div>

        {/* Scrollable 24-Hour Grid Area (ノート調方眼罫線) */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 min-h-0 overflow-y-auto overflow-x-auto px-1 sm:px-1.5 bg-[#fdfcf9]"
        >
          <div
            className={`relative flex ${focusMode === 'today' ? 'w-full min-w-0' : 'min-w-[700px]'}`}
            style={{ height: `${totalHeight}px` }}
          >
            {/* 全幅共通の水平グリッド罫線レイヤー（時間軸から全曜日の右端まで1ピクセルも狂わず貫通） */}
            <div className="pointer-events-none absolute inset-0 z-0">
              {Array.from({ length: TOTAL_HOURS }).map((_, hour) => (
                <div
                  key={`h-line-${hour}`}
                  className="absolute inset-x-0 border-b border-slate-200/70"
                  style={{ top: `${(hour + 1) * hourHeight}px` }}
                >
                  {/* 30分ごとの破線 */}
                  <div
                    className="absolute inset-x-0 border-b border-dashed border-slate-200/40"
                    style={{ top: `-${hourHeight / 2}px` }}
                  />
                </div>
              ))}
            </div>

            {/* Left Time Axis (00:00 - 24:00) */}
            <div
              className={`relative ${timeAxisWidthClass} select-none border-r border-slate-200 bg-[#fbfaf5]/90 z-20`}
            >
              {Array.from({ length: TOTAL_HOURS + 1 }).map((_, hour) => {
                const isFirst = hour === 0;
                const isLast = hour === TOTAL_HOURS;
                const topPos = hour * hourHeight;

                return (
                  <div
                    key={`time-label-${hour}`}
                    className="absolute inset-x-0 flex items-center justify-end pr-1 sm:pr-1.5"
                    style={{
                      top: isFirst ? '2px' : isLast ? `${totalHeight - 16}px` : `${topPos}px`,
                      transform: isFirst || isLast ? 'none' : 'translateY(-50%)',
                    }}
                  >
                    <span className="font-mono text-[10px] font-medium text-slate-400 sm:text-[11px]">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                    {/* 右端の目盛ティック（水平罫線とピタリ接続） */}
                    {!isFirst && !isLast && (
                      <span className="ml-1 h-px w-1 bg-slate-300 sm:w-1.5" />
                    )}
                  </div>
                );
              })}

              {/* 現在時刻の赤いピルバッジ */}
              <div
                className="pointer-events-none absolute right-0 z-30 -translate-y-1/2"
                style={{ top: `${(currentMinutes / 60) * hourHeight}px` }}
              >
                <span className="rounded-l bg-rose-500 px-1 py-0.5 font-mono text-[9px] font-bold text-white shadow-2xs">
                  {nowTimeString}
                </span>
              </div>
            </div>

            {/* Columns Grid: フォーカスモード(1列全幅) ⇄ 週間全体(7列) */}
            <div
              className={`relative grid flex-1 ${
                focusMode === 'today' ? 'grid-cols-1' : 'grid-cols-7'
              } z-10`}
            >
              {displayedDays.map((d, colIndex) => {
                // その曜日に割り振られたブロック（dayBlocksがある場合はそれを使用、なければblocks）
                const currentDayBlocks = dayBlocks ? dayBlocks[d.dayIndex] || [] : blocks;

                return (
                  <div
                    key={`weekday-col-${d.dayIndex}`}
                    className={`relative border-r border-slate-200/70 ${
                      colIndex === displayedDays.length - 1 ? 'border-r-0' : ''
                    } ${d.isToday ? 'bg-amber-100/15' : ''}`}
                    style={{ height: `${totalHeight}px` }}
                  >
                    {/* 今日の現在時刻インジケーター（赤ライン ＆ 赤丸） */}
                    {d.isToday && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
                        style={{ top: `${(currentMinutes / 60) * hourHeight}px` }}
                      >
                        <div className="-ml-1 h-2 w-2 rounded-full bg-rose-500 shadow-2xs ring-2 ring-white" />
                        <div className="h-0.5 flex-1 bg-rose-500 shadow-2xs" />
                      </div>
                    )}

                    {/* Scheduled Blocks for this Day: 付箋（Sticky Note）風レンダリング */}
                    {currentDayBlocks.map((block) => {
                      const top = Math.round((block.startMinutes / 60) * hourHeight) + 1;
                      const duration = block.endMinutes - block.startMinutes;
                      const rawHeight = (duration / 60) * hourHeight;
                      const height = Math.max(22, Math.round(rawHeight) - 2);
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
                          title={
                            block.sourceTableName
                              ? `${block.title} (参照元: ${block.sourceTableName})`
                              : block.title
                          }
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                          }}
                          className={`group !absolute inset-x-0.5 overflow-hidden rounded-md border sticky-note transition-all hover:z-20 sm:inset-x-1 ${stickyNoteClass}`}
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
                              {block.sourceTableName && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-0.5 rounded bg-emerald-100/90 border border-emerald-300 px-1 py-0.2 text-[8px] font-bold text-emerald-900 shadow-2xs"
                                  title={`参照元: ${block.sourceTableName}`}
                                >
                                  <FileSpreadsheet className="h-2 w-2 text-emerald-700" />
                                  <span className="max-w-[65px] truncate hidden sm:inline">
                                    {block.sourceTableName}
                                  </span>
                                </span>
                              )}
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
