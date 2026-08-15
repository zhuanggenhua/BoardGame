/* @vitest-environment happy-dom */
import React, { useEffect } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEngineConfig } from '../server';
import type { GameBoardProps } from '../protocol';
import { BoardBridge, GameClientOverrideProvider, LocalGameProvider, useGameClient } from '../react';

const testConfig = {
    gameId: 'board-bridge-test',
    domain: {
        setup: (playerIds: string[]) => ({
            players: Object.fromEntries(playerIds.map((playerId) => [playerId, { id: playerId }])),
            playerIds,
            currentPlayer: playerIds[0] ?? null,
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
        window.localStorage.clear();
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

    it('LocalGameProvider 指定 persistGameId 时，应按教程进度保存键恢复旧步骤', () => {
        const seed = 'tutorial-progress-seed';
        window.localStorage.setItem(`local_match_snapshot_v1:tutorial-route-id:${seed}`, JSON.stringify({
            version: 1,
            gameId: 'tutorial-route-id',
            seed,
            numPlayers: 2,
            randomCursor: 0,
            savedAt: Date.now(),
            state: {
                core: {
                    players: {
                        '0': { id: '0' },
                        '1': { id: '1' },
                    },
                    playerIds: ['0', '1'],
                    currentPlayer: '0',
                },
                sys: {
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 0,
                    tutorial: {
                        active: true,
                        manifestId: 'basic-opening',
                        stepIndex: 2,
                        steps: [
                            { id: 'intro', content: 'intro' },
                            { id: 'middle', content: 'middle' },
                            { id: 'resume-here', content: 'resume-here' },
                        ],
                        step: { id: 'resume-here', content: 'resume-here' },
                    },
                },
            },
        }));

        const Board = () => {
            const { state } = useGameClient();
            return <pre data-testid="tutorial-step-index">{String((state as any)?.sys?.tutorial?.stepIndex)}</pre>;
        };

        render(
            <LocalGameProvider
                config={{ ...testConfig, gameId: 'engine-config-id' }}
                numPlayers={2}
                seed={seed}
                persistSession
                persistGameId="tutorial-route-id"
            >
                <Board />
            </LocalGameProvider>,
        );

        return waitFor(() => {
            expect(screen.getByTestId('tutorial-step-index').textContent).toBe('2');
        });
    });

    it('LocalGameProvider 恢复到与当前 2 人对局不兼容的旧快照时，应丢弃多余玩家并重建当前局面', () => {
        const key = 'local_match_snapshot_v1:board-bridge-test:board-bridge-invalid-player-snapshot';
        window.localStorage.setItem(key, JSON.stringify({
            version: 1,
            gameId: 'board-bridge-test',
            seed: 'board-bridge-invalid-player-snapshot',
            numPlayers: 2,
            randomCursor: 0,
            savedAt: Date.now(),
            state: {
                core: {
                    players: {
                        '0': { id: '0' },
                        '1': { id: '1' },
                        '2': { id: '2' },
                    },
                    playerIds: ['0', '1', '2'],
                    currentPlayer: '2',
                },
                sys: {
                    matchId: 'local:board-bridge-test:board-bridge-invalid-player-snapshot',
                    turnOrder: ['0', '1', '2'],
                    currentPlayerIndex: 2,
                },
            },
        }));

        const Board = ({ G }: GameBoardProps<unknown>) => (
            <pre data-testid="state-player-ids">{JSON.stringify(Object.keys(((G as any)?.core?.players ?? {})))}</pre>
        );

        render(
            <LocalGameProvider
                config={testConfig}
                numPlayers={2}
                seed="board-bridge-invalid-player-snapshot"
                persistSession
            >
                <BoardBridge board={Board} remountKey={false} />
            </LocalGameProvider>,
        );

        return waitFor(() => {
            expect(screen.getByTestId('state-player-ids').textContent).toBe('["0","1"]');
        });
    });

});
