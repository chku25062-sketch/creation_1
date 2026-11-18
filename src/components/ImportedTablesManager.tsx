'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Edit2,
  Trash2,
  Plus,
  Minus,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders,
  FolderOpen,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Sun,
  CalendarDays,
  Calendar,
  CalendarRange,
  Clock,
  Repeat,
  Upload,
  X,
  Hourglass,
  Monitor,
  Smartphone,
  Settings,
  Copy,
  ClipboardPaste,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { TableTemplateWizardModal } from '@/components/TableTemplateWizardModal';
import { TABLE_PALETTE_OPTIONS, getTableColorSchemeByIndex } from '@/components/Timeline24h';
import {
  ImportedTableData,
  FixedSlot,
  TaskItem,
  ScheduleInclusionSettings,
  TablePlacementMode,
} from '@/types';
import { calculatePeriodTimes, timeStringToMinutes } from '@/lib/timeUtils';
import { matrixToCsv } from '@/lib/importers/gridDetection';
import {
  getTableClassification,
  setTableColumnMode,
  addRowToTable,
  removeRowFromTable,
  removeRowAtIndex,
  setTableNumRows,
  addColToTable,
  removeColFromTable,
  removeColAtIndex,
  setTableNumCols,
  generateScheduleItemsForTable,
  parseColHeader,
  sortRowsByTime,
  getCellDefaultDuration,
  getCellDefaultStartTime,
} from '@/lib/tableUtils';
import { TaskManager } from '@/components/TaskManager';

interface ImportedTablesManagerProps {
  tables: ImportedTableData[];
  onTablesChange: (newTables: ImportedTableData[]) => void;
  fixedSlots: FixedSlot[];
  onSlotsChange: (newSlots: FixedSlot[]) => void;
  tasks: TaskItem[];
  onTasksChange: (newTasks: TaskItem[]) => void;
  inclusionSettings?: ScheduleInclusionSettings;
  onInclusionSettingsChange?: (newSettings: ScheduleInclusionSettings) => void;
  onNavigateToTimeline?: () => void;
  onOpenImport?: (targetTableId?: string) => void;
  onFileSelect?: (file: File, targetTableId?: string) => void;
  isMobileSwitcherOpen?: boolean;
  onMobileSwitcherOpenChange?: (open: boolean) => void;
  onActiveDataNameChange?: (name: string) => void;
}

const CYCLE_HEADER_OPTIONS = [
  'Day 1',
  'Day 2',
  'Day 3',
  'Day 4',
  'Day 5',
  'Day 6',
  'Day 7',
  'オフ (何もしない日)',
  '除外',
];

export function ImportedTablesManager({
  tables,
  onTablesChange,
  fixedSlots,
  onSlotsChange,
  tasks,
  onTasksChange,
  inclusionSettings,
  onInclusionSettingsChange,
  onNavigateToTimeline,
  onOpenImport,
  onFileSelect,
  isMobileSwitcherOpen: externalIsMobileSwitcherOpen,
  onMobileSwitcherOpenChange,
  onActiveDataNameChange,
}: ImportedTablesManagerProps) {
  // ファイル直接選択用インライン参照
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentTargetTableIdRef = useRef<string | undefined>(undefined);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const targetId = currentTargetTableIdRef.current;
      if (onFileSelect) {
        onFileSelect(selectedFile, targetId);
      } else if (onOpenImport) {
        onOpenImport(targetId);
      }
      e.target.value = '';
      currentTargetTableIdRef.current = undefined;
    }
  };

  const handleTriggerFileSelect = (target?: string | React.MouseEvent) => {
    const targetTableId = typeof target === 'string' ? target : undefined;
    currentTargetTableIdRef.current = targetTableId;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else if (onOpenImport) {
      onOpenImport(targetTableId);
    }
  };

  // 選択中のファイルアイテム (固定枠: sys-slots, 日課: sys-daily, 週次: sys-weekly, 表データ: table.id)
  const [selectedItemId, setSelectedItemId] = useState<string>(tables[0]?.id || 'sys-slots');

  // Plan22 テンプレートウィザードモーダル開閉
  const [isTemplateWizardOpen, setIsTemplateWizardOpen] = useState(false);

  const isSystemFile = selectedItemId.startsWith('sys-');

  // ファイル一覧サイドバーの開閉状態
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('imported_tables_sidebar_open');
      if (saved !== null) {
        return saved === 'true';
      }
      if (window.innerWidth < 768) {
        return false;
      }
    }
    return true;
  });

  // 表示モード（デスクトップ版 vs モバイル版）
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  // モバイル版専用: 設定ドロワーの開閉
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  // モバイル版専用: テーブル切り替えボトムシートの開閉（外部Propsと同期）
  const [internalIsMobileSwitcherOpen, setInternalIsMobileSwitcherOpen] = useState(false);
  const isMobileSwitcherOpen =
    externalIsMobileSwitcherOpen !== undefined
      ? externalIsMobileSwitcherOpen
      : internalIsMobileSwitcherOpen;
  const setIsMobileSwitcherOpen = (open: boolean) => {
    setInternalIsMobileSwitcherOpen(open);
    onMobileSwitcherOpenChange?.(open);
  };
  // モバイル版専用: テーブル名インライン編集用ステート
  const [editingMobileTableId, setEditingMobileTableId] = useState<string | null>(null);
  const [mobileTempTableName, setMobileTempTableName] = useState<string>('');
  const [isEditingMobileHeaderName, setIsEditingMobileHeaderName] = useState(false);

  const handleSaveMobileTableName = (tableId: string) => {
    const trimmed = mobileTempTableName.trim();
    if (trimmed) {
      const updated = tables.map((t) => (t.id === tableId ? { ...t, name: trimmed } : t));
      onTablesChange(updated);
      if (activeTable && activeTable.id === tableId) {
        updateActiveTable((prev) => ({ ...prev, name: trimmed }));
      }
    }
    setEditingMobileTableId(null);
    setIsEditingMobileHeaderName(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_table_view_mode');
      if (saved === 'desktop' || saved === 'mobile') {
        setViewMode(saved);
      } else if (window.innerWidth < 768) {
        setViewMode('mobile');
      }
    }
  }, []);

  // モバイル版に切り替わった際はデスクトップサイドバーを閉じてオーバーレイの残存を防ぐ
  useEffect(() => {
    if (viewMode === 'mobile') {
      setIsSidebarOpen(false);
    }
  }, [viewMode]);

  const handleToggleViewMode = (mode: 'desktop' | 'mobile') => {
    setViewMode(mode);
    try {
      localStorage.setItem('app_table_view_mode', mode);
    } catch {
      // ignore
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('imported_tables_sidebar_open', String(next));
      }
      return next;
    });
  };

  // アイテム選択時（スマホではドロワーを閉じる）
  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    setIsEditingName(false);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Escキーでドロワーを閉じる (スマホ展開時)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        isSidebarOpen &&
        typeof window !== 'undefined' &&
        window.innerWidth < 768
      ) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // 検索クエリ（エクスプローラー風ファイル検索）
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase();
    return tables.filter((t) => t.name.toLowerCase().includes(q));
  }, [tables, searchQuery]);

  const activeTable = useMemo(() => {
    return tables.find((t) => t.id === selectedItemId) || tables[0];
  }, [tables, selectedItemId]);

  // 現在開いているデータ名（フッターやヘッダー用）
  const currentActiveDataName = useMemo(() => {
    if (isSystemFile) {
      if (selectedItemId === 'sys-slots') return '固定枠';
      if (selectedItemId === 'sys-daily') return '今日のタスク';
      return '今週のタスク';
    }
    return activeTable?.name || '表データ';
  }, [isSystemFile, selectedItemId, activeTable]);

  useEffect(() => {
    onActiveDataNameChange?.(currentActiveDataName);
  }, [currentActiveDataName, onActiveDataNameChange]);

  // テーブル名編集モーダル/ステート
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTableName, setTempTableName] = useState('');

  const handleSaveTableName = () => {
    const trimmed = tempTableName.trim();
    if (trimmed && activeTable) {
      updateActiveTable((prev) => ({
        ...prev,
        name: trimmed,
        updatedAt: new Date().toISOString(),
      }));
      const updated = tables.map((t) => (t.id === activeTable.id ? { ...t, name: trimmed } : t));
      onTablesChange(updated);
    }
    setIsEditingName(false);
  };

  // 低優先度設定バー（詳細設定）の開閉
  const [showLowPrioritySettings, setShowLowPrioritySettings] = useState(false);

  // 今週の月〜日の「日付（曜日）」選択肢を生成 (0: 月曜 〜 6: 日曜)
  const weekDateOptions = useMemo(() => {
    const now = new Date();
    const jsDay = now.getDay(); // 0=日, 1=月, ..., 6=土
    const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const dayNames = ['月', '火', '水', '木', '金', '土', '日'];
    return dayNames.map((dayName, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const m = d.getMonth() + 1;
      const date = d.getDate();
      const yyyy = d.getFullYear();
      const mm = String(m).padStart(2, '0');
      const dd = String(date).padStart(2, '0');
      return {
        dayIndex: idx,
        dateStr: `${yyyy}-${mm}-${dd}`,
        shortDate: `${m}/${date}`,
        dayName,
        label: `${m}/${date} (${dayName})`,
      };
    });
  }, []);

  // セル編集ステート
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [cellEditText, setCellEditText] = useState('');
  const [cellBreakMinutes, setCellBreakMinutes] = useState<number>(0);
  const [cellCustomDuration, setCellCustomDuration] = useState<number>(0);
  const [cellHasCustomTime, setCellHasCustomTime] = useState<boolean>(false);
  const [cellCustomStartTime, setCellCustomStartTime] = useState<string>('07:00');
  const [cellUrl, setCellUrl] = useState<string>('');
  const [cellAttachedEnabled, setCellAttachedEnabled] = useState<boolean>(false);
  const [cellAttachedDuration, setCellAttachedDuration] = useState<number>(15);
  const [cellAttachedAllowSplit, setCellAttachedAllowSplit] = useState<boolean>(false);
  const [cellAttachedSplitCount, setCellAttachedSplitCount] = useState<number>(2);
  const [cellAttachedMinSplit, setCellAttachedMinSplit] = useState<number>(15);

  // コマのコピー・ペースト用ステート（Plan23）
  const [copiedCellData, setCopiedCellData] = useState<{
    text: string;
    breakMinutes: number;
    customDurationMinutes?: number;
    customStartTime?: string;
    hasCustomTime?: boolean;
    url?: string;
    attachedEnabled: boolean;
    attachedDuration: number;
    attachedAllowSplit: boolean;
    attachedSplitCount: number;
    attachedMinSplit: number;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [copiedDirectKey, setCopiedDirectKey] = useState<string | null>(null);
  const [pastedDirectKey, setPastedDirectKey] = useState<string | null>(null);

  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  // テーブル更新ヘルパー
  const updateActiveTable = (updater: (prev: ImportedTableData) => ImportedTableData) => {
    if (!activeTable) return;
    const nextTable = updater(activeTable);
    const updated = tables.map((t) => (t.id === activeTable.id ? nextTable : t));
    onTablesChange(updated);

    // もし計画表に反映中のテーブルであれば、固定枠 & タスクも自動再同期（既存のON/OFF状態 enabled を保持）
    if (isTableApplied(nextTable)) {
      const { slots: newSlots, tasks: newTasks } = generateScheduleItemsForTable(nextTable);

      const prevSlotEnabledMap = new Map<string, boolean | undefined>();
      fixedSlots.forEach((s) => {
        if (s.sourceTableId === nextTable.id || s.id.startsWith(`slot-table-${nextTable.id}-`)) {
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
          s.sourceTableId !== nextTable.id &&
          !s.id.startsWith(`slot-table-${nextTable.id}-`) &&
          !s.id.startsWith(`slot-lecture-${nextTable.id}-`) &&
          !(nextTable.appliedSlotIds && nextTable.appliedSlotIds.includes(s.id)),
      );
      onSlotsChange([...filteredSlots, ...mergedNewSlots]);

      const prevTaskEnabledMap = new Map<string, boolean | undefined>();
      tasks.forEach((t) => {
        if (
          t.sourceTableId === nextTable.id ||
          t.id.startsWith(`task-table-${nextTable.id}-`) ||
          t.id.startsWith(`task-attached-${nextTable.id}-`)
        ) {
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
          t.sourceTableId !== nextTable.id &&
          !t.id.startsWith(`task-table-${nextTable.id}-`) &&
          !t.id.startsWith(`task-attached-${nextTable.id}-`) &&
          !t.id.startsWith(`task-assignment-${nextTable.id}-`) &&
          !(nextTable.appliedTaskIds && nextTable.appliedTaskIds.includes(t.id)),
      );
      onTasksChange([...filteredTasks, ...mergedNewTasks]);
    }
  };

  // 時限時間の計算
  const periodTimes = activeTable
    ? calculatePeriodTimes(activeTable.numRows, activeTable.axisConfig)
    : [];

  // 各アイテムの反映ON/OFF判定
  const isSlotsApplied = inclusionSettings?.enableSlots ?? true;
  const isDailyApplied = inclusionSettings?.enableDailyTasks ?? true;
  const isWeeklyApplied = inclusionSettings?.enableWeeklyTasks ?? true;

  // table の反映判定
  const isTableApplied = (table: ImportedTableData): boolean => {
    if (table.isApplied !== undefined) return table.isApplied;
    if (table.appliedSlotIds && table.appliedSlotIds.length > 0) return true;
    if (table.appliedTaskIds && table.appliedTaskIds.length > 0) return true;
    return (
      fixedSlots.some((s) => s.sourceTableId === table.id) ||
      tasks.some((t) => t.sourceTableId === table.id)
    );
  };

  const isCurrentItemApplied = useMemo(() => {
    if (selectedItemId === 'sys-slots') return isSlotsApplied;
    if (selectedItemId === 'sys-daily') return isDailyApplied;
    if (selectedItemId === 'sys-weekly') return isWeeklyApplied;
    if (activeTable) return isTableApplied(activeTable);
    return false;
  }, [
    selectedItemId,
    isSlotsApplied,
    isDailyApplied,
    isWeeklyApplied,
    activeTable,
    fixedSlots,
    tasks,
  ]);

  // テーブル反映トグル切り替え (Plan7: 固定枠 / 日課タスク / 週次タスク / 付随タスク対応)
  const handleToggleTableApply = (table: ImportedTableData) => {
    const currentlyApplied = isTableApplied(table);

    if (currentlyApplied) {
      // 解除 (OFF)
      const nextSlots = fixedSlots.filter(
        (s) =>
          s.sourceTableId !== table.id &&
          !s.id.startsWith(`slot-table-${table.id}-`) &&
          !s.id.startsWith(`slot-lecture-${table.id}-`) &&
          !(table.appliedSlotIds && table.appliedSlotIds.includes(s.id)),
      );
      onSlotsChange(nextSlots);

      const nextTasks = tasks.filter(
        (t) =>
          t.sourceTableId !== table.id &&
          !t.id.startsWith(`task-table-${table.id}-`) &&
          !t.id.startsWith(`task-attached-${table.id}-`) &&
          !t.id.startsWith(`task-assignment-${table.id}-`) &&
          !(table.appliedTaskIds && table.appliedTaskIds.includes(t.id)),
      );
      onTasksChange(nextTasks);

      const updated = tables.map((t) =>
        t.id === table.id ? { ...t, isApplied: false, appliedSlotIds: [], appliedTaskIds: [] } : t,
      );
      onTablesChange(updated);

      // このテーブル由来のブロックIDをローカルストレージの完了・未完了リストからもクリーンアップ
      try {
        const savedCompleted = localStorage.getItem('app_completed_block_ids');
        if (savedCompleted) {
          const ids: string[] = JSON.parse(savedCompleted);
          const filtered = ids.filter((id) => !id.includes(table.id));
          localStorage.setItem('app_completed_block_ids', JSON.stringify(filtered));
        }
        const savedUncompleted = localStorage.getItem('app_uncompleted_block_ids');
        if (savedUncompleted) {
          const ids: string[] = JSON.parse(savedUncompleted);
          const filtered = ids.filter((id) => !id.includes(table.id));
          localStorage.setItem('app_uncompleted_block_ids', JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }

      setApplySuccessMsg(`「${table.name}」の反映を解除しました`);
      setTimeout(() => setApplySuccessMsg(null), 3000);
    } else {
      // 反映 (ON)
      const {
        slots: newSlots,
        tasks: newTasks,
        slotIds,
        taskIds,
      } = generateScheduleItemsForTable(table);

      if (newSlots.length === 0 && newTasks.length === 0) {
        alert('有効なコマがありません。セルに内容を入力するか、列の曜日定義をご確認ください。');
        return;
      }

      // 既存の同一テーブル由来スロット・タスクを除去して追加
      const filteredSlots = fixedSlots.filter(
        (s) =>
          s.sourceTableId !== table.id &&
          !s.id.startsWith(`slot-table-${table.id}-`) &&
          !s.id.startsWith(`slot-lecture-${table.id}-`) &&
          !(table.appliedSlotIds && table.appliedSlotIds.includes(s.id)),
      );
      onSlotsChange([...filteredSlots, ...newSlots]);

      const filteredTasks = tasks.filter(
        (t) =>
          t.sourceTableId !== table.id &&
          !t.id.startsWith(`task-table-${table.id}-`) &&
          !t.id.startsWith(`task-attached-${table.id}-`) &&
          !t.id.startsWith(`task-assignment-${table.id}-`) &&
          !(table.appliedTaskIds && table.appliedTaskIds.includes(t.id)),
      );
      onTasksChange([...filteredTasks, ...newTasks]);

      const updated = tables.map((t) =>
        t.id === table.id
          ? {
              ...t,
              isApplied: true,
              appliedSlotIds: slotIds,
              appliedTaskIds: taskIds,
              updatedAt: new Date().toISOString(),
            }
          : t,
      );
      onTablesChange(updated);

      const totalItems = newSlots.length + newTasks.length;
      setApplySuccessMsg(`「${table.name}」を計画表に反映しました（${totalItems}件）`);
      setTimeout(() => setApplySuccessMsg(null), 3500);
    }
  };

  // 全体反映トグル切り替え
  const handleToggleCurrentApplied = () => {
    if (selectedItemId === 'sys-slots') {
      const next = !isSlotsApplied;
      onInclusionSettingsChange?.({
        enableSlots: next,
        enableDailyTasks: isDailyApplied,
        enableWeeklyTasks: isWeeklyApplied,
      });
      setApplySuccessMsg(
        next ? '生活リズム枠を計画表に反映しました' : '生活リズム枠の反映を解除しました',
      );
      setTimeout(() => setApplySuccessMsg(null), 3000);
    } else if (selectedItemId === 'sys-daily') {
      const next = !isDailyApplied;
      onInclusionSettingsChange?.({
        enableSlots: isSlotsApplied,
        enableDailyTasks: next,
        enableWeeklyTasks: isWeeklyApplied,
      });
      setApplySuccessMsg(
        next ? '日課タスクを計画表に反映しました' : '日課タスクの反映を解除しました',
      );
      setTimeout(() => setApplySuccessMsg(null), 3000);
    } else if (selectedItemId === 'sys-weekly') {
      const next = !isWeeklyApplied;
      onInclusionSettingsChange?.({
        enableSlots: isSlotsApplied,
        enableDailyTasks: isDailyApplied,
        enableWeeklyTasks: next,
      });
      setApplySuccessMsg(
        next ? '週次タスクを計画表に反映しました' : '週次タスクの反映を解除しました',
      );
      setTimeout(() => setApplySuccessMsg(null), 3000);
    } else if (activeTable) {
      handleToggleTableApply(activeTable);
    }
  };

  // 横軸（列ヘッダーの変更）
  const handleColHeaderChange = (colIdx: number, newHeader: string) => {
    updateActiveTable((prev) => {
      const nextColHeaders = [...prev.colHeaders];
      nextColHeaders[colIdx] = newHeader;

      const parsed = parseColHeader(newHeader, colIdx);
      const dayValue =
        parsed.type === 'weekday' && parsed.dayIndex !== undefined
          ? parsed.dayIndex
          : colIdx < 7
            ? colIdx
            : 0;

      // セル側のdayIndexも更新
      const nextCells = prev.cells.map((row) =>
        row.map((cell, c) => (c === colIdx ? { ...cell, dayIndex: dayValue } : cell)),
      );

      return {
        ...prev,
        colHeaders: nextColHeaders,
        cells: nextCells,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  // 周期の頭（開始日・曜日 0=月〜6=日）の変更ハンドラー（表データは一律で周期管理）
  const handleCycleStartDayChange = (nextDayIndex: number) => {
    const safeDay = ((nextDayIndex % 7) + 7) % 7;
    const option = weekDateOptions[safeDay];
    updateActiveTable((prev) => {
      const cycled = setTableColumnMode(prev, 'cycle');
      return {
        ...cycled,
        columnMode: 'cycle',
        cycleStartDay: safeDay,
        cycleStartDate: option?.dateStr,
        updatedAt: new Date().toISOString(),
      };
    });
    if (option) {
      setApplySuccessMsg(`周期の頭を「${option.label}」に設定しました`);
      setTimeout(() => setApplySuccessMsg(null), 2500);
    }
  };

  // 縦軸（基本ルール一括設定）の変更
  const handleAxisConfigChange = (
    key: keyof ImportedTableData['axisConfig'],
    value: string | number | boolean | null,
  ) => {
    updateActiveTable((prev) => {
      const nextConfig = {
        ...prev.axisConfig,
        [key]: value,
      };

      // 新しい設定に基づいて各時限の開始・終了分を再計算
      const recalculatedTimes = calculatePeriodTimes(prev.numRows, nextConfig);

      // 各セルへ時間を反映
      const nextCells = prev.cells.map((row, r) => {
        const timeSlot = recalculatedTimes[r];
        return row.map((cell) => ({
          ...cell,
          startMinutes: timeSlot ? timeSlot.startMinutes : cell.startMinutes,
          endMinutes: timeSlot ? timeSlot.endMinutes : cell.endMinutes,
        }));
      });

      // startTime の変更に応じて placementMode を適切に連動
      let nextPlacementMode = prev.placementMode;
      if (key === 'startTime') {
        if (!value) {
          nextPlacementMode = 'auto';
        } else if (prev.placementMode === 'auto' && !prev.axisConfig.endTime) {
          nextPlacementMode = 'fixed';
        }
      }

      return {
        ...prev,
        placementMode: nextPlacementMode,
        axisConfig: nextConfig,
        cells: nextCells,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  // 時限個別カスタム時間の変更
  const handleCustomRowTimeChange = (
    periodIndex: number,
    field: 'start' | 'end',
    timeStr: string,
  ) => {
    const minutes = timeStringToMinutes(timeStr);
    updateActiveTable((prev) => {
      const curCustom = prev.axisConfig.customRowTimes || {};
      const currentPeriod = periodTimes.find((p) => p.periodIndex === periodIndex);
      const curStart = curCustom[periodIndex]?.startMinutes ?? currentPeriod?.startMinutes ?? 540;
      const curEnd = curCustom[periodIndex]?.endMinutes ?? currentPeriod?.endMinutes ?? 630;

      const nextCustom = {
        ...curCustom,
        [periodIndex]: {
          startMinutes: field === 'start' ? minutes : curStart,
          endMinutes: field === 'end' ? minutes : curEnd,
        },
      };

      const nextConfig = {
        ...prev.axisConfig,
        customRowTimes: nextCustom,
      };

      const recalculatedTimes = calculatePeriodTimes(prev.numRows, nextConfig);
      const nextCells = prev.cells.map((row, r) => {
        const timeSlot = recalculatedTimes[r];
        return row.map((cell) => ({
          ...cell,
          startMinutes: timeSlot ? timeSlot.startMinutes : cell.startMinutes,
          endMinutes: timeSlot ? timeSlot.endMinutes : cell.endMinutes,
        }));
      });

      return {
        ...prev,
        axisConfig: nextConfig,
        cells: nextCells,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  // 時限個別カスタム時間のリセット
  const handleResetCustomRowTime = (periodIndex: number) => {
    updateActiveTable((prev) => {
      if (!prev.axisConfig.customRowTimes) return prev;
      const nextCustom = { ...prev.axisConfig.customRowTimes };
      delete nextCustom[periodIndex];

      const nextConfig = {
        ...prev.axisConfig,
        customRowTimes: nextCustom,
      };

      const recalculatedTimes = calculatePeriodTimes(prev.numRows, nextConfig);
      const nextCells = prev.cells.map((row, r) => {
        const timeSlot = recalculatedTimes[r];
        return row.map((cell) => ({
          ...cell,
          startMinutes: timeSlot ? timeSlot.startMinutes : cell.startMinutes,
          endMinutes: timeSlot ? timeSlot.endMinutes : cell.endMinutes,
        }));
      });

      return {
        ...prev,
        axisConfig: nextConfig,
        cells: nextCells,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  // セル編集
  const handleStartEditCell = (r: number, c: number) => {
    if (!activeTable) return;
    const cell = activeTable.cells[r][c];
    setEditingCell({ r, c });
    setCellEditText(cell.text || cell.title || '');
    setCellBreakMinutes(cell.breakMinutes || 0);

    // 表の設定から算出したコマのデフォルト所要時間（分）
    const cellDefaultPeriod = getCellDefaultDuration(activeTable, r, c, periodTimes);
    // デフォルトで表の設定を参照して所要時間を入力
    setCellCustomDuration(cell.customDurationMinutes || cellDefaultPeriod);

    // 表の設定から算出したコマのデフォルト開始時刻（"HH:mm"）
    const { startTime: defaultStartTime, hasExplicitTime } = getCellDefaultStartTime(
      activeTable,
      r,
      c,
      periodTimes,
    );
    // デフォルトで表の設定を参照して開始時刻を入力
    setCellCustomStartTime(cell.customStartTime || defaultStartTime);
    setCellHasCustomTime(
      cell.hasCustomTime !== undefined ? cell.hasCustomTime : hasExplicitTime,
    );

    setCellUrl(cell.url || '');
    setCellAttachedEnabled(
      cell.attachedTask?.enabled ?? activeTable.attachedTaskConfig?.enabled ?? false,
    );
    setCellAttachedDuration(
      cell.attachedTask?.durationMinutes ||
        activeTable.attachedTaskConfig?.durationMinutes ||
        cellDefaultPeriod,
    );
    setCellAttachedAllowSplit(
      cell.attachedTask?.allowSplit ?? activeTable.attachedTaskConfig?.allowSplit ?? false,
    );
    setCellAttachedSplitCount(
      cell.attachedTask?.splitCount ?? activeTable.attachedTaskConfig?.splitCount ?? 2,
    );
    setCellAttachedMinSplit(
      cell.attachedTask?.minSplitMinutes ?? activeTable.attachedTaskConfig?.minSplitMinutes ?? 15,
    );
  };

  // コマ設定のコピー（Plan23: アイコンで操作）
  const handleCopyCell = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCopiedCellData({
      text: cellEditText,
      breakMinutes: cellBreakMinutes,
      customDurationMinutes: cellCustomDuration,
      customStartTime: cellCustomStartTime,
      hasCustomTime: cellHasCustomTime,
      url: cellUrl,
      attachedEnabled: cellAttachedEnabled,
      attachedDuration: cellAttachedDuration,
      attachedAllowSplit: cellAttachedAllowSplit,
      attachedSplitCount: cellAttachedSplitCount,
      attachedMinSplit: cellAttachedMinSplit,
    });
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  };

  // コマ設定の貼り付け（Plan23: アイコンで操作）
  const handlePasteCell = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!copiedCellData) return;
    setCellEditText(copiedCellData.text);
    setCellBreakMinutes(copiedCellData.breakMinutes);
    if (copiedCellData.customDurationMinutes !== undefined) {
      setCellCustomDuration(copiedCellData.customDurationMinutes);
    }
    if (copiedCellData.hasCustomTime !== undefined) {
      setCellHasCustomTime(copiedCellData.hasCustomTime);
      if (copiedCellData.customStartTime) {
        setCellCustomStartTime(copiedCellData.customStartTime);
      }
    }
    if (copiedCellData.url !== undefined) {
      setCellUrl(copiedCellData.url);
    }
    setCellAttachedEnabled(copiedCellData.attachedEnabled);
    setCellAttachedDuration(copiedCellData.attachedDuration);
    setCellAttachedAllowSplit(copiedCellData.attachedAllowSplit);
    setCellAttachedSplitCount(copiedCellData.attachedSplitCount);
    setCellAttachedMinSplit(copiedCellData.attachedMinSplit);
  };

  // コマ上から直接コピー（編集画面を開かずにワンタップでコピー）
  const handleCopyDirectCell = (r: number, c: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeTable) return;
    const cell = activeTable.cells[r][c];
    if (!cell.text && !cell.title) return;

    setCopiedCellData({
      text: cell.text || cell.title || '',
      breakMinutes: cell.breakMinutes || 0,
      customDurationMinutes: cell.customDurationMinutes || 0,
      customStartTime: cell.customStartTime,
      hasCustomTime: Boolean(cell.hasCustomTime || cell.customStartTime),
      url: cell.url || '',
      attachedEnabled: cell.attachedTask?.enabled ?? false,
      attachedDuration: cell.attachedTask?.durationMinutes ?? 15,
      attachedAllowSplit: cell.attachedTask?.allowSplit ?? false,
      attachedSplitCount: cell.attachedTask?.splitCount ?? 2,
      attachedMinSplit: cell.attachedTask?.minSplitMinutes ?? 15,
    });
    setCopiedDirectKey(`${r}-${c}`);
    setTimeout(() => setCopiedDirectKey(null), 1200);
  };

  // コマ上から直接貼り付け（編集画面を開かずにワンタップでペースト＆自動ソート）
  const handlePasteDirectCell = (r: number, c: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeTable || !copiedCellData) return;

    const trimmed = copiedCellData.text.trim();
    const lines = trimmed ? trimmed.split('\n') : [];
    const title = lines[0] || '';
    const roomOrNote = lines.slice(1).join('\n');

    updateActiveTable((prev) => {
      const nextCells = prev.cells.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          if (rIdx === r && cIdx === c) {
            return {
              ...cell,
              text: trimmed ? trimmed : null,
              title,
              roomOrNote,
              fullText: trimmed,
              rawLines: lines,
              breakMinutes: copiedCellData.breakMinutes > 0 ? copiedCellData.breakMinutes : undefined,
              customDurationMinutes:
                copiedCellData.customDurationMinutes && copiedCellData.customDurationMinutes > 0
                  ? copiedCellData.customDurationMinutes
                  : undefined,
              customStartTime:
                copiedCellData.hasCustomTime && copiedCellData.customStartTime
                  ? copiedCellData.customStartTime
                  : undefined,
              hasCustomTime: copiedCellData.hasCustomTime,
              url: copiedCellData.url && copiedCellData.url.trim() ? copiedCellData.url.trim() : undefined,
              attachedTask: copiedCellData.attachedEnabled
                ? {
                    enabled: true,
                    title:
                      cell.attachedTask?.title ||
                      prev.attachedTaskConfig?.titleTemplate ||
                      '{title} のタスク',
                    durationMinutes: copiedCellData.attachedDuration,
                    allowSplit: copiedCellData.attachedAllowSplit,
                    splitCount: copiedCellData.attachedSplitCount,
                    minSplitMinutes: copiedCellData.attachedMinSplit,
                  }
                : undefined,
            };
          }
          return cell;
        }),
      );
      const nextTable: ImportedTableData = {
        ...prev,
        cells: nextCells,
        updatedAt: new Date().toISOString(),
      };
      return sortRowsByTime(nextTable);
    });

    setPastedDirectKey(`${r}-${c}`);
    setTimeout(() => setPastedDirectKey(null), 1200);
  };

  const handleSaveEditCell = () => {
    if (!editingCell) return;
    const { r, c } = editingCell;
    const trimmed = cellEditText.trim();
    const lines = trimmed ? trimmed.split('\n') : [];
    const title = lines[0] || '';
    const roomOrNote = lines.slice(1).join('\n');

    updateActiveTable((prev) => {
      const nextCells = prev.cells.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          if (rIdx === r && cIdx === c) {
            return {
              ...cell,
              text: trimmed ? trimmed : null,
              title,
              roomOrNote,
              fullText: trimmed,
              rawLines: lines,
              breakMinutes: cellBreakMinutes > 0 ? cellBreakMinutes : undefined,
              customDurationMinutes: cellCustomDuration > 0 ? cellCustomDuration : undefined,
              customStartTime: cellHasCustomTime && cellCustomStartTime ? cellCustomStartTime : undefined,
              hasCustomTime: cellHasCustomTime,
              url: cellUrl.trim() ? cellUrl.trim() : undefined,
              attachedTask: cellAttachedEnabled
                ? {
                    enabled: true,
                    title:
                      cell.attachedTask?.title ||
                      activeTable.attachedTaskConfig?.titleTemplate ||
                      '{title} のタスク',
                    durationMinutes: cellAttachedDuration,
                    allowSplit: cellAttachedAllowSplit,
                    splitCount: cellAttachedSplitCount,
                    minSplitMinutes: cellAttachedMinSplit,
                  }
                : undefined,
            };
          }
          return cell;
        }),
      );
      const nextTable: ImportedTableData = {
        ...prev,
        cells: nextCells,
        updatedAt: new Date().toISOString(),
      };
      // 保存時に開始時間順に自動並び替え（Plan23）
      return sortRowsByTime(nextTable);
    });

    setEditingCell(null);
  };

  // セルのクリア
  const handleClearCell = (r: number, c: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    updateActiveTable((prev) => {
      const nextCells = prev.cells.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          if (rIdx === r && cIdx === c) {
            return {
              ...cell,
              text: null,
              title: '',
              roomOrNote: '',
              fullText: '',
              rawLines: [],
            };
          }
          return cell;
        }),
      );
      return {
        ...prev,
        cells: nextCells,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  // 新規テーブル作成（空テーブル・一律周期管理）
  // CSV形式としてクリップボードへコピー
  const handleCopyCsv = () => {
    if (!activeTable) return;
    const matrix: (string | null)[][] = activeTable.cells.map((row) =>
      row.map((cell) => (cell.text ? cell.text : null)),
    );
    const csvContent = matrixToCsv(matrix, activeTable.colHeaders, activeTable.rowHeaders);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(csvContent);
      setApplySuccessMsg('CSV形式でクリップボードへコピーしました');
      setTimeout(() => setApplySuccessMsg(null), 2500);
    }
  };

  const handleAddNewTable = () => {
    const newId = `table-${Date.now()}`;
    const newTable: ImportedTableData = {
      id: newId,
      name: `新しい表 ${tables.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placementMode: 'fixed',
      columnMode: 'cycle',
      cycleStartDay: 0,
      cycleStartDate: weekDateOptions[0]?.dateStr,
      dailyRepeatCount: 'auto',
      weeklyRepeatCount: 'auto',
      weeklyTaskExpiryWeeks: 1,
      isApplied: false,
      numRows: 5,
      numCols: 5,
      colHeaders: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
      rowHeaders: ['1', '2', '3', '4', '5'],
      colorIndex: tables.length % TABLE_PALETTE_OPTIONS.length,
      axisConfig: {
        startTime: '09:00',
        endTime: '18:00',
        periodMinutes: 90,
        intervalMinutes: 10,
        hasLunch: true,
        lunchAfterPeriod: 2,
        lunchMinutes: 50,
        weeklyTaskExpiryWeeks: 1,
      },
      cells: Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => ({
          dayIndex: c,
          periodIndex: r + 1,
          text: null,
          title: '',
          roomOrNote: '',
          fullText: '',
          rawLines: [],
          startMinutes: 540 + r * 100,
          endMinutes: 630 + r * 100,
        })),
      ),
    };
    onTablesChange([...tables, newTable]);
    setSelectedItemId(newId);
  };

  // テーブルの削除
  const handleDeleteTable = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tables.length <= 1) {
      alert('最後の1件は削除できません。');
      return;
    }
    const targetTable = tables.find((t) => t.id === id);
    if (confirm(`この読み込みデータ「${targetTable?.name}」を削除しますか？`)) {
      if (targetTable) {
        // 反映されていたスロットやタスクを解除
        const slotIdsToRemove = new Set(targetTable.appliedSlotIds || []);
        const taskIdsToRemove = new Set(targetTable.appliedTaskIds || []);
        if (slotIdsToRemove.size > 0) {
          onSlotsChange(fixedSlots.filter((s) => !slotIdsToRemove.has(s.id) && !s.id.includes(id)));
        }
        if (taskIdsToRemove.size > 0) {
          onTasksChange(tasks.filter((t) => !taskIdsToRemove.has(t.id) && !t.id.includes(id)));
        }

        // localStorageの完了/未完了IDをクリーンアップ
        try {
          const savedCompleted = localStorage.getItem('app_completed_block_ids');
          if (savedCompleted) {
            const ids: string[] = JSON.parse(savedCompleted);
            const filtered = ids.filter((bId) => !bId.includes(id));
            localStorage.setItem('app_completed_block_ids', JSON.stringify(filtered));
          }
          const savedUncompleted = localStorage.getItem('app_uncompleted_block_ids');
          if (savedUncompleted) {
            const ids: string[] = JSON.parse(savedUncompleted);
            const filtered = ids.filter((bId) => !bId.includes(id));
            localStorage.setItem('app_uncompleted_block_ids', JSON.stringify(filtered));
          }
        } catch {
          // ignore
        }
      }

      const filtered = tables.filter((t) => t.id !== id);
      onTablesChange(filtered);
      if (selectedItemId === id) {
        setSelectedItemId(filtered[0]?.id || 'sys-slots');
      }
    }
  };

  return (
    <div className="relative flex flex-1 min-h-0 w-full overflow-hidden rounded-none border-0 bg-white shadow-none">
      {/* スマホ用 ドロワー背景オーバーレイ (Backdrop: デスクトップ版かつサイドバー展開時のみ表示) */}
      {viewMode === 'desktop' && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className={`absolute inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${
            isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden="true"
        />
      )}

      {/* ========================================================
          Left Sidebar: データファイル一覧（デスクトップ版でのみ表示）
          - スマホ/モバイル版ではヘッダーの「表切替」ピルからボトムシートで操作
          - PC/デスクトップ版ではインライン relative 配置
          ======================================================== */}
      {viewMode === 'desktop' && (
        <aside
          className={`shrink-0 flex flex-col h-full border-r border-slate-200 bg-slate-50 select-none transition-all duration-200 ease-in-out ${
            isSidebarOpen
              ? 'absolute inset-y-0 left-0 z-40 w-72 max-w-[85vw] shadow-2xl translate-x-0 opacity-100 md:relative md:inset-auto md:z-auto md:w-64 lg:w-72 md:shadow-none'
              : 'absolute inset-y-0 left-0 z-40 w-72 max-w-[85vw] -translate-x-full opacity-0 pointer-events-none md:pointer-events-auto md:opacity-100 md:relative md:inset-auto md:z-auto md:w-[76px] md:shadow-none md:translate-x-0'
          }`}
        >
        <div className="flex flex-col h-full min-h-0 w-full">
          {/* Top Bar: ヘッダーを廃止し、折り畳みボタンと「ファイル名で検索」を並べて配置 */}
          {isSidebarOpen ? (
            <div className="shrink-0 flex items-center gap-1.5 border-b border-slate-200/80 bg-slate-100/70 p-2">
              <button
                onClick={toggleSidebar}
                title="バーを折りたたむ"
                className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-none border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>

              <div className="relative flex-1 min-w-0 flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ファイル名で検索..."
                  className="w-full rounded-none border border-slate-200 bg-white py-1 pl-8 pr-6 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500/20 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* 折りたたみ時: 幅を広げるボタンを中央配置 */
            <div className="shrink-0 p-2 border-b border-slate-200/80 bg-slate-100/70 flex items-center justify-center">
              <button
                onClick={toggleSidebar}
                title="ファイル一覧を展開する"
                className="flex h-7.5 w-7.5 items-center justify-center rounded-none border border-blue-200 bg-white text-blue-600 shadow-2xs hover:bg-blue-50 hover:border-blue-400 transition"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* File List (Explorer Item Rows) */}
          <div
            className={`flex-1 overflow-y-auto ${isSidebarOpen ? 'p-1.5 space-y-2' : 'p-1 space-y-1.5'}`}
          >
            {/* Section 1: 取り込み表データ (主要入力装置 / Primary Input) */}
            <div>
              <div
                className={`flex items-center justify-between ${
                  isSidebarOpen
                    ? 'px-2 py-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase'
                    : 'px-1 py-0.5 text-[9px] font-bold text-slate-500 justify-center uppercase tracking-tighter'
                }`}
              >
                <span>{isSidebarOpen ? '📊 表データ (主要入力)' : '表'}</span>
                {isSidebarOpen && (
                  <span className="font-mono text-slate-400">{filteredTables.length}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {/* 画面左の表データの一番上の項目: 「新しい表を追加」 */}
                <div
                  onClick={handleAddNewTable}
                  title="新しい表を追加"
                  className={`group relative flex items-center rounded-none border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/70 hover:border-blue-500 cursor-pointer transition select-none ${
                    isSidebarOpen
                      ? 'px-2.5 py-2 text-xs font-bold text-blue-700 shadow-2xs'
                      : 'px-1.5 py-1.5 text-xs justify-center text-blue-600 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none bg-blue-600 text-white shadow-2xs">
                      <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                    </div>
                    {isSidebarOpen && <span className="truncate">新しい表を追加</span>}
                  </div>
                </div>

                {filteredTables.length === 0 ? (
                  <div className="p-2 text-center text-[10px] text-slate-400">
                    {isSidebarOpen ? '該当する表がありません' : 'なし'}
                  </div>
                ) : (
                  filteredTables.map((t, index) => {
                    const isSelected = t.id === selectedItemId;
                    const dateStr = t.updatedAt
                      ? new Date(t.updatedAt).toLocaleDateString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                        })
                      : '';
                    const tColor = getTableColorSchemeByIndex(
                      t.colorIndex !== undefined ? t.colorIndex : index,
                    );

                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          handleSelectItem(t.id);
                        }}
                        title={t.name}
                        className={`group relative flex items-center rounded-none cursor-pointer transition ${
                          isSidebarOpen
                            ? 'justify-between px-2.5 py-2 text-xs'
                            : 'px-1.5 py-1.5 text-xs gap-1.5'
                        } ${
                          isSelected
                            ? 'bg-blue-100/80 text-blue-950 font-bold shadow-2xs border-l-3 border-l-blue-600'
                            : 'hover:bg-slate-200/50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                          <div
                            className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-sm"
                            style={{ color: tColor.strip }}
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                            <span
                              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-white"
                              style={{ backgroundColor: tColor.strip }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            {isSelected && isEditingName && isSidebarOpen ? (
                              <input
                                type="text"
                                value={tempTableName}
                                onChange={(e) => setTempTableName(e.target.value)}
                                onBlur={handleSaveTableName}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveTableName();
                                  if (e.key === 'Escape') setIsEditingName(false);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                                className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs text-blue-900 focus:outline-hidden"
                              />
                            ) : (
                              <div
                                className={`truncate leading-tight ${
                                  isSidebarOpen ? 'text-xs' : 'text-[11px] font-medium max-w-[42px]'
                                }`}
                              >
                                {t.name}
                              </div>
                            )}
                            {isSidebarOpen && (
                              <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono font-normal">
                                <span className="flex items-center gap-1.5">
                                  <span>
                                    {t.numRows}×{t.numCols} コマ
                                  </span>
                                  {dateStr && <span>{dateStr}</span>}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* オンオフトグル & アクション */}
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isTableApplied(t)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTableApply(t);
                            }}
                            title={`「${t.name}」の計画表への反映を${isTableApplied(t) ? 'オフ' : 'オン'}にする`}
                            className={`relative inline-flex ${
                              isSidebarOpen ? 'h-4 w-7' : 'h-3.5 w-6'
                            } shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              isTableApplied(t) ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block ${
                                isSidebarOpen ? 'h-3 w-3' : 'h-2.5 w-2.5'
                              } transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                isTableApplied(t)
                                  ? isSidebarOpen
                                    ? 'translate-x-3'
                                    : 'translate-x-2.5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </button>

                          {/* Actions (項目ごとの編集・削除アイコン) */}
                          {isSidebarOpen && (
                            <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition shrink-0 ml-1">
                              {isSelected && !isEditingName && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTempTableName(t.name);
                                    setIsEditingName(true);
                                  }}
                                  title="名前を変更"
                                  className="rounded p-1 text-slate-400 hover:bg-slate-200/80 hover:text-blue-600 transition cursor-pointer"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              )}
                              {tables.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteTable(t.id, e)}
                                  title={`「${t.name}」を削除`}
                                  className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Section 2: タスク管理 (各タスク・固定枠のON/OFF管理) */}
            <div className="pt-2 border-t border-slate-200">
              <div
                className={`${
                  isSidebarOpen
                    ? 'px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase'
                    : 'px-1 py-0.5 text-[9px] font-bold text-slate-400 text-center uppercase tracking-tighter'
                }`}
              >
                {isSidebarOpen ? '📋 タスク管理' : 'タスク'}
              </div>
              <div className="space-y-0.5">
                {/* 固定枠 */}
                {(!searchQuery.trim() ||
                  '固定枠 生活リズム 睡眠 講義 勤務 fixed'
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())) && (
                  <div
                    onClick={() => handleSelectItem('sys-slots')}
                    title="固定枠 (生活リズム)"
                    className={`group relative flex items-center rounded-none cursor-pointer transition ${
                      isSidebarOpen
                        ? 'justify-between px-2.5 py-2 text-xs'
                        : 'px-1.5 py-1.5 text-xs gap-1.5'
                    } ${
                      selectedItemId === 'sys-slots'
                        ? 'bg-blue-100/80 text-blue-950 font-bold shadow-2xs border-l-3 border-l-blue-600'
                        : 'hover:bg-slate-200/50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ${
                          selectedItemId === 'sys-slots' ? 'text-sky-700' : 'text-sky-600'
                        }`}
                      >
                        <Shield className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate leading-tight ${
                            isSidebarOpen ? 'text-xs' : 'text-[11px] font-medium max-w-[42px]'
                          }`}
                        >
                          固定枠
                        </div>
                        {isSidebarOpen && (
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>睡眠・講義・勤務等 ({fixedSlots.length}件)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* オンオフトグル */}
                    <div className="flex items-center shrink-0 ml-1">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isSlotsApplied}
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = !isSlotsApplied;
                          onInclusionSettingsChange?.({
                            enableSlots: next,
                            enableDailyTasks: isDailyApplied,
                            enableWeeklyTasks: isWeeklyApplied,
                          });
                          setApplySuccessMsg(
                            next
                              ? '生活リズム枠を計画表に反映しました'
                              : '生活リズム枠の反映を解除しました',
                          );
                          setTimeout(() => setApplySuccessMsg(null), 3000);
                        }}
                        title={`固定枠の計画表への反映を${isSlotsApplied ? 'オフ' : 'オン'}にする`}
                        className={`relative inline-flex ${
                          isSidebarOpen ? 'h-4 w-7' : 'h-3.5 w-6'
                        } shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isSlotsApplied ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block ${
                            isSidebarOpen ? 'h-3 w-3' : 'h-2.5 w-2.5'
                          } transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            isSlotsApplied
                              ? isSidebarOpen
                                ? 'translate-x-3'
                                : 'translate-x-2.5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* 今日用いられているタスク */}
                {(!searchQuery.trim() ||
                  '今日 日 日課 毎日 日次 ルーティン daily today'
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())) && (
                  <div
                    onClick={() => handleSelectItem('sys-daily')}
                    title="今日用いられているタスク一覧"
                    className={`group relative flex items-center rounded-none cursor-pointer transition ${
                      isSidebarOpen
                        ? 'justify-between px-2.5 py-2 text-xs'
                        : 'px-1.5 py-1.5 text-xs gap-1.5'
                    } ${
                      selectedItemId === 'sys-daily'
                        ? 'bg-blue-100/80 text-blue-950 font-bold shadow-2xs border-l-3 border-l-blue-600'
                        : 'hover:bg-slate-200/50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ${
                          selectedItemId === 'sys-daily' ? 'text-amber-600' : 'text-amber-500'
                        }`}
                      >
                        <Sun className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate leading-tight ${
                            isSidebarOpen ? 'text-xs' : 'text-[11px] font-medium max-w-[42px]'
                          }`}
                        >
                          {isSidebarOpen ? '📅 今日のタスク' : '今日'}
                        </div>
                        {isSidebarOpen && (
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>今日用いられているタスク</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* オンオフトグル */}
                    <div className="flex items-center shrink-0 ml-1">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isDailyApplied}
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = !isDailyApplied;
                          onInclusionSettingsChange?.({
                            enableSlots: isSlotsApplied,
                            enableDailyTasks: next,
                            enableWeeklyTasks: isWeeklyApplied,
                          });
                          setApplySuccessMsg(
                            next
                              ? '日課タスクを計画表に反映しました'
                              : '日課タスクの反映を解除しました',
                          );
                          setTimeout(() => setApplySuccessMsg(null), 3000);
                        }}
                        title={`今日のタスクの計画表への反映を${isDailyApplied ? 'オフ' : 'オン'}にする`}
                        className={`relative inline-flex ${
                          isSidebarOpen ? 'h-4 w-7' : 'h-3.5 w-6'
                        } shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isDailyApplied ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block ${
                            isSidebarOpen ? 'h-3 w-3' : 'h-2.5 w-2.5'
                          } transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            isDailyApplied
                              ? isSidebarOpen
                                ? 'translate-x-3'
                                : 'translate-x-2.5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* 今週用いられているタスク */}
                {(!searchQuery.trim() ||
                  '今週 週 週次 目標 周期 課題 todo weekly this week'
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())) && (
                  <div
                    onClick={() => handleSelectItem('sys-weekly')}
                    title="今週用いられているタスク一覧"
                    className={`group relative flex items-center rounded-none cursor-pointer transition ${
                      isSidebarOpen
                        ? 'justify-between px-2.5 py-2 text-xs'
                        : 'px-1.5 py-1.5 text-xs gap-1.5'
                    } ${
                      selectedItemId === 'sys-weekly'
                        ? 'bg-blue-100/80 text-blue-950 font-bold shadow-2xs border-l-3 border-l-blue-600'
                        : 'hover:bg-slate-200/50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ${
                          selectedItemId === 'sys-weekly' ? 'text-purple-700' : 'text-purple-600'
                        }`}
                      >
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate leading-tight ${
                            isSidebarOpen ? 'text-xs' : 'text-[11px] font-medium max-w-[42px]'
                          }`}
                        >
                          {isSidebarOpen ? '🗓️ 今週のタスク' : '今週'}
                        </div>
                        {isSidebarOpen && (
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>今週用いられているタスク ({tasks.length}件)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* オンオフトグル */}
                    <div className="flex items-center shrink-0 ml-1">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isWeeklyApplied}
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = !isWeeklyApplied;
                          onInclusionSettingsChange?.({
                            enableSlots: isSlotsApplied,
                            enableDailyTasks: isDailyApplied,
                            enableWeeklyTasks: next,
                          });
                          setApplySuccessMsg(
                            next
                              ? '週次タスクを計画表に反映しました'
                              : '週次タスクの反映を解除しました',
                          );
                          setTimeout(() => setApplySuccessMsg(null), 3000);
                        }}
                        title={`今週のタスクの計画表への反映を${isWeeklyApplied ? 'オフ' : 'オン'}にする`}
                        className={`relative inline-flex ${
                          isSidebarOpen ? 'h-4 w-7' : 'h-3.5 w-6'
                        } shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isWeeklyApplied ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block ${
                            isSidebarOpen ? 'h-3 w-3' : 'h-2.5 w-2.5'
                          } transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            isWeeklyApplied
                              ? isSidebarOpen
                                ? 'translate-x-3'
                                : 'translate-x-2.5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 隠しファイル選択 input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.txt,.csv,.md"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </aside>
      )}

      {/* ========================================================
          Right Main Area: プレビュー & 軸・インターバル定義詳細
          ======================================================== */}
      <main className="flex flex-1 min-w-0 w-full flex-col bg-white p-1.5 sm:p-2 gap-1.5 overflow-hidden min-h-0">
        {/* Top Header & Actions Bar (Desktop vs Mobile 分岐) */}
        {viewMode === 'mobile' ? (
          /* モバイル専用アプリ風ヘッダー (表データ・タスク管理共通) */
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-200 pb-2 px-0.5 overflow-hidden">
            {/* 左側: 表データ名表示 ＆ インライン編集（切り替えボタン廃止） */}
            <div className="flex items-center gap-1 min-w-0 flex-1 mr-1">
              {isSystemFile ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-xs text-slate-800 truncate">
                    {selectedItemId === 'sys-slots'
                      ? '📌 固定枠'
                      : selectedItemId === 'sys-daily'
                        ? '📅 日のタスク'
                        : '🗓️ 週のタスク'}
                  </span>
                </div>
              ) : activeTable ? (
                isEditingMobileHeaderName ? (
                  <div className="flex items-center gap-1 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={mobileTempTableName}
                      onChange={(e) => setMobileTempTableName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveMobileTableName(activeTable.id);
                        if (e.key === 'Escape') setIsEditingMobileHeaderName(false);
                      }}
                      autoFocus
                      className="h-7 flex-1 min-w-0 rounded-lg border border-blue-500 bg-white px-2 text-xs font-bold text-slate-900 focus:outline-hidden ring-1 ring-blue-300"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveMobileTableName(activeTable.id)}
                      className="h-7 px-2 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer shrink-0"
                      title="保存"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingMobileHeaderName(false)}
                      className="h-7 px-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
                      title="キャンセル"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      onClick={() => {
                        setMobileTempTableName(activeTable.name);
                        setIsEditingMobileHeaderName(true);
                      }}
                      className="font-bold text-xs sm:text-sm text-slate-900 truncate max-w-[140px] xs:max-w-[180px] cursor-pointer hover:text-blue-700"
                      title="タップして表データ名を編集"
                    >
                      {activeTable.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileTempTableName(activeTable.name);
                        setIsEditingMobileHeaderName(true);
                      }}
                      title="表データ名を編集"
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer shrink-0"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              ) : null}
            </div>

            {/* 右側アクション群: 周期のはじまり, 反映スイッチ, モード切替, ⚙️設定ボタン */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* 周期のはじまり (表データ選択時のみ表示・編集可能) */}
              {activeTable && !isSystemFile && (
                <div
                  className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/90 px-2 py-1 text-xs font-bold text-emerald-800 shadow-2xs"
                  title="周期のはじまり（Day 1）となる日付（曜日）を指定"
                >
                  <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <select
                    value={activeTable.cycleStartDay ?? 0}
                    onChange={(e) => handleCycleStartDayChange(Number(e.target.value))}
                    className="bg-transparent text-[11px] font-bold text-emerald-900 focus:outline-hidden cursor-pointer"
                  >
                    {weekDateOptions.map((opt) => (
                      <option key={opt.dayIndex} value={opt.dayIndex}>
                        {opt.label}〜
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 反映トグル (表データまたは固定枠の場合) */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">反映</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isCurrentItemApplied}
                  onClick={handleToggleCurrentApplied}
                  title={`計画表への反映を${isCurrentItemApplied ? 'オフ' : 'オン'}にする`}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                    isCurrentItemApplied ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      isCurrentItemApplied ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* モード切替（PC版へ） */}
              <button
                type="button"
                onClick={() => handleToggleViewMode('desktop')}
                title="デスクトップ版デザインに切り替え"
                className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-600 shadow-2xs transition cursor-pointer"
              >
                <Monitor className="h-4 w-4" />
              </button>

              {/* ⚙️ 設定ドロワー開閉ボタン (activeTable がある場合のみ表示) */}
              {activeTable && !isSystemFile && (
                <button
                  type="button"
                  onClick={() => setIsMobileSettingsOpen(true)}
                  title="時間割の詳細設定を開く"
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
                >
                  <Settings className="h-4 w-4" />
                  <span>設定</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* デスクトップ版ヘッダー (現行のファイルパス表示 ＋ モード切替) */
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            {/* Breadcrumb Path & Mobile Sidebar Toggle */}
            <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
              <button
                type="button"
                onClick={toggleSidebar}
                title="データ一覧バーを開く"
                aria-label="データ一覧バーを開く"
                className="flex md:hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-blue-600 transition active:scale-95"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>

              {isSystemFile ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-slate-600 shrink-0">タスク管理</span>
                  <span className="text-slate-300">/</span>
                  <span className="font-bold text-slate-900 truncate">
                    {selectedItemId === 'sys-slots'
                      ? '固定枠 (生活リズム)'
                      : selectedItemId === 'sys-daily'
                        ? '📅 今日用いられているタスク'
                        : '🗓️ 今週用いられているタスク'}
                  </span>
                </div>
              ) : activeTable ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-slate-600 shrink-0">取り込み表データ</span>
                  <span className="text-slate-300">/</span>
                  {isEditingName ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={tempTableName}
                        onChange={(e) => setTempTableName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTableName();
                          if (e.key === 'Escape') setIsEditingName(false);
                        }}
                        autoFocus
                        className="h-6 rounded border border-blue-500 bg-white px-1.5 text-xs font-bold text-slate-900 focus:outline-hidden ring-1 ring-blue-300 min-w-[140px]"
                      />
                      <button
                        type="button"
                        onClick={handleSaveTableName}
                        className="h-6 px-1.5 rounded bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center hover:bg-blue-700 transition cursor-pointer"
                        title="保存"
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingName(false)}
                        className="h-6 px-1.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center hover:bg-slate-200 transition cursor-pointer"
                        title="キャンセル"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        onClick={() => {
                          setTempTableName(activeTable.name);
                          setIsEditingName(true);
                        }}
                        className="font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[320px] cursor-pointer hover:text-blue-700"
                        title="クリックしてテーブル名を編集"
                      >
                        {activeTable.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTempTableName(activeTable.name);
                          setIsEditingName(true);
                        }}
                        title="テーブル名を編集"
                        className="ml-0.5 text-slate-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50 transition cursor-pointer"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      {tables.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTable(activeTable.id, e)}
                          title={`「${activeTable.name}」を削除`}
                          className="ml-0.5 text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0 text-slate-400">
                  <span>表が選択されていません</span>
                </div>
              )}
            </div>

            {/* 右側: モード切替 & 反映トグル */}
            <div className="flex items-center gap-2">
              {/* デスクトップ ⇔ モバイル 表示モード切替ボタングループ（文字なしアイコンのみ） */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleToggleViewMode('desktop')}
                  title="デスクトップ版レイアウトに切り替え"
                  className={`flex items-center justify-center rounded-md p-1.5 transition cursor-pointer ${
                    (viewMode as string) === 'desktop'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleViewMode('mobile')}
                  title="モバイル版（時間割アプリ風）レイアウトに切り替え"
                  className={`flex items-center justify-center rounded-md p-1.5 transition cursor-pointer ${
                    (viewMode as string) === 'mobile'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 計画表への反映 ON/OFF トグル */}
              {(isSystemFile || activeTable) && (
                <div className="flex items-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isCurrentItemApplied}
                    onClick={handleToggleCurrentApplied}
                    title={`計画表への反映を${isCurrentItemApplied ? 'オフ' : 'オン'}にする`}
                    className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                      isCurrentItemApplied ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        isCurrentItemApplied ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Area: システム基本ファイル or 取り込み表詳細 */}
        {isSystemFile ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <TaskManager
              tasks={tasks}
              onChange={onTasksChange}
              slots={fixedSlots}
              onSlotsChange={onSlotsChange}
              tables={tables}
              onNavigateToTimeline={onNavigateToTimeline}
              viewMode={
                selectedItemId === 'sys-slots'
                  ? 'slots'
                  : selectedItemId === 'sys-daily'
                    ? 'daily'
                    : 'weekly'
              }
              embedded
              isMobile={(viewMode as string) === 'mobile'}
            />
          </div>
        ) : !activeTable ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">読み込み表データがありません</p>
              <p className="mt-1 text-xs text-slate-400">
                左サイドバーの「新しい表を追加」または「画像やcsvから読み取り」から表を追加してください。
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleAddNewTable}
                  className="flex items-center gap-1 rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5 text-blue-600" />
                  <span>新しい表を追加</span>
                </button>
                <button
                  type="button"
                  onClick={handleTriggerFileSelect}
                  className="flex items-center gap-1 rounded-none border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 shadow-2xs transition active:scale-95"
                >
                  <Upload className="h-3.5 w-3.5 text-blue-600" />
                  <span>画像やcsvから読み取り</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
            {/* ========================================================
                Excel風 コンパクトツールバー (デスクトップ版でのみ表示)
                - モバイル版では右スライドイン設定ドロワーにすべて集約
                ======================================================== */}
            {viewMode === 'desktop' && (
              <div className="shrink-0 flex flex-col gap-1.5">
              {/* 高優先度メインバー（常時表示） */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-none border border-slate-200/90 bg-slate-50/95 px-2.5 py-1.5 text-xs text-slate-700 shadow-2xs">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* 0. テンプレートから設定（各表データ設定項目の先頭） */}
                  <button
                    type="button"
                    onClick={() => setIsTemplateWizardOpen(true)}
                    title="この表にテンプレート（日課・週次・固定枠）の設定を適用します"
                    className="flex items-center gap-1 rounded-none border border-indigo-300 bg-indigo-50/80 hover:bg-indigo-100 hover:border-indigo-500 px-2 py-0.5 text-[11px] font-bold text-indigo-700 shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="whitespace-nowrap">✨ テンプレートから設定</span>
                  </button>

                  {/* 1. 配置方法の選択（固定配置 / 自動配置） */}
                  {(() => {
                    const hasValidStartTime =
                      activeTable.axisConfig.startTime !== null &&
                      activeTable.axisConfig.startTime !== undefined &&
                      activeTable.axisConfig.startTime !== 'unset' &&
                      activeTable.axisConfig.startTime !== '未設定' &&
                      activeTable.axisConfig.startTime !== '自動' &&
                      activeTable.axisConfig.startTime !== 'auto';

                    const isFixed =
                      activeTable.placementMode === 'auto'
                        ? false
                        : activeTable.placementMode === 'fixed'
                          ? hasValidStartTime
                          : hasValidStartTime;

                    const currentMode: TablePlacementMode = isFixed ? 'fixed' : 'auto';

                    return (
                      <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                          配置:
                        </span>
                        <select
                          value={currentMode}
                          onChange={(e) => {
                            const nextMode = e.target.value as TablePlacementMode;
                            updateActiveTable((prev) => ({
                              ...prev,
                              placementMode: nextMode,
                            }));
                          }}
                          className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                          title="配置方法を選択（固定配置: 時間割のように固定枠として配置 / 自動配置: 空き枠・指定区間に自動配分）"
                        >
                          <option value="fixed">📌 固定</option>
                          <option value="auto">⚡ 自動</option>
                        </select>
                      </div>
                    );
                  })()}

                  {/* 2. 周期の頭（開始日・曜日: 月〜日） */}
                  <div className="flex items-center gap-1 rounded-none border border-emerald-200 bg-emerald-50/60 px-2 py-0.5 shadow-2xs">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 whitespace-nowrap">
                      周期の頭:
                    </span>
                    <select
                      value={activeTable.cycleStartDay ?? 0}
                      onChange={(e) => handleCycleStartDayChange(Number(e.target.value))}
                      className="text-[11px] font-bold text-emerald-900 bg-transparent focus:outline-hidden cursor-pointer"
                      title="周期の始まり（Day 1）となる日付（曜日）を月〜日から指定します"
                    >
                      {weekDateOptions.map((opt) => (
                        <option key={opt.dayIndex} value={opt.dayIndex}>
                          {opt.label}〜
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. 時間（開始 〜 終了上限時刻を一括設定） */}
                  <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      時間:
                    </span>
                    <input
                      type="time"
                      value={activeTable.axisConfig.startTime ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        handleAxisConfigChange('startTime', val ? val : null);
                      }}
                      title="開始時刻（未入力で自動）"
                      className="w-20 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                    />
                    <span className="text-slate-400 text-xs select-none">〜</span>
                    <input
                      type="time"
                      value={activeTable.axisConfig.endTime ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        handleAxisConfigChange('endTime', val ? val : null);
                      }}
                      title="終了上限時刻（未入力で自動）"
                      className="w-20 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                    />
                  </div>

                  {/* 4. 1コマ分数 */}
                  <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      1コマ:
                    </span>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        step={5}
                        value={
                          activeTable.axisConfig.periodMinutes !== null &&
                          activeTable.axisConfig.periodMinutes !== undefined
                            ? activeTable.axisConfig.periodMinutes
                            : ''
                        }
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (!val || val === '0') {
                            handleAxisConfigChange('periodMinutes', null);
                          } else {
                            const num = parseInt(val, 10);
                            handleAxisConfigChange(
                              'periodMinutes',
                              isNaN(num) || num <= 0 ? null : num,
                            );
                          }
                        }}
                        placeholder="自動"
                        title="1コマの分数（例: 90、未入力で自動）"
                        className="w-14 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                      />
                      <span className="text-[10px] text-slate-500 font-medium select-none">分</span>
                    </div>
                  </div>

                  {/* 5. コマ間休憩 */}
                  <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      休憩:
                    </span>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        step={5}
                        value={
                          activeTable.axisConfig.intervalMinutes === null ||
                          activeTable.axisConfig.intervalMinutes === undefined
                            ? ''
                            : activeTable.axisConfig.intervalMinutes
                        }
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '') {
                            handleAxisConfigChange('intervalMinutes', null);
                          } else {
                            const num = parseInt(val, 10);
                            handleAxisConfigChange(
                              'intervalMinutes',
                              isNaN(num) || num < 0 ? null : num,
                            );
                          }
                        }}
                        placeholder="自動"
                        title="コマ間の休憩分数（例: 10、0で休憩なし、未入力で自動）"
                        className="w-14 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                      />
                      <span className="text-[10px] text-slate-500 font-medium select-none">分</span>
                    </div>
                  </div>

                  {/* 行数・列数ステッパー */}
                  <div className="flex items-center gap-1.5 border-l border-slate-200 pl-1.5">
                    <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-1.5 py-0.5 shadow-2xs">
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                        行:
                      </span>
                      <div className="flex items-center border border-slate-200 rounded-none overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateActiveTable(removeRowFromTable)}
                          disabled={activeTable.numRows <= 1}
                          title="行を1つ減らす"
                          className="px-1 py-0.5 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={activeTable.numRows}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= 50) {
                              updateActiveTable((prev) => setTableNumRows(prev, val));
                            }
                          }}
                          className="w-7 text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="行数（直接入力またはボタンで増減）"
                        />
                        <button
                          type="button"
                          onClick={() => updateActiveTable(addRowToTable)}
                          disabled={activeTable.numRows >= 50}
                          title="行を1つ増やす"
                          className="px-1 py-0.5 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-1.5 py-0.5 shadow-2xs">
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                        列:
                      </span>
                      <div className="flex items-center border border-slate-200 rounded-none overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateActiveTable(removeColFromTable)}
                          disabled={activeTable.numCols <= 1}
                          title="列を1つ減らす"
                          className="px-1 py-0.5 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={activeTable.numCols}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= 30) {
                              updateActiveTable((prev) => setTableNumCols(prev, val));
                            }
                          }}
                          className="w-7 text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="列数（直接入力またはボタンで増減）"
                        />
                        <button
                          type="button"
                          onClick={() => updateActiveTable(addColToTable)}
                          disabled={activeTable.numCols >= 30}
                          title="列を1つ増やす"
                          className="px-1 py-0.5 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 7. 画像やcsvから読み取りボタン */}
                  <button
                    type="button"
                    onClick={() => handleTriggerFileSelect(activeTable.id)}
                    title={`「${activeTable.name}」に画像やCSVファイルから読み取ったデータを上書き反映します`}
                    className="flex items-center gap-1 rounded-none border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 shadow-2xs transition hover:bg-blue-100 hover:border-blue-400 active:scale-95 shrink-0"
                  >
                    <Upload className="h-3.5 w-3.5 text-blue-600" />
                    <span>画像やcsvから読み取り</span>
                  </button>

                  {/* 8. 詳細設定（低優先度バー）開閉ボタン */}
                  <button
                    type="button"
                    onClick={() => setShowLowPrioritySettings((prev) => !prev)}
                    className={`flex items-center gap-1 rounded-none border px-2 py-0.5 text-[11px] font-semibold transition shadow-2xs active:scale-95 ${
                      showLowPrioritySettings
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title="優先度の低い設定項目（分類表示・表の開始/終了時刻サマリー・昼休み・回数・有効期限・付随タスク等）を開閉します"
                  >
                    <Sliders className="h-3 w-3" />
                    <span>詳細設定</span>
                    {showLowPrioritySettings ? (
                      <ChevronUp className="h-3 w-3 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* 低優先度折りたたみ設定バー（必要時にユーザーが開く） */}
              {showLowPrioritySettings && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-none border border-blue-200/80 bg-blue-50/40 px-2.5 py-1.5 text-xs text-slate-700 shadow-2xs animate-in fade-in duration-150">
                  {/* 1. 現在分類の表示（低優先度） */}
                  {(() => {
                    const classification = getTableClassification(activeTable);
                    const label =
                      classification === 'fixed_slot'
                        ? '📌 固定枠'
                        : classification === 'daily_task'
                          ? '🏃 日課'
                          : '🎯 週次';

                    return (
                      <div
                        className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs select-none"
                        title={
                          classification === 'fixed_slot'
                            ? '固定枠: 決まった時間帯に配置されます'
                            : classification === 'daily_task'
                              ? '日課: 1日の中で反復配置されます'
                              : '週次: 週の中で配分されます'
                        }
                      >
                        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                          分類:
                        </span>
                        <span
                          className={`font-bold text-xs ${
                            classification === 'fixed_slot'
                              ? 'text-sky-700'
                              : classification === 'daily_task'
                                ? 'text-emerald-700'
                                : 'text-purple-700'
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* 2. 表の開始時刻と終了時刻の表示（計算サマリー） */}
                  {activeTable.axisConfig.startTime && periodTimes[0]?.startTime && (
                    <div
                      className="flex items-center gap-1 rounded-none bg-blue-100/70 border border-blue-200/70 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-900 shadow-2xs"
                      title="表のコマ長や休憩から計算された全体の開始時刻〜終了時刻"
                    >
                      <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="text-[10px] font-semibold text-blue-700">全体時間:</span>
                      <span>
                        {periodTimes[0]?.startTime} 〜{' '}
                        {periodTimes[periodTimes.length - 1]?.endTime}
                      </span>
                      <span className="text-[10px] font-normal text-blue-600">
                        ({activeTable.numRows}行)
                      </span>
                    </div>
                  )}

                  {/* 3. 1日の中の繰り返し回数 */}
                  <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                    <Repeat className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      1日:
                    </span>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={
                          activeTable.dailyRepeatCount === 'auto' ||
                          activeTable.dailyRepeatCount === undefined
                            ? ''
                            : activeTable.dailyRepeatCount
                        }
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (!val || val === '0') {
                            updateActiveTable((prev) => ({ ...prev, dailyRepeatCount: 'auto' }));
                          } else {
                            const num = parseInt(val, 10);
                            updateActiveTable((prev) => ({
                              ...prev,
                              dailyRepeatCount: isNaN(num) || num <= 0 ? 'auto' : num,
                            }));
                          }
                        }}
                        placeholder="自動"
                        title="1日の中での繰り返し回数（未入力で指定なし）"
                        className="w-12 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                      />
                      <span className="text-[10px] text-slate-500 font-medium select-none">回</span>
                    </div>
                  </div>

                  {/* 4. 週に入れる日ブロックの量 */}
                  <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                    <CalendarRange className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      週:
                    </span>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        min={1}
                        max={7}
                        value={
                          activeTable.weeklyRepeatCount === 'auto' ||
                          activeTable.weeklyRepeatCount === undefined
                            ? ''
                            : activeTable.weeklyRepeatCount
                        }
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (!val || val === '0') {
                            updateActiveTable((prev) => ({ ...prev, weeklyRepeatCount: 'auto' }));
                          } else {
                            const num = parseInt(val, 10);
                            updateActiveTable((prev) => ({
                              ...prev,
                              weeklyRepeatCount:
                                isNaN(num) || num <= 0 ? 'auto' : Math.min(7, num),
                            }));
                          }
                        }}
                        placeholder="自動"
                        title="週に入れる日ブロックの量（週何日行うか、未入力で指定なし）"
                        className="w-12 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                      />
                      <span className="text-[10px] text-slate-500 font-medium select-none">日</span>
                    </div>
                  </div>

                  {/* 5. 週タスク有効期限 */}
                  <div className="flex items-center gap-1 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                    <Hourglass className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      有効期限:
                    </span>
                    <select
                      value={
                        activeTable.weeklyTaskExpiryWeeks === 'none'
                          ? 'none'
                          : activeTable.weeklyTaskExpiryWeeks === 2
                            ? '2'
                            : '1'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        const expiry = val === 'none' ? 'none' : val === '2' ? 2 : 1;
                        updateActiveTable((prev) => ({
                          ...prev,
                          weeklyTaskExpiryWeeks: expiry,
                          axisConfig: { ...prev.axisConfig, weeklyTaskExpiryWeeks: expiry },
                        }));
                      }}
                      className="rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition cursor-pointer"
                    >
                      <option value="1">1週間 (基本)</option>
                      <option value="2">2週間</option>
                      <option value="none">期限なし</option>
                    </select>
                  </div>

                  {/* 6. 昼休み (丸型トグルスイッチ) */}
                  {activeTable.axisConfig.startTime && (
                    <div className="flex items-center gap-1.5 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                        昼休:
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activeTable.axisConfig.hasLunch}
                        onClick={() =>
                          handleAxisConfigChange('hasLunch', !activeTable.axisConfig.hasLunch)
                        }
                        title={`昼休みを${activeTable.axisConfig.hasLunch ? 'オフ' : 'オン'}にする`}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          activeTable.axisConfig.hasLunch ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            activeTable.axisConfig.hasLunch ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      {activeTable.axisConfig.hasLunch ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              min={1}
                              max={Math.max(1, activeTable.numRows - 1)}
                              value={activeTable.axisConfig.lunchAfterPeriod}
                              onChange={(e) => {
                                const num = parseInt(e.target.value, 10);
                                if (!isNaN(num) && num >= 1) {
                                  handleAxisConfigChange('lunchAfterPeriod', num);
                                }
                              }}
                              title="何行目の後に昼休みを挿入するか"
                              className="w-10 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                            />
                            <span className="text-[10px] text-slate-500 font-medium select-none">
                              行後
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              min={10}
                              max={180}
                              step={5}
                              value={activeTable.axisConfig.lunchMinutes}
                              onChange={(e) => {
                                const num = parseInt(e.target.value, 10);
                                if (!isNaN(num) && num >= 1) {
                                  handleAxisConfigChange('lunchMinutes', num);
                                }
                              }}
                              title="昼休みの長さ（分）"
                              className="w-12 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                            />
                            <span className="text-[10px] text-slate-500 font-medium select-none">
                              分
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">OFF</span>
                      )}
                    </div>
                  )}

                  {/* 7. 付随タスク (丸型トグルスイッチ) */}
                  <div className="flex items-center gap-1.5 rounded-none border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                      付随タスク:
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activeTable.attachedTaskConfig?.enabled ?? false}
                      onClick={() => {
                        const nextEnabled = !(activeTable.attachedTaskConfig?.enabled ?? false);
                        const defaultPeriod = Math.min(
                          180,
                          Math.max(1, activeTable.axisConfig.periodMinutes || 90),
                        );
                        updateActiveTable((prev) => ({
                          ...prev,
                          attachedTaskConfig: {
                            enabled: nextEnabled,
                            titleTemplate:
                              prev.attachedTaskConfig?.titleTemplate || '{title} のタスク',
                            durationMinutes:
                              prev.attachedTaskConfig?.durationMinutes || defaultPeriod,
                          },
                        }));
                      }}
                      title={`付随タスクを${activeTable.attachedTaskConfig?.enabled ? 'オフ' : 'オン'}にする`}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        activeTable.attachedTaskConfig?.enabled ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          activeTable.attachedTaskConfig?.enabled
                            ? 'translate-x-3'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                    {activeTable.attachedTaskConfig?.enabled ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min={1}
                            max={180}
                            step={5}
                            value={
                              activeTable.attachedTaskConfig.durationMinutes ||
                              Math.min(180, activeTable.axisConfig.periodMinutes || 90)
                            }
                            onChange={(e) => {
                              const num = parseInt(e.target.value, 10);
                              if (!isNaN(num) && num >= 1) {
                                updateActiveTable((prev) => ({
                                  ...prev,
                                  attachedTaskConfig: {
                                    ...prev.attachedTaskConfig,
                                    enabled: true,
                                    titleTemplate:
                                      prev.attachedTaskConfig?.titleTemplate || '{title} のタスク',
                                    durationMinutes: num,
                                  },
                                }));
                              }
                            }}
                            title="付随タスクの所要時間（分）"
                            className="w-12 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 font-mono text-xs text-center text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition"
                          />
                          <span className="text-[10px] text-slate-500 font-medium select-none">
                            分
                          </span>
                        </div>

                        {/* Plan16: 分割回数 */}
                        <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200/80">
                          <span className="text-[10px] text-slate-500 font-medium select-none">
                            分割回数:
                          </span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={activeTable.attachedTaskConfig?.allowSplit ? (activeTable.attachedTaskConfig.splitCount || 2) : 1}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              updateActiveTable((prev) => ({
                                ...prev,
                                attachedTaskConfig: {
                                  ...prev.attachedTaskConfig,
                                  enabled: true,
                                  titleTemplate:
                                    prev.attachedTaskConfig?.titleTemplate || '{title} のタスク',
                                  durationMinutes:
                                    prev.attachedTaskConfig?.durationMinutes || prev.axisConfig.periodMinutes || 90,
                                  allowSplit: val > 1,
                                  splitCount: val > 1 ? val : undefined,
                                },
                              }));
                            }}
                            title="付随タスクの分割回数（隙間時間に合わせて分割）"
                            className="w-11 rounded border border-slate-200/80 bg-white/80 px-1 py-0.5 text-center font-mono text-[10px] text-slate-700 font-semibold focus:outline-hidden hover:border-slate-300"
                          />
                          <span className="text-[10px] text-slate-500 font-medium select-none">
                            回
                          </span>
                          {activeTable.attachedTaskConfig?.allowSplit && (activeTable.attachedTaskConfig.splitCount || 2) > 1 && (
                            <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1 rounded font-mono font-medium">
                              ({Math.floor((activeTable.attachedTaskConfig.durationMinutes || activeTable.axisConfig.periodMinutes || 90) / (activeTable.attachedTaskConfig.splitCount || 2))}分×{activeTable.attachedTaskConfig.splitCount || 2})
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">OFF</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* ========================================================
                Big Spreadsheet Screen: Excel風 大画面テーブル
                - flex-1 min-h-0 で縦横いっぱいに広がる大画面
                - 見出し（列ヘッダー・行ヘッダー）は sticky 固定
                - モバイル版では5列以上ある場合も1画面にピッタリ収まる均等フィット
                ======================================================== */}
            <div className="flex-1 min-h-0 flex flex-col rounded-none border border-slate-300 bg-white overflow-hidden shadow-2xs">
              {/* スクロール領域: 端への余分なスクロール・オーバースクロール・バウンスを完全廃止 */}
              <div className={`flex-1 min-h-0 overscroll-none [overscroll-behavior:none] ${
                viewMode === 'mobile' && activeTable.numCols <= 5
                  ? 'overflow-x-hidden overflow-y-auto touch-pan-y'
                  : 'overflow-auto touch-pan-x touch-pan-y'
              }`}>
                <table className={`w-full border-separate border-spacing-0 text-left text-xs ${
                  viewMode === 'mobile' ? 'table-fixed' : ''
                }`}>
                  <thead>
                    <tr>
                      {/* 左上 交差見出し: モバイル版は時限のみ、デスクトップ版は一律周期管理＆周期の頭設定 */}
                      <th
                        className={`sticky top-0 left-0 z-30 ${
                          viewMode === 'mobile'
                            ? 'w-11 min-w-[44px] max-w-[44px] p-1'
                            : 'w-24 sm:w-28 min-w-[96px] sm:min-w-[110px] p-1.5'
                        } border-b-2 border-r-2 border-slate-300 bg-slate-100 text-center select-none shadow-2xs`}
                      >
                        {viewMode === 'mobile' ? (
                          <div className="flex items-center justify-center font-bold text-slate-500 text-[10px]">
                            時限
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-emerald-700 uppercase tracking-wider text-[9px]">
                              🔄 周期の頭
                            </span>
                            <select
                              value={activeTable.cycleStartDay ?? 0}
                              onChange={(e) => handleCycleStartDayChange(Number(e.target.value))}
                              className="w-full rounded border border-emerald-300 bg-emerald-50 font-bold text-emerald-800 shadow-2xs hover:border-emerald-400 focus:outline-hidden cursor-pointer transition px-1.5 py-1 text-[11px]"
                              title="周期の始まり（Day 1）となる日付（曜日）を月〜日から指定します"
                            >
                              {weekDateOptions.map((opt) => (
                                <option key={opt.dayIndex} value={opt.dayIndex}>
                                  {opt.label}〜
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </th>

                      {/* 列ヘッダー (一律周期管理 + 開始日オフセットに応じた日付（曜日）バッジ表示) */}
                      {activeTable.colHeaders.map((colName, cIdx) => {
                        const parsed = parseColHeader(colName, cIdx);
                        const isExcluded = parsed.type === 'excluded';
                        const colLetter = String.fromCharCode(65 + cIdx); // A, B, C, D...
                        const cycleIdx =
                          parsed.cycleIndex !== undefined
                            ? parsed.cycleIndex
                            : parsed.dayIndex !== undefined
                              ? parsed.dayIndex
                              : cIdx;
                        const mappedWeekOpt =
                          weekDateOptions[((activeTable.cycleStartDay ?? 0) + cycleIdx) % 7];
                        const displayHeaderValue =
                          parsed.type === 'weekday' ? `Day ${cIdx + 1}` : colName;
                        const headerOptions = CYCLE_HEADER_OPTIONS;
                        const isColumnEmpty = activeTable.cells.every(
                          (r) => !r[cIdx]?.title?.trim(),
                        );

                        // 5列以下の場合は 1画面幅(100% - 行ヘッダー44px) の中にピッタリ均等フィットさせて横余白・不要スクロールをゼロ化
                        const colWidthStyle =
                          viewMode === 'mobile'
                            ? activeTable.numCols <= 5
                              ? `w-[calc((100%-44px)/${activeTable.numCols})]`
                              : 'w-[calc((100vw-44px)/5)] min-w-[64px]'
                            : 'min-w-[140px] sm:min-w-[160px]';

                        return (
                          <th
                            key={`col-header-${cIdx}`}
                            className={`sticky top-0 z-20 border-b-2 border-r border-slate-300 text-center transition ${colWidthStyle} ${
                              viewMode === 'mobile' ? 'p-1' : 'p-2'
                            } ${
                              isExcluded ? 'bg-slate-200/60 text-slate-400' : 'bg-emerald-50/50'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                              <div className="flex items-center justify-between w-full px-0.5 gap-0.5">
                                <div className="flex items-center gap-0.5">
                                  <span className="font-mono text-[9px] sm:text-[10px] font-bold text-slate-400">
                                    {colLetter}
                                  </span>
                                  {viewMode === 'desktop' && !isExcluded && mappedWeekOpt && (
                                    <span
                                      className="inline-flex items-center rounded bg-white/90 border border-emerald-200 font-bold text-emerald-700 px-1 py-0.2 text-[9px]"
                                      title={`周期の頭からの対応日: ${mappedWeekOpt.label}`}
                                    >
                                      {mappedWeekOpt.label}
                                    </span>
                                  )}
                                </div>
                                {!isExcluded && isColumnEmpty && (
                                  <span
                                    className={`inline-flex items-center gap-0.5 rounded bg-emerald-100 border border-emerald-300/80 font-bold text-emerald-800 ${
                                      viewMode === 'mobile'
                                        ? 'px-0.5 text-[8px]'
                                        : 'px-1 py-0.2 text-[9px]'
                                    }`}
                                    title="空列のため、周期内で何もしないオフ日になります"
                                  >
                                    {viewMode === 'mobile' ? '💤' : '💤 オフ日'}
                                  </span>
                                )}
                                {viewMode === 'desktop' && activeTable.numCols > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateActiveTable((t) => removeColAtIndex(t, cIdx))
                                    }
                                    title={`この列 (${displayHeaderValue}) を削除`}
                                    className="h-4 w-4 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <select
                                value={displayHeaderValue}
                                onChange={(e) => handleColHeaderChange(cIdx, e.target.value)}
                                className={`w-full rounded border font-bold transition shadow-2xs focus:outline-hidden cursor-pointer ${
                                  viewMode === 'mobile'
                                    ? 'px-0.5 py-0.5 text-[10px]'
                                    : 'px-1.5 py-0.5 text-xs'
                                } ${
                                  isExcluded
                                    ? 'border-slate-300 bg-slate-100 text-slate-400'
                                    : 'border-emerald-300 bg-white text-emerald-700 hover:border-emerald-400'
                                }`}
                              >
                                {headerOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                                {!headerOptions.includes(displayHeaderValue) && (
                                  <option value={displayHeaderValue}>{displayHeaderValue}</option>
                                )}
                              </select>
                            </div>
                          </th>
                        );
                      })}

                      {/* 列増減ヘッダー (デスクトップ版のみ表示。モバイル版は設定ドロワーで操作可能) */}
                      {viewMode === 'desktop' && (
                        <th className="sticky top-0 z-20 border-b-2 border-r border-slate-300 bg-slate-100/70 p-1.5 text-center w-14 min-w-[56px]">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateActiveTable(addColToTable)}
                              title="列を右端に追加"
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500 hover:border-blue-400 hover:text-blue-600 transition shadow-2xs active:scale-95"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            {activeTable.numCols > 1 && (
                              <button
                                type="button"
                                onClick={() => updateActiveTable(removeColFromTable)}
                                title="右端の列を削除"
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500 hover:border-red-400 hover:text-red-600 transition shadow-2xs active:scale-95"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTable.cells.map((row, rIdx) => {
                      const pt = periodTimes[rIdx];
                      const periodIndex = pt?.periodIndex ?? rIdx + 1;
                      const isCustomRowTime = !!(
                        activeTable.axisConfig.customRowTimes &&
                        activeTable.axisConfig.customRowTimes[periodIndex]
                      );

                      const colWidthStyle =
                        viewMode === 'mobile'
                          ? activeTable.numCols <= 5
                            ? `w-[calc((100%-44px)/${activeTable.numCols})]`
                            : 'w-[calc((100vw-44px)/5)] min-w-[64px]'
                          : 'min-w-[140px] sm:min-w-[160px]';

                      return (
                        <tr key={`row-${rIdx}`} className="group/row">
                          {/* 行ヘッダー (番号 & 時間帯微調整 & 行削除ボタン) */}
                          <td
                            className={`sticky left-0 z-10 border-b border-r-2 border-slate-300 ${
                              viewMode === 'mobile'
                                ? 'w-11 min-w-[44px] max-w-[44px] p-1'
                                : 'p-1.5 sm:p-2'
                            } text-center transition ${
                              isCustomRowTime
                                ? 'bg-amber-50/90 group-hover/row:bg-amber-100/80'
                                : 'bg-slate-50 group-hover/row:bg-slate-100/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-0.5">
                              <span className={`font-bold text-slate-900 ${
                                viewMode === 'mobile' ? 'text-xs' : 'text-xs sm:text-sm'
                              }`}>
                                {rIdx + 1}
                              </span>
                              <div className="flex items-center gap-0.5">
                                {isCustomRowTime && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetCustomRowTime(periodIndex)}
                                    title="この行の時間微調整をリセット"
                                    className="rounded bg-amber-100 px-0.5 py-0.2 text-[8px] font-bold text-amber-800 hover:bg-amber-200 transition"
                                  >
                                    {viewMode === 'mobile' ? '戻' : '戻す'}
                                  </button>
                                )}
                                {viewMode === 'desktop' && activeTable.numRows > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateActiveTable((t) => removeRowAtIndex(t, rIdx))
                                    }
                                    title={`行 ${rIdx + 1} を削除`}
                                    className="h-4 w-4 rounded opacity-60 hover:opacity-100 group-hover/row:opacity-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {activeTable.axisConfig.startTime && pt?.startTime && pt?.endTime && (
                              <div className="mt-0.5 flex flex-col gap-0.5">
                                <input
                                  type="time"
                                  value={pt.startTime}
                                  onChange={(e) =>
                                    handleCustomRowTimeChange(periodIndex, 'start', e.target.value)
                                  }
                                  title={`${rIdx + 1}行目の開始時刻を微調整`}
                                  className={`w-full rounded border px-0.5 py-0.2 font-mono text-center focus:outline-hidden focus:ring-1 focus:ring-blue-500 ${
                                    viewMode === 'mobile' ? 'text-[8px]' : 'text-[10px]'
                                  } ${
                                    isCustomRowTime
                                      ? 'border-amber-300 bg-white font-bold text-amber-900'
                                      : 'border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300'
                                  }`}
                                />
                                <input
                                  type="time"
                                  value={pt.endTime}
                                  onChange={(e) =>
                                    handleCustomRowTimeChange(periodIndex, 'end', e.target.value)
                                  }
                                  title={`${rIdx + 1}行目の終了時刻を微調整`}
                                  className={`w-full rounded border px-0.5 py-0.2 font-mono text-center focus:outline-hidden focus:ring-1 focus:ring-blue-500 ${
                                    viewMode === 'mobile' ? 'text-[8px]' : 'text-[10px]'
                                  } ${
                                    isCustomRowTime
                                      ? 'border-amber-300 bg-white font-bold text-amber-900'
                                      : 'border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300'
                                  }`}
                                />
                              </div>
                            )}
                          </td>

                          {/* 各セル */}
                          {row.map((cell, cIdx) => {
                            const isExcluded = activeTable.colHeaders[cIdx] === '除外';
                            const hasContent = Boolean(cell.text && cell.title.trim());
                            const cellKey = `${rIdx}-${cIdx}`;
                            const isJustCopied = copiedDirectKey === cellKey;
                            const isJustPasted = pastedDirectKey === cellKey;

                            return (
                              <td
                                key={`cell-${rIdx}-${cIdx}`}
                                onClick={() => !isExcluded && handleStartEditCell(rIdx, cIdx)}
                                className={`relative border-b border-r border-slate-200 align-top transition-all ${colWidthStyle} ${
                                  viewMode === 'mobile'
                                    ? 'p-1 h-20 min-h-[80px]'
                                    : 'p-2 sm:p-2.5 h-28 sm:h-32 min-h-[112px] sm:min-h-[128px]'
                                } ${
                                  isExcluded
                                    ? 'bg-slate-100/40 opacity-40 cursor-not-allowed'
                                    : hasContent
                                      ? 'bg-sky-50/50 hover:bg-sky-100/70 hover:shadow-inner cursor-pointer'
                                      : 'hover:bg-slate-50/80 cursor-pointer'
                                }`}
                              >
                                {hasContent ? (
                                  <div className="flex h-full flex-col justify-between group/cell">
                                    <div>
                                      <div className="flex items-start justify-between gap-0.5">
                                        <span className={`font-bold text-sky-950 leading-tight break-words ${
                                          (viewMode as string) === 'mobile'
                                            ? (cell.title?.length || 0) > 7
                                              ? 'text-[10px] line-clamp-2'
                                              : 'text-[11px] line-clamp-2'
                                            : 'text-xs sm:text-[13px] leading-snug'
                                        }`}>
                                          {cell.title}
                                        </span>
                                      </div>
                                      {cell.roomOrNote && (
                                        <p className={`mt-0.5 text-slate-500 line-clamp-1 ${
                                          (viewMode as string) === 'mobile' ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'
                                        }`}>
                                          {cell.roomOrNote}
                                        </p>
                                      )}
                                      {/* Plan23: 個別設定バッジ（個別所要時間・開始時刻・URL） */}
                                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                        {cell.customDurationMinutes && cell.customDurationMinutes > 0 && (
                                          <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold px-1 py-0.2 text-[8px]" title={`個別所要時間: ${cell.customDurationMinutes}分`}>
                                            ⏱{cell.customDurationMinutes}m
                                          </span>
                                        )}
                                        {cell.customStartTime && (
                                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold px-1 py-0.2 text-[8px]" title={`個別開始時刻: ${cell.customStartTime}`}>
                                            🕒{cell.customStartTime}
                                          </span>
                                        )}
                                        {cell.url && (
                                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 text-emerald-800 font-bold px-1 py-0.2 text-[8px]" title={`関連URL: ${cell.url}`}>
                                            🔗
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-400 mt-0.5">
                                      <span className={`font-mono ${
                                        (viewMode as string) === 'mobile' ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'
                                      }`}>
                                        {cell.customStartTime || (pt ? `${pt.startTime || ''}` : '')}
                                      </span>

                                      {/* 各コマ上のコピー・ペースト・削除ボタングループ（Plan23） */}
                                      <div className="flex items-center gap-0.5">
                                        {/* コマ直接コピーボタン */}
                                        <button
                                          type="button"
                                          onClick={(e) => handleCopyDirectCell(rIdx, cIdx, e)}
                                          title={isJustCopied ? 'コピーしました！' : 'このコマをコピー'}
                                          className={`p-1 rounded transition cursor-pointer ${
                                            isJustCopied
                                              ? 'text-emerald-700 bg-emerald-100 scale-110 shadow-xs'
                                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
                                          } ${
                                            (viewMode as string) === 'mobile' ? 'opacity-90' : 'opacity-60 group-hover/cell:opacity-100'
                                          }`}
                                        >
                                          {isJustCopied ? <Check className="h-3 w-3 stroke-[3]" /> : <Copy className="h-3 w-3" />}
                                        </button>

                                        {/* コマ直接貼り付けボタン（コピーデータがある場合に表示） */}
                                        {copiedCellData && (
                                          <button
                                            type="button"
                                            onClick={(e) => handlePasteDirectCell(rIdx, cIdx, e)}
                                            title={isJustPasted ? '貼り付けました！' : `コピーしたコマ「${copiedCellData.text.split('\n')[0]}」で上書き貼り付け`}
                                            className={`p-1 rounded transition cursor-pointer ${
                                              isJustPasted
                                                ? 'text-blue-700 bg-blue-100 scale-110 shadow-xs'
                                                : 'text-blue-600 hover:text-blue-800 hover:bg-blue-100/70'
                                            } ${
                                              (viewMode as string) === 'mobile' ? 'opacity-100 bg-blue-50/80 shadow-2xs' : 'opacity-80 group-hover/cell:opacity-100 bg-blue-50/60'
                                            }`}
                                          >
                                            {isJustPasted ? <Check className="h-3 w-3 stroke-[3]" /> : <ClipboardPaste className="h-3 w-3" />}
                                          </button>
                                        )}

                                        {/* コマ削除ごみ箱アイコン（デスクトップ版のみ表示。モバイル版はタップ誤動作防止のため編集シートから操作） */}
                                        {viewMode === 'desktop' && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleClearCell(rIdx, cIdx, e);
                                            }}
                                            title="このコマを削除"
                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-60 group-hover/cell:opacity-100 transition cursor-pointer"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex h-full flex-col items-center justify-center text-slate-400 relative group/empty">
                                    <Plus className={`h-3.5 w-3.5 ${(viewMode as string) === 'mobile' ? 'opacity-30' : 'opacity-0 group-hover/empty:opacity-100'} transition`} />
                                    {/* 空コマへの直接貼り付けボタン（コピーデータがある場合に表示） */}
                                    {copiedCellData && (
                                      <button
                                        type="button"
                                        onClick={(e) => handlePasteDirectCell(rIdx, cIdx, e)}
                                        title={`コピーしたコマ「${copiedCellData.text.split('\n')[0]}」を貼り付け`}
                                        className="absolute inset-x-1 bottom-1 sm:bottom-1.5 py-0.5 sm:py-1 rounded-md bg-blue-50/95 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[9px] sm:text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                                      >
                                        <ClipboardPaste className="h-3 w-3" />
                                        <span>貼付</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* 行末の空セル (列追加ヘッダー対応) */}
                          {viewMode === 'desktop' && (
                            <td className="border-b border-r border-slate-200 bg-slate-50/20" />
                          )}
                        </tr>
                      );
                    })}

                    {/* 行追加・削除フッター行 (デスクトップ版のみ。モバイル版はドロワーで操作) */}
                    {viewMode === 'desktop' && (
                      <tr>
                        <td
                          colSpan={activeTable.numCols + 2}
                          className="p-2 bg-slate-50/40 text-center border-b border-slate-200"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateActiveTable(addRowToTable)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition shadow-2xs active:scale-95"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>行を追加</span>
                            </button>
                            {activeTable.numRows > 1 && (
                              <button
                                type="button"
                                onClick={() => updateActiveTable(removeRowFromTable)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-400 hover:text-red-600 hover:bg-red-50/30 transition shadow-2xs active:scale-95"
                              >
                                <Minus className="h-3.5 w-3.5" />
                                <span>行を削除</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cell Edit Modal / Sheet */}
      {editingCell && activeTable && (
        (viewMode as string) === 'mobile' ? (
          /* ========================================================
             Mobile Cell Edit Sheet: 下からせり上がる専用ボトムシート
             ======================================================== */
          <div className="fixed inset-0 z-[70] flex items-end">
            {/* 背景オーバーレイ */}
            <div
              onClick={() => setEditingCell(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in cursor-pointer"
            />
            {/* ボトムシートコンテナ */}
            <div className="relative z-10 flex w-full max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-250 overflow-hidden">
              {/* 上部ハンドル ＆ ヘッダー */}
              <div className="flex flex-col items-center pt-2.5 pb-2.5 px-4 border-b border-slate-100 shrink-0">
                <div className="h-1 w-10 rounded-full bg-slate-300 mb-2" />
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-xs shadow-2xs">
                      {editingCell.r + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">コマ内容の編集</h3>
                      <p className="text-[11px] text-slate-500">
                        {activeTable.colHeaders[editingCell.c]} / {editingCell.r + 1}限目
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* コピーアイコン */}
                    <button
                      type="button"
                      onClick={handleCopyCell}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition relative cursor-pointer"
                      title="このコマの内容と設定をコピー"
                    >
                      <Copy className="h-4 w-4" />
                      {copyFeedback && (
                        <span className="absolute -top-7 right-0 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-in fade-in">
                          コピー済
                        </span>
                      )}
                    </button>
                    {/* ペーストアイコン */}
                    <button
                      type="button"
                      onClick={handlePasteCell}
                      disabled={!copiedCellData}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      title={copiedCellData ? 'コピーした内容を貼り付け' : 'クリップボードが空です'}
                    >
                      <ClipboardPaste className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCell(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* フォーム入力エリア（スクロール可能） */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {/* コマ内容入力 */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    講義名・日課名（1行目）
                  </label>
                  <textarea
                    rows={2}
                    value={cellEditText}
                    onChange={(e) => setCellEditText(e.target.value)}
                    placeholder="講義名・科目名・日課名（改行で場所・メモ）"
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    改行すると2行目以降が場所・メモとして小さく表示されます
                  </span>
                </div>

                {/* 所要時間（Plan23: デフォルトで表の設定を参照・直接編集可能） */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⏱</span>
                      <div>
                        <div className="text-xs font-bold text-slate-800">所要時間</div>
                        <div className="text-[10px] text-slate-500">
                          {`表の設定（${getCellDefaultDuration(activeTable, editingCell.r, editingCell.c, periodTimes)}分）から初期入力`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCellCustomDuration(Math.max(5, cellCustomDuration - 5))}
                        className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-sm text-blue-700">
                        {cellCustomDuration}分
                      </span>
                      <button
                        type="button"
                        onClick={() => setCellCustomDuration(Math.min(300, cellCustomDuration + 5))}
                        className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const defaultMins = getCellDefaultDuration(
                            activeTable,
                            editingCell.r,
                            editingCell.c,
                            periodTimes,
                          );
                          setCellCustomDuration(defaultMins);
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
                        title="表の規定時間に戻す"
                      >
                        リセット
                      </button>
                    </div>
                  </div>
                </div>

                {/* 開始時刻（Plan23: デフォルトで表の設定を参照・直接編集可能） */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🕒</span>
                      <div>
                        <div className="text-xs font-bold text-slate-800">開始時刻</div>
                        <div className="text-[10px] text-slate-500">
                          {cellHasCustomTime ? '表の設定から初期入力（変更可能）' : '指定なし（自動配置）'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={cellHasCustomTime}
                      onClick={() => setCellHasCustomTime(!cellHasCustomTime)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        cellHasCustomTime ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                      title={cellHasCustomTime ? '時刻指定を解除（空き枠自動配置）' : '時刻を指定'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          cellHasCustomTime ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {cellHasCustomTime && (
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">開始時刻:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={cellCustomStartTime}
                          onChange={(e) => setCellCustomStartTime(e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-mono font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const { startTime: defStart } = getCellDefaultStartTime(
                              activeTable,
                              editingCell.r,
                              editingCell.c,
                              periodTimes,
                            );
                            setCellCustomStartTime(defStart);
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                          title="表の開始時刻に戻す"
                        >
                          リセット
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 関連URL（Plan23） */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔗</span>
                      <div>
                        <div className="text-xs font-bold text-slate-800">関連URL</div>
                        <div className="text-[10px] text-slate-500">Zoom / Meet / LMS課題リンクなど</div>
                      </div>
                    </div>
                    {cellUrl.trim() && (
                      <a
                        href={cellUrl.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md hover:bg-blue-100 transition"
                      >
                        <span>開く</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    value={cellUrl}
                    onChange={(e) => setCellUrl(e.target.value)}
                    placeholder="https://zoom.us/... や LMSのURL"
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-hidden"
                  />
                </div>

                {/* タスク後の休憩時間 */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-emerald-50/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">☕</span>
                    <div>
                      <div className="text-xs font-bold text-slate-800">タスク後の休憩時間</div>
                      <div className="text-[10px] text-slate-500">コマ直後に確保する休憩</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCellBreakMinutes(Math.max(0, cellBreakMinutes - 5))}
                      className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                    >
                      -
                    </button>
                    <span className="w-12 text-center font-mono font-bold text-sm text-slate-800">
                      {cellBreakMinutes}分
                    </span>
                    <button
                      type="button"
                      onClick={() => setCellBreakMinutes(Math.min(120, cellBreakMinutes + 5))}
                      className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 付随タスク（連動タスク）設定 */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📌</span>
                      <div>
                        <div className="text-xs font-bold text-slate-800">付随タスク（復習等）</div>
                        <div className="text-[10px] text-slate-500">このコマに連動してタスクを生成</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={cellAttachedEnabled}
                      onClick={() => setCellAttachedEnabled(!cellAttachedEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        cellAttachedEnabled ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          cellAttachedEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </label>

                  {cellAttachedEnabled && (
                    <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-600">所要時間:</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCellAttachedDuration(Math.max(5, cellAttachedDuration - 5))}
                            className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-mono font-bold text-sm text-slate-800">
                            {cellAttachedDuration}分
                          </span>
                          <button
                            type="button"
                            onClick={() => setCellAttachedDuration(Math.min(180, cellAttachedDuration + 5))}
                            className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Plan16: 分割回数（所要時間・休憩時間と統一したステッパーUI） */}
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-slate-700">分割回数</span>
                          <p className="text-[10px] text-slate-400">空きコマに合わせて復習を分散</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const cur = cellAttachedAllowSplit ? cellAttachedSplitCount : 1;
                              const next = Math.max(1, cur - 1);
                              if (next === 1) {
                                setCellAttachedAllowSplit(false);
                                setCellAttachedSplitCount(1);
                              } else {
                                setCellAttachedAllowSplit(true);
                                setCellAttachedSplitCount(next);
                              }
                            }}
                            className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-mono font-bold text-sm text-slate-800">
                            {cellAttachedAllowSplit ? `${cellAttachedSplitCount}回` : '1回'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const cur = cellAttachedAllowSplit ? cellAttachedSplitCount : 1;
                              const next = cur + 1;
                              setCellAttachedAllowSplit(true);
                              setCellAttachedSplitCount(next);
                            }}
                            className="h-8 w-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs"
                          >
                            +
                          </button>
                          {cellAttachedAllowSplit && cellAttachedSplitCount > 1 && (
                            <span className="text-[10px] text-indigo-700 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                              {Math.floor(cellAttachedDuration / cellAttachedSplitCount)}分×{cellAttachedSplitCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ボトムアクションバー（親指で届く大ボタン・フッター被り防止＆セーフエリア確保） */}
              <div className="shrink-0 border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-50/95 flex items-center gap-2.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    handleClearCell(editingCell.r, editingCell.c);
                    setEditingCell(null);
                  }}
                  className="flex-1 h-12 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>空にする</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditCell}
                  className="flex-1 h-12 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>保存する</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* デスクトップ版ダイアログ (既存のPC向け中央配置モーダル) */
          <div
            onClick={() => setEditingCell(null)}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl animate-in zoom-in-95 duration-150 cursor-default max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  コマ内容を編集 ({editingCell.r + 1}行目・{activeTable.colHeaders[editingCell.c]})
                </span>
                <div className="flex items-center gap-1">
                  {/* コピーアイコン */}
                  <button
                    type="button"
                    onClick={handleCopyCell}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition relative cursor-pointer"
                    title="このコマの内容と設定をコピー"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copyFeedback && (
                      <span className="absolute -top-7 right-0 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-in fade-in">
                        コピー済
                      </span>
                    )}
                  </button>
                  {/* ペーストアイコン */}
                  <button
                    type="button"
                    onClick={handlePasteCell}
                    disabled={!copiedCellData}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title={copiedCellData ? 'コピーした内容を貼り付け' : 'クリップボードが空です'}
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* コマ内容入力 */}
              <textarea
                rows={3}
                value={cellEditText}
                onChange={(e) => setCellEditText(e.target.value)}
                placeholder="1行目: コマ名称（講義名・メニュー・日課名など）&#13;&#10;2行目以降: 場所・メモ・詳細"
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />

              {/* 所要時間（Plan23: デフォルトで表の設定を参照・直接編集可能） */}
              <div className="mt-2.5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">⏱</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">所要時間</div>
                    <div className="text-[10px] text-slate-500">
                      {`表の設定（${getCellDefaultDuration(activeTable, editingCell.r, editingCell.c, periodTimes)}分）から初期入力`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={5}
                    max={300}
                    step={5}
                    value={cellCustomDuration}
                    onChange={(e) =>
                      setCellCustomDuration(Math.max(5, parseInt(e.target.value, 10) || 5))
                    }
                    className="w-16 rounded border border-blue-300 bg-white px-2 py-1 font-mono text-xs text-center text-blue-700 font-bold focus:border-blue-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-medium">分</span>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultMins = getCellDefaultDuration(
                        activeTable,
                        editingCell.r,
                        editingCell.c,
                        periodTimes,
                      );
                      setCellCustomDuration(defaultMins);
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-0.5 cursor-pointer"
                    title="表の規定時間に戻す"
                  >
                    リセット
                  </button>
                </div>
              </div>

              {/* 開始時刻（Plan23: デフォルトで表の設定を参照・直接編集可能） */}
              <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🕒</span>
                    <div>
                      <div className="text-xs font-bold text-slate-800">開始時刻</div>
                      <div className="text-[10px] text-slate-500">
                        {cellHasCustomTime ? '表の設定から初期入力（変更可能）' : '指定なし（自動配置）'}
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cellHasCustomTime}
                      onChange={(e) => setCellHasCustomTime(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                {cellHasCustomTime && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">開始時刻:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        value={cellCustomStartTime}
                        onChange={(e) => setCellCustomStartTime(e.target.value)}
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const { startTime: defStart } = getCellDefaultStartTime(
                            activeTable,
                            editingCell.r,
                            editingCell.c,
                            periodTimes,
                          );
                          setCellCustomStartTime(defStart);
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                        title="表の開始時刻に戻す"
                      >
                        リセット
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 関連URL（Plan23） */}
              <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🔗</span>
                    <span className="text-xs font-bold text-slate-800">関連URL</span>
                  </div>
                  {cellUrl.trim() && (
                    <a
                      href={cellUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 hover:underline"
                    >
                      <span>開く</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  value={cellUrl}
                  onChange={(e) => setCellUrl(e.target.value)}
                  placeholder="https://zoom.us/... や LMS等のURL"
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* タスク後の休憩時間 */}
              <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-emerald-50/50 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">☕</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">タスク後の休憩時間</div>
                    <div className="text-[10px] text-slate-500">直後に確保する休憩</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={5}
                    value={cellBreakMinutes}
                    onChange={(e) =>
                      setCellBreakMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-center text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-medium">分</span>
                </div>
              </div>

              {/* 付随タスク（連動タスク）設定 */}
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cellAttachedEnabled}
                    onChange={(e) => setCellAttachedEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    このコマに付随タスクを連動生成する
                  </span>
                </label>
                {cellAttachedEnabled && (
                  <div className="mt-2 flex flex-col gap-2 pl-5.5">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-slate-500 shrink-0">所要時間:</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={180}
                          step={5}
                          value={cellAttachedDuration}
                          onChange={(e) =>
                            setCellAttachedDuration(Math.max(1, parseInt(e.target.value, 10) || 15))
                          }
                          className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-center text-slate-800 focus:border-blue-500 focus:outline-hidden"
                        />
                        <span className="text-xs text-slate-500 font-medium">分</span>
                      </div>
                    </div>

                    {/* Plan16: 分割回数（所要時間・休憩時間と統一した数値入力） */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <label className="text-[10px] text-slate-500 shrink-0">分割回数:</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={cellAttachedAllowSplit ? cellAttachedSplitCount : 1}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            if (val === 1) {
                              setCellAttachedAllowSplit(false);
                              setCellAttachedSplitCount(1);
                            } else {
                              setCellAttachedAllowSplit(true);
                              setCellAttachedSplitCount(val);
                            }
                          }}
                          className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-center text-slate-800 focus:border-blue-500 focus:outline-hidden"
                        />
                        <span className="text-xs text-slate-500 font-medium">回</span>
                        {cellAttachedAllowSplit && cellAttachedSplitCount > 1 && (
                          <span className="text-[9px] text-indigo-700 font-mono font-bold bg-indigo-50 px-1 py-0.5 rounded ml-0.5">
                            {Math.floor(cellAttachedDuration / cellAttachedSplitCount)}分×{cellAttachedSplitCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3.5 flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditCell}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs transition"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* ========================================================
          Mobile Settings Drawer: 右から飛び出す専用設定ドロワー
          ======================================================== */}
      {isMobileSettingsOpen && activeTable && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          {/* 背景オーバーレイ */}
          <div
            onClick={() => setIsMobileSettingsOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
          />

          {/* ドロワーパネル */}
          <div className="relative z-10 flex h-full w-full max-w-[380px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-250">
            {/* ドロワーヘッダー */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">時間割の詳細設定</h3>
                  <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{activeTable.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSettingsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
                title="設定を閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ドロワーコンテンツ (スクロール可能: 上から順に設定していく最適化フロー) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 divide-y divide-slate-100">
              {/* セクション 0: ✨ テンプレートから設定（設定項目の先頭） */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSettingsOpen(false);
                    setIsTemplateWizardOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50/90 hover:bg-indigo-100 hover:border-indigo-500 py-3 text-xs font-bold text-indigo-800 shadow-2xs transition active:scale-98 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <span>✨ テンプレートから設定</span>
                </button>
              </div>

              {/* セクション 1: 📐 表のマス目サイズ ＆ 取り込み (骨組み・インポート) */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                  <span>表のマス目 ＆ 取り込み</span>
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-center">
                    <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">行数 (時限)</span>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateActiveTable(removeRowFromTable)}
                        disabled={activeTable.numRows <= 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-bold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-30 active:scale-95 transition"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-sm font-bold text-slate-800 w-8">{activeTable.numRows}行</span>
                      <button
                        type="button"
                        onClick={() => updateActiveTable(addRowToTable)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-bold text-slate-700 shadow-2xs hover:bg-slate-100 active:scale-95 transition"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-center">
                    <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">列数 (曜日)</span>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateActiveTable(removeColFromTable)}
                        disabled={activeTable.numCols <= 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-bold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-30 active:scale-95 transition"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-sm font-bold text-slate-800 w-8">{activeTable.numCols}列</span>
                      <button
                        type="button"
                        onClick={() => updateActiveTable(addColToTable)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-bold text-slate-700 shadow-2xs hover:bg-slate-100 active:scale-95 transition"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSettingsOpen(false);
                    handleTriggerFileSelect(activeTable.id);
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-100 active:scale-98 transition"
                >
                  <Upload className="h-4 w-4 text-blue-600" />
                  <span>画像やCSVから表を読み取る</span>
                </button>
              </div>

              {/* セクション 2: ⏰ 基本時間・1コマ・休憩 (時間の定義) */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>時間帯とコマ割り</span>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">開始時刻</label>
                    <input
                      type="time"
                      value={activeTable.axisConfig.startTime ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        handleAxisConfigChange('startTime', val ? val : null);
                      }}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-2 font-mono text-sm font-bold text-center text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">終了時刻 (上限)</label>
                    <input
                      type="time"
                      value={activeTable.axisConfig.endTime ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        handleAxisConfigChange('endTime', val ? val : null);
                      }}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-2 font-mono text-sm font-bold text-center text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">1コマの長さ</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        step={5}
                        value={activeTable.axisConfig.periodMinutes ?? ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (!val || val === '0') {
                            handleAxisConfigChange('periodMinutes', null);
                          } else {
                            const num = parseInt(val, 10);
                            handleAxisConfigChange('periodMinutes', isNaN(num) || num <= 0 ? null : num);
                          }
                        }}
                        placeholder="自動"
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 pr-8 font-mono text-sm font-bold text-center text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400 pointer-events-none">分</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">コマ間休憩</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        step={5}
                        value={activeTable.axisConfig.intervalMinutes ?? ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '') {
                            handleAxisConfigChange('intervalMinutes', null);
                          } else {
                            const num = parseInt(val, 10);
                            handleAxisConfigChange('intervalMinutes', isNaN(num) || num < 0 ? null : num);
                          }
                        }}
                        placeholder="自動"
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 pr-8 font-mono text-sm font-bold text-center text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400 pointer-events-none">分</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* セクション 3: 🍱 昼休み設定 (1日の休憩ポイント) */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span>昼休み設定</span>
                </h4>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">昼休みを挿入</span>
                      <p className="text-[10px] text-slate-500">指定の時限後に昼休憩を確保</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activeTable.axisConfig.hasLunch}
                      onClick={() => handleAxisConfigChange('hasLunch', !activeTable.axisConfig.hasLunch)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden ${
                        activeTable.axisConfig.hasLunch ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ${
                          activeTable.axisConfig.hasLunch ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {activeTable.axisConfig.hasLunch && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">挿入する位置</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, activeTable.numRows - 1)}
                            value={activeTable.axisConfig.lunchAfterPeriod}
                            onChange={(e) => {
                              const num = parseInt(e.target.value, 10);
                              if (!isNaN(num) && num >= 1) handleAxisConfigChange('lunchAfterPeriod', num);
                            }}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-white pr-9 text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                          />
                          <span className="absolute right-2.5 text-[10px] font-bold text-slate-400 pointer-events-none">行後</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">昼休みの長さ</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min={10}
                            max={180}
                            step={5}
                            value={activeTable.axisConfig.lunchMinutes}
                            onChange={(e) => {
                              const num = parseInt(e.target.value, 10);
                              if (!isNaN(num) && num >= 1) handleAxisConfigChange('lunchMinutes', num);
                            }}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-white pr-7 text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                          />
                          <span className="absolute right-2.5 text-[10px] font-bold text-slate-400 pointer-events-none">分</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* セクション 4: 🎯 計画表への配置方式 ＆ 周期 (計画表との接続) */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  <span>計画表への配置ルール</span>
                </h4>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">周期の頭 (Day 1の曜日)</label>
                  <select
                    value={activeTable.cycleStartDay ?? 0}
                    onChange={(e) => handleCycleStartDayChange(Number(e.target.value))}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs cursor-pointer"
                  >
                    {weekDateOptions.map((opt) => (
                      <option key={opt.dayIndex} value={opt.dayIndex}>
                        {opt.label}〜 から開始
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">配置方式</label>
                    {(() => {
                      const hasValidStartTime =
                        activeTable.axisConfig.startTime !== null &&
                        activeTable.axisConfig.startTime !== undefined &&
                        activeTable.axisConfig.startTime !== 'unset' &&
                        activeTable.axisConfig.startTime !== '未設定' &&
                        activeTable.axisConfig.startTime !== '自動' &&
                        activeTable.axisConfig.startTime !== 'auto';

                      const isFixed =
                        activeTable.placementMode === 'auto'
                          ? false
                          : activeTable.placementMode === 'fixed'
                            ? hasValidStartTime
                            : hasValidStartTime;

                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveTable((prev) => ({
                                ...prev,
                                placementMode: 'fixed',
                              }))
                            }
                            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition shadow-2xs ${
                              isFixed
                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Shield className="h-4 w-4" />
                            <span>📌 固定枠</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveTable((prev) => ({
                                ...prev,
                                placementMode: 'auto',
                              }))
                            }
                            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition shadow-2xs ${
                              !isFixed
                                ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Sun className="h-4 w-4" />
                            <span>⚡ 自動配分</span>
                          </button>
                        </div>
                      );
                    })()}
                </div>
              </div>

              {/* セクション 5: 🔄 繰り返し回数 ＆ 有効期限 (自動配分時の詳細設定) */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-indigo-600" />
                  <span>繰り返し回数 ＆ 有効期限</span>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">1日の回数</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={activeTable.dailyRepeatCount === 'auto' || activeTable.dailyRepeatCount === undefined ? '' : activeTable.dailyRepeatCount}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (!val || val === '0') {
                            updateActiveTable((prev) => ({ ...prev, dailyRepeatCount: 'auto' }));
                          } else {
                            const num = parseInt(val, 10);
                            updateActiveTable((prev) => ({ ...prev, dailyRepeatCount: isNaN(num) || num <= 0 ? 'auto' : num }));
                          }
                        }}
                        placeholder="自動"
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 pr-8 font-mono text-sm font-bold text-center text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400 pointer-events-none">回</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">週の回数</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={1}
                        max={7}
                        value={activeTable.weeklyRepeatCount === 'auto' || activeTable.weeklyRepeatCount === undefined ? '' : activeTable.weeklyRepeatCount}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (!val || val === '0') {
                            updateActiveTable((prev) => ({ ...prev, weeklyRepeatCount: 'auto' }));
                          } else {
                            const num = parseInt(val, 10);
                            updateActiveTable((prev) => ({ ...prev, weeklyRepeatCount: isNaN(num) || num <= 0 ? 'auto' : Math.min(7, num) }));
                          }
                        }}
                        placeholder="自動"
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 pr-8 font-mono text-sm font-bold text-center text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400 pointer-events-none">日</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">週タスク有効期限</label>
                  <select
                    value={activeTable.weeklyTaskExpiryWeeks === 'none' ? 'none' : activeTable.weeklyTaskExpiryWeeks === 2 ? '2' : '1'}
                    onChange={(e) => {
                      const val = e.target.value;
                      const expiry = val === 'none' ? 'none' : val === '2' ? 2 : 1;
                      updateActiveTable((prev) => ({
                        ...prev,
                        weeklyTaskExpiryWeeks: expiry,
                        axisConfig: { ...prev.axisConfig, weeklyTaskExpiryWeeks: expiry },
                      }));
                    }}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs cursor-pointer"
                  >
                    <option value="1">1週間 (当週内・基本)</option>
                    <option value="2">2週間</option>
                    <option value="none">期限なし</option>
                  </select>
                </div>
              </div>

              {/* セクション 6: 📌 付随タスク設定 (連動タスクオプション) */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-blue-600" />
                  <span>付随タスク設定</span>
                </h4>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">付随タスクの連動生成</span>
                      <p className="text-[10px] text-slate-500">講義直後に復習等のタスクを配置</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activeTable.attachedTaskConfig?.enabled ?? false}
                      onClick={() => {
                        const nextEnabled = !(activeTable.attachedTaskConfig?.enabled ?? false);
                        const defaultPeriod = Math.min(
                          180,
                          Math.max(1, activeTable.axisConfig.periodMinutes || 90),
                        );
                        updateActiveTable((prev) => ({
                          ...prev,
                          attachedTaskConfig: {
                            enabled: nextEnabled,
                            titleTemplate: prev.attachedTaskConfig?.titleTemplate || '{title} のタスク',
                            durationMinutes: prev.attachedTaskConfig?.durationMinutes || defaultPeriod,
                          },
                        }));
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden ${
                        activeTable.attachedTaskConfig?.enabled ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ${
                          activeTable.attachedTaskConfig?.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {activeTable.attachedTaskConfig?.enabled && (
                    <div className="pt-2 border-t border-slate-200/60 space-y-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">所要時間</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min={1}
                            max={180}
                            step={5}
                            value={
                              activeTable.attachedTaskConfig.durationMinutes ||
                              Math.min(180, activeTable.axisConfig.periodMinutes || 90)
                            }
                            onChange={(e) => {
                              const num = parseInt(e.target.value, 10);
                              if (!isNaN(num) && num >= 1) {
                                updateActiveTable((prev) => ({
                                  ...prev,
                                  attachedTaskConfig: {
                                    ...prev.attachedTaskConfig,
                                    enabled: true,
                                    titleTemplate: prev.attachedTaskConfig?.titleTemplate || '{title} のタスク',
                                    durationMinutes: num,
                                  },
                                }));
                              }
                            }}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-white pr-7 text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                          />
                          <span className="absolute right-2.5 text-[10px] font-bold text-slate-400 pointer-events-none">分</span>
                        </div>
                      </div>

                      {/* Plan16: 分割回数 */}
                      <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800">分割回数</span>
                          <p className="text-[10px] text-slate-500">空きコマに合わせて復習を分散</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="relative w-20">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={activeTable.attachedTaskConfig?.allowSplit ? (activeTable.attachedTaskConfig.splitCount || 2) : 1}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                updateActiveTable((prev) => ({
                                  ...prev,
                                  attachedTaskConfig: {
                                    ...prev.attachedTaskConfig,
                                    enabled: true,
                                    titleTemplate: prev.attachedTaskConfig?.titleTemplate || '{title} のタスク',
                                    durationMinutes:
                                      prev.attachedTaskConfig?.durationMinutes || prev.axisConfig.periodMinutes || 90,
                                    allowSplit: val > 1,
                                    splitCount: val > 1 ? val : undefined,
                                  },
                                }));
                              }}
                              className="w-full h-8 rounded-lg border border-slate-200 bg-white pr-6 text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                            />
                            <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 pointer-events-none">回</span>
                          </div>
                          {activeTable.attachedTaskConfig?.allowSplit && (activeTable.attachedTaskConfig.splitCount || 2) > 1 && (
                            <span className="text-[10px] text-indigo-700 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                              {Math.floor((activeTable.attachedTaskConfig.durationMinutes || activeTable.axisConfig.periodMinutes || 90) / (activeTable.attachedTaskConfig.splitCount || 2))}分×{activeTable.attachedTaskConfig.splitCount || 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* セクション 7: 📥 データ操作・管理 (後処理・メンテナンス) */}
              <div className="space-y-2 pt-3">
                <button
                  type="button"
                  onClick={handleCopyCsv}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition"
                >
                  <Copy className="h-4 w-4 text-slate-500" />
                  <span>CSV形式でクリップボードへコピー</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    setIsMobileSettingsOpen(false);
                    handleDeleteTable(activeTable.id, e);
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-600 shadow-2xs hover:bg-red-100 active:scale-98 transition mt-2"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                  <span>この時間割データを削除</span>
                </button>
              </div>
            </div>

            {/* ドロワーフッター */}
            <div className="border-t border-slate-200 p-3 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setIsMobileSettingsOpen(false)}
                className="w-full h-11 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-98 transition flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>完了して時間割に戻る</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          Mobile Table Switcher Sheet: 下から出る時間割切り替えシート
          ======================================================== */}
      {isMobileSwitcherOpen && (
        <div className="fixed inset-0 z-[70] flex items-end">
          {/* 背景オーバーレイ */}
          <div
            onClick={() => setIsMobileSwitcherOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
          />

          {/* ボトムシートコンテナ */}
          <div className="relative z-10 flex w-full max-h-[80vh] flex-col rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-250 overflow-hidden">
            {/* 上部ハンドル ＆ ヘッダー */}
            <div className="flex flex-col items-center pt-2.5 pb-2 px-4 border-b border-slate-100">
              <div className="h-1 w-10 rounded-full bg-slate-300 mb-2" />
              <div className="flex w-full items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">時間割・データの切り替え</h3>
                <button
                  type="button"
                  onClick={() => setIsMobileSwitcherOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* テーブル一覧リスト */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* 一番上に配置: 新しい表を追加ボタン */}
              <button
                type="button"
                onClick={() => {
                  handleAddNewTable();
                  setIsMobileSwitcherOpen(false);
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/70 text-xs font-bold text-blue-700 hover:bg-blue-100 shadow-2xs active:scale-98 transition mb-3 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>新しい表を追加</span>
              </button>

              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                時間割データ一覧 ({tables.length}件)
              </div>

              {tables.map((t, index) => {
                const isSelected = t.id === selectedItemId;
                const isEditingThisTable = editingMobileTableId === t.id;
                const tColor = getTableColorSchemeByIndex(
                  t.colorIndex !== undefined ? t.colorIndex : index,
                );

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (!isEditingThisTable) {
                        handleSelectItem(t.id);
                        setIsMobileSwitcherOpen(false);
                      }
                    }}
                    className={`flex items-center justify-between rounded-2xl p-3 border transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/80 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                      <div
                        className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs"
                        style={{ backgroundColor: tColor.strip }}
                      >
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>

                      {isEditingThisTable ? (
                        <div
                          className="flex items-center gap-1.5 flex-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={mobileTempTableName}
                            onChange={(e) => setMobileTempTableName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveMobileTableName(t.id);
                              if (e.key === 'Escape') setEditingMobileTableId(null);
                            }}
                            autoFocus
                            className="flex-1 h-8 rounded-lg border border-blue-400 bg-white px-2 text-xs font-bold text-slate-800 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveMobileTableName(t.id)}
                            className="h-8 px-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-2xs cursor-pointer active:scale-95"
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMobileTableId(null)}
                            className="h-8 px-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-slate-800 truncate flex items-center gap-1.5">
                            <span className="truncate">{t.name}</span>
                            {isSelected && (
                              <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.2 rounded-full shrink-0">
                                選択中
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {t.numRows}行 × {t.numCols}列
                            {isTableApplied(t) ? (
                              <span className="ml-2 font-bold text-emerald-600">● 反映ON</span>
                            ) : (
                              <span className="ml-2 font-medium text-slate-400">○ 反映OFF</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 右側アクション群: 反映スイッチ, 編集ボタン, 削除ボタン */}
                    {!isEditingThisTable && (
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* 反映オン/オフトグル */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isTableApplied(t)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTableApply(t);
                          }}
                          title={`「${t.name}」の計画表への反映を${isTableApplied(t) ? 'オフ' : 'オン'}にする`}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            isTableApplied(t) ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              isTableApplied(t) ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        {/* 名前編集ボタン */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMobileTableId(t.id);
                            setMobileTempTableName(t.name);
                          }}
                          title="テーブル名を変更"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* 削除ボタン */}
                        {tables.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTable(t.id, e);
                            }}
                            title="表を削除"
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* システム管理ファイルへのリンク */}
              <div className="pt-3 border-t border-slate-100 mt-3 space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">
                  固定枠・タスク管理
                </div>
                <div
                  onClick={() => {
                    handleSelectItem('sys-slots');
                    setIsMobileSwitcherOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    selectedItemId === 'sys-slots'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span>固定枠 (生活リズム・授業)</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isSlotsApplied}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInclusionSettingsChange?.({
                        enableSlots: !isSlotsApplied,
                        enableDailyTasks: isDailyApplied,
                        enableWeeklyTasks: isWeeklyApplied,
                      });
                    }}
                    title="固定枠の計画表への反映ON/OFF"
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      isSlotsApplied ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                        isSlotsApplied ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div
                  onClick={() => {
                    handleSelectItem('sys-daily');
                    setIsMobileSwitcherOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    selectedItemId === 'sys-daily'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span>日のタスク (日課・ルーティン)</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isDailyApplied}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInclusionSettingsChange?.({
                        enableSlots: isSlotsApplied,
                        enableDailyTasks: !isDailyApplied,
                        enableWeeklyTasks: isWeeklyApplied,
                      });
                    }}
                    title="日のタスクの計画表への反映ON/OFF"
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      isDailyApplied ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                        isDailyApplied ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div
                  onClick={() => {
                    handleSelectItem('sys-weekly');
                    setIsMobileSwitcherOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    selectedItemId === 'sys-weekly'
                      ? 'bg-purple-50 text-purple-800 border border-purple-200'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-purple-600" />
                    <span>週のタスク (目標・課題・週次)</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isWeeklyApplied}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInclusionSettingsChange?.({
                        enableSlots: isSlotsApplied,
                        enableDailyTasks: isDailyApplied,
                        enableWeeklyTasks: !isWeeklyApplied,
                      });
                    }}
                    title="週タスクの計画表への反映ON/OFF"
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      isWeeklyApplied ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                        isWeeklyApplied ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* ボトムシートフッター */}
            <div className="border-t border-slate-200 p-3 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setIsMobileSwitcherOpen(false)}
                className="w-full h-11 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {applySuccessMsg && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-slate-900/90 text-white px-4 py-2.5 text-xs font-semibold shadow-xl backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{applySuccessMsg}</span>
        </div>
      )}

      {/* Plan22 テンプレートウィザードモーダル */}
      <TableTemplateWizardModal
        isOpen={isTemplateWizardOpen}
        onClose={() => setIsTemplateWizardOpen(false)}
        targetTable={activeTable}
        onApplyTable={(updatedTable) => {
          // 即時反映ロジックを呼び出して計画表に同期
          const { slots: newSlots, tasks: newTasks, slotIds, taskIds } =
            generateScheduleItemsForTable(updatedTable);
          let finalTable = updatedTable;
          if (newSlots.length > 0 || newTasks.length > 0) {
            const nextSlots = fixedSlots
              .filter((s) => s.sourceTableId !== updatedTable.id)
              .concat(newSlots);
            const nextTasks = tasks
              .filter((t) => t.sourceTableId !== updatedTable.id)
              .concat(newTasks);
            onSlotsChange(nextSlots);
            onTasksChange(nextTasks);
            finalTable = {
              ...updatedTable,
              isApplied: true,
              appliedSlotIds: slotIds,
              appliedTaskIds: taskIds,
            };
          }
          const exists = tables.some((t) => t.id === finalTable.id);
          const nextTables = exists
            ? tables.map((t) => (t.id === finalTable.id ? finalTable : t))
            : [...tables, finalTable];

          onTablesChange(nextTables);
          setSelectedItemId(finalTable.id);
          setApplySuccessMsg(
            exists
              ? `「${finalTable.name}」にテンプレート設定を適用しました`
              : `テンプレートから「${finalTable.name}」を作成しました`,
          );
          setTimeout(() => setApplySuccessMsg(null), 3000);
        }}
      />
    </div>
  );
}
