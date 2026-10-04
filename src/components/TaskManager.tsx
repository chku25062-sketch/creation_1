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
    period: 'day',
  },
];

export function TaskManager({ tasks, onChange }: TaskManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [period, setPeriod] = useState<TaskPeriod>('day');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || durationMinutes <= 0) return;

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      durationMinutes,
      priority,
      category,
      period,
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
        return <BookOpen className="h-4 w-4 text-cyan-400" />;
      case 'workout':
        return <Dumbbell className="h-4 w-4 text-emerald-400" />;
      case 'creative':
        return <Palette className="h-4 w-4 text-purple-400" />;
      default:
        return <Briefcase className="h-4 w-4 text-pink-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-cyan-400" />
          <h3 className="text-base font-bold text-white">目標・やりたいことタスク</h3>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 transition hover:border-cyan-500/80 hover:bg-cyan-500/20"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isAdding ? '閉じる' : 'タスクを追加'}</span>
        </button>
      </div>

      <p className="text-xs text-slate-400">
        日・週ごとの目標ややりたいことを登録すると、固定枠の空き時間に優先度順に自動割り振りされます。
      </p>

      {/* Quick Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <Zap className="h-3 w-3 text-amber-400" />
          クイック追加:
        </span>
        {PRESET_TASKS.map((preset) => (
          <button
            key={preset.title}
            onClick={() => handleAddPreset(preset)}
            className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
          >
            + {preset.title} ({preset.durationMinutes}分)
          </button>
        ))}
      </div>

      {/* Add Task Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-950/70 p-4"
        >
          <div>
            <label className="text-xs text-slate-400">タスク名 (例: 資格試験の勉強、ジム)</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="目標・やりたいこと"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
                <option value="high">高 (最優先で割り当て)</option>
                <option value="medium">中 (標準)</option>
                <option value="low">低 (空き時間があれば)</option>
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
            <div>
              <label className="text-xs text-slate-400">頻度</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as TaskPeriod)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="day">毎日</option>
                <option value="week">週単位</option>
                <option value="month">月単位</option>
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
              理論値に配置
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center justify-between rounded-xl border p-3 transition ${
              task.completed
                ? 'border-slate-800/40 bg-slate-950/20 opacity-60'
                : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Completed Toggle Button */}
              <button
                onClick={() => handleToggleComplete(task.id)}
                title={task.completed ? '未完了に戻す' : '完了にする'}
                className="text-slate-500 transition hover:text-cyan-400"
              >
                {task.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-600 hover:text-slate-400" />
                )}
              </button>

              <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
                {getCategoryIcon(task.category)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4
                    className={`text-xs font-semibold ${
                      task.completed ? 'text-slate-500 line-through' : 'text-white'
                    }`}
                  >
                    {task.title}
                  </h4>
                  {task.priority === 'high' && (
                    <span className="flex items-center gap-0.5 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                      <Flame className="h-3 w-3 text-rose-400" />
                      高優先
                    </span>
                  )}
                  {task.priority === 'low' && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      低優先
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>所要時間: {formatDuration(task.durationMinutes)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDelete(task.id)}
              title="タスクを削除"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
