/**
 * Cardia 事件归约逻辑
 * 将事件应用到核心状态，使用结构共享
 */

import type { CardiaCore, CardInstance, EncounterState, ModifierToken, OngoingAbility, DelayedEffect, PlayedCard } from './core-types';
import type { CardiaEvent } from './events';
import { CARDIA_EVENTS } from './events';
import { ABILITY_IDS } from './ids';
import { updatePlayer, getOpponentId } from './utils';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';

/**
 * 归约事件到核心状态
 */
export function reduce(core: CardiaCore, event: CardiaEvent): CardiaCore {
    switch (event.type) {
        case CARDIA_EVENTS.CARD_PLAYED:
            return reduceCardPlayed(core, event);
        
        case CARDIA_EVENTS.CARD_DRAWN:
            return reduceCardDrawn(core, event);
        
        case CARDIA_EVENTS.ENCOUNTER_RESOLVED:
            return reduceEncounterResolved(core, event);
        
        case CARDIA_EVENTS.ABILITY_ACTIVATED:
            return reduceAbilityActivated(core, event);
        
        case CARDIA_EVENTS.ABILITY_SKIPPED:
            // 能力跳过事件不改变状态，仅用于触发 FlowSystem 自动推进
            return core;
        
        case CARDIA_EVENTS.ABILITY_COPIED:
            // 能力复制事件不改变状态，实际执行在 execute 层处理
            return core;
        
        case CARDIA_EVENTS.ONGOING_ABILITY_PLACED:
            return reduceOngoingAbilityPlaced(core, event);
        
        case CARDIA_EVENTS.ONGOING_ABILITY_REMOVED:
            return reduceOngoingAbilityRemoved(core, event);
        
        case CARDIA_EVENTS.MODIFIER_TOKEN_PLACED:
            return reduceModifierTokenPlaced(core, event);
        
        case CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED:
            return reduceModifierTokenRemoved(core, event);
        
        case CARDIA_EVENTS.MODIFIER_ADDED:
            return reduceModifierAdded(core, event);
        
        case CARDIA_EVENTS.MODIFIER_REMOVED:
            return reduceModifierRemoved(core, event);
        
        case CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED:
            return reduceCardInfluenceModified(core, event);
        
        case CARDIA_EVENTS.ENCOUNTER_RESULT_CHANGED:
            return reduceEncounterResultChanged(core, event);
        
        case CARDIA_EVENTS.SIGNET_MOVED:
            return reduceSignetMoved(core, event);
        
        case CARDIA_EVENTS.SIGNET_REMOVED:
            return reduceSignetRemoved(core, event);
        
        case CARDIA_EVENTS.EXTRA_SIGNET_PLACED:
            return reduceExtraSignetPlaced(core, event);
        
        case CARDIA_EVENTS.SIGNET_GRANTED:
            return reduceSignetGranted(core, event);
        
        case CARDIA_EVENTS.CARD_REPLACED:
            return reduceCardReplaced(core, event);
        
        case CARDIA_EVENTS.CARDS_DISCARDED:
            return reduceCardsDiscarded(core, event);
        
        case CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK:
            return reduceCardsDiscardedFromDeck(core, event);
        
        case CARDIA_EVENTS.CARD_RECYCLED:
            return reduceCardRecycled(core, event);
        
        case CARDIA_EVENTS.DECK_SHUFFLED:
            return reduceDeckShuffled(core, event);
        
        case CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED:
            return reduceDelayedEffectRegistered(core, event);
        
        case CARDIA_EVENTS.DELAYED_EFFECT_TRIGGERED:
            return reduceDelayedEffectTriggered(core, event);
        
        case CARDIA_EVENTS.INVENTOR_PENDING_SET:
            return reduceInventorPendingSet(core, event);
        
        case CARDIA_EVENTS.INVENTOR_PENDING_CLEARED:
            return reduceInventorPendingCleared(core, event);
        
        case CARDIA_EVENTS.TURN_ENDED:
            return reduceTurnEnded(core, event);
        
        case CARDIA_EVENTS.PHASE_CHANGED:
            return reducePhaseChanged(core, event);
        
        case FLOW_EVENTS.PHASE_CHANGED:
            return reducePhaseChanged(core, event as any);
        
        case CARDIA_EVENTS.REVEAL_ORDER_CHANGED:
            return reduceRevealOrderChanged(core, event);
        
        case CARDIA_EVENTS.GAME_WON:
            return reduceGameWon(core, event);
        
        default:
            return core;
    }
}

/**
 * 归约卡牌打出事件
 */
function reduceCardPlayed(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARD_PLAYED }>
): CardiaCore {
    const { playerId, cardUid, slotIndex } = event.payload;
    const player = core.players[playerId];
    
    // 从手牌中移除卡牌
    const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
    if (cardIndex === -1) return core;
    
    const card = player.hand[cardIndex];
    const newHand = [
        ...player.hand.slice(0, cardIndex),
        ...player.hand.slice(cardIndex + 1),
    ];
    
    // 检查占卜师能力：如果当前玩家是 revealFirstNextEncounter 指定的玩家，则立即揭示
    const shouldRevealImmediately = core.revealFirstNextEncounter === playerId;
    
    // 更新玩家状态
    return updatePlayer(core, playerId, {
        hand: newHand,
        currentCard: card,
        hasPlayed: true,
        cardRevealed: shouldRevealImmediately,  // 占卜师能力：对手先揭示
    });
}

/**
 * 归约卡牌抽取事件
 */
function reduceCardDrawn(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARD_DRAWN }>
): CardiaCore {
    const { playerId, count } = event.payload;
    const player = core.players[playerId];
    
    // 从牌库抽取指定数量的卡牌
    const drawnCards = player.deck.slice(0, count);
    const newDeck = player.deck.slice(count);
    const newHand = [...player.hand, ...drawnCards];
    
    return updatePlayer(core, playerId, {
        hand: newHand,
        deck: newDeck,
    });
}

/**
 * 归约遭遇战解析事件
 */
function reduceEncounterResolved(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.ENCOUNTER_RESOLVED }>
): CardiaCore {
    const { slotIndex, winner, loser } = event.payload;
    
    // 创建遭遇战状态
    const player1 = core.players[core.playerOrder[0]];
    const player2 = core.players[core.playerOrder[1]];
    
    const player1Card = player1.currentCard;
    const player2Card = player2.currentCard;
    
    if (!player1Card || !player2Card) return core;
    
    // 计算影响力（从修正标记）
    const player1Modifiers = core.modifierTokens.filter(t => t.cardId === player1Card.uid);
    const player2Modifiers = core.modifierTokens.filter(t => t.cardId === player2Card.uid);
    
    const player1Influence = player1Modifiers.reduce((acc, m) => acc + m.value, player1Card.baseInfluence);
    const player2Influence = player2Modifiers.reduce((acc, m) => acc + m.value, player2Card.baseInfluence);
    
    const encounter: EncounterState = {
        player1Card,
        player2Card,
        player1Influence,
        player2Influence,
        winnerId: winner === 'tie' ? undefined : winner,
        loserId: loser || undefined,
    };
    
    // 将双方的 currentCard 移动到 playedCards
    // 确保所有 PlayedCard 必需字段都存在
    const player1CardWithEncounter: PlayedCard = {
        uid: player1Card.uid,
        defId: player1Card.defId,
        ownerId: player1Card.ownerId,
        baseInfluence: player1Card.baseInfluence,
        faction: player1Card.faction,
        abilityIds: player1Card.abilityIds,
        difficulty: player1Card.difficulty,
        modifiers: player1Card.modifiers,
        tags: player1Card.tags,
        signets: player1Card.signets,
        ongoingMarkers: player1Card.ongoingMarkers,
        imageIndex: player1Card.imageIndex,
        imagePath: player1Card.imagePath,
        encounterIndex: core.turnNumber,
    };
    
    const player2CardWithEncounter: PlayedCard = {
        uid: player2Card.uid,
        defId: player2Card.defId,
        ownerId: player2Card.ownerId,
        baseInfluence: player2Card.baseInfluence,
        faction: player2Card.faction,
        abilityIds: player2Card.abilityIds,
        difficulty: player2Card.difficulty,
        modifiers: player2Card.modifiers,
        tags: player2Card.tags,
        signets: player2Card.signets,
        ongoingMarkers: player2Card.ongoingMarkers,
        imageIndex: player2Card.imageIndex,
        imagePath: player2Card.imagePath,
        encounterIndex: core.turnNumber,
    };
    
    let newCore = {
        ...core,
        previousEncounter: core.currentEncounter,
        currentEncounter: encounter,
        encounterHistory: [...core.encounterHistory, encounter],
        // P0-003 修复：遭遇解析后清除占卜师能力标记（只影响一次遭遇）
        revealFirstNextEncounter: null,
        forcedPlayOrderNextEncounter: null,
    };
    
    // 更新 player1（卡牌已翻开）
    newCore = updatePlayer(newCore, core.playerOrder[0], {
        playedCards: [...player1.playedCards, player1CardWithEncounter],
        currentCard: null,
        hasPlayed: false,
        cardRevealed: true,  // 遭遇解析后卡牌翻开
    });
    
    // 更新 player2（卡牌已翻开）
    newCore = updatePlayer(newCore, core.playerOrder[1], {
        playedCards: [...player2.playedCards, player2CardWithEncounter],
        currentCard: null,
        hasPlayed: false,
        cardRevealed: true,  // 遭遇解析后卡牌翻开
    });
    
    return newCore;
}

/**
 * 归约能力激活事件
 */
function reduceAbilityActivated(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.ABILITY_ACTIVATED }>
): CardiaCore {
    // 能力激活事件本身不改变状态
    // 状态变化由能力效果产生的其他事件处理
    return core;
}

/**
 * 归约卡牌回收事件
 * 将场上卡牌回收到手牌
 */
function reduceCardRecycled(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARD_RECYCLED }>
): CardiaCore {
    const { playerId, cardId, from } = event.payload;
    const player = core.players[playerId];
    
    // 从场上移除卡牌
    const cardIndex = player.playedCards.findIndex(c => c.uid === cardId);
    if (cardIndex === -1) {
        console.error('[reduceCardRecycled] Card not found on field:', cardId);
        return core;
    }
    
    const card = player.playedCards[cardIndex];
    const newPlayedCards = [
        ...player.playedCards.slice(0, cardIndex),
        ...player.playedCards.slice(cardIndex + 1),
    ];
    
    // 清空卡牌上的所有标记信息（回到手牌时重置为初始状态）
    const cleanedCard = {
        ...card,
        signets: 0,
        ongoingMarkers: [],
        encounterIndex: -1, // 重置遭遇序号
    };
    
    // 将清理后的卡牌添加到手牌
    const newHand = [...player.hand, cleanedCard];
    
    // 同时需要清理该卡牌相关的修正标记
    const newModifierTokens = core.modifierTokens.filter(token => token.cardId !== cardId);
    
    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: {
                ...player,
                hand: newHand,
                playedCards: newPlayedCards,
            },
        },
        modifierTokens: newModifierTokens,
    };
}

/**
 * 归约牌库混洗事件
 */
function reduceDeckShuffled(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.DECK_SHUFFLED }>
): CardiaCore {
    const { playerId } = event.payload;
    
    // 牌库混洗事件不改变状态
    // 实际混洗在 execute 中完成
    // 这里只是一个占位符，用于日志记录
    return core;
}

/**
 * 归约持续能力放置事件
 */
function reduceOngoingAbilityPlaced(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.ONGOING_ABILITY_PLACED }>
): CardiaCore {
    const { abilityId, cardId, playerId, effectType, timestamp, encounterIndex, targetCardId, targetPlayerId } = event.payload;
    
    const newAbility: OngoingAbility = {
        abilityId,
        cardId,
        playerId,
        effectType,
        timestamp,
        encounterIndex,  // 添加 encounterIndex 字段
        targetCardId,    // 添加 targetCardId 字段（财务官使用）
        targetPlayerId,  // 添加 targetPlayerId 字段（财务官使用）
    };
    
    // 更新卡牌的 ongoingMarkers 字段
    const player = core.players[playerId];
    const updatedPlayedCards = player.playedCards.map(card => {
        if (card.uid === cardId) {
            return {
                ...card,
                ongoingMarkers: [...(card.ongoingMarkers || []), abilityId],
            };
        }
        return card;
    });
    
    return {
        ...core,
        ongoingAbilities: [...core.ongoingAbilities, newAbility],
        players: {
            ...core.players,
            [playerId]: {
                ...player,
                playedCards: updatedPlayedCards,
            },
        },
    };
}

/**
 * 归约持续能力移除事件
 */
function reduceOngoingAbilityRemoved(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.ONGOING_ABILITY_REMOVED }>
): CardiaCore {
    const { abilityId, cardId, playerId } = event.payload;
    
    // 查找被移除的持续能力（用于获取 targetCardId 和 targetPlayerId）
    const removedAbility = core.ongoingAbilities.find(
        ability => ability.abilityId === abilityId && ability.cardId === cardId
    );
    
    // 移除 core.ongoingAbilities 中的记录
    let newCore = {
        ...core,
        ongoingAbilities: core.ongoingAbilities.filter(
            ability => !(ability.abilityId === abilityId && ability.cardId === cardId)
        ),
    };
    
    // 同步移除 card.ongoingMarkers 中的标记
    const player = newCore.players[playerId];
    const updatedPlayedCards = player.playedCards.map(card => {
        if (card.uid === cardId) {
            return {
                ...card,
                ongoingMarkers: (card.ongoingMarkers || []).filter(id => id !== abilityId),
            };
        }
        return card;
    });
    
    newCore = updatePlayer(newCore, playerId, {
        playedCards: updatedPlayedCards,
    });
    
    // 特殊处理：财务官能力移除时，收回额外印戒
    if (removedAbility && abilityId === ABILITY_IDS.TREASURER) {
        const targetCardId = (removedAbility as any).targetCardId;
        const targetPlayerId = (removedAbility as any).targetPlayerId;
        
        if (targetCardId && targetPlayerId) {
            const targetPlayer = newCore.players[targetPlayerId];
            const targetCardIndex = targetPlayer.playedCards.findIndex(c => c.uid === targetCardId);
            
            if (targetCardIndex !== -1) {
                const targetCard = targetPlayer.playedCards[targetCardIndex];
                
                // 只有当卡牌还有印戒时才减少
                if (targetCard.signets > 0) {
                    const updatedTargetCard = {
                        ...targetCard,
                        signets: targetCard.signets - 1,
                    };
                    
                    const newTargetPlayedCards = [
                        ...targetPlayer.playedCards.slice(0, targetCardIndex),
                        updatedTargetCard,
                        ...targetPlayer.playedCards.slice(targetCardIndex + 1),
                    ];
                    
                    newCore = updatePlayer(newCore, targetPlayerId, {
                        playedCards: newTargetPlayedCards,
                    });
                }
            }
        }
    }
    
    // 特殊处理：审判官能力移除时，收回历史平局遭遇获得的印戒
    // 规则：一旦持续能力失效，立刻结算因此产生的变化（包括影响到的过去遭遇）
    if (removedAbility && abilityId === ABILITY_IDS.MAGISTRATE) {
        const magistratePlayerId = removedAbility.playerId;
        
        // 遍历遭遇历史，找到所有原本是平局的遭遇
        // 这些遭遇中，审判官能力拥有者的卡牌获得了印戒
        for (const encounter of newCore.encounterHistory) {
            // 判断是否为平局：双方影响力相等
            if (encounter.player1Influence === encounter.player2Influence) {
                // 这是一个平局遭遇，审判官能力让其中一方获胜
                // 找到审判官能力拥有者在这次遭遇中的卡牌
                const magistrateCard = magistratePlayerId === newCore.playerOrder[0]
                    ? encounter.player1Card
                    : encounter.player2Card;
                
                // 在 playedCards 中找到这张卡牌，移除1枚印戒
                const magistratePlayer = newCore.players[magistratePlayerId];
                const cardIndex = magistratePlayer.playedCards.findIndex(c => c.uid === magistrateCard.uid);
                
                if (cardIndex !== -1) {
                    const card = magistratePlayer.playedCards[cardIndex];
                    
                    // 只有当卡牌还有印戒时才减少
                    if (card.signets > 0) {
                        const updatedCard = {
                            ...card,
                            signets: card.signets - 1,
                        };
                        
                        const newPlayedCards = [
                            ...magistratePlayer.playedCards.slice(0, cardIndex),
                            updatedCard,
                            ...magistratePlayer.playedCards.slice(cardIndex + 1),
                        ];
                        
                        newCore = updatePlayer(newCore, magistratePlayerId, {
                            playedCards: newPlayedCards,
                        });
                    }
                }
            }
        }
    }
    
    return newCore;
}

/**
 * 归约修正标记放置事件
 */
function reduceModifierTokenPlaced(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.MODIFIER_TOKEN_PLACED }>
): CardiaCore {
    const { cardId, value, source, timestamp } = event.payload;
    
    // 检查是否已存在相同的修正标记（去重）
    const isDuplicate = core.modifierTokens.some(
        token => 
            token.cardId === cardId &&
            token.value === value &&
            token.source === source &&
            token.timestamp === timestamp
    );
    
    if (isDuplicate) {
        console.warn('[Reducer] Duplicate modifier token detected, skipping:', {
            cardId, value, source, timestamp
        });
        return core;  // 不修改状态
    }
    
    const newToken: ModifierToken = {
        cardId,
        value,
        source,
        timestamp,
    };
    
    return {
        ...core,
        modifierTokens: [...core.modifierTokens, newToken],
    };
}

/**
 * 归约修正标记移除事件
 */
function reduceModifierTokenRemoved(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED }>
): CardiaCore {
    const { cardId, source } = event.payload;
    
    return {
        ...core,
        modifierTokens: core.modifierTokens.filter(token => {
            if (token.cardId !== cardId) return true;
            if (source && token.source !== source) return true;
            return false;
        }),
    };
}

/**
 * 归约卡牌影响力修改事件
 */
function reduceCardInfluenceModified(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED }>
): CardiaCore {
    const { cardId, newInfluence } = event.payload;
    
    // 更新遭遇历史中的影响力
    const encounterIndex = core.encounterHistory.findIndex(encounter => 
        encounter.player1Card?.uid === cardId || 
        encounter.player2Card?.uid === cardId
    );
    
    if (encounterIndex === -1) {
        // 卡牌不在任何遭遇中，无需更新
        console.log('[reduceCardInfluenceModified] Card not in any encounter, skipping update:', {
            cardId,
            encounterHistoryLength: core.encounterHistory.length,
        });
        return core;
    }
    
    const encounter = core.encounterHistory[encounterIndex];
    
    // 安全检查：确保遭遇中的卡牌存在
    if (!encounter.player1Card || !encounter.player2Card) {
        console.warn('[reduceCardInfluenceModified] Encounter has missing cards, skipping update:', {
            encounterIndex,
            hasPlayer1Card: !!encounter.player1Card,
            hasPlayer2Card: !!encounter.player2Card,
        });
        return core;
    }
    
    const updatedEncounter: EncounterState = {
        ...encounter,
        player1Influence: encounter.player1Card?.uid === cardId 
            ? newInfluence 
            : encounter.player1Influence,
        player2Influence: encounter.player2Card?.uid === cardId 
            ? newInfluence 
            : encounter.player2Influence,
    };
    
    const newHistory = [
        ...core.encounterHistory.slice(0, encounterIndex),
        updatedEncounter,
        ...core.encounterHistory.slice(encounterIndex + 1),
    ];
    
    return {
        ...core,
        encounterHistory: newHistory,
    };
}

/**
 * 归约遭遇结果改变事件
 */
function reduceEncounterResultChanged(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.ENCOUNTER_RESULT_CHANGED }>
): CardiaCore {
    const { slotIndex, newWinner } = event.payload;
    
    // 更新遭遇历史中的结果
    if (slotIndex < 0 || slotIndex >= core.encounterHistory.length) {
        console.warn('[Cardia] reduceEncounterResultChanged: invalid slotIndex', { slotIndex });
        return core;
    }
    
    const encounter = core.encounterHistory[slotIndex];
    const oldWinner = encounter.winnerId;
    
    const updatedEncounter: EncounterState = {
        ...encounter,
        winnerId: newWinner === 'tie' ? undefined : newWinner,
        loserId: newWinner === 'tie' ? undefined : (
            newWinner === encounter.player1Card?.ownerId 
                ? encounter.player2Card?.ownerId 
                : encounter.player1Card?.ownerId
        ),
    };
    
    const newHistory = [
        ...core.encounterHistory.slice(0, slotIndex),
        updatedEncounter,
        ...core.encounterHistory.slice(slotIndex + 1),
    ];
    
    // 如果修改的是当前遭遇（最后一个），也更新 currentEncounter
    const isCurrentEncounter = slotIndex === core.encounterHistory.length - 1;
    
    let newCore = {
        ...core,
        encounterHistory: newHistory,
        currentEncounter: isCurrentEncounter ? updatedEncounter : core.currentEncounter,
    };
    
    // 处理印戒移动：从有获胜方变为平局时，移除获胜方卡牌上的印戒
    if (oldWinner && oldWinner !== 'tie' && newWinner === 'tie') {
        // 安全检查：确保遭遇中的卡牌存在
        if (!encounter.player1Card || !encounter.player2Card) {
            console.warn('[reduceEncounterResultChanged] Encounter has missing cards, skipping signet removal:', {
                hasPlayer1Card: !!encounter.player1Card,
                hasPlayer2Card: !!encounter.player2Card,
            });
            return newCore;
        }
        
        // 找到旧获胜方的卡牌
        const oldWinnerCard = oldWinner === encounter.player1Card.ownerId 
            ? encounter.player1Card 
            : encounter.player2Card;
        
        // 从对应玩家的 playedCards 中移除印戒
        for (const playerId of core.playerOrder) {
            const player = newCore.players[playerId];
            const cardIndex = player.playedCards.findIndex(c => c.uid === oldWinnerCard.uid);
            
            if (cardIndex !== -1) {
                const card = player.playedCards[cardIndex];
                if (card.signets > 0) {
                    const updatedCard = {
                        ...card,
                        signets: card.signets - 1,
                    };
                    
                    const newPlayedCards = [
                        ...player.playedCards.slice(0, cardIndex),
                        updatedCard,
                        ...player.playedCards.slice(cardIndex + 1),
                    ];
                    
                    newCore = updatePlayer(newCore, playerId, {
                        playedCards: newPlayedCards,
                    });
                }
                break;
            }
        }
    }
    
    return newCore;
}

/**
 * 归约印戒移动事件
 */
function reduceSignetMoved(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.SIGNET_MOVED }>
): CardiaCore {
    const { fromCardId, toCardId } = event.payload;
    
    let newCore = core;
    
    // 从源卡牌移除印戒
    for (const playerId of core.playerOrder) {
        const player = core.players[playerId];
        const fromCardIndex = player.playedCards.findIndex(c => c.uid === fromCardId);
        
        if (fromCardIndex !== -1) {
            const fromCard = player.playedCards[fromCardIndex];
            const updatedFromCard = {
                ...fromCard,
                signets: Math.max(0, fromCard.signets - 1),
            };
            
            const newPlayedCards = [
                ...player.playedCards.slice(0, fromCardIndex),
                updatedFromCard,
                ...player.playedCards.slice(fromCardIndex + 1),
            ];
            
            newCore = updatePlayer(newCore, playerId, {
                playedCards: newPlayedCards,
            });
            break;
        }
    }
    
    // 向目标卡牌添加印戒
    for (const playerId of core.playerOrder) {
        const player = newCore.players[playerId];
        const toCardIndex = player.playedCards.findIndex(c => c.uid === toCardId);
        
        if (toCardIndex !== -1) {
            const toCard = player.playedCards[toCardIndex];
            const updatedToCard = {
                ...toCard,
                signets: toCard.signets + 1,
            };
            
            const newPlayedCards = [
                ...player.playedCards.slice(0, toCardIndex),
                updatedToCard,
                ...player.playedCards.slice(toCardIndex + 1),
            ];
            
            newCore = updatePlayer(newCore, playerId, {
                playedCards: newPlayedCards,
            });
            break;
        }
    }
    
    return newCore;
}

/**
 * 归约印戒移除事件
 * 当遭遇结果从"有获胜方"变为"平局"时，移除获胜方卡牌上的印戒
 */
function reduceSignetRemoved(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.SIGNET_REMOVED }>
): CardiaCore {
    const { cardId, playerId } = event.payload;
    
    const player = core.players[playerId];
    const cardIndex = player.playedCards.findIndex(c => c.uid === cardId);
    
    if (cardIndex === -1) {
        console.warn('[Cardia] reduceSignetRemoved: card not found in playedCards', { cardId, playerId });
        return core;
    }
    
    const card = player.playedCards[cardIndex];
    
    // 确保印戒数量不会低于 0
    if (card.signets <= 0) {
        console.warn('[Cardia] reduceSignetRemoved: card has no signets to remove', { cardId, playerId, signets: card.signets });
        return core;
    }
    
    const updatedCard = {
        ...card,
        signets: card.signets - 1,
    };
    
    const newPlayedCards = [
        ...player.playedCards.slice(0, cardIndex),
        updatedCard,
        ...player.playedCards.slice(cardIndex + 1),
    ];
    
    return updatePlayer(core, playerId, {
        playedCards: newPlayedCards,
    });
}

/**
 * 归约额外印戒放置事件
 */
function reduceExtraSignetPlaced(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.EXTRA_SIGNET_PLACED }>
): CardiaCore {
    const { cardId, playerId } = event.payload;
    
    const player = core.players[playerId];
    
    // 卡牌应该已经在 playedCards 中（由 reduceEncounterResolved 移动）
    const cardIndex = player.playedCards.findIndex(c => c.uid === cardId);
    
    if (cardIndex !== -1) {
        // 卡牌在 playedCards 中，直接更新
        const card = player.playedCards[cardIndex];
        const updatedCard = {
            ...card,
            signets: card.signets + 1,
        };
        
        const newPlayedCards = [
            ...player.playedCards.slice(0, cardIndex),
            updatedCard,
            ...player.playedCards.slice(cardIndex + 1),
        ];
        
        return updatePlayer(core, playerId, {
            playedCards: newPlayedCards,
        });
    }
    
    // 卡牌不存在，返回原状态
    console.warn('[Cardia] reduceExtraSignetPlaced: card not found in playedCards', { cardId, playerId });
    return core;
}

/**
 * 归约印戒授予事件
 */
function reduceSignetGranted(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.SIGNET_GRANTED }>
): CardiaCore {
    const { cardUid, playerId } = event.payload;
    
    const player = core.players[playerId];
    
    // 卡牌应该已经在 playedCards 中
    const cardIndex = player.playedCards.findIndex(c => c.uid === cardUid);
    
    if (cardIndex !== -1) {
        // 卡牌在 playedCards 中，直接更新
        const card = player.playedCards[cardIndex];
        const updatedCard = {
            ...card,
            signets: card.signets + 1,
        };
        
        const newPlayedCards = [
            ...player.playedCards.slice(0, cardIndex),
            updatedCard,
            ...player.playedCards.slice(cardIndex + 1),
        ];
        
        return updatePlayer(core, playerId, {
            playedCards: newPlayedCards,
        });
    }
    
    // 卡牌不存在，返回原状态
    console.warn('[Cardia] reduceSignetGranted: card not found in playedCards', { cardUid, playerId });
    return core;
}

/**
 * 归约卡牌替换事件（傀儡师能力）
 */
function reduceCardReplaced(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARD_REPLACED }>
): CardiaCore {
    console.log('[reduceCardReplaced] 开始处理卡牌替换事件:', event.payload);
    
    try {
        const { oldCardId, newCardId, playerId, encounterIndex, suppressAbility } = event.payload;
        const player = core.players[playerId];
        
        // 1. 找到要替换的旧卡牌
        const oldCard = player.playedCards.find(c => c.uid === oldCardId);
        if (!oldCard) {
            console.warn('[reduceCardReplaced] 未找到要替换的卡牌:', oldCardId);
            return core;
        }
        
        // 2. 找到替换用的新卡牌（从手牌中）
        const newCard = player.hand.find(c => c.uid === newCardId);
        if (!newCard) {
            console.warn('[reduceCardReplaced] 未找到替换用的卡牌:', newCardId);
            return core;
        }
        
        console.log('[reduceCardReplaced] 找到卡牌:', {
            oldCard: { uid: oldCard.uid, defId: oldCard.defId, signets: oldCard.signets },
            newCard: { uid: newCard.uid, defId: newCard.defId },
        });
    
    // 3. 找到对应的遭遇记录，计算替换前后的遭遇结果
    const encounterIdx = core.encounterHistory.findIndex(enc => 
        (enc.player1Card?.uid === oldCardId || enc.player2Card?.uid === oldCardId)
    );
    
    console.log('[reduceCardReplaced] 查找遭遇记录:', {
        oldCardId,
        encounterHistoryLength: core.encounterHistory.length,
        encounterIdx,
        foundEncounter: encounterIdx !== -1 ? {
            player1CardUid: core.encounterHistory[encounterIdx].player1Card?.uid,
            player2CardUid: core.encounterHistory[encounterIdx].player2Card?.uid,
            winnerId: core.encounterHistory[encounterIdx].winnerId,
        } : null,
    });
    
    let oldWinnerId: string | undefined;
    let newWinnerId: string | undefined;
    let opponentCardId: string | undefined;
    
    if (encounterIdx !== -1) {
        const encounter = core.encounterHistory[encounterIdx];
        oldWinnerId = encounter.winnerId;
        
        // 计算新卡牌的影响力（基础影响力 + 修正标记）
        const newCardModifiers = core.modifierTokens.filter(t => t.cardId === newCardId);
        const newCardInfluence = newCardModifiers.reduce((acc, m) => acc + m.value, newCard.baseInfluence);
        
        // 确定是 player1 还是player2 被替换
        const isPlayer1 = encounter.player1Card?.uid === oldCardId;
        const opponentInfluence = isPlayer1 ? encounter.player2Influence : encounter.player1Influence;
        opponentCardId = isPlayer1 ? encounter.player2Card?.uid : encounter.player1Card?.uid;
        
        // 计算新的获胜者
        if (newCardInfluence > opponentInfluence) {
            newWinnerId = playerId;
        } else if (newCardInfluence < opponentInfluence) {
            newWinnerId = isPlayer1 ? encounter.player2Card?.ownerId : encounter.player1Card?.ownerId;
        } else {
            newWinnerId = undefined; // 平局
        }
        
        console.log('[reduceCardReplaced] 遭遇结果变化:', {
            encounterIdx,
            oldWinnerId,
            newWinnerId,
            newCardInfluence,
            opponentInfluence,
            isPlayer1,
        });
    }
    
    // 4. 将旧卡牌移到弃牌堆（移除印戒）
    const oldCardWithoutSignets = { ...oldCard, signets: 0 };
    const newDiscard = [...player.discard, oldCardWithoutSignets];
    
    // 5. 从手牌中移除新卡牌
    const newHand = player.hand.filter(c => c.uid !== newCardId);
    
    // 6. 将新卡牌放到场上（保持相同的遭遇序号，初始印戒为 0）
    const replacedCard = {
        ...newCard,
        encounterIndex,
        signets: 0,  // 新卡牌初始印戒为 0
        suppressAbility: suppressAbility || false,
    };
    
    const newPlayedCards = player.playedCards.map(c => 
        c.uid === oldCardId ? replacedCard : c
    );
    
    console.log('[reduceCardReplaced] 替换完成:', {
        handSize: newHand.length,
        discardSize: newDiscard.length,
        playedCardsCount: newPlayedCards.length,
        oldCardSignets: oldCard.signets,
        newCardSignets: replacedCard.signets,
    });
    
    // 7. 更新遭遇历史中的卡牌引用和影响力
    const newEncounterHistory = core.encounterHistory.map((encounter, index) => {
        if (index !== encounterIdx) return encounter;
        
        const isPlayer1Match = encounter.player1Card?.uid === oldCardId;
        const isPlayer2Match = encounter.player2Card?.uid === oldCardId;
        
        if (isPlayer1Match) {
            // 计算新影响力
            const newCardModifiers = core.modifierTokens.filter(t => t.cardId === newCardId);
            const newInfluence = newCardModifiers.reduce((acc, m) => acc + m.value, newCard.baseInfluence);
            
            return {
                ...encounter,
                player1Card: replacedCard,
                player1Influence: newInfluence,
                winnerId: newWinnerId,
                loserId: newWinnerId === undefined ? undefined : (
                    newWinnerId === encounter.player1Card?.ownerId 
                        ? encounter.player2Card?.ownerId 
                        : encounter.player1Card?.ownerId
                ),
            };
        } else if (isPlayer2Match) {
            // 计算新影响力
            const newCardModifiers = core.modifierTokens.filter(t => t.cardId === newCardId);
            const newInfluence = newCardModifiers.reduce((acc, m) => acc + m.value, newCard.baseInfluence);
            
            return {
                ...encounter,
                player2Card: replacedCard,
                player2Influence: newInfluence,
                winnerId: newWinnerId,
                loserId: newWinnerId === undefined ? undefined : (
                    newWinnerId === encounter.player2Card?.ownerId 
                        ? encounter.player1Card?.ownerId 
                        : encounter.player2Card?.ownerId
                ),
            };
        }
        return encounter;
    });
    
    // 8. 同时更新 currentEncounter 和 previousEncounter（如果包含旧卡牌）
    let newCurrentEncounter = core.currentEncounter;
    if (newCurrentEncounter && (newCurrentEncounter.player1Card?.uid === oldCardId || newCurrentEncounter.player2Card?.uid === oldCardId)) {
        const isPlayer1 = newCurrentEncounter.player1Card?.uid === oldCardId;
        const newCardModifiers = core.modifierTokens.filter(t => t.cardId === newCardId);
        const newInfluence = newCardModifiers.reduce((acc, m) => acc + m.value, newCard.baseInfluence);
        
        newCurrentEncounter = {
            ...newCurrentEncounter,
            ...(isPlayer1 ? {
                player1Card: replacedCard,
                player1Influence: newInfluence,
            } : {
                player2Card: replacedCard,
                player2Influence: newInfluence,
            }),
            winnerId: newWinnerId,
            loserId: newWinnerId === undefined ? undefined : (
                newWinnerId === (isPlayer1 ? newCurrentEncounter.player1Card?.ownerId : newCurrentEncounter.player2Card?.ownerId)
                    ? (isPlayer1 ? newCurrentEncounter.player2Card?.ownerId : newCurrentEncounter.player1Card?.ownerId)
                    : (isPlayer1 ? newCurrentEncounter.player1Card?.ownerId : newCurrentEncounter.player2Card?.ownerId)
            ),
        };
    }
    
    let newPreviousEncounter = core.previousEncounter;
    if (newPreviousEncounter && (newPreviousEncounter.player1Card?.uid === oldCardId || newPreviousEncounter.player2Card?.uid === oldCardId)) {
        const isPlayer1 = newPreviousEncounter.player1Card?.uid === oldCardId;
        const newCardModifiers = core.modifierTokens.filter(t => t.cardId === newCardId);
        const newInfluence = newCardModifiers.reduce((acc, m) => acc + m.value, newCard.baseInfluence);
        
        newPreviousEncounter = {
            ...newPreviousEncounter,
            ...(isPlayer1 ? {
                player1Card: replacedCard,
                player1Influence: newInfluence,
            } : {
                player2Card: replacedCard,
                player2Influence: newInfluence,
            }),
            winnerId: newWinnerId,
            loserId: newWinnerId === undefined ? undefined : (
                newWinnerId === (isPlayer1 ? newPreviousEncounter.player1Card?.ownerId : newPreviousEncounter.player2Card?.ownerId)
                    ? (isPlayer1 ? newPreviousEncounter.player2Card?.ownerId : newPreviousEncounter.player1Card?.ownerId)
                    : (isPlayer1 ? newPreviousEncounter.player1Card?.ownerId : newPreviousEncounter.player2Card?.ownerId)
            ),
        };
    }
    
    let newCore = {
        ...core,
        players: {
            ...core.players,
            [playerId]: {
                ...player,
                hand: newHand,
                playedCards: newPlayedCards,
                discard: newDiscard,
            },
        },
        encounterHistory: newEncounterHistory,
        currentEncounter: newCurrentEncounter,
        previousEncounter: newPreviousEncounter,
    };
    
    // 9. 处理印戒转移：如果遭遇结果发生变化（获胜者改变）
    console.log('[reduceCardReplaced] 检查印戒转移条件:', {
        hasOldWinnerId: !!oldWinnerId,
        hasNewWinnerId: !!newWinnerId,
        oldWinnerId,
        newWinnerId,
        winnersAreDifferent: oldWinnerId !== newWinnerId,
        oldCardSignets: oldCard.signets,
    });
    
    if (oldWinnerId && newWinnerId && oldWinnerId !== newWinnerId) {
        console.log('[reduceCardReplaced] 检测到遭遇结果变化，转移印戒:', {
            oldWinnerId,
            newWinnerId,
            oldCardSignets: oldCard.signets,
        });
        
        // 印戒从旧获胜者的卡牌转移到新获胜者的卡牌
        // 旧获胜者的卡牌已经在弃牌堆（印戒已清零）
        // 需要给新获胜者的卡牌添加印戒
        
        // 找到新获胜者的卡牌
        let newWinnerCardId: string | undefined;
        
        // 确定傀儡师的主人（触发能力的玩家）
        const puppeteerOwnerId = getOpponentId(newCore, playerId);  // playerId 是被替换卡牌的拥有者，所以对手是傀儡师的主人
        
        if (newWinnerId === puppeteerOwnerId) {
            // 新获胜者是傀儡师的主人
            // 找到傀儡师的卡牌 ID（在相同遭遇序号的卡牌）
            const puppeteerCard = newCore.players[puppeteerOwnerId].playedCards.find(
                c => c.encounterIndex === encounterIndex
            );
            newWinnerCardId = puppeteerCard?.uid;
            console.log('[reduceCardReplaced] 新获胜者是傀儡师的主人:', {
                puppeteerOwnerId,
                puppeteerCardId: newWinnerCardId,
            });
        } else {
            // 新获胜者是对手（被替换卡牌的主人）
            // 找到对手在相同遭遇序号的卡牌（替换后的新卡牌）
            newWinnerCardId = replacedCard.uid;
            console.log('[reduceCardReplaced] 新获胜者是对手（替换后的卡牌）:', {
                replacedCardId: newWinnerCardId,
            });
        }
        
        if (newWinnerCardId) {
            // 找到新获胜者的卡牌并添加印戒
            for (const pid of core.playerOrder) {
                const p = newCore.players[pid];
                const cardIndex = p.playedCards.findIndex(c => c.uid === newWinnerCardId);
                
                if (cardIndex !== -1) {
                    const card = p.playedCards[cardIndex];
                    const updatedCard = {
                        ...card,
                        signets: card.signets + oldCard.signets,  // 添加旧卡牌的印戒数量
                    };
                    
                    const updatedPlayedCards = [
                        ...p.playedCards.slice(0, cardIndex),
                        updatedCard,
                        ...p.playedCards.slice(cardIndex + 1),
                    ];
                    
                    newCore = updatePlayer(newCore, pid, {
                        playedCards: updatedPlayedCards,
                    });
                    
                    console.log('[reduceCardReplaced] 印戒转移完成:', {
                        toCardId: newWinnerCardId,
                        toPlayerId: pid,
                        signetsAdded: oldCard.signets,
                        newSignets: updatedCard.signets,
                    });
                    break;
                }
            }
        } else {
            console.warn('[reduceCardReplaced] 未找到新获胜者的卡牌');
        }
    }
    
    return newCore;
    } catch (error) {
        console.error('[reduceCardReplaced] 发生错误:', error);
        console.error('[reduceCardReplaced] 错误堆栈:', error instanceof Error ? error.stack : 'No stack');
        console.error('[reduceCardReplaced] 事件:', event);
        console.error('[reduceCardReplaced] Core状态:', {
            playerOrder: core.playerOrder,
            players: Object.keys(core.players),
        });
        throw error; // 重新抛出错误以便上层捕获
    }
}

/**
 * 归约卡牌弃掉事件
 */
function reduceCardsDiscarded(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARDS_DISCARDED }>
): CardiaCore {
    const { playerId, cardIds, from } = event.payload;
    const player = core.players[playerId];
    
    if (from === 'hand') {
        // 从手牌弃掉
        const discardedCards = player.hand.filter(c => cardIds.includes(c.uid));
        const newHand = player.hand.filter(c => !cardIds.includes(c.uid));
        const newDiscard = [...player.discard, ...discardedCards];
        
        return updatePlayer(core, playerId, {
            hand: newHand,
            discard: newDiscard,
        });
    } else if (from === 'field') {
        // 从场上弃掉
        const discardedCards = player.playedCards.filter(c => cardIds.includes(c.uid));
        const newPlayedCards = player.playedCards.filter(c => !cardIds.includes(c.uid));
        const newDiscard = [...player.discard, ...discardedCards];
        
        return updatePlayer(core, playerId, {
            playedCards: newPlayedCards,
            discard: newDiscard,
        });
    }
    
    return core;
}

/**
 * 归约从牌库弃牌事件
 */
function reduceCardsDiscardedFromDeck(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK }>
): CardiaCore {
    const { playerId, count } = event.payload;
    const player = core.players[playerId];
    
    const discardedCards = player.deck.slice(0, count);
    const newDeck = player.deck.slice(count);
    const newDiscard = [...player.discard, ...discardedCards];
    
    return updatePlayer(core, playerId, {
        deck: newDeck,
        discard: newDiscard,
    });
}

/**
 * 归约延迟效果注册事件
 */
function reduceDelayedEffectRegistered(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED }>
): CardiaCore {
    const { effectType, target, value, condition, sourceAbilityId, sourcePlayerId, timestamp } = event.payload;
    
    const newEffect: DelayedEffect = {
        effectType,
        target,
        value,
        condition,
        sourceAbilityId,
        sourcePlayerId,
        timestamp,
    };
    
    return {
        ...core,
        delayedEffects: [...core.delayedEffects, newEffect],
    };
}

/**
 * 归约延迟效果触发事件
 */
function reduceDelayedEffectTriggered(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.DELAYED_EFFECT_TRIGGERED }>
): CardiaCore {
    const { effectType, sourceAbilityId, sourcePlayerId } = event.payload;
    
    console.log('[Cardia] reduceDelayedEffectTriggered:', {
        effectType,
        sourceAbilityId,
        sourcePlayerId,
        beforeCount: core.delayedEffects.length,
    });
    
    // 移除已触发的延迟效果（匹配 effectType, sourceAbilityId, sourcePlayerId）
    const newDelayedEffects = core.delayedEffects.filter(
        effect => !(
            effect.effectType === effectType &&
            effect.sourceAbilityId === sourceAbilityId &&
            effect.sourcePlayerId === sourcePlayerId
        )
    );
    
    console.log('[Cardia] reduceDelayedEffectTriggered: after filter', {
        afterCount: newDelayedEffects.length,
        removed: core.delayedEffects.length - newDelayedEffects.length,
    });
    
    return {
        ...core,
        delayedEffects: newDelayedEffects,
    };
}

/**
 * 归约发明家待续标记设置事件
 */
function reduceInventorPendingSet(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.INVENTOR_PENDING_SET }>
): CardiaCore {
    const { playerId, timestamp, firstCardId } = event.payload;
    
    console.log('[reduceInventorPendingSet] Setting inventorPending:', {
        playerId,
        timestamp,
        firstCardId,
    });
    
    return {
        ...core,
        inventorPending: {
            playerId,
            timestamp,
            firstCardId,
        },
    };
}

/**
 * 归约发明家待续标记清理事件
 */
function reduceInventorPendingCleared(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.INVENTOR_PENDING_CLEARED }>
): CardiaCore {
    return {
        ...core,
        inventorPending: undefined,
    };
}

/**
 * 归约修正标记添加事件 (MODIFIER_ADDED)
 */
function reduceModifierAdded(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.MODIFIER_ADDED }>
): CardiaCore {
    const { cardUid, value, playerId } = event.payload;
    
    // 找到卡牌（可能在 currentCard 或 playedCards 中）
    const player = core.players[playerId];
    
    // 检查 currentCard
    if (player.currentCard?.uid === cardUid) {
        const card = player.currentCard;
        const newModifier = {
            id: `modifier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'flat' as const,
            value,
            source: 'manual',
        };
        
        const updatedCard = {
            ...card,
            modifiers: {
                ...card.modifiers,
                entries: [
                    ...card.modifiers.entries,
                    {
                        def: newModifier,
                        insertOrder: card.modifiers.nextOrder,
                    },
                ],
                nextOrder: card.modifiers.nextOrder + 1,
            },
        };
        
        return updatePlayer(core, playerId, {
            currentCard: updatedCard,
        });
    }
    
    // 检查 playedCards
    const cardIndex = player.playedCards.findIndex(c => c.uid === cardUid);
    if (cardIndex !== -1) {
        const card = player.playedCards[cardIndex];
        const newModifier = {
            id: `modifier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'flat' as const,
            value,
            source: 'manual',
        };
        
        const updatedCard = {
            ...card,
            modifiers: {
                ...card.modifiers,
                entries: [
                    ...card.modifiers.entries,
                    {
                        def: newModifier,
                        insertOrder: card.modifiers.nextOrder,
                    },
                ],
                nextOrder: card.modifiers.nextOrder + 1,
            },
        };
        
        const newPlayedCards = [
            ...player.playedCards.slice(0, cardIndex),
            updatedCard,
            ...player.playedCards.slice(cardIndex + 1),
        ];
        
        return updatePlayer(core, playerId, {
            playedCards: newPlayedCards,
        });
    }
    
    // 卡牌不存在，返回原状态
    console.warn('[Cardia] reduceModifierAdded: card not found', { cardUid, playerId });
    return core;
}

/**
 * 归约修正标记移除事件 (MODIFIER_REMOVED)
 */
function reduceModifierRemoved(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.MODIFIER_REMOVED }>
): CardiaCore {
    const { modifierId } = event.payload;
    
    return {
        ...core,
        modifierTokens: core.modifierTokens.filter(m => m.id !== modifierId),
    };
}

/**
 * 归约回合结束事件 (TURN_ENDED)
 */
function reduceTurnEnded(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.TURN_ENDED }>
): CardiaCore {
    const { playerId } = event.payload;
    
    // 切换当前玩家
    const opponentId = getOpponentId(core, playerId);
    
    // 重置双方玩家的回合状态
    let newCore = {
        ...core,
        turnNumber: core.turnNumber + 1,
        currentPlayerId: opponentId,
        // 回合结束时清理当前遭遇（防止下一回合 play 阶段误触发 auto-advance）
        currentEncounter: undefined,
        previousEncounter: core.currentEncounter,
        // P0-002 修复：回合结束时清理发明家待续标记
        inventorPending: undefined,
        // P0-003 修复：占卜师能力标记在遭遇解析后清除，不在回合结束时清除
        // revealFirstNextEncounter 和 forcedPlayOrderNextEncounter 保持不变
    };
    
    // 重置 player1 的回合状态
    newCore = updatePlayer(newCore, core.playerOrder[0], {
        hasPlayed: false,
        cardRevealed: false,
        currentCard: null,
    });
    
    // 重置 player2 的回合状态
    newCore = updatePlayer(newCore, core.playerOrder[1], {
        hasPlayed: false,
        cardRevealed: false,
        currentCard: null,
    });
    
    return newCore;
}

/**
 * 归约阶段变更事件 (PHASE_CHANGED)
 */
function reducePhaseChanged(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.PHASE_CHANGED }> | any
): CardiaCore {
    // 兼容两种 payload 格式：
    // - CARDIA_EVENTS.PHASE_CHANGED: { newPhase: string }
    // - FLOW_EVENTS.PHASE_CHANGED: { from: string, to: string, activePlayerId: string }
    const newPhase = (event.payload as any).newPhase || (event.payload as any).to;
    
    // 更新游戏阶段
    return {
        ...core,
        phase: newPhase,
    };
}

/**
 * 归约游戏胜利事件
 */
function reduceGameWon(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.GAME_WON }>
): CardiaCore {
    // 设置游戏胜利标记，供 isGameOver 检查
    const { winnerId } = event.payload as { winnerId: string; reason: string };
    
    return {
        ...core,
        gameWonBy: winnerId, // 添加游戏胜利标记
    };
}

/**
 * 归约揭示顺序改变事件
 */
function reduceRevealOrderChanged(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.REVEAL_ORDER_CHANGED }>
): CardiaCore {
    return {
        ...core,
        revealFirstNextEncounter: event.payload.revealFirstPlayerId,
        forcedPlayOrderNextEncounter: event.payload.forcedPlayOrderPlayerId || null,
    };
}

export default reduce;
