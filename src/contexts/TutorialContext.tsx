import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useToast } from './ToastContext';
import type { TutorialAiAction, TutorialManifest, TutorialState, TutorialStepSnapshot } from '../engine/types';
export type { TutorialManifest } from '../engine/types';
import { DEFAULT_TUTORIAL_STATE } from '../engine/types';
import { TUTORIAL_COMMANDS } from '../engine/systems/TutorialSystem';
import { useGameMode } from './GameModeContext';

type TutorialNextReason = 'manual' | 'auto';

export interface TutorialSessionScope {
    key: string;
    gameId: string | null;
    tutorialId: string | null;
    manifestId: string;
    manifestRevision: number | null;
}

type TutorialSessionScopeInput = {
    gameId?: string | null;
    tutorialId?: string | null;
    manifest?: TutorialManifest | null;
    manifestId?: string | null;
    manifestRevision?: number | null;
};

const normalizeScopePart = (value: string | null | undefined): string | null => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

const encodeScopePart = (value: string | null) => encodeURIComponent(value ?? '');

export const buildTutorialSessionScope = ({
    gameId,
    tutorialId,
    manifest,
    manifestId,
    manifestRevision,
}: TutorialSessionScopeInput): TutorialSessionScope | null => {
    const resolvedManifestId = normalizeScopePart(manifest?.id ?? manifestId);
    if (!resolvedManifestId) return null;

    const resolvedGameId = normalizeScopePart(gameId);
    const resolvedTutorialId = normalizeScopePart(tutorialId) ?? resolvedManifestId;
    const resolvedRevision = Number.isInteger(manifest?.revision)
        ? manifest?.revision ?? null
        : (Number.isInteger(manifestRevision) ? manifestRevision ?? null : null);
    const keyParts = [
        'tutorial-session:v1',
        encodeScopePart(resolvedGameId),
        encodeScopePart(resolvedTutorialId),
        encodeScopePart(resolvedManifestId),
    ];
    if (resolvedRevision !== null) {
        keyParts.push(`r${resolvedRevision}`);
    }

    return {
        key: keyParts.join(':'),
        gameId: resolvedGameId,
        tutorialId: resolvedTutorialId,
        manifestId: resolvedManifestId,
        manifestRevision: resolvedRevision,
    };
};

export const isSameTutorialSessionScope = (
    left: TutorialSessionScope | null | undefined,
    right: TutorialSessionScope | null | undefined,
): boolean => Boolean(left && right && left.key === right.key);

const canUseControllerForSession = (
    sessionScope: TutorialSessionScope | null | undefined,
    controllerScope: TutorialSessionScope | null | undefined,
): boolean => !sessionScope || !controllerScope || isSameTutorialSessionScope(sessionScope, controllerScope);

const shouldExposeTutorialToConsumer = (gameMode: ReturnType<typeof useGameMode>): boolean => (
    !gameMode || gameMode.mode === 'tutorial'
);

type PendingTutorialStart = {
    manifest: TutorialManifest;
    sessionScope: TutorialSessionScope | null;
};

interface TutorialController {
    start: (manifest: TutorialManifest) => void;
    next: (reason?: TutorialNextReason) => void;
    previous: () => void;
    close: () => void;
    consumeAi: (stepId?: string) => void;
    animationComplete: () => void;
    dispatchCommand: (commandType: string, payload?: unknown) => void;
}

interface TutorialContextType {
    tutorial: TutorialState;
    currentStep: TutorialStepSnapshot | null;
    isActive: boolean;
    isLastStep: boolean;
    /** 是否正在等待动画完成 */
    isPendingAnimation: boolean;
    /** AI 命令正在自动执行中（ref，同步可读，此期间命令失败不应提示用户） */
    isAiExecuting: boolean;
    isAiExecutingRef: React.MutableRefObject<boolean>;
    /** Board 组件已挂载并完成 useTutorialBridge 注册（区别于 TutorialDispatchBridge 的提前注册） */
    isBoardMounted: boolean;
    activeSessionScope: TutorialSessionScope | null;
    activateTutorialSession: (scope: TutorialSessionScope | null) => void;
    startTutorial: (manifest: TutorialManifest, scope?: TutorialSessionScope | null) => void;
    nextStep: (reason?: TutorialNextReason) => void;
    previousStep: () => void;
    closeTutorial: (scope?: TutorialSessionScope | null) => void;
    consumeAi: (stepId?: string) => void;
    /** 动画完成回调：通知教程系统动画已播放完毕，可以推进到下一步 */
    animationComplete: () => void;
    bindDispatch: (dispatch: (type: string, payload?: unknown) => void, scope?: TutorialSessionScope | null) => number;
    /** Board 卸载时清理 controller，防止残留的 dispatch 指向已销毁的 Provider */
    unbindDispatch: (generation?: number) => void;
    syncTutorialState: (tutorial: TutorialState, runtimeSyncKey?: string, scope?: TutorialSessionScope | null) => void;
    /** 由 useTutorialBridge 调用，标记 Board 已挂载 */
    notifyBoardMounted: (generation?: number, scope?: TutorialSessionScope | null) => void;
    /** 由 useTutorialBridge 调用，标记 Board 已卸载 */
    notifyBoardUnmounted: (generation?: number, scope?: TutorialSessionScope | null) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

type DispatchFn = (type: string, payload?: unknown) => void;

const buildTutorialController = (dispatch: DispatchFn): TutorialController => {
    const dispatchCommand = (commandType: string, payload?: unknown) => {
        dispatch(commandType, payload ?? {});
    };

    return {
        dispatchCommand,
        start: (manifest) => dispatchCommand(TUTORIAL_COMMANDS.START, { manifest }),
        next: (reason) => dispatchCommand(TUTORIAL_COMMANDS.NEXT, { reason }),
        previous: () => dispatchCommand(TUTORIAL_COMMANDS.PREVIOUS, {}),
        close: () => dispatchCommand(TUTORIAL_COMMANDS.CLOSE, {}),
        consumeAi: (stepId) => dispatchCommand(TUTORIAL_COMMANDS.AI_CONSUMED, { stepId }),
        animationComplete: () => dispatchCommand(TUTORIAL_COMMANDS.ANIMATION_COMPLETE, {}),
    };
};

const hasAiActions = (step: TutorialStepSnapshot): boolean =>
    Array.isArray(step.aiActions) && step.aiActions.length > 0;

const normalizeTutorialState = (nextTutorial: TutorialState): TutorialState => {
    const steps = Array.isArray(nextTutorial.steps) ? nextTutorial.steps : [];
    const derivedStep = nextTutorial.step ?? steps[nextTutorial.stepIndex] ?? null;
    return {
        ...nextTutorial,
        steps,
        step: derivedStep,
    };
};

/**
 * 获取教程总步骤数（兼容传输裁剪后的状态）
 *
 * 传输层会将 steps 清空并写入 totalSteps 字段以减少传输体积。
 */
function getTutorialStepCount(tutorial: TutorialState): number {
    const transportTotal = (tutorial as TutorialState & { totalSteps?: number }).totalSteps;
    if (typeof transportTotal === 'number' && transportTotal > 0) return transportTotal;
    return tutorial.steps?.length ?? 0;
}

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tutorial, setTutorial] = useState<TutorialState>({ ...DEFAULT_TUTORIAL_STATE });
    const [isBoardMounted, setIsBoardMounted] = useState(false);
    const [isControllerReady, setIsControllerReady] = useState(false);
    const isAiExecutingRef = useRef(false);
    const [isAiExecuting, setIsAiExecuting] = useState(false);
    const controllerRef = useRef<TutorialController | null>(null);
    const controllerScopeRef = useRef<TutorialSessionScope | null>(null);
    const [activeSessionScope, setActiveSessionScope] = useState<TutorialSessionScope | null>(null);
    const activeSessionScopeRef = useRef<TutorialSessionScope | null>(null);
    const pendingStartRef = useRef<PendingTutorialStart | null>(null);
    const executedAiStepsRef = useRef<Set<string>>(new Set());
    // 代际计数器：防止旧 Board 的 unbindDispatch 清除新 Board 的 controller
    const bindGenerationRef = useRef(0);
    // Board 挂载代际：防止 CriticalImageGate / StrictMode 的旧 Board 卸载把新 Board 的 mounted 标记清掉
    const boardMountGenerationRef = useRef(0);
    const isBoardMountedRef = useRef(false);
    // 兜底 timer：防止 bindDispatch 永远不执行导致教程卡死
    const fallbackTimerRef = useRef<number | undefined>(undefined);
    // AI 动作 timer 与执行代际：防止旧步骤的自动命令在步骤切换后继续派发
    const aiTimerRef = useRef<number | undefined>(undefined);
    const aiExecutionGenerationRef = useRef(0);
    const latestTutorialStepIdRef = useRef<string | null>(null);
    const boardSyncVersionRef = useRef(0);
    const toast = useToast();
    const toastRef = useRef(toast);
    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const holder = window as Window & {
            __E2E_TEST_MODE__?: boolean;
            __BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?: Record<string, unknown>;
        };
        if (!holder.__E2E_TEST_MODE__) return;
        holder.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__ = {
            isBoardMounted,
            isControllerReady,
            active: tutorial.active,
            manifestId: tutorial.manifestId,
            stepIndex: tutorial.stepIndex,
            stepId: tutorial.step?.id ?? null,
            stepAiActionCount: tutorial.step?.aiActions?.length ?? 0,
            aiActionCount: tutorial.aiActions?.length ?? 0,
        };
    }, [isBoardMounted, isControllerReady, tutorial]);

    const activateTutorialSession = useCallback((scope: TutorialSessionScope | null) => {
        activeSessionScopeRef.current = scope;
        setActiveSessionScope(scope);
    }, []);

    const bindDispatch = useCallback((dispatch: DispatchFn, scope?: TutorialSessionScope | null) => {
        const sessionScope = scope ?? activeSessionScopeRef.current;
        if (
            sessionScope
            && activeSessionScopeRef.current
            && !isSameTutorialSessionScope(sessionScope, activeSessionScopeRef.current)
        ) {
            return 0;
        }
        if (sessionScope) {
            activateTutorialSession(sessionScope);
        }

        // 清除兜底 timer（正常路径：bindDispatch 被调用）
        if (fallbackTimerRef.current !== undefined) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = undefined;
        }
        
        bindGenerationRef.current += 1;
        
        controllerRef.current = buildTutorialController(dispatch);
        controllerScopeRef.current = sessionScope ?? null;
        setIsControllerReady(true);
        if (pendingStartRef.current) {
            const pendingStart = pendingStartRef.current;
            if (canUseControllerForSession(pendingStart.sessionScope, controllerScopeRef.current)) {
                controllerRef.current.start(pendingStart.manifest);
                pendingStartRef.current = null;
                if (fallbackTimerRef.current !== undefined) {
                    window.clearTimeout(fallbackTimerRef.current);
                    fallbackTimerRef.current = undefined;
                }
            }
        }
        return bindGenerationRef.current;
    }, [activateTutorialSession]);

    // unbindDispatch 不再主动清除 controller。
    // 原因：CriticalImageGate / StrictMode / i18n 加载等场景会导致 Board 反复卸载重挂载，
    // 每次卸载都会触发 unbindDispatch，但教程仍在运行中，清除 controller 会导致教程卡死。
    // controller 的生命周期改为：bindDispatch 设置 → closeTutorial 清除。
    // dispatch 函数通过 dispatchRef 间接引用，Board 重挂载时 ref 会自动更新到新的 dispatch。
    const unbindDispatch = useCallback((_generation?: number) => {
        // 不清除 controller — 教程运行期间 controller 需要保持可用
        // controller 内部通过 dispatchRef 间接调用，Board 重挂载后 ref 自动指向新 dispatch
    }, []);

    const notifyBoardMounted = useCallback((generation?: number, scope?: TutorialSessionScope | null) => {
        if (generation !== undefined && generation <= 0) return;
        if (
            scope
            && activeSessionScopeRef.current
            && !isSameTutorialSessionScope(scope, activeSessionScopeRef.current)
        ) {
            return;
        }
        const activeGeneration = generation ?? bindGenerationRef.current;
        boardMountGenerationRef.current = activeGeneration;
        isBoardMountedRef.current = true;
        setIsBoardMounted(true);
        if (pendingStartRef.current && controllerRef.current) {
            const pendingStart = pendingStartRef.current;
            if (canUseControllerForSession(pendingStart.sessionScope, controllerScopeRef.current)) {
                controllerRef.current.start(pendingStart.manifest);
                pendingStartRef.current = null;
                if (fallbackTimerRef.current !== undefined) {
                    window.clearTimeout(fallbackTimerRef.current);
                    fallbackTimerRef.current = undefined;
                }
            }
        }
    }, []);

    const notifyBoardUnmounted = useCallback((generation?: number, scope?: TutorialSessionScope | null) => {
        if (
            scope
            && activeSessionScopeRef.current
            && !isSameTutorialSessionScope(scope, activeSessionScopeRef.current)
        ) {
            return;
        }
        if (
            generation !== undefined
            && boardMountGenerationRef.current !== generation
        ) {
            return;
        }
        boardMountGenerationRef.current = 0;
        isBoardMountedRef.current = false;
        setIsBoardMounted(false);
    }, []);

    const syncTutorialState = useCallback((nextTutorial: TutorialState, _runtimeSyncKey?: string, scope?: TutorialSessionScope | null) => {
        if (scope) {
            if (
                activeSessionScopeRef.current
                && !isSameTutorialSessionScope(scope, activeSessionScopeRef.current)
            ) {
                return;
            }
            activateTutorialSession(scope);
        }

        boardSyncVersionRef.current += 1;
        const normalized = normalizeTutorialState(nextTutorial);
        const nextStepId = normalized.active ? (normalized.step?.id ?? null) : null;
        if (!normalized.active || latestTutorialStepIdRef.current !== nextStepId) {
            aiExecutionGenerationRef.current += 1;
            if (aiTimerRef.current !== undefined) {
                window.clearTimeout(aiTimerRef.current);
                aiTimerRef.current = undefined;
            }
            isAiExecutingRef.current = false;
            setIsAiExecuting(false);
            latestTutorialStepIdRef.current = nextStepId;
        }
        setTutorial(normalized);
        if (!normalized.active) {
            executedAiStepsRef.current = new Set();
            if (!scope || isSameTutorialSessionScope(scope, activeSessionScopeRef.current)) {
                activateTutorialSession(null);
            }
        }
    }, [activateTutorialSession]);

    const startTutorial = useCallback((manifest: TutorialManifest, scope?: TutorialSessionScope | null) => {
        if (scope) {
            activateTutorialSession(scope);
        }
        const sessionScope = scope ?? activeSessionScopeRef.current;

        // 清除旧的兜底 timer
        if (fallbackTimerRef.current !== undefined) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = undefined;
        }
        aiExecutionGenerationRef.current += 1;
        if (aiTimerRef.current !== undefined) {
            window.clearTimeout(aiTimerRef.current);
            aiTimerRef.current = undefined;
        }
        isAiExecutingRef.current = false;
        setIsAiExecuting(false);
        latestTutorialStepIdRef.current = null;
        
        executedAiStepsRef.current = new Set();
        
        // START 只要求命令桥已就绪；真实棋盘挂载只控制浮层显示和 AI 自动动作。
        // 这样 CriticalImageGate 能先看到 playing 状态并完成预加载，不会反过来卡住教程启动。
        if (controllerRef.current && canUseControllerForSession(sessionScope, controllerScopeRef.current)) {
            controllerRef.current.start(manifest);
            pendingStartRef.current = null;
            return;
        }
        
        // Controller 尚未就绪（Board 还没挂载），存入 pendingStartRef
        pendingStartRef.current = { manifest, sessionScope: sessionScope ?? null };
        
        // 兜底机制：10 秒后如果仍未启动，提示用户
        fallbackTimerRef.current = window.setTimeout(() => {
            fallbackTimerRef.current = undefined;
            
            if (
                pendingStartRef.current
                && controllerRef.current
                && canUseControllerForSession(pendingStartRef.current.sessionScope, controllerScopeRef.current)
            ) {
                // controller 在等待期间就绪了，直接启动；浮层/AI 仍等 Board mounted。
                controllerRef.current.start(pendingStartRef.current.manifest);
                pendingStartRef.current = null;
            } else if (pendingStartRef.current) {
                console.error('[TutorialContext] 教程启动超时：Board 未挂载');
                toastRef.current.error('教程加载超时，请刷新页面重试');
            }
        }, 10000);
    }, [activateTutorialSession]);

    const nextStep = useCallback((reason?: TutorialNextReason) => {
        controllerRef.current?.next(reason);
    }, []);

    const previousStep = useCallback(() => {
        controllerRef.current?.previous();
    }, []);

    const closeTutorial = useCallback((scope?: TutorialSessionScope | null) => {
        if (
            scope
            && activeSessionScopeRef.current
            && !isSameTutorialSessionScope(scope, activeSessionScopeRef.current)
        ) {
            return;
        }

        aiExecutionGenerationRef.current += 1;
        if (aiTimerRef.current !== undefined) {
            window.clearTimeout(aiTimerRef.current);
            aiTimerRef.current = undefined;
        }
        isAiExecutingRef.current = false;
        setIsAiExecuting(false);
        latestTutorialStepIdRef.current = null;
        if (canUseControllerForSession(scope ?? activeSessionScopeRef.current, controllerScopeRef.current)) {
            controllerRef.current?.close();
        }
        // 教程关闭时清除 controller（唯一清除点）
        controllerRef.current = null;
        controllerScopeRef.current = null;
        // 清除未消费的 pending start，防止下次 bindDispatch 时误启动旧教程
        pendingStartRef.current = null;
        if (fallbackTimerRef.current !== undefined) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = undefined;
        }
        // 重置教程状态，防止 tutorial.active 残留影响后续在线对局
        setTutorial({ ...DEFAULT_TUTORIAL_STATE });
        setIsControllerReady(false);
        // 重置 Board 挂载标记，防止下次进入教程时残留 true 导致弹窗提前出现
        isBoardMountedRef.current = false;
        setIsBoardMounted(false);
        activateTutorialSession(null);
    }, [activateTutorialSession]);

    const consumeAi = useCallback((stepId?: string) => {
        controllerRef.current?.consumeAi(stepId);
    }, []);

    const animationComplete = useCallback(() => {
        controllerRef.current?.animationComplete();
    }, []);

    // AI 动作执行 effect
    // 使用 ref 管理 timer，避免 tutorial 对象频繁变化导致 timer 被 React effect cleanup 取消
    useEffect(() => {
        if (!tutorial.active || !tutorial.step || !hasAiActions(tutorial.step)) return;
        if (!isControllerReady) return;
        if (!isBoardMounted) return;

        const stepId = tutorial.step.id;
        if (executedAiStepsRef.current.has(stepId)) return;
        executedAiStepsRef.current.add(stepId);

        // 缓存当前步骤的 aiActions，避免闭包引用被清理后的状态
        const aiActions = tutorial.step.aiActions ? [...tutorial.step.aiActions] : [];
        const shouldYieldBetweenAiActions = tutorial.stepIndex !== 0;

        // 使用 ref 管理 timer，不在 cleanup 中取消
        // 这样即使 tutorial 对象变化触发 effect 重新执行，timer 也不会被取消
        if (aiTimerRef.current !== undefined) {
            window.clearTimeout(aiTimerRef.current);
        }

        // 首步（setup）零延迟执行 AI 动作，避免 CriticalImageGate 在 setup 阶段
        // 触发一次预加载后又因 phaseKey 变化触发第二次预加载。
        // 后续步骤保留 1s 延迟，给玩家阅读提示文本的时间。
        const delay = tutorial.step.aiDelayMs ?? (tutorial.stepIndex === 0 ? 0 : 1000);

        aiTimerRef.current = window.setTimeout(() => {
            aiTimerRef.current = undefined;
            const controller = controllerRef.current;
            if (!controller) return;
            const executionGeneration = aiExecutionGenerationRef.current + 1;
            aiExecutionGenerationRef.current = executionGeneration;

            setIsAiExecuting(true);
            isAiExecutingRef.current = true;

            void (async () => {
                let completed = false;
                try {
                    // setup 步骤必须同步完成初始化，避免棋盘挂载与关键图门禁互等。
                    // 后续运行中 AI actions 只在命令之间让出一个状态帧，保证下一条命令
                    // 能读到前一条命令产生的当前交互、待处理伤害等运行态。
                    for (let i = 0; i < aiActions.length; i++) {
                        if (aiExecutionGenerationRef.current !== executionGeneration) return;
                        const action = aiActions[i] as TutorialAiAction;
                        const actionPayload: Record<string, unknown> = {
                            ...(action.payload as Record<string, unknown> ?? {}),
                            __tutorialAiCommand: true,
                        };
                        if (action.playerId) {
                            actionPayload.__tutorialPlayerId = action.playerId;
                        }
                        const beforeBoardSyncVersion = boardSyncVersionRef.current;
                        const liveController = controllerRef.current ?? controller;
                        liveController.dispatchCommand(action.commandType, actionPayload);
                        const isLastAiAction = i === aiActions.length - 1;
                        const mustWaitForBoardSync = (
                            (shouldYieldBetweenAiActions && !isLastAiAction)
                            || action.waitForBoardSyncAfter === true
                        );
                        if (mustWaitForBoardSync) {
                            const didObserveBoardSync = await new Promise<boolean>((resolve) => {
                                const startedAt = Date.now();
                                const poll = () => {
                                    if (aiExecutionGenerationRef.current !== executionGeneration) {
                                        resolve(false);
                                        return;
                                    }
                                    if (boardSyncVersionRef.current > beforeBoardSyncVersion) {
                                        resolve(true);
                                        return;
                                    }
                                    if (Date.now() - startedAt > 1000) {
                                        console.warn('[TutorialContext] AI 命令后未观察到教程签名同步，暂停后续 AI 动作', {
                                            stepId,
                                            commandType: action.commandType,
                                        });
                                        resolve(false);
                                        return;
                                    }
                                    window.setTimeout(poll, 16);
                                };
                                window.setTimeout(poll, 0);
                            });
                            if (!didObserveBoardSync) return;
                        }
                    }
                    completed = true;
                } finally {
                    if (aiExecutionGenerationRef.current === executionGeneration) {
                        isAiExecutingRef.current = false;
                        setIsAiExecuting(false);
                    }
                }

                if (!completed || aiExecutionGenerationRef.current !== executionGeneration) return;

                // 始终调用 consumeAi 清除 aiActions（防止 effect 重复触发）。
                // 自动 AI 步骤是否推进下一步由 TutorialSystem 在同一命令里裁定，
                // 避免 React 再发一个 NEXT 命令时读到过期本地状态。
                controller.consumeAi(stepId);
            })();
        }, delay);

        // 不返回 cleanup 函数 — timer 通过 aiTimerRef 管理
        // 只在新步骤的 AI actions 需要执行时才清除旧 timer
    }, [tutorial, isControllerReady, isBoardMounted]);

    const value = useMemo<TutorialContextType>(() => {
        const currentStep = tutorial.step ?? tutorial.steps[tutorial.stepIndex] ?? null;
        const stepCount = getTutorialStepCount(tutorial);
        return {
            tutorial,
            currentStep,
            isActive: tutorial.active,
            isLastStep: tutorial.active && tutorial.stepIndex >= stepCount - 1,
            isPendingAnimation: tutorial.active && !!tutorial.pendingAnimationAdvance,
            isAiExecuting,
            isAiExecutingRef,
            isBoardMounted,
            activeSessionScope,
            activateTutorialSession,
            startTutorial,
            nextStep,
            previousStep,
            closeTutorial,
            consumeAi,
            animationComplete,
            bindDispatch,
            unbindDispatch,
            syncTutorialState,
            notifyBoardMounted,
            notifyBoardUnmounted,
        };
    }, [tutorial, isAiExecuting, isBoardMounted, activeSessionScope, activateTutorialSession, bindDispatch, unbindDispatch, closeTutorial, consumeAi, animationComplete, nextStep, previousStep, startTutorial, syncTutorialState, notifyBoardMounted, notifyBoardUnmounted]);

    return (
        <TutorialContext.Provider value={value}>
            {children}
        </TutorialContext.Provider>
    );
};

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    const gameMode = useGameMode();
    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    if (shouldExposeTutorialToConsumer(gameMode)) {
        return context;
    }

    return {
        ...context,
        tutorial: { ...DEFAULT_TUTORIAL_STATE },
        currentStep: null,
        isActive: false,
        isLastStep: false,
        isPendingAnimation: false,
        isAiExecuting: false,
        isBoardMounted: false,
        activeSessionScope: null,
    };
};

export const useTutorialBridge = (
    tutorial: TutorialState,
    dispatch: (type: string, payload?: unknown) => void,
    runtimeSyncKey?: string,
    sessionScope?: TutorialSessionScope | null,
) => {
    const context = useContext(TutorialContext);
    const gameMode = useGameMode();
    const isTutorialMode = gameMode?.mode === 'tutorial';
    const effectiveSessionScope = sessionScope ?? context?.activeSessionScope ?? null;
    const lastSyncSignatureRef = useRef<string | null>(null);
    // 用 ref 保持最新的 context 和 dispatch，供挂载时的 effect 使用
    const contextRef = useRef(context);
    const dispatchRef = useRef(dispatch);
    useEffect(() => {
        contextRef.current = context;
    }, [context]);
    useEffect(() => {
        dispatchRef.current = dispatch;
    }, [dispatch]);

    useEffect(() => {
        if (!context) return;
        // 只在教程模式下同步状态，防止在线对局的 sys.tutorial 污染 TutorialContext
        if (!isTutorialMode) return;
        if (!tutorial) return;
        if (context.tutorial.active && !tutorial?.active && !context.isLastStep) {
            return;
        }
        const signature = `${tutorial.active}-${tutorial.stepIndex}-${tutorial.step?.id ?? ''}-${getTutorialStepCount(tutorial)}-${tutorial.aiActions?.length ?? 0}-${tutorial.pendingAnimationAdvance ?? false}-${runtimeSyncKey ?? ''}-${effectiveSessionScope?.key ?? ''}`;
        if (lastSyncSignatureRef.current === signature) return;
        lastSyncSignatureRef.current = signature;
        context.syncTutorialState(tutorial, runtimeSyncKey, effectiveSessionScope);
    }, [context, tutorial, isTutorialMode, runtimeSyncKey, effectiveSessionScope]);

    useEffect(() => {
        // 只在教程模式下注册 controller，在线/本地模式的 Board 不应污染教程状态
        if (!isTutorialMode) return;
        // bindDispatch 返回代际号，cleanup 时传入以防止旧 Board 误清新 Board 的 controller
        const gen = contextRef.current?.bindDispatch((...args) => dispatchRef.current(...args), effectiveSessionScope);
        // 通知 TutorialContext Board 已挂载
        contextRef.current?.notifyBoardMounted(gen, effectiveSessionScope);
        return () => {
            contextRef.current?.unbindDispatch(gen);
            contextRef.current?.notifyBoardUnmounted(gen, effectiveSessionScope);
        };
    }, [isTutorialMode, effectiveSessionScope]);
};
