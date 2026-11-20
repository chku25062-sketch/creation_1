'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Zap,
  Check,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ImportedTableData, GridCell } from '@/types';
import { getTableClassification } from '@/lib/tableUtils';
import { NumberStepper } from './NumberStepper';
import { timeStringToMinutes } from '@/lib/timeUtils';

interface TableQuickSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: ImportedTableData | null;
  onApplyTable: (updatedTable: ImportedTableData) => void;
}

type DailyTimePreset = 'all' | 'morning' | 'afternoon' | 'evening' | 'custom';
type WeeklyExpiryWeeks = 1 | 2 | 'none';

const WEEKDAYS = [
  { dayIndex: 0, label: '月' },
  { dayIndex: 1, label: '火' },
  { dayIndex: 2, label: '水' },
  { dayIndex: 3, label: '木' },
  { dayIndex: 4, label: '金' },
  { dayIndex: 5, label: '土' },
  { dayIndex: 6, label: '日' },
];

export function TableQuickSettingsModal({
  isOpen,
  onClose,
  table,
  onApplyTable,
}: TableQuickSettingsModalProps) {
  if (!isOpen || !table) return null;

  const classification = getTableClassification(table);

  // 表名
  const [tableName, setTableName] = useState(table.name || '');

  // ==========================================
  // 日課（daily_task）ステート
  // ==========================================
  const [dailyTimePreset, setDailyTimePreset] = useState<DailyTimePreset>('all');
  const [dailyStartTime, setDailyStartTime] = useState<string>('');
  const [dailyEndTime, setDailyEndTime] = useState<string>('');
  const [dailyRepeatCount, setDailyRepeatCount] = useState<number | 'auto'>(1);
  const [dailyDaysCount, setDailyDaysCount] = useState<number>(table.numCols || 1);
  const [dailyRepeatStartDay, setDailyRepeatStartDay] = useState<number>(0);
  const [dailyTaskDurations, setDailyTaskDurations] = useState<Record<string, number>>({});

  // ==========================================
  // 週次タスク（weekly_task）ステート
  // ==========================================
  const [weeklyTargetCount, setWeeklyTargetCount] = useState<number | 'auto'>(1);
  const [weeklyExpiryWeeks, setWeeklyExpiryWeeks] = useState<WeeklyExpiryWeeks>('none');
  const [preferredDaysPreset, setPreferredDaysPreset] = useState<'all' | 'weekdays' | 'weekends' | 'custom'>('all');
  const [weeklyTaskCounts, setWeeklyTaskCounts] = useState<Record<string, number>>({});
  const [weeklyTaskDurations, setWeeklyTaskDurations] = useState<Record<string, number>>({});

  // ==========================================
  // 固定枠（fixed_slot）ステート
  // ==========================================
  const [fixedStartTime, setFixedStartTime] = useState<string>('09:00');
  const [fixedEndTime, setFixedEndTime] = useState<string>('18:00');
  const [fixedDays, setFixedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [fixedDaysCount, setFixedDaysCount] = useState<number>(table.numCols || 7);
  const [fixedRepeatStartDay, setFixedRepeatStartDay] = useState<number>(0);

  // 詳細設定アコーディオン
  const [showAdvanced, setShowAdvanced] = useState(false);

  // セルからタイトル取得のヘルパー
  const getCellTitle = (cell: GridCell | null | undefined): string => {
    if (!cell) return '';
    return (cell.title || cell.text || '').trim();
  };

  // 一意なタスクリスト抽出
  const uniqueTaskNames = useMemo(() => {
    if (!table || !table.cells) return [];
    const set = new Set<string>();
    table.cells.forEach(row => {
      row?.forEach(cell => {
        const title = getCellTitle(cell);
        if (title !== '') {
          set.add(title);
        }
      });
    });
    return Array.from(set);
  }, [table]);

  // 初期値の読み込み
  useEffect(() => {
    if (!table) return;
    setTableName(table.name || '');

    // 1. 活動時間帯の判定
    const sTime = table.axisConfig?.startTime;
    const eTime = table.axisConfig?.endTime;
    const hasValidStart = sTime && sTime !== 'unset' && sTime !== '未設定' && sTime !== '自動' && sTime !== 'auto';
    const hasValidEnd = eTime && eTime !== 'unset' && eTime !== '未設定' && eTime !== '自動' && eTime !== 'auto';

    if (hasValidStart && hasValidEnd) {
      setDailyStartTime(sTime);
      setDailyEndTime(eTime);
      setFixedStartTime(sTime);
      setFixedEndTime(eTime);

      if (sTime === '06:00' && eTime === '12:00') setDailyTimePreset('morning');
      else if (sTime === '12:00' && eTime === '18:00') setDailyTimePreset('afternoon');
      else if (sTime === '18:00' && eTime === '23:00') setDailyTimePreset('evening');
      else setDailyTimePreset('custom');
    } else {
      setDailyTimePreset('all');
      setDailyStartTime('');
      setDailyEndTime('');
    }

    // 2. 回数・目標設定
    if (table.dailyRepeatCount !== undefined) {
      setDailyRepeatCount(table.dailyRepeatCount);
    } else {
      setDailyRepeatCount(1);
    }

    if (table.weeklyRepeatCount !== undefined) {
      setWeeklyTargetCount(table.weeklyRepeatCount);
    } else {
      setWeeklyTargetCount(1);
    }

    // 3. 各タスクの所要時間・週目標回数の抽出
    const durationMap: Record<string, number> = {};
    const countMap: Record<string, number> = {};
    table.cells?.forEach(row => {
      row?.forEach(cell => {
        const title = getCellTitle(cell);
        if (title !== '') {
          const dur =
            cell.customDurationMinutes ||
            (cell.endMinutes && cell.startMinutes ? cell.endMinutes - cell.startMinutes : null) ||
            table.axisConfig?.periodMinutes ||
            30;
          if (!durationMap[title]) {
            durationMap[title] = dur;
          }
          if (cell.targetWeeklyCount && !countMap[title]) {
            countMap[title] = cell.targetWeeklyCount;
          }
        }
      });
    });
    setDailyTaskDurations(durationMap);
    setWeeklyTaskDurations(durationMap);
    setWeeklyTaskCounts(countMap);

    // 4. 周期設定
    setDailyDaysCount(table.numCols || 1);
    setFixedDaysCount(table.numCols || 7);

    // 5. 曜日判定
    if (table.colHeaders && table.colHeaders.length > 0) {
      const activeIndices: number[] = [];
      table.colHeaders.forEach((header: string, idx: number) => {
        const found = WEEKDAYS.findIndex(w => header.includes(w.label));
        if (found !== -1) {
          activeIndices.push(found);
        } else if (idx < 7) {
          activeIndices.push(idx);
        }
      });
      if (activeIndices.length > 0) {
        setFixedDays(activeIndices);
      }
    }
  }, [table]);

  // 日課時間プリセット変更
  const handleDailyPresetChange = (preset: DailyTimePreset) => {
    setDailyTimePreset(preset);
    if (preset === 'all') {
      setDailyStartTime('');
      setDailyEndTime('');
    } else if (preset === 'morning') {
      setDailyStartTime('06:00');
      setDailyEndTime('12:00');
    } else if (preset === 'afternoon') {
      setDailyStartTime('12:00');
      setDailyEndTime('18:00');
    } else if (preset === 'evening') {
      setDailyStartTime('18:00');
      setDailyEndTime('23:00');
    }
  };

  // 日またぎ判定
  const isFixedOvernight = useMemo(() => {
    if (!fixedStartTime || !fixedEndTime) return false;
    const s = timeStringToMinutes(fixedStartTime);
    const e = timeStringToMinutes(fixedEndTime);
    return e < s;
  }, [fixedStartTime, fixedEndTime]);

  // 保存・反映ハンドラ
  const handleApply = () => {
    if (!table) return;

    // テーブルのディープコピーを作成
    const updated: ImportedTableData = JSON.parse(JSON.stringify(table));
    updated.name = tableName.trim() || updated.name;

    if (classification === 'daily_task') {
      // 日課の反映
      updated.dailyRepeatCount = dailyRepeatCount;
      if (dailyTimePreset === 'all') {
        updated.axisConfig.startTime = null;
        updated.axisConfig.endTime = null;
      } else {
        updated.axisConfig.startTime = dailyStartTime || null;
        updated.axisConfig.endTime = dailyEndTime || null;
      }

      // セルの所要時間を更新
      if (updated.cells) {
        updated.cells = updated.cells.map(row =>
          row.map(cell => {
            if (!cell) return cell;
            const title = getCellTitle(cell);
            if (!title) return cell;
            const dur = dailyTaskDurations[title];
            if (dur !== undefined) {
              return {
                ...cell,
                customDurationMinutes: dur,
                hasCustomTime: true,
                endMinutes: cell.startMinutes ? cell.startMinutes + dur : cell.endMinutes,
              };
            }
            return cell;
          })
        );
      }
    } else if (classification === 'weekly_task') {
      // 週次タスクの反映
      updated.weeklyRepeatCount = weeklyTargetCount;

      // セルの週目標回数・所要時間を更新
      if (updated.cells) {
        updated.cells = updated.cells.map(row =>
          row.map(cell => {
            if (!cell) return cell;
            const title = getCellTitle(cell);
            if (!title) return cell;
            const count = weeklyTaskCounts[title];
            const dur = weeklyTaskDurations[title];
            const newCell: GridCell = { ...cell };
            if (count !== undefined) {
              newCell.targetWeeklyCount = count;
            }
            if (dur !== undefined) {
              newCell.customDurationMinutes = dur;
              newCell.hasCustomTime = true;
              if (newCell.startMinutes) {
                newCell.endMinutes = newCell.startMinutes + dur;
              }
            }
            return newCell;
          })
        );
      }
    } else if (classification === 'fixed_slot') {
      // 固定枠の反映
      updated.axisConfig.startTime = fixedStartTime;
      updated.axisConfig.endTime = fixedEndTime;
      // 時間差分から所要時間を再計算
      const sMin = timeStringToMinutes(fixedStartTime);
      let eMin = timeStringToMinutes(fixedEndTime);
      if (eMin < sMin) eMin += 24 * 60; // 翌日
      const diff = Math.max(1, eMin - sMin);

      if (updated.cells) {
        updated.cells = updated.cells.map(row =>
          row.map(cell => {
            if (!cell) return cell;
            const title = getCellTitle(cell);
            if (!title) return cell;
            return {
              ...cell,
              startMinutes: sMin,
              endMinutes: sMin + diff,
              customStartTime: fixedStartTime,
              customDurationMinutes: diff,
              hasCustomTime: true,
            };
          })
        );
      }
    }

    onApplyTable(updated);
    onClose();
  };

  // 分類別バッジ
  const classificationBadge = () => {
    switch (classification) {
      case 'daily_task':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            🏃 日課ルーティン
          </span>
        );
      case 'weekly_task':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            🎯 週次タスク
          </span>
        );
      case 'fixed_slot':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            📌 固定枠の予定
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">⚡ クイック設定</h3>
                {classificationBadge()}
              </div>
              <p className="text-[11px] text-slate-500">開いている表の設定をすばやく調整・反映します</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* スクロール本体 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700">
          {/* 1. 表の名前 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">表の表示名</label>
            <input
              type="text"
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              placeholder="例: 朝ルーティン、今週の課題、勤務シフト"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* ========================================================
              日課表（daily_task）向け設定項目
              ======================================================== */}
          {classification === 'daily_task' && (
            <div className="space-y-4">
              {/* 活動時間帯 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">活動する時間帯</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDailyPresetChange('all')}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      dailyTimePreset === 'all'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    終日（空き枠）
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDailyPresetChange('morning')}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      dailyTimePreset === 'morning'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    朝 (06:00-12:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDailyPresetChange('afternoon')}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      dailyTimePreset === 'afternoon'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    昼 (12:00-18:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDailyPresetChange('evening')}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      dailyTimePreset === 'evening'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    夜 (18:00-23:00)
                  </button>
                </div>

                {dailyTimePreset === 'custom' || dailyTimePreset !== 'all' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">カスタム時間:</span>
                    <input
                      type="time"
                      value={dailyStartTime}
                      onChange={e => {
                        setDailyStartTime(e.target.value);
                        setDailyTimePreset('custom');
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <span>〜</span>
                    <input
                      type="time"
                      value={dailyEndTime}
                      onChange={e => {
                        setDailyEndTime(e.target.value);
                        setDailyTimePreset('custom');
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </div>
                ) : null}
              </div>

              {/* 1日の実施回数 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">1日の実施回数</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDailyRepeatCount(1)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      dailyRepeatCount === 1
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    1日 1 回 (基本)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyRepeatCount('auto')}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      dailyRepeatCount === 'auto'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    空きコマに自動配分
                  </button>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] text-slate-500">指定:</span>
                    <NumberStepper
                      value={typeof dailyRepeatCount === 'number' ? dailyRepeatCount : 1}
                      onChange={val => setDailyRepeatCount(val)}
                      min={1}
                      max={10}
                      step={1}
                      unit="回/日"
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* タスク一覧と所要時間微調整 */}
              {uniqueTaskNames.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-slate-700">
                    登録タスクの所要時間（分）
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                    {uniqueTaskNames.map(taskName => (
                      <div
                        key={taskName}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 border border-slate-200/80 shadow-2xs"
                      >
                        <span className="font-semibold text-xs text-slate-800 truncate">{taskName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <NumberStepper
                            value={dailyTaskDurations[taskName] || 30}
                            onChange={val =>
                              setDailyTaskDurations(prev => ({ ...prev, [taskName]: val }))
                            }
                            min={5}
                            max={360}
                            step={5}
                            unit="分"
                            size="sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              週次タスク表（weekly_task）向け設定項目
              ======================================================== */}
          {classification === 'weekly_task' && (
            <div className="space-y-4">
              {/* 各タスクの週目標回数 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  タスクごとの週目標回数 ＆ 所要時間
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
                  {uniqueTaskNames.length === 0 ? (
                    <p className="text-center text-[11px] text-slate-400 py-2">タスクがありません</p>
                  ) : (
                    uniqueTaskNames.map(taskName => (
                      <div
                        key={taskName}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-white p-2.5 border border-slate-200/80 shadow-2xs"
                      >
                        <span className="font-semibold text-xs text-slate-800 truncate">{taskName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">週:</span>
                            <NumberStepper
                              value={weeklyTaskCounts[taskName] || 1}
                              onChange={val =>
                                setWeeklyTaskCounts(prev => ({ ...prev, [taskName]: val }))
                              }
                              min={1}
                              max={7}
                              step={1}
                              unit="回"
                              size="sm"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">時間:</span>
                            <NumberStepper
                              value={weeklyTaskDurations[taskName] || 45}
                              onChange={val =>
                                setWeeklyTaskDurations(prev => ({ ...prev, [taskName]: val }))
                              }
                              min={5}
                              max={360}
                              step={5}
                              unit="分"
                              size="sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 配置希望曜日 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">配置希望曜日</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferredDaysPreset('all')}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      preferredDaysPreset === 'all'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    いつでも（全日）
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredDaysPreset('weekdays')}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      preferredDaysPreset === 'weekdays'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    平日のみ (月〜金)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredDaysPreset('weekends')}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      preferredDaysPreset === 'weekends'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    週末のみ (土日)
                  </button>
                </div>
              </div>

              {/* 有効期限 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">タスクの有効期限</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setWeeklyExpiryWeeks('none')}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition cursor-pointer ${
                      weeklyExpiryWeeks === 'none'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    期限なし（継続）
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeeklyExpiryWeeks(1)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition cursor-pointer ${
                      weeklyExpiryWeeks === 1
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    今週中（当週限り）
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeeklyExpiryWeeks(2)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition cursor-pointer ${
                      weeklyExpiryWeeks === 2
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    2週間以内
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              固定枠表（fixed_slot）向け設定項目
              ======================================================== */}
          {classification === 'fixed_slot' && (
            <div className="space-y-4">
              {/* 時間帯（開始 〜 終了） */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">予定の時間帯</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={fixedStartTime}
                    onChange={e => setFixedStartTime(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
                  />
                  <span className="text-slate-400">〜</span>
                  <input
                    type="time"
                    value={fixedEndTime}
                    onChange={e => setFixedEndTime(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
                  />
                  {isFixedOvernight && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                      翌日終了
                    </span>
                  )}
                </div>
              </div>

              {/* 対象曜日 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">対象曜日</label>
                  <div className="flex gap-2 text-[10px] text-indigo-600">
                    <button
                      type="button"
                      onClick={() => setFixedDays([0, 1, 2, 3, 4, 5, 6])}
                      className="hover:underline cursor-pointer"
                    >
                      全日
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setFixedDays([0, 1, 2, 3, 4])}
                      className="hover:underline cursor-pointer"
                    >
                      平日
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setFixedDays([5, 6])}
                      className="hover:underline cursor-pointer"
                    >
                      週末
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map(w => {
                    const isSelected = fixedDays.includes(w.dayIndex);
                    return (
                      <button
                        key={w.dayIndex}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (fixedDays.length > 1) {
                              setFixedDays(fixedDays.filter(d => d !== w.dayIndex));
                            }
                          } else {
                            setFixedDays([...fixedDays, w.dayIndex].sort());
                          }
                        }}
                        className={`rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 登録タスク名 */}
              {uniqueTaskNames.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
                  <span className="block text-[11px] font-bold text-slate-600 mb-1">
                    対象スロットのタスク
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueTaskNames.map(name => (
                      <span
                        key={name}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 詳細・サイクル設定アコーディオン */}
          <div className="border-t border-slate-200/80 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800 transition py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                高度な設定（サイクル日数・開始曜日）
              </span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">サイクル日数（列数）</span>
                  <NumberStepper
                    value={classification === 'daily_task' ? dailyDaysCount : fixedDaysCount}
                    onChange={val => {
                      if (classification === 'daily_task') setDailyDaysCount(val);
                      else setFixedDaysCount(val);
                    }}
                    min={1}
                    max={14}
                    step={1}
                    unit="日分"
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">何曜日から始まるか</span>
                  <select
                    value={classification === 'daily_task' ? dailyRepeatStartDay : fixedRepeatStartDay}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (classification === 'daily_task') setDailyRepeatStartDay(val);
                      else setFixedRepeatStartDay(val);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                  >
                    {WEEKDAYS.map(w => (
                      <option key={w.dayIndex} value={w.dayIndex}>
                        {w.label}曜日
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-bold text-white shadow-md active:scale-98 transition cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>変更を適用</span>
          </button>
        </div>
      </div>
    </div>
  );
}
