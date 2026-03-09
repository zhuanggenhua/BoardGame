import type { DomainCore, PlayerId, RandomFn, GameOverResult } from '../../../engine/types';
import type { CardiaCore, CardiaCommand, CardiaEvent, PlayerState, PlayedCard } from './types';
import { ABILITY_IDS } from './ids';
import { createPlayerState } from './utils';
import { createInitialDeck, drawCards } from './setupDeck';
import validate from './validate';
import execute from './execute';
import reduce from './reduce';

// 导出注册表
export { default as abilityRegistry } from './abilityRegistry';
export { default as cardRegistry, getCardsByDeckVariant, getCardsByFaction, getCardByInfluence } from './cardRegistry';
export { default as locationRegistry } from './locationRegistry';
export * from './ids';
export * from './abilityRegistry';
export * from './cardRegistry';
export * from './locationRegistry';

/**
 * 卡迪亚领域内核
 */
export const CardiaDomain: DomainCore<CardiaCore, CardiaCommand, CardiaEvent> = {
    gameId: 'cardia',
    
    /**
     * 初始化游戏状态
     */
    setup: (playerIds: PlayerId[], random: RandomFn, setupData?: any): CardiaCore => {
        // 从 setupData 读取牌组选择，默认使用 I 牌组
        const deckVariant = (setupData?.deckVariant as 'I' | 'II') || 'I';
        
        // 为每个玩家创建初始状态
        const players: Record<PlayerId, PlayerState> = {};
        
        for (const playerId of playerIds) {
            // 创建初始牌库（16张卡牌，已洗牌）
            const deck = createInitialDeck(playerId, deckVariant, random);
            
            // 抽取初始手牌（5张）
            const { drawn: initialHand, remaining: remainingDeck } = drawCards(deck, 5);
            
            // 创建玩家状态
            const playerState = createPlayerState(playerId);
            playerState.hand = initialHand;
            playerState.deck = remainingDeck;
            
            players[playerId] = playerState;
        }
        
        return {
            players,
            playerOrder: [playerIds[0], playerIds[1]],
            currentPlayerId: playerIds[0],
            turnNumber: 1,
            phase: 'play',
            encounterHistory: [],
            deckVariant,
            targetSignets: 5,  // 默认目标5个印戒
            
            // 能力系统状态
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            
            // 特殊状态标记
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
    },
    
    /**
     * 命令校验
     */
    validate,
    
    /**
     * 命令执行
     */
    execute,
    
    /**
     * 事件应用到状态
     */
    reduce,
    
    /**
     * 游戏结束判定
     * 
     * ⚠️ 重要：不同胜利条件在不同阶段检查
     * - 阶段1（play）：无牌可打胜利条件
     * - 阶段2（ability）：特殊胜利条件（精灵、机械精灵等能力引发的胜利）
     * - 阶段3（end）：标准印戒胜利条件
     */
    isGameOver: (core): GameOverResult | undefined => {
        // 优先检查直接胜利标记（精灵能力等）
        if (core.gameWonBy) {
            return {
                winner: core.gameWonBy,
            };
        }
        
        // 导入 getTotalSignets 辅助函数
        const getTotalSignets = (player: PlayerState) => {
            return player.playedCards.reduce((sum: number, card: PlayedCard) => sum + card.signets, 0);
        };
        
        // ⚠️ 阶段1（打出卡牌）：检查无牌可打的胜利条件
        if (core.phase === 'play') {
            const playersWithoutCards = core.playerOrder.filter(playerId => {
                const player = core.players[playerId];
                return player.hand.length === 0 && player.deck.length === 0;
            });
            
            // 如果只有一方无法出牌，对手获胜
            if (playersWithoutCards.length === 1) {
                const loser = playersWithoutCards[0];
                const winner = core.playerOrder.find(pid => pid !== loser)!;
                return { winner };
            }
            
            // 如果双方都无法出牌，比较印戒数量
            if (playersWithoutCards.length === 2) {
                const signetsCount: Record<PlayerId, number> = {};
                for (const playerId of core.playerOrder) {
                    const player = core.players[playerId];
                    signetsCount[playerId] = getTotalSignets(player);
                }
                
                const p1Signets = signetsCount[core.playerOrder[0]];
                const p2Signets = signetsCount[core.playerOrder[1]];
                
                if (p1Signets > p2Signets) {
                    return { winner: core.playerOrder[0] };
                } else if (p2Signets > p1Signets) {
                    return { winner: core.playerOrder[1] };
                } else {
                    return { draw: true };
                }
            }
            
            // play 阶段其他情况不触发胜利
            return undefined;
        }
        
        // ⚠️ 阶段2（能力阶段）：检查特殊胜利条件（能力引发的胜利）
        if (core.phase === 'ability') {
            for (const playerId of core.playerOrder) {
                const player = core.players[playerId];
                const totalSignets = getTotalSignets(player);
                
                // 精灵能力：如果激活了精灵能力且有5个印戒，立即获胜
                const hasElfAbility = core.ongoingAbilities.some(
                    a => a.abilityId === ABILITY_IDS.ELF && a.playerId === playerId
                );
                if (hasElfAbility && totalSignets >= 5) {
                    return {
                        winner: playerId,
                    };
                }
                
                // 机械精灵能力：如果激活了机械精灵且在当前遭遇中获胜，立即获胜
                if (core.mechanicalSpiritActive && core.mechanicalSpiritActive.playerId === playerId) {
                    // 检查最近一次遭遇是否该玩家获胜
                    if (core.previousEncounter && core.previousEncounter.winnerId === playerId) {
                        return {
                            winner: playerId,
                        };
                    }
                }
            }
            
            // ability 阶段没有特殊胜利条件触发，游戏继续
            return undefined;
        }
        
        // ⚠️ 阶段3（回合结束阶段）：检查标准印戒胜利条件
        if (core.phase !== 'end') {
            // 非 play、ability、end 阶段，不触发任何胜利条件
            return undefined;
        }
        
        // 阶段3（回合结束阶段）：检查标准印戒胜利条件
        const signetsCount: Record<PlayerId, number> = {};
        for (const playerId of core.playerOrder) {
            const player = core.players[playerId];
            signetsCount[playerId] = getTotalSignets(player);
        }
        
        // 找出所有达到目标印戒数的玩家
        const playersWithEnoughSignets = core.playerOrder.filter(
            pid => signetsCount[pid] >= core.targetSignets
        );
        
        if (playersWithEnoughSignets.length > 0) {
            // 如果多个玩家同时达到目标，比较印戒数量
            if (playersWithEnoughSignets.length > 1) {
                const maxSignets = Math.max(...playersWithEnoughSignets.map(pid => signetsCount[pid]));
                const winnersWithMaxSignets = playersWithEnoughSignets.filter(
                    pid => signetsCount[pid] === maxSignets
                );
                
                // 如果有多个玩家拥有相同的最高印戒数，判定为平局
                if (winnersWithMaxSignets.length > 1) {
                    return { draw: true };
                }
                // 只有一个玩家拥有最高印戒数，该玩家获胜
                return { winner: winnersWithMaxSignets[0] };
            }
            // 只有一个玩家达到目标，该玩家获胜
            return { winner: playersWithEnoughSignets[0] };
        }
        
        // end 阶段没有达到印戒胜利条件，游戏继续
        return undefined;
    },
};

export default CardiaDomain;

