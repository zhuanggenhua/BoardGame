import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('SmashUp action spotlight suppression', () => {
  it('行动卡打出应走瞬时 FX 展示，不回到手动关闭特写队列', async () => {
    const fxBus = createFxBus();
    const baseRefs = {
      current: new Map<number, HTMLElement>(),
    };
    const actionEntry = createEntry(1, {
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '1',
        defId: 'princesses_heirloom',
      },
      timestamp: 1000,
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

    rerender({ G: createState([actionEntry]) });

    await waitFor(() => {
      expect(fxBus.push).toHaveBeenCalledWith(
        SU_FX.ACTION_SHOW,
        { space: 'screen' },
        { defId: 'princesses_heirloom' },
      );
    });
  });
});
