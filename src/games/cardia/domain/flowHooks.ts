/**
 * Cardia FlowHooks
 * 定义回合流程和阶段转换逻辑
 */

import type { FlowHooks } from '../../../engine/systems/FlowSystem';
import type { CardiaCore, GamePhase } from './core-types';
import type { CardiaEvent } from './events';
import { PHASE_ORDER } from './core-types';
import { CARDIA_EVENTS } from './events';
import { ABILITY_IDS } from './ids';

/**
 * Cardia 回合流程钩子
 */
export const cardiaFlowHooks: FlowHooks<CardiaCore> = {
    /**
     * 初始阶段
     */
    initialPhase: 'play',
    
    /**
     * 获取下一个阶段
     */
    getNextPhase: ({ from, state }) => {
        const currentPhase = state.core.phase;
        
        // 阶段循环：play → ability → end → play
        switch (currentPhase) {
            case 'play':
                // 当双方都打出卡牌后，进入能力阶段
                // 这个转换由 execute 中的 PLAY_CARD 命令触发
                return 'ability';
            
            case 'ability':
                // 能力阶段结束后，进入回合结束阶段
                // 这个转换由 ACTIVATE_ABILITY 或 SKIP_ABILITY 命令触发
                return 'end';
            
            case 'end':
                // 回合结束后，回到打出卡牌阶段
                // 这个转换由 END_TURN 命令触发
                return 'play';
            
            default:
                return 'play';
        }
    },
    
    /**
     * 获取当前活跃玩家ID
     */
    getActivePlayerId: ({ state }) => {
        const { core } = state;
        
        // 在能力阶段，只有失败者可以操作
        if (core.phase === 'ability' && core.currentEncounter) {
            return core.currentEncounter.loserId || core.currentPlayerId;
        }
        
        // 在其他阶段，当前玩家可以操作
        return core.currentPlayerId;
    },
    
    /**
     * 阶段进入时的钩子（可选）
     */
    onPhaseEnter: ({ phase, state }) => {
        const events: CardiaEvent[] = [];
        const timestamp = Date.now();
        
        // 回合开始时：触发持续效果
        if (phase === 'play') {
            for (const playerId of state.core.playerOrder) {
                const player = state.core.players[playerId];
                
                // 大法师：每回合抽1张
                if (player.tags.tags[`Ongoing.${ABILITY_IDS.ARCHMAGE}`]) {
                    events.push({
                        type: CARDIA_EVENTS.CARD_DRAWN,
                        timestamp,
                        payload: {
                            playerId,
                            count: 1,
                        },
                    });
                }
                
                // 顾问：如果上一次遭遇你获胜且对手失败，你获得1个印戒
                if (player.tags.tags[`Ongoing.${ABILITY_IDS.ADVISOR}`]) {
                    const prev = state.core.previousEncounter;
                    if (prev && prev.winnerId === playerId && prev.loserId) {
                        // 上一次遭遇该玩家获胜且对手失败（不是平局）
                        events.push({
                            type: CARDIA_EVENTS.SIGNET_GRANTED,
                            timestamp,
                            payload: {
                                playerId,
                                cardUid: player.currentCard?.uid || '',  // 印戒放在当前卡牌上
                                newTotal: player.signets + 1,
                            },
                        });
                    }
                }
            }
        }
        
        return events;
    },
    
    /**
     * 阶段退出时的钩子（可选）
     */
    onPhaseExit: ({ phase, state }) => {
        // 可以在这里添加阶段退出时的逻辑
        // 例如：清理临时状态
        return [];
    },
};

export default cardiaFlowHooks;
