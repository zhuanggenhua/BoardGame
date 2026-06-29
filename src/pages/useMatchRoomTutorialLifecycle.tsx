import { useEffect, useLayoutEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { useTutorial } from '../contexts/TutorialContext';
import type { ModalEntry } from '../contexts/ModalStackContext';
import type { TutorialManifest } from '../engine/types';

let latestTutorialLifecycleMountId = 0;

type TutorialProgressSnapshot = {
    manifestId: string | null;
    stepId: string | null;
};

type UseMatchRoomTutorialLifecycleArgs = {
    isTutorialRoute: boolean;
    isGameNamespaceReady: boolean;
    gameImplReady: boolean;
    resolvedTutorialManifest: TutorialManifest | null;
    setPlayerID: (playerID: string) => void;
    navigate: NavigateFunction;
    openModal: (entry: Omit<ModalEntry, 'id'> & { id?: string }) => string;
    closeModal: (id: string) => void;
};

export function useMatchRoomTutorialLifecycle(args: UseMatchRoomTutorialLifecycleArgs): void {
    const {
        isTutorialRoute,
        isGameNamespaceReady,
        gameImplReady,
        resolvedTutorialManifest,
        setPlayerID,
        navigate,
        openModal,
        closeModal,
    } = args;
    const {
        startTutorial,
        closeTutorial,
        isActive,
        currentStep,
        isBoardMounted,
    } = useTutorial();

    const tutorialStartedRef = useRef(false);
    const lifecycleMountIdRef = useRef(0);
    const lastTutorialProgressRef = useRef<TutorialProgressSnapshot>({
        manifestId: null,
        stepId: null,
    });
    const tutorialModalIdRef = useRef<string | null>(null);
    const currentManifestId = resolvedTutorialManifest?.id ?? null;
    const currentManifestLastStepId = resolvedTutorialManifest?.steps.at(-1)?.id ?? null;

    useEffect(() => {
        latestTutorialLifecycleMountId += 1;
        lifecycleMountIdRef.current = latestTutorialLifecycleMountId;
    }, []);

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

        // 只在未激活且未启动过时调用 startTutorial
        // 不依赖 tutorial.manifestId/steps.length，避免 startTutorial 的 setTutorial 触发循环
        if (!isActive && !tutorialStartedRef.current && resolvedTutorialManifest) {
            tutorialStartedRef.current = true;
            startTutorial(resolvedTutorialManifest);
        }
    }, [startTutorial, isTutorialRoute, isActive, isGameNamespaceReady, gameImplReady, resolvedTutorialManifest]);

    // gameImplReady 变为 true 时补触发一次教程启动
    // 场景：dev 模式首次加载时 i18n namespace 先于游戏实现加载完成，
    // 上面的 useLayoutEffect 执行时 gameImplReady 还是 false（通过 ref 读取），
    // 等游戏实现加载完后需要重新尝试启动教程。
    useEffect(() => {
        if (!gameImplReady) return;
        if (!isTutorialRoute) return;
        if (!isGameNamespaceReady) return;
        if (isActive || tutorialStartedRef.current) return;
        if (resolvedTutorialManifest) {
            tutorialStartedRef.current = true;
            startTutorial(resolvedTutorialManifest);
        }
    }, [gameImplReady, isTutorialRoute, isGameNamespaceReady, isActive, startTutorial, resolvedTutorialManifest]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!isBoardMounted) return;
        if (!gameImplReady) return;
        if (!isGameNamespaceReady) return;
        if (isActive) return;
        if (
            lastTutorialProgressRef.current.manifestId === currentManifestId
            && lastTutorialProgressRef.current.stepId != null
            && lastTutorialProgressRef.current.stepId === currentManifestLastStepId
        ) {
            return;
        }
        if (!resolvedTutorialManifest) return;

        tutorialStartedRef.current = true;
        startTutorial(resolvedTutorialManifest);
    }, [
        currentManifestId,
        currentManifestLastStepId,
        gameImplReady,
        isActive,
        isBoardMounted,
        isGameNamespaceReady,
        isTutorialRoute,
        resolvedTutorialManifest,
        startTutorial,
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
                // 延迟清理：给 StrictMode remount 一个取消的机会
                cleanupTimerRef.current = window.setTimeout(() => {
                    cleanupTimerRef.current = undefined;
                    if (capturedMountId !== latestTutorialLifecycleMountId) {
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
    }, [isTutorialRoute, isActive]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        lastTutorialProgressRef.current = {
            manifestId: currentManifestId,
            stepId: null,
        };
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
                    navigate(-1);
                }
            }, 600);
            return () => window.clearTimeout(timer);
        }
    }, [currentManifestId, currentManifestLastStepId, isTutorialRoute, isActive, navigate]);

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
