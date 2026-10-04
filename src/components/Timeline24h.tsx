'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';
import { TheoreticalBlock, TaskItem } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

interface Timeline24hProps {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
}

export function Timeline24h({ blocks, unassignedTasks }: Timeline24hProps) {
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
      {/* Timeline Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white sm:text-lg">24時間 理論値スケジュール</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-700 border border-slate-600" />
            生活固定枠
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500 shadow-sm shadow-cyan-500/50" />
            目標タスク (自動最適配置)
          </span>
        </div>
      </div>

      {/* Unassigned Warning Alert if any */}
      {unassignedTasks.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <span className="font-semibold text-amber-300">
              枠不足により本日未配置のタスクがあります（{unassignedTasks.length}件）:
            </span>
            <ul className="mt-1 list-inside list-disc text-amber-200/90">
              {unassignedTasks.map((t) => (
                <li key={t.id}>
                  {t.title} ({formatDuration(t.durationMinutes)}) - 優先度: {t.priority}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-amber-400">
              「設定」タブから固定枠の時間を見直すか、タスクの所要時間を調整してください。
            </p>
          </div>
        </div>
      )}

      {/* Timeline Blocks List */}
      <div className="flex flex-col gap-2.5">
        {blocks.map((block) => {
          const duration = block.endMinutes - block.startMinutes;
          const isCurrent =
            currentMinutes !== null &&
            currentMinutes >= block.startMinutes &&
            currentMinutes < block.endMinutes;

          return (
            <div
              key={block.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border transition-all duration-200 sm:flex-row sm:items-center ${
                isCurrent
                  ? 'border-cyan-500 bg-slate-800/90 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                  : block.isFixed
                    ? 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700'
                    : 'border-slate-700/80 bg-slate-800/40 hover:border-cyan-500/50 hover:bg-slate-800/60'
              } p-3.5`}
            >
              {/* Left Color Accent Bar */}
              <div
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: block.color }}
              />

              {/* Time & Title */}
              <div className="flex items-center gap-3 pl-2">
                <div className="flex min-w-[100px] items-center gap-1.5 font-mono text-xs font-semibold text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {minutesToTimeString(block.startMinutes)} -{' '}
                    {minutesToTimeString(block.endMinutes)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{block.title}</span>
                  {block.isFixed ? (
                    <span className="flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      <ShieldCheck className="h-3 w-3 text-slate-400" />
                      固定
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">
                      <Flame className="h-3 w-3 text-cyan-400" />
                      理論値割当
                    </span>
                  )}
                  {block.priority === 'high' && (
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                      高優先
                    </span>
                  )}
                </div>
              </div>

              {/* Duration & Status */}
              <div className="mt-2 flex items-center justify-between gap-3 pl-2 sm:mt-0 sm:pl-0">
                {isCurrent && (
                  <span className="flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[11px] font-bold text-cyan-300 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    現在進行中
                  </span>
                )}
                <span className="rounded-lg bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300">
                  {formatDuration(duration)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
