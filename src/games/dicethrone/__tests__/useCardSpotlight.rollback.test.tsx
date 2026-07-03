import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import { useCardSpotlight } from '../hooks/useCardSpotlight';

function HookProbe({
    streamEntries,
    selectedCharacters = {
        '0': 'monk',
        '1': 'gunslinger',
    },
}: {
    streamEntries: EventStreamEntry[];
    selectedCharacters?: Record<string, any>;
}) {
    const state = useCardSpotlight({
        eventStreamEntries: streamEntries,
        currentPlayerId: '0',
        opponentName: '对手',
        selectedCharacters,
    });

    return (
        <pre data-testid="rollback-card-spotlight-state">
            {JSON.stringify({
                cardSpotlightQueue: state.cardSpotlightQueue,
                bonusDie: state.bonusDie,
            })}
        </pre>
    );
}

describe('useCardSpotlight rollback consumer', () => {
    it('uses the card preview from the play event instead of recalculating by viewer state', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
                {children}
            </EventStreamRollbackContext.Provider>
        );

        const playedByGunslingerEntry: EventStreamEntry = {
            id: 1,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'card-next-time',
                    previewRef: {
                        type: 'atlas',
                        atlasId: 'dicethrone-gunslinger-cards',
                        index: 9,
                    },
                },
                timestamp: 1000,
            },
        };

        const view = render(
            <HookProbe
                streamEntries={[]}
                selectedCharacters={{
                    '0': 'monk',
                    // Simulates a stale or missing opponent hero mapping in PvP.
                    '1': 'monk',
                }}
            />,
            { wrapper },
        );

        view.rerender(
            <HookProbe
                streamEntries={[playedByGunslingerEntry]}
                selectedCharacters={{
                    '0': 'monk',
                    // Simulates a stale or missing opponent hero mapping in PvP.
                    '1': 'monk',
                }}
            />,
        );

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].previewRef).toEqual({
                type: 'atlas',
                atlasId: 'dicethrone-gunslinger-cards',
                index: 9,
            });
        });
    });

    it('clears stale spotlight and bonus-die state on optimistic rollback signal and does not replay restored old events', async () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <EventStreamRollbackContext.Provider value={rollbackValue}>
                {children}
            </EventStreamRollbackContext.Provider>
        );

        const oldCardEntry: EventStreamEntry = {
            id: 1,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'card-next-time',
                },
                timestamp: 1000,
            },
        };

        const oldBonusEntry: EventStreamEntry = {
            id: 2,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '0',
                    targetPlayerId: '1',
                    value: 4,
                    face: 'sword',
                    effectKey: 'totalDamageContribution',
                    effectParams: { value: 4 },
                },
                timestamp: 1500,
            },
        };

        const newCardEntry: EventStreamEntry = {
            id: 3,
            event: {
                type: 'CARD_PLAYED',
                payload: {
                    playerId: '1',
                    cardId: 'watch-out',
                },
                timestamp: 3000,
            },
        };

        const newBonusEntry: EventStreamEntry = {
            id: 4,
            event: {
                type: 'BONUS_DIE_ROLLED',
                payload: {
                    playerId: '0',
                    targetPlayerId: '1',
                    value: 6,
                    face: 'crit',
                    effectKey: 'totalDamageContribution',
                    effectParams: { value: 6 },
                },
                timestamp: 4000,
            },
        };

        const view = render(<HookProbe streamEntries={[]} />, { wrapper });

        view.rerender(<HookProbe streamEntries={[oldCardEntry, oldBonusEntry]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('card-next-time-1000');
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(4);
        });

        rollbackValue = {
            watermark: null,
            seq: 1,
            reconcileSeq: 0,
        };

        view.rerender(<HookProbe streamEntries={[]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toEqual([]);
            expect(state.bonusDie.show).toBe(false);
        });

        view.rerender(<HookProbe streamEntries={[oldCardEntry, oldBonusEntry]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toEqual([]);
            expect(state.bonusDie.show).toBe(false);
        });

        view.rerender(<HookProbe streamEntries={[oldCardEntry, oldBonusEntry, newCardEntry, newBonusEntry]} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rollback-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].id).toBe('watch-out-3000');
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(6);
        });
    });
});
