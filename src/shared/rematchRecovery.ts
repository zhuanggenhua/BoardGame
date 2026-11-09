/** Request-only bearer secret, persisted by its creator before sending create. */
export interface RematchRecoveryRequest {
    nextMatchID: string;
    token: string;
}

export const REMATCH_RECOVERY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function parseRematchRecoveryRequest(value: unknown): RematchRecoveryRequest | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const { nextMatchID, token } = value as Record<string, unknown>;
    return typeof nextMatchID === 'string' && /^[A-Za-z0-9_-]{22}$/.test(nextMatchID)
        && typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
        ? { nextMatchID, token } : null;
}

export interface RecoveredRematch {
    matchID: string;
    ownerPlayerID: '0';
    ownerCredentials: string;
    ownerType: 'guest' | 'user';
    ownerKey: string;
}

/** Server-only receipt; clients use the request/result types, never this payload. */
export interface RematchRecoveryReceipt {
    sourceMatchID: string;
    tokenHash: string;
    issuedCredentialHash: string;
    ownerKey: string;
    ownerType: 'guest' | 'user';
    expiresAt: number;
}
