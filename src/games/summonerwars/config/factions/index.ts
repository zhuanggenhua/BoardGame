/**
 * 召唤师战争 - 派系索引
 */

export * from './necromancer';
export * from './trickster';
export * from './paladin';
export * from './goblin';
export * from './frost';
export * from './barbaric';
export * from './mogu';
export * from './huijin';
export * from './shouren';
export * from './yongheng';
export * from './shadow';
export { DECK_SYMBOLS } from '../symbols';

import { createNecromancerDeck } from './necromancer';
import { createTricksterDeck } from './trickster';
import { createPaladinDeck } from './paladin';
import { createGoblinDeck } from './goblin';
import { createFrostDeck } from './frost';
import { createBarbaricDeck } from './barbaric';
import { createMoguDeck } from './mogu';
import { createHuijinDeck } from './huijin';
import { createShourenDeck } from './shouren';
import { createYonghengDeck } from './yongheng';
import { createShadowDeck } from './shadow';
import type { FactionId } from '../../domain/types';

// 派系 ID 常量
export const FACTION_IDS = {
  NECROMANCER: 'necromancer',
  TRICKSTER: 'trickster',
  PALADIN: 'paladin',
  BARBARIC: 'barbaric',
  FROST: 'frost',
  GOBLIN: 'goblin',
  MOGU: 'mogu',
  HUIJIN: 'huijin',
  SHOUREN: 'shouren',
  YONGHENG: 'yongheng',
  SHADOW: 'shadow',
} as const;

/** 中文阵营名 → 阵营 ID 映射 */
export const FACTION_NAME_TO_ID: Record<string, FactionId> = {
  '堕落王国': 'necromancer',
  '欺心巫族': 'trickster',
  '先锋军团': 'paladin',
  '洞穴地精': 'goblin',
  '极地矮人': 'frost',
  '炽原精灵': 'barbaric',
  '莫古': 'mogu',
  '灰烬': 'huijin',
  '冰苔兽人': 'shouren',
  '永恒议会': 'yongheng',
  '暗影精灵': 'shadow',
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
  /** 用户可见实施状态；实施中对象必须显示共享斜条横幅 */
  statusTag?: 'under_construction';
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
  {
    id: 'mogu',
    nameKey: 'factions.mogu',
    heroImagePath: 'summonerwars/hero/mogu/hero',
    tipImagePath: 'summonerwars/hero/mogu/tip',
    selectable: true,
    statusTag: 'under_construction',
  },
  {
    id: 'huijin',
    nameKey: 'factions.huijin',
    heroImagePath: 'summonerwars/hero/huijin/hero',
    tipImagePath: 'summonerwars/hero/huijin/tip',
    selectable: true,
    statusTag: 'under_construction',
  },
  {
    id: 'shouren',
    nameKey: 'factions.shouren',
    heroImagePath: 'summonerwars/hero/shouren/hero',
    tipImagePath: 'summonerwars/hero/shouren/tip',
    selectable: true,
  },
  {
    id: 'yongheng',
    nameKey: 'factions.yongheng',
    heroImagePath: 'summonerwars/hero/yongheng/hero',
    tipImagePath: 'summonerwars/hero/yongheng/tip',
    selectable: true,
    statusTag: 'under_construction',
  },
  {
    id: 'shadow',
    nameKey: 'factions.shadow',
    heroImagePath: 'summonerwars/hero/shadow/hero',
    tipImagePath: 'summonerwars/hero/shadow/tip',
    selectable: true,
    statusTag: 'under_construction',
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
    case 'mogu': return createMoguDeck();
    case 'huijin': return createHuijinDeck();
    case 'shouren': return createShourenDeck();
    case 'yongheng': return createYonghengDeck();
    case 'shadow': return createShadowDeck();
    default: return createNecromancerDeck();
  }
}
