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
  faction: '极地矮人',
  strength: 3, // 图片确认
  life: 12,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['structure_shift'],
  abilityText: '结构变换：在本单位移动之后，可以指定其3个区格以内一个友方建筑为目标。将目标推拉1个区格。',
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, DECK_SYMBOLS.SNOWFLAKE, DECK_SYMBOLS.DROPLET], // ⚔️❄️💧
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
    faction: '极地矮人',
    strength: 3,
    life: 7,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['cold_snap'],
    abilityText: '寒流：本单位3个区格以内的友方建筑获得生命+1。',
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE], // ❄️
    spriteIndex: SPRITE_INDEX_FROST.CHAMPION_OLEG,
    spriteAtlas: 'cards',
  },
  {
    id: 'frost-jarmund',
    cardType: 'unit',
    name: '贾穆德',
    unitClass: 'champion',
    faction: '极地矮人',
    strength: 3,
    life: 7,
    cost: 5,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['imposing', 'ice_shards'],
    abilityText: '威势：每回合一次，在本单位攻击一个敌方单位之后，将本单位充能。\n寒冰碎屑：在你的建造阶段结束时，你可以消耗1点充能，以对每个和你所控制建筑相邻的敌方单位造成1点伤害。',
    deckSymbols: [DECK_SYMBOLS.DROPLET, DECK_SYMBOLS.SNOWFLAKE], // 💧❄️
    spriteIndex: SPRITE_INDEX_FROST.CHAMPION_JARMUND,
    spriteAtlas: 'cards',
  },
  {
    id: 'frost-natiana',
    cardType: 'unit',
    name: '纳蒂亚娜',
    unitClass: 'champion',
    faction: '极地矮人',
    strength: 2,
    life: 7,
    cost: 6,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['greater_frost_bolt'],
    abilityText: '高阶冰霜飞弹：本单位2个区格以内每有一个友方建筑，则获得战力+1。',
    deckSymbols: [DECK_SYMBOLS.DROPLET], // 💧 (图片确认)
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
    faction: '极地矮人',
    strength: 1,
    life: 4,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['frost_bolt'],
    abilityText: '冰霜飞弹：本单位相邻每有一个友方建筑，则获得战力+1。',
    deckSymbols: [DECK_SYMBOLS.DROPLET], // 💧 (图片确认)
    spriteIndex: SPRITE_INDEX_FROST.COMMON_FROST_MAGE,
    spriteAtlas: 'cards',
  },
  // 熊骑兵
  {
    id: 'frost-bear-cavalry',
    cardType: 'unit',
    name: '熊骑兵',
    unitClass: 'common',
    faction: '极地矮人',
    strength: 3,
    life: 5,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['trample'],
    abilityText: '践踏：当本单位移动时，可以穿过士兵。在本单位移动之后，对每个被穿过的士兵造成1点伤害。',
    deckSymbols: [DECK_SYMBOLS.DROPLET], // 💧 (图片确认)
    spriteIndex: SPRITE_INDEX_FROST.COMMON_BEAR_CAVALRY,
    spriteAtlas: 'cards',
  },
  // 寒冰锻造师
  {
    id: 'frost-ice-smith',
    cardType: 'unit',
    name: '寒冰锻造师',
    unitClass: 'common',
    faction: '极地矮人',
    strength: 2,
    life: 2,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['frost_axe'],
    abilityText: '冰霜战斧：在本单位移动之后，你可以将其充能，或者消耗其所有充能（至少1点）以将其放置到3个区格以内一个友方士兵的底层。当该士兵攻击时，⚔️=‼️。',
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE], // ❄️ (图片确认)
    spriteIndex: SPRITE_INDEX_FROST.COMMON_ICE_SMITH,
    spriteAtlas: 'cards',
  },
  // 寒冰魔像（同时是建筑和单位）
  {
    id: 'frost-ice-golem',
    cardType: 'unit',
    name: '寒冰魔像',
    unitClass: 'common',
    faction: '极地矮人',
    strength: 2,
    life: 5,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['living_gate', 'mobile_structure', 'slow'],
    abilityText: '活体传送门：本卡牌视为传送门。\n活体结构：本卡牌视为建筑，但可以移动。\n缓慢：本单位必须减少移动1个区格。',
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE], // ❄️ (图片确认)
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
    name: '冰川位移',
    eventType: 'common',
    cost: 0,
    playPhase: 'build',
    effect: '指定你的召唤师3个区格以内至多三个友方建筑为目标。将每个目标推拉1至2个区格。',
    deckSymbols: [DECK_SYMBOLS.DROPLET], // 💧 (图片确认)
    spriteIndex: SPRITE_INDEX_FROST.EVENT_GLACIAL_SHIFT,
    spriteAtlas: 'cards',
  },
  // 寒冰修补 - 普通事件
  {
    id: 'frost-ice-repair',
    cardType: 'event',
    name: '寒冰修补',
    eventType: 'common',
    cost: 0,
    playPhase: 'move',
    effect: '从每个友方建筑上移除2点伤害。',
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE, DECK_SYMBOLS.DROPLET], // ❄️💧 (图片确认顺序: 左雪花右水滴? Wait, let me check image 2 bottom right again. Left: Snowflake? Right: Droplet?
    // Image 2 bottom right: 寒冰修补 cost 0. Top Right Symbols: Left is Snowflake (White Hexagon). Right is Droplet (Blue Drop).
    spriteIndex: SPRITE_INDEX_FROST.EVENT_ICE_REPAIR,
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
    name: '起始城门',
    cost: 0,
    life: 10,
    isGate: true,
    isStartingGate: true,
    deckSymbols: [],
    spriteIndex: 1,
    spriteAtlas: 'hero',
  },
  // 传送门
  {
    id: 'frost-portal',
    cardType: 'structure',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [],
    spriteIndex: 1,
    spriteAtlas: 'hero',
  },
  // 护城墙（作为建筑卡，在牌组中）
  {
    id: 'frost-parapet',
    cardType: 'structure',
    name: '护城墙',
    cost: 0,
    life: 5,
    isGate: false,
    deckSymbols: [DECK_SYMBOLS.SNOWFLAKE], // ❄️ (图片确认，原为DROPLET错误)Wait, looking at Image 3 Top Left. 护城墙 (Parapet). Top Left: 0Cost. Top Right: Snowflake Symbol.
    spriteIndex: SPRITE_INDEX_FROST.STRUCTURE_PARAPET,
    spriteAtlas: 'cards',
  }
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

  // 添加护城墙（作为建筑卡混入牌组，2张）
  const parapet = STRUCTURE_CARDS_FROST.find(s => s.id === 'frost-parapet');
  if (parapet) {
    for (let i = 0; i < 2; i++) {
      deck.push({ ...parapet, id: `frost-parapet-${i}` });
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
    startingGate: { ...STRUCTURE_CARDS_FROST[0], id: 'frost-start-gate' },
    startingGatePosition: { row: 2, col: 3 },
    deck,
  };
}
