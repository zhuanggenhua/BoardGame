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

type TutorialNextReason = 'manual' | 'auto';

interface TutorialController {
    start: (manifest: TutorialManifest) => void;
    next: (reason?: TutorialNextReason) => void;
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
    startTutorial: (manifest: TutorialManifest) => void;
    nextStep: (reason?: TutorialNextReason) => void;
    closeTutorial: () => void;
    consumeAi: (stepId?: string) => void;
    /** 动画完成回调：通知教程系统动画已播放完毕，可以推进到下一步 */
    animationComplete: () => void;
    bindDispatch: (dispatch: (type: string, payload?: unknown) => void) => void;
    /** Board 卸载时清理 controller，防止残留的 dispatch 指向已销毁的 Provider */
    unbindDispatch: () => void;
    syncTutorialState: (tutorial: TutorialState) => void;
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
        close: () => dispatchCommand(TUTORIAL_COMMANDS.CLOSE, {}),
        consumeAi: (stepId) => dispatchCommand(TUTORIAL_COMMANDS.AI_CONSUMED, { stepId }),
        animationComplete: () => dispatchCommand(TUTORIAL_COMMANDS.ANIMATION_COMPLETE, {}),
    };
};

const shouldAutoAdvance = (step: TutorialStepSnapshot): boolean => {
    if (!step.advanceOnEvents) return true;
    return step.advanceOnEvents.length === 0;
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
    const [isControllerReady, setIsControllerReady] = useState(false);
    const isAiExecutingRef = useRef(false);
    const [isAiExecuting, setIsAiExecuting] = useState(false);
    const controllerRef = useRef<TutorialController | null>(null);
    const pendingStartRef = useRef<TutorialManifest | null>(null);
    const executedAiStepsRef = useRef<Set<string>>(new Set());
    // 兜底 timer：防止 bindDispatch 永远不执行导致教程卡死
    const fallbackTimerRef = useRef<number | undefined>(undefined);
    const toast = useToast();
    const toastRef = useRef(toast);
    toastRef.current = toast;

    const bindDispatch = useCallback((dispatch: DispatchFn) => {
        // 清除兜底 timer（正常路径：bindDispatch 被调用）
        if (fallbackTimerRef.current !== undefined) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = undefined;
        }
        
        controllerRef.current = buildTutorialController(dispatch);
        setIsControllerReady(true);
        const hasPending = !!pendingStartRef.current;
        console.warn('[TutorialContext] bindDispatch:', { hasPending, pendingId: pendingStartRef.current?.id });
        if (pendingStartRef.current) {
            controllerRef.current.start(pendingStartRef.current);
            pendingStartRef.current = null;
        }
    }, []);

    const unbindDispatch = useCallback(() => {
        controllerRef.current = null;
        setIsControllerReady(false);
    }, []);

    const syncTutorialState = useCallback((nextTutorial: TutorialState) => {
        const normalized = normalizeTutorialState(nextTutorial);
        setTutorial(normalized);
        if (!normalized.active) {
            executedAiStepsRef.current = new Set();
        }
    }, []);

    const startTutorial = useCallback((manifest: TutorialManifest) => {
        // 防重入：如果已经有 pending 的 manifest，且是同一个，跳过
        if (pendingStartRef.current?.id === manifest.id) {
            return;
        }
        
        // 清除旧的兜底 timer
        if (fallbackTimerRef.current !== undefined) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = undefined;
        }
        
        executedAiStepsRef.current = new Set();
        
        // 如果 controller 已就绪（Board 已挂载且 bindDispatch 已执行），直接启动。
        // 这是最常见的路径：namespace 加载完成 → Board 挂载 → bindDispatch → MatchRoom effect 调用 startTutorial。
        if (controllerRef.current) {
            controllerRef.current.start(manifest);
            pendingStartRef.current = null;
            return;
        }
        
        // Controller 尚未就绪（Board 还没挂载），存入 pendingStartRef，
        // 等 Board 挂载时 bindDispatch 消费。
        pendingStartRef.current = manifest;
        
        // 兜底机制：10 秒后如果仍未启动，提示用户
        fallbackTimerRef.current = window.setTimeout(() => {
            fallbackTimerRef.current = undefined;
            
            if (pendingStartRef.current && controllerRef.current) {
                // controller 在等待期间就绪了，直接启动
                controllerRef.current.start(pendingStartRef.current);
                pendingStartRef.current = null;
            } else if (pendingStartRef.current) {
                console.error('[TutorialContext] 教程启动超时：Board 未挂载');
                toastRef.current.error('教程加载超时，请刷新页面重试');
            }
        }, 10000);
    }, []);

    const nextStep = useCallback((reason?: TutorialNextReason) => {
        controllerRef.current?.next(reason);
    }, []);

    const closeTutorial = useCallback(() => {
        controllerRef.current?.close();
    }, []);

    const consumeAi = useCallback((stepId?: string) => {
        controllerRef.current?.consumeAi(stepId);
    }, []);

    const animationComplete = useCallback(() => {
        controllerRef.current?.animationComplete();
    }, []);

    // AI 动作执行 effect
    // 使用 ref 管理 timer，避免 tutorial 对象频繁变化导致 timer 被 React effect cleanup 取消
    const aiTimerRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!tutorial.active || !tutorial.step || !hasAiActions(tutorial.step)) return;
        if (!isControllerReady) return;

        const stepId = tutorial.step.id;
        if (executedAiStepsRef.current.has(stepId)) return;
        executedAiStepsRef.current.add(stepId);

        // 缓存当前步骤的 autoAdvance 判断和 aiActions，避免闭包引用被清理后的状态
        const shouldAutoAdvanceAfterAi = shouldAutoAdvance(tutorial.step);
        const aiActions = tutorial.step.aiActions ? [...tutorial.step.aiActions] : [];

        // 使用 ref 管理 timer，不在 cleanup 中取消
        // 这样即使 tutorial 对象变化触发 effect 重新执行，timer 也不会被取消
        if (aiTimerRef.current !== undefined) {
            window.clearTimeout(aiTimerRef.current);
        }

        // setup 步骤（首步）使用更短延迟，加速教程初始化
        const delay = tutorial.stepIndex === 0 ? 300 : 1000;

        aiTimerRef.current = window.setTimeout(() => {
            aiTimerRef.current = undefined;
            const controller = controllerRef.current;
            if (!controller) return;

            setIsAiExecuting(true);
            isAiExecutingRef.current = true;
            aiActions.forEach((action: TutorialAiAction) => {
                // 注入 __tutorialAiCommand 标记，让 LocalGameProvider 在命令失败时静默
                // 同时注入 __tutorialPlayerId 供 adapter 识别 AI 执行者
                const actionPayload: Record<string, unknown> = {
                    ...(action.payload as Record<string, unknown> ?? {}),
                    __tutorialAiCommand: true,
                };
                if (action.playerId) {
                    actionPayload.__tutorialPlayerId = action.playerId;
                }
                controller.dispatchCommand(action.commandType, actionPayload);
            });
            isAiExecutingRef.current = false;
            setIsAiExecuting(false);
            controller.consumeAi(stepId);

            // 同步调用 next，避免 consumeAi 触发状态更新后 effect 清理导致 advanceTimer 被取消
            if (shouldAutoAdvanceAfterAi) {
                controller.next('auto');
            }
        }, delay);

        // 不返回 cleanup 函数 — timer 通过 aiTimerRef 管理
        // 只在新步骤的 AI actions 需要执行时才清除旧 timer
    }, [tutorial, isControllerReady]);

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
            startTutorial,
            nextStep,
            closeTutorial,
            consumeAi,
            animationComplete,
            bindDispatch,
            unbindDispatch,
            syncTutorialState,
        };
    }, [tutorial, isAiExecuting, bindDispatch, unbindDispatch, closeTutorial, consumeAi, animationComplete, nextStep, startTutorial, syncTutorialState]);

    return (
        <TutorialContext.Provider value={value}>
            {children}
        </TutorialContext.Provider>
    );
};

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
};

export const useTutorialBridge = (tutorial: TutorialState, dispatch: (type: string, payload?: unknown) => void) => {
    const context = useContext(TutorialContext);
    const lastSyncSignatureRef = useRef<string | null>(null);
    // 用 ref 保持最新的 context 和 dispatch，供挂载时的 effect 使用
    const contextRef = useRef(context);
    const dispatchRef = useRef(dispatch);
    contextRef.current = context;
    dispatchRef.current = dispatch;

    useEffect(() => {
        if (!context) return;
        const signature = `${tutorial.active}-${tutorial.stepIndex}-${tutorial.step?.id ?? ''}-${getTutorialStepCount(tutorial)}-${tutorial.aiActions?.length ?? 0}-${tutorial.pendingAnimationAdvance ?? false}`;
        if (lastSyncSignatureRef.current === signature) return;
        lastSyncSignatureRef.current = signature;
        context.syncTutorialState(tutorial);
    }, [context, tutorial]);

    useEffect(() => {
        contextRef.current?.bindDispatch((...args) => dispatchRef.current(...args));
        return () => {
            // Board 卸载时清理 controller，防止残留 dispatch 指向已销毁的 Provider
            contextRef.current?.unbindDispatch();
        };
    }, []);  
};
