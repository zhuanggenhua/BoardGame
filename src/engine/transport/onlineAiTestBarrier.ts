/** 测试专用的有界同步点，用于在真实 AI 连续动作间验证重连。 */
type Barrier = {
    playerId: string;
    commandType: string;
    reached: boolean;
    release: () => void;
    waiting: Promise<void>;
    timer: ReturnType<typeof setTimeout>;
};

const barriers = new Map<string, Barrier>();
const MAX_HOLD_MS = 30_000;

export function armOnlineAiTestBarrier(matchId: string, playerId: string, commandType: string): void {
    if (process.env.NODE_ENV !== 'test') throw new Error('AI test barrier is available only in test');
    const key = JSON.stringify([matchId, playerId]);
    if (barriers.has(key)) throw new Error('AI test barrier already armed');
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const timer = setTimeout(() => releaseOnlineAiTestBarrier(matchId, playerId), MAX_HOLD_MS);
    timer.unref();
    barriers.set(key, { playerId, commandType, reached: false, release, waiting, timer });
}

export function getOnlineAiTestBarrier(matchId: string, playerId?: string): { reached: boolean } | null {
    const barrier = playerId ? barriers.get(JSON.stringify([matchId, playerId])) : [...barriers.entries()].find(([key]) => JSON.parse(key)[0] === matchId)?.[1];
    return barrier ? { reached: barrier.reached } : null;
}

export function releaseOnlineAiTestBarrier(matchId: string, playerId?: string): void {
    for (const [key, barrier] of barriers) {
        const [barrierMatch, barrierPlayer] = JSON.parse(key) as string[];
        if (barrierMatch !== matchId || (playerId && barrierPlayer !== playerId)) continue;
        barriers.delete(key);
        clearTimeout(barrier.timer);
        barrier.release();
    }
}

export async function waitForOnlineAiTestBarrier(matchId: string, playerId: string, commandTypes: string[]): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return;
    const barrier = barriers.get(JSON.stringify([matchId, playerId]));
    if (!barrier || (barrier.commandType !== '*' && !commandTypes.includes(barrier.commandType))) return;
    barrier.reached = true;
    await barrier.waiting;
}
