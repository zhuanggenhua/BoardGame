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
    return getRegisteredQidahenRuntimeInteractionSourceIds().reduce(
        (currentState, sourceId) => syncQidahenSpecificInteraction(
            currentState,
            sourceId,
        ),
        state,
    );
}
