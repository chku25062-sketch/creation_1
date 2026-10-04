'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Settings } from 'lucide-react';
import { Header } from '@/components/Header';
import { Timeline24h } from '@/components/Timeline24h';
import { FixedSlotsManager } from '@/components/FixedSlotsManager';
import { TaskManager } from '@/components/TaskManager';
import { AuthModal } from '@/components/AuthModal';
import { FixedSlot, TaskItem } from '@/types';
import { generateTheoreticalSchedule } from '@/lib/scheduler';
import { loadLocalData, saveLocalData, syncWithSupabase } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [fixedSlots, setFixedSlots] = useState<FixedSlot[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'settings'>('timeline');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初期化ロード
  useEffect(() => {
    const { fixedSlots: initialFixed, tasks: initialTasks } = loadLocalData();
    setFixedSlots(initialFixed);
    setTasks(initialTasks);
    setIsInitialized(true);

    // Supabase ユーザーセッション確認
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          setUserEmail(data.session.user.email || null);
          setUserId(data.session.user.id);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUserEmail(session.user.email || null);
          setUserId(session.user.id);
        } else {
          setUserEmail(null);
          setUserId(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  // 変更時の自動保存
  const saveData = useCallback(
    (newFixed: FixedSlot[], newTasks: TaskItem[]) => {
      saveLocalData(newFixed, newTasks);
      setLastSavedAt(new Date());

      if (userId) {
        syncWithSupabase(userId, newFixed, newTasks).catch((e) =>
          console.error('Supabase sync error', e),
        );
      }
    },
    [userId],
  );

  const handleFixedSlotsChange = (newSlots: FixedSlot[]) => {
    setFixedSlots(newSlots);
    saveData(newSlots, tasks);
  };

  const handleTasksChange = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
    saveData(fixedSlots, newTasks);
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUserEmail(null);
      setUserId(null);
    }
  };

  // 理論値スケジュールの自動算出
  const schedulingResult = useMemo(() => {
    if (!isInitialized) {
      return {
        blocks: [],
        unassignedTasks: [],
        metrics: {
          totalDayMinutes: 1440,
          sleepMinutes: 480,
          fixedMinutes: 540,
          freeMinutes: 420,
          scheduledTaskMinutes: 0,
          unassignedTaskMinutes: 0,
          theoreticalScore: 0,
          assignedTaskCount: 0,
          totalTaskCount: 0,
        },
        categorySummaries: [],
      };
    }
    return generateTheoreticalSchedule(fixedSlots, tasks);
  }, [fixedSlots, tasks, isInitialized]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090d16] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="text-xs text-slate-400">理論値計画表を初期化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] pb-16 text-slate-100">
      <Header
        userEmail={userEmail}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
        lastSavedAt={lastSavedAt}
      />

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pt-6 sm:px-6">
        {/* Navigation Tabs */}
        <div className="flex rounded-xl border border-slate-800 bg-slate-900/80 p-1.5 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'timeline'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>24時間スケジュール</span>
            {schedulingResult.unassignedTasks.length > 0 && (
              <span className="rounded-full bg-amber-500/30 px-1.5 py-0.2 text-[10px] text-amber-300">
                未配置 {schedulingResult.unassignedTasks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition sm:text-sm ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>目標・固定枠の設定</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
              タスク {tasks.length}
            </span>
          </button>
        </div>

        {/* Tab 1: 24h Timeline Display */}
        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-6">
            <Timeline24h
              blocks={schedulingResult.blocks}
              unassignedTasks={schedulingResult.unassignedTasks}
            />
          </div>
        )}

        {/* Tab 2: Settings & Task Management */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6">
            <TaskManager tasks={tasks} onChange={handleTasksChange} />
            <FixedSlotsManager slots={fixedSlots} onChange={handleFixedSlotsChange} />
          </div>
        )}
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(email) => {
          setUserEmail(email);
        }}
      />
    </div>
  );
}
