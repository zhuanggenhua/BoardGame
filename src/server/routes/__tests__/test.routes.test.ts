/**
 * 测试路由集成测试
 * 
 * Property 3: 无效状态被拒绝
 * 验证所有端点的成功场景和错误处理
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { Server as IOServer } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { createServer } from 'http';
import type { MatchState } from '../../../core/types';
import type { MatchStorage, StoredMatchState, MatchMetadata } from '../../../engine/transport/storage';
import { resolveMatchStatus } from '../../../engine/transport/storage';
import { GameTransportServer } from '../../../engine/transport/server';
import type { GameEngineConfig } from '../../../engine/transport/server';
import { createTestRoutes, getConfiguredTestApiToken, isTestRoutesEnabledEnv } from '../test';
import { ensureSharedTestApiToken, resolveSharedTestApiToken } from '../../testApiToken';

// Mock storage
const createMockStorage = (): MatchStorage => {
    const states = new Map<string, StoredMatchState>();
    const metadatas = new Map<string, MatchMetadata>();

    return {
        fetch: vi.fn(async (matchId: string, opts?: { state?: boolean; metadata?: boolean }) => {
            const result: { state?: StoredMatchState; metadata?: MatchMetadata } = {};
            if (opts?.state) result.state = states.get(matchId);
            if (opts?.metadata) result.metadata = metadatas.get(matchId);
            return result;
        }),
        setState: vi.fn(async (matchId: string, state: StoredMatchState) => {
            states.set(matchId, state);
        }),
        setMetadata: vi.fn(async (matchId: string, metadata: MatchMetadata) => {
            metadatas.set(matchId, metadata);
        }),
        wipe: vi.fn(),
        list: vi.fn(),
        listMatches: vi.fn(),
        createMatch: vi.fn(async (matchId: string, data: { initialState: StoredMatchState; metadata: MatchMetadata }) => {
            states.set(matchId, data.initialState);
            metadatas.set(matchId, data.metadata);
        }),
    };
};

// Mock game engine
const createMockGameEngine = (gameId: string): GameEngineConfig => ({
    gameId,
    domain: {
        setup: (playerIds) => ({
            phase: 'play',
            players: Object.fromEntries(playerIds.map(id => [id, { hp: 10 }])),
        }),
        validate: () => ({ valid: true }),
        execute: (state, cmd) => ({ events: [] }),
        reduce: (state, event) => state,
        isGameOver: () => undefined,
    },
    systems: [],
    systemsConfig: {},
});

const createLifecycleGameEngine = (gameId: string): GameEngineConfig => ({
    gameId,
    minPlayers: 2,
    maxPlayers: 2,
    domain: {
        setup: (playerIds) => ({
            phase: 'play',
            counter: 0,
            players: Object.fromEntries(playerIds.map(id => [id, { hp: 10 }])),
        }),
        validate: () => ({ valid: true }),
        execute: (_state, command) => {
            if (command.type !== 'INCREMENT_COUNTER') {
                return [];
            }
            const payload = (command.payload ?? {}) as { by?: unknown };
            const by = typeof payload.by === 'number' ? payload.by : 1;
            return [{ type: 'counter:incremented', payload: { by }, timestamp: Date.now() }];
        },
        reduce: (state, event) => {
            if ((event as { type?: string }).type !== 'counter:incremented') {
                return state;
            }

            const core = state as {
                phase?: string;
                counter?: number;
                players?: Record<string, { hp: number }>;
            };
            const by = typeof (event as { payload?: { by?: unknown } }).payload?.by === 'number'
                ? ((event as { payload: { by: number } }).payload.by)
                : 1;

            return {
                ...core,
                counter: (core.counter ?? 0) + by,
            };
        },
        isGameOver: () => undefined,
    },
    systems: [],
    systemsConfig: {},
});

const createRoomLifecycleRoutes = ({
    storage,
    gameTransport,
    games,
}: {
    storage: MatchStorage;
    gameTransport: GameTransportServer;
    games: GameEngineConfig[];
}) => {
    const router = new Router();
    const gameIndex = new Map(games.map((game) => [game.gameId, game]));
    let nextMatchId = 1;

    router.post('/games/:name/create', async (ctx) => {
        const gameName = String(ctx.params.name || '').trim();
        const gameEngine = gameIndex.get(gameName);
        if (!gameEngine) {
            ctx.throw(404, `Game ${ctx.params.name} not found`);
            return;
        }

        const body = ctx.request.body as { numPlayers?: unknown; setupData?: unknown } | undefined;
        const numPlayers = Number(body?.numPlayers ?? 2);
        const minPlayers = gameEngine.minPlayers ?? 2;
        const maxPlayers = gameEngine.maxPlayers ?? 2;
        if (Number.isNaN(numPlayers) || numPlayers < minPlayers || numPlayers > maxPlayers) {
            ctx.throw(400, 'Invalid numPlayers');
            return;
        }

        const matchID = `lifecycle-match-${nextMatchId++}`;
        const seed = `seed-${matchID}`;
        const playerIds = Array.from({ length: numPlayers }, (_, index) => String(index));
        const setupData = body?.setupData && typeof body.setupData === 'object'
            ? (body.setupData as Record<string, unknown>)
            : {};
        const setupResult = await gameTransport.setupMatch(matchID, gameName, playerIds, seed, setupData);
        if (!setupResult) {
            ctx.throw(500, 'Failed to setup match');
            return;
        }

        const players: MatchMetadata['players'] = {};
        playerIds.forEach((playerId, index) => {
            players[playerId] = { id: index, isConnected: false };
        });

        const metadata: MatchMetadata = {
            matchID,
            gameName,
            players,
            setupData,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'waiting',
        };

        await storage.createMatch(matchID, {
            initialState: {
                G: setupResult.state,
                _stateID: 0,
                randomSeed: seed,
                randomCursor: setupResult.randomCursor,
            },
            metadata,
        });

        ctx.body = { matchID };
    });

    router.post('/games/:name/:matchID/join', async (ctx) => {
        const matchID = String(ctx.params.matchID || '').trim();
        const body = ctx.request.body as { playerID?: string; playerName?: string } | undefined;
        const playerID = body?.playerID;
        if (!playerID) {
            ctx.throw(403, 'playerID is required');
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

        const credentials = `cred-${matchID}-${playerID}`;
        result.metadata.players[playerID] = {
            ...playerMeta,
            name: body?.playerName,
            credentials,
        };
        result.metadata.updatedAt = Date.now();

        const allSeated = Object.values(result.metadata.players).every((player) => player.name || player.credentials);
        if (allSeated) {
            result.metadata.status = 'playing';
        }

        await storage.setMetadata(matchID, result.metadata);
        gameTransport.updateMatchMetadata(matchID, result.metadata);

        ctx.body = { playerCredentials: credentials };
    });

    router.post('/games/:name/:matchID/leave', async (ctx) => {
        const matchID = String(ctx.params.matchID || '').trim();
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

        delete playerMeta.name;
        delete playerMeta.credentials;
        playerMeta.isConnected = false;
        result.metadata.updatedAt = Date.now();
        result.metadata.status = 'waiting';

        await storage.setMetadata(matchID, result.metadata);
        gameTransport.updateMatchMetadata(matchID, result.metadata);
        gameTransport.disconnectPlayer(matchID, playerID, { disconnectSockets: true });

        ctx.body = {};
    });

    router.get('/games/:name/:matchID', async (ctx) => {
        const matchID = String(ctx.params.matchID || '').trim();
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
            status: resolveMatchStatus(metadata),
        };
    });

    return router;
};

const waitForClientSocketEvent = <TArgs extends unknown[] = unknown[]>(
    socket: ClientSocket,
    event: string,
    timeoutMs = 3000,
): Promise<TArgs> => {
    return new Promise<TArgs>((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timed out waiting for socket event: ${event}`));
        }, timeoutMs);

        const cleanup = () => {
            clearTimeout(timer);
            socket.off(event, onEvent);
            socket.off('connect_error', onConnectError);
        };

        const onEvent = (...args: unknown[]) => {
            cleanup();
            resolve(args as TArgs);
        };

        const onConnectError = (error: Error) => {
            cleanup();
            reject(error);
        };

        socket.once(event, onEvent);
        socket.once('connect_error', onConnectError);
    });
};

const TEST_TOKEN = 'test-token-12345';
const TEST_PLAYER_ID = '0';
const TEST_PLAYER_CREDENTIALS = 'cred-0';
const TEST_HEADERS = {
    'Content-Type': 'application/json',
    'X-Test-Token': TEST_TOKEN,
    'X-Test-Player-Id': TEST_PLAYER_ID,
    'X-Test-Player-Credentials': TEST_PLAYER_CREDENTIALS,
};

describe('Test Route Guards', () => {
    it('should only enable explicit test environments', () => {
        expect(isTestRoutesEnabledEnv('test')).toBe(true);
        expect(isTestRoutesEnabledEnv('development')).toBe(true);
        expect(isTestRoutesEnabledEnv('production')).toBe(false);
        expect(isTestRoutesEnabledEnv('staging')).toBe(false);
        expect(isTestRoutesEnabledEnv('')).toBe(false);
        expect(isTestRoutesEnabledEnv(undefined)).toBe(false);
    });

    it('should require an explicitly configured test api token', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-test-api-token-missing-'));
        const missingTokenFile = path.join(tempDir, 'missing-token.txt');

        try {
            expect(getConfiguredTestApiToken({ TEST_API_TOKEN: ' route-token ' } as NodeJS.ProcessEnv)).toBe('route-token');
            expect(
                getConfiguredTestApiToken({
                    TEST_API_TOKEN_FILE: missingTokenFile,
                } as NodeJS.ProcessEnv),
            ).toBeNull();
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should reuse the shared test api token file when env token is missing', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-test-api-token-'));
        const tokenFile = path.join(tempDir, 'token.txt');

        try {
            const ensured = ensureSharedTestApiToken({
                TEST_API_TOKEN_FILE: tokenFile,
            } as NodeJS.ProcessEnv, tempDir);

            expect(ensured).toMatch(/^pw-/);
            expect(
                getConfiguredTestApiToken({
                    TEST_API_TOKEN_FILE: tokenFile,
                } as NodeJS.ProcessEnv),
            ).toBe(ensured);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should overwrite the shared token file when TEST_API_TOKEN is explicitly provided', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-test-api-token-explicit-'));
        const tokenFile = path.join(tempDir, 'token.txt');
        fs.writeFileSync(tokenFile, 'old-token', 'utf-8');

        try {
            const resolved = resolveSharedTestApiToken({
                TEST_API_TOKEN: 'new-token',
                TEST_API_TOKEN_FILE: tokenFile,
            } as NodeJS.ProcessEnv, tempDir);

            expect(resolved).toBe('new-token');
            expect(fs.readFileSync(tokenFile, 'utf-8')).toBe('new-token');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

describe('Test Routes Integration', () => {
    let app: Koa;
    let httpServer: ReturnType<typeof createServer>;
    let io: IOServer;
    let storage: MatchStorage;
    let gameTransport: GameTransportServer;
    let roomLifecycleGames: GameEngineConfig[];
    let baseURL: string;
    let tokenFileDir: string;
    const originalEnv = process.env.NODE_ENV;
    const originalToken = process.env.TEST_API_TOKEN;
    const originalTokenFile = process.env.TEST_API_TOKEN_FILE;

    beforeAll(async () => {
        // 设置测试环境
        tokenFileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-test-routes-'));
        process.env.NODE_ENV = 'test';
        process.env.TEST_API_TOKEN = TEST_TOKEN;
        process.env.TEST_API_TOKEN_FILE = path.join(tokenFileDir, 'token.txt');

        // 创建服务器
        app = new Koa();
        httpServer = createServer(app.callback());
        io = new IOServer(httpServer);
        storage = createMockStorage();
        roomLifecycleGames = [
            createMockGameEngine('smashup'),
            createLifecycleGameEngine('lifecycle-game'),
        ];

        gameTransport = new GameTransportServer({
            io,
            storage,
            games: roomLifecycleGames,
            authenticate: async (_matchID, playerID, credentials, metadata) =>
                metadata.players[playerID]?.credentials === credentials,
        });
        gameTransport.start();

        // 注册路由
        app.use(bodyParser());
        const roomRouter = createRoomLifecycleRoutes({
            storage,
            gameTransport,
            games: roomLifecycleGames,
        });
        app.use(roomRouter.routes());
        app.use(roomRouter.allowedMethods());
        const testRouter = createTestRoutes(gameTransport, storage);
        app.use(testRouter.routes());
        app.use(testRouter.allowedMethods());

        // 启动服务器
        await new Promise<void>((resolve) => {
            httpServer.listen(0, () => {
                const addr = httpServer.address();
                const port = typeof addr === 'object' && addr ? addr.port : 0;
                baseURL = `http://localhost:${port}`;
                resolve();
            });
        });
    });

    afterAll(async () => {
        // 恢复环境变量
        if (originalEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalEnv;
        }
        if (originalToken === undefined) {
            delete process.env.TEST_API_TOKEN;
        } else {
            process.env.TEST_API_TOKEN = originalToken;
        }
        if (originalTokenFile === undefined) {
            delete process.env.TEST_API_TOKEN_FILE;
        } else {
            process.env.TEST_API_TOKEN_FILE = originalTokenFile;
        }

        // 清理服务器
        await new Promise<void>((resolve) => {
            io.close(() => {
                httpServer.close(() => resolve());
            });
        });

        fs.rmSync(tokenFileDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        // 清理存储
        vi.clearAllMocks();
    });

    describe('POST /test/inject-state', () => {
        it('should inject valid state successfully', async () => {
            const matchId = 'match-1';
            const state: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: { 0: { hp: 10 }, 1: { hp: 10 } }, bases: [] },
            };

            // 设置初始状态
            await storage.setMetadata(matchId, {
                matchID: matchId,
                gameName: 'smashup',
                players: {
                    0: { id: 0, name: 'Player 0', credentials: TEST_PLAYER_CREDENTIALS, isConnected: false },
                    1: { id: 1, name: 'Player 1', credentials: 'cred-1', isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await storage.setState(matchId, {
                G: state,
                _stateID: 0,
                randomSeed: 'test-seed',
                randomCursor: 0,
            });

            const response = await fetch(`${baseURL}/test/inject-state`, {
                method: 'POST',
                headers: {
                    ...TEST_HEADERS,
                },
                body: JSON.stringify({ matchId, state }),
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.state).toEqual(state);
        });

        it('should reject invalid state (missing sys)', async () => {
            const matchId = 'match-1';
            const invalidState = {
                core: { phase: 'play', players: {} },
            };

            // 设置初始状态
            await storage.setMetadata(matchId, {
                matchID: matchId,
                gameName: 'smashup',
                players: {
                    0: { id: 0, name: 'Player 0', credentials: TEST_PLAYER_CREDENTIALS, isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });

            const response = await fetch(`${baseURL}/test/inject-state`, {
                method: 'POST',
                headers: {
                    ...TEST_HEADERS,
                },
                body: JSON.stringify({ matchId, state: invalidState }),
            });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid state');
            expect(data.details).toBeDefined();
            expect(data.details.length).toBeGreaterThan(0);
        });

        it('should return 401 without auth token', async () => {
            const response = await fetch(`${baseURL}/test/inject-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ matchId: 'match-1', state: {} }),
            });

            expect(response.status).toBe(401);
        });

        it('should return 503 when test api token is not configured', async () => {
            const previousToken = process.env.TEST_API_TOKEN;
            const previousTokenFile = process.env.TEST_API_TOKEN_FILE;
            const emptyTokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-test-routes-empty-'));
            delete process.env.TEST_API_TOKEN;
            process.env.TEST_API_TOKEN_FILE = path.join(emptyTokenDir, 'token.txt');

            try {
                const response = await fetch(`${baseURL}/test/inject-state`, {
                    method: 'POST',
                    headers: {
                        ...TEST_HEADERS,
                    },
                    body: JSON.stringify({ matchId: 'match-1', state: {} }),
                });

                expect(response.status).toBe(503);
                const data = await response.json();
                expect(data.error).toBe('Test API token is not configured');
            } finally {
                if (previousToken === undefined) {
                    delete process.env.TEST_API_TOKEN;
                } else {
                    process.env.TEST_API_TOKEN = previousToken;
                }
                if (previousTokenFile === undefined) {
                    delete process.env.TEST_API_TOKEN_FILE;
                } else {
                    process.env.TEST_API_TOKEN_FILE = previousTokenFile;
                }
                fs.rmSync(emptyTokenDir, { recursive: true, force: true });
            }
        });

        it('should return 400 without match auth headers', async () => {
            const response = await fetch(`${baseURL}/test/inject-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Test-Token': TEST_TOKEN,
                },
                body: JSON.stringify({ matchId: 'match-1', state: {} }),
            });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Missing X-Test-Player-Id or X-Test-Player-Credentials');
        });

        it('should return 403 outside explicit test environments', async () => {
            const previousEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'staging';

            try {
                const response = await fetch(`${baseURL}/test/inject-state`, {
                    method: 'POST',
                    headers: {
                        ...TEST_HEADERS,
                    },
                    body: JSON.stringify({ matchId: 'match-1', state: {} }),
                });

                expect(response.status).toBe(403);
                const data = await response.json();
                expect(data.error).toBe('Test endpoints are disabled outside explicit test/development environments');
            } finally {
                process.env.NODE_ENV = previousEnv;
            }
        });

        it('should return 403 for stale match credentials', async () => {
            const matchId = 'match-auth-mismatch';
            const state: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: { 0: { hp: 10 }, 1: { hp: 10 } } },
            };

            await storage.setMetadata(matchId, {
                matchID: matchId,
                gameName: 'smashup',
                players: {
                    0: { id: 0, name: 'Player 0', credentials: TEST_PLAYER_CREDENTIALS, isConnected: false },
                    1: { id: 1, name: 'Player 1', credentials: 'cred-1', isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });

            const response = await fetch(`${baseURL}/test/inject-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Test-Token': TEST_TOKEN,
                    'X-Test-Player-Id': TEST_PLAYER_ID,
                    'X-Test-Player-Credentials': 'stale-cred',
                },
                body: JSON.stringify({ matchId, state }),
            });

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error).toBe('Forbidden');
        });

        it('should return 400 for missing parameters', async () => {
            const response = await fetch(`${baseURL}/test/inject-state`, {
                method: 'POST',
                headers: {
                    ...TEST_HEADERS,
                },
                body: JSON.stringify({ matchId: 'match-1' }), // missing state
            });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Missing matchId or state');
        });
    });

    describe('PATCH /test/patch-state', () => {
        it('should patch state successfully', async () => {
            const matchId = 'match-1';
            const initialState: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: { 0: { hp: 10 }, 1: { hp: 10 } }, bases: [] },
            };

            // 设置初始状态
            await storage.setMetadata(matchId, {
                matchID: matchId,
                gameName: 'smashup',
                players: {
                    0: { id: 0, name: 'Player 0', credentials: TEST_PLAYER_CREDENTIALS, isConnected: false },
                    1: { id: 1, name: 'Player 1', credentials: 'cred-1', isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await storage.setState(matchId, {
                G: initialState,
                _stateID: 0,
                randomSeed: 'test-seed',
                randomCursor: 0,
            });

            const patch = {
                core: { players: { 0: { hp: 5 } } },
            };

            const response = await fetch(`${baseURL}/test/patch-state`, {
                method: 'PATCH',
                headers: {
                    ...TEST_HEADERS,
                },
                body: JSON.stringify({ matchId, patch }),
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.state.core.players[0].hp).toBe(5);
            expect(data.state.core.players[1].hp).toBe(10); // 未修改的字段保持不变
        });

        it('should return 404 for nonexistent match', async () => {
            const response = await fetch(`${baseURL}/test/patch-state`, {
                method: 'PATCH',
                headers: {
                    ...TEST_HEADERS,
                },
                body: JSON.stringify({ matchId: 'nonexistent', patch: {} }),
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Match not found');
        });
    });

    describe('GET /test/get-state/:matchId', () => {
        it('should get state successfully', async () => {
            const matchId = 'match-1';
            const state: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: { 0: { hp: 10 }, 1: { hp: 10 } } },
            };

            await storage.setMetadata(matchId, {
                matchID: matchId,
                gameName: 'smashup',
                players: {
                    0: { id: 0, name: 'Player 0', credentials: TEST_PLAYER_CREDENTIALS, isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await storage.setState(matchId, {
                G: state,
                _stateID: 0,
                randomSeed: 'test-seed',
                randomCursor: 0,
            });

            const response = await fetch(`${baseURL}/test/get-state/${matchId}`, {
                headers: {
                    'X-Test-Token': TEST_TOKEN,
                    'X-Test-Player-Id': TEST_PLAYER_ID,
                    'X-Test-Player-Credentials': TEST_PLAYER_CREDENTIALS,
                },
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.state).toEqual(state);
            expect(data.metadata).toBeDefined();
            expect(data._stateID).toBe(0);
        });

        it('should return 404 for nonexistent match', async () => {
            const response = await fetch(`${baseURL}/test/get-state/nonexistent`, {
                headers: {
                    'X-Test-Token': TEST_TOKEN,
                    'X-Test-Player-Id': TEST_PLAYER_ID,
                    'X-Test-Player-Credentials': TEST_PLAYER_CREDENTIALS,
                },
            });

            expect(response.status).toBe(404);
        });
    });

    describe('POST /test/snapshot-state', () => {
        it('should create snapshot successfully', async () => {
            const matchId = 'match-1';
            const state: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: {}, bases: [] },
            };

            await storage.setState(matchId, {
                G: state,
                _stateID: 0,
                randomSeed: 'test-seed',
                randomCursor: 0,
            });

            const response = await fetch(`${baseURL}/test/snapshot-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Test-Token': TEST_TOKEN,
                    'X-Test-Player-Id': TEST_PLAYER_ID,
                    'X-Test-Player-Credentials': TEST_PLAYER_CREDENTIALS,
                },
                body: JSON.stringify({ matchId }),
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.snapshotId).toContain(matchId);
        });
    });

    describe('POST /test/restore-state', () => {
        it('should restore snapshot successfully', async () => {
            const matchId = 'match-1';
            const state: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: {}, bases: [] },
            };

            // 设置初始状态
            await storage.setMetadata(matchId, {
                matchID: matchId,
                gameName: 'smashup',
                players: {
                    0: { id: 0, name: 'Player 0', credentials: TEST_PLAYER_CREDENTIALS, isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await storage.setState(matchId, {
                G: state,
                _stateID: 0,
                randomSeed: 'test-seed',
                randomCursor: 0,
            });

            // 创建快照
            const snapshotResponse = await fetch(`${baseURL}/test/snapshot-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Test-Token': TEST_TOKEN,
                    'X-Test-Player-Id': TEST_PLAYER_ID,
                    'X-Test-Player-Credentials': TEST_PLAYER_CREDENTIALS,
                },
                body: JSON.stringify({ matchId }),
            });
            expect(snapshotResponse.status).toBe(200);
            const snapshotData = await snapshotResponse.json();
            const snapshotId = snapshotData.snapshotId;

            // 恢复快照
            const restoreResponse = await fetch(`${baseURL}/test/restore-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Test-Token': TEST_TOKEN,
                    'X-Test-Player-Id': TEST_PLAYER_ID,
                    'X-Test-Player-Credentials': TEST_PLAYER_CREDENTIALS,
                },
                body: JSON.stringify({ matchId, snapshotId }),
            });

            const restoreBody = await restoreResponse.text();
            expect(restoreResponse.status, restoreBody).toBe(200);
            const restoreData = JSON.parse(restoreBody);
            expect(restoreData.success).toBe(true);
        });

        it('should return 404 for nonexistent snapshot', async () => {
            const response = await fetch(`${baseURL}/test/restore-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Test-Token': TEST_TOKEN,
                    'X-Test-Player-Id': TEST_PLAYER_ID,
                    'X-Test-Player-Credentials': TEST_PLAYER_CREDENTIALS,
                },
                body: JSON.stringify({ matchId: 'match-1', snapshotId: 'nonexistent' }),
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Snapshot not found');
        });
    });

    describe('room lifecycle integration', () => {
        it('covers create -> join -> sync -> command -> leave through REST and /game socket', async () => {
            const sockets: ClientSocket[] = [];
            const closeSockets = async () => {
                await Promise.all(
                    sockets.map((socket) => new Promise<void>((resolve) => {
                        if (!socket.connected) {
                            socket.close();
                            resolve();
                            return;
                        }
                        socket.once('disconnect', () => resolve());
                        socket.close();
                    })),
                );
            };

            try {
                const createResponse = await fetch(`${baseURL}/games/lifecycle-game/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ numPlayers: 2 }),
                });
                expect(createResponse.status).toBe(200);
                const { matchID } = await createResponse.json() as { matchID: string };
                expect(matchID).toContain('lifecycle-match-');

                const initialMatchResponse = await fetch(`${baseURL}/games/lifecycle-game/${matchID}`);
                expect(initialMatchResponse.status).toBe(200);
                const initialMatch = await initialMatchResponse.json() as {
                    status: string;
                    players: Array<{ id: number; name?: string; isConnected?: boolean }>;
                };
                expect(initialMatch.status).toBe('waiting');
                expect(initialMatch.players).toHaveLength(2);

                const joinPlayer0Response = await fetch(`${baseURL}/games/lifecycle-game/${matchID}/join`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ playerID: '0', playerName: 'Alice' }),
                });
                expect(joinPlayer0Response.status).toBe(200);
                const { playerCredentials: player0Credentials } = await joinPlayer0Response.json() as {
                    playerCredentials: string;
                };

                const joinPlayer1Response = await fetch(`${baseURL}/games/lifecycle-game/${matchID}/join`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ playerID: '1', playerName: 'Bob' }),
                });
                expect(joinPlayer1Response.status).toBe(200);
                const { playerCredentials: player1Credentials } = await joinPlayer1Response.json() as {
                    playerCredentials: string;
                };

                const player0Socket = createClient(`${baseURL}/game`, {
                    transports: ['websocket'],
                    forceNew: true,
                    reconnection: false,
                });
                const player1Socket = createClient(`${baseURL}/game`, {
                    transports: ['websocket'],
                    forceNew: true,
                    reconnection: false,
                });
                sockets.push(player0Socket, player1Socket);

                await Promise.all([
                    waitForClientSocketEvent(player0Socket, 'connect'),
                    waitForClientSocketEvent(player1Socket, 'connect'),
                ]);

                const player0SyncPromise = waitForClientSocketEvent<
                    [string, { core: { counter: number } }, Array<{ id: number }>, { seed: string; cursor: number }]
                >(player0Socket, 'state:sync');
                player0Socket.emit('sync', matchID, '0', player0Credentials);
                const [player0SyncMatchID, player0State] = await player0SyncPromise;
                expect(player0SyncMatchID).toBe(matchID);
                expect(player0State.core.counter).toBe(0);

                const player1SyncPromise = waitForClientSocketEvent<
                    [string, { core: { counter: number } }, Array<{ id: number }>, { seed: string; cursor: number }]
                >(player1Socket, 'state:sync');
                player1Socket.emit('sync', matchID, '1', player1Credentials);
                const [player1SyncMatchID, player1State] = await player1SyncPromise;
                expect(player1SyncMatchID).toBe(matchID);
                expect(player1State.core.counter).toBe(0);

                const connectedMatchResponse = await fetch(`${baseURL}/games/lifecycle-game/${matchID}`);
                expect(connectedMatchResponse.status).toBe(200);
                const connectedMatch = await connectedMatchResponse.json() as {
                    status: string;
                    players: Array<{ id: number; name?: string; isConnected?: boolean }>;
                };
                expect(connectedMatch.status).toBe('playing');
                expect(connectedMatch.players.find((player) => player.id === 0)?.isConnected).toBe(true);
                expect(connectedMatch.players.find((player) => player.id === 1)?.isConnected).toBe(true);

                const player0PatchPromise = waitForClientSocketEvent<
                    [string, unknown[], Array<{ id: number; isConnected?: boolean }>, { stateID: number; randomCursor: number }]
                >(player0Socket, 'state:patch');
                const player1PatchPromise = waitForClientSocketEvent<
                    [string, unknown[], Array<{ id: number; isConnected?: boolean }>, { stateID: number; randomCursor: number }]
                >(player1Socket, 'state:patch');
                player0Socket.emit('command', matchID, 'INCREMENT_COUNTER', { by: 1 }, player0Credentials);
                const [player0PatchMatchID, player0Patches, , player0Meta] = await player0PatchPromise;
                const [player1PatchMatchID, player1Patches] = await player1PatchPromise;
                expect(player0PatchMatchID).toBe(matchID);
                expect(player1PatchMatchID).toBe(matchID);
                expect(player0Patches.length).toBeGreaterThan(0);
                expect(player1Patches.length).toBeGreaterThan(0);
                expect(player0Meta.stateID).toBe(1);

                const storedMatch = await storage.fetch(matchID, { state: true, metadata: true });
                const storedCounter = (storedMatch.state?.G as { core?: { counter?: number } } | undefined)?.core?.counter;
                expect(storedCounter).toBe(1);
                expect(storedMatch.metadata?.players['0']?.isConnected).toBe(true);

                const player0DisconnectPromise = waitForClientSocketEvent(player0Socket, 'disconnect');
                const leavePlayer0Response = await fetch(`${baseURL}/games/lifecycle-game/${matchID}/leave`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ playerID: '0', credentials: player0Credentials }),
                });
                expect(leavePlayer0Response.status).toBe(200);
                await player0DisconnectPromise;

                const afterLeaveResponse = await fetch(`${baseURL}/games/lifecycle-game/${matchID}`);
                expect(afterLeaveResponse.status).toBe(200);
                const afterLeaveMatch = await afterLeaveResponse.json() as {
                    status: string;
                    players: Array<{ id: number; name?: string; isConnected?: boolean }>;
                };
                expect(afterLeaveMatch.status).toBe('waiting');
                const player0Seat = afterLeaveMatch.players.find((player) => player.id === 0);
                expect(player0Seat?.name).toBeUndefined();
                expect(player0Seat?.isConnected).toBe(false);
            } finally {
                await closeSockets();
            }
        });
    });
});
