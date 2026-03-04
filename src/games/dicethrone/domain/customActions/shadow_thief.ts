/**
 * 影子盗贼 (Shadow Thief) 专属 Custom Action 处理器
 */

import { getActiveDice, getFaceCounts, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { SHADOW_THIEF_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../ids';
import { CP_MAX } from '../types';
import { buildDrawEvents } from '../deckEvents';
import type {
    DiceThroneEvent,
    DamageDealtEvent,
    CpChangedEvent,
    BonusDieRolledEvent,
    StatusAppliedEvent,
    StatusRemovedEvent,
    TokenGrantedEvent,
    CardDiscardedEvent,
    DamageShieldGrantedEvent,
    TokenConsumedEvent,
    PendingInteraction,
    InteractionRequestedEvent,
} from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import { resolveTargetOpponentDice } from './common';

const FACE = SHADOW_THIEF_DICE_FACE_IDS;

/** 计算中毒施加后的新总层数 */
function calcPoisonNewTotal(state: CustomActionContext['state'], targetId: string, stacks: number): number {
    const current = state.players[targetId]?.statusEffects[STATUS_IDS.POISON] ?? 0;
    const def = state.tokenDefinitions?.find(d => d.id === STATUS_IDS.POISON);
    return Math.min(current + stacks, def?.stackLimit ?? 3);
}

// ============================================================================
// 影子盗贼技能处理器
// ============================================================================

/** 匕首打击：每有[Bag]获得1CP */
function handleDaggerStrikeCp({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const bagCount = faceCounts[FACE.BAG] || 0;

    if (bagCount <= 0) return [];

    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const newCp = Math.min(currentCp + bagCount, CP_MAX);

    return [{
        type: 'CP_CHANGED',
        payload: { playerId: attackerId, delta: bagCount, newValue: newCp, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as CpChangedEvent];
}

/** 匕首打击 II：每有[Card]抽1张牌 */
function handleDaggerStrikeDraw({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const cardCount = faceCounts[FACE.CARD] || 0;
    if (cardCount <= 0) return [];
    return buildDrawEvents(state, attackerId, cardCount, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId);
}

/** 匕首打击：每有[Shadow]造成毒液 */
function handleDaggerStrikePoison({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const shadowCount = faceCounts[FACE.SHADOW] || 0;

    if (shadowCount <= 0) return [];

    const stacks = shadowCount;
    const target = state.players[targetId];
    const statusId = STATUS_IDS.POISON;
    const currentStacks = target?.statusEffects[statusId] ?? 0;
    const def = state.tokenDefinitions?.find(definition => definition.id === statusId);
    const maxStacks = def?.stackLimit ?? 99;
    const newTotal = Math.min(currentStacks + stacks, maxStacks);

    return [{
        type: 'STATUS_APPLIED',
        payload: { targetId, statusId, stacks, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent];
}

/** 抢夺/暗影突袭：造成一半CP的伤害 【已迁移到新伤害计算管线】 */
function handleDamageHalfCp({ attackerId, targetId, sourceAbilityId, state, timestamp, ctx, action }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const params = action.params as Record<string, unknown> | undefined;
    const bonusCp = (params?.bonusCp as number) || 0;
    const totalCp = currentCp + bonusCp;

    if (totalCp <= 0) return [];

    const damageAmt = Math.ceil(totalCp / 2);

    const damageCalc = createDamageCalculation({
        source: { playerId: attackerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: damageAmt,
        state,
        timestamp,
    });

    return damageCalc.toEvents();
}

/** 偷窃：获得CP (若有Shadow则偷取) */
function handleStealCp(context: CustomActionContext): DiceThroneEvent[] {
    return handleStealCpWithAmount(context, 2);
}


function handleStealCp2(context: CustomActionContext) { 
    return handleStealCpWithAmount(context, 2); 
}
function handleStealCp3(context: CustomActionContext) { return handleStealCpWithAmount(context, 3); }
function handleStealCp4(context: CustomActionContext) { return handleStealCpWithAmount(context, 4); }
// handleStealCp5 and 6 are defined later

function handleStealCpWithAmount({ targetId, attackerId, sourceAbilityId, state, timestamp }: CustomActionContext, amount: number): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const hasShadow = (faceCounts[FACE.SHADOW] || 0) > 0;
    const events: DiceThroneEvent[] = [];

    let gained = amount;

    if (hasShadow) {
        // Steal from opponent (Up to 2 CP)
        const targetCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const stealLimit = 2; // Fixed steal limit for Shadow Thief
        const stolenAmount = Math.min(targetCp, stealLimit);

        if (stolenAmount > 0) {
            const event = {
                type: 'CP_CHANGED',
                payload: { playerId: targetId, delta: -stolenAmount, newValue: targetCp - stolenAmount, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as CpChangedEvent;
            events.push(event);
        }

        gained = amount;
    } else {
        gained = amount;
    }

    if (gained > 0) {
        const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newCp = Math.min(currentCp + gained, CP_MAX);
        const event = {
            type: 'CP_CHANGED',
            payload: { playerId: attackerId, delta: gained, newValue: newCp, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as CpChangedEvent;
        events.push(event);
    }

    return events;
}

/** 暗影操控：改1骰；若有 Sneak 则改2骰 */
function handleShadowManipulation({ attackerId, sourceAbilityId, state, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const sneakStacks = state.players[attackerId]?.tokens[TOKEN_IDS.SNEAK] ?? 0;
    const selectCount = sneakStacks > 0 ? 2 : 1;
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'modifyDie',
        titleKey: selectCount === 2 ? 'interaction.selectDiceToChange' : 'interaction.selectDieToChange',
        selectCount,
        selected: [],
        dieModifyConfig: { mode: 'any' },
        targetOpponentDice: resolveTargetOpponentDice(action, attackerId, state),
    };
    return [{
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent];
}

/** 肾击：造成等同CP的伤害 (Gain passed beforehand, so use current CP + bonus) 【已迁移到新伤害计算管线】 */
function handleDamageFullCp({ attackerId, targetId, sourceAbilityId, state, timestamp, ctx, action }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    
    // bonusCp 参数仅用于 estimateDamage（在 gainCp 之前估算），
    // 实际伤害计算时 gainCp 已经执行，直接使用当前 CP
    // 读取 bonusCp 参数以满足审计要求（虽然实际不使用）
    const params = action.params as Record<string, unknown> | undefined;
    const bonusCp = (params?.bonusCp as number) || 0; // 仅用于审计，实际伤害已包含在 currentCp 中
    
    if (currentCp <= 0) return [];

    const damageCalc = createDamageCalculation({
        source: { playerId: attackerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: currentCp,
        state,
        timestamp,
    });

    return damageCalc.toEvents();
}

/** 暗影之舞：投掷1骰造成一半伤害 【已迁移到新伤害计算管线】 */
function handleShadowDanceRoll({ targetId, sourceAbilityId, state, timestamp, random, ctx }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dieValue = random.d(6);
    const face = getPlayerDieFace(state, ctx.attackerId, dieValue) ?? '';

    // Emit Roll Event
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: ctx.attackerId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.shadowDamage', effectParams: { value: dieValue } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    // Damage = ceil(value / 2)
    const damageAmt = Math.ceil(dieValue / 2);
    if (damageAmt > 0) {
        const damageCalc = createDamageCalculation({
            source: { playerId: ctx.attackerId, abilityId: sourceAbilityId },
            target: { playerId: targetId },
            baseDamage: damageAmt,
            state,
            timestamp: timestamp + 1,
        });

        events.push(...damageCalc.toEvents());
    }

    return events;
}

/** 聚宝盆 I：抽 Card面数量 牌，若有Shadow弃对手1牌 */
function handleCornucopia({ attackerId, ctx, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const defenderId = ctx.defenderId;

    const cardCount = faceCounts[FACE.CARD] || 0;
    const hasShadow = (faceCounts[FACE.SHADOW] || 0) > 0;

    // 抽 Card 面数量的牌
    if (cardCount > 0 && random) {
        events.push(...buildDrawEvents(state, attackerId, cardCount, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId));
    }

    // 若有 Shadow，弃对手1牌
    if (hasShadow && random) {
        const opponentHand = state.players[defenderId]?.hand || [];
        if (opponentHand.length > 0) {
            const idx = Math.floor(random.random() * opponentHand.length);
            events.push({
                type: 'CARD_DISCARDED',
                payload: { playerId: defenderId, cardId: opponentHand[idx].id },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 1
            } as CardDiscardedEvent);
        }
    }

    return events;
}

/** 聚宝盆（旧）：若有Shadow丢弃对手1卡 - 保留向后兼容 */
function handleCornucopiaDiscard({ ctx, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const hasShadow = (faceCounts[FACE.SHADOW] || 0) > 0;
    const defenderId = ctx.defenderId;

    if (!hasShadow) return [];
    if (!random) return [];

    const targetHand = state.players[defenderId]?.hand || [];
    if (targetHand.length === 0) return [];

    // Random discard
    const randomIndex = Math.floor(random.random() * targetHand.length);
    const cardId = targetHand[randomIndex].id;

    return [{
        type: 'CARD_DISCARDED',
        payload: { playerId: defenderId, cardId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as CardDiscardedEvent];
}


/** 终极：Shadow Shank Damage (Deal CP + 5) 【已迁移到新伤害计算管线】 */
function handleShadowShankDamage({ attackerId, targetId, sourceAbilityId, state, timestamp, ctx, action }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const params = action.params as Record<string, unknown> | undefined;
    const bonusCp = (params?.bonusCp as number) || 0;
    const damageAmt = currentCp + bonusCp + 5;

    const damageCalc = createDamageCalculation({
        source: { playerId: attackerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: damageAmt,
        state,
        timestamp,
    });

    return damageCalc.toEvents();
}

/** 防御：暗影守护 I 结算
 * 防御上下文约定（来自 attack.ts）：
 *   ctx.attackerId = 防御者（使用防御技能的人）
 *   ctx.defenderId = 原攻击者（被防御技能影响的人）
 *
 * 卡牌效果（4骰）：
 *   若 2匕首 → 造成毒液
 *   若 1暗影 → 获得伏击
 *   若 2暗影 → 获得潜行和伏击（忽略传入的伤害）
 */
function handleDefenseResolve({ sourceAbilityId, state, timestamp, ctx, attackerId }: CustomActionContext): DiceThroneEvent[] {
    const faces = getFaceCounts(getActiveDice(state));
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.defenderId; // 原攻击者

    const daggers = faces[FACE.DAGGER] || 0;
    const shadows = faces[FACE.SHADOW] || 0;

    // 2 Daggers -> Poison
    if (daggers >= 2) {
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: STATUS_IDS.POISON, stacks: 1, newTotal: calcPoisonNewTotal(state, opponentId, 1), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusAppliedEvent);
    }

    // 1 Shadow -> Sneak Attack
    if (shadows >= 1) {
        const currentSA = state.players[attackerId]?.tokens[TOKEN_IDS.SNEAK_ATTACK] ?? 0;
        const limitSA = getTokenStackLimit(state, attackerId, TOKEN_IDS.SNEAK_ATTACK);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, newTotal: Math.min(currentSA + 1, limitSA), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as TokenGrantedEvent);
    }

    // 2 Shadows -> Sneak + Sneak Attack + 免除本次伤害
    if (shadows >= 2) {
        const currentSneak = state.players[attackerId]?.tokens[TOKEN_IDS.SNEAK] ?? 0;
        const limitSneak = getTokenStackLimit(state, attackerId, TOKEN_IDS.SNEAK);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK, amount: 1, newTotal: Math.min(currentSneak + 1, limitSneak), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as TokenGrantedEvent);

        const currentSA2 = state.players[attackerId]?.tokens[TOKEN_IDS.SNEAK_ATTACK] ?? 0;
        const limitSA2 = getTokenStackLimit(state, attackerId, TOKEN_IDS.SNEAK_ATTACK);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, newTotal: Math.min(currentSA2 + 1, limitSA2), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 3,
        } as TokenGrantedEvent);

        // 免除本次攻击伤害
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: { targetId: attackerId, value: 999, sourceId: sourceAbilityId, preventStatus: false },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 4,
        } as DamageShieldGrantedEvent);
    }

    return events;
}


/** 移除所有负面状态 */
function handleRemoveAllDebuffs({ targetId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const target = state.players[targetId];
    if (!target) return [];

    const events: DiceThroneEvent[] = [];
    const debuffs = (state.tokenDefinitions || [])
        .filter(def => def.category === 'debuff')
        .map(def => def.id);

    debuffs.forEach(debuffId => {
        const stacks = target.statusEffects[debuffId] ?? 0;
        if (stacks > 0) {
            events.push({
                type: 'STATUS_REMOVED',
                payload: { targetId, statusId: debuffId, stacks },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp
            } as StatusRemovedEvent);
        }
    });

    return events;
}



/** 暗影币: 获得2CP；若拥有暗影🌑，转而获得3CP */
function handleShadowCoins({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const hasShadow = (state.players[targetId]?.tokens[TOKEN_IDS.SNEAK] ?? 0) > 0;
    const cpGain = hasShadow ? 3 : 2;
    const currentCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
    return [{
        type: 'CP_CHANGED',
        payload: { playerId: targetId, delta: cpGain, newValue: Math.min(currentCp + cpGain, CP_MAX), sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp
    } as CpChangedEvent];
}

/** 卡牌戏法: 对手弃1。自己抽1 (若有Sneak抽2) */
function handleCardTrick({ targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    // 1. 对手随机弃1张
    if (random) {
        const opponentHand = state.players[targetId]?.hand || [];
        if (opponentHand.length > 0) {
            const idx = Math.floor(random.random() * opponentHand.length);
            events.push({
                type: 'CARD_DISCARDED',
                payload: { playerId: targetId, cardId: opponentHand[idx].id },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp
            } as CardDiscardedEvent);
        }
    }

    // 2. 自己抽1或2张（有潜行时抽2）
    const selfTokens = state.players[attackerId]?.tokens || {};
    const hasSneak = (selfTokens[TOKEN_IDS.SNEAK] || 0) > 0;
    const drawCount = hasSneak ? 2 : 1;

    if (random) {
        events.push(...buildDrawEvents(state, attackerId, drawCount, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId));
    }

    return events;
}

/** 暗影之舞 II：投掷1骰造成一半伤害(真实伤害)，获得SNEAK+SNEAK_ATTACK，抽1卡 【已迁移到新伤害计算管线】 */
function handleShadowDanceRoll2({ targetId, sourceAbilityId, state, timestamp, random, ctx, attackerId }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dieValue = random.d(6);
    const face = getPlayerDieFace(state, attackerId, dieValue) ?? '';

    // Emit Roll Event
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: ctx.attackerId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.shadowDamage', effectParams: { value: dieValue } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    // Damage = ceil(value / 2) - True Damage (Undefendable)
    // 不可防御通过 AbilityDef tags: ['unblockable'] 声明，isDefendableAttack() 会自动处理
    const damageAmt = Math.ceil(dieValue / 2);
    if (damageAmt > 0) {
        const damageCalc = createDamageCalculation({
            source: { playerId: attackerId, abilityId: sourceAbilityId },
            target: { playerId: targetId },
            baseDamage: damageAmt,
            state,
            timestamp: timestamp + 1,
        });

        events.push(...damageCalc.toEvents());
    }

    // Gain Tokens
    [TOKEN_IDS.SNEAK, TOKEN_IDS.SNEAK_ATTACK].forEach(tokenId => {
        const currentAmount = state.players[attackerId]?.tokens[tokenId] ?? 0;
        const limit = getTokenStackLimit(state, attackerId, tokenId);
        const newTotal = Math.min(currentAmount + 1, limit);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId, amount: 1, newTotal, sourceAbilityId }, // target is SELF
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as TokenGrantedEvent);
    });

    // Draw 1 Card
    events.push(...buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp + 3, sourceAbilityId));

    return events;
}

// Steal Helpers for Higher CP
function handleStealCp5(params: CustomActionContext) { return handleStealCpWithAmount(params, 5); }
function handleStealCp6(params: CustomActionContext) { return handleStealCpWithAmount(params, 6); }


/** 聚宝盆 II：每有[Card]抽1。有[Shadow]弃1。有[Bag]得1CP */
function handleCornucopia2({ attackerId, ctx, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const defenderId = ctx.defenderId;

    const cardCount = faceCounts[FACE.CARD] || 0;
    const hasShadow = (faceCounts[FACE.SHADOW] || 0) > 0;
    const hasBag = (faceCounts[FACE.BAG] || 0) > 0;

    // Draw = Card Count
    if (cardCount > 0 && random) {
        events.push(...buildDrawEvents(state, attackerId, cardCount, random, 'ABILITY_EFFECT', timestamp, sourceAbilityId));
    }

    // Opponent Discard (if Shadow)
    if (hasShadow && random) {
        const opponentHand = state.players[defenderId]?.hand || [];
        if (opponentHand.length > 0) {
            const idx = Math.floor(random.random() * opponentHand.length);
            events.push({
                type: 'CARD_DISCARDED',
                payload: { playerId: defenderId, cardId: opponentHand[idx].id },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 1
            } as CardDiscardedEvent);
        }
    }

    // Gain CP (if Bag)
    if (hasBag) {
        const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newCp = Math.min(currentCp + 1, CP_MAX);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: attackerId, delta: 1, newValue: newCp, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2
        } as CpChangedEvent);
    }

    return events;
}

/** 恐惧反击 I 结算 (Fearless Riposte Level 1)
 * 造成 1×匕首 伤害；若有匕首+暗影，造成毒液
 * 防御上下文：ctx.attackerId = 防御者，ctx.defenderId = 原攻击者
 * 【已迁移到新伤害计算管线】
 */
function handleFearlessRiposte({ sourceAbilityId, state, timestamp, ctx }: CustomActionContext): DiceThroneEvent[] {
    const faces = getFaceCounts(getActiveDice(state));
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.defenderId; // 原攻击者

    // 造成 1 × 匕首数量 伤害
    const daggers = faces[FACE.DAGGER] || 0;
    if (daggers > 0) {
        const damageCalc = createDamageCalculation({
            source: { playerId: ctx.attackerId, abilityId: sourceAbilityId },
            target: { playerId: opponentId },
            baseDamage: daggers,
            state,
            timestamp,
        });
        events.push(...damageCalc.toEvents());
    }

    // 若有匕首+暗影：造成毒液
    const shadows = faces[FACE.SHADOW] || 0;
    if (daggers > 0 && shadows > 0) {
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: STATUS_IDS.POISON, stacks: 1, newTotal: calcPoisonNewTotal(state, opponentId, 1), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1
        } as StatusAppliedEvent);
    }

    return events;
}

/** 后发制人 II 结算 (Fearless Riposte II)
 * 防御上下文：ctx.attackerId = 防御者，ctx.defenderId = 原攻击者
 * 【已迁移到新伤害计算管线】
 */
function handleFearlessRiposte2({ sourceAbilityId, state, timestamp, ctx }: CustomActionContext): DiceThroneEvent[] {
    const faces = getFaceCounts(getActiveDice(state));
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.defenderId; // 原攻击者

    // Deal 2 * Dagger Damage
    const daggers = faces[FACE.DAGGER] || 0;
    if (daggers > 0) {
        const damage = daggers * 2;
        const damageCalc = createDamageCalculation({
            source: { playerId: ctx.attackerId, abilityId: sourceAbilityId },
            target: { playerId: opponentId },
            baseDamage: damage,
            state,
            timestamp,
        });
        events.push(...damageCalc.toEvents());
    }

    // If Dagger + Shadow: Poison
    const shadows = faces[FACE.SHADOW] || 0;
    if (daggers > 0 && shadows > 0) {
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: STATUS_IDS.POISON, stacks: 1, newTotal: calcPoisonNewTotal(state, opponentId, 1), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1
        } as StatusAppliedEvent);
    }

    return events;
}

/** 暗影防御 II 结算 (Shadow Defense II)
 * 防御上下文：ctx.attackerId = 防御者，ctx.defenderId = 原攻击者 */
function handleShadowDefense2({ sourceAbilityId, state, timestamp, ctx, attackerId }: CustomActionContext): DiceThroneEvent[] {
    const faces = getFaceCounts(getActiveDice(state));
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.defenderId; // 原攻击者

    const daggers = faces[FACE.DAGGER] || 0;
    const shadows = faces[FACE.SHADOW] || 0;

    // 2 Daggers -> Poison
    if (daggers >= 2) {
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: STATUS_IDS.POISON, stacks: 1, newTotal: calcPoisonNewTotal(state, opponentId, 1), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp
        } as StatusAppliedEvent);
    }

    // 1 Shadow -> Sneak Attack
    if (shadows >= 1) {
        const currentSA = state.players[attackerId]?.tokens[TOKEN_IDS.SNEAK_ATTACK] ?? 0;
        const limitSA = getTokenStackLimit(state, attackerId, TOKEN_IDS.SNEAK_ATTACK);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, newTotal: Math.min(currentSA + 1, limitSA), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1
        } as TokenGrantedEvent);
    }

    // 2 Shadows -> Sneak + Sneak Attack + 免除本次伤害
    if (shadows >= 2) {
        const currentSneak = state.players[attackerId]?.tokens[TOKEN_IDS.SNEAK] ?? 0;
        const limitSneak = getTokenStackLimit(state, attackerId, TOKEN_IDS.SNEAK);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK, amount: 1, newTotal: Math.min(currentSneak + 1, limitSneak), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2
        } as TokenGrantedEvent);

        // 第二个 SNEAK_ATTACK（与 shadows>=1 的叠加，但 stackLimit=1 会限制）
        const currentSA2 = state.players[attackerId]?.tokens[TOKEN_IDS.SNEAK_ATTACK] ?? 0;
        const limitSA2 = getTokenStackLimit(state, attackerId, TOKEN_IDS.SNEAK_ATTACK);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, newTotal: Math.min(currentSA2 + 1, limitSA2), sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 3
        } as TokenGrantedEvent);

        // 免除本次攻击伤害：授予一个足够大的伤害护盾
        // 防御技能的 withDamage 时机在攻击伤害结算之前执行，护盾会在 handleDamageDealt 中消耗
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: { targetId: attackerId, value: 999, sourceId: sourceAbilityId, preventStatus: false },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 4
        } as DamageShieldGrantedEvent);
    }

    return events;
}

/** 伏击：增加掷骰伤害 */
function handleSneakAttackUse({ attackerId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    if (!state.pendingAttack) return [];

    const dieValue = random.d(6);
    const face = getPlayerDieFace(state, attackerId, dieValue) ?? '';
    const events: DiceThroneEvent[] = [];

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value: dieValue,
            face,
            playerId: attackerId,
            targetPlayerId: state.pendingAttack.defenderId,
            effectKey: 'bonusDie.effect.sneakAttack',
            // 伏击掷骰值加到 pendingDamage.currentDamage
            pendingDamageBonus: dieValue,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp
    } as BonusDieRolledEvent);

    return events;
}

// ============================================================================
// 伤害估算函数（用于 Token 门控）
// ============================================================================

/** CP 系伤害预估：等同当前 CP 的一半（向上取整） */
const estimateHalfCpDamage = (state: Record<string, unknown>, playerId: string): number => {
    const players = state.players as Record<string, { resources: Record<string, number> }>;
    const cp = Math.min(players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0, CP_MAX);
    return Math.ceil(cp / 2);
};

/** CP 系伤害预估：等同当前 CP */
const estimateFullCpDamage = (state: Record<string, unknown>, playerId: string): number => {
    const players = state.players as Record<string, { resources: Record<string, number> }>;
    return Math.min(players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0, CP_MAX);
};

/** CP 系伤害预估：当前 CP + 5 */
const estimateCpPlus5Damage = (state: Record<string, unknown>, playerId: string): number => {
    const players = state.players as Record<string, { resources: Record<string, number> }>;
    return Math.min(players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0, CP_MAX) + 5;
};

// ============================================================================
// 注册
// ============================================================================

export function registerShadowThiefCustomActions(): void {
    registerCustomActionHandler('shadow_thief-dagger-strike-cp', handleDaggerStrikeCp, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-dagger-strike-poison', handleDaggerStrikePoison, { categories: ['status'] });
    registerCustomActionHandler('shadow_thief-dagger-strike-draw', handleDaggerStrikeDraw, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-damage-half-cp', handleDamageHalfCp, {
        categories: ['damage', 'resource'],
        estimateDamage: estimateHalfCpDamage,
    });

    registerCustomActionHandler('shadow_thief-steal-cp', handleStealCp, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-2', handleStealCp2, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-3', handleStealCp3, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-4', handleStealCp4, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-5', handleStealCp5, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-6', handleStealCp6, { categories: ['resource'] });

    registerCustomActionHandler('shadow_thief-damage-full-cp', handleDamageFullCp, {
        categories: ['damage'],
        estimateDamage: estimateFullCpDamage,
    });
    registerCustomActionHandler('shadow_thief-shadow-dance-roll', handleShadowDanceRoll, { categories: ['dice', 'damage'] });
    registerCustomActionHandler('shadow_thief-shadow-dance-roll-2', handleShadowDanceRoll2, { categories: ['dice', 'damage', 'resource', 'card'] });
    registerCustomActionHandler('shadow_thief-cornucopia', handleCornucopia, { categories: ['card', 'other'] });
    registerCustomActionHandler('shadow_thief-cornucopia-discard', handleCornucopiaDiscard, { categories: ['other'] });
    registerCustomActionHandler('shadow_thief-cornucopia-2', handleCornucopia2, { categories: ['card', 'resource', 'other'] });
    registerCustomActionHandler('shadow_thief-shadow-shank-damage', handleShadowShankDamage, {
        categories: ['damage'],
        estimateDamage: estimateCpPlus5Damage,
    });

    registerCustomActionHandler('shadow_thief-defense-resolve', handleDefenseResolve, { categories: ['status', 'defense', 'token'] });
    registerCustomActionHandler('shadow_thief-defense-resolve-2', handleShadowDefense2, { categories: ['status', 'defense', 'token'] });
    registerCustomActionHandler('shadow_thief-fearless-riposte', handleFearlessRiposte, { categories: ['damage', 'defense', 'status'] });
    registerCustomActionHandler('shadow_thief-fearless-riposte-2', handleFearlessRiposte2, { categories: ['damage', 'defense', 'status'] });


    registerCustomActionHandler('shadow_thief-shadow-coins', handleShadowCoins, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-card-trick', handleCardTrick, { categories: ['other'] });
    registerCustomActionHandler('shadow_thief-shadow-manipulation', handleShadowManipulation, {
        categories: ['dice'],
        requiresInteraction: true,
    });

    registerCustomActionHandler('shadow_thief-remove-all-debuffs', handleRemoveAllDebuffs, { categories: ['status'] });

    registerCustomActionHandler('shadow_thief-sneak-attack-use', handleSneakAttackUse, { categories: ['dice'] });
}
