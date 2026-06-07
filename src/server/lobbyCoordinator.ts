import type { Server as IOServer, Socket as IOSocket } from 'socket.io';
import { LOBBY_ALL, LOBBY_EVENTS, type LobbyHeartbeatPayload, type LobbyGameId, type LobbyMatch, type LobbyMatchEndedPayload, type LobbyMatchPayload, type LobbySnapshotPayload } from '../shared/lobby';
import type { MatchStorage } from '../engine/transport/storage';
import { hasOccupiedPlayers } from './matchOccupancy';
import { buildLobbyMatch } from './lobbyMatch';

const LOBBY_ROOM = 'lobby:subscribers';
const LOBBY_ALL_ROOM = `${LOBBY_ROOM}:${LOBBY_ALL}`;
const LOBBY_HEARTBEAT_INTERVAL = 15000;
const LOBBY_SNAPSHOT_DEBOUNCE_MS = 300;

type LoggerLike = {
    warn: (message: string, ...args: unknown[]) => void;
};

type CreateLobbyCoordinatorArgs<TGame extends string> = {
    storage: MatchStorage;
    supportedGames: readonly TGame[];
    isSupportedGame: (gameName: string) => gameName is TGame;
    normalizeGameName: (name?: string) => string;
    logger: LoggerLike;
};

export function createLobbyCoordinator<TGame extends string>(args: CreateLobbyCoordinatorArgs<TGame>) {
    const lobbySubscribersByGame = new Map<TGame, Set<string>>();
    const lobbyAllSubscribers = new Set<string>();
    const lobbyVersionByGame = new Map<TGame | typeof LOBBY_ALL, number>();
    const lobbyCacheByGame = new Map<TGame, Map<string, LobbyMatch>>();
    const lobbyCacheDirty = new Map<TGame, boolean>();
    const matchGameIndex = new Map<string, TGame>();
    const lobbySnapshotTimers = new Map<TGame, ReturnType<typeof setTimeout>>();
    let lobbyHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let lobbyIO: IOServer | null = null;

    const bumpLobbyVersion = (gameName: TGame): number => {
        const version = (lobbyVersionByGame.get(gameName) ?? 0) + 1;
        lobbyVersionByGame.set(gameName, version);
        return version;
    };

    const bumpLobbyAllVersion = (): number => {
        const version = (lobbyVersionByGame.get(LOBBY_ALL) ?? 0) + 1;
        lobbyVersionByGame.set(LOBBY_ALL, version);
        return version;
    };

    const getLobbyRoomName = (gameName: TGame) => `${LOBBY_ROOM}:${gameName}`;

    const ensureGameState = (gameName: TGame) => {
        if (!lobbySubscribersByGame.has(gameName)) {
            lobbySubscribersByGame.set(gameName, new Set());
        }
        if (!lobbyCacheByGame.has(gameName)) {
            lobbyCacheByGame.set(gameName, new Map());
            lobbyCacheDirty.set(gameName, true);
        }
    };

    const fetchLobbyMatch = async (matchID: string): Promise<LobbyMatch | null> => {
        try {
            const result = await args.storage.fetch(matchID, { metadata: true });
            if (!result.metadata) return null;
            const match = buildLobbyMatch(matchID, result.metadata);
            const game = args.normalizeGameName(result.metadata.gameName);
            if (game && args.isSupportedGame(game)) {
                matchGameIndex.set(matchID, game);
                ensureGameState(game);
                lobbyCacheByGame.get(game)!.set(matchID, match);
            }
            return match;
        } catch {
            return null;
        }
    };

    const fetchMatchesByGame = async (gameName: TGame): Promise<LobbyMatch[]> => {
        try {
            const matchIds = await args.storage.listMatches({ gameName });
            const matches: LobbyMatch[] = [];
            for (const matchID of matchIds) {
                const result = await args.storage.fetch(matchID, { metadata: true });
                if (!result.metadata) continue;
                const players = result.metadata.players as Record<string, { name?: string; credentials?: string; isConnected?: boolean | null }> | undefined;
                if (!hasOccupiedPlayers(players)) continue;
                const match = buildLobbyMatch(matchID, result.metadata);
                matchGameIndex.set(matchID, gameName);
                matches.push(match);
            }
            return matches;
        } catch {
            return [];
        }
    };

    const syncLobbyCache = async (gameName: TGame): Promise<LobbyMatch[]> => {
        ensureGameState(gameName);
        const matches = await fetchMatchesByGame(gameName);
        const cache = lobbyCacheByGame.get(gameName)!;
        cache.clear();
        for (const match of matches) {
            cache.set(match.matchID, match);
        }
        lobbyCacheDirty.set(gameName, false);
        return matches;
    };

    const markLobbyCacheDirty = (gameName: TGame) => {
        lobbyCacheDirty.set(gameName, true);
    };

    const getLobbySnapshot = async (gameName: TGame): Promise<LobbyMatch[]> => {
        ensureGameState(gameName);
        if (lobbyCacheDirty.get(gameName)) {
            return syncLobbyCache(gameName);
        }
        return Array.from(lobbyCacheByGame.get(gameName)!.values());
    };

    const getLobbySnapshotAll = async (): Promise<LobbyMatch[]> => {
        const all: LobbyMatch[] = [];
        for (const gameName of args.supportedGames) {
            const matches = await getLobbySnapshot(gameName);
            all.push(...matches);
        }
        return all;
    };

    const emitToLobby = (gameName: TGame, event: string, payload: unknown) => {
        if (!lobbyIO) return;
        lobbyIO.to(getLobbyRoomName(gameName)).emit(event, payload);
    };

    const emitToLobbyAll = (event: string, payload: unknown) => {
        if (!lobbyIO) return;
        lobbyIO.to(LOBBY_ALL_ROOM).emit(event, payload);
    };

    const emitMatchCreated = (gameName: TGame, match: LobbyMatch) => {
        ensureGameState(gameName);
        lobbyCacheByGame.get(gameName)!.set(match.matchID, match);
        matchGameIndex.set(match.matchID, gameName);
        const payload: LobbyMatchPayload = { gameId: gameName, version: bumpLobbyVersion(gameName), match };
        emitToLobby(gameName, LOBBY_EVENTS.MATCH_CREATED, payload);
        emitToLobbyAll(LOBBY_EVENTS.MATCH_CREATED, { gameId: LOBBY_ALL, version: bumpLobbyAllVersion(), match });
    };

    const emitMatchUpdated = (gameName: TGame, match: LobbyMatch) => {
        ensureGameState(gameName);
        lobbyCacheByGame.get(gameName)!.set(match.matchID, match);
        matchGameIndex.set(match.matchID, gameName);
        const payload: LobbyMatchPayload = { gameId: gameName, version: bumpLobbyVersion(gameName), match };
        emitToLobby(gameName, LOBBY_EVENTS.MATCH_UPDATED, payload);
        emitToLobbyAll(LOBBY_EVENTS.MATCH_UPDATED, { gameId: LOBBY_ALL, version: bumpLobbyAllVersion(), match });
    };

    const emitMatchEnded = (gameName: TGame, matchID: string) => {
        ensureGameState(gameName);
        lobbyCacheByGame.get(gameName)!.delete(matchID);
        matchGameIndex.delete(matchID);
        const payload: LobbyMatchEndedPayload = { gameId: gameName, version: bumpLobbyVersion(gameName), matchID };
        emitToLobby(gameName, LOBBY_EVENTS.MATCH_ENDED, payload);
        emitToLobbyAll(LOBBY_EVENTS.MATCH_ENDED, { gameId: LOBBY_ALL, version: bumpLobbyAllVersion(), matchID });
    };

    const emitLobbyHeartbeat = () => {
        if (!lobbyIO) return;
        for (const gameName of args.supportedGames) {
            const subscribers = lobbySubscribersByGame.get(gameName);
            if (!subscribers || subscribers.size === 0) continue;
            const payload: LobbyHeartbeatPayload = {
                gameId: gameName,
                version: lobbyVersionByGame.get(gameName) ?? 0,
                timestamp: Date.now(),
            };
            emitToLobby(gameName, LOBBY_EVENTS.HEARTBEAT, payload);
        }
        if (lobbyAllSubscribers.size > 0) {
            const payload: LobbyHeartbeatPayload = {
                gameId: LOBBY_ALL,
                version: lobbyVersionByGame.get(LOBBY_ALL) ?? 0,
                timestamp: Date.now(),
            };
            emitToLobbyAll(LOBBY_EVENTS.HEARTBEAT, payload);
        }
    };

    const startLobbyHeartbeat = () => {
        if (lobbyHeartbeatTimer) return;
        lobbyHeartbeatTimer = setInterval(emitLobbyHeartbeat, LOBBY_HEARTBEAT_INTERVAL);
    };

    const sendLobbySnapshot = async (socket: IOSocket, gameName: TGame) => {
        const matches = await getLobbySnapshot(gameName);
        const payload: LobbySnapshotPayload = {
            gameId: gameName,
            matches,
            version: lobbyVersionByGame.get(gameName) ?? 0,
        };
        socket.emit(LOBBY_EVENTS.LOBBY_UPDATE, payload);
    };

    const sendLobbySnapshotAll = async (socket: IOSocket) => {
        const matches = await getLobbySnapshotAll();
        const payload: LobbySnapshotPayload = {
            gameId: LOBBY_ALL,
            matches,
            version: lobbyVersionByGame.get(LOBBY_ALL) ?? 0,
        };
        socket.emit(LOBBY_EVENTS.LOBBY_UPDATE, payload);
    };

    const broadcastLobbySnapshot = async (gameName: TGame, _reason: string) => {
        if (!lobbyIO) return;
        ensureGameState(gameName);
        const matches = await syncLobbyCache(gameName);
        const payload: LobbySnapshotPayload = {
            gameId: gameName,
            matches,
            version: bumpLobbyVersion(gameName),
        };
        emitToLobby(gameName, LOBBY_EVENTS.LOBBY_UPDATE, payload);
        if (lobbyAllSubscribers.size > 0) {
            const allMatches = await getLobbySnapshotAll();
            emitToLobbyAll(LOBBY_EVENTS.LOBBY_UPDATE, {
                gameId: LOBBY_ALL,
                matches: allMatches,
                version: bumpLobbyAllVersion(),
            });
        }
    };

    const scheduleLobbySnapshot = (gameName: TGame, reason: string) => {
        const existing = lobbySnapshotTimers.get(gameName);
        if (existing) clearTimeout(existing);
        lobbySnapshotTimers.set(
            gameName,
            setTimeout(() => {
                lobbySnapshotTimers.delete(gameName);
                void broadcastLobbySnapshot(gameName, reason);
            }, LOBBY_SNAPSHOT_DEBOUNCE_MS),
        );
    };

    const resolveGameFromUrl = (raw?: string): TGame | null => {
        const normalized = args.normalizeGameName(raw);
        if (!normalized) return null;
        return args.isSupportedGame(normalized) ? normalized : null;
    };

    const resolveGameFromMatch = (match: LobbyMatch | null): TGame | null => {
        const normalized = args.normalizeGameName(match?.gameName);
        if (!normalized) return null;
        return args.isSupportedGame(normalized) ? normalized : null;
    };

    const destroyLobbyRoom = async (matchID: string): Promise<boolean> => {
        if (!matchID) return false;

        const match = await fetchLobbyMatch(matchID);
        const indexed = matchGameIndex.get(matchID) ?? null;
        const game = indexed || resolveGameFromMatch(match);

        try {
            await args.storage.wipe(matchID);
        } catch (error) {
            args.logger.warn(`[LobbyInternal] destroy room failed matchID=${matchID} error=${error instanceof Error ? error.message : String(error)}`);
            return false;
        }

        if (game) {
            emitMatchEnded(game, matchID);
        }

        return true;
    };

    const forgetLobbyMatch = (matchID: string) => {
        matchGameIndex.delete(matchID);
    };

    const handleMatchCreated = async (matchID?: string, gameNameFromUrl?: string) => {
        const gameFromUrl = resolveGameFromUrl(gameNameFromUrl);
        if (gameFromUrl && getSubscriberCount(gameFromUrl) === 0) {
            markLobbyCacheDirty(gameFromUrl);
            return;
        }
        if (!matchID) {
            if (gameFromUrl) scheduleLobbySnapshot(gameFromUrl, 'create: 无 matchID');
            return;
        }
        const match = await fetchLobbyMatch(matchID);
        const game = gameFromUrl || resolveGameFromMatch(match);
        if (!game) return;
        if (getSubscriberCount(game) === 0) {
            markLobbyCacheDirty(game);
            return;
        }
        if (match) {
            emitMatchCreated(game, match);
            return;
        }
        scheduleLobbySnapshot(game, `create: 获取房间失败 ${matchID}`);
    };

    const handleMatchJoined = async (matchID?: string, gameNameFromUrl?: string) => {
        const gameFromUrl = resolveGameFromUrl(gameNameFromUrl);
        if (gameFromUrl && getSubscriberCount(gameFromUrl) === 0) {
            markLobbyCacheDirty(gameFromUrl);
            return;
        }
        if (!matchID) {
            if (gameFromUrl) scheduleLobbySnapshot(gameFromUrl, 'join: 无 matchID');
            return;
        }
        const match = await fetchLobbyMatch(matchID);
        const game = gameFromUrl || resolveGameFromMatch(match);
        if (!game) return;
        if (getSubscriberCount(game) === 0) {
            markLobbyCacheDirty(game);
            return;
        }
        const cache = lobbyCacheByGame.get(game)!;
        if (!match) {
            scheduleLobbySnapshot(game, `join: 获取房间失败 ${matchID}`);
            return;
        }
        if (cache.has(matchID)) {
            emitMatchUpdated(game, match);
        } else {
            emitMatchCreated(game, match);
        }
    };

    const handleMatchLeft = async (matchID?: string, gameNameFromUrl?: string) => {
        const gameFromUrl = resolveGameFromUrl(gameNameFromUrl);
        if (gameFromUrl && getSubscriberCount(gameFromUrl) === 0) {
            markLobbyCacheDirty(gameFromUrl);
            return;
        }
        if (!matchID) {
            if (gameFromUrl) scheduleLobbySnapshot(gameFromUrl, 'leave: 无 matchID');
            return;
        }
        const match = await fetchLobbyMatch(matchID);
        const indexed = matchGameIndex.get(matchID) ?? null;
        const game = gameFromUrl || indexed || resolveGameFromMatch(match);
        if (!game) return;
        if (getSubscriberCount(game) === 0) {
            markLobbyCacheDirty(game);
            return;
        }
        if (match) {
            if (!match.players.some((player) => player.name)) {
                emitMatchEnded(game, matchID);
                return;
            }
            emitMatchUpdated(game, match);
            return;
        }
        emitMatchEnded(game, matchID);
    };

    const getLobbySubscriptions = (socket: IOSocket): Set<LobbyGameId> => {
        if (!socket.data.lobbyGameIds) {
            socket.data.lobbyGameIds = new Set<LobbyGameId>();
        }
        return socket.data.lobbyGameIds as Set<LobbyGameId>;
    };

    const addLobbySubscription = (socket: IOSocket, gameId: TGame | typeof LOBBY_ALL) => {
        const subscriptions = getLobbySubscriptions(socket);
        const isNew = !subscriptions.has(gameId);
        subscriptions.add(gameId);

        if (gameId === LOBBY_ALL) {
            lobbyAllSubscribers.add(socket.id);
            socket.join(LOBBY_ALL_ROOM);
            return { isNew, subscriberCount: lobbyAllSubscribers.size };
        }

        ensureGameState(gameId);
        lobbySubscribersByGame.get(gameId)!.add(socket.id);
        socket.join(getLobbyRoomName(gameId));
        return { isNew, subscriberCount: lobbySubscribersByGame.get(gameId)!.size };
    };

    const removeLobbySubscription = (socket: IOSocket, gameId: LobbyGameId) => {
        const subscriptions = getLobbySubscriptions(socket);
        subscriptions.delete(gameId);

        if (gameId === LOBBY_ALL) {
            lobbyAllSubscribers.delete(socket.id);
            socket.leave(LOBBY_ALL_ROOM);
        } else if (args.isSupportedGame(gameId)) {
            lobbySubscribersByGame.get(gameId)?.delete(socket.id);
            socket.leave(getLobbyRoomName(gameId));
        }

        if (subscriptions.size === 0) {
            socket.data.lobbyGameIds = undefined;
        }
    };

    const clearLobbySubscriptions = (socket: IOSocket) => {
        const subscriptions = getLobbySubscriptions(socket);
        subscriptions.forEach((gameId) => {
            if (gameId === LOBBY_ALL) {
                lobbyAllSubscribers.delete(socket.id);
                socket.leave(LOBBY_ALL_ROOM);
                return;
            }
            if (args.isSupportedGame(gameId)) {
                lobbySubscribersByGame.get(gameId)?.delete(socket.id);
                socket.leave(getLobbyRoomName(gameId));
            }
        });
        subscriptions.clear();
        socket.data.lobbyGameIds = undefined;
    };

    const getSubscriberCount = (gameName: TGame): number => (
        lobbySubscribersByGame.get(gameName)?.size ?? 0
    );

    const getAllSubscriberCount = (): number => lobbyAllSubscribers.size;

    return {
        attachIO: (io: IOServer) => {
            lobbyIO = io;
        },
        addLobbySubscription,
        removeLobbySubscription,
        clearLobbySubscriptions,
        getSubscriberCount,
        getAllSubscriberCount,
        getLobbySnapshot,
        getLobbySnapshotAll,
        sendLobbySnapshot,
        sendLobbySnapshotAll,
        startLobbyHeartbeat,
        markLobbyCacheDirty,
        scheduleLobbySnapshot,
        broadcastLobbySnapshot,
        emitMatchEnded,
        forgetLobbyMatch,
        destroyLobbyRoom,
        handleMatchCreated,
        handleMatchJoined,
        handleMatchLeft,
    };
}
