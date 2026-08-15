/**
 * DiceThrone 状态 Reducer
 * 确定性状态变更：reduce(state, event) => newState
 * 所有处理器使用结构共享（spread）保证不可变性
 */

import type {
    DiceThroneCore,
    DiceThroneEvent,
    HeroState,
} from './types';
import type { RandomFn } from '../../../engine/types';
import {
    buildTeamIdByPlayerIdFromSeatingOrder,
    getAttackSnapshotDieIndex,
    getDieFaceByDefinition,
    getPendingBonusSettlementDice,
    getPlayerDieFace,
    getTokenStackLimit,
    isAttackSnapshotDieId,
} from './rules';
import { buildAfterRollConfirmedSignature } from './responseWindowGuards';
import { RESOURCE_IDS } from './resources';
import { TOKEN_IDS } from './ids';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';
import { buildHeroAbilitiesForFace, initHeroState, createCharacterDice } from './characters';
import { hasCurrentChoiceAnchor, registerChoiceEffectHandler, resolveChoiceEffect } from './choiceEffects';
import { removeCard, updatePendingAttackSettlementStage } from './utils';
import { isTreantTreeSpiritToken } from './passiveAbility';
import {
    handlePreventDamage, handleAttackPreDefenseResolved, handleAttackDefenseResolved, handleDamageDealt,
    handleHealApplied, handleAttackInitiated, handleBonusDamageAdded, handleAttackResolved,
    handleAttackMadeUndefendable, handleExtraAttackTriggered,
    handleDamageShieldGranted, handleDamagePrevented,
    handleAbilityReselectionRequired, handleTokenResponseRequested,
    handleTokenUsed, handleTokenResponseClosed,
} from './reduceCombat';
import {
    handleCardDrawn, handleCardDiscarded, handleCardSold, handleSellUndone,
    handleCardPlayed, handleCpChanged, handleCardReordered,
    handleDeckShuffled, handleAbilityReplaced,
} from './reduceCards';
import {
    clearCurrentRollContext,
    createBonusRollContextFromSettlement,
    createMainRollContext,
    getBonusSettlementContextDice,
    getEvasionDamageBeforeRoll,
    getEvasionRollSuccess,
    markCurrentRollContextStatus,
    openTemporaryRollContext,
    replaceCurrentRollContext,
    setCurrentRollContextDice,
    isCurrentBonusRollSettlement,
    isSettledReplayOnlyRollContext,
} from './rollContext';

// ============================================================================
// 事件处理器
// ============================================================================

type EventHandler<E extends DiceThroneEvent> = (
    state: DiceThroneCore,
    event: E
) => DiceThroneCore;

const isLegacyMainRollContext = (state: DiceThroneCore): boolean => (
    state.currentRollContext?.kind === 'offensive'
    || state.currentRollContext?.kind === 'defensive'
    || state.currentRollContext?.kind === 'targeting'
);

const syncLegacyMainDiceToCurrentRollContext = (state: DiceThroneCore): DiceThroneCore => {
    if (!isLegacyMainRollContext(state)) return state;
    const rollDiceCount = typeof state.rollDiceCount === 'number' ? state.rollDiceCount : state.dice.length;
    return setCurrentRollContextDice(state, state.dice.slice(0, rollDiceCount));
};

const clearCurrentRollContextUnlessSettledReplay = (
    state: DiceThroneCore,
    contextId?: string,
): DiceThroneCore => {
    if (isSettledReplayOnlyRollContext(state.currentRollContext)) {
        return state;
    }
    return clearCurrentRollContext(state, contextId);
};

const updateEvasionRollResult = (
    state: DiceThroneCore,
    value: number,
): DiceThroneCore => {
    const context = state.currentRollContext;
    if (context?.kind !== 'evasion') return state;
    const success = getEvasionRollSuccess(context, value);
    const pendingDamage = state.pendingDamage
        ? {
            ...state.pendingDamage,
            currentDamage: success ? 0 : getEvasionDamageBeforeRoll(context),
            isFullyEvaded: success,
            lastEvasionRoll: { value, success },
        }
        : state.pendingDamage;
    return {
        ...state,
        pendingDamage,
        currentRollContext: {
            ...context,
            dice: context.dice.map((die) => die.id === 0 ? { ...die, value } : die),
        },
    };
};

const updateCompareRollContextDie = (
    state: DiceThroneCore,
    dieId: number,
    newValue: number,
): DiceThroneCore => {
    const context = state.currentRollContext;
    if (context?.kind !== 'compare') return state;
    if (!context.dice.some(die => die.id === dieId)) return state;
    return setCurrentRollContextDice(
        state,
        context.dice.map((die) => {
            if (die.id !== dieId) return die;
            const face = die.ownerId
                ? getPlayerDieFace(state, die.ownerId, newValue)
                : getDieFaceByDefinition(die.definitionId, newValue);
            return {
                ...die,
                value: newValue,
                symbol: face,
                symbols: face ? [face] : [],
            };
        }),
    );
};

/**
 * 处理骰子结果事件
 */
const handleDiceRolled: EventHandler<Extract<DiceThroneEvent, { type: 'DICE_ROLLED' }>> = (
    state,
    event
) => {
    const { results } = event.payload;
    let resultIndex = 0;
    const newDice = state.dice.map((die, i) => {
        if (i < state.rollDiceCount && !die.isKept && resultIndex < results.length) {
            const value = results[resultIndex++];
            const face = getDieFaceByDefinition(die.definitionId, value);
            return { ...die, value, symbol: face, symbols: face ? [face] : [] };
        }
        return die;
    });
    const duelAttackerId = state.pendingAttack?.defenseAbilityId === 'duel'
        ? state.pendingAttack.attackerId
        : undefined;
    const duelAttackerValue = duelAttackerId
        ? results[resultIndex] ?? results[results.length - 1]
        : undefined;
    const duelAttackerCharacterId = duelAttackerId
        ? state.players[duelAttackerId]?.characterId
        : undefined;
    const duelAttackerDie = duelAttackerId
        && duelAttackerValue !== undefined
        && duelAttackerCharacterId
        && duelAttackerCharacterId !== 'unselected'
        ? {
            id: 1,
            definitionId: `${duelAttackerCharacterId}-dice`,
            value: duelAttackerValue,
            symbol: getPlayerDieFace(state, duelAttackerId, duelAttackerValue),
            symbols: getPlayerDieFace(state, duelAttackerId, duelAttackerValue)
                ? [getPlayerDieFace(state, duelAttackerId, duelAttackerValue)!]
                : [],
            isKept: false,
            ownerId: duelAttackerId,
        } as DiceThroneCore['dice'][number]
        : undefined;
    const nextState = { ...state, dice: newDice, rollCount: state.rollCount + 1, rollConfirmed: false };
    return replaceCurrentRollContext(
        nextState,
        createMainRollContext(nextState, {
            phase: event.payload.phase,
            ownerPlayerId: event.payload.rollerId,
            dice: duelAttackerDie ? [...newDice.slice(0, state.rollDiceCount), duelAttackerDie] : undefined,
        }),
    );
};

/**
 * 处理额外骰子结果事件
 */
const handleBonusDieRolled: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DIE_ROLLED' }>> = (
    state,
    event
) => {
    const { value } = event.payload;
    const pendingDamageBonus = event.payload.pendingDamageBonus;

    // 更新 pendingAttack.extraRoll
    let pendingAttack = state.pendingAttack
        ? { ...state.pendingAttack, extraRoll: { value, resolved: true } }
        : state.pendingAttack;

    // 如果有 pendingDamageBonus，更新 pendingDamage.currentDamage（伏击等 Token 掷骰加伤）
    let pendingDamage = state.pendingDamage;
    if (pendingDamageBonus && pendingDamageBonus > 0 && state.pendingDamage) {
        const modifiers = [...(state.pendingDamage.modifiers || [])];
        modifiers.push({
            type: 'token' as const,
            value: pendingDamageBonus,
            sourceId: 'sneak_attack',
            sourceName: 'damageSource.sneakAttack',
        });
        pendingDamage = {
            ...state.pendingDamage,
            currentDamage: state.pendingDamage.currentDamage + pendingDamageBonus,
            modifiers,
        };
        // 同步更新 pendingAttack.damage
        if (pendingAttack) {
            pendingAttack = { ...pendingAttack, damage: (pendingAttack.damage ?? 0) + pendingDamageBonus };
        }
    }

    return {
        ...state,
        pendingAttack,
        pendingDamage,
    };
};

/**
 * 更新 pendingAttack 的局部字段
 */
const handlePendingAttackUpdated: EventHandler<Extract<DiceThroneEvent, { type: 'PENDING_ATTACK_UPDATED' }>> = (
    state,
    event
) => {
    if (!state.pendingAttack) return state;
    if (state.pendingAttack.attackerId !== event.payload.attackerId) return state;
    return {
        ...state,
        pendingAttack: {
            ...state.pendingAttack,
            ...event.payload.patch,
        },
    };
};

/**
 * 处理骰子锁定事件
 */
const handleDieLockToggled: EventHandler<Extract<DiceThroneEvent, { type: 'DIE_LOCK_TOGGLED' }>> = (
    state,
    event
) => {
    const { dieId, isKept } = event.payload;
    const nextState = {
        ...state,
        dice: state.dice.map(d => d.id === dieId ? { ...d, isKept } : d),
    };
    return syncLegacyMainDiceToCurrentRollContext(nextState);
};

/**
 * 处理骰子确认事件
 */
const handleRollConfirmed: EventHandler<Extract<DiceThroneEvent, { type: 'ROLL_CONFIRMED' }>> = (
    state
) => markCurrentRollContextStatus({
    ...state,
    rollConfirmed: true,
    rollConfirmedSequence: (state.rollConfirmedSequence ?? 0) + 1,
}, 'settling');

/**
 * 处理房主开始事件
 */
const handleHostStarted: EventHandler<Extract<DiceThroneEvent, { type: 'HOST_STARTED' }>> = (
    state
) => ({ ...state, hostStarted: true });

/**
 * 记录当前回合常规 offensiveRoll 的实际掷骰次数
 */
const handleOffensiveRollAttemptsRecorded: EventHandler<Extract<DiceThroneEvent, { type: 'OFFENSIVE_ROLL_ATTEMPTS_RECORDED' }>> = (
    state,
    event
) => ({
    ...state,
    offensiveRollAttemptsThisTurn: event.payload.attempts,
});

/**
 * 处理 2v2 站位移动事件
 */
const handleSeatingMoved: EventHandler<Extract<DiceThroneEvent, { type: 'SEATING_MOVED' }>> = (
    state,
    event
) => ({
    ...state,
    seatingOrder: event.payload.seatingOrder,
    seatSwapRequest: undefined,
    teamIdByPlayerId: buildTeamIdByPlayerIdFromSeatingOrder(event.payload.seatingOrder),
});

const handleSeatSwapRequested: EventHandler<Extract<DiceThroneEvent, { type: 'SEAT_SWAP_REQUESTED' }>> = (
    state,
    event,
) => ({
    ...state,
    seatSwapRequest: {
        requesterId: event.payload.requesterId,
        targetPlayerId: event.payload.targetPlayerId,
    },
});

const handleSeatSwapCleared: EventHandler<
    Extract<DiceThroneEvent, { type: 'SEAT_SWAP_REJECTED' | 'SEAT_SWAP_CANCELLED' }>
> = (state) => ({
    ...state,
    seatSwapRequest: undefined,
});

/**
 * 处理玩家准备事件
 */
const handlePlayerReady: EventHandler<Extract<DiceThroneEvent, { type: 'PLAYER_READY' }>> = (
    state,
    event
) => ({
    ...state,
    readyPlayers: { ...state.readyPlayers, [event.payload.playerId]: true },
});

/**
 * 处理玩家取消准备事件
 */
const handlePlayerUnready: EventHandler<Extract<DiceThroneEvent, { type: 'PLAYER_UNREADY' }>> = (
    state,
    event
) => ({
    ...state,
    readyPlayers: { ...state.readyPlayers, [event.payload.playerId]: false },
});

/**
 * 处理奖励骰结算事件
 * 清除 pendingBonusDiceSettlement。
 * 独立展示型奖励骰确认后保留最终骰面供右侧骰盘只读回看；
 * 攻击 / 防御等父链临时骰确认后恢复被挂起的父骰盘继续父链；
 * 嵌套奖励骰只恢复上一层被挂起的奖励骰结算。
 * 非 displayOnly 时标记 pendingAttack.bonusDiceResolved，
 * 避免 autoContinue 重入 defensiveRoll exit 时重复执行 resolveAttack。
 */
const handleBonusDiceSettled: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DICE_SETTLED' }>> = (
    state,
    event
) => {
    const settlement = state.pendingBonusDiceSettlement;
    const continuation = settlement?.continuation;
    const pendingAttack = continuation?.kind === 'attack' && state.pendingAttack
        ? updatePendingAttackSettlementStage(
            continuation.markBonusDiceResolved
                ? { ...state.pendingAttack, bonusDiceResolved: true }
                : state.pendingAttack,
            continuation.settlementStage,
        )
        : continuation?.kind === 'complete' && state.pendingAttack && settlement?.rollDieResolution
            ? { ...state.pendingAttack, bonusDiceResolved: true }
            : state.pendingAttack;
    const currentContext = state.currentRollContext;
    const restoredSettlement = settlement?.suspendedParentSettlement;
    const shouldRestoreSuspendedParent = Boolean(
        settlement
        && currentContext?.id === `bonus:${settlement.id}`
        && currentContext.suspendedParent
        && (
            restoredSettlement
            || continuation?.kind !== 'complete'
        )
    );
    const nextState = {
        ...state,
        pendingBonusDiceSettlement: restoredSettlement,
        pendingAttack,
    };
    if (settlement) {
        if (shouldRestoreSuspendedParent && currentContext?.suspendedParent) {
            return {
                ...nextState,
                currentRollContext: currentContext.suspendedParent,
            };
        }
        const settledBonusContext = createBonusRollContextFromSettlement(nextState, settlement);
        return {
            ...nextState,
            currentRollContext: {
                ...settledBonusContext,
                status: 'settled',
                policy: {
                    ...settledBonusContext.policy,
                    modifiableBy: 'none',
                    rerollableBy: 'none',
                    allowPassiveReroll: false,
                    allowDiceCardTargeting: false,
                    blocksPhaseFlow: false,
                },
                display: {
                    ...settledBonusContext.display,
                    replayOnly: true,
                },
            },
        };
    }
    return clearCurrentRollContextUnlessSettledReplay(nextState);
};

/**
 * 创建重置后的骰子数组（纯函数，结构共享）
 */
const resetDiceArray = (dice: DiceThroneCore['dice'], rollDiceCount: number): DiceThroneCore['dice'] =>
    dice.map((die, index) => {
        const face = getDieFaceByDefinition(die.definitionId, 1);
        return {
            ...die,
            value: 1,
            symbol: face,
            symbols: face ? [face] : [],
            isKept: index >= rollDiceCount,
        };
    });

/**
 * 根据玩家角色创建骰子（纯函数）
 * 如果玩家未选角或不存在，返回 undefined
 */
const createPlayerDice = (state: DiceThroneCore, playerId?: string): DiceThroneCore['dice'] | undefined => {
    if (!playerId) return undefined;
    const player = state.players[playerId];
    const characterId = player?.characterId;
    if (!characterId || characterId === 'unselected') return undefined;
    return createCharacterDice(characterId);
};

/**
 * 处理技能激活事件
 */
const handleAbilityActivated: EventHandler<Extract<DiceThroneEvent, { type: 'ABILITY_ACTIVATED' }>> = (
    state,
    event
) => {
    const { abilityId, isDefense, playerId } = event.payload;

    if (!isDefense || !state.pendingAttack) {
        return { ...state, activatingAbilityId: abilityId };
    }
    if (state.pendingAttack.defenseAbilityId === abilityId && state.rollCount > 0) {
        return { ...state, activatingAbilityId: abilityId };
    }

    let rollDiceCount = state.rollDiceCount;
    let rollLimit = state.rollLimit;
    let dice = state.dice;

    // 防御技能选择后，根据技能定义设置 rollDiceCount
    // 规则 §3.6 步骤 2：先选择防御技能，再掷骰
    const defenderId = playerId ?? state.pendingAttack.defenderId;
    const defender = state.players[defenderId];
    if (defender) {
        const ability = defender.abilities.find(a => {
            if (a.id === abilityId) return true;
            return a.variants?.some(v => v.id === abilityId);
        });
        const matchedVariant = ability?.variants?.find(variant => variant.id === abilityId);
        const trigger = matchedVariant?.trigger ?? ability?.trigger;
        if (trigger) {
            const triggerDiceCount = (trigger as { diceCount?: number }).diceCount;
            if (triggerDiceCount !== undefined && triggerDiceCount > 0) {
                rollDiceCount = triggerDiceCount;
                dice = resetDiceArray(state.dice, triggerDiceCount);
            }
            const triggerRollLimit = (trigger as { rollLimit?: number }).rollLimit;
            if (triggerRollLimit !== undefined && triggerRollLimit > 0) {
                rollLimit = triggerRollLimit;
            }
        }
    }

    return {
        ...state,
        activatingAbilityId: abilityId,
        pendingAttack: { ...state.pendingAttack, defenseAbilityId: abilityId },
        rollLimit,
        rollDiceCount,
        dice,
    };
};

/**
 * 处理状态施加事件
 */
const handleStatusApplied: EventHandler<Extract<DiceThroneEvent, { type: 'STATUS_APPLIED' }>> = (
    state,
    event
) => {
    const { targetId, statusId, newTotal, sourceAbilityId } = event.payload;
    const target = state.players[targetId];
    if (!target) return state;
    const maxStacks = getTokenStackLimit(state, targetId, statusId);
    const cappedNewTotal = Math.max(0, Math.min(newTotal, maxStacks));

    const isDebuff = state.tokenDefinitions?.find(def => def.id === statusId)?.category === 'debuff';
    const shouldPrevent = Boolean(
        isDebuff !== false
        && state.pendingAttack
        && state.pendingAttack.defenderId === targetId
        && target.damageShields?.some(shield => shield.preventStatus)
    );

    if (shouldPrevent && target.damageShields) {
        const index = target.damageShields.findIndex(shield => shield.preventStatus);
        if (index >= 0) {
            return {
                ...state,
                players: {
                    ...state.players,
                    [targetId]: {
                        ...target,
                        damageShields: [...target.damageShields.slice(0, index), ...target.damageShields.slice(index + 1)],
                    },
                },
            };
        }
    }

    // 记录本次攻击期间实际新增到防御方身上的状态层数。
    // 厚皮 II 在防御结算时需要据此移除一个“本次投掷阶段已施加”的状态；
    // 被 preventStatus 护盾拦截的状态在上面的分支直接结束，不会进入记录。
    const pendingAttack = state.pendingAttack;
    const isIncomingStatusForCurrentAttack = Boolean(
        pendingAttack
        && pendingAttack.defenderId === targetId
        && cappedNewTotal > (target.statusEffects[statusId] ?? 0)
    );
    const nextPendingAttack = isIncomingStatusForCurrentAttack
        ? {
            ...pendingAttack,
            statusEffectsAppliedThisAttack: {
                ...(pendingAttack.statusEffectsAppliedThisAttack ?? {}),
                [statusId]: (pendingAttack.statusEffectsAppliedThisAttack?.[statusId] ?? 0)
                    + (cappedNewTotal - (target.statusEffects[statusId] ?? 0)),
            },
        }
        : pendingAttack;

    return {
        ...state,
        players: {
            ...state.players,
            [targetId]: {
                ...target,
                statusEffects: { ...target.statusEffects, [statusId]: cappedNewTotal },
            },
        },
        pendingAttack: nextPendingAttack,
        lastEffectSourceByPlayerId: sourceAbilityId
            ? { ...(state.lastEffectSourceByPlayerId || {}), [targetId]: sourceAbilityId }
            : state.lastEffectSourceByPlayerId,
    };
};

/**
 * 处理状态移除事件
 */
const handleStatusRemoved: EventHandler<Extract<DiceThroneEvent, { type: 'STATUS_REMOVED' }>> = (
    state,
    event
) => {
    const { targetId, statusId, stacks } = event.payload;
    const target = state.players[targetId];
    if (!target) return state;

    return {
        ...state,
        players: {
            ...state.players,
            [targetId]: {
                ...target,
                statusEffects: { ...target.statusEffects, [statusId]: Math.max(0, (target.statusEffects[statusId] || 0) - stacks) },
            },
        },
    };
};

/**
 * 处理 Token 授予事件
 */
const handleTokenGranted: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_GRANTED' }>> = (
    state,
    event
) => {
    const { targetId, tokenId, newTotal, sourceAbilityId } = event.payload;
    const target = state.players[targetId];
    if (!target) return state;
    const previousAmount = target.tokens[tokenId] ?? 0;
    const actualGrantedAmount = Math.max(0, newTotal - previousAmount);

    // 潜行获得时记录当前回合号（用于自动弃除判定）
    let sneakGainedTurn = state.sneakGainedTurn;
    if (tokenId === TOKEN_IDS.SNEAK && actualGrantedAmount > 0 && newTotal > 0) {
        sneakGainedTurn = { ...(sneakGainedTurn || {}), [targetId]: state.turnNumber };
    }

    // 太极获得时累加本回合获得量（用于攻击方加伤限制）
    let taijiGainedThisTurn = state.taijiGainedThisTurn;
    if (tokenId === TOKEN_IDS.TAIJI && actualGrantedAmount > 0) {
        const currentGained = taijiGainedThisTurn?.[targetId] ?? 0;
        taijiGainedThisTurn = { ...(taijiGainedThisTurn || {}), [targetId]: currentGained + actualGrantedAmount };
    }

    return {
        ...state,
        players: {
            ...state.players,
            [targetId]: { ...target, tokens: { ...target.tokens, [tokenId]: newTotal } },
        },
        lastEffectSourceByPlayerId: sourceAbilityId
            ? { ...(state.lastEffectSourceByPlayerId || {}), [targetId]: sourceAbilityId }
            : state.lastEffectSourceByPlayerId,
        sneakGainedTurn,
        taijiGainedThisTurn,
    };
};

/**
 * 处理 Token 消耗事件
 */
const handleTokenConsumed: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_CONSUMED' }>> = (
    state,
    event
) => {
    const { playerId, tokenId, newTotal, sourceAbilityId } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    // 潜行消耗时清除获得回合追踪
    let sneakGainedTurn = state.sneakGainedTurn;
    if (tokenId === TOKEN_IDS.SNEAK && newTotal <= 0 && sneakGainedTurn?.[playerId] !== undefined) {
        sneakGainedTurn = { ...sneakGainedTurn };
        delete sneakGainedTurn[playerId];
    }

    let treantSpiritSpentThisTurn = state.treantSpiritSpentThisTurn;
    if (
        isTreantTreeSpiritToken(tokenId)
        && (
            event.sourceCommandType === 'USE_PASSIVE_ABILITY'
            || sourceAbilityId === TOKEN_IDS.TREANT_DIVINE
        )
    ) {
        treantSpiritSpentThisTurn = {
            ...(treantSpiritSpentThisTurn ?? {}),
            [playerId]: {
                ...(treantSpiritSpentThisTurn?.[playerId] ?? {}),
                [tokenId]: true,
            },
        };
    }

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, tokens: { ...player.tokens, [tokenId]: newTotal } },
        },
        sneakGainedTurn,
        treantSpiritSpentThisTurn,
    };
};

/**
 * 处理 Token 上限变化事件
 */
const handleTokenLimitChanged: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_LIMIT_CHANGED' }>> = (
    state,
    event
) => {
    const { playerId, tokenId, newLimit, sourceAbilityId } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, tokenStackLimits: { ...player.tokenStackLimits, [tokenId]: newLimit } },
        },
        lastEffectSourceByPlayerId: sourceAbilityId
            ? { ...(state.lastEffectSourceByPlayerId || {}), [playerId]: sourceAbilityId }
            : state.lastEffectSourceByPlayerId,
    };
};

/**
 * 处理选择请求事件
 * 注意：实际的交互状态由 InteractionSystem 管理在 sys.interaction 中
 * 这里仅记录来源信息
 */
const handleChoiceRequested: EventHandler<Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }>> = (
    state,
    event
) => ({
    ...state,
    activatingAbilityId: event.payload.sourceAbilityId,
    currentChoiceSourceAbilityId: event.payload.sourceAbilityId,
    currentChoiceContext: event.payload.choiceContext,
});

const handleDefenderSelectionRequested: EventHandler<Extract<DiceThroneEvent, { type: 'DEFENDER_SELECTION_REQUESTED' }>> = (
    state,
    event,
) => {
    if (!state.pendingAttack || state.pendingAttack.attackerId !== event.payload.attackerId) {
        return state;
    }
    if (state.pendingAttack.targetingSelectionResolved === true) {
        return state;
    }
    return {
        ...state,
        pendingAttack: {
            ...state.pendingAttack,
            settlementStage: 'targeting',
            targetingSelectionPending: true,
            targetingSelectionResolved: false,
        },
    };
};

const handleArtificerBotStateUpdated: EventHandler<Extract<DiceThroneEvent, { type: 'ARTIFICER_BOT_STATE_UPDATED' }>> = (
    state,
    event,
) => {
    const player = state.players[event.payload.playerId];
    if (!player) return state;
    return {
        ...state,
        players: {
            ...state.players,
            [event.payload.playerId]: {
                ...player,
                artificerBotState: {
                    ...player.artificerBotState,
                    ...event.payload.patch,
                },
            },
        },
    };
};

const handleDefenderSelectionResolved: EventHandler<Extract<DiceThroneEvent, { type: 'DEFENDER_SELECTION_RESOLVED' }>> = (
    state,
    event,
) => {
    if (!state.pendingAttack || state.pendingAttack.attackerId !== event.payload.attackerId) {
        return state;
    }
    if (!state.players[event.payload.defenderId]) {
        return state;
    }
    return {
        ...state,
        pendingAttack: {
            ...state.pendingAttack,
            defenderId: event.payload.defenderId,
            settlementStage: 'preDamage',
            targetingSelectionPending: false,
            targetingSelectionResolved: true,
            statusEffectsAppliedThisAttack: state.pendingAttack.statusEffectsAppliedThisAttack ?? {},
        },
    };
};

/**
 * 处理选择完成事件
 */
const handleChoiceResolved: EventHandler<Extract<DiceThroneEvent, { type: 'CHOICE_RESOLVED' }>> = (
    state,
    event
) => {
    const { playerId, statusId, tokenId, value, customId, sourceAbilityId, interactionBacked } = event.payload;
    let resultState = state;
    const hasValidChoiceDelta = typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
    const hasChoiceAnchor = hasCurrentChoiceAnchor(state, sourceAbilityId);
    const hasAuthorizedChoice = hasChoiceAnchor || interactionBacked === true;
    const allowGenericChoiceDelta = !sourceAbilityId || hasAuthorizedChoice;

    const player = state.players[playerId];
    if (player) {
        let playerUpdates: Partial<HeroState> = {};
        const tokenActiveUseTiming = tokenId
            ? state.tokenDefinitions.find(def => def.id === tokenId)?.activeUse?.timing
            : undefined;
        const shouldSkipGenericTokenDelta = tokenId
            && customId?.startsWith('use-')
            && (
                tokenActiveUseTiming === 'onOffensiveRollEnd'
                || (Array.isArray(tokenActiveUseTiming) && tokenActiveUseTiming.includes('onOffensiveRollEnd'))
            );
        const shouldSkipGenericStatusDelta = statusId === 'cursed_coin'
            && (
                customId === 'cursed-pirate-human-verdict-command-choice'
                || customId === 'cursed-pirate-human-merciless-plunder-choice'
            );

        if (tokenId && !shouldSkipGenericTokenDelta && hasValidChoiceDelta && allowGenericChoiceDelta) {
            const maxStacks = getTokenStackLimit(state, playerId, tokenId);
            const currentAmount = player.tokens[tokenId] || 0;
            const nextAmount = Math.max(0, Math.min(currentAmount + value, maxStacks));
            playerUpdates = { tokens: { ...player.tokens, [tokenId]: nextAmount } };
        } else if (statusId && !shouldSkipGenericStatusDelta && hasValidChoiceDelta && allowGenericChoiceDelta) {
            const def = state.tokenDefinitions.find(e => e.id === statusId);
            const maxStacks = def?.stackLimit || 99;
            const currentStacks = player.statusEffects[statusId] || 0;
            playerUpdates = { statusEffects: { ...player.statusEffects, [statusId]: Math.min(currentStacks + value, maxStacks) } };
        }

        if (Object.keys(playerUpdates).length > 0) {
            resultState = {
                ...resultState,
                players: {
                    ...resultState.players,
                    [playerId]: { ...player, ...playerUpdates },
                },
            };
        }
    }

    // 通过注册表处理特殊选择效果
    if (customId) {
        const result = resolveChoiceEffect({ state: resultState, playerId, customId, sourceAbilityId, value, interactionBacked });
        if (result) {
            resultState = { ...resultState, ...result };
        }
    }

    const tokenActiveUseTiming = tokenId
        ? state.tokenDefinitions.find(def => def.id === tokenId)?.activeUse?.timing
        : undefined;
    const isOffensiveRollEndChoice = tokenId
        && (
            tokenActiveUseTiming === 'onOffensiveRollEnd'
            || (Array.isArray(tokenActiveUseTiming) && tokenActiveUseTiming.includes('onOffensiveRollEnd'))
        );
    const shouldAutoResolveOffensiveRollEndChoice = isOffensiveRollEndChoice
        && customId !== 'use-loaded'
        && customId !== 'use-ninjutsu'
        && customId !== 'use-crit'
        && customId !== 'use-accuracy';

    if (
        sourceAbilityId
        && (hasCurrentChoiceAnchor(resultState, sourceAbilityId) || interactionBacked === true)
        && resultState.pendingAttack?.sourceAbilityId === sourceAbilityId
        && resultState.pendingAttack.offensiveRollEndTokenResolved !== true
        && shouldAutoResolveOffensiveRollEndChoice
    ) {
        resultState = {
            ...resultState,
            pendingAttack: {
                ...resultState.pendingAttack,
                offensiveRollEndTokenResolved: true,
            },
        };
    }

    if (sourceAbilityId) {
        resultState = {
            ...resultState,
            lastEffectSourceByPlayerId: { ...(resultState.lastEffectSourceByPlayerId || {}), [playerId]: sourceAbilityId },
        };
    }

    if (sourceAbilityId && resultState.activatingAbilityId === sourceAbilityId) {
        resultState = {
            ...resultState,
            activatingAbilityId: undefined,
        };
    }

    if (
        sourceAbilityId
        && resultState.currentRollContext?.kind === 'compare'
        && resultState.currentRollContext.sourceAbilityId === sourceAbilityId
        && isSettledReplayOnlyRollContext(resultState.currentRollContext)
    ) {
        resultState = clearCurrentRollContext(resultState, resultState.currentRollContext.id);
    }

    if (sourceAbilityId && resultState.currentChoiceSourceAbilityId === sourceAbilityId) {
        resultState = {
            ...resultState,
            currentChoiceSourceAbilityId: undefined,
            currentChoiceContext: undefined,
        };
    }

    return resultState;
};

/**
 * 处理回合切换事件
 */
const handleTurnChanged: EventHandler<Extract<DiceThroneEvent, { type: 'TURN_CHANGED' }>> = (
    state,
    event
) => {
    const { nextPlayerId, turnNumber } = event.payload;
    let players = state.players;

    for (const playerId of Object.keys(state.players)) {
        const player = state.players[playerId];
        const hasPendingBonusDamage = player?.pendingBonusDamage !== undefined;
        const hasArtificerBotState = !!player?.artificerBotState;
        if (!hasPendingBonusDamage && !hasArtificerBotState) continue;
        if (players === state.players) {
            players = { ...state.players };
        }
        players[playerId] = {
            ...player,
            pendingBonusDamage: undefined,
            artificerBotState: player?.artificerBotState
                ? Object.fromEntries(
                    Object.entries(player.artificerBotState).map(([tokenId, botState]) => [
                        tokenId,
                        botState
                            ? { ...botState, activationsUsedThisTurn: 0 }
                            : botState,
                    ]),
                )
                : player?.artificerBotState,
        };
    }

    return {
        ...state,
        players,
        activePlayerId: nextPlayerId,
        turnNumber,
        lastResolvedAttackDamage: undefined,
        currentChoiceSourceAbilityId: undefined,
        currentChoiceContext: undefined,
        taijiGainedThisTurn: undefined, // 清除太极本回合获得量追踪
        treantSpiritSpentThisTurn: undefined,
        offensiveRollAttemptsThisTurn: undefined,
        offensiveRollAttackMadeThisTurn: undefined,
        lastSoldCardId: undefined,
        pendingAttack: null,
        pendingDamage: undefined,
    };
};

/**
 * 处理响应窗口打开事件
 * 注意：实际状态由 ResponseWindowSystem 管理在 sys.responseWindow 中
 */
const handleResponseWindowOpened: EventHandler<Extract<DiceThroneEvent, { type: 'RESPONSE_WINDOW_OPENED' }>> = (
    state,
    event
) => {
    // 不修改响应窗口状态（由系统层管理）
    // 但需要记录各业务源对应的序号，避免 CLOSED 后在同一业务源上立即 reopen
    if (event.payload.windowType === 'afterRollConfirmed') {
        const rollSequence = state.rollConfirmedSequence ?? 0;
        const rollSignature = buildAfterRollConfirmedSignature(state);
        if (rollSequence <= 0 || state.afterRollResponseWindowSequence === rollSequence) {
            if (state.afterRollResponseWindowSignature === rollSignature) {
                return state;
            }
            return {
                ...state,
                afterRollResponseWindowSignature: rollSignature,
            };
        }
        return {
            ...state,
            afterRollResponseWindowSequence: rollSequence,
            afterRollResponseWindowSignature: rollSignature,
        };
    }

    if (event.payload.windowType === 'afterCardPlayed') {
        const cardSequence = state.cardPlayedSequence ?? 0;
        if (cardSequence <= 0 || state.afterCardResponseWindowSequence === cardSequence) {
            return state;
        }
        return {
            ...state,
            afterCardResponseWindowSequence: cardSequence,
        };
    }

    if (event.payload.windowType !== 'afterAttackResolved') {
        return state;
    }

    const attackSequence = state.attackResolvedSequence ?? 0;
    if (attackSequence <= 0 || state.afterAttackResponseWindowSequence === attackSequence) {
        return state;
    }

    return {
        ...state,
        afterAttackResponseWindowSequence: attackSequence,
    };
};

/**
 * 处理响应窗口关闭事件
 * 注意：实际状态由 ResponseWindowSystem 管理在 sys.responseWindow 中
 */
const handleResponseWindowClosed: EventHandler<Extract<DiceThroneEvent, { type: 'RESPONSE_WINDOW_CLOSED' }>> = (
    state
) => {
    return state;
};

type PendingBonusSettlement = NonNullable<DiceThroneCore['pendingBonusDiceSettlement']>;
type PendingBonusDie = ReturnType<typeof getPendingBonusSettlementDice>[number];
type BonusEffectParams = Record<string, string | number>;

const countBonusFaces = (dice: PendingBonusDie[], face: string): number =>
    dice.filter(die => die.face === face).length;

const sumBonusValues = (dice: PendingBonusDie[]): number =>
    dice.reduce((sum, die) => sum + die.value, 0);

const halfUp = (value: number): number => Math.ceil(value / 2);

const resolveBonusDieEffectKeyForValue = (
    effectKey: string | undefined,
    face: string,
    value: number,
): string | undefined => {
    if (!effectKey) return effectKey;
    if (effectKey.startsWith('bonusDie.effect.powderKeg.')) {
        return `bonusDie.effect.powderKeg.${value}`;
    }
    if (effectKey.startsWith('bonusDie.effect.blinded.')) {
        return value <= 2 ? 'bonusDie.effect.blinded.miss' : 'bonusDie.effect.blinded.hit';
    }

    for (const prefix of [
        'bonusDie.effect.treantWildGrowth2.',
        'bonusDie.effect.treantTrample.',
        'bonusDie.effect.treantSoulfire.',
        'bonusDie.effect.treantMotherTree.',
        'bonusDie.effect.treantRooted.',
    ]) {
        if (effectKey.startsWith(prefix)) {
            return `${prefix}${face || 'other'}`;
        }
    }

    return effectKey;
};

const rebuildBonusDieEffectParams = (
    die: PendingBonusDie,
    effectKey: string | undefined,
    value: number,
    face: string,
): BonusEffectParams => {
    const params: BonusEffectParams = {
        ...(die.effectParams ?? {}),
        value,
        index: die.index,
    };

    if (Object.prototype.hasOwnProperty.call(params, 'face')) {
        params.face = face;
    }

    switch (effectKey) {
        case 'bonusDie.effect.gainCp':
            params.cp = halfUp(value);
            break;
        case 'bonusDie.effect.gunslingerLoadedDie':
            params.bonusDamage = halfUp(value);
            break;
        case 'bonusDie.effect.artificerPerfectlyCalibrated':
            params.synth = halfUp(value);
            params.synthGain = halfUp(value);
            break;
        case 'bonusDie.effect.artificerHealBot': {
            const healAmount = face === 'wrench' ? 1 : 2;
            params.heal = healAmount;
            params.healAmount = healAmount;
            break;
        }
        case 'bonusDie.effect.shadowDamage':
        case 'bonusDie.effect.samuraiBackStrikeDie':
            params.damage = halfUp(value);
            break;
        case 'bonusDie.effect.treantLifeSap':
            params.heal = halfUp(value);
            break;
        default:
            break;
    }

    return params;
};

const rebuildBonusSettlementSummary = (
    settlement: PendingBonusSettlement,
    dice: PendingBonusDie[],
): Partial<PendingBonusSettlement> => {
    switch (settlement.summaryEffectKey) {
        case 'bonusDie.effect.volley.result': {
            const bowCount = countBonusFaces(dice, 'bow');
            return { summaryEffectParams: { bowCount, bonusDamage: bowCount } };
        }
        case 'bonusDie.effect.luckyRoll.result': {
            const heartCount = countBonusFaces(dice, 'heart');
            return { summaryEffectParams: { heartCount, healAmount: 1 + 2 * heartCount } };
        }
        case 'bonusDie.effect.morePleaseRoll.result': {
            const swordCount = countBonusFaces(dice, 'sword');
            return { summaryEffectParams: { swordCount, damage: swordCount } };
        }
        case 'bonusDie.effect.gunslingerEatMyLead.result':
        case 'bonusDie.effect.gunslingerEatMyLead.resultKnockdown': {
            const bulletCount = countBonusFaces(dice, 'bullet');
            return {
                summaryEffectKey: bulletCount > 4
                    ? 'bonusDie.effect.gunslingerEatMyLead.resultKnockdown'
                    : 'bonusDie.effect.gunslingerEatMyLead.result',
                summaryEffectParams: { bulletCount, bonusDamage: bulletCount },
            };
        }
        case 'bonusDie.effect.samuraiMasamune.result': {
            const katanaCount = countBonusFaces(dice, 'katana');
            const shameCount = countBonusFaces(dice, 'helm');
            const retributionCount = countBonusFaces(dice, 'rising_sun');
            return { summaryEffectParams: { katanaCount, shameCount, retributionCount } };
        }
        case 'bonusDie.effect.ninjaGoingForwardResult':
            return { summaryEffectParams: { totalDamage: sumBonusValues(dice) } };
        case 'bonusDie.effect.ninjaNinjutsuResult':
            return { summaryEffectParams: { bonusDamage: dice[0]?.value ?? 0 } };
        case 'bonusDie.effect.treantLifeSapResult':
            return { summaryEffectParams: { heal: halfUp(dice[0]?.value ?? 0) } };
        case 'bonusDie.effect.treantWildGrowth2.result': {
            const branchCount = countBonusFaces(dice, 'branch');
            const leafCount = countBonusFaces(dice, 'leaf');
            const spiritCount = countBonusFaces(dice, 'spirit');
            return { summaryEffectParams: { branchCount, leafCount, spiritCount } };
        }
        case 'bonusDie.effect.treantTrample.result': {
            const branchCount = countBonusFaces(dice, 'branch');
            return { summaryEffectParams: { branchCount } };
        }
        case 'bonusDie.effect.treantSoulfire.result': {
            const branchCount = countBonusFaces(dice, 'branch');
            const leafCount = countBonusFaces(dice, 'leaf');
            const spiritCount = countBonusFaces(dice, 'spirit');
            return { summaryEffectParams: { branchCount, leafCount, spiritCount } };
        }
        default:
            return {};
    }
};

const updatePendingBonusSettlementDie = (
    state: DiceThroneCore,
    dieId: number,
    newValue: number,
    effectParamsOverride?: BonusEffectParams,
): PendingBonusSettlement | undefined => {
    const settlement = state.pendingBonusDiceSettlement;
    if (!settlement) return settlement;

    const dice = getPendingBonusSettlementDice(settlement).map(die => {
        if (die.index !== dieId) return die;
        const rawFace = die.effectKey?.startsWith('bonusDie.effect.powderKeg.') === true
            ? String(newValue)
            : (getPlayerDieFace(state, settlement.attackerId, newValue) ?? String(newValue));
        const face = rawFace;
        const effectKey = resolveBonusDieEffectKeyForValue(die.effectKey, face, newValue);
        return {
            ...die,
            value: newValue,
            face,
            effectKey,
            effectParams: effectParamsOverride
                ? { ...rebuildBonusDieEffectParams(die, effectKey, newValue, face), ...effectParamsOverride, value: newValue, index: die.index }
                : rebuildBonusDieEffectParams(die, effectKey, newValue, face),
        };
    });

    return {
        ...settlement,
        dice,
        ...rebuildBonusSettlementSummary(settlement, dice),
    };
};

/**
 * 处理骰子修改事件
 * 
 * 设计原则：
 * - 只要当前投掷池的骰面真实发生变化，就重置 rollConfirmed=false
 * - 这样投掷方若仍有剩余投掷次数，可以继续重投并重新确认
 * - 响应窗口是否已处理由 afterRollConfirmed 的序号/签名去重负责，不再复用 rollConfirmed 表达
 */
const handleDieModified: EventHandler<Extract<DiceThroneEvent, { type: 'DIE_MODIFIED' }>> = (
    state,
    event
) => {
    const { dieId, newValue, ownerId, target } = event.payload;
    if (target === 'evasionDie') {
        return updateEvasionRollResult(state, newValue);
    }
    if ((target === undefined || target === 'activeDie') && state.currentRollContext?.kind === 'compare') {
        return updateCompareRollContextDie(state, dieId, newValue);
    }
    const targetsPendingBonusDie = isCurrentBonusRollSettlement(state)
        && (target === 'pendingBonusDie'
        || (
            target === undefined
            && getPendingBonusSettlementDice(state.pendingBonusDiceSettlement).some(die => die.index === dieId)
            && !state.dice.some(die => die.id === dieId)
        ));
    const pendingBonusDiceSettlement = targetsPendingBonusDie && state.pendingBonusDiceSettlement
        ? updatePendingBonusSettlementDie(state, dieId, newValue)
        : state.pendingBonusDiceSettlement;
    const attackSnapshotDieIndex = getAttackSnapshotDieIndex(dieId);
    const pendingAttack = state.pendingAttack
        && target !== 'pendingBonusDie'
        && isAttackSnapshotDieId(dieId)
        && Array.isArray(state.pendingAttack.attackDiceValues)
        && attackSnapshotDieIndex >= 0
        && attackSnapshotDieIndex < state.pendingAttack.attackDiceValues.length
        // target 已由 execute 根据 attackSnapshotDieId 明确标注；防御骰上下文的
        // ownerId 属于当前防御骰，不能再反过来否决攻击快照的实际写入。
        && (target === 'attackSnapshot' || ownerId === state.pendingAttack.attackerId)
        ? (() => {
            const attackDiceValues = state.pendingAttack!.attackDiceValues!.map((value, index) => (
                index === attackSnapshotDieIndex ? newValue : value
            ));
            const baseFaceCounts = Object.fromEntries(
                Object.keys(state.pendingAttack!.attackDiceFaceCounts ?? {}).map(face => [face, 0])
            ) as NonNullable<DiceThroneCore['pendingAttack']>['attackDiceFaceCounts'];
            const attackDiceFaceCounts = attackDiceValues.reduce((counts, value) => {
                const face = getPlayerDieFace(state, state.pendingAttack!.attackerId, value);
                if (!face) return counts;
                return { ...counts, [face]: (counts?.[face] ?? 0) + 1 };
            }, baseFaceCounts);
            return {
                ...state.pendingAttack!,
                attackDiceValues,
                attackDiceFaceCounts,
            };
        })()
        : state.pendingAttack;
    const targetsCoreDie = target === undefined || target === 'activeDie';
    const isCurrentContextOnlyDie = Boolean(
        state.currentRollContext
        && targetsCoreDie
        && state.currentRollContext.dice.some(die => die.id === dieId)
        && !state.dice.slice(0, state.rollDiceCount).some(die => die.id === dieId),
    );
    const didCurrentContextDieValueChange = Boolean(
        state.currentRollContext
        && targetsCoreDie
        && state.currentRollContext.dice.some(die => die.id === dieId && die.value !== newValue),
    );
    const didDieValueChange = (targetsCoreDie && state.dice.some(d => d.id === dieId && d.value !== newValue))
        || didCurrentContextDieValueChange;
    const newDice = targetsCoreDie && !isCurrentContextOnlyDie
        ? state.dice.map(d => {
            if (d.id !== dieId) return d;
            const face = getDieFaceByDefinition(d.definitionId, newValue);
            return { ...d, value: newValue, symbol: face, symbols: face ? [face] : [] };
        })
        : state.dice;

    const rollConfirmed = (state.rollConfirmed && didDieValueChange) ? false : state.rollConfirmed;

    const contextDice = state.currentRollContext && (target === undefined || target === 'activeDie')
        ? state.currentRollContext.dice.map(die => {
            if (die.id !== dieId) return die;
            const face = die.ownerId
                ? getPlayerDieFace(state, die.ownerId, newValue)
                : getDieFaceByDefinition(die.definitionId, newValue);
            return { ...die, value: newValue, symbol: face, symbols: face ? [face] : [] };
        })
        : undefined;
    const nextState = {
        ...state,
        dice: newDice,
        rollConfirmed,
        pendingBonusDiceSettlement,
        pendingAttack,
        ...(contextDice ? { currentRollContext: { ...state.currentRollContext!, dice: contextDice } } : {}),
    };
    if (targetsPendingBonusDie && pendingBonusDiceSettlement) {
        return setCurrentRollContextDice(nextState, getBonusSettlementContextDice(nextState, pendingBonusDiceSettlement));
    }
    if (contextDice) {
        return {
            ...nextState,
            currentRollContext: {
                ...state.currentRollContext!,
                dice: contextDice,
            },
        };
    }
    return syncLegacyMainDiceToCurrentRollContext(nextState);
};

/**
 * 处理骰子重掷事件
 * 
 * 设计原则（同 handleDieModified）：
 * - 只要当前投掷池的骰面真实发生变化，就重置 rollConfirmed=false
 * - 这样投掷方若仍有剩余投掷次数，可以继续重投并重新确认
 */
const handleDieRerolled: EventHandler<Extract<DiceThroneEvent, { type: 'DIE_REROLLED' }>> = (
    state,
    event
) => {
    const { dieId, newValue, ownerId, target } = event.payload;
    if (target === 'evasionDie') {
        return updateEvasionRollResult(state, newValue);
    }
    if ((target === undefined || target === 'activeDie') && state.currentRollContext?.kind === 'compare') {
        return updateCompareRollContextDie(state, dieId, newValue);
    }
    const targetsPendingBonusDie = isCurrentBonusRollSettlement(state)
        && (target === 'pendingBonusDie'
        || (
            target === undefined
            && getPendingBonusSettlementDice(state.pendingBonusDiceSettlement).some(die => die.index === dieId)
            && !state.dice.some(die => die.id === dieId)
        ));
    if (targetsPendingBonusDie && state.pendingBonusDiceSettlement) {
        const pendingBonusDiceSettlement = updatePendingBonusSettlementDie(state, dieId, newValue);
        return setCurrentRollContextDice(
            { ...state, pendingBonusDiceSettlement },
            getBonusSettlementContextDice({ ...state, pendingBonusDiceSettlement }, pendingBonusDiceSettlement),
        );
    }
    const isCurrentContextOnlyDie = Boolean(
        state.currentRollContext
        && (target === undefined || target === 'activeDie')
        && state.currentRollContext.dice.some(die => die.id === dieId)
        && !state.dice.slice(0, state.rollDiceCount).some(die => die.id === dieId),
    );
    const didCurrentContextDieValueChange = Boolean(
        state.currentRollContext
        && (target === undefined || target === 'activeDie')
        && state.currentRollContext.dice.some(die => die.id === dieId && die.value !== newValue),
    );
    const didDieValueChange = state.dice.some(d => d.id === dieId && d.value !== newValue)
        || didCurrentContextDieValueChange;
    const newDice = isCurrentContextOnlyDie
        ? state.dice
        : state.dice.map(d => {
        if (d.id !== dieId) return d;
        const face = getDieFaceByDefinition(d.definitionId, newValue);
        return { ...d, value: newValue, symbol: face, symbols: face ? [face] : [] };
    });

    const rollConfirmed = (state.rollConfirmed && didDieValueChange) ? false : state.rollConfirmed;

    const contextDice = state.currentRollContext && (target === undefined || target === 'activeDie')
        ? state.currentRollContext.dice.map(die => {
            if (die.id !== dieId) return die;
            const face = die.ownerId
                ? getPlayerDieFace(state, die.ownerId, newValue)
                : getDieFaceByDefinition(die.definitionId, newValue);
            return { ...die, value: newValue, symbol: face, symbols: face ? [face] : [] };
        })
        : undefined;
    return contextDice
        ? { ...state, dice: newDice, rollConfirmed, currentRollContext: { ...state.currentRollContext!, dice: contextDice } }
        : syncLegacyMainDiceToCurrentRollContext({ ...state, dice: newDice, rollConfirmed });
};

/**
 * 处理投掷次数变化事件
 */
const handleRollLimitChanged: EventHandler<Extract<DiceThroneEvent, { type: 'ROLL_LIMIT_CHANGED' }>> = (
    state,
    event
) => ({ ...state, rollLimit: event.payload.newLimit });

/**
 * 处理交互请求事件（已废弃 - 迁移到 InteractionSystem）
 */
// const handleInteractionRequested: EventHandler<Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }>> = (
//     state
// ) => {
//     return state;
// };

/**
 * 处理交互完成事件（已废弃 - 迁移到 InteractionSystem）
 */
// const handleInteractionCompleted: EventHandler<Extract<DiceThroneEvent, { type: 'INTERACTION_COMPLETED' }>> = (
//     state
// ) => {
//     return state;
// };

/**
 * 处理交互取消事件
 * - 把卡牌从弃牌堆还回手牌
 * - 返还已扣除的 CP
 */
const handleInteractionCancelled: EventHandler<Extract<DiceThroneEvent, { type: 'INTERACTION_CANCELLED' }>> = (
    state,
    event
) => {
    const { sourceCardId, cpCost, playerId } = event.payload;
    let players = state.players;

    const player = state.players[playerId];
    if (player && sourceCardId) {
        const [card, newDiscard] = removeCard(player.discard, sourceCardId);
        let newHand = player.hand;
        let finalDiscard = player.discard;
        if (card) {
            newHand = [...player.hand, card];
            finalDiscard = newDiscard;
        }

        let newResources = player.resources;
        if (cpCost > 0) {
            const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
            newResources = { ...player.resources, [RESOURCE_IDS.CP]: currentCp + cpCost };
        }

        players = {
            ...state.players,
            [playerId]: { ...player, hand: newHand, discard: finalDiscard, resources: newResources },
        };
    }

    return {
        ...state,
        players,
        activatingAbilityId: undefined,
        currentChoiceSourceAbilityId: undefined,
        currentChoiceContext: undefined,
    };
};

// ============================================================================
// 奖励骰重掷事件处理器
// ============================================================================

/**
 * 处理奖励骰重掷请求事件
 * 启动延后结算流程
 */
const handleBonusDiceRerollRequested: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DICE_REROLL_REQUESTED' }>> = (
    state,
    event
) => {
    const previousSettlement = state.pendingBonusDiceSettlement;
    const hasCurrentPreviousSettlement = previousSettlement
        && isCurrentBonusRollSettlement(state, previousSettlement);
    const settlement = hasCurrentPreviousSettlement
        ? {
            ...event.payload.settlement,
            suspendedParentSettlement: previousSettlement,
        }
        : event.payload.settlement;
    const nextState = {
        ...state,
        pendingBonusDiceSettlement: settlement,
    };
    if (getBonusSettlementContextDice(nextState, settlement).length > 0) {
        const parentState = hasCurrentPreviousSettlement && !state.currentRollContext
            ? {
                ...nextState,
                currentRollContext: createBonusRollContextFromSettlement(state, previousSettlement),
            }
            : nextState;
        return openTemporaryRollContext(
            parentState,
            createBonusRollContextFromSettlement(parentState, settlement),
        );
    }
    return clearCurrentRollContext(nextState, state.currentRollContext?.id);
};

const handleCompareRollRequested: EventHandler<Extract<DiceThroneEvent, { type: 'COMPARE_ROLL_REQUESTED' }>> = (
    state,
    event
) => replaceCurrentRollContext(state, event.payload.context);

const handleCompareRollSettled: EventHandler<Extract<DiceThroneEvent, { type: 'COMPARE_ROLL_SETTLED' }>> = (
    state,
    event
) => {
    const context = state.currentRollContext;
    if (!context || context.id !== event.payload.contextId) return state;
    return {
        ...state,
        currentRollContext: {
            ...context,
            status: 'settled',
            policy: {
                ...context.policy,
                modifiableBy: 'none',
                rerollableBy: 'none',
                allowPassiveReroll: false,
                allowDiceCardTargeting: false,
                blocksPhaseFlow: false,
            },
            display: {
                ...context.display,
                surface: 'diceTray',
                replayOnly: true,
            },
        },
    };
};

/**
 * 处理奖励骰重掷事件
 * 更新待结算的骰子状态，消耗 Token
 */
const handleBonusDieRerolled: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DIE_REROLLED' }>> = (
    state,
    event
) => {
    const { dieIndex, newValue, newFace, costTokenId, costAmount, playerId, effectParams } = event.payload;

    // 更新 pendingBonusDiceSettlement
    let pendingBonusDiceSettlement = state.pendingBonusDiceSettlement;
    if (state.pendingBonusDiceSettlement) {
        const updatedSettlement = updatePendingBonusSettlementDie(state, dieIndex, newValue, {
            ...effectParams,
            value: newValue,
            index: dieIndex,
        });
        const newDice = getPendingBonusSettlementDice(updatedSettlement).map(d =>
            d.index === dieIndex ? { ...d, face: newFace } : d);
        pendingBonusDiceSettlement = {
            ...updatedSettlement,
            dice: newDice,
            rerollCount: state.pendingBonusDiceSettlement.rerollCount + 1,
            lastRerolledDieIndex: dieIndex,
        };
    }

    // 消耗 Token
    let players = state.players;
    const player = state.players[playerId];
    if (player?.tokens) {
        const currentAmount = player.tokens[costTokenId] ?? 0;
        players = {
            ...state.players,
            [playerId]: { ...player, tokens: { ...player.tokens, [costTokenId]: Math.max(0, currentAmount - costAmount) } },
        };
    }

    // UI 展示由 EventStream 消费（事件 payload 已包含展示字段）
    const nextState = {
        ...state,
        players,
        pendingBonusDiceSettlement,
    };
    if (pendingBonusDiceSettlement && isCurrentBonusRollSettlement(
        { ...nextState, currentRollContext: state.currentRollContext },
        pendingBonusDiceSettlement,
    )) {
        return setCurrentRollContextDice(nextState, getBonusSettlementContextDice(nextState, pendingBonusDiceSettlement));
    }
    return nextState;
};

/**
 * 处理角色选择事件
 */
const handleCharacterSelected: EventHandler<Extract<DiceThroneEvent, { type: 'CHARACTER_SELECTED' }>> = (
    state,
    event
) => {
    const { playerId, characterId, initialDeckCardIds } = event.payload;
    const selectedCharacters = { ...(state.selectedCharacters || {}), [playerId]: characterId };

    let players = state.players;
    const player = state.players[playerId];
    if (player) {
        const playerUpdates: Partial<HeroState> = { characterId };
        if (initialDeckCardIds?.length) {
            playerUpdates.initialDeckCardIds = initialDeckCardIds;
        }
        players = {
            ...state.players,
            [playerId]: { ...player, ...playerUpdates },
        };
    }

    return { ...state, selectedCharacters, players };
};

/**
 * 处理英雄初始化事件
 */
const handleHeroInitialized: EventHandler<Extract<DiceThroneEvent, { type: 'HERO_INITIALIZED' }>> = (
    state,
    event
) => {
    const { playerId, characterId } = event.payload;
    const existingPlayer = state.players[playerId];
    const initialDeckCardIds = existingPlayer?.initialDeckCardIds;

    const dummyRandom: RandomFn = {
        random: () => 0.5,
        d: () => 1,
        range: (min) => min,
        shuffle: <T>(arr: T[]) => arr,
    };
    const heroState = initHeroState(playerId, characterId, dummyRandom, initialDeckCardIds);

    const shouldCreateDice = state.dice.length === 0 || playerId === state.activePlayerId;
    return {
        ...state,
        players: { ...state.players, [playerId]: heroState },
        dice: shouldCreateDice ? createCharacterDice(characterId) : state.dice,
    };
};

const handlePlayerBoardFaceChanged: EventHandler<Extract<DiceThroneEvent, { type: 'PLAYER_BOARD_FACE_CHANGED' }>> = (
    state,
    event,
) => {
    const { playerId, face } = event.payload;
    const player = state.players[playerId];
    if (!player || player.playerBoardFace === face || player.characterId === 'unselected') return state;

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                playerBoardFace: face,
                abilities: buildHeroAbilitiesForFace(
                    player.characterId,
                    face,
                    player.abilityLevels,
                ),
            },
        },
    };
};

// ============================================================================
// 主 Reducer
// ============================================================================

/**
 * 根据事件更新状态
 */
export const reduce = (
    state: DiceThroneCore,
    event: DiceThroneEvent
): DiceThroneCore => {
    switch (event.type) {
        case 'DICE_ROLLED':
            return handleDiceRolled(state, event);
        case 'BONUS_DIE_ROLLED':
            return handleBonusDieRolled(state, event);
        case 'PENDING_ATTACK_UPDATED':
            return handlePendingAttackUpdated(state, event);
        case 'DIE_LOCK_TOGGLED':
            return handleDieLockToggled(state, event);
        case 'ROLL_CONFIRMED':
            return handleRollConfirmed(state, event);
        // PHASE_CHANGED 领域事件已废弃，阶段切换由 FlowSystem 的 SYS_PHASE_CHANGED 处理
        case 'ABILITY_ACTIVATED':
            return handleAbilityActivated(state, event);
        case 'DAMAGE_DEALT':
            return handleDamageDealt(state, event);
        case 'HEAL_APPLIED':
            return handleHealApplied(state, event);
        case 'STATUS_APPLIED':
            return handleStatusApplied(state, event);
        case 'STATUS_REMOVED':
            return handleStatusRemoved(state, event);
        case 'TOKEN_GRANTED':
            return handleTokenGranted(state, event);
        case 'TOKEN_CONSUMED':
            return handleTokenConsumed(state, event);
        case 'TOKEN_LIMIT_CHANGED':
            return handleTokenLimitChanged(state, event);
        case 'DAMAGE_SHIELD_GRANTED':
            return handleDamageShieldGranted(state, event);
        case 'PREVENT_DAMAGE':
            return handlePreventDamage(state, event);
        case 'DAMAGE_PREVENTED':
            return handleDamagePrevented(state, event);
        case 'CARD_DRAWN':
            return handleCardDrawn(state, event);
        case 'CARD_DISCARDED':
            return handleCardDiscarded(state, event);
        case 'CARD_SOLD':
            return handleCardSold(state, event);
        case 'SELL_UNDONE':
            return handleSellUndone(state, event);
        case 'CARD_PLAYED':
            return handleCardPlayed(state, event);
        case 'CP_CHANGED':
            return handleCpChanged(state, event);
        case 'CARD_REORDERED':
            return handleCardReordered(state, event);
        case 'DECK_SHUFFLED':
            return handleDeckShuffled(state, event);
        case 'ATTACK_INITIATED':
            return handleAttackInitiated(state, event);
        case 'BONUS_DAMAGE_ADDED':
            return handleBonusDamageAdded(state, event);
        case 'ATTACK_PRE_DEFENSE_RESOLVED':
            return handleAttackPreDefenseResolved(state, event);
        case 'ATTACK_DEFENSE_RESOLVED':
            return handleAttackDefenseResolved(state, event);
        case 'ATTACK_RESOLVED':
            return handleAttackResolved(state, event);
        case 'ATTACK_MADE_UNDEFENDABLE':
            return handleAttackMadeUndefendable(state, event);
        case 'CHOICE_REQUESTED':
            return handleChoiceRequested(state, event);
        case 'CHOICE_RESOLVED':
            return handleChoiceResolved(state, event);
        case 'DEFENDER_SELECTION_REQUESTED':
            return handleDefenderSelectionRequested(state, event);
        case 'DEFENDER_SELECTION_RESOLVED':
            return handleDefenderSelectionResolved(state, event);
        case 'TURN_CHANGED':
            return handleTurnChanged(state, event);
        case 'ABILITY_REPLACED':
            return handleAbilityReplaced(state, event);
        case 'RESPONSE_WINDOW_OPENED':
            return handleResponseWindowOpened(state, event);
        case 'RESPONSE_WINDOW_CLOSED':
            return handleResponseWindowClosed(state, event);
        case 'DIE_MODIFIED':
            return handleDieModified(state, event);
        case 'DIE_REROLLED':
            return handleDieRerolled(state, event);
        case 'ROLL_LIMIT_CHANGED':
            return handleRollLimitChanged(state, event);
        // 已废弃 - 迁移到 InteractionSystem
        // case 'INTERACTION_REQUESTED':
        //     return handleInteractionRequested(state, event);
        // INTERACTION_COMPLETED 不参与 reduce（由 systems.ts 处理 resolveInteraction）
        case 'INTERACTION_CANCELLED':
            return handleInteractionCancelled(state, event);
        case 'TOKEN_RESPONSE_REQUESTED':
            return handleTokenResponseRequested(state, event);
        case 'TOKEN_USED':
            return handleTokenUsed(state, event);
        case 'TOKEN_RESPONSE_CLOSED':
            return handleTokenResponseClosed(state, event);
        case 'ABILITY_RESELECTION_REQUIRED':
            return handleAbilityReselectionRequired(state, event);
        case 'BONUS_DICE_REROLL_REQUESTED':
            return handleBonusDiceRerollRequested(state, event);
        case 'COMPARE_ROLL_REQUESTED':
            return handleCompareRollRequested(state, event);
        case 'COMPARE_ROLL_SETTLED':
            return handleCompareRollSettled(state, event);
        case 'BONUS_DIE_REROLLED':
            return handleBonusDieRerolled(state, event);
        case 'BONUS_DICE_SETTLED':
            return handleBonusDiceSettled(state, event);
        case 'ARTIFICER_BOT_STATE_UPDATED':
            return handleArtificerBotStateUpdated(state, event);
        case 'EXTRA_ATTACK_TRIGGERED':
            return handleExtraAttackTriggered(state, event);
        case 'CHARACTER_SELECTED':
            return handleCharacterSelected(state, event);
        case 'HERO_INITIALIZED':
            return handleHeroInitialized(state, event);
        case 'PLAYER_BOARD_FACE_CHANGED':
            return handlePlayerBoardFaceChanged(state, event);
        case 'HOST_STARTED':
            return handleHostStarted(state, event);
        case 'OFFENSIVE_ROLL_ATTEMPTS_RECORDED':
            return handleOffensiveRollAttemptsRecorded(state, event);
        case 'SEATING_MOVED':
            return handleSeatingMoved(state, event);
        case 'SEAT_SWAP_REQUESTED':
            return handleSeatSwapRequested(state, event);
        case 'SEAT_SWAP_REJECTED':
        case 'SEAT_SWAP_CANCELLED':
            return handleSeatSwapCleared(state, event);
        case 'PLAYER_READY':
            return handlePlayerReady(state, event);
        case 'PLAYER_UNREADY':
            return handlePlayerUnready(state, event);
        default: {
            // 处理系统层事件：SYS_PHASE_CHANGED 同步副作用到 core（阶段本身由 sys.phase 管理）
            if ((event as { type: string }).type === FLOW_EVENTS.PHASE_CHANGED) {
                const phaseEvent = event as unknown as { payload: { to: string; activePlayerId: string } };
                const { to, activePlayerId } = phaseEvent.payload;

                if (to === 'offensiveRoll') {
                    const playerDice = createPlayerDice(state, activePlayerId);
                    return clearCurrentRollContextUnlessSettledReplay({
                        ...state,
                        activePlayerId,
                        rollCount: 0,
                        rollLimit: 3,
                        rollDiceCount: 5,
                        rollConfirmed: false,
                        pendingAttack: null,
                        extraAttackInProgress: state.extraAttackInProgress
                            ? { ...state.extraAttackInProgress, phaseEntered: true }
                            : state.extraAttackInProgress,
                        dice: resetDiceArray(playerDice ?? state.dice, 5),
                    });
                }

                if (to === 'defensiveRoll') {
                    const defenderId = state.pendingAttack?.defenderId ?? activePlayerId;
                    const playerDice = createPlayerDice(state, defenderId);
                    return clearCurrentRollContextUnlessSettledReplay({
                        ...state,
                        activePlayerId,
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                        rollDiceCount: 0,
                        dice: resetDiceArray(playerDice ?? state.dice, 0),
                    });
                }

                if (to === 'targetingRoll') {
                    const playerDice = createPlayerDice(state, activePlayerId);
                    return clearCurrentRollContextUnlessSettledReplay({
                        ...state,
                        activePlayerId,
                        rollCount: 0,
                        rollLimit: 1,
                        rollDiceCount: 1,
                        rollConfirmed: false,
                        dice: resetDiceArray(playerDice ?? state.dice, 1),
                    });
                }

                if (to === 'main2') {
                    // 清理攻击相关状态
                    let players = state.players;
                    const activePlayer = state.players[activePlayerId];
                    if (activePlayer?.pendingBonusDamage !== undefined) {
                        players = {
                            ...state.players,
                            [activePlayerId]: {
                                ...activePlayer,
                                pendingBonusDamage: undefined,
                            },
                        };
                    }
                    
                    return clearCurrentRollContextUnlessSettledReplay({
                        ...state,
                        activePlayerId,
                        players,
                        extraAttackInProgress: state.extraAttackInProgress ? undefined : state.extraAttackInProgress,
                    });
                }

                return clearCurrentRollContextUnlessSettledReplay({ ...state, activePlayerId });
            }

            // 其他未知事件类型（包括系统层事件）直接返回原状态
            console.debug(`[Reducer] Ignoring event type: ${(event as { type: string }).type}`);
            return state;
        }
    }
};

// ============================================================================
// Choice Effect 处理器注册
// ============================================================================

/** 花开见佛：花费2太极使攻击不可防御 */
registerChoiceEffectHandler('lotus-palm-unblockable-pay', ({ state }) => {
    if (state.pendingAttack?.sourceAbilityId === 'lotus-palm') {
        return {
            pendingAttack: {
                ...state.pendingAttack,
                isDefendable: false,
                // 标记 preDefense 选择已完成，防止 autoContinue 在 CHOICE_RESOLVED 尚未 reduce 时提前触发
                offensiveRollEndTokenResolved: true,
            },
        };
    }
    return undefined;
});
