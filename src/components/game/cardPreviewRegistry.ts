import type { CardPreviewRef } from '../../systems/CardSystem';

type GetCardPreviewRefFn = (cardId: string) => CardPreviewRef | null;

const registry = new Map<string, GetCardPreviewRefFn>();

/**
 * 注册游戏的卡牌预览获取函数
 */
export function registerCardPreviewGetter(gameId: string, getter: GetCardPreviewRefFn): void {
    registry.set(gameId, getter);
}

/**
 * 获取游戏的卡牌预览获取函数
 */
export function getCardPreviewGetter(gameId: string): GetCardPreviewRefFn | undefined {
    return registry.get(gameId);
}
