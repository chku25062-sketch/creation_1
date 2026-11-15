'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SheetFooter, SheetTab, DebugTimeConfig } from '@/components/SheetFooter';
import { Timeline24h } from '@/components/Timeline24h';
import { ImportedTablesManager } from '@/components/ImportedTablesManager';
import { AuthModal } from '@/components/AuthModal';
import { FileImportModal } from '@/components/FileImportModal';
import {
  FixedSlot,
  TaskItem,
  GridCell,
  ImportedTableData,
  ScheduleInclusionSettings,
  AppThemeMode,
  TaskPlacementStrategy,
} from '@/types';
import {
  generateTheoreticalSchedule,
  toggleBlockCompletion,
  persistCompletionStates,
} from '@/lib/scheduler';
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
import { getMondayKey } from '@/lib/timeUtils';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [fixedSlots, setFixedSlots] = useState<FixedSlot[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [importedTables, setImportedTables] = useState<ImportedTableData[]>([]);
  const [inclusionSettings, setInclusionSettings] = useState<ScheduleInclusionSettings>(
    DEFAULT_INCLUSION_SETTINGS,
  );
  const [activeTab, setActiveTab] = useState<SheetTab>('timeline');
  const [activeDataName, setActiveDataName] = useState<string>('表データ');
  const [isMobileSwitcherOpen, setIsMobileSwitcherOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importInitialFile, setImportInitialFile] = useState<File | null>(null);
  const [importTargetTableId, setImportTargetTableId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [focusMode, setFocusMode] = useState<'week' | 'today'>('today');
  // デザインテーマ（手帳風 'planner' ⇄ モダン 'modern'）
  const [themeMode, setThemeMode] = useState<AppThemeMode>('planner');
  // Plan11: ユーザー手動による完了/未完了トグル状態の管理
  const [completedBlockIds, setCompletedBlockIds] = useState<Set<string>>(new Set());
  const [uncompletedBlockIds, setUncompletedBlockIds] = useState<Set<string>>(new Set());

  // 日フォーカスで選択されている曜日インデックス (0=月 ... 6=日)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const now = new Date();
    return (now.getDay() + 6) % 7;
  });

  // タスク配分ポリシー（分散バランス型 'balanced' ⇄ 集中前倒し型 'concentrated'）
  const [placementStrategy, setPlacementStrategy] = useState<TaskPlacementStrategy>('balanced');

  // 実日時（システムクロック）とデバッグ用日時オーバーライド設定
  const [realTime, setRealTime] = useState<{ dayIndex: number; minutes: number }>(() => {
    const now = new Date();
    return {
      dayIndex: (now.getDay() + 6) % 7,
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  });

  const [debugTime, setDebugTime] = useState<DebugTimeConfig>(() => {
    const now = new Date();
    return {
      enabled: false,
      dayIndex: (now.getDay() + 6) % 7,
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  });

  useEffect(() => {
    const updateRealTime = () => {
      const now = new Date();
      setRealTime({
        dayIndex: (now.getDay() + 6) % 7,
        minutes: now.getHours() * 60 + now.getMinutes(),
      });
    };
    updateRealTime();
    const interval = setInterval(updateRealTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // デバッグ日時設定の復元
  useEffect(() => {
    try {
      const savedDebug = localStorage.getItem('app_debug_time_config');
      if (savedDebug) {
        const parsed = JSON.parse(savedDebug);
        if (
          typeof parsed.enabled === 'boolean' &&
          typeof parsed.dayIndex === 'number' &&
          typeof parsed.minutes === 'number'
        ) {
          setDebugTime(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 開発環境（npm run dev）でのみデバッグ機能を有効化し、本番デプロイ（production）では自動非表示・無効化
  const isDevelopment = process.env.NODE_ENV === 'development';

  const effectiveTodayIndex =
    isDevelopment && debugTime.enabled ? debugTime.dayIndex : realTime.dayIndex;
  const effectiveCurrentMinutes =
    isDevelopment && debugTime.enabled ? debugTime.minutes : realTime.minutes;

  // 有効な今日（effectiveTodayIndex）が深夜0時を跨ぐかデバッグ日時変更で切り替わった際、日フォーカスも新しい今日へ自動追従
  const prevTodayRef = useRef(effectiveTodayIndex);
  useEffect(() => {
    if (prevTodayRef.current !== effectiveTodayIndex) {
      setSelectedDayIndex(effectiveTodayIndex);
      prevTodayRef.current = effectiveTodayIndex;
    }
  }, [effectiveTodayIndex]);

  const handleChangeDebugTime = (next: Partial<DebugTimeConfig>) => {
    if (next.dayIndex !== undefined) {
      setSelectedDayIndex(next.dayIndex);
    }
    setDebugTime((prev) => {
      const base = prev.enabled
        ? prev
        : {
            enabled: false,
            dayIndex: realTime.dayIndex,
            minutes: realTime.minutes,
          };
      const updated: DebugTimeConfig = {
        ...base,
        ...next,
      };
      try {
        localStorage.setItem('app_debug_time_config', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleResetDebugTime = () => {
    const now = new Date();
    const realDay = (now.getDay() + 6) % 7;
    const realMins = now.getHours() * 60 + now.getMinutes();
    const resetConfig: DebugTimeConfig = {
      enabled: false,
      dayIndex: realDay,
      minutes: realMins,
    };
    setDebugTime(resetConfig);
    setSelectedDayIndex(realDay);
    try {
      localStorage.removeItem('app_debug_time_config');
    } catch {
      // ignore
    }
  };

  // Plan19: 今週の週識別キー（月曜日の日付 YYYY-MM-DD）。週が変わるとキーが自動で切り替わる
  const currentWeekKey = useMemo(() => getMondayKey(new Date()), [effectiveTodayIndex]);

  const handleResetCompletionStates = () => {
    setCompletedBlockIds(new Set());
    setUncompletedBlockIds(new Set());
    try {
      localStorage.removeItem(`app_completed_block_ids_${currentWeekKey}`);
      localStorage.removeItem(`app_uncompleted_block_ids_${currentWeekKey}`);
      localStorage.removeItem('app_completed_block_ids');
      localStorage.removeItem('app_uncompleted_block_ids');
    } catch {
      // ignore
    }
  };

  // 完了トグル状態の復元（週キーによる世代分離）
  useEffect(() => {
    try {
      const savedCompleted =
        localStorage.getItem(`app_completed_block_ids_${currentWeekKey}`) ??
        localStorage.getItem('app_completed_block_ids');
      if (savedCompleted) {
        setCompletedBlockIds(new Set(JSON.parse(savedCompleted)));
      } else {
        setCompletedBlockIds(new Set());
      }
      const savedUncompleted =
        localStorage.getItem(`app_uncompleted_block_ids_${currentWeekKey}`) ??
        localStorage.getItem('app_uncompleted_block_ids');
      if (savedUncompleted) {
        setUncompletedBlockIds(new Set(JSON.parse(savedUncompleted)));
      } else {
        setUncompletedBlockIds(new Set());
      }
    } catch {
      // ignore
    }
  }, [currentWeekKey]);

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

  // タスク配分ポリシー（分散 ⇄ 集中）の復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_placement_strategy');
      if (saved === 'balanced' || saved === 'concentrated') {
        setPlacementStrategy(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleTogglePlacementStrategy = (strategy?: TaskPlacementStrategy) => {
    setPlacementStrategy((prev) => {
      const next = strategy || (prev === 'balanced' ? 'concentrated' : 'balanced');
      try {
        localStorage.setItem('app_placement_strategy', next);
      } catch {
        // ignore
      }
      return next;
    });
  };

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

  const handleFileSelectFromSidebar = (file: File, targetTableId?: string) => {
    setImportInitialFile(file);
    setImportTargetTableId(targetTableId || null);
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
          // 同一テーブル由来で最新の生成結果に含まれない古い重複スロット（fixed-lecture-mw 等）を除去
          const beforeLen = syncedFixed.length;
          syncedFixed = syncedFixed.filter(
            (s) => s.sourceTableId !== table.id || generatedSlotMap.has(s.id),
          );
          if (syncedFixed.length !== beforeLen) {
            isDataCleaned = true;
          }

          syncedFixed = syncedFixed.map((s) => {
            if (s.sourceTableId === table.id) {
              const gen =
                generatedSlotMap.get(s.id) || generatedSlots.find((gs) => gs.title === s.title);
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
          const beforeTaskLen = syncedTasks.length;
          syncedTasks = syncedTasks.filter(
            (t) => t.sourceTableId !== table.id || generatedTaskMap.has(t.id),
          );
          if (syncedTasks.length !== beforeTaskLen) {
            isDataCleaned = true;
          }

          syncedTasks = syncedTasks.map((t) => {
            if (t.sourceTableId === table.id) {
              const gen =
                generatedTaskMap.get(t.id) || generatedTasks.find((gt) => gt.title === t.title);
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
    const targetId = importTargetTableId || table.id;
    const existing = importedTables.find((t) => t.id === targetId);

    if (existing) {
      // 既存テーブルに対して OR 上書きマージ（新セルの値があれば優先、空なら元あった既存セルの値を維持）
      const mergedRows = Math.max(existing.numRows, table.numRows);
      const mergedCols = Math.max(existing.numCols, table.numCols);

      const mergedCells: GridCell[][] = Array.from({ length: mergedRows }, (_, r) =>
        Array.from({ length: mergedCols }, (_, c) => {
          const newCell = table.cells?.[r]?.[c];
          const oldCell = existing.cells?.[r]?.[c];
          const hasNew = !!(
            newCell &&
            ((newCell.text && newCell.text.trim()) ||
              (newCell.title && newCell.title.trim()) ||
              (newCell.fullText && newCell.fullText.trim()))
          );

          if (hasNew && newCell) {
            return {
              ...newCell,
              attachedTask: newCell.attachedTask ?? oldCell?.attachedTask,
              category: newCell.category || oldCell?.category,
            };
          }
          if (oldCell) {
            return oldCell;
          }
          return (
            newCell || {
              dayIndex: c % 7,
              periodIndex: r + 1,
              text: null,
              rawLines: [],
              fullText: '',
              title: '',
              roomOrNote: '',
              startMinutes: 530,
              endMinutes: 620,
            }
          );
        }),
      );

      const defaultColHeaders = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];
      const mergedColHeaders = Array.from({ length: mergedCols }, (_, c) => {
        return (
          table.colHeaders?.[c] || existing.colHeaders?.[c] || defaultColHeaders[c] || `列 ${c + 1}`
        );
      });

      const mergedRowHeaders = Array.from({ length: mergedRows }, (_, r) => {
        return table.rowHeaders?.[r] || existing.rowHeaders?.[r] || `${r + 1}限`;
      });

      const updatedTable: ImportedTableData = {
        ...existing,
        ...table,
        numRows: mergedRows,
        numCols: mergedCols,
        cells: mergedCells,
        colHeaders: mergedColHeaders,
        rowHeaders: mergedRowHeaders,
        updatedAt: new Date().toISOString(),
      };

      const updated = importedTables.map((t) => (t.id === existing.id ? updatedTable : t));
      setImportedTables(updated);
      saveImportedTables(updated);

      // 計画表に反映中（isApplied）であれば、固定枠・タスクも自動再同期
      const isApplied =
        existing.isApplied !== undefined
          ? existing.isApplied
          : fixedSlots.some((s) => s.sourceTableId === existing.id) ||
            tasks.some((t) => t.sourceTableId === existing.id);

      if (isApplied) {
        const { slots: newSlots, tasks: newTasks } = generateScheduleItemsForTable(updatedTable);

        const prevSlotEnabledMap = new Map<string, boolean | undefined>();
        fixedSlots.forEach((s) => {
          if (s.sourceTableId === existing.id || s.id.startsWith(`slot-table-${existing.id}-`)) {
            prevSlotEnabledMap.set(s.id, s.enabled);
            prevSlotEnabledMap.set(`${s.title}_${s.startMinutes}`, s.enabled);
          }
        });
        const mergedNewSlots = newSlots.map((s) => {
          const prevEnabled =
            prevSlotEnabledMap.get(s.id) ?? prevSlotEnabledMap.get(`${s.title}_${s.startMinutes}`);
          return prevEnabled !== undefined ? { ...s, enabled: prevEnabled } : s;
        });

        const filteredSlots = fixedSlots.filter(
          (s) =>
            s.sourceTableId !== existing.id &&
            !s.id.startsWith(`slot-table-${existing.id}-`) &&
            !s.id.startsWith(`slot-lecture-${existing.id}-`),
        );
        setFixedSlots([...filteredSlots, ...mergedNewSlots]);

        const prevTaskEnabledMap = new Map<string, boolean | undefined>();
        tasks.forEach((t) => {
          if (t.sourceTableId === existing.id || t.id.startsWith(`task-table-${existing.id}-`)) {
            prevTaskEnabledMap.set(t.id, t.enabled);
            prevTaskEnabledMap.set(t.title, t.enabled);
          }
        });
        const mergedNewTasks = newTasks.map((t) => {
          const prevEnabled = prevTaskEnabledMap.get(t.id) ?? prevTaskEnabledMap.get(t.title);
          return prevEnabled !== undefined ? { ...t, enabled: prevEnabled } : t;
        });

        const filteredTasks = tasks.filter(
          (t) =>
            t.sourceTableId !== existing.id &&
            !t.id.startsWith(`task-table-${existing.id}-`) &&
            !t.id.startsWith(`task-attached-${existing.id}-`),
        );
        setTasks([...filteredTasks, ...mergedNewTasks]);
      }
    } else {
      // 新規テーブルとして追加
      const tableWithColor: ImportedTableData = {
        ...table,
        colorIndex: table.colorIndex !== undefined ? table.colorIndex : importedTables.length % 12,
      };
      const updated = [tableWithColor, ...importedTables.filter((t) => t.id !== table.id)];
      setImportedTables(updated);
      saveImportedTables(updated);
    }

    setImportTargetTableId(null);
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

  // 計画表に反映する有効な固定枠（生活リズム枠のON/OFF ＆ 個別スロットのenabled考慮）
  const effectiveFixedSlots = useMemo(() => {
    const enabledSlots = fixedSlots.filter((s) => s.enabled !== false);
    if (inclusionSettings.enableSlots) return enabledSlots;
    // 生活リズム（睡眠、ルーティン等）がOFFの場合は講義枠のみ残す
    return enabledSlots.filter((s) => s.category === 'lecture');
  }, [fixedSlots, inclusionSettings.enableSlots]);

  // 計画表に反映する有効なタスク（日課タスク・週次タスクのON/OFF ＆ 個別タスクのenabled考慮）
  const effectiveTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.enabled === false) return false;
      const isDaily = t.period === 'day' || t.frequency === 'high';
      if (isDaily && !inclusionSettings.enableDailyTasks) return false;
      if (!isDaily && !inclusionSettings.enableWeeklyTasks) return false;
      return true;
    });
  }, [tasks, inclusionSettings.enableDailyTasks, inclusionSettings.enableWeeklyTasks]);

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
      todayIndex: effectiveTodayIndex,
      currentMinutes: effectiveCurrentMinutes,
      completedBlockIds,
      uncompletedBlockIds,
      placementStrategy,
    });
  }, [
    effectiveFixedSlots,
    effectiveTasks,
    isInitialized,
    effectiveTodayIndex,
    effectiveCurrentMinutes,
    completedBlockIds,
    uncompletedBlockIds,
    placementStrategy,
  ]);

  const lastToggleRef = useRef<{ blockId: string; time: number } | null>(null);

  // 固定枠・週タスク・再配置タスク・代行タスクの完了状態トグルハンドラ
  // completionManager 純粋関数モジュールに状態遷移・連動処理・永続化を一元委譲
  const handleToggleBlockComplete = (block: import('@/types').TheoreticalBlock) => {
    if (block.isBreak) return;

    // 高速連打（150ms以内の同一ブロック連打）による状態不整合・レースコンディションを防止
    const now = Date.now();
    if (
      lastToggleRef.current &&
      lastToggleRef.current.blockId === block.id &&
      now - lastToggleRef.current.time < 150
    ) {
      return;
    }
    lastToggleRef.current = { blockId: block.id, time: now };

    const { nextCompletedIds, nextUncompletedIds } = toggleBlockCompletion({
      targetBlock: block,
      allBlocks: schedulingResult.allBlocks || [],
      completedBlockIds,
      uncompletedBlockIds,
      todayIdx: effectiveTodayIndex,
      currMinutes: effectiveCurrentMinutes,
    });

    setCompletedBlockIds(nextCompletedIds);
    setUncompletedBlockIds(nextUncompletedIds);
    persistCompletionStates(nextCompletedIds, nextUncompletedIds, currentWeekKey);
  };

  // 今週配置された全週タスク一覧（日フォーカス時も週全体を俯瞰できるよう抽出）
  const weeklyBlocks = useMemo(() => {
    if (!schedulingResult.allBlocks) return [];
    return schedulingResult.allBlocks
      .filter((b) => (b.isWeeklyTask || b.isRescheduled) && !b.isFixed && !b.isBreak)
      .sort((a, b) => {
        const dayA = a.dayIndex ?? 0;
        const dayB = b.dayIndex ?? 0;
        if (dayA !== dayB) return dayA - dayB;
        return a.startMinutes - b.startMinutes;
      });
  }, [schedulingResult.allBlocks]);

  // 今週未配置の週タスク一覧（枠不足等）
  const unassignedWeeklyTasks = useMemo(() => {
    if (!schedulingResult.unassignedTasks) return [];
    return schedulingResult.unassignedTasks.filter((t) => {
      const isDaily = t.period === 'day' || t.frequency === 'high';
      return !isDaily || t.period === 'week' || t.frequency === 'low';
    });
  }, [schedulingResult.unassignedTasks]);

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
      <main className="flex w-full flex-1 min-h-0 flex-col p-0 max-w-full">
        {/* Sheet 1: 計画表 (メインタイムライン) */}
        <div className={`flex flex-1 min-h-0 flex-col ${activeTab === 'timeline' ? '' : 'hidden'}`}>
          <Timeline24h
            blocks={schedulingResult.blocks}
            dayBlocks={schedulingResult.dayBlocks}
            unassignedTasks={schedulingResult.unassignedTasks}
            importedTables={importedTables}
            focusMode={focusMode}
            onToggleFocus={handleToggleFocus}
            onToggleBlockComplete={handleToggleBlockComplete}
            themeMode={themeMode}
            selectedDayIndex={selectedDayIndex}
            onSelectDayIndex={setSelectedDayIndex}
            overrideTodayIndex={effectiveTodayIndex}
            overrideCurrentMinutes={effectiveCurrentMinutes}
            isDebugTime={isDevelopment && debugTime.enabled}
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
            onOpenImport={(targetTableId) => {
              setImportInitialFile(null);
              setImportTargetTableId(targetTableId || null);
              setIsImportOpen(true);
            }}
            onFileSelect={handleFileSelectFromSidebar}
            isMobileSwitcherOpen={isMobileSwitcherOpen}
            onMobileSwitcherOpenChange={setIsMobileSwitcherOpen}
            onActiveDataNameChange={setActiveDataName}
          />
        </div>
      </main>

      {/* Excel風 シート切り替えフッター */}
      <SheetFooter
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeDataName={activeDataName}
        onOpenMobileSwitcher={() => setIsMobileSwitcherOpen(true)}
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
        weeklyBlocks={weeklyBlocks}
        unassignedWeeklyTasks={unassignedWeeklyTasks}
        allBlocks={schedulingResult.allBlocks}
        allTasks={effectiveTasks}
        onToggleBlockComplete={handleToggleBlockComplete}
        selectedDayIndex={selectedDayIndex}
        placementStrategy={placementStrategy}
        onTogglePlacementStrategy={handleTogglePlacementStrategy}
        debugTime={
          isDevelopment
            ? {
                enabled: debugTime.enabled,
                dayIndex: effectiveTodayIndex,
                minutes: effectiveCurrentMinutes,
              }
            : undefined
        }
        onChangeDebugTime={isDevelopment ? handleChangeDebugTime : undefined}
        onResetDebugTime={isDevelopment ? handleResetDebugTime : undefined}
        onResetCompletionStates={isDevelopment ? handleResetCompletionStates : undefined}
        onSelectDayIndex={(idx) => {
          setSelectedDayIndex(idx);
          if (focusMode !== 'today') {
            setFocusMode('today');
            try {
              localStorage.setItem('app_focus_mode', 'today');
            } catch {
              // ignore
            }
          }
          if (activeTab !== 'timeline') {
            setActiveTab('timeline');
          }
        }}
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
        targetTableId={importTargetTableId || undefined}
        targetTableName={
          importTargetTableId
            ? importedTables.find((t) => t.id === importTargetTableId)?.name
            : undefined
        }
        onClose={() => {
          setIsImportOpen(false);
          setImportInitialFile(null);
          setImportTargetTableId(null);
        }}
        onImport={handleImport}
        onSaveTableData={handleSaveTableData}
      />
    </div>
  );
}
