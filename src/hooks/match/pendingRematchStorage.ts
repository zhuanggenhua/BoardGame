import { getLocalStorage } from '../../lib/browserStorage';
import { parseRematchRecoveryRequest, type RematchRecoveryRequest } from '../../shared/rematchRecovery';

export const PENDING_REMATCH_KEY = 'pending_rematch_recovery_v1';
export interface PendingRematch extends RematchRecoveryRequest {
    sourceMatchID: string; gameName: string; playerName?: string;
    authUserID: string | null; expectedSelection: string; expiresAt: number;
}
export function readPendingRematch(): PendingRematch | null {
    try {
        const raw = getLocalStorage()?.getItem(PENDING_REMATCH_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as PendingRematch;
        if (!parseRematchRecoveryRequest(value) || typeof value.sourceMatchID !== 'string'
            || typeof value.gameName !== 'string' || !/^[a-z0-9_-]+$/.test(value.gameName)
            || !(value.authUserID === null || typeof value.authUserID === 'string')
            || typeof value.expectedSelection !== 'string' || !Number.isFinite(value.expiresAt)
            || value.expiresAt <= Date.now()) return null;
        return value;
    } catch { return null; }
}

export const isPendingRematchSource = (matchID: string) => readPendingRematch()?.sourceMatchID === matchID;
