import type { Game, Server, State, StorageAPI } from 'boardgame.io';
import { createRequire } from 'module';
import { shouldForceCancelInteraction } from './interactionAdjudication';

const require = createRequire(import.meta.url);
const { Master } = require('boardgame.io/master') as typeof import('boardgame.io/master');

const buildTimerKey = (matchID: string, playerID: string) => `${matchID}:${playerID}`;
const buildPlayerKey = (matchID: string, playerID: string) => `${matchID}:${playerID}`;
const buildPubSubChannelId = (matchID: string) => `MATCH-${matchID}`;

type ConnectionIndex = Map<string, Set<string>>;

const addSocketConnection = (index: ConnectionIndex, playerKey: string, socketId: string) => {
    const set = index.get(playerKey) ?? new Set<string>();
    set.add(socketId);
    index.set(playerKey, set);
};

const removeSocketConnection = (index: ConnectionIndex, playerKey: string, socketId: string): boolean => {
    const set = index.get(playerKey);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
        index.delete(playerKey);
        return true;
    }
    return false;
};

export const __test__ = {
    buildPlayerKey,
    addSocketConnection,
    removeSocketConnection,
};

type AdjudicationTransport = {
    getMatchQueue?: (matchID: string) => { add: <T>(task: () => Promise<T> | T) => Promise<T> };
    pubSub?: { publish: (channelId: string, payload: unknown) => void };
};

type RegisterOptions = {
    app: { _io?: { of: (name: string) => { on: (event: string, handler: (socket: any) => void) => void } } };
    db: StorageAPI.Async | StorageAPI.Sync;
    auth: unknown;
    transport: AdjudicationTransport;
    games: Game[];
    graceMs: number;
};

type SocketClientInfo = {
    matchID: string;
    playerID: string;
    credentials?: string;
};

export const registerOfflineInteractionAdjudication = ({
    app,
    db,
    auth,
    transport,
    games,
    graceMs,
}: RegisterOptions): void => {
    const io = app._io;
    if (!io) return;

    const socketIndex = new Map<string, SocketClientInfo>();
    const connectionIndex: ConnectionIndex = new Map();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const clearTimer = (matchID: string, playerID: string) => {
        const key = buildTimerKey(matchID, playerID);
        const timer = timers.get(key);
        if (timer) {
            clearTimeout(timer);
        }
        timers.delete(key);
    };

    const runAdjudication = async (matchID: string, playerID: string, credentials?: string) => {
        const execute = async () => {
            const fetchResult = await Promise.resolve(
                (db as StorageAPI.Sync | StorageAPI.Async).fetch(matchID, { state: true, metadata: true })
            );
            const state = fetchResult?.state as State | undefined;
            const metadata = fetchResult?.metadata as Server.MatchData | undefined;

            const decision = shouldForceCancelInteraction({ state, metadata, playerId: playerID });
            if (!decision.shouldCancel || !state || !metadata) {
                return;
            }

            const gameName = metadata.gameName;
            const game = games.find(entry => entry.name === gameName);
            if (!game) {
                return;
            }

            const players = metadata.players as Record<string, { credentials?: string }> | undefined;
            const resolvedCredentials = credentials ?? players?.[playerID]?.credentials;
            const requiresAuth = Object.values(players ?? {}).some(player => Boolean(player?.credentials));
            if (requiresAuth && !resolvedCredentials) {
                return;
            }

            const transportAPI = {
                send: () => undefined,
                sendAll: (payload: unknown) => {
                    transport.pubSub?.publish(buildPubSubChannelId(matchID), payload);
                },
            };

            const master = new Master(game, db, transportAPI, auth as any);
            const action = {
                type: 'MAKE_MOVE',
                payload: {
                    type: 'CANCEL_INTERACTION',
                    args: {},
                    playerID: playerID,
                    credentials: resolvedCredentials ?? '',
                },
            } as unknown as {
                type: 'MAKE_MOVE';
                payload: {
                    type: string;
                    args: unknown;
                    playerID: string;
                    credentials: string;
                };
            };

            await master.onUpdate(action, state._stateID, matchID, playerID);
        };

        const queue = transport.getMatchQueue?.(matchID);
        if (queue) {
            await queue.add(execute);
        } else {
            await execute();
        }
    };

    const scheduleAdjudication = (matchID: string, playerID: string, credentials?: string) => {
        clearTimer(matchID, playerID);
        const key = buildTimerKey(matchID, playerID);
        const timer = setTimeout(() => {
            timers.delete(key);
            void runAdjudication(matchID, playerID, credentials);
        }, graceMs);
        timers.set(key, timer);
    };

    games.forEach((game) => {
        if (!game.name) return;
        const nsp = io.of(game.name);
        nsp.on('connection', (socket: any) => {
            socket.on('sync', (matchID: string, playerID?: string | null, credentials?: string) => {
                if (playerID === null || playerID === undefined) return;
                const normalizedPlayerId = String(playerID);
                const nextInfo = { matchID, playerID: normalizedPlayerId, credentials };
                const previous = socketIndex.get(socket.id);
                if (previous) {
                    const previousKey = buildPlayerKey(previous.matchID, previous.playerID);
                    const nextKey = buildPlayerKey(nextInfo.matchID, nextInfo.playerID);
                    if (previousKey !== nextKey) {
                        const becameEmpty = removeSocketConnection(connectionIndex, previousKey, socket.id);
                        if (becameEmpty) {
                            scheduleAdjudication(previous.matchID, previous.playerID, previous.credentials);
                        }
                    }
                }

                const playerKey = buildPlayerKey(matchID, normalizedPlayerId);
                addSocketConnection(connectionIndex, playerKey, socket.id);
                socketIndex.set(socket.id, nextInfo);
                clearTimer(matchID, normalizedPlayerId);
            });

            socket.on('disconnect', () => {
                const info = socketIndex.get(socket.id);
                socketIndex.delete(socket.id);
                if (!info) return;
                const playerKey = buildPlayerKey(info.matchID, info.playerID);
                const becameEmpty = removeSocketConnection(connectionIndex, playerKey, socket.id);
                if (!becameEmpty) return;
                scheduleAdjudication(info.matchID, info.playerID, info.credentials);
            });
        });
    });
};
