import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

const dice3DCalls: Array<Record<string, unknown>> = [];
const diceField3DCalls: Array<Record<string, unknown>> = [];
const diceBoxPhysicsSourceCalls: Array<Record<string, unknown>> = [];

vi.mock('../Dice3D', () => ({
    Dice3D: (props: Record<string, unknown>) => {
        dice3DCalls.push(props);
        return <div data-testid="mock-dice-3d" />;
    },
    DiceField3D: (props: Record<string, unknown>) => {
        diceField3DCalls.push(props);
        return <div data-testid="mock-dice-field-3d" />;
    },
}));

vi.mock('../../../../lib/dice-physics/DiceBoxPhysicsSource', () => ({
    DiceBoxPhysicsSource: (props: Record<string, unknown>) => {
        const didRecordCall = React.useRef(false);
        if (!didRecordCall.current) {
            diceBoxPhysicsSourceCalls.push(props);
            didRecordCall.current = true;
        }
        React.useEffect(() => {
            const dice = props.dice as Die[] | undefined;
            const onPhysicsStatesChange = props.onPhysicsStatesChange as ((states: Array<{
                id: number;
                layout: {
                    id: number;
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    minX: number;
                    maxX: number;
                    minY: number;
                    maxY: number;
                    rotateX: number;
                    rotateY: number;
                    rotateZ: number;
                };
                motion: { x: number; y: number; z: number; rotateX: number; rotateY: number; rotateZ: number };
                settled: boolean;
                value: number | null;
            }>) => void) | undefined;

            if (!dice || !onPhysicsStatesChange) return;

            onPhysicsStatesChange(dice.map((die, index) => {
                const x = 120 + (index * 80);
                const y = 90 + (index * 12);

                return {
                    id: die.id,
                    layout: {
                        id: die.id,
                        x,
                        y,
                        width: 52,
                        height: 52,
                        minX: x - 26,
                        maxX: x + 26,
                        minY: y - 26,
                        maxY: y + 26,
                        rotateX: 0,
                        rotateY: 0,
                        rotateZ: 0,
                    },
                    motion: { x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0 },
                    settled: true,
                    value: die.value,
                };
            }));
        }, [props.dice, props.onPhysicsStatesChange]);
        return <div data-testid="mock-dice-box-physics-source" />;
    },
}));

const dice: Die[] = [
    {
        id: 0,
        value: 1,
        isKept: false,
        definitionId: 'monk-dice',
    },
];

const boardDice: Die[] = [
    { id: 0, value: 1, isKept: false, definitionId: 'monk-dice' },
    { id: 1, value: 2, isKept: true, definitionId: 'monk-dice' },
];

function createModifyInteraction(
    mode: 'adjust' | 'any' = 'adjust',
    selectCount = 1,
): InteractionDescriptor<MultistepChoiceData<DiceModifyStep, DiceModifyResult>> {
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
                dieModifyConfig: mode === 'adjust'
                    ? { mode: 'adjust', adjustRange: { min: -1, max: 1 } }
                    : { mode: 'any' },
                selectCount,
                diceOwnerId: undefined,
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
            initialResult: { selectedDiceIds: [0] },
            localReducer: (current) => current,
            toCommands: () => [],
            meta: {
                dtType: 'selectDie',
                selectCount: 1,
                diceOwnerId: undefined,
                targetOpponentDice: false,
            },
        },
    };
}

function createMultistepState(result: DiceModifyResult | DiceSelectResult, step = vi.fn()): MultistepInteractionState<DiceModifyResult | DiceSelectResult> {
    return {
        result,
        stepCount: 0,
        canConfirm: true,
        step,
        confirm: vi.fn(),
        cancel: vi.fn(),
    };
}

describe('DiceTray tutorial anchor', () => {
    it('右侧传统骰盘应保留 dice-tray 教程标记', () => {
        dice3DCalls.length = 0;
        diceField3DCalls.length = 0;
        diceBoxPhysicsSourceCalls.length = 0;
        render(
            <DiceTray
                dice={dice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
            />,
        );

        expect(screen.getByTestId('mock-dice-3d').closest('[data-tutorial-id="dice-tray"]')).not.toBeNull();
    });

    it('右侧传统骰盘应继续走原来的 Dice3D 链路，而不是强制非 WebGL 平替', () => {
        dice3DCalls.length = 0;
        diceField3DCalls.length = 0;
        diceBoxPhysicsSourceCalls.length = 0;
        render(
            <DiceTray
                dice={dice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
            />,
        );

        expect(dice3DCalls).toHaveLength(2);
        expect(dice3DCalls[0]?.enableWebgl).toBeUndefined();
    });

    it('棋盘内 3D 骰台不应复用 dice-tray 教程标记', () => {
        dice3DCalls.length = 0;
        diceField3DCalls.length = 0;
        diceBoxPhysicsSourceCalls.length = 0;
        const { container } = render(
            <DiceTray
                dice={dice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
                presentation="board"
            />,
        );

        expect(screen.queryByTestId('dicethrone-board-dice-custom-reference-layer')).toBeNull();
        expect(screen.getByTestId('dicethrone-board-dice-hit-layer')).toBeInTheDocument();
        expect(screen.getByTestId('mock-dice-box-physics-source')).toBeInTheDocument();
        expect(container.querySelector('[data-tutorial-id="dice-tray"]')).toBeNull();
    });

    it('棋盘内 3D 骰台和物理源应保留锁定骰子并标记不参与重投', () => {
        dice3DCalls.length = 0;
        diceField3DCalls.length = 0;
        diceBoxPhysicsSourceCalls.length = 0;
        render(
            <DiceTray
                dice={[
                    {
                        id: 0,
                        value: 1,
                        isKept: false,
                        definitionId: 'monk-dice',
                    },
                    {
                        id: 1,
                        value: 2,
                        isKept: true,
                        definitionId: 'monk-dice',
                    },
                ]}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
                presentation="board"
            />,
        );

        expect(diceField3DCalls).toHaveLength(0);
        expect(diceBoxPhysicsSourceCalls).toHaveLength(1);
        expect(diceBoxPhysicsSourceCalls[0]?.dice).toMatchObject([
            { id: 0, value: 1, isKept: false },
            { id: 1, value: 2, isKept: true },
        ]);
    });

    it('棋盘内 3D 锁定骰子的锁定框和文案不应被裁成省略号', () => {
        const { container } = render(
            <DiceTray
                dice={boardDice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
                presentation="board"
            />,
        );

        expect(screen.getByTestId('die-locked-ring-1')).toHaveClass('rounded-full');
        expect(screen.getByTestId('die-locked-ring-1').parentElement).toHaveStyle({
            width: '70px',
            height: '70px',
        });
        expect(screen.getByTestId('die-locked-ring-1').closest('[data-testid="die-button-1"]')).toBeNull();
        const lockedLabel = screen.getByTestId('die-locked-label-1');
        const lockedLabelLayer = screen.getByTestId('die-locked-label-layer-1');
        const physicsLayerStyle = diceBoxPhysicsSourceCalls[0]?.style as React.CSSProperties | undefined;
        expect(Number(lockedLabelLayer.style.zIndex)).toBeGreaterThan(Number(physicsLayerStyle?.zIndex ?? 0));
        expect(lockedLabel).toHaveClass('min-w-max');
        expect(lockedLabel).toHaveClass('whitespace-nowrap');
        expect(lockedLabel).not.toHaveClass('overflow-hidden');
        expect(lockedLabel).not.toHaveClass('text-ellipsis');
        expect(container.querySelector('[data-testid="die-locked-ring-1"].rounded-2xl')).toBeNull();
    });

    it('棋盘内 3D 骰子的选择框应为圆形而不是方角框', () => {
        render(
            <DiceTray
                dice={boardDice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
                presentation="board"
                interaction={createSelectInteraction()}
                multistepInteraction={createMultistepState({ selectedDiceIds: [0] })}
            />,
        );

        const selectedRing = screen.getByTestId('die-selected-ring-0');
        expect(selectedRing).toHaveClass('rounded-full');
        expect(selectedRing.parentElement).toHaveStyle({
            width: '70px',
            height: '70px',
        });
        expect(selectedRing.closest('[data-testid="die-button-0"]')).toBeNull();
        expect(selectedRing).not.toHaveClass('rounded-2xl');
    });

    it('棋盘内 3D 改骰应显示可点击的加减按钮而不是只靠点骰子循环', () => {
        const step = vi.fn();
        render(
            <DiceTray
                dice={boardDice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
                presentation="board"
                interaction={createModifyInteraction('adjust')}
                multistepInteraction={createMultistepState({ modifications: {}, modCount: 0, totalAdjustment: 0 }, step)}
            />,
        );

        const decrementButton = screen.getByTestId('die-adjust-decrement-0');
        const incrementButton = screen.getByTestId('die-adjust-increment-0');
        expect(decrementButton).toBeVisible();
        expect(incrementButton).toBeVisible();
        expect(decrementButton).toHaveClass('pointer-events-auto');
        expect(incrementButton).toHaveClass('pointer-events-auto');

        incrementButton.click();
        expect(step).toHaveBeenCalledWith({ action: 'adjust', dieId: 0, delta: 1, currentValue: 1 });
    });

    it('右侧传统骰盘的任意改面模式应允许分别修改两颗骰子', () => {
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
                canInteract={true}
                isRolling={false}
                interaction={createModifyInteraction('any', 2)}
                multistepInteraction={createMultistepState({ modifications: {}, modCount: 0, totalAdjustment: 0 }, step)}
            />,
        );

        screen.getByTestId('die-adjust-decrement-0').click();
        screen.getByTestId('die-adjust-decrement-1').click();

        expect(step).toHaveBeenNthCalledWith(1, { action: 'setAny', dieId: 0, newValue: 5 });
        expect(step).toHaveBeenNthCalledWith(2, { action: 'setAny', dieId: 1, newValue: 5 });
    });

    it('棋盘内 3D 物理骰应等 DiceThrone 骰面皮肤就绪后再生成和投掷', () => {
        diceBoxPhysicsSourceCalls.length = 0;
        render(
            <DiceTray
                dice={boardDice}
                rollCount={0}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={true}
                presentation="board"
            />,
        );

        expect(diceBoxPhysicsSourceCalls).toHaveLength(1);
        expect(diceBoxPhysicsSourceCalls[0]?.requireDieSkins).toBe(true);
    });

    it('右侧默认掷骰按钮在首掷前仍应保持原来的双按钮布局', () => {
        const { container } = render(
            <DiceActions
                rollCount={0}
                rollLimit={3}
                rollConfirmed={false}
                onRoll={vi.fn()}
                onConfirm={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
                setIsRolling={vi.fn()}
                setRerollingDiceIds={vi.fn()}
            />,
        );

        expect(container.querySelector('[data-tutorial-id="dice-roll-button"]')).not.toBeNull();
        expect(container.querySelector('[data-tutorial-id="dice-confirm-button"]')).not.toBeNull();
    });

    it('非投掷阶段时掷骰按钮应直接置灰', () => {
        const { container } = render(
            <DiceActions
                rollCount={0}
                rollLimit={3}
                rollConfirmed={false}
                onRoll={vi.fn()}
                onConfirm={vi.fn()}
                currentPhase="main1"
                canInteract={true}
                isRolling={false}
                setIsRolling={vi.fn()}
                setRerollingDiceIds={vi.fn()}
            />,
        );

        const rollButton = container.querySelector('[data-tutorial-id="dice-roll-button"]');
        expect(rollButton).not.toBeNull();
        expect(rollButton).toBeDisabled();
    });
});
