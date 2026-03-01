/**
 * Cardia 事件归约逻辑
 * 将事件应用到核心状态，使用结构共享
 */

import type { CardiaCore, CardInstance, EncounterState, ModifierToken, OngoingAbility, DelayedEffect, PlayedCard } from './core-types';
import type { CardiaEvent } from './events';
import { CARDIA_EVENTS } from './events';
import { updatePlayer, getOpponentId } from './utils';

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
        
        case CARDIA_EVENTS.TURN_ENDED:
            return reduceTurnEnded(core, event);
        
        case CARDIA_EVENTS.PHASE_CHANGED:
            return reducePhaseChanged(core, event);
        
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
    
    // 更新玩家状态（卡牌暗置，未翻开）
    return updatePlayer(core, playerId, {
        hand: newHand,
        currentCard: card,
        hasPlayed: true,
        cardRevealed: false,  // 暗牌机制：初始未翻开
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
    
    // 将卡牌添加到手牌
    const newHand = [...player.hand, card];
    
    return updatePlayer(core, playerId, {
        hand: newHand,
        playedCards: newPlayedCards,
    });
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
    const { abilityId, cardId, playerId, effectType, timestamp, encounterIndex } = event.payload;
    
    const newAbility: OngoingAbility = {
        abilityId,
        cardId,
        playerId,
        effectType,
        timestamp,
        encounterIndex,  // 添加 encounterIndex 字段
    };
    
    // 更新卡牌的 ongoingMarkers 字段
    const player = core.players[playerId];
    const updatedPlayedCards = player.playedCards.map(card => {
        if (card.uid === cardId) {
            return {
                ...card,
                ongoingMarkers: [...card.ongoingMarkers, abilityId],
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
    
    // 移除 core.ongoingAbilities 中的记录
    const newCore = {
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
                ongoingMarkers: card.ongoingMarkers.filter(id => id !== abilityId),
            };
        }
        return card;
    });
    
    return updatePlayer(newCore, playerId, {
        playedCards: updatedPlayedCards,
    });
}

/**
 * 归约修正标记放置事件
 */
function reduceModifierTokenPlaced(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.MODIFIER_TOKEN_PLACED }>
): CardiaCore {
    const { cardId, value, source, timestamp } = event.payload;
    
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
        encounter.player1Card.uid === cardId || 
        encounter.player2Card.uid === cardId
    );
    
    if (encounterIndex === -1) {
        // 卡牌不在任何遭遇中，无需更新
        return core;
    }
    
    const encounter = core.encounterHistory[encounterIndex];
    const updatedEncounter: EncounterState = {
        ...encounter,
        player1Influence: encounter.player1Card.uid === cardId 
            ? newInfluence 
            : encounter.player1Influence,
        player2Influence: encounter.player2Card.uid === cardId 
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
    const updatedEncounter: EncounterState = {
        ...encounter,
        winnerId: newWinner === 'tie' ? undefined : newWinner,
        loserId: newWinner === 'tie' ? undefined : (
            newWinner === encounter.player1Card.ownerId 
                ? encounter.player2Card.ownerId 
                : encounter.player1Card.ownerId
        ),
    };
    
    const newHistory = [
        ...core.encounterHistory.slice(0, slotIndex),
        updatedEncounter,
        ...core.encounterHistory.slice(slotIndex + 1),
    ];
    
    // 如果修改的是当前遭遇（最后一个），也更新 currentEncounter
    const isCurrentEncounter = slotIndex === core.encounterHistory.length - 1;
    
    return {
        ...core,
        encounterHistory: newHistory,
        currentEncounter: isCurrentEncounter ? updatedEncounter : core.currentEncounter,
    };
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
 * 归约卡牌替换事件
 */
function reduceCardReplaced(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARD_REPLACED }>
): CardiaCore {
    // TODO: 实现卡牌替换逻辑（傀儡师能力）
    // 这需要更复杂的状态管理，暂时返回原状态
    return core;
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
    const { effectType, targetCardId } = event.payload;
    
    // 移除已触发的延迟效果
    return {
        ...core,
        delayedEffects: core.delayedEffects.filter(
            effect => !(effect.effectType === effectType)
        ),
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
        currentEncounter: undefined,
        previousEncounter: core.currentEncounter,
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
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.PHASE_CHANGED }>
): CardiaCore {
    const { newPhase } = event.payload;
    
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
    };
}

export default reduce;
