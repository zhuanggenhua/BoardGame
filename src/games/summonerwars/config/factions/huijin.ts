/**
 * 召唤师战争 - 灰烬派系
 *
 * 本批素材使用 8x2 横向图集：
 * public/assets/i18n/zh-CN/summonerwars/hero/huijin/cards.jpg
 *
 * slot 0-10 为有效卡，slot 11-15 为空白占位。
 */

import type { UnitCard, EventCard, StructureCard, CellCoord } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

export const SPRITE_INDEX_HUIJIN = {
  CHAMPION_HELISI: 0,
  CHAMPION_FLAME_DRAGON_BEAST: 1,
  CHAMPION_FENGNISHA: 2,
  COMMON_ASH_MAGE: 3,
  COMMON_ROYAL_GUARD: 4,
  COMMON_ASH_BEAST: 5,
  COMMON_ASH_ARCHER: 6,
  EVENT_DAZZLING_LIGHT: 7,
  EVENT_SCORCH: 8,
  EVENT_DIVINE_REVENGE: 9,
  EVENT_PHOENIX_SOUL: 10,
} as const;

const HUIJIN_SYMBOLS = [DECK_SYMBOLS.EMBER, DECK_SYMBOLS.PHOENIX];

export const SUMMONER_HUIJIN: UnitCard = {
  id: 'huijin-summoner',
  cardType: 'unit',
  name: '玛达莉雅女王',
  unitClass: 'summoner',
  faction: 'huijin',
  strength: 4,
  life: 9,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['intimidate', 'huijin_call_guards'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, ...HUIJIN_SYMBOLS],
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

export const CHAMPION_UNITS_HUIJIN: UnitCard[] = [
  {
    id: 'huijin-helisi',
    cardType: 'unit',
    name: '赫丽丝',
    unitClass: 'champion',
    faction: 'huijin',
    strength: 3,
    life: 7,
    cost: 5,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['huijin_ember_summon', 'huijin_ignite'],
    deckSymbols: [DECK_SYMBOLS.EMBER],
    spriteIndex: SPRITE_INDEX_HUIJIN.CHAMPION_HELISI,
    spriteAtlas: 'cards',
  },
  {
    id: 'huijin-flame-dragon-beast',
    cardType: 'unit',
    name: '火焰龙兽',
    unitClass: 'champion',
    faction: 'huijin',
    strength: 4,
    life: 10,
    cost: 8,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['huijin_guard_master', 'huijin_flame_breath'],
    deckSymbols: [DECK_SYMBOLS.EMBER, DECK_SYMBOLS.PHOENIX],
    spriteIndex: SPRITE_INDEX_HUIJIN.CHAMPION_FLAME_DRAGON_BEAST,
    spriteAtlas: 'cards',
  },
  {
    id: 'huijin-fengnisha',
    cardType: 'unit',
    name: '风妮莎',
    unitClass: 'champion',
    faction: 'huijin',
    strength: 3,
    life: 9,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['huijin_counterattack'],
    deckSymbols: [DECK_SYMBOLS.PHOENIX],
    spriteIndex: SPRITE_INDEX_HUIJIN.CHAMPION_FENGNISHA,
    spriteAtlas: 'cards',
  },
];

export const COMMON_UNITS_HUIJIN: UnitCard[] = [
  {
    id: 'huijin-ash-mage',
    cardType: 'unit',
    name: '灰烬法师',
    unitClass: 'common',
    faction: 'huijin',
    strength: 2,
    life: 2,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['huijin_shelter'],
    deckSymbols: [DECK_SYMBOLS.PHOENIX],
    spriteIndex: SPRITE_INDEX_HUIJIN.COMMON_ASH_MAGE,
    spriteAtlas: 'cards',
  },
  {
    id: 'huijin-royal-guard',
    cardType: 'unit',
    name: '皇家守卫',
    unitClass: 'common',
    faction: 'huijin',
    strength: 1,
    life: 4,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['entangle', 'huijin_ram'],
    deckSymbols: [DECK_SYMBOLS.PHOENIX],
    spriteIndex: SPRITE_INDEX_HUIJIN.COMMON_ROYAL_GUARD,
    spriteAtlas: 'cards',
  },
  {
    id: 'huijin-ash-beast',
    cardType: 'unit',
    name: '灰烬野兽',
    unitClass: 'common',
    faction: 'huijin',
    strength: 3,
    life: 3,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['huijin_born_of_flame', 'huijin_wildfire'],
    deckSymbols: [DECK_SYMBOLS.EMBER],
    spriteIndex: SPRITE_INDEX_HUIJIN.COMMON_ASH_BEAST,
    spriteAtlas: 'cards',
  },
  {
    id: 'huijin-ash-archer',
    cardType: 'unit',
    name: '灰烬弓箭手',
    unitClass: 'common',
    faction: 'huijin',
    strength: 2,
    life: 2,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['huijin_quick_shot'],
    deckSymbols: [DECK_SYMBOLS.PHOENIX],
    spriteIndex: SPRITE_INDEX_HUIJIN.COMMON_ASH_ARCHER,
    spriteAtlas: 'cards',
  },
];

export const EVENT_CARDS_HUIJIN: EventCard[] = [
  {
    id: 'huijin-dazzling-light',
    cardType: 'event',
    faction: 'huijin',
    name: '炫目光芒',
    eventType: 'common',
    playPhase: 'magic',
    cost: 1,
    isActive: true,
    effect: '持续。你的召唤师或与其相邻的一个友方单位被攻击时，按攻击掷骰中的特殊标记数量结算伤害。',
    deckSymbols: [DECK_SYMBOLS.PHOENIX],
    spriteIndex: SPRITE_INDEX_HUIJIN.EVENT_DAZZLING_LIGHT,
    spriteAtlas: 'cards',
  },
  {
    id: 'huijin-scorch',
    cardType: 'event',
    faction: 'huijin',
    name: '灼烧',
    eventType: 'common',
    playPhase: 'move',
    cost: 0,
    isActive: false,
    effect: '指定你的召唤师 2 个区格以内的一个士兵或英雄为目标。对目标造成 2 点伤害。',
    deckSymbols: [DECK_SYMBOLS.EMBER],
    spriteIndex: SPRITE_INDEX_HUIJIN.EVENT_SCORCH,
    spriteAtlas: 'cards',
  },
  {
    id: 'huijin-divine-revenge',
    cardType: 'event',
    faction: 'huijin',
    name: '神族复仇',
    eventType: 'common',
    playPhase: 'magic',
    cost: 0,
    isActive: true,
    effect: '持续。你的召唤师获得火凤灵光：每当其被攻击后，对攻击者造成 1 点伤害。',
    deckSymbols: [DECK_SYMBOLS.EMBER, DECK_SYMBOLS.PHOENIX],
    spriteIndex: SPRITE_INDEX_HUIJIN.EVENT_DIVINE_REVENGE,
    spriteAtlas: 'cards',
  },
  {
    id: 'huijin-phoenix-soul',
    cardType: 'event',
    faction: 'huijin',
    name: '凤凰之魂',
    eventType: 'legendary',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '持续。每当一个友方单位的技能以攻击之外的方式对敌方单位造成伤害时，额外造成 1 点伤害。',
    deckSymbols: [],
    spriteIndex: SPRITE_INDEX_HUIJIN.EVENT_PHOENIX_SOUL,
    spriteAtlas: 'cards',
  },
];

export const STRUCTURE_CARDS_HUIJIN: StructureCard[] = [
  {
    id: 'huijin-starting-gate',
    cardType: 'structure',
    faction: 'huijin',
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
    id: 'huijin-portal',
    cardType: 'structure',
    faction: 'huijin',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [],
    spriteIndex: 1,
    spriteAtlas: 'portal',
  },
];

export function createHuijinDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [];

  deck.push(...CHAMPION_UNITS_HUIJIN);

  for (const unit of COMMON_UNITS_HUIJIN) {
    for (let i = 0; i < 4; i++) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  for (const event of EVENT_CARDS_HUIJIN) {
    for (let i = 0; i < 2; i++) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  for (let i = 0; i < 3; i++) {
    deck.push({ ...STRUCTURE_CARDS_HUIJIN[1], id: `huijin-portal-${i + 1}` });
  }

  const ashArcher = COMMON_UNITS_HUIJIN.find(u => u.id === 'huijin-ash-archer')!;
  const royalGuard = COMMON_UNITS_HUIJIN.find(u => u.id === 'huijin-royal-guard')!;

  return {
    summoner: SUMMONER_HUIJIN,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...ashArcher, id: 'huijin-start-ash-archer' }, position: { row: 2, col: 2 } },
      { unit: { ...royalGuard, id: 'huijin-start-royal-guard' }, position: { row: 2, col: 3 } },
    ],
    startingGate: { ...STRUCTURE_CARDS_HUIJIN[0], id: `${STRUCTURE_CARDS_HUIJIN[0].id}-0` },
    startingGatePosition: { row: 1, col: 3 },
    deck,
  };
}
