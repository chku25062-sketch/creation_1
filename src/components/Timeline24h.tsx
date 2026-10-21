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

export interface TableColorScheme {
  bg: string;
  border: string;
  text: string;
  strip: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accent: string;
}

// 参照元の表ごとに割り当てる調和の取れたリッチな付箋カラーパレット
export const TABLE_PALETTES: TableColorScheme[] = [
  // 1. スカイブルー / 講義・大学時間割系
  {
    bg: '#f0f9ff',
    border: '#bae6fd',
    text: '#0369a1',
    strip: '#0284c7',
    badgeBg: '#e0f2fe',
    badgeText: '#0284c7',
    badgeBorder: '#7dd3fc',
    accent: '#38bdf8',
  },
  // 2. エメラルドグリーン / 筋トレ・健康・フィットネス系
  {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#065f46',
    strip: '#10b981',
    badgeBg: '#d1fae5',
    badgeText: '#047857',
    badgeBorder: '#6ee7b7',
    accent: '#34d399',
  },
  // 3. ウォームアンバー / ルーティン・日課表系
  {
    bg: '#fffbeb',
    border: '#fde68a',
    text: '#92400e',
    strip: '#f59e0b',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    badgeBorder: '#fcd34d',
    accent: '#fbbf24',
  },
  // 4. パープル・ラベンダー / 創作・プロジェクト系
  {
    bg: '#faf5ff',
    border: '#e9d5ff',
    text: '#6b21a8',
    strip: '#a855f7',
    badgeBg: '#f3e8ff',
    badgeText: '#7e22ce',
    badgeBorder: '#d8b4fe',
    accent: '#c084fc',
  },
  // 5. ローズ・コーラル / 重点タスク・締切系
  {
    bg: '#fff1f2',
    border: '#fecdd3',
    text: '#9f1239',
    strip: '#f43f5e',
    badgeBg: '#ffe4e6',
    badgeText: '#be123c',
    badgeBorder: '#fda4af',
    accent: '#fb7185',
  },
  // 6. インディゴ / 資格学習・研究系
  {
    bg: '#eef2ff',
    border: '#c7d2fe',
    text: '#3730a3',
    strip: '#6366f1',
    badgeBg: '#e0e7ff',
    badgeText: '#4338ca',
    badgeBorder: '#a5b4fc',
    accent: '#818cf8',
  },
  // 7. ティール / 趣味・アクティビティ系
  {
    bg: '#f0fdfa',
    border: '#99f6e4',
    text: '#115e59',
    strip: '#14b8a6',
    badgeBg: '#ccfbf1',
    badgeText: '#0f766e',
    badgeBorder: '#5eead4',
    accent: '#2dd4bf',
  },
  // 8. ウォームピーチ / その他業務系
  {
    bg: '#fff7ed',
    border: '#fed7aa',
    text: '#9a3412',
    strip: '#f97316',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    badgeBorder: '#fdba74',
    accent: '#fb923c',
  },
];

export function getBlockColorScheme(block: TheoreticalBlock): TableColorScheme {
  // ① 休憩ブロック
  if (block.isBreak) {
    return {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#166534',
      strip: '#22c55e',
      badgeBg: '#dcfce7',
      badgeText: '#15803d',
      badgeBorder: '#86efac',
      accent: '#4ade80',
    };
  }

  // ② 参照元の表が指定されている場合は、その表ごとの固有カラーを割り当て
  const tableName = block.sourceTableName || block.sourceTableId;
  if (tableName) {
    let hash = 0;
    for (let i = 0; i < tableName.length; i++) {
      hash = (hash << 5) - hash + tableName.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % TABLE_PALETTES.length;
    return TABLE_PALETTES[index];
  }

  // ③ 表指定がない固定枠（睡眠・生活リズム）
  if (block.isFixed) {
    if (block.category === 'lecture') {
      return TABLE_PALETTES[0]; // スカイブルー
    }
    return {
      bg: '#f4efe6',
      border: '#dfd6c5',
      text: '#475569',
      strip: '#94a3b8',
      badgeBg: '#e8e2d5',
      badgeText: '#334155',
      badgeBorder: '#cbd5e1',
      accent: '#94a3b8',
    };
  }

  // ④ 表指定がない通常タスク（基本設定のタスク）
  if (block.taskType === 'assignment') {
    return TABLE_PALETTES[3]; // ラベンダー（課題）
  }
  return {
    bg: '#fef9c3',
    border: '#fde047',
    text: '#854d0e',
    strip: '#eab308',
    badgeBg: '#fef08a',
    badgeText: '#a16207',
    badgeBorder: '#facc15',
    accent: '#facc15',
  };
}

export function Timeline24h({
  blocks,
  unassignedTasks,
  dayBlocks,
  focusMode = 'today',
}: Timeline24hProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [nowTimeString, setNowTimeString] = useState<string>('');
  const [hourHeight, setHourHeight] = useState<number>(126); // デフォルト126px（84pxの1.5倍に拡大）

  // LocalStorage から保存されたマス高さを復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem('timeline_hour_height');
      if (saved) {
        const val = Number(saved);
        if ([60, 84, 110, 126, 150].includes(val)) {
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

  // 現在スケジュール内に存在する参照元テーブルの一覧（カラー凡例用）
  const uniqueSourceTables = useMemo(() => {
    const tableMap = new Map<string, { name: string; color: TableColorScheme }>();
    const allCandidateBlocks: TheoreticalBlock[] = [];
    if (dayBlocks) {
      Object.values(dayBlocks).forEach((arr) => allCandidateBlocks.push(...arr));
    } else {
      allCandidateBlocks.push(...blocks);
    }

    for (const b of allCandidateBlocks) {
      if (b.sourceTableName) {
        if (!tableMap.has(b.sourceTableName)) {
          tableMap.set(b.sourceTableName, {
            name: b.sourceTableName,
            color: getBlockColorScheme(b),
          });
        }
      }
    }
    return Array.from(tableMap.values());
  }, [blocks, dayBlocks]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 sm:p-2 shadow-2xs">
      {/* 参照元テーブルのカラー凡例（Legend） */}
      {uniqueSourceTables.length > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg bg-slate-50/90 border border-slate-200/80 px-2.5 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-600 shrink-0 flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
              表ごとの色分け:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {uniqueSourceTables.map((t) => (
                <span
                  key={`legend-${t.name}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border shadow-2xs transition hover:scale-105"
                  style={{
                    backgroundColor: t.color.badgeBg,
                    color: t.color.badgeText,
                    borderColor: t.color.badgeBorder,
                  }}
                  title={`表名: ${t.name}`}
                >
                  <span
                    className="h-2 w-2 rounded-full ring-1 ring-white/60"
                    style={{ backgroundColor: t.color.strip }}
                  />
                  {t.name}
                </span>
              ))}
            </div>
          </div>
          <span className="hidden sm:inline text-[10px] text-slate-400 font-mono shrink-0">
            1時間 = 126px (1.5倍) / 10分・30分目盛り
          </span>
        </div>
      )}

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
        {/* Sticky Weekday Header Row */}
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
            {/* 全幅共通の水平グリッド罫線レイヤー（10分・30分・正時の目盛り線） */}
            <div className="pointer-events-none absolute inset-0 z-0">
              {Array.from({ length: TOTAL_HOURS }).map((_, hour) => {
                const hourBase = hour * hourHeight;
                return (
                  <div key={`h-layer-${hour}`} className="absolute inset-x-0" style={{ top: `${hourBase}px`, height: `${hourHeight}px` }}>
                    {/* 10分刻みの点線 */}
                    <div
                      className="absolute inset-x-0 border-b border-dotted border-slate-200/50"
                      style={{ top: `${(10 / 60) * hourHeight}px` }}
                    />
                    {/* 20分刻みの点線 */}
                    <div
                      className="absolute inset-x-0 border-b border-dotted border-slate-200/50"
                      style={{ top: `${(20 / 60) * hourHeight}px` }}
                    />
                    {/* 30分ごとの目盛り線（破線で強調） */}
                    <div
                      className="absolute inset-x-0 border-b border-dashed border-slate-300/80"
                      style={{ top: `${(30 / 60) * hourHeight}px` }}
                    />
                    {/* 40分刻みの点線 */}
                    <div
                      className="absolute inset-x-0 border-b border-dotted border-slate-200/50"
                      style={{ top: `${(40 / 60) * hourHeight}px` }}
                    />
                    {/* 50分刻みの点線 */}
                    <div
                      className="absolute inset-x-0 border-b border-dotted border-slate-200/50"
                      style={{ top: `${(50 / 60) * hourHeight}px` }}
                    />
                    {/* 60分（正時）の実線 */}
                    <div
                      className="absolute inset-x-0 border-b border-slate-300"
                      style={{ top: `${hourHeight}px` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Left Time Axis (00:00 - 24:00) */}
            <div
              className={`relative ${timeAxisWidthClass} select-none border-r border-slate-200 bg-[#fbfaf5]/90 z-20`}
            >
              {Array.from({ length: TOTAL_HOURS }).map((_, hour) => {
                const hourBase = hour * hourHeight;

                return (
                  <React.Fragment key={`axis-hour-${hour}`}>
                    {/* 正時ラベル（00:00 〜 23:00） */}
                    <div
                      className="absolute inset-x-0 flex items-center justify-end pr-1 sm:pr-1.5"
                      style={{
                        top: hour === 0 ? '2px' : `${hourBase}px`,
                        transform: hour === 0 ? 'none' : 'translateY(-50%)',
                      }}
                    >
                      <span className="font-mono text-[10px] font-semibold text-slate-500 sm:text-[11px]">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                      {hour > 0 && <span className="ml-1 h-px w-2 bg-slate-400" />}
                    </div>

                    {/* 10分目盛りティック */}
                    <div
                      className="absolute right-0 flex items-center"
                      style={{ top: `${hourBase + (10 / 60) * hourHeight}px` }}
                    >
                      <span className="h-px w-1 bg-slate-200" />
                    </div>

                    {/* 20分目盛りティック */}
                    <div
                      className="absolute right-0 flex items-center"
                      style={{ top: `${hourBase + (20 / 60) * hourHeight}px` }}
                    >
                      <span className="h-px w-1 bg-slate-200" />
                    </div>

                    {/* 30分目盛り（ラベル + ティック） */}
                    <div
                      className="absolute inset-x-0 flex items-center justify-end pr-1 sm:pr-1.5"
                      style={{
                        top: `${hourBase + (30 / 60) * hourHeight}px`,
                        transform: 'translateY(-50%)',
                      }}
                    >
                      <span className="font-mono text-[9px] font-medium text-slate-400">
                        :30
                      </span>
                      <span className="ml-1 h-px w-1.5 bg-slate-300" />
                    </div>

                    {/* 40分目盛りティック */}
                    <div
                      className="absolute right-0 flex items-center"
                      style={{ top: `${hourBase + (40 / 60) * hourHeight}px` }}
                    >
                      <span className="h-px w-1 bg-slate-200" />
                    </div>

                    {/* 50分目盛りティック */}
                    <div
                      className="absolute right-0 flex items-center"
                      style={{ top: `${hourBase + (50 / 60) * hourHeight}px` }}
                    >
                      <span className="h-px w-1 bg-slate-200" />
                    </div>
                  </React.Fragment>
                );
              })}

              {/* 24:00（終点ラベル） */}
              <div
                className="absolute inset-x-0 flex items-center justify-end pr-1 sm:pr-1.5"
                style={{
                  top: `${totalHeight - 14}px`,
                }}
              >
                <span className="font-mono text-[10px] font-semibold text-slate-500 sm:text-[11px]">
                  24:00
                </span>
                <span className="ml-1 h-px w-2 bg-slate-400" />
              </div>

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
                // その曜日に割り振られたブロック
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
                      const isShort = duration < 25 || height < 30;
                      const isAssignment = block.taskType === 'assignment';

                      // ★ 参照元の表ごとのカラーパレットを取得
                      const colorScheme = getBlockColorScheme(block);

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
                            backgroundColor: colorScheme.bg,
                            borderColor: colorScheme.border,
                            color: colorScheme.text,
                          }}
                          className="group !absolute inset-x-0.5 overflow-hidden rounded-md border sticky-note transition-all hover:z-20 sm:inset-x-1 shadow-2xs"
                        >
                          {/* 付箋のり付けストリップ (左端) */}
                          <div
                            className="absolute inset-y-0 left-0 w-1.5 opacity-90 shadow-2xs"
                            style={{ backgroundColor: colorScheme.strip }}
                          />

                          {/* Block Content */}
                          <div className="flex h-full flex-col justify-between p-1 pl-2.5">
                            <div className="flex items-start justify-between gap-1 overflow-hidden">
                              <span className="truncate text-xs font-bold leading-tight sm:text-[13px]">
                                {block.title}
                              </span>
                              {block.sourceTableName && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[8px] font-bold shadow-2xs border"
                                  style={{
                                    backgroundColor: colorScheme.badgeBg,
                                    color: colorScheme.badgeText,
                                    borderColor: colorScheme.badgeBorder,
                                  }}
                                  title={`参照元: ${block.sourceTableName}`}
                                >
                                  <FileSpreadsheet className="h-2 w-2" />
                                  <span className="max-w-[70px] truncate hidden sm:inline">
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
