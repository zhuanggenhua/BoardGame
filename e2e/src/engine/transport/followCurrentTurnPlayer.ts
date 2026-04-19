type FollowCurrentTurnCore = {
    turnOrder?: Array<string | number>;
    currentPlayerIndex?: number;
    currentPlayer?: string | number;
    currentPlayerId?: string | number;
};

type DiceThroneSetupLikeState = {
    core?: {
        hostPlayerId?: string | number;
        hostStarted?: boolean;
        selectedCharacters?: Record<string, string | undefined>;
        readyPlayers?: Record<string, boolean | undefined>;
    };
    sys?: {
        phase?: string;
        flow?: {
            phase?: string;
        };
    };
};

type SeatControllerLike = {
    type?: string;
};

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
    gameId: string;
    state: unknown;
    seatControllers: Record<string, SeatControllerLike>;
    localPlayerId?: string | null;
}): string | null {
    const aiSeatIds = Object.entries(args.seatControllers)
        .filter(([, controller]) => controller?.type && controller.type !== 'human')
        .map(([playerId]) => playerId)
        .sort((left, right) => Number(left) - Number(right));

    if (aiSeatIds.length === 0) {
        return null;
    }

    if (args.gameId !== 'dicethrone') {
        return null;
    }

    const state = args.state as DiceThroneSetupLikeState | null | undefined;
    const phase = state?.sys?.phase ?? state?.sys?.flow?.phase;
    if (phase !== 'setup') {
        return null;
    }

    const core = state?.core;
    if (!core || core.hostStarted) {
        return null;
    }

    const hostPlayerId = core.hostPlayerId !== undefined && core.hostPlayerId !== null
        ? String(core.hostPlayerId)
        : (args.localPlayerId ?? '0');

    const hasSelectedCharacter = (playerId: string) => {
        const characterId = core.selectedCharacters?.[playerId];
        return typeof characterId === 'string' && characterId !== 'unselected';
    };

    if (!hasSelectedCharacter(hostPlayerId)) {
        return hostPlayerId;
    }

    for (const playerId of aiSeatIds) {
        if (!hasSelectedCharacter(playerId)) {
            return playerId;
        }

        if (playerId !== hostPlayerId && core.readyPlayers?.[playerId] !== true) {
            return playerId;
        }
    }

    return hostPlayerId;
}
