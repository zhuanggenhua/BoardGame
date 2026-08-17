import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameHints } from '../GameHints';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../../../core', () => ({
    HudPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    UI_Z_INDEX: { hint: 1, overlayRaised: 2 },
}));

const baseProps = {
    isDiscardMode: false,
    mustDiscardCount: 0,
    isDiceInteraction: false,
    isInteractionOwner: false,
    isWaitingOpponent: false,
    opponentName: '',
    currentPhase: 'defensiveRoll' as const,
};

describe('GameHints', () => {
    it('响应窗口没有跳过操作时仍渲染状态提示但不渲染让过按钮', () => {
        render(
            <GameHints
                {...baseProps}
                responsePrompt={{ kind: 'token' }}
            />,
        );

        expect(screen.getByTestId('dicethrone-response-window-hint')).toBeInTheDocument();
        expect(screen.queryByTestId('dicethrone-response-pass-button')).toBeNull();
    });

    it('有跳过操作的响应窗口仍渲染让过按钮', () => {
        render(
            <GameHints
                {...baseProps}
                responsePrompt={{ kind: 'token', onPass: vi.fn() }}
            />,
        );

        expect(screen.getByTestId('dicethrone-response-window-hint')).toBeInTheDocument();
        expect(screen.getByTestId('dicethrone-response-pass-button')).toBeInTheDocument();
    });
});
