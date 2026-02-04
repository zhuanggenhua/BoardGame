/**
 * DiceThrone 状态 Reducer
 * 确定性状态变更：reduce(state, event) => newState
 */

import type {
    DiceThroneCore,
    DiceThroneEvent,
    TurnPhase,
} from './types';
import { getDieFace, getTokenStackLimit } from './rules';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';
import { MONK_CARDS } from '../monk/cards';
import { initHeroState, createCharacterDice } from './characters';

// ============================================================================
// Choice Effect 处理器注册表
// ============================================================================

/**
 * Choice Effect 处理器上下文
 */
export interface ChoiceEffectContext {
    state: DiceThroneCore;
    playerId: string;
    customId: string;
    sourceAbilityId?: string;
}

/**
 * Choice Effect 处理器函数类型
 * 返回修改后的 state（或 undefined 表示不处理）
 */
export type ChoiceEffectHandler = (context: ChoiceEffectContext) => DiceThroneCore | undefined;

/**
 * Choice Effect 处理器注册表
 * 新增选择效果只需注册处理器，无需修改 handleChoiceResolved
 */
const choiceEffectHandlers: Map<string, ChoiceEffectHandler> = new Map();

/**
 * 注册 Choice Effect 处理器
 */
export function registerChoiceEffectHandler(customId: string, handler: ChoiceEffectHandler): void {
    if (choiceEffectHandlers.has(customId)) {
        console.warn(`[DiceThrone] ChoiceEffect "${customId}" 已存在，将被覆盖`);
    }
    choiceEffectHandlers.set(customId, handler);
}

/**
 * 获取 Choice Effect 处理器
 */
export function getChoiceEffectHandler(customId: string): ChoiceEffectHandler | undefined {
    return choiceEffectHandlers.get(customId);
}

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
    const { results } = event.payload;

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
    const { value, face, playerId, targetPlayerId, effectKey, effectParams } = event.payload;

    // 设置独立的 lastBonusDieRoll 状态（用于 UI 展示）
    newState.lastBonusDieRoll = {
        value,
        face,
        playerId,
        targetPlayerId,
        timestamp: event.timestamp,
        effectKey,
        effectParams,
    };

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
    _event
) => {
    const newState = cloneState(state);

    newState.rollConfirmed = true;

    return newState;
};

/**
 * 处理房主开始事件
 */
const handleHostStarted: EventHandler<Extract<DiceThroneEvent, { type: 'HOST_STARTED' }>> = (
    state,
    _event
) => {
    const newState = cloneState(state);
    newState.hostStarted = true;
    return newState;
};

/**
 * 处理玩家准备事件
 */
const handlePlayerReady: EventHandler<Extract<DiceThroneEvent, { type: 'PLAYER_READY' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    newState.readyPlayers[event.payload.playerId] = true;
    return newState;
};

/**
 * 处理奖励骰结算事件
 * 清除 pendingBonusDiceSettlement，应用伤害和状态效果
 */
const handleBonusDiceSettled: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DICE_SETTLED' }>> = (
    state,
    _event
) => {
    const newState = cloneState(state);
    // 清除待结算状态，伤害由 DAMAGE_DEALT 事件处理
    newState.pendingBonusDiceSettlement = undefined;
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
 * 注意：伤害先经过护盾抵消，剩余伤害再扣血
 */
const handleDamageDealt: EventHandler<Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { targetId, actualDamage, sourceAbilityId } = event.payload;

    const target = newState.players[targetId];
    if (target) {
        let remainingDamage = actualDamage;

        // 消耗护盾抵消伤害
        if (target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
            // 按添加顺序消耗护盾
            const shield = target.damageShields[0];
            const preventedAmount = Math.min(shield.value, remainingDamage);
            remainingDamage -= preventedAmount;

            // 清空所有护盾（下次受伤后清空的设计）
            target.damageShields = [];
        }

        // 剩余伤害扣血
        if (remainingDamage > 0) {
            const result = resourceSystem.modify(target.resources, RESOURCE_IDS.HP, -remainingDamage);
            target.resources = result.pool;
        }
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
        const result = resourceSystem.modify(target.resources, RESOURCE_IDS.HP, amount);
        target.resources = result.pool;
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
 * 处理 Token 授予事件
 */
const handleTokenGranted: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_GRANTED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { targetId, tokenId, newTotal, sourceAbilityId } = event.payload;

    const target = newState.players[targetId];
    if (target) {
        target.tokens[tokenId] = newTotal;
    }

    if (sourceAbilityId) {
        newState.lastEffectSourceByPlayerId = newState.lastEffectSourceByPlayerId || {};
        newState.lastEffectSourceByPlayerId[targetId] = sourceAbilityId;
    }

    return newState;
};

/**
 * 处理 Token 消耗事件
 */
const handleTokenConsumed: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_CONSUMED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, tokenId, newTotal } = event.payload;

    const player = newState.players[playerId];
    if (player) {
        player.tokens[tokenId] = newTotal;
    }

    return newState;
};

/**
 * 处理 Token 上限变化事件
 */
const handleTokenLimitChanged: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_LIMIT_CHANGED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, tokenId, newLimit, sourceAbilityId } = event.payload;

    const player = newState.players[playerId];
    if (player) {
        player.tokenStackLimits[tokenId] = newLimit;
    }

    if (sourceAbilityId) {
        newState.lastEffectSourceByPlayerId = newState.lastEffectSourceByPlayerId || {};
        newState.lastEffectSourceByPlayerId[playerId] = sourceAbilityId;
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
            const result = resourceSystem.modify(player.resources, RESOURCE_IDS.CP, cpGained);
            player.resources = result.pool;
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
            const result = resourceSystem.modify(player.resources, RESOURCE_IDS.CP, -1);
            player.resources = result.pool;
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

    // 如果有上一张卡的待展示特写，先触发它（处理无交互也无响应窗口的卡牌）
    if (newState.pendingCardSpotlight) {
        newState.lastPlayedCard = newState.pendingCardSpotlight;
        // 注意：不清除，留给后续逻辑覆盖
    }

    const player = newState.players[playerId];
    if (player) {
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const [card] = player.hand.splice(cardIndex, 1);
            player.discard.push(card);
            // 使用 ResourceSystem 支付 CP
            player.resources = resourceSystem.pay(player.resources, { [RESOURCE_IDS.CP]: cpCost });

            // 直接设置 lastPlayedCard（立即触发特写）
            // 如果后续有 INTERACTION_REQUESTED 事件，会在那里清除并暂存
            const resolvedPreviewRef = MONK_CARDS.find(cardDef => cardDef.id === cardId)?.previewRef
                ?? card.previewRef;

            newState.lastPlayedCard = {
                cardId,
                playerId,
                previewRef: resolvedPreviewRef,
                timestamp: event.timestamp,
            };
        }
    }

    // 打出卡牌后清除撤回状态
    newState.lastSoldCardId = undefined;

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
        const result = resourceSystem.setValue(player.resources, RESOURCE_IDS.CP, newValue);
        player.resources = result.pool;
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
 * 处理牌库洗牌事件（弃牌堆洗回牌库）
 */
const handleDeckShuffled: EventHandler<Extract<DiceThroneEvent, { type: 'DECK_SHUFFLED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, deckCardIds } = event.payload;

    const player = newState.players[playerId];
    if (!player) return newState;

    const idSet = new Set(deckCardIds);
    const discardMap = new Map(player.discard.map(card => [card.id, card] as const));

    player.deck = deckCardIds
        .map((id) => discardMap.get(id))
        .filter((card): card is NonNullable<typeof card> => Boolean(card));

    // 将已洗入牌库的卡从弃牌堆移除
    player.discard = player.discard.filter(card => !idSet.has(card.id));

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
    const { attackerId, defenderId, sourceAbilityId, isDefendable, isUltimate } = event.payload;

    newState.pendingAttack = {
        attackerId,
        defenderId,
        isDefendable,
        sourceAbilityId,
        isUltimate,
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
    const { playerId, statusId, tokenId, value, customId, sourceAbilityId } = event.payload;

    const player = newState.players[playerId];
    if (player) {
        if (tokenId) {
            // 处理 Token 选择（允许 value 为负数表示消耗）
            const maxStacks = getTokenStackLimit(newState, playerId, tokenId);
            const currentAmount = player.tokens[tokenId] || 0;
            const nextAmount = Math.max(0, Math.min(currentAmount + value, maxStacks));
            player.tokens[tokenId] = nextAmount;
        } else if (statusId) {
            // 处理状态选择
            const def = newState.tokenDefinitions.find(e => e.id === statusId);
            const maxStacks = def?.stackLimit || 99;
            const currentStacks = player.statusEffects[statusId] || 0;
            player.statusEffects[statusId] = Math.min(currentStacks + value, maxStacks);
        }
    }

    // 通过注册表处理特殊选择效果
    if (customId) {
        const handler = getChoiceEffectHandler(customId);
        if (handler) {
            const result = handler({ state: newState, playerId, customId, sourceAbilityId });
            if (result) {
                Object.assign(newState, result);
            }
        }
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

/**
 * 处理响应窗口打开事件
 * 注意：实际状态由 ResponseWindowSystem 管理在 sys.responseWindow 中
 */
const handleResponseWindowOpened: EventHandler<Extract<DiceThroneEvent, { type: 'RESPONSE_WINDOW_OPENED' }>> = (
    state,
    _event
) => {
    // 不修改核心状态，响应窗口由系统层管理
    return state;
};

/**
 * 处理响应窗口关闭事件
 * 注意：实际状态由 ResponseWindowSystem 管理在 sys.responseWindow 中
 */
const handleResponseWindowClosed: EventHandler<Extract<DiceThroneEvent, { type: 'RESPONSE_WINDOW_CLOSED' }>> = (
    state,
    _event
) => {
    // 响应窗口关闭不需要处理 pendingCardSpotlight
    // 因为卡牌特写已经在 CARD_PLAYED 时立即显示了
    return state;
};

/**
 * 处理护盾授予事件
 */
const handleDamageShieldGranted: EventHandler<Extract<DiceThroneEvent, { type: 'DAMAGE_SHIELD_GRANTED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { targetId, value, sourceId } = event.payload;

    const target = newState.players[targetId];
    if (target) {
        // 初始化 damageShields 数组（兼容旧状态）
        if (!target.damageShields) {
            target.damageShields = [];
        }
        // 添加新护盾
        target.damageShields.push({ value, sourceId });
    }

    return newState;
};

/**
 * 处理伤害被护盾阻挡事件（纯 UI/日志用途，不修改状态）
 */
const handleDamagePrevented: EventHandler<Extract<DiceThroneEvent, { type: 'DAMAGE_PREVENTED' }>> = (
    state,
    _event
) => {
    // 实际护盾消耗已在 handleDamageDealt 中处理
    // 此事件仅用于 UI 反馈/日志
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
    const newState = cloneState(state);
    const { dieId, newValue, playerId } = event.payload;

    const die = newState.dice.find(d => d.id === dieId);
    if (die) {
        die.value = newValue;
        const face = getDieFace(newValue);
        die.symbol = face;
        die.symbols = [face];
    }

    // 检查是否是自己修改自己的骰子
    // rollerId 是当前骰子的所有者
    const rollerId = newState.turnPhase === 'defensiveRoll' && newState.pendingAttack
        ? newState.pendingAttack.defenderId
        : newState.activePlayerId;

    if (playerId === rollerId && newState.rollConfirmed) {
        // 自己改自己的骰子，需要重新确认骰面，让对手有响应机会
        newState.rollConfirmed = false;
    }

    return newState;
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
    const newState = cloneState(state);
    const { dieId, newValue, playerId } = event.payload;

    const die = newState.dice.find(d => d.id === dieId);
    if (die) {
        die.value = newValue;
        const face = getDieFace(newValue);
        die.symbol = face;
        die.symbols = [face];
    }

    // 检查是否是自己重掷自己的骰子
    const rollerId = newState.turnPhase === 'defensiveRoll' && newState.pendingAttack
        ? newState.pendingAttack.defenderId
        : newState.activePlayerId;

    if (playerId === rollerId && newState.rollConfirmed) {
        // 自己重掷自己的骰子，需要重新确认骰面
        newState.rollConfirmed = false;
    }

    return newState;
};

/**
 * 处理投掷次数变化事件
 */
const handleRollLimitChanged: EventHandler<Extract<DiceThroneEvent, { type: 'ROLL_LIMIT_CHANGED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { newLimit } = event.payload;

    newState.rollLimit = newLimit;

    return newState;
};

/**
 * 处理交互请求事件
 */
const handleInteractionRequested: EventHandler<Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const interaction = event.payload.interaction;
    newState.pendingInteraction = interaction;

    // 如果交互来自卡牌，将 lastPlayedCard 移到 pendingCardSpotlight（暂停特写，等待交互完成）
    if (interaction.sourceCardId && newState.lastPlayedCard?.cardId === interaction.sourceCardId) {
        newState.pendingCardSpotlight = newState.lastPlayedCard;
        newState.lastPlayedCard = undefined;
    }

    return newState;
};

/**
 * 处理交互完成事件
 */
const handleInteractionCompleted: EventHandler<Extract<DiceThroneEvent, { type: 'INTERACTION_COMPLETED' }>> = (
    state,
    _event
) => {
    const newState = cloneState(state);
    newState.pendingInteraction = undefined;

    // 如果有待展示的卡牌特写，现在触发（交互已完成，卡牌确认生效）
    if (newState.pendingCardSpotlight) {
        newState.lastPlayedCard = newState.pendingCardSpotlight;
        newState.pendingCardSpotlight = undefined;
    }

    return newState;
};

/**
 * 处理交互取消事件
 * - 清除 pendingInteraction
 * - 把卡牌从弃牌堆还回手牌
 * - 返还已扣除的 CP
 * - 清除待展示的卡牌特写（卡牌被取消，不应显示特写）
 */
const handleInteractionCancelled: EventHandler<Extract<DiceThroneEvent, { type: 'INTERACTION_CANCELLED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { sourceCardId, cpCost, playerId } = event.payload;

    // 清除交互状态
    newState.pendingInteraction = undefined;

    // 清除待展示的卡牌特写（卡牌被取消，不应显示特写）
    newState.pendingCardSpotlight = undefined;

    const player = newState.players[playerId];
    if (player && sourceCardId) {
        // 从弃牌堆找到卡牌并还回手牌
        const cardIndex = player.discard.findIndex(c => c.id === sourceCardId);
        if (cardIndex !== -1) {
            const [card] = player.discard.splice(cardIndex, 1);
            player.hand.push(card);
        }

        // 返还 CP
        if (cpCost > 0) {
            const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
            player.resources[RESOURCE_IDS.CP] = currentCp + cpCost;
        }
    }

    return newState;
};

/**
 * 处理技能替换事件（升级卡使用）
 * - 更新技能定义（保持原技能 ID）
 * - 更新技能等级（abilityLevels）
 * - 将升级卡从手牌移入弃牌堆（升级卡不走 CARD_PLAYED 事件）
 */
const handleAbilityReplaced: EventHandler<Extract<DiceThroneEvent, { type: 'ABILITY_REPLACED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, oldAbilityId, newAbilityDef, cardId, newLevel } = event.payload;

    const player = newState.players[playerId];
    if (player) {
        // 1) 替换技能定义
        const abilityIndex = player.abilities.findIndex(a => a.id === oldAbilityId);
        if (abilityIndex !== -1) {
            player.abilities[abilityIndex] = {
                ...newAbilityDef,
                id: oldAbilityId,
            };
        }

        // 2) 更新技能等级
        player.abilityLevels[oldAbilityId] = newLevel;

        // 3) 移除升级卡
        const upgradeCardIndex = player.hand.findIndex(c => c.id === cardId);
        if (upgradeCardIndex !== -1) {
            const [card] = player.hand.splice(upgradeCardIndex, 1);
            player.discard.push(card);
            // 确保对象存在（向后兼容旧状态）
            if (!player.upgradeCardByAbilityId) {
                player.upgradeCardByAbilityId = {};
            }
            player.upgradeCardByAbilityId[oldAbilityId] = { cardId: card.id, cpCost: card.cpCost };

            // 触发特写系统
            const resolvedPreviewRef = MONK_CARDS.find(cardDef => cardDef.id === card.id)?.previewRef
                ?? card.previewRef;
            newState.lastPlayedCard = {
                cardId: card.id,
                playerId,
                previewRef: resolvedPreviewRef,
                timestamp: event.timestamp,
            };
        }
    }

    // 升级后清除撤回状态
    newState.lastSoldCardId = undefined;

    return newState;

};

// ============================================================================
// Token 响应窗口事件处理
// ============================================================================

/**
 * 处理 Token 响应窗口打开事件
 */
const handleTokenResponseRequested: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_RESPONSE_REQUESTED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    newState.pendingDamage = event.payload.pendingDamage;
    return newState;
};

/**
 * 处理 Token 使用事件
 */
const handleTokenUsed: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_USED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, tokenId, amount, effectType, damageModifier, evasionRoll } = event.payload;

    const player = newState.players[playerId];
    if (player) {
        // 消耗 Token
        const currentAmount = player.tokens[tokenId] ?? 0;
        player.tokens[tokenId] = Math.max(0, currentAmount - amount);
    }

    // 更新 pendingDamage
    if (newState.pendingDamage) {
        if (effectType === 'damageBoost' && damageModifier) {
            // 太极加伤
            newState.pendingDamage = {
                ...newState.pendingDamage,
                currentDamage: newState.pendingDamage.currentDamage + damageModifier,
            };
        } else if (effectType === 'damageReduction' && damageModifier) {
            // 太极减伤
            newState.pendingDamage = {
                ...newState.pendingDamage,
                currentDamage: Math.max(0, newState.pendingDamage.currentDamage + damageModifier),
            };
        } else if (effectType === 'evasionAttempt') {
            // 闪避尝试（无论成功失败都记录结果）
            if (evasionRoll?.success) {
                // 闪避成功
                newState.pendingDamage = {
                    ...newState.pendingDamage,
                    currentDamage: 0,
                    isFullyEvaded: true,
                    lastEvasionRoll: evasionRoll,
                };
            } else if (evasionRoll) {
                // 闪避失败，记录结果但不修改伤害
                newState.pendingDamage = {
                    ...newState.pendingDamage,
                    lastEvasionRoll: evasionRoll,
                };
            }
        }
    }

    return newState;
};

/**
 * 处理 Token 响应窗口关闭事件
 */
const handleTokenResponseClosed: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_RESPONSE_CLOSED' }>> = (
    state,
    _event
) => {
    const newState = cloneState(state);
    // 清除 pendingDamage，实际伤害由后续的 DAMAGE_DEALT 事件处理
    newState.pendingDamage = undefined;
    return newState;
};

/**
 * 技能重选事件（骰面被修改后触发）
 * - 清除 pendingAttack（回到技能选择状态）
 * - 设置 rollConfirmed = false（允许继续重掷，如果还有次数）
 */
const handleAbilityReselectionRequired: EventHandler<Extract<DiceThroneEvent, { type: 'ABILITY_RESELECTION_REQUIRED' }>> = (
    state,
    _event
) => {
    const newState = cloneState(state);
    // 清除已选择的技能/攻击
    newState.pendingAttack = null;
    // 允许继续重掷（如果还有次数）
    newState.rollConfirmed = false;
    return newState;
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
    const newState = cloneState(state);
    newState.pendingBonusDiceSettlement = event.payload.settlement;
    return newState;
};

/**
 * 处理奖励骰重掷事件
 * 更新待结算的骰子状态，消耗 Token
 */
const handleBonusDieRerolled: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DIE_REROLLED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { dieIndex, newValue, newFace, costTokenId, costAmount, playerId } = event.payload;

    // 更新 pendingBonusDiceSettlement 中的骰子
    if (newState.pendingBonusDiceSettlement) {
        const dieToUpdate = newState.pendingBonusDiceSettlement.dice.find(d => d.index === dieIndex);
        if (dieToUpdate) {
            dieToUpdate.value = newValue;
            dieToUpdate.face = newFace;
        }
        newState.pendingBonusDiceSettlement.rerollCount++;
    }

    // 消耗 Token
    const player = newState.players[playerId];
    if (player && player.tokens) {
        const currentAmount = player.tokens[costTokenId] ?? 0;
        player.tokens[costTokenId] = Math.max(0, currentAmount - costAmount);
    }

    // 更新 lastBonusDieRoll 用于 UI 特写
    const rerollEffectKey = newState.pendingBonusDiceSettlement?.rerollEffectKey ?? 'bonusDie.effect.thunderStrike2Reroll';
    newState.lastBonusDieRoll = {
        value: newValue,
        face: newFace,
        playerId,
        targetPlayerId: newState.pendingBonusDiceSettlement?.targetId,
        timestamp: event.timestamp,
        effectKey: rerollEffectKey,
        effectParams: { value: newValue, index: dieIndex },
    };

    return newState;
};

/**
 * 处理角色选择事件
 */
const handleCharacterSelected: EventHandler<Extract<DiceThroneEvent, { type: 'CHARACTER_SELECTED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, characterId, initialDeckCardIds } = event.payload;

    // 更新 selectedCharacters 映射
    if (!newState.selectedCharacters) {
        newState.selectedCharacters = {};
    }
    newState.selectedCharacters[playerId] = characterId;

    // 同步更新 HeroState.characterId（如果玩家对象已存在）
    const player = newState.players[playerId];
    if (player) {
        player.characterId = characterId;
        
        // 存储初始牌库顺序（用于 HERO_INITIALIZED 消费）
        if (initialDeckCardIds && initialDeckCardIds.length > 0) {
            player.initialDeckCardIds = initialDeckCardIds;
        }
    }

    return newState;
};

/**
 * 处理英雄初始化事件
 */
const handleHeroInitialized: EventHandler<Extract<DiceThroneEvent, { type: 'HERO_INITIALIZED' }>> = (
    state,
    event
) => {
    const newState = cloneState(state);
    const { playerId, characterId } = event.payload;

    // 获取已存储的初始牌库顺序（来自 CHARACTER_SELECTED 事件）
    const existingPlayer = newState.players[playerId];
    const initialDeckCardIds = existingPlayer?.initialDeckCardIds;

    // 使用辅助函数执行完整初始化
    // 如果有 initialDeckCardIds，传入以确保使用事件数据驱动的顺序
    // 否则使用 dummyRandom（向后兼容旧流程）
    const dummyRandom: any = { shuffle: (arr: any[]) => arr };
    const heroState = initHeroState(playerId, characterId, dummyRandom, initialDeckCardIds);
    
    newState.players[playerId] = heroState;

    // 如果是首位玩家初始化，或者当前活跃玩家，顺便创建骰子（如果还未创建）
    if (newState.dice.length === 0 || playerId === state.activePlayerId) {
        newState.dice = createCharacterDice(characterId);
    }

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
        case 'INTERACTION_REQUESTED':
            return handleInteractionRequested(state, event);
        case 'INTERACTION_COMPLETED':
            return handleInteractionCompleted(state, event);
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
        case 'CHARACTER_SELECTED':
            return handleCharacterSelected(state, event);
        case 'HERO_INITIALIZED':
            return handleHeroInitialized(state, event);
        case 'HOST_STARTED':
            return handleHostStarted(state, event);
        case 'PLAYER_READY':
            return handlePlayerReady(state, event);
        default: {
            // 处理系统层事件：SYS_PHASE_CHANGED 同步到 core.turnPhase
            if ((event as { type: string }).type === FLOW_EVENTS.PHASE_CHANGED) {
                const phaseEvent = event as unknown as { payload: { to: string; activePlayerId: string } };
                const newState = cloneState(state);
                newState.turnPhase = phaseEvent.payload.to as TurnPhase;
                newState.activePlayerId = phaseEvent.payload.activePlayerId;

                // 进入掆骰阶段时重置骰子状态
                if (phaseEvent.payload.to === 'offensiveRoll') {
                    newState.rollCount = 0;
                    newState.rollLimit = 3;
                    newState.rollDiceCount = 5;
                    newState.rollConfirmed = false;
                    newState.pendingAttack = null;
                    resetDice(newState);
                } else if (phaseEvent.payload.to === 'defensiveRoll') {
                    newState.rollCount = 0;
                    newState.rollLimit = 1;
                    newState.rollDiceCount = 4;
                    newState.rollConfirmed = false;
                    resetDice(newState);
                }

                return newState;
            }

            // 其他未知事件类型（包括系统层事件）直接返回原状态
            // 注意：这里不使用 exhaustive check，因为系统层事件不在 DiceThroneEvent 类型中
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
        return { ...state, pendingAttack: { ...state.pendingAttack, isDefendable: false } };
    }
    return undefined;
});
