import {
    CURSED_HOARD_SUITS_FANTASY_REALMS_CARDS,
    FANTASY_REALMS_CARD_REPLACEMENTS,
    FANTASY_REALMS_EXTRA_CARD_IDS,
    OFFICIAL_FANTASY_REALMS_CARDS,
} from './data/cards';
import type { FantasyRealmsRuntimeSetupConfig } from './roomSetup';

export type FantasyRealmsSuit =
    | '军队'
    | '神器'
    | '巨兽'
    | '烈焰'
    | '洪流'
    | '土地'
    | '领袖'
    | '武器'
    | '天象'
    | '野牌'
    | '法师'
    | '建筑'
    | '局外人'
    | '不死族';

export type TableCard = {
    id: string;
    suit: FantasyRealmsSuit;
    toneClass: string;
    name: string;
    displayNameZh: string;
    score: number;
    text: string;
    textZh: string;
    extraCard?: boolean;
    replacesBaseCardId?: string;
};

export type FantasyRealmsScoreLine = {
    label: string;
    value: number;
};

export type FantasyRealmsScoreCardDelta = {
    cardId: string;
    label: string;
    baseScore: number;
    bonus: number;
    penalty: number;
    totalDelta: number;
    isVirtual?: boolean;
};

export const FANTASY_REALMS_BASE_HAND_CARD_SLOTS = 7;
export const FANTASY_REALMS_CURSED_HOARD_SUITS_HAND_CARD_SLOTS = 8;
export const FANTASY_REALMS_HAND_CARD_SLOTS = FANTASY_REALMS_BASE_HAND_CARD_SLOTS;
export const FANTASY_REALMS_STANDARD_DISCARD_END_THRESHOLD = 10;
export const FANTASY_REALMS_DUEL_DISCARD_END_THRESHOLD = 12;
export const FANTASY_REALMS_CURSED_HOARD_DUEL_DISCARD_END_THRESHOLD = 14;

const CURSED_HOARD_REPLACED_BASE_IDS = new Set(FANTASY_REALMS_CARD_REPLACEMENTS.keys());

export const RUNTIME_DECK_CARDS: TableCard[] = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
// Foundation fallback 只取基础卡表前 14 张做静态卡位样例，不代表正式对局中的公开区规则。
export const PUBLIC_CARDS: TableCard[] = RUNTIME_DECK_CARDS.slice(0, 7).map((card) => ({ ...card }));
export const HAND_CARDS: TableCard[] = RUNTIME_DECK_CARDS.slice(7, 14).map((card) => ({ ...card }));

export const EMPTY_FOCUS_INSIGHT = {
    kicker: '双人变体',
    estimatedDelta: 0,
};

export function cloneTableCards(cards: readonly TableCard[]): TableCard[] {
    return cards.map((card) => ({ ...card }));
}

export function isFantasyRealmsCursedHoardSuitsEnabled(
    setupConfig?: Pick<FantasyRealmsRuntimeSetupConfig, 'cursedHoardSuitsEnabled'> | null,
): boolean {
    return setupConfig?.cursedHoardSuitsEnabled === true;
}

export function getFantasyRealmsBaseHandLimit(
    setupConfig?: Pick<FantasyRealmsRuntimeSetupConfig, 'cursedHoardSuitsEnabled'> | null,
): number {
    return isFantasyRealmsCursedHoardSuitsEnabled(setupConfig)
        ? FANTASY_REALMS_CURSED_HOARD_SUITS_HAND_CARD_SLOTS
        : FANTASY_REALMS_BASE_HAND_CARD_SLOTS;
}

export function getFantasyRealmsCurrentHandLimit(
    hand: readonly Pick<TableCard, 'id' | 'extraCard'>[],
    setupConfig?: Pick<FantasyRealmsRuntimeSetupConfig, 'cursedHoardSuitsEnabled'> | null,
): number {
    const baseLimit = getFantasyRealmsBaseHandLimit(setupConfig);
    return hand.some((card) => card.extraCard === true || FANTASY_REALMS_EXTRA_CARD_IDS.has(card.id))
        ? baseLimit + 1
        : baseLimit;
}

export function getFantasyRealmsDiscardEndThreshold(
    playerCount: number,
    setupConfig?: Pick<FantasyRealmsRuntimeSetupConfig, 'cursedHoardSuitsEnabled'> | null,
): number {
    if (playerCount > 2) {
        return FANTASY_REALMS_STANDARD_DISCARD_END_THRESHOLD;
    }
    return isFantasyRealmsCursedHoardSuitsEnabled(setupConfig)
        ? FANTASY_REALMS_CURSED_HOARD_DUEL_DISCARD_END_THRESHOLD
        : FANTASY_REALMS_DUEL_DISCARD_END_THRESHOLD;
}

export function getFantasyRealmsCardDisplayName(card?: Pick<TableCard, 'name' | 'displayNameZh'> | null): string {
    if (!card) return '';
    return card.displayNameZh.trim().length > 0 ? card.displayNameZh : card.name;
}

export function getFantasyRealmsCardRuleText(
    card?: Pick<TableCard, 'text' | 'textZh'> | null,
    locale?: string,
): string {
    if (!card) return '';
    const prefersZh = typeof locale === 'string' && locale.toLowerCase().startsWith('zh');
    if (prefersZh && card.textZh.trim().length > 0) {
        return card.textZh;
    }
    return card.text;
}

export function createRuntimeDeck(
    setupConfig?: Pick<FantasyRealmsRuntimeSetupConfig, 'cursedHoardSuitsEnabled'> | null,
): TableCard[] {
    if (!isFantasyRealmsCursedHoardSuitsEnabled(setupConfig)) {
        return cloneTableCards(RUNTIME_DECK_CARDS);
    }

    return cloneTableCards([
        ...OFFICIAL_FANTASY_REALMS_CARDS.filter((card) => !CURSED_HOARD_REPLACED_BASE_IDS.has(card.id)),
        ...CURSED_HOARD_SUITS_FANTASY_REALMS_CARDS,
    ]);
}
