/**
 * 召唤师战争 - Buff 状态图标 SVG 组件
 * 
 * 独立文件，避免与 buffSystem.tsx 和 BuffIcons.tsx 的循环依赖
 */

import React from 'react';

export const HealingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

export const SparkleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.8 5.6 21.2 8 14l-6-4.8h7.6z"/>
    <circle cx="12" cy="12" r="2" opacity="0.8"/>
  </svg>
);

export const SwordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M20 2L4 8l6 2 2 6 8-14zm-8 10l-2-6 10-4-8 10z"/>
  </svg>
);

export const TargetIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

export const FlameIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2c-1.5 4-4 6-7 7 0 2.76 2.24 5 5 5 .71 0 1.39-.15 2-.42.61.27 1.29.42 2 .42 2.76 0 5-2.24 5-5-3-1-5.5-3-7-7z"/>
    <path d="M12 9c-.55 1.5-1.5 2.5-3 3 0 1.38 1.12 2.5 2.5 2.5.35 0 .69-.08 1-.21.31.13.65.21 1 .21 1.38 0 2.5-1.12 2.5-2.5-1.5-.5-2.45-1.5-3-3z" opacity="0.7"/>
  </svg>
);
