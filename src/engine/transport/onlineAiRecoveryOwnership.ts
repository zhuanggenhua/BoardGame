import type { AiSeatController } from '../ai';
import type { MatchState } from '../types';

export type OnlineAiRecoverySeatStateResolver = (playerId: string) => MatchState<unknown>;

export function isOnlineAiRecoveryStillOwnedByAi(args: {
    playerId: string;
    sharedState: MatchState<unknown>;
    seatControllers: Record<string, AiSeatController>;
    resolveSeatState: OnlineAiRecoverySeatStateResolver;
    resolveCurrentPlayerId: () => string | null | undefined;
}): boolean {
    const { playerId, sharedState, seatControllers } = args;
    if (!playerId || seatControllers[playerId]?.type === 'human') {
        return false;
    }

    const interactionState = sharedState.sys?.interaction as {
        current?: { playerId?: unknown } | null;
        isBlocked?: unknown;
    } | undefined;
    const sharedInteractionPlayerId = typeof interactionState?.current?.playerId === 'string'
        ? interactionState.current.playerId
        : null;
    if (sharedInteractionPlayerId) {
        return sharedInteractionPlayerId === playerId;
    }

    if (interactionState?.current == null && interactionState?.isBlocked === true) {
        const seatView = args.resolveSeatState(playerId);
        const seatInteraction = seatView.sys?.interaction as {
            current?: { playerId?: unknown } | null;
        } | undefined;
        const seatInteractionPlayerId = typeof seatInteraction?.current?.playerId === 'string'
            ? seatInteraction.current.playerId
            : null;
        return seatInteractionPlayerId === playerId;
    }

    const responseWindow = sharedState.sys?.responseWindow as {
        current?: {
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        };
    } | undefined;
    const responderQueue = Array.isArray(responseWindow?.current?.responderQueue)
        ? responseWindow.current.responderQueue
        : [];
    const responderIndex = typeof responseWindow?.current?.currentResponderIndex === 'number'
        ? responseWindow.current.currentResponderIndex
        : 0;
    const responderId = typeof responderQueue[responderIndex] === 'string'
        ? responderQueue[responderIndex]
        : null;
    if (responderId) {
        return responderId === playerId && seatControllers[responderId]?.type !== 'human';
    }

    return args.resolveCurrentPlayerId() === playerId;
}
