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
import { MAX_CHAT_LENGTH, sanitizeChatText } from './src/server/chatUtils';
import { MAX_CHAT_HISTORY } from './src/shared/chat';
import { MatchRecord } from './src/server/models/MatchRecord';
import { GAME_SERVER_MANIFEST } from './src/games/manifest.server';
import { mongoStorage } from './src/server/storage/MongoStorage';
import { hybridStorage } from './src/server/storage/HybridStorage';
import { createClaimSeatHandler, claimSeatUtils } from './src/server/claimSeat';
import { evaluateEmptyRoomJoinGuard } from './src/server/joinGuard';
import { hasOccupiedPlayers } from './src/server/matchOccupancy';
import { buildUgcServerGames } from './src/server/ugcRegistration';
import { GameTransportServer } from './src/engine/transport/server';
import type { GameEngineConfig } from './src/engine/transport/server';
import type { MatchMetadata, MatchStorage } from './src/engine/transport/storage';
import logger, { gameLogger } from './server/logger';
import { requestLogger, errorHandler } from './server/middleware/logging';

// ============================================================================
// 事件常量（与前端保持一致）
// ============================================================================

const LOBBY_EVENTS = {
    SUBSCRIBE_LOBBY: 'lobby:subscribe',
    UNSUBSCRIBE_LOBBY: 'lobby:unsubscribe',
    LOBBY_UPDATE: 'lobby:update',
    MATCH_CREATED: 'lobby:matchCreated',
    MATCH_UPDATED: 'lobby:matchUpdated',
    MATCH_ENDED: 'lobby:matchEnded',
    HEARTBEAT: 'lobby:heartbeat',
} as const;

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

const LOBBY_ROOM = 'lobby:subscribers';
const LOBBY_ALL = 'all';
const LOBBY_ALL_ROOM = `${LOBBY_ROOM}:${LOBBY_ALL}`;
const LOBBY_HEARTBEAT_INTERVAL = 15000;

// ============================================================================
// 游戏注册
// ============================================================================

const ENABLED_GAME_ENTRIES = GAME_SERVER_MANIFEST.filter(
    (entry) => entry.manifest.type === 'game' && entry.manifest.enabled
);

const SUPPORTED_GAMES: string[] = [];
type SupportedGame = string;
type LobbyGameId = SupportedGame | typeof LOBBY_ALL;

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

const DEV_CORS_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
];

const CORS_ORIGINS = RAW_WEB_ORIGINS.length > 0 ? RAW_WEB_ORIGINS : DEV_CORS_ORIGINS;
const USE_PERSISTENT_STORAGE = process.env.USE_PERSISTENT_STORAGE !== 'false';
const GAME_SERVER_PORT = Number(process.env.GAME_SERVER_PORT) || 18000;

// ============================================================================
// 归档逻辑
// ============================================================================

let storage: MatchStorage;

const archiveMatchResult = async ({
    matchID,
    gameName,
    gameover,
}: {
    matchID: string;
    gameName: string;
    gameover?: { winner?: string | number };
}) => {
    try {
        const existing = await MatchRecord.findOne({ matchID });
        if (existing) return;

        const { metadata, state: storedState } = await storage.fetch(matchID, { metadata: true, state: true });
        const winnerID = gameover?.winner !== undefined ? String(gameover.winner) : undefined;
        const resultType = winnerID ? 'win' : 'draw';

        const players: Array<{ id: string; name: string; result: string }> = [];
        if (metadata?.players) {
            for (const [pid, pdata] of Object.entries(metadata.players)) {
                const name = pdata?.name || `Player ${pid}`;
                players.push({
                    id: pid,
                    name,
                    result: pid === winnerID ? 'win' : resultType === 'draw' ? 'draw' : 'loss',
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
            winnerID,
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

    // UGC 游戏注册
    const { engineConfigs: ugcEngines, gameIds: ugcGameIds } = await buildUgcServerGames({
        existingGameIds: manifestGameIds,
    });
    ugcEngines.forEach((cfg) => engines.push(cfg));
    ugcGameIds.forEach((id) => gameIds.push(id));

    return { engines, gameIds };
};

// ============================================================================
// 初始化
// ============================================================================

await connectDB();
const { engines: SERVER_ENGINES, gameIds: SERVER_GAME_IDS } = await buildServerEngines();
registerSupportedGames(SERVER_GAME_IDS);

// 存储层：HybridStorage 直接实现 MatchStorage 接口
storage = hybridStorage;

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
    cors: {
        origin: CORS_ORIGINS,
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
const gameTransport = new GameTransportServer({
    io,
    storage,
    games: SERVER_ENGINES,
    offlineGraceMs: 15000,
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
        // 通知大厅更新（房间仍存在但标记为 gameover，大厅列表会过滤掉）
        const game = normalizeGameName(gameName);
        if (game && isSupportedGame(game)) {
            emitMatchEnded(game, matchID);
        }
    },
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
): { ownerKey: string; ownerType: 'user' | 'guest' } => {
    const authHeader = ctx.get('authorization');
    const rawToken = claimSeatUtils.parseBearerToken(authHeader);
    const payload = rawToken ? claimSeatUtils.verifyGameToken(rawToken, JWT_SECRET) : null;

    if (rawToken && !payload?.userId) {
        ctx.throw(401, 'Invalid token');
        return { ownerKey: 'user:invalid', ownerType: 'user' };
    }
    if (payload?.userId) {
        return { ownerKey: `user:${payload.userId}`, ownerType: 'user' };
    }

    const guestId =
        typeof setupData.guestId === 'string' && setupData.guestId.trim()
            ? setupData.guestId.trim()
            : undefined;
    if (!guestId) {
        ctx.throw(400, 'guestId is required');
        return { ownerKey: 'guest:invalid', ownerType: 'guest' };
    }
    return { ownerKey: `guest:${guestId}`, ownerType: 'guest' };
};

const resolveOwnerKeyFromMetadata = (metadata?: MatchMetadata | null): string | undefined => {
    const setupData = metadata?.setupData as { ownerKey?: string } | undefined;
    return setupData?.ownerKey;
};

const isEmptyRoomByMetadata = (metadata?: MatchMetadata | null): boolean => {
    if (!metadata?.players) return false;
    return !hasOccupiedPlayers(metadata.players as Record<string, { name?: string; credentials?: string; isConnected?: boolean | null }>);
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

    await storage.wipe(matchID);
    gameTransport.unloadMatch(matchID, { disconnectSockets: true });

    const game = normalizeGameName(metadata?.gameName);
    if (emitRemoval && game && isSupportedGame(game)) {
        emitMatchEnded(game, matchID);
    } else {
        matchGameIndex.delete(matchID);
    }

    matchSubscribers.delete(matchID);
    rematchStateByMatch.delete(matchID);
    chatHistoryByMatch.delete(matchID);
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
router.post('/games/:name/create', async (ctx) => {
    const gameName = normalizeGameName(ctx.params.name);
    if (!gameName || !isSupportedGame(gameName)) {
        ctx.throw(404, `Game ${ctx.params.name} not found`);
    }

    const body = ctx.request.body as Record<string, unknown> | undefined;
    const numPlayers = Number(body?.numPlayers ?? 2);
    if (isNaN(numPlayers) || numPlayers < 1) {
        ctx.throw(400, 'Invalid numPlayers');
    }

    const rawSetupData =
        body?.setupData && typeof body.setupData === 'object'
            ? (body.setupData as Record<string, unknown>)
            : {};
    const { ownerKey, ownerType } = resolveOwnerFromRequest(ctx, rawSetupData);
    const setupData = { ...rawSetupData, ownerKey, ownerType };

    const matchID = nanoid(11);
    const seed = nanoid(16);
    const playerIds = Array.from({ length: numPlayers }, (_, i) => String(i));

    // 初始化游戏状态
    const setupResult = await gameTransport.setupMatch(matchID, gameName, playerIds, seed, setupData);
    if (!setupResult) {
        ctx.throw(500, 'Failed to setup match');
        return;
    }
    const { state: initialState, randomCursor } = setupResult;

    // 构建 metadata（每个座位包含 id 字段）
    const players: Record<string, { id: number; name?: string; credentials?: string; isConnected?: boolean }> = {};
    for (let i = 0; i < playerIds.length; i++) {
        players[playerIds[i]] = { id: i };
    }

    const metadata: MatchMetadata = {
        gameName,
        players,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        setupData,
    };

    try {
        await storage.createMatch(matchID, {
            initialState: {
                G: initialState,
                _stateID: 0,
                randomSeed: seed,
                randomCursor,
            },
            metadata,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 已有活跃房间 → 返回 409 + 已存在的 matchID，前端可直接跳转
        const activeMatch = msg.match(/ACTIVE_MATCH_EXISTS:([^:]+):([^:]+)/);
        if (activeMatch) {
            ctx.status = 409;
            ctx.body = { error: 'ACTIVE_MATCH_EXISTS', gameName: activeMatch[1], matchID: activeMatch[2] };
            return;
        }
        throw err;
    }

    ctx.body = { matchID };

    setTimeout(() => void handleMatchCreated(matchID, gameName), 100);
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

    const playerID = body?.playerID;
    const playerName = body?.playerName;

    if (!playerID) {
        ctx.throw(403, 'playerID is required');
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

    // 分配凭证
    const credentials = nanoid(21);
    const metadata = result.metadata;
    if (!metadata.players[playerID]) {
        ctx.throw(404, `Player ${playerID} not found`);
        return;
    }

    metadata.players[playerID] = {
        ...metadata.players[playerID],
        name: playerName,
        credentials,
    };
    metadata.updatedAt = Date.now();
    await storage.setMetadata(matchID, metadata);
    gameTransport.updateMatchMetadata(matchID, metadata);

    ctx.body = { playerCredentials: credentials };

    setTimeout(() => void handleMatchJoined(matchID, gameName), 100);
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

    const metadata = result.metadata;
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
    await storage.setMetadata(matchID, metadata);
    gameTransport.updateMatchMetadata(matchID, metadata);
    // 离座后立即撤销该 seat 的实时连接权限，避免旧连接继续接收私有视图。
    gameTransport.disconnectPlayer(matchID, playerID, { disconnectSockets: true });

    ctx.body = {};

    setTimeout(() => void handleMatchLeft(matchID, gameName), 100);
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
        emitMatchEnded(game, matchID);
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
        setTimeout(() => void handleMatchJoined(matchID, gameName), 50);
    }
});

// GET /games/:name/leaderboard — 排行榜（必须在 :matchID 通配路由之前注册）
router.get('/games/:name/leaderboard', async (ctx) => {
    const gameName = ctx.params.name;
    try {
        const records = await MatchRecord.find({ gameName });
        const stats: Record<string, { name: string; wins: number; matches: number }> = {};

        records.forEach((record) => {
            if (record.winnerID) {
                const winner = record.players.find((p: { id: string }) => p.id === record.winnerID);
                if (winner) {
                    if (!stats[winner.id]) stats[winner.id] = { name: winner.name, wins: 0, matches: 0 };
                    stats[winner.id].wins++;
                }
            }
            record.players.forEach((p: { id: string; name: string }) => {
                if (!stats[p.id]) stats[p.id] = { name: p.name, wins: 0, matches: 0 };
                stats[p.id].matches++;
            });
        });

        ctx.body = {
            leaderboard: Object.values(stats)
                .sort((a, b) => b.wins - a.wins)
                .slice(0, 50),
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

    const metadata = result.metadata;
    ctx.body = {
        matchID,
        gameName: metadata.gameName,
        players: Object.entries(metadata.players).map(([id, data]) => ({
            id: Number(id),
            name: data.name,
            isConnected: data.isConnected,
        })),
        setupData: metadata.setupData,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        gameover: metadata.gameover,
    };
});

app.use(router.routes());
app.use(router.allowedMethods());

// 测试路由（仅在测试/开发环境启用）
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    const { createTestRoutes } = await import('./src/server/routes/test.js');
    const testRouter = createTestRoutes(gameTransport, storage);
    app.use(testRouter.routes());
    app.use(testRouter.allowedMethods());
    logger.info('[Server] 测试模式已启用 - Test API endpoints available at /test/*');
}

// ============================================================================
// 大厅缓存与广播
// ============================================================================

const lobbySubscribersByGame = new Map<SupportedGame, Set<string>>();
const lobbyAllSubscribers = new Set<string>();

// lobbyIO 在启动块中赋值，这里先声明用于 emit 函数引用
let lobbyIO: IOServer | null = null;

interface LobbyMatch {
    matchID: string;
    gameName: string;
    players: Array<{ id: number; name?: string; isConnected?: boolean }>;
    totalSeats?: number;
    createdAt?: number;
    updatedAt?: number;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
    isLocked?: boolean;
}

interface LobbySnapshotPayload {
    gameId: LobbyGameId;
    version: number;
    matches: LobbyMatch[];
}

interface LobbyMatchPayload {
    gameId: LobbyGameId;
    version: number;
    match: LobbyMatch;
}

interface LobbyMatchEndedPayload {
    gameId: LobbyGameId;
    version: number;
    matchID: string;
}

interface LobbyHeartbeatPayload {
    gameId: LobbyGameId;
    version: number;
    timestamp: number;
}

const lobbyVersionByGame = new Map<SupportedGame, number>();
const lobbyCacheByGame = new Map<SupportedGame, Map<string, LobbyMatch>>();
const lobbyCacheDirty = new Map<SupportedGame, boolean>();
const matchGameIndex = new Map<string, SupportedGame>();
let lobbyHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
const lobbySnapshotTimers = new Map<SupportedGame, ReturnType<typeof setTimeout>>();

const bumpLobbyVersion = (gameName: SupportedGame): number => {
    const v = (lobbyVersionByGame.get(gameName) ?? 0) + 1;
    lobbyVersionByGame.set(gameName, v);
    return v;
};

const bumpLobbyAllVersion = (): number => {
    const v = (lobbyVersionByGame.get(LOBBY_ALL as SupportedGame) ?? 0) + 1;
    lobbyVersionByGame.set(LOBBY_ALL as SupportedGame, v);
    return v;
};

const buildLobbyMatch = (
    matchID: string,
    metadata: MatchMetadata,
): LobbyMatch => {
    const players = Object.entries(metadata.players).map(([id, data]) => ({
        id: Number(id),
        name: data.name,
        isConnected: data.isConnected,
    }));
    const setupData = metadata.setupData as {
        ownerKey?: string;
        ownerType?: 'user' | 'guest';
        roomName?: string;
        password?: string;
    } | undefined;
    return {
        matchID,
        gameName: metadata.gameName,
        players,
        totalSeats: players.length,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        roomName: setupData?.roomName,
        ownerKey: setupData?.ownerKey,
        ownerType: setupData?.ownerType,
        isLocked: !!setupData?.password,
    };
};

const fetchLobbyMatch = async (matchID: string): Promise<LobbyMatch | null> => {
    try {
        const result = await storage.fetch(matchID, { metadata: true });
        if (!result.metadata) return null;
        // 已结束的对局不应出现在大厅列表
        if (result.metadata.gameover) return null;
        const match = buildLobbyMatch(matchID, result.metadata);
        const game = normalizeGameName(result.metadata.gameName);
        if (game && isSupportedGame(game)) {
            matchGameIndex.set(matchID, game);
            ensureGameState(game);
            lobbyCacheByGame.get(game)!.set(matchID, match);
        }
        return match;
    } catch {
        return null;
    }
};

const fetchMatchesByGame = async (gameName: SupportedGame): Promise<LobbyMatch[]> => {
    try {
        const matchIds = await storage.listMatches({ gameName });
        const matches: LobbyMatch[] = [];
        for (const matchID of matchIds) {
            const result = await storage.fetch(matchID, { metadata: true });
            if (!result.metadata) continue;
            if (result.metadata.gameover) continue;
            // 过滤无人占座的空房间（等待 cleanupEphemeralMatches 回收）
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

const getLobbyRoomName = (gameName: SupportedGame) => `${LOBBY_ROOM}:${gameName}`;

const getLobbySubscriptions = (socket: IOSocket): Set<LobbyGameId> => {
    if (!socket.data.lobbyGameIds) {
        socket.data.lobbyGameIds = new Set<LobbyGameId>();
    }
    return socket.data.lobbyGameIds as Set<LobbyGameId>;
};

const removeLobbySubscription = (socket: IOSocket, gameId: LobbyGameId) => {
    if (gameId === LOBBY_ALL) {
        lobbyAllSubscribers.delete(socket.id);
        socket.leave(LOBBY_ALL_ROOM);
    } else if (isSupportedGame(gameId)) {
        lobbySubscribersByGame.get(gameId)?.delete(socket.id);
        socket.leave(getLobbyRoomName(gameId));
    }
};

const ensureGameState = (gameName: SupportedGame) => {
    if (!lobbySubscribersByGame.has(gameName)) {
        lobbySubscribersByGame.set(gameName, new Set());
    }
    if (!lobbyCacheByGame.has(gameName)) {
        lobbyCacheByGame.set(gameName, new Map());
    }
};

const syncLobbyCache = async (gameName: SupportedGame): Promise<LobbyMatch[]> => {
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

const markLobbyCacheDirty = (gameName: SupportedGame) => {
    lobbyCacheDirty.set(gameName, true);
};

const getLobbySnapshot = async (gameName: SupportedGame): Promise<LobbyMatch[]> => {
    ensureGameState(gameName);
    if (lobbyCacheDirty.get(gameName)) {
        return syncLobbyCache(gameName);
    }
    return Array.from(lobbyCacheByGame.get(gameName)!.values());
};

const sendLobbySnapshot = async (socket: IOSocket, gameName: SupportedGame) => {
    const matches = await getLobbySnapshot(gameName);
    const payload: LobbySnapshotPayload = {
        gameId: gameName,
        matches,
        version: lobbyVersionByGame.get(gameName) ?? 0,
    };
    socket.emit(LOBBY_EVENTS.LOBBY_UPDATE, payload);
};

const getLobbySnapshotAll = async (): Promise<LobbyMatch[]> => {
    const all: LobbyMatch[] = [];
    for (const gameName of SUPPORTED_GAMES) {
        const matches = await getLobbySnapshot(gameName);
        all.push(...matches);
    }
    return all;
};

const sendLobbySnapshotAll = async (socket: IOSocket) => {
    const matches = await getLobbySnapshotAll();
    const payload: LobbySnapshotPayload = {
        gameId: LOBBY_ALL,
        matches,
        version: lobbyVersionByGame.get(LOBBY_ALL as SupportedGame) ?? 0,
    };
    socket.emit(LOBBY_EVENTS.LOBBY_UPDATE, payload);
};

const emitToLobby = (gameName: SupportedGame, event: string, payload: unknown) => {
    if (!lobbyIO) return;
    lobbyIO.to(getLobbyRoomName(gameName)).emit(event, payload);
};

const emitToLobbyAll = (event: string, payload: unknown) => {
    if (!lobbyIO) return;
    lobbyIO.to(LOBBY_ALL_ROOM).emit(event, payload);
};

const emitMatchCreated = (gameName: SupportedGame, match: LobbyMatch) => {
    ensureGameState(gameName);
    lobbyCacheByGame.get(gameName)!.set(match.matchID, match);
    matchGameIndex.set(match.matchID, gameName);
    const payload: LobbyMatchPayload = { gameId: gameName, version: bumpLobbyVersion(gameName), match };
    emitToLobby(gameName, LOBBY_EVENTS.MATCH_CREATED, payload);
    emitToLobbyAll(LOBBY_EVENTS.MATCH_CREATED, { gameId: LOBBY_ALL, version: bumpLobbyAllVersion(), match });
};

const emitMatchUpdated = (gameName: SupportedGame, match: LobbyMatch) => {
    ensureGameState(gameName);
    lobbyCacheByGame.get(gameName)!.set(match.matchID, match);
    matchGameIndex.set(match.matchID, gameName);
    const payload: LobbyMatchPayload = { gameId: gameName, version: bumpLobbyVersion(gameName), match };
    emitToLobby(gameName, LOBBY_EVENTS.MATCH_UPDATED, payload);
    emitToLobbyAll(LOBBY_EVENTS.MATCH_UPDATED, { gameId: LOBBY_ALL, version: bumpLobbyAllVersion(), match });
};

const emitMatchEnded = (gameName: SupportedGame, matchID: string) => {
    ensureGameState(gameName);
    lobbyCacheByGame.get(gameName)!.delete(matchID);
    matchGameIndex.delete(matchID);
    const payload: LobbyMatchEndedPayload = { gameId: gameName, version: bumpLobbyVersion(gameName), matchID };
    emitToLobby(gameName, LOBBY_EVENTS.MATCH_ENDED, payload);
    emitToLobbyAll(LOBBY_EVENTS.MATCH_ENDED, { gameId: LOBBY_ALL, version: bumpLobbyAllVersion(), matchID });
};

const emitLobbyHeartbeat = () => {
    if (!lobbyIO) return;
    for (const gameName of SUPPORTED_GAMES) {
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
            version: lobbyVersionByGame.get(LOBBY_ALL as SupportedGame) ?? 0,
            timestamp: Date.now(),
        };
        emitToLobbyAll(LOBBY_EVENTS.HEARTBEAT, payload);
    }
};

const startLobbyHeartbeat = () => {
    if (lobbyHeartbeatTimer) return;
    lobbyHeartbeatTimer = setInterval(emitLobbyHeartbeat, LOBBY_HEARTBEAT_INTERVAL);
};

const broadcastLobbySnapshot = async (gameName: SupportedGame, _reason: string) => {
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

const scheduleLobbySnapshot = (gameName: SupportedGame, reason: string) => {
    const existing = lobbySnapshotTimers.get(gameName);
    if (existing) clearTimeout(existing);
    lobbySnapshotTimers.set(
        gameName,
        setTimeout(() => {
            lobbySnapshotTimers.delete(gameName);
            void broadcastLobbySnapshot(gameName, reason);
        }, 300),
    );
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

async function handleMatchLeft(matchID?: string, gameNameFromUrl?: string) {
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
        // 玩家离开后房间已空 → 从大厅列表移除（等待 cleanupEphemeralMatches 回收）
        const hasPlayers = match.players.some(p => p.name);
        if (!hasPlayers) {
            emitMatchEnded(game, matchID);
            return;
        }
        emitMatchUpdated(game, match);
        return;
    }
    emitMatchEnded(game, matchID);
}

// ============================================================================
// 大厅 Socket 连接处理
// ============================================================================

// 创建独立的大厅 Socket.IO 服务器（使用 /lobby-socket 路径，与客户端 lobbySocket.ts 一致）
// 使用 MessagePack 序列化替代 JSON，减少传输体积
const lobbySocketIO = new IOServer(httpServer, {
    parser: msgpackParser,
    path: '/lobby-socket',
    cors: {
        origin: CORS_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    perMessageDeflate: {
        threshold: 1024,
        zlibDeflateOptions: { windowBits: 13 },
        zlibInflateOptions: { windowBits: 13 },
    },
});
lobbyIO = lobbySocketIO;

lobbySocketIO.on('connection', (socket) => {
    logger.debug(`[LobbyIO] 新连接: ${socket.id}`);

    // 订阅大厅更新
    socket.on(LOBBY_EVENTS.SUBSCRIBE_LOBBY, async (payload?: { gameId?: string }) => {
        const requestedGame = normalizeGameName(payload?.gameId);
        if (!requestedGame) {
            logger.warn(`[LobbyIO] ${socket.id} 订阅大厅失败：非法 gameId`, payload?.gameId);
            return;
        }

        const subscriptions = getLobbySubscriptions(socket);

        if (requestedGame === LOBBY_ALL) {
            const isNew = !subscriptions.has(LOBBY_ALL);
            subscriptions.add(LOBBY_ALL);
            lobbyAllSubscribers.add(socket.id);
            socket.join(LOBBY_ALL_ROOM);
            if (isNew) {
                logger.info(`[LobbyIO] ${socket.id} 订阅大厅(${LOBBY_ALL}) (当前 ${lobbyAllSubscribers.size} 个订阅者)`);
            } else {
                logger.debug(`[LobbyIO] ${socket.id} 刷新大厅(${LOBBY_ALL})`);
            }
            await sendLobbySnapshotAll(socket);
            startLobbyHeartbeat();
            return;
        }

        if (!isSupportedGame(requestedGame)) {
            logger.warn(`[LobbyIO] ${socket.id} 订阅大厅失败：非法 gameId`, payload?.gameId);
            return;
        }

        const isNew = !subscriptions.has(requestedGame);
        subscriptions.add(requestedGame);
        ensureGameState(requestedGame);
        lobbySubscribersByGame.get(requestedGame)!.add(socket.id);
        socket.join(getLobbyRoomName(requestedGame));
        if (isNew) {
            logger.info(`[LobbyIO] ${socket.id} 订阅大厅(${requestedGame}) (当前 ${lobbySubscribersByGame.get(requestedGame)!.size} 个订阅者)`);
        } else {
            logger.debug(`[LobbyIO] ${socket.id} 刷新大厅(${requestedGame})`);
        }

        await sendLobbySnapshot(socket, requestedGame);
        startLobbyHeartbeat();
    });

    // 取消订阅
    socket.on(LOBBY_EVENTS.UNSUBSCRIBE_LOBBY, (payload?: { gameId?: string }) => {
        const requestedGame = normalizeGameName(payload?.gameId);
        const subscriptions = getLobbySubscriptions(socket);

        if (!requestedGame) {
            subscriptions.forEach((gameId) => removeLobbySubscription(socket, gameId));
            subscriptions.clear();
            socket.data.lobbyGameIds = undefined;
            logger.info(`[LobbyIO] ${socket.id} 取消全部订阅`);
            return;
        }

        const gameId = requestedGame === LOBBY_ALL ? LOBBY_ALL : requestedGame;
        removeLobbySubscription(socket, gameId);
        subscriptions.delete(gameId);
        if (subscriptions.size === 0) {
            socket.data.lobbyGameIds = undefined;
        }
        logger.debug(`[LobbyIO] ${socket.id} 取消订阅 ${gameId}`);
    });

    // 断开连接清理
    socket.on('disconnect', () => {
        const subscriptions = getLobbySubscriptions(socket);
        subscriptions.forEach((gameId) => removeLobbySubscription(socket, gameId));
        subscriptions.clear();
        socket.data.lobbyGameIds = undefined;

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

        logger.debug(`[LobbyIO] ${socket.id} 断开连接`);
    });

    // ========== 重赛投票事件处理 ==========

    socket.on(REMATCH_EVENTS.JOIN_MATCH, (payload?: { matchId?: string; playerId?: string }) => {
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
        socket.emit(REMATCH_EVENTS.STATE_UPDATE, state);
        logger.info(`[RematchIO] ${socket.id} 加入对局 ${matchId} (玩家 ${playerId})`);
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
        logger.info(`[RematchIO] ${socket.id} 离开对局`);
    });

    socket.on(REMATCH_EVENTS.DEBUG_NEW_ROOM, (data?: { url?: string }) => {
        const matchId = socket.data.rematchMatchId as string | undefined;
        if (!matchId || !data?.url) return;
        socket.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.DEBUG_NEW_ROOM, data);
    });

    socket.on(REMATCH_EVENTS.VOTE, () => {
        const matchId = socket.data.rematchMatchId as string | undefined;
        const playerId = socket.data.rematchPlayerId as string | undefined;
        if (!matchId || !playerId) return;

        const state = rematchStateByMatch.get(matchId);
        if (!state || state.ready) return;

        const currentVote = state.votes[playerId] ?? false;
        state.votes[playerId] = !currentVote;

        const votedPlayers = Object.entries(state.votes).filter(([, v]) => v).map(([p]) => p);
        state.ready = votedPlayers.length >= 2;
        state.revision += 1;

        logger.info(`[RematchIO] ${socket.id} 投票: ${playerId} -> ${state.votes[playerId]}, ready=${state.ready}`);

        lobbySocketIO.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.STATE_UPDATE, state);

        if (state.ready) {
            lobbySocketIO.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.TRIGGER_RESET);
            setTimeout(() => {
                const currentState = rematchStateByMatch.get(matchId);
                if (currentState) {
                    currentState.votes = {};
                    currentState.ready = false;
                    currentState.revision += 1;
                    lobbySocketIO.to(`rematch:${matchId}`).emit(REMATCH_EVENTS.STATE_UPDATE, currentState);
                }
            }, 1000);
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
        if (history.length > MAX_CHAT_HISTORY) {
            chatHistoryByMatch.set(matchId, history.slice(-MAX_CHAT_HISTORY));
        }

        lobbySocketIO.to(`matchchat:${matchId}`).emit(MATCH_CHAT_EVENTS.MESSAGE, message);
    });
});

// ============================================================================
// 服务器启动
// ============================================================================

async function startServer() {
    // 连接存储后端
    if (USE_PERSISTENT_STORAGE) {
        await hybridStorage.connect();

        // 启动时清理损坏/临时/遗留/重复房间
        try {
            const cleanedEmpty = await mongoStorage.cleanupEmptyMatches();
            if (cleanedEmpty > 0) {
                for (const gameName of SUPPORTED_GAMES) {
                    void broadcastLobbySnapshot(gameName, 'cleanupEmptyMatches:boot');
                }
            }
        } catch (err) {
            logger.error('[MongoStorage] 启动清理空房间失败:', err);
        }

        try {
            const cleanedEphemeral = await hybridStorage.cleanupEphemeralMatches();
            if (cleanedEphemeral > 0) {
                for (const gameName of SUPPORTED_GAMES) {
                    void broadcastLobbySnapshot(gameName, 'cleanupEphemeralMatches:boot');
                }
            }
        } catch (err) {
            logger.error('[MongoStorage] 启动清理临时房间失败:', err);
        }

        // 定时清理断线超时的临时房间
        setInterval(async () => {
            try {
                const cleaned = await hybridStorage.cleanupEphemeralMatches();
                if (cleaned > 0) {
                    for (const gameName of SUPPORTED_GAMES) {
                        void broadcastLobbySnapshot(gameName, 'cleanupEphemeralMatches:timer');
                    }
                }
            } catch (err) {
                logger.error('[HybridStorage] 定时清理临时房间失败:', err);
            }
        }, 60 * 1000);

        try {
            const cleanedLegacy = await mongoStorage.cleanupLegacyMatches(0);
            if (cleanedLegacy > 0) {
                for (const gameName of SUPPORTED_GAMES) {
                    void broadcastLobbySnapshot(gameName, 'cleanupLegacyMatches:boot');
                }
            }
        } catch (err) {
            logger.error('[MongoStorage] 启动清理遗留房间失败:', err);
        }

        try {
            const cleanedDuplicate = await mongoStorage.cleanupDuplicateOwnerMatches();
            if (cleanedDuplicate > 0) {
                for (const gameName of SUPPORTED_GAMES) {
                    void broadcastLobbySnapshot(gameName, 'cleanupDuplicateOwnerMatches:boot');
                }
            }
        } catch (err) {
            logger.error('[MongoStorage] 启动清理重复 ownerKey 房间失败:', err);
        }
    }

    // 启动游戏传输层
    gameTransport.start();

    // 启动 HTTP 服务器
    httpServer.listen(GAME_SERVER_PORT, () => {
        logger.info(`🎮 游戏服务器运行在 http://localhost:${GAME_SERVER_PORT}`);
        logger.info('📡 大厅广播服务已启动 (namespace: /lobby-socket)');
        logger.info(`🎯 游戏传输层已启动 (namespace: /game)`);
        logger.info(`📦 已注册 ${SERVER_ENGINES.length} 个游戏引擎, ${SERVER_GAME_IDS.length} 个游戏 ID`);
    });
}

startServer().catch((err) => {
    logger.error('❌ 服务器启动失败:', err);
    process.exit(1);
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
