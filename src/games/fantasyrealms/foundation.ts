import { OFFICIAL_FANTASY_REALMS_CARDS } from './data/cards';

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
    | '法师';

export type TableCard = {
    id: string;
    suit: FantasyRealmsSuit;
    toneClass: string;
    name: string;
    displayNameZh: string;
    score: number;
    text: string;
    textZh: string;
};

export type FantasyRealmsScoreLine = {
    label: string;
    value: number;
};

export const FANTASY_REALMS_HAND_CARD_SLOTS = 7;
export const FANTASY_REALMS_STANDARD_DISCARD_END_THRESHOLD = 10;
export const FANTASY_REALMS_DUEL_DISCARD_END_THRESHOLD = 12;

export function getFantasyRealmsDiscardEndThreshold(playerCount: number): number {
    return playerCount <= 2
        ? FANTASY_REALMS_DUEL_DISCARD_END_THRESHOLD
        : FANTASY_REALMS_STANDARD_DISCARD_END_THRESHOLD;
}

export const RUNTIME_DECK_CARDS: TableCard[] = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
// Foundation fallback 只取官方卡表中的前 14 张做静态卡位样例，不代表正式对局中的公开区规则。
export const PUBLIC_CARDS: TableCard[] = RUNTIME_DECK_CARDS.slice(0, 7).map((card) => ({ ...card }));
export const HAND_CARDS: TableCard[] = RUNTIME_DECK_CARDS.slice(7, 14).map((card) => ({ ...card }));

export const EMPTY_FOCUS_INSIGHT = {
    kicker: '双人变体',
    estimatedDelta: 0,
};

export function cloneTableCards(cards: TableCard[]): TableCard[] {
    return cards.map((card) => ({ ...card }));
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

export function createRuntimeDeck(): TableCard[] {
    return cloneTableCards(RUNTIME_DECK_CARDS);
}
