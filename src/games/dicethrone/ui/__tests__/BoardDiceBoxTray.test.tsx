import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { BoardDiceBoxTray } from '../BoardDiceBoxTray';

const createEngineMock = vi.fn();
const removeDiceMock = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../../../lib/dice-box-threejs/engine', () => ({
    DiceBoxThreeEngine: {
        create: (...args: unknown[]) => createEngineMock(...args),
    },
}));

vi.mock('../diceThroneDiceBoxSkins', () => ({
    loadDiceThroneDiceBoxSkins: vi.fn().mockResolvedValue([]),
}));

vi.mock('../Dice3D', () => ({
    Dice3D: (props: Record<string, unknown>) => (
        <div
            data-testid={`mock-dice3d-${String(props.value)}`}
            data-enable-webgl={String(props.enableWebgl)}
        />
    ),
}));

describe('BoardDiceBoxTray', () => {
    beforeEach(() => {
        createEngineMock.mockReset();
        removeDiceMock.mockReset();
    });

    it('dice-box-threejs 初始化失败时仍应渲染可点击的回退骰台', async () => {
        createEngineMock.mockRejectedValueOnce(new Error('engine init failed'));
        const onDieClick = vi.fn();

        render(
            <BoardDiceBoxTray
                dice={[{
                    id: 0,
                    displayValue: 5,
                    isKept: false,
                    selected: false,
                    clickable: true,
                    definitionId: 'barbarian-dice',
                }]}
                isRolling={false}
                onDieClick={onDieClick}
                locale="zh-CN"
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('dicethrone-board-dice-box-fallback')).toHaveAttribute('data-engine-state', 'failed');
        });

        const button = screen.getByTestId('die-button-0');
        expect(button).toHaveAttribute('data-render-mode', 'fallback');

        const die3d = screen.getByTestId('mock-dice3d-5');
        expect(die3d).toHaveAttribute('data-enable-webgl', 'false');

        fireEvent.click(button);
        expect(onDieClick).toHaveBeenCalledWith(0);
    });

    it('dice-box-threejs 运行期失败时会切回可点击的回退骰台', async () => {
        const engineMock = {
            setDieSkins: vi.fn(),
            resize: vi.fn(),
            destroy: vi.fn(),
            clear: vi.fn(),
            rollToValues: vi.fn().mockRejectedValueOnce(new Error('render failed')),
            syncValues: vi.fn(),
            removeDice: removeDiceMock,
            hasDice: vi.fn().mockReturnValue(false),
            getProjectedLayout: vi.fn(),
            getMotionSnapshot: vi.fn(),
        };
        createEngineMock.mockResolvedValue(engineMock);
        const onDieClick = vi.fn();

        render(
            <BoardDiceBoxTray
                dice={[{
                    id: 0,
                    displayValue: 3,
                    isKept: false,
                    selected: false,
                    clickable: true,
                    definitionId: 'artificer-dice',
                }]}
                isRolling={false}
                onDieClick={onDieClick}
                locale="zh-CN"
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('dicethrone-board-dice-box-fallback')).toHaveAttribute('data-engine-state', 'failed');
        });

        const button = screen.getByTestId('die-button-0');
        expect(button).toHaveAttribute('data-render-mode', 'fallback');
        fireEvent.click(button);
        expect(onDieClick).toHaveBeenCalledWith(0);
    });

    it('锁定骰子离开棋盘时应调用 dice-box-threejs remove 产生移除动画', async () => {
        const engineMock = {
            setDieSkins: vi.fn(),
            resize: vi.fn(),
            destroy: vi.fn(),
            clear: vi.fn(),
            rollToValues: vi.fn(),
            syncValues: vi.fn(),
            removeDice: removeDiceMock,
            hasDice: vi.fn()
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(false),
            getProjectedLayout: vi.fn(),
            getMotionSnapshot: vi.fn(),
        };
        createEngineMock.mockResolvedValue(engineMock);

        const { rerender } = render(
            <BoardDiceBoxTray
                dice={[
                    { id: 0, displayValue: 1, isKept: false, selected: false, clickable: true },
                    { id: 1, displayValue: 2, isKept: false, selected: false, clickable: true },
                ]}
                isRolling={false}
                onDieClick={vi.fn()}
                locale="zh-CN"
            />,
        );

        await waitFor(() => {
            expect(engineMock.rollToValues).toHaveBeenCalledWith([1, 2]);
        });

        rerender(
            <BoardDiceBoxTray
                dice={[
                    { id: 1, displayValue: 2, isKept: false, selected: false, clickable: true },
                ]}
                isRolling={false}
                onDieClick={vi.fn()}
                locale="zh-CN"
            />,
        );

        await waitFor(() => {
            expect(removeDiceMock).toHaveBeenCalledWith([0]);
        });
        expect(engineMock.rollToValues).toHaveBeenCalled();
    });
});
