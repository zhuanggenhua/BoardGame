import type { MatchState } from '../../engine/types';
import {
    projectFeedbackSnapshot,
    summarizeFeedbackActionLogEntry,
    summarizeFeedbackEventStreamEntry,
    summarizeFeedbackInteraction,
    summarizeFeedbackResponseWindow,
} from './diagnosticPacket';

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

const parseResourceValue = (value: string | undefined): number | string | undefined => {
    if (!value) return undefined;
    const normalized = value.trim();
    if (!normalized) return undefined;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : normalized;
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
        const projectedUndoCount = (state.sys?.undo as { snapshotCount?: unknown } | undefined)?.snapshotCount;
        const visibleResourceSnapshot = buildVisibleResourceSnapshot();
        const actionLogTail = actionLogEntries.slice(-FEEDBACK_ACTION_LOG_TAIL_LIMIT)
            .map(summarizeFeedbackActionLogEntry).filter(Boolean);
        const eventStreamTail = eventStreamEntries.slice(-FEEDBACK_EVENT_STREAM_TAIL_LIMIT)
            .map(summarizeFeedbackEventStreamEntry).filter(Boolean);
        const stateSummary = projectFeedbackSnapshot(state);

        return JSON.stringify({
            kind: 'user-feedback-diagnostic',
            phase: state.sys?.phase,
            turnNumber: state.sys?.turnNumber,
            visibleActionLogRowCount: actionLogRows.length,
            ...(visibleResourceSnapshot.length > 0 ? { visibleResourceSnapshot } : {}),
            actionLogTail,
            eventStreamTail,
            interaction: summarizeFeedbackInteraction(state.sys?.interaction?.current),
            responseWindow: summarizeFeedbackResponseWindow(state.sys?.responseWindow?.current),
            undoCapture: {
                availableCount: typeof projectedUndoCount === 'number' ? projectedUndoCount : undoSnapshots.length,
                capturedCount: Math.min(undoSnapshots.length, FEEDBACK_UNDO_SNAPSHOT_LIMIT),
            },
            undoSnapshots: undoSnapshots.slice(-FEEDBACK_UNDO_SNAPSHOT_LIMIT).map((rawSnapshot, index) => ({
                index: undoSnapshots.length - Math.min(undoSnapshots.length, FEEDBACK_UNDO_SNAPSHOT_LIMIT) + index,
                ...(projectFeedbackSnapshot(rawSnapshot)?.sys
                    ? { sys: (projectFeedbackSnapshot(rawSnapshot) as { sys: unknown }).sys }
                    : {}),
            })),
            currentStateSummary: stateSummary,
        }, null, 2);
    } catch {
        return undefined;
    }
};

export const buildGameFeedbackStateSnapshot = (state: MatchState<unknown>): string | undefined => {
    try {
        return JSON.stringify(projectFeedbackSnapshot(state), null, 2);
    } catch {
        return undefined;
    }
};
