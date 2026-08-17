import { getFreshSimpleChoiceOptions, type InteractionDescriptor as EngineInteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MatchState } from '../../../engine/types';
import { resolveLiveSmashUpReactionChoice, type ReactionChoiceValue, type ReactionOption } from './reactionSession';
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
    const liveChoice = resolveLiveSmashUpReactionChoice(
        state,
        { kind: 'pass' },
        state.core.turnNumber ?? 0,
    );
    if (liveChoice?.options.length) {
        return liveChoice.options;
    }

    const refreshedOptions = getFreshSimpleChoiceOptions(
        state,
        interaction as EngineInteractionDescriptor<unknown>,
    ) as ReactionOption[];
    const interactionOwnsLiveRefresh = typeof interaction.data.optionsGenerator === 'function'
        || interaction.data.autoRefresh !== undefined;
    if (interactionOwnsLiveRefresh || !liveChoice) {
        return refreshedOptions;
    }

    const refreshedPassOptions = refreshedOptions.filter(isReactionPassLikeOption);
    return refreshedPassOptions.length > 0 ? refreshedPassOptions : liveChoice.options;
}

export type SmashUpReactionChoiceParsedValue = {
    kind: ReactionChoiceValue['kind'];
    triggerId?: string;
    playerId?: string;
    cardUid?: string;
    baseIndex?: number;
    targetBaseIndex?: number;
    targetMinionUid?: string;
    minionUid?: string;
    titanUid?: string;
};

export type SmashUpReactionHandPlayTarget = {
    kind: 'play_action' | 'play_minion';
    cardUid: string;
    baseIndex?: number;
    targetMinionUid?: string;
};

function readNonNegativeInteger(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
        ? value
        : undefined;
}

export function readSmashUpReactionChoiceValue(value: unknown): SmashUpReactionChoiceParsedValue | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as {
        kind?: unknown;
        triggerId?: unknown;
        playerId?: unknown;
        cardUid?: unknown;
        baseIndex?: unknown;
        targetBaseIndex?: unknown;
        targetMinionUid?: unknown;
        minionUid?: unknown;
        titanUid?: unknown;
    };
    const normalizedKind = typeof candidate.kind === 'string'
        ? candidate.kind
        : typeof candidate.triggerId === 'string'
            ? 'trigger'
            : undefined;

    if (
        normalizedKind !== 'trigger'
        && normalizedKind !== 'play_action'
        && normalizedKind !== 'play_minion'
        && normalizedKind !== 'activate_special'
        && normalizedKind !== 'pass'
    ) {
        return null;
    }

    if (normalizedKind === 'trigger' && typeof candidate.triggerId !== 'string') {
        return null;
    }
    if ((normalizedKind === 'play_action' || normalizedKind === 'play_minion') && typeof candidate.cardUid !== 'string') {
        return null;
    }

    return {
        kind: normalizedKind,
        triggerId: typeof candidate.triggerId === 'string' ? candidate.triggerId : undefined,
        playerId: typeof candidate.playerId === 'string' ? candidate.playerId : undefined,
        cardUid: typeof candidate.cardUid === 'string' ? candidate.cardUid : undefined,
        baseIndex: readNonNegativeInteger(candidate.baseIndex),
        targetBaseIndex: readNonNegativeInteger(candidate.targetBaseIndex),
        targetMinionUid: typeof candidate.targetMinionUid === 'string' ? candidate.targetMinionUid : undefined,
        minionUid: typeof candidate.minionUid === 'string' ? candidate.minionUid : undefined,
        titanUid: typeof candidate.titanUid === 'string' ? candidate.titanUid : undefined,
    };
}

export function getSmashUpReactionChoiceCardUid(value: unknown): string | undefined {
    const parsed = readSmashUpReactionChoiceValue(value);
    return parsed?.cardUid;
}

export function getSmashUpReactionChoiceBaseIndex(value: unknown): number | undefined {
    const parsed = readSmashUpReactionChoiceValue(value);
    if (!parsed) return undefined;
    return parsed.kind === 'play_minion'
        ? parsed.baseIndex
        : parsed.targetBaseIndex ?? parsed.baseIndex;
}

export function getSmashUpReactionChoiceTargetMinionUid(value: unknown): string | undefined {
    return readSmashUpReactionChoiceValue(value)?.targetMinionUid;
}

export function readSmashUpReactionHandPlayTarget(value: unknown): SmashUpReactionHandPlayTarget | null {
    const parsed = readSmashUpReactionChoiceValue(value);
    if (!parsed || (parsed.kind !== 'play_action' && parsed.kind !== 'play_minion') || !parsed.cardUid) {
        return null;
    }
    return {
        kind: parsed.kind,
        cardUid: parsed.cardUid,
        baseIndex: getSmashUpReactionChoiceBaseIndex(value),
        targetMinionUid: parsed.targetMinionUid,
    };
}

export function isSmashUpReactionHandPlayValue(value: unknown): value is SmashUpReactionHandPlayTarget {
    return readSmashUpReactionHandPlayTarget(value) !== null;
}

export function matchesSmashUpReactionHandPlayTarget(
    value: unknown,
    params: SmashUpReactionHandPlayTarget,
): boolean {
    const parsed = readSmashUpReactionHandPlayTarget(value);
    if (!parsed || parsed.kind !== params.kind || parsed.cardUid !== params.cardUid) return false;
    if (parsed.kind === 'play_minion') {
        return parsed.baseIndex === params.baseIndex;
    }
    return parsed.baseIndex === params.baseIndex
        && parsed.targetMinionUid === params.targetMinionUid;
}

export function getSmashUpReactionChoicePassOptionId(
    state: MatchState<SmashUpCore>,
    interaction: SmashUpReactionChoiceInteraction,
): string | undefined {
    const option = getSmashUpReactionChoiceOptions(state, interaction).find(isReactionPassLikeOption);
    return typeof option?.id === 'string' ? option.id : undefined;
}
