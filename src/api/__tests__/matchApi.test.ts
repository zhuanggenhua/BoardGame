import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/server', () => ({
    GAME_SERVER_URL: 'http://game-server.test',
    getGameServerUrl: () => 'http://game-server.test',
}));

import { claimSeat, createMatch, getMatch, playAgain } from '../../services/matchApi';

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

describe('guest owner credentials', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

    it('sends the owner credential only in the claim POST body', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ playerCredentials: 'seat' }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await claimSeat('betrayal', 'match-1', '1', { guestId: '1234', ownerCredentials: 'owner-secret' });
        const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).not.toContain('owner-secret');
        expect(JSON.parse(String(options.body))).toMatchObject({ playerID: '1', ownerCredentials: 'owner-secret' });
    });

    it('keeps regular create requests unchanged', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ matchID: 'new' }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const options = { numPlayers: 3, setupData: { guestId: '1234', mode: 'custom' }, playerName: 'Tester', previousOwnerCredentials: 'old-proof', forceReplaceOwnerRoom: true };
        await createMatch('betrayal', options);
        expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(options);
    });

    it('creates a rematch from private source proof without a public GET', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            matchID: 'new', ownerCredentials: 'new-owner-secret', ownerType: 'guest',
        }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await expect(playAgain('betrayal', 'old', { playerID: '0', credentials: 'old-secret', token: 'token' }))
            .resolves.toEqual({ nextMatchID: 'new', ownerCredentials: 'new-owner-secret', ownerType: 'guest' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('http://game-server.test/games/betrayal/create');
        expect(JSON.parse(String(options.body))).toEqual({
            rematch: { matchID: 'old', playerID: '0', credentials: 'old-secret' },
        });
        expect(options.headers).toMatchObject({ Authorization: 'Bearer token' });
    });

    it('surfaces unsupported rematch setup without logging private response details', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: 'REMATCH_SETUP_UNSUPPORTED', privateDetail: 'PRIVATE_MARKER',
        }), { status: 409 })));
        await expect(playAgain('betrayal', 'old', { playerID: '0', credentials: 'secret' }))
            .rejects.toMatchObject({ code: 'REMATCH_SETUP_UNSUPPORTED', status: 409 });
        expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_MARKER');
        log.mockRestore();
    });
});
