import { getLocalStorage } from '../../lib/browserStorage';
import { REMATCH_RECOVERY_LIFETIME_MS, type RecoveredRematch } from '../../shared/rematchRecovery';
import { withMatchCredentialWrite, MatchCredentialStorageError } from './matchCredentialTransaction';
import { captureMatchCredentialSelection, persistRematchOwnerCredentials, readStoredMatchCredentials } from './useMatchStatus';

import { PENDING_REMATCH_KEY as KEY, readPendingRematch, type PendingRematch } from './pendingRematchStorage';
export { readPendingRematch, type PendingRematch } from './pendingRematchStorage';

const randomSecret = (bytes: number): string => {
    const random = crypto.getRandomValues(new Uint8Array(bytes));
    return btoa(String.fromCharCode(...random)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};
/** Persist before the network request. The shared writer gives concurrent tabs one request. */
export function preparePendingRematch(input: Pick<PendingRematch, 'sourceMatchID' | 'gameName' | 'playerName' | 'authUserID'>): Promise<PendingRematch> {
    return withMatchCredentialWrite(() => {
        const storage = getLocalStorage();
        if (!storage) throw new MatchCredentialStorageError();
        storage.getItem(KEY); // A denied read must not be mistaken for an empty store.
        const expectedSelection = captureMatchCredentialSelection();
        const existing = readPendingRematch();
        if (existing?.sourceMatchID === input.sourceMatchID && existing.gameName === input.gameName
            && existing.authUserID === input.authUserID && existing.expectedSelection === expectedSelection) return existing;
        const pending: PendingRematch = { ...input, expectedSelection, nextMatchID: randomSecret(16), token: randomSecret(32),
            expiresAt: Date.now() + REMATCH_RECOVERY_LIFETIME_MS };
        storage.setItem(KEY, JSON.stringify(pending));
        if (storage.getItem(KEY) !== JSON.stringify(pending)) throw new MatchCredentialStorageError();
        return pending;
    });
}
const sameRequest = (a: PendingRematch | null, b: PendingRematch) => a?.token === b.token
    && a.nextMatchID === b.nextMatchID && a.sourceMatchID === b.sourceMatchID;

/** Auth and selection checks run inside the credential write lock, not before queuing. */
export async function completePendingRematch(pending: PendingRematch, result: RecoveredRematch, isCurrentAuth: () => boolean): Promise<boolean> {
    if (result.matchID !== pending.nextMatchID || result.ownerPlayerID !== '0'
        || !result.ownerCredentials || !['guest', 'user'].includes(result.ownerType)
        || !result.ownerKey?.startsWith(`${result.ownerType}:`) || !result.ownerKey.slice(result.ownerType.length + 1)
        || (result.ownerType === 'user' && result.ownerKey !== `user:${pending.authUserID ?? ''}`)) return false;
    const saved = await persistRematchOwnerCredentials(pending.sourceMatchID, {
        matchID: result.matchID, playerID: '0', credentials: result.ownerCredentials,
        gameName: pending.gameName, playerName: pending.playerName,
    }, { matchID: result.matchID, gameName: pending.gameName, ownerKey: result.ownerKey, ownerType: result.ownerType }, undefined, () => {
        if (!isCurrentAuth()) return false;
        const current = readPendingRematch();
        // A second tab may already have saved this exact result and removed pending.
        const existing = readStoredMatchCredentials(result.matchID);
        const alreadySaved = existing?.playerID === '0' && existing.credentials === result.ownerCredentials;
        return (sameRequest(current, pending) || (!current && alreadySaved))
            && (captureMatchCredentialSelection() === pending.expectedSelection || alreadySaved);
    });
    if (!saved) return false;
    await withMatchCredentialWrite(() => {
        if (sameRequest(readPendingRematch(), pending)) {
            const storage = getLocalStorage();
            if (!storage) throw new MatchCredentialStorageError();
            storage.removeItem(KEY);
        }
    });
    return true;
}

export const REMATCH_RECOVERY_NEEDED_EVENT = 'rematch-recovery-needed';
export function requestPendingRematchRecovery(): void {
    window.dispatchEvent(new Event(REMATCH_RECOVERY_NEEDED_EVENT));
}
