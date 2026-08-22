export type MatchRoomUnloadMatch = {
    matchID: string;
    connections: Map<string, Set<string>>;
    spectatorSockets: Set<string>;
    offlineTimers: Map<string, ReturnType<typeof setTimeout>>;
};

export type MatchRoomUnloadSocket = {
    emit: (event: string, ...args: unknown[]) => void;
    disconnect: (close?: boolean) => void;
};

export type MatchRoomUnloadHooks<TMatch extends MatchRoomUnloadMatch> = {
    getMatch: (matchID: string) => TMatch | undefined;
    markRuntimeUnloaded: (match: TMatch) => void;
    deleteSocketInfo: (socketId: string) => void;
    deleteMatch: (matchID: string) => boolean;
    clearRecoveryState: (matchID: string) => void;
    clearCircuitState: (matchID: string) => void;
    fetchRoomSockets: (matchID: string) => Promise<Iterable<MatchRoomUnloadSocket>>;
    onDisconnectRoomSocketsFailed?: (matchID: string, error: unknown) => void;
};

export type MatchRoomUnloadConfig<TMatch extends MatchRoomUnloadMatch> = {
    hooks: MatchRoomUnloadHooks<TMatch>;
};

export class MatchRoomUnloadCoordinator<TMatch extends MatchRoomUnloadMatch> {
    private readonly hooks: MatchRoomUnloadHooks<TMatch>;

    constructor(config: MatchRoomUnloadConfig<TMatch>) {
        this.hooks = config.hooks;
    }

    unloadMatch(matchID: string, options?: { disconnectSockets?: boolean }): boolean {
        const match = this.hooks.getMatch(matchID);
        if (!match) {
            return false;
        }

        this.hooks.markRuntimeUnloaded(match);
        this.clearOfflineTimers(match);
        this.deleteIndexedSockets(match);
        this.hooks.deleteMatch(matchID);
        this.hooks.clearRecoveryState(matchID);
        this.hooks.clearCircuitState(matchID);

        if (options?.disconnectSockets) {
            void this.disconnectRoomSockets(matchID);
        }

        return true;
    }

    private clearOfflineTimers(match: TMatch): void {
        for (const timer of match.offlineTimers.values()) {
            clearTimeout(timer);
        }
        match.offlineTimers.clear();
    }

    private deleteIndexedSockets(match: TMatch): void {
        for (const sockets of match.connections.values()) {
            for (const socketId of sockets) {
                this.hooks.deleteSocketInfo(socketId);
            }
        }
        for (const socketId of match.spectatorSockets) {
            this.hooks.deleteSocketInfo(socketId);
        }
    }

    private async disconnectRoomSockets(matchID: string): Promise<void> {
        try {
            const sockets = await this.hooks.fetchRoomSockets(matchID);
            for (const socket of sockets) {
                socket.emit('error', matchID, 'match_not_found');
                socket.disconnect(true);
            }
        } catch (error) {
            this.hooks.onDisconnectRoomSocketsFailed?.(matchID, error);
        }
    }
}
