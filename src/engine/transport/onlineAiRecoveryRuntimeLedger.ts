import type { OnlineAiRepeatedRecoveryAttempt } from './onlineAiRepeatedRecoveryUnblockExecutor';
import type { OnlineAiRecoveryTracker } from './onlineAiWatchdogTracker';

const DEFAULT_OVERLAY_RESYNC_COOLDOWN_MS = 1_500;

export type OnlineAiOverlayResyncRequest = {
    matchId: string;
    playerId: string;
    blockedKey: string;
    progressMarker: string;
    now?: number;
};

export class OnlineAiRecoveryRuntimeLedger {
    private readonly recoveryTrackers = new Map<string, OnlineAiRecoveryTracker>();
    private readonly repeatedRecoveryAttempts = new Map<string, OnlineAiRepeatedRecoveryAttempt>();
    private readonly overlayResyncCooldowns = new Map<string, number>();
    private readonly recoveryInFlight = new Set<string>();

    constructor(
        private readonly overlayResyncCooldownMs = DEFAULT_OVERLAY_RESYNC_COOLDOWN_MS,
    ) {}

    clearMatch(matchId: string): void {
        this.clearTracker(matchId);
        this.finishInFlight(matchId);
        this.clearRepeatedAttemptsForMatch(matchId);
        this.clearOverlayResyncCooldownsForMatch(matchId);
    }

    isInFlight(matchId: string): boolean {
        return this.recoveryInFlight.has(matchId);
    }

    beginInFlight(matchId: string): void {
        this.recoveryInFlight.add(matchId);
    }

    finishInFlight(matchId: string): void {
        this.recoveryInFlight.delete(matchId);
    }

    getTracker(matchId: string): OnlineAiRecoveryTracker | undefined {
        return this.recoveryTrackers.get(matchId);
    }

    hasTracker(matchId: string): boolean {
        return this.recoveryTrackers.has(matchId);
    }

    setTracker(matchId: string, tracker: OnlineAiRecoveryTracker): void {
        this.recoveryTrackers.set(matchId, tracker);
    }

    clearTracker(matchId: string): void {
        this.recoveryTrackers.delete(matchId);
    }

    clearRecoveryProgress(matchId: string): void {
        this.clearTracker(matchId);
        this.clearRepeatedAttemptsForMatch(matchId);
    }

    buildRepeatedAttemptKey(matchId: string, trackerKey: string): string {
        return `${matchId}:${trackerKey}`;
    }

    getRepeatedAttempt(repeatedAttemptKey: string): OnlineAiRepeatedRecoveryAttempt | undefined {
        return this.repeatedRecoveryAttempts.get(repeatedAttemptKey);
    }

    recordRepeatedAttempt(
        matchId: string,
        trackerKey: string,
        now = Date.now(),
    ): OnlineAiRepeatedRecoveryAttempt {
        const key = this.buildRepeatedAttemptKey(matchId, trackerKey);
        const previous = this.repeatedRecoveryAttempts.get(key);
        const next: OnlineAiRepeatedRecoveryAttempt = {
            count: (previous?.count ?? 0) + 1,
            lastAttemptAt: now,
            reported: previous?.reported ?? false,
        };
        this.repeatedRecoveryAttempts.set(key, next);
        return next;
    }

    markRepeatedAttemptReported(
        repeatedAttemptKey: string,
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined,
        fallbackCount: number,
        now = Date.now(),
    ): OnlineAiRepeatedRecoveryAttempt {
        const next: OnlineAiRepeatedRecoveryAttempt = {
            count: repeatedAttempt?.count ?? fallbackCount,
            lastAttemptAt: now,
            reported: true,
        };
        this.repeatedRecoveryAttempts.set(repeatedAttemptKey, next);
        return next;
    }

    clearRepeatedAttemptsForMatch(matchId: string): void {
        const prefix = `${matchId}:`;
        for (const key of this.repeatedRecoveryAttempts.keys()) {
            if (key.startsWith(prefix)) {
                this.repeatedRecoveryAttempts.delete(key);
            }
        }
    }

    pruneOverlayResyncCooldowns(now = Date.now()): void {
        for (const [key, expiresAt] of this.overlayResyncCooldowns.entries()) {
            if (expiresAt <= now) {
                this.overlayResyncCooldowns.delete(key);
            }
        }
    }

    markOverlayResyncRequested(args: OnlineAiOverlayResyncRequest): boolean {
        const now = args.now ?? Date.now();
        const cooldownKey = this.buildOverlayResyncCooldownKey(args);
        const cooldownUntil = this.overlayResyncCooldowns.get(cooldownKey) ?? 0;
        if (cooldownUntil > now) {
            return false;
        }

        this.overlayResyncCooldowns.set(cooldownKey, now + this.overlayResyncCooldownMs);
        return true;
    }

    hasRecentOverlayResync(args: {
        matchId: string;
        playerId: string;
        progressMarker: string;
        now?: number;
    }): boolean {
        const now = args.now ?? Date.now();
        const keySuffix = `:${args.progressMarker}`;
        for (const [cooldownKey, expiresAt] of this.overlayResyncCooldowns.entries()) {
            if (expiresAt <= now) {
                continue;
            }
            if (!cooldownKey.startsWith(`${args.matchId}:${args.playerId}:`)) {
                continue;
            }
            if (!cooldownKey.endsWith(keySuffix)) {
                continue;
            }
            return true;
        }
        return false;
    }

    getOverlayResyncCooldownEntries(): Array<[string, number]> {
        return Array.from(this.overlayResyncCooldowns.entries());
    }

    getOverlayResyncCooldownKeys(): string[] {
        return Array.from(this.overlayResyncCooldowns.keys());
    }

    getOverlayResyncCooldownExpiresAt(cooldownKey: string): number | undefined {
        return this.overlayResyncCooldowns.get(cooldownKey);
    }

    private buildOverlayResyncCooldownKey(args: OnlineAiOverlayResyncRequest): string {
        return `${args.matchId}:${args.playerId}:${args.blockedKey}:${args.progressMarker}`;
    }

    private clearOverlayResyncCooldownsForMatch(matchId: string): void {
        const prefix = `${matchId}:`;
        for (const key of this.overlayResyncCooldowns.keys()) {
            if (key.startsWith(prefix)) {
                this.overlayResyncCooldowns.delete(key);
            }
        }
    }
}
