'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  Target,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { ParsedScheduleItem, FixedSlot, TaskItem, ImportedTableData } from '@/types';
import { parseTextSchedule } from '@/lib/importers/textParser';
import { OcrProgress } from '@/lib/importers/ocrParser';
import { GridCell } from '@/lib/importers/gridOcrParser';
import { minutesToTimeString, formatDuration } from '@/lib/timeUtils';
import { ImageCropper } from '@/components/ImageCropper';
import { GridAdjuster } from '@/components/GridAdjuster';
import { TimetableGridEditor } from '@/components/TimetableGridEditor';
import { runCellBatchOcr } from '@/lib/importers/cellOcrRunner';
import { GridAreaBounds } from '@/lib/importers/gridDetection';

interface FileImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newFixedSlots: FixedSlot[], newTasks: TaskItem[], mode: 'add' | 'replace') => void;
  onSaveTableData?: (table: ImportedTableData) => void;
}

type ModalStep = 'upload' | 'crop' | 'grid_adjust' | 'grid_review' | 'list_review';

export function FileImportModal({
  isOpen,
  onClose,
  onImport,
  onSaveTableData,
}: FileImportModalProps) {
  const [step, setStep] = useState<ModalStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OcrProgress>({
    status: '',
    progress: 0,
  });
  const [parsedItems, setParsedItems] = useState<ParsedScheduleItem[]>([]);
  const [gridData, setGridData] = useState<GridCell[][] | null>(null);
  const [detectedColHeaders, setDetectedColHeaders] = useState<string[] | undefined>(undefined);
  const [detectedRowHeaders, setDetectedRowHeaders] = useState<string[] | undefined>(undefined);
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setCroppedBlob(null);
    setParsedItems([]);
    setGridData(null);
    setDetectedColHeaders(undefined);
    setDetectedRowHeaders(undefined);
    setErrorMsg(null);
    setIsProcessing(false);
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg(null);

    if (selectedFile.type.startsWith('image/')) {
      // 画像の場合: まず表領域のクロップ画面へ
      setStep('crop');
    } else {
      // テキスト/CSVの場合: 直接パース
      processTextFile(selectedFile);
    }
  };

  const processTextFile = async (textFile: File) => {
    setIsProcessing(true);
    setProgress({ status: 'テキストを解析中...', progress: 0.8 });
    try {
      const text = await textFile.text();
      const items = parseTextSchedule(text);
      if (items.length === 0) {
        setErrorMsg(
          '有効なスケジュール項目が見つかりませんでした。「09:00 - 10:30 講義」や「読書 60分」などの形式をお試しください。',
        );
        setStep('upload');
      } else {
        setParsedItems(items);
        setStep('list_review');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('テキスト解析中にエラーが発生しました。');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  // クロップ完了時 -> グリッド境界線の確認・調整ステップへ
  const handleCropComplete = (blob: Blob) => {
    setCroppedBlob(blob);
    setStep('grid_adjust');
  };

  // グリッド線確定時 -> セル単位バッチOCRの実行 (データマス目のみ)
  const handleGridAdjustConfirm = async (
    colDividers: number[],
    rowDividers: number[],
    columns: number,
    rows: number,
    bounds: GridAreaBounds,
  ) => {
    if (!croppedBlob) return;

    setStep('upload'); // 進捗表示画面へ
    setIsProcessing(true);
    setProgress({
      status: '区画ごとに高精度OCR解析を開始中...',
      progress: 0.05,
    });

    try {
      const { grid, colHeaders, rowHeaders } = await runCellBatchOcr(
        croppedBlob,
        colDividers,
        rowDividers,
        bounds,
        (p) => {
          setProgress({ status: p.status, progress: p.progress });
        },
      );

      setGridData(grid);
      setDetectedColHeaders(colHeaders);
      setDetectedRowHeaders(rowHeaders);
      setStep('grid_review');
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('区画OCR解析中にエラーが発生しました。');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  // グリッド表からの取り込み確定
  const handleApplyGrid = (validCells: GridCell[]) => {
    // 読み込みデータ（ImportedTableData）として保存
    if (onSaveTableData && gridData && gridData.length > 0) {
      const numRows = gridData.length;
      const numCols = gridData[0].length;
      const defaultColHeaders = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];

      const tableData: ImportedTableData = {
        id: `imported-table-${Date.now()}`,
        name: file?.name
          ? file.name.replace(/\.[^/.]+$/, '')
          : `取り込み時間割 (${new Date().toLocaleDateString('ja-JP')})`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        numRows,
        numCols,
        colHeaders:
          detectedColHeaders && detectedColHeaders.length === numCols
            ? detectedColHeaders
            : Array.from({ length: numCols }, (_, c) => defaultColHeaders[c] || `列 ${c + 1}`),
        rowHeaders:
          detectedRowHeaders && detectedRowHeaders.length === numRows
            ? detectedRowHeaders
            : Array.from({ length: numRows }, (_, r) => `${r + 1}限`),
        axisConfig: {
          startTime: '08:50',
          periodMinutes: 90,
          intervalMinutes: 10,
          hasLunch: true,
          lunchAfterPeriod: 2,
          lunchMinutes: 50,
        },
        cells: gridData,
      };

      onSaveTableData(tableData);
    }

    const fixedSlots: FixedSlot[] = validCells.map((cell, idx) => ({
      id: `grid-fixed-${Date.now()}-${idx}`,
      title: cell.title,
      category: 'lecture',
      startMinutes: cell.startMinutes,
      endMinutes: cell.endMinutes,
      color: '#0ea5e9',
      daysOfWeek: [cell.dayIndex],
    }));

    onImport(fixedSlots, [], importMode);
    handleReset();
    onClose();
  };

  // リスト形式からの取り込み確定
  const handleApplyList = () => {
    const fixedSlots: FixedSlot[] = [];
    const tasks: TaskItem[] = [];

    parsedItems.forEach((item, idx) => {
      if (item.type === 'fixed') {
        fixedSlots.push({
          id: `imported-fixed-${Date.now()}-${idx}`,
          title: item.title,
          category: (item.category as FixedSlot['category']) || 'work',
          startMinutes: item.startMinutes ?? 540,
          endMinutes: item.endMinutes ?? 630,
          color: item.category === 'lecture' ? '#0ea5e9' : '#3b82f6',
          daysOfWeek: item.daysOfWeek,
        });
      } else {
        tasks.push({
          id: `imported-task-${Date.now()}-${idx}`,
          title: item.title,
          durationMinutes: item.durationMinutes || 60,
          category: (item.category as TaskItem['category']) || 'study',
          priority: 'medium',
          period: 'day',
          completed: false,
        });
      }
    });

    onImport(fixedSlots, tasks, importMode);
    handleReset();
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleToggleType = (id: string) => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextType = item.type === 'fixed' ? 'task' : 'fixed';
          return {
            ...item,
            type: nextType,
            startMinutes: nextType === 'fixed' ? 540 : undefined,
            endMinutes: nextType === 'fixed' ? 630 : undefined,
            durationMinutes: item.durationMinutes || 60,
          };
        }
        return item;
      }),
    );
  };

  const handleUpdateItem = (id: string, updates: Partial<ParsedScheduleItem>) => {
    setParsedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleDeleteItem = (id: string) => {
    setParsedItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {step === 'crop'
                  ? '表領域の切り取り (クロップ)'
                  : step === 'grid_adjust'
                    ? '表の区画 (グリッド) の確認・調整'
                    : step === 'grid_review'
                      ? '時間割グリッドの確認・編集'
                      : 'ファイルから一括取り込み'}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 'crop'
                  ? '時間割の表部分だけを囲むことで認識精度が大幅に向上します'
                  : step === 'grid_adjust'
                    ? '破線をドラッグして時間割の行と列の境目に合わせてください（区画ごとに高精度解析します）'
                    : '時間割アプリのスクショ画像やテキストメモから自動解析（外部API不要）'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* STEP 1: Upload Zone (or Processing) */}
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  isProcessing
                    ? 'border-cyan-500/50 bg-cyan-500/5 pointer-events-none'
                    : 'border-slate-700 bg-slate-950/40 hover:border-cyan-500 hover:bg-slate-950/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.txt,.csv,.md"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {isProcessing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">{progress.status}</p>
                      <p className="text-xs text-slate-400">
                        外部APIを使わず、ブラウザ内で区画ごとに高精度OCR解析しています
                      </p>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-2 h-2 w-56 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                        style={{
                          width: `${Math.round(progress.progress * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex gap-3 text-slate-400">
                      <ImageIcon className="h-8 w-8 text-cyan-400" />
                      <FileText className="h-8 w-8 text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      時間割の画像 または テキストファイルをドラッグ＆ドロップ
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      対応形式: PNG, JPEG, WebP, .txt, .csv, .md （クリックしてファイル選択）
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-slate-500">
                      <span className="rounded bg-slate-800 px-2 py-0.5">
                        時間割アプリのスクショ
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5">
                        画像クロップ＆グリッド検出
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5">区画・改行の立体認識</span>
                    </div>
                  </>
                )}
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Crop Area (トリミング) */}
          {step === 'crop' && file && (
            <ImageCropper
              imageFile={file}
              onCropComplete={handleCropComplete}
              onCancel={handleReset}
            />
          )}

          {/* STEP 3: Grid Adjust (グリッド境界線の確認・調整) */}
          {step === 'grid_adjust' && croppedBlob && (
            <GridAdjuster
              imageBlob={croppedBlob}
              onConfirm={handleGridAdjustConfirm}
              onBack={() => setStep('crop')}
            />
          )}

          {/* STEP 4: Grid Table Review (2D時間割テーブル確認・編集) */}
          {step === 'grid_review' && gridData && (
            <TimetableGridEditor
              initialGrid={gridData}
              initialColHeaders={detectedColHeaders}
              initialRowHeaders={detectedRowHeaders}
              onApply={handleApplyGrid}
              onCancel={() => setStep('grid_adjust')}
            />
          )}

          {/* STEP 5: List Review (テキストファイルやフォールバック用) */}
          {step === 'list_review' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {parsedItems.length} 件のスケジュール候補を抽出しました
                </span>
                <button onClick={handleReset} className="text-cyan-400 hover:underline">
                  別のファイルを再アップロード
                </button>
              </div>

              {/* Items List */}
              <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
                {parsedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-center"
                  >
                    {/* Title & Type Toggle */}
                    <div className="flex flex-1 items-center gap-2.5">
                      <button
                        onClick={() => handleToggleType(item.id)}
                        title="固定枠と目標タスクを切り替え"
                        className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                          item.type === 'fixed'
                            ? 'border border-blue-500/40 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                            : 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                        }`}
                      >
                        {item.type === 'fixed' ? (
                          <>
                            <Shield className="h-3 w-3" />
                            <span>固定枠</span>
                          </>
                        ) : (
                          <>
                            <Target className="h-3 w-3" />
                            <span>タスク</span>
                          </>
                        )}
                      </button>

                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                        className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-white transition hover:border-slate-700 focus:border-cyan-500 focus:bg-slate-900 focus:outline-hidden"
                      />
                    </div>

                    {/* Meta Controls */}
                    <div className="flex items-center gap-3">
                      {item.type === 'fixed' && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <span>
                            {minutesToTimeString(item.startMinutes ?? 540)} -{' '}
                            {minutesToTimeString(item.endMinutes ?? 630)}
                          </span>
                        </div>
                      )}

                      {item.type === 'task' && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <span>{formatDuration(item.durationMinutes ?? 60)}</span>
                        </div>
                      )}

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (List Review 画面用) */}
        {step === 'list_review' && parsedItems.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Import Mode Radio */}
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span className="text-slate-400">反映方法:</span>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="importMode"
                  value="add"
                  checked={importMode === 'add'}
                  onChange={() => setImportMode('add')}
                  className="accent-cyan-500"
                />
                <span>既存の予定に追加</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-cyan-500"
                />
                <span className="text-rose-300">上書き（置き換え）</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                キャンセル
              </button>
              <button
                onClick={handleApplyList}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{parsedItems.length} 件をタイムラインに反映</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
