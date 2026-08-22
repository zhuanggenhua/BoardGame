import { describe, expect, it } from 'vitest';
import {
    buildResponseWindowFromOpportunity,
    buildChoiceRequestFromOpportunity,
    buildResolutionFrameFromOpportunity,
    commitEventWithTimingOpportunities,
    createTimingPoint,
    discoverTimingOpportunities,
    filterOpportunitiesForPlayer,
    getActiveOpportunities,
    sortOpportunities,
    validateOpportunity,
    type Opportunity,
} from '../TimingOpportunity';
import type { DomainCore, GameEvent, MatchState } from '../types';

interface TestCore {
    hp: Record<string, number>;
}

const createBaseOpportunity = (overrides: Partial<Opportunity> = {}): Opportunity => {
    const timing = createTimingPoint({
        gameId: 'test-game',
        position: 'after',
        factKind: 'damage',
        event: {
            type: 'DAMAGE_DEALT',
            payload: { targetId: 'p2', amount: 2 },
            timestamp: 100,
        },
        parentFrameId: 'frame-1',
    });

    return {
        id: 'opp-shield',
        timing,
        sourceRef: {
            kind: 'ability',
            id: 'shield',
            controllerId: 'p1',
        },
        controllerId: 'p1',
        class: 'prevention',
        condition: true,
        resolution: { type: 'choice-request' },
        choice: {
            kind: 'confirm',
            candidates: [{
                id: 'use-shield',
                label: '使用护盾',
                commands: [{
                    type: 'USE_SHIELD',
                    payload: { opportunityId: 'opp-shield' },
                }],
            }],
            selection: { min: 1, max: 1 },
            resolution: { type: 'candidate-commands' },
            ai: { status: 'shared-policy' },
        },
        ...overrides,
    };
};

describe('TimingOpportunity', () => {
    it('创建稳定 TimingPoint，并保留事件事实和父 frame', () => {
        const event: GameEvent<'SCORED', { baseId: string }> = {
            type: 'SCORED',
            payload: { baseId: 'base-1' },
            timestamp: 20,
        };

        const timing = createTimingPoint({
            gameId: 'smashup',
            position: 'postCommit',
            factKind: 'scoring',
            event,
            parentFrameId: 'score-frame',
        });

        expect(timing).toMatchObject({
            id: 'postCommit:scoring:SCORED:20',
            gameId: 'smashup',
            position: 'postCommit',
            factKind: 'scoring',
            event,
            parentFrameId: 'score-frame',
        });
    });

    it('按可见性过滤机会，并只返回条件成立的活跃机会', () => {
        const publicOpportunity = createBaseOpportunity({
            id: 'opp-public',
            visibility: { scope: 'public' },
            metadata: { priority: 1 },
        });
        const privateOpportunity = createBaseOpportunity({
            id: 'opp-private',
            visibility: { scope: 'private', playerIds: ['p2'] },
            controllerId: 'p2',
            metadata: { priority: 10 },
        });
        const inactiveOpportunity = createBaseOpportunity({
            id: 'opp-inactive',
            condition: { satisfied: false, reason: '没有护盾' },
        });

        const visibleToP1 = filterOpportunitiesForPlayer(
            [privateOpportunity, publicOpportunity, inactiveOpportunity],
            'p1',
        );
        const activeForP1 = getActiveOpportunities(visibleToP1);

        expect(visibleToP1.map((opportunity) => opportunity.id)).toEqual(['opp-public', 'opp-inactive']);
        expect(activeForP1.map((opportunity) => opportunity.id)).toEqual(['opp-public']);
        expect(sortOpportunities([publicOpportunity, privateOpportunity]).map((opportunity) => opportunity.id))
            .toEqual(['opp-private', 'opp-public']);
    });

    it('把需要输入的 Opportunity 投影为 ChoiceRequest', () => {
        const opportunity = createBaseOpportunity({
            metadata: { priority: 5 },
            choice: {
                kind: 'confirm',
                candidates: [{
                    id: 'use-shield',
                    label: '使用护盾',
                    commands: [{
                        type: 'USE_SHIELD',
                        payload: { opportunityId: 'opp-shield' },
                    }],
                }],
                selection: { min: 1, max: 1 },
                skipPolicy: 'optional',
                recoveryAction: {
                    id: 'skip',
                    label: '不使用',
                    commands: [{
                        type: 'SKIP_SHIELD',
                        payload: { opportunityId: 'opp-shield' },
                    }],
                },
                resolution: { type: 'candidate-commands' },
                ai: { status: 'shared-policy' },
                metadata: { uiSurface: 'card' },
            },
        });

        const choiceRequest = buildChoiceRequestFromOpportunity(opportunity);

        expect(choiceRequest).toMatchObject({
            requestId: 'opp-shield',
            gameId: 'test-game',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'confirm',
            sourceId: 'shield',
            metadata: {
                opportunityId: 'opp-shield',
                timingPointId: opportunity.timing.id,
                opportunityClass: 'prevention',
                priority: 5,
                uiSurface: 'card',
            },
        });
        expect(validateOpportunity(opportunity).filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    });

    it('拒绝声明 choice-request 但没有 choice 合同的机会', () => {
        const opportunity = createBaseOpportunity({
            choice: undefined,
            resolution: { type: 'choice-request' },
        });

        expect(validateOpportunity(opportunity)).toContainEqual(expect.objectContaining({
            severity: 'error',
            code: 'choice-resolution-without-choice',
        }));
    });

    it('把响应类 Opportunity 投影为 ResponseWindowSystem 可承载的窗口', () => {
        const opportunity = createBaseOpportunity({
            id: 'opp-counterspell',
            class: 'response',
            choice: undefined,
            resolution: {
                type: 'response-window',
                windowType: 'after-card-played',
                responderQueue: ['p2', 'p1'],
                requiredInteractionId: 'choose-response-card',
            },
        });

        expect(buildResponseWindowFromOpportunity(opportunity)).toEqual({
            id: 'opp-counterspell',
            windowType: 'after-card-played',
            sourceId: 'shield',
            responderQueue: ['p2', 'p1'],
            currentResponderIndex: 0,
            passedPlayers: [],
            resolutionFrameId: 'frame-1',
            requiredInteractionId: 'choose-response-card',
        });
        expect(validateOpportunity(opportunity).filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    });

    it('拒绝空响应者队列的 response-window Opportunity', () => {
        const opportunity = createBaseOpportunity({
            id: 'opp-empty-response',
            class: 'response',
            choice: undefined,
            resolution: {
                type: 'response-window',
                windowType: 'after-card-played',
                responderQueue: [],
            },
        });

        expect(buildResponseWindowFromOpportunity(opportunity)).toBeUndefined();
        expect(validateOpportunity(opportunity)).toContainEqual(expect.objectContaining({
            severity: 'error',
            code: 'response-window-without-responders',
        }));
    });

    it('把长事务 Opportunity 投影为 ResolutionFrame', () => {
        const opportunity = createBaseOpportunity({
            id: 'opp-cleanup-chain',
            class: 'delayed',
            choice: undefined,
            ordering: 'queue',
            resolution: {
                type: 'child-frame',
                frameKind: 'cleanup-follow-up',
                phase: 'cleanup',
                phaseGate: 'block-advance-when-blocked',
                metadata: { cleanupId: 'cleanup-1' },
            },
        });

        expect(buildResolutionFrameFromOpportunity(opportunity)).toMatchObject({
            id: 'opp-cleanup-chain:frame',
            kind: 'cleanup-follow-up',
            ownerGame: 'test-game',
            ownerSystem: 'timing-opportunity',
            ownerToken: 'opp-cleanup-chain',
            parentFrameId: 'frame-1',
            ordering: 'queue',
            status: 'running',
            phase: 'cleanup',
            phaseGate: 'block-advance-when-blocked',
            metadata: {
                opportunityId: 'opp-cleanup-chain',
                timingPointId: opportunity.timing.id,
                opportunityClass: 'delayed',
                cleanupId: 'cleanup-1',
            },
        });
    });

    it('允许 DomainCore 声明时点机会发现入口，并由 runner 统一过滤排序', () => {
        const domain: DomainCore<TestCore> = {
            gameId: 'test-game',
            setup: () => ({ hp: { p1: 10, p2: 10 } }),
            validate: () => ({ valid: true }),
            execute: () => [],
            reduce: (state) => state,
            discoverTimingOpportunities: ({ timing }) => ({
                opportunities: [
                    createBaseOpportunity({
                        id: 'opp-public',
                        timing,
                        visibility: { scope: 'public' },
                        metadata: { priority: 1 },
                    }),
                    createBaseOpportunity({
                        id: 'opp-private',
                        timing,
                        controllerId: 'p2',
                        visibility: { scope: 'private', playerIds: ['p2'] },
                        metadata: { priority: 10 },
                    }),
                ],
            }),
        };
        const state = {
            core: { hp: { p1: 10, p2: 8 } },
            sys: {} as MatchState<TestCore>['sys'],
        };
        const timing = createTimingPoint({
            gameId: 'test-game',
            position: 'after',
            factKind: 'damage',
            timestamp: 1,
        });

        const result = discoverTimingOpportunities<TestCore>(domain, { state, timing }, {
            playerId: 'p1',
            activeOnly: true,
            sorted: true,
        });

        expect(result.opportunities.map((opportunity) => opportunity.id)).toEqual(['opp-public']);
        expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    });

    it('旧游戏未实现发现入口时，runner 返回空机会和空诊断', () => {
        const domain: DomainCore<TestCore> = {
            gameId: 'legacy-game',
            setup: () => ({ hp: { p1: 10, p2: 10 } }),
            validate: () => ({ valid: true }),
            execute: () => [],
            reduce: (state) => state,
        };
        const state = {
            core: { hp: { p1: 10, p2: 8 } },
            sys: {} as MatchState<TestCore>['sys'],
        };
        const timing = createTimingPoint({
            gameId: 'legacy-game',
            position: 'after',
            factKind: 'damage',
            timestamp: 1,
        });

        expect(discoverTimingOpportunities(domain, { state, timing })).toEqual({
            opportunities: [],
            diagnostics: [],
        });
    });

    it('EventCommit helper 只执行 replacement/prevention 的安全事件提交计划', () => {
        const event: GameEvent<'DAMAGE_DEALT', { targetId: string; amount: number }> = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: 'p2', amount: 5 },
            timestamp: 10,
        };
        const domain: DomainCore<TestCore> = {
            gameId: 'test-game',
            setup: () => ({ hp: { p1: 10, p2: 10 } }),
            validate: () => ({ valid: true }),
            execute: () => [],
            reduce: (state) => state,
            discoverTimingOpportunities: ({ timing }) => ({
                opportunities: timing.position === 'prevent'
                    ? [createBaseOpportunity({
                        id: 'opp-prevent-damage',
                        timing,
                        choice: undefined,
                        resolution: {
                            type: 'events',
                            events: [{
                                ...event,
                                payload: { targetId: 'p2', amount: 2 },
                            }],
                        },
                    })]
                    : [],
            }),
        };
        const state = {
            core: { hp: { p1: 10, p2: 10 } },
            sys: {} as MatchState<TestCore>['sys'],
        };
        const timing = createTimingPoint({
            gameId: 'test-game',
            position: 'eventCommit',
            factKind: 'DAMAGE_DEALT',
            event,
            timestamp: event.timestamp,
        });

        const result = commitEventWithTimingOpportunities(domain, {
            state,
            event,
            timing,
        });

        expect(result.events).toEqual([
            expect.objectContaining({ payload: { targetId: 'p2', amount: 2 } }),
        ]);
        expect(result.opportunities.map((opportunity) => opportunity.id)).toEqual(['opp-prevent-damage']);
        expect(result.appliedOpportunityIds).toEqual(['opp-prevent-damage']);
        expect(result.evidence).toMatchObject({
            timingPointId: timing.id,
            position: 'eventCommit',
            factKind: 'DAMAGE_DEALT',
            originalEventType: 'DAMAGE_DEALT',
            originalEventTimestamp: 10,
            opportunityIds: ['opp-prevent-damage'],
            opportunityTimingPointIds: ['prevent:DAMAGE_DEALT:DAMAGE_DEALT:10'],
            appliedOpportunityIds: ['opp-prevent-damage'],
        });
    });

    it('EventCommit helper 允许游戏用显式 composer 合成多个 events 机会', () => {
        const event: GameEvent<'DAMAGE_DEALT', { targetId: string; amount: number }> = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: 'p2', amount: 5 },
            timestamp: 10,
        };
        const domain: DomainCore<TestCore> = {
            gameId: 'test-game',
            setup: () => ({ hp: { p1: 10, p2: 10 } }),
            validate: () => ({ valid: true }),
            execute: () => [],
            reduce: (state) => state,
            discoverTimingOpportunities: ({ timing }) => ({
                opportunities: timing.position === 'prevent'
                    ? [
                        createBaseOpportunity({
                            id: 'opp-prevent-flat',
                            timing,
                            choice: undefined,
                            metadata: { priority: 20 },
                            resolution: {
                                type: 'events',
                                events: [{
                                    ...event,
                                    payload: { targetId: 'p2', amount: 3 },
                                }],
                            },
                        }),
                        createBaseOpportunity({
                            id: 'opp-prevent-percent',
                            timing,
                            choice: undefined,
                            metadata: { priority: 10 },
                            resolution: {
                                type: 'events',
                                events: [{
                                    ...event,
                                    payload: { targetId: 'p2', amount: 2 },
                                }],
                            },
                        }),
                    ]
                    : [],
            }),
        };
        const state = {
            core: { hp: { p1: 10, p2: 10 } },
            sys: {} as MatchState<TestCore>['sys'],
        };
        const timing = createTimingPoint({
            gameId: 'test-game',
            position: 'eventCommit',
            factKind: 'DAMAGE_DEALT',
            event,
            timestamp: event.timestamp,
        });

        const result = commitEventWithTimingOpportunities(domain, {
            state,
            event,
            timing,
        }, {
            composeEventCommitPlan: ({ opportunities }) => ({
                events: [{
                    ...event,
                    payload: {
                        targetId: 'p2',
                        amount: opportunities.length,
                    },
                }],
                appliedOpportunityIds: opportunities.map(opportunity => opportunity.id),
            }),
        });

        expect(result.events).toEqual([
            expect.objectContaining({ payload: { targetId: 'p2', amount: 2 } }),
        ]);
        expect(result.appliedOpportunityIds).toEqual(['opp-prevent-flat', 'opp-prevent-percent']);
        expect(result.evidence).toMatchObject({
            timingPointId: timing.id,
            opportunityIds: ['opp-prevent-flat', 'opp-prevent-percent'],
            appliedOpportunityIds: ['opp-prevent-flat', 'opp-prevent-percent'],
        });
    });

    it('EventCommit helper 默认拒绝多个 events 机会，防止通用层猜顺序', () => {
        const event: GameEvent<'DAMAGE_DEALT', { targetId: string; amount: number }> = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: 'p2', amount: 5 },
            timestamp: 10,
        };
        const domain: DomainCore<TestCore> = {
            gameId: 'test-game',
            setup: () => ({ hp: { p1: 10, p2: 10 } }),
            validate: () => ({ valid: true }),
            execute: () => [],
            reduce: (state) => state,
            discoverTimingOpportunities: ({ timing }) => ({
                opportunities: timing.position === 'prevent'
                    ? [
                        createBaseOpportunity({
                            id: 'opp-prevent-a',
                            timing,
                            choice: undefined,
                            resolution: { type: 'events', events: [event] },
                        }),
                        createBaseOpportunity({
                            id: 'opp-prevent-b',
                            timing,
                            choice: undefined,
                            resolution: { type: 'events', events: [event] },
                        }),
                    ]
                    : [],
            }),
        };
        const state = {
            core: { hp: { p1: 10, p2: 10 } },
            sys: {} as MatchState<TestCore>['sys'],
        };
        const timing = createTimingPoint({
            gameId: 'test-game',
            position: 'eventCommit',
            factKind: 'DAMAGE_DEALT',
            event,
            timestamp: event.timestamp,
        });

        expect(() => commitEventWithTimingOpportunities(domain, {
            state,
            event,
            timing,
        })).toThrow('请由游戏层显式合成提交计划');
    });

    it('EventCommit helper 拒绝会阻塞事件提交的 resolution', () => {
        const event: GameEvent<'DAMAGE_DEALT', { targetId: string; amount: number }> = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: 'p2', amount: 5 },
            timestamp: 10,
        };
        const domain: DomainCore<TestCore> = {
            gameId: 'test-game',
            setup: () => ({ hp: { p1: 10, p2: 10 } }),
            validate: () => ({ valid: true }),
            execute: () => [],
            reduce: (state) => state,
            discoverTimingOpportunities: ({ timing }) => ({
                opportunities: timing.position === 'prevent'
                    ? [createBaseOpportunity({
                        id: 'opp-prevent-choice',
                        timing,
                        class: 'prevention',
                        resolution: { type: 'choice-request' },
                    })]
                    : [],
            }),
        };
        const state = {
            core: { hp: { p1: 10, p2: 10 } },
            sys: {} as MatchState<TestCore>['sys'],
        };
        const timing = createTimingPoint({
            gameId: 'test-game',
            position: 'eventCommit',
            factKind: 'DAMAGE_DEALT',
            event,
            timestamp: event.timestamp,
        });

        expect(() => commitEventWithTimingOpportunities(domain, {
            state,
            event,
            timing,
        })).toThrow('EventCommit 不能执行 Opportunity opp-prevent-choice');
    });
});
