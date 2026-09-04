import type {
    BetrayalCore,
    BetrayalDeckKind,
    BetrayalPendingCardResolutionState,
    BetrayalPendingEventRollResolutionState,
    BetrayalRecentRollState,
} from './game';

type PlayerRoster = Pick<BetrayalCore, 'playerIds'>;

type RecentRollDecisionCore = PlayerRoster & Pick<
    BetrayalCore,
    'activePlayerId' | 'currentPlayer' | 'recentRoll'
>;

type RoomExploredCardResolutionEvent = {
    payload: {
        playerId: string;
        deckKind: BetrayalDeckKind | null;
        roomDiscoveryCards?: readonly unknown[];
        buriedRoomDiscoveryCards?: readonly unknown[];
    };
};

export function resolvePendingCardResolutionRequiredPlayerIds(
    resolution: BetrayalPendingCardResolutionState,
): string[] {
    const configuredPlayerIds = resolution.requiredPlayerIds?.filter((playerId) => playerId.length > 0) ?? [];
    return configuredPlayerIds.length > 0 ? configuredPlayerIds : [resolution.playerId];
}

export function resolvePendingCardResolutionAcknowledgedPlayerIds(
    resolution: BetrayalPendingCardResolutionState,
): string[] {
    return Array.from(new Set(
        resolution.acknowledgedPlayerIds?.filter((playerId) => playerId.length > 0) ?? [],
    ));
}

export function isPendingCardResolutionFullyAcknowledged(
    _core: PlayerRoster,
    resolution: BetrayalPendingCardResolutionState,
    acknowledgedPlayerIds = resolvePendingCardResolutionAcknowledgedPlayerIds(resolution),
): boolean {
    const requiredPlayerIds = resolvePendingCardResolutionRequiredPlayerIds(resolution);
    return requiredPlayerIds.every((playerId) => acknowledgedPlayerIds.includes(playerId));
}

export function resolvePendingEventRollResolutionRequiredPlayerIds(
    core: PlayerRoster,
    resolution: BetrayalPendingEventRollResolutionState,
): string[] {
    if (resolution.requiresAcknowledgement === false) {
        return [resolution.playerId];
    }
    const configuredPlayerIds = resolution.requiredPlayerIds?.filter((playerId) => playerId.length > 0) ?? [];
    if (configuredPlayerIds.length > 0) {
        return configuredPlayerIds;
    }
    return core.playerIds.length > 0 ? [...core.playerIds] : [resolution.playerId];
}

export function resolvePendingEventRollResolutionAcknowledgedPlayerIds(
    resolution: BetrayalPendingEventRollResolutionState,
): string[] {
    return Array.from(new Set(
        resolution.acknowledgedPlayerIds?.filter((playerId) => playerId.length > 0) ?? [],
    ));
}

export function isPendingEventRollResolutionFullyAcknowledged(
    core: PlayerRoster,
    resolution: BetrayalPendingEventRollResolutionState,
    acknowledgedPlayerIds = resolvePendingEventRollResolutionAcknowledgedPlayerIds(resolution),
): boolean {
    if (resolution.requiresAcknowledgement === false) {
        return true;
    }
    const requiredPlayerIds = resolvePendingEventRollResolutionRequiredPlayerIds(core, resolution);
    return requiredPlayerIds.every((playerId) => acknowledgedPlayerIds.includes(playerId));
}

export function eventRollResolutionNeedsAcknowledgement(
    resolution: Pick<
        BetrayalPendingEventRollResolutionState,
        | 'requiresAcknowledgement'
        | 'nextPendingEventChoice'
        | 'hauntRevealResolution'
        | 'hauntTraitorResolution'
        | 'dustSetup'
        | 'magicCameraSetup'
        | 'helpingHandsSetup'
        | 'uponReflectionSetup'
    >,
): boolean {
    return resolution.requiresAcknowledgement !== false;
}

export function resolveRecentRollRequiredPlayerIds(
    core: PlayerRoster,
    recentRoll: BetrayalRecentRollState,
): string[] {
    const configuredPlayerIds = recentRoll.requiredPlayerIds?.filter((playerId) => playerId.length > 0) ?? [];
    if (configuredPlayerIds.length > 0) {
        return configuredPlayerIds;
    }
    return core.playerIds.length > 0 ? [...core.playerIds] : [recentRoll.playerId];
}

export function resolveRecentRollAcknowledgedPlayerIds(
    recentRoll: BetrayalRecentRollState,
): string[] {
    return Array.from(new Set(
        recentRoll.acknowledgedPlayerIds?.filter((playerId) => playerId.length > 0) ?? [],
    ));
}

export function isRecentRollFullyAcknowledged(
    core: PlayerRoster,
    recentRoll: BetrayalRecentRollState,
    acknowledgedPlayerIds = resolveRecentRollAcknowledgedPlayerIds(recentRoll),
): boolean {
    const requiredPlayerIds = resolveRecentRollRequiredPlayerIds(core, recentRoll);
    return requiredPlayerIds.every((playerId) => acknowledgedPlayerIds.includes(playerId));
}

export function resolvePendingTurnEndRoll(
    core: Pick<BetrayalCore, 'currentPlayer' | 'recentRoll'>,
): BetrayalRecentRollState | null {
    const recentRoll = core.recentRoll;
    if (
        !recentRoll
        || recentRoll.playerId !== core.currentPlayer
    ) {
        return null;
    }
    if (recentRoll.kind === 'roomEndTurnTraitCheck' && recentRoll.roomEndTurn?.nextPlayerId) {
        return recentRoll;
    }
    if (recentRoll.kind === 'deathPrevention' && recentRoll.deathPrevention?.nextPlayerId) {
        return recentRoll;
    }
    return null;
}

export function resolveAcknowledgeableRecentRoll(
    core: Pick<BetrayalCore, 'activePlayerId' | 'currentPlayer' | 'recentRoll'>,
): BetrayalRecentRollState | null {
    const recentRoll = core.recentRoll;
    const currentDecisionPlayerIds = new Set(
        [core.currentPlayer, core.activePlayerId].filter((playerId): playerId is string => Boolean(playerId)),
    );
    if (!recentRoll || !currentDecisionPlayerIds.has(recentRoll.playerId)) {
        return null;
    }
    if (recentRoll.roomEndTurn?.nextPlayerId || recentRoll.deathPrevention?.nextPlayerId) {
        return null;
    }
    const acknowledgeableKinds: BetrayalRecentRollState['kind'][] = [
        'mysticElevator',
        'attackRoll',
        'hauntActionTraitCheck',
        'monsterMoveRoll',
    ];
    if (!acknowledgeableKinds.includes(recentRoll.kind)) {
        return null;
    }
    return recentRoll;
}

export function canPlayerAcknowledgeRecentRoll(core: RecentRollDecisionCore, playerId: string): boolean {
    const recentRoll = resolveAcknowledgeableRecentRoll(core);
    if (!recentRoll) {
        return false;
    }
    const requiredPlayerIds = resolveRecentRollRequiredPlayerIds(core, recentRoll);
    if (!requiredPlayerIds.includes(playerId)) {
        return false;
    }
    return !resolveRecentRollAcknowledgedPlayerIds(recentRoll).includes(playerId);
}

export function resolveRoomExploredCardResolutionRequiredPlayerIds(
    core: PlayerRoster,
    event: RoomExploredCardResolutionEvent,
): string[] {
    const hasRoomDiscoveryProcessCards = Boolean(
        event.payload.roomDiscoveryCards?.length
        || event.payload.buriedRoomDiscoveryCards?.length,
    );
    if (
        !hasRoomDiscoveryProcessCards
        && (event.payload.deckKind === 'item' || event.payload.deckKind === 'omen')
    ) {
        return [event.payload.playerId];
    }
    return core.playerIds.length > 0 ? [...core.playerIds] : [event.payload.playerId];
}
