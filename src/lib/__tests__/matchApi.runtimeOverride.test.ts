// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMatch, joinMatch } from '../../services/matchApi';

describe('matchApi runtime server override', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__;
    });

    it('getMatch 会优先使用运行时注入的 game server 地址', async () => {
        (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__ = 'http://127.0.0.1:20100';
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [],
            }),
        } as Response);

        await getMatch('tictactoe', 'match-1');

        expect(fetchMock).toHaveBeenCalledWith(
            'http://127.0.0.1:20100/games/tictactoe/match-1',
            expect.objectContaining({ cache: 'no-store' }),
        );
    });

    it('joinMatch 会优先使用运行时注入的 game server 地址', async () => {
        (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__ = 'http://127.0.0.1:20100';
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                playerID: '1',
                playerCredentials: 'cred-1',
            }),
        } as Response);

        await joinMatch('tictactoe', 'match-2', {
            playerName: 'Guest',
            data: { password: '654321' },
        });

        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:20100/games/tictactoe/match-2/join', expect.objectContaining({
            method: 'POST',
        }));
    });
});
