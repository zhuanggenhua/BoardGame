/**
 * 召唤师战争 - 精灵图配置辅助函数
 * 
 * 从 Board.tsx 提取的精灵图配置获取逻辑
 */

import type { BoardUnit, BoardStructure, EventCard, UnitCard, StructureCard } from '../domain/types';
import { getFactionAtlasId, resolveCardAtlasId } from './cardAtlas';

export interface SpriteConfig {
  atlasId: string;
  frameIndex: number;
}

/** 获取单位精灵图配置 */
export function getUnitSpriteConfig(unit: BoardUnit): SpriteConfig {
  const card = unit.card;
  const spriteIndex = card.spriteIndex ?? 0;
  const spriteAtlas = card.spriteAtlas ?? 'cards';
  if (spriteAtlas === 'portal') {
    return { atlasId: 'sw:portal', frameIndex: spriteIndex };
  }
  const atlasId = resolveCardAtlasId(card, spriteAtlas as 'hero' | 'cards');
  return { atlasId, frameIndex: spriteIndex };
}

/** 获取事件卡精灵图配置 */
export function getEventSpriteConfig(card: EventCard): SpriteConfig {
  const spriteIndex = card.spriteIndex ?? 0;
  const spriteAtlas = card.spriteAtlas ?? 'cards';
  const atlasId = resolveCardAtlasId(card, spriteAtlas as 'hero' | 'cards');
  return { atlasId, frameIndex: spriteIndex };
}

/** 获取建筑精灵图配置 */
export function getStructureSpriteConfig(structure: BoardStructure): SpriteConfig {
  const card = structure.card;
  const spriteIndex = card.spriteIndex ?? 0;
  const spriteAtlas = card.spriteAtlas ?? 'portal';
  // 传送门使用全局共用图集
  if (spriteAtlas === 'portal') {
    return { atlasId: 'sw:portal', frameIndex: spriteIndex };
  }
  const atlasId = resolveCardAtlasId(card, spriteAtlas as 'hero' | 'cards');
  return { atlasId, frameIndex: spriteIndex };
}

/** 获取摧毁动画卡牌精灵图配置 */
export function getDestroySpriteConfig(card: UnitCard | StructureCard): SpriteConfig {
  const spriteIndex = card.spriteIndex ?? (card.cardType === 'structure' ? 0 : 0);
  const spriteAtlas = card.spriteAtlas ?? (card.cardType === 'structure' ? 'portal' : 'cards');
  // 传送门使用全局共用图集
  if (spriteAtlas === 'portal') {
    return { atlasId: 'sw:portal', frameIndex: spriteIndex };
  }
  const atlasId = resolveCardAtlasId(card, spriteAtlas as 'hero' | 'cards');
  return { atlasId, frameIndex: spriteIndex };
}
