import type { Server as IOServer } from 'socket.io';
import { applyPlayerViewToState, resolveSeatPlayerDisplayName } from '../ai';
import type { MatchState } from '../types';
import { computeDiff } from './patch';
import type { MatchPlayerInfo } from './protocol';
import type { MatchMetadata } from './storage';
import { extractTrustedSetupSeatControllers } from './onlineAiSeatControllers';
import type { GameEngineConfig } from './engineConfig';

export type TransportStateProjectionMatch = {
    matchID: string;
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    metadata: MatchMetadata;
    stateID: number;
    getRandomCursor: () => number;
    connections: Map<string, Set<string>>;
    spectatorSockets: Set<string>;
    lastBroadcastedViews: Map<string, unknown>;
    lastCommandPlayerId: string | null;
};

export type TransportStateProjectionOptions = {
    stripEventStream?: boolean;
};

const serializeTransportState = <T,>(state: T): T => JSON.parse(JSON.stringify(state)) as T;

/**
 * 传输裁剪：playerView 之后、socket emit 之前统一去掉客户端不需要的大体积系统数据。
 */
export function stripStateForTransport(
    viewState: unknown,
    options?: TransportStateProjectionOptions,
): unknown {
    const state = viewState as { sys?: Record<string, unknown> };
    if (!state.sys) return serializeTransportState(viewState);

    const sys = state.sys;
    const patches: Record<string, unknown> = {};

    const undo = sys.undo as { snapshots?: unknown[]; maxSnapshots?: number; pendingRequest?: unknown } | undefined;
    if (undo?.snapshots && undo.snapshots.length > 0) {
        patches.undo = {
            ...undo,
            snapshots: [],
            snapshotCount: undo.snapshots.length,
        };
    }

    if (options?.stripEventStream === true) {
        const es = sys.eventStream as { entries?: unknown[]; nextId?: number; maxEntries?: number } | undefined;
        if (es?.entries && es.entries.length > 0) {
            const lastEntry = es.entries[es.entries.length - 1] as { id?: number } | undefined;
            patches.eventStream = {
                ...es,
                entries: [],
                nextId: (lastEntry?.id ?? (es.nextId ?? 1) - 1) + 1,
            };
        }
    }

    const tutorial = sys.tutorial as {
        active?: boolean;
        steps?: unknown[];
        step?: unknown;
        stepIndex?: number;
    } | undefined;
    if (tutorial?.steps && tutorial.steps.length > 0) {
        patches.tutorial = {
            ...tutorial,
            steps: [],
            totalSteps: tutorial.steps.length,
        };
    }

    if (Object.keys(patches).length === 0) {
        return serializeTransportState(viewState);
    }

    return serializeTransportState({
        ...state,
        sys: { ...sys, ...patches },
    });
}

export function stripStateForTraining(viewState: unknown): unknown {
    const stripped = stripStateForTransport(viewState, { stripEventStream: true }) as {
        sys?: Record<string, unknown>;
    };

    if (!stripped?.sys) return stripped;

    const sys = stripped.sys;
    const patches: Record<string, unknown> = {};

    const actionLog = sys.actionLog as { entries?: unknown[] } | undefined;
    if (actionLog?.entries && actionLog.entries.length > 0) {
        patches.actionLog = {
            ...actionLog,
            entries: [],
            entryCount: actionLog.entries.length,
        };
    }

    const log = sys.log as { entries?: unknown[] } | undefined;
    if (log?.entries && log.entries.length > 0) {
        patches.log = {
            ...log,
            entries: [],
            entryCount: log.entries.length,
        };
    }

    if (Object.keys(patches).length === 0) return stripped;

    return {
        ...stripped,
        sys: { ...sys, ...patches },
    };
}

export function applyMatchPlayerView(
    match: Pick<TransportStateProjectionMatch, 'engineConfig' | 'state'>,
    playerID: string | null,
): unknown {
    return applyPlayerViewToState(match.engineConfig, match.state, playerID);
}

export function buildTransportMatchPlayers(
    match: Pick<TransportStateProjectionMatch, 'metadata'>,
): MatchPlayerInfo[] {
    const seatControllers = extractTrustedSetupSeatControllers(match.metadata.setupData);
    const setupData = match.metadata.setupData;
    const ownerKey = setupData && typeof setupData === 'object' && !Array.isArray(setupData)
        ? (setupData as { ownerKey?: string }).ownerKey
        : undefined;
    return Object.entries(match.metadata.players).map(([id, data]) => ({
        id: Number(id),
        name: resolveSeatPlayerDisplayName({
            playerId: id,
            name: data.name,
            seatControllers,
        }),
        isConnected: data.isConnected,
        isOwner: typeof ownerKey === 'string' && ownerKey.length > 0 && data.ownerKey === ownerKey,
    }));
}

export function emitStateToSockets(args: {
    io: IOServer;
    match: Pick<TransportStateProjectionMatch, 'matchID' | 'lastBroadcastedViews'>;
    viewState: unknown;
    cacheKey: string;
    sockets: Set<string>;
    matchPlayers: MatchPlayerInfo[];
    meta: { stateID: number; lastCommandPlayerId?: string; randomCursor: number };
}): void {
    const nsp = args.io.of('/game');
    const cached = args.match.lastBroadcastedViews.get(args.cacheKey);

    if (cached === undefined) {
        for (const socketId of args.sockets) {
            nsp.to(socketId).emit('state:update', args.match.matchID, args.viewState, args.matchPlayers, args.meta);
        }
    } else {
        const diff = computeDiff(cached, args.viewState);

        if (diff.type === 'full') {
            for (const socketId of args.sockets) {
                nsp.to(socketId).emit('state:update', args.match.matchID, args.viewState, args.matchPlayers, args.meta);
            }
        } else if (diff.patches && diff.patches.length > 0) {
            for (const socketId of args.sockets) {
                nsp.to(socketId).emit('state:patch', args.match.matchID, diff.patches, args.matchPlayers, args.meta);
            }
        }
    }

    args.match.lastBroadcastedViews.set(args.cacheKey, serializeTransportState(args.viewState));
}

export function broadcastProjectedMatchState(args: {
    io: IOServer;
    match: TransportStateProjectionMatch;
}): void {
    const matchPlayers = buildTransportMatchPlayers(args.match);

    const meta: { stateID: number; lastCommandPlayerId?: string; randomCursor: number } = {
        stateID: args.match.stateID,
        randomCursor: args.match.getRandomCursor(),
    };
    if (args.match.lastCommandPlayerId) {
        meta.lastCommandPlayerId = args.match.lastCommandPlayerId;
    }

    for (const [playerID, sockets] of args.match.connections) {
        const viewState = stripStateForTransport(applyMatchPlayerView(args.match, playerID));
        emitStateToSockets({
            io: args.io,
            match: args.match,
            viewState,
            cacheKey: playerID,
            sockets,
            matchPlayers,
            meta,
        });
    }

    if (args.match.spectatorSockets.size > 0) {
        const spectatorView = stripStateForTransport(applyMatchPlayerView(args.match, null));
        emitStateToSockets({
            io: args.io,
            match: args.match,
            viewState: spectatorView,
            cacheKey: 'spectator',
            sockets: args.match.spectatorSockets,
            matchPlayers,
            meta,
        });
    }
}
