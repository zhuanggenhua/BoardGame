import type { MatchState } from '../../engine/types';
import type {
    FeedbackClientContext,
    FeedbackDiagnosticPacket,
    FeedbackReplayability,
} from './feedbackPayload';

export type FeedbackDiagnosticConsumptionResult = {
    consumed: boolean;
    reasons: string[];
    observed: {
        matchId?: string;
        roomId?: string;
        requestId?: string;
        stateId?: number;
        decisionEpoch?: number;
        phase?: string;
        interactionId?: string;
        responseWindowId?: string;
    };
};

/**
 * 导入现场包后，直接用运行时状态证明注入内容已被消费。
 * 这是 E2E / 回放工具的断言入口，不把夹具输入当作运行事实。
 */
export function assertFeedbackDiagnosticPacketConsumed(args: {
    packet: FeedbackDiagnosticPacket;
    runtimeState: MatchState<unknown>;
    runtimeStateId?: number;
}): FeedbackDiagnosticConsumptionResult {
    const state = args.runtimeState;
    const sys = state.sys;
    const interactionId = typeof sys.interaction?.current?.id === 'string'
        ? sys.interaction.current.id
        : undefined;
    const responseWindowId = typeof sys.responseWindow?.current?.id === 'string'
        ? sys.responseWindow.current.id
        : undefined;
    const requestId = interactionId ?? responseWindowId;
    const runtimeRoomId = (sys as unknown as { roomId?: unknown }).roomId;
    const observed = {
        ...(typeof sys.matchId === 'string' ? { matchId: sys.matchId } : {}),
        ...(typeof runtimeRoomId === 'string' && runtimeRoomId.trim().length > 0
            ? { roomId: runtimeRoomId.trim() }
            : {}),
        ...(requestId ? { requestId } : {}),
        ...(args.runtimeStateId !== undefined ? { stateId: args.runtimeStateId } : {}),
        ...(typeof sys.decisionEpoch === 'number' ? { decisionEpoch: sys.decisionEpoch } : {}),
        ...(typeof sys.phase === 'string' ? { phase: sys.phase } : {}),
        ...(interactionId ? { interactionId } : {}),
        ...(responseWindowId ? { responseWindowId } : {}),
    };
    const reasons: string[] = [];
    const correlation = args.packet.correlation;

    if (correlation.matchId && observed.matchId !== correlation.matchId) {
        reasons.push('correlation.matchId 未被运行时消费');
    }
    if (correlation.roomId && observed.roomId !== correlation.roomId) {
        reasons.push('correlation.roomId 未被运行时消费');
    }
    if (correlation.requestId && observed.requestId !== correlation.requestId) {
        reasons.push('correlation.requestId 未被运行时消费');
    }
    if (correlation.stateId !== undefined && observed.stateId !== correlation.stateId) {
        reasons.push('correlation.stateId 未被运行时消费');
    }
    if (correlation.decisionEpoch !== undefined && observed.decisionEpoch !== correlation.decisionEpoch) {
        reasons.push('correlation.decisionEpoch 未被运行时消费');
    }
    if (args.packet.phase && observed.phase !== args.packet.phase) {
        reasons.push('phase 未被运行时消费');
    }
    if (args.packet.interaction && typeof args.packet.interaction === 'object') {
        const packetInteractionId = (args.packet.interaction as { id?: unknown }).id;
        if (typeof packetInteractionId === 'string' && observed.interactionId !== packetInteractionId) {
            reasons.push('interaction 未被运行时消费');
        }
    }
    if (args.packet.responseWindow && typeof args.packet.responseWindow === 'object') {
        const packetResponseWindowId = (args.packet.responseWindow as { id?: unknown }).id;
        if (typeof packetResponseWindowId === 'string' && observed.responseWindowId !== packetResponseWindowId) {
            reasons.push('responseWindow 未被运行时消费');
        }
    }

    return {
        consumed: reasons.length === 0,
        reasons,
        observed,
    };
}

const cloneJsonValue = <T,>(value: T): T | undefined => {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value)) as T;
    } catch {
        return undefined;
    }
};

const createId = (prefix: string): string => {
    const randomUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return prefix + '-' + randomUuid;
};

const getStateRecord = (state: MatchState<unknown> | undefined): Record<string, unknown> => (
    state && typeof state === 'object' ? state as unknown as Record<string, unknown> : {}
);

const getStateId = (state: MatchState<unknown> | undefined): number | undefined => {
    const sys = getStateRecord(state).sys as Record<string, unknown> | undefined;
    const stateId = sys?.stateId;
    return typeof stateId === 'number' ? stateId : undefined;
};

const getStateRevision = (state: MatchState<unknown> | undefined): number | undefined => {
    const sys = getStateRecord(state).sys as Record<string, unknown> | undefined;
    const revision = sys?.revision;
    return typeof revision === 'number' ? revision : undefined;
};

const collectMissingFields = (args: {
    state?: MatchState<unknown>;
    clientContext?: FeedbackClientContext;
    requestId?: string;
    roomId?: string;
    stateId?: number;
    stateRevision?: number;
    snapshots: FeedbackDiagnosticPacket['snapshots'];
}): string[] => {
    const missing: string[] = [];
    if (!args.clientContext?.matchId) missing.push('correlation.matchId');
    if (!args.roomId) missing.push('correlation.roomId');
    if (!args.requestId) missing.push('correlation.requestId');
    if (args.stateId === undefined) missing.push('correlation.stateId');
    if (args.stateRevision === undefined) missing.push('correlation.stateRevision');
    if (!args.state) missing.push('snapshots.at');
    if (!args.snapshots.before) missing.push('snapshots.before');
    if (!args.snapshots.after) missing.push('snapshots.after');
    return missing;
};

const resolveReplayability = (missingFields: string[]): FeedbackReplayability => {
    if (missingFields.length === 0) return 'full';
    if (missingFields.includes('snapshots.at')) return 'unreplayable';
    return 'partial';
};

export function buildFeedbackDiagnosticPacket(args: {
    state?: MatchState<unknown>;
    clientContext?: FeedbackClientContext;
    source: FeedbackDiagnosticPacket['source'];
    chainId?: string;
    roomId?: string;
    requestId?: string;
    stateId?: number;
    stateRevision?: number;
    randomCursor?: number;
    before?: MatchState<unknown>;
    after?: MatchState<unknown>;
    legalActions?: unknown;
    aiDecisionPreview?: unknown;
    collectionErrors?: string[];
}): FeedbackDiagnosticPacket {
    const state = args.state;
    const sys = state?.sys;
    const stateId = args.stateId ?? getStateId(state);
    const stateRevision = args.stateRevision ?? getStateRevision(state);
    const snapshots = {
        before: cloneJsonValue(args.before),
        at: cloneJsonValue(state),
        after: cloneJsonValue(args.after),
    };
    const missingFields = collectMissingFields({
        state,
        clientContext: args.clientContext,
        requestId: args.requestId,
        roomId: args.roomId,
        stateId,
        stateRevision,
        snapshots,
    });
    const collectionStatus = args.collectionErrors?.length
        ? 'partial'
        : 'complete';
    const replayability = resolveReplayability(missingFields);

    return {
        schemaVersion: 1,
        captureId: createId('feedback'),
        ...(args.chainId ? { chainId: args.chainId } : {}),
        capturedAt: new Date().toISOString(),
        source: args.source,
        collectionStatus,
        replayability,
        missingFields,
        correlation: {
            matchId: args.clientContext?.matchId,
            ...(args.roomId ? { roomId: args.roomId } : {}),
            ...(args.requestId ? { requestId: args.requestId } : {}),
            ...(stateId !== undefined ? { stateId } : {}),
            ...(stateRevision !== undefined ? { stateRevision } : {}),
            ...(typeof sys?.decisionEpoch === 'number' ? { decisionEpoch: sys.decisionEpoch } : {}),
        },
        build: args.clientContext
            ? {
                appVersion: args.clientContext.appVersion,
                appCommitSha: args.clientContext.appCommitSha,
                appBuildTime: args.clientContext.appBuildTime,
                appReleaseChannel: args.clientContext.appReleaseChannel,
            }
            : undefined,
        phase: sys?.phase,
        turnNumber: sys?.turnNumber,
        currentPlayerId: typeof state?.core === 'object'
            ? typeof (state.core as Record<string, unknown>)?.currentPlayer === 'string'
                ? (state.core as Record<string, unknown>).currentPlayer as string
                : undefined
            : undefined,
        interaction: cloneJsonValue(sys?.interaction?.current),
        responseWindow: cloneJsonValue(sys?.responseWindow?.current),
        legalActions: cloneJsonValue(args.legalActions),
        aiDecisionPreview: cloneJsonValue(args.aiDecisionPreview),
        snapshots,
        actionLogTail: Array.isArray(sys?.actionLog?.entries)
            ? cloneJsonValue(sys.actionLog.entries.slice(-12))
            : undefined,
        eventStreamTail: Array.isArray(sys?.eventStream?.entries)
            ? cloneJsonValue(sys.eventStream.entries.slice(-12))
            : undefined,
        undo: cloneJsonValue(sys?.undo),
        ...(args.randomCursor !== undefined ? { randomCursor: args.randomCursor } : {}),
        ...(args.collectionErrors?.length ? { collectionErrors: args.collectionErrors } : {}),
    };
}

export const serializeFeedbackDiagnosticPacket = (
    packet: FeedbackDiagnosticPacket | undefined,
): string | undefined => {
    if (!packet) return undefined;
    try {
        return JSON.stringify(packet, null, 2);
    } catch {
        return undefined;
    }
};
