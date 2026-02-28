/**
 * DiceThrone 卡牌命令执行
 * 从 execute.ts 提取
 */

import type { RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    TurnPhase,
    DiceThroneCommand,
    DiceThroneEvent,
    CardDiscardedEvent,
    CardSoldEvent,
    SellUndoneEvent,
    CardReorderedEvent,
    CardPlayedEvent,
    CpChangedEvent,
    ResponseWindowOpenedEvent,
} from './types';
import {
    getUpgradeTargetAbilityId,
    hasOpponentTargetEffect,
    getResponderQueue,
} from './rules';
import { reduce } from './reducer';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { resolveEffectsToEvents, type EffectContext } from './effects';
import { buildDrawEvents } from './deckEvents';
import { applyEvents } from './utils';

type MatchStateView = {
    core: DiceThroneCore;
    sys?: { phase?: string; responseWindow?: { current?: { windowType: string } } };
};

/**
 * 执行卡牌相关命令
 */
export function executeCardCommand(
    matchState: MatchStateView,
    command: DiceThroneCommand,
    random: RandomFn,
    phase: TurnPhase,
    timestamp: number
): DiceThroneEvent[] {
    const state = matchState.core;
    const events: DiceThroneEvent[] = [];

    switch (command.type) {
        case 'DRAW_CARD': {
            events.push(
                ...buildDrawEvents(state, state.activePlayerId, 1, random, command.type, timestamp)
            );
            break;
        }

        case 'DISCARD_CARD': {
            const event: CardDiscardedEvent = {
                type: 'CARD_DISCARDED',
                payload: { playerId: state.activePlayerId, cardId: (command.payload as { cardId: string }).cardId },
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
                    cardId: (command.payload as { cardId: string }).cardId,
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
                payload: { playerId: state.activePlayerId, cardId: (command.payload as { cardId: string }).cardId },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'PLAY_CARD': {
            const actingPlayerId = (command.playerId || state.activePlayerId);
            const player = state.players[actingPlayerId];
            const card = player?.hand.find(c => c.id === (command.payload as { cardId: string }).cardId);
            
            if (!card || !player) {
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
                
                // 生成 CARD_PLAYED 事件，将卡牌从手牌移到弃牌堆
                // cpCost 设为 0，因为 CP 已由上方的 CP_CHANGED 事件扣除
                const cardPlayedEvent: CardPlayedEvent = {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: actingPlayerId,
                        cardId: card.id,
                        cpCost: 0,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(cardPlayedEvent);
                
                // 执行升级卡效果（replaceAbility）
                const opponentId = Object.keys(state.players).find(id => id !== actingPlayerId) || actingPlayerId;
                const effectCtx: EffectContext = {
                    attackerId: actingPlayerId,
                    defenderId: opponentId,
                    sourceAbilityId: card.id,
                    state,
                    damageDealt: 0,
                    timestamp,
                };
                const effectEvents = resolveEffectsToEvents(card.effects, 'immediate', effectCtx, { random });
                events.push(...effectEvents);
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
            
            // 通过效果系统执行卡牌效果（数据驱动）
            const opponentId = Object.keys(state.players).find(id => id !== actingPlayerId) || actingPlayerId;
            if (card.effects && card.effects.length > 0) {
                const effectCtx: EffectContext = {
                    attackerId: actingPlayerId,
                    defenderId: opponentId,
                    sourceAbilityId: card.id,
                    state,
                    damageDealt: 0,
                    timestamp,
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
                const stateAfterCard = applyEvents(state, events, reduce);
                const responderQueue = getResponderQueue(stateAfterCard, 'afterCardPlayed', opponentId, card.id, actingPlayerId, phase);
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
            const payload = command.payload as { cardId: string; targetAbilityId: string };
            const card = player?.hand.find(c => c.id === payload.cardId);
            if (card && player) {
                const currentLevel = player.abilityLevels[payload.targetAbilityId] ?? 1;
                const previousUpgradeCost = player.upgradeCardByAbilityId?.[payload.targetAbilityId]?.cpCost;
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
                
                // 生成 CARD_PLAYED 事件，将卡牌从手牌移到弃牌堆
                // cpCost 设为 0，因为 CP 已由上方的 CP_CHANGED 事件扣除
                const upgradeCardPlayedEvent: CardPlayedEvent = {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: state.activePlayerId,
                        cardId: card.id,
                        cpCost: 0,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(upgradeCardPlayedEvent);
                
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
                    timestamp,
                };
                const effectEvents = resolveEffectsToEvents(card.effects, 'immediate', effectCtx, { random });
                events.push(...effectEvents);
            }
            break;
        }
    }

    return events;
}
