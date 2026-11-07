/* @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { MatchMetadata, StoredMatchState } from '../../engine/transport/storage';
import { createClaimSeatHandler } from '../claimSeat';

type ClaimContext = Parameters<ReturnType<typeof createClaimSeatHandler>>[0];
const OWNER_CREDENTIAL = 'synthetic-owner-seat-credential';
const AI_CREDENTIAL = 'synthetic-ai-seat-credential';
const HUMAN_CREDENTIAL = 'synthetic-other-human-credential';
const SECRET = 'synthetic-test-jwt-secret';

function setup(options: { ownerType?: 'guest' | 'user'; enableAi?: boolean; runtimeHuman?: boolean; ownerCredential?: string | null; ownerSeatKey?: string } = {}) {
    const ownerKey = options.ownerType === 'user' ? 'user:synthetic-owner' : 'guest:1234';
    const metadata: MatchMetadata = {
        gameName: 'betrayal', createdAt: 0, updatedAt: 0,
        setupData: { ownerKey, ownerType: options.ownerType ?? 'guest', enableAi: options.enableAi ?? true, seatControllers: {
            '0': { type: 'human' }, '1': { type: 'local-ai' }, '2': { type: 'human' }, '3': { type: 'local-ai' },
        } },
        players: {
            '0': { name: 'Owner', ownerKey: options.ownerSeatKey ?? ownerKey, ...(options.ownerCredential === null ? {} : { credentials: options.ownerCredential ?? OWNER_CREDENTIAL }) },
            '1': { name: 'AI', credentials: AI_CREDENTIAL },
            '2': { name: 'Other human', ownerKey: 'user:other', credentials: HUMAN_CREDENTIAL },
            '3': { name: 'New AI' },
        },
    };
    const state: StoredMatchState = { G: { core: { ...(options.runtimeHuman ? { seatControllers: { '1': { type: 'human' } } } : {}) }, sys: {} }, _stateID: 0 };
    const claimSeatMetadata = vi.fn(async (_id: string, input: { playerID: string; playerCredentials: string }) => {
        const player = metadata.players[input.playerID];
        if (!player) return { metadata, playerExists: false };
        player.credentials ??= input.playerCredentials;
        return { metadata, playerExists: true, playerCredentials: player.credentials };
    });
    const generateCredentials = vi.fn(() => 'synthetic-new-ai-credential');
    const handler = createClaimSeatHandler({
        db: { fetch: async () => ({ metadata, state }), setMetadata: async () => {}, claimSeatMetadata },
        auth: { generateCredentials }, jwtSecret: SECRET,
    });
    function context(body: Record<string, unknown>, token?: string): ClaimContext {
        return {
            get: (name) => name === 'authorization' && token ? `Bearer ${token}` : '',
            request: { body },
            throw: (status, message) => { throw new Error(`${status}:${message}`); },
        } as ClaimContext;
    }
    return { handler, context, metadata, claimSeatMetadata, generateCredentials };
}

async function expectRejected(fixture: ReturnType<typeof setup>, body: Record<string, unknown>, status: number, token?: string) {
    const before = JSON.stringify(fixture.metadata);
    const ctx = fixture.context(body, token);
    await expect(fixture.handler(ctx, 'synthetic-match')).rejects.toThrow(`${status}:`);
    expect(ctx.body).toBeUndefined();
    expect(JSON.stringify(fixture.metadata)).toBe(before);
    expect(fixture.claimSeatMetadata).not.toHaveBeenCalled();
    expect(fixture.generateCredentials).not.toHaveBeenCalled();
}

describe('claim-seat guest owner authority', () => {
    it.each(['0', '1', '2'])('public four-digit guest id alone cannot recover seat %s', async (playerID) => {
        await expectRejected(setup(), { playerID, guestId: '1234' }, 401);
    });
    it('rejects a wrong owner credential despite the matching public guest id', async () => {
        await expectRejected(setup(), { playerID: '1', guestId: '1234', ownerCredentials: 'wrong-credential' }, 403);
    });
    it('rejects another human seat credential as owner proof', async () => {
        await expectRejected(setup(), { playerID: '1', guestId: '1234', ownerCredentials: HUMAN_CREDENTIAL }, 403);
    });
    it('returns the already held owner credential without requiring a guest id', async () => {
        const fixture = setup();
        const ctx = fixture.context({ playerID: '0', ownerCredentials: OWNER_CREDENTIAL });
        await fixture.handler(ctx, 'synthetic-match');
        expect(ctx.body).toEqual({ playerID: '0', playerCredentials: OWNER_CREDENTIAL });
        expect(fixture.generateCredentials).not.toHaveBeenCalled();
    });
    it('allows the verified guest owner to recover an existing AI seat without rotating it', async () => {
        const fixture = setup();
        const ctx = fixture.context({ playerID: '1', ownerCredentials: OWNER_CREDENTIAL });
        await fixture.handler(ctx, 'synthetic-match');
        expect(ctx.body).toEqual({ playerID: '1', playerCredentials: AI_CREDENTIAL });
        expect(fixture.metadata.players['0'].credentials).toBe(OWNER_CREDENTIAL);
        expect(fixture.generateCredentials).not.toHaveBeenCalled();
    });
    it('allows the verified guest owner to claim an uncredentialed AI seat', async () => {
        const fixture = setup();
        const ctx = fixture.context({ playerID: '3', ownerCredentials: OWNER_CREDENTIAL });
        await fixture.handler(ctx, 'synthetic-match');
        expect(ctx.body).toEqual({ playerID: '3', playerCredentials: 'synthetic-new-ai-credential' });
    });
    it('never returns another human seat credential to the guest owner', async () => {
        await expectRejected(setup(), { playerID: '2', guestId: '1234', ownerCredentials: OWNER_CREDENTIAL }, 403);
    });
    it('honors explicit AI disable and authoritative runtime human override', async () => {
        await expectRejected(setup({ enableAi: false }), { playerID: '1', ownerCredentials: OWNER_CREDENTIAL }, 403);
        await expectRejected(setup({ runtimeHuman: true }), { playerID: '1', ownerCredentials: OWNER_CREDENTIAL }, 403);
    });
    it('does not trust a stale AI label for a seat bound to another human', async () => {
        const fixture = setup();
        fixture.metadata.players['1'].ownerKey = 'user:other';
        await expectRejected(fixture, { playerID: '1', ownerCredentials: OWNER_CREDENTIAL }, 403);
    });
    it('refuses a controller type that the game manifest explicitly disables', async () => {
        const fixture = setup();
        const config = fixture.metadata.setupData as { seatControllers: Record<string, { type: string }> };
        config.seatControllers['1'].type = 'remote-ai';
        await expectRejected(fixture, { playerID: '1', ownerCredentials: OWNER_CREDENTIAL }, 403);
    });
    it('refuses old rooms without an existing owner seat credential', async () => {
        await expectRejected(setup({ ownerCredential: null }), { playerID: '1', guestId: '1234', ownerCredentials: OWNER_CREDENTIAL }, 403);
    });
    it('refuses an inconsistent owner-seat identity', async () => {
        await expectRejected(setup({ ownerSeatKey: 'guest:someone-else' }), { playerID: '1', ownerCredentials: OWNER_CREDENTIAL }, 403);
    });
    it('does not treat a guest owner credential as an account JWT', async () => {
        await expectRejected(setup({ ownerType: 'user' }), { playerID: '1', ownerCredentials: OWNER_CREDENTIAL }, 403);
    });
    it('preserves the existing account owner JWT recovery path', async () => {
        const fixture = setup({ ownerType: 'user' });
        const token = jwt.sign({ userId: 'synthetic-owner', username: 'Owner' }, SECRET);
        const ctx = fixture.context({ playerID: '1' }, token);
        await fixture.handler(ctx, 'synthetic-match');
        expect(ctx.body).toEqual({ playerID: '1', playerCredentials: AI_CREDENTIAL });
    });
    it('allows a verified non-owner account to recover its own bound human seat', async () => {
        const fixture = setup({ ownerType: 'user' });
        const token = jwt.sign({ userId: 'other' }, SECRET);
        const ctx = fixture.context({ playerID: '2' }, token);
        await fixture.handler(ctx, 'synthetic-match');
        expect(ctx.body).toEqual({ playerID: '2', playerCredentials: HUMAN_CREDENTIAL });
    });
    it('refuses another bound human seat even to the account room owner', async () => {
        const fixture = setup({ ownerType: 'user' });
        await expectRejected(fixture, { playerID: '2' }, 403, jwt.sign({ userId: 'synthetic-owner' }, SECRET));
    });
    it('refuses legacy human seats with no trustworthy account binding', async () => {
        const fixture = setup({ ownerType: 'user' });
        delete fixture.metadata.players['0'].ownerKey;
        await expectRejected(fixture, { playerID: '0' }, 403, jwt.sign({ userId: 'synthetic-owner' }, SECRET));
    });
    it('does not let a non-owner account recover an AI seat', async () => {
        await expectRejected(setup({ ownerType: 'user' }), { playerID: '1' }, 403, jwt.sign({ userId: 'other' }, SECRET));
    });
    it('keeps the verified account owner own-seat recovery path', async () => {
        const fixture = setup({ ownerType: 'user' });
        const ctx = fixture.context({ playerID: '0' }, jwt.sign({ userId: 'synthetic-owner' }, SECRET));
        await fixture.handler(ctx, 'synthetic-match');
        expect(ctx.body).toEqual({ playerID: '0', playerCredentials: OWNER_CREDENTIAL });
    });
    it('does not disclose a human credential if seat ownership changes during the claim write', async () => {
        const fixture = setup();
        fixture.claimSeatMetadata.mockImplementationOnce(async () => {
            fixture.metadata.players['1'].ownerKey = 'user:other';
            fixture.metadata.players['1'].credentials = HUMAN_CREDENTIAL;
            return { metadata: fixture.metadata, playerExists: true, playerCredentials: HUMAN_CREDENTIAL };
        });
        const ctx = fixture.context({ playerID: '1', ownerCredentials: OWNER_CREDENTIAL });
        await expect(fixture.handler(ctx, 'synthetic-match')).rejects.toThrow('403:');
        expect(ctx.body).toBeUndefined();
    });
    it('does not return credentials after guest owner proof is revoked during the claim write', async () => {
        const fixture = setup();
        fixture.claimSeatMetadata.mockImplementationOnce(async () => {
            fixture.metadata.players['0'].credentials = 'new-owner-proof';
            return { metadata: fixture.metadata, playerExists: true, playerCredentials: AI_CREDENTIAL };
        });
        const ctx = fixture.context({ playerID: '1', ownerCredentials: OWNER_CREDENTIAL });
        await expect(fixture.handler(ctx, 'synthetic-match')).rejects.toThrow('403:');
        expect(ctx.body).toBeUndefined();
    });
    it('rejects an invalid JWT even alongside valid guest owner proof', async () => {
        await expectRejected(setup(), { playerID: '1', ownerCredentials: OWNER_CREDENTIAL }, 401, 'invalid-jwt');
    });
});
