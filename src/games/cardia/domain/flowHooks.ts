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
import { getOpponentId } from './utils';

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
        const currentPhase = state.sys.phase;  // 从 sys.phase 读取（FlowSystem 管理）
        
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
        const { core, sys } = state;
        
        // 在能力阶段，只有失败者可以操作
        if (sys.phase === 'ability' && core.currentEncounter) {
            return core.currentEncounter.loserId || core.currentPlayerId;
        }
        
        // 在其他阶段，当前玩家可以操作
        return core.currentPlayerId;
    },
    
    /**
     * 阶段进入时的钩子（可选）
     */
    onPhaseEnter: ({ to, state }) => {
        const events: CardiaEvent[] = [];
        const timestamp = Date.now();
        
        // 回合开始时：触发持续效果
        if (to === 'play') {
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
        
        // 回合结束时：抽牌
        if (to === 'end') {
            console.log('[CardiaFlowHooks] onPhaseEnter: end phase - drawing cards');
            
            // 两个玩家各抽 1 张
            for (const pid of Object.keys(state.core.players)) {
                const player = state.core.players[pid];
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
            
            // 发射回合结束事件
            events.push({
                type: CARDIA_EVENTS.TURN_ENDED,
                timestamp,
                payload: {
                    playerId: state.core.currentPlayerId,
                    turnNumber: state.core.turnNumber,
                },
            });
        }
        
        return events;
    },
    
    /**
     * 阶段退出时的钩子（可选）
     */
    onPhaseExit: ({ from, state }) => {
        // 可以在这里添加阶段退出时的逻辑
        // 例如：清理临时状态
        return [];
    },
    
    /**
     * 自动推进检查
     * 
     * 在以下情况自动推进阶段：
     * 1. play 阶段：遭遇战已解析（currentEncounter 存在）且有失败者，推进到 ability 阶段
     * 2. ability 阶段：刚进入该阶段、交互完成或跳过能力时，推进到 end 阶段
     * 
     * 设计原则（参考 DiceThrone 最佳实践）：
     * - 不依赖领域事件（ENCOUNTER_RESOLVED 等），因为 afterEventsRound > 0 时 events 可能为空
     * - 使用系统事件（SYS_PHASE_CHANGED、SYS_INTERACTION_RESOLVED）作为可靠信号
     * - 检查 state 中的状态标志（core.currentEncounter.loserId、sys.interaction.current）
     */
    onAutoContinueCheck: ({ state, events }) => {
        const { core, sys } = state;
        
        console.log('[CardiaFlowHooks] onAutoContinueCheck called', {
            corePhase: core.phase,
            sysPhase: sys.phase,
            hasCurrentInteraction: !!sys.interaction?.current,
            hasQueuedInteractions: sys.interaction?.queue?.length || 0,
            eventsCount: events.length,
            eventTypes: events.map(e => e.type),
            currentEncounter: core.currentEncounter,
        });
        
        // 检查是否有交互正在进行
        const hasCurrentInteraction = !!sys.interaction?.current;
        const hasQueuedInteractions = (sys.interaction?.queue?.length || 0) > 0;
        
        // 如果还有交互未完成，不自动推进
        if (hasCurrentInteraction || hasQueuedInteractions) {
            console.log('[CardiaFlowHooks] Interactions pending, skipping auto-continue');
            return;
        }
        
        // 情况1：play 阶段 → ability 阶段
        // 条件：遭遇战已解析（currentEncounter 存在）且有失败者
        // 不依赖 events 数组，直接检查 state
        if (sys.phase === 'play' && core.currentEncounter && core.currentEncounter.loserId) {
            console.log('[CardiaFlowHooks] ✅ Encounter resolved with loser, advancing to ability phase', {
                loserId: core.currentEncounter.loserId,
            });
            return {
                autoContinue: true,
                playerId: core.currentEncounter.loserId,
            };
        }
        
        // 情况2：ability 阶段 → end 阶段
        // 条件：交互完成、跳过能力、或即时能力执行完成（无交互）
        // 使用系统事件（SYS_INTERACTION_RESOLVED）而不是领域事件
        // 
        // ⚠️ 重要：不能在"刚进入 ability 阶段"时就自动推进，因为此时能力交互还未创建
        // 必须等待交互完成（interactionJustResolved）、玩家跳过（abilitySkipped）、或即时能力执行完成（abilityActivatedWithoutInteraction）
        // 
        // ⚠️ 修复：当交互刚解决时，需要检查是否有新的交互在队列中
        // 如果有新交互，说明交互处理器返回了后续交互（如 Court Guard 的第二步），不应该自动推进
        if (sys.phase === 'ability') {
            console.log('[CardiaFlowHooks] Checking ability → end transition');
            
            // 检查交互是否刚解决
            const interactionJustResolved = events.some(e => e.type === 'SYS_INTERACTION_RESOLVED');
            
            // 或者检查是否跳过了能力
            const abilitySkipped = events.some(e => e.type === CARDIA_EVENTS.ABILITY_SKIPPED);
            
            // 或者检查是否有即时能力被激活（无交互请求）
            // 即时能力：ABILITY_ACTIVATED 事件存在，但没有 ABILITY_INTERACTION_REQUESTED 事件
            const abilityActivated = events.some(e => e.type === CARDIA_EVENTS.ABILITY_ACTIVATED);
            const interactionRequested = events.some(e => e.type === CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED);
            const abilityActivatedWithoutInteraction = abilityActivated && !interactionRequested;
            
            console.log('[CardiaFlowHooks] ability phase checks:', {
                interactionJustResolved,
                abilitySkipped,
                abilityActivated,
                interactionRequested,
                abilityActivatedWithoutInteraction,
                hasCurrentInteraction,
                hasQueuedInteractions,
            });
            
            // ✅ 修复：当交互刚解决时，检查是否有新的交互（在 current 或 queue 中）
            // 如果有新交互，说明交互处理器返回了后续交互（如 Court Guard 的第二步），不应该自动推进
            if (interactionJustResolved && (hasCurrentInteraction || hasQueuedInteractions)) {
                console.log('[CardiaFlowHooks] ⚠️  Interaction just resolved but new interactions exist (current or queued), waiting for them to complete');
                return;  // 不自动推进，等待新交互完成
            }
            
            if (interactionJustResolved || abilitySkipped || abilityActivatedWithoutInteraction) {
                const activePlayerId = core.currentEncounter?.loserId || core.currentPlayerId;
                
                let reason = 'unknown';
                if (interactionJustResolved) reason = 'interactionJustResolved';
                else if (abilitySkipped) reason = 'abilitySkipped';
                else if (abilityActivatedWithoutInteraction) reason = 'abilityActivatedWithoutInteraction';
                
                console.log('[CardiaFlowHooks] ✅ Auto-continue: advancing to end phase', {
                    activePlayerId,
                    reason,
                });
                
                return {
                    autoContinue: true,
                    playerId: activePlayerId,
                };
            }
        }
        
        // 情况3：end 阶段 → play 阶段
        // 条件：TURN_ENDED 事件已处理（不依赖 SYS_PHASE_CHANGED）
        // end 阶段的逻辑（抽牌等）由 onPhaseEnter 自动处理并发射 TURN_ENDED 事件
        // 当 TURN_ENDED 事件出现在 events 中时，说明回合清理已完成，可以推进到下一回合
        if (sys.phase === 'end') {
            // 检测是否有 TURN_ENDED 事件
            const turnEnded = events.some(e => e.type === CARDIA_EVENTS.TURN_ENDED);
            
            console.log('[CardiaFlowHooks] Checking end → play transition', {
                turnEnded,
                eventsCount: events.length,
                eventTypes: events.map(e => e.type),
            });
            
            if (turnEnded) {
                // 获取下一回合的玩家ID（当前玩家的对手）
                const nextPlayerId = getOpponentId(core, core.currentPlayerId);
                
                console.log('[CardiaFlowHooks] ✅ Auto-continue: advancing from end to play phase', {
                    currentPlayerId: core.currentPlayerId,
                    nextPlayerId,
                });
                
                return {
                    autoContinue: true,
                    playerId: nextPlayerId,
                };
            }
        }
        
        console.log('[CardiaFlowHooks] ❌ No auto-continue condition met, phase:', sys.phase);
    },
};

export default cardiaFlowHooks;
