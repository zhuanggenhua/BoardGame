/**
 * 圣骑士 (Paladin) 专属 Custom Action 处理器
 */

import { getDieFace, getTokenStackLimit } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS as FACES } from '../ids';
import type {
    DiceThroneEvent,
    TokenGrantedEvent,
    BonusDieRolledEvent,
    DamageDealtEvent,
    PreventDamageEvent,
} from '../types';
import { buildDrawEvents } from '../deckEvents';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';

// ============================================================================
// 圣骑士技能处理器
// ============================================================================

/** 
 * 圣光术 (Holy Light) 掷骰逻辑
 */
function handleHolyLightRoll({ targetId, sourceAbilityId, state, timestamp, random }: CustomActionContext, diceCount: number): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    // 投掷
    const rollResults: { value: number; face: string }[] = [];
    for (let i = 0; i < diceCount; i++) {
        const value = random.d(6);
        const face = getDieFace(value);
        rollResults.push({ value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: targetId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.holyLight',
                effectParams: { index: i }
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    const hasSword = rollResults.some(r => r.face === FACES.SWORD);
    const hasHelm = rollResults.some(r => r.face === FACES.HELM);
    const heartCount = rollResults.filter(r => r.face === FACES.HEART).length;
    const prayCount = rollResults.filter(r => r.face === FACES.PRAY).length;

    // 剑 -> 暴击
    if (hasSword) {
        const current = state.players[targetId]?.tokens[TOKEN_IDS.CRIT] ?? 0;
        const limit = getTokenStackLimit(state, targetId, TOKEN_IDS.CRIT);
        if (current < limit) {
            events.push({
                type: 'TOKEN_GRANTED',
                payload: { targetId, tokenId: TOKEN_IDS.CRIT, amount: 1, newTotal: current + 1, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 10,
            } as TokenGrantedEvent);
        }
    }

    // 头盔 -> 守护
    if (hasHelm) {
        const current = state.players[targetId]?.tokens[TOKEN_IDS.PROTECT] ?? 0;
        const limit = getTokenStackLimit(state, targetId, TOKEN_IDS.PROTECT);
        if (current < limit) {
            events.push({
                type: 'TOKEN_GRANTED',
                payload: { targetId, tokenId: TOKEN_IDS.PROTECT, amount: 1, newTotal: current + 1, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 20,
            } as TokenGrantedEvent);
        }
    }

    // 心 -> 抽卡
    if (heartCount > 0) {
        events.push(...buildDrawEvents(state, targetId, heartCount, random, 'ABILITY_EFFECT', timestamp + 30));
    }

    // 祈祷 -> CP
    if (prayCount > 0) {
        const cpAmount = prayCount * 2;
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: cpAmount, newValue: (state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0) + cpAmount },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 40,
        });
    }

    return events;
}

function handleHolyLightRoll1(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleHolyLightRoll(ctx, 1);
}

function handleHolyLightRoll3(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleHolyLightRoll(ctx, 3);
}

/**
 * 神圣防御 (Holy Defense) 逻辑
 */
function handleHolyDefenseRoll({ targetId, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext, diceCount: number, isLevel3: boolean): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];

    // 投掷
    const rollResults: { value: number; face: string }[] = [];
    for (let i = 0; i < diceCount; i++) {
        const value = random.d(6);
        const face = getDieFace(value);
        rollResults.push({ value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: targetId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.holyDefense',
                effectParams: { index: i }
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    const swordCount = rollResults.filter(r => r.face === FACES.SWORD).length;
    const helmCount = rollResults.filter(r => r.face === FACES.HELM).length;
    const heartCount = rollResults.filter(r => r.face === FACES.HEART).length;
    const prayCount = rollResults.filter(r => r.face === FACES.PRAY).length;

    // 1. 造成伤害 (Sword)
    if (swordCount > 0 && attackerId) {
        const amount = swordCount;
        const target = state.players[attackerId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = target ? Math.min(amount, targetHp) : 0;

        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId: attackerId, amount, actualDamage, sourceAbilityId, type: 'undefendable' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 50
        } as DamageDealtEvent);
    }

    // 2. 防止伤害 (Helm + 2*Heart)
    const preventAmount = (helmCount * 1) + (heartCount * 2);
    if (preventAmount > 0) {
        events.push({
            type: 'PREVENT_DAMAGE',
            payload: { targetId, amount: preventAmount, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 60
        } as PreventDamageEvent);
    }

    // 3. 获得 CP (Pray)
    if (prayCount > 0) {
        const cpAmount = prayCount * 1;
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: cpAmount, newValue: (state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0) + cpAmount },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 70,
        });
    }

    // 4. III级特效
    if (isLevel3 && helmCount >= 2 && prayCount >= 1) {
        const current = state.players[targetId]?.tokens[TOKEN_IDS.PROTECT] ?? 0;
        const limit = getTokenStackLimit(state, targetId, TOKEN_IDS.PROTECT);
        if (current < limit) {
            events.push({
                type: 'TOKEN_GRANTED',
                payload: { targetId, tokenId: TOKEN_IDS.PROTECT, amount: 1, newTotal: current + 1, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 80,
            } as TokenGrantedEvent);
        }
    }

    return events;
}

function handleHolyDefenseRollBase(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleHolyDefenseRoll(ctx, 3, false);
}

function handleHolyDefenseRoll2(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleHolyDefenseRoll(ctx, 4, false);
}

function handleHolyDefenseRoll3(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleHolyDefenseRoll(ctx, 4, true);
} // Corrected: Leve3 passes true

/**
 * 神佑! (Divine Favor / God's Grace)
 * Roll 1: If Pray -> Gain 4 CP. Else Draw 1.
 */
function handleGodsGrace({ targetId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const value = random.d(6);
    const face = getDieFace(value);

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: targetId,
            targetPlayerId: targetId,
            effectKey: 'bonusDie.effect.godsGrace',
            effectParams: {}
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (face === FACES.PRAY) {
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: 4, newValue: (state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0) + 4 },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 10,
        });
    } else {
        events.push(...buildDrawEvents(state, targetId, 1, random, 'ABILITY_EFFECT', timestamp + 10));
    }
    return events;
}

/**
 * 神圣祝福 (Blessing of Divinity) — 免疫致死伤害
 * 当受到致死伤害时，移除此标记，将 HP 设为 1 并回复 5 HP（总计 HP=6）
 */
function handleBlessingPrevent({ targetId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const player = state.players[targetId];
    if (!player) return events;

    const blessingCount = player.tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0;
    if (blessingCount <= 0) return events;

    // 消耗 1 层神圣祝福
    events.push({
        type: 'TOKEN_CONSUMED',
        payload: {
            playerId: targetId,
            tokenId: TOKEN_IDS.BLESSING_OF_DIVINITY,
            amount: 1,
            newTotal: blessingCount - 1,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent);

    // 防止伤害（将当前待结算伤害全部免除）
    events.push({
        type: 'PREVENT_DAMAGE',
        payload: {
            targetId,
            amount: 9999, // 免除所有伤害
            sourceAbilityId: 'paladin-blessing-prevent',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 1,
    } as PreventDamageEvent);

    // 回复 5 HP
    const currentHp = player.resources[RESOURCE_IDS.HP] ?? 0;
    events.push({
        type: 'HEAL_APPLIED',
        payload: {
            targetId,
            amount: 5,
            newHp: currentHp + 5,
            sourceAbilityId: 'paladin-blessing-prevent',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 2,
    } as DiceThroneEvent);

    return events;
}

// 注册
export function registerPaladinCustomActions(): void {
    registerCustomActionHandler('paladin-holy-light-roll', handleHolyLightRoll1, { categories: ['dice', 'resource', 'token'] });
    registerCustomActionHandler('paladin-holy-light-roll-3', handleHolyLightRoll3, { categories: ['dice', 'resource', 'token'] });

    registerCustomActionHandler('paladin-holy-defense', handleHolyDefenseRollBase, { categories: ['dice', 'damage', 'defense'] });
    registerCustomActionHandler('paladin-holy-defense-2', handleHolyDefenseRoll2, { categories: ['dice', 'damage', 'defense'] });
    registerCustomActionHandler('paladin-holy-defense-3', handleHolyDefenseRoll3, { categories: ['dice', 'damage', 'defense'] });

    registerCustomActionHandler('paladin-gods-grace', handleGodsGrace, { categories: ['dice', 'resource', 'card'] });

    registerCustomActionHandler('paladin-blessing-prevent', handleBlessingPrevent, { categories: ['token', 'defense'] });
}
