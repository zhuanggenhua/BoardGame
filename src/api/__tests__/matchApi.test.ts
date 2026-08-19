import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/server', () => ({
    GAME_SERVER_URL: 'http://game-server.test',
    getGameServerUrl: () => 'http://game-server.test',
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

    it('可把预期内的旧房间 404 交给调用方处理，不输出红色错误日志', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
            error: 'Match stale-room not found',
        }), {
            status: 404,
            statusText: 'Not Found',
            headers: {
                'Content-Type': 'application/json',
            },
        }));

        await expect(getMatch('betrayal', 'stale-room', { expectedStatuses: [404] }))
            .rejects
            .toMatchObject({ status: 404 });

        expect(consoleErrorSpy).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
