'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Settings,
} from 'lucide-react';
import { ImportedTableData } from '@/types';
import {
  createDailyRoutineTable,
  createWeeklyTaskTable,
  createFixedSlotTable,
  TemplateTaskItemInput,
  FixedSlotItemInput,
  DailyMenuItem,
} from '@/lib/templates/tableTemplates';
import { getTableClassification } from '@/lib/tableUtils';
import { NumberStepper } from './NumberStepper';
import { timeStringToMinutes } from '@/lib/timeUtils';

interface NewTableWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTable: (table: ImportedTableData, isEditMode?: boolean) => void;
  targetTable?: ImportedTableData | null;
}

export type DailyRepeatPattern = 'everyday' | 'weekdays' | 'cycle';

// 登録タスクモデル
export interface AddedTaskDraft {
  id: string;
  title: string;
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  targetDays?: number[];
  weeklyCount?: number;
  cycleDayIndex?: number;
}

const WEEKDAYS = [
  { dayIndex: 0, label: '月' },
  { dayIndex: 1, label: '火' },
  { dayIndex: 2, label: '水' },
  { dayIndex: 3, label: '木' },
  { dayIndex: 4, label: '金' },
  { dayIndex: 5, label: '土' },
  { dayIndex: 6, label: '日' },
];

export type TableTypeMode = 'daily' | 'weekly' | 'fixed';
export type TimeSlotOption = 'morning' | 'afternoon' | 'evening' | 'all' | 'custom_fixed';

// サジェスト候補チップデータ
interface SuggestionPreset {
  label: string;
  defaultDuration: number;
  fixedStartTime?: string;
  fixedEndTime?: string;
  weeklyCount?: number;
}

// テーマ定義（絵文字なし）
interface ThemeDefinition {
  id: string;
  label: string;
  defaultTableName: string;
  description: string;
  recommendedType: TableTypeMode;
  recommendedTimeSlot: TimeSlotOption;
  defaultTargetDays?: number[];
  suggestions: SuggestionPreset[];
}

const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'daily_routine',
    label: '毎日の習慣・日課',
    defaultTableName: '毎日の習慣',
    description: '読書、学習、ストレッチなど毎日続けたいこと',
    recommendedType: 'daily',
    recommendedTimeSlot: 'all',
    suggestions: [
      { label: '読書', defaultDuration: 20 },
      { label: '英語・学習', defaultDuration: 30 },
      { label: 'ストレッチ', defaultDuration: 15 },
      { label: '散歩', defaultDuration: 30 },
      { label: '日記・記録', defaultDuration: 10 },
      { label: '資格勉強', defaultDuration: 45 },
    ],
  },
  {
    id: 'morning_routine',
    label: '朝のルーティン',
    defaultTableName: '朝のルーティン',
    description: '朝食、読書、ストレッチなど朝の習慣',
    recommendedType: 'daily',
    recommendedTimeSlot: 'morning',
    suggestions: [
      { label: '朝食', defaultDuration: 20 },
      { label: '読書', defaultDuration: 20 },
      { label: 'ストレッチ', defaultDuration: 15 },
      { label: '散歩', defaultDuration: 30 },
      { label: '英語・語学', defaultDuration: 30 },
      { label: '瞑想', defaultDuration: 10 },
    ],
  },
  {
    id: 'evening_routine',
    label: '夜の生活習慣',
    defaultTableName: '夜の生活習慣',
    description: '夕食、入浴、明日の準備、就寝前ケア',
    recommendedType: 'daily',
    recommendedTimeSlot: 'evening',
    suggestions: [
      { label: '夕食', defaultDuration: 45 },
      { label: '入浴', defaultDuration: 30 },
      { label: 'ストレッチ', defaultDuration: 15 },
      { label: '明日の準備・手帳', defaultDuration: 15 },
      {
        label: '睡眠',
        defaultDuration: 480,
        fixedStartTime: '23:00',
        fixedEndTime: '07:00',
      },
    ],
  },
  {
    id: 'class_schedule',
    label: '授業・講義の時間割',
    defaultTableName: '授業の時間割',
    description: '大学や学校の曜日ごとの講義・コマ',
    recommendedType: 'fixed',
    recommendedTimeSlot: 'custom_fixed',
    defaultTargetDays: [0], // 曜日ごとの時間割のため初期値は月曜のみ
    suggestions: [
      {
        label: '講義・授業',
        defaultDuration: 90,
        fixedStartTime: '09:00',
        fixedEndTime: '10:30',
      },
      {
        label: 'ゼミ・演習',
        defaultDuration: 90,
        fixedStartTime: '13:00',
        fixedEndTime: '14:30',
      },
      {
        label: '実験・実習',
        defaultDuration: 90,
        fixedStartTime: '14:40',
        fixedEndTime: '16:10',
      },
      { label: '自習・空きコマ', defaultDuration: 60, fixedStartTime: '10:40', fixedEndTime: '12:10' },
    ],
  },
  {
    id: 'work_shift',
    label: 'お仕事・アルバイト',
    defaultTableName: '勤務・シフト予定',
    description: '会社勤務、アルバイト、シフト予定',
    recommendedType: 'fixed',
    recommendedTimeSlot: 'custom_fixed',
    defaultTargetDays: [0, 1, 2, 3, 4], // 平日
    suggestions: [
      {
        label: '会社勤務',
        defaultDuration: 480,
        fixedStartTime: '09:00',
        fixedEndTime: '18:00',
      },
      {
        label: 'アルバイト',
        defaultDuration: 240,
        fixedStartTime: '17:00',
        fixedEndTime: '21:00',
      },
      {
        label: 'シフト勤務',
        defaultDuration: 480,
        fixedStartTime: '09:00',
        fixedEndTime: '17:00',
      },
    ],
  },
  {
    id: 'fitness',
    label: 'フィットネス・健康',
    defaultTableName: 'フィットネス・運動習慣',
    description: 'ジム、筋トレ、ランニング、健康管理',
    recommendedType: 'weekly',
    recommendedTimeSlot: 'all',
    suggestions: [
      { label: 'ジム・筋トレ', defaultDuration: 60, weeklyCount: 2 },
      { label: 'ジョギング・ランニング', defaultDuration: 45, weeklyCount: 2 },
      { label: '全身ストレッチ', defaultDuration: 20, weeklyCount: 3 },
      { label: '散歩・ウォーキング', defaultDuration: 30, weeklyCount: 3 },
    ],
  },
  {
    id: 'weekly_goal',
    label: '今週の目標・ノルマ',
    defaultTableName: '今週の目標・課題',
    description: 'レポート、掃除、買い出し、資格勉強',
    recommendedType: 'weekly',
    recommendedTimeSlot: 'all',
    suggestions: [
      { label: 'レポート課題', defaultDuration: 90, weeklyCount: 1 },
      { label: '部屋の掃除', defaultDuration: 45, weeklyCount: 1 },
      { label: '買い出し・買い物', defaultDuration: 45, weeklyCount: 1 },
      { label: '資格・スキル学習', defaultDuration: 60, weeklyCount: 3 },
    ],
  },
  {
    id: 'life_rhythm',
    label: '基本生活リズム',
    defaultTableName: '基本生活リズム',
    description: '睡眠、食事、休憩などの基本フレーム',
    recommendedType: 'fixed',
    recommendedTimeSlot: 'custom_fixed',
    defaultTargetDays: [0, 1, 2, 3, 4, 5, 6],
    suggestions: [
      {
        label: '睡眠',
        defaultDuration: 480,
        fixedStartTime: '23:00',
        fixedEndTime: '07:00',
      },
      { label: '朝食', defaultDuration: 20 },
      { label: '昼食', defaultDuration: 40 },
      { label: '夕食', defaultDuration: 45 },
      { label: '入浴', defaultDuration: 30 },
    ],
  },
  {
    id: 'custom',
    label: '自由に入力',
    defaultTableName: '',
    description: '表の名前やルールを自分で自由に決めて作成',
    recommendedType: 'daily',
    recommendedTimeSlot: 'all',
    suggestions: [
      { label: '読書', defaultDuration: 20 },
      { label: 'ストレッチ', defaultDuration: 15 },
      { label: 'ジム・筋トレ', defaultDuration: 60, weeklyCount: 2 },
      { label: 'レポート課題', defaultDuration: 90, weeklyCount: 1 },
    ],
  },
];

export function NewTableWizardModal({
  isOpen,
  onClose,
  onApplyTable,
  targetTable,
}: NewTableWizardModalProps) {
  // 編集モードから「白紙から新しく作る」への切り替えフラグ
  const [isResetToNew, setIsResetToNew] = useState(false);
  // おすすめテーマ雛形アコーディオンの開閉
  const [showThemePresets, setShowThemePresets] = useState(false);

  const effectiveIsEdit = Boolean(targetTable) && !isResetToNew;

  // ==========================================
  // Step 1: 表の設定ステート
  // ==========================================
  const [selectedThemeId, setSelectedThemeId] = useState<string>('daily_routine');
  const [tableName, setTableName] = useState<string>('毎日の習慣');
  const [tableType, setTableType] = useState<TableTypeMode>('daily');
  const [timeSlot, setTimeSlot] = useState<TimeSlotOption>('all');

  // Plan29: 日課（daily）の繰り返しペース（毎日 / 曜日固定 / ○日周期）
  const [dailyRepeatPattern, setDailyRepeatPattern] = useState<DailyRepeatPattern>('everyday');
  const [dailyTargetDays, setDailyTargetDays] = useState<number[]>([0, 1, 2, 3, 4]); // 曜日固定時の初期値（平日）
  const [dailyCycleLength, setDailyCycleLength] = useState<number>(3); // 3日周期など
  const [dailyCycleStartDay, setDailyCycleStartDay] = useState<number>(0); // 開始曜日 (0:月〜6:日)

  // 固定枠の場合の時間帯
  const [fixedStartTime, setFixedStartTime] = useState('09:00');
  const [fixedEndTime, setFixedEndTime] = useState('10:30');

  // ==========================================
  // Step 2: 具体タスクの入力ステート
  // ==========================================
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState(20);
  const [taskWeeklyCount, setTaskWeeklyCount] = useState(2);
  // 固定枠個別タスク用
  const [taskStartTime, setTaskStartTime] = useState('09:00');
  const [taskEndTime, setTaskEndTime] = useState('10:30');
  const [taskTargetDays, setTaskTargetDays] = useState<number[]>([0]);
  // サイクル日課用: 現在追加対象のDay (0: Day 1, 1: Day 2...)
  const [taskCycleDay, setTaskCycleDay] = useState<number>(0);

  // 登録済みタスクリスト
  const [draftTasks, setDraftTasks] = useState<AddedTaskDraft[]>([]);

  // Plan30: targetTable または isOpen の変化時にフォーム初期値を設定（Pre-fill）
  useEffect(() => {
    if (!isOpen) return;

    setIsResetToNew(false);
    setShowThemePresets(false);

    if (targetTable) {
      // 既存表からの復元（編集モード）
      const classification = getTableClassification(targetTable);
      const mappedType: TableTypeMode =
        classification === 'fixed_slot'
          ? 'fixed'
          : classification === 'weekly_task'
            ? 'weekly'
            : 'daily';

      setTableName(targetTable.name || 'スケジュール表');
      setTableType(mappedType);

      // 時間帯の判定
      const sTime = targetTable.axisConfig.startTime || '';
      const eTime = targetTable.axisConfig.endTime || '';
      if (sTime === '06:00' && eTime === '12:00') {
        setTimeSlot('morning');
      } else if (sTime === '12:00' && eTime === '18:00') {
        setTimeSlot('afternoon');
      } else if (sTime === '18:00' && eTime === '23:00') {
        setTimeSlot('evening');
      } else {
        setTimeSlot('all');
      }

      // 日課のペース判定
      if (mappedType === 'daily') {
        if (targetTable.columnMode === 'weekday') {
          setDailyRepeatPattern('weekdays');
        } else if (targetTable.columnMode === 'cycle' && (targetTable.numCols || 1) > 1) {
          setDailyRepeatPattern('cycle');
          setDailyCycleLength(targetTable.numCols || 3);
          setDailyCycleStartDay(targetTable.cycleStartDay ?? 0);
        } else {
          setDailyRepeatPattern('everyday');
        }
      }

      if (mappedType === 'fixed') {
        setFixedStartTime(sTime || '09:00');
        setFixedEndTime(eTime || '10:30');
      }

      // 既存セルのタスクを抽出して draftTasks に復元
      const taskMap = new Map<string, AddedTaskDraft>();

      if (targetTable.cells) {
        targetTable.cells.forEach((row, rIdx) => {
          row?.forEach((cell, cIdx) => {
            if (!cell) return;
            const title = (cell.title || cell.text || '').trim();
            if (!title) return;

            const dur = cell.customDurationMinutes || targetTable.axisConfig.periodMinutes || 20;
            const key =
              mappedType === 'daily' && targetTable.columnMode === 'cycle' && (targetTable.numCols || 1) > 1
                ? `${title}__day_${cIdx}`
                : title;

            if (taskMap.has(key)) {
              const existing = taskMap.get(key)!;
              if (existing.targetDays && !existing.targetDays.includes(cIdx)) {
                existing.targetDays.push(cIdx);
                existing.targetDays.sort((a, b) => a - b);
              }
            } else {
              const draft: AddedTaskDraft = {
                id: `edit-${rIdx}-${cIdx}-${title}`,
                title,
                durationMinutes: dur,
                startTime: cell.customStartTime || sTime || '09:00',
                endTime: cell.endMinutes
                  ? `${String(Math.floor(cell.endMinutes / 60)).padStart(2, '0')}:${String(cell.endMinutes % 60).padStart(2, '0')}`
                  : eTime || '10:30',
                targetDays: [cIdx],
                weeklyCount: cell.targetWeeklyCount || (typeof targetTable.weeklyRepeatCount === 'number' ? targetTable.weeklyRepeatCount : 1),
                cycleDayIndex: cIdx,
              };
              taskMap.set(key, draft);
            }
          });
        });
      }

      setDraftTasks(Array.from(taskMap.values()));
    } else {
      // 新規作成モード
      setSelectedThemeId('daily_routine');
      setTableName('毎日の習慣');
      setTableType('daily');
      setTimeSlot('all');
      setDailyRepeatPattern('everyday');
      setDailyTargetDays([0, 1, 2, 3, 4]);
      setDailyCycleLength(3);
      setDailyCycleStartDay(0);
      setFixedStartTime('09:00');
      setFixedEndTime('10:30');
      setDraftTasks([]);
    }
  }, [isOpen, targetTable]);

  // タスク所要時間のクイック更新（Plan30）
  const handleUpdateTaskDuration = (taskId: string, newDuration: number) => {
    setDraftTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, durationMinutes: Math.max(5, newDuration) } : t))
    );
  };

  // 現在選択中のテーマオブジェクト
  const currentTheme = useMemo(() => {
    return THEME_DEFINITIONS.find(t => t.id === selectedThemeId) || THEME_DEFINITIONS[0];
  }, [selectedThemeId]);

  // テーマ切り替えハンドラ（表名・タイプ・時間帯・初期曜日を連動初期化）
  const handleSelectTheme = (theme: ThemeDefinition) => {
    setSelectedThemeId(theme.id);
    setTableName(theme.defaultTableName);
    setTableType(theme.recommendedType);
    setTimeSlot(theme.recommendedTimeSlot);

    const initialDays = theme.defaultTargetDays || [0];
    setTaskTargetDays(initialDays);

    if (theme.suggestions[0]) {
      setTaskDuration(theme.suggestions[0].defaultDuration);
      if (theme.suggestions[0].weeklyCount) {
        setTaskWeeklyCount(theme.suggestions[0].weeklyCount);
      }
      if (theme.suggestions[0].fixedStartTime) {
        setTaskStartTime(theme.suggestions[0].fixedStartTime);
        setFixedStartTime(theme.suggestions[0].fixedStartTime);
      }
      if (theme.suggestions[0].fixedEndTime) {
        setTaskEndTime(theme.suggestions[0].fixedEndTime);
        setFixedEndTime(theme.suggestions[0].fixedEndTime);
      }
    }
  };

  // サジェストチップのタップ時（ワンタップ入力）
  const handleApplySuggestion = (s: SuggestionPreset) => {
    setTaskTitle(s.label);
    setTaskDuration(s.defaultDuration);
    if (s.weeklyCount) {
      setTaskWeeklyCount(s.weeklyCount);
    }
    if (s.fixedStartTime) {
      setTaskStartTime(s.fixedStartTime);
    }
    if (s.fixedEndTime) {
      setTaskEndTime(s.fixedEndTime);
    }
  };

  // タスクをリストに追加
  const handleAddTask = () => {
    const trimmed = taskTitle.trim();
    if (!trimmed) return;

    const newTask: AddedTaskDraft = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      title: trimmed,
      durationMinutes: tableType === 'fixed' ? 60 : taskDuration,
      startTime: tableType === 'fixed' ? taskStartTime : undefined,
      endTime: tableType === 'fixed' ? taskEndTime : undefined,
      targetDays:
        tableType === 'fixed'
          ? taskTargetDays
          : tableType === 'daily' && dailyRepeatPattern === 'weekdays'
            ? taskTargetDays
            : undefined,
      weeklyCount: tableType === 'weekly' ? taskWeeklyCount : undefined,
      cycleDayIndex:
        tableType === 'daily' && dailyRepeatPattern === 'cycle' ? taskCycleDay : undefined,
    };

    setDraftTasks(prev => [...prev, newTask]);
    setTaskTitle('');

    // サイクル日課の場合、タスクを追加したら自動的に次のDayへ進める（Day 1 ➔ Day 2 ➔ Day 3...）
    if (tableType === 'daily' && dailyRepeatPattern === 'cycle') {
      setTaskCycleDay(prev => (prev + 1) % dailyCycleLength);
    }
  };

  // タスク削除
  const handleDeleteDraftTask = (id: string) => {
    setDraftTasks(prev => prev.filter(t => t.id !== id));
  };

  // 日またぎ判定
  const isOvernight = useMemo(() => {
    if (tableType !== 'fixed' || !taskStartTime || !taskEndTime) return false;
    return timeStringToMinutes(taskEndTime) < timeStringToMinutes(taskStartTime);
  }, [tableType, taskStartTime, taskEndTime]);

  // 表の構築＆反映（asNewTable: true なら新しい表として別名保存）
  const handleBuildTable = (asNewTable = false) => {
    if (draftTasks.length === 0) return;

    const finalTableName = tableName.trim() || currentTheme.defaultTableName || '新しいスケジュール表';

    let generatedTable: ImportedTableData;

    if (tableType === 'fixed') {
      // 固定枠表の生成
      const items: FixedSlotItemInput[] = draftTasks.map(t => ({
        title: t.title,
        startTime: t.startTime || fixedStartTime || '09:00',
        endTime: t.endTime || fixedEndTime || '10:30',
        targetDays: t.targetDays || [0],
      }));

      generatedTable = createFixedSlotTable({
        name: finalTableName,
        multiSlots: { items },
        daysCount: 7,
        repeatStartDay: 0,
      });
    } else if (tableType === 'weekly') {
      // 週次タスク表の生成
      const items: TemplateTaskItemInput[] = draftTasks.map(t => ({
        title: t.title,
        durationMinutes: t.durationMinutes,
        weeklyCount: t.weeklyCount || 1,
      }));

      generatedTable = createWeeklyTaskTable({
        name: finalTableName,
        daysCount: 7,
        isRepeat: false,
        multiTasks: { items },
      });
    } else {
      // 日課表の生成
      // 活動時間帯
      let slotStartTime: string | null = null;
      let slotEndTime: string | null = null;
      if (timeSlot === 'morning') {
        slotStartTime = '06:00';
        slotEndTime = '12:00';
      } else if (timeSlot === 'afternoon') {
        slotStartTime = '12:00';
        slotEndTime = '18:00';
      } else if (timeSlot === 'evening') {
        slotStartTime = '18:00';
        slotEndTime = '23:00';
      }

      if (dailyRepeatPattern === 'cycle') {
        // N日サイクルローテーション日課表（Day 1, Day 2, ..., Day N）
        const cycleItems: (DailyMenuItem | null)[] = Array.from(
          { length: dailyCycleLength },
          (_, c) => {
            const matchedTask = draftTasks.find(t => t.cycleDayIndex === c);
            return matchedTask
              ? { title: matchedTask.title, durationMinutes: matchedTask.durationMinutes }
              : null;
          },
        );

        generatedTable = createDailyRoutineTable({
          name: finalTableName,
          mode: 'cycle_rotation',
          cycleRotation: {
            cycleLength: dailyCycleLength,
            cycleStartDay: dailyCycleStartDay,
            items: cycleItems,
            defaultDurationMinutes: 30,
          },
          dailyRepeatCount: 1,
          timeRange: { startTime: slotStartTime, endTime: slotEndTime },
        });
      } else if (dailyRepeatPattern === 'weekdays') {
        // 曜日固定日課表（月曜〜日曜、指定曜日のみ配置）
        const items: TemplateTaskItemInput[] = draftTasks.map(t => ({
          title: t.title,
          durationMinutes: t.durationMinutes,
          targetDays: t.targetDays && t.targetDays.length > 0 ? t.targetDays : dailyTargetDays,
        }));

        generatedTable = createDailyRoutineTable({
          name: finalTableName,
          daysCount: 7,
          isRepeat: false,
          multiTasks: {
            items,
            targetDays: dailyTargetDays,
          },
          dailyRepeatCount: 1,
          timeRange: { startTime: slotStartTime, endTime: slotEndTime },
        });
      } else {
        // 毎日同じ（シンプル日課表）
        const items: TemplateTaskItemInput[] = draftTasks.map(t => ({
          title: t.title,
          durationMinutes: t.durationMinutes,
        }));

        generatedTable = createDailyRoutineTable({
          name: finalTableName,
          daysCount: 1,
          isRepeat: true,
          multiTasks: { items },
          dailyRepeatCount: 1,
          timeRange: { startTime: slotStartTime, endTime: slotEndTime },
        });
      }
    }

    // 既存表の上書き保存か、新規/別名保存かの判定
    const isOverwritingExisting = effectiveIsEdit && !asNewTable;

    if (isOverwritingExisting && targetTable) {
      generatedTable.id = targetTable.id;
      onApplyTable(generatedTable, true);
    } else {
      // 新しい表として保存（新しいID発行）
      onApplyTable(generatedTable, false);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[calc(100dvh-2.5rem)] sm:max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200/90 bg-gradient-to-r from-indigo-50/70 via-sky-50/40 to-slate-50 px-4 sm:px-5 py-3 sm:py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {effectiveIsEdit ? `簡単設定: ${tableName}` : '簡単設定（予定表の作成）'}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500">
                {effectiveIsEdit
                  ? '表全体のルールや活動時間帯、登録タスクの所要時間を調整できます'
                  : '表の基本ルールを決め、タスクを流し込むだけでスケジュール表が完成します'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {effectiveIsEdit && (
              <button
                type="button"
                onClick={() => {
                  setIsResetToNew(true);
                  setSelectedThemeId('daily_routine');
                  setTableName('新しい予定表');
                  setTableType('daily');
                  setTimeSlot('all');
                  setDailyRepeatPattern('everyday');
                  setDailyTargetDays([0, 1, 2, 3, 4]);
                  setDailyCycleLength(3);
                  setDailyCycleStartDay(0);
                  setFixedStartTime('09:00');
                  setFixedEndTime('10:30');
                  setDraftTasks([]);
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 sm:px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-2xs"
                title="現在の表の内容をクリアし、白紙から新しい予定表を作成します"
              >
                <Plus className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">白紙から新しく作る</span>
                <span className="sm:hidden">白紙</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* スクロール本体 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs text-slate-700">
          {/* ========================================================
              Step 1: 表の設定（全体枠・基本ルールの決定）
              ======================================================== */}
          <div className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white shadow-2xs">
                1
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  表の設定（スケジューリング枠組の調整）
                </h4>
                <p className="text-[10px] text-slate-500">
                  表の分類や活動時間帯、繰り返しペースを設定できます
                </p>
              </div>
            </div>

            {/* A. 表のスケジュール分類（常時選択可能） */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">
                  表のスケジュール分類
                </label>
                <button
                  type="button"
                  onClick={() => setShowThemePresets(prev => !prev)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{showThemePresets ? 'テーマ候補を閉じる' : 'おすすめテーマから入力'}</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTableType('daily')}
                  className={`py-2 px-2.5 rounded-xl border text-center transition cursor-pointer text-xs ${
                    tableType === 'daily'
                      ? 'border-amber-500 bg-amber-50/90 text-amber-900 font-bold shadow-2xs ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  日課（ルーティン）
                </button>
                <button
                  type="button"
                  onClick={() => setTableType('weekly')}
                  className={`py-2 px-2.5 rounded-xl border text-center transition cursor-pointer text-xs ${
                    tableType === 'weekly'
                      ? 'border-blue-500 bg-blue-50/90 text-blue-900 font-bold shadow-2xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  週次タスク
                </button>
                <button
                  type="button"
                  onClick={() => setTableType('fixed')}
                  className={`py-2 px-2.5 rounded-xl border text-center transition cursor-pointer text-xs ${
                    tableType === 'fixed'
                      ? 'border-emerald-500 bg-emerald-50/90 text-emerald-900 font-bold shadow-2xs ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  固定枠（時間割）
                </button>
              </div>

              {/* テーマ候補チップ（開閉式） */}
              {showThemePresets && (
                <div className="pt-2 pb-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    {THEME_DEFINITIONS.map(theme => {
                      const isSelected = selectedThemeId === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            handleSelectTheme(theme);
                            setShowThemePresets(false);
                          }}
                          className={`flex flex-col items-start p-2 rounded-lg border text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 bg-white shadow-xs ring-1 ring-indigo-500/20'
                              : 'border-slate-200 bg-white/80 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          <span className="font-bold text-xs text-slate-800">{theme.label}</span>
                          <span className="text-[10px] text-slate-400 line-clamp-1">
                            {theme.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* B. 表の表示名 */}
            <div className="flex items-center gap-2 pt-1 border-t border-indigo-100/60">
              <span className="text-[11px] font-bold text-slate-700 shrink-0">表の表示名:</span>
              <input
                type="text"
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                placeholder="例: 毎日の習慣、朝のルーティン、授業の時間割"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            {/* C. 表の基本ルール（タイプ ＆ 時間帯） */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-100/60">
              {/* スタイル・頻度 */}
              <div className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-700">予定のタイプ</span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTableType('daily');
                      if (timeSlot === 'custom_fixed') setTimeSlot('all');
                    }}
                    className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                      tableType === 'daily'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    毎日 (日課)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTableType('weekly');
                      if (timeSlot === 'custom_fixed') setTimeSlot('all');
                    }}
                    className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                      tableType === 'weekly'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    週◯回
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTableType('fixed');
                      setTimeSlot('custom_fixed');
                    }}
                    className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                      tableType === 'fixed'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    時間固定
                  </button>
                </div>
              </div>

              {/* 活動時間帯 */}
              <div className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-700">活動する時間帯</span>
                {tableType === 'fixed' ? (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <input
                      type="time"
                      value={fixedStartTime}
                      onChange={e => {
                        setFixedStartTime(e.target.value);
                        setTaskStartTime(e.target.value);
                      }}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                    <span className="text-slate-400">〜</span>
                    <input
                      type="time"
                      value={fixedEndTime}
                      onChange={e => {
                        setFixedEndTime(e.target.value);
                        setTaskEndTime(e.target.value);
                      }}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => setTimeSlot('morning')}
                      className={`rounded-lg py-1.5 text-[10px] font-bold transition cursor-pointer ${
                        timeSlot === 'morning'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      朝 (6-12)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeSlot('afternoon')}
                      className={`rounded-lg py-1.5 text-[10px] font-bold transition cursor-pointer ${
                        timeSlot === 'afternoon'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      昼 (12-18)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeSlot('evening')}
                      className={`rounded-lg py-1.5 text-[10px] font-bold transition cursor-pointer ${
                        timeSlot === 'evening'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      夜 (18-23)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeSlot('all')}
                      className={`rounded-lg py-1.5 text-[10px] font-bold transition cursor-pointer ${
                        timeSlot === 'all'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      終日
                    </button>
                  </div>
                )}
              </div>

              {/* Plan29: 日課（ルーティン）の場合のペース・サイクル質問 */}
              {tableType === 'daily' && (
                <div className="space-y-2 pt-2 border-t border-indigo-100/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">繰り返すペース</span>
                    <span className="text-[10px] text-slate-400">生活リズムに合わせて選択</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setDailyRepeatPattern('everyday')}
                      className={`rounded-lg py-1.5 px-1.5 text-[10px] font-bold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                        dailyRepeatPattern === 'everyday'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>毎日同じ</span>
                      <span className="text-[9px] opacity-80 font-normal">全曜日で実施</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyRepeatPattern('weekdays')}
                      className={`rounded-lg py-1.5 px-1.5 text-[10px] font-bold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                        dailyRepeatPattern === 'weekdays'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>曜日を指定</span>
                      <span className="text-[9px] opacity-80 font-normal">平日・月水金など</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyRepeatPattern('cycle')}
                      className={`rounded-lg py-1.5 px-1.5 text-[10px] font-bold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                        dailyRepeatPattern === 'cycle'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>○日周期で交代</span>
                      <span className="text-[9px] opacity-80 font-normal">筋トレ分割・ローテ</span>
                    </button>
                  </div>

                  {/* 曜日を指定する場合の曜日チップ ＆ プリセット */}
                  {dailyRepeatPattern === 'weekdays' && (
                    <div className="space-y-1.5 pt-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600">実施する曜日</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const days = [0, 1, 2, 3, 4];
                              setDailyTargetDays(days);
                              setTaskTargetDays(days);
                            }}
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            平日のみ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const days = [5, 6];
                              setDailyTargetDays(days);
                              setTaskTargetDays(days);
                            }}
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            週末のみ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const days = [0, 2, 4];
                              setDailyTargetDays(days);
                              setTaskTargetDays(days);
                            }}
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            月水金
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {WEEKDAYS.map(w => {
                          const isSelected = dailyTargetDays.includes(w.dayIndex);
                          return (
                            <button
                              key={w.dayIndex}
                              type="button"
                              onClick={() => {
                                let next: number[];
                                if (isSelected) {
                                  next = dailyTargetDays.length > 1 ? dailyTargetDays.filter(d => d !== w.dayIndex) : dailyTargetDays;
                                } else {
                                  next = [...dailyTargetDays, w.dayIndex].sort();
                                }
                                setDailyTargetDays(next);
                                setTaskTargetDays(next);
                              }}
                              className={`rounded py-1 text-xs font-bold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {w.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ○日周期で交代する場合のサイクル設定 */}
                  {dailyRepeatPattern === 'cycle' && (
                    <div className="space-y-2 pt-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-600">周期の長さ（サイクル日数）</span>
                          <p className="text-[9px] text-slate-400">何日ごとにループするか（例: 3分割筋トレなら3日）</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[2, 3, 4, 5, 6, 7].map(len => (
                            <button
                              key={len}
                              type="button"
                              onClick={() => setDailyCycleLength(len)}
                              className={`h-7 w-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                                dailyCycleLength === len
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {len}日
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600">Day 1 を開始する曜日</span>
                        <select
                          value={dailyCycleStartDay}
                          onChange={e => setDailyCycleStartDay(Number(e.target.value))}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          {WEEKDAYS.map(w => (
                            <option key={w.dayIndex} value={w.dayIndex}>
                              {w.label}曜日から開始
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================
              Step 2: 具体タスクの追加（爆速入力）
              ======================================================== */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white shadow-2xs">
                2
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  「{tableName || 'この表'}」に入れるタスクを追加
                </h4>
                <p className="text-[10px] text-slate-500">
                  候補をタップするか入力して「追加」を押してください（連続で複数追加できます）
                </p>
              </div>
            </div>

            {/* おすすめ候補チップ */}
            <div className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-500">
                おすすめの予定（タップしてワンタップ入力）:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentTheme.suggestions.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => handleApplySuggestion(s)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
                  >
                    <span>{s.label}</span>
                    <span className="text-[10px] text-slate-400">({s.defaultDuration}分)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 入力フォーム本体 */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200/80">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                  placeholder="タスク名を入力（例: 英語、読書、レポート作成）"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                />

                {/* 固定枠の場合の時間指定 */}
                {tableType === 'fixed' ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="time"
                      value={taskStartTime}
                      onChange={e => setTaskStartTime(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    />
                    <span className="text-slate-400">〜</span>
                    <input
                      type="time"
                      value={taskEndTime}
                      onChange={e => setTaskEndTime(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    />
                    {isOvernight && (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                        翌日
                      </span>
                    )}
                  </div>
                ) : (
                  /* 空きコマ配置の場合の所要時間 */
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-slate-500">時間:</span>
                    <NumberStepper
                      value={taskDuration}
                      onChange={val => setTaskDuration(val)}
                      min={5}
                      max={360}
                      step={5}
                      unit="分"
                      size="sm"
                    />
                  </div>
                )}

                {/* 週次の場合の週目標回数 */}
                {tableType === 'weekly' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-slate-500">週:</span>
                    <NumberStepper
                      value={taskWeeklyCount}
                      onChange={val => setTaskWeeklyCount(val)}
                      min={1}
                      max={7}
                      step={1}
                      unit="回"
                      size="sm"
                    />
                  </div>
                )}

                {/* 追加ボタン */}
                <button
                  type="button"
                  onClick={handleAddTask}
                  disabled={!taskTitle.trim()}
                  className={`flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs shrink-0 cursor-pointer ${
                    taskTitle.trim()
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-98'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  <span>追加</span>
                </button>
              </div>

              {/* 固定枠の場合の曜日指定（時間割向けに1曜日選択しやすいUI） */}
              {tableType === 'fixed' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">曜日:</span>
                    <div className="flex items-center gap-1">
                      {WEEKDAYS.map(w => {
                        const isSelected = taskTargetDays.includes(w.dayIndex);
                        return (
                          <button
                            key={w.dayIndex}
                            type="button"
                            onClick={() => {
                              // 単一曜日の切り替え、または複数トグル
                              if (isSelected) {
                                if (taskTargetDays.length > 1) {
                                  setTaskTargetDays(taskTargetDays.filter(d => d !== w.dayIndex));
                                }
                              } else {
                                setTaskTargetDays([...taskTargetDays, w.dayIndex].sort());
                              }
                            }}
                            className={`rounded px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-indigo-600 ml-auto">
                    <button
                      type="button"
                      onClick={() => setTaskTargetDays([0, 1, 2, 3, 4])}
                      className="px-1.5 py-0.5 rounded hover:bg-indigo-50 transition cursor-pointer"
                    >
                      平日 (月〜金)
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setTaskTargetDays([0, 1, 2, 3, 4, 5, 6])}
                      className="px-1.5 py-0.5 rounded hover:bg-indigo-50 transition cursor-pointer"
                    >
                      全日
                    </button>
                  </div>
                </div>
              )}

              {/* Plan29: 日課（曜日指定）の場合の曜日指定 */}
              {tableType === 'daily' && dailyRepeatPattern === 'weekdays' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">このタスクの曜日:</span>
                    <div className="flex items-center gap-1">
                      {WEEKDAYS.map(w => {
                        const isSelected = taskTargetDays.includes(w.dayIndex);
                        return (
                          <button
                            key={w.dayIndex}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (taskTargetDays.length > 1) {
                                  setTaskTargetDays(taskTargetDays.filter(d => d !== w.dayIndex));
                                }
                              } else {
                                setTaskTargetDays([...taskTargetDays, w.dayIndex].sort());
                              }
                            }}
                            className={`rounded px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    デフォルト: {dailyTargetDays.map(d => WEEKDAYS[d]?.label).join('')}
                  </span>
                </div>
              )}

              {/* Plan29: 日課（○日周期ローテーション）の場合の担当Day指定 */}
              {tableType === 'daily' && dailyRepeatPattern === 'cycle' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">担当する日:</span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: dailyCycleLength }, (_, i) => {
                        const isSelected = taskCycleDay === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setTaskCycleDay(i)}
                            className={`rounded px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            Day {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    追加すると自動で次のDayへ進みます
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================
              Step 3: 登録済みタスク一覧（プレビュー）
              ======================================================== */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900">
                登録されたタスク（{draftTasks.length}件）
              </label>
              {draftTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraftTasks([])}
                  className="text-[11px] text-slate-400 hover:text-rose-600 transition cursor-pointer"
                >
                  すべてクリア
                </button>
              )}
            </div>

            {draftTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
                <p className="text-xs">まだタスクが追加されていません</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  上のフォームまたはおすすめ候補からタスクを追加してください（複数追加できます）
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {draftTasks.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 border border-slate-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs text-slate-800 truncate">{t.title}</span>
                      {tableType === 'fixed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          {t.startTime}〜{t.endTime} ({t.targetDays?.map(d => WEEKDAYS[d]?.label).join('')})
                        </span>
                      )}
                      {tableType === 'daily' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          {dailyRepeatPattern === 'cycle'
                            ? `Day ${(t.cycleDayIndex ?? 0) + 1} (${t.durationMinutes}分)`
                            : dailyRepeatPattern === 'weekdays'
                              ? `${(t.targetDays || dailyTargetDays).map(d => WEEKDAYS[d]?.label).join('')} (${t.durationMinutes}分)`
                              : `毎日 ${t.durationMinutes}分`}{' '}
                          ({timeSlot === 'morning' ? '朝' : timeSlot === 'evening' ? '夜' : timeSlot === 'afternoon' ? '昼' : '終日'})
                        </span>
                      )}
                      {tableType === 'weekly' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          週{t.weeklyCount}回 ({t.durationMinutes}分)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {tableType !== 'fixed' && (
                        <div className="flex items-center gap-0.5 bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleUpdateTaskDuration(t.id, t.durationMinutes - 5)}
                            className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white rounded transition active:scale-95 cursor-pointer"
                            title="所要時間を5分減らす"
                          >
                            -5
                          </button>
                          <span className="text-[10px] font-bold text-slate-700 min-w-[32px] text-center">
                            {t.durationMinutes}分
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateTaskDuration(t.id, t.durationMinutes + 5)}
                            className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white rounded transition active:scale-95 cursor-pointer"
                            title="所要時間を5分増やす"
                          >
                            +5
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteDraftTask(t.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="タスクを削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {draftTasks.length > 0 && (
              <p className="text-[11px] text-indigo-600 flex items-center gap-1 pt-1">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {effectiveIsEdit
                    ? '所要時間の変更やタスクの追加・削除が完了したら、右下の保存ボタンを押してください。'
                    : '続けて別のタスクも追加できます。準備ができたら右下の「表を作成する」を押してください。'}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* フッター（常に画面最下部に固定表示、セーフエリア対応） */}
        <div className="shrink-0 flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/95 px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3 sm:px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer shrink-0"
          >
            キャンセル
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {effectiveIsEdit && (
              <button
                type="button"
                onClick={() => handleBuildTable(true)}
                disabled={draftTasks.length === 0}
                className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 transition active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                title="現在の表はそのまま残し、別の新しい予定表として別名保存します"
              >
                <Plus className="h-3.5 w-3.5 text-slate-500" />
                <span>別名で新しく保存</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleBuildTable(false)}
              disabled={draftTasks.length === 0}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 sm:px-5 py-2.5 text-xs font-bold transition shadow-md min-w-0 ${
                draftTasks.length > 0
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white cursor-pointer active:scale-98'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {effectiveIsEdit ? 'この表を上書き保存' : `「${tableName || 'この表'}」を作成（${draftTasks.length}件）`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
