/**
 * TutorialSystem 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
    createTutorialSystem,
    TUTORIAL_COMMANDS,
    TUTORIAL_ERRORS,
    TUTORIAL_EVENTS,
} from '../TutorialSystem';
import type { Command, GameEvent, MatchState, RandomFn, TutorialManifest } from '../../types';
import { DEFAULT_TUTORIAL_STATE } from '../../types';

type TestCore = { value: number };

const mockRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: (arr) => [...arr],
};

const createTestState = (): MatchState<TestCore> => ({
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        prompt: { queue: [] },
        log: { entries: [], maxEntries: 1000 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: { current: undefined },
        tutorial: { ...DEFAULT_TUTORIAL_STATE },
        turnNumber: 1,
        phase: 'main1',
    },
    core: { value: 0 },
});

describe('TutorialSystem', () => {
    const system = createTutorialSystem<TestCore>();

    it('START: manifest 无效时阻止并返回错误', () => {
        const state = createTestState();
        const command: Command = {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest: { id: 'bad', steps: [] } },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe(TUTORIAL_ERRORS.INVALID_MANIFEST);
    });

    it('START: 初始化步骤与事件', () => {
        const state = createTestState();
        const manifest: TutorialManifest = {
            id: 'intro',
            steps: [{ id: 'step-1', content: 'hello', requireAction: false }],
        };
        const command: Command = {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.state?.sys.tutorial.active).toBe(true);
        expect(result?.state?.sys.tutorial.step?.id).toBe('step-1');
        expect(result?.events).toContainEqual(
            expect.objectContaining({ type: TUTORIAL_EVENTS.STARTED })
        );
    });

    it('NEXT: 步骤锁定时阻止推进', () => {
        const manifest: TutorialManifest = {
            id: 'locked',
            steps: [{ id: 'step-1', content: 'locked', requireAction: true }],
        };
        const state = createTestState();
        const started = system.beforeCommand?.({
            state,
            command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        const next = system.beforeCommand?.({
            state: started?.state ?? state,
            command: { type: TUTORIAL_COMMANDS.NEXT, playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(next?.halt).toBe(true);
        expect(next?.error).toBe(TUTORIAL_ERRORS.STEP_LOCKED);
    });

    it('afterEvents: 命中 advanceOnEvents 推进步骤', () => {
        const manifest: TutorialManifest = {
            id: 'advance',
            steps: [
                {
                    id: 'step-1',
                    content: 'wait',
                    requireAction: true,
                    advanceOnEvents: [{ type: 'TEST_EVENT' }],
                },
                { id: 'step-2', content: 'next', requireAction: false },
            ],
        };
        const state = createTestState();
        const started = system.beforeCommand?.({
            state,
            command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        const result = system.afterEvents?.({
            state: started?.state ?? state,
            command: { type: 'NOOP', playerId: '0', payload: {} },
            events: [{ type: 'TEST_EVENT', payload: {}, timestamp: Date.now() } as GameEvent],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state?.sys.tutorial.stepIndex).toBe(1);
        expect(result?.state?.sys.tutorial.step?.id).toBe('step-2');
    });

    it('beforeCommand: blockedCommands 拦截普通命令', () => {
        const manifest: TutorialManifest = {
            id: 'block',
            steps: [
                {
                    id: 'step-1',
                    content: 'block',
                    requireAction: true,
                    blockedCommands: ['PLAY_CARD'],
                },
            ],
        };
        const state = createTestState();
        const started = system.beforeCommand?.({
            state,
            command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        const result = system.beforeCommand?.({
            state: started?.state ?? state,
            command: { type: 'PLAY_CARD', playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe(TUTORIAL_ERRORS.COMMAND_BLOCKED);
    });
});
