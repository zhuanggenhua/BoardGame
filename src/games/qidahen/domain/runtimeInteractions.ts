import type { MatchState } from '../../../engine/types';
import {
    resolveInteraction,
} from '../../../engine/systems/InteractionSystem';
import {
    type QidahenInteractionSourceId,
    getInteractionSourceId,
} from './interactionSources';
import {
    buildQidahenRuntimeInteractionFromBuilders,
    getRegisteredQidahenRuntimeInteractionSourceIds,
} from './interactionBuilders';
import type { QidahenCore } from './types';

export function clearQidahenRuntimeInteractionCurrent(
    state: MatchState<QidahenCore>,
): MatchState<QidahenCore> {
    const interactionState = state.sys.interaction;
    if (!interactionState?.current) {
        return state;
    }
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...interactionState,
                current: undefined,
            },
        },
    };
}

function syncQidahenSpecificInteraction(
    state: MatchState<QidahenCore>,
    sourceId: QidahenInteractionSourceId,
): MatchState<QidahenCore> {
    const interactionState = state.sys.interaction ?? { queue: [] };
    const current = interactionState.current;
    const currentSourceId = getInteractionSourceId(current);
    const interaction = buildQidahenRuntimeInteractionFromBuilders(state, sourceId);

    if (current && currentSourceId !== sourceId && interaction) {
        return {
            ...state,
            sys: {
                ...state.sys,
                interaction: {
                    ...interactionState,
                    current: interaction,
                },
            },
        };
    }

    if (!interaction) {
        if (currentSourceId !== sourceId) {
            return state;
        }
        return resolveInteraction(state);
    }

    if (current && currentSourceId !== sourceId) {
        return state;
    }

    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...interactionState,
                current: interaction,
            },
        },
    };
}

export function syncQidahenRuntimeInteractionState(
    state: MatchState<QidahenCore>,
): MatchState<QidahenCore> {
    if (
        state.core.scenarioVote != null
        || state.core.pendingScenarioCharacterChoices.length > 0
        || state.core.pendingScenarioArmamentChoices.length > 0
    ) {
        return clearQidahenRuntimeInteractionCurrent(state);
    }

    return getRegisteredQidahenRuntimeInteractionSourceIds().reduce(
        (currentState, sourceId) => syncQidahenSpecificInteraction(
            currentState,
            sourceId,
        ),
        state,
    );
}
