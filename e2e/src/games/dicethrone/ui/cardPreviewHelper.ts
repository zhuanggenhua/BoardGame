import type { CardPreviewRef } from '../../../core';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import {
    DEFAULT_COMMON_ATLAS_INDEX,
    GUNSLINGER_COMMON_ATLAS_INDEX,
    SAMURAI_COMMON_ATLAS_INDEX,
    type CommonCardAtlasIndexMap,
} from '../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS } from '../domain/ids';

/**
 * 所有英雄的卡牌预览映射（自动从 CHARACTER_DATA_MAP 收集）
 */
const ALL_CARDS_MAP = new Map<string, CardPreviewRef>();
const CHARACTER_ATLAS_ID_BY_CHARACTER = Object.fromEntries(
    Object.entries(DICETHRONE_CARD_ATLAS_IDS).map(([key, atlasId]) => [key.toLowerCase(), atlasId]),
) as Record<string, string>;

const normalizeCharacterId = (characterId: string) => characterId.toLowerCase().replace('-', '_');

const resolveCommonCardIndexMap = (characterId: string): CommonCardAtlasIndexMap => {
    const normalized = normalizeCharacterId(characterId);
    if (normalized === 'gunslinger') return GUNSLINGER_COMMON_ATLAS_INDEX;
    if (normalized === 'samurai') return SAMURAI_COMMON_ATLAS_INDEX;
    return DEFAULT_COMMON_ATLAS_INDEX;
};

const resolveCommonCardPreviewRef = (cardId: string, characterId: string): CardPreviewRef | null => {
    const normalized = normalizeCharacterId(characterId);
    const atlasId = CHARACTER_ATLAS_ID_BY_CHARACTER[normalized];
    if (!atlasId) return null;
    const index = resolveCommonCardIndexMap(normalized)[cardId];
    if (index === undefined) return null;
    return { type: 'atlas', atlasId, index };
};

// 初始化卡牌映射：遍历所有角色的 getStartingDeck，自动收集 previewRef
function initializeCardsMap() {
    if (ALL_CARDS_MAP.size > 0) return; // 已初始化

    const dummyRandom = {
        random: () => 0.5,
        d: () => 1,
        range: (min: number) => min,
        shuffle: <T>(arr: T[]) => arr,
    } as any;

    for (const data of Object.values(CHARACTER_DATA_MAP)) {
        const deck = data.getStartingDeck(dummyRandom);
        for (const card of deck) {
            if (card.previewRef && !ALL_CARDS_MAP.has(card.id)) {
                ALL_CARDS_MAP.set(card.id, card.previewRef);
            }
        }
    }
}

/**
 * 根据卡牌 ID 获取预览引用
 */
export function getDiceThroneCardPreviewRef(cardId: string, characterId?: string): CardPreviewRef | null {
    if (characterId) {
        const commonPreviewRef = resolveCommonCardPreviewRef(cardId, characterId);
        if (commonPreviewRef) {
            return commonPreviewRef;
        }
    }
    initializeCardsMap();
    return ALL_CARDS_MAP.get(cardId) ?? null;
}
