/* @vitest-environment happy-dom */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../contexts/ToastContext';
import { TutorialProvider, useTutorial } from '../../contexts/TutorialContext';
import { TUTORIAL_COMMANDS } from '../../engine/systems/TutorialSystem';
import type { TutorialManifest, TutorialState } from '../../engine/types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>
        <TutorialProvider>
            {children}
        </TutorialProvider>
    </ToastProvider>
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

describe('TutorialContext', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
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
        expect(dispatched.map(item => item.type)).not.toContain(TUTORIAL_COMMANDS.AI_CONSUMED);

        act(() => {
            syncTutorialStep(result.current.syncTutorialState, manifest, 1, 'after-ai-two');
        });
        await runNextTutorialTimer();
        expect(dispatched).toContainEqual({
            type: TUTORIAL_COMMANDS.AI_CONSUMED,
            payload: { stepId: 'multi-ai-step' },
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
