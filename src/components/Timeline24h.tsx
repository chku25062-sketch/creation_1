'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, ShieldCheck, Flame, Filter } from 'lucide-react';
import { TheoreticalBlock, TaskItem } from '@/types';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';

interface Timeline24hProps {
  blocks: TheoreticalBlock[];
  unassignedTasks: TaskItem[];
}

export function Timeline24h({ blocks, unassignedTasks }: Timeline24hProps) {
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'tasks' | 'fixed'>('all');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredBlocks = blocks.filter((block) => {
    if (filterMode === 'tasks') return !block.isFixed;
    if (filterMode === 'fixed') return block.isFixed;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
      {/* Timeline Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white">24時間 理論値タイムスケジュール</h3>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1 text-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              filterMode === 'all'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setFilterMode('tasks')}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              filterMode === 'tasks'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            目標タスク
          </button>
          <button
            onClick={() => setFilterMode('fixed')}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              filterMode === 'fixed'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            固定枠
          </button>
        </div>
      </div>

      {/* Visual 24h Continuous Progress Strip */}
      <div className="relative flex flex-col gap-1.5 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-cyan-400" />
            24時間タイムスパンマップ
          </span>
          {currentMinutes !== null && (
            <span className="flex items-center gap-1 font-mono text-cyan-300">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-cyan-400" />
              現在時刻: {minutesToTimeString(currentMinutes)}
            </span>
          )}
        </div>

        {/* 24-hour visual strip */}
        <div className="relative mt-2 h-7 w-full overflow-hidden rounded-lg bg-slate-900 border border-slate-800">
          {blocks.map((b) => {
            const left = (b.startMinutes / 1440) * 100;
            const width = ((b.endMinutes - b.startMinutes) / 1440) * 100;
            return (
              <div
                key={`strip-${b.id}`}
                title={`${b.title} (${minutesToTimeString(b.startMinutes)} - ${minutesToTimeString(b.endMinutes)})`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: b.color,
                }}
                className={`absolute inset-y-0 opacity-80 transition hover:opacity-100 ${
                  b.isFixed ? 'brightness-90' : 'brightness-110 shadow-sm'
                }`}
              />
            );
          })}

          {/* Current Time Pin */}
          {currentMinutes !== null && (
            <div
              style={{ left: `${(currentMinutes / 1440) * 100}%` }}
              title={`現在時刻: ${minutesToTimeString(currentMinutes)}`}
              className="absolute inset-y-0 z-20 w-0.5 bg-rose-500 shadow-md shadow-rose-500"
            >
              <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/80 ring-2 ring-white/50" />
            </div>
          )}
        </div>

        {/* Time markers */}
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
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
              固定時間の見直し、またはタスクの所要時間・優先度を調整してください。
            </p>
          </div>
        </div>
      )}

      {/* Timeline Blocks List */}
      <div className="relative flex flex-col gap-2.5">
        {filteredBlocks.map((block) => {
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
