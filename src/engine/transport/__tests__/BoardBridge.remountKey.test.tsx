/* @vitest-environment happy-dom */
import React, { useEffect } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEngineConfig } from '../server';
import type { GameBoardProps } from '../protocol';
import { BoardBridge, GameClientOverrideProvider, LocalGameProvider } from '../react';

const testConfig = {
    gameId: 'board-bridge-test',
    domain: {
        setup: (playerIds: string[]) => ({
            turnOrder: playerIds,
            currentPlayerIndex: 0,
        }),
        validate: () => ({ valid: true }),
        execute: () => [],
        reduce: (core: unknown) => core,
    },
    systems: [],
} as unknown as GameEngineConfig;

describe('BoardBridge remountKey', () => {
    afterEach(() => {
        cleanup();
    });

    it('remountKey 为 false 时，playerID 切换只更新 props，不重挂载 Board', () => {
        const mountSpy = vi.fn();
        const unmountSpy = vi.fn();

        const Board = ({ playerID }: GameBoardProps<unknown>) => {
            useEffect(() => {
                mountSpy();
                return () => unmountSpy();
            }, []);

            return <div data-testid="board-player">{playerID}</div>;
        };

        const Fixture = ({ playerId }: { playerId: string }) => (
            <LocalGameProvider config={testConfig} numPlayers={3} seed="board-bridge-remount-key">
                <GameClientOverrideProvider playerId={playerId}>
                    <BoardBridge board={Board} remountKey={false} />
                </GameClientOverrideProvider>
            </LocalGameProvider>
        );

        const { rerender } = render(<Fixture playerId="1" />);

        expect(screen.getByTestId('board-player')).toHaveTextContent('1');
        expect(mountSpy).toHaveBeenCalledTimes(1);
        expect(unmountSpy).not.toHaveBeenCalled();

        rerender(<Fixture playerId="2" />);

        expect(screen.getByTestId('board-player')).toHaveTextContent('2');
        expect(mountSpy).toHaveBeenCalledTimes(1);
        expect(unmountSpy).not.toHaveBeenCalled();
    });
});
