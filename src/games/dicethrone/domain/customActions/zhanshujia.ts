import type {
    CpChangedEvent,
    DamageDealtEvent,
    DiceThroneEvent,
    ExtraAttackTriggeredEvent,
    PreventDamageEvent,
    StatusAppliedEvent,
    TokenLimitChangedEvent,
    TokenGrantedEvent,
} from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { STATUS_IDS, TOKEN_IDS, ZHANSHUJIA_DICE_FACE_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import { getActiveDice, getPlayerDieFace, getTokenStackLimit } from '../rules';

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
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const currentStacks = state.players[targetId]?.statusEffects[STATUS_IDS.TARGETED] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, STATUS_IDS.TARGETED);
    const newTotal = Math.min(currentStacks + 1, maxStacks);
    return [{
        type: 'STATUS_APPLIED',
        payload: {
            targetId,
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
    const currentAmount = state.players[attackerId]?.tokens[TOKEN_IDS.PROTECT] ?? 0;
    const maxStacks = getTokenStackLimit(state, attackerId, TOKEN_IDS.PROTECT);
    const newTotal = Math.min(currentAmount + 1, maxStacks);
    return [{
        type: 'TOKEN_GRANTED',
        payload: {
            targetId: attackerId,
            tokenId: TOKEN_IDS.PROTECT,
            amount: Math.max(0, newTotal - currentAmount),
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent];
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

function resolveCountermeasuresDefense({
    ctx,
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getActiveDice(state).reduce((counts, die) => {
        const face = getPlayerDieFace(state, attackerId, die.value);
        if (face) counts[face] = (counts[face] ?? 0) + 1;
        return counts;
    }, {} as Record<string, number>);

    const sabrePairs = Math.floor((faceCounts[ZHANSHUJIA_DICE_FACE_IDS.SABRE] ?? 0) / 2);
    const bannerCount = faceCounts[ZHANSHUJIA_DICE_FACE_IDS.BANNER] ?? 0;
    const medalCount = faceCounts[ZHANSHUJIA_DICE_FACE_IDS.MEDAL] ?? 0;
    const events: DiceThroneEvent[] = [];

    if (sabrePairs > 0) {
        const targetId = ctx.defenderId;
        const target = state.players[targetId];
        const amount = sabrePairs;
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
    registerCustomActionHandler('zhanshujia-countermeasures-defense', resolveCountermeasuresDefense, {
        categories: ['damage', 'defense', 'token'],
    });
}
