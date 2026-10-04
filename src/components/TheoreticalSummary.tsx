'use client';

import React from 'react';
import { Trophy, Clock, Moon, Briefcase, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ScheduleMetrics } from '@/types';
import { formatDuration } from '@/lib/timeUtils';

interface TheoreticalSummaryProps {
  metrics: ScheduleMetrics;
}

export function TheoreticalSummary({ metrics }: TheoreticalSummaryProps) {
  const isPerfect = metrics.theoreticalScore === 100;

  const handleCelebrate = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#38bdf8', '#34d399', '#818cf8', '#f472b6'],
    });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 p-6 shadow-2xl backdrop-blur-xl">
      {/* Background Glow */}
      <div
        className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl transition-opacity duration-700 ${
          isPerfect ? 'bg-emerald-500/15' : 'bg-cyan-500/10'
        }`}
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Main Score Board */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border p-2 shadow-inner transition-all duration-300 ${
                isPerfect
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/10'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
              }`}
            >
              <span className="text-3xl font-black tracking-tight">
                {metrics.theoreticalScore}%
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                理論値スコア
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {isPerfect ? '理論値パーフェクト達成' : '理論値最適化中'}
                </h2>
                {isPerfect && (
                  <button
                    onClick={handleCelebrate}
                    title="お祝いクラッカーを鳴らす"
                    className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300 transition hover:scale-105"
                  >
                    <Sparkles className="h-3 w-3" />
                    理想到達
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">
                {isPerfect
                  ? '登録されたすべての目標タスク（' +
                    metrics.assignedTaskCount +
                    '件 / ' +
                    formatDuration(metrics.scheduledTaskMinutes) +
                    '）が24時間の理想配置に収まりました！'
                  : `全目標の消化まであと ${formatDuration(metrics.unassignedTaskMinutes)} 分の枠調整が必要です。`}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>睡眠休養</span>
            </div>
            <p className="mt-1 text-base font-bold text-white">
              {formatDuration(metrics.sleepMinutes)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Briefcase className="h-3.5 w-3.5 text-blue-400" />
              <span>生活・本業</span>
            </div>
            <p className="mt-1 text-base font-bold text-white">
              {formatDuration(metrics.fixedMinutes)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Trophy className="h-3.5 w-3.5 text-cyan-400" />
              <span>目標タスク消化</span>
            </div>
            <p className="mt-1 text-base font-bold text-cyan-300">
              {formatDuration(metrics.scheduledTaskMinutes)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>自由余白枠</span>
            </div>
            <p className="mt-1 text-base font-bold text-slate-200">
              {formatDuration(Math.max(0, metrics.freeMinutes - metrics.scheduledTaskMinutes))}
            </p>
          </div>
        </div>
      </div>

      {/* 24-Hour Visual Ratio Bar */}
      <div className="mt-6 border-t border-slate-800/60 pt-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>24時間のタイムアロケーション</span>
          <span>計 24時間 (1,440分)</span>
        </div>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            style={{ width: `${(metrics.sleepMinutes / 1440) * 100}%` }}
            title={`睡眠: ${formatDuration(metrics.sleepMinutes)}`}
            className="bg-indigo-500 transition-all duration-500"
          />
          <div
            style={{ width: `${(metrics.fixedMinutes / 1440) * 100}%` }}
            title={`生活・本業: ${formatDuration(metrics.fixedMinutes)}`}
            className="bg-blue-500 transition-all duration-500"
          />
          <div
            style={{ width: `${(metrics.scheduledTaskMinutes / 1440) * 100}%` }}
            title={`目標消化: ${formatDuration(metrics.scheduledTaskMinutes)}`}
            className="bg-cyan-400 transition-all duration-500"
          />
          <div
            style={{
              width: `${(Math.max(0, metrics.freeMinutes - metrics.scheduledTaskMinutes) / 1440) * 100}%`,
            }}
            title={`自由余白: ${formatDuration(Math.max(0, metrics.freeMinutes - metrics.scheduledTaskMinutes))}`}
            className="bg-slate-700 transition-all duration-500"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-500" /> 睡眠
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> 生活・固定
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> 目標タスク
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-700" /> 余白バッファ
          </span>
        </div>
      </div>
    </div>
  );
}
