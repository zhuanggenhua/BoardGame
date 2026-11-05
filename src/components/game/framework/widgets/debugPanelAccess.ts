export function shouldShowDebugPanel(args: {
    isDevelopment: boolean;
    isE2EDebug: boolean;
    adminDebugAvailable: boolean;
}): boolean {
    return args.isDevelopment || args.isE2EDebug || args.adminDebugAvailable;
}

export function confirmDestructiveRoomReset(args: {
    isOnline: boolean;
    currentMatchId: string | null;
    currentPlayerID: string | null;
    hasCurrentSeatCredentials: boolean;
    confirm: () => boolean;
}): boolean {
    const willDestroyCurrentRoom = args.isOnline
        && Boolean(args.currentMatchId)
        && Boolean(args.currentPlayerID)
        && args.hasCurrentSeatCredentials;
    return !willDestroyCurrentRoom || args.confirm();
}
