'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

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

          {/* フォーカス切り替えアイコンボタン (メニューアイコンの隣) */}
          {onToggleFocus && (
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
          className={`absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col border-l border-slate-300 bg-[#fdfcf9] bg-notebook-grid shadow-2xl transition-transform duration-300 ease-out ${
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
            {/* セクション 1: クラウド連携 */}
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

            {/* セクション 2: データ保存状況 */}
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

            {/* セクション 3: 表示フォーカス切り替え */}
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

            {/* セクション 4: シート切り替え */}
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
