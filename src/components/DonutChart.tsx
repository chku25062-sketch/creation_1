'use client';

import React, { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import { CategorySummary } from '@/types';
import { formatDuration } from '@/lib/timeUtils';

interface DonutChartProps {
  summaries: CategorySummary[];
}

export function DonutChart({ summaries }: DonutChartProps) {
  // SVG 円周計算 (radius = 70, circumference = 2 * PI * 70 ≈ 439.82)
  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  // 余白枠（未割り当て時間）を算出して完全な24時間（1440分）のパイを構成
  const chartSegments = useMemo(() => {
    const totalMinutes = summaries.reduce((acc, s) => acc + s.minutes, 0);
    const freeMinutes = Math.max(0, 1440 - totalMinutes);

    const fullList = [...summaries];
    if (freeMinutes > 0) {
      fullList.push({
        name: '自由余白バッファ',
        category: 'buffer',
        minutes: freeMinutes,
        percentage: Math.round((freeMinutes / 1440) * 100),
        color: '#334155', // Slate 700
      });
    }

    let runningOffset = 0;
    return fullList.map((item) => {
      const strokeDasharray = (item.minutes / 1440) * circumference;
      const strokeDashoffset = -runningOffset;
      runningOffset += strokeDasharray;

      return {
        ...item,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [summaries, circumference]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <PieChart className="h-4 w-4 text-cyan-400" />
        <span>理想の時間配分バランス</span>
      </div>

      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center">
          <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90 transform">
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="#1e293b"
              strokeWidth="20"
            />
            {chartSegments.map((item) => (
              <circle
                key={item.category}
                cx="90"
                cy="90"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth="20"
                strokeDasharray={`${item.strokeDasharray} ${circumference}`}
                strokeDashoffset={item.strokeDashoffset}
                className="transition-all duration-700 ease-out hover:opacity-90"
              />
            ))}
          </svg>

          {/* Center Text */}
          <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center">
            <span className="text-xl font-black text-white">24h</span>
            <span className="text-[10px] text-slate-400">理論値構成</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex w-full flex-col gap-2 sm:max-w-xs">
          {chartSegments.map((item) => (
            <div
              key={item.category}
              className="flex items-center justify-between rounded-lg border border-slate-800/40 bg-slate-950/30 px-3 py-1.5 text-xs transition hover:border-slate-700"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate font-medium text-slate-200">{item.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-slate-400">{formatDuration(item.minutes)}</span>
                <span className="w-8 text-right font-bold text-slate-300">
                  {Math.round((item.minutes / 1440) * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
