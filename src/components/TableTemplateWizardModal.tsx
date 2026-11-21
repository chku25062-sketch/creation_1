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
} from '@/lib/templates/tableTemplates';
import { NumberStepper } from './NumberStepper';
import { timeStringToMinutes, minutesToTimeString } from '@/lib/timeUtils';

export interface WizardTaskItem {
  id: string;
  title: string;
  durationMinutes: number;
  startTime: string; // 例: "07:00"、空文字なら未指定
  targetDays?: number[]; // 対象とする日 (Day 1..N または 曜日 0..6)
  weeklyCount?: number; // 週次タスク: 週あたりの目標回数（デフォルト 1）
}

export interface WizardSlotItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  targetDays: number[]; // 0..N-1
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
  const [dailyDaysCount, setDailyDaysCount] = useState<number>(1);
  const [dailyIsRepeat, setDailyIsRepeat] = useState<boolean>(true);
  const [dailyRepeatStartDay, setDailyRepeatStartDay] = useState<number>(0);
  const [isOpenDailyAdvanced, setIsOpenDailyAdvanced] = useState(false);

  // 単一/複数メニュー（マルチタスクリスト）
  const [multiTasks, setMultiTasks] = useState<WizardTaskItem[]>([
    { id: '1', title: 'ストレッチ', durationMinutes: 15, startTime: '', targetDays: [0] },
  ]);

  // 日課共通（デフォルトは1日1回）
  const [dailyRepeatCount, setDailyRepeatCount] = useState<number | 'auto'>(1);
  const [dailyTimePreset, setDailyTimePreset] = useState<DailyTimePreset>('all');
  const [dailyStartTime, setDailyStartTime] = useState<string>('');
  const [dailyEndTime, setDailyEndTime] = useState<string>('');

  // ==========================================
  // 週次タスク（Weekly）ステート（デフォルトは当週7日分）
  // ==========================================
  const [weeklyName, setWeeklyName] = useState('今週のタスク');
  const [weeklyDaysCount, setWeeklyDaysCount] = useState<number>(7);
  const [weeklyIsRepeat, setWeeklyIsRepeat] = useState<boolean>(false);
  const [weeklyRepeatStartDay, setWeeklyRepeatStartDay] = useState<number>(0);
  const [weeklyTasks, setWeeklyTasks] = useState<WizardTaskItem[]>([
    { id: 'w-1', title: 'レポート課題', durationMinutes: 60, weeklyCount: 2, startTime: '', targetDays: [0, 1, 2, 3, 4, 5, 6] },
  ]);
  const [weeklyExpiryWeeks, setWeeklyExpiryWeeks] = useState<WeeklyExpiryWeeks>(1);
  const [weeklyHasConstraint, setWeeklyHasConstraint] = useState<boolean>(false); // 開始日時の指定有無
  const [weeklyStartDay, setWeeklyStartDay] = useState<number>(2); // 水曜 (0:月〜6:日)
  const [weeklyScheduleAfterTime, setWeeklyScheduleAfterTime] = useState<string>('14:30');
  const [isOpenWeeklyAdvanced, setIsOpenWeeklyAdvanced] = useState(false);

  // ==========================================
  // 固定枠（Fixed）ステート（デフォルトは毎週月〜日くり返し）
  // ==========================================
  const [fixedName, setFixedName] = useState('固定枠');
  const [fixedDaysCount, setFixedDaysCount] = useState<number>(7);
  const [fixedIsRepeat, setFixedIsRepeat] = useState<boolean>(true);
  const [fixedRepeatStartDay, setFixedRepeatStartDay] = useState<number>(0);
  const [fixedSlots, setFixedSlots] = useState<WizardSlotItem[]>([
    { id: 'f-1', title: '睡眠', startTime: '23:00', endTime: '07:00', targetDays: [0, 1, 2, 3, 4, 5, 6] },
  ]);
  const [isOpenFixedAdvanced, setIsOpenFixedAdvanced] = useState(false);

  // targetTable の切り替えに連動
  React.useEffect(() => {
    if (targetTable) {
      setDailyName(targetTable.name);
      setWeeklyName(targetTable.name);
      setFixedName(targetTable.name);

      const tableCols = Math.max(1, Math.min(14, targetTable.numCols || 1));
      const tableIsCycle = targetTable.columnMode === 'cycle';
      const startDay = targetTable.cycleStartDay ?? 0;

      if (targetTable.placementMode === 'fixed') {
        setCategory('fixed');
        setFixedDaysCount(tableCols);
        setFixedIsRepeat(tableIsCycle || tableCols === 1);
        setFixedRepeatStartDay(startDay);
      } else if (targetTable.weeklyRepeatCount !== undefined && targetTable.weeklyRepeatCount !== 'auto') {
        setCategory('weekly');
        setWeeklyDaysCount(tableCols);
        setWeeklyIsRepeat(tableIsCycle || tableCols === 1);
        setWeeklyRepeatStartDay(startDay);
      } else {
        setCategory('daily');
        setDailyDaysCount(tableCols);
        setDailyIsRepeat(tableIsCycle || tableCols === 1);
        setDailyRepeatStartDay(startDay);
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
                targetDays: activeDays.length > 0 ? activeDays : [0],
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
              const activeDays = row
                .map((c, d) => (c && c.text ? d : -1))
                .filter((d) => d >= 0);
              loadedTasks.push({
                id: `row-${rIdx}-${Date.now()}`,
                title: activeCell.title || activeCell.text || '',
                durationMinutes: activeCell.customDurationMinutes || targetTable.axisConfig.periodMinutes || 30,
                startTime: activeCell.customStartTime || '',
                targetDays: activeDays.length > 0 ? activeDays : [0],
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
    const defaultDays = Array.from({ length: dailyDaysCount }, (_, i) => i);
    setMultiTasks((prev) => [
      ...prev,
      {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        durationMinutes: last ? last.durationMinutes : 15,
        startTime: '',
        targetDays: defaultDays,
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

  const toggleDailyTaskDay = (id: string, day: number) => {
    setMultiTasks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const current = item.targetDays || [];
        const updated = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day].sort((a, b) => a - b);
        return { ...item, targetDays: updated };
      }),
    );
  };

  // 週次タスクリストハンドラ
  const handleAddWeeklyTask = () => {
    const last = weeklyTasks[weeklyTasks.length - 1];
    const defaultDays = Array.from({ length: weeklyDaysCount }, (_, i) => i);
    setWeeklyTasks((prev) => [
      ...prev,
      {
        id: `wtask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        durationMinutes: last ? last.durationMinutes : 60,
        weeklyCount: last ? (last.weeklyCount || 1) : 1,
        startTime: '',
        targetDays: defaultDays,
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

  const toggleWeeklyTaskDay = (id: string, day: number) => {
    setWeeklyTasks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const current = item.targetDays || [];
        const updated = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day].sort((a, b) => a - b);
        return { ...item, targetDays: updated };
      }),
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
    const defaultDays = Array.from({ length: fixedDaysCount }, (_, i) => i);

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

  // 何日分＆くり返しの共通UIセレクター
  const renderDaysAndRepeatSelector = (
    color: 'blue' | 'emerald' | 'purple',
    daysCount: number,
    onChangeDays: (d: number) => void,
    isRepeat: boolean,
    onChangeRepeat: (r: boolean) => void,
    repeatStartDay: number,
    onChangeStartDay: (sd: number) => void,
  ) => {
    const colorBg =
      color === 'blue'
        ? 'bg-blue-600 text-white'
        : color === 'emerald'
          ? 'bg-emerald-600 text-white'
          : 'bg-purple-600 text-white';
    const colorRing =
      color === 'blue'
        ? 'border-blue-600 ring-2 ring-blue-500/20'
        : color === 'emerald'
          ? 'border-emerald-600 ring-2 ring-emerald-500/20'
          : 'border-purple-600 ring-2 ring-purple-500/20';

    return (
      <div className="space-y-3">
        {/* 何日分の予定を設定しますか？ */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black ${colorBg}`}>
                2
              </span>
              <span>何日分の予定を設定しますか？</span>
            </label>
            <span className="text-[11px] text-slate-500">1〜14日の日数を設定</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => onChangeDays(Math.max(1, daysCount - 1))}
                className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm active:scale-95 transition cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={14}
                value={daysCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) onChangeDays(Math.max(1, Math.min(14, val)));
                }}
                className="w-12 text-center font-mono font-bold text-sm text-slate-800 focus:outline-hidden"
              />
              <span className="text-xs font-bold text-slate-600 pr-1">日分</span>
              <button
                type="button"
                onClick={() => onChangeDays(Math.min(14, daysCount + 1))}
                className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm active:scale-95 transition cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* この予定をくり返しますか？ */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black ${colorBg}`}>
                3
              </span>
              <span>この予定をくり返しますか？</span>
            </label>
            <span className="text-[11px] text-slate-500">スケジュールの巡回ルール</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChangeRepeat(true)}
              className={`rounded-xl border p-2.5 text-left transition flex flex-col justify-between cursor-pointer ${
                isRepeat
                  ? `bg-white ${colorRing} shadow-xs`
                  : 'border-slate-200 bg-white/70 hover:bg-white text-slate-600'
              }`}
            >
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>● くり返す（周期サイクルとして巡回）</span>
                {isRepeat && (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      color === 'blue'
                        ? 'bg-blue-600'
                        : color === 'emerald'
                          ? 'bg-emerald-600'
                          : 'bg-purple-600'
                    }`}
                  />
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                指定した日数（Day 1..{daysCount}）をくり返し巡回してタイムラインに自動配置します
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChangeRepeat(false)}
              className={`rounded-xl border p-2.5 text-left transition flex flex-col justify-between cursor-pointer ${
                !isRepeat
                  ? `bg-white ${colorRing} shadow-xs`
                  : 'border-slate-200 bg-white/70 hover:bg-white text-slate-600'
              }`}
            >
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>○ くり返さない（{daysCount === 7 ? '曜日固定' : '単発・当週のみ'}）</span>
                {!isRepeat && (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      color === 'blue'
                        ? 'bg-blue-600'
                        : color === 'emerald'
                          ? 'bg-emerald-600'
                          : 'bg-purple-600'
                    }`}
                  />
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                {daysCount === 7 ? '月曜〜日曜の決まった曜日に固定配置します' : '特定の期間・単発の予定として扱います'}
              </div>
            </button>
          </div>

          {/* くり返す場合、何曜日から始まるか */}
          {isRepeat && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
              <span className="text-xs font-bold text-slate-700">何曜日から始まりますか？（起算曜日）:</span>
              <select
                value={repeatStartDay}
                onChange={(e) => onChangeStartDay(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                {WEEKDAYS.map((w) => (
                  <option key={w.dayIndex} value={w.dayIndex}>
                    {w.label}曜日（Day 1）
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 各アイテムの「設定する日」チップUIセレクター
  const renderDayChips = (
    color: 'blue' | 'emerald' | 'purple',
    daysCount: number,
    isRepeat: boolean,
    targetDays: number[],
    onToggleDay: (day: number) => void,
    onSetAllDays: (days: number[]) => void,
  ) => {
    const activeChip =
      color === 'blue'
        ? 'bg-blue-600 text-white'
        : color === 'emerald'
          ? 'bg-emerald-600 text-white'
          : 'bg-purple-600 text-white';

    if (daysCount === 1) {
      return (
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
            color === 'blue'
              ? 'text-blue-700 bg-blue-50 border-blue-200'
              : color === 'emerald'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-purple-700 bg-purple-50 border-purple-200'
          }`}
        >
          毎日適用されます
        </span>
      );
    }

    if (daysCount === 7 && !isRepeat) {
      return (
        <div className="flex flex-wrap items-center gap-1">
          {WEEKDAYS.map((w) => {
            const isSelected = targetDays.includes(w.dayIndex);
            return (
              <button
                key={w.dayIndex}
                type="button"
                onClick={() => onToggleDay(w.dayIndex)}
                className={`h-6 px-2 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  isSelected ? `${activeChip} shadow-2xs` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {w.label}
              </button>
            );
          })}
          <div className="flex items-center gap-1 ml-1 text-[10px] text-slate-400">
            <button
              type="button"
              onClick={() => onSetAllDays([0, 1, 2, 3, 4, 5, 6])}
              className="underline hover:text-slate-600 cursor-pointer"
            >
              全日
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => onSetAllDays([0, 1, 2, 3, 4])}
              className="underline hover:text-slate-600 cursor-pointer"
            >
              平日
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => onSetAllDays([5, 6])}
              className="underline hover:text-slate-600 cursor-pointer"
            >
              週末
            </button>
          </div>
        </div>
      );
    }

    // 2〜14日分（サイクルまたはくり返し）
    return (
      <div className="flex flex-wrap items-center gap-1">
        {Array.from({ length: daysCount }, (_, i) => {
          const isSelected = targetDays.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onToggleDay(i)}
              className={`h-6 px-2 rounded-md text-[11px] font-bold transition cursor-pointer ${
                isSelected ? `${activeChip} shadow-2xs` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Day {i + 1}
            </button>
          );
        })}
        <div className="flex items-center gap-1 ml-1 text-[10px] text-slate-400">
          <button
            type="button"
            onClick={() => onSetAllDays(Array.from({ length: daysCount }, (_, i) => i))}
            className="underline hover:text-slate-600 cursor-pointer"
          >
            全Day
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

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

      const table = createDailyRoutineTable({
        name: dailyName || '日課ルーティン',
        daysCount: dailyDaysCount,
        isRepeat: dailyIsRepeat,
        repeatStartDay: dailyRepeatStartDay,
        dailyRepeatCount,
        timeRange: {
          startTime: finalStartTime,
          endTime: finalEndTime,
        },
        multiTasks: {
          items: multiTasks.map((t) => ({
            title: t.title.trim() || '日課',
            durationMinutes: t.durationMinutes > 0 ? t.durationMinutes : 15,
            startTime: t.startTime.trim() || undefined,
            targetDays:
              t.targetDays && t.targetDays.length > 0
                ? t.targetDays
                : Array.from({ length: dailyDaysCount }, (_, i) => i),
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
    } else if (category === 'weekly') {
      const table = createWeeklyTaskTable({
        name: weeklyName || '今週のタスク',
        title: weeklyTasks[0]?.title || '週タスク',
        durationMinutes: weeklyTasks[0]?.durationMinutes || 60,
        expiryWeeks: weeklyExpiryWeeks,
        daysCount: weeklyDaysCount,
        isRepeat: weeklyIsRepeat,
        repeatStartDay: weeklyRepeatStartDay,
        multiTasks: {
          items: weeklyTasks.map((t) => ({
            title: t.title.trim() || '週タスク',
            durationMinutes: t.durationMinutes > 0 ? t.durationMinutes : 60,
            weeklyCount: t.weeklyCount || 1,
            targetDays:
              t.targetDays && t.targetDays.length > 0
                ? t.targetDays
                : Array.from({ length: weeklyDaysCount }, (_, i) => i),
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
      const defaultDays = Array.from({ length: fixedDaysCount }, (_, i) => i);

      const table = createFixedSlotTable({
        name: fixedName || '固定枠',
        title: fixedSlots[0]?.title || '固定枠',
        startTime: fixedSlots[0]?.startTime || '00:00',
        endTime: fixedSlots[0]?.endTime || '08:00',
        daysCount: fixedDaysCount,
        isRepeat: fixedIsRepeat,
        repeatStartDay: fixedRepeatStartDay,
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-2 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex max-h-[calc(100dvh-2.5rem)] sm:max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
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
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* ========================================================
              1. 日課（Daily）設定
             ======================================================== */}
          {category === 'daily' && (
            <div className="space-y-4">
              {/* 【ステップ 1】表の名前は何にしますか？ */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-black text-blue-700">
                    1
                  </span>
                  <span>表の名前は何にしますか？</span>
                </label>
                <input
                  type="text"
                  value={dailyName}
                  onChange={(e) => setDailyName(e.target.value)}
                  placeholder="例: 朝ルーティン、英語学習、筋トレ習慣"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>

              {/* 【ステップ 2】活動時間帯 */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">
                      2
                    </span>
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
                      className={`rounded-lg border py-1.5 px-2 text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
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

              {/* 【ステップ 3】予定・タスクの登録 */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs space-y-0">
                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">
                      3
                    </span>
                    <span>予定の名称と所要時間を登録してください</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    ※ 空きコマに自動配分されます
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {multiTasks.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 hover:bg-slate-50/50 transition space-y-2"
                    >
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        {/* 項目名 */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                          <span className="text-xs font-bold text-slate-400 w-5 shrink-0 text-center">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateTaskItem(item.id, { title: e.target.value })}
                            placeholder={`例: ${idx === 0 ? 'ストレッチ' : idx === 1 ? '読書' : 'タスク名'}`}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>

                        {/* 所要時間ステッパー */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-medium text-slate-500">1タスク当たり:</span>
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
                        <button
                          type="button"
                          onClick={() => handleRemoveTaskItem(item.id)}
                          disabled={multiTasks.length <= 1}
                          aria-label="削除"
                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 transition ml-auto cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* 設定する日（2日以上のサイクル設定時のみ表示） */}
                      {dailyDaysCount > 1 && (
                        <div className="ml-6 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-[11px] font-bold text-slate-600 shrink-0">
                            設定する日:
                          </span>
                          {renderDayChips(
                            'blue',
                            dailyDaysCount,
                            dailyIsRepeat,
                            item.targetDays || [],
                            (day) => toggleDailyTaskDay(item.id, day),
                            (days) => handleUpdateTaskItem(item.id, { targetDays: days }),
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* テーブルフッターアクション */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                  <button
                    type="button"
                    onClick={handleAddTaskItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-blue-400 bg-white text-xs font-bold text-blue-700 hover:bg-blue-50 transition active:scale-95 shadow-2xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>項目を追加</span>
                  </button>
                </div>
              </div>

              {/* コア機能の説明 */}
              <div className="flex items-center gap-2 rounded-xl bg-blue-50/60 p-2.5 text-xs text-blue-900 border border-blue-100">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  指定した活動時間帯の中で、空いているコマに自動配置されます。
                </div>
              </div>

              {/* 詳細設定アコーディオン */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsOpenDailyAdvanced(!isOpenDailyAdvanced)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                    <span>詳細オプション（回数制限・サイクル日数）</span>
                  </div>
                  {isOpenDailyAdvanced ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpenDailyAdvanced && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4 animate-in fade-in duration-150">
                    {/* 1日の実施回数 */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-800">1日に何回行いますか？</div>
                        <div className="text-[10px] text-slate-500">
                          通常は1日1回。「自動配分」を選ぶと空きコマに可能な限り複数回配置します
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDailyRepeatCount(1)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                            dailyRepeatCount === 1
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          1日1回
                        </button>
                        <button
                          type="button"
                          onClick={() => setDailyRepeatCount('auto')}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                            dailyRepeatCount === 'auto'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          自動配分
                        </button>
                        {dailyRepeatCount !== 1 && dailyRepeatCount !== 'auto' && (
                          <NumberStepper
                            value={dailyRepeatCount}
                            onChange={(val) => setDailyRepeatCount(val)}
                            min={1}
                            max={12}
                            step={1}
                            unit="回"
                            ariaLabel="1日の実施回数"
                          />
                        )}
                      </div>
                    </div>

                    {/* サイクル・日数設定（変更したい人のみ） */}
                    <div className="pt-3 border-t border-slate-200/60">
                      <div className="text-xs font-bold text-slate-700 mb-2">日数・サイクル設定（特殊なローテーション等）</div>
                      {renderDaysAndRepeatSelector(
                        'blue',
                        dailyDaysCount,
                        (val) => {
                          setDailyDaysCount(val);
                          setMultiTasks((prev) =>
                            prev.map((t) => ({
                              ...t,
                              targetDays: (t.targetDays || []).filter((d) => d < val),
                            })),
                          );
                        },
                        dailyIsRepeat,
                        setDailyIsRepeat,
                        dailyRepeatStartDay,
                        setDailyRepeatStartDay,
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
              {/* 【ステップ 1】表の名前は何にしますか？ */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-700">
                    1
                  </span>
                  <span>表の名前は何にしますか？</span>
                </label>
                <input
                  type="text"
                  value={weeklyName}
                  onChange={(e) => setWeeklyName(e.target.value)}
                  placeholder="例: 今週の課題セット、週末家事、プロジェクト作業"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              {/* 【ステップ 2】今週こなしたいタスクの登録 */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs space-y-0">
                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">
                      2
                    </span>
                    <span>今週こなしたいタスクと目標回数を登録してください</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    ※ 空き枠の多い曜日に自動バランス配置
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {weeklyTasks.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 hover:bg-slate-50/50 transition space-y-2"
                    >
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        {/* 項目名 */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                          <span className="text-xs font-bold text-slate-400 w-5 shrink-0 text-center">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateWeeklyTask(item.id, { title: e.target.value })}
                            placeholder={`例: ${idx === 0 ? 'レポート課題' : idx === 1 ? 'ジム・筋トレ' : '部屋の掃除'}`}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 font-bold focus:border-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        {/* 所要時間ステッパー */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-medium text-slate-500">1回当たり:</span>
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

                        {/* 週あたりの目標回数ステッパー */}
                        <div className="flex items-center gap-1.5 shrink-0 bg-emerald-50/60 px-2 py-0.5 rounded-lg border border-emerald-200">
                          <span className="text-[11px] font-bold text-emerald-800">週:</span>
                          <NumberStepper
                            value={item.weeklyCount ?? 1}
                            onChange={(val) => handleUpdateWeeklyTask(item.id, { weeklyCount: val })}
                            min={1}
                            max={7}
                            step={1}
                            unit="回"
                            ariaLabel={`タスク${idx + 1}の週目標回数`}
                          />
                        </div>

                        {/* 削除ボタン */}
                        <button
                          type="button"
                          onClick={() => handleRemoveWeeklyTask(item.id)}
                          disabled={weeklyTasks.length <= 1}
                          aria-label="削除"
                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 transition ml-auto cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* 希望曜日（Dayチップ） */}
                      <div className="ml-6 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          配置希望:
                        </span>
                        {renderDayChips(
                          'emerald',
                          weeklyDaysCount,
                          weeklyIsRepeat,
                          item.targetDays || [],
                          (day) => toggleWeeklyTaskDay(item.id, day),
                          (days) => handleUpdateWeeklyTask(item.id, { targetDays: days }),
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                  <button
                    type="button"
                    onClick={handleAddWeeklyTask}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-emerald-400 bg-white text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition active:scale-95 shadow-2xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>タスクを追加</span>
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
                  各タスクの<strong>「週の目標回数」</strong>に合わせて、空いているコマが多い曜日にバランスよく前倒し配置されます。
                </div>
              </div>

              {/* 詳細設定アコーディオン */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsOpenWeeklyAdvanced(!isOpenWeeklyAdvanced)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                    <span>詳細オプション（有効期限・着手可能日時）</span>
                  </div>
                  {isOpenWeeklyAdvanced ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpenWeeklyAdvanced && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/40">

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
                            className={`rounded-xl border py-1.5 text-xs font-bold transition cursor-pointer ${
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
                          className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                        >
                          {weeklyHasConstraint ? '指定を解除' : '+ 開始日時を指定する'}
                        </button>
                      </div>

                      {weeklyHasConstraint && (
                        <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                          <select
                            value={weeklyStartDay}
                            onChange={(e) => setWeeklyStartDay(Number(e.target.value))}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer"
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

                    {/* 日数・周期設定（特殊な期間にしたい人のみ） */}
                    <div className="pt-3 border-t border-slate-200/60">
                      <div className="text-xs font-bold text-slate-700 mb-2">日数・サイクル設定（特殊な期間等）</div>
                      {renderDaysAndRepeatSelector(
                        'emerald',
                        weeklyDaysCount,
                        (val) => {
                          setWeeklyDaysCount(val);
                          setWeeklyTasks((prev) =>
                            prev.map((t) => ({
                              ...t,
                              targetDays: (t.targetDays || []).filter((d) => d < val),
                            })),
                          );
                        },
                        weeklyIsRepeat,
                        setWeeklyIsRepeat,
                        weeklyRepeatStartDay,
                        setWeeklyRepeatStartDay,
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

              {/* 【ステップ 2】予定と時間帯を登録してください */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs space-y-0">
                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] font-black text-white">
                      2
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
                    const isNextDay = endM <= startM;
                    if (isNextDay) endM += 1440;
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
                            <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 flex items-center gap-1 shrink-0">
                              {isNextDay && <span className="bg-purple-200 text-purple-900 px-1 rounded text-[9px]">翌日</span>}
                              <span>{durationLabel}</span>
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
                          {renderDayChips(
                            'purple',
                            fixedDaysCount,
                            fixedIsRepeat,
                            item.targetDays || [],
                            (day) => toggleFixedSlotDay(item.id, day),
                            (days) => handleUpdateFixedSlot(item.id, { targetDays: days }),
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

              {/* 詳細設定アコーディオン */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsOpenFixedAdvanced(!isOpenFixedAdvanced)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                    <span>詳細オプション（交代勤務・日数サイクル設定）</span>
                  </div>
                  {isOpenFixedAdvanced ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpenFixedAdvanced && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3 animate-in fade-in duration-150">
                    <div className="text-xs font-bold text-slate-700 mb-2">日数・サイクル設定（2〜14日の交代勤務等）</div>
                    {renderDaysAndRepeatSelector(
                      'purple',
                      fixedDaysCount,
                      (val) => {
                        setFixedDaysCount(val);
                        setFixedSlots((prev) =>
                          prev.map((s) => ({
                            ...s,
                            targetDays: (s.targetDays || []).filter((d) => d < val),
                          })),
                        );
                      },
                      fixedIsRepeat,
                      setFixedIsRepeat,
                      fixedRepeatStartDay,
                      setFixedRepeatStartDay,
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            <span>{targetTable ? 'この表に設定を適用' : 'この内容で表を作成'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
