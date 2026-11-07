import { describe, expect, it } from 'vitest';
import type { MatchMetadata } from '../../engine/transport/storage';
import { buildLobbyMatch, buildMatchDetailPayload } from '../lobbyMatch';

const metadata = (setupData: unknown = {}): MatchMetadata => ({
    gameName: 'smashup', createdAt: 1, updatedAt: 2,
    players: { '0': { name: 'Alice', credentials: 'private-credential', ownerKey: 'private-owner', isConnected: true }, '1': {} },
    setupData,
});
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('public room metadata privacy', () => {
    it('projects detail setup and completion without secrets or arbitrary nested data', () => {
        const source = metadata({ roomName: 'Room', ownerType: 'guest', enableAi: true,
            password: 'private-password', ownerKey: 'private-owner', guestId: 'private-guest',
            decks: ['private-deck'], spellbooks: { '0': 'private-spellbook' },
            setupConfig: { private: 'private-config' }, arbitrary: { secret: 'private-secret' },
            seatControllers: { '0': { type: 'human', credentials: 'private-human' },
                '1': { type: 'local-ai', difficulty: 'hard', policyId: 'default', manualSetupSelection: true, credentials: 'private-ai', config: { secret: 'private-config' } } },
        });
        source.gameover = { winner: '0', credentials: 'private-gameover' };
        const result = json(buildMatchDetailPayload('room', source));
        expect(result.setupData).toEqual({ roomName: 'Room', ownerType: 'guest', enableAi: true,
            seatControllers: { '0': { type: 'human' }, '1': { type: 'local-ai', difficulty: 'hard', policyId: 'default', manualSetupSelection: true } } });
        expect(result.isLocked).toBe(true);
        expect(result.gameover).toBe(true);
        expect(result.status).toBe('finished');
        expect(JSON.stringify(result)).not.toContain('private-');
        expect(result.players).toEqual([{ id: 0, name: 'Alice', isConnected: true, isAi: false }, { id: 1, name: 'AI 2 号位', isAi: true }]);
        expect((source.setupData as Record<string, unknown>).password).toBe('private-password');
    });

    it('does not publish owner identity in lobby summaries', () => {
        const result = json(buildLobbyMatch('room', metadata({ roomName: 'Room', password: 'private-password', ownerType: 'guest', ownerKey: 'private-owner', expansions: ['titans'] })));
        expect(result).not.toHaveProperty('ownerKey');
        expect(result).toMatchObject({ roomName: 'Room', ownerType: 'guest', isLocked: true, publicSetupSummary: { enabledExpansions: ['titans'] } });
        expect(JSON.stringify(result)).not.toContain('private-');
    });

    it('rejects nested values masquerading as public scalar/controller fields', () => {
        const secret = { secret: 'private-secret' };
        const result = json(buildMatchDetailPayload('room', metadata({ roomName: secret, ownerType: secret, enableAi: secret,
            seatControllers: { '0': { type: 'human', arbitrary: secret }, '1': { type: 'remote-ai', providerId: secret, timeoutMs: secret, manualSetupSelection: secret }, secret },
        })));
        expect(JSON.stringify(result)).not.toContain('private-');
        expect(result.setupData).toEqual({ seatControllers: { '0': { type: 'human' } } });
        expect(result.isLocked).toBe(false);
    });

    it.each([undefined, null, [], 'private-secret'])('omits malformed setup %j', (setup) => {
        expect(json(buildMatchDetailPayload('room', metadata(setup))).setupData).toEqual({});
    });
});
