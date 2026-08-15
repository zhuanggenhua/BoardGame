import type { OnlineAiClientTransportDiagnostics } from './protocol';

export type OnlineAiCircuitSource = 'client' | 'watchdog' | 'safe-unblock';

export type OnlineAiCircuitBlockReason =
    | 'circuit-open'
    | 'stale-epoch'
    | 'safe-unblock-not-active';

export type OnlineAiCircuitFailure = {
    commandType: string;
    reason: string;
    expectedStateID?: number | null;
    stateID: number;
    progressMarker?: string | null;
    commandSummary?: string | null;
    attemptKey?: string | null;
    clientTransport?: OnlineAiClientTransportDiagnostics | null;
    source: OnlineAiCircuitSource;
    at: number;
};

export type OnlineAiCircuitSnapshot = {
    matchId: string;
    playerId: string;
    windowStartedAt: number;
    windowMs: number;
    failureBudget: number;
    attemptCount: number;
    failureCount: number;
    staleStateFailureCount: number;
    recoveryCount: number;
    tripped: boolean;
    trippedAt: number | null;
    safeUnblockUsed: boolean;
    safeUnblockInFlight: boolean;
    awaitingFreshState: boolean;
    safeUnblockStateID: number | null;
    invalidatedExpectedStateID: number | null;
    queueLength: number;
    recentFailures: OnlineAiCircuitFailure[];
};

export type OnlineAiCircuitAdmission = {
    allowed: boolean;
    reason?: OnlineAiCircuitBlockReason;
    snapshot: OnlineAiCircuitSnapshot;
};

export type OnlineAiCircuitBreakerConfig = {
    windowMs?: number;
    failureBudget?: number;
    maxRecentFailures?: number;
    now?: () => number;
};

type MutableCircuitState = Omit<OnlineAiCircuitSnapshot, 'matchId' | 'playerId' | 'windowMs' | 'failureBudget'> & {
    reportConsumed: boolean;
};

const DEFAULT_WINDOW_MS = 30_000;
const DEFAULT_FAILURE_BUDGET = 6;
const DEFAULT_MAX_RECENT_FAILURES = 8;

const normalizePositiveInteger = (value: number | undefined, fallback: number): number => (
    Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value!) : fallback
);

export class OnlineAiCircuitBreaker {
    private readonly windowMs: number;
    private readonly failureBudget: number;
    private readonly maxRecentFailures: number;
    private readonly now: () => number;
    private readonly states = new Map<string, MutableCircuitState>();

    constructor(config: OnlineAiCircuitBreakerConfig = {}) {
        this.windowMs = normalizePositiveInteger(config.windowMs, DEFAULT_WINDOW_MS);
        this.failureBudget = normalizePositiveInteger(config.failureBudget, DEFAULT_FAILURE_BUDGET);
        this.maxRecentFailures = normalizePositiveInteger(config.maxRecentFailures, DEFAULT_MAX_RECENT_FAILURES);
        this.now = config.now ?? Date.now;
    }

    getSnapshot(matchId: string, playerId: string, at = this.now()): OnlineAiCircuitSnapshot {
        return this.snapshot(matchId, playerId, this.getState(matchId, playerId, at));
    }

    admit(args: {
        matchId: string;
        playerId: string;
        source: OnlineAiCircuitSource;
        expectedStateID?: number | null;
        stateID: number;
        at?: number;
    }): OnlineAiCircuitAdmission {
        const at = args.at ?? this.now();
        const state = this.getState(args.matchId, args.playerId, at);

        if (args.source === 'safe-unblock') {
            return {
                allowed: state.safeUnblockInFlight,
                reason: state.safeUnblockInFlight ? undefined : 'safe-unblock-not-active',
                snapshot: this.snapshot(args.matchId, args.playerId, state),
            };
        }

        if (state.tripped) {
            const freshStateAfterSafeUnblock = state.awaitingFreshState
                && state.safeUnblockStateID !== null
                && args.stateID > state.safeUnblockStateID
                && typeof args.expectedStateID === 'number'
                && args.expectedStateID === args.stateID;
            if (freshStateAfterSafeUnblock) {
                state.tripped = false;
                state.awaitingFreshState = false;
            } else {
                return {
                    allowed: false,
                    reason: 'circuit-open',
                    snapshot: this.snapshot(args.matchId, args.playerId, state),
                };
            }
        }

        if (
            state.invalidatedExpectedStateID !== null
            && typeof args.expectedStateID === 'number'
            && state.invalidatedExpectedStateID === args.expectedStateID
        ) {
            return {
                allowed: false,
                reason: 'stale-epoch',
                snapshot: this.snapshot(args.matchId, args.playerId, state),
            };
        }

        state.attemptCount += 1;
        return {
            allowed: true,
            snapshot: this.snapshot(args.matchId, args.playerId, state),
        };
    }

    recordFailure(args: {
        matchId: string;
        playerId: string;
        failure: Omit<OnlineAiCircuitFailure, 'at'> & { at?: number };
    }): OnlineAiCircuitSnapshot {
        const at = args.failure.at ?? this.now();
        const state = this.getState(args.matchId, args.playerId, at);
        const failure: OnlineAiCircuitFailure = { ...args.failure, at };
        state.failureCount += 1;
        if (failure.reason === 'stale_state') {
            state.staleStateFailureCount += 1;
            if (typeof failure.expectedStateID === 'number') {
                state.invalidatedExpectedStateID = failure.expectedStateID;
            }
        }
        state.recentFailures = [...state.recentFailures, failure].slice(-this.maxRecentFailures);
        if (state.failureCount >= this.failureBudget && !state.tripped) {
            state.tripped = true;
            state.trippedAt = at;
        }
        return this.snapshot(args.matchId, args.playerId, state);
    }

    beginSafeUnblock(matchId: string, playerId: string, at = this.now()): boolean {
        const state = this.getState(matchId, playerId, at);
        if (!state.tripped || state.safeUnblockUsed || state.safeUnblockInFlight) {
            return false;
        }
        state.safeUnblockUsed = true;
        state.safeUnblockInFlight = true;
        state.recoveryCount += 1;
        return true;
    }

    finishSafeUnblock(args: {
        matchId: string;
        playerId: string;
        success: boolean;
        stateID: number;
        at?: number;
    }): OnlineAiCircuitSnapshot {
        const state = this.getState(args.matchId, args.playerId, args.at ?? this.now());
        state.safeUnblockInFlight = false;
        if (args.success) {
            state.awaitingFreshState = true;
            state.safeUnblockStateID = args.stateID;
        }
        return this.snapshot(args.matchId, args.playerId, state);
    }

    setQueueLength(matchId: string, playerId: string, queueLength: number, at = this.now()): void {
        this.getState(matchId, playerId, at).queueLength = Math.max(0, Math.floor(queueLength));
    }

    markCircuitReportConsumed(matchId: string, playerId: string, at = this.now()): boolean {
        const state = this.getState(matchId, playerId, at);
        if (state.reportConsumed) {
            return false;
        }
        state.reportConsumed = true;
        return true;
    }

    clearMatch(matchId: string): void {
        for (const key of this.states.keys()) {
            if (key.startsWith(`${matchId}:`)) {
                this.states.delete(key);
            }
        }
    }

    clearSeat(matchId: string, playerId: string): void {
        this.states.delete(this.key(matchId, playerId));
    }

    private key(matchId: string, playerId: string): string {
        return `${matchId}:${playerId}`;
    }

    private getState(matchId: string, playerId: string, at: number): MutableCircuitState {
        const key = this.key(matchId, playerId);
        const previous = this.states.get(key);
        if (previous && at - previous.windowStartedAt < this.windowMs) {
            return previous;
        }

        const next: MutableCircuitState = {
            windowStartedAt: at,
            attemptCount: 0,
            failureCount: 0,
            staleStateFailureCount: 0,
            recoveryCount: 0,
            tripped: false,
            trippedAt: null,
            safeUnblockUsed: false,
            safeUnblockInFlight: false,
            awaitingFreshState: false,
            safeUnblockStateID: null,
            invalidatedExpectedStateID: null,
            queueLength: 0,
            recentFailures: [],
            reportConsumed: false,
        };
        this.states.set(key, next);
        return next;
    }

    private snapshot(matchId: string, playerId: string, state: MutableCircuitState): OnlineAiCircuitSnapshot {
        const { reportConsumed: _reportConsumed, ...visibleState } = state;
        return {
            matchId,
            playerId,
            windowMs: this.windowMs,
            failureBudget: this.failureBudget,
            ...visibleState,
            recentFailures: visibleState.recentFailures.map((failure) => ({ ...failure })),
        };
    }
}
