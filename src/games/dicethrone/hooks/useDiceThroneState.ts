/**
 * DiceThrone 状态访问 Hook
 * 提供统一的状态访问接口（新版引擎）
 * 
 * 新版：G.core.players, G.core.turnPhase, G.sys.prompt.current 等
 */

import { useMemo } from 'react';
import type { PlayerId, MatchState, PromptState } from '../../../engine/types';
import type { HeroState, Die, TurnPhase, PendingAttack } from '../types';
import type { DiceThroneCore } from '../domain';

// ============================================================================
// 类型定义
// ============================================================================

type EngineState = MatchState<DiceThroneCore>;

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
    
    // 攻击状态
    pendingAttack: PendingAttack | null;
    availableAbilityIds: string[];
    activatingAbilityId?: string;
    lastEffectSourceByPlayerId?: Record<PlayerId, string | undefined>;
    
    // 选择/提示
    prompt: PromptState['current'] | undefined;
    
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
        return {
            players: core.players,
            getPlayer: (playerId: PlayerId) => core.players[playerId],
            
            dice: core.dice,
            rollCount: core.rollCount,
            rollLimit: core.rollLimit,
            rollDiceCount: core.rollDiceCount,
            rollConfirmed: core.rollConfirmed,
            
            turnPhase: core.turnPhase,
            activePlayerId: core.activePlayerId,
            turnNumber: core.turnNumber,
            
            pendingAttack: core.pendingAttack,
            availableAbilityIds: core.availableAbilityIds,
            activatingAbilityId: core.activatingAbilityId,
            lastEffectSourceByPlayerId: core.lastEffectSourceByPlayerId,
            
            prompt: sys.prompt.current,
            
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
    options: Array<{ id: string; label: string; statusId: string }>;
    sourceAbilityId?: string;
} {
    return useMemo(() => {
        if (access.prompt) {
            return {
                hasChoice: true,
                playerId: access.prompt.playerId,
                title: access.prompt.title,
                options: access.prompt.options.map(opt => {
                    const rawValue = opt.value as { statusId?: string } | undefined;
                    return {
                        id: opt.id,
                        label: opt.label,
                        statusId: rawValue?.statusId ?? opt.label,
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
