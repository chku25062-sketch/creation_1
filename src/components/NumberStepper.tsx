'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  inputWidth?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 5,
  unit,
  className = '',
  inputWidth = 'w-14 sm:w-16',
  size = 'md',
  ariaLabel,
}: NumberStepperProps) {
  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(Math.min(max, value + step));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    } else {
      onChange(min);
    }
  };

  const btnSize = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm';
  const inputSize = size === 'sm' ? 'h-7 text-xs py-0.5' : 'h-8 text-xs py-1';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        aria-label={`${ariaLabel || ''} 減らす`}
        className={`${btnSize} shrink-0 rounded-lg border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs hover:bg-slate-50 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer`}
      >
        <Minus className={iconSize} />
      </button>

      <div className="relative flex items-center">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleInputChange}
          aria-label={ariaLabel}
          className={`${inputWidth} ${inputSize} rounded-lg border border-slate-300 bg-white font-mono font-bold text-center text-blue-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-hidden`}
        />
      </div>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        aria-label={`${ariaLabel || ''} 増やす`}
        className={`${btnSize} shrink-0 rounded-lg border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-700 active:scale-95 shadow-2xs hover:bg-slate-50 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer`}
      >
        <Plus className={iconSize} />
      </button>

      {unit && (
        <span className="text-xs text-slate-500 font-medium ml-0.5 select-none shrink-0">
          {unit}
        </span>
      )}
    </div>
  );
}
