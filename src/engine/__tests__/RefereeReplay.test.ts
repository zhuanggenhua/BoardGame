import { describe, expect, it } from 'vitest';

import {
    buildRefereeReplayDigestFromPipelineResult,
    buildRefereeReplayDigestFromState,
    isRefereeReplayDigestEmpty,
} from '../RefereeReplay';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../pipeline';
import { createRefereeTraceSystem } from '../systems/RefereeTraceSystem';
import type { Command, DomainCore, EventCommitEvidence, GameEvent, MatchState, SystemState } from '../types';

interface TestCore {
    hp: Record<string, number>;
}

type TestCommand = Command<'ATTACK', { targetId: string; amount: number }>;
type DamageEvent = GameEvent<'DAMAGE_DEALT', { targetId: string; amount: number }>;
type ShieldEvent = GameEvent<'SHIELD_USED', { targetId: string; amount: number }>;
type TestEvent = DamageEvent | ShieldEvent;

const random = createSeededRandom('referee-replay-test');

function createDamageEvent(amount = 5): DamageEvent {
    return {
        type: 'DAMAGE_DEALT',
        payload: { targetId: 'p2', amount },
        timestamp: 10,
    };
}

function createEvidence(id = 'damage'): EventCommitEvidence {
    return {
        timingPointId: `commit-${id}`,
        position: 'eventCommit',
        factKind: 'DAMAGE_DEALT',
        originalEventType: 'DAMAGE_DEALT',
        originalEventTimestamp: 10,
        commandType: 'ATTACK',
        parentFrameId: 'frame-1',
        opportunityIds: [`opp-${id}`],
        opportunityTimingPointIds: [`prevent-${id}`],
        appliedOpportunityIds: [`opp-${id}`],
    };
}

function createState(sys: Partial<SystemState> = {}): MatchState<TestCore> {
    return {
        core: { hp: { p1: 10, p2: 10 } },
        sys: {
            ...createInitialSystemState(['p1', 'p2'], []),
            ...sys,
        },
    };
}

function createDomain(): DomainCore<TestCore, TestCommand, TestEvent> {
    return {
        gameId: 'referee-replay-test',
        setup: () => ({ hp: { p1: 10, p2: 10 } }),
        validate: () => ({ valid: true }),
        execute: (_state, command) => [createDamageEvent(command.payload.amount)],
        reduce: (core, event) => {
            if (event.type !== 'DAMAGE_DEALT') return core;
            return {
                ...core,
                hp: {
                    ...core.hp,
                    [event.payload.targetId]: core.hp[event.payload.targetId] - event.payload.amount,
                },
            };
        },
        discoverTimingOpportunities: ({ timing }) => ({
            opportunities: timing.position === 'prevent' && timing.factKind === 'DAMAGE_DEALT'
                ? [{
                    id: 'opp-shield',
                    timing,
                    sourceRef: { kind: 'ability', id: 'shield', controllerId: 'p2' },
                    controllerId: 'p2',
                    class: 'prevention',
                    condition: true,
                    resolution: {
                        type: 'events',
                        events: [
                            {
                                type: 'DAMAGE_DEALT',
                                payload: { targetId: 'p2', amount: 2 },
                                timestamp: timing.timestamp ?? 10,
                            },
                        ],
                    },
                }]
                : [],
        }),
    };
}

describe('RefereeReplay', () => {
    it('从 pipeline result 和 RefereeTrace 生成可查询裁判回放摘要', () => {
        const command: TestCommand = {
            type: 'ATTACK',
            playerId: 'p1',
            payload: { targetId: 'p2', amount: 5 },
            timestamp: 10,
        };
        const result = executePipeline(
            { domain: createDomain(), systems: [createRefereeTraceSystem()] },
            createState({
                resolution: {
                    activeFrameId: 'frame-1',
                    frames: [{
                        id: 'frame-1',
                        kind: 'damage-resolution',
                        ordering: 'explicit',
                        status: 'running',
                    }],
                },
            }),
            command,
            random,
            ['p1', 'p2'],
        );

        const digest = buildRefereeReplayDigestFromPipelineResult(result, {
            command,
            playerId: 'p2',
        });

        expect(result.success).toBe(true);
        expect(digest).toMatchObject({
            kind: 'referee-replay-digest',
            commandType: 'ATTACK',
            eventTypes: ['DAMAGE_DEALT'],
            events: [{ index: 0, type: 'DAMAGE_DEALT', timestamp: 10 }],
            eventCommitEvidence: [{
                originalEventType: 'DAMAGE_DEALT',
                opportunityIds: ['opp-shield'],
                appliedOpportunityIds: ['opp-shield'],
            }],
            traceEntries: [{
                traceEntryId: 1,
                originalEventType: 'DAMAGE_DEALT',
                opportunityIds: ['opp-shield'],
                appliedOpportunityIds: ['opp-shield'],
            }],
        });
        expect(isRefereeReplayDigestEmpty(digest)).toBe(false);
    });

    it('玩家视角不泄漏其它玩家私有 interaction 候选', () => {
        const state = createState({
            interaction: {
                current: {
                    id: 'secret-choice',
                    kind: 'simple-choice',
                    playerId: 'p2',
                    data: {
                        sourceId: 'secret-card',
                        options: [{
                            id: 'secret-target',
                            label: 'Secret',
                            value: { hiddenCardId: 'hidden-card' },
                        }],
                    },
                },
                queue: [],
            },
            refereeTrace: {
                entries: [{ id: 1, evidence: createEvidence('secret') }],
                maxEntries: 10,
                nextId: 2,
            },
        });

        const digest = buildRefereeReplayDigestFromState(state, { playerId: 'p1' });

        expect(digest.decision?.interaction).toEqual({
            visible: false,
            blockedByPlayerId: 'p2',
        });
        expect(digest.traceEntries).toHaveLength(1);
        expect(JSON.stringify(digest)).not.toContain('secret-target');
        expect(JSON.stringify(digest)).not.toContain('hidden-card');
    });

    it('空闲且没有裁判证据时可判定为空摘要', () => {
        const digest = buildRefereeReplayDigestFromState(createState());

        expect(digest.decision?.messageTypes).toEqual(['referee:idle']);
        expect(isRefereeReplayDigestEmpty(digest)).toBe(true);
    });
});
