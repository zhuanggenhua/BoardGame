import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiceActions, DiceTray } from '../DiceTray';
import type { InteractionDescriptor, MultistepChoiceData } from '../../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../../engine/systems/useMultistepInteraction';
import type { Die } from '../../types';
import type { DiceModifyResult, DiceModifyStep, DiceSelectResult } from '../../domain/systems';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

const dice2DCalls: Array<Record<string, unknown>> = [];

afterEach(() => {
    dice2DCalls.length = 0;
});

vi.mock('../Dice2D', () => ({
    Dice2D: (props: Record<string, unknown>) => {
        dice2DCalls.push(props);
        return <div data-testid="mock-dice-2d" />;
    },
}));

const dice: Die[] = [
    { id: 0, value: 1, isKept: false, definitionId: 'monk-dice' },
];

const twoDice: Die[] = [
    { id: 0, value: 1, isKept: false, definitionId: 'monk-dice' },
    { id: 1, value: 2, isKept: true, definitionId: 'monk-dice' },
];

function createModifyInteraction(
    mode: 'adjust' | 'any' | 'set' | 'copy' = 'adjust',
    selectCount = 1,
): InteractionDescriptor<MultistepChoiceData<DiceModifyStep, DiceModifyResult>> {
    const dieModifyConfig = mode === 'adjust'
        ? { mode: 'adjust' as const, adjustRange: { min: -1, max: 1 } }
        : mode === 'set'
            ? { mode: 'set' as const, targetValue: 6 }
            : { mode };

    return {
        id: `modify-${mode}`,
        kind: 'multistep-choice',
        playerId: '0',
        data: {
            title: 'interaction.modifyDie',
            options: [],
            minSteps: 1,
            maxSteps: 1,
            initialResult: { modifications: {}, modCount: 0, totalAdjustment: 0 },
            localReducer: (current) => current,
            toCommands: () => [],
            meta: {
                dtType: 'modifyDie',
                dieModifyConfig,
                selectCount,
                targetOpponentDice: false,
            },
        },
    };
}

function createSelectInteraction(): InteractionDescriptor<MultistepChoiceData<unknown, DiceSelectResult>> {
    return {
        id: 'select-dice',
        kind: 'multistep-choice',
        playerId: '0',
        data: {
            title: 'interaction.selectDie',
            options: [],
            minSteps: 1,
            maxSteps: 1,
            initialResult: { selectedDiceIds: [] },
            localReducer: (current) => current,
            toCommands: () => [],
            meta: {
                dtType: 'selectDie',
                selectCount: 1,
                targetOpponentDice: false,
            },
        },
    };
}

function createMultistepState(
    result: DiceModifyResult | DiceSelectResult,
    step = vi.fn(),
): MultistepInteractionState<DiceModifyResult | DiceSelectResult> {
    return {
        result,
        stepCount: 0,
        canConfirm: true,
        step,
        confirm: vi.fn(),
        cancel: vi.fn(),
    };
}

describe('DiceTray', () => {
    it('右侧 2D 骰盘保留真实入口和教程锚点', () => {
        render(
            <DiceTray
                dice={dice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract
                isRolling={false}
            />,
        );

        const tray = screen.getByTestId('dicethrone-2d-dice-tray');
        expect(tray).toHaveAttribute('data-tutorial-id', 'dice-tray');
        expect(screen.getByTestId('mock-dice-2d')).toBeInTheDocument();
        expect(screen.queryByTestId('dicethrone-board-dice-stage')).toBeNull();
        expect(screen.queryByTestId('dicethrone-board-dice-box-canvas')).toBeNull();
    });

    it('右侧骰盘不接入棋盘物理骰台或中场骰台', () => {
        render(
            <DiceTray
                dice={twoDice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract
                isRolling={false}
            />,
        );

        expect(dice2DCalls).toHaveLength(2);
        expect(dice2DCalls.every((props) => props.size === '4vw')).toBe(true);
        expect(screen.queryByTestId('mock-dice-field-3d')).toBeNull();
        expect(screen.queryByTestId('mock-dice-box-physics-source')).toBeNull();
    });

    it('投掷完成后可以直接锁定右侧骰子', () => {
        const onToggleLock = vi.fn();
        render(
            <DiceTray
                dice={dice}
                rollCount={1}
                onToggleLock={onToggleLock}
                currentPhase="offensiveRoll"
                canInteract
                isRolling={false}
            />,
        );

        fireEvent.click(screen.getByTestId('die-button-0'));
        expect(onToggleLock).toHaveBeenCalledWith(0);
    });

    it('主动重掷模式不依赖主骰投掷次数，并把奖励骰点击交给上层', () => {
        const onToggleLock = vi.fn();
        render(
            <DiceTray
                dice={[{ ...dice[0], value: 3, displayOnly: true }]}
                rollCount={0}
                onToggleLock={onToggleLock}
                currentPhase="main1"
                canInteract
                isRolling
                isPassiveRerollMode
                bonusDiceReroll={{ canReroll: false, onReroll: vi.fn() }}
            />,
        );

        const die = screen.getByTestId('die-button-0');
        expect(die).toHaveAttribute('data-clickable', 'true');
        fireEvent.click(die);
        expect(onToggleLock).toHaveBeenCalledWith(0);
    });

    it('右侧骰盘的调整模式使用骰子本体旁的加减按钮', () => {
        const step = vi.fn();
        render(
            <DiceTray
                dice={dice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract
                isRolling={false}
                interaction={createModifyInteraction('adjust')}
                multistepInteraction={createMultistepState({ modifications: {}, modCount: 0, totalAdjustment: 0 }, step)}
            />,
        );

        fireEvent.click(screen.getByTestId('die-adjust-increment-0'));
        expect(step).toHaveBeenCalledWith({ action: 'adjust', dieId: 0, delta: 1, currentValue: 1 });
        expect(screen.getByTestId('dicethrone-2d-dice-tray')).toHaveClass('ring-amber-500');
    });

    it('右侧骰盘的任意改面模式可以分别修改两颗骰子', () => {
        const step = vi.fn();
        render(
            <DiceTray
                dice={[
                    { id: 0, value: 6, isKept: false, definitionId: 'monk-dice' },
                    { id: 1, value: 6, isKept: false, definitionId: 'monk-dice' },
                ]}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract
                isRolling={false}
                interaction={createModifyInteraction('any', 2)}
                multistepInteraction={createMultistepState({ modifications: {}, modCount: 0, totalAdjustment: 0 }, step)}
            />,
        );

        fireEvent.click(screen.getByTestId('die-adjust-decrement-0'));
        fireEvent.click(screen.getByTestId('die-adjust-decrement-1'));
        expect(step).toHaveBeenNthCalledWith(1, { action: 'setAny', dieId: 0, newValue: 5 });
        expect(step).toHaveBeenNthCalledWith(2, { action: 'setAny', dieId: 1, newValue: 5 });
    });

    it('响应选骰直接点击右侧骰子本体', () => {
        const step = vi.fn();
        render(
            <DiceTray
                dice={twoDice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="defensiveRoll"
                canInteract
                isRolling={false}
                interaction={createSelectInteraction()}
                multistepInteraction={createMultistepState({ selectedDiceIds: [] }, step)}
            />,
        );

        fireEvent.click(screen.getByTestId('die-button-0'));
        expect(step).toHaveBeenCalledWith({ action: 'toggle', dieId: 0 });
    });
});

describe('DiceActions', () => {
    it('首掷前显示投掷和确认两个按钮', () => {
        const { container } = render(
            <DiceActions
                rollCount={0}
                rollLimit={3}
                rollConfirmed={false}
                onRoll={vi.fn()}
                onConfirm={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract
                isRolling={false}
                setIsRolling={vi.fn()}
            />,
        );

        expect(container.querySelector('[data-tutorial-id="dice-roll-button"]')).not.toBeNull();
        expect(container.querySelector('[data-tutorial-id="dice-confirm-button"]')).not.toBeNull();
    });

    it('非投掷阶段时投掷按钮置灰', () => {
        const { container } = render(
            <DiceActions
                rollCount={0}
                rollLimit={3}
                rollConfirmed={false}
                onRoll={vi.fn()}
                onConfirm={vi.fn()}
                currentPhase="main1"
                canInteract
                isRolling={false}
                setIsRolling={vi.fn()}
            />,
        );

        expect(container.querySelector('[data-tutorial-id="dice-roll-button"]')).toBeDisabled();
    });

    it('Duel/对掷确认不应被上一轮普通投骰的已确认状态禁用', () => {
        const onConfirm = vi.fn();
        render(
            <DiceActions
                rollCount={1}
                rollLimit={1}
                rollConfirmed
                isCompareRoll
                onRoll={vi.fn()}
                onConfirm={onConfirm}
                currentPhase="defensiveRoll"
                canInteract
                isRolling={false}
                setIsRolling={vi.fn()}
            />,
        );

        const confirmButton = screen.getByText('common.confirm').closest('button');
        expect(confirmButton).toBeEnabled();

        fireEvent.click(confirmButton!);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('改骰交互的确认仍在右侧骰盘，但与最终骰面确认使用不同稳定入口', () => {
        render(
            <DiceActions
                rollCount={1}
                rollLimit={3}
                rollConfirmed={false}
                onRoll={vi.fn()}
                onConfirm={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract
                isRolling={false}
                setIsRolling={vi.fn()}
                interaction={createModifyInteraction('any')}
                multistepInteraction={createMultistepState({ modifications: { 0: 6 }, modCount: 1, totalAdjustment: 0 })}
            />,
        );

        expect(screen.getByTestId('dice-interaction-confirm-button')).toBeEnabled();
        expect(screen.queryByTestId('dice-confirm-button')).toBeNull();
    });
});
