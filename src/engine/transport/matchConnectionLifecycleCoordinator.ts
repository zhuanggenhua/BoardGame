import type { Socket as IOSocket } from 'socket.io';
import type { MatchState } from '../types';
import { INTERACTION_COMMANDS } from '../systems/InteractionSystem';
import type { GameEngineConfig, OfflineAdjudicationInteraction } from './engineConfig';
import type { MatchMetadata } from './storage';
import type { StateSyncSocket } from './transportStateSynchronizer';

export type MatchConnectionSocketInfo = {
    matchID: string;
    playerID: string | null;
    credentials?: string;
};

export type MatchConnectionLifecycleMatch = {
    matchID: string;
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    metadata: MatchMetadata;
    connections: Map<string, Set<string>>;
    spectatorSockets: Set<string>;
    offlineTimers: Map<string, ReturnType<typeof setTimeout>>;
};

export type MatchConnectionLifecycleHooks<TMatch extends MatchConnectionLifecycleMatch> = {
    getActiveMatch: (matchID: string) => TMatch | undefined;
    loadMatch: (matchID: string) => Promise<TMatch | undefined>;
    getSocketInfo: (socketId: string) => MatchConnectionSocketInfo | undefined;
    setSocketInfo: (socketId: string, info: MatchConnectionSocketInfo) => void;
    deleteSocketInfo: (socketId: string) => void;
    removeSocketFromPreviousMatch: (socketId: string, info: MatchConnectionSocketInfo) => void;
    readFreshAuthMetadata: (
        matchID: string,
        fallback: MatchMetadata,
    ) => Promise<MatchMetadata | undefined>;
    validateCommandAuth: (
        matchID: string,
        playerID: string,
        credentials: string | undefined,
        metadata: MatchMetadata,
    ) => Promise<boolean>;
    persistMetadata: (matchID: string, metadata: MatchMetadata) => Promise<void>;
    clearSyncBaseline: (match: TMatch, playerID: string | null) => void;
    emitPlayerDisconnected: (matchID: string, playerID: string) => void;
    logSocketDisconnected: (socketId: string, matchID: string, reason: 'client_disconnect') => void;
    executeOfflineAdjudicationCommand: (
        match: TMatch,
        playerID: string,
        commandType: string,
    ) => Promise<void>;
    syncSocket: (args: {
        socket: StateSyncSocket;
        match: TMatch;
        playerID: string | null;
    }) => void;
    resolveOnlineAiSeatControllerType: (match: TMatch, playerID: string) => 'human' | string;
    runOnlineAiImmediateExecution: (match: TMatch, reason: 'sync') => Promise<void>;
    onPersistConnectedMetadataFailed?: (args: {
        matchID: string;
        playerID: string;
        error: unknown;
    }) => void;
    onPersistDisconnectedMetadataFailed?: (args: {
        matchID: string;
        playerID: string;
        error: unknown;
    }) => void;
};

export type MatchConnectionLifecycleConfig<TMatch extends MatchConnectionLifecycleMatch> = {
    offlineGraceMs: number;
    hooks: MatchConnectionLifecycleHooks<TMatch>;
};

const OFFLINE_ADJUDICATION_COMMAND_BY_KIND: Record<string, string | null> = {
    'simple-choice': INTERACTION_COMMANDS.CANCEL,
};

export const resolveOfflineAdjudicationCommandType = (
    kind: unknown,
    engineConfig?: GameEngineConfig | null,
): string | null => {
    if (typeof kind !== 'string') {
        return INTERACTION_COMMANDS.CANCEL;
    }
    const configured = engineConfig?.onlineAiRecovery?.offlineAdjudicationCommandByInteractionKind;
    if (configured && Object.prototype.hasOwnProperty.call(configured, kind)) {
        return configured[kind] ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(OFFLINE_ADJUDICATION_COMMAND_BY_KIND, kind)) {
        return OFFLINE_ADJUDICATION_COMMAND_BY_KIND[kind] ?? null;
    }
    return INTERACTION_COMMANDS.CANCEL;
};

export const resolveOfflineAdjudicationCommand = (args: {
    state: MatchState<unknown>;
    playerID: string;
    interaction: OfflineAdjudicationInteraction;
    engineConfig?: GameEngineConfig | null;
}): string | null => {
    const fallbackCommandType = resolveOfflineAdjudicationCommandType(
        args.interaction.kind,
        args.engineConfig,
    );
    const resolver = args.engineConfig?.onlineAiRecovery?.resolveOfflineAdjudicationCommand;
    if (!resolver) {
        return fallbackCommandType;
    }

    const resolved = resolver({
        state: args.state,
        playerId: args.playerID,
        interaction: args.interaction,
        fallbackCommandType,
    });
    if (resolved === undefined) {
        return fallbackCommandType;
    }
    return typeof resolved === 'string' && resolved.length > 0 ? resolved : null;
};

export class MatchConnectionLifecycleCoordinator<TMatch extends MatchConnectionLifecycleMatch> {
    private readonly offlineGraceMs: number;
    private readonly hooks: MatchConnectionLifecycleHooks<TMatch>;

    constructor(config: MatchConnectionLifecycleConfig<TMatch>) {
        this.offlineGraceMs = config.offlineGraceMs;
        this.hooks = config.hooks;
    }

    async handleSync(args: {
        socket: IOSocket;
        matchID: string;
        playerID: string | null;
        credentials?: string;
    }): Promise<void> {
        const { socket, matchID, playerID, credentials } = args;
        let match = this.hooks.getActiveMatch(matchID);
        const reusedActiveMatch = Boolean(match);
        if (!match) {
            match = await this.hooks.loadMatch(matchID);
            if (!match) {
                socket.emit('error', matchID, 'match_not_found');
                return;
            }
        }

        if (playerID !== null) {
            const authMetadata = reusedActiveMatch
                ? await this.hooks.readFreshAuthMetadata(matchID, match.metadata) ?? match.metadata
                : match.metadata;
            const authorized = await this.hooks.validateCommandAuth(
                matchID,
                playerID,
                credentials,
                authMetadata,
            );
            if (!authorized) {
                socket.emit('error', matchID, 'unauthorized');
                return;
            }
        }

        this.registerSocket({ socket, match, matchID, playerID, credentials });
        this.hooks.syncSocket({ socket, match, playerID });

        if (playerID !== null) {
            socket.to(`game:${matchID}`).emit('player:connected', matchID, playerID);
            if (this.hooks.resolveOnlineAiSeatControllerType(match, playerID) === 'human') {
                await this.hooks.runOnlineAiImmediateExecution(match, 'sync');
            }
        }
    }

    handleDisconnect(socket: IOSocket): void {
        const info = this.hooks.getSocketInfo(socket.id);
        if (!info) {
            return;
        }

        this.hooks.logSocketDisconnected(socket.id, info.matchID, 'client_disconnect');
        this.hooks.deleteSocketInfo(socket.id);
        this.removeSocketFromMatch(socket.id, info);
    }

    removeSocketFromMatch(socketId: string, info: MatchConnectionSocketInfo): void {
        const match = this.hooks.getActiveMatch(info.matchID);
        if (!match) {
            return;
        }

        if (info.playerID === null) {
            match.spectatorSockets.delete(socketId);
            if (match.spectatorSockets.size === 0) {
                this.hooks.clearSyncBaseline(match, null);
            }
            return;
        }

        const connections = match.connections.get(info.playerID);
        if (!connections) {
            return;
        }
        connections.delete(socketId);
        if (connections.size === 0) {
            match.connections.delete(info.playerID);
            this.onPlayerFullyDisconnected(match, info.playerID);
        }
    }

    onPlayerFullyDisconnected(match: TMatch, playerID: string): void {
        this.hooks.clearSyncBaseline(match, playerID);

        const playerMetadata = match.metadata.players[playerID];
        if (playerMetadata) {
            playerMetadata.isConnected = false;
            this.persistDisconnectedMetadata(match, playerID);
        }

        this.hooks.emitPlayerDisconnected(match.matchID, playerID);
        this.scheduleOfflineAdjudication(match, playerID);
    }

    scheduleOfflineAdjudication(match: TMatch, playerID: string): void {
        const existing = match.offlineTimers.get(playerID);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            match.offlineTimers.delete(playerID);
            void this.runOfflineAdjudication(match, playerID);
        }, this.offlineGraceMs);

        match.offlineTimers.set(playerID, timer);
    }

    async runOfflineAdjudication(match: TMatch, playerID: string): Promise<void> {
        if (match.connections.has(playerID)) {
            return;
        }

        const interaction = (match.state.sys as {
            interaction?: {
                current?: OfflineAdjudicationInteraction;
            };
        }).interaction?.current;
        if (!interaction || interaction.playerId !== playerID) {
            return;
        }

        const commandType = resolveOfflineAdjudicationCommand({
            state: match.state,
            playerID,
            interaction,
            engineConfig: match.engineConfig,
        });
        if (!commandType) {
            return;
        }

        await this.hooks.executeOfflineAdjudicationCommand(match, playerID, commandType);
    }

    private registerSocket(args: {
        socket: IOSocket;
        match: TMatch;
        matchID: string;
        playerID: string | null;
        credentials?: string;
    }): void {
        const { socket, match, matchID, playerID, credentials } = args;
        const previousInfo = this.hooks.getSocketInfo(socket.id);
        if (previousInfo && (previousInfo.matchID !== matchID || previousInfo.playerID !== playerID)) {
            this.hooks.removeSocketFromPreviousMatch(socket.id, previousInfo);
        }

        this.hooks.setSocketInfo(socket.id, { matchID, playerID, credentials });
        socket.join(`game:${matchID}`);

        if (playerID === null) {
            match.spectatorSockets.add(socket.id);
            return;
        }

        const connections = match.connections.get(playerID) ?? new Set<string>();
        connections.add(socket.id);
        match.connections.set(playerID, connections);

        const offlineTimer = match.offlineTimers.get(playerID);
        if (offlineTimer) {
            clearTimeout(offlineTimer);
            match.offlineTimers.delete(playerID);
        }

        const playerMetadata = match.metadata.players[playerID];
        if (!playerMetadata) {
            return;
        }
        const wasConnected = playerMetadata.isConnected === true;
        playerMetadata.isConnected = true;
        if (!wasConnected) {
            match.metadata.updatedAt = Date.now();
            this.persistConnectedMetadata(matchID, playerID, match.metadata);
        }
    }

    private persistConnectedMetadata(
        matchID: string,
        playerID: string,
        metadata: MatchMetadata,
    ): void {
        this.hooks.persistMetadata(matchID, metadata).catch((error: unknown) => {
            this.hooks.onPersistConnectedMetadataFailed?.({ matchID, playerID, error });
        });
    }

    private persistDisconnectedMetadata(match: TMatch, playerID: string): void {
        this.hooks.persistMetadata(match.matchID, match.metadata).catch((error: unknown) => {
            this.hooks.onPersistDisconnectedMetadataFailed?.({
                matchID: match.matchID,
                playerID,
                error,
            });
        });
    }
}
