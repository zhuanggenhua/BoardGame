import { describe, expect, it } from 'vitest';
import { resolveBetrayalActionCueReadModel } from '../actionCueReadModel';

const cueInput = (canStartExploreSelection: boolean) => ({
    t: (key: string) => key,
    recommendedAction: 'explore' as const,
    activeRoomId: 'hallway',
    currentExplorerRoomId: 'hallway',
    currentExplorerInventoryCount: 0,
    interactionMode: 'default' as const,
    activeHauntTargetGuideCue: null,
    selectedHelpingHandsTrollMoveEntry: null,
    selectedMonsterMoveEntry: null,
    selectedMonsterAttackEntry: null,
    isMonsterAttackMode: false,
    selectedMonsterAttackSourceId: null,
    isBloodFromStoneSetupPlacementMode: false,
    remainingBloodFromStoneSetupPlacementCount: 0,
    selectedBloodFromStoneStoneCherubRoomCount: 0,
    pendingBloodFromStoneSetupPlacementCount: 0,
    pendingRoomPlacementPreview: null,
    turnEndedByDiscovery: false,
    moveTargetRooms: [],
    canStartExploreSelection,
    explorableRoomSlots: [{ floor: 'ground' }],
    selectedInventoryCardName: null,
    selectedCardUseDisabled: false,
    selectedCardUsedThisTurn: false,
    hauntActionContext: null,
    hauntActionDisabledReason: null,
    isTradeDraftActive: false,
    hasUsedTradeThisTurn: false,
    tradeSelectionReady: false,
    selectedTradeGiveCardCount: 0,
    selectedDogTradeCardCount: 0,
    selectedTradeTarget: null,
    activeTradeTargetCount: 0,
    hasRoomEndTurnEffect: false,
    allExplorers: [],
    resolvePlayerName: (_playerId: string, explorerName: string) => explorerName,
});

describe('Betrayal map action cues', () => {
    it('points a legal exploration directly to an open doorway slot instead of the removed dock action', () => {
        const result = resolveBetrayalActionCueReadModel(cueInput(true));

        expect(result.actionCueText).toBe('board.status.actionCueExploreSelect');
    });

    it('does not advertise exploration when the formal gate is disabled', () => {
        const result = resolveBetrayalActionCueReadModel(cueInput(false));

        expect(result.actionCueText).toBe('board.status.actionCueExplore');
    });
});
