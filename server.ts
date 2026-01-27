import 'dotenv/config'; // 加载 .env
import type { Game } from 'boardgame.io';
import { Server as BoardgameServer, Origins } from 'boardgame.io/server';
import { Server as IOServer, Socket as IOSocket } from 'socket.io';
import bodyParser from 'koa-bodyparser';
import { connectDB } from './src/server/db';
import { MatchRecord } from './src/server/models/MatchRecord';
import { GAME_SERVER_MANIFEST } from './src/games/manifest.server';
import { mongoStorage } from './src/server/storage/MongoStorage';

// 大厅事件常量（与前端 lobbySocket.ts 保持一致）
const LOBBY_EVENTS = {
    SUBSCRIBE_LOBBY: 'lobby:subscribe',
    UNSUBSCRIBE_LOBBY: 'lobby:unsubscribe',
    LOBBY_UPDATE: 'lobby:update',
    MATCH_CREATED: 'lobby:matchCreated',
    MATCH_UPDATED: 'lobby:matchUpdated',
    MATCH_ENDED: 'lobby:matchEnded',
    HEARTBEAT: 'lobby:heartbeat',
} as const;

// 重赛事件常量（与前端 matchSocket.ts 保持一致）
const REMATCH_EVENTS = {
    JOIN_MATCH: 'rematch:join',
    LEAVE_MATCH: 'rematch:leave',
    VOTE: 'rematch:vote',
    STATE_UPDATE: 'rematch:stateUpdate',
    TRIGGER_RESET: 'rematch:triggerReset',
    // 调试用：广播新房间
    DEBUG_NEW_ROOM: 'debug:newRoom',
} as const;

// 重赛投票状态（按 matchID 维护）
interface RematchVoteState {
    votes: Record<string, boolean>;
    ready: boolean;
    /** 递增版本号，确保客户端能丢弃旧状态，避免刷新/重连后回退 */
    revision: number;
}
const rematchStateByMatch = new Map<string, RematchVoteState>();
const matchSubscribers = new Map<string, Set<string>>(); // matchID -> Set<socketId>

const LOBBY_ROOM = 'lobby:subscribers';
const LOBBY_HEARTBEAT_INTERVAL = 15000;

// 权威清单驱动服务端注册与归档（仅 type=game 且 enabled=true）
const MATCH_ID_FIELD = '__matchID';

const ENABLED_GAME_ENTRIES = GAME_SERVER_MANIFEST.filter(
    (entry) => entry.manifest.type === 'game' && entry.manifest.enabled
);

const SUPPORTED_GAMES = ENABLED_GAME_ENTRIES.map((entry) => entry.manifest.id);
type SupportedGame = (typeof SUPPORTED_GAMES)[number];

const normalizeGameName = (name?: string) => (name || '').toLowerCase();
const isSupportedGame = (gameName: string): gameName is SupportedGame => {
    return (SUPPORTED_GAMES as readonly string[]).includes(gameName);
};

let serverDb: any = null;

const archiveMatchResult = async ({
    matchID,
    gameName,
    ctx,
}: {
    matchID: string;
    gameName: string;
    ctx: { gameover?: { winner?: string | number } } | undefined;
}) => {
    if (!serverDb) {
        console.warn(`[Archive] DB 未就绪，跳过归档: ${matchID}`);
        return;
    }
    try {
        const existing = await MatchRecord.findOne({ matchID });
        if (existing) return;

        const { metadata } = (await serverDb.fetch(matchID, { metadata: true })) || {};
        const gameover = ctx?.gameover;
        const winnerID = gameover?.winner !== undefined ? String(gameover.winner) : undefined;
        const resultType = winnerID ? 'win' : 'draw';

        const players = [] as Array<{ id: string; name: string; result: string }>;
        if (metadata && metadata.players) {
            for (const [pid, pdata] of Object.entries(metadata.players)) {
                const name = (pdata as { name?: string })?.name || `Player ${pid}`;
                players.push({
                    id: pid,
                    name,
                    result: pid === winnerID ? 'win' : (resultType === 'draw' ? 'draw' : 'loss'),
                });
            }
        }

        await MatchRecord.create({
            matchID,
            gameName,
            players,
            winnerID,
            createdAt: new Date(metadata?.createdAt || Date.now()),
            endedAt: new Date(),
        });
        console.log(`[Archive] Archived match ${matchID}`);
    } catch (err) {
        console.error('[Archive] Error:', err);
    }
};

const attachMatchIdToState = async (matchID: string) => {
    if (!serverDb) return;
    try {
        const { state } = (await serverDb.fetch(matchID, { state: true })) || {};
        if (!state || !state.G) return;
        const current = state.G as Record<string, unknown>;
        if (current[MATCH_ID_FIELD] === matchID) return;
        const nextState = {
            ...state,
            G: {
                ...current,
                [MATCH_ID_FIELD]: matchID,
            },
        };
        await serverDb.setState(matchID, nextState);
    } catch (error) {
        console.error(`[Archive] 注入 matchID 失败: ${matchID}`, error);
    }
};

const withArchiveOnEnd = (game: Game, gameName: string): Game => {
    const originalOnEnd = game.onEnd;
    return {
        ...game,
        onEnd: (context) => {
            const result = originalOnEnd ? originalOnEnd(context) : undefined;
            const resolvedG = (result ?? context.G) as Record<string, unknown>;
            const matchID = (resolvedG?.[MATCH_ID_FIELD] ?? (context.G as Record<string, unknown>)?.[MATCH_ID_FIELD]) as
                | string
                | undefined;
            if (!matchID) {
                console.warn(`[Archive] 未找到 matchID，跳过归档: ${gameName}`);
                return result ?? context.G;
            }
            void archiveMatchResult({ matchID, gameName, ctx: context.ctx });
            return result ?? context.G;
        },
    };
};
const withSetupData = (game: Game): Game => {
    const originalSetup = game.setup;
    return {
        ...game,
        setup: (ctx, setupData) => {
            const baseState = originalSetup ? originalSetup(ctx, setupData) : {};
            if (baseState && typeof baseState === 'object') {
                return {
                    ...(baseState as Record<string, unknown>),
                    __setupData: setupData ?? null,
                };
            }
            return baseState;
        },
    };
};

const buildServerGames = (): Game[] => {
    const games: Game[] = [];
    const manifestGameIds = new Set<string>();

    for (const entry of ENABLED_GAME_ENTRIES) {
        const { manifest, game } = entry;
        if (manifestGameIds.has(manifest.id)) {
            throw new Error(`[GameManifest] 游戏 ID 重复: ${manifest.id}`);
        }
        manifestGameIds.add(manifest.id);
        games.push(withArchiveOnEnd(withSetupData(game), manifest.id));
    }

    return games;
};

const SERVER_GAMES = buildServerGames();

const RAW_WEB_ORIGINS = (process.env.WEB_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// boardgame.io 内置 CORS（@koa/cors）会把不允许的 Origin 写成空字符串，浏览器会直接报 CORS。
// 默认 Origins.LOCALHOST 只匹配 localhost:*，不包含 127.0.0.1:*。
// 开发环境下我们允许 localhost 与 127.0.0.1 的任意端口。
const DEV_GAME_ORIGINS = [Origins.LOCALHOST, /127\.0\.0\.1:\d+/];
const SERVER_ORIGINS = RAW_WEB_ORIGINS.length > 0 ? RAW_WEB_ORIGINS : DEV_GAME_ORIGINS;

const DEV_LOBBY_CORS_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
];

const LOBBY_CORS_ORIGINS = RAW_WEB_ORIGINS.length > 0 ? RAW_WEB_ORIGINS : DEV_LOBBY_CORS_ORIGINS;

// 是否启用持久化存储（通过环境变量控制，默认启用以保持与生产一致）
const USE_PERSISTENT_STORAGE = process.env.USE_PERSISTENT_STORAGE !== 'false';

// 创建 boardgame.io 服务器
const server = BoardgameServer({
    games: SERVER_GAMES,
    origins: SERVER_ORIGINS,
    // 启用持久化时使用 MongoDB 存储
    ...(USE_PERSISTENT_STORAGE ? { db: mongoStorage } : {}),
});

// 获取底层的 Koa 应用和数据库
const { app, db } = server;
serverDb = db;

// 预处理 /leave：只释放座位，不删除房间（避免 boardgame.io 在无人时 wipe）
// 注意：必须插入到 middleware 队列最前面，以拦截 boardgame.io 的默认路由
const interceptLeaveMiddleware = async (ctx: any, next: () => Promise<void>) => {
    if (ctx.method === 'POST') {
        const match = ctx.path.match(/^\/games\/([^/]+)\/([^/]+)\/leave$/);
        if (match) {
            const matchID = match[2];
            // 只在此路由读取 body，避免重复读取 request stream。
            const parse = bodyParser();
            await (parse as any)(ctx, async () => undefined);
            const body = (ctx.request as any).body as { playerID?: string; credentials?: string } | undefined;
            const playerID = body?.playerID;
            const credentials = body?.credentials;

            if (typeof playerID === 'undefined' || playerID === null) {
                ctx.throw(403, 'playerID is required');
            }
            if (!credentials) {
                ctx.throw(403, 'credentials is required');
            }

            const { metadata } = await db.fetch(matchID, { metadata: true });
            if (!metadata) {
                ctx.throw(404, 'Match ' + matchID + ' not found');
            }
            if (!metadata.players[playerID as string]) {
                ctx.throw(404, 'Player ' + playerID + ' not found');
            }

            const isAuthorized = await app.context.auth.authenticateCredentials({
                playerID: playerID as string,
                credentials,
                metadata,
            });
            if (!isAuthorized) {
                ctx.throw(403, 'Invalid credentials ' + credentials);
            }

            // 只清除该玩家的占位，不删除房间
            delete metadata.players[playerID as string].name;
            delete metadata.players[playerID as string].credentials;
            await db.setMetadata(matchID, metadata);

            ctx.body = {};
            return;
        }
    }
    await next();
};

// 插到最前面，优先于 boardgame.io 内置路由
(app as any).middleware?.unshift(interceptLeaveMiddleware);

if (USE_PERSISTENT_STORAGE) {
    console.log('[Server] 使用 MongoDB 持久化存储');
} else {
    console.log('[Server] 使用内存存储（开发模式）');
}
const GAME_SERVER_PORT = Number(process.env.GAME_SERVER_PORT) || 18000;

// 注意：不要启用全局 bodyParser。
// boardgame.io 会自行解析 /games/* 的 body；全局启用会导致 request stream 被重复读取，触发 "stream is not readable"。

// HTTP CORS：允许前端（Vite）跨端口访问本服务的 REST 接口（例如 /games/:game/leaderboard）。
app.use(async (ctx, next) => {
    const requestOrigin = ctx.get('origin');
    const allowedOrigins = new Set(LOBBY_CORS_ORIGINS);

    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
        ctx.set('Access-Control-Allow-Origin', requestOrigin);
        ctx.set('Vary', 'Origin');
        ctx.set('Access-Control-Allow-Credentials', 'true');
    }

    ctx.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    ctx.set(
        'Access-Control-Allow-Headers',
        ctx.get('access-control-request-headers') || 'Content-Type, Authorization'
    );

    if (ctx.method === 'OPTIONS') {
        ctx.status = 204;
        return;
    }

    await next();
});

// 强制销毁房间（仅房主可用）
// 注意：不要启用全局 bodyParser，否则会和 boardgame.io 自己的 body 解析冲突（create/join/leave 会 500）。
// 因此在该路由内按需解析 body。
app.use(async (ctx, next) => {
    if (ctx.method === 'POST') {
        const match = ctx.path.match(/^\/games\/([^/]+)\/([^/]+)\/destroy$/);
        if (match) {
            const gameNameFromUrl = match[1];
            const matchID = match[2];

            // 只在此路由读取 body，避免重复读取 request stream。
            // bodyParser() 的类型签名与 boardgame.io 的 Koa Context 类型不完全匹配，这里用 any 规避类型噪音。
            const parse = bodyParser();
            await (parse as any)(ctx, async () => undefined);
            const body = (ctx.request as any).body as { playerID?: string; credentials?: string } | undefined;
            const playerID = body?.playerID;
            const credentials = body?.credentials;

            if (!playerID) {
                ctx.throw(403, 'playerID is required');
            }
            if (!credentials) {
                ctx.throw(403, 'credentials is required');
            }

            const { metadata } = await db.fetch(matchID, { metadata: true });
            if (!metadata) {
                ctx.throw(404, 'Match ' + matchID + ' not found');
            }
            // 经过上面的必填校验，这里 playerID 一定存在。
            if (!metadata.players[playerID as string]) {
                ctx.throw(404, 'Player ' + playerID + ' not found');
            }

            const isAuthorized = await app.context.auth.authenticateCredentials({
                playerID: playerID as string,
                credentials,
                metadata,
            });
            if (!isAuthorized) {
                ctx.throw(403, 'Invalid credentials ' + credentials);
            }

            await db.wipe(matchID);

            const game = resolveGameFromUrl(gameNameFromUrl)
                || resolveGameFromMatch({ gameName: metadata.gameName } as LobbyMatch);
            if (game) {
                emitMatchEnded(game, matchID);
            }
            matchSubscribers.delete(matchID);
            rematchStateByMatch.delete(matchID);

            ctx.body = {};
            return;
        }
    }

    await next();
});

// 临时排查日志：捕获 /games/* 500 与异常栈，定位创建房间失败原因（定位完成后移除）
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (error) {
        console.error('[服务器异常]', {
            method: ctx.method,
            path: ctx.path,
            query: ctx.query,
            error,
        });
        throw error;
    }

    if (ctx.status >= 500 && ctx.path.startsWith('/games/')) {
        console.error('[HTTP 500]', {
            method: ctx.method,
            path: ctx.path,
            status: ctx.status,
            body: ctx.body,
        });
    }
});

// 存储订阅大厅的 socket 连接（按 game 维度分组）
const lobbySubscribersByGame = new Map<SupportedGame, Set<string>>();
let lobbyIO: IOServer | null = null;

// 房间信息类型（发送给前端的格式）
interface LobbyMatch {
    matchID: string;
    gameName: string;
    players: Array<{ id: number; name?: string; isConnected?: boolean }>;
    createdAt?: number;
    updatedAt?: number;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
}

const lobbyCacheByGame = new Map<SupportedGame, Map<string, LobbyMatch>>();
const lobbyCacheReadyByGame = new Map<SupportedGame, boolean>();
const lobbySnapshotTimerByGame = new Map<SupportedGame, ReturnType<typeof setTimeout> | null>();
let lobbyHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
const lobbyVersionByGame = new Map<SupportedGame, number>();
const matchGameIndex = new Map<string, SupportedGame>();

type PlayerMetadata = { name?: string; isConnected?: boolean };

interface LobbySnapshotPayload {
    version: number;
    matches: LobbyMatch[];
}

interface LobbyMatchPayload {
    version: number;
    match: LobbyMatch;
}

interface LobbyMatchEndedPayload {
    version: number;
    matchID: string;
}

interface LobbyHeartbeatPayload {
    version: number;
    timestamp: number;
}

const bumpLobbyVersion = (gameName: SupportedGame): number => {
    const current = lobbyVersionByGame.get(gameName) ?? 0;
    const next = current + 1;
    lobbyVersionByGame.set(gameName, next);
    return next;
};

const buildLobbyMatch = (
    matchID: string,
    metadata: { gameName?: string; players?: Record<string, PlayerMetadata>; createdAt?: number; updatedAt?: number; setupData?: unknown },
    roomName?: string,
    setupDataFromState?: { ownerKey?: string; ownerType?: 'user' | 'guest' }
): LobbyMatch => {
    const playersObj = metadata.players || {};
    const playersArray = Object.entries(playersObj).map(([id, data]) => ({
        id: Number(id),
        name: data?.name,
        isConnected: data?.isConnected,
    }));
    const setupDataFromMeta = (metadata.setupData as { ownerKey?: string; ownerType?: 'user' | 'guest' } | undefined) || undefined;
    const ownerKey = setupDataFromMeta?.ownerKey ?? setupDataFromState?.ownerKey;
    const ownerType = setupDataFromMeta?.ownerType ?? setupDataFromState?.ownerType;

    return {
        matchID,
        gameName: metadata.gameName || 'tictactoe',
        players: playersArray,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        roomName,
        ownerKey,
        ownerType,
    };
};

const fetchLobbyMatch = async (matchID: string): Promise<LobbyMatch | null> => {
    try {
        const match = await db.fetch(matchID, { metadata: true, state: true });
        if (!match || !match.metadata) return null;
        // 从游戏状态 G.__setupData 中读取房间名与 owner 信息
        const setupData = match.state?.G?.__setupData as { roomName?: string; ownerKey?: string; ownerType?: 'user' | 'guest' } | undefined;
        const roomName = setupData?.roomName;
        return buildLobbyMatch(matchID, match.metadata, roomName, setupData);
    } catch (error) {
        console.error(`[LobbyIO] 获取房间 ${matchID} 失败:`, error);
        return null;
    }
};

// 获取指定游戏的房间列表
const fetchMatchesByGame = async (gameName: SupportedGame): Promise<LobbyMatch[]> => {
    try {
        const results: LobbyMatch[] = [];

        const matchIDs = await db.listMatches({ gameName });
        for (const matchID of matchIDs) {
            const match = await db.fetch(matchID, { metadata: true, state: true });
            if (!match || !match.metadata) continue;
            // 从游戏状态 G.__setupData 中读取房间名与 owner 信息
            const setupData = match.state?.G?.__setupData as { roomName?: string; ownerKey?: string; ownerType?: 'user' | 'guest' } | undefined;
            const roomName = setupData?.roomName;
            results.push(buildLobbyMatch(matchID, match.metadata, roomName, setupData));
        }
        return results;
    } catch (error) {
        console.error(`[LobbyIO] 获取房间列表失败(${gameName}):`, error);
        return [];
    }
};

const getLobbyRoomName = (gameName: SupportedGame) => `${LOBBY_ROOM}:${gameName}`;

const ensureGameState = (gameName: SupportedGame) => {
    if (!lobbySubscribersByGame.has(gameName)) lobbySubscribersByGame.set(gameName, new Set());
    if (!lobbyCacheByGame.has(gameName)) lobbyCacheByGame.set(gameName, new Map());
    if (!lobbyCacheReadyByGame.has(gameName)) lobbyCacheReadyByGame.set(gameName, false);
    if (!lobbySnapshotTimerByGame.has(gameName)) lobbySnapshotTimerByGame.set(gameName, null);
    if (!lobbyVersionByGame.has(gameName)) lobbyVersionByGame.set(gameName, 0);
};

SUPPORTED_GAMES.forEach(gameName => ensureGameState(gameName));

const syncLobbyCache = async (gameName: SupportedGame): Promise<LobbyMatch[]> => {
    ensureGameState(gameName);
    const matches = await fetchMatchesByGame(gameName);
    const cache = lobbyCacheByGame.get(gameName)!;
    cache.clear();
    matches.forEach(match => {
        cache.set(match.matchID, match);
        matchGameIndex.set(match.matchID, gameName);
    });
    lobbyCacheReadyByGame.set(gameName, true);
    return matches;
};

const markLobbyCacheDirty = (gameName: SupportedGame) => {
    ensureGameState(gameName);
    lobbyCacheReadyByGame.set(gameName, false);
};

const getLobbySnapshot = async (gameName: SupportedGame): Promise<LobbyMatch[]> => {
    ensureGameState(gameName);
    const ready = lobbyCacheReadyByGame.get(gameName);
    if (ready) {
        return Array.from(lobbyCacheByGame.get(gameName)!.values());
    }
    return syncLobbyCache(gameName);
};

const sendLobbySnapshot = async (socket: IOSocket, gameName: SupportedGame) => {
    ensureGameState(gameName);
    const wasReady = lobbyCacheReadyByGame.get(gameName) ?? false;
    const matches = await getLobbySnapshot(gameName);
    const version = wasReady ? (lobbyVersionByGame.get(gameName) ?? 0) : bumpLobbyVersion(gameName);
    const payload: LobbySnapshotPayload = { version, matches };
    socket.emit(LOBBY_EVENTS.LOBBY_UPDATE, payload);
};

const emitToLobby = (gameName: SupportedGame, event: string, payload: unknown) => {
    ensureGameState(gameName);
    const subscribers = lobbySubscribersByGame.get(gameName)!;
    if (!lobbyIO || subscribers.size === 0) return;
    lobbyIO.to(getLobbyRoomName(gameName)).emit(event, payload);
};

const emitMatchCreated = (gameName: SupportedGame, match: LobbyMatch) => {
    ensureGameState(gameName);
    lobbyCacheByGame.get(gameName)!.set(match.matchID, match);
    matchGameIndex.set(match.matchID, gameName);
    const payload: LobbyMatchPayload = { version: bumpLobbyVersion(gameName), match };
    emitToLobby(gameName, LOBBY_EVENTS.MATCH_CREATED, payload);
};

const emitMatchUpdated = (gameName: SupportedGame, match: LobbyMatch) => {
    ensureGameState(gameName);
    lobbyCacheByGame.get(gameName)!.set(match.matchID, match);
    matchGameIndex.set(match.matchID, gameName);
    const payload: LobbyMatchPayload = { version: bumpLobbyVersion(gameName), match };
    emitToLobby(gameName, LOBBY_EVENTS.MATCH_UPDATED, payload);
};

const emitMatchEnded = (gameName: SupportedGame, matchID: string) => {
    ensureGameState(gameName);
    lobbyCacheByGame.get(gameName)!.delete(matchID);
    matchGameIndex.delete(matchID);
    const payload: LobbyMatchEndedPayload = { version: bumpLobbyVersion(gameName), matchID };
    emitToLobby(gameName, LOBBY_EVENTS.MATCH_ENDED, payload);
};

const emitLobbyHeartbeat = () => {
    if (!lobbyIO) return;

    for (const gameName of SUPPORTED_GAMES) {
        ensureGameState(gameName);
        const subscribers = lobbySubscribersByGame.get(gameName)!;
        if (subscribers.size === 0) continue;
        const payload: LobbyHeartbeatPayload = {
            version: lobbyVersionByGame.get(gameName) ?? 0,
            timestamp: Date.now(),
        };
        lobbyIO.to(getLobbyRoomName(gameName)).emit(LOBBY_EVENTS.HEARTBEAT, payload);
    }
};

const startLobbyHeartbeat = () => {
    if (lobbyHeartbeatTimer) return;
    lobbyHeartbeatTimer = setInterval(emitLobbyHeartbeat, LOBBY_HEARTBEAT_INTERVAL);
};

const broadcastLobbySnapshot = async (gameName: SupportedGame, reason: string) => {
    ensureGameState(gameName);
    const subscribers = lobbySubscribersByGame.get(gameName)!;
    if (!lobbyIO || subscribers.size === 0) return;
    const matches = await syncLobbyCache(gameName);
    const payload: LobbySnapshotPayload = { version: bumpLobbyVersion(gameName), matches };
    lobbyIO.to(getLobbyRoomName(gameName)).emit(LOBBY_EVENTS.LOBBY_UPDATE, payload);
};

const scheduleLobbySnapshot = (gameName: SupportedGame, reason: string) => {
    ensureGameState(gameName);
    const subscribers = lobbySubscribersByGame.get(gameName)!;
    if (!lobbyIO || subscribers.size === 0) return;

    const existingTimer = lobbySnapshotTimerByGame.get(gameName);
    if (existingTimer) return;

    const timer = setTimeout(() => {
        lobbySnapshotTimerByGame.set(gameName, null);
        void broadcastLobbySnapshot(gameName, reason);
    }, 200);
    lobbySnapshotTimerByGame.set(gameName, timer);
};

const resolveGameFromUrl = (raw?: string): SupportedGame | null => {
    const normalized = normalizeGameName(raw);
    if (!normalized) return null;
    if (!isSupportedGame(normalized)) return null;
    return normalized;
};

const resolveGameFromMatch = (match: LobbyMatch | null): SupportedGame | null => {
    const normalized = normalizeGameName(match?.gameName);
    if (!normalized) return null;
    if (!isSupportedGame(normalized)) return null;
    return normalized;
};

const handleMatchCreated = async (matchID?: string, gameNameFromUrl?: string) => {
    if (matchID) {
        void attachMatchIdToState(matchID);
    }
    const gameFromUrl = resolveGameFromUrl(gameNameFromUrl);
    if (gameFromUrl && lobbySubscribersByGame.get(gameFromUrl)?.size === 0) {
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
    if ((lobbySubscribersByGame.get(game)?.size ?? 0) === 0) {
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
    if (gameFromUrl && lobbySubscribersByGame.get(gameFromUrl)?.size === 0) {
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
    if ((lobbySubscribersByGame.get(game)?.size ?? 0) === 0) {
        markLobbyCacheDirty(game);
        return;
    }

    if (!match) {
        scheduleLobbySnapshot(game, `join: 获取房间失败 ${matchID}`);
        return;
    }

    const cache = lobbyCacheByGame.get(game)!;
    if (cache.has(matchID)) {
        emitMatchUpdated(game, match);
    } else {
        emitMatchCreated(game, match);
    }
};

const handleMatchLeft = async (matchID?: string, gameNameFromUrl?: string) => {
    const gameFromUrl = resolveGameFromUrl(gameNameFromUrl);
    if (gameFromUrl && lobbySubscribersByGame.get(gameFromUrl)?.size === 0) {
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
    if ((lobbySubscribersByGame.get(game)?.size ?? 0) === 0) {
        markLobbyCacheDirty(game);
        return;
    }

    if (match) {
        emitMatchUpdated(game, match);
        return;
    }

    emitMatchEnded(game, matchID);
};

// Leaderboard API
app.use(async (ctx, next) => {
    if (ctx.method === 'GET' && ctx.path.match(/^\/games\/[^/]+\/leaderboard$/)) {
        const gameNameMatch = ctx.path.match(/^\/games\/([^/]+)\/leaderboard$/);
        const gameName = gameNameMatch ? gameNameMatch[1] : null;

        if (!gameName) {
            ctx.status = 400;
            ctx.body = { error: 'Invalid game name' };
            return;
        }

        try {
            // Aggregate wins
            const records = await MatchRecord.find({ gameName });

            // Simple leaderboard: Count wins per player
            const stats: Record<string, { name: string, wins: number, matches: number }> = {};

            records.forEach(record => {
                if (record.winnerID) {
                    const winner = record.players.find(p => p.id === record.winnerID);
                    if (winner) {
                        if (!stats[winner.id]) stats[winner.id] = { name: winner.name, wins: 0, matches: 0 };
                        stats[winner.id].wins++;
                    }
                }

                record.players.forEach(p => {
                    if (!stats[p.id]) stats[p.id] = { name: p.name, wins: 0, matches: 0 };
                    stats[p.id].matches++;
                    // Update name if more recent? Keep simple for now.
                    if (p.name && !stats[p.id].name) stats[p.id].name = p.name;
                });
            });

            // Convert to array and sort
            const leaderboard = Object.values(stats)
                .sort((a, b) => b.wins - a.wins)
                .slice(0, 50); // Top 50

            ctx.body = { leaderboard };
        } catch (err) {
            console.error('Leaderboard error:', err);
            ctx.status = 500;
            ctx.body = { error: 'Internal Server Error' };
        }
        return;
    }
    await next();
});

// 添加中间件拦截 Lobby API 调用来触发广播
app.use(async (ctx, next) => {
    await next();

    // 检测 Lobby API 调用后触发广播
    const url = ctx.url;
    const method = ctx.method;

    if (method === 'POST') {
        // 创建房间: POST /games/:name/create
        if (url.match(/^\/games\/[^/]+\/create$/)) {
            console.log('[LobbyIO] 检测到房间创建');
            const responseBody = ctx.body as { matchID?: string } | undefined;
            const matchID = responseBody?.matchID;
            const gameName = url.match(/^\/games\/([^/]+)\/create$/)?.[1];
            setTimeout(() => {
                void handleMatchCreated(matchID, gameName);
            }, 100); // 短暂延迟确保数据已写入
        }
        // 加入房间: POST /games/:name/:matchID/join
        else if (url.match(/^\/games\/[^/]+\/[^/]+\/join$/)) {
            console.log('[LobbyIO] 检测到玩家加入');
            const matchIDMatch = url.match(/^\/games\/([^/]+)\/([^/]+)\/join$/);
            const gameName = matchIDMatch ? matchIDMatch[1] : undefined;
            const matchID = matchIDMatch ? matchIDMatch[2] : undefined;
            setTimeout(() => {
                void handleMatchJoined(matchID, gameName);
            }, 100);
        }
        // 离开房间: POST /games/:name/:matchID/leave
        else if (url.match(/^\/games\/[^/]+\/[^/]+\/leave$/)) {
            console.log('[LobbyIO] 检测到玩家离开');
            const matchIDMatch = url.match(/^\/games\/([^/]+)\/([^/]+)\/leave$/);
            const gameName = matchIDMatch ? matchIDMatch[1] : undefined;
            const matchID = matchIDMatch ? matchIDMatch[2] : undefined;
            setTimeout(() => {
                void handleMatchLeft(matchID, gameName);
            }, 100);
        }
    }
});


// 启动服务器
server.run(GAME_SERVER_PORT).then(async (runningServers) => {
    // 连接 MongoDB
    await connectDB();

    // 如果使用持久化存储，连接存储后端
    if (USE_PERSISTENT_STORAGE) {
        await mongoStorage.connect();
        // 定时清理"不保存"的空房间（每 5 分钟）
        setInterval(async () => {
            try {
                const cleaned = await mongoStorage.cleanupEmptyMatches();
                if (cleaned > 0) {
                    for (const gameName of SUPPORTED_GAMES) {
                        void broadcastLobbySnapshot(gameName, 'cleanupEmptyMatches');
                    }
                }
            } catch (err) {
                console.error('[MongoStorage] 清理空房间失败:', err);
            }
        }, 5 * 60 * 1000);
    }

    console.log(`🎮 游戏服务器运行在 http://localhost:${GAME_SERVER_PORT}`);

    // 注意：boardgame.io 在 /default 路径下运行自己的 socket.io
    // 我们在这里创建一个独立的大厅 Socket.IO 服务器，挂载在同一个 HTTP 服务器上
    // 使用不同的路径 /lobby-socket 以避免与 boardgame.io 的默认 socket 冲突
    lobbyIO = new IOServer(runningServers.appServer, {
        path: '/lobby-socket',
        cors: {
            origin: LOBBY_CORS_ORIGINS,
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // 处理大厅连接
    lobbyIO.on('connection', (socket) => {
        console.log(`[LobbyIO] 新连接: ${socket.id}`);

        // 订阅大厅更新请求
        socket.on(LOBBY_EVENTS.SUBSCRIBE_LOBBY, async (payload?: { gameId?: string }) => {
            const requestedGame = normalizeGameName(payload?.gameId);
            if (!requestedGame || !isSupportedGame(requestedGame)) {
                console.warn(`[LobbyIO] ${socket.id} 订阅大厅失败：非法 gameId`, payload?.gameId);
                return;
            }

            const prevGame = socket.data.lobbyGameId as SupportedGame | undefined;
            if (prevGame && prevGame !== requestedGame) {
                lobbySubscribersByGame.get(prevGame)?.delete(socket.id);
                socket.leave(getLobbyRoomName(prevGame));
            }

            socket.data.lobbyGameId = requestedGame;
            ensureGameState(requestedGame);
            lobbySubscribersByGame.get(requestedGame)!.add(socket.id);
            socket.join(getLobbyRoomName(requestedGame));
            console.log(`[LobbyIO] ${socket.id} 订阅大厅(${requestedGame}) (当前 ${lobbySubscribersByGame.get(requestedGame)!.size} 个订阅者)`);

            // 立即发送当前房间列表（仅当前游戏）
            await sendLobbySnapshot(socket, requestedGame);
            startLobbyHeartbeat();
        });

        // 取消订阅请求
        socket.on(LOBBY_EVENTS.UNSUBSCRIBE_LOBBY, () => {
            const gameName = socket.data.lobbyGameId as SupportedGame | undefined;
            if (gameName) {
                lobbySubscribersByGame.get(gameName)?.delete(socket.id);
                socket.leave(getLobbyRoomName(gameName));
            }
            socket.data.lobbyGameId = undefined;
            console.log(`[LobbyIO] ${socket.id} 取消订阅`);
        });

        // 断开连接时的清理逻辑
        socket.on('disconnect', () => {
            const gameName = socket.data.lobbyGameId as SupportedGame | undefined;
            if (gameName) {
                lobbySubscribersByGame.get(gameName)?.delete(socket.id);
                socket.leave(getLobbyRoomName(gameName));
            }
            socket.data.lobbyGameId = undefined;

            // 清理重赛订阅
            const matchId = socket.data.rematchMatchId as string | undefined;
            if (matchId) {
                matchSubscribers.get(matchId)?.delete(socket.id);
                socket.leave(`rematch:${matchId}`);
            }
            socket.data.rematchMatchId = undefined;
            socket.data.rematchPlayerId = undefined;

            console.log(`[LobbyIO] ${socket.id} 断开连接`);
        });

        // ========== 重赛投票事件处理 ==========

        // 加入对局房间（订阅重赛状态）
        socket.on(REMATCH_EVENTS.JOIN_MATCH, (payload?: { matchId?: string; playerId?: string }) => {
            const { matchId, playerId } = payload || {};
            if (!matchId || !playerId) {
                console.warn(`[RematchIO] ${socket.id} 加入对局失败：缺少 matchId 或 playerId`);
                return;
            }

            // 离开之前的对局
            const prevMatchId = socket.data.rematchMatchId as string | undefined;
            if (prevMatchId && prevMatchId !== matchId) {
                matchSubscribers.get(prevMatchId)?.delete(socket.id);
                socket.leave(`rematch:${prevMatchId}`);
            }

            // 加入新对局
            socket.data.rematchMatchId = matchId;
            socket.data.rematchPlayerId = playerId;
            if (!matchSubscribers.has(matchId)) {
                matchSubscribers.set(matchId, new Set());
            }
            matchSubscribers.get(matchId)!.add(socket.id);
            socket.join(`rematch:${matchId}`);

            // 确保有投票状态
            if (!rematchStateByMatch.has(matchId)) {
                rematchStateByMatch.set(matchId, { votes: {}, ready: false, revision: 0 });
            }

            // 发送当前状态
            const state = rematchStateByMatch.get(matchId)!;
            socket.emit(REMATCH_EVENTS.STATE_UPDATE, state);

            console.log(`[RematchIO] ${socket.id} 加入对局 ${matchId} (玩家 ${playerId})`);
        });

        // 离开对局房间
        socket.on(REMATCH_EVENTS.LEAVE_MATCH, () => {
            const matchId = socket.data.rematchMatchId as string | undefined;
            if (matchId) {
                matchSubscribers.get(matchId)?.delete(socket.id);
                socket.leave(`rematch:${matchId}`);

                // 如果没有订阅者了，清理状态
                if (matchSubscribers.get(matchId)?.size === 0) {
                    matchSubscribers.delete(matchId);
                    rematchStateByMatch.delete(matchId);
                }
            }
            socket.data.rematchMatchId = undefined;
            socket.data.rematchPlayerId = undefined;
            console.log(`[RematchIO] ${socket.id} 离开对局`);
        });

        // 调试用：广播新房间 URL
        socket.on(REMATCH_EVENTS.DEBUG_NEW_ROOM, (data?: { url?: string }) => {
            const matchId = socket.data.rematchMatchId as string | undefined;
            if (!matchId) {
                console.warn(`[RematchIO] ${socket.id} 广播新房间失败：未加入对局`);
                return;
            }
            if (!data?.url) {
                console.warn(`[RematchIO] ${socket.id} 广播新房间失败：缺少 URL`);
                return;
            }
            // 广播给房间内的其他玩家（不包括发送者）
            socket.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.DEBUG_NEW_ROOM, data);
        });

        // 投票重赛
        socket.on(REMATCH_EVENTS.VOTE, () => {
            const matchId = socket.data.rematchMatchId as string | undefined;
            const playerId = socket.data.rematchPlayerId as string | undefined;
            if (!matchId || !playerId) {
                console.warn(`[RematchIO] ${socket.id} 投票失败：未加入对局`);
                return;
            }

            const state = rematchStateByMatch.get(matchId);
            if (!state) {
                console.warn(`[RematchIO] ${socket.id} 投票失败：对局状态不存在`);
                return;
            }

            // 如果已经 ready，不再接受投票
            if (state.ready) {
                console.log(`[RematchIO] ${socket.id} 投票忽略：已准备重开`);
                return;
            }

            // 切换投票状态（toggle）
            const currentVote = state.votes[playerId] ?? false;
            state.votes[playerId] = !currentVote;

            // 检查是否双方都已投票
            const votedPlayers = Object.entries(state.votes).filter(([, v]) => v).map(([p]) => p);
            state.ready = votedPlayers.length >= 2;
            state.revision += 1;

            console.log(`[RematchIO] ${socket.id} 投票: ${playerId} -> ${state.votes[playerId]}, ready=${state.ready}, revision=${state.revision}`);

            // 广播状态更新
            lobbyIO?.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.STATE_UPDATE, state);

            // 如果双方都已投票，通知房主触发 reset
            if (state.ready) {
                lobbyIO?.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.TRIGGER_RESET);
                // 重置投票状态，为下一局做准备
                setTimeout(() => {
                    const currentState = rematchStateByMatch.get(matchId);
                    if (currentState) {
                        currentState.votes = {};
                        currentState.ready = false;
                        currentState.revision += 1;
                        lobbyIO?.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.STATE_UPDATE, currentState);
                    }
                }, 1000);
            }
        });
    });

    console.log('📡 大厅广播服务已启动 (path: /lobby-socket)');
});
