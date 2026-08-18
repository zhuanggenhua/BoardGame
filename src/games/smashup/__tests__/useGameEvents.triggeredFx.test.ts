import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FxAnchorSnapshot, FxBus } from '../../../engine/fx';
import type { EventStreamEntry, GameEvent, MatchState } from '../../../engine/types';
import { initAllAbilities } from '../abilities';
import type { SmashUpCore } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SU_FX } from '../ui/fxSetup';
import {
  SMASH_UP_TABLE_FX_SURFACE_ID,
  smashUpBaseAnchorId,
  useGameEvents,
} from '../ui/useGameEvents';

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

function createBaseSnapshot(baseIndex: number): FxAnchorSnapshot {
  const anchorId = smashUpBaseAnchorId(baseIndex);
  return {
    surfaceId: SMASH_UP_TABLE_FX_SURFACE_ID,
    anchorId,
    anchorKind: 'base',
    entityRef: anchorId,
    box: { left: 24, top: 36, width: 18, height: 14 },
    center: { xPct: 33, yPct: 43 },
    size: { widthPct: 18, heightPct: 14 },
    capturedAt: 123,
    mode: 'spawn-snapshot',
  };
}

describe('useGameEvents triggered FX', () => {
  it('触发器导致消灭时应推入更明确的触发提示参数', async () => {
    initAllAbilities();

    const fxBus = createFxBus();

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

  it('无地图牌桌事件应优先用基地 anchor snapshot 驱动力量和计分 FX', async () => {
    const fxBus = createFxBus();
    const baseSnapshot = createBaseSnapshot(1);
    const resolveFxAnchorSnapshot = vi.fn(() => baseSnapshot);
    const baseRefs = {
      current: new Map<number, HTMLElement>(),
    };
    const minionPlayedEntry = createEntry(1, {
      type: SU_EVENTS.MINION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'minion-1',
        defId: 'pirate_first_mate',
        baseIndex: 1,
        power: 3,
      },
      timestamp: 1000,
    });
    const baseScoredEntry = createEntry(2, {
      type: SU_EVENTS.BASE_SCORED,
      payload: {
        baseIndex: 1,
        baseDefId: 'base_test',
        rankings: [{ playerId: '0', power: 7, vp: 3 }],
      },
      timestamp: 1001,
    });

    const { rerender } = renderHook(
      ({ G }: { G: MatchState<SmashUpCore> }) => useGameEvents({
        G,
        myPlayerId: '0',
        fxBus,
        baseRefs,
        resolveFxAnchorSnapshot,
      }),
      {
        initialProps: { G: createState([]) },
      },
    );

    rerender({ G: createState([minionPlayedEntry, baseScoredEntry]) });

    await waitFor(() => {
      expect(fxBus.push).toHaveBeenCalledWith(
        SU_FX.POWER_CHANGE,
        expect.objectContaining({
          space: 'table',
          surfaceId: SMASH_UP_TABLE_FX_SURFACE_ID,
          targetSnapshot: baseSnapshot,
        }),
        expect.objectContaining({
          delta: 3,
          targetSnapshot: baseSnapshot,
        }),
      );
      expect(fxBus.push).toHaveBeenCalledWith(
        SU_FX.BASE_SCORED,
        expect.objectContaining({
          space: 'table',
          surfaceId: SMASH_UP_TABLE_FX_SURFACE_ID,
          targetSnapshot: baseSnapshot,
        }),
        expect.objectContaining({
          baseIndex: 1,
          targetSnapshot: baseSnapshot,
          rankings: [expect.objectContaining({ playerId: '0', vp: 3 })],
        }),
      );
    });

    expect(resolveFxAnchorSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      surfaceId: SMASH_UP_TABLE_FX_SURFACE_ID,
      anchorId: 'base:1',
      anchorKind: 'base',
    }));
  });
});
