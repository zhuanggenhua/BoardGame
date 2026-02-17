/**
 * 状态验证器单元测试
 * 
 * Property 3: 无效状态被拒绝
 * Property 4: 验证器列出所有错误
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { validateMatchState, deepMerge, type ValidationError } from '../stateValidator';
import type { MatchState } from '../../types';
import type { MatchStorage } from '../storage';

// Mock storage
const createMockStorage = (gameName: string): MatchStorage => ({
    fetch: vi.fn().mockResolvedValue({
        metadata: { gameName },
    }),
    setState: vi.fn(),
    setMetadata: vi.fn(),
    wipe: vi.fn(),
    list: vi.fn(),
    listMatches: vi.fn(),
});

describe('stateValidator', () => {
    describe('validateMatchState', () => {
        describe('Property 3: 无效状态被拒绝', () => {
            it('should reject state missing sys field', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    core: { phase: 'play', players: {}, bases: [] },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    field: 'sys',
                    message: 'Missing sys field',
                });
            });

            it('should reject state missing core field', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    sys: { matchId: 'match-1', turnOrder: [0, 1], currentPlayerIndex: 0 },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    field: 'core',
                    message: 'Missing core field',
                });
            });

            it('should reject state with mismatched matchId', async () => {
                const storage = createMockStorage('smashup');
                const state: MatchState<unknown> = {
                    sys: { matchId: 'wrong-id', turnOrder: [0, 1], currentPlayerIndex: 0 },
                    core: { phase: 'play', players: {}, bases: [] },
                };

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    field: 'sys.matchId',
                    message: 'matchId mismatch',
                    expected: 'match-1',
                    actual: 'wrong-id',
                });
            });

            it('should reject state missing turnOrder', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    sys: { matchId: 'match-1', currentPlayerIndex: 0 },
                    core: { phase: 'play', players: {}, bases: [] },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    field: 'sys.turnOrder',
                    message: 'Missing or invalid turnOrder',
                });
            });

            it('should reject state missing currentPlayerIndex', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    sys: { matchId: 'match-1', turnOrder: [0, 1] },
                    core: { phase: 'play', players: {}, bases: [] },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    field: 'sys.currentPlayerIndex',
                    message: 'Missing or invalid currentPlayerIndex',
                });
            });

            it('should reject SmashUp state missing phase', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    sys: { matchId: 'match-1', turnOrder: [0, 1], currentPlayerIndex: 0 },
                    core: { players: {}, bases: [] },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    field: 'core.phase',
                    message: 'Missing or invalid phase',
                });
            });

            it('should reject SmashUp state missing bases', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    sys: { matchId: 'match-1', turnOrder: [0, 1], currentPlayerIndex: 0 },
                    core: { phase: 'play', players: {} },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    field: 'core.bases',
                    message: 'Missing or invalid bases',
                });
            });

            it('should reject SummonerWars state missing board', async () => {
                const storage = createMockStorage('summonerwars');
                const state = {
                    sys: { matchId: 'match-1', turnOrder: [0, 1], currentPlayerIndex: 0 },
                    core: { phase: 'play', players: {} },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    field: 'core.board',
                    message: 'Missing or invalid board',
                });
            });

            it('should accept valid state', async () => {
                const storage = createMockStorage('smashup');
                const state: MatchState<unknown> = {
                    sys: { matchId: 'match-1', turnOrder: [0, 1], currentPlayerIndex: 0 },
                    core: { phase: 'play', players: {}, bases: [] },
                };

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(true);
                expect(result.errors).toEqual([]);
            });
        });

        describe('Property 4: 验证器列出所有错误', () => {
            it('should list all validation errors, not just the first one', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    // Missing sys
                    core: {
                        // Missing phase
                        players: {},
                        // Missing bases
                    },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                // Should have at least 3 errors: missing sys, missing phase, missing bases
                expect(result.errors.length).toBeGreaterThanOrEqual(3);
                
                const errorFields = result.errors.map(e => e.field);
                expect(errorFields).toContain('sys');
                expect(errorFields).toContain('core.phase');
                expect(errorFields).toContain('core.bases');
            });

            it('should list multiple sys field errors', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    sys: {
                        matchId: 'wrong-id',
                        // Missing turnOrder
                        // Missing currentPlayerIndex
                    },
                    core: { phase: 'play', players: {}, bases: [] },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThanOrEqual(3);
                
                const errorFields = result.errors.map(e => e.field);
                expect(errorFields).toContain('sys.matchId');
                expect(errorFields).toContain('sys.turnOrder');
                expect(errorFields).toContain('sys.currentPlayerIndex');
            });

            it('should list all game-specific errors', async () => {
                const storage = createMockStorage('smashup');
                const state = {
                    sys: { matchId: 'match-1', turnOrder: [0, 1], currentPlayerIndex: 0 },
                    core: {
                        // Missing phase
                        // Missing players
                        // Missing bases
                    },
                } as any;

                const result = await validateMatchState('match-1', state, storage);

                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThanOrEqual(3);
                
                const errorFields = result.errors.map(e => e.field);
                expect(errorFields).toContain('core.phase');
                expect(errorFields).toContain('core.players');
                expect(errorFields).toContain('core.bases');
            });
        });

        describe('Property-based tests', () => {
            it('should always reject states missing required fields', async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.string({ minLength: 1 }),
                        fc.constantFrom('smashup', 'dicethrone', 'summonerwars'),
                        async (matchId, gameName) => {
                            const storage = createMockStorage(gameName);
                            
                            // Test missing sys
                            const noSys = { core: {} } as any;
                            const result1 = await validateMatchState(matchId, noSys, storage);
                            expect(result1.valid).toBe(false);
                            
                            // Test missing core
                            const noCore = { sys: { matchId, turnOrder: [0, 1], currentPlayerIndex: 0 } } as any;
                            const result2 = await validateMatchState(matchId, noCore, storage);
                            expect(result2.valid).toBe(false);
                        }
                    ),
                    { numRuns: 50 }
                );
            });
        });
    });

    describe('deepMerge', () => {
        it('should merge simple objects', () => {
            const target = { a: 1, b: 2 };
            const source = { b: 3, c: 4 };
            const result = deepMerge(target, source);

            expect(result).toEqual({ a: 1, b: 3, c: 4 });
        });

        it('should deep merge nested objects', () => {
            const target = { a: { x: 1, y: 2 }, b: 3 };
            const source = { a: { y: 4, z: 5 } };
            const result = deepMerge(target, source);

            expect(result).toEqual({ a: { x: 1, y: 4, z: 5 }, b: 3 });
        });

        it('should replace arrays instead of merging', () => {
            const target = { arr: [1, 2, 3] };
            const source = { arr: [4, 5] };
            const result = deepMerge(target, source);

            expect(result).toEqual({ arr: [4, 5] });
        });

        it('should not mutate target', () => {
            const target = { a: { x: 1 } };
            const source = { a: { y: 2 } };
            const result = deepMerge(target, source);

            expect(target).toEqual({ a: { x: 1 } });
            expect(result).toEqual({ a: { x: 1, y: 2 } });
        });

        it('should handle partial updates', () => {
            const target = {
                sys: { matchId: 'match-1', turnOrder: [0, 1], currentPlayerIndex: 0 },
                core: { phase: 'play', players: { 0: { hp: 10 }, 1: { hp: 10 } } },
            };
            const source = {
                core: { players: { 0: { hp: 5 } } },
            };
            const result = deepMerge(target, source);

            expect(result.sys).toEqual(target.sys);
            expect(result.core.phase).toBe('play');
            expect(result.core.players[0].hp).toBe(5);
            expect(result.core.players[1].hp).toBe(10);
        });
    });
});
