import { describe, expect, it } from "vitest";

import { createBetrayalCharacterSelectCore } from "../game";
import {
  createInitialPreviewState,
    resolveRoomPlacementCancellationState,
  resolveNextPreviewStateAfterCoreChange,
} from "../previewStateModel";

describe("Betrayal preview state history handling", () => {
  it("clears dismissal state when authoritative history rewinds", () => {
    const core = createBetrayalCharacterSelectCore();
    const previousState = {
      ...createInitialPreviewState(core),
      dismissedLatestDiscoveryKey: "0::event::无线电广播",
      dismissedRecentRollId: "event-roll::eventDiceRoll",
      selectedEventTrait: "knowledge" as const,
    };

    const nextState = resolveNextPreviewStateAfterCoreChange(core, previousState, {
      authoritativeHistoryRewound: true,
    });

    expect(nextState.dismissedLatestDiscoveryKey).toBeNull();
    expect(nextState.dismissedRecentRollId).toBeNull();
    expect(nextState.selectedEventTrait).toBeNull();
  });

  it("preserves normal preview dismissal state when history advances", () => {
    const core = createBetrayalCharacterSelectCore();
    const previousState = {
      ...createInitialPreviewState(core),
      dismissedLatestDiscoveryKey: "0::event::无线电广播",
      dismissedRecentRollId: "event-roll::eventDiceRoll",
    };

    const nextState = resolveNextPreviewStateAfterCoreChange(core, previousState);

    expect(nextState.dismissedLatestDiscoveryKey).toBe(
      previousState.dismissedLatestDiscoveryKey,
    );
    expect(nextState.dismissedRecentRollId).toBe(
      previousState.dismissedRecentRollId,
    );
  });

  it("clears a selected possession after that card is consumed this turn", () => {
    const core = createBetrayalCharacterSelectCore();
    core.currentExplorer = {
      ...core.currentExplorer,
      inventory: [{ id: "scary-doll", name: "恐怖玩偶", kind: "item" }],
    };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.usedCardIdsThisTurn = ["scary-doll"];
    const previousState = {
      ...createInitialPreviewState(core),
      selectedInventoryCardId: "scary-doll",
    };

    const nextState = resolveNextPreviewStateAfterCoreChange(core, previousState);

    expect(nextState.selectedInventoryCardId).toBeNull();
  });

  it("cancels only the room-placement preview and returns to default targeting", () => {
    const core = createBetrayalCharacterSelectCore();
    const movesRemainingBeforeCancel = core.movesRemaining;
    const turnEndedByDiscoveryBeforeCancel = core.turnEndedByDiscovery;
    const previousState = {
      ...createInitialPreviewState(core),
      interactionMode: "explore" as const,
      pendingRoomPlacementSlotId: "ground-north",
      pendingRoomPlacementFailure: { roomId: "ground-north", floor: "ground" as const },
      pendingRoomOrientationTurns: 2 as const,
      pendingRoomTileAdjustment: { kind: "none" } as const,
    };

    const cancelled = resolveRoomPlacementCancellationState(previousState);

    expect(cancelled).toMatchObject({
      interactionMode: "default",
      pendingRoomPlacementSlotId: null,
      pendingRoomPlacementFailure: null,
      pendingRoomOrientationTurns: 0,
      pendingRoomTileAdjustment: null,
    });
    expect(core.movesRemaining).toBe(movesRemainingBeforeCancel);
    expect(core.turnEndedByDiscovery).toBe(turnEndedByDiscoveryBeforeCancel);
  });
});
