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

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tutorial, setTutorial] = useState<TutorialState>({ ...DEFAULT_TUTORIAL_STATE });
    const controllerRef = useRef<TutorialController | null>(null);
    const pendingStartRef = useRef<TutorialManifest | null>(null);
    const executedAiStepsRef = useRef<Set<string>>(new Set());

    const bindMoves = useCallback((moves: Record<string, unknown>) => {
        controllerRef.current = buildTutorialController(moves);
        if (pendingStartRef.current) {
            controllerRef.current.start(pendingStartRef.current);
            pendingStartRef.current = null;
        }
    }, []);

    const syncTutorialState = useCallback((nextTutorial: TutorialState) => {
        setTutorial(nextTutorial);
        if (!nextTutorial.active) {
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

    useEffect(() => {
        if (!tutorial.active || !tutorial.step || !hasAiActions(tutorial.step)) return;

        const stepId = tutorial.step.id;
        if (executedAiStepsRef.current.has(stepId)) return;
        executedAiStepsRef.current.add(stepId);

        let moveTimer: number | undefined;
        let advanceTimer: number | undefined;
        let cancelled = false;

        moveTimer = window.setTimeout(() => {
            if (cancelled) return;
            const controller = controllerRef.current;
            if (!controller) return;

            tutorial.step?.aiActions?.forEach((action: TutorialAiAction) => {
                controller.dispatchCommand(action.commandType, action.payload);
            });
            controller.consumeAi(stepId);

            if (tutorial.step && shouldAutoAdvance(tutorial.step)) {
                advanceTimer = window.setTimeout(() => controller.next('auto'), 500);
            }
        }, 1000);

        return () => {
            cancelled = true;
            if (moveTimer !== undefined) window.clearTimeout(moveTimer);
            if (advanceTimer !== undefined) window.clearTimeout(advanceTimer);
        };
    }, [tutorial]);

    const value = useMemo<TutorialContextType>(() => {
        const currentStep = tutorial.step ?? null;
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
        const signature = `${tutorial.active}-${tutorial.stepIndex}-${tutorial.step?.id ?? ''}-${tutorial.steps?.length ?? 0}`;
        if (lastSyncSignatureRef.current === signature) return;
        lastSyncSignatureRef.current = signature;
        context.syncTutorialState(tutorial);
    }, [context, tutorial]);
    useEffect(() => {
        context?.bindMoves(moves);
    }, [context, moves]);
};
