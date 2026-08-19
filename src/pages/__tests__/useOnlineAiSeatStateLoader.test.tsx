/* @vitest-environment happy-dom */
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchApi from '../../services/matchApi';
import type { GameManifestEntry } from '../../games/manifest.types';
import type { MatchInfo } from '../../services/matchApi';
import { useOnlineAiSeatStateLoader } from '../useOnlineAiSeatStateLoader';

vi.mock('../../services/matchApi', () => ({
    getMatch: vi.fn(),
    claimSeat: vi.fn(),
}));

vi.mock('../../lib/mobile/mobileRuntimeDebug', () => ({
    logMobileRuntimeCritical: vi.fn(),
}));

const gameConfig: GameManifestEntry = {
    id: 'summonerwars',
    type: 'game',
    enabled: true,
    titleKey: 'games.summonerwars.title',
    descriptionKey: 'games.summonerwars.description',
    category: 'wargame',
    playersKey: 'games.summonerwars.players',
    icon: 'swords',
    playerOptions: [2],
    ai: {
        capture: false,
        localAi: true,
        remoteAi: false,
    },
};

const buildMatchInfo = (): MatchInfo => ({
    matchID: 'match-1',
    gameName: 'summonerwars',
    players: [
        { id: 0, name: 'Host', isConnected: true },
        { id: 1, name: 'AI Opponent', isConnected: true },
    ],
    setupData: {
        enableAi: true,
        ownerKey: 'guest:guest-owner',
        ownerType: 'guest',
        guestId: 'guest-owner',
        seatControllers: {
            '0': { type: 'human' },
            '1': { type: 'local-ai', difficulty: 'normal' },
        },
    },
});

const renderLoader = (overrides?: Partial<Parameters<typeof useOnlineAiSeatStateLoader>[0]>) => renderHook(
    () => useOnlineAiSeatStateLoader({
        gameId: 'summonerwars',
        matchId: 'match-1',
        gameConfig,
        isTutorialRoute: false,
        matchStatusIsHost: true,
        statusPlayerID: '0',
        guestId: 'fallback-guest',
        token: 'stale-user-token',
        localStorageTick: 0,
        ...overrides,
    }),
);

describe('useOnlineAiSeatStateLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.mocked(matchApi.getMatch).mockResolvedValue(buildMatchInfo());
    });

    afterEach(() => {
        cleanup();
        localStorage.clear();
    });

    it('房主重进在线 AI 房时应补领缺失的 AI 座位凭据，且不覆盖真人主座位凭据', async () => {
        localStorage.setItem('match_creds_match-1', JSON.stringify({
            matchID: 'match-1',
            playerID: '0',
            credentials: 'human-credential',
            gameName: 'summonerwars',
            playerName: 'Host',
            updatedAt: 1000,
        }));
        vi.mocked(matchApi.claimSeat).mockResolvedValue({ playerCredentials: 'ai-credential-1' });

        const { result } = renderLoader();

        await waitFor(() => {
            expect(result.current.onlineAiSeatCredentials).toEqual({ '1': 'ai-credential-1' });
        });
        expect(result.current.onlineAiSeatControllers['1']).toEqual({ type: 'local-ai', difficulty: 'normal' });
        expect(matchApi.claimSeat).toHaveBeenCalledWith('summonerwars', 'match-1', '1', {
            guestId: 'guest-owner',
            playerName: 'AI Opponent',
        });
        expect(JSON.parse(localStorage.getItem('match_ai_creds_match-1') || '{}')).toEqual({
            '1': 'ai-credential-1',
        });
        expect(JSON.parse(localStorage.getItem('match_creds_match-1') || '{}')).toMatchObject({
            playerID: '0',
            credentials: 'human-credential',
        });
    });

    it('已有 AI 座位凭据时应直接恢复，不重复 claim-seat', async () => {
        localStorage.setItem('match_ai_creds_match-1', JSON.stringify({
            '1': 'stored-ai-credential',
        }));

        const { result } = renderLoader();

        await waitFor(() => {
            expect(result.current.onlineAiSeatCredentials).toEqual({ '1': 'stored-ai-credential' });
        });
        expect(matchApi.claimSeat).not.toHaveBeenCalled();
    });

    it('非房主视角只恢复已有 AI 座位定义，不主动补领凭据', async () => {
        const { result } = renderLoader({
            matchStatusIsHost: false,
            statusPlayerID: '1',
        });

        await waitFor(() => {
            expect(result.current.onlineAiSeatControllers['1']).toEqual({ type: 'local-ai', difficulty: 'normal' });
        });
        expect(result.current.onlineAiSeatCredentials).toEqual({});
        expect(matchApi.claimSeat).not.toHaveBeenCalled();
        expect(localStorage.getItem('match_ai_creds_match-1')).toBeNull();
    });
});
