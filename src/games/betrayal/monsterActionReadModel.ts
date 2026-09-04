import type { RandomFn } from '../../engine/types';
import { BETRAYAL_COMMANDS } from './commands';
import { rollBetrayalDicePips } from './diceRules';
import { resolveBetrayalExplorerSide } from './entityRelationModel';
import {
    getAllExplorers,
    resolveExplorerRoom,
} from './explorerReadModel';
import type {
    BetrayalCore,
    BetrayalExplorerSummary,
    BetrayalMonsterStatusKind,
    BetrayalMonsterSummary,
    BetrayalRoomNode,
    BetrayalTraitKey,
} from './game';
import {
    findHelpingHandsTrollHand,
    findPhantomPhotographer,
    isBloodFromStoneHaunt,
    isHelpingHandsHaunt,
    isMummyMonster,
    isStoneCherubMonster,
    isUponReflectionHaunt,
    isUponReflectionMirrorBeingMonster,
    resolveControlledRoomId,
    resolveHelpingHandsControllerPlayerId,
    resolveLivingHeroExplorers,
    shouldDeadPlayerControlFeverish,
} from './hauntScenarioReadModel';
import {
    resolveBetrayalMonsterStatuses,
    resolveMonsterStatusKind,
} from './monsterReadModel';
import {
    resolveConnectedRoomIds,
    roomDistanceByLayout,
    isStraightLineVisible,
} from './roomMapModel';
import {
    rotateToNextLivingPlayer,
} from './turnOrderReadModel';

export interface BetrayalMonsterTurnStartStatus {
    monsterId: string;
    name: string;
    status: BetrayalMonsterStatusKind;
    nextStatus: BetrayalMonsterStatusKind;
    canStartTurn: boolean;
    mustFlipStunnedSideUp: boolean;
    mustSkipTurn: boolean;
    canRollMovement: boolean;
    canAttack: boolean;
    reason: string | null;
}

export type BetrayalMonsterTurnStartResolutionStatus =
    | 'ready'
    | 'missing-monster'
    | 'already-resolved';

export type BetrayalMonsterTurnStartResolutionContractGap =
    | 'formal-command'
    | 'ui-token-flip'
    | 'movement-roll-command';

export interface BetrayalMonsterTurnStartResolutionPreview {
    active: boolean;
    canResolve: boolean;
    resolutionStatus: BetrayalMonsterTurnStartResolutionStatus;
    monsterId: string;
    name: string | null;
    status: BetrayalMonsterStatusKind | null;
    nextStatus: BetrayalMonsterStatusKind | null;
    willFlipStunnedSideUp: boolean;
    willRemoveStunnedMarker: boolean;
    willSkipTurn: boolean;
    willStartTurn: boolean;
    willRollMovement: boolean;
    willOpenAttackWindow: boolean;
    movementGroupId: string | null;
    movementDiceCount: number | null;
    minimumMoveAllowance: number | null;
    contractGaps: BetrayalMonsterTurnStartResolutionContractGap[];
    previewOnly: true;
    reason: string | null;
}

export interface BetrayalMonsterMovementGroup {
    groupId: string;
    monsterName: string;
    monsterIds: string[];
    speed: number;
    diceCount: number;
    rollOnceForGroup: true;
    minimumMoveAllowance: number;
}

export type BetrayalMonsterMovementRollGroupContractGap =
    | 'formal-command'
    | 'movement-allowance-write'
    | 'path-preview-ui';

export interface BetrayalMonsterMovementRollGroupPreview {
    active: boolean;
    canRoll: boolean;
    groupId: string | null;
    monsterName: string | null;
    monsterIds: string[];
    speed: number | null;
    diceCount: number | null;
    rollOnceForGroup: boolean;
    minimumMoveAllowance: number | null;
    willWriteMoveAllowanceForMonsterIds: string[];
    contractGaps: BetrayalMonsterMovementRollGroupContractGap[];
    previewOnly: true;
    reason: string | null;
}

export interface BetrayalMonsterMovementRollGroupResult {
    groupId: string;
    monsterName: string;
    monsterIds: string[];
    playerId: string;
    speed: number;
    diceCount: number;
    dice: number[];
    total: number;
    moveAllowance: number;
    rollOnceForGroup: true;
    minimumMoveAllowance: number;
}

export interface BetrayalMonsterTurnRuntimeState {
    resolvedStartMonsterIds: string[];
    skippedMonsterIdsThisTurn: string[];
    attackedMonsterIdsThisTurn: string[];
    movedMonsterIdsThisTurn: string[];
    movementRollsByGroupId: Record<string, BetrayalMonsterMovementRollGroupResult>;
    moveRemainingById: Record<string, number>;
}

export interface BetrayalMonsterActionSet {
    monsterId: string;
    name: string;
    status: BetrayalMonsterStatusKind;
    roomId: string | null;
    canMove: boolean;
    moveTargetRoomIds: string[];
    canAttack: boolean;
    defaultAttackTrait: BetrayalTraitKey;
    usesNormalAttackRules: boolean;
    canHoldPossessions: boolean;
    canHoldOmens: boolean;
    canUsePossessionActions: boolean;
    canExploreNewRooms: boolean;
    canDiscoverRoomTiles: boolean;
    canIgnoreDamagingRoomEffects: boolean;
    scenarioSpecificOverridesMayApply: true;
    reason: string | null;
    ruleNotes: string[];
}

export type BetrayalMonsterActionSlotKind =
    | 'turn-start'
    | 'movement-roll'
    | 'move'
    | 'attack'
    | 'end-turn';

export type BetrayalMonsterActionSlotCommand =
    | typeof BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START
    | typeof BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP
    | typeof BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM
    | typeof BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO
    | typeof BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN
    | typeof BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK
    | typeof BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK
    | typeof BETRAYAL_COMMANDS.HAUNT_ATTACK;

export type BetrayalMonsterActionSlotContractGap =
    | 'ui-token-flip'
    | 'path-preview-ui'
    | 'attack-target-ui'
    | 'scenario-specific-attack';

export interface BetrayalMonsterActionSlot {
    id: string;
    kind: BetrayalMonsterActionSlotKind;
    label: string;
    command: BetrayalMonsterActionSlotCommand;
    monsterId: string | null;
    groupId: string | null;
    enabled: boolean;
    reason: string | null;
    targetRoomIds: string[];
    moveRemaining: number | null;
    moveCost: number | null;
    defaultAttackTrait: BetrayalTraitKey | null;
    contractGaps: BetrayalMonsterActionSlotContractGap[];
}

export interface BetrayalMonsterActionPanelReadModel {
    active: boolean;
    monsterIds: string[];
    movementGroupIds: string[];
    slots: BetrayalMonsterActionSlot[];
    contractGaps: BetrayalMonsterActionSlotContractGap[];
    reason: string | null;
}

export interface BetrayalBloodFromStoneMonsterTurnRuntimeState {
    monsterTurnAfterPlayerId: string | null;
    activeMonsterTurn: boolean;
    monsterTurnControllerPlayerId: string | null;
}

export interface BetrayalBloodFromStoneMonsterTurnStatus {
    active: boolean;
    controllerPlayerId: string | null;
    monsterTurnAfterPlayerId: string | null;
    stoneCherubIds: string[];
    reason: string | null;
}

export interface BetrayalHelpingHandsMonsterTurnStatus {
    active: boolean;
    controllerPlayerId: string | null;
    monsterTurnAfterPlayerId: string | null;
    trollHandIds: string[];
    moveAllowance: number;
    moveDice: number[];
    moveRemainingById: Record<string, number>;
    reason: string | null;
}

export interface BetrayalBloodFromStoneMonsterTurnEndPreview {
    active: boolean;
    canEnd: boolean;
    controllerPlayerId: string | null;
    nextPlayerId: string | null;
    visibleStoneCherubCountsByPlayerId: Record<string, number>;
    reason: string | null;
}

export interface BetrayalBloodFromStoneGazeDamageRoll {
    playerId: string;
    explorerName: string;
    visibleStoneCherubIds: string[];
    dice: number[];
    amount: number;
}

export interface BetrayalNormalMonsterAttackTargetReadModel {
    monsterId: string;
    monsterName: string;
    roomId: string | null;
    defaultAttackTrait: BetrayalTraitKey;
    targetPlayerIds: string[];
    targetLabels: string[];
    usesNormalAttackRules: true;
    canResolveWithExistingCommand: boolean;
    reason: string | null;
    contractGaps: BetrayalMonsterActionSlotContractGap[];
}

export function createInitialMonsterTurnRuntimeState(): BetrayalMonsterTurnRuntimeState {
    return {
        resolvedStartMonsterIds: [],
        skippedMonsterIdsThisTurn: [],
        attackedMonsterIdsThisTurn: [],
        movedMonsterIdsThisTurn: [],
        movementRollsByGroupId: {},
        moveRemainingById: {},
    };
}

export function cloneMonsterMovementRollGroupResult(
    result: BetrayalMonsterMovementRollGroupResult,
): BetrayalMonsterMovementRollGroupResult {
    return {
        ...result,
        monsterIds: [...result.monsterIds],
        dice: [...result.dice],
    };
}

export function cloneMonsterTurnRuntimeState(
    monsterTurn: BetrayalMonsterTurnRuntimeState | null | undefined,
): BetrayalMonsterTurnRuntimeState {
    if (!monsterTurn) {
        return createInitialMonsterTurnRuntimeState();
    }
    const movementRollsByGroupId = monsterTurn.movementRollsByGroupId ?? {};
    return {
        resolvedStartMonsterIds: [...(monsterTurn.resolvedStartMonsterIds ?? [])],
        skippedMonsterIdsThisTurn: [...(monsterTurn.skippedMonsterIdsThisTurn ?? [])],
        attackedMonsterIdsThisTurn: [...(monsterTurn.attackedMonsterIdsThisTurn ?? [])],
        movedMonsterIdsThisTurn: [...(monsterTurn.movedMonsterIdsThisTurn ?? [])],
        movementRollsByGroupId: Object.fromEntries(
            Object.entries(movementRollsByGroupId).map(([groupId, result]) => [
                groupId,
                cloneMonsterMovementRollGroupResult(result),
            ]),
        ),
        moveRemainingById: { ...(monsterTurn.moveRemainingById ?? {}) },
    };
}

export function cloneBloodFromStoneMonsterTurnRuntimeState(
    bloodFromStone: BetrayalBloodFromStoneMonsterTurnRuntimeState | null | undefined,
): BetrayalBloodFromStoneMonsterTurnRuntimeState | undefined {
    return bloodFromStone
        ? {
            monsterTurnAfterPlayerId: bloodFromStone.monsterTurnAfterPlayerId,
            activeMonsterTurn: bloodFromStone.activeMonsterTurn,
            monsterTurnControllerPlayerId: bloodFromStone.monsterTurnControllerPlayerId,
        }
        : undefined;
}

export function resolveHelpingHandsMonsterTurnStatus(core: BetrayalCore): BetrayalHelpingHandsMonsterTurnStatus {
    const helpingHands = core.scenarioRuntime.helpingHands;
    if (!isHelpingHandsHaunt(core) || !helpingHands) {
        return {
            active: false,
            controllerPlayerId: null,
            monsterTurnAfterPlayerId: null,
            trollHandIds: [],
            moveAllowance: 0,
            moveDice: [],
            moveRemainingById: {},
            reason: '当前不是第12号作祟《援手》。',
        };
    }
    const amuletHolderPlayerId = resolveHelpingHandsControllerPlayerId(core);
    const controllerPlayerId = helpingHands.activeMonsterTurn
        ? helpingHands.monsterTurnControllerPlayerId
        : amuletHolderPlayerId;
    return {
        active: helpingHands.activeMonsterTurn && Boolean(controllerPlayerId),
        controllerPlayerId,
        monsterTurnAfterPlayerId: helpingHands.monsterTurnAfterPlayerId,
        trollHandIds: [...helpingHands.trollHandIds],
        moveAllowance: helpingHands.trollHandMoveAllowance,
        moveDice: [...helpingHands.trollHandMoveDice],
        moveRemainingById: { ...helpingHands.trollHandMoveRemainingById },
        reason: helpingHands.activeMonsterTurn
            ? (controllerPlayerId ? null : '当前巨魔手回合没有有效控制者。')
            : amuletHolderPlayerId
                ? '等待揭秘者结束回合后开始巨魔手怪物回合。'
                : '无人持有奇异护符，巨魔手怪物回合跳过。',
    };
}

export function resolveBloodFromStoneMonsterTurnStatus(
    core: BetrayalCore,
): BetrayalBloodFromStoneMonsterTurnStatus {
    const stoneCherubIds = core.monsters
        .filter((monster) => isStoneCherubMonster(monster))
        .map((monster) => monster.id);
    if (!isBloodFromStoneHaunt(core)) {
        return {
            active: false,
            controllerPlayerId: null,
            monsterTurnAfterPlayerId: null,
            stoneCherubIds,
            reason: '当前不是第5号作祟《顽石之血》。',
        };
    }
    const runtime = core.scenarioRuntime.bloodFromStone;
    const monsterTurnAfterPlayerId = runtime?.monsterTurnAfterPlayerId
        ?? core.scenarioRuntime.hauntRevealerPlayerId
        ?? null;
    const controllerPlayerId = runtime?.activeMonsterTurn
        ? runtime.monsterTurnControllerPlayerId
        : monsterTurnAfterPlayerId;
    return {
        active: Boolean(runtime?.activeMonsterTurn && controllerPlayerId && stoneCherubIds.length > 0),
        controllerPlayerId: controllerPlayerId ?? null,
        monsterTurnAfterPlayerId,
        stoneCherubIds,
        reason: runtime?.activeMonsterTurn
            ? (controllerPlayerId ? null : '石像小天使怪物回合没有有效控制者。')
            : stoneCherubIds.length > 0
                ? '等待揭秘者结束回合后开始石像小天使怪物回合。'
                : '当前宅邸中没有石像小天使。',
    };
}

function monsterTurnStartResolvedThisTurn(core: BetrayalCore, monsterId: string): boolean {
    return core.scenarioRuntime.monsterTurn?.resolvedStartMonsterIds?.includes(monsterId) ?? false;
}

function monsterSkippedThisTurn(core: BetrayalCore, monsterId: string): boolean {
    return core.scenarioRuntime.monsterTurn?.skippedMonsterIdsThisTurn?.includes(monsterId) ?? false;
}

function monsterAttackedThisTurn(core: BetrayalCore, monsterId: string): boolean {
    return core.scenarioRuntime.monsterTurn?.attackedMonsterIdsThisTurn?.includes(monsterId) ?? false;
}

function resolveMummyMovementRollThisTurn(
    core: BetrayalCore,
    monsterId: string,
): BetrayalMonsterMovementRollGroupResult | null {
    if (!isMummyMonster(core, monsterId)) {
        return null;
    }
    return Object.values(core.scenarioRuntime.monsterTurn?.movementRollsByGroupId ?? {})
        .find((result) => result.monsterIds.includes(monsterId)) ?? null;
}

export function hasMummyTeleportMoveAvailable(core: BetrayalCore, monsterId: string): boolean {
    const roll = resolveMummyMovementRollThisTurn(core, monsterId);
    return Boolean(
        roll
        && roll.total <= 1
        && !(core.scenarioRuntime.monsterTurn?.movedMonsterIdsThisTurn ?? []).includes(monsterId),
    );
}

function resolveMummySameRoomAttackTargets(
    core: BetrayalCore,
    monster: BetrayalMonsterSummary,
): BetrayalExplorerSummary[] {
    if (!isMummyMonster(core, monster)) {
        return [];
    }
    return getAllExplorers(core).filter((explorer) => (
        resolveBetrayalExplorerSide(core, explorer.playerId) === 'hero'
        && explorer.roomId === monster.roomId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
}

export function mustMummyAttackBeforeMoving(core: BetrayalCore, monster: BetrayalMonsterSummary): boolean {
    return isMummyMonster(core, monster)
        && !monsterAttackedThisTurn(core, monster.id)
        && resolveMummySameRoomAttackTargets(core, monster).length > 0;
}

function isExplorerTargetableByMonsters(core: BetrayalCore, explorer: BetrayalExplorerSummary): boolean {
    if (core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)) {
        return false;
    }
    if (
        isUponReflectionHaunt(core)
        && explorer.playerId === (
            core.scenarioRuntime.uponReflection?.revealerPlayerId
            ?? core.scenarioRuntime.hauntRevealerPlayerId
        )
    ) {
        return false;
    }
    return true;
}

export function resolveMonsterAttackCommand(core: BetrayalCore, monsterId: string): BetrayalMonsterActionSlotCommand {
    if (monsterId === 'jack-spirit') {
        return BETRAYAL_COMMANDS.HAUNT_ATTACK;
    }
    if (findPhantomPhotographer(core, monsterId)) {
        return BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK;
    }
    if (findHelpingHandsTrollHand(core, monsterId)) {
        return BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK;
    }
    return BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO;
}

function resolveDiscoveredRoomGraphDistances(
    rooms: BetrayalRoomNode[],
    sourceRoomId: string,
): Map<string, number> {
    const sourceRoom = rooms.find((room) => room.id === sourceRoomId && room.state === 'discovered');
    if (!sourceRoom) {
        return new Map();
    }
    const distances = new Map<string, number>([[sourceRoom.id, 0]]);
    const queue = [sourceRoom.id];
    while (queue.length > 0) {
        const roomId = queue.shift()!;
        const nextDistance = (distances.get(roomId) ?? 0) + 1;
        for (const connectedRoomId of resolveConnectedRoomIds(rooms, roomId)) {
            const connectedRoom = rooms.find((room) => room.id === connectedRoomId && room.state === 'discovered');
            if (!connectedRoom || distances.has(connectedRoom.id)) {
                continue;
            }
            distances.set(connectedRoom.id, nextDistance);
            queue.push(connectedRoom.id);
        }
    }
    return distances;
}

function resolveUponReflectionTargetExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    return getAllExplorers(core).filter((explorer) => {
        if (!isExplorerTargetableByMonsters(core, explorer)) {
            return false;
        }
        const room = core.rooms.find((candidate) => candidate.id === resolveControlledRoomId(core, explorer));
        return room?.state === 'discovered';
    });
}

function resolveUponReflectionMirrorBeingMoveTargetRooms(
    core: BetrayalCore,
    monster: BetrayalMonsterSummary,
    connectedRooms: BetrayalRoomNode[],
): BetrayalRoomNode[] {
    if (!isUponReflectionHaunt(core) || !isUponReflectionMirrorBeingMonster(monster)) {
        return connectedRooms;
    }
    const targetExplorers = resolveUponReflectionTargetExplorers(core);
    if (targetExplorers.length === 0) {
        return [];
    }
    const sourceDistances = resolveDiscoveredRoomGraphDistances(core.rooms, monster.roomId);
    const targetDistances = targetExplorers
        .map((explorer) => ({
            explorer,
            distance: sourceDistances.get(resolveControlledRoomId(core, explorer)) ?? null,
        }))
        .filter((entry): entry is { explorer: BetrayalExplorerSummary; distance: number } => entry.distance !== null);
    if (targetDistances.length === 0) {
        return connectedRooms;
    }
    const nearestDistance = Math.min(...targetDistances.map((entry) => entry.distance));
    if (nearestDistance <= 0) {
        return [];
    }
    const nearestTargetRoomIds = new Set(
        targetDistances
            .filter((entry) => entry.distance === nearestDistance)
            .map((entry) => resolveControlledRoomId(core, entry.explorer)),
    );
    return connectedRooms.filter((room) => {
        const distancesFromCandidate = resolveDiscoveredRoomGraphDistances(core.rooms, room.id);
        return [...nearestTargetRoomIds].some((targetRoomId) => {
            const targetDistance = distancesFromCandidate.get(targetRoomId);
            return targetDistance !== undefined && targetDistance < nearestDistance;
        });
    });
}

function resolveLivingHeroRooms(core: BetrayalCore): BetrayalRoomNode[] {
    return resolveLivingHeroExplorers(core)
        .map((explorer) => core.rooms.find((room) => room.id === resolveControlledRoomId(core, explorer)))
        .filter((room): room is BetrayalRoomNode => Boolean(room && room.state === 'discovered'));
}

export function isRoomInAnyLivingHeroLineOfSight(core: BetrayalCore, roomId: string): boolean {
    const room = core.rooms.find((candidate) => candidate.id === roomId && candidate.state === 'discovered');
    if (!room) {
        return false;
    }
    return resolveLivingHeroRooms(core).some((heroRoom) => isStraightLineVisible(room, heroRoom, core.rooms));
}

function shouldStoneCherubSkipMovementFromLineOfSight(core: BetrayalCore, monster: BetrayalMonsterSummary): boolean {
    return isBloodFromStoneHaunt(core)
        && isStoneCherubMonster(monster)
        && isRoomInAnyLivingHeroLineOfSight(core, monster.roomId);
}

function resolveStoneCherubClosestHeroDistance(core: BetrayalCore, room: BetrayalRoomNode): number | null {
    const heroRooms = resolveLivingHeroRooms(core);
    if (heroRooms.length === 0) {
        return null;
    }
    return Math.min(...heroRooms.map((heroRoom) => roomDistanceByLayout(room, heroRoom)));
}

function resolveStoneCherubMoveTargetRooms(
    core: BetrayalCore,
    monster: BetrayalMonsterSummary,
    connectedRooms: BetrayalRoomNode[],
): BetrayalRoomNode[] {
    if (!isBloodFromStoneHaunt(core) || !isStoneCherubMonster(monster)) {
        return connectedRooms;
    }
    const sourceRoom = core.rooms.find((room) => room.id === monster.roomId && room.state === 'discovered');
    if (!sourceRoom) {
        return [];
    }
    const sourceDistance = resolveStoneCherubClosestHeroDistance(core, sourceRoom);
    if (sourceDistance === null) {
        return connectedRooms;
    }
    const towardClosestHero = connectedRooms.filter((room) => {
        const targetDistance = resolveStoneCherubClosestHeroDistance(core, room);
        return targetDistance !== null && targetDistance < sourceDistance;
    });
    return towardClosestHero.length > 0 ? towardClosestHero : connectedRooms;
}

export function resolveStoneCherubMoveRemainingAfterMove(
    core: BetrayalCore,
    monster: BetrayalMonsterSummary,
    targetRoomId: string,
    moveRemainingAfterCost: number,
): number {
    if (
        isBloodFromStoneHaunt(core)
        && isStoneCherubMonster(monster)
        && isRoomInAnyLivingHeroLineOfSight(core, targetRoomId)
    ) {
        return 0;
    }
    return moveRemainingAfterCost;
}

export function resolveStoneCherubsInHeroLineOfSight(
    core: BetrayalCore,
    hero: BetrayalExplorerSummary,
): BetrayalMonsterSummary[] {
    const heroRoom = resolveExplorerRoom(core, hero);
    if (!heroRoom || heroRoom.state !== 'discovered') {
        return [];
    }
    return core.monsters.filter((monster) => {
        if (!isStoneCherubMonster(monster) || resolveMonsterStatusKind(core, monster.id) === 'killed') {
            return false;
        }
        const monsterRoom = core.rooms.find((room) => room.id === monster.roomId && room.state === 'discovered');
        return Boolean(monsterRoom && isStraightLineVisible(monsterRoom, heroRoom, core.rooms));
    });
}

export function resolveStoneCherubsInLineOfSightFromRoom(
    core: BetrayalCore,
    roomId: string,
): BetrayalMonsterSummary[] {
    const heroRoom = core.rooms.find((room) => room.id === roomId && room.state === 'discovered');
    if (!heroRoom) {
        return [];
    }
    return core.monsters.filter((monster) => {
        if (!isStoneCherubMonster(monster) || resolveMonsterStatusKind(core, monster.id) === 'killed') {
            return false;
        }
        const monsterRoom = core.rooms.find((room) => room.id === monster.roomId && room.state === 'discovered');
        return Boolean(monsterRoom && isStraightLineVisible(monsterRoom, heroRoom, core.rooms));
    });
}

export function createBloodFromStoneTurnStartVisibility(
    core: BetrayalCore,
): Record<string, string[]> {
    if (!isBloodFromStoneHaunt(core)) {
        return {};
    }
    return Object.fromEntries(
        resolveLivingHeroExplorers(core).map((hero) => [
            hero.playerId,
            resolveStoneCherubsInHeroLineOfSight(core, hero).map((monster) => monster.id),
        ]),
    );
}

export function resolveBloodFromStoneTurnStartVisibleStoneCherubIds(
    core: BetrayalCore,
    playerId: string,
): string[] {
    const stored = core.scenarioRuntime.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId?.[playerId];
    if (stored) {
        return [...stored];
    }
    const hero = getAllExplorers(core).find((explorer) => explorer.playerId === playerId);
    return hero ? resolveStoneCherubsInHeroLineOfSight(core, hero).map((monster) => monster.id) : [];
}

export function resolveBloodFromStoneNewLineOfSightDamageRoll(
    core: BetrayalCore,
    playerId: string,
    targetRoomId: string,
    random: RandomFn,
): BetrayalBloodFromStoneGazeDamageRoll | null {
    if (
        !isBloodFromStoneHaunt(core)
        || core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn?.includes(playerId)
    ) {
        return null;
    }
    const hero = resolveLivingHeroExplorers(core).find((explorer) => explorer.playerId === playerId);
    if (!hero) {
        return null;
    }
    const turnStartVisibleStoneCherubIds = new Set(
        resolveBloodFromStoneTurnStartVisibleStoneCherubIds(core, playerId),
    );
    const newlyVisibleStoneCherubs = resolveStoneCherubsInLineOfSightFromRoom(core, targetRoomId)
        .filter((monster) => !turnStartVisibleStoneCherubIds.has(monster.id));
    if (newlyVisibleStoneCherubs.length === 0) {
        return null;
    }
    const dice = rollBetrayalDicePips(random, 2);
    return {
        playerId: hero.playerId,
        explorerName: hero.displayName,
        visibleStoneCherubIds: newlyVisibleStoneCherubs.map((monster) => monster.id),
        dice,
        amount: dice.reduce((sum, pip) => sum + pip, 0),
    };
}

export function resolveBloodFromStoneGazeDamageRolls(
    core: BetrayalCore,
    random: RandomFn,
): BetrayalBloodFromStoneGazeDamageRoll[] {
    if (!isBloodFromStoneHaunt(core)) {
        return [];
    }
    return resolveLivingHeroExplorers(core)
        .map((hero) => {
            const visibleStoneCherubs = resolveStoneCherubsInHeroLineOfSight(core, hero);
            const dice = rollBetrayalDicePips(random, visibleStoneCherubs.length);
            return {
                playerId: hero.playerId,
                explorerName: hero.displayName,
                visibleStoneCherubIds: visibleStoneCherubs.map((monster) => monster.id),
                dice,
                amount: dice.reduce((sum, pip) => sum + pip, 0),
            };
        })
        .filter((roll) => roll.visibleStoneCherubIds.length > 0);
}

export function canPlayerControlStandardMonsterTurn(core: BetrayalCore, playerId: string): boolean {
    return Boolean(
        shouldDeadPlayerControlFeverish(core, playerId)
        || (
            isUponReflectionHaunt(core)
            && core.scenarioRuntime.uponReflection?.revealerPlayerId === playerId
        )
        || (
            Boolean(core.scenarioRuntime.traitorPlayerId)
            && core.scenarioRuntime.traitorPlayerId === playerId
        ),
    );
}

export function resolveBetrayalMonsterTurnStartStatus(
    core: BetrayalCore,
    monsterId: string,
): BetrayalMonsterTurnStartStatus | null {
    const monsterStatus = resolveBetrayalMonsterStatuses(core)
        .find((status) => status.monsterId === monsterId);
    if (!monsterStatus) {
        return null;
    }
    if (monsterStatus.killed) {
        return {
            monsterId: monsterStatus.monsterId,
            name: monsterStatus.name,
            status: 'killed',
            nextStatus: 'killed',
            canStartTurn: false,
            mustFlipStunnedSideUp: false,
            mustSkipTurn: true,
            canRollMovement: false,
            canAttack: false,
            reason: '该怪物已被杀死并移出房子，不能开始怪物回合。',
        };
    }
    if (monsterStatus.stunned) {
        return {
            monsterId: monsterStatus.monsterId,
            name: monsterStatus.name,
            status: 'stunned',
            nextStatus: 'active',
            canStartTurn: false,
            mustFlipStunnedSideUp: true,
            mustSkipTurn: true,
            canRollMovement: false,
            canAttack: false,
            reason: '怪物回合开始时该怪物已被击晕，翻回正面并结束该怪物的本次回合。',
        };
    }
    if (monsterSkippedThisTurn(core, monsterId)) {
        return {
            monsterId: monsterStatus.monsterId,
            name: monsterStatus.name,
            status: 'active',
            nextStatus: 'active',
            canStartTurn: false,
            mustFlipStunnedSideUp: false,
            mustSkipTurn: true,
            canRollMovement: false,
            canAttack: false,
            reason: '该怪物本回合已跳过，不能再次移动或攻击。',
        };
    }
    const monster = core.monsters.find((item) => item.id === monsterId);
    if (monster && shouldStoneCherubSkipMovementFromLineOfSight(core, monster)) {
        return {
            monsterId: monsterStatus.monsterId,
            name: monsterStatus.name,
            status: 'active',
            nextStatus: 'active',
            canStartTurn: false,
            mustFlipStunnedSideUp: false,
            mustSkipTurn: true,
            canRollMovement: false,
            canAttack: false,
            reason: '石像小天使在英雄视线内开始怪物回合，本回合不移动。',
        };
    }
    const attackedThisTurn = monsterAttackedThisTurn(core, monsterId);
    const canAttack = monsterStatus.canAttack && !attackedThisTurn;
    return {
        monsterId: monsterStatus.monsterId,
        name: monsterStatus.name,
        status: 'active',
        nextStatus: 'active',
        canStartTurn: true,
        mustFlipStunnedSideUp: false,
        mustSkipTurn: false,
        canRollMovement: true,
        canAttack,
        reason: attackedThisTurn ? '该怪物本回合已经攻击过。' : null,
    };
}

export function resolveBetrayalMonsterTurnStartResolutionPreview(
    core: BetrayalCore,
    monsterId: string,
): BetrayalMonsterTurnStartResolutionPreview {
    const turnStartStatus = resolveBetrayalMonsterTurnStartStatus(core, monsterId);
    if (!turnStartStatus) {
        return {
            active: false,
            canResolve: false,
            resolutionStatus: 'missing-monster',
            monsterId,
            name: null,
            status: null,
            nextStatus: null,
            willFlipStunnedSideUp: false,
            willRemoveStunnedMarker: false,
            willSkipTurn: false,
            willStartTurn: false,
            willRollMovement: false,
            willOpenAttackWindow: false,
            movementGroupId: null,
            movementDiceCount: null,
            minimumMoveAllowance: null,
            contractGaps: [],
            previewOnly: true,
            reason: '当前宅邸中找不到该怪物。',
        };
    }

    if (monsterTurnStartResolvedThisTurn(core, monsterId)) {
        return {
            active: true,
            canResolve: false,
            resolutionStatus: 'already-resolved',
            monsterId,
            name: turnStartStatus.name,
            status: turnStartStatus.status,
            nextStatus: turnStartStatus.nextStatus,
            willFlipStunnedSideUp: false,
            willRemoveStunnedMarker: false,
            willSkipTurn: false,
            willStartTurn: false,
            willRollMovement: false,
            willOpenAttackWindow: false,
            movementGroupId: null,
            movementDiceCount: null,
            minimumMoveAllowance: null,
            contractGaps: [],
            previewOnly: true,
            reason: '该怪物本回合开始步骤已处理。',
        };
    }

    const movementGroup = resolveBetrayalMonsterMovementGroups(core)
        .find((group) => group.monsterIds.includes(monsterId)) ?? null;
    const contractGaps: BetrayalMonsterTurnStartResolutionContractGap[] = [];
    if (turnStartStatus.mustFlipStunnedSideUp) {
        contractGaps.push('ui-token-flip');
    }

    return {
        active: true,
        canResolve: true,
        resolutionStatus: 'ready',
        monsterId,
        name: turnStartStatus.name,
        status: turnStartStatus.status,
        nextStatus: turnStartStatus.nextStatus,
        willFlipStunnedSideUp: turnStartStatus.mustFlipStunnedSideUp,
        willRemoveStunnedMarker: turnStartStatus.mustFlipStunnedSideUp,
        willSkipTurn: turnStartStatus.mustSkipTurn,
        willStartTurn: turnStartStatus.canStartTurn,
        willRollMovement: turnStartStatus.canRollMovement,
        willOpenAttackWindow: turnStartStatus.canAttack,
        movementGroupId: movementGroup?.groupId ?? null,
        movementDiceCount: movementGroup?.diceCount ?? null,
        minimumMoveAllowance: movementGroup?.minimumMoveAllowance ?? null,
        contractGaps,
        previewOnly: true,
        reason: turnStartStatus.reason,
    };
}

export function resolveBetrayalMonsterMovementGroups(core: BetrayalCore): BetrayalMonsterMovementGroup[] {
    const groups = new Map<string, BetrayalMonsterMovementGroup>();
    for (const monster of core.monsters) {
        const turnStartStatus = resolveBetrayalMonsterTurnStartStatus(core, monster.id);
        if (!turnStartStatus?.canRollMovement || monsterSkippedThisTurn(core, monster.id)) {
            continue;
        }
        const groupId = `${monster.name}:${monster.speed}`;
        const existing = groups.get(groupId);
        if (existing) {
            existing.monsterIds = [...existing.monsterIds, monster.id];
            continue;
        }
        groups.set(groupId, {
            groupId,
            monsterName: monster.name,
            monsterIds: [monster.id],
            speed: monster.speed,
            diceCount: monster.speed,
            rollOnceForGroup: true,
            minimumMoveAllowance: isMummyMonster(core, monster) ? 0 : 1,
        });
    }
    return Array.from(groups.values());
}

export function resolveBetrayalMonsterMovementRollGroupPreview(
    core: BetrayalCore,
    groupId: string,
): BetrayalMonsterMovementRollGroupPreview {
    const existingRoll = core.scenarioRuntime.monsterTurn?.movementRollsByGroupId?.[groupId] ?? null;
    const group = resolveBetrayalMonsterMovementGroups(core)
        .find((candidate) => candidate.groupId === groupId) ?? null;
    if (existingRoll) {
        return {
            active: true,
            canRoll: false,
            groupId,
            monsterName: existingRoll.monsterName,
            monsterIds: [...existingRoll.monsterIds],
            speed: existingRoll.speed,
            diceCount: existingRoll.diceCount,
            rollOnceForGroup: existingRoll.rollOnceForGroup,
            minimumMoveAllowance: existingRoll.minimumMoveAllowance,
            willWriteMoveAllowanceForMonsterIds: [],
            contractGaps: ['path-preview-ui'],
            previewOnly: true,
            reason: '该怪物移动骰组本回合已掷骰。',
        };
    }
    if (!group) {
        return {
            active: false,
            canRoll: false,
            groupId,
            monsterName: null,
            monsterIds: [],
            speed: null,
            diceCount: null,
            rollOnceForGroup: false,
            minimumMoveAllowance: null,
            willWriteMoveAllowanceForMonsterIds: [],
            contractGaps: [],
            previewOnly: true,
            reason: '当前没有可行动的同类型怪物移动骰组。',
        };
    }

    return {
        active: true,
        canRoll: true,
        groupId: group.groupId,
        monsterName: group.monsterName,
        monsterIds: [...group.monsterIds],
        speed: group.speed,
        diceCount: group.diceCount,
        rollOnceForGroup: group.rollOnceForGroup,
        minimumMoveAllowance: group.minimumMoveAllowance,
        willWriteMoveAllowanceForMonsterIds: [...group.monsterIds],
        contractGaps: ['path-preview-ui'],
        previewOnly: true,
        reason: null,
    };
}

export function createBetrayalMonsterMovementRollGroupResult(
    core: BetrayalCore,
    groupId: string,
    playerId: string,
    random: RandomFn,
): BetrayalMonsterMovementRollGroupResult | null {
    const preview = resolveBetrayalMonsterMovementRollGroupPreview(core, groupId);
    if (!preview.canRoll || !preview.monsterName || preview.speed === null || preview.diceCount === null || preview.minimumMoveAllowance === null) {
        return null;
    }
    const dice = rollBetrayalDicePips(random, preview.diceCount);
    const total = dice.reduce((sum, pip) => sum + pip, 0);
    return {
        groupId,
        monsterName: preview.monsterName,
        monsterIds: [...preview.monsterIds],
        playerId,
        speed: preview.speed,
        diceCount: preview.diceCount,
        dice,
        total,
        moveAllowance: Math.max(preview.minimumMoveAllowance, total),
        rollOnceForGroup: true,
        minimumMoveAllowance: preview.minimumMoveAllowance,
    };
}

export function resolveBetrayalMonsterTurnRuntimeState(
    core: BetrayalCore,
): BetrayalMonsterTurnRuntimeState {
    return cloneMonsterTurnRuntimeState(core.scenarioRuntime.monsterTurn);
}

export function resolveBetrayalMonsterMoveCost(
    core: BetrayalCore,
    monsterId: string,
): number {
    const monster = core.monsters.find((item) => item.id === monsterId);
    if (!monster) {
        return 0;
    }
    const sharesRoomWithLivingHero = getAllExplorers(core).some((explorer) => (
        resolveControlledRoomId(core, explorer) === monster.roomId
        && isExplorerTargetableByMonsters(core, explorer)
        && resolveBetrayalExplorerSide(core, explorer.playerId) === 'hero'
    ));
    return sharesRoomWithLivingHero ? 2 : 1;
}

export function resolveBetrayalMonsterMoveTargetRooms(
    core: BetrayalCore,
    monsterId: string,
): BetrayalRoomNode[] {
    const turnStartStatus = resolveBetrayalMonsterTurnStartStatus(core, monsterId);
    if (!turnStartStatus?.canStartTurn || !turnStartStatus.canRollMovement) {
        return [];
    }
    const monster = core.monsters.find((item) => item.id === monsterId);
    if (!monster) {
        return [];
    }
    const sourceRoom = core.rooms.find((room) => room.id === monster.roomId);
    if (!sourceRoom || sourceRoom.state !== 'discovered') {
        return [];
    }
    if (mustMummyAttackBeforeMoving(core, monster)) {
        return [];
    }
    if (hasMummyTeleportMoveAvailable(core, monster.id)) {
        return core.rooms.filter((room) => (
            room.state === 'discovered'
            && room.id !== sourceRoom.id
        ));
    }
    const connectedRoomIds = resolveConnectedRoomIds(core.rooms, sourceRoom.id);
    const connectedRooms = core.rooms.filter((room) => (
        room.state === 'discovered'
        && room.id !== sourceRoom.id
        && connectedRoomIds.has(room.id)
    ));
    const stoneCherubTargets = resolveStoneCherubMoveTargetRooms(core, monster, connectedRooms);
    return resolveUponReflectionMirrorBeingMoveTargetRooms(core, monster, stoneCherubTargets);
}

export function resolveBetrayalMonsterActionSet(
    core: BetrayalCore,
    monsterId: string,
): BetrayalMonsterActionSet | null {
    const monsterStatus = resolveBetrayalMonsterStatuses(core)
        .find((status) => status.monsterId === monsterId);
    const turnStartStatus = resolveBetrayalMonsterTurnStartStatus(core, monsterId);
    if (!monsterStatus || !turnStartStatus) {
        return null;
    }
    const moveTargetRoomIds = resolveBetrayalMonsterMoveTargetRooms(core, monsterId)
        .map((room) => room.id);
    const isMummyActionSet = isMummyMonster(core, monsterId);
    return {
        monsterId: monsterStatus.monsterId,
        name: monsterStatus.name,
        status: monsterStatus.status,
        roomId: monsterStatus.roomId,
        canMove: turnStartStatus.canRollMovement && moveTargetRoomIds.length > 0,
        moveTargetRoomIds,
        canAttack: turnStartStatus.canAttack,
        defaultAttackTrait: monsterStatus.defaultAttackTrait,
        usesNormalAttackRules: turnStartStatus.canAttack,
        canHoldPossessions: isMummyActionSet,
        canHoldOmens: isMummyActionSet,
        canUsePossessionActions: false,
        canExploreNewRooms: false,
        canDiscoverRoomTiles: false,
        canIgnoreDamagingRoomEffects: turnStartStatus.canStartTurn,
        scenarioSpecificOverridesMayApply: true,
        reason: turnStartStatus.reason,
        ruleNotes: isMummyActionSet
            ? [
                '木乃伊只用力量攻击；同房有英雄且能攻击时必须先攻击。',
                '木乃伊可携带/偷取物品和预兆，但物件不改变木乃伊固定属性。',
                '木乃伊移动骰为 0 或 1 时，可瞬移到任意已发现房间；不能探索新房间。',
                '怪物可忽略伤害性房间效果；作祟专属规则仍可覆盖该默认口径。',
            ]
            : [
                '怪物默认使用力量进行正常攻击，除非作祟另有说明。',
                '怪物不能持有物品或预兆，也不能探索新房间。',
                '怪物可忽略伤害性房间效果；作祟专属规则仍可覆盖该默认口径。',
            ],
    };
}

export function resolveBetrayalMonsterActionSets(core: BetrayalCore): BetrayalMonsterActionSet[] {
    return resolveBetrayalMonsterStatuses(core)
        .map((status) => resolveBetrayalMonsterActionSet(core, status.monsterId))
        .filter((actionSet): actionSet is BetrayalMonsterActionSet => Boolean(actionSet));
}

function resolveBloodFromStoneHasEnabledMonsterAction(core: BetrayalCore): boolean {
    const stoneCherubIds = new Set(core.monsters
        .filter((monster) => isStoneCherubMonster(monster))
        .map((monster) => monster.id));
    if (!isBloodFromStoneHaunt(core) || stoneCherubIds.size === 0) {
        return false;
    }
    if (resolveBetrayalMonsterStatuses(core)
        .some((status) => stoneCherubIds.has(status.monsterId)
            && resolveBetrayalMonsterTurnStartResolutionPreview(core, status.monsterId).canResolve)) {
        return true;
    }
    if (resolveBetrayalMonsterMovementGroups(core).some((group) => (
        group.monsterIds.some((monsterId) => stoneCherubIds.has(monsterId))
        && resolveBetrayalMonsterMovementRollGroupPreview(core, group.groupId).canRoll
    ))) {
        return true;
    }
    return resolveBetrayalMonsterActionSets(core).some((actionSet) => {
        if (!stoneCherubIds.has(actionSet.monsterId)) {
            return false;
        }
        const moveCost = actionSet.status === 'active'
            ? resolveBetrayalMonsterMoveCost(core, actionSet.monsterId)
            : 0;
        const moveRemaining = core.scenarioRuntime.monsterTurn.moveRemainingById[actionSet.monsterId] ?? 0;
        const canMoveNow = actionSet.canMove
            && actionSet.moveTargetRoomIds.length > 0
            && moveCost > 0
            && moveRemaining >= moveCost;
        return canMoveNow || actionSet.canAttack;
    });
}

export function resolveBloodFromStoneMonsterTurnEndPreview(
    core: BetrayalCore,
): BetrayalBloodFromStoneMonsterTurnEndPreview {
    const stoneCherubIds = core.monsters
        .filter((monster) => isStoneCherubMonster(monster))
        .map((monster) => monster.id);
    if (!isBloodFromStoneHaunt(core)) {
        return {
            active: false,
            canEnd: false,
            controllerPlayerId: null,
            nextPlayerId: null,
            visibleStoneCherubCountsByPlayerId: {},
            reason: '当前不是石像小天使作祟。',
        };
    }
    if (stoneCherubIds.length === 0) {
        return {
            active: false,
            canEnd: false,
            controllerPlayerId: core.currentPlayer,
            nextPlayerId: null,
            visibleStoneCherubCountsByPlayerId: {},
            reason: '当前宅邸中没有石像小天使。',
        };
    }
    const monsterTurnStatus = resolveBloodFromStoneMonsterTurnStatus(core);
    if (!monsterTurnStatus.active) {
        return {
            active: false,
            canEnd: false,
            controllerPlayerId: monsterTurnStatus.controllerPlayerId,
            nextPlayerId: null,
            visibleStoneCherubCountsByPlayerId: {},
            reason: monsterTurnStatus.reason,
        };
    }
    if (resolveBloodFromStoneHasEnabledMonsterAction(core)) {
        return {
            active: true,
            canEnd: false,
            controllerPlayerId: monsterTurnStatus.controllerPlayerId,
            nextPlayerId: null,
            visibleStoneCherubCountsByPlayerId: {},
            reason: '请先完成石像小天使还能处理的开回合或移动。',
        };
    }
    const visibleStoneCherubCountsByPlayerId = Object.fromEntries(
        resolveLivingHeroExplorers(core)
            .map((hero) => [hero.playerId, resolveStoneCherubsInHeroLineOfSight(core, hero).length] as const)
            .filter(([, count]) => count > 0),
    );
    return {
        active: true,
        canEnd: true,
        controllerPlayerId: monsterTurnStatus.controllerPlayerId,
        nextPlayerId: monsterTurnStatus.controllerPlayerId
            ? rotateToNextLivingPlayer(core, monsterTurnStatus.controllerPlayerId)
            : null,
        visibleStoneCherubCountsByPlayerId,
        reason: null,
    };
}

export function resolveBetrayalMonsterActionPanel(core: BetrayalCore): BetrayalMonsterActionPanelReadModel {
    const monsterStatuses = resolveBetrayalMonsterStatuses(core);
    if (core.phase !== 'haunt') {
        return {
            active: false,
            monsterIds: monsterStatuses.map((status) => status.monsterId),
            movementGroupIds: [],
            slots: [],
            contractGaps: [],
            reason: '作祟开始前没有怪物动作槽。',
        };
    }
    if (monsterStatuses.length === 0) {
        return {
            active: false,
            monsterIds: [],
            movementGroupIds: [],
            slots: [],
            contractGaps: [],
            reason: '当前宅邸中没有怪物。',
        };
    }
    if (isBloodFromStoneHaunt(core) && !resolveBloodFromStoneMonsterTurnStatus(core).active) {
        return {
            active: false,
            monsterIds: monsterStatuses.map((status) => status.monsterId),
            movementGroupIds: [],
            slots: [],
            contractGaps: [],
            reason: resolveBloodFromStoneMonsterTurnStatus(core).reason,
        };
    }
    const helpingHandsMonsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);
    const isMonsterActionControllerTurn = isBloodFromStoneHaunt(core)
        ? resolveBloodFromStoneMonsterTurnStatus(core).active
            && resolveBloodFromStoneMonsterTurnStatus(core).controllerPlayerId === core.currentPlayer
        : isHelpingHandsHaunt(core)
            ? helpingHandsMonsterTurnStatus.active
                && helpingHandsMonsterTurnStatus.controllerPlayerId === core.currentPlayer
            : canPlayerControlStandardMonsterTurn(core, core.currentPlayer);
    if (!isMonsterActionControllerTurn) {
        return {
            active: false,
            monsterIds: monsterStatuses.map((status) => status.monsterId),
            movementGroupIds: [],
            slots: [],
            contractGaps: [],
            reason: '当前是玩家回合，等待怪物控制者回合后才能处理怪物动作。',
        };
    }

    const movementGroups = resolveBetrayalMonsterMovementGroups(core);
    const actionSets = resolveBetrayalMonsterActionSets(core);
    const slots: BetrayalMonsterActionSlot[] = [];

    for (const status of monsterStatuses) {
        const preview = resolveBetrayalMonsterTurnStartResolutionPreview(core, status.monsterId);
        if (!preview.active) {
            continue;
        }
        slots.push({
            id: `turn-start:${status.monsterId}`,
            kind: 'turn-start',
            label: `${status.name}开回合`,
            command: BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
            monsterId: status.monsterId,
            groupId: null,
            enabled: preview.canResolve,
            reason: preview.reason,
            targetRoomIds: [],
            moveRemaining: null,
            moveCost: null,
            defaultAttackTrait: null,
            contractGaps: preview.contractGaps.filter(
                (gap): gap is BetrayalMonsterActionSlotContractGap => gap === 'ui-token-flip',
            ),
        });
    }

    for (const group of movementGroups) {
        const preview = resolveBetrayalMonsterMovementRollGroupPreview(core, group.groupId);
        slots.push({
            id: `movement-roll:${group.groupId}`,
            kind: 'movement-roll',
            label: `${group.monsterName}移动骰`,
            command: BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            monsterId: null,
            groupId: group.groupId,
            enabled: preview.canRoll,
            reason: preview.reason,
            targetRoomIds: [],
            moveRemaining: null,
            moveCost: null,
            defaultAttackTrait: null,
            contractGaps: preview.contractGaps.filter(
                (gap): gap is BetrayalMonsterActionSlotContractGap => gap === 'path-preview-ui',
            ),
        });
    }

    for (const actionSet of actionSets) {
        const targetRoomIds = [...actionSet.moveTargetRoomIds];
        const moveCost = actionSet.status === 'active'
            ? resolveBetrayalMonsterMoveCost(core, actionSet.monsterId)
            : 0;
        const moveRemaining = core.scenarioRuntime.monsterTurn.moveRemainingById[actionSet.monsterId] ?? 0;
        const canMummyTeleportNow = hasMummyTeleportMoveAvailable(core, actionSet.monsterId);
        const hasMoveAllowance = (moveRemaining >= moveCost && moveCost > 0) || canMummyTeleportNow;
        const canMoveNow = actionSet.canMove && targetRoomIds.length > 0 && hasMoveAllowance;
        const monster = core.monsters.find((candidate) => candidate.id === actionSet.monsterId);
        const mustAttackBeforeMoving = Boolean(monster && isMummyMonster(core, monster) && mustMummyAttackBeforeMoving(
            core,
            monster,
        ));
        const moveReason = actionSet.reason
            ?? (mustAttackBeforeMoving
                ? '木乃伊与英雄同房且尚未攻击，必须先攻击。'
                : !actionSet.canMove
                    ? '该怪物当前不能移动。'
                    : targetRoomIds.length === 0
                        ? '该怪物没有已发现的移动目标。'
                        : !hasMoveAllowance
                            ? '请先为该怪物所属类型掷移动骰，或移动点不足以离开当前房间。'
                            : null);
        slots.push({
            id: `move:${actionSet.monsterId}`,
            kind: 'move',
            label: `${actionSet.name}移动`,
            command: BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            monsterId: actionSet.monsterId,
            groupId: null,
            enabled: canMoveNow,
            reason: canMoveNow ? null : moveReason,
            targetRoomIds,
            moveRemaining,
            moveCost,
            defaultAttackTrait: null,
            contractGaps: ['path-preview-ui'],
        });

        const attackCommand = resolveMonsterAttackCommand(core, actionSet.monsterId);
        const attackContractGaps: BetrayalMonsterActionSlotContractGap[] = attackCommand === BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO
            || attackCommand === BETRAYAL_COMMANDS.HAUNT_ATTACK
            || attackCommand === BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK
            || attackCommand === BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK
            ? ['attack-target-ui']
            : ['attack-target-ui', 'scenario-specific-attack'];
        slots.push({
            id: `attack:${actionSet.monsterId}`,
            kind: 'attack',
            label: `${actionSet.name}攻击`,
            command: attackCommand,
            monsterId: actionSet.monsterId,
            groupId: null,
            enabled: actionSet.canAttack,
            reason: actionSet.canAttack ? null : actionSet.reason ?? '该怪物当前不能攻击。',
            targetRoomIds: [],
            moveRemaining: null,
            moveCost: null,
            defaultAttackTrait: actionSet.defaultAttackTrait,
            contractGaps: attackContractGaps,
        });
    }

    const bloodFromStoneMonsterTurnEnd = resolveBloodFromStoneMonsterTurnEndPreview(core);
    if (bloodFromStoneMonsterTurnEnd.active) {
        slots.push({
            id: 'end-turn:blood-from-stone',
            kind: 'end-turn',
            label: '结束石像小天使怪物回合',
            command: BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
            monsterId: null,
            groupId: null,
            enabled: bloodFromStoneMonsterTurnEnd.canEnd,
            reason: bloodFromStoneMonsterTurnEnd.reason,
            targetRoomIds: [],
            moveRemaining: null,
            moveCost: null,
            defaultAttackTrait: null,
            contractGaps: [],
        });
    }

    return {
        active: slots.length > 0,
        monsterIds: monsterStatuses.map((status) => status.monsterId),
        movementGroupIds: movementGroups.map((group) => group.groupId),
        slots,
        contractGaps: Array.from(new Set(slots.flatMap((slot) => slot.contractGaps))),
        reason: slots.length > 0 ? null : '当前没有可显示的怪物动作槽。',
    };
}

export function resolveMagicCameraPhantomAttackTargets(
    core: BetrayalCore,
    monster: BetrayalMonsterSummary,
): BetrayalExplorerSummary[] {
    const room = core.rooms.find((item) => item.id === monster.roomId);
    if (!room) {
        return [];
    }
    return getAllExplorers(core).filter((explorer) => {
        if (
            explorer.playerId === core.scenarioRuntime.traitorPlayerId
            || core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        ) {
            return false;
        }
        const explorerRoom = resolveExplorerRoom(core, explorer);
        return Boolean(explorerRoom && isStraightLineVisible(room, explorerRoom, core.rooms));
    });
}

export function resolveBetrayalNormalMonsterAttackTargets(
    core: BetrayalCore,
    monsterId: string,
): BetrayalNormalMonsterAttackTargetReadModel | null {
    const monster = core.monsters.find((item) => item.id === monsterId);
    const actionSet = resolveBetrayalMonsterActionSet(core, monsterId);
    if (!monster || !actionSet) {
        return null;
    }
    if (!actionSet.canAttack || !monster.roomId) {
        return {
            monsterId,
            monsterName: actionSet.name,
            roomId: monster.roomId,
            defaultAttackTrait: actionSet.defaultAttackTrait,
            targetPlayerIds: [],
            targetLabels: [],
            usesNormalAttackRules: true,
            canResolveWithExistingCommand: false,
            reason: actionSet.reason ?? '该怪物当前不能攻击。',
            contractGaps: ['attack-target-ui'],
        };
    }
    const targetExplorers = getAllExplorers(core).filter((explorer) => (
        resolveControlledRoomId(core, explorer) === monster.roomId
        && isExplorerTargetableByMonsters(core, explorer)
        && resolveBetrayalExplorerSide(core, explorer.playerId) === 'hero'
    ));
    const attackCommand = resolveMonsterAttackCommand(core, monsterId);
    const canResolveWithExistingCommand = attackCommand === BETRAYAL_COMMANDS.HAUNT_ATTACK
        || attackCommand === BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO;
    return {
        monsterId,
        monsterName: actionSet.name,
        roomId: monster.roomId,
        defaultAttackTrait: actionSet.defaultAttackTrait,
        targetPlayerIds: targetExplorers.map((explorer) => explorer.playerId),
        targetLabels: targetExplorers.map((explorer) => explorer.displayName),
        usesNormalAttackRules: true,
        canResolveWithExistingCommand,
        reason: targetExplorers.length > 0
            ? null
            : '当前房间没有可攻击的存活英雄。',
        contractGaps: canResolveWithExistingCommand
            ? []
            : ['scenario-specific-attack'],
    };
}
