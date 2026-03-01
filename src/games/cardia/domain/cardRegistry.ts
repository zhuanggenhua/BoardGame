/**
 * Cardia 卡牌注册表
 * 定义所有人物卡牌的元数据
 */

import type { FactionId, AbilityId, DeckVariantId, CardId } from './ids';
import { FACTION_IDS, ABILITY_IDS, CARD_IDS_DECK_I, CARD_IDS_DECK_II } from './ids';

/**
 * 卡牌定义接口
 */
export interface CardDef {
    id: CardId;
    influence: number;
    faction: FactionId;
    abilityIds: AbilityId[];
    difficulty: number;
    deckVariant: DeckVariantId;
    nameKey: string;
    descriptionKey: string;
    imagePath: string;  // 图片路径（不含扩展名，不含 compressed/）
}

/**
 * I 牌组卡牌定义（16 张）
 */
export const DECK_I_CARDS: CardDef[] = [
    {
        id: CARD_IDS_DECK_I.CARD_01,
        influence: 1,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.MERCENARY_SWORDSMAN],
        difficulty: 0,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_01.name',
        descriptionKey: 'cards.deck_i_card_01.description',
        imagePath: 'cardia/cards/deck1/1',
    },
    {
        id: CARD_IDS_DECK_I.CARD_02,
        influence: 2,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.VOID_MAGE],
        difficulty: 0,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_02.name',
        descriptionKey: 'cards.deck_i_card_02.description',
        imagePath: 'cardia/cards/deck1/2',
    },
    {
        id: CARD_IDS_DECK_I.CARD_03,
        influence: 3,
        faction: FACTION_IDS.GUILD,
        abilityIds: [ABILITY_IDS.SURGEON],
        difficulty: 0,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_03.name',
        descriptionKey: 'cards.deck_i_card_03.description',
        imagePath: 'cardia/cards/deck1/3',
    },
    {
        id: CARD_IDS_DECK_I.CARD_04,
        influence: 4,
        faction: FACTION_IDS.DYNASTY,
        abilityIds: [ABILITY_IDS.MEDIATOR],
        difficulty: 0,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_04.name',
        descriptionKey: 'cards.deck_i_card_04.description',
        imagePath: 'cardia/cards/deck1/4',
    },
    {
        id: CARD_IDS_DECK_I.CARD_05,
        influence: 5,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.SABOTEUR],
        difficulty: 1,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_05.name',
        descriptionKey: 'cards.deck_i_card_05.description',
        imagePath: 'cardia/cards/deck1/5',
    },
    {
        id: CARD_IDS_DECK_I.CARD_06,
        influence: 6,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.DIVINER],
        difficulty: 1,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_06.name',
        descriptionKey: 'cards.deck_i_card_06.description',
        imagePath: 'cardia/cards/deck1/6',
    },
    {
        id: CARD_IDS_DECK_I.CARD_07,
        influence: 7,
        faction: FACTION_IDS.GUILD,
        abilityIds: [ABILITY_IDS.COURT_GUARD],
        difficulty: 1,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_07.name',
        descriptionKey: 'cards.deck_i_card_07.description',
        imagePath: 'cardia/cards/deck1/7',
    },
    {
        id: CARD_IDS_DECK_I.CARD_08,
        influence: 8,
        faction: FACTION_IDS.DYNASTY,
        abilityIds: [ABILITY_IDS.MAGISTRATE],
        difficulty: 1,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_08.name',
        descriptionKey: 'cards.deck_i_card_08.description',
        imagePath: 'cardia/cards/deck1/8',
    },
    {
        id: CARD_IDS_DECK_I.CARD_09,
        influence: 9,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.AMBUSHER],
        difficulty: 2,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_09.name',
        descriptionKey: 'cards.deck_i_card_09.description',
        imagePath: 'cardia/cards/deck1/9',
    },
    {
        id: CARD_IDS_DECK_I.CARD_10,
        influence: 10,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.PUPPETEER],
        difficulty: 2,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_10.name',
        descriptionKey: 'cards.deck_i_card_10.description',
        imagePath: 'cardia/cards/deck1/10',
    },
    {
        id: CARD_IDS_DECK_I.CARD_11,
        influence: 11,
        faction: FACTION_IDS.GUILD,
        abilityIds: [ABILITY_IDS.CLOCKMAKER],
        difficulty: 2,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_11.name',
        descriptionKey: 'cards.deck_i_card_11.description',
        imagePath: 'cardia/cards/deck1/11',
    },
    {
        id: CARD_IDS_DECK_I.CARD_12,
        influence: 12,
        faction: FACTION_IDS.DYNASTY,
        abilityIds: [ABILITY_IDS.TREASURER],
        difficulty: 2,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_12.name',
        descriptionKey: 'cards.deck_i_card_12.description',
        imagePath: 'cardia/cards/deck1/12',
    },
    {
        id: CARD_IDS_DECK_I.CARD_13,
        influence: 13,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.SWAMP_GUARD],
        difficulty: 3,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_13.name',
        descriptionKey: 'cards.deck_i_card_13.description',
        imagePath: 'cardia/cards/deck1/13',
    },
    {
        id: CARD_IDS_DECK_I.CARD_14,
        influence: 14,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.GOVERNESS],
        difficulty: 3,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_14.name',
        descriptionKey: 'cards.deck_i_card_14.description',
        imagePath: 'cardia/cards/deck1/14',
    },
    {
        id: CARD_IDS_DECK_I.CARD_15,
        influence: 15,
        faction: FACTION_IDS.GUILD,
        abilityIds: [ABILITY_IDS.INVENTOR],
        difficulty: 3,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_15.name',
        descriptionKey: 'cards.deck_i_card_15.description',
        imagePath: 'cardia/cards/deck1/15',
    },
    {
        id: CARD_IDS_DECK_I.CARD_16,
        influence: 16,
        faction: FACTION_IDS.DYNASTY,
        abilityIds: [ABILITY_IDS.ELF],
        difficulty: 3,
        deckVariant: 'I',
        nameKey: 'cards.deck_i_card_16.name',
        descriptionKey: 'cards.deck_i_card_16.description',
        imagePath: 'cardia/cards/deck1/16',
    },
];

/**
 * II 牌组卡牌定义（16 张）
 */
export const DECK_II_CARDS: CardDef[] = [
    {
        id: CARD_IDS_DECK_II.CARD_01,
        influence: 1,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.POISONER],
        difficulty: 1,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_01.name',
        descriptionKey: 'cards.deck_ii_card_01.description',
        imagePath: 'cardia/cards/deck2/1',
    },
    {
        id: CARD_IDS_DECK_II.CARD_02,
        influence: 2,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.TELEKINETIC_MAGE],
        difficulty: 1,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_02.name',
        descriptionKey: 'cards.deck_ii_card_02.description',
        imagePath: 'cardia/cards/deck2/2',
    },
    {
        id: CARD_IDS_DECK_II.CARD_03,
        influence: 3,
        faction: FACTION_IDS.GUILD,
        abilityIds: [ABILITY_IDS.MESSENGER],
        difficulty: 1,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_03.name',
        descriptionKey: 'cards.deck_ii_card_03.description',
        imagePath: 'cardia/cards/deck2/3',
    },
    {
        id: CARD_IDS_DECK_II.CARD_04,
        influence: 4,
        faction: FACTION_IDS.DYNASTY,
        abilityIds: [ABILITY_IDS.TAX_COLLECTOR],
        difficulty: 1,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_04.name',
        descriptionKey: 'cards.deck_ii_card_04.description',
        imagePath: 'cardia/cards/deck2/4',
    },
    {
        id: CARD_IDS_DECK_II.CARD_05,
        influence: 5,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.REVOLUTIONARY],
        difficulty: 2,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_05.name',
        descriptionKey: 'cards.deck_ii_card_05.description',
        imagePath: 'cardia/cards/deck2/5',
    },
    {
        id: CARD_IDS_DECK_II.CARD_06,
        influence: 6,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.LIBRARIAN],
        difficulty: 2,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_06.name',
        descriptionKey: 'cards.deck_ii_card_06.description',
        imagePath: 'cardia/cards/deck2/6',
    },
    {
        id: CARD_IDS_DECK_II.CARD_07,
        influence: 7,
        faction: FACTION_IDS.GUILD,
        abilityIds: [ABILITY_IDS.GENIUS],
        difficulty: 2,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_07.name',
        descriptionKey: 'cards.deck_ii_card_07.description',
        imagePath: 'cardia/cards/deck2/7',
    },
    {
        id: CARD_IDS_DECK_II.CARD_08,
        influence: 8,
        faction: FACTION_IDS.DYNASTY,
        abilityIds: [ABILITY_IDS.NOBLE],
        difficulty: 2,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_08.name',
        descriptionKey: 'cards.deck_ii_card_08.description',
        imagePath: 'cardia/cards/deck2/8',
    },
    {
        id: CARD_IDS_DECK_II.CARD_09,
        influence: 9,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.EXTORTIONIST],
        difficulty: 3,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_09.name',
        descriptionKey: 'cards.deck_ii_card_09.description',
        imagePath: 'cardia/cards/deck2/9',
    },
    {
        id: CARD_IDS_DECK_II.CARD_10,
        influence: 10,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.ILLUSIONIST],
        difficulty: 3,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_10.name',
        descriptionKey: 'cards.deck_ii_card_10.description',
        imagePath: 'cardia/cards/deck2/10',
    },
    {
        id: CARD_IDS_DECK_II.CARD_11,
        influence: 11,
        faction: FACTION_IDS.GUILD,
        abilityIds: [ABILITY_IDS.ENGINEER],
        difficulty: 3,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_11.name',
        descriptionKey: 'cards.deck_ii_card_11.description',
        imagePath: 'cardia/cards/deck2/11',
    },
    {
        id: CARD_IDS_DECK_II.CARD_12,
        influence: 12,
        faction: FACTION_IDS.DYNASTY,
        abilityIds: [ABILITY_IDS.ADVISOR],
        difficulty: 4,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_12.name',
        descriptionKey: 'cards.deck_ii_card_12.description',
        imagePath: 'cardia/cards/deck2/12',
    },
    {
        id: CARD_IDS_DECK_II.CARD_13,
        influence: 13,
        faction: FACTION_IDS.SWAMP,
        abilityIds: [ABILITY_IDS.WITCH_KING],
        difficulty: 4,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_13.name',
        descriptionKey: 'cards.deck_ii_card_13.description',
        imagePath: 'cardia/cards/deck2/13',
    },
    {
        id: CARD_IDS_DECK_II.CARD_14,
        influence: 14,
        faction: FACTION_IDS.ACADEMY,
        abilityIds: [ABILITY_IDS.ELEMENTALIST],
        difficulty: 4,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_14.name',
        descriptionKey: 'cards.deck_ii_card_14.description',
        imagePath: 'cardia/cards/deck2/14',
    },
    {
        id: CARD_IDS_DECK_II.CARD_15,
        influence: 15,
        faction: FACTION_IDS.GUILD,
        abilityIds: [ABILITY_IDS.MECHANICAL_SPIRIT],
        difficulty: 5,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_15.name',
        descriptionKey: 'cards.deck_ii_card_15.description',
        imagePath: 'cardia/cards/deck2/15',
    },
    {
        id: CARD_IDS_DECK_II.CARD_16,
        influence: 16,
        faction: FACTION_IDS.DYNASTY,
        abilityIds: [ABILITY_IDS.HEIR],
        difficulty: 5,
        deckVariant: 'II',
        nameKey: 'cards.deck_ii_card_16.name',
        descriptionKey: 'cards.deck_ii_card_16.description',
        imagePath: 'cardia/cards/deck2/16',
    },
];

/**
 * 所有卡牌定义
 */
export const ALL_CARDS: CardDef[] = [...DECK_I_CARDS, ...DECK_II_CARDS];

/**
 * 卡牌注册表（Map 结构，快速查询）
 */
const cardRegistry = new Map<CardId, CardDef>(
    ALL_CARDS.map(card => [card.id, card])
);

export default cardRegistry;

/**
 * 辅助查询函数
 */

/**
 * 根据牌组变体获取卡牌列表
 */
export function getCardsByDeckVariant(variant: DeckVariantId): CardDef[] {
    return variant === 'I' ? DECK_I_CARDS : DECK_II_CARDS;
}

/**
 * 根据派系获取卡牌列表
 */
export function getCardsByFaction(faction: FactionId): CardDef[] {
    return ALL_CARDS.filter(card => card.faction === faction);
}

/**
 * 根据影响力值获取卡牌
 */
export function getCardByInfluence(influence: number, variant: DeckVariantId): CardDef | undefined {
    const cards = getCardsByDeckVariant(variant);
    return cards.find(card => card.influence === influence);
}
