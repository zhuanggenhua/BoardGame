/**
 * 月精灵 (Moon Elf) 专属 Custom Action 处理器
 *
 * 包含：
 * - 长弓连击判定 (Longbow Bonus Check)
 * - 爆裂箭结算 (Exploding Arrow Resolve)
 * - 迷影步结算 (Elusive Step Resolve)
 * - 行动卡逻辑 (Moon Shadow Strike / Volley / Watch Out)
 */

import { getActiveDice, getFaceCounts, getPlayerDieFace } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { STATUS_IDS, TOKEN_IDS, MOON_ELF_DICE_FACE_IDS } from '../ids';
import type {
    DiceThroneEvent,
    DamageDealtEvent,
    StatusAppliedEvent,
    StatusRemovedEvent,
    TokenGrantedEvent,
    BonusDieRolledEvent,
    RollLimitChangedEvent,
} from '../types';
import { buildDrawEvents } from '../deckEvents';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';

const FACE = MOON_ELF_DICE_FACE_IDS;

// ============================================================================
// 辅助函数
// ============================================================================

/** 施加状态效果并返回事件 */
function applyStatus(
    targetId: string,
    statusId: string,
    stacks: number,
    sourceAbilityId: string,
    state: CustomActionContext['state'],
    timestamp: number
): StatusAppliedEvent {
    const target = state.players[targetId];
    const currentStacks = target?.statusEffects[statusId] ?? 0;
    const def = state.tokenDefinitions.find(e => e.id === statusId);
    const maxStacks = def?.stackLimit || 99;
    const newTotal = Math.min(currentStacks + stacks, maxStacks);
    return {
        type: 'STATUS_APPLIED',
        payload: { targetId, statusId, stacks, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
}

/** 造成伤害并返回事件 */
function dealDamage(
    ctx: CustomActionContext,
    targetId: string,
    amount: number,
    sourceAbilityId: string,
    timestamp: number
): DamageDealtEvent {
    const target = ctx.state.players[targetId];
    const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
    const actualDamage = target ? Math.min(amount, targetHp) : 0;
    ctx.ctx.damageDealt += actualDamage;
    return {
        type: 'DAMAGE_DEALT',
        payload: { targetId, amount, actualDamage, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
}

// ============================================================================
// 长弓连击判定 (Longbow Bonus Check)
// ============================================================================

/**
 * 长弓 II 连击：检查攻击骰面是否有 ≥4 个相同，若是则施加缠绕
 * 注意：postDamage 时骰子已被防御阶段重置，必须使用 pendingAttack 快照
 */
function handleLongbowBonusCheck4(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, sourceAbilityId, state, timestamp } = context;
    const faceCounts = state.pendingAttack?.attackDiceFaceCounts;
    if (!faceCounts) return [];
    const hasMatch = Object.values(faceCounts).some(count => count >= 4);
    if (!hasMatch) return [];
    return [applyStatus(targetId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp)];
}

/**
 * 长弓 III 连击：检查攻击骰面是否有 ≥3 个相同，若是则施加缠绕
 * 注意：postDamage 时骰子已被防御阶段重置，必须使用 pendingAttack 快照
 */
function handleLongbowBonusCheck3(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, sourceAbilityId, state, timestamp } = context;
    const faceCounts = state.pendingAttack?.attackDiceFaceCounts;
    if (!faceCounts) return [];
    const hasMatch = Object.values(faceCounts).some(count => count >= 3);
    if (!hasMatch) return [];
    return [applyStatus(targetId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp)];
}

// ============================================================================
// 爆裂箭结算 (Exploding Arrow Resolve)
// ============================================================================

/**
 * 爆裂箭 I：投掷1骰，造成骰值伤害
 */
function handleExplodingArrowResolve1(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.explodingArrow', effectParams: { value } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    // 造成骰值点伤害
    events.push(dealDamage(context, targetId, value, sourceAbilityId, timestamp));

    return events;
}

/**
 * 爆裂箭 II：投掷1骰，造成骰值+1伤害
 */
function handleExplodingArrowResolve2(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.explodingArrow', effectParams: { value } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    events.push(dealDamage(context, targetId, value + 1, sourceAbilityId, timestamp));

    return events;
}

/**
 * 爆裂箭 III：投掷1骰，造成骰值+2伤害，并施加缠绕
 */
function handleExplodingArrowResolve3(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.explodingArrow', effectParams: { value } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    events.push(dealDamage(context, targetId, value + 2, sourceAbilityId, timestamp));
    events.push(applyStatus(targetId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));

    return events;
}

// ============================================================================
// 迷影步结算 (Elusive Step Resolve)
// ============================================================================

/**
 * 迷影步 I：防御掷骰，统计足(FOOT)数量
 * - 1个足：造成2伤害
 * - 2个足：造成2伤害 + 获得1闪避
 * - 3+个足：造成4伤害 + 获得1闪避
 */
function handleElusiveStepResolve1(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, ctx } = context;
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const footCount = faceCounts[FACE.FOOT] ?? 0;
    // 防御上下文：ctx.attackerId = 防御者，ctx.defenderId = 原攻击者
    const opponentId = ctx.defenderId;

    if (footCount >= 3) {
        events.push(dealDamage(context, opponentId, 4, sourceAbilityId, timestamp));
        // 获得闪避
        const current = state.players[attackerId]?.tokens[TOKEN_IDS.EVASIVE] ?? 0;
        const maxStacks = 3;
        const newTotal = Math.min(current + 1, maxStacks);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.EVASIVE, amount: 1, newTotal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as TokenGrantedEvent);
    } else if (footCount >= 2) {
        events.push(dealDamage(context, opponentId, 2, sourceAbilityId, timestamp));
        const current = state.players[attackerId]?.tokens[TOKEN_IDS.EVASIVE] ?? 0;
        const maxStacks = 3;
        const newTotal = Math.min(current + 1, maxStacks);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.EVASIVE, amount: 1, newTotal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as TokenGrantedEvent);
    } else if (footCount >= 1) {
        events.push(dealDamage(context, opponentId, 2, sourceAbilityId, timestamp));
    }

    return events;
}

/**
 * 迷影步 II：防御掷骰，统计足(FOOT)数量
 * - 1个足：造成3伤害
 * - 2个足：造成3伤害 + 获得1闪避
 * - 3+个足：造成5伤害 + 获得1闪避 + 施加缠绕
 */
function handleElusiveStepResolve2(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, ctx } = context;
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const footCount = faceCounts[FACE.FOOT] ?? 0;
    // 防御上下文：ctx.attackerId = 防御者，ctx.defenderId = 原攻击者
    const opponentId = ctx.defenderId;

    if (footCount >= 3) {
        events.push(dealDamage(context, opponentId, 5, sourceAbilityId, timestamp));
        const current = state.players[attackerId]?.tokens[TOKEN_IDS.EVASIVE] ?? 0;
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.EVASIVE, amount: 1, newTotal: Math.min(current + 1, 3), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as TokenGrantedEvent);
        events.push(applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));
    } else if (footCount >= 2) {
        events.push(dealDamage(context, opponentId, 3, sourceAbilityId, timestamp));
        const current = state.players[attackerId]?.tokens[TOKEN_IDS.EVASIVE] ?? 0;
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.EVASIVE, amount: 1, newTotal: Math.min(current + 1, 3), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as TokenGrantedEvent);
    } else if (footCount >= 1) {
        events.push(dealDamage(context, opponentId, 3, sourceAbilityId, timestamp));
    }

    return events;
}

// ============================================================================
// 行动卡逻辑
// ============================================================================

/**
 * 月影突袭 (Moon Shadow Strike)：投掷1骰判定
 * - 弓(BOW)：抽1张牌
 * - 足(FOOT)：施加缠绕
 * - 月(MOON)：施加致盲 + 锁定
 */
function handleMoonShadowStrike(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.moonShadowStrike', effectParams: { value } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (face === FACE.BOW) {
        // 抽1张牌
        events.push(...buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp));
    } else if (face === FACE.FOOT) {
        // 施加缠绕
        events.push(applyStatus(targetId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));
    } else if (face === FACE.MOON) {
        // 施加致盲 + 锁定
        events.push(applyStatus(targetId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp));
        events.push(applyStatus(targetId, STATUS_IDS.TARGETED, 1, sourceAbilityId, state, timestamp));
    }

    return events;
}

/**
 * 齐射 (Volley)：本次攻击伤害 +3
 * 实现方式：通过 pendingAttack.bonusDamage 增加伤害
 */
function handleVolley(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, state } = context;
    // 通过修改 pendingAttack 的 bonusDamage 来增加伤害
    // 由于 custom action 只能返回事件，我们通过累加 ctx 的 accumulatedBonusDamage 来实现
    if (state.pendingAttack && state.pendingAttack.attackerId === attackerId) {
        state.pendingAttack.bonusDamage = (state.pendingAttack.bonusDamage ?? 0) + 3;
    }
    // Volley 的效果是修改状态而非生成事件，返回空
    return [];
}

/**
 * 小心！(Watch Out)：施加锁定给对手
 */
function handleWatchOut(context: CustomActionContext): DiceThroneEvent[] {
    const { sourceAbilityId, state, timestamp, ctx } = context;
    // 进攻上下文：ctx.defenderId = 对手
    const opponentId = ctx.defenderId;
    return [applyStatus(opponentId, STATUS_IDS.TARGETED, 1, sourceAbilityId, state, timestamp)];
}

// ============================================================================
// 状态效果钩子
// ============================================================================

/**
 * 致盲判定 (Blinded Check)：攻击方有致盲时，投掷1骰
 * - 1-2：攻击无效（伤害归零）
 * - 3-6：攻击正常
 * 判定后移除致盲状态
 */
function handleBlindedCheck(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: attackerId, effectKey: 'bonusDie.effect.blinded' },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    // 移除致盲状态（一次性）
    const currentStacks = state.players[attackerId]?.statusEffects[STATUS_IDS.BLINDED] ?? 0;
    if (currentStacks > 0) {
        events.push({
            type: 'STATUS_REMOVED',
            payload: { targetId: attackerId, statusId: STATUS_IDS.BLINDED, stacks: currentStacks },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusRemovedEvent);
    }

    // 1-2：攻击失败，将 pendingAttack 标记为无效
    if (value <= 2) {
        // 通过将 pendingAttack 的 sourceAbilityId 清空来使攻击无效
        // 这样 resolveAttack 不会产生伤害事件
        if (state.pendingAttack) {
            state.pendingAttack.sourceAbilityId = undefined;
        }
    }

    return events;
}

/**
 * 缠绕效果 (Entangle Effect)：减少攻击方的掷骰次数
 * 在进攻掷骰阶段开始时检查并应用
 */
function handleEntangleEffect(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp } = context;
    const events: DiceThroneEvent[] = [];

    // 减少1次掷骰机会
    const currentLimit = state.rollLimit ?? 3;
    const newLimit = Math.max(0, currentLimit - 1);
    const delta = newLimit - currentLimit;
    events.push({
        type: 'ROLL_LIMIT_CHANGED',
        payload: { playerId: attackerId, delta, newLimit, sourceCardId: sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as RollLimitChangedEvent);

    // 移除缠绕状态（一次性）
    const currentStacks = state.players[attackerId]?.statusEffects[STATUS_IDS.ENTANGLE] ?? 0;
    if (currentStacks > 0) {
        events.push({
            type: 'STATUS_REMOVED',
            payload: { targetId: attackerId, statusId: STATUS_IDS.ENTANGLE, stacks: currentStacks },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusRemovedEvent);
    }

    return events;
}

/**
 * 锁定效果 (Targeted Effect)：增加受到的伤害 +2
 * 在伤害结算时由 resolveEffectAction 的 damage 分支检查
 * 这里提供一个钩子用于在攻击结算后移除锁定
 */
function handleTargetedRemoval(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, state, timestamp } = context;
    const events: DiceThroneEvent[] = [];

    const currentStacks = state.players[targetId]?.statusEffects[STATUS_IDS.TARGETED] ?? 0;
    if (currentStacks > 0) {
        events.push({
            type: 'STATUS_REMOVED',
            payload: { targetId, statusId: STATUS_IDS.TARGETED, stacks: currentStacks },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusRemovedEvent);
    }

    return events;
}

// ============================================================================
// 注册
// ============================================================================

export function registerMoonElfCustomActions(): void {
    // 长弓连击判定
    registerCustomActionHandler('moon_elf-longbow-bonus-check-4', handleLongbowBonusCheck4, {
        categories: ['status'],
    });
    registerCustomActionHandler('moon_elf-longbow-bonus-check-3', handleLongbowBonusCheck3, {
        categories: ['status'],
    });

    // 爆裂箭结算
    registerCustomActionHandler('moon_elf-exploding-arrow-resolve-1', handleExplodingArrowResolve1, {
        categories: ['dice', 'damage'],
    });
    registerCustomActionHandler('moon_elf-exploding-arrow-resolve-2', handleExplodingArrowResolve2, {
        categories: ['dice', 'damage'],
    });
    registerCustomActionHandler('moon_elf-exploding-arrow-resolve-3', handleExplodingArrowResolve3, {
        categories: ['dice', 'damage', 'status'],
    });

    // 迷影步结算
    registerCustomActionHandler('moon_elf-elusive-step-resolve-1', handleElusiveStepResolve1, {
        categories: ['dice', 'damage', 'defense', 'token'],
    });
    registerCustomActionHandler('moon_elf-elusive-step-resolve-2', handleElusiveStepResolve2, {
        categories: ['dice', 'damage', 'defense', 'token', 'status'],
    });

    // 行动卡
    registerCustomActionHandler('moon_elf-action-moon-shadow-strike', handleMoonShadowStrike, {
        categories: ['dice', 'status', 'resource'],
    });
    registerCustomActionHandler('moon_elf-action-volley', handleVolley, {
        categories: ['other'],
    });
    registerCustomActionHandler('moon_elf-action-watch-out', handleWatchOut, {
        categories: ['status'],
    });

    // 状态效果钩子
    registerCustomActionHandler('moon_elf-blinded-check', handleBlindedCheck, {
        categories: ['dice', 'status'],
    });
    registerCustomActionHandler('moon_elf-entangle-effect', handleEntangleEffect, {
        categories: ['dice', 'status'],
    });
    registerCustomActionHandler('moon_elf-targeted-removal', handleTargetedRemoval, {
        categories: ['status'],
    });
}
