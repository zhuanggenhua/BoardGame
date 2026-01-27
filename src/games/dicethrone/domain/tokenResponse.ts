/**
 * Token 响应处理工具
 * 处理太极加伤、太极减伤、闪避等 Token 使用逻辑
 * 
 * 设计说明：
 * - 效果处理器基于 TokenUseEffectType 注册，而非 tokenId
 * - 新增 Token 只需：1) 定义 TokenDef 2) 若需新效果类型则注册处理器
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    PendingDamage,
    TokenResponseRequestedEvent,
    TokenUsedEvent,
    TokenResponseClosedEvent,
    DamageDealtEvent,
} from './types';
import type {
    TokenDef,
    TokenUseEffectType,
    TokenEffectContext,
    TokenEffectResult,
    TokenEffectProcessor,
} from '../../../systems/TokenSystem/types';
import { RESOURCE_IDS } from './resources';

// ============================================================================
// Token 可用性检查
// ============================================================================

/**
 * 检查玩家是否有可用于减伤的 Token（太极或闪避）
 */
export function hasDefensiveTokens(state: DiceThroneCore, playerId: PlayerId): boolean {
    const player = state.players[playerId];
    if (!player) return false;
    
    const taiji = player.tokens['taiji'] ?? 0;
    const evasive = player.tokens['evasive'] ?? 0;
    
    return taiji > 0 || evasive > 0;
}

/**
 * 检查玩家是否有可用于加伤的 Token（太极）
 */
export function hasOffensiveTokens(state: DiceThroneCore, playerId: PlayerId): boolean {
    const player = state.players[playerId];
    if (!player) return false;
    
    const taiji = player.tokens['taiji'] ?? 0;
    return taiji > 0;
}

/**
 * 检查玩家是否有可用的净化 Token
 */
export function hasPurifyToken(state: DiceThroneCore, playerId: PlayerId): boolean {
    const player = state.players[playerId];
    if (!player) return false;
    
    return (player.tokens['purify'] ?? 0) > 0;
}

/**
 * 检查玩家是否有负面状态可以被净化
 */
export function hasDebuffs(state: DiceThroneCore, playerId: PlayerId): boolean {
    const player = state.players[playerId];
    if (!player) return false;

    // 可被净化移除的负面状态：由状态定义驱动（支持未来扩展）
    const removableDebuffIds = (state.statusDefinitions ?? [])
        .filter(def => def.type === 'debuff' && def.removable)
        .map(def => def.id);

    return removableDebuffIds.some(id => (player.statusEffects[id] ?? 0) > 0);
}

// ============================================================================
// Token 响应窗口创建
// ============================================================================

/**
 * 创建待处理伤害对象
 */
export function createPendingDamage(
    sourcePlayerId: PlayerId,
    targetPlayerId: PlayerId,
    damage: number,
    responseType: 'beforeDamageDealt' | 'beforeDamageReceived',
    sourceAbilityId?: string
): PendingDamage {
    const responderId = responseType === 'beforeDamageDealt' ? sourcePlayerId : targetPlayerId;
    
    return {
        id: `damage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourcePlayerId,
        targetPlayerId,
        originalDamage: damage,
        currentDamage: damage,
        sourceAbilityId,
        responseType,
        responderId,
        isFullyEvaded: false,
    };
}

/**
 * 生成 Token 响应请求事件
 */
export function createTokenResponseRequestedEvent(
    pendingDamage: PendingDamage
): TokenResponseRequestedEvent {
    return {
        type: 'TOKEN_RESPONSE_REQUESTED',
        payload: { pendingDamage },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: Date.now(),
    };
}

// ============================================================================
// Token 效果处理器注册表
// ============================================================================

/**
 * 效果处理器注册表
 * 键为 TokenUseEffectType，值为处理器函数
 * 新增效果类型只需在此注册处理器
 */
const effectProcessors: Record<TokenUseEffectType, TokenEffectProcessor<DiceThroneCore>> = {
    /**
     * 修改造成的伤害（加伤）
     */
    modifyDamageDealt: (ctx) => {
        const { tokenDef, amount } = ctx;
        const modifier = (tokenDef.useEffect.value ?? 1) * amount;
        return {
            success: true,
            damageModifier: modifier,
        };
    },

    /**
     * 修改受到的伤害（减伤）
     */
    modifyDamageReceived: (ctx) => {
        const { tokenDef, amount } = ctx;
        // value 通常为负数（如 -1），amount 为消耗数量
        const modifier = (tokenDef.useEffect.value ?? -1) * amount;
        return {
            success: true,
            damageModifier: modifier,
        };
    },

    /**
     * 掷骰尝试免伤（闪避）
     */
    rollToNegate: (ctx) => {
        const { tokenDef, random } = ctx;
        if (!random) {
            return { success: false };
        }
        
        const rollValue = random.d(6);
        const range = tokenDef.useEffect.rollSuccess?.range ?? [1, 2];
        const isSuccess = rollValue >= range[0] && rollValue <= range[1];
        
        return {
            success: isSuccess,
            fullyEvaded: isSuccess,
            rollResult: {
                value: rollValue,
                success: isSuccess,
            },
        };
    },

    /**
     * 移除负面状态（净化）
     */
    removeDebuff: (_ctx) => {
        // 净化本身只消耗 Token，实际移除状态由调用方处理
        return {
            success: true,
        };
    },
};

/**
 * 获取效果处理器
 */
export function getEffectProcessor(
    effectType: TokenUseEffectType
): TokenEffectProcessor<DiceThroneCore> | undefined {
    return effectProcessors[effectType];
}

/**
 * 注册自定义效果处理器（用于扩展）
 */
export function registerEffectProcessor(
    effectType: TokenUseEffectType,
    processor: TokenEffectProcessor<DiceThroneCore>
): void {
    effectProcessors[effectType] = processor;
}

// ============================================================================
// Token 使用处理（通用入口）
// ============================================================================

/**
 * 通用 Token 使用处理
 * 根据 TokenDef.useEffect.type 调用对应处理器
 */
export function processTokenUsage(
    state: DiceThroneCore,
    tokenDef: TokenDef,
    playerId: PlayerId,
    amount: number,
    random?: RandomFn,
    responseType?: 'beforeDamageDealt' | 'beforeDamageReceived'
): { events: DiceThroneEvent[]; result: TokenEffectResult; newTokenAmount: number } {
    const events: DiceThroneEvent[] = [];
    const player = state.players[playerId];
    const currentAmount = player?.tokens[tokenDef.id] ?? 0;
    const actualAmount = Math.min(amount, currentAmount);
    
    if (actualAmount <= 0) {
        return {
            events,
            result: { success: false },
            newTokenAmount: currentAmount,
        };
    }
    
    // 构建处理上下文
    const ctx: TokenEffectContext<DiceThroneCore> = {
        state,
        tokenDef,
        playerId,
        amount: actualAmount,
        random,
        pendingDamage: state.pendingDamage ? {
            originalDamage: state.pendingDamage.originalDamage,
            currentDamage: state.pendingDamage.currentDamage,
            responseType: state.pendingDamage.responseType,
        } : undefined,
    };
    
    // 调用对应处理器
    const processor = effectProcessors[tokenDef.useEffect.type];
    const result = processor(ctx);
    
    const newTokenAmount = currentAmount - actualAmount;
    
    // 生成 TOKEN_USED 事件
    const effectType = responseType === 'beforeDamageDealt' ? 'damageBoost' : 'damageReduction';
    const event: TokenUsedEvent = {
        type: 'TOKEN_USED',
        payload: {
            playerId,
            tokenId: tokenDef.id,
            amount: actualAmount,
            effectType: result.rollResult ? 'evasionAttempt' : effectType,
            damageModifier: result.damageModifier,
            evasionRoll: result.rollResult,
        },
        sourceCommandType: 'USE_TOKEN',
        timestamp: Date.now(),
    };
    events.push(event);
    
    return { events, result, newTokenAmount };
}

// ============================================================================
// 兼容旧 API（保留以便渐进迁移）
// ============================================================================

/**
 * @deprecated 使用 processTokenUsage 代替
 */
export function processTaijiUsage(
    state: DiceThroneCore,
    playerId: PlayerId,
    amount: number,
    effectType: 'damageBoost' | 'damageReduction'
): { events: DiceThroneEvent[]; newTokenAmount: number } {
    const events: DiceThroneEvent[] = [];
    const player = state.players[playerId];
    const currentAmount = player?.tokens['taiji'] ?? 0;
    const actualAmount = Math.min(amount, currentAmount);
    
    if (actualAmount <= 0) {
        return { events, newTokenAmount: currentAmount };
    }
    
    const newTokenAmount = currentAmount - actualAmount;
    
    const event: TokenUsedEvent = {
        type: 'TOKEN_USED',
        payload: {
            playerId,
            tokenId: 'taiji',
            amount: actualAmount,
            effectType,
            damageModifier: effectType === 'damageBoost' ? actualAmount : -actualAmount,
        },
        sourceCommandType: 'USE_TOKEN',
        timestamp: Date.now(),
    };
    events.push(event);
    
    return { events, newTokenAmount };
}

/**
 * @deprecated 使用 processTokenUsage 代替
 */
export function processEvasiveUsage(
    state: DiceThroneCore,
    playerId: PlayerId,
    random: RandomFn
): { events: DiceThroneEvent[]; newTokenAmount: number; success: boolean } {
    const events: DiceThroneEvent[] = [];
    const player = state.players[playerId];
    const currentAmount = player?.tokens['evasive'] ?? 0;
    
    if (currentAmount <= 0) {
        return { events, newTokenAmount: currentAmount, success: false };
    }
    
    const newTokenAmount = currentAmount - 1;
    
    const rollValue = random.d(6);
    const success = rollValue <= 2;
    
    const event: TokenUsedEvent = {
        type: 'TOKEN_USED',
        payload: {
            playerId,
            tokenId: 'evasive',
            amount: 1,
            effectType: 'evasionAttempt',
            evasionRoll: {
                value: rollValue,
                success,
            },
        },
        sourceCommandType: 'USE_TOKEN',
        timestamp: Date.now(),
    };
    events.push(event);
    
    return { events, newTokenAmount, success };
}

/**
 * @deprecated 使用 processTokenUsage 代替
 */
export function processPurifyUsage(
    state: DiceThroneCore,
    playerId: PlayerId,
    _statusId: string
): { events: DiceThroneEvent[]; newTokenAmount: number } {
    const events: DiceThroneEvent[] = [];
    const player = state.players[playerId];
    const currentAmount = player?.tokens['purify'] ?? 0;
    
    if (currentAmount <= 0) {
        return { events, newTokenAmount: currentAmount };
    }
    
    const newTokenAmount = currentAmount - 1;
    
    const tokenEvent: TokenUsedEvent = {
        type: 'TOKEN_USED',
        payload: {
            playerId,
            tokenId: 'purify',
            amount: 1,
            effectType: 'damageReduction',
            damageModifier: 0,
        },
        sourceCommandType: 'USE_PURIFY',
        timestamp: Date.now(),
    };
    events.push(tokenEvent);
    
    return { events, newTokenAmount };
}

// ============================================================================
// Token 响应窗口关闭
// ============================================================================

/**
 * 生成 Token 响应关闭事件和最终伤害事件
 */
export function finalizeTokenResponse(
    pendingDamage: PendingDamage,
    state: DiceThroneCore
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const timestamp = Date.now();
    
    // 生成响应关闭事件
    const closeEvent: TokenResponseClosedEvent = {
        type: 'TOKEN_RESPONSE_CLOSED',
        payload: {
            pendingDamageId: pendingDamage.id,
            finalDamage: pendingDamage.currentDamage,
            fullyEvaded: pendingDamage.isFullyEvaded ?? false,
        },
        sourceCommandType: 'SKIP_TOKEN_RESPONSE',
        timestamp,
    };
    events.push(closeEvent);
    
    // 如果没有完全闪避，生成实际的伤害事件
    if (!pendingDamage.isFullyEvaded && pendingDamage.currentDamage > 0) {
        const target = state.players[pendingDamage.targetPlayerId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = Math.min(pendingDamage.currentDamage, targetHp);
        
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: pendingDamage.targetPlayerId,
                amount: pendingDamage.currentDamage,
                actualDamage,
                sourceAbilityId: pendingDamage.sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        };
        events.push(damageEvent);
    }
    
    return events;
}

// ============================================================================
// 伤害流程检查
// ============================================================================

/**
 * 检查伤害是否需要打开 Token 响应窗口
 * 返回需要打开的窗口类型，或 null 表示直接应用伤害
 */
export function shouldOpenTokenResponse(
    state: DiceThroneCore,
    attackerId: PlayerId,
    defenderId: PlayerId,
    damage: number
): 'attackerBoost' | 'defenderMitigation' | null {
    if (damage <= 0) return null;
    
    // 检查是否已有待处理伤害（避免重复打开）
    if (state.pendingDamage) return null;
    
    // 先检查攻击方是否有太极可用于加伤
    // 注意：规则说"本回合获得的太极不可用于本回合增强伤害"
    // 这个限制需要额外的状态追踪，暂时先不实现
    if (hasOffensiveTokens(state, attackerId)) {
        return 'attackerBoost';
    }
    
    // 检查防御方是否有可用的防御 Token
    if (hasDefensiveTokens(state, defenderId)) {
        return 'defenderMitigation';
    }
    
    return null;
}
