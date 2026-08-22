/* @vitest-environment happy-dom */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBalancedPopularityByGameId, useGamePopularityRanking } from '../useGamePopularityRanking';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('buildBalancedPopularityByGameId', () => {
    it('会综合对局数量和游玩时长计算热度分，而不是只看单一指标', () => {
        const popularityByGameId = buildBalancedPopularityByGameId([
            { gameName: 'quick-duels', totalDuration: 1_000, count: 20 },
            { gameName: 'long-session', totalDuration: 10_000, count: 2 },
            { gameName: 'new-game', totalDuration: 0, count: 0 },
        ]);

        expect(popularityByGameId['quick-duels']).toBeGreaterThan(popularityByGameId['long-session']);
        expect(popularityByGameId['long-session']).toBeGreaterThan(popularityByGameId['new-game']);
    });

    it('会按游戏名聚合统计，并兼容大小写和非法数值', () => {
        const popularityByGameId = buildBalancedPopularityByGameId([
            { gameName: 'SmashUp', totalDuration: 3_600, count: 3 },
            { gameName: 'smashup', totalDuration: 1_800, count: 2 },
            { gameName: 'bad-data', totalDuration: Number.NaN, count: Number.POSITIVE_INFINITY },
            { gameName: '   ', totalDuration: 500, count: 1 },
        ]);

        expect(popularityByGameId.smashup).toBeGreaterThan(0);
        expect(Object.keys(popularityByGameId)).toContain('smashup');
        expect(Object.keys(popularityByGameId)).not.toContain('SmashUp');
        expect(popularityByGameId['bad-data']).toBe(0);
        expect(Object.keys(popularityByGameId)).not.toContain('');
    });

    it('首页热度应请求管理统计入口，而不是认证入口下的错误路径', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({
                playTimeStats: [
                    { gameName: 'dicethrone', totalDuration: 10_000, count: 20 },
                ],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useGamePopularityRanking());

        await waitFor(() => {
            expect(result.current.status).toBe('success');
        });
        expect(result.current.popularityByGameId.dicethrone).toBeGreaterThan(0);
        expect(fetchMock).toHaveBeenCalledWith('/admin-api/stats', expect.any(Object));
    });

    it('会区分后台统计真实为空和请求失败', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ playTimeStats: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useGamePopularityRanking());

        await waitFor(() => {
            expect(result.current.status).toBe('success');
        });
        expect(result.current.popularityByGameId).toEqual({});
        expect(result.current.error).toBeUndefined();
    });

    it('后台统计请求失败时保留失败状态，而不是伪装成真实无热度', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

        const { result } = renderHook(() => useGamePopularityRanking());

        await waitFor(() => {
            expect(result.current.status).toBe('failed');
        });
        expect(result.current.popularityByGameId).toEqual({});
        expect(result.current.error).toContain('network down');
        expect(warnSpy).toHaveBeenCalled();
    });

    it('禁用时不请求后台统计，并明确返回 disabled 状态', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useGamePopularityRanking(false));

        expect(result.current.status).toBe('disabled');
        expect(result.current.popularityByGameId).toEqual({});
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
