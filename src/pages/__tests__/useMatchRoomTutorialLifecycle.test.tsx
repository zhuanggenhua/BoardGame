/* @vitest-environment happy-dom */
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatchRoomTutorialLifecycle } from '../useMatchRoomTutorialLifecycle';
import {
    buildTutorialProgressSeed,
    clearTutorialProgress,
    readCompletedTutorialIds,
    readRestorableTutorialProgress,
    resetMatchRoomTutorialLifecycleRouteTrackingForTests,
    resolveCompletedTutorialCatalogId,
} from '../useMatchRoomTutorialLifecycle';
import { buildLocalMatchSnapshotKey, persistLocalMatchSnapshot } from '../../engine/transport/localSession';
import type { MatchState, TutorialCollection, TutorialManifest, TutorialState } from '../../engine/types';

const tutorialState = {
    tutorial: {
        manifestId: null as string | null,
    },
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

const persistTutorialSnapshot = (args: {
    gameId: string;
    tutorialId: string;
    manifest: TutorialManifest;
    numPlayers?: number;
    stepIndex?: number;
    active?: boolean;
    manifestId?: string;
    stepId?: string;
}) => {
    const {
        gameId,
        tutorialId,
        manifest,
        numPlayers = 2,
        stepIndex = 1,
        active = true,
        manifestId = manifest.id,
        stepId = manifest.steps[stepIndex]?.id,
    } = args;
    const seed = buildTutorialProgressSeed(gameId, tutorialId, manifest.id);
    if (!seed) {
        throw new Error('expected tutorial progress seed');
    }

    persistLocalMatchSnapshot({
        gameId,
        seed,
        numPlayers,
        randomCursor: 0,
        state: {
            core: {},
            sys: {
                tutorial: {
                    active,
                    manifestId,
                    stepIndex,
                    steps: manifest.steps,
                    step: stepId
                        ? { ...manifest.steps[stepIndex], id: stepId }
                        : null,
                },
            },
        } as MatchState<unknown>,
    });

    return seed;
};

describe('useMatchRoomTutorialLifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetMatchRoomTutorialLifecycleRouteTrackingForTests();
        window.localStorage.clear();
        tutorialState.startTutorial.mockReset();
        tutorialState.closeTutorial.mockReset();
        tutorialState.isActive = false;
        tutorialState.tutorial.manifestId = null;
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
        tutorialState.tutorial.manifestId = firstManifest.id;
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
        tutorialState.tutorial.manifestId = manifest.id;
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
        tutorialState.tutorial.manifestId = manifest.id;
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

    it('教程启动请求在 Board 挂载前挂起时，Board 挂载后会补启动当前章节', () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const manifest = makeManifest('basic-setup-and-turn', ['setup-runtime', 'overview', 'finish']);

        tutorialState.isActive = false;
        tutorialState.tutorial.manifestId = null;
        tutorialState.currentStep = null;
        tutorialState.isBoardMounted = false;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'betrayal',
            tutorialId: 'basic-setup-and-turn',
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

        expect(tutorialState.startTutorial).toHaveBeenCalledTimes(1);
        expect(tutorialState.startTutorial).toHaveBeenLastCalledWith(manifest);

        tutorialState.isBoardMounted = true;
        rerender();

        expect(tutorialState.startTutorial).toHaveBeenCalledTimes(2);
        expect(tutorialState.startTutorial).toHaveBeenLastCalledWith(manifest);
    });

    it('从一个教程路由切到另一个教程路由时，旧实例的延迟清理不能把新教程误关掉', async () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const firstManifest = makeManifest('basic-setup-and-turn', ['finish']);
        const secondManifest = makeManifest('haunt-actions-and-finish', ['setup-ready-to-exorcise', 'endgame-review']);

        tutorialState.isActive = true;
        tutorialState.tutorial.manifestId = firstManifest.id;
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

    it('教程进度 seed 会按游戏与章节隔离', () => {
        expect(buildTutorialProgressSeed('qidahen', 'basic-opening', 'basic-opening'))
            .toBe('tutorial-progress:v1:qidahen:basic-opening');
        expect(buildTutorialProgressSeed('qidahen', 'basic-opening', 'basic-opening'))
            .not.toBe(buildTutorialProgressSeed('qidahen', 'attack-and-battle', 'attack-and-battle'));
        expect(buildTutorialProgressSeed('qidahen', undefined, 'basic-opening'))
            .toBe('tutorial-progress:v1:qidahen:basic-opening');
    });

    it('只把有效的激活中章节快照识别为可恢复教程进度', () => {
        const manifest = makeManifest('basic-opening', ['intro', 'play-card', 'finish']);
        persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            stepIndex: 1,
        });

        expect(readRestorableTutorialProgress({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            numPlayers: 2,
        })).toMatchObject({
            stepIndex: 1,
            stepId: 'play-card',
            totalSteps: 3,
        });

        persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            active: false,
        });
        expect(readRestorableTutorialProgress({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            numPlayers: 2,
        })).toBeNull();

        persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            stepIndex: 0,
        });
        expect(readRestorableTutorialProgress({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            numPlayers: 2,
        })).toBeNull();

        persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            manifestId: 'other-manifest',
        });
        expect(readRestorableTutorialProgress({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            numPlayers: 2,
        })).toBeNull();

        persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            stepId: 'unexpected-step',
        });
        expect(readRestorableTutorialProgress({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            numPlayers: 2,
        })).toBeNull();
    });

    it('存在可恢复进度时，不会自动从第一步重新启动教程', () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const manifest = makeManifest('basic-opening', ['intro', 'play-card', 'finish']);
        persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            stepIndex: 1,
        });

        renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            tutorialCatalog: null,
            isTutorialRoute: true,
            isGameNamespaceReady: true,
            gameImplReady: true,
            resolvedTutorialManifest: manifest,
            tutorialProgressNumPlayers: 2,
            setPlayerID,
            navigate,
            openModal,
            closeModal,
        }));

        expect(tutorialState.startTutorial).not.toHaveBeenCalled();
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
        tutorialState.tutorial.manifestId = manifest.id;
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
        tutorialState.currentStep = null;
        rerender();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(navigate).toHaveBeenCalledWith('/play/qidahen/tutorial/retreat-and-rout');
        expect(readCompletedTutorialIds('qidahen').has('attack-and-battle')).toBe(false);
    });

    it('教程路由切到隐藏续章时，不会误清新 controller，并启动新章节 manifest', () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const attackManifest = makeManifest('attack-and-battle', ['overview', 'finish']);
        const retreatManifest = makeManifest('retreat-and-rout', ['overview', 'finish']);
        const catalog = makeCatalog([
            { id: 'attack-and-battle', nextTutorialId: 'retreat-and-rout' },
            { id: 'retreat-and-rout', hiddenFromCatalog: true },
        ]);
        let tutorialId = 'attack-and-battle';
        let manifest = attackManifest;

        tutorialState.isActive = false;
        tutorialState.currentStep = null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId,
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

        expect(tutorialState.startTutorial).toHaveBeenCalledWith(attackManifest);
        tutorialState.startTutorial.mockClear();
        tutorialState.closeTutorial.mockClear();

        tutorialId = 'retreat-and-rout';
        manifest = retreatManifest;
        rerender();

        expect(tutorialState.closeTutorial).not.toHaveBeenCalled();
        expect(tutorialState.startTutorial).toHaveBeenCalledWith(retreatManifest);
    });

    it('旧章节仍处于激活态时切到隐藏续章，也会用当前 manifest 替换旧教程', () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const attackManifest = makeManifest('attack-and-battle', ['overview', 'finish']);
        const retreatManifest = makeManifest('retreat-and-rout', ['overview', 'finish']);
        const catalog = makeCatalog([
            { id: 'attack-and-battle', nextTutorialId: 'retreat-and-rout' },
            { id: 'retreat-and-rout', hiddenFromCatalog: true },
        ]);
        let tutorialId = 'attack-and-battle';
        let manifest = attackManifest;

        tutorialState.isActive = true;
        tutorialState.tutorial.manifestId = attackManifest.id;
        tutorialState.currentStep = attackManifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId,
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

        expect(tutorialState.startTutorial).not.toHaveBeenCalled();

        tutorialId = 'retreat-and-rout';
        manifest = retreatManifest;
        rerender();

        expect(tutorialState.closeTutorial).not.toHaveBeenCalled();
        expect(tutorialState.startTutorial).toHaveBeenCalledWith(retreatManifest);
    });

    it('隐藏续章完成后，会把对应的可见章节标记为已完成', async () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const manifest = makeManifest('retreat-and-rout', ['overview', 'finish']);
        const catalog = makeCatalog([
            { id: 'attack-and-battle', nextTutorialId: 'retreat-and-rout' },
            { id: 'retreat-and-rout', hiddenFromCatalog: true },
        ]);

        tutorialState.isActive = true;
        tutorialState.tutorial.manifestId = manifest.id;
        tutorialState.currentStep = manifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId: 'retreat-and-rout',
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

        expect(readCompletedTutorialIds('qidahen').has('attack-and-battle')).toBe(true);
        expect(navigate).toHaveBeenCalledWith(-1);
    });

    it('完成普通可见章节时，会直接记录该章节', async () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const manifest = makeManifest('basic-opening', ['overview', 'finish']);
        const catalog = makeCatalog([
            { id: 'basic-opening' },
            { id: 'attack-and-battle' },
        ]);

        tutorialState.isActive = true;
        tutorialState.tutorial.manifestId = manifest.id;
        tutorialState.currentStep = manifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
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

        expect(readCompletedTutorialIds('qidahen').has('basic-opening')).toBe(true);
    });

    it('完成普通可见章节时，会清理对应章节的可恢复进度', async () => {
        const setPlayerID = vi.fn();
        const navigate = vi.fn();
        const openModal = vi.fn(() => 'modal-1');
        const closeModal = vi.fn();
        const manifest = makeManifest('basic-opening', ['overview', 'finish']);
        const catalog = makeCatalog([{ id: 'basic-opening' }]);
        const seed = persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest,
            stepIndex: 1,
        });

        tutorialState.isActive = true;
        tutorialState.tutorial.manifestId = manifest.id;
        tutorialState.currentStep = manifest.steps[1] ?? null;
        tutorialState.isBoardMounted = true;

        const { rerender } = renderHook(() => useMatchRoomTutorialLifecycle({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            tutorialCatalog: catalog,
            isTutorialRoute: true,
            isGameNamespaceReady: true,
            gameImplReady: true,
            resolvedTutorialManifest: manifest,
            tutorialProgressNumPlayers: 2,
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

        expect(window.localStorage.getItem(buildLocalMatchSnapshotKey('qidahen', seed))).toBeNull();
    });

    it('重头开始会只清理当前章节进度，不影响同游戏其他章节', () => {
        const basicManifest = makeManifest('basic-opening', ['intro', 'play-card']);
        const battleManifest = makeManifest('attack-and-battle', ['intro', 'fight']);
        const basicSeed = persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifest: basicManifest,
        });
        const battleSeed = persistTutorialSnapshot({
            gameId: 'qidahen',
            tutorialId: 'attack-and-battle',
            manifest: battleManifest,
        });

        clearTutorialProgress({
            gameId: 'qidahen',
            tutorialId: 'basic-opening',
            manifestId: basicManifest.id,
        });

        expect(window.localStorage.getItem(buildLocalMatchSnapshotKey('qidahen', basicSeed))).toBeNull();
        expect(window.localStorage.getItem(buildLocalMatchSnapshotKey('qidahen', battleSeed))).not.toBeNull();
    });

    it('完成状态只解析到可见章节，不让隐藏续章成为目录打勾对象', () => {
        const catalog = makeCatalog([
            { id: 'attack-and-battle', nextTutorialId: 'retreat-and-rout' },
            { id: 'retreat-and-rout', hiddenFromCatalog: true },
        ]);

        expect(resolveCompletedTutorialCatalogId(catalog, 'attack-and-battle')).toBeNull();
        expect(resolveCompletedTutorialCatalogId(catalog, 'retreat-and-rout')).toBe('attack-and-battle');
    });
});
