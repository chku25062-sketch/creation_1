'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Maximize2 } from 'lucide-react';
import { Header, SheetTab } from '@/components/Header';
import { Timeline24h } from '@/components/Timeline24h';
import { TaskManager } from '@/components/TaskManager';
import { ImportedTablesManager } from '@/components/ImportedTablesManager';
import { AuthModal } from '@/components/AuthModal';
import { FileImportModal } from '@/components/FileImportModal';
import { FixedSlot, TaskItem, ImportedTableData } from '@/types';
import { generateTheoreticalSchedule } from '@/lib/scheduler';
import {
  loadLocalData,
  saveLocalData,
  syncWithSupabase,
  loadImportedTables,
  saveImportedTables,
} from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [fixedSlots, setFixedSlots] = useState<FixedSlot[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [importedTables, setImportedTables] = useState<ImportedTableData[]>([]);
  const [activeTab, setActiveTab] = useState<SheetTab>('timeline');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  // 初期化ロード
  useEffect(() => {
    const { fixedSlots: initialFixed, tasks: initialTasks } = loadLocalData();
    const initialTables = loadImportedTables();
    setFixedSlots(initialFixed);
    setTasks(initialTasks);
    setImportedTables(initialTables);
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

  const handleTablesChange = (newTables: ImportedTableData[]) => {
    setImportedTables(newTables);
    saveImportedTables(newTables);
  };

  const handleSaveTableData = (table: ImportedTableData) => {
    const updated = [table, ...importedTables.filter((t) => t.id !== table.id)];
    setImportedTables(updated);
    saveImportedTables(updated);
    // 取り込んだ表の軸・インターバル定義を行えるようデータ管理Sheetへ遷移
    setActiveTab('data');
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
      <div className="flex h-screen h-[100dvh] items-center justify-center bg-[#fbfaf5] bg-notebook-grid text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">理論値計画表を初期化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen h-[100dvh] flex-col overflow-hidden bg-[#fbfaf5] bg-notebook-grid text-slate-800">
      {/* Slim Integrated Header (Hidden in focus mode) */}
      {!isHeaderHidden ? (
        <Header
          userEmail={userEmail}
          onOpenAuth={() => setIsAuthOpen(true)}
          onSignOut={handleSignOut}
          onOpenImport={() => setIsImportOpen(true)}
          lastSavedAt={lastSavedAt}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unassignedCount={schedulingResult.unassignedTasks.length}
          tablesCount={importedTables.length}
          tasksCount={tasks.length}
          fixedCount={fixedSlots.length}
          onHideHeader={() => setIsHeaderHidden(true)}
        />
      ) : (
        /* Floating Restore Header Button when hidden */
        <button
          onClick={() => setIsHeaderHidden(false)}
          className="absolute right-3 top-2 z-50 flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700 shadow-md backdrop-blur-xs transition hover:bg-white hover:text-blue-600 hover:shadow-lg"
          title="ヘッダーを再表示"
        >
          <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
          <span>ヘッダー表示</span>
        </button>
      )}

      <main className="mx-auto flex w-full flex-1 min-h-0 flex-col px-1.5 py-1 sm:px-3 sm:py-1.5 max-w-full">
        {/* Sheet 1: 計画表 (メインタイムライン) */}
        {activeTab === 'timeline' && (
          <div className="flex flex-1 min-h-0 flex-col">
            <Timeline24h
              blocks={schedulingResult.blocks}
              dayBlocks={schedulingResult.dayBlocks}
              unassignedTasks={schedulingResult.unassignedTasks}
            />
          </div>
        )}

        {/* Sheet 2: データ管理 (読み込み時間割・軸定義・計画表反映) */}
        {activeTab === 'data' && (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <ImportedTablesManager
              tables={importedTables}
              onTablesChange={handleTablesChange}
              fixedSlots={fixedSlots}
              onSlotsChange={handleFixedSlotsChange}
              tasks={tasks}
              onTasksChange={handleTasksChange}
              onNavigateToTimeline={() => setActiveTab('timeline')}
            />
          </div>
        )}

        {/* Sheet 3: 設定 (日課・週次目標タスク / 生活固定枠スタック) */}
        {activeTab === 'settings' && (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <TaskManager
              tasks={tasks}
              onChange={handleTasksChange}
              slots={fixedSlots}
              onSlotsChange={handleFixedSlotsChange}
              onNavigateToTimeline={() => setActiveTab('timeline')}
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
        onSaveTableData={handleSaveTableData}
      />
    </div>
  );
}
