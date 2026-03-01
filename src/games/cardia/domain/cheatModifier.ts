/**
 * Cardia CheatModifier
 * 调试作弊命令，用于测试和开发
 */

import type { CheatModifier } from '../../../engine/systems/CheatSystem';
import type { CardiaCore, GamePhase, CardInstance } from './core-types';
import { updatePlayer } from './utils';

/**
 * Cardia 作弊修改器
 */
export const cardiaCheatModifier: CheatModifier<CardiaCore> = {
    /**
     * 设置游戏阶段
     */
    setPhase: (core, phase: string) => {
        return {
            ...core,
            phase: phase as GamePhase,
        };
    },
    
    /**
     * 设置当前玩家
     */
    setCurrentPlayer: (core, playerId: string) => {
        if (!core.players[playerId]) {
            return core;
        }
        
        return {
            ...core,
            currentPlayerId: playerId,
        };
    },
    
    /**
     * 设置玩家印戒数量
     */
    setSignets: (core, playerId: string, signets: number) => {
        if (!core.players[playerId]) {
            return core;
        }
        
        return updatePlayer(core, playerId, {
            signets: Math.max(0, signets),
        });
    },
    
    /**
     * 添加卡牌到手牌
     */
    addCardToHand: (core, playerId: string, cardDefId: string) => {
        if (!core.players[playerId]) {
            return core;
        }
        
        const player = core.players[playerId];
        
        // TODO: 从 cardRegistry 创建卡牌实例
        // 这里需要实现 createCardInstance 的完整逻辑
        
        return core;
    },
    
    /**
     * 清空手牌
     */
    clearHand: (core, playerId: string) => {
        if (!core.players[playerId]) {
            return core;
        }
        
        return updatePlayer(core, playerId, {
            hand: [],
        });
    },
    
    /**
     * 设置牌库
     */
    setDeck: (core, playerId: string, cardDefIds: string[]) => {
        if (!core.players[playerId]) {
            return core;
        }
        
        // TODO: 从 cardRegistry 创建卡牌实例列表
        
        return core;
    },
    
    /**
     * 强制结束游戏
     */
    forceGameOver: (core, winnerId?: string) => {
        if (winnerId && !core.players[winnerId]) {
            return core;
        }
        
        // 设置足够的印戒数量来触发游戏结束
        if (winnerId) {
            return updatePlayer(core, winnerId, {
                signets: core.targetSignets,
            });
        }
        
        return core;
    },
};

export default cardiaCheatModifier;
