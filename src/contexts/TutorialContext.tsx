import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// --- 类型定义 ---
export interface TutorialStep {
    id: string;
    content: string;
    // 要高亮的目标元素（通过 data-tutorial-id 或 id 指定）
    highlightTarget?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';

    // 如果为 true，则隐藏“下一步”按钮，等待外部触发（例如：玩家执行了一次移动）
    requireAction?: boolean;

    // AI 对手的自动行动（格子索引）。设置后，AI 将在延迟后自动执行此操作。
    aiMove?: number;

    // 是否为此步骤显示黑色遮罩背景（默认：false/透明）
    showMask?: boolean;
}

export interface TutorialManifest {
    id: string;
    steps: TutorialStep[];
}

interface TutorialContextType {
    isActive: boolean;
    currentStepIndex: number;
    currentStep: TutorialStep | null;
    isLastStep: boolean;
    startTutorial: (manifest?: TutorialManifest) => void;
    nextStep: () => void;
    closeTutorial: () => void;
    // 执行游戏移动的回调函数（由 Board 组件提供）
    registerMoveCallback: (callback: (cellId: number) => void) => void;
}

// --- 上下文 (Context) ---
const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isActive, setIsActive] = useState(false);
    const [manifest, setManifest] = useState<TutorialManifest | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const moveCallbackRef = useRef<((cellId: number) => void) | null>(null);
    const executedAiStepsRef = useRef<Set<number>>(new Set());

    const registerMoveCallback = useCallback((callback: (cellId: number) => void) => {
        moveCallbackRef.current = callback;
    }, []);


    // --- 默认井字棋配置（临时方案） ---
    // 在正式应用中，我们会根据 gameId 动态获取，但目前我们先硬编码或直接导入。
    // 这里定义一个简单的默认值以确保按钮可用。
    const DEFAULT_MANIFEST: TutorialManifest = {
        id: 'tictactoe-basics',
        steps: [
            { id: 'welcome', content: 'default.welcome', position: 'center' },
            { id: 'grid', content: 'default.grid', highlightTarget: 'board-grid', position: 'top', requireAction: false },
            // More steps would go here
        ]
    };

    const startTutorial = useCallback((newManifest?: TutorialManifest) => {
        setManifest(newManifest || DEFAULT_MANIFEST);
        setCurrentStepIndex(0);
        executedAiStepsRef.current = new Set();
        setIsActive(true);
    }, []);


    const closeTutorial = useCallback(() => {
        setIsActive(false);
        setManifest(null);
        setCurrentStepIndex(0);
        executedAiStepsRef.current = new Set();
    }, []);

    const nextStep = useCallback(() => {
        if (!manifest) return;

        if (currentStepIndex < manifest.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            closeTutorial(); // 完成教学
        }
    }, [manifest, currentStepIndex, closeTutorial]);

    // 当进入带有 aiMove 的步骤时，执行 AI 行动
    useEffect(() => {
        if (!isActive || !manifest) return;

        const currentStep = manifest.steps[currentStepIndex];

        const moveCallback = moveCallbackRef.current;

        if (currentStep.aiMove !== undefined && moveCallback) {
            if (executedAiStepsRef.current.has(currentStepIndex)) return;
            executedAiStepsRef.current.add(currentStepIndex);

            let advanceTimer: number | undefined;

            const moveTimer = window.setTimeout(() => {
                moveCallback(currentStep.aiMove!);

                advanceTimer = window.setTimeout(() => {
                    if (currentStepIndex < manifest.steps.length - 1) {
                        setCurrentStepIndex(prev => (prev === currentStepIndex ? prev + 1 : prev));
                    }
                }, 500);
            }, 1000);

            return () => {
                window.clearTimeout(moveTimer);
                if (advanceTimer !== undefined) window.clearTimeout(advanceTimer);
            };
        }
    }, [isActive, currentStepIndex, manifest]);

    const value: TutorialContextType = {
        isActive,
        currentStepIndex,
        currentStep: manifest ? manifest.steps[currentStepIndex] : null,
        isLastStep: Boolean(manifest && currentStepIndex >= manifest.steps.length - 1),
        startTutorial,
        nextStep,
        closeTutorial,
        registerMoveCallback,
    };

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
