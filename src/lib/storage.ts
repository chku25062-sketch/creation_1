import { FixedSlot, TaskItem } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';

export const INITIAL_FIXED_SLOTS: FixedSlot[] = [
  {
    id: 'fixed-sleep',
    title: '睡眠 (良質な8時間休養)',
    category: 'sleep',
    startMinutes: 23 * 60, // 23:00
    endMinutes: 7 * 60, // 07:00
    color: '#6366f1',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: 'fixed-morning',
    title: '朝のルーティン & 準備',
    category: 'routine',
    startMinutes: 7 * 60, // 07:00
    endMinutes: 8 * 60, // 08:00
    color: '#64748b',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: 'fixed-lecture-mw',
    title: '大学講義 (2限・3限)',
    category: 'lecture',
    startMinutes: 10 * 60 + 40, // 10:40
    endMinutes: 14 * 60 + 40, // 14:40
    color: '#0284c7',
    daysOfWeek: [0, 2], // 月・水
  },
  {
    id: 'fixed-lecture-tuth',
    title: '大学講義 (3限・4限)',
    category: 'lecture',
    startMinutes: 13 * 60, // 13:00
    endMinutes: 16 * 60 + 30, // 16:30
    color: '#0284c7',
    daysOfWeek: [1, 3], // 火・木
  },
  {
    id: 'fixed-dinner',
    title: '夕食 & リフレッシュ',
    category: 'meal',
    startMinutes: 19 * 60, // 19:00
    endMinutes: 20 * 60 + 30, // 20:30
    color: '#f59e0b',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-assignment-1',
    title: '大学講義 (2限・3限) レポート課題',
    taskType: 'assignment',
    startDay: 0, // 月曜出題 (授業日)
    deadlineDay: 6, // 日曜締切 (授業日前日)
    durationMinutes: 90,
    durationSize: 'medium',
    frequency: 'low',
    priority: 'high',
    category: 'must',
    period: 'week',
  },
  {
    id: 'task-study-daily',
    title: '基本情報・資格試験対策',
    taskType: 'task',
    durationMinutes: 60,
    durationSize: 'medium',
    frequency: 'high',
    priority: 'high',
    category: 'must',
    period: 'day',
  },
  {
    id: 'task-workout-daily',
    title: 'ランニング & ストレッチ',
    taskType: 'task',
    durationMinutes: 25,
    durationSize: 'small',
    frequency: 'high',
    priority: 'medium',
    category: 'want',
    period: 'day',
  },
  {
    id: 'task-creative-week',
    title: '個人プロダクト開発・実装',
    taskType: 'task',
    durationMinutes: 90,
    durationSize: 'medium',
    frequency: 'medium',
    priority: 'high',
    category: 'want',
    period: 'week',
  },
  {
    id: 'task-todo-syllabus',
    title: '履修登録・教科書購入',
    taskType: 'todo',
    hasNoDuration: true,
    durationMinutes: 0,
    durationSize: 'small',
    frequency: 'low',
    priority: 'medium',
    category: 'must',
    period: 'week',
  },
];

const LOCAL_STORAGE_KEY_FIXED = 'theoretical_planner_fixed_slots_v1';
const LOCAL_STORAGE_KEY_TASKS = 'theoretical_planner_tasks_v1';

export function loadLocalData(): { fixedSlots: FixedSlot[]; tasks: TaskItem[] } {
  if (typeof window === 'undefined') {
    return { fixedSlots: INITIAL_FIXED_SLOTS, tasks: INITIAL_TASKS };
  }

  try {
    const rawFixed = localStorage.getItem(LOCAL_STORAGE_KEY_FIXED);
    const rawTasks = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);

    const fixedSlots: FixedSlot[] = rawFixed ? JSON.parse(rawFixed) : INITIAL_FIXED_SLOTS;
    const tasks: TaskItem[] = rawTasks ? JSON.parse(rawTasks) : INITIAL_TASKS;

    return { fixedSlots, tasks };
  } catch (err) {
    console.error('Failed to load data from localStorage', err);
    return { fixedSlots: INITIAL_FIXED_SLOTS, tasks: INITIAL_TASKS };
  }
}

export function saveLocalData(fixedSlots: FixedSlot[], tasks: TaskItem[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_FIXED, JSON.stringify(fixedSlots));
    localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save data to localStorage', err);
  }
}

/**
 * Supabaseへのクラウド保存（ログイン済みの場合）
 */
export async function syncWithSupabase(
  userId: string,
  fixedSlots: FixedSlot[],
  tasks: TaskItem[],
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const { error } = await supabase.from('user_schedules').upsert(
      {
        user_id: userId,
        fixed_slots: fixedSlots,
        tasks: tasks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
    return { success: false, error: errorMessage };
  }
}
