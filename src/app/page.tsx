'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SheetFooter, SheetTab } from '@/components/SheetFooter';
import { Timeline24h } from '@/components/Timeline24h';
import { ImportedTablesManager } from '@/components/ImportedTablesManager';
import { AuthModal } from '@/components/AuthModal';
import { FileImportModal } from '@/components/FileImportModal';
import { FixedSlot, TaskItem, ImportedTableData, ScheduleInclusionSettings, AppThemeMode } from '@/types';
import { generateTheoreticalSchedule } from '@/lib/scheduler';
import {
  loadLocalData,
  saveLocalData,
  syncWithSupabase,
  loadImportedTables,
  saveImportedTables,
  loadInclusionSettings,
  saveInclusionSettings,
  DEFAULT_INCLUSION_SETTINGS,
} from '@/lib/storage';
import { generateScheduleItemsForTable } from '@/lib/tableUtils';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [fixedSlots, setFixedSlots] = useState<FixedSlot[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [importedTables, setImportedTables] = useState<ImportedTableData[]>([]);
  const [inclusionSettings, setInclusionSettings] = useState<ScheduleInclusionSettings>(
    DEFAULT_INCLUSION_SETTINGS,
  );
  const [activeTab, setActiveTab] = useState<SheetTab>('timeline');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importInitialFile, setImportInitialFile] = useState<File | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [focusMode, setFocusMode] = useState<'week' | 'today'>('today');
  // デザインテーマ（手帳風 'planner' ⇄ モダン 'modern'）
  const [themeMode, setThemeMode] = useState<AppThemeMode>('planner');
  // Plan11: ユーザー手動による完了/未完了トグル状態の管理
  const [completedBlockIds, setCompletedBlockIds] = useState<Set<string>>(new Set());
  const [uncompletedBlockIds, setUncompletedBlockIds] = useState<Set<string>>(new Set());

  // 完了トグル状態の復元
  useEffect(() => {
    try {
      const savedCompleted = localStorage.getItem('app_completed_block_ids');
      if (savedCompleted) {
        setCompletedBlockIds(new Set(JSON.parse(savedCompleted)));
      }
      const savedUncompleted = localStorage.getItem('app_uncompleted_block_ids');
      if (savedUncompleted) {
        setUncompletedBlockIds(new Set(JSON.parse(savedUncompleted)));
      }
    } catch {
      // ignore
    }
  }, []);

  // フォーカスモードの復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_focus_mode');
      if (saved === 'week' || saved === 'today') {
        setFocusMode(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  // デザインテーマ（手帳風 ⇄ モダン）の復元
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('app_theme_mode');
      if (savedTheme === 'planner' || savedTheme === 'modern') {
        setThemeMode(savedTheme);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleThemeMode = (mode?: AppThemeMode) => {
    setThemeMode((prev) => {
      const next = mode || (prev === 'planner' ? 'modern' : 'planner');
      try {
        localStorage.setItem('app_theme_mode', next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleToggleFocus = () => {
    setFocusMode((prev) => {
      const next = prev === 'today' ? 'week' : 'today';
      try {
        localStorage.setItem('app_focus_mode', next);
      } catch {
        // ignore
      }
      return next;
    });
    // もしデータ管理タブにいる場合は計画表タブへ切り替え
    if (activeTab !== 'timeline') {
      setActiveTab('timeline');
    }
  };

  const handleFileSelectFromSidebar = (file: File) => {
    setImportInitialFile(file);
    setIsImportOpen(true);
  };

  // 初期化ロード & 反映ONテーブルの自動同期
  useEffect(() => {
    const { fixedSlots: initialFixed, tasks: initialTasks } = loadLocalData();
    const initialTables = loadImportedTables();
    const initialInclusion = loadInclusionSettings();

    // 1. 不正スロットのクリーンアップ: 期間0分や、テーブル由来で誤って24時間化してしまったスロットを除去
    let syncedFixed = initialFixed.filter((s) => {
      if (s.startMinutes === s.endMinutes) return false;
      // テーブル由来のスロットで 0:00〜24:00 (1440分) になってしまっている異常スロットを除外
      if (
        (s.sourceTableId || s.id.startsWith('slot-table-') || s.id.startsWith('slot-lecture-')) &&
        s.startMinutes === 0 &&
        s.endMinutes === 1440
      ) {
        return false;
      }
      return true;
    });

    let syncedTasks = [...initialTasks];
    let isTablesChanged = false;
    let isDataCleaned = syncedFixed.length !== initialFixed.length;

    // 2. 各テーブルの反映状態（isApplied）を判定し、安全に最新アイテムを同期
    const updatedTables = initialTables.map((table) => {
      const hasAppliedItems =
        syncedFixed.some((s) => s.sourceTableId === table.id) ||
        syncedTasks.some((t) => t.sourceTableId === table.id);

      const isApplied = table.isApplied !== undefined ? table.isApplied : hasAppliedItems;

      if (isApplied) {
        const { slots: generatedSlots, tasks: generatedTasks } =
          generateScheduleItemsForTable(table);

        // 固定枠の同期 (開始時刻がある表の場合)
        if (generatedSlots.length > 0) {
          const generatedSlotMap = new Map(generatedSlots.map((s) => [s.id, s]));
          syncedFixed = syncedFixed.map((s) => {
            if (s.sourceTableId === table.id) {
              const gen =
                generatedSlotMap.get(s.id) ||
                generatedSlots.find((gs) => gs.title === s.title);
              if (gen && gen.breakMinutes !== s.breakMinutes) {
                isDataCleaned = true;
                return { ...s, breakMinutes: gen.breakMinutes };
              }
            }
            return s;
          });

          const existingSlotIds = new Set(
            syncedFixed.filter((s) => s.sourceTableId === table.id).map((s) => s.id),
          );
          const missingSlots = generatedSlots.filter((s) => !existingSlotIds.has(s.id));
          if (missingSlots.length > 0) {
            syncedFixed = [...syncedFixed, ...missingSlots];
            isDataCleaned = true;
          }
        }

        // タスクの同期 (開始時刻が未設定または付随タスクがある場合)
        if (generatedTasks.length > 0) {
          const generatedTaskMap = new Map(generatedTasks.map((t) => [t.id, t]));
          syncedTasks = syncedTasks.map((t) => {
            if (t.sourceTableId === table.id) {
              const gen =
                generatedTaskMap.get(t.id) ||
                generatedTasks.find((gt) => gt.title === t.title);
              if (gen && gen.breakMinutes !== t.breakMinutes) {
                isDataCleaned = true;
                return { ...t, breakMinutes: gen.breakMinutes };
              }
            }
            return t;
          });

          const existingTaskIds = new Set(
            syncedTasks.filter((t) => t.sourceTableId === table.id).map((t) => t.id),
          );
          const missingTasks = generatedTasks.filter((t) => !existingTaskIds.has(t.id));
          if (missingTasks.length > 0) {
            syncedTasks = [...syncedTasks, ...missingTasks];
            isDataCleaned = true;
          }
        }
      }

      if (table.isApplied !== isApplied) {
        isTablesChanged = true;
        return { ...table, isApplied };
      }
      return table;
    });

    setFixedSlots(syncedFixed);
    setTasks(syncedTasks);
    setImportedTables(updatedTables);
    setInclusionSettings(initialInclusion);
    setIsInitialized(true);

    if (isDataCleaned) {
      saveLocalData(syncedFixed, syncedTasks);
    }

    if (isTablesChanged) {
      saveImportedTables(updatedTables);
    }

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

  // fixedSlots または tasks 変更時の自動永続化 (isInitialized 後)
  useEffect(() => {
    if (!isInitialized) return;
    saveLocalData(fixedSlots, tasks);
    setLastSavedAt(new Date());

    if (userId) {
      syncWithSupabase(userId, fixedSlots, tasks).catch((e) =>
        console.error('Supabase sync error', e),
      );
    }
  }, [fixedSlots, tasks, isInitialized, userId]);

  const handleFixedSlotsChange = (newSlots: FixedSlot[]) => {
    setFixedSlots(newSlots);
  };

  const handleTasksChange = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
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
  };

  const handleTablesChange = (newTables: ImportedTableData[]) => {
    setImportedTables(newTables);
    saveImportedTables(newTables);
  };

  const handleSaveTableData = (table: ImportedTableData) => {
    const existing = importedTables.find((t) => t.id === table.id);
    const tableWithColor: ImportedTableData = {
      ...table,
      colorIndex:
        table.colorIndex !== undefined
          ? table.colorIndex
          : existing?.colorIndex !== undefined
            ? existing.colorIndex
            : importedTables.length % 12,
    };
    const updated = [tableWithColor, ...importedTables.filter((t) => t.id !== table.id)];
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

  const handleInclusionSettingsChange = (newSettings: ScheduleInclusionSettings) => {
    setInclusionSettings(newSettings);
    saveInclusionSettings(newSettings);
  };

  // 計画表に反映する有効な固定枠（生活リズム枠のON/OFF考慮）
  const effectiveFixedSlots = useMemo(() => {
    if (inclusionSettings.enableSlots) return fixedSlots;
    // 生活リズム（睡眠、ルーティン等）がOFFの場合は講義枠のみ残す
    return fixedSlots.filter((s) => s.category === 'lecture');
  }, [fixedSlots, inclusionSettings.enableSlots]);

  // 計画表に反映する有効なタスク（日課タスク・週次タスクのON/OFF考慮）
  const effectiveTasks = useMemo(() => {
    return tasks.filter((t) => {
      const isDaily = t.period === 'day' || t.frequency === 'high';
      if (isDaily && !inclusionSettings.enableDailyTasks) return false;
      if (!isDaily && !inclusionSettings.enableWeeklyTasks) return false;
      return true;
    });
  }, [tasks, inclusionSettings.enableDailyTasks, inclusionSettings.enableWeeklyTasks]);

  // Plan11: 週タスクの完了状態トグルハンドラ
  const handleToggleBlockComplete = (block: import('@/types').TheoreticalBlock) => {
    // 週タスク以外は操作させない安全ガード
    if (!block.isWeeklyTask) return;

    const blockKey = block.id;
    const now = new Date();
    const todayIdx = (now.getDay() + 6) % 7;
    const currMinutes = now.getHours() * 60 + now.getMinutes();
    const isPast =
      block.dayIndex !== undefined &&
      (block.dayIndex < todayIdx || (block.dayIndex === todayIdx && block.endMinutes <= currMinutes));

    if (block.isCompleted) {
      // 現在完了 -> 未完了に戻す（「まだ終わってないよ」）
      setCompletedBlockIds((prev) => {
        const next = new Set(prev);
        next.delete(blockKey);
        try {
          localStorage.setItem('app_completed_block_ids', JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
        return next;
      });

      // 過去の枠の場合のみ「やり残し（未完了）」として再配置対象リストへ登録
      // 未来の枠の場合は元々未完了がデフォルトなので登録不要（再配置・増殖を防止）
      if (isPast) {
        setUncompletedBlockIds((prev) => {
          const next = new Set(prev);
          next.add(blockKey);
          try {
            localStorage.setItem('app_uncompleted_block_ids', JSON.stringify(Array.from(next)));
          } catch {
            // ignore
          }
          return next;
        });
      }
    } else {
      // 現在未完了 -> 完了にする（「これはもう終わっている」）
      setUncompletedBlockIds((prev) => {
        const next = new Set(prev);
        next.delete(blockKey);
        try {
          localStorage.setItem('app_uncompleted_block_ids', JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
        return next;
      });

      setCompletedBlockIds((prev) => {
        const next = new Set(prev);
        next.add(blockKey);
        try {
          localStorage.setItem('app_completed_block_ids', JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
        return next;
      });
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
    return generateTheoreticalSchedule(effectiveFixedSlots, effectiveTasks, {
      completedBlockIds,
      uncompletedBlockIds,
    });
  }, [effectiveFixedSlots, effectiveTasks, isInitialized, completedBlockIds, uncompletedBlockIds]);

  if (!isInitialized) {
    return (
      <div
        data-theme={themeMode}
        className={`flex h-full h-[100dvh] w-full items-center justify-center text-slate-800 transition-colors ${
          themeMode === 'planner' ? 'bg-[#f4efe8] bg-notebook-grid' : 'bg-[#f8fafc] modern-grid-bg'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">理論値計画表を初期化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-theme={themeMode}
      className={`relative flex h-full h-[100dvh] w-full flex-col overflow-hidden text-slate-800 transition-colors duration-300 ${
        themeMode === 'planner' ? 'bg-[#f4efe8] bg-notebook-grid' : 'bg-[#f8fafc] modern-grid-bg'
      }`}
    >
      <main className="mx-auto flex w-full flex-1 min-h-0 flex-col px-1.5 pt-1.5 pb-1 sm:px-3 sm:pt-2 sm:pb-1.5 max-w-full">
        {/* Sheet 1: 計画表 (メインタイムライン) */}
        <div
          className={`flex flex-1 min-h-0 flex-col ${
            activeTab === 'timeline' ? '' : 'hidden'
          }`}
        >
          <Timeline24h
            blocks={schedulingResult.blocks}
            dayBlocks={schedulingResult.dayBlocks}
            unassignedTasks={schedulingResult.unassignedTasks}
            importedTables={importedTables}
            focusMode={focusMode}
            onToggleFocus={handleToggleFocus}
            onToggleBlockComplete={handleToggleBlockComplete}
            themeMode={themeMode}
            onToggleThemeMode={handleToggleThemeMode}
          />
        </div>

        {/* Sheet 2: データ管理 (読み込み時間割・軸定義・計画表反映) */}
        <div
          className={`flex flex-1 min-h-0 flex-col overflow-hidden ${
            activeTab === 'data' ? '' : 'hidden'
          }`}
        >
          <ImportedTablesManager
            tables={importedTables}
            onTablesChange={handleTablesChange}
            fixedSlots={fixedSlots}
            onSlotsChange={handleFixedSlotsChange}
            tasks={tasks}
            onTasksChange={handleTasksChange}
            inclusionSettings={inclusionSettings}
            onInclusionSettingsChange={handleInclusionSettingsChange}
            onNavigateToTimeline={() => setActiveTab('timeline')}
            onOpenImport={() => {
              setImportInitialFile(null);
              setIsImportOpen(true);
            }}
            onFileSelect={handleFileSelectFromSidebar}
          />
        </div>
      </main>

      {/* Excel風 シート切り替えフッター */}
      <SheetFooter
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unassignedCount={schedulingResult.unassignedTasks.length}
        tablesCount={importedTables.length}
        lastSavedAt={lastSavedAt}
        userEmail={userEmail}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
        focusMode={focusMode}
        onToggleFocus={handleToggleFocus}
        themeMode={themeMode}
        onToggleThemeMode={handleToggleThemeMode}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(email) => {
          setUserEmail(email);
        }}
      />

      <FileImportModal
        isOpen={isImportOpen}
        initialFile={importInitialFile}
        onClose={() => {
          setIsImportOpen(false);
          setImportInitialFile(null);
        }}
        onImport={handleImport}
        onSaveTableData={handleSaveTableData}
      />
    </div>
  );
}
