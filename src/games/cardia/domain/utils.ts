import type { PlayerId } from '../../../engine/types';
import type { CardiaCore, PlayerState, PlayedCard, ModifierToken } from './core-types';

/**
 * 创建初始玩家状态
 */
export function createPlayerState(playerId: PlayerId): PlayerState {
    return {
        id: playerId,
        name: `Player ${playerId}`,
        hand: [],
        deck: [],
        discard: [],
        playedCards: [],
        signets: 0,
        tags: { tags: {} },
        hasPlayed: false,
        cardRevealed: false,
    };
}

/**
 * 获取对手 ID
 */
export function getOpponentId(core: CardiaCore, playerId: PlayerId): PlayerId {
    const playerIds = core.playerOrder;
    return playerIds.find(id => id !== playerId)!;
}

/**
 * 更新玩家状态（结构共享）
 */
export function updatePlayer(
    core: CardiaCore,
    playerId: PlayerId,
    patch: Partial<PlayerState>
): CardiaCore {
    const player = core.players[playerId];
    if (!player) return core;
    
    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: { ...player, ...patch },
        },
    };
}

/**
 * 获取玩家场上卡牌 UID 列表
 */
export function getPlayerFieldCards(core: CardiaCore, playerId: PlayerId): string[] {
    const player = core.players[playerId];
    if (!player) return [];
    
    return player.playedCards.map(card => card.uid);
}

/**
 * 计算卡牌当前影响力（基础影响力 + 所有修正标记）
 */
export function calculateCurrentInfluence(
    baseInfluence: number,
    modifiers: ModifierToken[]
): number {
    return modifiers.reduce((acc, mod) => acc + mod.value, baseInfluence);
}

/**
 * 统计玩家场上所有卡牌的印戒总和
 */
export function getTotalSignets(core: CardiaCore, playerId: PlayerId): number {
    const player = core.players[playerId];
    if (!player) return 0;
    
    return player.playedCards.reduce((total, card) => total + card.signets, 0);
}

/**
 * 根据 UID 查找场上卡牌
 */
export function findPlayedCard(core: CardiaCore, cardUid: string): PlayedCard | undefined {
    for (const player of Object.values(core.players)) {
        const card = player.playedCards.find(c => c.uid === cardUid);
        if (card) return card;
    }
    return undefined;
}

/**
 * 获取卡牌上的所有修正标记
 */
export function getCardModifiers(core: CardiaCore, cardUid: string): ModifierToken[] {
    return core.modifierTokens.filter(token => token.cardId === cardUid);
}

/**
 * 重新计算单张卡牌的当前影响力
 * 基于基础影响力和所有修正标记
 */
export function recalculateCardInfluence(
    card: PlayedCard,
    modifiers: ModifierToken[]
): number {
    return calculateCurrentInfluence(card.baseInfluence, modifiers);
}

/**
 * 重新判定遭遇结果
 * 考虑持续能力效果（强制平局、赢得平局）
 * 
 * @returns 获胜方 PlayerId 或 'tie'
 */
export function recalculateEncounterResult(
    core: CardiaCore,
    encounterIndex: number
): PlayerId | 'tie' {
    const player0 = core.playerOrder[0];
    const player1 = core.playerOrder[1];
    
    const player0State = core.players[player0];
    const player1State = core.players[player1];
    
    if (!player0State || !player1State) {
        throw new Error('Invalid player state');
    }
    
    // 获取该遭遇的卡牌
    const player0Card = player0State.playedCards[encounterIndex];
    const player1Card = player1State.playedCards[encounterIndex];
    
    if (!player0Card || !player1Card) {
        throw new Error(`No cards found for encounter ${encounterIndex}`);
    }
    
    // 重新计算影响力
    const player0Modifiers = getCardModifiers(core, player0Card.uid);
    const player1Modifiers = getCardModifiers(core, player1Card.uid);
    
    const player0Influence = recalculateCardInfluence(player0Card, player0Modifiers);
    const player1Influence = recalculateCardInfluence(player1Card, player1Modifiers);
    
    // 基础结果判定
    let result: PlayerId | 'tie';
    if (player0Influence > player1Influence) {
        result = player0;
    } else if (player1Influence > player0Influence) {
        result = player1;
    } else {
        result = 'tie';
    }
    
    // 应用持续能力效果
    // 1. 检查调停者（强制平局）
    const mediatorAbility = core.ongoingAbilities.find(
        ability => ability.abilityId === 'mediator' && ability.encounterIndex === encounterIndex
    );
    if (mediatorAbility) {
        result = 'tie';
    }
    
    // 2. 检查审判官（赢得所有平局）- 优先级高于调停者
    const magistrateAbility = core.ongoingAbilities.find(
        ability => ability.abilityId === 'magistrate'
    );
    if (magistrateAbility && result === 'tie') {
        result = magistrateAbility.playerId;
    }
    
    return result;
}

/**
 * 回溯所有受影响的遭遇，重新计算影响力和结果
 * 
 * @returns 需要移动印戒的遭遇列表 { encounterIndex, oldWinner, newWinner }
 */
export function recalculateAllEncounters(
    core: CardiaCore
): Array<{ encounterIndex: number; oldWinner: PlayerId | 'tie'; newWinner: PlayerId | 'tie' }> {
    const changes: Array<{ encounterIndex: number; oldWinner: PlayerId | 'tie'; newWinner: PlayerId | 'tie' }> = [];
    
    const player0 = core.playerOrder[0];
    const player1 = core.playerOrder[1];
    
    const player0State = core.players[player0];
    const player1State = core.players[player1];
    
    if (!player0State || !player1State) {
        return changes;
    }
    
    // 遍历所有已打出的卡牌（按遭遇索引）
    const encounterCount = Math.min(player0State.playedCards.length, player1State.playedCards.length);
    
    for (let i = 0; i < encounterCount; i++) {
        const player0Card = player0State.playedCards[i];
        const player1Card = player1State.playedCards[i];
        
        // 记录旧的获胜方
        const oldWinner = player0Card.signets > 0 ? player0 : player1Card.signets > 0 ? player1 : 'tie';
        
        // 重新计算结果
        const newWinner = recalculateEncounterResult(core, i);
        
        // 如果结果改变，记录变化
        if (oldWinner !== newWinner) {
            changes.push({ encounterIndex: i, oldWinner, newWinner });
        }
    }
    
    return changes;
}

/**
 * 移动印戒从一张卡牌到另一张卡牌
 * 
 * @returns 更新后的 core 状态
 */
export function moveSignet(
    core: CardiaCore,
    fromCardUid: string,
    toCardUid: string
): CardiaCore {
    const player0 = core.playerOrder[0];
    const player1 = core.playerOrder[1];
    
    const player0State = core.players[player0];
    const player1State = core.players[player1];
    
    if (!player0State || !player1State) {
        return core;
    }
    
    // 更新 player0 的卡牌
    const updatedPlayer0Cards = player0State.playedCards.map(card => {
        if (card.uid === fromCardUid && card.signets > 0) {
            return { ...card, signets: card.signets - 1 };
        }
        if (card.uid === toCardUid) {
            return { ...card, signets: card.signets + 1 };
        }
        return card;
    });
    
    // 更新 player1 的卡牌
    const updatedPlayer1Cards = player1State.playedCards.map(card => {
        if (card.uid === fromCardUid && card.signets > 0) {
            return { ...card, signets: card.signets - 1 };
        }
        if (card.uid === toCardUid) {
            return { ...card, signets: card.signets + 1 };
        }
        return card;
    });
    
    return {
        ...core,
        players: {
            ...core.players,
            [player0]: {
                ...player0State,
                playedCards: updatedPlayer0Cards,
            },
            [player1]: {
                ...player1State,
                playedCards: updatedPlayer1Cards,
            },
        },
    };
}

/**
 * 执行完整的状态回溯流程
 * 
 * 当修正标记或持续能力被移除时，需要回溯所有受影响的遭遇：
 * 1. 重新计算所有遭遇的影响力和结果
 * 2. 移动印戒到正确位置
 * 3. 不触发新失败卡牌的能力（由调用方控制）
 * 
 * @returns 更新后的 core 状态和需要发射的事件列表
 */
export function performStateBacktrack(
    core: CardiaCore
): {
    core: CardiaCore;
    events: Array<{
        type: 'CARD_INFLUENCE_MODIFIED' | 'ENCOUNTER_RESULT_CHANGED' | 'SIGNET_MOVED';
        payload: any;
    }>;
} {
    const events: Array<{
        type: 'CARD_INFLUENCE_MODIFIED' | 'ENCOUNTER_RESULT_CHANGED' | 'SIGNET_MOVED';
        payload: any;
    }> = [];
    
    let updatedCore = core;
    
    const player0 = core.playerOrder[0];
    const player1 = core.playerOrder[1];
    
    const player0State = core.players[player0];
    const player1State = core.players[player1];
    
    if (!player0State || !player1State) {
        return { core: updatedCore, events };
    }
    
    // 1. 重新计算所有卡牌的影响力
    const updatedPlayer0Cards = player0State.playedCards.map(card => {
        const modifiers = getCardModifiers(core, card.uid);
        const newInfluence = recalculateCardInfluence(card, modifiers);
        
        if (newInfluence !== card.baseInfluence) {
            events.push({
                type: 'CARD_INFLUENCE_MODIFIED',
                payload: {
                    cardId: card.uid,
                    oldInfluence: card.baseInfluence,
                    newInfluence,
                },
            });
        }
        
        return card;  // 注意：影响力不存储在 PlayedCard 上，而是通过 modifiers 计算
    });
    
    const updatedPlayer1Cards = player1State.playedCards.map(card => {
        const modifiers = getCardModifiers(core, card.uid);
        const newInfluence = recalculateCardInfluence(card, modifiers);
        
        if (newInfluence !== card.baseInfluence) {
            events.push({
                type: 'CARD_INFLUENCE_MODIFIED',
                payload: {
                    cardId: card.uid,
                    oldInfluence: card.baseInfluence,
                    newInfluence,
                },
            });
        }
        
        return card;
    });
    
    // 2. 重新判定所有遭遇结果并移动印戒
    const encounterChanges = recalculateAllEncounters(updatedCore);
    
    for (const change of encounterChanges) {
        const { encounterIndex, oldWinner, newWinner } = change;
        
        // 发射遭遇结果改变事件
        events.push({
            type: 'ENCOUNTER_RESULT_CHANGED',
            payload: {
                slotIndex: encounterIndex,
                previousWinner: oldWinner,
                newWinner,
                reason: 'state_backtrack',
            },
        });
        
        // 移动印戒
        if (oldWinner !== 'tie' && newWinner !== 'tie' && oldWinner !== newWinner) {
            const oldWinnerCard = oldWinner === player0 
                ? player0State.playedCards[encounterIndex]
                : player1State.playedCards[encounterIndex];
            const newWinnerCard = newWinner === player0
                ? player0State.playedCards[encounterIndex]
                : player1State.playedCards[encounterIndex];
            
            if (oldWinnerCard && newWinnerCard) {
                updatedCore = moveSignet(updatedCore, oldWinnerCard.uid, newWinnerCard.uid);
                
                events.push({
                    type: 'SIGNET_MOVED',
                    payload: {
                        fromCardId: oldWinnerCard.uid,
                        toCardId: newWinnerCard.uid,
                        slotIndex: encounterIndex,
                    },
                });
            }
        } else if (oldWinner === 'tie' && newWinner !== 'tie') {
            // 从平局变为有获胜方：添加印戒
            const newWinnerCard = newWinner === player0
                ? player0State.playedCards[encounterIndex]
                : player1State.playedCards[encounterIndex];
            
            if (newWinnerCard) {
                // 直接更新卡牌的印戒数量
                const updatedPlayer0Cards2 = updatedCore.players[player0].playedCards.map(card =>
                    card.uid === newWinnerCard.uid ? { ...card, signets: card.signets + 1 } : card
                );
                const updatedPlayer1Cards2 = updatedCore.players[player1].playedCards.map(card =>
                    card.uid === newWinnerCard.uid ? { ...card, signets: card.signets + 1 } : card
                );
                
                updatedCore = {
                    ...updatedCore,
                    players: {
                        ...updatedCore.players,
                        [player0]: {
                            ...updatedCore.players[player0],
                            playedCards: updatedPlayer0Cards2,
                        },
                        [player1]: {
                            ...updatedCore.players[player1],
                            playedCards: updatedPlayer1Cards2,
                        },
                    },
                };
            }
        } else if (oldWinner !== 'tie' && newWinner === 'tie') {
            // 从有获胜方变为平局：移除印戒
            const oldWinnerCard = oldWinner === player0
                ? player0State.playedCards[encounterIndex]
                : player1State.playedCards[encounterIndex];
            
            if (oldWinnerCard) {
                // 直接更新卡牌的印戒数量
                const updatedPlayer0Cards2 = updatedCore.players[player0].playedCards.map(card =>
                    card.uid === oldWinnerCard.uid && card.signets > 0 ? { ...card, signets: card.signets - 1 } : card
                );
                const updatedPlayer1Cards2 = updatedCore.players[player1].playedCards.map(card =>
                    card.uid === oldWinnerCard.uid && card.signets > 0 ? { ...card, signets: card.signets - 1 } : card
                );
                
                updatedCore = {
                    ...updatedCore,
                    players: {
                        ...updatedCore.players,
                        [player0]: {
                            ...updatedCore.players[player0],
                            playedCards: updatedPlayer0Cards2,
                        },
                        [player1]: {
                            ...updatedCore.players[player1],
                            playedCards: updatedPlayer1Cards2,
                        },
                    },
                };
            }
        }
    }
    
    return { core: updatedCore, events };
}

/**
 * 检查标准胜利条件（印戒总和≥5）
 * 
 * @returns 获胜玩家 ID，如果没有玩家获胜则返回 null
 */
export function checkStandardVictoryCondition(
    core: CardiaCore
): PlayerId | null {
    const player0 = core.playerOrder[0];
    const player1 = core.playerOrder[1];
    
    const player0Signets = getTotalSignets(core, player0);
    const player1Signets = getTotalSignets(core, player1);
    
    const targetSignets = core.targetSignets || 5;
    
    // 检查是否有玩家达到目标印戒数
    const player0Wins = player0Signets >= targetSignets;
    const player1Wins = player1Signets >= targetSignets;
    
    // 如果双方都达到目标且印戒数相等，继续游戏
    if (player0Wins && player1Wins && player0Signets === player1Signets) {
        return null;
    }
    
    // 如果双方都达到目标但印戒数不等，印戒多的玩家获胜
    if (player0Wins && player1Wins) {
        return player0Signets > player1Signets ? player0 : player1;
    }
    
    // 如果只有一方达到目标，该玩家获胜
    if (player0Wins) return player0;
    if (player1Wins) return player1;
    
    return null;
}

/**
 * 检查特殊胜利条件
 * 
 * @returns 获胜玩家 ID 和胜利原因，如果没有特殊胜利则返回 null
 */
export function checkSpecialVictoryCondition(
    core: CardiaCore
): { winner: PlayerId; reason: string } | null {
    // 1. 检查机械精灵条件胜利
    if (core.mechanicalSpiritActive) {
        const { playerId } = core.mechanicalSpiritActive;
        // 机械精灵的条件胜利在遭遇结算时检查，这里只是辅助函数
        // 实际触发在 execute.ts 的 resolveEncounter 中
    }
    
    // 2. 检查精灵直接胜利（已在能力执行时触发 GAME_WON 事件）
    
    // 3. 检查对手无法出牌
    const player0 = core.playerOrder[0];
    const player1 = core.playerOrder[1];
    
    const player0State = core.players[player0];
    const player1State = core.players[player1];
    
    if (!player0State || !player1State) {
        return null;
    }
    
    // 如果对手手牌和牌库都为空，当前玩家获胜
    const player0CanPlay = player0State.hand.length > 0 || player0State.deck.length > 0;
    const player1CanPlay = player1State.hand.length > 0 || player1State.deck.length > 0;
    
    if (!player0CanPlay && player1CanPlay) {
        return { winner: player1, reason: 'opponent_cannot_play' };
    }
    
    if (!player1CanPlay && player0CanPlay) {
        return { winner: player0, reason: 'opponent_cannot_play' };
    }
    
    return null;
}

/**
 * 检查所有胜利条件
 * 
 * @returns 获胜玩家 ID 和胜利原因，如果没有玩家获胜则返回 null
 */
export function checkVictoryConditions(
    core: CardiaCore
): { winner: PlayerId; reason: string } | null {
    // 1. 检查特殊胜利条件（优先级最高）
    const specialVictory = checkSpecialVictoryCondition(core);
    if (specialVictory) {
        return specialVictory;
    }
    
    // 2. 检查标准胜利条件（印戒总和≥5）
    const standardWinner = checkStandardVictoryCondition(core);
    if (standardWinner) {
        return { winner: standardWinner, reason: 'standard_victory' };
    }
    
    return null;
}
