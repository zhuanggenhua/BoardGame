/**
 * Cardia 牌库初始化逻辑
 */

import type { RandomFn, PlayerId } from '../../../engine/types';
import type { CardInstance } from './core-types';
import type { DeckVariantId } from './ids';
import { getCardsByDeckVariant, type CardDef } from './cardRegistry';
import { createModifierStack } from '../../../engine/primitives/modifier';
import { createTagContainer } from '../../../engine/primitives/tags';

/**
 * 为玩家创建初始牌库
 * @param playerId 玩家ID
 * @param variant 牌组变体（I 或 II）
 * @param random 随机函数
 * @returns 卡牌实例数组（已洗牌）
 */
export function createInitialDeck(
    playerId: PlayerId,
    variant: DeckVariantId,
    random: RandomFn
): CardInstance[] {
    // 获取该牌组的所有卡牌定义
    const cardDefs = getCardsByDeckVariant(variant);
    
    // 创建卡牌实例
    const cards: CardInstance[] = cardDefs.map(def => 
        createCardInstanceFromDef(def, playerId)
    );
    
    // 洗牌
    return shuffleArray(cards, random);
}

/**
 * 从卡牌定义创建卡牌实例
 */
export function createCardInstanceFromDef(
    def: CardDef,
    ownerId: PlayerId
): CardInstance {
    return {
        uid: `${def.id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        defId: def.id,
        ownerId,
        baseInfluence: def.influence,
        faction: def.faction,
        abilityIds: def.abilityIds,
        difficulty: def.difficulty,
        modifiers: createModifierStack(),
        tags: createTagContainer(),
        signets: 0,
        ongoingMarkers: [],  // 初始化为空数组
        imagePath: def.imagePath,
    };
}

/**
 * 洗牌算法（Fisher-Yates）
 */
export function shuffleArray<T>(array: T[], random: RandomFn): T[] {
    const result = [...array];
    
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
}

/**
 * 从牌库抽取指定数量的卡牌
 */
export function drawCards(
    deck: CardInstance[],
    count: number
): { drawn: CardInstance[]; remaining: CardInstance[] } {
    const drawn = deck.slice(0, count);
    const remaining = deck.slice(count);
    
    return { drawn, remaining };
}

/**
 * 混洗牌库
 */
export function shuffleDeck(
    deck: CardInstance[],
    random: RandomFn
): CardInstance[] {
    return shuffleArray(deck, random);
}
