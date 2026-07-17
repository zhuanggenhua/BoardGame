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
    InteractionRequestedEvent,
} from './types';
import {
    getUpgradeTargetAbilityId,
    cardNeedsSelectedDefender,
    getContextualOpponentId,
    getOpponents,
    getSelectedCombatOpponentId,
    isTeamMode,
} from './rules';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { resolveEffectsToEvents, type EffectContext } from './effects';
import { buildDrawEvents } from './deckEvents';

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
            const upgradeTargetAbilityId = card ? getUpgradeTargetAbilityId(card) : null;
            
            if (!card || !player) {
                break;
            }
            
            // 升级卡：自动提取目标技能并执行升级逻辑
            if (card.type === 'upgrade' && upgradeTargetAbilityId) {
                const targetAbilityId = upgradeTargetAbilityId;
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
                        previewRef: card.previewRef,
                        cpCost: 0,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(cardPlayedEvent);
                
                // 执行升级卡效果（replaceAbility）
                const opponentId = getContextualOpponentId(state, actingPlayerId) ?? actingPlayerId;
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
                    previewRef: card.previewRef,
                    cpCost: card.cpCost,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            // 通过效果系统执行卡牌效果（数据驱动）
            const selectedOpponentId = getSelectedCombatOpponentId(state, actingPlayerId, phase);
            const opponentId = selectedOpponentId
                ?? getContextualOpponentId(state, actingPlayerId)
                ?? actingPlayerId;
            const needsSelectedOpponent = isTeamMode(state)
                && selectedOpponentId === undefined
                && getOpponents(state, actingPlayerId).length > 1
                && cardNeedsSelectedDefender(card);
            const hasPendingUnresolvedTarget =
                !!state.pendingAttack
                && state.pendingAttack.attackerId === actingPlayerId
                && state.pendingAttack.defenderId === undefined;
            const deferAttackModifierUntilTargetResolved =
                card.isAttackModifier
                && needsSelectedOpponent
                && hasPendingUnresolvedTarget
                && (phase === 'targetingRoll' || phase === 'offensiveRoll');
            const effectEvents: DiceThroneEvent[] = [];
            if (card.effects && card.effects.length > 0) {
                if (deferAttackModifierUntilTargetResolved) {
                    const queuedIds = state.pendingAttack?.deferredAttackModifierCardIds ?? [];
                    effectEvents.push({
                        type: 'PENDING_ATTACK_UPDATED',
                        payload: {
                            attackerId: actingPlayerId,
                            patch: {
                                deferredAttackModifierCardIds: [...queuedIds, card.id],
                            },
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                } else if (needsSelectedOpponent) {
                    const interactionEvent: InteractionRequestedEvent = {
                        type: 'INTERACTION_REQUESTED',
                        payload: {
                            interaction: {
                                id: `${card.id}-${timestamp}`,
                                playerId: actingPlayerId,
                                sourceCardId: card.id,
                                type: 'selectPlayer',
                                titleKey: 'interaction.selectPlayer',
                                selectCount: 1,
                                selected: [],
                                targetPlayerIds: getOpponents(state, actingPlayerId),
                                resolveCustomActionId: 'resolve-card-effects-on-selected-opponent',
                            },
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    effectEvents.push(interactionEvent);
                } else {
                    const effectCtx: EffectContext = {
                        attackerId: actingPlayerId,
                        defenderId: opponentId,
                        sourceAbilityId: card.id,
                        state,
                        damageDealt: 0,
                        timestamp,
                    };
                    effectEvents.push(...resolveEffectsToEvents(card.effects, 'immediate', effectCtx, { random }));
                }
            }
            if (
                matchState.sys?.responseWindow?.current
                && effectEvents.some((effectEvent) => effectEvent.type === 'INTERACTION_REQUESTED')
            ) {
                events.push(...effectEvents, event);
            } else {
                events.push(event, ...effectEvents);
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
                        previewRef: card.previewRef,
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

                const opponentId = getContextualOpponentId(state, state.activePlayerId) ?? state.activePlayerId;
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
