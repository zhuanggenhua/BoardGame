import type { ActionLogEntry, MatchState } from '../../engine/types';
import {
    buildActionLogRows,
    createStateBackedActionLogPlayerLabel,
} from '../../components/game/utils/actionLogFormat';

const FEEDBACK_ACTION_LOG_TAIL_LIMIT = 12;
const FEEDBACK_EVENT_STREAM_TAIL_LIMIT = 12;
const FEEDBACK_UNDO_SNAPSHOT_LIMIT = 3;
const FEEDBACK_VISIBLE_RESOURCE_LIMIT = 40;

export type FeedbackActionLogRow = {
    timeLabel: string;
    playerLabel: string;
    text: string;
};

export type FeedbackVisibleResourceSnapshot = {
    gameId?: string;
    playerId?: string;
    resource: string;
    value?: number | string;
    text?: string;
    testId?: string;
    ariaLabel?: string;
    title?: string;
};

const sanitizeFeedbackCore = (core: unknown): unknown => {
    if (!core || typeof core !== 'object') return core;
    const obj = core as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
            const first = val[0] as Record<string, unknown>;
            const isStaticDef = 'description' in first || 'effects' in first || 'i18n' in first || 'colorTheme' in first;
            if (isStaticDef) {
                result[key] = val.map((item: Record<string, unknown>) => item.id ?? item.name ?? '?');
                continue;
            }
        }
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            result[key] = sanitizeFeedbackCore(val);
        } else {
            result[key] = val;
        }
    }
    return result;
};

const cloneJsonValue = <T,>(value: T): T | undefined => {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value)) as T;
    } catch {
        return undefined;
    }
};

const asFeedbackRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const parseResourceValue = (value: string | undefined): number | string | undefined => {
    if (!value) return undefined;
    const normalized = value.trim();
    if (!normalized) return undefined;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : normalized;
};

const isActionLogEntry = (value: unknown): value is ActionLogEntry => {
    const entry = asFeedbackRecord(value);
    return (
        typeof entry.id === 'string'
        && typeof entry.timestamp === 'number'
        && (typeof entry.actorId === 'string' || typeof entry.actorId === 'number')
        && typeof entry.kind === 'string'
        && Array.isArray(entry.segments)
    );
};

export const buildVisibleResourceSnapshot = (): FeedbackVisibleResourceSnapshot[] => {
    if (typeof document === 'undefined') return [];

    return Array.from(document.querySelectorAll<HTMLElement>('[data-feedback-resource]'))
        .slice(0, FEEDBACK_VISIBLE_RESOURCE_LIMIT)
        .map((element) => ({
            gameId: element.dataset.feedbackGame || undefined,
            playerId: element.dataset.feedbackPlayerId || undefined,
            resource: element.dataset.feedbackResource || 'unknown',
            value: parseResourceValue(element.dataset.feedbackResourceValue),
            text: element.textContent?.trim() || undefined,
            testId: element.dataset.testid || undefined,
            ariaLabel: element.getAttribute('aria-label') || undefined,
            title: element.getAttribute('title') || undefined,
        }));
};

export const buildGameFeedbackActionLog = (
    state: MatchState<unknown>,
    actionLogRows: FeedbackActionLogRow[] = [],
): string | undefined => {
    try {
        const actionLogEntries = Array.isArray(state.sys?.actionLog?.entries)
            ? state.sys.actionLog.entries
            : [];
        const eventStreamEntries = Array.isArray(state.sys?.eventStream?.entries)
            ? state.sys.eventStream.entries
            : [];
        const undoSnapshots = Array.isArray(state.sys?.undo?.snapshots)
            ? state.sys.undo.snapshots
            : [];
        const interaction = cloneJsonValue(state.sys?.interaction?.current);
        const responseWindow = cloneJsonValue(state.sys?.responseWindow?.current);
        const formattedActionLogRows = actionLogRows.length > 0
            ? actionLogRows
            : buildActionLogRows(actionLogEntries.filter(isActionLogEntry), {
                newestFirst: false,
                getPlayerLabel: createStateBackedActionLogPlayerLabel(
                    state,
                    (playerId) => `玩家${playerId}`,
                ),
            });
        const humanReadableLog = formattedActionLogRows.length > 0
            ? formattedActionLogRows.map((row) => `[${row.timeLabel}] ${row.playerLabel}: ${row.text}`).join('\n')
            : '';
        const visibleResourceSnapshot = buildVisibleResourceSnapshot();

        return JSON.stringify({
            kind: 'user-feedback-diagnostic',
            phase: state.sys?.phase,
            turnNumber: state.sys?.turnNumber,
            humanReadableLog,
            ...(visibleResourceSnapshot.length > 0 ? { visibleResourceSnapshot } : {}),
            actionLogTail: actionLogEntries.slice(-FEEDBACK_ACTION_LOG_TAIL_LIMIT).map((rawEntry) => {
                const entry = asFeedbackRecord(rawEntry);
                const event = asFeedbackRecord(entry.event);
                return {
                    text: typeof entry.text === 'string' ? entry.text : undefined,
                    type: event.type,
                    timestamp: entry.timestamp,
                };
            }),
            eventStreamTail: eventStreamEntries.slice(-FEEDBACK_EVENT_STREAM_TAIL_LIMIT).map((rawEntry) => {
                const entry = asFeedbackRecord(rawEntry);
                return {
                    type: entry.type,
                    timestamp: entry.timestamp,
                    payload: cloneJsonValue(entry.payload),
                };
            }),
            interaction,
            responseWindow,
            undoSnapshots: undoSnapshots.slice(-FEEDBACK_UNDO_SNAPSHOT_LIMIT).map((rawSnapshot, index) => {
                const snapshot = asFeedbackRecord(rawSnapshot);
                const sys = asFeedbackRecord(snapshot.sys);
                return {
                    index: undoSnapshots.length - Math.min(undoSnapshots.length, FEEDBACK_UNDO_SNAPSHOT_LIMIT) + index,
                    turnNumber: sys.turnNumber,
                    phase: sys.phase,
                    core: sanitizeFeedbackCore(snapshot.core),
                };
            }),
            currentStateSummary: {
                turnNumber: state.sys?.turnNumber,
                phase: state.sys?.phase,
                core: sanitizeFeedbackCore(state.core),
            },
        }, null, 2);
    } catch {
        return undefined;
    }
};

export const buildGameFeedbackStateSnapshot = (state: MatchState<unknown>): string | undefined => {
    try {
        return JSON.stringify(state, null, 2);
    } catch {
        return undefined;
    }
};
