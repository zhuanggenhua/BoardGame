import type { BetrayalCore } from './types';
import { type BetrayalEvent, EVENTS } from '../events';
import {
    cloneCore,
    scenarioConfigById,
    buildScenarioExplorers,
    createInitialScenarioRuntimeStatus,
    DEFAULT_BETRAYAL_RANDOM,
} from './stateFactory';
import { appendActivity, replaceExplorers, syncCurrentExplorerProjection } from '../coreStateModel';
import { resolveTurnStartSpeed, findExplorerByPlayerId } from '../explorerReadModel';
import { resolveTurnStartInventoryCardIds } from '../possessionActionReadModel';
import { applyBetrayalExplorerMovedState } from '../movementStateModel';
import { applyBetrayalRoomExploredState } from '../roomExploredStateModel';
import { nowEvent } from './execute';
import {
    applyBetrayalEventChoiceResolvedState,
    applyBetrayalEventRolledState,
    applyBetrayalEventRollFinalizedState,
} from '../eventResolutionStateModel';
import { isPendingCardResolutionFullyAcknowledged } from '../acknowledgementReadModel';
import { resolveRecommendedAction } from '../recommendedActionReadModel';
import { applyBetrayalRecentRollRerollState } from '../recentRollRerollStateModel';
import { applyBetrayalEventRollReplacementState } from '../eventRollReplacementModel';
import { applyBetrayalPossessionUsedState } from '../possessionUseState';
import { applyBetrayalRoomEffectUsedState } from '../roomEnterEffectModel';
import {
    applyBetrayalTradeAcceptedState,
    createBetrayalPendingTradeAgreement,
    clearBetrayalPendingTradeAgreement,
} from '../trade';
import { applyBetrayalCorpseLootedState } from '../deathStateReadModel';
import { reduceScenarioCompletionStateResolution, completeMummyTraitorVictoryIfNeeded } from './scenarioResolution';
import {
    applyBetrayalDustSearchResolvedState,
    applyBetrayalDustCureResolvedState,
    applyBetrayalSicknessExchangeRequestedState,
    applyBetrayalSicknessExchangeResolvedState,
} from '../dustHauntStateModel';
import { resolveHauntSetupQueueWithEntryStatus } from '../hauntSetupModel';
import {
    applyBetrayalPhotoTakenState,
    applyBetrayalMagicCameraSmashedState,
    applyBetrayalPhantomPhotographerAttackResolvedState,
} from '../magicCameraHauntStateModel';
import {
    applyBetrayalBloodFromStonePeekabooResolvedState,
    applyBetrayalBloodFromStoneExtraStoneCherubsPlacedState,
} from '../bloodFromStoneHauntStateModel';
import { cloneTurnEndedPayload } from '../cardResolutionStateModel';
import { moveExplorerTraitSteps } from '../traitTrackModel';
import { applyBetrayalTurnEndedState, applyBetrayalTurnEndRollAcknowledgedState } from '../turnEndStateModel';
import { applyBetrayalDamageAllocationAftermathState } from '../damageAftermathStateModel';
import { applyBetrayalHauntTriggeredState } from '../hauntTriggeredStateModel';
import {
    applyBetrayalMonsterDamageResolvedState,
    applyBetrayalMonsterTurnStartResolvedState,
    applyBetrayalMonsterMovementGroupRolledState,
    applyBetrayalMonsterMovedState,
    applyBetrayalMonsterAttackHeroResolvedState,
    applyBloodFromStoneMonsterTurnEndedState,
    applyBetrayalHelpingHandsMonsterTurnStartedState,
    applyBetrayalHelpingHandsTrollHandMovedState,
    applyBetrayalHelpingHandsMonsterTurnEndedState,
} from '../monsterActionStateModel';
import {
    applyBetrayalDynamiteAttackResolvedState,
    applyBetrayalHauntAttackResolvedState,
    applyBetrayalHelpingHandsAttackRewardResolvedState,
    applyBetrayalMummyAttackRewardResolvedState,
    applyBetrayalHelpingHandsTrollHandAttackResolvedState,
} from '../attackStateModel';
import {
    applyBetrayalJackLearnedState,
    applyBetrayalExorcismStudiedState,
    applyBetrayalJackExorcisedState,
} from '../crimsonJackHauntStateModel';
import {
    applyBetrayalMummyNameStudiedState,
    applyBetrayalMummyBanishmentLearnedState,
    applyBetrayalMummyBanishedState,
    applyBetrayalMummyGirlPickedUpState,
    applyBetrayalMummyGirlGivenState,
    applyBetrayalMummyOmenGivenState,
} from '../mummyHauntStateModel';
import {
    applyBetrayalUponReflectionEventHintGivenState,
    applyBetrayalUponReflectionCurseBreakAttemptedState,
} from '../uponReflectionHauntStateModel';
import { applyBetrayalScenarioCompletedState } from '../scenarioCompletionStateModel';

export function reduceEvent(state: BetrayalCore, event: BetrayalEvent): BetrayalCore {
    const core = cloneCore(state);
    switch (event.type) {
        case EVENTS.EXPLORER_SELECTED: {
            const scenarioCardConfirmations = { ...core.scenarioCardConfirmations };
            delete scenarioCardConfirmations[event.payload.playerId];
            return {
                ...core,
                selectedExplorerByPlayerId: {
                    ...core.selectedExplorerByPlayerId,
                    [event.payload.playerId]: event.payload.explorerId,
                },
                readyPlayerIds: core.readyPlayerIds.filter((playerId) => playerId !== event.payload.playerId),
                scenarioCardConfirmations,
            };
        }
        case EVENTS.EXPLORER_CONFIRMED:
            return core.readyPlayerIds.includes(event.payload.playerId)
                ? core
                : { ...core, readyPlayerIds: [...core.readyPlayerIds, event.payload.playerId] };
        case EVENTS.SCENARIO_CARD_PROPOSED:
            return {
                ...core,
                proposedScenarioCardId: event.payload.candidateId,
                scenarioCardConfirmations: {},
                activityLog: appendActivity(core, event.payload.logText, 'neutral'),
            };
        case EVENTS.SCENARIO_CARD_CONFIRMED:
            return {
                ...core,
                scenarioCardConfirmations: {
                    ...core.scenarioCardConfirmations,
                    [event.payload.playerId]: event.payload.candidateId,
                },
            };
        case EVENTS.SCENARIO_STARTED: {
            core.scenarioId = event.payload.scenarioId;
            const scenario = scenarioConfigById(event.payload.scenarioId);
            const explorers = buildScenarioExplorers(core);
            const firstPlayerId = explorers[0]?.playerId ?? core.currentPlayer;
            core.scenarioRuntime = createInitialScenarioRuntimeStatus();
            const startedCore = replaceExplorers(
                {
                    ...core,
                    phase: 'preHaunt',
                    currentPlayer: firstPlayerId,
                    turnStartSpeed: 0,
                    movesRemaining: 0,
                    recommendedAction: 'explore',
                    activeRoomId: explorers[0]?.roomId ?? core.activeRoomId,
                    usedCardIdsThisTurn: [],
                    tradeUsedThisTurnPlayerIds: [],
                    receivedCardIdsThisTurnByPlayerId: {},
                    latestDiscovery: null,
                    latestDiscoveryOwnerPlayerId: null,
                    highlightedDeckKind: null,
                    pendingTradeAgreement: null,
                    activePlayerId: null,
                    activityLog: [
                        { id: `scenario-started-${scenario.id}`, text: scenario.logs.scenarioStarted, tone: 'accent' },
                    ],
                    endgameResult: null,
                },
                explorers,
                firstPlayerId,
            );
            const turnStartSpeed = resolveTurnStartSpeed(startedCore, firstPlayerId);
            return {
                ...startedCore,
                turnStartSpeed,
                movesRemaining: turnStartSpeed,
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(startedCore, firstPlayerId),
            };
        }
        case EVENTS.EXPLORER_MOVED: {
            return applyBetrayalExplorerMovedState(core, event);
        }
        case EVENTS.ROOM_EXPLORED: {
            const resolution = applyBetrayalRoomExploredState(core, event, DEFAULT_BETRAYAL_RANDOM);
            if (resolution.scenarioCompletedResult) {
                return reduceEvent(
                    resolution.core,
                    nowEvent(
                        EVENTS.SCENARIO_COMPLETED,
                        {
                            result: resolution.scenarioCompletedResult,
                        },
                        event.timestamp,
                    ),
                );
            }
            if (resolution.hauntTriggeredPayload) {
                return reduceEvent(
                    resolution.core,
                    nowEvent(EVENTS.HAUNT_TRIGGERED, resolution.hauntTriggeredPayload, event.timestamp),
                );
            }
            return resolution.core;
        }
        case EVENTS.EVENT_CHOICE_RESOLVED: {
            const resolution = applyBetrayalEventChoiceResolvedState(core, event);
            if (resolution.scenarioCompletedResult) {
                return reduceEvent(
                    resolution.core,
                    nowEvent(
                        EVENTS.SCENARIO_COMPLETED,
                        {
                            result: resolution.scenarioCompletedResult,
                        },
                        event.timestamp,
                    ),
                );
            }
            if (resolution.hauntTriggeredPayload) {
                return reduceEvent(
                    resolution.core,
                    nowEvent(EVENTS.HAUNT_TRIGGERED, resolution.hauntTriggeredPayload, event.timestamp),
                );
            }
            return resolution.core;
        }
        case EVENTS.CARD_RESOLUTION_ACKNOWLEDGED: {
            const acknowledgedPlayerIds =
                event.payload.acknowledgedPlayerIds ?? event.payload.resolution.acknowledgedPlayerIds ?? [];
            const acknowledgedResolution = {
                ...event.payload.resolution,
                acknowledgedPlayerIds: [...acknowledgedPlayerIds],
            };
            const isComplete = isPendingCardResolutionFullyAcknowledged(
                core,
                acknowledgedResolution,
                acknowledgedPlayerIds,
            );
            core.pendingCardResolutionQueue = (core.pendingCardResolutionQueue ?? []).flatMap((resolution) => {
                if (resolution.id !== event.payload.resolution.id) {
                    return [resolution];
                }
                return isComplete ? [] : [acknowledgedResolution];
            });
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: synced.activityLog,
            };
        }
        case EVENTS.RABBIT_FOOT_USED: {
            const resolution = applyBetrayalRecentRollRerollState(core, event);
            if (resolution.scenarioCompletedResult) {
                return reduceEvent(
                    resolution.core,
                    nowEvent(
                        EVENTS.SCENARIO_COMPLETED,
                        {
                            result: resolution.scenarioCompletedResult,
                        },
                        event.timestamp,
                    ),
                );
            }
            return resolution.core;
        }
        case EVENTS.EVENT_ROLLED: {
            return applyBetrayalEventRolledState(core, event).core;
        }
        case EVENTS.EVENT_ROLL_FINALIZED: {
            const resolution = applyBetrayalEventRollFinalizedState(core, event);
            if (resolution.hauntTriggeredPayload) {
                return reduceEvent(
                    resolution.core,
                    nowEvent(EVENTS.HAUNT_TRIGGERED, resolution.hauntTriggeredPayload, event.timestamp),
                );
            }
            return resolution.core;
        }
        case EVENTS.POSSESSION_USED: {
            if (event.payload.eventRollReplacement) {
                if (!applyBetrayalEventRollReplacementState(core, event.payload)) {
                    return core;
                }
                const synced = syncCurrentExplorerProjection(core);
                return {
                    ...synced,
                    recommendedAction: resolveRecommendedAction(synced),
                    activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                };
            }
            applyBetrayalPossessionUsedState(core, event.payload);
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.ROOM_EFFECT_USED: {
            if (!applyBetrayalRoomEffectUsedState(core, event.payload, event.timestamp)) {
                return core;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.POSSESSION_TRADED: {
            const tradeResult = applyBetrayalTradeAcceptedState(core, event.payload);
            if (!tradeResult) {
                return core;
            }
            const synced = syncCurrentExplorerProjection(core);
            const tradeUsedThisTurnPlayerIds = Array.from(
                new Set([...core.tradeUsedThisTurnPlayerIds, tradeResult.requesterPlayerId]),
            );
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                tradeUsedThisTurnPlayerIds,
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.POSSESSION_TRADE_REQUESTED: {
            core.pendingTradeAgreement = createBetrayalPendingTradeAgreement(event.payload, event.timestamp);
            core.activePlayerId = event.payload.targetPlayerId;
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.POSSESSION_TRADE_DECLINED: {
            clearBetrayalPendingTradeAgreement(core);
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.CORPSE_LOOTED: {
            if (!applyBetrayalCorpseLootedState(core, event.payload)) {
                return core;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.DUST_SEARCH_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalDustSearchResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.DUST_CURE_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalDustCureResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.SICKNESS_EXCHANGE_REQUESTED: {
            return applyBetrayalSicknessExchangeRequestedState(core, event);
        }
        case EVENTS.SICKNESS_EXCHANGE_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalSicknessExchangeResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.HAUNT_SETUP_ENTRY_CONFIRMED: {
            core.scenarioRuntime.hauntSetupQueue = resolveHauntSetupQueueWithEntryStatus(
                core,
                event.payload.entryId,
                'resolved',
            );
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.PHOTO_TAKEN: {
            return applyBetrayalPhotoTakenState(core, event);
        }
        case EVENTS.MAGIC_CAMERA_SMASHED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalMagicCameraSmashedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.PHANTOM_PHOTOGRAPHER_ATTACK_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalPhantomPhotographerAttackResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.BLOOD_FROM_STONE_PEEKABOO_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalBloodFromStonePeekabooResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.TOOTH_NECKLACE_CHOICE_STARTED: {
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                pendingEventChoice: {
                    id: `tooth-necklace-${event.payload.playerId}-${event.timestamp}`,
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.cardName,
                    acceptLabel: '获得属性',
                    declineLabel: '跳过',
                    sourceKind: 'item',
                    itemResolution: 'tooth-necklace-end-turn',
                    itemCardId: event.payload.cardId,
                    deferredTurnEnd: cloneTurnEndedPayload(event.payload.deferredTurnEnd),
                    effect: {
                        mode: 'chosenTrait',
                        amount: 1,
                        allowedTraits: [...event.payload.allowedTraits],
                        recommendedAction: 'endTurn',
                    },
                },
                activePlayerId: event.payload.playerId,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.TOOTH_NECKLACE_TRAIT_GAINED: {
            const actor = findExplorerByPlayerId(core, event.payload.playerId);
            if (actor && event.payload.accepted && event.payload.trait) {
                moveExplorerTraitSteps(actor, event.payload.trait, 1);
            }
            core.pendingEventChoice = null;
            const synced = syncCurrentExplorerProjection(core);
            const loggedCore: BetrayalCore = {
                ...synced,
                pendingEventChoice: null,
                activePlayerId: null,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(
                    synced,
                    event.payload.logText,
                    event.payload.accepted ? 'accent' : 'neutral',
                ),
            };
            return reduceEvent(
                loggedCore,
                nowEvent(EVENTS.TURN_ENDED, cloneTurnEndedPayload(event.payload.deferredTurnEnd), event.timestamp),
            );
        }
        case EVENTS.TURN_ENDED: {
            const result = applyBetrayalTurnEndedState(core, event);
            if (result.scenarioCompletedResult) {
                return reduceScenarioCompletionStateResolution(result, event.timestamp);
            }
            if (result.helpingHandsMonsterTurnStartedPayload) {
                return reduceEvent(
                    result.core,
                    nowEvent(
                        EVENTS.HELPING_HANDS_MONSTER_TURN_STARTED,
                        result.helpingHandsMonsterTurnStartedPayload,
                        event.timestamp,
                    ),
                );
            }
            return result.core;
        }
        case EVENTS.DAMAGE_ALLOCATION_RESOLVED: {
            const result = applyBetrayalDamageAllocationAftermathState(core, event);
            if (result.scenarioCompletedResult) {
                return reduceScenarioCompletionStateResolution(result, event.timestamp);
            }
            if (result.turnEndRollAcknowledgedPayload) {
                return reduceEvent(
                    result.core,
                    nowEvent(EVENTS.TURN_END_ROLL_ACKNOWLEDGED, result.turnEndRollAcknowledgedPayload, event.timestamp),
                );
            }
            return result.core;
        }
        case EVENTS.RECENT_ROLL_ACKNOWLEDGED: {
            if (core.recentRoll?.id !== event.payload.rollId) {
                return core;
            }
            core.recentRoll = event.payload.isFullyAcknowledged
                ? null
                : {
                      ...core.recentRoll,
                      requiredPlayerIds: [...event.payload.requiredPlayerIds],
                      acknowledgedPlayerIds: [...event.payload.acknowledgedPlayerIds],
                  };
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.TURN_END_ROLL_ACKNOWLEDGED: {
            const result = applyBetrayalTurnEndRollAcknowledgedState(core, event);
            return reduceScenarioCompletionStateResolution(result, event.timestamp);
        }
        case EVENTS.HAUNT_TRIGGERED: {
            return applyBetrayalHauntTriggeredState(core, event, DEFAULT_BETRAYAL_RANDOM);
        }
        case EVENTS.MONSTER_DAMAGE_RESOLVED: {
            return applyBetrayalMonsterDamageResolvedState(core, event);
        }
        case EVENTS.MONSTER_TURN_START_RESOLVED: {
            return applyBetrayalMonsterTurnStartResolvedState(core, event);
        }
        case EVENTS.MONSTER_MOVEMENT_GROUP_ROLLED: {
            return applyBetrayalMonsterMovementGroupRolledState(core, event);
        }
        case EVENTS.MONSTER_MOVED: {
            const movedCore = applyBetrayalMonsterMovedState(core, event);
            return completeMummyTraitorVictoryIfNeeded(movedCore, event.timestamp) ?? movedCore;
        }
        case EVENTS.MONSTER_ATTACK_HERO_RESOLVED: {
            return applyBetrayalMonsterAttackHeroResolvedState(core, event);
        }
        case EVENTS.BLOOD_FROM_STONE_MONSTER_TURN_ENDED: {
            const result = applyBloodFromStoneMonsterTurnEndedState(core, event);
            if (result.turnEndRollAcknowledgedPayload) {
                return reduceEvent(
                    result.core,
                    nowEvent(EVENTS.TURN_END_ROLL_ACKNOWLEDGED, result.turnEndRollAcknowledgedPayload, event.timestamp),
                );
            }
            return result.core;
        }
        case EVENTS.BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED: {
            return applyBetrayalBloodFromStoneExtraStoneCherubsPlacedState(core, event);
        }
        case EVENTS.DYNAMITE_ATTACK_RESOLVED: {
            return applyBetrayalDynamiteAttackResolvedState(core, event);
        }
        case EVENTS.HAUNT_ATTACK_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalHauntAttackResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.HELPING_HANDS_ATTACK_REWARD_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalHelpingHandsAttackRewardResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.MUMMY_ATTACK_REWARD_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalMummyAttackRewardResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.HELPING_HANDS_MONSTER_TURN_STARTED: {
            return applyBetrayalHelpingHandsMonsterTurnStartedState(core, event);
        }
        case EVENTS.HELPING_HANDS_TROLL_HAND_MOVED: {
            return applyBetrayalHelpingHandsTrollHandMovedState(core, event);
        }
        case EVENTS.HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalHelpingHandsTrollHandAttackResolvedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.HELPING_HANDS_MONSTER_TURN_ENDED: {
            return applyBetrayalHelpingHandsMonsterTurnEndedState(core, event);
        }
        case EVENTS.JACK_LEARNED: {
            return applyBetrayalJackLearnedState(core, event);
        }
        case EVENTS.EXORCISM_STUDIED: {
            return applyBetrayalExorcismStudiedState(core, event);
        }
        case EVENTS.JACK_EXORCISED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalJackExorcisedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.MUMMY_NAME_STUDIED: {
            return applyBetrayalMummyNameStudiedState(core, event);
        }
        case EVENTS.MUMMY_BANISHMENT_LEARNED: {
            return applyBetrayalMummyBanishmentLearnedState(core, event);
        }
        case EVENTS.MUMMY_BANISHED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalMummyBanishedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.MUMMY_GIRL_PICKED_UP: {
            return applyBetrayalMummyGirlPickedUpState(core, event);
        }
        case EVENTS.MUMMY_GIRL_GIVEN: {
            return applyBetrayalMummyGirlGivenState(core, event);
        }
        case EVENTS.MUMMY_OMEN_GIVEN: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalMummyOmenGivenState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.UPON_REFLECTION_EVENT_HINT_GIVEN: {
            return applyBetrayalUponReflectionEventHintGivenState(core, event);
        }
        case EVENTS.UPON_REFLECTION_CURSE_BREAK_ATTEMPTED: {
            return reduceScenarioCompletionStateResolution(
                applyBetrayalUponReflectionCurseBreakAttemptedState(core, event),
                event.timestamp,
            );
        }
        case EVENTS.SCENARIO_COMPLETED:
            return applyBetrayalScenarioCompletedState(core, event);
        default:
            return core;
    }
}
