/**
 * 棋盘命中检测工具
 * 像素坐标 → 格子/区域/轨道映射，支持滚动偏移
 */

import type {
  BoardLayoutConfig,
  GridConfig,
  CellCoord,
  HitTestResult,
  NormalizedPoint,
} from './board-layout.types';
import { getGridBounds } from './board-layout.types';

export interface HitTestOptions {
  /** 容器宽度（像素） */
  containerWidth: number;
  /** 容器高度（像素） */
  containerHeight: number;
  /** 滚动偏移 X（像素） */
  scrollX?: number;
  /** 滚动偏移 Y（像素） */
  scrollY?: number;
  /** 轨道点命中半径（归一化，默认 0.02） */
  trackPointRadius?: number;
  /** 堆叠点命中半径（归一化，默认 0.05） */
  stackPointRadius?: number;
}

/**
 * 像素坐标转归一化坐标（考虑滚动偏移）
 */
export function pixelToNormalizedWithScroll(
  pixelX: number,
  pixelY: number,
  options: HitTestOptions
): NormalizedPoint {
  const { containerWidth, containerHeight, scrollX = 0, scrollY = 0 } = options;
  return {
    x: (pixelX + scrollX) / containerWidth,
    y: (pixelY + scrollY) / containerHeight,
  };
}

/**
 * 检测点击位置命中的格子
 */
export function hitTestCell(
  point: NormalizedPoint,
  grid: GridConfig
): CellCoord | null {
  const { rows, cols, gapX = 0, gapY = 0 } = grid;
  const bounds = getGridBounds(grid);

  // 检查是否在网格区域内
  if (
    point.x < bounds.x ||
    point.x > bounds.x + bounds.width ||
    point.y < bounds.y ||
    point.y > bounds.y + bounds.height
  ) {
    return null;
  }

  // 计算相对于网格区域的归一化坐标
  const relX = (point.x - bounds.x) / bounds.width;
  const relY = (point.y - bounds.y) / bounds.height;

  // 计算单格尺寸比例（考虑间距）
  const cellWidthRatio = (1 - gapX * (cols - 1)) / cols;
  const cellHeightRatio = (1 - gapY * (rows - 1)) / rows;
  const stepX = cellWidthRatio + gapX;
  const stepY = cellHeightRatio + gapY;

  // 计算可能的格子索引
  const col = Math.floor(relX / stepX);
  const row = Math.floor(relY / stepY);

  // 检查是否在有效范围内
  if (col < 0 || col >= cols || row < 0 || row >= rows) {
    return null;
  }

  // 检查是否在格子内（而不是间距内）
  const cellStartX = col * stepX;
  const cellStartY = row * stepY;
  const cellEndX = cellStartX + cellWidthRatio;
  const cellEndY = cellStartY + cellHeightRatio;

  if (relX >= cellStartX && relX <= cellEndX && relY >= cellStartY && relY <= cellEndY) {
    return { row, col };
  }

  return null; // 点击在间距区域
}

/**
 * 检测点击位置命中的区域
 */
export function hitTestZones(
  point: NormalizedPoint,
  config: BoardLayoutConfig
): string[] {
  const hitZoneIds: string[] = [];

  for (const zone of config.zones) {
    const { bounds } = zone;
    if (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    ) {
      hitZoneIds.push(zone.id);
    }
  }

  return hitZoneIds;
}

/**
 * 检测点击位置命中的轨道点
 */
export function hitTestTrackPoint(
  point: NormalizedPoint,
  config: BoardLayoutConfig,
  radius: number = 0.02
): { trackId: string; pointIndex: number } | null {
  for (const track of config.tracks) {
    for (let i = 0; i < track.points.length; i++) {
      const tp = track.points[i];
      const dx = point.x - tp.x;
      const dy = point.y - tp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        return { trackId: track.id, pointIndex: i };
      }
    }
  }
  return null;
}

/**
 * 检测点击位置命中的堆叠点
 */
export function hitTestStackPoint(
  point: NormalizedPoint,
  config: BoardLayoutConfig,
  radius: number = 0.05
): string | null {
  for (const sp of config.stackPoints) {
    const dx = point.x - sp.position.x;
    const dy = point.y - sp.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= radius) {
      return sp.id;
    }
  }
  return null;
}

/**
 * 完整命中检测
 */
export function hitTest(
  pixelX: number,
  pixelY: number,
  config: BoardLayoutConfig,
  options: HitTestOptions
): HitTestResult {
  const point = pixelToNormalizedWithScroll(pixelX, pixelY, options);
  const { trackPointRadius = 0.02, stackPointRadius = 0.05 } = options;

  const result: HitTestResult = {
    zoneIds: [],
  };

  // 检测格子
  if (config.grid) {
    const cell = hitTestCell(point, config.grid);
    if (cell) {
      result.cell = cell;
    }
  }

  // 检测区域
  result.zoneIds = hitTestZones(point, config);

  // 检测轨道点
  const trackPoint = hitTestTrackPoint(point, config, trackPointRadius);
  if (trackPoint) {
    result.trackPoint = trackPoint;
  }

  // 检测堆叠点
  const stackPointId = hitTestStackPoint(point, config, stackPointRadius);
  if (stackPointId) {
    result.stackPointId = stackPointId;
  }

  return result;
}

/**
 * 格子坐标转归一化中心点（用于放置元素）
 */
export function cellToNormalizedCenter(
  cell: CellCoord,
  grid: GridConfig
): NormalizedPoint {
  const { rows, cols, gapX = 0, gapY = 0 } = grid;
  const bounds = getGridBounds(grid);

  const cellWidthRatio = (1 - gapX * (cols - 1)) / cols;
  const cellHeightRatio = (1 - gapY * (rows - 1)) / rows;
  const stepX = cellWidthRatio + gapX;
  const stepY = cellHeightRatio + gapY;

  const cellCenterX = bounds.x + bounds.width * (cell.col * stepX + cellWidthRatio / 2);
  const cellCenterY = bounds.y + bounds.height * (cell.row * stepY + cellHeightRatio / 2);

  return { x: cellCenterX, y: cellCenterY };
}

/**
 * 格子坐标转归一化边界（用于渲染元素）
 */
export function cellToNormalizedBounds(
  cell: CellCoord,
  grid: GridConfig
): { x: number; y: number; width: number; height: number } {
  const { rows, cols, gapX = 0, gapY = 0 } = grid;
  const bounds = getGridBounds(grid);

  const cellWidthRatio = (1 - gapX * (cols - 1)) / cols;
  const cellHeightRatio = (1 - gapY * (rows - 1)) / rows;
  const stepX = cellWidthRatio + gapX;
  const stepY = cellHeightRatio + gapY;

  return {
    x: bounds.x + bounds.width * (cell.col * stepX),
    y: bounds.y + bounds.height * (cell.row * stepY),
    width: bounds.width * cellWidthRatio,
    height: bounds.height * cellHeightRatio,
  };
}
