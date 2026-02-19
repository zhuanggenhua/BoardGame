import type { CardPreviewRef } from '../../../core';
import { CHARACTER_DATA_MAP } from '../domain/characters';

/**
 * 所有英雄的卡牌预览映射（自动从 CHARACTER_DATA_MAP 收集）
 */
const ALL_CARDS_MAP = new Map<string, CardPreviewRef>();

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
export function getDiceThroneCardPreviewRef(cardId: string): CardPreviewRef | null {
    initializeCardsMap();
    return ALL_CARDS_MAP.get(cardId) ?? null;
}
