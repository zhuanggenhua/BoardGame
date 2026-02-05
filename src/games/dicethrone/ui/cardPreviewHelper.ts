import type { CardPreviewRef } from '../../../systems/CardSystem';
import { MONK_CARDS } from '../monk/cards';
import { BARBARIAN_CARDS } from '../barbarian/cards';

/**
 * 所有英雄的卡牌定义
 */
const ALL_CARDS_MAP = new Map<string, CardPreviewRef | undefined>();

// 初始化卡牌映射
function initializeCardsMap() {
    if (ALL_CARDS_MAP.size > 0) return; // 已初始化

    const allCards = [
        ...MONK_CARDS,
        ...BARBARIAN_CARDS,
    ];

    for (const card of allCards) {
        if (card.previewRef) {
            ALL_CARDS_MAP.set(card.id, card.previewRef);
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
