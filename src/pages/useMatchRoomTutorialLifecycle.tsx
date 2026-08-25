import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { useTutorial } from '../contexts/TutorialContext';
import type { ModalEntry } from '../contexts/ModalStackContext';
import type { TutorialCollection, TutorialManifest } from '../engine/types';
import type { LocalMatchSnapshot } from '../engine/transport/localSession';
import {
    clearLocalMatchSnapshot,
    readLocalMatchSnapshot,
} from '../engine/transport/localSession';
import { getTutorialCatalogEntry } from './useMatchRoomRuntimeSetup';

let latestTutorialLifecycleMountId = 0;
let latestTutorialRouteKey: string | null = null;
const TUTORIAL_COMPLETION_STORAGE_PREFIX = 'boardgame:tutorial-completion:v1';
const TUTORIAL_PROGRESS_SEED_PREFIX = 'tutorial-progress:v1';
const TUTORIAL_PROGRESS_STORAGE_CHANGED_EVENT = 'boardgame:tutorial-progress-storage-changed';

type TutorialProgressSnapshot = {
    manifestId: string | null;
    stepId: string | null;
};

export type RestorableTutorialProgress = {
    seed: string;
    snapshot: LocalMatchSnapshot;
    stepIndex: number;
    stepId: string;
    totalSteps: number;
    savedAt: number;
};

const getTutorialCompletionStorageKey = (gameId: string) => `${TUTORIAL_COMPLETION_STORAGE_PREFIX}:${gameId}`;

const encodeTutorialProgressPart = (value: string) => encodeURIComponent(value.trim());

export const resolveTutorialProgressId = (
    tutorialId: string | undefined,
    manifestId: string | null | undefined,
): string | null => {
    const resolved = tutorialId ?? manifestId;
    return resolved && resolved.trim().length > 0 ? resolved : null;
};

export const buildTutorialProgressSeed = (
    gameId: string | undefined,
    tutorialId: string | undefined,
    manifestId: string | null | undefined,
): string | null => {
    const progressId = resolveTutorialProgressId(tutorialId, manifestId);
    if (!gameId || !progressId) {
        return null;
    }

    return [
        TUTORIAL_PROGRESS_SEED_PREFIX,
        encodeTutorialProgressPart(gameId),
        encodeTutorialProgressPart(progressId),
    ].join(':');
};

export const readRestorableTutorialProgress = (args: {
    gameId?: string;
    tutorialId?: string;
    manifest: TutorialManifest | null;
    numPlayers?: number;
}): RestorableTutorialProgress | null => {
    const { gameId, tutorialId, manifest, numPlayers } = args;
    if (!gameId || !manifest || !numPlayers) {
        return null;
    }

    const seed = buildTutorialProgressSeed(gameId, tutorialId, manifest.id);
    if (!seed) {
        return null;
    }

    const snapshot = readLocalMatchSnapshot({
        gameId,
        seed,
        numPlayers,
    });
    const tutorial = snapshot?.state.sys.tutorial;
    if (!snapshot || !tutorial?.active) {
        return null;
    }
    if (tutorial.manifestId !== manifest.id) {
        return null;
    }
    if (!Number.isInteger(tutorial.stepIndex) || tutorial.stepIndex <= 0) {
        return null;
    }

    const step = manifest.steps[tutorial.stepIndex];
    if (!step) {
        return null;
    }
    if (tutorial.step?.id && tutorial.step.id !== step.id) {
        return null;
    }

    return {
        seed,
        snapshot,
        stepIndex: tutorial.stepIndex,
        stepId: step.id,
        totalSteps: manifest.steps.length,
        savedAt: snapshot.savedAt,
    };
};

export const clearTutorialProgress = (args: {
    gameId?: string;
    tutorialId?: string;
    manifestId?: string | null;
}): void => {
    const { gameId, tutorialId, manifestId } = args;
    if (!gameId) {
        return;
    }

    const seed = buildTutorialProgressSeed(gameId, tutorialId, manifestId);
    if (!seed) {
        return;
    }

    clearLocalMatchSnapshot(gameId, seed);
};

export const notifyTutorialProgressStorageChanged = (): void => {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new Event(TUTORIAL_PROGRESS_STORAGE_CHANGED_EVENT));
};

export const readCompletedTutorialIds = (gameId: string): Set<string> => {
    if (typeof window === 'undefined') {
        return new Set();
    }

    try {
        const raw = window.localStorage.getItem(getTutorialCompletionStorageKey(gameId));
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
    } catch {
        return new Set();
    }
};

const writeCompletedTutorialIds = (gameId: string, ids: Set<string>): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(getTutorialCompletionStorageKey(gameId), JSON.stringify([...ids].sort()));
    } catch {
        // localStorage 可能被隐私模式或配额限制禁用；教程完成本身不应因此失败。
    }
};

export const resetMatchRoomTutorialLifecycleRouteTrackingForTests = (): void => {
    latestTutorialLifecycleMountId = 0;
    latestTutorialRouteKey = null;
};

export const markTutorialChapterCompleted = (gameId: string, tutorialId: string): void => {
    const completedIds = readCompletedTutorialIds(gameId);
    completedIds.add(tutorialId);
    writeCompletedTutorialIds(gameId, completedIds);
};

export const resolveCompletedTutorialCatalogId = (
    tutorialCatalog: TutorialCollection | null | undefined,
    tutorialId: string | undefined,
): string | null => {
    if (!tutorialCatalog || !tutorialId) {
        return null;
    }

    const currentEntry = tutorialCatalog.tutorials[tutorialId];
    if (!currentEntry) {
        return null;
    }

    if (currentEntry.hiddenFromCatalog !== true && !currentEntry.nextTutorialId) {
        return tutorialId;
    }

    for (const [candidateId, candidateEntry] of Object.entries(tutorialCatalog.tutorials)) {
        if (candidateEntry.hiddenFromCatalog === true) {
            continue;
        }

        const visitedIds = new Set<string>();
        let nextId = candidateEntry.nextTutorialId;
        while (nextId && !visitedIds.has(nextId)) {
            if (nextId === tutorialId) {
                return currentEntry.nextTutorialId ? null : candidateId;
            }
            visitedIds.add(nextId);
            nextId = tutorialCatalog.tutorials[nextId]?.nextTutorialId;
        }
    }

    return null;
};

type UseMatchRoomTutorialLifecycleArgs = {
    gameId?: string;
    tutorialId?: string;
    tutorialCatalog: TutorialCollection | null;
    isTutorialRoute: boolean;
    isGameNamespaceReady: boolean;
    gameImplReady: boolean;
    resolvedTutorialManifest: TutorialManifest | null;
    tutorialProgressNumPlayers?: number;
    setPlayerID: (playerID: string) => void;
    navigate: NavigateFunction;
    openModal: (entry: Omit<ModalEntry, 'id'> & { id?: string }) => string;
    closeModal: (id: string) => void;
};

export function useMatchRoomTutorialLifecycle(args: UseMatchRoomTutorialLifecycleArgs): void {
    const {
        gameId,
        tutorialId,
        tutorialCatalog,
        isTutorialRoute,
        isGameNamespaceReady,
        gameImplReady,
        resolvedTutorialManifest,
        tutorialProgressNumPlayers,
        setPlayerID,
        navigate,
        openModal,
        closeModal,
    } = args;
    const {
        tutorial,
        startTutorial,
        closeTutorial,
        isActive,
        currentStep,
        isBoardMounted,
    } = useTutorial();

    const tutorialStartedRef = useRef(false);
    const tutorialStartWaitingForBoardRef = useRef(false);
    const [, setProgressStorageRevision] = useState(0);
    const lifecycleMountIdRef = useRef(0);
    const lastTutorialProgressRef = useRef<TutorialProgressSnapshot>({
        manifestId: null,
        stepId: null,
    });
    const tutorialModalIdRef = useRef<string | null>(null);
    const currentManifestId = resolvedTutorialManifest?.id ?? null;
    const activeTutorialManifestId = tutorial.manifestId ?? null;
    const currentManifestSteps = resolvedTutorialManifest?.steps ?? null;
    const currentManifestLastStepId = currentManifestSteps?.[currentManifestSteps.length - 1]?.id ?? null;
    const currentTutorialRouteKey = isTutorialRoute && currentManifestId
        ? `${tutorialId ?? currentManifestId}:${currentManifestId}`
        : null;
    const effectiveTutorialId = tutorialId ?? currentManifestId ?? undefined;
    const currentTutorialEntry = getTutorialCatalogEntry(tutorialCatalog, effectiveTutorialId);
    const nextTutorialId = currentTutorialEntry?.nextTutorialId;
    const completedTutorialCatalogId = resolveCompletedTutorialCatalogId(tutorialCatalog, effectiveTutorialId);
    const restorableTutorialProgress = readRestorableTutorialProgress({
        gameId,
        tutorialId,
        manifest: resolvedTutorialManifest,
        numPlayers: tutorialProgressNumPlayers,
    });
    const shouldWaitForTutorialResumeDecision = Boolean(restorableTutorialProgress) && !isActive;

    useEffect(() => {
        const handleProgressStorageChanged = () => {
            setProgressStorageRevision((revision) => revision + 1);
        };

        window.addEventListener(TUTORIAL_PROGRESS_STORAGE_CHANGED_EVENT, handleProgressStorageChanged);
        return () => {
            window.removeEventListener(TUTORIAL_PROGRESS_STORAGE_CHANGED_EVENT, handleProgressStorageChanged);
        };
    }, []);

    useEffect(() => {
        latestTutorialLifecycleMountId += 1;
        lifecycleMountIdRef.current = latestTutorialLifecycleMountId;
    }, []);

    const tutorialRouteKeyRef = useRef<string | null>(null);
    useLayoutEffect(() => {
        if (!currentTutorialRouteKey) {
            tutorialRouteKeyRef.current = null;
            tutorialStartedRef.current = false;
            tutorialStartWaitingForBoardRef.current = false;
            return;
        }

        if (
            tutorialRouteKeyRef.current
            && tutorialRouteKeyRef.current !== currentTutorialRouteKey
        ) {
            tutorialStartedRef.current = false;
            tutorialStartWaitingForBoardRef.current = false;
            lastTutorialProgressRef.current = {
                manifestId: currentManifestId,
                stepId: null,
            };
        }

        latestTutorialRouteKey = currentTutorialRouteKey;
        tutorialRouteKeyRef.current = currentTutorialRouteKey;
    }, [currentManifestId, currentTutorialRouteKey]);

    const startResolvedTutorial = useCallback(() => {
        if (!resolvedTutorialManifest) return;
        tutorialStartedRef.current = true;
        tutorialStartWaitingForBoardRef.current = !isBoardMounted;
        startTutorial(resolvedTutorialManifest);
    }, [isBoardMounted, resolvedTutorialManifest, startTutorial]);

    // 教程启动 effect
    // 使用 useLayoutEffect 确保在 CriticalImageGate 的 useEffect 之前执行。
    // 配合 TutorialDispatchBridge 的 useLayoutEffect（先 bindDispatch），
    // startTutorial 可以直接通过 controller 执行 START 命令，
    // setState 在 useLayoutEffect 中同步触发重新渲染，
    // CriticalImageGate 直接看到 playing 阶段的 state，只需预加载一次。
    useLayoutEffect(() => {
        if (!isTutorialRoute) return;
        // 等待 i18n 命名空间加载完成，避免在 namespace 加载期间启动教程
        // （namespace 加载会导致 Board 卸载重挂载，重置游戏状态）
        if (!isGameNamespaceReady) return;
        // 等待游戏实现加载完成，否则 getGameImplementation 返回 null
        if (!gameImplReady) return;
        if (shouldWaitForTutorialResumeDecision) return;

        // 只在未启动过当前章节时调用 startTutorial。
        // 切到隐藏续章时，旧章节可能仍 active；此时必须用当前 manifest 替换旧教程。
        // 不依赖 tutorial.manifestId/steps.length，避免 startTutorial 的 setTutorial 触发循环
        const shouldStartCurrentTutorial = Boolean(resolvedTutorialManifest)
            && !tutorialStartedRef.current
            && (!isActive || activeTutorialManifestId !== currentManifestId);
        if (shouldStartCurrentTutorial && resolvedTutorialManifest) {
            startResolvedTutorial();
        }
    }, [
        activeTutorialManifestId,
        currentManifestId,
        gameImplReady,
        isActive,
        isBoardMounted,
        isGameNamespaceReady,
        isTutorialRoute,
        resolvedTutorialManifest,
        shouldWaitForTutorialResumeDecision,
        startResolvedTutorial,
    ]);

    // gameImplReady 变为 true 时补触发一次教程启动
    // 场景：dev 模式首次加载时 i18n namespace 先于游戏实现加载完成，
    // 上面的 useLayoutEffect 执行时 gameImplReady 还是 false（通过 ref 读取），
    // 等游戏实现加载完后需要重新尝试启动教程。
    useEffect(() => {
        if (!gameImplReady) return;
        if (!isTutorialRoute) return;
        if (!isGameNamespaceReady) return;
        if (shouldWaitForTutorialResumeDecision) return;
        const shouldStartCurrentTutorial = Boolean(resolvedTutorialManifest)
            && !tutorialStartedRef.current
            && (!isActive || activeTutorialManifestId !== currentManifestId);
        if (!shouldStartCurrentTutorial) return;
        if (resolvedTutorialManifest) {
            startResolvedTutorial();
        }
    }, [
        activeTutorialManifestId,
        currentManifestId,
        gameImplReady,
        isActive,
        isBoardMounted,
        isGameNamespaceReady,
        isTutorialRoute,
        resolvedTutorialManifest,
        shouldWaitForTutorialResumeDecision,
        startResolvedTutorial,
    ]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!isBoardMounted) return;
        if (!gameImplReady) return;
        if (!isGameNamespaceReady) return;
        if (shouldWaitForTutorialResumeDecision) return;
        const shouldStartCurrentTutorial = Boolean(resolvedTutorialManifest)
            && !tutorialStartedRef.current
            && (!isActive || activeTutorialManifestId !== currentManifestId);
        if (
            lastTutorialProgressRef.current.manifestId === currentManifestId
            && lastTutorialProgressRef.current.stepId != null
            && lastTutorialProgressRef.current.stepId === currentManifestLastStepId
        ) {
            return;
        }
        const shouldRetryBoardPendingStart = Boolean(resolvedTutorialManifest)
            && tutorialStartWaitingForBoardRef.current
            && !isActive
            && activeTutorialManifestId !== currentManifestId;
        if (!shouldStartCurrentTutorial && !shouldRetryBoardPendingStart) return;
        if (!resolvedTutorialManifest) return;

        startResolvedTutorial();
    }, [
        activeTutorialManifestId,
        currentManifestId,
        currentManifestLastStepId,
        gameImplReady,
        isActive,
        isBoardMounted,
        isGameNamespaceReady,
        isTutorialRoute,
        resolvedTutorialManifest,
        shouldWaitForTutorialResumeDecision,
        startResolvedTutorial,
    ]);

    // 组件真正卸载时清理教程
    // 使用 setTimeout(0) 延迟执行：如果是 StrictMode 的 unmount→remount，
    // remount 会在同一微任务内发生，可以在 setTimeout 回调前取消清理。
    // 如果是真正卸载（路由切换），setTimeout 回调正常执行。
    const cleanupTimerRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        // mount 时取消待执行的清理（StrictMode remount 场景）
        if (cleanupTimerRef.current !== undefined) {
            window.clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = undefined;
        }
        return () => {
            if (tutorialStartedRef.current) {
                const capturedMountId = lifecycleMountIdRef.current;
                const capturedTutorialRouteKey = tutorialRouteKeyRef.current;
                // 延迟清理：给 StrictMode remount 一个取消的机会
                cleanupTimerRef.current = window.setTimeout(() => {
                    cleanupTimerRef.current = undefined;
                    if (capturedMountId !== latestTutorialLifecycleMountId) {
                        return;
                    }
                    if (
                        capturedTutorialRouteKey
                        && latestTutorialRouteKey !== capturedTutorialRouteKey
                    ) {
                        return;
                    }
                    if (tutorialStartedRef.current) {
                        tutorialStartedRef.current = false;
                        closeTutorial();
                    }
                }, 0);
            }
        };
    }, [closeTutorial]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!isActive) return;
        // 教程已激活时同步标记（兜底：如果 startTutorial 之外的路径激活了教程）
        tutorialStartedRef.current = true;
        if (activeTutorialManifestId === currentManifestId) {
            tutorialStartWaitingForBoardRef.current = false;
        }
    }, [activeTutorialManifestId, currentManifestId, isTutorialRoute, isActive]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (lastTutorialProgressRef.current.manifestId !== currentManifestId) {
            lastTutorialProgressRef.current = {
                manifestId: currentManifestId,
                stepId: null,
            };
        }
        if (currentStep?.id) {
            lastTutorialProgressRef.current = {
                manifestId: currentManifestId,
                stepId: currentStep.id,
            };
        }
    }, [currentManifestId, currentStep?.id, isTutorialRoute]);

    // 教程视角自动切换：步骤指定 viewAs 时切换到对应玩家视角，步骤结束后恢复到 '0'
    useEffect(() => {
        if (!isTutorialRoute) return;
        const targetView = currentStep?.viewAs ?? '0';
        setPlayerID(targetView);
    }, [currentStep?.viewAs, isTutorialRoute, setPlayerID]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!tutorialStartedRef.current) return;

        // 教程模式下，部分游戏会在初始化/重置时短暂触发 tutorial.active=false。
        // 这里避免把"瞬间失活"误判为"教程已结束"，导致刚进入就 navigate(-1) 退回首页。
        if (!isActive) {
            const timer = window.setTimeout(() => {
                if (!tutorialStartedRef.current) return;
                // 二次确认仍未激活，且已进入完成步骤时才认为教程结束并返回。
                if (
                    !isActive
                    && lastTutorialProgressRef.current.manifestId === currentManifestId
                    && lastTutorialProgressRef.current.stepId === currentManifestLastStepId
                ) {
                    if (gameId) {
                        clearTutorialProgress({
                            gameId,
                            tutorialId,
                            manifestId: currentManifestId,
                        });
                    }
                    if (gameId && completedTutorialCatalogId) {
                        markTutorialChapterCompleted(gameId, completedTutorialCatalogId);
                    }
                    if (gameId && nextTutorialId) {
                        navigate(`/play/${gameId}/tutorial/${nextTutorialId}`);
                        return;
                    }
                    navigate(-1);
                }
            }, 600);
            return () => window.clearTimeout(timer);
        }
    }, [
        completedTutorialCatalogId,
        currentManifestId,
        currentManifestLastStepId,
        gameId,
        isTutorialRoute,
        isActive,
        navigate,
        nextTutorialId,
        tutorialId,
    ]);

    useEffect(() => {
        // 关键约束：教程提示层只允许在 /tutorial 路由出现。
        // 否则如果某个联机对局状态中残留了 sys.tutorial.active=true（例如历史教程状态被持久化），
        // 就会在联机模式下误弹出教程提示。
        if (!isTutorialRoute) {
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
            // 联机/非教程路由下，不主动 closeTutorial()，避免在用户确实处于教程流程但路由切换瞬间被误关。
            return;
        }

        if (isActive && !tutorialModalIdRef.current && isBoardMounted) {
            tutorialModalIdRef.current = openModal({
                closeOnBackdrop: false,
                closeOnEsc: false,
                lockScroll: true,
                allowPointerThrough: true,
                allowSystemBackNavigation: true,
                onClose: () => {
                    tutorialModalIdRef.current = null;
                },
                render: () => <TutorialOverlay />,
            });
        }

        // Board 被 CriticalImageGate 卸载（phaseKey 变化触发重新预加载）时，
        // 关闭教程弹窗，避免弹窗悬浮在 LoadingScreen 上方。
        // Board 重新挂载后 isBoardMounted 恢复为 true，弹窗会重新打开。
        if (tutorialModalIdRef.current && !isBoardMounted) {
            closeModal(tutorialModalIdRef.current);
            tutorialModalIdRef.current = null;
        }

        if (!isActive && tutorialModalIdRef.current) {
            closeModal(tutorialModalIdRef.current);
            tutorialModalIdRef.current = null;
        }
    }, [closeModal, isActive, isBoardMounted, isTutorialRoute, openModal]);

    useEffect(() => {
        return () => {
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
        };
    }, [closeModal]);
}
