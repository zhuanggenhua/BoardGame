/**
 * 召唤师战争 - 移动路径轨迹效果
 * 
 * 在单位移动时显示路径轨迹，让玩家看到单位经过了哪些格子
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CellCoord } from '../domain/types';
import type { GridConfig } from '../../../core/ui/board-layout.types';
import { getCellPosition } from './BoardGrid';

interface PathTrailEffectProps {
  /** 移动路径（游戏坐标） */
  path: CellCoord[];
  /** 网格配置 */
  grid: GridConfig;
  /** 视角翻转函数 */
  toViewCoord: (coord: CellCoord) => CellCoord;
  /** 动画完成回调 */
  onComplete: () => void;
}

/**
 * 路径轨迹效果
 * 
 * 显示单位移动路径上的淡出光晕，让玩家看到移动轨迹
 */
export const PathTrailEffect: React.FC<PathTrailEffectProps> = ({
  path,
  grid,
  toViewCoord,
  onComplete,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // 动画持续时间：路径长度 * 150ms
    const duration = path.length * 150;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 300); // 等待淡出动画完成
    }, duration);

    return () => clearTimeout(timer);
  }, [path.length, onComplete]);

  if (!visible || path.length <= 2) return null; // 短距离移动不显示轨迹

  // 跳过起点和终点，只显示中间格子的轨迹
  const trailCells = path.slice(1, -1);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      <AnimatePresence>
        {trailCells.map((cell, index) => {
          const viewCoord = toViewCoord(cell);
          const pos = getCellPosition(viewCoord.row, viewCoord.col, grid);
          
          return (
            <motion.div
              key={`trail-${cell.row}-${cell.col}-${index}`}
              className="absolute rounded-lg"
              style={{
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                width: `${pos.width}%`,
                height: `${pos.height}%`,
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 70%)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 1, 0.5, 0], scale: [0.8, 1.1, 1, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.8,
                delay: index * 0.15, // 依次显示
                ease: 'easeOut',
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};
