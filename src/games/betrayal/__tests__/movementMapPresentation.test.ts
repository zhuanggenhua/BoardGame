import { describe, expect, it } from "vitest";
import {
  resolveBetrayalMapMoveCommandPayload,
  resolveBetrayalMapMovementReadModel,
  resolveBetrayalMoveCost,
  resolveBetrayalMoveTargetReadModel,
} from "../movementReadModel";
import { resolveBetrayalBoardActionItems } from "../actionBarReadModel";
import { resolveMapObjectInteraction } from "../mapObjectInteractionModel";
import { resolveBetrayalMapMoveReachSegments } from "../movementMapPresentation";
import { resolveRoomCanvasLayout, resolveDoorwayConnectionEdge } from "../roomMapModel";
import {
  applyBetrayalCommand,
  BetrayalDomain,
  BETRAYAL_COMMANDS,
  createBetrayalCommand,
  createJackSpiritMovementRollReadyCore,
  createStartedFirstScenarioCore,
  setScenarioTestTurnMovement,
  type BetrayalCore,
} from "./helpers/firstScenarioRuntimeHarness";
import { createSkeletonKeyMoveReadyCore } from "../testing/firstScenarioTestUtils";

function resolveMoveUi(core: BetrayalCore) {
  const movement = resolveBetrayalMapMovementReadModel(core);
  const actions = resolveBetrayalBoardActionItems({
    t: (key) => key,
    phase: core.phase,
    movesRemaining: core.movesRemaining,
    hasLegalMoveTargets: movement.moveTargetRooms.length > 0,
    currentExplorerInventoryCount: core.currentExplorer.inventory.length,
    // Assert whether the move action can be started from the ordinary map mode.
    interactionMode: "default",
    turnEndedByDiscovery: core.turnEndedByDiscovery,
    hasPendingPlayerAgreement: false,
    canStartExploreSelection: false,
    hasCorpseLootTargets: false,
    tradeSelectionReady: false,
    shouldStartDustSicknessExchange: false,
    isDustSicknessExchangeMode: false,
    hasUsedTradeThisTurn: false,
    hasAnyTradeSelectableCards: false,
    activeTradeTargetCount: 0,
    hasSelectedInventoryCard: false,
    selectedCardUseDisabled: false,
    selectedCardUseDisabledReason: null,
    hauntAction: null,
    shouldShowRoomEffectAction: false,
    canUseRoomEffect: false,
    roomEffectDisabledReason: null,
    hasRoomEndTurnEffect: false,
    shouldShowHauntRevealCue: false,
    hasActiveHauntTargetGuide: false,
    activeHauntTargetGuideCue: null,
    isHelpingHandsMonsterTurnController: false,
    helpingHandsMonsterTurnActive: false,
    helpingHandsTrollHandMoveEntryCount: 0,
    isDeadTraitorJackSpiritControlTurn: false,
    hasControlledMoveMonster: movement.isControlledTokenMove,
    pendingBloodFromStoneSetupPlacementCount: 0,
    selectedBloodFromStoneStoneCherubRoomCount: 0,
    isBloodFromStoneSetupPlacementMode: false,
    monsterTurnStartAction: null,
    monsterMovementRollAction: null,
    selectedMonsterMoveAction: null,
    selectedMonsterAttackAction: null,
    bloodFromStoneMonsterTurnEndAction: null,
  });
  const mapInteraction = resolveMapObjectInteraction({
    ...actions,
    interactionMode: "default",
    isViewerTurn: true,
    visualBusy: false,
    hasPendingDecision: false,
    isExclusiveMonsterTurn: false,
    isDeadControlledMonster: movement.isControlledTokenMove,
    hasLegalMoveTargets: movement.moveTargetRooms.length > 0,
  });
  return { movement, actions, mapInteraction };
}

function validateMove(
  core: BetrayalCore,
  payload: { roomId: string; useSkeletonKey?: boolean },
) {
  return BetrayalDomain.validate(
    { core, sys: {} as never },
    createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, core.currentPlayer, payload),
  );
}

function makeCurrentRoomAnObstacle(core: BetrayalCore) {
  core.rooms = core.rooms.map((room) =>
    room.id === core.currentExplorer.roomId
      ? { ...room, markerTokens: [...(room.markerTokens ?? []), "obstacle"] }
      : room,
  );
}

function resolveReachSegments(core: BetrayalCore, movement: ReturnType<typeof resolveBetrayalMapMovementReadModel>) {
  const visibleRooms = core.rooms.filter(
    (room) => room.floor === core.rooms.find((candidate) => candidate.id === core.activeRoomId)?.floor,
  );
  return resolveBetrayalMapMoveReachSegments({
    sourceRoomId: core.activeRoomId,
    visibleRooms,
    layout: resolveRoomCanvasLayout(visibleRooms),
    moveTargetRoomIds: movement.moveTargetRoomIds,
    moveCostByRoomId: movement.moveCostByRoomId,
    moveKindByRoomId: movement.moveKindByRoomId,
  });
}

describe("Betrayal map movement presentation follows legal one-step movement", () => {
  it("hides a cost-2 doorway and disables movement when only one point remains", () => {
    const core = createStartedFirstScenarioCore();
    makeCurrentRoomAnObstacle(core);
    setScenarioTestTurnMovement(core, 1);
    const officialTarget = resolveBetrayalMoveTargetReadModel(core).normalMoveTargetRooms[0]!;

    expect(resolveBetrayalMoveCost(core)).toBe(2);
    expect(validateMove(core, { roomId: officialTarget.id }).valid).toBe(false);

    const ui = resolveMoveUi(core);
    expect(ui.movement.moveTargetRoomIds.has(officialTarget.id)).toBe(false);
    expect(ui.movement.moveCostByRoomId.has(officialTarget.id)).toBe(false);
    expect(resolveBetrayalMapMoveCommandPayload(ui.movement, officialTarget.id)).toBeNull();
    expect(resolveReachSegments(core, ui.movement)).toEqual([]);
    expect(ui.actions.formalActionItems.find((action) => action.id === "move")?.disabled).toBe(true);
    expect(ui.mapInteraction.canMoveToRoom).toBe(false);
  });

  it("keeps a cost-2 doorway selectable at two points and dispatches the two-point move", () => {
    const core = createStartedFirstScenarioCore();
    makeCurrentRoomAnObstacle(core);
    setScenarioTestTurnMovement(core, 2);
    const officialTarget = resolveBetrayalMoveTargetReadModel(core).normalMoveTargetRooms[0]!;
    const ui = resolveMoveUi(core);

    expect(ui.movement.moveTargetRoomIds.has(officialTarget.id)).toBe(true);
    expect(ui.movement.moveCostByRoomId.get(officialTarget.id)).toBe(2);
    expect(ui.movement.moveKindByRoomId.get(officialTarget.id)).toBe("normal");
    expect(ui.actions.formalActionItems.find((action) => action.id === "move")?.disabled).toBe(false);
    expect(ui.mapInteraction.canMoveToRoom).toBe(true);

    const payload = resolveBetrayalMapMoveCommandPayload(ui.movement, officialTarget.id)!;
    expect(payload).toEqual({ roomId: officialTarget.id });
    expect(validateMove(core, payload).valid).toBe(true);
    const moved = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, core.currentPlayer, payload);
    expect(moved.currentExplorer.roomId).toBe(officialTarget.id);
    expect(moved.movesRemaining).toBe(0);
  });

  it("labels a formal Skeleton Key candidate as a one-point key move and rejects zero points", () => {
    const core = createSkeletonKeyMoveReadyCore();
    makeCurrentRoomAnObstacle(core);
    setScenarioTestTurnMovement(core, 1);
    const officialKeyTarget = resolveBetrayalMoveTargetReadModel(core).skeletonKeyMoveTargetRooms[0]!;
    const ui = resolveMoveUi(core);

    expect(resolveBetrayalMoveCost(core)).toBe(2);
    expect(officialKeyTarget).toBeDefined();
    expect(ui.movement.moveTargetRoomIds.has(officialKeyTarget.id)).toBe(true);
    expect(ui.movement.skeletonKeyMoveTargetRoomIds.has(officialKeyTarget.id)).toBe(true);
    expect(ui.movement.moveCostByRoomId.get(officialKeyTarget.id)).toBe(1);
    expect(ui.movement.moveKindByRoomId.get(officialKeyTarget.id)).toBe("skeletonKey");

    const payload = resolveBetrayalMapMoveCommandPayload(ui.movement, officialKeyTarget.id)!;
    expect(payload).toEqual({ roomId: officialKeyTarget.id, useSkeletonKey: true });
    expect(validateMove(core, payload).valid).toBe(true);
    const moved = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, core.currentPlayer, payload);
    expect(moved.movesRemaining).toBe(0);

    const noMovesCore = createSkeletonKeyMoveReadyCore();
    setScenarioTestTurnMovement(noMovesCore, 0);
    const noMovesUi = resolveMoveUi(noMovesCore);
    expect(noMovesUi.movement.skeletonKeyMoveTargetRoomIds.size).toBe(0);
    expect(noMovesUi.actions.formalActionItems.find((action) => action.id === "move")?.disabled).toBe(true);
    expect(validateMove(noMovesCore, { roomId: officialKeyTarget.id, useSkeletonKey: true }).valid).toBe(false);
  });

  it("does not apply the ordinary cost gate to a dead controlled-token MOVE exception", () => {
    const core = createJackSpiritMovementRollReadyCore();
    makeCurrentRoomAnObstacle(core);
    setScenarioTestTurnMovement(core, 1);
    const officialTarget = resolveBetrayalMoveTargetReadModel(core).normalMoveTargetRooms[0]!;
    const ui = resolveMoveUi(core);

    expect(ui.movement.isControlledTokenMove).toBe(true);
    expect(resolveBetrayalMoveCost(core)).toBe(2);
    expect(ui.movement.moveTargetRoomIds.has(officialTarget.id)).toBe(true);
    expect(ui.movement.moveCostByRoomId.get(officialTarget.id)).toBe(1);
    expect(ui.actions.formalActionItems.find((action) => action.id === "move")?.disabled).toBe(false);
    expect(ui.mapInteraction.canMoveToRoom).toBe(true);
    expect(validateMove(core, { roomId: officialTarget.id }).valid).toBe(true);
  });

  it("draws reach only through a reciprocal visible doorway, never inventing a Skeleton Key route", () => {
    const core = createStartedFirstScenarioCore();
    const sourceRoom = core.rooms.find((room) => room.id === core.activeRoomId)!;
    const movement = resolveBetrayalMapMovementReadModel(core);
    const formalTarget = movement.moveTargetRooms.find(
      (room) => resolveDoorwayConnectionEdge(sourceRoom, room.id) !== null,
    )!;
    expect(formalTarget).toBeDefined();
    const reach = resolveReachSegments(core, movement);
    expect(reach).toEqual([
      expect.objectContaining({
        sourceRoomId: sourceRoom.id,
        targetRoomId: formalTarget.id,
        kind: "normal",
        cost: 1,
      }),
    ]);
    expect(reach[0]!.x1 !== reach[0]!.x2 || reach[0]!.y1 !== reach[0]!.y2).toBe(true);

    const keyCore = createSkeletonKeyMoveReadyCore();
    const keyMovement = resolveBetrayalMapMovementReadModel(keyCore);
    const keyTarget = keyMovement.moveTargetRooms.find((room) =>
      keyMovement.skeletonKeyMoveTargetRoomIds.has(room.id),
    )!;
    expect(keyTarget).toBeDefined();
    expect(resolveDoorwayConnectionEdge(
      keyCore.rooms.find((room) => room.id === keyCore.activeRoomId)!,
      keyTarget.id,
    )).toBeNull();
    expect(resolveReachSegments(keyCore, {
      ...keyMovement,
      moveTargetRooms: [keyTarget],
      moveTargetRoomIds: new Set([keyTarget.id]),
    })).toEqual([]);
  });
});
