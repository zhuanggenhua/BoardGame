import type {
    BonusDamageAddedEvent,
    BonusDieRolledEvent,
    BonusDieInfo,
    DamageDealtEvent,
    DiceThroneEvent,
    ExtraAttackTriggeredEvent,
    PendingAttackUpdatedEvent,
    RollLimitChangedEvent,
    StatusAppliedEvent,
    TokenConsumedEvent,
    TokenGrantedEvent,
} from '../types';
import type { CustomActionContext } from '../effects';
import { createDisplayOnlySettlement, registerCustomActionHandler } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { buildDrawEvents } from '../deckEvents';
import { getActiveDice, getAttackMaxDuplicateValueCount, getPlayerDieFace, requirePlayerDieFace, getTokenStackLimit, getPendingBonusSettlementDice } from '../rules';
import { DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS, ZHIZHUXIA_DICE_FACE_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { buildStatusAppliedOrChoiceEvents } from '../statusEvents';

const applyZhizhuxiaWebbed = ({ state, attackerId, targetId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] => {
    const target = state.players[targetId];
    if (!target) return [];

    // 终极技能的 FAQ：目标在本次攻击开始时已有落网，不因堆叠上限 1 再获得新的落网。
    if (sourceAbilityId === 'ultimate-spider' && state.pendingAttack?.zhizhuxiaWebbedWasPresentAtStart) {
        return [];
    }

    const currentStacks = target.statusEffects[STATUS_IDS.WEBBED] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, STATUS_IDS.WEBBED);
    if (currentStacks >= maxStacks) return [];

    const statusEvents = buildStatusAppliedOrChoiceEvents({
        state,
        targetId,
        statusId: STATUS_IDS.WEBBED,
        stacks: 1,
        sourceAbilityId,
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    });
    const hp = target.resources[RESOURCE_IDS.HP] ?? 0;
    return [
        ...statusEvents,
        {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount: 2,
                actualDamage: Math.min(2, hp),
                sourceAbilityId: STATUS_IDS.WEBBED,
                sourcePlayerId: attackerId,
                damageScope: 'direct',
                damageOrigin: 'status',
                unblockable: true,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.001,
        } as DamageDealtEvent,
    ];
};

const triggerComboExtraAttack = ({ attackerId, targetId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
    const resolvedTargetId = state.pendingAttack?.defenderId ?? targetId;
    if (!state.players[attackerId] || !state.players[resolvedTargetId]) return [];
    return [{
        type: 'EXTRA_ATTACK_TRIGGERED',
        payload: {
            attackerId,
            targetId: resolvedTargetId,
            sourceStatusId: TOKEN_IDS.COMBO,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ExtraAttackTriggeredEvent];
};

const resolveSpiderReflex = ({ attackerId, targetId, sourceAbilityId, timestamp, random, state }: CustomActionContext): DiceThroneEvent[] => {
    if (!random) return [];
    const dice: BonusDieInfo[] = [];
    const events: DiceThroneEvent[] = [];
    for (let index = 0; index < 2; index += 1) {
        const value = random.d(6);
        const face = requirePlayerDieFace(state, attackerId, value);
        const effectKey = `bonusDie.effect.zhizhuxia.spiderReflex.${face}`;
        dice.push({ index, value, face, effectKey });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: { value, face, playerId: attackerId, targetPlayerId: targetId, effectKey },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + index * 0.01,
        } as BonusDieRolledEvent);
    }
    events.push(createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        targetId,
        dice,
        timestamp,
        {
            customResolutionId: 'zhizhuxia-spider-reflex-settlement',
            continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
        },
    ));
    return events;
};

const resolveSpiderSense = ({ attackerId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) return [];
    const defensiveDice = getActiveDice(state, 'defensiveRoll');
    const hasSpider = defensiveDice.some(die => getPlayerDieFace(state, attackerId, die.value) === ZHIZHUXIA_DICE_FACE_IDS.SPIDER);
    const hasAcceptedWeb = pending.zhizhuxiaSpiderSenseAcceptsWeb
        && defensiveDice.some(die => getPlayerDieFace(state, attackerId, die.value) === ZHIZHUXIA_DICE_FACE_IDS.WEB);
    if (!hasSpider && !hasAcceptedWeb) return [];
    return [{
        type: 'PENDING_ATTACK_UPDATED',
        payload: {
            attackerId: pending.attackerId,
            patch: { zhizhuxiaDamagePercent: -50 },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as PendingAttackUpdatedEvent];
};

const grantTokenEvent = (
    state: CustomActionContext['state'],
    targetId: string,
    tokenId: string,
    sourceAbilityId: string | undefined,
    timestamp: number,
): TokenGrantedEvent | null => {
    const player = state.players[targetId];
    if (!player) return null;
    const current = player.tokens[tokenId] ?? 0;
    const max = getTokenStackLimit(state, targetId, tokenId);
    const newTotal = Math.min(current + 1, max);
    if (newTotal <= current) return null;
    return {
        type: 'TOKEN_GRANTED',
        payload: {
            targetId,
            tokenId,
            amount: newTotal - current,
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
};

const consumeTokenEvent = (
    state: CustomActionContext['state'],
    playerId: string,
    tokenId: string,
    sourceAbilityId: string | undefined,
    timestamp: number,
): TokenConsumedEvent | null => {
    const current = state.players[playerId]?.tokens[tokenId] ?? 0;
    if (current <= 0) return null;
    return {
        type: 'TOKEN_CONSUMED',
        payload: {
            playerId,
            tokenId,
            amount: 1,
            newTotal: current - 1,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
};

const handleHeavyPunch2Combo = ({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
    if (getAttackMaxDuplicateValueCount(state) < 4) return [];
    const event = grantTokenEvent(state, attackerId, TOKEN_IDS.COMBO, sourceAbilityId, timestamp);
    return event ? [event] : [];
};

const handleFlyingEscape = ({ attackerId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending || pending.defenderId !== attackerId) return [];
    return [{
        type: 'PENDING_ATTACK_UPDATED',
        payload: {
            attackerId: pending.attackerId,
            patch: { zhizhuxiaSpiderSenseAcceptsWeb: true },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as PendingAttackUpdatedEvent];
};

const handleAmbush = ({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    const consumed = consumeTokenEvent(state, attackerId, TOKEN_IDS.INVISIBLE, sourceAbilityId, timestamp);
    if (!pending || pending.attackerId !== attackerId || !consumed) return [];
    return [
        consumed,
        {
            type: 'BONUS_DAMAGE_ADDED',
            payload: { playerId: attackerId, amount: 3, sourceCardId: sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.001,
        } as BonusDamageAddedEvent,
    ];
};

const handleWishfulThinking = ({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
    const pendingDamage = state.pendingDamage;
    const consumed = consumeTokenEvent(state, attackerId, TOKEN_IDS.INVISIBLE, sourceAbilityId, timestamp);
    if (!pendingDamage || pendingDamage.targetPlayerId !== attackerId || !consumed) return [];
    return [
        consumed,
        {
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId: attackerId,
                value: 3,
                sourceId: sourceAbilityId,
                preventStatus: false,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.001,
        },
    ];
};

const handleInvisiblePunch = ({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending || pending.defenderId !== attackerId || pending.zhizhuxiaDamagePercent !== -50) return [];
    const target = state.players[pending.attackerId];
    if (!target) return [];
    return [{
        type: 'DAMAGE_DEALT',
        payload: {
            targetId: pending.attackerId,
            amount: 3,
            actualDamage: Math.min(3, target.resources[RESOURCE_IDS.HP] ?? 0),
            sourceAbilityId,
            sourcePlayerId: attackerId,
            damageScope: 'direct',
            damageOrigin: 'card',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent];
};

const handlePraiseRoll = ({ attackerId, targetId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] => {
    if (!random) return [];
    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value);
    if (!face) throw new Error(`Zhizhuxia praise roll produced an unmapped die value: ${value}`);
    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: targetId,
            effectKey: `bonusDie.effect.zhizhuxia.praise.${face}`,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent];
    if (face === ZHIZHUXIA_DICE_FACE_IDS.FIST) {
        const event = grantTokenEvent(state, attackerId, TOKEN_IDS.INVISIBLE, sourceAbilityId, timestamp + 0.001);
        if (event) events.push(event);
    } else if (face === ZHIZHUXIA_DICE_FACE_IDS.WEB) {
        events.push(...applyZhizhuxiaWebbed({
            state,
            attackerId,
            targetId,
            sourceAbilityId,
            timestamp: timestamp + 0.001,
        } as CustomActionContext));
    } else if (face === ZHIZHUXIA_DICE_FACE_IDS.SPIDER) {
        const event = grantTokenEvent(state, attackerId, TOKEN_IDS.COMBO, sourceAbilityId, timestamp + 0.001);
        if (event) events.push(event);
    }
    return events;
};

const grantZhizhuxiaExtraDefenseRoll = ({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => ([{
    type: 'ROLL_LIMIT_CHANGED',
    payload: {
        playerId: attackerId,
        delta: 1,
        newLimit: state.rollLimit + 1,
        sourceCardId: sourceAbilityId,
    },
    sourceCommandType: 'ABILITY_EFFECT',
    timestamp,
} as RollLimitChangedEvent]);

export function registerZhizhuxiaCustomActions(): void {
    registerBonusDiceSettlementHandler('zhizhuxia-spider-reflex-settlement', ({ state, settlement, timestamp }) => {
        const dice = getPendingBonusSettlementDice(settlement);
        const totalDamage = dice.reduce((sum, die) => sum + die.value, 0);
        const target = state.players[settlement.targetId];
        const followupEvents: DiceThroneEvent[] = [];
        if (target && totalDamage > 0) {
            followupEvents.push({
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: settlement.targetId,
                    amount: totalDamage,
                    actualDamage: Math.min(totalDamage, target.resources[RESOURCE_IDS.HP] ?? 0),
                    sourceAbilityId: settlement.sourceAbilityId,
                    sourcePlayerId: settlement.attackerId,
                    damageScope: 'attack',
                    damageOrigin: 'ability',
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as DamageDealtEvent);
        }
        if (totalDamage <= 5) {
            const current = state.players[settlement.attackerId]?.tokens[TOKEN_IDS.COMBO] ?? 0;
            const max = getTokenStackLimit(state, settlement.attackerId, TOKEN_IDS.COMBO);
            const newTotal = Math.min(current + 1, max);
            if (newTotal > current) {
                followupEvents.push({
                    type: 'TOKEN_GRANTED',
                    payload: {
                        targetId: settlement.attackerId,
                        tokenId: TOKEN_IDS.COMBO,
                        amount: newTotal - current,
                        newTotal,
                        sourceAbilityId: settlement.sourceAbilityId,
                    },
                    sourceCommandType: 'BONUS_DICE_SETTLED',
                    timestamp: timestamp + 0.01,
                } as TokenGrantedEvent);
            }
        }
        return { totalDamage: 0, followupEvents };
    });

    registerCustomActionHandler('zhizhuxia-apply-webbed', applyZhizhuxiaWebbed, { categories: ['status', 'damage'] });
    registerCustomActionHandler('zhizhuxia-combo-extra-attack', triggerComboExtraAttack, { categories: ['other', 'passive'] });
    registerCustomActionHandler('zhizhuxia-spider-reflex', resolveSpiderReflex, { categories: ['dice', 'damage'] });
    registerCustomActionHandler('zhizhuxia-spider-sense', resolveSpiderSense, { categories: ['defense'] });
    registerCustomActionHandler('zhizhuxia-extra-defense-roll', grantZhizhuxiaExtraDefenseRoll, { categories: ['dice'], phases: ['defensiveRoll'] });
    registerCustomActionHandler('zhizhuxia-heavy-punch-2-combo', handleHeavyPunch2Combo, { categories: ['token'], usesAttackDiceSnapshot: true });
    registerCustomActionHandler('zhizhuxia-flying-escape', handleFlyingEscape, { categories: ['defense'] });
    registerCustomActionHandler('zhizhuxia-ambush', handleAmbush, { categories: ['damage', 'token'] });
    registerCustomActionHandler('zhizhuxia-wishful-thinking', handleWishfulThinking, { categories: ['defense', 'token'] });
    registerCustomActionHandler('zhizhuxia-invisible-punch', handleInvisiblePunch, { categories: ['damage'] });
    registerCustomActionHandler('zhizhuxia-praise-roll', handlePraiseRoll, { categories: ['dice', 'status', 'token'], requiresSelectedDefender: true });
}
