/**
 * Cardia 命令执行逻辑
 */

import type { RandomFn, PlayerId, MatchState } from '../../../engine/types';
import type { CardiaCore } from './core-types';
import type { CardiaCommand } from './commands';
import type { CardiaEvent } from './events';
import { CARDIA_COMMANDS } from './commands';
import { CARDIA_EVENTS } from './events';
import { ABILITY_IDS } from './ids';
import { getOpponentId } from './utils';
import { abilityExecutorRegistry, type CardiaAbilityContext } from './abilityExecutor';
import { abilityRegistry } from './abilityRegistry';

/**
 * 执行命令
 */
export function execute(
    state: MatchState<CardiaCore>,
    command: CardiaCommand,
    random: RandomFn
): CardiaEvent[] {
    const core = state.core;
    
    switch (command.type) {
        case CARDIA_COMMANDS.PLAY_CARD:
            return executePlayCard(core, command, random);
        
        case CARDIA_COMMANDS.ACTIVATE_ABILITY:
            return executeActivateAbility(core, command, random);
        
        case CARDIA_COMMANDS.SKIP_ABILITY:
            return executeSkipAbility(core, command, random);
        
        case CARDIA_COMMANDS.CHOOSE_CARD:
            return executeChooseCard(core, command);
        
        case CARDIA_COMMANDS.CHOOSE_FACTION:
            return executeChooseFaction(core, command);
        
        case CARDIA_COMMANDS.CHOOSE_MODIFIER:
            return executeChooseModifier(core, command);
        
        case CARDIA_COMMANDS.CONFIRM_CHOICE:
            return executeConfirmChoice(core, command);
        
        case CARDIA_COMMANDS.END_TURN:
            return executeEndTurn(core, command, random);
        
        case CARDIA_COMMANDS.ADD_MODIFIER:
            return executeAddModifier(core, command);
        
        case CARDIA_COMMANDS.REMOVE_MODIFIER:
            return executeRemoveModifier(core, command);
        
        default:
            return [];
    }
}

/**
 * 执行打出卡牌命令
 */
function executePlayCard(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.PLAY_CARD }>,
    _random: RandomFn
): CardiaEvent[] {
    const { playerId } = command;
    const { cardUid, slotIndex } = command.payload;
    
    const player = core.players[playerId];
    if (!player) {
        console.error('[Cardia] executePlayCard: player not found', { playerId });
        return [];
    }
    
    const card = player.hand.find(c => c.uid === cardUid);
    if (!card) return [];
    
    const events: CardiaEvent[] = [];
    const timestamp = Date.now();
    
    // 1. 发射卡牌打出事件
    events.push({
        type: CARDIA_EVENTS.CARD_PLAYED,
        timestamp,
        payload: {
            cardUid: card.uid,  // 修复: 使用 cardUid 而非 cardId
            playerId,
            slotIndex,
        },
    });
    
    // 2. 检查是否双方都已打出卡牌
    const opponentId = getOpponentId(core, playerId);
    const opponent = core.players[opponentId];
    
    if (opponent.hasPlayed && opponent.currentCard) {
        // 双方都已打出卡牌，解析遭遇战
        const encounterEvents = resolveEncounter(
            core,
            playerId,
            card,
            opponentId,
            opponent.currentCard,
            slotIndex,
            _random
        );
        events.push(...encounterEvents);
    }
    
    return events;
}

/**
 * 解析遭遇战
 */
function resolveEncounter(
    core: CardiaCore,
    player1Id: PlayerId,
    player1Card: any,
    player2Id: PlayerId,
    player2Card: any,
    slotIndex: number,
    random: RandomFn
): CardiaEvent[] {
    const events: CardiaEvent[] = [];
    const timestamp = Date.now();
    
    // 1. 计算最终影响力（基础影响力 + 修正标记）
    const player1Modifiers = core.modifierTokens.filter(t => t.cardId === player1Card.uid);
    const player2Modifiers = core.modifierTokens.filter(t => t.cardId === player2Card.uid);
    
    const player1Influence = player1Modifiers.reduce((acc, m) => acc + m.value, player1Card.baseInfluence);
    const player2Influence = player2Modifiers.reduce((acc, m) => acc + m.value, player2Card.baseInfluence);
    
    // 2. 判定胜负（基础判定）
    let winner: PlayerId | 'tie';
    let loser: PlayerId | null;
    
    if (player1Influence > player2Influence) {
        winner = player1Id;
        loser = player2Id;
    } else if (player2Influence > player1Influence) {
        winner = player2Id;
        loser = player1Id;
    } else {
        winner = 'tie';
        loser = null;
    }
    
    // 3. 应用持续能力效果（按优先级）
    // 保存原始的 winner 值，用于判断是否触发能力
    // 审判官规则："平局不会触发能力"，即使审判官赢得平局，也不进入能力阶段
    const originalWinner = winner;
    
    // 3.1 检查调停者（forceTie）- 强制平局（只影响特定遭遇）
    const currentEncounterIndex = core.turnNumber;
    const mediatorAbility = core.ongoingAbilities.find(
        a => a.effectType === 'forceTie' && a.encounterIndex === currentEncounterIndex
    );
    if (mediatorAbility) {
        winner = 'tie';
        loser = null;
    }
    
    // 3.2 检查审判官（winTies）- 赢得平局（影响所有遭遇）
    const magistrateAbility = core.ongoingAbilities.find(
        a => a.effectType === 'winTies'
    );
    if (magistrateAbility && winner === 'tie') {
        winner = magistrateAbility.playerId;
        loser = getOpponentId(core, magistrateAbility.playerId);
    }
    
    // 4. 发射遭遇战解析事件
    events.push({
        type: CARDIA_EVENTS.ENCOUNTER_RESOLVED,
        timestamp,
        payload: {
            slotIndex,
            winner,
            loser,
        },
    });
    
    // 5. 如果有胜者，授予印戒
    if (winner !== 'tie') {
        const winnerCard = winner === player1Id ? player1Card : player2Card;
        
        // 5.1 基础印戒
        events.push({
            type: CARDIA_EVENTS.EXTRA_SIGNET_PLACED,
            timestamp: Date.now(),
            payload: {
                cardId: winnerCard.uid,
                playerId: winner,
            },
        });
        
        // 5.2 检查财务官/顾问（extraSignet）- 额外印戒
        // 财务官：不区分玩家，任何玩家获胜都触发（永久持续）
        // 顾问：只对放置标记的玩家生效（一次性）
        const extraSignetAbilities = core.ongoingAbilities.filter(
            a => a.effectType === 'extraSignet'
        );
        
        for (const ability of extraSignetAbilities) {
            // 检查是否应该触发
            const shouldTrigger = ability.abilityId === ABILITY_IDS.TREASURER 
                ? true  // 财务官：任何玩家获胜都触发
                : ability.playerId === winner;  // 顾问：只对自己生效
            
            if (shouldTrigger) {
                // 额外印戒
                events.push({
                    type: CARDIA_EVENTS.EXTRA_SIGNET_PLACED,
                    timestamp: Date.now(),
                    payload: {
                        cardId: winnerCard.uid,
                        playerId: winner,
                    },
                });
                
                // 顾问是一次性效果，触发后移除；财务官是永久效果，不移除
                if (ability.abilityId === ABILITY_IDS.ADVISOR) {
                    events.push({
                        type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED,
                        timestamp: Date.now(),
                        payload: {
                            abilityId: ability.abilityId,
                            cardId: ability.cardId,
                            playerId: ability.playerId,
                        },
                    });
                }
            }
        }
        
        // 5.3 检查机械精灵（conditionalVictory）- 条件胜利（一次性）
        const mechanicalSpiritAbility = core.ongoingAbilities.find(
            a => a.effectType === 'conditionalVictory' && a.playerId === winner
        );
        
        if (mechanicalSpiritAbility) {
            // 触发游戏胜利
            events.push({
                type: CARDIA_EVENTS.GAME_WON,
                timestamp: Date.now(),
                payload: {
                    winnerId: winner,
                    reason: 'mechanicalSpirit',
                },
            });
            
            // 移除一次性持续标记
            events.push({
                type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED,
                timestamp: Date.now(),
                payload: {
                    abilityId: mechanicalSpiritAbility.abilityId,
                    cardId: mechanicalSpiritAbility.cardId,
                    playerId: mechanicalSpiritAbility.playerId,
                },
            });
        }
    }
    
    // 6. 推进到 ability 阶段（如果有失败者）或直接结束回合（如果平局）
    // 注意：审判官规则 - "平局不会触发能力"
    // 即使审判官通过 winTies 赢得平局，也不进入能力阶段（因为原本是平局）
    if (originalWinner === 'tie') {
        // 原本是平局时，跳过能力阶段，直接执行回合结束逻辑
        const endTurnEvents = executeAutoEndTurn(core, player1Id, random);
        events.push(...endTurnEvents);
    } else {
        // 原本有胜负时，推进到 ability 阶段
        events.push({
            type: CARDIA_EVENTS.PHASE_CHANGED,
            timestamp: Date.now(),
            payload: {
                from: core.phase,
                newPhase: 'ability',
                playerId: player1Id,  // 使用第一个玩家的 ID
            },
        });
    }
    
    return events;
}

/**
 * 执行激活能力命令
 * 
 * 注意：如果能力执行器返回交互（interaction），该交互会被包装为事件
 * 并由 InteractionSystem 的 afterEvents 钩子处理（自动调用 queueInteraction）
 */
function executeActivateAbility(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.ACTIVATE_ABILITY }>,
    random: RandomFn
): CardiaEvent[] {
    const { playerId } = command;
    const { abilityId, sourceCardUid } = command.payload;
    
    const events: CardiaEvent[] = [];
    const timestamp = Date.now();
    
    // 1. 发射能力激活事件
    const player = core.players[playerId];
    
    // 查找卡牌（可能在 playedCards 或 currentCard 中）
    let card = player.playedCards.find(c => c.uid === sourceCardUid);
    if (!card && player.currentCard?.uid === sourceCardUid) {
        card = player.currentCard;
    }
    
    if (!card) {
        console.error('[Cardia] executeActivateAbility: card not found', { playerId, sourceCardUid });
        return [];
    }
    
    // 判断能力类型（从 abilityRegistry 获取）
    const abilityDef = abilityRegistry.get(abilityId);
    if (!abilityDef) {
        console.error('[Cardia] executeActivateAbility: ability not found in registry', { abilityId });
        return [];
    }
    
    const isInstant = abilityDef.isInstant ?? true;
    const isOngoing = abilityDef.isOngoing ?? false;
    
    events.push({
        type: CARDIA_EVENTS.ABILITY_ACTIVATED,
        timestamp,
        payload: {
            abilityId,
            cardId: sourceCardUid,
            playerId,
            isInstant,
            isOngoing,
        },
    });
    
    // 2. 查找并执行能力
    const executor = abilityExecutorRegistry.resolve(abilityId);
    
    if (executor) {
        const opponentId = getOpponentId(core, playerId);
        
        const ctx: CardiaAbilityContext = {
            core,
            abilityId,
            cardId: sourceCardUid,
            playerId,
            opponentId,
            timestamp,
            random,  // 传入随机数生成器
            sourceId: sourceCardUid,
            ownerId: playerId,
        };
        
        const result = executor(ctx);
        
        // 2.1 处理返回的事件
        if (result.events && result.events.length > 0) {
            events.push(...result.events);
        }
        
        // 2.2 处理返回的交互
        // 如果能力执行器返回交互,发射 ABILITY_INTERACTION_REQUESTED 事件
        // 该事件会被 Cardia 的自定义系统捕获并调用 queueInteraction
        if (result.interaction) {
            events.push({
                type: CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED,
                timestamp,
                payload: {
                    abilityId,
                    cardId: sourceCardUid,
                    playerId,
                    interaction: result.interaction,
                },
            });
        }
    } else {
        console.warn('[Cardia] No executor found for ability', { abilityId });
    }
    
    // 3. 自动执行回合结束逻辑（方案A：无需手动点击）
    // 注意：如果有交互，回合结束会被 InteractionSystem 阻塞
    const endTurnEvents = executeAutoEndTurn(core, playerId, random);
    events.push(...endTurnEvents);
    
    return events;
}

/**
 * 执行跳过能力命令
 */
function executeSkipAbility(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.SKIP_ABILITY }>,
    random: RandomFn
): CardiaEvent[] {
    const events: CardiaEvent[] = [];
    
    // 自动执行回合结束逻辑（方案A：无需手动点击）
    const endTurnEvents = executeAutoEndTurn(core, command.playerId, random);
    events.push(...endTurnEvents);
    
    return events;
}

/**
 * 执行选择卡牌命令（交互）
 */
function executeChooseCard(
    _core: CardiaCore,
    _command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.CHOOSE_CARD }>
): CardiaEvent[] {
    // 这个命令由 InteractionSystem 处理
    // 交互解析后会触发 SYS_INTERACTION_RESOLVED 事件
    // 由 interactionHandlers 处理后续逻辑
    return [];
}

/**
 * 执行选择派系命令（交互）
 */
function executeChooseFaction(
    _core: CardiaCore,
    _command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.CHOOSE_FACTION }>
): CardiaEvent[] {
    // 这个命令由 InteractionSystem 处理
    return [];
}

/**
 * 执行选择修正标记命令（交互）
 */
function executeChooseModifier(
    _core: CardiaCore,
    _command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.CHOOSE_MODIFIER }>
): CardiaEvent[] {
    // 这个命令由 InteractionSystem 处理
    return [];
}

/**
 * 执行确认选择命令（交互）
 */
function executeConfirmChoice(
    _core: CardiaCore,
    _command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.CONFIRM_CHOICE }>
): CardiaEvent[] {
    // 这个命令由 InteractionSystem 处理
    return [];
}

/**
 * 自动执行回合结束逻辑（方案A：阶段2结束后自动执行）
 * 
 * 包含：
 * 1. 双方抽牌
 * 2. 发射回合结束事件
 * 3. 推进到下一回合的 play 阶段
 */
function executeAutoEndTurn(
    core: CardiaCore,
    playerId: PlayerId,
    _random: RandomFn
): CardiaEvent[] {
    const events: CardiaEvent[] = [];
    const timestamp = Date.now();
    
    // 1. 抽牌（两个玩家各抽 1 张）
    for (const pid of Object.keys(core.players)) {
        const player = core.players[pid];
        if (player && player.deck.length > 0) {
            events.push({
                type: CARDIA_EVENTS.CARD_DRAWN,
                timestamp,
                payload: {
                    playerId: pid,
                    count: 1,
                },
            });
        }
    }
    
    // 2. 发射回合结束事件
    events.push({
        type: CARDIA_EVENTS.TURN_ENDED,
        timestamp,
        payload: {
            playerId,
            turnNumber: core.turnNumber,
        },
    });
    
    // 3. 推进到下一回合的 play 阶段
    events.push({
        type: CARDIA_EVENTS.PHASE_CHANGED,
        timestamp,
        payload: {
            from: core.phase,
            newPhase: 'play',
            playerId,
        },
    });
    
    return events;
}

/**
 * 执行回合结束命令（已废弃，保留以防向后兼容）
 * @deprecated 使用 executeAutoEndTurn 代替
 */
function executeEndTurn(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.END_TURN }>,
    random: RandomFn
): CardiaEvent[] {
    // 直接调用自动回合结束逻辑
    return executeAutoEndTurn(core, command.playerId, random);
}

/**
 * 重新计算遭遇状态
 * 当修正标记添加后，重新计算影响力、遭遇结果和印戒位置
 */
/**
 * 重新计算遭遇状态
 * 当修正标记添加后，重新计算影响力、遭遇结果和印戒位置
 *
 * @param core 当前核心状态
 * @param affectedCardUid 受影响的卡牌 UID
 * @param newModifierValue 新添加的修正标记值（用于临时计算）
 */
export function recalculateEncounterState(
    core: CardiaCore,
    affectedCardUid: string,
    newModifierValue: number
): CardiaEvent[] {
    const events: CardiaEvent[] = [];
    const timestamp = Date.now();

    // 1. 找到受影响的遭遇（包含被修正卡牌的遭遇）
    const encounterIndex = core.encounterHistory.findIndex(encounter =>
        encounter.player1Card?.uid === affectedCardUid ||
        encounter.player2Card?.uid === affectedCardUid
    );

    if (encounterIndex === -1) {
        // 卡牌不在任何遭遇中，无需回溯
        console.log('[recalculateEncounterState] Card not in any encounter, skipping recalculation:', {
            affectedCardUid,
            encounterHistoryLength: core.encounterHistory.length,
        });
        return events;
    }

    const encounter = core.encounterHistory[encounterIndex];
    
    // 安全检查：确保遭遇中的卡牌存在
    if (!encounter.player1Card || !encounter.player2Card) {
        console.warn('[recalculateEncounterState] Encounter has missing cards, skipping recalculation:', {
            encounterIndex,
            hasPlayer1Card: !!encounter.player1Card,
            hasPlayer2Card: !!encounter.player2Card,
        });
        return events;
    }

    // 2. 重新计算双方卡牌的最终影响力
    // 注意：此时 MODIFIER_TOKEN_PLACED 事件还未被 reduce，所以需要手动加上新修正标记
    const player1Card = encounter.player1Card;
    const player2Card = encounter.player2Card;

    // 从 core.modifierTokens 计算影响力（而不是从卡牌的 modifiers.entries）
    const player1Modifiers = core.modifierTokens.filter(t => t.cardId === player1Card.uid);
    const player2Modifiers = core.modifierTokens.filter(t => t.cardId === player2Card.uid);
    
    const player1ModifierSum = player1Modifiers.reduce((acc, m) => acc + m.value, 0);
    const player2ModifierSum = player2Modifiers.reduce((acc, m) => acc + m.value, 0);

    // 如果受影响的是 player1 的卡牌，加上新修正标记
    const newPlayer1Influence = player1Card.uid === affectedCardUid
        ? player1Card.baseInfluence + player1ModifierSum + newModifierValue
        : player1Card.baseInfluence + player1ModifierSum;

    // 如果受影响的是 player2 的卡牌，加上新修正标记
    const newPlayer2Influence = player2Card.uid === affectedCardUid
        ? player2Card.baseInfluence + player2ModifierSum + newModifierValue
        : player2Card.baseInfluence + player2ModifierSum;

    // 3. 发射影响力变化事件
    if (newPlayer1Influence !== encounter.player1Influence) {
        events.push({
            type: CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED,
            timestamp,
            payload: {
                cardId: player1Card.uid,
                oldInfluence: encounter.player1Influence,
                newInfluence: newPlayer1Influence,
            },
        });
    }

    if (newPlayer2Influence !== encounter.player2Influence) {
        events.push({
            type: CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED,
            timestamp,
            payload: {
                cardId: player2Card.uid,
                oldInfluence: encounter.player2Influence,
                newInfluence: newPlayer2Influence,
            },
        });
    }

    // 4. 重新判定遭遇结果（考虑持续能力）
    let newWinner: PlayerId | 'tie';

    if (newPlayer1Influence > newPlayer2Influence) {
        newWinner = player1Card.ownerId;
    } else if (newPlayer2Influence > newPlayer1Influence) {
        newWinner = player2Card.ownerId;
    } else {
        newWinner = 'tie';
    }

    // 应用持续能力效果
    const mediatorAbility = core.ongoingAbilities.find(
        a => a.effectType === 'forceTie' && a.encounterIndex === encounterIndex
    );
    if (mediatorAbility) {
        newWinner = 'tie';
    }

    const magistrateAbility = core.ongoingAbilities.find(
        a => a.effectType === 'winTies'
    );
    if (magistrateAbility && newWinner === 'tie') {
        newWinner = magistrateAbility.playerId;
    }

    // 5. 如果遭遇结果改变，发射事件并移动印戒
    const oldWinner = encounter.winnerId;
    const previousWinner: PlayerId | 'tie' = oldWinner || 'tie';

    if (previousWinner !== newWinner) {
        // 发射遭遇结果改变事件
        events.push({
            type: CARDIA_EVENTS.ENCOUNTER_RESULT_CHANGED,
            timestamp,
            payload: {
                slotIndex: encounterIndex,
                previousWinner,
                newWinner,
                reason: 'modifier_added',
            },
        });

        // 移动印戒
        if (oldWinner && oldWinner !== 'tie') {
            const oldWinnerCard = oldWinner === player1Card.ownerId
                ? player1Card
                : player2Card;

            if (newWinner !== 'tie') {
                const newWinnerCard = newWinner === player1Card.ownerId
                    ? player1Card
                    : player2Card;

                // 从旧获胜卡牌移动印戒到新获胜卡牌
                events.push({
                    type: CARDIA_EVENTS.SIGNET_MOVED,
                    timestamp,
                    payload: {
                        fromCardId: oldWinnerCard.uid,
                        toCardId: newWinnerCard.uid,
                        slotIndex: encounterIndex,
                    },
                });
            }
            // 如果新结果是平局，印戒保留在原位置（不产生事件）
        } else if (newWinner !== 'tie') {
            // 旧结果是平局，新结果有获胜者，添加印戒
            const newWinnerCard = newWinner === player1Card.ownerId
                ? player1Card
                : player2Card;

            events.push({
                type: CARDIA_EVENTS.EXTRA_SIGNET_PLACED,
                timestamp,
                payload: {
                    cardId: newWinnerCard.uid,
                    playerId: newWinner,
                },
            });
        }
    }

    return events;
}

/**
 * 执行添加修正标记命令
 */
function executeAddModifier(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.ADD_MODIFIER }>
): CardiaEvent[] {
    const events: CardiaEvent[] = [];
    const timestamp = Date.now();
    const { playerId } = command;
    const { cardUid, modifierValue } = command.payload;
    
    // 1. 发射修正标记添加事件
    events.push({
        type: CARDIA_EVENTS.MODIFIER_ADDED,
        timestamp,
        payload: {
            cardUid,
            value: modifierValue,
            playerId,
        },
    });
    
    // 2. 触发状态回溯（传入新修正标记值用于临时计算）
    const recalculationEvents = recalculateEncounterState(core, cardUid, modifierValue);
    events.push(...recalculationEvents);
    
    return events;
}

/**
 * 执行移除修正标记命令
 */
function executeRemoveModifier(
    _core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.REMOVE_MODIFIER }>
): CardiaEvent[] {
    const events: CardiaEvent[] = [];
    const timestamp = Date.now();
    const { playerId } = command;
    const { cardUid, modifierId } = command.payload;
    
    // 发射修正标记移除事件
    events.push({
        type: CARDIA_EVENTS.MODIFIER_REMOVED,
        timestamp,
        payload: {
            cardUid,
            modifierId,
            playerId,
        },
    });
    
    return events;
}

export default execute;
