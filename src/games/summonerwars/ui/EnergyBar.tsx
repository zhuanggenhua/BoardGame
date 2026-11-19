/**
 * 召唤师战争 - 能量条组件
 * 保持图标、分段和数值在移动端按比例缩放。
 */

import React from 'react';

type EnergyBarSize = 'normal' | 'compact';

interface EnergyBarSizing {
  rootGap: string;
  iconSize: string;
  segmentGap: string;
  segmentWidth: string;
  segmentHeight: string;
  textSize: string;
  valueWidth: string;
}

const ENERGY_BAR_SIZES: Record<EnergyBarSize, EnergyBarSizing> = {
  normal: {
    rootGap: 'clamp(6.4px, calc(var(--sw-energy-design-inline-unit, 1vw) * 0.8), 8.8px)',
    iconSize: 'clamp(16px, calc(var(--sw-energy-design-inline-unit, 1vw) * 2), 20px)',
    segmentGap: 'clamp(1px, calc(var(--sw-energy-design-inline-unit, 1vw) * 0.18), 2px)',
    segmentWidth: 'clamp(6.08px, calc(var(--sw-energy-design-inline-unit, 1vw) * 0.78), 12px)',
    segmentHeight: 'clamp(9.28px, var(--sw-energy-design-inline-unit, 1vw), 16px)',
    textSize: 'clamp(13.12px, calc(var(--sw-energy-design-inline-unit, 1vw) * 1.2), 16px)',
    valueWidth: 'clamp(21.6px, calc(var(--sw-energy-design-inline-unit, 1vw) * 2), 28px)',
  },
  compact: {
    rootGap: 'clamp(0.3rem, 0.65vw, 0.45rem)',
    iconSize: 'clamp(0.9rem, 1.7vw, 1.05rem)',
    segmentGap: 'clamp(1px, 0.16vw, 2px)',
    segmentWidth: 'clamp(0.3rem, 0.6vw, 0.56rem)',
    segmentHeight: 'clamp(0.48rem, 0.82vw, 0.76rem)',
    textSize: 'clamp(0.75rem, 1vw, 0.92rem)',
    valueWidth: 'clamp(1.15rem, 1.6vw, 1.45rem)',
  },
};

export interface EnergyBarProps {
  current: number;
  max?: number;
  isOpponent?: boolean;
  testId?: string;
  className?: string;
  size?: EnergyBarSize;
}

export const EnergyBar: React.FC<EnergyBarProps> = ({
  current,
  max = 15,
  testId,
  className = '',
  size = 'normal',
}) => {
  const total = Math.max(0, max);
  const sizing = ENERGY_BAR_SIZES[size];

  return (
    <div
      className={`flex items-center ${className}`}
      data-testid={testId}
      style={{ gap: sizing.rootGap }}
    >
      <svg
        className="shrink-0 text-purple-400"
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ width: sizing.iconSize, height: sizing.iconSize }}
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>

      <div className="flex" style={{ gap: sizing.segmentGap }}>
        {Array.from({ length: total + 1 }, (_, value) => {
          const isActive = value <= current;
          const isCurrent = value === current;
          return (
            <div
              key={value}
              className={`rounded-sm transition-all ${isCurrent
                ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                : isActive
                  ? 'bg-amber-500'
                  : 'bg-slate-700/60'
              }`}
              style={{
                width: sizing.segmentWidth,
                height: sizing.segmentHeight,
              }}
            />
          );
        })}
      </div>

      <span
        className="font-bold text-white"
        style={{
          fontSize: sizing.textSize,
          minWidth: sizing.valueWidth,
        }}
      >
        {current}
      </span>
    </div>
  );
};

export default EnergyBar;
