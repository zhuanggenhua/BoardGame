/**
 * DiceThrone 状态 Reducer
 * 确定性状态变更：reduce(state, event) => newState
 */

import type {
    DiceThroneCore,
    DiceThroneEvent,
    DieFace,
} from './types';
import { getAvailableAbilityIds, getDieFace } from './rules';
import { resourceSystem } from '../../../systems/ResourceSystem';
import { RESOURCE_IDS } from '../monk/resourceConfig';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 深拷贝状态（用于不可变更新）
 */
const cloneState = (state: DiceThroneCore): DiceThroneCore => {
    return JSON.parse(JSON.stringify(state));
};

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
    const newState = cloneState(state);
    const { results, rollerId } = event.payload;
    
    let resultIndex = 0;
    newState.dice.slice(0, newState.rollDiceCount).forEach(die => {
        if (!die.isKept && resultIndex < results.length) {
            const value = results[resultIndex];
            die.value = value;
            // 同步更新符号
            const face = getDieFace(value);
            die.symbol = face;
            die.symbols = [face];
            resultIndex++;
        }
    });
    
    newState.rollCount++;
    newState.rollConfirmed = false;
    newState.availableAbilityIds = getAvailableAbilityIds(newState, rollerId);
    
    return newState;
};

/**
 * 处理进攻方前置防御结算事件
 */
const handleAttackPreDefenseResolved: EventHandler<Extract<DiceThroneEvent, { type: 'ATTACK_PRE_DEFENSE_RESOLVED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { attackerId, defenderId, sourceAbilityId } = event.payload;

    if (newState.pendingAttack) {
        const matchesAttacker = newState.pendingAttack.attackerId === attackerId;
        const matchesDefender = newState.pendingAttack.defenderId === defenderId;
        const matchesSource = !sourceAbilityId || newState.pendingAttack.sourceAbilityId === sourceAbilityId;
        if (matchesAttacker && matchesDefender && matchesSource) {
            newState.pendingAttack.preDefenseResolved = true;
        }
    }

    return newState;
};

/**
 * 处理额外骰子结果事件
 */
const handleBonusDieRolled: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DIE_ROLLED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { value, face, playerId } = event.payload;
    
    // 设置独立的 lastBonusDieRoll 状态（用于 UI 展示）
    newState.lastBonusDieRoll = { value, face, playerId, timestamp: event.timestamp };
    
    // 记录额外投掷结果（用于 pendingAttack 追踪）
    if (newState.pendingAttack) {
        newState.pendingAttack.extraRoll = { value, resolved: true };
    }
    
    // 注意：骰面效果（bonusDamage、grantStatus、triggerChoice）
    // 统一由效果系统通过 resolveConditionalEffect 处理
    // 不在此处重复处理，避免状态重复增加
    
    return newState;
};

/**
 * 处理骰子锁定事件
 */
const handleDieLockToggled: EventHandler<Extract<DiceThroneEvent, { type: 'DIE_LOCK_TOGGLED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { dieId, isKept } = event.payload;
    
    const die = newState.dice.find(d => d.id === dieId);
    if (die) {
        die.isKept = isKept;
    }
    
    return newState;
};

/**
 * 处理骰子确认事件
 */
const handleRollConfirmed: EventHandler<Extract<DiceThroneEvent, { type: 'ROLL_CONFIRMED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { availableAbilityIds } = event.payload;
    
    newState.rollConfirmed = true;
    newState.availableAbilityIds = availableAbilityIds;
    
    return newState;
};

/**
 * 处理阶段切换事件
 */
const handlePhaseChanged: EventHandler<Extract<DiceThroneEvent, { type: 'PHASE_CHANGED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { to, activePlayerId } = event.payload;
    
    newState.turnPhase = to;
    newState.activePlayerId = activePlayerId;
    
    // 进入掷骰阶段时重置骰子状态
    if (to === 'offensiveRoll') {
        newState.rollCount = 0;
        newState.rollLimit = 3;
        newState.rollDiceCount = 5;
        newState.rollConfirmed = false;
        newState.availableAbilityIds = [];
        newState.pendingAttack = null;
        resetDice(newState);
    } else if (to === 'defensiveRoll') {
        newState.rollCount = 0;
        newState.rollLimit = 1;
        newState.rollDiceCount = 4;
        newState.rollConfirmed = false;
        newState.availableAbilityIds = [];
        resetDice(newState);
        if (newState.pendingAttack) {
            newState.availableAbilityIds = getAvailableAbilityIds(newState, newState.pendingAttack.defenderId);
        }
    }
    
    return newState;
};

/**
 * 重置骰子
 */
const resetDice = (state: DiceThroneCore): void => {
    const initialFace = getDieFace(1);
    state.dice.forEach((die, index) => {
        die.value = 1;
        die.symbol = initialFace;
        die.symbols = [initialFace];
        die.isKept = index >= state.rollDiceCount;
    });
};

/**
 * 处理技能激活事件
 */
const handleAbilityActivated: EventHandler<Extract<DiceThroneEvent, { type: 'ABILITY_ACTIVATED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { abilityId, isDefense } = event.payload;
    
    newState.activatingAbilityId = abilityId;

    if (isDefense && newState.pendingAttack) {
        newState.pendingAttack.defenseAbilityId = abilityId;
    }
    
    return newState;
};

/**
 * 处理伤害事件
 */
const handleDamageDealt: EventHandler<Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { targetId, actualDamage, sourceAbilityId } = event.payload;
    
    const target = newState.players[targetId];
    if (target) {
        // 使用 ResourceSystem 计算生命值变更
        const hpPool = { [RESOURCE_IDS.HP]: target.health };
        const result = resourceSystem.modify(hpPool, RESOURCE_IDS.HP, -actualDamage);
        target.health = result.newValue;
    }
    
    if (sourceAbilityId) {
        newState.lastEffectSourceByPlayerId = newState.lastEffectSourceByPlayerId || {};
        newState.lastEffectSourceByPlayerId[targetId] = sourceAbilityId;
    }
    
    return newState;
};

/**
 * 处理治疗事件
 */
const handleHealApplied: EventHandler<Extract<DiceThroneEvent, { type: 'HEAL_APPLIED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { targetId, amount, sourceAbilityId } = event.payload;
    
    const target = newState.players[targetId];
    if (target) {
        // 使用 ResourceSystem 计算治疗（会自动限制在最大生命值）
        const hpPool = { [RESOURCE_IDS.HP]: target.health };
        const result = resourceSystem.modify(hpPool, RESOURCE_IDS.HP, amount);
        target.health = result.newValue;
    }

    if (sourceAbilityId) {
        newState.lastEffectSourceByPlayerId = newState.lastEffectSourceByPlayerId || {};
        newState.lastEffectSourceByPlayerId[targetId] = sourceAbilityId;
    }
    
    return newState;
};

/**
 * 处理状态施加事件
 */
const handleStatusApplied: EventHandler<Extract<DiceThroneEvent, { type: 'STATUS_APPLIED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { targetId, statusId, newTotal, sourceAbilityId } = event.payload;
    
    const target = newState.players[targetId];
    if (target) {
        target.statusEffects[statusId] = newTotal;
    }

    if (sourceAbilityId) {
        newState.lastEffectSourceByPlayerId = newState.lastEffectSourceByPlayerId || {};
        newState.lastEffectSourceByPlayerId[targetId] = sourceAbilityId;
    }
    
    return newState;
};

/**
 * 处理状态移除事件
 */
const handleStatusRemoved: EventHandler<Extract<DiceThroneEvent, { type: 'STATUS_REMOVED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { targetId, statusId, stacks } = event.payload;
    
    const target = newState.players[targetId];
    if (target) {
        target.statusEffects[statusId] = Math.max(0, (target.statusEffects[statusId] || 0) - stacks);
    }
    
    return newState;
};

/**
 * 处理抽牌事件
 */
const handleCardDrawn: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_DRAWN' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, cardId } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        const cardIndex = player.deck.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const [card] = player.deck.splice(cardIndex, 1);
            player.hand.push(card);
        }
    }
    
    return newState;
};

/**
 * 处理弃牌事件
 */
const handleCardDiscarded: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_DISCARDED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, cardId } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const [card] = player.hand.splice(cardIndex, 1);
            player.discard.push(card);
        }
    }
    
    return newState;
};

/**
 * 处理售卖卡牌事件
 */
const handleCardSold: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_SOLD' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, cardId, cpGained } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const [card] = player.hand.splice(cardIndex, 1);
            player.discard.push(card);
            // 使用 ResourceSystem 计算 CP 增加（自动限制上限）
            const cpPool = { [RESOURCE_IDS.CP]: player.cp };
            const result = resourceSystem.modify(cpPool, RESOURCE_IDS.CP, cpGained);
            player.cp = result.newValue;
        }
    }
    
    newState.lastSoldCardId = cardId;
    
    return newState;
};

/**
 * 处理撤回售卖事件
 */
const handleSellUndone: EventHandler<Extract<DiceThroneEvent, { type: 'SELL_UNDONE' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, cardId } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        const cardIndex = player.discard.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const [card] = player.discard.splice(cardIndex, 1);
            player.hand.push(card);
            // 使用 ResourceSystem 计算 CP 减少（自动限制下限）
            const cpPool = { [RESOURCE_IDS.CP]: player.cp };
            const result = resourceSystem.modify(cpPool, RESOURCE_IDS.CP, -1);
            player.cp = result.newValue;
        }
    }
    
    newState.lastSoldCardId = undefined;
    
    return newState;
};

/**
 * 处理打出卡牌事件
 */
const handleCardPlayed: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_PLAYED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, cardId, cpCost } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const [card] = player.hand.splice(cardIndex, 1);
            player.discard.push(card);
            // 使用 ResourceSystem 支付 CP
            const cpPool = { [RESOURCE_IDS.CP]: player.cp };
            player.cp = resourceSystem.pay(cpPool, { [RESOURCE_IDS.CP]: cpCost })[RESOURCE_IDS.CP];
        }
    }
    
    // 打出卡牌后清除撤回状态
    newState.lastSoldCardId = undefined;
    
    return newState;
};

/**
 * 处理技能升级事件
 */
const handleAbilityUpgraded: EventHandler<Extract<DiceThroneEvent, { type: 'ABILITY_UPGRADED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, abilityId, newLevel, cardId } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        player.abilityLevels[abilityId] = newLevel;
        
        // 移除卡牌
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const [card] = player.hand.splice(cardIndex, 1);
            player.discard.push(card);
        }
    }
    
    return newState;
};

/**
 * 处理 CP 变化事件
 */
const handleCpChanged: EventHandler<Extract<DiceThroneEvent, { type: 'CP_CHANGED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, newValue } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        // 使用 ResourceSystem 设置 CP（确保边界限制）
        const cpPool = { [RESOURCE_IDS.CP]: player.cp };
        const result = resourceSystem.setValue(cpPool, RESOURCE_IDS.CP, newValue);
        player.cp = result.newValue;
    }
    
    return newState;
};

/**
 * 处理卡牌重排事件
 */
const handleCardReordered: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_REORDERED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, cardId } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex !== -1 && cardIndex < player.hand.length - 1) {
            const [card] = player.hand.splice(cardIndex, 1);
            player.hand.push(card);
        }
    }
    
    return newState;
};

/**
 * 处理攻击发起事件
 */
const handleAttackInitiated: EventHandler<Extract<DiceThroneEvent, { type: 'ATTACK_INITIATED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { attackerId, defenderId, sourceAbilityId, isDefendable } = event.payload;
    
    newState.pendingAttack = {
        attackerId,
        defenderId,
        isDefendable,
        sourceAbilityId,
        // 额外骰子现在在 resolveAttack 中自动投掷，不再需要设置 extraRoll
    };
    
    return newState;
};

/**
 * 处理攻击结算事件
 */
const handleAttackResolved: EventHandler<Extract<DiceThroneEvent, { type: 'ATTACK_RESOLVED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { sourceAbilityId, defenseAbilityId } = event.payload;
    
    // 记录激活的技能ID
    newState.activatingAbilityId = sourceAbilityId || defenseAbilityId;
    
    // 清除待处理攻击
    newState.pendingAttack = null;
    
    return newState;
};

/**
 * 处理选择请求事件
 * 注意：实际的 prompt 状态由 PromptSystem 管理在 sys.prompt 中
 * 这里仅记录来源信息
 */
const handleChoiceRequested: EventHandler<Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }>> = (
    state,
    _event
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
    const newState = cloneState(state);
    const { playerId, statusId, value, sourceAbilityId } = event.payload;
    
    const player = newState.players[playerId];
    if (player) {
        const def = newState.statusDefinitions.find(e => e.id === statusId);
        const maxStacks = def?.stackLimit || 99;
        const currentStacks = player.statusEffects[statusId] || 0;
        player.statusEffects[statusId] = Math.min(currentStacks + value, maxStacks);
    }

    if (sourceAbilityId) {
        newState.lastEffectSourceByPlayerId = newState.lastEffectSourceByPlayerId || {};
        newState.lastEffectSourceByPlayerId[playerId] = sourceAbilityId;
    }
    
    return newState;
};

/**
 * 处理回合切换事件
 */
const handleTurnChanged: EventHandler<Extract<DiceThroneEvent, { type: 'TURN_CHANGED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { nextPlayerId, turnNumber } = event.payload;
    
    newState.activePlayerId = nextPlayerId;
    newState.turnNumber = turnNumber;
    newState.turnPhase = 'upkeep';
    
    return newState;
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
        case 'PHASE_CHANGED':
            return handlePhaseChanged(state, event);
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
        case 'ABILITY_UPGRADED':
            return handleAbilityUpgraded(state, event);
        case 'CP_CHANGED':
            return handleCpChanged(state, event);
        case 'CARD_REORDERED':
            return handleCardReordered(state, event);
        case 'ATTACK_INITIATED':
            return handleAttackInitiated(state, event);
        case 'ATTACK_PRE_DEFENSE_RESOLVED':
            return handleAttackPreDefenseResolved(state, event);
        case 'ATTACK_RESOLVED':
            return handleAttackResolved(state, event);
        case 'CHOICE_REQUESTED':
            return handleChoiceRequested(state, event);
        case 'CHOICE_RESOLVED':
            return handleChoiceResolved(state, event);
        case 'TURN_CHANGED':
            return handleTurnChanged(state, event);
        default: {
            const _exhaustive: never = event;
            console.warn(`Unknown event type: ${(_exhaustive as DiceThroneEvent).type}`);
            return state;
        }
    }
};
