export function isAiSeatControllerLike(controller: unknown): boolean {
    if (!controller || typeof controller !== 'object' || Array.isArray(controller)) {
        return false;
    }

    const type = (controller as { type?: unknown }).type;
    return type === 'local-ai' || type === 'remote-ai';
}

export function resolveAiSeatDisplayName(playerId: string | number): string {
    const numericPlayerId = Number(playerId);
    if (Number.isInteger(numericPlayerId) && numericPlayerId >= 0) {
        return `AI ${numericPlayerId + 1} 号位`;
    }
    return `AI ${String(playerId)}`;
}

export function resolveSeatPlayerDisplayName(args: {
    playerId: string | number;
    name?: string | null;
    seatControllers?: Record<string, unknown> | null;
}): string | undefined {
    const trimmedName = args.name?.trim();
    if (trimmedName) {
        return trimmedName;
    }

    const controller = args.seatControllers?.[String(args.playerId)];
    return isAiSeatControllerLike(controller)
        ? resolveAiSeatDisplayName(args.playerId)
        : undefined;
}
