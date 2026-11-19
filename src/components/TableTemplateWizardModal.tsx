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
  const [fixedDayMode, setFixedDayMode] = useState<'everyday' | 'weekday' | 'cycle'>('everyday');
  const [fixedCycleLength, setFixedCycleLength] = useState<number>(3);
  const [fixedCycleStartDay, setFixedCycleStartDay] = useState<number>(0);
  const [fixedSlots, setFixedSlots] = useState<WizardSlotItem[]>([
    { id: 'f-1', title: '睡眠', startTime: '00:00', endTime: '08:00', targetDays: [0] },
  ]);

  // targetTable の切り替えに連動
  React.useEffect(() => {
    if (targetTable) {
      setDailyName(targetTable.name);
      setWeeklyName(targetTable.name);
      setFixedName(targetTable.name);

      if (targetTable.placementMode === 'fixed') {
        setCategory('fixed');
        if (targetTable.columnMode === 'cycle') {
          if (targetTable.numCols === 1) {
            setFixedDayMode('everyday');
          } else {
            setFixedDayMode('cycle');
            setFixedCycleLength(targetTable.numCols);
            setFixedCycleStartDay(targetTable.cycleStartDay ?? 0);
          }
        } else {
          setFixedDayMode('weekday');
        }
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
    const defaultDays =
      fixedDayMode === 'everyday'
        ? [0]
        : fixedDayMode === 'cycle'
          ? Array.from({ length: fixedCycleLength }, (_, i) => i)
          : [0, 1, 2, 3, 4, 5, 6];

    setFixedSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        startTime: nextStart,
        endTime: nextEnd,
        targetDays: defaultDays,
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

  const toggleFixedSlotDay = (slotId: string, day: number) => {
    setFixedSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        const current = s.targetDays || [];
        const updated = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day].sort((a, b) => a - b);
        return { ...s, targetDays: updated };
      }),
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
      const defaultDays =
        fixedDayMode === 'everyday'
          ? [0]
          : fixedDayMode === 'cycle'
            ? Array.from({ length: fixedCycleLength }, (_, i) => i)
            : [0, 1, 2, 3, 4, 5, 6];

      const table = createFixedSlotTable({
        name: fixedName || '固定枠',
        title: fixedSlots[0]?.title || '固定枠',
        startTime: fixedSlots[0]?.startTime || '00:00',
        endTime: fixedSlots[0]?.endTime || '08:00',
        mode: fixedDayMode,
        cycleLength: fixedDayMode === 'cycle' ? fixedCycleLength : fixedDayMode === 'everyday' ? 1 : undefined,
        cycleStartDay: fixedDayMode === 'cycle' ? fixedCycleStartDay : undefined,
        multiSlots: {
          items: fixedSlots.map((s) => ({
            title: s.title.trim() || '固定枠',
            startTime: s.startTime || '00:00',
            endTime: s.endTime || '01:00',
            targetDays: s.targetDays && s.targetDays.length > 0 ? s.targetDays : defaultDays,
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
            <span>日課</span>
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
            <span>週次タスク</span>
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
            <span>固定枠</span>
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
                <label className="text-xs font-bold text-slate-700 shrink-0 w-24">表の名前は何にしますか？</label>
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
                    <span>どの時間帯に行いますか？</span>
                  </label>
                  <span className="text-[11px] text-blue-600 font-medium">この時間枠内で空きコマに自動配置</span>
                </div>

                {/* プリセット選択ボタン */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { id: 'all' as const, label: '終日' },
                    { id: 'morning' as const, label: '朝', sub: '6:00〜12:00' },
                    { id: 'afternoon' as const, label: '昼', sub: '12:00〜18:00' },
                    { id: 'evening' as const, label: '夜', sub: '18:00〜23:00' },
                    { id: 'custom' as const, label: 'カスタム' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectDailyPreset(p.id)}
                      className={`rounded-lg border py-1.5 px-2 text-xs font-bold transition flex flex-col items-center justify-center ${
                        dailyTimePreset === p.id
                          ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{p.label}</span>
                      {p.sub && (
                        <span
                          className={`text-[9px] font-normal leading-tight mt-0.5 ${
                            dailyTimePreset === p.id ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {p.sub}
                        </span>
                      )}
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
                  <div className="col-span-6 sm:col-span-7">予定の名称</div>
                  <div className="col-span-5 sm:col-span-4 text-center sm:text-left">1タスク当たり何分ぐらいかかりますか？</div>
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
                      <div className="col-span-6 sm:col-span-7 flex items-center gap-1.5 min-w-0">
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
                      <div className="col-span-5 sm:col-span-4 flex justify-center sm:justify-start">
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
                    <span>詳細オプション</span>
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
                <label className="text-xs font-bold text-slate-700 shrink-0 w-24">表の名前は何にしますか？</label>
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
                  <div className="col-span-6 sm:col-span-7">タスク名</div>
                  <div className="col-span-5 sm:col-span-4 text-center sm:text-left">1回当たり何分ぐらいかかりますか？</div>
                  <div className="col-span-1 text-right">操作</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {weeklyTasks.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-slate-50/50 transition"
                    >
                      <div className="col-span-6 sm:col-span-7 flex items-center gap-1.5 min-w-0">
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

                      <div className="col-span-5 sm:col-span-4 flex justify-center sm:justify-start">
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
                    <span>詳細オプション</span>
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
                          { id: 1 as const, label: '今週中' },
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
                        <label className="text-xs font-bold text-slate-700">着手可能日時</label>
                        <button
                          type="button"
                          onClick={() => setWeeklyHasConstraint(!weeklyHasConstraint)}
                          className="text-[11px] font-bold text-emerald-600 hover:underline"
                        >
                          {weeklyHasConstraint ? '指定を解除' : '+ 開始日時を指定する'}
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
              {/* 【ステップ 1】表の名前は何にしますか？ */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[11px] font-black text-purple-700">
                    1
                  </span>
                  <span>表の名前は何にしますか？</span>
                </label>
                <input
                  type="text"
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  placeholder="例: 基本生活リズム、シフト勤務、アルバイト"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-hidden transition"
                />
              </div>

              {/* 【ステップ 2】何日分の予定を設定しますか？ */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] font-black text-white">
                      2
                    </span>
                    <span>何日分の予定を設定しますか？</span>
                  </label>
                  <span className="text-[11px] text-purple-700 font-medium">スケジュール形式を選択</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'everyday' as const,
                      title: '毎日同じ (1日分)',
                      desc: '全曜日に同じ予定を配置（睡眠や固定ルーティン）',
                    },
                    {
                      id: 'weekday' as const,
                      title: '曜日ごと (7日分)',
                      desc: '月〜日で異なる予定（授業・定休・平日と週末）',
                    },
                    {
                      id: 'cycle' as const,
                      title: 'くり返しサイクル',
                      desc: '2〜14日周期の交代勤務（日勤/夜勤/休）など',
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setFixedDayMode(m.id);
                        // モード変更時に各スロットのtargetDaysを適合
                        if (m.id === 'everyday') {
                          setFixedSlots((prev) => prev.map((s) => ({ ...s, targetDays: [0] })));
                        } else if (m.id === 'weekday') {
                          setFixedSlots((prev) =>
                            prev.map((s) => ({
                              ...s,
                              targetDays:
                                s.targetDays && s.targetDays.length > 0 && s.targetDays.every((d) => d < 7)
                                  ? s.targetDays
                                  : [0, 1, 2, 3, 4, 5, 6],
                            })),
                          );
                        } else if (m.id === 'cycle') {
                          setFixedSlots((prev) =>
                            prev.map((s) => ({
                              ...s,
                              targetDays:
                                s.targetDays && s.targetDays.length > 0 && s.targetDays.every((d) => d < fixedCycleLength)
                                  ? s.targetDays
                                  : Array.from({ length: fixedCycleLength }, (_, i) => i),
                            })),
                          );
                        }
                      }}
                      className={`rounded-xl border p-2.5 text-left transition flex flex-col justify-between ${
                        fixedDayMode === m.id
                          ? 'border-purple-600 bg-white ring-2 ring-purple-500/20 shadow-xs'
                          : 'border-slate-200 bg-white/70 hover:bg-white text-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>{m.title}</span>
                        {fixedDayMode === m.id && (
                          <span className="h-2 w-2 rounded-full bg-purple-600" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                        {m.desc}
                      </div>
                    </button>
                  ))}
                </div>

                {/* くり返しサイクル選択時の詳細質問 */}
                {fixedDayMode === 'cycle' && (
                  <div className="rounded-lg border border-purple-200 bg-white p-3 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">周期の日数（何日分くり返しますか？）:</span>
                        <NumberStepper
                          value={fixedCycleLength}
                          onChange={(val) => {
                            setFixedCycleLength(val);
                            // cycleLength縮小時に範囲外のtargetDaysをクリップ
                            setFixedSlots((prev) =>
                              prev.map((s) => ({
                                ...s,
                                targetDays: (s.targetDays || []).filter((d) => d < val),
                              })),
                            );
                          }}
                          min={2}
                          max={14}
                          step={1}
                          unit="日分"
                          ariaLabel="周期の日数"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700">何曜日から始まりますか？:</span>
                        <select
                          value={fixedCycleStartDay}
                          onChange={(e) => setFixedCycleStartDay(Number(e.target.value))}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 focus:border-purple-500 focus:outline-hidden"
                        >
                          {WEEKDAYS.map((w) => (
                            <option key={w.dayIndex} value={w.dayIndex}>
                              {w.label}曜日（Day 1）
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 【ステップ 3】予定と時間帯を登録してください */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs space-y-0">
                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] font-black text-white">
                      3
                    </span>
                    <span>予定と時間帯を登録してください</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    ※ 開始時刻順に自動整列されます
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {fixedSlots.map((item, idx) => {
                    // 所要時間の計算
                    const startM = timeStringToMinutes(item.startTime || '00:00');
                    let endM = timeStringToMinutes(item.endTime || '08:00');
                    if (endM <= startM) endM += 1440;
                    const diffM = endM - startM;
                    const hours = Math.floor(diffM / 60);
                    const mins = diffM % 60;
                    const durationLabel = hours > 0 && mins > 0 ? `${hours}h${mins}m` : hours > 0 ? `${hours}時間` : `${mins}分`;

                    return (
                      <div
                        key={item.id}
                        className="p-3 hover:bg-slate-50/50 transition space-y-2.5"
                      >
                        {/* 1行目: タイトル、時間帯、削除 */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                            <span className="text-xs font-bold text-slate-400 w-5 shrink-0 text-center">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleUpdateFixedSlot(item.id, { title: e.target.value })}
                              placeholder={`例: ${idx === 0 ? '睡眠' : idx === 1 ? '日勤' : '固定予定'}`}
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 font-bold focus:border-purple-500 focus:outline-hidden"
                            />
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[11px] font-medium text-slate-500">時間帯:</span>
                            <input
                              type="time"
                              value={item.startTime}
                              onChange={(e) => handleUpdateFixedSlot(item.id, { startTime: e.target.value })}
                              className="w-18 rounded-lg border border-slate-200 px-1 py-0.5 text-xs font-mono font-bold text-slate-700 text-center focus:border-purple-500 focus:outline-hidden"
                            />
                            <span className="text-slate-400 text-xs font-bold">〜</span>
                            <input
                              type="time"
                              value={item.endTime}
                              onChange={(e) => handleUpdateFixedSlot(item.id, { endTime: e.target.value })}
                              className="w-18 rounded-lg border border-slate-200 px-1 py-0.5 text-xs font-mono font-bold text-slate-700 text-center focus:border-purple-500 focus:outline-hidden"
                            />
                            <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                              {durationLabel}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFixedSlot(item.id)}
                            disabled={fixedSlots.length <= 1}
                            aria-label="削除"
                            className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 transition ml-auto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* 2行目: 設定する日（対象日のチップ選択） */}
                        <div className="ml-6 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-[11px] font-bold text-slate-600 shrink-0">
                            設定する日:
                          </span>

                          {fixedDayMode === 'everyday' ? (
                            <span className="text-[11px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                              毎日適用されます
                            </span>
                          ) : fixedDayMode === 'weekday' ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {WEEKDAYS.map((w) => {
                                const isSelected = item.targetDays.includes(w.dayIndex);
                                return (
                                  <button
                                    key={w.dayIndex}
                                    type="button"
                                    onClick={() => toggleFixedSlotDay(item.id, w.dayIndex)}
                                    className={`h-6 px-2 rounded-md text-[11px] font-bold transition ${
                                      isSelected
                                        ? 'bg-purple-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {w.label}
                                  </button>
                                );
                              })}
                              <div className="flex items-center gap-1 ml-1 text-[10px] text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateFixedSlot(item.id, { targetDays: [0, 1, 2, 3, 4, 5, 6] })}
                                  className="underline hover:text-slate-600"
                                >
                                  全日
                                </button>
                                <span>/</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateFixedSlot(item.id, { targetDays: [0, 1, 2, 3, 4] })}
                                  className="underline hover:text-slate-600"
                                >
                                  平日
                                </button>
                                <span>/</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateFixedSlot(item.id, { targetDays: [5, 6] })}
                                  className="underline hover:text-slate-600"
                                >
                                  週末
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* fixedDayMode === 'cycle' */
                            <div className="flex flex-wrap items-center gap-1">
                              {Array.from({ length: fixedCycleLength }, (_, i) => {
                                const isSelected = item.targetDays.includes(i);
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => toggleFixedSlotDay(item.id, i)}
                                    className={`h-6 px-2 rounded-md text-[11px] font-bold transition ${
                                      isSelected
                                        ? 'bg-purple-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    Day {i + 1}
                                  </button>
                                );
                              })}
                              <div className="flex items-center gap-1 ml-1 text-[10px] text-slate-400">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateFixedSlot(item.id, {
                                      targetDays: Array.from({ length: fixedCycleLength }, (_, i) => i),
                                    })
                                  }
                                  className="underline hover:text-slate-600"
                                >
                                  全Day
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 3行目: 課題・復習タスク設定 */}
                        <div className="ml-6 pl-2 border-l-2 border-purple-200 flex flex-wrap items-center gap-3 text-xs pt-0.5">
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
                              <span className="text-[11px] text-purple-700 font-bold">1タスク当たり何分ぐらいかかりますか？:</span>
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
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                  <button
                    type="button"
                    onClick={handleAddFixedSlot}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-purple-400 bg-white text-xs font-bold text-purple-700 hover:bg-purple-50 transition active:scale-95 shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>予定を追加する</span>
                  </button>
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
