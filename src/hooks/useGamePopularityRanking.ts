import React from 'react';
import { AUTH_API_URL } from '../config/server';

type GamePlayTimeStat = {
    gameName?: string;
    totalDuration?: number;
};

type AdminStatsResponse = {
    playTimeStats?: GamePlayTimeStat[];
};

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

                const nextPopularityByGameId: Record<string, number> = {};
                for (const stat of data.playTimeStats ?? []) {
                    const gameId = typeof stat.gameName === 'string' ? stat.gameName.trim().toLowerCase() : '';
                    if (!gameId) {
                        continue;
                    }
                    const totalDuration = Number(stat.totalDuration ?? 0);
                    nextPopularityByGameId[gameId] = Number.isFinite(totalDuration) ? Math.max(0, totalDuration) : 0;
                }
                setPopularityByGameId(nextPopularityByGameId);
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
