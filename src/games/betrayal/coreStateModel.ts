import type {
    BetrayalActivityEntry,
    BetrayalCore,
    BetrayalExplorerSummary,
    BetrayalMonsterSummary,
    BetrayalPendingCardResolutionState,
    BetrayalScenarioRuntimeStatus,
} from './game';
import { cloneExplorerSummary } from './explorerReadModel';
import {
    cloneDustRuntimeState,
    cloneHelpingHandsRuntimeState,
    cloneMagicCameraRuntimeState,
    cloneMummyRuntimeState,
    cloneUponReflectionRuntimeState,
} from './hauntRuntimeSetupModel';
import {
    cloneHauntFirstPlayerResolution,
    cloneHauntTraitorResolution,
} from './hauntTraitorResolutionModel';
import {
    cloneBloodFromStoneMonsterTurnRuntimeState,
    cloneMonsterTurnRuntimeState,
} from './monsterActionReadModel';
import { resolveControlledRoomId } from './hauntScenarioReadModel';
import { cloneInventoryCard } from './possessionDeckModel';
import { normalizeExplorerTraitTracks } from './traitTrackModel';

export function cloneMonster(monster: BetrayalMonsterSummary): BetrayalMonsterSummary {
    return { ...monster };
}

export function clonePendingCardResolution(
    resolution: BetrayalPendingCardResolutionState,
): BetrayalPendingCardResolutionState {
    return {
        ...resolution,
        requiredPlayerIds: resolution.requiredPlayerIds
            ? [...resolution.requiredPlayerIds]
            : undefined,
        acknowledgedPlayerIds: resolution.acknowledgedPlayerIds
            ? [...resolution.acknowledgedPlayerIds]
            : undefined,
        processCards: resolution.processCards
            ? resolution.processCards.map((card) => ({ ...card }))
            : undefined,
    };
}

export function syncCurrentExplorerProjection(core: BetrayalCore): BetrayalCore {
    normalizeExplorerTraitTracks(core.currentExplorer);
    core.otherExplorers.forEach(normalizeExplorerTraitTracks);
    return {
        ...core,
        currentPlayer: core.currentExplorer.playerId,
        activeRoomId: resolveControlledRoomId(core, core.currentExplorer),
        currentExplorerTraits: { ...core.currentExplorer.traits },
        currentExplorerInventory: core.currentExplorer.inventory.map(cloneInventoryCard),
    };
}

export function replaceExplorers(
    core: BetrayalCore,
    explorers: BetrayalExplorerSummary[],
    nextCurrentPlayerId = core.currentPlayer,
): BetrayalCore {
    const nextCurrent = explorers.find((explorer) => explorer.playerId === nextCurrentPlayerId) ?? explorers[0] ?? core.currentExplorer;
    const nextOthers = explorers.filter((explorer) => explorer.playerId !== nextCurrent.playerId);
    return syncCurrentExplorerProjection({
        ...core,
        currentExplorer: cloneExplorerSummary(nextCurrent),
        otherExplorers: nextOthers.map(cloneExplorerSummary),
    });
}

export function cloneScenarioRuntimeStatus(status: BetrayalScenarioRuntimeStatus): BetrayalScenarioRuntimeStatus {
    return {
        ...status,
        hauntTraitorResolution: cloneHauntTraitorResolution(status.hauntTraitorResolution),
        hauntFirstPlayerResolution: cloneHauntFirstPlayerResolution(status.hauntFirstPlayerResolution),
        exorcismCircleRoomIds: [...status.exorcismCircleRoomIds],
        knowledgeOfJackPlayerIds: [...status.knowledgeOfJackPlayerIds],
        deadExplorerPlayerIds: [...status.deadExplorerPlayerIds],
        corpseLootedByPlayerIdsThisTurn: [...status.corpseLootedByPlayerIdsThisTurn],
        usedRoomEffectIdsThisTurn: [...status.usedRoomEffectIdsThisTurn],
        hauntSetupQueue: (status.hauntSetupQueue ?? []).map((entry) => ({ ...entry })),
        monsterStatusesById: { ...(status.monsterStatusesById ?? {}) },
        monsterTurn: cloneMonsterTurnRuntimeState(status.monsterTurn),
        bloodFromStone: cloneBloodFromStoneMonsterTurnRuntimeState(status.bloodFromStone),
        bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId: Object.fromEntries(
            Object.entries(status.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId ?? {}).map(([playerId, ids]) => [
                playerId,
                [...ids],
            ]),
        ),
        bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn: [
            ...(status.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn ?? []),
        ],
        dust: status.dust ? cloneDustRuntimeState(status.dust) : undefined,
        helpingHands: status.helpingHands ? cloneHelpingHandsRuntimeState(status.helpingHands) : undefined,
        magicCamera: status.magicCamera ? cloneMagicCameraRuntimeState(status.magicCamera) : undefined,
        mummy: status.mummy ? cloneMummyRuntimeState(status.mummy) : undefined,
        uponReflection: status.uponReflection ? cloneUponReflectionRuntimeState(status.uponReflection) : undefined,
    };
}

export function appendActivity(
    core: BetrayalCore,
    text: string,
    tone: BetrayalActivityEntry['tone'],
): BetrayalActivityEntry[] {
    return [
        { id: `${core.exploreIndex}-${core.activityLog.length}-${text}`, text, tone },
        ...core.activityLog,
    ].slice(0, 6);
}
