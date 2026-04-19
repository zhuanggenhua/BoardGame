import type { PlayerId } from '../../../engine/types';
import type { FactionType, CardiaCore, CardInstance, PlayedCard } from './core-types';
import { calculateCurrentInfluence, getCardModifiers } from './utils';

/**
 * 卡牌选择交互
 */
export interface CardSelectionInteraction {
    type: 'card_selection';
    interactionId: string;
    abilityId: string;  // 能力 ID（用于查找交互处理器）
    playerId: PlayerId;
    title: string;
    description: string;
    availableCards: string[];  // 可选卡牌 UID 列表
    disabledCards?: string[];  // 禁用的卡牌 UID 列表（显示但不可选）
    minSelect: number;
    maxSelect: number;
    filter?: CardFilter;
    cardId?: string;  // ✅ 添加：触发能力的卡牌 ID（用于交互处理器）
}

/**
 * 派系选择交互
 */
export interface FactionSelectionInteraction {
    type: 'faction_selection';
    interactionId: string;
    abilityId: string;  // 能力 ID（用于查找交互处理器）
    playerId: PlayerId;
    title: string;
    description: string;
}

/**
 * 修正标记选择交互
 */
export interface ModifierSelectionInteraction {
    type: 'modifier_selection';
    interactionId: string;
    abilityId: string;  // 能力 ID（用于查找交互处理器）
    playerId: PlayerId;
    title: string;
    description: string;
    availableModifiers: number[];  // 可选修正值
}

/**
 * Cardia 交互联合类型
 */
export type CardiaInteraction = 
    | CardSelectionInteraction
    | FactionSelectionInteraction
    | ModifierSelectionInteraction;

/**
 * 卡牌过滤器
 */
export interface CardFilter {
    maxInfluence?: number;
    minInfluence?: number;
    hasInstantAbility?: boolean;
    faction?: FactionType;
    owner?: PlayerId;
    location?: 'field' | 'hand' | 'discard';
}

/**
 * 创建卡牌选择交互
 */
export function createCardSelectionInteraction(
    interactionId: string,
    abilityId: string,
    playerId: PlayerId,
    title: string,
    description: string,
    minSelect: number,
    maxSelect: number,
    filter?: CardFilter,
    cardId?: string  // ✅ 添加：触发能力的卡牌 ID
): CardSelectionInteraction {
    return {
        type: 'card_selection',
        interactionId,
        abilityId,
        playerId,
        title,
        description,
        availableCards: [],  // 将在 filterCards 中填充
        minSelect,
        maxSelect,
        filter,
        cardId,  // ✅ 添加：保存 cardId
    };
}

/**
 * 过滤卡牌
 * 根据过滤器条件从核心状态中筛选符合条件的卡牌
 */
export function filterCards(
    core: CardiaCore,
    filter: CardFilter
): string[] {
    const cards: (CardInstance | PlayedCard)[] = [];
    
    // 1. 根据位置收集卡牌
    if (!filter.location || filter.location === 'field') {
        // 场上卡牌
        for (const player of Object.values(core.players)) {
            if (!filter.owner || player.id === filter.owner) {
                cards.push(...player.playedCards);
            }
        }
    }
    
    if (!filter.location || filter.location === 'hand') {
        // 手牌
        for (const player of Object.values(core.players)) {
            if (!filter.owner || player.id === filter.owner) {
                cards.push(...player.hand);
            }
        }
    }
    
    if (!filter.location || filter.location === 'discard') {
        // 弃牌堆
        for (const player of Object.values(core.players)) {
            if (!filter.owner || player.id === filter.owner) {
                cards.push(...player.discard);
            }
        }
    }
    
    // 2. 应用过滤条件
    const filteredCards = cards.filter(card => {
        // 2.1 派系过滤
        if (filter.faction && card.faction !== filter.faction) {
            return false;
        }
        
        // 2.2 影响力过滤（使用当前影响力，包含修正）
        const modifiers = getCardModifiers(core, card.uid);
        const currentInfluence = calculateCurrentInfluence(card.baseInfluence, modifiers);
        
        if (filter.minInfluence !== undefined && currentInfluence < filter.minInfluence) {
            return false;
        }
        
        if (filter.maxInfluence !== undefined && currentInfluence > filter.maxInfluence) {
            return false;
        }
        
        // 2.3 即时能力过滤
        if (filter.hasInstantAbility !== undefined) {
            const hasAbility = card.abilityIds.length > 0;
            if (filter.hasInstantAbility !== hasAbility) {
                return false;
            }
        }
        
        return true;
    });
    
    // 3. 返回卡牌 UID 列表
    return filteredCards.map(card => card.uid);
}

/**
 * 验证卡牌选择
 * 检查玩家选择的卡牌是否符合交互要求
 */
export function validateCardSelection(
    interaction: CardSelectionInteraction,
    selectedCardIds: string[]
): { valid: boolean; error?: string } {
    // 1. 检查选择数量
    if (selectedCardIds.length < interaction.minSelect) {
        return {
            valid: false,
            error: `至少需要选择 ${interaction.minSelect} 张卡牌`,
        };
    }
    
    if (selectedCardIds.length > interaction.maxSelect) {
        return {
            valid: false,
            error: `最多只能选择 ${interaction.maxSelect} 张卡牌`,
        };
    }
    
    // 2. 检查所有选择的卡牌是否在可选列表中
    for (const cardId of selectedCardIds) {
        if (!interaction.availableCards.includes(cardId)) {
            return {
                valid: false,
                error: `卡牌 ${cardId} 不在可选列表中`,
            };
        }
    }
    
    return { valid: true };
}

/**
 * 创建派系选择交互
 */
export function createFactionSelectionInteraction(
    interactionId: string,
    abilityId: string,
    playerId: PlayerId,
    title: string,
    description: string
): FactionSelectionInteraction {
    return {
        type: 'faction_selection',
        interactionId,
        abilityId,
        playerId,
        title,
        description,
    };
}

/**
 * 获取所有可选派系
 */
export function getAvailableFactions(): FactionType[] {
    return ['swamp', 'academy', 'guild', 'dynasty'];
}

/**
 * 验证派系选择
 * 检查玩家选择的派系是否有效
 */
export function validateFactionSelection(
    faction: FactionType
): { valid: boolean; error?: string } {
    const availableFactions = getAvailableFactions();
    
    if (!availableFactions.includes(faction)) {
        return {
            valid: false,
            error: `无效的派系: ${faction}`,
        };
    }
    
    return { valid: true };
}

/**
 * 创建修正标记选择交互
 */
export function createModifierSelectionInteraction(
    interactionId: string,
    abilityId: string,
    playerId: PlayerId,
    title: string,
    description: string,
    availableModifiers: number[]
): ModifierSelectionInteraction {
    return {
        type: 'modifier_selection',
        interactionId,
        abilityId,
        playerId,
        title,
        description,
        availableModifiers,
    };
}

/**
 * 验证修正标记选择
 * 检查玩家选择的修正值是否有效
 */
export function validateModifierSelection(
    interaction: ModifierSelectionInteraction,
    selectedModifier: number
): { valid: boolean; error?: string } {
    if (!interaction.availableModifiers.includes(selectedModifier)) {
        return {
            valid: false,
            error: `无效的修正值: ${selectedModifier}`,
        };
    }
    
    return { valid: true };
}

/**
 * 交互链状态
 * 用于管理多步骤交互
 */
export interface InteractionChainState {
    chainId: string;                    // 交互链 ID
    abilityId: string;                  // 能力 ID
    playerId: PlayerId;                 // 玩家 ID
    currentStep: number;                // 当前步骤索引（从 0 开始）
    totalSteps: number;                 // 总步骤数
    interactions: CardiaInteraction[];  // 所有交互步骤
    results: Map<string, any>;          // 每个交互的结果（interactionId -> result）
    completed: boolean;                 // 是否已完成
}

/**
 * 创建交互链
 */
export function createInteractionChain(
    chainId: string,
    abilityId: string,
    playerId: PlayerId,
    interactions: CardiaInteraction[]
): InteractionChainState {
    return {
        chainId,
        abilityId,
        playerId,
        currentStep: 0,
        totalSteps: interactions.length,
        interactions,
        results: new Map(),
        completed: false,
    };
}

/**
 * 获取当前交互
 */
export function getCurrentInteraction(
    chain: InteractionChainState
): CardiaInteraction | null {
    if (chain.currentStep >= chain.totalSteps) {
        return null;
    }
    
    return chain.interactions[chain.currentStep];
}

/**
 * 记录交互结果并推进到下一步
 */
export function advanceInteractionChain(
    chain: InteractionChainState,
    interactionId: string,
    result: any
): InteractionChainState {
    // 1. 记录当前交互的结果
    const newResults = new Map(chain.results);
    newResults.set(interactionId, result);
    
    // 2. 推进到下一步
    const nextStep = chain.currentStep + 1;
    const completed = nextStep >= chain.totalSteps;
    
    return {
        ...chain,
        currentStep: nextStep,
        results: newResults,
        completed,
    };
}

/**
 * 获取交互链的所有结果
 */
export function getInteractionChainResults(
    chain: InteractionChainState
): Record<string, any> {
    const results: Record<string, any> = {};
    
    for (const [interactionId, result] of chain.results.entries()) {
        results[interactionId] = result;
    }
    
    return results;
}

/**
 * 检查交互链是否完成
 */
export function isInteractionChainComplete(
    chain: InteractionChainState
): boolean {
    return chain.completed;
}
