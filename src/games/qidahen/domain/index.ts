import type { DomainCore, MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { validate } from './commands';
import { buildQidahenCommandEvents } from './commandEventBuilders';
import { reduceQidahenDirectInputEvent } from './directInputEventReducers';
import { syncQidahenRuntimeInteractionState } from './runtimeInteractions';
import {
    readQidahenScenarioChoiceSelections,
    readQidahenScenarioId,
    shouldResolveQidahenScenarioChoiceGroups,
} from '../roomSetup';
import { reduceQidahenResolvedEvent } from './resolvedEventReducers';
import { createInitialCore } from './initialCoreSetup';
import { syncQidahenSpecialRuleState } from './specialRuleState';
import type { QidahenCommand, QidahenCore, QidahenEvent } from './types';

const now = () => Date.now();

export const QidahenDomain: DomainCore<QidahenCore, QidahenCommand, QidahenEvent> = {
    gameId: 'qidahen',

    setup: (playerIds: PlayerId[], _random: RandomFn, setupData?: unknown): QidahenCore => {
        const rawSetupData = (setupData && typeof setupData === 'object' && !Array.isArray(setupData))
            ? setupData as Record<string, unknown>
            : undefined;
        return createInitialCore(
            playerIds,
            readQidahenScenarioId(rawSetupData),
            shouldResolveQidahenScenarioChoiceGroups(rawSetupData),
            readQidahenScenarioChoiceSelections(rawSetupData),
        );
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
            now(),
        );
        return commandEvents ?? [];
    },

    reduce: (state, event): QidahenCore => {
        const reducedCore = reduceQidahenResolvedEvent(state, event);
        if (reducedCore) {
            return reducedCore;
        }
        return reduceQidahenDirectInputEvent(state, event) ?? state;
    },

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
export type { QidahenCasualtyPriority, QidahenCommandMap, QidahenCore } from './types';
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
    getQidahenFortificationMaintenanceSelectionFromInteraction,
    getQidahenFortificationMaintenanceSelectionForCore,
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
