import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DiceBoxPhysicsSource } from '../dice-physics/DiceBoxPhysicsSource';

const createEngineMock = vi.fn();

vi.mock('../dice-box-threejs/engine', () => ({
    DiceBoxThreeEngine: {
        create: (...args: unknown[]) => createEngineMock(...args),
    },
}));

describe('DiceBoxPhysicsSource', () => {
    beforeEach(() => {
        createEngineMock.mockReset();
    });

    it('同一颗骰子的连续同面重掷不会吞掉第二次动画', async () => {
        let finishFirstReroll: (() => void) | undefined;
        const firstReroll = new Promise<void>((resolve) => {
            finishFirstReroll = resolve;
        });
        const rerollToValues = vi.fn()
            .mockImplementationOnce(() => firstReroll)
            .mockResolvedValue(undefined);
        const engineMock = {
            resize: vi.fn(),
            destroy: vi.fn(),
            setCanvasDiagnostics: vi.fn(),
            setDieSkins: vi.fn(),
            recoverOutOfBoundsDice: vi.fn(),
            getPhysicsState: vi.fn(),
            hasDice: vi.fn().mockReturnValue(true),
            rerollToValues,
            syncSettledValues: vi.fn(),
            previewValues: vi.fn(),
            clear: vi.fn(),
            removeDice: vi.fn(),
            restoreValues: vi.fn(),
        };
        createEngineMock.mockResolvedValue(engineMock);

        const dice = [{ id: 7, value: 6, isKept: false }];
        const view = render(
            <DiceBoxPhysicsSource
                dice={dice}
                isRolling={false}
                rerollingDiceIds={[7]}
                rerollAnimationSeq={1}
            />,
        );

        await waitFor(() => {
            expect(rerollToValues).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            view.rerender(
                <DiceBoxPhysicsSource
                    dice={[{ id: 7, value: 6, isKept: false }]}
                    isRolling={false}
                    rerollingDiceIds={[7]}
                    rerollAnimationSeq={2}
                />,
            );
        });

        expect(rerollToValues).toHaveBeenCalledTimes(1);

        await act(async () => {
            finishFirstReroll?.();
        });

        await waitFor(() => {
            expect(rerollToValues).toHaveBeenCalledTimes(2);
        });
    });
});
