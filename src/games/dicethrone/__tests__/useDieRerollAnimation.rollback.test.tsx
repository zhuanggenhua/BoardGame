import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import { useDieRerollAnimationConsumer } from '../hooks/useDieRerollAnimationConsumer';

function createDieRerolledEntry(id: number, dieId: number, timestamp: number): EventStreamEntry {
    return {
        id,
        event: {
            type: 'DIE_REROLLED',
            payload: {
                dieId,
                oldValue: 2,
                newValue: 5,
                playerId: '0',
            },
            timestamp,
        },
    };
}

function HookProbe({ entries }: { entries: EventStreamEntry[] }) {
    const [rerollingDiceIds, setRerollingDiceIds] = React.useState<number[]>([]);
    useDieRerollAnimationConsumer({
        eventStreamEntries: entries,
        setRerollingDiceIds,
        clearDelayMs: 600,
    });

    return <pre data-testid="rerolling-dice-ids">{JSON.stringify(rerollingDiceIds)}</pre>;
}

describe('useDieRerollAnimationConsumer rollback consumer', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('clears stale reroll animation on optimistic rollback and does not replay restored old DIE_REROLLED events', async () => {
        vi.useFakeTimers();

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

        const oldEntry = createDieRerolledEntry(1, 101, 1000);
        const newEntry = createDieRerolledEntry(2, 202, 2000);

        const view = render(<HookProbe entries={[]} />, { wrapper });

        await act(async () => {
            view.rerender(<HookProbe entries={[oldEntry]} />);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[101]');

        rollbackValue = {
            watermark: null,
            seq: 1,
            reconcileSeq: 0,
        };

        await act(async () => {
            view.rerender(<HookProbe entries={[]} />);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[]');

        await act(async () => {
            view.rerender(<HookProbe entries={[oldEntry]} />);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[]');

        await act(async () => {
            view.rerender(<HookProbe entries={[oldEntry, newEntry]} />);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[202]');

        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[]');
    });
});
