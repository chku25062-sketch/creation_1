'use client';

import React, { useState } from 'react';
import { CalendarDays, Plus, Trash2, Check, Edit2, FileSpreadsheet, Tag, Info } from 'lucide-react';
import { GridCell } from '@/lib/importers/gridOcrParser';
import { minutesToTimeString } from '@/lib/timeUtils';
import { formatCellText, matrixToCsv, TimetableCsvMatrix } from '@/lib/importers/gridDetection';

export interface TimetableGridEditorApplyData {
  validCells: GridCell[];
  grid: GridCell[][];
  colHeaders: string[];
  rowHeaders: string[];
}

interface TimetableGridEditorProps {
  initialGrid: GridCell[][];
  initialColHeaders?: string[];
  initialRowHeaders?: string[];
  onApply: (data: TimetableGridEditorApplyData) => void;
  onCancel: () => void;
}

const DEFAULT_WEEKDAY_NAMES = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];

export function TimetableGridEditor({
  initialGrid,
  initialColHeaders,
  initialRowHeaders,
  onApply,
  onCancel,
}: TimetableGridEditorProps) {
  const [grid, setGrid] = useState<GridCell[][]>(initialGrid);
  const numRows = grid.length;
  const numCols = grid[0]?.length || 5;

  // 列名の状態管理（OCR抽出されたカラム名があれば優先採用、自由にテキスト編集可能）
  const [colHeaders, setColHeaders] = useState<string[]>(() => {
    if (initialColHeaders && initialColHeaders.length === numCols) {
      return initialColHeaders;
    }
    return Array.from({ length: numCols }, (_, c) => {
      if (initialColHeaders && initialColHeaders[c]) {
        return initialColHeaders[c];
      }
      if (numCols <= 7 && c < DEFAULT_WEEKDAY_NAMES.length) {
        return DEFAULT_WEEKDAY_NAMES[c];
      }
      return `列 ${c + 1}`;
    });
  });

  // 行名の状態管理（OCR抽出されたインデックス名があれば優先採用、自由にテキスト編集可能）
  const [rowHeaders, setRowHeaders] = useState<string[]>(() => {
    if (initialRowHeaders && initialRowHeaders.length === numRows) {
      return initialRowHeaders;
    }
    return Array.from({ length: numRows }, (_, r) => {
      if (initialRowHeaders && initialRowHeaders[r]) {
        return initialRowHeaders[r];
      }
      return `${r + 1}限`;
    });
  });

  // ヘッダー編集中の状態
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);

  // セル編集中の状態
  const [editingCell, setEditingCell] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);

  // 指定セルの編集内容をグリッドに反映する純粋ヘルパー関数
  const applyCellEditToGrid = (
    currentGrid: GridCell[][],
    r: number,
    c: number,
    textValue: string,
  ): GridCell[][] => {
    const formatted = formatCellText(textValue);
    const lines = formatted ? formatted.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const title = lines.length > 0 ? lines[0] : '';
    const roomOrNote = lines.length > 1 ? lines.slice(1).join('\n') : '';

    return currentGrid.map((row, rowIdx) =>
      row.map((cell, colIdx) => {
        if (rowIdx === r && colIdx === c) {
          return {
            ...cell,
            text: formatted || null,
            fullText: formatted || '',
            rawLines: lines,
            title,
            roomOrNote,
          };
        }
        return cell;
      }),
    );
  };

  // セル編集の開始・保存
  const handleStartEdit = (r: number, c: number) => {
    let currentGrid = grid;
    if (editingCell) {
      // 直前に編集中だったセルの内容をコミット
      currentGrid = applyCellEditToGrid(currentGrid, editingCell.r, editingCell.c, editText);
      setGrid(currentGrid);
    }
    setEditingCell({ r, c });
    setEditText(currentGrid[r]?.[c]?.text || currentGrid[r]?.[c]?.title || '');
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;
    const updatedGrid = applyCellEditToGrid(grid, editingCell.r, editingCell.c, editText);
    setGrid(updatedGrid);
    setEditingCell(null);
  };

  const handleClearCell = (r: number, c: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingCell?.r === r && editingCell?.c === c) {
      setEditingCell(null);
    }
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

  // 列の追加
  const handleAddCol = () => {
    if (numCols >= 14) return;
    const newColIdx = numCols;
    const newHeader =
      newColIdx < DEFAULT_WEEKDAY_NAMES.length
        ? DEFAULT_WEEKDAY_NAMES[newColIdx]
        : `列 ${newColIdx + 1}`;

    setColHeaders((prev) => [...prev, newHeader]);
    setGrid((prev) =>
      prev.map((row, rIdx) => [
        ...row,
        {
          dayIndex: newColIdx % 7,
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
  };

  // 行の追加
  const handleAddRow = () => {
    if (numRows >= 20) return;
    const nextPeriod = numRows + 1;
    const lastRow = grid[numRows - 1];
    const newStart = (lastRow ? lastRow[0]?.endMinutes : 18 * 60) + 15;
    const newEnd = newStart + 90;

    setRowHeaders((prev) => [...prev, `${nextPeriod}限`]);

    const newRow: GridCell[] = Array.from({ length: numCols }, (_, c) => ({
      dayIndex: c % 7,
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

  // プリセット一括適用: 曜日
  const handleApplyWeekdayPreset = () => {
    setColHeaders(
      Array.from({ length: numCols }, (_, c) => {
        if (c < DEFAULT_WEEKDAY_NAMES.length) {
          return DEFAULT_WEEKDAY_NAMES[c];
        }
        return `列 ${c + 1}`;
      }),
    );
  };

  // プリセット一括適用: アルファベット (A, B, C...)
  const handleApplyAlphabetPreset = () => {
    setColHeaders(Array.from({ length: numCols }, (_, c) => String.fromCharCode(65 + (c % 26))));
  };

  // プリセット一括適用: 連番 (列 1, 列 2...)
  const handleApplyNumberPreset = () => {
    setColHeaders(Array.from({ length: numCols }, (_, c) => `列 ${c + 1}`));
  };

  // CSV形式としてクリップボードへコピー（カスタム列名・行名を反映）
  const handleCopyAsCsv = () => {
    const matrix: TimetableCsvMatrix = grid.map((row) =>
      row.map((cell) => (cell.text ? cell.text : null)),
    );
    const csvContent = matrixToCsv(matrix, colHeaders, rowHeaders);

    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 計画表への反映
  const handleExecuteApply = () => {
    // もし現在編集中であれば、直ちにその内容を反映したグリッドを使用
    let effectiveGrid = grid;
    if (editingCell) {
      effectiveGrid = applyCellEditToGrid(effectiveGrid, editingCell.r, editingCell.c, editText);
      setGrid(effectiveGrid);
      setEditingCell(null);
    }

    const validCells: GridCell[] = [];
    effectiveGrid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.text && cell.title.trim()) {
          // 列名から曜日を自動判定
          const colName = colHeaders[c] || '';
          let resolvedDay = c % 7;
          if (colName.includes('月')) resolvedDay = 0;
          else if (colName.includes('火')) resolvedDay = 1;
          else if (colName.includes('水')) resolvedDay = 2;
          else if (colName.includes('木')) resolvedDay = 3;
          else if (colName.includes('金')) resolvedDay = 4;
          else if (colName.includes('土')) resolvedDay = 5;
          else if (colName.includes('日')) resolvedDay = 6;

          validCells.push({
            ...cell,
            dayIndex: resolvedDay,
            periodIndex: r + 1,
          });
        }
      });
    });
    onApply({
      validCells,
      grid: effectiveGrid,
      colHeaders,
      rowHeaders,
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full justify-between gap-2.5">
      {/* Header Tools */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-800">
            表データエディタ（列名・行名も編集可能）
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* プリセット変更 */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 shadow-2xs">
            <Tag className="h-3 w-3 text-blue-600" />
            <span className="text-[10px] font-medium text-slate-600">列名セット:</span>
            <button
              type="button"
              onClick={handleApplyWeekdayPreset}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              曜日
            </button>
            <button
              type="button"
              onClick={handleApplyAlphabetPreset}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              A,B,C
            </button>
            <button
              type="button"
              onClick={handleApplyNumberPreset}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              番号
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyAsCsv}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            title="CSV形式のテキストとしてクリップボードにコピー"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-600">CSVコピー完了</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                <span>CSVコピー</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleAddCol}
            disabled={numCols >= 14}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition disabled:opacity-40"
          >
            <Plus className="h-3 w-3 text-slate-500" />
            <span>列を追加</span>
          </button>

          <button
            type="button"
            onClick={handleAddRow}
            disabled={numRows >= 20}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition disabled:opacity-40"
          >
            <Plus className="h-3 w-3 text-slate-500" />
            <span>行を追加</span>
          </button>
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span>
            <strong className="text-slate-700">列名</strong>や
            <strong className="text-slate-700">行名</strong>
            をクリックしてリネームできます。
          </span>
        </span>
      </div>

      {/* Grid Table (ノート調方眼テーブル) */}
      <div className="flex-1 min-h-[200px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-20 border border-slate-200 bg-slate-100 p-2 text-center font-bold text-slate-600">
                行 \ 列
              </th>
              {colHeaders.map((headerText, c) => (
                <th
                  key={c}
                  onClick={() => setEditingColIdx(c)}
                  className="group min-w-[110px] cursor-pointer border border-slate-200 bg-slate-50 p-2 text-center font-bold text-slate-800 transition hover:bg-blue-50/50"
                  title="クリックして列名を編集"
                >
                  {editingColIdx === c ? (
                    <input
                      type="text"
                      defaultValue={headerText}
                      autoFocus
                      onBlur={(e) => {
                        const val = e.target.value.trim() || `列 ${c + 1}`;
                        setColHeaders((prev) => {
                          const next = [...prev];
                          next[c] = val;
                          return next;
                        });
                        setEditingColIdx(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-full rounded border border-blue-500 bg-white px-1 py-0.5 text-center text-xs text-slate-900 font-bold focus:outline-hidden"
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span>{headerText}</span>
                      <Edit2 className="h-2.5 w-2.5 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => {
              const rowLabel = rowHeaders[r] || `${r + 1}行`;
              const timeStr = row[0]
                ? `${minutesToTimeString(row[0].startMinutes)}-${minutesToTimeString(row[0].endMinutes)}`
                : '';

              return (
                <tr key={r}>
                  {/* Row Header Column (行名編集可能) */}
                  <td
                    onClick={() => setEditingRowIdx(r)}
                    className="group w-20 cursor-pointer border border-slate-200 bg-slate-50/80 p-2 text-center font-medium text-slate-600 transition hover:bg-blue-50/50"
                    title="クリックして行名を編集"
                  >
                    {editingRowIdx === r ? (
                      <input
                        type="text"
                        defaultValue={rowLabel}
                        autoFocus
                        onBlur={(e) => {
                          const val = e.target.value.trim() || `${r + 1}行`;
                          setRowHeaders((prev) => {
                            const next = [...prev];
                            next[r] = val;
                            return next;
                          });
                          setEditingRowIdx(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-full rounded border border-blue-500 bg-white px-1 py-0.5 text-center text-xs text-slate-900 font-bold focus:outline-hidden"
                      />
                    ) : (
                      <div>
                        <div className="flex items-center justify-center gap-1 font-bold text-slate-800">
                          <span>{rowLabel}</span>
                          <Edit2 className="h-2.5 w-2.5 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                        </div>
                        <div className="font-mono text-[9px] text-slate-500">{timeStr}</div>
                      </div>
                    )}
                  </td>

                  {/* Data Cells (付箋調セル) */}
                  {row.map((cell, c) => {
                    const isEditing = editingCell?.r === r && editingCell?.c === c;
                    const hasContent = Boolean(cell.text && cell.text.trim());

                    return (
                      <td
                        key={c}
                        onClick={() => !isEditing && handleStartEdit(r, c)}
                        className={`group relative cursor-pointer border border-slate-200 p-2 align-top transition ${
                          isEditing
                            ? 'bg-blue-50/50 ring-2 ring-blue-500'
                            : hasContent
                              ? 'bg-blue-50/40 hover:bg-blue-50/70'
                              : 'bg-white hover:bg-slate-50/80'
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
                              onBlur={handleSaveEdit}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEdit();
                                }
                              }}
                              placeholder="セル内容 (空にするとnull)"
                              className="w-full resize-none rounded border border-blue-500 bg-white p-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden shadow-2xs"
                              autoFocus
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setEditingCell(null)}
                                className="rounded px-2 py-0.5 text-[10px] text-slate-500 hover:text-slate-800"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={handleSaveEdit}
                                className="flex items-center gap-0.5 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700 shadow-2xs"
                              >
                                <Check className="h-3 w-3" />
                                保存
                              </button>
                            </div>
                          </div>
                        ) : hasContent ? (
                          <div>
                            <div className="font-semibold whitespace-pre-line text-slate-800">
                              {cell.text}
                            </div>

                            {/* Action Buttons: 常にタップ可能（ホバー時は強調） */}
                            <div className="absolute top-1 right-1 flex gap-1 opacity-60 hover:opacity-100 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(r, c);
                                }}
                                className="rounded bg-white border border-slate-200 p-1 text-slate-500 hover:text-slate-800 shadow-2xs cursor-pointer"
                                title="編集"
                              >
                                <Edit2 className="h-2.5 w-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleClearCell(r, c, e)}
                                className="rounded bg-white border border-slate-200 p-1 text-slate-500 hover:text-rose-600 shadow-2xs cursor-pointer"
                                title="コマを空(null)にする"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-12 items-center justify-center font-mono text-[10px] text-slate-300 group-hover:text-blue-500">
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

      {/* Footer Controls (画面最下部固定・ノート調ホワイトバー) */}
      <div className="shrink-0 flex items-center justify-between border-t border-slate-200 bg-white/95 pt-2 sm:pt-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 shadow-2xs"
        >
          区画調整へ戻る
        </button>

        <button
          type="button"
          onClick={handleExecuteApply}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <Check className="h-4 w-4 text-white" />
          <span>この表データを計画表へ取り込む</span>
        </button>
      </div>
    </div>
  );
}
