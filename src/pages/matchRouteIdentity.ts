const TRANSPORT_SEAT_VALIDATION_GRACE_MS = 10_000;

export function buildStoredSeatValidationClearKey(args: {
    matchId?: string | null;
    statusPlayerID?: string | null;
    validation: { shouldClear: boolean; reason?: string };
}): string | null {
    if (!args.validation.shouldClear) {
        return null;
    }
    return `${args.matchId ?? ''}:${args.statusPlayerID ?? ''}:${args.validation.reason ?? 'unknown'}`;
}

export function resolveStoredSeatValidationClearDecision(args: {
    pendingKey: string | null;
    pendingObservationKey?: string | null;
    nextKey: string | null;
    nextObservationKey?: string | null;
}): {
    nextPendingKey: string | null;
    nextPendingObservationKey: string | null;
    shouldClear: boolean;
} {
    if (!args.nextKey) {
        return {
            nextPendingKey: null,
            nextPendingObservationKey: null,
            shouldClear: false,
        };
    }
    const hasObservationKeys = Boolean(args.pendingObservationKey && args.nextObservationKey);
    const isSameObservation = hasObservationKeys && args.pendingObservationKey === args.nextObservationKey;
    if (args.pendingKey === args.nextKey && !isSameObservation) {
        return {
            nextPendingKey: null,
            nextPendingObservationKey: null,
            shouldClear: true,
        };
    }
    return {
        nextPendingKey: args.nextKey,
        nextPendingObservationKey: args.nextObservationKey ?? null,
        shouldClear: false,
    };
}

export function resolveSeatValidationPlayers(args: {
    fallbackPlayers: Array<{ id: number; name?: string | null; isConnected?: boolean }>;
    transportPlayers: Array<{ id: number; name?: string | null; isConnected?: boolean }>;
    transportReady: boolean;
}): Array<{ id: number; name?: string | null; isConnected?: boolean }> {
    if (!args.transportReady) {
        return args.fallbackPlayers;
    }

    const fallbackById = new Map(
        args.fallbackPlayers.map((player) => [String(player.id), player] as const),
    );
    const playerIds = [...new Set(
        args.transportPlayers.map((player) => String(player.id)),
    )].sort((left, right) => Number(left) - Number(right));

    return playerIds.map((playerId) => {
        const fallback = fallbackById.get(playerId);
        const transport = args.transportPlayers.find((player) => String(player.id) === playerId);
        return {
            id: Number(playerId),
            name: transport?.name ?? fallback?.name,
            isConnected: transport?.isConnected ?? fallback?.isConnected,
        };
    });
}

export function shouldUseTransportSeatValidationSnapshot(args: {
    transportPlayers: Array<{ id: number; name?: string | null; isConnected?: boolean }>;
    transportReady: boolean;
    lastConfirmedAt: number | null;
    now?: number;
}): boolean {
    if (args.transportPlayers.length === 0) {
        return false;
    }
    if (args.transportReady) {
        return true;
    }
    if (typeof args.lastConfirmedAt !== 'number' || !Number.isFinite(args.lastConfirmedAt)) {
        return false;
    }
    return (args.now ?? Date.now()) - args.lastConfirmedAt < TRANSPORT_SEAT_VALIDATION_GRACE_MS;
}

export function resolveMatchRoomRouteIdentity(args: {
    isTutorialRoute: boolean;
    debugPlayerID?: string | null;
    urlPlayerID: string | null;
    storedPlayerID?: string | null;
    shouldAutoJoin: boolean;
    spectateParam: string | null;
}): {
    hasStoredSeat: boolean;
    isSpectatorRoute: boolean;
    effectivePlayerID: string | undefined;
    statusPlayerID: string | null;
    transportPlayerID: string | null;
} {
    const hasStoredSeat = Boolean(args.storedPlayerID);
    const isSpectatorRoute = !args.isTutorialRoute
        && !args.shouldAutoJoin
        && !args.urlPlayerID
        && !hasStoredSeat
        && (args.spectateParam === null || args.spectateParam === '1' || args.spectateParam === 'true');
    const tutorialPlayerID = args.debugPlayerID ?? args.urlPlayerID ?? '0';
    const effectivePlayerID = args.isTutorialRoute
        ? tutorialPlayerID
        : (args.storedPlayerID ?? args.urlPlayerID ?? undefined);
    const statusPlayerID = args.isTutorialRoute
        ? (args.urlPlayerID ?? args.debugPlayerID ?? null)
        : (args.storedPlayerID ?? args.urlPlayerID ?? null);
    const transportPlayerID = isSpectatorRoute ? null : (effectivePlayerID ?? null);

    return {
        hasStoredSeat,
        isSpectatorRoute,
        effectivePlayerID,
        statusPlayerID,
        transportPlayerID,
    };
}
