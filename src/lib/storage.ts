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
  },
  {
    id: 'fixed-morning',
    title: '朝のルーティン & 準備',
    category: 'routine',
    startMinutes: 7 * 60, // 07:00
    endMinutes: 8 * 60, // 08:00
    color: '#64748b',
  },
  {
    id: 'fixed-work',
    title: '本業・コアタイム',
    category: 'work',
    startMinutes: 9 * 60, // 09:00
    endMinutes: 18 * 60, // 18:00
    color: '#3b82f6',
  },
  {
    id: 'fixed-dinner',
    title: '夕食 & リフレッシュ',
    category: 'meal',
    startMinutes: 19 * 60, // 19:00
    endMinutes: 20 * 60 + 30, // 20:30
    color: '#f59e0b',
  },
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-study',
    title: 'スキルアップ・プログラミング学習',
    durationMinutes: 60,
    priority: 'high',
    category: 'study',
    period: 'day',
  },
  {
    id: 'task-workout',
    title: 'ランニング & ストレッチ',
    durationMinutes: 45,
    priority: 'high',
    category: 'workout',
    period: 'day',
  },
  {
    id: 'task-creative',
    title: '個人開発・アイデア創出',
    durationMinutes: 60,
    priority: 'medium',
    category: 'creative',
    period: 'day',
  },
  {
    id: 'task-reading',
    title: 'ビジネス書・教養読書',
    durationMinutes: 45,
    priority: 'medium',
    category: 'hobby',
    period: 'day',
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
