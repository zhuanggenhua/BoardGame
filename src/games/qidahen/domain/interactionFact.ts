import type { QidahenEvent } from './types';
import type { QidahenInteractionResolutionContext } from './interactionResolutionPayload';

/** Selection facts contain the selected inputs, including resolved random outcomes. */
export function createQidahenInteractionFact<T extends QidahenEvent['type']>(
    context: QidahenInteractionResolutionContext,
    type: T,
    payload: Extract<QidahenEvent, { type: T }>['payload'],
): Extract<QidahenEvent, { type: T }> {
    return {
        type,
        payload,
        timestamp: context.event.timestamp ?? 0,
        sourceCommandType: context.event.sourceCommandType ?? context.event.type,
    } as Extract<QidahenEvent, { type: T }>;
}
