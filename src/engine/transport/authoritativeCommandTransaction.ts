import { cloneSnapshotState } from '../systems/UndoSystem';
import type { MatchState, RandomFn } from '../types';
import type { MatchMetadata, StoredMatchState } from './storage';
import { createTrackedRandom } from './trackedRandom';

export type DeferredAuthoritativeEffect<TMatch> = (committedMatch: TMatch, isFinalCommand: boolean) => Promise<void>;

type TransactionMatch = {
    matchID: string;
    state: MatchState<unknown>;
    metadata: MatchMetadata;
    stateID: number;
    randomSeed: string;
    random: RandomFn;
    getRandomCursor: () => number;
    lastCommandPlayerId: string | null;
    lastCommandFailureReason: string | null;
    lastBroadcastedViews: Map<string, unknown>;
    unloaded: boolean;
};

/** Stage a business action privately; publish state and effects only after storage accepts it. */
export async function executeAuthoritativeTransaction<TMatch extends TransactionMatch, TResult>(args: {
    match: TMatch;
    execute: (workingMatch: TMatch, effects: DeferredAuthoritativeEffect<TMatch>[]) => Promise<TResult>;
    succeeded: (result: TResult) => boolean;
    persistState: (state: StoredMatchState) => Promise<void>;
    onEffectError: (error: unknown) => void;
}): Promise<TResult> {
    const { match } = args;
    const stateIDBefore = match.stateID;
    const tracked = createTrackedRandom(match.randomSeed, match.getRandomCursor());
    const working: TMatch = {
        ...match,
        state: cloneSnapshotState(match.state),
        metadata: cloneSnapshotState(match.metadata),
        random: tracked.random,
        getRandomCursor: tracked.getCursor,
        lastBroadcastedViews: new Map(),
    };
    const effects: DeferredAuthoritativeEffect<TMatch>[] = [];
    const result = await args.execute(working, effects);
    if (!args.succeeded(result)) {
        match.lastCommandFailureReason = working.lastCommandFailureReason;
        return result;
    }
    if (match.unloaded) throw new Error('match_unloaded');
    if (match.stateID !== stateIDBefore) throw new Error('stale_batch');

    await args.persistState({
        G: working.state,
        _stateID: working.stateID,
        randomSeed: working.randomSeed,
        randomCursor: working.getRandomCursor(),
    });
    if (match.unloaded) throw new Error('match_unloaded');
    match.state = working.state;
    match.stateID = working.stateID;
    match.random = working.random;
    match.getRandomCursor = working.getRandomCursor;
    match.lastCommandPlayerId = working.lastCommandPlayerId;
    match.lastCommandFailureReason = null;
    match.lastBroadcastedViews.clear();
    // Metadata may have changed while persistence awaited (e.g. a reconnect).
    // Terminal effects update the live metadata; never replace it with the draft.
    for (const [index, effect] of effects.entries()) {
        try {
            await effect(match, index === effects.length - 1);
        } catch (error) {
            // The state is durable. An effect failure cannot reject or roll it back.
            args.onEffectError(error);
        }
    }
    return result;
}
