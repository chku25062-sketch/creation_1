'use client';

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Shield,
  Sun,
  CalendarDays,
} from 'lucide-react';
import { ImportedTableData, ScheduleInclusionSettings } from '@/types';
import { getTableColorSchemeByIndex } from '@/components/Timeline24h';

export interface TableMobileSwitcherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tables: ImportedTableData[];
  selectedItemId: string;
  onSelectItem: (id: string) => void;
  onAddNewTable: () => void;
  onUpdateTableName: (tableId: string, newName: string) => void;
  onToggleTableApply: (table: ImportedTableData) => void;
  onDeleteTable: (tableId: string, e: React.MouseEvent) => void;
  isTableApplied: (table: ImportedTableData) => boolean;
  isSlotsApplied: boolean;
  isDailyApplied: boolean;
  isWeeklyApplied: boolean;
  onInclusionSettingsChange?: (settings: ScheduleInclusionSettings) => void;
}

export function TableMobileSwitcherSheet({
  isOpen,
  onClose,
  tables,
  selectedItemId,
  onSelectItem,
  onAddNewTable,
  onUpdateTableName,
  onToggleTableApply,
  onDeleteTable,
  isTableApplied,
  isSlotsApplied,
  isDailyApplied,
  isWeeklyApplied,
  onInclusionSettingsChange,
}: TableMobileSwitcherSheetProps) {
  const [editingMobileTableId, setEditingMobileTableId] = useState<string | null>(null);
  const [mobileTempTableName, setMobileTempTableName] = useState<string>('');

  if (!isOpen) return null;

  const handleSaveName = (tableId: string) => {
    if (mobileTempTableName.trim()) {
      onUpdateTableName(tableId, mobileTempTableName.trim());
    }
    setEditingMobileTableId(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end">
      {/* 背景オーバーレイ */}
      <div
        onClick={onClose}
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
              onClick={onClose}
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
              onAddNewTable();
              onClose();
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
                    onSelectItem(t.id);
                    onClose();
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
                          if (e.key === 'Enter') handleSaveName(t.id);
                          if (e.key === 'Escape') setEditingMobileTableId(null);
                        }}
                        autoFocus
                        className="flex-1 h-8 rounded-lg border border-blue-400 bg-white px-2 text-xs font-bold text-slate-800 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveName(t.id)}
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
                          <span className="ml-2 font-bold text-emerald-600">反映ON</span>
                        ) : (
                          <span className="ml-2 font-medium text-slate-400">反映OFF</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 右側アクション群: 反映スイッチ, 編集ボタン, 削除ボタン */}
                {!isEditingThisTable && (
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isTableApplied(t)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTableApply(t);
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

                    {tables.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTable(t.id, e);
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
                onSelectItem('sys-slots');
                onClose();
              }}
              className={`w-full p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                selectedItemId === 'sys-slots'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span>固定枠</span>
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
                onSelectItem('sys-daily');
                onClose();
              }}
              className={`w-full p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                selectedItemId === 'sys-daily'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                <span>日課</span>
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
                onSelectItem('sys-weekly');
                onClose();
              }}
              className={`w-full p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                selectedItemId === 'sys-weekly'
                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-purple-600" />
                <span>週次タスク</span>
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
            onClick={onClose}
            className="w-full h-11 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
