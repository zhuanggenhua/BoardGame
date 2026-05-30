import type {
    CpChangedEvent,
    DiceThroneEvent,
    ExtraAttackTriggeredEvent,
    StatusAppliedEvent,
    TokenLimitChangedEvent,
    TokenGrantedEvent,
} from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { STATUS_IDS, TOKEN_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import { getTokenStackLimit } from '../rules';

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
}
