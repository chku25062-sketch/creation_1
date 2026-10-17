'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  Check,
  RefreshCw,
  Maximize2,
  Move,
  MousePointerClick,
  Sparkles,
  Loader2,
  Magnet,
} from 'lucide-react';
import {
  detectTableBoundingBox,
  extractSnapGuidelines,
  snapToClosestGuideline,
  SnapGuidelines,
  dataUrlToBlob,
} from '@/lib/importers/gridDetection';

interface ImageCropperProps {
  imageFile: File;
  onCropComplete: (croppedBlob: Blob, width: number, height: number) => void;
  onCancel: () => void;
}

type DragAction = 'none' | 'create' | 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

interface NormalizedRect {
  x: number; // 0.0 ~ 1.0 (left ratio)
  y: number; // 0.0 ~ 1.0 (top ratio)
  w: number; // 0.0 ~ 1.0 (width ratio)
  h: number; // 0.0 ~ 1.0 (height ratio)
}

export function ImageCropper({ imageFile, onCropComplete, onCancel }: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  // 0.0 ~ 1.0 の正規化座標で管理 (画面サイズ変化に100%追従)
  const [cropRect, setCropRect] = useState<NormalizedRect | null>({
    x: 0.05,
    y: 0.05,
    w: 0.9,
    h: 0.9,
  });

  const [snapGuides, setSnapGuides] = useState<SnapGuidelines>({
    verticalLines: [],
    horizontalLines: [],
  });

  const [activeAction, setActiveAction] = useState<DragAction>('none');
  const [isDrawModeActive, setIsDrawModeActive] = useState<boolean>(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(true);
  const [detectedMessage, setDetectedMessage] = useState<string | null>(null);

  const imgWrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const isInitialMountedRef = useRef<boolean>(false);

  // ドラッグ追従用のRef（Windowイベント内で最新状態を参照するため）
  const dragSessionRef = useRef<{
    action: DragAction;
    startX: number;
    startY: number;
    initialRect: NormalizedRect;
    imgBounds: { left: number; top: number; width: number; height: number };
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // 初期読み込み時の初期枠設定
  const resetToDefault = useCallback(() => {
    setCropRect({
      x: 0.05,
      y: 0.05,
      w: 0.9,
      h: 0.9,
    });
    setIsDrawModeActive(false);
  }, []);

  // 表のデータマス本体の枠および全罫線吸着ガイドを完全自動検出
  const runAutoDetect = useCallback(async () => {
    setIsAutoDetecting(true);
    try {
      const [box, guides] = await Promise.all([
        detectTableBoundingBox(imageFile),
        extractSnapGuidelines(imageFile),
      ]);
      setSnapGuides(guides);
      if (box.hasDetected) {
        setCropRect({ x: box.x, y: box.y, w: box.w, h: box.h });
        setDetectedMessage('表のデータ領域を自動検出しました（枠線に強力スナップ中）');
        setTimeout(() => setDetectedMessage(null), 3500);
      } else {
        resetToDefault();
      }
    } catch (e) {
      console.warn('Auto table bounds detection failed', e);
      resetToDefault();
    } finally {
      setIsAutoDetecting(false);
    }
  }, [imageFile, resetToDefault]);

  // 初回マウント時: 表領域を自動検出して初期枠として提案
  useEffect(() => {
    if (!isInitialMountedRef.current) {
      isInitialMountedRef.current = true;
      runAutoDetect();
    }
  }, [runAutoDetect]);

  // 全体選択
  const handleSelectAll = useCallback(() => {
    setCropRect({
      x: 0,
      y: 0,
      w: 1.0,
      h: 1.0,
    });
    setIsDrawModeActive(false);
  }, []);

  // 枠をクリアして新規引き直しモードへ
  const handleClearForRedraw = useCallback(() => {
    setCropRect(null);
    setIsDrawModeActive(true);
  }, []);

  // ドラッグ開始 (枠全体移動 / 8方向リサイズ / 外側新規ドラッグ)
  const startDrag = useCallback(
    (e: React.PointerEvent, action: DragAction) => {
      e.preventDefault();
      e.stopPropagation();

      if (!imgRef.current) return;
      const bounds = imgRef.current.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;

      const clickRatioX = Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width));
      const clickRatioY = Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height));

      let initRect: NormalizedRect;

      if (action === 'create' || !cropRect) {
        initRect = { x: clickRatioX, y: clickRatioY, w: 0, h: 0 };
        setCropRect(initRect);
        action = 'create';
      } else {
        initRect = { ...cropRect };
      }

      dragSessionRef.current = {
        action,
        startX: e.clientX,
        startY: e.clientY,
        initialRect: initRect,
        imgBounds: {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        },
      };

      setActiveAction(action);
    },
    [cropRect],
  );

  // グローバル Window ポインタイベント (画面外への飛び出しにも完全に追従)
  useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || session.action === 'none') return;

      const { action, startX, startY, initialRect, imgBounds } = session;
      const dxRatio = (e.clientX - startX) / imgBounds.width;
      const dyRatio = (e.clientY - startY) / imgBounds.height;

      const minSize = 0.03; // 最小3%

      if (action === 'create') {
        const curRatioX = Math.max(0, Math.min(1, (e.clientX - imgBounds.left) / imgBounds.width));
        const curRatioY = Math.max(0, Math.min(1, (e.clientY - imgBounds.top) / imgBounds.height));

        const startRatioX = (startX - imgBounds.left) / imgBounds.width;
        const startRatioY = (startY - imgBounds.top) / imgBounds.height;

        let left = Math.min(startRatioX, curRatioX);
        let top = Math.min(startRatioY, curRatioY);
        let right = Math.max(startRatioX, curRatioX);
        let bottom = Math.max(startRatioY, curRatioY);

        left = snapToClosestGuideline(left, snapGuides.verticalLines, 0.0, right - minSize);
        right = snapToClosestGuideline(right, snapGuides.verticalLines, left + minSize, 1.0);
        top = snapToClosestGuideline(top, snapGuides.horizontalLines, 0.0, bottom - minSize);
        bottom = snapToClosestGuideline(bottom, snapGuides.horizontalLines, top + minSize, 1.0);

        setCropRect({
          x: left,
          y: top,
          w: Math.max(minSize, right - left),
          h: Math.max(minSize, bottom - top),
        });
        return;
      }

      if (action === 'move') {
        const rawX = Math.max(0, Math.min(1 - initialRect.w, initialRect.x + dxRatio));
        const rawY = Math.max(0, Math.min(1 - initialRect.h, initialRect.y + dyRatio));
        const snappedX = snapToClosestGuideline(
          rawX,
          snapGuides.verticalLines,
          0.0,
          1.0 - initialRect.w,
        );
        const snappedY = snapToClosestGuideline(
          rawY,
          snapGuides.horizontalLines,
          0.0,
          1.0 - initialRect.h,
        );
        setCropRect({ x: snappedX, y: snappedY, w: initialRect.w, h: initialRect.h });
        return;
      }

      // リサイズ処理 (8方向: e, w, s, n)
      let left = initialRect.x;
      let top = initialRect.y;
      let right = initialRect.x + initialRect.w;
      let bottom = initialRect.y + initialRect.h;

      if (action.includes('e')) {
        const rawRight = Math.min(
          1.0,
          Math.max(left + minSize, initialRect.x + initialRect.w + dxRatio),
        );
        right =
          rawRight >= 0.97
            ? 1.0
            : snapToClosestGuideline(rawRight, snapGuides.verticalLines, left + minSize, 1.0);
      }
      if (action.includes('w')) {
        const rawLeft = Math.max(0.0, Math.min(right - minSize, initialRect.x + dxRatio));
        left =
          rawLeft <= 0.03
            ? 0.0
            : snapToClosestGuideline(rawLeft, snapGuides.verticalLines, 0.0, right - minSize);
      }
      if (action.includes('s')) {
        const rawBottom = Math.min(
          1.0,
          Math.max(top + minSize, initialRect.y + initialRect.h + dyRatio),
        );
        bottom =
          rawBottom >= 0.97
            ? 1.0
            : snapToClosestGuideline(rawBottom, snapGuides.horizontalLines, top + minSize, 1.0);
      }
      if (action.includes('n')) {
        const rawTop = Math.max(0.0, Math.min(bottom - minSize, initialRect.y + dyRatio));
        top =
          rawTop <= 0.03
            ? 0.0
            : snapToClosestGuideline(rawTop, snapGuides.horizontalLines, 0.0, bottom - minSize);
      }

      setCropRect({
        x: left,
        y: top,
        w: Math.max(minSize, right - left),
        h: Math.max(minSize, bottom - top),
      });
    };

    const onWindowPointerUp = () => {
      if (dragSessionRef.current) {
        dragSessionRef.current = null;
        setActiveAction('none');
        setIsDrawModeActive(false);
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [snapGuides]);

  // クロップ実行 & 前処理 (コントラスト強調)
  const handleExecuteCrop = () => {
    if (!imgRef.current) {
      onCropComplete(imageFile, 800, 800);
      return;
    }

    const img = imgRef.current;
    const natW = img.naturalWidth || 800;
    const natH = img.naturalHeight || 800;

    const rect =
      cropRect && cropRect.w > 0.02 && cropRect.h > 0.02 ? cropRect : { x: 0, y: 0, w: 1, h: 1 };

    const cropX = Math.round(rect.x * natW);
    const cropY = Math.round(rect.y * natH);
    const cropW = Math.max(10, Math.round(rect.w * natW));
    const cropH = Math.max(10, Math.round(rect.h * natH));

    // 最大画像解像度の安全リミット（iOS Safari WebKitのCanvasメモリ制限・クラッシュ対策）
    // 表のOCRには長辺2048pxあれば充分すぎる高解像度。
    const MAX_DIMENSION = 2048;
    const maxDim = Math.max(cropW, cropH);
    const scale = maxDim > MAX_DIMENSION ? MAX_DIMENSION / maxDim : 1.0;
    const targetW = Math.round(cropW * scale);
    const targetH = Math.round(cropH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      // 万が一コンテキスト取得失敗時
      onCropComplete(imageFile, natW, natH);
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

    // iOS Safari / WebKit での toBlob 失敗（null）を完全防止する安全フォールバック
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob, targetW, targetH);
        } else {
          // toBlob が null を返した場合は、toDataURL から同期的に Blob を生成
          // 【超重要】絶対に元画像全体 (imageFile) にフォールバックしてはならない！
          const dataUrl = canvas.toDataURL('image/png');
          const safeBlob = dataUrlToBlob(dataUrl);
          onCropComplete(safeBlob, targetW, targetH);
        }
      },
      'image/png',
      0.95,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ツールバー / ガイド */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-1.5 font-medium text-cyan-300">
          <Crop className="h-4 w-4 shrink-0 text-cyan-400" />
          <span>
            {detectedMessage ||
              (isDrawModeActive
                ? 'ドラッグして、予定・講義のマス目（本体のみ）を囲んでください'
                : '※ 表のデータマス領域を自動検出しました。四隅のハンドルで微調整も可能です')}
          </span>
        </div>

        {/* 枠操作ボタン群 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isAutoDetecting}
            onClick={runAutoDetect}
            className="flex items-center gap-1 rounded-lg border border-cyan-800/60 bg-gradient-to-r from-cyan-950/80 to-blue-950/80 px-2.5 py-1 text-xs font-semibold text-cyan-300 shadow transition hover:from-cyan-900/90 hover:to-blue-900/90 disabled:opacity-50"
            title="表のデータマス本体の枠を自動検出し、ピタッと合わせます"
          >
            {isAutoDetecting ? (
              <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
            ) : (
              <Sparkles className="h-3 w-3 text-cyan-400" />
            )}
            <span>表枠を自動検出</span>
          </button>
          <button
            type="button"
            onClick={handleClearForRedraw}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition ${
              isDrawModeActive
                ? 'border-cyan-400 bg-cyan-950/60 font-semibold text-cyan-300 shadow-sm'
                : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
            }`}
          >
            <MousePointerClick className="h-3 w-3" />
            <span>新しく枠を描く</span>
          </button>
          <button
            type="button"
            onClick={handleSelectAll}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <Maximize2 className="h-3 w-3" />
            <span>全体選択</span>
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            <span>リセット</span>
          </button>
        </div>
      </div>

      {/* メインプレビューコンテナ */}
      <div className="flex max-h-[52vh] min-h-[260px] w-full select-none items-center justify-center overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-6 sm:p-8">
        {imageSrc && (
          <div
            ref={imgWrapperRef}
            onPointerDown={(e) => startDrag(e, 'create')}
            className="relative inline-block touch-none cursor-crosshair shadow-2xl"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop target"
              draggable={false}
              className="max-h-[50vh] w-auto max-w-full select-none object-contain pointer-events-none block"
            />

            {/* 周囲の暗転マスク */}
            {cropRect && cropRect.w > 0 && cropRect.h > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  clipPath: `polygon(
                    0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                    ${cropRect.x * 100}% ${cropRect.y * 100}%,
                    ${(cropRect.x + cropRect.w) * 100}% ${cropRect.y * 100}%,
                    ${(cropRect.x + cropRect.w) * 100}% ${(cropRect.y + cropRect.h) * 100}%,
                    ${cropRect.x * 100}% ${(cropRect.y + cropRect.h) * 100}%,
                    ${cropRect.x * 100}% ${cropRect.y * 100}%
                  )`,
                }}
              />
            )}

            {/* インタラクティブなクロップ枠 */}
            {cropRect && cropRect.w > 0 && cropRect.h > 0 && (
              <div
                onPointerDown={(e) => startDrag(e, 'move')}
                className={`absolute cursor-move border-2 transition-[box-shadow,border-color] duration-75 shadow-md ${
                  activeAction !== 'none'
                    ? 'border-cyan-300 bg-cyan-400/15 ring-2 ring-cyan-400/50 shadow-xl'
                    : 'border-cyan-400 bg-cyan-400/10 hover:border-cyan-300'
                }`}
                style={{
                  left: `${cropRect.x * 100}%`,
                  top: `${cropRect.y * 100}%`,
                  width: `${cropRect.w * 100}%`,
                  height: `${cropRect.h * 100}%`,
                }}
              >
                {/* 吸着中インジケーター */}
                {activeAction !== 'none' && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded bg-cyan-950/95 border border-cyan-400 px-2 py-0.5 text-[10px] font-bold text-cyan-200 shadow-xl pointer-events-none whitespace-nowrap z-30">
                    <Magnet className="h-3 w-3 text-cyan-400 animate-pulse" />
                    <span>罫線ピークに強力吸着中</span>
                  </div>
                )}

                {/* 中央移動ヒント */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition pointer-events-none">
                  <span className="flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[10px] font-medium text-white shadow">
                    <Move className="h-3 w-3" />
                    ドラッグで移動
                  </span>
                </div>

                {/* 4辺 (Edges) のリサイズバー */}
                <div
                  onPointerDown={(e) => startDrag(e, 'n')}
                  className="absolute -top-1.5 left-2 right-2 h-3 cursor-ns-resize"
                />
                <div
                  onPointerDown={(e) => startDrag(e, 's')}
                  className="absolute -bottom-1.5 left-2 right-2 h-3 cursor-ns-resize"
                />
                <div
                  onPointerDown={(e) => startDrag(e, 'w')}
                  className="absolute -left-1.5 top-2 bottom-2 w-3 cursor-ew-resize"
                />
                <div
                  onPointerDown={(e) => startDrag(e, 'e')}
                  className="absolute -right-1.5 top-2 bottom-2 w-3 cursor-ew-resize"
                />

                {/* 4隅 (Corners) のリサイズハンドル (広いヒットエリア 28px) */}
                <div
                  onPointerDown={(e) => startDrag(e, 'nw')}
                  className="group absolute -left-3.5 -top-3.5 flex h-7 w-7 items-center justify-center cursor-nwse-resize"
                >
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-400 bg-white shadow-md transition group-hover:scale-125" />
                </div>
                <div
                  onPointerDown={(e) => startDrag(e, 'ne')}
                  className="group absolute -right-3.5 -top-3.5 flex h-7 w-7 items-center justify-center cursor-nesw-resize"
                >
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-400 bg-white shadow-md transition group-hover:scale-125" />
                </div>
                <div
                  onPointerDown={(e) => startDrag(e, 'sw')}
                  className="group absolute -left-3.5 -bottom-3.5 flex h-7 w-7 items-center justify-center cursor-nesw-resize"
                >
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-400 bg-white shadow-md transition group-hover:scale-125" />
                </div>
                <div
                  onPointerDown={(e) => startDrag(e, 'se')}
                  className="group absolute -right-3.5 -bottom-3.5 flex h-7 w-7 items-center justify-center cursor-nwse-resize"
                >
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-400 bg-white shadow-md transition group-hover:scale-125" />
                </div>

                {/* 上下左右の中央ハンドル (Middle Handles) */}
                <div
                  onPointerDown={(e) => startDrag(e, 'n')}
                  className="group absolute -top-2 left-1/2 -translate-x-1/2 flex h-5 w-6 items-center justify-center cursor-ns-resize"
                >
                  <div className="h-1.5 w-4 rounded-full border border-cyan-400 bg-white shadow-sm transition group-hover:scale-125" />
                </div>
                <div
                  onPointerDown={(e) => startDrag(e, 's')}
                  className="group absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-5 w-6 items-center justify-center cursor-ns-resize"
                >
                  <div className="h-1.5 w-4 rounded-full border border-cyan-400 bg-white shadow-sm transition group-hover:scale-125" />
                </div>
                <div
                  onPointerDown={(e) => startDrag(e, 'w')}
                  className="group absolute -left-2 top-1/2 -translate-y-1/2 flex h-6 w-5 items-center justify-center cursor-ew-resize"
                >
                  <div className="h-4 w-1.5 rounded-full border border-cyan-400 bg-white shadow-sm transition group-hover:scale-125" />
                </div>
                <div
                  onPointerDown={(e) => startDrag(e, 'e')}
                  className="group absolute -right-2 top-1/2 -translate-y-1/2 flex h-6 w-5 items-center justify-center cursor-ew-resize"
                >
                  <div className="h-4 w-1.5 rounded-full border border-cyan-400 bg-white shadow-sm transition group-hover:scale-125" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* フッターアクションバー */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => onCropComplete(imageFile, 800, 800)}
          className="text-xs text-slate-400 transition hover:text-white"
        >
          クロップをスキップ（全体解析）
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-800 px-3.5 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={handleExecuteCrop}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 transition hover:opacity-95"
          >
            <Check className="h-3.5 w-3.5" />
            <span>選択した表部分を解析</span>
          </button>
        </div>
      </div>
    </div>
  );
}
