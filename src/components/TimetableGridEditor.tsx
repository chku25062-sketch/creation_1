'use client';

import React, { useState } from 'react';
import { CalendarDays, Plus, Trash2, Check, Edit2, FileSpreadsheet } from 'lucide-react';
import { GridCell } from '@/lib/importers/gridOcrParser';
import { minutesToTimeString } from '@/lib/timeUtils';
import { formatCellText, matrixToCsv, TimetableCsvMatrix } from '@/lib/importers/gridDetection';

interface TimetableGridEditorProps {
  initialGrid: GridCell[][];
  onApply: (cells: GridCell[]) => void;
  onCancel: () => void;
}

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

export function TimetableGridEditor({ initialGrid, onApply, onCancel }: TimetableGridEditorProps) {
  const [grid, setGrid] = useState<GridCell[][]>(initialGrid);
  const [editingCell, setEditingCell] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);

  const numRows = grid.length;
  const numCols = grid[0]?.length || 5;

  const getColumnHeaderLabel = (c: number) => {
    if (numCols <= 7 && c < DAY_LABELS.length) {
      return `${DAY_LABELS[c]}曜日`;
    }
    return `列 ${c + 1}`;
  };

  const handleStartEdit = (r: number, c: number) => {
    setEditingCell({ r, c });
    setEditText(grid[r][c].text || grid[r][c].title || '');
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;
    const { r, c } = editingCell;

    // 単一改行は連結、空行は改行保持、空ならnull
    const formatted = formatCellText(editText);
    const title = formatted || '';
    const lines = formatted ? formatted.split('\n') : [];
    const roomOrNote =
      formatted && formatted.includes('\n') ? formatted.split('\n').slice(1).join('\n') : '';

    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].text = formatted;
      next[r][c].fullText = title;
      next[r][c].rawLines = lines;
      next[r][c].title = title;
      next[r][c].roomOrNote = roomOrNote;
      return next;
    });

    setEditingCell(null);
  };

  const handleClearCell = (r: number, c: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].text = null;
      next[r][c].fullText = '';
      next[r][c].rawLines = [];
      next[r][c].title = '';
      next[r][c].roomOrNote = '';
      return next;
    });
  };

  const handleToggleSaturday = () => {
    if (numCols === 5) {
      // 6列(土曜)を追加
      setGrid((prev) =>
        prev.map((row, rIdx) => [
          ...row,
          {
            dayIndex: 5,
            periodIndex: rIdx + 1,
            text: null,
            rawLines: [],
            fullText: '',
            title: '',
            roomOrNote: '',
            startMinutes: row[0]?.startMinutes || 540,
            endMinutes: row[0]?.endMinutes || 630,
          },
        ]),
      );
    } else {
      // 5列(月〜金)に戻す
      setGrid((prev) => prev.map((row) => row.slice(0, 5)));
    }
  };

  const handleAddRow = () => {
    if (numRows >= 20) return;
    const nextPeriod = numRows + 1;
    const lastRow = grid[numRows - 1];
    const newStart = (lastRow ? lastRow[0]?.endMinutes : 18 * 60) + 15;
    const newEnd = newStart + 90;

    const newRow: GridCell[] = Array.from({ length: numCols }, (_, c) => ({
      dayIndex: c,
      periodIndex: nextPeriod,
      text: null,
      rawLines: [],
      fullText: '',
      title: '',
      roomOrNote: '',
      startMinutes: newStart,
      endMinutes: newEnd,
    }));

    setGrid([...grid, newRow]);
  };

  // CSV形式としてクリップボードへコピー
  const handleCopyAsCsv = () => {
    const matrix: TimetableCsvMatrix = grid.map((row) =>
      row.map((cell) => (cell.text ? cell.text : null)),
    );
    const headers = Array.from({ length: numCols }, (_, c) => getColumnHeaderLabel(c));
    const csvContent = matrixToCsv(matrix, headers);

    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteApply = () => {
    const validCells: GridCell[] = [];
    grid.forEach((row) => {
      row.forEach((cell) => {
        // textがnullでなく、titleが存在するコマのみ反映
        if (cell.text && cell.title.trim()) {
          validCells.push(cell);
        }
      });
    });
    onApply(validCells);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold text-white">
            時間割テーブル確認 (CSVデータ構造)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyAsCsv}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title="CSV形式のテキストとしてクリップボードにコピー"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">CSVコピー完了</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-3 w-3 text-cyan-400" />
                <span>CSVコピー</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleToggleSaturday}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            {numCols === 5 ? '＋ 土曜を追加' : '土曜を隠す'}
          </button>
          {numRows < 20 && (
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              <Plus className="h-3 w-3" />
              <span>{numRows + 1}限を追加</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>
          空マスは<span className="font-mono text-slate-500">null</span>
          として扱われます。セルをクリックして講義内容を直接編集できます。
        </span>
      </div>

      {/* Grid Table */}
      <div className="max-h-[50vh] overflow-x-auto overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-14 border border-slate-800/80 bg-slate-900/90 p-2 text-center font-semibold text-slate-400">
                時限
              </th>
              {Array.from({ length: numCols }, (_, c) => (
                <th
                  key={c}
                  className="min-w-[110px] border border-slate-800/80 bg-slate-900/90 p-2 text-center font-semibold text-slate-200"
                >
                  {getColumnHeaderLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => {
              const period = r + 1;
              const timeStr = row[0]
                ? `${minutesToTimeString(row[0].startMinutes)}-${minutesToTimeString(row[0].endMinutes)}`
                : '';

              return (
                <tr key={r}>
                  {/* Period Header Column */}
                  <td className="border border-slate-800/80 bg-slate-900/50 p-2 text-center font-medium text-slate-400">
                    <div className="font-bold text-white">{period}限</div>
                    <div className="font-mono text-[9px] text-slate-400">{timeStr}</div>
                  </td>

                  {/* Day Cells */}
                  {row.map((cell, c) => {
                    const isEditing = editingCell?.r === r && editingCell?.c === c;
                    const hasContent = Boolean(cell.text && cell.text.trim());

                    return (
                      <td
                        key={c}
                        onClick={() => !isEditing && handleStartEdit(r, c)}
                        className={`group relative cursor-pointer border border-slate-800/80 p-2 align-top transition ${
                          isEditing
                            ? 'bg-slate-900 ring-2 ring-cyan-500'
                            : hasContent
                              ? 'bg-blue-950/20 hover:bg-blue-900/30'
                              : 'bg-slate-950/30 hover:bg-slate-900/40'
                        }`}
                      >
                        {isEditing ? (
                          <div
                            className="flex flex-col gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <textarea
                              rows={3}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              placeholder="講義名や教室名 (空にするとnull)"
                              className="w-full resize-none rounded border border-cyan-500 bg-slate-900 p-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden"
                              autoFocus
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingCell(null)}
                                className="rounded px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="flex items-center gap-0.5 rounded bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-cyan-500"
                              >
                                <Check className="h-3 w-3" />
                                保存
                              </button>
                            </div>
                          </div>
                        ) : hasContent ? (
                          <div>
                            <div className="font-semibold whitespace-pre-line text-white">
                              {cell.text}
                            </div>

                            {/* Hover Action Buttons */}
                            <div className="absolute top-1 right-1 hidden gap-1 group-hover:flex">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(r, c);
                                }}
                                className="rounded bg-slate-800 p-1 text-slate-400 hover:text-white"
                                title="編集"
                              >
                                <Edit2 className="h-2.5 w-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleClearCell(r, c, e)}
                                className="rounded bg-slate-800 p-1 text-slate-400 hover:text-rose-400"
                                title="コマを空(null)にする"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-12 items-center justify-center font-mono text-[10px] text-slate-600 group-hover:text-cyan-400">
                            (null)
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

      {/* Footer Controls */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-white"
        >
          区画調整へ戻る
        </button>

        <button
          type="button"
          onClick={handleExecuteApply}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90"
        >
          <Check className="h-4 w-4" />
          <span>この時間割を計画表へ取り込む</span>
        </button>
      </div>
    </div>
  );
}
