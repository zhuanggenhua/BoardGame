/**
 * 召唤师战争 - 炽原精灵派系 (Savanna Elves / Barbaric)
 * 
 * 基于实际卡牌图片配置
 * 精灵图集: public/assets/summonerwars/hero/Barbaric/cards.png
 */

import type { UnitCard, EventCard, StructureCard, CellCoord } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

// ============================================================================
// 精灵图索引映射
// ============================================================================

/**
 * cards.png 布局 (基于 index 0-10):
 * Row 1: Chant of Entanglement(0), Spirit Mage(1)
 * Row 2: Chant of Power(2), Moka(3)
 * Row 3: Chant of Growth(4), Frontier Archer(5)
 * Row 4: Makinda Ru(6), Lioness(7)
 * Row 5: Rhinoceros(8), Kalu(9)
 * Row 6: Chant of Weaving(10)
 */
export const SPRITE_INDEX_BARBARIC = {
  EVENT_CHANT_OF_ENTANGLEMENT: 0,
  COMMON_SPIRIT_MAGE: 1,
  EVENT_CHANT_OF_POWER: 2,
  CHAMPION_MOKA: 3,
  EVENT_CHANT_OF_GROWTH: 4,
  COMMON_FRONTIER_ARCHER: 5,
  CHAMPION_MAKINDA_RU: 6,
  COMMON_LIONESS: 7,
  COMMON_RHINOCEROS: 8,
  CHAMPION_KALU: 9,
  EVENT_CHANT_OF_WEAVING: 10,
} as const;

// ============================================================================
// 召唤师（来自 hero.png，索引 0）
// ============================================================================

export const SUMMONER_BARBARIC: UnitCard = {
  id: 'barbaric-summoner',
  cardType: 'unit',
  name: '阿布亚·石',
  unitClass: 'summoner',
  faction: 'barbaric',
  strength: 5,
  life: 10,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['ancestral_bond'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, DECK_SYMBOLS.STAR, DECK_SYMBOLS.RHOMBUS], // 
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

// ============================================================================
// 冠军单位
// ============================================================================

export const CHAMPION_UNITS_BARBARIC: UnitCard[] = [
  {
    id: 'barbaric-moka',
    cardType: 'unit',
    name: '蒙威尊者',
    unitClass: 'champion',
    faction: 'barbaric',
    strength: 1,
    life: 11,
    cost: 8,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['power_up', 'trample'],
    deckSymbols: [DECK_SYMBOLS.STAR], // 
    spriteIndex: SPRITE_INDEX_BARBARIC.CHAMPION_MOKA,
    spriteAtlas: 'cards',
  },
  {
    id: 'barbaric-makinda-ru',
    cardType: 'unit',
    name: '梅肯达·露',
    unitClass: 'champion',
    faction: 'barbaric',
    strength: 2,
    life: 9,
    cost: 5,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['prepare', 'rapid_fire'],
    deckSymbols: [DECK_SYMBOLS.RHOMBUS], // 
    spriteIndex: SPRITE_INDEX_BARBARIC.CHAMPION_MAKINDA_RU,
    spriteAtlas: 'cards',
  },
  {
    id: 'barbaric-kalu',
    cardType: 'unit',
    name: '凯鲁尊者',
    unitClass: 'champion',
    faction: 'barbaric',
    strength: 4,
    life: 7,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['inspire', 'withdraw'],
    deckSymbols: [DECK_SYMBOLS.STAR, DECK_SYMBOLS.RHOMBUS], // 
    spriteIndex: SPRITE_INDEX_BARBARIC.CHAMPION_KALU,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 普通单位（士兵）
// ============================================================================

export const COMMON_UNITS_BARBARIC: UnitCard[] = [
  // 边境弓箭手
  {
    id: 'barbaric-frontier-archer',
    cardType: 'unit',
    name: '边境弓箭手',
    unitClass: 'common',
    faction: 'barbaric',
    strength: 2,
    life: 4,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['prepare', 'rapid_fire'],
    deckSymbols: [DECK_SYMBOLS.RHOMBUS], // 
    spriteIndex: SPRITE_INDEX_BARBARIC.COMMON_FRONTIER_ARCHER,
    spriteAtlas: 'cards',
  },
  // 雌狮
  {
    id: 'barbaric-lioness',
    cardType: 'unit',
    name: '雌狮',
    unitClass: 'common',
    faction: 'barbaric',
    strength: 3,
    life: 2,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['intimidate', 'life_up'],
    deckSymbols: [DECK_SYMBOLS.STAR], // 
    spriteIndex: SPRITE_INDEX_BARBARIC.COMMON_LIONESS,
    spriteAtlas: 'cards',
  },
  // 犀牛
  {
    id: 'barbaric-rhinoceros',
    cardType: 'unit',
    name: '犀牛',
    unitClass: 'common',
    faction: 'barbaric',
    strength: 2,
    life: 5,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['speed_up', 'trample'],
    deckSymbols: [DECK_SYMBOLS.STAR], // 
    spriteIndex: SPRITE_INDEX_BARBARIC.COMMON_RHINOCEROS,
    spriteAtlas: 'cards',
  },
  // 祖灵法师
  {
    id: 'barbaric-spirit-mage',
    cardType: 'unit',
    name: '祖灵法师',
    unitClass: 'common',
    faction: 'barbaric',
    strength: 3,
    life: 2,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['gather_power', 'spirit_bond'],
    deckSymbols: [DECK_SYMBOLS.RHOMBUS], // 
    spriteIndex: SPRITE_INDEX_BARBARIC.COMMON_SPIRIT_MAGE,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 事件卡
// ============================================================================

export const EVENT_CARDS_BARBARIC: EventCard[] = [
  // 力量颂歌 - 传奇事件
  {
    id: 'barbaric-chant-of-power',
    cardType: 'event',
    faction: 'barbaric',
    name: '力量颂歌',
    eventType: 'legendary',
    playPhase: 'attack',
    cost: 1,
    isActive: false,
    effect: '指定你的召唤师3个区格以内的一个士兵或英雄为目标。目标获得以下技能，直到回合结束：\n力量强化：本单位每有1点充能，则获得战力+1，至多为+5。',
    deckSymbols: [], // 传奇事件无符号
    spriteIndex: SPRITE_INDEX_BARBARIC.EVENT_CHANT_OF_POWER,
    spriteAtlas: 'cards',
  },
  // 交缠颂歌 - 普通事件
  {
    id: 'barbaric-chant-of-entanglement',
    cardType: 'event',
    faction: 'barbaric',
    name: '交缠颂歌',
    eventType: 'common',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '指定你的召唤师3个区格以内的两个友方士兵为目标。\n持续：每个目标均获得另一个目标的所有基础技能。当任一目标离开战场时，弃除本事件。',
    deckSymbols: [DECK_SYMBOLS.RHOMBUS], // 🔶 (图片确认)
    spriteIndex: SPRITE_INDEX_BARBARIC.EVENT_CHANT_OF_ENTANGLEMENT,
    spriteAtlas: 'cards',
  },
  // 生长颂歌 - 普通事件
  {
    id: 'barbaric-chant-of-growth',
    cardType: 'event',
    faction: 'barbaric',
    name: '生长颂歌',
    eventType: 'common',
    playPhase: 'move',
    cost: 0,
    isActive: false,
    effect: '指定一个友方单位为目标。将目标和每个相邻的友方单位充能。',
    deckSymbols: [DECK_SYMBOLS.STAR], // ✧ (图片确认)
    spriteIndex: SPRITE_INDEX_BARBARIC.EVENT_CHANT_OF_GROWTH,
    spriteAtlas: 'cards',
  },
  // 编织颂歌 - 普通事件
  {
    id: 'barbaric-chant-of-weaving',
    cardType: 'event',
    faction: 'barbaric',
    name: '编织颂歌',
    eventType: 'common',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '指定一个友方单位为目标。\n持续：你可以将单位召唤到目标相邻的区格。每当且仅当你将一个单位召唤到目标相邻的区格时，将目标充能。',
    deckSymbols: [DECK_SYMBOLS.STAR, DECK_SYMBOLS.RHOMBUS], // ✧🔶 (图片确认)
    spriteIndex: SPRITE_INDEX_BARBARIC.EVENT_CHANT_OF_WEAVING,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 建筑卡（来自 hero.png，索引 1）
// ============================================================================

export const STRUCTURE_CARDS_BARBARIC: StructureCard[] = [
  {
    id: 'barbaric-starting-gate',
    cardType: 'structure',
    faction: 'barbaric',
    name: '起始城门',
    cost: 0,
    life: 10,
    isGate: true,
    isStartingGate: true,
    deckSymbols: [],
    spriteIndex: 0,  // Portal.png 帧0（10HP城门）
    spriteAtlas: 'portal',
  },
  {
    id: 'barbaric-portal',
    cardType: 'structure',
    faction: 'barbaric',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [],
    spriteIndex: 1,  // Portal.png 帧1（5HP传送门）
    spriteAtlas: 'portal',
  },
];

// ============================================================================
// 牌组生成
// ============================================================================

export function createBarbaricDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [];

  // 添加冠军单位
  deck.push(...CHAMPION_UNITS_BARBARIC);

  // 添加普通单位（各4张）
  for (const unit of COMMON_UNITS_BARBARIC) {
    for (let i = 0; i < 4; i++) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  // 添加事件卡（传奇2张，普通各2张）
  for (const event of EVENT_CARDS_BARBARIC) {
    const copies = event.eventType === 'legendary' ? 2 : 2;
    for (let i = 0; i < copies; i++) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  // 添加传送门（3张）
  for (let i = 0; i < 3; i++) {
    deck.push({ ...STRUCTURE_CARDS_BARBARIC[1], id: `barbaric-portal-${i + 1}` });
  }

  // 起始单位：边境弓箭手（▲）和 雌狮（■）
  // 位置：▲=row 2,col 3; ■=row 2,col 2; Gate=row 1,col 3; Summoner=row 0,col 3

  const archer = COMMON_UNITS_BARBARIC.find(u => u.id === 'barbaric-frontier-archer')!;
  const lioness = COMMON_UNITS_BARBARIC.find(u => u.id === 'barbaric-lioness')!;

  return {
    summoner: SUMMONER_BARBARIC,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...archer, id: 'barbaric-start-archer' }, position: { row: 2, col: 3 } },  // ▲ 边境弓箭手
      { unit: { ...lioness, id: 'barbaric-start-lioness' }, position: { row: 2, col: 2 } },  // ■ 雌狮
    ],
    startingGate: { ...STRUCTURE_CARDS_BARBARIC[0], id: `${STRUCTURE_CARDS_BARBARIC[0].id}-0` },
    startingGatePosition: { row: 1, col: 3 },
    deck,
  };
}
