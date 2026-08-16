import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import type { QidahenCore } from './types';
import {
    type QidahenInteractionSourceId,
    isQidahenInteractionSourceId,
} from './interactionSources';

export type QidahenResolvedPayload = {
    sourceId?: QidahenInteractionSourceId;
    optionId?: string;
    optionIds: string[];
    value?: unknown;
    interactionData?: unknown;
};

export type QidahenInteractionResolutionContext = {
    state: MatchState<QidahenCore>;
    payload: QidahenResolvedPayload;
    event: GameEvent;
    random: RandomFn;
};

export const readQidahenResolvedPayload = (event: GameEvent): QidahenResolvedPayload => {
    const payload = (event.payload ?? {}) as {
        optionId?: unknown;
        optionIds?: unknown;
        sourceId?: unknown;
        value?: unknown;
        interactionData?: unknown;
    };
    const interactionData = payload.interactionData;
    const interactionSourceId = (
        interactionData
        && typeof interactionData === 'object'
        && isQidahenInteractionSourceId((interactionData as { sourceId?: unknown }).sourceId)
    )
        ? (interactionData as { sourceId: QidahenInteractionSourceId }).sourceId
        : undefined;
    return {
        sourceId: isQidahenInteractionSourceId(payload.sourceId) ? payload.sourceId : interactionSourceId,
        optionId: typeof payload.optionId === 'string' ? payload.optionId : undefined,
        optionIds: Array.isArray(payload.optionIds)
            ? payload.optionIds.filter((optionId): optionId is string => typeof optionId === 'string')
            : [],
        value: payload.value,
        interactionData,
    };
};

export const getQidahenResolvedChoiceId = (
    payload: QidahenResolvedPayload,
): string | null => payload.optionId ?? payload.optionIds[0] ?? null;
