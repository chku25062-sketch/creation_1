'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Edit2,
  Trash2,
  Plus,
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
  Clock,
  Upload,
} from 'lucide-react';
import { ImportedTableData, FixedSlot, TaskItem, ScheduleInclusionSettings } from '@/types';
import { calculatePeriodTimes, timeStringToMinutes } from '@/lib/timeUtils';
import { generateSlotsForTable } from '@/lib/storage';
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

const WEEKDAY_OPTIONS = [
  { label: '月曜', value: 0 },
  { label: '火曜', value: 1 },
  { label: '水曜', value: 2 },
  { label: '木曜', value: 3 },
  { label: '金曜', value: 4 },
  { label: '土曜', value: 5 },
  { label: '日曜', value: 6 },
  { label: '除外', value: -1 },
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

  // 時限個別調整アコーディオンの開閉
  const [showCustomTimes, setShowCustomTimes] = useState(false);
  const hasCustomTimes = useMemo(() => {
    if (!activeTable?.axisConfig.customRowTimes) return false;
    return Object.keys(activeTable.axisConfig.customRowTimes).length > 0;
  }, [activeTable]);

  // セル編集ステート
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [cellEditText, setCellEditText] = useState('');

  // 計画表反映確認モーダルのステート
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyMode, setApplyMode] = useState<'replace' | 'add'>('replace');
  const [autoCreateAssignments, setAutoCreateAssignments] = useState(true);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  // テーブル更新ヘルパー
  const updateActiveTable = (updater: (prev: ImportedTableData) => ImportedTableData) => {
    const nextTable = updater(activeTable);
    const updated = tables.map((t) => (t.id === activeTable.id ? nextTable : t));
    onTablesChange(updated);

    // もし計画表に反映中のテーブルであれば、固定枠も自動再同期
    if (isTableApplied(nextTable)) {
      const newSlots = generateSlotsForTable(nextTable);
      const filteredSlots = fixedSlots.filter(
        (s) =>
          s.sourceTableId !== nextTable.id &&
          !s.id.startsWith(`slot-table-${nextTable.id}-`) &&
          !s.id.startsWith(`slot-lecture-${nextTable.id}-`) &&
          !(nextTable.appliedSlotIds && nextTable.appliedSlotIds.includes(s.id)),
      );
      onSlotsChange([...filteredSlots, ...newSlots]);
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
    return fixedSlots.some(
      (s) =>
        s.sourceTableId === table.id ||
        s.id.startsWith(`slot-table-${table.id}-`) ||
        s.id.startsWith(`slot-lecture-${table.id}-`),
    );
  };

  const isCurrentItemApplied = useMemo(() => {
    if (selectedItemId === 'sys-slots') return isSlotsApplied;
    if (selectedItemId === 'sys-daily') return isDailyApplied;
    if (selectedItemId === 'sys-weekly') return isWeeklyApplied;
    if (activeTable) return isTableApplied(activeTable);
    return false;
  }, [selectedItemId, isSlotsApplied, isDailyApplied, isWeeklyApplied, activeTable, fixedSlots]);

  // テーブル反映トグル切り替え
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

      // 連動課題タスクも削除
      const nextTasks = tasks.filter(
        (t) => !t.id.startsWith(`task-assignment-${table.id}-`) && t.sourceTableId !== table.id,
      );
      if (nextTasks.length !== tasks.length) {
        onTasksChange(nextTasks);
      }

      const updated = tables.map((t) =>
        t.id === table.id ? { ...t, isApplied: false, appliedSlotIds: [] } : t,
      );
      onTablesChange(updated);

      setApplySuccessMsg(`「${table.name}」の反映を解除しました`);
      setTimeout(() => setApplySuccessMsg(null), 3000);
    } else {
      // 反映 (ON)
      const newSlots = generateSlotsForTable(table);
      if (newSlots.length === 0) {
        alert(
          '有効な授業コマがありません。セルに講義名を入力するか、列の曜日定義をご確認ください。',
        );
        return;
      }

      // 既存の同一テーブル由来スロットを除去して追加
      const filteredSlots = fixedSlots.filter(
        (s) =>
          s.sourceTableId !== table.id &&
          !s.id.startsWith(`slot-table-${table.id}-`) &&
          !s.id.startsWith(`slot-lecture-${table.id}-`) &&
          !(table.appliedSlotIds && table.appliedSlotIds.includes(s.id)),
      );
      const nextSlots = [...filteredSlots, ...newSlots];
      onSlotsChange(nextSlots);

      // 自動課題タスク生成（autoCreateAssignments が true の場合）
      if (autoCreateAssignments) {
        const assignmentsToAdd: TaskItem[] = [];
        table.cells.forEach((row, r) => {
          row.forEach((cell, c) => {
            const colHeader = table.colHeaders[c] || '';
            let dayIdx = cell.dayIndex;
            if (colHeader.includes('月')) dayIdx = 0;
            else if (colHeader.includes('火')) dayIdx = 1;
            else if (colHeader.includes('水')) dayIdx = 2;
            else if (colHeader.includes('木')) dayIdx = 3;
            else if (colHeader.includes('金')) dayIdx = 4;
            else if (colHeader.includes('土')) dayIdx = 5;
            else if (colHeader.includes('日')) dayIdx = 6;
            else if (colHeader === '除外') dayIdx = -1;

            if (dayIdx >= 0 && cell.title.trim()) {
              const deadlineDay = (dayIdx - 1 + 7) % 7;
              assignmentsToAdd.push({
                id: `task-assignment-${table.id}-${r}-${c}-${Math.random().toString(36).substring(2, 5)}`,
                title: `${cell.title} レポート課題`,
                category: 'must',
                durationSize: 'medium',
                durationMinutes: 60,
                frequency: 'low',
                taskType: 'assignment',
                startDay: dayIdx,
                deadlineDay,
                priority: 'high',
                period: 'week',
                completed: false,
                sourceTableId: table.id,
                sourceTableName: table.name,
              });
            }
          });
        });

        if (assignmentsToAdd.length > 0) {
          const existingWithoutTable = tasks.filter(
            (t) => !t.id.startsWith(`task-assignment-${table.id}-`),
          );
          onTasksChange([...existingWithoutTable, ...assignmentsToAdd]);
        }
      }

      const updated = tables.map((t) =>
        t.id === table.id
          ? {
              ...t,
              isApplied: true,
              appliedSlotIds: newSlots.map((s) => s.id),
              updatedAt: new Date().toISOString(),
            }
          : t,
      );
      onTablesChange(updated);

      setApplySuccessMsg(`「${table.name}」を計画表に反映しました（${newSlots.length}コマ）`);
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

  // 横軸（列の曜日）の変更
  const handleColHeaderChange = (colIdx: number, dayValue: number) => {
    const dayLabel = WEEKDAY_OPTIONS.find((w) => w.value === dayValue)?.label || `列 ${colIdx + 1}`;
    updateActiveTable((prev) => {
      const nextColHeaders = [...prev.colHeaders];
      nextColHeaders[colIdx] = dayLabel;

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

  // 縦軸（基本ルール一括設定）の変更
  const handleAxisConfigChange = (
    key: keyof ImportedTableData['axisConfig'],
    value: string | number | boolean,
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
    const cell = activeTable.cells[r][c];
    setEditingCell({ r, c });
    setCellEditText(cell.text || cell.title || '');
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

  // 計画表へ反映
  const handleExecuteApply = () => {
    // 有効なセル（テキストが存在し、除外列でないもの）を抽出
    const lectureSlotsToAdd: FixedSlot[] = [];
    const assignmentsToAdd: TaskItem[] = [];

    activeTable.cells.forEach((row, r) => {
      const timeSlot = periodTimes[r];
      row.forEach((cell, c) => {
        // 列の曜日を判定
        const colHeader = activeTable.colHeaders[c] || '';
        let dayIdx = cell.dayIndex;
        if (colHeader.includes('月')) dayIdx = 0;
        else if (colHeader.includes('火')) dayIdx = 1;
        else if (colHeader.includes('水')) dayIdx = 2;
        else if (colHeader.includes('木')) dayIdx = 3;
        else if (colHeader.includes('金')) dayIdx = 4;
        else if (colHeader.includes('土')) dayIdx = 5;
        else if (colHeader.includes('日')) dayIdx = 6;
        else if (colHeader === '除外') dayIdx = -1;

        if (dayIdx >= 0 && cell.title.trim()) {
          const slotId = `slot-lecture-${Date.now()}-${r}-${c}-${Math.random().toString(36).substring(2, 5)}`;
          const fullTitle = cell.roomOrNote
            ? `${cell.title} (${cell.roomOrNote.replace(/\n/g, ' ')})`
            : cell.title;

          lectureSlotsToAdd.push({
            id: slotId,
            title: fullTitle,
            category: 'lecture',
            startMinutes: timeSlot.startMinutes,
            endMinutes: timeSlot.endMinutes,
            color: '#0284c7', // 講義カラー
            daysOfWeek: [dayIdx],
            sourceTableId: activeTable.id,
            sourceTableName: activeTable.name,
          });

          if (autoCreateAssignments) {
            const deadlineDay = (dayIdx - 1 + 7) % 7; // 授業前日を締切に
            assignmentsToAdd.push({
              id: `task-assignment-${Date.now()}-${r}-${c}-${Math.random().toString(36).substring(2, 5)}`,
              title: `${cell.title} レポート課題`,
              category: 'must',
              durationSize: 'medium',
              durationMinutes: 60,
              frequency: 'low',
              taskType: 'assignment',
              startDay: dayIdx,
              deadlineDay,
              priority: 'high',
              period: 'week',
              completed: false,
              sourceTableId: activeTable.id,
              sourceTableName: activeTable.name,
            });
          }
        }
      });
    });

    if (lectureSlotsToAdd.length === 0) {
      alert('有効な授業コマがありません。セルに講義名を入力するか、列の曜日定義をご確認ください。');
      return;
    }

    let nextSlots: FixedSlot[];
    if (applyMode === 'replace') {
      // 既存の講義枠のみを除去して新規置換（睡眠やルーティン、勤務などは保持！）
      const nonLectureSlots = fixedSlots.filter((s) => s.category !== 'lecture');
      nextSlots = [...nonLectureSlots, ...lectureSlotsToAdd];
    } else {
      nextSlots = [...fixedSlots, ...lectureSlotsToAdd];
    }

    onSlotsChange(nextSlots);

    if (assignmentsToAdd.length > 0) {
      onTasksChange([...tasks, ...assignmentsToAdd]);
    }

    const updated = tables.map((t) =>
      t.id === activeTable.id
        ? {
            ...t,
            isApplied: true,
            appliedSlotIds: lectureSlotsToAdd.map((s) => s.id),
            updatedAt: new Date().toISOString(),
          }
        : t,
    );
    onTablesChange(updated);

    setIsApplyModalOpen(false);
    setApplySuccessMsg(
      `計画表に ${lectureSlotsToAdd.length}件の授業枠${
        assignmentsToAdd.length > 0 ? ` と ${assignmentsToAdd.length}件の課題タスク` : ''
      } を組み込みました！`,
    );

    setTimeout(() => {
      setApplySuccessMsg(null);
    }, 4000);
  };

  // 新規テーブル作成（空テーブル）
  const handleAddNewTable = () => {
    const newId = `table-${Date.now()}`;
    const newTable: ImportedTableData = {
      id: newId,
      name: `新しい時間割 ${tables.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      numRows: 5,
      numCols: 5,
      colHeaders: ['月曜', '火曜', '水曜', '木曜', '金曜'],
      rowHeaders: ['1限', '2限', '3限', '4限', '5限'],
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
            {/* Section 1: 基本設定ファイル (固定枠、日課、週次) */}
            <div>
              <div
                className={`${
                  isSidebarOpen
                    ? 'px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase'
                    : 'px-1 py-0.5 text-[9px] font-bold text-slate-400 text-center uppercase tracking-tighter'
                }`}
              >
                {isSidebarOpen ? '基本設定' : '基本'}
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

                {/* 日課タスク */}
                {(!searchQuery.trim() ||
                  '日課 毎日 日課タスク ルーティン daily'
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())) && (
                  <div
                    onClick={() => handleSelectItem('sys-daily')}
                    title="日課タスク (毎日)"
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
                          {isSidebarOpen ? '日課タスク (毎日)' : '日課タ…'}
                        </div>
                        {isSidebarOpen ? (
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>高頻度・日課 ({dailyTasksCount}件)</span>
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

                {/* 週次タスク */}
                {(!searchQuery.trim() ||
                  '週次 目標 週次タスク 課題 todo weekly'
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())) && (
                  <div
                    onClick={() => handleSelectItem('sys-weekly')}
                    title="週次タスク (目標・課題)"
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
                          {isSidebarOpen ? '週次タスク (目標・課題)' : '週次タ…'}
                        </div>
                        {isSidebarOpen ? (
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>今週の目標・課題 ({weeklyTasksCount}件)</span>
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

            {/* Section 2: 取り込み表データ (外部時間割・シフト表等) */}
            <div>
              <div
                className={`flex items-center justify-between ${
                  isSidebarOpen
                    ? 'px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase'
                    : 'px-1 py-0.5 text-[9px] font-bold text-slate-400 justify-center uppercase tracking-tighter'
                }`}
              >
                <span>{isSidebarOpen ? '取り込み表データ' : '表'}</span>
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
                  filteredTables.map((t) => {
                    const isSelected = t.id === selectedItemId;
                    const dateStr = t.updatedAt
                      ? new Date(t.updatedAt).toLocaleDateString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                        })
                      : '';

                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          handleSelectItem(t.id);
                        }}
                        title={t.name}
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
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ${
                              isSelected ? 'text-blue-700' : 'text-emerald-600'
                            }`}
                          >
                            <FileSpreadsheet className="h-4 w-4" />
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
                      ? '日課タスク (高頻度・毎日)'
                      : '週次タスク (目標・課題)'}
                </span>
              </div>
            ) : activeTable ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="font-medium text-slate-600 shrink-0">取り込み表データ</span>
                <span className="text-slate-300">/</span>
                <span className="font-bold text-slate-900 truncate">{activeTable.name}</span>
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
              {activeTable && (
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(true)}
                  title="反映設定（課題タスク自動生成・反映モード）"
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
                >
                  <Sliders className="h-3.5 w-3.5" />
                </button>
              )}
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
              {/* Left: 時間軸クイック設定 */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* 始業時間 */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    1限始業:
                  </span>
                  <input
                    type="time"
                    value={activeTable.axisConfig.startTime}
                    onChange={(e) => handleAxisConfigChange('startTime', e.target.value)}
                    className="font-mono text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden"
                  />
                </div>

                {/* 1コマ分数 */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    1コマ:
                  </span>
                  <select
                    value={activeTable.axisConfig.periodMinutes}
                    onChange={(e) =>
                      handleAxisConfigChange('periodMinutes', Number(e.target.value))
                    }
                    className="font-bold text-xs text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                  >
                    <option value={90}>90分</option>
                    <option value={100}>100分</option>
                    <option value={60}>60分</option>
                    <option value={50}>50分</option>
                    <option value={45}>45分</option>
                  </select>
                </div>

                {/* コマ間休憩 */}
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 shadow-2xs">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    休憩:
                  </span>
                  <select
                    value={activeTable.axisConfig.intervalMinutes}
                    onChange={(e) =>
                      handleAxisConfigChange('intervalMinutes', Number(e.target.value))
                    }
                    className="font-bold text-xs text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                  >
                    <option value={10}>10分</option>
                    <option value={15}>15分</option>
                    <option value={20}>20分</option>
                    <option value={5}>5分</option>
                    <option value={0}>なし</option>
                  </select>
                </div>

                {/* 昼休み */}
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
                        {Array.from({ length: activeTable.numRows - 1 }).map((_, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {idx + 1}限後
                          </option>
                        ))}
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

                {/* 時限ごとの個別微調整 */}
                <button
                  type="button"
                  onClick={() => setShowCustomTimes(!showCustomTimes)}
                  className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition shadow-2xs active:scale-95 ${
                    showCustomTimes || hasCustomTimes
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title="時限ごとの個別調整（特定時限のみ時間を手動変更したい場合）"
                >
                  <Sliders className="h-3 w-3" />
                  <span className="hidden sm:inline">時限微調整</span>
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
              </div>

              {/* Right: サマリー */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-md bg-blue-100/70 border border-blue-200/70 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-900 shadow-2xs">
                  <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span>
                    {periodTimes[0]?.startTime} 〜 {periodTimes[periodTimes.length - 1]?.endTime}
                  </span>
                  <span className="text-[10px] font-normal text-blue-600 hidden md:inline">
                    ({activeTable.numRows}コマ)
                  </span>
                </div>

                <span className="hidden lg:inline-block font-mono text-[11px] font-semibold text-slate-400">
                  {activeTable.numRows}行 × {activeTable.numCols}列
                </span>
              </div>
            </div>

            {/* Optional Drawer: Individual Period Time Adjustments (コマ個別微調整) */}
            {showCustomTimes && (
              <div className="shrink-0 rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 shadow-2xs animate-in fade-in duration-150">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    時限ごとの個別時間調整（特定時限のみ時間を手動変更）
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ※手動変更した時限は黄色枠で強調されます
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
                            {pt.periodIndex}限
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
                      {/* 左上 交差見出し (全選択セル風) */}
                      <th className="sticky top-0 left-0 z-30 w-24 sm:w-28 min-w-[96px] sm:min-w-[112px] border-b-2 border-r-2 border-slate-300 bg-slate-100 p-2 text-center text-[10px] font-bold text-slate-600 select-none shadow-2xs">
                        <div className="flex items-center justify-center gap-1">
                          <span>時限</span>
                          <span className="text-slate-300">/</span>
                          <span>時間</span>
                        </div>
                      </th>

                      {/* 列ヘッダー (曜日マッピング) */}
                      {activeTable.colHeaders.map((colName, cIdx) => {
                        const currentDayVal =
                          WEEKDAY_OPTIONS.find((w) => w.label === colName)?.value ?? cIdx;
                        const isExcluded = currentDayVal === -1;
                        const colLetter = String.fromCharCode(65 + cIdx); // A, B, C, D...

                        return (
                          <th
                            key={`col-header-${cIdx}`}
                            className={`sticky top-0 z-20 border-b-2 border-r border-slate-300 p-2 text-center transition min-w-[140px] sm:min-w-[160px] ${
                              isExcluded ? 'bg-slate-200/60 text-slate-400' : 'bg-slate-100/90'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold text-slate-400">
                                  {colLetter}
                                </span>
                                <select
                                  value={currentDayVal}
                                  onChange={(e) =>
                                    handleColHeaderChange(cIdx, Number(e.target.value))
                                  }
                                  className={`rounded-md border px-2 py-0.5 text-xs font-bold transition shadow-2xs focus:outline-hidden cursor-pointer ${
                                    isExcluded
                                      ? 'border-slate-300 bg-slate-100 text-slate-400'
                                      : 'border-blue-300 bg-white text-blue-700 hover:border-blue-400'
                                  }`}
                                >
                                  {WEEKDAY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTable.cells.map((row, rIdx) => {
                      const pt = periodTimes[rIdx];
                      return (
                        <tr key={`row-${rIdx}`} className="group/row">
                          {/* 行ヘッダー (時限 & 時間帯) */}
                          <td className="sticky left-0 z-10 border-b border-r-2 border-slate-300 bg-slate-50 p-2 text-center group-hover/row:bg-slate-100/80 transition">
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {rIdx + 1}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">限</span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 whitespace-nowrap mt-0.5">
                              {pt?.startTime} - {pt?.endTime}
                            </div>
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
                                      <div className="font-bold text-sky-950 text-xs sm:text-[13px] leading-snug break-words">
                                        {cell.title}
                                      </div>
                                      {cell.roomOrNote && (
                                        <div className="text-[10px] sm:text-[11px] text-sky-700 font-medium whitespace-pre-wrap mt-0.5 line-clamp-2">
                                          {cell.roomOrNote}
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                      <span className="opacity-70">{pt?.startTime}</span>
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
                        </tr>
                      );
                    })}
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
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                コマ内容を編集 ({editingCell.r + 1}限・{activeTable.colHeaders[editingCell.c]})
              </span>
              <button
                onClick={() => setEditingCell(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <textarea
              rows={4}
              value={cellEditText}
              onChange={(e) => setCellEditText(e.target.value)}
              placeholder="1行目: 講義名&#13;&#10;2行目以降: 教室名・教員名・メモ"
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setEditingCell(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEditCell}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply to Schedule Confirmation Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                計画表への組み込み（反映）
              </h3>
            </div>

            <div className="my-4 flex flex-col gap-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                定義した横軸（曜日）・縦軸（時間帯）・セル内容を、週間スケジュール（固定枠）へ展開します。
              </p>

              {/* Mode Selection */}
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="font-bold text-slate-800">反映モード</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="applyMode"
                    value="replace"
                    checked={applyMode === 'replace'}
                    onChange={() => setApplyMode('replace')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-800">既存の講義枠を置換 (推奨)</span>
                    <p className="text-[11px] text-slate-500">
                      以前の講義固定枠のみをクリアし、この表の講義枠に差し替えます（睡眠・勤務等は保持されます）。
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="radio"
                    name="applyMode"
                    value="add"
                    checked={applyMode === 'add'}
                    onChange={() => setApplyMode('add')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-800">既存の枠に追加</span>
                    <p className="text-[11px] text-slate-500">
                      すでに登録されているすべての固定枠を残したまま、新しく追加します。
                    </p>
                  </div>
                </label>
              </div>

              {/* Automatic Assignment Tasks creation */}
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={autoCreateAssignments}
                  onChange={(e) => setAutoCreateAssignments(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800">
                    講義に対応するレポート・課題タスクを自動生成
                  </span>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    各講義に対して「出題日: 講義当日 / 締切:
                    講義前日」の週間課題タスクを自動起票します。
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleExecuteApply}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <Check className="h-4 w-4" />
                <span>計画表へ組み込む</span>
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
