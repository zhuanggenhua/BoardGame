/**
 * 召唤师战争 - 派系索引
 */

export * from './necromancer';
export * from './trickster';
export * from './paladin';
export * from './goblin';
export * from './frost';
export * from './barbaric';
export { DECK_SYMBOLS } from '../symbols';

import { createNecromancerDeck } from './necromancer';
import { createTricksterDeck } from './trickster';
import { createPaladinDeck } from './paladin';
import { createGoblinDeck } from './goblin';
import { createFrostDeck } from './frost';
import { createBarbaricDeck } from './barbaric';
import type { FactionId } from '../../domain/types';

// 派系 ID 常量
export const FACTION_IDS = {
  NECROMANCER: 'necromancer',
  TRICKSTER: 'trickster',
  PALADIN: 'paladin',
  BARBARIC: 'barbaric',
  FROST: 'frost',
  GOBLIN: 'goblin',
} as const;

/** 中文阵营名 → 阵营 ID 映射 */
export const FACTION_NAME_TO_ID: Record<string, FactionId> = {
  '堕落王国': 'necromancer',
  '欺心巫族': 'trickster',
  '先锋军团': 'paladin',
  '洞穴地精': 'goblin',
  '极地矮人': 'frost',
  '炽原精灵': 'barbaric',
};

/** 将中文阵营名或阵营 ID 统一解析为 FactionId */
export function resolveFactionId(factionNameOrId: string): FactionId {
  return (FACTION_NAME_TO_ID[factionNameOrId] ?? factionNameOrId) as FactionId;
}

/** 阵营目录（用于选择界面） */
export interface FactionCatalogEntry {
  id: FactionId;
  nameKey: string;
  /** 召唤师图片路径（hero.png 中的召唤师） */
  heroImagePath: string;
  /** tip 图片路径 */
  tipImagePath: string;
  /** 是否可选（未实现的阵营设为 false） */
  selectable: boolean;
}

export const FACTION_CATALOG: FactionCatalogEntry[] = [
  {
    id: 'necromancer',
    nameKey: 'factions.necromancer',
    heroImagePath: 'summonerwars/hero/Necromancer/hero',
    tipImagePath: 'summonerwars/hero/Necromancer/tip',
    selectable: true,
  },
  {
    id: 'trickster',
    nameKey: 'factions.trickster',
    heroImagePath: 'summonerwars/hero/Trickster/hero',
    tipImagePath: 'summonerwars/hero/Trickster/tip',
    selectable: true,
  },
  {
    id: 'paladin',
    nameKey: 'factions.paladin',
    heroImagePath: 'summonerwars/hero/Paladin/hero',
    tipImagePath: 'summonerwars/hero/Paladin/tip',
    selectable: true,
  },
  {
    id: 'goblin',
    nameKey: 'factions.goblin',
    heroImagePath: 'summonerwars/hero/Goblin/hero',
    tipImagePath: 'summonerwars/hero/Goblin/tip',
    selectable: true,
  },
  {
    id: 'frost',
    nameKey: 'factions.frost',
    heroImagePath: 'summonerwars/hero/Frost/hero',
    tipImagePath: 'summonerwars/hero/Frost/tip',
    selectable: true,
  },
  {
    id: 'barbaric',
    nameKey: 'factions.barbaric',
    heroImagePath: 'summonerwars/hero/Barbaric/hero',
    tipImagePath: 'summonerwars/hero/Barbaric/tip',
    selectable: true,
  },
];

/** 根据阵营 ID 创建牌组 */
export function createDeckByFactionId(factionId: FactionId) {
  switch (factionId) {
    case 'necromancer': return createNecromancerDeck();
    case 'trickster': return createTricksterDeck();
    case 'paladin': return createPaladinDeck();
    case 'goblin': return createGoblinDeck();
    case 'frost': return createFrostDeck();
    case 'barbaric': return createBarbaricDeck();
    default: return createNecromancerDeck();
  }
}
