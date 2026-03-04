import { createAbilityExecutorRegistry } from '../../../engine/primitives/ability';
import type { AbilityContext, AbilityResult } from '../../../engine/primitives/ability';
import type { GameEvent, RandomFn } from '../../../engine/types';
import type { PlayerId } from '../../../engine/types';
import type { CardiaCore, FactionType } from './core-types';

/**
 * Cardia 能力执行上下文
 */
export interface CardiaAbilityContext extends AbilityContext {
    core: CardiaCore;
    abilityId: string;
    cardId: string;
    playerId: PlayerId;
    opponentId: PlayerId;
    timestamp: number;
    random: RandomFn;  // 随机数生成器对象（包含 random()、d()、range()、shuffle() 方法）
    // 交互结果（如果有）
    selectedCardId?: string;
    selectedFaction?: FactionType;
    selectedModifier?: number;
}

/**
 * 能力执行器函数签名
 */
export type CardiaAbilityExecutor = (
    ctx: CardiaAbilityContext
) => AbilityResult<GameEvent>;

/**
 * 创建执行器注册表（使用引擎层框架）
 */
export const abilityExecutorRegistry = createAbilityExecutorRegistry<
    CardiaAbilityContext,
    GameEvent
>('cardia-ability-executors');

/**
 * 初始化所有能力执行器
 * 
 * 必须在使用 abilityExecutorRegistry 之前调用此函数。
 * 测试文件应该在 beforeAll 或 beforeEach 中调用此函数。
 */
export async function initializeAbilityExecutors(): Promise<void> {
    await import('./abilities/group1-resources');
    await import('./abilities/group2-modifiers');
    await import('./abilities/group3-ongoing');
    await import('./abilities/group4-card-ops');
    await import('./abilities/group5-copy');
    await import('./abilities/group6-special');
    await import('./abilities/group7-faction');
    
    // 注册交互处理函数
    const { registerModifierInteractionHandlers } = await import('./abilities/group2-modifiers');
    const { registerFactionInteractionHandlers } = await import('./abilities/group7-faction');
    
    registerModifierInteractionHandlers();
    registerFactionInteractionHandlers();
}
