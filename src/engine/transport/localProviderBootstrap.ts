import type { DomainSetupContext, MatchState, RandomFn } from '../types';
import type { EngineSystem } from '../systems/types';
import type { GameEngineConfig } from './engineConfig';
import {
    createSeededRandom,
    createInitialSystemState,
} from '../pipeline';
import { TestHarness, isTestEnvironment } from '../testing';
import { setUndoAiSeatIds } from '../systems/UndoSystem';
import {
    isPersistedLocalStateCompatible,
    normalizePersistedLocalStateForGame,
    normalizeStateForConfig,
} from './stateNormalization';

type LocalProviderRandom = RandomFn & {
    getCursor: () => number;
};

function readLocalProviderTestConfig(): Record<string, unknown> | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }
    return (window as Window & {
        __BG_TEST_CONFIG__?: Record<string, unknown>;
    }).__BG_TEST_CONFIG__;
}

export function createLocalProviderRandom(seed: string, initialCursor = 0): LocalProviderRandom {
    const base = createSeededRandom(seed);
    const normalizedCursor = Number.isFinite(initialCursor) && initialCursor > 0
        ? Math.floor(initialCursor)
        : 0;

    for (let i = 0; i < normalizedCursor; i += 1) {
        base.random();
    }

    let cursor = normalizedCursor;

    if (!isTestEnvironment()) {
        return {
            random: () => {
                cursor += 1;
                return base.random();
            },
            d: (max: number) => {
                cursor += 1;
                return Math.floor(base.random() * max) + 1;
            },
            range: (min: number, max: number) => {
                cursor += 1;
                return Math.floor(base.random() * (max - min + 1)) + min;
            },
            shuffle: <T,>(array: T[]): T[] => {
                const result = [...array];
                cursor += Math.max(0, result.length - 1);
                for (let i = result.length - 1; i > 0; i -= 1) {
                    const j = Math.floor(base.random() * (i + 1));
                    [result[i], result[j]] = [result[j], result[i]];
                }
                return result;
            },
            getCursor: () => cursor,
        };
    }

    TestHarness.init();
    const harness = TestHarness.getInstance();
    const nextRandom = harness.random.wrap(() => base.random());

    return {
        random: () => {
            cursor += 1;
            return nextRandom();
        },
        d: (max: number) => {
            cursor += 1;
            return Math.floor(nextRandom() * max) + 1;
        },
        range: (min: number, max: number) => {
            cursor += 1;
            return Math.floor(nextRandom() * (max - min + 1)) + min;
        },
        shuffle: <T,>(array: T[]): T[] => {
            const result = [...array];
            cursor += Math.max(0, result.length - 1);
            for (let i = result.length - 1; i > 0; i -= 1) {
                const j = Math.floor(nextRandom() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },
        getCursor: () => cursor,
    };
}

type LocalProviderSetup = {
    config: GameEngineConfig;
    aiSeatIds: string[];
    initialRandom: LocalProviderRandom;
    setupData: unknown;
    setupPlayerIds: string[];
    setupContext: DomainSetupContext;
};

export function createInitialLocalProviderState(
    args: LocalProviderSetup & { persistedState: MatchState<unknown> | null | undefined },
): MatchState<unknown> {
    const {
        config,
        persistedState,
        aiSeatIds,
        initialRandom,
        setupData,
        setupPlayerIds,
    } = args;
    if (persistedState && isPersistedLocalStateCompatible({
        state: persistedState,
        expectedPlayerIds: setupPlayerIds,
    })) {
        return setUndoAiSeatIds(
            normalizePersistedLocalStateForGame(config, persistedState),
            aiSeatIds,
        );
    }

    const testConfig = readLocalProviderTestConfig();
    if (testConfig) {
        const testInitialState = config.createLocalTestInitialState?.({
            testConfig,
            random: initialRandom,
            setupData,
            setupPlayerIds,
            aiSeatIds,
        });
        if (testInitialState) {
            return setUndoAiSeatIds(
                normalizeStateForConfig(config, testInitialState),
                aiSeatIds,
            );
        }
    }

    return createFreshLocalProviderState(args);
}

export function createFreshLocalProviderState({
    config, aiSeatIds, initialRandom, setupData, setupPlayerIds, setupContext,
}: LocalProviderSetup): MatchState<unknown> {
    const core = config.domain.setup(setupPlayerIds, initialRandom, setupData, setupContext);
    const sys = createInitialSystemState(
        setupPlayerIds,
        config.systems as EngineSystem[],
    );
    const initial = { sys, core };
    const state = setupContext.mode === 'tutorial' && config.prepareLocalTutorialMatch
        ? config.prepareLocalTutorialMatch(initial, setupPlayerIds)
        : initial;
    return setUndoAiSeatIds(
        normalizeStateForConfig(config, state),
        aiSeatIds,
    );
}

export type { LocalProviderRandom };
