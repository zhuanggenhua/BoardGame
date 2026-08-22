import type { CreateSimpleChoiceFromChoiceRequestOptions } from '../../../engine/systems/ChoiceRequestSimpleChoiceAdapter';
import type { TimingOpportunitySystemConfig } from '../../../engine/systems/TimingOpportunitySystem';
import type {
    Opportunity,
    TimingOpportunityDiscoveryArgs,
    TimingOpportunityDiscoveryResult,
} from '../../../engine/TimingOpportunity';
import type { MatchState } from '../../../engine/types';
import {
    buildSmashUpReactionChoiceCandidate,
    buildSmashUpReactionChoiceRequestOptions,
    buildSmashUpReactionOpportunity,
    isNonPassSmashUpReactionOption,
    SMASHUP_REACTION_CHOOSE_SOURCE_ID,
} from './reactionTimingOpportunity';
import {
    buildReactionOptions,
    getSmashUpReactionSession,
    type ReactionChoiceValue,
} from './reactionSession';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent } from './types';

function getTimingTimestamp(
    args: TimingOpportunityDiscoveryArgs<SmashUpCore, SmashUpCommand, SmashUpEvent>,
): number {
    if (typeof args.timing.timestamp === 'number') return args.timing.timestamp;
    const eventTimestamp = args.events
        ?.map(event => event.timestamp)
        .find((timestamp): timestamp is number => typeof timestamp === 'number');
    return eventTimestamp ?? args.state.core.turnNumber ?? 0;
}

function toSmashUpMatchState(state: { core: unknown; sys: unknown }): MatchState<SmashUpCore> | undefined {
    const core = state.core as Partial<SmashUpCore> | undefined;
    if (!core || typeof core !== 'object' || !core.players || !Array.isArray(core.turnOrder)) {
        return undefined;
    }
    return state as MatchState<SmashUpCore>;
}

export function buildSmashUpTimingOpportunityChoiceRequestOptions(
    opportunity: Opportunity<ReactionChoiceValue>,
): CreateSimpleChoiceFromChoiceRequestOptions<ReactionChoiceValue> | null {
    if (opportunity.sourceRef.id !== SMASHUP_REACTION_CHOOSE_SOURCE_ID) {
        return null;
    }
    const phase = opportunity.metadata?.phase === 'mandatory' ? 'mandatory' : 'optional';
    return buildSmashUpReactionChoiceRequestOptions(
        phase,
        (state) => {
            const matchState = toSmashUpMatchState(state);
            const session = matchState ? getSmashUpReactionSession(matchState) : undefined;
            if (!matchState || !session) return [];
            const now = matchState.core.turnNumber ?? 0;
            return buildReactionOptions(matchState, session, now)
                .map((option, index) => buildSmashUpReactionChoiceCandidate(option, index, session));
        },
    );
}

export function createSmashUpTimingOpportunitySystemConfig(): TimingOpportunitySystemConfig<ReactionChoiceValue> {
    return {
        choiceRequestOptions: buildSmashUpTimingOpportunityChoiceRequestOptions,
    };
}

export function discoverSmashUpTimingOpportunities(
    args: TimingOpportunityDiscoveryArgs<SmashUpCore, SmashUpCommand, SmashUpEvent>,
): TimingOpportunityDiscoveryResult<ReactionChoiceValue> {
    const session = getSmashUpReactionSession(args.state);
    if (!session) {
        return { opportunities: [] };
    }

    const now = getTimingTimestamp(args);
    const options = buildReactionOptions(args.state, session, now);
    const nonPassOptions = options.filter(isNonPassSmashUpReactionOption);
    if (nonPassOptions.length === 0) {
        return { opportunities: [] };
    }

    return {
        opportunities: [
            buildSmashUpReactionOpportunity(args, session, options),
        ],
    };
}
