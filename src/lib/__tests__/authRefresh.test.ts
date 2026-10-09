/* @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshAccessToken } from '../authRefresh';

describe('authRefresh', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        Reflect.deleteProperty(navigator, 'locks');
    });

    it('同标签页并发请求共用一次刷新，并在浏览器支持时使用跨标签页锁', async () => {
        let releaseFetch!: (response: Response) => void;
        const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
            releaseFetch = resolve;
        }));
        const lockRequest = vi.fn((_name: string, callback: () => Promise<unknown>) => callback());
        vi.stubGlobal('fetch', fetchMock);
        Object.defineProperty(navigator, 'locks', {
            configurable: true,
            value: { request: lockRequest },
        });

        const first = refreshAccessToken();
        const second = refreshAccessToken();
        expect(second).toBe(first);
        expect(lockRequest).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        releaseFetch(new Response(JSON.stringify({ success: true, data: { token: 'fresh-access-token' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        await expect(first).resolves.toBe('fresh-access-token');
    });
});
