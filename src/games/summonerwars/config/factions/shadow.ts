/**
 * 召唤师战争 - 暗影精灵派系
 *
 * 本批素材由独立卡面手动合成为 8x2 cards.jpg：
 * - slot 0-2：英雄
 * - slot 3-6：士兵
 * - slot 7-10：事件
 * - slot 11-15：空白占位
 */

import type { CellCoord, EventCard, StructureCard, UnitCard } from '../../domain/types';
import { DECK_SYMBOLS } from '../symbols';

export const SPRITE_INDEX_SHADOW = {
  HERO_XUMENGAN: 0,
  HERO_TALIA: 1,
  HERO_SAMARA: 2,
  COMMON_SHADOW_MAGE: 3,
  COMMON_TRUTH_SEEKER: 4,
  COMMON_SHADOW_KNIGHT: 5,
  COMMON_SAGE_ROVER: 6,
  EVENT_HIDE_IN_DARKNESS: 7,
  EVENT_MARL_GRIMOIRE: 8,
  EVENT_LIGHTNING_STEP: 9,
  EVENT_SHADOW_PULSE: 10,
} as const;

const SHADOW_SYMBOLS = [DECK_SYMBOLS.MOON, DECK_SYMBOLS.STAR];

export const SUMMONER_SHADOW: UnitCard = {
  id: 'shadow-summoner',
  cardType: 'unit',
  name: '瑟伦达',
  unitClass: 'summoner',
  faction: 'shadow',
  strength: 5,
  life: 11,
  cost: 0,
  attackType: 'ranged',
  attackRange: 3,
  abilities: ['shadow_blood_magic', 'shadow_return_to_shadow'],
  deckSymbols: [DECK_SYMBOLS.DOUBLE_AXE, ...SHADOW_SYMBOLS],
  spriteIndex: 0,
  spriteAtlas: 'hero',
};

export const CHAMPION_UNITS_SHADOW: UnitCard[] = [
  {
    id: 'shadow-xumengan',
    cardType: 'unit',
    name: '虚梦安',
    unitClass: 'champion',
    faction: 'shadow',
    strength: 3,
    life: 8,
    cost: 5,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['shadow_dark_prophecy', 'shadow_judgment'],
    deckSymbols: SHADOW_SYMBOLS,
    spriteIndex: SPRITE_INDEX_SHADOW.HERO_XUMENGAN,
    spriteAtlas: 'cards',
  },
  {
    id: 'shadow-talia',
    cardType: 'unit',
    name: '塔莉娅',
    unitClass: 'champion',
    faction: 'shadow',
    strength: 3,
    life: 7,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shadow_tear_the_veil'],
    deckSymbols: [DECK_SYMBOLS.STAR],
    spriteIndex: SPRITE_INDEX_SHADOW.HERO_TALIA,
    spriteAtlas: 'cards',
  },
  {
    id: 'shadow-samara',
    cardType: 'unit',
    name: '萨玛拉',
    unitClass: 'champion',
    faction: 'shadow',
    strength: 4,
    life: 7,
    cost: 5,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shadow_inescapable_doom'],
    deckSymbols: [DECK_SYMBOLS.MOON],
    spriteIndex: SPRITE_INDEX_SHADOW.HERO_SAMARA,
    spriteAtlas: 'cards',
  },
];

export const COMMON_UNITS_SHADOW: UnitCard[] = [
  {
    id: 'shadow-shadow-mage',
    cardType: 'unit',
    name: '暗影法师',
    unitClass: 'common',
    faction: 'shadow',
    strength: 3,
    life: 4,
    cost: 2,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['shadow_forbidden_knowledge'],
    deckSymbols: [DECK_SYMBOLS.MOON],
    spriteIndex: SPRITE_INDEX_SHADOW.COMMON_SHADOW_MAGE,
    spriteAtlas: 'cards',
  },
  {
    id: 'shadow-truth-seeker',
    cardType: 'unit',
    name: '真实探求者',
    unitClass: 'common',
    faction: 'shadow',
    strength: 1,
    life: 3,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shadow_fierce_assault', 'shadow_feint'],
    deckSymbols: [DECK_SYMBOLS.STAR],
    spriteIndex: SPRITE_INDEX_SHADOW.COMMON_TRUTH_SEEKER,
    spriteAtlas: 'cards',
  },
  {
    id: 'shadow-shadow-knight',
    cardType: 'unit',
    name: '暗影骑士',
    unitClass: 'common',
    faction: 'shadow',
    strength: 2,
    life: 5,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    abilities: ['shadow_shadow_summon', 'shadow_death_pact'],
    deckSymbols: [DECK_SYMBOLS.MOON],
    spriteIndex: SPRITE_INDEX_SHADOW.COMMON_SHADOW_KNIGHT,
    spriteAtlas: 'cards',
  },
  {
    id: 'shadow-sage-rover',
    cardType: 'unit',
    name: '圣贤巡游者',
    unitClass: 'common',
    faction: 'shadow',
    strength: 2,
    life: 3,
    cost: 1,
    attackType: 'ranged',
    attackRange: 3,
    abilities: ['shadow_piercing_light', 'shadow_sudden_assault'],
    deckSymbols: [DECK_SYMBOLS.STAR],
    spriteIndex: SPRITE_INDEX_SHADOW.COMMON_SAGE_ROVER,
    spriteAtlas: 'cards',
  },
];

export const EVENT_CARDS_SHADOW: EventCard[] = [
  {
    id: 'shadow-hide-in-darkness',
    cardType: 'event',
    faction: 'shadow',
    name: '隐入黑暗',
    eventType: 'legendary',
    playPhase: 'build',
    cost: 0,
    isActive: false,
    effect: '指定你的召唤师3个区格以内一个剩余生命为5点或更低的传送门或士兵为目标。将目标和其底层的所有卡牌返回到各自拥有者的手牌。',
    deckSymbols: [],
    spriteIndex: SPRITE_INDEX_SHADOW.EVENT_HIDE_IN_DARKNESS,
    spriteAtlas: 'cards',
  },
  {
    id: 'shadow-marl-grimoire',
    cardType: 'event',
    faction: 'shadow',
    name: '玛尔典籍',
    eventType: 'common',
    playPhase: 'summon',
    cost: 1,
    isActive: false,
    effect: '从你的弃牌堆中拿取一张除了玛尔典籍和传奇事件以外的卡牌，展示并加入你的手牌。将以下效果结算两次：对一个友方单位造成1点伤害。',
    deckSymbols: SHADOW_SYMBOLS,
    spriteIndex: SPRITE_INDEX_SHADOW.EVENT_MARL_GRIMOIRE,
    spriteAtlas: 'cards',
  },
  {
    id: 'shadow-lightning-step',
    cardType: 'event',
    faction: 'shadow',
    name: '迅如闪电',
    eventType: 'common',
    playPhase: 'attack',
    cost: 0,
    isActive: true,
    effect: '持续。你的召唤师获得迅闪步：在你的回合中，本单位3个区格以内的一个单位离开战场之后，你可以使用本单位替换该单位。',
    deckSymbols: [DECK_SYMBOLS.STAR],
    spriteIndex: SPRITE_INDEX_SHADOW.EVENT_LIGHTNING_STEP,
    spriteAtlas: 'cards',
  },
  {
    id: 'shadow-shadow-pulse',
    cardType: 'event',
    faction: 'shadow',
    name: '暗影脉冲',
    eventType: 'common',
    playPhase: 'attack',
    cost: 0,
    isActive: false,
    effect: '指定任意数量和一个或更多已受伤害的传送门相邻的单位为目标。对每个目标造成1点伤害。',
    deckSymbols: [DECK_SYMBOLS.MOON],
    spriteIndex: SPRITE_INDEX_SHADOW.EVENT_SHADOW_PULSE,
    spriteAtlas: 'cards',
  },
];

export const STRUCTURE_CARDS_SHADOW: StructureCard[] = [
  {
    id: 'shadow-starting-gate',
    cardType: 'structure',
    faction: 'shadow',
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
    id: 'shadow-portal',
    cardType: 'structure',
    faction: 'shadow',
    name: '传送门',
    cost: 0,
    life: 5,
    isGate: true,
    deckSymbols: [],
    spriteIndex: 1,
    spriteAtlas: 'portal',
  },
];

export function createShadowDeck(): {
  summoner: UnitCard;
  summonerPosition: CellCoord;
  startingUnits: { unit: UnitCard; position: CellCoord }[];
  startingGate: StructureCard;
  startingGatePosition: CellCoord;
  deck: (UnitCard | EventCard | StructureCard)[];
} {
  const deck: (UnitCard | EventCard | StructureCard)[] = [...CHAMPION_UNITS_SHADOW];

  for (const unit of COMMON_UNITS_SHADOW) {
    for (let i = 0; i < 4; i += 1) {
      deck.push({ ...unit, id: `${unit.id}-${i}` });
    }
  }

  for (const event of EVENT_CARDS_SHADOW) {
    for (let i = 0; i < 2; i += 1) {
      deck.push({ ...event, id: `${event.id}-${i}` });
    }
  }

  for (let i = 0; i < 3; i += 1) {
    deck.push({ ...STRUCTURE_CARDS_SHADOW[1], id: `shadow-portal-${i + 1}` });
  }

  const sageRover = COMMON_UNITS_SHADOW.find(unit => unit.id === 'shadow-sage-rover')!;
  const shadowMage = COMMON_UNITS_SHADOW.find(unit => unit.id === 'shadow-shadow-mage')!;

  return {
    summoner: SUMMONER_SHADOW,
    summonerPosition: { row: 0, col: 3 },
    startingUnits: [
      { unit: { ...sageRover, id: 'shadow-start-sage-rover' }, position: { row: 2, col: 3 } },
      { unit: { ...shadowMage, id: 'shadow-start-shadow-mage' }, position: { row: 2, col: 2 } },
    ],
    startingGate: { ...STRUCTURE_CARDS_SHADOW[0], id: 'shadow-starting-gate-0' },
    startingGatePosition: { row: 1, col: 3 },
    deck,
  };
}
