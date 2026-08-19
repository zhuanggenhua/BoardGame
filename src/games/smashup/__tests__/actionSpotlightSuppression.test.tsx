import React from 'react';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardSpotlightQueue, useCardSpotlightQueue } from '../../../components/game/framework';
import type { FxBus } from '../../../engine/fx';
import type { EventStreamEntry, GameEvent, MatchState } from '../../../engine/types';
import type { SmashUpCore } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SU_FX } from '../ui/fxSetup';
import { useGameEvents } from '../ui/useGameEvents';

function createEntry(id: number, event: GameEvent): EventStreamEntry {
  return { id, event };
}

function createState(entries: EventStreamEntry[]): MatchState<SmashUpCore> {
  return {
    core: {} as SmashUpCore,
    sys: {
      eventStream: {
        entries,
        maxEntries: 50,
        nextId: entries.length + 1,
      },
    },
  } as MatchState<SmashUpCore>;
}

function createFxBus(): FxBus {
  return {
    push: vi.fn(() => null),
    pushEvent: vi.fn(() => null),
    pushSequence: vi.fn(() => null),
    cancelSequence: vi.fn(),
    activeEffects: [],
    removeEffect: vi.fn(),
    registry: {} as FxBus['registry'],
    fireImpact: vi.fn(),
  };
}

function makeActionPlayedEntry(id: number, playerId: string, defId: string): EventStreamEntry {
  return createEntry(id, {
    type: SU_EVENTS.ACTION_PLAYED,
    payload: {
      playerId,
      defId,
    },
    timestamp: id * 100,
  });
}

function SpotlightHarness({ entries }: { entries: EventStreamEntry[] }) {
  const { queue, dismiss } = useCardSpotlightQueue<{ defId: string }>({
    entries,
    currentPlayerId: null,
    consumeOnReconcile: true,
    triggerEventTypes: [SU_EVENTS.ACTION_PLAYED],
    extractCard: (event) => {
      const payload = event.payload as { playerId?: string; defId?: string } | undefined;
      if (!payload?.playerId || !payload.defId) return null;
      return {
        playerId: payload.playerId,
        cardData: { defId: payload.defId },
      };
    },
    maxQueue: 5,
  });

  return (
    <CardSpotlightQueue
      queue={queue}
      onDismiss={dismiss}
      renderCard={(item) => (
        <div
          data-testid="smashup-action-spotlight-card"
          data-card-def-id={item.cardData.defId}
        >
          {item.cardData.defId}
        </div>
      )}
    />
  );
}

describe('SmashUp action spotlight suppression', () => {
  it('行动卡打出不再走自动退场 FX', async () => {
    const fxBus = createFxBus();
    const baseEl = document.createElement('div');
    baseEl.getBoundingClientRect = vi.fn(() => ({
      left: 20,
      top: 30,
      right: 220,
      bottom: 180,
      width: 200,
      height: 150,
      x: 20,
      y: 30,
      toJSON: () => ({}),
    }));
    const baseRefs = {
      current: new Map<number, HTMLElement>([[0, baseEl]]),
    };
    const actionEntry = makeActionPlayedEntry(1, '1', 'princesses_heirloom');
    const minionEntry = createEntry(2, {
      type: SU_EVENTS.MINION_PLAYED,
      payload: {
        playerId: '1',
        cardUid: 'minion-1',
        defId: 'pirate_first_mate',
        baseIndex: 0,
        power: 3,
      },
      timestamp: 200,
    });

    const { rerender } = renderHook(
      ({ G }: { G: MatchState<SmashUpCore> }) => useGameEvents({
        G,
        myPlayerId: '0',
        fxBus,
        baseRefs,
      }),
      {
        initialProps: { G: createState([]) },
      },
    );

    rerender({ G: createState([actionEntry, minionEntry]) });

    await waitFor(() => {
      expect(fxBus.push).toHaveBeenCalledWith(
        SU_FX.POWER_CHANGE,
        { space: 'screen' },
        {
          delta: 3,
          position: { left: 228, top: 20 },
        },
      );
    });
    expect(fxBus.push).toHaveBeenCalledTimes(1);
  });

  it('行动卡特写保持到玩家点击空白背景关闭，关闭后不会回流旧卡面', async () => {
    const eventEntries = [makeActionPlayedEntry(2, '1', 'super_spies_secret_agent')];
    const { rerender } = render(<SpotlightHarness entries={[]} />);

    rerender(<SpotlightHarness entries={eventEntries} />);

    expect(await screen.findByTestId('smashup-action-spotlight-card')).toHaveAttribute(
      'data-card-def-id',
      'super_spies_secret_agent',
    );

    fireEvent.click(screen.getByTestId('card-spotlight-content'));
    expect(await screen.findByTestId('smashup-action-spotlight-card')).toHaveAttribute(
      'data-card-def-id',
      'super_spies_secret_agent',
    );

    fireEvent.click(screen.getByTestId('card-spotlight-queue'));

    await waitFor(() => {
      expect(screen.queryByTestId('card-spotlight-queue')).toBeNull();
    });

    rerender(<SpotlightHarness entries={eventEntries} />);

    await waitFor(() => {
      expect(screen.queryByTestId('smashup-action-spotlight-card')).toBeNull();
      expect(screen.queryByTestId('card-spotlight-queue')).toBeNull();
    });
  });
});
