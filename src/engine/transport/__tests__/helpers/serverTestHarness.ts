import type { GameEngineConfig } from '../../engineConfig';
import { createInteractionSystem, createSimpleChoice } from '../../../systems/InteractionSystem';
import { createSimpleChoiceSystem } from '../../../systems/SimpleChoiceSystem';
import type {
    CreateMatchData,
    FetchOpts,
    FetchResult,
    MatchMetadata,
    MatchStorage,
    StoredMatchState,
} from '../../storage';
import type {
    TrainingCompletedMatch,
    TrainingDataRecorder,
    TrainingDecisionSample,
    TrainingMatchCommitResult,
} from '../../trainingData';
import smashUpEngineConfig from '../../../../games/smashup/game';
import diceThroneEngineConfig from '../../../../games/dicethrone/game';
import summonerWarsEngineConfig from '../../../../games/summonerwars/game';
import splendorEngineConfig from '../../../../games/splendor/game';
import { startSmashUpReactionSession } from '../../../../games/smashup/domain/reactionSession';

export type EventHandler = (...args: unknown[]) => void | Promise<void>;

export type SocketEvent = {
    event: string;
    args: unknown[];
};

export class MockSocket {
    readonly id: string;
    readonly sent: SocketEvent[] = [];
    readonly rooms = new Set<string>();
    disconnected = false;

    private handlers = new Map<string, EventHandler[]>();
    private namespace: MockNamespace | null = null;

    constructor(id: string) {
        this.id = id;
    }

    on(event: string, handler: EventHandler): void {
        const list = this.handlers.get(event) ?? [];
        list.push(handler);
        this.handlers.set(event, list);
    }

    bindNamespace(namespace: MockNamespace): void {
        this.namespace = namespace;
    }

    emit(event: string, ...args: unknown[]): void {
        this.sent.push({ event, args });
    }

    join(room: string): void {
        this.rooms.add(room);
    }

    to(target: string): { emit: (event: string, ...args: unknown[]) => void } {
        return {
            emit: (event: string, ...args: unknown[]) => {
                this.namespace?.emitToTarget(target, event, args, this.id);
            },
        };
    }

    disconnect(_force?: boolean): void {
        this.disconnected = true;
        const handlers = this.handlers.get('disconnect') ?? [];
        for (const handler of handlers) {
            void handler();
        }
    }

    async clientEmit(event: string, ...args: unknown[]): Promise<void> {
        const handlers = this.handlers.get(event) ?? [];
        for (const handler of handlers) {
            await handler(...args);
        }
    }
}

export class MockNamespace {
    private connectionHandler: ((socket: MockSocket) => void) | null = null;
    private readonly sockets = new Map<string, MockSocket>();

    on(event: string, handler: (socket: MockSocket) => void): void {
        if (event === 'connection') {
            this.connectionHandler = handler;
        }
    }

    connectSocket(socket: MockSocket): void {
        this.sockets.set(socket.id, socket);
        socket.bindNamespace(this);
        this.connectionHandler?.(socket);
    }

    emitToTarget(
        target: string,
        event: string,
        args: unknown[],
        excludeSocketId?: string,
    ): void {
        if (target.startsWith('game:')) {
            for (const socket of this.sockets.values()) {
                if (!socket.rooms.has(target)) continue;
                if (excludeSocketId && socket.id === excludeSocketId) continue;
                socket.emit(event, ...args);
            }
            return;
        }

        const socket = this.sockets.get(target);
        if (!socket) return;
        if (excludeSocketId && socket.id === excludeSocketId) return;
        socket.emit(event, ...args);
    }

    to(target: string): { emit: (event: string, ...args: unknown[]) => void } {
        return {
            emit: (event: string, ...args: unknown[]) => {
                this.emitToTarget(target, event, args);
            },
        };
    }

    in(room: string): { fetchSockets: () => Promise<MockSocket[]> } {
        return {
            fetchSockets: async () => {
                return Array.from(this.sockets.values()).filter((socket) => socket.rooms.has(room));
            },
        };
    }
}

export class MockIO {
    readonly gameNamespace = new MockNamespace();

    of(namespace: string): MockNamespace {
        if (namespace !== '/game') {
            throw new Error(`Unexpected namespace: ${namespace}`);
        }
        return this.gameNamespace;
    }
}

export class InMemoryStorage implements MatchStorage {
    private readonly states = new Map<string, StoredMatchState>();
    private readonly metadata = new Map<string, MatchMetadata>();

    async connect(): Promise<void> {
        return;
    }

    async createMatch(matchID: string, data: CreateMatchData): Promise<void> {
        this.states.set(matchID, data.initialState);
        this.metadata.set(matchID, data.metadata);
    }

    async setState(matchID: string, state: StoredMatchState): Promise<void> {
        this.states.set(matchID, state);
    }

    async setMetadata(matchID: string, metadata: MatchMetadata): Promise<void> {
        this.metadata.set(matchID, metadata);
    }

    async claimSeatMetadata(matchID: string, input: {
        playerID: string;
        playerCredentials: string;
        playerName?: string;
        updatedAt?: number;
    }): Promise<{ metadata?: MatchMetadata; playerExists: boolean; playerCredentials?: string }> {
        const metadata = this.metadata.get(matchID);
        const player = metadata?.players[input.playerID];
        if (!metadata || !player) return { metadata, playerExists: false };
        const playerCredentials = player.credentials || input.playerCredentials;
        const nextMetadata = {
            ...metadata,
            updatedAt: input.updatedAt ?? Date.now(),
            players: {
                ...metadata.players,
                [input.playerID]: {
                    ...player,
                    credentials: playerCredentials,
                    name: player.name || input.playerName || player.name,
                },
            },
        };
        this.metadata.set(matchID, nextMetadata);
        return { metadata: nextMetadata, playerExists: true, playerCredentials };
    }

    async fetch(matchID: string, opts: FetchOpts): Promise<FetchResult> {
        return {
            state: opts.state ? this.states.get(matchID) : undefined,
            metadata: opts.metadata ? this.metadata.get(matchID) : undefined,
        };
    }

    async fetchAuthMetadata(matchID: string): Promise<MatchMetadata | undefined> {
        return this.metadata.get(matchID);
    }

    async wipe(matchID: string): Promise<void> {
        this.states.delete(matchID);
        this.metadata.delete(matchID);
    }

    async listMatches(): Promise<string[]> {
        return Array.from(this.states.keys());
    }
}

export const createEngineConfig = (): GameEngineConfig => ({
    gameId: 'test-game',
    domain: {
        gameId: 'test-game',
        setup: () => ({ currentPlayer: '0' }),
        validate: () => ({ valid: true }),
        execute: () => [],
        reduce: (core) => core,
    },
    systems: [],
});

export const createEngineConfigWithId = (gameId: string): GameEngineConfig => {
    const base = createEngineConfig();
    const usesDiceThroneWatchdogSemantics = gameId === 'dicethrone'
        || gameId.includes('dicethrone')
        || gameId.includes('active-targeting')
        || gameId.includes('targetingRoll');
    const sourceConfig = usesDiceThroneWatchdogSemantics
        ? diceThroneEngineConfig
        : gameId === 'smashup'
            || gameId.includes('smashup')
            ? smashUpEngineConfig
            : gameId === 'splendor'
                ? splendorEngineConfig
                : gameId === 'summonerwars'
                    ? summonerWarsEngineConfig
                : undefined;
    return {
        ...base,
        gameId,
        onlineAiRecovery: {
            ...(sourceConfig?.onlineAiRecovery ?? {}),
            ...(gameId === 'splendor' ? { disableFallbackAdvancePhase: true } : {}),
            allowForceCommandAfterLegalActionExhausted: ({ phase, previousCandidate, nextCandidate }) => {
                const sourceDecision = sourceConfig?.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted?.({
                    state: {} as any,
                    phase,
                    previousCandidate,
                    nextCandidate,
                });
                if (sourceDecision !== undefined) {
                    return sourceDecision;
                }
                if (gameId === 'dicethrone') {
                    return phase === 'defensiveRoll';
                }
                if (gameId === 'smashup') {
                    return phase === 'scoreBases'
                        || phase === 'endTurn'
                        || (
                            phase === 'playCards'
                            && previousCandidate.reason === 'active-turn'
                            && previousCandidate.legalActionOnly !== true
                            && nextCandidate.reason === 'active-turn'
                            && nextCandidate.legalActionOnly !== true
                        );
                }
                return false;
            },
        },
        domain: {
            ...base.domain,
            gameId,
        },
    };
};

export const createEngineConfigWithGameOver = (): GameEngineConfig => {
    const base = createEngineConfig();
    return {
        ...base,
        domain: {
            ...base.domain,
            isGameOver: () => ({ winner: '0' }),
        },
    };
};

export const createInteractiveEngineConfig = (): GameEngineConfig => ({
    gameId: 'test-game',
    domain: {
        gameId: 'test-game',
        setup: () => ({ currentPlayer: '0' }),
        validate: () => ({ valid: true }),
        execute: () => [],
        reduce: (core) => core,
    },
    systems: [
        createInteractionSystem(),
        createSimpleChoiceSystem(),
    ],
});

export const createStoredState = (): StoredMatchState => ({
    G: {
        core: { currentPlayer: '0' },
        sys: { phase: 'main', turnNumber: 1 },
    },
    _stateID: 0,
    randomSeed: 'seed',
    randomCursor: 0,
});

export const createMetadata = (credentials: string): MatchMetadata => ({
    gameName: 'test-game',
    players: {
        '0': {
            name: '玩家0',
            credentials,
            isConnected: false,
        },
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    setupData: {},
});

export type TestOnlineAiSeatController = {
    type: 'human' | 'local-ai' | 'remote-ai';
    policyId?: string;
    fallbackPolicyId?: string;
    manualSetupSelection?: boolean;
    minimumActionDelayMs?: number;
};

export const normalizeTestOnlineAiSeatControllers = (
    seatControllers?: Record<string, TestOnlineAiSeatController>,
): Record<string, TestOnlineAiSeatController> => Object.fromEntries(
    Object.entries(seatControllers ?? {
        '0': { type: 'human' },
        '1': { type: 'local-ai' },
    }).map(([playerId, controller]) => [
        playerId,
        controller.type === 'human'
            ? controller
            : {
                minimumActionDelayMs: 0,
                ...controller,
            },
    ]),
);

export const createOnlineAiRecoveryMetadata = (overrides?: {
    gameName?: string;
    seatControllers?: Record<string, TestOnlineAiSeatController>;
}): MatchMetadata => ({
    gameName: overrides?.gameName ?? 'test-game',
    players: {
        '0': {
            name: '玩家0',
            credentials: 'cred-0',
            isConnected: false,
        },
        '1': {
            name: 'AI 1',
            credentials: 'cred-1',
            isConnected: false,
        },
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    setupData: {
        enableAi: true,
        seatControllers: normalizeTestOnlineAiSeatControllers(overrides?.seatControllers),
    },
});

export const createOnlineAiRecoveryState = (overrides?: {
    activePlayerId?: string;
    phase?: string;
    interaction?: unknown;
    responseWindow?: unknown;
    pendingBonusDiceSettlement?: unknown;
}): StoredMatchState => ({
    G: {
        core: {
            activePlayerId: overrides?.activePlayerId ?? '1',
            currentPlayerIndex: overrides?.activePlayerId === '0' ? 0 : 1,
            turnOrder: ['0', '1'],
            players: {
                '0': {
                    id: '0',
                    factionIds: [],
                    factions: ['robots', 'wizards'],
                    hand: [],
                    deck: [],
                    discard: [],
                    resources: {},
                    statusEffects: [],
                    abilities: [],
                    vp: 0,
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
                '1': {
                    id: '1',
                    factionIds: [],
                    factions: ['robots', 'wizards'],
                    hand: [],
                    deck: [],
                    discard: [],
                    resources: {},
                    statusEffects: [],
                    abilities: [],
                    vp: 0,
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
            },
            bases: [],
            baseDeck: [],
            pendingBonusDiceSettlement: overrides?.pendingBonusDiceSettlement,
        },
        sys: {
            phase: overrides?.phase ?? 'main2',
            turnNumber: 4,
            eventStream: { nextId: 1 },
            interaction: overrides?.interaction ?? {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: overrides?.responseWindow ?? {
                current: undefined,
            },
        },
    },
    _stateID: 0,
    randomSeed: 'seed',
    randomCursor: 0,
});

export const createPersistedStaleSmashUpReactionChoiceState = (): StoredMatchState => {
    const baseState = startSmashUpReactionSession({
        core: {
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            nextUid: 1000,
            players: {
                '0': {
                    id: '0',
                    factionIds: ['robot'],
                    factions: ['robots', 'pirates'],
                    hand: [],
                    deck: [],
                    discard: [],
                    vp: 0,
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
                '1': {
                    id: '1',
                    factionIds: ['wizard'],
                    factions: ['robots', 'wizards'],
                    hand: [],
                    deck: [],
                    discard: [],
                    vp: 0,
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
            },
            bases: [{
                defId: 'base_wizard_academy',
                minions: [{
                    uid: 'minion-hoverbot-1',
                    defId: 'robot_hoverbot',
                    owner: '0',
                    controller: '0',
                    basePower: 4,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                }],
                ongoingActions: [],
            }],
            baseDeck: [],
            scoringEligibleBaseIndices: [0],
        },
        sys: {
            phase: 'scoreBases',
            interaction: { current: undefined, queue: [], isBlocked: false },
            responseWindow: {
                current: {
                    id: 'reaction-window-stale',
                    windowType: 'afterScoring',
                    sourceId: 'smashup_reaction_choose',
                    responderQueue: ['0', '1'],
                    currentResponderIndex: 1,
                    passedPlayers: [],
                },
                history: [],
            },
            eventStream: { nextId: 1, entries: [] },
        } as any,
    } as any, {
        frameId: 'persisted-stale-reaction',
        frameKind: 'score-after',
        phase: 'optional',
        activePlayerId: '1',
        currentPlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'afterScoring',
    });

    return {
        G: {
            ...baseState,
            sys: {
                ...baseState.sys,
                interaction: {
                    current: createSimpleChoice(
                        'persisted-stale-reaction-choice',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'activate_special:titan:titan_1_wizards_arcane_protector:0',
                                label: '奥术守护者 特殊能力',
                                displayMode: 'button',
                                value: {
                                    kind: 'activate_special',
                                    playerId: '1',
                                    titanUid: 'titan_1_wizards_arcane_protector',
                                    baseIndex: 0,
                                },
                            },
                            {
                                id: 'pass',
                                label: 'Pass',
                                displayMode: 'button',
                                value: { kind: 'pass' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                            responseValidationMode: 'live',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            } as any,
        },
        _stateID: 0,
        randomSeed: 'seed',
        randomCursor: 0,
    };
};

export const hasEvent = (socket: MockSocket, event: string, predicate?: (args: unknown[]) => boolean): boolean => {
    return socket.sent.some((item) => item.event === event && (predicate ? predicate(item.args) : true));
};

export const nextTick = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

export class MockTrainingDataRecorder implements TrainingDataRecorder {
    readonly pending = new Map<string, TrainingDecisionSample[]>();
    readonly completedMatches: TrainingDecisionSample[][] = [];

    stageDecisionSample(sample: TrainingDecisionSample): void {
        const samples = this.pending.get(sample.matchId) ?? [];
        samples.push(sample);
        this.pending.set(sample.matchId, samples);
    }

    commitCompletedMatch(match: TrainingCompletedMatch): TrainingMatchCommitResult {
        const samples = this.pending.get(match.matchId) ?? [];
        if (match.finalSample) samples.push(match.finalSample);
        this.pending.delete(match.matchId);
        this.completedMatches.push(samples);
        return {
            status: 'committed',
            committedBytes: 1,
            gameBytes: 1,
            maxBytes: 300 * 1024 * 1024,
        };
    }

    discardPendingMatch(match: Pick<TrainingCompletedMatch, 'matchId'>): void {
        this.pending.delete(match.matchId);
    }
}

export class FailingTrainingDataRecorder implements TrainingDataRecorder {
    stageDecisionSample(): Promise<void> {
        return Promise.reject(new Error('disk-full'));
    }

    commitCompletedMatch(): Promise<TrainingMatchCommitResult> {
        return Promise.reject(new Error('disk-full'));
    }

    discardPendingMatch(): Promise<void> {
        return Promise.reject(new Error('disk-full'));
    }
}
