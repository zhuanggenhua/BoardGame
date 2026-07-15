/**
 * 召唤师战争 - 莫古派系 (Mogu)
 *
 * 本批素材使用 8x2 横向图集：
 * public/assets/i18n/zh-CN/summonerwars/hero/mogu/cards.jpg
 *
 * 本批素材使用新 8x2 横向图集格式，slot 11-15 为空白占位。
 */

import type { UnitCard, EventCard, StructureCard, CellCoord } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

// ============================================================================
// 精灵图索引映射（8列 x 2行，slot 11-15 为空白占位）
// ============================================================================

export const SPRITE_INDEX_MOGU = {
  CHAMPION_TUO_EN: 0,
  EVENT_COMMAND: 1,
  EVENT_SYMBIOTIC_SELF_HEALING: 2,
  COMMON_WITHERING_MAGE: 3,
  EVENT_FANATICAL_FUNGUS: 4,
  CHAMPION_MALFORMED_GIANT: 5,
  COMMON_BLOOD_SHAMAN: 6,
  CHAMPION_MA_SHUO_DA: 7,
  EVENT_RELEASE_SPORES: 8,
  COMMON_FUNGAL_BEAST: 9,
  COMMON_SPORE_PLAGUE_BODY: 10,
} as const;

const MOGU_SYMBOLS = [DECK_SYMBOLS.SPORE, DECK_SYMBOLS.MYCELIUM];

// ============================================================================
// 召唤师（来自 hero.png，单帧新格式）
// ============================================================================

export const SUMMONER_MOGU: UnitCard = {
  id: 'mogu-summoner',
  cardType: 'unit',
  name: '库鞭克',
  unitClass: 'summoner',
  faction: 'mogu',
  strength: 4,
  life: 13,
  cost: 0,
  attackType: 'melee',
  attackRange: 1,
  abilities: ['mogu_blood_bloom'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, ...MOGU_SYMBOLS],
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

// ============================================================================
// 冠军单位
// ============================================================================

export const CHAMPION_UNITS_MOGU: UnitCard[] = [
  {
    id: 'mogu-tuo-en',
    cardType: 'unit',
    name: '托恩',
    unitClass: 'champion',
    faction: 'mogu',
    strength: 2,
    life: 7,
    cost: 6,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['mogu_blood_rage', 'power_up', 'mogu_blood_rage_decay'],
    deckSymbols: [DECK_SYMBOLS.SPORE],
    spriteIndex: SPRITE_INDEX_MOGU.CHAMPION_TUO_EN,
    spriteAtlas: 'cards',
  },
  {
    id: 'mogu-malformed-giant',
    cardType: 'unit',
    name: '畸形巨怪',
    unitClass: 'champion',
    faction: 'mogu',
    strength: 5,
    life: 13,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['mogu_final_form'],
    deckSymbols: [DECK_SYMBOLS.MYCELIUM],
    spriteIndex: SPRITE_INDEX_MOGU.CHAMPION_MALFORMED_GIANT,
    spriteAtlas: 'cards',
  },
  {
    id: 'mogu-ma-shuo-da',
    cardType: 'unit',
    name: '玛硕达',
    unitClass: 'champion',
    faction: 'mogu',
    strength: 3,
    life: 8,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['mogu_decay'],
    deckSymbols: [DECK_SYMBOLS.SPORE, DECK_SYMBOLS.MYCELIUM],
    spriteIndex: SPRITE_INDEX_MOGU.CHAMPION_MA_SHUO_DA,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 普通单位（士兵）
// ============================================================================

export const COMMON_UNITS_MOGU: UnitCard[] = [
  {
    id: 'mogu-withering-mage',
    cardType: 'unit',
    name: '枯萎法师',
    unitClass: 'common',
    faction: 'mogu',
    strength: 4,
    life: 3,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['mogu_blood_infusion'],
    deckSymbols: [DECK_SYMBOLS.SPORE],
    spriteIndex: SPRITE_INDEX_MOGU.COMMON_WITHERING_MAGE,
    spriteAtlas: 'cards',
  },
  {
    id: 'mogu-blood-shaman',
    cardType: 'unit',
    name: '鲜血萨满',
    unitClass: 'common',
    faction: 'mogu',
    strength: 3,
    life: 2,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['mogu_transmission'],
    deckSymbols: [DECK_SYMBOLS.MYCELIUM],
    spriteIndex: SPRITE_INDEX_MOGU.COMMON_BLOOD_SHAMAN,
    spriteAtlas: 'cards',
  },
  {
    id: 'mogu-fungal-beast',
    cardType: 'unit',
    name: '菌化野兽',
    unitClass: 'common',
    faction: 'mogu',
    strength: 3,
    life: 5,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['mogu_infection', 'mogu_parasite'],
    deckSymbols: [DECK_SYMBOLS.SPORE],
    spriteIndex: SPRITE_INDEX_MOGU.COMMON_FUNGAL_BEAST,
    spriteAtlas: 'cards',
  },
  {
    id: 'mogu-spore-plague-body',
    cardType: 'unit',
    name: '菌袍疫病体',
    unitClass: 'common',
    faction: 'mogu',
    strength: 2,
    life: 2,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['mogu_burst', 'mogu_fungal_mutation'],
    deckSymbols: [DECK_SYMBOLS.MYCELIUM],
    spriteIndex: SPRITE_INDEX_MOGU.COMMON_SPORE_PLAGUE_BODY,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 事件卡
// ============================================================================

export const EVENT_CARDS_MOGU: EventCard[] = [
  {
    id: 'mogu-command',
    cardType: 'event',
    faction: 'mogu',
    name: '命令',
    eventType: 'legendary',
    playPhase: 'attack',
    cost: 0,
    isActive: false,
    effect: '指定你的召唤师3个区格以内的一个友方士兵为目标。目标可以进行一次额外的攻击。然后将目标消灭。',
    deckSymbols: [],
    spriteIndex: SPRITE_INDEX_MOGU.EVENT_COMMAND,
    spriteAtlas: 'cards',
  },
  {
    id: 'mogu-symbiotic-self-healing',
    cardType: 'event',
    faction: 'mogu',
    name: '共生自愈',
    eventType: 'common',
    playPhase: 'move',
    cost: 0,
    isActive: false,
    effect: '指定任意数量已受伤害的友方士兵和英雄为目标。从每个目标上移除1点伤害，并且将每个目标充能。',
    deckSymbols: [DECK_SYMBOLS.SPORE],
    spriteIndex: SPRITE_INDEX_MOGU.EVENT_SYMBIOTIC_SELF_HEALING,
    spriteAtlas: 'cards',
  },
  {
    id: 'mogu-fanatical-fungus',
    cardType: 'event',
    faction: 'mogu',
    name: '狂热菌菇',
    eventType: 'common',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '持续。在你移动一个单位之后，可以将其充能。如果你这样做，首先你可以将其推拉1个区格，然后你必须对其造成1点伤害。',
    deckSymbols: [DECK_SYMBOLS.MYCELIUM],
    spriteIndex: SPRITE_INDEX_MOGU.EVENT_FANATICAL_FUNGUS,
    spriteAtlas: 'cards',
  },
  {
    id: 'mogu-release-spores',
    cardType: 'event',
    faction: 'mogu',
    name: '释放菌袍',
    eventType: 'legendary',
    playPhase: 'magic',
    cost: 0,
    isActive: false,
    effect: '从你的弃牌堆中拿取至多两张疫病体单位，放置到你的召唤师相邻的区格。',
    deckSymbols: [DECK_SYMBOLS.SPORE, DECK_SYMBOLS.MYCELIUM],
    spriteIndex: SPRITE_INDEX_MOGU.EVENT_RELEASE_SPORES,
    spriteAtlas: 'cards',
  },
];

// ============================================================================
// 建筑卡（共用传送门）
// ============================================================================

export const STRUCTURE_CARDS_MOGU: StructureCard[] = [
  {
    id: 'mogu-starting-gate',
    cardType: 'structure',
    faction: 'mogu',
    name: '起始城门',
    cost: 0,
    life: 10,
    isGate: true,
    isStartingGate: true,
    deckSymbols: [],
    spriteIndex: 0,
    spriteAtlas: 'portal',
  },
  {
    id: 'mogu-portal',
    cardType: 'structure',
    faction: 'mogu',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [],
    spriteIndex: 1,
    spriteAtlas: 'portal',
  },
];

// ============================================================================
// 牌组生成
// ============================================================================

export function createMoguDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [];

  deck.push(...CHAMPION_UNITS_MOGU);

  for (const unit of COMMON_UNITS_MOGU) {
    for (let i = 0; i < 4; i++) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  for (const event of EVENT_CARDS_MOGU) {
    for (let i = 0; i < 2; i++) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  for (let i = 0; i < 3; i++) {
    deck.push({ ...STRUCTURE_CARDS_MOGU[1], id: `mogu-portal-${i + 1}` });
  }

  const witheringMage = COMMON_UNITS_MOGU.find(u => u.id === 'mogu-withering-mage')!;
  const sporePlagueBody = COMMON_UNITS_MOGU.find(u => u.id === 'mogu-spore-plague-body')!;

  return {
    summoner: SUMMONER_MOGU,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...witheringMage, id: 'mogu-start-withering-mage' }, position: { row: 2, col: 3 } },
      { unit: { ...sporePlagueBody, id: 'mogu-start-spore-plague-body' }, position: { row: 2, col: 2 } },
    ],
    startingGate: { ...STRUCTURE_CARDS_MOGU[0], id: `${STRUCTURE_CARDS_MOGU[0].id}-0` },
    startingGatePosition: { row: 1, col: 3 },
    deck,
  };
}
