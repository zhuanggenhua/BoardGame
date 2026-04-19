/**
 * 召唤师战争 - 卡牌注册表
 *
 * 从各阵营配置中聚合所有卡牌，提供按阵营查询和分组功能。
 */

import type { Card, UnitCard, EventCard, StructureCard } from '../domain/types';
import { FACTION_CATALOG } from './factions';
import { createDeckByFactionId } from './factions';

// ============================================================================
// 卡牌注册表（按阵营缓存所有唯一卡牌定义）
// ============================================================================

export type CardRegistry = Map<string, Card>;

/** 每个阵营的唯一卡牌池（去重，不含副本后缀） */
const factionCardPoolCache = new Map<string, Card[]>();

/** 从阵营牌组中提取唯一卡牌定义（去除副本 ID 后缀） */
function buildFactionCardPool(factionId: string): Card[] {
  const cached = factionCardPoolCache.get(factionId);
  if (cached) return cached;

  try {
    const deckData = createDeckByFactionId(factionId as Parameters<typeof createDeckByFactionId>[0]);
    const seen = new Map<string, Card>();

    // 召唤师
    seen.set(deckData.summoner.id, deckData.summoner);

    // 牌组中的卡牌（去除副本后缀 -0, -1, -2...）
    // 起始单位是牌组中已有普通单位的副本，无需单独处理
    // 城门（isGate）和史诗事件（legendary）不加入卡池——已由 autoCards 自动填充，用户不应手动添加
    for (const card of deckData.deck) {
      if (card.cardType === 'structure' && (card as StructureCard).isGate) continue;
      if (card.cardType === 'event' && (card as EventCard).eventType === 'legendary') continue;
      const baseId = card.id.replace(/-\d+$/, '');
      if (!seen.has(baseId)) {
        seen.set(baseId, { ...card, id: baseId });
      }
    }

    const pool = Array.from(seen.values());
    factionCardPoolCache.set(factionId, pool);
    return pool;
  } catch {
    // 阵营数据不可用时返回空
    return [];
  }
}

// ============================================================================
// 公共 API
// ============================================================================

let registry: CardRegistry | null = null;

export function buildCardRegistry(): CardRegistry {
  if (registry) return registry;
  registry = new Map();

  for (const faction of FACTION_CATALOG) {
    if (faction.selectable === false) continue;
    const pool = buildFactionCardPool(faction.id);
    for (const card of pool) {
      registry.set(card.id, card);
    }
  }

  return registry;
}

/** 获取指定阵营的卡牌池 */
export function getCardPoolByFaction(factionId: string): Card[] {
  return buildFactionCardPool(factionId);
}

export interface GroupedCards {
  summoners: UnitCard[];
  champions: UnitCard[];
  commons: UnitCard[];
  events: EventCard[];
  structures: StructureCard[];
}

/** 按类型分组卡牌 */
export function groupCardsByType(cards: Card[]): GroupedCards {
  const groups: GroupedCards = {
    summoners: [],
    champions: [],
    commons: [],
    events: [],
    structures: [],
  };

  for (const card of cards) {
    if (card.cardType === 'unit') {
      if (card.unitClass === 'summoner') groups.summoners.push(card);
      else if (card.unitClass === 'champion') groups.champions.push(card);
      else groups.commons.push(card);
    } else if (card.cardType === 'event') {
      groups.events.push(card);
    } else if (card.cardType === 'structure') {
      groups.structures.push(card);
    }
  }

  return groups;
}
