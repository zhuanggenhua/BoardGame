/**
 * 召唤师战争 - 冰苔兽人派系
 *
 * cards.jpg 为 8x2 横向图集，slot 0-10 为有效卡，slot 11-15 为空白。
 */

import type { UnitCard, EventCard, StructureCard, CellCoord } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

export const SPRITE_INDEX_SHOUREN = {
  CHAMPION_RAGNOR: 0,
  CHAMPION_TARGAN: 1,
  CHAMPION_XIONGKE: 2,
  COMMON_FROST_SHAMAN: 3,
  COMMON_CRUSHER: 4,
  COMMON_TUNDRA_CHARGER: 5,
  COMMON_TUNDRA_FIGHTER: 6,
  EVENT_FREEZE: 7,
  EVENT_BRUTE_FORCE: 8,
  EVENT_PRIMAL_FURY: 9,
  EVENT_SUPREME_GLORY: 10,
} as const;

const SHOUREN_SYMBOLS = [DECK_SYMBOLS.TUNDRA, DECK_SYMBOLS.DROPLET];

export const SUMMONER_SHOUREN: UnitCard = {
  id: 'shouren-summoner',
  cardType: 'unit',
  name: '格鲁纳克',
  unitClass: 'summoner',
  faction: 'shouren',
  strength: 4,
  life: 14,
  cost: 0,
  attackType: 'melee',
  attackRange: 1,
  abilities: ['shouren_recover', 'shouren_encourage'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, ...SHOUREN_SYMBOLS],
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

export const CHAMPION_UNITS_SHOUREN: UnitCard[] = [
  {
    id: 'shouren-ragnor',
    cardType: 'unit',
    name: '拉格诺',
    unitClass: 'champion',
    faction: 'shouren',
    strength: 3,
    life: 8,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shouren_blood_bond'],
    deckSymbols: SHOUREN_SYMBOLS,
    spriteIndex: SPRITE_INDEX_SHOUREN.CHAMPION_RAGNOR,
    spriteAtlas: 'cards',
  },
  {
    id: 'shouren-targan',
    cardType: 'unit',
    name: '塔甘',
    unitClass: 'champion',
    faction: 'shouren',
    strength: 4,
    life: 6,
    cost: 5,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['ranged', 'shouren_biting_frost'],
    deckSymbols: [DECK_SYMBOLS.DROPLET],
    spriteIndex: SPRITE_INDEX_SHOUREN.CHAMPION_TARGAN,
    spriteAtlas: 'cards',
  },
  {
    id: 'shouren-xiongke',
    cardType: 'unit',
    name: '雄科',
    unitClass: 'champion',
    faction: 'shouren',
    strength: 8,
    life: 11,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shouren_frenzy_strike'],
    deckSymbols: [DECK_SYMBOLS.TUNDRA],
    spriteIndex: SPRITE_INDEX_SHOUREN.CHAMPION_XIONGKE,
    spriteAtlas: 'cards',
  },
];

export const COMMON_UNITS_SHOUREN: UnitCard[] = [
  {
    id: 'shouren-frost-shaman',
    cardType: 'unit',
    name: '冰霜萨满',
    unitClass: 'common',
    faction: 'shouren',
    strength: 3,
    life: 4,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['shouren_northern_magic'],
    deckSymbols: [DECK_SYMBOLS.DROPLET],
    spriteIndex: SPRITE_INDEX_SHOUREN.COMMON_FROST_SHAMAN,
    spriteAtlas: 'cards',
  },
  {
    id: 'shouren-crusher',
    cardType: 'unit',
    name: '粉碎者',
    unitClass: 'common',
    faction: 'shouren',
    strength: 4,
    life: 6,
    cost: 3,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shouren_slow'],
    deckSymbols: [DECK_SYMBOLS.DROPLET],
    spriteIndex: SPRITE_INDEX_SHOUREN.COMMON_CRUSHER,
    spriteAtlas: 'cards',
  },
  {
    id: 'shouren-tundra-charger',
    cardType: 'unit',
    name: '冰苔冲锋者',
    unitClass: 'common',
    faction: 'shouren',
    strength: 2,
    life: 2,
    cost: 0,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shouren_bloody_rush'],
    deckSymbols: [DECK_SYMBOLS.TUNDRA],
    spriteIndex: SPRITE_INDEX_SHOUREN.COMMON_TUNDRA_CHARGER,
    spriteAtlas: 'cards',
  },
  {
    id: 'shouren-tundra-fighter',
    cardType: 'unit',
    name: '冰苔斗士',
    unitClass: 'common',
    faction: 'shouren',
    strength: 2,
    life: 3,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shouren_berserk'],
    deckSymbols: [DECK_SYMBOLS.TUNDRA],
    spriteIndex: SPRITE_INDEX_SHOUREN.COMMON_TUNDRA_FIGHTER,
    spriteAtlas: 'cards',
  },
];

export const EVENT_CARDS_SHOUREN: EventCard[] = [
  {
    id: 'shouren-freeze',
    cardType: 'event',
    faction: 'shouren',
    name: '冻结',
    eventType: 'common',
    playPhase: 'summon',
    cost: 0,
    isActive: true,
    effect: '持续。指定你的召唤师3格以内一个未充能的士兵或英雄。目标失去所有技能，且不能移动、攻击、被推拉或成为攻击目标。',
    deckSymbols: [DECK_SYMBOLS.DROPLET],
    spriteIndex: SPRITE_INDEX_SHOUREN.EVENT_FREEZE,
    spriteAtlas: 'cards',
  },
  {
    id: 'shouren-brute-force',
    cardType: 'event',
    faction: 'shouren',
    name: '粗暴蛮力',
    eventType: 'common',
    playPhase: 'attack',
    cost: 0,
    isActive: true,
    effect: '持续。友方单位获得蛮力冲击：攻击并对一个单位造成伤害后，你可以将该单位向远离本单位的方向推拉1格。',
    deckSymbols: SHOUREN_SYMBOLS,
    spriteIndex: SPRITE_INDEX_SHOUREN.EVENT_BRUTE_FORCE,
    spriteAtlas: 'cards',
  },
  {
    id: 'shouren-primal-fury',
    cardType: 'event',
    faction: 'shouren',
    name: '原始狂怒',
    eventType: 'common',
    playPhase: 'attack',
    cost: 0,
    isActive: true,
    effect: '持续。召唤师攻击相邻敌方卡牌后，你可以将召唤师推拉1至2格；若如此做，召唤师可以额外攻击一次相邻敌方卡牌。',
    deckSymbols: [DECK_SYMBOLS.TUNDRA],
    spriteIndex: SPRITE_INDEX_SHOUREN.EVENT_PRIMAL_FURY,
    spriteAtlas: 'cards',
  },
  {
    id: 'shouren-supreme-glory',
    cardType: 'event',
    faction: 'shouren',
    name: '无上荣耀',
    eventType: 'legendary',
    playPhase: 'build',
    cost: 0,
    isActive: true,
    effect: '持续。友方士兵获得鲁莽打击：战力+2；攻击时若掷出0或1个特殊标记且对目标造成伤害，也对自身造成等量伤害。',
    deckSymbols: [],
    spriteIndex: SPRITE_INDEX_SHOUREN.EVENT_SUPREME_GLORY,
    spriteAtlas: 'cards',
  },
];

export const STRUCTURE_CARDS_SHOUREN: StructureCard[] = [
  {
    id: 'shouren-starting-gate',
    cardType: 'structure',
    faction: 'shouren',
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
    id: 'shouren-portal',
    cardType: 'structure',
    faction: 'shouren',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [],
    spriteIndex: 1,
    spriteAtlas: 'portal',
  },
];

export function createShourenDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [...CHAMPION_UNITS_SHOUREN];

  for (const unit of COMMON_UNITS_SHOUREN) {
    for (let i = 0; i < 4; i += 1) deck.push({ ...unit, id: `${unit.id}-${i}` });
  }
  for (const event of EVENT_CARDS_SHOUREN) {
    for (let i = 0; i < 2; i += 1) deck.push({ ...event, id: `${event.id}-${i}` });
  }
  for (let i = 0; i < 3; i += 1) {
    deck.push({ ...STRUCTURE_CARDS_SHOUREN[1], id: `shouren-portal-${i + 1}` });
  }

  const fighter = COMMON_UNITS_SHOUREN.find((unit) => unit.id === 'shouren-tundra-fighter')!;
  const shaman = COMMON_UNITS_SHOUREN.find((unit) => unit.id === 'shouren-frost-shaman')!;

  return {
    summoner: SUMMONER_SHOUREN,
    summonerPosition: { row: 0, col: 2 },
    startingUnits: [
      { unit: { ...fighter, id: 'shouren-start-tundra-fighter' }, position: { row: 3, col: 3 } },
      { unit: { ...shaman, id: 'shouren-start-frost-shaman' }, position: { row: 2, col: 2 } },
    ],
    startingGate: { ...STRUCTURE_CARDS_SHOUREN[0], id: 'shouren-starting-gate-0' },
    startingGatePosition: { row: 2, col: 3 },
    deck,
  };
}

