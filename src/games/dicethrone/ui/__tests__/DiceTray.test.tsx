import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiceActions, DiceTray } from '../DiceTray';
import type { Die } from '../../types';

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
const boardDiceBoxTrayCalls: Array<Record<string, unknown>> = [];

vi.mock('../Dice3D', () => ({
    Dice3D: (props: Record<string, unknown>) => {
        dice3DCalls.push(props);
        return <div data-testid="mock-dice-3d" />;
    },
    DiceField3D: () => <div data-testid="mock-dice-field-3d" />,
}));

vi.mock('../BoardDiceBoxTray', () => ({
    BoardDiceBoxTray: (props: Record<string, unknown>) => {
        boardDiceBoxTrayCalls.push(props);
        return <div data-testid="mock-board-dice-box-tray" />;
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

describe('DiceTray tutorial anchor', () => {
    it('右侧传统骰盘应保留 dice-tray 教程标记', () => {
        dice3DCalls.length = 0;
        boardDiceBoxTrayCalls.length = 0;
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
        boardDiceBoxTrayCalls.length = 0;
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

        expect(dice3DCalls).toHaveLength(1);
        expect(dice3DCalls[0]?.enableWebgl).toBeUndefined();
    });

    it('棋盘内 3D 骰台不应复用 dice-tray 教程标记', () => {
        dice3DCalls.length = 0;
        boardDiceBoxTrayCalls.length = 0;
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

        expect(screen.getByTestId('mock-board-dice-box-tray')).toBeInTheDocument();
        expect(container.querySelector('[data-tutorial-id="dice-tray"]')).toBeNull();
    });

    it('棋盘内 3D 骰台只应收到未锁定骰子', () => {
        dice3DCalls.length = 0;
        boardDiceBoxTrayCalls.length = 0;
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

        expect(boardDiceBoxTrayCalls).toHaveLength(1);
        expect(boardDiceBoxTrayCalls[0]?.dice).toMatchObject([
            { id: 0, isKept: false },
        ]);
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
