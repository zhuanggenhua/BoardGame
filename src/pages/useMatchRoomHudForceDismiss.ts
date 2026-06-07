import { useCallback } from 'react';
import type { MatchState } from '../engine/types';
import { INTERACTION_COMMANDS } from '../engine/systems';
import { tryHandleGameHudForceDismiss } from '../games/gameHudRuntimeAdapter';
import { dismissGamePageTransientUi } from '../games/pageRuntimeAdapter';

export function useMatchRoomHudForceDismiss(args: {
    gameId?: string;
    state?: MatchState<unknown> | null;
    dispatch: (type: string, payload?: Record<string, unknown>) => void;
    myPlayerId?: string | null;
}): () => Promise<boolean> {
    const { gameId, state, dispatch, myPlayerId } = args;

    return useCallback(async (): Promise<boolean> => {
        if (tryHandleGameHudForceDismiss({
            gameId,
            state,
            dispatch,
            playerId: myPlayerId,
        })) {
            return true;
        }

        const matchState = state as MatchState<unknown> | null | undefined;
        const interaction = matchState?.sys?.interaction;
        const responseWindow = matchState?.sys?.responseWindow;
        const resolution = matchState?.sys?.resolution;
        const activeFrame = resolution?.frames?.find((frame) => frame.id === resolution.activeFrameId);
        const hasSystemLock = Boolean(
            interaction?.current
            || interaction?.isBlocked
            || (interaction?.queue?.length ?? 0) > 0
            || responseWindow?.current
            || activeFrame?.status === 'blocked'
            || activeFrame?.blockedBy,
        );
        if (hasSystemLock) {
            dispatch(INTERACTION_COMMANDS.FORCE_UNLOCK, {});
            dismissGamePageTransientUi(gameId);
            return true;
        }

        if (dismissGamePageTransientUi(gameId)) {
            return true;
        }

        return false;
    }, [dispatch, gameId, myPlayerId, state]);
}
