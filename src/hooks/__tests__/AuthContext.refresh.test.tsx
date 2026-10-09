/* @vitest-environment happy-dom */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

vi.mock('../../lib/i18n', () => ({ default: { language: 'en' } }));

const toBase64Url = (value: string) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
const makeAccessToken = () => [
    toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    toBase64Url(JSON.stringify({ userId: 'user-1', username: 'alice', iat: 1, exp: 4_000_000_000 })),
    'signature',
].join('.');

function AuthProbe() {
    const { token, user } = useAuth();
    return <div>{token ? 'token-ready' : 'no-token'}:{user?.username ?? 'no-user'}</div>;
}

describe('AuthContext startup refresh', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('过期 Access 的 /me 401 会先续签，再用新 token 重试并恢复用户', async () => {
        localStorage.setItem('auth_token', 'expired-access-token');
        const freshToken = makeAccessToken();
        let meAttempts = 0;
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/me')) {
                meAttempts += 1;
                if (meAttempts === 1) return new Response('', { status: 401 });
                return new Response(JSON.stringify({
                    user: {
                        id: 'user-1',
                        username: 'alice',
                        role: 'user',
                        banned: false,
                        feedbackPoints: 0,
                    },
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            if (url.endsWith('/refresh')) {
                return new Response(JSON.stringify({ success: true, data: { token: freshToken } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`Unexpected request: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<AuthProvider><AuthProbe /></AuthProvider>);

        await waitFor(() => expect(screen.getByText('token-ready:alice')).toBeTruthy());
        expect(localStorage.getItem('auth_token')).toBe(freshToken);
        expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['/auth/me', '/auth/refresh', '/auth/me']);
    });
});
