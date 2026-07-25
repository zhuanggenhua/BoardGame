import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FxBus } from '../../../engine/fx';
import type { EventStreamEntry, GameEvent, MatchState } from '../../../engine/types';
import { initAllAbilities } from '../abilities';
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

describe('useGameEvents triggered FX', () => {
  it('触发器导致消灭时应推入更明确的触发提示参数', async () => {
    initAllAbilities();

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

    const baseEl = {
      getBoundingClientRect: () => ({
        left: 120,
        top: 80,
        width: 300,
        height: 240,
        right: 420,
        bottom: 320,
        x: 120,
        y: 80,
        toJSON: () => null,
      }),
    } as unknown as HTMLElement;

    const baseRefs = {
      current: new Map<number, HTMLElement>([[0, baseEl]]),
    };

    const destroyedEntry = createEntry(1, {
      type: SU_EVENTS.MINION_DESTROYED,
      payload: {
        minionUid: 'enemy-minion',
        minionDefId: 'pirate_first_mate',
        fromBaseIndex: 0,
        ownerId: '1',
        controllerId: '1',
        reason: 'trickster_leprechaun',
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

    rerender({ G: createState([destroyedEntry]) });

    await waitFor(() => {
      expect(fxBus.push).toHaveBeenCalledWith(
        SU_FX.ABILITY_TRIGGERED,
        { space: 'screen' },
        expect.objectContaining({
          sourceDefId: 'trickster_leprechaun',
          targetDefId: 'pirate_first_mate',
          actionKind: 'destroy',
          effectLabel: '消灭',
          highlightTone: 'danger',
          position: { left: 270, top: 147.2 },
        }),
      );
    });
  });
});
