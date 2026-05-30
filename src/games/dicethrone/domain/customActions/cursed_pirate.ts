import type { CpChangedEvent, DamageDealtEvent, DiceThroneEvent, InteractionRequestedEvent, PendingInteraction, StatusAppliedEvent } from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { STATUS_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import { getActiveDice, getMaxDuplicateValueCount, getOpponents, getTokenStackLimit } from '../rules';

function stealOneCp({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const attacker = state.players[attackerId];
    const target = state.players[targetId];
    if (!attacker || !target) return [];

    const targetCp = target.resources[RESOURCE_IDS.CP] ?? 0;
    if (targetCp <= 0) return [];

    const attackerCp = attacker.resources[RESOURCE_IDS.CP] ?? 0;
    const newAttackerCp = Math.min(attackerCp + 1, CP_MAX);
    return [
        {
            type: 'CP_CHANGED',
            payload: {
                playerId: targetId,
                delta: -1,
                newValue: targetCp - 1,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as CpChangedEvent,
        {
            type: 'CP_CHANGED',
            payload: {
                playerId: attackerId,
                delta: newAttackerCp - attackerCp,
                newValue: newAttackerCp,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as CpChangedEvent,
    ];
}

function applyPowderKegIfThreeOfAKind({
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    if (getMaxDuplicateValueCount(getActiveDice(state)) < 3) return [];

    const target = state.players[targetId];
    if (!target) return [];

    const currentStacks = target.statusEffects[STATUS_IDS.POWDER_KEG] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, STATUS_IDS.POWDER_KEG);
    const newTotal = Math.min(currentStacks + 1, maxStacks);
    const stacks = Math.max(0, newTotal - currentStacks);
    if (stacks <= 0) return [];

    return [{
        type: 'STATUS_APPLIED',
        payload: {
            targetId,
            statusId: STATUS_IDS.POWDER_KEG,
            stacks,
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent];
}

function damageByCursedCoins({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    return getOpponents(state, attackerId).flatMap((targetId) => {
        const target = state.players[targetId];
        if (!target) return [];

        const coinStacks = target.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
        if (coinStacks <= 0) return [];

        const hp = target.resources[RESOURCE_IDS.HP] ?? 0;
        return [{
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount: coinStacks,
                actualDamage: Math.min(coinStacks, hp),
                sourceAbilityId,
                damageScope: 'direct',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent];
    });
}

function requestOpponentDiscardOneCard({
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const target = state.players[targetId];
    if (!target || target.hand.length === 0) return [];

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-discard-${targetId}-${timestamp}`,
        playerId: targetId,
        sourceCardId: sourceAbilityId,
        type: 'selectHandCard',
        titleKey: 'interaction.selectHandCardToDiscard',
        selectCount: 1,
        selected: [],
        targetPlayerIds: [targetId],
    };

    return [{
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent];
}

export function registerCursedPirateCustomActions(): void {
    registerCustomActionHandler('cursed-pirate-steal-one-cp', stealOneCp, {
        categories: ['resource'],
    });
    registerCustomActionHandler('cursed-pirate-powder-keg-if-three-kind', applyPowderKegIfThreeOfAKind, {
        categories: ['status'],
    });
    registerCustomActionHandler('cursed-pirate-damage-by-cursed-coins', damageByCursedCoins, {
        categories: ['damage'],
    });
    registerCustomActionHandler('cursed-pirate-request-opponent-discard-one-card', requestOpponentDiscardOneCard, {
        categories: ['card', 'choice'],
        requiresInteraction: true,
    });
}
