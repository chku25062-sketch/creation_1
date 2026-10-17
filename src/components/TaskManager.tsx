'use client';

import React, { useState, useEffect } from 'react';
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
} from '@/types';
import { formatDuration, minutesToTimeString, timeStringToMinutes } from '@/lib/timeUtils';

export interface TaskManagerProps {
  tasks: TaskItem[];
  onChange: (newTasks: TaskItem[]) => void;
  slots: FixedSlot[];
  onSlotsChange: (newSlots: FixedSlot[]) => void;
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
  const [durationSize, setDurationSize] = useState<TaskDurationSize>('medium'); // 3択: 小(15〜30m), 中(30m〜2h), 大(2h+)
  const [frequency, setFrequency] = useState<TaskFrequency>('medium'); // 4択: 低(週1〜2), 中(週3〜4), 高(週5+), カスタム
  const [customFrequencyCount, setCustomFrequencyCount] = useState(2);
  const [isNoDurationTodo, setIsNoDurationTodo] = useState(false); // 時間枠なしToDo

  // 課題オプション（Must選択時のみ任意で設定可能）
  const [isAssignment, setIsAssignment] = useState(false);
  const [startDay, setStartDay] = useState<number>(0);
  const [deadlineDay, setDeadlineDay] = useState<number>(4);

  // 固定枠用フォームステート
  const [slotTitle, setSlotTitle] = useState('');
  const [slotCategory, setSlotCategory] = useState<FixedCategory>('lecture');
  const [slotStartTime, setSlotStartTime] = useState('10:40');
  const [slotEndTime, setSlotEndTime] = useState('12:10');
  const [slotDays, setSlotDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [autoAddAssignment, setAutoAddAssignment] = useState(true);

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
  ) => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskCategory(presetCategory);
    setDurationSize('medium');
    setFrequency(presetFreq);
    setCustomFrequencyCount(2);
    setIsNoDurationTodo(false);
    setIsAssignment(false);
    setStartDay(0);
    setDeadlineDay(4);
    setModalType('task');
  };

  // 授業枠から課題タスク追加モーダルを開く（出題日=授業日、締切日=授業日前日）
  const openAddAssignmentFromLecture = (slot: FixedSlot) => {
    const lectureDay = slot.daysOfWeek && slot.daysOfWeek.length > 0 ? slot.daysOfWeek[0] : 0;
    const calcDeadlineDay = (lectureDay - 1 + 7) % 7; // 前日

    setEditingTaskId(null);
    setTaskTitle(`${slot.title} レポート課題`);
    setTaskCategory('must'); // 課題は必ず「やらなければいけないこと」
    setDurationSize('medium');
    setFrequency('low'); // 週1回の課題枠
    setIsNoDurationTodo(false);
    setIsAssignment(true);
    setStartDay(lectureDay);
    setDeadlineDay(calcDeadlineDay);
    setModalType('task');
  };

  // タスク編集モーダルを開く
  const openEditTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskCategory(task.category === 'must' || task.taskType === 'assignment' ? 'must' : 'want');
    setDurationSize(
      task.durationSize ||
        (task.durationMinutes < 30 ? 'small' : task.durationMinutes >= 120 ? 'large' : 'medium'),
    );
    setFrequency(task.frequency || (task.period === 'day' ? 'high' : 'medium'));
    setCustomFrequencyCount(task.frequencyCount || 2);
    setIsNoDurationTodo(!!task.hasNoDuration || task.taskType === 'todo');
    setIsAssignment(task.taskType === 'assignment');
    setStartDay(task.startDay ?? 0);
    setDeadlineDay(task.deadlineDay ?? 4);
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

    const period: TaskPeriod = frequency === 'high' ? 'day' : 'week';
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
                taskType,
                priority,
                startDay: isAssignment ? startDay : undefined,
                deadlineDay: isAssignment ? deadlineDay : undefined,
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
        taskType,
        priority,
        completed: false,
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

  // 分割データ: 頻度「高 (週5回以上)」または period 'day' を日ごとスタックに配置
  const dailyTasks = tasks.filter((t) => t.period === 'day' || t.frequency === 'high');
  const weeklyTasks = tasks.filter((t) => !(t.period === 'day' || t.frequency === 'high'));

  const dailyTotalMinutes = dailyTasks.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);
  const weeklyTotalMinutes = weeklyTasks.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);

  // 登録済み授業
  const lectureSlots = slots.filter((s) => s.category === 'lecture');

  return (
    <div
      className={`flex flex-1 min-h-0 flex-col gap-2.5 ${
        embedded
          ? 'bg-transparent p-0'
          : 'rounded-2xl border border-amber-900/10 bg-[#fbfaf5]/90 p-3 shadow-xs sm:p-4'
      }`}
    >
      {/* Top Header & Presets */}
      <div className="flex flex-col gap-2 shrink-0 border-b border-amber-900/10 pb-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {viewMode === 'daily' ? (
            <Sun className="h-4 w-4 text-amber-500" />
          ) : viewMode === 'weekly' ? (
            <CalendarDays className="h-4 w-4 text-purple-600" />
          ) : viewMode === 'slots' ? (
            <Shield className="h-4 w-4 text-sky-600" />
          ) : (
            <Target className="h-4 w-4 text-blue-600" />
          )}
          <h3 className="text-sm font-bold text-slate-800 sm:text-base">
            {viewMode === 'daily'
              ? '日課タスク (高頻度・毎日)'
              : viewMode === 'weekly'
                ? '週次タスク・課題 (今週の目標)'
                : viewMode === 'slots'
                  ? '生活固定枠 (睡眠・講義・勤務・生活リズム)'
                  : '日課・週次タスク・生活固定枠スタック'}
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
          {(viewMode === 'all' || viewMode === 'daily' || viewMode === 'weekly') &&
            PRESET_TASKS.filter((p) => {
              if (viewMode === 'daily') return p.period === 'day' || p.frequency === 'high';
              if (viewMode === 'weekly') return p.period === 'week' || p.taskType === 'assignment';
              return true;
            })
              .slice(0, 3)
              .map((preset) => (
                <button
                  key={preset.title}
                  onClick={() => handleAddPresetTask(preset)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  + {preset.title}
                </button>
              ))}
          {(viewMode === 'all' || viewMode === 'slots') &&
            PRESET_FIXED_SLOTS.slice(0, viewMode === 'slots' ? 5 : 2).map((preset) => (
              <button
                key={preset.title}
                onClick={() => handleAddPresetSlot(preset)}
                className="rounded-md border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
              >
                + {preset.title}
              </button>
            ))}
        </div>
      </div>

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
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 min-h-0 flex-1 cursor-pointer transition hover:border-slate-300"
            title="クリックして日次タスクを追加"
          >
            {/* Column Header */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between border-b border-slate-200 pb-2 cursor-default shrink-0"
            >
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                  <Sun className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">日ごと (高頻度・毎日)</h4>
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
                  className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600 transition"
                >
                  <span>高頻度・毎日のタスクがありません</span>
                  <span className="mt-1 text-xs font-semibold text-blue-600">
                    + タップしてタスクを追加
                  </span>
                </div>
              ) : (
                <>
                  {dailyTasks.map((task) => {
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
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 min-h-0 flex-1 cursor-pointer transition hover:border-slate-300"
            title="クリックして週次タスク・課題を追加"
          >
            {/* Column Header */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between border-b border-slate-200 pb-2 cursor-default shrink-0"
            >
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-purple-700">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">週ごと (課題・ToDo)</h4>
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
                  className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 hover:border-purple-300 hover:text-purple-700 transition"
                >
                  <span>週単位のタスク・課題がありません</span>
                  <span className="mt-1 text-xs font-semibold text-purple-700">
                    + タップして追加
                  </span>
                </div>
              ) : (
                <>
                  {weeklyTasks.map((task) => {
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
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 h-full min-h-0 flex-1 cursor-pointer transition hover:border-slate-300"
            title="クリックして固定枠を追加"
          >
            {/* Column Header */}
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
                  className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 hover:border-sky-300 hover:text-sky-600 transition"
                >
                  <span>登録された固定枠がありません</span>
                  <span className="mt-1 text-xs font-semibold text-sky-600">
                    + タップして固定枠を追加
                  </span>
                </div>
              ) : (
                <>
                  {slots.map((slot) => {
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
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                              <Clock className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                              <span className="shrink-0">
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
                  onWheel={handleCustomWheel}
                  className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-2xs"
                >
                  <div className="flex w-full items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-700">実施頻度</span>
                    <span className="text-[10px] font-semibold text-purple-700">
                      {frequency === 'custom'
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
                        if (frequency !== 'custom') setFrequency('custom');
                        stepCustomCount('up');
                      }}
                      className="flex h-6 w-16 items-center justify-center rounded-t-lg border-t border-x border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                      title="上: 回数を増やす (カスタム)"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>

                    {/* 中段: [ ◀ ] [ 正方形ブロック ] [ ▶ ] */}
                    <div className="flex items-center">
                      {/* 左ボタン (◀) */}
                      <button
                        type="button"
                        onClick={() => rotateFrequency('prev')}
                        className="flex h-16 w-6 items-center justify-center rounded-l-lg border-l border-y border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                        title="左: 前の頻度へ"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* 中央の正方形ディスプレイブロック (タップで次へ) */}
                      {(() => {
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
                        onClick={() => rotateFrequency('next')}
                        className="flex h-16 w-6 items-center justify-center rounded-r-lg border-r border-y border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                        title="右: 次の頻度へ"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 下ボタン (▼) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (frequency !== 'custom') setFrequency('custom');
                        stepCustomCount('down');
                      }}
                      className="flex h-6 w-16 items-center justify-center rounded-b-lg border-b border-x border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95 shadow-2xs"
                      title="下: 回数を減らす (カスタム)"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* フッター説明 */}
                  <span className="text-[9px] text-slate-500 font-medium">
                    ◀ ▶ 頻度切替 / ▲ ▼ 回数上下スクロール
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
