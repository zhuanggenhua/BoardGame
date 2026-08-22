import type { MatchState } from '../types';
import {
    buildAiProgressMarker,
    type ForceEndTurnStalledAiResolution,
    type OnlineAiRecoveryEngineConfig,
} from './onlineAiRecovery';
import type { OnlineAiCircuitBreaker } from './onlineAiCircuitBreaker';
import type { OnlineAiRepeatedRecoveryAttempt } from './onlineAiRepeatedRecoveryUnblockExecutor';
import { OnlineAiRecoveryRuntimeLedger } from './onlineAiRecoveryRuntimeLedger';
import { resolveOnlineAiWatchdogSchedulingDecision } from './onlineAiWatchdogScheduling';
import type { OnlineAiRecoveryTracker } from './onlineAiWatchdogTracker';

export type OnlineAiRecoveryControllerMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    stateID: number;
    engineConfig: OnlineAiRecoveryEngineConfig;
};

export type OnlineAiRecoveryControllerSeat = {
    type: string;
};

export type OnlineAiRecoveryForceUnblockResult = {
    handled: boolean;
    suppressionReason?: string;
};

export type OnlineAiRecoveryTickSummary = {
    launchedRecoveries: number;
};

export type OnlineAiRecoveryControllerHooks<TMatch extends OnlineAiRecoveryControllerMatch, TSeat extends OnlineAiRecoveryControllerSeat> = {
    getMatches: () => Iterable<TMatch>;
    pruneExpiredFeedbackCooldowns: (now: number) => void;
    buildSeatControllers: (match: TMatch) => Record<string, TSeat>;
    resolveCandidate: (
        match: TMatch,
        seatControllers: Record<string, TSeat>,
    ) => Promise<ForceEndTurnStalledAiResolution | null>;
    buildRecoveryFingerprint: (
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ) => string;
    resolveRecoveryTimeoutMs: (
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
    ) => number;
    tryForceUnblockRepeatedRecovery: (args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        repeatedAttemptKey: string;
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
        seatControllers: Record<string, TSeat>;
    }) => Promise<OnlineAiRecoveryForceUnblockResult>;
    reportRepeatedRecoverySuppressed: (args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        repeatedAttemptKey: string;
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
        suppressionReason?: string;
    }) => Promise<void>;
    runRecoverySequence: (args: {
        match: TMatch;
        tracker: OnlineAiRecoveryTracker;
        candidate: ForceEndTurnStalledAiResolution;
        progressMarker: string;
        seatControllers: Record<string, TSeat>;
    }) => Promise<void>;
};

export type OnlineAiRecoveryControllerConfig<TMatch extends OnlineAiRecoveryControllerMatch, TSeat extends OnlineAiRecoveryControllerSeat> = {
    ledger: OnlineAiRecoveryRuntimeLedger;
    circuitBreaker: OnlineAiCircuitBreaker;
    repeatedAttemptLimit: number;
    hooks: OnlineAiRecoveryControllerHooks<TMatch, TSeat>;
};

export class OnlineAiRecoveryController<TMatch extends OnlineAiRecoveryControllerMatch, TSeat extends OnlineAiRecoveryControllerSeat> {
    private readonly ledger: OnlineAiRecoveryRuntimeLedger;
    private readonly circuitBreaker: OnlineAiCircuitBreaker;
    private readonly repeatedAttemptLimit: number;
    private readonly hooks: OnlineAiRecoveryControllerHooks<TMatch, TSeat>;

    constructor(config: OnlineAiRecoveryControllerConfig<TMatch, TSeat>) {
        this.ledger = config.ledger;
        this.circuitBreaker = config.circuitBreaker;
        this.repeatedAttemptLimit = config.repeatedAttemptLimit;
        this.hooks = config.hooks;
    }

    async runTick(now = Date.now()): Promise<OnlineAiRecoveryTickSummary> {
        this.hooks.pruneExpiredFeedbackCooldowns(now);
        this.ledger.pruneOverlayResyncCooldowns(now);

        let launchedRecoveries = 0;
        for (const match of this.hooks.getMatches()) {
            const launched = await this.runTickForMatch(match, now);
            if (launched) {
                launchedRecoveries += 1;
            }
        }

        return { launchedRecoveries };
    }

    private async runTickForMatch(match: TMatch, now: number): Promise<boolean> {
        if (this.ledger.isInFlight(match.matchID)) {
            return false;
        }

        const seatControllers = this.hooks.buildSeatControllers(match);
        const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
        if (!hasAiSeat) {
            this.ledger.clearRecoveryProgress(match.matchID);
            this.circuitBreaker.clearMatch(match.matchID);
            return false;
        }
        for (const [playerId, controller] of Object.entries(seatControllers)) {
            if (controller.type === 'human') {
                this.circuitBreaker.clearSeat(match.matchID, playerId);
            }
        }

        const candidate = await this.hooks.resolveCandidate(match, seatControllers);
        if (!candidate) {
            this.ledger.clearRecoveryProgress(match.matchID);
            return false;
        }

        const progressMarker = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const recoveryFingerprint = this.hooks.buildRecoveryFingerprint(match, candidate, progressMarker);
        const trackerKey = `${candidate.playerId}:${candidate.reason}:${recoveryFingerprint}`;
        const repeatedAttemptKey = this.ledger.buildRepeatedAttemptKey(match.matchID, trackerKey);
        const repeatedAttempt = this.ledger.getRepeatedAttempt(repeatedAttemptKey);

        if (await this.handleCircuitBreaker({
            match,
            candidate,
            trackerKey,
            progressMarker,
            repeatedAttemptKey,
            repeatedAttempt,
            seatControllers,
        })) {
            return false;
        }

        if ((repeatedAttempt?.count ?? 0) >= this.repeatedAttemptLimit) {
            this.ledger.clearTracker(match.matchID);
            const forceUnblockResult = await this.hooks.tryForceUnblockRepeatedRecovery({
                match,
                candidate,
                trackerKey,
                progressMarker,
                repeatedAttemptKey,
                repeatedAttempt,
                seatControllers,
            });
            if (forceUnblockResult.handled) {
                return false;
            }
            await this.hooks.reportRepeatedRecoverySuppressed({
                match,
                candidate,
                trackerKey,
                progressMarker,
                repeatedAttemptKey,
                repeatedAttempt,
                suppressionReason: forceUnblockResult.suppressionReason,
            });
            return false;
        }

        const recoveryTimeoutMs = this.hooks.resolveRecoveryTimeoutMs(match, candidate);
        const suppressRecovery = candidate.reason === 'active-turn'
            && this.ledger.hasRecentOverlayResync({
                matchId: match.matchID,
                playerId: candidate.playerId,
                progressMarker,
                now,
            });
        const scheduling = resolveOnlineAiWatchdogSchedulingDecision({
            now,
            hasAiSeat: true,
            hasCandidate: true,
            trackerKey,
            recoveryTimeoutMs,
            suppressRecovery,
            currentTracker: this.ledger.getTracker(match.matchID),
        });
        if (scheduling.kind === 'clear-tracker') {
            this.ledger.clearRecoveryProgress(match.matchID);
            return false;
        }
        if (scheduling.trackerToStore) {
            this.ledger.setTracker(match.matchID, scheduling.trackerToStore);
        }
        if (scheduling.kind === 'skip') {
            return false;
        }

        scheduling.tracker.autoSubmittedAt = now;
        this.ledger.beginInFlight(match.matchID);
        void this.hooks.runRecoverySequence({
            match,
            tracker: scheduling.tracker,
            candidate,
            progressMarker,
            seatControllers,
        }).finally(() => {
            this.ledger.finishInFlight(match.matchID);
        });
        return true;
    }

    private async handleCircuitBreaker(args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        repeatedAttemptKey: string;
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
        seatControllers: Record<string, TSeat>;
    }): Promise<boolean> {
        const circuitSnapshot = this.circuitBreaker.getSnapshot(
            args.match.matchID,
            args.candidate.playerId,
        );
        if (!circuitSnapshot.tripped) {
            return false;
        }

        if (
            circuitSnapshot.awaitingFreshState
            && circuitSnapshot.safeUnblockStateID !== null
            && args.match.stateID > circuitSnapshot.safeUnblockStateID
        ) {
            const refreshedAdmission = this.circuitBreaker.admit({
                matchId: args.match.matchID,
                playerId: args.candidate.playerId,
                source: 'watchdog',
                stateID: args.match.stateID,
                expectedStateID: args.match.stateID,
            });
            return !refreshedAdmission.allowed;
        }

        if (!circuitSnapshot.safeUnblockUsed) {
            const safeUnblockResult = await this.hooks.tryForceUnblockRepeatedRecovery(args);
            return safeUnblockResult.handled;
        }

        return true;
    }
}
