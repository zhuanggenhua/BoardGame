/**
 * Cardia - 卡牌预览辅助函数
 *
 * 用于 ActionLog 的卡牌预览获取（基于卡牌定义的 previewRef）。
 */

import type { CardPreviewRef } from '../../../core/types';
import { CARD_IDS_DECK_I, CARD_IDS_DECK_II } from '../domain/ids';
import type { CardId } from '../domain/ids';
import cardRegistry from '../domain/cardRegistry';

const CARD_ID_SET = new Set<string>([
    ...Object.values(CARD_IDS_DECK_I),
    ...Object.values(CARD_IDS_DECK_II),
]);

const isCardId = (value: string): value is CardId => CARD_ID_SET.has(value);

/**
 * 卡牌预览元数据
 */
export interface CardPreviewMeta {
    name: string;
    previewRef: CardPreviewRef | null;
}

/**
 * 获取 Cardia 卡牌预览元数据
 * 
 * @param cardIdOrUid - 卡牌 ID 或 UID（格式：defId_timestamp_random）
 * @returns 卡牌预览元数据，如果卡牌不存在则返回 null
 */
export function getCardiaCardPreviewMeta(cardIdOrUid: string): CardPreviewMeta | null {
    // 从 UID 中提取 defId（格式：defId_timestamp_random）
    // 例如：deck_i_card_09_1775881348955_eiii1tdrz -> deck_i_card_09
    const defId = cardIdOrUid.split('_').slice(0, 4).join('_');
    if (!isCardId(defId)) return null;

    const cardDef = cardRegistry.get(defId);
    if (!cardDef) return null;

    return {
        name: cardDef.nameKey,
        previewRef: {
            type: 'image',
            src: cardDef.imagePath,
            aspectRatio: 106 / 160, // Cardia 卡牌宽高比
        },
    };
}

/**
 * 获取 Cardia 卡牌预览引用（供 cardPreviewRegistry 注册）
 * 
 * @param cardIdOrUid - 卡牌 ID 或 UID（格式：defId_timestamp_random）
 * @returns 卡牌预览引用，如果卡牌不存在则返回 null
 */
export function getCardiaCardPreviewRef(cardIdOrUid: string): CardPreviewRef | null {
    return getCardiaCardPreviewMeta(cardIdOrUid)?.previewRef ?? null;
}
