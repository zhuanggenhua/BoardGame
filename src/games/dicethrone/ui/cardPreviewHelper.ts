import type { CardPreviewRef } from '../../../core';
import { CHARACTER_DATA_MAP } from '../domain/characters';

/**
 * 所有英雄的卡牌预览映射（自动从 CHARACTER_DATA_MAP 收集）
 */
const ALL_CARDS_MAP = new Map<string, CardPreviewRef>();
const CHARACTER_CARD_PREVIEW_MAP = new Map<string, CardPreviewRef | null>();
let cardsMapInitialized = false;

const normalizeCharacterId = (characterId: string) => characterId.toLowerCase().replace('-', '_');

const buildCharacterCardKey = (characterId: string, cardId: string) => `${normalizeCharacterId(characterId)}::${cardId}`;

// 初始化卡牌映射：遍历所有角色的 getStartingDeck，自动收集 previewRef
function initializeCardsMap() {
    if (cardsMapInitialized) return;

    const dummyRandom = {
        random: () => 0.5,
        d: () => 1,
        range: (min: number) => min,
        shuffle: <T>(arr: T[]) => arr,
    } as any;

    for (const [characterId, data] of Object.entries(CHARACTER_DATA_MAP)) {
        const deck = data.getStartingDeck(dummyRandom);
        for (const card of deck) {
            CHARACTER_CARD_PREVIEW_MAP.set(buildCharacterCardKey(characterId, card.id), card.previewRef ?? null);
            if (card.previewRef && !ALL_CARDS_MAP.has(card.id)) {
                ALL_CARDS_MAP.set(card.id, card.previewRef);
            }
        }
    }
    cardsMapInitialized = true;
}

const resolveCharacterCardPreviewRef = (cardId: string, characterId: string): CardPreviewRef | null => {
    initializeCardsMap();
    const key = buildCharacterCardKey(characterId, cardId);
    return CHARACTER_CARD_PREVIEW_MAP.has(key)
        ? CHARACTER_CARD_PREVIEW_MAP.get(key) ?? null
        : null;
}

/**
 * 根据卡牌 ID 获取预览引用
 */
export function getDiceThroneCardPreviewRef(cardId: string, characterId?: string): CardPreviewRef | null {
    if (characterId) {
        return resolveCharacterCardPreviewRef(cardId, characterId);
    }
    initializeCardsMap();
    return ALL_CARDS_MAP.get(cardId) ?? null;
}
