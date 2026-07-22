/**
 * 召唤师战争 - 永恒议会派系
 *
 * cards.jpg 为 8x2 横向图集，slot 0-10 为有效卡，slot 11-15 为空白。
 */

import type { UnitCard, EventCard, StructureCard, CellCoord } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

export const SPRITE_INDEX_YONGHENG = {
  EVENT_LEARNING: 0,
  COMMON_FORTRESS_ADVISOR: 1,
  COMMON_PSYCHIC_KNIGHT: 2,
  CHAMPION_SUPERVISOR_MARUNA: 3,
  COMMON_ANCIENT_SCHOLAR: 4,
  EVENT_INSIGHT: 5,
  CHAMPION_SUPERVISOR_OVI: 6,
  EVENT_SEARCH: 7,
  CHAMPION_SUPERVISOR_KATU: 8,
  EVENT_MENTAL_INVASION: 9,
  COMMON_MYSTERY_SAGE: 10,
} as const;

const YONGHENG_SYMBOLS = [DECK_SYMBOLS.COUNCIL, DECK_SYMBOLS.EYE];

export const SUMMONER_YONGHENG: UnitCard = {
  id: 'yongheng-summoner',
  cardType: 'unit',
  name: '大议长艾迪雅',
  unitClass: 'summoner',
  faction: 'yongheng',
  strength: 3,
  life: 13,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['yongheng_kinetic_siphon', 'yongheng_continuance'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, ...YONGHENG_SYMBOLS],
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

export const CHAMPION_UNITS_YONGHENG: UnitCard[] = [
  {
    id: 'yongheng-supervisor-maruna',
    cardType: 'unit',
    name: '主管玛鲁娜',
    unitClass: 'champion',
    faction: 'yongheng',
    strength: 5,
    life: 8,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['yongheng_punish'],
    deckSymbols: [DECK_SYMBOLS.COUNCIL],
    spriteIndex: SPRITE_INDEX_YONGHENG.CHAMPION_SUPERVISOR_MARUNA,
    spriteAtlas: 'cards',
  },
  {
    id: 'yongheng-supervisor-ovi',
    cardType: 'unit',
    name: '主管奥维',
    unitClass: 'champion',
    faction: 'yongheng',
    strength: 4,
    life: 6,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['yongheng_scheme'],
    deckSymbols: [DECK_SYMBOLS.EYE],
    spriteIndex: SPRITE_INDEX_YONGHENG.CHAMPION_SUPERVISOR_OVI,
    spriteAtlas: 'cards',
  },
  {
    id: 'yongheng-supervisor-katu',
    cardType: 'unit',
    name: '主管卡图',
    unitClass: 'champion',
    faction: 'yongheng',
    strength: 6,
    life: 10,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['yongheng_tenacity', 'yongheng_power_reinforcement'],
    deckSymbols: YONGHENG_SYMBOLS,
    spriteIndex: SPRITE_INDEX_YONGHENG.CHAMPION_SUPERVISOR_KATU,
    spriteAtlas: 'cards',
  },
];

export const COMMON_UNITS_YONGHENG: UnitCard[] = [
  {
    id: 'yongheng-fortress-advisor',
    cardType: 'unit',
    name: '城塞参谋',
    unitClass: 'common',
    faction: 'yongheng',
    strength: 1,
    life: 3,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['yongheng_intelligence', 'yongheng_warning'],
    deckSymbols: [DECK_SYMBOLS.COUNCIL],
    spriteIndex: SPRITE_INDEX_YONGHENG.COMMON_FORTRESS_ADVISOR,
    spriteAtlas: 'cards',
  },
  {
    id: 'yongheng-psychic-knight',
    cardType: 'unit',
    name: '心灵骑士',
    unitClass: 'common',
    faction: 'yongheng',
    strength: 2,
    life: 4,
    cost: 2,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['yongheng_arouse_fear', 'yongheng_collision'],
    deckSymbols: [DECK_SYMBOLS.EYE],
    spriteIndex: SPRITE_INDEX_YONGHENG.COMMON_PSYCHIC_KNIGHT,
    spriteAtlas: 'cards',
  },
  {
    id: 'yongheng-ancient-scholar',
    cardType: 'unit',
    name: '远古学者',
    unitClass: 'common',
    faction: 'yongheng',
    strength: 1,
    life: 2,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['yongheng_wisdom', 'yongheng_analysis'],
    deckSymbols: [DECK_SYMBOLS.COUNCIL],
    spriteIndex: SPRITE_INDEX_YONGHENG.COMMON_ANCIENT_SCHOLAR,
    spriteAtlas: 'cards',
  },
  {
    id: 'yongheng-mystery-sage',
    cardType: 'unit',
    name: '玄谜贤者',
    unitClass: 'common',
    faction: 'yongheng',
    strength: 2,
    life: 4,
    cost: 3,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['yongheng_application'],
    deckSymbols: [DECK_SYMBOLS.EYE],
    spriteIndex: SPRITE_INDEX_YONGHENG.COMMON_MYSTERY_SAGE,
    spriteAtlas: 'cards',
  },
];

export const EVENT_CARDS_YONGHENG: EventCard[] = [
  {
    id: 'yongheng-learning',
    cardType: 'event',
    faction: 'yongheng',
    name: '学习',
    eventType: 'legendary',
    playPhase: 'magic',
    cost: 0,
    isActive: true,
    charges: 2,
    effect: '持续。将 2 点充能放置到本事件上。每次在对手打出的事件被弃除之后，如果可能，从本事件上移除 1 点充能。如果你这样做，将被弃除的事件加入你的手牌。当本事件被弃除时，将本事件上所有充能移动到你的召唤师上。',
    deckSymbols: [],
    spriteIndex: SPRITE_INDEX_YONGHENG.EVENT_LEARNING,
    spriteAtlas: 'cards',
  },
  {
    id: 'yongheng-insight',
    cardType: 'event',
    faction: 'yongheng',
    name: '洞察',
    eventType: 'common',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '持续。每当你抓取一张或更多卡牌时，将本事件充能。本事件每有 1 点充能，则你的召唤师获得战力 +1，至多为 +5。',
    deckSymbols: [DECK_SYMBOLS.COUNCIL],
    spriteIndex: SPRITE_INDEX_YONGHENG.EVENT_INSIGHT,
    spriteAtlas: 'cards',
  },
  {
    id: 'yongheng-search',
    cardType: 'event',
    faction: 'yongheng',
    name: '探寻',
    eventType: 'common',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '持续。在你的移动、建造和攻击阶段开始时，你可以抓取一张卡牌。',
    deckSymbols: [DECK_SYMBOLS.COUNCIL],
    spriteIndex: SPRITE_INDEX_YONGHENG.EVENT_SEARCH,
    spriteAtlas: 'cards',
  },
  {
    id: 'yongheng-mental-invasion',
    cardType: 'event',
    faction: 'yongheng',
    name: '心念侵袭',
    eventType: 'common',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '持续。每当你在自己的回合中抓取一张或更多卡牌时，你可以指定你的召唤师 2 个区格以内的一个敌方士兵或英雄为目标。对目标造成 1 点伤害。',
    deckSymbols: [DECK_SYMBOLS.EYE],
    spriteIndex: SPRITE_INDEX_YONGHENG.EVENT_MENTAL_INVASION,
    spriteAtlas: 'cards',
  },
];

export const STRUCTURE_CARDS_YONGHENG: StructureCard[] = [
  {
    id: 'yongheng-starting-gate',
    cardType: 'structure',
    faction: 'yongheng',
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
    id: 'yongheng-portal',
    cardType: 'structure',
    faction: 'yongheng',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [],
    spriteIndex: 1,
    spriteAtlas: 'portal',
  },
];

export function createYonghengDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [...CHAMPION_UNITS_YONGHENG];

  for (const unit of COMMON_UNITS_YONGHENG) {
    for (let i = 0; i < 4; i += 1) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  for (const event of EVENT_CARDS_YONGHENG) {
    for (let i = 0; i < 2; i += 1) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  for (let i = 0; i < 3; i += 1) {
    deck.push({ ...STRUCTURE_CARDS_YONGHENG[1], id: `yongheng-portal-${i + 1}` });
  }

  const fortressAdvisor = COMMON_UNITS_YONGHENG.find(unit => unit.id === 'yongheng-fortress-advisor')!;
  const psychicKnight = COMMON_UNITS_YONGHENG.find(unit => unit.id === 'yongheng-psychic-knight')!;

  return {
    summoner: SUMMONER_YONGHENG,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...fortressAdvisor, id: 'yongheng-start-fortress-advisor' }, position: { row: 2, col: 2 } },
      { unit: { ...psychicKnight, id: 'yongheng-start-psychic-knight' }, position: { row: 2, col: 3 } },
    ],
    startingGate: { ...STRUCTURE_CARDS_YONGHENG[0], id: 'yongheng-starting-gate-0' },
    startingGatePosition: { row: 1, col: 3 },
    deck,
  };
}
