import { AUTH_API_URL, IS_DEV_API_DISABLED } from '../config/server';
import { readLocalStorageItem, writeLocalStorageItem } from './browserStorage';

let refreshInFlight: Promise<string | null> | null = null;

async function requestRefresh(): Promise<string | null> {
    if (IS_DEV_API_DISABLED) return null;

    try {
        const response = await fetch(`${AUTH_API_URL}/refresh`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) return null;

        const payload = await response.json();
        const token = payload?.success && typeof payload.data?.token === 'string'
            ? payload.data.token as string
            : null;
        if (token) writeLocalStorageItem('auth_token', token);
        return token;
    } catch {
        return null;
    }
}

/** Same-tab single flight plus a browser-wide Web Lock when supported. */
function isAccessTokenUsable(token: string | null): token is string {
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload?.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
}

export function refreshAccessToken(observedToken = readLocalStorageItem('auth_token')): Promise<string | null> {
    if (refreshInFlight) return refreshInFlight;

    const lockManager = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const request = lockManager
        ? lockManager.request('boardgame-auth-refresh', () => {
            const latestToken = readLocalStorageItem('auth_token');
            if (latestToken !== observedToken && isAccessTokenUsable(latestToken)) {
                return Promise.resolve(latestToken);
            }
            return requestRefresh();
        })
        : requestRefresh();

    refreshInFlight = request.finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}
