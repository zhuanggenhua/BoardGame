import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry, MatchState } from '../../../engine/types';
import type { FxBus } from '../../../engine/fx';
import type { UseVisualSequenceGateReturn } from '../../../components/game/framework/hooks/useVisualSequenceGate';
import { SW_EVENTS } from '../domain/types';
import { useGameEvents } from '../ui/useGameEvents';

function makeAttackEntry(id: number, hits: number): EventStreamEntry {
  return {
    id,
    event: {
      type: SW_EVENTS.UNIT_ATTACKED,
      payload: {
        attacker: { row: 0, col: 0 },
        target: { row: 0, col: 1 },
        attackType: 'melee',
        hits,
        diceCount: 1,
        diceResults: [
          { faceIndex: id, marks: hits > 3 ? ['special'] : ['melee'] },
        ],
      },
      timestamp: id * 1000,
    },
  };
}

function makeState(entries: EventStreamEntry[]): MatchState<any> {
  return {
    board: [
      [
        {
          unit: {
            owner: '0',
          },
        },
        {
          unit: {
            owner: '1',
          },
        },
      ],
    ],
    sys: {
      eventStream: {
        entries,
        maxEntries: 200,
        nextId: entries.length + 1,
      },
    },
  } as MatchState<any>;
}

function makeGate(): UseVisualSequenceGateReturn {
  return {
    beginSequence: vi.fn(),
    endSequence: vi.fn(),
    scheduleInteraction: vi.fn((fn: () => void) => fn()),
    isVisualBusy: false,
    reset: vi.fn(),
  };
}

describe('useGameEvents rollback consumer', () => {
  it('optimistic rollback 后应清空旧骰子结果，恢复旧攻击事件不重播，只消费后续新攻击事件', async () => {
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

    const gate = makeGate();
    const fxBus = { push: vi.fn() } as unknown as FxBus;
    const pushDestroyEffect = vi.fn();
    const onDiceRollSound = vi.fn();

    const oldEntry = makeAttackEntry(1, 3);
    const newEntry = makeAttackEntry(2, 5);

    const { result, rerender } = renderHook(
      ({ entries }: { entries: EventStreamEntry[] }) =>
        useGameEvents({
          G: makeState(entries),
          core: makeState(entries) as any,
          myPlayerId: '0',
          currentPhase: 'battle',
          pushDestroyEffect,
          fxBus,
          onDiceRollSound,
          gate,
        }),
      {
        initialProps: { entries: [] as EventStreamEntry[] },
        wrapper,
      },
    );

    expect(result.current.diceResult).toBeNull();

    act(() => {
      rerender({ entries: [oldEntry] });
    });

    await waitFor(() => {
      expect(result.current.diceResult?.hits).toBe(3);
      expect(gate.beginSequence).toHaveBeenCalledTimes(1);
      expect(onDiceRollSound).toHaveBeenCalledTimes(1);
    });

    rollbackValue = {
      watermark: null,
      seq: 1,
      reconcileSeq: 0,
    };

    act(() => {
      rerender({ entries: [] });
    });

    await waitFor(() => {
      expect(result.current.diceResult).toBeNull();
      expect(gate.reset).toHaveBeenCalledTimes(1);
    });

    act(() => {
      rerender({ entries: [oldEntry] });
    });

    await waitFor(() => {
      expect(result.current.diceResult).toBeNull();
      expect(gate.beginSequence).toHaveBeenCalledTimes(1);
      expect(onDiceRollSound).toHaveBeenCalledTimes(1);
    });

    act(() => {
      rerender({ entries: [oldEntry, newEntry] });
    });

    await waitFor(() => {
      expect(result.current.diceResult?.hits).toBe(5);
      expect(gate.beginSequence).toHaveBeenCalledTimes(2);
      expect(onDiceRollSound).toHaveBeenCalledTimes(2);
    });
  });

  it('required sequence 应按事件流 id 消费新攻击事件，不因旧 timestamp 跳过必播动画', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EventStreamRollbackContext.Provider value={{ watermark: null, seq: 0, reconcileSeq: 0 }}>
        {children}
      </EventStreamRollbackContext.Provider>
    );

    const gate = makeGate();
    const fxBus = { push: vi.fn() } as unknown as FxBus;
    const pushDestroyEffect = vi.fn();
    const onDiceRollSound = vi.fn();
    const baselineEntry = makeAttackEntry(10, 2);
    const newEntryWithOldTimestamp = {
      ...makeAttackEntry(11, 4),
      event: {
        ...makeAttackEntry(11, 4).event,
        timestamp: 1,
      },
    } as EventStreamEntry;

    const { result, rerender } = renderHook(
      ({ entries }: { entries: EventStreamEntry[] }) =>
        useGameEvents({
          G: makeState(entries),
          core: makeState(entries) as any,
          myPlayerId: '0',
          currentPhase: 'battle',
          pushDestroyEffect,
          fxBus,
          onDiceRollSound,
          gate,
        }),
      {
        initialProps: { entries: [baselineEntry] },
        wrapper,
      },
    );

    await act(async () => {});
    expect(result.current.diceResult).toBeNull();
    expect(gate.beginSequence).not.toHaveBeenCalled();

    act(() => {
      rerender({ entries: [baselineEntry, newEntryWithOldTimestamp] });
    });

    await waitFor(() => {
      expect(result.current.diceResult?.hits).toBe(4);
      expect(gate.beginSequence).toHaveBeenCalledTimes(1);
      expect(onDiceRollSound).toHaveBeenCalledTimes(1);
    });
  });

  it('wait-confirm 正常确认应消费新增充能事件，重复 reconcile 不重播', () => {
    let rollbackValue: EventStreamRollbackValue = { watermark: null, seq: 0, reconcileSeq: 0 };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EventStreamRollbackContext.Provider value={rollbackValue}>{children}</EventStreamRollbackContext.Provider>
    );
    const push = vi.fn();
    const gate = makeGate();
    const { rerender } = renderHook(({ entries }: { entries: EventStreamEntry[] }) => useGameEvents({
      G: makeState(entries), core: makeState(entries) as any, myPlayerId: '0', currentPhase: 'summon',
      pushDestroyEffect: vi.fn(), fxBus: { push } as unknown as FxBus, gate,
    }), { initialProps: { entries: [] as EventStreamEntry[] }, wrapper });
    const charge: EventStreamEntry = { id: 1, event: { type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: { row: 0, col: 0 }, delta: 1 }, timestamp: 1000 } };
    rollbackValue = { ...rollbackValue, reconcileSeq: 1 };
    act(() => rerender({ entries: [charge] }));
    expect(push).toHaveBeenCalledTimes(1);
    rollbackValue = { ...rollbackValue, reconcileSeq: 2 };
    act(() => rerender({ entries: [charge] }));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('位移后的延迟充能 FX 在 rollback 后取消，卸载也不能泄漏旧回调', () => {
    vi.useFakeTimers();
    let rollbackValue: EventStreamRollbackValue = { watermark: null, seq: 0, reconcileSeq: 0 };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EventStreamRollbackContext.Provider value={rollbackValue}>{children}</EventStreamRollbackContext.Provider>
    );
    const push = vi.fn();
    const gate = makeGate();
    const { rerender, unmount } = renderHook(({ entries }: { entries: EventStreamEntry[] }) => useGameEvents({
      G: makeState(entries), core: makeState(entries) as any, myPlayerId: '0', currentPhase: 'move',
      pushDestroyEffect: vi.fn(), fxBus: { push } as unknown as FxBus, gate,
    }), { initialProps: { entries: [] as EventStreamEntry[] }, wrapper });
    const entries: EventStreamEntry[] = [
      { id: 1, event: { type: SW_EVENTS.UNIT_MOVED, payload: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } }, timestamp: 1000 } },
      { id: 2, event: { type: SW_EVENTS.UNIT_CHARGED, payload: { position: { row: 0, col: 1 }, delta: 1 }, timestamp: 1000 } },
    ];
    try {
      act(() => rerender({ entries }));
      expect(push).not.toHaveBeenCalled();
      rollbackValue = { ...rollbackValue, seq: 1 };
      act(() => rerender({ entries: [] }));
      act(() => vi.advanceTimersByTime(300));
      expect(push).not.toHaveBeenCalled();
      // Queue a fresh, still-pending visual after rollback, then unmount before
      // its delay expires. This exercises teardown independently of rollback.
      act(() => rerender({ entries: entries.map(entry => ({ ...entry, id: entry.id + 2 })) }));
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      unmount();
      act(() => vi.runOnlyPendingTimers());
      expect(push).not.toHaveBeenCalled();
    } finally { unmount(); vi.useRealTimers(); }
  });

});
