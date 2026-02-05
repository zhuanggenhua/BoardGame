/**
 * 召唤师战争 - 欺心巫族派系 (Trickster Clan)
 * 
 * 基于实际卡牌图片配置
 * 精灵图集: public/assets/summonerwars/hero/Trickster/cards.png
 */

import type { UnitCard, EventCard, StructureCard, CellCoord } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

// ============================================================================
// 精灵图索引映射
// ============================================================================

/** 
 * cards.png 精灵图索引（从左到右、从上到下）
 * hero.png: 0=召唤师, 1=传送门
 * 
 * 待补充：根据实际图集扫描结果填写
 */
export const SPRITE_INDEX_TRICKSTER = {
  // 传奇事件
  EVENT_MIND_CONTROL: 0,     // 心灵操控

  // 冠军单位
  CHAMPION_LEILA: 1,         // 葛拉克（原名雷拉克）
  CHAMPION_KARA: 2,          // 卡拉
  CHAMPION_GULZAR: 3,        // 古尔壮

  // 士兵单位
  COMMON_WIND_ARCHER: 4,     // 清风弓箭手
  COMMON_WIND_MAGE: 5,       // 清风法师
  COMMON_MIND_WITCH: 6,      // 心灵巫女
  COMMON_TELEKINETIC: 7,     // 掷术师

  // 普通事件
  EVENT_STORM_ASSAULT: 8,    // 风暴侵袭
  EVENT_STUN: 9,             // 震慑
  EVENT_HYPNOTIC_LURE: 10,   // 催眠引诱
} as const;

// ============================================================================
// 召唤师（来自 hero.png，索引 0）
// ============================================================================

export const SUMMONER_TRICKSTER: UnitCard = {
  id: 'trickster-summoner',
  cardType: 'unit',
  name: '泰珂露',
  unitClass: 'summoner',
  faction: '欺心巫族',
  strength: 3, // 从召唤师卡图片推测
  life: 13,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['mind_capture'],
  abilityText: '心灵捕获：当本单位攻击一个敌方单位时，如果造成的伤害足够消灭目标，则你可以忽略本次伤害并且获得目标的控制权，以代替造成伤害。',
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, DECK_SYMBOLS.EYE, DECK_SYMBOLS.WAVE], // ⚔️👁️🌊（双斧 + 阵营的2种符号）
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

// ============================================================================
// 冠军单位
// ============================================================================

export const CHAMPION_UNITS_TRICKSTER: UnitCard[] = [
  {
    id: 'trickster-gelak',
    cardType: 'unit',
    name: '葛拉克',
    unitClass: 'champion',
    faction: '欺心巫族',
    strength: 3,
    life: 8,
    cost: 6,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['flying', 'aerial_strike'],
    abilityText: '飞行：当本单位移动时，可以额外移动1个区格，并且可以穿过其它卡牌。\n浮空术：本单位2个区格以内开始移动的友方士兵，在本次移动时获得飞行技能。',
    deckSymbols: [DECK_SYMBOLS.EYE, DECK_SYMBOLS.WAVE], // 👁️🌊 (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.CHAMPION_LEILA,
    spriteAtlas: 'cards',
  },
  {
    id: 'trickster-kara',
    cardType: 'unit',
    name: '卡拉',
    unitClass: 'champion',
    faction: '欺心巫族',
    strength: 4,
    life: 8,
    cost: 7,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['high_telekinesis', 'stable'],
    abilityText: '高阶念力：在本单位攻击之后，或代替本单位的攻击，可以指定其最多3个区格以内的一个士兵或英雄为目标，将目标推拉1个区格。\n稳固：本单位不能被推拉。',
    deckSymbols: [DECK_SYMBOLS.WAVE], // 🌊 (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.CHAMPION_KARA,
    spriteAtlas: 'cards',
  },
  {
    id: 'trickster-gulzhuang',
    cardType: 'unit',
    name: '古尔壮',
    unitClass: 'champion',
    faction: '欺心巫族',
    strength: 4,
    life: 6,
    cost: 6,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['mind_transmission'],
    abilityText: '读心传念：在本单位攻击一张敌方卡牌之后，可以指定本单位3个区格以内的一个友方士兵为目标，目标进行一次额外的攻击。',
    deckSymbols: [DECK_SYMBOLS.EYE], // 👁️ (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.CHAMPION_GULZAR,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 普通单位（士兵）
// ============================================================================

export const COMMON_UNITS_TRICKSTER: UnitCard[] = [
  {
    id: 'trickster-wind-archer',
    cardType: 'unit',
    name: '清风弓箭手',
    unitClass: 'common',
    faction: '欺心巫族',
    strength: 4,
    life: 2,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['swift', 'ranged'],
    abilityText: '迅捷：当本单位移动时，可以额外移动1个区格。\n远射：本单位可以攻击至多4个直线区格的目标。',
    deckSymbols: [DECK_SYMBOLS.WAVE], // 🌊 (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.COMMON_WIND_ARCHER,
  },
  {
    id: 'trickster-wind-mage',
    cardType: 'unit',
    name: '清风法师',
    unitClass: 'common',
    faction: '欺心巫族',
    strength: 2,
    life: 3,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['telekinesis'],
    abilityText: '念力：在本单位攻击之后，或代替本单位的攻击，可以指定其2个区格以内的一个士兵或英雄为目标，将目标推拉1个区格。',
    deckSymbols: [DECK_SYMBOLS.WAVE], // 🌊 (图片确认: 波浪，非眼睛)
    spriteIndex: SPRITE_INDEX_TRICKSTER.COMMON_WIND_MAGE,
    spriteAtlas: 'cards',
  },
  {
    id: 'trickster-mind-witch',
    cardType: 'unit',
    name: '心灵巫女',
    unitClass: 'common',
    faction: '欺心巫族',
    strength: 3,
    life: 2,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['illusion'],
    abilityText: '幻化：在你的移动阶段并开始时，可以指定本单位3个区格以内的一个士兵为目标。本单位获得目标的所有技能，直到回合结束。',
    deckSymbols: [DECK_SYMBOLS.EYE], // 👁️ (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.COMMON_MIND_WITCH,
  },
  {
    id: 'trickster-telekinetic',
    cardType: 'unit',
    name: '掷术师',
    unitClass: 'common',
    faction: '欺心巫族',
    strength: 1,
    life: 4,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['evasion', 'rebound'],
    abilityText: '迷魂：当一个相邻敌方单位攻击时，如果掷出一个或更多✦，则本次攻击造成的伤害减少1点。\n缠斗：每当一个相邻敌方单位因为移动或被推拉而远离本单位时，立刻对该单位造成1点伤害。',
    deckSymbols: [DECK_SYMBOLS.EYE], // 👁️ (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.COMMON_TELEKINETIC,
  },
];

// ============================================================================
// 事件卡
// ============================================================================

export const EVENT_CARDS_TRICKSTER: EventCard[] = [
  // 传奇事件
  {
    id: 'trickster-mind-control',
    cardType: 'event',
    name: '心灵操控',
    eventType: 'legendary',
    cost: 0,
    playPhase: 'summon',
    effect: '指定你的召唤师2个区格以内任意数量的敌方士兵和英雄为目标。获得所有目标的控制权，直到回合结束。',
    deckSymbols: [], // 传奇事件无标记 (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.EVENT_MIND_CONTROL,
    spriteAtlas: 'cards',
  },
  // 普通事件
  {
    id: 'trickster-storm-assault',
    cardType: 'event',
    name: '风暴侵袭',
    eventType: 'common',
    cost: 0,
    playPhase: 'magic',
    effect: '持续：单位必须减少移动1个区格。',
    isActive: true, // 持续效果（ACTIVE 关键词）
    deckSymbols: [DECK_SYMBOLS.EYE, DECK_SYMBOLS.WAVE], // 👁️🌊 (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.EVENT_STORM_ASSAULT,
  },
  {
    id: 'trickster-stun',
    cardType: 'event',
    name: '震慑',
    eventType: 'common',
    cost: 1,
    playPhase: 'move',
    effect: '指定你的召唤师3个直线视野区格以内的一个士兵或英雄为目标。将目标推拉1至3个区格，并且可以穿过士兵和英雄。对目标和每个被穿过的单位造成1点伤害。',
    deckSymbols: [DECK_SYMBOLS.WAVE], // 🌊 (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.EVENT_STUN,
  },
  {
    id: 'trickster-hypnotic-lure',
    cardType: 'event',
    name: '催眠引诱',
    eventType: 'common',
    cost: 0,
    playPhase: 'summon',
    effect: '指定一个士兵或英雄为目标。你可以将目标向你的召唤师靠近而推拉1个区格。\n持续：当你的召唤师攻击这个目标时，获得战力+1。',
    isActive: true, // 持续效果（ACTIVE 关键词）
    deckSymbols: [DECK_SYMBOLS.EYE], // 👁️ (图片确认)
    spriteIndex: SPRITE_INDEX_TRICKSTER.EVENT_HYPNOTIC_LURE,
  },
];

// ============================================================================
// 建筑卡（来自 hero.png，索引 1）
// ============================================================================

export const STRUCTURE_CARDS_TRICKSTER: StructureCard[] = [
  // 起始城门（10生命）
  {
    id: 'trickster-starting-gate',
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
  // 传送门（5生命，0费用）
  {
    id: 'trickster-portal',
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

/** 生成欺心巫族完整牌组 */
export function createTricksterDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [];

  // 添加冠军单位（各1张）
  deck.push(...CHAMPION_UNITS_TRICKSTER);

  // 添加普通单位（各4张）
  for (const unit of COMMON_UNITS_TRICKSTER) {
    for (let i = 0; i < 4; i++) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  // 添加事件卡（传奇2张，普通各2张）
  for (const event of EVENT_CARDS_TRICKSTER) {
    const copies = event.eventType === 'legendary' ? 2 : 2;
    for (let i = 0; i < copies; i++) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  // 添加传送门（3张）
  for (let i = 0; i < 3; i++) {
    deck.push({ ...STRUCTURE_CARDS_TRICKSTER[1], id: `trickster-portal-${i + 1}` });
  }

  // 起始单位：掷术师（▲）和 心灵巫女（■）
  // 
  // ┌─────────────────────────────────────────────────────────────────┐
  // │ 坐标系：【左下角原点】（玩家0视角）                              │
  // │   - row: 从下往上数（0=最底行，7=最顶行）                        │
  // │   - col: 从左往右数（0=最左，5=最右）                            │
  // │                                                                 │
  // │ 棋盘示意图（8行×6列）- 欺心巫族起始布局：                        │
  // │                                                                 │
  // │   col:  0   1   2   3   4   5                                   │
  // │       ┌───┬───┬───┬───┬───┬───┐                                 │
  // │  row 7│   │   │   │   │   │   │  ← 对方后排                     │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │   ... │   │   │   │   │   │   │                                 │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 2│   │   │   │   │ ▲ │   │  ← 掷术师                       │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 1│   │   │ ■ │ 门 │   │   │  ← 心灵巫女、城门              │
  // │       ├───┼───┼───┼───┼───┼───┤                                 │
  // │  row 0│   │   │ 召│   │   │   │  ← 召唤师（我方后排）           │
  // │       └───┴───┴───┴───┴───┴───┘                                 │
  // └─────────────────────────────────────────────────────────────────┘
  //
  // 根据召唤师卡背面图片（tip.png）：
  //   - 召唤师：row 0, col 2
  //   - 心灵巫女(■)：row 1, col 2（召唤师正上方）
  //   - 起始城门：row 1, col 3
  //   - 掷术师(▲)：row 2, col 4
  const telekinetic = COMMON_UNITS_TRICKSTER.find(u => u.id === 'trickster-telekinetic')!;
  const mindWitch = COMMON_UNITS_TRICKSTER.find(u => u.id === 'trickster-mind-witch')!;

  return {
    summoner: SUMMONER_TRICKSTER,
    summonerPosition: { row: 0, col: 2 },
    startingUnits: [
      { unit: { ...telekinetic, id: 'trickster-start-telekinetic' }, position: { row: 2, col: 4 } },  // ▲
      { unit: { ...mindWitch, id: 'trickster-start-mind-witch' }, position: { row: 1, col: 2 } },    // ■
    ],
    startingGate: { ...STRUCTURE_CARDS_TRICKSTER[0], id: 'trickster-start-gate' },
    startingGatePosition: { row: 1, col: 3 },
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
