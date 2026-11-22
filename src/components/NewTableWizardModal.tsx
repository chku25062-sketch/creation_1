'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  Plus,
  Settings,
} from 'lucide-react';
import { ImportedTableData } from '@/types';
import {
  createDailyRoutineTable,
  createWeeklyTaskTable,
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
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
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
    defaultStartTime: '09:00',
    defaultEndTime: null,
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
    defaultStartTime: '07:00',
    defaultEndTime: '12:00',
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
    defaultStartTime: '19:00',
    defaultEndTime: '23:00',
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
    defaultStartTime: '09:00',
    defaultEndTime: null,
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
    defaultStartTime: '09:00',
    defaultEndTime: '18:00',
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
    defaultStartTime: null,
    defaultEndTime: null,
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
    defaultStartTime: null,
    defaultEndTime: null,
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
    defaultStartTime: '07:00',
    defaultEndTime: '23:00',
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
    defaultStartTime: null,
    defaultEndTime: null,
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

const getTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getTomorrowStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getNextMondayStr = (): string => {
  const d = new Date();
  const currentDay = d.getDay(); // 0: 日曜, 1: 月曜, ...
  const daysUntilMonday = ((1 - currentDay + 7) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
  // 表の設定ステート
  // ==========================================
  const [selectedThemeId, setSelectedThemeId] = useState<string>('daily_routine');
  const [tableName, setTableName] = useState<string>('毎日の習慣');
  const [tableType, setTableType] = useState<TableTypeMode>('daily');

  // Plan31: 日課（daily）の繰り返しペース（毎日同じ / 曜日ごとに変える / 何日分かを個別に設定する）
  const [dailyRepeatPattern, setDailyRepeatPattern] = useState<DailyRepeatPattern>('everyday');
  const [dailyTargetDays, setDailyTargetDays] = useState<number[]>([0, 1, 2, 3, 4]); // 曜日固定時の初期値（平日）
  const [dailyCycleLength, setDailyCycleLength] = useState<number>(3); // 何日分か（日数直接入力）
  const [dailyCycleStartDay, setDailyCycleStartDay] = useState<number>(0); // 開始曜日 (0:月〜6:日)
  const [cycleStartDate, setCycleStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Plan32: 固定枠（fixed）の対象曜日選択（自由選択、初期値は平日月〜金）
  const [fixedTargetDays, setFixedTargetDays] = useState<number[]>([0, 1, 2, 3, 4]);

  // Plan31: 開始時刻・終了リミットの個別設定 ＆ 「指定しない」
  const [enableStartTime, setEnableStartTime] = useState<boolean>(true);
  const [fixedStartTime, setFixedStartTime] = useState<string>('09:00');
  const [enableEndTime, setEnableEndTime] = useState<boolean>(false);
  const [fixedEndTime, setFixedEndTime] = useState<string>('18:00');

  // Plan30: 表全体のデフォルト所要時間（コマ時間 / 目安時間）
  const [defaultDuration, setDefaultDuration] = useState<number>(20);

  // 1日あたりのタスク個数 / コマ数
  const [tableTaskCount, setTableTaskCount] = useState<number>(4);

  // Plan31: 1日あたりの目標回数（日課・ルーティンのみ。「指定しない」対応）
  const [enableDailyTargetCount, setEnableDailyTargetCount] = useState<boolean>(false);
  const [dailyTargetCount, setDailyTargetCount] = useState<number>(1);

  // 固定枠のコマ間休憩時間（分。デフォルト 10分）
  const [fixedIntervalMinutes, setFixedIntervalMinutes] = useState<number>(10);

  // 昼休みの設定（固定枠のみ）
  const [hasLunch, setHasLunch] = useState<boolean>(false);
  const [lunchAfterPeriod, setLunchAfterPeriod] = useState<number>(2);
  const [lunchMinutes, setLunchMinutes] = useState<number>(50);

  // 固定枠の付随タスク（連動タスク）設定（タスク名設定は撤廃し所要時間のみ）
  const [enableAttachedTask, setEnableAttachedTask] = useState<boolean>(false);
  const [attachedTaskDuration, setAttachedTaskDuration] = useState<number>(30);

  // 週次タスクの1週間あたりの目標回数
  const [weeklyTargetCount, setWeeklyTargetCount] = useState<number>(2);

  // テーマのおすすめ予定（サンプルタスク）を自動配置するか（デフォルトON）
  const [includeSampleTasks, setIncludeSampleTasks] = useState(true);

  // targetTable または isOpen の変化時にフォーム初期値を設定（Pre-fill）
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
      
      setEnableStartTime(Boolean(sTime));
      setFixedStartTime(sTime || '09:00');

      setEnableEndTime(Boolean(eTime));
      setFixedEndTime(eTime || '18:00');

      // 日課のペース判定
      if (mappedType === 'daily') {
        if (targetTable.columnMode === 'weekday') {
          setDailyRepeatPattern('weekdays');
        } else if (targetTable.columnMode === 'cycle' && (targetTable.numCols || 1) > 1) {
          setDailyRepeatPattern('cycle');
          setDailyCycleLength(targetTable.numCols || 3);
          setDailyCycleStartDay(targetTable.cycleStartDay ?? 0);
          const restoredStartDate =
            targetTable.cycleStartDate ||
            (targetTable.createdAt ? targetTable.createdAt.slice(0, 10) : '') ||
            new Date().toISOString().slice(0, 10);
          setCycleStartDate(restoredStartDate);
        } else {
          setDailyRepeatPattern('everyday');
        }

        // 1日あたりの目標回数の復元
        if (typeof targetTable.dailyRepeatCount === 'number' && targetTable.dailyRepeatCount > 1) {
          setEnableDailyTargetCount(true);
          setDailyTargetCount(targetTable.dailyRepeatCount);
        } else {
          setEnableDailyTargetCount(false);
          setDailyTargetCount(1);
        }
      }

      // 固定枠の曜日構成の復元
      if (mappedType === 'fixed') {
        const extractedDays = Array.from(
          new Set(
            targetTable.cells
              ?.flat()
              .map(c => c.dayIndex)
              .filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6) || []
          )
        ).sort((a, b) => a - b);
        setFixedTargetDays(extractedDays.length > 0 ? extractedDays : [0, 1, 2, 3, 4]);
      }

      const initialDur = targetTable.axisConfig.periodMinutes || (mappedType === 'fixed' ? 90 : 20);
      setDefaultDuration(initialDur);

      setFixedIntervalMinutes(targetTable.axisConfig.intervalMinutes ?? 10);
      setHasLunch(Boolean(targetTable.axisConfig.hasLunch));
      setLunchAfterPeriod(targetTable.axisConfig.lunchAfterPeriod ?? 2);
      setLunchMinutes(targetTable.axisConfig.lunchMinutes ?? 50);

      setEnableAttachedTask(Boolean(targetTable.attachedTaskConfig?.enabled));
      setAttachedTaskDuration(targetTable.attachedTaskConfig?.durationMinutes || 30);
      const firstWeeklyCell = targetTable.cells?.flat().find(c => (c.targetWeeklyCount ?? 0) > 0);
      setWeeklyTargetCount(firstWeeklyCell?.targetWeeklyCount || 2);
      setTableTaskCount(targetTable.numRows || 4);
    } else {
      // 新規作成モード
      const todayStr = new Date().toISOString().slice(0, 10);
      setSelectedThemeId('daily_routine');
      setTableName('毎日の習慣');
      setTableType('daily');
      setDailyRepeatPattern('everyday');
      setDailyTargetDays([0, 1, 2, 3, 4]);
      setDailyCycleLength(3);
      setDailyCycleStartDay(0);
      setCycleStartDate(todayStr);
      setFixedTargetDays([0, 1, 2, 3, 4]);
      setEnableStartTime(true);
      setFixedStartTime('09:00');
      setEnableEndTime(false);
      setFixedEndTime('18:00');
      setDefaultDuration(20);
      setTableTaskCount(4);
      setEnableDailyTargetCount(false);
      setDailyTargetCount(1);
      setFixedIntervalMinutes(10);
      setHasLunch(false);
      setLunchAfterPeriod(2);
      setLunchMinutes(50);
      setEnableAttachedTask(false);
      setAttachedTaskDuration(30);
      setWeeklyTargetCount(2);
      setIncludeSampleTasks(true);
    }
  }, [isOpen, targetTable]);

  // 現在選択中のテーマオブジェクト
  const currentTheme = useMemo(() => {
    return THEME_DEFINITIONS.find(t => t.id === selectedThemeId) || THEME_DEFINITIONS[0];
  }, [selectedThemeId]);

  // テーマ切り替えハンドラ
  const handleSelectTheme = (theme: ThemeDefinition) => {
    setSelectedThemeId(theme.id);
    setTableName(theme.defaultTableName);
    setTableType(theme.recommendedType);

    if (theme.defaultStartTime !== undefined) {
      setEnableStartTime(Boolean(theme.defaultStartTime));
      if (theme.defaultStartTime) setFixedStartTime(theme.defaultStartTime);
    }
    if (theme.defaultEndTime !== undefined) {
      setEnableEndTime(Boolean(theme.defaultEndTime));
      if (theme.defaultEndTime) setFixedEndTime(theme.defaultEndTime);
    }

    if (theme.defaultTargetDays && theme.defaultTargetDays.length > 0) {
      setFixedTargetDays(theme.defaultTargetDays);
    } else if (theme.recommendedType === 'fixed') {
      setFixedTargetDays([0, 1, 2, 3, 4]);
    }

    const themeDuration = theme.defaultDuration || theme.suggestions[0]?.defaultDuration || 20;
    setDefaultDuration(themeDuration);
    setFixedIntervalMinutes(theme.defaultIntervalMinutes ?? 10);
    setHasLunch(false);
    setLunchAfterPeriod(2);
    setLunchMinutes(50);
    setEnableAttachedTask(Boolean(theme.defaultEnableAttachedTask));
    setAttachedTaskDuration(theme.defaultAttachedTaskDuration || 30);
    setWeeklyTargetCount(theme.defaultWeeklyTargetCount || 2);
    setTableTaskCount(theme.defaultTaskCount || theme.suggestions.length || 4);
  };

  // 表の構築＆反映
  const handleBuildTable = (asNewTable = false) => {
    const finalTableName = tableName.trim() || currentTheme.defaultTableName || '新しいスケジュール表';

    const slotStartTime = enableStartTime ? (fixedStartTime || '09:00') : null;
    const slotEndTime = enableEndTime ? (fixedEndTime || '18:00') : null;

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
          hasLunch: tableType === 'fixed' ? hasLunch : targetTable.axisConfig.hasLunch,
          lunchAfterPeriod: tableType === 'fixed' ? lunchAfterPeriod : targetTable.axisConfig.lunchAfterPeriod,
          lunchMinutes: tableType === 'fixed' ? lunchMinutes : targetTable.axisConfig.lunchMinutes,
          startTime: slotStartTime,
          endTime: slotEndTime,
        },
      };

      if (tableType === 'fixed') {
        generatedTable.placementMode = 'fixed';
        generatedTable.classificationOverride = 'fixed_slot';
        generatedTable.attachedTaskConfig = enableAttachedTask
          ? {
              enabled: true,
              durationMinutes: attachedTaskDuration,
              titleTemplate: '{title} の課題・復習',
            }
          : undefined;

        // Plan32: 選択された曜日に基づいて列ヘッダーとセルを再構築
        const numCols = fixedTargetDays.length;
        const colHeaders = fixedTargetDays.map(d => `${WEEKDAYS.find(w => w.dayIndex === d)?.label || d}曜`);
        generatedTable.numCols = numCols;
        generatedTable.colHeaders = colHeaders;

        generatedTable.cells = targetTable.cells.map((rowCells, r) => {
          const sampleCell = rowCells[0];
          return fixedTargetDays.map(d => {
            const existingCell = rowCells.find(c => c.dayIndex === d);
            if (existingCell) {
              return {
                ...existingCell,
                periodIndex: r + 1,
              };
            }
            return {
              dayIndex: d,
              periodIndex: r + 1,
              text: sampleCell?.text ?? null,
              title: sampleCell?.title ?? '',
              roomOrNote: sampleCell?.roomOrNote ?? '',
              rawLines: sampleCell?.rawLines ?? [],
              fullText: sampleCell?.fullText ?? '',
              startMinutes: sampleCell?.startMinutes ?? 0,
              endMinutes: sampleCell?.endMinutes ?? 0,
              customDurationMinutes: sampleCell?.customDurationMinutes ?? defaultDuration,
              customStartTime: sampleCell?.customStartTime,
              hasCustomTime: sampleCell?.hasCustomTime,
            };
          });
        });
      } else if (tableType === 'weekly') {
        generatedTable.placementMode = 'auto';
        generatedTable.classificationOverride = 'weekly_task';
      } else {
        generatedTable.placementMode = 'auto';
        generatedTable.classificationOverride = 'daily_task';
        generatedTable.dailyRepeatCount = enableDailyTargetCount ? Math.max(1, dailyTargetCount) : 'auto';
        if (dailyRepeatPattern === 'weekdays') {
          generatedTable.columnMode = 'weekday';
        } else if (dailyRepeatPattern === 'cycle') {
          generatedTable.columnMode = 'cycle';
          generatedTable.numCols = dailyCycleLength;
          generatedTable.cycleStartDay = dailyCycleStartDay;
          generatedTable.cycleStartDate = cycleStartDate;
        } else {
          generatedTable.columnMode = 'weekday';
        }
      }

      onApplyTable(generatedTable, true);
      onClose();
      return;
    }

    // 新規作成（または別名保存）の場合:
    const suggestions = includeSampleTasks ? currentTheme.suggestions : [];
    const count = Math.max(1, tableTaskCount);

    if (tableType === 'fixed') {
      // Plan32: 選択された曜日に基づく固定枠（時間割）表の生成（可変列数対応）
      let curStartMin = timeStringToMinutes(slotStartTime || '09:00');
      const numCols = fixedTargetDays.length;
      const colHeaders = fixedTargetDays.map(d => `${WEEKDAYS.find(w => w.dayIndex === d)?.label || d}曜`);
      const rowHeaders = Array.from({ length: count }, (_, r) => String(r + 1));
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
          targetDays: fixedTargetDays,
        });

        // 昼休みの判定
        const isLunchBreak = hasLunch && (i + 1) === lunchAfterPeriod;
        const interval = isLunchBreak ? lunchMinutes : fixedIntervalMinutes;
        curStartMin = (endMin + interval) % (24 * 60);
      }

      // 最終コマ終了時刻の算出
      let maxEndMin = 0;
      items.forEach(t => {
        const eMin = timeStringToMinutes(t.endTime);
        if (eMin > maxEndMin) maxEndMin = eMin;
      });
      if (maxEndMin === 0) {
        maxEndMin = timeStringToMinutes(slotStartTime || '09:00') + defaultDuration * count;
      }
      const autoEndTime = minutesToTimeString(maxEndMin);

      const now = new Date().toISOString();
      const cells = items.map((item, r) => {
        const startMin = timeStringToMinutes(item.startTime);
        let endMin = timeStringToMinutes(item.endTime);
        if (endMin <= startMin) endMin += 1440;
        const dur = endMin - startMin;

        return fixedTargetDays.map(d => ({
          dayIndex: d,
          periodIndex: r + 1,
          text: item.title,
          title: item.title,
          roomOrNote: '',
          rawLines: item.title ? [item.title] : [],
          fullText: item.title,
          startMinutes: startMin,
          endMinutes: endMin,
          customDurationMinutes: dur,
          customStartTime: item.startTime,
          hasCustomTime: true,
          attachedTask: enableAttachedTask
            ? {
                enabled: true,
                title: `${item.title} の課題・復習`,
                durationMinutes: attachedTaskDuration,
              }
            : undefined,
        }));
      });

      generatedTable = {
        id: `table-fixed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: finalTableName,
        createdAt: now,
        updatedAt: now,
        placementMode: 'fixed',
        columnMode: 'weekday',
        cycleStartDay: 0,
        dailyRepeatCount: 'auto',
        weeklyRepeatCount: 'auto',
        weeklyTaskExpiryWeeks: 1,
        isApplied: true,
        numRows: count,
        numCols,
        colHeaders,
        rowHeaders,
        axisConfig: {
          startTime: slotStartTime || '09:00',
          endTime: enableEndTime ? (slotEndTime || autoEndTime) : null,
          periodMinutes: defaultDuration,
          intervalMinutes: fixedIntervalMinutes,
          hasLunch,
          lunchAfterPeriod,
          lunchMinutes,
          weeklyTaskExpiryWeeks: 1,
        },
        cells,
        attachedTaskConfig: enableAttachedTask
          ? {
              enabled: true,
              durationMinutes: attachedTaskDuration,
              titleTemplate: '{title} の課題・復習',
            }
          : undefined,
      };
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
      const targetDailyRepeat = enableDailyTargetCount ? Math.max(1, dailyTargetCount) : 1;

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
          dailyRepeatCount: targetDailyRepeat,
          timeRange: { startTime: slotStartTime, endTime: slotEndTime },
        });
        generatedTable.cycleStartDate = cycleStartDate;
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
          dailyRepeatCount: targetDailyRepeat,
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
          dailyRepeatCount: targetDailyRepeat,
          timeRange: { startTime: slotStartTime, endTime: slotEndTime },
        });
      }
      generatedTable.axisConfig.periodMinutes = defaultDuration;
    }

    onApplyTable(generatedTable, false);
    onClose();
  };

  // 固定枠の場合の目安終了時刻の計算（参考ガイド表示用、昼休み加算対応）
  const estimatedFixedEndTimeStr = useMemo(() => {
    if (tableType !== 'fixed') return '';
    const sMin = timeStringToMinutes(fixedStartTime || '09:00');
    let total = 0;
    for (let i = 0; i < tableTaskCount; i++) {
      total += defaultDuration;
      if (i < tableTaskCount - 1) {
        if (hasLunch && (i + 1) === lunchAfterPeriod) {
          total += lunchMinutes;
        } else {
          total += fixedIntervalMinutes;
        }
      }
    }
    const eMin = Math.min(24 * 60, sMin + Math.max(0, total));
    return minutesToTimeString(eMin);
  }, [tableType, fixedStartTime, defaultDuration, fixedIntervalMinutes, tableTaskCount, hasLunch, lunchAfterPeriod, lunchMinutes]);

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
                  : '質問に答えるだけで、あなたの生活に合わせたスケジュール表が完成します'}
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
                  setDailyRepeatPattern('everyday');
                  setDailyTargetDays([0, 1, 2, 3, 4]);
                  setDailyCycleLength(3);
                  setDailyCycleStartDay(0);
                  const todayStr = new Date().toISOString().slice(0, 10);
                  setCycleStartDate(todayStr);
                  setFixedTargetDays([0, 1, 2, 3, 4]);
                  setEnableStartTime(true);
                  setFixedStartTime('09:00');
                  setEnableEndTime(false);
                  setFixedEndTime('18:00');
                  setHasLunch(false);
                  setLunchAfterPeriod(2);
                  setLunchMinutes(50);
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

        {/* スクロール本体: 縦一直線（シングルカラム）で理解しやすいレイアウト */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs text-slate-700">
          
          {/* 1. 表のテーマを選ぶ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900">
                1. 表のテーマを選ぶ
              </label>
              <span className="text-[10px] text-slate-400">
                タップで推奨設定を自動セット
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
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/90 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs text-slate-900">{theme.label}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${typeBadgeClass}`}>
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

          {/* 2. 表の名前 */}
          <div className="space-y-1.5 pt-3 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-900">
              2. 予定表の名前（自由に編集できます）
            </label>
            <input
              type="text"
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              placeholder="例: 朝のルーティン、週次ジム予定、大学時間割など"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
            />
          </div>

          {/* 3. 予定のタイプ */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-900">
                3. どんな予定にしますか？
              </label>
              <p className="text-[10px] text-slate-500 mt-0.5">
                予定の性質に合わせてスケジュールへの配置ルールが決まります
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTableType('daily')}
                className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  tableType === 'daily'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">毎日（日課）</span>
                <span className="text-[10px] text-slate-500 mt-0.5">習慣・毎日の日課</span>
              </button>
              <button
                type="button"
                onClick={() => setTableType('weekly')}
                className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  tableType === 'weekly'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">週○回（週次）</span>
                <span className="text-[10px] text-slate-500 mt-0.5">週目標・ジム・習い事</span>
              </button>
              <button
                type="button"
                onClick={() => setTableType('fixed')}
                className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  tableType === 'fixed'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">固定枠（時間割）</span>
                <span className="text-[10px] text-slate-500 mt-0.5">大学講義・決まった枠</span>
              </button>
            </div>
          </div>

          {/* 4. 固定枠の曜日選択（固定枠・時間割のみ表示） */}
          {tableType === 'fixed' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    4. どの曜日の時間割（枠）を作成しますか？
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    選択した曜日の列のみで構成される時間割表（現在: {fixedTargetDays.length}列）が作成されます
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFixedTargetDays([0, 1, 2, 3, 4])}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    平日のみ
                  </button>
                  <button
                    type="button"
                    onClick={() => setFixedTargetDays([5, 6])}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    週末のみ
                  </button>
                  <button
                    type="button"
                    onClick={() => setFixedTargetDays([0, 1, 2, 3, 4, 5, 6])}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    全曜日
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map(w => {
                  const isSelected = fixedTargetDays.includes(w.dayIndex);
                  const isLastOne = isSelected && fixedTargetDays.length <= 1;
                  return (
                    <button
                      key={w.dayIndex}
                      type="button"
                      disabled={isLastOne}
                      onClick={() => {
                        let next: number[];
                        if (isSelected) {
                          if (fixedTargetDays.length <= 1) return;
                          next = fixedTargetDays.filter(d => d !== w.dayIndex);
                        } else {
                          next = [...fixedTargetDays, w.dayIndex].sort((a, b) => a - b);
                        }
                        setFixedTargetDays(next);
                      }}
                      className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      } ${isLastOne ? 'opacity-80 cursor-not-allowed' : ''}`}
                      title={isLastOne ? '最低1つの曜日の選択が必要です' : undefined}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. ペース設定（日課・ルーティンのみ表示） */}
          {tableType === 'daily' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-900">
                4. どんなペースで繰り返しますか？
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDailyRepeatPattern('everyday')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    dailyRepeatPattern === 'everyday'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold">毎日同じ</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">毎日同じ内容を実行</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDailyRepeatPattern('weekdays')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    dailyRepeatPattern === 'weekdays'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold">曜日ごとに変える</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">平日や週末で指定</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDailyRepeatPattern('cycle')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    dailyRepeatPattern === 'cycle'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold">何日分かを個別に設定</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">日数を決めて作成</span>
                </button>
              </div>

              {/* 曜日指定の場合の曜日チップ */}
              {dailyRepeatPattern === 'weekdays' && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600">実施する曜日</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDailyTargetDays([0, 1, 2, 3, 4])}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        平日のみ
                      </button>
                      <button
                        type="button"
                        onClick={() => setDailyTargetDays([5, 6])}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        週末のみ
                      </button>
                      <button
                        type="button"
                        onClick={() => setDailyTargetDays([0, 2, 4])}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
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
                          className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
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

              {/* 何日分かを個別に設定する場合（日数直接入力 ＆ 起点日設定） */}
              {dailyRepeatPattern === 'cycle' && (
                <div className="space-y-3 pt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">何日分の予定を作成しますか？</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        日数を直接指定します（例: 3分割トレーニングなら3日分）
                      </p>
                    </div>
                    <NumberStepper
                      value={dailyCycleLength}
                      onChange={setDailyCycleLength}
                      min={2}
                      max={14}
                      step={1}
                      unit="日分"
                    />
                  </div>

                  {/* Plan32: 起点日（いつから開始するか）の設定 */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800">いつから開始しますか？（起点日）</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          週をまたいでもリセットされず、起点日から連続して Day 1 → Day 2 … と配置されます
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCycleStartDate(getTodayStr())}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          今日から
                        </button>
                        <button
                          type="button"
                          onClick={() => setCycleStartDate(getTomorrowStr())}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          明日から
                        </button>
                        <button
                          type="button"
                          onClick={() => setCycleStartDate(getNextMondayStr())}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          来週月曜から
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={cycleStartDate}
                        onChange={e => {
                          if (e.target.value) setCycleStartDate(e.target.value);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 shadow-2xs"
                      />
                      <span className="text-[11px] text-slate-500">
                        開始日: {cycleStartDate}（Day 1）
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. 何時から予定を配置しますか？（開始時刻の個別設定 ＆ 「指定しない」） */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-900">
              5. 何時から予定を配置しますか？
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEnableStartTime(false)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  !enableStartTime
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">指定しない</span>
                <span className="text-[10px] text-slate-500 mt-0.5">空いている時間ならいつでもOK</span>
              </button>
              <button
                type="button"
                onClick={() => setEnableStartTime(true)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  enableStartTime
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">開始時刻を指定する</span>
                <span className="text-[10px] text-slate-500 mt-0.5">この時間以降にタスクを配置</span>
              </button>
            </div>

            {enableStartTime && (
              <div className="pt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">配置の開始時刻:</span>
                <input
                  type="time"
                  value={fixedStartTime}
                  onChange={e => setFixedStartTime(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 shadow-2xs"
                />
              </div>
            )}
          </div>

          {/* 6. 何時以降には予定を配置しませんか？（終了リミットの個別設定 ＆ 「指定しない」） */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-900">
              6. 何時以降には予定を配置しませんか？
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEnableEndTime(false)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  !enableEndTime
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">指定しない（制限なし）</span>
                <span className="text-[10px] text-slate-500 mt-0.5">夜遅くや終日配置可能</span>
              </button>
              <button
                type="button"
                onClick={() => setEnableEndTime(true)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                  enableEndTime
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">終了リミットを指定する</span>
                <span className="text-[10px] text-slate-500 mt-0.5">この時間までに終わらせる</span>
              </button>
            </div>

            {enableEndTime && (
              <div className="pt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">配置の終了リミット:</span>
                <input
                  type="time"
                  value={fixedEndTime}
                  onChange={e => setFixedEndTime(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 shadow-2xs"
                />
              </div>
            )}

            {/* 固定枠の場合の目安終了時刻（ロックせず参考情報として表示） */}
            {tableType === 'fixed' && (
              <p className="text-[10px] text-indigo-600 font-medium">
                ※ 参考: {tableTaskCount}コマ受講した場合の最終コマ終了目安: {estimatedFixedEndTimeStr}頃
              </p>
            )}
          </div>

          {/* 7. 1回あたりの作業時間はどのくらいですか？（全タイプ共通） */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900">
                  {tableType === 'fixed' ? '7. 1コマの長さはどのくらいですか？' : '7. 1回あたりの作業時間はどのくらいですか？'}
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  タスクを追加したときの標準の長さです（直接自由に入力できます）
                </p>
              </div>
              <NumberStepper
                value={defaultDuration}
                onChange={val => setDefaultDuration(val)}
                min={5}
                max={480}
                step={5}
                unit="分"
              />
            </div>
          </div>

          {/* 8. 1日あたり何個のタスクを登録しますか？（全タイプ共通） */}
          {!(tableType === 'daily' && dailyRepeatPattern === 'cycle') && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    {tableType === 'fixed' ? '8. 1日あたり何コマ受講・配置しますか？' : '8. 1日あたり何個のタスクを登録しますか？'}
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    スケジュール表の初期枠数です（直接自由に入力できます）
                  </p>
                </div>
                <NumberStepper
                  value={tableTaskCount}
                  onChange={val => setTableTaskCount(val)}
                  min={1}
                  max={tableType === 'fixed' ? 12 : 20}
                  step={1}
                  unit={tableType === 'fixed' ? 'コマ' : '個'}
                />
              </div>
            </div>
          )}

          {/* 9. 1日あたりの目標回数は設定しますか？（日課・ルーティンのみ表示） */}
          {tableType === 'daily' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-900">
                9. 1日あたりの目標回数は設定しますか？
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEnableDailyTargetCount(false)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    !enableDailyTargetCount
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold">指定しない</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">1日1回などの目標を固定しない</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnableDailyTargetCount(true)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    enableDailyTargetCount
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold">回数を指定する</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">1日何回達成するかを設定</span>
                </button>
              </div>

              {enableDailyTargetCount && (
                <div className="pt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">1日あたりの目標回数:</span>
                  <NumberStepper
                    value={dailyTargetCount}
                    onChange={setDailyTargetCount}
                    min={1}
                    max={10}
                    step={1}
                    unit="回/日"
                  />
                </div>
              )}
            </div>
          )}

          {/* 10. 次の予定までの休み時間（固定枠のみ表示） */}
          {tableType === 'fixed' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    10. 次の予定までの休み時間は必要ですか？
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    各コマの間に自動挿入される休憩・移動時間です（直接入力可能）
                  </p>
                </div>
                <NumberStepper
                  value={fixedIntervalMinutes}
                  onChange={val => setFixedIntervalMinutes(val)}
                  min={0}
                  max={120}
                  step={5}
                  unit="分"
                />
              </div>
            </div>
          )}

          {/* 11. 昼休み（お昼休憩）は設けますか？（固定枠のみ表示） */}
          {tableType === 'fixed' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-900">
                11. 昼休み（お昼休憩）は設けますか？
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHasLunch(false)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    !hasLunch
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold">設けない（なし）</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">通常の休み時間のみ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHasLunch(true)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    hasLunch
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold">昼休みを設ける</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">指定コマ後に長い休憩を挟む</span>
                </button>
              </div>

              {hasLunch && (
                <div className="space-y-3 pt-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-700">昼休みを挟むタイミング:</span>
                      <p className="text-[10px] text-slate-400">何コマ目の終了後に昼休みにするか</p>
                    </div>
                    <NumberStepper
                      value={lunchAfterPeriod}
                      onChange={setLunchAfterPeriod}
                      min={1}
                      max={Math.max(1, tableTaskCount - 1)}
                      step={1}
                      unit="コマ目の後"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">昼休みの長さ:</span>
                    <NumberStepper
                      value={lunchMinutes}
                      onChange={setLunchMinutes}
                      min={10}
                      max={180}
                      step={5}
                      unit="分"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 12. 課題・予習復習が出ますか？（固定枠のみ表示、タスク名入力撤廃で所要時間のみ） */}
          {tableType === 'fixed' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableAttachedTask}
                  onChange={e => setEnableAttachedTask(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900">
                  12. この予定に課題や予習・復習が出ますか？
                </span>
              </label>
              {enableAttachedTask && (
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 flex items-center justify-between mt-1.5">
                  <span className="text-xs font-bold text-slate-800">
                    課題・復習の所要時間:
                  </span>
                  <NumberStepper
                    value={attachedTaskDuration}
                    onChange={val => setAttachedTaskDuration(val)}
                    min={5}
                    max={240}
                    step={5}
                    unit="分"
                  />
                </div>
              )}
            </div>
          )}

          {/* 13. 週に何回取り組みますか？（週次タスクのみ表示） */}
          {tableType === 'weekly' && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    13. 週に何回取り組みますか？
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    1週間の目標ノルマです（直接自由に入力できます）
                  </p>
                </div>
                <NumberStepper
                  value={weeklyTargetCount}
                  onChange={val => setWeeklyTargetCount(val)}
                  min={1}
                  max={7}
                  step={1}
                  unit="回/週"
                />
              </div>
            </div>
          )}

          {/* 14. 代表予定の自動配置（新規作成時のみ表示） */}
          {!effectiveIsEdit && (
            <div className="pt-3 border-t border-slate-200">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSampleTasks}
                  onChange={e => setIncludeSampleTasks(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900">
                    「{currentTheme.label}」の代表予定（サンプル）を自動配置する
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    {includeSampleTasks
                      ? '作成後、メイン画面のセルで直接文字を書き換えたりコマを調整できます'
                      : '枠組み（時間帯・コマ時間・枠数）だけが設定された空の表を作成します'}
                  </p>
                </div>
              </label>
            </div>
          )}
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
                    ? `「${tableName || 'この表'}」を作成（${tableTaskCount}${tableType === 'fixed' ? 'コマ' : '個'}・代表予定入り）`
                    : `「${tableName || 'この表'}」を作成（${tableTaskCount}${tableType === 'fixed' ? 'コマ' : '個'}の空表）`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
