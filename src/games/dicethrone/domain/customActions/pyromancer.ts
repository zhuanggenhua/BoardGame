/**
 * 烈焰术士 (Pyromancer) 专属 Custom Action 处理器
 */

import { getActiveDice, getAttackDiceFaceCounts, getFaceCounts, getPendingBonusSettlementDice, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { STATUS_IDS, TOKEN_IDS, PYROMANCER_DICE_FACE_IDS } from '../ids';
import { buildDrawEvents } from '../deckEvents';
import type {
    DiceThroneEvent,
    DamageDealtEvent,
    TokenGrantedEvent,
    TokenConsumedEvent,
    StatusAppliedEvent,
    ChoiceRequestedEvent,
    BonusDieRolledEvent,
    TokenLimitChangedEvent,
} from '../types';
import { registerCustomActionHandler, createBonusDiceWithReroll, createDisplayOnlySettlement, type CustomActionContext } from '../effects';
import { registerChoiceEffectHandler } from '../choiceEffects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { resourceSystem } from '../resourceSystem';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';

// ============================================================================
// 辅助函数
// ============================================================================

const getFireMasteryCount = (ctx: CustomActionContext): number => {
    return ctx.state.players[ctx.attackerId]?.tokens[TOKEN_IDS.FIRE_MASTERY] || 0;
};

const PYRO_GET_FIRED_UP_SETTLEMENT_ID = 'pyro-get-fired-up-roll';
const PYRO_INFERNAL_EMBRACE_SETTLEMENT_ID = 'pyro-infernal-embrace-roll';

const getBurnNewTotal = (ctx: CustomActionContext, targetId: string): number => {
    const current = ctx.state.players[targetId]?.statusEffects[STATUS_IDS.BURN] ?? 0;
    const hasDefinition = ctx.state.tokenDefinitions?.some(def => def.id === STATUS_IDS.BURN) ?? false;
    const max = hasDefinition ? getTokenStackLimit(ctx.state, targetId, STATUS_IDS.BURN) : 1;
    return Math.min(current + 1, max);
};

const markUnblockableDamage = (events: DiceThroneEvent[], damageScope: 'attack' | 'direct'): DiceThroneEvent[] => (
    events.map(event => {
        if (event.type !== 'DAMAGE_DEALT') return event;
        return {
            ...event,
            payload: {
                ...event.payload,
                unblockable: true,
                damageScope,
            },
        } as DamageDealtEvent;
    })
);

// ============================================================================
// 处理器实现
// ============================================================================

/**
 * 燃烧之灵 — FM 获取部分
 * 获得 2 × 火魂骰面数量 的火焰精通
 * 基础版和升级版共用此 handler
 */
const resolveSoulBurn2FM = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const faces = getAttackDiceFaceCounts(ctx.state);
    const fierySoulCount = faces[PYROMANCER_DICE_FACE_IDS.FIERY_SOUL] || 0;
    const amountToGain = 2 * fierySoulCount;
    if (amountToGain <= 0) return [];

    const currentFM = getFireMasteryCount(ctx);
    const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const updatedFM = Math.min(currentFM + amountToGain, limit);

    return [{
        type: 'TOKEN_GRANTED',
        payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: amountToGain, newTotal: updatedFM, sourceAbilityId: ctx.sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp
    } as TokenGrantedEvent];
};

/**
 * 燃烧之灵 — 伤害部分（withDamage 时机）
 * 对所有对手造成 1×火魂骰面数量的附属伤害。
 * 注意：在 defensiveRoll exit 时执行，此时骰子已被防御方覆盖，
 * 必须从 pendingAttack.attackDiceFaceCounts 读取攻击方骰面快照。
 * 
 * 【已迁移到新伤害计算管线】
 */
const resolveSoulBurnDamage = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const faces = getAttackDiceFaceCounts(ctx.state);
    const dmg = faces[PYROMANCER_DICE_FACE_IDS.FIERY_SOUL] || 0;
    if (dmg <= 0) return events;

    const collateralTargets = Object.keys(ctx.state.players).filter(playerId => playerId !== ctx.attackerId);
    for (const [index, targetId] of collateralTargets.entries()) {
        const damageCalc = createDamageCalculation({
            source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId, phase: ctx.ctx.damagePhase },
            target: { playerId: targetId },
            baseDamage: dmg,
            state: ctx.state,
            timestamp: ctx.timestamp + 0.1 + (index * 0.01),
            damageScope: 'direct',
            autoCollectBonusDamage: false,
            autoCollectTokens: false,
            autoCollectStatus: false,
            autoCollectShields: false,
        });
        events.push(...markUnblockableDamage(damageCalc.toEvents({ includeSideEffects: true }), 'direct'));
    }
    return events;
};

/**
 * 烈焰连击 (Fiery Combo) 结算: 根据 base-ability.png 校准
 * 1. 获得 2 火焰精通
 * 2. 然后造成 5 点伤害
 * 3. 每有 1 火焰精通 + 1 点伤害
 * 
 * 【已迁移到新伤害计算管线】
 */
const resolveFieryCombo = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const timestamp = ctx.timestamp;
    // 伤害目标是对手，不是 ctx.targetId（custom action target='self' 导致 targetId 指向自己）
    const opponentId = ctx.ctx.defenderId;

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

    // 使用新伤害计算管线
    // 注意：伤害基于授予后的 FM 数量，需要手动添加修正（因为 state 还未更新）
    const damageCalc = createDamageCalculation({
        source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId, phase: ctx.damagePhase },
        target: { playerId: opponentId },
        baseDamage: 5,
        state: ctx.state,
        timestamp: timestamp + 0.1,
        // 手动添加 FM 修正（基于授予后的数量）
        additionalModifiers: updatedFM > 0 ? [{
            id: 'fiery-combo-fm',
            type: 'flat',
            value: updatedFM,
            priority: 10,
            source: TOKEN_IDS.FIRE_MASTERY,
            description: 'tokens.fire_mastery.name',
        }] : [],
        autoCollectTokens: false, // 手动处理 FM 修正：FM 刚授予但 state 未更新，自动收集会用旧值导致数值错误
    });
    
    events.push(...damageCalc.toEvents({ includeSideEffects: true }));

    return events;
};

/**
 * 炽热波纹 II (Hot Streak II) 结算
 * FM 已在 preDefense 阶段通过独立 grantToken 效果获得
 * 此处只负责伤害：造成 6 + 当前FM 点伤害
 * 
 * 【已迁移到新伤害计算管线】
 */
const resolveFieryCombo2 = (ctx: CustomActionContext): DiceThroneEvent[] => {
    // 伤害目标是对手，不是 ctx.targetId（custom action target='self' 导致 targetId 指向自己）
    const opponentId = ctx.ctx.defenderId;
    const fm = getFireMasteryCount(ctx);
    
    // 使用新伤害计算管线
    const damageCalc = createDamageCalculation({
        source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId, phase: ctx.damagePhase },
        target: { playerId: opponentId },
        baseDamage: 6,
        state: ctx.state,
        timestamp: ctx.timestamp,
        // 手动添加 FM 修正（因为 tokenDefinitions 可能为空）
        additionalModifiers: fm > 0 ? [{
            id: 'fiery-combo-2-fm',
            type: 'flat',
            value: fm,
            priority: 10,
            source: TOKEN_IDS.FIRE_MASTERY,
            description: 'tokens.fire_mastery.name',
        }] : [],
        autoCollectTokens: false, // 手动处理 FM 修正：FM 可能未在 tokenDefinitions 中定义 damageBonus，需手动添加
    });
    
    return damageCalc.toEvents({ includeSideEffects: true });
};

/**
 * 流星 (Meteor) 结算: 根据 base-ability.png 校准
 * (Stun 和 Collateral 2 在 abilities.ts 触发)
 * 1. 获得 2 火焰精通
 * 2. 然后造成 (1x FM) 不可防御伤害给对手
 * 
 * 【已迁移到新伤害计算管线】
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
    const opponentId = ctx.ctx.defenderId;
    if (updatedFM > 0) {
        // 使用新伤害计算管线（伤害值 = FM 数量，自动收集所有修正）
        const damageCalc = createDamageCalculation({
            source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId, phase: ctx.damagePhase },
            target: { playerId: opponentId },
            baseDamage: updatedFM,
            state: ctx.state,
            timestamp: timestamp + 0.1,
        });
        events.push(...damageCalc.toEvents({ includeSideEffects: true }));
    }
    return events;
};

/**
 * 焚尽 (Burn Down) 结算: 根据 base-ability.png 校准
 * 1. 获得 1 火焰精通
 * 2. 激活烧毁: 最多移除 4 个精通，每个造成 3 点不可防御伤害
 * 
 * 【已迁移到新伤害计算管线】
 */
const resolveBurnDown = (ctx: CustomActionContext, dmgPerToken: number, limit: number): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const timestamp = ctx.timestamp;
    // 伤害目标是对手，不是 ctx.targetId（custom action target='self' 导致 targetId 指向自己）
    const opponentId = ctx.ctx.defenderId;

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

        // 使用新伤害计算管线
        const damageCalc = createDamageCalculation({
            source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId, phase: ctx.damagePhase },
            target: { playerId: opponentId },
            baseDamage: toConsume * dmgPerToken,
            state: ctx.state,
            timestamp: timestamp + 0.2,
        });
        events.push(...damageCalc.toEvents({ includeSideEffects: true }));
    }

    return events;
};

/**
 * 点燃 (Ignite) 结算: 根据 base-ability.png 校准
 * 1. 获得 2 烈焰精通
 * 2. 然后造成 4 + (2x FM) 伤害
 * 
 * 【已迁移到新伤害计算管线】
 */
const resolveIgnite = (ctx: CustomActionContext, base: number, multiplier: number): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];
    const timestamp = ctx.timestamp;
    // 伤害目标是对手，不是 ctx.targetId（custom action target='self' 导致 targetId 指向自己）
    const opponentId = ctx.ctx.defenderId;

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

    // 使用新伤害计算管线，添加乘法修正
    const damageCalc = createDamageCalculation({
        source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId, phase: ctx.damagePhase },
        target: { playerId: opponentId },
        baseDamage: base,
        state: ctx.state,
        timestamp: timestamp + 0.1,
        // 手动添加 FM 乘法修正（因为是 2x FM，不是 1x FM）
        additionalModifiers: updatedFM > 0 ? [{
            id: 'ignite-fm-multiplier',
            type: 'flat',
            value: updatedFM * multiplier,
            priority: 10,
            source: TOKEN_IDS.FIRE_MASTERY,
            description: 'tokens.fire_mastery.name',
        }] : [],
        autoCollectTokens: false, // 手动处理 FM 修正：使用乘法系数（2x FM），自动收集只支持 1x，需手动计算
    });
    
    events.push(...damageCalc.toEvents({ includeSideEffects: true }));

    return events;
};

const resolveIgniteHeatOfSoul = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const currentLimit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    const newLimit = currentLimit + 1;
    const currentFM = getFireMasteryCount(ctx);
    const newTotal = Math.min(currentFM + 5, newLimit);
    const opponentId = ctx.ctx.defenderId;

    return [
        {
            type: 'TOKEN_LIMIT_CHANGED',
            payload: {
                playerId: ctx.attackerId,
                tokenId: TOKEN_IDS.FIRE_MASTERY,
                delta: 1,
                newLimit,
                sourceAbilityId: ctx.sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp,
        } as TokenLimitChangedEvent,
        {
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: ctx.attackerId,
                tokenId: TOKEN_IDS.FIRE_MASTERY,
                amount: 5,
                newTotal,
                sourceAbilityId: ctx.sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + 0.05,
        } as TokenGrantedEvent,
        {
            type: 'STATUS_APPLIED',
            payload: {
                targetId: opponentId,
                statusId: STATUS_IDS.BURN,
                stacks: 1,
                newTotal: getBurnNewTotal(ctx, opponentId),
                sourceAbilityId: ctx.sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + 0.1,
        } as StatusAppliedEvent,
    ];
};

/**
 * 熔岩盔甲 (Magma Armor) 结算: 根据 base-ability.png 校准
 * 造成 dmgPerFire × [火] 伤害。
 * 获得 1x [火魂] 烈焰精通。
 * II级额外：如果同时有 fire + magma，施加灼烧。
 */
/**
 * 熔岩护甲：基于防御投掷的骰面结果计算效果
 * - 每个🔥火魂面获得 1 个火焰精通
 * - （II级）如果同时有🔥fire + 🌋magma，施加灼烧
 * - 每个🔥火面造成 dmgPerFire 点伤害（对原攻击者）
 * 注意：不是额外投骰子，而是读取防御阶段已投的 5 颗骰子结果
 * 注意：防御上下文中 ctx.attackerId=防御者, ctx.defenderId=原攻击者
 *       伤害目标必须用 ctx.defenderId（原攻击者），不能用 ctx.targetId（target='self' 指向防御者自身）
 * 
 * 【已迁移到新伤害计算管线】
 */
const resolveMagmaArmor = (ctx: CustomActionContext, opts: { dmgPerFire?: number; checkBurn?: boolean } = {}): DiceThroneEvent[] => {
    const { dmgPerFire = 1, checkBurn = false } = opts;
    const events: DiceThroneEvent[] = [];

    // 读取防御投掷的骰面计数（防御阶段结束时 state.dice 就是防御方的骰子）
    const activeDice = getActiveDice(ctx.state);
    const faceCounts = getFaceCounts(activeDice);

    const fireCount = faceCounts[PYROMANCER_DICE_FACE_IDS.FIRE] ?? 0;
    const fierySoulCount = faceCounts[PYROMANCER_DICE_FACE_IDS.FIERY_SOUL] ?? 0;
    const magmaCount = faceCounts[PYROMANCER_DICE_FACE_IDS.MAGMA] ?? 0;

    // 火魂面：获得火焰精通（给自己 = ctx.attackerId = 防御者）
    if (fierySoulCount > 0) {
        const currentFM = getFireMasteryCount(ctx);
        const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
        const newTotal = Math.min(currentFM + fierySoulCount, limit);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: fierySoulCount, newTotal, sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp
        } as TokenGrantedEvent);
    }

    // 条件灼烧（II级）：同时有 fire 和 magma 面时施加灼烧
    if (checkBurn && fireCount > 0 && magmaCount > 0) {
        const opponentId = ctx.ctx.defenderId;
        events.push({
            type: 'STATUS_APPLIED',
            payload: {
                targetId: opponentId,
                statusId: STATUS_IDS.BURN,
                stacks: 1,
                newTotal: getBurnNewTotal(ctx, opponentId),
                sourceAbilityId: ctx.sourceAbilityId
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + 0.05
        } as StatusAppliedEvent);
    }

    // 火面：对原攻击者造成伤害（ctx.defenderId = 原攻击者，不是 ctx.targetId）
    if (fireCount > 0) {
        const totalDamage = fireCount * dmgPerFire;
        const opponentId = ctx.ctx.defenderId;

        // 使用新伤害计算管线（自动收集所有修正）
        const damageCalc = createDamageCalculation({
            source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId, phase: ctx.damagePhase },
            target: { playerId: opponentId },
            baseDamage: totalDamage,
            state: ctx.state,
            timestamp: ctx.timestamp + 0.1,
        });

        events.push(...damageCalc.toEvents({ includeSideEffects: true }));
    }

    return events;
}

/**
 * 熔火铠甲 III (Magma Armor III) 结算
 * 根据卡牌图片：
 * - 获得 1×🔥魂(fiery_soul) + 1×🌋(magma) 火焰专精
 * - 如果同时投出🔥(fire) + 🌋(magma)，施加灼烧
 * - 造成 1×🔥(fire) + 1×🌋(magma) 伤害
 */
const resolveMagmaArmor3 = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const events: DiceThroneEvent[] = [];

    const activeDice = getActiveDice(ctx.state);
    const faceCounts = getFaceCounts(activeDice);

    const fireCount = faceCounts[PYROMANCER_DICE_FACE_IDS.FIRE] ?? 0;
    const magmaCount = faceCounts[PYROMANCER_DICE_FACE_IDS.MAGMA] ?? 0;
    const fierySoulCount = faceCounts[PYROMANCER_DICE_FACE_IDS.FIERY_SOUL] ?? 0;

    // FM获取：fiery_soul数 + magma数
    const fmGain = fierySoulCount + magmaCount;
    if (fmGain > 0) {
        const currentFM = getFireMasteryCount(ctx);
        const limit = ctx.state.players[ctx.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: ctx.attackerId, tokenId: TOKEN_IDS.FIRE_MASTERY, amount: fmGain, newTotal: Math.min(currentFM + fmGain, limit), sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp
        } as TokenGrantedEvent);
    }

    // 条件灼烧：同时有 fire 和 magma 面
    if (fireCount > 0 && magmaCount > 0) {
        const opponentId = ctx.ctx.defenderId;
        events.push({
            type: 'STATUS_APPLIED',
            payload: { targetId: opponentId, statusId: STATUS_IDS.BURN, stacks: 1, newTotal: getBurnNewTotal(ctx, opponentId), sourceAbilityId: ctx.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp + 0.05
        } as StatusAppliedEvent);
    }

    // 伤害：fire数 + magma数
    const totalDamage = fireCount + magmaCount;
    if (totalDamage > 0) {
        const opponentId = ctx.ctx.defenderId;
        const damageCalc = createDamageCalculation({
            source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId, phase: ctx.damagePhase },
            target: { playerId: opponentId },
            baseDamage: totalDamage,
            state: ctx.state,
            timestamp: ctx.timestamp + 0.1,
        });
        events.push(...damageCalc.toEvents({ includeSideEffects: true }));
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

const PYRO_BLAST_SETTLEMENT_ID = 'pyro-blast-roll';

function buildPyroBlastDieEvents(args: {
    state: CustomActionContext['state'];
    attackerId: string;
    opponentId: string;
    sourceAbilityId: string | undefined;
    dice: Array<{ face?: string }>;
    timestamp: number;
}): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    let rollingFM = args.state.players[args.attackerId]?.tokens[TOKEN_IDS.FIRE_MASTERY] ?? 0;
    const fmLimit = args.state.players[args.attackerId]?.tokenStackLimits?.[TOKEN_IDS.FIRE_MASTERY] || 5;
    let rollingBurn = args.state.players[args.opponentId]?.statusEffects[STATUS_IDS.BURN] ?? 0;
    const burnLimit = args.state.tokenDefinitions?.some(def => def.id === STATUS_IDS.BURN)
        ? getTokenStackLimit(args.state, args.opponentId, STATUS_IDS.BURN)
        : 1;
    let rollingKnockdown = args.state.players[args.opponentId]?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
    const knockdownLimit = args.state.tokenDefinitions?.some(def => def.id === STATUS_IDS.KNOCKDOWN)
        ? getTokenStackLimit(args.state, args.opponentId, STATUS_IDS.KNOCKDOWN)
        : 1;

    args.dice.forEach((die, idx) => {
        const eff = getPyroBlastDieEffect(die.face ?? '');
        if (eff.damage) {
            events.push({
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: args.opponentId,
                    amount: eff.damage,
                    actualDamage: eff.damage,
                    sourceAbilityId: args.sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: args.timestamp + 5 + idx,
            } as DamageDealtEvent);
        }
        if (eff.burn) {
            const nextBurn = Math.min(rollingBurn + 1, burnLimit);
            if (nextBurn > rollingBurn) {
                rollingBurn = nextBurn;
                events.push({
                    type: 'STATUS_APPLIED',
                    payload: {
                        targetId: args.opponentId,
                        statusId: STATUS_IDS.BURN,
                        stacks: 1,
                        newTotal: nextBurn,
                        sourceAbilityId: args.sourceAbilityId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp: args.timestamp + 5 + idx,
                } as StatusAppliedEvent);
            }
        }
        if (eff.fm) {
            const previousFM = rollingFM;
            rollingFM = Math.min(rollingFM + eff.fm, fmLimit);
            if (rollingFM > previousFM) {
                events.push({
                    type: 'TOKEN_GRANTED',
                    payload: {
                        targetId: args.attackerId,
                        tokenId: TOKEN_IDS.FIRE_MASTERY,
                        amount: rollingFM - previousFM,
                        newTotal: rollingFM,
                        sourceAbilityId: args.sourceAbilityId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp: args.timestamp + 5 + idx,
                } as TokenGrantedEvent);
            }
        }
        if (eff.knockdown) {
            const nextKnockdown = Math.min(rollingKnockdown + 1, knockdownLimit);
            if (nextKnockdown > rollingKnockdown) {
                rollingKnockdown = nextKnockdown;
                events.push({
                    type: 'STATUS_APPLIED',
                    payload: {
                        targetId: args.opponentId,
                        statusId: STATUS_IDS.KNOCKDOWN,
                        stacks: 1,
                        newTotal: nextKnockdown,
                        sourceAbilityId: args.sourceAbilityId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp: args.timestamp + 5 + idx,
                } as StatusAppliedEvent);
            }
        }
    });

    return events;
}

const createPyroBlastRollEvents = (ctx: CustomActionContext, config: { diceCount: number; maxRerollCount?: number; rerollCostAmount?: number; dieEffectKey: string; rerollEffectKey: string }): DiceThroneEvent[] => {
    // 伤害/状态目标是对手，不是 ctx.targetId（custom action target='self' 导致 targetId 指向自己）
    const opponentId = ctx.ctx.defenderId;

    return createBonusDiceWithReroll(
        ctx,
        {
            diceCount: config.diceCount,
            rerollCostTokenId: TOKEN_IDS.FIRE_MASTERY,
            rerollCostAmount: config.rerollCostAmount ?? Infinity, // 无 maxRerollCount 时不可重掷
            maxRerollCount: config.maxRerollCount,
            dieEffectKey: config.dieEffectKey,
            rerollEffectKey: config.rerollEffectKey,
            showTotal: false,
            damageTargetId: opponentId,
            customResolutionId: PYRO_BLAST_SETTLEMENT_ID,
            allowDiceModification: true,
            opensAfterRollConfirmedResponseWindow: (dice) => dice.some((die) => {
                const effect = getPyroBlastDieEffect(die.face ?? '');
                return Object.keys(effect).length > 0;
            }),
            continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
        },
        (dice) => buildPyroBlastDieEvents({
            state: ctx.state,
            attackerId: ctx.attackerId,
            opponentId,
            sourceAbilityId: ctx.sourceAbilityId,
            dice,
            timestamp: ctx.timestamp,
        }),
    );
};

/**
 * 火之高兴！(Get Fired Up)：攻击修正。投掷1骰，根据骰面触发不同效果
 * - 火焰(FIRE)：增加3伤害（写入 pendingAttack.bonusDamage）
 * - 熔岩(MAGMA)：施加灼烧给对手
 * - 火魂(FIERY_SOUL)：获得2火焰专精
 * - 流星(METEOR)：施加倒地给对手
 */
const resolveGetFiredUpRoll = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const { attackerId, sourceAbilityId, state, timestamp, random } = ctx;
    if (!random) return [];
    const opponentId = ctx.ctx.defenderId;

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';

    let effectKey = `bonusDie.effect.${face}`;
    if (face === PYROMANCER_DICE_FACE_IDS.FIRE) {
        effectKey = 'bonusDie.effect.fire';
    } else if (face === PYROMANCER_DICE_FACE_IDS.MAGMA) {
        effectKey = 'bonusDie.effect.magma';
    } else if (face === PYROMANCER_DICE_FACE_IDS.FIERY_SOUL) {
        effectKey = 'bonusDie.effect.fiery_soul';
    } else if (face === PYROMANCER_DICE_FACE_IDS.METEOR) {
        effectKey = 'bonusDie.effect.meteor';
    }

    return [{
        type: 'BONUS_DIE_ROLLED',
        payload: { value, face, playerId: attackerId, targetPlayerId: opponentId, effectKey },
        sourceCommandType: 'ABILITY_EFFECT', timestamp,
    } as BonusDieRolledEvent, createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        opponentId,
        [{ index: 0, value, face: face as any, effectKey }],
        timestamp + 1,
        {
            customResolutionId: PYRO_GET_FIRED_UP_SETTLEMENT_ID,
            continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
        },
    )];
};

/**
 * 烈焰赤红 (Red Hot)：每个烈焰精通增加 1 点伤害到当前攻击
 * 生成 BONUS_DAMAGE_ADDED 事件，由 reducer 累加到 pendingAttack.bonusDamage
 */
const resolveDmgPerFM = (ctx: CustomActionContext): DiceThroneEvent[] => {
    const fmCount = getFireMasteryCount(ctx);
    if (fmCount <= 0) return [];

    return [{
        type: 'BONUS_DAMAGE_ADDED',
        payload: {
            playerId: ctx.attackerId,
            amount: fmCount,
            sourceCardId: 'card-red-hot',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    }];
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

    // slider 模式：确认选项（value=maxSpend 作为默认/上限）+ 跳过选项
    const options: Array<{
        value: number;
        customId: string;
        tokenId?: string;
        labelKey: string;
    }> = [
        {
            value: maxSpend,
            customId: 'pyro-spend-cp-for-fm-confirmed',
            tokenId: TOKEN_IDS.FIRE_MASTERY,
            labelKey: 'choices.pyroSpendCpForFM.confirm',
        },
        {
            value: 0,
            customId: 'pyro-spend-cp-for-fm-skip',
            labelKey: 'choices.pyroSpendCpForFM.skip',
        },
    ];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.pyroSpendCpForFM.title',
            slider: {
                confirmLabelKey: 'choices.pyroSpendCpForFM.confirmSpend',
                hintKey: 'choices.pyroSpendCpForFM.sliderHint',
            },
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

const resolveInfernalEmbraceRoll = (ctx: CustomActionContext): DiceThroneEvent[] => {
    if (!ctx.random) return [];

    const { attackerId, sourceAbilityId, state, timestamp } = ctx;
    const value = ctx.random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const effectKey = face === PYROMANCER_DICE_FACE_IDS.METEOR
        ? 'bonusDie.effect.infernalEmbrace.meteor'
        : `bonusDie.effect.infernalEmbrace.${value}`;
    return [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: attackerId,
            effectKey,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent, createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        attackerId,
        [{ index: 0, value, face: face as any, effectKey }],
        timestamp + 1,
        {
            customResolutionId: PYRO_INFERNAL_EMBRACE_SETTLEMENT_ID,
            continuation: { kind: 'complete' },
        },
    )];
};

// ============================================================================
// 注册函数
// ============================================================================

export function registerPyromancerCustomActions(): void {
    registerBonusDiceSettlementHandler(PYRO_GET_FIRED_UP_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0, followupEvents: [] };
        const followupEvents: DiceThroneEvent[] = [];
        if (die.face === PYROMANCER_DICE_FACE_IDS.FIRE) {
            followupEvents.push({
                type: 'BONUS_DAMAGE_ADDED',
                payload: { playerId: settlement.attackerId, amount: 3, sourceCardId: 'card-get-fired-up' },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            });
        } else if (die.face === PYROMANCER_DICE_FACE_IDS.MAGMA) {
            const current = state.players[settlement.targetId]?.statusEffects[STATUS_IDS.BURN] ?? 0;
            const max = state.tokenDefinitions.some(def => def.id === STATUS_IDS.BURN)
                ? getTokenStackLimit(state, settlement.targetId, STATUS_IDS.BURN)
                : 1;
            followupEvents.push({
                type: 'STATUS_APPLIED',
                payload: {
                    targetId: settlement.targetId,
                    statusId: STATUS_IDS.BURN,
                    stacks: 1,
                    newTotal: Math.min(current + 1, max),
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as StatusAppliedEvent);
        } else if (die.face === PYROMANCER_DICE_FACE_IDS.FIERY_SOUL) {
            const current = state.players[settlement.attackerId]?.tokens[TOKEN_IDS.FIRE_MASTERY] ?? 0;
            const max = getTokenStackLimit(state, settlement.attackerId, TOKEN_IDS.FIRE_MASTERY);
            followupEvents.push({
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId: settlement.attackerId,
                    tokenId: TOKEN_IDS.FIRE_MASTERY,
                    amount: Math.max(0, Math.min(current + 2, max) - current),
                    newTotal: Math.min(current + 2, max),
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as TokenGrantedEvent);
        } else if (die.face === PYROMANCER_DICE_FACE_IDS.METEOR) {
            const current = state.players[settlement.targetId]?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
            const max = state.tokenDefinitions.find(def => def.id === STATUS_IDS.KNOCKDOWN)?.stackLimit || 99;
            followupEvents.push({
                type: 'STATUS_APPLIED',
                payload: {
                    targetId: settlement.targetId,
                    statusId: STATUS_IDS.KNOCKDOWN,
                    stacks: 1,
                    newTotal: Math.min(current + 1, max),
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as StatusAppliedEvent);
        }
        return { totalDamage: 0, followupEvents };
    });
    registerBonusDiceSettlementHandler(PYRO_INFERNAL_EMBRACE_SETTLEMENT_ID, ({ state, settlement, timestamp, random }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0, followupEvents: [] };
        if (die.face === PYROMANCER_DICE_FACE_IDS.METEOR) {
            const current = getFireMasteryCount({
                attackerId: settlement.attackerId,
                state,
            } as CustomActionContext);
            const max = getTokenStackLimit(state, settlement.attackerId, TOKEN_IDS.FIRE_MASTERY);
            return {
                totalDamage: 0,
                followupEvents: [{
                    type: 'TOKEN_GRANTED',
                    payload: {
                        targetId: settlement.attackerId,
                        tokenId: TOKEN_IDS.FIRE_MASTERY,
                        amount: Math.max(0, max - current),
                        newTotal: max,
                        sourceAbilityId: settlement.sourceAbilityId,
                    },
                    sourceCommandType: 'BONUS_DICE_SETTLED',
                    timestamp,
                } as TokenGrantedEvent],
            };
        }
        return {
            totalDamage: 0,
            followupEvents: buildDrawEvents(state, settlement.attackerId, 1, random, 'BONUS_DICE_SETTLED', timestamp, settlement.sourceAbilityId),
        };
    });

    registerBonusDiceSettlementHandler(PYRO_BLAST_SETTLEMENT_ID, ({ state, settlement, timestamp }) => ({
        followupEvents: buildPyroBlastDieEvents({
            state,
            attackerId: settlement.attackerId,
            opponentId: settlement.targetId,
            sourceAbilityId: settlement.sourceAbilityId,
            dice: settlement.dice,
            timestamp,
        }),
    }));

    registerCustomActionHandler('soul-burn-2-fm', resolveSoulBurn2FM, { categories: ['resource'], usesAttackDiceSnapshot: true });
    registerCustomActionHandler('soul-burn-damage', resolveSoulBurnDamage, { categories: ['damage'], usesAttackDiceSnapshot: true });

    registerCustomActionHandler('fiery-combo-resolve', resolveFieryCombo, { categories: ['damage', 'resource'] });
    registerCustomActionHandler('fiery-combo-2-resolve', resolveFieryCombo2, { categories: ['damage'] });
    registerCustomActionHandler('hot-streak-2-resolve', resolveFieryCombo2, { categories: ['damage'] });

    registerCustomActionHandler('meteor-resolve', resolveMeteor, { categories: ['damage', 'resource'] });
    registerCustomActionHandler('meteor-2-resolve', resolveMeteor, { categories: ['damage', 'resource'] });

    registerCustomActionHandler('burn-down-resolve', (ctx) => resolveBurnDown(ctx, 3, 4), { categories: ['damage', 'resource'] });
    registerCustomActionHandler('burn-down-2-resolve', (ctx) => resolveBurnDown(ctx, 4, 4), { categories: ['damage', 'resource'] });

    registerCustomActionHandler('ignite-resolve', (ctx) => resolveIgnite(ctx, 4, 2), { categories: ['damage', 'resource'] });
    registerCustomActionHandler('ignite-2-resolve', (ctx) => resolveIgnite(ctx, 5, 2), { categories: ['damage', 'resource'] });
    registerCustomActionHandler('ignite-heat-of-soul-resolve', resolveIgniteHeatOfSoul, { categories: ['resource', 'status'] });

    registerCustomActionHandler('magma-armor-resolve', (ctx) => resolveMagmaArmor(ctx), { categories: ['damage', 'resource', 'defense'] });
    registerCustomActionHandler('magma-armor-2-resolve', (ctx) => resolveMagmaArmor(ctx, { checkBurn: true }), { categories: ['damage', 'resource', 'defense', 'status'] });
    registerCustomActionHandler('magma-armor-3-resolve', resolveMagmaArmor3, { categories: ['damage', 'resource', 'defense', 'status'] });

    registerCustomActionHandler('increase-fm-limit', resolveIncreaseFMLimit, { categories: ['resource'] });
    registerCustomActionHandler('pyro-increase-fm-limit', resolveIncreaseFMLimit, { categories: ['resource'] });
    registerCustomActionHandler('pyro-infernal-embrace-roll', resolveInfernalEmbraceRoll, { categories: ['dice', 'card', 'resource'] });

    registerCustomActionHandler('pyro-details-dmg-per-fm', resolveDmgPerFM, {
        categories: ['damage'],
    });
    registerCustomActionHandler('pyro-get-fired-up-roll', resolveGetFiredUpRoll, {
        categories: ['dice', 'damage', 'status', 'token'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('pyro-spend-cp-for-fm', resolveSpendCpForFM, { categories: ['resource', 'choice'] });

    registerCustomActionHandler('pyro-blast-2-roll', (ctx) => createPyroBlastRollEvents(ctx, { diceCount: 2, dieEffectKey: 'bonusDie.effect.pyroBlast2Die', rerollEffectKey: 'bonusDie.effect.pyroBlast2Reroll' }), { categories: ['dice', 'other'] });
    registerCustomActionHandler('pyro-blast-3-roll', (ctx) => createPyroBlastRollEvents(ctx, { diceCount: 2, maxRerollCount: 1, rerollCostAmount: 0, dieEffectKey: 'bonusDie.effect.pyroBlast3Die', rerollEffectKey: 'bonusDie.effect.pyroBlast3Reroll' }), { categories: ['dice', 'other'] });

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
