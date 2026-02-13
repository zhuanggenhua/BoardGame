/**
 * 召唤师战争 - 卡牌图集配置
 * 底层使用引擎层 SpriteAtlasRegistry，本文件保留游戏特有的阵营映射逻辑
 */

import type { CSSProperties } from 'react';
import { getOptimizedImageUrls } from '../../../core/AssetLoader';
import { registerCardAtlasSource } from '../../../components/common/media/CardPreview';
import type { FactionId } from '../domain/types';
import { resolveFactionId } from '../config/factions';
import {
  type SpriteAtlasConfig,
  type SpriteAtlasSource,
  computeSpriteStyle,
  computeSpriteAspectRatio,
  globalSpriteAtlasRegistry,
} from '../../../engine/primitives/spriteAtlas';

// 向后兼容：re-export 引擎层类型
export type { SpriteAtlasConfig, SpriteAtlasSource };

/** 注册精灵图源（委托到引擎层全局注册表） */
export function registerSpriteAtlas(id: string, source: SpriteAtlasSource): void {
  globalSpriteAtlasRegistry.register(id, source);
}

/** 获取精灵图源（委托到引擎层全局注册表） */
export function getSpriteAtlasSource(id: string): SpriteAtlasSource | undefined {
  return globalSpriteAtlasRegistry.getSource(id);
}

/** 计算精灵图裁切样式（委托到引擎层） */
export function getSpriteAtlasStyle(index: number, atlas: SpriteAtlasConfig): CSSProperties {
  return computeSpriteStyle(index, atlas);
}

/** 获取帧的宽高比（委托到引擎层） */
export function getFrameAspectRatio(index: number, atlas: SpriteAtlasConfig): number {
  return computeSpriteAspectRatio(index, atlas);
}

// ========== 通用精灵图配置 ==========

/**
 * hero.png 配置（召唤师 + 传送门）
 * 所有阵营统一：原图 2088x1458，2帧，每帧 1044x729
 */
export const HERO_ATLAS: SpriteAtlasConfig = {
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
 * Portal.png 配置（传送门 / 城门，所有阵营共用）
 * 压缩后 2048x1430，2帧，每帧 1024x715
 * 帧0 = 起始城门（10HP），帧1 = 传送门（5HP）
 */
export const PORTAL_ATLAS: SpriteAtlasConfig = {
  imageW: 2048,
  imageH: 1430,
  cols: 2,
  rows: 1,
  colStarts: [0, 1024],
  colWidths: [1024, 1024],
  rowStarts: [0],
  rowHeights: [715],
};



/**
 * cards.png 配置（通用版，5个阵营共用）
 * 原图 2088x4374，2列6行，每帧 1044x729
 */
export const CARDS_ATLAS: SpriteAtlasConfig = {
  imageW: 2088,
  imageH: 4374,
  cols: 2,
  rows: 6,
  colStarts: [0, 1044],
  colWidths: [1044, 1044],
  rowStarts: [0, 729, 1458, 2187, 2916, 3645],
  rowHeights: [729, 729, 729, 729, 729, 729],
};

/**
 * cards.png 配置（Necromancer 专用，尺寸略有不同）
 * 原图 2100x4410，2列6行，每帧 1050x735
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

// 向后兼容别名
export const NECROMANCER_HERO_ATLAS = HERO_ATLAS;

/**
 * dice.png 配置（骰子面精灵图）
 * 3x3 布局，约 1024x1024
 * 索引映射：
 * - 0: 近战（大交叉剑）  1: 空  2: 空
 * - 3: 远程（交叉斧弓）  4: 近战（交叉剑）  5: 空
 * - 6: 近战（交叉剑）    7: 远程（剑+弓）    8: 特殊（单剑）
 */
export const DICE_ATLAS: SpriteAtlasConfig = {
  imageW: 1024,
  imageH: 1024,
  cols: 3,
  rows: 3,
  colStarts: [0, 341, 682],
  colWidths: [341, 341, 342],
  rowStarts: [0, 341, 682],
  rowHeights: [341, 341, 342],
};

/** 骰子面对应的精灵图帧索引 */
export const DICE_FACE_SPRITE_MAP = {
  /** 近战面可用的帧索引 */
  melee: [0, 4, 6],
  /** 远程面可用的帧索引 */
  ranged: [3, 7],
  /** 特殊面的帧索引 */
  special: [8],
} as const;

// ========== 阵营名 → 目录名映射 ==========

/** 阵营 ID → 资源目录名（核心使用 FactionId，兼容旧中文输入） */
const FACTION_DIR_MAP: Record<FactionId, string> = {
  necromancer: 'Necromancer',
  trickster: 'Trickster',
  paladin: 'Paladin',
  goblin: 'Goblin',
  frost: 'Frost',
  barbaric: 'Barbaric',
};

/** 所有阵营目录名列表 */
const ALL_FACTION_DIRS = ['Necromancer', 'Trickster', 'Paladin', 'Goblin', 'Frost', 'Barbaric'] as const;

/**
 * 根据阵营名获取精灵图 atlas ID
 * @param faction 阵营 ID（如 'necromancer'，兼容旧中文）
 * @param atlasType 'hero' | 'cards'
 */
export function getFactionAtlasId(faction: FactionId | string, atlasType: 'hero' | 'cards'): string {
  const factionId = resolveFactionId(faction);
  const dir = FACTION_DIR_MAP[factionId] ?? 'Necromancer';
  return `sw:${dir.toLowerCase()}:${atlasType}`;
}

/** 根据卡牌 ID 前缀推断阵营 */
const CARD_ID_PREFIX_MAP: Record<string, FactionId> = {
  necro: 'necromancer',
  trick: 'trickster',
  paladin: 'paladin',
  goblin: 'goblin',
  frost: 'frost',
  barb: 'barbaric',
};

/**
 * 根据卡牌数据解析精灵图 atlas ID
 * 优先使用 faction 字段（UnitCard），回退到 ID 前缀推断
 */
export function resolveCardAtlasId(card: { id: string; faction?: FactionId | string }, atlasType: 'hero' | 'cards'): string {
  if (card.faction) {
    return getFactionAtlasId(card.faction, atlasType);
  }
  for (const [prefix, faction] of Object.entries(CARD_ID_PREFIX_MAP)) {
    if (card.id.startsWith(prefix)) {
      return getFactionAtlasId(faction, atlasType);
    }
  }
  return getFactionAtlasId('necromancer', atlasType);
}

/** 初始化精灵图注册（所有阵营） */
export function initSpriteAtlases(): void {
  for (const dir of ALL_FACTION_DIRS) {
    const heroBase = `summonerwars/hero/${dir}/hero`;
    const heroUrls = getOptimizedImageUrls(heroBase);
    registerSpriteAtlas(`sw:${dir.toLowerCase()}:hero`, {
      image: heroUrls.webp,
      config: HERO_ATLAS,
    });
    registerCardAtlasSource(`sw:${dir.toLowerCase()}:hero`, {
      image: heroBase,
      config: HERO_ATLAS,
    });

    const cardsBase = `summonerwars/hero/${dir}/cards`;
    const cardsUrls = getOptimizedImageUrls(cardsBase);
    const cardsConfig = dir === 'Necromancer' ? NECROMANCER_CARDS_ATLAS : CARDS_ATLAS;
    registerSpriteAtlas(`sw:${dir.toLowerCase()}:cards`, {
      image: cardsUrls.webp,
      config: cardsConfig,
    });
    registerCardAtlasSource(`sw:${dir.toLowerCase()}:cards`, {
      image: cardsBase,
      config: cardsConfig,
    });
  }

  // 骰子精灵图
  const diceBase = 'summonerwars/common/dice';
  const diceUrls = getOptimizedImageUrls(diceBase);
  registerSpriteAtlas('sw:dice', {
    image: diceUrls.webp,
    config: DICE_ATLAS,
  });
  registerCardAtlasSource('sw:dice', {
    image: diceBase,
    config: DICE_ATLAS,
  });

  // 传送门精灵图（所有阵营共用）
  const portalBase = 'summonerwars/common/Portal';
  const portalUrls = getOptimizedImageUrls(portalBase);
  registerSpriteAtlas('sw:portal', {
    image: portalUrls.webp,
    config: PORTAL_ATLAS,
  });
  registerCardAtlasSource('sw:portal', {
    image: portalBase,
    config: PORTAL_ATLAS,
  });
}
