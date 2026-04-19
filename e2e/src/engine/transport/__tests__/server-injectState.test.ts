/**
 * GameTransportServer.injectState 方法单元测试
 * 
 * Property 1: 状态注入接口正确性
 * Property 11: 状态注入原子性
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { Server as IOServer } from 'socket.io';
import { createServer } from 'http';
import type { MatchState, PlayerId } from '../../types';
import type { MatchStorage, StoredMatchState, MatchMetadata } from '../storage';
import type { GameEngineConfig } from '../server';

// 创建最小化的 mock storage
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
    };
};

// 创建最小化的游戏引擎配置
const createMockGameEngine = (gameId: string): GameEngineConfig => ({
    gameId,
    domain: {
        setup: (playerIds: PlayerId[]) => ({
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

describe('GameTransportServer.injectState', () => {
    let httpServer: ReturnType<typeof createServer>;
    let io: IOServer;
    let storage: MatchStorage;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        // 设置测试环境
        process.env.NODE_ENV = 'test';
        
        httpServer = createServer();
        io = new IOServer(httpServer);
        storage = createMockStorage();
    });

    afterEach(async () => {
        // 恢复环境变量
        process.env.NODE_ENV = originalEnv;
        
        // 清理 socket.io
        await new Promise<void>((resolve) => {
            io.close(() => {
                httpServer.close(() => resolve());
            });
        });
    });

    describe('Property 1: 状态注入接口正确性', () => {
        it('should accept valid matchId and state', async () => {
            // 动态导入以避免模块缓存问题
            const { GameTransportServer } = await import('../server');
            
            const server = new GameTransportServer({
                io,
                storage,
                games: [createMockGameEngine('smashup')],
            });

            const matchId = 'match-1';
            const state: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: { 0: { hp: 10 }, 1: { hp: 10 } } },
            };

            // 先设置初始状态
            await storage.setMetadata(matchId, {
                matchID: matchId,
                gameName: 'smashup',
                players: {
                    0: { id: 0, name: 'Player 0', credentials: '', isConnected: false },
                    1: { id: 1, name: 'Player 1', credentials: '', isConnected: false },
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

            // 注入新状态
            const newState: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 1 },
                core: { phase: 'play', players: { 0: { hp: 5 }, 1: { hp: 8 } } },
            };

            await server.injectState(matchId, newState);

            // 验证状态已更新
            const result = await storage.fetch(matchId, { state: true });
            expect(result.state?.G).toEqual(newState);
            expect(result.state?._stateID).toBe(1);
        });

        it('should throw error if match not found', async () => {
            const { GameTransportServer } = await import('../server');
            
            const server = new GameTransportServer({
                io,
                storage,
                games: [createMockGameEngine('smashup')],
            });

            const state: MatchState<unknown> = {
                sys: { matchId: 'nonexistent', turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: {} },
            };

            await expect(server.injectState('nonexistent', state)).rejects.toThrow('Match nonexistent not found');
        });

        it('should throw error in production environment', async () => {
            process.env.NODE_ENV = 'production';
            
            const { GameTransportServer } = await import('../server');
            
            const server = new GameTransportServer({
                io,
                storage,
                games: [createMockGameEngine('smashup')],
            });

            const state: MatchState<unknown> = {
                sys: { matchId: 'match-1', turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: {} },
            };

            await expect(server.injectState('match-1', state)).rejects.toThrow(
                'injectState is only available in test/development environment'
            );
        });
    });

    describe('Property 11: 状态注入原子性', () => {
        it('should not modify state if storage fails', async () => {
            const { GameTransportServer } = await import('../server');
            
            // 创建会失败的 storage
            const states = new Map<string, StoredMatchState>();
            const metadatas = new Map<string, MatchMetadata>();
            
            const failingStorage: MatchStorage = {
                fetch: vi.fn(async (matchId: string, opts?: { state?: boolean; metadata?: boolean }) => {
                    const result: { state?: StoredMatchState; metadata?: MatchMetadata } = {};
                    if (opts?.state) result.state = states.get(matchId);
                    if (opts?.metadata) result.metadata = metadatas.get(matchId);
                    return result;
                }),
                setState: vi.fn(async () => {
                    throw new Error('Storage error');
                }),
                setMetadata: vi.fn(async (matchId: string, metadata: MatchMetadata) => {
                    metadatas.set(matchId, metadata);
                }),
                wipe: vi.fn(),
                list: vi.fn(),
                listMatches: vi.fn(),
            };

            const server = new GameTransportServer({
                io,
                storage: failingStorage,
                games: [createMockGameEngine('smashup')],
            });

            const matchId = 'match-1';
            const initialState: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: { 0: { hp: 10 }, 1: { hp: 10 } } },
            };

            // 设置初始状态
            await failingStorage.setMetadata(matchId, {
                matchID: matchId,
                gameName: 'smashup',
                players: {
                    0: { id: 0, name: 'Player 0', credentials: '', isConnected: false },
                    1: { id: 1, name: 'Player 1', credentials: '', isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            
            // 手动设置初始状态到 Map（绕过 setState 的失败）
            states.set(matchId, {
                G: initialState,
                _stateID: 0,
                randomSeed: 'test-seed',
                randomCursor: 0,
            });

            const newState: MatchState<unknown> = {
                sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 1 },
                core: { phase: 'play', players: { 0: { hp: 5 }, 1: { hp: 8 } } },
            };

            // 注入应该失败
            await expect(server.injectState(matchId, newState)).rejects.toThrow('Storage error');

            // 验证状态未被修改（仍然是初始状态）
            const result = await failingStorage.fetch(matchId, { state: true });
            expect(result.state?.G).toEqual(initialState);
            expect(result.state?._stateID).toBe(0);
        });
    });

    describe('Property-based tests', () => {
        it('should correctly update state for any valid input', async () => {
            const { GameTransportServer } = await import('../server');
            
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1 }),
                    fc.integer({ min: 0, max: 1 }),
                    fc.integer({ min: 1, max: 100 }),
                    async (matchId, currentPlayerIndex, hp) => {
                        const testStorage = createMockStorage();
                        const server = new GameTransportServer({
                            io,
                            storage: testStorage,
                            games: [createMockGameEngine('smashup')],
                        });

                        const state: MatchState<unknown> = {
                            sys: { matchId, turnOrder: [0, 1], currentPlayerIndex },
                            core: { phase: 'play', players: { 0: { hp }, 1: { hp } } },
                        };

                        // 设置初始状态
                        await testStorage.setMetadata(matchId, {
                            matchID: matchId,
                            gameName: 'smashup',
                            players: {
                                0: { id: 0, name: 'Player 0', credentials: '', isConnected: false },
                                1: { id: 1, name: 'Player 1', credentials: '', isConnected: false },
                            },
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        });
                        await testStorage.setState(matchId, {
                            G: state,
                            _stateID: 0,
                            randomSeed: 'test-seed',
                            randomCursor: 0,
                        });

                        // 注入状态
                        await server.injectState(matchId, state);

                        // 验证状态已保存
                        const result = await testStorage.fetch(matchId, { state: true });
                        expect(result.state?.G).toEqual(state);
                    }
                ),
                { numRuns: 20 }
            );
        });
    });
});
