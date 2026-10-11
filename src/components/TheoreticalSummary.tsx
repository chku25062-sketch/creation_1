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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Main Score Board */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border p-2 transition-all ${
                isPerfect
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-xs'
                  : 'border-blue-200 bg-blue-50 text-blue-700 shadow-xs'
              }`}
            >
              <span className="text-3xl font-black tracking-tight">
                {metrics.theoreticalScore}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                理論値スコア
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {isPerfect ? '理論値パーフェクト達成' : '目標スケジュール編成中'}
                </h2>
                {isPerfect && (
                  <button
                    onClick={handleCelebrate}
                    title="お祝いクラッカーを鳴らす"
                    className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Sparkles className="h-3 w-3" />
                    理想到達
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Moon className="h-3.5 w-3.5 text-indigo-600" />
              <span>睡眠休養</span>
            </div>
            <p className="mt-1 text-base font-bold text-slate-900">
              {formatDuration(metrics.sleepMinutes)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Briefcase className="h-3.5 w-3.5 text-blue-600" />
              <span>生活・本業</span>
            </div>
            <p className="mt-1 text-base font-bold text-slate-900">
              {formatDuration(metrics.fixedMinutes)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Trophy className="h-3.5 w-3.5 text-blue-600" />
              <span>目標タスク消化</span>
            </div>
            <p className="mt-1 text-base font-bold text-blue-700">
              {formatDuration(metrics.scheduledTaskMinutes)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>自由余白枠</span>
            </div>
            <p className="mt-1 text-base font-bold text-slate-700">
              {formatDuration(Math.max(0, metrics.freeMinutes - metrics.scheduledTaskMinutes))}
            </p>
          </div>
        </div>
      </div>

      {/* 24-Hour Visual Ratio Bar */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>24時間のタイムアロケーション</span>
          <span>計 24時間 (1,440分)</span>
        </div>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
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
            className="bg-blue-600 transition-all duration-500"
          />
          <div
            style={{
              width: `${(Math.max(0, metrics.freeMinutes - metrics.scheduledTaskMinutes) / 1440) * 100}%`,
            }}
            title={`自由余白: ${formatDuration(Math.max(0, metrics.freeMinutes - metrics.scheduledTaskMinutes))}`}
            className="bg-slate-300 transition-all duration-500"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-4 text-[11px] text-slate-600 font-medium">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-500" /> 睡眠
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> 生活・固定
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> 目標タスク
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-300" /> 余白バッファ
          </span>
        </div>
      </div>
    </div>
  );
}
