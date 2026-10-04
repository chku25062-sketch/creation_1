'use client';

import React, { useState } from 'react';
import {
  Target,
  Plus,
  Trash2,
  Clock,
  Flame,
  BookOpen,
  Dumbbell,
  Palette,
  Briefcase,
  CheckCircle2,
  Circle,
  Zap,
  Sun,
  CalendarDays,
  X,
} from 'lucide-react';
import { TaskItem, TaskCategory, TaskPriority, TaskPeriod } from '@/types';
import { formatDuration } from '@/lib/timeUtils';

interface TaskManagerProps {
  tasks: TaskItem[];
  onChange: (newTasks: TaskItem[]) => void;
}

const PRESET_TASKS: Omit<TaskItem, 'id'>[] = [
  {
    title: '基本情報・資格試験対策',
    durationMinutes: 60,
    priority: 'high',
    category: 'study',
    period: 'day',
  },
  {
    title: 'ジム・筋トレ＆有酸素',
    durationMinutes: 45,
    priority: 'high',
    category: 'workout',
    period: 'day',
  },
  {
    title: '技術書・教養読書',
    durationMinutes: 30,
    priority: 'medium',
    category: 'hobby',
    period: 'day',
  },
  {
    title: '個人プロダクト開発',
    durationMinutes: 90,
    priority: 'high',
    category: 'creative',
    period: 'week',
  },
  {
    title: '部屋の整理・クリーンアップ',
    durationMinutes: 45,
    priority: 'low',
    category: 'other',
    period: 'week',
  },
];

export function TaskManager({ tasks, onChange }: TaskManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [targetPeriod, setTargetPeriod] = useState<TaskPeriod>('day');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('study');

  const openAddForm = (period: TaskPeriod) => {
    setTargetPeriod(period);
    setIsAdding(true);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || durationMinutes <= 0) return;

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      durationMinutes,
      priority,
      category,
      period: targetPeriod,
      completed: false,
    };

    onChange([...tasks, newTask]);
    setTitle('');
    setIsAdding(false);
  };

  const handleAddPreset = (preset: Omit<TaskItem, 'id'>) => {
    const newTask: TaskItem = {
      ...preset,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      completed: false,
    };
    onChange([...tasks, newTask]);
  };

  const handleToggleComplete = (id: string) => {
    onChange(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleDelete = (id: string) => {
    onChange(tasks.filter((t) => t.id !== id));
  };

  const getCategoryIcon = (cat: TaskCategory) => {
    switch (cat) {
      case 'study':
        return <BookOpen className="h-3.5 w-3.5 text-cyan-400" />;
      case 'workout':
        return <Dumbbell className="h-3.5 w-3.5 text-emerald-400" />;
      case 'creative':
        return <Palette className="h-3.5 w-3.5 text-purple-400" />;
      default:
        return <Briefcase className="h-3.5 w-3.5 text-pink-400" />;
    }
  };

  // 日ごとタスクと週ごとタスクに分割
  const dailyTasks = tasks.filter((t) => t.period === 'day');
  const weeklyTasks = tasks.filter((t) => t.period === 'week' || t.period === 'month');

  const dailyTotalMinutes = dailyTasks.reduce((acc, t) => acc + t.durationMinutes, 0);
  const weeklyTotalMinutes = weeklyTasks.reduce((acc, t) => acc + t.durationMinutes, 0);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md sm:p-5">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white sm:text-base">
            目標・やりたいことタスクスタック
          </h3>
        </div>

        {/* Quick Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Zap className="h-3 w-3 text-amber-400" />
            プリセット:
          </span>
          {PRESET_TASKS.slice(0, 3).map((preset) => (
            <button
              key={preset.title}
              onClick={() => handleAddPreset(preset)}
              className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              + {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* Add Task Modal / Expanded Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="relative flex flex-col gap-3 rounded-xl border border-cyan-500/40 bg-slate-950/90 p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300">
              {targetPeriod === 'day' ? '☀️ 日ごとのタスクを追加' : '📅 週ごとのタスクを追加'}
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="text-xs text-slate-400">タスク名</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="目標・やりたいこと"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <label className="text-xs text-slate-400">所要時間 (分)</label>
              <input
                type="number"
                min="10"
                max="720"
                step="5"
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 30)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">優先度</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="high">高 (最優先)</option>
                <option value="medium">中 (標準)</option>
                <option value="low">低 (空き時間)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400">カテゴリ</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="study">学習・インプット</option>
                <option value="workout">運動・筋トレ</option>
                <option value="creative">創作・副業</option>
                <option value="hobby">趣味・読書</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-600/30 transition hover:bg-cyan-500"
            >
              ブロックを追加
            </button>
          </div>
        </form>
      )}

      {/* 2-Column Block Stacks: Daily Tasks vs Weekly Tasks */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        {/* Column 1: Daily Tasks Stack */}
        <div className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          {/* Column Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
                <Sun className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-bold text-white">日ごとのタスク (毎日)</h4>
              <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
                {dailyTasks.length}件
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-cyan-400">
                計 {formatDuration(dailyTotalMinutes)}
              </span>
              <button
                onClick={() => openAddForm('day')}
                title="日次タスクを追加"
                className="flex items-center gap-0.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                <Plus className="h-3 w-3" />
                追加
              </button>
            </div>
          </div>

          {/* Daily Blocks Stack List */}
          <div className="flex flex-col gap-2 pt-1">
            {dailyTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 py-6 text-center text-xs text-slate-500">
                <span>毎日のタスクがまだありません</span>
                <button
                  onClick={() => openAddForm('day')}
                  className="mt-1.5 text-xs text-cyan-400 hover:underline"
                >
                  + 日次タスクを追加
                </button>
              </div>
            ) : (
              dailyTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group relative flex items-center justify-between overflow-hidden rounded-xl border p-2.5 transition ${
                    task.completed
                      ? 'border-slate-800/40 bg-slate-900/20 opacity-60'
                      : 'border-slate-800/90 bg-slate-900/60 hover:border-cyan-500/50 hover:bg-slate-900/90 hover:shadow-md'
                  }`}
                >
                  {/* Left Accent Bar */}
                  <div
                    className={`absolute inset-y-0 left-0 w-1 ${
                      task.completed
                        ? 'bg-slate-700'
                        : task.priority === 'high'
                          ? 'bg-rose-500'
                          : task.priority === 'medium'
                            ? 'bg-cyan-400'
                            : 'bg-slate-600'
                    }`}
                  />

                  <div className="flex items-center gap-2.5 pl-1.5">
                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleComplete(task.id)}
                      title={task.completed ? '未完了に戻す' : '完了にする'}
                      className="text-slate-500 transition hover:text-cyan-400"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-600 hover:text-slate-400" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="rounded-md border border-slate-800 bg-slate-950 p-1.5">
                        {getCategoryIcon(task.category)}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5
                            className={`text-xs font-semibold ${
                              task.completed ? 'text-slate-500 line-through' : 'text-white'
                            }`}
                          >
                            {task.title}
                          </h5>
                          {task.priority === 'high' && (
                            <span className="flex items-center gap-0.5 rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-bold text-rose-300">
                              <Flame className="h-2.5 w-2.5 text-rose-400" />
                              高優先
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5 text-slate-500" />
                            {formatDuration(task.durationMinutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(task.id)}
                    title="タスクを削除"
                    className="rounded-md p-1 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Weekly Tasks Stack */}
        <div className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          {/* Column Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-bold text-white">週ごとのタスク (週間枠)</h4>
              <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
                {weeklyTasks.length}件
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-purple-400">
                計 {formatDuration(weeklyTotalMinutes)}
              </span>
              <button
                onClick={() => openAddForm('week')}
                title="週次タスクを追加"
                className="flex items-center gap-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-300 transition hover:bg-purple-500/20"
              >
                <Plus className="h-3 w-3" />
                追加
              </button>
            </div>
          </div>

          {/* Weekly Blocks Stack List */}
          <div className="flex flex-col gap-2 pt-1">
            {weeklyTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 py-6 text-center text-xs text-slate-500">
                <span>週単位のタスクがまだありません</span>
                <button
                  onClick={() => openAddForm('week')}
                  className="mt-1.5 text-xs text-purple-400 hover:underline"
                >
                  + 週次タスクを追加
                </button>
              </div>
            ) : (
              weeklyTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group relative flex items-center justify-between overflow-hidden rounded-xl border p-2.5 transition ${
                    task.completed
                      ? 'border-slate-800/40 bg-slate-900/20 opacity-60'
                      : 'border-slate-800/90 bg-slate-900/60 hover:border-purple-500/50 hover:bg-slate-900/90 hover:shadow-md'
                  }`}
                >
                  {/* Left Accent Bar */}
                  <div
                    className={`absolute inset-y-0 left-0 w-1 ${
                      task.completed
                        ? 'bg-slate-700'
                        : task.priority === 'high'
                          ? 'bg-rose-500'
                          : task.priority === 'medium'
                            ? 'bg-purple-400'
                            : 'bg-slate-600'
                    }`}
                  />

                  <div className="flex items-center gap-2.5 pl-1.5">
                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleComplete(task.id)}
                      title={task.completed ? '未完了に戻す' : '完了にする'}
                      className="text-slate-500 transition hover:text-purple-400"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-600 hover:text-slate-400" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="rounded-md border border-slate-800 bg-slate-950 p-1.5">
                        {getCategoryIcon(task.category)}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5
                            className={`text-xs font-semibold ${
                              task.completed ? 'text-slate-500 line-through' : 'text-white'
                            }`}
                          >
                            {task.title}
                          </h5>
                          {task.priority === 'high' && (
                            <span className="flex items-center gap-0.5 rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-bold text-rose-300">
                              <Flame className="h-2.5 w-2.5 text-rose-400" />
                              高優先
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5 text-slate-500" />
                            {formatDuration(task.durationMinutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(task.id)}
                    title="タスクを削除"
                    className="rounded-md p-1 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
