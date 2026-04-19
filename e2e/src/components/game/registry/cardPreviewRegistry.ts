import type { CardPreviewRef } from '../../../core';

type GetCardPreviewRefFn = (cardId: string) => CardPreviewRef | null;

interface CardPreviewConfig {
    getter: GetCardPreviewRefFn;
    /** 预览最大尺寸（像素），默认 308 */
    maxDim?: number;
}

const registry = new Map<string, CardPreviewConfig>();

/**
 * 注册游戏的卡牌预览获取函数
 */
export function registerCardPreviewGetter(
    gameId: string,
    getter: GetCardPreviewRefFn,
    options?: { maxDim?: number },
): void {
    registry.set(gameId, { getter, maxDim: options?.maxDim });
}

/**
 * 获取游戏的卡牌预览获取函数
 */
export function getCardPreviewGetter(gameId: string): GetCardPreviewRefFn | undefined {
    return registry.get(gameId)?.getter;
}

/**
 * 获取游戏的卡牌预览最大尺寸
 */
export function getCardPreviewMaxDim(gameId: string): number | undefined {
    return registry.get(gameId)?.maxDim;
}
