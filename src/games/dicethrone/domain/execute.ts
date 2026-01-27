/**
 * DiceThrone 命令执行
 * Command -> Event[] 转换
 */

import type { RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneCommand,
    DiceThroneEvent,
    DiceRolledEvent,
    DieLockToggledEvent,
    RollConfirmedEvent,
    AbilityActivatedEvent,
    AttackInitiatedEvent,
    CardDiscardedEvent,
    CardSoldEvent,
    SellUndoneEvent,
    CardReorderedEvent,
    CardPlayedEvent,
    CpChangedEvent,
    ResponseWindowOpenedEvent,
    DieModifiedEvent,
    DieRerolledEvent,
    StatusRemovedEvent,
    InteractionCompletedEvent,
    InteractionCancelledEvent,
    PendingDamage,
} from './types';
import {
    getAvailableAbilityIds,
    getRollerId,
    getNextPlayerId,
    getUpgradeTargetAbilityId,
    hasOpponentTargetEffect,
    getResponderQueue,
} from './rules';
import { findPlayerAbility } from './abilityLookup';
import { reduce } from './reducer';
import { resourceSystem } from '../../../systems/ResourceSystem';
import { RESOURCE_IDS } from './resources';
import { resolveEffectsToEvents, type EffectContext } from './effects';
import { buildDrawEvents } from './deckEvents';
import {
    processTokenUsage,
    processPurifyUsage,
    finalizeTokenResponse,
    hasDefensiveTokens,
    createTokenResponseRequestedEvent,
} from './tokenResponse';

// ============================================================================
// 辅助函数
// ============================================================================

const now = () => Date.now();

/**
 * 判断该进攻技能是否可被防御（是否进入防御投掷阶段）
 */
const isDefendableAttack = (state: DiceThroneCore, attackerId: string, abilityId: string): boolean => {
    const match = findPlayerAbility(state, attackerId, abilityId);
    if (!match) {
        console.log('[isDefendableAttack] Ability not found:', abilityId);
        return true;
    }

    const effects = match.variant?.effects ?? match.ability.effects ?? [];
    const hasDamage = effects.some(e => e.action?.type === 'damage' && (e.action.value ?? 0) > 0);
    const hasUnblockableTag = match.ability.tags?.includes('unblockable');
    const result = hasDamage && !hasUnblockableTag;
    
    console.log('[isDefendableAttack]', {
        abilityId,
        hasDamage,
        hasUnblockableTag,
        result
    });
    
    if (!hasDamage) return false;

    // 不可防御标签：跳过防御阶段
    if (hasUnblockableTag) return false;

    return true;
};

const applyEvents = (state: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore => {
    return events.reduce((current, event) => reduce(current, event), state);
};

// ============================================================================
// 命令执行器
// ============================================================================

/**
 * 执行命令，生成事件
 */
export function execute(
    matchState: { core: DiceThroneCore; sys?: { responseWindow?: { current?: { windowType: string } } } },
    command: DiceThroneCommand,
    random: RandomFn
): DiceThroneEvent[] {
    const state = matchState.core;
    const events: DiceThroneEvent[] = [];
    const timestamp = now();

    // 处理作弊命令：根据索引发牌
    if (command.type === 'SYS_CHEAT_DEAL_CARD_BY_INDEX') {
        const payload = (command as any).payload as { playerId: string; deckIndex: number };
        const player = state.players[payload.playerId];
        if (player && payload.deckIndex >= 0 && payload.deckIndex < player.deck.length) {
            const card = player.deck[payload.deckIndex];
            const event: CardDrawnEvent = {
                type: 'CARD_DRAWN',
                payload: { playerId: payload.playerId, cardId: card.id },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
        }
        return events;
    }

    // 其他系统命令只由系统层处理，领域层不生成事件
    if (command.type.startsWith('SYS_')) {
        return events;
    }

    switch (command.type) {
        case 'ROLL_DICE': {
            const rollerId = getRollerId(state);
            const results: number[] = [];
            
            state.dice.slice(0, state.rollDiceCount).forEach(die => {
                if (!die.isKept) {
                    results.push(random.d(6));
                }
            });
            
            const event: DiceRolledEvent = {
                type: 'DICE_ROLLED',
                payload: { results, rollerId },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'ROLL_BONUS_DIE': {
            // 已废弃：额外骰子现在在 resolveAttack 中自动投掷
            console.warn('[DiceThrone] ROLL_BONUS_DIE is deprecated - bonus dice are now rolled automatically during attack resolution');
            break;
        }

        case 'TOGGLE_DIE_LOCK': {
            const die = state.dice.find(d => d.id === command.payload.dieId);
            if (die) {
                const event: DieLockToggledEvent = {
                    type: 'DIE_LOCK_TOGGLED',
                    payload: { dieId: die.id, isKept: !die.isKept },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
            }
            break;
        }

        case 'CONFIRM_ROLL': {
            const rollerId = getRollerId(state);
            
            const event: RollConfirmedEvent = {
                type: 'ROLL_CONFIRMED',
                payload: { playerId: rollerId },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            
            // 确认骰面后，打开响应窗口
            // - 排除 rollerId（当前投掷方），因为他们可以主动出牌
            // - triggerId 是对手（优先响应）
            // 例如：防御阶段防御方确认骰面，攻击方可以响应（强制重投等）
            const playerIds = Object.keys(state.players);
            const opponentId = playerIds.find(pid => pid !== rollerId) || rollerId;
            const responderQueue = getResponderQueue(state, 'afterRollConfirmed', opponentId, undefined, rollerId);
            if (responderQueue.length > 0) {
                const windowId = `afterRollConfirmed-${timestamp}`;
                const responseWindowEvent: ResponseWindowOpenedEvent = {
                    type: 'RESPONSE_WINDOW_OPENED',
                    payload: {
                        windowId,
                        responderQueue,
                        windowType: 'afterRollConfirmed',
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(responseWindowEvent);
                return events; // 等待响应窗口关闭
            }
            
            // 防御阶段自动选择唯一技能（实时计算可用技能）
            const availableAbilityIds = getAvailableAbilityIds(state, rollerId);
            if (state.turnPhase === 'defensiveRoll' && 
                state.pendingAttack && 
                !state.pendingAttack.defenseAbilityId && 
                availableAbilityIds.length === 1) {
                const autoAbilityEvent: AbilityActivatedEvent = {
                    type: 'ABILITY_ACTIVATED',
                    payload: { 
                        abilityId: availableAbilityIds[0], 
                        playerId: state.pendingAttack.defenderId,
                        isDefense: true,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(autoAbilityEvent);
            }
            break;
        }

        case 'SELECT_ABILITY': {
            const { abilityId } = command.payload;
            
            if (state.turnPhase === 'defensiveRoll') {
                // 防御技能选择
                const event: AbilityActivatedEvent = {
                    type: 'ABILITY_ACTIVATED',
                    payload: { 
                        abilityId, 
                        playerId: state.pendingAttack!.defenderId,
                        isDefense: true,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
            } else {
                // 进攻技能选择 -> 发起放击
                // 1. 先触发技能激活事件（用于特写展示）
                const abilityActivatedEvent: AbilityActivatedEvent = {
                    type: 'ABILITY_ACTIVATED',
                    payload: { 
                        abilityId, 
                        playerId: state.activePlayerId,
                        isDefense: false,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(abilityActivatedEvent);
                
                // 2. 再发起放击事件
                const defenderId = getNextPlayerId(state);
                const isDefendable = isDefendableAttack(state, state.activePlayerId, abilityId);
                
                // 检查是否为终极技能
                const match = findPlayerAbility(state, state.activePlayerId, abilityId);
                const isUltimate = match?.ability?.tags?.includes('ultimate') ?? false;
                
                const attackEvent: AttackInitiatedEvent = {
                    type: 'ATTACK_INITIATED',
                    payload: { 
                        attackerId: state.activePlayerId,
                        defenderId,
                        sourceAbilityId: abilityId,
                        isDefendable,
                        isUltimate,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(attackEvent);
            }
            break;
        }

        case 'DRAW_CARD': {
            events.push(
                ...buildDrawEvents(state, state.activePlayerId, 1, random, command.type, timestamp)
            );
            break;
        }

        case 'DISCARD_CARD': {
            const event: CardDiscardedEvent = {
                type: 'CARD_DISCARDED',
                payload: { playerId: state.activePlayerId, cardId: command.payload.cardId },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'SELL_CARD': {
            const actingPlayerId = (command.playerId || state.activePlayerId);
            const event: CardSoldEvent = {
                type: 'CARD_SOLD',
                payload: { 
                    playerId: actingPlayerId, 
                    cardId: command.payload.cardId,
                    cpGained: 1,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'UNDO_SELL_CARD': {
            if (state.lastSoldCardId) {
                const actingPlayerId = (command.playerId || state.activePlayerId);
                const event: SellUndoneEvent = {
                    type: 'SELL_UNDONE',
                    payload: { playerId: actingPlayerId, cardId: state.lastSoldCardId },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
            }
            break;
        }

        case 'REORDER_CARD_TO_END': {
            const event: CardReorderedEvent = {
                type: 'CARD_REORDERED',
                payload: { playerId: state.activePlayerId, cardId: command.payload.cardId },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'PLAY_CARD': {
            const actingPlayerId = (command.playerId || state.activePlayerId);
            const player = state.players[actingPlayerId];
            const card = player?.hand.find(c => c.id === command.payload.cardId);
            
            // 详细日志：记录打出卡牌的详细信息
            console.log('[PLAY_CARD] 尝试打出卡牌:', JSON.stringify({
                playerId: actingPlayerId,
                cardId: command.payload.cardId,
                cardType: card?.type,
                cardTiming: card?.timing,
                cpCost: card?.cpCost,
                effectCount: card?.effects?.length ?? 0,
                effects: card?.effects?.map(e => ({
                    timing: e.timing,
                    actionType: e.action?.type,
                    customActionId: e.action?.customActionId,
                })),
                currentPhase: state.turnPhase,
                playerCP: player?.resources[RESOURCE_IDS.CP] ?? 0,
            }, null, 2));
            
            if (!card || !player) {
                console.warn('[PLAY_CARD] 打出失败 - 卡牌或玩家不存在');
                break;
            }
            
            // 升级卡：自动提取目标技能并执行升级逻辑
            if (card.type === 'upgrade') {
                const targetAbilityId = getUpgradeTargetAbilityId(card);
                if (!targetAbilityId || !card.effects || card.effects.length === 0) {
                    console.warn(`[DiceThrone] 升级卡 ${card.id} 缺少 targetAbilityId 或 effects`);
                    break;
                }
                
                // 计算实际 CP 消耗
                const currentLevel = player.abilityLevels[targetAbilityId] ?? 1;
                const previousUpgradeCost = player.upgradeCardByAbilityId?.[targetAbilityId]?.cpCost;
                let actualCost = card.cpCost;
                if (previousUpgradeCost !== undefined && currentLevel > 1) {
                    actualCost = Math.max(0, card.cpCost - previousUpgradeCost);
                }
                
                // CP 变化事件
                const cpResult = resourceSystem.modify(
                    player.resources,
                    RESOURCE_IDS.CP,
                    -actualCost
                );
                const cpEvent: CpChangedEvent = {
                    type: 'CP_CHANGED',
                    payload: { 
                        playerId: actingPlayerId, 
                        delta: cpResult.actualDelta,
                        newValue: cpResult.newValue,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(cpEvent);
                
                // 执行升级卡效果（replaceAbility）
                const opponentId = Object.keys(state.players).find(id => id !== actingPlayerId) || actingPlayerId;
                const effectCtx: EffectContext = {
                    attackerId: actingPlayerId,
                    defenderId: opponentId,
                    sourceAbilityId: card.id,
                    state,
                    damageDealt: 0,
                };
                const effectEvents = resolveEffectsToEvents(card.effects, 'immediate', effectCtx, { random });
                events.push(...effectEvents);
                
                console.log('[PLAY_CARD] 升级卡打出成功:', JSON.stringify({
                    playerId: actingPlayerId,
                    cardId: card.id,
                    targetAbilityId,
                    currentLevel,
                    actualCost,
                    effectCount: effectEvents.length,
                }));
                break;
            }
            
            // 普通卡牌
            const event: CardPlayedEvent = {
                type: 'CARD_PLAYED',
                payload: { 
                    playerId: actingPlayerId, 
                    cardId: card.id,
                    cpCost: card.cpCost,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            
            console.log('[PLAY_CARD] 卡牌打出成功:', JSON.stringify({
                playerId: actingPlayerId,
                cardId: card.id,
                cardType: card.type,
                cpCost: card.cpCost,
                effectCount: card.effects?.length ?? 0,
            }));
            
            // 通过效果系统执行卡牌效果（数据驱动）
            const opponentId = Object.keys(state.players).find(id => id !== actingPlayerId) || actingPlayerId;
            if (card.effects && card.effects.length > 0) {
                const effectCtx: EffectContext = {
                    attackerId: actingPlayerId,
                    defenderId: opponentId,
                    sourceAbilityId: card.id,
                    state,
                    damageDealt: 0,
                };
                const effectEvents = resolveEffectsToEvents(card.effects, 'immediate', effectCtx, { random });
                events.push(...effectEvents);
            }
            
            // 检测是否需要打开响应窗口
            // 条件：卡牌效果对对手生效 && 有玩家有可响应内容 && 当前不在响应窗口中
            // 规则：在响应窗口中打出的卡牌不再触发新的响应窗口（避免无限嵌套）
            const isInResponseWindow = !!matchState.sys?.responseWindow?.current;
            if (hasOpponentTargetEffect(card) && !isInResponseWindow) {
                // 先应用已产生的事件，然后检查响应队列（排除出牌玩家，因为可以主动出牌）
                const stateAfterCard = applyEvents(state, events);
                const responderQueue = getResponderQueue(stateAfterCard, 'afterCardPlayed', opponentId, card.id, actingPlayerId);
                if (responderQueue.length > 0) {
                    const windowId = `afterCard-${card.id}-${timestamp}`;
                    const responseWindowEvent: ResponseWindowOpenedEvent = {
                        type: 'RESPONSE_WINDOW_OPENED',
                        payload: {
                            windowId,
                            responderQueue,
                            windowType: 'afterCardPlayed',
                            sourceId: card.id,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    events.push(responseWindowEvent);
                }
            }
            break;
        }

        case 'PLAY_UPGRADE_CARD': {
            const player = state.players[state.activePlayerId];
            const card = player?.hand.find(c => c.id === command.payload.cardId);
            if (card && player) {
                const currentLevel = player.abilityLevels[command.payload.targetAbilityId] ?? 1;
                const previousUpgradeCost = player.upgradeCardByAbilityId?.[command.payload.targetAbilityId]?.cpCost;
                let actualCost = card.cpCost;
                if (previousUpgradeCost !== undefined && currentLevel > 1) {
                    actualCost = Math.max(0, card.cpCost - previousUpgradeCost);
                }
                
                // CP 变化事件（使用 ResourceSystem 保证边界）
                const cpResult = resourceSystem.modify(
                    player.resources,
                    RESOURCE_IDS.CP,
                    -actualCost
                );
                const cpEvent: CpChangedEvent = {
                    type: 'CP_CHANGED',
                    payload: { 
                        playerId: state.activePlayerId, 
                        delta: cpResult.actualDelta,
                        newValue: cpResult.newValue,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(cpEvent);
                
                // 通过效果系统执行升级卡效果（包含 replaceAbility）
                if (!card.effects || card.effects.length === 0) {
                    console.warn(`[DiceThrone] 升级卡 ${card.id} 缺少 effects 定义，无法执行升级`);
                    break;
                }

                const opponentId = Object.keys(state.players).find(id => id !== state.activePlayerId) || state.activePlayerId;
                const effectCtx: EffectContext = {
                    attackerId: state.activePlayerId,
                    defenderId: opponentId,
                    sourceAbilityId: card.id,
                    state,
                    damageDealt: 0,
                };
                const effectEvents = resolveEffectsToEvents(card.effects, 'immediate', effectCtx, { random });
                events.push(...effectEvents);
            }
            break;
        }

        case 'RESOLVE_CHOICE': {
            // 由 PromptSystem 处理，这里只生成领域事件
            // 实际的 prompt 清理在系统层
            break;
        }

        case 'RESPONSE_PASS': {
            // 由 ResponseWindowSystem 处理，领域层不生成事件
            break;
        }

        case 'ADVANCE_PHASE': {
            // 阶段推进完全由 FlowSystem 通过 FlowHooks 处理
            // - onPhaseExit: 处理阶段退出逻辑（攻击结算、回合切换等）
            // - onPhaseEnter: 处理阶段进入逻辑（收入、抽牌等）
            // 领域层不再生成 PHASE_CHANGED 事件
            break;
        }

        case 'MODIFY_DIE': {
            const { dieId, newValue } = command.payload;
            const die = state.dice.find(d => d.id === dieId);
            if (die) {
                const event: DieModifiedEvent = {
                    type: 'DIE_MODIFIED',
                    payload: { dieId, oldValue: die.value, newValue, playerId: command.playerId },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
                
                // 规则 3.3 步骤 3：如果骰面被修改且已选择技能，触发重选
                // 注意：终极技能不受影响（行动锁定）
                if (state.turnPhase === 'offensiveRoll' && 
                    state.pendingAttack && 
                    !state.pendingAttack.isUltimate) {
                    events.push({
                        type: 'ABILITY_RESELECTION_REQUIRED',
                        payload: {
                            playerId: state.activePlayerId,
                            previousAbilityId: state.pendingAttack.sourceAbilityId,
                            reason: 'dieModified',
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
            }
            break;
        }

        case 'REROLL_DIE': {
            const { dieId } = command.payload;
            const die = state.dice.find(d => d.id === dieId);
            const newValue = random.d(6);
            const event: DieRerolledEvent = {
                type: 'DIE_REROLLED',
                payload: { dieId, oldValue: die?.value ?? newValue, newValue, playerId: command.playerId },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            
            // 规则 3.3 步骤 3：如果骰面被重掷且已选择技能，触发重选
            // 注意：终极技能不受影响（行动锁定）
            if (state.turnPhase === 'offensiveRoll' && 
                state.pendingAttack && 
                !state.pendingAttack.isUltimate) {
                events.push({
                    type: 'ABILITY_RESELECTION_REQUIRED',
                    payload: {
                        playerId: state.activePlayerId,
                        previousAbilityId: state.pendingAttack.sourceAbilityId,
                        reason: 'dieRerolled',
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
            }
            break;
        }

        case 'REMOVE_STATUS': {
            const { targetPlayerId, statusId } = command.payload;
            const targetPlayer = state.players[targetPlayerId];
            if (targetPlayer) {
                if (statusId) {
                    // 移除单个状态
                    const currentStacks = targetPlayer.statusEffects[statusId] ?? 0;
                    if (currentStacks > 0) {
                        const event: StatusRemovedEvent = {
                            type: 'STATUS_REMOVED',
                            payload: { targetId: targetPlayerId, statusId, stacks: currentStacks },
                            sourceCommandType: command.type,
                            timestamp,
                        };
                        events.push(event);
                    }
                    // 也检查 tokens
                    const tokenAmount = targetPlayer.tokens[statusId] ?? 0;
                    if (tokenAmount > 0) {
                        events.push({
                            type: 'TOKEN_CONSUMED',
                            payload: { playerId: targetPlayerId, tokenId: statusId, amount: tokenAmount, newTotal: 0 },
                            sourceCommandType: command.type,
                            timestamp,
                        } as DiceThroneEvent);
                    }
                } else {
                    // 移除所有状态
                    Object.entries(targetPlayer.statusEffects).forEach(([sid, stacks]) => {
                        if (stacks > 0) {
                            events.push({
                                type: 'STATUS_REMOVED',
                                payload: { targetId: targetPlayerId, statusId: sid, stacks },
                                sourceCommandType: command.type,
                                timestamp,
                            } as StatusRemovedEvent);
                        }
                    });
                    Object.entries(targetPlayer.tokens).forEach(([tid, amount]) => {
                        if (amount > 0) {
                            events.push({
                                type: 'TOKEN_CONSUMED',
                                payload: { playerId: targetPlayerId, tokenId: tid, amount, newTotal: 0 },
                                sourceCommandType: command.type,
                                timestamp,
                            } as DiceThroneEvent);
                        }
                    });
                }
            }
            break;
        }

        case 'TRANSFER_STATUS': {
            const { fromPlayerId, toPlayerId, statusId } = command.payload;
            const fromPlayer = state.players[fromPlayerId];
            const toPlayer = state.players[toPlayerId];
            if (fromPlayer && toPlayer) {
                // 检查是 statusEffects 还是 tokens
                const fromStacks = fromPlayer.statusEffects[statusId] ?? 0;
                const fromTokens = fromPlayer.tokens[statusId] ?? 0;
                
                if (fromStacks > 0) {
                    // 移除源玩家的状态
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId: fromPlayerId, statusId, stacks: fromStacks },
                        sourceCommandType: command.type,
                        timestamp,
                    } as StatusRemovedEvent);
                    // 给目标玩家添加状态
                    const toStacks = toPlayer.statusEffects[statusId] ?? 0;
                    events.push({
                        type: 'STATUS_APPLIED',
                        payload: { targetId: toPlayerId, statusId, stacks: fromStacks, newTotal: toStacks + fromStacks },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                } else if (fromTokens > 0) {
                    // 移除源玩家的 token
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: { playerId: fromPlayerId, tokenId: statusId, amount: fromTokens, newTotal: 0 },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                    // 给目标玩家添加 token
                    const toTokens = toPlayer.tokens[statusId] ?? 0;
                    events.push({
                        type: 'TOKEN_GRANTED',
                        payload: { targetId: toPlayerId, tokenId: statusId, amount: fromTokens, newTotal: toTokens + fromTokens },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
            }
            break;
        }

        case 'CONFIRM_INTERACTION': {
            const interaction = state.pendingInteraction;
            if (!interaction) break;

            // 处理 selectDie 类型交互的批量重掷
            if (interaction.type === 'selectDie' && command.payload.selectedDiceIds) {
                for (const dieId of command.payload.selectedDiceIds) {
                    const die = state.dice.find(d => d.id === dieId);
                    const newValue = random.d(6);
                    const rerollEvent: DieRerolledEvent = {
                        type: 'DIE_REROLLED',
                        payload: {
                            dieId,
                            oldValue: die?.value ?? newValue,
                            newValue,
                            playerId: command.playerId,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    events.push(rerollEvent);
                }
            }

            const event: InteractionCompletedEvent = {
                type: 'INTERACTION_COMPLETED',
                payload: {
                    interactionId: command.payload.interactionId,
                    sourceCardId: interaction.sourceCardId,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'CANCEL_INTERACTION': {
            // 从 pendingInteraction 中获取卡牌信息
            const interaction = state.pendingInteraction;
            if (interaction) {
                // 查找卡牌的 CP 成本
                const player = state.players[interaction.playerId];
                const card = player?.discard.find(c => c.id === interaction.sourceCardId);
                const cpCost = card?.cpCost ?? 0;
                
                const event: InteractionCancelledEvent = {
                    type: 'INTERACTION_CANCELLED',
                    payload: {
                        interactionId: interaction.id,
                        sourceCardId: interaction.sourceCardId,
                        cpCost,
                        playerId: interaction.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
            }
            break;
        }

        case 'USE_TOKEN': {
            const { tokenId, amount } = command.payload;
            const pendingDamage = state.pendingDamage;
            
            if (!pendingDamage) {
                console.warn('[DiceThrone] USE_TOKEN: no pending damage');
                break;
            }
            
            const playerId = pendingDamage.responderId;
            
            // 获取 Token 定义（由 state.tokenDefinitions 驱动，避免与具体英雄耦合）
            const tokenDef = state.tokenDefinitions.find(t => t.id === tokenId);
            if (!tokenDef) {
                console.warn(`[DiceThrone] USE_TOKEN: unknown token ${tokenId}`);
                break;
            }
            
            // 使用通用处理器
            const { events: tokenEvents, result } = processTokenUsage(
                state,
                tokenDef,
                playerId,
                amount,
                random,
                pendingDamage.responseType
            );
            events.push(...tokenEvents);
            
            // 如果完全闪避，关闭响应窗口
            if (result.fullyEvaded) {
                const stateAfterToken = applyEvents(state, events);
                const updatedPendingDamage: PendingDamage = {
                    ...pendingDamage,
                    currentDamage: 0,
                    isFullyEvaded: true,
                };
                const closeEvents = finalizeTokenResponse(updatedPendingDamage, stateAfterToken);
                events.push(...closeEvents);
            }
            break;
        }

        case 'SKIP_TOKEN_RESPONSE': {
            const pendingDamage = state.pendingDamage;
            
            console.log('[SKIP_TOKEN_RESPONSE] Executing:', {
                hasPendingDamage: !!pendingDamage,
                responseType: pendingDamage?.responseType,
                currentPhase: state.turnPhase,
            });
            
            if (!pendingDamage) {
                console.warn('[DiceThrone] SKIP_TOKEN_RESPONSE: no pending damage');
                break;
            }
            
            // 检查是否需要切换到下一个响应者
            if (pendingDamage.responseType === 'beforeDamageDealt') {
                // 攻击方跳过加伤，检查防御方是否有可用 Token
                if (hasDefensiveTokens(state, pendingDamage.targetPlayerId)) {
                    console.log('[SKIP_TOKEN_RESPONSE] Switching to defender mitigation');
                    // 切换到防御方响应
                    const newPendingDamage: PendingDamage = {
                        ...pendingDamage,
                        responseType: 'beforeDamageReceived',
                        responderId: pendingDamage.targetPlayerId,
                    };
                    const tokenResponseEvent = createTokenResponseRequestedEvent(newPendingDamage);
                    events.push(tokenResponseEvent);
                    break;
                }
            }
            
            // 关闭响应窗口，应用最终伤害
            console.log('[SKIP_TOKEN_RESPONSE] Finalizing token response');
            const closeEvents = finalizeTokenResponse(pendingDamage, state);
            console.log('[SKIP_TOKEN_RESPONSE] Generated events:', closeEvents.map(e => e.type));
            events.push(...closeEvents);
            break;
        }

        case 'USE_PURIFY': {
            const { statusId } = command.payload;
            const playerId = command.playerId;
            
            if (!playerId) {
                console.warn('[DiceThrone] USE_PURIFY: no playerId');
                break;
            }
            
            const player = state.players[playerId];
            if (!player || (player.tokens['purify'] ?? 0) <= 0) {
                console.warn('[DiceThrone] USE_PURIFY: no purify token');
                break;
            }
            
            // 消耗净化 Token
            const { events: tokenEvents } = processPurifyUsage(state, playerId, statusId);
            events.push(...tokenEvents);
            
            // 移除负面状态
            const currentStacks = player.statusEffects[statusId] ?? 0;
            if (currentStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: playerId, statusId, stacks: 1 },
                    sourceCommandType: command.type,
                    timestamp,
                } as StatusRemovedEvent);
            }
            break;
        }

        case 'PAY_TO_REMOVE_STUN': {
            const playerId = command.playerId;
            
            if (!playerId) {
                console.warn('[DiceThrone] PAY_TO_REMOVE_STUN: no playerId');
                break;
            }
            
            const player = state.players[playerId];
            if (!player) {
                console.warn('[DiceThrone] PAY_TO_REMOVE_STUN: player not found');
                break;
            }
            
            // 扣除 2 CP
            const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
            const cpEvent: CpChangedEvent = {
                type: 'CP_CHANGED',
                payload: {
                    playerId,
                    delta: -2,
                    newValue: currentCp - 2,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(cpEvent);
            
            // 移除击倒状态
            const stunStacks = player.statusEffects['stun'] ?? 0;
            if (stunStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: playerId, statusId: 'stun', stacks: stunStacks },
                    sourceCommandType: command.type,
                    timestamp,
                } as StatusRemovedEvent);
            }
            break;
        }

        default: {
            const _exhaustive: never = command;
            console.warn(`Unknown command type: ${(_exhaustive as DiceThroneCommand).type}`);
        }
    }

    return events;
}
