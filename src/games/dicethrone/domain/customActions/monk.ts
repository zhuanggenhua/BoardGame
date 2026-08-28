/**
 * 僧侣 (Monk) 专属 Custom Action 处理器
 */

import { getActiveDice, getFaceCounts, getMaxDuplicateValueCount, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { TOKEN_IDS, DICE_FACE_IDS } from '../ids';
import type {
    DiceThroneEvent,
    TokenGrantedEvent,
    ChoiceRequestedEvent,
    BonusDieRolledEvent,
    TokenLimitChangedEvent,
    RollLimitChangedEvent,
} from '../types';
import { CP_MAX } from '../types';
import {
    registerCustomActionHandler,
    createBonusDiceWithReroll,
    type BonusDiceRollConfig,
    type CustomActionContext,
} from '../effects';
import {
    registerBonusDiceSettlementHandler,
    type BonusDiceSettlementHandlerContext,
    type BonusDiceSettlementHandlerResult,
} from '../bonusDiceSettlement';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';


// ============================================================================
// 僧侣技能处理器
// ============================================================================

/** 冥想：根据太极骰面数量获得太极 Token */
function handleMeditationTaiji({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const amountToAdd = faceCounts[DICE_FACE_IDS.TAIJI];
    const target = state.players[targetId];
    const currentAmount = target?.tokens[TOKEN_IDS.TAIJI] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
    const newTotal = Math.min(currentAmount + amountToAdd, maxStacks);
    const grantedAmount = Math.max(0, newTotal - currentAmount);
    return [{
        type: 'TOKEN_GRANTED',
        payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: grantedAmount, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent];
}

/** 清修 III：获得太极，若同时投出太极+莲花则选择闪避或净化 */
function handleMeditation3Taiji({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const amountToAdd = faceCounts[DICE_FACE_IDS.TAIJI];
    const target = state.players[targetId];
    const currentAmount = target?.tokens[TOKEN_IDS.TAIJI] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
    const newTotal = Math.min(currentAmount + amountToAdd, maxStacks);
    const grantedAmount = Math.max(0, newTotal - currentAmount);
    const events: DiceThroneEvent[] = [{
        type: 'TOKEN_GRANTED',
        payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: grantedAmount, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent];

    // 图片条件：同时投出太极+莲花（各至少1个）
    if (faceCounts[DICE_FACE_IDS.TAIJI] >= 1 && faceCounts[DICE_FACE_IDS.LOTUS] >= 1) {
        events.push({
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: targetId,
                sourceAbilityId,
                titleKey: 'choices.evasiveOrPurifyToken',
                options: [
                    { tokenId: TOKEN_IDS.EVASIVE, value: 1 },
                    { tokenId: TOKEN_IDS.PURIFY, value: 1 },
                ],
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as ChoiceRequestedEvent);
    }

    return events;
}

/** 冥想：根据拳骰面数量造成伤害 【已迁移到新伤害计算管线】 */
function handleMeditationDamage({ ctx, targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getFaceCounts(getActiveDice(state));
    const baseDamage = faceCounts[DICE_FACE_IDS.FIST];
    
    const damageCalc = createDamageCalculation({
        source: { playerId: ctx.attackerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage,
        state,
        timestamp,
    });

    return damageCalc.toEvents({ includeSideEffects: true }) as DiceThroneEvent[];
}

/** 一掷千金：投掷1骰子，获得½数值的CP（向上取整） */
const ONE_THROW_FORTUNE_SETTLEMENT_ID = 'one-throw-fortune-cp';

function handleOneThrowFortuneCp({ targetId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dieValue = random.d(6);
    const face = getPlayerDieFace(state, targetId, dieValue) ?? '';
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: { value: dieValue, face, playerId: targetId, targetPlayerId: targetId, effectKey: 'bonusDie.effect.gainCp', effectParams: { cp: Math.ceil(dieValue / 2), value: dieValue } },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent);
    events.push({
        type: 'BONUS_DICE_REROLL_REQUESTED',
        payload: {
            settlement: {
                id: `${sourceAbilityId}-display-${timestamp}`,
                sourceAbilityId,
                attackerId: targetId,
                targetId,
                dice: [{ index: 0, value: dieValue, face, effectKey: 'bonusDie.effect.gainCp', effectParams: { cp: Math.ceil(dieValue / 2), value: dieValue } }],
                rerollCostTokenId: '',
                rerollCostAmount: 0,
                rerollCount: 0,
                maxRerollCount: 0,
                readyToSettle: false,
                displayOnly: true,
                showTotal: false,
                customResolutionId: ONE_THROW_FORTUNE_SETTLEMENT_ID,
                allowDiceModification: true,
                continuation: { kind: 'complete' },
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent);
    return events;
}


/** 花开见佛：可花费2太极令此次攻击不可防御 */
function handleLotusPalmUnblockableChoice({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const taijiCount = state.players[targetId]?.tokens?.[TOKEN_IDS.TAIJI] ?? 0;
    if (taijiCount < 2) return [];
    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: targetId,
            sourceAbilityId,
            titleKey: 'choices.lotusPalmUnblockable.title',
            options: [
                { tokenId: TOKEN_IDS.TAIJI, value: -2, customId: 'lotus-palm-unblockable-pay', labelKey: 'choices.lotusPalmUnblockable.pay2' },
                { value: 0, customId: 'lotus-palm-unblockable-skip', labelKey: 'choices.lotusPalmUnblockable.skip' },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

/** 花开见佛：太极上限+1，然后获得5气（受新上限限制） */
function handleLotusPalmTaijiCapUpAndGrant5({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[targetId];
    if (!player) return [];
    const currentLimitRaw = player.tokenStackLimits?.[TOKEN_IDS.TAIJI];
    const currentLimit = typeof currentLimitRaw === 'number' ? (currentLimitRaw === 0 ? Infinity : currentLimitRaw) : getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
    if (currentLimit === Infinity) return [];
    const events: DiceThroneEvent[] = [];
    const newLimit = currentLimit + 1;
    events.push({ type: 'TOKEN_LIMIT_CHANGED', payload: { playerId: targetId, tokenId: TOKEN_IDS.TAIJI, delta: 1, newLimit, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenLimitChangedEvent);
    const currentAmount = player.tokens?.[TOKEN_IDS.TAIJI] ?? 0;
    const newTotal = Math.min(currentAmount + 5, newLimit);
    const amountToAdd = Math.max(0, newTotal - currentAmount);
    if (amountToAdd > 0) {
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: amountToAdd, newTotal, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
    }
    return events;
}

/** 超凡入圣：太极上限+1，并立即补满太极 */
function handleLotusPalmTaijiCapUpAndFill({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[targetId];
    if (!player) return [];
    const currentLimitRaw = player.tokenStackLimits?.[TOKEN_IDS.TAIJI];
    const currentLimit = typeof currentLimitRaw === 'number' ? (currentLimitRaw === 0 ? Infinity : currentLimitRaw) : getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
    if (currentLimit === Infinity) return [];
    const events: DiceThroneEvent[] = [];
    const newLimit = currentLimit + 1;
    events.push({ type: 'TOKEN_LIMIT_CHANGED', payload: { playerId: targetId, tokenId: TOKEN_IDS.TAIJI, delta: 1, newLimit, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenLimitChangedEvent);
    const currentAmount = player.tokens?.[TOKEN_IDS.TAIJI] ?? 0;
    const newTotal = Math.min(newLimit, Math.max(0, newLimit));
    const amountToAdd = Math.max(0, newTotal - currentAmount);
    if (amountToAdd > 0) {
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: amountToAdd, newTotal, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
    }
    return events;
}

/** 花开见佛 II：太极上限+1，然后获得6气（受新上限限制） */
function handleLotusPalmTaijiCapUpAndGrant6({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[targetId];
    if (!player) return [];
    const currentLimitRaw = player.tokenStackLimits?.[TOKEN_IDS.TAIJI];
    const currentLimit = typeof currentLimitRaw === 'number' ? (currentLimitRaw === 0 ? Infinity : currentLimitRaw) : getTokenStackLimit(state, targetId, TOKEN_IDS.TAIJI);
    if (currentLimit === Infinity) return [];
    const events: DiceThroneEvent[] = [];
    const newLimit = currentLimit + 1;
    events.push({ type: 'TOKEN_LIMIT_CHANGED', payload: { playerId: targetId, tokenId: TOKEN_IDS.TAIJI, delta: 1, newLimit, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenLimitChangedEvent);
    // 固定获得6气（受新上限限制）
    const currentAmount = player.tokens?.[TOKEN_IDS.TAIJI] ?? 0;
    const newTotal = Math.min(currentAmount + 6, newLimit);
    const amountToAdd = Math.max(0, newTotal - currentAmount);
    if (amountToAdd > 0) {
        events.push({ type: 'TOKEN_GRANTED', payload: { targetId, tokenId: TOKEN_IDS.TAIJI, amount: amountToAdd, newTotal, sourceAbilityId }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as TokenGrantedEvent);
    }
    return events;
}

/** 拳术 III：若攻击骰至少 4 个相同数字，则施加倒地 */
function handleFistTechnique3KnockdownIfFourKind({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    if (getMaxDuplicateValueCount(getActiveDice(state)) < 4) return [];
    const target = state.players[targetId];
    if (!target) return [];
    const currentStacks = target.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
    const def = state.tokenDefinitions.find(e => e.id === STATUS_IDS.KNOCKDOWN);
    const maxStacks = def?.stackLimit || 99;
    const newTotal = Math.min(currentStacks + 1, maxStacks);
    return [{
        type: 'STATUS_APPLIED',
        payload: { targetId, statusId: STATUS_IDS.KNOCKDOWN, stacks: 1, newTotal, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent];
}

type ThunderStrikeBonusConfig = BonusDiceRollConfig;

const THUNDER_STRIKE_SETTLEMENT_ID = 'monk-thunder-strike-settlement';
const THUNDER_STRIKE_2_SETTLEMENT_ID = 'monk-thunder-strike-2-settlement';

import { STATUS_IDS } from '../ids';
import type {
    StatusAppliedEvent,
    BonusDieInfo,
} from '../types';

/**
 * 雷霆万钧/雷霆一击通用：投掷多骰 + 可选重掷 + 总和伤害 + 阈值效果
 * 使用通用 createBonusDiceWithReroll；最终伤害统一等到奖励骰确认后产生。
 */
const createThunderStrikeRollDamageEvents = (
    ctx: CustomActionContext,
    config: ThunderStrikeBonusConfig
): DiceThroneEvent[] => {
    return createBonusDiceWithReroll(ctx, config, () => []);
};

function resolveThunderStrikeSettlement({
    state,
    settlement,
    timestamp,
}: BonusDiceSettlementHandlerContext): BonusDiceSettlementHandlerResult {
    const dice = Array.isArray(settlement.dice) ? settlement.dice : [];
    const totalDamage = dice.reduce((sum, die) => sum + die.value, 0);
    const followupEvents: DiceThroneEvent[] = [];

    // 无太极时旧路径会立即执行这段伤害；现在必须等确认后的最终骰面再生成。
    if (settlement.displayOnly) {
        followupEvents.push(...createDamageCalculation({
            source: { playerId: settlement.attackerId, abilityId: settlement.sourceAbilityId },
            target: { playerId: settlement.targetId },
            baseDamage: totalDamage,
            state,
            timestamp,
        }).toEvents({ includeSideEffects: true }) as DiceThroneEvent[]);

        if (settlement.threshold !== undefined && totalDamage >= settlement.threshold && settlement.thresholdEffect === 'knockdown') {
            const target = state.players[settlement.targetId];
            const currentStacks = target?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
            const def = state.tokenDefinitions.find((entry) => entry.id === STATUS_IDS.KNOCKDOWN);
            const maxStacks = def?.stackLimit || 99;
            followupEvents.push({
                type: 'STATUS_APPLIED',
                payload: {
                    targetId: settlement.targetId,
                    statusId: STATUS_IDS.KNOCKDOWN,
                    stacks: 1,
                    newTotal: Math.min(currentStacks + 1, maxStacks),
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as StatusAppliedEvent);
        }
    }

    return { totalDamage, followupEvents };
}

/**
 * 雷霆万钧: 投掷3骰，造成总和伤害，可花费2太极重掷其中1颗
 */
function handleThunderStrikeRollDamage(context: CustomActionContext): DiceThroneEvent[] {
    return createThunderStrikeRollDamageEvents(context, {
        diceCount: 3,
        rerollCostTokenId: TOKEN_IDS.TAIJI,
        rerollCostAmount: 2,
        maxRerollCount: 1,
        dieEffectKey: 'bonusDie.effect.thunderStrikeDie',
        rerollEffectKey: 'bonusDie.effect.thunderStrikeReroll',
        customResolutionId: THUNDER_STRIKE_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
        allowDiceModification: true,
        opensAfterRollConfirmedResponseWindow: true,
    });
}

/**
 * 雷霆一击 II / 风暴突袭 II: 投掷3骰，造成总和伤害，>=12施加倒地
 */
function handleThunderStrike2RollDamage(context: CustomActionContext): DiceThroneEvent[] {
    return createThunderStrikeRollDamageEvents(context, {
        diceCount: 3,
        rerollCostTokenId: TOKEN_IDS.TAIJI,
        rerollCostAmount: 1,
        maxRerollCount: 1,
        dieEffectKey: 'bonusDie.effect.thunderStrike2Die',
        rerollEffectKey: 'bonusDie.effect.thunderStrike2Reroll',
        customResolutionId: THUNDER_STRIKE_2_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
        threshold: 12,
        thresholdEffect: 'knockdown',
        allowDiceModification: true,
        opensAfterRollConfirmedResponseWindow: true,
    });
}

/** 获得2CP */
function handleGrantCp2({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [{
        type: 'CP_CHANGED',
        payload: { playerId: targetId, delta: 2, newValue: (state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0) + 2, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    }];
}

/** 额外投掷次数 */
function handleGrantExtraRoll({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const newLimit = state.rollLimit + 1;
    return [{
        type: 'ROLL_LIMIT_CHANGED',
        payload: { playerId: targetId, delta: 1, newLimit, sourceCardId: sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as RollLimitChangedEvent];
}

// ============================================================================
// 注册所有僧侣 Custom Action 处理器
// ============================================================================

export function registerMonkCustomActions(): void {
    registerBonusDiceSettlementHandler(THUNDER_STRIKE_SETTLEMENT_ID, resolveThunderStrikeSettlement);
    registerBonusDiceSettlementHandler(THUNDER_STRIKE_2_SETTLEMENT_ID, resolveThunderStrikeSettlement);
    registerBonusDiceSettlementHandler(ONE_THROW_FORTUNE_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const dieValue = Math.max(1, Math.min(6, Math.trunc(settlement.dice[0]?.value ?? 1)));
        const cpGain = Math.ceil(dieValue / 2);
        const currentCp = state.players[settlement.attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        return {
            totalDamage: 0,
            followupEvents: [{
                type: 'CP_CHANGED',
                payload: {
                    playerId: settlement.attackerId,
                    delta: cpGain,
                    newValue: Math.min(CP_MAX, currentCp + cpGain),
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 0.01,
            }],
        };
    });

    // --- 防御技能相关 ---
    registerCustomActionHandler('meditation-taiji', handleMeditationTaiji, {
        categories: ['resource'],
    });
    registerCustomActionHandler('meditation-damage', handleMeditationDamage, {
        categories: ['damage'],
    });
    registerCustomActionHandler('meditation-2-taiji', handleMeditationTaiji, {
        categories: ['resource'],
    });
    registerCustomActionHandler('meditation-2-damage', handleMeditationDamage, {
        categories: ['damage'],
    });
    registerCustomActionHandler('meditation-3-taiji', handleMeditation3Taiji, {
        categories: ['resource', 'choice'],
    });
    registerCustomActionHandler('meditation-3-damage', handleMeditationDamage, {
        categories: ['damage'],
    });

    // --- 技能效果相关 ---
    registerCustomActionHandler('one-throw-fortune-cp', handleOneThrowFortuneCp, {
        categories: ['resource', 'dice'],
    });

    registerCustomActionHandler('lotus-palm-unblockable-choice', handleLotusPalmUnblockableChoice, {
        categories: ['choice'],
    });
    registerCustomActionHandler('lotus-palm-taiji-cap-up-and-grant5', handleLotusPalmTaijiCapUpAndGrant5, {
        categories: ['resource'],
    });
    registerCustomActionHandler('lotus-palm-taiji-cap-up-and-fill', handleLotusPalmTaijiCapUpAndFill, {
        categories: ['resource'],
    });
    registerCustomActionHandler('lotus-palm-2-taiji-cap-up-and-grant6', handleLotusPalmTaijiCapUpAndGrant6, {
        categories: ['resource'],
    });
    registerCustomActionHandler('monk-fist-technique-3-knockdown-if-four-kind', handleFistTechnique3KnockdownIfFourKind, {
        categories: ['status'],
    });
    registerCustomActionHandler('thunder-strike-roll-damage', handleThunderStrikeRollDamage, {
        categories: ['dice', 'damage'],
    });
    registerCustomActionHandler('thunder-strike-2-roll-damage', handleThunderStrike2RollDamage, {
        categories: ['dice', 'damage'],
    });

    // --- 资源相关 ---
    registerCustomActionHandler('grant-cp-2', handleGrantCp2, {
        categories: ['resource'],
    });

    // --- 骰子相关：增加投掷次数 ---
    registerCustomActionHandler('grant-extra-roll-defense', handleGrantExtraRoll, {
        categories: ['dice'],
        phases: ['defensiveRoll'],
    });
    registerCustomActionHandler('grant-extra-roll-offense', handleGrantExtraRoll, {
        categories: ['dice'],
        phases: ['offensiveRoll'],
    });
}
