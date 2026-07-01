/* @vitest-environment happy-dom */
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatchRoomTutorialLifecycle } from '../useMatchRoomTutorialLifecycle';
import type { TutorialCollection, TutorialManifest, TutorialState } from '../../engine/types';

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

const makeCatalog = (entries: Array<{
    id: string;
    hiddenFromCatalog?: boolean;
    nextTutorialId?: string;
}>): TutorialCollection => ({
    defaultTutorialId: entries[0]?.id ?? 'default',
    tutorials: Object.fromEntries(entries.map((entry) => [
        entry.id,
        {
            hiddenFromCatalog: entry.hiddenFromCatalog,
            nextTutorialId: entry.nextTutorialId,
            manifest: makeManifest(entry.id, ['overview', 'finish']),
        },
    ])),
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
        const firstManifest = makeManifest('field-battle', ['overview', 'finish']);
        const secondManifest = makeManifest('season-flow', ['overview', 'finish']);

        tutorialState.isActive = true;
        tutorialState.currentStep = firstManifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook((manifest: TutorialManifest | null) => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId: 'field-battle',
            tutorialCatalog: null,
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
        const manifest = makeManifest('field-battle', ['overview', 'finish']);

        tutorialState.isActive = true;
        tutorialState.currentStep = manifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId: 'field-battle',
            tutorialCatalog: null,
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
        const manifest = makeManifest('season-flow', ['overview', 'finish']);

        tutorialState.isActive = true;
        tutorialState.currentStep = manifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId: 'season-flow',
            tutorialCatalog: null,
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

    it('从一个教程路由切到另一个教程路由时，旧实例的延迟清理不能把新教程误关掉', async () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const firstManifest = makeManifest('basic-setup-and-turn', ['finish']);
        const secondManifest = makeManifest('haunt-actions-and-finish', ['setup-ready-to-exorcise', 'endgame-review']);

        tutorialState.isActive = true;
        tutorialState.currentStep = firstManifest.steps[0] ?? null;
        tutorialState.isBoardMounted = true;

        const firstHook = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'betrayal',
            tutorialId: 'basic-setup-and-turn',
            tutorialCatalog: null,
            isTutorialRoute: true,
            isGameNamespaceReady: true,
            gameImplReady: true,
            resolvedTutorialManifest: firstManifest,
            setPlayerID,
            navigate,
            openModal,
            closeModal,
        }));

        firstHook.unmount();

        tutorialState.isActive = false;
        tutorialState.currentStep = null;
        tutorialState.isBoardMounted = true;

        renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'betrayal',
            tutorialId: 'haunt-actions-and-finish',
            tutorialCatalog: null,
            isTutorialRoute: true,
            isGameNamespaceReady: true,
            gameImplReady: true,
            resolvedTutorialManifest: secondManifest,
            setPlayerID,
            navigate,
            openModal,
            closeModal,
        }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(tutorialState.startTutorial).toHaveBeenCalledWith(secondManifest);
        expect(tutorialState.closeTutorial).not.toHaveBeenCalled();
    });

    it('主章节完成后，若目录指定 nextTutorialId，会自动切到下一条隐藏教程路由', async () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const manifest = makeManifest('attack-and-battle', ['overview', 'finish']);
        const catalog = makeCatalog([
            { id: 'attack-and-battle', nextTutorialId: 'retreat-and-rout' },
            { id: 'retreat-and-rout', hiddenFromCatalog: true },
        ]);

        tutorialState.isActive = true;
        tutorialState.currentStep = manifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId: 'attack-and-battle',
            tutorialCatalog: catalog,
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

        expect(navigate).toHaveBeenCalledWith('/play/qidahen/tutorial/retreat-and-rout');
    });
});
