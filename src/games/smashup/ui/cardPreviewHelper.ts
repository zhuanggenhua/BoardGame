/**
 * 大杀四方 (Smash Up) - 卡牌预览映射
 *
 * 用于 ActionLog 的卡牌预览获取（基于卡牌定义的 previewRef）。
 */

import type { CardPreviewRef } from '../../../core';
import { getCardDef, getBaseDef } from '../data/cards';

interface CardPreviewMeta {
    name: string;
    previewRef: CardPreviewRef | null;
}

/**
 * 从 defId 中提取基础定义 ID
 * 运行时 uid 格式为 `defId-<序号>-<时间戳>` 或 `defId-<序号>`
 */
const normalizeCardId = (cardId: string): string => (
    cardId.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '')
);

/**
 * 获取 SmashUp 卡牌预览元数据
 */
export const getSmashUpCardPreviewMeta = (cardId: string): CardPreviewMeta | null => {
    const defId = normalizeCardId(cardId);

    // 先查普通卡牌（随从/行动卡）
    const cardDef = getCardDef(defId);
    if (cardDef) {
        return {
            name: cardDef.name,
            previewRef: cardDef.previewRef
                ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId } }
                : null,
        };
    }

    // 再查基地卡
    const baseDef = getBaseDef(defId);
    if (baseDef) {
        return {
            name: baseDef.name,
            previewRef: baseDef.previewRef
                ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId } }
                : null,
        };
    }

    return null;
};

/**
 * 获取 SmashUp 卡牌预览引用（供 cardPreviewRegistry 注册）
 */
export const getSmashUpCardPreviewRef = (cardId: string): CardPreviewRef | null => {
    return getSmashUpCardPreviewMeta(cardId)?.previewRef ?? null;
};
