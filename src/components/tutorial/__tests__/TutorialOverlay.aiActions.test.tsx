import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialOverlay } from '../TutorialOverlay';
import type { TutorialStepSnapshot } from '../../../engine/types';

const useTutorialMock = vi.hoisted(() => vi.fn());
const preloadKeysMock = vi.hoisted(() => vi.fn());
const playSoundMock = vi.hoisted(() => vi.fn());

vi.mock('../../../contexts/TutorialContext', () => ({
    useTutorial: useTutorialMock,
}));

vi.mock('../../../lib/audio/AudioManager', () => ({
    AudioManager: {
        preloadKeys: preloadKeysMock,
    },
}));

vi.mock('../../../lib/audio/useGameAudio', () => ({
    playSound: playSoundMock,
}));

vi.mock('../../common/media/OptimizedImage', () => ({
    OptimizedImage: ({ src, alt, className }: { src: string; alt?: string; className?: string }) => (
        <img src={src} alt={alt} className={className} />
    ),
}));

vi.mock('../../../hooks/ui/useRuntimeViewport', () => ({
    useRuntimeViewport: () => ({
        width: 1280,
        height: 720,
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const renderWithStep = (
    step: TutorialStepSnapshot,
    options: { stepIndex?: number; isLastStep?: boolean; steps?: TutorialStepSnapshot[] } = {},
) => {
    const nextStep = vi.fn();
    const previousStep = vi.fn();
    const stepIndex = options.stepIndex ?? 0;
    const steps = options.steps ?? (
        stepIndex > 0
            ? [{ id: 'intro', content: 'tutorial.intro' }, step]
            : [step]
    );
    useTutorialMock.mockReturnValue({
        isActive: true,
        currentStep: step,
        nextStep,
        previousStep,
        isLastStep: options.isLastStep ?? false,
        tutorial: {
            active: true,
            stepIndex,
            steps,
            skippedStepIds: [],
        },
    });

    return {
        ...render(<TutorialOverlay />),
        nextStep,
        previousStep,
    };
};

describe('TutorialOverlay aiActions visibility', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('显示带 aiActions 但仍需要当前玩家操作的教程步骤', () => {
        renderWithStep({
            id: 'confirm-after-ai-assist',
            content: 'tutorial.confirmAfterAiAssist',
            requireAction: true,
            aiActions: [{ commandType: 'OTHER_PLAYER_CONFIRM' }],
        });

        expect(
            document.querySelector('[data-tutorial-step="confirm-after-ai-assist"]'),
        ).not.toBeNull();
        expect(screen.getByTestId('tutorial-overlay-card')).toBeTruthy();
        expect(screen.getByTestId('tutorial-action-hint')).toBeTruthy();
        expect(screen.queryByTestId('tutorial-next-button')).toBeNull();
    });

    it('仍隐藏没有玩家操作或阅读职责的纯自动 AI 步骤', () => {
        renderWithStep({
            id: 'pure-ai-step',
            content: 'tutorial.pureAiStep',
            aiActions: [{ commandType: 'AI_MOVE' }],
        });

        expect(document.querySelector('[data-tutorial-step="pure-ai-step"]')).toBeNull();
        expect(screen.queryByTestId('tutorial-overlay-card')).toBeNull();
    });

    it('显示教程步骤绑定的真实图片图例', () => {
        renderWithStep({
            id: 'visual-step',
            content: 'game-mage-wars:tutorial.steps.spellCardReading',
            infoStep: true,
            visual: {
                src: 'mage-wars/references/spell-card-legend',
                alt: 'game-mage-wars:tutorial.visuals.spellCardLegendAlt',
                caption: 'game-mage-wars:tutorial.visuals.spellCardLegendCaption',
            },
        });

        expect(screen.getByTestId('tutorial-overlay-card')).toBeTruthy();
        expect(screen.getByTestId('tutorial-overlay-visual')).toBeTruthy();
        const legend = screen.getByAltText('game-mage-wars:tutorial.visuals.spellCardLegendAlt') as HTMLImageElement;
        expect(legend.getAttribute('src')).toBe('mage-wars/references/spell-card-legend');
        expect(screen.getByTestId('tutorial-overlay-visual-caption').textContent)
            .toBe('game-mage-wars:tutorial.visuals.spellCardLegendCaption');
    });

    it('高亮目标暂时缺失时仍显示教程提示卡，避免恢复态无提示', () => {
        renderWithStep({
            id: 'dog-confirm-waiting',
            content: 'game-betrayal:tutorial.mainPath.steps.watchTeammateTwoOmenTurn',
            infoStep: true,
            highlightTarget: 'betrayal-stale-dog-confirm-target',
            position: 'top',
        });

        expect(document.querySelector('[data-tutorial-step="dog-confirm-waiting"]'))
            .toHaveAttribute('data-tutorial-highlight-missing', 'true');
        expect(screen.getByTestId('tutorial-overlay-card')).toBeTruthy();
        expect(screen.queryByTestId('tutorial-highlight-ring')).toBeNull();
    });

    it('首张教程卡不显示上一步按钮', () => {
        renderWithStep({
            id: 'intro',
            content: 'tutorial.intro',
        }, { stepIndex: 0 });

        expect(screen.queryByTestId('tutorial-previous-button')).toBeNull();
        expect(screen.getByTestId('tutorial-next-button')).toBeTruthy();
    });

    it('首张玩家可见教程卡前面只有纯自动步骤时不显示上一步按钮', () => {
        const visibleStep: TutorialStepSnapshot = {
            id: 'setup-overview',
            content: 'tutorial.setupOverview',
        };

        renderWithStep(visibleStep, {
            stepIndex: 1,
            steps: [
                {
                    id: 'setup-ai',
                    content: 'tutorial.setupAi',
                    aiActions: [{ commandType: 'AI_SETUP' }],
                },
                visibleStep,
            ],
        });

        expect(screen.queryByTestId('tutorial-previous-button')).toBeNull();
        expect(screen.getByTestId('tutorial-next-button')).toBeTruthy();
    });

    it('自动动作未消费前禁用教程导航', () => {
        const { nextStep, previousStep } = renderWithStep({
            id: 'watch-ai',
            content: 'tutorial.watchAi',
            infoStep: true,
            aiActions: [{ commandType: 'AI_MOVE', playerId: '1' }],
        }, { stepIndex: 1 });

        const previousButton = screen.getByTestId('tutorial-previous-button') as HTMLButtonElement;
        const nextButton = screen.getByTestId('tutorial-next-button') as HTMLButtonElement;

        expect(previousButton.disabled).toBe(true);
        expect(nextButton.disabled).toBe(true);
        fireEvent.click(previousButton);
        fireEvent.click(nextButton);
        expect(previousStep).not.toHaveBeenCalled();
        expect(nextStep).not.toHaveBeenCalled();
    });

    it('后续教程卡可以点击上一步，只触发教程回退', () => {
        const { previousStep, nextStep } = renderWithStep({
            id: 'second-step',
            content: 'tutorial.secondStep',
        }, { stepIndex: 1 });

        fireEvent.click(screen.getByTestId('tutorial-previous-button'));

        expect(previousStep).toHaveBeenCalledTimes(1);
        expect(nextStep).not.toHaveBeenCalled();
        expect(playSoundMock).toHaveBeenCalledTimes(1);
    });
});
