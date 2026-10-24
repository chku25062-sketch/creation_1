'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Crosshair,
  CalendarRange,
  BookOpen,
  Laptop,
  Palette,
  CheckSquare,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AppThemeMode, TheoreticalBlock, TaskItem } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

export type SheetTab = 'timeline' | 'data';

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
  onToggleBlockComplete?: (block: TheoreticalBlock) => void;
  selectedDayIndex?: number;
  onSelectDayIndex?: (dayIndex: number) => void;
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
  onToggleBlockComplete,
  selectedDayIndex,
  onSelectDayIndex,
}: SheetFooterProps) {

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Escキーでメニューを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const WEEKDAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];

  // 週タスクのサマリー計算
  const totalWeeklyTasksCount = weeklyBlocks.length + unassignedWeeklyTasks.length;
  const completedWeeklyTasksCount = weeklyBlocks.filter((b) => b.isCompleted).length;
  const completionPercentage =
    totalWeeklyTasksCount > 0
      ? Math.round((completedWeeklyTasksCount / totalWeeklyTasksCount) * 100)
      : 0;

  // 曜日ジャンプ（日フォーカスでその曜日へ切り替えてメニューを閉じる）
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
    }
  };

  return (
    <footer className="shrink-0 border-t border-slate-300 bg-[#ede8dc] px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] select-none shadow-xs">
      <div className="mx-auto flex flex-wrap sm:flex-nowrap w-full max-w-full items-center justify-between gap-x-2 gap-y-1 sm:h-9">
        {/* Left: Excel-style Sheet Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto order-1">
          {/* Sheet 1: 計画表 */}
          <button
            onClick={() => onTabChange('timeline')}
            className={`group flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs transition border-b-0 ${
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
            className={`group flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs transition border-b-0 ${
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
        </div>

        {/* Center / Row 2: App Title in available space (スマホでは2行目・PCでは中央) */}
        <div className="order-3 sm:order-2 flex w-full sm:w-auto sm:flex-1 items-center justify-center min-w-0 px-2 pt-0.5 sm:pt-0 pointer-events-none sm:pointer-events-auto">
          <div className="flex items-center gap-1.5 truncate">
            <div className="flex h-4.5 w-4.5 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded bg-blue-600 text-white shadow-2xs">
              <Target className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </div>
            <h1 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight truncate select-text">
              理論値計画表
            </h1>
          </div>
        </div>

        {/* Right: Status and Menu Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs order-2 sm:order-3">
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

          {/* フォーカス切り替えコントロール（「日：」「週：」表示付き） */}
          {onToggleFocus && (
            <div className="flex items-center gap-1">
              <span
                onClick={onToggleFocus}
                className="cursor-pointer text-[11px] font-bold text-slate-600 select-none hover:text-blue-600 transition"
                title={
                  focusMode === 'today'
                    ? '現在: 日表示（クリックで週間表示へ）'
                    : '現在: 週表示（クリックで日表示へ）'
                }
              >
                {focusMode === 'today' ? '日：' : '週：'}
              </span>
              <button
                onClick={onToggleFocus}
                className={`relative flex h-7.5 w-7.5 items-center justify-center rounded-md border shadow-2xs transition active:scale-95 ${
                  focusMode === 'today'
                    ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title={
                  focusMode === 'today'
                    ? '週間表示に切り替え (月〜日 7日間表示)'
                    : '今日にフォーカス (1日拡大表示)'
                }
                aria-label={focusMode === 'today' ? '週間表示に切り替え' : '今日にフォーカス'}
              >
                {focusMode === 'today' ? (
                  <CalendarRange className="h-4 w-4" />
                ) : (
                  <Crosshair className="h-4 w-4" />
                )}
              </button>
            </div>
          )}

          {/* テーマ切り替えトグル（手帳風 ⇄ モダン） */}
          {onToggleThemeMode && (
            <button
              onClick={() => onToggleThemeMode(themeMode === 'planner' ? 'modern' : 'planner')}
              className={`relative flex h-7.5 items-center gap-1 px-2 rounded-md border shadow-2xs transition active:scale-95 text-xs font-semibold ${
                themeMode === 'planner'
                  ? 'border-amber-700/40 bg-[#f7f3e8] text-amber-950 hover:bg-[#ede6d4]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title={
                themeMode === 'planner'
                  ? '現在: 手帳風デザイン（クリックでモダン表示へ切替）'
                  : '現在: モダンデザイン（クリックで手帳風表示へ切替）'
              }
              aria-label={themeMode === 'planner' ? 'モダンデザインへ切替' : '手帳風デザインへ切替'}
            >
              {themeMode === 'planner' ? (
                <>
                  <BookOpen className="h-3.5 w-3.5 text-amber-800" />
                  <span className="hidden sm:inline">手帳風</span>
                </>
              ) : (
                <>
                  <Laptop className="h-3.5 w-3.5 text-blue-600" />
                  <span className="hidden sm:inline">モダン</span>
                </>
              )}
            </button>
          )}

          {/* Menu Icon Button (メニューアイコン) */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="relative flex h-7.5 w-7.5 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
            title="メニューを開く"
            aria-label="メニューを開く"
          >
            <Menu className="h-4 w-4" />
            {userEmail && (
              <span
                className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                title="クラウド同期中"
              />
            )}
          </button>
        </div>
      </div>

      {/* 右スライドイン 独立メニューバー (Slide-over Drawer) */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 ${
          isMenuOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
        aria-hidden={!isMenuOpen}
      >
        {/* 背景オーバーレイ */}
        <div
          onClick={() => setIsMenuOpen(false)}
          className={`absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-300 ${
            isMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* スライドインバー本体 */}
        <div
          className={`absolute inset-y-0 right-0 flex w-84 sm:w-96 max-w-[92vw] flex-col border-l border-slate-300 bg-[#fdfcf9] bg-notebook-grid shadow-2xl transition-transform duration-300 ease-out ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* バーヘッダー */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-[#ede8dc]/90 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white shadow-2xs">
                <Target className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold text-sm text-slate-900 tracking-tight">メニュー</span>
            </div>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
              title="メニューを閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* バーコンテンツ */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* セクション 1: 今週の週タスク管理 (日フォーカス中も今週全体を俯瞰・操作可能) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <CheckSquare className="h-4 w-4 text-violet-600 shrink-0" />
                  <span>今週の週タスク管理</span>
                </div>
                {totalWeeklyTasksCount > 0 && (
                  <span className="font-mono text-[11px] font-bold text-violet-900 bg-violet-100 border border-violet-200 px-1.5 py-0.5">
                    {completedWeeklyTasksCount} / {totalWeeklyTasksCount} 完了 ({completionPercentage}%)
                  </span>
                )}
              </div>

              {/* 進捗プログレスバー */}
              {totalWeeklyTasksCount > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-violet-600 transition-all duration-300"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 週タスク一覧カード */}
              <div className="border border-slate-300 bg-white p-2.5 space-y-2 shadow-2xs">
                {weeklyBlocks.length > 0 ? (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {weeklyBlocks.map((block) => {
                      const dayName = WEEKDAY_NAMES[block.dayIndex ?? 0] ?? '月';
                      const isTargetDayCurrent = block.dayIndex === selectedDayIndex;
                      const durationMins = block.endMinutes - block.startMinutes;

                      return (
                        <div
                          key={`menu-weekly-${block.id}`}
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
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-bold truncate ${
                                  block.isCompleted
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800'
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
                    })}
                  </div>
                ) : (
                  /* 今週の週タスクが0件の表示 */
                  <div className="py-3 text-center text-slate-500 space-y-1">
                    <p className="text-xs">今週配置された週タスクはありません</p>
                    <p className="text-[11px] text-slate-400">
                      「データ管理」タブから週タスクを登録・有効化できます
                    </p>
                  </div>
                )}

                {/* 未配置の週タスクの警告（枠不足等） */}
                {unassignedWeeklyTasks.length > 0 && (
                  <div className="mt-2 border border-amber-300 bg-amber-50/80 p-2 text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>枠不足による未配置タスク（{unassignedWeeklyTasks.length}件）</span>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-amber-800 max-h-24 overflow-y-auto">
                      {unassignedWeeklyTasks.map((t) => (
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
            </div>

            {/* セクション 2: クラウド連携 */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                クラウド連携
              </div>

              {userEmail ? (
                /* ログイン中カード */
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <Cloud className="h-4 w-4 text-emerald-600" />
                      <span>クラウド同期中</span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                      接続済
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 bg-white/80 rounded-md p-2 border border-emerald-200/60 break-all font-mono">
                    {userEmail}
                  </div>
                  {onSignOut && (
                    <button
                      onClick={() => {
                        onSignOut();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition shadow-2xs"
                    >
                      <LogOut className="h-3.5 w-3.5 text-rose-600" />
                      <span>ログアウト</span>
                    </button>
                  )}
                </div>
              ) : (
                /* 未ログインカード */
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 shadow-2xs space-y-2.5">
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
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-2xs active:scale-[0.99]"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>
                        {isSupabaseConfigured ? 'ログイン / 新規登録' : 'クラウド連携設定'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* セクション 3: データ保存状況 */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                データ保存状況
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ローカル自動保存
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                    有効
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  編集内容はブラウザ内に即時自動保存されています。
                </div>
                {lastSavedAt && (
                  <div className="text-[10px] text-slate-400 font-mono">
                    最終保存: {lastSavedAt.toLocaleTimeString('ja-JP')}
                  </div>
                )}
              </div>
            </div>

            {/* セクション 4: デザインテーマ切り替え (手帳風 ⇄ モダン) */}
            {onToggleThemeMode && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-amber-700" />
                    デザインテーマ
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded font-mono">
                    {themeMode === 'planner' ? '手帳風' : 'モダン'}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs space-y-1.5">
                  <button
                    onClick={() => onToggleThemeMode('planner')}
                    className={`w-full flex items-start justify-between rounded-lg p-2.5 text-xs transition text-left cursor-pointer ${
                      themeMode === 'planner'
                        ? 'bg-amber-50/80 font-bold text-amber-950 border border-amber-300 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#3b2b1e] text-amber-100 shadow-2xs">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span>手帳風（文字のみ）</span>
                          {themeMode === 'planner' && (
                            <span className="rounded bg-amber-200 px-1 py-0.2 text-[9px] font-bold text-amber-900">
                              適用中
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-normal text-slate-500 mt-0.5 leading-tight">
                          ブロックで囲わず、色のついた文字と時間などの付随情報のみで表現するスタイル
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => onToggleThemeMode('modern')}
                    className={`w-full flex items-start justify-between rounded-lg p-2.5 text-xs transition text-left cursor-pointer ${
                      themeMode === 'modern'
                        ? 'bg-blue-50/80 font-bold text-blue-950 border border-blue-300 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-2xs">
                        <Laptop className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span>モダン（付箋カード）</span>
                          {themeMode === 'modern' && (
                            <span className="rounded bg-blue-200 px-1 py-0.2 text-[9px] font-bold text-blue-900">
                              適用中
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-normal text-slate-500 mt-0.5 leading-tight">
                          付箋（Sticky Note）のように予定カードを貼り付けた立体的なスタイル
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* セクション 5: 表示フォーカス切り替え */}
            {onToggleFocus && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  計画表の表示フォーカス
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs space-y-1">
                  <button
                    onClick={() => {
                      if (focusMode !== 'today') onToggleFocus();
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                      focusMode === 'today'
                        ? 'bg-blue-50 font-bold text-blue-900 border border-blue-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Crosshair className="h-3.5 w-3.5 text-blue-600" />
                      今日にフォーカス（1日拡大）
                    </span>
                    {focusMode === 'today' && (
                      <span className="text-[10px] font-bold text-blue-600">選択中</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (focusMode !== 'week') onToggleFocus();
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                      focusMode === 'week'
                        ? 'bg-blue-50 font-bold text-blue-900 border border-blue-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CalendarRange className="h-3.5 w-3.5 text-blue-600" />
                      週間全体表示（7日間）
                    </span>
                    {focusMode === 'week' && (
                      <span className="text-[10px] font-bold text-blue-600">選択中</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* セクション 6: シート切り替え */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                シート切り替え
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs space-y-1">
                <button
                  onClick={() => {
                    onTabChange('timeline');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                    activeTab === 'timeline'
                      ? 'bg-blue-50 font-bold text-blue-900 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    計画表
                  </span>
                  {unassignedCount > 0 && (
                    <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[9px] font-bold text-amber-950">
                      {unassignedCount}件未配置
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    onTabChange('data');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                    activeTab === 'data'
                      ? 'bg-emerald-50 font-bold text-emerald-900 border border-emerald-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    データ管理
                  </span>
                  {tablesCount > 0 && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                      {tablesCount}件
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* バーフッター */}
          <div className="shrink-0 border-t border-slate-200 bg-[#f7f5ee] px-4 py-2.5 text-center text-[10px] text-slate-500 font-medium">
            理論値計画表・時間割スケジューラー
          </div>
        </div>
      </div>
    </footer>
  );
}
