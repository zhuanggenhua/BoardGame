import { describe, expect, it, vi } from 'vitest';
import type { MatchMetadata } from '../../engine/transport/storage';
import { prepareRematchCreate } from '../rematchSetup';
import { MageWarsDomain } from '../../games/mage-wars/domain';
import { MAGE_IDS } from '../../games/mage-wars/domain/ids';
import { readBetrayalScenarioId } from '../../games/betrayal/roomSetup';

const ownerKey = 'guest:synthetic-owner';
function metadata(gameName = 'betrayal', setup: Record<string, unknown> = {}): MatchMetadata {
    return {
        gameName, createdAt: 0, updatedAt: 0,
        players: { '0': { name: 'Owner', ownerKey, credentials: 'synthetic-proof' }, '1': {} },
        setupData: { ownerKey, ownerType: 'guest', guestId: 'synthetic-owner', ...setup },
    };
}
const proof = { matchID: 'old', playerID: '0', credentials: 'synthetic-proof' };
function prepare(old: MatchMetadata | undefined, request: unknown = proof, gameName = old?.gameName ?? 'betrayal', authenticatedUserId?: string) {
    const fetch = vi.fn(async () => ({ metadata: old }));
    return { fetch, result: prepareRematchCreate({ gameName, request, authenticatedUserId, fetch }) };
}

describe('private rematch configuration contract', () => {
    it('inherits Betrayal scenario, name, password, AI controllers and TTL exactly without publishing source proof', async () => {
        const settings = {
            roomName: 'Original room', password: 'synthetic-lock', scenario: 'first-scenario',
            setupSelections: { scenario: 'first-scenario' }, enableAi: true, ttlSeconds: 86400,
            seatControllers: { '0': { type: 'human' }, '1': { type: 'local-ai', policyId: 'betrayal', difficulty: 'hard', minimumActionDelayMs: 2000, manualSetupSelection: true } },
        };
        const old = metadata('betrayal', settings);
        const result = await prepare(old).result;
        expect(result.setupData).toMatchObject(settings);
        expect(result.setupData.seatControllers).not.toBe(settings.seatControllers);
        expect(readBetrayalScenarioId(result.setupData)).toBe(readBetrayalScenarioId(old.setupData));
        expect(result.numPlayers).toBe(2);
        expect(result.ownerKey).toBe(ownerKey);
        expect(result.ownerType).toBe('guest');
        expect(JSON.stringify(result)).not.toContain('synthetic-proof');
        expect(old.setupData).toEqual({ ownerKey, ownerType: 'guest', guestId: 'synthetic-owner', ...settings });
    });

    it.each([undefined, null, {}, { ...proof, credentials: '' }, { ...proof, playerID: '1' }])('rejects invalid rematch proof before fetching: %j', async request => {
        const fetch = vi.fn(async () => ({ metadata: metadata() }));
        await expect(prepareRematchCreate({ gameName: 'betrayal', request, fetch })).rejects.toMatchObject({ status: 403, code: 'REMATCH_PROOF_REQUIRED' });
        expect(fetch).not.toHaveBeenCalled();
    });
    it('rejects missing source room', async () => {
        await expect(prepare(undefined).result).rejects.toMatchObject({ status: 404, code: 'REMATCH_SOURCE_NOT_FOUND' });
    });
    it.each(['wrong', 'synthetic-proof-longer'])('rejects invalid credentials: %s', async credentials => {
        await expect(prepare(metadata(), { ...proof, credentials }).result).rejects.toMatchObject({ status: 403, code: 'REMATCH_PROOF_INVALID' });
    });
    it('refuses mismatched game without leaking source metadata', async () => {
        await expect(prepare(metadata(), proof, 'mage-wars').result).rejects.toMatchObject({ status: 403, code: 'REMATCH_PROOF_INVALID' });
    });
    it('keeps guest ownership even if owner has logged in since creation', async () => {
        expect(await prepare(metadata(), proof, 'betrayal', 'another-account').result).toMatchObject({ ownerType: 'guest', ownerKey });
    });
    it.each([undefined, 'other-account'])('requires matching authenticated account for account-owned room: %s', async authenticatedUserId => {
        const old = metadata('betrayal', { ownerType: 'user', ownerKey: 'user:account' });
        old.players['0'].ownerKey = 'user:account';
        await expect(prepare(old, proof, 'betrayal', authenticatedUserId).result).rejects.toMatchObject({ status: 403, code: 'REMATCH_OWNER_MISMATCH' });
    });
    it('accepts matching account and old P0 proof together', async () => {
        const old = metadata('betrayal', { ownerType: 'user', ownerKey: 'user:account' });
        old.players['0'].ownerKey = 'user:account';
        expect(await prepare(old, proof, 'betrayal', 'account').result).toMatchObject({ ownerType: 'user', ownerKey: 'user:account' });
    });
    it.each([0, 3600, 86400, 259200, 604800])('preserves valid integer retention exactly: %s', async ttlSeconds => {
        expect((await prepare(metadata('betrayal', { ttlSeconds })).result).setupData.ttlSeconds).toBe(ttlSeconds);
    });
    it.each([-1, 1.5, NaN, Infinity, '86400', null, Number.MAX_SAFE_INTEGER])('rejects invalid TTL rather than silently clearing it: %s', async ttlSeconds => {
        await expect(prepare(metadata('betrayal', { ttlSeconds })).result).rejects.toMatchObject({ status: 409, code: 'REMATCH_SETUP_UNSUPPORTED' });
    });
    it.each([
        { secretScenario: { deck: ['hidden'] } },
        { scenario: 'unknown-scenario' },
        { setupSelections: { scenario: 'first-scenario', privateDeck: ['hidden'] } },
        { enableAi: 'true' },
        { seatControllers: { '7': { type: 'human' } } },
        { seatControllers: { '1': { type: 'local-ai', privateToken: 'secret' } } },
        { seatControllers: { '1': { type: 'unknown' } } },
    ])('fails closed for unproven setup: %j', async setup => {
        await expect(prepare(metadata('betrayal', setup)).result).rejects.toMatchObject({ status: 409, code: 'REMATCH_SETUP_UNSUPPORTED' });
    });
    it('rejects unverified games instead of replacing them with default setup', async () => {
        await expect(prepare(metadata('smashup')).result).rejects.toMatchObject({ status: 409, code: 'REMATCH_SETUP_UNSUPPORTED' });
    });
    it('preserves legacy Betrayal scenario placement and absent default distinctly', async () => {
        for (const setup of [{}, { scenarioId: 'first-scenario' }, { setupSelections: { scenario: 'first-scenario' } }]) {
            const old = metadata('betrayal', setup);
            const result = await prepare(old).result;
            expect(result.setupData).toMatchObject(setup);
            expect(readBetrayalScenarioId(result.setupData)).toBe(readBetrayalScenarioId(old.setupData));
        }
    });
    it.each([
        {},
        { mageWarsSeat0MageId: MAGE_IDS.WIZARD_APPRENTICE },
        { mageWarsSeat0SpellbookEntries: [{ spellCardId: 2906, count: 1 }] },
        { setupSelections: { mageWarsSeat0MageId: MAGE_IDS.WIZARD_APPRENTICE, mageWarsSeat1SpellbookEntries: '[{"spellCardId":2906,"count":1}]' } },
    ])('preserves Mage Wars default and explicit spellbook runtime semantics: %j', async settings => {
        const old = metadata('mage-wars', settings);
        const result = await prepare(old).result;
        expect(result.setupData).toEqual(old.setupData);
        const random = { random: () => 0.5, d: () => 1, range: () => 1, shuffle: <T,>(values: T[]) => [...values] };
        expect(MageWarsDomain.setup(['0', '1'], random, result.setupData)).toEqual(MageWarsDomain.setup(['0', '1'], random, old.setupData));
    });
});
