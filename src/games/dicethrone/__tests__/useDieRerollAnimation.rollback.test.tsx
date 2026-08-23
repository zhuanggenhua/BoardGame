import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import { useDieRerollAnimationConsumer } from '../hooks/useDieRerollAnimationConsumer';

function createDieRerolledEntry(
    id: number,
    dieId: number,
    timestamp: number,
    values: { oldValue: number; newValue: number } = { oldValue: 2, newValue: 5 },
): EventStreamEntry {
    return {
        id,
        event: {
            type: 'DIE_REROLLED',
            payload: {
                dieId,
                oldValue: values.oldValue,
                newValue: values.newValue,
                playerId: '0',
            },
            timestamp,
        },
    };
}

function HookProbe({ entries }: { entries: EventStreamEntry[] }) {
    const [rerollingDiceIds, setRerollingDiceIds] = React.useState<number[]>([]);
    const [rerollAnimationSeq, setRerollAnimationSeq] = React.useState(0);
    useDieRerollAnimationConsumer({
        eventStreamEntries: entries,
        setRerollingDiceIds,
        setRerollAnimationSeq,
        clearDelayMs: 600,
    });

    return (
        <>
            <pre data-testid="rerolling-dice-ids">{JSON.stringify(rerollingDiceIds)}</pre>
            <pre data-testid="reroll-animation-seq">{rerollAnimationSeq}</pre>
        </>
    );
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

    it('同点数重掷事件也会推进动画编号', async () => {
        vi.useFakeTimers();

        const sameValueEntry = createDieRerolledEntry(1, 7, 1000, { oldValue: 6, newValue: 6 });
        const nextSameValueEntry = createDieRerolledEntry(2, 7, 1200, { oldValue: 6, newValue: 6 });

        const view = render(<HookProbe entries={[]} />);

        await act(async () => {
            view.rerender(<HookProbe entries={[sameValueEntry]} />);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[7]');
        expect(screen.getByTestId('reroll-animation-seq').textContent).toBe('1');

        await act(async () => {
            view.rerender(<HookProbe entries={[sameValueEntry, nextSameValueEntry]} />);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[7]');
        expect(screen.getByTestId('reroll-animation-seq').textContent).toBe('2');
    });

    it('连续收到不同骰子的重掷事件时，不应让后一颗覆盖前一颗动画', async () => {
        vi.useFakeTimers();

        const firstEntry = createDieRerolledEntry(1, 0, 1000);
        const secondEntry = createDieRerolledEntry(2, 1, 1200);

        const view = render(<HookProbe entries={[]} />);

        await act(async () => {
            view.rerender(<HookProbe entries={[firstEntry]} />);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[0]');

        await act(async () => {
            view.rerender(<HookProbe entries={[firstEntry, secondEntry]} />);
        });
        expect(screen.getByTestId('rerolling-dice-ids').textContent).toBe('[0,1]');
        expect(screen.getByTestId('reroll-animation-seq').textContent).toBe('2');
    });
});
