/* @vitest-environment happy-dom */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../contexts/AuthContext';
import { useTokenRefresh } from '../useTokenRefresh';

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

const toBase64Url = (value: string) => (
    btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
);

const createToken = (expOffsetSeconds: number) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload = {
        userId: 'u1',
        username: 'alice',
        iat: nowSeconds - 60,
        exp: nowSeconds + expOffsetSeconds,
    };
    return [
        toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
        toBase64Url(JSON.stringify(payload)),
        'signature',
    ].join('.');
};

describe('useTokenRefresh', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('启动时本地没有 token 也会尝试用 refresh cookie 续签', async () => {
        const setTokenDirect = vi.fn();
        const logout = vi.fn();
        const refreshedToken = createToken(60 * 60 * 24 * 30);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: { token: refreshedToken } }),
        });
        vi.stubGlobal('fetch', fetchMock);
        mockedUseAuth.mockReturnValue({
            token: null,
            setTokenDirect,
            logout,
            isLoading: false,
        } as ReturnType<typeof useAuth>);

        renderHook(() => useTokenRefresh());

        await waitFor(() => expect(setTokenDirect).toHaveBeenCalledWith(refreshedToken));
        expect(localStorage.getItem('auth_token')).toBe(refreshedToken);
        expect(logout).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledWith('/auth/refresh', {
            method: 'POST',
            credentials: 'include',
        });
    });

    it('本地 token 已过期时优先 refresh，失败后才登出', async () => {
        const expiredToken = createToken(-60);
        const refreshedToken = createToken(60 * 60 * 24 * 30);
        localStorage.setItem('auth_token', expiredToken);
        const setTokenDirect = vi.fn();
        const logout = vi.fn();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: { token: refreshedToken } }),
        }));
        mockedUseAuth.mockReturnValue({
            token: expiredToken,
            setTokenDirect,
            logout,
            isLoading: false,
        } as ReturnType<typeof useAuth>);

        renderHook(() => useTokenRefresh());

        await waitFor(() => expect(setTokenDirect).toHaveBeenCalledWith(refreshedToken));
        expect(localStorage.getItem('auth_token')).toBe(refreshedToken);
        expect(logout).not.toHaveBeenCalled();
    });
});
