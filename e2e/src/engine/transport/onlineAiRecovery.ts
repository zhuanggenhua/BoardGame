import type { AiResolution, AiSeatController } from '../ai';
import type { MatchState } from '../types';

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

export type ForceEndTurnStalledAiReason =
    | 'hidden-interaction'
    | 'visible-interaction'
    | 'response-window'
    | 'response-loop'
    | 'active-turn'
    | 'active-turn-legal-only'
    | 'seat-legal-only';

export const ONLINE_AI_LEGAL_ACTION_ONLY_REASONS = [
    'active-turn-legal-only',
    'seat-legal-only',
] as const satisfies ReadonlyArray<ForceEndTurnStalledAiReason>;

export const ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS = [
    'response-window',
    'active-turn',
    'active-turn-legal-only',
    'seat-legal-only',
    'visible-interaction',
    'hidden-interaction',
] as const satisfies ReadonlyArray<ForceEndTurnStalledAiReason>;

const ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASON_SET = new Set<ForceEndTurnStalledAiReason>(
    ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS,
);

export const shouldUseOnlineAiEmergencyOverlayFallback = (
    reason: ForceEndTurnStalledAiReason,
): boolean => ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASON_SET.has(reason);

export type ForceEndTurnStalledAiResolution = {
    playerId: string;
    reason: ForceEndTurnStalledAiReason;
    requiresConfirmedAdvancePhase?: boolean;
    legalActionOnly?: boolean;
    allowForceCommandAfterLegalActionExhausted?: boolean;
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

const SILENT_ONLINE_AI_BATCH_REJECTION_REASONS = new Set([
    'stale_state',
]);

export function shouldSilentlyRetryOnlineAiBatchRejection(reason: string): boolean {
    return SILENT_ONLINE_AI_BATCH_REJECTION_REASONS.has(reason);
}

export function resolveCurrentPlayerId(sharedState: MatchState<unknown> | null | undefined): string | null {
    const phase = typeof sharedState?.sys?.phase === 'string' ? sharedState.sys.phase : '';
    const core = sharedState?.core as {
        activePlayerId?: unknown;
        currentPlayerId?: unknown;
        currentPlayer?: unknown;
        turnOrder?: unknown;
        currentPlayerIndex?: unknown;
        pendingAttack?: unknown;
    } | undefined;
    if (!core) return null;

    // DiceThrone defensiveRoll 的阶段推进操作者是防御方（defender），
    // 并不总是 core.activePlayerId。这里统一对齐 FlowHooks#getCurrentPlayerId 语义，
    // 避免 watchdog 在防御阶段误判当前操作者，触发 not_active_player 噪音。
    if (phase === 'defensiveRoll') {
        const pendingAttack = core.pendingAttack as { defenderId?: unknown } | undefined;
        if (typeof pendingAttack?.defenderId === 'string') {
            return pendingAttack.defenderId;
        }
    }

    if (typeof core.activePlayerId === 'string') return core.activePlayerId;
    if (typeof core.currentPlayerId === 'string') return core.currentPlayerId;
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
    const decisionEpoch = typeof state.sys?.decisionEpoch === 'number'
        ? state.sys.decisionEpoch
        : 0;
    const currentInteraction = state.sys?.interaction?.current as {
        id?: unknown;
        sourceId?: unknown;
        data?: {
            sourceId?: unknown;
            options?: Array<{ id?: unknown; disabled?: unknown }>;
        };
    } | undefined;
    const interactionId = typeof currentInteraction?.id === 'string'
        ? currentInteraction.id
        : '';
    const interactionSourceId = typeof currentInteraction?.sourceId === 'string'
        ? currentInteraction.sourceId
        : typeof currentInteraction?.data?.sourceId === 'string'
            ? currentInteraction.data.sourceId
            : '';
    const interactionOptionSignature = Array.isArray(currentInteraction?.data?.options)
        ? currentInteraction.data.options
            .map((option) => {
                const optionId = typeof option?.id === 'string' ? option.id : '';
                const disabledFlag = option?.disabled === true ? '1' : '0';
                return `${optionId}:${disabledFlag}`;
            })
            .join(',')
        : '';
    const currentResponseWindow = state.sys?.responseWindow?.current as {
        windowType?: unknown;
        sourceId?: unknown;
        currentResponderIndex?: unknown;
    } | undefined;
    const responseWindowType = typeof currentResponseWindow?.windowType === 'string'
        ? currentResponseWindow.windowType
        : '';
    const responseWindowSourceId = typeof currentResponseWindow?.sourceId === 'string'
        ? currentResponseWindow.sourceId
        : '';
    const responderIndex = typeof currentResponseWindow?.currentResponderIndex === 'number'
        ? currentResponseWindow.currentResponderIndex
        : '';
    const currentPlayerId = resolveCurrentPlayerId(state) ?? '';

    return [
        turnNumber,
        phase,
        eventStreamNextId,
        decisionEpoch,
        interactionId,
        interactionSourceId,
        interactionOptionSignature,
        responseWindowType,
        responseWindowSourceId,
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
    if (!current || String(current.playerId) !== playerId) {
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

    const fallbackInteractionId = typeof current.id === 'string' && current.id.length > 0
        ? current.id
        : `${playerId}:unknown-interaction`;

    return {
        playerId,
        reason,
        requiresConfirmedAdvancePhase: true,
        resolution: buildForceEndTurnResolution({
            playerId,
            suffix: `${reason}:${fallbackInteractionId}`,
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

function resolveWatchdogAdvancePhaseCommandType(gameId?: string | null): string | null {
    if (gameId === 'summonerwars') {
        return 'sw:end_phase';
    }
    if (gameId === 'splendor') {
        return null;
    }
    return 'ADVANCE_PHASE';
}

export function resolveForceAdvancePhaseAfterRecovery(args: {
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    playerId: string;
    gameId?: string | null;
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

    const advancePhaseCommandType = resolveWatchdogAdvancePhaseCommandType(args.gameId);
    if (!advancePhaseCommandType) {
        return null;
    }

    return buildForceEndTurnResolution({
        playerId,
        suffix: buildForceEndTurnFollowUpSuffix(authoritativeState, playerId),
        commands: [{ type: advancePhaseCommandType, payload: {} }],
    });
}

export function resolveForceEndTurnFollowUpAfterConfirmation(args: {
    candidate: ForceEndTurnStalledAiResolution;
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    gameId?: string | null;
}): AiResolution | null {
    const { candidate, authoritativeState, seatControllers } = args;
    if (!candidate.requiresConfirmedAdvancePhase) {
        return null;
    }

    return resolveForceAdvancePhaseAfterRecovery({
        authoritativeState,
        seatControllers,
        playerId: candidate.playerId,
        gameId: args.gameId,
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
    const enabledOptions = Array.isArray(data?.options)
        ? data.options.filter((option): option is HiddenSimpleChoiceOption & { id: string } =>
            Boolean(option) && option.disabled !== true && typeof option.id === 'string')
        : [];
    const sourceId = typeof data?.sourceId === 'string' ? data.sourceId : undefined;
    const title = typeof data?.title === 'string' ? data.title : undefined;
    const minCount = typeof data?.multi?.min === 'number' ? data.multi.min : 1;
    const maxCount = typeof data?.multi?.max === 'number' ? data.multi.max : minCount;

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
            sourceId,
            title,
        };
    }

    const allowWhenHasNonControl = options?.allowWhenHasNonControl ?? true;
    if (!allowWhenHasNonControl && hasEnabledNonControlOptions(data)) {
        return null;
    }

    const cancelOption = enabledOptions.find((option) =>
        option.id === '__cancel__' || option.value?.__cancel__ === true,
    );
    if (cancelOption?.id) {
        return {
            interactionId: current.id,
            payload: { optionId: cancelOption.id },
            sourceId,
            title,
        };
    }

    if (minCount === 0) {
        return {
            interactionId: current.id,
            payload: { optionIds: [] },
            sourceId,
            title,
        };
    }

    const doneOption = enabledOptions.find((option) =>
        option.id === 'done' || option.value?.done === true,
    );
    if (doneOption?.id) {
        return {
            interactionId: current.id,
            payload: { optionId: doneOption.id },
            sourceId,
            title,
        };
    }

    const enabledTriggerOptions = enabledOptions.filter((option) =>
        !isControlChoiceOption(option) && option.value?.kind === 'trigger',
    );
    if (sourceId === 'smashup_reaction_choose'
        && minCount === 1
        && maxCount === 1
        && enabledTriggerOptions.length > 0
        && enabledTriggerOptions.length === enabledOptions.length) {
        return {
            interactionId: current.id,
            payload: { optionId: enabledTriggerOptions[0].id },
            sourceId,
            title,
        };
    }

    return null;
}

function hasPendingResponseWindowInteractionLock(
    state: MatchState<unknown> | null | undefined,
): boolean {
    const currentWindow = (state?.sys?.responseWindow as {
        current?: {
            pendingInteractionId?: unknown;
        };
    } | undefined)?.current;
    return typeof currentWindow?.pendingInteractionId === 'string'
        && currentWindow.pendingInteractionId.length > 0;
}

export function shouldInspectSeatStatesForHiddenAiInteraction(
    state: MatchState<unknown> | null | undefined,
): boolean {
    const sharedInteraction = state?.sys?.interaction as {
        current?: unknown;
        isBlocked?: unknown;
    } | undefined;
    if (sharedInteraction?.current) {
        return false;
    }
    if (sharedInteraction?.isBlocked === true) {
        return true;
    }
    return hasPendingResponseWindowInteractionLock(state);
}

export function resolveForceSkippableHiddenAiInteraction(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
}): ForceSkippableHiddenAiInteraction | null {
    if (!shouldInspectSeatStatesForHiddenAiInteraction(args.sharedState)) {
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

function resolveOrphanDisplayOnlyBonusDiceSettlement(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
}): ForceEndTurnStalledAiResolution | null {
    const phase = typeof args.sharedState?.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : '';
    if (phase === 'offensiveRoll' || phase === 'targetingRoll' || phase === 'defensiveRoll') {
        return null;
    }

    const currentInteraction = args.sharedState?.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
    if (currentInteraction?.current || currentInteraction?.isBlocked === true) {
        return null;
    }

    const responseWindow = args.sharedState?.sys?.responseWindow as { current?: unknown } | undefined;
    if (responseWindow?.current) {
        return null;
    }

    const core = args.sharedState?.core as {
        pendingAttack?: unknown;
        pendingBonusDiceSettlement?: {
            id?: unknown;
            attackerId?: unknown;
            displayOnly?: unknown;
        };
    } | undefined;
    if (core?.pendingAttack) {
        return null;
    }

    const settlement = core?.pendingBonusDiceSettlement;
    if (settlement?.displayOnly !== true || typeof settlement.attackerId !== 'string') {
        return null;
    }

    if (args.seatControllers[settlement.attackerId]?.type === 'human') {
        return null;
    }

    const settlementId = typeof settlement.id === 'string' && settlement.id.length > 0
        ? settlement.id
        : 'unknown-display-only-settlement';

    return {
        playerId: settlement.attackerId,
        reason: 'seat-legal-only',
        fingerprintHint: `display-only-bonus:${settlement.attackerId}:${phase || 'unknown-phase'}:${settlementId}`,
        resolution: buildForceEndTurnResolution({
            playerId: settlement.attackerId,
            suffix: `display-only-bonus:${settlement.attackerId}:${settlementId}`,
            commands: [{ type: 'SKIP_BONUS_DICE_REROLL', payload: {} }],
        }),
    };
}

export function resolveForceEndTurnForStalledAi(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
    gameId?: string | null;
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

    if (shouldInspectSeatStatesForHiddenAiInteraction(args.sharedState)) {
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
    if (typeof responderId === 'string' && args.seatControllers[responderId]?.type === 'human') {
        // 当前响应权在 human 手里时，watchdog 不能把它误判成 active AI 卡死，
        // 否则 DiceThrone 的 afterRollConfirmed / afterAttackResolved 会被错误上报为
        // active-turn-legal-only，并制造不该有的 force-end-turn 门禁。
        return null;
    }

    const orphanDisplayOnlyBonusSettlement = resolveOrphanDisplayOnlyBonusDiceSettlement(args);
    if (orphanDisplayOnlyBonusSettlement) {
        return orphanDisplayOnlyBonusSettlement;
    }

    const phase = typeof args.sharedState?.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : '';
    const currentPlayerId = resolveCurrentPlayerId(args.sharedState);
    const defensivePendingAttack = (args.sharedState?.core as {
        pendingAttack?: { defenderId?: unknown };
    } | undefined)?.pendingAttack;

    // DiceThrone defensiveRoll 的真实操作者是防御方 defender（off-turn）。
    // 当 activePlayer 是 AI 攻击方、但 defender 是 human 时，watchdog 不应误对 AI 攻击方执行 force-end-turn。
    if (
        phase === 'defensiveRoll'
        && currentPlayerId
        && defensivePendingAttack
        && typeof defensivePendingAttack.defenderId === 'string'
        && defensivePendingAttack.defenderId !== currentPlayerId
        && args.seatControllers[currentPlayerId]?.type !== 'human'
    ) {
        const defenderId = defensivePendingAttack.defenderId;
        if (args.seatControllers[defenderId]?.type === 'human') {
            return null;
        }
        return {
            playerId: defenderId,
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: `active-turn-legal-only:${defenderId}:defensiveRoll`,
            resolution: buildForceEndTurnResolution({
                playerId: defenderId,
                suffix: `active-turn-legal-only:${defenderId}:defensiveRoll`,
                commands: [],
            }),
        };
    }

    if (currentPlayerId && args.seatControllers[currentPlayerId]?.type !== 'human') {
        const isDiceRollPhase = phase === 'offensiveRoll'
            || phase === 'targetingRoll'
            || phase === 'defensiveRoll';
        const advancePhaseCommandType = resolveWatchdogAdvancePhaseCommandType(args.gameId);

        // 派系选择阶段的 AI 没动作，通常是 seat 凭据/seat state 还没准备好。
        // 这里若强行发 ADVANCE_PHASE，会把 match 非法推进到 startTurn/playCards，
        // 造成双方 factions 仍为空却直接进游戏、手牌/牌库全空的损坏状态。
        // 因此 factionSelect 只能走“服务端代 AI 执行合法 SELECT_FACTION”这类 legal-action recovery，
        // 绝不能 watchdog 自动 ADVANCE_PHASE 跳过。
        //
        // DiceThrone 的 roll 阶段也不能直接 fallback 到裸 ADVANCE_PHASE：
        // offensiveRoll / targetingRoll / defensiveRoll 的真实推进依赖掷骰、确认、
        // 选目标或防御响应。若 seat overlay stale 或 legalActions 暂时为 0，
        // 强发 ADVANCE_PHASE 只会打出 command_failed，并制造高频误导性自动反馈。
        if (phase === 'factionSelect' || isDiceRollPhase || !advancePhaseCommandType) {
            return {
                playerId: currentPlayerId,
                reason: 'active-turn-legal-only',
                legalActionOnly: true,
                fingerprintHint: `active-turn-legal-only:${currentPlayerId}:${phase || 'unknown-phase'}`,
                resolution: buildForceEndTurnResolution({
                    playerId: currentPlayerId,
                    suffix: `active-turn-legal-only:${currentPlayerId}:${phase || 'unknown-phase'}`,
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
                commands: [{ type: advancePhaseCommandType, payload: {} }],
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
    if (!args.sharedState) {
        return null;
    }

    const currentWindow = (args.sharedState?.sys?.responseWindow as {
        current?: {
            id?: unknown;
            windowType?: unknown;
            sourceId?: unknown;
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        };
    } | undefined)?.current;

    const visibleCurrent = (args.sharedState.sys?.interaction as { current?: unknown } | undefined)?.current as
        | HiddenSimpleChoiceInteraction
        | undefined;
    if (visibleCurrent?.playerId) {
        const interactionPlayerId = String(visibleCurrent.playerId);
        if (args.seatControllers[interactionPlayerId]?.type === 'human') {
            return null;
        }
        const interactionId = typeof visibleCurrent.id === 'string' && visibleCurrent.id.length > 0
            ? visibleCurrent.id
            : `${interactionPlayerId}:manual-visible-interaction`;
        return {
            playerId: interactionPlayerId,
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: true,
            resolution: buildForceEndTurnResolution({
                playerId: interactionPlayerId,
                suffix: `manual-visible-interaction:${interactionId}`,
                commands: [{ type: 'SYS_INTERACTION_CANCEL', payload: {} }],
            }),
        };
    }

    for (const [playerId, controller] of Object.entries(args.seatControllers)) {
        if (controller.type === 'human') {
            continue;
        }
        const seatCurrent = (args.seatStates[playerId]?.sys?.interaction as { current?: unknown } | undefined)?.current as
            | HiddenSimpleChoiceInteraction
            | undefined;
        if (!seatCurrent || String(seatCurrent.playerId) !== playerId) {
            continue;
        }
        const interactionId = typeof seatCurrent.id === 'string' && seatCurrent.id.length > 0
            ? seatCurrent.id
            : `${playerId}:manual-hidden-interaction`;
        return {
            playerId,
            reason: 'hidden-interaction',
            requiresConfirmedAdvancePhase: true,
            resolution: buildForceEndTurnResolution({
                playerId,
                suffix: `manual-hidden-interaction:${interactionId}`,
                commands: [{ type: 'SYS_INTERACTION_CANCEL', payload: {} }],
            }),
        };
    }

    if (currentWindow) {
        const responderQueue = Array.isArray(currentWindow.responderQueue)
            ? currentWindow.responderQueue.filter((value): value is string => typeof value === 'string')
            : [];
        const responderIndex = typeof currentWindow.currentResponderIndex === 'number'
            ? currentWindow.currentResponderIndex
            : 0;
        const responderId = responderQueue[responderIndex];
        if (typeof responderId === 'string' && args.seatControllers[responderId]?.type === 'human') {
            return null;
        }
        if (typeof responderId === 'string' && args.seatControllers[responderId]?.type !== 'human') {
            const windowId = typeof currentWindow.id === 'string' && currentWindow.id.length > 0
                ? currentWindow.id
                : `${responderId}:manual-response-window`;
            const windowType = typeof currentWindow.windowType === 'string' ? currentWindow.windowType : 'unknown-type';
            const sourceId = typeof currentWindow.sourceId === 'string' ? currentWindow.sourceId : 'unknown-source';
            return {
                playerId: responderId,
                reason: 'response-window',
                requiresConfirmedAdvancePhase: true,
                fingerprintHint: `manual-response-window:${responderId}:${windowType}:${sourceId}`,
                resolution: buildForceEndTurnResolution({
                    playerId: responderId,
                    suffix: `manual-response-window:${responderId}:${windowType}:${sourceId}:${windowId}`,
                    commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
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
    gameId?: string | null;
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
        gameId: args.gameId,
    });
}

export function resolveUnsatisfiableReasonFromInteraction(
    _state: MatchState<unknown> | null | undefined,
    interaction: HiddenInteractionDescriptor | undefined,
): string | null {
    if (!interaction) {
        return null;
    }

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
