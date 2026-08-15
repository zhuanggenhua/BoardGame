/**
 * DiceThrone Choice Effect 处理器注册表
 */

import type { DiceThroneCore } from './types';
import { TOKEN_IDS } from './ids';
import { updatePendingAttackSettlementStage } from './utils';

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
const choiceEffectHandlers: Map<string, ChoiceEffectHandler> = new Map();

function markOffensiveRollEndTokenUsed(state: DiceThroneCore, tokenId: string): {
    offensiveRollEndTokenIdsUsed: string[];
    offensiveRollEndTokenResolved: boolean;
} {
    const used = state.pendingAttack?.offensiveRollEndTokenIdsUsed ?? [];
    const nextUsed = used.includes(tokenId) ? used : [...used, tokenId];
    return {
        offensiveRollEndTokenIdsUsed: nextUsed,
        offensiveRollEndTokenResolved: false,
    };
}

export function hasCurrentChoiceAnchor(state: DiceThroneCore, sourceAbilityId?: string): boolean {
    return typeof sourceAbilityId === 'string'
        && sourceAbilityId.length > 0
        && state.currentChoiceSourceAbilityId === sourceAbilityId;
}

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

export function resolveChoiceEffect(context: ChoiceEffectContext): Partial<DiceThroneCore> | undefined {
    const hasAuthorizedChoice = hasCurrentChoiceAnchor(context.state, context.sourceAbilityId)
        || context.interactionBacked === true;

    if (context.customId.startsWith('select-target:')) {
        if (!hasAuthorizedChoice) {
            return undefined;
        }
        const defenderId = context.customId.slice('select-target:'.length);
        if (!defenderId || !context.state.pendingAttack || !context.state.players[defenderId]) {
            return undefined;
        }
        return {
            pendingAttack: {
                ...updatePendingAttackSettlementStage(context.state.pendingAttack, 'preDamage')!,
                defenderId,
                targetingSelectionPending: false,
                targetingSelectionResolved: true,
            },
        };
    }

    const handler = getChoiceEffectHandler(context.customId);
    if (!handler || !hasAuthorizedChoice) {
        return undefined;
    }
    return handler(context);
}

registerChoiceEffectHandler('dt-with-damage-choice-resolved', ({ state, sourceAbilityId }) => {
    if (!state.pendingAttack || state.pendingAttack.sourceAbilityId !== sourceAbilityId) return undefined;
    return {
        pendingAttack: {
            ...updatePendingAttackSettlementStage(state.pendingAttack, 'withDamageChoicePending')!,
            withDamageChoiceResolved: true,
        },
    };
});

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

    const tokenProgress = markOffensiveRollEndTokenUsed(state, TOKEN_IDS.CRIT);

    // 消耗暴击 Token，增加 +4 伤害，并允许继续选择其它攻击后 Token
    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: { ...player.tokens, [TOKEN_IDS.CRIT]: currentCrit - 1 },
            },
        },
        pendingAttack: {
            ...updatePendingAttackSettlementStage(state.pendingAttack, 'preDamage')!,
            bonusDamage: (state.pendingAttack.bonusDamage ?? 0) + 4,
            ...tokenProgress,
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

    const tokenProgress = markOffensiveRollEndTokenUsed(state, TOKEN_IDS.ACCURACY);

    // 消耗精准 Token，使攻击不可防御，并允许继续选择其它攻击后 Token
    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: { ...player.tokens, [TOKEN_IDS.ACCURACY]: currentAccuracy - 1 },
            },
        },
        pendingAttack: {
            ...updatePendingAttackSettlementStage(state.pendingAttack, 'preDamage')!,
            isDefendable: false,
            ...tokenProgress,
        },
    };
});

/**
 * 装填 (Loaded) — 攻击掷骰阶段结束时使用，消耗 1 个装填并进入奖励骰结算。
 */
registerChoiceEffectHandler('use-loaded', ({ state, playerId }) => {
    const player = state.players[playerId];
    if (!player || !state.pendingAttack) return undefined;

    const currentLoaded = player.tokens[TOKEN_IDS.LOADED] ?? 0;
    if (currentLoaded <= 0) return undefined;

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: { ...player.tokens, [TOKEN_IDS.LOADED]: currentLoaded - 1 },
            },
        },
        pendingAttack: {
            ...updatePendingAttackSettlementStage(state.pendingAttack, 'preDamage')!,
            // Loaded 可在同一次攻击中连续消耗多个；奖励骰结算完成后，
            // flow hook 会重新打开攻击掷骰阶段结束时的 Token 选择。
            offensiveRollEndTokenResolved: currentLoaded <= 1,
        },
    };
});

registerChoiceEffectHandler('use-ninjutsu', ({ state, playerId }) => {
    const player = state.players[playerId];
    if (!player || !state.pendingAttack) return undefined;

    const currentNinjutsu = player.tokens[TOKEN_IDS.NINJUTSU] ?? 0;
    if (currentNinjutsu <= 0) return undefined;

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: { ...player.tokens, [TOKEN_IDS.NINJUTSU]: currentNinjutsu - 1 },
            },
        },
        pendingAttack: {
            ...updatePendingAttackSettlementStage(state.pendingAttack, 'preDamage')!,
            offensiveRollEndTokenResolved: false,
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
            ...updatePendingAttackSettlementStage(state.pendingAttack, 'preDamage')!,
            offensiveRollEndTokenResolved: true,
        },
    };
});

registerChoiceEffectHandler('gunslinger-showdown-apply-bonus', ({ state, sourceAbilityId, value }) => {
    if (!state.pendingAttack) return undefined;
    if (sourceAbilityId && state.pendingAttack.sourceAbilityId !== sourceAbilityId) {
        return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return undefined;
    }

    return {
        pendingAttack: {
            ...state.pendingAttack,
            bonusDamage: (state.pendingAttack.bonusDamage ?? 0) + value,
        },
    };
});
