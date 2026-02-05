/**
 * 召唤师战争 - 先锋军团派系 (Vanguard / Paladin)
 * 
 * 基于实际卡牌图片配置
 * 精灵图集: public/assets/summonerwars/hero/Paladin/cards.png
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
export const SPRITE_INDEX_PALADIN = {
  // 冠军单位
  CHAMPION_VALENTINA: 0,      // 瓦伦蒂娜·斯托哈特
  CHAMPION_JACOB: 3,          // 雅各布·艾德温
  CHAMPION_CORIN: 6,          // 科琳·布莱顿

  // 士兵单位
  COMMON_TEMPLE_PRIEST: 1,    // 圣殿牧师
  COMMON_FORTRESS_WARRIOR: 4, // 城塞圣武士
  COMMON_FORTRESS_KNIGHT: 5,  // 城塞骑士
  COMMON_FORTRESS_ARCHER: 7,  // 城塞弓箭手

  // 传奇事件
  EVENT_HOLY_JUDGMENT: 8,     // 圣洁审判

  // 普通事件
  EVENT_HOLY_PROTECTION: 2,   // 圣灵庇护
  EVENT_MASS_HEALING: 9,      // 群体治疗
  EVENT_REKINDLE_HOPE: 10,    // 重燃希望
} as const;

// ============================================================================
// 召唤师（来自 hero.png，索引 0）
// ============================================================================

export const SUMMONER_PALADIN: UnitCard = {
  id: 'paladin-summoner',
  cardType: 'unit',
  name: '瑟拉·艾德温',
  unitClass: 'summoner',
  faction: '先锋军团',
  strength: 2,
  life: 12,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['fortress_power'],
  abilityText: '城塞之力：在本单位攻击一个敌方单位之后，如果战场上有一个或更多友方城塞单位，则你可以从你的弃牌堆中拿取一张城塞单位，展示并且加入你的手牌。',
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, DECK_SYMBOLS.SHIELD, DECK_SYMBOLS.DIAMOND], // ⚔️🛡️💎（双斧 + 阵营的2种符号）
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

// ============================================================================
// 冠军单位
// ============================================================================

export const CHAMPION_UNITS_PALADIN: UnitCard[] = [
  // 瓦伦蒂娜·斯托哈特 - 冠军单位
  {
    id: 'paladin-valentina',
    cardType: 'unit',
    name: '瓦伦蒂娜·斯托哈特',
    unitClass: 'champion',
    faction: '先锋军团',
    strength: 2,
    life: 9,
    cost: 6,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['guidance', 'fortress_elite'],
    abilityText: '指引：在你的召唤阶段开始时，抓取两张卡牌。\n城塞精锐：本单位2个区格以内每有一个友方城塞单位，则获得战力+1。',
    deckSymbols: [DECK_SYMBOLS.SHIELD, DECK_SYMBOLS.DIAMOND], // 🛡️💎
    spriteIndex: SPRITE_INDEX_PALADIN.CHAMPION_VALENTINA,
    spriteAtlas: 'cards',
  },
  // 雅各布·艾德温 - 冠军单位
  {
    id: 'paladin-jacob',
    cardType: 'unit',
    name: '雅各布·艾德温',
    unitClass: 'champion',
    faction: '先锋军团',
    strength: 2,
    life: 6,
    cost: 5,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['radiant_shot'],
    abilityText: '辉光射击：你每拥有2点魔力，则本单位获得战力+1。',
    deckSymbols: [DECK_SYMBOLS.DIAMOND], // 💎
    spriteIndex: SPRITE_INDEX_PALADIN.CHAMPION_JACOB,
    spriteAtlas: 'cards',
  },
  // 科琳·布莱顿 - 冠军单位
  {
    id: 'paladin-corin',
    cardType: 'unit',
    name: '科琳·布莱顿',
    unitClass: 'champion',
    faction: '先锋军团',
    strength: 3,
    life: 8,
    cost: 6,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['divine_shield'],
    abilityText: '神圣护盾：每当本单位3个区格以内的一个友方城塞单位成为攻击的目标时，投掷2个骰子。每掷出一个❤️，则攻击单位在本次攻击的战力-1，战力最少为1点。',
    deckSymbols: [DECK_SYMBOLS.SHIELD], // 🛡️ (Step 153图片确认：单符号)
    spriteIndex: SPRITE_INDEX_PALADIN.CHAMPION_CORIN,
    spriteAtlas: 'cards',
  },
];


// ============================================================================
// 普通单位（士兵）
// ============================================================================

export const COMMON_UNITS_PALADIN: UnitCard[] = [
  // 圣殿牧师 - 士兵单位
  {
    id: 'paladin-temple-priest',
    cardType: 'unit',
    name: '圣殿牧师',
    unitClass: 'common',
    faction: '先锋军团',
    strength: 2,
    life: 2,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['healing'],
    abilityText: '治疗：在本单位攻击一个友方士兵或英雄之前，你可以从你的手牌弃除一张卡牌。如果你这样做，则本次攻击掷出的每个⚔️或❤️会从目标上移除1点伤害，以代替造成伤害。',
    deckSymbols: [DECK_SYMBOLS.SHIELD], // 🛡️ (图片确认：单符号)
    spriteIndex: SPRITE_INDEX_PALADIN.COMMON_TEMPLE_PRIEST,
    spriteAtlas: 'cards',
  },
  // 城塞圣武士 - 士兵单位
  {
    id: 'paladin-fortress-warrior',
    cardType: 'unit',
    name: '城塞圣武士',
    unitClass: 'common',
    faction: '先锋军团',
    strength: 3,
    life: 4,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['judgment'],
    abilityText: '裁决：在本单位攻击一个敌方单位之后，抓取数量等于所掷出❤️数量的卡牌。',
    deckSymbols: [DECK_SYMBOLS.DIAMOND], // 💎 (图片确认：单符号)
    spriteIndex: SPRITE_INDEX_PALADIN.COMMON_FORTRESS_WARRIOR,
    spriteAtlas: 'cards',
  },
  // 城塞骑士 - 士兵单位
  {
    id: 'paladin-fortress-knight',
    cardType: 'unit',
    name: '城塞骑士',
    unitClass: 'common',
    faction: '先锋军团',
    strength: 2,
    life: 5,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['entangle', 'guardian'],
    abilityText: '缠斗：每当一个相邻敌方单位因为移动或被推拉而远离本单位时，立刻对该单位造成1点伤害。\n守卫：当一个相邻敌方单位攻击时，必须指定一个具有守卫技能的单位为目标。',
    deckSymbols: [DECK_SYMBOLS.SHIELD], // 🛡️ (图片确认)
    spriteIndex: SPRITE_INDEX_PALADIN.COMMON_FORTRESS_KNIGHT,
    spriteAtlas: 'cards',
  },
  // 城塞弓箭手 - 士兵单位
  {
    id: 'paladin-fortress-archer',
    cardType: 'unit',
    name: '城塞弓箭手',
    unitClass: 'common',
    faction: '先锋军团',
    strength: 1,
    life: 5,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['holy_arrow'],
    abilityText: '圣光箭：在本单位攻击之前，从你的手牌展示并弃除任意数量的非同名单位。每以此法弃除一张卡牌，则获得1点魔力并且本单位在本次攻击获得战力+1。',
    deckSymbols: [DECK_SYMBOLS.DIAMOND], // 💎 (图片确认：单符号)
    spriteIndex: SPRITE_INDEX_PALADIN.COMMON_FORTRESS_ARCHER,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 事件卡
// ============================================================================

export const EVENT_CARDS_PALADIN: EventCard[] = [
  // 圣洁审判 - 传奇事件
  {
    id: 'paladin-holy-judgment',
    cardType: 'event',
    name: '圣洁审判',
    eventType: 'legendary',
    playPhase: 'attack',
    cost: 0,
    isActive: true,
    effect: '将2点充能放置到本事件上。\n持续：友方士兵获得战力+1。\n在你的回合开始时，你可以消耗1点充能，以代替弃除本事件。每当一个友方单位被消灭时，从本事件上移除1点充能。',
    deckSymbols: [],
    spriteIndex: SPRITE_INDEX_PALADIN.EVENT_HOLY_JUDGMENT,
    spriteAtlas: 'cards',
  },
  // 圣灵庇护 - 普通事件
  {
    id: 'paladin-holy-protection',
    cardType: 'event',
    name: '圣灵庇护',
    eventType: 'common',
    playPhase: 'magic',
    cost: 0,
    isActive: true,
    effect: '持续：你的召唤师3个区格以内的友方士兵获得以下技能：\n庇护：当本单位在一个回合中第一次被攻击时，该攻击造成的伤害至多为1点。',
    deckSymbols: [DECK_SYMBOLS.SHIELD, DECK_SYMBOLS.DIAMOND], // 图片确认：双符号
    spriteIndex: SPRITE_INDEX_PALADIN.EVENT_HOLY_PROTECTION,
    spriteAtlas: 'cards',
  },
  // 群体治疗 - 普通事件
  {
    id: 'paladin-mass-healing',
    cardType: 'event',
    name: '群体治疗',
    eventType: 'common',
    playPhase: 'move',
    cost: 1,
    isActive: false,
    effect: '从你的召唤师2个区格以内的每个友方士兵和英雄上移除2点伤害。',
    deckSymbols: [DECK_SYMBOLS.SHIELD, DECK_SYMBOLS.DIAMOND], // 图片确认：双符号
    spriteIndex: SPRITE_INDEX_PALADIN.EVENT_MASS_HEALING,
    spriteAtlas: 'cards',
  },
  // 重燃希望 - 普通事件
  {
    id: 'paladin-rekindle-hope',
    cardType: 'event',
    name: '重燃希望',
    eventType: 'common',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '持续：你可以在你的回合中任意阶段召唤单位。你可以将单位召唤到你的召唤师相邻的区格。',
    deckSymbols: [DECK_SYMBOLS.SHIELD, DECK_SYMBOLS.DIAMOND], // 图片确认：双符号
    spriteIndex: SPRITE_INDEX_PALADIN.EVENT_REKINDLE_HOPE,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 建筑卡（来自 hero.png，索引 1）
// ============================================================================

export const STRUCTURE_CARDS_PALADIN: StructureCard[] = [
  {
    id: 'paladin-starting-gate',
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
  {
    id: 'paladin-portal',
    cardType: 'structure',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [],
    spriteIndex: 1,
    spriteAtlas: 'hero',
  },
];

// ============================================================================
// 牌组生成
// ============================================================================

export function createPaladinDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [];

  deck.push(...CHAMPION_UNITS_PALADIN);

  for (const unit of COMMON_UNITS_PALADIN) {
    for (let i = 0; i < 4; i++) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  for (const event of EVENT_CARDS_PALADIN) {
    const copies = event.eventType === 'legendary' ? 2 : 2;
    for (let i = 0; i < copies; i++) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  for (let i = 0; i < 3; i++) {
    deck.push({ ...STRUCTURE_CARDS_PALADIN[1], id: `paladin-portal-${i + 1}` });
  }

  // 起始单位：圣殿牧师（■）和 城塞弓箭手（▲）
  // 
  // ┌─────────────────────────────────────────────────────────────────┐
  // │ 坐标系：【左下角原点】（玩家0视角）                              │
  // │   - row: 从下往上数（0=最底行，7=最顶行）                        │
  // │   - col: 从左往右数（0=最左，5=最右）                            │
  // │                                                                 │
  // │ 棋盘示意图（8行×6列）- 先锋军团起始布局：                        │
  // │                                                                 │
  // │   col:  0   1   2   3   4   5                                   │
  // │       ┌───┬───┬───┬───┬───┬───┐                                 │
  // │  row 7│   │   │   │   │   │   │  ← 对方后排                     │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │   ... │   │   │   │   │   │   │                                 │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 3│   │   │ ■ │   │   │   │  ← 圣殿牧师                     │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 2│   │   │   │ 门 │ ▲ │   │  ← 城门、城塞弓箭手            │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 1│   │   │   │   │   │   │  ← 空                           │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 0│   │   │   │ 召│   │   │  ← 召唤师（我方后排）           │
  // │       └───┴───┴───┴───┴───┴───┘                                 │
  // └─────────────────────────────────────────────────────────────────┘
  //
  // 根据召唤师卡背面图片（tip.png）：
  //   - 召唤师：row 0, col 3
  //   - 城门：row 2, col 3
  //   - 圣殿牧师(■)：row 3, col 2
  //   - 城塞弓箭手(▲)：row 2, col 4
  const templePriest = COMMON_UNITS_PALADIN.find(u => u.id === 'paladin-temple-priest')!;
  const fortressArcher = COMMON_UNITS_PALADIN.find(u => u.id === 'paladin-fortress-archer')!;

  return {
    summoner: SUMMONER_PALADIN,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...templePriest, id: 'paladin-start-priest' }, position: { row: 3, col: 2 } },      // ■
      { unit: { ...fortressArcher, id: 'paladin-start-archer' }, position: { row: 2, col: 4 } },   // ▲
    ],
    startingGate: { ...STRUCTURE_CARDS_PALADIN[0], id: 'paladin-start-gate' },
    startingGatePosition: { row: 2, col: 3 },
    deck,
  };
}
