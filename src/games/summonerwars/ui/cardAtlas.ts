/**
 * 召唤师战争 - 卡牌图集配置
 * 参考 dicethrone 的 CardAtlasConfig 方式，支持不同规格精灵图
 */

import type { CSSProperties } from 'react';
import { getOptimizedImageUrls } from '../../../core/AssetLoader';

/** 精灵图配置（支持不规则帧尺寸） */
export interface SpriteAtlasConfig {
  /** 图集总宽度 */
  imageW: number;
  /** 图集总高度 */
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
  /** 每行高度（像素）- 内容高度，不含黑边 */
  rowHeights: number[];
}

/** 精灵图源（图片 + 配置） */
export interface SpriteAtlasSource {
  image: string;
  config: SpriteAtlasConfig;
}

// 精灵图源注册表
const atlasRegistry = new Map<string, SpriteAtlasSource>();

/** 注册精灵图源 */
export function registerSpriteAtlas(id: string, source: SpriteAtlasSource): void {
  atlasRegistry.set(id, source);
}

/** 获取精灵图源 */
export function getSpriteAtlasSource(id: string): SpriteAtlasSource | undefined {
  return atlasRegistry.get(id);
}

/** 计算精灵图裁切样式 */
export function getSpriteAtlasStyle(
  index: number,
  atlas: SpriteAtlasConfig
): CSSProperties {
  const safeIndex = index % (atlas.cols * atlas.rows);
  const col = safeIndex % atlas.cols;
  const row = Math.floor(safeIndex / atlas.cols);
  
  const cardW = atlas.colWidths[col] ?? atlas.colWidths[0];
  const cardH = atlas.rowHeights[row] ?? atlas.rowHeights[0];
  const x = atlas.colStarts[col] ?? atlas.colStarts[0];
  const y = atlas.rowStarts[row] ?? atlas.rowStarts[0];
  
  // 计算背景位置百分比
  const xPos = atlas.imageW > cardW ? (x / (atlas.imageW - cardW)) * 100 : 0;
  const yPos = atlas.imageH > cardH ? (y / (atlas.imageH - cardH)) * 100 : 0;
  
  // 计算背景缩放比例
  const bgSizeX = (atlas.imageW / cardW) * 100;
  const bgSizeY = (atlas.imageH / cardH) * 100;
  
  return {
    backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
    backgroundPosition: `${xPos}% ${yPos}%`,
  };
}

/** 获取帧的宽高比 */
export function getFrameAspectRatio(
  index: number,
  atlas: SpriteAtlasConfig
): number {
  const safeIndex = index % (atlas.cols * atlas.rows);
  const col = safeIndex % atlas.cols;
  const row = Math.floor(safeIndex / atlas.cols);
  const cardW = atlas.colWidths[col] ?? atlas.colWidths[0];
  const cardH = atlas.rowHeights[row] ?? atlas.rowHeights[0];
  return cardW / cardH;
}

// ========== 堕落王国（Necromancer）精灵图配置 ==========

/**
 * hero.png 配置（召唤师 + 传送门）
 * 扫描结果：原图 2088x1458，2帧，每帧 1044x729
 */
export const NECROMANCER_HERO_ATLAS: SpriteAtlasConfig = {
  imageW: 2088,
  imageH: 1458,
  cols: 2,
  rows: 1,
  colStarts: [0, 1044],
  colWidths: [1044, 1044],
  rowStarts: [0],
  rowHeights: [729],
};

/**
 * cards.png 配置（所有卡牌）
 * 扫描结果：原图 2100x4410，2列6行，每帧 1050x735
 * 索引 0-10 有效，索引 11 为空
 */
export const NECROMANCER_CARDS_ATLAS: SpriteAtlasConfig = {
  imageW: 2100,
  imageH: 4410,
  cols: 2,
  rows: 6,
  colStarts: [0, 1050],
  colWidths: [1050, 1050],
  rowStarts: [0, 735, 1470, 2205, 2940, 3675],
  rowHeights: [735, 735, 735, 735, 735, 735],
};

/** 初始化精灵图注册 */
export function initSpriteAtlases(): void {
  // 堕落王国 - hero.png（召唤师 + 传送门）
  const heroUrls = getOptimizedImageUrls('summonerwars/hero/Necromancer/hero');
  registerSpriteAtlas('sw:necromancer:hero', {
    image: heroUrls.webp,
    config: NECROMANCER_HERO_ATLAS,
  });
  
  // 堕落王国 - cards.png（所有卡牌）
  const cardsUrls = getOptimizedImageUrls('summonerwars/hero/Necromancer/cards');
  registerSpriteAtlas('sw:necromancer:cards', {
    image: cardsUrls.webp,
    config: NECROMANCER_CARDS_ATLAS,
  });
}
