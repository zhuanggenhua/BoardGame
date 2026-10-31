import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameHints } from '../GameHints';
import { createHandDiscardInteractionContract } from '../handDiscardInteractionContract';
import { createDiceInteractionContract } from '../diceInteractionContract';
import type { DiceModifyResult, DiceSelectResult } from '../../domain/systems';
import type { MultistepInteractionState } from '../../../../engine/systems/useMultistepInteraction';

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
    handDiscardInteraction: undefined,
    diceInteraction: undefined,
    isWaitingOpponent: false,
    opponentName: '',
};

const createHandDiscardInteraction = (onCancel?: () => void) => createHandDiscardInteractionContract({
    interaction: {
        id: 'discard-cost-1',
        playerId: '0',
        type: 'selectHandCard',
        titleKey: 'interaction.selectHandCardToDiscard',
        selectCount: 1,
        candidateCardIds: ['card-a'],
        allowCancel: Boolean(onCancel),
    },
    handCardIds: ['card-a', 'card-b'],
    currentPlayerId: '0',
    canOperate: true,
    onSelectCard: vi.fn(),
    onCancel: onCancel ?? vi.fn(),
});

const createDiceInteraction = (selectionMode: 'reroll' | 'bonusGroupReroll' = 'reroll',
    options: { selected?: number[]; max?: number; repeat?: boolean } = {}) => createDiceInteractionContract({
    interaction: {
        id: `dice-${selectionMode}`,
        kind: 'multistep-choice',
        playerId: '0',
        data: {
            minSteps: selectionMode === 'bonusGroupReroll' ? 0 : 1,
            allowedDieIds: [0, 1],
            meta: {
                dtType: 'selectDie',
                selectionMode,
                selectCount: options.max ?? 1,
                allowRepeatedDieSelection: options.repeat,
                diceOwnerId: '0',
                targetOpponentDice: false,
            },
        },
    },
    controller: {
        result: { selectedDiceIds: options.selected ?? [] } as DiceSelectResult,
        stepCount: 0,
        canConfirm: false,
        step: vi.fn(),
        confirm: vi.fn(),
        cancel: vi.fn(),
    } as MultistepInteractionState<DiceModifyResult | DiceSelectResult>,
    rootPlayerId: '0',
    isBonusDiceSettlement: selectionMode === 'bonusGroupReroll',
});

describe('GameHints', () => {
    it('可取消的手牌弃置提示使用本地化取消按钮并调用取消动作', () => {
        const onCancel = vi.fn();
        const handDiscardInteraction = createHandDiscardInteraction(onCancel);
        render(
            <GameHints
                {...baseProps}
                handDiscardInteraction={handDiscardInteraction}
            />,
        );

        expect(screen.getByTestId('dicethrone-hand-discard-hint')).toHaveTextContent('interaction.selectHandCardToDiscard');
        const cancelButton = screen.getByRole('button', { name: '取消' });
        fireEvent.click(cancelButton);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('普通选骰提示固定在视口顶部居中', () => {
        const diceInteraction = createDiceInteraction();
        render(<GameHints {...baseProps} diceInteraction={diceInteraction} />);

        expect(diceInteraction?.hint.surface).toBe('game-hints');
        expect(screen.getByTestId('dice-interaction-hint')).toHaveTextContent('interaction.hint_select');
        expect(screen.getByTestId('dice-interaction-hint-anchor')).toHaveAttribute('data-anchor', 'viewport');
        const anchor = screen.getByTestId('dice-interaction-hint-anchor');
        expect(anchor).toHaveAttribute('data-placement', 'top-center');
        expect(anchor.className).toContain('fixed');
        expect(anchor.className).toContain('left-1/2');
        expect(anchor.style.top).toContain('5.6');
        expect(anchor.style.left).toBe('50%');
        expect(anchor.style.transform).toBe('translateX(-50%)');
    });

    it('骰盘提示合同不会在 GameHints 再渲染第二份提示', () => {
        const diceInteraction = createDiceInteraction('bonusGroupReroll');
        render(<GameHints {...baseProps} diceInteraction={diceInteraction} />);

        expect(diceInteraction?.hint.surface).toBe('dice-tray');
        expect(screen.queryByTestId('dice-interaction-hint')).not.toBeInTheDocument();
    });

    it('重复重投的未选、已选与达到额度状态持续显示操作说明', () => {
        const contract = (selected: number[]) => createDiceInteraction('reroll', { selected, max: 2, repeat: true });
        const { rerender } = render(<GameHints {...baseProps} diceInteraction={contract([])} />);
        expect(screen.getByTestId('dice-interaction-hint-detail')).toBeVisible();
        expect(screen.getByTestId('dice-interaction-hint-detail')).toHaveTextContent('interaction.hint_reroll_repeat_detail');
        rerender(<GameHints {...baseProps} diceInteraction={contract([0])} />);
        expect(screen.getByTestId('dice-interaction-hint-detail')).toBeVisible();
        rerender(<GameHints {...baseProps} diceInteraction={contract([0, 0])} />);
        expect(screen.getByTestId('dice-interaction-hint-title')).toHaveTextContent('interaction.hint_reroll_ready');
        expect(screen.getByTestId('dice-interaction-hint-detail')).toBeVisible();
        expect(screen.getByTestId('dice-interaction-hint-detail')).toHaveTextContent('interaction.hint_reroll_ready_detail');
    });

    it('闪避结算合同复用响应窗口提示承载，不重复生成骰子提示', () => {
        const interaction = {
            id: 'token-response-evasion',
            kind: 'dt:token-response',
            playerId: '0',
            data: {},
        } as unknown as Parameters<typeof createDiceInteractionContract>[0]['interaction'];
        const diceInteraction = createDiceInteractionContract({
            interaction,
            rootPlayerId: '0',
            isTokenEvasionConfirmation: true,
        });

        render(
            <GameHints
                {...baseProps}
                diceInteraction={diceInteraction}
                responsePrompt={{ kind: 'token' }}
            />,
        );

        expect(screen.queryByTestId('dice-interaction-hint')).not.toBeInTheDocument();
        expect(screen.getByTestId('dicethrone-response-window-hint')).toHaveAttribute('data-response-kind', 'token');
        expect(screen.getByTestId('dicethrone-response-window-hint')).toHaveTextContent('response.yourTurn');
        expect(screen.queryByTestId('dicethrone-response-pass-button')).not.toBeInTheDocument();
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
