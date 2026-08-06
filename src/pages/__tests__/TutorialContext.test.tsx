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
        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        expect(dispatched).not.toContainEqual(expect.objectContaining({
            type: 'BETRAYAL_TUTORIAL_SETUP',
        }));

        act(() => {
            result.current.notifyBoardMounted(generation);
        });
        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

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
});
