/**
 * 影子盗贼 (Shadow Thief) 专属 Custom Action 处理器
 */

import { getActiveDice, getFaceCounts, getDieFace, getTokenStackLimit } from '../rules';
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
    CardDiscardedEvent,
    DamageShieldGrantedEvent,
    TokenConsumedEvent,
    PreventDamageEvent,
    DamagePreventedEvent,
} from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';

const FACE = SHADOW_THIEF_DICE_FACE_IDS;

// ============================================================================
// 影子盗贼技能处理器
// ============================================================================

/** 匕首打击：每有[Bag]获得1CP */
function handleDaggerStrikeCp({ attackerId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const bagCount = faceCounts[FACE.BAG] || 0;

    if (bagCount <= 0) return [];

    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const newCp = Math.min(currentCp + bagCount, CP_MAX);

    return [{
        type: 'CP_CHANGED',
        payload: { playerId: attackerId, delta: bagCount, newValue: newCp },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as CpChangedEvent];
}

/** 匕首打击 II：每有[Card]抽1张牌 */
function handleDaggerStrikeDraw({ attackerId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const faceCounts = getFaceCounts(getActiveDice(state));
    const cardCount = faceCounts[FACE.CARD] || 0;
    if (cardCount <= 0) return [];
    return buildDrawEvents(state, attackerId, cardCount, random, 'ABILITY_EFFECT', timestamp);
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

/** 抢夺/暗影突袭：造成一半CP的伤害 */
function handleDamageHalfCp({ attackerId, targetId, sourceAbilityId, state, timestamp, ctx, action }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const params = (action as any).params;
    const bonusCp = (params?.bonusCp as number) || 0;
    const totalCp = currentCp + bonusCp;

    if (totalCp <= 0) return [];

    const damageAmt = Math.ceil(totalCp / 2);

    const target = state.players[targetId];
    const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
    const actualDamage = Math.min(damageAmt, targetHp);

    ctx.damageDealt += actualDamage;

    return [{
        type: 'DAMAGE_DEALT',
        payload: { targetId, amount: damageAmt, actualDamage, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent];
}

/** 偷窃：获得CP (若有Shadow则偷取) */
function handleStealCp(context: CustomActionContext): DiceThroneEvent[] {
    return handleStealCpWithAmount(context, 2);
}


function handleStealCp2(context: CustomActionContext) { return handleStealCpWithAmount(context, 2); }
function handleStealCp3(context: CustomActionContext) { return handleStealCpWithAmount(context, 3); }
function handleStealCp4(context: CustomActionContext) { return handleStealCpWithAmount(context, 4); }
// handleStealCp5 and 6 are defined later

function handleStealCpWithAmount({ targetId, attackerId, state, timestamp }: CustomActionContext, amount: number): DiceThroneEvent[] {
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
            events.push({
                type: 'CP_CHANGED',
                payload: { playerId: targetId, delta: -stolenAmount, newValue: targetCp - stolenAmount },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as CpChangedEvent);
        }

        // We gain full 'amount'. 'stolenAmount' came from opponent, rest from bank.
        // The net effect on self is +amount.
        gained = amount;
    } else {
        // Just gain from bank
        gained = amount;
    }

    if (gained > 0) {
        const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newCp = Math.min(currentCp + gained, CP_MAX);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: attackerId, delta: gained, newValue: newCp },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as CpChangedEvent);
    }

    return events;
}

/** 肾击：造成等同CP的伤害 (Gain passed beforehand, so use current CP + bonus) */
function handleDamageFullCp({ attackerId, targetId, sourceAbilityId, state, timestamp, ctx, action }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const params = (action as any).params;
    const bonusCp = (params?.bonusCp as number) || 0;
    const totalCp = currentCp + bonusCp;

    if (totalCp <= 0) return [];

    // Deal damage
    const target = state.players[targetId];
    const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
    const actualDamage = Math.min(totalCp, targetHp);

    ctx.damageDealt += actualDamage;

    return [{
        type: 'DAMAGE_DEALT',
        payload: { targetId, amount: totalCp, actualDamage, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent];
}

/** 暗影之舞：投掷1骰造成一半伤害 */
function handleShadowDanceRoll({ targetId, sourceAbilityId, state, timestamp, random, ctx }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dieValue = random.d(6);
    const face = getDieFace(dieValue);

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
        const target = state.players[targetId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = Math.min(damageAmt, targetHp);

        ctx.damageDealt += actualDamage;

        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId, amount: damageAmt, actualDamage, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as DamageDealtEvent);
    }

    return events;
}

/** 聚宝盆：若有Shadow丢弃对手1卡 */
function handleCornucopiaDiscard({ targetId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const hasShadow = (faceCounts[FACE.SHADOW] || 0) > 0;

    if (!hasShadow) return [];
    if (!random) return [];

    const targetHand = state.players[targetId]?.hand || [];
    if (targetHand.length === 0) return [];

    // Random discard
    const randomIndex = Math.floor(random.random() * targetHand.length);
    const cardId = targetHand[randomIndex].id;

    return [{
        type: 'CARD_DISCARDED',
        payload: { playerId: targetId, cardId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as CardDiscardedEvent];
}


/** 终极：Shadow Shank Damage (Deal CP + 5) */
function handleShadowShankDamage({ attackerId, targetId, sourceAbilityId, state, timestamp, ctx }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const damageAmt = currentCp + 5;

    const target = state.players[targetId];
    const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
    const actualDamage = Math.min(damageAmt, targetHp);

    ctx.damageDealt += actualDamage;

    return [{
        type: 'DAMAGE_DEALT',
        payload: { targetId, amount: damageAmt, actualDamage, sourceAbilityId }, // Is ultimate usually undefendable? `isUltimate` in PendingAttack.
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent];
}

/** 防御：暗影守护结算 */
function handleDefenseResolve({ sourceAbilityId, state, timestamp, ctx, random }: CustomActionContext): DiceThroneEvent[] {
    // Defense: Roll 4 dice (active dice).
    const faces = getFaceCounts(getActiveDice(state));
    const events: DiceThroneEvent[] = [];
    const selfId = ctx.defenderId;

    // 1 Dagger = 1 Dmg to opponent
    const daggers = faces[FACE.DAGGER] || 0;
    if (daggers > 0) {
        const opponentId = ctx.attackerId; // 原攻击者
        const target = state.players[opponentId];
        if (target) {
            const hp = target.resources[RESOURCE_IDS.HP];
            const actual = Math.min(daggers, hp);
            events.push({
                type: 'DAMAGE_DEALT',
                payload: { targetId: opponentId, amount: daggers, actualDamage: actual, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp
            } as DamageDealtEvent);
        }
    }

    // 1 Bag = 抽 1 张牌
    const bags = faces[FACE.BAG] || 0;
    if (bags > 0 && random) {
        events.push(...buildDrawEvents(state, selfId, bags, random, 'ABILITY_EFFECT', timestamp + 1));
    }

    // 1 Shadow = 阻挡 1 点伤害（伤害护盾）
    const shadows = faces[FACE.SHADOW] || 0;
    if (shadows > 0) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: { targetId: selfId, value: shadows, sourceId: sourceAbilityId, preventStatus: false },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2
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
            } as any);
        }
    });

    return events;
}


/** 与影共生: 投掷1骰，Shadow->Sneak Attack + 2CP，否则抽1卡 */
function handleOneWithShadows({ targetId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const dieValue = random.d(6);
    const face = getDieFace(dieValue);
    const events: DiceThroneEvent[] = [];

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: targetId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.default' },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp
    } as BonusDieRolledEvent);

    if (face === FACE.SHADOW) {
        const currentSneakAttack = state.players[targetId]?.tokens[TOKEN_IDS.SNEAK_ATTACK] ?? 0;
        const sneakAttackLimit = getTokenStackLimit(state, targetId, TOKEN_IDS.SNEAK_ATTACK);
        const newSneakAttackTotal = Math.min(currentSneakAttack + 1, sneakAttackLimit);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId, tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, newTotal: newSneakAttackTotal, sourceAbilityId: 'action-one-with-shadows' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp
        } as any);

        const currentCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: 2, newValue: Math.min(currentCp + 2, CP_MAX) },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp
        } as CpChangedEvent);
    } else {
        events.push(...buildDrawEvents(state, targetId, 1, random, 'ABILITY_EFFECT', timestamp));
    }
    return events;
}

/** 卡牌戏法: 对手弃1。自己抽1 (若有Sneak抽2) */
function handleCardTrick({ targetId, attackerId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
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
        events.push(...buildDrawEvents(state, attackerId, drawCount, random, 'ABILITY_EFFECT', timestamp));
    }

    return events;
}

/** 暗影之舞 II：投掷1骰造成一半伤害(真实伤害)，获得SNEAK+SNEAK_ATTACK，抽1卡 */
function handleShadowDanceRoll2({ targetId, sourceAbilityId, state, timestamp, random, ctx, attackerId }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dieValue = random.d(6);
    const face = getDieFace(dieValue);

    // Emit Roll Event
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: ctx.attackerId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.shadowDamage', effectParams: { value: dieValue } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    // Damage = ceil(value / 2) - True Damage (Undefendable)
    const damageAmt = Math.ceil(dieValue / 2);
    if (damageAmt > 0) {
        const target = state.players[targetId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = Math.min(damageAmt, targetHp);

        ctx.damageDealt += actualDamage;

        // Is there a way to mark damage as undefendable here?
        // PendingAttack has `isDefendable`. But this is a direct damage effect.
        // Usually, undefendable damage is just dealt directly without triggering defensive roll phase.
        // Since this is an Offensive Ability effect, if we just deal damage here, can the opponent defend?
        // If this is `main` phase, opponent usually defends against the *Accumulated* damage in PendingAttack.
        // But `shadow-dance` is an offensive ability. The damage dealt here (ctx.damageDealt) adds to PendingAttack.
        // To make it Defendable/Undefendable, we set `isDefendable` on PendingAttack.
        // However, Custom Action handles specific events.
        // If we want this specific chunk to be undefendable, we might rely on the AbilityDef `type: 'undefendable'`?
        // Or we set PendingAttack.isDefendable = false?
        // Let's assume for now we just add damage. If the card says "True Damage", it likely implies "Undefendable".
        // We should check if we can modify the PendingAttack state here.
        if (state.pendingAttack) {
            state.pendingAttack.isDefendable = false;
        }

        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId, amount: damageAmt, actualDamage, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as DamageDealtEvent);
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
        } as any);
    });

    // Draw 1 Card
    events.push(...buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp + 3));

    return events;
}

// Steal Helpers for Higher CP
function handleStealCp5(params: CustomActionContext) { return handleStealCpWithAmount(params, 5); }
function handleStealCp6(params: CustomActionContext) { return handleStealCpWithAmount(params, 6); }


/** 聚宝盆 II：每有[Card]抽1。有[Shadow]弃1。有[Bag]得1CP */
function handleCornucopia2({ attackerId, targetId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const faceCounts = getFaceCounts(getActiveDice(state));

    const cardCount = faceCounts[FACE.CARD] || 0;
    const hasShadow = (faceCounts[FACE.SHADOW] || 0) > 0;
    const hasBag = (faceCounts[FACE.BAG] || 0) > 0;

    // Draw = Card Count
    if (cardCount > 0 && random) {
        events.push(...buildDrawEvents(state, attackerId, cardCount, random, 'ABILITY_EFFECT', timestamp));
    }

    // Opponent Discard (if Shadow)
    if (hasShadow && random) {
        const opponentHand = state.players[targetId]?.hand || [];
        if (opponentHand.length > 0) {
            const idx = Math.floor(random.random() * opponentHand.length);
            events.push({
                type: 'CARD_DISCARDED',
                payload: { playerId: targetId, cardId: opponentHand[idx].id },
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
            payload: { playerId: attackerId, delta: 1, newValue: newCp },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2
        } as CpChangedEvent);
    }

    return events;
}

/** 恐惧反击 I 结算 (Fearless Riposte Level 1)
 * 造成 1×匕首 伤害；若有匕首+暗影，造成毒液 */
function handleFearlessRiposte({ sourceAbilityId, state, timestamp, ctx }: CustomActionContext): DiceThroneEvent[] {
    const faces = getFaceCounts(getActiveDice(state));
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.attackerId;

    // 造成 1 × 匕首数量 伤害
    const daggers = faces[FACE.DAGGER] || 0;
    if (daggers > 0) {
        const target = state.players[opponentId];
        if (target) {
            const hp = target.resources[RESOURCE_IDS.HP];
            const actual = Math.min(daggers, hp);
            events.push({
                type: 'DAMAGE_DEALT',
                payload: { targetId: opponentId, amount: daggers, actualDamage: actual, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp
            } as DamageDealtEvent);
        }
    }

    // 若有匕首+暗影：造成毒液
    const shadows = faces[FACE.SHADOW] || 0;
    if (daggers > 0 && shadows > 0) {
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: 'poison', stacks: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1
        } as any);
    }

    return events;
}

/** 后发制人 II 结算 (Fearless Riposte II) */
function handleFearlessRiposte2({ sourceAbilityId, state, timestamp, ctx }: CustomActionContext): DiceThroneEvent[] {
    const faces = getFaceCounts(getActiveDice(state));
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.attackerId;

    // Deal 2 * Dagger Damage
    const daggers = faces[FACE.DAGGER] || 0;
    if (daggers > 0) {
        const damage = daggers * 2;
        const target = state.players[opponentId];
        if (target) {
            const hp = target.resources[RESOURCE_IDS.HP];
            const actual = Math.min(damage, hp);
            events.push({
                type: 'DAMAGE_DEALT',
                payload: { targetId: opponentId, amount: damage, actualDamage: actual, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp
            } as DamageDealtEvent);
        }
    }

    // If Dagger + Shadow: Poison
    const shadows = faces[FACE.SHADOW] || 0;
    if (daggers > 0 && shadows > 0) {
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: 'poison', stacks: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1
        } as any);
    }

    return events;
}

/** 暗影防御 II 结算 (Shadow Defense II) */
function handleShadowDefense2({ sourceAbilityId, state, timestamp, ctx, attackerId }: CustomActionContext): DiceThroneEvent[] {
    const faces = getFaceCounts(getActiveDice(state));
    const events: DiceThroneEvent[] = [];
    const opponentId = ctx.attackerId;

    const daggers = faces[FACE.DAGGER] || 0;
    const shadows = faces[FACE.SHADOW] || 0;

    // 2 Daggers -> Poison
    if (daggers >= 2) {
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: 'poison', stacks: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp
        } as any);
    }

    // 1 Shadow -> Sneak Attack
    if (shadows >= 1) {
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1
        } as any);
    }

    // 2 Shadows -> Sneak + Sneak Attack + 免除本次伤害
    if (shadows >= 2) {
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK, amount: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2
        } as any);

        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: attackerId, tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 3
        } as any);

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

/** 潜行：移除标记并免除伤害 */
function handleSneakPrevent({ state, timestamp, targetId, action }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const player = state.players[targetId];
    if (!player) return events;

    const params = (action as any).params as { damageAmount?: number; tokenStacks?: number } | undefined;
    const damageAmount = params?.damageAmount ?? 0;
    const currentStacks = params?.tokenStacks ?? (player.tokens[TOKEN_IDS.SNEAK] ?? 0);

    if (currentStacks <= 0 || damageAmount <= 0) {
        return events;
    }

    const newTotal = Math.max(0, currentStacks - 1);
    events.push({
        type: 'TOKEN_CONSUMED',
        payload: {
            playerId: targetId,
            tokenId: TOKEN_IDS.SNEAK,
            amount: 1,
            newTotal,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenConsumedEvent);

    events.push({
        type: 'PREVENT_DAMAGE',
        payload: {
            targetId,
            amount: damageAmount,
            sourceAbilityId: 'shadow_thief-sneak-prevent',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 1,
    } as PreventDamageEvent);

    events.push({
        type: 'DAMAGE_PREVENTED',
        payload: {
            targetId,
            originalDamage: damageAmount,
            preventedAmount: damageAmount,
            shieldSourceId: TOKEN_IDS.SNEAK,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 2,
    } as DamagePreventedEvent);

    return events;
}

/** 伏击：增加掷骰伤害 */
function handleSneakAttackUse({ attackerId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    if (!state.pendingAttack) return [];

    const dieValue = random.d(6);
    const face = getDieFace(dieValue);
    const events: DiceThroneEvent[] = [];

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: attackerId, targetPlayerId: state.pendingAttack.defenderId, effectKey: 'bonusDie.effect.sneakAttack' },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp
    } as BonusDieRolledEvent);

    // 增加伤害
    state.pendingAttack.damage = (state.pendingAttack.damage ?? 0) + dieValue;

    return events;
}

// ============================================================================
// 注册
// ============================================================================

export function registerShadowThiefCustomActions(): void {
    registerCustomActionHandler('shadow_thief-dagger-strike-cp', handleDaggerStrikeCp, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-dagger-strike-poison', handleDaggerStrikePoison, { categories: ['status'] });
    registerCustomActionHandler('shadow_thief-dagger-strike-draw', handleDaggerStrikeDraw, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-damage-half-cp', handleDamageHalfCp, { categories: ['resource'] });

    registerCustomActionHandler('shadow_thief-steal-cp', handleStealCp, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-2', handleStealCp2, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-3', handleStealCp3, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-4', handleStealCp4, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-5', handleStealCp5, { categories: ['resource'] });
    registerCustomActionHandler('shadow_thief-steal-cp-6', handleStealCp6, { categories: ['resource'] });

    registerCustomActionHandler('shadow_thief-damage-full-cp', handleDamageFullCp, { categories: ['other'] });
    registerCustomActionHandler('shadow_thief-shadow-dance-roll', handleShadowDanceRoll, { categories: ['dice'] });
    registerCustomActionHandler('shadow_thief-shadow-dance-roll-2', handleShadowDanceRoll2, { categories: ['dice', 'resource'] });
    registerCustomActionHandler('shadow_thief-cornucopia-discard', handleCornucopiaDiscard, { categories: ['other'] });
    registerCustomActionHandler('shadow_thief-cornucopia-2', handleCornucopia2, { categories: ['other', 'resource'] });
    registerCustomActionHandler('shadow_thief-shadow-shank-damage', handleShadowShankDamage, { categories: ['other'] });

    registerCustomActionHandler('shadow_thief-defense-resolve', handleDefenseResolve, { categories: ['other'] });
    registerCustomActionHandler('shadow_thief-defense-resolve-2', handleShadowDefense2, { categories: ['other'] });
    registerCustomActionHandler('shadow_thief-fearless-riposte', handleFearlessRiposte, { categories: ['other'] });
    registerCustomActionHandler('shadow_thief-fearless-riposte-2', handleFearlessRiposte2, { categories: ['other'] });

    registerCustomActionHandler('shadow_thief-one-with-shadows', handleOneWithShadows, { categories: ['dice', 'resource'] });
    registerCustomActionHandler('shadow_thief-card-trick', handleCardTrick, { categories: ['other'] });

    registerCustomActionHandler('shadow_thief-remove-all-debuffs', handleRemoveAllDebuffs, { categories: ['status'] });

    registerCustomActionHandler('shadow_thief-sneak-prevent', handleSneakPrevent, { categories: ['other'] });
    registerCustomActionHandler('shadow_thief-sneak-attack-use', handleSneakAttackUse, { categories: ['dice'] });
}
