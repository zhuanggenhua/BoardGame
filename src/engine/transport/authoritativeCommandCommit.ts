import type { MatchState, RandomFn } from '../types';
import type { StoredMatchState } from './storage';

export type TrackedRandomFactory = (
    seed: string,
    initialCursor: number,
) => { random: RandomFn; getCursor: () => number };

export type AuthoritativeCommandCommitMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    stateID: number;
    randomSeed: string;
    random: RandomFn;
    getRandomCursor: () => number;
    lastCommandPlayerId: string | null;
    lastBroadcastedViews: Map<string, unknown>;
    unloaded: boolean;
};

export type CommitAuthoritativeCommandSuccessArgs = {
    match: AuthoritativeCommandCommitMatch;
    playerId: string;
    commandType: string;
    nextState: MatchState<unknown>;
    createTrackedRandom: TrackedRandomFactory;
    persistState: (storedState: StoredMatchState) => Promise<void>;
    onCommandSucceeded?: (matchID: string, gameId: string, commandType: string) => void;
    logRandomCursorRestored?: (restoredCursor: number) => void;
};

export type CommitAuthoritativeCommandSuccessResult = {
    committed: boolean;
    stateIdAfter: number;
    gameOver: unknown;
    restoredRandomCursor: number | null;
};

export async function commitAuthoritativeCommandSuccess(
    args: CommitAuthoritativeCommandSuccessArgs,
): Promise<CommitAuthoritativeCommandSuccessResult> {
    const { match } = args;
    match.state = args.nextState;
    match.stateID += 1;
    match.lastCommandPlayerId = args.playerId;

    const restoredRandomCursor = resolveRestoredRandomCursor(match.state);
    if (typeof restoredRandomCursor === 'number') {
        const rebuilt = args.createTrackedRandom(match.randomSeed, restoredRandomCursor);
        match.random = rebuilt.random;
        match.getRandomCursor = rebuilt.getCursor;
        args.logRandomCursorRestored?.(restoredRandomCursor);
        match.lastBroadcastedViews.clear();
        match.state = clearRestoredRandomCursorSignal(match.state);
    }

    const result: CommitAuthoritativeCommandSuccessResult = {
        committed: false,
        stateIdAfter: match.stateID,
        gameOver: args.nextState.sys.gameover,
        restoredRandomCursor,
    };

    if (match.unloaded) {
        return result;
    }

    await args.persistState({
        G: match.state,
        _stateID: match.stateID,
        randomSeed: match.randomSeed,
        randomCursor: match.getRandomCursor(),
    });
    args.onCommandSucceeded?.(match.matchID, match.gameId, args.commandType);

    return {
        ...result,
        committed: true,
    };
}

function resolveRestoredRandomCursor(state: MatchState<unknown>): number | null {
    const restoredCursor = (state.sys?.undo as { restoredRandomCursor?: number } | undefined)
        ?.restoredRandomCursor;
    return typeof restoredCursor === 'number' && restoredCursor >= 0
        ? restoredCursor
        : null;
}

function clearRestoredRandomCursorSignal(state: MatchState<unknown>): MatchState<unknown> {
    return {
        ...state,
        sys: {
            ...state.sys,
            undo: {
                ...state.sys.undo,
                restoredRandomCursor: undefined,
            },
        },
    };
}
