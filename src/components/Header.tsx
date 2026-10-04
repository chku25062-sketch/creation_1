'use client';

import React from 'react';
import { Target, Sparkles, Cloud, CloudOff, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

interface HeaderProps {
  userEmail?: string | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  lastSavedAt?: Date | null;
}

export function Header({ userEmail, onOpenAuth, onSignOut, lastSavedAt }: HeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6">
        {/* App Title */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
            <Target className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                理論値計画表
              </h1>
              <span className="hidden items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.2 text-[10px] font-medium text-cyan-400 sm:inline-flex">
                <Sparkles className="h-2.5 w-2.5" />
                Ideal Daily
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              目標を100%達成する理想の1日スケジュールを自律算出
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Autosave badge */}
          {lastSavedAt && (
            <span className="hidden items-center gap-1 text-[11px] text-slate-400 sm:flex">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              自動保存済
            </span>
          )}

          {/* Cloud / Local Badge */}
          {userEmail ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300">
              <Cloud className="h-3.5 w-3.5 text-emerald-400" />
              <span className="max-w-[120px] truncate sm:max-w-none">{userEmail}</span>
              <button
                onClick={onSignOut}
                title="ログアウト"
                className="ml-1 text-slate-400 transition hover:text-rose-400"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-400 md:flex">
                <CloudOff className="h-3 w-3 text-amber-400" />
                ゲストモード
              </span>
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 transition hover:border-cyan-500/60 hover:bg-cyan-500/20"
              >
                <LogIn className="h-3 w-3" />
                <span>{isSupabaseConfigured ? 'クラウド保存' : 'クラウド連携'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
