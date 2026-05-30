import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import { SW_EVENTS } from '../domain/types';
import { useMovementTrails } from '../ui/useMovementTrails';

describe('useMovementTrails rollback consumer', () => {
  it('clears stale movement trails on optimistic rollback signal and does not replay restored old events', async () => {
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

    const oldEntry: EventStreamEntry = {
      id: 1,
      event: {
        type: SW_EVENTS.UNIT_MOVED,
        payload: {
          unitId: 'unit-a',
          from: { row: 0, col: 0 },
          to: { row: 3, col: 0 },
          path: [
            { row: 0, col: 0 },
            { row: 1, col: 0 },
            { row: 2, col: 0 },
            { row: 3, col: 0 },
          ],
        },
        timestamp: 1000,
      },
    };

    const newEntry: EventStreamEntry = {
      id: 2,
      event: {
        type: SW_EVENTS.UNIT_MOVED,
        payload: {
          unitId: 'unit-b',
          from: { row: 1, col: 1 },
          to: { row: 1, col: 4 },
          path: [
            { row: 1, col: 1 },
            { row: 1, col: 2 },
            { row: 1, col: 3 },
            { row: 1, col: 4 },
          ],
        },
        timestamp: 2000,
      },
    };

    const { result, rerender } = renderHook(
      ({ entries }: { entries: EventStreamEntry[] }) => useMovementTrails({ entries }),
      {
        initialProps: { entries: [] },
        wrapper,
      },
    );

    rerender({ entries: [oldEntry] });

    await waitFor(() => {
      expect(result.current.trails).toHaveLength(1);
      expect(result.current.trails[0]?.unitId).toBe('unit-a');
    });

    rollbackValue = {
      watermark: null,
      seq: 1,
      reconcileSeq: 0,
    };

    rerender({ entries: [] });

    await waitFor(() => {
      expect(result.current.trails).toEqual([]);
    });

    rerender({ entries: [oldEntry] });

    await waitFor(() => {
      expect(result.current.trails).toEqual([]);
    });

    rerender({ entries: [oldEntry, newEntry] });

    await waitFor(() => {
      expect(result.current.trails).toHaveLength(1);
      expect(result.current.trails[0]?.unitId).toBe('unit-b');
    });
  });
});
