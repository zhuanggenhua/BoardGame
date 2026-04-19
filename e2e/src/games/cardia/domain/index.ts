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
     * 规则优先级：
     * 1. 直接胜利标记（如特殊能力已明确宣告胜利）
     * 2. 标准印戒胜利条件（任意阶段立即生效）
     * 3. 分阶段特殊判定（如 play 阶段无牌可打、ability 阶段特殊能力胜利）
     */
    isGameOver: (core): GameOverResult | undefined => {
        // 优先检查直接胜利标记（精灵能力等）
        if (core.gameWonBy) {
            return {
                winner: core.gameWonBy,
            };
        }
        
        const getTotalSignets = (player: PlayerState) => {
            return player.playedCards.reduce((sum: number, card: PlayedCard) => sum + card.signets, 0);
        };

        const signetsCount: Record<PlayerId, number> = {};
        for (const playerId of core.playerOrder) {
            const player = core.players[playerId];
            signetsCount[playerId] = getTotalSignets(player);
        }

        // PR 新规则：标准印戒胜利条件在所有阶段立即生效
        const playersWithEnoughSignets = core.playerOrder.filter(
            pid => signetsCount[pid] >= core.targetSignets
        );

        if (playersWithEnoughSignets.length > 0) {
            if (playersWithEnoughSignets.length > 1) {
                const maxSignets = Math.max(...playersWithEnoughSignets.map(pid => signetsCount[pid]));
                const winnersWithMaxSignets = playersWithEnoughSignets.filter(
                    pid => signetsCount[pid] === maxSignets
                );

                if (winnersWithMaxSignets.length > 1) {
                    return { draw: true };
                }
                return { winner: winnersWithMaxSignets[0] };
            }
            return { winner: playersWithEnoughSignets[0] };
        }
        
        // play 阶段：检查无牌可打的胜利条件
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
            
            return undefined;
        }
        
        // ability 阶段：检查特殊胜利条件（能力引发的胜利）
        if (core.phase === 'ability') {
            for (const playerId of core.playerOrder) {
                const totalSignets = signetsCount[playerId];
                
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
                    if (core.previousEncounter && core.previousEncounter.winnerId === playerId) {
                        return {
                            winner: playerId,
                        };
                    }
                }
            }
            
            return undefined;
        }
        
        // end 阶段或其他阶段：没有额外胜利条件
        return undefined;
    },
};

export default CardiaDomain;

