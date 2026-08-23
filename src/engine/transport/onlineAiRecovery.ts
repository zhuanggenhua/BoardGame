import type { AiResolution, AiSeatController } from '../ai';
import {
    getFreshSimpleChoiceOptions,
    isControlChoiceOption as isSharedControlChoiceOption,
    isDoneControlChoiceOption,
    isSkipLikeControlChoiceOption,
    isSystemCancelControlChoiceOption,
    type InteractionDescriptor,
    type PromptOption,
    type SimpleChoiceData,
} from '../systems/InteractionSystem';
import type { MatchState } from '../types';
import { resolveCurrentTurnPlayerIdFromState } from '../sessionContext';
import {
    hasPendingResponseWindowInteractionLock,
    resolveResponseWindowCurrent,
    type ResponseWindowCurrentSummary,
    responseWindowSeatViewBelongsToResponder,
} from '../responseWindowInteractionLock';
import type { GameEngineConfig } from './engineConfig';
import {
    isOnlineAiWatchdogActiveTurnLegalActionOnlyPhase,
    shouldAutoSelectOnlineAiWatchdogFirstTriggerOnlySimpleChoice,
    isOnlineAiWatchdogPublicPregameLegalActionPhase,
    resolveOnlineAiWatchdogFallbackAdvancePhaseCommandType,
    shouldSuppressOnlineAiWatchdogActiveTurnCandidate,
} from './onlineAiWatchdogGameSemantics';

export type OnlineAiRecoveryEngineConfig = Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;

type HiddenSimpleChoiceOption = {
    id?: unknown;
    disabled?: unknown;
    value?: unknown;
};

export type HiddenSimpleChoiceInteraction = {
    id?: unknown;
    playerId?: unknown;
    kind?: unknown;
    data?: {
        title?: unknown;
        sourceId?: unknown;
        multi?: { min?: unknown; max?: unknown };
        options?: HiddenSimpleChoiceOption[];
        confirmValue?: unknown;
        slider?: unknown;
        meta?: unknown;
        allowedDieIds?: unknown;
        completedDieIds?: unknown;
    };
};

export type HiddenInteractionDescriptor = {
    id?: unknown;
    playerId?: unknown;
    kind?: unknown;
    data?: {
        title?: unknown;
        sourceId?: unknown;
        multi?: { min?: unknown; max?: unknown };
        options?: HiddenSimpleChoiceOption[];
        confirmValue?: unknown;
        slider?: unknown;
        meta?: unknown;
        allowedDieIds?: unknown;
        completedDieIds?: unknown;
    };
};

type ForcedInteractionRecoveryCommand = {
    type: string;
    payload: unknown;
};

export type ForceSkippableHiddenAiInteraction = {
    playerId: string;
    interactionId: string;
    sourceId?: string;
    title?: string;
    fingerprintHint?: string;
    resolution: AiResolution;
};

export type ForceEndTurnStalledAiReason =
    | 'hidden-interaction'
    | 'visible-interaction'
    | 'response-window'
    | 'response-loop'
    | 'active-turn'
    | 'active-turn-legal-only'
    | 'seat-legal-only'
    | 'action-loop'
    | 'pending-damage';

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
    loopInfo?: unknown;
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
    'online_ai_circuit_open',
]);

export function shouldSilentlyRetryOnlineAiBatchRejection(reason: string): boolean {
    return SILENT_ONLINE_AI_BATCH_REJECTION_REASONS.has(reason);
}

// Raw fallback only. Online AI behavior code should prefer resolveOnlineAiCurrentPlayerId()
// whenever engineConfig.onlineAiRecovery may redefine whose turn/seat currently owns recovery.
export function resolveCurrentPlayerId(sharedState: MatchState<unknown> | null | undefined): string | null {
    return resolveCurrentTurnPlayerIdFromState(sharedState);
}

export function resolveOnlineAiCurrentPlayerId(
    sharedState: MatchState<unknown> | null | undefined,
    options?: {
        engineConfig?: OnlineAiRecoveryEngineConfig | null;
        gameId?: string | null;
    },
): string | null {
    const fallbackPlayerId = resolveCurrentPlayerId(sharedState);
    if (!sharedState) {
        return fallbackPlayerId;
    }

    const phase = typeof sharedState.sys?.phase === 'string' ? sharedState.sys.phase : '';
    const configuredPlayerId = options?.engineConfig?.onlineAiRecovery?.resolveCurrentPlayerId?.({
        state: sharedState,
        phase,
        fallbackPlayerId,
    });

    return typeof configuredPlayerId === 'string' && configuredPlayerId.length > 0
        ? configuredPlayerId
        : fallbackPlayerId;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildStringArraySemanticSignature(values: unknown): string {
    if (!Array.isArray(values)) {
        return '';
    }

    return values
        .filter((value): value is string => typeof value === 'string')
        .join(',');
}

function buildStringRecordSemanticSignature(values: unknown): string {
    if (!isPlainRecord(values)) {
        return '';
    }

    return Object.keys(values)
        .sort()
        .map((key) => {
            const value = values[key];
            return `${key}:${typeof value === 'string' ? value : ''}`;
        })
        .join(',');
}

function buildBooleanRecordSemanticSignature(values: unknown): string {
    if (!isPlainRecord(values)) {
        return '';
    }

    return Object.keys(values)
        .sort()
        .map((key) => {
            const value = values[key];
            return `${key}:${typeof value === 'boolean' ? (value ? '1' : '0') : ''}`;
        })
        .join(',');
}

function buildStringArrayRecordSemanticSignature(values: unknown): string {
    if (!isPlainRecord(values)) {
        return '';
    }

    return Object.keys(values)
        .sort()
        .map((key) => `${key}:${buildStringArraySemanticSignature(values[key])}`)
        .join('|');
}

function buildSharedPregameSelectionProgressSignature(core: unknown): string {
    if (!isPlainRecord(core)) {
        return '';
    }

    const factionSelection = isPlainRecord(core.factionSelection) ? core.factionSelection : null;
    const takenFactionsSignature = buildStringArraySemanticSignature(factionSelection?.takenFactions);
    const playerSelectionsSignature = buildStringArrayRecordSemanticSignature(factionSelection?.playerSelections);
    const selectedFactionsSignature = buildStringRecordSemanticSignature(core.selectedFactions);
    const selectedCharactersSignature = buildStringRecordSemanticSignature(core.selectedCharacters);
    const readyPlayersSignature = buildBooleanRecordSemanticSignature(core.readyPlayers);

    if (
        !takenFactionsSignature
        && !playerSelectionsSignature
        && !selectedFactionsSignature
        && !selectedCharactersSignature
        && !readyPlayersSignature
    ) {
        return '';
    }

    return [
        takenFactionsSignature,
        playerSelectionsSignature,
        selectedFactionsSignature,
        selectedCharactersSignature,
        readyPlayersSignature,
    ].join('#');
}

function resolvePregameSelectionProgressSignature(
    state: MatchState<unknown>,
    options?: {
        engineConfig?: OnlineAiRecoveryEngineConfig | null;
    },
): string {
    const fallbackSignature = buildSharedPregameSelectionProgressSignature(state.core);
    const phase = typeof state.sys?.phase === 'string' ? state.sys.phase : '';
    const resolver = options?.engineConfig?.onlineAiRecovery?.buildPregameSelectionProgressSignature;
    if (!resolver) {
        return fallbackSignature;
    }
    const overriddenSignature = resolver({
        state,
        phase,
        fallbackSignature,
    });
    if (overriddenSignature !== undefined) {
        return typeof overriddenSignature === 'string' ? overriddenSignature : '';
    }
    return fallbackSignature;
}

export function buildAiProgressMarker(
    state: MatchState<unknown>,
    options?: {
        engineConfig?: OnlineAiRecoveryEngineConfig | null;
        gameId?: string | null;
    },
): string {
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
    const currentResponseWindow = resolveResponseWindowCurrent(state);
    const responseWindowType = currentResponseWindow?.windowType ?? '';
    const responseWindowSourceId = currentResponseWindow?.sourceId ?? '';
    const responderIndex = currentResponseWindow?.currentResponderIndex ?? '';
    const currentPlayerId = resolveOnlineAiCurrentPlayerId(state, options) ?? '';
    const pregameSelectionProgressSignature = resolvePregameSelectionProgressSignature(state, options);

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
        pregameSelectionProgressSignature,
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

export function buildPendingDamageSemanticSignature(pendingDamage: unknown): string {
    if (!isPlainRecord(pendingDamage)) {
        return '';
    }

    return JSON.stringify({
        id: typeof pendingDamage.id === 'string' ? pendingDamage.id : null,
        responderId: typeof pendingDamage.responderId === 'string' ? pendingDamage.responderId : null,
        responseType: typeof pendingDamage.responseType === 'string' ? pendingDamage.responseType : null,
        currentDamage: typeof pendingDamage.currentDamage === 'number' ? pendingDamage.currentDamage : null,
        sourceAbilityId: typeof pendingDamage.sourceAbilityId === 'string' ? pendingDamage.sourceAbilityId : null,
        tokenUsageTotals: pendingDamage.tokenUsageTotals ?? null,
    });
}

export function buildPendingBonusDiceSettlementSemanticSignature(settlement: unknown): string {
    if (!isPlainRecord(settlement)) {
        return '';
    }

    return JSON.stringify({
        id: typeof settlement.id === 'string' ? settlement.id : null,
        attackerId: typeof settlement.attackerId === 'string' ? settlement.attackerId : null,
        displayOnly: settlement.displayOnly === true ? true : null,
        rerollCount: typeof settlement.rerollCount === 'number' ? settlement.rerollCount : null,
        dice: settlement.dice ?? null,
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

export function buildInteractionRecoveryFingerprintHint(
    state: MatchState<unknown>,
    interaction: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction | null | undefined,
    fallbackPlayerId: string,
    options?: {
        engineConfig?: OnlineAiRecoveryEngineConfig | null;
        gameId?: string | null;
    },
): string {
    const phase = typeof state.sys?.phase === 'string' ? state.sys.phase : '';
    const playerId = typeof interaction?.playerId === 'string' ? interaction.playerId : fallbackPlayerId;
    const kind = typeof interaction?.kind === 'string' ? interaction.kind : 'interaction';
    const interactionId = typeof interaction?.id === 'string' ? interaction.id : '';
    const sourceId = typeof interaction?.data?.sourceId === 'string' ? interaction.data.sourceId : '';
    const title = typeof interaction?.data?.title === 'string' ? interaction.data.title : '';
    const optionSignature = buildInteractionOptionSemanticSignature(interaction?.data?.options);
    const sliderSignature = buildInteractionSliderSemanticSignature(interaction?.data?.slider);

    const fallbackFingerprintHint = kind === 'simple-choice'
        ? (() => {
            const minCount = typeof interaction?.data?.multi?.min === 'number' ? interaction.data.multi.min : '';
            return `interaction:${playerId}:${phase}:simple-choice:${sourceId}:${title}:${minCount}:${sliderSignature}:${optionSignature}`;
        })()
        : kind === 'compare-roll-choice'
            ? (() => {
                const confirmValueSignature = buildInteractionOptionValueSignature(interaction?.data?.confirmValue);
                return `interaction:${playerId}:${phase}:compare-roll-choice:${sourceId}:${confirmValueSignature}:${optionSignature}:${interactionId}`;
            })()
            : kind === 'multistep-choice'
                    ? (() => {
                        const allowedDieIdsSignature = buildNumberArraySemanticSignature(interaction?.data?.allowedDieIds);
                        const completedDieIdsSignature = buildNumberArraySemanticSignature(interaction?.data?.completedDieIds);
                        const metaSignature = buildMultistepChoiceMetaSemanticSignature(interaction?.data?.meta);
                        return `interaction:${playerId}:${phase}:multistep-choice:${sourceId}:${allowedDieIdsSignature}:${completedDieIdsSignature}:${metaSignature}:${interactionId}`;
                    })()
                    : `interaction:${playerId}:${phase}:${kind}:${interactionId}`;

    const configuredFingerprintHint = options?.engineConfig?.onlineAiRecovery?.buildInteractionRecoveryFingerprintHint?.({
        state,
        playerId,
        phase,
        interaction: interaction as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
        fallbackFingerprintHint,
    });
    return typeof configuredFingerprintHint === 'string' && configuredFingerprintHint.length > 0
        ? configuredFingerprintHint
        : fallbackFingerprintHint;
}

export function buildResponseWindowRecoveryFingerprintHint(
    state: MatchState<unknown> | null | undefined,
    fallbackPlayerId: string,
    reason: 'response-window' | 'response-loop' | 'manual-response-window' = 'response-window',
): string {
    const phase = typeof state?.sys?.phase === 'string' ? state.sys.phase : '';
    const current = resolveResponseWindowCurrent(state);
    const windowId = current?.id ?? '';
    const windowType = current?.windowType ?? '';
    const sourceId = current?.sourceId ?? '';
    const responderId = current?.currentResponderId ?? fallbackPlayerId;
    const queueSignature = current?.responderQueue.join('|') ?? '';

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

function resolveAiCurrentPlayerForHumanResponseWindow(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
}): string | null {
    const currentPlayerId = resolveOnlineAiCurrentPlayerId(args.sharedState, {
        engineConfig: args.engineConfig,
        gameId: args.gameId,
    });
    return currentPlayerId && args.seatControllers[currentPlayerId]?.type !== 'human'
        ? currentPlayerId
        : null;
}

function buildForceCloseHumanResponseWindowDuringAiPhase(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    responseWindow: ResponseWindowCurrentSummary;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
    fingerprintReason?: 'response-window' | 'manual-response-window';
    suffixDetail?: string;
}): ForceEndTurnStalledAiResolution | null {
    const aiPlayerId = resolveAiCurrentPlayerForHumanResponseWindow(args);
    if (!aiPlayerId) {
        return null;
    }
    const windowId = args.responseWindow.id ?? `${aiPlayerId}:human-response-window`;
    const fingerprintReason = args.fingerprintReason ?? 'response-window';
    const fingerprintHint = buildResponseWindowRecoveryFingerprintHint(
        args.sharedState,
        aiPlayerId,
        fingerprintReason,
    );
    const suffix = args.suffixDetail
        ? `${fingerprintHint}:${windowId}:${args.suffixDetail}`
        : `${fingerprintHint}:${windowId}`;
    return {
        playerId: aiPlayerId,
        reason: 'response-window',
        requiresConfirmedAdvancePhase: true,
        fingerprintHint,
        resolution: buildForceEndTurnResolution({
            playerId: aiPlayerId,
            suffix,
            commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
        }),
    };
}

function buildForceEndTurnFromInteractionState(
    state: MatchState<unknown>,
    playerId: string,
    reason: 'hidden-interaction' | 'visible-interaction',
    options?: {
        engineConfig?: OnlineAiRecoveryEngineConfig | null;
        gameId?: string | null;
    },
): ForceEndTurnStalledAiResolution | null {
    const current = (state.sys as { interaction?: { current?: unknown } } | undefined)?.interaction?.current as HiddenSimpleChoiceInteraction | undefined;
    if (!current || String(current.playerId) !== playerId) {
        return null;
    }

    const fingerprintHint = buildInteractionRecoveryFingerprintHint(state, current, playerId, options);
    const phase = typeof state.sys?.phase === 'string' ? state.sys.phase : '';
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
    const compareRollSingleOptionId = compareRollEnabledOptionIds.length === 1
        ? compareRollEnabledOptionIds[0]
        : null;
    const shouldForceCompareRollConfirm = interactionKind === 'compare-roll-choice'
        && compareRollEnabledOptionIds.length === 0
        && compareRollData !== undefined
        && Object.prototype.hasOwnProperty.call(compareRollData, 'confirmValue');
    const fallbackCommand = compareRollSingleOptionId
        ? { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: compareRollSingleOptionId } }
        : shouldForceCompareRollConfirm
            ? { type: 'SYS_INTERACTION_CONFIRM', payload: {} }
            : { type: 'SYS_INTERACTION_CANCEL', payload: { interactionId: fallbackInteractionId } };

    const configuredForceCommand = options?.engineConfig?.onlineAiRecovery?.resolveForcedInteractionCommand?.({
        state,
        playerId,
        phase,
        interaction: current,
        fallbackCommand,
    }) as ForcedInteractionRecoveryCommand | false | null | undefined;

    if (configuredForceCommand === false) {
        return null;
    }

    const forceSkipPayload = buildForceSkipPayloadFromSeatState(state, playerId, options);
    if (!configuredForceCommand && forceSkipPayload) {
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

    const forceCommand = configuredForceCommand ?? fallbackCommand;

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

export function resolveForceAdvancePhaseAfterRecovery(args: {
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    playerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
}): AiResolution | null {
    const { authoritativeState, seatControllers, playerId } = args;
    if (!authoritativeState || authoritativeState.sys?.gameover) {
        return null;
    }
    if (seatControllers[playerId]?.type === 'human') {
        return null;
    }
    if (resolveOnlineAiCurrentPlayerId(authoritativeState, {
        engineConfig: args.engineConfig,
        gameId: args.gameId,
    }) !== playerId) {
        return null;
    }

    const currentInteraction = authoritativeState.sys?.interaction as {
        current?: unknown;
        isBlocked?: unknown;
    } | undefined;
    if (currentInteraction?.current || currentInteraction?.isBlocked === true) {
        return null;
    }

    if (resolveResponseWindowCurrent(authoritativeState)) {
        return null;
    }

    const advancePhaseCommandType = resolveOnlineAiWatchdogFallbackAdvancePhaseCommandType({
        engineConfig: args.engineConfig,
    });
    if (!advancePhaseCommandType) {
        return null;
    }

    const resolution = buildForceEndTurnResolution({
        playerId,
        suffix: buildForceEndTurnFollowUpSuffix(authoritativeState, playerId),
        commands: [{ type: advancePhaseCommandType, payload: {} }],
    });
    const phase = typeof authoritativeState.sys?.phase === 'string'
        ? authoritativeState.sys.phase
        : '';
    const isLegalActionOnlyRecoveryPhase = isOnlineAiWatchdogActiveTurnLegalActionOnlyPhase({
        state: authoritativeState,
        phase,
        engineConfig: args.engineConfig,
    }) || isOnlineAiWatchdogPublicPregameLegalActionPhase({
        state: authoritativeState,
        phase,
        engineConfig: args.engineConfig,
    });
    if (isLegalActionOnlyRecoveryPhase) {
        const probeCandidate: ForceEndTurnStalledAiResolution = {
            playerId,
            reason: 'active-turn',
            legalActionOnly: true,
            resolution,
        };
        const forceAllowed = args.engineConfig?.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted?.({
            state: authoritativeState,
            phase,
            previousCandidate: probeCandidate,
            nextCandidate: probeCandidate,
        }) === true;
        if (!forceAllowed) {
            return null;
        }
    }

    return resolution;
}

export function resolveForceEndTurnFollowUpAfterConfirmation(args: {
    candidate: ForceEndTurnStalledAiResolution;
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
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
        engineConfig: args.engineConfig,
        gameId: args.gameId,
    });
}

function isControlChoiceOptionShared(option: HiddenSimpleChoiceOption): boolean {
    return isSharedControlChoiceOption(option);
}

function hasEnabledNonControlOptions(options: Array<HiddenSimpleChoiceOption & { id: string }>): boolean {
    return options.some((option) => !isControlChoiceOptionShared(option));
}

function getFreshEnabledSimpleChoiceOptions(
    state: MatchState<unknown>,
    current: HiddenSimpleChoiceInteraction,
): Array<HiddenSimpleChoiceOption & { id: string }> {
    return getFreshSimpleChoiceOptions(
        state,
        current as unknown as InteractionDescriptor<SimpleChoiceData<unknown>>,
    ).filter((option): option is PromptOption<unknown> & HiddenSimpleChoiceOption & { id: string } =>
        Boolean(option) && option.disabled !== true && typeof option.id === 'string');
}

function buildForceSkipPayloadFromSeatState(
    state: MatchState<unknown>,
    playerId: string,
    options?: {
        allowWhenHasNonControl?: boolean;
        engineConfig?: OnlineAiRecoveryEngineConfig | null;
        gameId?: string | null;
    },
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
    const enabledOptions = getFreshEnabledSimpleChoiceOptions(state, current);
    const sourceId = typeof data?.sourceId === 'string' ? data.sourceId : undefined;
    const title = typeof data?.title === 'string' ? data.title : undefined;
    const minCount = typeof data?.multi?.min === 'number' ? data.multi.min : 1;
    const maxCount = typeof data?.multi?.max === 'number' ? data.multi.max : minCount;

    const skipOption = enabledOptions.find((option) => isSkipLikeControlChoiceOption(option));
    if (skipOption?.id) {
        return {
            interactionId: current.id,
            payload: { interactionId: current.id, optionId: skipOption.id },
            sourceId,
            title,
        };
    }

    const enabledTriggerOptions = enabledOptions.filter((option) => {
        const value = option.value as { kind?: unknown } | undefined;
        return !isControlChoiceOptionShared(option) && value?.kind === 'trigger';
    });
    if (shouldAutoSelectOnlineAiWatchdogFirstTriggerOnlySimpleChoice({
        sourceId,
        engineConfig: options?.engineConfig,
    })
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

    const allowWhenHasNonControl = options?.allowWhenHasNonControl ?? true;
    if (!allowWhenHasNonControl && hasEnabledNonControlOptions(enabledOptions)) {
        return null;
    }

    const cancelOption = enabledOptions.find((option) => isSystemCancelControlChoiceOption(option));
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

    const doneOption = enabledOptions.find((option) => isDoneControlChoiceOption(option));
    if (doneOption?.id) {
        return {
            interactionId: current.id,
            payload: { interactionId: current.id, optionId: doneOption.id },
            sourceId,
            title,
        };
    }

    return null;
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

function shouldPreferResponderHiddenInteractionOverResponsePass(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatState: MatchState<unknown> | null | undefined;
    responderId: string;
}): boolean {
    const seatCurrent = (args.seatState?.sys?.interaction as { current?: unknown } | undefined)?.current as HiddenSimpleChoiceInteraction | undefined;
    if (!seatCurrent || String(seatCurrent.playerId) !== args.responderId) {
        return false;
    }

    return responseWindowSeatViewBelongsToResponder({
        sharedWindow: resolveResponseWindowCurrent(args.sharedState),
        seatWindow: resolveResponseWindowCurrent(args.seatState),
        responderId: args.responderId,
    });
}

export function resolveForceSkippableHiddenAiInteraction(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
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
            engineConfig: args.engineConfig,
            gameId: args.gameId,
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

function resolveConfiguredSeatLegalOnlyRecovery(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): ForceEndTurnStalledAiResolution | null {
    const phase = typeof args.sharedState?.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : '';
    if (!args.sharedState) {
        return null;
    }
    const configuredRecovery = args.engineConfig?.onlineAiRecovery?.resolveSeatLegalOnlyRecovery?.({
        state: args.sharedState,
        phase,
    });
    if (!configuredRecovery) {
        return null;
    }

    if (args.seatControllers[configuredRecovery.playerId]?.type === 'human') {
        return null;
    }

    return {
        playerId: configuredRecovery.playerId,
        reason: 'seat-legal-only',
        fingerprintHint: configuredRecovery.fingerprintHint,
        resolution: buildForceEndTurnResolution({
            playerId: configuredRecovery.playerId,
            suffix: configuredRecovery.attemptSuffix ?? configuredRecovery.fingerprintHint,
            commands: [configuredRecovery.command],
        }),
    };
}

export function resolveForceEndTurnForStalledAi(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
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
        const responseWindow = resolveResponseWindowCurrent(args.sharedState);
        const responderId = responseWindow?.currentResponderId;
        if (responseWindow && responderId && args.seatControllers[responderId]?.type === 'human') {
            const interactionId = typeof visibleCurrent.id === 'string' && visibleCurrent.id.length > 0
                ? visibleCurrent.id
                : 'unknown-visible-interaction';
            const interactionData = visibleCurrent.data as { sourceId?: unknown } | undefined;
            const sourceId = typeof interactionData?.sourceId === 'string' && interactionData.sourceId.length > 0
                ? interactionData.sourceId
                : 'unknown-source';
            const forceCloseWindow = buildForceCloseHumanResponseWindowDuringAiPhase({
                sharedState: args.sharedState,
                seatControllers: args.seatControllers,
                responseWindow,
                engineConfig: args.engineConfig,
                gameId: args.gameId,
                suffixDetail: `blocked-visible-interaction:${interactionId}:${sourceId}`,
            });
            if (forceCloseWindow?.playerId === interactionPlayerId) {
                return forceCloseWindow;
            }
        }
        const visibleInteractionRecovery = buildForceEndTurnFromInteractionState(
            args.sharedState as MatchState<unknown>,
            interactionPlayerId,
            'visible-interaction',
            {
                engineConfig: args.engineConfig,
                gameId: args.gameId,
            },
        );
        if (visibleInteractionRecovery) {
            return visibleInteractionRecovery;
        }

        return resolveConfiguredSeatLegalOnlyRecovery(args);
    }

    if (shouldInspectSeatStatesForHiddenAiInteraction(args.sharedState)) {
        for (const [playerId, controller] of Object.entries(args.seatControllers)) {
            if (controller.type === 'human') continue;
            const seatState = args.seatStates[playerId];
            if (!seatState) continue;
            const hiddenResolution = buildForceEndTurnFromInteractionState(seatState, playerId, 'hidden-interaction', {
                engineConfig: args.engineConfig,
                gameId: args.gameId,
            });
            if (hiddenResolution) {
                return hiddenResolution;
            }
        }
        if (hasPendingResponseWindowInteractionLock(args.sharedState)) {
            const responseWindow = resolveResponseWindowCurrent(args.sharedState);
            const responderId = responseWindow?.currentResponderId;
            if (responderId && args.seatControllers[responderId]?.type !== 'human') {
                const windowId = responseWindow.id ?? `${responderId}:pending-response-window-interaction-lock`;
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
                        suffix: `${fingerprintHint}:${windowId}:orphan-pending-interaction`,
                        commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                    }),
                };
            }
            if (responseWindow && responderId && args.seatControllers[responderId]?.type === 'human') {
                return null;
            }
            return null;
        }
    }

    const responseWindow = resolveResponseWindowCurrent(args.sharedState);
    const responderId = responseWindow?.currentResponderId;
    if (responderId && args.seatControllers[responderId]?.type !== 'human') {
        const responderSeatState = args.seatStates[responderId];
        if (shouldPreferResponderHiddenInteractionOverResponsePass({
            sharedState: args.sharedState,
            seatState: responderSeatState,
            responderId,
        })) {
            const hiddenResolution = responderSeatState
                ? buildForceEndTurnFromInteractionState(responderSeatState, responderId, 'hidden-interaction', {
                    engineConfig: args.engineConfig,
                    gameId: args.gameId,
                })
                : null;
            if (hiddenResolution) {
                return hiddenResolution;
            }
        }

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
    if (responderId && args.seatControllers[responderId]?.type === 'human') {
        return null;
    }

    const configuredSeatLegalOnlyRecovery = resolveConfiguredSeatLegalOnlyRecovery(args);
    if (configuredSeatLegalOnlyRecovery) {
        return configuredSeatLegalOnlyRecovery;
    }

    const phase = typeof args.sharedState?.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : '';
    const currentPlayerId = resolveOnlineAiCurrentPlayerId(args.sharedState, {
        engineConfig: args.engineConfig,
        gameId: args.gameId,
    });
    const core = args.sharedState?.core as { hostStarted?: unknown } | undefined;
    const turnNumber = typeof args.sharedState?.sys?.turnNumber === 'number'
        ? args.sharedState.sys.turnNumber
        : null;
    const isPublicPregameLegalActionPhase = isOnlineAiWatchdogPublicPregameLegalActionPhase({
        state: args.sharedState as MatchState<unknown>,
        phase,
        engineConfig: args.engineConfig,
    });
    if (currentPlayerId && args.seatControllers[currentPlayerId]?.type !== 'human') {
        if (shouldSuppressOnlineAiWatchdogActiveTurnCandidate({
            state: args.sharedState as MatchState<unknown>,
            phase,
            currentPlayerId,
            turnNumber,
            engineConfig: args.engineConfig,
        })) {
            return null;
        }
        if (core?.hostStarted === false && !isPublicPregameLegalActionPhase) {
            return null;
        }

        if (isOnlineAiWatchdogActiveTurnLegalActionOnlyPhase({
            state: args.sharedState as MatchState<unknown>,
            phase,
            engineConfig: args.engineConfig,
        })) {
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

        const advancePhaseCommandType = resolveOnlineAiWatchdogFallbackAdvancePhaseCommandType({
            engineConfig: args.engineConfig,
        });

        // 公开预开局选择阶段的 AI 没动作，通常是 seat 凭据/seat state 还没准备好。
        // 这里若强行发 ADVANCE_PHASE，会把 match 非法推进到 startTurn/playCards，
        // 造成双方 factions 仍为空却直接进游戏、手牌/牌库全空的损坏状态。
        // 因此只能走“服务端代 AI 执行合法选阵营动作”这类 legal-action recovery，
        // 绝不能 watchdog 自动 ADVANCE_PHASE 跳过。
        //
        // 对于显式禁用 fallback advance 的游戏，active-turn recovery 只能走 legal-action，
        // 因为该游戏的阶段推进依赖真实合法动作，而不是裸 ADVANCE_PHASE。
        if (isPublicPregameLegalActionPhase || !advancePhaseCommandType) {
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
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
}): ForceEndTurnStalledAiResolution | null {
    if (args.sharedState?.sys?.gameover) {
        return null;
    }
    if (!args.sharedState) {
        return null;
    }

    const currentWindow = resolveResponseWindowCurrent(args.sharedState);

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
            {
                engineConfig: args.engineConfig,
                gameId: args.gameId,
            },
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
            {
                engineConfig: args.engineConfig,
                gameId: args.gameId,
            },
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
        const responderId = currentWindow.currentResponderId;
        if (responderId && args.seatControllers[responderId]?.type === 'human') {
            return buildForceCloseHumanResponseWindowDuringAiPhase({
                sharedState: args.sharedState,
                seatControllers: args.seatControllers,
                responseWindow: currentWindow,
                engineConfig: args.engineConfig,
                gameId: args.gameId,
                fingerprintReason: 'manual-response-window',
            });
        }
        if (responderId && args.seatControllers[responderId]?.type !== 'human') {
            const windowId = currentWindow.id ?? `${responderId}:manual-response-window`;
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
        const phase = typeof args.sharedState.sys?.phase === 'string'
            ? args.sharedState.sys.phase
            : '';
        const advancePhaseCommandType = resolveOnlineAiWatchdogFallbackAdvancePhaseCommandType({
            engineConfig: args.engineConfig,
        });
        if (!advancePhaseCommandType) {
            return null;
        }

        const suffix = `manual-force-advance:${candidate.playerId}:${phase || 'unknown-phase'}`;
        return {
            playerId: candidate.playerId,
            reason: 'active-turn',
            fingerprintHint: suffix,
            resolution: buildForceEndTurnResolution({
                playerId: candidate.playerId,
                suffix,
                commands: [{ type: advancePhaseCommandType, payload: {} }],
            }),
        };
    }
    if (candidate) {
        return candidate;
    }

    const phase = typeof args.sharedState.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : '';
    const currentPlayerId = resolveOnlineAiCurrentPlayerId(args.sharedState, {
        engineConfig: args.engineConfig,
        gameId: args.gameId,
    });
    const manualFallbackPlayerId = currentPlayerId && args.seatControllers[currentPlayerId]?.type !== 'human'
        ? currentPlayerId
        : null;
    if (!manualFallbackPlayerId) {
        return null;
    }

    const advancePhaseCommandType = resolveOnlineAiWatchdogFallbackAdvancePhaseCommandType({
        engineConfig: args.engineConfig,
    });
    if (!advancePhaseCommandType) {
        return null;
    }

    const suffix = `manual-force-fallback:${manualFallbackPlayerId}:${phase || 'unknown-phase'}`;
    return {
        playerId: manualFallbackPlayerId,
        reason: 'active-turn',
        fingerprintHint: suffix,
        resolution: buildForceEndTurnResolution({
            playerId: manualFallbackPlayerId,
            suffix,
            commands: [{ type: advancePhaseCommandType, payload: {} }],
        }),
    };
}

export function resolveForceEndTurnRecoveryStep(args: {
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    playerId: string;
    allowAdvancePhase?: boolean;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
}): AiResolution | null {
    const { authoritativeState, seatControllers, playerId, allowAdvancePhase = false } = args;
    if (!authoritativeState || authoritativeState.sys?.gameover) {
        return null;
    }
    if (seatControllers[playerId]?.type === 'human') {
        return null;
    }
    if (resolveOnlineAiCurrentPlayerId(authoritativeState, {
        engineConfig: args.engineConfig,
        gameId: args.gameId,
    }) !== playerId) {
        return null;
    }

    const currentInteraction = authoritativeState.sys?.interaction as {
        current?: unknown;
        isBlocked?: unknown;
    } | undefined;
    if (currentInteraction?.current || currentInteraction?.isBlocked === true) {
        return null;
    }

    if (resolveResponseWindowCurrent(authoritativeState)) {
        return null;
    }

    if (!allowAdvancePhase) {
        return null;
    }

    return resolveForceAdvancePhaseAfterRecovery({
        authoritativeState,
        seatControllers,
        playerId,
        engineConfig: args.engineConfig,
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
