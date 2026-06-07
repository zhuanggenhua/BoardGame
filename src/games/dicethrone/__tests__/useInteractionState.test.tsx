import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { InteractionDescriptor } from '../domain/types';
import { useInteractionState } from '../hooks/useInteractionState';

function createSelectDieInteraction(
    overrides: Partial<InteractionDescriptor> = {},
): InteractionDescriptor {
    return {
        id: 'dt-interaction-1',
        playerId: '0',
        sourceCardId: 'card-same-cee',
        type: 'selectDie',
        titleKey: 'cards.sameCee.selectDie',
        selectCount: 1,
        selected: [],
        allowedDieIds: [1, 2, 3],
        ...overrides,
    };
}

describe('useInteractionState', () => {
    it('same interaction id 下若候选语义漂移，应清空旧本地选择', async () => {
        const initialInteraction = createSelectDieInteraction();
        const { result, rerender } = renderHook(
            ({ interaction }: { interaction?: InteractionDescriptor }) => useInteractionState(interaction),
            { initialProps: { interaction: initialInteraction } },
        );

        await waitFor(() => {
            expect(result.current.localState.selectedDice).toEqual([]);
        });

        act(() => {
            result.current.handlers.selectDie(1);
        });

        expect(result.current.localState.selectedDice).toEqual(['1']);

        rerender({
            interaction: createSelectDieInteraction({
                allowedDieIds: [2, 3],
            }),
        });

        await waitFor(() => {
            expect(result.current.localState.selectedDice).toEqual([]);
            expect(result.current.localState.modifiedDice).toEqual([]);
            expect(result.current.localState.selectedPlayers).toEqual([]);
        });
    });

    it('same interaction semantic rerender 时，不应误清空当前本地选择', async () => {
        const initialInteraction = createSelectDieInteraction();
        const { result, rerender } = renderHook(
            ({ interaction }: { interaction?: InteractionDescriptor }) => useInteractionState(interaction),
            { initialProps: { interaction: initialInteraction } },
        );

        await waitFor(() => {
            expect(result.current.localState.selectedDice).toEqual([]);
        });

        act(() => {
            result.current.handlers.selectDie(1);
        });

        expect(result.current.localState.selectedDice).toEqual(['1']);

        rerender({
            interaction: createSelectDieInteraction(),
        });

        await waitFor(() => {
            expect(result.current.localState.selectedDice).toEqual(['1']);
        });
    });
});
