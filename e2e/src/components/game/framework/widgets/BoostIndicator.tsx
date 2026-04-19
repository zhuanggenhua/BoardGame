/**
 * 通用动态增益指示器 - 跨游戏复用
 * 
 * 在卡牌/单位角落显示动态增益图标（战力加成、移动增强等）。
 * 
 * 设计原则：
 * 1. 游戏无关 - 不依赖任何特定游戏的类型或逻辑
 * 2. 配置驱动 - 游戏层传入增益条目，框架层只负责渲染
 * 3. 可扩展 - 支持任意类型的增益图标
 * 
 * 用法：
 * ```tsx
 * <BoostIndicator
 *   boosts={[
 *     { type: 'strength', count: 2, icon: Swords, color: 'text-red-500', glow: 'rgba(239,68,68,0.9)' },
 *     { type: 'move', count: 1, icon: Feather, color: 'text-cyan-400', glow: 'rgba(34,211,238,0.9)' },
 *   ]}
 *   position="bottom-right"
 *   bottomOffset={17} // 跳过附加卡名条等
 * />
 * ```
 */

import React from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/** 单个增益条目 */
export interface BoostEntry {
  /** 增益类型标识（用于 key） */
  type: string;
  /** 增益数量（显示几个图标） */
  count: number;
  /** lucide-react 或自定义 SVG 图标组件 */
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  /** 图标颜色（Tailwind 类名，如 'text-red-500'） */
  color: string;
  /** 发光颜色（RGBA 字符串） */
  glow: string;
  /** 可选：鼠标悬停时显示的来源说明（多行用 \n 分隔） */
  tooltip?: string;
}

/** 指示器位置 */
export type BoostPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface BoostIndicatorProps {
  /** 增益条目列表，按显示优先级排序（索引越大越靠右） */
  boosts: BoostEntry[];
  /** 显示位置，默认 'bottom-right' */
  position?: BoostPosition;
  /** 底部偏移百分比（用于避开附加卡名条等），默认 3 */
  bottomOffset?: number;
  /** 图标尺寸，默认 '1vw' */
  iconSize?: string;
  /** z-index，默认 10 */
  zIndex?: number;
}

// ============================================================================
// 位置映射
// ============================================================================

const POSITION_CLASSES: Record<BoostPosition, string> = {
  'bottom-right': 'right-[3%] flex-row-reverse items-end',
  'bottom-left': 'left-[3%] flex-row items-end',
  'top-right': 'right-[3%] flex-row-reverse items-start',
  'top-left': 'left-[3%] flex-row items-start',
};

const VERTICAL_PROP: Record<BoostPosition, 'bottom' | 'top'> = {
  'bottom-right': 'bottom',
  'bottom-left': 'bottom',
  'top-right': 'top',
  'top-left': 'top',
};

// ============================================================================
// 组件
// ============================================================================

export const BoostIndicator: React.FC<BoostIndicatorProps> = ({
  boosts,
  position = 'bottom-right',
  bottomOffset = 3,
  iconSize = '1vw',
  zIndex = 10,
}) => {
  const activeBoosts = boosts.filter(b => b.count > 0);
  if (activeBoosts.length === 0) return null;

  const posClass = POSITION_CLASSES[position];
  const verticalProp = VERTICAL_PROP[position];

  return (
    <div
      className={`absolute ${posClass} flex gap-[0.2vw] overflow-visible`}
      style={{ zIndex, [verticalProp]: `${bottomOffset}%` }}
    >
      {activeBoosts.map(boost => {
        const icons = Array.from({ length: boost.count }, (_, i) => {
          const Icon = boost.icon;
          return (
            <Icon
              key={`${boost.type}-${i}`}
              className={`${boost.color} drop-shadow-[0_0_2px_${boost.glow}] overflow-visible`}
              style={{ width: iconSize, height: iconSize, overflow: 'visible' }}
              strokeWidth={2.5}
            />
          );
        });

        // 如果有 tooltip，包装在可交互容器中
        if (boost.tooltip) {
          return (
            <div
              key={boost.type}
              className="relative group pointer-events-auto cursor-help flex gap-[0.2vw] overflow-visible"
              title={boost.tooltip}
            >
              {icons}
              {/* 悬停提示框 */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-[0.7vw] rounded whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 min-w-max">
                {boost.tooltip}
              </div>
            </div>
          );
        }

        // 无 tooltip 时保持原有行为（pointer-events-none）
        return (
          <div key={boost.type} className="flex gap-[0.2vw] pointer-events-none overflow-visible">
            {icons}
          </div>
        );
      })}
    </div>
  );
};
