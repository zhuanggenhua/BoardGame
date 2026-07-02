import { ADMIN_API_URL } from '../config/server';

export type GamePlayTimeStat = {
    gameName?: string;
    totalDuration?: number;
    count?: number;
};

export type AdminStatsResponse = {
    playTimeStats: GamePlayTimeStat[];
};

export const ADMIN_STATS_ENDPOINT = `${ADMIN_API_URL}/stats`;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeGamePlayTimeStat(value: unknown): GamePlayTimeStat {
    if (!isRecord(value)) {
        return {};
    }

    return {
        gameName: typeof value.gameName === 'string' ? value.gameName : undefined,
        totalDuration: typeof value.totalDuration === 'number' ? value.totalDuration : Number(value.totalDuration),
        count: typeof value.count === 'number' ? value.count : Number(value.count),
    };
}

export function normalizeAdminStatsResponse(value: unknown): AdminStatsResponse {
    if (!isRecord(value) || !Array.isArray(value.playTimeStats)) {
        return { playTimeStats: [] };
    }

    return {
        playTimeStats: value.playTimeStats.map(normalizeGamePlayTimeStat),
    };
}

export async function fetchAdminStats({ signal }: { signal?: AbortSignal } = {}): Promise<AdminStatsResponse> {
    const response = await fetch(ADMIN_STATS_ENDPOINT, { signal });
    if (!response.ok) {
        throw new Error(`加载后台统计失败: ${response.status}`);
    }

    return normalizeAdminStatsResponse(await response.json());
}
