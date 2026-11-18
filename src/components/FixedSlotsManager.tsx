'use client';

import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Clock,
  Moon,
  Briefcase,
  Utensils,
  Coffee,
  Zap,
  GraduationCap,
} from 'lucide-react';
import { FixedSlot, FixedCategory } from '@/types';
import { minutesToTimeString, timeStringToMinutes, formatDuration } from '@/lib/timeUtils';

interface FixedSlotsManagerProps {
  slots: FixedSlot[];
  onChange: (newSlots: FixedSlot[]) => void;
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const PRESET_FIXED_SLOTS: Omit<FixedSlot, 'id'>[] = [
  {
    title: '睡眠 (良質な8時間)',
    category: 'sleep',
    startMinutes: 23 * 60,
    endMinutes: 7 * 60,
    color: '#6366f1',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // 毎日
  },
  {
    title: '大学講義・授業 (前期)',
    category: 'lecture',
    startMinutes: 10 * 60 + 40, // 10:40
    endMinutes: 12 * 60 + 10, // 12:10
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
    title: '昼食 & リフレッシュ',
    category: 'meal',
    startMinutes: 12 * 60 + 10,
    endMinutes: 13 * 60,
    color: '#f59e0b',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    title: 'アルバイト・シフト',
    category: 'work',
    startMinutes: 13 * 60,
    endMinutes: 18 * 60,
    color: '#3b82f6',
    daysOfWeek: [5, 6], // 土日
  },
];

export function FixedSlotsManager({ slots, onChange }: FixedSlotsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FixedCategory>('routine');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // デフォルト毎日

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
      }
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const setDaysPreset = (preset: 'all' | 'weekdays' | 'weekend') => {
    if (preset === 'all') setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    else if (preset === 'weekdays') setSelectedDays([0, 1, 2, 3, 4]);
    else if (preset === 'weekend') setSelectedDays([5, 6]);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startMinutes = timeStringToMinutes(startTime);
    const endMinutes = timeStringToMinutes(endTime);

    const categoryColors: Record<FixedCategory, string> = {
      sleep: '#6366f1',
      work: '#3b82f6',
      lecture: '#0284c7',
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
      daysOfWeek: [...selectedDays],
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

  const getCategoryIcon = (cat: FixedCategory | string) => {
    switch (cat) {
      case 'sleep':
        return <Moon className="h-4 w-4 text-indigo-400" />;
      case 'lecture':
        return <GraduationCap className="h-4 w-4 text-sky-400" />;
      case 'work':
        return <Briefcase className="h-4 w-4 text-blue-400" />;
      case 'meal':
        return <Utensils className="h-4 w-4 text-amber-400" />;
      default:
        return <Coffee className="h-4 w-4 text-slate-400" />;
    }
  };

  const formatDaysString = (days?: number[]) => {
    if (!days || days.length === 0 || days.length === 7) return '毎日';
    if (days.length === 5 && [0, 1, 2, 3, 4].every((d) => days.includes(d))) return '平日';
    if (days.length === 2 && [5, 6].every((d) => days.includes(d))) return '土日';
    return days.map((d) => WEEKDAY_LABELS[d]).join('・');
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">
            生活固定枠・時間割 (曜日別ベースルーティン)
          </h3>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isAdding ? '閉じる' : '固定枠・講義を追加'}</span>
        </button>
      </div>

      <p className="text-xs text-slate-600">
        睡眠、勤務、大学の講義（月曜2限など）、曜日別シフトなどの動かせない枠を定義します。残りの空き時間にタスクが自動割り振りされます。
      </p>

      {/* Quick Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
          <Zap className="h-3 w-3 text-amber-500" />
          プリセット:
        </span>
        {PRESET_FIXED_SLOTS.map((preset) => (
          <button
            key={preset.title}
            onClick={() => handleAddPreset(preset)}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            + {preset.title} ({formatDaysString(preset.daysOfWeek)})
          </button>
        ))}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                名称 (例: 睡眠、講義: アルゴリズム論、バイト)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="枠のタイトル"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">カテゴリ</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FixedCategory)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
              >
                <option value="sleep">睡眠</option>
                <option value="lecture">大学講義・授業</option>
                <option value="work">仕事・学業・バイト</option>
                <option value="routine">日課・身支度</option>
                <option value="meal">食事・休憩</option>
                <option value="other">その他固定</option>
              </select>
            </div>
          </div>

          {/* Day of Week Selection */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">適用する曜日</label>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setDaysPreset('all')}
                  className="rounded bg-slate-200 px-1.5 py-0.2 text-slate-700 hover:bg-slate-300 font-medium"
                >
                  毎日
                </button>
                <button
                  type="button"
                  onClick={() => setDaysPreset('weekdays')}
                  className="rounded bg-slate-200 px-1.5 py-0.2 text-slate-700 hover:bg-slate-300 font-medium"
                >
                  平日のみ
                </button>
                <button
                  type="button"
                  onClick={() => setDaysPreset('weekend')}
                  className="rounded bg-slate-200 px-1.5 py-0.2 text-slate-700 hover:bg-slate-300 font-medium"
                >
                  土日のみ
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, idx) => {
                const isSelected = selectedDays.includes(idx);
                return (
                  <button
                    type="button"
                    key={`day-btn-${idx}`}
                    onClick={() => toggleDay(idx)}
                    className={`flex h-8 flex-1 min-w-[36px] items-center justify-center rounded-lg border text-xs font-bold transition ${
                      isSelected
                        ? 'border-blue-300 bg-blue-100 text-blue-800 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">開始時刻</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">終了時刻</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
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
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  {getCategoryIcon(slot.category)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-slate-900">{slot.title}</h4>
                    <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-medium text-blue-700">
                      {formatDaysString(slot.daysOfWeek)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
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
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
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
