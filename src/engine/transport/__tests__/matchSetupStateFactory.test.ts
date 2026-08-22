import { describe, expect, it } from 'vitest';
import type { GameEngineConfig } from '../engineConfig';
import type { PlayerId } from '../../types';
import { createMatchSetupState } from '../matchSetupStateFactory';

type TestCore = {
    setupPlayerIds: PlayerId[];
    setupData: unknown;
    currentPlayer: PlayerId;
    initRoll?: number;
};

function createEngineConfig(
    setup?: GameEngineConfig<TestCore>['domain']['setup'],
): GameEngineConfig<TestCore> {
    return {
        gameId: 'test-game',
        domain: {
            gameId: 'test-game',
            setup: setup ?? ((playerIds, _random, setupData) => ({
                setupPlayerIds: [...playerIds],
                setupData,
                currentPlayer: playerIds[0],
            })),
            validate: () => ({ valid: true }),
            execute: () => [],
            reduce: (core) => core,
        },
        systems: [],
    };
}

describe('createMatchSetupState', () => {
    it('使用 seeded random 调用 domain.setup，并返回消耗后的随机游标', () => {
        const result = createMatchSetupState({
            matchID: 'match-seeded',
            engineConfig: createEngineConfig((playerIds, random, setupData) => ({
                setupPlayerIds: [...playerIds],
                setupData,
                currentPlayer: playerIds[0],
                initRoll: random.d(6),
            })),
            playerIds: ['0', '1'],
            seed: 'setup-seed',
        });

        expect(result.randomCursor).toBeGreaterThan(0);
        expect((result.state.core as TestCore).initRoll).toBeGreaterThanOrEqual(1);
        expect((result.state.core as TestCore).initRoll).toBeLessThanOrEqual(6);
    });

    it('原样透传 setupData 给 domain.setup', () => {
        const setupData = {
            firstPlayerId: '1',
            custom: { source: 'caller' },
        };

        const result = createMatchSetupState({
            matchID: 'match-setup-data',
            engineConfig: createEngineConfig(),
            playerIds: ['0', '1'],
            seed: 'setup-data-seed',
            setupData,
        });

        expect((result.state.core as TestCore).setupData).toBe(setupData);
    });

    it('混合人机且未显式指定先手时，把第一个真人座位旋到 setup 首位', () => {
        const result = createMatchSetupState({
            matchID: 'match-human-first',
            engineConfig: createEngineConfig(),
            playerIds: ['0', '1', '2'],
            seed: 'human-first-seed',
            setupData: {
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'human' },
                    '2': { type: 'remote-ai' },
                },
            },
        });

        expect((result.state.core as TestCore).setupPlayerIds).toEqual(['1', '2', '0']);
    });

    it('显式 firstPlayerId 或 turnOrder 存在时，不覆盖调用方传入的座位顺序', () => {
        for (const setupData of [
            {
                firstPlayerId: '0',
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'human' },
                },
            },
            {
                turnOrder: ['0', '1'],
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'human' },
                },
            },
        ]) {
            const result = createMatchSetupState({
                matchID: 'match-explicit-order',
                engineConfig: createEngineConfig(),
                playerIds: ['0', '1'],
                seed: 'explicit-order-seed',
                setupData,
            });

            expect((result.state.core as TestCore).setupPlayerIds).toEqual(['0', '1']);
        }
    });

    it('把 AI 座位写入撤回系统，供多人撤回握手跳过自动席位', () => {
        const result = createMatchSetupState({
            matchID: 'match-ai-undo',
            engineConfig: createEngineConfig(),
            playerIds: ['0', '1', '2'],
            seed: 'ai-undo-seed',
            setupData: {
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                    '2': { type: 'remote-ai' },
                },
            },
        });

        expect(result.state.sys.matchId).toBe('match-ai-undo');
        expect(result.state.sys.undo.aiSeatIds).toEqual(['1', '2']);
    });
});
