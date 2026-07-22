import type {
    BonusDieRolledEvent,
    CpChangedEvent,
    DamageDealtEvent,
    DiceThroneEvent,
    ExtraAttackTriggeredEvent,
    InteractionRequestedEvent,
    PendingAttackUpdatedEvent,
    PendingInteraction,
    PreventDamageEvent,
    StatusAppliedEvent,
    TokenLimitChangedEvent,
    TokenGrantedEvent,
} from '../types';
import { buildDrawEvents } from '../deckEvents';
import { createDisplayOnlySettlement, createDTPassiveTriggerHandler, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { STATUS_IDS, TOKEN_IDS, ZHANSHUJIA_DICE_FACE_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import { getActiveDice, getMaxDuplicateValueCount, getOpponents, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';

function gainCpWithTacticalAdvantage({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const newValue = Math.min(CP_MAX, currentCp + 1);
    return [{
        type: 'CP_CHANGED',
        payload: {
            playerId: attackerId,
            delta: newValue - currentCp,
            newValue,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as CpChangedEvent];
}

function applyTargetedWithTacticalAdvantage({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const opponentIds = getOpponents(state, attackerId);
    if (opponentIds.length === 0) return [];

    if (opponentIds.length > 1) {
        const interaction: PendingInteraction = {
            id: `${sourceAbilityId}-${timestamp}`,
            playerId: attackerId,
            sourceCardId: sourceAbilityId,
            type: 'selectPlayer',
            titleKey: 'interaction.selectPlayer',
            selectCount: 1,
            selected: [],
            targetPlayerIds: opponentIds,
            statusGrantConfig: { statusId: STATUS_IDS.TARGETED, amount: 1 },
        };

        return [{
            type: 'INTERACTION_REQUESTED',
            payload: { interaction },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as InteractionRequestedEvent];
    }

    const resolvedTargetId = opponentIds.includes(targetId) ? targetId : opponentIds[0];
    const currentStacks = state.players[resolvedTargetId]?.statusEffects[STATUS_IDS.TARGETED] ?? 0;
    const maxStacks = getTokenStackLimit(state, resolvedTargetId, STATUS_IDS.TARGETED);
    const newTotal = Math.min(currentStacks + 1, maxStacks);
    return [{
        type: 'STATUS_APPLIED',
        payload: {
            targetId: resolvedTargetId,
            statusId: STATUS_IDS.TARGETED,
            stacks: Math.max(0, newTotal - currentStacks),
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent];
}

function grantProtectWithTacticalAdvantage({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey: 'interaction.selectPlayer',
        selectCount: 1,
        selected: [],
        targetPlayerIds: Object.keys(state.players),
        tokenGrantConfig: { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
    };

    return [{
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent];
}

function increaseTacticalAdvantageLimitAndFill({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[attackerId];
    if (!player) return [];

    const currentLimit = getTokenStackLimit(state, attackerId, TOKEN_IDS.TACTICAL_ADVANTAGE);
    if (currentLimit === Infinity) return [];

    const newLimit = currentLimit + 1;
    const currentAmount = player.tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0;
    const amountToAdd = Math.max(0, newLimit - currentAmount);
    const events: DiceThroneEvent[] = [{
        type: 'TOKEN_LIMIT_CHANGED',
        payload: {
            playerId: attackerId,
            tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE,
            delta: 1,
            newLimit,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenLimitChangedEvent];

    if (amountToAdd > 0) {
        events.push({
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: attackerId,
                tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE,
                amount: amountToAdd,
                newTotal: newLimit,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as TokenGrantedEvent);
    }

    return events;
}

function triggerWarMongerExtraOffensiveRoll({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const resolvedTargetId = state.pendingAttack?.defenderId ?? targetId;
    if (!state.players[attackerId] || !state.players[resolvedTargetId]) return [];

    return [{
        type: 'EXTRA_ATTACK_TRIGGERED',
        payload: {
            attackerId,
            targetId: resolvedTargetId,
            sourceStatusId: sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ExtraAttackTriggeredEvent];
}

type WarMongerRollConfig = {
    sabreDamage: number;
    bannerTokenGain: number;
    sabreEffectKey: string;
    bannerEffectKey: string;
    medalEffectKey: string;
    otherEffectKey?: string;
};

function resolveWarMongerRollByConfig(
    {
        attackerId,
        targetId,
        sourceAbilityId,
        state,
        timestamp,
        random,
    }: CustomActionContext,
    config: WarMongerRollConfig,
): DiceThroneEvent[] {
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const effectKey = face === ZHANSHUJIA_DICE_FACE_IDS.SABRE
        ? config.sabreEffectKey
        : face === ZHANSHUJIA_DICE_FACE_IDS.BANNER
            ? config.bannerEffectKey
            : face === ZHANSHUJIA_DICE_FACE_IDS.MEDAL
                ? config.medalEffectKey
                : config.otherEffectKey ?? '';
    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: targetId,
            effectKey,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent];

    if (face === ZHANSHUJIA_DICE_FACE_IDS.SABRE) {
        const amount = config.sabreDamage;
        events.push({
            type: 'PENDING_ATTACK_UPDATED',
            payload: {
                attackerId,
                patch: { damage: amount },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as PendingAttackUpdatedEvent);
    } else if (face === ZHANSHUJIA_DICE_FACE_IDS.BANNER) {
        const currentAmount = state.players[attackerId]?.tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0;
        const maxStacks = getTokenStackLimit(state, attackerId, TOKEN_IDS.TACTICAL_ADVANTAGE);
        const newTotal = Math.min(currentAmount + config.bannerTokenGain, maxStacks);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: attackerId,
                tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE,
                amount: Math.max(0, newTotal - currentAmount),
                newTotal,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as TokenGrantedEvent);
    } else if (face === ZHANSHUJIA_DICE_FACE_IDS.MEDAL) {
        events.push(...buildDrawEvents(state, attackerId, 1, random, 'ABILITY_EFFECT', timestamp + 1, sourceAbilityId));
        events.push({
            type: 'PENDING_ATTACK_UPDATED',
            payload: {
                attackerId,
                patch: { damage: 0, isDefendable: false },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1.5,
        } as PendingAttackUpdatedEvent);
        events.push(...triggerWarMongerExtraOffensiveRoll({
            attackerId,
            targetId,
            sourceAbilityId,
            state,
            timestamp: timestamp + 2,
            random,
            action: { type: 'custom', target: 'self', customActionId: 'zhanshujia-war-monger-extra-offensive-roll' },
            ctx: {
                attackerId,
                defenderId: targetId,
                sourceAbilityId,
                state,
                damageDealt: 0,
                timestamp,
            },
        }));
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, [{ index: 0, value, face, effectKey }], timestamp));
    return events;
}

function resolveWarMongerRoll(ctx: CustomActionContext): DiceThroneEvent[] {
    return resolveWarMongerRollByConfig(ctx, {
        sabreDamage: 5,
        bannerTokenGain: 4,
        sabreEffectKey: 'bonusDie.effect.zhanshujiaWarMongerSabre',
        bannerEffectKey: 'bonusDie.effect.zhanshujiaWarMongerBanner',
        medalEffectKey: 'bonusDie.effect.zhanshujiaWarMongerMedal',
    });
}

function resolveWarMongerAttackDamage({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
    random,
    ctx,
}: CustomActionContext): DiceThroneEvent[] {
    const pending = state.pendingAttack;
    if (!pending || pending.attackerId !== attackerId || pending.sourceAbilityId !== sourceAbilityId) return [];

    const defenderId = pending.defenderId ?? targetId;
    const baseDamage = pending.damage ?? 0;
    if (baseDamage <= 0 || !state.players[defenderId]) return [];

    const calc = createDamageCalculation({
        source: { playerId: attackerId, abilityId: sourceAbilityId },
        target: { playerId: defenderId },
        baseDamage,
        state,
        damageScope: 'attack',
        autoCollectShields: false,
        passiveTriggerHandler: createDTPassiveTriggerHandler(ctx, random),
        timestamp,
    });
    const result = calc.resolve();
    const events = [...result.sideEffectEvents] as DiceThroneEvent[];
    if (result.finalDamage <= 0) return events;

    events.push({
        type: 'DAMAGE_DEALT',
        payload: {
            targetId: defenderId,
            amount: result.finalDamage,
            actualDamage: result.actualDamage,
            sourceAbilityId,
            damageScope: 'attack',
            modifiers: result.modifiers.map(modifier => ({
                type: modifier.type as 'defense' | 'token' | 'shield' | 'status',
                value: modifier.value,
                sourceId: modifier.sourceId,
                sourceName: modifier.sourceName,
            })),
            breakdown: result.breakdown,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent);

    return events;
}

function applyBindIfThreeOfAKind({
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    if (getMaxDuplicateValueCount(getActiveDice(state)) < 3) return [];

    const currentStacks = state.players[targetId]?.statusEffects[STATUS_IDS.BIND] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, STATUS_IDS.BIND);
    const newTotal = Math.min(currentStacks + 1, maxStacks);
    return [{
        type: 'STATUS_APPLIED',
        payload: {
            targetId,
            statusId: STATUS_IDS.BIND,
            stacks: Math.max(0, newTotal - currentStacks),
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent];
}

function resolveWarMonger2Roll(ctx: CustomActionContext): DiceThroneEvent[] {
    return resolveWarMongerRollByConfig(ctx, {
        sabreDamage: 6,
        bannerTokenGain: 3,
        sabreEffectKey: 'bonusDie.effect.zhanshujiaWarMonger2Sabre',
        bannerEffectKey: 'bonusDie.effect.zhanshujiaWarMonger2Banner',
        medalEffectKey: 'bonusDie.effect.zhanshujiaWarMonger2Medal',
        otherEffectKey: 'bonusDie.effect.zhanshujiaWarMonger2Other',
    });
}

function resolveWarRoomRoll({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
    random,
}: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const amount = Math.ceil(value / 2);
    const currentAmount = state.players[attackerId]?.tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0;
    const maxStacks = getTokenStackLimit(state, attackerId, TOKEN_IDS.TACTICAL_ADVANTAGE);
    const newTotal = Math.min(currentAmount + amount, maxStacks);
    const grantedAmount = Math.max(0, newTotal - currentAmount);
    const effectKey = 'bonusDie.effect.zhanshujiaWarRoom';
    const effectParams = { value, amount };

    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: attackerId,
            effectKey,
            effectParams,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent];

    if (grantedAmount > 0) {
        events.push({
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: attackerId,
                tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE,
                amount: grantedAmount,
                newTotal,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as TokenGrantedEvent);
    }

    events.push(createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        attackerId,
        [{ index: 0, value, face, effectKey, effectParams }],
        timestamp + 2,
    ));
    return events;
}

function requestStrategicDefenseTarget({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey: 'interaction.selectPlayer',
        selectCount: 1,
        selected: [],
        targetPlayerIds: Object.keys(state.players),
        tokenGrantConfig: { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
    };

    return [{
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent];
}

function createCollateralDamageEvent(
    state: CustomActionContext['state'],
    targetId: string,
    sourceAbilityId: string,
    timestamp: number,
): DamageDealtEvent {
    const amount = 2;
    const hp = state.players[targetId]?.resources[RESOURCE_IDS.HP] ?? 0;
    return {
        type: 'DAMAGE_DEALT',
        payload: {
            targetId,
            amount,
            actualDamage: Math.min(amount, hp),
            sourceAbilityId,
            damageScope: 'direct',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent;
}

function resolveCarpetBombingTargetDamage({
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    if (!state.players[targetId]) return [];
    return [createCollateralDamageEvent(state, targetId, sourceAbilityId, timestamp)];
}

function requestCarpetBombingTargets({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const opponentIds = getOpponents(state, attackerId);
    if (opponentIds.length === 0) return [];

    if (opponentIds.length < 2) {
        return opponentIds.map((targetId, index) => (
            createCollateralDamageEvent(state, targetId, sourceAbilityId, timestamp + index)
        ));
    }

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-targets-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey: 'interaction.selectTwoDifferentOpponentsForCollateralDamage',
        selectCount: 2,
        minSelectCount: 2,
        selected: [],
        targetPlayerIds: opponentIds,
        resolveCustomActionId: 'zhanshujia-carpet-bombing-target-damage',
    };

    return [{
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent];
}

function resolveCountermeasuresDefense({
    ctx,
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
    action,
}: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getActiveDice(state).reduce((counts, die) => {
        const face = getPlayerDieFace(state, attackerId, die.value);
        if (face) counts[face] = (counts[face] ?? 0) + 1;
        return counts;
    }, {} as Record<string, number>);

    const sabrePairs = Math.floor((faceCounts[ZHANSHUJIA_DICE_FACE_IDS.SABRE] ?? 0) / 2);
    const bannerCount = faceCounts[ZHANSHUJIA_DICE_FACE_IDS.BANNER] ?? 0;
    const medalCount = faceCounts[ZHANSHUJIA_DICE_FACE_IDS.MEDAL] ?? 0;
    const params = action.params as { sabrePairDamage?: number } | undefined;
    const sabrePairDamage = Math.max(1, Math.trunc(params?.sabrePairDamage ?? 1));
    const events: DiceThroneEvent[] = [];

    if (sabrePairs > 0) {
        const targetId = ctx.defenderId;
        const target = state.players[targetId];
        const amount = sabrePairs * sabrePairDamage;
        events.push({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount,
                actualDamage: Math.min(amount, target?.resources[RESOURCE_IDS.HP] ?? 0),
                sourceAbilityId,
                damageScope: 'direct',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
    }

    if (bannerCount > 0) {
        events.push({
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: attackerId,
                amount: bannerCount,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as PreventDamageEvent);
    }

    if (medalCount > 0) {
        const currentAmount = state.players[attackerId]?.tokens[TOKEN_IDS.TACTICAL_ADVANTAGE] ?? 0;
        const maxStacks = getTokenStackLimit(state, attackerId, TOKEN_IDS.TACTICAL_ADVANTAGE);
        const newTotal = Math.min(currentAmount + medalCount, maxStacks);
        events.push({
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: attackerId,
                tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE,
                amount: Math.max(0, newTotal - currentAmount),
                newTotal,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as TokenGrantedEvent);
    }

    return events;
}

export function registerZhanshujiaCustomActions(): void {
    registerCustomActionHandler('zhanshujia-tactical-advantage-gain-cp', gainCpWithTacticalAdvantage, {
        categories: ['resource', 'passive'],
    });
    registerCustomActionHandler('zhanshujia-tactical-advantage-apply-targeted', applyTargetedWithTacticalAdvantage, {
        categories: ['status', 'passive'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('zhanshujia-tactical-advantage-grant-protect', grantProtectWithTacticalAdvantage, {
        categories: ['token', 'passive'],
    });
    registerCustomActionHandler('zhanshujia-high-ground-cap-up-and-fill', increaseTacticalAdvantageLimitAndFill, {
        categories: ['token', 'resource'],
    });
    registerCustomActionHandler('zhanshujia-war-monger-extra-offensive-roll', triggerWarMongerExtraOffensiveRoll, {
        categories: ['other'],
    });
    registerCustomActionHandler('zhanshujia-war-monger-roll', resolveWarMongerRoll, {
        categories: ['damage', 'token', 'card', 'other'],
    });
    registerCustomActionHandler('zhanshujia-war-monger-2-roll', resolveWarMonger2Roll, {
        categories: ['damage', 'token', 'card', 'other'],
    });
    registerCustomActionHandler('zhanshujia-war-monger-attack-damage', resolveWarMongerAttackDamage, {
        categories: ['damage'],
    });
    registerCustomActionHandler('zhanshujia-war-room-roll', resolveWarRoomRoll, {
        categories: ['dice', 'token', 'card'],
    });
    registerCustomActionHandler('zhanshujia-strategic-defense-select-player', requestStrategicDefenseTarget, {
        categories: ['token', 'card'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('zhanshujia-carpet-bombing-targets', requestCarpetBombingTargets, {
        categories: ['choice', 'damage'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('zhanshujia-carpet-bombing-target-damage', resolveCarpetBombingTargetDamage, {
        categories: ['damage'],
    });
    registerCustomActionHandler('zhanshujia-countermeasures-defense', resolveCountermeasuresDefense, {
        categories: ['damage', 'defense', 'token'],
    });
    registerCustomActionHandler('zhanshujia-bind-if-three-kind', applyBindIfThreeOfAKind, {
        categories: ['status'],
    });
}
