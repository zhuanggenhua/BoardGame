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
        confirmValue?: unknown;
        slider?: unknown;
        meta?: unknown;
        allowedDieIds?: unknown;
        completedDieIds?: unknown;
    };
};

type DefenderChoiceOption = {
    playerId?: unknown;
    customId?: unknown;
    disabled?: unknown;
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
        confirmValue?: unknown;
        slider?: unknown;
        meta?: unknown;
        allowedDieIds?: unknown;
        completedDieIds?: unknown;
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
    'response-loop',
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

function buildInteractionOptionValueSignature(value: unknown): string {
    return JSON.stringify(value ?? null);
}

function buildInteractionOptionSemanticSignature(options: unknown): string {
    if (!Array.isArray(options)) {
        return '';
    }

    return options
        .map((option) => {
            const item = option as HiddenSimpleChoiceOption | undefined;
            const optionId = typeof item?.id === 'string' ? item.id : '';
            const disabledFlag = item?.disabled === true ? '1' : '0';
            const valueSignature = buildInteractionOptionValueSignature(item?.value);
            return `${optionId}:${disabledFlag}:${valueSignature}`;
        })
        .join(',');
}

function buildDefenderChoiceOptionSemanticSignature(options: unknown): string {
    if (!Array.isArray(options)) {
        return '';
    }

    return options
        .map((option) => {
            const item = option as DefenderChoiceOption | undefined;
            const playerId = typeof item?.playerId === 'string' ? item.playerId : '';
            const customId = typeof item?.customId === 'string' ? item.customId : '';
            const disabledFlag = item?.disabled === true ? '1' : '0';
            return `${playerId}:${customId}:${disabledFlag}`;
        })
        .join(',');
}

function buildNumberArraySemanticSignature(values: unknown): string {
    if (!Array.isArray(values)) {
        return '';
    }

    return values
        .filter((value): value is number => typeof value === 'number')
        .join(',');
}

export function buildInteractionSliderSemanticSignature(slider: unknown): string {
    if (!slider || typeof slider !== 'object') {
        return '';
    }

    const raw = slider as Record<string, unknown>;
    return JSON.stringify({
        min: typeof raw.min === 'number' ? raw.min : null,
        max: typeof raw.max === 'number' ? raw.max : null,
        step: typeof raw.step === 'number' ? raw.step : null,
        defaultValue: typeof raw.defaultValue === 'number' ? raw.defaultValue : null,
        confirmOptionId: typeof raw.confirmOptionId === 'string' ? raw.confirmOptionId : null,
        confirmLabel: typeof raw.confirmLabel === 'string' ? raw.confirmLabel : null,
        valueLabel: typeof raw.valueLabel === 'string' ? raw.valueLabel : null,
        skipOptionId: typeof raw.skipOptionId === 'string' ? raw.skipOptionId : null,
        skipLabel: typeof raw.skipLabel === 'string' ? raw.skipLabel : null,
        hintKey: typeof raw.hintKey === 'string' ? raw.hintKey : null,
    });
}

export function buildDiceModifyConfigSemanticSignature(config: unknown): string {
    if (!config || typeof config !== 'object') {
        return '';
    }

    const raw = config as Record<string, unknown>;
    const adjustRange = raw.adjustRange && typeof raw.adjustRange === 'object'
        ? raw.adjustRange as Record<string, unknown>
        : undefined;

    return JSON.stringify({
        mode: typeof raw.mode === 'string' ? raw.mode : null,
        targetValue: typeof raw.targetValue === 'number' ? raw.targetValue : null,
        adjustRange: adjustRange
            ? {
                min: typeof adjustRange.min === 'number' ? adjustRange.min : null,
                max: typeof adjustRange.max === 'number' ? adjustRange.max : null,
            }
            : null,
    });
}

export function buildMultistepChoiceMetaSemanticSignature(meta: unknown): string {
    if (!meta || typeof meta !== 'object') {
        return '';
    }

    const raw = meta as Record<string, unknown>;
    return JSON.stringify({
        dtType: typeof raw.dtType === 'string' ? raw.dtType : null,
        selectCount: typeof raw.selectCount === 'number' ? raw.selectCount : null,
        targetOpponentDice: raw.targetOpponentDice === true ? true : null,
        diceOwnerId: typeof raw.diceOwnerId === 'string' ? raw.diceOwnerId : null,
        dieModifyConfig: raw.dieModifyConfig ? JSON.parse(buildDiceModifyConfigSemanticSignature(raw.dieModifyConfig) || 'null') : null,
    });
}

export function buildPendingDamageSemanticSignature(pendingDamage: unknown): string {
    if (!pendingDamage || typeof pendingDamage !== 'object') {
        return '';
    }

    const raw = pendingDamage as Record<string, unknown>;
    return JSON.stringify({
        id: typeof raw.id === 'string' ? raw.id : null,
        responderId: typeof raw.responderId === 'string' ? raw.responderId : null,
        responseType: typeof raw.responseType === 'string' ? raw.responseType : null,
        currentDamage: typeof raw.currentDamage === 'number' ? raw.currentDamage : null,
        sourceAbilityId: typeof raw.sourceAbilityId === 'string' ? raw.sourceAbilityId : null,
        tokenUsageTotals: raw.tokenUsageTotals ?? null,
    });
}

export function buildPendingBonusDiceSettlementSemanticSignature(settlement: unknown): string {
    if (!settlement || typeof settlement !== 'object') {
        return '';
    }

    const raw = settlement as Record<string, unknown>;
    return JSON.stringify({
        id: typeof raw.id === 'string' ? raw.id : null,
        attackerId: typeof raw.attackerId === 'string' ? raw.attackerId : null,
        displayOnly: raw.displayOnly === true ? true : null,
        rerollCount: typeof raw.rerollCount === 'number' ? raw.rerollCount : null,
        dice: raw.dice ?? null,
    });
}

export function buildInteractionRecoveryFingerprintHint(
    state: MatchState<unknown>,
    interaction: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction | null | undefined,
    fallbackPlayerId: string,
): string {
    const phase = typeof state.sys?.phase === 'string' ? state.sys.phase : '';
    const playerId = typeof interaction?.playerId === 'string' ? interaction.playerId : fallbackPlayerId;
    const kind = typeof interaction?.kind === 'string' ? interaction.kind : 'interaction';
    const interactionId = typeof interaction?.id === 'string' ? interaction.id : '';
    const sourceId = typeof interaction?.data?.sourceId === 'string' ? interaction.data.sourceId : '';
    const title = typeof interaction?.data?.title === 'string' ? interaction.data.title : '';
    const optionSignature = buildInteractionOptionSemanticSignature(interaction?.data?.options);
    const sliderSignature = buildInteractionSliderSemanticSignature(interaction?.data?.slider);
    const core = state.core as {
        pendingDamage?: unknown;
        pendingBonusDiceSettlement?: unknown;
    } | undefined;

    if (kind === 'simple-choice') {
        const minCount = typeof interaction?.data?.multi?.min === 'number' ? interaction.data.multi.min : '';
        return `interaction:${playerId}:${phase}:simple-choice:${sourceId}:${title}:${minCount}:${sliderSignature}:${optionSignature}`;
    }

    if (kind === 'compare-roll-choice') {
        const confirmValueSignature = buildInteractionOptionValueSignature(interaction?.data?.confirmValue);
        return `interaction:${playerId}:${phase}:compare-roll-choice:${sourceId}:${confirmValueSignature}:${optionSignature}:${interactionId}`;
    }

    if (kind === 'dt:defender-choice') {
        const data = interaction?.data as {
            attackerId?: unknown;
            targetRollValue?: unknown;
            options?: unknown;
        } | undefined;
        const attackerId = typeof data?.attackerId === 'string' ? data.attackerId : '';
        const targetRollValue = typeof data?.targetRollValue === 'number' ? String(data.targetRollValue) : '';
        const defenderOptionSignature = buildDefenderChoiceOptionSemanticSignature(data?.options);
        return `interaction:${playerId}:${phase}:dt:defender-choice:${sourceId}:${attackerId}:${targetRollValue}:${defenderOptionSignature}:${interactionId}`;
    }

    if (kind === 'multistep-choice') {
        const allowedDieIdsSignature = buildNumberArraySemanticSignature(interaction?.data?.allowedDieIds);
        const completedDieIdsSignature = buildNumberArraySemanticSignature(interaction?.data?.completedDieIds);
        const metaSignature = buildMultistepChoiceMetaSemanticSignature(interaction?.data?.meta);
        return `interaction:${playerId}:${phase}:multistep-choice:${sourceId}:${allowedDieIdsSignature}:${completedDieIdsSignature}:${metaSignature}:${interactionId}`;
    }

    if (kind === 'dt:token-response') {
        const pendingDamageSignature = buildPendingDamageSemanticSignature(core?.pendingDamage);
        return `interaction:${playerId}:${phase}:dt:token-response:${sourceId}:${pendingDamageSignature}:${interactionId}`;
    }

    if (kind === 'dt:bonus-dice') {
        const settlementSignature = buildPendingBonusDiceSettlementSemanticSignature(core?.pendingBonusDiceSettlement);
        return `interaction:${playerId}:${phase}:dt:bonus-dice:${sourceId}:${settlementSignature}:${interactionId}`;
    }

    return `interaction:${playerId}:${phase}:${kind}:${interactionId}`;
}

export function buildResponseWindowRecoveryFingerprintHint(
    state: MatchState<unknown> | null | undefined,
    fallbackPlayerId: string,
    reason: 'response-window' | 'response-loop' | 'manual-response-window' = 'response-window',
): string {
    const phase = typeof state?.sys?.phase === 'string' ? state.sys.phase : '';
    const current = (state?.sys?.responseWindow as { current?: unknown } | undefined)?.current as {
        id?: unknown;
        windowType?: unknown;
        sourceId?: unknown;
        responderQueue?: unknown;
        currentResponderIndex?: unknown;
    } | undefined;

    const windowId = typeof current?.id === 'string' ? current.id : '';
    const windowType = typeof current?.windowType === 'string' ? current.windowType : '';
    const sourceId = typeof current?.sourceId === 'string' ? current.sourceId : '';
    const responderQueue = Array.isArray(current?.responderQueue) ? current.responderQueue : [];
    const responderIndex = typeof current?.currentResponderIndex === 'number' ? current.currentResponderIndex : 0;
    const responderId = typeof responderQueue[responderIndex] === 'string'
        ? responderQueue[responderIndex]
        : fallbackPlayerId;
    const queueSignature = responderQueue
        .map((value) => (typeof value === 'string' ? value : ''))
        .filter((value) => value.length > 0)
        .join('|');

    return `${reason}:${responderId}:${phase}:${windowType}:${sourceId}:${queueSignature}:${windowId}`;
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

    const fingerprintHint = buildInteractionRecoveryFingerprintHint(state, current, playerId);

    const forceSkipPayload = buildForceSkipPayloadFromSeatState(state, playerId);
    if (forceSkipPayload) {
        return {
            playerId,
            reason,
            requiresConfirmedAdvancePhase: true,
            fingerprintHint,
            resolution: buildForceEndTurnResolution({
                playerId,
                suffix: fingerprintHint,
                commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: forceSkipPayload.payload }],
            }),
        };
    }

    const fallbackInteractionId = typeof current.id === 'string' && current.id.length > 0
        ? current.id
        : `${playerId}:unknown-interaction`;
    const interactionKind = typeof current.kind === 'string' ? current.kind : '';
    const compareRollData = current.data as {
        options?: Array<{ id?: unknown; disabled?: unknown }> | unknown;
        confirmValue?: unknown;
    } | undefined;
    const compareRollEnabledOptionIds = interactionKind === 'compare-roll-choice' && Array.isArray(compareRollData?.options)
        ? compareRollData.options
            .filter((option): option is { id: string; disabled?: unknown } =>
                typeof option?.id === 'string' && option.disabled !== true)
            .map((option) => option.id)
        : [];
    const defenderChoiceData = current.data as {
        options?: Array<{ playerId?: unknown; disabled?: unknown }> | unknown;
    } | undefined;
    const defenderChoiceEnabledPlayerIds = interactionKind === 'dt:defender-choice' && Array.isArray(defenderChoiceData?.options)
        ? defenderChoiceData.options
            .filter((option): option is { playerId: string; disabled?: unknown } =>
                typeof option?.playerId === 'string' && option.disabled !== true)
            .map((option) => option.playerId)
        : [];
    const defenderChoiceSinglePlayerId = defenderChoiceEnabledPlayerIds.length === 1
        ? defenderChoiceEnabledPlayerIds[0]
        : null;
    const compareRollSingleOptionId = compareRollEnabledOptionIds.length === 1
        ? compareRollEnabledOptionIds[0]
        : null;
    const shouldForceCompareRollConfirm = interactionKind === 'compare-roll-choice'
        && compareRollEnabledOptionIds.length === 0
        && compareRollData !== undefined
        && Object.prototype.hasOwnProperty.call(compareRollData, 'confirmValue');
    const forceCommand = interactionKind === 'dt:token-response'
        ? { type: 'SKIP_TOKEN_RESPONSE', payload: {} }
        : interactionKind === 'dt:bonus-dice'
            ? { type: 'SKIP_BONUS_DICE_REROLL', payload: {} }
            : defenderChoiceSinglePlayerId
                ? { type: 'SELECT_DEFENDER_TARGET', payload: { defenderId: defenderChoiceSinglePlayerId } }
            : compareRollSingleOptionId
                ? { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: compareRollSingleOptionId } }
                : shouldForceCompareRollConfirm
                    ? { type: 'SYS_INTERACTION_CONFIRM', payload: {} }
                    : { type: 'SYS_INTERACTION_CANCEL', payload: { interactionId: fallbackInteractionId } };

    return {
        playerId,
        reason,
        requiresConfirmedAdvancePhase: true,
        fingerprintHint,
        resolution: buildForceEndTurnResolution({
            playerId,
            suffix: fingerprintHint,
            commands: [forceCommand],
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
    payload: { interactionId: string; optionId?: string; optionIds?: string[] };
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
            payload: { interactionId: current.id, optionId: skipOption.id },
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
            payload: { interactionId: current.id, optionId: cancelOption.id },
            sourceId,
            title,
        };
    }

    if (minCount === 0) {
        return {
            interactionId: current.id,
            payload: { interactionId: current.id, optionIds: [] },
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
            payload: { interactionId: current.id, optionId: doneOption.id },
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
            payload: { interactionId: current.id, optionId: enabledTriggerOptions[0].id },
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
        const fingerprintHint = buildResponseWindowRecoveryFingerprintHint(
            args.sharedState,
            responderId,
            'response-window',
        );
        return {
            playerId: responderId,
            reason: 'response-window',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint,
            resolution: buildForceEndTurnResolution({
                playerId: responderId,
                suffix: fingerprintHint,
                commands: [{ type: 'RESPONSE_PASS', payload: {} }],
            }),
        };
    }
    if (typeof responderId === 'string' && args.seatControllers[responderId]?.type === 'human') {
        // 当前响应权在 human 手里时，无论 active player 是否为 AI，都应保持真人流程。
        // watchdog 不能替真人强制关窗，也不能回退成 active-turn-legal-only。
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
    const core = args.sharedState?.core as { hostStarted?: unknown } | undefined;
    const turnNumber = typeof args.sharedState?.sys?.turnNumber === 'number'
        ? args.sharedState.sys.turnNumber
        : null;
    const isFactionSelectPhase = phase === 'factionSelect';
    const isPublicPregameLegalActionPhase = core?.hostStarted === false && (
        isFactionSelectPhase
        || (args.gameId === 'summonerwars' && phase === 'summon')
    );
    const isSplendorPregameResidualState = args.gameId === 'splendor'
        && core?.hostStarted !== true
        && (!phase || turnNumber === 0);
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
        // Splendor 线上残态曾出现 turn=0 + phase='' + currentPlayerId 已写入，
        // 但 hostStarted 丢失/未对齐的开局前快照。这里不能把它误当成 active AI 卡死，
        // 否则只会写出 legal_action_unavailable 噪音反馈。
        if (isSplendorPregameResidualState) {
            return null;
        }
        if (core?.hostStarted === false && !isPublicPregameLegalActionPhase) {
            return null;
        }

        const isDiceRollPhase = phase === 'offensiveRoll'
            || phase === 'targetingRoll'
            || phase === 'defensiveRoll';
        const advancePhaseCommandType = resolveWatchdogAdvancePhaseCommandType(args.gameId);

        // 公开预开局选择阶段的 AI 没动作，通常是 seat 凭据/seat state 还没准备好。
        // 这里若强行发 ADVANCE_PHASE，会把 match 非法推进到 startTurn/playCards，
        // 造成双方 factions 仍为空却直接进游戏、手牌/牌库全空的损坏状态。
        // 因此只能走“服务端代 AI 执行合法选阵营动作”这类 legal-action recovery，
        // 绝不能 watchdog 自动 ADVANCE_PHASE 跳过。
        //
        // DiceThrone 的 roll 阶段也不能直接 fallback 到裸 ADVANCE_PHASE：
        // offensiveRoll / targetingRoll / defensiveRoll 的真实推进依赖掷骰、确认、
        // 选目标或防御响应。若 seat overlay stale 或 legalActions 暂时为 0，
        // 强发 ADVANCE_PHASE 只会打出 command_failed，并制造高频误导性自动反馈。
        if (isFactionSelectPhase || isPublicPregameLegalActionPhase || isDiceRollPhase || !advancePhaseCommandType) {
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
        const fingerprintHint = `manual-visible-interaction:${buildInteractionRecoveryFingerprintHint(
            args.sharedState,
            visibleCurrent,
            interactionPlayerId,
        )}`;
        return {
            playerId: interactionPlayerId,
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint,
            resolution: buildForceEndTurnResolution({
                playerId: interactionPlayerId,
                suffix: `${fingerprintHint}:${interactionId}`,
                commands: [{ type: 'SYS_INTERACTION_CANCEL', payload: { interactionId } }],
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
        const seatState = args.seatStates[playerId];
        const fingerprintHint = `manual-hidden-interaction:${buildInteractionRecoveryFingerprintHint(
            seatState ?? args.sharedState,
            seatCurrent,
            playerId,
        )}`;
        return {
            playerId,
            reason: 'hidden-interaction',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint,
            resolution: buildForceEndTurnResolution({
                playerId,
                suffix: `${fingerprintHint}:${interactionId}`,
                commands: [{ type: 'SYS_INTERACTION_CANCEL', payload: { interactionId } }],
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
            const fingerprintHint = buildResponseWindowRecoveryFingerprintHint(
                args.sharedState,
                responderId,
                'manual-response-window',
            );
            return {
                playerId: responderId,
                reason: 'response-window',
                requiresConfirmedAdvancePhase: true,
                fingerprintHint,
                resolution: buildForceEndTurnResolution({
                    playerId: responderId,
                    suffix: `${fingerprintHint}:${windowId}`,
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
