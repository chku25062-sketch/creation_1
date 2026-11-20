'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Check,
  Plus,
  Trash2,
  FolderPlus,
} from 'lucide-react';
import { ImportedTableData } from '@/types';
import {
  createDailyRoutineTable,
  createWeeklyTaskTable,
  createFixedSlotTable,
  TemplateTaskItemInput,
  FixedSlotItemInput,
} from '@/lib/templates/tableTemplates';
import { NumberStepper } from './NumberStepper';
import { timeStringToMinutes } from '@/lib/timeUtils';

interface NewTableWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTable: (table: ImportedTableData) => void;
}

// 登録タスクモデル
export interface AddedTaskDraft {
  id: string;
  title: string;
  type: 'fixed' | 'daily' | 'weekly';
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  targetDays?: number[];
  weeklyCount?: number;
  timeSlot?: 'all' | 'morning' | 'afternoon' | 'evening';
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

// サジェスト候補チップデータ
interface SuggestionPreset {
  label: string;
  type: 'fixed' | 'daily' | 'weekly';
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  timeSlot?: 'all' | 'morning' | 'afternoon' | 'evening';
  weeklyCount?: number;
  targetDays?: number[];
}

// テーマ（表のカテゴリ）の定義
interface ThemeOption {
  id: string;
  label: string;
  defaultTableName: string;
  description: string;
  suggestions: SuggestionPreset[];
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'morning_routine',
    label: '🌅 朝のルーティン',
    defaultTableName: '朝のルーティン',
    description: '読書、ストレッチ、朝食など朝の習慣',
    suggestions: [
      { label: '朝食', type: 'daily', durationMinutes: 20, timeSlot: 'morning' },
      { label: '読書', type: 'daily', durationMinutes: 20, timeSlot: 'morning' },
      { label: 'ストレッチ', type: 'daily', durationMinutes: 15, timeSlot: 'morning' },
      { label: '散歩', type: 'daily', durationMinutes: 30, timeSlot: 'morning' },
      { label: '英語・語学', type: 'daily', durationMinutes: 30, timeSlot: 'morning' },
      { label: '瞑想', type: 'daily', durationMinutes: 10, timeSlot: 'morning' },
    ],
  },
  {
    id: 'evening_routine',
    label: '🌙 夜の生活習慣',
    defaultTableName: '夜の生活習慣',
    description: '夕食、入浴、明日の準備、就寝前ケア',
    suggestions: [
      { label: '夕食', type: 'daily', durationMinutes: 45, timeSlot: 'evening' },
      { label: '入浴', type: 'daily', durationMinutes: 30, timeSlot: 'evening' },
      { label: 'ストレッチ', type: 'daily', durationMinutes: 15, timeSlot: 'evening' },
      { label: '明日の準備・手帳', type: 'daily', durationMinutes: 15, timeSlot: 'evening' },
      {
        label: '睡眠',
        type: 'fixed',
        durationMinutes: 480,
        startTime: '23:00',
        endTime: '07:00',
        targetDays: [0, 1, 2, 3, 4, 5, 6],
      },
    ],
  },
  {
    id: 'fitness',
    label: '💪 フィットネス・健康',
    defaultTableName: 'フィットネス・運動習慣',
    description: 'ジム、筋トレ、ランニング、健康管理',
    suggestions: [
      { label: 'ジム・筋トレ', type: 'weekly', durationMinutes: 60, weeklyCount: 2 },
      { label: 'ジョギング・ランニング', type: 'weekly', durationMinutes: 45, weeklyCount: 2 },
      { label: '全身ストレッチ', type: 'daily', durationMinutes: 20, timeSlot: 'all' },
      { label: '散歩・ウォーキング', type: 'daily', durationMinutes: 30, timeSlot: 'morning' },
    ],
  },
  {
    id: 'study_work',
    label: '📚 学業・お仕事',
    defaultTableName: '講義・勤務予定',
    description: '大学講義、アルバイト、会社勤務、自習',
    suggestions: [
      {
        label: '大学の講義',
        type: 'fixed',
        durationMinutes: 90,
        startTime: '09:00',
        endTime: '10:30',
        targetDays: [0, 1, 2, 3, 4],
      },
      {
        label: 'アルバイト',
        type: 'fixed',
        durationMinutes: 240,
        startTime: '17:00',
        endTime: '21:00',
        targetDays: [1, 3, 5],
      },
      {
        label: '会社勤務',
        type: 'fixed',
        durationMinutes: 480,
        startTime: '09:00',
        endTime: '18:00',
        targetDays: [0, 1, 2, 3, 4],
      },
      { label: '集中作業・自習', type: 'weekly', durationMinutes: 60, weeklyCount: 3 },
    ],
  },
  {
    id: 'weekly_goal',
    label: '🎯 今週の目標・ノルマ',
    defaultTableName: '今週の目標・課題',
    description: 'レポート、掃除、買い出し、資格勉強',
    suggestions: [
      { label: 'レポート課題', type: 'weekly', durationMinutes: 90, weeklyCount: 1 },
      { label: '部屋の掃除', type: 'weekly', durationMinutes: 45, weeklyCount: 1 },
      { label: '買い出し・買い物', type: 'weekly', durationMinutes: 45, weeklyCount: 1 },
      { label: '資格・スキル学習', type: 'weekly', durationMinutes: 60, weeklyCount: 3 },
    ],
  },
  {
    id: 'life_rhythm',
    label: '🏠 基本生活リズム',
    defaultTableName: '基本生活リズム',
    description: '睡眠、食事、休憩などの基本フレーム',
    suggestions: [
      {
        label: '睡眠',
        type: 'fixed',
        durationMinutes: 480,
        startTime: '23:00',
        endTime: '07:00',
        targetDays: [0, 1, 2, 3, 4, 5, 6],
      },
      { label: '朝食', type: 'daily', durationMinutes: 20, timeSlot: 'morning' },
      { label: '昼食', type: 'daily', durationMinutes: 40, timeSlot: 'afternoon' },
      { label: '夕食', type: 'daily', durationMinutes: 45, timeSlot: 'evening' },
      { label: '入浴', type: 'daily', durationMinutes: 30, timeSlot: 'evening' },
    ],
  },
  {
    id: 'custom',
    label: '✏️ 自由に入力',
    defaultTableName: '',
    description: '表の名前を自分で決めて、予定を自由に入力',
    suggestions: [
      { label: '読書', type: 'daily', durationMinutes: 20, timeSlot: 'morning' },
      { label: 'ストレッチ', type: 'daily', durationMinutes: 15, timeSlot: 'morning' },
      { label: 'ジム・筋トレ', type: 'weekly', durationMinutes: 60, weeklyCount: 2 },
      { label: 'レポート課題', type: 'weekly', durationMinutes: 90, weeklyCount: 1 },
    ],
  },
];

export function NewTableWizardModal({
  isOpen,
  onClose,
  onApplyTable,
}: NewTableWizardModalProps) {
  if (!isOpen) return null;

  // 選択されたテーマ（デフォルト: 朝のルーティン）
  const [selectedThemeId, setSelectedThemeId] = useState<string>('morning_routine');

  // 表名
  const [tableName, setTableName] = useState<string>('朝のルーティン');

  // 登録済みタスクリスト
  const [draftTasks, setDraftTasks] = useState<AddedTaskDraft[]>([]);

  // 現在入力中のタスクパラメータ
  const [title, setTitle] = useState('');
  const [isTimeFixed, setIsTimeFixed] = useState<'fixed' | 'flex'>('flex');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');

  // 固定枠パラメータ
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [fixedDays, setFixedDays] = useState<number[]>([0, 1, 2, 3, 4]);

  // 空き時間パラメータ
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [timeSlot, setTimeSlot] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('morning');
  const [weeklyCount, setWeeklyCount] = useState(2);

  // 現在選択中のテーマオブジェクト
  const currentTheme = useMemo(() => {
    return THEME_OPTIONS.find(t => t.id === selectedThemeId) || THEME_OPTIONS[0];
  }, [selectedThemeId]);

  // テーマ切り替えハンドラ
  const handleSelectTheme = (theme: ThemeOption) => {
    setSelectedThemeId(theme.id);
    if (theme.id !== 'custom') {
      setTableName(theme.defaultTableName);
    } else {
      setTableName('');
    }
  };

  // サジェスト適用
  const handleApplySuggestion = (s: SuggestionPreset) => {
    setTitle(s.label);
    if (s.type === 'fixed') {
      setIsTimeFixed('fixed');
      if (s.startTime) setStartTime(s.startTime);
      if (s.endTime) setEndTime(s.endTime);
      if (s.targetDays) setFixedDays(s.targetDays);
    } else {
      setIsTimeFixed('flex');
      if (s.type === 'daily') {
        setFrequency('daily');
        if (s.timeSlot) setTimeSlot(s.timeSlot);
      } else {
        setFrequency('weekly');
        if (s.weeklyCount) setWeeklyCount(s.weeklyCount);
      }
      setDurationMinutes(s.durationMinutes);
    }
  };

  // タスクをリストに追加
  const handleAddTask = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const newTask: AddedTaskDraft = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      title: trimmed,
      type: isTimeFixed === 'fixed' ? 'fixed' : frequency,
      durationMinutes: isTimeFixed === 'fixed' ? 60 : durationMinutes,
      startTime: isTimeFixed === 'fixed' ? startTime : undefined,
      endTime: isTimeFixed === 'fixed' ? endTime : undefined,
      targetDays: isTimeFixed === 'fixed' ? fixedDays : undefined,
      weeklyCount: isTimeFixed === 'flex' && frequency === 'weekly' ? weeklyCount : undefined,
      timeSlot: isTimeFixed === 'flex' && frequency === 'daily' ? timeSlot : undefined,
    };

    setDraftTasks(prev => [...prev, newTask]);

    // 入力欄をクリアして次のタスク入力を促す
    setTitle('');
  };

  // タスク削除
  const handleDeleteDraftTask = (id: string) => {
    setDraftTasks(prev => prev.filter(t => t.id !== id));
  };

  // 日またぎ判定
  const isOvernight = useMemo(() => {
    if (isTimeFixed !== 'fixed' || !startTime || !endTime) return false;
    return timeStringToMinutes(endTime) < timeStringToMinutes(startTime);
  }, [isTimeFixed, startTime, endTime]);

  // 表の全自動構築＆作成
  const handleBuildTable = () => {
    if (draftTasks.length === 0) return;

    // タイプごとの集計
    const fixedTasks = draftTasks.filter(t => t.type === 'fixed');
    const weeklyTasks = draftTasks.filter(t => t.type === 'weekly');
    const dailyTasks = draftTasks.filter(t => t.type === 'daily');

    const finalTableName = tableName.trim() || currentTheme.defaultTableName || '新しいスケジュール表';

    let generatedTable: ImportedTableData;

    // 最も多いタイプを優先して構築
    if (fixedTasks.length >= weeklyTasks.length && fixedTasks.length >= dailyTasks.length) {
      // 固定枠表を生成
      const items: FixedSlotItemInput[] = fixedTasks.map(t => ({
        title: t.title,
        startTime: t.startTime || '09:00',
        endTime: t.endTime || '10:00',
        targetDays: t.targetDays || [0, 1, 2, 3, 4, 5, 6],
      }));

      generatedTable = createFixedSlotTable({
        name: finalTableName,
        multiSlots: { items },
        daysCount: 7,
        repeatStartDay: 0,
      });
    } else if (weeklyTasks.length >= dailyTasks.length) {
      // 週次タスク表を生成
      const items: TemplateTaskItemInput[] = weeklyTasks.map(t => ({
        title: t.title,
        durationMinutes: t.durationMinutes,
        weeklyCount: t.weeklyCount || 1,
      }));

      generatedTable = createWeeklyTaskTable({
        name: finalTableName,
        daysCount: 7,
        isRepeat: false,
        multiTasks: { items },
      });
    } else {
      // 日課表を生成
      const items: TemplateTaskItemInput[] = dailyTasks.map(t => ({
        title: t.title,
        durationMinutes: t.durationMinutes,
      }));

      // 活動時間帯の推定
      let slotStartTime: string | null = null;
      let slotEndTime: string | null = null;
      const morningCount = dailyTasks.filter(t => t.timeSlot === 'morning').length;
      const eveningCount = dailyTasks.filter(t => t.timeSlot === 'evening').length;
      if (selectedThemeId === 'morning_routine' || (morningCount > eveningCount && morningCount > 0)) {
        slotStartTime = '06:00';
        slotEndTime = '12:00';
      } else if (selectedThemeId === 'evening_routine' || eveningCount > 0) {
        slotStartTime = '18:00';
        slotEndTime = '23:00';
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

    onApplyTable(generatedTable);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-200/90 bg-gradient-to-r from-indigo-50/70 via-sky-50/40 to-slate-50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                ✨ 質問に答えて予定表を作成
              </h3>
              <p className="text-[11px] text-slate-500">
                表のテーマを選び、入れたい予定を答えるだけでスケジュール表が完成します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* スクロール本体 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-700">
          {/* ========================================================
              Step 1: どんなテーマの表を作りますか？（表の目的の先行選択）
              ======================================================== */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FolderPlus className="h-4 w-4 text-indigo-600" />
                  <span>Step 1: どんなテーマの表を作りますか？</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  1つの表の中に、関連する複数の予定（タスク）をまとめて管理できます
                </p>
              </div>
            </div>

            {/* テーマ選択チップ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {THEME_OPTIONS.map(theme => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-white shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-800">{theme.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      {theme.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 表名入力（選択に応じて自動反映 ＆ 自由編集可能） */}
            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600 shrink-0">表の表示名:</span>
              <input
                type="text"
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                placeholder="例: 朝のルーティン、夜の生活習慣、筋トレメニュー"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
          </div>

          {/* ========================================================
              Step 2: 「{表名}」に入れるタスクを追加しましょう
              ======================================================== */}
          <div className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/25 p-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-900">
                Step 2: 「{tableName || 'この表'}」に入れる予定・タスクを入力
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                  placeholder={`例: ${
                    currentTheme.suggestions[0]?.label || '読書'
                  }、${currentTheme.suggestions[1]?.label || 'ストレッチ'}`}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            {/* 選択中のテーマに応じたおすすめサジェストチップ */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-500">
                💡 「{tableName || currentTheme.label}」におすすめの予定（ワンタップで入力）:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentTheme.suggestions.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => handleApplySuggestion(s)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
                  >
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* パラメータ対話質問 */}
            <div className="space-y-3 pt-3 border-t border-indigo-100/70">
              {/* 質問 1: 時間が決まっているか */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-800">
                  この予定は時間が決まっていますか？
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTimeFixed('fixed')}
                    className={`flex flex-col items-start gap-0.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isTimeFixed === 'fixed'
                        ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs text-emerald-900">
                      📌 決まった時間にある
                    </span>
                    <span className="text-[10px] text-slate-500">講義、バイト、睡眠など</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTimeFixed('flex')}
                    className={`flex flex-col items-start gap-0.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isTimeFixed === 'flex'
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs text-indigo-900">
                      ⚡ 空いている時間に行う
                    </span>
                    <span className="text-[10px] text-slate-500">読書、筋トレ、スキマ時間など</span>
                  </button>
                </div>
              </div>

              {/* 固定枠の場合 */}
              {isTimeFixed === 'fixed' ? (
                <div className="space-y-2.5 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">時間帯</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                      />
                      <span className="text-slate-400">〜</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={e => setEndTime(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                      />
                      {isOvernight && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                          翌日朝まで
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700">対象曜日</label>
                      <div className="flex gap-2 text-[10px] text-indigo-600">
                        <button
                          type="button"
                          onClick={() => setFixedDays([0, 1, 2, 3, 4, 5, 6])}
                          className="hover:underline cursor-pointer"
                        >
                          全日
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => setFixedDays([0, 1, 2, 3, 4])}
                          className="hover:underline cursor-pointer"
                        >
                          平日
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => setFixedDays([5, 6])}
                          className="hover:underline cursor-pointer"
                        >
                          週末
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {WEEKDAYS.map(w => {
                        const isSelected = fixedDays.includes(w.dayIndex);
                        return (
                          <button
                            key={w.dayIndex}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (fixedDays.length > 1) {
                                  setFixedDays(fixedDays.filter(d => d !== w.dayIndex));
                                }
                              } else {
                                setFixedDays([...fixedDays, w.dayIndex].sort());
                              }
                            }}
                            className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* 空き時間の場合 */
                <div className="space-y-2.5 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">頻度</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFrequency('daily')}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          frequency === 'daily'
                            ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold shadow-2xs ring-1 ring-amber-600'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-xs">🏃 毎日・決まった曜日に継続</div>
                        <span className="text-[10px] text-slate-500 font-normal">日課ルーティン</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrequency('weekly')}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          frequency === 'weekly'
                            ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-2xs ring-1 ring-blue-600'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-xs">🎯 今週中に◯回やりたい</div>
                        <span className="text-[10px] text-slate-500 font-normal">週の目標・ノルマ</span>
                      </button>
                    </div>
                  </div>

                  {/* 所要時間 */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      1回あたりの時間
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[15, 20, 30, 45, 60].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setDurationMinutes(mins)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            durationMinutes === mins
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mins}分
                        </button>
                      ))}
                      <div className="ml-auto">
                        <NumberStepper
                          value={durationMinutes}
                          onChange={val => setDurationMinutes(val)}
                          min={5}
                          max={360}
                          step={5}
                          unit="分"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 時間帯 or 回数 */}
                  {frequency === 'daily' ? (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        行う時間帯
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTimeSlot('morning')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition cursor-pointer ${
                            timeSlot === 'morning'
                              ? 'border-amber-600 bg-amber-50 text-amber-800 font-bold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          朝 (06:00-12:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeSlot('afternoon')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition cursor-pointer ${
                            timeSlot === 'afternoon'
                              ? 'border-amber-600 bg-amber-50 text-amber-800 font-bold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          昼 (12:00-18:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeSlot('evening')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition cursor-pointer ${
                            timeSlot === 'evening'
                              ? 'border-amber-600 bg-amber-50 text-amber-800 font-bold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          夜 (18:00-23:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeSlot('all')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition cursor-pointer ${
                            timeSlot === 'all'
                              ? 'border-amber-600 bg-amber-50 text-amber-800 font-bold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          終日（空きコマ）
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        今週は何回やりたいですか？
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setWeeklyCount(cnt)}
                            className={`rounded-lg border px-3 py-1 text-xs font-medium transition cursor-pointer ${
                              weeklyCount === cnt
                                ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            週 {cnt} 回
                          </button>
                        ))}
                        <div className="ml-auto">
                          <NumberStepper
                            value={weeklyCount}
                            onChange={val => setWeeklyCount(val)}
                            min={1}
                            max={7}
                            step={1}
                            unit="回/週"
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* この予定をリストに追加するボタン */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddTask}
                disabled={!title.trim()}
                className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition shadow-xs cursor-pointer ${
                  title.trim()
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-98'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>＋ 「{tableName || 'この表'}」にこの予定を追加する</span>
              </button>
            </div>
          </div>

          {/* ========================================================
              Step 3: 「{表名}」に登録されたタスク一覧（箱の中身プレビュー）
              ======================================================== */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900">
                📋 「{tableName || 'この表'}」に登録されたタスク一覧（{draftTasks.length}件）
              </label>
              {draftTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraftTasks([])}
                  className="text-[11px] text-slate-400 hover:text-rose-600 transition cursor-pointer"
                >
                  すべてクリア
                </button>
              )}
            </div>

            {draftTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
                <p className="text-xs">まだ「{tableName || 'この表'}」にタスクがありません</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  上の入力欄またはおすすめ候補から予定を追加してください（複数追加できます）
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {draftTasks.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 border border-slate-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs text-slate-800 truncate">{t.title}</span>
                      {t.type === 'fixed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          📌 {t.startTime}〜{t.endTime}
                        </span>
                      )}
                      {t.type === 'daily' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          🏃 毎日 {t.durationMinutes}分 ({t.timeSlot === 'morning' ? '朝' : t.timeSlot === 'evening' ? '夜' : '終日'})
                        </span>
                      )}
                      {t.type === 'weekly' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          🎯 週{t.weeklyCount}回 ({t.durationMinutes}分)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDraftTask(t.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {draftTasks.length > 0 && (
              <p className="text-[11px] text-indigo-600 flex items-center gap-1 pt-1">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  続けて別の予定も追加できます。準備ができたら右下の「表を作成する」を押してください。
                </span>
              </p>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleBuildTable}
            disabled={draftTasks.length === 0}
            className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-md ${
              draftTasks.length > 0
                ? 'bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white cursor-pointer active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="h-4 w-4" />
            <span>「{tableName || 'この表'}」を作成する（{draftTasks.length}件）</span>
          </button>
        </div>
      </div>
    </div>
  );
}
