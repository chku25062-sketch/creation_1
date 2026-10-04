'use client';

import React, { useState } from 'react';
import { Shield, Plus, Trash2, Clock, Moon, Briefcase, Utensils, Coffee, Zap } from 'lucide-react';
import { FixedSlot, FixedCategory } from '@/types';
import { minutesToTimeString, timeStringToMinutes, formatDuration } from '@/lib/timeUtils';

interface FixedSlotsManagerProps {
  slots: FixedSlot[];
  onChange: (newSlots: FixedSlot[]) => void;
}

const PRESET_FIXED_SLOTS: Omit<FixedSlot, 'id'>[] = [
  {
    title: '睡眠 (8時間)',
    category: 'sleep',
    startMinutes: 23 * 60,
    endMinutes: 7 * 60,
    color: '#6366f1',
  },
  {
    title: '本業・コア勤務',
    category: 'work',
    startMinutes: 9 * 60,
    endMinutes: 18 * 60,
    color: '#3b82f6',
  },
  {
    title: '昼食 & リフレッシュ',
    category: 'meal',
    startMinutes: 12 * 60,
    endMinutes: 13 * 60,
    color: '#f59e0b',
  },
  {
    title: '夕食 & 入浴ルーティン',
    category: 'meal',
    startMinutes: 19 * 60,
    endMinutes: 20 * 60 + 30,
    color: '#f59e0b',
  },
];

export function FixedSlotsManager({ slots, onChange }: FixedSlotsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FixedCategory>('routine');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startMinutes = timeStringToMinutes(startTime);
    const endMinutes = timeStringToMinutes(endTime);

    const categoryColors: Record<FixedCategory, string> = {
      sleep: '#6366f1',
      work: '#3b82f6',
      routine: '#64748b',
      meal: '#f59e0b',
      other: '#94a3b8',
    };

    const newSlot: FixedSlot = {
      id: `fixed-${Date.now()}`,
      title: title.trim(),
      category,
      startMinutes,
      endMinutes,
      color: categoryColors[category],
    };

    onChange([...slots, newSlot]);
    setTitle('');
    setIsAdding(false);
  };

  const handleAddPreset = (preset: Omit<FixedSlot, 'id'>) => {
    const newSlot: FixedSlot = {
      ...preset,
      id: `fixed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    onChange([...slots, newSlot]);
  };

  const handleDelete = (id: string) => {
    onChange(slots.filter((s) => s.id !== id));
  };

  const getCategoryIcon = (cat: FixedCategory) => {
    switch (cat) {
      case 'sleep':
        return <Moon className="h-4 w-4 text-indigo-400" />;
      case 'work':
        return <Briefcase className="h-4 w-4 text-blue-400" />;
      case 'meal':
        return <Utensils className="h-4 w-4 text-amber-400" />;
      default:
        return <Coffee className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-400" />
          <h3 className="text-base font-bold text-white">生活固定枠 (ベースルーティン)</h3>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isAdding ? '閉じる' : '固定枠を追加'}</span>
        </button>
      </div>

      <p className="text-xs text-slate-400">
        睡眠や勤務など、動かせない時間枠を定義します。残りの空き時間にタスクが自動割り振りされます。
      </p>

      {/* Quick Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <Zap className="h-3 w-3 text-blue-400" />
          プリセット:
        </span>
        {PRESET_FIXED_SLOTS.map((preset) => (
          <button
            key={preset.title}
            onClick={() => handleAddPreset(preset)}
            className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
          >
            + {preset.title}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-950/70 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400">名称 (例: 睡眠、本業勤務)</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="枠のタイトル"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">カテゴリ</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FixedCategory)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="sleep">睡眠 (休養)</option>
                <option value="work">仕事・学業</option>
                <option value="routine">日課・身支度</option>
                <option value="meal">食事・休憩</option>
                <option value="other">その他固定</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">開始時刻</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">終了時刻</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
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
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-500"
            >
              登録して再計算
            </button>
          </div>
        </form>
      )}

      {/* Slots List */}
      <div className="flex flex-col gap-2">
        {slots.map((slot) => {
          const duration =
            slot.endMinutes >= slot.startMinutes
              ? slot.endMinutes - slot.startMinutes
              : 1440 - slot.startMinutes + slot.endMinutes;

          return (
            <div
              key={slot.id}
              className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 transition hover:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
                  {getCategoryIcon(slot.category)}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">{slot.title}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>
                      {minutesToTimeString(slot.startMinutes)} -{' '}
                      {minutesToTimeString(slot.endMinutes)}
                    </span>
                    <span>({formatDuration(duration)})</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(slot.id)}
                title="固定枠を削除"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
