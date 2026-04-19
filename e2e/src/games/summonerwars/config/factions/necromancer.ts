/**
 * 召唤师战争 - 堕落王国派系 (Fallen Kingdom / Necromancer)
 * 
 * 基于实际卡牌图片配置
 * 精灵图集: public/assets/summonerwars/hero/Necromancer/cards.png
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
export const SPRITE_INDEX = {
  // 冠军单位
  CHAMPION_ELUT_BAR: 0,      // 伊路特-巴尔
  CHAMPION_DRAGOS: 2,        // 德拉戈斯
  CHAMPION_GUL_DAS: 10,      // 古尔-达斯

  // 传奇事件
  EVENT_FUNERAL_PYRE: 1,     // 殉葬火堆

  // 普通事件
  EVENT_HELLFIRE_BLADE: 3,   // 狱火铸剑
  EVENT_ANNIHILATE: 4,       // 除灭
  EVENT_BLOOD_SUMMON: 5,     // 血契召唤

  // 士兵单位
  COMMON_UNDEAD_WARRIOR: 6,  // 亡灵战士
  COMMON_HELLFIRE_CULTIST: 7, // 地狱火教徒
  COMMON_PLAGUE_ZOMBIE: 8,   // 亡灵疫病体
  COMMON_UNDEAD_ARCHER: 9,   // 亡灵弓箭手

  // 后续卡牌索引（待补充）
  // 11, 12, 13...
} as const;

// ============================================================================
// 召唤师（来自 hero.png，索引 0）
// ============================================================================

export const SUMMONER_NECROMANCER: UnitCard = {
  id: 'necro-summoner',
  cardType: 'unit',
  name: '瑞特-塔鲁斯',
  unitClass: 'summoner',
  faction: 'necromancer',
  strength: 2,
  life: 12,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['revive_undead'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, DECK_SYMBOLS.FLAME, DECK_SYMBOLS.MOON], // ⚔️🔥🌙（双斧 + 阵营的2种符号）
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

// ============================================================================
// 冠军单位
// ============================================================================

export const CHAMPION_UNITS: UnitCard[] = [
  {
    id: 'necro-elut-bar',
    cardType: 'unit',
    name: '伊路特-巴尔',
    unitClass: 'champion',
    faction: 'necromancer',
    strength: 6,
    life: 6,
    cost: 6,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['fire_sacrifice_summon'],
    deckSymbols: [DECK_SYMBOLS.FLAME], // 🔥 (图片确认)
    spriteIndex: SPRITE_INDEX.CHAMPION_ELUT_BAR,
  },
  {
    id: 'necro-dragos',
    cardType: 'unit',
    name: '德拉戈斯',
    unitClass: 'champion',
    faction: 'necromancer',
    strength: 4,
    life: 8,
    cost: 6,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['life_drain'],
    deckSymbols: [DECK_SYMBOLS.MOON], // 🌙 (图片确认)
    spriteIndex: SPRITE_INDEX.CHAMPION_DRAGOS,
  },
  {
    id: 'necro-gul-das',
    cardType: 'unit',
    name: '古尔-达斯',
    unitClass: 'champion',
    faction: 'necromancer',
    strength: 2,
    life: 8,
    cost: 6,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['rage'],
    deckSymbols: [DECK_SYMBOLS.FLAME, DECK_SYMBOLS.MOON], // 🔥🌙 (图片确认)
    spriteIndex: SPRITE_INDEX.CHAMPION_GUL_DAS,
  },
];

// ============================================================================
// 普通单位（士兵）
// ============================================================================

export const COMMON_UNITS: UnitCard[] = [
  {
    id: 'necro-undead-warrior',
    cardType: 'unit',
    name: '亡灵战士',
    unitClass: 'common',
    faction: 'necromancer',
    strength: 2,
    life: 4,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'],
    deckSymbols: [DECK_SYMBOLS.MOON], // 🌙 (图片确认)
    spriteIndex: SPRITE_INDEX.COMMON_UNDEAD_WARRIOR,
  },
  {
    id: 'necro-hellfire-cultist',
    cardType: 'unit',
    name: '地狱火教徒',
    unitClass: 'common',
    faction: 'necromancer',
    strength: 2,
    life: 2,
    cost: 0,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['sacrifice'],
    deckSymbols: [DECK_SYMBOLS.FLAME], // 🔥 (图片确认)
    spriteIndex: SPRITE_INDEX.COMMON_HELLFIRE_CULTIST,
  },
  {
    id: 'necro-plague-zombie',
    cardType: 'unit',
    name: '亡灵疫病体',
    unitClass: 'common',
    faction: 'necromancer',
    strength: 2,
    life: 3,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['soulless', 'infection'],
    deckSymbols: [DECK_SYMBOLS.MOON], // 🌙 (图片确认)
    spriteIndex: SPRITE_INDEX.COMMON_PLAGUE_ZOMBIE,
  },
  {
    id: 'necro-undead-archer',
    cardType: 'unit',
    name: '亡灵弓箭手',
    unitClass: 'common',
    faction: 'necromancer',
    strength: 3,
    life: 2,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['soul_transfer'],
    deckSymbols: [DECK_SYMBOLS.FLAME], // 🔥 (图片确认)
    spriteIndex: SPRITE_INDEX.COMMON_UNDEAD_ARCHER,
  },
];

// ============================================================================
// 事件卡
// ============================================================================

export const EVENT_CARDS: EventCard[] = [
  // 传奇事件（传奇事件无牌组符号）
  {
    id: 'necro-funeral-pyre',
    cardType: 'event',
    faction: 'necromancer',
    name: '殉葬火堆',
    eventType: 'legendary',
    cost: 1,
    playPhase: 'summon',
    effect: '持续：每当一个单位被消灭时，对本事件充能。当本事件被弃除时，指定一个单位为目标。本事件每有1点充能，则从目标上移除1点伤害。',
    isActive: true, // 持续效果（ACTIVE 关键词）
    deckSymbols: [], // 传奇事件无符号
    spriteIndex: SPRITE_INDEX.EVENT_FUNERAL_PYRE,
  },
  // 普通事件
  {
    id: 'necro-hellfire-blade',
    cardType: 'event',
    faction: 'necromancer',
    name: '狱火铸剑',
    eventType: 'common',
    cost: 0,
    playPhase: 'build',
    effect: '将本事件放置到一个友方士兵的底层。该单位获得战斗力+2和以下技能：\n诅咒：在本单位攻击之后，对其造成点数等于所掷出特殊标记数量的伤害。',
    deckSymbols: [DECK_SYMBOLS.FLAME], // 🔥 (图片确认)
    spriteIndex: SPRITE_INDEX.EVENT_HELLFIRE_BLADE,
  },
  {
    id: 'necro-annihilate',
    cardType: 'event',
    faction: 'necromancer',
    name: '除灭',
    eventType: 'common',
    cost: 0,
    playPhase: 'move',  // 移动阶段
    effect: '指定任意数量的友方单位为目标。对于每个目标，你可以对其相邻的一个单位造成2点伤害。消灭所有目标。',
    deckSymbols: [DECK_SYMBOLS.FLAME, DECK_SYMBOLS.MOON], // 🔥🌙 (图片确认)
    spriteIndex: SPRITE_INDEX.EVENT_ANNIHILATE,
  },
  {
    id: 'necro-blood-summon',
    cardType: 'event',
    faction: 'necromancer',
    name: '血契召唤',
    eventType: 'common',
    cost: 0,
    playPhase: 'summon',
    effect: '结算以下效果任意次数：指定一个友方单位为目标。从你的手牌选择一个费用为2点或更低的单位，放置到目标相邻的区格。对目标造成2点伤害。',
    deckSymbols: [DECK_SYMBOLS.MOON], // 🌙 (图片确认)
    spriteIndex: SPRITE_INDEX.EVENT_BLOOD_SUMMON,
  },
];

// ============================================================================
// 建筑卡（来自 hero.png，索引 1）
// ============================================================================

export const STRUCTURE_CARDS: StructureCard[] = [
  // 起始城门（10生命）
  {
    id: 'necro-starting-gate',
    cardType: 'structure',
    faction: 'necromancer',
    name: '起始城门',
    cost: 0,
    life: 10,
    isGate: true,
    isStartingGate: true,
    deckSymbols: [], // 起始建筑，无需符号
    spriteIndex: 0,  // Portal.png 帧0（10HP城门）
    spriteAtlas: 'portal',
  },
  // 传送门（5生命，0费用）
  {
    id: 'necro-portal',
    cardType: 'structure',
    faction: 'necromancer',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [], // 传送门通常无需符号（或与召唤师符号匹配）
    spriteIndex: 1,  // Portal.png 帧1（5HP传送门）
    spriteAtlas: 'portal',
  },
];

// ============================================================================
// 牌组生成
// ============================================================================

/** 生成堕落王国完整牌组 */
export function createNecromancerDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [];

  // 添加冠军单位（各1张）
  deck.push(...CHAMPION_UNITS);

  // 添加普通单位（各4张）
  for (const unit of COMMON_UNITS) {
    for (let i = 0; i < 4; i++) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  // 添加事件卡（传奇2张，普通各2张）
  for (const event of EVENT_CARDS) {
    const copies = event.eventType === 'legendary' ? 2 : 2;  // 殉葬火堆 x2
    for (let i = 0; i < copies; i++) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  // 添加传送门（3张，使用索引1的传送门）
  for (let i = 0; i < 3; i++) {
    deck.push({ ...STRUCTURE_CARDS[1], id: `necro-portal-${i + 1}` });
  }

  // 起始单位：亡灵弓箭手（▲）和 亡灵疫病体（■）
  // 
  // ┌─────────────────────────────────────────────────────────────────┐
  // │ 坐标系：【左下角原点】（玩家0视角）                              │
  // │   - row: 从下往上数（0=最底行，7=最顶行）                        │
  // │   - col: 从左往右数（0=最左，5=最右）                            │
  // │                                                                 │
  // │ 棋盘示意图（8行×6列）：                                         │
  // │                                                                 │
  // │   col:  0   1   2   3   4   5                                   │
  // │       ┌───┬───┬───┬───┬───┬───┐                                 │
  // │  row 7│   │   │   │   │   │   │  ← 对方后排                     │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 6│   │   │   │   │   │   │                                 │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 5│   │   │   │   │   │   │                                 │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 4│   │   │   │   │   │   │                                 │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 3│   │   │   │ ■ │   │   │  ← 疫病体                       │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 2│   │   │ ▲ │ 门 │   │   │  ← 弓箭手、城门                │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 1│   │   │   │   │   │   │                                 │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 0│   │   │   │ 召│   │   │  ← 召唤师（我方后排）           │
  // │       └───┴───┴───┴───┴───┴───┘                                 │
  // └─────────────────────────────────────────────────────────────────┘
  //
  // 根据召唤师卡背面图片：
  //   - 召唤师：row 0, col 3
  //   - 起始城门：row 2, col 3（与召唤师同列）
  //   - 亡灵弓箭手(▲)：row 2, col 2
  //   - 亡灵疫病体(■)：row 3, col 3
  const undeadArcher = COMMON_UNITS.find(u => u.id === 'necro-undead-archer')!;
  const plagueZombie = COMMON_UNITS.find(u => u.id === 'necro-plague-zombie')!;

  return {
    summoner: SUMMONER_NECROMANCER,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...undeadArcher, id: 'necro-start-archer' }, position: { row: 2, col: 2 } },
      { unit: { ...plagueZombie, id: 'necro-start-zombie' }, position: { row: 3, col: 3 } },
    ],
    startingGate: { ...STRUCTURE_CARDS[0], id: `${STRUCTURE_CARDS[0].id}-0` },
    startingGatePosition: { row: 2, col: 3 },
    deck,
  };
}

/** 洗牌 */
export function shuffleDeck<T>(deck: T[], random: () => number): T[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
