import type { MatchState } from '../engine/types';
import { type AiResolution, type AiSeatController } from '../engine/ai';
import { GameTransportClient } from '../engine/transport/client';

type HiddenSimpleChoiceOption = {
    id?: unknown;
    disabled?: unknown;
    value?: { skip?: unknown; __cancel__?: unknown; done?: unknown; __emergency_skip__?: unknown };
};

type HiddenSimpleChoiceInteraction = {
    id?: unknown;
    playerId?: unknown;
    kind?: unknown;
    data?: {
        title?: unknown;
        sourceId?: unknown;
        multi?: { min?: unknown };
        options?: HiddenSimpleChoiceOption[];
    };
};

export type ForceSkippableHiddenAiInteraction = {
    playerId: string;
    interactionId: string;
    sourceId?: string;
    title?: string;
    resolution: AiResolution;
};

export type ForceEndTurnStalledAiResolution = {
    playerId: string;
    reason: 'hidden-interaction' | 'visible-interaction' | 'response-window';
    resolution: AiResolution;
};

type AiAutoRecoveryAttemptTracker = {
    firstSeenAt: number;
    autoSubmittedAt: number | null;
    lastReportedFailureReason: string | null;
};

export function applyAiAutoRecoveryRejection<T extends AiAutoRecoveryAttemptTracker>(
    tracker: T,
    reason: string,
    now: number,
): { shouldNotify: boolean; nextTracker: T } {
    return {
        shouldNotify: tracker.lastReportedFailureReason !== reason,
        nextTracker: {
            ...tracker,
            firstSeenAt: now,
            autoSubmittedAt: null,
            lastReportedFailureReason: reason,
        },
    };
}

function buildAiBatchId(playerId: string, attemptKey: string): string {
    const normalizedAttemptKey = attemptKey.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120);
    return `ai-${playerId}-${normalizedAttemptKey}`;
}


function buildForceEndTurnResolution(args: {
    playerId: string;
    suffix: string;
    commands: Array<{ type: string; payload: unknown }>;
}): AiResolution {
    return {
        playerId: args.playerId,
        attemptKey: `force-end-turn:${args.playerId}:${args.suffix}`,
        source: 'local-ai',
        action: {
            actionId: `force-end-turn:${args.suffix}`,
            kind: 'force-end-turn',
            label: '强制结束 AI 回合',
            commands: args.commands,
        },
    };
}

function buildForceEndTurnFromInteractionState(
    state: MatchState<unknown>,
    playerId: string,
    reason: 'hidden-interaction' | 'visible-interaction',
): ForceEndTurnStalledAiResolution | null {
    const current = (state.sys as { interaction?: { current?: unknown } } | undefined)?.interaction?.current as HiddenSimpleChoiceInteraction | undefined;
    if (!current || String(current.playerId) !== playerId || typeof current.id !== 'string') {
        return null;
    }

    const forceSkipPayload = buildForceSkipPayloadFromSeatState(state, playerId);
    if (forceSkipPayload) {
        return {
            playerId,
            reason,
            resolution: buildForceEndTurnResolution({
                playerId,
                suffix: `${reason}:${forceSkipPayload.interactionId}`,
                commands: [
                    { type: 'SYS_INTERACTION_RESPOND', payload: forceSkipPayload.payload },
                    { type: 'ADVANCE_PHASE', payload: {} },
                ],
            }),
        };
    }

    return {
        playerId,
        reason,
        resolution: buildForceEndTurnResolution({
            playerId,
            suffix: `${reason}:${current.id}`,
            commands: [
                { type: 'SYS_INTERACTION_CANCEL', payload: {} },
                { type: 'ADVANCE_PHASE', payload: {} },
            ],
        }),
    };
}

function buildForceSkipPayloadFromSeatState(state: MatchState<unknown>, playerId: string): {
    interactionId: string;
    payload: { optionId?: string; optionIds?: string[] };
    sourceId?: string;
    title?: string;
} | null {
    const current = (state.sys as { interaction?: { current?: unknown } } | undefined)?.interaction?.current as
        | HiddenSimpleChoiceInteraction
        | undefined;

    if (!current || String(current.playerId) !== playerId || current.kind !== 'simple-choice' || typeof current.id !== 'string') {
        return null;
    }

    const data = current.data;
    const enabledOptions = Array.isArray(data?.options)
        ? data.options.filter((option): option is HiddenSimpleChoiceOption & { id: string } =>
            Boolean(option) && option.disabled !== true && typeof option.id === 'string')
        : [];

    const skipOption = enabledOptions.find((option) =>
        option.id === 'skip'
        || option.value?.skip === true
        || option.id === '__emergency_skip__'
        || option.value?.__emergency_skip__ === true,
    );
    if (skipOption?.id) {
        return {
            interactionId: current.id,
            payload: { optionId: skipOption.id },
            sourceId: typeof data?.sourceId === 'string' ? data.sourceId : undefined,
            title: typeof data?.title === 'string' ? data.title : undefined,
        };
    }

    const cancelOption = enabledOptions.find((option) =>
        option.id === '__cancel__' || option.value?.__cancel__ === true,
    );
    if (cancelOption?.id) {
        return {
            interactionId: current.id,
            payload: { optionId: cancelOption.id },
            sourceId: typeof data?.sourceId === 'string' ? data.sourceId : undefined,
            title: typeof data?.title === 'string' ? data.title : undefined,
        };
    }

    const minCount = typeof data?.multi?.min === 'number' ? data.multi.min : 1;
    if (minCount === 0) {
        return {
            interactionId: current.id,
            payload: { optionIds: [] },
            sourceId: typeof data?.sourceId === 'string' ? data.sourceId : undefined,
            title: typeof data?.title === 'string' ? data.title : undefined,
        };
    }

    const doneOption = enabledOptions.find((option) =>
        option.id === 'done' || option.value?.done === true,
    );
    if (doneOption?.id) {
        return {
            interactionId: current.id,
            payload: { optionId: doneOption.id },
            sourceId: typeof data?.sourceId === 'string' ? data.sourceId : undefined,
            title: typeof data?.title === 'string' ? data.title : undefined,
        };
    }

    return null;
}

export function resolveForceSkippableHiddenAiInteraction(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
}): ForceSkippableHiddenAiInteraction | null {
    const sharedInteraction = args.sharedState?.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
    if (!sharedInteraction || sharedInteraction.current || sharedInteraction.isBlocked !== true) {
        return null;
    }

    for (const [playerId, controller] of Object.entries(args.seatControllers)) {
        if (controller.type === 'human') {
            continue;
        }
        const seatState = args.seatStates[playerId];
        if (!seatState) {
            continue;
        }
        const forceSkipPayload = buildForceSkipPayloadFromSeatState(seatState, playerId);
        if (!forceSkipPayload) {
            continue;
        }

        return {
            playerId,
            interactionId: forceSkipPayload.interactionId,
            sourceId: forceSkipPayload.sourceId,
            title: forceSkipPayload.title,
            resolution: {
                playerId,
                attemptKey: `force-skip:${playerId}:${forceSkipPayload.interactionId}`,
                source: 'local-ai',
                action: {
                    actionId: `force-skip:${forceSkipPayload.interactionId}`,
                    kind: 'interaction-choice',
                    label: '强制跳过 AI 可选效果',
                    commands: [{
                        type: 'SYS_INTERACTION_RESPOND',
                        payload: forceSkipPayload.payload,
                    }],
                },
            },
        };
    }

    return null;
}

export function resolveForceEndTurnForStalledAi(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
}): ForceEndTurnStalledAiResolution | null {
    const currentInteraction = args.sharedState?.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
    const visibleCurrent = currentInteraction?.current as HiddenSimpleChoiceInteraction | undefined;
    if (visibleCurrent?.playerId && args.seatControllers[String(visibleCurrent.playerId)]?.type !== 'human') {
        return buildForceEndTurnFromInteractionState(
            args.sharedState as MatchState<unknown>,
            String(visibleCurrent.playerId),
            'visible-interaction',
        );
    }

    if (currentInteraction?.current == null && currentInteraction?.isBlocked === true) {
        for (const [playerId, controller] of Object.entries(args.seatControllers)) {
            if (controller.type === 'human') continue;
            const seatState = args.seatStates[playerId];
            if (!seatState) continue;
            const hiddenResolution = buildForceEndTurnFromInteractionState(seatState, playerId, 'hidden-interaction');
            if (hiddenResolution) {
                return hiddenResolution;
            }
        }
    }

    const responseWindow = args.sharedState?.sys?.responseWindow as {
        current?: {
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        };
    } | undefined;
    const responderQueue = Array.isArray(responseWindow?.current?.responderQueue)
        ? responseWindow?.current?.responderQueue
        : [];
    const responderIndex = typeof responseWindow?.current?.currentResponderIndex === 'number'
        ? responseWindow.current.currentResponderIndex
        : 0;
    const responderId = responderQueue[responderIndex];
    if (typeof responderId === 'string' && args.seatControllers[responderId]?.type !== 'human') {
        return {
            playerId: responderId,
            reason: 'response-window',
            resolution: buildForceEndTurnResolution({
                playerId: responderId,
                suffix: `response-window:${responderId}`,
                commands: [
                    { type: 'RESPONSE_PASS', payload: {} },
                    { type: 'ADVANCE_PHASE', payload: {} },
                ],
            }),
        };
    }
    return null;
}

export function submitOnlineAiResolution(args: {
    client: Pick<GameTransportClient, 'sendBatch' | 'updateLatestState'>;
    resolution: AiResolution;
    lastAiAttemptKeyRef: { current: string | null };
    scheduleRetry: () => void;
    onConfirmed?: (authoritativeState: unknown) => void;
    onRejected?: (reason: string) => void;
}): void {
    const {
        client,
        resolution,
        lastAiAttemptKeyRef,
        scheduleRetry,
        onConfirmed,
        onRejected,
    } = args;

    lastAiAttemptKeyRef.current = resolution.attemptKey;
    client.sendBatch(
        buildAiBatchId(resolution.playerId, resolution.attemptKey),
        resolution.action.commands.map((command) => ({
            type: command.type,
            payload: command.payload,
        })),
        (authoritativeState) => {
            if (authoritativeState && typeof authoritativeState === 'object') {
                client.updateLatestState(authoritativeState);
            }
            onConfirmed?.(authoritativeState);
        },
        (reason) => {
            if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
                lastAiAttemptKeyRef.current = null;
            }
            if (reason !== 'unauthorized') {
                scheduleRetry();
            }
            onRejected?.(reason);
        },
    );
}
