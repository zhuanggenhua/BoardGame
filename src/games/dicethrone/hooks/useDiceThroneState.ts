/**
 * DiceThrone 状态访问 Hook
 * 提供统一的状态访问接口（新版引擎）
 * 
 * 注意：阶段信息从 sys.phase 读取（单一权威），通过 FlowSystem 同步
 */

import { useMemo } from 'react';
import type { PlayerId, MatchState, PromptState, ResponseWindowState } from '../../../engine/types';
import type { HeroState, Die, TurnPhase, PendingAttack } from '../types';
import type { DiceThroneCore } from '../domain';
import { getAvailableAbilityIds } from '../domain/rules';

// ============================================================================
// 类型定义
// ============================================================================

type EngineState = MatchState<DiceThroneCore>;

// ============================================================================
// 焦点玩家计算
// ============================================================================

/**
 * 获取当前焦点玩家 ID
 * 
 * 焦点玩家 = 当前应该操作的玩家，优先级从高到低：
 * 1. 响应窗口的当前响应者
 * 2. Token 响应的响应者
 * 3. 交互（骰子修改等）的所有者
 * 4. Prompt（选择）的目标玩家
 * 5. 防御阶段的防御方（掷骰者）
 * 6. 回合主动玩家
 */
export function getFocusPlayerId(state: EngineState): PlayerId {
    const { core, sys } = state;
    const turnPhase = (sys.phase ?? core.turnPhase) as TurnPhase;
    
    // 1. 响应窗口的当前响应者
    if (sys.responseWindow?.current) {
        const rw = sys.responseWindow.current;
        return rw.responderQueue[rw.currentResponderIndex];
    }
    
    // 2. Token 响应的响应者
    if (core.pendingDamage) {
        return core.pendingDamage.responderId;
    }
    
    // 3. 交互（骰子修改等）的所有者
    if (core.pendingInteraction) {
        return core.pendingInteraction.playerId;
    }
    
    // 4. Prompt（选择）的目标玩家
    if (sys.prompt.current) {
        return sys.prompt.current.playerId;
    }
    
    // 5. 防御阶段的防御方（掷骰者）
    if (turnPhase === 'defensiveRoll' && core.pendingAttack) {
        return core.pendingAttack.defenderId;
    }
    
    // 6. 默认：回合主动玩家
    return core.activePlayerId;
}

// ============================================================================
// 统一状态访问接口
// ============================================================================

export interface DiceThroneStateAccess {
    // 玩家数据
    players: Record<PlayerId, HeroState>;
    getPlayer: (playerId: PlayerId) => HeroState | undefined;
    
    // 骰子
    dice: Die[];
    rollCount: number;
    rollLimit: number;
    rollDiceCount: number;
    rollConfirmed: boolean;
    
    // 阶段与回合
    turnPhase: TurnPhase;
    activePlayerId: PlayerId;
    turnNumber: number;
    
    // 焦点玩家（当前应该操作的玩家）
    focusPlayerId: PlayerId;
    
    // 攻击状态
    pendingAttack: PendingAttack | null;
    availableAbilityIds: string[];
    activatingAbilityId?: string;
    lastEffectSourceByPlayerId?: Record<PlayerId, string | undefined>;
    
    // 选择/提示
    prompt: PromptState['current'] | undefined;
    
    // 响应窗口
    responseWindow: ResponseWindowState['current'] | undefined;
    
    // 撤销
    lastSoldCardId?: string;
    
    // 系统状态（仅新版有效）
    sys: EngineState['sys'];
    
    // 原始状态访问
    raw: EngineState;
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 使用 DiceThrone 状态访问接口
 */
export function useDiceThroneState(G: EngineState): DiceThroneStateAccess {
    return useMemo(() => {
        const { core, sys } = G;
        
        // 从 sys.phase 读取阶段（单一权威），回退到 core.turnPhase
        const turnPhase = (sys.phase ?? core.turnPhase) as TurnPhase;
        
        // 计算焦点玩家（统一的操作权判断）
        const focusPlayerId = getFocusPlayerId(G);
        
        // 实时计算可用技能（派生状态，不再存储在 core 中）
        const isRollPhase = turnPhase === 'offensiveRoll' || turnPhase === 'defensiveRoll';
        const rollerId = turnPhase === 'defensiveRoll' && core.pendingAttack
            ? core.pendingAttack.defenderId
            : core.activePlayerId;
        const availableAbilityIds = isRollPhase
            ? getAvailableAbilityIds(core, rollerId)
            : [];
        
        return {
            players: core.players,
            getPlayer: (playerId: PlayerId) => core.players[playerId],
            
            dice: core.dice,
            rollCount: core.rollCount,
            rollLimit: core.rollLimit,
            rollDiceCount: core.rollDiceCount,
            rollConfirmed: core.rollConfirmed,
            
            turnPhase,
            activePlayerId: core.activePlayerId,
            turnNumber: core.turnNumber,
            focusPlayerId,
            
            pendingAttack: core.pendingAttack,
            availableAbilityIds,
            activatingAbilityId: core.activatingAbilityId,
            lastEffectSourceByPlayerId: core.lastEffectSourceByPlayerId,
            
            prompt: sys.prompt.current,
            
            responseWindow: sys.responseWindow?.current,
            
            lastSoldCardId: core.lastSoldCardId,
            
            sys,
            raw: G,
        };
    }, [G]);
}

/**
 * 获取当前选择（兼容两种结构）
 */
export function useCurrentChoice(access: DiceThroneStateAccess): {
    hasChoice: boolean;
    playerId: PlayerId | undefined;
    title: string | undefined;
    options: Array<{ id: string; label: string; statusId?: string; tokenId?: string; customId?: string }>;
    sourceAbilityId?: string;
} {
    return useMemo(() => {
        if (access.prompt) {
            return {
                hasChoice: true,
                playerId: access.prompt.playerId,
                title: access.prompt.title,
                options: access.prompt.options.map(opt => {
                    const rawValue = opt.value as { statusId?: string; tokenId?: string; customId?: string } | undefined;
                    return {
                        id: opt.id,
                        label: opt.label,
                        statusId: rawValue?.statusId,
                        tokenId: rawValue?.tokenId,
                        customId: rawValue?.customId,
                    };
                }),
                sourceAbilityId: access.prompt.sourceId,
            };
        }
        
        return {
            hasChoice: false,
            playerId: undefined,
            title: undefined,
            options: [],
            sourceAbilityId: undefined,
        };
    }, [access.prompt]);
}

/**
 * 获取当前响应窗口状态
 */
export function useResponseWindow(access: DiceThroneStateAccess): {
    hasWindow: boolean;
    windowType: string | undefined;
    currentResponderId: PlayerId | undefined;
    responderQueue: PlayerId[];
    currentResponderIndex: number;
    passedPlayers: PlayerId[];
} {
    return useMemo(() => {
        const window = access.responseWindow;
        if (!window) {
            return {
                hasWindow: false,
                windowType: undefined,
                currentResponderId: undefined,
                responderQueue: [],
                currentResponderIndex: 0,
                passedPlayers: [],
            };
        }
        
        return {
            hasWindow: true,
            windowType: window.windowType,
            currentResponderId: window.responderQueue[window.currentResponderIndex],
            responderQueue: window.responderQueue,
            currentResponderIndex: window.currentResponderIndex,
            passedPlayers: window.passedPlayers,
        };
    }, [access.responseWindow]);
}
