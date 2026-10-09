import { describe, expect, it } from 'vitest';
import { buildMatchPlayerViewModel } from '../matchPlayerViewModel';

describe('buildMatchPlayerViewModel spectator perspective', () => {
    const core = {
        activePlayerId: '1',
        seatOrder: ['0', '1'],
        players: { '0': {}, '1': {} },
    };

    it('defaults an unseated spectator to the current player instead of seat zero', () => {
        const view = buildMatchPlayerViewModel({ core, playerID: null });

        expect(view.turnPlayerId).toBe('1');
        expect(view.selfPlayerId).toBe('1');
    });

    it('keeps a seated player as their own perspective when another player is active', () => {
        const view = buildMatchPlayerViewModel({ core, playerID: '0' });

        expect(view.turnPlayerId).toBe('1');
        expect(view.selfPlayerId).toBe('0');
    });

    it('preserves a game-specific spectator perspective override', () => {
        const view = buildMatchPlayerViewModel({
            core,
            playerID: null,
            resolveSelfPlayerId: () => '0',
        });

        expect(view.selfPlayerId).toBe('0');
    });

    it('falls back to seat order when the state has no current player', () => {
        const view = buildMatchPlayerViewModel({
            core: { seatOrder: ['0', '1'], players: { '0': {}, '1': {} } },
            playerID: null,
        });

        expect(view.selfPlayerId).toBe('0');
    });
});
