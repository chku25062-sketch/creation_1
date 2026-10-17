'use client';

import React from 'react';
import {
  Target,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  CheckCircle2,
  Upload,
  Calendar,
  Settings,
  Minimize2,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

interface HeaderProps {
  userEmail?: string | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenImport?: () => void;
  lastSavedAt?: Date | null;
  activeTab: 'timeline' | 'settings';
  onTabChange: (tab: 'timeline' | 'settings') => void;
  unassignedCount?: number;
  tasksCount?: number;
  fixedCount?: number;
  onHideHeader?: () => void;
}

export function Header({
  userEmail,
  onOpenAuth,
  onSignOut,
  onOpenImport,
  lastSavedAt,
  activeTab,
  onTabChange,
  unassignedCount = 0,
  tasksCount = 0,
  fixedCount = 0,
  onHideHeader,
}: HeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex h-11 w-full max-w-full items-center justify-between px-2.5 sm:px-4">
        {/* Left: App Title & Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 shadow-2xs">
            <Target className="h-3.5 w-3.5 text-white" />
          </div>
          <h1 className="text-xs font-bold tracking-tight text-slate-900 sm:text-sm">
            理論値計画表
          </h1>
        </div>

        {/* Center: Slim Navigation Tabs */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={() => onTabChange('timeline')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition ${
              activeTab === 'timeline'
                ? 'bg-white font-semibold text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">週間スケジュール</span>
            <span className="sm:hidden">週間</span>
            {unassignedCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1 py-0.2 text-[9px] font-bold text-amber-950">
                {unassignedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('settings')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition ${
              activeTab === 'settings'
                ? 'bg-white font-semibold text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">目標・固定枠設定</span>
            <span className="sm:hidden">設定</span>
            <span className="hidden rounded-full bg-slate-200/80 px-1 py-0.2 text-[9px] text-slate-600 md:inline">
              {tasksCount + fixedCount}
            </span>
          </button>
        </div>

        {/* Right: Actions, Cloud Status, and Hide Header Button */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* File Import Button */}
          {onOpenImport && (
            <button
              onClick={onOpenImport}
              className="flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
              title="時間割画像やテキストファイルから一括取り込み"
            >
              <Upload className="h-3 w-3" />
              <span className="hidden sm:inline">ファイル取込</span>
            </button>
          )}

          {/* Autosave status */}
          {lastSavedAt && (
            <span
              className="hidden items-center gap-1 text-[10px] text-slate-400 lg:flex"
              title="ローカル保存済"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            </span>
          )}

          {/* Cloud / Local Badge */}
          {userEmail ? (
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
              <Cloud className="h-3 w-3 text-emerald-600" />
              <span className="max-w-[90px] truncate sm:max-w-none text-[11px] font-medium">
                {userEmail}
              </span>
              <button
                onClick={onSignOut}
                title="ログアウト"
                className="text-slate-400 transition hover:text-rose-600"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="hidden items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 xl:flex">
                <CloudOff className="h-2.5 w-2.5 text-amber-500" />
                ローカル
              </span>
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <LogIn className="h-3 w-3 text-slate-500" />
                <span className="hidden sm:inline">
                  {isSupabaseConfigured ? 'クラウド保存' : 'クラウド連携'}
                </span>
              </button>
            </div>
          )}

          {/* Hide Header Button (Full Screen Focus for Timeline) */}
          {onHideHeader && (
            <button
              onClick={onHideHeader}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              title="ヘッダーを隠して縦最大表示にする"
            >
              <Minimize2 className="h-3 w-3" />
              <span className="hidden lg:inline text-[11px]">ヘッダー隠す</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
