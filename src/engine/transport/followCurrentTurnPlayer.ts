type FollowCurrentTurnCore = {
    turnOrder?: Array<string | number>;
    currentPlayerIndex?: number;
    currentPlayer?: string | number;
    currentPlayerId?: string | number;
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
