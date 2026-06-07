import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FxBus } from '../../../engine/fx';
import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry, MatchState, GameEvent } from '../../../engine/types';
import type { SmashUpCore } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { useGameEvents } from '../ui/useGameEvents';

function createEntry(id: number, event: GameEvent): EventStreamEntry {
  return {
    id,
    event,
  };
}

function createState(
  entries: EventStreamEntry[],
  interactionPlayerId?: string,
): MatchState<SmashUpCore> {
  return {
    core: {} as SmashUpCore,
    sys: {
      eventStream: {
        entries,
        maxEntries: 50,
        nextId: entries.length + 1,
      },
      interaction: interactionPlayerId
        ? {
            current: {
              playerId: interactionPlayerId,
            },
          }
        : undefined,
    },
  } as MatchState<SmashUpCore>;
}

describe('useGameEvents rollback consumer', () => {
  it('在 optimistic rollback signal 后清空旧 feedback，且恢复旧事件时不重播', async () => {
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

    const oldFeedbackEntry = createEntry(1, {
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: {
        playerId: '0',
        messageKey: 'feedback.secret_agent_discard',
        tone: 'warning',
      },
      timestamp: 1000,
    });

    const newLimitEntry = createEntry(2, {
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: {
        playerId: '0',
        limitType: 'action',
        delta: 1,
        reason: 'time_travelers_time_walk',
      },
      timestamp: 2000,
    });

    const fxBus: FxBus = {
      push: vi.fn(() => null),
      pushEvent: vi.fn(() => null),
      pushSequence: vi.fn(() => null),
      cancelSequence: vi.fn(),
      activeEffects: [],
      removeEffect: vi.fn(),
      registry: {} as FxBus['registry'],
      fireImpact: vi.fn(),
    };

    const baseRefs = {
      current: new Map<number, HTMLElement>(),
    };

    const { result, rerender } = renderHook(
      ({ G }: { G: MatchState<SmashUpCore> }) => useGameEvents({
        G,
        myPlayerId: '0',
        fxBus,
        baseRefs,
      }),
      {
        initialProps: { G: createState([]) },
        wrapper,
      },
    );

    rerender({ G: createState([oldFeedbackEntry]) });

    await waitFor(() => {
      expect(result.current.feedbacks).toHaveLength(1);
      expect(result.current.feedbacks[0]?.messageKey).toBe('feedback.secret_agent_discard');
    });

    rollbackValue = {
      watermark: null,
      seq: 1,
      reconcileSeq: 0,
    };

    rerender({ G: createState([]) });

    await waitFor(() => {
      expect(result.current.feedbacks).toEqual([]);
    });

    rerender({ G: createState([oldFeedbackEntry]) });

    await waitFor(() => {
      expect(result.current.feedbacks).toEqual([]);
    });

    rerender({ G: createState([oldFeedbackEntry, newLimitEntry]) });

    await waitFor(() => {
      expect(result.current.feedbacks).toHaveLength(1);
      expect(result.current.feedbacks[0]?.messageKey).toBe('ui.extra_action_granted');
    });
  });
});
