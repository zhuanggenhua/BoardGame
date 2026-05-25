import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import { useActiveModifiers } from '../hooks/useActiveModifiers';

function createModifierPlayedEntry(id: number, cardId: string, timestamp: number): EventStreamEntry {
    return {
        id,
        event: {
            type: 'CARD_PLAYED',
            payload: {
                cardId,
            },
            timestamp,
        },
    };
}

function HookProbe({ entries }: { entries: EventStreamEntry[] }) {
    const { activeModifiers } = useActiveModifiers({ eventStreamEntries: entries });
    return <pre data-testid="active-modifiers-state">{JSON.stringify(activeModifiers.map((item) => item.cardId))}</pre>;
}

describe('useActiveModifiers rollback consumer', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('clears stale active modifiers on optimistic rollback signal and only restores live server events after resync', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});

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

        const oldEntry = createModifierPlayedEntry(1, 'card-more-please', 1000);
        const newEntry = createModifierPlayedEntry(2, 'card-red-hot', 2000);

        const view = render(<HookProbe entries={[]} />, { wrapper });

        view.rerender(<HookProbe entries={[oldEntry]} />);

        await waitFor(() => {
            expect(screen.getByTestId('active-modifiers-state').textContent).toBe('["card-more-please"]');
        });

        rollbackValue = {
            watermark: null,
            seq: 1,
            reconcileSeq: 0,
        };

        view.rerender(<HookProbe entries={[]} />);

        await waitFor(() => {
            expect(screen.getByTestId('active-modifiers-state').textContent).toBe('[]');
        });

        view.rerender(<HookProbe entries={[newEntry]} />);

        await waitFor(() => {
            expect(screen.getByTestId('active-modifiers-state').textContent).toBe('["card-red-hot"]');
        });
    });
});
