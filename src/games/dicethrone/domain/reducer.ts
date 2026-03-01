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
import { getDieFaceByDefinition, getTokenStackLimit, getRollerId } from './rules';
import { RESOURCE_IDS } from './resources';
import { TOKEN_IDS } from './ids';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';
import { initHeroState, createCharacterDice } from './characters';
import { getChoiceEffectHandler, registerChoiceEffectHandler } from './choiceEffects';
import { removeCard } from './utils';
import {
    handlePreventDamage, handleAttackPreDefenseResolved, handleDamageDealt,
    handleHealApplied, handleAttackInitiated, handleAttackResolved,
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

// ============================================================================
// 事件处理器
// ============================================================================

type EventHandler<E extends DiceThroneEvent> = (
    state: DiceThroneCore,
    event: E
) => DiceThroneCore;

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
    return { ...state, dice: newDice, rollCount: state.rollCount + 1, rollConfirmed: false };
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
            sourceName: '伏击',
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
 * 处理骰子锁定事件
 */
const handleDieLockToggled: EventHandler<Extract<DiceThroneEvent, { type: 'DIE_LOCK_TOGGLED' }>> = (
    state,
    event
) => {
    const { dieId, isKept } = event.payload;
    return {
        ...state,
        dice: state.dice.map(d => d.id === dieId ? { ...d, isKept } : d),
    };
};

/**
 * 处理骰子确认事件
 */
const handleRollConfirmed: EventHandler<Extract<DiceThroneEvent, { type: 'ROLL_CONFIRMED' }>> = (
    state
) => ({ ...state, rollConfirmed: true });

/**
 * 处理房主开始事件
 */
const handleHostStarted: EventHandler<Extract<DiceThroneEvent, { type: 'HOST_STARTED' }>> = (
    state
) => ({ ...state, hostStarted: true });

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
 * 处理奖励骰结算事件
 * 清除 pendingBonusDiceSettlement。
 * 非 displayOnly 时标记 pendingAttack.bonusDiceResolved，
 * 避免 autoContinue 重入 defensiveRoll exit 时重复执行 resolveAttack。
 */
const handleBonusDiceSettled: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DICE_SETTLED' }>> = (
    state,
    event
) => {
    const isDisplayOnly = !!(event.payload as any)?.displayOnly;
    // 非 displayOnly 时，标记 pendingAttack.bonusDiceResolved
    const pendingAttack = !isDisplayOnly && state.pendingAttack
        ? { ...state.pendingAttack, bonusDiceResolved: true }
        : state.pendingAttack;
    return { ...state, pendingBonusDiceSettlement: undefined, pendingAttack };
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
    if (state.pendingAttack.defenseAbilityId === abilityId) {
        return { ...state, activatingAbilityId: abilityId };
    }

    let rollDiceCount = state.rollDiceCount;
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
        if (ability?.trigger) {
            const triggerDiceCount = (ability.trigger as { diceCount?: number }).diceCount;
            if (triggerDiceCount !== undefined && triggerDiceCount > 0) {
                rollDiceCount = triggerDiceCount;
                dice = resetDiceArray(state.dice, triggerDiceCount);
            }
        }
    }

    return {
        ...state,
        activatingAbilityId: abilityId,
        pendingAttack: { ...state.pendingAttack, defenseAbilityId: abilityId },
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

    return {
        ...state,
        players: {
            ...state.players,
            [targetId]: {
                ...target,
                statusEffects: { ...target.statusEffects, [statusId]: newTotal },
            },
        },
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

    // 潜行获得时记录当前回合号（用于自动弃除判定）
    let sneakGainedTurn = state.sneakGainedTurn;
    if (tokenId === TOKEN_IDS.SNEAK && newTotal > 0) {
        sneakGainedTurn = { ...(sneakGainedTurn || {}), [targetId]: state.turnNumber };
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
    };
};

/**
 * 处理 Token 消耗事件
 */
const handleTokenConsumed: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_CONSUMED' }>> = (
    state,
    event
) => {
    const { playerId, tokenId, newTotal } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    // 潜行消耗时清除获得回合追踪
    let sneakGainedTurn = state.sneakGainedTurn;
    if (tokenId === TOKEN_IDS.SNEAK && newTotal <= 0 && sneakGainedTurn?.[playerId] !== undefined) {
        sneakGainedTurn = { ...sneakGainedTurn };
        delete sneakGainedTurn[playerId];
    }

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, tokens: { ...player.tokens, [tokenId]: newTotal } },
        },
        sneakGainedTurn,
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
    state
) => {
    // 不修改核心状态，prompt 由系统层管理
    return state;
};

/**
 * 处理选择完成事件
 */
const handleChoiceResolved: EventHandler<Extract<DiceThroneEvent, { type: 'CHOICE_RESOLVED' }>> = (
    state,
    event
) => {
    const { playerId, statusId, tokenId, value, customId, sourceAbilityId } = event.payload;
    let resultState = state;

    const player = state.players[playerId];
    if (player) {
        let playerUpdates: Partial<HeroState> = {};
        if (tokenId) {
            const maxStacks = getTokenStackLimit(state, playerId, tokenId);
            const currentAmount = player.tokens[tokenId] || 0;
            const nextAmount = Math.max(0, Math.min(currentAmount + value, maxStacks));
            playerUpdates = { tokens: { ...player.tokens, [tokenId]: nextAmount } };
        } else if (statusId) {
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
        const handler = getChoiceEffectHandler(customId);
        if (handler) {
            const result = handler({ state: resultState, playerId, customId, sourceAbilityId, value });
            if (result) {
                resultState = { ...resultState, ...result };
            }
        }
    }

    if (sourceAbilityId) {
        resultState = {
            ...resultState,
            lastEffectSourceByPlayerId: { ...(resultState.lastEffectSourceByPlayerId || {}), [playerId]: sourceAbilityId },
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
    return { ...state, activePlayerId: nextPlayerId, turnNumber, lastResolvedAttackDamage: undefined };
};

/**
 * 处理响应窗口打开事件
 * 注意：实际状态由 ResponseWindowSystem 管理在 sys.responseWindow 中
 */
const handleResponseWindowOpened: EventHandler<Extract<DiceThroneEvent, { type: 'RESPONSE_WINDOW_OPENED' }>> = (
    state
) => {
    // 不修改核心状态，响应窗口由系统层管理
    return state;
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

/**
 * 处理骰子修改事件
 * 
 * 设计原则：
 * - 如果修改骰子的玩家 === 骰子所有者（rollerId），则重置 rollConfirmed=false
 * - 这样对手有机会响应新的骰面
 * - 如果是对手改我的骰，不需要重新确认（我只能接受结果）
 */
const handleDieModified: EventHandler<Extract<DiceThroneEvent, { type: 'DIE_MODIFIED' }>> = (
    state,
    event
) => {
    const { dieId, newValue, playerId } = event.payload;
    const newDice = state.dice.map(d => {
        if (d.id !== dieId) return d;
        const face = getDieFaceByDefinition(d.definitionId, newValue);
        return { ...d, value: newValue, symbol: face, symbols: face ? [face] : [] };
    });

    const rollerId = getRollerId(state);
    const rollConfirmed = (playerId === rollerId && state.rollConfirmed) ? false : state.rollConfirmed;

    return { ...state, dice: newDice, rollConfirmed };
};

/**
 * 处理骰子重掷事件
 * 
 * 设计原则（同 handleDieModified）：
 * - 如果重掷骰子的玩家 === 骰子所有者（rollerId），则重置 rollConfirmed=false
 * - 这样对手有机会响应新的骰面
 */
const handleDieRerolled: EventHandler<Extract<DiceThroneEvent, { type: 'DIE_REROLLED' }>> = (
    state,
    event
) => {
    const { dieId, newValue, playerId } = event.payload;
    const newDice = state.dice.map(d => {
        if (d.id !== dieId) return d;
        const face = getDieFaceByDefinition(d.definitionId, newValue);
        return { ...d, value: newValue, symbol: face, symbols: face ? [face] : [] };
    });

    const rollerId = getRollerId(state);
    const rollConfirmed = (playerId === rollerId && state.rollConfirmed) ? false : state.rollConfirmed;

    return { ...state, dice: newDice, rollConfirmed };
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
) => ({ ...state, pendingBonusDiceSettlement: event.payload.settlement });

/**
 * 处理奖励骰重掷事件
 * 更新待结算的骰子状态，消耗 Token
 */
const handleBonusDieRerolled: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DIE_REROLLED' }>> = (
    state,
    event
) => {
    const { dieIndex, newValue, newFace, costTokenId, costAmount, playerId } = event.payload;

    // 更新 pendingBonusDiceSettlement
    let pendingBonusDiceSettlement = state.pendingBonusDiceSettlement;
    if (state.pendingBonusDiceSettlement) {
        const newDice = state.pendingBonusDiceSettlement.dice.map(d =>
            d.index === dieIndex ? { ...d, value: newValue, face: newFace } : d);
        pendingBonusDiceSettlement = {
            ...state.pendingBonusDiceSettlement,
            dice: newDice,
            rerollCount: state.pendingBonusDiceSettlement.rerollCount + 1,
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
    return {
        ...state,
        players,
        pendingBonusDiceSettlement,
    };
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
        case 'ATTACK_PRE_DEFENSE_RESOLVED':
            return handleAttackPreDefenseResolved(state, event);
        case 'ATTACK_RESOLVED':
            return handleAttackResolved(state, event);
        case 'ATTACK_MADE_UNDEFENDABLE':
            return handleAttackMadeUndefendable(state, event);
        case 'CHOICE_REQUESTED':
            return handleChoiceRequested(state, event);
        case 'CHOICE_RESOLVED':
            return handleChoiceResolved(state, event);
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
        // INTERACTION_COMPLETED 已废弃 — 不再生成，交互完成由 systems.ts 直接调用 resolveInteraction
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
        case 'BONUS_DIE_REROLLED':
            return handleBonusDieRerolled(state, event);
        case 'BONUS_DICE_SETTLED':
            return handleBonusDiceSettled(state, event);
        case 'EXTRA_ATTACK_TRIGGERED':
            return handleExtraAttackTriggered(state, event);
        case 'CHARACTER_SELECTED':
            return handleCharacterSelected(state, event);
        case 'HERO_INITIALIZED':
            return handleHeroInitialized(state, event);
        case 'HOST_STARTED':
            return handleHostStarted(state, event);
        case 'PLAYER_READY':
            return handlePlayerReady(state, event);
        default: {
            // 处理系统层事件：SYS_PHASE_CHANGED 同步副作用到 core（阶段本身由 sys.phase 管理）
            if ((event as { type: string }).type === FLOW_EVENTS.PHASE_CHANGED) {
                const phaseEvent = event as unknown as { payload: { to: string; activePlayerId: string } };
                const { to, activePlayerId } = phaseEvent.payload;

                if (to === 'offensiveRoll') {
                    const playerDice = createPlayerDice(state, activePlayerId);
                    return {
                        ...state,
                        activePlayerId,
                        rollCount: 0,
                        rollLimit: 3,
                        rollDiceCount: 5,
                        rollConfirmed: false,
                        pendingAttack: null,
                        dice: resetDiceArray(playerDice ?? state.dice, 5),
                    };
                }

                if (to === 'defensiveRoll') {
                    const defenderId = state.pendingAttack?.defenderId ?? activePlayerId;
                    const playerDice = createPlayerDice(state, defenderId);
                    return {
                        ...state,
                        activePlayerId,
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                        rollDiceCount: 0,
                        dice: resetDiceArray(playerDice ?? state.dice, 0),
                    };
                }

                if (to === 'main2' && state.extraAttackInProgress) {
                    return { ...state, activePlayerId, extraAttackInProgress: undefined };
                }

                return { ...state, activePlayerId };
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

/** 莲花掌：花费2太极使攻击不可防御 */
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
