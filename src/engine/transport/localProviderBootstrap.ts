import type { Command, GameEvent, MatchState, RandomFn } from '../types';
import type { EngineSystem } from '../systems/types';
import type { GameEngineConfig } from './server';
import {
    executePipeline,
    createSeededRandom,
    createInitialSystemState,
    type PipelineConfig,
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

type LocalProviderTestConfig = {
    skipInitialization?: boolean;
    skipFactionSelect?: boolean;
    player0Factions?: string[];
    player1Factions?: string[];
};

function readLocalProviderTestConfig(): LocalProviderTestConfig | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }
    return (window as Window & {
        __BG_TEST_CONFIG__?: LocalProviderTestConfig;
    }).__BG_TEST_CONFIG__;
}

function buildSkippedInitializationState(args: {
    config: GameEngineConfig;
    setupPlayerIds: string[];
    aiSeatIds: string[];
}): MatchState<unknown> {
    const { config, setupPlayerIds, aiSeatIds } = args;
    const core: {
        players: Record<string, {
            id: string;
            vp: number;
            hand: unknown[];
            deck: unknown[];
            discard: unknown[];
            factions: [string, string];
        }>;
        turnOrder: string[];
        currentPlayerIndex: number;
        bases: unknown[];
        baseDeck: unknown[];
        turnNumber: number;
        nextUid: number;
    } = {
        players: {},
        turnOrder: setupPlayerIds,
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 1,
    };

    for (const playerId of setupPlayerIds) {
        core.players[playerId] = {
            id: playerId,
            vp: 0,
            hand: [],
            deck: [],
            discard: [],
            factions: ['', ''],
        };
    }

    const sys = createInitialSystemState(
        setupPlayerIds,
        config.systems as EngineSystem[],
    );
    sys.phase = 'playCards';
    return setUndoAiSeatIds(
        normalizeStateForConfig(config, { sys, core }),
        aiSeatIds,
    );
}

function buildSkippedFactionSelectionState(args: {
    config: GameEngineConfig;
    random: LocalProviderRandom;
    setupData: unknown;
    setupPlayerIds: string[];
    aiSeatIds: string[];
    testConfig: LocalProviderTestConfig;
}): MatchState<unknown> {
    const {
        config,
        random,
        setupData,
        setupPlayerIds,
        aiSeatIds,
        testConfig,
    } = args;
    const core = config.domain.setup(setupPlayerIds, random, setupData) as unknown;
    const sys = createInitialSystemState(
        setupPlayerIds,
        config.systems as EngineSystem[],
    );
    let currentState: MatchState<unknown> = setUndoAiSeatIds({ sys, core }, aiSeatIds);

    const selectionOrder: Array<{ playerId: string; factionIndex: number }> = [
        { playerId: '0', factionIndex: 0 },
        { playerId: '1', factionIndex: 0 },
        { playerId: '1', factionIndex: 1 },
        { playerId: '0', factionIndex: 1 },
    ];

    const pipelineConfig: PipelineConfig<unknown, Command, GameEvent> = {
        domain: config.domain,
        systems: config.systems as EngineSystem<unknown>[],
        systemsConfig: config.systemsConfig,
    };

    for (const { playerId, factionIndex } of selectionOrder) {
        const factions = playerId === '0'
            ? testConfig.player0Factions
            : testConfig.player1Factions;
        const factionId = factions?.[factionIndex];

        if (!factionId) {
            console.warn(`[LocalGameProvider] 玩家 ${playerId} 的第 ${factionIndex + 1} 个派系未指定，跳过`);
            continue;
        }

        const command: Command = {
            type: 'su:select_faction',
            playerId,
            payload: { factionId },
            timestamp: Date.now(),
            skipValidation: true,
        };

        const result = executePipeline(
            pipelineConfig,
            currentState,
            command,
            random,
            setupPlayerIds,
        );

        if (!result.success) {
            console.error('[LocalGameProvider] 派系选择失败:', result.error);
            break;
        }

        currentState = result.state;
    }

    return setUndoAiSeatIds(
        normalizeStateForConfig(config, currentState),
        aiSeatIds,
    );
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

export function createInitialLocalProviderState(args: {
    config: GameEngineConfig;
    persistedState: MatchState<unknown> | null | undefined;
    aiSeatIds: string[];
    initialRandom: LocalProviderRandom;
    setupData: unknown;
    setupPlayerIds: string[];
}): MatchState<unknown> {
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
    if (testConfig?.skipInitialization) {
        return buildSkippedInitializationState({
            config,
            setupPlayerIds,
            aiSeatIds,
        });
    }

    const shouldSkipFactionSelect = testConfig?.skipFactionSelect === true
        && Array.isArray(testConfig.player0Factions)
        && testConfig.player0Factions.length > 0;

    if (shouldSkipFactionSelect && testConfig) {
        return buildSkippedFactionSelectionState({
            config,
            random: initialRandom,
            setupData,
            setupPlayerIds,
            aiSeatIds,
            testConfig,
        });
    }

    const core = config.domain.setup(setupPlayerIds, initialRandom, setupData);
    const sys = createInitialSystemState(
        setupPlayerIds,
        config.systems as EngineSystem[],
    );
    return setUndoAiSeatIds(
        normalizeStateForConfig(config, { sys, core }),
        aiSeatIds,
    );
}

export type { LocalProviderRandom };
