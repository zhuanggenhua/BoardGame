import { describe, expect, it, vi } from 'vitest';
import type { MatchMetadata } from '../../engine/transport/storage';
import {
    createInitialOwnerSeat,
    evaluateGuestOwnerReplacementProof,
    GuestOwnerReplacementProofError,
} from '../guestRoomOwnership';
import { createMatchWithOwnerConflictRetry } from '../duplicateOwnerRooms';

const ownerKey = 'guest:synthetic-owner';
const proof = 'synthetic-p0-proof';
const metadata = (credentials: unknown = proof): MatchMetadata => ({
    gameName: 'tictactoe',
    players: { '0': { credentials: credentials as string, ownerKey }, '1': {} },
    setupData: { ownerKey, ownerType: 'guest' }, createdAt: 0, updatedAt: 0,
});
const check = (existing: Array<MatchMetadata | null | undefined>, ...supplied: [unknown?]) => evaluateGuestOwnerReplacementProof({
    ownerType: 'guest', ownerKey, previousOwnerCredentials: supplied.length ? supplied[0] : proof,
    existingMatches: existing.map((item, index) => ({ matchID: `synthetic-${index}`, metadata: item })),
});

describe('guest room create/replacement proof', () => {
    it('allows a new identity with no existing room without previous credentials', () => {
        expect(check([], undefined)).toBeNull();
    });
    it.each([undefined, null, '', ' ', {}, []])('rejects absent or malformed proof without publishing private data: %j', supplied => {
        expect(check([metadata()], supplied)).toEqual({ status: 403, code: 'GUEST_OWNER_PROOF_REQUIRED' });
    });
    it.each(['wrong', 'synthetic-p0-prooF', ' synthetic-p0-proof', 'synthetic-p0-proof '])('rejects wrong proof without normalizing credentials: %s', supplied => {
        expect(check([metadata()], supplied)).toEqual({ status: 403, code: 'GUEST_OWNER_PROOF_INVALID' });
    });
    it('allows exact old P0 proof and does not mutate metadata', () => {
        const old = metadata(); const before = structuredClone(old);
        expect(check([old])).toBeNull();
        expect(old).toEqual(before);
    });
    it.each([undefined, null, '', ' ', 17])('rejects legacy rooms without a usable stored P0 credential: %j', stored => {
        const old = metadata(); old.players['0'].credentials = stored as string;
        expect(check([old])).toEqual({ status: 409, code: 'GUEST_OWNER_PROOF_UNAVAILABLE' });
    });
    it.each([null, undefined])('rejects missing old metadata rather than cleaning it: %j', old => {
        expect(check([old])).toEqual({ status: 409, code: 'GUEST_OWNER_PROOF_UNAVAILABLE' });
    });
    it('rejects a stale owner lookup or a P0 belonging to another identity', () => {
        const wrongOwner = metadata(); wrongOwner.setupData = { ownerKey: 'guest:another' };
        const wrongSeat = metadata(); wrongSeat.players['0'].ownerKey = 'guest:another';
        expect(check([wrongOwner])?.code).toBe('GUEST_OWNER_PROOF_INVALID');
        expect(check([wrongSeat])?.code).toBe('GUEST_OWNER_PROOF_INVALID');
    });
    it('checks every cleanup target, not just one room sharing the guest ID', () => {
        expect(check([metadata(), metadata('different-room-proof')])?.code).toBe('GUEST_OWNER_PROOF_INVALID');
    });
    it.each(['active', 'finished', 'disconnected', 'empty'] as const)('room lifecycle does not bypass authentication: %s', kind => {
        const old = metadata();
        if (kind === 'active') old.players['0'].isConnected = true;
        if (kind === 'finished') old.gameover = { winner: '0' };
        if (kind === 'disconnected') old.disconnectedSince = 1;
        if (kind === 'empty') old.players = { '0': {}, '1': {} };
        expect(check([old], 'impersonated-proof')).not.toBeNull();
    });
    it('leaves authenticated account replacement policy unchanged', () => {
        expect(evaluateGuestOwnerReplacementProof({ ownerType: 'user', ownerKey: 'user:synthetic', previousOwnerCredentials: undefined, existingMatches: [{ matchID: 'old', metadata: undefined }] })).toBeNull();
    });
    it('refuses a newly appeared conflict before retry cleanup', async () => {
        const cleanup = vi.fn();
        const create = vi.fn(async () => { throw new Error('ACTIVE_MATCH_EXISTS:tictactoe:race-room'); });
        const failed = check([metadata('new-room-proof')]);
        await expect(createMatchWithOwnerConflictRetry({
            createMatch: create, forceReplaceActive: true,
            fetchConflictMetadata: async () => {
                if (failed) throw new GuestOwnerReplacementProofError(failed);
                return metadata();
            },
            cleanupConflictMatch: cleanup,
        })).rejects.toMatchObject({ status: 403, code: 'GUEST_OWNER_PROOF_INVALID' });
        expect(cleanup).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledTimes(1);
    });
    it('proof errors contain only a code and status, never supplied or stored credentials', () => {
        const error = new GuestOwnerReplacementProofError(check([metadata()], 'wrong')!);
        expect(error.message).toBe('GUEST_OWNER_PROOF_INVALID');
        expect(JSON.stringify(error)).not.toContain(proof);
    });
});

describe('new owner seat bootstrap', () => {
    it('reserves unnamed guest P0 with fresh credentials returned to its creator', () => {
        const generateCredentials = vi.fn(() => 'synthetic-new-proof');
        const seat = createInitialOwnerSeat({ ownerKey, ownerType: 'guest', generateCredentials });
        expect(seat).toEqual({ ownerKey, credentials: 'synthetic-new-proof', isConnected: false });
        expect(generateCredentials).toHaveBeenCalledTimes(1);
    });
    it('preserves named guest/account and unnamed account behavior', () => {
        const generateCredentials = vi.fn(() => 'synthetic-new-proof');
        expect(createInitialOwnerSeat({ ownerKey, ownerType: 'guest', ownerName: 'Synthetic', generateCredentials }).name).toBe('Synthetic');
        expect(createInitialOwnerSeat({ ownerKey: 'user:synthetic', ownerType: 'user', ownerName: 'Synthetic', generateCredentials }).credentials).toBe('synthetic-new-proof');
        generateCredentials.mockClear();
        expect(createInitialOwnerSeat({ ownerKey: 'user:synthetic', ownerType: 'user', generateCredentials })).toEqual({ ownerKey: 'user:synthetic' });
        expect(generateCredentials).not.toHaveBeenCalled();
    });
});
