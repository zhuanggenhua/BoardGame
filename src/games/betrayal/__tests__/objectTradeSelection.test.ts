import { describe, expect, it } from 'vitest';
import { createInitialPreviewState } from '../previewStateModel';
import { resolveBetrayalPreviewStateAfterExplorerTargetSelection } from '../explorerTargetSelectionReadModel';
import { createStartedFirstScenarioCore } from './helpers/firstScenarioRuntimeHarness';

describe('object-owned trade selection', () => {
    it('selects an explorer without submitting a trade, then allows the same explorer to cancel the draft', () => {
        const initial = createInitialPreviewState(createStartedFirstScenarioCore());
        const action = { kind: 'selectTradeOrLootTarget', playerId: '1', isCorpseLootTarget: false } as const;
        const selected = resolveBetrayalPreviewStateAfterExplorerTargetSelection(initial, action);
        expect(selected.selectedTradeTargetPlayerId).toBe('1');
        expect(selected.tradeSelectionTouched).toBe(true);
        const cancelled = resolveBetrayalPreviewStateAfterExplorerTargetSelection({ ...selected,
            selectedTradeGiveCardIds: ['book'], selectedTradeReturnCardIds: ['bell'], selectedDogTradeCardIds: ['book'],
        }, action);
        expect(cancelled).toMatchObject({ selectedTradeTargetPlayerId: null, tradeSelectionTouched: false,
            selectedTradeGiveCardIds: [], selectedTradeReturnCardIds: [], selectedDogTradeCardIds: [],
        });
    });
});
