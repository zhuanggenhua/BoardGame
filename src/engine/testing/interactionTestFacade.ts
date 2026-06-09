import { createSimpleChoice } from '../systems/InteractionSystem';
import type { MatchState, PlayerId } from '../types';

type InteractionLike = {
    id: string;
    playerId: PlayerId;
    kind: string;
    sourceId?: string;
    data?: Record<string, unknown>;
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
            (args.options ?? [{ id: 'ok', label: '确认', value: {} }]).map((option) => ({
                id: option.id,
                label: option.label ?? option.id,
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
