'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  Check,
  Plus,
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
export type TimeSlotOption = 'morning' | 'afternoon' | 'evening' | 'all' | 'custom' | 'custom_fixed';

export const SLOT_TIME_DEFAULTS: Record<TimeSlotOption, { start: string; end: string }> = {
  morning: { start: '07:00', end: '08:00' },
  afternoon: { start: '13:00', end: '14:00' },
  evening: { start: '19:00', end: '20:00' },
  all: { start: '09:00', end: '10:00' },
  custom: { start: '09:00', end: '10:30' },
  custom_fixed: { start: '09:00', end: '10:30' },
};

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
  defaultDuration?: number; // 表の標準コマ時間・目安時間（分）
  defaultTargetDays?: number[];
  defaultIntervalMinutes?: number; // 固定枠のコマ間休憩時間（分）
  defaultEnableAttachedTask?: boolean; // 付随タスクの初期ON
  defaultAttachedTaskDuration?: number; // 付随タスクの所要時間（分）
  defaultWeeklyTargetCount?: number; // 週次タスクの目標回数
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
    defaultDuration: 20,
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
    defaultDuration: 15,
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
    defaultDuration: 20,
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
    defaultDuration: 90, // 大学の講義コマは90分
    defaultTargetDays: [0], // 曜日ごとの時間割のため初期値は月曜のみ
    defaultIntervalMinutes: 10,
    defaultEnableAttachedTask: true,
    defaultAttachedTaskDuration: 30,
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
    defaultDuration: 240, // 4時間シフト等
    defaultTargetDays: [0, 1, 2, 3, 4], // 平日
    defaultIntervalMinutes: 0,
    defaultEnableAttachedTask: false,
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
    defaultDuration: 60,
    defaultWeeklyTargetCount: 2,
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
    defaultDuration: 60,
    defaultWeeklyTargetCount: 2,
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
    defaultDuration: 60,
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
    defaultDuration: 30,
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

  // Plan30: 表全体のデフォルト所要時間（コマ時間 / 目安時間）
  const [defaultDuration, setDefaultDuration] = useState<number>(20);

  // 固定枠のコマ間休憩時間（分。0, 5, 10, 15, 20 等。デフォルト 10分）
  const [fixedIntervalMinutes, setFixedIntervalMinutes] = useState<number>(10);

  // 固定枠の付随タスク（連動タスク）設定
  const [enableAttachedTask, setEnableAttachedTask] = useState<boolean>(false);
  const [attachedTaskDuration, setAttachedTaskDuration] = useState<number>(30);
  const [attachedTaskTitleTemplate, setAttachedTaskTitleTemplate] = useState<string>('{title} のタスク');

  // 週次タスクの1週間あたりの目標回数（デフォルト回数。1, 2, 3, 4, 5 等。デフォルト 2回）
  const [weeklyTargetCount, setWeeklyTargetCount] = useState<number>(2);

  // テーマのおすすめ予定（サンプルタスク）を自動配置するか（デフォルトON）
  const [includeSampleTasks, setIncludeSampleTasks] = useState(true);

  // Plan30: targetTable または isOpen の変化時にフォーム初期値を設定（Pre-fill）
  useEffect(() => {
    if (!isOpen) return;

    setIsResetToNew(false);

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
      } else if (sTime && eTime) {
        setTimeSlot('custom');
      } else {
        setTimeSlot('all');
      }

      if (sTime) setFixedStartTime(sTime);
      if (eTime) setFixedEndTime(eTime);

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

      const initialDur = targetTable.axisConfig.periodMinutes || (mappedType === 'fixed' ? 90 : 20);
      setDefaultDuration(initialDur);

      setFixedIntervalMinutes(targetTable.axisConfig.intervalMinutes ?? 10);
      setEnableAttachedTask(Boolean(targetTable.attachedTaskConfig?.enabled));
      setAttachedTaskDuration(targetTable.attachedTaskConfig?.durationMinutes || 30);
      setAttachedTaskTitleTemplate(targetTable.attachedTaskConfig?.titleTemplate || '{title} のタスク');
      const firstWeeklyCell = targetTable.cells?.flat().find(c => (c.targetWeeklyCount ?? 0) > 0);
      setWeeklyTargetCount(firstWeeklyCell?.targetWeeklyCount || 2);
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
      setDefaultDuration(20);
      setFixedIntervalMinutes(10);
      setEnableAttachedTask(false);
      setAttachedTaskDuration(30);
      setAttachedTaskTitleTemplate('{title} のタスク');
      setWeeklyTargetCount(2);
      setIncludeSampleTasks(true);
    }
  }, [isOpen, targetTable]);

  // 現在選択中のテーマオブジェクト
  const currentTheme = useMemo(() => {
    return THEME_DEFINITIONS.find(t => t.id === selectedThemeId) || THEME_DEFINITIONS[0];
  }, [selectedThemeId]);

  // 活動時間帯（timeSlot）の選択ハンドラ
  const handleSelectTimeSlot = (slot: TimeSlotOption) => {
    setTimeSlot(slot);
    const defaults = SLOT_TIME_DEFAULTS[slot] || SLOT_TIME_DEFAULTS.all;
    if (slot !== 'custom' && slot !== 'custom_fixed') {
      setFixedStartTime(defaults.start);
      setFixedEndTime(defaults.end);
    }
  };

  // テーマ切り替えハンドラ（表名・タイプ・時間帯・初期曜日・開始時刻を連動初期化）
  const handleSelectTheme = (theme: ThemeDefinition) => {
    setSelectedThemeId(theme.id);
    setTableName(theme.defaultTableName);
    setTableType(theme.recommendedType);
    setTimeSlot(theme.recommendedTimeSlot);

    const timeDefaults = SLOT_TIME_DEFAULTS[theme.recommendedTimeSlot] || SLOT_TIME_DEFAULTS.all;
    const sTime = theme.suggestions[0]?.fixedStartTime || timeDefaults.start;
    const eTime = theme.suggestions[0]?.fixedEndTime || timeDefaults.end;

    setFixedStartTime(sTime);
    setFixedEndTime(eTime);

    const themeDuration = theme.defaultDuration || theme.suggestions[0]?.defaultDuration || 20;
    setDefaultDuration(themeDuration);
    setFixedIntervalMinutes(theme.defaultIntervalMinutes ?? 10);
    setEnableAttachedTask(Boolean(theme.defaultEnableAttachedTask));
    setAttachedTaskDuration(theme.defaultAttachedTaskDuration || 30);
    setWeeklyTargetCount(theme.defaultWeeklyTargetCount || 2);
  };

  // 表の構築＆反映（asNewTable: true なら新しい表として別名保存）
  const handleBuildTable = (asNewTable = false) => {
    const finalTableName = tableName.trim() || currentTheme.defaultTableName || '新しいスケジュール表';

    // 活動時間帯（日課・週次タスク共通）
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
    } else if (timeSlot === 'custom' || timeSlot === 'custom_fixed') {
      slotStartTime = fixedStartTime;
      slotEndTime = fixedEndTime;
    }

    let generatedTable: ImportedTableData;

    // 編集モードかつ上書き保存の場合: 既存セルのタスクを保持したまま表ルールのみ更新
    if (effectiveIsEdit && !asNewTable && targetTable) {
      generatedTable = {
        ...targetTable,
        name: finalTableName,
        axisConfig: {
          ...targetTable.axisConfig,
          periodMinutes: defaultDuration,
          intervalMinutes: tableType === 'fixed' ? fixedIntervalMinutes : targetTable.axisConfig.intervalMinutes,
          startTime: tableType === 'fixed' ? (fixedStartTime || '09:00') : slotStartTime,
          endTime: tableType === 'fixed' ? targetTable.axisConfig.endTime : slotEndTime,
        },
      };

      if (tableType === 'fixed') {
        generatedTable.placementMode = 'fixed';
        generatedTable.classificationOverride = 'fixed_slot';
        generatedTable.attachedTaskConfig = enableAttachedTask
          ? {
              enabled: true,
              durationMinutes: attachedTaskDuration,
              titleTemplate: attachedTaskTitleTemplate || '{title} のタスク',
            }
          : undefined;
      } else if (tableType === 'weekly') {
        generatedTable.placementMode = 'auto';
        generatedTable.classificationOverride = 'weekly_task';
      } else {
        generatedTable.placementMode = 'auto';
        generatedTable.classificationOverride = 'daily_task';
        if (dailyRepeatPattern === 'weekdays') {
          generatedTable.columnMode = 'weekday';
        } else if (dailyRepeatPattern === 'cycle') {
          generatedTable.columnMode = 'cycle';
          generatedTable.numCols = dailyCycleLength;
          generatedTable.cycleStartDay = dailyCycleStartDay;
        } else {
          generatedTable.columnMode = 'weekday';
        }
      }

      onApplyTable(generatedTable, true);
      onClose();
      return;
    }

    // 新規作成（または別名保存）の場合:
    // アプローチA: includeSampleTasks が true の場合、テーマの suggestions をベースに初期タスクを展開
    const suggestions = includeSampleTasks ? currentTheme.suggestions : [];

    if (tableType === 'fixed') {
      // 固定枠表の生成
      let curStartMin = timeStringToMinutes(fixedStartTime || '09:00');
      const targetDays = currentTheme.defaultTargetDays || [0];
      const items: FixedSlotItemInput[] = [];

      suggestions.forEach(s => {
        const dur = s.defaultDuration || defaultDuration;
        const sTime = s.fixedStartTime || `${String(Math.floor(curStartMin / 60)).padStart(2, '0')}:${String(curStartMin % 60).padStart(2, '0')}`;
        const endMin = (timeStringToMinutes(sTime) + dur) % (24 * 60);
        const eTime = s.fixedEndTime || `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

        items.push({
          title: s.label,
          startTime: sTime,
          endTime: eTime,
          targetDays,
        });

        // 次のタスク開始時刻（設定された休憩時間 fixedIntervalMinutes を考慮）
        curStartMin = (endMin + fixedIntervalMinutes) % (24 * 60);
      });

      // 最大終了時刻の算出
      let maxEndMin = 0;
      items.forEach(t => {
        const eMin = timeStringToMinutes(t.endTime);
        if (eMin > maxEndMin) maxEndMin = eMin;
      });
      if (maxEndMin === 0) {
        maxEndMin = timeStringToMinutes(fixedStartTime || '09:00') + defaultDuration * 4;
      }
      const autoEndTime = `${String(Math.floor(maxEndMin / 60)).padStart(2, '0')}:${String(maxEndMin % 60).padStart(2, '0')}`;

      generatedTable = createFixedSlotTable({
        name: finalTableName,
        multiSlots: { items },
        daysCount: 7,
        repeatStartDay: 0,
        startTime: fixedStartTime || '09:00',
        endTime: autoEndTime,
      });
      generatedTable.axisConfig.periodMinutes = defaultDuration;
      generatedTable.axisConfig.intervalMinutes = fixedIntervalMinutes;
      if (enableAttachedTask) {
        generatedTable.attachedTaskConfig = {
          enabled: true,
          durationMinutes: attachedTaskDuration,
          titleTemplate: attachedTaskTitleTemplate || '{title} のタスク',
        };
      }
    } else if (tableType === 'weekly') {
      // 週次タスク表の生成
      const items: TemplateTaskItemInput[] = suggestions.map(s => ({
        title: s.label,
        durationMinutes: s.defaultDuration || defaultDuration,
        weeklyCount: weeklyTargetCount,
      }));

      generatedTable = createWeeklyTaskTable({
        name: finalTableName,
        daysCount: 7,
        isRepeat: false,
        multiTasks: { items },
        timeRange: { startTime: slotStartTime, endTime: slotEndTime },
      });
      generatedTable.axisConfig.periodMinutes = defaultDuration;
    } else {
      // 日課表の生成
      if (dailyRepeatPattern === 'cycle') {
        const cycleItems: (DailyMenuItem | null)[] = Array.from(
          { length: dailyCycleLength },
          (_, c) => {
            const s = suggestions[c];
            return s ? { title: s.label, durationMinutes: s.defaultDuration || defaultDuration } : null;
          },
        );

        generatedTable = createDailyRoutineTable({
          name: finalTableName,
          mode: 'cycle_rotation',
          cycleRotation: {
            cycleLength: dailyCycleLength,
            cycleStartDay: dailyCycleStartDay,
            items: cycleItems,
            defaultDurationMinutes: defaultDuration,
          },
          dailyRepeatCount: 1,
          timeRange: { startTime: slotStartTime, endTime: slotEndTime },
        });
      } else if (dailyRepeatPattern === 'weekdays') {
        const items: TemplateTaskItemInput[] = suggestions.map(s => ({
          title: s.label,
          durationMinutes: s.defaultDuration || defaultDuration,
          targetDays: dailyTargetDays,
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
        // 毎日同じ
        const items: TemplateTaskItemInput[] = suggestions.map(s => ({
          title: s.label,
          durationMinutes: s.defaultDuration || defaultDuration,
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
      generatedTable.axisConfig.periodMinutes = defaultDuration;
    }

    onApplyTable(generatedTable, false);
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
                <Sparkles className="h-3.5 w-3.5 text-white" />
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

            {/* A. 表のテーマを選ぶ（常時選択可能） */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">
                  表のテーマを選ぶ
                </label>
                <span className="text-[10px] text-slate-400">
                  タップで設定と候補タスクを自動反映
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {THEME_DEFINITIONS.map(theme => {
                  const isSelected = selectedThemeId === theme.id;
                  const typeLabel =
                    theme.recommendedType === 'daily'
                      ? '日課'
                      : theme.recommendedType === 'weekly'
                        ? '週次'
                        : '固定枠';
                  const typeBadgeClass =
                    theme.recommendedType === 'daily'
                      ? 'bg-amber-100 text-amber-800'
                      : theme.recommendedType === 'weekly'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800';

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectTheme(theme)}
                      className={`flex flex-col items-start p-2 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-0.5">
                        <span className="font-bold text-xs text-slate-800">{theme.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${typeBadgeClass}`}>
                          {typeLabel}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 line-clamp-1">
                        {theme.description}
                      </span>
                    </button>
                  );
                })}
              </div>
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
                      if (timeSlot === 'custom_fixed') setTimeSlot('custom');
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
                      if (timeSlot === 'custom_fixed') setTimeSlot('custom');
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
                <span className="block text-[11px] font-bold text-slate-700">
                  {tableType === 'fixed' ? '始業時刻（基準開始時間）' : '活動する時間帯'}
                </span>
                {tableType === 'fixed' ? (
                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="time"
                      value={fixedStartTime}
                      onChange={e => {
                        setFixedStartTime(e.target.value);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-400">
                      ※表の終了時間はタスク登録に合わせて自動拡張されます
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-5 gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectTimeSlot('morning')}
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
                        onClick={() => handleSelectTimeSlot('afternoon')}
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
                        onClick={() => handleSelectTimeSlot('evening')}
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
                        onClick={() => handleSelectTimeSlot('all')}
                        className={`rounded-lg py-1.5 text-[10px] font-bold transition cursor-pointer ${
                          timeSlot === 'all'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        終日
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTimeSlot('custom')}
                        className={`rounded-lg py-1.5 text-[10px] font-bold transition cursor-pointer ${
                          timeSlot === 'custom' || timeSlot === 'custom_fixed'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        指定
                      </button>
                    </div>

                    {(timeSlot === 'custom' || timeSlot === 'custom_fixed') && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-500 font-medium">時間指定:</span>
                        <input
                          type="time"
                          value={fixedStartTime}
                          onChange={e => {
                            setFixedStartTime(e.target.value);
                          }}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        />
                        <span className="text-slate-400">〜</span>
                        <input
                          type="time"
                          value={fixedEndTime}
                          onChange={e => {
                            setFixedEndTime(e.target.value);
                          }}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        />
                      </div>
                    )}
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

              {/* D. タスクの標準所要時間（コマ時間 / 目安時間） */}
              <div className="pt-2.5 border-t border-indigo-100/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    {tableType === 'fixed'
                      ? '1コマの標準時間（コマ割の長さ）'
                      : tableType === 'weekly'
                        ? '1回の標準作業時間'
                        : '1つの習慣の目安時間'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    タスク追加時の基準時間として自動連動
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(tableType === 'fixed'
                    ? [50, 60, 90, 100]
                    : tableType === 'weekly'
                      ? [30, 45, 60, 90]
                      : [10, 15, 20, 30]
                  ).map(dur => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setDefaultDuration(dur)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                        defaultDuration === dur
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {dur}分{tableType === 'fixed' && dur === 90 ? ' (大学)' : ''}{tableType === 'fixed' && dur === 50 ? ' (高校)' : ''}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-slate-400">カスタム:</span>
                    <NumberStepper
                      value={defaultDuration}
                      onChange={val => setDefaultDuration(val)}
                      min={5}
                      max={480}
                      step={5}
                      unit="分"
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* 固定枠の場合のコマ間休憩時間 ＆ 付随タスク連動設定 */}
              {tableType === 'fixed' && (
                <>
                  <div className="pt-2.5 border-t border-indigo-100/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">コマ間の休憩時間</span>
                      <span className="text-[10px] text-slate-400">コマ終了後に自動挿入される休憩</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[0, 5, 10, 15, 20].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFixedIntervalMinutes(m)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                            fixedIntervalMinutes === m
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {m === 0 ? 'なし (0分)' : `${m}分${m === 10 ? ' (標準)' : ''}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-indigo-100/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableAttachedTask}
                          onChange={e => setEnableAttachedTask(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-slate-800">
                          講義・予定の後に付随タスク（復習・課題レポート・移動等）を連動生成する
                        </span>
                      </label>
                    </div>
                    {enableAttachedTask && (
                      <div className="rounded-xl bg-indigo-50/60 p-2.5 border border-indigo-100 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-600">付随タスクの所要時間:</span>
                          <div className="flex items-center gap-1">
                            {[15, 30, 45, 60].map(dur => (
                              <button
                                key={dur}
                                type="button"
                                onClick={() => setAttachedTaskDuration(dur)}
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                                  attachedTaskDuration === dur
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {dur}分
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-600">タスク名テンプレート:</span>
                          <input
                            type="text"
                            value={attachedTaskTitleTemplate}
                            onChange={e => setAttachedTaskTitleTemplate(e.target.value)}
                            placeholder="{title} のタスク"
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 w-44 outline-none focus:border-indigo-500"
                          />
                        </div>
                        <p className="text-[9px] text-slate-500">
                          ※ 「{`{title}`}」部分が各講義・予定の名前に自動で置き換わります（例: 英語 のタスク）
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 週次タスクの場合の1週間の目標回数 */}
              {tableType === 'weekly' && (
                <div className="pt-2.5 border-t border-indigo-100/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">1週間の目標回数（目安）</span>
                    <span className="text-[10px] text-slate-400">週に何回行うか</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 2, 3, 4, 5, 7].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setWeeklyTargetCount(cnt)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                          weeklyTargetCount === cnt
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {cnt === 7 ? '毎日 (週7回)' : `週${cnt}回${cnt === 2 ? ' (標準)' : ''}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* E. 表の作成オプション（新規作成時のみ） */}
              {!effectiveIsEdit && (
                <div className="pt-2.5 border-t border-indigo-100/60">
                  <label className="flex items-center gap-2.5 p-2 rounded-xl bg-indigo-50/60 border border-indigo-100 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeSampleTasks}
                      onChange={e => setIncludeSampleTasks(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800">
                        「{currentTheme.label}」の代表予定（サンプル）を自動配置する
                      </span>
                      <p className="text-[10px] text-slate-500">
                        {includeSampleTasks
                          ? '作成後、メイン画面のセルで直接文字を書き換えたりコマを調整できます'
                          : '枠組み（時間帯・コマ時間・曜日）だけが設定された空の表を作成します'}
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
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
              className="flex items-center justify-center gap-1.5 rounded-xl px-3 sm:px-5 py-2.5 text-xs font-bold transition shadow-md min-w-0 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white cursor-pointer active:scale-98"
            >
              <Check className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {effectiveIsEdit
                  ? 'この表の設定を更新'
                  : includeSampleTasks
                    ? `「${tableName || 'この表'}」を作成（代表予定入り）`
                    : `「${tableName || 'この表'}」を作成（空の表）`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
