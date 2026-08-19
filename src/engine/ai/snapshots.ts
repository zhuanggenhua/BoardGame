import type { MatchState } from '../types';
import type { AiInteractionSupportDeclaration } from './decisionSemantics';
import type { AiHint, AiInteractionSnapshot, AiResponseWindowSnapshot } from './types';

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
        ai?: unknown;
        data?: {
            sourceId?: unknown;
            ai?: unknown;
            choiceRequest?: unknown;
            options?: Array<{
                id?: unknown;
                label?: unknown;
                value?: unknown;
                disabled?: unknown;
                disabledReason?: unknown;
                displayMode?: unknown;
                _ai?: unknown;
            }>;
            multi?: unknown;
        };
    } | null | undefined;

    if (!current || typeof current.id !== 'string' || typeof current.kind !== 'string') {
        return null;
    }

    const rawAi = current.ai && typeof current.ai === 'object'
        ? current.ai
        : current.data?.ai && typeof current.data.ai === 'object'
            ? current.data.ai
            : undefined;
    const ai = rawAi ? toJsonSafe(rawAi as AiInteractionSupportDeclaration) : undefined;
    const aiDecisions = Array.isArray(ai?.decisions)
        ? ai.decisions
        : undefined;
    const choiceRequest = current.data?.choiceRequest && typeof current.data.choiceRequest === 'object'
        ? toJsonSafe(current.data.choiceRequest as Record<string, unknown>)
        : undefined;

    const options = Array.isArray(current.data?.options)
        ? current.data.options
            .filter((option): option is NonNullable<typeof option> => !!option && typeof option.id === 'string')
            .map((option) => ({
                id: option.id as string,
                ...(typeof option.label === 'string' ? { label: option.label } : {}),
                ...(option.value !== undefined ? { value: toJsonSafe(option.value) } : {}),
                ...(typeof option.disabled === 'boolean' ? { disabled: option.disabled } : {}),
                ...(typeof option.disabledReason === 'string' ? { disabledReason: option.disabledReason } : {}),
                ...(typeof option.displayMode === 'string' ? { displayMode: option.displayMode } : {}),
                ...(option._ai && typeof option._ai === 'object' ? { _ai: toJsonSafe(option._ai as AiHint) } : {}),
            }))
        : [];

    return {
        id: current.id,
        kind: current.kind,
        ...((typeof current.sourceId === 'string'
            ? current.sourceId
            : typeof current.data?.sourceId === 'string'
                ? current.data.sourceId
                : undefined) ? {
            sourceId: typeof current.sourceId === 'string'
                ? current.sourceId
                : current.data?.sourceId as string,
        } : {}),
        ...(typeof current.playerId === 'string' ? { playerId: current.playerId } : {}),
        options,
        ...(current.data?.multi !== undefined ? { multi: toJsonSafe(current.data.multi) } : {}),
        ...(ai ? { ai } : {}),
        ...(aiDecisions ? { aiDecisions } : {}),
        ...(choiceRequest ? { choiceRequest } : {}),
    };
}

export function extractAiResponseWindowSnapshot(viewState: unknown): AiResponseWindowSnapshot | null {
    const state = viewState as MatchState<unknown> | undefined;
    const current = state?.sys?.responseWindow?.current as {
        windowType?: unknown;
        sourceId?: unknown;
        currentResponderIndex?: unknown;
        responderQueue?: unknown;
        allowedCommands?: unknown;
        pendingInteractionId?: unknown;
    } | null | undefined;

    if (!current) return null;

    const snapshot: AiResponseWindowSnapshot = {};
    if (typeof current.windowType === 'string') {
        snapshot.windowType = current.windowType;
    }
    if (typeof current.sourceId === 'string') {
        snapshot.sourceId = current.sourceId;
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
    if (typeof current.pendingInteractionId === 'string') {
        snapshot.pendingInteractionId = current.pendingInteractionId;
    }

    return Object.keys(snapshot).length > 0 ? snapshot : null;
}
