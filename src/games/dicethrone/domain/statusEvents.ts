import type { PlayerId } from '../../../engine/types';
import { STATUS_IDS } from './ids';
import { getTokenStackLimit } from './rules';
import { RESOURCE_IDS } from './resources';
import type { ChoiceRequestedEvent, DamageDealtEvent, DiceThroneCore, DiceThroneEvent, StatusAppliedEvent, StatusRemovedEvent } from './types';

export const POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID = 'upkeep-powder-keg';
export const POWDER_KEG_TRANSFER_CHOICE_ID = 'cursed-pirate-powder-keg-transfer';

interface StatusEventInput {
    state: DiceThroneCore;
    targetId: PlayerId;
    statusId: string;
    stacks: number;
    sourceAbilityId?: string;
    sourceCommandType: string;
    timestamp: number;
    sfxKey?: string;
    triggerExplosionOnExisting?: boolean;
}

export function getPowderKegTransferTargetIds(state: DiceThroneCore, _ownerId: PlayerId): PlayerId[] {
    return Object.keys(state.players)
        .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)) as PlayerId[];
}

export function buildPowderKegExplosionEvents({
    state,
    targetId,
    sourceAbilityId = POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID,
    sourceCommandType,
    timestamp,
}: Omit<StatusEventInput, 'statusId' | 'stacks' | 'sfxKey'>): DiceThroneEvent[] {
    const target = state.players[targetId];
    if (!target) return [];

    const amount = 3;
    const hp = target.resources[RESOURCE_IDS.HP] ?? 0;
    return [
        {
            type: 'STATUS_REMOVED',
            payload: {
                targetId,
                statusId: STATUS_IDS.POWDER_KEG,
                stacks: 1,
            },
            sourceCommandType,
            timestamp,
        } as StatusRemovedEvent,
        {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount,
                actualDamage: Math.min(amount, hp),
                sourceAbilityId,
                damageScope: 'direct',
                unblockable: true,
            },
            sourceCommandType,
            timestamp: timestamp + 0.01,
        } as DamageDealtEvent,
    ];
}

export function buildStatusAppliedOrChoiceEvents({
    state,
    targetId,
    statusId,
    stacks,
    sourceAbilityId,
    sourceCommandType,
    timestamp,
    sfxKey,
    triggerExplosionOnExisting = true,
}: StatusEventInput): DiceThroneEvent[] {
    const target = state.players[targetId];
    if (!target || stacks <= 0) return [];

    const currentStacks = target.statusEffects[statusId] ?? 0;
    if (statusId === STATUS_IDS.POWDER_KEG && currentStacks > 0 && triggerExplosionOnExisting) {
        return [
            ...buildPowderKegExplosionEvents({
                state,
                targetId,
                sourceAbilityId,
                sourceCommandType,
                timestamp,
            }),
            {
                type: 'STATUS_APPLIED',
                payload: {
                    targetId,
                    statusId,
                    stacks: 1,
                    newTotal: 1,
                    sourceAbilityId,
                },
                sourceCommandType,
                timestamp: timestamp + 0.02,
                sfxKey,
            } as StatusAppliedEvent,
        ];
    }

    const maxStacks = getTokenStackLimit(state, targetId, statusId);
    const newTotal = Math.min(currentStacks + stacks, maxStacks);
    const actualStacks = Math.max(0, newTotal - currentStacks);
    if (actualStacks <= 0) return [];

    if (statusId === STATUS_IDS.CURSED_COIN && target.characterId === 'cursed_pirate') {
        return [{
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: targetId,
                sourceAbilityId: sourceAbilityId ?? statusId,
                titleKey: 'choices.cursedCoinGain.title',
                options: [
                    {
                        statusId,
                        value: actualStacks,
                        labelKey: 'choices.cursedCoinGain.accept',
                    },
                    {
                        value: 0,
                        customId: 'decline-cursed-coin',
                        labelKey: 'choices.cursedCoinGain.decline',
                    },
                ],
            },
            sourceCommandType,
            timestamp,
            sfxKey,
        } as ChoiceRequestedEvent];
    }

    return [{
        type: 'STATUS_APPLIED',
        payload: {
            targetId,
            statusId,
            stacks: actualStacks,
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType,
        timestamp,
        sfxKey,
    } as StatusAppliedEvent];
}
