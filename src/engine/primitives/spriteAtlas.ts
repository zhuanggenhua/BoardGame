/**
 * engine/primitives/spriteAtlas — 精灵图集引擎原语
 *
 * 统一的精灵图集注册、查询、裁切计算。
 * 类似 Unity SpriteAtlas / Phaser TextureAtlas：
 * - 游戏层注册图集（图片 URL + 网格配置）
 * - UI 层按 atlasId + frameIndex 查询，拿到渲染数据
 * - 消费方不需要知道裁切细节
 */

import type { CSSProperties } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/** 精灵图集网格配置（支持不规则帧尺寸） */
export interface SpriteAtlasConfig {
  /** 图集总宽度（像素） */
  imageW: number;
  /** 图集总高度（像素） */
  imageH: number;
  /** 列数 */
  cols: number;
  /** 行数 */
  rows: number;
  /** 每列起始 X（像素） */
  colStarts: number[];
  /** 每列宽度（像素） */
  colWidths: number[];
  /** 每行起始 Y（像素） */
  rowStarts: number[];
  /** 每行高度（像素） */
  rowHeights: number[];
}

/** 精灵图集源（图片 URL + 网格配置） */
export interface SpriteAtlasSource {
  /** 图片 URL（运行时可直接用于 backgroundImage） */
  image: string;
  /** 网格裁切配置 */
  config: SpriteAtlasConfig;
}

/** 解析后的精灵帧渲染数据 */
export interface SpriteFrameStyle {
  /** CSS backgroundSize */
  backgroundSize: string;
  /** CSS backgroundPosition */
  backgroundPosition: string;
  /** 帧宽高比 (width / height) */
  aspectRatio: number;
}

// ============================================================================
// 裁切算法（纯函数，无副作用）
// ============================================================================

/** 计算精灵帧的 CSS 背景裁切样式 */
export function computeSpriteStyle(index: number, atlas: SpriteAtlasConfig): CSSProperties {
  const safeIndex = index % (atlas.cols * atlas.rows);
  const col = safeIndex % atlas.cols;
  const row = Math.floor(safeIndex / atlas.cols);

  const cardW = atlas.colWidths[col] ?? atlas.colWidths[0];
  const cardH = atlas.rowHeights[row] ?? atlas.rowHeights[0];
  const x = atlas.colStarts[col] ?? atlas.colStarts[0];
  const y = atlas.rowStarts[row] ?? atlas.rowStarts[0];

  const xPos = atlas.imageW > cardW ? (x / (atlas.imageW - cardW)) * 100 : 0;
  const yPos = atlas.imageH > cardH ? (y / (atlas.imageH - cardH)) * 100 : 0;
  const bgSizeX = (atlas.imageW / cardW) * 100;
  const bgSizeY = (atlas.imageH / cardH) * 100;

  return {
    backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
    backgroundPosition: `${xPos}% ${yPos}%`,
  };
}

/** 获取精灵帧的宽高比 */
export function computeSpriteAspectRatio(index: number, atlas: SpriteAtlasConfig): number {
  const safeIndex = index % (atlas.cols * atlas.rows);
  const col = safeIndex % atlas.cols;
  const row = Math.floor(safeIndex / atlas.cols);
  const cardW = atlas.colWidths[col] ?? atlas.colWidths[0];
  const cardH = atlas.rowHeights[row] ?? atlas.rowHeights[0];
  return cardW / cardH;
}

/** 根据图片尺寸和行列数生成均匀网格配置 */
export function generateUniformAtlasConfig(
  imageW: number,
  imageH: number,
  rows: number,
  cols: number,
): SpriteAtlasConfig {
  const cellW = imageW / cols;
  const cellH = imageH / rows;
  const rowStarts: number[] = [];
  const rowHeights: number[] = [];
  const colStarts: number[] = [];
  const colWidths: number[] = [];
  for (let i = 0; i < rows; i++) {
    rowStarts.push(i * cellH);
    rowHeights.push(cellH);
  }
  for (let i = 0; i < cols; i++) {
    colStarts.push(i * cellW);
    colWidths.push(cellW);
  }
  return { imageW, imageH, cols, rows, colStarts, colWidths, rowStarts, rowHeights };
}

// ============================================================================
// SpriteAtlasRegistry — 全局注册表
// ============================================================================

/**
 * 精灵图集注册表
 *
 * 游戏层在初始化时注册图集，UI 层在渲染时查询。
 * 支持多实例（测试隔离）或使用全局默认实例。
 */
export class SpriteAtlasRegistry {
  private sources = new Map<string, SpriteAtlasSource>();

  /** 注册图集 */
  register(atlasId: string, source: SpriteAtlasSource): void {
    this.sources.set(atlasId, source);
  }

  /** 获取图集源 */
  getSource(atlasId: string): SpriteAtlasSource | undefined {
    return this.sources.get(atlasId);
  }

  /** 解析精灵帧的完整渲染数据 */
  resolve(atlasId: string, frameIndex: number): (SpriteFrameStyle & { imageUrl: string }) | undefined {
    const source = this.sources.get(atlasId);
    if (!source) return undefined;
    const style = computeSpriteStyle(frameIndex, source.config);
    const aspectRatio = computeSpriteAspectRatio(frameIndex, source.config);
    return {
      imageUrl: source.image,
      backgroundSize: style.backgroundSize as string,
      backgroundPosition: style.backgroundPosition as string,
      aspectRatio,
    };
  }

  /** 检查图集是否已注册 */
  has(atlasId: string): boolean {
    return this.sources.has(atlasId);
  }

  /** 获取所有已注册的图集 ID */
  keys(): IterableIterator<string> {
    return this.sources.keys();
  }

  /** 清空（测试用） */
  clear(): void {
    this.sources.clear();
  }
}

// ============================================================================
// 全局默认实例
// ============================================================================

/** 全局精灵图集注册表（跨游戏共享） */
export const globalSpriteAtlasRegistry = new SpriteAtlasRegistry();


// ============================================================================
// 类型守卫
// ============================================================================

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number');

/** 运行时验证一个对象是否符合 SpriteAtlasConfig 结构 */
export function isSpriteAtlasConfig(value: unknown): value is SpriteAtlasConfig {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.imageW === 'number'
    && typeof data.imageH === 'number'
    && typeof data.rows === 'number'
    && typeof data.cols === 'number'
    && isNumberArray(data.rowStarts)
    && isNumberArray(data.rowHeights)
    && isNumberArray(data.colStarts)
    && isNumberArray(data.colWidths);
}
