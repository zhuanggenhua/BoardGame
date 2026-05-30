import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/server', () => ({
    GAME_SERVER_URL: 'http://game-server.test',
}));

import { getMatch } from '../../services/matchApi';

describe('matchApi.getMatch', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            matchID: 'match-1',
            gameName: 'smashup',
            players: [],
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('房间状态查询应禁用浏览器缓存，避免重复读取旧 seat 快照', async () => {
        await getMatch('smashup', 'match-1');

        expect(fetchMock).toHaveBeenCalledWith(
            'http://game-server.test/games/smashup/match-1',
            expect.objectContaining({
                cache: 'no-store',
            }),
        );
    });
});
