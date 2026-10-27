import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameHints } from '../GameHints';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key === 'common.cancel' ? '取消' : key,
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
    it('可取消的手牌弃置提示使用本地化取消按钮并调用取消动作', () => {
        const onCancel = vi.fn();
        render(
            <GameHints
                {...baseProps}
                handDiscardPrompt={{ onCancel }}
            />,
        );

        expect(screen.getByTestId('dicethrone-hand-discard-hint')).toHaveTextContent('interaction.selectHandCardToDiscard');
        const cancelButton = screen.getByRole('button', { name: '取消' });
        fireEvent.click(cancelButton);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

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

    it('响应窗口让过只在 click 时执行，避免 pointerdown 关闭后穿透到底层确认按钮', () => {
        const onPass = vi.fn();
        render(
            <GameHints
                {...baseProps}
                responsePrompt={{ kind: 'card', onPass }}
            />,
        );

        const button = screen.getByTestId('dicethrone-response-pass-button');
        fireEvent.pointerDown(button);
        expect(onPass).not.toHaveBeenCalled();

        fireEvent.click(button);
        expect(onPass).toHaveBeenCalledTimes(1);
    });
});
