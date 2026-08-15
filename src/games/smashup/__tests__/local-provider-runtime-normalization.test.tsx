/* @vitest-environment happy-dom */
import React, { useEffect } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameEngineConfig } from '../../../engine/transport/server';
import type { GameBoardProps } from '../../../engine/transport/protocol';
import { BoardBridge, LocalGameProvider, useGameClient } from '../../../engine/transport/react';
import { normalizeSmashUpMatchStateForUi } from '../ui/normalizeRuntimeState';

const smashupCompatConfig = {
    gameId: 'smashup',
    domain: {
        setup: () => ({
            players: {},
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 1,
        }),
        validate: () => ({ valid: true }),
        execute: () => [],
        reduce: (core: unknown) => core,
        normalizeRuntimeState: (state: any) => normalizeSmashUpMatchStateForUi(state),
    },
    systems: [],
} as unknown as GameEngineConfig;

const smashupDirtyDispatchConfig = {
    gameId: 'smashup',
    domain: {
        setup: () => ({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['minions_of_cthulhu', 'innsmouth'],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['elder_things', 'miskatonic'],
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_tortuga',
                    minions: [],
                    ongoingActions: [],
                },
            ],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 1,
            madnessDeck: ['special_madness'],
        }),
        validate: () => ({ valid: true }),
        execute: () => [{
            type: 'TEST_DIRTY_RUNTIME_STATE',
            payload: {},
            timestamp: 1,
        }],
        reduce: (core: any, event: any) => {
            if (event.type !== 'TEST_DIRTY_RUNTIME_STATE') {
                return core;
            }
            return {
                ...core,
                players: {
                    ...core.players,
                    '0': {
                        ...core.players['0'],
                        pendingMinionPlayEffects: null,
                        usedDiscardPlayAbilities: null,
                    },
                },
                bases: core.bases.map((base: any, index: number) => (
                    index === 0
                        ? { ...base, buriedCards: null }
                        : base
                )),
                madnessDeck: [
                    { uid: 'mad-1', defId: 'special_madness', type: 'action', owner: '0' },
                    { uid: 'mad-2', defId: 'special_madness', type: 'action', owner: '0' },
                ],
            };
        },
        normalizeRuntimeState: (state: any) => normalizeSmashUpMatchStateForUi(state),
    },
    systems: [],
} as unknown as GameEngineConfig;

describe('SmashUp LocalGameProvider runtime normalization', () => {
    afterEach(() => {
        cleanup();
        window.localStorage.clear();
    });

    it('恢复旧对象型 madnessDeck 快照时，会先归一化为 defId 字符串数组', () => {
        const key = 'local_match_snapshot_v1:smashup:smashup-runtime-guard-legacy';
        window.localStorage.setItem(key, JSON.stringify({
            version: 1,
            gameId: 'smashup',
            seed: 'smashup-runtime-guard-legacy',
            numPlayers: 2,
            randomCursor: 0,
            savedAt: Date.now(),
            state: {
                core: {
                    players: {
                        '0': {
                            id: '0',
                            vp: 0,
                            hand: [],
                            deck: [],
                            discard: [],
                            minionsPlayed: 0,
                            minionLimit: 1,
                            actionsPlayed: 0,
                            actionLimit: 1,
                            factions: ['minions_of_cthulhu', 'innsmouth'],
                        },
                        '1': {
                            id: '1',
                            vp: 0,
                            hand: [],
                            deck: [],
                            discard: [],
                            minionsPlayed: 0,
                            minionLimit: 1,
                            actionsPlayed: 0,
                            actionLimit: 1,
                            factions: ['elder_things', 'miskatonic'],
                        },
                    },
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 0,
                    bases: [],
                    baseDeck: [],
                    baseDiscard: [],
                    turnNumber: 1,
                    nextUid: 1,
                    madnessDeck: Array.from({ length: 3 }, (_, i) => ({
                        uid: `mad-${i}`,
                        defId: 'special_madness',
                        type: 'action',
                        owner: '0',
                    })),
                },
                sys: {
                    phase: 'playCards',
                    turnNumber: 1,
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 0,
                    eventStream: { nextId: 1 },
                    interaction: { current: undefined, queue: [], isBlocked: false },
                    responseWindow: { current: undefined },
                },
            },
        }));

        const Board = ({ G }: GameBoardProps<unknown>) => (
            <pre data-testid="smashup-state">{JSON.stringify((G as any)?.core?.madnessDeck)}</pre>
        );

        render(
            <LocalGameProvider
                config={smashupCompatConfig}
                numPlayers={2}
                seed="smashup-runtime-guard-legacy"
                persistSession
            >
                <BoardBridge board={Board} remountKey={false} />
            </LocalGameProvider>,
        );

        return waitFor(() => {
            expect(screen.getByTestId('smashup-state').textContent).toBe('["special_madness","special_madness","special_madness"]');
        });
    });

    it('运行中的本地 dispatch 若产出脏 runtime state，会在渲染前先归一化', async () => {
        const DirtyWriterBoard = () => {
            const { state, dispatch } = useGameClient();

            useEffect(() => {
                dispatch('test:dirty-runtime-state', {});
            }, [dispatch]);

            return <pre data-testid="smashup-runtime-state">{JSON.stringify((state as any)?.core)}</pre>;
        };

        render(
            <LocalGameProvider
                config={smashupDirtyDispatchConfig}
                numPlayers={2}
                seed="smashup-runtime-guard-live-dispatch"
            >
                <DirtyWriterBoard />
            </LocalGameProvider>,
        );

        await waitFor(() => {
            const text = screen.getByTestId('smashup-runtime-state').textContent ?? '';
            expect(text).toContain('"pendingMinionPlayEffects":[]');
            expect(text).not.toContain('"usedDiscardPlayAbilities":null');
            expect(text).toContain('"buriedCards":[]');
            expect(text).toContain('"madnessDeck":["special_madness","special_madness"]');
        });
    });
});
