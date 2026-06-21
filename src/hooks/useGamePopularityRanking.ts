import React from 'react';
import { AUTH_API_URL } from '../config/server';

export type GamePlayTimeStat = {
    gameName?: string;
    totalDuration?: number;
    count?: number;
};

type AdminStatsResponse = {
    playTimeStats?: GamePlayTimeStat[];
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

export const useGamePopularityRanking = (enabled = true) => {
    const [popularityByGameId, setPopularityByGameId] = React.useState<Record<string, number>>({});

    React.useEffect(() => {
        if (!enabled) {
            setPopularityByGameId({});
            return undefined;
        }

        const controller = new AbortController();

        void fetch(`${AUTH_API_URL}/admin/stats`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`加载游戏热度失败: ${response.status}`);
                }
                return response.json() as Promise<AdminStatsResponse>;
            })
            .then((data) => {
                if (controller.signal.aborted) {
                    return;
                }
                setPopularityByGameId(buildBalancedPopularityByGameId(data.playTimeStats ?? []));
            })
            .catch((error) => {
                if (controller.signal.aborted) {
                    return;
                }
                console.warn('[Lobby] 加载游戏热度失败，回退固定排序', error);
                setPopularityByGameId({});
            });

        return () => controller.abort();
    }, [enabled]);

    return popularityByGameId;
};
