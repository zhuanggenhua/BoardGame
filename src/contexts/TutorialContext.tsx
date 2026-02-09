import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { TutorialAiAction, TutorialManifest, TutorialState, TutorialStepSnapshot } from '../engine/types';
export type { TutorialManifest } from '../engine/types';
import { DEFAULT_TUTORIAL_STATE } from '../engine/types';
import { TUTORIAL_COMMANDS } from '../engine/systems/TutorialSystem';

const isDev = import.meta.env.DEV;
const warnDev = (...args: unknown[]) => {
    if (isDev) {
        console.warn(...args);
    }
};

type TutorialNextReason = 'manual' | 'auto';

interface TutorialController {
    start: (manifest: TutorialManifest) => void;
    next: (reason?: TutorialNextReason) => void;
    close: () => void;
    consumeAi: (stepId?: string) => void;
    dispatchCommand: (commandType: string, payload?: unknown) => void;
}

interface TutorialContextType {
    tutorial: TutorialState;
    currentStep: TutorialStepSnapshot | null;
    isActive: boolean;
    isLastStep: boolean;
    startTutorial: (manifest: TutorialManifest) => void;
    nextStep: (reason?: TutorialNextReason) => void;
    closeTutorial: () => void;
    consumeAi: (stepId?: string) => void;
    bindMoves: (moves: Record<string, unknown>) => void;
    syncTutorialState: (tutorial: TutorialState) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const buildTutorialController = (moves: Record<string, unknown>): TutorialController => {
    const dispatchCommand = (commandType: string, payload?: unknown) => {
        const move = moves[commandType] as ((value: unknown) => void) | undefined;
        if (typeof move === 'function') {
            move(payload ?? {});
        }
    };

    return {
        dispatchCommand,
        start: (manifest) => dispatchCommand(TUTORIAL_COMMANDS.START, { manifest }),
        next: (reason) => dispatchCommand(TUTORIAL_COMMANDS.NEXT, { reason }),
        close: () => dispatchCommand(TUTORIAL_COMMANDS.CLOSE, {}),
        consumeAi: (stepId) => dispatchCommand(TUTORIAL_COMMANDS.AI_CONSUMED, { stepId }),
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

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tutorial, setTutorial] = useState<TutorialState>({ ...DEFAULT_TUTORIAL_STATE });
    const [isControllerReady, setIsControllerReady] = useState(false);
    const controllerRef = useRef<TutorialController | null>(null);
    const pendingStartRef = useRef<TutorialManifest | null>(null);
    const executedAiStepsRef = useRef<Set<string>>(new Set());

    const bindMoves = useCallback((moves: Record<string, unknown>) => {
        controllerRef.current = buildTutorialController(moves);
        setIsControllerReady(true);
        if (pendingStartRef.current) {
            controllerRef.current.start(pendingStartRef.current);
            pendingStartRef.current = null;
        }
    }, []);

    const syncTutorialState = useCallback((nextTutorial: TutorialState) => {
        const normalized = normalizeTutorialState(nextTutorial);
        setTutorial(normalized);
        if (!normalized.active) {
            executedAiStepsRef.current = new Set();
        }
    }, []);

    const startTutorial = useCallback((manifest: TutorialManifest) => {
        if (!controllerRef.current) {
            pendingStartRef.current = manifest;
            return;
        }
        controllerRef.current.start(manifest);
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

    // AI 动作执行 effect
    // 使用 ref 管理 timer，避免 tutorial 对象频繁变化导致 timer 被 React effect cleanup 取消
    const aiTimerRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        warnDev('[TutorialContext] AI effect check:', {
            active: tutorial.active,
            hasStep: !!tutorial.step,
            stepId: tutorial.step?.id,
            hasAi: tutorial.step ? hasAiActions(tutorial.step) : false,
            isControllerReady,
            executedSteps: [...executedAiStepsRef.current],
        });
        if (!tutorial.active || !tutorial.step || !hasAiActions(tutorial.step)) return;
        if (!isControllerReady) return;

        const stepId = tutorial.step.id;
        if (executedAiStepsRef.current.has(stepId)) return;
        executedAiStepsRef.current.add(stepId);
        warnDev('[TutorialContext] AI effect: scheduling aiActions for step', stepId);

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
            if (!controller) {
                warnDev('[TutorialContext] AI timer fired but controller is null!');
                return;
            }
            warnDev('[TutorialContext] AI timer fired, dispatching', aiActions.length, 'actions for step', stepId);

            aiActions.forEach((action: TutorialAiAction) => {
                // 如果 aiAction 指定了 playerId，注入到 payload 中供 adapter 使用
                const actionPayload = action.playerId
                    ? { ...(action.payload as Record<string, unknown> ?? {}), __tutorialPlayerId: action.playerId }
                    : action.payload;
                controller.dispatchCommand(action.commandType, actionPayload);
            });
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
        return {
            tutorial,
            currentStep,
            isActive: tutorial.active,
            isLastStep: tutorial.active && tutorial.stepIndex >= tutorial.steps.length - 1,
            startTutorial,
            nextStep,
            closeTutorial,
            consumeAi,
            bindMoves,
            syncTutorialState,
        };
    }, [tutorial, bindMoves, closeTutorial, consumeAi, nextStep, startTutorial, syncTutorialState]);

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

export const useTutorialBridge = (tutorial: TutorialState, moves: Record<string, unknown>) => {
    const context = useContext(TutorialContext);
    const lastSyncSignatureRef = useRef<string | null>(null);
    useEffect(() => {
        if (!context) return;
        const signature = `${tutorial.active}-${tutorial.stepIndex}-${tutorial.step?.id ?? ''}-${tutorial.steps?.length ?? 0}-${tutorial.aiActions?.length ?? 0}`;
        if (lastSyncSignatureRef.current === signature) return;
        if (lastSyncSignatureRef.current !== null) {
            const prev = lastSyncSignatureRef.current.split('-');
            const curr = signature.split('-');
            if (prev[1] !== curr[1] || prev[2] !== curr[2]) {
                warnDev(
                    `[useTutorialBridge] tutorial state changed from stepIndex=${prev[1]} stepId=${prev[2]} to stepIndex=${curr[1]} stepId=${curr[2]}`
                );
            }
            // 追踪 active 变化
            if (prev[0] !== curr[0]) {
                warnDev(`[useTutorialBridge] tutorial active changed from ${prev[0]} to ${curr[0]}`);
            }
        }
        lastSyncSignatureRef.current = signature;
        context.syncTutorialState(tutorial);
    }, [context, tutorial]);
    useEffect(() => {
        context?.bindMoves(moves);
    }, [context, moves]);
};
