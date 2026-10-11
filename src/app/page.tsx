'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Settings } from 'lucide-react';
import { Header } from '@/components/Header';
import { Timeline24h } from '@/components/Timeline24h';
import { TaskManager } from '@/components/TaskManager';
import { AuthModal } from '@/components/AuthModal';
import { FileImportModal } from '@/components/FileImportModal';
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
  const [isImportOpen, setIsImportOpen] = useState(false);
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

  const handleImport = (
    newFixedSlots: FixedSlot[],
    newTasks: TaskItem[],
    mode: 'add' | 'replace',
  ) => {
    let updatedFixed: FixedSlot[];
    let updatedTasks: TaskItem[];

    if (mode === 'replace') {
      updatedFixed = newFixedSlots;
      updatedTasks = newTasks;
    } else {
      updatedFixed = [...fixedSlots, ...newFixedSlots];
      updatedTasks = [...tasks, ...newTasks];
    }

    setFixedSlots(updatedFixed);
    setTasks(updatedTasks);
    saveData(updatedFixed, updatedTasks);
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
        allBlocks: [],
        dayBlocks: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
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
      <div className="flex h-screen h-[100dvh] items-center justify-center bg-[#f8fafc] text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">理論値計画表を初期化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen h-[100dvh] flex-col overflow-hidden bg-[#f8fafc] text-slate-800">
      <Header
        userEmail={userEmail}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
        onOpenImport={() => setIsImportOpen(true)}
        lastSavedAt={lastSavedAt}
      />

      <main className="mx-auto flex w-full flex-1 min-h-0 flex-col gap-2.5 px-3 py-2 sm:px-6 sm:py-2.5 max-w-7xl 2xl:max-w-[1700px]">
        {/* Navigation Tabs */}
        <div className="flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition sm:text-sm ${
              activeTab === 'timeline'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>週間スケジュール (7日間)</span>
            {schedulingResult.unassignedTasks.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  activeTab === 'timeline'
                    ? 'bg-amber-400 text-amber-950'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                未配置 {schedulingResult.unassignedTasks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition sm:text-sm ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>目標・固定枠の設定</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'settings'
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              タスク {tasks.length} / 固定 {fixedSlots.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Weekly 7-Day Timeline Display */}
        {activeTab === 'timeline' && (
          <div className="flex flex-1 min-h-0 flex-col">
            <Timeline24h
              blocks={schedulingResult.blocks}
              dayBlocks={schedulingResult.dayBlocks}
              unassignedTasks={schedulingResult.unassignedTasks}
            />
          </div>
        )}

        {/* Tab 2: 3-Column Settings & Task Management (日ごと / 週ごと / 固定枠) */}
        {activeTab === 'settings' && (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <TaskManager
              tasks={tasks}
              onChange={handleTasksChange}
              slots={fixedSlots}
              onSlotsChange={handleFixedSlotsChange}
            />
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

      <FileImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}
