/**
 * 召唤师战争 - 洞穴地精派系 (Cave Goblins / Goblin)
 * 
 * 基于实际卡牌图片配置
 * 精灵图集: public/assets/summonerwars/hero/Goblin/cards.png
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
export const SPRITE_INDEX_GOBLIN = {
  // 冠军单位
  CHAMPION_BLARF: 1,          // 布拉夫
  CHAMPION_SMIRG: 3,          // 史米革
  CHAMPION_GLUTTON: 4,        // 巨食兽

  // 士兵单位
  COMMON_CLIMBER: 0,          // 部落攀爬手
  COMMON_BEAST_RIDER: 2,      // 野兽骑手
  COMMON_SLINGER: 5,          // 部落投石手
  COMMON_GRABBER: 10,         // 部落抓附手

  // 传奇事件
  EVENT_FRENZY: 9,            // 群情激愤

  // 普通事件
  EVENT_SNEAK: 6,             // 潜行
  EVENT_RELENTLESS: 7,        // 不屈不挠
  EVENT_SWARM: 8,             // 成群结队
} as const;

// ============================================================================
// 召唤师（来自 hero.png，索引 0）
// ============================================================================

export const SUMMONER_GOBLIN: UnitCard = {
  id: 'goblin-summoner',
  cardType: 'unit',
  name: '思尼克斯',
  unitClass: 'summoner',
  faction: 'goblin',
  strength: 3, // 卡面右下角攻击力图标显示战力
  life: 11,
  cost: 0,
  attackType: 'melee',
  attackRange: 1,
  abilities: ['vanish'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, DECK_SYMBOLS.CLAW, DECK_SYMBOLS.MASK], // ⚔️🐾🎭（双斧 + 阵营的2种符号）
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

// ============================================================================
// 冠军单位
// ============================================================================

export const CHAMPION_UNITS_GOBLIN: UnitCard[] = [
  // 布拉夫 - 冠军单位
  {
    id: 'goblin-blarf',
    cardType: 'unit',
    name: '布拉夫',
    unitClass: 'champion',
    faction: 'goblin',
    strength: 0,
    life: 6,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['blood_rune', 'power_boost'],
    deckSymbols: [DECK_SYMBOLS.CLAW, DECK_SYMBOLS.MASK], // 🐾🎭
    spriteIndex: SPRITE_INDEX_GOBLIN.CHAMPION_BLARF,
    spriteAtlas: 'cards',
  },
  // 史米革 - 冠军单位
  {
    id: 'goblin-smirg',
    cardType: 'unit',
    name: '史米革',
    unitClass: 'champion',
    faction: 'goblin',
    strength: 2,
    life: 4,
    cost: 0,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['magic_addiction', 'ferocity'],
    deckSymbols: [DECK_SYMBOLS.MASK], // 🎭
    spriteIndex: SPRITE_INDEX_GOBLIN.CHAMPION_SMIRG,
    spriteAtlas: 'cards',
  },
  // 巨食兽 - 冠军单位
  {
    id: 'goblin-glutton',
    cardType: 'unit',
    name: '巨食兽',
    unitClass: 'champion',
    faction: 'goblin',
    strength: 5,
    life: 9,
    cost: 6,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['feed_beast'],
    deckSymbols: [DECK_SYMBOLS.CLAW], // 🐾 (图片确认)
    spriteIndex: SPRITE_INDEX_GOBLIN.CHAMPION_GLUTTON,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 普通单位（士兵）
// ============================================================================

export const COMMON_UNITS_GOBLIN: UnitCard[] = [
  // 部落攀爬手 - 士兵单位
  {
    id: 'goblin-climber',
    cardType: 'unit',
    name: '部落攀爬手',
    unitClass: 'common',
    faction: 'goblin',
    strength: 1,
    life: 3,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['climb'],
    deckSymbols: [DECK_SYMBOLS.MASK], // 🎭 (图片确认)
    spriteIndex: SPRITE_INDEX_GOBLIN.COMMON_CLIMBER,
    spriteAtlas: 'cards',
  },
  // 野兽骑手 - 士兵单位
  {
    id: 'goblin-beast-rider',
    cardType: 'unit',
    name: '野兽骑手',
    unitClass: 'common',
    faction: 'goblin',
    strength: 3,
    life: 3,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['charge'],
    deckSymbols: [DECK_SYMBOLS.MASK], // 🎭
    spriteIndex: SPRITE_INDEX_GOBLIN.COMMON_BEAST_RIDER,
    spriteAtlas: 'cards',
  },
  // 部落投石手 - 士兵单位
  {
    id: 'goblin-slinger',
    cardType: 'unit',
    name: '部落投石手',
    unitClass: 'common',
    faction: 'goblin',
    strength: 2,
    life: 1,
    cost: 0,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['ferocity'],
    deckSymbols: [DECK_SYMBOLS.CLAW], // 🐾 (图片确认)
    spriteIndex: SPRITE_INDEX_GOBLIN.COMMON_SLINGER,
    spriteAtlas: 'cards',
  },
  // 部落抓附手 - 士兵单位
  {
    id: 'goblin-grabber',
    cardType: 'unit',
    name: '部落抓附手',
    unitClass: 'common',
    faction: 'goblin',
    strength: 2,
    life: 2,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['immobile', 'grab'],
    deckSymbols: [DECK_SYMBOLS.MASK], // 🎭 (图片确认)
    spriteIndex: SPRITE_INDEX_GOBLIN.COMMON_GRABBER,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 事件卡
// ============================================================================

export const EVENT_CARDS_GOBLIN: EventCard[] = [
  // 群情激愤 - 传奇事件（传奇事件无牌组符号）
  {
    id: 'goblin-frenzy',
    cardType: 'event',
    faction: 'goblin',
    name: '群情激愤',
    eventType: 'legendary',
    playPhase: 'magic', // 魔力阶段
    cost: 1,
    isActive: false,
    effect: '指定所有费用为0点的友方单位为目标。每个目标可以进行一次额外的攻击。',
    deckSymbols: [], // 传奇事件无符号
    spriteIndex: SPRITE_INDEX_GOBLIN.EVENT_FRENZY,
    spriteAtlas: 'cards',
  },
  // 潜行 - 普通事件
  {
    id: 'goblin-sneak',
    cardType: 'event',
    faction: 'goblin',
    name: '潜行',
    eventType: 'common',
    playPhase: 'move', // 移动阶段
    cost: 0,
    isActive: false,
    effect: '指定任意数量的费用为0点的友方单位为目标。将每个目标推拉1个区格。',
    deckSymbols: [DECK_SYMBOLS.MASK], // 🎭 (图片确认)
    spriteIndex: SPRITE_INDEX_GOBLIN.EVENT_SNEAK,
    spriteAtlas: 'cards',
  },
  // 不屈不挠 - 普通事件
  {
    id: 'goblin-relentless',
    cardType: 'event',
    faction: 'goblin',
    name: '不屈不挠',
    eventType: 'common',
    playPhase: 'magic', // 魔力阶段
    cost: 1,
    isActive: true, // 持续
    effect: '持续：每当一个友方士兵被消灭时，将其返回到你的手牌，以代替被消灭。',
    deckSymbols: [DECK_SYMBOLS.CLAW], // 🐾 (图片确认)
    spriteIndex: SPRITE_INDEX_GOBLIN.EVENT_RELENTLESS,
    spriteAtlas: 'cards',
  },
  // 成群结队 - 普通事件
  {
    id: 'goblin-swarm',
    cardType: 'event',
    faction: 'goblin',
    name: '成群结队',
    eventType: 'common',
    playPhase: 'attack', // 攻击阶段
    cost: 0,
    isActive: true, // 持续
    effect: '持续：友方单位获得以下技能：\n围攻：当本单位攻击时，每有一个其它友方单位和目标相邻，则获得战力+1。',
    deckSymbols: [DECK_SYMBOLS.CLAW, DECK_SYMBOLS.MASK], // 🐾🎭 (图片确认)
    spriteIndex: SPRITE_INDEX_GOBLIN.EVENT_SWARM,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 建筑卡（来自 hero.png，索引 1）
// ============================================================================

export const STRUCTURE_CARDS_GOBLIN: StructureCard[] = [
  // 起始城门（10生命）
  {
    id: 'goblin-starting-gate',
    cardType: 'structure',
    faction: 'goblin',
    name: '起始城门',
    cost: 0,
    life: 10,
    isGate: true,
    isStartingGate: true,
    deckSymbols: [],
    spriteIndex: 0,  // Portal.png 帧0（10HP城门）
    spriteAtlas: 'portal',
  },
  // 传送门（5生命，0费用）
  {
    id: 'goblin-portal',
    cardType: 'structure',
    faction: 'goblin',
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

/** 生成洞穴地精完整牌组 */
export function createGoblinDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [];

  // 添加冠军单位（各1张）
  deck.push(...CHAMPION_UNITS_GOBLIN);

  // 添加普通单位（各4张）
  for (const unit of COMMON_UNITS_GOBLIN) {
    for (let i = 0; i < 4; i++) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  // 添加事件卡（传奇2张，普通各2张）
  for (const event of EVENT_CARDS_GOBLIN) {
    const copies = event.eventType === 'legendary' ? 2 : 2;
    for (let i = 0; i < copies; i++) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  // 添加传送门（3张）
  for (let i = 0; i < 3; i++) {
    deck.push({ ...STRUCTURE_CARDS_GOBLIN[1], id: `goblin-portal-${i + 1}` });
  }

  // 起始单位：部落投石手（▲）和 野兽骑手（■）
  // 根据 tip.png 图片配置（左下角原点坐标系）
  const slinger = COMMON_UNITS_GOBLIN.find(u => u.id === 'goblin-slinger')!;
  const beastRider = COMMON_UNITS_GOBLIN.find(u => u.id === 'goblin-beast-rider')!;

  return {
    summoner: SUMMONER_GOBLIN,
    summonerPosition: { row: 0, col: 4 },  // 召唤师位置（第0排）
    startingUnits: [
      { unit: { ...slinger, id: 'goblin-start-slinger' }, position: { row: 1, col: 4 } },       // ▲ 部落投石手
      { unit: { ...beastRider, id: 'goblin-start-rider' }, position: { row: 2, col: 2 } },     // ■ 野兽骑手
    ],
    startingGate: { ...STRUCTURE_CARDS_GOBLIN[0], id: `${STRUCTURE_CARDS_GOBLIN[0].id}-0` },
    startingGatePosition: { row: 1, col: 3 },  // 起始城门位置
    deck,
  };
}
