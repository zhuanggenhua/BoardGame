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
    it('transient notification skips events that already exist when the page session mounts', async () => {
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
                extractCard: (event) => {
                    const payload = event.payload as { playerId?: string; defId?: string };
                    return payload.playerId && payload.defId
                        ? { playerId: payload.playerId, cardData: { defId: payload.defId } }
                        : null;
                },
            }),
            {
                initialProps: { entries: [historicalEntry] },
                wrapper,
            },
        );

        await act(async () => {});
        expect(result.current.queue).toEqual([]);

        rerender({ entries: [historicalEntry, liveEntry] });

        await waitFor(() => {
            expect(result.current.queue).toHaveLength(1);
            expect(result.current.queue[0]?.cardData.defId).toBe('alien_abduction');
        });
    });

    it('transient notification uses EventStream cursor instead of event timestamp to detect new events', async () => {
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
        } as GameEvent);

        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) => useCardSpotlightQueue<{ defId: string }>({
                entries,
                triggerEventTypes: ['ACTION_PLAYED'],
                consumeOnReconcile: true,
                extractCard: (event) => {
                    const payload = event.payload as { playerId?: string; defId?: string };
                    return payload.playerId && payload.defId
                        ? { playerId: payload.playerId, cardData: { defId: payload.defId } }
                        : null;
                },
            }),
            {
                initialProps: { entries: [staleEntry] },
                wrapper,
            },
        );

        await act(async () => {});
        expect(result.current.queue).toEqual([]);

        rerender({ entries: [staleEntry, liveEntry] });

        await waitFor(() => {
            expect(result.current.queue).toHaveLength(1);
            expect(result.current.queue[0]?.cardData.defId).toBe('tricksters_disruption');
        });
    });

    it('keeps visible opponent spotlight across optimistic resync signals without replaying restored old events', async () => {
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
            expect(result.current.queue).toHaveLength(1);
            expect(result.current.queue[0]?.cardData.defId).toBe('time_travelers_time_walk');
        });

        rerender({ entries: [oldEntry] });

        await act(async () => {});
        expect(result.current.queue).toHaveLength(1);
        expect(result.current.queue[0]?.cardData.defId).toBe('time_travelers_time_walk');

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
            expect(result.current.queue).toHaveLength(2);
            expect(result.current.queue.map((item) => item.cardData.defId)).toEqual([
                'time_travelers_time_walk',
                'super_spies_secret_agent',
            ]);
        });
    });
});
