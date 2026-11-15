'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  Target,
  Menu,
  X,
  BookOpen,
  Laptop,
  Palette,
  CheckSquare,
  Clock,
  AlertTriangle,
  Scale,
  Zap,
  SlidersHorizontal,
  RotateCcw,
  FlaskConical,
  CalendarClock,
  Sun,
  History,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AppThemeMode, TheoreticalBlock, TaskItem, TaskPlacementStrategy } from '@/types';
import { minutesToTimeString, timeStringToMinutes, formatDuration } from '@/lib/timeUtils';
import {
  classifyWeeklyTask,
  classifyWeeklyBlock,
  classifyDailyBlock,
  isWeeklyTaskItem,
  getParentEndTimeForDay,
} from '@/lib/scheduler';

export type SheetTab = 'timeline' | 'data';

export interface DebugTimeConfig {
  enabled: boolean;
  dayIndex: number;
  minutes: number;
}

interface SheetFooterProps {
  activeTab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  unassignedCount?: number;
  tablesCount?: number;
  lastSavedAt?: Date | null;
  userEmail?: string | null;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
  focusMode?: 'week' | 'today';
  onToggleFocus?: () => void;
  themeMode?: AppThemeMode;
  onToggleThemeMode?: (mode: AppThemeMode) => void;
  weeklyBlocks?: TheoreticalBlock[];
  unassignedWeeklyTasks?: TaskItem[];
  allBlocks?: TheoreticalBlock[];
  allTasks?: TaskItem[];
  onToggleBlockComplete?: (block: TheoreticalBlock) => void;
  selectedDayIndex?: number;
  onSelectDayIndex?: (dayIndex: number) => void;
  placementStrategy?: TaskPlacementStrategy;
  onTogglePlacementStrategy?: (strategy?: TaskPlacementStrategy) => void;
  debugTime?: DebugTimeConfig;
  onChangeDebugTime?: (next: Partial<DebugTimeConfig>) => void;
  onResetDebugTime?: () => void;
  onResetCompletionStates?: () => void;
  activeDataName?: string;
  onOpenMobileSwitcher?: () => void;
}

export function SheetFooter({
  activeTab,
  onTabChange,
  unassignedCount = 0,
  tablesCount = 0,
  lastSavedAt,
  userEmail,
  onOpenAuth,
  onSignOut,
  focusMode = 'today',
  onToggleFocus,
  themeMode = 'planner',
  onToggleThemeMode,
  weeklyBlocks = [],
  unassignedWeeklyTasks = [],
  allBlocks = [],
  allTasks = [],
  onToggleBlockComplete,
  selectedDayIndex,
  onSelectDayIndex,
  placementStrategy = 'balanced',
  onTogglePlacementStrategy,
  debugTime,
  onChangeDebugTime,
  onResetDebugTime,
  onResetCompletionStates,
  activeDataName,
  onOpenMobileSwitcher,
}: SheetFooterProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);

  const footerRef = useRef<HTMLElement>(null);
  const [footerHeight, setFooterHeight] = useState(44);

  useEffect(() => {
    if (!footerRef.current) return;
    const updateHeight = () => {
      if (footerRef.current) {
        setFooterHeight(footerRef.current.offsetHeight);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  // Escキーで開いているバー（メニュー、デバッグバー）を閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMenuOpen) setIsMenuOpen(false);
        if (isDebugDrawerOpen) setIsDebugDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen, isDebugDrawerOpen]);

  const WEEKDAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];

  // Plan14: メニュー内タスク表示用タブ ('week' | 'day')
  const [taskMenuTab, setTaskMenuTab] = useState<'week' | 'day'>('week');

  // 基準日時の曜日
  const currentTodayIdx = debugTime?.enabled
    ? debugTime.dayIndex
    : (selectedDayIndex ?? ((new Date().getDay() + 6) % 7));

  // 基準日時の現在時刻（分）
  const currentMinutes = useMemo(() => {
    if (debugTime?.enabled) {
      return debugTime.minutes;
    }
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, [debugTime?.enabled, debugTime?.minutes]);

  // タスクマップ
  const taskMap = useMemo(() => {
    const map = new Map<string, TaskItem>();
    allTasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [allTasks]);

  // 週タスクブロックの分類（先週タスク・出題中タスク）
  // 出題中の定義: 現在時刻が付随元のタスクの時間を超えているもの
  const lastWeekWeeklyBlocks = useMemo(() => {
    return weeklyBlocks.filter(
      (b) => classifyWeeklyBlock(b, currentTodayIdx, taskMap, currentMinutes) === 'last_week',
    );
  }, [weeklyBlocks, currentTodayIdx, taskMap, currentMinutes]);

  const activeWeeklyBlocks = useMemo(() => {
    return weeklyBlocks.filter(
      (b) => classifyWeeklyBlock(b, currentTodayIdx, taskMap, currentMinutes) === 'active',
    );
  }, [weeklyBlocks, currentTodayIdx, taskMap, currentMinutes]);

  // 未出題タスク（今週の課題でまだ出題されていないタスク / 現在時刻が付随元時間を超えていないもの）
  const upcomingWeeklyTasks = useMemo(() => {
    return allTasks.filter(
      (t) =>
        isWeeklyTaskItem(t) &&
        t.enabled !== false &&
        classifyWeeklyTask(t, currentTodayIdx, currentMinutes) === 'upcoming',
    );
  }, [allTasks, currentTodayIdx, currentMinutes]);

  // 日タスクブロックの分類（今日の分のタスク・前日分のタスク）
  const allDailyBlocks = useMemo(() => {
    return allBlocks.filter((b: TheoreticalBlock) => !b.isWeeklyTask && !b.isFixed && !b.isBreak);
  }, [allBlocks]);

  // 前日分のタスク（日付またぎ・前日からの未完了持ち越し）
  const yesterdayDailyBlocks = useMemo(() => {
    return allDailyBlocks.filter(
      (b: TheoreticalBlock) => classifyDailyBlock(b, currentTodayIdx) === 'yesterday',
    );
  }, [allDailyBlocks, currentTodayIdx]);

  // 今日の分のタスク
  const todayDailyBlocks = useMemo(() => {
    return allDailyBlocks.filter(
      (b: TheoreticalBlock) =>
        classifyDailyBlock(b, currentTodayIdx) === 'today' && b.dayIndex === currentTodayIdx,
    );
  }, [allDailyBlocks, currentTodayIdx]);

  // 週タスクのサマリー計算
  const totalWeeklyTasksCount =
    weeklyBlocks.length + unassignedWeeklyTasks.length + upcomingWeeklyTasks.length;
  const completedWeeklyTasksCount = weeklyBlocks.filter((b: TheoreticalBlock) => b.isCompleted).length;

  // 日タスクのサマリー計算
  const totalDailyTasksCount = todayDailyBlocks.length + yesterdayDailyBlocks.length;
  const completedDailyTasksCount =
    todayDailyBlocks.filter((b: TheoreticalBlock) => b.isCompleted).length +
    yesterdayDailyBlocks.filter((b: TheoreticalBlock) => b.isCompleted).length;

  // 曜日ジャンプ（日フォーカスでその曜日へ切り替えてバーを閉じる）
  const handleJumpToDay = (dayIndex?: number) => {
    if (dayIndex !== undefined && onSelectDayIndex) {
      onSelectDayIndex(dayIndex);
      if (focusMode !== 'today') {
        onToggleFocus?.();
      }
      if (activeTab !== 'timeline') {
        onTabChange('timeline');
      }
      setIsMenuOpen(false);
      setIsDebugDrawerOpen(false);
    }
  };

  // 週タスクブロックアイテムの描画
  const renderWeeklyBlockItem = (block: TheoreticalBlock, customBadge?: string) => {
    const dayName = WEEKDAY_NAMES[block.dayIndex ?? 0] ?? '月';
    const isTargetDayCurrent = block.dayIndex === selectedDayIndex;
    const durationMins = block.endMinutes - block.startMinutes;

    return (
      <div
        key={`menubar-weekly-${block.id}`}
        className={`flex items-center justify-between gap-2 p-2 border transition ${
          block.isCompleted
            ? 'border-slate-200 bg-slate-50/70'
            : isTargetDayCurrent
              ? 'border-violet-300 bg-violet-50/40'
              : 'border-slate-200/90 bg-white hover:bg-slate-50/80'
        }`}
      >
        {/* 曜日バッジ（クリックでその曜日の日フォーカスへジャンプ） */}
        <button
          type="button"
          onClick={() => handleJumpToDay(block.dayIndex)}
          className={`shrink-0 flex items-center justify-center h-6 w-6 font-bold text-xs border transition cursor-pointer ${
            isTargetDayCurrent
              ? 'border-amber-800 bg-amber-800 text-white'
              : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title={`クリックで${dayName}曜日の日フォーカスへ移動`}
        >
          {dayName}
        </button>

        {/* タスク情報 */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            {customBadge && (
              <span className="shrink-0 rounded bg-amber-100 border border-amber-300 px-1 py-0.2 text-[9px] font-bold text-amber-900">
                {customBadge}
              </span>
            )}
            {block.isSubstitute && (
              <span
                className="shrink-0 rounded bg-blue-100 border border-blue-300 px-1 py-0.2 text-[9px] font-bold text-blue-800"
                title={
                  block.substitutedForTitle
                    ? `「${block.substitutedForTitle}」の早期完了に伴う代行配置`
                    : '代行タスク'
                }
              >
                代行
              </span>
            )}
            {block.isRescheduled && (
              <span
                className="shrink-0 rounded bg-amber-100 border border-amber-300 px-1 py-0.2 text-[9px] font-bold text-amber-800"
                title="未完了のため再配置されたタスク"
              >
                再配置
              </span>
            )}
            <span
              className={`text-xs font-bold truncate ${
                block.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
              }`}
              title={block.title}
            >
              {block.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
            <span>
              {minutesToTimeString(block.startMinutes)} - {minutesToTimeString(block.endMinutes)}
            </span>
            <span className="text-slate-400">({formatDuration(durationMins)})</span>
          </div>
        </div>

        {/* 完了トグルボタン */}
        {onToggleBlockComplete && (
          <button
            type="button"
            onClick={() => onToggleBlockComplete(block)}
            className={`shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-bold border transition cursor-pointer ${
              block.isCompleted
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100'
            }`}
            title={block.isCompleted ? 'クリックで未完了に戻す' : 'クリックで完了にする'}
          >
            {block.isCompleted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>済</span>
              </>
            ) : (
              <span>未完了</span>
            )}
          </button>
        )}
      </div>
    );
  };

  // 日タスクブロックアイテムの描画
  const renderDailyBlockItem = (block: TheoreticalBlock, isYesterday: boolean) => {
    const dayName = WEEKDAY_NAMES[block.dayIndex ?? 0] ?? '月';
    const isTargetDayCurrent = block.dayIndex === selectedDayIndex;
    const durationMins = block.endMinutes - block.startMinutes;

    return (
      <div
        key={`menubar-daily-${block.id}`}
        className={`flex items-center justify-between gap-2 p-2 border transition ${
          block.isCompleted
            ? 'border-slate-200 bg-slate-50/70'
            : isYesterday
              ? 'border-orange-300 bg-orange-50/30'
              : isTargetDayCurrent
                ? 'border-amber-300 bg-amber-50/40'
                : 'border-slate-200/90 bg-white hover:bg-slate-50/80'
        }`}
      >
        {/* 曜日バッジ */}
        <button
          type="button"
          onClick={() => handleJumpToDay(block.dayIndex)}
          className={`shrink-0 flex items-center justify-center h-6 w-6 font-bold text-xs border transition cursor-pointer ${
            isTargetDayCurrent
              ? 'border-amber-800 bg-amber-800 text-white'
              : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title={`クリックで${dayName}曜日の日フォーカスへ移動`}
        >
          {dayName}
        </button>

        {/* タスク情報 */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isYesterday && (
              <span className="shrink-0 rounded bg-orange-100 border border-orange-300 px-1 py-0.2 text-[9px] font-bold text-orange-900">
                前日分
              </span>
            )}
            {block.isRescheduled && (
              <span
                className="shrink-0 rounded bg-amber-100 border border-amber-300 px-1 py-0.2 text-[9px] font-bold text-amber-800"
                title="未完了のため再配置されたタスク"
              >
                持越
              </span>
            )}
            <span
              className={`text-xs font-bold truncate ${
                block.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
              }`}
              title={block.title}
            >
              {block.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
            <span>
              {minutesToTimeString(block.startMinutes)} - {minutesToTimeString(block.endMinutes)}
            </span>
            <span className="text-slate-400">({formatDuration(durationMins)})</span>
          </div>
        </div>

        {/* 完了トグルボタン: 未完了時は「完了にする」ボタンを表示、完了時は戻すボタンを出さず済バッジのみ */}
        {block.isCompleted ? (
          <div className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-bold border border-emerald-200 bg-emerald-50/70 text-emerald-700 select-none">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>済</span>
          </div>
        ) : (
          onToggleBlockComplete && (
            <button
              type="button"
              onClick={() => onToggleBlockComplete(block)}
              className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-bold border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 transition cursor-pointer"
              title="クリックで完了にする"
            >
              <span>完了にする</span>
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <footer
      ref={footerRef}
      className="relative z-50 shrink-0 border-t border-slate-300 bg-[#ede8dc] px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] select-none shadow-xs"
    >
      <div className="mx-auto flex flex-nowrap w-full max-w-full items-center justify-between gap-x-1.5 sm:gap-x-2 h-9">
        {/* Left: Excel-style Sheet Tabs */}
        <div className="flex items-center gap-1 min-w-0 flex-1 sm:flex-none">
          {/* Sheet 1: 計画表 */}
          <button
            onClick={() => onTabChange('timeline')}
            className={`group shrink-0 flex items-center gap-1.5 rounded-none px-2.5 sm:px-3 py-1.5 text-xs transition border-b-0 ${
              activeTab === 'timeline'
                ? 'bg-white font-bold text-blue-900 shadow-2xs border-t-2 border-t-blue-600 border-x border-slate-300'
                : 'bg-[#e2ddd0] hover:bg-[#ebe6d9] text-slate-600 border-t border-x border-transparent hover:border-slate-300'
            }`}
          >
            <Calendar
              className={`h-3.5 w-3.5 ${
                activeTab === 'timeline' ? 'text-blue-600' : 'text-slate-500'
              }`}
            />
            <span>計画表</span>
            {unassignedCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1 py-0.2 text-[9px] font-bold text-amber-950">
                {unassignedCount}
              </span>
            )}
          </button>

          {/* Sheet 2: データ管理 (日・週・固定枠・取り込み表) */}
          <button
            onClick={() => onTabChange('data')}
            className={`group shrink-0 flex items-center gap-1.5 rounded-none px-2.5 sm:px-3 py-1.5 text-xs transition border-b-0 ${
              activeTab === 'data'
                ? 'bg-white font-bold text-emerald-900 shadow-2xs border-t-2 border-t-emerald-600 border-x border-slate-300'
                : 'bg-[#e2ddd0] hover:bg-[#ebe6d9] text-slate-600 border-t border-x border-transparent hover:border-slate-300'
            }`}
          >
            <FileSpreadsheet
              className={`h-3.5 w-3.5 ${
                activeTab === 'data' ? 'text-emerald-600' : 'text-slate-500'
              }`}
            />
            <span>データ管理</span>
            {tablesCount > 0 && (
              <span className="hidden rounded-full bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-800 sm:inline">
                {tablesCount}
              </span>
            )}
          </button>

          {/* Sheet 3 / Mobile: データ切り替えタブ (現在開いているデータ名を表示し、タップで切り替え画面を開く) */}
          {onOpenMobileSwitcher && (
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'data') {
                  onTabChange('data');
                }
                onOpenMobileSwitcher();
              }}
              title="タップして時間割やタスクを切り替え"
              className="group flex items-center gap-1 rounded-none px-2 sm:px-2.5 py-1.5 text-xs transition border-b-0 bg-[#ebe6d9] hover:bg-white text-slate-700 hover:text-blue-900 border-t border-x border-transparent hover:border-slate-300 shadow-2xs active:scale-95 cursor-pointer min-w-0 max-w-[100px] xs:max-w-[120px] sm:max-w-[170px]"
            >
              <Layers className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="font-bold truncate text-[11px] sm:text-xs text-blue-950">
                {activeDataName || 'データ選択'}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
            </button>
          )}
        </div>

        {/* Center: App Title in available space (PCでのみ中央表示し、スマホの行数増加を根本防止) */}
        <div className="hidden sm:flex sm:flex-1 items-center justify-center min-w-0 px-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 truncate">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-600 text-white shadow-2xs">
              <Target className="h-3 w-3" />
            </div>
            <h1 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight truncate select-text">
              理論値計画表
            </h1>
          </div>
        </div>

        {/* Right: Status and Menu Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0">
          {/* Autosave Status */}
          {lastSavedAt && (
            <span
              className="hidden items-center gap-1 text-[10px] text-slate-500 md:flex"
              title="ローカル保存済"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>自動保存済</span>
            </span>
          )}

          {/* フォーカス切り替えコントロール（どちらを押しても切り替わるボタン） */}
          {onToggleFocus && (
            <button
              type="button"
              onClick={onToggleFocus}
              className="flex h-7.5 items-center border border-slate-300 bg-white shadow-2xs select-none cursor-pointer active:scale-95 shrink-0 overflow-hidden"
              title={`タップで日表示と週表示を切り替え（現在: ${focusMode === 'today' ? '日フォーカス' : '週間表示'}）`}
              aria-label={`表示フォーカス切り替え（現在: ${focusMode === 'today' ? '日' : '週'}）`}
            >
              <span
                className={`px-2 h-full flex items-center text-xs font-bold transition ${
                  focusMode === 'today'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                日
              </span>
              <div className="h-3.5 w-px bg-slate-300" />
              <span
                className={`px-2 h-full flex items-center text-xs font-bold transition ${
                  focusMode === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                週
              </span>
            </button>
          )}

          {/* Debug Button (デバッグ用設定ボタン: フッターに独立アイコンで配置) */}
          {debugTime && onChangeDebugTime && (
            <button
              type="button"
              onClick={() => {
                setIsDebugDrawerOpen((prev) => !prev);
                setIsMenuOpen(false);
              }}
              className={`relative flex h-7.5 items-center gap-1 px-2 border shadow-2xs transition active:scale-95 text-xs font-semibold cursor-pointer ${
                isDebugDrawerOpen
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : debugTime.enabled
                    ? 'border-amber-400 bg-amber-50 text-amber-950 font-bold hover:bg-amber-100'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={
                debugTime.enabled
                  ? `デバッグ日時設定 (適用中: ${WEEKDAY_NAMES[debugTime.dayIndex]} ${minutesToTimeString(debugTime.minutes)})`
                  : 'デバッグ用設定（現在日時シミュレーター）を開く'
              }
              aria-label="デバッグ用設定を開く"
            >
              <FlaskConical
                className={`h-3.5 w-3.5 ${
                  isDebugDrawerOpen
                    ? 'text-white'
                    : debugTime.enabled
                      ? 'text-amber-800'
                      : 'text-slate-600'
                }`}
              />
              <span className="hidden sm:inline">デバッグ</span>
              {debugTime.enabled && (
                <span
                  className="h-2 w-2 rounded-full bg-amber-500 ring-1.5 ring-white"
                  title="デバッグ日時固定 ON"
                />
              )}
            </button>
          )}

          {/* Menu Icon Button (メニューアイコン: クリックでメニューバーを開閉) */}
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen((prev) => !prev);
              setIsDebugDrawerOpen(false);
            }}
            className={`relative flex h-7.5 w-7.5 items-center justify-center border shadow-2xs transition active:scale-95 cursor-pointer ${
              isMenuOpen
                ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            {userEmail && !isMenuOpen && (
              <span
                className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                title="クラウド同期中"
              />
            )}
          </button>
        </div>
      </div>

      {/* 1. デバッグ用独立スライドバー (Debug Slide-over Drawer) */}

      {/* 2. デバッグ用独立スライドバー (Debug Slide-over Drawer) */}
      {debugTime && onChangeDebugTime && (
        <div
          style={{ bottom: `${footerHeight}px` }}
          className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
            isDebugDrawerOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
          }`}
          aria-hidden={!isDebugDrawerOpen}
        >
          {/* 背景オーバーレイ */}
          <div
            onClick={() => setIsDebugDrawerOpen(false)}
            className={`absolute inset-0 bg-slate-900/15 transition-opacity duration-300 ${
              isDebugDrawerOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* スライドインバー本体 */}
          <div
            className={`absolute inset-y-0 right-0 flex w-84 sm:w-96 max-w-[92vw] flex-col border-l border-slate-300 bg-[#fdfcf9] bg-notebook-grid shadow-2xl transition-transform duration-300 ease-out ${
              isDebugDrawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {/* バーヘッダー */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-[#ede8dc]/90 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-600 text-white shadow-2xs">
                  <FlaskConical className="h-3.5 w-3.5" />
                </div>
                <span className="font-bold text-sm text-slate-900 tracking-tight">
                  デバッグ設定（現在日時の変更）
                </span>
              </div>
              <button
                onClick={() => setIsDebugDrawerOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
                title="デバッグ設定を閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* バーコンテンツ */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                    現在日時のシミュレーター
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 border font-mono ${
                      debugTime.enabled
                        ? 'text-amber-950 bg-amber-200 border-amber-400'
                        : 'text-slate-600 bg-slate-100 border-slate-300'
                    }`}
                  >
                    {debugTime.enabled
                      ? `手動: ${WEEKDAY_NAMES[debugTime.dayIndex]}曜 ${minutesToTimeString(debugTime.minutes)}`
                      : `実時刻: ${WEEKDAY_NAMES[debugTime.dayIndex]}曜 ${minutesToTimeString(debugTime.minutes)}`}
                  </span>
                </div>

                <div className="border border-amber-300/90 bg-amber-50/40 p-2.5 shadow-2xs space-y-2.5">
                  {/* ON/OFF 切り替え & 実時刻リセット */}
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => onChangeDebugTime({ enabled: !debugTime.enabled })}
                      className={`flex-1 py-1.5 px-2 text-xs font-bold border transition cursor-pointer ${
                        debugTime.enabled
                          ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {debugTime.enabled ? '🧪 デバッグ日時固定 ON' : '🕒 実日時（自動）を使用中'}
                    </button>
                    {debugTime.enabled && onResetDebugTime && (
                      <button
                        type="button"
                        onClick={onResetDebugTime}
                        className="flex items-center gap-1 py-1.5 px-2 text-[11px] font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                        title="実際の現在曜日・現在時刻に戻す"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>実時刻へ戻す</span>
                      </button>
                    )}
                  </div>

                  {/* 曜日（今日とする曜日）の選択 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                      <span>「今日」とする曜日:</span>
                      <span className="font-mono text-[10px] text-amber-900 font-bold">
                        {WEEKDAY_NAMES[debugTime.dayIndex]}曜日
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {WEEKDAY_NAMES.map((dayLabel, idx) => (
                        <button
                          key={`debug-day-${idx}`}
                          type="button"
                          onClick={() => {
                            onChangeDebugTime({ enabled: true, dayIndex: idx });
                            onSelectDayIndex?.(idx);
                          }}
                          className={`py-1 text-xs font-bold border transition cursor-pointer ${
                            debugTime.dayIndex === idx
                              ? 'bg-amber-700 text-white border-amber-800 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-100/60'
                          }`}
                        >
                          {dayLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 現在時刻の変更（時刻入力 + スライダー + クイック増減） */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                      <span>現在時刻の設定:</span>
                      <input
                        type="time"
                        aria-label="デバッグ現在時刻"
                        value={minutesToTimeString(debugTime.minutes)}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const mins = Math.max(
                            0,
                            Math.min(1439, timeStringToMinutes(e.target.value)),
                          );
                          onChangeDebugTime({ enabled: true, minutes: mins });
                        }}
                        className="border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-900 focus:border-amber-600 focus:outline-none"
                      />
                    </div>

                    <input
                      type="range"
                      aria-label="デバッグ時刻スライダー"
                      min={0}
                      max={1435}
                      step={5}
                      value={debugTime.minutes}
                      onChange={(e) => {
                        onChangeDebugTime({
                          enabled: true,
                          minutes: Number(e.target.value),
                        });
                      }}
                      className="w-full accent-amber-600 cursor-pointer h-1.5"
                    />

                    {/* 微調整ボタン (-1h, -15m, +15m, +1h) */}
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { label: '-1時間', delta: -60 },
                        { label: '-15分', delta: -15 },
                        { label: '+15分', delta: 15 },
                        { label: '+1時間', delta: 60 },
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => {
                            const nextMins = Math.max(
                              0,
                              Math.min(1439, debugTime.minutes + btn.delta),
                            );
                            onChangeDebugTime({ enabled: true, minutes: nextMins });
                          }}
                          className="border border-slate-300 bg-white py-1 text-[10px] font-mono font-bold text-slate-700 hover:bg-amber-100/60 transition cursor-pointer"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    {/* よく使う時刻プリセット */}
                    <div className="grid grid-cols-6 gap-1 pt-0.5">
                      {[
                        { label: '08:00', mins: 480 },
                        { label: '09:30', mins: 570 },
                        { label: '12:00', mins: 720 },
                        { label: '15:00', mins: 900 },
                        { label: '19:00', mins: 1140 },
                        { label: '22:00', mins: 1320 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => onChangeDebugTime({ enabled: true, minutes: preset.mins })}
                          className={`border py-0.5 text-[10px] font-mono font-semibold transition cursor-pointer ${
                            debugTime.minutes === preset.mins
                              ? 'border-amber-600 bg-amber-100 text-amber-950 font-bold'
                              : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 完了・未完了トグル履歴のリセットボタン */}
                  {onResetCompletionStates && (
                    <div className="pt-1 border-t border-amber-200/80">
                      <button
                        type="button"
                        onClick={onResetCompletionStates}
                        className="w-full flex items-center justify-center gap-1.5 border border-slate-300 bg-white py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>手動の完了・未完了トグル状態をすべてリセット</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 右下のメニューボタンから広がるメニューパネル (Pop-up from bottom-right) */}
      {/* 背景オーバーレイ */}
      <div
        onClick={() => setIsMenuOpen(false)}
        className={`fixed inset-0 z-[55] bg-slate-900/15 transition-opacity duration-300 ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMenuOpen}
      />

      {/* メニューパネル本体: 上部いっぱいまで伸ばし、横からスライドインして元のフッターに被さる */}
      <div
        className={`fixed inset-y-0 right-0 z-[60] flex w-84 sm:w-96 max-w-[96vw] flex-col border-l border-slate-300 bg-[#fdfcf9] bg-notebook-grid shadow-2xl transition-transform duration-300 ease-out ${
          isMenuOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
        aria-hidden={!isMenuOpen}
      >
        {/* バーコンテンツ（ヘッダーなし、上部に適度な余白、確実にスクロールできるコンテナ） */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-none p-4 space-y-4">
          {/* セクション 1: クラウド連携 */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              クラウド連携
            </div>

            {userEmail ? (
              /* ログイン中カード */
              <div className="border border-emerald-300 bg-emerald-50/70 p-3 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Cloud className="h-4 w-4 text-emerald-600" />
                    <span>クラウド同期中</span>
                  </div>
                  <span className="inline-flex items-center bg-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                    接続済
                  </span>
                </div>
                <div className="text-xs text-slate-700 bg-white/80 p-2 border border-emerald-200/60 break-all font-mono">
                  {userEmail}
                </div>
                {onSignOut && (
                  <button
                    onClick={() => {
                      onSignOut();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 border border-rose-300 bg-white py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition shadow-2xs cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 text-rose-600" />
                    <span>ログアウト</span>
                  </button>
                )}
              </div>
            ) : (
              /* 未ログインカード */
              <div className="border border-blue-200 bg-blue-50/60 p-3 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                  <CloudOff className="h-4 w-4 text-blue-600" />
                  <span>クラウド同期（未ログイン）</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  アカウントでログインすると、スマホやPCなど複数の端末間で計画表や時間割データを自動同期できます。
                </p>
                {onOpenAuth && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenAuth();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-2xs active:scale-[0.99] cursor-pointer"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{isSupabaseConfigured ? 'ログイン / 新規登録' : 'クラウド連携設定'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* セクション 2: デザイン */}
          {onToggleThemeMode && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-amber-700" />
                  デザイン
                </span>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-1.5 py-0.2 font-mono">
                  {themeMode === 'planner' ? 'デザイン1 適用中' : 'デザイン2 適用中'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleThemeMode('planner')}
                  className={`flex items-center justify-center gap-2 p-2.5 text-xs font-bold transition cursor-pointer border ${
                    themeMode === 'planner'
                      ? 'bg-amber-100/90 text-amber-950 border-amber-400 shadow-2xs ring-1 ring-amber-300'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="h-4 w-4 text-amber-800 shrink-0" />
                  <span>デザイン1</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleThemeMode('modern')}
                  className={`flex items-center justify-center gap-2 p-2.5 text-xs font-bold transition cursor-pointer border ${
                    themeMode === 'modern'
                      ? 'bg-blue-100/90 text-blue-950 border-blue-400 shadow-2xs ring-1 ring-blue-300'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Laptop className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>デザイン2</span>
                </button>
              </div>
            </div>
          )}

          {/* セクション 2-2: 配置方法 */}
          {onTogglePlacementStrategy && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-violet-600" />
                  配置方法
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 border font-mono ${
                    placementStrategy === 'concentrated'
                      ? 'text-indigo-900 bg-indigo-100 border-indigo-200'
                      : 'text-emerald-900 bg-emerald-100 border-emerald-200'
                  }`}
                >
                  {placementStrategy === 'concentrated' ? '集中' : '分散'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onTogglePlacementStrategy('balanced')}
                  className={`flex items-center justify-center gap-2 p-2.5 text-xs font-bold transition cursor-pointer border ${
                    placementStrategy === 'balanced'
                      ? 'bg-emerald-100/90 text-emerald-950 border-emerald-400 shadow-2xs ring-1 ring-emerald-300'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Scale className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>分散（バランス）</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTogglePlacementStrategy('concentrated')}
                  className={`flex items-center justify-center gap-2 p-2.5 text-xs font-bold transition cursor-pointer border ${
                    placementStrategy === 'concentrated'
                      ? 'bg-indigo-100/90 text-indigo-950 border-indigo-400 shadow-2xs ring-1 ring-indigo-300'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Zap className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>集中（前倒し）</span>
                </button>
              </div>
            </div>
          )}

          {/* セクション 3: タスク管理（週タスク・日タスクの分類表示） */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-violet-600" />
                タスク管理
              </span>
              <span className="text-[10px] font-bold text-violet-900 bg-violet-100 border border-violet-200 px-1.5 py-0.2 font-mono">
                {taskMenuTab === 'week'
                  ? `週タスク: ${completedWeeklyTasksCount} / ${totalWeeklyTasksCount} 完了`
                  : `日タスク: ${completedDailyTasksCount} / ${totalDailyTasksCount} 完了`}
              </span>
            </div>

            {/* 週タスク / 日タスクの切り替えタブ */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 border border-slate-300">
              <button
                type="button"
                onClick={() => setTaskMenuTab('week')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold transition cursor-pointer border ${
                  taskMenuTab === 'week'
                    ? 'bg-white text-violet-900 border-violet-400 shadow-2xs'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-white/50'
                }`}
              >
                <CalendarClock className="h-3.5 w-3.5 text-violet-600" />
                <span>週のタスク</span>
                <span className="text-[10px] font-mono px-1 py-0.2 bg-violet-100 text-violet-800 rounded">
                  {totalWeeklyTasksCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTaskMenuTab('day')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold transition cursor-pointer border ${
                  taskMenuTab === 'day'
                    ? 'bg-white text-amber-900 border-amber-400 shadow-2xs'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-white/50'
                }`}
              >
                <Sun className="h-3.5 w-3.5 text-amber-600" />
                <span>日のタスク</span>
                <span className="text-[10px] font-mono px-1 py-0.2 bg-amber-100 text-amber-800 rounded">
                  {totalDailyTasksCount}
                </span>
              </button>
            </div>

            {/* タブコンテンツ */}
            <div className="border border-slate-300 bg-white p-2.5 space-y-3 shadow-2xs">
              {taskMenuTab === 'week' ? (
                /* ==================== 週のタスク ==================== */
                <div className="space-y-3">
                  {/* ① 出題中タスク */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                      <span className="flex items-center gap-1 text-emerald-800">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        出題中タスク
                      </span>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 border border-emerald-200">
                        {activeWeeklyBlocks.length}件
                      </span>
                    </div>

                    {activeWeeklyBlocks.length > 0 ? (
                      <div className="space-y-1.5">
                        {activeWeeklyBlocks.map((block: TheoreticalBlock) =>
                          renderWeeklyBlockItem(block),
                        )}
                      </div>
                    ) : (
                      <div className="py-2 text-center text-slate-400 text-[11px] border border-dashed border-slate-200 bg-slate-50/50">
                        現在出題中の週タスクはありません
                      </div>
                    )}
                  </div>

                  {/* ② 先週タスク */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-200">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                      <span className="flex items-center gap-1 text-amber-800">
                        <History className="h-3 w-3 text-amber-600" />
                        先週分のタスク（未完了持越・有効期限内）
                      </span>
                      <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1 py-0.2 border border-amber-200">
                        {lastWeekWeeklyBlocks.length}件
                      </span>
                    </div>

                    {lastWeekWeeklyBlocks.length > 0 ? (
                      <div className="space-y-1.5">
                        {lastWeekWeeklyBlocks.map((block: TheoreticalBlock) =>
                          renderWeeklyBlockItem(
                            block,
                            block.isRescheduled ? '先週持越' : '先週分',
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="py-2 text-center text-slate-400 text-[11px] border border-dashed border-slate-200 bg-slate-50/50">
                        先週からの未完了タスク・有効な課題はありません
                      </div>
                    )}
                  </div>

                  {/* ③ 未出題タスク */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-200">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                      <span className="flex items-center gap-1 text-blue-800">
                        <Clock className="h-3 w-3 text-blue-600" />
                        未出題タスク（今週出題予定）
                      </span>
                      <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1 py-0.2 border border-blue-200">
                        {upcomingWeeklyTasks.length}件
                      </span>
                    </div>

                    {upcomingWeeklyTasks.length > 0 ? (
                      <div className="space-y-1.5">
                        {upcomingWeeklyTasks.map((task: TaskItem) => {
                          const parentEndTime = getParentEndTimeForDay(task, currentTodayIdx);
                          const isToday =
                            task.startDay === currentTodayIdx ||
                            (task.startDay === undefined && parentEndTime !== undefined);
                          const startDayName =
                            task.startDay !== undefined ? WEEKDAY_NAMES[task.startDay] : '今日';

                          const scheduleLabel =
                            isToday && parentEndTime !== undefined
                              ? `本日 ${minutesToTimeString(parentEndTime)}〜`
                              : `${startDayName}曜出題`;

                          return (
                            <div
                              key={`upcoming-${task.id}`}
                              className="flex items-center justify-between gap-2 p-2 border border-blue-200 bg-blue-50/40"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="shrink-0 flex items-center justify-center h-5 px-1.5 font-bold text-[10px] border border-blue-300 bg-blue-100 text-blue-800">
                                  {scheduleLabel}
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate" title={task.title}>
                                  {task.title}
                                </span>
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                                <span>{formatDuration(task.durationMinutes || 60)}</span>
                                <span className="rounded bg-slate-100 border border-slate-300 px-1 py-0.2 text-[9px] font-semibold text-slate-600">
                                  未出題
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-2 text-center text-slate-400 text-[11px] border border-dashed border-slate-200 bg-slate-50/50">
                        未出題の週タスクはありません
                      </div>
                    )}
                  </div>

                  {/* 未配置の週タスクの警告（枠不足等） */}
                  {unassignedWeeklyTasks.length > 0 && (
                    <div className="mt-2 border border-amber-300 bg-amber-50/80 p-2 text-amber-900 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>枠不足による未配置タスク（{unassignedWeeklyTasks.length}件）</span>
                      </div>
                      <ul className="space-y-0.5 text-[11px] text-amber-800">
                        {unassignedWeeklyTasks.map((t: TaskItem) => (
                          <li key={`unassigned-${t.id}`} className="flex items-center justify-between">
                            <span className="truncate">{t.title}</span>
                            <span className="font-mono text-amber-700 shrink-0 ml-1">
                              {formatDuration(t.durationMinutes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                /* ==================== 日のタスク ==================== */
                <div className="space-y-3">
                  {/* ① 前日分のタスク（日付またぎ・持ち越し未完了） */}
                  {yesterdayDailyBlocks.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                        <span className="flex items-center gap-1 text-orange-800">
                          <History className="h-3 w-3 text-orange-600" />
                          前日分のタスク（日付またぎ・持越）
                        </span>
                        <span className="text-[10px] font-mono text-orange-700 bg-orange-50 px-1 py-0.2 border border-orange-200">
                          {yesterdayDailyBlocks.length}件
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {yesterdayDailyBlocks.map((block: TheoreticalBlock) =>
                          renderDailyBlockItem(block, true),
                        )}
                      </div>
                    </div>
                  )}

                  {/* ② 今日の分のタスク */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                      <span className="flex items-center gap-1 text-slate-800">
                        <Sun className="h-3 w-3 text-amber-600" />
                        今日の分のタスク（{WEEKDAY_NAMES[currentTodayIdx]}曜日）
                      </span>
                      <span className="text-[10px] font-mono text-slate-700 bg-slate-100 px-1 py-0.2 border border-slate-200">
                        {todayDailyBlocks.length}件
                      </span>
                    </div>

                    {todayDailyBlocks.length > 0 ? (
                      <div className="space-y-1.5">
                        {todayDailyBlocks.map((block: TheoreticalBlock) =>
                          renderDailyBlockItem(block, false),
                        )}
                      </div>
                    ) : (
                      <div className="py-2 text-center text-slate-400 text-[11px] border border-dashed border-slate-200 bg-slate-50/50">
                        今日の予定日課タスクはありません
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* メニューバーのフッター: 元あるフッターに被さる形で展開 */}
        <div className="shrink-0 border-t border-slate-300 bg-[#ede8dc] px-3 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-between select-none shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white shadow-2xs">
              <Target className="h-3 w-3" />
            </div>
            <span>メニュー</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen(false)}
            className="flex h-7.5 items-center gap-1.5 px-3 border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition shadow-2xs text-xs font-bold active:scale-95 cursor-pointer"
            title="メニューを閉じる"
          >
            <X className="h-4 w-4 text-slate-700" />
            <span>閉じる</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
