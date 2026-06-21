import { describe, expect, it } from 'vitest';
import { buildBalancedPopularityByGameId } from '../useGamePopularityRanking';

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
});
