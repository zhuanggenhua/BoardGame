import { describe, expect, it, vi } from 'vitest';
import { GameTransportServer, type GameEngineConfig } from '../server';
import {
    buildAiProgressMarker,
    resolveCurrentPlayerId,
    resolveForceEndTurnForStalledAi,
    resolveUnsatisfiableReasonFromInteraction,
} from '../onlineAiRecovery';
import { createInteractionSystem, createSimpleChoice, INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import { createSimpleChoiceSystem } from '../../systems/SimpleChoiceSystem';
import { createResponseWindowSystem, RESPONSE_WINDOW_EVENTS } from '../../systems/ResponseWindowSystem';
import { resolveLocalAiActionVisibility } from '../../ai/actionVisibility';
import { resolveLocalAiActionDelayPlan, startCancelableAiDelay } from '../../ai';
import * as aiModule from '../../ai';
import { resolveOnlineAiDecisionView } from '../../ai/onlineDecisionView';
import type {
    CreateMatchData,
    FetchOpts,
    FetchResult,
    MatchMetadata,
    MatchStorage,
    StoredMatchState,
} from '../storage';
import type { TrainingDataRecorder, TrainingDecisionSample } from '../trainingData';
import { GAME_MANIFEST_BY_ID } from '../../../games/manifest';
import smashUpEngineConfig, { smashUpSystemsForTest } from '../../../games/smashup/game';
import { smashUpAiRuntime } from '../../../games/smashup/ai';
import { startSmashUpReactionSession } from '../../../games/smashup/domain/reactionSession';

type EventHandler = (...args: unknown[]) => void | Promise<void>;

type SocketEvent = {
    event: string;
    args: unknown[];
};

class MockSocket {
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

class MockNamespace {
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

class MockIO {
    readonly gameNamespace = new MockNamespace();

    of(namespace: string): MockNamespace {
        if (namespace !== '/game') {
            throw new Error(`Unexpected namespace: ${namespace}`);
        }
        return this.gameNamespace;
    }
}

class InMemoryStorage implements MatchStorage {
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

const createEngineConfig = (): GameEngineConfig => ({
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

const createEngineConfigWithId = (gameId: string): GameEngineConfig => {
    const base = createEngineConfig();
    return {
        ...base,
        gameId,
        domain: {
            ...base.domain,
            gameId,
        },
    };
};

const createEngineConfigWithGameOver = (): GameEngineConfig => {
    const base = createEngineConfig();
    return {
        ...base,
        domain: {
            ...base.domain,
            isGameOver: () => ({ winner: '0' }),
        },
    };
};

const createInteractiveEngineConfig = (): GameEngineConfig => ({
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

const createStoredState = (): StoredMatchState => ({
    G: {
        core: { currentPlayer: '0' },
        sys: { phase: 'main', turnNumber: 1 },
    },
    _stateID: 0,
    randomSeed: 'seed',
    randomCursor: 0,
});

const createMetadata = (credentials: string): MatchMetadata => ({
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

const createOnlineAiRecoveryMetadata = (overrides?: {
    gameName?: string;
    seatControllers?: Record<string, { type: 'human' | 'local-ai' | 'remote-ai'; policyId?: string; fallbackPolicyId?: string }>;
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
        seatControllers: overrides?.seatControllers ?? {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        },
    },
});

const createOnlineAiRecoveryState = (overrides?: {
    activePlayerId?: string;
    phase?: string;
    interaction?: unknown;
    responseWindow?: unknown;
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
                    factionIds: [],
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
            bases: [],
            baseDeck: [],
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

const createPersistedStaleSmashUpReactionChoiceState = (): StoredMatchState => {
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

const hasEvent = (socket: MockSocket, event: string, predicate?: (args: unknown[]) => boolean): boolean => {
    return socket.sent.some((item) => item.event === event && (predicate ? predicate(item.args) : true));
};

const nextTick = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

class MockTrainingDataRecorder implements TrainingDataRecorder {
    readonly samples: TrainingDecisionSample[] = [];

    recordDecisionSample(sample: TrainingDecisionSample): void {
        this.samples.push(sample);
    }
}

class FailingTrainingDataRecorder implements TrainingDataRecorder {
    recordDecisionSample(): Promise<void> {
        return Promise.reject(new Error('disk-full'));
    }
}

describe('online decision view（epoch 硬约束）', () => {
    it('private-required 场景下 eventStream.nextId 不一致时必须判定 stale-private-overlay', () => {
        const sharedState = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'playCards',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                eventStream: { nextId: 9 },
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('private-required');
        expect(result.canDecide).toBe(false);
        expect(result.blockedReason).toBe('stale-private-overlay');
        expect(result.diagnostics.sharedEventStreamNextId).toBe(10);
        expect(result.diagnostics.privateEventStreamNextId).toBe(9);
    });

    it('private-required 场景下 private overlay 缺失 eventStream.nextId 时必须判定 stale-private-overlay', () => {
        const sharedState = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'playCards',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                eventStream: {},
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('private-required');
        expect(result.canDecide).toBe(false);
        expect(result.blockedReason).toBe('stale-private-overlay');
        expect(result.diagnostics.sharedEventStreamNextId).toBe(10);
        expect(result.diagnostics.privateEventStreamNextId).toBeNull();
    });

    it('SmashUp 可见的 mandatory 结算顺序选择应允许直接走 shared 视图，避免 stale overlay 卡住 AI', () => {
        const sharedState = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'scoreBases',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: createSimpleChoice(
                        'mandatory-reaction-order-choice',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'trigger-base-arena',
                                label: '竞技场',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:base_arena:1:0' },
                            },
                            {
                                id: 'trigger-wizard-archmage',
                                label: '大法师',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:wizard_archmage:1:0' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                eventStream: { nextId: 9 },
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            runtime: smashUpAiRuntime,
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('shared');
        expect(result.canDecide).toBe(true);
        expect(result.blockedReason).toBeNull();
        expect(result.visibleState).toBe(sharedState);
    });
});

describe('ResponseWindowSystem（重复打开去重）', () => {
    const createResponseWindowState = (overrides?: {
        current?: {
            id: string;
            windowType: string;
            sourceId?: string;
            responderQueue: string[];
            currentResponderIndex?: number;
            passedPlayers?: string[];
        };
    }) => ({
        core: {},
        sys: {
            phase: 'main2',
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: overrides?.current
                    ? {
                        ...overrides.current,
                        currentResponderIndex: overrides.current.currentResponderIndex ?? 0,
                        passedPlayers: overrides.current.passedPlayers ?? [],
                    }
                    : undefined,
            },
        },
        _stateID: 0,
        randomSeed: 'seed',
        randomCursor: 0,
    });

    it('当前窗口已存在时，语义等价的 OPENED 事件不应重置响应者进度', () => {
        const system = createResponseWindowSystem();
        const state = createResponseWindowState({
            current: {
                id: 'rw-current',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0', '1'],
                currentResponderIndex: 1,
                passedPlayers: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [{
                type: RESPONSE_WINDOW_EVENTS.OPENED,
                payload: {
                    windowId: 'rw-duplicate',
                    responderQueue: ['0', '1'],
                    windowType: 'afterRollConfirmed',
                },
                timestamp: 1,
            }],
        });

        expect(result).toBeUndefined();
        expect(state.sys.responseWindow.current).toMatchObject({
            id: 'rw-current',
            currentResponderIndex: 1,
            passedPlayers: ['0'],
        });
    });

    it('同一批事件中 CLOSED 后紧接语义等价 OPENED 时，不应立即 reopen', () => {
        const system = createResponseWindowSystem();
        const state = createResponseWindowState({
            current: {
                id: 'rw-before-close',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [
                {
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: 'rw-before-close',
                        allPassed: true,
                    },
                    timestamp: 1,
                },
                {
                    type: RESPONSE_WINDOW_EVENTS.OPENED,
                    payload: {
                        windowId: 'rw-reopen-duplicate',
                        responderQueue: ['0'],
                        windowType: 'afterRollConfirmed',
                    },
                    timestamp: 2,
                },
            ],
        });

        expect(result).toBeTruthy();
        expect((result as { state: typeof state }).state.sys.responseWindow.current).toBeUndefined();
    });

    it('同一批事件中 CLOSED 后若出现非响应窗口业务事件，再收到 OPENED 应允许重新打开', () => {
        const system = createResponseWindowSystem();
        const state = createResponseWindowState({
            current: {
                id: 'rw-before-close',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [
                {
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: 'rw-before-close',
                        allPassed: true,
                    },
                    timestamp: 1,
                },
                {
                    type: 'ROLL_CONFIRMED',
                    payload: { playerId: '1' },
                    timestamp: 2,
                },
                {
                    type: RESPONSE_WINDOW_EVENTS.OPENED,
                    payload: {
                        windowId: 'rw-reopen-legit',
                        responderQueue: ['0'],
                        windowType: 'afterRollConfirmed',
                    },
                    timestamp: 3,
                },
            ],
        });

        expect(result).toBeTruthy();
        expect((result as { state: typeof state }).state.sys.responseWindow.current).toMatchObject({
            id: 'rw-reopen-legit',
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });
    });

    it('冷却期内即使出现业务事件，语义等价窗口也不应重复 reopen', () => {
        const system = createResponseWindowSystem({ reopenDedupeCooldownMs: 5 });
        const state = createResponseWindowState({
            current: {
                id: 'rw-before-close',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [
                {
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: 'rw-before-close',
                        allPassed: true,
                    },
                    timestamp: 10,
                },
                {
                    type: 'ROLL_CONFIRMED',
                    payload: { playerId: '1' },
                    timestamp: 11,
                },
                {
                    type: RESPONSE_WINDOW_EVENTS.OPENED,
                    payload: {
                        windowId: 'rw-reopen-cooled',
                        responderQueue: ['0'],
                        windowType: 'afterRollConfirmed',
                    },
                    timestamp: 12,
                },
            ],
        });

        expect(result).toBeTruthy();
        expect((result as { state: typeof state }).state.sys.responseWindow.current).toBeUndefined();
    });

    it('冷却期结束后应允许语义等价窗口重新打开', () => {
        const system = createResponseWindowSystem({ reopenDedupeCooldownMs: 5 });
        const state = createResponseWindowState({
            current: {
                id: 'rw-before-close',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [
                {
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: 'rw-before-close',
                        allPassed: true,
                    },
                    timestamp: 10,
                },
                {
                    type: 'ROLL_CONFIRMED',
                    payload: { playerId: '1' },
                    timestamp: 11,
                },
                {
                    type: RESPONSE_WINDOW_EVENTS.OPENED,
                    payload: {
                        windowId: 'rw-reopen-after-cooldown',
                        responderQueue: ['0'],
                        windowType: 'afterRollConfirmed',
                    },
                    timestamp: 20,
                },
            ],
        });

        expect(result).toBeTruthy();
        expect((result as { state: typeof state }).state.sys.responseWindow.current).toMatchObject({
            id: 'rw-reopen-after-cooldown',
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });
    });
});

describe('buildAiProgressMarker（响应窗口语义指纹）', () => {
    it('响应窗口 id 变化不应被视为进展', () => {
        const baseState = createOnlineAiRecoveryState({
            responseWindow: {
                current: {
                    id: 'rw-1',
                    windowType: 'afterRollConfirmed',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        });
        const reopenedState = {
            ...baseState,
            G: {
                ...baseState.G,
                sys: {
                    ...baseState.G.sys,
                    responseWindow: {
                        current: {
                            id: 'rw-2',
                            windowType: 'afterRollConfirmed',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                            passedPlayers: [],
                        },
                    },
                },
            },
        };

        expect(buildAiProgressMarker(baseState.G as any))
            .toBe(buildAiProgressMarker(reopenedState.G as any));
    });

    it('同一 interaction id 下如果选项签名变化，应被视为进展', () => {
        const baseState = createOnlineAiRecoveryState({
            interaction: {
                current: {
                    id: 'reaction-choice-1',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'smashup_reaction_choose',
                        options: [
                            { id: 'trigger-a', label: 'A', value: { kind: 'trigger', triggerId: 'a' } },
                            { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: {
                    id: 'reaction-window-1',
                    windowType: 'afterScoring',
                    sourceId: 'smashup_reaction_choose',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        });
        const progressedState = {
            ...baseState,
            G: {
                ...baseState.G,
                sys: {
                    ...baseState.G.sys,
                    interaction: {
                        current: {
                            id: 'reaction-choice-1',
                            kind: 'simple-choice',
                            playerId: '1',
                            data: {
                                sourceId: 'smashup_reaction_choose',
                                options: [
                                    { id: 'trigger-b', label: 'B', value: { kind: 'trigger', triggerId: 'b' } },
                                    { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                                ],
                            },
                        },
                        queue: [],
                        isBlocked: false,
                    },
                },
            },
        };

        expect(buildAiProgressMarker(baseState.G as any))
            .not.toBe(buildAiProgressMarker(progressedState.G as any));
    });

    it('decisionEpoch 变化时，即使交互与响应窗口指纹不变，也应被视为进展', () => {
        const baseState = createOnlineAiRecoveryState({
            decisionEpoch: 11,
            interaction: {
                current: {
                    id: 'reaction-choice-1',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'smashup_reaction_choose',
                        options: [
                            { id: 'trigger-a', label: 'A', value: { kind: 'trigger', triggerId: 'a' } },
                            { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: {
                    id: 'reaction-window-1',
                    windowType: 'afterScoring',
                    sourceId: 'smashup_reaction_choose',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        });
        const progressedState = {
            ...baseState,
            G: {
                ...baseState.G,
                sys: {
                    ...baseState.G.sys,
                    decisionEpoch: 12,
                },
            },
        };

        expect(buildAiProgressMarker(baseState.G as any))
            .not.toBe(buildAiProgressMarker(progressedState.G as any));
    });
});

describe('resolveCurrentPlayerId（防御阶段操作者）', () => {
    it('defensiveRoll 且存在 pendingAttack.defenderId 时，应返回 defenderId', () => {
        const state = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'defensiveRoll',
        }).G as any;

        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            isDefendable: true,
        };

        expect(resolveCurrentPlayerId(state)).toBe('0');
    });
});

describe('resolveLocalAiActionVisibility（可见步骤分类）', () => {
    it('metadata.visibleStepDelayPolicy 应优先覆盖默认分类', () => {
        expect(resolveLocalAiActionVisibility({
            actionId: 'toggle-hidden',
            kind: 'toggle-die-lock',
            label: '锁骰',
            commands: [{ type: 'TOGGLE_DIE_LOCK', payload: {} }],
            metadata: { visibleStepDelayPolicy: 'hidden' },
        })).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'card-visible',
            kind: 'play-card',
            label: '打牌',
            commands: [{ type: 'PLAY_CARD', payload: {} }],
            metadata: { visibleStepDelayPolicy: 'visible' },
        })).toBe('visible');
    });

    it('runtime 白名单存在时，只允许白名单动作吃可见步骤延迟', () => {
        const runtime = {
            localVisibleStepDelayConfig: {
                mode: 'whitelist' as const,
                actionKinds: ['play-card', 'roll-dice'],
            },
        };

        expect(resolveLocalAiActionVisibility({
            actionId: 'card-visible',
            kind: 'play-card',
            label: '打牌',
            commands: [{ type: 'PLAY_CARD', payload: {} }],
        }, runtime)).toBe('visible');

        expect(resolveLocalAiActionVisibility({
            actionId: 'lock-hidden',
            kind: 'toggle-die-lock',
            label: '锁骰',
            commands: [{ type: 'TOGGLE_DIE_LOCK', payload: {} }],
        }, runtime)).toBe('hidden');
    });

    it('无 runtime 配置时，interaction/response-pass 仍隐藏，advance-phase 强制可见', () => {
        expect(resolveLocalAiActionVisibility({
            actionId: 'interaction-hidden',
            kind: 'interaction-multistep',
            label: '多步交互',
            commands: [{ type: 'SYS_INTERACTION_CONFIRM', payload: {} }],
        })).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'phase-hidden',
            kind: 'advance-phase',
            label: '推进阶段',
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
        })).toBe('visible');

        expect(resolveLocalAiActionVisibility({
            actionId: 'response-hidden',
            kind: 'response-pass',
            label: '放弃响应',
            commands: [{ type: 'RESPONSE_PASS', payload: {} }],
        })).toBe('hidden');
    });

    it('无 runtime 配置时，普通可见业务动作默认视为可见步骤', () => {
        expect(resolveLocalAiActionVisibility({
            actionId: 'card-visible',
            kind: 'play-card',
            label: '打牌',
            commands: [{ type: 'PLAY_CARD', payload: {} }],
        })).toBe('visible');
    });
});

describe('resolveLocalAiActionDelayPlan（单一延迟预算）', () => {
    it('隐藏动作不吃主动延迟', () => {
        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'hidden',
            now: 1_000,
            lastVisibleActionAt: 200,
            extraElapsedBudgetMs: [300],
        });

        expect(plan.minimumDelayMs).toBe(0);
        expect(plan.delayBudgetElapsedMs).toBe(0);
        expect(plan.remainingDelayMs).toBe(0);
    });

    it('默认可见动作统一使用 1000ms 最小时长', () => {
        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 1_000,
        });

        expect(plan.minimumDelayMs).toBe(1000);
        expect(plan.lastVisibleActionAt).toBeNull();
        expect(plan.visibleStepElapsedMs).toBeNull();
        expect(plan.remainingDelayMs).toBe(1000);
    });

    it('在线链路已有状态年龄只做观测，不再抵扣可见步骤延迟', () => {
        const observedState = {
            sys: {
                eventStream: {
                    entries: [
                        { event: { timestamp: 8_000 } },
                    ],
                },
            },
        } as any;

        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 8_600,
            observedState,
            extraElapsedBudgetMs: [200],
        });

        expect(plan.minimumDelayMs).toBe(1000);
        expect(plan.observedStateAgeMs).toBe(600);
        expect(plan.delayBudgetElapsedMs).toBe(0);
        expect(plan.remainingDelayMs).toBe(1000);
    });

    it('会忽略 timestamp=0 的占位事件，避免错误吃光可见动作延迟', () => {
        const observedState = {
            sys: {
                eventStream: {
                    entries: [
                        { event: { timestamp: 0 } },
                    ],
                },
                actionLog: {
                    entries: [
                        { timestamp: 0 },
                    ],
                },
            },
        } as any;

        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 8_600,
            observedState,
            extraElapsedBudgetMs: [200],
        });

        expect(plan.observedStateAgeMs).toBe(0);
        expect(plan.delayBudgetElapsedMs).toBe(0);
        expect(plan.remainingDelayMs).toBe(1000);
    });

    it('可见步骤应从上一次可见动作提交后重新计时，不区分 seat', () => {
        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 8_600,
            lastVisibleActionAt: 8_150,
            extraElapsedBudgetMs: [900],
            observedState: {
                sys: {
                    eventStream: {
                        entries: [
                            { event: { timestamp: 7_000 } },
                        ],
                    },
                },
            } as any,
        });

        expect(plan.observedStateAgeMs).toBe(1600);
        expect(plan.visibleStepElapsedMs).toBe(450);
        expect(plan.delayBudgetElapsedMs).toBe(450);
        expect(plan.remainingDelayMs).toBe(550);
    });
});

describe('startCancelableAiDelay（可取消延迟）', () => {
    it('取消时不会让等待悬空', async () => {
        vi.useFakeTimers();
        try {
            const handle = startCancelableAiDelay(1000);
            const resultPromise = handle.promise;

            vi.advanceTimersByTime(300);
            handle.cancel();
            await vi.runAllTimersAsync();

            await expect(resultPromise).resolves.toMatchObject({
                outcome: 'cancelled',
                targetDelayMs: 1000,
                waitedMs: 300,
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('正常到点时会返回 elapsed', async () => {
        vi.useFakeTimers();
        try {
            const handle = startCancelableAiDelay(400);
            const resultPromise = handle.promise;

            vi.advanceTimersByTime(400);
            await vi.runAllTimersAsync();

            await expect(resultPromise).resolves.toMatchObject({
                outcome: 'elapsed',
                targetDelayMs: 400,
                waitedMs: 400,
            });
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('resolveForceEndTurnForStalledAi（action-loop）', () => {
    it('重复交替动作循环应触发 action-loop 兜底', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'main1',
        }).G as any;

        sharedState.sys = {
            ...sharedState.sys,
            actionLog: {
                maxEntries: 50,
                entries: [
                    { actorId: '1', kind: 'DISCARD_CARD' },
                    { actorId: '1', kind: 'UNDO_SELL_CARD' },
                    { actorId: '1', kind: 'DISCARD_CARD' },
                    { actorId: '1', kind: 'UNDO_SELL_CARD' },
                ],
            },
        };

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('active-turn');
        expect(candidate?.resolution.action.commands[0]?.type).toBe('ADVANCE_PHASE');
    });

    it('visible simple-choice 若存在 smashup reaction pass 选项，应优先 force pass 而不是 cancel', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'scoreBases',
            interaction: {
                current: {
                    id: 'reaction-order-choice',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'smashup_reaction_choose',
                        title: '选择一个反应动作',
                        options: [
                            {
                                id: 'trigger-a',
                                label: '先结算触发 A',
                                value: { kind: 'trigger', triggerId: 'afterScoring:base_a:1:0' },
                            },
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
        }).G as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('visible-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'pass' },
        });
    });

    it('smashup mandatory reaction ordering falls back to first trigger instead of cancel', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'scoreBases',
            interaction: {
                current: {
                    id: 'mandatory-reaction-order-choice',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'smashup_reaction_choose',
                        title: '??????????',
                        options: [
                            {
                                id: 'trigger-base-arena',
                                label: '???',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:base_arena:1777092533686:0' },
                            },
                            {
                                id: 'trigger-wizard-archmage',
                                label: '???',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:wizard_archmage:1777092533686:0' },
                            },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
        }).G as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('visible-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'trigger-base-arena' },
        });
    });

    it('DiceThrone targetingRoll 应标记为 legal-only，而不是裸 ADVANCE_PHASE 兜底', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'targetingRoll',
        }).G as any;

        sharedState.core = {
            ...sharedState.core,
            rollCount: 0,
            rollConfirmed: false,
        };

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('active-turn-legal-only');
        expect(candidate?.legalActionOnly).toBe(true);
        expect(candidate?.resolution.action.commands).toEqual([]);
    });

    it('DiceThrone afterRollConfirmed 当前响应者为 human 时，不应回退成 active-turn-legal-only', () => {
        const sharedState = {
            core: {
                activePlayerId: '3',
                currentPlayerIndex: 3,
                turnOrder: ['0', '1', '2', '3'],
            },
            sys: {
                phase: 'offensiveRoll',
                turnNumber: 8,
                eventStream: { nextId: 42 },
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-after-roll-human-1',
                        sourceId: 'attack-roll-1',
                        windowType: 'afterRollConfirmed',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
                '2': { type: 'local-ai' },
                '3': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate).toBeNull();
    });

    it('DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'main1',
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: {
                    id: 'rw-after-card-hidden-1',
                    sourceId: 'action-poison-tip',
                    windowType: 'afterCardPlayed',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    pendingInteractionId: 'card-bye-bye-1777601349600',
                },
            },
        }).G as any;

        const seatState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'main1',
            interaction: {
                current: {
                    id: 'card-bye-bye-1777601349600',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'card-bye-bye',
                        title: '选择要移除的状态效果',
                        options: [
                            { id: 'skip', label: '跳过', value: { skip: true } },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: sharedState.sys.responseWindow,
        }).G as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': seatState,
            },
        });

        expect(candidate?.reason).toBe('hidden-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'skip' },
        });
    });

    it('DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'main1',
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: undefined,
            },
        }).G as any;

        sharedState.core = {
            ...sharedState.core,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: {
                id: 'bounty-hunter-display-1',
                attackerId: '1',
                displayOnly: true,
                dice: [{ index: 0, value: 6 }],
            },
        };

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('seat-legal-only');
        expect(candidate?.playerId).toBe('1');
        expect(candidate?.fingerprintHint).toContain('display-only-bonus:1:main1:bounty-hunter-display-1');
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'SKIP_BONUS_DICE_REROLL', payload: {} },
        ]);
    });
});

describe('resolveUnsatisfiableReasonFromInteraction（诊断口径）', () => {
    it('没有 interaction 时不应误报 empty-options', () => {
        expect(resolveUnsatisfiableReasonFromInteraction(undefined, undefined)).toBeNull();
    });
});

describe('GameTransportServer（离座与重连）', () => {
    it('setupMatch 应返回初始化后的随机游标', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const randomEngine: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                setup: (_playerIds, random) => ({
                    currentPlayer: '0',
                    initRoll: random.d(6),
                }),
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [randomEngine],
        });

        const result = await server.setupMatch('match-seed', 'test-game', ['0', '1'], 'seed-1');

        expect(result).toBeTruthy();
        expect(result?.randomCursor).toBeGreaterThan(0);
    });

    it('setupMatch 应把 AI 座位写入 undo 状态', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
        });

        const result = await server.setupMatch('match-ai-undo', 'test-game', ['0', '1'], 'seed-ai', {
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        });

        expect(result?.state.sys.undo.aiSeatIds).toEqual(['1']);
    });

    it('setupMatch 应透传 setupData 到 domain.setup', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const setupData = { firstPlayerId: '1', tag: 'from-test' };
        let receivedSetupData: unknown;

        const engineWithSetupData: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                setup: (_playerIds, _random, incomingSetupData) => {
                    receivedSetupData = incomingSetupData;
                    return { currentPlayer: '0' };
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineWithSetupData],
        });

        const result = await server.setupMatch(
            'match-setup-data',
            'test-game',
            ['0', '1'],
            'seed-2',
            setupData,
        );

        expect(result).toBeTruthy();
        expect(receivedSetupData).toEqual(setupData);
    });

    it('setupMatch 在混合人机且未显式指定先手时，应默认把真人座位排到 setup 先手', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let receivedPlayerIds: string[] = [];

        const engineWithPlayerCapture: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                setup: (incomingPlayerIds) => {
                    receivedPlayerIds = [...incomingPlayerIds];
                    return { currentPlayer: incomingPlayerIds[0] };
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineWithPlayerCapture],
        });

        const result = await server.setupMatch(
            'match-setup-human-first-default',
            'test-game',
            ['0', '1'],
            'seed-human-first-default',
            {
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'human' },
                },
            },
        );

        expect(result).toBeTruthy();
        expect(receivedPlayerIds).toEqual(['1', '0']);
    });

    it('setupMatch 在显式 firstPlayerId/turnOrder 存在时，不应覆盖调用方顺序', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let receivedPlayerIds: string[] = [];

        const engineWithPlayerCapture: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                setup: (incomingPlayerIds) => {
                    receivedPlayerIds = [...incomingPlayerIds];
                    return { currentPlayer: incomingPlayerIds[0] };
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineWithPlayerCapture],
        });

        await server.setupMatch(
            'match-setup-human-first-explicit',
            'test-game',
            ['0', '1'],
            'seed-human-first-explicit',
            {
                firstPlayerId: '0',
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'human' },
                },
            },
        );

        expect(receivedPlayerIds).toEqual(['0', '1']);
    });

    it('offline adjudication should use domain cancel command for dt card interaction', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let lastCommandType: string | undefined;

        const initialState: StoredMatchState = {
            G: {
                core: { currentPlayer: '0' },
                sys: {
                    phase: 'main',
                    turnNumber: 1,
                    interaction: {
                        current: {
                            id: 'dt-interaction-1',
                            kind: 'dt:card-interaction',
                            playerId: '0',
                            data: {
                                id: 'interaction-1',
                                playerId: '0',
                                sourceCardId: 'card-1',
                            },
                        },
                        queue: [],
                    },
                },
            },
            _stateID: 0,
            randomSeed: 'seed',
            randomCursor: 0,
        };

        await storage.createMatch('match-offline-dt', {
            initialState,
            metadata: createMetadata('offline-cred'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                validate: (_state, command) => {
                    lastCommandType = command.type;
                    return { valid: true };
                },
                execute: () => [],
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<unknown>;
            runOfflineAdjudication: (match: unknown, playerID: string) => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-offline-dt');
        expect(match).toBeTruthy();

        await serverInternal.runOfflineAdjudication(match, '0');

        expect(lastCommandType).toBe('SYS_INTERACTION_CANCEL'); // 已迁移到 InteractionSystem
    });

    it.each([
        ['simple-choice', 'SYS_INTERACTION_CANCEL'],
        ['dt:token-response', 'SKIP_TOKEN_RESPONSE'],
        ['dt:bonus-dice', 'SKIP_BONUS_DICE_REROLL'],
    ])('离线裁决应按 kind=%s 映射命令 %s', async (kind, expectedCommand) => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        let lastCommandType: string | undefined;

        const initialState: StoredMatchState = {
            G: {
                core: { currentPlayer: '0' },
                sys: {
                    phase: 'main',
                    turnNumber: 1,
                    interaction: {
                        current: {
                            id: `interaction-${kind}`,
                            kind,
                            playerId: '0',
                            data: {},
                        },
                        queue: [],
                    },
                },
            },
            _stateID: 0,
            randomSeed: 'seed',
            randomCursor: 0,
        };

        await storage.createMatch(`match-offline-${kind}`, {
            initialState,
            metadata: createMetadata('offline-cred'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                validate: (_state, command) => {
                    lastCommandType = command.type;
                    return { valid: true };
                },
                execute: () => [],
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<unknown>;
            runOfflineAdjudication: (match: unknown, playerID: string) => Promise<void>;
        };

        const match = await serverInternal.loadMatch(`match-offline-${kind}`);
        expect(match).toBeTruthy();

        await serverInternal.runOfflineAdjudication(match, '0');

        expect(lastCommandType).toBe(expectedCommand);
    });

    it('sync should reject stale credentials after metadata refresh', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialMetadata = createMetadata('old-cred');
        await storage.createMatch('match-1', {
            initialState: createStoredState(),
            metadata: initialMetadata,
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const oldSocket = new MockSocket('socket-old');
        io.gameNamespace.connectSocket(oldSocket);
        await oldSocket.clientEmit('sync', 'match-1', '0', 'old-cred');
        expect(hasEvent(oldSocket, 'state:sync')).toBe(true);

        const refreshedMetadata: MatchMetadata = {
            ...initialMetadata,
            players: {
                ...initialMetadata.players,
                '0': {
                    ...initialMetadata.players['0'],
                    credentials: 'new-cred',
                },
            },
            updatedAt: Date.now(),
        };
        await storage.setMetadata('match-1', refreshedMetadata);

        // 不更新 active match 缓存，验证 sync 会主动读取存储层最新 metadata。
        await oldSocket.clientEmit('sync', 'match-1', '0', 'old-cred');
        expect(hasEvent(oldSocket, 'error', (args) => args[1] === 'unauthorized')).toBe(true);

        const newSocket = new MockSocket('socket-new');
        io.gameNamespace.connectSocket(newSocket);
        await newSocket.clientEmit('sync', 'match-1', '0', 'new-cred');
        expect(hasEvent(newSocket, 'state:sync')).toBe(true);
        expect(hasEvent(newSocket, 'error', (args) => args[1] === 'unauthorized')).toBe(false);
    });

    it('sync should prefer auth metadata provider for active matches', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-auth-provider', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-auth-provider'),
        });

        const fetchSpy = vi.spyOn(storage, 'fetch');
        const authMetadataSpy = vi.spyOn(storage, 'fetchAuthMetadata');

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-auth-provider');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-auth-provider', '0', 'cred-auth-provider');

        fetchSpy.mockClear();
        authMetadataSpy.mockClear();
        socket.sent.length = 0;

        await socket.clientEmit('sync', 'match-auth-provider', '0', 'cred-auth-provider');

        expect(authMetadataSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(hasEvent(socket, 'state:sync')).toBe(true);
    });

    it('sync should not wait for metadata persistence before emitting state:sync', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-sync-fast', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-fast'),
        });

        let resolvePersist: (() => void) | null = null;
        const persistBlocked = new Promise<void>((resolve) => {
            resolvePersist = resolve;
        });
        const setMetadataSpy = vi.spyOn(storage, 'setMetadata').mockImplementation(async (matchID, metadata) => {
            await persistBlocked;
            return InMemoryStorage.prototype.setMetadata.call(storage, matchID, metadata);
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-sync-fast');
        io.gameNamespace.connectSocket(socket);

        const syncPromise = socket.clientEmit('sync', 'match-sync-fast', '0', 'cred-fast');
        await nextTick();

        expect(hasEvent(socket, 'state:sync')).toBe(true);
        expect(setMetadataSpy).toHaveBeenCalledTimes(1);

        resolvePersist?.();
        await syncPromise;
    });

    it('离座后断开旧连接，使用新凭证可继续同一 seat 进度', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialMetadata = createMetadata('seat-cred-old');
        await storage.createMatch('match-2', {
            initialState: createStoredState(),
            metadata: initialMetadata,
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const oldSocket = new MockSocket('socket-seat-old');
        io.gameNamespace.connectSocket(oldSocket);
        await oldSocket.clientEmit('sync', 'match-2', '0', 'seat-cred-old');
        expect(hasEvent(oldSocket, 'state:sync')).toBe(true);

        const leftMetadata: MatchMetadata = {
            ...initialMetadata,
            players: {
                ...initialMetadata.players,
                '0': {
                    isConnected: false,
                },
            },
            updatedAt: Date.now(),
        };
        await storage.setMetadata('match-2', leftMetadata);
        server.updateMatchMetadata('match-2', leftMetadata);
        server.disconnectPlayer('match-2', '0', { disconnectSockets: true });
        await nextTick();
        expect(oldSocket.disconnected).toBe(true);

        const rejoinMetadata: MatchMetadata = {
            ...leftMetadata,
            players: {
                ...leftMetadata.players,
                '0': {
                    name: '接替玩家',
                    credentials: 'seat-cred-new',
                    isConnected: false,
                },
            },
            updatedAt: Date.now(),
        };
        await storage.setMetadata('match-2', rejoinMetadata);
        server.updateMatchMetadata('match-2', rejoinMetadata);

        const newSocket = new MockSocket('socket-seat-new');
        io.gameNamespace.connectSocket(newSocket);
        await newSocket.clientEmit('sync', 'match-2', '0', 'seat-cred-new');
        expect(hasEvent(newSocket, 'state:sync')).toBe(true);
        expect(hasEvent(newSocket, 'error', (args) => args[1] === 'unauthorized')).toBe(false);
    });

    it('不应通过 /game socket 暴露 test:injectState', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const initialState = createStoredState();
        await storage.createMatch('match-no-socket-inject', {
            initialState,
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-no-inject');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-no-socket-inject', '0', 'cred-0');
        expect(hasEvent(socket, 'state:sync')).toBe(true);

        const injectedState = createStoredState().G as { core: { currentPlayer: string } };
        injectedState.core.currentPlayer = '1';

        await socket.clientEmit('test:injectState', 'match-no-socket-inject', injectedState);

        const persisted = await storage.fetch('match-no-socket-inject', { state: true });
        expect((persisted.state?.G as { core: { currentPlayer: string } }).core.currentPlayer).toBe('0');
        expect(hasEvent(socket, 'test:injectState:success')).toBe(false);
        expect(hasEvent(socket, 'test:injectState:error')).toBe(false);
    });

    it('batch expectedStateID 落后于服务端权威 stateID 时，应拒绝为 stale_state 且不执行命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-batch-stale-state', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-batch-stale-state');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-batch-stale-state', '0', 'cred-0');
        await socket.clientEmit('command', 'match-batch-stale-state', 'TEST_CMD', { foo: 'fresh' }, 'cred-0');

        socket.sent.length = 0;

        await socket.clientEmit(
            'batch',
            'match-batch-stale-state',
            'batch-stale-1',
            [{ type: 'TEST_CMD', payload: { foo: 'stale' } }],
            'cred-0',
            { expectedStateID: 0 },
        );

        expect(hasEvent(socket, 'batch:rejected', (args) => args[1] === 'batch-stale-1' && args[2] === 'stale_state')).toBe(true);

        const persisted = await storage.fetch('match-batch-stale-state', { state: true });
        expect(persisted.state?._stateID).toBe(1);
    });

    it('成功命令后应采集训练决策样本', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const recorder = new MockTrainingDataRecorder();

        await storage.createMatch('match-train-1', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithGameOver()],
            trainingDataRecorder: recorder,
            rulesVersion: 'test-rules-v1',
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-train-1');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-train-1', '0', 'cred-0');
        await socket.clientEmit('command', 'match-train-1', 'TEST_CMD', { foo: 'bar' }, 'cred-0');

        expect(recorder.samples).toHaveLength(1);
        expect(recorder.samples[0]).toMatchObject({
            rulesVersion: 'test-rules-v1',
            gameId: 'test-game',
            matchId: 'match-train-1',
            playerId: '0',
            seatControllerType: 'human',
            stateIdBefore: 0,
            stateIdAfter: 1,
            command: {
                type: 'TEST_CMD',
                payload: { foo: 'bar' },
            },
            legalActions: [],
        });
        expect(recorder.samples[0].preState).toBeTruthy();
        expect(recorder.samples[0].postState).toBeTruthy();
    });

    it('training recorder 失败不应影响命令执行', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-train-fail', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithGameOver()],
            trainingDataRecorder: new FailingTrainingDataRecorder(),
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-train-fail');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-train-fail', '0', 'cred-0');
        await socket.clientEmit('command', 'match-train-fail', 'TEST_CMD', { foo: 'bar' }, 'cred-0');
        await nextTick();

        const persisted = await storage.fetch('match-train-fail', { state: true });
        expect(persisted.state?._stateID).toBe(1);
        expect(hasEvent(socket, 'error')).toBe(false);
    });

    it('训练采集应在达到时长门槛后才写入', async () => {
        vi.useFakeTimers();
        const now = Date.now();
        const minDurationMs = 10 * 60 * 1000;

        try {
            const io = new MockIO();
            const storage = new InMemoryStorage();
            const recorder = new MockTrainingDataRecorder();

            await storage.createMatch('match-train-duration', {
                initialState: createStoredState(),
                metadata: {
                    ...createMetadata('cred-duration'),
                    createdAt: now,
                    updatedAt: now,
                },
            });

            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                trainingDataRecorder: recorder,
                trainingDataMinMatchDurationMs: minDurationMs,
                authenticate: async (_matchID, playerID, credentials, metadata) => {
                    return metadata.players[playerID]?.credentials === credentials;
                },
            });
            server.start();

            const socket = new MockSocket('socket-train-duration');
            io.gameNamespace.connectSocket(socket);
            await socket.clientEmit('sync', 'match-train-duration', '0', 'cred-duration');
            await socket.clientEmit('command', 'match-train-duration', 'TEST_CMD', { foo: 'bar' }, 'cred-duration');

            expect(recorder.samples).toHaveLength(0);

            vi.setSystemTime(now + minDurationMs + 1000);
            await socket.clientEmit('command', 'match-train-duration', 'TEST_CMD_2', { foo: 'baz' }, 'cred-duration');

            expect(recorder.samples).toHaveLength(2);
            expect(recorder.samples[0].command.type).toBe('TEST_CMD');
            expect(recorder.samples[1].command.type).toBe('TEST_CMD_2');
        } finally {
            vi.useRealTimers();
        }
    });

    it('默认应跳过 AI seat 的训练样本，只记录真人 seat', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const recorder = new MockTrainingDataRecorder();

        await storage.createMatch('match-train-human-only', {
            initialState: createStoredState(),
            metadata: {
                ...createMetadata('cred-ai'),
                players: {
                    '0': { name: '玩家0', credentials: 'cred-ai', isConnected: false },
                    '1': { name: 'AI 玩家1', credentials: 'cred-ai-seat-1', isConnected: false },
                },
                setupData: {
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                    },
                },
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithGameOver()],
            trainingDataRecorder: recorder,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-train-human-only');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-train-human-only', '0', 'cred-ai');
        await socket.clientEmit('command', 'match-train-human-only', 'TEST_CMD', { foo: 'bar' }, 'cred-ai');

        expect(recorder.samples).toHaveLength(1);
        expect(recorder.samples[0]).toMatchObject({
            playerId: '0',
            seatControllerType: 'human',
        });

        await server.executeCommand('match-train-human-only', '1', 'AI_CMD', { auto: true });

        expect(recorder.samples).toHaveLength(1);
    });

    it('manifest 声明 all-seats 时应继续采集 AI seat 样本', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const recorder = new MockTrainingDataRecorder();
        const previousManifest = GAME_MANIFEST_BY_ID['test-game'];

        GAME_MANIFEST_BY_ID['test-game'] = {
            ...GAME_MANIFEST_BY_ID.tictactoe,
            id: 'test-game',
            ai: {
                ...GAME_MANIFEST_BY_ID.tictactoe.ai!,
                capture: true,
                capturePolicy: 'all-seats',
            },
        };

        try {
            await storage.createMatch('match-train-all-seats', {
                initialState: createStoredState(),
                metadata: {
                    ...createMetadata('cred-ai-all'),
                    players: {
                        '0': { name: '玩家0', credentials: 'cred-ai-all', isConnected: false },
                        '1': { name: 'AI 玩家1', credentials: 'cred-ai-seat-1', isConnected: false },
                    },
                    setupData: {
                        seatControllers: {
                            '0': { type: 'human' },
                            '1': { type: 'local-ai' },
                        },
                    },
                },
            });

            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithGameOver()],
                trainingDataRecorder: recorder,
                authenticate: async (_matchID, playerID, credentials, metadata) => {
                    return metadata.players[playerID]?.credentials === credentials;
                },
            });
            server.start();

            const socket = new MockSocket('socket-train-all-seats');
            io.gameNamespace.connectSocket(socket);
            await socket.clientEmit('sync', 'match-train-all-seats', '0', 'cred-ai-all');
            await server.executeCommand('match-train-all-seats', '1', 'AI_CMD', { auto: true });

            expect(recorder.samples).toHaveLength(1);
            expect(recorder.samples[0]).toMatchObject({
                playerId: '1',
                seatControllerType: 'local-ai',
                command: {
                    type: 'AI_CMD',
                    payload: { auto: true },
                },
            });
        } finally {
            if (previousManifest) {
                GAME_MANIFEST_BY_ID['test-game'] = previousManifest;
            } else {
                delete GAME_MANIFEST_BY_ID['test-game'];
            }
        }
    });

    it('online AI watchdog 在 active-turn 卡死时应持续推进直到交还给真人回合（或遇到 blocker/步数上限）', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-success', {
            initialState: createOnlineAiRecoveryState(),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 4,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-success');
        expect(match).toBeTruthy();

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType !== 'ADVANCE_PHASE') {
                return false;
            }
            if (activeMatch.state.sys.phase === 'main2') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'discard',
                    },
                };
                return true;
            }
            if (activeMatch.state.sys.phase === 'discard') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main1',
                        turnNumber: 5,
                    },
                };
                return true;
            }
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();
        await nextTick();

        // main2 -> discard -> main1（交还到玩家0）
        expect(executeSpy).toHaveBeenCalledTimes(2);
        expect(match.state.sys.phase).toBe('main1');
        expect(match.state.sys.turnNumber).toBe(5);
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-success',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
        }));
    });

    it('online AI watchdog 完成 legal action 恢复后也应写入系统反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-legal-action-recovery';

        let legalActionCallCount = 0;
        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => legalActionCallCount++ > 0 ? [] : [{
                actionId: 'legal-advance',
                kind: 'advance-phase',
                label: '合法推进阶段',
                commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
            }],
            localPolicies: {
                legalRecoveryPolicy: {
                    id: 'legalRecoveryPolicy',
                    decide: () => legalActionCallCount > 1 ? null : ({
                        actionId: 'legal-advance',
                        confidence: 0.91,
                        reasoningSummary: '当前 AI 仍有合法动作，先走合法动作恢复推进。',
                    }),
                },
            },
            defaultLocalPolicyId: 'legalRecoveryPolicy',
        });

        await storage.createMatch('match-watchdog-legal-action-feedback', {
            initialState: createOnlineAiRecoveryState(),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'legalRecoveryPolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-legal-action-feedback');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType === 'ADVANCE_PHASE' && activeMatch.state.sys.phase === 'main2') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main1',
                        turnNumber: 5,
                    },
                };
                return true;
            }
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();

        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(match.state.sys.phase).toBe('main1');
        expect(match.state.sys.turnNumber).toBe(5);
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-legal-action-feedback',
            gameId,
            playerId: '1',
            incidentKind: 'legal-action-recovered',
            status: 'resolved',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as { reason?: string; stateSnapshot?: string } | undefined;
        expect(payload?.reason).toContain('active-turn:legal-action:advance-phase:legal-advance');
        expect(typeof payload?.stateSnapshot).toBe('string');
    });

    it('online AI watchdog 在 summonerwars 应使用 END_PHASE 推进阶段', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-sw-end-phase', {
            initialState: createOnlineAiRecoveryState(),
            metadata: {
                ...createOnlineAiRecoveryMetadata(),
                gameName: 'summonerwars',
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('summonerwars')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-sw-end-phase');
        expect(match).toBeTruthy();

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType !== 'sw:end_phase') {
                return false;
            }
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'discard',
                },
            };
            return true;
        });

        const candidate = {
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:test',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:test',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        };
        const tracker = {
            key: 'test',
            firstSeenAt: Date.now(),
            autoSubmittedAt: null,
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        const progressMarker = buildAiProgressMarker(match.state);
        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            progressMarker,
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        // 初始 + 一次 follow-up（maxAdvanceSteps=1）都应映射成 sw:end_phase
        expect(executeSpy).toHaveBeenCalledTimes(2);
        expect(executeSpy).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            '1',
            'sw:end_phase',
            expect.anything(),
        );
        expect(executeSpy).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            '1',
            'sw:end_phase',
            expect.anything(),
        );
    });

    it('online AI watchdog 对 manifest 明确禁用 AI 的游戏应忽略残留 seatControllers', async () => {
        const gameId = 'watchdog-no-ai-game';
        const previousManifest = GAME_MANIFEST_BY_ID[gameId];
        GAME_MANIFEST_BY_ID[gameId] = {
            ...GAME_MANIFEST_BY_ID.tictactoe,
            id: gameId,
            ai: {
                capture: true,
                localAi: false,
                remoteAi: false,
            },
        };

        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-splendor-manifest-no-ai', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main1',
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'stale-splendor-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        try {
            await serverInternal.loadMatch('match-watchdog-splendor-manifest-no-ai');
            const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
            executeSpy.mockRestore();
        } finally {
            if (previousManifest) {
                GAME_MANIFEST_BY_ID[gameId] = previousManifest;
            } else {
                delete GAME_MANIFEST_BY_ID[gameId];
            }
        }
    });

    it('online AI watchdog fallback 到 ADVANCE_PHASE 前应校验当前仍是 AI 回合，避免误推进 human 回合', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-advance-guard-blocked', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-advance-guard-blocked');
        expect(match).toBeTruthy();

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'idle',
            idleReason: 'no-action',
        });
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        const candidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            allowForceCommandAfterLegalActionExhausted: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:advance-guard',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:advance-guard',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        };
        const tracker = {
            key: 'advance-guard-test',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        const progressMarker = buildAiProgressMarker(match.state);

        try {
            await serverInternal.runOnlineAiRecoverySequence(
                match,
                tracker,
                candidate,
                progressMarker,
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            );
        } finally {
            resolutionSpy.mockRestore();
            executeSpy.mockRestore();
        }

        expect(executeSpy).not.toHaveBeenCalled();
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-advance-guard-blocked',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('advance_guard_blocked'),
        }));
    });

    it('online AI watchdog 不得在当前轮到 human 时误触发恢复', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-human-guard', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main2',
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-human-guard');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });

    it('online AI watchdog 在 AI 当前阶段卡在 human 可见交互时不得误发 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-human-visible-interaction', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'human-choice-1',
                        '0',
                        'human choice',
                        [{
                            id: 'move-base',
                            label: '移动基地',
                            value: { targetId: 'base-2' },
                        }],
                        {
                            sourceId: 'pirate_first_mate_choose_base',
                            targetType: 'base',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-human-visible-interaction');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });

    it('online AI watchdog 在缺失 interaction id 的 AI 交互上应先取消交互，避免误发 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-missing-interaction-id', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            options: [],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-missing-interaction-id');
        const executed: string[] = [];
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            executed.push(commandType);
            expect(playerID).toBe('1');

            if (commandType === 'SYS_INTERACTION_CANCEL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main1',
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                    },
                };
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                return false;
            }

            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy).toHaveBeenCalled();
            expect(executed[0]).toBe('SYS_INTERACTION_CANCEL');
            expect(executed).not.toContain('ADVANCE_PHASE');
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.phase).toBe('main1');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-missing-interaction-id',
                playerId: '1',
                incidentKind: 'force-end-turn-success',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
        }
    });

    it('online AI watchdog 缺少 enableAi 标记时仍应根据 seatControllers 启动', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-stale-seat-controllers', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main2',
            }),
            metadata: {
                ...createOnlineAiRecoveryMetadata(),
                setupData: {
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                    },
                },
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-stale-seat-controllers');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            if (commandType !== 'ADVANCE_PHASE') {
                return false;
            }
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'main1',
                    turnNumber: (activeMatch.state.sys?.turnNumber ?? 0) + 1,
                },
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '0',
                    currentPlayerIndex: 0,
                },
            };
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).toHaveBeenCalled();
        expect(match.state.core.activePlayerId).toBe('0');
        expect(match.state.sys.phase).toBe('main1');
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-stale-seat-controllers',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
        }));
    });

    it('online AI watchdog 在 human 当前响应窗口中不应误判为 AI 卡死', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-window-human', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1', // AI 回合
                phase: 'main2',
                responseWindow: {
                    current: {
                        id: 'rw-1',
                        windowType: 'test',
                        responderQueue: ['0'], // 轮到 human 响应
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-response-window-human');
        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType) => {
            executed.push(commandType);

            return false;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executed).toEqual([]);
        expect(match.state.sys.responseWindow.current).toMatchObject({
            id: 'rw-1',
            responderQueue: ['0'],
            currentResponderIndex: 0,
        });
        expect(match.state.sys.phase).toBe('main2');
        expect(match.state.core.activePlayerId).toBe('1');
        expect(feedbackReporter).not.toHaveBeenCalled();
    });

    it('online AI watchdog 在 legal-only 恢复前若现场切到 human afterRollConfirmed，应丢弃旧 candidate 而不是继续上报失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-stale-legal-only-becomes-human-response', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-stale-legal-only-becomes-human-response');
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: {
                            id: 'rw-after-roll-human-late-1',
                            sourceId: 'attack-roll-1',
                            windowType: 'afterRollConfirmed',
                            responderQueue: ['0'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 6; i++) { await nextTick(); }

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(match.state.sys.responseWindow.current).toMatchObject({
            id: 'rw-after-roll-human-late-1',
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
            currentResponderIndex: 0,
        });
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect((server as any).onlineAiRecoveryTrackers.has('match-watchdog-stale-legal-only-becomes-human-response')).toBe(false);
    });

    it('online AI watchdog 在额外战术交互卡住后，不应自动 ADVANCE_PHASE 跳过 AI 回合', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'playCards',
            interaction: {
                current: createSimpleChoice(
                    'smashup-extra-action-choice',
                    '1',
                    '立刻打出一张额外战术，或放弃这次机会',
                    [
                        {
                            id: 'card-0',
                            label: '额外战术 A',
                            value: { cardUid: 'hand-1', defId: 'test_action' },
                        },
                        {
                            id: 'skip',
                            label: '放弃这次额外战术',
                            value: { skip: true },
                        },
                    ],
                    {
                        sourceId: 'smashup_immediate_extra_action',
                        targetType: 'hand',
                    },
                ),
                queue: [],
                isBlocked: false,
            },
        });
        initialState.G.core = {
            ...initialState.G.core,
            players: {
                '0': {
                    id: '0',
                    factionIds: ['robot'],
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
            bases: [],
        };

        await storage.createMatch('match-watchdog-smashup-extra-action-skip-turn', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });
        const originalResolveNextAiDispatch = aiModule.resolveNextAiDispatch;
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        let dispatchAttempt = 0;
        resolutionSpy.mockImplementation(async (...args) => {
            dispatchAttempt += 1;
            if (dispatchAttempt === 1) {
                return originalResolveNextAiDispatch(...args as Parameters<typeof aiModule.resolveNextAiDispatch>);
            }
            return {
                kind: 'idle',
                idleReason: 'no-action',
            } as any;
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-extra-action-skip-turn');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            phase: 'playCards',
                            turnNumber: (activeMatch.state.sys?.turnNumber ?? 4) + 1,
                        },
                    };
                    return true;
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(executed.map((item) => item.commandType)).toEqual([
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(executed[0]?.payload).toEqual({ optionId: 'card-0' });
            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.phase).toBe('playCards');
            expect(match.state.sys.turnNumber).toBe(4);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-smashup-extra-action-skip-turn',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
                reason: 'visible-interaction:legal-action:interaction-choice:interaction:smashup-extra-action-choice:card-0',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 在额外战术交互中遇到 private overlay stale 时，不应 fallback 到 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-extra-action-private-overlay-stale', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-stale-overlay',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:stale-private-overlay',
            diagnostics: {
                sharedPhase: 'playCards',
                privatePhase: 'playCards',
                sharedTurnNumber: 4,
                privateTurnNumber: 4,
                sharedCurrentPlayerId: '1',
                privateCurrentPlayerId: '1',
            },
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                broadcastState: (match: any) => void;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-extra-action-private-overlay-stale');
            const broadcastSpy = vi.spyOn(serverInternal, 'broadcastState');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            phase: 'playCards',
                            turnNumber: (activeMatch.state.sys?.turnNumber ?? 4) + 1,
                        },
                    };
                    return true;
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executed.map((item) => item.commandType)).toEqual([
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(executed[0]?.payload).toEqual({ optionId: 'skip' });
            expect(match.state.core.activePlayerId).toBe('1');
            expect(match.state.sys.turnNumber).toBe(4);
            expect(broadcastSpy).toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 遇到 private overlay stale 时，应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-private-overlay-stale-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-emergency-view',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'playCards',
                    privatePhase: 'playCards',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:smashup-extra-action-choice-emergency-view:skip',
                        kind: 'interaction-choice',
                        label: '放弃这次额外战术',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { optionId: 'skip' },
                        }],
                    },
                    attemptKey: 'watchdog-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-private-overlay-stale-emergency-view');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    throw new Error('不应在 emergency playerView 重试成功后触发 ADVANCE_PHASE');
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed.map((item) => item.commandType)).toEqual([
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-smashup-private-overlay-stale-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 在 factionSelect legal-action-only 遇到 private overlay stale 时，也应使用 emergency playerView 重试合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-faction-select-private-overlay-stale-emergency-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'factionSelect',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'factionSelect',
                    privatePhase: 'factionSelect',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'select-faction:wizards',
                        kind: 'select-faction',
                        label: '选择派系 wizards',
                        commands: [{
                            type: 'SELECT_FACTION',
                            payload: { factionId: 'wizards' },
                        }],
                    },
                    attemptKey: 'watchdog-faction-select-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-faction-select-private-overlay-stale-emergency-view');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                if (commandType !== 'SELECT_FACTION') {
                    throw new Error(`Unexpected command: ${commandType}`);
                }
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed.map((item) => item.commandType)).toEqual(['SELECT_FACTION']);
            expect(executed[0]?.payload).toEqual({ factionId: 'wizards' });
            expect(match.state.core.activePlayerId).toBe('0');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-faction-select-private-overlay-stale-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 在 response window 遇到 private overlay stale 时，也应使用 emergency playerView 重试响应动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const initialState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'defensiveRoll',
            responseWindow: {
                current: {
                    id: 'response-window-stale-emergency-view-1',
                    windowType: 'afterAttackResolved',
                    sourceId: 'attack-1',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                },
            },
        });
        initialState.G.sys.actionLog = {
            entries: [
                {
                    text: '玩家 1 进入防御响应窗口',
                    event: { type: 'dt:response-window-opened' },
                },
            ],
        } as any;
        initialState.G.sys.eventStream = {
            ...(initialState.G.sys.eventStream ?? {}),
            nextId: 2,
            entries: [
                {
                    type: 'dt:response-window-opened',
                    timestamp: 123,
                    payload: { sourceId: 'attack-1' },
                },
            ],
        } as any;

        await storage.createMatch('match-watchdog-response-window-private-overlay-stale-emergency-view', {
            initialState,
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 1,
                    privateEventStreamNextId: 0,
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'response-play-card:card-next-time',
                        kind: 'response-play-card',
                        label: '打出下次不算',
                        commands: [{
                            type: 'PLAY_CARD',
                            payload: { cardId: 'card-next-time' },
                        }],
                    },
                    attemptKey: 'watchdog-response-window-emergency-player-view',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-response-window-private-overlay-stale-emergency-view');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('1');

                if (commandType !== 'PLAY_CARD') {
                    throw new Error(`Unexpected command: ${commandType}`);
                }

                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(executed).toEqual([{
                commandType: 'PLAY_CARD',
                payload: { cardId: 'card-next-time' },
            }]);
            expect(match.state.sys.responseWindow?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-response-window-private-overlay-stale-emergency-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as {
                stateSnapshot?: string;
                actionLog?: string;
            } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('attack-1');
            expect(snapshot.trackerKey).toContain('attack-1');
            expect(snapshot.recentActionLogTail).toContainEqual(expect.objectContaining({
                text: '玩家 1 进入防御响应窗口',
                type: 'dt:response-window-opened',
            }));
            expect(snapshot.recentEventStreamTail).toContainEqual(expect.objectContaining({
                type: 'dt:response-window-opened',
                payload: expect.objectContaining({ sourceId: 'attack-1' }),
            }));

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog).toMatchObject({
                kind: 'online-ai-feedback-diagnostic',
                reason: 'response-window',
            });
            expect(actionLog.blockerFingerprint).toContain('attack-1');
            expect(actionLog.trackerKey).toContain('attack-1');
            expect(actionLog.actionLogTail).toContainEqual(expect.objectContaining({
                text: '玩家 1 进入防御响应窗口',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 触发 overlay resync 后应按冷却去重，避免连续广播风暴', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-overlay-resync-cooldown', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-resync-cooldown',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:stale-private-overlay',
            diagnostics: {
                sharedPhase: 'playCards',
                privatePhase: 'playCards',
                sharedTurnNumber: 4,
                privateTurnNumber: 4,
                sharedCurrentPlayerId: '1',
                privateCurrentPlayerId: '1',
            },
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                broadcastState: (match: any) => void;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            await serverInternal.loadMatch('match-watchdog-overlay-resync-cooldown');
            const broadcastSpy = vi.spyOn(serverInternal, 'broadcastState');
            vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(true);

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            // 首次 blocked 触发一次 resync，冷却期内不应重复广播。
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
        } finally {
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 应优先执行 AI 合法动作来解除可见交互阻塞，而不是直接 force-end-turn', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-action', {
            initialState: createOnlineAiRecoveryState({
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-1',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                action: {
                    actionId: 'interaction:reaction-choice-1:pass',
                    kind: 'interaction-choice',
                    label: 'Pass',
                    commands: [{
                        type: INTERACTION_COMMANDS.RESPOND,
                        payload: { optionId: 'pass' },
                    }],
                },
                attemptKey: 'watchdog-ai-action',
                source: 'local-ai',
            },
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createInteractiveEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-action');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-visible-interaction-action',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });


    it('watchdog falls back to first trigger respond for smashup mandatory reaction ordering', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-mandatory-order-fallback', {
            initialState: createOnlineAiRecoveryState({
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-mandatory-order',
                        '1',
                        '??????????',
                        [
                            {
                                id: 'trigger-base-arena',
                                label: '???',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:base_arena:1777092533686:0' },
                            },
                            {
                                id: 'trigger-wizard-archmage',
                                label: '???',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:wizard_archmage:1777092533686:0' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:stale-private-overlay',
            diagnostics: null,
        } as any);

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createInteractiveEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    match.state = {
                        ...match.state,
                        sys: {
                            ...match.state.sys,
                            eventStream: {
                                ...(match.state.sys?.eventStream ?? {}),
                                nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(match.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                }
                return true;
            });

            const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-mandatory-order-fallback');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executed[0]).toEqual({
                commandType: INTERACTION_COMMANDS.RESPOND,
                payload: { optionId: 'trigger-base-arena' },
            });
            expect(match.state.sys.interaction?.current).toBeUndefined();
        } finally {
            resolutionSpy.mockRestore();
        }
    });

    it('watchdog falls back to first trigger respond for smashup onTurnEnd mandatory reaction ordering', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-turn-end-mandatory-order-fallback', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '3',
                        currentPlayerIndex: 3,
                        turnOrder: ['0', '1', '2', '3'],
                    },
                    sys: {
                        phase: 'endTurn',
                        turnNumber: 9,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: createSimpleChoice(
                                'smashup_reaction_turn-end:3:2:0_3_0',
                                '3',
                                '选择一个反应动作',
                                [
                                    {
                                        id: 'trigger:onTurnEnd:steampunk_difference_engine:0:0',
                                        label: '差分机',
                                        value: { kind: 'trigger', triggerId: 'onTurnEnd:steampunk_difference_engine:0:0' },
                                    },
                                    {
                                        id: 'trigger:onTurnEnd:tricksters_big_funny_giant:0:1',
                                        label: '滑稽巨人',
                                        value: { kind: 'trigger', triggerId: 'onTurnEnd:tricksters_big_funny_giant:0:1' },
                                    },
                                ],
                                {
                                    sourceId: 'smashup_reaction_choose',
                                    targetType: 'button',
                                },
                            ),
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'smashup',
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'local-ai' },
                    '2': { type: 'local-ai' },
                    '3': { type: 'local-ai' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'idle',
            idleReason: 'no-action',
        } as any);

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('3');
                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    expect(payload).toEqual({ optionId: 'trigger:onTurnEnd:steampunk_difference_engine:0:0' });
                    match.state = {
                        ...match.state,
                        core: {
                            ...match.state.core,
                            activePlayerId: '3',
                            currentPlayerIndex: 3,
                        },
                        sys: {
                            ...match.state.sys,
                            eventStream: {
                                ...(match.state.sys?.eventStream ?? {}),
                                nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(match.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                            responseWindow: {
                                ...(match.state.sys?.responseWindow ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }
                if (commandType === 'ADVANCE_PHASE') {
                    match.state = {
                        ...match.state,
                        core: {
                            ...match.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...match.state.sys,
                            phase: 'startTurn',
                            eventStream: {
                                ...(match.state.sys?.eventStream ?? {}),
                                nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(match.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                            responseWindow: {
                                ...(match.state.sys?.responseWindow ?? {}),
                                current: undefined,
                            },
                        },
                    };
                }
                return true;
            });

            const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-turn-end-mandatory-order-fallback');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executed).toEqual([
                {
                    commandType: INTERACTION_COMMANDS.RESPOND,
                    payload: { optionId: 'trigger:onTurnEnd:steampunk_difference_engine:0:0' },
                },
                {
                    commandType: 'ADVANCE_PHASE',
                    payload: {},
                },
            ]);
            expect(match.state.sys.phase).toBe('startTurn');
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-visible-interaction-turn-end-mandatory-order-fallback',
                playerId: '3',
                incidentKind: 'force-end-turn-success',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 处理 live 校验交互时，应沿用原始 interactionData 快照，避免下游把 blocker 重新挂回', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-live-interaction-snapshot';

        const makeSnapshotSensitiveInteraction = () => createSimpleChoice(
            'snapshot-sensitive-choice',
            '1',
            '选择一张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
                { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
            ],
            {
                sourceId: 'test-live-snapshot',
                targetType: 'button',
                autoRefresh: 'hand',
                responseValidationMode: 'live',
            },
        );

        const expectedOptionIds = ['opt-1', 'opt-2', 'pass'];
        const snapshotSensitiveSystem = {
            id: 'snapshot-sensitive-followup',
            name: 'SnapshotSensitiveFollowUp',
            priority: 40,
            afterEvents: ({ state, events }: { state: any; events: any[] }) => {
                let newState = state;

                for (const event of events) {
                    if (event.type !== 'SYS_INTERACTION_RESOLVED') {
                        continue;
                    }

                    const payload = event.payload as {
                        sourceId?: string;
                        interactionData?: {
                            options?: Array<{ id?: string }>;
                        };
                    };
                    if (payload.sourceId !== 'test-live-snapshot') {
                        continue;
                    }

                    const optionIds = Array.isArray(payload.interactionData?.options)
                        ? payload.interactionData.options
                            .map((option) => option?.id)
                            .filter((id): id is string => typeof id === 'string')
                        : [];
                    const snapshotPreserved = JSON.stringify(optionIds) === JSON.stringify(expectedOptionIds);

                    newState = {
                        ...newState,
                        core: {
                            ...newState.core,
                            activePlayerId: snapshotPreserved ? '0' : '1',
                            currentPlayerIndex: snapshotPreserved ? 0 : 1,
                        },
                        sys: {
                            ...newState.sys,
                            phase: snapshotPreserved ? 'draw' : 'scoreBases',
                            eventStream: {
                                ...(newState.sys?.eventStream ?? {}),
                                nextId: (newState.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: snapshotPreserved
                                ? {
                                    ...(newState.sys?.interaction ?? {}),
                                    current: undefined,
                                    queue: [],
                                    isBlocked: false,
                                }
                                : {
                                    ...(newState.sys?.interaction ?? {}),
                                    current: makeSnapshotSensitiveInteraction(),
                                    queue: [],
                                    isBlocked: false,
                                },
                        },
                    };
                }

                return { halt: false, state: newState, events: [] };
            },
        } as any;

        await storage.createMatch('match-watchdog-live-interaction-snapshot', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hand: [] },
                            '1': {
                                hand: [{ uid: 'card-1', defId: 'test-card-1' }],
                            },
                        },
                    },
                    sys: {
                        phase: 'scoreBases',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: makeSnapshotSensitiveInteraction(),
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({ gameName: gameId }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...createInteractiveEngineConfig(),
                gameId,
                domain: {
                    ...createInteractiveEngineConfig().domain,
                    gameId,
                },
                systems: [
                    createInteractionSystem(),
                    createSimpleChoiceSystem(),
                    snapshotSensitiveSystem,
                ],
            }],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-live-interaction-snapshot');
        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();

        expect(match.state.core.activePlayerId).toBe('0');
        expect(match.state.sys.phase).toBe('draw');
        expect(match.state.sys.interaction?.current).toBeUndefined();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-live-interaction-snapshot',
            incidentKind: 'force-end-turn-success',
            reason: 'visible-interaction:recover-interaction:steps=1',
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-live-interaction-snapshot',
            incidentKind: 'force-end-turn-failed',
        }));
    });

    it('online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-faction-select-legal-action', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '2',
                        currentPlayerIndex: 2,
                        turnOrder: ['0', '1', '2', '3'],
                        factionSelection: {
                            takenFactions: ['aliens', 'pirates'],
                            playerSelections: {
                                '0': ['aliens'],
                                '1': ['pirates'],
                                '2': [],
                                '3': [],
                            },
                            completedPlayers: [],
                        },
                    },
                    sys: {
                        phase: 'factionSelect',
                        turnNumber: 1,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: {
                gameName: 'test-game',
                players: {
                    '0': { name: '玩家0', credentials: 'cred-0', isConnected: false },
                    '1': { name: 'AI 1', credentials: 'cred-1', isConnected: false },
                    '2': { name: 'AI 2', credentials: 'cred-2', isConnected: false },
                    '3': { name: 'AI 3', credentials: 'cred-3', isConnected: false },
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
                setupData: {
                    enableAi: true,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                        '2': { type: 'local-ai' },
                        '3': { type: 'local-ai' },
                    },
                },
            },
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '2',
                action: {
                    actionId: 'select-faction:robots',
                    kind: 'select-faction',
                    label: '选择派系 robots',
                    commands: [{
                        type: 'SELECT_FACTION',
                        payload: { factionId: 'robots' },
                    }],
                },
                attemptKey: 'watchdog-faction-select-step-1',
                source: 'local-ai',
            },
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('2');
            expect(commandType).toBe('SELECT_FACTION');
            expect(payload).toEqual({ factionId: 'robots' });

            const core = activeMatch.state.core as {
                factionSelection: {
                    takenFactions: string[];
                    playerSelections: Record<string, string[]>;
                    completedPlayers: string[];
                };
            };

            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    activePlayerId: '3',
                    currentPlayerIndex: 3,
                    factionSelection: {
                        ...core.factionSelection,
                        takenFactions: [...core.factionSelection.takenFactions, 'robots'],
                        playerSelections: {
                            ...core.factionSelection.playerSelections,
                            '2': ['robots'],
                        },
                    },
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: 2 },
                },
            };

            return true;
        });

        try {
            const match = await serverInternal.loadMatch('match-watchdog-faction-select-legal-action');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual(['SELECT_FACTION']);
            expect(match.state.core.activePlayerId).toBe('3');
            expect(match.state.sys.phase).toBe('factionSelect');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-faction-select-legal-action',
                playerId: '2',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 在 summonerwars 公开选阵营阶段也应代 AI 执行 legal action', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-summonerwars-pregame-legal-action', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        hostStarted: false,
                        hostPlayerId: '0',
                        selectedFactions: {
                            '0': 'necromancer',
                            '1': 'unselected',
                        },
                        readyPlayers: {
                            '0': false,
                            '1': false,
                        },
                    },
                    sys: {
                        phase: 'summon',
                        turnNumber: 1,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'summonerwars',
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'sw:select-faction:paladin',
                        kind: 'setup-select-faction',
                        label: '选择阵营 paladin',
                        commands: [{
                            type: 'sw:select_faction',
                            payload: { factionId: 'paladin' },
                        }],
                    },
                    attemptKey: 'watchdog-summonerwars-pregame-step-1',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'sw:select-faction:paladin',
                        kind: 'setup-select-faction',
                        label: '选择阵营 paladin',
                        commands: [{
                            type: 'sw:select_faction',
                            payload: { factionId: 'paladin' },
                        }],
                    },
                    attemptKey: 'watchdog-summonerwars-pregame-step-1-apply',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'sw:select-faction:paladin',
                        kind: 'setup-select-faction',
                        label: '选择阵营 paladin',
                        commands: [{
                            type: 'sw:select_faction',
                            payload: { factionId: 'paladin' },
                        }],
                    },
                    attemptKey: 'watchdog-summonerwars-pregame-step-1-recover',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'idle',
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('summonerwars')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('sw:select_faction');
            expect(payload).toEqual({ factionId: 'paladin' });

            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    selectedFactions: {
                        ...activeMatch.state.core.selectedFactions,
                        '1': 'paladin',
                    },
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: 2 },
                },
            };

            return true;
        });

        try {
            const match = await serverInternal.loadMatch('match-watchdog-summonerwars-pregame-legal-action');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual(['sw:select_faction']);
            expect(match.state.core.selectedFactions).toMatchObject({
                '0': 'necromancer',
                '1': 'paladin',
            });
            expect(match.state.core.hostStarted).toBe(false);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-summonerwars-pregame-legal-action',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-offturn-defensive-legal-action';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const phase = (state.sys?.phase ?? '') as string;
                const core = state.core as {
                    rollCount?: number;
                    rollConfirmed?: boolean;
                };

                if (playerId !== '1' || phase !== 'defensiveRoll') {
                    return [];
                }

                if ((core.rollCount ?? 0) === 0) {
                    return [{
                        actionId: 'legal-roll',
                        kind: 'roll-dice',
                        label: '合法防御掷骰',
                        commands: [{ type: 'ROLL_DICE', payload: {} }],
                    }];
                }

                if (core.rollConfirmed !== true) {
                    return [{
                        actionId: 'legal-confirm',
                        kind: 'confirm-roll',
                        label: '合法确认防御骰',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                    }];
                }

                return [{
                    actionId: 'legal-advance',
                    kind: 'advance-phase',
                    label: '合法结束防御阶段',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                }];
            },
            localPolicies: {
                offTurnLegalRecoveryPolicy: {
                    id: 'offTurnLegalRecoveryPolicy',
                    decide: (context) => ({
                        actionId: context.legalActions[0]?.actionId ?? 'legal-advance',
                        confidence: 0.96,
                        reasoningSummary: '当前真人仍是 activePlayer，但 AI 防御阶段已有合法动作，应由 watchdog 代执行。',
                    }),
                },
            },
            defaultLocalPolicyId: 'offTurnLegalRecoveryPolicy',
        });

        await storage.createMatch('match-watchdog-offturn-defensive-legal-action', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'offTurnLegalRecoveryPolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-offturn-defensive-legal-action');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'ROLL_DICE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollCount: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 2 },
                    },
                };
                return true;
            }

            if (commandType === 'CONFIRM_ROLL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollConfirmed: true,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 3 },
                    },
                };
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main2',
                        eventStream: { nextId: 4 },
                    },
                };
                return true;
            }

            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual([
                'ROLL_DICE',
                'CONFIRM_ROLL',
                'ADVANCE_PHASE',
            ]);
            expect(match.state.sys.phase).toBe('main2');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-offturn-defensive-legal-action',
                gameId,
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { reason?: string } | undefined;
            expect(payload?.reason).toContain('seat-legal-only:legal-action:advance-phase:legal-advance');
        } finally {
            executeSpy.mockRestore();
        }
    });

    it('online AI watchdog 在 human active 的 off-turn targetingRoll 阶段也应代 AI 执行合法动作，避免 4 人选目标卡死', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-offturn-targeting-legal-action';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const phase = (state.sys?.phase ?? '') as string;
                const core = state.core as {
                    rollCount?: number;
                    rollConfirmed?: boolean;
                };

                if (playerId !== '1' || phase !== 'targetingRoll') {
                    return [];
                }

                if ((core.rollCount ?? 0) === 0) {
                    return [{
                        actionId: 'legal-roll',
                        kind: 'roll-dice',
                        label: '合法掷出选目标骰',
                        commands: [{ type: 'ROLL_DICE', payload: {} }],
                    }];
                }

                if (core.rollConfirmed !== true) {
                    return [{
                        actionId: 'legal-confirm',
                        kind: 'confirm-roll',
                        label: '合法确认选目标骰',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                    }];
                }

                return [{
                    actionId: 'legal-advance',
                    kind: 'advance-phase',
                    label: '合法结束 targetingRoll',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                }];
            },
            localPolicies: {
                offTurnTargetingRecoveryPolicy: {
                    id: 'offTurnTargetingRecoveryPolicy',
                    decide: (context) => ({
                        actionId: context.legalActions[0]?.actionId ?? 'legal-advance',
                        confidence: 0.96,
                        reasoningSummary: '当前真人仍是 activePlayer，但 AI targetingRoll 已有合法动作，应由 watchdog 代执行。',
                    }),
                },
            },
            defaultLocalPolicyId: 'offTurnTargetingRecoveryPolicy',
        });

        await storage.createMatch('match-watchdog-offturn-targeting-legal-action', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'offTurnTargetingRecoveryPolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-offturn-targeting-legal-action');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'ROLL_DICE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollCount: 1,
                        rollConfirmed: false,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 2 },
                    },
                };
                return true;
            }

            if (commandType === 'CONFIRM_ROLL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollConfirmed: true,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 3 },
                    },
                };
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'defensiveRoll',
                        eventStream: { nextId: 4 },
                    },
                };
                return true;
            }

            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual([
                'ROLL_DICE',
                'CONFIRM_ROLL',
                'ADVANCE_PHASE',
            ]);
            expect(match.state.sys.phase).toBe('defensiveRoll');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-offturn-targeting-legal-action',
                gameId,
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { reason?: string } | undefined;
            expect(payload?.reason).toContain('seat-legal-only:legal-action:advance-phase:legal-advance');
        } finally {
            executeSpy.mockRestore();
        }
    });

    it('online AI watchdog 在 AI active 的 targetingRoll 且 legalActions 为空时，不得 fallback 到裸 ADVANCE_PHASE', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-active-targeting-legal-only-no-fallback';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                idlePolicy: {
                    id: 'idlePolicy',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'idlePolicy',
        });

        await storage.createMatch('match-watchdog-active-targeting-legal-only-no-fallback', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        rollCount: 1,
                        rollLimit: 1,
                        rollConfirmed: true,
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 7,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'idlePolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-active-targeting-legal-only-no-fallback');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-active-targeting-legal-only-no-fallback',
            gameId,
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('active-turn-legal-only:follow-up-advance:legal_action_unavailable'),
        }));
    });

    it('dicethrone: defensiveRoll 存在 displayOnly pendingBonusDiceSettlement 时，watchdog 仍应按防御合法动作推进，而不是误打 bonus-die 命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'dicethrone';

        await storage.createMatch('match-watchdog-dicethrone-displayonly-bonus-settlement', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hp: 50, maxHp: 50, combatPoints: 0, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                            '1': { hp: 50, maxHp: 50, combatPoints: 0, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                        },
                        selectedCharacters: {
                            '0': 'monk',
                            '1': 'shadow_thief',
                        },
                        rollCount: 0,
                        rollLimit: 1,
                        rollDiceCount: 0,
                        dice: [],
                        rollConfirmed: false,
                        pendingAttack: {
                            attackerId: '0',
                            defenderId: '1',
                            isDefendable: true,
                            sourceAbilityId: 'fist-technique-5',
                            defenseAbilityId: 'shadow-defense',
                        },
                        pendingBonusDiceSettlement: {
                            id: 'display-only-bonus-1',
                            attackerId: '1',
                            displayOnly: true,
                            dice: [{ index: 0, value: 4, originalValue: 4, rerolled: false }],
                        },
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-bonus-settlement-step-1',
                    source: 'local-ai',
                    action: {
                        actionId: 'roll:dice',
                        kind: 'roll-dice',
                        label: '掷骰',
                        commands: [{ type: 'ROLL_DICE', payload: {} }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-bonus-settlement-step-2',
                    source: 'local-ai',
                    action: {
                        actionId: 'roll:confirm',
                        kind: 'confirm-roll',
                        label: '确认骰面',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-bonus-settlement-step-3',
                    source: 'local-ai',
                    action: {
                        actionId: 'phase:advance',
                        kind: 'advance-phase',
                        label: '结束防御阶段',
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                },
            })
            .mockResolvedValue({
                kind: 'idle' as const,
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-displayonly-bonus-settlement');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'ROLL_DICE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollCount: 1,
                        rollDiceCount: 4,
                        dice: [
                            { id: 0, value: 1 },
                            { id: 1, value: 2 },
                            { id: 2, value: 3 },
                            { id: 3, value: 4 },
                        ],
                        rollConfirmed: false,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 2 },
                    },
                };
                return true;
            }

            if (commandType === 'CONFIRM_ROLL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollConfirmed: true,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 3 },
                    },
                };
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main2',
                        eventStream: { nextId: 4 },
                    },
                };
                return true;
            }

            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            const executed = executeSpy.mock.calls.map(([, , commandType]) => commandType);
            expect(executed).toContain('ADVANCE_PHASE');
            expect(executed).not.toContain('REROLL_BONUS_DIE');
            expect(executed).not.toContain('SKIP_BONUS_DICE_REROLL');
            expect(match.state.sys.phase).toBe('main2');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-dicethrone-displayonly-bonus-settlement',
                gameId,
                playerId: '1',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

    it('dicethrone: displayOnly pendingBonusDiceSettlement 遇到响应窗口 + 交互链时，watchdog 应持续收口且不误打 bonus-die 命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'dicethrone';

        await storage.createMatch('match-watchdog-dicethrone-displayonly-response-chain', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hp: 50, maxHp: 50, combatPoints: 0, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                            '1': { hp: 50, maxHp: 50, combatPoints: 0, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                        },
                        selectedCharacters: {
                            '0': 'monk',
                            '1': 'shadow_thief',
                        },
                        pendingAttack: {
                            attackerId: '0',
                            defenderId: '1',
                            isDefendable: true,
                            sourceAbilityId: 'fist-technique-5',
                            defenseAbilityId: 'shadow-defense',
                        },
                        pendingBonusDiceSettlement: {
                            id: 'display-only-bonus-chain-1',
                            attackerId: '1',
                            displayOnly: true,
                            dice: [{ index: 0, value: 4, originalValue: 4, rerolled: false }],
                        },
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: createSimpleChoice(
                                'dt-response-choice-1',
                                '1',
                                '处理展示态后的响应',
                                [{
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                }],
                                {
                                    sourceId: 'dt_displayonly_chain',
                                    targetType: 'button',
                                },
                            ),
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: {
                                id: 'dt-response-window-1',
                                windowType: 'afterRollConfirmed',
                                sourceId: 'card-give-hand',
                                responderQueue: ['0', '1'],
                                currentResponderIndex: 1,
                                passedPlayers: [],
                            },
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-response-chain-step-1',
                    source: 'local-ai',
                    action: {
                        actionId: 'interaction:dt-response-choice-1:pass',
                        kind: 'interaction-choice',
                        label: 'Pass',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { optionId: 'pass' },
                        }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-response-chain-step-2',
                    source: 'local-ai',
                    action: {
                        actionId: 'interaction:dt-card:select-player',
                        kind: 'interaction-select-player',
                        label: '选择目标',
                        commands: [{
                            type: 'RESOLVE_INTERACTION',
                            payload: { selectedPlayerIds: ['0'] },
                        }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-response-chain-step-3',
                    source: 'local-ai',
                    action: {
                        actionId: 'interaction:dt-response-choice-2:pass',
                        kind: 'interaction-choice',
                        label: 'Pass again',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { optionId: 'pass' },
                        }],
                    },
                },
            })
            .mockResolvedValue({
                kind: 'idle' as const,
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-displayonly-response-chain');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'SYS_INTERACTION_RESPOND') {
                const currentInteractionId = (activeMatch.state.sys?.interaction?.current as { id?: string } | undefined)?.id;
                if (currentInteractionId === 'dt-response-choice-1') {
                    expect(payload).toEqual({ optionId: 'pass' });
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: { nextId: 2 },
                            interaction: {
                                current: {
                                    id: 'dt-card-interaction-1',
                                    playerId: '1',
                                    sourceCardId: 'card-give-hand',
                                    type: 'selectPlayer',
                                    titleKey: 'interaction.selectPlayer',
                                    selectCount: 1,
                                    selected: [],
                                    targetPlayerIds: ['0'],
                                },
                                queue: [],
                                isBlocked: false,
                            },
                        },
                    };
                    return true;
                }

                if (currentInteractionId === 'dt-response-choice-2') {
                    expect(payload).toEqual({ optionId: 'pass' });
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            phase: 'main2',
                            eventStream: { nextId: 4 },
                            interaction: {
                                current: undefined,
                                queue: [],
                                isBlocked: false,
                            },
                            responseWindow: {
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }
            }

            if (commandType === 'RESOLVE_INTERACTION') {
                expect(payload).toEqual({ selectedPlayerIds: ['0'] });
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 3 },
                        interaction: {
                            current: createSimpleChoice(
                                'dt-response-choice-2',
                                '1',
                                '交互后续响应',
                                [{
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                }],
                                {
                                    sourceId: 'dt_displayonly_chain_followup',
                                    targetType: 'button',
                                },
                            ),
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: {
                                id: 'dt-response-window-2',
                                windowType: 'afterCardPlayed',
                                sourceId: 'card-give-hand',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                                passedPlayers: [],
                            },
                        },
                    },
                };
                return true;
            }

            throw new Error(`Unexpected command: ${String(commandType)}`);
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            for (let i = 0; i < 10; i++) { await nextTick(); }

            const executed = executeSpy.mock.calls.map(([, , commandType]) => commandType);
            expect(executed).toEqual([
                'SYS_INTERACTION_RESPOND',
                'RESOLVE_INTERACTION',
                'SYS_INTERACTION_RESPOND',
            ]);
            expect(executed).not.toContain('REROLL_BONUS_DIE');
            expect(executed).not.toContain('SKIP_BONUS_DICE_REROLL');
            expect(match.state.sys.phase).toBe('main2');
            expect(match.state.sys.responseWindow?.current).toBeUndefined();
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(match.state.core.pendingBonusDiceSettlement).toMatchObject({
                id: 'display-only-bonus-chain-1',
                displayOnly: true,
            });
            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-dicethrone-displayonly-response-chain',
                gameId,
                playerId: '1',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

    it('dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'dicethrone';
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'idle',
            idleReason: 'no-action',
        });

        await storage.createMatch('match-watchdog-dicethrone-orphan-displayonly-main1', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hp: 28, maxHp: 50, combatPoints: 3, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                            '1': { hp: 29, maxHp: 50, combatPoints: 2, statusEffects: {}, tokens: { loaded: 1 }, hand: [], deck: [], discardPile: [] },
                        },
                        selectedCharacters: {
                            '0': 'shadow_thief',
                            '1': 'gunslinger',
                        },
                        pendingAttack: undefined,
                        pendingBonusDiceSettlement: {
                            id: 'bounty-hunter-display-1777712668078',
                            sourceAbilityId: 'bounty-hunter',
                            attackerId: '1',
                            targetId: '0',
                            dice: [{
                                index: 0,
                                value: 6,
                                face: 'bullseye',
                                effectKey: 'bonusDie.effect.gunslingerLoadedDie',
                                effectParams: {
                                    value: 6,
                                    index: 0,
                                    bonusDamage: 3,
                                },
                            }],
                            rerollCostTokenId: '',
                            rerollCostAmount: 0,
                            rerollCount: 0,
                            maxRerollCount: 0,
                            readyToSettle: false,
                            displayOnly: true,
                        },
                    },
                    sys: {
                        phase: 'main1',
                        turnNumber: 9,
                        eventStream: { nextId: 18 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-orphan-displayonly-main1');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('SKIP_BONUS_DICE_REROLL');

            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    pendingBonusDiceSettlement: undefined,
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: 19 },
                },
            };
            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual([
                'SKIP_BONUS_DICE_REROLL',
            ]);
            expect(match.state.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(match.state.sys.phase).toBe('main1');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-dicethrone-orphan-displayonly-main1',
                gameId,
                playerId: '1',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

    it('dicethrone: human active main2 时 watchdog 不应触发 seat-legal-only 代打推进', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'dicethrone';
        const resolveDispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                source: 'local-ai',
                action: {
                    actionId: 'ai-main2-advance',
                    kind: 'advance-phase',
                    label: 'AI 主阶段推进',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        } as any);

        await storage.createMatch('match-watchdog-dicethrone-human-main2-no-legal-only', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'main2',
                        turnNumber: 5,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-dicethrone-human-main2-no-legal-only');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolveDispatchSpy).not.toHaveBeenCalled();
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolveDispatchSpy.mockRestore();
        }
    });

    it('通用: human active 且非 defensiveRoll 阶段时，watchdog 不应尝试 seat-legal-only 代打', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'smashup';
        const resolveDispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                source: 'local-ai',
                action: {
                    actionId: 'ai-playcards-advance',
                    kind: 'advance-phase',
                    label: 'AI 推进阶段',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        } as any);

        await storage.createMatch('match-watchdog-generic-human-active-no-legal-only', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'playCards',
                        turnNumber: 5,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-generic-human-active-no-legal-only');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolveDispatchSpy).not.toHaveBeenCalled();
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolveDispatchSpy.mockRestore();
        }
    });

    it('cardia: human active play 阶段时，watchdog 不应触发 seat-legal-only 代打', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'cardia';
        const resolveDispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                source: 'local-ai',
                action: {
                    actionId: 'ai-play-advance',
                    kind: 'advance-phase',
                    label: 'AI 推进阶段',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        } as any);

        await storage.createMatch('match-watchdog-cardia-human-active-play-no-legal-only', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'play',
                        turnNumber: 1,
                        eventStream: { nextId: 21 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-cardia-human-active-play-no-legal-only');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolveDispatchSpy).not.toHaveBeenCalled();
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolveDispatchSpy.mockRestore();
        }
    });

    it('online AI watchdog 在 defensiveRoll 实际由 human 防御方行动时，不应误对 AI 攻击方执行 force-end-turn', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-defensive-human-actor', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 2,
                        rollConfirmed: false,
                        pendingAttack: {
                            attackerId: '1',
                            defenderId: '0',
                            isDefendable: true,
                            sourceAbilityId: 'test-attack',
                        },
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 3,
                        eventStream: { nextId: 69 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-defensive-human-actor');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });

    it('online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-chain', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-1',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'reaction-window',
                        windowType: 'meFirst',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:reaction-choice-1:pass',
                        kind: 'interaction-choice',
                        label: 'Pass',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { optionId: 'pass' },
                        }],
                    },
                    attemptKey: 'watchdog-chain-step-1',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:reaction-choice-2:pass',
                        kind: 'interaction-choice',
                        label: 'Pass',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { optionId: 'pass' },
                        }],
                    },
                    attemptKey: 'watchdog-chain-step-2',
                    source: 'local-ai',
                },
            })
            .mockResolvedValue({
                kind: 'idle' as const,
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('SYS_INTERACTION_RESPOND');

            const currentInteractionId = (activeMatch.state.sys?.interaction?.current as { id?: string } | undefined)?.id;
            if (currentInteractionId === 'reaction-choice-1') {
                expect(payload).toEqual({ optionId: 'pass' });
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '1',
                    phase: 'scoreBases',
                    interaction: {
                        current: createSimpleChoice(
                            'reaction-choice-2',
                            '1',
                            '第二段反应动作',
                            [
                                {
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                },
                            ],
                            {
                                sourceId: 'smashup_reaction_choose',
                                targetType: 'button',
                            },
                        ),
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: {
                            id: 'reaction-window',
                            windowType: 'meFirst',
                            responderQueue: ['0', '1'],
                            currentResponderIndex: 1,
                            passedPlayers: [],
                        },
                    },
                }).G as any;
                return true;
            }

            if (currentInteractionId === 'reaction-choice-2') {
                expect(payload).toEqual({ optionId: 'pass' });
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '0',
                    phase: 'draw',
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                }).G as any;
                return true;
            }

            throw new Error(`Unexpected interaction id: ${String(currentInteractionId)}`);
        });

        try {
            const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-chain');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(buildAiProgressMarker(match.state)).toBe('4|draw|1|0|||||||0');
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-visible-interaction-chain',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'smashup';

        await storage.createMatch('match-watchdog-interaction-followup-advance', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-followup',
                        '1',
                        '选择一个反应动作',
                        [{
                            id: 'pass',
                            label: 'Pass',
                            value: { kind: 'pass' },
                        }],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'reaction-window-followup',
                        windowType: 'meFirst',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: gameId }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:reaction-choice-followup:pass',
                        kind: 'interaction-choice',
                        label: 'Pass',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { optionId: 'pass' },
                        }],
                    },
                    attemptKey: 'watchdog-followup-step-1',
                    source: 'local-ai',
                },
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'SYS_INTERACTION_RESPOND') {
                expect(payload).toEqual({ optionId: 'pass' });
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '1',
                    phase: 'scoreBases',
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    eventStreamNextId: 2,
                }).G as any;
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '0',
                    phase: 'draw',
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    eventStreamNextId: 3,
                }).G as any;
                return true;
            }

            throw new Error(`Unexpected command: ${commandType}`);
        });

        try {
            const match = await serverInternal.loadMatch('match-watchdog-interaction-followup-advance');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(call => call[2])).toEqual(['SYS_INTERACTION_RESPOND', 'ADVANCE_PHASE']);
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.core.activePlayerId).toBe('0');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-interaction-followup-advance',
                playerId: '1',
                incidentKind: 'force-end-turn-success',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });

    it('online AI watchdog 失败反馈应按 incident key 去重冷却', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-failure', {
            initialState: createOnlineAiRecoveryState(),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-failure');
        vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(false);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-failure',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
        }));
    });

    it('smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const smashUpWatchdogConfig = {
            ...smashUpEngineConfig,
            systems: smashUpSystemsForTest.filter((_, index) => index !== 8),
        };

        await storage.createMatch('match-watchdog-smashup-stale-reaction-choice', {
            initialState: createPersistedStaleSmashUpReactionChoiceState(),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [smashUpWatchdogConfig],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-smashup-stale-reaction-choice');
        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();

        expect(match.state.sys.interaction?.current).toBeUndefined();
        expect(match.state.sys.responseWindow?.current).toBeUndefined();
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-smashup-stale-reaction-choice',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-smashup-stale-reaction-choice',
            playerId: '1',
            status: 'resolved',
        }));
    });

    it('smashup AI reaction pass 后仍停在同一交互时，应升级为硬取消而不是 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-reaction-pass-stuck', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'reaction-choice-stuck',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个反应动作',
                            options: [
                                {
                                    id: 'trigger-ninja-dojo',
                                    label: '结算 Ninja Dojo',
                                    value: { kind: 'trigger', triggerId: 'afterScoring:base_ninja_dojo:1:0' },
                                },
                                {
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-smashup-reaction-pass-stuck');
        const executed: Array<{ commandType: string; payload: unknown }> = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
            executed.push({ commandType, payload });
            expect(playerID).toBe('1');

            if (commandType === INTERACTION_COMMANDS.RESPOND) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        interaction: {
                            ...(activeMatch.state.sys?.interaction ?? {}),
                            current: {
                                ...(activeMatch.state.sys?.interaction?.current ?? {}),
                                id: 'reaction-choice-stuck-reopened',
                            },
                        },
                    },
                };
                return true;
            }

            if (commandType === INTERACTION_COMMANDS.CANCEL) {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'playCards',
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        interaction: {
                            ...(activeMatch.state.sys?.interaction ?? {}),
                            current: undefined,
                            isBlocked: false,
                        },
                    },
                };
                return true;
            }

            return false;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }

        expect(executed.map((item) => item.commandType)).toEqual([
            INTERACTION_COMMANDS.RESPOND,
            INTERACTION_COMMANDS.CANCEL,
        ]);
        expect(match.state.sys.interaction?.current).toBeUndefined();
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-smashup-reaction-pass-stuck',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
    });

    it('online AI watchdog 自动反馈冷却期内应按 trackerKey 去重，即使 progressMarker 变化也不重复上报', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryFeedbackCooldownMs: 60_000,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            reportOnlineAiRecoveryFeedback: (payload: {
                matchId: string;
                gameId: string;
                playerId: string;
                incidentKind:
                    | 'force-end-turn-success'
                    | 'force-end-turn-failed'
                    | 'unsatisfiable-interaction-auto-skipped'
                    | 'legal-action-recovered';
                severity: 'medium' | 'high';
                reason: string;
                trackerKey: string;
                progressMarker: string;
                stateSnapshot: string;
                actionLog?: string;
            }) => Promise<void>;
        };

        const payload = {
            matchId: 'match-watchdog-dedupe',
            gameId: 'smashup',
            playerId: '1',
            incidentKind: 'force-end-turn-failed' as const,
            severity: 'high' as const,
            reason: 'visible-interaction:recover-interaction:blocker_persisted',
            trackerKey: '1:visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose:选择一个反应动作::2',
            progressMarker: 'marker-before-1',
            stateSnapshot: '{"matchId":"match-watchdog-dedupe"}',
        };

        await serverInternal.reportOnlineAiRecoveryFeedback(payload);
        await serverInternal.reportOnlineAiRecoveryFeedback({
            ...payload,
            progressMarker: 'marker-before-2',
        });

        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-dedupe',
            trackerKey: payload.trackerKey,
            progressMarker: 'marker-before-1',
        }));
    });

    it('online AI watchdog 默认上报链路不应把成功恢复类事件写入反馈库', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryFeedbackCooldownMs: 60_000,
        });

        const serverInternal = server as unknown as {
            reportOnlineAiRecoveryFeedback: (payload: {
                matchId: string;
                gameId: string;
                playerId: string;
                incidentKind:
                    | 'force-end-turn-success'
                    | 'force-end-turn-failed'
                    | 'unsatisfiable-interaction-auto-skipped'
                    | 'legal-action-recovered';
                severity: 'medium' | 'high';
                reason: string;
                trackerKey: string;
                progressMarker: string;
                stateSnapshot: string;
                actionLog?: string;
            }) => Promise<void>;
            defaultOnlineAiFeedbackReporter: (payload: unknown) => Promise<void>;
        };

        const defaultReporterSpy = vi.spyOn(serverInternal, 'defaultOnlineAiFeedbackReporter').mockResolvedValue();

        await serverInternal.reportOnlineAiRecoveryFeedback({
            matchId: 'match-watchdog-suppress-success',
            gameId: 'dicethrone',
            playerId: '1',
            incidentKind: 'legal-action-recovered',
            severity: 'medium',
            reason: 'active-turn:legal-action:roll-dice:roll:dice',
            trackerKey: '1:active-turn:0|defensiveRoll|42|0|||||||1',
            progressMarker: 'marker-before-1',
            stateSnapshot: '{"matchId":"match-watchdog-suppress-success"}',
        });

        expect(defaultReporterSpy).not.toHaveBeenCalled();
    });

    it('online AI watchdog 自动反馈应携带交互选项与可选性诊断信息', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-option-diagnostics', {
            initialState: createOnlineAiRecoveryState({
                interaction: {
                    current: {
                        id: 'visible-choice-1',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'dt-test-visible-choice',
                            title: 'interaction.chooseTarget',
                            multi: { min: 1 },
                            options: [
                                {
                                    id: 'option-disabled',
                                    label: '被禁用目标',
                                    disabled: true,
                                    disabledReason: '目标已失效',
                                    value: { targetId: 'm-1' },
                                },
                                {
                                    id: 'option-manual',
                                    label: '只能人工决定',
                                    value: { targetId: 'm-2' },
                                },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-option-diagnostics');
        vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(false);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string } | undefined;
        expect(typeof payload?.stateSnapshot).toBe('string');
        const snapshot = JSON.parse(payload!.stateSnapshot!);

        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'option-disabled',
            disabled: true,
        }));
        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'option-manual',
        }));
        expect(snapshot.interaction?.seatSelectability).toMatchObject({
            totalOptions: 2,
            enabledOptions: 1,
            disabledOptions: 1,
            selectionState: 'manual-selection-required',
            disabledOptionIds: ['option-disabled'],
            enabledOptionIds: ['option-manual'],
        });
        expect(snapshot.blockerFingerprint).toContain('dt-test-visible-choice');
    });

    it('online AI watchdog 自动反馈应携带 AI 决策预览', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-preview';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [{
                actionId: 'advance-phase',
                kind: 'advance-phase',
                label: '结束阶段',
                commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
            }],
            localPolicies: {
                previewPolicy: {
                    id: 'previewPolicy',
                    decide: () => ({
                        actionId: 'advance-phase',
                        confidence: 0.88,
                        reasoningSummary: '阶段已无可执行动作；优先结束阶段',
                    }),
                },
            },
            defaultLocalPolicyId: 'previewPolicy',
        });

        await storage.createMatch('match-watchdog-ai-preview', {
            initialState: createOnlineAiRecoveryState({
                interaction: {
                    current: {
                        id: 'preview-choice',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'preview-source',
                            title: 'interaction.preview',
                            multi: { min: 1 },
                            options: [{
                                id: 'preview-option',
                                label: '预览选项',
                                value: { targetId: 'x-1' },
                            }],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'previewPolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-ai-preview');
        vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(false);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');

        expect(snapshot.seatControllerType).toBe('local-ai');
        expect(snapshot.legalActions).toMatchObject({
            total: 1,
            truncated: false,
        });
        expect(snapshot.legalActions?.items).toContainEqual(expect.objectContaining({
            actionId: 'advance-phase',
            kind: 'advance-phase',
            label: '结束阶段',
            commandTypes: ['ADVANCE_PHASE'],
        }));
        expect(snapshot.aiDecisionPreview).toMatchObject({
            previewSource: 'seat-policy',
            policyId: 'previewPolicy',
            reasoningSummary: '阶段已无可执行动作；优先结束阶段',
            confidence: 0.88,
            error: null,
        });
        expect(snapshot.aiDecisionPreview?.chosenAction).toMatchObject({
            actionId: 'advance-phase',
            kind: 'advance-phase',
            label: '结束阶段',
            commandTypes: ['ADVANCE_PHASE'],
        });
    });

    it('online AI watchdog 应能识别 dt:card-interaction 无可选目标并携带 reason 取消交互', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-dt-card-empty', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { statusEffects: {}, tokens: {} },
                            '1': { statusEffects: {}, tokens: {} },
                        },
                    },
                    sys: {
                        phase: 'main2',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: {
                                id: 'dt-interaction-empty',
                                kind: 'dt:card-interaction',
                                playerId: '1',
                                data: {
                                    type: 'selectStatus',
                                    targetPlayerIds: ['0', '1'],
                                    requiresTargetWithStatus: true,
                                },
                            },
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-dt-card-empty');

        let firstCommand: { type: string; payload: unknown } | null = null;
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (_match, _playerID, commandType, payload) => {
            if (!firstCommand) {
                firstCommand = { type: commandType, payload };
            }
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(firstCommand).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
    });

    it('命令异常触发 auto-cancel 时，若 CANCEL 自身失败也不应递归爆栈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const executedCommandTypes: string[] = [];

        const guardedEngineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            systems: [
                {
                    id: 'throw-on-command',
                    name: 'throw-on-command',
                    priority: 1,
                    beforeCommand: ({ command }: { command: { type: string } }) => {
                        executedCommandTypes.push(command.type);
                        if (command.type === 'TRIGGER_ERROR' || command.type === INTERACTION_COMMANDS.CANCEL) {
                            throw new Error(`forced-${command.type}`);
                        }
                    },
                } as any,
            ],
        };

        const interaction = createSimpleChoice(
            'interaction-cancel-recursion-guard',
            '0',
            '测试交互',
            [{ id: 'ok', label: '确认', value: 'ok' }],
        );

        await storage.createMatch('match-cancel-recursion-guard', {
            initialState: {
                G: {
                    core: { currentPlayer: '0' },
                    sys: {
                        phase: 'main',
                        turnNumber: 1,
                        interaction: {
                            current: interaction,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [guardedEngineConfig],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-cancel-recursion-guard');
        const success = await serverInternal.executeCommandInternal(match, '0', 'TRIGGER_ERROR', {});

        expect(success).toBe(false);
        expect(executedCommandTypes).toEqual(['TRIGGER_ERROR', INTERACTION_COMMANDS.CANCEL]);
    });

    it('online AI watchdog 响应循环时应强制关闭响应窗口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-loop', {
            initialState: createOnlineAiRecoveryState({
                responseWindow: {
                    current: {
                        id: 'response-loop-1',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 1,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-response-loop');

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, _playerID, commandType) => {
            executed.push(commandType);
            if (commandType === 'RESPONSE_PASS') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: {
                                id: 'response-loop-2',
                                windowType: 'afterCardPlayed',
                                sourceId: 'card-1',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
            }
            if (commandType === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
            }
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }

        expect(executed).toContain('SYS_RESPONSE_WINDOW_FORCE_CLOSE');
    });

    it('online AI watchdog 不得把“事件流有变化但同一 AI 响应窗口立刻重开”误判为恢复成功', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-reopen-progress', {
            initialState: createOnlineAiRecoveryState({
                responseWindow: {
                    current: {
                        id: 'response-reopen-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'card-surprise-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 1,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-response-reopen-progress');

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, _playerID, commandType) => {
            executed.push(commandType);

            if (commandType === 'RESPONSE_PASS') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: {
                                id: 'response-reopen-2',
                                windowType: 'afterRollConfirmed',
                                sourceId: 'card-surprise-2',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
                return true;
            }

            if (commandType === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        // recovery sequence is fire-and-forget; need enough microtask cycles for it to complete
        for (let i = 0; i < 10; i++) { await nextTick(); }
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }

        expect(executed[0]).toBe('RESPONSE_PASS');
        expect(executed).toContain('SYS_RESPONSE_WINDOW_FORCE_CLOSE');
    });

    it('online AI watchdog 在 response window 先执行非 pass 合法动作时，不应误触发强制关窗', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-watchdog-response-window-non-pass';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                if (playerId !== '1') {
                    return [];
                }

                const responseWindow = (state.sys?.responseWindow as { current?: unknown } | undefined)?.current as
                    | { responderQueue?: unknown; currentResponderIndex?: unknown }
                    | undefined;
                if (!responseWindow) {
                    return [];
                }

                const responderQueue = Array.isArray(responseWindow.responderQueue)
                    ? responseWindow.responderQueue
                    : [];
                const responderIndex = typeof responseWindow.currentResponderIndex === 'number'
                    ? responseWindow.currentResponderIndex
                    : 0;
                const currentResponderId = responderQueue[responderIndex];
                if (currentResponderId !== '1') {
                    return [];
                }

                const core = state.core as { modifiedOnce?: boolean };
                if (core.modifiedOnce !== true) {
                    return [{
                        actionId: 'legal-modify-die',
                        kind: 'modify-die',
                        label: '合法改骰',
                        commands: [{ type: 'MODIFY_DIE', payload: { dieIndex: 0, value: 6 } }],
                    }];
                }

                return [{
                    actionId: 'legal-response-pass',
                    kind: 'response-pass',
                    label: '结束响应',
                    commands: [{ type: 'RESPONSE_PASS', payload: {} }],
                }];
            },
            localPolicies: {
                responseWindowPolicy: {
                    id: 'responseWindowPolicy',
                    decide: (context) => ({
                        actionId: context.legalActions[0]?.actionId ?? 'legal-response-pass',
                        confidence: 0.95,
                        reasoningSummary: '先执行改骰动作，再按合法动作收口响应窗口。',
                    }),
                },
            },
            defaultLocalPolicyId: 'responseWindowPolicy',
        });

        await storage.createMatch('match-watchdog-response-window-non-pass', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-non-pass-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'responseWindowPolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 2,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-response-window-non-pass');

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType) => {
            executed.push(commandType);
            expect(playerID).toBe('1');

            if (commandType === 'MODIFY_DIE') {
                match.state = {
                    ...match.state,
                    core: {
                        ...match.state.core,
                        modifiedOnce: true,
                    },
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: {
                                id: 'response-window-non-pass-2',
                                windowType: 'afterRollConfirmed',
                                sourceId: 'attack-1',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
                return true;
            }

            if (commandType === 'RESPONSE_PASS') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            if (commandType === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE') {
                return true;
            }

            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }

        expect(executed).toContain('MODIFY_DIE');
        expect(executed).toContain('RESPONSE_PASS');
        expect(executed).not.toContain('SYS_RESPONSE_WINDOW_FORCE_CLOSE');
    });

    it('online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-responder-not-active-player', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-response-responder-not-active-player');

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, _playerID, commandType) => {
            executed.push(commandType);

            if (commandType === 'RESPONSE_PASS') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executed[0]).toBe('RESPONSE_PASS');
    });

    it('online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-hidden-interaction-lock', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main1',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-after-card-hidden-1',
                        windowType: 'afterCardPlayed',
                        sourceId: 'action-poison-tip',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                        pendingInteractionId: 'card-bye-bye-1777601349600',
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
            applyPlayerView: (match: any, playerID: string) => MatchState<unknown>;
        };

        await serverInternal.loadMatch('match-watchdog-hidden-interaction-lock');

        let hiddenResolved = false;
        vi.spyOn(serverInternal, 'applyPlayerView').mockImplementation((match, playerID) => {
            if (playerID !== '1') {
                return match.state as MatchState<unknown>;
            }
            return {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    interaction: hiddenResolved
                        ? {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        }
                        : {
                            current: {
                                id: 'card-bye-bye-1777601349600',
                                kind: 'simple-choice',
                                playerId: '1',
                                data: {
                                    sourceId: 'card-bye-bye',
                                    title: '选择要移除的状态效果',
                                    options: [
                                        { id: 'skip', label: '跳过', value: { skip: true } },
                                    ],
                                },
                            },
                            queue: [],
                            isBlocked: false,
                        },
                },
            } as MatchState<unknown>;
        });

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType, payload) => {
            executed.push(commandType);

            if (commandType === 'SYS_INTERACTION_RESPOND') {
                expect(playerID).toBe('1');
                expect(payload).toEqual({ optionId: 'skip' });
                hiddenResolved = true;
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executed[0]).toBe('SYS_INTERACTION_RESPOND');
        expect(executed).not.toContain('RESPONSE_PASS');
    });

    it('AI 走无解交互 emergency skip 时，服务端应立即自动反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const interaction = createSimpleChoice(
            'unsat-choice',
            '1',
            '测试无解交互',
            [{
                id: 'only-disabled',
                label: '唯一但不可选',
                value: { targetId: 'm-1' },
                disabled: true,
                disabledReason: '目标已失效',
            }],
            { sourceId: 'test-unsat-choice' },
        );

        await storage.createMatch('match-unsat-auto-feedback', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'main2',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: interaction,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createInteractiveEngineConfig()],
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-unsat-auto-feedback');
        const success = await serverInternal.executeCommandInternal(
            match,
            '1',
            INTERACTION_COMMANDS.RESPOND,
            { optionId: '__emergency_skip__' },
        );

        expect(success).toBe(true);
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-unsat-auto-feedback',
            playerId: '1',
            incidentKind: 'unsatisfiable-interaction-auto-skipped',
            status: 'resolved',
            reason: 'all-options-disabled',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.interaction?.seatSelectability).toMatchObject({
            totalOptions: 2,
            enabledOptions: 1,
            disabledOptions: 1,
            selectionState: 'recoverable-option-available',
        });
        expect(snapshot.interaction?.sharedSelectability).toMatchObject({
            totalOptions: 2,
            enabledOptions: 1,
            disabledOptions: 1,
            selectionState: 'recoverable-option-available',
        });
        expect(snapshot.seatControllerType).toBe('local-ai');
        expect(snapshot.legalActions).toMatchObject({
            total: 0,
            truncated: false,
        });
        expect(snapshot.aiDecisionPreview).toBeNull();
        expect(snapshot.recentActionLogTail).toEqual([]);
        expect(snapshot.recentEventStreamTail).toEqual([]);
        expect(snapshot.blockerFingerprint).toBe('main2:all-options-disabled:interaction:simple-choice:test-unsat-choice');
        expect(snapshot.interaction?.shared?.sourceId).toBe('test-unsat-choice');
        expect(snapshot.interaction?.seatUnsatisfiableReason).toBe('all-options-disabled');
        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: '__emergency_skip__',
        }));
        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'only-disabled',
            disabledReason: '目标已失效',
        }));

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog).toMatchObject({
            kind: 'online-ai-feedback-diagnostic',
            commandType: INTERACTION_COMMANDS.RESPOND,
            reason: 'all-options-disabled',
            blockerFingerprint: 'main2:all-options-disabled:interaction:simple-choice:test-unsat-choice',
        });
        expect(actionLog.interaction).toMatchObject({
            shared: {
                id: 'unsat-choice',
                kind: 'simple-choice',
                sourceId: 'test-unsat-choice',
            },
            seat: {
                id: 'unsat-choice',
                kind: 'simple-choice',
                sourceId: 'test-unsat-choice',
            },
        });
        expect(actionLog.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'only-disabled',
            disabledReason: '目标已失效',
        }));
    });
});


