'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Crop, Check, RefreshCw } from 'lucide-react';

interface ImageCropperProps {
  imageFile: File;
  onCropComplete: (croppedBlob: Blob, width: number, height: number) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageFile, onCropComplete, onCancel }: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // デフォルトで画像中央80%を初期選択
  const handleImageLoad = () => {
    if (!imgRef.current) return;
    const { clientWidth, clientHeight } = imgRef.current;
    const w = clientWidth * 0.85;
    const h = clientHeight * 0.85;
    const x = (clientWidth - w) / 2;
    const y = (clientHeight - h) / 2;
    setCropRect({ x, y, w, h });
  };

  const getRelativeCoords = (e: React.MouseEvent) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const coords = getRelativeCoords(e);
    setDragStart(coords);
    setIsDragging(true);
    setCropRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !imgRef.current) return;
    const current = getRelativeCoords(e);
    const x = Math.min(dragStart.x, current.x);
    const y = Math.min(dragStart.y, current.y);
    const w = Math.abs(current.x - dragStart.x);
    const h = Math.abs(current.y - dragStart.y);
    setCropRect({ x, y, w, h });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleExecuteCrop = () => {
    if (!imgRef.current || !cropRect || cropRect.w < 20 || cropRect.h < 20) {
      // 選択が小さすぎる場合は元画像全体を使用
      onCropComplete(imageFile, 800, 800);
      return;
    }

    const img = imgRef.current;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const naturalX = cropRect.x * scaleX;
    const naturalY = cropRect.y * scaleY;
    const naturalW = cropRect.w * scaleX;
    const naturalH = cropRect.h * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = naturalW;
    canvas.height = naturalH;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      onCropComplete(imageFile, img.naturalWidth, img.naturalHeight);
      return;
    }

    // クロップ描画
    ctx.drawImage(img, naturalX, naturalY, naturalW, naturalH, 0, 0, naturalW, naturalH);

    // 簡易コントラスト強調・白黒2値化処理
    try {
      const imgData = ctx.getImageData(0, 0, naturalW, naturalH);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        // グレースケール輝度
        const brightness = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // コントラスト伸長 (文字をクッキリさせる)
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
          onCropComplete(blob, naturalW, naturalH);
        } else {
          onCropComplete(imageFile, naturalW, naturalH);
        }
      },
      'image/png',
      1.0,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-1.5 font-medium text-cyan-300">
          <Crop className="h-4 w-4" />
          <span>時間割の「表部分」をドラッグして囲んでください</span>
        </div>
        <button
          onClick={handleImageLoad}
          className="flex items-center gap-1 text-slate-400 hover:text-white"
        >
          <RefreshCw className="h-3 w-3" />
          <span>選択枠リセット</span>
        </button>
      </div>

      {/* Crop Area Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="relative max-h-[50vh] overflow-hidden select-none flex justify-center items-center rounded-xl border border-slate-800 bg-slate-950 cursor-crosshair"
      >
        {imageSrc && (
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Upload Preview"
            onLoad={handleImageLoad}
            className="max-h-[50vh] w-auto object-contain pointer-events-none"
          />
        )}

        {/* Crop Overlay */}
        {cropRect && imgRef.current && (
          <>
            {/* 暗転オーバーレイ */}
            <div
              className="absolute inset-0 bg-black/55 pointer-events-none"
              style={{
                clipPath: `polygon(
                  0% 0%, 0% 100%, 100% 100%, 100% 0%,
                  0% 0%,
                  ${cropRect.x}px ${cropRect.y}px,
                  ${cropRect.x + cropRect.w}px ${cropRect.y}px,
                  ${cropRect.x + cropRect.w}px ${cropRect.y + cropRect.h}px,
                  ${cropRect.x}px ${cropRect.y + cropRect.h}px,
                  ${cropRect.x}px ${cropRect.y}px
                )`,
              }}
            />
            {/* 選択枠 */}
            <div
              className="absolute border-2 border-cyan-400 shadow-lg pointer-events-none"
              style={{
                left: `${cropRect.x}px`,
                top: `${cropRect.y}px`,
                width: `${cropRect.w}px`,
                height: `${cropRect.h}px`,
                backgroundColor: 'rgba(6, 182, 212, 0.08)',
              }}
            >
              <div className="absolute top-1 left-1 rounded bg-cyan-500 px-1 py-0.5 text-[9px] font-bold text-black">
                解析対象領域
              </div>
            </div>
          </>
        )}
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <button
          onClick={() => onCropComplete(imageFile, 800, 800)}
          className="text-xs text-slate-400 hover:text-white"
        >
          トリミングせず全体を解析
        </button>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            戻る
          </button>
          <button
            onClick={handleExecuteCrop}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:opacity-90"
          >
            <Check className="h-3.5 w-3.5" />
            <span>選択した表部分を解析</span>
          </button>
        </div>
      </div>
    </div>
  );
}
