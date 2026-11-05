import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../pipeline';
import { stampStateVersion, validateStateFields } from '../../statePersistence';
import type { Command, DomainCore, GameEvent } from '../../types';
import type { AnyGameEngineConfig } from '../engineConfig';
import { MatchRoomRegistry } from '../matchRoomRegistry';
import { GameEngineRegistry } from '../gameEngineRegistry';
import type { FetchResult, MatchStorage } from '../storage';

interface CounterCore { playerIds: string[]; count: number }

// Synthetic domains exercise registry/room contracts, not 100 real rulesets or
// production throughput. No timing threshold is inferred from this fixture.
describe('100-domain registry and room isolation', () => {
    it('restores two rooms per domain and isolates command state, RNG and queues', async () => {
        const gameIndex = new Map<string, AnyGameEngineConfig>();
        const saved = new Map<string, FetchResult>();
        for (let game = 0; game < 100; game += 1) {
            const gameId = `scale-domain-${game}`;
            const domain: DomainCore<CounterCore> = {
                gameId,
                statePersistence: {
                    version: 1,
                    validate: state => validateStateFields(state, { 'core.playerIds': 'strings', 'core.count': 'number' }),
                },
                setup: playerIds => ({ playerIds, count: 0 }),
                validate: () => ({ valid: true }),
                execute: (_state, command, random) => [{ type: 'added', payload: { delta: random.d(6) }, timestamp: command.timestamp }],
                reduce: (core, event) => ({ ...core, count: core.count + (event.payload as { delta: number }).delta }),
            };
            gameIndex.set(gameId, { gameId, domain, systems: [], minPlayers: 1, maxPlayers: 1 });
            for (const room of ['a', 'b']) {
                saved.set(`${gameId}:${room}`, {
                    state: {
                        G: stampStateVersion(gameId, domain.statePersistence, {
                            core: domain.setup(['0'], createSeededRandom('scale')),
                            sys: createInitialSystemState(['0'], []),
                        }),
                        _stateID: 0, randomSeed: 'identical-seed', randomCursor: 0,
                    },
                    metadata: { gameName: gameId, players: { '0': { name: 'seat' } }, createdAt: 0, updatedAt: 0 },
                });
            }
        }
        const fetch = vi.fn(async (matchId: string) => structuredClone(saved.get(matchId) ?? {}));
        const storage: MatchStorage = { fetch, setState: vi.fn(), setMetadata: vi.fn(), wipe: vi.fn(), list: vi.fn(), listMatches: vi.fn() };
        const loaders = [...gameIndex.entries()].map(([gameId, engine]) => ({ gameId, loadEngine: vi.fn(async () => engine) }));
        const lazyIndex = new GameEngineRegistry([], loaders);
        const registry = new MatchRoomRegistry({ storage, gameIndex: lazyIndex });
        expect(loaders.every(loader => loader.loadEngine.mock.calls.length === 0)).toBe(true);
        for (let game = 0; game < 100; game += 1) {
            const gameId = `scale-domain-${game}`;
            const [first, duplicate] = await Promise.all([registry.getOrLoad(`${gameId}:a`), registry.getOrLoad(`${gameId}:a`)]);
            expect(first).toBe(duplicate);
            expect(first).toBeTruthy();
            const second = (await registry.getOrLoad(`${gameId}:b`))!;
            expect(first.engineConfig).toBe(gameIndex.get(gameId));
            expect(first.state).not.toBe(second.state);
            expect(first.commandQueue).not.toBe(second.commandQueue);
            const command: Command = { type: 'add', playerId: '0', payload: {}, timestamp: 1 };
            const result = executePipeline<unknown, Command, GameEvent>(
                { domain: first.engineConfig.domain, systems: [] }, first.state, command, first.random, ['0'],
            );
            expect(result.success).toBe(true);
            first.state = result.state;
            expect((first.state.core as CounterCore).count).toBeGreaterThan(0);
            expect((second.state.core as CounterCore).count).toBe(0);
            expect(first.getRandomCursor()).toBe(1);
            expect(second.getRandomCursor()).toBe(0);
            expect(await registry.getOrLoad(`${gameId}:a`)).toBe(first);
        }
        expect([...registry.values()]).toHaveLength(200);
        expect(fetch).toHaveBeenCalledTimes(200);
        expect(loaders.every(loader => loader.loadEngine.mock.calls.length === 1)).toBe(true);
    });
});
