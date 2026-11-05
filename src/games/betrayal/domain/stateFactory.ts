import type { BetrayalExplorerTemplate, BetrayalDeckKind, BetrayalInventoryCard, BetrayalMonsterSummary, BetrayalExplorerSummary, BetrayalCore, BetrayalScenarioRuntimeStatus, BetrayalRoomNode, BetrayalPhase } from './types';
import {
    BETRAYAL_EXPLORER_CATALOG,
    BETRAYAL_DISCOVERY_POOLS,
    type BetrayalMonsterSeed,
    type BetrayalInventorySeed,
    type BetrayalRoomSeed,
    type BetrayalScenarioId,
    BETRAYAL_SCENARIO_CONFIGS,
    DEFAULT_BETRAYAL_SCENARIO_ID,
    BETRAYAL_SHARED_PRE_HAUNT_SETUP,
    BETRAYAL_SCENARIO_CARD_IDS,
    DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
} from '../scenarioConfig';
import type { RandomFn } from '../../../engine/types';
import {
    ROOM_DISCOVERY_DECK_POOL,
    cloneRoomDiscoveryDeckEntry,
    groupRoomDiscoveryDeckByFloor,
    makeRoomDiscoveryDeckFromFloorPools,
    cloneRoomTemplate,
    cloneBuriedRoomTileSummary,
    cloneRoomDrawResolution,
} from '../roomDiscoveryModel';
import { DRAW_POOL, cloneInventoryCard, clonePossessionOrderByKind } from '../possessionDeckModel';
import { EVENT_POOL, cloneEventTemplate } from '../eventDeckModel';
import { buildTraitTracksFromTemplate, normalizeExplorerTraitTracks, cloneTraitTracks } from '../traitTrackModel';
import { cloneExplorerSummary, resolveTurnStartSpeed } from '../explorerReadModel';
import {
    cloneMonster,
    cloneScenarioRuntimeStatus,
    clonePendingCardResolution,
    syncCurrentExplorerProjection,
    replaceExplorers,
} from '../coreStateModel';
import { cloneBetrayalRoom, refreshExplorableRoomSlots } from '../roomMapModel';
import { cloneRolledDamageResult, cloneSourceEventRoll } from '../eventEffectResolutionModel';
import {
    clonePendingEventChoice,
    clonePendingEventRollResolution,
    cloneDiscoverySummary,
} from '../cardResolutionStateModel';
import { clonePendingDamageAllocation } from '../damageResolutionModel';
import { createInitialMonsterTurnRuntimeState } from '../monsterActionReadModel';
import { BETRAYAL_INITIAL_DECK_COUNTS } from '../deckModel';
import { readBetrayalScenarioId } from '../roomSetup';
import { resolveTurnStartInventoryCardIds } from '../possessionActionReadModel';

export const EXPLORER_CATALOG: BetrayalExplorerTemplate[] = BETRAYAL_EXPLORER_CATALOG.map((entry) => ({ ...entry }));

export const DRAW_ORDER: BetrayalDeckKind[] = [...BETRAYAL_DISCOVERY_POOLS.drawOrder];

export function createShuffledDiscoveryState(random: RandomFn) {
    const roomDiscoveryDeck = random.shuffle(ROOM_DISCOVERY_DECK_POOL.map(cloneRoomDiscoveryDeckEntry));
    return {
        drawOrder: random.shuffle([...DRAW_ORDER]),
        roomDiscoveryDeck,
        roomDiscoveryOrderByFloor: groupRoomDiscoveryDeckByFloor(roomDiscoveryDeck),
        possessionOrderByKind: {
            item: random.shuffle(DRAW_POOL.item.map(cloneInventoryCard)),
            omen: random.shuffle(DRAW_POOL.omen.map(cloneInventoryCard)),
        } satisfies Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]>,
        eventOrder: random.shuffle(EVENT_POOL.map(cloneEventTemplate)),
    };
}

export const DEFAULT_BETRAYAL_RANDOM: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.max(1, Math.min(max, 1)),
    range: (min) => min,
    shuffle: (array) => [...array],
};

export function cloneMonsterSeed(monster: BetrayalMonsterSeed): BetrayalMonsterSummary {
    return { ...monster };
}

export function cloneInventorySeed(card: BetrayalInventorySeed): BetrayalInventoryCard {
    return { ...card };
}

export function createExplorer(
    playerId: string,
    template: BetrayalExplorerTemplate,
    roomId: string,
    inventory: BetrayalInventorySeed[],
): BetrayalExplorerSummary {
    const explorer: BetrayalExplorerSummary = {
        playerId,
        explorerId: template.explorerId,
        displayName: template.displayName,
        portraitAsset: template.portraitAsset,
        tokenAsset: template.tokenAsset,
        roomId,
        traits: { ...template.traits },
        traitTracks: buildTraitTracksFromTemplate(template),
        inventory: inventory.map(cloneInventorySeed),
    };
    normalizeExplorerTraitTracks(explorer);
    return explorer;
}

export function cloneCore(core: BetrayalCore): BetrayalCore {
    return {
        ...core,
        playerIds: [...core.playerIds],
        seatControllers: core.seatControllers
            ? Object.fromEntries(
                  Object.entries(core.seatControllers).map(([playerId, controller]) => [playerId, { ...controller }]),
              )
            : undefined,
        scenarioCandidateIds: [...core.scenarioCandidateIds],
        scenarioCardConfirmations: { ...core.scenarioCardConfirmations },
        selectedExplorerByPlayerId: { ...core.selectedExplorerByPlayerId },
        readyPlayerIds: [...core.readyPlayerIds],
        turnStartSpeed: core.turnStartSpeed ?? core.currentExplorer.traits.speed ?? core.movesRemaining,
        currentExplorer: cloneExplorerSummary(core.currentExplorer),
        currentExplorerTraits: { ...core.currentExplorerTraits },
        currentExplorerInventory: core.currentExplorerInventory.map(cloneInventoryCard),
        otherExplorers: core.otherExplorers.map(cloneExplorerSummary),
        monsters: core.monsters.map(cloneMonster),
        drawOrder: [...core.drawOrder],
        roomDiscoveryDeck: (
            core.roomDiscoveryDeck ?? makeRoomDiscoveryDeckFromFloorPools(core.roomDiscoveryOrderByFloor)
        ).map(cloneRoomDiscoveryDeckEntry),
        roomDiscoveryOrderByFloor: {
            ground: core.roomDiscoveryOrderByFloor.ground.map(cloneRoomTemplate),
            upper: core.roomDiscoveryOrderByFloor.upper.map(cloneRoomTemplate),
            basement: core.roomDiscoveryOrderByFloor.basement.map(cloneRoomTemplate),
        },
        buriedRoomTiles: (core.buriedRoomTiles ?? []).map(cloneBuriedRoomTileSummary),
        possessionOrderByKind: {
            item: core.possessionOrderByKind.item.map(cloneInventoryCard),
            omen: core.possessionOrderByKind.omen.map(cloneInventoryCard),
        },
        eventOrder: core.eventOrder.map(cloneEventTemplate),
        deckCounts: { ...core.deckCounts },
        discardCounts: { ...core.discardCounts },
        rooms: core.rooms.map(cloneBetrayalRoom),
        usedCardIdsThisTurn: [...core.usedCardIdsThisTurn],
        tradeUsedThisTurnPlayerIds: [...core.tradeUsedThisTurnPlayerIds],
        turnStartInventoryCardIds: [...core.turnStartInventoryCardIds],
        receivedCardIdsThisTurnByPlayerId: Object.fromEntries(
            Object.entries(core.receivedCardIdsThisTurnByPlayerId).map(([playerId, cardIds]) => [
                playerId,
                [...cardIds],
            ]),
        ),
        nextNonCombatTraitReplacement: core.nextNonCombatTraitReplacement
            ? { ...core.nextNonCombatTraitReplacement }
            : null,
        nextNonCombatTraitRollTotalReplacement: core.nextNonCombatTraitRollTotalReplacement
            ? { ...core.nextNonCombatTraitRollTotalReplacement }
            : null,
        pendingExtraTurnAfterCurrentTurn: core.pendingExtraTurnAfterCurrentTurn
            ? { ...core.pendingExtraTurnAfterCurrentTurn }
            : null,
        recentRoll: core.recentRoll
            ? {
                  ...core.recentRoll,
                  dice: [...core.recentRoll.dice],
                  requiredPlayerIds: core.recentRoll.requiredPlayerIds
                      ? [...core.recentRoll.requiredPlayerIds]
                      : undefined,
                  acknowledgedPlayerIds: core.recentRoll.acknowledgedPlayerIds
                      ? [...core.recentRoll.acknowledgedPlayerIds]
                      : undefined,
                  branchThresholds: core.recentRoll.branchThresholds?.map((branch) => ({
                      ...branch,
                      effect: { ...branch.effect },
                  })),
                  eventRolledDamageResults: core.recentRoll.eventRolledDamageResults?.map(cloneRolledDamageResult),
                  sourceEventRoll: core.recentRoll.sourceEventRoll
                      ? cloneSourceEventRoll(core.recentRoll.sourceEventRoll)
                      : undefined,
                  eventEffectSnapshot: core.recentRoll.eventEffectSnapshot
                      ? {
                            ...core.recentRoll.eventEffectSnapshot,
                            traitsBeforeEffect: { ...core.recentRoll.eventEffectSnapshot.traitsBeforeEffect },
                            traitTracksBeforeEffect: cloneTraitTracks(
                                core.recentRoll.eventEffectSnapshot.traitTracksBeforeEffect,
                            ),
                            possessionOrderByKindBeforeEffect: clonePossessionOrderByKind(
                                core.recentRoll.eventEffectSnapshot.possessionOrderByKindBeforeEffect,
                            ),
                            deckCountsBeforeEffect: { ...core.recentRoll.eventEffectSnapshot.deckCountsBeforeEffect },
                            damageRolls: [...core.recentRoll.eventEffectSnapshot.damageRolls],
                            rolledDamageResults: (core.recentRoll.eventEffectSnapshot.rolledDamageResults ?? []).map(
                                cloneRolledDamageResult,
                            ),
                            drawnCards: core.recentRoll.eventEffectSnapshot.drawnCards.map(cloneInventoryCard),
                        }
                      : undefined,
                  roomsBeforeRoll: core.recentRoll.roomsBeforeRoll?.map(cloneBetrayalRoom),
                  roomEndTurn: core.recentRoll.roomEndTurn
                      ? {
                            ...core.recentRoll.roomEndTurn,
                            traitsBeforeEffect: { ...core.recentRoll.roomEndTurn.traitsBeforeEffect },
                        }
                      : undefined,
                  attack: core.recentRoll.attack
                      ? {
                            ...core.recentRoll.attack,
                            attackerTraitsBeforeDamage: { ...core.recentRoll.attack.attackerTraitsBeforeDamage },
                            defenderTraitsBeforeDamage: core.recentRoll.attack.defenderTraitsBeforeDamage
                                ? { ...core.recentRoll.attack.defenderTraitsBeforeDamage }
                                : undefined,
                        }
                      : undefined,
                  deathPrevention: core.recentRoll.deathPrevention
                      ? {
                            ...core.recentRoll.deathPrevention,
                            damageTraits: core.recentRoll.deathPrevention.damageTraits
                                ? [...core.recentRoll.deathPrevention.damageTraits]
                                : undefined,
                            traitsBeforeDamage: { ...core.recentRoll.deathPrevention.traitsBeforeDamage },
                            scenarioRuntimeBeforeDefeat: cloneScenarioRuntimeStatus(
                                core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat,
                            ),
                            monstersBeforeDefeat:
                                core.recentRoll.deathPrevention.monstersBeforeDefeat.map(cloneMonster),
                        }
                      : undefined,
                  consumedRabbitFootCardIds: [...core.recentRoll.consumedRabbitFootCardIds],
                  lastRabbitFootRerollDieIndex: core.recentRoll.lastRabbitFootRerollDieIndex,
                  lastRabbitFootRerollPreviousDice: core.recentRoll.lastRabbitFootRerollPreviousDice
                      ? [...core.recentRoll.lastRabbitFootRerollPreviousDice]
                      : undefined,
              }
            : null,
        pendingEventChoice: core.pendingEventChoice ? clonePendingEventChoice(core.pendingEventChoice) : null,
        pendingEventRollStart: core.pendingEventRollStart ? { ...core.pendingEventRollStart } : null,
        pendingCardResolutionQueue: (core.pendingCardResolutionQueue ?? []).map(clonePendingCardResolution),
        pendingTradeAgreement: core.pendingTradeAgreement
            ? {
                  ...core.pendingTradeAgreement,
                  cardIds: [...core.pendingTradeAgreement.cardIds],
                  targetCardIds: [...core.pendingTradeAgreement.targetCardIds],
              }
            : null,
        pendingDamageAllocation: core.pendingDamageAllocation
            ? clonePendingDamageAllocation(core.pendingDamageAllocation)
            : null,
        pendingEventRollResolution: core.pendingEventRollResolution
            ? clonePendingEventRollResolution(core.pendingEventRollResolution)
            : null,
        recentAllTraitCheck: core.recentAllTraitCheck
            ? {
                  ...core.recentAllTraitCheck,
                  results: core.recentAllTraitCheck.results.map((result) => ({
                      ...result,
                      dice: [...result.dice],
                  })),
              }
            : null,
        latestRoomDrawResolution: core.latestRoomDrawResolution
            ? cloneRoomDrawResolution(core.latestRoomDrawResolution)
            : null,
        latestDiscovery: core.latestDiscovery ? cloneDiscoverySummary(core.latestDiscovery) : null,
        activityLog: core.activityLog.map((entry) => ({ ...entry })),
        turnEndedByDiscovery: core.turnEndedByDiscovery,
        scenarioRuntime: cloneScenarioRuntimeStatus(core.scenarioRuntime),
        endgameResult: core.endgameResult
            ? {
                  ...core.endgameResult,
                  winners: [...core.endgameResult.winners],
                  survivorsEscaped: [...core.endgameResult.survivorsEscaped],
                  reward: { ...core.endgameResult.reward },
                  stats: { ...core.endgameResult.stats },
              }
            : null,
    };
}

export function createInitialScenarioRuntimeStatus(): BetrayalScenarioRuntimeStatus {
    return {
        hauntTriggered: false,
        hauntRevealerPlayerId: null,
        traitorPlayerId: null,
        hauntTraitorResolution: null,
        hauntFirstPlayerResolution: null,
        nextHauntPlayerId: null,
        hauntRollThreshold: 5,
        omensDiscovered: 0,
        hauntCardNumber: null,
        hauntTriggerLabel: null,
        hauntScenarioCardId: null,
        hauntScenarioCardTitle: null,
        hauntScenarioCardLabel: null,
        triggeringOmenId: null,
        triggeringOmenName: null,
        hauntResolutionMatchedTrigger: false,
        hauntResolutionRepresentativeOnly: false,
        jackSpiritReleased: false,
        jackSpiritRoomId: null,
        jackSpiritHasMovedSinceRelease: false,
        exorcismCircleRoomIds: [],
        knowledgeOfJackPlayerIds: [],
        deadExplorerPlayerIds: [],
        traitorCorpseRoomId: null,
        corpseLootedByPlayerIdsThisTurn: [],
        usedRoomEffectIdsThisTurn: [],
        hauntSetupQueue: [],
        monsterStatusesById: {},
        monsterTurn: createInitialMonsterTurnRuntimeState(),
        bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId: {},
        bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn: [],
    };
}

export function normalizePlayerIds(playerIds: string[]): string[] {
    return playerIds.length >= 3 ? playerIds.map(String) : ['0', '1', '2', '3'];
}

export function roomSeedToNode(room: BetrayalRoomSeed): BetrayalRoomNode {
    return {
        ...room,
        connectedRoomIds: [...room.connectedRoomIds],
        orientationTurns: room.orientationTurns ?? 0,
        tags: [...room.tags],
        doorways: room.doorways.map((doorway) => ({ ...doorway })),
    };
}

export function scenarioConfigById(scenarioId: BetrayalScenarioId) {
    return BETRAYAL_SCENARIO_CONFIGS[scenarioId];
}

export function scenarioInventoryForExplorer(
    scenarioId: BetrayalScenarioId,
    explorerId: string,
): BetrayalInventorySeed[] {
    return scenarioConfigById(scenarioId).startingInventoryByExplorerId[explorerId]?.map(cloneInventorySeed) ?? [];
}

export function getBetrayalScenarioConfig(scenarioId: BetrayalScenarioId) {
    return scenarioConfigById(scenarioId);
}

export function buildRepresentativeRuntimeExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    const representativeRoomIds = [
        'grand-staircase',
        'upper-landing',
        'basement-landing',
        'entrance-hall',
        'upper-landing',
        'entrance-hall',
    ];
    return core.playerIds.map((playerId, index) => {
        const template = EXPLORER_CATALOG[index % EXPLORER_CATALOG.length]!;
        return createExplorer(
            playerId,
            template,
            representativeRoomIds[index % representativeRoomIds.length]!,
            scenarioInventoryForExplorer(core.scenarioId, template.explorerId),
        );
    });
}

export function makeBaseCore(
    playerIds: string[],
    phase: BetrayalPhase,
    random: RandomFn,
    scenarioId: BetrayalScenarioId = DEFAULT_BETRAYAL_SCENARIO_ID,
): BetrayalCore {
    const normalizedPlayerIds = normalizePlayerIds(playerIds);
    const rooms = createInitialRoomLayout(BETRAYAL_SHARED_PRE_HAUNT_SETUP.startingRoomLayout);
    const discoveryState = createShuffledDiscoveryState(random);
    const currentExplorer = createExplorer(
        normalizedPlayerIds[0]!,
        EXPLORER_CATALOG[0]!,
        BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
        scenarioInventoryForExplorer(scenarioId, EXPLORER_CATALOG[0]!.explorerId),
    );
    const otherExplorers = normalizedPlayerIds
        .slice(1)
        .map((playerId, index) =>
            createExplorer(
                playerId,
                EXPLORER_CATALOG[(index + 1) % EXPLORER_CATALOG.length]!,
                BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
                scenarioInventoryForExplorer(
                    scenarioId,
                    EXPLORER_CATALOG[(index + 1) % EXPLORER_CATALOG.length]!.explorerId,
                ),
            ),
        );

    return syncCurrentExplorerProjection({
        scenarioId,
        scenarioCandidateIds: [...BETRAYAL_SCENARIO_CARD_IDS],
        proposedScenarioCardId: DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
        scenarioCardConfirmations: {},
        phase,
        playerIds: normalizedPlayerIds,
        selectedExplorerByPlayerId: {},
        readyPlayerIds: [],
        currentPlayer: currentExplorer.playerId,
        activePlayerId: null,
        turnStartSpeed: currentExplorer.traits.speed,
        movesRemaining: currentExplorer.traits.speed,
        recommendedAction: 'explore',
        activeRoomId: currentExplorer.roomId,
        turnEndedByDiscovery: false,
        currentExplorer,
        currentExplorerTraits: { ...currentExplorer.traits },
        currentExplorerInventory: currentExplorer.inventory.map(cloneInventoryCard),
        otherExplorers,
        monsters: [],
        drawOrder: discoveryState.drawOrder,
        roomDiscoveryDeck: discoveryState.roomDiscoveryDeck,
        roomDiscoveryOrderByFloor: discoveryState.roomDiscoveryOrderByFloor,
        buriedRoomTiles: [],
        possessionOrderByKind: discoveryState.possessionOrderByKind,
        eventOrder: discoveryState.eventOrder,
        deckCounts: { ...BETRAYAL_INITIAL_DECK_COUNTS },
        discardCounts: { omen: 0, item: 0, event: 0 },
        rooms,
        exploreIndex: 0,
        usedCardIdsThisTurn: [],
        tradeUsedThisTurnPlayerIds: [],
        turnStartInventoryCardIds: currentExplorer.inventory.map((card) => card.id),
        receivedCardIdsThisTurnByPlayerId: {},
        nextNonCombatTraitReplacement: null,
        nextNonCombatTraitRollTotalReplacement: null,
        pendingExtraTurnAfterCurrentTurn: null,
        pendingEventChoice: null,
        pendingEventRollStart: null,
        pendingCardResolutionQueue: [],
        pendingTradeAgreement: null,
        pendingDamageAllocation: null,
        pendingEventRollResolution: null,
        recentRoll: null,
        recentAllTraitCheck: null,
        latestRoomDrawResolution: null,
        latestDiscovery: null,
        latestDiscoveryOwnerPlayerId: null,
        highlightedDeckKind: null,
        activityLog: [],
        scenarioRuntime: createInitialScenarioRuntimeStatus(),
        endgameResult: null,
    });
}

export function createBetrayalCharacterSelectCore(
    playerIds: string[] = ['0', '1', '2', '3'],
    random: RandomFn = DEFAULT_BETRAYAL_RANDOM,
    setupData?: unknown,
): BetrayalCore {
    return makeBaseCore(playerIds, 'characterSelect', random, readBetrayalScenarioId(setupData));
}

export function createBetrayalFoundationCore(
    playerIds: string[] = ['0', '1', '2', '3'],
    random: RandomFn = DEFAULT_BETRAYAL_RANDOM,
): BetrayalCore {
    const core = makeBaseCore(playerIds, 'preHaunt', random);
    const nextCore = replaceExplorers(core, buildRepresentativeRuntimeExplorers(core), core.playerIds[0]);
    const turnStartSpeed = resolveTurnStartSpeed(nextCore);
    return {
        ...nextCore,
        turnStartSpeed,
        movesRemaining: turnStartSpeed,
        turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore),
    };
}

export const MONSTER_ENCOUNTER_PREVIEW_MONSTERS: BetrayalMonsterSeed[] = [
    {
        id: 'werewolf',
        name: '狼人',
        portraitAsset: 'betrayal/monsters/werewolf',
        tokenAsset: 'betrayal/tokens/monsters/werewolf',
        roomId: 'grand-staircase',
        might: 5,
        speed: 4,
        damage: 2,
    },
    {
        id: 'spirit',
        name: '幽灵',
        portraitAsset: 'betrayal/monsters/spirit',
        tokenAsset: 'betrayal/tokens/monsters/ghost',
        roomId: 'upper-landing',
        might: 4,
        speed: 5,
        damage: 1,
    },
];

export function createBetrayalMonsterEncounterCore(
    playerIds: string[] = ['0', '1', '2', '3'],
    random: RandomFn = DEFAULT_BETRAYAL_RANDOM,
): BetrayalCore {
    const core = createBetrayalFoundationCore(playerIds, random);
    return {
        ...core,
        monsters: MONSTER_ENCOUNTER_PREVIEW_MONSTERS.map(cloneMonsterSeed),
    };
}

export function templateByExplorerId(explorerId: string): BetrayalExplorerTemplate | undefined {
    return EXPLORER_CATALOG.find((template) => template.explorerId === explorerId);
}

export function buildScenarioExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.playerIds.map((playerId, index) => {
        const selectedExplorerId = core.selectedExplorerByPlayerId[playerId];
        const template =
            templateByExplorerId(selectedExplorerId ?? '') ?? EXPLORER_CATALOG[index % EXPLORER_CATALOG.length]!;
        return createExplorer(
            playerId,
            template,
            BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
            scenarioInventoryForExplorer(core.scenarioId, template.explorerId),
        );
    });
}

export function createInitialRoomLayout(seeds: BetrayalRoomSeed[]): BetrayalRoomNode[] {
    const discoveredSeedIds = new Set(seeds.filter((room) => room.state === 'discovered').map((room) => room.id));
    const discoveredRooms = seeds
        .filter((room) => room.state === 'discovered')
        .map((seed) => {
            const room = roomSeedToNode(seed);
            room.connectedRoomIds = room.connectedRoomIds.filter((roomId) => discoveredSeedIds.has(roomId));
            room.doorways = room.doorways.map((doorway) =>
                doorway.connectsToRoomId && !discoveredSeedIds.has(doorway.connectsToRoomId)
                    ? {
                          edge: doorway.edge,
                          leadsToFloor: doorway.leadsToFloor,
                          note: doorway.note,
                      }
                    : { ...doorway },
            );
            return room;
        });

    return refreshExplorableRoomSlots(discoveredRooms);
}
