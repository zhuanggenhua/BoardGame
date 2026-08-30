/**
 * 閲庤洰浜?(Barbarian) 涓撳睘 Custom Action 澶勭悊鍣?
 */

import { getActiveDice, getAttackMaxDuplicateValueCount, getFaceCounts, getPendingBonusSettlementDice, getPlayerDieFace } from '../rules';
import { STATUS_IDS, BARBARIAN_DICE_FACE_IDS as FACES } from '../ids';
import type {
    DiceThroneEvent,
    HealAppliedEvent,
    StatusAppliedEvent,
    BonusDieRolledEvent,
    DamageShieldGrantedEvent,
    BonusDamageAddedEvent,
    BonusDieInfo,
    PendingBonusDiceSettlement,
    PendingInteraction,
    InteractionRequestedEvent,
} from '../types';
import { registerCustomActionHandler, createDisplayOnlySettlement, type CustomActionContext } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import { isRemovableStatusId } from '../statusRemoval';

// ============================================================================

const BARBARIAN_SUPPRESS_SETTLEMENT_ID = 'barbarian-suppress-roll';
const BARBARIAN_SUPPRESS_2_SETTLEMENT_ID = 'barbarian-suppress-2-roll';
const BARBARIAN_LUCKY_SETTLEMENT_ID = 'barbarian-lucky-roll-heal';
const BARBARIAN_MORE_PLEASE_SETTLEMENT_ID = 'barbarian-more-please-roll-damage';
// 閲庤洰浜烘妧鑳藉鐞嗗櫒
// 娉ㄦ剰锛氶闈互 diceConfig.ts 涓哄噯
// ============================================================================

/**
 * 鍘嬪埗 (Suppress)锛氭姇鎺?楠帮紝閫犳垚鐐规暟鎬诲拰鐨勪激瀹筹紱鑻ユ€绘暟>14锛屾柦鍔犺剳闇囪崱 銆愬凡杩佺Щ鍒版柊浼ゅ璁＄畻绠＄嚎銆?
 */
function handleBarbarianSuppressRoll({ ctx, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];
    // D10 淇锛氳繘鏀绘妧鑳戒激瀹?debuff 鐩爣蹇呴』鐢?ctx.defenderId锛堝鎵嬶級锛屼笉鑳界敤 targetId锛堝彈 action.target 鎺у埗锛?
    const opponentId = ctx.defenderId;

    // 鎶曟幏3涓瀛愶紝绱姞鐐规暟鎬诲拰
    for (let i = 0; i < 3; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: opponentId,
                effectKey: 'bonusDie.effect.barbarianSuppress',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, opponentId, dice, timestamp, {
        customResolutionId: BARBARIAN_SUPPRESS_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
    }));

    return events;
}

/**
 * 鍘嬪埗 II (Suppress II) 鍔涢噺鍙樹綋锛氭姇鎺?楠帮紝閫犳垚鐐规暟鎬诲拰浼ゅ锛涜嫢鎬绘暟>9锛屾柦鍔犺剳闇囪崱 銆愬凡杩佺Щ鍒版柊浼ゅ璁＄畻绠＄嚎銆?
 */
function handleBarbarianSuppress2Roll({ ctx, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];
    // D10 淇锛氳繘鏀绘妧鑳戒激瀹?debuff 鐩爣蹇呴』鐢?ctx.defenderId锛堝鎵嬶級
    const opponentId = ctx.defenderId;

    for (let i = 0; i < 3; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: opponentId,
                effectKey: 'bonusDie.effect.barbarianSuppress',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, opponentId, dice, timestamp, {
        customResolutionId: BARBARIAN_SUPPRESS_2_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
    }));
    return events;
}

/**
 * 鍘氱毊 (Thick Skin)锛氭牴鎹績楠伴潰鏁版不鐤?
 * 闃插尽闃舵鎶曟幏楠板瓙鍚庯紝姣忎釜蹇冮闈㈡不鐤?鐐?
 */
function handleBarbarianThickSkin({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    // 缁熻蹇冮闈㈡暟閲?
    const faceCounts = getFaceCounts(getActiveDice(state));
    const heartCount = faceCounts[FACES.HEART] ?? 0;

    // 娌荤枟 2 脳 蹇冮闈㈡暟閲?
    const healAmount = heartCount * 2;

    // 濮嬬粓鐢熸垚娌荤枟浜嬩欢锛堝嵆浣?heartCount=0锛夛紝纭繚 UI 鎾斁闃插尽鎶€鑳藉弽棣?
    events.push({
        type: 'HEAL_APPLIED',
        payload: { targetId, amount: healAmount, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as HealAppliedEvent);

    return events;
}

/**
 * 鍘氱毊 II (Thick Skin II)锛氭牴鎹績楠伴潰鏁版不鐤?+ 闃叉1涓姸鎬佹晥鏋?
 * 闃插尽闃舵鎶曟幏楠板瓙鍚庯紝鎭㈠ 2 脳 蹇冮潰鏁伴噺 鐨勭敓鍛藉€硷紝骞堕槻姝?涓嵆灏嗗彈鍒扮殑鐘舵€佹晥鏋?
 */
function handleBarbarianThickSkin2({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    // 缁熻蹇冮闈㈡暟閲?
    const faceCounts = getFaceCounts(getActiveDice(state));
    const heartCount = faceCounts[FACES.HEART] ?? 0;

    // 娌荤枟 2 脳 蹇冮闈㈡暟閲?
    const healAmount = heartCount * 2;

    // 濮嬬粓鐢熸垚娌荤枟浜嬩欢锛堝嵆浣?heartCount=0锛夛紝纭繚 UI 鎾斁闃插尽鎶€鑳藉弽棣?
    events.push({
        type: 'HEAL_APPLIED',
        payload: { targetId, amount: healAmount, sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as HealAppliedEvent);

    // 二级防御可移除本次投掷阶段已经施加的一个状态。
    // 仅从攻击期间实际新增、当前仍存在且规则允许移除的状态中选择，
    // 因此不会误删攻击开始前就有的状态，也不会误删诅咒金币。
    const appliedStatuses = state.pendingAttack?.defenderId === targetId
        ? state.pendingAttack.statusEffectsAppliedThisAttack ?? {}
        : {};
    const removableStatusId = Object.keys(appliedStatuses).find((statusId) =>
        (appliedStatuses[statusId] ?? 0) > 0
        && (state.players[targetId]?.statusEffects[statusId] ?? 0) > 0
        && isRemovableStatusId(state, statusId)
    );
    if (removableStatusId) {
        events.push({
            type: 'STATUS_REMOVED',
            payload: { targetId, statusId: removableStatusId, stacks: 1 },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DiceThroneEvent);
    }

    // 鑻ユ姇鍑?2 涓垨浠ヤ笂蹇冮潰锛屾巿浜堢姸鎬侀槻鎶?
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
 * 大吉大利 (Lucky)：投掷3骰，治疗 1 + 2×心面数
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

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, attackerId, dice, timestamp + 3, {
        customResolutionId: BARBARIAN_LUCKY_SETTLEMENT_ID,
        summaryEffectKey: 'bonusDie.effect.luckyRoll.result',
        summaryEffectParams: { heartCount, healAmount: 1 + 2 * heartCount },
        continuation: { kind: 'complete' },
    }));

    return events;
}

/**
 * 再来点儿 (More Please)：投掷5骰
 * - 增加 1×剑面数 伤害到当前攻击
 * - 施加脑震荡
 */
function handleMorePleaseRollDamage({ ctx, attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];
    const opponentId = ctx.defenderId;

    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        dice.push({ index: i, value, face });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: opponentId,
                effectKey: 'bonusDie.effect.morePleaseRoll',
                effectParams: { value, index: i },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, opponentId, dice, timestamp + 5, {
        customResolutionId: BARBARIAN_MORE_PLEASE_SETTLEMENT_ID,
        summaryEffectKey: 'bonusDie.effect.morePleaseRoll.result',
        // “再来点儿”是主攻击伤害前的攻击修正：奖励骰确认后应回到父攻击的正常伤害结算，
        // 不能标成 readyToResolve（该阶段表示主伤害已经落地，只剩 ATTACK_RESOLVED 收口）。
        continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
    }));

    return events;
}

/**
 * 重击 II / III：仅当攻击骰至少 4 个相同数字时，本次攻击变为不可防御。
 */
function handleBarbarianSlapUnblockableIfFourKind({ attackerId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    if (getAttackMaxDuplicateValueCount(state) < 4) {
        return [];
    }

    return [{
        type: 'ATTACK_MADE_UNDEFENDABLE',
        payload: { attackerId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent];
}

/**
 * 百折不挠 II：仅当攻击骰至少 3 个相同数字，且自身有可移除状态时，才允许移除自身 1 个状态。
 */
function handleBarbarianSteadfastRemoveStatusIfThreeKind({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    if (getAttackMaxDuplicateValueCount(state) < 3) {
        return [];
    }
    const attacker = state.players[attackerId];
    const hasRemovableStatus = [attacker?.statusEffects, attacker?.tokens].some((entries) =>
        Object.entries(entries ?? {}).some(([statusId, stacks]) =>
            stacks > 0 && isRemovableStatusId(state, statusId)
        )
    );

    if (!hasRemovableStatus) {
        return [];
    }

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectStatus',
        titleKey: 'interaction.selectStatusToRemove',
        selectCount: 1,
        selected: [],
        targetPlayerIds: [attackerId],
        resumeAttackSettlementOnComplete: state.pendingAttack?.sourceAbilityId === sourceAbilityId
            ? { stage: 'readyToResolve' }
            : undefined,
    };

    return [{ type: 'INTERACTION_REQUESTED', payload: { interaction }, sourceCommandType: 'ABILITY_EFFECT', timestamp } as InteractionRequestedEvent];
}

// ============================================================================
// 注册所有野蛮人 Custom Action 处理器
// ============================================================================

export function registerBarbarianCustomActions(): void {
    const buildSuppressFollowup = (
        threshold: number,
        state: CustomActionContext['state'],
        settlement: PendingBonusDiceSettlement,
        timestamp: number,
    ): DiceThroneEvent[] => {
        const dice = getPendingBonusSettlementDice(settlement);
        const total = dice.reduce((sum, die) => sum + die.value, 0);
        const events = createDamageCalculation({
            source: { playerId: settlement.attackerId, abilityId: settlement.sourceAbilityId },
            target: { playerId: settlement.targetId },
            baseDamage: total,
            state,
            timestamp,
        }).toEvents({ includeSideEffects: true });
        if (total <= threshold) return events;

        const target = state.players[settlement.targetId];
        const currentStacks = target?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
        const maxStacks = state.tokenDefinitions.find(entry => entry.id === STATUS_IDS.CONCUSSION)?.stackLimit || 1;
        events.push({
            type: 'STATUS_APPLIED',
            payload: {
                targetId: settlement.targetId,
                statusId: STATUS_IDS.CONCUSSION,
                stacks: 1,
                newTotal: Math.min(currentStacks + 1, maxStacks),
                sourceAbilityId: settlement.sourceAbilityId,
            },
            sourceCommandType: 'BONUS_DICE_SETTLED',
            timestamp: timestamp + 1,
        } as StatusAppliedEvent);
        return events;
    };

    registerBonusDiceSettlementHandler(BARBARIAN_SUPPRESS_SETTLEMENT_ID, ({ state, settlement, timestamp }) => ({
        totalDamage: 0,
        followupEvents: buildSuppressFollowup(14, state, settlement, timestamp),
    }));
    registerBonusDiceSettlementHandler(BARBARIAN_SUPPRESS_2_SETTLEMENT_ID, ({ state, settlement, timestamp }) => ({
        totalDamage: 0,
        followupEvents: buildSuppressFollowup(9, state, settlement, timestamp),
    }));
    registerBonusDiceSettlementHandler(BARBARIAN_LUCKY_SETTLEMENT_ID, ({ settlement, timestamp }) => {
        const heartCount = getPendingBonusSettlementDice(settlement).filter(die => die.face === FACES.HEART).length;
        return {
            totalDamage: 0,
            followupEvents: [{
                type: 'HEAL_APPLIED',
                payload: {
                    targetId: settlement.attackerId,
                    amount: 1 + 2 * heartCount,
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as HealAppliedEvent],
        };
    });
    registerBonusDiceSettlementHandler(BARBARIAN_MORE_PLEASE_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const swordCount = getPendingBonusSettlementDice(settlement).filter(die => die.face === FACES.SWORD).length;
        const target = state.players[settlement.targetId];
        const currentStacks = target?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
        const maxStacks = state.tokenDefinitions.find(entry => entry.id === STATUS_IDS.CONCUSSION)?.stackLimit || 1;
        const followupEvents: DiceThroneEvent[] = [];
        if (swordCount > 0) {
            followupEvents.push({
                type: 'BONUS_DAMAGE_ADDED',
                payload: {
                    playerId: settlement.attackerId,
                    amount: swordCount,
                    sourceCardId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as BonusDamageAddedEvent);
        }
        followupEvents.push({
            type: 'STATUS_APPLIED',
            payload: {
                targetId: settlement.targetId,
                statusId: STATUS_IDS.CONCUSSION,
                stacks: 1,
                newTotal: Math.min(currentStacks + 1, maxStacks),
                sourceAbilityId: settlement.sourceAbilityId,
            },
            sourceCommandType: 'BONUS_DICE_SETTLED',
            timestamp: timestamp + 1,
        } as StatusAppliedEvent);
        return { totalDamage: 0, followupEvents };
    });

    registerCustomActionHandler('barbarian-suppress-roll', handleBarbarianSuppressRoll, {
        categories: ['dice', 'damage', 'status'],
    });
    registerCustomActionHandler('barbarian-suppress-2-roll', handleBarbarianSuppress2Roll, {
        categories: ['dice', 'damage', 'status'],
    });
    registerCustomActionHandler('barbarian-thick-skin', handleBarbarianThickSkin, {
        categories: ['other', 'resource'],
    });
    registerCustomActionHandler('barbarian-thick-skin-2', handleBarbarianThickSkin2, {
        categories: ['other', 'resource'],
    });
    registerCustomActionHandler('lucky-roll-heal', handleLuckyRollHeal, {
        categories: ['dice', 'resource'],
    });
    registerCustomActionHandler('more-please-roll-damage', handleMorePleaseRollDamage, {
        categories: ['dice', 'damage', 'status'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('barbarian-slap-unblockable-if-four-kind', handleBarbarianSlapUnblockableIfFourKind, {
        categories: ['defense', 'dice'],
    });
    registerCustomActionHandler('barbarian-steadfast-remove-status-if-three-kind', handleBarbarianSteadfastRemoveStatusIfThreeKind, {
        categories: ['status', 'dice'],
        requiresInteraction: true,
    });
}

