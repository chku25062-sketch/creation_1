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
    }
  }, [targetTable]);
  // 単一メニュー
  const [singleTitle, setSingleTitle] = useState('ストレッチ');
  const [singleDuration, setSingleDuration] = useState(20);
  const [isSingleEveryday, setIsSingleEveryday] = useState(true); // 毎日実施（1マス最小表）
  const [singleTargetDays, setSingleTargetDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
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
  // サイクルローテーション
  const [cycleItems, setCycleItems] = useState<Array<{ title: string; durationMinutes: number }>>([
    { title: '胸・三頭筋', durationMinutes: 45 },
    { title: '背中・二頭筋', durationMinutes: 45 },
    { title: '脚・腹筋', durationMinutes: 45 },
    { title: '休養日（オフ）', durationMinutes: 0 },
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
        input.singleTask = {
          title: singleTitle || '日課',
          durationMinutes: singleDuration > 0 ? singleDuration : 30,
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

              {/* A. 単一メニューの場合 */}
              {dailyMode === 'single' && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">タスク名</label>
                      <input
                        type="text"
                        value={singleTitle}
                        onChange={(e) => setSingleTitle(e.target.value)}
                        placeholder="例: ストレッチ、読書"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">1回の所要時間</label>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          step={5}
                          value={singleDuration || ''}
                          onChange={(e) => setSingleDuration(Math.max(1, parseInt(e.target.value, 10) || 0))}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden"
                        />
                        <span className="text-xs font-bold text-slate-500">分</span>
                        <span className="text-[10px] text-slate-400">（直接入力可能）</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSingleDuration(m)}
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold transition ${
                              singleDuration === m
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {m}分
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 実施頻度・曜日設定（最適化: 毎日なら1マス、指定時のみ7列） */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">実施頻度・曜日</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setIsSingleEveryday(true)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                          isSingleEveryday
                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Check className={`h-3.5 w-3.5 ${isSingleEveryday ? 'text-blue-600' : 'opacity-0'}`} />
                        <span>毎日実施（曜日指定なし・1マス）</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsSingleEveryday(false)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                          !isSingleEveryday
                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Check className={`h-3.5 w-3.5 ${!isSingleEveryday ? 'text-blue-600' : 'opacity-0'}`} />
                        <span>曜日を指定する</span>
                      </button>
                    </div>

                    {isSingleEveryday ? (
                      <div className="rounded-lg bg-blue-50/70 p-2.5 text-[11px] text-blue-800 border border-blue-100 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>7列の不要な枠を省き、1マス（1行×1列）のシンプルな日課表を生成します。</span>
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
                              placeholder="タスク名（空欄でオフ）"
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
                            {cycleItems.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setCycleItems(cycleItems.filter((_, i) => i !== idx))}
                                className="p-1 text-slate-400 hover:text-red-500 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

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

              {/* 1日の実施回数（自由入力 ＋ クイックチップ） */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">1日の目標回数</label>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={dailyRepeatCount === 'auto' ? '' : dailyRepeatCount}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (!val) {
                          setDailyRepeatCount('auto');
                        } else {
                          const n = parseInt(val, 10);
                          setDailyRepeatCount(isNaN(n) || n <= 0 ? 'auto' : n);
                        }
                      }}
                      placeholder="自動"
                      className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden"
                    />
                    <span className="ml-1.5 text-xs font-bold text-slate-500">回</span>
                  </div>
                  <span className="text-[10px] text-slate-400">（直接数値入力可能）</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { val: 1, label: '1回' },
                    { val: 2, label: '2回' },
                    { val: 3, label: '3回' },
                    { val: 4, label: '4回' },
                    { val: 'auto' as const, label: '自動' },
                  ].map((opt) => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => setDailyRepeatCount(opt.val)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-bold transition ${
                        dailyRepeatCount === opt.val
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">タスク名</label>
                <input
                  type="text"
                  value={weeklyTitle}
                  onChange={(e) => setWeeklyTitle(e.target.value)}
                  placeholder="例: プログラミング課題、レポート作成"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">1回の所要時間</label>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      step={5}
                      value={weeklyDuration || ''}
                      onChange={(e) => setWeeklyDuration(Math.max(1, parseInt(e.target.value, 10) || 0))}
                      className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-center text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                    />
                    <span className="text-xs font-bold text-slate-500">分</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {[30, 45, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setWeeklyDuration(m)}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold transition ${
                          weeklyDuration === m
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {m}分
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">週の目標消化回数</label>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={weeklyTargetCount || ''}
                      onChange={(e) => setWeeklyTargetCount(Math.min(7, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-center text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                    />
                    <span className="text-xs font-bold text-slate-500">回</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {[1, 2, 3, 4, 5].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setWeeklyTargetCount(c)}
                        className={`rounded-md border px-2.5 py-0.5 text-[10px] font-bold transition ${
                          weeklyTargetCount === c
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        週{c}回
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
