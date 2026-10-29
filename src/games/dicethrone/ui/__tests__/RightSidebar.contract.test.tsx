import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionDescriptor } from '../../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../../engine/systems/useMultistepInteraction';
import type { DiceInteractionContract } from '../diceInteractionContract';
import { createDiceInteractionContract } from '../diceInteractionContract';
import type { DiceModifyResult, DiceSelectResult } from '../../domain/systems';
import { RightSidebar } from '../RightSidebar';

const mocks = vi.hoisted(() => ({
    diceTray: vi.fn(),
    diceActions: vi.fn(),
}));

vi.mock('react-i18next', async importOriginal => ({
    ...await importOriginal<typeof import('react-i18next')>(),
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../DiceTray', () => ({
    DiceTray: ({ diceInteraction }: { diceInteraction?: DiceInteractionContract }) => {
        mocks.diceTray({ diceInteraction });
        return (
            <div
                data-testid="dice-contract-tray"
                data-interaction-id={diceInteraction?.interactionId ?? ''}
                data-hint-key={diceInteraction?.hint.key ?? ''}
            />
        );
    },
    DiceActions: ({
        isResponseWindowOpen,
        diceInteraction,
    }: {
        isResponseWindowOpen?: boolean;
        diceInteraction?: DiceInteractionContract;
    }) => {
        mocks.diceActions({ diceInteraction });
        return (
            <>
                <div data-testid="response-window-wiring">{String(isResponseWindowOpen)}</div>
                <div
                    data-testid="dice-contract-actions"
                    data-interaction-id={diceInteraction?.interactionId ?? ''}
                    data-hint-key={diceInteraction?.hint.key ?? ''}
                    data-left-action={diceInteraction?.actions.left?.kind ?? ''}
                    data-right-action={diceInteraction?.actions.right?.kind ?? ''}
                />
            </>
        );
    },
}));
vi.mock('../DiscardPile', () => ({ DiscardPile: React.forwardRef(() => null) }));
vi.mock('../PassiveAbilityPanel', () => ({ PassiveAbilityPanel: () => null }));

const createController = (
    result: DiceModifyResult | DiceSelectResult = { selectedDiceIds: [0] },
): MultistepInteractionState<DiceModifyResult | DiceSelectResult> => ({
    result,
    stepCount: 1,
    canConfirm: true,
    step: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
});

const createBonusSettlementContract = () => createDiceInteractionContract({
    rootPlayerId: '0',
    isBonusDiceSettlement: true,
});

const createGroupRerollContract = () => {
    const interaction: InteractionDescriptor = {
        id: 'thor-group-reroll-test',
        kind: 'multistep-choice',
        playerId: '0',
        data: {
            minSteps: 0,
            allowedDieIds: [0, 1],
            meta: {
                dtType: 'selectDie',
                selectionMode: 'bonusGroupReroll',
                selectCount: 2,
                diceOwnerId: '0',
                targetOpponentDice: false,
            },
        },
    };

    return createDiceInteractionContract({
        interaction,
        controller: createController(),
        rootPlayerId: '0',
        isBonusDiceSettlement: true,
    });
};

const createOrdinaryRerollContract = () => {
    const interaction: InteractionDescriptor = {
        id: 'bonus-dice-card-reroll-test',
        kind: 'multistep-choice',
        playerId: '0',
        data: {
            minSteps: 1,
            allowedDieIds: [0, 1],
            meta: {
                dtType: 'selectDie',
                selectionMode: 'reroll',
                selectCount: 1,
                diceOwnerId: '0',
                targetOpponentDice: false,
            },
        },
    };

    return createDiceInteractionContract({
        interaction,
        controller: createController(),
        rootPlayerId: '0',
        isBonusDiceSettlement: true,
    });
};

describe('右侧骰盘消费 Board 提供的共享交互合同', () => {
    const requiredProps = {
        dice: [],
        rollCount: 1,
        rollLimit: 3,
        rollConfirmed: false,
        currentPhase: 'offensiveRoll' as const,
        canInteractDice: true,
        isRolling: false,
        setIsRolling: vi.fn(),
        onToggleLock: vi.fn(),
        onRoll: vi.fn(),
        onConfirm: vi.fn(),
        showAdvancePhaseButton: false,
        advanceLabel: '',
        isAdvanceButtonEnabled: false,
        onAdvance: vi.fn(),
        discardPileRef: React.createRef<HTMLDivElement>(),
        discardCards: [],
        canUndoDiscard: false,
        onUndoDiscard: vi.fn(),
        discardHighlighted: false,
        sellButtonVisible: false,
        diceInteraction: undefined,
        rootPlayerId: '0',
    };

    beforeEach(() => {
        mocks.diceTray.mockClear();
        mocks.diceActions.mockClear();
    });

    it('响应窗口状态传递给原掷骰动作区', () => {
        render(<RightSidebar {...requiredProps} isResponseWindowOpen />);
        expect(screen.getByTestId('response-window-wiring')).toHaveTextContent('true');
    });

    it('效果骰结算提示沿用骰盘上方承载', () => {
        const diceInteraction = createBonusSettlementContract();
        render(<RightSidebar {...requiredProps} diceInteraction={diceInteraction} isBonusDiceSettlement />);

        expect(screen.getByTestId('dice-interaction-hint')).toHaveTextContent('interaction.hint_bonus_settlement');
        expect(screen.getByTestId('dice-interaction-hint-anchor')).toHaveAttribute('data-anchor', 'dice-tray');
        expect(screen.getByTestId('dice-interaction-hint-anchor')).toHaveAttribute('data-placement', 'tray-top');
    });

    it('骰盘隐藏时不留下脱离候选对象的骰子提示', () => {
        render(<RightSidebar
            {...requiredProps}
            diceInteraction={createBonusSettlementContract()}
            isBonusDiceSettlement
            showDiceTray={false}
        />);

        expect(screen.queryByTestId('dice-interaction-hint')).not.toBeInTheDocument();
    });

    it('选骰提示锚定骰盘上沿，骰盘和动作区收到同一合同', () => {
        const diceInteraction = createGroupRerollContract();
        if (!diceInteraction) throw new Error('组选重掷必须生成交互合同');

        render(<RightSidebar
            {...requiredProps}
            diceInteraction={diceInteraction}
            isBonusDiceSettlement
        />);

        expect(screen.getByTestId('dice-interaction-hint')).toHaveTextContent('interaction.hint_group_reroll_selected');
        const hintAnchor = screen.getByTestId('dice-interaction-hint-anchor');
        const diceTray = screen.getByTestId('dice-contract-tray');
        expect(hintAnchor).toHaveAttribute('data-placement', 'tray-top');
        expect(hintAnchor.style.right).toBe('0px');
        expect(hintAnchor.style.bottom).toBe('100%');
        expect(hintAnchor.style.top).toBe('');
        expect(hintAnchor.parentElement).toBe(diceTray.parentElement);
        expect(diceTray).toHaveAttribute('data-interaction-id', 'thor-group-reroll-test');
        expect(screen.getByTestId('dice-contract-actions')).toHaveAttribute('data-interaction-id', 'thor-group-reroll-test');
        expect(mocks.diceTray.mock.calls.at(-1)?.[0].diceInteraction).toBe(diceInteraction);
        expect(mocks.diceActions.mock.calls.at(-1)?.[0].diceInteraction).toBe(diceInteraction);
        expect(screen.getByTestId('dice-contract-actions')).toHaveAttribute('data-left-action', 'submitSelection');
        expect(screen.getByTestId('dice-contract-actions')).toHaveAttribute('data-right-action', 'confirmSettlement');
    });

    it('普通待结算选骰由 GameHints 承载提示，右侧栏只负责骰盘与动作', () => {
        const diceInteraction = createOrdinaryRerollContract();
        if (!diceInteraction) throw new Error('普通选骰必须生成交互合同');

        render(<RightSidebar
            {...requiredProps}
            diceInteraction={diceInteraction}
            isBonusDiceSettlement
        />);

        expect(diceInteraction.hint.surface).toBe('game-hints');
        expect(screen.queryByTestId('dice-interaction-hint')).not.toBeInTheDocument();
        expect(screen.getByTestId('dice-contract-actions')).toHaveAttribute('data-left-action', 'cancel');
        expect(screen.getByTestId('dice-contract-actions')).toHaveAttribute('data-right-action', 'confirmInteraction');
        expect(mocks.diceActions.mock.calls.at(-1)?.[0].diceInteraction).toBe(diceInteraction);
    });
});
