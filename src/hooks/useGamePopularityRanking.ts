import React from 'react';
import { fetchAdminStats, type GamePlayTimeStat } from '../api/admin-stats';

export type { GamePlayTimeStat };

export type GamePopularityRankingStatus = 'disabled' | 'loading' | 'success' | 'failed';

export type GamePopularityRankingResult = {
    status: GamePopularityRankingStatus;
    popularityByGameId: Record<string, number>;
    error?: string;
};

const HEAT_DURATION_WEIGHT = 0.5;
const HEAT_MATCH_COUNT_WEIGHT = 0.5;

function normalizeHeatMetric(value: number, maxValue: number) {
    if (value <= 0 || maxValue <= 0) {
        return 0;
    }
    return Math.log1p(value) / Math.log1p(maxValue);
}

export function buildBalancedPopularityByGameId(playTimeStats: GamePlayTimeStat[]) {
    const aggregatedStats = new Map<string, { totalDuration: number; count: number }>();

    for (const stat of playTimeStats) {
        const gameId = typeof stat.gameName === 'string' ? stat.gameName.trim().toLowerCase() : '';
        if (!gameId) {
            continue;
        }

        const totalDuration = Number.isFinite(Number(stat.totalDuration))
            ? Math.max(0, Number(stat.totalDuration))
            : 0;
        const count = Number.isFinite(Number(stat.count))
            ? Math.max(0, Number(stat.count))
            : 0;

        const current = aggregatedStats.get(gameId) ?? { totalDuration: 0, count: 0 };
        current.totalDuration += totalDuration;
        current.count += count;
        aggregatedStats.set(gameId, current);
    }

    const statsEntries = Array.from(aggregatedStats.entries());
    const maxDuration = Math.max(0, ...statsEntries.map(([, stat]) => stat.totalDuration));
    const maxCount = Math.max(0, ...statsEntries.map(([, stat]) => stat.count));

    return Object.fromEntries(
        statsEntries.map(([gameId, stat]) => {
            const durationHeat = normalizeHeatMetric(stat.totalDuration, maxDuration);
            const matchCountHeat = normalizeHeatMetric(stat.count, maxCount);
            const balancedHeat = (durationHeat * HEAT_DURATION_WEIGHT) + (matchCountHeat * HEAT_MATCH_COUNT_WEIGHT);
            return [gameId, balancedHeat];
        }),
    );
}

export const useGamePopularityRanking = (enabled = true): GamePopularityRankingResult => {
    const [ranking, setRanking] = React.useState<GamePopularityRankingResult>(() => ({
        status: enabled ? 'loading' : 'disabled',
        popularityByGameId: {},
    }));

    React.useEffect(() => {
        if (!enabled) {
            setRanking({ status: 'disabled', popularityByGameId: {} });
            return undefined;
        }

        const controller = new AbortController();

        setRanking({ status: 'loading', popularityByGameId: {} });

        void fetchAdminStats({ signal: controller.signal })
            .then((data) => {
                if (controller.signal.aborted) {
                    return;
                }
                setRanking({
                    status: 'success',
                    popularityByGameId: buildBalancedPopularityByGameId(data.playTimeStats),
                });
            })
            .catch((error) => {
                if (controller.signal.aborted) {
                    return;
                }
                console.warn('[Lobby] 加载游戏热度失败，回退固定排序', error);
                setRanking({
                    status: 'failed',
                    popularityByGameId: {},
                    error: error instanceof Error ? error.message : '加载游戏热度失败',
                });
            });

        return () => controller.abort();
    }, [enabled]);

    return ranking;
};
