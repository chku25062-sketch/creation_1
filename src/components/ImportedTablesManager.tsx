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
  Sparkles,
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
  Palette,
  Hourglass,
} from 'lucide-react';
import { TABLE_PALETTE_OPTIONS, getTableColorSchemeByIndex } from '@/components/Timeline24h';
import {
  ImportedTableData,
  FixedSlot,
  TaskItem,
  ScheduleInclusionSettings,
  TableClassification,
  TableColumnMode,
  TablePlacementMode,
} from '@/types';
import { calculatePeriodTimes, timeStringToMinutes } from '@/lib/timeUtils';
import {
  getTableClassification,
  getTableColumnMode,
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
  onOpenImport?: () => void;
  onFileSelect?: (file: File) => void;
}

const WEEKDAY_HEADER_OPTIONS = [
  '月曜',
  '火曜',
  '水曜',
  '木曜',
  '金曜',
  '土曜',
  '日曜',
  '除外',
];

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

interface SemiInputProps {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  unit?: string;
  inputClassName?: string;
  title?: string;
}

/**
 * 手入力 ＋ プリセット選択が可能な半入力式コンボボックス
 */
function SemiInput({
  value,
  onChange,
  options,
  placeholder,
  unit,
  inputClassName = 'w-14 text-center',
  title,
}: SemiInputProps) {
  return (
    <div
      className="relative flex items-center rounded border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition"
      title={title}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-transparent px-1.5 py-0.5 text-xs font-bold text-slate-800 focus:outline-hidden ${inputClassName}`}
      />
      {unit && (
        <span className="text-[10px] text-slate-400 font-medium pr-0.5 pointer-events-none select-none shrink-0">
          {unit}
        </span>
      )}
      <div className="relative flex items-center pr-1 cursor-pointer shrink-0">
        <select
          value=""
          onChange={(e) => {
            onChange(e.target.value);
            e.target.value = '';
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="候補から選択"
        >
          <option value="" disabled>
            候補から選択
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="h-3 w-3 text-slate-400 hover:text-slate-600 transition pointer-events-none" />
      </div>
    </div>
  );
}

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
}: ImportedTablesManagerProps) {
  // ファイル直接選択用インライン参照
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (onFileSelect) {
        onFileSelect(selectedFile);
      } else if (onOpenImport) {
        onOpenImport();
      }
      e.target.value = '';
    }
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (onFileSelect) {
        onFileSelect(droppedFile);
      } else if (onOpenImport) {
        onOpenImport();
      }
    }
  };

  const handleTriggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else if (onOpenImport) {
      onOpenImport();
    }
  };

  // 選択中のファイルアイテム (固定枠: sys-slots, 日課: sys-daily, 週次: sys-weekly, 表データ: table.id)
  const [selectedItemId, setSelectedItemId] = useState<string>(tables[0]?.id || 'sys-slots');

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

  const dailyTasksCount = useMemo(() => {
    return tasks.filter((t) => t.period === 'day' || t.frequency === 'high').length;
  }, [tasks]);

  const weeklyTasksCount = useMemo(() => {
    return tasks.filter((t) => t.period !== 'day' && t.frequency !== 'high').length;
  }, [tasks]);

  // テーブル名編集モーダル/ステート
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTableName, setTempTableName] = useState('');

  // 表カラーピッカーの開閉ステート
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // カラーピッカー外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
    };
    if (isColorPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isColorPickerOpen]);

  // 現在選択中の表の有効カラーインデックス
  const activeTableColorIndex = useMemo(() => {
    if (!activeTable) return 0;
    if (activeTable.colorIndex !== undefined) return activeTable.colorIndex;
    const idx = tables.findIndex((t) => t.id === activeTable.id);
    return (idx >= 0 ? idx : 0) % TABLE_PALETTE_OPTIONS.length;
  }, [activeTable, tables]);

  const activeTablePalette = useMemo(() => {
    return getTableColorSchemeByIndex(activeTableColorIndex);
  }, [activeTableColorIndex]);

  // 時限個別調整アコーディオンの開閉
  const [showCustomTimes, setShowCustomTimes] = useState(false);
  const hasCustomTimes = useMemo(() => {
    if (!activeTable?.axisConfig.customRowTimes) return false;
    return Object.keys(activeTable.axisConfig.customRowTimes).length > 0;
  }, [activeTable]);

  // セル編集ステート
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [cellEditText, setCellEditText] = useState('');
  const [cellBreakMinutes, setCellBreakMinutes] = useState<number>(0);
  const [cellAttachedEnabled, setCellAttachedEnabled] = useState<boolean>(false);
  const [cellAttachedTitle, setCellAttachedTitle] = useState<string>('');
  const [cellAttachedDuration, setCellAttachedDuration] = useState<number>(15);

  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  // テーブル更新ヘルパー
  const updateActiveTable = (updater: (prev: ImportedTableData) => ImportedTableData) => {
    if (!activeTable) return;
    const nextTable = updater(activeTable);
    const updated = tables.map((t) => (t.id === activeTable.id ? nextTable : t));
    onTablesChange(updated);

    // もし計画表に反映中のテーブルであれば、固定枠 & タスクも自動再同期
    if (isTableApplied(nextTable)) {
      const { slots: newSlots, tasks: newTasks, slotIds, taskIds } =
        generateScheduleItemsForTable(nextTable);

      const filteredSlots = fixedSlots.filter(
        (s) =>
          s.sourceTableId !== nextTable.id &&
          !s.id.startsWith(`slot-table-${nextTable.id}-`) &&
          !s.id.startsWith(`slot-lecture-${nextTable.id}-`) &&
          !(nextTable.appliedSlotIds && nextTable.appliedSlotIds.includes(s.id)),
      );
      onSlotsChange([...filteredSlots, ...newSlots]);

      const filteredTasks = tasks.filter(
        (t) =>
          t.sourceTableId !== nextTable.id &&
          !t.id.startsWith(`task-table-${nextTable.id}-`) &&
          !t.id.startsWith(`task-attached-${nextTable.id}-`) &&
          !t.id.startsWith(`task-assignment-${nextTable.id}-`) &&
          !(nextTable.appliedTaskIds && nextTable.appliedTaskIds.includes(t.id)),
      );
      onTasksChange([...filteredTasks, ...newTasks]);
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
  }, [selectedItemId, isSlotsApplied, isDailyApplied, isWeeklyApplied, activeTable, fixedSlots, tasks]);

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
        t.id === table.id
          ? { ...t, isApplied: false, appliedSlotIds: [], appliedTaskIds: [] }
          : t,
      );
      onTablesChange(updated);

      setApplySuccessMsg(`「${table.name}」の反映を解除しました`);
      setTimeout(() => setApplySuccessMsg(null), 3000);
    } else {
      // 反映 (ON)
      const { slots: newSlots, tasks: newTasks, slotIds, taskIds } =
        generateScheduleItemsForTable(table);

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

  // 表の列管理方式（曜日 vs 周期）
  const tableColumnMode: TableColumnMode = useMemo(() => {
    return activeTable ? getTableColumnMode(activeTable) : 'weekday';
  }, [activeTable]);

  // 列管理方式の切り替えハンドラー (表左上のマスで切り替え)
  const handleToggleColumnMode = (newMode: TableColumnMode) => {
    updateActiveTable((prev) => setTableColumnMode(prev, newMode));
    setApplySuccessMsg(
      newMode === 'cycle'
        ? '列の基準を「周期（Day 1, 2...）」に切り替えました'
        : '列の基準を「曜日（月曜, 火曜...）」に切り替えました',
    );
    setTimeout(() => setApplySuccessMsg(null), 3000);
  };

  // 表レイアウト・プリセット一括変更（曜日、周期、1列リスト）
  const handleApplyPreset = (preset: 'weekday' | 'cycle3' | 'single') => {
    updateActiveTable((prev) => {
      if (preset === 'weekday') {
        const targetCols = 5;
        const headers = ['月曜', '火曜', '水曜', '木曜', '金曜'];
        const nextCells = prev.cells.map((row) => {
          const newRow = row.slice(0, targetCols);
          while (newRow.length < targetCols) {
            const cIdx = newRow.length;
            newRow.push({
              dayIndex: cIdx,
              periodIndex: row[0]?.periodIndex || 1,
              text: null,
              rawLines: [],
              fullText: '',
              title: '',
              roomOrNote: '',
              startMinutes: 0,
              endMinutes: 0,
            });
          }
          return newRow;
        });
        return {
          ...prev,
          numCols: targetCols,
          colHeaders: headers,
          cells: nextCells,
          updatedAt: new Date().toISOString(),
        };
      } else if (preset === 'cycle3') {
        const targetCols = 3;
        const headers = ['Day 1', 'Day 2', 'Day 3'];
        const nextCells = prev.cells.map((row) => {
          const newRow = row.slice(0, targetCols);
          while (newRow.length < targetCols) {
            const cIdx = newRow.length;
            newRow.push({
              dayIndex: cIdx,
              periodIndex: row[0]?.periodIndex || 1,
              text: null,
              rawLines: [],
              fullText: '',
              title: '',
              roomOrNote: '',
              startMinutes: 0,
              endMinutes: 0,
            });
          }
          return newRow;
        });
        return {
          ...prev,
          numCols: targetCols,
          colHeaders: headers,
          cells: nextCells,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // 1列リスト (フリー)
        const targetCols = 1;
        const headers = ['タスク一覧'];
        const nextCells = prev.cells.map((row) => row.slice(0, 1));
        return {
          ...prev,
          numCols: 1,
          colHeaders: headers,
          cells: nextCells,
          updatedAt: new Date().toISOString(),
        };
      }
    });
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

      return {
        ...prev,
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
    setCellAttachedEnabled(
      cell.attachedTask?.enabled ?? activeTable.attachedTaskConfig?.enabled ?? false,
    );
    setCellAttachedTitle(
      cell.attachedTask?.title ||
        activeTable.attachedTaskConfig?.titleTemplate ||
        '{title} のタスク',
    );
    setCellAttachedDuration(
      cell.attachedTask?.durationMinutes ||
        activeTable.attachedTaskConfig?.durationMinutes ||
        15,
    );
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
              attachedTask: cellAttachedEnabled
                ? {
                    enabled: true,
                    title: cellAttachedTitle,
                    durationMinutes: cellAttachedDuration,
                  }
                : undefined,
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

    setEditingCell(null);
  };

  // セルのクリア
  const handleClearCell = (r: number, c: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

  // 新規テーブル作成（空テーブル）
  const handleAddNewTable = () => {
    const newId = `table-${Date.now()}`;
    const newTable: ImportedTableData = {
      id: newId,
      name: `新しい表 ${tables.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      numRows: 5,
      numCols: 5,
      colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜'],
      rowHeaders: ['1', '2', '3', '4', '5'],
      dailyRepeatCount: 'auto',
      colorIndex: tables.length % TABLE_PALETTE_OPTIONS.length,
      axisConfig: {
        startTime: '09:00',
        periodMinutes: 90,
        intervalMinutes: 10,
        hasLunch: true,
        lunchAfterPeriod: 2,
        lunchMinutes: 50,
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
    if (confirm(`この読み込みデータ「${tables.find((t) => t.id === id)?.name}」を削除しますか？`)) {
      const filtered = tables.filter((t) => t.id !== id);
      onTablesChange(filtered);
      if (selectedItemId === id) {
        setSelectedItemId(filtered[0]?.id || 'sys-slots');
      }
    }
  };

  return (
    <div className="relative flex flex-1 min-h-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      {/* スマホ用 ドロワー背景オーバーレイ (Backdrop) */}
      <div
        onClick={() => setIsSidebarOpen(false)}
        className={`absolute inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* ========================================================
          Left Sidebar: データファイル一覧
          - スマホ: absolute 配置のドロワー（フッターまで覆わず、メイン画面の幅にも影響を与えない）
          - PC: インライン relative 配置
          ======================================================== */}
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
                className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
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
                  className="w-full rounded-md border border-slate-200 bg-white py-1 pl-8 pr-6 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500/20 shadow-2xs"
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
                className="flex h-7.5 w-7.5 items-center justify-center rounded-md border border-blue-200 bg-white text-blue-600 shadow-2xs hover:bg-blue-50 hover:border-blue-400 transition"
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-400">{filteredTables.length}</span>
                    <button
                      onClick={handleAddNewTable}
                      title="手動で新しい表を追加"
                      className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 tracking-normal"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      <span>新規</span>
                    </button>
                    {(onFileSelect || onOpenImport) && (
                      <button
                        onClick={handleTriggerFileSelect}
                        title="画像・ファイルから表を取り込む"
                        className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline tracking-normal"
                      >
                        <Upload className="h-2.5 w-2.5" />
                        <span>取込</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
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
                        title={`${t.name} (カラー: ${tColor.strip})`}
                        className={`group relative flex items-center rounded-lg cursor-pointer transition ${
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
                                onBlur={() => {
                                  if (tempTableName.trim()) {
                                    updateActiveTable((prev) => ({
                                      ...prev,
                                      name: tempTableName.trim(),
                                      updatedAt: new Date().toISOString(),
                                    }));
                                  }
                                  setIsEditingName(false);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (tempTableName.trim()) {
                                      updateActiveTable((prev) => ({
                                        ...prev,
                                        name: tempTableName.trim(),
                                        updatedAt: new Date().toISOString(),
                                      }));
                                    }
                                    setIsEditingName(false);
                                  }
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
                            {isSidebarOpen ? (
                              <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono font-normal">
                                <span className="flex items-center gap-1.5">
                                  <span>
                                    {t.numRows}×{t.numCols} コマ
                                  </span>
                                  {dateStr && <span>{dateStr}</span>}
                                </span>
                                {isTableApplied(t) && (
                                  <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-700">
                                    ON
                                  </span>
                                )}
                              </div>
                            ) : (
                              isTableApplied(t) && (
                                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              )
                            )}
                          </div>
                        </div>

                        {/* Actions on Hover (展開時のみ) */}
                        {isSidebarOpen && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                            {isSelected && !isEditingName && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTempTableName(t.name);
                                  setIsEditingName(true);
                                }}
                                title="名前を変更"
                                className="rounded p-1 text-slate-400 hover:bg-slate-200/80 hover:text-blue-600"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            )}
                            {tables.length > 1 && (
                              <button
                                onClick={(e) => handleDeleteTable(t.id, e)}
                                title="表を削除"
                                className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Section 2: 計画表インスペクター (可視化・点検サブツール) */}
            <div className="pt-2 border-t border-slate-200">
              <div
                className={`${
                  isSidebarOpen
                    ? 'px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase'
                    : 'px-1 py-0.5 text-[9px] font-bold text-slate-400 text-center uppercase tracking-tighter'
                }`}
              >
                {isSidebarOpen ? '🔍 計画表インスペクター' : '確認'}
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
                    className={`group relative flex items-center rounded-lg cursor-pointer transition ${
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
                        {isSidebarOpen ? (
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>睡眠・講義・勤務等 ({fixedSlots.length}件)</span>
                            {isSlotsApplied && (
                              <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-700">
                                ON
                              </span>
                            )}
                          </div>
                        ) : (
                          isSlotsApplied && (
                            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )
                        )}
                      </div>
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
                    className={`group relative flex items-center rounded-lg cursor-pointer transition ${
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
                        {isSidebarOpen ? (
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>今日用いられているタスク</span>
                            {isDailyApplied && (
                              <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-700">
                                ON
                              </span>
                            )}
                          </div>
                        ) : (
                          isDailyApplied && (
                            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )
                        )}
                      </div>
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
                    className={`group relative flex items-center rounded-lg cursor-pointer transition ${
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
                        {isSidebarOpen ? (
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>今週用いられているタスク ({tasks.length}件)</span>
                            {isWeeklyApplied && (
                              <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-700">
                                ON
                              </span>
                            )}
                          </div>
                        ) : (
                          isWeeklyApplied && (
                            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )
                        )}
                      </div>
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

          {/* Sidebar Footer: インライン組み込みファイル取り込みゾーン */}
          <div
            className={`shrink-0 border-t border-slate-200 bg-slate-100/70 ${
              isSidebarOpen ? 'p-2 space-y-2' : 'p-1.5 flex flex-col items-center gap-1.5'
            }`}
          >
            {isSidebarOpen ? (
              <>
                {/* あらかじめ組み込まれたファイル取り込み・ドロップ枠 */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDropFile}
                  onClick={handleTriggerFileSelect}
                  className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 text-center cursor-pointer transition select-none shadow-2xs ${
                    isDragging
                      ? 'border-blue-600 bg-blue-100/80 scale-[0.99] ring-2 ring-blue-400'
                      : 'border-blue-300 bg-white hover:border-blue-500 hover:bg-blue-50/70'
                  }`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs mb-1.5">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    時間割ファイルを追加
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    ここにドロップ または クリックして選択
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 font-mono">
                    画像 (スクショ等) / CSV / テキスト
                  </div>
                </div>

                <button
                  onClick={handleAddNewTable}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                >
                  <Plus className="h-3 w-3 text-slate-400" />
                  <span>手動で空の表を追加</span>
                </button>
              </>
            ) : (
              <>
                {/* 折りたたみ時: ドロップ対応のコンパクトボタン */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDropFile}
                  onClick={handleTriggerFileSelect}
                  title="時間割ファイルを追加 (クリックで選択 / ドロップ対応)"
                  className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition select-none shadow-2xs ${
                    isDragging
                      ? 'border-blue-600 bg-blue-100 text-blue-700 scale-95'
                      : 'border-blue-300 bg-white text-blue-600 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-[8px] font-bold leading-none mt-0.5">追加</span>
                </div>

                <button
                  onClick={handleAddNewTable}
                  title="手動で新しい表を追加"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================
          Right Main Area: プレビュー & 軸・インターバル定義詳細
          ======================================================== */}
      <main
        className="flex flex-1 min-w-0 w-full flex-col bg-white p-2.5 sm:p-3 gap-2 overflow-hidden min-h-0"
      >

        {/* Explorer Path / Breadcrumb & Top Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          {/* Breadcrumb Path & Mobile Sidebar Toggle */}
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            {/* スマホ用: データ一覧バーを開くボタン */}
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
                <span className="font-medium text-slate-600 shrink-0">基本設定</span>
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
                <span className="font-bold text-slate-900 truncate">{activeTable.name}</span>
                {/* 表カラーインジケーター（色の丸アイコンのみ表示・名前省略） */}
                <button
                  type="button"
                  onClick={() => setIsColorPickerOpen((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-md p-1 border transition hover:scale-105 cursor-pointer shadow-2xs"
                  style={{
                    backgroundColor: activeTablePalette.badgeBg,
                    borderColor: activeTablePalette.badgeBorder,
                  }}
                  title={`表のカラー: ${TABLE_PALETTE_OPTIONS[activeTableColorIndex]?.name || 'カラー'} (クリックで変更)`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: activeTablePalette.strip }}
                  />
                </button>
                {!isEditingName && (
                  <button
                    onClick={() => {
                      setTempTableName(activeTable.name);
                      setIsEditingName(true);
                    }}
                    title="テーブル名を編集"
                    className="ml-1 text-slate-400 hover:text-blue-600"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 text-slate-400">
                <span>表が選択されていません</span>
              </div>
            )}
          </div>

          {/* 計画表への反映 ON/OFF トグル */}
          {(isSystemFile || activeTable) && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                計画表へ反映:
              </span>
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
              <span
                className={`text-[11px] sm:text-xs font-bold min-w-[24px] select-none ${
                  isCurrentItemApplied ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {isCurrentItemApplied ? 'ON' : 'OFF'}
              </span>
            </div>
          )}
        </div>

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
            />
          </div>
        ) : !activeTable ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">読み込み表データがありません</p>
              <p className="mt-1 text-xs text-slate-400">
                左サイドバーの「新規」ボタンまたはファイル取込から表を追加してください。
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
            {/* ========================================================
                Excel風 コンパクトツールバー
                - 始業時間、1コマ分数、休憩、昼休みのクイックインライン設定
                - 時限微調整トグル
                - 全体稼働時間 & 表サイズサマリー
                ======================================================== */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-slate-200/90 bg-slate-50/95 px-2.5 py-1.5 text-xs text-slate-700 shadow-2xs">
              {/* Left: 分類バッジ ＆ 時間軸・付随タスク・行列クイック設定 */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* 配置方法の選択（固定配置 / 自動配置） */}
                {(() => {
                  const isFixed =
                    activeTable.placementMode === 'fixed' ||
                    (activeTable.placementMode === undefined &&
                      activeTable.axisConfig.startTime !== null &&
                      activeTable.axisConfig.startTime !== undefined &&
                      activeTable.axisConfig.startTime !== 'unset' &&
                      activeTable.axisConfig.startTime !== '自動' &&
                      activeTable.axisConfig.startTime !== 'auto');
                  const currentMode: TablePlacementMode = isFixed ? 'fixed' : 'auto';

                  return (
                    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
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

                {/* 現在分類の表示（選択不可・自動判定結果を表示） */}
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
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs select-none"
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

                {/* 表カラー選択ドロップダウン（色のアイコンのみ表示） */}
                <div className="relative" ref={colorPickerRef}>
                  <button
                    type="button"
                    onClick={() => setIsColorPickerOpen((prev) => !prev)}
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer"
                    title={`表カラー: ${TABLE_PALETTE_OPTIONS[activeTableColorIndex]?.name || 'カスタム'} (クリックで変更)`}
                  >
                    <Palette className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span
                      className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10 shadow-2xs shrink-0"
                      style={{ backgroundColor: activeTablePalette.strip }}
                    />
                    <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
                  </button>

                  {isColorPickerOpen && (
                    <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          <Palette className="h-3.5 w-3.5 text-slate-500" />
                          表のカラーを選択
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsColorPickerOpen(false)}
                          className="text-slate-400 hover:text-slate-600 rounded p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {TABLE_PALETTE_OPTIONS.map((opt) => {
                          const isSelected = activeTableColorIndex === opt.index;
                          return (
                            <button
                              key={`color-opt-${opt.index}`}
                              type="button"
                              onClick={() => {
                                updateActiveTable((prev) => ({
                                  ...prev,
                                  colorIndex: opt.index,
                                  updatedAt: new Date().toISOString(),
                                }));
                                setIsColorPickerOpen(false);
                                setApplySuccessMsg(`表のカラーを「${opt.name}」に変更しました`);
                                setTimeout(() => setApplySuccessMsg(null), 2500);
                              }}
                              className={`group relative flex flex-col items-center justify-center rounded-lg p-1.5 transition border ${
                                isSelected
                                  ? 'ring-2 ring-blue-500 border-blue-400 font-bold scale-105'
                                  : 'hover:scale-105 border-slate-200/80 hover:border-slate-300'
                              }`}
                              style={{ backgroundColor: opt.color.bg }}
                              title={opt.name}
                            >
                              <div
                                className="h-4 w-4 rounded-full shadow-2xs ring-1 ring-white/80 flex items-center justify-center"
                                style={{ backgroundColor: opt.color.strip }}
                              >
                                {isSelected && (
                                  <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
                                )}
                              </div>
                              <span
                                className="mt-1 text-[9px] truncate max-w-full leading-tight font-medium"
                                style={{ color: opt.color.text }}
                              >
                                {opt.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 1日の中の繰り返し回数（半入力式） */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <Repeat className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    1日:
                  </span>
                  <SemiInput
                    value={
                      activeTable.dailyRepeatCount === 'auto' || activeTable.dailyRepeatCount === undefined
                        ? '指定なし'
                        : String(activeTable.dailyRepeatCount)
                    }
                    onChange={(val) => {
                      const trimmed = val.trim();
                      if (
                        trimmed === '指定なし' ||
                        trimmed === '自動' ||
                        trimmed === 'auto' ||
                        trimmed === '' ||
                        trimmed === '0'
                      ) {
                        updateActiveTable((prev) => ({ ...prev, dailyRepeatCount: 'auto' }));
                      } else {
                        const num = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
                        updateActiveTable((prev) => ({
                          ...prev,
                          dailyRepeatCount: isNaN(num) || num <= 0 ? 'auto' : num,
                        }));
                      }
                    }}
                    placeholder="指定なし"
                    unit="回"
                    inputClassName="w-13 text-center"
                    options={[
                      { label: '🌟 指定なし', value: 'auto' },
                      { label: '1回', value: '1' },
                      { label: '2回', value: '2' },
                      { label: '3回', value: '3' },
                      { label: '4回', value: '4' },
                      { label: '5回', value: '5' },
                      { label: '6回', value: '6' },
                      { label: '7回', value: '7' },
                      { label: '8回', value: '8' },
                      { label: '10回', value: '10' },
                    ]}
                    title="1日の中での繰り返し回数（手入力または候補選択）"
                  />
                </div>

                {/* 週に入れる日ブロックの量（半入力式） */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <CalendarRange className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    週:
                  </span>
                  <SemiInput
                    value={
                      activeTable.weeklyRepeatCount === 'auto' || activeTable.weeklyRepeatCount === undefined
                        ? '指定なし'
                        : String(activeTable.weeklyRepeatCount)
                    }
                    onChange={(val) => {
                      const trimmed = val.trim();
                      if (
                        trimmed === '指定なし' ||
                        trimmed === '自動' ||
                        trimmed === 'auto' ||
                        trimmed === '' ||
                        trimmed === '0'
                      ) {
                        updateActiveTable((prev) => ({ ...prev, weeklyRepeatCount: 'auto' }));
                      } else {
                        const num = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
                        updateActiveTable((prev) => ({
                          ...prev,
                          weeklyRepeatCount: isNaN(num) || num <= 0 ? 'auto' : Math.min(7, num),
                        }));
                      }
                    }}
                    placeholder="指定なし"
                    unit="回"
                    inputClassName="w-13 text-center"
                    options={[
                      { label: '🌟 指定なし', value: 'auto' },
                      { label: '週1回 (週1日)', value: '1' },
                      { label: '週2回 (週2日)', value: '2' },
                      { label: '週3回 (週3日)', value: '3' },
                      { label: '週4回 (週4日)', value: '4' },
                      { label: '週5回 (週5日)', value: '5' },
                      { label: '週6回 (週6日)', value: '6' },
                      { label: '週7回 (毎日)', value: '7' },
                    ]}
                    title="週に入れる日ブロックの量（週何日行うか、手入力または候補選択）"
                  />
                </div>

                {/* 週タスク有効期限（半入力式） */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <Hourglass className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    有効期限:
                  </span>
                  <SemiInput
                    value={
                      activeTable.weeklyTaskExpiryWeeks === 'none'
                        ? '期限なし'
                        : activeTable.weeklyTaskExpiryWeeks === 2
                          ? '2週間'
                          : '1週間'
                    }
                    onChange={(val) => {
                      const trimmed = val.trim();
                      if (
                        trimmed === '期限なし' ||
                        trimmed === 'なし' ||
                        trimmed === 'none' ||
                        trimmed === '無制限'
                      ) {
                        updateActiveTable((prev) => ({
                          ...prev,
                          weeklyTaskExpiryWeeks: 'none',
                          axisConfig: { ...prev.axisConfig, weeklyTaskExpiryWeeks: 'none' },
                        }));
                      } else if (trimmed.includes('2')) {
                        updateActiveTable((prev) => ({
                          ...prev,
                          weeklyTaskExpiryWeeks: 2,
                          axisConfig: { ...prev.axisConfig, weeklyTaskExpiryWeeks: 2 },
                        }));
                      } else {
                        updateActiveTable((prev) => ({
                          ...prev,
                          weeklyTaskExpiryWeeks: 1,
                          axisConfig: { ...prev.axisConfig, weeklyTaskExpiryWeeks: 1 },
                        }));
                      }
                    }}
                    placeholder="1週間 (基本)"
                    inputClassName="w-16 text-center"
                    options={[
                      { label: '🌟 1週間 (当週内・基本)', value: '1週間' },
                      { label: '2週間', value: '2週間' },
                      { label: '期限なし', value: '期限なし' },
                    ]}
                    title="週タスクの有効期限（手入力または候補選択）"
                  />
                </div>

                {/* 開始時間（半入力式） */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    開始:
                  </span>
                  <SemiInput
                    value={activeTable.axisConfig.startTime ?? ''}
                    onChange={(val) => {
                      const trimmed = val.trim();
                      if (!trimmed || trimmed === 'unset' || trimmed === '未設定' || trimmed === '自動') {
                        handleAxisConfigChange('startTime', null);
                      } else {
                        handleAxisConfigChange('startTime', trimmed);
                      }
                    }}
                    placeholder="未設定 (自動)"
                    inputClassName="w-24 text-center"
                    options={[
                      { label: '🌟 未設定 (自動)', value: 'unset' },
                      { label: '06:00', value: '06:00' },
                      { label: '07:00', value: '07:00' },
                      { label: '08:00', value: '08:00' },
                      { label: '08:30', value: '08:30' },
                      { label: '08:50', value: '08:50' },
                      { label: '09:00', value: '09:00' },
                      { label: '09:30', value: '09:30' },
                      { label: '10:00', value: '10:00' },
                      { label: '13:00', value: '13:00' },
                      { label: '17:00', value: '17:00' },
                      { label: '18:00', value: '18:00' },
                      { label: '19:00', value: '19:00' },
                    ]}
                    title="開始時間（例: 08:30、手入力または候補選択）"
                  />
                </div>

                {/* 終了上限時刻（半入力式） */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    終了:
                  </span>
                  <SemiInput
                    value={activeTable.axisConfig.endTime ?? ''}
                    onChange={(val) => {
                      const trimmed = val.trim();
                      if (
                        !trimmed ||
                        trimmed === 'unset' ||
                        trimmed === '未設定' ||
                        trimmed === '自動' ||
                        trimmed === '最大値' ||
                        trimmed === '自動 (最大値)'
                      ) {
                        handleAxisConfigChange('endTime', null);
                      } else {
                        handleAxisConfigChange('endTime', trimmed);
                      }
                    }}
                    placeholder="自動 (最大値)"
                    inputClassName="w-24 text-center"
                    options={[
                      { label: '🌟 自動 (最大値)', value: 'unset' },
                      { label: '12:00', value: '12:00' },
                      { label: '13:00', value: '13:00' },
                      { label: '15:00', value: '15:00' },
                      { label: '17:00', value: '17:00' },
                      { label: '18:00', value: '18:00' },
                      { label: '19:00', value: '19:00' },
                      { label: '20:00', value: '20:00' },
                      { label: '21:00', value: '21:00' },
                      { label: '22:00', value: '22:00' },
                      { label: '23:00', value: '23:00' },
                      { label: '24:00', value: '24:00' },
                    ]}
                    title="終了上限時刻（これ以上先の時刻には配置しない。手入力または候補選択）"
                  />
                </div>

                {/* 1コマ分数（半入力式） */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    1コマ:
                  </span>
                  <SemiInput
                    value={
                      activeTable.axisConfig.periodMinutes !== null && activeTable.axisConfig.periodMinutes !== undefined
                        ? String(activeTable.axisConfig.periodMinutes)
                        : ''
                    }
                    onChange={(val) => {
                      const trimmed = val.trim();
                      if (!trimmed || trimmed === '0' || trimmed === 'unset' || trimmed === '未設定' || trimmed === '自動') {
                        handleAxisConfigChange('periodMinutes', null);
                      } else {
                        const num = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
                        handleAxisConfigChange('periodMinutes', isNaN(num) || num <= 0 ? null : num);
                      }
                    }}
                    placeholder="自動"
                    unit="分"
                    inputClassName="w-12 text-center"
                    options={[
                      { label: '🌟 未設定 (自動)', value: 'unset' },
                      { label: '90分', value: '90' },
                      { label: '60分', value: '60' },
                      { label: '50分', value: '50' },
                      { label: '45分', value: '45' },
                      { label: '40分', value: '40' },
                      { label: '30分', value: '30' },
                      { label: '25分', value: '25' },
                      { label: '20分', value: '20' },
                      { label: '15分', value: '15' },
                    ]}
                    title="1コマの分数（手入力または候補選択）"
                  />
                </div>

                {/* コマ間休憩（半入力式） */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    休憩:
                  </span>
                  <SemiInput
                    value={
                      activeTable.axisConfig.intervalMinutes === null || activeTable.axisConfig.intervalMinutes === undefined
                        ? ''
                        : activeTable.axisConfig.intervalMinutes === 0
                          ? '0'
                          : String(activeTable.axisConfig.intervalMinutes)
                    }
                    onChange={(val) => {
                      const trimmed = val.trim();
                      if (!trimmed || trimmed === 'unset' || trimmed === '未設定' || trimmed === '自動') {
                        handleAxisConfigChange('intervalMinutes', null);
                      } else if (trimmed === '0' || trimmed === 'なし') {
                        handleAxisConfigChange('intervalMinutes', 0);
                      } else {
                        const num = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
                        handleAxisConfigChange('intervalMinutes', isNaN(num) ? null : num);
                      }
                    }}
                    placeholder="自動"
                    unit="分"
                    inputClassName="w-12 text-center"
                    options={[
                      { label: '🌟 未設定 (自動)', value: 'unset' },
                      { label: '0分 (なし)', value: '0' },
                      { label: '5分', value: '5' },
                      { label: '10分', value: '10' },
                      { label: '15分', value: '15' },
                      { label: '20分', value: '20' },
                      { label: '30分', value: '30' },
                      { label: '45分', value: '45' },
                      { label: '60分', value: '60' },
                    ]}
                    title="コマ間の休憩/タスク後余白（手入力または候補選択）"
                  />
                </div>

                {/* 昼休み (開始時刻が設定されている場合のみ有効) */}
                {activeTable.axisConfig.startTime && (
                  <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={activeTable.axisConfig.hasLunch}
                        onChange={(e) => handleAxisConfigChange('hasLunch', e.target.checked)}
                        className="h-3 w-3 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                        昼休:
                      </span>
                    </label>
                    {activeTable.axisConfig.hasLunch ? (
                      <div className="flex items-center gap-0.5">
                        <select
                          value={activeTable.axisConfig.lunchAfterPeriod}
                          onChange={(e) =>
                            handleAxisConfigChange('lunchAfterPeriod', Number(e.target.value))
                          }
                          className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                        >
                          {Array.from({ length: Math.max(1, activeTable.numRows - 1) }).map(
                            (_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                {idx + 1}行後
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          value={activeTable.axisConfig.lunchMinutes}
                          onChange={(e) =>
                            handleAxisConfigChange('lunchMinutes', Number(e.target.value))
                          }
                          className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                        >
                          <option value={40}>40分</option>
                          <option value={50}>50分</option>
                          <option value={60}>60分</option>
                          <option value={70}>70分</option>
                        </select>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">なし</span>
                    )}
                  </div>
                )}

                {/* 個別時間微調整 (開始時刻がある場合) */}
                {activeTable.axisConfig.startTime && (
                  <button
                    type="button"
                    onClick={() => setShowCustomTimes(!showCustomTimes)}
                    className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition shadow-2xs active:scale-95 ${
                      showCustomTimes || hasCustomTimes
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title="行ごとの時間微調整（特定行のみ時間を手動変更したい場合）"
                  >
                    <Sliders className="h-3 w-3" />
                    <span className="hidden sm:inline">時間微調整</span>
                    <span className="sm:hidden">微調整</span>
                    {hasCustomTimes && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    )}
                    {showCustomTimes ? (
                      <ChevronUp className="h-3 w-3 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                )}

                {/* 付随タスク (インライン設定) */}
                <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={activeTable.attachedTaskConfig?.enabled ?? false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateActiveTable((prev) => ({
                          ...prev,
                          attachedTaskConfig: {
                            enabled,
                            titleTemplate:
                              prev.attachedTaskConfig?.titleTemplate || '{title} のタスク',
                            durationMinutes:
                              prev.attachedTaskConfig?.durationMinutes || 15,
                          },
                        }));
                      }}
                      className="h-3 w-3 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                      付随タスク:
                    </span>
                  </label>
                  {activeTable.attachedTaskConfig?.enabled && (
                    <div className="flex items-center gap-1">
                      <select
                        value={activeTable.attachedTaskConfig.titleTemplate || '{title} のタスク'}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveTable((prev) => ({
                            ...prev,
                            attachedTaskConfig: {
                              enabled: true,
                              titleTemplate: val,
                              durationMinutes:
                                prev.attachedTaskConfig?.durationMinutes || 15,
                            },
                          }));
                        }}
                        className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                      >
                        <option value="{title} のタスク">〜のタスク</option>
                      </select>
                      <select
                        value={activeTable.attachedTaskConfig.durationMinutes}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateActiveTable((prev) => ({
                            ...prev,
                            attachedTaskConfig: {
                              enabled: true,
                              titleTemplate:
                                prev.attachedTaskConfig?.titleTemplate || '{title} のタスク',
                              durationMinutes: val,
                            },
                          }));
                        }}
                        className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                      >
                        <option value={10}>10分</option>
                        <option value={15}>15分</option>
                        <option value={30}>30分</option>
                        <option value={45}>45分</option>
                        <option value={60}>60分</option>
                        <option value={90}>90分</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 行数・列数ステッパー（真ん中に現在値入力、左右にアップダウンボタン） */}
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-1.5">
                  {/* 行数ステッパー */}
                  <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 shadow-2xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      行:
                    </span>
                    <div className="flex items-center border border-slate-200 rounded overflow-hidden">
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

                  {/* 列数ステッパー */}
                  <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 shadow-2xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      列:
                    </span>
                    <div className="flex items-center border border-slate-200 rounded overflow-hidden">
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
              </div>

              {/* Right: サマリー（稼働時間がある場合のみ時間帯を表示、自動組み込みバッジは表示しない） */}
              <div className="flex items-center gap-2">
                {activeTable.axisConfig.startTime && periodTimes[0]?.startTime && (
                  <div className="flex items-center gap-1 rounded-md bg-blue-100/70 border border-blue-200/70 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-900 shadow-2xs">
                    <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span>
                      {periodTimes[0]?.startTime} 〜 {periodTimes[periodTimes.length - 1]?.endTime}
                    </span>
                    <span className="text-[10px] font-normal text-blue-600 hidden md:inline">
                      ({activeTable.numRows}行)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Optional Drawer: Individual Row Time Adjustments (行個別微調整) */}
            {showCustomTimes && activeTable.axisConfig.startTime && (
              <div className="shrink-0 rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 shadow-2xs animate-in fade-in duration-150">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    行ごとの時間調整（特定行のみ時間を手動変更）
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ※手動変更した行は黄色枠で強調されます
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {periodTimes.map((pt) => {
                    const isCustom = !!(
                      activeTable.axisConfig.customRowTimes &&
                      activeTable.axisConfig.customRowTimes[pt.periodIndex]
                    );
                    return (
                      <div
                        key={`custom-row-${pt.periodIndex}`}
                        className={`flex flex-col gap-1 rounded-md border p-1.5 text-xs transition ${
                          isCustom
                            ? 'border-amber-300 bg-amber-50/70'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {pt.periodIndex}
                          </span>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleResetCustomRowTime(pt.periodIndex)}
                              className="text-[10px] text-amber-700 hover:underline"
                            >
                              リセット
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={pt.startTime}
                            onChange={(e) =>
                              handleCustomRowTimeChange(pt.periodIndex, 'start', e.target.value)
                            }
                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px]"
                          />
                          <span className="text-slate-400 text-[10px]">〜</span>
                          <input
                            type="time"
                            value={pt.endTime}
                            onChange={(e) =>
                              handleCustomRowTimeChange(pt.periodIndex, 'end', e.target.value)
                            }
                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================
                Big Spreadsheet Screen: Excel風 大画面テーブル
                - flex-1 min-h-0 で縦横いっぱいに広がる大画面
                - 見出し（列ヘッダー・行ヘッダー）は sticky 固定
                ======================================================== */}
            <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs">
              {/* スクロール領域 */}
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-left text-xs">
                  <thead>
                    <tr>
                      {/* 左上 交差見出し: 曜日で管理 vs 周期で管理 の切替スイッチ */}
                      <th className="sticky top-0 left-0 z-30 w-24 sm:w-28 min-w-[96px] sm:min-w-[110px] border-b-2 border-r-2 border-slate-300 bg-slate-100 p-1.5 text-center select-none shadow-2xs">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            列の管理
                          </span>
                          <select
                            value={tableColumnMode}
                            onChange={(e) =>
                              handleToggleColumnMode(e.target.value as TableColumnMode)
                            }
                            className={`w-full rounded-md border px-1.5 py-1 text-[11px] font-bold shadow-2xs focus:outline-hidden cursor-pointer transition ${
                              tableColumnMode === 'cycle'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400'
                                : 'border-blue-300 bg-blue-50 text-blue-800 hover:border-blue-400'
                            }`}
                            title="表の列を「曜日」で管理するか「周期」で管理するかを切り替えます"
                          >
                            <option value="weekday">📅 曜日</option>
                            <option value="cycle">🔄 周期</option>
                          </select>
                        </div>
                      </th>

                      {/* 列ヘッダー (曜日または周期) */}
                      {activeTable.colHeaders.map((colName, cIdx) => {
                        const parsed = parseColHeader(colName, cIdx);
                        const isExcluded = parsed.type === 'excluded';
                        const colLetter = String.fromCharCode(65 + cIdx); // A, B, C, D...
                        const headerOptions =
                          tableColumnMode === 'cycle'
                            ? CYCLE_HEADER_OPTIONS
                            : WEEKDAY_HEADER_OPTIONS;
                        const isColumnEmpty =
                          activeTable.cells.every((r) => !r[cIdx]?.title?.trim());

                        return (
                          <th
                            key={`col-header-${cIdx}`}
                            className={`sticky top-0 z-20 border-b-2 border-r border-slate-300 p-2 text-center transition min-w-[140px] sm:min-w-[160px] ${
                              isExcluded
                                ? 'bg-slate-200/60 text-slate-400'
                                : tableColumnMode === 'cycle'
                                ? 'bg-emerald-50/50'
                                : 'bg-slate-100/90'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center justify-between w-full px-1">
                                <span className="font-mono text-[10px] font-bold text-slate-400">
                                  {colLetter}
                                </span>
                                {tableColumnMode === 'cycle' && !isExcluded && isColumnEmpty && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded bg-emerald-100 border border-emerald-300/80 px-1 py-0.2 text-[9px] font-bold text-emerald-800"
                                    title="空列のため、周期内で何もしないオフ日になります"
                                  >
                                    💤 オフ日
                                  </span>
                                )}
                                {activeTable.numCols > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => updateActiveTable((t) => removeColAtIndex(t, cIdx))}
                                    title={`この列 (${colName}) を削除`}
                                    className="h-4 w-4 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <select
                                value={colName}
                                onChange={(e) => handleColHeaderChange(cIdx, e.target.value)}
                                className={`w-full rounded-md border px-1.5 py-0.5 text-xs font-bold transition shadow-2xs focus:outline-hidden cursor-pointer ${
                                  isExcluded
                                    ? 'border-slate-300 bg-slate-100 text-slate-400'
                                    : tableColumnMode === 'cycle'
                                    ? 'border-emerald-300 bg-white text-emerald-700 hover:border-emerald-400'
                                    : 'border-blue-300 bg-white text-blue-700 hover:border-blue-400'
                                }`}
                              >
                                {headerOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                                {!headerOptions.includes(colName) && (
                                  <option value={colName}>{colName}</option>
                                )}
                              </select>
                            </div>
                          </th>
                        );
                      })}

                      {/* 列増減ヘッダー */}
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
                    </tr>
                  </thead>
                  <tbody>
                    {activeTable.cells.map((row, rIdx) => {
                      const pt = periodTimes[rIdx];
                      return (
                        <tr key={`row-${rIdx}`} className="group/row">
                          {/* 行ヘッダー (番号 & 時間帯 & 行削除ボタン) */}
                          <td className="sticky left-0 z-10 border-b border-r-2 border-slate-300 bg-slate-50 p-1.5 sm:p-2 text-center group-hover/row:bg-slate-100/80 transition">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {rIdx + 1}
                              </span>
                              {activeTable.numRows > 1 && (
                                <button
                                  type="button"
                                  onClick={() => updateActiveTable((t) => removeRowAtIndex(t, rIdx))}
                                  title={`行 ${rIdx + 1} を削除`}
                                  className="h-4 w-4 rounded opacity-0 group-hover/row:opacity-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            {pt?.startTime && pt?.endTime && (
                              <div className="font-mono text-[10px] text-slate-500 whitespace-nowrap mt-0.5">
                                {pt.startTime} - {pt.endTime}
                              </div>
                            )}
                          </td>

                          {/* 各セル */}
                          {row.map((cell, cIdx) => {
                            const isExcluded = activeTable.colHeaders[cIdx] === '除外';
                            const hasContent = Boolean(cell.text && cell.title.trim());

                            return (
                              <td
                                key={`cell-${rIdx}-${cIdx}`}
                                onClick={() => !isExcluded && handleStartEditCell(rIdx, cIdx)}
                                className={`relative border-b border-r border-slate-200 p-2 sm:p-2.5 align-top transition-all h-20 sm:h-24 ${
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
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold text-sky-950 text-xs sm:text-[13px] leading-snug break-words">
                                          {cell.title}
                                        </span>
                                        {cell.attachedTask?.enabled && (
                                          <span
                                            className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"
                                            title="付随タスクあり"
                                          />
                                        )}
                                      </div>
                                      {cell.roomOrNote && (
                                        <div className="text-[10px] sm:text-[11px] text-sky-700 font-medium whitespace-pre-wrap mt-0.5 line-clamp-2">
                                          {cell.roomOrNote}
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                      <span className="opacity-70">
                                        {pt?.startTime || ''}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => handleClearCell(rIdx, cIdx, e)}
                                        title="セルをクリア"
                                        className="opacity-0 group-hover/cell:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[10px] text-slate-300 opacity-0 hover:opacity-100 transition">
                                    {!isExcluded && <span>+ 入力</span>}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* 行末の空セル (列追加ヘッダー対応) */}
                          <td className="border-b border-r border-slate-200 bg-slate-50/20" />
                        </tr>
                      );
                    })}

                    {/* 行追加・削除フッター行 */}
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
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cell Edit Modal */}
      {editingCell && activeTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                コマ内容を編集 ({editingCell.r + 1}行目・{activeTable.colHeaders[editingCell.c]})
              </span>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            {/* コマ内容入力 */}
            <textarea
              rows={3}
              value={cellEditText}
              onChange={(e) => setCellEditText(e.target.value)}
              placeholder="1行目: コマ名称（講義名・メニュー・日課名など）&#13;&#10;2行目以降: 場所・メモ・詳細"
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              autoFocus
            />

            {/* タスク後の休憩時間 */}
            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-emerald-50/50 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-base">☕</span>
                <div>
                  <div className="text-xs font-bold text-slate-800">タスク後の休憩時間</div>
                  <div className="text-[10px] text-slate-500">直後に確保する休憩</div>
                </div>
              </div>
              <select
                value={cellBreakMinutes}
                onChange={(e) => setCellBreakMinutes(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-hidden"
              >
                <option value={0}>なし (0分)</option>
                <option value={5}>5分</option>
                <option value={10}>10分</option>
                <option value={15}>15分 (おすすめ)</option>
                <option value={20}>20分</option>
                <option value={30}>30分</option>
                <option value={45}>45分</option>
                <option value={60}>60分</option>
              </select>
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
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">
                      付随タスク名 ({'{title}'} でコマ名に置換)
                    </label>
                    <input
                      type="text"
                      value={cellAttachedTitle}
                      onChange={(e) => setCellAttachedTitle(e.target.value)}
                      placeholder="{title} のタスク"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-500 shrink-0">
                      所要時間:
                    </label>
                    <select
                      value={cellAttachedDuration}
                      onChange={(e) => setCellAttachedDuration(Number(e.target.value))}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-hidden"
                    >
                      <option value={5}>5分</option>
                      <option value={10}>10分</option>
                      <option value={15}>15分</option>
                      <option value={20}>20分</option>
                      <option value={30}>30分</option>
                      <option value={45}>45分</option>
                      <option value={60}>60分</option>
                    </select>
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
      )}

      {/* Toast Notification */}
      {applySuccessMsg && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-slate-900/90 text-white px-4 py-2.5 text-xs font-semibold shadow-xl backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{applySuccessMsg}</span>
        </div>
      )}
    </div>
  );
}
