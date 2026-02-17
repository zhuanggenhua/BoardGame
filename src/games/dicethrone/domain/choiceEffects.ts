/**
 * DiceThrone Choice Effect 处理器注册表
 */

import type { DiceThroneCore } from './types';
import { TOKEN_IDS } from './ids';

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
const choiceEffectHandlers: Map<string, ChoiceEffectHandler> = new Map();

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

// ============================================================================
// 攻击掷骰阶段结束时 Token 使用处理器
// ============================================================================

/**
 * 暴击 (Crit) — 攻击掷骰阶段结束时使用，+4 伤害
 * 门控条件（伤害≥5）已在 flowHooks.ts 中检查
 */
registerChoiceEffectHandler('use-crit', ({ state, playerId }) => {
    const player = state.players[playerId];
    if (!player || !state.pendingAttack) return undefined;

    const currentCrit = player.tokens[TOKEN_IDS.CRIT] ?? 0;
    if (currentCrit <= 0) return undefined;

    // 消耗暴击 Token，增加 +4 伤害，标记 Token 选择已完成
    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: { ...player.tokens, [TOKEN_IDS.CRIT]: currentCrit - 1 },
            },
        },
        pendingAttack: {
            ...state.pendingAttack,
            bonusDamage: (state.pendingAttack.bonusDamage ?? 0) + 4,
            offensiveRollEndTokenResolved: true,
        },
    };
});

/**
 * 精准 (Accuracy) — 攻击掷骰阶段结束时使用，使攻击不可防御
 */
registerChoiceEffectHandler('use-accuracy', ({ state, playerId }) => {
    const player = state.players[playerId];
    if (!player || !state.pendingAttack) return undefined;

    const currentAccuracy = player.tokens[TOKEN_IDS.ACCURACY] ?? 0;
    if (currentAccuracy <= 0) return undefined;

    // 消耗精准 Token，使攻击不可防御，标记 Token 选择已完成
    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: { ...player.tokens, [TOKEN_IDS.ACCURACY]: currentAccuracy - 1 },
            },
        },
        pendingAttack: {
            ...state.pendingAttack,
            isDefendable: false,
            offensiveRollEndTokenResolved: true,
        },
    };
});

/**
 * 跳过 — 不使用任何 Token，标记 Token 选择已完成
 */
registerChoiceEffectHandler('skip', ({ state }) => {
    if (!state.pendingAttack) return undefined;
    
    // 标记 Token 选择已完成
    return {
        pendingAttack: {
            ...state.pendingAttack,
            offensiveRollEndTokenResolved: true,
        },
    };
});
