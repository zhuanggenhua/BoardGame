import type { MatchState } from '../types';
import type { AiInteractionSnapshot, AiResponseWindowSnapshot } from './types';

const toJsonSafe = <T>(value: T): T => {
    if (value === undefined) return value;
    return JSON.parse(JSON.stringify(value)) as T;
};

export function extractAiInteractionSnapshot(viewState: unknown): AiInteractionSnapshot | null {
    const state = viewState as MatchState<unknown> | undefined;
    const current = state?.sys?.interaction?.current as {
        id?: unknown;
        kind?: unknown;
        sourceId?: unknown;
        playerId?: unknown;
        data?: {
            options?: Array<{
                id?: unknown;
                label?: unknown;
                value?: unknown;
                disabled?: unknown;
                displayMode?: unknown;
            }>;
            multi?: unknown;
        };
    } | null | undefined;

    if (!current || typeof current.id !== 'string' || typeof current.kind !== 'string') {
        return null;
    }

    const options = Array.isArray(current.data?.options)
        ? current.data.options
            .filter((option): option is NonNullable<typeof option> => !!option && typeof option.id === 'string')
            .map((option) => ({
                id: option.id as string,
                ...(typeof option.label === 'string' ? { label: option.label } : {}),
                ...(option.value !== undefined ? { value: toJsonSafe(option.value) } : {}),
                ...(typeof option.disabled === 'boolean' ? { disabled: option.disabled } : {}),
                ...(typeof option.displayMode === 'string' ? { displayMode: option.displayMode } : {}),
            }))
        : [];

    return {
        id: current.id,
        kind: current.kind,
        ...(typeof current.sourceId === 'string' ? { sourceId: current.sourceId } : {}),
        ...(typeof current.playerId === 'string' ? { playerId: current.playerId } : {}),
        options,
        ...(current.data?.multi !== undefined ? { multi: toJsonSafe(current.data.multi) } : {}),
    };
}

export function extractAiResponseWindowSnapshot(viewState: unknown): AiResponseWindowSnapshot | null {
    const state = viewState as MatchState<unknown> | undefined;
    const current = state?.sys?.responseWindow?.current as {
        windowType?: unknown;
        currentResponderIndex?: unknown;
        responderQueue?: unknown;
        allowedCommands?: unknown;
    } | null | undefined;

    if (!current) return null;

    const snapshot: AiResponseWindowSnapshot = {};
    if (typeof current.windowType === 'string') {
        snapshot.windowType = current.windowType;
    }
    if (typeof current.currentResponderIndex === 'number') {
        snapshot.currentResponderIndex = current.currentResponderIndex;
    }
    if (Array.isArray(current.responderQueue)) {
        snapshot.responderQueue = current.responderQueue.filter((item): item is string => typeof item === 'string');
    }
    if (Array.isArray(current.allowedCommands)) {
        snapshot.allowedCommands = current.allowedCommands.filter((item): item is string => typeof item === 'string');
    }

    return Object.keys(snapshot).length > 0 ? snapshot : null;
}
