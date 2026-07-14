import type { CSSProperties } from 'react';

export interface FxBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FxPercentPoint {
  xPct: number;
  yPct: number;
}

export interface FxScreenPoint {
  x: number;
  y: number;
}

export interface FxBoxStyle {
  left: string;
  top: string;
  width: string;
  height: string;
  overflow: CSSProperties['overflow'];
}

export interface FxPathBox {
  style: FxBoxStyle;
  start: FxPercentPoint;
  end: FxPercentPoint;
}

export interface FxScreenPathBox {
  style: FxBoxStyle;
  start: FxScreenPoint;
  end: FxScreenPoint;
}

function toPercentBoxStyle(box: FxBox, overflow: CSSProperties['overflow'] = 'visible'): FxBoxStyle {
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
    overflow,
  };
}

function toPixelBoxStyle(box: FxBox, overflow: CSSProperties['overflow'] = 'visible'): FxBoxStyle {
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    overflow,
  };
}

/** 以格子为中心，按 scale 放大特效容器，适合召唤/爆发类局部特效。 */
export function createFxScaledCellBox(
  cell: FxBox,
  scale: number,
  overflow: CSSProperties['overflow'] = 'visible',
): FxBoxStyle {
  const width = cell.width * scale;
  const height = cell.height * scale;
  const left = cell.left - (width - cell.width) / 2;
  const top = cell.top - (height - cell.height) / 2;

  return toPercentBoxStyle({ left, top, width, height }, overflow);
}

/** 只包住起点到终点附近的路径区域，避免远程攻击类特效退化成整屏重绘。 */
export function createFxPathBox(
  source: FxBox,
  target: FxBox,
  options: {
    paddingCells?: number;
    minSizeCells?: number;
    overflow?: CSSProperties['overflow'];
  } = {},
): FxPathBox {
  const srcCx = source.left + source.width / 2;
  const srcCy = source.top + source.height / 2;
  const tgtCx = target.left + target.width / 2;
  const tgtCy = target.top + target.height / 2;
  const cellSpan = Math.max(source.width, source.height, target.width, target.height);
  const padding = cellSpan * (options.paddingCells ?? 1.35);
  const minSize = cellSpan * (options.minSizeCells ?? 2.25);

  const pathLeft = Math.min(srcCx, tgtCx);
  const pathTop = Math.min(srcCy, tgtCy);
  const pathWidth = Math.abs(tgtCx - srcCx);
  const pathHeight = Math.abs(tgtCy - srcCy);
  const width = Math.max(pathWidth + padding * 2, minSize);
  const height = Math.max(pathHeight + padding * 2, minSize);
  const left = pathLeft - (width - pathWidth) / 2;
  const top = pathTop - (height - pathHeight) / 2;

  return {
    style: toPercentBoxStyle({ left, top, width, height }, options.overflow ?? 'visible'),
    start: {
      xPct: ((srcCx - left) / width) * 100,
      yPct: ((srcCy - top) / height) * 100,
    },
    end: {
      xPct: ((tgtCx - left) / width) * 100,
      yPct: ((tgtCy - top) / height) * 100,
    },
  };
}

/** 为屏幕坐标飞行特效创建路径局部画布，避免 fixed canvas 每帧清整屏。 */
export function createFxScreenPathBox(
  source: FxScreenPoint,
  target: FxScreenPoint,
  options: {
    paddingPx?: number;
    minSizePx?: number;
    overflow?: CSSProperties['overflow'];
  } = {},
): FxScreenPathBox {
  const padding = options.paddingPx ?? 96;
  const minSize = options.minSizePx ?? 192;
  const pathLeft = Math.min(source.x, target.x);
  const pathTop = Math.min(source.y, target.y);
  const pathWidth = Math.abs(target.x - source.x);
  const pathHeight = Math.abs(target.y - source.y);
  const width = Math.max(pathWidth + padding * 2, minSize);
  const height = Math.max(pathHeight + padding * 2, minSize);
  const left = pathLeft - (width - pathWidth) / 2;
  const top = pathTop - (height - pathHeight) / 2;

  return {
    style: toPixelBoxStyle({ left, top, width, height }, options.overflow ?? 'visible'),
    start: {
      x: source.x - left,
      y: source.y - top,
    },
    end: {
      x: target.x - left,
      y: target.y - top,
    },
  };
}
