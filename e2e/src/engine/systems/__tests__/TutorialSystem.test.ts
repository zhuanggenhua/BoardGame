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
        interaction: { queue: [] },
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
            events: [{ type: 'TEST_EVENT', payload: {}, timestamp: 1 } as GameEvent],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state?.sys.tutorial.stepIndex).toBe(1);
        expect(result?.state?.sys.tutorial.step?.id).toBe('step-2');
    });

    it('beforeCommand: infoStep 拦截所有非系统命令', () => {
        const manifest: TutorialManifest = {
            id: 'block',
            steps: [
                {
                    id: 'step-1',
                    content: 'info',
                    infoStep: true,
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

    it('beforeCommand: allowedCommands 白名单外的命令被拦截', () => {
        const manifest: TutorialManifest = {
            id: 'whitelist',
            steps: [
                {
                    id: 'step-1',
                    content: 'only roll',
                    requireAction: true,
                    allowedCommands: ['ROLL_DICE'],
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

        // 白名单内命令放行
        const allowed = system.beforeCommand?.({
            state: started?.state ?? state,
            command: { type: 'ROLL_DICE', playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });
        expect(allowed).toBeUndefined();

        // 白名单外命令拦截
        const blocked = system.beforeCommand?.({
            state: started?.state ?? state,
            command: { type: 'PLAY_CARD', playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });
        expect(blocked?.halt).toBe(true);
        expect(blocked?.error).toBe(TUTORIAL_ERRORS.COMMAND_BLOCKED);
    });

    describe('stepValidator', () => {
        it('advanceStep: 跳过 validator 返回 false 的步骤', () => {
            const sys = createTutorialSystem<TestCore>();
            const manifest: TutorialManifest = {
                id: 'skip',
                steps: [
                    { id: 's0', content: 'start' },
                    { id: 's1', content: 'skip me' },
                    { id: 's2', content: 'skip me too' },
                    { id: 's3', content: 'valid' },
                ],
                stepValidator: (_state, step) => step.id !== 's1' && step.id !== 's2',
            };
            const state = createTestState();
            const started = sys.beforeCommand?.({
                state,
                command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
                events: [], random: mockRandom, playerIds: ['0', '1'],
            });

            // NEXT from s0 → should skip s1, s2, land on s3
            const result = sys.beforeCommand?.({
                state: started?.state ?? state,
                command: { type: TUTORIAL_COMMANDS.NEXT, playerId: '0', payload: {} },
                events: [], random: mockRandom, playerIds: ['0', '1'],
            });

            expect(result?.state?.sys.tutorial.stepIndex).toBe(3);
            expect(result?.state?.sys.tutorial.step?.id).toBe('s3');
            // 跳过的事件应带 skipped: true
            const skippedEvents = result?.events?.filter(
                (e) => e.type === TUTORIAL_EVENTS.STEP_CHANGED
                    && (e.payload as Record<string, unknown>)?.skipped === true
            );
            expect(skippedEvents?.length).toBe(2);
        });

        it('afterEvents: 当前步骤 validator 返回 false 时自动跳过', () => {
            const sys = createTutorialSystem<TestCore>();
            const manifest: TutorialManifest = {
                id: 'mid-skip',
                steps: [
                    { id: 's0', content: 'start' },
                    { id: 's1', content: 'needs value=0', requireAction: true,
                        advanceOnEvents: [{ type: 'SPECIFIC_EVENT' }] },
                    { id: 's2', content: 'fallback' },
                ],
                stepValidator: (st, step) => {
                    if (step.id === 's1') return (st as MatchState<TestCore>).core.value === 0;
                    return true;
                },
            };
            const state = createTestState(); // core.value = 0
            const started = sys.beforeCommand?.({
                state,
                command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
                events: [], random: mockRandom, playerIds: ['0', '1'],
            });
            // NEXT → s1 (core.value=0, validator passes)
            const atS1 = sys.beforeCommand?.({
                state: started?.state ?? state,
                command: { type: TUTORIAL_COMMANDS.NEXT, playerId: '0', payload: {} },
                events: [], random: mockRandom, playerIds: ['0', '1'],
            });
            expect(atS1?.state?.sys.tutorial.step?.id).toBe('s1');

            // core.value 变为 999，s1 不再有效
            const invalidState: MatchState<TestCore> = {
                ...atS1!.state!,
                core: { value: 999 },
            };

            // 不相关事件 → afterEvents 应检测到 s1 无效 → 自动推进到 s2
            const result = sys.afterEvents?.({
                state: invalidState,
                command: { type: 'NOOP', playerId: '0', payload: {} },
                events: [{ type: 'UNRELATED', payload: {}, timestamp: 1 } as GameEvent],
                random: mockRandom, playerIds: ['0', '1'],
            });

            expect(result?.state?.sys.tutorial.step?.id).toBe('s2');
        });

        it('所有后续步骤都被跳过时关闭教程', () => {
            const sys = createTutorialSystem<TestCore>();
            const manifest: TutorialManifest = {
                id: 'all-skip',
                steps: [
                    { id: 's0', content: 'start' },
                    { id: 's1', content: 'bad' },
                    { id: 's2', content: 'bad' },
                ],
                stepValidator: (_state, step) => step.id === 's0',
            };
            const state = createTestState();
            const started = sys.beforeCommand?.({
                state,
                command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
                events: [], random: mockRandom, playerIds: ['0', '1'],
            });

            const result = sys.beforeCommand?.({
                state: started?.state ?? state,
                command: { type: TUTORIAL_COMMANDS.NEXT, playerId: '0', payload: {} },
                events: [], random: mockRandom, playerIds: ['0', '1'],
            });

            expect(result?.state?.sys.tutorial.active).toBe(false);
            expect(result?.events).toContainEqual(
                expect.objectContaining({ type: TUTORIAL_EVENTS.CLOSED })
            );
        });

        it('无 stepValidator 时不跳过任何步骤', () => {
            const sys = createTutorialSystem<TestCore>();
            const manifest: TutorialManifest = {
                id: 'no-validator',
                steps: [
                    { id: 's0', content: 'start' },
                    { id: 's1', content: 'normal' },
                ],
            };
            const state = createTestState();
            const started = sys.beforeCommand?.({
                state,
                command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
                events: [], random: mockRandom, playerIds: ['0', '1'],
            });

            const result = sys.beforeCommand?.({
                state: started?.state ?? state,
                command: { type: TUTORIAL_COMMANDS.NEXT, playerId: '0', payload: {} },
                events: [], random: mockRandom, playerIds: ['0', '1'],
            });

            expect(result?.state?.sys.tutorial.stepIndex).toBe(1);
            expect(result?.state?.sys.tutorial.step?.id).toBe('s1');
        });
    });
});
