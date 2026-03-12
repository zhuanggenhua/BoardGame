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
import bodyParser from 'koa-bodyparser';
import { Server as IOServer } from 'socket.io';
import { createServer } from 'http';
import type { MatchState } from '../../../core/types';
import type { MatchStorage, StoredMatchState, MatchMetadata } from '../../../engine/transport/storage';
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

        gameTransport = new GameTransportServer({
            io,
            storage,
            games: [createMockGameEngine('smashup')],
            authenticate: async (_matchID, playerID, credentials, metadata) =>
                metadata.players[playerID]?.credentials === credentials,
        });

        // 注册路由
        app.use(bodyParser());
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
});
