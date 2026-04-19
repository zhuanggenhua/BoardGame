/**
 * UGC 布局解析工具
 * 基于 anchor/pivot/offset 计算实际像素坐标
 */

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface LayoutTransform {
  anchor: LayoutPoint;
  pivot: LayoutPoint;
  offset: LayoutPoint;
  width: number;
  height: number;
  rotation?: number;
}

export interface ResolvedLayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function resolveLayoutRect(transform: LayoutTransform, canvas: CanvasSize): ResolvedLayoutRect {
  const width = canvas.width || 0;
  const height = canvas.height || 0;
  const resolvedX = width > 0
    ? transform.anchor.x * width + transform.offset.x - transform.pivot.x * transform.width
    : 0;
  const resolvedY = height > 0
    ? transform.anchor.y * height + transform.offset.y - transform.pivot.y * transform.height
    : 0;

  return {
    x: resolvedX,
    y: resolvedY,
    width: transform.width,
    height: transform.height,
    rotation: transform.rotation,
  };
}

export function resolveAnchorFromPosition(params: {
  position: LayoutPoint;
  pivot: LayoutPoint;
  offset: LayoutPoint;
  size: { width: number; height: number };
  canvas: CanvasSize;
  clampToCanvas?: boolean;
}): LayoutPoint {
  const { position, pivot, offset, size, canvas, clampToCanvas = true } = params;
  const width = canvas.width || 0;
  const height = canvas.height || 0;
  if (width <= 0 || height <= 0) {
    return { x: 0, y: 0 };
  }

  const anchorX = (position.x + pivot.x * size.width - offset.x) / width;
  const anchorY = (position.y + pivot.y * size.height - offset.y) / height;

  return {
    x: clampToCanvas ? clamp(anchorX) : anchorX,
    y: clampToCanvas ? clamp(anchorY) : anchorY,
  };
}

/**
 * 布局组件数据迁移函数
 * 用于处理旧版本布局数据向新版本的迁移
 */
export function migrateLayoutComponents(components: unknown[]): unknown[] {
  if (!Array.isArray(components)) return [];

  return components.map((comp) => {
    if (typeof comp !== 'object' || comp === null) return comp;

    // 确保基本字段存在
    const migrated = { ...comp } as Record<string, unknown>;

    const hasAnchor = typeof migrated.anchor === 'object' && migrated.anchor !== null;
    const hasPivot = typeof migrated.pivot === 'object' && migrated.pivot !== null;
    const hasOffset = typeof migrated.offset === 'object' && migrated.offset !== null;
    const legacyX = typeof migrated.x === 'number' ? migrated.x : undefined;
    const legacyY = typeof migrated.y === 'number' ? migrated.y : undefined;

    if (!hasAnchor && !hasPivot && !hasOffset && (legacyX !== undefined || legacyY !== undefined)) {
      migrated.anchor = { x: 0, y: 0 };
      migrated.pivot = { x: 0, y: 0 };
      migrated.offset = { x: legacyX ?? 0, y: legacyY ?? 0 };
      return migrated;
    }

    if (!hasAnchor) {
      migrated.anchor = { x: 0.5, y: 0.5 };
    }
    if (!hasPivot) {
      migrated.pivot = { x: 0.5, y: 0.5 };
    }
    if (!hasOffset) {
      migrated.offset = { x: 0, y: 0 };
    }

    return migrated;
  });
}

