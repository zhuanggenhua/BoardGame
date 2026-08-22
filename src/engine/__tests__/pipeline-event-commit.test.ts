import { describe, expect, it } from 'vitest';

import { createInitialSystemState, createSeededRandom, executePipeline } from '../pipeline';
import { createRefereeTraceSystem, getRefereeTraceEntries } from '../systems/RefereeTraceSystem';
import type { EngineSystem } from '../systems/types';
import type { Command, DomainCore, EventCommitArgs, GameEvent, MatchState } from '../types';

interface TestCore {
    hp: Record<string, number>;
    shields: Record<string, number>;
    shieldLog: number;
}

type TestCommand = Command<'ATTACK' | 'PING', { targetId?: string; amount?: number }>;
type DamageEvent = GameEvent<'DAMAGE_DEALT', { targetId: string; amount: number }>;
type ShieldUsedEvent = GameEvent<'SHIELD_USED', { targetId: string; amount: number }>;
type TriggerEvent = GameEvent<'TRIGGER', Record<string, never>>;
type TestEvent = DamageEvent | ShieldUsedEvent | TriggerEvent;

const random = createSeededRandom('event-commit-test');

function createState(sys?: Partial<MatchState<TestCore>['sys']>): MatchState<TestCore> {
    return {
        core: {
            hp: { p1: 10, p2: 10 },
            shields: { p1: 0, p2: 3 },
            shieldLog: 0,
        },
        sys: {
            ...createInitialSystemState(['p1', 'p2'], []),
            ...sys,
        },
    };
}

function createDamageEvent(targetId = 'p2', amount = 5, timestamp = 1): DamageEvent {
    return {
        type: 'DAMAGE_DEALT',
        payload: { targetId, amount },
        timestamp,
    };
}

function createDomain(
    overrides: Partial<DomainCore<TestCore, TestCommand, TestEvent>> = {},
): DomainCore<TestCore, TestCommand, TestEvent> {
    return {
        gameId: 'event-commit-test',
        setup: () => ({
            hp: { p1: 10, p2: 10 },
            shields: { p1: 0, p2: 3 },
            shieldLog: 0,
        }),
        validate: () => ({ valid: true }),
        execute: (_state, command) => {
            if (command.type === 'PING') {
                return [{
                    type: 'TRIGGER',
                    payload: {},
                    timestamp: command.timestamp ?? 1,
                }];
            }
            return [createDamageEvent(
                command.payload.targetId ?? 'p2',
                command.payload.amount ?? 5,
                command.timestamp ?? 1,
            )];
        },
        reduce: (core, event) => {
            if (event.type === 'DAMAGE_DEALT') {
                return {
                    ...core,
                    hp: {
                        ...core.hp,
                        [event.payload.targetId]: core.hp[event.payload.targetId] - event.payload.amount,
                    },
                };
            }
            if (event.type === 'SHIELD_USED') {
                return {
                    ...core,
                    shields: {
                        ...core.shields,
                        [event.payload.targetId]: core.shields[event.payload.targetId] - event.payload.amount,
                    },
                    shieldLog: core.shieldLog + event.payload.amount,
                };
            }
            return core;
        },
        ...overrides,
    };
}

describe('pipeline EventCommit', () => {
    it('在事件正式归约前改写事件，并保留 frame 归属时点', () => {
        const seenCommits: EventCommitArgs<TestCore, TestCommand, TestEvent>[] = [];
        const domain = createDomain({
            commitEvent: (args) => {
                seenCommits.push(args);
                if (args.event.type !== 'DAMAGE_DEALT') return args.event;

                const shield = args.state.core.shields[args.event.payload.targetId] ?? 0;
                const absorbed = Math.min(shield, args.event.payload.amount);
                return [
                    {
                        ...args.event,
                        payload: {
                            ...args.event.payload,
                            amount: args.event.payload.amount - absorbed,
                        },
                    },
                    {
                        type: 'SHIELD_USED',
                        payload: {
                            targetId: args.event.payload.targetId,
                            amount: absorbed,
                        },
                        timestamp: args.event.timestamp,
                    },
                ];
            },
        });
        const state = createState({
            resolution: {
                activeFrameId: 'frame-1',
                frames: [],
            },
        });

        const result = executePipeline(
            { domain, systems: [] },
            state,
            { type: 'ATTACK', playerId: 'p1', payload: { targetId: 'p2', amount: 5 }, timestamp: 10 },
            random,
            ['p1', 'p2'],
        );

        expect(result.success).toBe(true);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'DAMAGE_DEALT', payload: { targetId: 'p2', amount: 2 } }),
            expect.objectContaining({ type: 'SHIELD_USED', payload: { targetId: 'p2', amount: 3 } }),
        ]);
        expect(result.state.core).toEqual({
            hp: { p1: 10, p2: 8 },
            shields: { p1: 0, p2: 0 },
            shieldLog: 3,
        });
        expect(seenCommits[0]).toMatchObject({
            command: { type: 'ATTACK' },
            timing: {
                gameId: 'event-commit-test',
                position: 'eventCommit',
                factKind: 'DAMAGE_DEALT',
                parentFrameId: 'frame-1',
            },
        });
    });

    it('允许 EventCommit 取消尚未落地的事件', () => {
        const domain = createDomain({
            commitEvent: ({ event }) => (
                event.type === 'DAMAGE_DEALT'
                    ? null
                    : event
            ),
        });

        const result = executePipeline(
            { domain, systems: [createRefereeTraceSystem()] },
            createState(),
            { type: 'ATTACK', playerId: 'p1', payload: { targetId: 'p2', amount: 5 }, timestamp: 10 },
            random,
            ['p1', 'p2'],
        );

        expect(result.success).toBe(true);
        expect(result.events).toEqual([]);
        expect(result.state.core.hp.p2).toBe(10);
    });

    it('没有自定义 commitEvent 时，可用 prevention opportunity 的 events resolution 提交改写', () => {
        const domain = createDomain({
            discoverTimingOpportunities: ({ timing }) => ({
                opportunities: timing.position === 'prevent' && timing.factKind === 'DAMAGE_DEALT'
                    ? [{
                        id: 'opp-prevent-damage',
                        timing,
                        sourceRef: { kind: 'ability', id: 'shield', controllerId: 'p2' },
                        controllerId: 'p2',
                        class: 'prevention',
                        condition: true,
                        resolution: {
                            type: 'events',
                            events: [
                                createDamageEvent('p2', 2, timing.timestamp ?? 1),
                                {
                                    type: 'SHIELD_USED',
                                    payload: { targetId: 'p2', amount: 3 },
                                    timestamp: timing.timestamp ?? 1,
                                },
                            ],
                        },
                    }]
                    : [],
            }),
        });

        const result = executePipeline(
            { domain, systems: [createRefereeTraceSystem()] },
            createState(),
            { type: 'ATTACK', playerId: 'p1', payload: { targetId: 'p2', amount: 5 }, timestamp: 10 },
            random,
            ['p1', 'p2'],
        );

        expect(result.success).toBe(true);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'DAMAGE_DEALT', payload: { targetId: 'p2', amount: 2 } }),
            expect.objectContaining({ type: 'SHIELD_USED', payload: { targetId: 'p2', amount: 3 } }),
        ]);
        expect(result.state.core).toEqual({
            hp: { p1: 10, p2: 8 },
            shields: { p1: 0, p2: 0 },
            shieldLog: 3,
        });
        expect(result.eventCommitEvidence).toEqual([
            expect.objectContaining({
                position: 'eventCommit',
                factKind: 'DAMAGE_DEALT',
                originalEventType: 'DAMAGE_DEALT',
                originalEventTimestamp: 10,
                commandType: 'ATTACK',
                opportunityIds: ['opp-prevent-damage'],
                opportunityTimingPointIds: ['prevent:DAMAGE_DEALT:DAMAGE_DEALT:10'],
                appliedOpportunityIds: ['opp-prevent-damage'],
            }),
        ]);
        expect(getRefereeTraceEntries(result.state)).toEqual([
            expect.objectContaining({
                id: 1,
                evidence: expect.objectContaining({
                    originalEventType: 'DAMAGE_DEALT',
                    opportunityIds: ['opp-prevent-damage'],
                    appliedOpportunityIds: ['opp-prevent-damage'],
                }),
            }),
        ]);
    });

    it('系统派生事件也经过 EventCommit，旧 interceptEvent 继续作为兼容层执行', () => {
        const producer: EngineSystem<TestCore> = {
            id: 'producer',
            name: 'producer',
            afterEvents: ({ events }) => (
                events.some(event => event.type === 'TRIGGER')
                    ? { events: [createDamageEvent('p2', 5, 2)] }
                    : undefined
            ),
        };
        const domain = createDomain({
            commitEvent: ({ event }) => {
                if (event.type !== 'DAMAGE_DEALT') return event;
                return {
                    ...event,
                    payload: {
                        ...event.payload,
                        amount: event.payload.amount - 1,
                    },
                };
            },
            interceptEvent: (_core, event) => {
                if (event.type !== 'DAMAGE_DEALT') return event;
                return {
                    ...event,
                    payload: {
                        ...event.payload,
                        amount: event.payload.amount - 1,
                    },
                };
            },
        });

        const result = executePipeline(
            { domain, systems: [producer] },
            createState(),
            { type: 'PING', playerId: 'p1', payload: {}, timestamp: 1 },
            random,
            ['p1', 'p2'],
        );

        expect(result.success).toBe(true);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'TRIGGER' }),
            expect.objectContaining({ type: 'DAMAGE_DEALT', payload: { targetId: 'p2', amount: 3 } }),
        ]);
        expect(result.state.core.hp.p2).toBe(7);
    });
});
