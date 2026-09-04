import type { BetrayalCore, BetrayalRoomNode } from './game';

export type BetrayalRoomEndTurnEffect = NonNullable<BetrayalRoomNode['endTurnEffect']>;

export function isBetrayalDamagingRoomEndTurnEffect(effect: BetrayalRoomEndTurnEffect | undefined): boolean {
    return effect === 'physicalDamage1' || effect === 'speedCheckFallToBasement';
}

export function isBetrayalMandatoryRoomEffect(room: BetrayalRoomNode | undefined): boolean {
    return room?.endTurnEffect === 'moveToBasementLanding' || room?.enterEffect === 'mysticElevator';
}

export function canUseBetrayalTraitorPowers(core: BetrayalCore, playerId: string): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntTriggered
        && core.scenarioRuntime.traitorPlayerId === playerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId);
}
