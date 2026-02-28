/**
 * 召唤师战争 - 能量条组件
 * 分段显示能量值（0-15），更清晰的视觉效果
 * 玩家和对手使用相同颜色
 */

import React from 'react';

export interface EnergyBarProps {
  /** 当前能量 */
  current: number;
  /** 最大能量 */
  max?: number;
  /** 是否为对手（保留参数但不影响颜色） */
  isOpponent?: boolean;
  /** 测试标识 */
  testId?: string;
  /** 额外类名 */
  className?: string;
}

/** 能量条组件 */
export const EnergyBar: React.FC<EnergyBarProps> = ({
  current,
  max = 15,
  testId,
  className = '',
}) => {
  const total = Math.max(0, max);

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid={testId}>
      {/* 魔力图标 */}
      <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
      </svg>
      
      {/* 分段条 - 统一使用琥珀色 */}
      <div className="flex gap-[2px]">
        {Array.from({ length: total + 1 }, (_, value) => {
          const isActive = value <= current;
          const isCurrent = value === current;
          return (
            <div
              key={value}
              className={`
                w-3 h-4 rounded-sm transition-all
                ${isCurrent
                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                  : isActive
                    ? 'bg-amber-500'
                    : 'bg-slate-700/60'
                }
              `}
            />
          );
        })}
      </div>
      
      {/* 数值 */}
      <span className="text-sm text-white font-bold ml-1 min-w-[1.5rem]">
        {current}
      </span>
    </div>
  );
};

export default EnergyBar;
