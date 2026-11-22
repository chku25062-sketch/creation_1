'use client';

import React, { useState } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sliders,
  Sun,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { ImportedTableData } from '@/types';
import { PeriodTimeSlot, minutesToTimeString, timeStringToMinutes } from '@/lib/timeUtils';

export interface PeriodTimeEditModalProps {
  rowIndex: number;
  totalRows: number;
  activeTable: ImportedTableData;
  periodTimes: PeriodTimeSlot[];
  viewMode: 'mobile' | 'desktop';
  onClose: () => void;
  onSelectRowIndex: (nextRowIndex: number) => void;
  onUpdateCustomRowTime: (periodIndex: number, field: 'start' | 'end', timeStr: string) => void;
  onResetCustomRowTime: (periodIndex: number) => void;
  onUpdateTableAxisConfig: (key: keyof ImportedTableData['axisConfig'], value: string | number | boolean | null) => void;
}

export function PeriodTimeEditModal({
  rowIndex,
  totalRows,
  activeTable,
  periodTimes,
  viewMode,
  onClose,
  onSelectRowIndex,
  onUpdateCustomRowTime,
  onResetCustomRowTime,
  onUpdateTableAxisConfig,
}: PeriodTimeEditModalProps) {
  const [isGlobalConfigOpen, setIsGlobalConfigOpen] = useState(false);

  const periodIndex = rowIndex + 1;
  const currentSlot = periodTimes[rowIndex];

  const customRowTimes = activeTable.axisConfig.customRowTimes || {};
  const isCustomTime = Boolean(customRowTimes[periodIndex]);

  const startTimeStr = currentSlot?.startTime || '';
  const endTimeStr = currentSlot?.endTime || '';

  // 所要時間（分）の計算
  const startMins = startTimeStr ? timeStringToMinutes(startTimeStr) : null;
  const endMins = endTimeStr ? timeStringToMinutes(endTimeStr) : null;
  const durationMins =
    startMins !== null && endMins !== null && endMins >= startMins
      ? endMins - startMins
      : null;

  // 開始時刻の変更ハンドラ
  const handleStartTimeChange = (val: string) => {
    if (!val) return;
    onUpdateCustomRowTime(periodIndex, 'start', val);
  };

  // 終了時刻の変更ハンドラ
  const handleEndTimeChange = (val: string) => {
    if (!val) return;
    onUpdateCustomRowTime(periodIndex, 'end', val);
  };

  // 時間調整（クイック加減算）
  const handleAdjustDuration = (diffMins: number) => {
    if (!startMins) return;
    const currentEnd = endMins ?? (startMins + (activeTable.axisConfig.periodMinutes || 90));
    const nextEndMins = Math.max(startMins + 5, currentEnd + diffMins);
    onUpdateCustomRowTime(periodIndex, 'end', minutesToTimeString(nextEndMins));
  };

  const modalContent = (
    <div className="flex flex-col max-h-[85vh] sm:max-h-[90vh]">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 bg-slate-50/80 rounded-t-2xl">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectRowIndex(rowIndex - 1)}
            disabled={rowIndex <= 0}
            title="前の時限へ"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition shadow-2xs"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white shadow-2xs">
              {periodIndex}
            </span>
            <span className="text-sm font-bold text-slate-800">
              第 {periodIndex} 時限の時間変更
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectRowIndex(rowIndex + 1)}
            disabled={rowIndex >= totalRows - 1}
            title="次の時限へ"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition shadow-2xs"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* スクロール領域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. 該当時限の時間設定カード */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>第 {periodIndex} 時限の時刻</span>
            </div>
            {isCustomTime && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                個別微調整中
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                開始時刻
              </label>
              <input
                type="time"
                value={startTimeStr}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-2 font-mono text-base font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                終了時刻
              </label>
              <input
                type="time"
                value={endTimeStr}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-2 font-mono text-base font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
              />
            </div>
          </div>

          {/* 所要時間 ＆ クイック調整 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-blue-100/60 text-xs">
            <div className="text-slate-600 font-medium">
              コマの長さ:{' '}
              {durationMins !== null ? (
                <span className="font-bold text-slate-900">{durationMins} 分</span>
              ) : (
                <span className="text-slate-400">未設定</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAdjustDuration(-15)}
                disabled={!startMins || (durationMins !== null && durationMins <= 15)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition shadow-2xs"
              >
                -15分
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDuration(15)}
                disabled={!startMins}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition shadow-2xs"
              >
                +15分
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDuration(30)}
                disabled={!startMins}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition shadow-2xs"
              >
                +30分
              </button>
            </div>
          </div>

          {/* 個別設定のリセットボタン */}
          {isCustomTime && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onResetCustomRowTime(periodIndex)}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>この時限を標準時間割ルールに戻す</span>
              </button>
            </div>
          )}

          {!activeTable.axisConfig.startTime && (
            <div className="flex items-start gap-1.5 rounded-lg bg-sky-50 border border-sky-200 p-2 text-[11px] text-sky-800">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-600" />
              <span>
                現在、表全体の開始時刻が未設定です。上記で開始時刻を入力するか、下の「表全体の時間割ルール」から表全体の開始時刻を設定すると、全時限に時間が自動反映されます。
              </span>
            </div>
          )}
        </div>

        {/* 2. 表全体の時間割ルール（一括設定アコーディオン） */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsGlobalConfigOpen(!isGlobalConfigOpen)}
            className="flex w-full items-center justify-between p-3 text-left font-bold text-xs text-slate-700 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-slate-500" />
              <span>表全体の時間割ルール（一括設定）</span>
            </div>
            {isGlobalConfigOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {isGlobalConfigOpen && (
            <div className="p-3 pt-0 border-t border-slate-100 space-y-3 bg-slate-50/50">
              <p className="text-[11px] text-slate-500 pt-2">
                表全体の開始時刻や1コマの分数を変更すると、個別微調整していない全時限に自動で時間が適用されます。
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    表の全体開始時刻
                  </label>
                  <input
                    type="time"
                    value={activeTable.axisConfig.startTime ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      onUpdateTableAxisConfig('startTime', val ? val : null);
                    }}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    終了上限時刻
                  </label>
                  <input
                    type="time"
                    value={activeTable.axisConfig.endTime ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      onUpdateTableAxisConfig('endTime', val ? val : null);
                    }}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    1コマの標準長さ
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      step={5}
                      value={activeTable.axisConfig.periodMinutes ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (!val || val === '0') {
                          onUpdateTableAxisConfig('periodMinutes', null);
                        } else {
                          const num = parseInt(val, 10);
                          onUpdateTableAxisConfig('periodMinutes', isNaN(num) || num <= 0 ? null : num);
                        }
                      }}
                      placeholder="自動"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white pr-7 text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                    />
                    <span className="absolute right-2 text-xs font-bold text-slate-400 pointer-events-none">分</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    コマ間休憩
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={5}
                      value={activeTable.axisConfig.intervalMinutes ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (val === '') {
                          onUpdateTableAxisConfig('intervalMinutes', null);
                        } else {
                          const num = parseInt(val, 10);
                          onUpdateTableAxisConfig('intervalMinutes', isNaN(num) || num < 0 ? null : num);
                        }
                      }}
                      placeholder="0"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white pr-7 text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                    />
                    <span className="absolute right-2 text-xs font-bold text-slate-400 pointer-events-none">分</span>
                  </div>
                </div>
              </div>

              {/* 昼休み設定 */}
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span>昼休みを挟む</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={activeTable.axisConfig.hasLunch}
                    onClick={() => onUpdateTableAxisConfig('hasLunch', !activeTable.axisConfig.hasLunch)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden ${
                      activeTable.axisConfig.hasLunch ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                        activeTable.axisConfig.hasLunch ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {activeTable.axisConfig.hasLunch && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">挿入する位置</label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, activeTable.numRows - 1)}
                          value={activeTable.axisConfig.lunchAfterPeriod}
                          onChange={(e) => {
                            const num = parseInt(e.target.value, 10);
                            if (!isNaN(num) && num >= 1) onUpdateTableAxisConfig('lunchAfterPeriod', num);
                          }}
                          className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 pr-7 text-xs font-bold text-center text-slate-800"
                        />
                        <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none">限後</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">昼休みの長さ</label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={10}
                          max={180}
                          step={5}
                          value={activeTable.axisConfig.lunchMinutes}
                          onChange={(e) => {
                            const num = parseInt(e.target.value, 10);
                            if (!isNaN(num) && num >= 1) onUpdateTableAxisConfig('lunchMinutes', num);
                          }}
                          className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 pr-7 text-xs font-bold text-center text-slate-800"
                        />
                        <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none">分</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="border-t border-slate-200/80 p-3 bg-slate-50 flex items-center justify-end rounded-b-2xl">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition cursor-pointer"
        >
          <Check className="h-4 w-4" />
          <span>完了</span>
        </button>
      </div>
    </div>
  );

  if (viewMode === 'mobile') {
    return (
      <div className="fixed inset-0 z-[70] flex items-end">
        {/* 背景オーバーレイ */}
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        />
        {/* ボトムシートモーダル */}
        <div className="relative z-10 w-full max-w-lg mx-auto bg-white rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
          {modalContent}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* 背景オーバーレイ */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
      />
      {/* デスクトップ中央モーダル */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {modalContent}
      </div>
    </div>
  );
}
