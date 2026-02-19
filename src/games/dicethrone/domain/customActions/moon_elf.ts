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
import { STATUS_IDS, TOKEN_IDS, MOON_ELF_DICE_FACE_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
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
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';

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

/** 造成伤害并返回事件
 * 
 * 【已迁移到新伤害计算管线】
 */
function dealDamage(
    ctx: CustomActionContext,
    targetId: string,
    amount: number,
    sourceAbilityId: string,
    timestamp: number
): DamageDealtEvent {
    // 使用新伤害计算管线
    const damageCalc = createDamageCalculation({
        source: { playerId: ctx.attackerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: amount,
        state: ctx.state,
        timestamp,
        autoCollectTokens: false,
        autoCollectStatus: true,  // 启用状态修正收集（锁定等 debuff）
        autoCollectShields: false,
    });
    
    const events = damageCalc.toEvents();
    return events[0] as DamageDealtEvent;
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
 * 爆裂箭 I：投掷5骰，造成 3 + 2×弓 + 1×足 伤害，对手丢失 1×月 CP，造成致盲
 * 
 * 图片规则：
 * - 掷骰5骰
 * - 造成 3 + 2×弓面数 + 1×足面数 伤害
 * - 另外对手丢失 1×月面数 CP
 * - 造成致盲
 */
function handleExplodingArrowResolve1(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    // 投掷5骰
    const diceValues: number[] = [];
    const diceFaces: string[] = [];
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        diceValues.push(value);
        diceFaces.push(face);
    }

    // 统计骰面
    const faceCounts: Record<string, number> = {};
    diceFaces.forEach(face => {
        faceCounts[face] = (faceCounts[face] || 0) + 1;
    });

    const bowCount = faceCounts[FACE.BOW] || 0;
    const footCount = faceCounts[FACE.FOOT] || 0;
    const moonCount = faceCounts[FACE.MOON] || 0;

    // 发射骰子事件（显示5骰结果汇总）
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { 
            value: diceValues[0], // 主要显示第一个骰子
            face: diceFaces[0], 
            playerId: attackerId, 
            targetPlayerId: targetId, 
            effectKey: 'bonusDie.effect.explodingArrow.result', 
            effectParams: { 
                bowCount,
                footCount,
                moonCount,
                damage: 3 + (2 * bowCount) + (1 * footCount)
            } 
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    // 计算伤害：3 + 2×弓 + 1×足
    const damageAmount = 3 + (2 * bowCount) + (1 * footCount);
    if (damageAmount > 0) {
        events.push(dealDamage(context, targetId, damageAmount, sourceAbilityId, timestamp + 1));
    }

    // 对手丢失 1×月 CP
    if (moonCount > 0) {
        const targetPlayer = state.players[targetId];
        const currentCp = targetPlayer?.resources[RESOURCE_IDS.CP] ?? 0;
        const cpLoss = moonCount;
        const newCp = Math.max(0, currentCp - cpLoss);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: -cpLoss, newValue: newCp, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as import('../types').CpChangedEvent);
    }

    // 造成致盲
    events.push(applyStatus(targetId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp + 3));

    return events;
}

/**
 * 爆裂箭 II：投掷1骰，造成骰值+1伤害
 */
function handleExplodingArrowResolve2(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    // 投掷5骰
    const diceValues: number[] = [];
    const diceFaces: string[] = [];
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        diceValues.push(value);
        diceFaces.push(face);
    }

    // 统计骰面
    const faceCounts: Record<string, number> = {};
    diceFaces.forEach(face => {
        faceCounts[face] = (faceCounts[face] || 0) + 1;
    });

    const bowCount = faceCounts[FACE.BOW] || 0;
    const footCount = faceCounts[FACE.FOOT] || 0;
    const moonCount = faceCounts[FACE.MOON] || 0;

    // 发射骰子事件
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { 
            value: diceValues[0],
            face: diceFaces[0], 
            playerId: attackerId, 
            targetPlayerId: targetId, 
            effectKey: 'bonusDie.effect.explodingArrow.result',
            effectParams: {
                bowCount,
                footCount,
                moonCount,
                damage: 3 + (1 * bowCount) + (2 * footCount)
            }
        }
    });

    // 计算伤害：3 + 1×弓 + 2×足（II级公式与I级不同，与III级相同）
    const damageAmount = 3 + (1 * bowCount) + (2 * footCount);
    if (damageAmount > 0) {
        events.push(dealDamage(context, targetId, damageAmount, sourceAbilityId, timestamp + 1));
    }

    // 对手丢失 1×月 CP
    if (moonCount > 0) {
        const targetPlayer = state.players[targetId];
        const currentCp = targetPlayer?.resources[RESOURCE_IDS.CP] ?? 0;
        const cpLoss = moonCount;
        const newCp = Math.max(0, currentCp - cpLoss);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: -cpLoss, newValue: newCp, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as import('../types').CpChangedEvent);
    }

    // 施加致盲（II级只有致盲，无缠绕）
    events.push(applyStatus(targetId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp + 3));

    return events;
}

/**
 * 爆裂箭 III：投掷1骰，造成骰值+2伤害，并施加缠绕
 */
function handleExplodingArrowResolve3(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    // 投掷5骰
    const diceValues: number[] = [];
    const diceFaces: string[] = [];
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        diceValues.push(value);
        diceFaces.push(face);
    }

    // 统计骰面
    const faceCounts: Record<string, number> = {};
    diceFaces.forEach(face => {
        faceCounts[face] = (faceCounts[face] || 0) + 1;
    });

    const bowCount = faceCounts[FACE.BOW] || 0;
    const footCount = faceCounts[FACE.FOOT] || 0;
    const moonCount = faceCounts[FACE.MOON] || 0;

    // 发射骰子事件
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { 
            value: diceValues[0],
            face: diceFaces[0], 
            playerId: attackerId, 
            targetPlayerId: targetId, 
            effectKey: 'bonusDie.effect.explodingArrow.result',
            effectParams: {
                bowCount,
                footCount,
                moonCount,
                damage: 3 + (1 * bowCount) + (2 * footCount)
            }
        }
    });

    // 计算伤害：3 + 1×弓 + 2×足（III级公式与I级不同）
    const damageAmount = 3 + (1 * bowCount) + (2 * footCount);
    if (damageAmount > 0) {
        events.push(dealDamage(context, targetId, damageAmount, sourceAbilityId, timestamp + 1));
    }

    // 对手丢失 1×月 CP
    if (moonCount > 0) {
        const targetPlayer = state.players[targetId];
        const currentCp = targetPlayer?.resources[RESOURCE_IDS.CP] ?? 0;
        const cpLoss = moonCount;
        const newCp = Math.max(0, currentCp - cpLoss);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: -cpLoss, newValue: newCp, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as import('../types').CpChangedEvent);
    }

    // 施加致盲和缠绕
    events.push(applyStatus(targetId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp + 3));
    events.push(applyStatus(targetId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp + 4));

    return events;
}

// ============================================================================
// 迷影步结算 (Elusive Step Resolve)
// ============================================================================

/**
 * 迷影步 I：防御掷骰，统计足(FOOT)数量
 * 图片规则：
 * - 若足面≥2，抵挡一半伤害（向上取整）
 * - 每有足面，造成1伤害
 */
function handleElusiveStepResolve1(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, ctx } = context;
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const footCount = faceCounts[FACE.FOOT] ?? 0;
    // 防御上下文：ctx.attackerId = 防御者，ctx.defenderId = 原攻击者
    const opponentId = ctx.defenderId;

    // 每个足面造成1伤害
    if (footCount > 0) {
        events.push(dealDamage(context, opponentId, footCount, sourceAbilityId, timestamp));
    }

    // 足面≥2时，抵挡一半伤害（向上取整）
    if (footCount >= 2 && state.pendingAttack) {
        const originalDamage = state.pendingAttack.damage + (state.pendingAttack.bonusDamage ?? 0);
        const reducedDamage = Math.ceil(originalDamage / 2);
        const reduction = originalDamage - reducedDamage;
        
        if (reduction > 0) {
            events.push({
                type: 'PREVENT_DAMAGE',
                payload: { targetId: attackerId, amount: reduction, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as any);
        }
    }

    return events;
}

/**
 * 迷影步 II：防御掷骰，统计足(FOOT)数量
 * 图片规则（推测升级版）：
 * - 若足面≥2，抵挡一半伤害（向上取整）
 * - 每有足面，造成1伤害
 * - 额外：足面≥3时获得1闪避
 */
function handleElusiveStepResolve2(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, ctx } = context;
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const footCount = faceCounts[FACE.FOOT] ?? 0;
    const bowCount = faceCounts[FACE.BOW] ?? 0;
    // 防御上下文：ctx.attackerId = 防御者，ctx.defenderId = 原攻击者
    const opponentId = ctx.defenderId;

    // 造成 1×弓面数 伤害（升级版改为弓面计算）
    if (bowCount > 0) {
        events.push(dealDamage(context, opponentId, bowCount, sourceAbilityId, timestamp));
    }

    // 足面≥2时，防止一半伤害（向上取整）
    if (footCount >= 2 && state.pendingAttack) {
        const originalDamage = state.pendingAttack.damage + (state.pendingAttack.bonusDamage ?? 0);
        const reducedDamage = Math.ceil(originalDamage / 2);
        const reduction = originalDamage - reducedDamage;
        
        if (reduction > 0) {
            events.push({
                type: 'PREVENT_DAMAGE',
                payload: { targetId: attackerId, amount: reduction, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as any);
        }
    }

    return events;
}

// ============================================================================
// 行动卡逻辑
// ============================================================================

/**
 * 月影袭人 (Moon Shadow Strike)：投掷1骰判定
 * - 月(MOON)：施加致盲 + 缠绕 + 锁定
 * - 其他：抽1张牌
 */
function handleMoonShadowStrike(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    
    // 根据骰面设置不同的 effectKey
    const isMoon = face === FACE.MOON;
    const effectKey = isMoon 
        ? 'bonusDie.effect.moonShadowStrike.moon'  // 月面：施加debuff
        : 'bonusDie.effect.moonShadowStrike.other'; // 其他：抽牌
    
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: targetId, effectKey, effectParams: { value } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (isMoon) {
        // 月：施加致盲 + 缠绕 + 锁定
        events.push(applyStatus(targetId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp));
        events.push(applyStatus(targetId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));
        events.push(applyStatus(targetId, STATUS_IDS.TARGETED, 1, sourceAbilityId, state, timestamp));
    } else {
        // 非月：抽1张牌
        events.push(...buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId));
    }

    return events;
}

/**
 * 万箭齐发 (Volley)：攻击修正。投掷5骰，增加弓面数×1伤害，施加缠绕
 */
function handleVolley(context: CustomActionContext): DiceThroneEvent[] {
    const { targetId, attackerId, sourceAbilityId, state, timestamp, random } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    // 投掷5骰，统计弓面数量
    const diceValues: number[] = [];
    const diceFaces: string[] = [];
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        diceValues.push(value);
        diceFaces.push(face);
    }
    
    const bowCount = diceFaces.filter(f => f === FACE.BOW).length;
    
    // 发射一个汇总事件，显示弓面数量和伤害加成
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { 
            value: diceValues[0], 
            face: diceFaces[0], 
            playerId: attackerId, 
            targetPlayerId: targetId, 
            effectKey: 'bonusDie.effect.volley.result', 
            effectParams: { bowCount, bonusDamage: bowCount } 
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    // 增加弓面数量的伤害（作为攻击修正加到 pendingAttack）
    if (bowCount > 0 && state.pendingAttack && state.pendingAttack.attackerId === attackerId) {
        state.pendingAttack.bonusDamage = (state.pendingAttack.bonusDamage ?? 0) + bowCount;
    }

    // 施加缠绕
    events.push(applyStatus(targetId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));

    return events;
}

/**
 * 看箭 (Watch Out)：攻击修正。投掷1骰判定
 * - 弓(BOW)：增加2伤害
 * - 足(FOOT)：施加缠绕
 * - 月(MOON)：施加致盲
 */
function handleWatchOut(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random, ctx } = context;
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.defenderId;

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: opponentId, effectKey: 'bonusDie.effect.watchOut', effectParams: { value } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (face === FACE.BOW) {
        // 弓：增加2伤害（攻击修正）
        if (state.pendingAttack && state.pendingAttack.attackerId === attackerId) {
            state.pendingAttack.bonusDamage = (state.pendingAttack.bonusDamage ?? 0) + 2;
        }
    } else if (face === FACE.FOOT) {
        // 足：施加缠绕
        events.push(applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));
    } else if (face === FACE.MOON) {
        // 月：施加致盲
        events.push(applyStatus(opponentId, STATUS_IDS.BLINDED, 1, sourceAbilityId, state, timestamp));
    }

    return events;
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
    
    // 根据骰值设置不同的 effectKey
    const isMiss = value <= 2;
    const effectKey = isMiss
        ? 'bonusDie.effect.blinded.miss'  // 1-2：攻击失败
        : 'bonusDie.effect.blinded.hit';   // 3-6：攻击成功
    
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: attackerId, effectKey },
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
    if (isMiss) {
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

    // 减少1次掷骰机会（3 -> 2）
    // 注意：此 handler 在 offensiveRoll 阶段触发，但 state.rollLimit 可能还是旧阶段的值，
    // 因此基于默认值 3 计算，确保结果始终是 2。
    const defaultOffensiveRollLimit = 3;
    const newLimit = defaultOffensiveRollLimit - 1;
    const delta = -1;
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

// 锁定 (Targeted) 是持续效果，受伤时 +2 伤害，不会自动移除。
// 伤害修正通过 TokenDef.passiveTrigger.actions[modifyStat]，由 createDamageCalculation 的 collectStatusModifiers 自动处理。
// 移除只能通过净化等主动手段。

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
        categories: ['dice', 'damage', 'status', 'resource'],
    });
    registerCustomActionHandler('moon_elf-exploding-arrow-resolve-2', handleExplodingArrowResolve2, {
        categories: ['dice', 'damage', 'status', 'resource'],
    });
    registerCustomActionHandler('moon_elf-exploding-arrow-resolve-3', handleExplodingArrowResolve3, {
        categories: ['dice', 'damage', 'status', 'resource'],
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
        categories: ['dice', 'status'],
    });
    registerCustomActionHandler('moon_elf-action-watch-out', handleWatchOut, {
        categories: ['dice', 'status'],
    });

    // 状态效果钩子
    registerCustomActionHandler('moon_elf-blinded-check', handleBlindedCheck, {
        categories: ['dice', 'status'],
    });
    registerCustomActionHandler('moon_elf-entangle-effect', handleEntangleEffect, {
        categories: ['dice', 'status'],
    });
    // 锁定 (Targeted) 是持续效果，无需注册移除 handler
}
