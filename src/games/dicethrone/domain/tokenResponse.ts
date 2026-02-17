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
} from './tokenTypes';
import { RESOURCE_IDS } from './resources';
import { TOKEN_IDS } from './ids';

// ============================================================================
// Token 可用性检查
// ============================================================================

/**
 * 获取玩家在指定时机下实际可用的 Token 列表（已过滤 category、timing、持有量）
 * 这是 Token 响应窗口的唯一数据源——有可用 token 才弹窗，窗口直接渲染此列表
 */
export function getUsableTokensForTiming(
    state: DiceThroneCore,
    playerId: PlayerId,
    timing: 'beforeDamageDealt' | 'beforeDamageReceived'
): TokenDef[] {
    const player = state.players[playerId];
    if (!player) return [];

    return (state.tokenDefinitions ?? []).filter(def => {
        if (def.category !== 'consumable') return false;
        if (!def.activeUse?.timing?.includes(timing)) return false;
        return (player.tokens[def.id] ?? 0) > 0;
    });
}

/**
 * 获取玩家在攻击掷骰阶段结束时可用的 Token 列表（暴击、精准）
 * @param expectedDamage 预期伤害（用于暴击的门控条件：伤害≥5）
 */
export function getUsableTokensForOffensiveRollEnd(
    state: DiceThroneCore,
    playerId: PlayerId,
    expectedDamage: number
): TokenDef[] {
    const player = state.players[playerId];
    if (!player) return [];

    return (state.tokenDefinitions ?? []).filter(def => {
        if (def.category !== 'consumable') return false;
        if (!def.activeUse?.timing?.includes('onOffensiveRollEnd')) return false;
        if ((player.tokens[def.id] ?? 0) <= 0) return false;
        
        // 暴击门控：伤害≥5
        if (def.id === TOKEN_IDS.CRIT && expectedDamage < 5) return false;
        
        return true;
    });
}

/**
 * 检查玩家是否有攻击掷骰阶段结束时可用的 Token
 */
export function hasOffensiveRollEndTokens(
    state: DiceThroneCore,
    playerId: PlayerId,
    expectedDamage: number
): boolean {
    return getUsableTokensForOffensiveRollEnd(state, playerId, expectedDamage).length > 0;
}

/**
 * 检查玩家是否有可用于减伤的 Token（beforeDamageReceived）
 */
export function hasDefensiveTokens(state: DiceThroneCore, playerId: PlayerId): boolean {
    return getUsableTokensForTiming(state, playerId, 'beforeDamageReceived').length > 0;
}

/**
 * 检查玩家是否有可用于加伤的 Token（beforeDamageDealt）
 */
export function hasOffensiveTokens(state: DiceThroneCore, playerId: PlayerId): boolean {
    return getUsableTokensForTiming(state, playerId, 'beforeDamageDealt').length > 0;
}

/**
 * 检查玩家是否有可用的净化 Token
 */
export function hasPurifyToken(state: DiceThroneCore, playerId: PlayerId): boolean {
    const player = state.players[playerId];
    if (!player) return false;
    
    return (player.tokens[TOKEN_IDS.PURIFY] ?? 0) > 0;
}

/**
 * 检查玩家是否有负面状态可以被净化
 */
export function hasDebuffs(state: DiceThroneCore, playerId: PlayerId): boolean {
    const player = state.players[playerId];
    if (!player) return false;

    // 可被净化移除的负面状态：由状态定义驱动（支持未来扩展）
    const removableDebuffIds = (state.tokenDefinitions ?? [])
        .filter(def => def.category === 'debuff' && def.passiveTrigger?.removable)
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
    sourceAbilityId: string | undefined,
    timestamp: number = 0
): PendingDamage {
    const responderId = responseType === 'beforeDamageDealt' ? sourcePlayerId : targetPlayerId;
    const normalizedSource = sourceAbilityId ?? 'none';
    
    return {
        id: `damage-${timestamp}-${sourcePlayerId}-${targetPlayerId}-${normalizedSource}-${damage}`,
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
    pendingDamage: PendingDamage,
    timestamp: number = 0
): TokenResponseRequestedEvent {
    return {
        type: 'TOKEN_RESPONSE_REQUESTED',
        payload: { pendingDamage },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
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
     * - crit: 伤害≥5时+4（门控条件），不能用于溅射伤害
     * - accuracy: value=0，不加伤害但使攻击不可防御
     */
    modifyDamageDealt: (ctx) => {
        const { tokenDef, amount, pendingDamage } = ctx;
        const effect = tokenDef.activeUse?.effect;

        // 暴击 (crit)：需要当前伤害≥5才能使用
        const isCrit = tokenDef.id === TOKEN_IDS.CRIT;
        if (isCrit) {
            const currentDamage = pendingDamage?.currentDamage ?? 0;
            if (currentDamage < 5) {
                return { success: false };
            }
            // TODO: 溅射伤害限制需要在 validate 层检查（当前无溅射机制）
            return {
                success: true,
                damageModifier: (effect?.value ?? 4) * amount,
            };
        }

        // 精准 (accuracy)：value=0 且 tokenId 为 accuracy → 使攻击不可防御
        const isAccuracy = tokenDef.id === TOKEN_IDS.ACCURACY;
        const modifier = (effect?.value ?? 0) * amount;
        return {
            success: true,
            damageModifier: modifier,
            extra: isAccuracy ? { makeUndefendable: true } : undefined,
        };
    },

    /**
     * 修改受到的伤害（减伤/反弹，根据 tokenId 动态决定）
     * - protect: 伤害减半（向上取整）
     * - retribution: 不减伤，反弹受到伤害的一半（向上取整）给攻击者
     * - 太极 beforeDamageDealt: value=-1 → 反转为 +1（加伤）
     * - 太极 beforeDamageReceived: value=-1 → 保持 -1（减伤）
     */
    modifyDamageReceived: (ctx) => {
        const { tokenDef, amount, pendingDamage } = ctx;
        const effect = tokenDef.activeUse?.effect;
        const rawValue = effect?.value ?? -1;

        // 守护 (protect)：伤害减半（向上取整）
        const isProtect = tokenDef.id === TOKEN_IDS.PROTECT;
        if (isProtect) {
            const currentDamage = pendingDamage?.currentDamage ?? 0;
            // 减半向上取整：减的量 = ceil(currentDamage / 2)
            const reduction = -Math.ceil(currentDamage / 2);
            return {
                success: true,
                damageModifier: reduction,
            };
        }

        // 神罚 (retribution)：不减伤，反弹受到伤害的一半（向上取整）
        const isRetribution = tokenDef.id === TOKEN_IDS.RETRIBUTION;
        if (isRetribution) {
            const currentDamage = pendingDamage?.currentDamage ?? 0;
            const reflectAmount = Math.ceil(currentDamage / 2);
            return {
                success: true,
                damageModifier: 0,
                extra: { reflectDamage: reflectAmount },
            };
        }

        // 太极等双时机 token：在 beforeDamageDealt 时反转 modifier（减伤值变加伤值）
        const isOffensiveUse = pendingDamage?.responseType === 'beforeDamageDealt';
        const modifier = isOffensiveUse ? Math.abs(rawValue) * amount : rawValue * amount;

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
        
        const effect = tokenDef.activeUse?.effect;
        const rollValue = random.d(6);
        const range = effect?.rollSuccess?.range ?? [1, 2];
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
 * 根据 TokenDef.activeUse.effect.type 调用对应处理器
 */
export function processTokenUsage(
    state: DiceThroneCore,
    tokenDef: TokenDef,
    playerId: PlayerId,
    amount: number,
    random?: RandomFn,
    responseType?: 'beforeDamageDealt' | 'beforeDamageReceived',
    timestamp: number = 0
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
    const effect = tokenDef.activeUse?.effect;
    if (!effect) {
        return { events: [], result: { success: false }, newTokenAmount: currentAmount };
    }
    const processor = effectProcessors[effect.type];
    if (!processor) {
        return { events: [], result: { success: false }, newTokenAmount: currentAmount };
    }
    const result = processor(ctx);
    
    const newTokenAmount = currentAmount - actualAmount;
    
    // 生成 TOKEN_USED 事件
    const effectType = responseType === 'beforeDamageDealt' ? 'damageBoost' : 'damageReduction';
    const resolvedEffectType = result.rollResult
        ? 'evasionAttempt'
        : effect.type === 'removeDebuff'
            ? 'removeDebuff'
            : effectType;
    const event: TokenUsedEvent = {
        type: 'TOKEN_USED',
        payload: {
            playerId,
            tokenId: tokenDef.id,
            amount: actualAmount,
            effectType: resolvedEffectType,
            damageModifier: result.damageModifier,
            evasionRoll: result.rollResult,
        },
        sourceCommandType: 'USE_TOKEN',
        timestamp,
    };
    events.push(event);
    
    return { events, result, newTokenAmount };
}


// ============================================================================
// Token 响应窗口关闭
// ============================================================================

/**
 * 生成 Token 响应关闭事件和最终伤害事件
 */
export function finalizeTokenResponse(
    pendingDamage: PendingDamage,
    state: DiceThroneCore,
    timestamp: number = 0
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    
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
                modifiers: pendingDamage.modifiers,
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

    // 终极技能（规则 §4.4）：伤害可被攻击方强化，但不可被防御方降低/忽略/回避
    const isUltimate = state.pendingAttack?.isUltimate ?? false;
    
    // 先检查攻击方是否有太极可用于加伤
    // 注意：规则说"本回合获得的太极不可用于本回合增强伤害"
    // 这个限制需要额外的状态追踪，暂时先不实现
    if (hasOffensiveTokens(state, attackerId)) {
        return 'attackerBoost';
    }
    
    // 终极技能跳过防御方 Token 响应（规则 §4.4：不可被降低/忽略/回避）
    if (isUltimate) return null;
    
    // 检查防御方是否有可用的防御 Token
    if (hasDefensiveTokens(state, defenderId)) {
        return 'defenderMitigation';
    }
    
    return null;
}
