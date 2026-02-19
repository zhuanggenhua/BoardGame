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
    bindDispatch: (dispatch: (type: string, payload?: unknown) => void) => number;
    /** Board 卸载时清理 controller，防止残留的 dispatch 指向已销毁的 Provider */
    unbindDispatch: (generation?: number) => void;
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
    // 代际计数器：防止旧 Board 的 unbindDispatch 清除新 Board 的 controller
    const bindGenerationRef = useRef(0);
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
        
        bindGenerationRef.current += 1;
        
        controllerRef.current = buildTutorialController(dispatch);
        setIsControllerReady(true);
        if (pendingStartRef.current) {
            controllerRef.current.start(pendingStartRef.current);
            pendingStartRef.current = null;
        }
        return bindGenerationRef.current;
    }, []);

    // unbindDispatch 不再主动清除 controller。
    // 原因：CriticalImageGate / StrictMode / i18n 加载等场景会导致 Board 反复卸载重挂载，
    // 每次卸载都会触发 unbindDispatch，但教程仍在运行中，清除 controller 会导致教程卡死。
    // controller 的生命周期改为：bindDispatch 设置 → closeTutorial 清除。
    // dispatch 函数通过 dispatchRef 间接引用，Board 重挂载时 ref 会自动更新到新的 dispatch。
    const unbindDispatch = useCallback((_generation?: number) => {
        // 不清除 controller — 教程运行期间 controller 需要保持可用
        // controller 内部通过 dispatchRef 间接调用，Board 重挂载后 ref 自动指向新 dispatch
    }, []);

    const syncTutorialState = useCallback((nextTutorial: TutorialState) => {
        const normalized = normalizeTutorialState(nextTutorial);
        setTutorial(normalized);
        if (!normalized.active) {
            executedAiStepsRef.current = new Set();
        }
    }, []);

    const startTutorial = useCallback((manifest: TutorialManifest) => {
        // 清除旧的兜底 timer
        if (fallbackTimerRef.current !== undefined) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = undefined;
        }
        
        executedAiStepsRef.current = new Set();
        
        // 如果 controller 已就绪（Board 已挂载且 bindDispatch 已执行），直接启动。
        if (controllerRef.current) {
            controllerRef.current.start(manifest);
            pendingStartRef.current = null;
            return;
        }
        
        // Controller 尚未就绪（Board 还没挂载），存入 pendingStartRef
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
        // 教程关闭时清除 controller（唯一清除点）
        controllerRef.current = null;
        // 清除未消费的 pending start，防止下次 bindDispatch 时误启动旧教程
        pendingStartRef.current = null;
        if (fallbackTimerRef.current !== undefined) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = undefined;
        }
        // 重置教程状态，防止 tutorial.active 残留影响后续在线对局
        setTutorial({ ...DEFAULT_TUTORIAL_STATE });
        setIsControllerReady(false);
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

            // 逐个执行 AI actions
            for (let i = 0; i < aiActions.length; i++) {
                const action = aiActions[i] as TutorialAiAction;
                const actionPayload: Record<string, unknown> = {
                    ...(action.payload as Record<string, unknown> ?? {}),
                    __tutorialAiCommand: true,
                };
                if (action.playerId) {
                    actionPayload.__tutorialPlayerId = action.playerId;
                }
                controller.dispatchCommand(action.commandType, actionPayload);
            }

            isAiExecutingRef.current = false;
            setIsAiExecuting(false);

            // 始终调用 consumeAi 清除 aiActions（防止 effect 重复触发）
            // 但只在全部成功时才自动推进
            controller.consumeAi(stepId);

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
    const gameMode = useGameMode();
    const isTutorialMode = gameMode?.mode === 'tutorial';
    const lastSyncSignatureRef = useRef<string | null>(null);
    // 用 ref 保持最新的 context 和 dispatch，供挂载时的 effect 使用
    const contextRef = useRef(context);
    const dispatchRef = useRef(dispatch);
    contextRef.current = context;
    dispatchRef.current = dispatch;

    useEffect(() => {
        if (!context) return;
        // 只在教程模式下同步状态，防止在线对局的 sys.tutorial 污染 TutorialContext
        if (!isTutorialMode) return;
        const signature = `${tutorial.active}-${tutorial.stepIndex}-${tutorial.step?.id ?? ''}-${getTutorialStepCount(tutorial)}-${tutorial.aiActions?.length ?? 0}-${tutorial.pendingAnimationAdvance ?? false}`;
        if (lastSyncSignatureRef.current === signature) return;
        lastSyncSignatureRef.current = signature;
        context.syncTutorialState(tutorial);
    }, [context, tutorial, isTutorialMode]);

    useEffect(() => {
        // 只在教程模式下注册 controller，在线/本地模式的 Board 不应污染教程状态
        if (!isTutorialMode) return;
        // bindDispatch 返回代际号，cleanup 时传入以防止旧 Board 误清新 Board 的 controller
        const gen = contextRef.current?.bindDispatch((...args) => dispatchRef.current(...args));
        return () => {
            contextRef.current?.unbindDispatch(gen);
        };
    }, [isTutorialMode]);  
};
