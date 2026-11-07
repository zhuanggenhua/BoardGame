import { timingSafeEqual } from 'node:crypto';
import type { MatchMetadata, PlayerMetadata } from '../engine/transport/storage';

export type GuestOwnerReplacementFailure = {
    status: 403 | 409;
    code: 'GUEST_OWNER_PROOF_REQUIRED' | 'GUEST_OWNER_PROOF_INVALID' | 'GUEST_OWNER_PROOF_UNAVAILABLE';
};

export class GuestOwnerReplacementProofError extends Error {
    readonly status: GuestOwnerReplacementFailure['status'];
    readonly code: GuestOwnerReplacementFailure['code'];

    constructor(failure: GuestOwnerReplacementFailure) {
        super(failure.code);
        this.name = 'GuestOwnerReplacementProofError';
        this.status = failure.status;
        this.code = failure.code;
    }
}

/** Guest IDs identify rooms; only an existing P0 credential authorizes replacement. */
export function evaluateGuestOwnerReplacementProof(args: {
    ownerType: 'guest' | 'user';
    ownerKey: string;
    previousOwnerCredentials: unknown;
    existingMatches: Array<{ matchID: string; metadata?: MatchMetadata | null }>;
}): GuestOwnerReplacementFailure | null {
    if (args.ownerType !== 'guest' || args.existingMatches.length === 0) return null;

    for (const match of args.existingMatches) {
        const ownerSeat = match.metadata?.players?.['0'];
        const stored = ownerSeat?.credentials;
        if (typeof stored !== 'string' || stored.trim().length === 0) {
            return { status: 409, code: 'GUEST_OWNER_PROOF_UNAVAILABLE' };
        }
        const supplied = args.previousOwnerCredentials;
        if (typeof supplied !== 'string' || supplied.trim().length === 0) {
            return { status: 403, code: 'GUEST_OWNER_PROOF_REQUIRED' };
        }
        const setupData = match.metadata?.setupData;
        const storedOwnerKey = setupData && typeof setupData === 'object' && !Array.isArray(setupData)
            ? (setupData as Record<string, unknown>).ownerKey
            : undefined;
        const suppliedBuffer = Buffer.from(supplied);
        const storedBuffer = Buffer.from(stored);
        if (
            !args.ownerKey.startsWith('guest:')
            || storedOwnerKey !== args.ownerKey
            || (ownerSeat?.ownerKey !== undefined && ownerSeat.ownerKey !== args.ownerKey)
            || suppliedBuffer.length !== storedBuffer.length
            || !timingSafeEqual(suppliedBuffer, storedBuffer)
        ) {
            return { status: 403, code: 'GUEST_OWNER_PROOF_INVALID' };
        }
    }
    return null;
}

/** New guests receive their private recovery proof in the create response. */
export function createInitialOwnerSeat(args: {
    ownerKey: string;
    ownerType: 'guest' | 'user';
    ownerName?: string;
    generateCredentials: () => string;
}): PlayerMetadata {
    if (args.ownerType !== 'guest' && !args.ownerName) return { ownerKey: args.ownerKey };
    return {
        ownerKey: args.ownerKey,
        ...(args.ownerName ? { name: args.ownerName } : {}),
        credentials: args.generateCredentials(),
        isConnected: false,
    };
}
