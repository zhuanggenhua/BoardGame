import type { ActionLogEntry, ActionLogSegment } from '../../engine/types';

export interface ActionLogRow {
    id: string;
    timeLabel: string;
    playerLabel: string;
    text: string;
    /** 保留原始片段结构，用于渲染卡牌预览 */
    segments: ActionLogSegment[];
}

interface BuildActionLogRowsOptions {
    formatTime?: (timestamp: number) => string;
    getPlayerLabel?: (playerId: string | number) => string;
    newestFirst?: boolean;
}

export const formatActionLogSegments = (segments: ActionLogSegment[] = []): string => {
    if (!Array.isArray(segments)) return '';
    const parts = segments
        .map((segment) => {
            if (segment.type === 'text') return segment.text;
            return segment.previewText ?? segment.cardId ?? '';
        })
        .filter((text) => Boolean(text?.trim()));
    return parts.join(' ');
};

export const buildActionLogRows = (
    entries: ActionLogEntry[] = [],
    {
        formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString(),
        getPlayerLabel = (playerId: string | number) => `P${playerId}`,
        newestFirst = true,
    }: BuildActionLogRowsOptions = {}
): ActionLogRow[] => {
    if (!Array.isArray(entries)) return [];
    const sorted = [...entries].sort((a, b) => {
        return newestFirst ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });
    return sorted.map((entry) => ({
        id: entry.id,
        timeLabel: formatTime(entry.timestamp),
        playerLabel: getPlayerLabel(entry.actorId),
        text: formatActionLogSegments(entry.segments) || entry.kind,
        segments: entry.segments || [],
    }));
};
