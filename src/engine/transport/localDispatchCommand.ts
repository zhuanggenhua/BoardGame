import type { Command, MatchState } from '../types';
import { parseDispatchPayloadMeta, resolveDispatchActorPlayerId } from './dispatchActorResolution';
import { resolveCoreCurrentPlayerId } from './localAiDiagnostics';
import { injectTutorialInteractionId } from './tutorialAiCommand';

export type LocalDispatchCommandContext = {
    command: Command;
    resolvedPlayerId: string;
    tutorialOverrideId?: string;
    aiTraceToken?: string;
    isTutorialAiCommand: boolean;
};

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

    const meta = parseDispatchPayloadMeta(payload);
    const resolvedPlayerId = resolveDispatchActorPlayerId({
        meta,
        allowInternalOverride: true,
        allowTutorialOverride: true,
        fallbackPlayerId: resolveSystemPlayerId(commandType, state)
            ?? localPregameControlledPlayerId
            ?? resolveCoreCurrentPlayerId(state.core)
            ?? '0',
    });

    const tutorialInjectedPayload = injectTutorialInteractionId({
        state,
        commandType,
        payload: meta.normalizedPayload,
        tutorialPlayerId: meta.tutorialOverrideId ?? resolvedPlayerId,
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
        tutorialOverrideId: meta.tutorialOverrideId,
        aiTraceToken: meta.aiTraceToken,
        isTutorialAiCommand: meta.isTutorialAiCommand,
    };
}
