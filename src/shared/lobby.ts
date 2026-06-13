export const LOBBY_EVENTS = {
    SUBSCRIBE_LOBBY: 'lobby:subscribe',
    UNSUBSCRIBE_LOBBY: 'lobby:unsubscribe',
    LOBBY_UPDATE: 'lobby:update',
    MATCH_CREATED: 'lobby:matchCreated',
    MATCH_UPDATED: 'lobby:matchUpdated',
    MATCH_ENDED: 'lobby:matchEnded',
    HEARTBEAT: 'lobby:heartbeat',
} as const;

export const LOBBY_ALL = 'all' as const;

export type PublicSetupSummary = {
    enabledExpansions?: string[];
    scenarioId?: string;
} | undefined;

export interface LobbyMatch {
    matchID: string;
    gameName: string;
    players: Array<{
        id: number;
        name?: string;
        isConnected?: boolean;
    }>;
    totalSeats?: number;
    createdAt?: number;
    updatedAt?: number;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
    isLocked?: boolean;
    publicSetupSummary?: PublicSetupSummary;
    gameover?: boolean;
    status?: string;
}

export type LobbyGameId = string;

export interface LobbySnapshotPayload {
    gameId: LobbyGameId;
    version: number;
    matches: LobbyMatch[];
}

export interface LobbyMatchPayload {
    gameId: LobbyGameId;
    version: number;
    match: LobbyMatch;
}

export interface LobbyMatchEndedPayload {
    gameId: LobbyGameId;
    version: number;
    matchID: string;
}

export interface LobbyHeartbeatPayload {
    gameId: LobbyGameId;
    version: number;
    timestamp: number;
}
