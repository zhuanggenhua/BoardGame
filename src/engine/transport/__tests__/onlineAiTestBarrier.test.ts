import { afterEach, describe, expect, it, vi } from 'vitest';
import { armOnlineAiTestBarrier, getOnlineAiTestBarrier, releaseOnlineAiTestBarrier, waitForOnlineAiTestBarrier } from '../onlineAiTestBarrier';

afterEach(() => {
    releaseOnlineAiTestBarrier('match');
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

describe('在线 AI 测试同步点', () => {
    it('只暂停指定对局、席位与命令，释放后继续', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        armOnlineAiTestBarrier('match', '1', 'DISCARD_CARD');
        await waitForOnlineAiTestBarrier('other', '1', ['DISCARD_CARD']);
        await waitForOnlineAiTestBarrier('match', '0', ['DISCARD_CARD']);
        await waitForOnlineAiTestBarrier('match', '1', ['TAKE_FROM_DISCARD']);
        expect(getOnlineAiTestBarrier('match')).toEqual({ reached: false });
        let finished = false;
        const waiting = waitForOnlineAiTestBarrier('match', '1', ['DISCARD_CARD']).then(() => { finished = true; });
        expect(getOnlineAiTestBarrier('match')).toEqual({ reached: true });
        expect(finished).toBe(false);
        releaseOnlineAiTestBarrier('match');
        await waiting;
        expect(finished).toBe(true);
        expect(getOnlineAiTestBarrier('match')).toBeNull();
    });

    it('超时自动释放，非测试环境不能启用', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.useFakeTimers();
        armOnlineAiTestBarrier('match', '1', 'DISCARD_CARD');
        const waiting = waitForOnlineAiTestBarrier('match', '1', ['DISCARD_CARD']);
        await vi.advanceTimersByTimeAsync(30_000);
        await waiting;
        expect(getOnlineAiTestBarrier('match')).toBeNull();
        vi.stubEnv('NODE_ENV', 'production');
        expect(() => armOnlineAiTestBarrier('match', '1', 'DISCARD_CARD')).toThrow();
    });

    it('同一对局不同席位独立暂停和释放，通配命令不影响其他席位', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        armOnlineAiTestBarrier('match', '2', '*');
        armOnlineAiTestBarrier('match', '5', '*');
        const first = waitForOnlineAiTestBarrier('match', '2', ['DRAW_FROM_DECK']);
        expect(getOnlineAiTestBarrier('match', '2')?.reached).toBe(true);
        expect(getOnlineAiTestBarrier('match', '5')?.reached).toBe(false);
        releaseOnlineAiTestBarrier('match', '2');
        await first;
        expect(getOnlineAiTestBarrier('match', '5')).toEqual({ reached: false });
        releaseOnlineAiTestBarrier('match', '5');
    });
});
