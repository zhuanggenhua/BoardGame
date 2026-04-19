import type { AiResolution, AiSeatController } from '../ai';
import type { MatchState } from '../types';
import { RESPONSE_WINDOW_COMMANDS } from '../systems/ResponseWindowSystem';

type HiddenSimpleChoiceOption = {
    id?: unknown;
    disabled?: unknown;
    value?: {
        skip?: unknown;
        __cancel__?: unknown;
        done?: unknown;
        __emergency_skip__?: unknown;
        kind?: unknown;
    };
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

export type HiddenInteractionDescriptor = {
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
    reason: 'hidden-interaction' | 'visible-interaction' | 'response-window' | 'active-turn' | 'active-turn-legal-only';
    requiresConfirmedAdvancePhase?: boolean;
    legalActionOnly?: boolean;
    fingerprintHint?: string;
    resolution: AiResolution;
};

export type AiAutoRecoveryAttemptTracker = {
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

export function resolveCurrentPlayerId(sharedState: MatchState<unknown> | null | undefined): string | null {
    const core = sharedState?.core as {
        activePlayerId?: unknown;
        currentPlayer?: unknown;
        turnOrder?: unknown;
        currentPlayerIndex?: unknown;
    } | undefined;
    if (!core) return null;
    if (typeof core.activePlayerId === 'string') return core.activePlayerId;
    if (typeof core.currentPlayer === 'string') return core.currentPlayer;
    if (Array.isArray(core.turnOrder) && typeof core.currentPlayerIndex === 'number') {
        const current = core.turnOrder[core.currentPlayerIndex];
        return typeof current === 'string' ? current : null;
    }
    return null;
}

export function buildAiProgressMarker(state: MatchState<unknown>): string {
    const turnNumber = typeof state.sys?.turnNumber === 'number' ? state.sys.turnNumber : '';
    const phase = typeof state.sys?.phase === 'string' ? state.sys.phase : '';
    const eventStreamNextId = typeof state.sys?.eventStream?.nextId === 'number'
        ? state.sys.eventStream.nextId
        : '';
    const interactionId = typeof state.sys?.interaction?.current?.id === 'string'
        ? state.sys.interaction.current.id
        : '';
    const responderIndex = typeof state.sys?.responseWindow?.current?.currentResponderIndex === 'number'
        ? state.sys.responseWindow.current.currentResponderIndex
        : '';
    const currentPlayerId = resolveCurrentPlayerId(state) ?? '';

    return [
        turnNumber,
        phase,
        eventStreamNextId,
        interactionId,
        responderIndex,
        currentPlayerId,
    ].join('|');
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
            requiresConfirmedAdvancePhase: true,
            resolution: buildForceEndTurnResolution({
                playerId,
                suffix: `${reason}:${forceSkipPayload.interactionId}`,
                commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: forceSkipPayload.payload }],
            }),
        };
    }

    return {
        playerId,
        reason,
        requiresConfirmedAdvancePhase: true,
        resolution: buildForceEndTurnResolution({
            playerId,
            suffix: `${reason}:${current.id}`,
            commands: [{ type: 'SYS_INTERACTION_CANCEL', payload: {} }],
        }),
    };
}

function buildForceEndTurnFollowUpSuffix(state: MatchState<unknown>, playerId: string): string {
    const turnNumber = typeof state.sys?.turnNumber === 'number' ? state.sys.turnNumber : 'unknown-turn';
    const phase = typeof state.sys?.phase === 'string' ? state.sys.phase : 'unknown-phase';
    const eventStreamNextId = typeof state.sys?.eventStream?.nextId === 'number'
        ? state.sys.eventStream.nextId
        : 'unknown-events';
    return `follow-up:${playerId}:${turnNumber}:${phase}:${eventStreamNextId}`;
}

export function resolveForceAdvancePhaseAfterRecovery(args: {
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    playerId: string;
}): AiResolution | null {
    const { authoritativeState, seatControllers, playerId } = args;
    if (!authoritativeState || authoritativeState.sys?.gameover) {
        return null;
    }
    if (seatControllers[playerId]?.type === 'human') {
        return null;
    }
    if (resolveCurrentPlayerId(authoritativeState) !== playerId) {
        return null;
    }

    const currentInteraction = authoritativeState.sys?.interaction as {
        current?: unknown;
        isBlocked?: unknown;
    } | undefined;
    if (currentInteraction?.current || currentInteraction?.isBlocked === true) {
        return null;
    }

    const responseWindow = authoritativeState.sys?.responseWindow as {
        current?: unknown;
    } | undefined;
    if (responseWindow?.current) {
        return null;
    }

    return buildForceEndTurnResolution({
        playerId,
        suffix: buildForceEndTurnFollowUpSuffix(authoritativeState, playerId),
        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
    });
}

export function resolveForceEndTurnFollowUpAfterConfirmation(args: {
    candidate: ForceEndTurnStalledAiResolution;
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
}): AiResolution | null {
    const { candidate, authoritativeState, seatControllers } = args;
    if (!candidate.requiresConfirmedAdvancePhase) {
        return null;
    }

    return resolveForceAdvancePhaseAfterRecovery({
        authoritativeState,
        seatControllers,
        playerId: candidate.playerId,
    });
}

function isControlChoiceOption(option: HiddenSimpleChoiceOption): boolean {
    const value = option.value;
    return option.id === 'skip'
        || option.id === 'pass'
        || option.id === 'done'
        || option.id === 'cancel'
        || option.id === '__cancel__'
        || option.id === '__emergency_skip__'
        || value?.skip === true
        || value?.kind === 'pass'
        || value?.done === true
        || value?.cancel === true
        || value?.__cancel__ === true
        || value?.__emergency_skip__ === true;
}

function hasEnabledNonControlOptions(data: { options?: HiddenSimpleChoiceOption[] } | undefined): boolean {
    const options = Array.isArray(data?.options) ? data.options : [];
    return options.some((option) =>
        Boolean(option) && option.disabled !== true && !isControlChoiceOption(option),
    );
}

function buildForceSkipPayloadFromSeatState(
    state: MatchState<unknown>,
    playerId: string,
    options?: { allowWhenHasNonControl?: boolean },
): {
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
    const allowWhenHasNonControl = options?.allowWhenHasNonControl ?? true;
    if (!allowWhenHasNonControl && hasEnabledNonControlOptions(data)) {
        return null;
    }
    const enabledOptions = Array.isArray(data?.options)
        ? data.options.filter((option): option is HiddenSimpleChoiceOption & { id: string } =>
            Boolean(option) && option.disabled !== true && typeof option.id === 'string')
        : [];

    const skipOption = enabledOptions.find((option) =>
        option.id === 'skip'
        || option.id === 'pass'
        || option.value?.skip === true
        || option.value?.kind === 'pass'
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
        const forceSkipPayload = buildForceSkipPayloadFromSeatState(seatState, playerId, {
            allowWhenHasNonControl: false,
        });
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
    if (args.sharedState?.sys?.gameover) {
        return null;
    }
    const currentInteraction = args.sharedState?.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
    const visibleCurrent = currentInteraction?.current as HiddenSimpleChoiceInteraction | undefined;
    if (visibleCurrent?.playerId) {
        const interactionPlayerId = String(visibleCurrent.playerId);
        if (args.seatControllers[interactionPlayerId]?.type === 'human') {
            return null;
        }
        return buildForceEndTurnFromInteractionState(
            args.sharedState as MatchState<unknown>,
            interactionPlayerId,
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
            requiresConfirmedAdvancePhase: true,
            resolution: buildForceEndTurnResolution({
                playerId: responderId,
                suffix: `response-window:${responderId}`,
                commands: [{ type: 'RESPONSE_PASS', payload: {} }],
            }),
        };
    }

    const phase = typeof args.sharedState?.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : '';
    const currentPlayerId = resolveCurrentPlayerId(args.sharedState);
    if (currentPlayerId && args.seatControllers[currentPlayerId]?.type !== 'human') {
        // 派系选择阶段的 AI 没动作，通常是 seat 凭据/seat state 还没准备好。
        // 这里若强行发 ADVANCE_PHASE，会把 match 非法推进到 startTurn/playCards，
        // 造成双方 factions 仍为空却直接进游戏、手牌/牌库全空的损坏状态。
        // 因此 factionSelect 只能走“服务端代 AI 执行合法 SELECT_FACTION”这类 legal-action recovery，
        // 绝不能 watchdog 自动 ADVANCE_PHASE 跳过。
        if (phase === 'factionSelect') {
            return {
                playerId: currentPlayerId,
                reason: 'active-turn-legal-only',
                legalActionOnly: true,
                fingerprintHint: `active-turn-legal-only:${currentPlayerId}:factionSelect`,
                resolution: buildForceEndTurnResolution({
                    playerId: currentPlayerId,
                    suffix: `active-turn-legal-only:${currentPlayerId}:factionSelect`,
                    commands: [],
                }),
            };
        }
        return {
            playerId: currentPlayerId,
            reason: 'active-turn',
            resolution: buildForceEndTurnResolution({
                playerId: currentPlayerId,
                suffix: `active-turn:${currentPlayerId}`,
                commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
            }),
        };
    }

    return null;
}

export function resolveManualForceEndAiPhase(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
}): ForceEndTurnStalledAiResolution | null {
    if (args.sharedState?.sys?.gameover) {
        return null;
    }

    const currentPlayerId = resolveCurrentPlayerId(args.sharedState);
    const currentController = currentPlayerId ? args.seatControllers[currentPlayerId] : null;
    const currentWindow = (args.sharedState?.sys?.responseWindow as {
        current?: {
            id?: unknown;
            windowType?: unknown;
            sourceId?: unknown;
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        };
    } | undefined)?.current;

    if (currentPlayerId && currentController?.type !== 'human' && currentWindow) {
        const responderQueue = Array.isArray(currentWindow.responderQueue)
            ? currentWindow.responderQueue.filter((value): value is string => typeof value === 'string')
            : [];
        const hasHumanResponder = responderQueue.some((responderId) => args.seatControllers[responderId]?.type === 'human');

        if (hasHumanResponder) {
            const windowId = typeof currentWindow.id === 'string' ? currentWindow.id : 'unknown-window';
            const windowType = typeof currentWindow.windowType === 'string' ? currentWindow.windowType : 'unknown-type';
            const sourceId = typeof currentWindow.sourceId === 'string' ? currentWindow.sourceId : 'unknown-source';
            const fingerprintHint = `manual-force-close:${currentPlayerId}:${windowType}:${sourceId}`;
            return {
                playerId: currentPlayerId,
                reason: 'response-window',
                requiresConfirmedAdvancePhase: true,
                fingerprintHint,
                resolution: buildForceEndTurnResolution({
                    playerId: currentPlayerId,
                    suffix: `manual-response-window:${currentPlayerId}:${windowType}:${sourceId}:${windowId}`,
                    commands: [{ type: RESPONSE_WINDOW_COMMANDS.FORCE_CLOSE, payload: {} }],
                }),
            };
        }
    }

    const candidate = resolveForceEndTurnForStalledAi(args);
    if (candidate?.legalActionOnly) {
        return null;
    }
    return candidate;
}

export function resolveForceEndTurnRecoveryStep(args: {
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    playerId: string;
    allowAdvancePhase?: boolean;
}): AiResolution | null {
    const { authoritativeState, seatControllers, playerId, allowAdvancePhase = false } = args;
    if (!authoritativeState || authoritativeState.sys?.gameover) {
        return null;
    }
    if (seatControllers[playerId]?.type === 'human') {
        return null;
    }
    if (resolveCurrentPlayerId(authoritativeState) !== playerId) {
        return null;
    }

    const currentInteraction = authoritativeState.sys?.interaction as {
        current?: unknown;
        isBlocked?: unknown;
    } | undefined;
    if (currentInteraction?.current || currentInteraction?.isBlocked === true) {
        return null;
    }

    const responseWindow = authoritativeState.sys?.responseWindow as { current?: unknown } | undefined;
    if (responseWindow?.current) {
        return null;
    }

    if (!allowAdvancePhase) {
        return null;
    }

    return resolveForceAdvancePhaseAfterRecovery({
        authoritativeState,
        seatControllers,
        playerId,
    });
}

export function resolveUnsatisfiableReasonFromInteraction(
    _state: MatchState<unknown> | null | undefined,
    interaction: HiddenInteractionDescriptor | undefined,
): string | null {
    const options = Array.isArray(interaction?.data?.options)
        ? interaction.data.options.filter(Boolean)
        : [];
    if (options.length === 0) {
        return 'empty-options';
    }

    const enabledOptions = options.filter((option) => option.disabled !== true);
    if (enabledOptions.length === 0) {
        return 'all-options-disabled';
    }

    const minSelectionCount = typeof interaction?.data?.multi?.min === 'number'
        ? interaction.data.multi.min
        : 1;
    if (minSelectionCount > 0 && enabledOptions.length < minSelectionCount) {
        return 'min-selection-unreachable';
    }

    return null;
}
