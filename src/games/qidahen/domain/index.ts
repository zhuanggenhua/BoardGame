import type { DomainCore, MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { validate } from './commands';
import { buildQidahenCommandEvents } from './commandEventBuilders';
import { reduceQidahenDirectInputEvent } from './directInputEventReducers';
import { syncQidahenRuntimeInteractionState } from './runtimeInteractions';
import {
    readQidahenScenarioChoiceSelections,
    readQidahenScenarioId,
    readQidahenSpecialCardsEnabled,
    shouldUseQidahenInMatchScenarioVote,
    shouldResolveQidahenScenarioChoiceGroups,
} from '../roomSetup';
import { reduceQidahenResolvedEvent } from './resolvedEventReducers';
import { createInitialCore, createInitialCoreForInMatchScenarioVote } from './initialCoreSetup';
import { syncQidahenSpecialRuleState } from './specialRuleState';
import { syncQidahenJadeCasketControlAfterRegionChange } from './jadeCasketControl';
import { applyQidahenVictoryStatus } from './victoryResolution';
import type { QidahenCommand, QidahenCore, QidahenEvent } from './types';
import { playerView } from './view';
import { discoverQidahenTurnOpportunities } from './turnResolutionOpportunities';
import { reduceQidahenTurnResolutionFact } from './turnResolutionFacts';
import { recordQidahenChronologyStatistics } from './chronologyStatistics';

const now = () => Date.now();

export const QidahenDomain: DomainCore<QidahenCore, QidahenCommand, QidahenEvent> = {
    gameId: 'qidahen',

    setup: (playerIds: PlayerId[], _random: RandomFn, setupData?: unknown): QidahenCore => {
        const rawSetupData = (setupData && typeof setupData === 'object' && !Array.isArray(setupData))
            ? setupData as Record<string, unknown>
            : undefined;
        const tutorialCoreTransform = typeof rawSetupData?.qidahenTutorialCoreTransform === 'function'
            ? rawSetupData.qidahenTutorialCoreTransform as (core: QidahenCore) => QidahenCore
            : null;
        const hasExplicitScenario = rawSetupData != null
            && (
                typeof rawSetupData.scenario === 'string'
                || typeof (rawSetupData.setupSelections as Record<string, unknown> | undefined)?.scenario === 'string'
                || typeof rawSetupData.scenarioId === 'string'
            );
        if (!hasExplicitScenario && shouldUseQidahenInMatchScenarioVote(rawSetupData)) {
            const initialCore = createInitialCoreForInMatchScenarioVote(playerIds, readQidahenSpecialCardsEnabled(rawSetupData), cards => _random.shuffle(cards), cards => _random.shuffle(cards), cards => _random.shuffle(cards));
            return tutorialCoreTransform ? tutorialCoreTransform(initialCore) : initialCore;
        }
        const initialCore = createInitialCore(
            playerIds,
            readQidahenScenarioId(rawSetupData),
            shouldResolveQidahenScenarioChoiceGroups(rawSetupData),
            readQidahenScenarioChoiceSelections(rawSetupData),
            readQidahenSpecialCardsEnabled(rawSetupData),
            cards => _random.shuffle(cards),
            cards => _random.shuffle(cards),
            cards => _random.shuffle(cards),
        );
        return tutorialCoreTransform ? tutorialCoreTransform(initialCore) : initialCore;
    },

    validate,
    discoverTimingOpportunities: discoverQidahenTurnOpportunities,

    normalizeRuntimeState: (state: MatchState<QidahenCore>): MatchState<QidahenCore> => {
        const normalizedState = {
            ...state,
            core: syncQidahenSpecialRuleState(state.core),
        };
        return normalizedState.sys.interaction?.current
            ? normalizedState
            : syncQidahenRuntimeInteractionState(normalizedState);
    },

    execute: (_state, command, _random): QidahenEvent[] => {
        const commandEvents = buildQidahenCommandEvents(
            _state,
            command,
            _random,
            now(),
        );
        return commandEvents ?? [];
    },

    reduce: (state, event): QidahenCore => {
        const reducedCore = (event.type === 'TURN_RESOLUTION_APPLIED' ? reduceQidahenTurnResolutionFact(state, event) : undefined)
            ?? reduceQidahenResolvedEvent(state, event)
            ?? reduceQidahenDirectInputEvent(state, event)
            ?? state;
        const syncedCore = syncQidahenJadeCasketControlAfterRegionChange(state, reducedCore);
        if (syncedCore === reducedCore) {
            return recordQidahenChronologyStatistics(state, reducedCore);
        }
        const jadeCasketTransferred = syncedCore.activeEventCards !== reducedCore.activeEventCards;
        if (!jadeCasketTransferred || reducedCore.victoryStatus?.condition !== 'prestige') {
            return recordQidahenChronologyStatistics(state, syncedCore);
        }
        return recordQidahenChronologyStatistics(state, applyQidahenVictoryStatus({
            ...syncedCore,
            victoryStatus: state.victoryStatus,
        }));
    },

    playerView,

    isGameOver: (state) => {
        const winnerFactionId = state.victoryStatus?.winnerFactionId;
        if (!winnerFactionId) {
            return undefined;
        }
        return {
            winner: state.factions[winnerFactionId].playerId,
        };
    },
};

export {
    findQidahenReachableRuntimeRegions,
    getQidahenMovementProfile,
} from './movement';
export type { QidahenActionChoice, QidahenBattleRoll, QidahenBattleRollPhase, QidahenCasualtyPriority, QidahenCommandMap, QidahenCore, QidahenDiplomacySelection, QidahenDriveTigerConsentSelection, QidahenFactionId, QidahenGrantPardonChoice, QidahenGrantPardonSelection, QidahenHandCard, QidahenHandLimitDiscardSelection, QidahenInternalDispatchSelection, QidahenMapToken, QidahenPostBattleSelection, QidahenRecruitChoice, QidahenScenarioId, QidahenWheelDispatchSelection, QidahenWheelMoveChoice, QidahenWheelRecruitTrainChoice } from './types';
export {
    getQidahenDiplomacySelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './selectionBuilders';
export { getQidahenDriveTigerConsentSelectionFromInteraction, getQidahenDriveTigerConsentSelectionForCore, getQidahenDiplomacySelectionFromInteraction, getQidahenEventCharacterTargetSelectionFromInteraction, getQidahenEventCharacterTargetSelectionForCore, getQidahenEventOpponentHandChoiceSelectionFromInteraction, getQidahenEventOpponentHandChoiceSelectionForCore, getQidahenGrantPardonSelectionFromInteraction, getQidahenGrantPardonSelectionForCore, getQidahenHandLimitDiscardSelectionFromInteraction, getQidahenInternalDispatchSelectionFromInteraction, getQidahenKhanEdictSelectionFromInteraction, getQidahenMaShiTradeSelectionFromInteraction, getQidahenPendingTargetActionForCore, getQidahenPendingTargetActionFromInteraction, getQidahenPostBattleSelectionForCore, getQidahenPostBattleSelectionFromInteraction, getQidahenRecruitSelectionFromInteraction, getQidahenWheelDispatchSelectionForCore, getQidahenWheelDispatchSelectionFromInteraction } from './interactionSelectionAccessors';
export { getQidahenEffectiveVpByFaction, getQidahenPrestigeBonusByFaction } from './victoryResolution';
