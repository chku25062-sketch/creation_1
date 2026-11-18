'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Clock,
  RotateCcw,
  Plus,
  Trash2,
  Shield,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
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

export interface WizardSlotItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  targetDays: number[]; // 0:月〜6:日
  attachedTaskEnabled?: boolean;
  attachedTaskDuration?: number;
}

interface TableTemplateWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTable: (table: ImportedTableData) => void;
  targetTable?: ImportedTableData | null;
}

type TemplateCategory = 'daily' | 'weekly' | 'fixed';
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
  const [isOpenDailyAdvanced, setIsOpenDailyAdvanced] = useState(false);

  // 単一/複数メニュー（マルチタスクリスト）
  const [multiTasks, setMultiTasks] = useState<WizardTaskItem[]>([
    { id: '1', title: 'ストレッチ', durationMinutes: 15, startTime: '' },
  ]);
  const [isSingleEveryday, setIsSingleEveryday] = useState(true); // 毎日実施（1マス最小表）
  const [singleTargetDays, setSingleTargetDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // 日課共通（★デフォルトは 'auto'）
  const [dailyRepeatCount, setDailyRepeatCount] = useState<number | 'auto'>('auto');
  const [dailyTimePreset, setDailyTimePreset] = useState<DailyTimePreset>('all');
  const [dailyStartTime, setDailyStartTime] = useState<string>('');
  const [dailyEndTime, setDailyEndTime] = useState<string>('');

  // ==========================================
  // 週次タスク（Weekly）ステート
  // ==========================================
  const [weeklyName, setWeeklyName] = useState('今週のタスク');
  const [weeklyTasks, setWeeklyTasks] = useState<WizardTaskItem[]>([
    { id: 'w-1', title: 'レポート課題', durationMinutes: 60, startTime: '' },
  ]);
  const [weeklyTargetCount, setWeeklyTargetCount] = useState<number | 'auto'>('auto'); // ★デフォルトは 'auto'
  const [weeklyExpiryWeeks, setWeeklyExpiryWeeks] = useState<WeeklyExpiryWeeks>(1);
  const [weeklyHasConstraint, setWeeklyHasConstraint] = useState<boolean>(false); // 開始日時の指定有無
  const [weeklyStartDay, setWeeklyStartDay] = useState<number>(2); // 水曜 (0:月〜6:日)
  const [weeklyScheduleAfterTime, setWeeklyScheduleAfterTime] = useState<string>('14:30');
  const [isOpenWeeklyAdvanced, setIsOpenWeeklyAdvanced] = useState(false);

  // ==========================================
  // 固定枠（Fixed）ステート
  // ==========================================
  const [fixedName, setFixedName] = useState('固定枠');
  const [fixedSlots, setFixedSlots] = useState<WizardSlotItem[]>([
    { id: 'f-1', title: '睡眠', startTime: '00:00', endTime: '08:00', targetDays: [0, 1, 2, 3, 4, 5, 6] },
  ]);

  // targetTable の切り替えに連動
  React.useEffect(() => {
    if (targetTable) {
      setDailyName(targetTable.name);
      setWeeklyName(targetTable.name);
      setFixedName(targetTable.name);

      if (targetTable.placementMode === 'fixed') {
        setCategory('fixed');
      } else if (targetTable.weeklyRepeatCount !== undefined && targetTable.weeklyRepeatCount !== 'auto') {
        setCategory('weekly');
      }

      // 既存の表セルからタスク情報を読み取って初期反映
      if (targetTable.cells && targetTable.cells.length > 0) {
        if (targetTable.placementMode === 'fixed') {
          const loadedSlots: WizardSlotItem[] = [];
          targetTable.cells.forEach((row, rIdx) => {
            const activeCell = row.find((c) => c && c.text);
            if (activeCell) {
              const activeDays = row
                .map((c, d) => (c && c.text ? d : -1))
                .filter((d) => d >= 0);
              const startStr = activeCell.customStartTime || minutesToTimeString(activeCell.startMinutes || 0);
              const endStr = minutesToTimeString((activeCell.endMinutes || 480) % 1440);
              loadedSlots.push({
                id: `slot-${rIdx}-${Date.now()}`,
                title: activeCell.title || activeCell.text || '',
                startTime: startStr,
                endTime: endStr,
                targetDays: activeDays.length > 0 ? activeDays : [0, 1, 2, 3, 4, 5, 6],
                attachedTaskEnabled: activeCell.attachedTask?.enabled ?? false,
                attachedTaskDuration: activeCell.attachedTask?.durationMinutes ?? 30,
              });
            }
          });
          if (loadedSlots.length > 0) {
            setFixedSlots(loadedSlots);
          }
        } else {
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
            setWeeklyTasks(loadedTasks);
          }
        }
      }
    }
  }, [targetTable]);

  // 日課プリセット切り替えハンドラ
  const handleSelectDailyPreset = (preset: DailyTimePreset) => {
    setDailyTimePreset(preset);
    if (preset === 'morning') {
      setDailyStartTime('06:00');
      setDailyEndTime('12:00');
    } else if (preset === 'afternoon') {
      setDailyStartTime('12:00');
      setDailyEndTime('18:00');
    } else if (preset === 'evening') {
      setDailyStartTime('18:00');
      setDailyEndTime('23:00');
    } else if (preset === 'all') {
      setDailyStartTime('');
      setDailyEndTime('');
    }
  };

  // 日課タスクリストハンドラ
  const handleAddTaskItem = () => {
    const last = multiTasks[multiTasks.length - 1];
    setMultiTasks((prev) => [
      ...prev,
      {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        durationMinutes: last ? last.durationMinutes : 15,
        startTime: '',
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

  // 週次タスクリストハンドラ
  const handleAddWeeklyTask = () => {
    const last = weeklyTasks[weeklyTasks.length - 1];
    setWeeklyTasks((prev) => [
      ...prev,
      {
        id: `wtask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        durationMinutes: last ? last.durationMinutes : 60,
        startTime: '',
      },
    ]);
  };

  const handleRemoveWeeklyTask = (id: string) => {
    if (weeklyTasks.length <= 1) return;
    setWeeklyTasks((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateWeeklyTask = (id: string, updates: Partial<WizardTaskItem>) => {
    setWeeklyTasks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  // 固定枠リストハンドラ
  const handleAddFixedSlot = () => {
    const last = fixedSlots[fixedSlots.length - 1];
    let nextStart = '09:00';
    let nextEnd = '10:00';
    if (last && last.endTime) {
      nextStart = last.endTime;
      const startM = timeStringToMinutes(last.endTime);
      nextEnd = minutesToTimeString((startM + 60) % 1440);
    }
    setFixedSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        startTime: nextStart,
        endTime: nextEnd,
        targetDays: [0, 1, 2, 3, 4, 5, 6],
        attachedTaskEnabled: false,
        attachedTaskDuration: 30,
      },
    ]);
  };

  const handleRemoveFixedSlot = (id: string) => {
    if (fixedSlots.length <= 1) return;
    setFixedSlots((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateFixedSlot = (id: string, updates: Partial<WizardSlotItem>) => {
    setFixedSlots((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  if (!isOpen) return null;

  // 曜日トグルハンドラ
  const toggleSingleWeekday = (day: number) => {
    setSingleTargetDays((prev) =>
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

      const first = multiTasks[0];
      const input: DailyRoutineTemplateInput = {
        name: dailyName || '日課ルーティン',
        mode: 'single',
        dailyRepeatCount,
        timeRange: {
          startTime: finalStartTime,
          endTime: finalEndTime,
        },
        singleTask: {
          title: first?.title?.trim() || '日課',
          durationMinutes: first?.durationMinutes && first.durationMinutes > 0 ? first.durationMinutes : 15,
          startTime: first?.startTime?.trim() || undefined,
          isEveryday: isSingleEveryday,
          targetDays: !isSingleEveryday && singleTargetDays.length > 0 ? singleTargetDays : undefined,
        },
        multiTasks: {
          items: multiTasks.map((t) => ({
            title: t.title.trim() || '日課',
            durationMinutes: t.durationMinutes > 0 ? t.durationMinutes : 15,
            startTime: t.startTime.trim() || undefined,
          })),
          isEveryday: isSingleEveryday,
          targetDays: !isSingleEveryday && singleTargetDays.length > 0 ? singleTargetDays : undefined,
        },
      };

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
        name: weeklyName || '今週のタスク',
        title: weeklyTasks[0]?.title || '週タスク',
        durationMinutes: weeklyTasks[0]?.durationMinutes || 60,
        weeklyTargetCount,
        expiryWeeks: weeklyExpiryWeeks,
        multiTasks: {
          items: weeklyTasks.map((t) => ({
            title: t.title.trim() || '週タスク',
            durationMinutes: t.durationMinutes > 0 ? t.durationMinutes : 60,
          })),
        },
        startConstraint: weeklyHasConstraint
          ? {
              enabled: true,
              startDay: weeklyStartDay,
              scheduleAfterTime: weeklyScheduleAfterTime,
            }
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
        name: fixedName || '固定枠',
        title: fixedSlots[0]?.title || '固定枠',
        startTime: fixedSlots[0]?.startTime || '00:00',
        endTime: fixedSlots[0]?.endTime || '08:00',
        targetDays: fixedSlots[0]?.targetDays || [0, 1, 2, 3, 4, 5, 6],
        multiSlots: {
          items: fixedSlots.map((s) => ({
            title: s.title.trim() || '固定枠',
            startTime: s.startTime || '00:00',
            endTime: s.endTime || '01:00',
            targetDays: s.targetDays && s.targetDays.length > 0 ? s.targetDays : [0, 1, 2, 3, 4, 5, 6],
            attachedTask: s.attachedTaskEnabled
              ? {
                  enabled: true,
                  durationMinutes: s.attachedTaskDuration || 30,
                }
              : undefined,
          })),
        },
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
            <div className="space-y-4">
              {/* 表の表示名 */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700 shrink-0 w-20">表のタイトル</label>
                <input
                  type="text"
                  value={dailyName}
                  onChange={(e) => setDailyName(e.target.value)}
                  placeholder="例: 朝ルーティン、英語学習"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>

              {/* 活動時間帯（表全体の設定） */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span>活動時間帯（表全体）</span>
                  </label>
                  <span className="text-[11px] text-blue-600 font-medium">この時間枠内で空きコマに自動配置</span>
                </div>

                {/* プリセット選択ボタン */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
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
                      onClick={() => handleSelectDailyPreset(p.id)}
                      className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                        dailyTimePreset === p.id
                          ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* 開始・終了時刻入力 */}
                {dailyTimePreset !== 'all' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-500">時間範囲:</span>
                    <input
                      type="time"
                      value={dailyStartTime}
                      onChange={(e) => {
                        setDailyStartTime(e.target.value);
                        setDailyTimePreset('custom');
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                    />
                    <span className="text-slate-400 text-xs font-bold">〜</span>
                    <input
                      type="time"
                      value={dailyEndTime}
                      onChange={(e) => {
                        setDailyEndTime(e.target.value);
                        setDailyTimePreset('custom');
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* フラットなテーブルリスト */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                {/* テーブルヘッダー */}
                <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 border-b border-slate-200">
                  <div className="col-span-7 sm:col-span-8">項目名</div>
                  <div className="col-span-4 sm:col-span-3 text-center sm:text-left">1回の所要時間</div>
                  <div className="col-span-1 text-right">操作</div>
                </div>

                {/* テーブル行 */}
                <div className="divide-y divide-slate-100">
                  {multiTasks.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-slate-50/50 transition"
                    >
                      {/* 項目名 */}
                      <div className="col-span-7 sm:col-span-8 flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] font-bold text-slate-400 w-4 shrink-0 text-center">
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateTaskItem(item.id, { title: e.target.value })}
                          placeholder={`例: ${idx === 0 ? 'ストレッチ' : idx === 1 ? '読書' : 'タスク名'}`}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      {/* 所要時間ステッパー */}
                      <div className="col-span-4 sm:col-span-3 flex justify-center sm:justify-start">
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

                      {/* 削除ボタン */}
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveTaskItem(item.id)}
                          disabled={multiTasks.length <= 1}
                          aria-label="削除"
                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* テーブルフッターアクション */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                  <button
                    type="button"
                    onClick={handleAddTaskItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-blue-400 bg-white text-xs font-bold text-blue-700 hover:bg-blue-50 transition active:scale-95 shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>項目を追加</span>
                  </button>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    ※ 登録された日課は活動時間帯の空きコマに自動配置されます
                  </span>
                </div>
              </div>

              {/* コア機能の説明（自動配分） */}
              <div className="flex items-center gap-2 rounded-xl bg-blue-50/60 p-2.5 text-xs text-blue-900 border border-blue-100">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <strong>回数は「自動配分」</strong>です。上記の活動時間帯内の空きコマを自動探索し、可能な限り詰め込みます。
                </div>
              </div>

              {/* 詳細設定アコーディオン */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsOpenDailyAdvanced(!isOpenDailyAdvanced)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                    <span>⚙️ スケジュールの詳細オプション（任意）</span>
                  </div>
                  {isOpenDailyAdvanced ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpenDailyAdvanced && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/40">
                    {/* 1日の上限回数 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">1日の上限回数</label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setDailyRepeatCount(dailyRepeatCount === 'auto' ? 1 : 'auto')}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                            dailyRepeatCount === 'auto'
                              ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/10'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          自動配分（推奨）
                        </button>
                        {dailyRepeatCount !== 'auto' && (
                          <NumberStepper
                            value={dailyRepeatCount}
                            onChange={(val) => setDailyRepeatCount(val)}
                            min={1}
                            max={12}
                            step={1}
                            unit="回/日"
                            ariaLabel="1日の上限回数"
                          />
                        )}
                        <span className="text-[11px] text-slate-400">
                          {dailyRepeatCount === 'auto' ? '空き時間に応じて最大化' : `1日最大${dailyRepeatCount}回`}
                        </span>
                      </div>
                    </div>

                    {/* 実施曜日指定 */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">実施する曜日</label>
                        <button
                          type="button"
                          onClick={() => setIsSingleEveryday(!isSingleEveryday)}
                          className="text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          {isSingleEveryday ? '+ 特定の曜日のみに限定する' : '毎日（全曜日）に戻す'}
                        </button>
                      </div>

                      {!isSingleEveryday && (
                        <div className="grid grid-cols-7 gap-1 pt-1">
                          {WEEKDAYS.map((w) => {
                            const active = singleTargetDays.includes(w.dayIndex);
                            return (
                              <button
                                key={w.dayIndex}
                                type="button"
                                onClick={() => toggleSingleWeekday(w.dayIndex)}
                                className={`rounded-lg border py-1.5 text-xs font-bold transition ${
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
                      )}
                    </div>
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
              {/* 表の表示名 */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700 shrink-0 w-20">表のタイトル</label>
                <input
                  type="text"
                  value={weeklyName}
                  onChange={(e) => setWeeklyName(e.target.value)}
                  placeholder="例: 今週の課題セット、週末家事"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              {/* フラットなテーブルリスト */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 border-b border-slate-200">
                  <div className="col-span-7 sm:col-span-8">項目名</div>
                  <div className="col-span-4 sm:col-span-3 text-center sm:text-left">1回の所要時間</div>
                  <div className="col-span-1 text-right">操作</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {weeklyTasks.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-slate-50/50 transition"
                    >
                      <div className="col-span-7 sm:col-span-8 flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] font-bold text-slate-400 w-4 shrink-0 text-center">
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateWeeklyTask(item.id, { title: e.target.value })}
                          placeholder={`例: ${idx === 0 ? 'レポート課題' : idx === 1 ? '部屋の掃除' : 'タスク名'}`}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-3 flex justify-center sm:justify-start">
                        <NumberStepper
                          value={item.durationMinutes}
                          onChange={(val) => handleUpdateWeeklyTask(item.id, { durationMinutes: val })}
                          min={5}
                          max={720}
                          step={5}
                          unit="分"
                          ariaLabel={`タスク${idx + 1}の所要時間`}
                        />
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveWeeklyTask(item.id)}
                          disabled={weeklyTasks.length <= 1}
                          aria-label="削除"
                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                  <button
                    type="button"
                    onClick={handleAddWeeklyTask}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-emerald-400 bg-white text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition active:scale-95 shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>項目を追加</span>
                  </button>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    ※ 1つの表に今週こなしたいタスクをまとめて登録できます
                  </span>
                </div>
              </div>

              {/* コア機能の説明 */}
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50/60 p-2.5 text-xs text-emerald-900 border border-emerald-100">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <strong>回数は「自動配分」</strong>です。今週の空き枠の多い曜日に合わせて前倒し・バランスよく配置されます。
                </div>
              </div>

              {/* 詳細設定アコーディオン */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsOpenWeeklyAdvanced(!isOpenWeeklyAdvanced)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                    <span>⚙️ スケジュールの詳細オプション（任意）</span>
                  </div>
                  {isOpenWeeklyAdvanced ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpenWeeklyAdvanced && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/40">
                    {/* 週の消化目標回数 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">週の消化目標回数</label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setWeeklyTargetCount(weeklyTargetCount === 'auto' ? 1 : 'auto')}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                            weeklyTargetCount === 'auto'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          自動配分（推奨）
                        </button>
                        {weeklyTargetCount !== 'auto' && (
                          <NumberStepper
                            value={weeklyTargetCount}
                            onChange={(val) => setWeeklyTargetCount(val)}
                            min={1}
                            max={7}
                            step={1}
                            unit="回/週"
                            ariaLabel="週の目標回数"
                          />
                        )}
                      </div>
                    </div>

                    {/* タスクの有効期限 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">タスクの有効期限</label>
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
                            className={`rounded-xl border py-1.5 text-xs font-bold transition ${
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

                    {/* 着手可能日時の指定 */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">着手可能日時（出題日時縛り）</label>
                        <button
                          type="button"
                          onClick={() => setWeeklyHasConstraint(!weeklyHasConstraint)}
                          className="text-[11px] font-bold text-emerald-600 hover:underline"
                        >
                          {weeklyHasConstraint ? '縛りを解除（いつでも着手）' : '+ 開始日時を指定する'}
                        </button>
                      </div>

                      {weeklyHasConstraint && (
                        <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                          <select
                            value={weeklyStartDay}
                            onChange={(e) => setWeeklyStartDay(Number(e.target.value))}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800"
                          >
                            {WEEKDAYS.map((w) => (
                              <option key={w.dayIndex} value={w.dayIndex}>
                                {w.label}曜日
                              </option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={weeklyScheduleAfterTime}
                            onChange={(e) => setWeeklyScheduleAfterTime(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold"
                          />
                          <span className="text-[11px] text-slate-500">以降に着手</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              3. 固定枠（Fixed）設定
             ======================================================== */}
          {category === 'fixed' && (
            <div className="space-y-4">
              {/* 表の表示名 */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700 shrink-0 w-20">表のタイトル</label>
                <input
                  type="text"
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  placeholder="例: 基本生活リズム、固定予定"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-hidden transition"
                />
              </div>

              {/* フラットなテーブルリスト */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 border-b border-slate-200">
                  <div className="col-span-4 sm:col-span-4">枠の名前</div>
                  <div className="col-span-4 sm:col-span-4 text-center">時間帯 (開始 〜 終了)</div>
                  <div className="col-span-3 sm:col-span-3 text-center sm:text-left">対象曜日</div>
                  <div className="col-span-1 text-right">操作</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {fixedSlots.map((item, idx) => (
                    <div
                      key={item.id}
                      className="px-3 py-2 hover:bg-slate-50/50 transition space-y-1.5"
                    >
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4 sm:col-span-4 flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-bold text-slate-400 w-4 shrink-0 text-center">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateFixedSlot(item.id, { title: e.target.value })}
                            placeholder={`例: ${idx === 0 ? '睡眠' : idx === 1 ? '昼食' : '固定枠名'}`}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 focus:border-purple-500 focus:outline-hidden"
                          />
                        </div>

                        <div className="col-span-4 sm:col-span-4 flex items-center justify-center gap-1">
                          <input
                            type="time"
                            value={item.startTime}
                            onChange={(e) => handleUpdateFixedSlot(item.id, { startTime: e.target.value })}
                            className="w-18 sm:w-20 rounded-lg border border-slate-200 px-1 py-1 text-xs font-mono font-bold text-slate-700 text-center focus:border-purple-500 focus:outline-hidden"
                          />
                          <span className="text-slate-400 text-xs">〜</span>
                          <input
                            type="time"
                            value={item.endTime}
                            onChange={(e) => handleUpdateFixedSlot(item.id, { endTime: e.target.value })}
                            className="w-18 sm:w-20 rounded-lg border border-slate-200 px-1 py-1 text-xs font-mono font-bold text-slate-700 text-center focus:border-purple-500 focus:outline-hidden"
                          />
                        </div>

                        <div className="col-span-3 sm:col-span-3 flex justify-center sm:justify-start">
                          <select
                            value={
                              item.targetDays.length === 7
                                ? 'all'
                                : item.targetDays.length === 5 &&
                                  !item.targetDays.includes(5) &&
                                  !item.targetDays.includes(6)
                                ? 'weekday'
                                : item.targetDays.length === 2 &&
                                  item.targetDays.includes(5) &&
                                  item.targetDays.includes(6)
                                ? 'weekend'
                                : 'custom'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'all') handleUpdateFixedSlot(item.id, { targetDays: [0, 1, 2, 3, 4, 5, 6] });
                              else if (val === 'weekday') handleUpdateFixedSlot(item.id, { targetDays: [0, 1, 2, 3, 4] });
                              else if (val === 'weekend') handleUpdateFixedSlot(item.id, { targetDays: [5, 6] });
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 focus:border-purple-500 focus:outline-hidden"
                          >
                            <option value="all">毎日 (月〜日)</option>
                            <option value="weekday">平日のみ</option>
                            <option value="weekend">週末のみ</option>
                            <option value="custom">曜日個別</option>
                          </select>
                        </div>

                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveFixedSlot(item.id)}
                            disabled={fixedSlots.length <= 1}
                            aria-label="削除"
                            className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* 付随タスク設定 */}
                      <div className="ml-5 pl-2 border-l-2 border-purple-200 flex flex-wrap items-center gap-3 text-xs pt-0.5">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-purple-900 select-none">
                          <input
                            type="checkbox"
                            checked={item.attachedTaskEnabled ?? false}
                            onChange={(e) => handleUpdateFixedSlot(item.id, { attachedTaskEnabled: e.target.checked })}
                            className="rounded text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                          />
                          <span className="font-medium text-[11px]">終了後に課題・復習タスクを付ける</span>
                        </label>
                        {item.attachedTaskEnabled && (
                          <div className="flex items-center gap-1.5 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                            <span className="text-[11px] text-purple-700 font-bold">所要時間:</span>
                            <NumberStepper
                              value={item.attachedTaskDuration ?? 30}
                              onChange={(val) => handleUpdateFixedSlot(item.id, { attachedTaskDuration: val })}
                              min={5}
                              max={240}
                              step={5}
                              unit="分"
                              ariaLabel={`${item.title || '固定枠'}の付随タスク所要時間`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                  <button
                    type="button"
                    onClick={handleAddFixedSlot}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-purple-400 bg-white text-xs font-bold text-purple-700 hover:bg-purple-50 transition active:scale-95 shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>固定枠を追加</span>
                  </button>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    ※ 登録された固定枠は開始時刻順に自動整列されます
                  </span>
                </div>
              </div>

              {/* コア機能の説明 */}
              <div className="flex items-center gap-2 rounded-xl bg-purple-50/60 p-2.5 text-xs text-purple-900 border border-purple-100">
                <Shield className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  固定枠の時間帯はタイムライン上で保護されます。「課題・復習タスク」を付けた場合、枠終了直後の空きコマに自動配置されます。
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
