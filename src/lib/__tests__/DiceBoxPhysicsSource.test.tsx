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

    it('容器从零尺寸变为可见后才初始化物理骰子引擎', async () => {
        const originalResizeObserver = globalThis.ResizeObserver;
        const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        let resizeCallback: ResizeObserverCallback | null = null;
        let hasLayoutSize = false;

        class MockResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                resizeCallback = callback;
            }

            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        }

        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: MockResizeObserver,
        });
        HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: hasLayoutSize ? 320 : 0,
            bottom: hasLayoutSize ? 240 : 0,
            width: hasLayoutSize ? 320 : 0,
            height: hasLayoutSize ? 240 : 0,
            toJSON: () => ({}),
        }));

        try {
            const engineMock = {
                resize: vi.fn(),
                destroy: vi.fn(),
                setCanvasDiagnostics: vi.fn(),
                setDieSkins: vi.fn(),
                recoverOutOfBoundsDice: vi.fn(),
                freezeSettledDice: vi.fn(),
                separateOverlappingDice: vi.fn(),
                settleDiceIntoSafeSpread: vi.fn(),
                getPhysicsState: vi.fn(),
                hasDice: vi.fn()
                    .mockReturnValueOnce(false)
                    .mockReturnValueOnce(false)
                    .mockReturnValueOnce(true)
                    .mockReturnValue(true),
                rollToValues: vi.fn().mockResolvedValue(undefined),
                rerollToValues: vi.fn().mockResolvedValue(undefined),
                syncSettledValues: vi.fn(),
                previewValues: vi.fn(),
                clear: vi.fn(),
                removeDice: vi.fn(),
                restoreValues: vi.fn().mockResolvedValue(undefined),
            };
            createEngineMock.mockResolvedValue(engineMock);

            render(
                <DiceBoxPhysicsSource
                    dice={[{ id: 7, value: 6, isKept: false }]}
                    isRolling={true}
                />,
            );

            await act(async () => {});
            expect(createEngineMock).not.toHaveBeenCalled();

            hasLayoutSize = true;
            await act(async () => {
                resizeCallback?.([], {} as ResizeObserver);
            });

            await waitFor(() => {
                expect(createEngineMock).toHaveBeenCalledTimes(1);
            });
            await waitFor(() => {
                expect(engineMock.rerollToValues).toHaveBeenCalledWith([0], [6], []);
            });
            expect(engineMock.restoreValues).toHaveBeenCalledWith([6]);
            expect(engineMock.rollToValues).not.toHaveBeenCalled();
            expect(engineMock.recoverOutOfBoundsDice).toHaveBeenCalledWith({
                strictProjectedBounds: true,
            });
            expect(engineMock.separateOverlappingDice).toHaveBeenCalledTimes(1);
            expect(engineMock.separateOverlappingDice).toHaveBeenCalledWith({
                settleAfter: true,
            });
            expect(engineMock.settleDiceIntoSafeSpread).toHaveBeenCalledTimes(1);
            expect(engineMock.freezeSettledDice).toHaveBeenCalledTimes(2);
            expect(
                engineMock.restoreValues.mock.invocationCallOrder[0],
            ).toBeLessThan(engineMock.rerollToValues.mock.invocationCallOrder[0]);
        } finally {
            HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
            Object.defineProperty(globalThis, 'ResizeObserver', {
                configurable: true,
                value: originalResizeObserver,
            });
        }
    });

    it('物理状态回调身份变化时不会重建骰子引擎', async () => {
        const engineMock = {
            resize: vi.fn(),
            destroy: vi.fn(),
            setCanvasDiagnostics: vi.fn(),
            setDieSkins: vi.fn(),
            recoverOutOfBoundsDice: vi.fn(),
            freezeSettledDice: vi.fn(),
            separateOverlappingDice: vi.fn(),
            settleDiceIntoSafeSpread: vi.fn(),
            getPhysicsState: vi.fn(),
            hasDice: vi.fn().mockReturnValue(false),
            rollToValues: vi.fn(),
            rerollToValues: vi.fn(),
            syncSettledValues: vi.fn(),
            previewValues: vi.fn(),
            clear: vi.fn(),
            removeDice: vi.fn(),
            restoreValues: vi.fn().mockResolvedValue(undefined),
        };
        createEngineMock.mockResolvedValue(engineMock);

        const view = render(
            <DiceBoxPhysicsSource
                dice={[{ id: 7, value: 6, isKept: false }]}
                isRolling={false}
                onPhysicsStatesChange={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(createEngineMock).toHaveBeenCalledTimes(1);
        });

        view.rerender(
            <DiceBoxPhysicsSource
                dice={[{ id: 7, value: 6, isKept: false }]}
                isRolling={false}
                onPhysicsStatesChange={vi.fn()}
            />,
        );

        await act(async () => {});
        expect(createEngineMock).toHaveBeenCalledTimes(1);
        expect(engineMock.destroy).not.toHaveBeenCalled();
    });

    it('运行期渲染失败时会清空物理状态并停用 3D 物理源', async () => {
        const onPhysicsStatesChange = vi.fn();
        const engineMock = {
            resize: vi.fn(),
            destroy: vi.fn(),
            setCanvasDiagnostics: vi.fn(),
            setDieSkins: vi.fn(),
            recoverOutOfBoundsDice: vi.fn(),
            freezeSettledDice: vi.fn(),
            separateOverlappingDice: vi.fn(),
            settleDiceIntoSafeSpread: vi.fn(),
            getPhysicsState: vi.fn(),
            hasDice: vi.fn().mockReturnValue(false),
            rollToValues: vi.fn(),
            rerollToValues: vi.fn(),
            syncSettledValues: vi.fn(),
            previewValues: vi.fn(),
            clear: vi.fn(),
            removeDice: vi.fn(),
            restoreValues: vi.fn().mockRejectedValueOnce(new Error('renderer failed')),
        };
        createEngineMock.mockResolvedValue(engineMock);

        render(
            <DiceBoxPhysicsSource
                dice={[{ id: 7, value: 6, isKept: false }]}
                isRolling={false}
                onPhysicsStatesChange={onPhysicsStatesChange}
            />,
        );

        await waitFor(() => {
            expect(engineMock.destroy).toHaveBeenCalled();
        });
        expect(onPhysicsStatesChange).toHaveBeenCalledWith([]);
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
            freezeSettledDice: vi.fn(),
            separateOverlappingDice: vi.fn(),
            settleDiceIntoSafeSpread: vi.fn(),
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
