'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  Shield,
  CalendarDays,
} from 'lucide-react';
import { ImportedTableData } from '@/types';
import {
  createDailyRoutineTable,
  createWeeklyTaskTable,
  createFixedSlotTable,
  DailyRoutineTemplateInput,
} from '@/lib/templates/tableTemplates';
import { NumberStepper } from './NumberStepper';
import { timeStringToMinutes, minutesToTimeString } from '@/lib/timeUtils';

export interface WizardTaskItem {
  id: string;
  title: string;
  durationMinutes: number;
  startTime: string; // 例: "07:00"、空文字なら未指定
}

interface TableTemplateWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTable: (table: ImportedTableData) => void;
  targetTable?: ImportedTableData | null;
}

type TemplateCategory = 'daily' | 'weekly' | 'fixed';
type DailyMode = 'single' | 'weekday_rotation' | 'cycle_rotation';
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

export function TableTemplateWizardModal({
  isOpen,
  onClose,
  onApplyTable,
  targetTable,
}: TableTemplateWizardModalProps) {
  const [category, setCategory] = useState<TemplateCategory>('daily');

  // ==========================================
  // 日課（Daily）ステート
  // ==========================================
  const [dailyName, setDailyName] = useState(targetTable ? targetTable.name : '日課ルーティン');
  const [dailyMode, setDailyMode] = useState<DailyMode>('single');

  // targetTable の切り替えに連動
  React.useEffect(() => {
    if (targetTable) {
      setDailyName(targetTable.name);
      setWeeklyTitle(targetTable.name);
      setFixedTitle(targetTable.name);

      // 既存の表セルからタスク情報を読み取って multiTasks に初期反映
      if (targetTable.cells && targetTable.cells.length > 0) {
        const loadedTasks: WizardTaskItem[] = [];
        targetTable.cells.forEach((row, rIdx) => {
          const activeCell = row.find((c) => c && c.text);
          if (activeCell) {
            loadedTasks.push({
              id: `row-${rIdx}-${Date.now()}`,
              title: activeCell.title || activeCell.text || '',
              durationMinutes: activeCell.customDurationMinutes || targetTable.axisConfig.periodMinutes || 30,
              startTime: activeCell.customStartTime || '',
            });
          }
        });
        if (loadedTasks.length > 0) {
          setMultiTasks(loadedTasks);
        }
      }
    }
  }, [targetTable]);
  // 単一/複数メニュー（マルチタスクリスト）
  const [multiTasks, setMultiTasks] = useState<WizardTaskItem[]>([
    { id: '1', title: 'ストレッチ', durationMinutes: 20, startTime: '' },
  ]);
  const [isSingleEveryday, setIsSingleEveryday] = useState(true); // 毎日実施（1マス最小表）
  const [singleTargetDays, setSingleTargetDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const handleAddTaskItem = () => {
    const last = multiTasks[multiTasks.length - 1];
    let nextStart = '';
    if (last && last.startTime) {
      const startM = timeStringToMinutes(last.startTime);
      const endM = startM + (last.durationMinutes || 15);
      nextStart = minutesToTimeString(endM % 1440);
    }
    setMultiTasks((prev) => [
      ...prev,
      {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        durationMinutes: last ? last.durationMinutes : 15,
        startTime: nextStart,
      },
    ]);
  };

  const handleRemoveTaskItem = (id: string) => {
    if (multiTasks.length <= 1) return;
    setMultiTasks((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateTaskItem = (id: string, updates: Partial<WizardTaskItem>) => {
    setMultiTasks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };
  // 曜日別ローテーション
  const [weekdayRotationDays, setWeekdayRotationDays] = useState<
    Record<number, { title: string; durationMinutes: number }>
  >({
    0: { title: '英単語', durationMinutes: 20 },
    1: { title: '英文法', durationMinutes: 30 },
    2: { title: 'リスニング', durationMinutes: 25 },
    3: { title: '長文読解', durationMinutes: 40 },
    4: { title: '過去問演習', durationMinutes: 45 },
    5: { title: '読書', durationMinutes: 30 },
    6: { title: '週間振り返り', durationMinutes: 30 },
  });
  // サイクルローテーション（項目未入力のDayは自動的にオフ・休みとして扱われます）
  const [cycleItems, setCycleItems] = useState<Array<{ title: string; durationMinutes: number }>>([
    { title: '胸・三頭筋', durationMinutes: 45 },
    { title: '背中・二頭筋', durationMinutes: 45 },
    { title: '脚・腹筋', durationMinutes: 45 },
    { title: '', durationMinutes: 0 }, // 空欄＝オフ
  ]);
  const [cycleStartDay, setCycleStartDay] = useState(0); // 月曜起算
  // 日課共通
  const [dailyRepeatCount, setDailyRepeatCount] = useState<number | 'auto'>(1);
  const [dailyTimePreset, setDailyTimePreset] = useState<DailyTimePreset>('all');
  const [dailyStartTime, setDailyStartTime] = useState<string>('');
  const [dailyEndTime, setDailyEndTime] = useState<string>('');

  // ==========================================
  // 週次タスク（Weekly）ステート
  // ==========================================
  const [weeklyTitle, setWeeklyTitle] = useState('レポート課題');
  const [weeklyDuration, setWeeklyDuration] = useState(90);
  const [weeklyTargetCount, setWeeklyTargetCount] = useState<number>(3);
  const [weeklyExpiryWeeks, setWeeklyExpiryWeeks] = useState<WeeklyExpiryWeeks>(1);
  const [weeklyHasConstraint, setWeeklyHasConstraint] = useState<boolean>(false); // 開始日時の指定有無
  const [weeklyStartDay, setWeeklyStartDay] = useState<number>(2); // 水曜 (0:月〜6:日)
  const [weeklyScheduleAfterTime, setWeeklyScheduleAfterTime] = useState<string>('14:30');
  const [weeklyPreferredMode, setWeeklyPreferredMode] = useState<'auto' | 'custom'>('auto');
  const [weeklyPreferredDays, setWeeklyPreferredDays] = useState<number[]>([0, 1, 2, 3, 4]);

  // ==========================================
  // 固定枠（Fixed）ステート
  // ==========================================
  const [fixedTitle, setFixedTitle] = useState('睡眠');
  const [fixedStartTime, setFixedStartTime] = useState('00:00');
  const [fixedEndTime, setFixedEndTime] = useState('08:00');
  const [fixedTargetDays, setFixedTargetDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  if (!isOpen) return null;

  // 曜日トグルハンドラ
  const toggleSingleWeekday = (day: number) => {
    setSingleTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const toggleFixedWeekday = (day: number) => {
    setFixedTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const toggleWeeklyWeekday = (day: number) => {
    setWeeklyPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  // 生成処理
  const handleGenerate = () => {
    if (category === 'daily') {
      let finalStartTime: string | null = null;
      let finalEndTime: string | null = null;

      if (dailyTimePreset === 'morning') {
        finalStartTime = '06:00';
        finalEndTime = '12:00';
      } else if (dailyTimePreset === 'afternoon') {
        finalStartTime = '12:00';
        finalEndTime = '18:00';
      } else if (dailyTimePreset === 'evening') {
        finalStartTime = '18:00';
        finalEndTime = '23:00';
      } else if (dailyTimePreset === 'custom') {
        finalStartTime = dailyStartTime.trim() || null;
        finalEndTime = dailyEndTime.trim() || null;
      }

      const input: DailyRoutineTemplateInput = {
        name: dailyName || '日課ルーティン',
        mode: dailyMode,
        dailyRepeatCount,
        timeRange: {
          startTime: finalStartTime,
          endTime: finalEndTime,
        },
      };

      if (dailyMode === 'single') {
        const first = multiTasks[0];
        input.singleTask = {
          title: first?.title?.trim() || '日課',
          durationMinutes: first?.durationMinutes && first.durationMinutes > 0 ? first.durationMinutes : 30,
          startTime: first?.startTime?.trim() || undefined,
          isEveryday: isSingleEveryday,
          targetDays: !isSingleEveryday && singleTargetDays.length > 0 ? singleTargetDays : undefined,
        };
        input.multiTasks = {
          items: multiTasks.map((t) => ({
            title: t.title.trim() || '日課',
            durationMinutes: t.durationMinutes > 0 ? t.durationMinutes : 15,
            startTime: t.startTime.trim() || undefined,
          })),
          isEveryday: isSingleEveryday,
          targetDays: !isSingleEveryday && singleTargetDays.length > 0 ? singleTargetDays : undefined,
        };
      } else if (dailyMode === 'weekday_rotation') {
        input.weekdayRotation = {
          defaultDurationMinutes: 30,
          days: weekdayRotationDays,
        };
      } else if (dailyMode === 'cycle_rotation') {
        input.cycleRotation = {
          cycleLength: cycleItems.length,
          items: cycleItems.map((item) => (item.durationMinutes > 0 ? item : null)),
          cycleStartDay,
          defaultDurationMinutes: 30,
        };
      }

      const table = createDailyRoutineTable(input);
      const finalTable: ImportedTableData = targetTable
        ? {
            ...table,
            id: targetTable.id,
            colorIndex: targetTable.colorIndex,
            customColor: targetTable.customColor,
            createdAt: targetTable.createdAt,
            updatedAt: new Date().toISOString(),
          }
        : table;
      onApplyTable(finalTable);
    } else if (category === 'weekly') {
      const table = createWeeklyTaskTable({
        title: weeklyTitle || '週タスク',
        durationMinutes: weeklyDuration,
        weeklyTargetCount,
        expiryWeeks: weeklyExpiryWeeks,
        startConstraint: weeklyHasConstraint
          ? {
              enabled: true,
              startDay: weeklyStartDay,
              scheduleAfterTime: weeklyScheduleAfterTime,
            }
          : undefined,
        preferredDays:
          !weeklyHasConstraint && weeklyPreferredMode === 'custom'
            ? weeklyPreferredDays
            : undefined,
      });
      const finalTable: ImportedTableData = targetTable
        ? {
            ...table,
            id: targetTable.id,
            colorIndex: targetTable.colorIndex,
            customColor: targetTable.customColor,
            createdAt: targetTable.createdAt,
            updatedAt: new Date().toISOString(),
          }
        : table;
      onApplyTable(finalTable);
    } else if (category === 'fixed') {
      const table = createFixedSlotTable({
        title: fixedTitle || '固定枠',
        startTime: fixedStartTime || '00:00',
        endTime: fixedEndTime || '08:00',
        targetDays: fixedTargetDays.length > 0 ? fixedTargetDays : [0, 1, 2, 3, 4, 5, 6],
      });
      const finalTable: ImportedTableData = targetTable
        ? {
            ...table,
            id: targetTable.id,
            colorIndex: targetTable.colorIndex,
            customColor: targetTable.customColor,
            createdAt: targetTable.createdAt,
            updatedAt: new Date().toISOString(),
          }
        : table;
      onApplyTable(finalTable);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-linear-to-r from-blue-50 to-indigo-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  {targetTable ? `「${targetTable.name}」をテンプレートから設定` : 'テンプレートから設定'}
                </h2>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  Plan22
                </span>
              </div>
              <p className="text-xs text-slate-500">
                目的を選ぶだけで、最適な設定・セル構造を素早く反映できます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* タスク種別タブ切り替え */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50/70 p-2 gap-2 text-center text-xs font-bold">
          <button
            type="button"
            onClick={() => setCategory('daily')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition shadow-2xs ${
              category === 'daily'
                ? 'bg-white text-blue-700 border border-blue-200 ring-2 ring-blue-500/10 font-black'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <RotateCcw className="h-4 w-4 text-blue-600" />
            <span>🏃 日課（ルーティン）</span>
          </button>

          <button
            type="button"
            onClick={() => setCategory('weekly')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition shadow-2xs ${
              category === 'weekly'
                ? 'bg-white text-emerald-700 border border-emerald-200 ring-2 ring-emerald-500/10 font-black'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            <span>📅 週次タスク（目標）</span>
          </button>

          <button
            type="button"
            onClick={() => setCategory('fixed')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition shadow-2xs ${
              category === 'fixed'
                ? 'bg-white text-purple-700 border border-purple-200 ring-2 ring-purple-500/10 font-black'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Shield className="h-4 w-4 text-purple-600" />
            <span>📌 固定枠（生活リズム）</span>
          </button>
        </div>

        {/* フォーム入力本体 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================
              1. 日課（Daily）設定
             ======================================================== */}
          {category === 'daily' && (
            <div className="space-y-5">
              {/* 表の表示名 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">表のタイトル</label>
                <input
                  type="text"
                  value={dailyName}
                  onChange={(e) => setDailyName(e.target.value)}
                  placeholder="例: 朝の筋トレルーティン、英語学習"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              {/* メニュー構成の選択（単一メニュー ⇄ ローテーション） */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">メニューの構成</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDailyMode('single')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition text-left ${
                      dailyMode === 'single'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-800 ring-2 ring-blue-500/10'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Check className={`h-4 w-4 ${dailyMode === 'single' ? 'text-blue-600' : 'opacity-0'}`} />
                    <div>
                      <div className="font-bold">● 単一メニュー</div>
                      <div className="text-[10px] text-slate-500 font-normal">毎日同じ内容（例: 読書20分）</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDailyMode(dailyMode === 'single' ? 'cycle_rotation' : dailyMode)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition text-left ${
                      dailyMode !== 'single'
                        ? 'border-indigo-500 bg-indigo-50/70 text-indigo-800 ring-2 ring-indigo-500/10'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Check className={`h-4 w-4 ${dailyMode !== 'single' ? 'text-indigo-600' : 'opacity-0'}`} />
                    <div>
                      <div className="font-bold">🔄 ローテーション</div>
                      <div className="text-[10px] text-slate-500 font-normal">日替わり・サイクル巡回</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* A. 固定・日課メニュー（複数項目一括設定） */}
              {dailyMode === 'single' && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700">
                        📋 設定する項目一覧（{multiTasks.length}件）
                      </label>
                      <button
                        type="button"
                        onClick={handleAddTaskItem}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-300 bg-white text-[11px] font-bold text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition shadow-2xs active:scale-95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>項目を追加</span>
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      {multiTasks.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl border border-blue-200/70 bg-white shadow-2xs"
                        >
                          {/* 上段（モバイル）/ 左側（デスクトップ）: 番号とタイトル、削除 */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-400 w-5 shrink-0 text-center">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleUpdateTaskItem(item.id, { title: e.target.value })}
                              placeholder={`例: ${idx === 0 ? 'ストレッチ' : idx === 1 ? '読書' : 'タスク名'}`}
                              className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                            />
                            {/* モバイル用削除ボタン */}
                            <button
                              type="button"
                              onClick={() => handleRemoveTaskItem(item.id)}
                              disabled={multiTasks.length <= 1}
                              aria-label="削除"
                              className="sm:hidden p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* 下段（モバイル）/ 右側（デスクトップ）: 所要時間ステッパー と 開始時刻 */}
                          <div className="flex items-center justify-between sm:justify-start gap-2 pl-7 sm:pl-0 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <NumberStepper
                                value={item.durationMinutes}
                                onChange={(val) => handleUpdateTaskItem(item.id, { durationMinutes: val })}
                                min={5}
                                max={720}
                                step={5}
                                unit="分"
                                ariaLabel={`項目${idx + 1}の所要時間`}
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <input
                                type="time"
                                value={item.startTime}
                                onChange={(e) => handleUpdateTaskItem(item.id, { startTime: e.target.value })}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-bold text-slate-700 focus:border-blue-500 focus:outline-hidden"
                                title="開始時刻（任意。空欄の場合は自動配置）"
                              />
                            </div>

                            {/* デスクトップ用削除ボタン */}
                            <button
                              type="button"
                              onClick={() => handleRemoveTaskItem(item.id)}
                              disabled={multiTasks.length <= 1}
                              aria-label="削除"
                              className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={handleAddTaskItem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-blue-400 bg-blue-50/60 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-500 transition active:scale-95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>項目を追加</span>
                      </button>
                      <span className="text-[10px] text-slate-400">
                        ※ 各項目の開始時刻に応じて時系列順に自動整列されます
                      </span>
                    </div>
                  </div>

                  {/* 曜日指定オプション（Day 1のみで毎日配置、曜日指定時のみ7列展開） */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-600">配置スケジュール</label>
                      <button
                        type="button"
                        onClick={() => setIsSingleEveryday(!isSingleEveryday)}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        {isSingleEveryday ? '+ 特定の曜日のみに限定する' : '毎日（Day 1のみ）に戻す'}
                      </button>
                    </div>

                    {isSingleEveryday ? (
                      <div className="rounded-lg bg-blue-50/70 p-2.5 text-[11px] text-blue-800 border border-blue-100 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>Day 1 のみの1列表を作成し、毎日全曜日に自動配置します。</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">実施する曜日を選択:</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSingleTargetDays([0, 1, 2, 3, 4])}
                              className="text-[10px] font-bold text-blue-600 hover:underline"
                            >
                              平日のみ
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setSingleTargetDays([5, 6])}
                              className="text-[10px] font-bold text-blue-600 hover:underline"
                            >
                              週末のみ
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setSingleTargetDays([0, 1, 2, 3, 4, 5, 6])}
                              className="text-[10px] font-bold text-blue-600 hover:underline"
                            >
                              全選択
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {WEEKDAYS.map((w) => {
                            const active = singleTargetDays.includes(w.dayIndex);
                            return (
                              <button
                                key={w.dayIndex}
                                type="button"
                                onClick={() => toggleSingleWeekday(w.dayIndex)}
                                className={`rounded-lg border py-2 text-xs font-bold transition ${
                                  active
                                    ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {w.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* B. ローテーションの場合 */}
              {dailyMode !== 'single' && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
                  {/* ローテーション方式の選択 */}
                  <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
                    <span className="text-xs font-bold text-indigo-900">ローテーション方式:</span>
                    <button
                      type="button"
                      onClick={() => setDailyMode('cycle_rotation')}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        dailyMode === 'cycle_rotation'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      🔁 N日サイクル（Day 1, 2, 3...）
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyMode('weekday_rotation')}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        dailyMode === 'weekday_rotation'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      📅 曜日別固定（月〜日）
                    </button>
                  </div>

                  {/* N日サイクル巡回の場合 */}
                  {dailyMode === 'cycle_rotation' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">サイクルメニューリスト:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px]">周期の開始曜日:</span>
                          <select
                            value={cycleStartDay}
                            onChange={(e) => setCycleStartDay(Number(e.target.value))}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-800"
                          >
                            {WEEKDAYS.map((w) => (
                              <option key={w.dayIndex} value={w.dayIndex}>
                                {w.label}曜起算
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {cycleItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="w-14 text-xs font-bold text-indigo-700 shrink-0">
                              Day {idx + 1}:
                            </span>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const newItems = [...cycleItems];
                                newItems[idx].title = e.target.value;
                                setCycleItems(newItems);
                              }}
                              placeholder="未入力でオフ（休息）"
                              className="flex-1 rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={0}
                                step={5}
                                value={item.durationMinutes}
                                onChange={(e) => {
                                  const newItems = [...cycleItems];
                                  newItems[idx].durationMinutes = Number(e.target.value);
                                  setCycleItems(newItems);
                                }}
                                className="w-14 rounded border border-slate-200 px-1 py-1 text-xs text-center font-bold"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">分</span>
                            </div>
                            {cycleItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setCycleItems(cycleItems.filter((_, i) => i !== idx))}
                                className="p-1 text-slate-400 hover:text-red-500 transition"
                                title="この日を削除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {cycleItems.length === 1 && (
                        <div className="rounded-lg bg-indigo-50 p-2 text-[11px] text-indigo-700">
                          💡 Day 1 のみ設定されているため、毎日巡回（毎日実施）として配置されます。
                        </div>
                      )}

                      {cycleItems.length < 7 && (
                        <button
                          type="button"
                          onClick={() => setCycleItems([...cycleItems, { title: '新しいメニュー', durationMinutes: 30 }])}
                          className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>日数を追加 (Day {cycleItems.length + 1})</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* 曜日別固定の場合 */}
                  {dailyMode === 'weekday_rotation' && (
                    <div className="space-y-2">
                      <span className="block text-xs font-bold text-slate-700">各曜日のメニュー設定:</span>
                      {WEEKDAYS.map((w) => {
                        const item = weekdayRotationDays[w.dayIndex] || { title: '', durationMinutes: 30 };
                        return (
                          <div key={w.dayIndex} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="w-10 text-xs font-bold text-slate-700 shrink-0">
                              {w.label}曜:
                            </span>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                setWeekdayRotationDays({
                                  ...weekdayRotationDays,
                                  [w.dayIndex]: { ...item, title: e.target.value },
                                });
                              }}
                              placeholder="未入力で休み"
                              className="flex-1 rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={5}
                                step={5}
                                value={item.durationMinutes}
                                onChange={(e) => {
                                  setWeekdayRotationDays({
                                    ...weekdayRotationDays,
                                    [w.dayIndex]: { ...item, durationMinutes: Number(e.target.value) },
                                  });
                                }}
                                className="w-14 rounded border border-slate-200 px-1 py-1 text-xs text-center font-bold"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">分</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 1日の実施回数（ステッパー式） */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1日の目標回数
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDailyRepeatCount(dailyRepeatCount === 'auto' ? 1 : 'auto')}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                        dailyRepeatCount === 'auto'
                          ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/10'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      自動配分
                    </button>
                    {dailyRepeatCount !== 'auto' && (
                      <NumberStepper
                        value={dailyRepeatCount}
                        onChange={(val) => setDailyRepeatCount(val)}
                        min={1}
                        max={12}
                        step={1}
                        unit="回/日"
                        ariaLabel="1日の目標回数"
                      />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <span className="font-bold text-slate-700">
                      設定:{' '}
                      <span className="text-blue-700 font-bold">
                        {dailyRepeatCount === 'auto' ? '自動配分（空きコマ優先）' : `${dailyRepeatCount}回 / 日`}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400 ml-2">
                      {dailyRepeatCount === 'auto'
                        ? 'スケジュール状況に応じて最適な回数を自動決定します'
                        : `1日の中で最大${dailyRepeatCount}回こなすよう配置されます`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 時間帯の希望設定 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">時間帯の希望</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-2">
                  {[
                    { id: 'all' as const, label: '終日自由' },
                    { id: 'morning' as const, label: '朝 (6〜12時)' },
                    { id: 'afternoon' as const, label: '昼 (12〜18時)' },
                    { id: 'evening' as const, label: '夜 (18〜23時)' },
                    { id: 'custom' as const, label: 'カスタム' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDailyTimePreset(p.id)}
                      className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                        dailyTimePreset === p.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {dailyTimePreset === 'custom' && (
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <input
                      type="time"
                      value={dailyStartTime}
                      onChange={(e) => setDailyStartTime(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold"
                    />
                    <span className="text-slate-400 text-xs">〜</span>
                    <input
                      type="time"
                      value={dailyEndTime}
                      onChange={(e) => setDailyEndTime(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-500">（この時間帯の空き枠に配分）</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              2. 週次タスク（Weekly）設定
             ======================================================== */}
          {category === 'weekly' && (
            <div className="space-y-4">
              {/* 着手可能日時の分岐トグル */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  着手可能日時の指定
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWeeklyHasConstraint(false)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition text-left ${
                      !weeklyHasConstraint
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Check className={`h-4 w-4 ${!weeklyHasConstraint ? 'text-emerald-600' : 'opacity-0'}`} />
                    <div>
                      <div className="font-bold">いつでも着手可能</div>
                      <div className="text-[10px] text-slate-500 font-normal">週初めから自由な空き枠に配置</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWeeklyHasConstraint(true)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition text-left ${
                      weeklyHasConstraint
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Check className={`h-4 w-4 ${weeklyHasConstraint ? 'text-emerald-600' : 'opacity-0'}`} />
                    <div>
                      <div className="font-bold">特定の日時以降に着手</div>
                      <div className="text-[10px] text-slate-500 font-normal">講義・会議の出題後から開始</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* タスク名入力 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">タスク名</label>
                <input
                  type="text"
                  value={weeklyTitle}
                  onChange={(e) => setWeeklyTitle(e.target.value)}
                  placeholder={
                    weeklyHasConstraint
                      ? '例: プログラミング課題レポート、議事録作成'
                      : '例: 部屋の掃除、資格試験の勉強、読書'
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* B. 特定日時以降に着手の場合の「開始日時（出題日時）」設定 */}
              {weeklyHasConstraint && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span>着手可能になる日時（出題日時）</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        開始曜日（講義・イベントのある曜日）
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {WEEKDAYS.map((w) => (
                          <button
                            key={w.dayIndex}
                            type="button"
                            onClick={() => setWeeklyStartDay(w.dayIndex)}
                            className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                              weeklyStartDay === w.dayIndex
                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        開始時刻（終了後・出題時刻）
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={weeklyScheduleAfterTime}
                          onChange={(e) => setWeeklyScheduleAfterTime(e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                        />
                        <span className="text-xs font-bold text-slate-600">以降に着手</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white/80 p-2 text-[11px] text-emerald-800 border border-emerald-100">
                    💡 <strong>{WEEKDAYS[weeklyStartDay].label}曜 {weeklyScheduleAfterTime}</strong> より前の時間帯には配置されず、それ以降の空き枠にやりくり配置されます。
                  </div>
                </div>
              )}

              {/* 所要時間 & 週の目標回数（ステッパー式） */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    1回の所要時間
                  </label>
                  <div className="flex items-center gap-3">
                    <NumberStepper
                      value={weeklyDuration}
                      onChange={(val) => setWeeklyDuration(val)}
                      min={5}
                      max={720}
                      step={5}
                      unit="分"
                      ariaLabel="週タスク所要時間"
                    />
                    <div className="text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700">
                        <span className="font-mono text-sm text-emerald-700">{weeklyDuration}</span> 分 / 回
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    週の目標消化回数
                  </label>
                  <div className="flex items-center gap-3">
                    <NumberStepper
                      value={weeklyTargetCount}
                      onChange={(val) => setWeeklyTargetCount(val)}
                      min={1}
                      max={7}
                      step={1}
                      unit="回/週"
                      ariaLabel="週の目標消化回数"
                    />
                    <div className="text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700">
                        週 <span className="font-mono text-sm text-emerald-700">{weeklyTargetCount}</span> 回
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* A. いつでも着手可能の場合の「配置希望日」設定 */}
              {!weeklyHasConstraint && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">配置希望日</label>
                    <button
                      type="button"
                      onClick={() => setWeeklyPreferredMode(weeklyPreferredMode === 'auto' ? 'custom' : 'auto')}
                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      {weeklyPreferredMode === 'auto' ? '+ 希望する曜日を指定する' : '空き枠におまかせに戻す'}
                    </button>
                  </div>

                  {weeklyPreferredMode === 'auto' ? (
                    <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-200">
                      全曜日（月〜日）の中から空き枠の多い曜日をアルゴリズムが自動探索して配置します。
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">優先して配置したい曜日を選択:</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setWeeklyPreferredDays([0, 1, 2, 3, 4])}
                            className="text-[10px] font-bold text-emerald-600 hover:underline"
                          >
                            平日のみ
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setWeeklyPreferredDays([5, 6])}
                            className="text-[10px] font-bold text-emerald-600 hover:underline"
                          >
                            週末のみ
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setWeeklyPreferredDays([0, 1, 2, 3, 4, 5, 6])}
                            className="text-[10px] font-bold text-emerald-600 hover:underline"
                          >
                            全曜日
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {WEEKDAYS.map((w) => {
                          const active = weeklyPreferredDays.includes(w.dayIndex);
                          return (
                            <button
                              key={w.dayIndex}
                              type="button"
                              onClick={() => toggleWeeklyWeekday(w.dayIndex)}
                              className={`rounded-lg border py-2 text-xs font-bold transition ${
                                active
                                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {w.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 有効期限 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">タスクの有効期限</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 1 as const, label: '今週中 (推奨)' },
                    { id: 2 as const, label: '2週間以内' },
                    { id: 'none' as const, label: '期限なし' },
                  ].map((opt) => (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setWeeklyExpiryWeeks(opt.id)}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        weeklyExpiryWeeks === opt.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50/60 p-3 text-xs text-emerald-900 border border-emerald-100 flex items-start gap-2">
                <Calendar className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  週次タスクは、1週間の空きコマを見つけてアルゴリズムが前倒し・バランス良く自動配置します。
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              3. 固定枠（Fixed）設定
             ======================================================== */}
          {category === 'fixed' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">枠の名前</label>
                <input
                  type="text"
                  value={fixedTitle}
                  onChange={(e) => setFixedTitle(e.target.value)}
                  placeholder="例: 睡眠、アルバイト、部活動、夕食"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-purple-500 focus:outline-hidden focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">開始時刻</label>
                  <input
                    type="time"
                    value={fixedStartTime}
                    onChange={(e) => setFixedStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono font-bold text-slate-800 focus:border-purple-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">終了時刻</label>
                  <input
                    type="time"
                    value={fixedEndTime}
                    onChange={(e) => setFixedEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono font-bold text-slate-800 focus:border-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 実施曜日 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">対象曜日</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFixedTargetDays([0, 1, 2, 3, 4, 5, 6])}
                      className="text-[10px] font-bold text-purple-600 hover:underline"
                    >
                      毎日
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setFixedTargetDays([0, 1, 2, 3, 4])}
                      className="text-[10px] font-bold text-purple-600 hover:underline"
                    >
                      平日のみ
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((w) => {
                    const active = fixedTargetDays.includes(w.dayIndex);
                    return (
                      <button
                        key={w.dayIndex}
                        type="button"
                        onClick={() => toggleFixedWeekday(w.dayIndex)}
                        className={`rounded-lg border py-2 text-xs font-bold transition ${
                          active
                            ? 'border-purple-600 bg-purple-600 text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl bg-purple-50/60 p-3 text-xs text-purple-900 border border-purple-100 flex items-start gap-2">
                <Shield className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  固定枠として登録された時間帯はタイムライン上で保護され、他のタスクが重複して入らないようになります。
                </div>
              </div>
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            <span>{targetTable ? 'この表に設定を適用' : 'この内容で表を作成'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
