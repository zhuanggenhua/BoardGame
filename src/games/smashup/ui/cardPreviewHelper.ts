/**
 * 大杀四方 (Smash Up) - 卡牌预览映射
 *
 * 用于 ActionLog 的卡牌预览获取（基于卡牌定义的 previewRef）。
 */

import type { CardPreviewRef } from '../../../core';
import { getCardDef, getBaseDef, getTitanDef } from '../data/cards';
import smashUpEnglishMap from '../data/englishAtlasMap.json';

interface CardPreviewMeta {
    name: string;
    previewRef: CardPreviewRef | null;
}

const TTS_MAP = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

/**
 * 从 defId 中提取基础定义 ID
 * 运行时 uid 格式为 `defId-<序号>-<时间戳>` 或 `defId-<序号>`
 */
const normalizeCardId = (cardId: string): string => (
    cardId.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '')
);

export const getSmashUpRendererPreviewRef = (
    cardId: string,
    payload: Record<string, unknown> = {},
): CardPreviewRef | null => {
    const defId = normalizeCardId(cardId);
    const cardDef = getCardDef(defId);
    const baseDef = getBaseDef(defId);
    const titanDef = getTitanDef(defId);
    const hasRenderablePreview = Boolean(
        cardDef?.previewRef
        || baseDef?.previewRef
        || titanDef?.previewRef
        || TTS_MAP[defId]
        || TTS_MAP[`${defId}_pod`],
    );

    if (!hasRenderablePreview) {
        return null;
    }

    return {
        type: 'renderer',
        rendererId: 'smashup-card-renderer',
        payload: { defId, ...payload },
    };
};

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
            previewRef: getSmashUpRendererPreviewRef(defId),
        };
    }

    // 再查基地卡
    const baseDef = getBaseDef(defId);
    if (baseDef) {
        return {
            name: baseDef.name,
            previewRef: getSmashUpRendererPreviewRef(defId),
        };
    }

    const titanDef = getTitanDef(defId);
    if (titanDef) {
        return {
            name: titanDef.name,
            previewRef: getSmashUpRendererPreviewRef(defId),
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
