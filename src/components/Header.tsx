'use client';

import React from 'react';
import { Target, Cloud, CloudOff, LogIn, LogOut, CheckCircle2, Upload } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

interface HeaderProps {
  userEmail?: string | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenImport?: () => void;
  lastSavedAt?: Date | null;
}

export function Header({
  userEmail,
  onOpenAuth,
  onSignOut,
  onOpenImport,
  lastSavedAt,
}: HeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6">
        {/* App Title */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-xs">
            <Target className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                理論値計画表
              </h1>
              <span className="hidden items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline-flex">
                週間・日次プランナー
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              固定枠と目標タスクから理想のタイムスケジュールを編成
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2.5">
          {/* File Import Button */}
          {onOpenImport && (
            <button
              onClick={onOpenImport}
              className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-500/20"
              title="時間割画像やテキストファイルから一括取り込み"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>ファイル取込</span>
            </button>
          )}

          {/* Autosave badge */}
          {lastSavedAt && (
            <span className="hidden items-center gap-1 text-[11px] font-medium text-slate-500 sm:flex">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              自動保存済
            </span>
          )}

          {/* Cloud / Local Badge */}
          {userEmail ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
              <Cloud className="h-3.5 w-3.5 text-emerald-600" />
              <span className="max-w-[120px] truncate sm:max-w-none font-medium">{userEmail}</span>
              <button
                onClick={onSignOut}
                title="ログアウト"
                className="ml-1 text-slate-400 transition hover:text-rose-600"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 md:flex">
                <CloudOff className="h-3 w-3 text-amber-500" />
                ローカル保存中
              </span>
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400"
              >
                <LogIn className="h-3 w-3 text-slate-500" />
                <span>{isSupabaseConfigured ? 'クラウド保存' : 'クラウド連携'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
