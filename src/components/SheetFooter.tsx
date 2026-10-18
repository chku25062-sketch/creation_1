'use client';

import React from 'react';
import {
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  Target,
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
}: SheetFooterProps) {
  return (
    <footer className="shrink-0 border-t border-slate-300 bg-[#ede8dc] px-2 py-1 select-none shadow-xs">
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

        {/* Right: Status and Quick Actions */}
        <div className="flex items-center gap-2 text-xs order-2 sm:order-3">
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

          {/* Cloud Auth Status */}
          {userEmail ? (
            <div className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 shadow-2xs">
              <Cloud className="h-3 w-3 text-emerald-600" />
              <span className="max-w-[100px] truncate sm:max-w-none text-[11px] font-medium">
                {userEmail}
              </span>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  title="ログアウト"
                  className="text-slate-400 transition hover:text-rose-600"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            onOpenAuth && (
              <div className="flex items-center gap-1">
                <span className="hidden items-center gap-1 text-[10px] text-slate-500 lg:flex">
                  <CloudOff className="h-2.5 w-2.5 text-amber-500" />
                  ローカル
                </span>
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 shadow-2xs"
                >
                  <LogIn className="h-3 w-3 text-slate-500" />
                  <span className="hidden sm:inline">
                    {isSupabaseConfigured ? 'クラウド保存' : 'クラウド連携'}
                  </span>
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </footer>
  );
}
