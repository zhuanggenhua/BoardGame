import { describe, expect, it } from 'vitest';
import { resolveHelpingHandsTrollHandMoveOptions } from '../hauntAttackRewardReadModel';
import { resolveExplorableRoomSlots } from '../roomDiscoveryModel';
import { resolveBetrayalMapMovementReadModel, resolveMoveTargetRooms } from '../movementReadModel';
import { resolveBetrayalMonsterActionPanel } from '../monsterActionReadModel';
import { resolveBloodFromStoneMonsterTurnStatus } from '../monsterActionReadModel';
import { resolveBetrayalMonsterActionSelectionReadModel } from '../monsterActionSelectionReadModel';
import { resolveBetrayalBoardActionItems } from '../actionBarReadModel';
import { resolveMapObjectInteraction } from '../mapObjectInteractionModel';
import {
    activateBloodFromStoneMonsterTurn,
    activateTestExplorer,
    BetrayalDomain,
    BETRAYAL_COMMANDS,
    createBetrayalCommand,
    createBetrayalMonsterFromDefinition,
    createFeverishControlReadyCore,
    createFirstScenarioHauntCore,
    createJackSpiritMovementRollReadyCore,
    createOpenFrontierHauntTestCore,
    createHelpingHandsHauntCore,
    startHelpingHandsMonsterTurn,
    setNextDiscoverySymbolRoomsForAllFloors,
    type BetrayalCore,
} from './helpers/firstScenarioRuntimeHarness';

const validate = (
    core: BetrayalCore,
    type: string,
    playerId: string,
    payload: Record<string, unknown>,
) => BetrayalDomain.validate(
    { core, sys: {} as never },
    createBetrayalCommand(type, playerId, payload),
);

/** Exercise the production action-to-map seam with the same core as Domain.validate. */
function resolveMoveUi(core: BetrayalCore) {
    const mapMovement = resolveBetrayalMapMovementReadModel(core);
    const selection = resolveBetrayalMonsterActionSelectionReadModel({
        core, allExplorers: [core.currentExplorer, ...core.otherExplorers],
        viewerPlayerId: core.currentPlayer, interactionMode: 'move',
        selectedHelpingHandsTrollHandMoveMonsterId: null,
        selectedMonsterMoveMonsterId: null, selectedMonsterAttackMonsterId: null,
        selectedHelpingHandsTrollHandTargetPlayerId: null,
    });
    const bloodFromStoneStatus = resolveBloodFromStoneMonsterTurnStatus(core);
    const isExclusiveMonsterTurnForCurrentPlayer = Boolean(
        (selection.helpingHandsMonsterTurnStatus.active &&
            selection.helpingHandsMonsterTurnStatus.controllerPlayerId === core.currentPlayer)
        || (bloodFromStoneStatus.active &&
            bloodFromStoneStatus.controllerPlayerId === core.currentPlayer),
    );
    const actions = resolveBetrayalBoardActionItems({
        t: key => key, phase: core.phase, movesRemaining: core.movesRemaining,
        hasLegalMoveTargets: mapMovement.moveTargetRooms.length > 0,
        currentExplorerInventoryCount: core.currentExplorer.inventory.length,
        interactionMode: 'default', turnEndedByDiscovery: core.turnEndedByDiscovery,
        hasPendingPlayerAgreement: false, canStartExploreSelection: false,
        hasCorpseLootTargets: false, tradeSelectionReady: false,
        shouldStartDustSicknessExchange: false, isDustSicknessExchangeMode: false,
        hasUsedTradeThisTurn: false, hasAnyTradeSelectableCards: false,
        activeTradeTargetCount: 0, hasSelectedInventoryCard: false,
        selectedCardUseDisabled: false, selectedCardUseDisabledReason: null,
        hauntAction: null, shouldShowRoomEffectAction: false,
        canUseRoomEffect: false, roomEffectDisabledReason: null,
        hasRoomEndTurnEffect: false, shouldShowHauntRevealCue: false,
        hasActiveHauntTargetGuide: false, activeHauntTargetGuideCue: null,
        isHelpingHandsMonsterTurnController: selection.isHelpingHandsMonsterTurnController,
        helpingHandsMonsterTurnActive: selection.helpingHandsMonsterTurnStatus.active,
        helpingHandsTrollHandMoveEntryCount: selection.helpingHandsTrollHandMoveEntries.length,
        isDeadTraitorJackSpiritControlTurn: selection.isDeadTraitorJackSpiritControlTurn,
        hasControlledMoveMonster: Boolean(selection.controlledMoveMonsterId),
        pendingBloodFromStoneSetupPlacementCount: 0,
        selectedBloodFromStoneStoneCherubRoomCount: 0,
        isBloodFromStoneSetupPlacementMode: false, monsterTurnStartAction: null,
        monsterMovementRollAction: null, selectedMonsterMoveAction: null,
        selectedMonsterAttackAction: null, bloodFromStoneMonsterTurnEndAction: null,
    });
    const mapInteraction = resolveMapObjectInteraction({
        ...actions, interactionMode: 'default', isViewerTurn: true,
        visualBusy: false, hasPendingDecision: false,
        isExclusiveMonsterTurn: isExclusiveMonsterTurnForCurrentPlayer,
        isDeadControlledMonster: Boolean(selection.controlledMoveMonsterId),
        hasLegalMoveTargets: mapMovement.moveTargetRooms.length > 0,
    });
    return { ...mapInteraction, formalActionItems: actions.formalActionItems };
}

describe('Betrayal map interaction permissions match domain validation', () => {
    it.each([
        ['Jack Spirit', createJackSpiritMovementRollReadyCore],
        ['Feverish', createFeverishControlReadyCore],
    ])('keeps %s controlled movement available after a discovery-ended explorer turn', (_name, createCore) => {
        const core = createCore();
        core.turnEndedByDiscovery = true;
        const destination = resolveMoveTargetRooms(core)[0]!;
        expect(destination).toBeDefined();
        expect(validate(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, core.currentPlayer, { roomId: destination.id }).valid).toBe(true);
        const ui = resolveMoveUi(core);
        expect(ui.canMoveToRoom).toBe(true);
        expect(ui.canSelectExplorer).toBe(false);
        expect(ui.canExplore).toBe(false);
    });

    it('keeps ordinary haunt movement blocked after discovery ended the explorer turn', () => {
        const core = createOpenFrontierHauntTestCore('1');
        core.turnEndedByDiscovery = true;
        const destination = resolveMoveTargetRooms(core)[0]!;
        expect(validate(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, core.currentPlayer, { roomId: destination.id }).valid).toBe(false);
        expect(resolveMoveUi(core).canMoveToRoom).toBe(false);
    });
    it('allows a normal haunt hero to move and explore a legal room', () => {
        const core = createOpenFrontierHauntTestCore('1');
        const moveRoom = resolveMoveTargetRooms(core)[0];
        const exploreRoom = resolveExplorableRoomSlots(core)[0];

        expect(moveRoom).toBeDefined();
        expect(exploreRoom).toBeDefined();
        expect(validate(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: moveRoom!.id }).valid).toBe(true);
        expect(validate(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: exploreRoom!.id }).valid).toBe(true);
    });

    it('keeps ordinary move and explore legal when the standard traitor/Mummy panel is active', () => {
        const core = createFirstScenarioHauntCore();
        core.turnEndedByDiscovery = false;
        activateTestExplorer(core, '2');
        core.activeRoomId = core.currentExplorer.roomId;
        core.currentExplorerRoomId = core.currentExplorer.roomId;
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        const moveRoom = resolveMoveTargetRooms(core)[0];
        const exploreRoom = resolveExplorableRoomSlots(core)[0];
        const mummy = core.monsters[0];

        expect(core.scenarioRuntime.traitorPlayerId).toBe('2');
        expect(mummy).toBeDefined();
        expect(resolveBetrayalMonsterActionPanel(core).active).toBe(true);
        expect(moveRoom).toBeDefined();
        expect(exploreRoom).toBeDefined();
        expect(validate(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: moveRoom!.id }).valid).toBe(true);
        expect(validate(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '2', { roomId: exploreRoom!.id })).toMatchObject({ valid: true });
    });

    it('blocks ordinary actions during Helping Hands, while preserving the Troll Hand command after discovery ended the turn', () => {
        const core = startHelpingHandsMonsterTurn(createHelpingHandsHauntCore());
        const trollHandId = core.scenarioRuntime.helpingHands?.trollHandIds[0];
        expect(trollHandId).toBeDefined();
        const moveTarget = resolveHelpingHandsTrollHandMoveOptions(core, trollHandId!)[0];
        const exploreRoom = resolveExplorableRoomSlots(core)[0];
        expect(moveTarget).toBeDefined();
        expect(exploreRoom).toBeDefined();

        expect(validate(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' }).valid).toBe(false);
        expect(validate(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: exploreRoom!.id }).valid).toBe(false);

        core.turnEndedByDiscovery = true;
        expect(validate(core, BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND, '0', {
            monsterId: trollHandId,
            roomId: moveTarget!.id,
        }).valid).toBe(true);
    });

    it('blocks ordinary actions during Blood From Stone, while preserving the dedicated monster-turn command', () => {
        const core = createFirstScenarioHauntCore();
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-1', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-2', 'hallway'),
        ];
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: ['stone-cherub-1', 'stone-cherub-2'],
            skippedMonsterIdsThisTurn: ['stone-cherub-1', 'stone-cherub-2'],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        };
        activateBloodFromStoneMonsterTurn(core, '0');
        const exploreRoom = resolveExplorableRoomSlots(core)[0];
        expect(exploreRoom).toBeDefined();

        expect(validate(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' }).valid).toBe(false);
        expect(validate(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: exploreRoom!.id }).valid).toBe(false);
        expect(validate(core, BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN, '0', {}).valid).toBe(true);
    });

    it('blocks the controller’s ordinary map actions during an active Blood From Stone turn', () => {
        const core = createFirstScenarioHauntCore();
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-1', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-2', 'hallway'),
        ];
        activateBloodFromStoneMonsterTurn(core, '0');

        const turnStatus = resolveBloodFromStoneMonsterTurnStatus(core);
        const destination = resolveMoveTargetRooms(core)[0]!;
        const movement = resolveBetrayalMapMovementReadModel(core);
        expect(turnStatus.active).toBe(true);
        expect(turnStatus.controllerPlayerId).toBe(core.currentPlayer);
        expect(core.movesRemaining).toBeGreaterThan(0);
        expect(destination).toBeDefined();
        expect(movement.moveTargetRoomIds.has(destination.id)).toBe(true);
        expect(validate(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, core.currentPlayer, { roomId: destination.id }).valid).toBe(false);

        const ui = resolveMoveUi(core);
        expect(ui.formalActionItems.find(action => action.id === 'move')?.disabled).toBe(false);
        expect(ui.canSelectExplorer).toBe(false);
        expect(ui.canMoveToRoom).toBe(false);
    });

    it.each([
        ['dead Jack Spirit controller', createJackSpiritMovementRollReadyCore, 'upper-landing'],
        ['dead Feverish controller', createFeverishControlReadyCore, 'entrance-hall'],
    ])('%s can move its token but cannot explore as a dead explorer', (_label, createCore, moveRoomId) => {
        const core = createCore();
        const playerId = core.currentPlayer;
        const exploreRoom = resolveExplorableRoomSlots(core)[0];
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain(playerId);
        expect(exploreRoom).toBeDefined();

        expect(validate(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, playerId, { roomId: moveRoomId }).valid).toBe(true);
        expect(validate(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, playerId, { roomId: exploreRoom!.id }).valid).toBe(false);
    });
});
