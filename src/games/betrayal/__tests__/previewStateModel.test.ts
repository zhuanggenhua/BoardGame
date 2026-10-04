import { describe, expect, it } from "vitest";

import { createBetrayalCharacterSelectCore } from "../game";
import {
  createInitialPreviewState,
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
});
