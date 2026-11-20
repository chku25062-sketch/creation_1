'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Sparkles,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { TheoreticalBlock, TaskItem, ImportedTableData, AppThemeMode } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

export interface CellJumpTargetInfo {
  title?: string;
  dayIndex?: number;
  taskId?: string;
  startMinutes?: number;
}

interface Timeline24hProps {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
  dayBlocks?: Record<number, TheoreticalBlock[]>;
  importedTables?: ImportedTableData[];
  focusMode?: 'week' | 'today';
  onToggleFocus?: () => void;
  onToggleBlockComplete?: (block: TheoreticalBlock) => void;
  themeMode?: AppThemeMode;
  selectedDayIndex?: number;
  onSelectDayIndex?: (dayIndex: number) => void;
  overrideTodayIndex?: number;
  overrideCurrentMinutes?: number;
  isDebugTime?: boolean;
  onJumpToSourceTable?: (tableId: string, cellInfo?: CellJumpTargetInfo) => void;
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

// ★ 週タスク独自色専用パレット（知性と集中を促す洗練されたインディゴ・バイオレットトーン）
export const WEEKLY_TASK_PALETTE: TableColorScheme = {
  bg: '#f5f3ff', // Violet-50
  border: '#ddd6fe', // Violet-200
  text: '#4c1d95', // Violet-900 (視認性を最大限に高めた濃色バイオレット)
  strip: '#8b5cf6', // Violet-500
  badgeBg: '#ede9fe', // Violet-100
  badgeText: '#4c1d95', // Violet-900
  badgeBorder: '#c4b5fd',
  accent: '#a78bfa',
};

// Plan11: 完了状態専用の上品なグレートーンパレット
export const COMPLETED_PALETTE: TableColorScheme = {
  bg: '#f1f5f9', // Slate-100
  border: '#cbd5e1', // Slate-300
  text: '#64748b', // Slate-500
  strip: '#94a3b8', // Slate-400
  badgeBg: '#e2e8f0', // Slate-200
  badgeText: '#475569', // Slate-600
  badgeBorder: '#cbd5e1',
  accent: '#94a3b8',
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

  // ② 固定枠
  if (block.isFixed) {
    if (block.category === 'lecture') {
      return LECTURE_PALETTE;
    }
    return FIXED_PALETTE;
  }

  // ③ ★ 週タスク独自色で統一（isWeeklyTask === true のタスクはすべて統一カラー）
  if (block.isWeeklyTask) {
    return WEEKLY_TASK_PALETTE;
  }

  // ④ 参照元の表が指定されている場合
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

  // ⑤ 表指定がない通常タスク（基本設定のタスク）
  if (block.taskType === 'assignment') {
    return ASSIGNMENT_PALETTE;
  }
  return DEFAULT_TASK_PALETTE;
}

interface TimelineTaskCardBlockProps {
  block: TheoreticalBlock;
  colorScheme: TableColorScheme;
  isPlanner: boolean;
  height: number;
  duration: number;
  isShort: boolean;
  isSubstitute: boolean;
  isEarlyCompleted: boolean;
  isWeeklyTask: boolean;
  isAssignment: boolean;
  isCompletableBlock: boolean;
  displayEndMinutes: number;
  calculatedLines: number;
  onToggleBlockComplete?: (block: TheoreticalBlock) => void;
  onJumpToSourceTable?: (tableId: string, cellInfo?: CellJumpTargetInfo) => void;
}

function TimelineTaskCardBlock({
  block,
  colorScheme,
  isPlanner,
  height,
  duration,
  isShort,
  isSubstitute,
  isEarlyCompleted,
  isWeeklyTask,
  isAssignment,
  isCompletableBlock,
  displayEndMinutes,
  calculatedLines,
  onToggleBlockComplete,
  onJumpToSourceTable,
}: TimelineTaskCardBlockProps) {
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const [isPressing, setIsPressing] = useState(false);

  // 長押しタイマー開始 (500ms)
  const startLongPress = () => {
    isLongPressTriggeredRef.current = false;
    setIsPressing(true);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    pressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsPressing(false);
      if (typeof window !== 'undefined' && window.navigator && 'vibrate' in window.navigator) {
        try {
          window.navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
      if (block.sourceTableId && onJumpToSourceTable) {
        onJumpToSourceTable(block.sourceTableId, {
          title: block.title,
          dayIndex: block.dayIndex,
          taskId: block.id,
          startMinutes: block.startMinutes,
        });
      }
    }, 500);
  };

  // 長押しタイマー解除
  const cancelLongPress = () => {
    setIsPressing(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // メインカードのクリック（リンクを開く）
  const handleMainCardClick = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    if (block.url) {
      e.stopPropagation();
      window.open(block.url, '_blank', 'noopener,noreferrer');
    }
  };

  // 右クリックで元の表へジャンプ＆コマ編集を開く
  const handleContextMenu = (e: React.MouseEvent) => {
    if (block.sourceTableId && onJumpToSourceTable) {
      e.preventDefault();
      e.stopPropagation();
      onJumpToSourceTable(block.sourceTableId, {
        title: block.title,
        dayIndex: block.dayIndex,
        taskId: block.id,
        startMinutes: block.startMinutes,
      });
    }
  };

  // ツールチップ
  const tooltipText = useMemo(() => {
    const parts: string[] = [];
    if (block.title) parts.push(block.title);
    if (block.sourceTableName) parts.push(`参照元: ${block.sourceTableName}`);
    if (block.url) parts.push(`クリックでリンクを開く: ${block.url}`);
    if (block.sourceTableId && onJumpToSourceTable) {
      parts.push('長押しまたは右クリックで元の表データへ移動してコマ内容を編集');
    }
    return parts.join('\n');
  }, [block, onJumpToSourceTable]);

  return (
    <div
      className={`flex h-full w-full flex-row overflow-hidden transition-transform duration-150 ${
        isPressing ? 'scale-[0.98]' : ''
      }`}
      title={tooltipText}
    >
      {/* ========================================================
          1. メインカード本体（情報 ＆ リンク実行 ＆ 長押し逆引き）
          ======================================================== */}
      <div
        onClick={handleMainCardClick}
        onContextMenu={handleContextMenu}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        className={`flex-1 min-w-0 h-full flex flex-col justify-between ${
          isPlanner
            ? height < 32
              ? 'p-0.5 px-1 sm:px-1.5'
              : 'p-1 px-1.5 sm:px-2'
            : height < 32
              ? 'p-0.5 pl-2'
              : 'p-1 pl-2.5'
        } overflow-hidden select-none transition-colors ${
          block.url
            ? 'cursor-pointer hover:bg-black/[0.04]'
            : onJumpToSourceTable && block.sourceTableId
            ? 'cursor-pointer'
            : ''
        }`}
      >
        <div
          className={`flex items-${
            height < 32 ? 'center' : 'start'
          } justify-between gap-1 min-w-0 overflow-hidden`}
        >
          {/* タイトル領域 */}
          <div
            className="min-w-0 flex-1 leading-snug break-words [overflow-wrap:anywhere] text-xs sm:text-[13px] font-bold"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: calculatedLines,
              overflow: 'hidden',
            }}
          >
            {/* リンクがある場合は先頭にリンクアイコンを表示 */}
            {block.url && (
              <span
                className="inline-flex items-center text-blue-600 mr-1 align-baseline hover:scale-110 transition-transform"
                title={`リンク先: ${block.url}`}
              >
                <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline" />
              </span>
            )}

            {isSubstitute && (
              isPlanner ? (
                <span className="text-[10px] font-bold text-blue-600 mr-1 select-none align-baseline">
                  [代行]
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-0.5 rounded bg-blue-600 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs mr-1 align-baseline animate-pulse"
                  title={`元の予定「${block.substitutedForTitle}」の早期完了に伴い代行配置`}
                >
                  <Sparkles className="h-2 w-2" />
                  代行
                </span>
              )
            )}

            {isEarlyCompleted && (
              isPlanner ? (
                <span className="text-[10px] font-bold text-emerald-700 mr-1 select-none align-baseline">
                  [済]
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-0.5 rounded bg-emerald-600/90 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs mr-1 align-baseline"
                  title="前倒し完了済み"
                >
                  <CheckCircle2 className="h-2 w-2" />
                  完了
                </span>
              )
            )}

            {isWeeklyTask && !isSubstitute && !block.isCompleted && (
              isPlanner ? (
                <span
                  className="text-[10px] font-bold text-violet-700 mr-1 select-none align-baseline"
                  title="週タスク"
                >
                  [週]
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded bg-violet-600 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs mr-1 align-baseline"
                  title="週タスク"
                >
                  週
                </span>
              )
            )}

            {block.isRescheduled && (
              isPlanner ? (
                <span
                  className="text-[10px] font-bold text-amber-600 mr-1 select-none align-baseline"
                  title="やり残しのため未来の空き枠へ自動再スケジュール"
                >
                  [再]
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-0.5 rounded bg-amber-500 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs mr-1 align-baseline"
                  title="やり残しのため未来の空き枠へ自動再スケジュール"
                >
                  <RotateCcw className="h-2 w-2" />
                  再配置
                </span>
              )
            )}

            <span
              style={{
                color: block.isCompleted ? '#94a3b8' : colorScheme.text,
              }}
              className={`${
                block.isCompleted ? 'line-through opacity-70' : ''
              } ${isPlanner ? 'font-semibold tracking-tight' : 'font-bold'}`}
            >
              {block.title || '（名称未設定）'}
            </span>

            {isPlanner && isShort && (
              <span className="font-mono text-[9px] text-slate-400 font-normal ml-1 whitespace-nowrap">
                {minutesToTimeString(block.startMinutes)}
              </span>
            )}
          </div>

          {/* 期日バッジ */}
          <div className="shrink-0 flex items-center gap-1">
            {isAssignment && !isEarlyCompleted && block.deadlineDay !== undefined && (
              isPlanner ? (
                <span className="text-[9px] font-medium text-rose-700 mr-0.5">
                  期日:{WEEKDAY_NAMES[block.deadlineDay]}
                </span>
              ) : (
                <span className="rounded bg-rose-200/90 px-1 py-0.2 text-[9px] font-bold text-rose-900 shadow-2xs">
                  期日:{WEEKDAY_NAMES[block.deadlineDay]}
                </span>
              )
            )}
          </div>
        </div>

        {/* 付随情報（時間など） */}
        {!isShort && (
          <div
            className={`mt-auto shrink-0 flex items-center gap-1 font-mono text-[10px] ${
              isPlanner
                ? 'text-slate-500 pt-0 opacity-85'
                : 'text-slate-600 pt-0.5 opacity-80'
            } sm:text-[11px]`}
          >
            {isAssignment ? (
              <BookOpen className="h-2.5 w-2.5 text-purple-700 shrink-0" />
            ) : (
              <Clock className="h-2.5 w-2.5 text-slate-400 shrink-0" />
            )}
            <span className="truncate">
              {minutesToTimeString(block.startMinutes)} -{' '}
              {minutesToTimeString(displayEndMinutes)}
            </span>
            {duration >= 30 && (
              <span className="text-[9px] opacity-75">
                ({formatDuration(duration)})
              </span>
            )}
            {isSubstitute && block.substitutedForTitle && (
              isPlanner ? (
                <span className="text-[9px] text-blue-600 truncate max-w-[110px]">
                  ⇄ {block.substitutedForTitle}
                </span>
              ) : (
                <span
                  className="shrink-0 rounded bg-blue-100/90 px-1 py-0.2 text-[8px] font-bold text-blue-900 truncate max-w-[110px]"
                  title={`代行元: ${block.substitutedForTitle}`}
                >
                  ⇄ {block.substitutedForTitle}
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* ========================================================
          2. ドッキング・アクションバー（右端・完了トグル専用カード）
          ======================================================== */}
      {isCompletableBlock && onToggleBlockComplete && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleBlockComplete(block);
          }}
          className={`shrink-0 h-full flex items-center justify-center border-l transition-all cursor-pointer select-none ${
            height < 32 ? 'w-6 sm:w-7' : 'w-7 sm:w-8'
          } ${
            isPlanner
              ? block.isCompleted
                ? 'bg-slate-200/60 hover:bg-slate-300/80 border-slate-300 text-slate-600'
                : 'bg-black/[0.03] hover:bg-black/[0.08] border-slate-300/70 text-slate-400 hover:text-slate-700'
              : block.isCompleted
                ? 'bg-slate-200/70 hover:bg-slate-300/90 border-slate-200 text-slate-700'
                : 'bg-white/40 hover:bg-white/80 border-slate-200/60 text-slate-400 hover:text-blue-600'
          }`}
          title={
            block.isCompleted
              ? '完了状態です（クリックで未完了に戻す）'
              : '未完了です（クリックで完了にする）'
          }
        >
          {block.isCompleted ? (
            isPlanner ? (
              <span className="font-bold text-slate-600 font-mono text-[10px]">
                [✓]
              </span>
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 fill-emerald-100" />
            )
          ) : isPlanner ? (
            <span className="text-slate-400 font-mono text-[10px]">
              [ ]
            </span>
          ) : (
            <Circle className="h-3.5 w-3.5 text-slate-400/80 hover:text-blue-500" />
          )}
        </div>
      )}
    </div>
  );
}

export function Timeline24h({
  blocks,
  unassignedTasks,
  dayBlocks,
  importedTables,
  focusMode = 'today',
  onToggleBlockComplete,
  themeMode = 'planner',
  selectedDayIndex: controlledDayIndex,
  onSelectDayIndex,
  overrideTodayIndex,
  overrideCurrentMinutes,
  isDebugTime = false,
  onJumpToSourceTable,
}: Timeline24hProps) {
  const isPlanner = themeMode === 'planner';
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [nowTimeString, setNowTimeString] = useState<string>('');
  const [hourHeight, setHourHeight] = useState<number>(126); // デフォルト126px（84pxの1.5倍に拡大）
  const [isUnassignedAlertExpanded, setIsUnassignedAlertExpanded] = useState<boolean>(false);

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

  // 日付の切り替わり監視キー (YYYY-M-D)
  const [realDateKey, setRealDateKey] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  });

  // 今日の曜日インデックス (0=月 ... 6=日) — デバッグ日時が指定されている場合はそれを優先
  const todayIndex = useMemo(() => {
    if (overrideTodayIndex !== undefined) return overrideTodayIndex;
    const now = new Date();
    return (now.getDay() + 6) % 7;
  }, [overrideTodayIndex, realDateKey]);

  // 今週（月曜〜日曜）の7日間の日付情報を算出
  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = (now.getDay() + 6) % 7; // 月曜=0 ... 日曜=6
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayOfWeek);

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = i === todayIndex;

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
  }, [todayIndex, realDateKey]);

  // フォーカスモードで現在選択されている曜日のインデックス (外部制御対応)
  const [internalDayIndex, setInternalDayIndex] = useState<number>(todayIndex);
  const selectedDayIndex = controlledDayIndex !== undefined ? controlledDayIndex : internalDayIndex;

  // 今日のインデックス（todayIndex）が深夜0時やデバッグ変更で変わった際、内部選択曜日も追従
  useEffect(() => {
    setInternalDayIndex(todayIndex);
  }, [todayIndex]);

  const handleSelectDayIndex = (updater: number | ((prev: number) => number)) => {
    const next = typeof updater === 'function' ? updater(selectedDayIndex) : updater;
    setInternalDayIndex(next);
    onSelectDayIndex?.(next);
  };

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

  // 現在時刻（リアルタイム更新 or デバッグ時刻オーバーライド）
  const [realCurrentMinutes, setRealCurrentMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      setRealCurrentMinutes(mins);
      setNowTimeString(minutesToTimeString(mins));
      setRealDateKey(`${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`);
    };
    update();
    const interval = setInterval(update, 30000); // 30秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  const currentMinutes =
    overrideCurrentMinutes !== undefined ? overrideCurrentMinutes : realCurrentMinutes;
  const effectiveNowTimeString =
    overrideCurrentMinutes !== undefined
      ? minutesToTimeString(overrideCurrentMinutes)
      : nowTimeString;

  const hasInitialScrolledRef = useRef(false);
  const headerContainerRef = useRef<HTMLDivElement>(null);

  // タイムライングリッドの横スクロールを日付・曜日ヘッダーと完全同期
  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerContainerRef.current) {
      headerContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // 現在時刻を参照して初期スクロール位置を調整（初回のみ、即時スクロールでアニメーションなし）
  useEffect(() => {
    if (scrollContainerRef.current && !hasInitialScrolledRef.current) {
      hasInitialScrolledRef.current = true;
      const targetScroll = Math.max(0, ((currentMinutes - 45) / 60) * hourHeight);
      scrollContainerRef.current.scrollTop = targetScroll;
    }
  }, [hourHeight, currentMinutes]);

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
    <div className="flex flex-1 min-h-0 flex-col gap-1 w-full overflow-hidden">
      {/* Unassigned Warning Alert if any (折りたたみ可能な洗練されたアコーディオン表示) */}
      {unassignedTasks.length > 0 && (
        <div className="flex shrink-0 flex-col border border-amber-200/90 bg-amber-50/90 text-xs text-amber-900 overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => setIsUnassignedAlertExpanded((prev) => !prev)}
            className="flex items-center justify-between w-full p-2 px-3 hover:bg-amber-100/60 transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="font-semibold text-amber-950">
                枠不足により今週未配置のタスクがあります（{unassignedTasks.length}件）
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800">
              <span>{isUnassignedAlertExpanded ? '閉じる' : '詳細を表示'}</span>
              <span
                className={`transform transition-transform text-[10px] ${isUnassignedAlertExpanded ? 'rotate-180' : ''}`}
              >
                ▼
              </span>
            </div>
          </button>

          {isUnassignedAlertExpanded && (
            <div className="px-3 pb-2.5 pt-0.5 border-t border-amber-200/60 bg-amber-50/50">
              <ul className="mt-1 space-y-1 list-inside list-disc text-amber-800 text-[11px]">
                {unassignedTasks.map((t) => (
                  <li key={t.id}>
                    <span className="font-medium text-amber-900">{t.title}</span>
                    <span className="ml-1 text-amber-700 font-mono">
                      ({formatDuration(t.durationMinutes)})
                    </span>
                    <span className="ml-1.5 text-[10px] text-amber-600">
                      [優先度:{' '}
                      {t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低'}]
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 7-Day Vertical Weekly Grid Container (外側ラッパー) */}
      <div className="relative flex flex-1 min-h-0 flex-col border border-slate-200/90 overflow-hidden shadow-2xs">
        {/* Weekday Header Row (縦スクロール領域の外に完全常時固定配置されるため、縦スクロールで絶対に隠れない！) */}
        <div
          ref={headerContainerRef}
          className={`shrink-0 border-b-2 transition-colors z-20 overflow-x-hidden ${
            isPlanner ? 'border-slate-300 bg-[#f8f6f0]' : 'border-slate-300 bg-white'
          }`}
        >
          <div
            className={`flex ${
              focusMode === 'today' ? 'w-full min-w-0' : 'min-w-[720px] sm:min-w-[800px] w-full'
            }`}
          >
            {/* Time axis header space */}
            <div
              className={`${timeAxisWidthClass} border-r-2 border-slate-300 py-1.5 px-0.5 text-center flex flex-col items-center justify-center shrink-0 ${
                isPlanner ? 'bg-[#f4f1e8]' : 'bg-slate-100'
              }`}
            >
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-slate-600">
                時間
              </span>
            </div>

            {/* Column Headers: フォーカスモード(1日) ⇄ 週間全体(7列) */}
            {focusMode === 'today' ? (
              /* フォーカスモード（1日拡大）ヘッダー: モバイルでも日付が絶対に見切れないレイアウト */
              <div
                className={`flex flex-1 items-center justify-between px-1.5 sm:px-2 py-1 min-w-0 ${
                  isPlanner ? 'bg-[#f8f6f0]' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-0.5 sm:gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
                  <button
                    onClick={() => handleSelectDayIndex((prev) => (prev + 6) % 7)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition shrink-0"
                    title="前の曜日へ"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {/* 曜日セレクターピル (月〜日) */}
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    {weekDays.map((d) => (
                      <button
                        key={`day-pill-${d.dayIndex}`}
                        onClick={() => handleSelectDayIndex(d.dayIndex)}
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold transition shrink-0 ${
                          d.dayIndex === selectedDayIndex
                            ? isPlanner
                              ? 'bg-amber-800 text-white shadow-2xs'
                              : 'bg-blue-600 text-white shadow-2xs'
                            : d.isToday
                              ? 'bg-amber-200 text-amber-950 font-bold'
                              : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        {d.dayOfWeek}
                        {d.isToday && (
                          <span className="hidden md:inline text-[9px] ml-0.5 opacity-90">
                            (今日)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSelectDayIndex((prev) => (prev + 1) % 7)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition shrink-0"
                    title="次の曜日へ"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 日付ラベル (常に不透明・見切れなし) */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0 pl-1">
                  {isDebugTime && (
                    <span
                      className="hidden sm:inline rounded bg-amber-500/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-2xs"
                      title="メニューのデバッグ日時設定が適用されています"
                    >
                      固定日時: {WEEKDAY_NAMES[todayIndex]} {effectiveNowTimeString}
                    </span>
                  )}
                  <span className="font-mono text-slate-700 bg-slate-100/90 border border-slate-200/80 rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold shadow-2xs whitespace-nowrap">
                    {displayedDays[0]?.month}/{displayedDays[0]?.day} ({displayedDays[0]?.dayOfWeek})
                  </span>
                </div>
              </div>
            ) : (
              /* 週間全体（7列）ヘッダー: 各曜日に不透明な背景色を完全適用 */
              <div className="grid flex-1 grid-cols-7 divide-x divide-slate-200">
                {weekDays.map((d) => (
                  <div
                    key={`weekday-header-${d.dayIndex}`}
                    className={`flex flex-col items-center justify-center py-1.5 select-none ${
                      d.isToday
                        ? isPlanner
                          ? 'bg-amber-100/70 font-bold'
                          : 'bg-amber-100/80 font-bold'
                        : isPlanner
                          ? 'bg-[#f8f6f0]'
                          : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs ${
                          d.isToday
                            ? 'text-amber-950 font-bold'
                            : d.isSaturday
                              ? 'text-blue-600 font-bold'
                              : d.isSunday
                                ? 'text-rose-600 font-bold'
                                : 'text-slate-700 font-semibold'
                        }`}
                      >
                        {d.dayOfWeek}
                      </span>
                      {d.isToday && (
                        <span className="rounded bg-amber-400 px-1 py-0.2 text-[8px] font-bold text-amber-950 shadow-2xs">
                          今日
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 font-medium">
                      {d.month}/{d.day}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable 24-Hour Grid Area (縦スクロール領域) */}
        <div
          ref={scrollContainerRef}
          onScroll={handleGridScroll}
          className={`relative flex flex-1 min-h-0 overflow-y-auto overflow-x-auto scroll-instant ${
            isPlanner ? 'planner-paper-bg' : 'bg-[#fdfcf9]'
          }`}
        >
          <div
            className={`relative flex ${
              focusMode === 'today' ? 'w-full min-w-0' : 'min-w-[720px] sm:min-w-[800px] w-full'
            } pb-8`}
            style={{ height: `${totalHeight + 32}px` }}
          >
            {/* 全幅共通の水平グリッド罫線レイヤー（10分・30分・正時の目盛り線） */}
            <div className="pointer-events-none absolute inset-0 z-0">
              {Array.from({ length: TOTAL_HOURS }).map((_, hour) => {
                const hourBase = hour * hourHeight;
                return (
                  <div
                    key={`h-layer-${hour}`}
                    className="absolute inset-x-0"
                    style={{ top: `${hourBase}px`, height: `${hourHeight}px` }}
                  >
                    {/* 10分刻みの点線 */}
                    <div
                      className={`absolute inset-x-0 border-b ${
                        isPlanner ? 'border-[#e8e0d4]/80' : 'border-dotted border-slate-200/50'
                      }`}
                      style={{ top: `${(10 / 60) * hourHeight}px` }}
                    />
                    {/* 20分刻みの点線 */}
                    <div
                      className={`absolute inset-x-0 border-b ${
                        isPlanner ? 'border-[#e8e0d4]/80' : 'border-dotted border-slate-200/50'
                      }`}
                      style={{ top: `${(20 / 60) * hourHeight}px` }}
                    />
                    {/* 30分ごとの目盛り線（半時: 破線で強調） */}
                    <div
                      className={`absolute inset-x-0 border-b border-dashed ${
                        isPlanner ? 'border-[#cdbea8]' : 'border-slate-300/80'
                      }`}
                      style={{ top: `${(30 / 60) * hourHeight}px` }}
                    />
                    {/* 40分刻みの点線 */}
                    <div
                      className={`absolute inset-x-0 border-b ${
                        isPlanner ? 'border-[#e8e0d4]/80' : 'border-dotted border-slate-200/50'
                      }`}
                      style={{ top: `${(40 / 60) * hourHeight}px` }}
                    />
                    {/* 50分刻みの点線 */}
                    <div
                      className={`absolute inset-x-0 border-b ${
                        isPlanner ? 'border-[#e8e0d4]/80' : 'border-dotted border-slate-200/50'
                      }`}
                      style={{ top: `${(50 / 60) * hourHeight}px` }}
                    />
                    {/* 60分（正時）の実線 */}
                    <div
                      className={`absolute inset-x-0 border-b ${
                        isPlanner ? 'border-[#b5a38c]' : 'border-slate-300'
                      }`}
                      style={{ top: `${hourHeight}px` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Left Time Axis (00:00 - 24:00: 横スクロール時に画面端に固定) */}
            <div
              className={`sticky left-0 z-30 ${timeAxisWidthClass} select-none border-r shrink-0 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] ${
                isPlanner ? 'border-[#d6cbbe] bg-[#faf7f0]' : 'border-slate-200 bg-[#fbfaf5]'
              }`}
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
                      <span className="font-mono text-[9px] font-medium text-slate-400">:30</span>
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
                className="pointer-events-none absolute right-0 z-30 -translate-y-1/2 flex items-center"
                style={{ top: `${(currentMinutes / 60) * hourHeight}px` }}
              >
                <span
                  className={`rounded-l px-1 py-0.5 font-mono text-[9px] font-bold text-white shadow-2xs ${
                    isDebugTime ? 'bg-amber-600' : isPlanner ? 'bg-[#be123c]' : 'bg-rose-500'
                  }`}
                >
                  {effectiveNowTimeString}
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
                    className={`relative border-r ${
                      isPlanner ? 'border-[#cdbea8]' : 'border-slate-200/70'
                    } ${colIndex === displayedDays.length - 1 ? 'border-r-0' : ''} ${
                      d.isToday ? 'bg-amber-100/15' : ''
                    }`}
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
                    {(() => {
                      const activeBlocks = currentDayBlocks.filter((b) => !b.isEarlyCompleted);
                      const earlyBlocks = currentDayBlocks.filter((b) => b.isEarlyCompleted);
                      const coveredEarlyByActiveId = new Map<string, TheoreticalBlock[]>();
                      const renderItems: {
                        block: TheoreticalBlock;
                        displayEndMinutes: number;
                        coveredEarlyBlocks: TheoreticalBlock[];
                      }[] = [];

                      for (const eb of earlyBlocks) {
                        // 代行タスク（isSubstitute）で明示的にこの eb を代替しているタスクを優先検索
                        const directlySubstituted = activeBlocks.find(
                          (a) =>
                            a.isSubstitute &&
                            ((a.substitutedForBlockId && a.substitutedForBlockId === eb.id) ||
                              (a.substitutedForTitle && a.substitutedForTitle === eb.title)),
                        );

                        const overlappingActives = activeBlocks
                          .filter(
                            (a) => a.startMinutes < eb.endMinutes && a.endMinutes > eb.startMinutes,
                          )
                          .sort((a, b) => a.startMinutes - b.startMinutes);

                        const primaryCoveringActive = directlySubstituted || overlappingActives[0];

                        if (primaryCoveringActive) {
                          const list = coveredEarlyByActiveId.get(primaryCoveringActive.id) || [];
                          list.push(eb);
                          coveredEarlyByActiveId.set(primaryCoveringActive.id, list);

                          // 代行タスク等の開始時刻までに15分以上の空きがある場合のみ、前方の早期完了ブロックとして最小限描画
                          if (primaryCoveringActive.startMinutes > eb.startMinutes + 15) {
                            renderItems.push({
                              block: eb,
                              displayEndMinutes: primaryCoveringActive.startMinutes,
                              coveredEarlyBlocks: [],
                            });
                          }
                        } else {
                          renderItems.push({
                            block: eb,
                            displayEndMinutes: eb.endMinutes,
                            coveredEarlyBlocks: [],
                          });
                        }
                      }

                      for (const ab of activeBlocks) {
                        renderItems.push({
                          block: ab,
                          displayEndMinutes: ab.endMinutes,
                          coveredEarlyBlocks: coveredEarlyByActiveId.get(ab.id) || [],
                        });
                      }

                      return renderItems.map(({ block, displayEndMinutes, coveredEarlyBlocks }) => {
                        const top = Math.round((block.startMinutes / 60) * hourHeight) + 1;
                        const duration = Math.max(15, displayEndMinutes - block.startMinutes);
                        const rawHeight = (duration / 60) * hourHeight;
                        const height = Math.max(22, Math.round(rawHeight) - 2);
                        // ★ 文字消え防止: 高さが44px未満、または時間が35分未満の場合は短縮モード（タイトル行の表示を最優先）
                        const isShort = duration < 35 || height < 44;
                        const isAssignment = block.taskType === 'assignment';
                        // ★ Plan16: 計画表の日タスク・固定タスクの未完了状態・ボタンを撤廃
                        // 完了トグルボタンは、進捗管理・未完了リスケジュールが必要な週タスク（課題・再配置タスクを含む）のみに限定
                        const isWeeklyTask =
                          !block.isFixed &&
                          !block.isBreak &&
                          (block.isWeeklyTask === true ||
                            block.isRescheduled === true ||
                            block.taskType === 'assignment');

                        // ★ 固定タスクや日タスクの「完了状態にするボタン」は復活させ、「完了状態を戻すボタン」は消えたままにする
                        // 1. 休憩ブロックにはボタンを置かない
                        // 2. 完了状態 (block.isCompleted): 週タスクのみ「完了を戻すボタン（[✓]）」を表示、固定枠や日タスクは非表示
                        // 3. 未完了状態 (!block.isCompleted): 週タスク・固定枠・日タスクのすべてに「完了にするボタン（[ ]）」を表示
                        const isCompletableBlock =
                          !block.isBreak &&
                          (block.isCompleted ? isWeeklyTask : true);

                        // ★ 代行タスク（isSubstitute）の場合は、代行元の早期完了ブロックを確実に特定して「戻す」ボタンを提供
                        const substituteSourceBlock =
                          block.isSubstitute
                            ? currentDayBlocks.find(
                                (b) =>
                                  b.isEarlyCompleted &&
                                  ((block.substitutedForBlockId &&
                                    b.id === block.substitutedForBlockId) ||
                                    (block.substitutedForTitle &&
                                      b.title === block.substitutedForTitle)),
                              ) ||
                              earlyBlocks.find(
                                (eb) =>
                                  eb.startMinutes < block.endMinutes &&
                                  eb.endMinutes > block.startMinutes,
                              ) ||
                              (coveredEarlyBlocks.length > 0
                                ? coveredEarlyBlocks[coveredEarlyBlocks.length - 1]
                                : undefined)
                            : undefined;

                        const latestCoveredEarly = substituteSourceBlock;

                        // ★ 枠の高さ（所要時間）に応じて、タスク名を表示できる最大行数を動的に算出（最低1行は必ず確保）
                        const hasTimeRow = !isShort;
                        const availableHeightForTitle = hasTimeRow
                          ? Math.max(16, height - 22)
                          : Math.max(16, height - 6);
                        const calculatedLines = Math.max(
                          1,
                          Math.min(6, Math.floor(availableHeightForTitle / 14)),
                        );

                        // ★ 完了状態（早期完了の経過分を含む）の場合は洗練されたグレートーンパレットを適用
                        const colorScheme = block.isCompleted
                          ? COMPLETED_PALETTE
                          : getBlockColorScheme(block, tableColorMap);

                        const isSubstitute = !!block.isSubstitute;
                        const isEarlyCompleted = !!block.isEarlyCompleted;

                        // 手帳風: 全予定共通の半透明背景色（背後の時間対応方眼線が上品に透けて見える）
                        const PLANNER_UNIFIED_BG = 'rgba(238, 233, 222, 0.52)'; // 統一された品のある半透明エクリュ
                        const PLANNER_COMPLETED_BG = 'rgba(224, 220, 212, 0.45)'; // 完了時の半透明背景

                        const PLANNER_BORDER = 'rgba(205, 194, 176, 0.65)'; // 繊細な半透明実線
                        const PLANNER_COMPLETED_BORDER = 'rgba(185, 177, 165, 0.5)';

                        const hasSubstituteRevert =
                          isSubstitute && !!latestCoveredEarly && !!onToggleBlockComplete;

                        const outerContainerStyle: React.CSSProperties = {
                          top: `${top}px`,
                          height: `${height}px`,
                        };

                        const cardStyle: React.CSSProperties = {
                          overscrollBehavior: 'auto',
                          backgroundColor: isPlanner
                            ? block.isCompleted
                              ? PLANNER_COMPLETED_BG
                              : PLANNER_UNIFIED_BG
                            : colorScheme.bg,
                          borderColor: isPlanner
                            ? block.isCompleted
                              ? PLANNER_COMPLETED_BORDER
                              : PLANNER_BORDER
                            : colorScheme.border,
                          color: colorScheme.text,
                        };

                        return (
                          <div
                            key={`block-${d.dayIndex}-${block.id}`}
                            style={outerContainerStyle}
                            className={`!absolute inset-x-0.5 sm:inset-x-1 flex flex-row items-stretch gap-1 [overscroll-behavior:auto] ${
                              isSubstitute ? 'z-20' : 'z-10'
                            }`}
                          >
                            {/* タスクカード本体 */}
                            <div
                              title={
                                isSubstitute
                                  ? `【代行タスク】${block.title} (元のタスク「${block.substitutedForTitle || ''}」の代わりに前倒し配置)`
                                  : block.isEarlyCompleted
                                    ? `【前倒し完了済み】${block.title}`
                                    : block.sourceTableName
                                      ? `${block.title} (参照元: ${block.sourceTableName})`
                                      : block.title
                              }
                              style={cardStyle}
                              className={`group flex-1 min-w-0 h-full overflow-hidden border [overscroll-behavior:auto] relative ${
                                isPlanner
                                  ? 'hover:brightness-[0.98] transition-all duration-100 rounded-none'
                                  : 'sticky-note rounded-md border transition-all duration-150 shadow-2xs'
                              } ${
                                isSubstitute
                                  ? isPlanner
                                    ? 'ring-1 ring-blue-400/50'
                                    : 'ring-1 ring-blue-400/40'
                                  : ''
                              } hover:z-30`}
                            >
                              {/* 付箋のり付けストリップ (左端: モダン・付箋モードのみ表示。手帳風では完全非表示) */}
                              {!isPlanner && (
                                <div
                                  className="absolute inset-y-0 left-0 w-1.5 opacity-90 shadow-2xs z-10"
                                  style={{
                                    backgroundColor: isSubstitute
                                      ? '#3b82f6'
                                      : isEarlyCompleted
                                        ? '#94a3b8'
                                        : colorScheme.strip,
                                  }}
                                />
                              )}

                              {/* Block Content: 2分割スプリット（メインカード＋可変完了ドック） */}
                              <TimelineTaskCardBlock
                                block={block}
                                colorScheme={colorScheme}
                                isPlanner={isPlanner}
                                height={height}
                                duration={duration}
                                isShort={isShort}
                                isSubstitute={isSubstitute}
                                isEarlyCompleted={isEarlyCompleted}
                                isWeeklyTask={isWeeklyTask}
                                isAssignment={isAssignment}
                                isCompletableBlock={isCompletableBlock}
                                displayEndMinutes={displayEndMinutes}
                                calculatedLines={calculatedLines}
                                onToggleBlockComplete={onToggleBlockComplete}
                                onJumpToSourceTable={onJumpToSourceTable}
                              />
                            </div>

                            {/* 代行タスクの場合の独立した大きな戻すボタン */}
                            {hasSubstituteRevert && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleBlockComplete(latestCoveredEarly);
                                }}
                                className={`shrink-0 h-full flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
                                  height < 32 ? 'w-6 sm:w-7' : 'w-7 sm:w-8'
                                } ${
                                  isPlanner
                                    ? 'border border-dashed border-emerald-500/60 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 rounded-none shadow-2xs'
                                    : 'border border-emerald-300/90 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 rounded-md shadow-2xs'
                                }`}
                                title={`前倒し完了した「${latestCoveredEarly.title}」を未完了に戻す（代行配置を解除）`}
                              >
                                <RotateCcw
                                  className={`${
                                    height < 32 ? 'h-3 w-3' : 'h-3.5 w-3.5'
                                  } text-emerald-700`}
                                />
                                {height >= 44 && (
                                  <span className="text-[8px] sm:text-[9px] font-bold text-emerald-800 leading-none mt-1 tracking-tighter">
                                    戻す
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      });
                    })()}
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
