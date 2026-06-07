import type { TitanState } from '../domain/types';

function isSetAsideTitanControlledBy(titan: TitanState, playerId: string | undefined): boolean {
    return titan.location.zone === 'setaside' && titan.controllerId === playerId;
}

export function getSetAsideTitansForDeckDisplay(
    titans: readonly TitanState[] | undefined,
    displayedDeckPlayerId: string | undefined,
): TitanState[] {
    if (!displayedDeckPlayerId) return [];
    return (titans ?? []).filter((titan) => isSetAsideTitanControlledBy(titan, displayedDeckPlayerId));
}

export function getSetAsideTitansForActivation(
    titans: readonly TitanState[] | undefined,
    playerId: string | undefined,
): TitanState[] {
    if (!playerId) return [];
    return (titans ?? []).filter((titan) => isSetAsideTitanControlledBy(titan, playerId));
}
