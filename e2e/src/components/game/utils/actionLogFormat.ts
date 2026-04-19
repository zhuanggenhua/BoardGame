import type { ActionLogEntry, ActionLogSegment } from '../../../engine/types';
import i18n from '../../../lib/i18n';

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
            if (segment.type === 'i18n') {
                const resolvedParams = { ...segment.params };
                if (segment.paramI18nKeys) {
                    for (const paramKey of segment.paramI18nKeys) {
                        const rawValue = resolvedParams[paramKey];
                        if (typeof rawValue === 'string' && rawValue) {
                            const fullKey = `${segment.ns}:${rawValue}`;
                            resolvedParams[paramKey] = i18n.exists(fullKey)
                                ? i18n.t(fullKey, { defaultValue: rawValue })
                                : rawValue;
                        }
                    }
                }
                const fullKey = `${segment.ns}:${segment.key}`;
                return i18n.exists(fullKey)
                    ? i18n.t(fullKey, resolvedParams)
                    : segment.key;
            }
            // breakdown segment：纯文本 fallback 只显示数值
            if (segment.type === 'breakdown') return segment.displayText;
            // diceResult segment：纯文本 fallback 显示骰子点数（兼容异常数据）
            if (segment.type === 'diceResult') {
                if (!Array.isArray(segment.dice) || segment.dice.length === 0) return '';
                const values = segment.dice.map((d, index) => {
                    if (typeof d === 'number') return d;
                    if (d && typeof d === 'object' && typeof d.value === 'number') return d.value;
                    return index + 1;
                });
                return `[${values.join(',')}]`;
            }
            // card segment：如果有 previewTextNs，翻译 previewText
            if (segment.previewTextNs && segment.previewText) {
                const fullKey = `${segment.previewTextNs}:${segment.previewText}`;
                return i18n.exists(fullKey)
                    ? i18n.t(fullKey, { defaultValue: segment.previewText })
                    : segment.previewText;
            }
            return segment.previewText ?? segment.cardId ?? '';
        })
        .filter((text) => Boolean(text?.trim()));
    return parts.join(' ');
};

/**
 * 判断参数名是否为玩家 ID 类型。
 * 匹配规则：精确匹配 'playerId'，或以 'PlayerId' 结尾（如 targetPlayerId、fromPlayerId）。
 */
const isPlayerIdParam = (key: string): boolean =>
    key === 'playerId' || key.endsWith('PlayerId');

/**
 * 将 i18n segment 中的玩家 ID 参数值替换为玩家昵称。
 * 例如 params.targetPlayerId = '1' → params.targetPlayerId = '游客4621'
 *      params.playerId = '0' → params.playerId = '游客6847'
 */
const resolvePlayerIdParams = (
    segments: ActionLogSegment[],
    getPlayerLabel: (playerId: string | number) => string,
): ActionLogSegment[] =>
    segments.map((seg) => {
        if (seg.type !== 'i18n' || !seg.params) return seg;
        let changed = false;
        const resolved: Record<string, string | number> = {};
        for (const [key, value] of Object.entries(seg.params)) {
            if (isPlayerIdParam(key) && (typeof value === 'string' || typeof value === 'number')) {
                resolved[key] = getPlayerLabel(value);
                changed = true;
            } else {
                resolved[key] = value;
            }
        }
        return changed ? { ...seg, params: resolved } : seg;
    });

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
    return sorted.map((entry) => {
        const segments = resolvePlayerIdParams(entry.segments || [], getPlayerLabel);
        return {
            id: entry.id,
            timeLabel: formatTime(entry.timestamp),
            playerLabel: getPlayerLabel(entry.actorId),
            text: formatActionLogSegments(segments) || entry.kind,
            segments,
        };
    });
};
