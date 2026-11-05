import { type DiceThroneCore } from './types';

/**
 * Choice Effect 处理器上下文
 */
export interface ChoiceEffectContext {
    state: DiceThroneCore;
    playerId: string;
    customId: string;
    sourceAbilityId?: string;
    /** CHOICE_RESOLVED 事件中的 value（选项携带的数值） */
    value?: number;
    /** 本次选择来自真实 InteractionSystem 当前交互快照。 */
    interactionBacked?: boolean;
}

/**
 * Choice Effect 处理器函数类型
 * 返回修改后的 state（或 undefined 表示不处理）
 */
export type ChoiceEffectHandler = (context: ChoiceEffectContext) => Partial<DiceThroneCore> | undefined;

/**
 * Choice Effect 处理器注册表
 * 新增选择效果只需注册处理器，无需修改 reducer
 */
export const choiceEffectHandlers: Map<string, ChoiceEffectHandler> = new Map();

/**
 * 注册 Choice Effect 处理器
 */
export function registerChoiceEffectHandler(customId: string, handler: ChoiceEffectHandler): void {
    // HMR 会重新执行模块导致重复注册，静默覆盖即可
    choiceEffectHandlers.set(customId, handler);
}

/**
 * 获取 Choice Effect 处理器
 */
export function getChoiceEffectHandler(customId: string): ChoiceEffectHandler | undefined {
    return choiceEffectHandlers.get(customId);
}
