import { randomUUID } from 'node:crypto';

/** 短暂保留提交前冻结的权威现场；令牌只能由同一对局、座位绑定。 */
export class FeedbackReplayStaging {
    private readonly entries = new Map<string, { matchId: string; playerId: string; data: string; expires: number }>();
    private readonly now: () => number;
    private readonly ttl: number;
    private readonly limit: number;
    constructor(now = () => Date.now(), ttl = 120_000, limit = 128) {
        this.now = now;
        this.ttl = ttl;
        this.limit = limit;
    }

    prepare(matchId: string, playerId: string, data: string): string {
        for (const [id, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(id);
        if (this.entries.size >= this.limit) throw new Error('feedback_capture_staging_full');
        const id = randomUUID();
        this.entries.set(id, { matchId, playerId, data, expires: this.now() + this.ttl });
        const timer = setTimeout(() => this.entries.delete(id), this.ttl);
        (timer as unknown as { unref?: () => void }).unref?.();
        return id;
    }

    get(id: string, matchId: string, playerId: string): string | undefined {
        const entry = this.entries.get(id);
        if (!entry || entry.expires <= this.now() || entry.matchId !== matchId || entry.playerId !== playerId) return undefined;
        return entry.data;
    }
}
