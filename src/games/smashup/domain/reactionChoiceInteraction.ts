import { getFreshSimpleChoiceOptions, type InteractionDescriptor as EngineInteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MatchState } from '../../../engine/types';
import { resolveLiveSmashUpReactionChoice, type ReactionOption } from './reactionSession';
import type { SmashUpCore } from './types';

type SmashUpReactionChoiceInteraction = EngineInteractionDescriptor<unknown> & {
    kind: 'simple-choice';
    data: {
        sourceId?: unknown;
        optionsGenerator?: ((state: MatchState<SmashUpCore>, data: unknown) => ReactionOption[]) | undefined;
        autoRefresh?: unknown;
    };
};

function isReactionPassLikeOption(option: ReactionOption | undefined): boolean {
    if (!option) return false;
    const value = option.value as { kind?: unknown; __emergency_skip__?: unknown } | undefined;
    return option.id === 'pass'
        || value?.kind === 'pass'
        || option.id === '__emergency_skip__'
        || value?.__emergency_skip__ === true;
}

export function isSmashUpReactionChoiceInteraction(
    interaction: EngineInteractionDescriptor<unknown> | null | undefined,
): interaction is SmashUpReactionChoiceInteraction {
    return interaction?.kind === 'simple-choice'
        && interaction.data != null
        && (interaction.data as { sourceId?: unknown }).sourceId === 'smashup_reaction_choose';
}

export function getSmashUpReactionChoiceOptions(
    state: MatchState<SmashUpCore>,
    interaction: SmashUpReactionChoiceInteraction,
): ReactionOption[] {
    const refreshedOptions = getFreshSimpleChoiceOptions(
        state,
        interaction as EngineInteractionDescriptor<unknown>,
    ) as ReactionOption[];
    const interactionOwnsLiveRefresh = typeof interaction.data.optionsGenerator === 'function'
        || interaction.data.autoRefresh !== undefined;
    if (interactionOwnsLiveRefresh) {
        return refreshedOptions;
    }

    const liveChoice = resolveLiveSmashUpReactionChoice(
        state,
        { kind: 'pass' },
        state.core.turnNumber ?? 0,
    );
    if (!liveChoice) {
        return refreshedOptions;
    }
    if (liveChoice.options.length > 0) {
        return liveChoice.options;
    }

    const refreshedPassOptions = refreshedOptions.filter(isReactionPassLikeOption);
    return refreshedPassOptions.length > 0 ? refreshedPassOptions : liveChoice.options;
}

export function getSmashUpReactionChoicePassOptionId(
    state: MatchState<SmashUpCore>,
    interaction: SmashUpReactionChoiceInteraction,
): string | undefined {
    const option = getSmashUpReactionChoiceOptions(state, interaction).find(isReactionPassLikeOption);
    return typeof option?.id === 'string' ? option.id : undefined;
}
