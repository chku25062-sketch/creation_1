'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Plus,
  Trash2,
  Clock,
  Zap,
  Sun,
  CalendarDays,
  X,
  GraduationCap,
  CheckSquare,
  Shield,
  Moon,
  Utensils,
  Coffee,
  Pencil,
  CheckCircle2,
  Circle,
  Repeat,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import {
  TaskItem,
  TaskPriority,
  TaskPeriod,
  TaskType,
  TaskDurationSize,
  TaskFrequency,
  FixedSlot,
  FixedCategory,
  ImportedTableData,
} from '@/types';
import { formatDuration, minutesToTimeString, timeStringToMinutes } from '@/lib/timeUtils';

export interface TaskManagerProps {
  tasks: TaskItem[];
  onChange: (newTasks: TaskItem[]) => void;
  slots: FixedSlot[];
  onSlotsChange: (newSlots: FixedSlot[]) => void;
  tables?: ImportedTableData[];
  onNavigateToTimeline?: () => void;
  viewMode?: 'all' | 'daily' | 'weekly' | 'slots';
  embedded?: boolean;
}

const DAY_LABELS = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];
const WEEKDAY_SHORT = ['月', '火', '水', '木', '金', '土', '日'];

const PRESET_TASKS: Omit<TaskItem, 'id'>[] = [
  {
    title: 'プログラミング課題レポート',
    category: 'must',
    durationSize: 'medium',
    durationMinutes: 60,
    frequency: 'low',
    priority: 'high',
    period: 'week',
    taskType: 'assignment',
    startDay: 0,
    deadlineDay: 4,
  },
  {
    title: '基本情報・資格試験対策',
    category: 'want',
    durationSize: 'medium',
    durationMinutes: 60,
    frequency: 'high',
    priority: 'high',
    period: 'day',
    taskType: 'task',
  },
  {
    title: '教科書・参考書の購入',
    category: 'must',
    hasNoDuration: true,
    durationMinutes: 0,
    frequency: 'low',
    priority: 'medium',
    period: 'week',
    taskType: 'todo',
  },
  {
    title: 'ジム・筋トレ＆有酸素',
    category: 'want',
    durationSize: 'small',
    durationMinutes: 25,
    frequency: 'medium',
    priority: 'high',
    period: 'week',
    taskType: 'task',
  },
  {
    title: '個人プロダクト開発',
    category: 'want',
    durationSize: 'large',
    durationMinutes: 120,
    frequency: 'low',
    priority: 'high',
    period: 'week',
    taskType: 'task',
  },
];

export interface DurationOptionItem {
  size: TaskDurationSize;
  label: string;
  badge: string;
  desc: string;
}

export const DURATION_OPTIONS: DurationOptionItem[] = [
  { size: 'small', label: '小', badge: '15〜30分', desc: 'スキマ時間・小タスク' },
  { size: 'medium', label: '中', badge: '30分〜2h', desc: '標準作業・集中枠' },
  { size: 'large', label: '大', badge: '2h以上', desc: 'まとまった長時間' },
];

export interface FrequencyOptionItem {
  freq: TaskFrequency;
  label: string;
  badge: string;
  sub: string;
}

export const FREQUENCY_OPTIONS: FrequencyOptionItem[] = [
  { freq: 'low', label: '低', badge: '週1〜2回', sub: 'ゆったりペース' },
  { freq: 'medium', label: '中', badge: '週3〜4回', sub: '標準的ペース' },
  { freq: 'high', label: '高', badge: '週5回+ (毎日)', sub: '習慣化・日課' },
  { freq: 'custom', label: 'カスタム', badge: '週指定', sub: '自分で回数を設定' },
];

const PRESET_FIXED_SLOTS: Omit<FixedSlot, 'id'>[] = [
  {
    title: '睡眠 (良質な8時間休養)',
    category: 'sleep',
    startMinutes: 23 * 60,
    endMinutes: 7 * 60,
    color: '#6366f1',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    title: '大学講義 (2限・3限)',
    category: 'lecture',
    startMinutes: 10 * 60 + 40,
    endMinutes: 14 * 60 + 40,
    color: '#0284c7',
    daysOfWeek: [0, 2], // 月・水
  },
  {
    title: '本業・コア勤務',
    category: 'work',
    startMinutes: 9 * 60,
    endMinutes: 18 * 60,
    color: '#3b82f6',
    daysOfWeek: [0, 1, 2, 3, 4], // 平日
  },
  {
    title: 'アルバイト・シフト',
    category: 'work',
    startMinutes: 13 * 60,
    endMinutes: 18 * 60,
    color: '#3b82f6',
    daysOfWeek: [5, 6], // 土日
  },
  {
    title: '昼食 & リフレッシュ',
    category: 'meal',
    startMinutes: 12 * 60 + 10,
    endMinutes: 13 * 60,
    color: '#f59e0b',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
];

export function TaskManager({
  tasks,
  onChange,
  slots,
  onSlotsChange,
  tables,
  onNavigateToTimeline,
  viewMode = 'all',
  embedded = false,
}: TaskManagerProps) {
  // モーダル管理
  type ModalType = 'task' | 'slot' | null;
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  // 表での設定項目になぞらえたタスク設定ステート
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPeriodScope, setTaskPeriodScope] = useState<'day' | 'week'>('week'); // 🏃 日(1日複数回/日課) vs 🎯 週(週複数回/周期)
  const [taskGroupName, setTaskGroupName] = useState<string>('基本設定'); // 表名またはグループ名

  // 所要時間 & 休憩時間
  const [durationSize, setDurationSize] = useState<TaskDurationSize>('medium'); // 3択: 小(15〜30m), 中(30m〜2h), 大(2h+)
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [taskBreakMinutes, setTaskBreakMinutes] = useState<number>(0); // タスク後の休憩時間（分）
  const [isNoDurationTodo, setIsNoDurationTodo] = useState(false); // 時間枠なしToDo

  // 今日ビューで選択中の曜日 (0:月 〜 6:日、初期値は今日の曜日)
  const [selectedTodayDayIndex, setSelectedTodayDayIndex] = useState<number>(() => {
    const today = new Date().getDay(); // 0:日, 1:月, ...
    return (today + 6) % 7; // 0:月, ..., 6:日
  });

  // 日の設定: 1日の中の回数 & 実施タイミング (曜日・毎日 vs 周期)
  const [dailyTimingMode, setDailyTimingMode] = useState<'weekday' | 'cycle'>('weekday');
  const [dailyRepeatMode, setDailyRepeatMode] = useState<'auto' | 'custom'>('auto'); // 1日の中の繰り返し回数 ('auto': 自動, 'custom': 回数指定)
  const [dailyCount, setDailyCount] = useState<number>(1); // 1日あたりの目標回数 (1, 2, 3...)
  const [dailyDays, setDailyDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // 対象曜日 (全日は毎日)
  const [dailyCycleDays, setDailyCycleDays] = useState<number[]>([0]); // 周期で指定 (Day 1など)
  const [dailyCycleCount, setDailyCycleCount] = useState<number>(3); // 周期の長さ (3日周期など)

  // 週の設定: 表の列管理になぞらえた方式 (曜日指定 vs 周期指定 vs おまかせ)
  const [weekTimingMode, setWeekTimingMode] = useState<'weekday' | 'cycle' | 'flexible'>('weekday');
  const [weekTargetDays, setWeekTargetDays] = useState<number[]>([0, 2]); // 曜日で指定 (月・水など)
  const [weekCycleDays, setWeekCycleDays] = useState<number[]>([0]); // 周期で指定 (Day 1など)
  const [weekCycleCount, setWeekCycleCount] = useState<number>(3); // 周期の長さ (3日周期など)
  const [flexibleCount, setFlexibleCount] = useState<number>(2); // おまかせ週回数

  // 課題・期日オプション（週のタスクで締切がある場合）
  const [hasDeadline, setHasDeadline] = useState(false);
  const [startDay, setStartDay] = useState<number>(0);
  const [deadlineDay, setDeadlineDay] = useState<number>(4);

  // 指定日時以降に配置オプション（週タスク用）
  const [scheduleAfterEnabled, setScheduleAfterEnabled] = useState(false);
  const [scheduleAfterDay, setScheduleAfterDay] = useState<number>(0);
  const [scheduleAfterTime, setScheduleAfterTime] = useState<string>('12:10');

  // 表データ参照元情報
  const [taskSourceTableId, setTaskSourceTableId] = useState<string | undefined>(undefined);
  const [taskSourceTableName, setTaskSourceTableName] = useState<string | undefined>(undefined);

  // 固定枠用フォームステート
  const [slotTitle, setSlotTitle] = useState('');
  const [slotCategory, setSlotCategory] = useState<FixedCategory | string>('lecture');
  const [slotStartTime, setSlotStartTime] = useState('10:40');
  const [slotEndTime, setSlotEndTime] = useState('12:10');
  const [slotDays, setSlotDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [autoAddAssignment, setAutoAddAssignment] = useState(true);
  const [slotSourceTableId, setSlotSourceTableId] = useState<string | undefined>(undefined);
  const [slotSourceTableName, setSlotSourceTableName] = useState<string | undefined>(undefined);

  // 固定枠のソート & 絞り込みステート
  const [slotSortKey, setSlotSortKey] = useState<
    'time-asc' | 'time-desc' | 'title-asc' | 'category'
  >('time-asc');
  const [slotCategoryFilter, setSlotCategoryFilter] = useState<FixedCategory | 'all'>('all');
  const [slotDayFilter, setSlotDayFilter] = useState<number | 'all' | 'daily'>('all');
  const [isSlotFilterOpen, setIsSlotFilterOpen] = useState(false);
  const isSlotFilterActive = slotCategoryFilter !== 'all' || slotDayFilter !== 'all';

  // タスク（日課・週次）のソート & 絞り込みステート
  const [taskSortKey, setTaskSortKey] = useState<
    'priority' | 'duration-asc' | 'duration-desc' | 'title-asc' | 'category'
  >('priority');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('all');
  const [taskDayFilter, setTaskDayFilter] = useState<number | 'all'>('all');
  const [isDailyFilterOpen, setIsDailyFilterOpen] = useState(false);
  const [isWeeklyFilterOpen, setIsWeeklyFilterOpen] = useState(false);
  const isDailyFilterActive = taskCategoryFilter !== 'all' || taskDayFilter !== 'all';
  const isWeeklyFilterActive = taskCategoryFilter !== 'all' || taskDayFilter !== 'all';

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    if (modalType) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalType]);

  const closeModal = () => {
    setModalType(null);
    setEditingTaskId(null);
    setEditingSlotId(null);
  };

  // 所要時間の横ローテーション切り替え
  const rotateDuration = (dir: 'prev' | 'next') => {
    const curIdx = DURATION_OPTIONS.findIndex((d) => d.size === durationSize);
    const safeIdx = curIdx >= 0 ? curIdx : 1;
    const nextIdx =
      dir === 'next'
        ? (safeIdx + 1) % DURATION_OPTIONS.length
        : (safeIdx - 1 + DURATION_OPTIONS.length) % DURATION_OPTIONS.length;
    setDurationSize(DURATION_OPTIONS[nextIdx].size);
  };

  // タスク追加モーダルを開く
  const openAddTask = (
    presetPeriod: 'day' | 'week' = 'week',
    options?: {
      isAssignment?: boolean;
      isTodo?: boolean;
      groupName?: string;
    },
  ) => {
    setEditingTaskId(null);
    setTaskTitle(options?.isAssignment ? 'レポート課題' : '');
    setTaskPeriodScope(presetPeriod);
    setTaskGroupName(options?.groupName || '基本設定');
    setDailyTimingMode('weekday');
    setDailyRepeatMode('auto');
    setDailyCount(1);
    setDailyDays([0, 1, 2, 3, 4, 5, 6]);
    setDailyCycleDays([0]);
    setDailyCycleCount(3);
    setWeekTimingMode('weekday');
    setWeekTargetDays([0, 2]); // 月・水
    setWeekCycleDays([0]);
    setWeekCycleCount(3);
    setFlexibleCount(2);
    setDurationSize(options?.isTodo ? 'small' : 'medium');
    setDurationMinutes(options?.isTodo ? 0 : 60);
    setTaskBreakMinutes(0);
    setIsNoDurationTodo(!!options?.isTodo);
    setHasDeadline(!!options?.isAssignment);
    setStartDay(0);
    setDeadlineDay(4);
    setScheduleAfterEnabled(false);
    setScheduleAfterDay(0);
    setScheduleAfterTime('12:10');
    setTaskSourceTableId(undefined);
    setTaskSourceTableName(undefined);
    setModalType('task');
  };

  // 授業枠から課題タスク追加モーダルを開く（出題日=授業日、締切日=授業日前日、元タスクより後に時間設定）
  const openAddAssignmentFromLecture = (slot: FixedSlot) => {
    const lectureDay = slot.daysOfWeek && slot.daysOfWeek.length > 0 ? slot.daysOfWeek[0] : 0;
    const calcDeadlineDay = (lectureDay - 1 + 7) % 7; // 前日

    setEditingTaskId(null);
    setTaskTitle(`${slot.title} レポート課題`);
    setTaskPeriodScope('week');
    setTaskGroupName(slot.sourceTableName || slot.category || '授業課題');
    setDailyTimingMode('weekday');
    setDailyRepeatMode('auto');
    setDailyCount(1);
    setDailyDays([0, 1, 2, 3, 4, 5, 6]);
    setDailyCycleDays([0]);
    setDailyCycleCount(3);
    setWeekTimingMode('weekday');
    setWeekTargetDays([lectureDay]);
    setWeekCycleDays([0]);
    setWeekCycleCount(3);
    setFlexibleCount(1);
    setDurationSize('medium');
    setDurationMinutes(60);
    setTaskBreakMinutes(15);
    setIsNoDurationTodo(false);
    setHasDeadline(true);
    setStartDay(lectureDay);
    setDeadlineDay(calcDeadlineDay);
    setScheduleAfterEnabled(true);
    setScheduleAfterDay(lectureDay);
    setScheduleAfterTime(minutesToTimeString(slot.endMinutes));
    setTaskSourceTableId(slot.sourceTableId);
    setTaskSourceTableName(slot.sourceTableName);
    setModalType('task');
  };

  // タスク編集モーダルを開く
  const openEditTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskBreakMinutes(task.breakMinutes || 0);
    const isDaily = task.period === 'day' || task.frequency === 'high';
    setTaskPeriodScope(isDaily ? 'day' : 'week');
    setTaskGroupName(task.sourceTableName || task.category || '基本設定');

    // 日の設定復元
    if (task.dailyRepeatMode === 'custom' && task.dailyCount !== undefined) {
      setDailyRepeatMode('custom');
      setDailyCount(task.dailyCount);
    } else if (task.dailyCount && task.dailyCount > 1) {
      setDailyRepeatMode('custom');
      setDailyCount(task.dailyCount);
    } else if (task.dailyRepeatMode === 'auto' || task.dailyCount === undefined) {
      setDailyRepeatMode('auto');
      setDailyCount(1);
    } else {
      setDailyRepeatMode('auto');
      setDailyCount(1);
    }
    if (task.cycleDays && task.cycleDays.length > 0) {
      setDailyTimingMode('cycle');
      setDailyCycleDays([...task.cycleDays]);
      setDailyCycleCount(task.cycleCount || 3);
      setDailyDays([0, 1, 2, 3, 4, 5, 6]);
    } else {
      setDailyTimingMode('weekday');
      setDailyDays(
        task.targetDays && task.targetDays.length > 0
          ? [...task.targetDays]
          : [0, 1, 2, 3, 4, 5, 6],
      );
      setDailyCycleDays([0]);
      setDailyCycleCount(3);
    }

    // 週の設定復元
    if (task.cycleDays && task.cycleDays.length > 0) {
      setWeekTimingMode('cycle');
      setWeekCycleDays([...task.cycleDays]);
      setWeekCycleCount(task.cycleCount || 3);
      setWeekTargetDays([0, 2]);
      setFlexibleCount(task.cycleDays.length);
    } else if (task.targetDays && task.targetDays.length > 0) {
      setWeekTimingMode('weekday');
      setWeekTargetDays([...task.targetDays]);
      setWeekCycleDays([0]);
      setWeekCycleCount(3);
      setFlexibleCount(task.targetDays.length);
    } else if (task.frequencyCount) {
      setWeekTimingMode('flexible');
      setFlexibleCount(task.frequencyCount);
      setWeekTargetDays([0, 2]);
      setWeekCycleDays([0]);
      setWeekCycleCount(3);
    } else {
      setWeekTimingMode('weekday');
      setWeekTargetDays(task.startDay !== undefined ? [task.startDay] : [0, 2]);
      setWeekCycleDays([0]);
      setWeekCycleCount(3);
      setFlexibleCount(2);
    }

    // 所要時間復元
    const isTodo = !!task.hasNoDuration || task.taskType === 'todo';
    setIsNoDurationTodo(isTodo);
    setDurationMinutes(task.durationMinutes || (isTodo ? 0 : 60));
    setDurationSize(
      task.durationSize ||
        (task.durationMinutes < 30 ? 'small' : task.durationMinutes >= 120 ? 'large' : 'medium'),
    );

    // 締切オプション復元
    const hasDl = task.taskType === 'assignment' || task.deadlineDay !== undefined;
    setHasDeadline(hasDl);
    setStartDay(task.startDay ?? 0);
    setDeadlineDay(task.deadlineDay ?? 4);

    // 指定日時以降オプション復元
    const isScheduleAfter =
      !!task.scheduleAfterEnabled ||
      (task.period === 'week' &&
        task.earliestStartTime !== undefined &&
        !task.autoPlaceWithinRange &&
        task.earliestStartTime > 0);
    setScheduleAfterEnabled(isScheduleAfter);
    setScheduleAfterDay(task.scheduleAfterDay ?? task.startDay ?? 0);
    const formattedTime =
      typeof task.scheduleAfterTime === 'string'
        ? task.scheduleAfterTime
        : task.scheduleAfterTime !== undefined
          ? minutesToTimeString(task.scheduleAfterTime)
          : task.earliestStartTime !== undefined && task.earliestStartTime > 0
            ? minutesToTimeString(task.earliestStartTime)
            : '12:10';
    setScheduleAfterTime(formattedTime);

    setTaskSourceTableId(task.sourceTableId);
    setTaskSourceTableName(task.sourceTableName);
    setModalType('task');
  };

  // 固定枠追加モーダルを開く
  const openAddSlot = () => {
    setEditingSlotId(null);
    setSlotTitle('');
    setSlotCategory('lecture');
    setSlotStartTime('10:40');
    setSlotEndTime('12:10');
    setSlotDays([0, 2]); // 月・水
    setAutoAddAssignment(true);
    setSlotSourceTableId(undefined);
    setSlotSourceTableName(undefined);
    setModalType('slot');
  };

  // 固定枠編集モーダルを開く
  const openEditSlot = (slot: FixedSlot) => {
    setEditingSlotId(slot.id);
    setSlotTitle(slot.title);
    setSlotCategory(slot.category);
    setSlotStartTime(minutesToTimeString(slot.startMinutes));
    setSlotEndTime(minutesToTimeString(slot.endMinutes));
    setSlotDays(slot.daysOfWeek ? [...slot.daysOfWeek] : [0, 1, 2, 3, 4, 5, 6]);
    setSlotSourceTableId(slot.sourceTableId);
    setSlotSourceTableName(slot.sourceTableName);
    setModalType('slot');
  };

  // タスク保存（新規・更新共通）
  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    // 所要時間の基準値
    const defaultMinutes = isNoDurationTodo
      ? 0
      : durationMinutes > 0
        ? durationMinutes
        : durationSize === 'small'
          ? 25
          : durationSize === 'medium'
            ? 60
            : 120;

    const period: TaskPeriod = taskPeriodScope === 'day' ? 'day' : 'week';
    const finalDailyCount =
      taskPeriodScope === 'day'
        ? dailyRepeatMode === 'auto'
          ? undefined
          : Math.max(1, dailyCount)
        : undefined;
    const taskType: TaskType = isNoDurationTodo ? 'todo' : hasDeadline ? 'assignment' : 'task';
    const priority: TaskPriority = hasDeadline ? 'high' : 'medium';
    const finalCategory = taskSourceTableName || taskGroupName.trim() || '基本設定';

    // 実施タイミングの設定
    let targetDays: number[] | undefined = undefined;
    let cycleDays: number[] | undefined = undefined;
    let cycleCount: number | undefined = undefined;
    let frequency: TaskFrequency = 'medium';
    let frequencyCount: number | undefined = undefined;

    if (period === 'day') {
      frequency = 'high';
      if (dailyTimingMode === 'cycle') {
        cycleDays = dailyCycleDays.length > 0 ? [...dailyCycleDays].sort((a, b) => a - b) : [0];
        cycleCount = Math.max(2, dailyCycleCount);
        targetDays = undefined;
      } else {
        targetDays = dailyDays.length < 7 ? [...dailyDays].sort((a, b) => a - b) : undefined;
        cycleDays = undefined;
        cycleCount = undefined;
      }
    } else {
      // 週の場合
      if (weekTimingMode === 'weekday') {
        targetDays = weekTargetDays.length > 0 ? [...weekTargetDays].sort((a, b) => a - b) : [0];
        frequency = targetDays.length >= 5 ? 'high' : targetDays.length >= 3 ? 'medium' : 'low';
        frequencyCount = targetDays.length;
      } else if (weekTimingMode === 'cycle') {
        cycleDays = weekCycleDays.length > 0 ? [...weekCycleDays].sort((a, b) => a - b) : [0];
        cycleCount = Math.max(2, weekCycleCount);
        frequency = 'medium';
        frequencyCount = cycleDays.length;
      } else {
        // flexible (おまかせ週N回)
        frequency = flexibleCount >= 5 ? 'high' : flexibleCount >= 3 ? 'medium' : 'low';
        frequencyCount = flexibleCount;
      }
    }

    const scheduleAfterMinutes =
      taskPeriodScope === 'week' && scheduleAfterEnabled
        ? timeStringToMinutes(scheduleAfterTime)
        : undefined;

    const taskPayload = {
      title: taskTitle.trim(),
      category: finalCategory,
      durationSize,
      durationMinutes: defaultMinutes,
      breakMinutes: taskBreakMinutes > 0 ? taskBreakMinutes : undefined,
      hasNoDuration: isNoDurationTodo,
      frequency,
      frequencyCount,
      period,
      dailyCount: finalDailyCount,
      dailyRepeatMode: taskPeriodScope === 'day' ? dailyRepeatMode : undefined,
      targetDays,
      cycleDays,
      cycleCount,
      taskType,
      priority,
      startDay:
        taskPeriodScope === 'week' && scheduleAfterEnabled
          ? scheduleAfterDay
          : hasDeadline
            ? startDay
            : (targetDays && targetDays[0] !== undefined ? targetDays[0] : undefined),
      deadlineDay: hasDeadline ? deadlineDay : undefined,
      scheduleAfterEnabled: taskPeriodScope === 'week' ? scheduleAfterEnabled : undefined,
      scheduleAfterDay: taskPeriodScope === 'week' && scheduleAfterEnabled ? scheduleAfterDay : undefined,
      scheduleAfterTime: taskPeriodScope === 'week' && scheduleAfterEnabled ? scheduleAfterTime : undefined,
      earliestStartTime: scheduleAfterMinutes,
      cycleIndex: cycleDays && cycleDays.length > 0 ? cycleDays[0] : undefined,
      sourceTableId: taskSourceTableId,
      sourceTableName: taskSourceTableName || (taskSourceTableId ? finalCategory : undefined),
    };

    if (editingTaskId) {
      onChange(
        tasks.map((t) =>
          t.id === editingTaskId
            ? {
                ...t,
                ...taskPayload,
              }
            : t,
        ),
      );
    } else {
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        completed: false,
        ...taskPayload,
      };
      onChange([...tasks, newTask]);
    }

    closeModal();
  };

  // モーダル内からのタスク削除
  const handleDeleteCurrentTask = () => {
    if (editingTaskId) {
      onChange(tasks.filter((t) => t.id !== editingTaskId));
      closeModal();
    }
  };

  // 固定枠保存（新規・更新共通）
  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotTitle.trim()) return;

    const startMinutes = timeStringToMinutes(slotStartTime);
    const endMinutes = timeStringToMinutes(slotEndTime);

    const categoryColors: Record<string, string> = {
      sleep: '#6366f1',
      work: '#3b82f6',
      lecture: '#0284c7',
      routine: '#64748b',
      meal: '#f59e0b',
      other: '#94a3b8',
    };

    if (editingSlotId) {
      onSlotsChange(
        slots.map((s) =>
          s.id === editingSlotId
            ? {
                ...s,
                title: slotTitle.trim(),
                category: slotCategory,
                startMinutes,
                endMinutes,
                color: categoryColors[slotCategory] || '#0284c7',
                daysOfWeek: [...slotDays],
                sourceTableId: slotSourceTableId,
                sourceTableName: slotSourceTableName,
              }
            : s,
        ),
      );
    } else {
      const newSlot: FixedSlot = {
        id: `fixed-${Date.now()}`,
        title: slotTitle.trim(),
        category: slotCategory,
        startMinutes,
        endMinutes,
        color: categoryColors[slotCategory] || '#0284c7',
        daysOfWeek: [...slotDays],
        sourceTableId: slotSourceTableId,
        sourceTableName: slotSourceTableName,
      };
      onSlotsChange([...slots, newSlot]);

      // 授業が追加され、自動追加がONの場合、対応する課題タスクも自動生成
      if (slotCategory === 'lecture' && autoAddAssignment) {
        const lectureDay = slotDays.length > 0 ? slotDays[0] : 0;
        const calcDeadlineDay = (lectureDay - 1 + 7) % 7;
        const autoAssignment: TaskItem = {
          id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: `${slotTitle.trim()} レポート課題`,
          category: 'must',
          durationSize: 'medium',
          durationMinutes: 60,
          frequency: 'low',
          taskType: 'assignment',
          startDay: lectureDay,
          deadlineDay: calcDeadlineDay,
          // ★ 元タスクより後に時間を設定
          scheduleAfterEnabled: true,
          scheduleAfterDay: lectureDay,
          scheduleAfterTime: slotEndTime,
          earliestStartTime: endMinutes,
          parentTitle: slotTitle.trim(),
          parentEndMinutesByDay: { [lectureDay]: endMinutes },
          priority: 'high',
          period: 'week',
          completed: false,
          sourceTableId: slotSourceTableId,
          sourceTableName: slotSourceTableName,
        };
        onChange([...tasks, autoAssignment]);
      }
    }

    closeModal();
  };

  // モーダル内からの固定枠削除
  const handleDeleteCurrentSlot = () => {
    if (editingSlotId) {
      onSlotsChange(slots.filter((s) => s.id !== editingSlotId));
      closeModal();
    }
  };

  const handleAddPresetTask = (preset: Omit<TaskItem, 'id'>) => {
    const newTask: TaskItem = {
      ...preset,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      completed: false,
    };
    onChange([...tasks, newTask]);
  };

  const handleAddPresetSlot = (preset: Omit<FixedSlot, 'id'>) => {
    const newSlot: FixedSlot = {
      ...preset,
      id: `fixed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    onSlotsChange([...slots, newSlot]);

    // お試しで授業が追加された場合、対応する課題タスクも自動生成
    if (preset.category === 'lecture') {
      const lectureDay =
        preset.daysOfWeek && preset.daysOfWeek.length > 0 ? preset.daysOfWeek[0] : 0;
      const calcDeadlineDay = (lectureDay - 1 + 7) % 7;
      const autoAssignment: TaskItem = {
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: `${preset.title} レポート課題`,
        category: 'must',
        durationSize: 'medium',
        durationMinutes: 60,
        frequency: 'low',
        taskType: 'assignment',
        startDay: lectureDay,
        deadlineDay: calcDeadlineDay,
        priority: 'high',
        period: 'week',
        completed: false,
      };
      onChange([...tasks, autoAssignment]);
    }
  };

  const handleToggleComplete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleDeleteTask = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(tasks.filter((t) => t.id !== id));
  };

  const handleDeleteSlot = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSlotsChange(slots.filter((s) => s.id !== id));
  };

  const toggleSlotDay = (dayIndex: number) => {
    if (slotDays.includes(dayIndex)) {
      if (slotDays.length > 1) {
        setSlotDays(slotDays.filter((d) => d !== dayIndex));
      }
    } else {
      setSlotDays([...slotDays, dayIndex].sort());
    }
  };

  const setSlotDaysPreset = (preset: 'all' | 'weekdays' | 'weekend') => {
    if (preset === 'all') setSlotDays([0, 1, 2, 3, 4, 5, 6]);
    else if (preset === 'weekdays') setSlotDays([0, 1, 2, 3, 4]);
    else if (preset === 'weekend') setSlotDays([5, 6]);
  };

  const getSlotCategoryIcon = (cat: FixedCategory | string) => {
    switch (cat) {
      case 'sleep':
        return <Moon className="h-3.5 w-3.5 text-indigo-400" />;
      case 'lecture':
        return <GraduationCap className="h-3.5 w-3.5 text-sky-400" />;
      case 'work':
        return <Briefcase className="h-3.5 w-3.5 text-blue-400" />;
      case 'meal':
        return <Utensils className="h-3.5 w-3.5 text-amber-400" />;
      default:
        return <Coffee className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const formatDaysString = (days?: number[]) => {
    if (!days || days.length === 0 || days.length === 7) return '毎日';
    if (days.length === 5 && [0, 1, 2, 3, 4].every((d) => days.includes(d))) return '平日';
    if (days.length === 2 && [5, 6].every((d) => days.includes(d))) return '土日';
    return days.map((d) => WEEKDAY_SHORT[d]).join('・');
  };

  // 表データ参照元ファイル名の取得（直接保持している名前、または tables から逆引き、過去のID規則からのフォールバック）
  const getTaskSourceFileName = (task: TaskItem): string | null => {
    if (task.sourceTableName) {
      return task.sourceTableName;
    }
    if (task.sourceTableId && tables) {
      const found = tables.find((t) => t.id === task.sourceTableId);
      if (found) return found.name;
    }
    // フォールバック: IDの命名規則 (task-assignment-${tableId}-...) から検索
    if (task.id.startsWith('task-assignment-') && tables) {
      const found = tables.find((t) => task.id.includes(t.id));
      if (found) return found.name;
    }
    return null;
  };

  // 固定枠の表データ参照元ファイル名の取得
  const getSlotSourceFileName = (slot: FixedSlot): string | null => {
    if (slot.sourceTableName) {
      return slot.sourceTableName;
    }
    if (slot.sourceTableId && tables) {
      const found = tables.find((t) => t.id === slot.sourceTableId);
      if (found) return found.name;
    }
    // フォールバック: IDの命名規則 (slot-table-${tableId}-... または slot-lecture-${tableId}-...) から検索
    if ((slot.id.startsWith('slot-table-') || slot.id.startsWith('slot-lecture-')) && tables) {
      const found = tables.find((t) => slot.id.includes(t.id));
      if (found) return found.name;
    }
    return null;
  };

  // 分割データ: 頻度「高 (週5回以上)」または period 'day' を日ごとスタックに配置
  const dailyTasks = tasks.filter((t) => t.period === 'day' || t.frequency === 'high');
  const weeklyTasks = tasks.filter((t) => !(t.period === 'day' || t.frequency === 'high'));

  const dailyTotalMinutes = dailyTasks.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);
  const weeklyTotalMinutes = weeklyTasks.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);

  // 登録済み授業
  const lectureSlots = slots.filter((s) => s.category === 'lecture');

  // 絞り込み & 並び替えされた固定枠
  const filteredAndSortedSlots = useMemo(() => {
    let result = [...slots];

    // 1. カテゴリ絞り込み
    if (slotCategoryFilter !== 'all') {
      result = result.filter((s) => s.category === slotCategoryFilter);
    }

    // 2. 曜日絞り込み
    if (slotDayFilter !== 'all') {
      if (slotDayFilter === 'daily') {
        // 全日
        result = result.filter(
          (s) => !s.daysOfWeek || s.daysOfWeek.length === 0 || s.daysOfWeek.length === 7,
        );
      } else {
        const targetDay = Number(slotDayFilter);
        result = result.filter((s) => {
          if (!s.daysOfWeek || s.daysOfWeek.length === 0) return true; // 全日枠なら含む
          return s.daysOfWeek.includes(targetDay);
        });
      }
    }

    // 3. 並び替え
    result.sort((a, b) => {
      if (slotSortKey === 'time-asc') {
        return a.startMinutes - b.startMinutes;
      }
      if (slotSortKey === 'time-desc') {
        return b.startMinutes - a.startMinutes;
      }
      if (slotSortKey === 'title-asc') {
        return a.title.localeCompare(b.title, 'ja');
      }
      if (slotSortKey === 'category') {
        return a.category.localeCompare(b.category);
      }
      return 0;
    });

    return result;
  }, [slots, slotCategoryFilter, slotDayFilter, slotSortKey]);

  // 選択された曜日にタスクが該当・実行されるかの判定
  const isTaskActiveOnDay = (t: TaskItem, day: number) => {
    if (t.cycleDays && t.cycleDays.length > 0) {
      const cCount = t.cycleCount || 3;
      return t.cycleDays.includes(day % cCount);
    }
    if (t.targetDays && t.targetDays.length > 0) {
      return t.targetDays.includes(day);
    }
    if (t.deadlineDay !== undefined && t.deadlineDay === day) return true;
    if (t.startDay !== undefined && t.startDay === day) return true;
    if (t.period === 'day' || t.frequency === 'high') return true;
    return false;
  };

  // 絞り込み & 並び替えされた日課・今日タスク
  const filteredAndSortedDailyTasks = useMemo(() => {
    // viewMode === 'daily' のときは、今日（選択曜日）に用いられている全タスク（日課＋週タスク/課題）を対象にできる
    let sourcePool =
      viewMode === 'daily'
        ? tasks.filter((t) => isTaskActiveOnDay(t, selectedTodayDayIndex))
        : [...dailyTasks];

    let result = sourcePool;

    // 1. カテゴリ/グループ絞り込み
    if (taskCategoryFilter !== 'all') {
      if (taskCategoryFilter === 'todo') {
        result = result.filter((t) => t.taskType === 'todo' || t.hasNoDuration);
      } else if (taskCategoryFilter === 'assignment') {
        result = result.filter((t) => t.taskType === 'assignment');
      } else {
        result = result.filter(
          (t) =>
            t.category === taskCategoryFilter ||
            t.sourceTableName === taskCategoryFilter ||
            getTaskSourceFileName(t) === taskCategoryFilter,
        );
      }
    }

    // 2. 曜日絞り込み（all時または補助フィルター）
    if (taskDayFilter !== 'all') {
      const targetDay = Number(taskDayFilter);
      result = result.filter((t) => isTaskActiveOnDay(t, targetDay));
    }

    // 3. 並び替え
    result.sort((a, b) => {
      if (taskSortKey === 'priority') {
        const pWeight = { high: 3, medium: 2, low: 1 };
        return (pWeight[b.priority] || 2) - (pWeight[a.priority] || 2);
      }
      if (taskSortKey === 'duration-asc') {
        return (a.durationMinutes || 0) - (b.durationMinutes || 0);
      }
      if (taskSortKey === 'duration-desc') {
        return (b.durationMinutes || 0) - (a.durationMinutes || 0);
      }
      if (taskSortKey === 'title-asc') {
        return a.title.localeCompare(b.title, 'ja');
      }
      if (taskSortKey === 'category') {
        return a.category.localeCompare(b.category);
      }
      return 0;
    });

    return result;
  }, [
    tasks,
    dailyTasks,
    viewMode,
    selectedTodayDayIndex,
    taskCategoryFilter,
    taskDayFilter,
    taskSortKey,
  ]);

  // 絞り込み & 並び替えされた週次タスク
  const filteredAndSortedWeeklyTasks = useMemo(() => {
    let result = [...weeklyTasks];

    // 1. カテゴリ/グループ絞り込み
    if (taskCategoryFilter !== 'all') {
      if (taskCategoryFilter === 'assignment') {
        result = result.filter((t) => t.taskType === 'assignment');
      } else if (taskCategoryFilter === 'todo') {
        result = result.filter((t) => t.taskType === 'todo' || t.hasNoDuration);
      } else {
        result = result.filter(
          (t) =>
            t.category === taskCategoryFilter ||
            t.sourceTableName === taskCategoryFilter ||
            getTaskSourceFileName(t) === taskCategoryFilter,
        );
      }
    }

    // 2. 曜日絞り込み（実施曜日または課題の締切日）
    if (taskDayFilter !== 'all') {
      const targetDay = Number(taskDayFilter);
      result = result.filter((t) => {
        if (t.cycleDays && t.cycleDays.length > 0) {
          const cCount = t.cycleCount || 3;
          if (t.cycleDays.includes(targetDay % cCount)) return true;
        }
        if (t.targetDays && t.targetDays.length > 0) {
          return t.targetDays.includes(targetDay);
        }
        if (t.deadlineDay !== undefined && t.deadlineDay === targetDay) return true;
        if (t.startDay !== undefined && t.startDay === targetDay) return true;
        return false;
      });
    }

    // 3. 並び替え
    result.sort((a, b) => {
      if (taskSortKey === 'priority') {
        const isAssignA = a.taskType === 'assignment' || a.deadlineDay !== undefined;
        const isAssignB = b.taskType === 'assignment' || b.deadlineDay !== undefined;
        if (isAssignA && !isAssignB) return -1;
        if (!isAssignA && isAssignB) return 1;
        const pWeight = { high: 3, medium: 2, low: 1 };
        return (pWeight[b.priority] || 2) - (pWeight[a.priority] || 2);
      }
      if (taskSortKey === 'duration-asc') {
        return (a.durationMinutes || 0) - (b.durationMinutes || 0);
      }
      if (taskSortKey === 'duration-desc') {
        return (b.durationMinutes || 0) - (a.durationMinutes || 0);
      }
      if (taskSortKey === 'title-asc') {
        return a.title.localeCompare(b.title, 'ja');
      }
      if (taskSortKey === 'category') {
        return a.category.localeCompare(b.category);
      }
      return 0;
    });

    return result;
  }, [weeklyTasks, taskCategoryFilter, taskDayFilter, taskSortKey]);

  return (
    <div
      className={`flex flex-1 min-h-0 flex-col gap-2.5 ${
        embedded
          ? 'bg-transparent p-0'
          : 'rounded-2xl border border-amber-900/10 bg-[#fbfaf5]/90 p-3 shadow-xs sm:p-4'
      }`}
    >
      {/* Top Header & Presets (slotsモード時は追加・並び替え・絞り込みツールバーに切り替え) */}
      {viewMode === 'slots' ? (
        <div className="flex flex-col gap-2 shrink-0 rounded-xl border border-slate-200/90 bg-white/80 backdrop-blur-xs p-2.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* ファイル（固定枠）追加ボタン & クイック例 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openAddSlot}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-sky-700 active:scale-98"
                title="新しい固定枠を追加する"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>固定枠を追加</span>
              </button>

              {/* 絞り込みトグルボタン */}
              <button
                type="button"
                onClick={() => setIsSlotFilterOpen(!isSlotFilterOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition shadow-2xs active:scale-95 ${
                  isSlotFilterOpen
                    ? 'border-sky-300 bg-sky-50 text-sky-700'
                    : isSlotFilterActive
                      ? 'border-sky-300 bg-sky-50/70 text-sky-700 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title={isSlotFilterOpen ? '絞り込みツールを閉じる' : '絞り込みツールを開く'}
                aria-expanded={isSlotFilterOpen}
              >
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">絞り込み</span>
                {isSlotFilterActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                )}
                {isSlotFilterOpen ? (
                  <ChevronUp className="h-3 w-3 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                )}
              </button>
            </div>

            {/* 並び替え & 件数 */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 hidden xs:inline font-medium text-[11px]">
                  並び替え:
                </span>
                <div className="relative inline-flex items-center">
                  <ArrowUpDown className="h-3 w-3 text-slate-500 absolute left-2 pointer-events-none" />
                  <select
                    value={slotSortKey}
                    onChange={(e) =>
                      setSlotSortKey(
                        e.target.value as 'time-asc' | 'time-desc' | 'title-asc' | 'category',
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white pl-6.5 pr-6 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 appearance-none cursor-pointer"
                  >
                    <option value="time-asc">時間順 (早→遅)</option>
                    <option value="time-desc">時間順 (遅→早)</option>
                    <option value="title-asc">名前順 (あ→ん)</option>
                    <option value="category">カテゴリ順</option>
                  </select>
                  <ChevronDown className="h-3 w-3 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
              </div>

              <span className="text-[11px] font-bold text-slate-500 font-mono bg-slate-100 rounded-md px-2 py-0.5">
                {filteredAndSortedSlots.length}/{slots.length}件
              </span>
            </div>
          </div>

          {/* 絞り込み行: カテゴリ & 曜日 (折り畳み式) */}
          {isSlotFilterOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs animate-in fade-in duration-150">
              {/* カテゴリ絞り込み */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">カテゴリ:</span>
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'sleep', label: '睡眠' },
                  { id: 'lecture', label: '講義' },
                  { id: 'routine', label: 'ルーティン' },
                  { id: 'meal', label: '食事' },
                  { id: 'work', label: '勤務' },
                  { id: 'other', label: 'その他' },
                ].map((cat) => {
                  const isActive = slotCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSlotCategoryFilter(cat.id as FixedCategory | 'all')}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                        isActive
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* 曜日絞り込み */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">曜日:</span>
                <button
                  type="button"
                  onClick={() => setSlotDayFilter('all')}
                  className={`rounded-lg px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    slotDayFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  全
                </button>
                {[
                  { day: 0, label: '月' },
                  { day: 1, label: '火' },
                  { day: 2, label: '水' },
                  { day: 3, label: '木' },
                  { day: 4, label: '金' },
                  { day: 5, label: '土' },
                  { day: 6, label: '日' },
                ].map((d) => {
                  const isActive = slotDayFilter === d.day;
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => setSlotDayFilter(isActive ? 'all' : d.day)}
                      className={`h-5.5 w-5.5 rounded-md text-[11px] font-bold flex items-center justify-center transition ${
                        isActive
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : d.day === 5
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : d.day === 6
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
                {(slotCategoryFilter !== 'all' || slotDayFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSlotCategoryFilter('all');
                      setSlotDayFilter('all');
                    }}
                    className="ml-1 text-[10px] font-medium text-slate-400 hover:text-rose-600 underline"
                  >
                    解除
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'daily' ? (
        /* 📅 今日用いられているタスク（曜日切り替えセレクタ付き） */
        <div className="flex flex-col gap-2 shrink-0 rounded-xl border border-amber-200/90 bg-white/90 backdrop-blur-xs p-2.5 shadow-2xs">
          {/* サブツール案内バナー */}
          <div className="flex items-center justify-between text-[11px] bg-amber-50/80 border border-amber-200/60 rounded-lg px-2.5 py-1 text-amber-900">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="text-amber-600 font-bold">💡</span>
              <span>表データ（時間割・週間計画等）がタスク登録の主役です。ここでは選択した曜日に割り振られるタスクの詳細確認・管理が行えます。</span>
            </span>
          </div>

          {/* 曜日切り替えタブバー */}
          <div className="flex items-center justify-between gap-1 bg-amber-100/40 p-1 rounded-lg border border-amber-200/60">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              <span className="text-[11px] font-bold text-amber-900 px-1 shrink-0 flex items-center gap-1">
                <Sun className="h-3.5 w-3.5 text-amber-600" />
                <span>表示する曜日:</span>
              </span>
              {[
                { day: 0, label: '月曜日' },
                { day: 1, label: '火曜日' },
                { day: 2, label: '水曜日' },
                { day: 3, label: '木曜日' },
                { day: 4, label: '金曜日' },
                { day: 5, label: '土曜日' },
                { day: 6, label: '日曜日' },
              ].map((d) => {
                const isSelected = selectedTodayDayIndex === d.day;
                const isRealToday = ((new Date().getDay() + 6) % 7) === d.day;
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => setSelectedTodayDayIndex(d.day)}
                    className={`relative px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : isRealToday
                          ? 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'
                          : 'bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <span>{d.label}</span>
                    {isRealToday && (
                      <span
                        className={`text-[9px] px-1 rounded-full font-black ${
                          isSelected ? 'bg-amber-800 text-amber-100' : 'bg-amber-600 text-white'
                        }`}
                      >
                        今日
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTodayDayIndex((new Date().getDay() + 6) % 7)}
              className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline px-1 shrink-0"
            >
              今日に戻す
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 追加ボタン & プリセット */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openAddTask('day')}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-amber-700 active:scale-98"
                title="新しい日課タスクを追加する"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>日課タスクを追加</span>
              </button>

              {/* 絞り込みトグルボタン */}
              <button
                type="button"
                onClick={() => setIsDailyFilterOpen(!isDailyFilterOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition shadow-2xs active:scale-95 ${
                  isDailyFilterOpen
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : isDailyFilterActive
                      ? 'border-amber-200 bg-amber-50/70 text-amber-800 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title={isDailyFilterOpen ? '絞り込みツールを閉じる' : '絞り込みツールを開く'}
                aria-expanded={isDailyFilterOpen}
              >
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">絞り込み</span>
                {isDailyFilterActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
                {isDailyFilterOpen ? (
                  <ChevronUp className="h-3 w-3 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                )}
              </button>
            </div>

            {/* 並び替え & 件数 */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                合計: {formatDuration(dailyTotalMinutes)}
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 hidden xs:inline font-medium text-[11px]">
                  並び替え:
                </span>
                <div className="relative inline-flex items-center">
                  <ArrowUpDown className="h-3 w-3 text-slate-500 absolute left-2 pointer-events-none" />
                  <select
                    value={taskSortKey}
                    onChange={(e) =>
                      setTaskSortKey(
                        e.target.value as
                          | 'priority'
                          | 'duration-asc'
                          | 'duration-desc'
                          | 'title-asc'
                          | 'category',
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white pl-6.5 pr-6 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
                  >
                    <option value="priority">優先度順 (高→低)</option>
                    <option value="duration-asc">時間順 (短→長)</option>
                    <option value="duration-desc">時間順 (長→短)</option>
                    <option value="title-asc">名前順 (あ→ん)</option>
                    <option value="category">カテゴリ順</option>
                  </select>
                  <ChevronDown className="h-3 w-3 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
              </div>

              <span className="text-[11px] font-bold text-slate-500 font-mono bg-slate-100 rounded-md px-2 py-0.5">
                {filteredAndSortedDailyTasks.length}件
              </span>
            </div>
          </div>

          {/* 絞り込み行: カテゴリ & 曜日 (折り畳み式) */}
          {isDailyFilterOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs animate-in fade-in duration-150">
              {/* カテゴリ/グループ絞り込み */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">グループ:</span>
                <button
                  type="button"
                  onClick={() => setTaskCategoryFilter('all')}
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                    taskCategoryFilter === 'all'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                >
                  すべて
                </button>
                {/* ユニークな表名・カテゴリ一覧からチップ生成 */}
                {Array.from(
                  new Set(
                    dailyTasks
                      .map((t) => getTaskSourceFileName(t) || t.category || '')
                      .filter(Boolean),
                  ),
                ).map((catName) => {
                  const isActive = taskCategoryFilter === catName;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setTaskCategoryFilter(catName)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {catName}
                    </button>
                  );
                })}
              </div>

              {/* 曜日絞り込み */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">曜日:</span>
                <button
                  type="button"
                  onClick={() => setTaskDayFilter('all')}
                  className={`rounded-lg px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    taskDayFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  全
                </button>
                {[
                  { day: 0, label: '月' },
                  { day: 1, label: '火' },
                  { day: 2, label: '水' },
                  { day: 3, label: '木' },
                  { day: 4, label: '金' },
                  { day: 5, label: '土' },
                  { day: 6, label: '日' },
                ].map((d) => {
                  const isActive = taskDayFilter === d.day;
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => setTaskDayFilter(isActive ? 'all' : d.day)}
                      className={`h-5.5 w-5.5 rounded-md text-[11px] font-bold flex items-center justify-center transition ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : d.day === 5
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : d.day === 6
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
                {(taskCategoryFilter !== 'all' || taskDayFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskCategoryFilter('all');
                      setTaskDayFilter('all');
                    }}
                    className="ml-1 text-[10px] font-medium text-slate-400 hover:text-rose-600 underline"
                  >
                    解除
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'weekly' ? (
        /* 🗓️ 今週用いられているタスク（週次タスク・課題・ToDo）ツールバー */
        <div className="flex flex-col gap-2 shrink-0 rounded-xl border border-purple-200/90 bg-white/90 backdrop-blur-xs p-2.5 shadow-2xs">
          {/* サブツール案内バナー */}
          <div className="flex items-center justify-between text-[11px] bg-purple-50/80 border border-purple-200/60 rounded-lg px-2.5 py-1 text-purple-900">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="text-purple-600 font-bold">💡</span>
              <span>表データ（時間割・週間計画等）がタスク登録の主役です。ここでは今週用いられている全タスク（週次タスク・課題・ToDo）の詳細確認・管理が行えます。</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 追加ボタン & プリセット */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openAddTask('week')}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-purple-700 active:scale-98"
                title="新しい週次タスクを追加する"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>週次タスクを追加</span>
              </button>

              <button
                type="button"
                onClick={() => openAddTask('week', { isAssignment: true })}
                className="hidden xs:flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1.5 text-xs font-bold text-purple-700 shadow-2xs transition hover:bg-purple-100"
                title="課題レポートを追加"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>+課題</span>
              </button>

              <button
                type="button"
                onClick={() => openAddTask('week', { isTodo: true })}
                className="hidden xs:flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-800 shadow-2xs transition hover:bg-amber-100"
                title="ToDoタスクを追加"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>+ToDo</span>
              </button>

              {/* 絞り込みトグルボタン */}
              <button
                type="button"
                onClick={() => setIsWeeklyFilterOpen(!isWeeklyFilterOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition shadow-2xs active:scale-95 ${
                  isWeeklyFilterOpen
                    ? 'border-purple-300 bg-purple-50 text-purple-800'
                    : isWeeklyFilterActive
                      ? 'border-purple-200 bg-purple-50/70 text-purple-800 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title={isWeeklyFilterOpen ? '絞り込みツールを閉じる' : '絞り込みツールを開く'}
                aria-expanded={isWeeklyFilterOpen}
              >
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">絞り込み</span>
                {isWeeklyFilterActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                )}
                {isWeeklyFilterOpen ? (
                  <ChevronUp className="h-3 w-3 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                )}
              </button>
            </div>

            {/* 並び替え & 件数 */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-md px-2 py-0.5">
                合計: {formatDuration(weeklyTotalMinutes)}
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 hidden xs:inline font-medium text-[11px]">
                  並び替え:
                </span>
                <div className="relative inline-flex items-center">
                  <ArrowUpDown className="h-3 w-3 text-slate-500 absolute left-2 pointer-events-none" />
                  <select
                    value={taskSortKey}
                    onChange={(e) =>
                      setTaskSortKey(
                        e.target.value as
                          | 'priority'
                          | 'duration-asc'
                          | 'duration-desc'
                          | 'title-asc'
                          | 'category',
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white pl-6.5 pr-6 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer"
                  >
                    <option value="priority">優先度順 (高→低)</option>
                    <option value="duration-asc">時間順 (短→長)</option>
                    <option value="duration-desc">時間順 (長→短)</option>
                    <option value="title-asc">名前順 (あ→ん)</option>
                    <option value="category">カテゴリ順</option>
                  </select>
                  <ChevronDown className="h-3 w-3 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
              </div>

              <span className="text-[11px] font-bold text-slate-500 font-mono bg-slate-100 rounded-md px-2 py-0.5">
                {filteredAndSortedWeeklyTasks.length}/{weeklyTasks.length}件
              </span>
            </div>
          </div>

          {/* 絞り込み行: カテゴリ & 曜日 (折り畳み式) */}
          {isWeeklyFilterOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs animate-in fade-in duration-150">
              {/* カテゴリ/グループ絞り込み */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">グループ:</span>
                <button
                  type="button"
                  onClick={() => setTaskCategoryFilter('all')}
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                    taskCategoryFilter === 'all'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                >
                  すべて
                </button>
                <button
                  type="button"
                  onClick={() => setTaskCategoryFilter('assignment')}
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                    taskCategoryFilter === 'assignment'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                >
                  課題のみ
                </button>
                <button
                  type="button"
                  onClick={() => setTaskCategoryFilter('todo')}
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                    taskCategoryFilter === 'todo'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                >
                  ToDoのみ
                </button>
                {/* ユニークな表名・カテゴリ一覧からチップ生成 */}
                {Array.from(
                  new Set(
                    weeklyTasks
                      .map((t) => getTaskSourceFileName(t) || t.category || '')
                      .filter(Boolean),
                  ),
                ).map((catName) => {
                  const isActive = taskCategoryFilter === catName;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setTaskCategoryFilter(catName)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {catName}
                    </button>
                  );
                })}
              </div>

              {/* 曜日絞り込み（課題の締切・出題曜日） */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">締切曜日:</span>
                <button
                  type="button"
                  onClick={() => setTaskDayFilter('all')}
                  className={`rounded-lg px-1.5 py-0.5 text-[11px] font-semibold transition ${
                    taskDayFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  全
                </button>
                {[
                  { day: 0, label: '月' },
                  { day: 1, label: '火' },
                  { day: 2, label: '水' },
                  { day: 3, label: '木' },
                  { day: 4, label: '金' },
                  { day: 5, label: '土' },
                  { day: 6, label: '日' },
                ].map((d) => {
                  const isActive = taskDayFilter === d.day;
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => setTaskDayFilter(isActive ? 'all' : d.day)}
                      className={`h-5.5 w-5.5 rounded-md text-[11px] font-bold flex items-center justify-center transition ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : d.day === 5
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : d.day === 6
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
                {(taskCategoryFilter !== 'all' || taskDayFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskCategoryFilter('all');
                      setTaskDayFilter('all');
                    }}
                    className="ml-1 text-[10px] font-medium text-slate-400 hover:text-rose-600 underline"
                  >
                    解除
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* viewMode === 'all' 統合ヘッダー */
        <div className="flex flex-col gap-2 shrink-0 border-b border-amber-900/10 pb-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 sm:text-base">
              日課・週次タスク・生活固定枠スタック
            </h3>
            <span className="hidden text-[11px] text-slate-500 sm:inline">
              (カードタップで編集、余白タップで新規追加)
            </span>
            {onNavigateToTimeline && (
              <button
                onClick={onNavigateToTimeline}
                className="ml-2 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 shadow-sm transition hover:bg-amber-100"
                title="計画表（タイムライン）シートへ移動"
              >
                計画表シートへ →
              </button>
            )}
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <Zap className="h-3 w-3 text-amber-500" />
              プリセット:
            </span>
            {PRESET_TASKS.slice(0, 3).map((preset) => (
              <button
                key={preset.title}
                onClick={() => handleAddPresetTask(preset)}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                + {preset.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Horizontal Stacks: [日ごと] | [週ごと] | [固定枠] */}
      <div
        className={`${
          viewMode === 'all'
            ? 'grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col'
        } flex-1 min-h-0 overflow-y-auto`}
      >
        {/* Column 1: Daily Tasks Stack (頻度: 高 / 週5回以上) */}
        {(viewMode === 'all' || viewMode === 'daily') && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) openAddTask('day');
            }}
            className={`flex flex-col gap-2 h-full min-h-0 flex-1 ${
              viewMode === 'daily'
                ? 'p-0.5'
                : 'rounded-xl border border-slate-200 bg-slate-50/60 p-3 cursor-pointer transition hover:border-slate-300'
            }`}
            title="クリックして日次タスクを追加"
          >
            {/* Column Header (viewMode === 'all' のみ表示) */}
            {viewMode === 'all' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-between border-b border-slate-200 pb-2 cursor-default shrink-0"
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                    <Sun className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">📅 今日・日課タスク (今日用いられているタスク)</h4>
                  </div>
                  <span className="rounded-full bg-white border border-slate-200 px-1.5 py-0.2 text-[10px] font-medium text-slate-700">
                    {dailyTasks.length}件
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-blue-600">
                    計 {formatDuration(dailyTotalMinutes)}
                  </span>
                  <button
                    onClick={() => openAddTask('day')}
                    title="日次タスクを追加"
                    className="flex items-center gap-0.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-100 hover:border-blue-300"
                  >
                    <Plus className="h-3 w-3" />
                    追加
                  </button>
                </div>
              </div>
            )}

            {/* Daily Blocks Stack List */}
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) openAddTask('day');
              }}
              className={`pt-1 flex-1 min-h-[140px] ${
                viewMode !== 'all'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 items-stretch overflow-y-auto'
                  : 'flex flex-col gap-2 overflow-y-auto'
              }`}
            >
              {dailyTasks.length === 0 ? (
                <div
                  onClick={() => openAddTask('day')}
                  className="col-span-full flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 hover:border-amber-300 hover:text-amber-700 transition bg-white/40"
                >
                  <Sun className="h-8 w-8 text-amber-300 mb-2" />
                  <span className="font-semibold text-slate-700">高頻度・毎日のタスクがありません</span>
                  <span className="mt-1 text-xs font-bold text-amber-600">
                    + タップしてタスクを追加
                  </span>
                </div>
              ) : filteredAndSortedDailyTasks.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500 bg-white/40">
                  <p className="font-semibold text-slate-700">条件に一致するタスクがありません</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    選択中の曜日や絞り込み条件を変更してください
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskCategoryFilter('all');
                      setTaskDayFilter('all');
                    }}
                    className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                  >
                    絞り込みを解除する
                  </button>
                </div>
              ) : (
                <>
                  {filteredAndSortedDailyTasks.map((task) => {
                    const groupLabel = getTaskSourceFileName(task) || task.category || '日課';
                    return (
                      <div
                        key={task.id}
                        onClick={() => openEditTask(task)}
                        title="タップして編集"
                        className={`group relative flex items-center justify-between overflow-hidden rounded-xl border p-2.5 transition cursor-pointer shrink-0 min-h-[64px] ${
                          task.completed
                            ? 'border-slate-200 bg-slate-100/70 opacity-60'
                            : 'border-amber-200/90 bg-amber-50/30 hover:border-amber-300 hover:bg-white hover:shadow-xs'
                        }`}
                      >
                        {/* Left Accent Bar */}
                        <div
                          className={`absolute inset-y-0 left-0 w-1 ${
                            task.completed ? 'bg-slate-300' : 'bg-amber-500'
                          }`}
                        />

                        <div className="flex items-center gap-2 pl-1 min-w-0 flex-1">
                          <button
                            onClick={(e) => handleToggleComplete(e, task.id)}
                            title={task.completed ? '未完了に戻す' : '完了にする'}
                            className="shrink-0 text-slate-400 transition hover:text-amber-600"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <h5
                                className={`text-xs font-semibold break-words leading-snug ${
                                  task.completed ? 'text-slate-400 line-through' : 'text-slate-900'
                                }`}
                              >
                                {task.title}
                              </h5>

                              <span
                                className="shrink-0 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[9px] font-medium text-amber-800"
                                title={`所属グループ: ${groupLabel}`}
                              >
                                {getTaskSourceFileName(task) && (
                                  <FileSpreadsheet className="h-2.5 w-2.5 text-amber-600" />
                                )}
                                <span className="max-w-[120px] truncate">{groupLabel}</span>
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                              <span className="shrink-0 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5 text-slate-400" />
                                {task.durationSize === 'small'
                                  ? '小 (15〜30m)'
                                  : task.durationSize === 'large'
                                    ? '大 (2h+)'
                                    : '中 (30m〜2h)'}
                              </span>
                              <span className="shrink-0 flex items-center gap-0.5 text-slate-500">
                                <Repeat className="h-2.5 w-2.5 text-slate-400" />
                                {task.dailyCount && task.dailyCount > 1
                                  ? `1日${task.dailyCount}回`
                                  : task.dailyRepeatMode === 'auto' || task.dailyCount === undefined
                                    ? '繰り返し: 自動'
                                    : '1日1回'}
                              </span>

                              {task.breakMinutes !== undefined && task.breakMinutes > 0 && (
                                <span className="shrink-0 rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9px] font-bold text-emerald-700 flex items-center gap-0.5">
                                  <span>☕</span>
                                  <span>休憩 {task.breakMinutes}分</span>
                                </span>
                              )}

                              {task.targetDays && task.targetDays.length > 0 && task.targetDays.length < 7 && (
                                <span className="shrink-0 rounded bg-sky-50 border border-sky-200 px-1 py-0.2 text-[9px] font-bold text-sky-700">
                                  {task.targetDays.map((d) => WEEKDAY_SHORT[d]).join('・')}
                                </span>
                              )}

                              {task.cycleDays && task.cycleDays.length > 0 && (
                                <span className="shrink-0 rounded bg-purple-50 border border-purple-200 px-1 py-0.2 text-[9px] font-bold text-purple-700">
                                  {task.cycleDays.map((c) => `Day ${c + 1}`).join('・')} ({task.cycleCount}日周期)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          <div className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-slate-600 p-1">
                            <Pencil className="h-3 w-3" />
                          </div>
                          <button
                            onClick={(e) => handleDeleteTask(e, task.id)}
                            title="タスクを削除"
                            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => openAddTask('day')}
                    className="shrink-0 flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 bg-white py-2 text-[11px] font-medium text-slate-600 transition hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-700 min-h-[40px]"
                  >
                    <Plus className="h-3.5 w-3.5" />+ タスクを追加
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Column 2: Weekly Tasks Stack (頻度: 低/中、課題、ToDo) */}
        {(viewMode === 'all' || viewMode === 'weekly') && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) openAddTask('week');
            }}
            className={`flex flex-col gap-2 h-full min-h-0 flex-1 ${
              viewMode === 'weekly'
                ? 'p-0.5'
                : 'rounded-xl border border-slate-200 bg-slate-50/60 p-3 cursor-pointer transition hover:border-slate-300'
            }`}
            title="クリックして週次タスク・課題を追加"
          >
            {/* Column Header (viewMode === 'all' のみ表示) */}
            {viewMode === 'all' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-between border-b border-slate-200 pb-2 cursor-default shrink-0"
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-purple-700">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">🗓️ 今週タスク (今週用いられているタスク)</h4>
                  </div>
                  <span className="rounded-full bg-white border border-slate-200 px-1.5 py-0.2 text-[10px] font-medium text-slate-700">
                    {weeklyTasks.length}件
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold text-purple-700">
                    計 {formatDuration(weeklyTotalMinutes)}
                  </span>
                  <button
                    onClick={() => {
                      openAddTask('week', { isAssignment: true });
                    }}
                    title="課題を追加"
                    className="flex items-center gap-0.5 rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 transition hover:bg-purple-100 hover:border-purple-300"
                  >
                    <GraduationCap className="h-2.5 w-2.5" />
                    +課題
                  </button>
                  <button
                    onClick={() => {
                      openAddTask('week', { isTodo: true });
                    }}
                    title="ToDoを追加"
                    className="flex items-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100 hover:border-amber-300"
                  >
                    <CheckSquare className="h-2.5 w-2.5" />
                    +ToDo
                  </button>
                  <button
                    onClick={() => openAddTask('week')}
                    title="タスクを追加"
                    className="flex items-center gap-0.5 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-100 hover:border-blue-300"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    +追加
                  </button>
                </div>
              </div>
            )}

            {/* Weekly Blocks Stack List */}
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) openAddTask('week');
              }}
              className={`pt-1 flex-1 min-h-[140px] ${
                viewMode !== 'all'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 items-stretch overflow-y-auto'
                  : 'flex flex-col gap-2 overflow-y-auto'
              }`}
            >
              {weeklyTasks.length === 0 ? (
                <div
                  onClick={() => openAddTask('week')}
                  className="col-span-full flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 hover:border-purple-300 hover:text-purple-700 transition bg-white/40"
                >
                  <CalendarDays className="h-8 w-8 text-purple-300 mb-2" />
                  <span className="font-semibold text-slate-700">今週のタスク・課題がありません</span>
                  <span className="mt-1 text-xs font-bold text-purple-600">
                    + タップして追加
                  </span>
                </div>
              ) : filteredAndSortedWeeklyTasks.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500 bg-white/40">
                  <p className="font-semibold text-slate-700">条件に一致するタスクがありません</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    カテゴリまたは曜日の絞り込み条件を変更してください
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskCategoryFilter('all');
                      setTaskDayFilter('all');
                    }}
                    className="mt-3 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-100 transition shadow-2xs"
                  >
                    絞り込みを解除する
                  </button>
                </div>
              ) : (
                <>
                  {filteredAndSortedWeeklyTasks.map((task) => {
                    const isAssign = task.taskType === 'assignment';
                    const isTodo = task.taskType === 'todo' || task.hasNoDuration;
                    const groupLabel = getTaskSourceFileName(task) || task.category || '週次';

                    return (
                      <div
                        key={task.id}
                        onClick={() => openEditTask(task)}
                        title="タップして編集"
                        className={`group relative flex items-center justify-between overflow-hidden rounded-xl border p-2.5 transition cursor-pointer shrink-0 min-h-[64px] ${
                          task.completed
                            ? 'border-slate-200 bg-slate-100/70 opacity-60'
                            : isAssign
                              ? 'border-purple-200/90 bg-purple-50/40 hover:border-purple-300 hover:bg-white hover:shadow-xs'
                              : isTodo
                                ? 'border-amber-200/90 bg-amber-50/40 hover:border-amber-300 hover:bg-white hover:shadow-xs'
                                : 'border-purple-200/90 bg-purple-50/20 hover:border-purple-300 hover:bg-white hover:shadow-xs'
                        }`}
                      >
                        {/* Left Accent Bar */}
                        <div
                          className={`absolute inset-y-0 left-0 w-1 ${
                            task.completed
                              ? 'bg-slate-300'
                              : isAssign
                                ? 'bg-purple-600'
                                : isTodo
                                  ? 'bg-amber-400'
                                  : 'bg-purple-500'
                          }`}
                        />

                        <div className="flex items-center gap-2 pl-1 min-w-0 flex-1">
                          <button
                            onClick={(e) => handleToggleComplete(e, task.id)}
                            title={task.completed ? '未完了に戻す' : '完了にする'}
                            className="shrink-0 text-slate-400 transition hover:text-purple-600"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <h5
                                className={`text-xs font-semibold break-words leading-snug ${
                                  task.completed ? 'text-slate-400 line-through' : 'text-slate-900'
                                }`}
                              >
                                {task.title}
                              </h5>

                              {isAssign ? (
                                <span className="shrink-0 flex items-center gap-0.5 rounded border border-purple-200 bg-purple-50 px-1.5 py-0.2 text-[9px] font-bold text-purple-700">
                                  <GraduationCap className="h-2.5 w-2.5" />
                                  課題 (期日:{' '}
                                  {task.deadlineDay !== undefined
                                    ? DAY_LABELS[task.deadlineDay]
                                    : '未定'}
                                  )
                                </span>
                              ) : isTodo ? (
                                <span className="shrink-0 flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                                  <CheckSquare className="h-2.5 w-2.5" />
                                  ToDo
                                </span>
                              ) : (
                                <span
                                  className="shrink-0 inline-flex items-center gap-1 rounded border border-purple-200 bg-purple-50 px-1.5 py-0.2 text-[9px] font-medium text-purple-800"
                                  title={`所属グループ: ${groupLabel}`}
                                >
                                  {getTaskSourceFileName(task) && (
                                    <FileSpreadsheet className="h-2.5 w-2.5 text-purple-600" />
                                  )}
                                  <span className="max-w-[120px] truncate">{groupLabel}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                              {isTodo ? (
                                <span className="text-amber-800 font-medium">
                                  枠なし (チェックのみ)
                                </span>
                              ) : (
                                <span className="shrink-0 flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5 text-slate-400" />
                                  {task.durationSize === 'small'
                                    ? '小 (15〜30m)'
                                    : task.durationSize === 'large'
                                      ? '大 (2h+)'
                                      : '中 (30m〜2h)'}
                                </span>
                              )}

                              <span className="shrink-0 flex items-center gap-0.5 text-slate-500">
                                <Repeat className="h-2.5 w-2.5 text-slate-400" />
                                {task.frequency === 'low'
                                  ? '週1〜2回'
                                  : task.frequency === 'medium'
                                    ? '週3〜4回'
                                    : task.frequency === 'custom'
                                      ? `週${task.frequencyCount}回`
                                      : '週枠'}
                              </span>

                              {task.breakMinutes !== undefined && task.breakMinutes > 0 && (
                                <span className="shrink-0 rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9px] font-bold text-emerald-700 flex items-center gap-0.5">
                                  <span>☕</span>
                                  <span>休憩 {task.breakMinutes}分</span>
                                </span>
                              )}

                              {isAssign &&
                                task.startDay !== undefined &&
                                task.deadlineDay !== undefined && (
                                  <span className="text-[9px] text-slate-500">
                                    ({DAY_LABELS[task.startDay]}出題〜{DAY_LABELS[task.deadlineDay]}
                                    締切)
                                  </span>
                                )}

                              {!isAssign && task.targetDays && task.targetDays.length > 0 && task.targetDays.length < 7 && (
                                <span className="shrink-0 rounded bg-sky-50 border border-sky-200 px-1 py-0.2 text-[9px] font-bold text-sky-700">
                                  {task.targetDays.map((d) => WEEKDAY_SHORT[d]).join('・')}
                                </span>
                              )}

                              {!isAssign && task.cycleDays && task.cycleDays.length > 0 && (
                                <span className="shrink-0 rounded bg-purple-50 border border-purple-200 px-1 py-0.2 text-[9px] font-bold text-purple-700">
                                  {task.cycleDays.map((c) => `Day ${c + 1}`).join('・')} ({task.cycleCount}日周期)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          <div className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-slate-600 p-1">
                            <Pencil className="h-3 w-3" />
                          </div>
                          <button
                            onClick={(e) => handleDeleteTask(e, task.id)}
                            title="タスクを削除"
                            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => openAddTask('week')}
                    className="shrink-0 flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 bg-white py-2 text-[11px] font-medium text-slate-600 transition hover:border-purple-400 hover:bg-purple-50/50 hover:text-purple-700 min-h-[40px]"
                  >
                    <Plus className="h-3.5 w-3.5" />+ タスク・課題を追加
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Column 3: Fixed Slots Stack */}
        {(viewMode === 'all' || viewMode === 'slots') && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) openAddSlot();
            }}
            className={`flex flex-col gap-2 h-full min-h-0 flex-1 ${
              viewMode === 'slots'
                ? 'p-0.5'
                : 'rounded-xl border border-slate-200 bg-slate-50/60 p-3 cursor-pointer transition hover:border-slate-300'
            }`}
            title="クリックして固定枠を追加"
          >
            {/* Column Header (viewMode === 'all' のみ表示) */}
            {viewMode === 'all' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-between border-b border-slate-200 pb-2 cursor-default shrink-0"
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700">
                    <Shield className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">固定枠 (講義・睡眠)</h4>
                  <span className="rounded-full bg-white border border-slate-200 px-1.5 py-0.2 text-[10px] font-medium text-slate-700">
                    {slots.length}件
                  </span>
                </div>

                <button
                  onClick={openAddSlot}
                  title="固定枠・講義を追加"
                  className="flex items-center gap-0.5 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 transition hover:bg-sky-100 hover:border-sky-300"
                >
                  <Plus className="h-3 w-3" />
                  追加
                </button>
              </div>
            )}

            {/* Fixed Slots List */}
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) openAddSlot();
              }}
              className={`pt-1 flex-1 min-h-[140px] ${
                viewMode !== 'all'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 items-stretch overflow-y-auto'
                  : 'flex flex-col gap-2 overflow-y-auto'
              }`}
            >
              {slots.length === 0 ? (
                <div
                  onClick={openAddSlot}
                  className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 hover:border-sky-300 hover:text-sky-600 transition bg-white/40"
                >
                  <Shield className="h-8 w-8 text-slate-300 mb-2" />
                  <span className="font-semibold text-slate-700">登録された固定枠がありません</span>
                  <span className="mt-1 text-xs font-bold text-sky-600">
                    + タップして固定枠を追加
                  </span>
                </div>
              ) : filteredAndSortedSlots.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500 bg-white/40">
                  <p className="font-semibold text-slate-700">条件に一致する固定枠がありません</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    カテゴリまたは曜日の絞り込み条件を変更してください
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSlotCategoryFilter('all');
                      setSlotDayFilter('all');
                    }}
                    className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition shadow-2xs"
                  >
                    絞り込みを解除する
                  </button>
                </div>
              ) : (
                <>
                  {filteredAndSortedSlots.map((slot) => {
                    const duration =
                      slot.endMinutes >= slot.startMinutes
                        ? slot.endMinutes - slot.startMinutes
                        : 1440 - slot.startMinutes + slot.endMinutes;

                    return (
                      <div
                        key={slot.id}
                        onClick={() => openEditSlot(slot)}
                        title="タップして編集"
                        className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 transition cursor-pointer hover:border-sky-300 hover:shadow-xs shrink-0 min-h-[64px]"
                      >
                        <div
                          className="absolute inset-y-0 left-0 w-1"
                          style={{ backgroundColor: slot.color || '#0284c7' }}
                        />

                        <div className="flex items-center gap-2 pl-1 min-w-0 flex-1">
                          <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 p-1 text-slate-700">
                            {getSlotCategoryIcon(slot.category)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <h5 className="text-xs font-semibold text-slate-900 break-words leading-snug">
                                {slot.title}
                              </h5>
                              <span className="shrink-0 rounded bg-sky-50 border border-sky-200 px-1 py-0.2 text-[9px] font-bold text-sky-700">
                                {formatDaysString(slot.daysOfWeek)}
                              </span>

                              {getSlotSourceFileName(slot) && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-medium text-emerald-800"
                                  title={`参照元表データ: ${getSlotSourceFileName(slot)}`}
                                >
                                  <FileSpreadsheet className="h-2.5 w-2.5 text-emerald-600" />
                                  <span className="max-w-[120px] truncate">
                                    {getSlotSourceFileName(slot)}
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                              <Clock className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                              <span className="shrink-0 font-medium">
                                {minutesToTimeString(slot.startMinutes)} -{' '}
                                {minutesToTimeString(slot.endMinutes)}
                              </span>
                              <span className="text-slate-400 shrink-0">
                                ({formatDuration(duration)})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {slot.category === 'lecture' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddAssignmentFromLecture(slot);
                              }}
                              title="この授業の課題タスクを作成"
                              className="flex items-center gap-0.5 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 transition hover:bg-purple-100"
                            >
                              <GraduationCap className="h-3 w-3 text-purple-600" />
                              <span>+課題</span>
                            </button>
                          )}
                          <div className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-slate-600 p-1">
                            <Pencil className="h-3 w-3" />
                          </div>
                          <button
                            onClick={(e) => handleDeleteSlot(e, slot.id)}
                            title="固定枠を削除"
                            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={openAddSlot}
                    className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 bg-white py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 shrink-0 min-h-[40px]"
                  >
                    <Plus className="h-3 w-3" />+ 固定枠・講義を追加
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===================== SIMPLIFIED TASK MODAL (表での設定項目になぞらえた設計) ===================== */}
      {modalType === 'task' && (
        <div
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl text-slate-900 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    taskPeriodScope === 'day'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {taskPeriodScope === 'day' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <CalendarDays className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingTaskId ? 'タスクの編集' : '新しいタスクの追加'}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {taskPeriodScope === 'day'
                      ? '🏃 日課タスク（その日の中で繰り返す・日次）'
                      : '🎯 週次タスク（日ごとに繰り返す・曜日／周期）'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="flex flex-col gap-3">
              {/* 表データ参照元バッジ表示 */}
              {(() => {
                const currentTask = editingTaskId
                  ? tasks.find((t) => t.id === editingTaskId)
                  : undefined;
                const srcName = currentTask
                  ? getTaskSourceFileName(currentTask)
                  : taskSourceTableName;
                if (!srcName) return null;
                return (
                  <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5 text-xs text-emerald-800">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[11px]">参照元テーブル:</span>
                    <span className="truncate text-xs font-bold text-emerald-900">{srcName}</span>
                  </div>
                );
              })()}

              {/* 1. タスク名入力 */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700">タスク名</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="例: プログラミング演習、筋トレ、英単語学習"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* 2. 分類（表の分類と同じ: 日 vs 週） */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700">
                    分類（表の分類になぞらえた区分）
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {taskPeriodScope === 'day' ? '1日に複数回組み込み可' : '日ごとに反復または周期'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskPeriodScope('day')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition border ${
                      taskPeriodScope === 'day'
                        ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-xs ring-1 ring-amber-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Sun className="h-4 w-4 text-amber-600" />
                    <span>🏃 日 (その日の中で反復)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskPeriodScope('week')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition border ${
                      taskPeriodScope === 'week'
                        ? 'border-purple-400 bg-purple-50 text-purple-900 shadow-xs ring-1 ring-purple-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CalendarDays className="h-4 w-4 text-purple-600" />
                    <span>🎯 週 (日ごとに反復 / 周期)</span>
                  </button>
                </div>
              </div>

              {/* 3. 所属グループ（表の表名になぞらえたカテゴリ） */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  所属グループ / 表名
                </label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={taskGroupName}
                    onChange={(e) => setTaskGroupName(e.target.value)}
                    placeholder="例: 基本設定、筋トレ、資格学習"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                  {/* テーブル一覧からのクイック選択チップ */}
                  {tables && tables.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        onChange={(e) => {
                          if (e.target.value) setTaskGroupName(e.target.value);
                        }}
                        defaultValue=""
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 cursor-pointer focus:outline-none"
                      >
                        <option value="" disabled>
                          表から選択...
                        </option>
                        {tables.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. 実施タイミングの設定（表の列設定となぞらえた設定） */}
              {taskPeriodScope === 'day' ? (
                /* === 日のタスク: 曜日・毎日 vs 周期 ＆ 1日の回数 === */
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                      <Sun className="h-3.5 w-3.5 text-amber-600" />
                      日の実施タイミング設定
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">
                      その日の中で反復・1日複数回
                    </span>
                  </div>

                  {/* 管理方式セレクタ: 曜日・毎日 vs 周期 */}
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-amber-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setDailyTimingMode('weekday')}
                      className={`py-1 text-xs font-bold rounded-md transition ${
                        dailyTimingMode === 'weekday'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-amber-50'
                      }`}
                    >
                      📅 曜日・毎日で指定
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyTimingMode('cycle')}
                      className={`py-1 text-xs font-bold rounded-md transition ${
                        dailyTimingMode === 'cycle'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-amber-50'
                      }`}
                    >
                      🔄 周期で指定 (Day 1〜N)
                    </button>
                  </div>

                  {dailyTimingMode === 'weekday' ? (
                    /* 対象曜日の選択 (毎日 または 特定曜日) */
                    <div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-[11px] font-semibold text-amber-950">
                          実施曜日
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDailyDays(
                              dailyDays.length === 7 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6],
                            )
                          }
                          className="text-[10px] text-amber-700 font-bold hover:underline"
                        >
                          {dailyDays.length === 7 ? '平日のみに切り替え' : '毎日にリセット'}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        {WEEKDAY_SHORT.map((w, idx) => {
                          const isSelected = dailyDays.includes(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (dailyDays.length > 1) {
                                    setDailyDays(dailyDays.filter((d) => d !== idx));
                                  }
                                } else {
                                  setDailyDays([...dailyDays, idx].sort());
                                }
                              }}
                              className={`flex-1 py-1 rounded-md text-xs font-bold transition border ${
                                isSelected
                                  ? 'border-amber-400 bg-amber-500 text-white shadow-2xs'
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {w}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* 周期で指定 (Day 1〜N、周期日数) */
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-amber-950">周期の日数</span>
                          <p className="text-[10px] text-slate-500">例: 2日周期、3日周期ローテーション</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const nextCount = Math.max(2, dailyCycleCount - 1);
                              setDailyCycleCount(nextCount);
                              setDailyCycleDays(dailyCycleDays.filter((d) => d < nextCount));
                            }}
                            className="h-6 w-6 rounded border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="w-12 text-center text-xs font-black text-amber-900">
                            {dailyCycleCount} 日周期
                          </span>
                          <button
                            type="button"
                            onClick={() => setDailyCycleCount((prev) => Math.min(7, prev + 1))}
                            className="h-6 w-6 rounded border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-amber-950 block pb-1">
                          実施するDay（複数選択可）
                        </span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: dailyCycleCount }, (_, idx) => {
                            const isSelected = dailyCycleDays.includes(idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    if (dailyCycleDays.length > 1) {
                                      setDailyCycleDays(dailyCycleDays.filter((d) => d !== idx));
                                    }
                                  } else {
                                    setDailyCycleDays([...dailyCycleDays, idx].sort((a, b) => a - b));
                                  }
                                }}
                                className={`flex-1 py-1 rounded-md text-xs font-bold transition border ${
                                  isSelected
                                    ? 'border-amber-400 bg-amber-500 text-white shadow-2xs'
                                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                Day {idx + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 1日の中の繰り返し回数 */}
                  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-2.5">
                    <div>
                      <span className="text-xs font-bold text-slate-800">1日の中の繰り返し回数</span>
                      <p className="text-[10px] text-slate-500">
                        {dailyRepeatMode === 'auto'
                          ? '🌟 自動: スケジュールの空き時間に合わせて自動で最適配置されます'
                          : '指定した回数分、朝・昼・晩などの空き時間に分散配置されます'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={dailyRepeatMode === 'auto' ? 'auto' : String(dailyCount)}
                        onChange={(e) => {
                          if (e.target.value === 'auto') {
                            setDailyRepeatMode('auto');
                          } else {
                            setDailyRepeatMode('custom');
                            setDailyCount(Number(e.target.value));
                          }
                        }}
                        className="rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-1.5 text-xs font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                        title="1日の中の繰り返し回数（デフォルト: 自動）"
                      >
                        <option value="auto">🌟 自動</option>
                        <option value="1">1回</option>
                        <option value="2">2回</option>
                        <option value="3">3回</option>
                        <option value="4">4回</option>
                        <option value="5">5回</option>
                        <option value="6">6回</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* === 週のタスク: 表の列になぞらえた管理方式 (曜日指定 / 周期指定 / おまかせ) === */
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
                      週の実施タイミング（表の列管理に対応）
                    </span>
                  </div>

                  {/* 管理方式セレクタ: 曜日 vs 周期 vs おまかせ */}
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-purple-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setWeekTimingMode('weekday')}
                      className={`py-1 text-xs font-bold rounded-md transition ${
                        weekTimingMode === 'weekday'
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-purple-50'
                      }`}
                    >
                      📅 曜日で指定
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekTimingMode('cycle')}
                      className={`py-1 text-xs font-bold rounded-md transition ${
                        weekTimingMode === 'cycle'
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-purple-50'
                      }`}
                    >
                      🔄 周期で指定
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekTimingMode('flexible')}
                      className={`py-1 text-xs font-bold rounded-md transition ${
                        weekTimingMode === 'flexible'
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-purple-50'
                      }`}
                    >
                      🎲 週N回 (おまかせ)
                    </button>
                  </div>

                  {/* 方式ごとの詳細設定 */}
                  {weekTimingMode === 'weekday' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-purple-950">
                          実施する曜日を選択（複数可）
                        </span>
                        <div className="flex items-center gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setWeekTargetDays([0, 2, 4])}
                            className="text-purple-700 hover:underline font-bold"
                          >
                            月水金
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setWeekTargetDays([0, 1, 2, 3, 4])}
                            className="text-purple-700 hover:underline font-bold"
                          >
                            平日
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setWeekTargetDays([5, 6])}
                            className="text-purple-700 hover:underline font-bold"
                          >
                            土日
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {WEEKDAY_SHORT.map((w, idx) => {
                          const isSelected = weekTargetDays.includes(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (weekTargetDays.length > 1) {
                                    setWeekTargetDays(weekTargetDays.filter((d) => d !== idx));
                                  }
                                } else {
                                  setWeekTargetDays([...weekTargetDays, idx].sort());
                                }
                              }}
                              className={`flex-1 py-1 rounded-md text-xs font-bold transition border ${
                                isSelected
                                  ? 'border-purple-400 bg-purple-600 text-white shadow-2xs'
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {w}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {weekTimingMode === 'cycle' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-purple-950">
                          周期ローテーション設定
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">周期の長さ:</span>
                          <select
                            value={weekCycleCount}
                            onChange={(e) => {
                              const cnt = Number(e.target.value);
                              setWeekCycleCount(cnt);
                              setWeekCycleDays(weekCycleDays.filter((c) => c < cnt));
                            }}
                            className="rounded border border-purple-200 bg-white px-1.5 py-0.5 text-xs font-bold text-purple-800"
                          >
                            {[2, 3, 4, 5, 6, 7].map((num) => (
                              <option key={num} value={num}>
                                {num}日周期
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: weekCycleCount }, (_, idx) => {
                          const isSelected = weekCycleDays.includes(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (weekCycleDays.length > 1) {
                                    setWeekCycleDays(weekCycleDays.filter((c) => c !== idx));
                                  }
                                } else {
                                  setWeekCycleDays([...weekCycleDays, idx].sort());
                                }
                              }}
                              className={`flex-1 py-1 rounded-md text-xs font-bold transition border ${
                                isSelected
                                  ? 'border-purple-400 bg-purple-600 text-white shadow-2xs'
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              Day {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-purple-700">
                        ※表のDay列と同様に、指定したサイクル日に確実に1回ずつ配置されます
                      </p>
                    </div>
                  )}

                  {weekTimingMode === 'flexible' && (
                    <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-white p-2">
                      <div>
                        <span className="text-xs font-bold text-slate-800">週あたりの目標回数</span>
                        <p className="text-[10px] text-slate-500">
                          空き時間の多い曜日を自動探索して配置します
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFlexibleCount((prev) => Math.max(1, prev - 1))}
                          className="h-7 w-7 rounded-md border border-slate-300 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 active:scale-95 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="w-12 text-center text-sm font-black text-purple-800">
                          週 {flexibleCount} 回
                        </span>
                        <button
                          type="button"
                          onClick={() => setFlexibleCount((prev) => Math.min(7, prev + 1))}
                          className="h-7 w-7 rounded-md border border-slate-300 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 active:scale-95 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. 所要時間（分数チップ ＆ 枠なしToDo切替） */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">所要時間</span>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isNoDurationTodo}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsNoDurationTodo(checked);
                        if (!checked && durationMinutes === 0) {
                          setDurationMinutes(60);
                          setDurationSize('medium');
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <CheckSquare className="h-3.5 w-3.5 text-amber-600" />
                    <span>時間枠なし (ToDoチェックのみ)</span>
                  </label>
                </div>

                {!isNoDurationTodo && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-1.5">
                      {[
                        { min: 15, label: '15分', size: 'small' as TaskDurationSize },
                        { min: 30, label: '30分', size: 'small' as TaskDurationSize },
                        { min: 45, label: '45分', size: 'medium' as TaskDurationSize },
                        { min: 60, label: '60分 (1h)', size: 'medium' as TaskDurationSize },
                        { min: 90, label: '90分 (1.5h)', size: 'medium' as TaskDurationSize },
                        { min: 120, label: '120分 (2h)', size: 'large' as TaskDurationSize },
                      ].map((item) => {
                        const isSelected = durationMinutes === item.min;
                        return (
                          <button
                            key={item.min}
                            type="button"
                            onClick={() => {
                              setDurationMinutes(item.min);
                              setDurationSize(item.size);
                            }}
                            className={`flex-1 py-1 rounded-md text-xs font-bold transition border ${
                              isSelected
                                ? 'border-blue-400 bg-blue-600 text-white shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* タスク後の休憩時間 */}
              {!isNoDurationTodo && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">☕</span>
                    <div>
                      <span className="text-xs font-bold text-slate-800">タスク後の休憩時間</span>
                      <p className="text-[10px] text-slate-500">
                        作業直後にスケジュールへ自動確保される休憩枠
                      </p>
                    </div>
                  </div>
                  <select
                    value={taskBreakMinutes}
                    onChange={(e) => setTaskBreakMinutes(Number(e.target.value))}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value={0}>なし (0分)</option>
                    <option value={5}>5分</option>
                    <option value={10}>10分</option>
                    <option value={15}>15分 (おすすめ)</option>
                    <option value={20}>20分</option>
                    <option value={30}>30分</option>
                    <option value={45}>45分</option>
                    <option value={60}>60分</option>
                  </select>
                </div>
              )}

              {/* 6. オプション: 締切・提出期日の設定（週のタスクで必要な場合） */}
              {taskPeriodScope === 'week' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <GraduationCap className="h-4 w-4 text-purple-600" />
                      <span>提出期日・締切曜日を設定する (課題・レポート等)</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={hasDeadline}
                      onChange={(e) => setHasDeadline(e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                  </div>

                  {hasDeadline && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600">
                          出題・開始曜日
                        </label>
                        <select
                          value={startDay}
                          onChange={(e) => setStartDay(parseInt(e.target.value, 10))}
                          className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none"
                        >
                          {DAY_LABELS.map((label, idx) => (
                            <option key={idx} value={idx}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-purple-800">
                          締切曜日 (期日)
                        </label>
                        <select
                          value={deadlineDay}
                          onChange={(e) => setDeadlineDay(parseInt(e.target.value, 10))}
                          className="mt-0.5 w-full rounded border border-purple-200 bg-white px-2 py-1 text-xs font-bold text-purple-900 focus:outline-none"
                        >
                          {DAY_LABELS.map((label, idx) => (
                            <option key={idx} value={idx}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 7. オプション: 指定日時以降にタスクを配置の設定（週のタスクで必要な場合） */}
              {taskPeriodScope === 'week' && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <Clock className="h-4 w-4 text-indigo-600" />
                      <span>指定日時以降にタスクを配置する (授業後・指定時刻以降)</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={scheduleAfterEnabled}
                      onChange={(e) => setScheduleAfterEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>

                  {scheduleAfterEnabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100">
                      <div>
                        <label className="text-[10px] font-semibold text-indigo-950">
                          指定曜日 (この曜日以降)
                        </label>
                        <select
                          value={scheduleAfterDay}
                          onChange={(e) => setScheduleAfterDay(parseInt(e.target.value, 10))}
                          className="mt-0.5 w-full rounded border border-indigo-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none"
                        >
                          {DAY_LABELS.map((label, idx) => (
                            <option key={idx} value={idx}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-indigo-950">
                          指定時刻 (この時刻以降)
                        </label>
                        <input
                          type="time"
                          value={scheduleAfterTime}
                          onChange={(e) => setScheduleAfterTime(e.target.value)}
                          className="mt-0.5 w-full rounded border border-indigo-200 bg-white px-2 py-1 text-xs font-bold text-indigo-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
                {editingTaskId ? (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentTask}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    削除
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
                  >
                    {editingTaskId ? '変更を保存' : 'タスクを追加'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== FIXED SLOT MODAL ===================== */}
      {modalType === 'slot' && (
        <div
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-md flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5 text-slate-900"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingSlotId ? '固定枠の編集' : '新しい固定枠・講義の追加'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="flex flex-col gap-3.5">
              {/* 表データ参照元バッジ表示 */}
              {(() => {
                const currentSlot = editingSlotId
                  ? slots.find((s) => s.id === editingSlotId)
                  : undefined;
                const srcName = currentSlot
                  ? getSlotSourceFileName(currentSlot)
                  : slotSourceTableName;
                if (!srcName) return null;
                return (
                  <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5 text-xs text-emerald-800">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[11px]">参照元ファイル:</span>
                    <span className="truncate text-xs font-bold text-emerald-900">{srcName}</span>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    名称 (例: アルゴリズム論、睡眠)
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={slotTitle}
                    onChange={(e) => setSlotTitle(e.target.value)}
                    placeholder="枠のタイトル"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">カテゴリ</label>
                  <select
                    value={slotCategory}
                    onChange={(e) => setSlotCategory(e.target.value as FixedCategory)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 focus:outline-none"
                  >
                    <option value="lecture">大学講義・授業</option>
                    <option value="sleep">睡眠 (休養)</option>
                    <option value="work">仕事・学業・バイト</option>
                    <option value="routine">日課・身支度</option>
                    <option value="meal">食事・休憩</option>
                    <option value="other">その他固定</option>
                  </select>
                </div>
              </div>

              {/* Day of Week Selector */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">適用する曜日</label>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSlotDaysPreset('all')}
                      className="rounded bg-slate-100 px-1.5 py-0.2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition font-medium"
                    >
                      毎日
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlotDaysPreset('weekdays')}
                      className="rounded bg-slate-100 px-1.5 py-0.2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition font-medium"
                    >
                      平日のみ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlotDaysPreset('weekend')}
                      className="rounded bg-slate-100 px-1.5 py-0.2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition font-medium"
                    >
                      土日のみ
                    </button>
                  </div>
                </div>

                <div className="flex gap-1">
                  {WEEKDAY_SHORT.map((label, idx) => {
                    const isSelected = slotDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={`slot-day-${idx}`}
                        onClick={() => toggleSlotDay(idx)}
                        className={`flex h-7 flex-1 items-center justify-center rounded-md border text-xs font-bold transition ${
                          isSelected
                            ? 'border-sky-300 bg-sky-100 text-sky-800 shadow-2xs'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700">開始時刻</label>
                  <input
                    type="time"
                    required
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">終了時刻</label>
                  <input
                    type="time"
                    required
                    value={slotEndTime}
                    onChange={(e) => setSlotEndTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* 授業枠の場合: 課題タスクの自動追加オプション */}
              {slotCategory === 'lecture' && !editingSlotId && (
                <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50/70 p-2">
                  <input
                    type="checkbox"
                    id="auto-add-assignment"
                    checked={autoAddAssignment}
                    onChange={(e) => setAutoAddAssignment(e.target.checked)}
                    className="h-4 w-4 rounded border-purple-300 bg-white text-purple-600 focus:ring-purple-500"
                  />
                  <label
                    htmlFor="auto-add-assignment"
                    className="text-xs font-medium text-purple-900 cursor-pointer select-none"
                  >
                    この授業の課題タスク（出題日: 授業日 〜 締切: 前日）も自動追加する
                  </label>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
                {editingSlotId ? (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentSlot}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    削除
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-sky-700"
                  >
                    {editingSlotId ? '変更を保存' : '固定枠を登録'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
