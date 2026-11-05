import { statePersistence } from './statePersistence';

import type { DomainCore, PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type { QidahenCore, QidahenCommand, QidahenEvent } from './types';
import { shouldUseQidahenInMatchScenarioVote, readQidahenScenarioId, shouldResolveQidahenScenarioChoiceGroups, readQidahenScenarioChoiceSelections } from '../roomSetup';
import { createInitialCoreForInMatchScenarioVote, createInitialCore } from './initialCoreSetup';
import { validate } from './commands';
import { syncQidahenSpecialRuleState } from './specialRuleState';
import { syncQidahenRuntimeInteractionState } from './runtimeInteractions';
import { buildQidahenCommandEvents } from './commandEventBuilders';
import { reduceQidahenEvent } from './reducer';
import { playerView } from './view';

export { reduceQidahenEvent } from './reducer';

export const QidahenDomain: DomainCore<QidahenCore, QidahenCommand, QidahenEvent> = {
    gameId: 'qidahen',
    statePersistence,

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
            const initialCore = createInitialCoreForInMatchScenarioVote(playerIds);
            return tutorialCoreTransform ? tutorialCoreTransform(initialCore) : initialCore;
        }
        const initialCore = createInitialCore(
            playerIds,
            readQidahenScenarioId(rawSetupData),
            shouldResolveQidahenScenarioChoiceGroups(rawSetupData),
            readQidahenScenarioChoiceSelections(rawSetupData),
        );
        return tutorialCoreTransform ? tutorialCoreTransform(initialCore) : initialCore;
    },

    validate,

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
            command.timestamp ?? 0,
        );
        return commandEvents ?? [];
    },

    reduce: reduceQidahenEvent,

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

export type {
    QidahenActionChoice,
    QidahenBattleRoll,
    QidahenBattleRollPhase,
    QidahenCasualtyPriority,
    QidahenCommandMap,
    QidahenCore,
    QidahenDiplomacySelection,
    QidahenDriveTigerConsentSelection,
    QidahenFactionId,
    QidahenFortificationMaintenanceSelection,
    QidahenGrantPardonChoice,
    QidahenGrantPardonSelection,
    QidahenHandCard,
    QidahenHandLimitDiscardSelection,
    QidahenInternalDispatchSelection,
    QidahenMapToken,
    QidahenPostBattleSelection,
    QidahenRecruitChoice,
    QidahenScenarioId,
    QidahenWheelDispatchSelection,
    QidahenWheelMoveChoice,
} from './types';

export {
    getQidahenDiplomacySelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './selectionBuilders';

export {
    getQidahenDriveTigerConsentSelectionFromInteraction,
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenDiplomacySelectionFromInteraction,
    getQidahenEventCharacterTargetSelectionFromInteraction,
    getQidahenEventCharacterTargetSelectionForCore,
    getQidahenEventOpponentHandChoiceSelectionFromInteraction,
    getQidahenEventOpponentHandChoiceSelectionForCore,
    getQidahenFortificationMaintenanceSelectionFromInteraction,
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenGrantPardonSelectionFromInteraction,
    getQidahenGrantPardonSelectionForCore,
    getQidahenHandLimitDiscardSelectionFromInteraction,
    getQidahenInternalDispatchSelectionFromInteraction,
    getQidahenKhanEdictSelectionFromInteraction,
    getQidahenMaShiTradeSelectionFromInteraction,
    getQidahenPendingTargetActionForCore,
    getQidahenPendingTargetActionFromInteraction,
    getQidahenPostBattleSelectionForCore,
    getQidahenPostBattleSelectionFromInteraction,
    getQidahenRecruitSelectionFromInteraction,
    getQidahenWheelDispatchSelectionForCore,
    getQidahenWheelDispatchSelectionFromInteraction,
} from './interactionSelectionAccessors';

export { getQidahenEffectiveVpByFaction, getQidahenPrestigeBonusByFaction } from './victoryResolution';
