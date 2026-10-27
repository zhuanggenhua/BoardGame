// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ start: vi.fn(), update: vi.fn() }));
vi.mock('../../../api/external-games', () => ({ startExternalSession: api.start, updateExternalSession: api.update }));
import { useExternalPlay } from '../useExternalPlay';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); api.start.mockResolvedValue({ sessionId: 'session-1' }); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('外链游玩会话', () => {
    it('断网后按原顺序重发前台片段，隐藏期间不计时', async () => {
        let visibility: DocumentVisibilityState = 'visible';
        vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
        api.update.mockRejectedValue(new Error('offline'));
        const hook = renderHook(() => useExternalPlay('external-test', 'token', true));
        await act(async () => { await Promise.resolve(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
        expect(api.update).toHaveBeenCalledWith('token', 'session-1', expect.objectContaining({ sequence: 1, active: true, elapsedMs: 10_000, offsetMs: 10_000 }));
        await act(async () => { await vi.advanceTimersByTimeAsync(5_000); visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
        api.update.mockResolvedValue({ accepted: true });
        await act(async () => { window.dispatchEvent(new Event('online')); for (let i = 0; i < 6; i++) await Promise.resolve(); });
        expect(api.update).toHaveBeenCalledWith('token', 'session-1', expect.objectContaining({ sequence: 2, active: false, elapsedMs: 5_000, offsetMs: 15_000 }));
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(hook.result.current.seconds).toBe(15);
        hook.unmount();
    });
});
