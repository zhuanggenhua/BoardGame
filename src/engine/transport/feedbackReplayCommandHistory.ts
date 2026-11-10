import type { MatchState } from '../types';
import type { FeedbackReplayTriggerReference } from './feedbackReplayCaptureTypes';

export type FeedbackReplayCommandRecord = FeedbackReplayTriggerReference & {
    matchId: string;
    gameId: string;
    commandPayload: unknown;
    stateIdAfter: number;
    randomSeed?: string;
    randomCursorAfter?: number;
    stateBefore: MatchState<unknown>;
    stateAfter: MatchState<unknown>;
    capturedAt: number;
};

/** Recent authoritative command boundaries let a first-trigger report replay the exact action. */
export class FeedbackReplayCommandHistory {
    private readonly matches = new Map<string, FeedbackReplayCommandRecord[]>();
    private readonly now: () => number;
    private readonly ttlMs: number;
    private readonly commandsPerMatch: number;
    private readonly matchLimit: number;

    constructor(now = () => Date.now(), ttlMs = 120_000, commandsPerMatch = 3, matchLimit = 128) {
        this.now = now;
        this.ttlMs = ttlMs;
        this.commandsPerMatch = commandsPerMatch;
        this.matchLimit = matchLimit;
    }

    record(record: Omit<FeedbackReplayCommandRecord, 'capturedAt'>): boolean {
        this.pruneExpired();
        const entries = this.matches.get(record.matchId) ?? [];
        let frozenRecord: FeedbackReplayCommandRecord;
        try {
            frozenRecord = {
                ...record,
                commandPayload: structuredClone(record.commandPayload),
                stateBefore: structuredClone(record.stateBefore),
                stateAfter: structuredClone(record.stateAfter),
                capturedAt: this.now(),
            };
        } catch {
            return false;
        }
        entries.push(frozenRecord);
        if (entries.length > this.commandsPerMatch) entries.splice(0, entries.length - this.commandsPerMatch);
        this.matches.delete(record.matchId);
        this.matches.set(record.matchId, entries);
        while (this.matches.size > this.matchLimit) {
            const oldestMatchId = this.matches.keys().next().value as string | undefined;
            if (!oldestMatchId) break;
            this.matches.delete(oldestMatchId);
        }
        return true;
    }

    find(matchId: string, playerId: string, reference: FeedbackReplayTriggerReference): FeedbackReplayCommandRecord | undefined {
        this.pruneExpired();
        const entries = this.matches.get(matchId);
        if (!entries) return undefined;
        return [...entries].reverse().find((entry) => (
            entry.playerId === playerId
            && entry.playerId === reference.playerId
            && entry.commandType === reference.commandType
            && entry.stateIdBefore === reference.stateIdBefore
            && (reference.randomCursorBefore === undefined || entry.randomCursorBefore === reference.randomCursorBefore)
        ));
    }

    private pruneExpired(): void {
        const threshold = this.now() - this.ttlMs;
        for (const [matchId, entries] of this.matches) {
            const recent = entries.filter((entry) => entry.capturedAt > threshold);
            if (recent.length === 0) this.matches.delete(matchId);
            else if (recent.length !== entries.length) this.matches.set(matchId, recent);
        }
    }
}
