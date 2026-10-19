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

  // 絞り込まれたシンプルタスク設定ステート
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<'must' | 'want'>('want'); // 2択: やらなければいけないこと vs やりたいこと
  const [taskPeriodScope, setTaskPeriodScope] = useState<'day' | 'week'>('week'); // 日(1日複数回) vs 週(週複数回/周期)
  const [dailyCount, setDailyCount] = useState<number>(1); // 1日あたりの目標回数 (1, 2, 3...)
  const [durationSize, setDurationSize] = useState<TaskDurationSize>('medium'); // 3択: 小(15〜30m), 中(30m〜2h), 大(2h+)
  const [frequency, setFrequency] = useState<TaskFrequency>('medium'); // 4択: 低(週1〜2), 中(週3〜4), 高(週5+), カスタム
  const [customFrequencyCount, setCustomFrequencyCount] = useState(2);
  const [isNoDurationTodo, setIsNoDurationTodo] = useState(false); // 時間枠なしToDo

  // 課題オプション（Must選択時のみ任意で設定可能）
  const [isAssignment, setIsAssignment] = useState(false);
  const [startDay, setStartDay] = useState<number>(0);
  const [deadlineDay, setDeadlineDay] = useState<number>(4);

  // 表データ参照元情報
  const [taskSourceTableId, setTaskSourceTableId] = useState<string | undefined>(undefined);
  const [taskSourceTableName, setTaskSourceTableName] = useState<string | undefined>(undefined);

  // 固定枠用フォームステート
  const [slotTitle, setSlotTitle] = useState('');
  const [slotCategory, setSlotCategory] = useState<FixedCategory>('lecture');
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

  // 頻度の横ローテーション切り替え
  const rotateFrequency = (dir: 'prev' | 'next') => {
    const curIdx = FREQUENCY_OPTIONS.findIndex((f) => f.freq === frequency);
    const safeIdx = curIdx >= 0 ? curIdx : 1;
    const nextIdx =
      dir === 'next'
        ? (safeIdx + 1) % FREQUENCY_OPTIONS.length
        : (safeIdx - 1 + FREQUENCY_OPTIONS.length) % FREQUENCY_OPTIONS.length;
    setFrequency(FREQUENCY_OPTIONS[nextIdx].freq);
  };

  // カスタム頻度回数の縦スクロール（上下）
  const stepCustomCount = (dir: 'up' | 'down') => {
    if (dir === 'up') {
      setCustomFrequencyCount((prev) => (prev < 6 ? prev + 1 : 1));
    } else {
      setCustomFrequencyCount((prev) => (prev > 1 ? prev - 1 : 6));
    }
  };

  // マウスホイールによる縦スクロール
  const handleCustomWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      stepCustomCount('up');
    } else if (e.deltaY > 0) {
      stepCustomCount('down');
    }
  };

  // タスク追加モーダルを開く
  const openAddTask = (
    presetCategory: 'must' | 'want' = 'want',
    presetFreq: TaskFrequency = 'medium',
    presetPeriod: 'day' | 'week' = presetFreq === 'high' ? 'day' : 'week',
  ) => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskCategory(presetCategory);
    setTaskPeriodScope(presetPeriod);
    setDailyCount(1);
    setDurationSize('medium');
    setFrequency(presetFreq);
    setCustomFrequencyCount(2);
    setIsNoDurationTodo(false);
    setIsAssignment(false);
    setStartDay(0);
    setDeadlineDay(4);
    setTaskSourceTableId(undefined);
    setTaskSourceTableName(undefined);
    setModalType('task');
  };

  // 授業枠から課題タスク追加モーダルを開く（出題日=授業日、締切日=授業日前日）
  const openAddAssignmentFromLecture = (slot: FixedSlot) => {
    const lectureDay = slot.daysOfWeek && slot.daysOfWeek.length > 0 ? slot.daysOfWeek[0] : 0;
    const calcDeadlineDay = (lectureDay - 1 + 7) % 7; // 前日

    setEditingTaskId(null);
    setTaskTitle(`${slot.title} レポート課題`);
    setTaskCategory('must'); // 課題は必ず「やらなければいけないこと」
    setTaskPeriodScope('week');
    setDailyCount(1);
    setDurationSize('medium');
    setFrequency('low'); // 週1回の課題枠
    setIsNoDurationTodo(false);
    setIsAssignment(true);
    setStartDay(lectureDay);
    setDeadlineDay(calcDeadlineDay);
    setTaskSourceTableId(slot.sourceTableId);
    setTaskSourceTableName(slot.sourceTableName);
    setModalType('task');
  };

  // タスク編集モーダルを開く
  const openEditTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskCategory(task.category === 'must' || task.taskType === 'assignment' ? 'must' : 'want');
    const isDaily = task.period === 'day' || task.frequency === 'high';
    setTaskPeriodScope(isDaily ? 'day' : 'week');
    setDailyCount(task.dailyCount || 1);
    setDurationSize(
      task.durationSize ||
        (task.durationMinutes < 30 ? 'small' : task.durationMinutes >= 120 ? 'large' : 'medium'),
    );
    setFrequency(task.frequency || (isDaily ? 'high' : 'medium'));
    setCustomFrequencyCount(task.frequencyCount || 2);
    setIsNoDurationTodo(!!task.hasNoDuration || task.taskType === 'todo');
    setIsAssignment(task.taskType === 'assignment');
    setStartDay(task.startDay ?? 0);
    setDeadlineDay(task.deadlineDay ?? 4);
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
      : durationSize === 'small'
        ? 25
        : durationSize === 'medium'
          ? 60
          : 120;

    const period: TaskPeriod = taskPeriodScope === 'day' ? 'day' : 'week';
    const finalDailyCount = taskPeriodScope === 'day' ? Math.max(1, dailyCount) : undefined;
    const taskType: TaskType = isNoDurationTodo ? 'todo' : isAssignment ? 'assignment' : 'task';
    const priority: TaskPriority = taskCategory === 'must' ? 'high' : 'medium';

    if (editingTaskId) {
      onChange(
        tasks.map((t) =>
          t.id === editingTaskId
            ? {
                ...t,
                title: taskTitle.trim(),
                category: taskCategory,
                durationSize,
                durationMinutes: defaultMinutes,
                hasNoDuration: isNoDurationTodo,
                frequency,
                frequencyCount: frequency === 'custom' ? customFrequencyCount : undefined,
                period,
                dailyCount: finalDailyCount,
                taskType,
                priority,
                startDay: isAssignment ? startDay : undefined,
                deadlineDay: isAssignment ? deadlineDay : undefined,
                sourceTableId: taskSourceTableId,
                sourceTableName: taskSourceTableName,
              }
            : t,
        ),
      );
    } else {
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        title: taskTitle.trim(),
        category: taskCategory,
        durationSize,
        durationMinutes: defaultMinutes,
        hasNoDuration: isNoDurationTodo,
        frequency,
        frequencyCount: frequency === 'custom' ? customFrequencyCount : undefined,
        period,
        dailyCount: finalDailyCount,
        taskType,
        priority,
        completed: false,
        sourceTableId: taskSourceTableId,
        sourceTableName: taskSourceTableName,
        ...(isAssignment ? { startDay, deadlineDay } : {}),
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

    const categoryColors: Record<FixedCategory, string> = {
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
                color: categoryColors[slotCategory],
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
        color: categoryColors[slotCategory],
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

  const getSlotCategoryIcon = (cat: FixedCategory) => {
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

  // 絞り込み & 並び替えされた日課タスク
  const filteredAndSortedDailyTasks = useMemo(() => {
    let result = [...dailyTasks];

    // 1. カテゴリ絞り込み
    if (taskCategoryFilter !== 'all') {
      if (taskCategoryFilter === 'must') {
        result = result.filter((t) => t.category === 'must' || t.taskType === 'assignment');
      } else if (taskCategoryFilter === 'want') {
        result = result.filter((t) => t.category === 'want' && t.taskType !== 'assignment');
      } else if (taskCategoryFilter === 'todo') {
        result = result.filter((t) => t.taskType === 'todo' || t.hasNoDuration);
      }
    }

    // 2. 曜日絞り込み
    if (taskDayFilter !== 'all') {
      const targetDay = Number(taskDayFilter);
      result = result.filter((t) => {
        if (t.deadlineDay !== undefined) return t.deadlineDay === targetDay;
        if (t.startDay !== undefined) return t.startDay === targetDay;
        return true; // 毎日タスクはどの曜日にも該当
      });
    }

    // 3. 並び替え
    result.sort((a, b) => {
      if (taskSortKey === 'priority') {
        const isMustA = a.category === 'must' || a.taskType === 'assignment';
        const isMustB = b.category === 'must' || b.taskType === 'assignment';
        if (isMustA && !isMustB) return -1;
        if (!isMustA && isMustB) return 1;
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
  }, [dailyTasks, taskCategoryFilter, taskDayFilter, taskSortKey]);

  // 絞り込み & 並び替えされた週次タスク
  const filteredAndSortedWeeklyTasks = useMemo(() => {
    let result = [...weeklyTasks];

    // 1. カテゴリ絞り込み
    if (taskCategoryFilter !== 'all') {
      if (taskCategoryFilter === 'assignment') {
        result = result.filter((t) => t.taskType === 'assignment');
      } else if (taskCategoryFilter === 'must') {
        result = result.filter((t) => t.category === 'must' && t.taskType !== 'assignment');
      } else if (taskCategoryFilter === 'want') {
        result = result.filter((t) => t.category === 'want');
      } else if (taskCategoryFilter === 'todo') {
        result = result.filter((t) => t.taskType === 'todo' || t.hasNoDuration);
      }
    }

    // 2. 曜日絞り込み（課題の締切・出題曜日）
    if (taskDayFilter !== 'all') {
      const targetDay = Number(taskDayFilter);
      result = result.filter((t) => {
        if (t.deadlineDay !== undefined && t.deadlineDay === targetDay) return true;
        if (t.startDay !== undefined && t.startDay === targetDay) return true;
        return false;
      });
    }

    // 3. 並び替え
    result.sort((a, b) => {
      if (taskSortKey === 'priority') {
        const isAssignA = a.taskType === 'assignment';
        const isAssignB = b.taskType === 'assignment';
        if (isAssignA && !isAssignB) return -1;
        if (!isAssignA && isAssignB) return 1;
        const isMustA = a.category === 'must';
        const isMustB = b.category === 'must';
        if (isMustA && !isMustB) return -1;
        if (!isMustA && isMustB) return 1;
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
        /* 日課タスク (高頻度・毎日) ツールバー */
        <div className="flex flex-col gap-2 shrink-0 rounded-xl border border-slate-200/90 bg-white/80 backdrop-blur-xs p-2.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 追加ボタン & プリセット */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openAddTask('want', 'high')}
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
                {filteredAndSortedDailyTasks.length}/{dailyTasks.length}件
              </span>
            </div>
          </div>

          {/* 絞り込み行: カテゴリ & 曜日 (折り畳み式) */}
          {isDailyFilterOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs animate-in fade-in duration-150">
              {/* カテゴリ絞り込み */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">カテゴリ:</span>
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'must', label: 'やるべき (Must)' },
                  { id: 'want', label: 'やりたい (Want)' },
                ].map((cat) => {
                  const isActive = taskCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setTaskCategoryFilter(cat.id)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-2xs'
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
        /* 週次タスク・課題・ToDo ツールバー */
        <div className="flex flex-col gap-2 shrink-0 rounded-xl border border-slate-200/90 bg-white/80 backdrop-blur-xs p-2.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 追加ボタン & プリセット */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openAddTask('must', 'medium')}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-purple-700 active:scale-98"
                title="新しい週次タスクを追加する"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>週次タスクを追加</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  openAddTask('must', 'low');
                  setIsAssignment(true);
                }}
                className="hidden xs:flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1.5 text-xs font-bold text-purple-700 shadow-2xs transition hover:bg-purple-100"
                title="課題レポートを追加"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>+課題</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  openAddTask('must', 'low');
                  setIsNoDurationTodo(true);
                }}
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
              {/* カテゴリ絞り込み */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">カテゴリ:</span>
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'assignment', label: '課題' },
                  { id: 'must', label: 'やるべき (Must)' },
                  { id: 'want', label: 'やりたい (Want)' },
                  { id: 'todo', label: 'ToDo' },
                ].map((cat) => {
                  const isActive = taskCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setTaskCategoryFilter(cat.id)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {cat.label}
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
              if (e.target === e.currentTarget) openAddTask('want', 'high');
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
                    <h4 className="text-xs font-bold text-slate-900">日 (1日に複数回 / 日次)</h4>
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
                    onClick={() => openAddTask('want', 'high')}
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
                if (e.target === e.currentTarget) openAddTask('want', 'high');
              }}
              className={`pt-1 flex-1 min-h-[140px] ${
                viewMode !== 'all'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 items-stretch overflow-y-auto'
                  : 'flex flex-col gap-2 overflow-y-auto'
              }`}
            >
              {dailyTasks.length === 0 ? (
                <div
                  onClick={() => openAddTask('want', 'high')}
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
                  <p className="font-semibold text-slate-700">条件に一致する日課タスクがありません</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    カテゴリまたは曜日の絞り込み条件を変更してください
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
                    const isMust = task.category === 'must' || task.taskType === 'assignment';
                    return (
                      <div
                        key={task.id}
                        onClick={() => openEditTask(task)}
                        title="タップして編集"
                        className={`group relative flex items-center justify-between overflow-hidden rounded-xl border p-2.5 transition cursor-pointer shrink-0 min-h-[64px] ${
                          task.completed
                            ? 'border-slate-200 bg-slate-100/70 opacity-60'
                            : isMust
                              ? 'border-rose-200/90 bg-rose-50/40 hover:border-rose-300 hover:bg-white hover:shadow-xs'
                              : 'border-blue-200/90 bg-blue-50/40 hover:border-blue-300 hover:bg-white hover:shadow-xs'
                        }`}
                      >
                        {/* Left Accent Bar */}
                        <div
                          className={`absolute inset-y-0 left-0 w-1 ${
                            task.completed ? 'bg-slate-300' : isMust ? 'bg-rose-500' : 'bg-blue-500'
                          }`}
                        />

                        <div className="flex items-center gap-2 pl-1 min-w-0 flex-1">
                          <button
                            onClick={(e) => handleToggleComplete(e, task.id)}
                            title={task.completed ? '未完了に戻す' : '完了にする'}
                            className="shrink-0 text-slate-400 transition hover:text-blue-600"
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

                              {isMust ? (
                                <span className="shrink-0 flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
                                  📌 やるべき
                                </span>
                              ) : (
                                <span className="shrink-0 flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold text-blue-700">
                                  🌟 やりたい
                                </span>
                              )}

                              {getTaskSourceFileName(task) && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-medium text-emerald-800"
                                  title={`参照元表データ: ${getTaskSourceFileName(task)}`}
                                >
                                  <FileSpreadsheet className="h-2.5 w-2.5 text-emerald-600" />
                                  <span className="max-w-[120px] truncate">
                                    {getTaskSourceFileName(task)}
                                  </span>
                                </span>
                              )}
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
                                <Repeat className="h-2.5 w-2.5 text-slate-400" />高 (毎日)
                              </span>
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
                    onClick={() => openAddTask('want', 'high')}
                    className="shrink-0 flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 bg-white py-2 text-[11px] font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 min-h-[40px]"
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
              if (e.target === e.currentTarget) openAddTask('must', 'medium');
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
                    <h4 className="text-xs font-bold text-slate-900">週 (週に複数回 / 周期)</h4>
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
                      openAddTask('must', 'low');
                      setIsAssignment(true);
                    }}
                    title="課題を追加"
                    className="flex items-center gap-0.5 rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 transition hover:bg-purple-100 hover:border-purple-300"
                  >
                    <GraduationCap className="h-2.5 w-2.5" />
                    +課題
                  </button>
                  <button
                    onClick={() => {
                      openAddTask('must', 'low');
                      setIsNoDurationTodo(true);
                    }}
                    title="ToDoを追加"
                    className="flex items-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100 hover:border-amber-300"
                  >
                    <CheckSquare className="h-2.5 w-2.5" />
                    +ToDo
                  </button>
                  <button
                    onClick={() => openAddTask('want', 'medium')}
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
                if (e.target === e.currentTarget) openAddTask('must', 'medium');
              }}
              className={`pt-1 flex-1 min-h-[140px] ${
                viewMode !== 'all'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 items-stretch overflow-y-auto'
                  : 'flex flex-col gap-2 overflow-y-auto'
              }`}
            >
              {weeklyTasks.length === 0 ? (
                <div
                  onClick={() => openAddTask('must', 'medium')}
                  className="col-span-full flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 hover:border-purple-300 hover:text-purple-700 transition bg-white/40"
                >
                  <CalendarDays className="h-8 w-8 text-purple-300 mb-2" />
                  <span className="font-semibold text-slate-700">週単位のタスク・課題がありません</span>
                  <span className="mt-1 text-xs font-bold text-purple-600">
                    + タップして追加
                  </span>
                </div>
              ) : filteredAndSortedWeeklyTasks.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500 bg-white/40">
                  <p className="font-semibold text-slate-700">条件に一致する週次タスクがありません</p>
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
                    const isMust = task.category === 'must' || task.taskType === 'assignment';
                    const isAssign = task.taskType === 'assignment';
                    const isTodo = task.taskType === 'todo' || task.hasNoDuration;

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
                                : isMust
                                  ? 'border-rose-200/90 bg-rose-50/40 hover:border-rose-300 hover:bg-white hover:shadow-xs'
                                  : 'border-blue-200/90 bg-blue-50/40 hover:border-blue-300 hover:bg-white hover:shadow-xs'
                        }`}
                      >
                        {/* Left Accent Bar */}
                        <div
                          className={`absolute inset-y-0 left-0 w-1 ${
                            task.completed
                              ? 'bg-slate-300'
                              : isAssign
                                ? 'bg-purple-500'
                                : isTodo
                                  ? 'bg-amber-400'
                                  : isMust
                                    ? 'bg-rose-500'
                                    : 'bg-blue-500'
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
                              ) : isMust ? (
                                <span className="shrink-0 flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
                                  📌 やるべき
                                </span>
                              ) : (
                                <span className="shrink-0 flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold text-blue-700">
                                  🌟 やりたい
                                </span>
                              )}

                              {getTaskSourceFileName(task) && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-medium text-emerald-800"
                                  title={`参照元表データ: ${getTaskSourceFileName(task)}`}
                                >
                                  <FileSpreadsheet className="h-2.5 w-2.5 text-emerald-600" />
                                  <span className="max-w-[120px] truncate">
                                    {getTaskSourceFileName(task)}
                                  </span>
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
                                  ? '低 (週1〜2回)'
                                  : task.frequency === 'medium'
                                    ? '中 (週3〜4回)'
                                    : task.frequency === 'custom'
                                      ? `週${task.frequencyCount}回`
                                      : '週枠'}
                              </span>

                              {isAssign &&
                                task.startDay !== undefined &&
                                task.deadlineDay !== undefined && (
                                  <span className="text-[9px] text-slate-500">
                                    ({DAY_LABELS[task.startDay]}出題〜{DAY_LABELS[task.deadlineDay]}
                                    締切)
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
                    onClick={() => openAddTask('must', 'medium')}
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

      {/* ===================== SIMPLIFIED TASK MODAL ===================== */}
      {modalType === 'task' && (
        <div
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-lg flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl text-slate-900"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    taskCategory === 'must'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {editingTaskId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingTaskId ? 'タスクの編集' : '新しいタスクの追加'}
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

            <form onSubmit={handleSaveTask} className="flex flex-col gap-2.5">
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
                    <span className="font-semibold text-[11px]">参照元ファイル:</span>
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
                  placeholder="例: プログラミング演習、ジム筋トレ、英会話"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* 2. カテゴリ（2択: やらなければいけないこと vs やりたいこと） */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  分類（どちらに該当しますか？）
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskCategory('must')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition border ${
                      taskCategory === 'must'
                        ? 'border-rose-300 bg-rose-50 text-rose-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>📌 やらなければいけないこと</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskCategory('want');
                      setIsAssignment(false);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition border ${
                      taskCategory === 'want'
                        ? 'border-blue-300 bg-blue-50 text-blue-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🌟 やりたいこと</span>
                  </button>
                </div>
              </div>

              {/* 期間スコープ（日: 1日に複数回 vs 週: 週に複数回/周期） */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  期間スコープ
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTaskPeriodScope('day');
                      setFrequency('high');
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition border ${
                      taskPeriodScope === 'day'
                        ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5 text-amber-600" />
                    <span>🏃 日 (1日に複数回)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskPeriodScope('week');
                      if (frequency === 'high') setFrequency('medium');
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition border ${
                      taskPeriodScope === 'week'
                        ? 'border-purple-300 bg-purple-50 text-purple-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
                    <span>🎯 週 (週に複数回 / 周期)</span>
                  </button>
                </div>
              </div>

              {/* 3. 正方形ブロック＋十字コントローラー: [所要時間] & [実施頻度] */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* 3-A. 所要時間コントローラー */}
                <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-2xs">
                  <div className="flex w-full items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-700">所要時間</span>
                    <span className="text-[10px] font-semibold text-blue-700">
                      {isNoDurationTodo
                        ? '時間枠なし (ToDo)'
                        : (() => {
                            const curDur =
                              DURATION_OPTIONS.find((d) => d.size === durationSize) ||
                              DURATION_OPTIONS[1];
                            return curDur.badge;
                          })()}
                    </span>
                  </div>

                  {/* 十字キー（D-pad）レイアウト */}
                  <div className="my-1.5 flex flex-col items-center">
                    {/* 上ボタン (▲) */}
                    <button
                      type="button"
                      onClick={() => setIsNoDurationTodo(!isNoDurationTodo)}
                      className="flex h-6 w-16 items-center justify-center rounded-t-lg border-t border-x border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                      title="上: 時間枠なし(ToDo) 切り替え"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>

                    {/* 中段: [ ◀ ] [ 正方形ブロック ] [ ▶ ] */}
                    <div className="flex items-center">
                      {/* 左ボタン (◀) */}
                      <button
                        type="button"
                        onClick={() => rotateDuration('prev')}
                        className="flex h-16 w-6 items-center justify-center rounded-l-lg border-l border-y border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                        title="左: 前の所要時間へ"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* 中央の正方形ディスプレイブロック (タップで次へ) */}
                      {(() => {
                        const curDur =
                          DURATION_OPTIONS.find((d) => d.size === durationSize) ||
                          DURATION_OPTIONS[1];
                        return (
                          <button
                            type="button"
                            onClick={() => rotateDuration('next')}
                            className={`flex h-16 w-16 flex-col items-center justify-center border transition select-none active:scale-95 ${
                              isNoDurationTodo
                                ? 'border-amber-300 bg-amber-50 shadow-xs'
                                : 'border-blue-300 bg-white shadow-xs hover:border-blue-400'
                            }`}
                            title="クリックして次のサイズへ"
                          >
                            {isNoDurationTodo ? (
                              <>
                                <CheckSquare className="h-4 w-4 text-amber-700 mb-0.5" />
                                <span className="text-[11px] font-bold text-amber-800">ToDo</span>
                                <span className="text-[8px] text-amber-700">枠なし</span>
                              </>
                            ) : (
                              <>
                                <span className="text-xl font-black text-blue-700">
                                  {curDur.label}
                                </span>
                                <span className="text-[9px] font-bold text-blue-600 mt-0.5">
                                  {curDur.badge}
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })()}

                      {/* 右ボタン (▶) */}
                      <button
                        type="button"
                        onClick={() => rotateDuration('next')}
                        className="flex h-16 w-6 items-center justify-center rounded-r-lg border-r border-y border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                        title="右: 次の所要時間へ"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 下ボタン (▼) */}
                    <button
                      type="button"
                      onClick={() => setIsNoDurationTodo(!isNoDurationTodo)}
                      className="flex h-6 w-16 items-center justify-center rounded-b-lg border-b border-x border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                      title="下: 時間枠なし(ToDo) 切り替え"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* フッター説明 */}
                  <span className="text-[9px] text-slate-500 font-medium">
                    ◀ ▶ 小/中/大 / ▲ ▼ 枠なし切替
                  </span>
                </div>

                {/* 3-B. 実施頻度コントローラー */}
                <div
                  onWheel={(e) => {
                    if (taskPeriodScope === 'day') {
                      e.preventDefault();
                      if (e.deltaY < 0) setDailyCount((prev) => Math.min(prev + 1, 6));
                      else if (e.deltaY > 0) setDailyCount((prev) => Math.max(prev - 1, 1));
                    } else {
                      handleCustomWheel(e);
                    }
                  }}
                  className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-2xs"
                >
                  <div className="flex w-full items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-700">
                      {taskPeriodScope === 'day' ? '1日の回数' : '実施頻度'}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        taskPeriodScope === 'day' ? 'text-amber-700' : 'text-purple-700'
                      }`}
                    >
                      {taskPeriodScope === 'day'
                        ? `1日に ${dailyCount} 回組み込み`
                        : frequency === 'custom'
                          ? `週 ${customFrequencyCount} 回 (カスタム)`
                          : (() => {
                              const curFreq =
                                FREQUENCY_OPTIONS.find((f) => f.freq === frequency) ||
                                FREQUENCY_OPTIONS[1];
                              return `${curFreq.label} (${curFreq.badge})`;
                            })()}
                    </span>
                  </div>

                  {/* 十字キー（D-pad）レイアウト */}
                  <div className="my-1.5 flex flex-col items-center">
                    {/* 上ボタン (▲) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (taskPeriodScope === 'day') {
                          setDailyCount((prev) => Math.min(prev + 1, 6));
                        } else {
                          if (frequency !== 'custom') setFrequency('custom');
                          stepCustomCount('up');
                        }
                      }}
                      className="flex h-6 w-16 items-center justify-center rounded-t-lg border-t border-x border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                      title={taskPeriodScope === 'day' ? '上: 1日の回数を増やす' : '上: 回数を増やす (カスタム)'}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>

                    {/* 中段: [ ◀ ] [ 正方形ブロック ] [ ▶ ] */}
                    <div className="flex items-center">
                      {/* 左ボタン (◀) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (taskPeriodScope === 'day') {
                            setDailyCount((prev) => (prev > 1 ? prev - 1 : 4));
                          } else {
                            rotateFrequency('prev');
                          }
                        }}
                        className="flex h-16 w-6 items-center justify-center rounded-l-lg border-l border-y border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                        title="左: 前の回数/頻度へ"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* 中央の正方形ディスプレイブロック (タップで次へ) */}
                      {(() => {
                        if (taskPeriodScope === 'day') {
                          return (
                            <button
                              type="button"
                              onClick={() => setDailyCount((prev) => (prev < 4 ? prev + 1 : 1))}
                              className="flex h-16 w-16 flex-col items-center justify-center border border-amber-300 bg-white shadow-xs hover:border-amber-400 transition select-none active:scale-95"
                              title="クリックして1日の回数を変更"
                            >
                              <div className="flex items-baseline gap-0.5">
                                <span className="text-xl font-black text-amber-700">
                                  {dailyCount}
                                </span>
                                <span className="text-[10px] font-bold text-amber-600">回</span>
                              </div>
                              <span className="text-[8px] font-bold text-amber-700">
                                1日あたり
                              </span>
                            </button>
                          );
                        }

                        const curFreq =
                          FREQUENCY_OPTIONS.find((f) => f.freq === frequency) ||
                          FREQUENCY_OPTIONS[1];
                        return (
                          <button
                            type="button"
                            onClick={() => rotateFrequency('next')}
                            className="flex h-16 w-16 flex-col items-center justify-center border border-purple-300 bg-white shadow-xs hover:border-purple-400 transition select-none active:scale-95"
                            title="クリックして次の頻度へ"
                          >
                            {frequency === 'custom' ? (
                              <>
                                <div className="flex items-baseline gap-0.5">
                                  <span className="text-xl font-black text-purple-700">
                                    {customFrequencyCount}
                                  </span>
                                  <span className="text-[10px] font-bold text-purple-600">回</span>
                                </div>
                                <span className="text-[8px] font-bold text-purple-700">
                                  カスタム
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-xl font-black text-purple-700">
                                  {curFreq.label}
                                </span>
                                <span className="text-[9px] font-bold text-purple-600 mt-0.5">
                                  {curFreq.badge}
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })()}

                      {/* 右ボタン (▶) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (taskPeriodScope === 'day') {
                            setDailyCount((prev) => (prev < 4 ? prev + 1 : 1));
                          } else {
                            rotateFrequency('next');
                          }
                        }}
                        className="flex h-16 w-6 items-center justify-center rounded-r-lg border-r border-y border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                        title="右: 次の回数/頻度へ"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 下ボタン (▼) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (taskPeriodScope === 'day') {
                          setDailyCount((prev) => Math.max(prev - 1, 1));
                        } else {
                          if (frequency !== 'custom') setFrequency('custom');
                          stepCustomCount('down');
                        }
                      }}
                      className="flex h-6 w-16 items-center justify-center rounded-b-lg border-b border-x border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                      title={taskPeriodScope === 'day' ? '下: 1日の回数を減らす' : '下: 回数を減らす (カスタム)'}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* フッター説明 */}
                  <span className="text-[9px] text-slate-500 font-medium">
                    {taskPeriodScope === 'day'
                      ? '◀ ▶ 回数切替 / ▲ ▼ 増減'
                      : '◀ ▶ 頻度切替 / ▲ ▼ 回数上下スクロール'}
                  </span>
                </div>
              </div>

              {/* 5. 課題オプション（Must時のみ、授業連携・締切日を設定可能） */}
              {taskCategory === 'must' && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 cursor-pointer">
                      <GraduationCap className="h-4 w-4 text-purple-700" />
                      <span>大学の課題・レポートとして登録する</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={isAssignment}
                      onChange={(e) => setIsAssignment(e.target.checked)}
                      className="rounded border-purple-300 bg-white text-purple-600 focus:ring-purple-500"
                    />
                  </div>

                  {isAssignment && (
                    <div className="mt-2.5 flex flex-col gap-2 border-t border-purple-200 pt-2">
                      {lectureSlots.length > 0 && (
                        <div>
                          <label className="text-[10px] font-semibold text-purple-800">
                            登録済みの授業から引用:
                          </label>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const sel = slots.find((s) => s.id === e.target.value);
                              if (sel) {
                                const lDay = sel.daysOfWeek?.[0] ?? 0;
                                setTaskTitle(`${sel.title} レポート課題`);
                                setStartDay(lDay);
                                setDeadlineDay((lDay - 1 + 7) % 7);
                              }
                            }}
                            className="mt-0.5 w-full rounded border border-purple-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-purple-500 focus:outline-none"
                          >
                            <option value="" disabled>
                              授業を選択すると自動入力されます...
                            </option>
                            {lectureSlots.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.title} ({formatDaysString(l.daysOfWeek)}開講)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-purple-800">
                            出題曜日 (授業日)
                          </label>
                          <select
                            value={startDay}
                            onChange={(e) => setStartDay(parseInt(e.target.value, 10))}
                            className="mt-0.5 w-full rounded border border-purple-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-purple-500 focus:outline-none"
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
                            締切曜日 (前日)
                          </label>
                          <select
                            value={deadlineDay}
                            onChange={(e) => setDeadlineDay(parseInt(e.target.value, 10))}
                            className="mt-0.5 w-full rounded border border-purple-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-purple-500 focus:outline-none"
                          >
                            {DAY_LABELS.map((label, idx) => (
                              <option key={idx} value={idx}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
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
