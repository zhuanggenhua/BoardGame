/**
 * 野蛮人 (Barbarian) 专属 Custom Action 处理器
 */

import { getActiveDice, getFaceCounts, getPlayerDieFace } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { STATUS_IDS, BARBARIAN_DICE_FACE_IDS as FACES } from '../ids';
import type {
    DiceThroneEvent,
    DamageDealtEvent,
    HealAppliedEvent,
    StatusAppliedEvent,
    BonusDieRolledEvent,
    DamageShieldGrantedEvent,
    BonusDieInfo,
} from '../types';
import { buildDrawEvents } from '../deckEvents';
import { registerCustomActionHandler, createDisplayOnlySettlement, type CustomActionContext } from '../effects';

// ============================================================================
// 野蛮人技能处理器
// 注意：骰面以 diceConfig.ts 为准
// ============================================================================

/**
 * 压制 (Suppress)：投掷3骰，造成点数总和的伤害；若总数>14，施加脑震荡
 */
function handleBarbarianSuppressRoll({ ctx, targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];

    // 投掷3个骰子，累加点数总和
    let total = 0;
    for (let i = 0; i < 3; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        total += value;
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.barbarianSuppress',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    // 造成点数总和的伤害
    if (total > 0) {
        const target = state.players[targetId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = target ? Math.min(total, targetHp) : 0;
        ctx.damageDealt += actualDamage;
        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId, amount: total, actualDamage, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
    }

    // 若总数>14，施加脑震荡
    if (total > 14) {
        const opponent = state.players[targetId];
        const currentStacks = opponent?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
        const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.CONCUSSION);
        const maxStacks = def?.stackLimit || 1;
        const newTotal = Math.min(currentStacks + 1, maxStacks);
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId, statusId: STATUS_IDS.CONCUSSION, stacks: 1, newTotal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusAppliedEvent);
    }

    // 多骰展示
    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, dice, timestamp));

    return events;
}

/**
 * 压制 II (Suppress II) 力量变体：投掷3骰，造成点数总和伤害；若总数>9，施加脑震荡
 */
function handleBarbarianSuppress2Roll({ ctx, targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];

    let total = 0;
    for (let i = 0; i < 3; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        total += value;
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.barbarianSuppress',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    if (total > 0) {
        const target = state.players[targetId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = target ? Math.min(total, targetHp) : 0;
        ctx.damageDealt += actualDamage;
        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId, amount: total, actualDamage, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
    }

    // 升级版阈值降低到 >9
    if (total > 9) {
        const opponent = state.players[targetId];
        const currentStacks = opponent?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
        const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.CONCUSSION);
        const maxStacks = def?.stackLimit || 1;
        const newTotal = Math.min(currentStacks + 1, maxStacks);
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId, statusId: STATUS_IDS.CONCUSSION, stacks: 1, newTotal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusAppliedEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, dice, timestamp));
    return events;
}

/**
 * 厚皮 (Thick Skin)：根据心骰面数治疗
 * 防御阶段投掷骰子后，每个心骰面治疗1点
 */
function handleBarbarianThickSkin({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    // 统计心骰面数量
    const faceCounts = getFaceCounts(getActiveDice(state));
    const heartCount = faceCounts[FACES.HEART] ?? 0;

    // 治疗 2 × 心骰面数量
    const healAmount = heartCount * 2;

    // 始终生成治疗事件（即使 heartCount=0），确保 UI 播放防御技能反馈
    events.push({
        type: 'HEAL_APPLIED',
        payload: { targetId, amount: healAmount, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as HealAppliedEvent);

    return events;
}

/**
 * 厚皮 II (Thick Skin II)：根据心骰面数治疗 + 防止1个状态效果
 * 防御阶段投掷骰子后，恢复 2 × 心面数量 的生命值，并防止1个即将受到的状态效果
 */
function handleBarbarianThickSkin2({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    // 统计心骰面数量
    const faceCounts = getFaceCounts(getActiveDice(state));
    const heartCount = faceCounts[FACES.HEART] ?? 0;

    // 治疗 2 × 心骰面数量
    const healAmount = heartCount * 2;

    // 始终生成治疗事件（即使 heartCount=0），确保 UI 播放防御技能反馈
    events.push({
        type: 'HEAL_APPLIED',
        payload: { targetId, amount: healAmount, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as HealAppliedEvent);

    // 若投出 2 个或以上心面，授予状态防护
    if (heartCount >= 2) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: { targetId, value: 1, sourceId: sourceAbilityId, preventStatus: true },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageShieldGrantedEvent);
    }

    return events;
}

/**
 * 精力充沛！(Energetic)：投掷1骰
 * - 星 → 治疗2 + 对对手施加脑震荡
 * - 其他 → 抽1牌
 */
function handleEnergeticRoll({ ctx, targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    const dieValue = random.d(6);
    const face = getPlayerDieFace(state, attackerId, dieValue) ?? '';
    const isStrength = face === FACES.STRENGTH;

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value: dieValue,
            face,
            playerId: attackerId,
            targetPlayerId: targetId,
            effectKey: isStrength ? 'bonusDie.effect.energeticStrength' : 'bonusDie.effect.energeticOther',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (isStrength) {
        // 治疗2点
        events.push({
            type: 'HEAL_APPLIED',
            payload: { targetId: attackerId, amount: 2, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as HealAppliedEvent);

        // 对对手施加脑震荡
        const opponentId = ctx.defenderId;
        const opponent = state.players[opponentId];
        const currentStacks = opponent?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
        const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.CONCUSSION);
        const maxStacks = def?.stackLimit || 1;
        const newTotal = Math.min(currentStacks + 1, maxStacks);

        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: STATUS_IDS.CONCUSSION, stacks: 1, newTotal, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusAppliedEvent);
    } else {
        // 抽1牌
        events.push(...buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp));
    }

    return events;
}

/**
 * 大吉大利！(Lucky)：投掷3骰，治疗 1 + 2×心骰面数
 */
function handleLuckyRollHeal({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];

    let heartCount = 0;
    for (let i = 0; i < 3; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        if (face === FACES.HEART) {
            heartCount++;
        }
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: attackerId,
                effectKey: 'bonusDie.effect.luckyRoll',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    // 治疗 1 + 2×心骰面数
    const healAmount = 1 + 2 * heartCount;
    events.push({
        type: 'HEAL_APPLIED',
        payload: { targetId: attackerId, amount: healAmount, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as HealAppliedEvent);

    // 多骰展示
    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, attackerId, dice, timestamp));

    return events;
}

/**
 * 再来点儿！(More Please)：投掷5骰
 * - 增加 1×剑骰面数 伤害到当前攻击
 * - 施加脑震荡
 */
function handleMorePleaseRollDamage({ ctx, targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    // ctx.defenderId 在进攻上下文中就是对手
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];

    let swordCount = 0;
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        if (face === FACES.SWORD) {
            swordCount++;
        }
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.morePleaseRoll',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    // 直接造成剑骰面数量的伤害（修复：原 accumulatedBonusDamage 无法跨上下文传递）
    if (swordCount > 0) {
        const target = state.players[targetId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = target ? Math.min(swordCount, targetHp) : 0;
        ctx.damageDealt += actualDamage;
        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId, amount: swordCount, actualDamage, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
    }

    // 对对手施加脑震荡
    const opponentId = ctx.defenderId;
    const opponent = state.players[opponentId];
    const currentStacks = opponent?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
    const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.CONCUSSION);
    const maxStacks = def?.stackLimit || 1;
    const newTotal = Math.min(currentStacks + 1, maxStacks);

    events.push({
        type: 'STATUS_APPLIED',
        payload: { targetId: opponentId, statusId: STATUS_IDS.CONCUSSION, stacks: 1, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent);

    // 多骰展示
    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, dice, timestamp));

    return events;
}

// ============================================================================
// 注册所有野蛮人 Custom Action 处理器
// ============================================================================

export function registerBarbarianCustomActions(): void {
    registerCustomActionHandler('barbarian-suppress-roll', handleBarbarianSuppressRoll, {
        categories: ['dice', 'damage', 'status'],
    });
    registerCustomActionHandler('barbarian-suppress-2-roll', handleBarbarianSuppress2Roll, {
        categories: ['dice', 'damage', 'status'],
    });
    registerCustomActionHandler('barbarian-thick-skin', handleBarbarianThickSkin, {
        categories: ['other'],
    });
    registerCustomActionHandler('barbarian-thick-skin-2', handleBarbarianThickSkin2, {
        categories: ['other'],
    });
    registerCustomActionHandler('energetic-roll', handleEnergeticRoll, {
        categories: ['dice', 'resource'],
    });
    registerCustomActionHandler('lucky-roll-heal', handleLuckyRollHeal, {
        categories: ['dice', 'resource'],
    });
    registerCustomActionHandler('more-please-roll-damage', handleMorePleaseRollDamage, {
        categories: ['dice', 'damage', 'status'],
    });
}
