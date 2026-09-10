/* @vitest-environment happy-dom */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModeProvider } from '../../contexts/GameModeContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { TutorialProvider, useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { TUTORIAL_COMMANDS } from '../../engine/systems/TutorialSystem';
import type { TutorialManifest, TutorialState } from '../../engine/types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <GameModeProvider mode="tutorial">
        <ToastProvider>
            <TutorialProvider>
                {children}
            </TutorialProvider>
        </ToastProvider>
    </GameModeProvider>
);

const makeManifest = (): TutorialManifest => ({
    id: 'betrayal-basic-setup',
    steps: [
        {
            id: 'setup-runtime',
            content: 'setup',
            position: 'center',
            aiActions: [
                {
                    commandType: 'BETRAYAL_TUTORIAL_SETUP',
                    payload: { ready: true },
                    playerId: '1',
                },
            ],
        },
    ],
});

const makeMultiActionManifest = (): TutorialManifest => ({
    id: 'multi-action-tutorial',
    steps: [
        {
            id: 'intro',
            content: 'intro',
            position: 'center',
        },
        {
            id: 'multi-ai-step',
            content: 'multi',
            position: 'center',
            aiActions: [
                {
                    commandType: 'AI_ONE',
                    payload: { order: 1 },
                    playerId: '1',
                },
                {
                    commandType: 'AI_TWO',
                    payload: { order: 2 },
                    playerId: '1',
                },
            ],
            advanceOnEvents: [
                { type: TUTORIAL_COMMANDS.AI_CONSUMED, match: { stepId: 'multi-ai-step' } },
            ],
        },
    ],
});

const makeSingleRuntimeActionManifest = (): TutorialManifest => ({
    id: 'single-runtime-action-tutorial',
    steps: [
        {
            id: 'intro',
            content: 'intro',
            position: 'center',
        },
        {
            id: 'single-ai-step',
            content: 'single',
            position: 'center',
            aiActions: [
                {
                    commandType: 'AI_ONLY',
                    payload: { ready: true },
                    playerId: '1',
                },
            ],
            autoAdvanceAfterAi: false,
        },
    ],
});

const runNextTutorialTimer = async () => {
    await act(async () => {
        await vi.runOnlyPendingTimersAsync();
    });
};

const syncTutorialStep = (
    syncTutorialState: (tutorial: TutorialState, runtimeSyncKey?: string) => void,
    manifest: TutorialManifest,
    stepIndex: number,
    runtimeSyncKey: string,
) => {
    syncTutorialState({
        active: true,
        manifestId: manifest.id,
        stepIndex,
        steps: manifest.steps,
        step: manifest.steps[stepIndex],
        aiActions: manifest.steps[stepIndex].aiActions,
    }, runtimeSyncKey);
};

const makeBoardTutorialState = (
    manifest: TutorialManifest,
    stepIndex: number,
): TutorialState => ({
    active: true,
    manifestId: manifest.id,
    stepIndex,
    steps: manifest.steps,
    step: manifest.steps[stepIndex],
});

const makeInactiveBoardTutorialState = (): TutorialState => ({
    active: false,
    manifestId: null,
    stepIndex: 0,
    steps: [],
    step: null,
});

describe('TutorialContext', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('previousStep 只分发教程上一步命令', () => {
        const dispatched: Array<{ type: string; payload?: unknown }> = [];
        const { result } = renderHook(() => useTutorial(), { wrapper });

        act(() => {
            result.current.bindDispatch((type, payload) => {
                dispatched.push({ type, payload });
            });
            result.current.previousStep();
        });

        expect(dispatched).toContainEqual({
            type: TUTORIAL_COMMANDS.PREVIOUS,
            payload: {},
        });
    });

    it('Board 重挂载的空白教程状态不会关闭非最后一步的教程上下文', async () => {
        const manifest: TutorialManifest = {
            id: 'basic-setup-and-turn',
            steps: [
                { id: 'setup-runtime', content: 'setup' },
                { id: 'objective-and-turn', content: 'objective' },
                { id: 'finish', content: 'finish' },
            ],
        };
        const dispatch = vi.fn();
        const { result, rerender } = renderHook(
            ({ boardTutorial, syncKey }: { boardTutorial: TutorialState; syncKey: string }) => {
                const context = useTutorial();
                useTutorialBridge(boardTutorial, dispatch, syncKey);
                return context;
            },
            {
                wrapper,
                initialProps: {
                    boardTutorial: makeBoardTutorialState(manifest, 1),
                    syncKey: 'objective-active',
                },
            },
        );

        await act(async () => undefined);
        expect(result.current.isActive).toBe(true);
        expect(result.current.currentStep?.id).toBe('objective-and-turn');

        await act(async () => {
            rerender({
                boardTutorial: makeInactiveBoardTutorialState(),
                syncKey: 'provider-remount-blank',
            });
        });

        expect(result.current.isActive).toBe(true);
        expect(result.current.currentStep?.id).toBe('objective-and-turn');
    });

    it('Board 同步到最后一步后的空白教程状态仍会正常关闭教程上下文', async () => {
        const manifest: TutorialManifest = {
            id: 'basic-setup-and-turn',
            steps: [
                { id: 'setup-runtime', content: 'setup' },
                { id: 'finish', content: 'finish' },
            ],
        };
        const dispatch = vi.fn();
        const { result, rerender } = renderHook(
            ({ boardTutorial, syncKey }: { boardTutorial: TutorialState; syncKey: string }) => {
                const context = useTutorial();
                useTutorialBridge(boardTutorial, dispatch, syncKey);
                return context;
            },
            {
                wrapper,
                initialProps: {
                    boardTutorial: makeBoardTutorialState(manifest, 1),
                    syncKey: 'finish-active',
                },
            },
        );

        await act(async () => undefined);
        expect(result.current.isActive).toBe(true);
        expect(result.current.isLastStep).toBe(true);

        await act(async () => {
            rerender({
                boardTutorial: makeInactiveBoardTutorialState(),
                syncKey: 'finished-blank',
            });
        });

        expect(result.current.isActive).toBe(false);
    });

    it('命令桥就绪后可以先启动教程，但真实 Board 挂载前不会执行 AI 动作', async () => {
        const manifest = makeManifest();
        const dispatched: Array<{ type: string; payload?: unknown }> = [];
        const { result } = renderHook(() => useTutorial(), { wrapper });

        let generation = 0;
        act(() => {
            generation = result.current.bindDispatch((type, payload) => {
                dispatched.push({ type, payload });
            });
        });

        act(() => {
            result.current.startTutorial(manifest);
        });

        expect(dispatched).toContainEqual({
            type: TUTORIAL_COMMANDS.START,
            payload: { manifest },
        });
        expect(result.current.isBoardMounted).toBe(false);

        const activeTutorial: TutorialState = {
            active: true,
            manifestId: manifest.id,
            stepIndex: 0,
            steps: manifest.steps,
            step: manifest.steps[0],
            aiActions: manifest.steps[0].aiActions,
        };

        act(() => {
            result.current.syncTutorialState(activeTutorial);
        });
        await runNextTutorialTimer();

        expect(dispatched).not.toContainEqual(expect.objectContaining({
            type: 'BETRAYAL_TUTORIAL_SETUP',
        }));

        act(() => {
            result.current.notifyBoardMounted(generation);
        });
        await runNextTutorialTimer();

        expect(dispatched).toContainEqual({
            type: 'BETRAYAL_TUTORIAL_SETUP',
            payload: {
                ready: true,
                __tutorialAiCommand: true,
                __tutorialPlayerId: '1',
            },
        });
        expect(dispatched).toContainEqual({
            type: TUTORIAL_COMMANDS.AI_CONSUMED,
            payload: { stepId: 'setup-runtime' },
        });
    });

    it('多条教程 AI 动作会按状态帧逐条执行，最后才消费 AI', async () => {
        const manifest = makeMultiActionManifest();
        const dispatched: Array<{ type: string; payload?: unknown }> = [];
        const { result } = renderHook(() => useTutorial(), { wrapper });

        let generation = 0;
        act(() => {
            generation = result.current.bindDispatch((type, payload) => {
                dispatched.push({ type, payload });
            });
        });
        act(() => {
            result.current.startTutorial(manifest);
            syncTutorialStep(result.current.syncTutorialState, manifest, 1, 'multi-ai-step-start');
            result.current.notifyBoardMounted(generation);
        });

        await runNextTutorialTimer();
        expect(dispatched.map(item => item.type)).toContain('AI_ONE');
        expect(dispatched.map(item => item.type)).not.toContain('AI_TWO');
        expect(dispatched.map(item => item.type)).not.toContain(TUTORIAL_COMMANDS.AI_CONSUMED);

        act(() => {
            syncTutorialStep(result.current.syncTutorialState, manifest, 1, 'after-ai-one');
        });
        await runNextTutorialTimer();
        expect(dispatched).toContainEqual({
            type: 'AI_TWO',
            payload: {
                order: 2,
                __tutorialAiCommand: true,
                __tutorialPlayerId: '1',
            },
        });
        expect(dispatched).toContainEqual({
            type: TUTORIAL_COMMANDS.AI_CONSUMED,
            payload: { stepId: 'multi-ai-step' },
        });
    });

    it('运行中单条教程 AI 动作即使没有额外状态帧同步，也会消费 AI 并恢复可见步骤', async () => {
        const manifest = makeSingleRuntimeActionManifest();
        const dispatched: Array<{ type: string; payload?: unknown }> = [];
        const { result } = renderHook(() => useTutorial(), { wrapper });

        let generation = 0;
        act(() => {
            generation = result.current.bindDispatch((type, payload) => {
                dispatched.push({ type, payload });
            });
        });
        act(() => {
            result.current.startTutorial(manifest);
            syncTutorialStep(result.current.syncTutorialState, manifest, 1, 'single-ai-step-start');
            result.current.notifyBoardMounted(generation);
        });

        await runNextTutorialTimer();

        expect(dispatched).toContainEqual({
            type: 'AI_ONLY',
            payload: {
                ready: true,
                __tutorialAiCommand: true,
                __tutorialPlayerId: '1',
            },
        });
        expect(dispatched).toContainEqual({
            type: TUTORIAL_COMMANDS.AI_CONSUMED,
            payload: { stepId: 'single-ai-step' },
        });
    });

    it('多条教程 AI 动作没有状态帧同步时不会继续执行或消费 AI', async () => {
        const manifest = makeMultiActionManifest();
        const dispatched: Array<{ type: string; payload?: unknown }> = [];
        const { result } = renderHook(() => useTutorial(), { wrapper });

        let generation = 0;
        act(() => {
            generation = result.current.bindDispatch((type, payload) => {
                dispatched.push({ type, payload });
            });
        });
        act(() => {
            result.current.startTutorial(manifest);
            syncTutorialStep(result.current.syncTutorialState, manifest, 1, 'multi-ai-step-start');
            result.current.notifyBoardMounted(generation);
        });

        await runNextTutorialTimer();
        expect(dispatched.map(item => item.type)).toContain('AI_ONE');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1100);
        });

        expect(dispatched.map(item => item.type)).not.toContain('AI_TWO');
        expect(dispatched.map(item => item.type)).not.toContain(TUTORIAL_COMMANDS.AI_CONSUMED);
    });
});
