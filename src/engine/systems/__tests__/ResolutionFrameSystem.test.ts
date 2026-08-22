import { describe, expect, it } from 'vitest';

import { createInitialSystemState, createSeededRandom, executePipeline } from '../../pipeline';
import type { Command, DomainCore, GameEvent, MatchState, ResolutionFrame } from '../../types';
import { createResolutionFrameSystem } from '../ResolutionFrameSystem';
import { getActiveResolutionFrame, getResolutionFrameById } from '../resolutionStack';

interface TestCore {
    starts: number;
    followUps: number;
}

type TestCommand = Command<'GO', Record<string, never>>;
type StartEvent = GameEvent<'START', Record<string, never>>;
type FollowUpEvent = GameEvent<'FOLLOW_UP', { amount: number }>;
type TestEvent = StartEvent | FollowUpEvent;

const random = createSeededRandom('resolution-frame-system-test');

function createDomain(): DomainCore<TestCore, TestCommand, TestEvent> {
    return {
        gameId: 'resolution-frame-system-test',
        setup: () => ({ starts: 0, followUps: 0 }),
        validate: () => ({ valid: true }),
        execute: (state, command) => ([{
            type: 'START',
            payload: {},
            timestamp: command.timestamp ?? state.core.starts + 1,
        }]),
        reduce: (core, event) => {
            if (event.type === 'START') {
                return {
                    ...core,
                    starts: core.starts + 1,
                };
            }
            return {
                ...core,
                followUps: core.followUps + event.payload.amount,
            };
        },
    };
}

function createState(frame: ResolutionFrame): MatchState<TestCore> {
    const system = createResolutionFrameSystem<TestCore>();
    return {
        core: { starts: 0, followUps: 0 },
        sys: {
            ...createInitialSystemState(['p1'], [system]),
            resolution: {
                activeFrameId: frame.id,
                frames: [frame],
            },
        },
    };
}

function createFrame(overrides: Partial<ResolutionFrame> = {}): ResolutionFrame {
    return {
        id: 'frame-1',
        kind: 'test:resolution',
        ordering: 'explicit',
        status: 'running',
        deferredEvents: [{
            type: 'FOLLOW_UP',
            payload: { amount: 2 },
            timestamp: 2,
        }],
        ...overrides,
    };
}

describe('ResolutionFrameSystem', () => {
    it('把 active frame 持有的 deferred events 回灌进管线并正式归约一次', () => {
        const system = createResolutionFrameSystem<TestCore>({
            shouldAutoCompleteFrame: ({ frame }) => frame.metadata?.autoComplete === true,
        });
        const result = executePipeline(
            { domain: createDomain(), systems: [system] },
            createState(createFrame({ metadata: { autoComplete: true } })),
            { type: 'GO', playerId: 'p1', payload: {}, timestamp: 1 },
            random,
            ['p1'],
        );

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toEqual(['START', 'FOLLOW_UP']);
        expect(result.state.core).toEqual({ starts: 1, followUps: 2 });
        expect(result.state.sys.resolution).toBeUndefined();
    });

    it('blocked frame 不会被系统抢跑 deferred events', () => {
        const system = createResolutionFrameSystem<TestCore>({
            shouldAutoCompleteFrame: () => true,
        });
        const result = executePipeline(
            { domain: createDomain(), systems: [system] },
            createState(createFrame({
                status: 'blocked',
                blockedBy: { type: 'interaction', id: 'choice-1' },
                metadata: { autoComplete: true },
            })),
            { type: 'GO', playerId: 'p1', payload: {}, timestamp: 1 },
            random,
            ['p1'],
        );

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toEqual(['START']);
        expect(result.state.core).toEqual({ starts: 1, followUps: 0 });
        expect(getActiveResolutionFrame(result.state)).toMatchObject({
            id: 'frame-1',
            status: 'blocked',
            deferredEvents: [expect.objectContaining({ type: 'FOLLOW_UP' })],
        });
    });

    it('deferredActions 没有通用执行宿主时不会被自动完成丢弃', () => {
        const system = createResolutionFrameSystem<TestCore>({
            shouldAutoCompleteFrame: () => true,
        });
        const result = executePipeline(
            { domain: createDomain(), systems: [system] },
            createState(createFrame({
                deferredActions: [{ kind: 'game-specific-follow-up' }],
                metadata: { autoComplete: true },
            })),
            { type: 'GO', playerId: 'p1', payload: {}, timestamp: 1 },
            random,
            ['p1'],
        );

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toEqual(['START', 'FOLLOW_UP']);
        expect(result.state.core).toEqual({ starts: 1, followUps: 2 });
        expect(getResolutionFrameById(result.state, 'frame-1')).toMatchObject({
            deferredEvents: undefined,
            deferredActions: [{ kind: 'game-specific-follow-up' }],
        });
    });
});
