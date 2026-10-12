'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, Check, RefreshCw, Maximize2, Move, MousePointerClick } from 'lucide-react';

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

  const [activeAction, setActiveAction] = useState<DragAction>('none');
  const [isDrawModeActive, setIsDrawModeActive] = useState<boolean>(false);

  const imgWrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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

        const left = Math.min(startRatioX, curRatioX);
        const top = Math.min(startRatioY, curRatioY);
        const width = Math.abs(curRatioX - startRatioX);
        const height = Math.abs(curRatioY - startRatioY);

        setCropRect({ x: left, y: top, w: width, h: height });
        return;
      }

      if (action === 'move') {
        let newX = initialRect.x + dxRatio;
        let newY = initialRect.y + dyRatio;
        newX = Math.max(0, Math.min(1 - initialRect.w, newX));
        newY = Math.max(0, Math.min(1 - initialRect.h, newY));
        setCropRect({ x: newX, y: newY, w: initialRect.w, h: initialRect.h });
        return;
      }

      // リサイズ処理 (8方向)
      let { x, y, w, h } = initialRect;

      if (action.includes('e')) {
        const nextW = Math.max(minSize, Math.min(1 - initialRect.x, initialRect.w + dxRatio));
        w = nextW;
      }
      if (action.includes('w')) {
        const nextX = Math.max(
          0,
          Math.min(initialRect.x + initialRect.w - minSize, initialRect.x + dxRatio),
        );
        w = initialRect.w - (nextX - initialRect.x);
        x = nextX;
      }
      if (action.includes('s')) {
        const nextH = Math.max(minSize, Math.min(1 - initialRect.y, initialRect.h + dyRatio));
        h = nextH;
      }
      if (action.includes('n')) {
        const nextY = Math.max(
          0,
          Math.min(initialRect.y + initialRect.h - minSize, initialRect.y + dyRatio),
        );
        h = initialRect.h - (nextY - initialRect.y);
        y = nextY;
      }

      setCropRect({ x, y, w, h });
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
  }, []);

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
    const cropW = Math.round(rect.w * natW);
    const cropH = Math.round(rect.h * natH);

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      onCropComplete(imageFile, natW, natH);
      return;
    }

    // クロップ部分の描画
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // コントラスト伸長 (文字の輪郭強調)
    try {
      const imgData = ctx.getImageData(0, 0, cropW, cropH);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const brightness = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const val = brightness > 140 ? 255 : brightness < 90 ? 0 : brightness;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('Canvas filter skipped', e);
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob, cropW, cropH);
        } else {
          onCropComplete(imageFile, cropW, cropH);
        }
      },
      'image/png',
      1.0,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ツールバー / ガイド */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-1.5 font-medium text-cyan-300">
          <Crop className="h-4 w-4 shrink-0 text-cyan-400" />
          <span>
            {isDrawModeActive
              ? 'ドラッグして、予定・講義のマス目（本体のみ）を囲んでください'
              : '※ 曜日や時限番号の見出しは含めず、予定が入っているマス目（本体）のみを囲むと高精度に認識されます'}
          </span>
        </div>

        {/* 枠操作ボタン群 */}
        <div className="flex items-center gap-1.5">
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
      <div className="flex max-h-[52vh] min-h-[260px] w-full select-none items-center justify-center overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
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
