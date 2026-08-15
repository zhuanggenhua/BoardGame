/**
 * 游戏服务器入口
 *
 * Koa + socket.io 架构：
 * - REST 路由：create/join/leave/destroy/claim-seat/getMatch/leaderboard
 * - /game namespace：GameTransportServer（游戏状态同步）
 * - /lobby-socket：大厅事件（保持不变）
 * - 默认 namespace：重赛/聊天（保持不变）
 */

import 'dotenv/config';
import http from 'node:http';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { Server as IOServer, Socket as IOSocket } from 'socket.io';
import msgpackParser from 'socket.io-msgpack-parser';
import { nanoid } from 'nanoid';
import { connectDB } from './src/server/db';
import { sanitizeChatText } from './src/server/chatUtils';
import { MAX_CHAT_MESSAGES } from './src/shared/chat';
import {
    LOBBY_ALL,
    LOBBY_EVENTS,
} from './src/shared/lobby';
import { MatchRecord } from './src/server/models/MatchRecord';
import { GAME_SERVER_MANIFEST } from './src/games/manifest.server';
import { GAME_STATE_VALIDATORS } from './src/games/stateValidators';
import { mongoStorage } from './src/server/storage/MongoStorage';
import { hybridStorage } from './src/server/storage/HybridStorage';
import { runStartupCleanupTasks, type StartupCleanupTask } from './src/server/storage/startupCleanup';
import { createClaimSeatHandler, claimSeatUtils } from './src/server/claimSeat';
import { evaluateEmptyRoomJoinGuard } from './src/server/joinGuard';
import { areAllSeatsOccupied, hasOccupiedPlayers, isSeatOccupied, isSupportedPlayerCount } from './src/server/matchOccupancy';
import { resolveAllowedPlayerCountsForGame } from './src/shared/roomSetup';
import {
    createMatchWithOwnerConflictRetry,
    decideDuplicateOwnerRoomAction,
    DUPLICATE_OWNER_DISCONNECT_GRACE_MS,
    planDuplicateOwnerRoomCreate,
} from './src/server/duplicateOwnerRooms';
import { applyRematchVoteToggle, resolveRematchPlayerGroups } from './src/server/rematch';
import {
    createMatchEmoteRateLimiter,
    type MatchEmoteRejectReason,
    resolveMatchEmoteJoinDecision,
    resolveMatchEmoteSendDecision,
} from './src/server/matchEmotes';
import { createLobbyCoordinator } from './src/server/lobbyCoordinator';
import { buildUgcServerGames } from './src/server/ugcRegistration';
import { GameTransportServer } from './src/engine/transport/server';
import { shouldRefreshPublicRoomSummaryAfterCommand } from './src/games/serverLobbySummary';
import { isGameEmoteAllowed } from './src/games/emotes';
import { getAiSeatIds } from './src/engine/ai';
import type { GameEngineConfig } from './src/engine/transport/server';
import type { ClaimSeatMetadataInput, MatchMetadata, MatchStorage } from './src/engine/transport/storage';
import { buildMatchDetailPayload } from './src/server/lobbyMatch';
import logger, { gameLogger } from './server/logger';
import { createTrainingDataRecorderFromEnv } from './server/trainingDataRecorder';
import { requestLogger, errorHandler } from './server/middleware/logging';
import { buildLeaderboardEntries } from './src/server/leaderboard';

const REMATCH_EVENTS = {
    JOIN_MATCH: 'rematch:join',
    LEAVE_MATCH: 'rematch:leave',
    VOTE: 'rematch:vote',
    STATE_UPDATE: 'rematch:stateUpdate',
    TRIGGER_RESET: 'rematch:triggerReset',
    DEBUG_NEW_ROOM: 'debug:newRoom',
} as const;

const MATCH_CHAT_EVENTS = {
    JOIN: 'matchChat:join',
    LEAVE: 'matchChat:leave',
    SEND: 'matchChat:send',
    MESSAGE: 'matchChat:message',
    HISTORY: 'matchChat:history',
} as const;

const MATCH_EMOTE_EVENTS = {
    JOIN: 'matchEmote:join',
    LEAVE: 'matchEmote:leave',
    SEND: 'matchEmote:send',
    SHOW: 'matchEmote:show',
    ERROR: 'matchEmote:error',
} as const;

// ============================================================================
// 重赛投票状态
// ============================================================================

interface RematchVoteState {
    votes: Record<string, boolean>;
    ready: boolean;
    revision: number;
}
const rematchStateByMatch = new Map<string, RematchVoteState>();
const matchSubscribers = new Map<string, Set<string>>();

const normalizeRematchPlayerIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return [...new Set(
        value
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map((item) => item.trim()),
    )];
};

const resolveAutoAcceptedRematchPlayerIds = async (
    matchID: string,
    requestedPlayerIds: unknown,
): Promise<string[]> => {
    const requested = normalizeRematchPlayerIds(requestedPlayerIds);
    if (requested.length === 0) return [];

    try {
        const result = await storage.fetch(matchID, { metadata: true });
        const setupData = result.metadata?.setupData && typeof result.metadata.setupData === 'object' && !Array.isArray(result.metadata.setupData)
            ? result.metadata.setupData as { seatControllers?: Record<string, { type?: unknown } | undefined> }
            : undefined;
        const aiSeatIds = new Set(getAiSeatIds(setupData?.seatControllers));
        return requested.filter((playerId) => aiSeatIds.has(playerId));
    } catch (error) {
        logger.warn('[RematchIO] 自动同意 AI 座位校验失败', {
            matchID,
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
};

const scheduleRematchStateReset = (matchId: string): void => {
    setTimeout(() => {
        const currentState = rematchStateByMatch.get(matchId);
        if (currentState) {
            currentState.votes = {};
            currentState.ready = false;
            currentState.revision += 1;
            lobbySocketIO.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.STATE_UPDATE, currentState);
        }
    }, 1000);
};

const updateRematchReady = (state: RematchVoteState): void => {
    const votedPlayers = Object.entries(state.votes).filter(([, v]) => v).map(([p]) => p);
    state.ready = votedPlayers.length >= 2;
};

// 对局聊天历史缓存（内存，对局结束后自动清理）
interface ChatHistoryMessage {
    id: string;
    matchId: string;
    senderId?: string;
    senderName: string;
    text: string;
    createdAt: string;
}
const chatHistoryByMatch = new Map<string, ChatHistoryMessage[]>();

interface MatchEmotePayload {
    matchId: string;
    playerId: string;
    emoteId: string;
    createdAt: string;
}

const matchEmoteRateLimiter = createMatchEmoteRateLimiter();

const emitMatchEmoteError = (
    socket: IOSocket,
    reason: MatchEmoteRejectReason,
    ack?: (response: { ok: false; reason: MatchEmoteRejectReason }) => void,
) => {
    const response = { ok: false as const, reason };
    socket.emit(MATCH_EMOTE_EVENTS.ERROR, response);
    ack?.(response);
};

const resolvePlayableMatchEmoteContext = async (
    matchId: string,
    playerId: string,
): Promise<{ metadata: MatchMetadata; gameId: string } | { reason: Exclude<MatchEmoteRejectReason, 'missing_payload' | 'invalid_emote' | 'rate_limited' | 'not_joined'> }> => {
    const result = await storage.fetch(matchId, { metadata: true });
    const metadata = result.metadata;
    const decision = resolveMatchEmoteJoinDecision(metadata, playerId);
    if (!decision.ok) {
        return { reason: decision.reason };
    }

    return {
        metadata,
        gameId: decision.gameId,
    };
};

// ============================================================================
// 游戏注册
// ============================================================================

const ENABLED_GAME_ENTRIES = GAME_SERVER_MANIFEST.filter(
    (entry) => entry.manifest.type === 'game' && entry.manifest.enabled
);

const SUPPORTED_GAMES: string[] = [];
type SupportedGame = string;

const normalizeGameName = (name?: string) => (name || '').toLowerCase();
const isSupportedGame = (gameName: string): gameName is SupportedGame => {
    return (SUPPORTED_GAMES as readonly string[]).includes(gameName);
};

const registerSupportedGames = (gameIds: string[]) => {
    const normalized = gameIds.map((id) => normalizeGameName(id)).filter((id) => id.length > 0);
    SUPPORTED_GAMES.splice(0, SUPPORTED_GAMES.length, ...normalized);
};

// ============================================================================
// 环境配置
// ============================================================================

const isProd = process.env.NODE_ENV === 'production';
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    if (isProd) {
        throw new Error('[Server] JWT_SECRET 必须在生产环境配置');
    }
    JWT_SECRET = 'boardgame-secret-key-change-in-production';
    logger.warn('[Server] JWT_SECRET 未配置，使用开发默认值');
}

const RAW_WEB_ORIGINS = (process.env.WEB_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const DEFAULT_APP_WEB_ORIGINS = [
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
] as const;

const RAW_APP_WEB_ORIGINS = (process.env.APP_WEB_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const DEV_CORS_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'http://localhost:6174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:6174',
];

const APP_CORS_ORIGINS = RAW_APP_WEB_ORIGINS.length > 0
    ? RAW_APP_WEB_ORIGINS
    : [...DEFAULT_APP_WEB_ORIGINS];
const CORS_ORIGINS = Array.from(new Set([
    ...(RAW_WEB_ORIGINS.length > 0 ? RAW_WEB_ORIGINS : DEV_CORS_ORIGINS),
    ...APP_CORS_ORIGINS,
]));
const isDevLoopbackOrigin = (origin?: string) => !isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin ?? '');
const isAllowedCorsOrigin = (origin?: string) => {
    if (!origin) return true;
    return CORS_ORIGINS.includes(origin) || isDevLoopbackOrigin(origin);
};
const USE_PERSISTENT_STORAGE = process.env.USE_PERSISTENT_STORAGE !== 'false';
const GAME_SERVER_PORT = Number(process.env.GAME_SERVER_PORT) || 18000;
const SOCKET_IO_ALLOW_POLLING = process.env.SOCKET_IO_ALLOW_POLLING;
const SOCKET_IO_SERVER_TRANSPORTS =
    SOCKET_IO_ALLOW_POLLING === 'true'
        ? ['websocket', 'polling']
        : SOCKET_IO_ALLOW_POLLING === 'false'
            ? ['websocket']
            : process.env.NODE_ENV === 'production'
                ? ['websocket']
                : ['websocket', 'polling'];
const TRAINING_DATA_MIN_COMPLETED_MATCH_DURATION_MS = (() => {
    const raw = process.env.TRAINING_DATA_MIN_COMPLETED_MATCH_DURATION_MS
        ?? process.env.TRAINING_DATA_MIN_MATCH_DURATION_MS;
    if (!raw) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
})();

// ============================================================================
// 归档逻辑
// ============================================================================

const storage: MatchStorage = hybridStorage;

type OwnerMatchLookupStorage = {
    findMatchesByOwnerKey: (ownerKey: string) => Promise<Array<{ matchID: string; gameName: string }>>;
};

const supportsOwnerMatchLookup = (value: MatchStorage): value is MatchStorage & OwnerMatchLookupStorage => {
    return typeof (value as Partial<OwnerMatchLookupStorage>).findMatchesByOwnerKey === 'function';
};

const archiveMatchResult = async ({
    matchID,
    gameName,
    gameover,
}: {
    matchID: string;
    gameName: string;
    gameover?: { winner?: string | number };
}) => {
    if (!USE_PERSISTENT_STORAGE) {
        return;
    }

    try {
        const existing = await MatchRecord.findOne({ matchID });
        if (existing) return;

        const { metadata, state: storedState } = await storage.fetch(matchID, { metadata: true, state: true });
        const winnerSeatID = gameover?.winner !== undefined ? String(gameover.winner) : undefined;
        const resultType = winnerSeatID ? 'win' : 'draw';

        const setupData = metadata?.setupData && typeof metadata.setupData === 'object' && !Array.isArray(metadata.setupData)
            ? metadata.setupData as { seatControllers?: Record<string, { type?: unknown } | undefined> }
            : undefined;
        const aiSeatIds = new Set(getAiSeatIds(setupData?.seatControllers));

        const players: Array<{ id: string; name: string; result: string; ownerKey?: string; isAi?: boolean }> = [];
        let winnerOwnerKey: string | undefined;
        if (metadata?.players) {
            for (const [seatId, pdata] of Object.entries(metadata.players)) {
                const name = pdata?.name || `Player ${seatId}`;
                const ownerKey = pdata?.ownerKey;
                // 用 ownerKey 作为真实 ID，fallback 到 name
                const playerId = ownerKey || name;
                const isWinner = seatId === winnerSeatID;
                if (isWinner) winnerOwnerKey = playerId;
                players.push({
                    id: playerId,
                    name,
                    ownerKey,
                    isAi: aiSeatIds.has(seatId),
                    result: isWinner ? 'win' : resultType === 'draw' ? 'draw' : 'loss',
                });
            }
        }

        // 从最终状态中提取操作日志
        const matchState = storedState?.G as { sys?: { actionLog?: { entries?: unknown[] } } } | undefined;
        const actionLog = matchState?.sys?.actionLog?.entries ?? undefined;

        await MatchRecord.create({
            matchID,
            gameName,
            players,
            winnerID: winnerOwnerKey,
            actionLog,
            createdAt: new Date(metadata?.createdAt || Date.now()),
            endedAt: new Date(),
        });
        logger.info(`[Archive] 归档对局 matchID=${matchID}`);
    } catch (err) {
        logger.error('[Archive] 归档失败:', err);
    }
};

// ============================================================================
// 构建游戏引擎配置
// ============================================================================

const buildServerEngines = async (): Promise<{ engines: GameEngineConfig[]; gameIds: string[] }> => {
    const engines: GameEngineConfig[] = [];
    const manifestGameIds = new Set<string>();
    const gameIds: string[] = [];

    for (const entry of ENABLED_GAME_ENTRIES) {
        const { manifest, engineConfig } = entry;
        const normalizedId = normalizeGameName(manifest.id);
        if (manifestGameIds.has(normalizedId)) {
            throw new Error(`[GameManifest] 游戏 ID 重复: ${manifest.id}`);
        }
        manifestGameIds.add(normalizedId);
        gameIds.push(normalizedId);

        // 直接使用 engineConfig（不再从 __adapterConfig 提取）
        engines.push(engineConfig);
    }

    if (USE_PERSISTENT_STORAGE) {
        // 纯内存模式不依赖 Mongo，跳过 UGC 数据库查询，保证无库也能起服务。
        const { engineConfigs: ugcEngines, gameIds: ugcGameIds } = await buildUgcServerGames({
            existingGameIds: manifestGameIds,
        });
        ugcEngines.forEach((cfg) => engines.push(cfg));
        ugcGameIds.forEach((id) => gameIds.push(id));
    }

    return { engines, gameIds };
};

// ============================================================================
// 初始化
// ============================================================================

if (USE_PERSISTENT_STORAGE) {
    await connectDB();
} else {
    logger.info('[GameServer] 当前以纯内存模式启动，跳过 Mongo / UGC / 排行榜归档');
}
const { engines: SERVER_ENGINES, gameIds: SERVER_GAME_IDS } = await buildServerEngines();
const SERVER_GAME_MANIFEST_BY_ID = Object.fromEntries(
    GAME_SERVER_MANIFEST.map(({ manifest }) => [manifest.id, manifest]),
);
registerSupportedGames(SERVER_GAME_IDS);

// 创建 Koa 应用
const app = new Koa();

// 全局错误处理（必须在所有中间件之前）
app.use(errorHandler);

// 请求日志
app.use(requestLogger);

const httpServer = http.createServer(app.callback());

// 创建 socket.io 服务器（统一实例，多 namespace）
// 使用 MessagePack 序列化替代 JSON，减少 20-30% 传输体积
const io = new IOServer(httpServer, {
    parser: msgpackParser,
    transports: SOCKET_IO_SERVER_TRANSPORTS,
    cors: {
        origin: (origin, callback) => {
            if (isAllowedCorsOrigin(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`CORS: origin ${origin ?? 'unknown'} not allowed`));
        },
        methods: ['GET', 'POST'],
        credentials: true,
    },
    // 心跳配置：适当放宽以减少后台标签页的误断线
    // 默认 pingInterval=25s + pingTimeout=20s = 45s 断线
    // 调整为 pingInterval=30s + pingTimeout=60s = 90s 断线
    // 给后台标签页更多缓冲时间（Chrome 节流 timer 到 1 次/分钟）
    pingInterval: 30000,
    pingTimeout: 60000,
    // WebSocket 帧压缩：在 msgpack 基础上再压缩 60-70%（重复字段名/结构）
    // 限制窗口大小以控制内存开销（每连接约 15KB 而非默认 32KB）
    perMessageDeflate: {
        threshold: 1024,       // 超过 1KB 才压缩，避免小消息反而变大
        zlibDeflateOptions: { windowBits: 13 },  // 8KB 窗口（默认 15 = 32KB）
        zlibInflateOptions: { windowBits: 13 },
    },
});

// 创建游戏传输服务器
const trainingDataRecorder = createTrainingDataRecorderFromEnv(process.env);

const gameTransport = new GameTransportServer({
    io,
    storage,
    games: SERVER_ENGINES,
    gameManifests: SERVER_GAME_MANIFEST_BY_ID,
    trainingDataRecorder,
    trainingDataMinCompletedMatchDurationMs: TRAINING_DATA_MIN_COMPLETED_MATCH_DURATION_MS,
    rulesVersion: process.env.npm_package_version ?? null,
    offlineGraceMs: 300000, // 5 分钟：给断线玩家充足的重连时间
    authenticate: async (matchID, playerID, credentials, metadata) => {
        if (!credentials) return false;
        const playerMeta = metadata.players[playerID];
        if (!playerMeta?.credentials) return false;
        return playerMeta.credentials === credentials;
    },
    onGameOver: (matchID, gameName, gameover) => {
        // 记录游戏结束日志
        const winner = gameover?.winner !== undefined ? String(gameover.winner) : null;
        gameLogger.matchEnded(matchID, gameName, winner, 0); // duration 需要从 metadata 计算
        
        // 归档对局结果
        void archiveMatchResult({ matchID, gameName, gameover: gameover as { winner?: string | number } });
        // 通知大厅更新（房间仍存在，标记为 gameover，大厅列表显示为已结束）
        const game = normalizeGameName(gameName);
        if (game && isSupportedGame(game)) {
            lobbyCoordinator.scheduleLobbySnapshot(game, `gameover: ${matchID}`);
        }
    },
    onCommandSucceeded: (matchID, gameName, commandType) => {
        const game = normalizeGameName(gameName);
        if (game && isSupportedGame(game) && shouldRefreshPublicRoomSummaryAfterCommand(game, commandType)) {
            lobbyCoordinator.scheduleLobbySnapshot(game, `command:${commandType}:${matchID}`);
        }
    },
});

const lobbyCoordinator = createLobbyCoordinator<SupportedGame>({
    storage,
    supportedGames: SUPPORTED_GAMES,
    isSupportedGame,
    normalizeGameName,
    logger,
});

// claim-seat handler
const claimSeatHandler = createClaimSeatHandler({
    db: {
        fetch: async (matchID: string, opts: { metadata?: boolean; state?: boolean }) => {
            const result = await storage.fetch(matchID, opts);
            return result as unknown as { metadata?: unknown; state?: unknown };
        },
        setMetadata: async (matchID: string, metadata: unknown) => {
            await storage.setMetadata(matchID, metadata as MatchMetadata);
        },
        claimSeatMetadata: async (matchID: string, input: ClaimSeatMetadataInput) => {
            return await storage.claimSeatMetadata(matchID, input);
        },
    } as unknown as Parameters<typeof createClaimSeatHandler>[0]['db'],
    auth: {
        generateCredentials: () => nanoid(21),
    },
    jwtSecret: JWT_SECRET,
});

// ============================================================================
// CORS 中间件
// ============================================================================

app.use(async (ctx, next) => {
    const requestOrigin = ctx.get('origin');
    const allowedOrigins = new Set(CORS_ORIGINS);
    const isDevOrigin = !isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(requestOrigin);

    if (requestOrigin && (allowedOrigins.has(requestOrigin) || isDevOrigin)) {
        ctx.set('Access-Control-Allow-Origin', requestOrigin);
        ctx.set('Vary', 'Origin');
        ctx.set('Access-Control-Allow-Credentials', 'true');
    }

    ctx.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    ctx.set(
        'Access-Control-Allow-Headers',
        ctx.get('access-control-request-headers') || 'Content-Type, Authorization',
    );

    if (ctx.method === 'OPTIONS') {
        ctx.status = 204;
        return;
    }

    await next();
});

// 全局错误处理中间件（必须在所有业务中间件之前）
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        const status = (err as { status?: number }).status ?? 500;
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        ctx.status = status;
        ctx.body = { error: message };
        // 非 4xx 错误打印日志
        if (status >= 500) {
            logger.error(`[Server] ${ctx.method} ${ctx.path} → ${status}:`, message);
        }
    }
});

// Body parser（全局启用）
app.use(bodyParser());

// ============================================================================
// 辅助函数
// ============================================================================

const resolveOwnerFromRequest = (
    ctx: Koa.Context,
    setupData: Record<string, unknown>,
    requestedPlayerName?: string,
): { ownerKey: string; ownerType: 'user' | 'guest'; ownerName?: string } => {
    const authHeader = ctx.get('authorization');
    const rawToken = claimSeatUtils.parseBearerToken(authHeader);
    const payload = rawToken ? claimSeatUtils.verifyGameToken(rawToken, JWT_SECRET) : null;
    const normalizedRequestedPlayerName = typeof requestedPlayerName === 'string' && requestedPlayerName.trim()
        ? requestedPlayerName.trim()
        : undefined;

    if (rawToken && !payload?.userId) {
        ctx.throw(401, 'Invalid token');
        return { ownerKey: 'user:invalid', ownerType: 'user' };
    }
    if (payload?.userId) {
        return {
            ownerKey: `user:${payload.userId}`,
            ownerType: 'user',
            ownerName: normalizedRequestedPlayerName ?? (payload.username?.trim() || undefined),
        };
    }

    const guestId =
        typeof setupData.guestId === 'string' && setupData.guestId.trim()
            ? setupData.guestId.trim()
            : undefined;
    if (!guestId) {
        ctx.throw(400, 'guestId is required');
        return { ownerKey: 'guest:invalid', ownerType: 'guest' };
    }
    return {
        ownerKey: `guest:${guestId}`,
        ownerType: 'guest',
        ownerName: normalizedRequestedPlayerName,
    };
};

const resolveOwnerKeyFromMetadata = (metadata?: MatchMetadata | null): string | undefined => {
    const setupData = metadata?.setupData as { ownerKey?: string } | undefined;
    return setupData?.ownerKey;
};

const isEmptyRoomByMetadata = (metadata?: MatchMetadata | null): boolean => {
    if (!metadata?.players) return false;
    return !hasOccupiedPlayers(metadata.players as Record<string, { name?: string; credentials?: string; isConnected?: boolean | null }>);
};

const resolveJoinSeat = (
    players: MatchMetadata['players'],
    requestedPlayerID?: string,
): { playerID?: string; reason?: 'player_not_found' | 'seat_occupied' | 'room_full' } => {
    if (requestedPlayerID) {
        const requestedSeat = players[requestedPlayerID];
        if (!requestedSeat) {
            return { reason: 'player_not_found' };
        }
        if (isSeatOccupied(requestedSeat)) {
            return { reason: 'seat_occupied' };
        }
        return { playerID: requestedPlayerID };
    }

    const openSeat = Object.entries(players)
        .sort(([a], [b]) => Number(a) - Number(b))
        .find(([, seat]) => !isSeatOccupied(seat));

    if (!openSeat) {
        return { reason: 'room_full' };
    }

    return { playerID: openSeat[0] };
};

type MatchCreateSetupData = Record<string, unknown> & {
    ownerKey: string;
    ownerType: 'user' | 'guest';
    firstPlayerId?: string;
    turnOrder?: string[];
    prevMatchID?: string;
};

const cleanupMatchRoom = async (
    matchID: string,
    metadata?: MatchMetadata | null,
    emitRemoval = false,
): Promise<boolean> => {
    const unloaded = gameTransport.unloadMatch(matchID, { disconnectSockets: true });
    await storage.wipe(matchID);

    const game = normalizeGameName(metadata?.gameName);
    if (emitRemoval && game && isSupportedGame(game)) {
        lobbyCoordinator.emitMatchEnded(game, matchID);
    } else {
        lobbyCoordinator.forgetLobbyMatch(matchID);
    }

    matchSubscribers.delete(matchID);
    rematchStateByMatch.delete(matchID);
    chatHistoryByMatch.delete(matchID);

    return unloaded || Boolean(metadata);
};

const cleanupMissingOwnerRoom = async (
    matchID: string,
    metadata?: MatchMetadata | null,
    context?: string,
    emitRemoval = false,
): Promise<boolean> => {
    if (!isEmptyRoomByMetadata(metadata)) return false;
    const ownerKey = resolveOwnerKeyFromMetadata(metadata);
    if (ownerKey) return false;

    await cleanupMatchRoom(matchID, metadata, emitRemoval);
    logger.warn(`[RoomCleanup] reason=missing_owner context=${context ?? 'unknown'} matchID=${matchID}`);
    return true;
};

// ============================================================================
// REST 路由
// ============================================================================

import Router from '@koa/router';
const router = new Router();

// GET /games — 健康检查端点（用于 E2E 测试）
router.get('/games', async (ctx) => {
    ctx.body = { 
        status: 'ok', 
        games: SUPPORTED_GAMES,
        timestamp: Date.now()
    };
});

// POST /games/:name/create — 创建对局
router.get('/internal/rooms', async (ctx) => {
    const requestedGame = typeof ctx.query.gameName === 'string'
        ? normalizeGameName(ctx.query.gameName)
        : '';

    if (requestedGame) {
        if (!isSupportedGame(requestedGame)) {
            ctx.throw(400, `Game ${ctx.query.gameName} not found`);
        }
        ctx.body = { items: await lobbyCoordinator.getLobbySnapshot(requestedGame) };
        return;
    }

    ctx.body = { items: await lobbyCoordinator.getLobbySnapshotAll() };
});

router.delete('/internal/rooms/:matchID', async (ctx) => {
    const matchID = String(ctx.params.matchID || '').trim();
    if (!matchID) {
        ctx.throw(400, 'Missing matchID');
    }

    const { metadata } = await storage.fetch(matchID, { metadata: true });
    const deleted = await cleanupMatchRoom(matchID, metadata, true);
    ctx.body = { deleted, matchID };
});

router.post('/internal/rooms/bulk-delete', async (ctx) => {
    const body = ctx.request.body as { ids?: unknown } | undefined;
    const ids = Array.isArray(body?.ids)
        ? body.ids
            .filter((value): value is string => typeof value === 'string')
            .map(value => value.trim())
            .filter(Boolean)
        : [];
    const uniqueIds = Array.from(new Set(ids));

    let deleted = 0;
    for (const matchID of uniqueIds) {
        const { metadata } = await storage.fetch(matchID, { metadata: true });
        const ok = await cleanupMatchRoom(matchID, metadata, true);
        if (ok) {
            deleted++;
        }
    }

    ctx.body = { requested: uniqueIds.length, deleted };
});

router.post('/games/:name/create', async (ctx) => {
    const gameName = normalizeGameName(ctx.params.name);
    if (!gameName || !isSupportedGame(gameName)) {
        ctx.throw(404, `Game ${ctx.params.name} not found`);
    }

    const gameEntry = GAME_SERVER_MANIFEST.find((entry) => normalizeGameName(entry.manifest.id) === gameName);
    const gameEngine = gameEntry?.engineConfig;

    const body = ctx.request.body as Record<string, unknown> | undefined;
    const numPlayers = Number(body?.numPlayers ?? 2);
    // 当前策略：默认不自动删除活跃旧房，只有前端确认后才带 forceReplaceOwnerRoom 重试。
    const forceReplaceOwnerRoom = body?.forceReplaceOwnerRoom === true;
    const requestedOwnerName = typeof body?.playerName === 'string' && body.playerName.trim()
        ? body.playerName.trim()
        : undefined;
    const rawSetupData =
        body?.setupData && typeof body.setupData === 'object'
            ? (body.setupData as Record<string, unknown>)
            : {};
    const minPlayers = gameEngine?.minPlayers ?? 2;
    const maxPlayers = gameEngine?.maxPlayers ?? 2;
    const playerOptions = resolveAllowedPlayerCountsForGame({
        gameManifest: gameEntry?.manifest,
        setupData: rawSetupData,
    });
    if (!isSupportedPlayerCount(numPlayers, minPlayers, maxPlayers, playerOptions)) {
        ctx.throw(400, 'Invalid numPlayers');
    }
    const { ownerKey, ownerType, ownerName } = resolveOwnerFromRequest(ctx, rawSetupData, requestedOwnerName);
    const setupData: MatchCreateSetupData = { ...rawSetupData, ownerKey, ownerType };

    const matchID = nanoid(11);
    const seed = nanoid(16);
    const playerIds = Array.from({ length: numPlayers }, (_, i) => String(i));

    // 清理客户端不应直接控制的先手字段（只允许通过 prevMatchID 间接设置）
    delete setupData.firstPlayerId;
    delete setupData.turnOrder;

    // 重赛先手轮换：从上一局状态中提取先手信息
    if (typeof setupData.prevMatchID === 'string') {
        try {
            const prevMatch = await storage.fetch(setupData.prevMatchID, { state: true });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 跨游戏通用提取，state 结构不固定
            const prevCore = (prevMatch.state as any)?.G?.core;
            if (prevCore) {
                // 双人：轮换先手；多人：随机打乱顺序
                if (numPlayers === 2) {
                    // 通用提取：activePlayerId / currentPlayer / turnOrder[0]
                    const prev = prevCore.startingPlayerId ?? prevCore.activePlayerId ?? prevCore.currentPlayer
                        ?? (Array.isArray(prevCore.turnOrder) ? prevCore.turnOrder[0] : undefined);
                    if (typeof prev === 'string') {
                        // 下一局先手 = 上一局非先手玩家
                        const next = playerIds.find(id => id !== prev) ?? playerIds[0];
                        setupData.firstPlayerId = next;
                    }
                } else {
                    // 多人：随机打乱 playerIds 顺序作为 turnOrder 提示
                    const shuffled = [...playerIds];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    setupData.turnOrder = shuffled;
                }
            }
        } catch {
            // 上一局不存在或已过期，忽略
        }
        delete setupData.prevMatchID;
    }

    if (ownerKey) {
        const ownerMatches = supportsOwnerMatchLookup(storage)
            ? await storage.findMatchesByOwnerKey(ownerKey)
            : [];

        if (ownerMatches.length > 0) {
            const existingMatches = await Promise.all(ownerMatches.map(async (match) => {
                const { metadata: existingMetadata } = await storage.fetch(match.matchID, { metadata: true });
                return {
                    ...match,
                    metadata: existingMetadata,
                    decision: decideDuplicateOwnerRoomAction(existingMetadata, {
                        disconnectGraceMs: DUPLICATE_OWNER_DISCONNECT_GRACE_MS,
                    }),
                };
            }));

            const createPlan = planDuplicateOwnerRoomCreate(existingMatches, {
                forceReplaceActive: forceReplaceOwnerRoom,
            });

            if (createPlan.action === 'block') {
                const activeMatch = createPlan.activeMatch;
                logger.info('duplicate_owner_room_blocked', {
                    ownerKey,
                    ownerType: ownerType ?? 'unknown',
                    matchID: activeMatch.matchID,
                    gameName: activeMatch.gameName,
                    reason: activeMatch.decision.reason,
                    canForceReplace: true,
                });
                ctx.status = 409;
                ctx.body = {
                    error: 'ACTIVE_MATCH_EXISTS',
                    gameName: activeMatch.gameName,
                    matchID: activeMatch.matchID,
                    canForceReplace: true,
                };
                return;
            }

            const cleanableMatches = createPlan.cleanupMatches;
            if (cleanableMatches.length > 0) {
                logger.info(forceReplaceOwnerRoom ? 'force_cleanup_duplicate_owner_rooms' : 'cleanup_duplicate_owner_rooms', {
                    ownerKey,
                    ownerType: ownerType ?? 'unknown',
                    count: cleanableMatches.length,
                    matches: cleanableMatches.map((match) => ({
                        matchID: match.matchID,
                        gameName: match.gameName,
                        reason: match.decision.reason,
                    })),
                });

                await Promise.all(cleanableMatches.map(async (match) => {
                    await cleanupMatchRoom(match.matchID, match.metadata, true);
                }));
            }
        }
    }

    // 初始化游戏状态
    const setupResult = await gameTransport.setupMatch(matchID, gameName, playerIds, seed, setupData);
    if (!setupResult) {
        ctx.throw(500, 'Failed to setup match');
        return;
    }
    const { state: initialState, randomCursor } = setupResult;

    // 构建 metadata（每个座位包含 id 字段）
    const players: Record<string, { id: number; name?: string; credentials?: string; isConnected?: boolean; ownerKey?: string }> = {};
    for (let i = 0; i < playerIds.length; i++) {
        players[playerIds[i]] = { id: i };
    }

    const metadata: MatchMetadata = {
        gameName,
        players,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        setupData,
        status: 'waiting',
    };
    metadata.players['0'] = {
        ...metadata.players['0'],
        ownerKey,
    };

    let ownerCredentials: string | undefined;
    if (ownerName) {
        ownerCredentials = nanoid(21);
        metadata.players['0'] = {
            ...metadata.players['0'],
            name: ownerName,
            credentials: ownerCredentials,
            isConnected: false,
        };
    }

    const createMatchData = {
        initialState: {
            G: initialState,
            _stateID: 0,
            randomSeed: seed,
            randomCursor,
        },
        metadata,
    };
    const createPersistResult = await createMatchWithOwnerConflictRetry({
        createMatch: async () => {
            await storage.createMatch(matchID, createMatchData);
        },
        fetchConflictMetadata: async (conflictMatchID) => {
            const { metadata: conflictMetadata } = await storage.fetch(conflictMatchID, { metadata: true });
            return conflictMetadata;
        },
        cleanupConflictMatch: async (conflictMatchID, conflictMetadata) => {
            await cleanupMatchRoom(conflictMatchID, conflictMetadata, true);
        },
        forceReplaceActive: forceReplaceOwnerRoom,
        onForceCleanup: async ({ attempt, conflict }) => {
            logger.info('force_cleanup_duplicate_owner_rooms_race', {
                ownerKey,
                ownerType: ownerType ?? 'unknown',
                matchID: conflict.matchID,
                gameName: conflict.gameName,
                attempt,
            });
        },
    });
    if (createPersistResult.action === 'conflict') {
        ctx.status = 409;
        ctx.body = {
            error: 'ACTIVE_MATCH_EXISTS',
            gameName: createPersistResult.conflict.gameName,
            matchID: createPersistResult.conflict.matchID,
            canForceReplace: true,
        };
        return;
    }

    ctx.body = {
        matchID,
        ownerPlayerID: ownerCredentials ? '0' : undefined,
        ownerCredentials,
    };

    setTimeout(() => void lobbyCoordinator.handleMatchCreated(matchID, gameName), 100);
});

// POST /games/:name/:matchID/join — 加入对局
router.post('/games/:name/:matchID/join', async (ctx) => {
    const gameName = normalizeGameName(ctx.params.name);
    const matchID = ctx.params.matchID;

    const body = ctx.request.body as {
        playerID?: string;
        playerName?: string;
        data?: Record<string, unknown>;
    } | undefined;

    const requestedPlayerID = typeof body?.playerID === 'string' && body.playerID.trim()
        ? body.playerID.trim()
        : undefined;
    const playerName = body?.playerName;

    if (!playerName?.trim()) {
        ctx.throw(403, 'playerName is required');
        return;
    }

    const result = await storage.fetch(matchID, { state: true, metadata: true });
    if (!result.metadata) {
        ctx.throw(404, `Match ${matchID} not found`);
        return;
    }

    // 密码校验
    const setupData = result.metadata.setupData as { password?: string } | undefined;
    const roomPassword = setupData?.password;
    const password = body?.data?.password;
    if (roomPassword && roomPassword !== password) {
        ctx.throw(403, 'Incorrect password');
        return;
    }

    // 空房间加入守卫
    const guestId = typeof body?.data?.guestId === 'string' ? body.data.guestId : undefined;
    const guard = evaluateEmptyRoomJoinGuard({
        metadata: result.metadata as unknown as Parameters<typeof evaluateEmptyRoomJoinGuard>[0]['metadata'],
        state: result.state as unknown as Parameters<typeof evaluateEmptyRoomJoinGuard>[0]['state'],
        authHeader: ctx.get('authorization'),
        guestId,
        jwtSecret: JWT_SECRET,
    });
    if (!guard.allowed) {
        if (guard.reason === 'missing_owner') {
            const cleaned = await cleanupMissingOwnerRoom(matchID, result.metadata, 'join', true);
            if (cleaned) {
                ctx.throw(404, 'Match not found');
                return;
            }
        }
        ctx.throw(guard.status ?? 403, guard.message ?? 'Only match owner can rejoin');
        return;
    }

    const latestMetadataForJoin = (await storage.fetch(matchID, { metadata: true })).metadata ?? result.metadata;

    // 分配凭证时必须基于最新 metadata，避免旧 join 请求把其它 seat 的最新信息覆回去。
    const joinSeat = resolveJoinSeat(latestMetadataForJoin.players, requestedPlayerID);
    if (!joinSeat.playerID) {
        if (joinSeat.reason === 'player_not_found') {
            ctx.throw(404, `Player ${requestedPlayerID} not found`);
            return;
        }
        if (joinSeat.reason === 'seat_occupied') {
            ctx.throw(409, `Seat ${requestedPlayerID} is occupied`);
            return;
        }
        ctx.throw(409, 'Room is full');
        return;
    }

    const playerID = joinSeat.playerID;
    const credentials = nanoid(21);
    const metadata = latestMetadataForJoin;

    // 解析真实用户标识
    const authHeader = ctx.get('authorization');
    const rawToken = claimSeatUtils.parseBearerToken(authHeader);
    const jwtPayload = rawToken ? claimSeatUtils.verifyGameToken(rawToken, JWT_SECRET) : null;
    let playerOwnerKey: string | undefined;
    if (jwtPayload?.userId) {
        playerOwnerKey = `user:${jwtPayload.userId}`;
    } else if (guestId) {
        playerOwnerKey = `guest:${guestId}`;
    }

    metadata.players[playerID] = {
        ...metadata.players[playerID],
        name: playerName.trim(),
        credentials,
        ...(playerOwnerKey ? { ownerKey: playerOwnerKey } : {}),
    };
    metadata.updatedAt = Date.now();

    // 状态机：所有座位都有玩家时，从 waiting → playing
    if (metadata.status === 'waiting' || !metadata.status) {
        if (areAllSeatsOccupied(metadata.players)) {
            metadata.status = 'playing';
        }
    }

    await storage.setMetadata(matchID, metadata);
    gameTransport.updateMatchMetadata(matchID, metadata);

    ctx.body = { playerID, playerCredentials: credentials };

    setTimeout(() => void lobbyCoordinator.handleMatchJoined(matchID, gameName), 100);
});

// POST /games/:name/:matchID/leave — 离开对局（释放座位）
router.post('/games/:name/:matchID/leave', async (ctx) => {
    const gameName = normalizeGameName(ctx.params.name);
    const matchID = ctx.params.matchID;

    const body = ctx.request.body as { playerID?: string; credentials?: string } | undefined;
    const playerID = body?.playerID;
    const credentials = body?.credentials;

    if (!playerID) {
        ctx.throw(403, 'playerID is required');
        return;
    }
    if (!credentials) {
        ctx.throw(403, 'credentials is required');
        return;
    }

    const result = await storage.fetch(matchID, { metadata: true });
    if (!result.metadata) {
        ctx.throw(404, `Match ${matchID} not found`);
        return;
    }

    const metadata = (await storage.fetch(matchID, { metadata: true })).metadata ?? result.metadata;
    const playerMeta = metadata.players[playerID];
    if (!playerMeta) {
        ctx.throw(404, `Player ${playerID} not found`);
        return;
    }

    // 验证凭证
    if (playerMeta.credentials !== credentials) {
        ctx.throw(403, 'Invalid credentials');
        return;
    }

    // 清除占位（只释放座位，不删除房间）
    delete playerMeta.name;
    delete playerMeta.credentials;
    playerMeta.isConnected = false;
    metadata.updatedAt = Date.now();

    // 状态机：玩家离座后，如果游戏未结束则回退到 waiting
    if (metadata.status === 'playing' || metadata.status === 'waiting' || !metadata.status) {
        if (!metadata.gameover) {
            metadata.status = 'waiting';
        }
    }

    await storage.setMetadata(matchID, metadata);
    gameTransport.updateMatchMetadata(matchID, metadata);
    // 离座后立即撤销该 seat 的实时连接权限，避免旧连接继续接收私有视图。
    gameTransport.disconnectPlayer(matchID, playerID, { disconnectSockets: true });

    ctx.body = {};

    setTimeout(() => void lobbyCoordinator.handleMatchLeft(matchID, gameName), 100);
});

// POST /games/:name/:matchID/destroy — 销毁对局
router.post('/games/:name/:matchID/destroy', async (ctx) => {
    const matchID = ctx.params.matchID;

    const body = ctx.request.body as { playerID?: string; credentials?: string } | undefined;
    const playerID = body?.playerID;
    const credentials = body?.credentials;

    if (!playerID) {
        ctx.throw(403, 'playerID is required');
        return;
    }
    if (!credentials) {
        ctx.throw(403, 'credentials is required');
        return;
    }

    const result = await storage.fetch(matchID, { metadata: true });
    if (!result.metadata) {
        ctx.throw(404, `Match ${matchID} not found`);
        return;
    }

    const playerMeta = result.metadata.players[playerID];
    if (!playerMeta) {
        ctx.throw(404, `Player ${playerID} not found`);
        return;
    }
    if (playerMeta.credentials !== credentials) {
        ctx.throw(403, 'Invalid credentials');
        return;
    }

    await storage.wipe(matchID);
    gameTransport.unloadMatch(matchID, { disconnectSockets: true });

    const game = normalizeGameName(result.metadata.gameName);
    if (game && isSupportedGame(game)) {
        lobbyCoordinator.emitMatchEnded(game, matchID);
    }
    matchSubscribers.delete(matchID);
    rematchStateByMatch.delete(matchID);
    chatHistoryByMatch.delete(matchID);

    ctx.body = {};
});

// POST /games/:name/:matchID/claim-seat — 占座
router.post('/games/:name/:matchID/claim-seat', async (ctx) => {
    const matchID = ctx.params.matchID;
    const gameName = normalizeGameName(ctx.params.name);
    await claimSeatHandler(ctx as unknown as Parameters<typeof claimSeatHandler>[0], matchID);

    if (ctx.status === 200 || !ctx.status) {
        const refreshed = await storage.fetch(matchID, { metadata: true });
        if (refreshed.metadata) {
            const metadata = refreshed.metadata;
            // claim-seat is used by room creation and host-owned AI seat recovery.
            // Keep the same occupancy state transition as /join so 4p rooms with
            // AI seats do not remain in waiting after all seats have credentials.
            if ((metadata.status === 'waiting' || !metadata.status) && areAllSeatsOccupied(metadata.players)) {
                metadata.status = 'playing';
                metadata.updatedAt = Date.now();
                await storage.setMetadata(matchID, metadata);
            }
            gameTransport.updateMatchMetadata(matchID, metadata);
        }
        setTimeout(() => void lobbyCoordinator.handleMatchJoined(matchID, gameName), 50);
    }
});

// GET /games/:name/leaderboard — 排行榜（必须在 :matchID 通配路由之前注册）
router.get('/games/:name/leaderboard', async (ctx) => {
    const gameName = normalizeGameName(ctx.params.name);
    if (!USE_PERSISTENT_STORAGE) {
        ctx.body = { leaderboard: [] };
        return;
    }

    try {
        const records = await MatchRecord.find({ gameName });

        ctx.body = {
            leaderboard: buildLeaderboardEntries(records),
        };
    } catch (err) {
        logger.error('Leaderboard error:', err);
        ctx.status = 500;
        ctx.body = { error: 'Internal Server Error' };
    }
});

// GET /games/:name/:matchID — 获取对局信息
router.get('/games/:name/:matchID', async (ctx) => {
    const matchID = ctx.params.matchID;

    // 排除已知的子路由（create 由 POST 处理，此处防止 GET 误匹配）
    if (matchID === 'create') {
        return;
    }

    const result = await storage.fetch(matchID, { metadata: true });
    if (!result.metadata) {
        ctx.throw(404, `Match ${matchID} not found`);
        return;
    }

    ctx.body = buildMatchDetailPayload(matchID, result.metadata);
});

app.use(router.routes());
app.use(router.allowedMethods());

// 测试路由（仅在测试/开发环境启用）
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    const { createTestRoutes } = await import('./src/server/routes/test.js');
    const testRouter = createTestRoutes(gameTransport, storage, GAME_STATE_VALIDATORS);
    app.use(testRouter.routes());
    app.use(testRouter.allowedMethods());
    logger.info('[Server] 测试模式已启用 - Test API endpoints available at /test/*');
}

// ============================================================================
// 大厅 Socket 连接处理
// ============================================================================

// 创建独立的大厅 Socket.IO 服务器（使用 /lobby-socket 路径，与客户端 lobbySocket.ts 一致）
// 使用 MessagePack 序列化替代 JSON，减少传输体积
const lobbySocketIO = new IOServer(httpServer, {
    parser: msgpackParser,
    path: '/lobby-socket',
    transports: SOCKET_IO_SERVER_TRANSPORTS,
    cors: {
        origin: (origin, callback) => {
            if (isAllowedCorsOrigin(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`CORS: origin ${origin ?? 'unknown'} not allowed`));
        },
        methods: ['GET', 'POST'],
        credentials: true,
    },
    perMessageDeflate: {
        threshold: 1024,
        zlibDeflateOptions: { windowBits: 13 },
        zlibInflateOptions: { windowBits: 13 },
    },
});
lobbyCoordinator.attachIO(lobbySocketIO);

lobbySocketIO.on('connection', (socket) => {
    logger.debug(`[LobbyIO] 新连接: ${socket.id}`);

    // 订阅大厅更新
    socket.on(LOBBY_EVENTS.SUBSCRIBE_LOBBY, async (payload?: { gameId?: string }) => {
        const requestedGame = normalizeGameName(payload?.gameId);
        if (!requestedGame) {
            logger.warn(`[LobbyIO] ${socket.id} 订阅大厅失败：非法 gameId`, payload?.gameId);
            return;
        }

        if (requestedGame === LOBBY_ALL) {
            const { isNew, subscriberCount } = lobbyCoordinator.addLobbySubscription(socket, LOBBY_ALL);
            if (isNew) {
                logger.info(`[LobbyIO] ${socket.id} 订阅大厅(${LOBBY_ALL}) (当前 ${subscriberCount} 个订阅者)`);
            } else {
                logger.debug(`[LobbyIO] ${socket.id} 刷新大厅(${LOBBY_ALL})`);
            }
            await lobbyCoordinator.sendLobbySnapshotAll(socket);
            lobbyCoordinator.startLobbyHeartbeat();
            return;
        }

        if (!isSupportedGame(requestedGame)) {
            logger.warn(`[LobbyIO] ${socket.id} 订阅大厅失败：非法 gameId`, payload?.gameId);
            return;
        }

        const { isNew, subscriberCount } = lobbyCoordinator.addLobbySubscription(socket, requestedGame);
        if (isNew) {
            logger.info(`[LobbyIO] ${socket.id} 订阅大厅(${requestedGame}) (当前 ${subscriberCount} 个订阅者)`);
        } else {
            logger.debug(`[LobbyIO] ${socket.id} 刷新大厅(${requestedGame})`);
        }

        await lobbyCoordinator.sendLobbySnapshot(socket, requestedGame);
        lobbyCoordinator.startLobbyHeartbeat();
    });

    // 取消订阅
    socket.on(LOBBY_EVENTS.UNSUBSCRIBE_LOBBY, (payload?: { gameId?: string }) => {
        const requestedGame = normalizeGameName(payload?.gameId);

        if (!requestedGame) {
            lobbyCoordinator.clearLobbySubscriptions(socket);
            logger.info(`[LobbyIO] ${socket.id} 取消全部订阅`);
            return;
        }

        const gameId = requestedGame === LOBBY_ALL ? LOBBY_ALL : requestedGame;
        lobbyCoordinator.removeLobbySubscription(socket, gameId);
        logger.debug(`[LobbyIO] ${socket.id} 取消订阅 ${gameId}`);
    });

    // 断开连接清理
    socket.on('disconnect', () => {
        lobbyCoordinator.clearLobbySubscriptions(socket);

        // 清理重赛订阅
        const matchId = socket.data.rematchMatchId as string | undefined;
        if (matchId) {
            matchSubscribers.get(matchId)?.delete(socket.id);
            socket.leave(`rematch:${matchId}`);
        }
        socket.data.rematchMatchId = undefined;
        socket.data.rematchPlayerId = undefined;

        // 清理聊天订阅
        const chatMatchId = socket.data.chatMatchId as string | undefined;
        if (chatMatchId) {
            socket.leave(`matchchat:${chatMatchId}`);
        }
        socket.data.chatMatchId = undefined;

        // 清理局内座位表情订阅
        const emoteMatchId = socket.data.emoteMatchId as string | undefined;
        if (emoteMatchId) {
            socket.leave(`matchemote:${emoteMatchId}`);
        }
        socket.data.emoteMatchId = undefined;
        socket.data.emotePlayerId = undefined;

        logger.debug(`[LobbyIO] ${socket.id} 断开连接`);
    });

    // ========== 重赛投票事件处理 ==========

    socket.on(REMATCH_EVENTS.JOIN_MATCH, async (payload?: { matchId?: string; playerId?: string; autoAcceptedPlayerIds?: unknown }) => {
        const { matchId, playerId } = payload || {};
        if (!matchId || !playerId) {
            logger.warn(`[RematchIO] ${socket.id} 加入对局失败：缺少 matchId 或 playerId`);
            return;
        }

        const prevMatchId = socket.data.rematchMatchId as string | undefined;
        if (prevMatchId && prevMatchId !== matchId) {
            matchSubscribers.get(prevMatchId)?.delete(socket.id);
            socket.leave(`rematch:${prevMatchId}`);
        }

        socket.data.rematchMatchId = matchId;
        socket.data.rematchPlayerId = playerId;
        if (!matchSubscribers.has(matchId)) {
            matchSubscribers.set(matchId, new Set());
        }
        matchSubscribers.get(matchId)!.add(socket.id);
        socket.join(`rematch:${matchId}`);

        if (!rematchStateByMatch.has(matchId)) {
            rematchStateByMatch.set(matchId, { votes: {}, ready: false, revision: 0 });
        }

        const state = rematchStateByMatch.get(matchId)!;
        const autoAcceptedPlayerIds = await resolveAutoAcceptedRematchPlayerIds(matchId, payload?.autoAcceptedPlayerIds);
        socket.data.rematchAutoAcceptedPlayerIds = autoAcceptedPlayerIds;
        socket.emit(REMATCH_EVENTS.STATE_UPDATE, state);
        logger.info(`[RematchIO] ${socket.id} 加入对局 ${matchId} (玩家 ${playerId})，登记 AI 自动同意席位=${autoAcceptedPlayerIds.join(',') || 'none'}`);
    });

    socket.on(REMATCH_EVENTS.LEAVE_MATCH, () => {
        const matchId = socket.data.rematchMatchId as string | undefined;
        if (matchId) {
            matchSubscribers.get(matchId)?.delete(socket.id);
            socket.leave(`rematch:${matchId}`);
            if (matchSubscribers.get(matchId)?.size === 0) {
                matchSubscribers.delete(matchId);
                rematchStateByMatch.delete(matchId);
                chatHistoryByMatch.delete(matchId);
            }
        }
        socket.data.rematchMatchId = undefined;
        socket.data.rematchPlayerId = undefined;
        socket.data.rematchAutoAcceptedPlayerIds = undefined;
        logger.info(`[RematchIO] ${socket.id} 离开对局`);
    });

    socket.on(REMATCH_EVENTS.DEBUG_NEW_ROOM, (data?: { url?: string }) => {
        const matchId = socket.data.rematchMatchId as string | undefined;
        if (!matchId || !data?.url) return;
        socket.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.DEBUG_NEW_ROOM, data);
    });

    socket.on(REMATCH_EVENTS.VOTE, async () => {
        const matchId = socket.data.rematchMatchId as string | undefined;
        const playerId = socket.data.rematchPlayerId as string | undefined;
        if (!matchId || !playerId) return;

        const state = rematchStateByMatch.get(matchId);
        if (!state || state.ready) return;
        const autoAcceptedPlayerIds = normalizeRematchPlayerIds(socket.data.rematchAutoAcceptedPlayerIds);
        const matchResult = await storage.fetch(matchId, { metadata: true });
        const nextState = applyRematchVoteToggle(state, {
            playerId,
            autoAcceptedPlayerIds,
            playerGroups: resolveRematchPlayerGroups(matchResult.metadata),
        });
        state.votes = nextState.votes;

        const wasReady = state.ready;
        state.ready = nextState.ready;
        state.revision += 1;

        logger.info(`[RematchIO] ${socket.id} 投票: ${playerId} -> ${state.votes[playerId]}, ready=${state.ready}, autoAcceptedAi=${autoAcceptedPlayerIds.join(',') || 'none'}`);

        lobbySocketIO.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.STATE_UPDATE, state);

        if (!wasReady && state.ready) {
            lobbySocketIO.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.TRIGGER_RESET);
            scheduleRematchStateReset(matchId);
        }
    });

    // ========== 对局聊天事件处理 ==========

    socket.on(MATCH_CHAT_EVENTS.JOIN, (payload?: { matchId?: string }) => {
        const matchId = payload?.matchId;
        if (!matchId) return;

        const prevMatchId = socket.data.chatMatchId as string | undefined;
        if (prevMatchId && prevMatchId !== matchId) {
            socket.leave(`matchchat:${prevMatchId}`);
        }

        socket.data.chatMatchId = matchId;
        socket.join(`matchchat:${matchId}`);
        logger.info(`[MatchChat] ${socket.id} 加入对局聊天 ${matchId}`);

        // 回推历史消息
        const history = chatHistoryByMatch.get(matchId);
        if (history && history.length > 0) {
            socket.emit(MATCH_CHAT_EVENTS.HISTORY, history);
        }
    });

    socket.on(MATCH_CHAT_EVENTS.LEAVE, () => {
        const matchId = socket.data.chatMatchId as string | undefined;
        if (matchId) {
            socket.leave(`matchchat:${matchId}`);
        }
        socket.data.chatMatchId = undefined;
    });

    socket.on(MATCH_CHAT_EVENTS.SEND, (payload?: { text?: string; senderId?: string; senderName?: string }) => {
        const matchId = socket.data.chatMatchId as string | undefined;
        if (!matchId) return;

        const text = sanitizeChatText(payload?.text ?? '');
        if (!text) return;

        const senderName = String(payload?.senderName ?? '玩家');
        const senderId = payload?.senderId ? String(payload.senderId) : undefined;

        const message: ChatHistoryMessage = {
            id: nanoid(),
            matchId,
            senderId,
            senderName,
            text,
            createdAt: new Date().toISOString(),
        };

        // 缓存到历史记录
        let history = chatHistoryByMatch.get(matchId);
        if (!history) {
            history = [];
            chatHistoryByMatch.set(matchId, history);
        }
        history.push(message);
        // 超过上限时裁剪旧消息
        if (history.length > MAX_CHAT_MESSAGES) {
            chatHistoryByMatch.set(matchId, history.slice(-MAX_CHAT_MESSAGES));
        }

        lobbySocketIO.to(`matchchat:${matchId}`).emit(MATCH_CHAT_EVENTS.MESSAGE, message);
    });

    // ========== 对局座位表情事件处理 ==========

    socket.on(MATCH_EMOTE_EVENTS.JOIN, async (
        payload?: { matchId?: string; playerId?: string },
        ack?: (response: { ok: boolean; reason?: MatchEmoteRejectReason }) => void,
    ) => {
        const matchId = payload?.matchId?.trim();
        const playerId = payload?.playerId?.trim();
        if (!matchId || !playerId) {
            emitMatchEmoteError(socket, 'missing_payload', ack);
            return;
        }

        try {
            const context = await resolvePlayableMatchEmoteContext(matchId, playerId);
            if ('reason' in context) {
                emitMatchEmoteError(socket, context.reason, ack);
                return;
            }

            const prevMatchId = socket.data.emoteMatchId as string | undefined;
            if (prevMatchId && prevMatchId !== matchId) {
                socket.leave(`matchemote:${prevMatchId}`);
            }

            socket.data.emoteMatchId = matchId;
            socket.data.emotePlayerId = playerId;
            socket.join(`matchemote:${matchId}`);
            ack?.({ ok: true });
            logger.info(`[MatchEmote] ${socket.id} 加入对局表情 ${matchId} (玩家 ${playerId})`);
        } catch (error) {
            logger.warn('[MatchEmote] 加入表情房间失败', {
                socketId: socket.id,
                matchId,
                playerId,
                error: error instanceof Error ? error.message : String(error),
            });
            emitMatchEmoteError(socket, 'match_not_found', ack);
        }
    });

    socket.on(MATCH_EMOTE_EVENTS.LEAVE, () => {
        const matchId = socket.data.emoteMatchId as string | undefined;
        if (matchId) {
            socket.leave(`matchemote:${matchId}`);
        }
        socket.data.emoteMatchId = undefined;
        socket.data.emotePlayerId = undefined;
    });

    socket.on(MATCH_EMOTE_EVENTS.SEND, async (
        payload?: { emoteId?: string; matchId?: string; playerId?: string },
        ack?: (response: { ok: boolean; reason?: MatchEmoteRejectReason }) => void,
    ) => {
        const matchId = (socket.data.emoteMatchId as string | undefined) ?? payload?.matchId?.trim();
        const playerId = (socket.data.emotePlayerId as string | undefined) ?? payload?.playerId?.trim();
        const emoteId = payload?.emoteId?.trim();

        if (!matchId || !playerId) {
            emitMatchEmoteError(socket, 'not_joined', ack);
            return;
        }
        if (!emoteId) {
            emitMatchEmoteError(socket, 'missing_payload', ack);
            return;
        }

        const now = Date.now();
        const lastSentAt = matchEmoteRateLimiter.getLastSentAt(matchId, playerId);

        try {
            const result = await storage.fetch(matchId, { metadata: true });
            const decision = resolveMatchEmoteSendDecision({
                matchId,
                playerId,
                emoteId,
                metadata: result.metadata,
                now,
                lastSentAt,
                cooldownMs: matchEmoteRateLimiter.cooldownMs,
                isEmoteAllowed: isGameEmoteAllowed,
            });
            if (!decision.ok) {
                emitMatchEmoteError(socket, decision.reason, ack);
                return;
            }

            matchEmoteRateLimiter.markSent(matchId, playerId, now);
            socket.data.emoteMatchId = matchId;
            socket.data.emotePlayerId = playerId;
            socket.join(`matchemote:${matchId}`);
            const message: MatchEmotePayload = {
                matchId,
                playerId,
                emoteId,
                createdAt: new Date(now).toISOString(),
            };
            lobbySocketIO.to(`matchemote:${matchId}`).emit(MATCH_EMOTE_EVENTS.SHOW, message);
            ack?.({ ok: true });
        } catch (error) {
            logger.warn('[MatchEmote] 发送表情失败', {
                socketId: socket.id,
                matchId,
                playerId,
                emoteId,
                error: error instanceof Error ? error.message : String(error),
            });
            emitMatchEmoteError(socket, 'match_not_found', ack);
        }
    });
});

// ============================================================================
// 服务器启动
// ============================================================================

const runStartupCleanupInBackground = async () => {
    const cleanupTasks: StartupCleanupTask[] = [
        {
            reason: 'cleanupEmptyMatches:boot',
            run: () => mongoStorage.cleanupEmptyMatches(),
            errorMessage: '[MongoStorage] 启动清理空房间失败:',
        },
        {
            reason: 'cleanupEphemeralMatches:boot',
            run: () => hybridStorage.cleanupEphemeralMatches(),
            errorMessage: '[MongoStorage] 启动清理临时房间失败:',
        },
        {
            reason: 'cleanupExpiredTtlMatches:boot',
            run: () => mongoStorage.cleanupExpiredTtlMatches(),
            errorMessage: '[MongoStorage] 启动清理过期 TTL 房间失败:',
        },
        {
            reason: 'cleanupLegacyMatches:boot',
            run: () => mongoStorage.cleanupLegacyMatches(0),
            errorMessage: '[MongoStorage] 启动清理遗留房间失败:',
        },
        {
            reason: 'cleanupDuplicateOwnerMatches:boot',
            run: () => mongoStorage.cleanupDuplicateOwnerMatches(),
            errorMessage: '[MongoStorage] 启动清理重复 ownerKey 房间失败:',
        },
    ];

    await runStartupCleanupTasks(cleanupTasks, {
        onDirty: (reason) => {
            for (const gameName of SUPPORTED_GAMES) {
                void lobbyCoordinator.broadcastLobbySnapshot(gameName, reason);
            }
        },
        onError: (message, error) => {
            logger.error(message, error);
        },
    });
};

async function startServer() {
    const bootstrapStartedAt = Date.now();

    // 连接存储后端
    if (USE_PERSISTENT_STORAGE) {
        await hybridStorage.connect();

        // 定时清理断线超时的临时房间 + 过期 TTL 房间
        setInterval(async () => {
            try {
                const cleaned = await hybridStorage.cleanupEphemeralMatches();
                if (cleaned > 0) {
                    for (const gameName of SUPPORTED_GAMES) {
                        void lobbyCoordinator.broadcastLobbySnapshot(gameName, 'cleanupEphemeralMatches:timer');
                    }
                }
            } catch (err) {
                logger.error('[HybridStorage] 定时清理临时房间失败:', err);
            }
            try {
                const cleanedTtl = await mongoStorage.cleanupExpiredTtlMatches();
                if (cleanedTtl > 0) {
                    for (const gameName of SUPPORTED_GAMES) {
                        void lobbyCoordinator.broadcastLobbySnapshot(gameName, 'cleanupExpiredTtlMatches:timer');
                    }
                }
            } catch (err) {
                logger.error('[MongoStorage] 定时清理过期 TTL 房间失败:', err);
            }
        }, 60 * 1000);
    }

    // 启动游戏传输层
    gameTransport.start();

    // 启动 HTTP 服务器
    httpServer.listen(GAME_SERVER_PORT, () => {
        logger.info('[GameServer] 启动完成', {
            port: GAME_SERVER_PORT,
            bootstrap_ms: Date.now() - bootstrapStartedAt,
            registered_engines: SERVER_ENGINES.length,
            registered_game_ids: SERVER_GAME_IDS.length,
            use_persistent_storage: USE_PERSISTENT_STORAGE,
        });
        logger.info(`🎮 游戏服务器运行在 http://localhost:${GAME_SERVER_PORT}`);
        logger.info('📡 大厅广播服务已启动 (namespace: /lobby-socket)');
        logger.info('🎯 游戏传输层已启动 (namespace: /game)');
        logger.info(`📦 已注册 ${SERVER_ENGINES.length} 个游戏引擎, ${SERVER_GAME_IDS.length} 个游戏 ID`);

        if (USE_PERSISTENT_STORAGE) {
            // 先对外提供服务，再在后台执行启动清理，避免清理耗时阻塞 ready
            void runStartupCleanupInBackground();
        }
    });
}

startServer().catch((err) => {
    logger.error('❌ 服务器启动失败:', err);
    process.exit(1);
});

// ============================================================================
// 全局未捕获异常保护（防止单个请求/事件的 bug 导致整个进程崩溃）
// ============================================================================

process.on('uncaughtException', (err) => {
    // EPIPE 错误（stdout 管道关闭）：静默忽略，避免无限循环
    // 常见于 nodemon 重启时，stdout 管道被关闭但 logger 仍尝试写入
    if ((err as NodeJS.ErrnoException).code === 'EPIPE') {
        return;
    }
    
    logger.error('💥 [uncaughtException] 未捕获异常，进程继续运行:', {
        error: err.message,
        stack: err.stack,
    });
    // 系统级致命错误（内存耗尽、文件描述符耗尽）无法恢复，必须退出让 Docker 重启
    const fatalCodes = ['ENOMEM', 'EMFILE', 'ENFILE'];
    if (fatalCodes.includes((err as NodeJS.ErrnoException).code ?? '')) {
        logger.error('💥 [uncaughtException] 致命系统错误，强制退出:', (err as NodeJS.ErrnoException).code);
        process.exit(1);
    }
    // 业务级错误（ReferenceError/TypeError 等）：记录日志后继续运行
});

process.on('unhandledRejection', (reason, promise) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('💥 [unhandledRejection] 未处理的 Promise 拒绝，进程继续运行:', {
        error: err.message,
        stack: err.stack,
        promise: String(promise),
    });
    // 不退出进程
});

// Graceful shutdown — nodemon 重启时先关闭 socket 连接，避免 Vite WS proxy ECONNABORTED
function gracefulShutdown(signal: string) {
    logger.info(`\n🛑 收到 ${signal}，正在关闭服务器...`);
    io.close(() => {
        httpServer.close(() => {
            logger.info('✅ 服务器已关闭');
            process.exit(0);
        });
    });
    // 兜底：2 秒后强制退出
    setTimeout(() => process.exit(0), 2000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
