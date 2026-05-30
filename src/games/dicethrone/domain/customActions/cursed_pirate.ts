import type { ChoiceRequestedEvent, CpChangedEvent, DamageDealtEvent, DiceThroneEvent, InteractionRequestedEvent, PendingInteraction, PreventDamageEvent } from '../types';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { CURSED_PIRATE_DICE_FACE_IDS, STATUS_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import { getActiveDice, getMaxDuplicateValueCount, getOpponents, getPlayerDieFace, getTokenStackLimit } from '../rules';
import {
    POWDER_KEG_TRANSFER_CHOICE_ID,
    POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID,
    buildStatusAppliedOrChoiceEvents,
    getPowderKegTransferTargetIds,
} from '../statusEvents';

const MERCILESS_CURSE_POWDER_KEG_CHOICE_ID = 'cursed-pirate-merciless-curse-powder-keg';

const countBits = (value: number): number => {
    let count = 0;
    let mask = Math.max(0, Math.trunc(value));
    while (mask > 0) {
        count += mask & 1;
        mask >>= 1;
    }
    return count;
};

const formatPlayerList = (playerIds: string[]): string =>
    playerIds.map((playerId) => {
        const seatNumber = Number.parseInt(playerId, 10) + 1;
        return Number.isFinite(seatNumber) ? `P${seatNumber}` : playerId;
    }).join(', ');

const getMercilessCursePowderKegTargetIds = (state: CustomActionContext['state'], attackerId: string): string[] =>
    getOpponents(state, attackerId).filter(playerId => !!state.players[playerId]);

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

    return buildStatusAppliedOrChoiceEvents({
        state,
        targetId,
        statusId: STATUS_IDS.POWDER_KEG,
        stacks,
        sourceAbilityId,
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    });
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

function cursedUpkeepSelfDamage({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[attackerId];
    if (!player) return [];

    const amount = 4;
    const hp = player.resources[RESOURCE_IDS.HP] ?? 0;
    return [{
        type: 'DAMAGE_DEALT',
        payload: {
            targetId: attackerId,
            amount,
            actualDamage: Math.min(amount, hp),
            sourceAbilityId,
            damageScope: 'direct',
            unblockable: true,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent];
}

function resolveStillWetBehindEarsDefense({
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

    const cutlassCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.CUTLASS] ?? 0;
    const lootCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.LOOT] ?? 0;
    const skullCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.SKULL] ?? 0;
    const events: DiceThroneEvent[] = [];

    if (cutlassCount > 0) {
        const targetId = ctx.defenderId;
        const target = state.players[targetId];
        events.push({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount: cutlassCount,
                actualDamage: Math.min(cutlassCount, target?.resources[RESOURCE_IDS.HP] ?? 0),
                sourceAbilityId,
                damageScope: 'direct',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
    }

    if (lootCount > 0) {
        const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newValue = Math.min(CP_MAX, currentCp + lootCount);
        events.push({
            type: 'CP_CHANGED',
            payload: {
                playerId: attackerId,
                delta: newValue - currentCp,
                newValue,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as CpChangedEvent);
    }

    if (skullCount > 0) {
        events.push({
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: attackerId,
                amount: skullCount * 2,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as PreventDamageEvent);
    }

    if (cutlassCount > 0 && skullCount > 0) {
        const targetId = ctx.defenderId;
        const currentStacks = state.players[targetId]?.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
        const maxStacks = getTokenStackLimit(state, targetId, STATUS_IDS.CURSED_COIN);
        const newTotal = Math.min(currentStacks + 1, maxStacks);
        events.push(...buildStatusAppliedOrChoiceEvents({
            state,
            targetId,
            statusId: STATUS_IDS.CURSED_COIN,
            stacks: Math.max(0, newTotal - currentStacks),
            sourceAbilityId,
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 3,
        }));
    }

    return events;
}

function requestMercilessCursePowderKegTargets({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const targetIds = getMercilessCursePowderKegTargetIds(state, attackerId);
    if (targetIds.length === 0) return [];

    const optionMasks: number[] = [];
    const maskLimit = 1 << targetIds.length;
    for (let mask = 0; mask < maskLimit; mask++) {
        if (countBits(mask) <= 2) {
            optionMasks.push(mask);
        }
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.mercilessCursePowderKeg.title',
            options: optionMasks.map((mask) => {
                const selectedTargetIds = targetIds.filter((_, index) => (mask & (1 << index)) !== 0);
                return selectedTargetIds.length === 0
                    ? {
                        value: 0,
                        customId: MERCILESS_CURSE_POWDER_KEG_CHOICE_ID,
                        labelKey: 'choices.mercilessCursePowderKeg.skip',
                    }
                    : {
                        value: mask,
                        customId: MERCILESS_CURSE_POWDER_KEG_CHOICE_ID,
                        labelKey: 'choices.mercilessCursePowderKeg.apply',
                        labelParams: { targets: formatPlayerList(selectedTargetIds) },
                    };
            }),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
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
    registerCustomActionHandler('cursed-pirate-cursed-upkeep-self-damage', cursedUpkeepSelfDamage, {
        categories: ['damage', 'passive'],
    });
    registerCustomActionHandler('cursed-pirate-still-wet-behind-ears-defense', resolveStillWetBehindEarsDefense, {
        categories: ['damage', 'defense', 'resource', 'status'],
    });
    registerCustomActionHandler('cursed-pirate-merciless-curse-powder-keg-targets', requestMercilessCursePowderKegTargets, {
        categories: ['choice', 'status'],
        requiresInteraction: true,
    });
    registerChoiceResolvedEventHandler(MERCILESS_CURSE_POWDER_KEG_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        const mask = Math.max(0, Math.trunc(value ?? 0));
        const targetIds = getMercilessCursePowderKegTargetIds(state, playerId)
            .filter((_, index) => (mask & (1 << index)) !== 0)
            .slice(0, 2);

        return targetIds.flatMap((targetId, index) => buildStatusAppliedOrChoiceEvents({
            state,
            targetId,
            statusId: STATUS_IDS.POWDER_KEG,
            stacks: 1,
            sourceAbilityId,
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp: timestamp + index,
        }));
    });
    registerChoiceResolvedEventHandler(POWDER_KEG_TRANSFER_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        if (sourceAbilityId !== POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID) return [];
        if ((state.players[playerId]?.statusEffects[STATUS_IDS.POWDER_KEG] ?? 0) <= 0) return [];

        const targetIds = getPowderKegTransferTargetIds(state, playerId);
        const targetId = targetIds[Math.max(0, Math.trunc(value ?? -1))];
        if (!targetId) return [];
        if (targetId === playerId) return [];

        return [
            {
                type: 'STATUS_REMOVED',
                payload: {
                    targetId: playerId,
                    statusId: STATUS_IDS.POWDER_KEG,
                    stacks: 1,
                },
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp,
            } as DiceThroneEvent,
            ...buildStatusAppliedOrChoiceEvents({
                state,
                targetId,
                statusId: STATUS_IDS.POWDER_KEG,
                stacks: 1,
                sourceAbilityId,
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp: timestamp + 1,
            }),
        ];
    });
}
