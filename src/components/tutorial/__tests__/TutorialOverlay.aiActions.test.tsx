import { cleanup, render, screen } from '@testing-library/react';
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

const renderWithStep = (step: TutorialStepSnapshot) => {
    useTutorialMock.mockReturnValue({
        isActive: true,
        currentStep: step,
        nextStep: vi.fn(),
        isLastStep: false,
        tutorial: {
            skippedStepIds: [],
        },
    });

    return render(<TutorialOverlay />);
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
});
