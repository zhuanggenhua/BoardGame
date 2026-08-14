/**
 * DiceThrone 状态访问 Hook
 * 提供统一的状态访问接口（新版引擎）
 * 
 * 注意：阶段信息从 sys.phase 读取（单一权威），通过 FlowSystem 同步
 */

import { useMemo } from 'react';
import type { PlayerId, MatchState, ResponseWindowState } from '../../../engine/types';
import { asSimpleChoice, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import type { HeroState, Die, TurnPhase, PendingAttack, PendingDefenderChoice } from '../types';
import type { DiceThroneCore } from '../domain';
import { getAvailableAbilityIds, getDefensiveAbilityIds, canAdvancePhase as canAdvancePhaseDomain } from '../domain/rules';

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
    const turnPhase = sys.phase as TurnPhase;
    
    // 1. 响应窗口的当前响应者
    if (sys.responseWindow?.current) {
        const rw = sys.responseWindow.current;
        return rw.responderQueue[rw.currentResponderIndex];
    }
    
    // 2. Token 响应的响应者
    if (core.pendingDamage) {
        return core.pendingDamage.responderId;
    }
    
    // 3. 交互所有者（从 sys.interaction 读取，所有 kind 统一用 playerId 字段）
    if (sys.interaction.current) {
        return sys.interaction.current.playerId;
    }
    
    // 5. 防御阶段的防御方（掷骰者）
    if (turnPhase === 'defensiveRoll' && core.pendingAttack) {
        return core.pendingAttack.defenderId;
    }
    
    // 6. 默认：回合主动玩家
    return core.activePlayerId;
}

export function canManuallyAdvancePhase(state: EngineState): boolean {
    const { core, sys } = state;
    const turnPhase = sys.phase as TurnPhase;
    const hasPendingInteraction = Boolean(sys.interaction.current);
    const hasActiveResponseWindow = Boolean(sys.responseWindow?.current);

    return canAdvancePhaseDomain(core, turnPhase)
        && !hasPendingInteraction
        && !hasActiveResponseWindow;
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
    
    // 阶段推进权限（领域校验 + UI 层焦点/交互判断）
    canAdvancePhase: boolean;
    
    // 攻击状态
    pendingAttack: PendingAttack | null;
    availableAbilityIds: string[];
    activatingAbilityId?: string;
    lastEffectSourceByPlayerId?: Record<PlayerId, string | undefined>;
    
    // 选择/提示（通过 asSimpleChoice 展平）
    prompt: (SimpleChoiceData & { id: string; playerId: PlayerId }) | undefined;
    
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
        
        // 从 sys.phase 读取阶段（单一权威）
        const turnPhase = sys.phase as TurnPhase;
        
        // 计算焦点玩家（统一的操作权判断）
        const focusPlayerId = getFocusPlayerId(G);
        
        // 实时计算可用技能（派生状态，不再存储在 core 中）
        const isAbilityRollPhase = turnPhase === 'offensiveRoll' || turnPhase === 'defensiveRoll';
        const rollerId = turnPhase === 'defensiveRoll' && core.pendingAttack
            ? core.pendingAttack.defenderId
            : core.activePlayerId;
        // 防御阶段掷骰前：列出所有防御技能供选择/切换（不检查骰面）
        // 规则 §3.6 步骤 2：先选择防御技能，再掷骰
        // 暗影刺客等拥有多个防御技能的英雄，在投掷前可以自由切换选择
        const isPreRollDefenseSelection = turnPhase === 'defensiveRoll'
            && core.rollCount === 0
            && core.pendingAttack;
        const availableAbilityIds = isPreRollDefenseSelection
            ? getDefensiveAbilityIds(core, rollerId)
            : isAbilityRollPhase
                ? getAvailableAbilityIds(core, rollerId, turnPhase)
                : [];
        
        // 阶段推进权限：响应窗口期间只能响应/跳过响应，不能结束攻击或防御。
        const canAdvance = canManuallyAdvancePhase(G);
        
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
            canAdvancePhase: canAdvance,
            
            pendingAttack: core.pendingAttack,
            availableAbilityIds,
            activatingAbilityId: core.activatingAbilityId,
            lastEffectSourceByPlayerId: core.lastEffectSourceByPlayerId,
            
            prompt: asSimpleChoice(sys.interaction.current),
            
            responseWindow: sys.responseWindow?.current,
            
            lastSoldCardId: core.lastSoldCardId,
            
            sys,
            raw: G,
        };
    }, [G]);
}

/** slider 配置（从领域层透传） */
export interface SliderConfig {
    confirmLabelKey: string;
    hintKey?: string;
    skipLabelKey?: string;
}

/**
 * 获取当前选择（兼容两种结构）
 */
export function useCurrentChoice(access: DiceThroneStateAccess): {
    hasChoice: boolean;
    playerId: PlayerId | undefined;
    title: string | undefined;
    options: Array<{ id: string; label: string; labelParams?: Record<string, string | number>; statusId?: string; tokenId?: string; customId?: string; value?: number; disabled?: boolean }>;
    sourceAbilityId?: string;
    /** slider 模式配置（存在时渲染滑动条） */
    slider?: SliderConfig;
} {
    const prompt = access.prompt;
    return useMemo(() => {
        if (prompt) {
            const promptData = prompt as typeof prompt & { slider?: SliderConfig };
            return {
                hasChoice: true,
                playerId: prompt.playerId,
                title: prompt.title,
                options: prompt.options.map(opt => {
                    const rawValue = opt.value as { statusId?: string; tokenId?: string; customId?: string; value?: number; disabled?: boolean } | undefined;
                    return {
                        id: opt.id,
                        label: opt.label,
                        labelParams: opt.labelParams,
                        statusId: rawValue?.statusId,
                        tokenId: rawValue?.tokenId,
                        customId: rawValue?.customId,
                        value: rawValue?.value,
                        disabled: opt.disabled ?? rawValue?.disabled,
                    };
                }),
                sourceAbilityId: prompt.sourceId,
                slider: promptData.slider,
            };
        }
        
        return {
            hasChoice: false,
            playerId: undefined,
            title: undefined,
            options: [],
            sourceAbilityId: undefined,
        };
    }, [prompt]);
}

export function useCurrentDefenderChoice(
    access: DiceThroneStateAccess,
): (PendingDefenderChoice & { id: string; playerId: PlayerId }) | undefined {
    return useMemo(() => {
        const interaction = access.sys.interaction?.current;
        if (!interaction || interaction.kind !== 'dt:defender-choice') {
            return undefined;
        }
        return {
            ...(interaction.data as PendingDefenderChoice),
            id: interaction.id,
            playerId: interaction.playerId,
        };
    }, [access.sys.interaction]);
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
