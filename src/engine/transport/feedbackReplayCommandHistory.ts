import type { MatchState } from '../types';
import { cloneSnapshotState } from '../systems/UndoSystem';
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
    /** 原始状态包含不可序列化值时，压缩回放只能用于部分诊断。 */
    stateSnapshotPartial?: boolean;
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
            // 前后状态通常共享未变化的子树；一次克隆保留共享并避免重复复制。
            const commandPayload = structuredClone(record.commandPayload);
            let stateSnapshotPartial = false;
            let states: { stateBefore: MatchState<unknown>; stateAfter: MatchState<unknown> };
            try {
                states = structuredClone({ stateBefore: record.stateBefore, stateAfter: record.stateAfter });
            } catch {
                // 交互选项生成器可以是函数；保留内存快照，同时显式标记持久回放不完整。
                states = cloneSnapshotState({ stateBefore: record.stateBefore, stateAfter: record.stateAfter });
                stateSnapshotPartial = true;
            }
            frozenRecord = {
                ...record,
                commandPayload,
                ...states,
                ...(stateSnapshotPartial ? { stateSnapshotPartial: true } : {}),
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
