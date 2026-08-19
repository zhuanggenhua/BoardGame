import type { MageWarsArenaObjectState } from './core-types';

export function hasObjectAbilityUseInRound(
    object: MageWarsArenaObjectState,
    abilityId: string,
    roundNumber: number,
): boolean {
    return object.abilityUseRoundNumbers?.[abilityId] === roundNumber;
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
    };
}
