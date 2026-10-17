'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { ImportedTableData, FixedSlot, TaskItem } from '@/types';
import { calculatePeriodTimes, timeStringToMinutes } from '@/lib/timeUtils';

interface ImportedTablesManagerProps {
  tables: ImportedTableData[];
  onTablesChange: (newTables: ImportedTableData[]) => void;
  fixedSlots: FixedSlot[];
  onSlotsChange: (newSlots: FixedSlot[]) => void;
  tasks: TaskItem[];
  onTasksChange: (newTasks: TaskItem[]) => void;
  onNavigateToTimeline?: () => void;
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
  onNavigateToTimeline,
}: ImportedTablesManagerProps) {
  // 選択中のテーブル
  const [selectedTableId, setSelectedTableId] = useState<string>(tables[0]?.id || 'sample-table-1');

  const activeTable = useMemo(() => {
    return tables.find((t) => t.id === selectedTableId) || tables[0];
  }, [tables, selectedTableId]);

  // テーブル名編集モーダル/ステート
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTableName, setTempTableName] = useState('');

  // 時限個別調整アコーディオンの開閉
  const [showCustomTimes, setShowCustomTimes] = useState(false);

  // セル編集ステート
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [cellEditText, setCellEditText] = useState('');

  // 計画表反映確認モーダルのステート
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyMode, setApplyMode] = useState<'replace' | 'add'>('replace');
  const [autoCreateAssignments, setAutoCreateAssignments] = useState(true);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  if (!activeTable) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
        <p>
          読み込みデータがありません。画面上部の「ファイル取込」から表をインポートしてください。
        </p>
      </div>
    );
  }

  // テーブル更新ヘルパー
  const updateActiveTable = (updater: (prev: ImportedTableData) => ImportedTableData) => {
    const updated = tables.map((t) => (t.id === activeTable.id ? updater(t) : t));
    onTablesChange(updated);
  };

  // 時限時間の計算
  const periodTimes = calculatePeriodTimes(activeTable.numRows, activeTable.axisConfig);

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
    setSelectedTableId(newId);
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
      if (selectedTableId === id) {
        setSelectedTableId(filtered[0].id);
      }
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:p-4 overflow-y-auto">
      {/* Top Banner & Notifications */}
      {applySuccessMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{applySuccessMsg}</span>
          </div>
          {onNavigateToTimeline && (
            <button
              onClick={onNavigateToTimeline}
              className="rounded-lg bg-emerald-600 px-3 py-1 font-bold text-white shadow-2xs transition hover:bg-emerald-700"
            >
              週間スケジュールで確認 →
            </button>
          )}
        </div>
      )}

      {/* Header: Table Selector Tabs & Actions */}
      <div className="flex flex-col gap-2.5 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">読み込みデータ一覧</h2>
          </div>

          {/* Table Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 ml-2">
            {tables.map((t) => {
              const isSelected = t.id === activeTable.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTableId(t.id);
                    if (!isSelected) setIsEditingName(false);
                  }}
                  className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 font-bold text-blue-700 shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {isSelected && isEditingName ? (
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
                      autoFocus
                      className="rounded border border-blue-400 bg-white px-1 py-0.5 text-xs text-blue-900 focus:outline-hidden"
                    />
                  ) : (
                    <span className="flex items-center gap-1">
                      <span>{t.name}</span>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTempTableName(t.name);
                            setIsEditingName(true);
                          }}
                          title="名前を変更"
                          className="text-blue-400 hover:text-blue-700 ml-0.5"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  )}

                  {tables.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteTable(t.id, e)}
                      title="表を削除"
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleAddNewTable}
              title="新しい表枠を追加"
              className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition"
            >
              <Plus className="h-3 w-3" />
              <span>新規</span>
            </button>
          </div>
        </div>

        {/* Right: Apply to Schedule Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 hover:shadow-md"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>計画表に反映する</span>
          </button>
        </div>
      </div>

      {/* Axis & Interval Definition Panel (横軸・縦軸・インターバルの定義) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800">
              縦軸（時限時間）・インターバル（休憩時間）の一括定義
            </span>
          </div>

          <button
            onClick={() => setShowCustomTimes(!showCustomTimes)}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
          >
            <span>時限ごとの個別微調整</span>
            {showCustomTimes ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Global Rule Controls (始業時間・1コマ分数・コマ間インターバル・昼休み) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 text-xs">
          {/* 始業時間 */}
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2">
            <label className="text-[10px] font-semibold text-slate-500">1限 始業時間</label>
            <input
              type="time"
              value={activeTable.axisConfig.startTime}
              onChange={(e) => handleAxisConfigChange('startTime', e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* 1コマの授業時間 */}
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2">
            <label className="text-[10px] font-semibold text-slate-500">1コマの分数</label>
            <select
              value={activeTable.axisConfig.periodMinutes}
              onChange={(e) => handleAxisConfigChange('periodMinutes', Number(e.target.value))}
              className="rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
            >
              <option value={90}>90分 (大学標準)</option>
              <option value={100}>100分 (大学院・専修)</option>
              <option value={50}>50分 (高校・短大)</option>
              <option value={45}>45分 (小中・特別)</option>
              <option value={60}>60分 (講習・セミナー)</option>
            </select>
          </div>

          {/* コマ間インターバル */}
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2">
            <label className="text-[10px] font-semibold text-slate-500">コマ間インターバル</label>
            <select
              value={activeTable.axisConfig.intervalMinutes}
              onChange={(e) => handleAxisConfigChange('intervalMinutes', Number(e.target.value))}
              className="rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
            >
              <option value={10}>10分 休憩</option>
              <option value={15}>15分 休憩</option>
              <option value={20}>20分 休憩</option>
              <option value={5}>5分 休憩</option>
              <option value={0}>0分 (連続)</option>
            </select>
          </div>

          {/* 昼休み設定 */}
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-slate-500">昼休み</label>
              <input
                type="checkbox"
                checked={activeTable.axisConfig.hasLunch}
                onChange={(e) => handleAxisConfigChange('hasLunch', e.target.checked)}
                className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>
            {activeTable.axisConfig.hasLunch ? (
              <div className="flex items-center gap-1">
                <select
                  value={activeTable.axisConfig.lunchAfterPeriod}
                  onChange={(e) =>
                    handleAxisConfigChange('lunchAfterPeriod', Number(e.target.value))
                  }
                  className="w-16 rounded border border-slate-200 p-1 text-[11px] font-medium"
                >
                  {Array.from({ length: activeTable.numRows - 1 }).map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {idx + 1}限後
                    </option>
                  ))}
                </select>
                <select
                  value={activeTable.axisConfig.lunchMinutes}
                  onChange={(e) => handleAxisConfigChange('lunchMinutes', Number(e.target.value))}
                  className="flex-1 rounded border border-slate-200 p-1 text-[11px] font-medium"
                >
                  <option value={40}>40分</option>
                  <option value={50}>50分</option>
                  <option value={60}>60分</option>
                  <option value={70}>70分</option>
                </select>
              </div>
            ) : (
              <span className="py-1 text-center font-mono text-[11px] text-slate-400">なし</span>
            )}
          </div>

          {/* 計算サマリー表示 */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-center rounded-lg border border-blue-200 bg-blue-50/70 p-2 text-blue-950">
            <span className="text-[10px] text-blue-700 font-semibold">全体の稼働時間</span>
            <div className="font-mono text-xs font-bold">
              {periodTimes[0]?.startTime} 〜 {periodTimes[periodTimes.length - 1]?.endTime}
            </div>
            <span className="text-[10px] text-blue-600">全 {activeTable.numRows} コマ定義済</span>
          </div>
        </div>

        {/* Optional Drawer: Individual Period Time Adjustments (コマ個別微調整) */}
        {showCustomTimes && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 animate-in fade-in duration-150">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                各時限の個別調整（特定時限のみ時間を手動変更したい場合）
              </span>
              <span className="text-[10px] text-slate-500">
                ※変更した時限には「個別設定済」バッジが表示されます
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {periodTimes.map((pt) => {
                const isCustom = !!(
                  activeTable.axisConfig.customRowTimes &&
                  activeTable.axisConfig.customRowTimes[pt.periodIndex]
                );
                return (
                  <div
                    key={`custom-row-${pt.periodIndex}`}
                    className={`flex flex-col gap-1.5 rounded-lg border p-2 text-xs transition ${
                      isCustom
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{pt.periodIndex}限</span>
                      {isCustom && (
                        <button
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
                        className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px]"
                      />
                      <span className="text-slate-400">〜</span>
                      <input
                        type="time"
                        value={pt.endTime}
                        onChange={(e) =>
                          handleCustomRowTimeChange(pt.periodIndex, 'end', e.target.value)
                        }
                        className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Grid Table Editor & Preview (横軸曜日設定 + 表グリッドプレビュー) */}
      <div className="flex flex-1 min-h-[300px] flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">表プレビュー＆セル編集</span>
            <span className="text-[11px] text-slate-500">
              (各列のドロップダウンで曜日マッピングを変更できます。セルクリックで講義名を編集)
            </span>
          </div>

          <span className="font-mono text-[11px] text-slate-500">
            {activeTable.numRows}行 × {activeTable.numCols}列
          </span>
        </div>

        {/* Scrollable Grid Container */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-2">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70">
                {/* Time Axis Header */}
                <th className="w-24 border-r border-slate-200 p-2 text-center font-mono text-[11px] font-bold text-slate-600">
                  時限 / 時間
                </th>

                {/* Column Headers with Weekday Selector (横軸の定義) */}
                {activeTable.colHeaders.map((colName, cIdx) => {
                  const currentDayVal =
                    WEEKDAY_OPTIONS.find((w) => w.label === colName)?.value ?? cIdx;
                  const isExcluded = currentDayVal === -1;

                  return (
                    <th
                      key={`col-header-${cIdx}`}
                      className={`border-r border-slate-200 p-2 text-center transition ${
                        isExcluded ? 'bg-slate-200/50 text-slate-400' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <select
                          value={currentDayVal}
                          onChange={(e) => handleColHeaderChange(cIdx, Number(e.target.value))}
                          className={`rounded border px-1.5 py-0.5 text-xs font-bold focus:outline-hidden ${
                            isExcluded
                              ? 'border-slate-300 bg-slate-100 text-slate-400'
                              : 'border-blue-300 bg-white text-blue-700'
                          }`}
                        >
                          {WEEKDAY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono text-[10px] text-slate-400">列 {cIdx + 1}</span>
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
                  <tr
                    key={`row-${rIdx}`}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    {/* Row Time Header (縦軸) */}
                    <td className="border-r border-slate-200 bg-slate-50/60 p-2 text-center">
                      <div className="font-bold text-slate-800">{rIdx + 1}限</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {pt?.startTime} - {pt?.endTime}
                      </div>
                    </td>

                    {/* Cells */}
                    {row.map((cell, cIdx) => {
                      const isExcluded = activeTable.colHeaders[cIdx] === '除外';
                      const hasContent = Boolean(cell.text && cell.title.trim());

                      return (
                        <td
                          key={`cell-${rIdx}-${cIdx}`}
                          onClick={() => !isExcluded && handleStartEditCell(rIdx, cIdx)}
                          className={`group relative border-r border-slate-200 p-2 align-top transition cursor-pointer ${
                            isExcluded
                              ? 'bg-slate-100/40 opacity-50 cursor-not-allowed'
                              : hasContent
                                ? 'bg-sky-50/40 hover:bg-sky-50'
                                : 'hover:bg-slate-100/50'
                          }`}
                        >
                          {hasContent ? (
                            <div className="flex h-full flex-col justify-between">
                              <div>
                                <span className="font-bold text-sky-950 block leading-snug">
                                  {cell.title}
                                </span>
                                {cell.roomOrNote && (
                                  <span className="text-[10px] text-sky-700 block whitespace-pre-wrap mt-0.5">
                                    {cell.roomOrNote}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span>{pt?.startTime}</span>
                                <button
                                  onClick={(e) => handleClearCell(rIdx, cIdx, e)}
                                  title="セルをクリア"
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-12 items-center justify-center text-[10px] text-slate-300">
                              + 追加
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

      {/* Cell Edit Modal */}
      {editingCell && (
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
    </div>
  );
}
