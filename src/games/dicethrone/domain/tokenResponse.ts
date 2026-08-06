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
import { getMaxTokenUseAmount, getTokenEffectValue } from './tokenTypes';
import { RESOURCE_IDS } from './resources';
import { TOKEN_IDS } from './ids';
import { hasSpentTreantTreeSpiritThisTurn } from './passiveAbility';
import { getTokenStackLimit } from './rules';
import { isPurifiableDebuffId } from './statusRemoval';
import { getRemainingArtificerBotActivations, isArtificerBotTokenId } from './artificerBots';

function getArtificerBotAvailableAmount(state: DiceThroneCore, playerId: PlayerId, tokenId: string): number | undefined {
    return isArtificerBotTokenId(tokenId)
        ? getRemainingArtificerBotActivations(state, playerId, tokenId)
        : undefined;
}

// ============================================================================
// Token 可用性检查
// ============================================================================

export function hasBeforeDamageReceivedCard(
    state: DiceThroneCore,
    playerId: PlayerId,
): boolean {
    const player = state.players[playerId];
    if (!player) return false;

    return (player.hand ?? []).some(card => {
        const pendingDamage = card.playCondition?.pendingDamage;
        if (!pendingDamage || pendingDamage.responseType !== 'beforeDamageReceived') return false;
        if (pendingDamage.role === 'source') return false;
        if (card.timing !== 'instant' && card.timing !== 'roll') return false;
        if (!card.effects?.some(effect => effect.action)) return false;
        return (player.resources?.[RESOURCE_IDS.CP] ?? 0) >= card.cpCost;
    });
}

function resolveAdditionalTokenCosts(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenDef: TokenDef,
): Array<{ tokenId: string; amount: number }> {
    return (tokenDef.activeUse?.additionalTokenCosts ?? [])
        .map((cost) => {
            const override = cost.overrideWhenOwnerTokenLimitAtLeast;
            if (override) {
                const ownerTokenId = override.tokenId ?? tokenDef.id;
                const ownerLimit = getTokenStackLimit(state, playerId, ownerTokenId);
                if (ownerLimit >= override.limit) {
                    return { tokenId: cost.tokenId, amount: override.amount };
                }
            }
            return { tokenId: cost.tokenId, amount: cost.amount };
        })
        .filter((cost) => Number.isInteger(cost.amount) && cost.amount > 0);
}

export function getUsableTokenAmountForTiming(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: string,
    timing: 'beforeDamageDealt' | 'beforeDamageReceived',
    options?: { damageScope?: 'attack' | 'direct'; originalDamageOverride?: number }
): number {
    const player = state.players[playerId];
    if (!player) return 0;

    const tokenDef = (state.tokenDefinitions ?? []).find(def => def.id === tokenId);
    if (!tokenDef?.activeUse?.timing?.includes(timing)) return 0;
    if (hasSpentTreantTreeSpiritThisTurn(state, playerId, tokenDef.id)) return 0;

    const damageScope = options?.damageScope ?? 'attack';
    const hasAttackContext = !!state.pendingAttack;
    if (tokenDef.activeUse.requiresAttackDamage) {
        if (!hasAttackContext) return 0;
        if (damageScope !== 'attack') return 0;
    }
    if (
        typeof tokenDef.activeUse.minimumAttackDamage === 'number'
        && ((options?.originalDamageOverride ?? state.pendingDamage?.originalDamage ?? 0) < tokenDef.activeUse.minimumAttackDamage)
    ) {
        return 0;
    }

    let availableAmount = getArtificerBotAvailableAmount(state, playerId, tokenDef.id) ?? (player.tokens[tokenDef.id] ?? 0);
    if (availableAmount <= 0) return 0;
    const additionalCosts = resolveAdditionalTokenCosts(state, playerId, tokenDef);
    const sameTokenAdditionalCost = additionalCosts
        .filter(cost => cost.tokenId === tokenDef.id)
        .reduce((sum, cost) => sum + cost.amount, 0);
    if (sameTokenAdditionalCost > 0) {
        availableAmount = Math.max(0, availableAmount - sameTokenAdditionalCost);
    }
    for (const cost of additionalCosts) {
        if ((player.tokens[cost.tokenId] ?? 0) < cost.amount) return 0;
    }
    if (availableAmount <= 0) return 0;

    const maxWindowUsage = getMaxTokenUseAmount(tokenDef);
    const usedInWindow = state.pendingDamage?.tokenUsageTotals?.[tokenDef.id] ?? 0;
    const hasExplicitWindowCap = (tokenDef.activeUse.allowedConsumeAmounts?.length ?? 0) > 0;
    const remainingWindowUsage = hasExplicitWindowCap
        ? Math.max(0, maxWindowUsage - usedInWindow)
        : availableAmount;

    return Math.max(0, Math.min(availableAmount, remainingWindowUsage));
}

/**
 * 获取玩家在指定时机下实际可用的 Token 列表（已过滤 category、timing、持有量）
 * 这是 Token 响应窗口的唯一数据源——有可用 token 才弹窗，窗口直接渲染此列表
 */
export function getUsableTokensForTiming(
    state: DiceThroneCore,
    playerId: PlayerId,
    timing: 'beforeDamageDealt' | 'beforeDamageReceived',
    options?: { damageScope?: 'attack' | 'direct'; originalDamageOverride?: number }
): TokenDef[] {
    const player = state.players[playerId];
    if (!player) return [];

    return (state.tokenDefinitions ?? []).filter(def => {
        return getUsableTokenAmountForTiming(state, playerId, def.id, timing, options) > 0;
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

    const isAlreadyUnblockable = state.pendingAttack ? !state.pendingAttack.isDefendable : false;

    return (state.tokenDefinitions ?? []).filter(def => {
        if (!def.activeUse?.timing?.includes('onOffensiveRollEnd')) return false;
        if ((player.tokens[def.id] ?? 0) <= 0) return false;
        if (state.pendingAttack?.offensiveRollEndTokenIdsUsed?.includes(def.id)) return false;
        
        // 暴击门控：伤害≥5
        if (def.id === TOKEN_IDS.CRIT && expectedDamage < 5) return false;

        // 精准门控：攻击已经不可防御时，精准无意义
        if (def.id === TOKEN_IDS.ACCURACY && isAlreadyUnblockable) return false;
        
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
export function hasDefensiveTokens(
    state: DiceThroneCore,
    playerId: PlayerId,
    damageScope?: 'attack' | 'direct',
    originalDamageOverride?: number,
): boolean {
    return getUsableTokensForTiming(state, playerId, 'beforeDamageReceived', {
        damageScope,
        originalDamageOverride,
    }).length > 0;
}

/**
 * 检查玩家是否有可用于加伤的 Token（beforeDamageDealt）
 */
export function hasOffensiveTokens(
    state: DiceThroneCore,
    playerId: PlayerId,
    damageScope?: 'attack' | 'direct',
    originalDamageOverride?: number,
): boolean {
    return getUsableTokensForTiming(state, playerId, 'beforeDamageDealt', {
        damageScope,
        originalDamageOverride,
    }).length > 0;
}

/**
 * 检查玩家是否有可用的净化 Token
 */
export function hasPurifyToken(state: DiceThroneCore, playerId: PlayerId): boolean {
    const player = state.players[playerId];
    if (!player) return false;

    return ((player.tokens ?? {})[TOKEN_IDS.PURIFY] ?? 0) > 0;
}

/**
 * 检查玩家是否有负面状态可以被净化
 */
export function hasDebuffs(state: DiceThroneCore, playerId: PlayerId): boolean {
    const player = state.players[playerId];
    if (!player) return false;
    const playerStatusEffects = player.statusEffects ?? {};
    const playerTokens = player.tokens ?? {};

    // 可被净化移除的负面状态：由状态定义驱动（支持未来扩展）
    const removableDebuffIds = (state.tokenDefinitions ?? [])
        .filter(def => isPurifiableDebuffId(state, def.id))
        .map(def => def.id);

    return removableDebuffIds.some(id => (playerStatusEffects[id] ?? 0) > 0 || (playerTokens[id] ?? 0) > 0);
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
    timestamp: number = 0,
    initialModifiers?: Array<{ type: 'defense' | 'token' | 'shield' | 'status'; value: number; sourceId?: string; sourceName?: string }>,
    damageScope?: 'attack' | 'direct',
    unblockable?: boolean,
    deferredTokenGrants?: PendingDamage['deferredTokenGrants'],
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
        damageScope,
        ...(unblockable ? { unblockable: true } : {}),
        ...(deferredTokenGrants?.length ? { deferredTokenGrants } : {}),
        responseType,
        responderId,
        isFullyEvaded: false,
        ...(initialModifiers && initialModifiers.length > 0 ? { modifiers: initialModifiers } : {}),
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

/**
 * 估算既有护盾吸收后的有效伤害，仅用于 Token/卡牌响应开窗门禁。
 *
 * 注意：
 * - 这里只判断“是否还剩可响应伤害”，不会真正消耗护盾。
 * - 真正护盾消耗仍由 DAMAGE_DEALT 的 reducer 统一处理，避免双扣。
 */
export function estimateDamageAfterExistingShields(
    state: DiceThroneCore,
    targetId: PlayerId,
    incomingDamage: number,
    options?: { bypassShields?: boolean },
): number {
    if (incomingDamage <= 0) return 0;
    if (options?.bypassShields) return incomingDamage;
    if (state.pendingAttack?.isUltimate) return incomingDamage;

    const target = state.players[targetId];
    const shields = target?.damageShields ?? [];
    if (shields.length === 0) return incomingDamage;

    let remainingDamage = incomingDamage;
    const percentShields = shields.filter((shield) => !shield.preventStatus && shield.reductionPercent !== undefined);
    const fixedShields = shields.filter((shield) => !shield.preventStatus && shield.reductionPercent === undefined);

    for (const shield of percentShields) {
        if (remainingDamage <= 0) break;
        const reductionPercent = shield.reductionPercent ?? 0;
        const reductionAmount = Math.ceil(remainingDamage * (reductionPercent / 100));
        remainingDamage = Math.max(0, remainingDamage - reductionAmount);
    }

    for (const shield of fixedShields) {
        if (remainingDamage <= 0) break;
        remainingDamage = Math.max(0, remainingDamage - shield.value);
    }

    return remainingDamage;
}

export const resolveDamageResponseType = (
    state: DiceThroneCore,
    defenderId: PlayerId,
    rawTokenResponseType: 'attackerBoost' | 'defenderMitigation' | null,
): 'attackerBoost' | 'defenderMitigation' | null => {
    const isUltimateDamage = state.pendingAttack?.isUltimate === true;
    const hasDefenderCardResponse = hasBeforeDamageReceivedCard(state, defenderId);
    if (rawTokenResponseType === 'attackerBoost') return 'attackerBoost';
    if (isUltimateDamage) return null;
    if (rawTokenResponseType === 'defenderMitigation') return 'defenderMitigation';
    return hasDefenderCardResponse ? 'defenderMitigation' : null;
};

export function maybeCreateDamageResponseEvent(params: {
    state: DiceThroneCore;
    damageEvent: DamageDealtEvent;
    attackerId: PlayerId;
    sourceAbilityId?: string;
    timestamp?: number;
    isDefensiveContext?: boolean;
    allowAttackerBoost?: boolean;
}): TokenResponseRequestedEvent | null {
    const {
        state,
        damageEvent,
        attackerId,
        sourceAbilityId,
        timestamp = 0,
        isDefensiveContext,
        allowAttackerBoost = true,
    } = params;
    const dmgPayload = damageEvent.payload;
    const dmgAmount = dmgPayload.amount ?? 0;
    const dmgTargetId = dmgPayload.targetId;
    if (dmgAmount <= 0) return null;
    if (state.pendingDamage) return null;
    if (isDefensiveContext) return null;

    const isUnblockable = dmgPayload.unblockable === true;
    const bypassShields = dmgPayload.bypassShields === true;
    const damageScope = dmgPayload.damageScope ?? (state.pendingAttack ? 'attack' : 'direct');
    const hasDefenderAvoidanceResponse = hasBeforeDamageReceivedCard(state, dmgTargetId)
        || hasDefensiveTokens(state, dmgTargetId, damageScope, dmgAmount);

    if (!allowAttackerBoost && !hasDefenderAvoidanceResponse) {
        return null;
    }

    const effectiveDamageForTokenResponse = estimateDamageAfterExistingShields(
        state,
        dmgTargetId,
        dmgAmount,
        { bypassShields },
    );

    const rawTokenResponseType = allowAttackerBoost
        ? shouldOpenTokenResponse(
            state,
            attackerId,
            dmgTargetId,
            effectiveDamageForTokenResponse,
            isDefensiveContext,
            damageScope,
        )
        : (hasDefenderAvoidanceResponse && effectiveDamageForTokenResponse > 0 ? 'defenderMitigation' : null);
    const tokenResponseType = resolveDamageResponseType(state, dmgTargetId, rawTokenResponseType);

    if (!tokenResponseType) return null;

    const responseType = tokenResponseType === 'attackerBoost'
        ? 'beforeDamageDealt'
        : 'beforeDamageReceived';
    const pendingDamage = createPendingDamage(
        attackerId,
        dmgTargetId,
        dmgAmount,
        responseType,
        sourceAbilityId ?? dmgPayload.sourceAbilityId,
        timestamp,
        dmgPayload.modifiers,
        damageScope,
        isUnblockable,
        dmgPayload.deferredTokenGrants ?? state.pendingAttack?.deferredTokenGrants,
    );
    return createTokenResponseRequestedEvent(pendingDamage, timestamp);
}

// ============================================================================
// Token 效果处理器注册表
// ============================================================================

/**
 * 效果处理器注册表
 * 键为 TokenUseEffectType，值为处理器函数
 * 新增效果类型只需在此注册处理器
 */
function getIncrementalMappedModifier(
    ctx: TokenEffectContext<DiceThroneCore>,
    fallbackValue: number,
): number | null {
    const effect = ctx.tokenDef.activeUse?.effect;
    if (!effect?.valueByAmount) return null;

    const usedInWindow = ((ctx.extra?.tokenUsageTotals as Record<string, number> | undefined)?.[ctx.tokenDef.id]) ?? 0;
    const nextTotal = usedInWindow + ctx.amount;
    const nextValue = effect.valueByAmount[nextTotal];
    if (typeof nextValue !== 'number') return null;

    const previousValue = usedInWindow > 0
        ? getTokenEffectValue(effect, usedInWindow, fallbackValue)
        : 0;

    return nextValue - previousValue;
}

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
                damageModifier: getTokenEffectValue(effect, amount, 4),
            };
        }

        // 精准 (accuracy)：value=0 且 tokenId 为 accuracy → 使攻击不可防御
        const mappedModifier = getIncrementalMappedModifier(ctx, 1);
        if (mappedModifier !== null) {
            return {
                success: true,
                damageModifier: mappedModifier,
            };
        }

        const isAccuracy = tokenDef.id === TOKEN_IDS.ACCURACY;
        const modifier = getTokenEffectValue(effect, amount, 0);
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
        const rawValue = getTokenEffectValue(effect, amount, -1);

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
        const mappedModifier = getIncrementalMappedModifier(ctx, -1);
        if (mappedModifier !== null) {
            const modifier = pendingDamage?.responseType === 'beforeDamageDealt'
                ? Math.abs(mappedModifier)
                : mappedModifier;
            return {
                success: true,
                damageModifier: modifier,
            };
        }

        const isOffensiveUse = pendingDamage?.responseType === 'beforeDamageDealt';
        const modifier = isOffensiveUse ? Math.abs(rawValue) : rawValue;

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
    if (hasSpentTreantTreeSpiritThisTurn(state, playerId, tokenDef.id)) {
        return {
            events,
            result: { success: false },
            newTokenAmount: currentAmount,
        };
    }
    const usedInWindow = state.pendingDamage?.tokenUsageTotals?.[tokenDef.id] ?? 0;
    const maxWindowUsage = getMaxTokenUseAmount(tokenDef);
    const hasExplicitWindowCap = (tokenDef.activeUse?.allowedConsumeAmounts?.length ?? 0) > 0;
    const remainingWindowUsage = hasExplicitWindowCap
        ? Math.max(0, maxWindowUsage - usedInWindow)
        : currentAmount;
    const availableAmount = getArtificerBotAvailableAmount(state, playerId, tokenDef.id) ?? currentAmount;
    const actualAmount = Math.min(amount, availableAmount, remainingWindowUsage);
    const additionalCosts = resolveAdditionalTokenCosts(state, playerId, tokenDef);
    const sameTokenAdditionalCost = additionalCosts
        .filter(cost => cost.tokenId === tokenDef.id)
        .reduce((sum, cost) => sum + cost.amount, 0);
    const affordablePrimaryAmount = Math.max(0, currentAmount - sameTokenAdditionalCost);
    const actualAffordableAmount = Math.min(actualAmount, affordablePrimaryAmount);

    if (amount <= 0 || actualAffordableAmount <= 0) {
        return {
            events,
            result: { success: false },
            newTokenAmount: currentAmount,
        };
    }
    for (const cost of additionalCosts) {
        if ((player?.tokens[cost.tokenId] ?? 0) < cost.amount) {
            return {
                events,
                result: { success: false },
                newTokenAmount: currentAmount,
            };
        }
    }
    
    // 构建处理上下文
    const ctx: TokenEffectContext<DiceThroneCore> = {
        state,
        tokenDef,
        playerId,
        amount: actualAffordableAmount,
        random,
        pendingDamage: state.pendingDamage ? {
            originalDamage: state.pendingDamage.originalDamage,
            currentDamage: state.pendingDamage.currentDamage,
            responseType: state.pendingDamage.responseType,
        } : undefined,
        extra: {
            tokenUsageTotals: state.pendingDamage?.tokenUsageTotals,
        },
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
    
    const newTokenAmount = currentAmount - actualAffordableAmount;

    if (result.success) {
        const runningTotals = new Map<string, number>();
        for (const cost of additionalCosts) {
            const spentSoFar = runningTotals.get(cost.tokenId) ?? 0;
            runningTotals.set(cost.tokenId, spentSoFar + cost.amount);
            const currentCostAmount = player?.tokens[cost.tokenId] ?? 0;
            events.push({
                type: 'TOKEN_CONSUMED',
                payload: {
                    playerId,
                    tokenId: cost.tokenId,
                    amount: cost.amount,
                    newTotal: Math.max(0, currentCostAmount - spentSoFar - cost.amount),
                    sourceAbilityId: tokenDef.id,
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp,
            } as DiceThroneEvent);
        }
    }
    
    // 生成 TOKEN_USED 事件
    const resolvedResponseType = responseType ?? state.pendingDamage?.responseType;
    const effectType = resolvedResponseType === 'beforeDamageDealt'
        ? 'damageBoost'
        : effect.type === 'modifyDamageDealt'
            ? 'damageBoost'
            : 'damageReduction';
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
            amount: actualAffordableAmount,
            effectType: resolvedEffectType,
            damageModifier: result.damageModifier,
            evasionRoll: result.rollResult,
            deferredDamageEvents: result.extra?.deferredDamageEvents as PendingDamage['deferredDamageEvents'] | undefined,
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
                sourcePlayerId: pendingDamage.sourcePlayerId,
                damageScope: pendingDamage.damageScope,
                ...(pendingDamage.unblockable ? { unblockable: true } : {}),
                modifiers: pendingDamage.modifiers,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        };
        events.push(damageEvent);
    }

    const deferredDamages = pendingDamage.deferredDamageEvents ?? [];
    for (let i = 0; i < deferredDamages.length; i++) {
        const deferredDamage = deferredDamages[i];
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: deferredDamage.targetId,
                amount: deferredDamage.amount,
                actualDamage: deferredDamage.actualDamage,
                sourceAbilityId: deferredDamage.sourceAbilityId,
                sourcePlayerId: deferredDamage.sourcePlayerId,
                damageScope: deferredDamage.damageScope,
                ...(deferredDamage.unblockable ? { unblockable: true } : {}),
            },
            sourceCommandType: deferredDamage.sourceCommandType ?? 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent;
        const followupResponseEvent = maybeCreateDamageResponseEvent({
            state: { ...state, pendingDamage: undefined },
            damageEvent,
            attackerId: deferredDamage.sourcePlayerId ?? pendingDamage.sourcePlayerId,
            sourceAbilityId: deferredDamage.sourceAbilityId,
            timestamp,
            allowAttackerBoost: deferredDamage.damageScope === 'attack',
        });
        if (followupResponseEvent) {
            const remainingDeferredDamages = deferredDamages.slice(i + 1);
            if (remainingDeferredDamages.length > 0) {
                followupResponseEvent.payload.pendingDamage.deferredDamageEvents = remainingDeferredDamages;
            }
            events.push(followupResponseEvent);
            break;
        }
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
 * 
 * @param isDefensiveContext 是否为防御技能上下文（防御反击伤害不触发 Token 响应窗口）
 */
export function shouldOpenTokenResponse(
    state: DiceThroneCore,
    attackerId: PlayerId,
    defenderId: PlayerId,
    damage: number,
    isDefensiveContext?: boolean,
    damageScope?: 'attack' | 'direct'
): 'attackerBoost' | 'defenderMitigation' | null {
    if (damage <= 0) {
        return null;
    }
    
    // 检查是否已有待处理伤害（避免重复打开）
    if (state.pendingDamage) {
        return null;
    }

    // 防御技能的反击伤害不是"攻击"（规则 §7.2），不触发 Token 响应窗口
    if (isDefensiveContext) {
        return null;
    }

    // Ultimate Damage 伤害类型：可被攻击方强化，但不可被防御方降低/忽略/回避。
    // 当前 pendingAttack.isUltimate 表示这段待结算伤害来自终极伤害类型，不应扩展到普通不可防御伤害。
    const isUltimate = state.pendingAttack?.isUltimate ?? false;
    
    // 先检查攻击方是否有太极可用于加伤。
    // 连段冲拳②等奖励骰在伤害结算前获得的太极，属于本次攻击的可用资源。
    const hasOffensiveTokensResult = hasOffensiveTokens(state, attackerId, damageScope, damage);
    if (hasOffensiveTokensResult) {
        return 'attackerBoost';
    }
    
    // Ultimate Damage 跳过防御方 Token 响应（不可被降低/忽略/回避）。
    if (isUltimate) {
        return null;
    }
    
    // 检查防御方是否有可用的防御 Token
    const hasDefensiveTokensResult = hasDefensiveTokens(state, defenderId, damageScope, damage);
    if (hasDefensiveTokensResult) {
        return 'defenderMitigation';
    }
    
    return null;
}
