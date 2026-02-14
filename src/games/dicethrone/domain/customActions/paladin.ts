/**
 * 圣骑士 (Paladin) 专属 Custom Action 处理器
 */

import { getActiveDice, getFaceCounts, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS as FACES } from '../ids';
import type {
    DiceThroneEvent,
    TokenGrantedEvent,
    BonusDieRolledEvent,
    DamageDealtEvent,
    PreventDamageEvent,
    HealAppliedEvent,
    CpChangedEvent,
    BonusDieInfo,
} from '../types';
import { CP_MAX } from '../types';
import { buildDrawEvents } from '../deckEvents';
import { registerCustomActionHandler, createDisplayOnlySettlement, type CustomActionContext } from '../effects';

// ============================================================================
// 圣骑士技能处理器
// ============================================================================

/** 
 * 圣光术 (Holy Light) 掷骰逻辑
 */
function handleHolyLightRoll({ targetId, sourceAbilityId, state, timestamp, random }: CustomActionContext, diceCount: number): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];

    // 投掷
    const rollResults: { value: number; face: string }[] = [];
    for (let i = 0; i < diceCount; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, targetId, value) ?? '';
        rollResults.push({ value, face });
        dice.push({ index: i, value, face });
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
        const currentCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newCp = Math.min(currentCp + cpAmount, CP_MAX);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: cpAmount, newValue: newCp },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 40,
        });
    }

    // 多骰展示
    if (diceCount > 1) {
        events.push(createDisplayOnlySettlement(sourceAbilityId, targetId, targetId, dice, timestamp));
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
/**
 * 神圣防御：基于防御投掷的骰面结果计算效果
 * - 剑面→反伤，盔面→防1，心面→防2，祈祷面→1CP
 * - III级额外：2盔+1祈祷→守护
 * 注意：不是额外投骰子，而是读取防御阶段已投的骰子结果
 */
function handleHolyDefenseRoll({ targetId, attackerId: _attackerId, sourceAbilityId, state, timestamp, ctx }: CustomActionContext, _diceCount: number, isLevel3: boolean): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    // 防御上下文：ctx.attackerId = 防御者自身，ctx.defenderId = 原攻击者
    const originalAttackerId = ctx.defenderId;

    // 读取防御投掷的骰面计数（防御阶段结束时 state.dice 就是防御方的骰子）
    const faceCounts = getFaceCounts(getActiveDice(state));

    const swordCount = faceCounts[FACES.SWORD] ?? 0;
    const helmCount = faceCounts[FACES.HELM] ?? 0;
    const heartCount = faceCounts[FACES.HEART] ?? 0;
    const prayCount = faceCounts[FACES.PRAY] ?? 0;

    // 1. 造成伤害 (Sword) → 反伤给原攻击者
    if (swordCount > 0 && originalAttackerId) {
        const amount = swordCount;
        const target = state.players[originalAttackerId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = target ? Math.min(amount, targetHp) : 0;

        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId: originalAttackerId, amount, actualDamage, sourceAbilityId, type: 'undefendable' },
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
        const currentCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newCp = Math.min(currentCp + cpAmount, CP_MAX);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: cpAmount, newValue: newCp },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 70,
        });
    }

    // 4. III级特效：2盔+1祈祷→守护
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
    const face = getPlayerDieFace(state, targetId, value) ?? '';

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
 * 神恩 (Divine Favor)
 * 投掷1骰：剑→抽2; 头盔→治愈3; 心→治愈4; 祈祷→3CP
 */
function handleDivineFavor({ targetId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const value = random.d(6);
    const face = getPlayerDieFace(state, targetId, value) ?? '';

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: targetId,
            targetPlayerId: targetId,
            effectKey: 'bonusDie.effect.divineFavor',
            effectParams: {},
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (face === FACES.SWORD) {
        // 剑 → 抽 2 张
        events.push(...buildDrawEvents(state, targetId, 2, random, 'ABILITY_EFFECT', timestamp + 10));
    } else if (face === FACES.HELM) {
        // 头盔 → 治愈 3
        const currentHp = state.players[targetId]?.resources[RESOURCE_IDS.HP] ?? 0;
        events.push({
            type: 'HEAL_APPLIED',
            payload: { targetId, amount: 3, newHp: currentHp + 3, sourceAbilityId: 'paladin-divine-favor' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 10,
        } as HealAppliedEvent);
    } else if (face === FACES.HEART) {
        // 心 → 治愈 4
        const currentHp = state.players[targetId]?.resources[RESOURCE_IDS.HP] ?? 0;
        events.push({
            type: 'HEAL_APPLIED',
            payload: { targetId, amount: 4, newHp: currentHp + 4, sourceAbilityId: 'paladin-divine-favor' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 10,
        } as HealAppliedEvent);
    } else if (face === FACES.PRAY) {
        // 祈祷 → 3CP
        const currentCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newCp = Math.min(currentCp + 3, CP_MAX);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: 3, newValue: newCp },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 10,
        } as CpChangedEvent);
    }
    return events;
}

/**
 * 赦免 (Absolution)
 * 被攻击后投掷1骰防御，效果同神圣防御基础版（1骰简化版）
 * 剑→1不可防御伤害; 头盔→防止1伤害; 心→防止2伤害; 祈祷→1CP
 */
function handleAbsolution({ targetId, attackerId: _attackerId, sourceAbilityId, state, timestamp, random, ctx }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    // 防御上下文：ctx.attackerId = 防御者自身，ctx.defenderId = 原攻击者
    const originalAttackerId = ctx.defenderId;
    const value = random.d(6);
    const face = getPlayerDieFace(state, targetId, value) ?? '';

    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: targetId,
            targetPlayerId: targetId,
            effectKey: 'bonusDie.effect.absolution',
            effectParams: {},
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);

    if (face === FACES.SWORD && originalAttackerId) {
        // 剑 → 对原攻击者造成 1 不可防御伤害
        const target = state.players[originalAttackerId];
        const targetHp = target?.resources[RESOURCE_IDS.HP] ?? 0;
        const actualDamage = target ? Math.min(1, targetHp) : 0;
        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId: originalAttackerId, amount: 1, actualDamage, sourceAbilityId, type: 'undefendable' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 10,
        } as DamageDealtEvent);
    } else if (face === FACES.HELM) {
        // 头盔 → 防止 1 伤害
        events.push({
            type: 'PREVENT_DAMAGE',
            payload: { targetId, amount: 1, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 10,
        } as PreventDamageEvent);
    } else if (face === FACES.HEART) {
        // 心 → 防止 2 伤害
        events.push({
            type: 'PREVENT_DAMAGE',
            payload: { targetId, amount: 2, sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 10,
        } as PreventDamageEvent);
    } else if (face === FACES.PRAY) {
        // 祈祷 → 1 CP
        const currentCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newCp = Math.min(currentCp + 1, CP_MAX);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: 1, newValue: newCp },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 10,
        } as CpChangedEvent);
    }
    return events;
}

/**
 * 教会税升级 (Upgrade Tithes)
 * 升级被动收入：income 阶段额外获得 1CP（总计 2CP）
 * 通过在玩家状态上标记 incomeBonus 实现
 */
function handleUpgradeTithes({ targetId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    // 通过 TOKEN_GRANTED 事件标记教会税升级状态
    // 使用一个特殊的 token 来跟踪被动升级
    return [{
        type: 'TOKEN_GRANTED',
        payload: {
            targetId,
            tokenId: TOKEN_IDS.TITHES_UPGRADED,
            amount: 1,
            newTotal: 1,
            sourceAbilityId: 'paladin-upgrade-tithes',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent];
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
    registerCustomActionHandler('paladin-divine-favor', handleDivineFavor, { categories: ['dice', 'resource', 'card'] });
    registerCustomActionHandler('paladin-absolution', handleAbsolution, { categories: ['dice', 'damage', 'defense'] });
    registerCustomActionHandler('paladin-upgrade-tithes', handleUpgradeTithes, { categories: ['resource'] });

    registerCustomActionHandler('paladin-blessing-prevent', handleBlessingPrevent, { categories: ['token', 'defense'] });
}
