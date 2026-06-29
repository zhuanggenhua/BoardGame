import type { MatchState } from '../../engine/types';

type GameFeedbackContext = {
    state: MatchState<unknown>;
    playerId?: string | null;
    isGameOver?: boolean;
    isLocalMode?: boolean;
};

let currentGameFeedbackContext: GameFeedbackContext | null = null;

export const setCurrentGameFeedbackContext = (context: GameFeedbackContext | null) => {
    currentGameFeedbackContext = context;
};

export const clearCurrentGameFeedbackContext = (state?: MatchState<unknown> | null) => {
    if (!state || currentGameFeedbackContext?.state === state) {
        currentGameFeedbackContext = null;
    }
};

export const getCurrentGameFeedbackContext = (): GameFeedbackContext | null => currentGameFeedbackContext;
