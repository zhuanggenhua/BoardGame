import type { MatchState } from '../types';
import type { StoredMatchState } from './storage';

const ALLOWED_INJECT_STATE_ENVS = new Set(['test', 'development']);

export type MatchStateInjectionCoordinatorMatch = {
    matchID: string;
    state: MatchState<unknown>;
    stateID: number;
    randomSeed: string;
    getRandomCursor: () => number;
    lastBroadcastedViews: Map<string, unknown>;
};

export type MatchStateInjectionCoordinatorHooks<TMatch extends MatchStateInjectionCoordinatorMatch> = {
    getOrLoadMatch: (matchID: string) => Promise<TMatch | undefined>;
    persistState: (matchID: string, state: StoredMatchState) => Promise<void>;
    clearAllBaselines: (match: TMatch) => void;
    broadcast: (match: TMatch) => void;
    getNodeEnv: () => string | undefined;
    logInjected: (matchID: string) => void;
};

export type MatchStateInjectionCoordinatorConfig<TMatch extends MatchStateInjectionCoordinatorMatch> = {
    hooks: MatchStateInjectionCoordinatorHooks<TMatch>;
};

export const canInjectStateInCurrentEnv = (nodeEnv: string | undefined): boolean =>
    typeof nodeEnv === 'string' && ALLOWED_INJECT_STATE_ENVS.has(nodeEnv);

function assertValidInjectedState(state: MatchState<unknown>): void {
    if (!state || typeof state !== 'object') {
        throw new Error('Invalid state: must be an object');
    }
    if (!state.core || typeof state.core !== 'object') {
        throw new Error('Invalid state: missing or invalid core');
    }
    if (!state.sys || typeof state.sys !== 'object') {
        throw new Error('Invalid state: missing or invalid sys');
    }
}

export class MatchStateInjectionCoordinator<TMatch extends MatchStateInjectionCoordinatorMatch> {
    private readonly hooks: MatchStateInjectionCoordinatorHooks<TMatch>;

    constructor(config: MatchStateInjectionCoordinatorConfig<TMatch>) {
        this.hooks = config.hooks;
    }

    async injectState(matchID: string, state: MatchState<unknown>): Promise<void> {
        if (!canInjectStateInCurrentEnv(this.hooks.getNodeEnv())) {
            throw new Error('injectState is only available in test/development environment');
        }

        assertValidInjectedState(state);

        const match = await this.hooks.getOrLoadMatch(matchID);
        if (!match) {
            throw new Error(`Match ${matchID} not found`);
        }

        const nextStateID = match.stateID + 1;
        const storedState: StoredMatchState = {
            G: state,
            _stateID: nextStateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor(),
        };

        await this.hooks.persistState(matchID, storedState);

        match.state = state;
        match.stateID = nextStateID;
        this.hooks.clearAllBaselines(match);
        this.hooks.broadcast(match);
        this.hooks.logInjected(matchID);
    }
}
