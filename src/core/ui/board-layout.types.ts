/**
 * 通用棋盘布局标注系统 - 类型契约
 * 坐标均为归一化值（0-1），渲染时乘以容器实际尺寸
 */

/** 归一化坐标点（0-1） */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/** 归一化矩形区域（0-1） */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 网格配置 */
export interface GridConfig {
  /** 行数 */
  rows: number;
  /** 列数 */
  cols: number;
  /** 网格区域（归一化） */
  bounds: NormalizedRect;
  /** 水平间距（归一化，相对于单格宽度的比例） */
  gapX?: number;
  /** 垂直间距（归一化，相对于单格高度的比例） */
  gapY?: number;
  /** X轴偏移（归一化） */
  offsetX?: number;
  /** Y轴偏移（归一化） */
  offsetY?: number;
}

/** 区域类型 */
export type ZoneType = 
  | 'draw_pile'      // 抽牌堆
  | 'discard_pile'   // 弃牌堆
  | 'hand_area'      // 手牌区
  | 'summon_area'    // 召唤区
  | 'magic_pool'     // 魔力池
  | 'custom';        // 自定义

/** 区域配置 */
export interface ZoneConfig {
  /** 唯一标识 */
  id: string;
  /** 区域类型 */
  type: ZoneType;
  /** 显示名称 */
  label?: string;
  /** 区域边界（归一化） */
  bounds: NormalizedRect;
  /** 所属玩家（可选） */
  playerId?: string;
}

/** 轨道配置（如魔力轨道） */
export interface TrackConfig {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  label?: string;
  /** 轨道点位列表（归一化坐标） */
  points: NormalizedPoint[];
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 所属玩家（可选） */
  playerId?: string;
}

/** 堆叠方向 */
export type StackDirection = 'up' | 'down' | 'left' | 'right';

/** 堆叠点配置 */
export interface StackPointConfig {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  label?: string;
  /** 位置（归一化） */
  position: NormalizedPoint;
  /** 单张卡牌尺寸（归一化） */
  cardSize?: { width: number; height: number };
  /** 堆叠方向 */
  direction?: StackDirection;
  /** 堆叠偏移量（归一化） */
  stackOffset?: number;
  /** 所属玩家（可选） */
  playerId?: string;
}

/** 完整布局配置 */
export interface BoardLayoutConfig {
  /** 配置版本 */
  version: string;
  /** 背景图片路径 */
  backgroundImage?: string;
  /** 原始图片尺寸（用于坐标换算参考） */
  imageSize?: { width: number; height: number };
  /** 网格配置 */
  grid?: GridConfig;
  /** 区域列表 */
  zones: ZoneConfig[];
  /** 轨道列表 */
  tracks: TrackConfig[];
  /** 堆叠点列表 */
  stackPoints: StackPointConfig[];
}

/** 格子坐标 */
export interface CellCoord {
  row: number;
  col: number;
}

/** 命中检测结果 */
export interface HitTestResult {
  /** 命中的格子（如果有网格） */
  cell?: CellCoord;
  /** 命中的区域 ID 列表 */
  zoneIds: string[];
  /** 命中的轨道点 { trackId, pointIndex } */
  trackPoint?: { trackId: string; pointIndex: number };
  /** 命中的堆叠点 ID */
  stackPointId?: string;
}

/** 布局编辑器状态 */
export interface LayoutEditorState {
  /** 当前配置 */
  config: BoardLayoutConfig;
  /** 选中的元素类型 */
  selectedType?: 'grid' | 'zone' | 'track' | 'stackPoint';
  /** 选中的元素 ID */
  selectedId?: string;
  /** 是否处于编辑模式 */
  isEditing: boolean;
  /** 当前编辑工具 */
  activeTool?: 'select' | 'grid' | 'zone' | 'track' | 'stackPoint';
}

/** 创建默认布局配置 */
export function createDefaultLayoutConfig(): BoardLayoutConfig {
  return {
    version: '1.0.0',
    zones: [],
    tracks: [],
    stackPoints: [],
  };
}

/** 计算考虑偏移后的网格区域 */
export function getGridBounds(grid: GridConfig): NormalizedRect {
  const { bounds, offsetX = 0, offsetY = 0 } = grid;
  return {
    x: bounds.x + offsetX,
    y: bounds.y + offsetY,
    width: bounds.width,
    height: bounds.height,
  };
}

/** 计算格子在容器中的像素位置 */
export function cellToPixel(
  cell: CellCoord,
  grid: GridConfig,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } {
  const { rows, cols, gapX = 0, gapY = 0 } = grid;
  const bounds = getGridBounds(grid);
  
  // 计算网格区域的实际像素尺寸
  const gridPixelX = bounds.x * containerWidth;
  const gridPixelY = bounds.y * containerHeight;
  const gridPixelWidth = bounds.width * containerWidth;
  const gridPixelHeight = bounds.height * containerHeight;
  
  // 计算单格尺寸（考虑间距）
  const totalGapX = gapX * (cols - 1);
  const totalGapY = gapY * (rows - 1);
  const cellWidth = (gridPixelWidth - totalGapX * gridPixelWidth / cols) / cols;
  const cellHeight = (gridPixelHeight - totalGapY * gridPixelHeight / rows) / rows;
  const gapPixelX = gapX * gridPixelWidth / cols;
  const gapPixelY = gapY * gridPixelHeight / rows;
  
  return {
    x: gridPixelX + cell.col * (cellWidth + gapPixelX),
    y: gridPixelY + cell.row * (cellHeight + gapPixelY),
    width: cellWidth,
    height: cellHeight,
  };
}

/** 归一化坐标转像素 */
export function normalizedToPixel(
  point: NormalizedPoint,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  return {
    x: point.x * containerWidth,
    y: point.y * containerHeight,
  };
}

/** 像素坐标转归一化 */
export function pixelToNormalized(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number
): NormalizedPoint {
  return {
    x: x / containerWidth,
    y: y / containerHeight,
  };
}
