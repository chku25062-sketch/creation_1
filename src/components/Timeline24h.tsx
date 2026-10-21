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
import { TheoreticalBlock, TaskItem, ImportedTableData } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

interface Timeline24hProps {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
  dayBlocks?: Record<number, TheoreticalBlock[]>;
  importedTables?: ImportedTableData[];
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

// 参照元の表ごとに割り当てる柔らかなパステル＆くすみカラーパレット（12色）
export const TABLE_PALETTES: TableColorScheme[] = [
  // 1. ペールブルー（薄水）
  {
    bg: '#f4f9fd',
    border: '#cfe2f3',
    text: '#335c7d',
    strip: '#6ba3cf',
    badgeBg: '#e5f0f9',
    badgeText: '#2c5270',
    badgeBorder: '#bdd5ea',
    accent: '#8ebde3',
  },
  // 2. さくらピンク（桜色）
  {
    bg: '#fdf5f6',
    border: '#f5d5da',
    text: '#844853',
    strip: '#d9828e',
    badgeBg: '#fbe6e9',
    badgeText: '#783c46',
    badgeBorder: '#eec0c7',
    accent: '#e59ca6',
  },
  // 3. セージグリーン（若草）
  {
    bg: '#f4f8f5',
    border: '#cde2d3',
    text: '#385e45',
    strip: '#6ea680',
    badgeBg: '#e4f0e7',
    badgeText: '#30533d',
    badgeBorder: '#bed9c6',
    accent: '#8bc49e',
  },
  // 4. ラベンダー（藤色）
  {
    bg: '#f8f6fc',
    border: '#dfd7f2',
    text: '#594c74',
    strip: '#9683bf',
    badgeBg: '#ede8fa',
    badgeText: '#4e4169',
    badgeBorder: '#d1c5ea',
    accent: '#ab99d4',
  },
  // 5. アプリコット（杏色）
  {
    bg: '#fdf7f2',
    border: '#f5dccb',
    text: '#7a4d33',
    strip: '#d88f67',
    badgeBg: '#fce9dd',
    badgeText: '#6e432a',
    badgeBorder: '#ecc9b3',
    accent: '#e2a582',
  },
  // 6. スレートブルー（藍白）
  {
    bg: '#f3f6f9',
    border: '#ccd8e4',
    text: '#3c4f65',
    strip: '#6f8ca8',
    badgeBg: '#e3ebf3',
    badgeText: '#324255',
    badgeBorder: '#bdcddc',
    accent: '#8ba5be',
  },
  // 7. シーフォーム（浅葱）
  {
    bg: '#f3f9f8',
    border: '#cae6e3',
    text: '#2e5b56',
    strip: '#5fa8a0',
    badgeBg: '#deefec',
    badgeText: '#254d48',
    badgeBorder: '#b8deda',
    accent: '#7bc0b8',
  },
  // 8. ダスティローズ（灰桜）
  {
    bg: '#faf5f7',
    border: '#eed4de',
    text: '#744558',
    strip: '#c27a96',
    badgeBg: '#f6e4ec',
    badgeText: '#663b4d',
    badgeBorder: '#e3bfce',
    accent: '#cf8fa7',
  },
  // 9. アイスブルー（空色）
  {
    bg: '#f3fafb',
    border: '#c8e8ed',
    text: '#2b5a63',
    strip: '#5aa6b5',
    badgeBg: '#dcf1f4',
    badgeText: '#224b53',
    badgeBorder: '#b6e0e7',
    accent: '#77bcc8',
  },
  // 10. オリーブグリーン（萌黄）
  {
    bg: '#f7f8f2',
    border: '#d8dec3',
    text: '#4a5530',
    strip: '#829656',
    badgeBg: '#eaeed8',
    badgeText: '#3e4727',
    badgeBorder: '#c7cfad',
    accent: '#9cb071',
  },
  // 11. ミルクティー（薄香）
  {
    bg: '#f9f6f2',
    border: '#e4dad0',
    text: '#5e4e42',
    strip: '#a68d77',
    badgeBg: '#ede4db',
    badgeText: '#504136',
    badgeBorder: '#d8cac0',
    accent: '#baa592',
  },
  // 12. ペールバイオレット（紫苑）
  {
    bg: '#f7f5fa',
    border: '#dbd3ea',
    text: '#4e4266',
    strip: '#8875a8',
    badgeBg: '#ebe4f5',
    badgeText: '#423757',
    badgeBorder: '#ccc2df',
    accent: '#9d8cb9',
  },
];

export interface TablePaletteOption {
  index: number;
  name: string;
  color: TableColorScheme;
}

export const TABLE_PALETTE_OPTIONS: TablePaletteOption[] = [
  { index: 0, name: 'ペールブルー (薄水)', color: TABLE_PALETTES[0] },
  { index: 1, name: 'さくらピンク (桜色)', color: TABLE_PALETTES[1] },
  { index: 2, name: 'セージグリーン (若草)', color: TABLE_PALETTES[2] },
  { index: 3, name: 'ラベンダー (藤色)', color: TABLE_PALETTES[3] },
  { index: 4, name: 'アプリコット (杏色)', color: TABLE_PALETTES[4] },
  { index: 5, name: 'スレートブルー (藍白)', color: TABLE_PALETTES[5] },
  { index: 6, name: 'シーフォーム (浅葱)', color: TABLE_PALETTES[6] },
  { index: 7, name: 'ダスティローズ (灰桜)', color: TABLE_PALETTES[7] },
  { index: 8, name: 'アイスブルー (空色)', color: TABLE_PALETTES[8] },
  { index: 9, name: 'オリーブグリーン (萌黄)', color: TABLE_PALETTES[9] },
  { index: 10, name: 'ミルクティー (薄香)', color: TABLE_PALETTES[10] },
  { index: 11, name: 'ペールバイオレット (紫苑)', color: TABLE_PALETTES[11] },
];

// 表を持たない特殊ブロック専用パレット（柔らかなトーン）
export const REST_PALETTE: TableColorScheme = {
  bg: '#f3f9f5',
  border: '#cde4d4',
  text: '#356346',
  strip: '#6cb083',
  badgeBg: '#e2f0e6',
  badgeText: '#2d543b',
  badgeBorder: '#bcd9c5',
  accent: '#82c097',
};

export const FIXED_PALETTE: TableColorScheme = {
  bg: '#f7f4ef',
  border: '#ded7cb',
  text: '#555e69',
  strip: '#9ea8b5',
  badgeBg: '#ece6dc',
  badgeText: '#464f59',
  badgeBorder: '#cec6ba',
  accent: '#adb6c2',
};

export const DEFAULT_TASK_PALETTE: TableColorScheme = {
  bg: '#fefcf0',
  border: '#f7ecc2',
  text: '#715822',
  strip: '#dfbf65',
  badgeBg: '#fcf4d7',
  badgeText: '#624b1a',
  badgeBorder: '#eddca3',
  accent: '#e6cb7e',
};

export const LECTURE_PALETTE: TableColorScheme = TABLE_PALETTES[0];
export const ASSIGNMENT_PALETTE: TableColorScheme = TABLE_PALETTES[3];

/**
 * 0, 1, 2... のインデックスに対して重複のないカラーパレットを取得・動的生成する
 * 12個を超える表があっても黄金比アングル（137.508度）により完全に一意なくすみパステルを算出
 */
export function getTableColorSchemeByIndex(index: number): TableColorScheme {
  if (index >= 0 && index < TABLE_PALETTES.length) {
    return TABLE_PALETTES[index];
  }
  // 12色を超える場合も、彩度を45%程度に抑えた上質なくすみパステルを動的生成（重複ゼロ）
  const hue = Math.round((index * 137.5077) % 360);
  return {
    bg: `hsl(${hue}, 48%, 97%)`,
    border: `hsl(${hue}, 40%, 84%)`,
    text: `hsl(${hue}, 38%, 32%)`,
    strip: `hsl(${hue}, 46%, 62%)`,
    badgeBg: `hsl(${hue}, 42%, 93%)`,
    badgeText: `hsl(${hue}, 42%, 28%)`,
    badgeBorder: `hsl(${hue}, 36%, 78%)`,
    accent: `hsl(${hue}, 46%, 68%)`,
  };
}

/**
 * ブロックから適切なカラーパレットを決定する関数
 * tableColorMap が渡された場合は表ごとの固有カラーを確実に引き、重複を完全排除する
 */
export function getBlockColorScheme(
  block: TheoreticalBlock,
  tableColorMap?: Map<string, TableColorScheme>,
): TableColorScheme {
  // ① 休憩ブロック
  if (block.isBreak) {
    return REST_PALETTE;
  }

  // ② 参照元の表が指定されている場合
  const tableName = (block.sourceTableName || block.sourceTableId || '').trim();
  if (tableName) {
    if (tableColorMap && tableColorMap.has(tableName)) {
      return tableColorMap.get(tableName)!;
    }
    // マップ未指定時のフォールバック（文字列ハッシュで決定）
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
      return LECTURE_PALETTE;
    }
    return FIXED_PALETTE;
  }

  // ④ 表指定がない通常タスク（基本設定のタスク）
  if (block.taskType === 'assignment') {
    return ASSIGNMENT_PALETTE;
  }
  return DEFAULT_TASK_PALETTE;
}

export function Timeline24h({
  blocks,
  unassignedTasks,
  dayBlocks,
  importedTables,
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

  // 参照元の表ごとにユニークなカラーを割り当てるマップ
  // 1. ユーザーが表のツールで色を選択している場合 (colorIndex) はその色を最優先
  // 2. 未指定の表には、まだ使われていないカラーインデックスを順次割り当てて重複を完全排除
  const tableColorMap = useMemo(() => {
    const colorMap = new Map<string, TableColorScheme>();
    const usedIndices = new Set<number>();

    // ① まず importedTables の中で明示的に colorIndex が設定されている表を登録
    if (importedTables) {
      for (const tbl of importedTables) {
        if (tbl.colorIndex !== undefined) {
          const color = getTableColorSchemeByIndex(tbl.colorIndex);
          if (tbl.name.trim()) colorMap.set(tbl.name.trim(), color);
          if (tbl.id) colorMap.set(tbl.id, color);
          usedIndices.add(tbl.colorIndex % TABLE_PALETTES.length);
        }
      }
    }

    // ② 未指定の表を収集
    const pendingNames: string[] = [];
    if (importedTables) {
      for (const tbl of importedTables) {
        const name = tbl.name.trim();
        if (name && !colorMap.has(name) && !pendingNames.includes(name)) {
          pendingNames.push(name);
        }
      }
    }

    // ブロック内に登場する表名（未登録の表など）も収集
    const allCandidateBlocks: TheoreticalBlock[] = [];
    if (dayBlocks) {
      Object.values(dayBlocks).forEach((arr) => allCandidateBlocks.push(...arr));
    } else {
      allCandidateBlocks.push(...blocks);
    }
    for (const b of allCandidateBlocks) {
      const name = (b.sourceTableName || b.sourceTableId || '').trim();
      if (name && !colorMap.has(name) && !pendingNames.includes(name)) {
        pendingNames.push(name);
      }
    }

    // ③ 未使用のカラーインデックスを順番に割り当てて、重複を完全に防ぐ
    let nextAvailableIdx = 0;
    for (const name of pendingNames) {
      while (
        usedIndices.has(nextAvailableIdx % TABLE_PALETTES.length) &&
        usedIndices.size < TABLE_PALETTES.length
      ) {
        nextAvailableIdx++;
      }
      const color = getTableColorSchemeByIndex(nextAvailableIdx);
      colorMap.set(name, color);
      usedIndices.add(nextAvailableIdx % TABLE_PALETTES.length);
      nextAvailableIdx++;
    }

    return colorMap;
  }, [importedTables, blocks, dayBlocks]);

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

                      // ★ 参照元の表ごとのカラーパレットを取得（表ごとに重複のない一意カラー）
                      const colorScheme = getBlockColorScheme(block, tableColorMap);

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
                                {block.breakMinutes !== undefined && block.breakMinutes > 0 && (
                                  <span
                                    className="shrink-0 rounded bg-emerald-100/80 px-1 py-0.2 text-[9px] font-medium text-emerald-800"
                                    title={`タスク後の余白（休憩）: ${block.breakMinutes}分`}
                                  >
                                    余白 {block.breakMinutes}m
                                  </span>
                                )}
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
