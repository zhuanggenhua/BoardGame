import type { QidahenSeasonSummary } from './types';

export const buildSeasonSummary = (
    title: string,
    timestamp: number,
    lines: string[],
): QidahenSeasonSummary => ({
    id: `season-${timestamp}`,
    title,
    lines,
});
