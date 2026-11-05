
import { type DiceThroneCore } from './types';
import { type ChoiceEffectContext, getChoiceEffectHandler, registerChoiceEffectHandler } from './choiceEffectRegistry';
import { updatePendingAttackSettlementStage } from './utils';
import { TOKEN_IDS } from './ids';

export { type ChoiceEffectContext, type ChoiceEffectHandler, registerChoiceEffectHandler, getChoiceEffectHandler } from './choiceEffectRegistry';

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
