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

    it('NEXT: 自动动作未消费前阻止手动推进', () => {
        const manifest: TutorialManifest = {
            id: 'pending-ai',
            allowManualSkip: true,
            steps: [
                {
                    id: 'watch-ai',
                    content: 'wait for ai',
                    infoStep: true,
                    aiActions: [{ commandType: 'AI_MOVE', playerId: '1' }],
                    autoAdvanceAfterAi: false,
                },
                { id: 'after-ai', content: 'after ai' },
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

        const next = system.beforeCommand?.({
            state: started?.state ?? state,
            command: { type: TUTORIAL_COMMANDS.NEXT, playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(next?.halt).toBe(true);
        expect(next?.error).toBe(TUTORIAL_ERRORS.STEP_LOCKED);
        expect(next?.state?.sys.tutorial.step?.id ?? started?.state?.sys.tutorial.step?.id).toBe('watch-ai');
    });

    it('PREVIOUS: 自动动作未消费前阻止手动回退', () => {
        const manifest: TutorialManifest = {
            id: 'pending-ai-previous',
            allowManualSkip: true,
            steps: [
                { id: 'intro', content: 'intro' },
                {
                    id: 'watch-ai',
                    content: 'wait for ai',
                    infoStep: true,
                    aiActions: [{ commandType: 'AI_MOVE', playerId: '1' }],
                    autoAdvanceAfterAi: false,
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
        const atAiStep = system.beforeCommand?.({
            state: started?.state ?? state,
            command: { type: TUTORIAL_COMMANDS.NEXT, playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        const previous = system.beforeCommand?.({
            state: atAiStep?.state ?? state,
            command: { type: TUTORIAL_COMMANDS.PREVIOUS, playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(previous?.halt).toBe(true);
        expect(previous?.error).toBe(TUTORIAL_ERRORS.STEP_LOCKED);
        expect(previous?.state?.sys.tutorial.step?.id ?? atAiStep?.state?.sys.tutorial.step?.id).toBe('watch-ai');
    });

    it('PREVIOUS: 不受手动跳过限制，直接回到上一个玩家可见步骤', () => {
        const sys = createTutorialSystem<TestCore>();
        const manifest: TutorialManifest = {
            id: 'previous',
            steps: [
                { id: 'intro', content: 'intro' },
                {
                    id: 'ai-bridge',
                    content: 'ai bridge',
                    aiActions: [{ commandType: 'AI_MOVE', playerId: '1' }],
                },
                { id: 'locked-action', content: 'locked action', requireAction: true },
            ],
        };
        const state = createTestState();
        const started = sys.beforeCommand?.({
            state,
            command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });
        const atLockedAction: MatchState<TestCore> = {
            ...started!.state!,
            sys: {
                ...started!.state!.sys,
                undo: {
                    ...started!.state!.sys.undo,
                    snapshots: [{ before: 'tutorial-step-back' }],
                },
                tutorial: {
                    ...started!.state!.sys.tutorial,
                    stepIndex: 2,
                    step: manifest.steps[2],
                    allowManualSkip: false,
                },
            },
        };

        const previous = sys.beforeCommand?.({
            state: atLockedAction,
            command: { type: TUTORIAL_COMMANDS.PREVIOUS, playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(previous?.halt).toBe(true);
        expect(previous?.error).toBeUndefined();
        expect(previous?.state?.sys.tutorial.stepIndex).toBe(0);
        expect(previous?.state?.sys.tutorial.step?.id).toBe('intro');
        expect(previous?.state?.sys.undo.snapshots).toEqual([{ before: 'tutorial-step-back' }]);
        expect(previous?.events).toContainEqual(
            expect.objectContaining({
                type: TUTORIAL_EVENTS.STEP_CHANGED,
                payload: expect.objectContaining({ from: 2, to: 0, stepId: 'intro' }),
            }),
        );
    });

    it('PREVIOUS: 第一张教程卡没有上一步时保持当前步骤且不报错', () => {
        const sys = createTutorialSystem<TestCore>();
        const manifest: TutorialManifest = {
            id: 'previous-at-start',
            steps: [{ id: 'intro', content: 'intro' }],
        };
        const state = createTestState();
        const started = sys.beforeCommand?.({
            state,
            command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        const previous = sys.beforeCommand?.({
            state: started!.state!,
            command: { type: TUTORIAL_COMMANDS.PREVIOUS, playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(previous?.halt).toBe(true);
        expect(previous?.error).toBeUndefined();
        expect(previous?.state?.sys.tutorial.stepIndex).toBe(0);
        expect(previous?.state?.sys.tutorial.step?.id).toBe('intro');
        expect(previous?.events).toBeUndefined();
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

    it('afterEvents: 旧持久化状态缺少 tutorial 时视为教程未开启', () => {
        const state = createTestState();
        const legacyState = {
            ...state,
            sys: {
                ...state.sys,
                tutorial: undefined,
            },
        } as unknown as MatchState<TestCore>;

        const result = system.afterEvents?.({
            state: legacyState,
            command: { type: 'NOOP', playerId: '0', payload: {} },
            events: [{ type: 'TEST_EVENT', payload: {}, timestamp: 1 } as GameEvent],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result).toBeUndefined();
    });

    it('afterEvents: 传输裁剪 steps 后仍使用已启动 manifest 推进下一步', () => {
        const sys = createTutorialSystem<TestCore>();
        const manifest: TutorialManifest = {
            id: 'transport-stripped',
            steps: [
                {
                    id: 'roll-review',
                    content: 'ack roll',
                    requireAction: true,
                    advanceOnEvents: [{ type: 'ROLL_ACKNOWLEDGED' }],
                },
                {
                    id: 'move-target',
                    content: 'choose target',
                    requireAction: true,
                    advanceOnEvents: [{ type: 'MOVED' }],
                },
            ],
        };
        const state = createTestState();
        const started = sys.beforeCommand?.({
            state,
            command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
            events: [], random: mockRandom, playerIds: ['0', '1'],
        });
        const startedTutorial = started?.state?.sys.tutorial;
        expect(startedTutorial?.step?.id).toBe('roll-review');

        const strippedState: MatchState<TestCore> = {
            ...(started?.state ?? state),
            sys: {
                ...(started?.state ?? state).sys,
                tutorial: {
                    ...startedTutorial!,
                    steps: [],
                    totalSteps: manifest.steps.length,
                } as MatchState<TestCore>['sys']['tutorial'] & { totalSteps: number },
            },
        };

        const result = sys.afterEvents?.({
            state: strippedState,
            command: { type: 'ACK_ROLL', playerId: '0', payload: {} },
            events: [{ type: 'ROLL_ACKNOWLEDGED', payload: {}, timestamp: 1 } as GameEvent],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state?.sys.tutorial.active).toBe(true);
        expect(result?.state?.sys.tutorial.stepIndex).toBe(1);
        expect(result?.state?.sys.tutorial.step?.id).toBe('move-target');
        expect(result?.state?.sys.tutorial.steps.map((step) => step.id)).toEqual([
            'roll-review',
            'move-target',
        ]);
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

    it('beforeCommand: infoStep 只放行当前步骤声明的教程 AI 动作', () => {
        const manifest: TutorialManifest = {
            id: 'tutorial-ai',
            steps: [
                {
                    id: 'teammate-turn',
                    content: 'watch teammate act',
                    infoStep: true,
                    aiActions: [
                        { commandType: 'EXPLORE_ROOM', playerId: '1', payload: { roomId: 'r1' } },
                    ],
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

        const authoredAi = system.beforeCommand?.({
            state: started?.state ?? state,
            command: {
                type: 'EXPLORE_ROOM',
                playerId: '1',
                payload: { roomId: 'r1', _noSnapshot: true },
                skipValidation: true,
            },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });
        expect(authoredAi).toBeUndefined();

        const wrongPlayer = system.beforeCommand?.({
            state: started?.state ?? state,
            command: {
                type: 'EXPLORE_ROOM',
                playerId: '0',
                payload: { roomId: 'r1', _noSnapshot: true },
                skipValidation: true,
            },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });
        expect(wrongPlayer?.halt).toBe(true);
        expect(wrongPlayer?.error).toBe(TUTORIAL_ERRORS.COMMAND_BLOCKED);

        const unlistedAi = system.beforeCommand?.({
            state: started?.state ?? state,
            command: {
                type: 'MOVE_TO_ROOM',
                playerId: '1',
                payload: { roomId: 'r2', _noSnapshot: true },
                skipValidation: true,
            },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });
        expect(unlistedAi?.halt).toBe(true);
        expect(unlistedAi?.error).toBe(TUTORIAL_ERRORS.COMMAND_BLOCKED);
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

    it('beforeCommand: 当前步骤已过期时先推进，再按新步骤白名单判断玩家命令', () => {
        const sys = createTutorialSystem<TestCore>();
        const manifest: TutorialManifest = {
            id: 'stale-before-command',
            steps: [
                {
                    id: 'choose-reroll',
                    content: 'choose die',
                    requireAction: true,
                    allowedCommands: ['USE_REROLL'],
                    advanceOnEvents: [{ type: 'REROLLED' }],
                },
                {
                    id: 'confirm-reroll-result',
                    content: 'confirm result',
                    requireAction: true,
                    allowedCommands: ['CONFIRM_ROLL'],
                    advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
                },
            ],
            stepValidator: (st, step) => {
                if (step.id === 'choose-reroll') {
                    return (st as MatchState<TestCore>).core.value === 0;
                }
                return true;
            },
        };
        const state = createTestState();
        const started = sys.beforeCommand?.({
            state,
            command: { type: TUTORIAL_COMMANDS.START, playerId: '0', payload: { manifest } },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });
        const staleState: MatchState<TestCore> = {
            ...started!.state!,
            core: { value: 1 },
        };

        const result = sys.beforeCommand?.({
            state: staleState,
            command: { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).not.toBe(true);
        expect(result?.error).toBeUndefined();
        expect(result?.state?.sys.tutorial.step?.id).toBe('confirm-reroll-result');
        expect(result?.events).toContainEqual(
            expect.objectContaining({
                type: TUTORIAL_EVENTS.STEP_CHANGED,
                payload: expect.objectContaining({
                    from: 0,
                    to: 1,
                    stepId: 'confirm-reroll-result',
                }),
            }),
        );
    });

    it('BIND_MANIFEST: 恢复快照后重新绑定 validator，并立即推进过期步骤', () => {
        const sys = createTutorialSystem<TestCore>();
        const manifest: TutorialManifest = {
            id: 'restored-stale-before-command',
            steps: [
                {
                    id: 'choose-reroll',
                    content: 'choose die',
                    requireAction: true,
                    allowedCommands: ['USE_REROLL'],
                    advanceOnEvents: [{ type: 'REROLLED' }],
                },
                {
                    id: 'confirm-reroll-result',
                    content: 'confirm result',
                    requireAction: true,
                    allowedCommands: ['CONFIRM_ROLL'],
                    advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
                },
            ],
            stepValidator: (st, step) => {
                if (step.id === 'choose-reroll') {
                    return (st as MatchState<TestCore>).core.value === 0;
                }
                return true;
            },
        };
        const restoredState: MatchState<TestCore> = {
            ...createTestState(),
            core: { value: 1 },
            sys: {
                ...createTestState().sys,
                tutorial: {
                    active: true,
                    manifestId: manifest.id,
                    stepIndex: 0,
                    steps: JSON.parse(JSON.stringify(manifest.steps)),
                    step: JSON.parse(JSON.stringify(manifest.steps[0])),
                    allowManualSkip: false,
                },
            },
        };

        const bound = sys.beforeCommand?.({
            state: restoredState,
            command: { type: TUTORIAL_COMMANDS.BIND_MANIFEST, playerId: '0', payload: { manifest } },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(bound?.halt).toBe(true);
        expect(bound?.error).toBeUndefined();
        expect(bound?.state?.sys.tutorial.step?.id).toBe('confirm-reroll-result');
        expect(bound?.events).toContainEqual(
            expect.objectContaining({
                type: TUTORIAL_EVENTS.STEP_CHANGED,
                payload: expect.objectContaining({
                    from: 0,
                    to: 1,
                    stepId: 'confirm-reroll-result',
                }),
            }),
        );

        const result = sys.beforeCommand?.({
            state: bound?.state ?? restoredState,
            command: { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).not.toBe(true);
        expect(result?.error).toBeUndefined();
        expect(result?.state).toBeUndefined();
        expect(result?.events).toBeUndefined();
    });

    it('BIND_MANIFEST: 等待动画完成的步骤不会被 validator 当作过期步骤提前跳过', () => {
        const sys = createTutorialSystem<TestCore>();
        const manifest: TutorialManifest = {
            id: 'restored-pending-animation',
            steps: [
                {
                    id: 'choose-reroll',
                    content: 'choose die',
                    requireAction: true,
                    allowedCommands: ['USE_REROLL'],
                    advanceOnEvents: [{ type: 'REROLLED' }],
                    waitForAnimation: true,
                },
                {
                    id: 'confirm-reroll-result',
                    content: 'confirm result',
                    requireAction: true,
                    allowedCommands: ['CONFIRM_ROLL'],
                    advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
                },
            ],
            stepValidator: (st, step) => {
                if (step.id === 'choose-reroll') {
                    return (st as MatchState<TestCore>).core.value === 0;
                }
                return true;
            },
        };
        const restoredState: MatchState<TestCore> = {
            ...createTestState(),
            core: { value: 1 },
            sys: {
                ...createTestState().sys,
                tutorial: {
                    active: true,
                    manifestId: manifest.id,
                    stepIndex: 0,
                    steps: JSON.parse(JSON.stringify(manifest.steps)),
                    step: JSON.parse(JSON.stringify(manifest.steps[0])),
                    allowManualSkip: false,
                    pendingAnimationAdvance: true,
                },
            },
        };

        const bound = sys.beforeCommand?.({
            state: restoredState,
            command: { type: TUTORIAL_COMMANDS.BIND_MANIFEST, playerId: '0', payload: { manifest } },
            events: [], random: mockRandom, playerIds: ['0', '1'],
        });

        expect(bound?.halt).toBe(true);
        expect(bound?.error).toBeUndefined();
        expect(bound?.state?.sys.tutorial.step?.id).toBe('choose-reroll');
        expect(bound?.state?.sys.tutorial.pendingAnimationAdvance).toBe(true);
        expect(bound?.events).toBeUndefined();

        const blockedEarlyConfirm = sys.beforeCommand?.({
            state: bound?.state ?? restoredState,
            command: { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
            events: [], random: mockRandom, playerIds: ['0', '1'],
        });
        expect(blockedEarlyConfirm?.halt).toBe(true);
        expect(blockedEarlyConfirm?.error).toBe(TUTORIAL_ERRORS.COMMAND_BLOCKED);

        const animationComplete = sys.beforeCommand?.({
            state: bound?.state ?? restoredState,
            command: { type: TUTORIAL_COMMANDS.ANIMATION_COMPLETE, playerId: '0', payload: {} },
            events: [], random: mockRandom, playerIds: ['0', '1'],
        });

        expect(animationComplete?.halt).toBe(true);
        expect(animationComplete?.state?.sys.tutorial.step?.id).toBe('confirm-reroll-result');
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
