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
    BonusDieRolledEvent,
    DieLockToggledEvent,
    RollConfirmedEvent,
    AbilityActivatedEvent,
    AttackInitiatedEvent,
    CardDrawnEvent,
    CardDiscardedEvent,
    CardSoldEvent,
    SellUndoneEvent,
    CardReorderedEvent,
    CardPlayedEvent,
    AbilityUpgradedEvent,
    CpChangedEvent,
    PhaseChangedEvent,
    TurnChangedEvent,
    ChoiceRequestedEvent,
} from './types';
import { CP_MAX } from './types';
import {
    getAvailableAbilityIds,
    getRollerId,
    getDieFace,
    getNextPlayerId,
    getNextPhase,
} from './rules';
import { MONK_ABILITIES } from '../monk/abilities';
import { resolveAttack, resolveOffensivePreDefenseEffects } from './attack';
import { reduce } from './reducer';

// ============================================================================
// 辅助函数
// ============================================================================

const now = () => Date.now();

/**
 * 检查技能是否有伤害效果
 */
const abilityHasDamage = (abilityId: string): boolean => {
    for (const ability of MONK_ABILITIES) {
        if (ability.variants) {
            const variant = ability.variants.find(v => v.id === abilityId);
            if (variant?.effects) {
                return variant.effects.some(e => e.action?.type === 'damage' && (e.action.value ?? 0) > 0);
            }
        }
        if (ability.id === abilityId && ability.effects) {
            return ability.effects.some(e => e.action?.type === 'damage' && (e.action.value ?? 0) > 0);
        }
    }
    return false;
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
    state: DiceThroneCore,
    command: DiceThroneCommand,
    random: RandomFn
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const timestamp = now();

    // 系统命令只由系统层处理，领域层不生成事件
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
            
            // 计算新的可用技能（需要模拟应用事件后的状态）
            // 简化处理：在 afterEvents 系统钩子中更新 availableAbilityIds
            break;
        }

        case 'ROLL_BONUS_DIE': {
            const value = random.d(6);
            const face = getDieFace(value);
            
            const event: BonusDieRolledEvent = {
                type: 'BONUS_DIE_ROLLED',
                payload: { value, face, playerId: state.activePlayerId },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            
            // lotus 面触发选择
            if (face === 'lotus' && state.pendingAttack?.sourceAbilityId) {
                const choiceEvent: ChoiceRequestedEvent = {
                    type: 'CHOICE_REQUESTED',
                    payload: {
                        playerId: state.activePlayerId,
                        sourceAbilityId: state.pendingAttack.sourceAbilityId,
                        titleKey: 'choices.evasiveOrPurify',
                        options: [
                            { statusId: 'evasive', value: 1 },
                            { statusId: 'purify', value: 1 },
                        ],
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(choiceEvent);
            }
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
            const availableAbilityIds = getAvailableAbilityIds(state, rollerId);
            
            const event: RollConfirmedEvent = {
                type: 'ROLL_CONFIRMED',
                payload: { playerId: rollerId, availableAbilityIds },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            
            // 防御阶段自动选择唯一技能
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
                // 进攻技能选择 -> 发起攻击
                const defenderId = getNextPlayerId(state);
                const isDefendable = abilityHasDamage(abilityId);
                
                const event: AttackInitiatedEvent = {
                    type: 'ATTACK_INITIATED',
                    payload: { 
                        attackerId: state.activePlayerId,
                        defenderId,
                        sourceAbilityId: abilityId,
                        isDefendable,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
            }
            break;
        }

        case 'DRAW_CARD': {
            const player = state.players[state.activePlayerId];
            if (player && player.deck.length > 0) {
                const cardId = player.deck[0].id;
                const event: CardDrawnEvent = {
                    type: 'CARD_DRAWN',
                    payload: { playerId: state.activePlayerId, cardId },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
            }
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
            const event: CardSoldEvent = {
                type: 'CARD_SOLD',
                payload: { 
                    playerId: state.activePlayerId, 
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
                const event: SellUndoneEvent = {
                    type: 'SELL_UNDONE',
                    payload: { playerId: state.activePlayerId, cardId: state.lastSoldCardId },
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
            const player = state.players[state.activePlayerId];
            const card = player?.hand.find(c => c.id === command.payload.cardId);
            if (card) {
                const event: CardPlayedEvent = {
                    type: 'CARD_PLAYED',
                    payload: { 
                        playerId: state.activePlayerId, 
                        cardId: card.id,
                        cpCost: card.cpCost,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
                
                // TODO: 卡牌效果事件
            }
            break;
        }

        case 'PLAY_UPGRADE_CARD': {
            const player = state.players[state.activePlayerId];
            const card = player?.hand.find(c => c.id === command.payload.cardId);
            if (card && player) {
                const currentLevel = player.abilityLevels[command.payload.targetAbilityId] ?? 1;
                let actualCost = card.cpCost;
                if (currentLevel === 2 && card.cpCost > 3) {
                    actualCost = card.cpCost - 3;
                }
                
                // CP 变化事件
                const cpEvent: CpChangedEvent = {
                    type: 'CP_CHANGED',
                    payload: { 
                        playerId: state.activePlayerId, 
                        delta: -actualCost,
                        newValue: player.cp - actualCost,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(cpEvent);
                
                // 技能升级事件
                const upgradeEvent: AbilityUpgradedEvent = {
                    type: 'ABILITY_UPGRADED',
                    payload: { 
                        playerId: state.activePlayerId,
                        abilityId: command.payload.targetAbilityId,
                        newLevel: currentLevel + 1,
                        cardId: card.id,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(upgradeEvent);
            }
            break;
        }

        case 'RESOLVE_CHOICE': {
            // 由 PromptSystem 处理，这里只生成领域事件
            // 实际的 prompt 清理在系统层
            break;
        }

        case 'ADVANCE_PHASE': {
            if (state.turnPhase === 'offensiveRoll') {
                if (state.pendingAttack) {
                    const preDefenseEvents = resolveOffensivePreDefenseEffects(state);
                    events.push(...preDefenseEvents);

                    const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                    if (hasChoice) {
                        return events;
                    }

                    const stateAfterPreDefense = preDefenseEvents.length > 0
                        ? applyEvents(state, preDefenseEvents)
                        : state;

                    if (state.pendingAttack.isDefendable) {
                        const phaseEvent: PhaseChangedEvent = {
                            type: 'PHASE_CHANGED',
                            payload: {
                                from: state.turnPhase,
                                to: 'defensiveRoll',
                                activePlayerId: state.activePlayerId,
                            },
                            sourceCommandType: command.type,
                            timestamp,
                        };
                        events.push(phaseEvent);
                        return events;
                    }

                    events.push(...resolveAttack(stateAfterPreDefense, { includePreDefense: false }));

                    const phaseEvent: PhaseChangedEvent = {
                        type: 'PHASE_CHANGED',
                        payload: {
                            from: state.turnPhase,
                            to: 'main2',
                            activePlayerId: state.activePlayerId,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    events.push(phaseEvent);
                    return events;
                }

                const phaseEvent: PhaseChangedEvent = {
                    type: 'PHASE_CHANGED',
                    payload: {
                        from: state.turnPhase,
                        to: 'main2',
                        activePlayerId: state.activePlayerId,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(phaseEvent);
                return events;
            }

            if (state.turnPhase === 'defensiveRoll' && state.pendingAttack) {
                events.push(...resolveAttack(state));
            }

            const nextPhase = getNextPhase(state);

            // 阶段切换事件
            const phaseEvent: PhaseChangedEvent = {
                type: 'PHASE_CHANGED',
                payload: { 
                    from: state.turnPhase,
                    to: nextPhase,
                    activePlayerId: state.activePlayerId,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(phaseEvent);

            // income 阶段的收入和抽牌
            if (nextPhase === 'income') {
                const player = state.players[state.activePlayerId];
                if (player) {
                    // CP +1
                    const cpEvent: CpChangedEvent = {
                        type: 'CP_CHANGED',
                        payload: { 
                            playerId: state.activePlayerId, 
                            delta: 1,
                            newValue: Math.min(CP_MAX, player.cp + 1),
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    events.push(cpEvent);
                    
                    // 抽牌
                    if (player.deck.length > 0) {
                        const drawEvent: CardDrawnEvent = {
                            type: 'CARD_DRAWN',
                            payload: { playerId: state.activePlayerId, cardId: player.deck[0].id },
                            sourceCommandType: command.type,
                            timestamp,
                        };
                        events.push(drawEvent);
                    }
                }
            }
            
            // discard 阶段结束后切换玩家
            if (state.turnPhase === 'discard') {
                const nextPlayerId = getNextPlayerId(state);
                const turnEvent: TurnChangedEvent = {
                    type: 'TURN_CHANGED',
                    payload: { 
                        previousPlayerId: state.activePlayerId,
                        nextPlayerId,
                        turnNumber: state.turnNumber + 1,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(turnEvent);
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
