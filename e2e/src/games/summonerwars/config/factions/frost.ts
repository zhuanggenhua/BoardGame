/**
 * 召唤师战争 - 极地矮人派系 (Frost Dwarves / Frost)
 * 
 * 基于实际卡牌图片配置
 * 精灵图集: public/assets/summonerwars/hero/Frost/cards.png
 */

import type { UnitCard, EventCard, StructureCard, CellCoord } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

// ============================================================================
// 精灵图索引映射
// ============================================================================

/** 
 * cards.png 精灵图索引（从左到右、从上到下）
 * hero.png: 0=召唤师, 1=传送门
 */
// ============================================================================
// 精灵图索引映射
// ============================================================================

/** 
 * cards.png 精灵图索引（从左到右、从上到下）
 * hero.png: 0=召唤师, 1=传送门, 2=冰霜法师
 */
export const SPRITE_INDEX_FROST = {
  // cards.png 索引
  COMMON_FROST_MAGE: 0,       // 冰霜法师（虽然hero.png也有，但cards.png里是完整版）
  COMMON_BEAR_CAVALRY: 1,     // 熊骑兵
  CHAMPION_OLEG: 2,           // 奥莱格
  EVENT_ICE_RAM: 3,           // 寒冰冲撞
  EVENT_GLACIAL_SHIFT: 4,     // 冰川位移
  COMMON_ICE_SMITH: 5,        // 寒冰锻造师
  COMMON_ICE_GOLEM: 6,        // 寒冰魔像
  EVENT_ICE_REPAIR: 7,        // 寒冰修补
  STRUCTURE_PARAPET: 8,       // 护城墙（作为建筑卡）
  CHAMPION_JARMUND: 9,        // 贾穆德
  CHAMPION_NATIANA: 10,       // 纳蒂亚娜
} as const;

// ============================================================================
// 召唤师（来自 hero.png，索引 0）
// ============================================================================

export const SUMMONER_FROST: UnitCard = {
  id: 'frost-summoner',
  cardType: 'unit',
  name: '丝瓦拉',
  unitClass: 'summoner',
  faction: 'frost',
  strength: 3, // 图片确认
  life: 12,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['structure_shift'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, DECK_SYMBOLS.SNOWFLAKE, DECK_SYMBOLS.DROPLET], // 
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

// ============================================================================
// 冠军单位
// ============================================================================

export const CHAMPION_UNITS_FROST: UnitCard[] = [
  {
    id: 'frost-oleg',
    cardType: 'unit',
    name: '奥莱格',
    unitClass: 'champion',
    faction: 'frost',
    strength: 3,
    life: 7,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['cold_snap'],
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE], // 
    spriteIndex: SPRITE_INDEX_FROST.CHAMPION_OLEG,
    spriteAtlas: 'cards',
  },
  {
    id: 'frost-jarmund',
    cardType: 'unit',
    name: '贾穆德',
    unitClass: 'champion',
    faction: 'frost',
    strength: 3,
    life: 7,
    cost: 5,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['imposing', 'ice_shards'],
    deckSymbols: [DECK_SYMBOLS.DROPLET, DECK_SYMBOLS.SNOWFLAKE], // 
    spriteIndex: SPRITE_INDEX_FROST.CHAMPION_JARMUND,
    spriteAtlas: 'cards',
  },
  {
    id: 'frost-natiana',
    cardType: 'unit',
    name: '纳蒂亚娜',
    unitClass: 'champion',
    faction: 'frost',
    strength: 2,
    life: 7,
    cost: 6,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['greater_frost_bolt'],
    deckSymbols: [DECK_SYMBOLS.DROPLET], // 
    spriteIndex: SPRITE_INDEX_FROST.CHAMPION_NATIANA,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 普通单位（士兵）
// ============================================================================

export const COMMON_UNITS_FROST: UnitCard[] = [
  // 冰霜法师
  {
    id: 'frost-mage',
    cardType: 'unit',
    name: '冰霜法师',
    unitClass: 'common',
    faction: 'frost',
    strength: 1,
    life: 4,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['frost_bolt'],
    deckSymbols: [DECK_SYMBOLS.DROPLET], // 
    spriteIndex: SPRITE_INDEX_FROST.COMMON_FROST_MAGE,
    spriteAtlas: 'cards',
  },
  // 熊骑兵
  {
    id: 'frost-bear-cavalry',
    cardType: 'unit',
    name: '熊骑兵',
    unitClass: 'common',
    faction: 'frost',
    strength: 3,
    life: 5,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['trample'],
    deckSymbols: [DECK_SYMBOLS.DROPLET], // 
    spriteIndex: SPRITE_INDEX_FROST.COMMON_BEAR_CAVALRY,
    spriteAtlas: 'cards',
  },
  // 寒冰锻造师
  {
    id: 'frost-ice-smith',
    cardType: 'unit',
    name: '寒冰锻造师',
    unitClass: 'common',
    faction: 'frost',
    strength: 2,
    life: 2,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['frost_axe'],
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE], // 
    spriteIndex: SPRITE_INDEX_FROST.COMMON_ICE_SMITH,
    spriteAtlas: 'cards',
  },
  // 寒冰魔像（同时是建筑和单位）
  {
    id: 'frost-ice-golem',
    cardType: 'unit',
    name: '寒冰魔像',
    unitClass: 'common',
    faction: 'frost',
    strength: 2,
    life: 5,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['living_gate', 'mobile_structure', 'slow'],
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE], // 
    spriteIndex: SPRITE_INDEX_FROST.COMMON_ICE_GOLEM,
    spriteAtlas: 'cards',
    // isStructure: true, // 移除：由技能处理
  },
];

// ============================================================================
// 事件卡
// ============================================================================

export const EVENT_CARDS_FROST: EventCard[] = [
  // 寒冰冲撞 - 传奇事件
  {
    id: 'frost-ice-ram',
    cardType: 'event',
    faction: 'frost',
    name: '寒冰冲撞',
    eventType: 'legendary',
    cost: 0,
    playPhase: 'summon',
    effect: '持续：在一个友方建筑移动或被推拉之后，你可以指定其相邻的一个单位为目标。对目标造成1点伤害。你可以将目标推拉1个区格。',
    isActive: true,
    deckSymbols: [],
    spriteIndex: SPRITE_INDEX_FROST.EVENT_ICE_RAM,
    spriteAtlas: 'cards',
  },
  // 冰川位移 - 普通事件
  {
    id: 'frost-glacial-shift',
    cardType: 'event',
    faction: 'frost',
    name: '冰川位移',
    eventType: 'common',
    cost: 0,
    playPhase: 'build',
    effect: '指定你的召唤师3个区格以内至多三个友方建筑为目标。将每个目标推拉1至2个区格。',
    deckSymbols: [DECK_SYMBOLS.DROPLET], // 💧
    spriteIndex: SPRITE_INDEX_FROST.EVENT_GLACIAL_SHIFT,
    spriteAtlas: 'cards',
  },
  // 寒冰修补 - 普通事件
  {
    id: 'frost-ice-repair',
    cardType: 'event',
    faction: 'frost',
    name: '寒冰修补',
    eventType: 'common',
    cost: 0,
    playPhase: 'move',
    effect: '从每个友方建筑上移除2点伤害。',
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE, DECK_SYMBOLS.DROPLET], // ❄️💧
    spriteIndex: SPRITE_INDEX_FROST.EVENT_ICE_REPAIR,
    spriteAtlas: 'cards',
  },
  // 护城墙 - 普通事件（建筑类型）
  {
    id: 'frost-parapet',
    cardType: 'event',
    faction: 'frost',
    name: '护城墙',
    eventType: 'common',
    cost: 0,
    playPhase: 'build',
    effect: '友方单位的攻击可以穿过本卡牌。',
    isActive: true,
    life: 5, // 作为建筑类事件卡，有生命值
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE], // ❄️
    spriteIndex: SPRITE_INDEX_FROST.STRUCTURE_PARAPET,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 建筑卡
// ============================================================================

export const STRUCTURE_CARDS_FROST: StructureCard[] = [
  // 起始城门
  {
    id: 'frost-starting-gate',
    cardType: 'structure',
    faction: 'frost',
    name: '起始城门',
    cost: 0,
    life: 10,
    isGate: true,
    isStartingGate: true,
    deckSymbols: [],
    spriteIndex: 0,  // Portal.png 帧0（10HP城门）
    spriteAtlas: 'portal',
  },
  // 传送门
  {
    id: 'frost-portal',
    cardType: 'structure',
    faction: 'frost',
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

/** 生成极地矮人完整牌组 */
export function createFrostDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [];

  // 添加冠军单位
  deck.push(...CHAMPION_UNITS_FROST);

  // 添加普通单位（各4张）
  for (const unit of COMMON_UNITS_FROST) {
    for (let i = 0; i < 4; i++) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  // 添加事件卡（传奇2张，普通各2张）
  for (const event of EVENT_CARDS_FROST) {
    const copies = event.eventType === 'legendary' ? 2 : 2;
    for (let i = 0; i < copies; i++) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  // 添加传送门（3张）
  for (let i = 0; i < 3; i++) {
    deck.push({ ...STRUCTURE_CARDS_FROST[1], id: `frost-portal-${i + 1}` });
  }

  // 起始单位
  const frostMage = COMMON_UNITS_FROST.find(u => u.id === 'frost-mage')!;
  const iceGolem = COMMON_UNITS_FROST.find(u => u.id === 'frost-ice-golem')!;

  return {
    summoner: SUMMONER_FROST,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...frostMage, id: 'frost-start-mage' }, position: { row: 2, col: 2 } },
      { unit: { ...iceGolem, id: 'frost-start-golem' }, position: { row: 1, col: 2 } },
    ],
    startingGate: { ...STRUCTURE_CARDS_FROST[0], id: `${STRUCTURE_CARDS_FROST[0].id}-0` },
    startingGatePosition: { row: 2, col: 3 },
    deck,
  };
}
