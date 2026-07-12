import type { GridConfig } from '../../../core/ui/board-layout.types';
import { cellToNormalizedBounds } from '../../../core/ui/board-hit-test';

/** 计算格子位置（百分比） */
export function getCellPosition(row: number, col: number, grid: GridConfig) {
  const cellBounds = cellToNormalizedBounds({ row, col }, grid);
  return {
    left: cellBounds.x * 100,
    top: cellBounds.y * 100,
    width: cellBounds.width * 100,
    height: cellBounds.height * 100,
  };
}
