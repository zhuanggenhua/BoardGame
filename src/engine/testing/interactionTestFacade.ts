import {
    createSimpleChoice,
    INTERACTION_COMMANDS,
} from '../systems/InteractionSystem';
import type { MatchState, PlayerId } from '../types';

type InteractionLike = {
    id: string;
    playerId: PlayerId;
    kind: string;
    sourceId?: string;
    data?: Record<string, unknown>;
};

type PromptOptionLike = {
    id: string;
    label?: string;
    value?: Record<string, unknown>;
};

export function injectSimpleChoiceBlockingInteraction<TCore>(
    state: MatchState<TCore>,
    args: {
        id: string;
        playerId: PlayerId;
        sourceId?: string;
        title?: string;
        options?: Array<{ id: string; label?: string; value?: Record<string, unknown> }>;
    },
): void {
    state.sys.interaction = {
        ...state.sys.interaction,
        current: createSimpleChoice(
            args.id,
            args.playerId,
            args.title ?? '阻塞交互',
            (args.options ?? [{ id: 'ok', label: '确认', labelKey: 'common:button.confirm', value: {} }]).map((option) => ({
                id: option.id,
                label: option.label ?? option.id,
                labelKey: 'common:button.confirm',
                value: option.value ?? {},
            })),
            args.sourceId ? { sourceId: args.sourceId } : undefined,
        ),
    };
}

export function injectRawBlockingInteraction<TCore>(
    state: MatchState<TCore>,
    interaction: InteractionLike,
): void {
    state.sys.interaction = {
        ...state.sys.interaction,
        current: {
            id: interaction.id,
            kind: interaction.kind,
            playerId: interaction.playerId,
            ...(interaction.sourceId ? { sourceId: interaction.sourceId } : {}),
            data: interaction.data ?? {},
        } as never,
    };
}

export function getCurrentInteractionSummary<TCore>(state: MatchState<TCore>): {
    id?: string;
    kind?: string;
    playerId?: string;
    sourceId?: string;
} {
    const current = state.sys.interaction?.current as {
        id?: unknown;
        kind?: unknown;
        playerId?: unknown;
        sourceId?: unknown;
        data?: { sourceId?: unknown };
    } | null | undefined;

    return {
        ...(typeof current?.id === 'string' ? { id: current.id } : {}),
        ...(typeof current?.kind === 'string' ? { kind: current.kind } : {}),
        ...(typeof current?.playerId === 'string' ? { playerId: current.playerId } : {}),
        ...(typeof current?.sourceId === 'string'
            ? { sourceId: current.sourceId }
            : typeof current?.data?.sourceId === 'string'
                ? { sourceId: current.data.sourceId }
                : {}),
    };
}

export function getPromptOptions<TCore>(state: MatchState<TCore>): PromptOptionLike[] {
    const current = state.sys.interaction?.current as {
        data?: { options?: unknown };
    } | null | undefined;
    const options = current?.data?.options;
    if (!Array.isArray(options)) {
        return [];
    }

    return options.filter((option): option is PromptOptionLike => (
        typeof option === 'object'
        && option != null
        && typeof (option as { id?: unknown }).id === 'string'
    ));
}

export function getPromptOption<TCore>(
    state: MatchState<TCore>,
    predicate: (option: PromptOptionLike) => boolean,
    description: string,
): PromptOptionLike {
    const option = getPromptOptions(state).find(predicate);
    if (!option) {
        throw new Error(`Missing prompt option: ${description}`);
    }
    return option;
}

export function createRespondToPromptCommand<TCore>(
    state: MatchState<TCore>,
    args: {
        playerId: PlayerId;
        optionId?: string;
        optionIds?: string[];
        mergedValue?: unknown;
    },
): { type: string; playerId: PlayerId; payload: Record<string, unknown> } {
    const summary = getCurrentInteractionSummary(state);
    if (!summary.id) {
        throw new Error('No current prompt to respond to');
    }

    const payload: Record<string, unknown> = {
        interactionId: summary.id,
    };
    if (args.optionId != null) {
        payload.optionId = args.optionId;
    }
    if (args.optionIds != null) {
        payload.optionIds = args.optionIds;
    }
    if ('mergedValue' in args) {
        payload.mergedValue = args.mergedValue;
    }

    return {
        type: INTERACTION_COMMANDS.RESPOND,
        playerId: args.playerId,
        payload,
    };
}
