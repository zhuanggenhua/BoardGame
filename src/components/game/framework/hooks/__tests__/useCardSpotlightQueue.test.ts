import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EventStreamEntry, GameEvent } from '../../../../../engine/types';
import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../../../engine/hooks/EventStreamRollbackContext';
import { useCardSpotlightQueue } from '../useCardSpotlightQueue';

function createEntry(id: number, event: GameEvent): EventStreamEntry {
    return {
        id,
        event,
    } as EventStreamEntry;
}

describe('useCardSpotlightQueue', () => {
    it('can ignore historical events that predate the current page session', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: { watermark: null, seq: 0, reconcileSeq: 0 } satisfies EventStreamRollbackValue },
                children,
            );

        const historicalEntry = createEntry(1, {
            type: 'ACTION_PLAYED',
            payload: {
                playerId: '1',
                defId: 'alien_probe',
            },
            timestamp: 1000,
        } as GameEvent);
        const liveEntry = createEntry(2, {
            type: 'ACTION_PLAYED',
            payload: {
                playerId: '1',
                defId: 'alien_abduction',
            },
            timestamp: 3000,
        } as GameEvent);

        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) => useCardSpotlightQueue<{ defId: string }>({
                entries,
                triggerEventTypes: ['ACTION_PLAYED'],
                ignoreEventsBefore: 2000,
                extractCard: (event) => {
                    const payload = event.payload as { playerId?: string; defId?: string };
                    return payload.playerId && payload.defId
                        ? { playerId: payload.playerId, cardData: { defId: payload.defId } }
                        : null;
                },
            }),
            {
                initialProps: { entries: [] },
                wrapper,
            },
        );

        rerender({ entries: [historicalEntry] });

        await act(async () => {});
        expect(result.current.queue).toEqual([]);

        rerender({ entries: [historicalEntry, liveEntry] });

        await waitFor(() => {
            expect(result.current.queue).toHaveLength(1);
            expect(result.current.queue[0]?.cardData.defId).toBe('alien_abduction');
        });
    });

    it('skips timestamp-less historical events when the current page session has a time floor', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: { watermark: null, seq: 0, reconcileSeq: 0 } satisfies EventStreamRollbackValue },
                children,
            );

        const staleEntry = createEntry(1, {
            type: 'ACTION_PLAYED',
            payload: {
                playerId: '1',
                defId: 'zombies_the_dead_rise',
            },
        } as GameEvent);
        const liveEntry = createEntry(2, {
            type: 'ACTION_PLAYED',
            payload: {
                playerId: '1',
                defId: 'tricksters_disruption',
            },
            timestamp: 3000,
        } as GameEvent);

        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) => useCardSpotlightQueue<{ defId: string }>({
                entries,
                triggerEventTypes: ['ACTION_PLAYED'],
                consumeOnReconcile: true,
                ignoreEventsBefore: 2000,
                extractCard: (event) => {
                    const payload = event.payload as { playerId?: string; defId?: string };
                    return payload.playerId && payload.defId
                        ? { playerId: payload.playerId, cardData: { defId: payload.defId } }
                        : null;
                },
            }),
            {
                initialProps: { entries: [] },
                wrapper,
            },
        );

        rerender({ entries: [staleEntry] });

        await act(async () => {});
        expect(result.current.queue).toEqual([]);

        rerender({ entries: [staleEntry, liveEntry] });

        await waitFor(() => {
            expect(result.current.queue).toHaveLength(1);
            expect(result.current.queue[0]?.cardData.defId).toBe('tricksters_disruption');
        });
    });

    it('clears stale spotlight queue on optimistic rollback signal and does not replay restored old events', async () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const oldEntry = createEntry(1, {
            type: 'ACTION_PLAYED',
            payload: {
                playerId: '1',
                defId: 'time_travelers_time_walk',
            },
            timestamp: 1000,
        } as GameEvent);

        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) => useCardSpotlightQueue<{ defId: string }>({
                entries,
                triggerEventTypes: ['ACTION_PLAYED'],
                extractCard: (event) => {
                    const payload = event.payload as { playerId?: string; defId?: string };
                    return payload.playerId && payload.defId
                        ? { playerId: payload.playerId, cardData: { defId: payload.defId } }
                        : null;
                },
            }),
            {
                initialProps: { entries: [] },
                wrapper,
            },
        );

        rerender({ entries: [oldEntry] });

        await waitFor(() => {
            expect(result.current.queue).toHaveLength(1);
            expect(result.current.queue[0]?.cardData.defId).toBe('time_travelers_time_walk');
        });

        rollbackValue = {
            watermark: null,
            seq: 1,
            reconcileSeq: 0,
        };

        rerender({ entries: [] });

        await waitFor(() => {
            expect(result.current.queue).toEqual([]);
        });

        rerender({ entries: [oldEntry] });

        await act(async () => {});
        expect(result.current.queue).toEqual([]);

        const newEntry = createEntry(2, {
            type: 'ACTION_PLAYED',
            payload: {
                playerId: '1',
                defId: 'super_spies_secret_agent',
            },
            timestamp: 2000,
        } as GameEvent);

        rerender({ entries: [oldEntry, newEntry] });

        await waitFor(() => {
            expect(result.current.queue).toHaveLength(1);
            expect(result.current.queue[0]?.cardData.defId).toBe('super_spies_secret_agent');
        });
    });
});
