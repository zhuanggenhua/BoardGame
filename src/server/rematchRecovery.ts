import { createHash, timingSafeEqual } from 'node:crypto';
import type { MatchMetadata, MatchStorage } from '../engine/transport/storage';
import { REMATCH_RECOVERY_LIFETIME_MS, type RematchRecoveryRequest, type RecoveredRematch, type RematchRecoveryReceipt } from '../shared/rematchRecovery';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const matchesHash = (value: string, hash: unknown) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)
    && timingSafeEqual(Buffer.from(digest(value), 'hex'), Buffer.from(hash, 'hex'));

export function createRematchRecoveryReceipt(args: {
    sourceMatchID: string; token: string; ownerCredentials: string;
    ownerKey: string; ownerType: 'guest' | 'user'; now?: number;
}): RematchRecoveryReceipt {
    return {
        sourceMatchID: args.sourceMatchID, tokenHash: digest(args.token),
        issuedCredentialHash: digest(args.ownerCredentials), ownerKey: args.ownerKey,
        ownerType: args.ownerType, expiresAt: (args.now ?? Date.now()) + REMATCH_RECOVERY_LIFETIME_MS,
    };
}

/** No writes, reissuance or successor traversal. A rotated seat revokes this receipt. */
export async function recoverCommittedRematch(args: {
    fetch: MatchStorage['fetch']; gameName: string; sourceMatchID: string;
    recovery: RematchRecoveryRequest; authenticatedUserId?: string; now?: number;
}): Promise<{ exists: boolean; result?: RecoveredRematch }> {
    // Lightweight socket auth reads intentionally omit recovery metadata.
    const { metadata } = await args.fetch(args.recovery.nextMatchID, { metadata: true });
    if (!metadata) return { exists: false };
    const result = validateReceipt(metadata, args);
    return { exists: true, ...(result ? { result } : {}) };
}

function validateReceipt(metadata: MatchMetadata, args: {
    gameName: string; sourceMatchID: string; recovery: RematchRecoveryRequest;
    authenticatedUserId?: string; now?: number;
}): RecoveredRematch | null {
    const receipt = metadata.rematchRecovery;
    const setup = metadata.setupData && typeof metadata.setupData === 'object' && !Array.isArray(metadata.setupData)
        ? metadata.setupData as Record<string, unknown> : undefined;
    const seat = metadata.players['0'];
    if (!receipt || metadata.gameName !== args.gameName || receipt.sourceMatchID !== args.sourceMatchID
        || args.sourceMatchID === args.recovery.nextMatchID
        || !Number.isFinite(receipt.expiresAt) || receipt.expiresAt <= (args.now ?? Date.now())
        || !matchesHash(args.recovery.token, receipt.tokenHash)
        || typeof seat?.credentials !== 'string' || !matchesHash(seat.credentials, receipt.issuedCredentialHash)
        || !['guest', 'user'].includes(receipt.ownerType)
        || typeof receipt.ownerKey !== 'string' || !receipt.ownerKey.startsWith(`${receipt.ownerType}:`)
        || !receipt.ownerKey.slice(receipt.ownerType.length + 1)
        || setup?.ownerKey !== receipt.ownerKey || setup.ownerType !== receipt.ownerType
        || seat.ownerKey !== receipt.ownerKey
        || (receipt.ownerType === 'user' && receipt.ownerKey !== `user:${args.authenticatedUserId ?? ''}`)) return null;
    return { matchID: args.recovery.nextMatchID, ownerPlayerID: '0', ownerCredentials: seat.credentials,
        ownerType: receipt.ownerType, ownerKey: receipt.ownerKey };
}
