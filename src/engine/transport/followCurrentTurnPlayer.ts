type FollowCurrentTurnCore = {
    turnOrder?: Array<string | number>;
    currentPlayerIndex?: number;
    currentPlayer?: string | number;
    currentPlayerId?: string | number;
};

export type SeatControllerLike = {
    type?: string;
};

export type LocalPregameControlContext = {
    state: unknown;
    seatControllers: Record<string, SeatControllerLike>;
    localPlayerId?: string | null;
};

export type LocalPregameControlResolver = (args: LocalPregameControlContext) => string | null;

export function resolveFollowCurrentTurnPlayerId(core: unknown): string | null {
    if (!core || typeof core !== 'object') {
        return null;
    }

    const candidate = core as FollowCurrentTurnCore;
    if (Array.isArray(candidate.turnOrder) && typeof candidate.currentPlayerIndex === 'number') {
        const currentTurnPlayer = candidate.turnOrder[candidate.currentPlayerIndex];
        if (currentTurnPlayer !== undefined && currentTurnPlayer !== null) {
            return String(currentTurnPlayer);
        }
    }

    const directPlayerId = candidate.currentPlayerId ?? candidate.currentPlayer;
    if (directPlayerId === undefined || directPlayerId === null) {
        return null;
    }

    return String(directPlayerId);
}

export function resolveLocalPregameControlledPlayerId(args: {
    state: unknown;
    seatControllers: Record<string, SeatControllerLike>;
    localPlayerId?: string | null;
    resolver?: LocalPregameControlResolver;
}): string | null {
    return args.resolver?.({
        state: args.state,
        seatControllers: args.seatControllers,
        localPlayerId: args.localPlayerId,
    }) ?? null;
}
