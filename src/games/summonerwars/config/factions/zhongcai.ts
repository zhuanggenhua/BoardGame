/**
 * 召唤师战争 - 仲裁派系
 *
 * 图集合同：cards.png 为 8×2，每格 1050×750；slot 11–15 为空白占位。
 */

import type { CellCoord, EventCard, StructureCard, UnitCard } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

export const SPRITE_INDEX_ZHONGCAI = {
  HERO_KEXIYA: 0,
  HERO_TITUS: 1,
  HERO_ABUSI: 2,
  COMMON_JUSTICE: 3,
  COMMON_PEACE: 4,
  COMMON_PRIEST: 5,
  COMMON_WAR: 6,
  EVENT_OBEDIENCE: 7,
  EVENT_HOLY_DECREE: 8,
  EVENT_LOYALTY_DECREE: 9,
  EVENT_FREEDOM_DECREE: 10,
} as const;

const ZHONGCAI_SYMBOLS = [DECK_SYMBOLS.STAR, DECK_SYMBOLS.EYE];

export const SUMMONER_ZHONGCAI: UnitCard = {
  id: 'zhongcai-summoner', cardType: 'unit', name: '正义者瓦莱瑞亚', unitClass: 'summoner', faction: 'zhongcai',
  strength: 2, life: 12, cost: 0, attackType: 'ranged', attackRange: 3,
  abilities: ['zhongcai_word', 'zhongcai_high_gate'], deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, ...ZHONGCAI_SYMBOLS],
  spriteIndex: 0, spriteAtlas: 'hero',
};

export const CHAMPION_UNITS_ZHONGCAI: UnitCard[] = [
  {
    id: 'zhongcai-kexiya', cardType: 'unit', name: '高贵者凯西雅', unitClass: 'champion', faction: 'zhongcai',
    strength: 3, life: 6, cost: 4, attackType: 'ranged', attackRange: 3,
    abilities: ['zhongcai_radiant_healing'], deckSymbols: ZHONGCAI_SYMBOLS,
    spriteIndex: SPRITE_INDEX_ZHONGCAI.HERO_KEXIYA, spriteAtlas: 'cards',
  },
  {
    id: 'zhongcai-titus', cardType: 'unit', name: '虚诚者提图斯', unitClass: 'champion', faction: 'zhongcai',
    strength: 3, life: 9, cost: 6, attackType: 'ranged', attackRange: 3,
    abilities: ['zhongcai_high_gate', 'guardian'], deckSymbols: ZHONGCAI_SYMBOLS,
    spriteIndex: SPRITE_INDEX_ZHONGCAI.HERO_TITUS, spriteAtlas: 'cards',
  },
  {
    id: 'zhongcai-abusi', cardType: 'unit', name: '睿智者阿不思', unitClass: 'champion', faction: 'zhongcai',
    strength: 3, life: 5, cost: 3, attackType: 'ranged', attackRange: 3,
    abilities: ['zhongcai_erase'], deckSymbols: ZHONGCAI_SYMBOLS,
    spriteIndex: SPRITE_INDEX_ZHONGCAI.HERO_ABUSI, spriteAtlas: 'cards',
  },
];

export const COMMON_UNITS_ZHONGCAI: UnitCard[] = [
  {
    id: 'zhongcai-justice-arbiter', cardType: 'unit', name: '公正仲裁官', unitClass: 'common', faction: 'zhongcai',
    strength: 3, life: 5, cost: 2, attackType: 'melee', attackRange: 1,
    abilities: ['zhongcai_repentance'], deckSymbols: ZHONGCAI_SYMBOLS,
    spriteIndex: SPRITE_INDEX_ZHONGCAI.COMMON_JUSTICE, spriteAtlas: 'cards',
  },
  {
    id: 'zhongcai-peace-arbiter', cardType: 'unit', name: '和平仲裁官', unitClass: 'common', faction: 'zhongcai',
    strength: 2, life: 3, cost: 1, attackType: 'ranged', attackRange: 3,
    abilities: ['zhongcai_sturdy'], deckSymbols: ZHONGCAI_SYMBOLS,
    spriteIndex: SPRITE_INDEX_ZHONGCAI.COMMON_PEACE, spriteAtlas: 'cards',
  },
  {
    id: 'zhongcai-support-priest', cardType: 'unit', name: '护持牧师', unitClass: 'common', faction: 'zhongcai',
    strength: 2, life: 3, cost: 1, attackType: 'ranged', attackRange: 3,
    abilities: ['zhongcai_support', 'zhongcai_inspire'], deckSymbols: ZHONGCAI_SYMBOLS,
    spriteIndex: SPRITE_INDEX_ZHONGCAI.COMMON_PRIEST, spriteAtlas: 'cards',
  },
  {
    id: 'zhongcai-war-arbiter', cardType: 'unit', name: '战争仲裁官', unitClass: 'common', faction: 'zhongcai',
    strength: 2, life: 3, cost: 2, attackType: 'melee', attackRange: 1,
    abilities: ['zhongcai_strong'], deckSymbols: ZHONGCAI_SYMBOLS,
    spriteIndex: SPRITE_INDEX_ZHONGCAI.COMMON_WAR, spriteAtlas: 'cards',
  },
];

export const EVENT_CARDS_ZHONGCAI: EventCard[] = [
  {
    id: 'zhongcai-obedience', cardType: 'event', faction: 'zhongcai', name: '服从', eventType: 'legendary',
    playPhase: 'attack', cost: 0, isActive: false,
    effect: '指定你的召唤师3个区格以内一个士兵，将其放置到召唤师相邻空格。', deckSymbols: [],
    spriteIndex: SPRITE_INDEX_ZHONGCAI.EVENT_OBEDIENCE, spriteAtlas: 'cards',
  },
  {
    id: 'zhongcai-holy-decree', cardType: 'event', faction: 'zhongcai', name: '圣戒律令', eventType: 'common',
    playPhase: 'build', cost: 0, isActive: true, charges: 1,
    effect: '放置1点充能。持续：召唤师将受到1点或更多伤害时，伤害至多为1。自己的回合开始时，可以消耗1点充能弃置本事件。',
    deckSymbols: ZHONGCAI_SYMBOLS, spriteIndex: SPRITE_INDEX_ZHONGCAI.EVENT_HOLY_DECREE, spriteAtlas: 'cards',
  },
  {
    id: 'zhongcai-loyalty-decree', cardType: 'event', faction: 'zhongcai', name: '忠诚律令', eventType: 'common',
    playPhase: 'attack', cost: 0, isActive: true, charges: 1,
    effect: '放置1点充能。持续：每个与一个或多个召唤师相邻的士兵获得战力+1。自己的回合开始时，可以消耗1点充能弃置本事件。',
    deckSymbols: ZHONGCAI_SYMBOLS, spriteIndex: SPRITE_INDEX_ZHONGCAI.EVENT_LOYALTY_DECREE, spriteAtlas: 'cards',
  },
  {
    id: 'zhongcai-freedom-decree', cardType: 'event', faction: 'zhongcai', name: '自由律令', eventType: 'common',
    playPhase: 'summon', cost: 0, isActive: true,
    effect: '持续：所有士兵获得全能，可以用攻击代替移动，也可以用移动代替攻击。',
    deckSymbols: ZHONGCAI_SYMBOLS, spriteIndex: SPRITE_INDEX_ZHONGCAI.EVENT_FREEDOM_DECREE, spriteAtlas: 'cards',
  },
];

export const STRUCTURE_CARDS_ZHONGCAI: StructureCard[] = [
  {
    id: 'zhongcai-starting-gate', cardType: 'structure', faction: 'zhongcai', name: '起始城门', cost: 0, life: 10,
    isGate: true, isStartingGate: true, deckSymbols: [], spriteIndex: 0, spriteAtlas: 'portal',
  },
  {
    id: 'zhongcai-portal', cardType: 'structure', faction: 'zhongcai', name: '传送门', cost: 0, life: 5,
    isGate: true, deckSymbols: [], spriteIndex: 1, spriteAtlas: 'portal',
  },
];

export function createZhongcaiDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [...CHAMPION_UNITS_ZHONGCAI];
  for (const unit of COMMON_UNITS_ZHONGCAI) {
    for (let i = 0; i < 4; i += 1) deck.push({ ...unit, id: `${unit.id}-${i}` });
  }
  for (const event of EVENT_CARDS_ZHONGCAI) {
    for (let i = 0; i < 2; i += 1) deck.push({ ...event, id: `${event.id}-${i}` });
  }
  for (let i = 0; i < 3; i += 1) deck.push({ ...STRUCTURE_CARDS_ZHONGCAI[1], id: `zhongcai-portal-${i + 1}` });

  const justice = COMMON_UNITS_ZHONGCAI.find(unit => unit.id === 'zhongcai-justice-arbiter')!;
  const peace = COMMON_UNITS_ZHONGCAI.find(unit => unit.id === 'zhongcai-peace-arbiter')!;
  return {
    summoner: SUMMONER_ZHONGCAI,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...justice, id: 'zhongcai-start-justice-arbiter' }, position: { row: 2, col: 3 } },
      { unit: { ...peace, id: 'zhongcai-start-peace-arbiter' }, position: { row: 2, col: 2 } },
    ],
    startingGate: { ...STRUCTURE_CARDS_ZHONGCAI[0], id: 'zhongcai-starting-gate-0' },
    startingGatePosition: { row: 1, col: 3 },
    deck,
  };
}
