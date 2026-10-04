'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { TheoreticalSummary } from '@/components/TheoreticalSummary';
import { Timeline24h } from '@/components/Timeline24h';
import { DonutChart } from '@/components/DonutChart';
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

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-6 sm:px-6">
        {/* Top: Theoretical Summary Scoreboard */}
        <TheoreticalSummary metrics={schedulingResult.metrics} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Column: 24h Timeline (Width: 7 / 12) */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <Timeline24h
              blocks={schedulingResult.blocks}
              unassignedTasks={schedulingResult.unassignedTasks}
            />
          </div>

          {/* Right Column: Controls & Balance (Width: 5 / 12) */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <DonutChart summaries={schedulingResult.categorySummaries} />
            <TaskManager tasks={tasks} onChange={handleTasksChange} />
            <FixedSlotsManager slots={fixedSlots} onChange={handleFixedSlotsChange} />
          </div>
        </div>
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
