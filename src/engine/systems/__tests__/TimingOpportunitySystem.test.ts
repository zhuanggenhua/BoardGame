import { describe, expect, it } from 'vitest';
import type { Opportunity } from '../../TimingOpportunity';
import { executePipeline } from '../../pipeline';
import { createBaseSystems } from '../index';
import { createSimpleChoiceFromTimingOpportunity, createTimingOpportunitySystem } from '../TimingOpportunitySystem';
import type { Command, DomainCore, GameEvent, MatchState, RandomFn } from '../../types';
import { DEFAULT_TUTORIAL_STATE } from '../../types';
import { SYSTEM_IDS } from '../types';

interface TestCore {
    hp: Record<string, number>;
    shieldCounters: Record<string, number>;
}

const mockRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: (arr) => [...arr],
};

const createTestState = (
    sysOverrides?: Partial<MatchState<TestCore>['sys']>,
): MatchState<TestCore> => ({
    core: {
        hp: { p1: 10, p2: 10 },
        shieldCounters: { p1: 0, p2: 0 },
    },
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        interaction: { queue: [] },
        log: { entries: [], maxEntries: 1000 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: { current: undefined },
        tutorial: { ...DEFAULT_TUTORIAL_STATE },
        turnNumber: 1,
        phase: 'main',
        ...sysOverrides,
    },
});

const createDomain = (
    discoverTimingOpportunities?: DomainCore<TestCore>['discoverTimingOpportunities'],
): DomainCore<TestCore> => ({
    gameId: 'test-game',
    setup: () => ({
        hp: { p1: 10, p2: 10 },
        shieldCounters: { p1: 0, p2: 0 },
    }),
    validate: () => ({ valid: true }),
    execute: () => [],
    reduce: (state) => state,
    ...(discoverTimingOpportunities ? { discoverTimingOpportunities } : {}),
});

const createChoiceOpportunity = (
    overrides: Partial<Opportunity> = {},
): Opportunity => {
    const timing = overrides.timing ?? {
        id: 'timing-1',
        gameId: 'test-game',
        position: 'postCommit',
        factKind: 'DAMAGE_DEALT',
    };

    return {
        id: 'opp-choice',
        timing,
        sourceRef: { kind: 'ability', id: 'shield', controllerId: 'p1' },
        controllerId: 'p1',
        class: 'optional',
        condition: true,
        resolution: { type: 'choice-request' },
        choice: {
            kind: 'confirm',
            candidates: [{
                id: 'use-shield',
                label: '使用护盾',
                commands: [{
                    type: 'USE_SHIELD',
                    payload: { opportunityId: 'opp-choice' },
                }],
            }],
            selection: { min: 1, max: 1 },
            resolution: { type: 'candidate-commands' },
            ai: { status: 'shared-policy' },
        },
        ...overrides,
    };
};

const createPipelineArgs = (
    state: MatchState<TestCore>,
    events: GameEvent[] = [{ type: 'DAMAGE_DEALT', payload: { targetId: 'p2', amount: 2 }, timestamp: 1 }],
): {
    state: MatchState<TestCore>;
    command: Command;
    events: GameEvent[];
    random: RandomFn;
    playerIds: string[];
} => ({
    state,
    command: { type: 'ATTACK', playerId: 'p1', payload: {}, timestamp: 1 },
    events,
    random: mockRandom,
    playerIds: ['p1', 'p2'],
});

describe('TimingOpportunitySystem', () => {
    it('不是基础系统集合的一部分，必须由游戏按需接入', () => {
        expect(createBaseSystems<TestCore>().map((system) => system.id))
            .not.toContain(SYSTEM_IDS.TIMING_OPPORTUNITY);
    });

    it('旧游戏没有机会发现入口时不改变状态', () => {
        const state = createTestState();
        const system = createTimingOpportunitySystem(createDomain());

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result).toBeUndefined();
    });

    it('把 choice-request 机会投影为现有 simple-choice 交互', () => {
        const state = createTestState();
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestOptions: () => ({
                title: '选择护盾响应',
                targetType: 'button',
                buttonIntent: 'confirm-known-object',
            }),
        });

        const result = system.afterEvents?.(createPipelineArgs(state));
        const current = result?.state?.sys.interaction.current;

        expect(current).toMatchObject({
            id: 'opp-choice',
            kind: 'simple-choice',
            playerId: 'p1',
            data: {
                title: '选择护盾响应',
                sourceId: 'shield',
                targetType: 'button',
                buttonIntent: 'confirm-known-object',
                choiceRequest: {
                    requestId: 'opp-choice',
                    choiceKind: 'confirm',
                    sourceId: 'shield',
                },
            },
        });
        expect(current?.data.options).toEqual([
            expect.objectContaining({
                id: 'use-shield',
                label: '使用护盾',
            }),
        ]);
    });

    it('允许 choice-request 机会在入队时追加同源领域事件', () => {
        const state = createTestState();
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestOptions: () => ({ title: '选择护盾响应' }),
            choiceRequestEvents: ({ opportunity, choiceRequest, interaction }) => [{
                type: 'CHOICE_REQUESTED',
                payload: {
                    opportunityId: opportunity.id,
                    requestId: choiceRequest.requestId,
                    interactionId: interaction.id,
                },
                sourceCommandType: 'ATTACK',
                timestamp: 1,
            }],
        });

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result?.state.sys.interaction.current?.id).toBe('opp-choice');
        expect(result?.events).toEqual([{
            type: 'CHOICE_REQUESTED',
            payload: {
                opportunityId: 'opp-choice',
                requestId: 'opp-choice',
                interactionId: 'opp-choice',
            },
            sourceCommandType: 'ATTACK',
            timestamp: 1,
        }]);
    });

    it('允许 choice-request 机会投影到游戏专用 interaction', () => {
        const state = createTestState();
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestInteraction: ({ choiceRequest }) => ({
                id: `custom-${choiceRequest.requestId}`,
                kind: 'custom-choice',
                playerId: choiceRequest.playerId,
                data: {
                    choiceRequest: {
                        requestId: choiceRequest.requestId,
                        metadata: choiceRequest.metadata,
                    },
                },
            }),
        });

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result?.state.sys.interaction.current).toMatchObject({
            id: 'custom-opp-choice',
            kind: 'custom-choice',
            playerId: 'p1',
            data: {
                choiceRequest: {
                    requestId: 'opp-choice',
                    metadata: {
                        opportunityId: 'opp-choice',
                        timingPointId: expect.any(String),
                        opportunityClass: 'optional',
                    },
                },
            },
        });
    });

    it('游戏专用 interaction 携带 choiceRequest opportunityId 时不重复排队', () => {
        const state = createTestState({
            interaction: {
                current: {
                    id: 'custom-legacy-choice',
                    kind: 'custom-choice',
                    playerId: 'p1',
                    data: {
                        choiceRequest: {
                            requestId: 'custom-legacy-choice',
                            metadata: {
                                opportunityId: 'opp-choice',
                            },
                        },
                    },
                },
                queue: [],
            },
        });
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestInteraction: ({ choiceRequest }) => ({
                id: `custom-${choiceRequest.requestId}`,
                kind: 'custom-choice',
                playerId: choiceRequest.playerId,
                data: {
                    choiceRequest: {
                        requestId: choiceRequest.requestId,
                        metadata: choiceRequest.metadata,
                    },
                },
            }),
        });

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result).toBeUndefined();
    });

    it('游戏专用 interaction id 已存在时，即使旧交互没有 choiceRequest 元数据也不重复排队', () => {
        const state = createTestState({
            interaction: {
                current: {
                    id: 'custom-opp-choice',
                    kind: 'custom-choice',
                    playerId: 'p1',
                    data: null,
                },
                queue: [],
            },
        });
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestInteraction: ({ choiceRequest }) => ({
                id: `custom-${choiceRequest.requestId}`,
                kind: 'custom-choice',
                playerId: choiceRequest.playerId,
                data: {
                    choiceRequest: {
                        requestId: choiceRequest.requestId,
                        metadata: choiceRequest.metadata,
                    },
                },
            }),
        });

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result).toBeUndefined();
    });

    it('允许游戏 adapter 接管 ChoiceRequest interaction 的入队或原地替换语义', () => {
        const state = createTestState({
            interaction: {
                current: {
                    id: 'existing-token-response',
                    kind: 'custom-token-response',
                    playerId: 'p2',
                    data: null,
                },
                queue: [],
            },
        });
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestInteraction: ({ choiceRequest }) => ({
                id: `custom-${choiceRequest.requestId}`,
                kind: 'custom-token-response',
                playerId: choiceRequest.playerId,
                data: {
                    choiceRequest: {
                        requestId: choiceRequest.requestId,
                        metadata: choiceRequest.metadata,
                    },
                },
            }),
            queueChoiceInteraction: ({ state: currentState, interaction }) => ({
                ...currentState,
                core: {
                    ...currentState.core,
                    shieldCounters: {
                        ...currentState.core.shieldCounters,
                        p1: 1,
                    },
                },
                sys: {
                    ...currentState.sys,
                    interaction: {
                        ...currentState.sys.interaction,
                        current: interaction,
                    },
                },
            }),
        });

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result?.state.core.shieldCounters.p1).toBe(1);
        expect(result?.state.sys.interaction.current).toMatchObject({
            id: 'custom-opp-choice',
            kind: 'custom-token-response',
            playerId: 'p1',
            data: {
                choiceRequest: {
                    requestId: 'opp-choice',
                    metadata: {
                        opportunityId: 'opp-choice',
                    },
                },
            },
        });
        expect(result?.state.sys.interaction.queue).toEqual([]);
    });

    it('允许旧链路复用 Opportunity 投影并保留 legacy interaction id', () => {
        const interaction = createSimpleChoiceFromTimingOpportunity(
            createChoiceOpportunity({
                metadata: { priority: 10 },
            }),
            {
                title: '选择护盾响应',
                targetType: 'button',
            },
            {
                requestId: 'legacy-choice-1',
                interactionId: 'legacy-choice-1',
                metadata: { legacyInteractionId: 'legacy-choice-1' },
            },
        );

        expect(interaction).toMatchObject({
            id: 'legacy-choice-1',
            kind: 'simple-choice',
            data: {
                title: '选择护盾响应',
                sourceId: 'shield',
                choiceRequest: {
                    requestId: 'legacy-choice-1',
                    choiceKind: 'confirm',
                    sourceId: 'shield',
                    metadata: {
                        opportunityId: 'opp-choice',
                        timingPointId: 'timing-1',
                        opportunityClass: 'optional',
                        priority: 10,
                        legacyInteractionId: 'legacy-choice-1',
                    },
                },
                ai: {
                    decisions: [{
                        interactionId: 'legacy-choice-1',
                        metadata: {
                            opportunityId: 'opp-choice',
                            timingPointId: 'timing-1',
                            opportunityClass: 'optional',
                            priority: 10,
                            legacyInteractionId: 'legacy-choice-1',
                        },
                    }],
                },
            },
        });
    });

    it('legacy interaction id 不同时仍按 opportunityId 避免重复排队', () => {
        const existingInteraction = createSimpleChoiceFromTimingOpportunity(
            createChoiceOpportunity(),
            { title: '旧链路响应' },
            {
                requestId: 'legacy-choice-1',
                interactionId: 'legacy-choice-1',
                metadata: { legacyInteractionId: 'legacy-choice-1' },
            },
        );
        const state = createTestState({
            interaction: {
                current: existingInteraction,
                queue: [],
            },
        });
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestOptions: () => ({ title: '新系统响应' }),
        });

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result).toBeUndefined();
    });

    it('choiceRequest 诊断合同带有 opportunityId 时，即使没有 AI 元数据也不重复排队', () => {
        const existingInteraction = createSimpleChoiceFromTimingOpportunity(
            createChoiceOpportunity(),
            { title: '旧链路响应' },
            {
                requestId: 'legacy-choice-1',
                interactionId: 'legacy-choice-1',
                metadata: { legacyInteractionId: 'legacy-choice-1' },
            },
        );
        const state = createTestState({
            interaction: {
                current: {
                    ...existingInteraction,
                    data: {
                        ...existingInteraction.data,
                        ai: undefined,
                    },
                },
                queue: [],
            },
        });
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestOptions: () => ({ title: '新系统响应' }),
        });

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result).toBeUndefined();
    });

    it('把 response-window 机会投影为响应窗口状态', () => {
        const state = createTestState();
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({
                id: 'opp-response',
                timing,
                class: 'response',
                choice: undefined,
                resolution: {
                    type: 'response-window',
                    windowType: 'after-damage',
                    responderQueue: ['p2', 'p1'],
                    requiredInteractionId: 'choose-response-card',
                },
            })],
        }));
        const system = createTimingOpportunitySystem(domain);

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result?.state?.sys.responseWindow.current).toEqual({
            id: 'opp-response',
            windowType: 'after-damage',
            sourceId: 'shield',
            responderQueue: ['p2', 'p1'],
            currentResponderIndex: 0,
            passedPlayers: [],
            requiredInteractionId: 'choose-response-card',
        });
    });

    it('把 child-frame 机会投影为活动结算帧', () => {
        const state = createTestState();
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({
                id: 'opp-follow-up',
                timing,
                class: 'delayed',
                choice: undefined,
                resolution: {
                    type: 'child-frame',
                    frameKind: 'damage-follow-up',
                    phase: 'main',
                    phaseGate: 'block-advance-when-blocked',
                    metadata: { damageId: 'damage-1' },
                },
            })],
        }));
        const system = createTimingOpportunitySystem(domain);

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result?.state?.sys.resolution).toMatchObject({
            activeFrameId: 'opp-follow-up:frame',
            frames: [{
                id: 'opp-follow-up:frame',
                kind: 'damage-follow-up',
                ownerGame: 'test-game',
                ownerSystem: 'timing-opportunity',
                ownerToken: 'opp-follow-up',
                ordering: 'explicit',
                status: 'running',
                phase: 'main',
                phaseGate: 'block-advance-when-blocked',
                metadata: {
                    opportunityId: 'opp-follow-up',
                    opportunityClass: 'delayed',
                    damageId: 'damage-1',
                },
            }],
        });
    });

    it('把 events 机会作为额外领域事件返回给管线继续归约', () => {
        const state = createTestState();
        const bonusEvent: GameEvent = {
            type: 'SHIELD_COUNTER_ADDED',
            payload: { playerId: 'p1', amount: 1 },
            timestamp: 2,
        };
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({
                id: 'opp-event',
                timing,
                class: 'mandatory',
                choice: undefined,
                resolution: {
                    type: 'events',
                    events: [bonusEvent],
                },
            })],
        }));
        const system = createTimingOpportunitySystem(domain);

        const result = system.afterEvents?.(createPipelineArgs(state));

        expect(result?.state).toBe(state);
        expect(result?.events).toEqual([bonusEvent]);
    });

    it('commands 机会不能被 TimingOpportunitySystem 静默执行', () => {
        const state = createTestState();
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({
                id: 'opp-command',
                timing,
                class: 'mandatory',
                choice: undefined,
                resolution: {
                    type: 'commands',
                    commands: [{
                        type: 'USE_SHIELD',
                        payload: { opportunityId: 'opp-command' },
                    }],
                },
            })],
        }));
        const system = createTimingOpportunitySystem(domain);

        expect(() => system.afterEvents?.(createPipelineArgs(state)))
            .toThrow('Opportunity opp-command 是 commands resolution');
    });

    it('events 机会能通过完整 pipeline 继续归约到 core', () => {
        const domain: DomainCore<TestCore> = {
            gameId: 'test-game',
            setup: () => ({
                hp: { p1: 10, p2: 10 },
                shieldCounters: { p1: 0, p2: 0 },
            }),
            validate: () => ({ valid: true }),
            execute: (_state, command) => [{
                type: 'DAMAGE_DEALT',
                payload: { targetId: 'p2', amount: 2 },
                timestamp: command.timestamp ?? 1,
            }],
            reduce: (core, event) => {
                if (event.type === 'DAMAGE_DEALT') {
                    const payload = event.payload as { targetId: string; amount: number };
                    return {
                        ...core,
                        hp: {
                            ...core.hp,
                            [payload.targetId]: core.hp[payload.targetId] - payload.amount,
                        },
                    };
                }
                if (event.type === 'SHIELD_COUNTER_ADDED') {
                    const payload = event.payload as { playerId: string; amount: number };
                    return {
                        ...core,
                        shieldCounters: {
                            ...core.shieldCounters,
                            [payload.playerId]: core.shieldCounters[payload.playerId] + payload.amount,
                        },
                    };
                }
                return core;
            },
            discoverTimingOpportunities: ({ timing }) => ({
                opportunities: timing.event?.type === 'DAMAGE_DEALT'
                    ? [createChoiceOpportunity({
                        id: 'opp-event',
                        timing,
                        class: 'mandatory',
                        choice: undefined,
                        resolution: {
                            type: 'events',
                            events: [{
                                type: 'SHIELD_COUNTER_ADDED',
                                payload: { playerId: 'p1', amount: 1 },
                                timestamp: 2,
                            }],
                        },
                    })]
                    : [],
            }),
        };

        const result = executePipeline(
            {
                domain,
                systems: [createTimingOpportunitySystem(domain)],
            },
            createTestState(),
            { type: 'ATTACK', playerId: 'p1', payload: {}, timestamp: 1 },
            mockRandom,
            ['p1', 'p2'],
        );

        expect(result.success).toBe(true);
        expect(result.events.map((event) => event.type)).toEqual([
            'DAMAGE_DEALT',
            'SHIELD_COUNTER_ADDED',
        ]);
        expect(result.state.core).toEqual({
            hp: { p1: 10, p2: 8 },
            shieldCounters: { p1: 1, p2: 0 },
        });
    });

    it('choice-request 机会缺少承载配置时直接报错', () => {
        const state = createTestState();
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({ timing })],
        }));
        const system = createTimingOpportunitySystem(domain);

        expect(() => system.afterEvents?.(createPipelineArgs(state)))
            .toThrow('Opportunity opp-choice 需要 ChoiceRequest adapter 配置');
    });

    it('机会合同错误时直接报错，不静默生成残缺交互', () => {
        const state = createTestState();
        const domain = createDomain(({ timing }) => ({
            opportunities: [createChoiceOpportunity({
                timing,
                choice: {
                    kind: 'confirm',
                    candidates: [{
                        id: 'broken-candidate',
                        label: '坏候选',
                    }],
                    selection: { min: 1, max: 1 },
                    resolution: { type: 'candidate-commands' },
                    ai: { status: 'shared-policy' },
                },
            })],
        }));
        const system = createTimingOpportunitySystem(domain, {
            choiceRequestOptions: () => ({ title: '不会创建' }),
        });

        expect(() => system.afterEvents?.(createPipelineArgs(state)))
            .toThrow('候选 broken-candidate 缺少最终命令');
    });
});
