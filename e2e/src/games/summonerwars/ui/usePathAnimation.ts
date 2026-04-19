/**
 * 召唤师战争 - 路径动画 Hook
 * 
 * 用于单位沿路径移动的动画（支持践踏等技能）
 */

import { useEffect, useRef } from 'react';
import type { CellCoord } from '../domain/types';
import type { GridConfig } from '../../../core/ui/board-layout.types';
import { cellToNormalizedBounds } from '../../../core/ui/board-hit-test';

interface PathAnimationOptions {
  /** 单位当前位置（游戏坐标） */
  currentPosition: CellCoord;
  /** 单位实例 ID */
  unitId: string;
  /** 网格配置 */
  grid: GridConfig;
  /** 视角翻转函数 */
  toViewCoord: (coord: CellCoord) => CellCoord;
  /** 是否正在攻击动画中 */
  isAttacking: boolean;
}

/**
 * 追踪单位的移动路径并返回是否需要路径动画
 * 
 * 策略：
 * - 短距离（≤2格）：使用 layout 动画（快速）
 * - 长距离（≥3格）：检查是否有路径信息，有则使用路径动画
 */
export function usePathAnimation(options: PathAnimationOptions) {
  const { currentPosition, unitId } = options;
  const prevPositionRef = useRef<CellCoord>(currentPosition);
  const prevUnitIdRef = useRef<string>(unitId);

  if (prevUnitIdRef.current !== unitId) {
    prevPositionRef.current = currentPosition;
    prevUnitIdRef.current = unitId;
  }

  const prevPosition = prevPositionRef.current;

  useEffect(() => {
    prevPositionRef.current = currentPosition;
    prevUnitIdRef.current = unitId;
  }, [currentPosition, unitId]);
  
  // 当前版本：始终使用 layout 动画
  // 未来可以在这里添加路径动画逻辑
  return {
    needsPathAnimation: false,
    prevPosition,
  };
}

/**
 * 计算格子的屏幕位置（百分比）
 */
export function getCellScreenPosition(
  coord: CellCoord,
  grid: GridConfig,
): { left: number; top: number } {
  const bounds = cellToNormalizedBounds(coord, grid);
  return {
    left: bounds.x * 100,
    top: bounds.y * 100,
  };
}
