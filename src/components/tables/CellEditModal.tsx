'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  Coffee,
  Pin,
  ExternalLink,
  Copy,
  ClipboardPaste,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { ImportedTableData } from '@/types';
import { getCellDefaultDuration, getCellDefaultStartTime } from '@/lib/tableUtils';
import { PeriodTimeSlot } from '@/lib/timeUtils';

export interface CopiedCellPayload {
  text: string;
  breakMinutes: number;
  customDurationMinutes?: number;
  customStartTime?: string;
  hasCustomTime?: boolean;
  url?: string;
  attachedEnabled?: boolean;
  attachedDuration?: number;
  attachedAllowSplit?: boolean;
  attachedSplitCount?: number;
  attachedMinSplit?: number;
}

export interface CellEditModalProps {
  editingCell: { r: number; c: number };
  activeTable: ImportedTableData;
  viewMode: 'mobile' | 'desktop';
  periodTimes: PeriodTimeSlot[];
  copiedCellData: CopiedCellPayload | null;
  onCopyCell: (payload: CopiedCellPayload) => void;
  onClose: () => void;
  onSave: (updatedData: {
    text: string;
    breakMinutes: number;
    customDurationMinutes: number;
    customStartTime: string;
    hasCustomTime: boolean;
    url: string;
    attachedTask?: {
      enabled: boolean;
      durationMinutes: number;
      allowSplit?: boolean;
      splitCount?: number;
      minSplitMinutes?: number;
    };
  }) => void;
  onClear: () => void;
}

export function CellEditModal({
  editingCell,
  activeTable,
  viewMode,
  periodTimes,
  copiedCellData,
  onCopyCell,
  onClose,
  onSave,
  onClear,
}: CellEditModalProps) {
  const initialCell = activeTable.cells[editingCell.r]?.[editingCell.c] || {};

  const cellDefaultPeriod = getCellDefaultDuration(
    activeTable,
    editingCell.r,
    editingCell.c,
    periodTimes,
  );
  const { startTime: defaultStartTime, hasExplicitTime } = getCellDefaultStartTime(
    activeTable,
    editingCell.r,
    editingCell.c,
    periodTimes,
  );

  const periodIndex = editingCell.r + 1;
  const isLunchAfterThisPeriod =
    Boolean(activeTable.axisConfig.hasLunch) &&
    activeTable.axisConfig.lunchAfterPeriod === periodIndex;

  const tableIntervalMinutes = isLunchAfterThisPeriod
    ? (activeTable.axisConfig.lunchMinutes ?? 50)
    : (activeTable.axisConfig.intervalMinutes ?? 0);
  const [cellEditText, setCellEditText] = useState(initialCell.text || initialCell.title || '');
  const [cellBreakMinutes, setCellBreakMinutes] = useState<number>(
    initialCell.breakMinutes !== undefined && initialCell.breakMinutes !== null
      ? initialCell.breakMinutes
      : tableIntervalMinutes,
  );
  const [cellCustomDuration, setCellCustomDuration] = useState<number>(
    initialCell.customDurationMinutes || cellDefaultPeriod,
  );
  const [cellCustomStartTime, setCellCustomStartTime] = useState<string>(
    initialCell.customStartTime || defaultStartTime,
  );
  const [cellHasCustomTime, setCellHasCustomTime] = useState<boolean>(
    initialCell.hasCustomTime !== undefined ? initialCell.hasCustomTime : hasExplicitTime,
  );
  const [cellUrl, setCellUrl] = useState<string>(initialCell.url || '');
  const [cellAttachedEnabled, setCellAttachedEnabled] = useState<boolean>(
    initialCell.attachedTask?.enabled ?? activeTable.attachedTaskConfig?.enabled ?? false,
  );
  const [cellAttachedDuration, setCellAttachedDuration] = useState<number>(
    initialCell.attachedTask?.durationMinutes ||
      activeTable.attachedTaskConfig?.durationMinutes ||
      cellDefaultPeriod,
  );
  const [cellAttachedAllowSplit, setCellAttachedAllowSplit] = useState<boolean>(
    initialCell.attachedTask?.allowSplit ?? activeTable.attachedTaskConfig?.allowSplit ?? false,
  );
  const [cellAttachedSplitCount, setCellAttachedSplitCount] = useState<number>(
    initialCell.attachedTask?.splitCount ?? activeTable.attachedTaskConfig?.splitCount ?? 2,
  );
  const [copyFeedback, setCopyFeedback] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // マウント時にテキストを全選択・フォーカス（仮タスクのワンタップ上書き対応）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // コピー
  const handleCopy = () => {
    onCopyCell({
      text: cellEditText,
      breakMinutes: cellBreakMinutes,
      customDurationMinutes: cellCustomDuration,
      customStartTime: cellCustomStartTime,
      hasCustomTime: cellHasCustomTime,
      url: cellUrl,
      attachedEnabled: cellAttachedEnabled,
      attachedDuration: cellAttachedDuration,
      attachedAllowSplit: cellAttachedAllowSplit,
      attachedSplitCount: cellAttachedSplitCount,
    });
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  };

  // ペースト
  const handlePaste = () => {
    if (!copiedCellData) return;
    setCellEditText(copiedCellData.text);
    setCellBreakMinutes(copiedCellData.breakMinutes);
    if (copiedCellData.customDurationMinutes !== undefined) {
      setCellCustomDuration(copiedCellData.customDurationMinutes);
    }
    if (copiedCellData.hasCustomTime !== undefined) {
      setCellHasCustomTime(copiedCellData.hasCustomTime);
      if (copiedCellData.customStartTime) {
        setCellCustomStartTime(copiedCellData.customStartTime);
      }
    }
    if (copiedCellData.url !== undefined) {
      setCellUrl(copiedCellData.url);
    }
    if (copiedCellData.attachedEnabled !== undefined) {
      setCellAttachedEnabled(copiedCellData.attachedEnabled);
    }
    if (copiedCellData.attachedDuration !== undefined) {
      setCellAttachedDuration(copiedCellData.attachedDuration);
    }
    if (copiedCellData.attachedAllowSplit !== undefined) {
      setCellAttachedAllowSplit(copiedCellData.attachedAllowSplit);
    }
    if (copiedCellData.attachedSplitCount !== undefined) {
      setCellAttachedSplitCount(copiedCellData.attachedSplitCount);
    }
  };

  // 保存実行
  const handleSave = () => {
    onSave({
      text: cellEditText,
      breakMinutes: cellBreakMinutes,
      customDurationMinutes: cellCustomDuration,
      customStartTime: cellCustomStartTime,
      hasCustomTime: cellHasCustomTime,
      url: cellUrl,
      attachedTask: cellAttachedEnabled
        ? {
            enabled: true,
            durationMinutes: cellAttachedDuration,
            allowSplit: cellAttachedAllowSplit,
            splitCount: cellAttachedSplitCount,
            minSplitMinutes: 15,
          }
        : undefined,
    });
  };

  if (viewMode === 'mobile') {
    return (
      <div className="fixed inset-0 z-[70] flex items-end">
        {/* 背景オーバーレイ */}
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in cursor-pointer"
        />
        {/* ボトムシートコンテナ: 上部に十分な余白を確保しフル画面化を防止 */}
        <div className="relative z-10 flex w-full max-h-[75dvh] max-h-[calc(100dvh-5.5rem)] flex-col rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-250 overflow-hidden">
          {/* 上部ハンドル ＆ ヘッダー */}
          <div className="flex flex-col items-center pt-2.5 pb-2.5 px-4 border-b border-slate-100 shrink-0">
            <div className="h-1 w-10 rounded-full bg-slate-300 mb-2" />
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-xs shadow-2xs">
                  {editingCell.r + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">コマ内容の編集</h3>
                  <p className="text-[11px] text-slate-500">
                    {activeTable.colHeaders[editingCell.c]} / {editingCell.r + 1}限目
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* コピーアイコン */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition relative cursor-pointer"
                  title="このコマの内容と設定をコピー"
                >
                  <Copy className="h-4 w-4" />
                  {copyFeedback && (
                    <span className="absolute -top-7 right-0 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-in fade-in">
                      コピー済
                    </span>
                  )}
                </button>
                {/* ペーストアイコン */}
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={!copiedCellData}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  title={copiedCellData ? 'コピーした内容を貼り付け' : 'クリップボードが空です'}
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* フォーム入力エリア（スクロール可能） */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {/* コマ内容入力 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                講義名・日課名（1行目）
              </label>
              <textarea
                ref={textareaRef}
                rows={2}
                value={cellEditText}
                onChange={(e) => setCellEditText(e.target.value)}
                placeholder="講義名・科目名・日課名（改行で場所・メモ）"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                改行すると2行目以降が場所・メモとして小さく表示されます
              </span>
            </div>

            {/* 所要時間 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">所要時間</div>
                    <div className="text-[10px] text-slate-500">
                      {cellCustomDuration === cellDefaultPeriod
                        ? `表の設定（${cellDefaultPeriod}分）を適用中`
                        : `個別設定中（表の規定: ${cellDefaultPeriod}分）`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCellCustomDuration(Math.max(5, cellCustomDuration - 5))}
                    className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-mono font-bold text-sm text-blue-700">
                    {cellCustomDuration}分
                  </span>
                  <button
                    type="button"
                    onClick={() => setCellCustomDuration(Math.min(300, cellCustomDuration + 5))}
                    className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setCellCustomDuration(cellDefaultPeriod)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
                    title="表の規定時間に戻す"
                  >
                    リセット
                  </button>
                </div>
              </div>
            </div>

            {/* 開始時刻 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">開始時刻</div>
                    <div className="text-[10px] text-slate-500">
                      {cellHasCustomTime
                        ? `個別設定中（表の規定: ${defaultStartTime}）`
                        : `表の設定・自動配置に従う（${defaultStartTime}）`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cellHasCustomTime}
                  onClick={() => setCellHasCustomTime(!cellHasCustomTime)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    cellHasCustomTime ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                  title={cellHasCustomTime ? '時刻指定を解除（空き枠自動配置）' : '時刻を指定'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      cellHasCustomTime ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {cellHasCustomTime && (
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">開始時刻:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={cellCustomStartTime}
                      onChange={(e) => setCellCustomStartTime(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-mono font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setCellCustomStartTime(defaultStartTime)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                      title="表の開始時刻に戻す"
                    >
                      リセット
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 関連URL */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-indigo-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">関連URL</div>
                    <div className="text-[10px] text-slate-500">Zoom / Meet / LMS課題リンクなど</div>
                  </div>
                </div>
                {cellUrl.trim() && (
                  <a
                    href={cellUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md hover:bg-blue-100 transition"
                  >
                    <span>開く</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <input
                type="url"
                value={cellUrl}
                onChange={(e) => setCellUrl(e.target.value)}
                placeholder="https://zoom.us/... や LMSのURL"
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-hidden"
              />
            </div>

            {/* タスク後の休憩時間 */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-emerald-50/60 p-3">
              <div className="flex items-center gap-2">
                <Coffee className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    タスク後の休憩時間{isLunchAfterThisPeriod ? ' (昼休み)' : ''}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isLunchAfterThisPeriod ? '※このコマの後は設定された昼休みです' : 'コマ直後に確保する休憩'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCellBreakMinutes(Math.max(0, cellBreakMinutes - 5))}
                  className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                >
                  -
                </button>
                <span className="w-12 text-center font-mono font-bold text-sm text-slate-800">
                  {cellBreakMinutes}分
                </span>
                <button
                  type="button"
                  onClick={() => setCellBreakMinutes(Math.min(120, cellBreakMinutes + 5))}
                  className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                >
                  +
                </button>
                {cellBreakMinutes !== tableIntervalMinutes && (
                  <button
                    type="button"
                    onClick={() => setCellBreakMinutes(tableIntervalMinutes)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
                    title={`表の規定${isLunchAfterThisPeriod ? '昼休み' : '休憩'}時間に戻す`}
                  >
                    規定({isLunchAfterThisPeriod ? '昼休み' : ''}{tableIntervalMinutes}分)
                  </button>
                )}
              </div>
            </div>

            {/* 付随タスク設定 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <Pin className="h-5 w-5 text-purple-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">付随タスク</div>
                    <div className="text-[10px] text-slate-500">このコマに連動してタスクを生成</div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cellAttachedEnabled}
                  onClick={() => setCellAttachedEnabled(!cellAttachedEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    cellAttachedEnabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      cellAttachedEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              {cellAttachedEnabled && (
                <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600">所要時間:</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCellAttachedDuration(Math.max(5, cellAttachedDuration - 5))}
                        className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-sm text-slate-800">
                        {cellAttachedDuration}分
                      </span>
                      <button
                        type="button"
                        onClick={() => setCellAttachedDuration(Math.min(180, cellAttachedDuration + 5))}
                        className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-slate-700">分割回数</span>
                      <p className="text-[10px] text-slate-400">空きコマに合わせて復習を分散</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = cellAttachedAllowSplit ? cellAttachedSplitCount : 1;
                          const next = Math.max(1, cur - 1);
                          if (next === 1) {
                            setCellAttachedAllowSplit(false);
                            setCellAttachedSplitCount(1);
                          } else {
                            setCellAttachedAllowSplit(true);
                            setCellAttachedSplitCount(next);
                          }
                        }}
                        className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-sm text-slate-800">
                        {cellAttachedAllowSplit ? `${cellAttachedSplitCount}回` : '1回'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = cellAttachedAllowSplit ? cellAttachedSplitCount : 1;
                          const next = cur + 1;
                          setCellAttachedAllowSplit(true);
                          setCellAttachedSplitCount(next);
                        }}
                        className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                      >
                        +
                      </button>
                      {cellAttachedAllowSplit && cellAttachedSplitCount > 1 && (
                        <span className="text-[10px] text-indigo-700 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                          {Math.floor(cellAttachedDuration / cellAttachedSplitCount)}分×{cellAttachedSplitCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ボトムアクションバー */}
          <div className="shrink-0 border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-50/95 flex items-center gap-2 shadow-lg">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>閉じる</span>
            </button>
            <button
              type="button"
              onClick={onClear}
              className="flex-1 h-12 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>空にする</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-[1.2] h-12 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>保存する</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // デスクトップ版ダイアログ (PC向け中央配置モーダル)
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl animate-in zoom-in-95 duration-150 cursor-default max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">
            コマ内容を編集 ({editingCell.r + 1}行目・{activeTable.colHeaders[editingCell.c]})
          </span>
          <div className="flex items-center gap-1">
            {/* コピーアイコン */}
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition relative cursor-pointer"
              title="このコマの内容と設定をコピー"
            >
              <Copy className="h-3.5 w-3.5" />
              {copyFeedback && (
                <span className="absolute -top-7 right-0 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-in fade-in">
                  コピー済
                </span>
              )}
            </button>
            {/* ペーストアイコン */}
            <button
              type="button"
              onClick={handlePaste}
              disabled={!copiedCellData}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title={copiedCellData ? 'コピーした内容を貼り付け' : 'クリップボードが空です'}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* コマ内容入力 */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={cellEditText}
          onChange={(e) => setCellEditText(e.target.value)}
          placeholder="1行目: コマ名称（講義名・メニュー・日課名など）&#13;&#10;2行目以降: 場所・メモ・詳細"
          className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
        />

        {/* 所要時間 */}
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-800">所要時間</div>
              <div className="text-[10px] text-slate-500">
                {cellCustomDuration === cellDefaultPeriod
                  ? `表の設定（${cellDefaultPeriod}分）を適用中`
                  : `個別設定中（表の規定: ${cellDefaultPeriod}分）`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={5}
              max={300}
              step={5}
              value={cellCustomDuration}
              onChange={(e) =>
                setCellCustomDuration(Math.max(5, parseInt(e.target.value, 10) || 5))
              }
              className="w-16 rounded border border-blue-300 bg-white px-2 py-1 font-mono text-xs text-center text-blue-700 font-bold focus:border-blue-500 focus:outline-hidden"
            />
            <span className="text-xs text-slate-500 font-medium">分</span>
            <button
              type="button"
              onClick={() => setCellCustomDuration(cellDefaultPeriod)}
              className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-0.5 cursor-pointer"
              title="表の規定時間に戻す"
            >
              リセット
            </button>
          </div>
        </div>

        {/* 開始時刻 */}
        <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">開始時刻</div>
                <div className="text-[10px] text-slate-500">
                  {cellHasCustomTime
                    ? `個別設定中（表の規定: ${defaultStartTime}）`
                    : `表の設定・自動配置に従う（${defaultStartTime}）`}
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={cellHasCustomTime}
                onChange={(e) => setCellHasCustomTime(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          {cellHasCustomTime && (
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">開始時刻:</span>
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  value={cellCustomStartTime}
                  onChange={(e) => setCellCustomStartTime(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setCellCustomStartTime(defaultStartTime)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  title="表の開始時刻に戻す"
                >
                  リセット
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 関連URL */}
        <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <ExternalLink className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800">関連URL</span>
            </div>
            {cellUrl.trim() && (
              <a
                href={cellUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 hover:underline"
              >
                <span>開く</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
          <input
            type="url"
            value={cellUrl}
            onChange={(e) => setCellUrl(e.target.value)}
            placeholder="https://zoom.us/... や LMS等のURL"
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        {/* タスク後の休憩時間 */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-emerald-50/50 p-2.5">
          <div className="flex items-center gap-1.5">
            <Coffee className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-800">
                タスク後の休憩時間{isLunchAfterThisPeriod ? ' (昼休み)' : ''}
              </div>
              <div className="text-[10px] text-slate-500">
                {isLunchAfterThisPeriod ? '※このコマの後は設定された昼休みです' : '直後に確保する休憩'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={120}
              step={5}
              value={cellBreakMinutes}
              onChange={(e) =>
                setCellBreakMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-center text-slate-800 focus:border-emerald-500 focus:outline-hidden"
            />
            <span className="text-xs text-slate-500 font-medium">分</span>
            {cellBreakMinutes !== tableIntervalMinutes && (
              <button
                type="button"
                onClick={() => setCellBreakMinutes(tableIntervalMinutes)}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
                title={`表の規定${isLunchAfterThisPeriod ? '昼休み' : '休憩'}時間に戻す`}
              >
                規定({isLunchAfterThisPeriod ? '昼休み' : ''}{tableIntervalMinutes}分)
              </button>
            )}
          </div>
        </div>

        {/* 付随タスク設定 */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={cellAttachedEnabled}
              onChange={(e) => setCellAttachedEnabled(e.target.checked)}
              className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-800">
              このコマに付随タスクを連動生成する
            </span>
          </label>
          {cellAttachedEnabled && (
            <div className="mt-2 flex flex-col gap-2 pl-5.5">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-500 shrink-0">所要時間:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    step={5}
                    value={cellAttachedDuration}
                    onChange={(e) =>
                      setCellAttachedDuration(Math.max(1, parseInt(e.target.value, 10) || 15))
                    }
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-center text-slate-800 focus:border-blue-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-medium">分</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <label className="text-[10px] text-slate-500 shrink-0">分割回数:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={cellAttachedAllowSplit ? cellAttachedSplitCount : 1}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      if (val === 1) {
                        setCellAttachedAllowSplit(false);
                        setCellAttachedSplitCount(1);
                      } else {
                        setCellAttachedAllowSplit(true);
                        setCellAttachedSplitCount(val);
                      }
                    }}
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-center text-slate-800 focus:border-blue-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-medium">回</span>
                  {cellAttachedAllowSplit && cellAttachedSplitCount > 1 && (
                    <span className="text-[9px] text-indigo-700 font-mono font-bold bg-indigo-50 px-1 py-0.5 rounded ml-0.5">
                      {Math.floor(cellAttachedDuration / cellAttachedSplitCount)}分×{cellAttachedSplitCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3.5 flex justify-end gap-2 border-t border-slate-100 pt-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            閉じる
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs transition cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
