/**
 * 烈焰术士 (Pyromancer) 专属 Custom Action 处理器
 */

import { getActiveDice, getFaceCounts, getPlayerDieFace } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { STATUS_IDS, TOKEN_IDS, PYROMANCER_DICE_FACE_IDS } from '../ids';
import type {
    DiceThroneEvent,
    DamageDealtEvent,
    TokenGrantedEvent,
    TokenConsumedEvent,
    StatusAppliedEvent,
    ChoiceRequestedEvent,
    BonusDieRolledEvent,
    TokenLimitChangedEvent,
    BonusDiceRerollRequestedEvent,
    BonusDieInfo,
    PendingBonusDiceSettlement,
} from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { registerChoiceEffectHandler } from '../choiceEffects';
import { resourceSystem } from '../resourceSystem';
import { buildDrawEvents } from '../deckEvents';

// ============================================================================
// 辅助函数
// ============================================================================

const getFireMasteryCount = (ctx: CustomActionContext): number => {
    return ctx.state.players[ctx.attackerId]?.tokens[TOKEN_IDS.FIRE_MASTERY] || 0;
};

// ============================================================================
// 处理器实现
// ============================================================================

/**
 * 灵魂燃烧 (Soul Burn) — FM 获取部分（preDefense 时机）
 * 获得 2 烈焰精通
 */
const resolveSoulBurnFM = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const currentFM = getFireMasteryCount(ctx);
    const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const amountToGain = 2;
    const updatedFM = Math.min(currentFM + amountToGain, limit);

    return [{
        type: 'TOKEN_GRANTED',
        payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: amountToGain, newTotal: updatedFM, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp
    } as TokenGrantedEvent];
};

/**
 * 灵魂燃烧 (Soul Burn) — 伤害部分（withDamage 时机）
 * 所有对手造成 1x [灵魂/Fiery Soul] 伤害
 * 注意：在 defensiveRoll exit 时执行，此时骰子已被防御方覆盖，
 * 必须从 pendingAttack.attackDiceFaceCounts 读取攻击方骰面快照
 */
const resolveSoulBurnDamage = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    // 优先从 pendingAttack 快照读取攻击方骰面（防御阶段骰子已被覆盖）
    const faces = ctx.state.pendingAttack?.attackDiceFaceCounts
        ?? getFaceCounts(getActiveDice(ctx.state));
    const dmg = faces[PYROMANCER_DICE_FACE_IDS.FIERY_SOUL] || 0;

    if (dmg > 0) {
        const opponentIds = Object.keys(ctx.state.players).filter(id => id !== ctx.attackerId);
        opponentIds.forEach((targetId, idx) => {
            events.push({
                type: 'DAMAGE_DEALT',
                payload: { targetId, amount: dmg, actualDamage: dmg, sourceAbilityId: ctx.sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: ctx.timestamp + 0.1 + (idx * 0.01)
            } as DamageDealtEvent);
        });
    }
    return events;
};

/**
 * 灵魂燃烧 4x火魂 (Burning Soul 4) 结算
 * 根据 i18n 描述：火焰精通堆叠上限+1，然后获得5火焰精通
 * （击倒由 abilities.ts 的独立 inflictStatus 效果处理）
 */
const resolveSoulBurn4 = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const currentLimit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const newLimit = currentLimit + 1;

    // 1. 上限+1
    events.push({
        type: 'TOKEN_LIMIT_CHANGED',
        payload: { playerId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, delta: 1, newLimit, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp
    } as TokenLimitChangedEvent);

    // 2. 获得5火焰精通（不超过新上限）
    const currentFM = getFireMasteryCount(ctx);
    const amountToGain = 5;
    const updatedFM = Math.min(currentFM + amountToGain, newLimit);
    const actualGain = updatedFM - currentFM;

    if (actualGain > 0) {
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: actualGain, newTotal: updatedFM, sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + 0.1
        } as TokenGrantedEvent);
    }

    return events;
};

/**
 * 烈焰连击 (Fiery Combo) 结算: 根据 base-ability.png 校准
 * 1. 获得 2 火焰精通
 * 2. 然后造成 5 点伤害
 * 3. 每有 1 火焰精通 + 1 点伤害
 */
const resolveFieryCombo = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const timestamp = ctx.timestamp;

    const currentFM = getFireMasteryCount(ctx);
    const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const amountToGain = 2;
    const updatedFM = Math.min(currentFM + amountToGain, limit);

    events.push({
        type: 'TOKEN_GRANTED',
        payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: amountToGain, newTotal: updatedFM, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp
    } as TokenGrantedEvent);

    const dmg = 5 + updatedFM;
    events.push({
        type: 'DAMAGE_DEALT',
        payload: { targetId: ctx.targetId, amount: dmg, actualDamage: dmg, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 0.1
    } as DamageDealtEvent);

    return events;
};

/**
 * 炽热波纹 II (Hot Streak II) 结算
 * FM 已在 preDefense 阶段通过独立 grantToken 效果获得
 * 此处只负责伤害：造成 5 + 当前FM 点伤害
 */
const resolveFieryCombo2 = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const fm = getFireMasteryCount(ctx);
    const dmg = 5 + fm;
    return [{
        type: 'DAMAGE_DEALT',
        payload: { targetId: ctx.targetId, amount: dmg, actualDamage: dmg, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp
    } as DamageDealtEvent];
};

/**
 * 流星 (Meteor) 结算: 根据 base-ability.png 校准
 * (Stun 和 Collateral 2 在 abilities.ts 触发)
 * 1. 获得 2 火焰精通
 * 2. 然后造成 (1x FM) 不可防御伤害给对手
 */
const resolveMeteor = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const timestamp = ctx.timestamp;

    const currentFM = getFireMasteryCount(ctx);
    const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const amountToGain = 2;
    const updatedFM = Math.min(currentFM + amountToGain, limit);

    events.push({
        type: 'TOKEN_GRANTED',
        payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: amountToGain, newTotal: updatedFM, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp
    } as TokenGrantedEvent);

    // FM 伤害目标是对手，不是 ctx.targetId（custom action target='self' 导致 targetId 指向自己）
    const opponentId = Object.keys(ctx.state.players).find(id => id !== ctx.attackerId) ?? ctx.attackerId;
    if (updatedFM > 0) {
        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId: opponentId, amount: updatedFM, actualDamage: updatedFM, sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.1
        } as DamageDealtEvent);
    }
    return events;
};

/**
 * 焚尽 (Burn Down) 结算: 根据 base-ability.png 校准
 * 1. 获得 1 火焰精通
 * 2. 激活烧毁: 最多移除 4 个精通，每个造成 3 点不可防御伤害
 */
const resolveBurnDown = (ctx: CustomActionContext, dmgPerToken: number, limit: number): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const timestamp = ctx.timestamp;

    const currentFM = getFireMasteryCount(ctx);
    const maxLimit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const updatedFM = Math.min(currentFM + 1, maxLimit);

    events.push({
        type: 'TOKEN_GRANTED',
        payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: 1, newTotal: updatedFM, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp
    } as TokenGrantedEvent);

    const toConsume = Math.min(updatedFM, limit);
    if (toConsume > 0) {
        events.push({
            type: 'TOKEN_CONSUMED',
            payload: { playerId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: toConsume, newTotal: updatedFM - toConsume },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.1
        } as TokenConsumedEvent);

        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId: ctx.targetId, amount: toConsume * dmgPerToken, actualDamage: toConsume * dmgPerToken, sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.2
        } as DamageDealtEvent);
    }

    return events;
};

/**
 * 点燃 (Ignite) 结算: 根据 base-ability.png 校准
 * 1. 获得 2 烈焰精通
 * 2. 然后造成 4 + (2x FM) 伤害
 */
const resolveIgnite = (ctx: CustomActionContext, base: number, multiplier: number): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const timestamp = ctx.timestamp;

    const currentFM = getFireMasteryCount(ctx);
    const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const amountToGain = 2;
    const updatedFM = Math.min(currentFM + amountToGain, limit);

    events.push({
        type: 'TOKEN_GRANTED',
        payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: amountToGain, newTotal: updatedFM, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp
    } as TokenGrantedEvent);

    const dmg = base + (updatedFM * multiplier);
    events.push({
        type: 'DAMAGE_DEALT',
        payload: { targetId: ctx.targetId, amount: dmg, actualDamage: dmg, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 0.1
    } as DamageDealtEvent);

    return events;
};

/**
 * 熔岩盔甲 (Magma Armor) 结算: 根据 base-ability.png 校准
 * 造成 dmgPerFire × [火] 伤害。
 * 获得 1x [灵魂] 烈焰精通。
 */
/**
 * 熔岩护甲：基于防御投掷的骰面结果计算效果
 * - 每个🔥火面造成 dmgPerFire 点伤害（对原攻击者）
 * - 每个🔥火魂面获得 1 个火焰精通
 * 注意：不是额外投骰子，而是读取防御阶段已投的 5 颗骰子结果
 * 注意：防御上下文中 ctx.attackerId=防御者, ctx.defenderId=原攻击者
 *       伤害目标必须用 ctx.defenderId（原攻击者），不能用 ctx.targetId（target='self' 指向防御者自身）
 */
const resolveMagmaArmor = (ctx: CustomActionContext, _diceCount: number, dmgPerFire: number = 1): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];

    // 读取防御投掷的骰面计数（防御阶段结束时 state.dice 就是防御方的骰子）
    const activeDice = getActiveDice(ctx.state);
    const faceCounts = getFaceCounts(activeDice);

    const fireCount = faceCounts[PYROMANCER_DICE_FACE_IDS.FIRE] ?? 0;
    const fierySoulCount = faceCounts[PYROMANCER_DICE_FACE_IDS.FIERY_SOUL] ?? 0;

    // 火魂面：获得火焰精通（给自己 = ctx.attackerId = 防御者）
    if (fierySoulCount > 0) {
        const currentFM = getFireMasteryCount(ctx);
        const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: fierySoulCount, newTotal: Math.min(currentFM + fierySoulCount, limit), sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp
        } as TokenGrantedEvent);
    }

    // 火面：对原攻击者造成伤害（ctx.defenderId = 原攻击者，不是 ctx.targetId）
    if (fireCount > 0) {
        const totalDamage = fireCount * dmgPerFire;
        // 防御上下文：ctx.defenderId 是原攻击者（被防御技能影响的人）
        const opponentId = ctx.ctx.defenderId;
        events.push({
            type: 'DAMAGE_DEALT',
            payload: { targetId: opponentId, amount: totalDamage, actualDamage: totalDamage, sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + 0.1
        } as DamageDealtEvent);
    }

    return events;
}


/**
 * 地狱拥抱 (Infernal Embrace) 结算
 */
const resolveInfernalEmbrace = (ctx: CustomActionContext): DiceThroneEvent[] => {
    if (!ctx.random) return [];
    const roll = ctx.random.d(6);
    const face = getPlayerDieFace(ctx.state, ctx.attackerId, roll) ?? '';
    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: { value: roll, face, playerId: ctx.attackerId, targetPlayerId: ctx.attackerId, effectKey: `bonusDie.effect.infernalEmbrace.${roll}` },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp
    } as BonusDieRolledEvent];

    if (face === PYROMANCER_DICE_FACE_IDS.METEOR) {
        const currentFM = getFireMasteryCount(ctx);
        const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: Math.max(0, limit - currentFM), newTotal: limit, sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + 0.1
        } as TokenGrantedEvent);
    } else {
        events.push(...buildDrawEvents(ctx.state, ctx.attackerId, 1, ctx.random, 'ABILITY_EFFECT', ctx.timestamp + 0.1));
    }
    return events;
};

/**
 * 炎爆术逻辑
 */
const getPyroBlastDieEffect = (face: string) => {
    if (face === PYROMANCER_DICE_FACE_IDS.FIRE) return { damage: 3 };
    if (face === PYROMANCER_DICE_FACE_IDS.MAGMA) return { burn: true };
    if (face === PYROMANCER_DICE_FACE_IDS.FIERY_SOUL) return { fm: 2 };
    if (face === PYROMANCER_DICE_FACE_IDS.METEOR) return { knockdown: true };
    return {};
};

const createPyroBlastRollEvents = (ctx: CustomActionContext, config: { diceCount: number; maxRerollCount?: number; dieEffectKey: string; rerollEffectKey: string }): DiceThroneEvent[] => {
    if (!ctx.random) return [];
    const dice: BonusDieInfo[] = [];
    const events: DiceThroneEvent[] = [];

    for (let i = 0; i < config.diceCount; i++) {
        const value = ctx.random.d(6);
        const face = getPlayerDieFace(ctx.state, ctx.attackerId, value) ?? '';
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: { value, face, playerId: ctx.attackerId, targetPlayerId: ctx.targetId, effectKey: config.dieEffectKey, effectParams: { value, index: i } },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + i
        } as BonusDieRolledEvent);
    }

    let rollingFM = getFireMasteryCount(ctx);
    const fmLimit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const hasFM = rollingFM >= 1;
    if (hasFM && config.maxRerollCount) {
        const settlement: PendingBonusDiceSettlement = {
            id: `${ctx.sourceAbilityId}-${ctx.timestamp}`,
            sourceAbilityId: ctx.sourceAbilityId,
            attackerId: ctx.attackerId,
            targetId: ctx.targetId,
            dice,
            rerollCostTokenId: TOKEN_IDS.FIRE_MASTERY,
            rerollCostAmount: 1,
            rerollCount: 0,
            maxRerollCount: config.maxRerollCount,
            rerollEffectKey: config.rerollEffectKey,
            readyToSettle: false,
            showTotal: false,
        };
        events.push({ type: 'BONUS_DICE_REROLL_REQUESTED', payload: { settlement }, sourceCommandType: 'ABILITY_EFFECT', timestamp: ctx.timestamp } as BonusDiceRerollRequestedEvent);
    } else {
        dice.forEach((d, idx) => {
            const eff = getPyroBlastDieEffect(d.face);
            if (eff.damage) events.push({ type: 'DAMAGE_DEALT', payload: { targetId: ctx.targetId, amount: eff.damage, actualDamage: eff.damage, sourceAbilityId: ctx.sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp: ctx.timestamp + 5 + idx } as DamageDealtEvent);
            if (eff.burn) events.push({ type: 'STATUS_APPLIED', payload: { targetId: ctx.targetId, statusId: STATUS_IDS.BURN, stacks: 1, newTotal: (ctx.state.players[ctx.targetId]?.statusEffects[STATUS_IDS.BURN] || 0) + 1, sourceAbilityId: ctx.sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp: ctx.timestamp + 5 + idx } as StatusAppliedEvent);
            if (eff.fm) {
                rollingFM = Math.min(rollingFM + eff.fm, fmLimit);
                const newTotal = rollingFM;
                events.push({
                    type: 'TOKEN_GRANTED',
                    payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: eff.fm, newTotal, sourceAbilityId: ctx.sourceAbilityId },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp: ctx.timestamp + 5 + idx
                } as TokenGrantedEvent);
            }
            if (eff.knockdown) events.push({ type: 'STATUS_APPLIED', payload: { targetId: ctx.targetId, statusId: STATUS_IDS.KNOCKDOWN, stacks: 1, newTotal: (ctx.state.players[ctx.targetId]?.statusEffects[STATUS_IDS.KNOCKDOWN] || 0) + 1, sourceAbilityId: ctx.sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp: ctx.timestamp + 5 + idx } as StatusAppliedEvent);
        });
    }
    return events;
};

/**
 * 烈焰赤红 (Red Hot)：每个烈焰精通增加 1 点伤害到当前攻击
 * 作为 withDamage timing 使用，通过 pendingAttack.bonusDamage 增加
 */
const resolveDmgPerFM = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const fmCount = getFireMasteryCount(ctx);
    if (fmCount <= 0) return [];
    if (ctx.state.pendingAttack && ctx.state.pendingAttack.attackerId === ctx.attackerId) {
        ctx.state.pendingAttack.bonusDamage = (ctx.state.pendingAttack.bonusDamage ?? 0) + fmCount;
    }
    return [];
};

/**
 * 升温 (Turning Up The Heat)：花费任意数量 CP，每 1CP 获得 1 火焰专精
 * 动态生成选项列表（1~maxSpend），选择后由 choiceEffectHandler 扣 CP
 */
const resolveSpendCpForFM = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const player = ctx.state.players[ctx.attackerId];
    const currentCp = player?.resources[RESOURCE_IDS.CP] ?? 0;
    if (currentCp < 1) return [];
    const currentFM = getFireMasteryCount(ctx);
    const limit = player?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const fmRoom = limit - currentFM;
    if (fmRoom <= 0) return [];

    const maxSpend = Math.min(currentCp, fmRoom);

    // 动态生成选项：花费 1~maxSpend CP
    const options: Array<{
        value: number;
        customId: string;
        tokenId: string;
        labelKey: string;
    }> = [];
    for (let i = maxSpend; i >= 1; i--) {
        options.push({
            value: i,
            customId: 'pyro-spend-cp-for-fm-confirmed',
            tokenId: TOKEN_IDS.FIRE_MASTERY,
            labelKey: `choices.pyroSpendCpForFM.pay_${i}`,
        });
    }
    // 跳过选项
    options.push({
        value: 0,
        customId: 'pyro-spend-cp-for-fm-skip',
        labelKey: 'choices.pyroSpendCpForFM.skip',
    });

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.pyroSpendCpForFM.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
};

const resolveIncreaseFMLimit = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const currentLimit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    return [{
        type: 'TOKEN_LIMIT_CHANGED',
        payload: { playerId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, delta: 1, newLimit: currentLimit + 1, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp
    } as TokenLimitChangedEvent];
};

// ============================================================================
// 注册函数
// ============================================================================

export function registerPyromancerCustomActions(): void {
    registerCustomActionHandler('soul-burn-fm', resolveSoulBurnFM, { categories: ['resource'] });
    registerCustomActionHandler('soul-burn-damage', resolveSoulBurnDamage, { categories: ['damage'] });
    registerCustomActionHandler('soul-burn-4-resolve', resolveSoulBurn4, { categories: ['resource', 'other'] });
    registerCustomActionHandler('burning-soul-2-resolve', resolveSoulBurn4, { categories: ['resource', 'other'] });

    registerCustomActionHandler('fiery-combo-resolve', resolveFieryCombo, { categories: ['damage', 'resource'] });
    registerCustomActionHandler('fiery-combo-2-resolve', resolveFieryCombo2, { categories: ['damage'] });
    registerCustomActionHandler('hot-streak-2-resolve', resolveFieryCombo2, { categories: ['damage'] });

    registerCustomActionHandler('meteor-resolve', resolveMeteor, { categories: ['damage', 'resource'] });
    registerCustomActionHandler('meteor-2-resolve', resolveMeteor, { categories: ['damage', 'resource'] });

    registerCustomActionHandler('burn-down-resolve', (ctx) => resolveBurnDown(ctx, 3, 4), { categories: ['damage', 'resource'] });
    registerCustomActionHandler('burn-down-2-resolve', (ctx) => resolveBurnDown(ctx, 4, 99), { categories: ['damage', 'resource'] });

    registerCustomActionHandler('ignite-resolve', (ctx) => resolveIgnite(ctx, 4, 2), { categories: ['damage', 'resource'] });
    registerCustomActionHandler('ignite-2-resolve', (ctx) => resolveIgnite(ctx, 5, 2), { categories: ['damage', 'resource'] });

    registerCustomActionHandler('magma-armor-resolve', (ctx) => resolveMagmaArmor(ctx, 1), { categories: ['damage', 'resource', 'defense'] });
    registerCustomActionHandler('magma-armor-2-resolve', (ctx) => resolveMagmaArmor(ctx, 2), { categories: ['damage', 'resource', 'defense'] });
    registerCustomActionHandler('magma-armor-3-resolve', (ctx) => resolveMagmaArmor(ctx, 3, 2), { categories: ['damage', 'resource', 'defense'] });

    registerCustomActionHandler('increase-fm-limit', resolveIncreaseFMLimit, { categories: ['resource'] });
    registerCustomActionHandler('pyro-increase-fm-limit', resolveIncreaseFMLimit, { categories: ['resource'] });

    registerCustomActionHandler('pyro-infernal-embrace', resolveInfernalEmbrace, { categories: ['resource', 'other'] });

    registerCustomActionHandler('pyro-details-dmg-per-fm', resolveDmgPerFM, { categories: ['damage'] });
    registerCustomActionHandler('pyro-spend-cp-for-fm', resolveSpendCpForFM, { categories: ['resource', 'choice'] });

    registerCustomActionHandler('pyro-blast-2-roll', (ctx) => createPyroBlastRollEvents(ctx, { diceCount: 2, dieEffectKey: 'bonusDie.effect.pyroBlast2Die', rerollEffectKey: 'bonusDie.effect.pyroBlast2Reroll' }), { categories: ['dice', 'other'] });
    registerCustomActionHandler('pyro-blast-3-roll', (ctx) => createPyroBlastRollEvents(ctx, { diceCount: 2, maxRerollCount: 1, dieEffectKey: 'bonusDie.effect.pyroBlast3Die', rerollEffectKey: 'bonusDie.effect.pyroBlast3Reroll' }), { categories: ['dice', 'other'] });

    registerChoiceEffectHandler('pyro-spend-cp-for-fm-confirmed', (choiceCtx) => {
        const cpToSpend = choiceCtx.value ?? 0;
        if (cpToSpend <= 0) return undefined;
        const newState = { ...choiceCtx.state };
        const player = newState.players[choiceCtx.playerId];
        if (player) {
            player.resources = resourceSystem.pay(player.resources, { [RESOURCE_IDS.CP]: cpToSpend });
        }
        return newState;
    });
}
