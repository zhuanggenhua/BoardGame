import type {
  BetrayalCore,
  BetrayalRoomNode,
  BetrayalRoomTileAdjustmentSelection,
  BetrayalTraitKey,
} from "./game";
import { canUseHolySymbolForDiscovery } from "./possessionActionReadModel";
import {
  resolveRoomPlacementPreview,
  resolveRoomTileAdjustmentOptions,
} from "./roomDiscoveryModel";
import {
  roomTileAdjustmentSelectionsMatch,
  toRoomTileAdjustmentSelection,
  type RoomOrientationTurns,
} from "./roomMapModel";

export type PreviewState = {
  selectedInventoryCardId: string | null;
  lastUsedInventoryCardId: string | null;
  selectedTradeTargetPlayerId: string | null;
  selectedCorpseLootCardId: string | null;
  selectedTradeGiveCardIds: string[];
  selectedDogTradeCardIds: string[];
  selectedTradeReturnCardIds: string[];
  selectedAttackWeaponCardId: string | null;
  selectedInventoryTargetPlayerId: string | null;
  selectedInventoryTargetRoomId: string | null;
  selectedInventoryReplacementRollTotal: number | null;
  selectedRollModifierDieIndex: number | null;
  selectedMaskTargetRoomIdsByTokenId: Record<string, string>;
  activeMaskTargetTokenId: string | null;
  selectedEventTrait: BetrayalTraitKey | null;
  selectedEventCardId: string | null;
  selectedDustSearchTrait: BetrayalTraitKey | null;
  selectedDustCureTrait: BetrayalTraitKey | null;
  selectedEventTargetRoomId: string | null;
  selectedEventDamageTraits: BetrayalTraitKey[];
  selectedDamageAllocationTraits: BetrayalTraitKey[];
  useBroochForDamageAllocation: boolean;
  useHolySymbolForExplore: boolean;
  useIdolForExplore: boolean;
  ignoreEventSymbolWithTraitorPower: boolean;
  pendingRoomPlacementSlotId: string | null;
  pendingRoomPlacementFailure: {
    roomId: string;
    floor: BetrayalRoomNode["floor"];
  } | null;
  pendingRoomOrientationTurns: RoomOrientationTurns;
  pendingRoomTileAdjustment: BetrayalRoomTileAdjustmentSelection | null;
  tradeSelectionTouched: boolean;
  dismissedLatestDiscoveryKey: string | null;
  dismissedRecentRollId: string | null;
  interactionMode:
    | "default"
    | "move"
    | "explore"
    | "sicknessExchange"
    | "helpingHandsTrollMove"
    | "monsterMove"
    | "monsterAttack"
    | "bloodFromStoneSetupPlacement"
    | "bloodFromStoneMonsterTurnEnd";
  hauntTargetingActionKind: string | null;
  selectedHelpingHandsTrollHandMoveMonsterId: string | null;
  selectedMonsterMoveMonsterId: string | null;
  selectedMonsterAttackMonsterId: string | null;
  selectedPeekabooSameRoomMonsterId: string | null;
  selectedPeekabooLineOfSightMonsterId: string | null;
  selectedBloodFromStoneStoneCherubRoomIds: string[];
};

export function createInitialPreviewState(_core: BetrayalCore): PreviewState {
  return {
    selectedInventoryCardId: null,
    lastUsedInventoryCardId: null,
    selectedTradeTargetPlayerId: null,
    selectedCorpseLootCardId: null,
    selectedTradeGiveCardIds: [],
    selectedDogTradeCardIds: [],
    selectedTradeReturnCardIds: [],
    selectedAttackWeaponCardId: null,
    selectedInventoryTargetPlayerId: null,
    selectedInventoryTargetRoomId: null,
    selectedInventoryReplacementRollTotal: null,
    selectedRollModifierDieIndex: null,
    selectedMaskTargetRoomIdsByTokenId: {},
    activeMaskTargetTokenId: null,
    selectedEventTrait: null,
    selectedEventCardId: null,
    selectedDustSearchTrait: null,
    selectedDustCureTrait: null,
    selectedEventTargetRoomId: null,
    selectedEventDamageTraits: [],
    selectedDamageAllocationTraits: [],
    useBroochForDamageAllocation: false,
    useHolySymbolForExplore: false,
    useIdolForExplore: false,
    ignoreEventSymbolWithTraitorPower: false,
    pendingRoomPlacementSlotId: null,
    pendingRoomPlacementFailure: null,
    pendingRoomOrientationTurns: 0,
    pendingRoomTileAdjustment: null,
    tradeSelectionTouched: false,
    dismissedLatestDiscoveryKey: null,
    dismissedRecentRollId: null,
    interactionMode: "default",
    hauntTargetingActionKind: null,
    selectedHelpingHandsTrollHandMoveMonsterId: null,
    selectedMonsterMoveMonsterId: null,
    selectedMonsterAttackMonsterId: null,
    selectedPeekabooSameRoomMonsterId: null,
    selectedPeekabooLineOfSightMonsterId: null,
    selectedBloodFromStoneStoneCherubRoomIds: [],
  };
}

export function resolvePreservedExplorePlacementState(
  core: BetrayalCore,
  previousState: PreviewState,
): Partial<PreviewState> | null {
  if (
    previousState.interactionMode !== "explore" ||
    !previousState.pendingRoomPlacementSlotId
  ) {
    return null;
  }
  const useHolySymbol =
    previousState.useHolySymbolForExplore && canUseHolySymbolForDiscovery(core);
  const placementPreview = resolveRoomPlacementPreview(core, {
    roomId: previousState.pendingRoomPlacementSlotId,
    useHolySymbol,
  });
  if (!placementPreview) {
    return null;
  }
  const selectedOrientationOption =
    placementPreview.orientationOptions.find(
      (option) =>
        option.orientationTurns === previousState.pendingRoomOrientationTurns,
    ) ??
    placementPreview.orientationOptions.find(
      (option) =>
        option.orientationTurns === placementPreview.defaultOrientationTurns,
    ) ??
    placementPreview.orientationOptions[0] ??
    null;
  const orientationTurns =
    selectedOrientationOption?.orientationTurns ??
    placementPreview.defaultOrientationTurns;
  const tileAdjustmentOption =
    previousState.pendingRoomTileAdjustment &&
    placementPreview.requiresTileAdjustment
      ? (resolveRoomTileAdjustmentOptions(core, {
          roomId: placementPreview.slotId,
          orientationTurns,
          useHolySymbol,
        }).find((option) =>
          roomTileAdjustmentSelectionsMatch(
            option,
            previousState.pendingRoomTileAdjustment!,
          ),
        ) ?? null)
      : null;
  return {
    interactionMode: "explore",
    useHolySymbolForExplore: useHolySymbol,
    useIdolForExplore: false,
    ignoreEventSymbolWithTraitorPower: false,
    pendingRoomPlacementSlotId: placementPreview.slotId,
    pendingRoomPlacementFailure: null,
    pendingRoomOrientationTurns: orientationTurns,
    pendingRoomTileAdjustment: tileAdjustmentOption
      ? toRoomTileAdjustmentSelection(tileAdjustmentOption)
      : null,
  };
}
