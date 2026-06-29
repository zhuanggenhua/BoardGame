/* @vitest-environment happy-dom */
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatchRoomTutorialLifecycle } from '../useMatchRoomTutorialLifecycle';
import type { TutorialManifest, TutorialState } from '../../engine/types';

const tutorialState = {
    startTutorial: vi.fn(),
    closeTutorial: vi.fn(),
    isActive: false,
    currentStep: null as TutorialState['step'],
    isBoardMounted: false,
};

vi.mock('../../components/tutorial/TutorialOverlay', () => ({
    TutorialOverlay: () => null,
}));

vi.mock('../../contexts/TutorialContext', () => ({
    useTutorial: () => tutorialState,
}));

const makeManifest = (id: string, stepIds: string[]): TutorialManifest => ({
    id,
    steps: stepIds.map((stepId) => ({
        id: stepId,
        content: `${id}.${stepId}`,
        position: 'center',
    })),
});

describe('useMatchRoomTutorialLifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        tutorialState.startTutorial.mockReset();
        tutorialState.closeTutorial.mockReset();
        tutorialState.isActive = false;
        tutorialState.currentStep = null;
        tutorialState.isBoardMounted = false;
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('子教程切换后，即使上一条教程已经走过步骤，也会按新 manifest 重新启动', () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const firstManifest = makeManifest('attack-and-battle', ['overview', 'finish']);
        const secondManifest = makeManifest('year-and-characters', ['overview', 'finish']);

        tutorialState.isActive = true;
        tutorialState.currentStep = firstManifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook((manifest: TutorialManifest | null) => useMatchRoomTutorialLifecycle({
            isTutorialRoute: true,
            isGameNamespaceReady: true,
            gameImplReady: true,
            resolvedTutorialManifest: manifest,
            setPlayerID,
            navigate,
            openModal,
            closeModal,
        }), {
            initialProps: firstManifest,
        });

        tutorialState.isActive = false;
        tutorialState.currentStep = null;

        rerender(secondManifest);

        expect(tutorialState.startTutorial).toHaveBeenCalledTimes(1);
        expect(tutorialState.startTutorial).toHaveBeenCalledWith(secondManifest);
    });

    it('当前教程最后一步不是 finish 时，结束后仍会按完成态返回上一页', async () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const manifest = makeManifest('attack-and-battle', ['overview', 'finish']);

        tutorialState.isActive = true;
        tutorialState.currentStep = manifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            isTutorialRoute: true,
            isGameNamespaceReady: true,
            gameImplReady: true,
            resolvedTutorialManifest: manifest,
            setPlayerID,
            navigate,
            openModal,
            closeModal,
        }));

        tutorialState.isActive = false;
        rerender();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(navigate).toHaveBeenCalledWith(-1);
    });

    it('同一条教程已经走到最后一步且当前未激活时，不会重复自动启动', () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const manifest = makeManifest('year-and-characters', ['overview', 'finish']);

        tutorialState.isActive = true;
        tutorialState.currentStep = manifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            isTutorialRoute: true,
            isGameNamespaceReady: true,
            gameImplReady: true,
            resolvedTutorialManifest: manifest,
            setPlayerID,
            navigate,
            openModal,
            closeModal,
        }));

        tutorialState.isActive = false;
        rerender();

        expect(tutorialState.startTutorial).not.toHaveBeenCalled();
    });
});
