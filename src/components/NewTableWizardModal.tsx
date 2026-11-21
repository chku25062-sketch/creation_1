'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  Check,
  Plus,
  ChevronRight,
  ChevronLeft,
  Clock,
  HelpCircle,
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
import { timeStringToMinutes, minutesToTimeString } from '@/lib/timeUtils';

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
  defaultTaskCount?: number; // 表の標準枠数・コマ数（行数）
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
    defaultTaskCount: 4,
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
    defaultTaskCount: 4,
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
    defaultTaskCount: 4,
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
    defaultTaskCount: 5,
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
    defaultTaskCount: 3,
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
    defaultTaskCount: 4,
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
    defaultTaskCount: 4,
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
    defaultTaskCount: 5,
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
    defaultTaskCount: 4,
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

  // 現在の質問番号 (1: 目的/タイプ, 2: 活動時間帯, 3: 1コマの時間, 4: 枠数, 5: 休憩/回数, 6: 完成確認)
  const [questionStep, setQuestionStep] = useState<number>(1);


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

  // 表の大きさ（コマ数 / タスク枠数 / 行数）
  const [tableTaskCount, setTableTaskCount] = useState<number>(4);

  // テーマのおすすめ予定（サンプルタスク）を自動配置するか（デフォルトON）
  const [includeSampleTasks, setIncludeSampleTasks] = useState(true);

  // Plan30: targetTable または isOpen の変化時にフォーム初期値を設定（Pre-fill）
  useEffect(() => {
    if (!isOpen) return;

    setIsResetToNew(false);
    setQuestionStep(1);

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
      setTableTaskCount(targetTable.numRows || 4);
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
      setTableTaskCount(4);
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
    setTableTaskCount(theme.defaultTaskCount || theme.suggestions.length || 4);
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
    const count = Math.max(1, tableTaskCount);

    if (tableType === 'fixed') {
      // 固定枠表の生成
      let curStartMin = timeStringToMinutes(fixedStartTime || '09:00');
      const targetDays = currentTheme.defaultTargetDays || [0];
      const items: FixedSlotItemInput[] = [];

      for (let i = 0; i < count; i++) {
        const s = includeSampleTasks ? suggestions[i] : null;
        const dur = s?.defaultDuration || defaultDuration;
        const sTime = s?.fixedStartTime || minutesToTimeString(curStartMin);
        const sStartMin = timeStringToMinutes(sTime);
        const endMin = (sStartMin + dur) % (24 * 60);
        const eTime = s?.fixedEndTime || minutesToTimeString(endMin);
        const title = s?.label || (includeSampleTasks ? `${i + 1}限` : '');

        items.push({
          title,
          startTime: sTime,
          endTime: eTime,
          targetDays,
        });

        // 次のタスク開始時刻（設定された休憩時間 fixedIntervalMinutes を考慮）
        curStartMin = (endMin + fixedIntervalMinutes) % (24 * 60);
      }

      // 最大終了時刻の算出
      let maxEndMin = 0;
      items.forEach(t => {
        const eMin = timeStringToMinutes(t.endTime);
        if (eMin > maxEndMin) maxEndMin = eMin;
      });
      if (maxEndMin === 0) {
        maxEndMin = timeStringToMinutes(fixedStartTime || '09:00') + defaultDuration * count;
      }
      const autoEndTime = minutesToTimeString(maxEndMin);

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
      const items: TemplateTaskItemInput[] = [];
      for (let i = 0; i < count; i++) {
        const s = includeSampleTasks ? suggestions[i] : null;
        items.push({
          title: s?.label || (includeSampleTasks ? `タスク ${i + 1}` : ''),
          durationMinutes: s?.defaultDuration || defaultDuration,
          weeklyCount: s?.weeklyCount || weeklyTargetCount,
        });
      }

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
        const items: TemplateTaskItemInput[] = [];
        for (let i = 0; i < count; i++) {
          const s = includeSampleTasks ? suggestions[i] : null;
          items.push({
            title: s?.label || (includeSampleTasks ? `習慣 ${i + 1}` : ''),
            durationMinutes: s?.defaultDuration || defaultDuration,
            targetDays: dailyTargetDays,
          });
        }

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
        const items: TemplateTaskItemInput[] = [];
        for (let i = 0; i < count; i++) {
          const s = includeSampleTasks ? suggestions[i] : null;
          items.push({
            title: s?.label || (includeSampleTasks ? `習慣 ${i + 1}` : ''),
            durationMinutes: s?.defaultDuration || defaultDuration,
          });
        }

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


  // 固定枠の場合の終了時刻の動的プレビュー計算
  const calculatedFixedEndTime = useMemo(() => {
    if (tableType !== 'fixed') return fixedEndTime;
    const startM = timeStringToMinutes(fixedStartTime || '09:00');
    const count = Math.max(1, tableTaskCount);
    const totalSlotM = count * defaultDuration;
    const totalBreakM = Math.max(0, count - 1) * fixedIntervalMinutes;
    const endM = Math.min(24 * 60, startM + totalSlotM + totalBreakM);
    return minutesToTimeString(endM);
  }, [tableType, fixedStartTime, tableTaskCount, defaultDuration, fixedIntervalMinutes, fixedEndTime]);

  // 最大質問数（日課は4問+完了、固定枠/週次は5問+完了）
  const totalQuestions = tableType === 'daily' ? 4 : 5;
  const isFinalStep = questionStep > totalQuestions;

  const handleApply = () => {
    handleBuildTable(false);
  };
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50/80 via-sky-50/50 to-slate-50 px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {effectiveIsEdit ? `予定表の調整: ${tableName}` : '質問に答えて予定表を作成'}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500">
                質問に答えていくと、上の枠組みがリアルタイムに埋まっていきます
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
                  setQuestionStep(1);
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 sm:px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-2xs"
                title="白紙から新しく作り直します"
              >
                <Plus className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">白紙から作る</span>
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

        {/* ========================================================
            【最重要】リアルタイム枠組みプレビュー（上部に常駐）
            質問に答えるたびに、枠がカチッと埋まる！
            ======================================================== */}
        <div className="shrink-0 bg-slate-900 text-white p-3 sm:p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                完成する予定表の枠組みプレビュー
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                {tableType === 'daily' ? '毎日（日課）' : tableType === 'weekly' ? '週○回（週次）' : '固定枠（時間割）'}
              </span>
            </div>
            <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-xs">
              {tableName || '無題の予定表'}
            </span>
          </div>

          {/* 枠組みビジュアルカード */}
          <div className="rounded-xl bg-slate-800/90 border border-slate-700/80 p-2.5 sm:p-3 space-y-2">
            {/* 時間帯バー */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <Clock className="h-3 w-3 text-indigo-400" />
                活動時間帯:
              </span>
              <span className="font-bold text-sky-300 font-mono">
                {tableType === 'fixed'
                  ? `${fixedStartTime} 〜 ${calculatedFixedEndTime}`
                  : `${fixedStartTime} 〜 ${fixedEndTime}`}
              </span>
            </div>

            {/* コマの枠線プレビュー（リアルタイムに枠が並ぶ） */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {Array.from({ length: Math.min(tableTaskCount, 8) }).map((_, idx) => (
                <React.Fragment key={idx}>
                  <div className="flex-1 min-w-[70px] sm:min-w-[85px] bg-slate-700/80 border border-indigo-500/40 rounded-lg p-1.5 text-center transition-all animate-fadeIn">
                    <span className="block text-[10px] font-bold text-indigo-200 truncate">
                      {tableType === 'fixed' ? `${idx + 1}コマ目` : `枠 ${idx + 1}`}
                    </span>
                    <span className="block text-[9px] text-slate-300 font-mono mt-0.5">
                      {defaultDuration}分
                    </span>
                  </div>
                  {tableType === 'fixed' && fixedIntervalMinutes > 0 && idx < Math.min(tableTaskCount, 8) - 1 && (
                    <div className="shrink-0 flex flex-col items-center justify-center px-1">
                      <span className="text-[8px] font-bold text-amber-300">休</span>
                      <span className="text-[8px] text-slate-400 font-mono">{fixedIntervalMinutes}m</span>
                    </div>
                  )}
                </React.Fragment>
              ))}
              {tableTaskCount > 8 && (
                <div className="shrink-0 text-[10px] text-slate-400 font-bold px-1">
                  +{tableTaskCount - 8}枠...
                </div>
              )}
            </div>

            {/* サマリー補助（週目標やペース） */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-700/60">
              <span>
                {tableType === 'daily' && (dailyRepeatPattern === 'everyday' ? 'ペース: 毎日同じ' : dailyRepeatPattern === 'weekdays' ? `ペース: 曜日指定(${dailyTargetDays.length}日)` : `ペース: ${dailyCycleLength}日サイクル`)}
                {tableType === 'weekly' && `週の目標回数: 週${weeklyTargetCount}回`}
                {tableType === 'fixed' && (fixedIntervalMinutes > 0 ? `休憩: 各${fixedIntervalMinutes}分間隔` : '休憩: なし（連続）')}
              </span>
              <span className="text-slate-300 font-medium">
                合計枠数: <strong className="text-white font-bold">{tableTaskCount}</strong> {tableType === 'fixed' ? 'コマ' : '枠'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            【下部】1問1答の対話質問エリア
            1問ずつ質問し、回答すると次の枠が埋まる
            ======================================================== */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs text-slate-700">
          {/* 質問 1: 目的とタイプ */}
          {questionStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  質問 1 / {totalQuestions}
                </span>
                <span className="text-[10px] text-slate-400">基本の骨組み</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  まずは、どんな目的の予定表にするか教えてください
                </h4>
                <div className="mt-1 flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-100/80 text-[11px] text-indigo-900">
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>つまり何のための設定？</strong><br />
                    表の基本ルールを決めます。毎日規則正しくこなす習慣か、週に何回かやる目標か、時間が動かない時間割かを選びます。
                  </span>
                </div>
              </div>

              {/* 3つの大型分類選択カード */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTableType('daily')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer ${
                    tableType === 'daily'
                      ? 'border-indigo-600 bg-indigo-50/90 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                    毎日（日課）
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    朝ルーティンや夜の習慣など、毎日決まった時間にこなしたい予定
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTableType('weekly')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer ${
                    tableType === 'weekly'
                      ? 'border-indigo-600 bg-indigo-50/90 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                    週○回（週次）
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    ジム通いや掃除など、週に何回か空いている曜日に自動配置したい目標
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTableType('fixed')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer ${
                    tableType === 'fixed'
                      ? 'border-indigo-600 bg-indigo-50/90 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                    固定枠（時間割）
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    大学の講義やシフトなど、時間が動かない決まった枠を作る予定
                  </span>
                </button>
              </div>

              {/* 表の名前入力 */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700">
                  予定表の名前（自由に編集できます）
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={e => setTableName(e.target.value)}
                  placeholder="例: 朝のルーティン、ジム週次目標、大学時間割など"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* おすすめテーマのクイック選択 */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-bold text-slate-500 block">
                  おすすめテーマからワンタップで設定をセット:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {THEME_DEFINITIONS.map(theme => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectTheme(theme)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        selectedThemeId === theme.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 質問 2: 活動時間帯 */}
          {questionStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  質問 2 / {totalQuestions}
                </span>
                <span className="text-[10px] text-slate-400">活動エリアの境界線</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  この予定表は、1日のうちどの時間帯に行いますか？
                </h4>
                <div className="mt-1 flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-100/80 text-[11px] text-indigo-900">
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>つまり何のための設定？</strong><br />
                    この表のタスクを配置するエリアを決めます。仕事や夜のプライベートなど、他の大切な時間帯をタスクの侵入から守る境界線になります。
                  </span>
                </div>
              </div>

              {/* クイック選択チップ */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  大まかな時間帯を選ぶ
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTimeSlot('morning')}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      timeSlot === 'morning'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">朝</span>
                    <span className="text-[10px] text-slate-500 font-mono">06:00 〜 12:00</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTimeSlot('afternoon')}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      timeSlot === 'afternoon'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">昼</span>
                    <span className="text-[10px] text-slate-500 font-mono">12:00 〜 18:00</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTimeSlot('evening')}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      timeSlot === 'evening'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">夜</span>
                    <span className="text-[10px] text-slate-500 font-mono">18:00 〜 23:00</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTimeSlot('all')}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      timeSlot === 'all'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">終日</span>
                    <span className="text-[10px] text-slate-500 font-mono">00:00 〜 24:00</span>
                  </button>
                </div>
              </div>

              {/* 開始・終了時刻の自由直接入力 */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700">
                  具体的な開始時刻と終了時刻（直接指定）
                </label>
                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] font-bold text-slate-600 shrink-0">開始</span>
                    <input
                      type="time"
                      value={fixedStartTime}
                      onChange={e => {
                        setFixedStartTime(e.target.value);
                        setTimeSlot('custom');
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <span className="text-slate-400 font-bold">〜</span>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] font-bold text-slate-600 shrink-0">終了</span>
                    <input
                      type="time"
                      value={tableType === 'fixed' ? calculatedFixedEndTime : fixedEndTime}
                      disabled={tableType === 'fixed'}
                      onChange={e => {
                        setFixedEndTime(e.target.value);
                        setTimeSlot('custom');
                      }}
                      className={`w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold ${
                        tableType === 'fixed' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'
                      }`}
                    />
                  </div>
                </div>
                {tableType === 'fixed' && (
                  <p className="text-[10px] text-indigo-600">
                    ※ 固定枠の終了時刻は、開始時刻・コマ数・1コマの時間・休憩時間から自動計算されます。
                  </p>
                )}
              </div>

              {/* 日課ペースの選択（日課の場合のみ） */}
              {tableType === 'daily' && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-700">
                    習慣を実行するペース
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDailyRepeatPattern('everyday')}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                        dailyRepeatPattern === 'everyday' ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold' : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-xs">毎日同じ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyRepeatPattern('weekdays')}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                        dailyRepeatPattern === 'weekdays' ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold' : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-xs">曜日指定</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyRepeatPattern('cycle')}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                        dailyRepeatPattern === 'cycle' ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold' : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-xs">ローテーション</span>
                    </button>
                  </div>

                  {dailyRepeatPattern === 'weekdays' && (
                    <div className="flex gap-1 pt-1">
                      {WEEKDAYS.map(w => {
                        const active = dailyTargetDays.includes(w.dayIndex);
                        return (
                          <button
                            key={w.dayIndex}
                            type="button"
                            onClick={() => {
                              if (active) {
                                if (dailyTargetDays.length > 1) {
                                  setDailyTargetDays(dailyTargetDays.filter(d => d !== w.dayIndex));
                                }
                              } else {
                                setDailyTargetDays([...dailyTargetDays, w.dayIndex].sort());
                              }
                            }}
                            className={`flex-1 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              active
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {dailyRepeatPattern === 'cycle' && (
                    <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-700">周期の長さ:</span>
                      <NumberStepper
                        value={dailyCycleLength}
                        min={2}
                        max={14}
                        step={1}
                        unit="日周期"
                        onChange={setDailyCycleLength}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 質問 3: 1コマの作業時間 */}
          {questionStep === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  質問 3 / {totalQuestions}
                </span>
                <span className="text-[10px] text-slate-400">1コマの長さ</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  1つの予定（1コマ）にかける標準の作業時間はどれくらいにしますか？
                </h4>
                <div className="mt-1 flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-100/80 text-[11px] text-indigo-900">
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>つまり何のための設定？</strong><br />
                    タスクを1つ追加したときに、標準で確保される枠の長さです（例: 15分なら手軽な習慣、60分なら集中作業）。個別のタスクごとに後から自由に変更も可能です。
                  </span>
                </div>
              </div>

              {/* 自由数値入力ステッパー */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    1コマの標準時間（自由入力）:
                  </span>
                  <NumberStepper
                    value={defaultDuration}
                    min={5}
                    max={240}
                    step={5}
                    unit="分"
                    onChange={setDefaultDuration}
                  />
                </div>

                {/* 目安クイックチップ */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">目安:</span>
                  {[15, 30, 45, 60, 90].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDefaultDuration(m)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        defaultDuration === m
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {m}分
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 質問 4: 表の大きさ（枠数 / コマ数） */}
          {questionStep === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  質問 4 / {totalQuestions}
                </span>
                <span className="text-[10px] text-slate-400">受け皿の大きさ</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  この予定表に、だいたい何個くらいの予定枠（コマ）を用意しますか？
                </h4>
                <div className="mt-1 flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-100/80 text-[11px] text-indigo-900">
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>つまり何のための設定？</strong><br />
                    予定表の『受け皿』となる枠の数です。あらかじめ枠を用意しておくことで、タスクを流し込むだけで表が完成します（後からいつでも追加・削除できます）。
                  </span>
                </div>
              </div>

              {/* 自由数値入力ステッパー */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {tableType === 'fixed' ? 'コマ数（時間割の枠数）:' : '初期枠数（タスクの個数）:'}
                  </span>
                  <NumberStepper
                    value={tableTaskCount}
                    min={1}
                    max={12}
                    step={1}
                    unit={tableType === 'fixed' ? 'コマ' : '枠'}
                    onChange={setTableTaskCount}
                  />
                </div>

                {/* 目安クイックチップ */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">目安:</span>
                  {[3, 4, 5, 6].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTableTaskCount(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        tableTaskCount === c
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {c}{tableType === 'fixed' ? 'コマ' : '枠'}
                    </button>
                  ))}
                </div>
              </div>

              {tableType === 'fixed' && (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-900 text-xs flex items-center justify-between font-medium">
                  <span>時間割全体の想定範囲:</span>
                  <strong className="font-mono text-sm">{fixedStartTime} 〜 {calculatedFixedEndTime}</strong>
                </div>
              )}
            </div>
          )}

          {/* 質問 5: （固定枠なら休憩時間、週次なら週目標回数） */}
          {questionStep === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  質問 5 / {totalQuestions}
                </span>
                <span className="text-[10px] text-slate-400">間隔と目標</span>
              </div>

              {tableType === 'fixed' ? (
                <>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      コマとコマの間に、休憩時間は確保しますか？
                    </h4>
                    <div className="mt-1 flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-100/80 text-[11px] text-indigo-900">
                      <HelpCircle className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>つまり何のための設定？</strong><br />
                        前のコマが終わってから次のコマが始まるまでの休み時間・移動時間です。設定すると、コマ同士が隙間なくくっつかず無理のない時間割になります。
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        コマ間の休憩時間:
                      </span>
                      <NumberStepper
                        value={fixedIntervalMinutes}
                        min={0}
                        max={60}
                        step={5}
                        unit="分"
                        onChange={setFixedIntervalMinutes}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">目安:</span>
                      {[0, 5, 10, 15, 20].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFixedIntervalMinutes(m)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            fixedIntervalMinutes === m
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {m === 0 ? '休憩なし' : `${m}分`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 付随タスク設定 */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableAttachedTask}
                        onChange={e => setEnableAttachedTask(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        コマに関連する付随タスク（準備・復習など）を設ける
                      </span>
                    </label>
                    {enableAttachedTask && (
                      <div className="pl-6 space-y-2 pt-1 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-600">付随タスクの所要時間:</span>
                          <NumberStepper
                            value={attachedTaskDuration}
                            min={10}
                            max={120}
                            step={5}
                            unit="分"
                            onChange={setAttachedTaskDuration}
                          />
                        </div>
                        <input
                          type="text"
                          value={attachedTaskTitleTemplate}
                          onChange={e => setAttachedTaskTitleTemplate(e.target.value)}
                          placeholder="例: {title} の復習・課題"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      1週間に何回くらい取り組みたいですか？
                    </h4>
                    <div className="mt-1 flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-100/80 text-[11px] text-indigo-900">
                      <HelpCircle className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>つまり何のための設定？</strong><br />
                        1週間の目標ノルマです。スケジュール機能が、空いている曜日にこの回数分だけ自動配置します。
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        週の目標回数:
                      </span>
                      <NumberStepper
                        value={weeklyTargetCount}
                        min={1}
                        max={7}
                        step={1}
                        unit="回/週"
                        onChange={setWeeklyTargetCount}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">目安:</span>
                      {[1, 2, 3, 4, 5].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setWeeklyTargetCount(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            weeklyTargetCount === c
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          週{c}回
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 完了画面: 完成した枠組みの確認と作成 */}
          {isFinalStep && (
            <div className="space-y-4 animate-fadeIn">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
                <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                  質問への回答から、予定表の枠組みが完成しました！
                </h4>
                <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                  上の黒いプレビューカードの内容で予定表を作成します。内容を確認してください。
                </p>
              </div>

              {/* サンプルタスク配置の選択 */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSampleTasks}
                    onChange={e => setIncludeSampleTasks(e.target.checked)}
                    className="h-4 w-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      おすすめの代表的な予定（サンプル）を自動で配置する
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      チェックを入れると、テーマに応じた予定が入った状態ですぐに試せます。チェックを外すと、枠組みだけが整った空の表を作成します。
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* フッターナビゲーション */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 sm:px-5 py-3">
          <div>
            {questionStep === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-3 sm:px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition active:scale-95 cursor-pointer shadow-2xs"
              >
                キャンセル
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setQuestionStep(questionStep - 1)}
                className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 sm:px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>前の質問に戻る</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isFinalStep ? (
              <button
                type="button"
                onClick={() => setQuestionStep(questionStep + 1)}
                className="flex items-center gap-1 rounded-xl bg-indigo-600 px-4 sm:px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95 cursor-pointer"
              >
                <span>次の質問へ進む</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 sm:px-6 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95 cursor-pointer"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                <span>この枠組みで表を作成する</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
