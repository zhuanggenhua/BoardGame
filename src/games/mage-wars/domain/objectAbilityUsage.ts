import type { MageWarsArenaObjectState } from './core-types';

export function hasObjectAbilityUseInRound(
    object: MageWarsArenaObjectState,
    abilityId: string,
    roundNumber: number,
): boolean {
    return object.abilityUseRoundNumbers?.[abilityId] === roundNumber;
}

export function getObjectAbilityUseCountInRound(
    object: MageWarsArenaObjectState,
    abilityId: string,
    roundNumber: number,
): number {
    if (!hasObjectAbilityUseInRound(object, abilityId, roundNumber)) return 0;
    return object.abilityUseCountsThisRound?.[abilityId] ?? 1;
}

export function recordObjectAbilityUseInRound(
    object: MageWarsArenaObjectState,
    abilityId: string,
    roundNumber: number | undefined,
): MageWarsArenaObjectState {
    if (roundNumber === undefined) return object;
    return {
        ...object,
        abilityUseRoundNumbers: {
            ...object.abilityUseRoundNumbers,
            [abilityId]: roundNumber,
        },
        abilityUseCountsThisRound: {
            ...object.abilityUseCountsThisRound,
            [abilityId]: getObjectAbilityUseCountInRound(object, abilityId, roundNumber) + 1,
        },
    };
}
