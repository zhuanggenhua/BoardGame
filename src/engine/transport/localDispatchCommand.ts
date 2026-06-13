import type { Command, MatchState } from '../types';
import { resolveCoreCurrentPlayerId } from './localAiDiagnostics';
import { injectTutorialInteractionId } from './tutorialAiCommand';

export type LocalDispatchCommandContext = {
    command: Command;
    resolvedPlayerId: string;
    tutorialOverrideId?: string;
    aiTraceToken?: string;
    isTutorialAiCommand: boolean;
};

type LocalDispatchPayloadMeta = {
    internalOverrideId?: string;
    tutorialOverrideId?: string;
    aiTraceToken?: string;
    isTutorialAiCommand: boolean;
    normalizedPayload: unknown;
};

function parseLocalDispatchPayloadMeta(payload: unknown): LocalDispatchPayloadMeta {
    const payloadRecord = payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : null;
    const internalOverrideId = typeof payloadRecord?.__internalPlayerId === 'string'
        ? payloadRecord.__internalPlayerId
        : undefined;
    const tutorialOverrideId = typeof payloadRecord?.__tutorialPlayerId === 'string'
        ? payloadRecord.__tutorialPlayerId
        : undefined;
    const aiTraceToken = typeof payloadRecord?.__aiTraceToken === 'string'
        ? payloadRecord.__aiTraceToken
        : undefined;
    const isTutorialAiCommand = payloadRecord?.__tutorialAiCommand === true;
    const normalizedPayload = payloadRecord && (
        '__internalPlayerId' in payloadRecord
        || '__internalAiCommand' in payloadRecord
        || '__tutorialPlayerId' in payloadRecord
        || '__tutorialAiCommand' in payloadRecord
        || '__aiTraceToken' in payloadRecord
    )
        ? (() => {
            const {
                __internalPlayerId: _ignored0,
                __internalAiCommand: _ignored1,
                __tutorialPlayerId: _ignored,
                __tutorialAiCommand: _ignored2,
                __aiTraceToken: _ignored3,
                ...rest
            } = payloadRecord;
            return rest;
        })()
        : payload;

    return {
        internalOverrideId,
        tutorialOverrideId,
        aiTraceToken,
        isTutorialAiCommand,
        normalizedPayload,
    };
}

function resolveSystemPlayerId(commandType: string, state: MatchState<unknown>): string | undefined {
    if (commandType.startsWith('SYS_INTERACTION_')) {
        return state.sys.interaction?.current?.playerId;
    }

    const responseWindow = state.sys.responseWindow?.current;
    if (responseWindow) {
        const index = responseWindow.currentResponderIndex ?? 0;
        return responseWindow.responderQueue?.[index];
    }

    return undefined;
}

function withNoSnapshotFlag(payload: unknown): unknown {
    const payloadRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : null;
    if (payloadRecord?._noSnapshot === true) {
        return payload;
    }
    return {
        ...(payloadRecord ?? {}),
        _noSnapshot: true,
    };
}

export function buildLocalDispatchCommand(args: {
    commandType: string;
    payload: unknown;
    state: MatchState<unknown>;
    localPregameControlledPlayerId: string | null;
}): LocalDispatchCommandContext {
    const {
        commandType,
        payload,
        state,
        localPregameControlledPlayerId,
    } = args;

    const meta = parseLocalDispatchPayloadMeta(payload);
    const playerOverrideId = meta.internalOverrideId ?? meta.tutorialOverrideId;
    const resolvedPlayerId = playerOverrideId
        ?? resolveSystemPlayerId(commandType, state)
        ?? localPregameControlledPlayerId
        ?? resolveCoreCurrentPlayerId(state.core)
        ?? '0';

    const tutorialInjectedPayload = injectTutorialInteractionId({
        state,
        commandType,
        payload: meta.normalizedPayload,
        tutorialPlayerId: playerOverrideId ?? resolvedPlayerId,
        isTutorialAiCommand: meta.isTutorialAiCommand,
    });
    const finalPayload = meta.isTutorialAiCommand
        ? withNoSnapshotFlag(tutorialInjectedPayload)
        : tutorialInjectedPayload;

    return {
        command: {
            type: commandType,
            playerId: resolvedPlayerId,
            payload: finalPayload,
            timestamp: Date.now(),
            skipValidation: true,
        },
        resolvedPlayerId,
        tutorialOverrideId: playerOverrideId,
        aiTraceToken: meta.aiTraceToken,
        isTutorialAiCommand: meta.isTutorialAiCommand,
    };
}
