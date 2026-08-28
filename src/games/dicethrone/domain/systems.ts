/**
 * DiceThrone 专用系统扩展
 * 处理领域事件到系统状态的映射
 */

import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import type { ChoiceRequest, ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import { createSimpleChoiceFromChoiceRequest } from '../../../engine/systems/ChoiceRequestSimpleChoiceAdapter';
import { INTERACTION_EVENTS, queueInteraction, resolveInteraction, createCompareRollChoice, createMultistepChoice } from '../../../engine/systems/InteractionSystem';
import { completeResolutionFrame } from '../../../engine/systems/resolutionStack';
import type { InteractionDescriptor as EngineInteractionDescriptor, SimpleChoiceData, PromptOption, MultistepChoiceData } from '../../../engine/systems/InteractionSystem';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    ChoiceRequestedEvent,
    ChoiceResolvedEvent,
    InteractionRequestedEvent,
    BonusDiceRerollRequestedEvent,
    InteractionDescriptor as DtInteractionDescriptor,
    TurnPhase,
} from './types';
import { getPlayerPassiveAbilities } from './passiveAbility';
import { findPlayerAbility } from './abilityLookup';
import { getChoiceResolvedEventHandler } from './choiceResolvedEvents';
import { hasCurrentChoiceAnchor } from './choiceEffects';
import { getActiveDice } from './rules';
import { isRemovableStatusId } from './statusRemoval';
import { updatePendingAttackSettlementStage } from './utils';
import { buildAfterRollConfirmedSignature } from './responseWindowGuards';
import {
    readDiceThroneTokenResponseChoiceContract,
    resolveDiceThroneTokenResponseInteractionPendingDamageId,
} from './tokenResponseChoiceContract';

const UNSATISFIABLE_CHOICE_REASONS = new Set([
    'empty-options',
    'all-options-disabled',
    'min-selection-unreachable',
    'no-legal-actions',
]);

type EmergencySkipContext = {
    sourceId?: string;
    interactionData?: unknown;
};

type DiceThroneChoiceOptionValue = ChoiceRequestedEvent['payload']['options'][number];
type DiceThroneCompareRollConfirmValue = NonNullable<NonNullable<ChoiceRequestedEvent['payload']['compareRoll']>['confirmValue']>;

const sanitizeInteractionIdPart = (value: unknown, fallback: string): string => {
    if (typeof value !== 'string' || value.length === 0) return fallback;
    const sanitized = value.replace(/[^a-zA-Z0-9_-]+/g, '-');
    return sanitized.length > 0 ? sanitized : fallback;
};

const buildChoiceInteractionId = (
    state: MatchState<DiceThroneCore>,
    prefix: string,
    sourceAbilityId: string | undefined,
    playerId: string | undefined,
): string => {
    const decisionEpoch = typeof state.sys?.decisionEpoch === 'number' ? state.sys.decisionEpoch : 0;
    const queueOrdinal = state.sys.interaction?.current
        ? (state.sys.interaction.queue?.length ?? 0) + 1
        : 0;
    return [
        prefix,
        sanitizeInteractionIdPart(sourceAbilityId, 'unknown'),
        sanitizeInteractionIdPart(playerId, 'player'),
        String(decisionEpoch),
        String(queueOrdinal),
    ].join('-');
};

const buildAutoResolvedCompareRollEvent = (
    payload: ChoiceRequestedEvent['payload'],
    confirmValue: DiceThroneCompareRollConfirmValue,
    timestamp: number,
): ChoiceResolvedEvent => ({
    type: 'CHOICE_RESOLVED',
    payload: {
        playerId: payload.playerId,
        statusId: confirmValue.statusId,
        tokenId: confirmValue.tokenId,
        value: confirmValue.value,
        customId: confirmValue.customId,
        sourceAbilityId: payload.sourceAbilityId,
    },
    sourceCommandType: 'COMPARE_ROLL_AUTO_RESOLVE',
    timestamp,
});

const pushChoiceResolvedFollowups = (
    nextEvents: GameEvent[],
    state: MatchState<DiceThroneCore>,
    resolvedEvent: ChoiceResolvedEvent,
    random: RandomFn,
): void => {
    const customId = resolvedEvent.payload.customId;
    if (!customId) {
        return;
    }
    const followupHandler = getChoiceResolvedEventHandler(customId);
    const hasChoiceAnchor = hasCurrentChoiceAnchor(state.core, resolvedEvent.payload.sourceAbilityId)
        || resolvedEvent.payload.interactionBacked === true;
    if (!followupHandler || !hasChoiceAnchor) {
        return;
    }
    nextEvents.push(...followupHandler({
        state: state.core,
        playerId: resolvedEvent.payload.playerId,
        customId,
        sourceAbilityId: resolvedEvent.payload.sourceAbilityId,
        value: resolvedEvent.payload.value,
        timestamp: resolvedEvent.timestamp,
        random,
    }));
};

function extractChoiceCustomIds(interactionData: unknown): string[] {
    const data = interactionData as { options?: Array<{ value?: { customId?: unknown } }> } | undefined;
    if (!Array.isArray(data?.options)) return [];
    return data.options
        .map((option) => option?.value?.customId)
        .filter((customId): customId is string => typeof customId === 'string');
}

function isDefenderChoiceInteractionData(interactionData: unknown): boolean {
    if (!interactionData || typeof interactionData !== 'object') return false;
    const data = interactionData as {
        attackerId?: unknown;
        chooserPlayerId?: unknown;
        targetRollValue?: unknown;
        options?: unknown;
    };
    return typeof data.attackerId === 'string'
        && typeof data.chooserPlayerId === 'string'
        && typeof data.targetRollValue === 'number'
        && Array.isArray(data.options);
}

function hasCommittedMultistepEffect(interactionData: unknown): boolean {
    if (!interactionData || typeof interactionData !== 'object') return false;
    const data = interactionData as {
        completedSteps?: unknown;
        completedDieIds?: unknown;
    };
    if (typeof data.completedSteps === 'number' && data.completedSteps > 0) {
        return true;
    }
    return Array.isArray(data.completedDieIds)
        && data.completedDieIds.some((dieId) => typeof dieId === 'number');
}

function isOffensiveRollEndTokenChoice(customIds: string[], sourceId?: string): boolean {
    if (sourceId === 'offensive-roll-end-token') return true;
    if (customIds.length === 0) return false;
    return customIds.some((customId) => customId.startsWith('use-'))
        && customIds.some((customId) => customId === 'skip');
}

function isOnOffensiveRollEndToken(core: DiceThroneCore, tokenId: string): boolean {
    const timing = core.tokenDefinitions.find((definition) => definition.id === tokenId)?.activeUse?.timing;
    return timing === 'onOffensiveRollEnd'
        || (Array.isArray(timing) && timing.includes('onOffensiveRollEnd'));
}

function isStaleOffensiveRollEndChoiceResolved(core: DiceThroneCore, event: ChoiceResolvedEvent): boolean {
    const { tokenId, playerId, customId } = event.payload;
    if (typeof customId !== 'string' || !customId.startsWith('use-')) {
        return false;
    }

    if (!tokenId || !isOnOffensiveRollEndToken(core, tokenId)) {
        return false;
    }

    if (!core.pendingAttack || core.pendingAttack.offensiveRollEndTokenResolved === true) {
        return true;
    }

    const player = core.players[playerId];
    if (!player) {
        return true;
    }

    return (player.tokens[tokenId] ?? 0) <= 0;
}

function shouldQueueBonusDiceAfterResponseWindow(
    state: MatchState<DiceThroneCore>,
    event: DiceThroneEvent,
): boolean {
    if (event.type !== 'RESPONSE_WINDOW_CLOSED') return false;
    const settlement = state.core.pendingBonusDiceSettlement;
    return Boolean(settlement)
        && state.core.afterRollResponseWindowSignature?.includes(`|settlement:${settlement.id}`) === true;
}

function shouldCarryForwardAfterRollResponseWindowSequence(
    state: MatchState<DiceThroneCore>,
    event: DiceThroneEvent,
): boolean {
    if (event.type !== 'DIE_MODIFIED' && event.type !== 'DIE_REROLLED') return false;
    if (state.sys.responseWindow?.current?.windowType !== 'afterRollConfirmed') return false;
    if (state.sys.phase !== 'offensiveRoll') return false;

    const rollSequence = state.core.rollConfirmedSequence ?? 0;
    if (rollSequence <= 0 || state.core.afterRollResponseWindowSequence !== rollSequence) {
        return false;
    }

    const { ownerId, playerId, target } = event.payload;
    const targetsCurrentRollDice = target === undefined || target === 'activeDie';
    return targetsCurrentRollDice
        && typeof ownerId === 'string'
        && ownerId !== playerId;
}

function carryForwardAfterRollResponseWindowSequence(
    state: MatchState<DiceThroneCore>,
): MatchState<DiceThroneCore> {
    const rollSequence = state.core.rollConfirmedSequence ?? 0;
    const rollSignature = buildAfterRollConfirmedSignature(state.core, state.sys.phase as TurnPhase | undefined);
    return {
        ...state,
        core: {
            ...state.core,
            afterRollResponseWindowSequence: rollSequence + 1,
            afterRollResponseWindowSignature: rollSignature,
            afterRollResponseWindowRequiresAttackDeclaration: true,
        },
    };
}

function queueDiceThroneInteraction(
    state: MatchState<DiceThroneCore>,
    interaction: EngineInteractionDescriptor,
    options?: {
        preemptCurrentStatusInteraction?: boolean;
        requestedInteractionId?: string;
    },
): MatchState<DiceThroneCore> {
    const bindResponseWindowInteractionId = (
        nextState: MatchState<DiceThroneCore>,
    ): MatchState<DiceThroneCore> => {
        const currentWindow = nextState.sys.responseWindow?.current;
        if (
            !options?.requestedInteractionId
            || currentWindow?.pendingInteractionId !== options.requestedInteractionId
        ) {
            return nextState;
        }
        return {
            ...nextState,
            sys: {
                ...nextState.sys,
                responseWindow: {
                    current: {
                        ...currentWindow,
                        pendingInteractionId: interaction.id,
                    },
                },
            },
        };
    };
    const current = state.sys.interaction.current;
    if (
        (
            (
                options?.preemptCurrentStatusInteraction
                && interaction.kind === 'dt:card-interaction'
            )
            || (
                interaction.kind === 'multistep-choice'
                && current?.kind === 'dt:bonus-dice'
            )
        )
        && (
            current?.kind === 'dt:bonus-dice'
            || (
                current?.kind === 'dt:card-interaction'
                && current.playerId === interaction.playerId
            )
        )
    ) {
        // 瞬时行动牌可以打断目标玩家的状态选择或当前奖励骰交互；
        // 完成新交互后恢复原交互，旧骰结果仍由当前唯一骰区承载。
        return queueInteraction(bindResponseWindowInteractionId({
            ...state,
            sys: {
                ...state.sys,
                interaction: {
                    ...state.sys.interaction,
                    current: undefined,
                    queue: [current, ...state.sys.interaction.queue],
                },
            },
        }), interaction);
    }

    if (
        current?.kind === 'dt:token-response'
        && interaction.kind !== 'dt:token-response'
    ) {
        // 伤害响应期间仍可打出会继续请求输入的牌。新交互可能属于另一位玩家，
        // 必须先接管界面，完成后再回到原令牌响应，否则新交互只会排队而双方都无法操作。
        return queueInteraction(bindResponseWindowInteractionId({
            ...state,
            sys: {
                ...state.sys,
                interaction: {
                    ...state.sys.interaction,
                    current: undefined,
                    queue: [current, ...state.sys.interaction.queue],
                },
            },
        }), interaction);
    }

    return queueInteraction(bindResponseWindowInteractionId(state), interaction);
}

function getCurrentInteractionChoiceSourceId(
    interaction: EngineInteractionDescriptor | undefined,
): string | undefined {
    if (!interaction) return undefined;
    if (interaction.kind !== 'simple-choice' && interaction.kind !== 'compare-roll-choice') {
        return undefined;
    }
    const sourceId = (interaction.data as { sourceId?: unknown } | undefined)?.sourceId;
    return typeof sourceId === 'string' ? sourceId : undefined;
}

function isResolvedPromptBackedByInteraction(
    event: GameEvent,
    resolvedEvent: ChoiceResolvedEvent,
): boolean {
    if (event.type !== INTERACTION_EVENTS.RESOLVED) return false;

    const payload = event.payload as {
        optionId?: unknown;
        sourceId?: unknown;
        interactionData?: unknown;
    };
    const sourceAbilityId = resolvedEvent.payload.sourceAbilityId;
    if (
        typeof sourceAbilityId !== 'string'
        || sourceAbilityId.length === 0
        || payload.sourceId !== sourceAbilityId
    ) {
        return false;
    }

    const data = payload.interactionData as {
        sourceId?: unknown;
        options?: Array<{
            id?: unknown;
            value?: {
                statusId?: unknown;
                tokenId?: unknown;
                value?: unknown;
                customId?: unknown;
            };
        }>;
    } | undefined;
    if (data?.sourceId !== sourceAbilityId || !Array.isArray(data.options)) {
        return false;
    }

    const option = typeof payload.optionId === 'string'
        ? data.options.find(entry => entry?.id === payload.optionId)
        : undefined;
    if (!option) return false;

    const optionValue = option.value;
    if (!optionValue || typeof optionValue !== 'object') return false;

    const resolvedPayload = resolvedEvent.payload;
    const resolvedValue = typeof resolvedPayload.value === 'number' && Number.isFinite(resolvedPayload.value)
        ? resolvedPayload.value
        : undefined;
    const optionNumericValue = typeof optionValue?.value === 'number' && Number.isFinite(optionValue.value)
        ? optionValue.value
        : undefined;

    return optionValue?.customId === resolvedPayload.customId
        && optionValue?.tokenId === resolvedPayload.tokenId
        && optionValue?.statusId === resolvedPayload.statusId
        && optionNumericValue === resolvedValue;
}

function restoreResolvedChoiceAnchorFromInteraction(
    state: MatchState<DiceThroneCore>,
    sourceAbilityId: string | undefined,
): MatchState<DiceThroneCore> {
    if (
        typeof sourceAbilityId !== 'string'
        || sourceAbilityId.length === 0
        || hasCurrentChoiceAnchor(state.core, sourceAbilityId)
    ) {
        return state;
    }

    return {
        ...state,
        core: {
            ...state.core,
            currentChoiceSourceAbilityId: sourceAbilityId,
        },
    };
}

function syncCurrentChoiceAnchorWithInteraction(
    state: MatchState<DiceThroneCore>,
): MatchState<DiceThroneCore> {
    const sourceId = getCurrentInteractionChoiceSourceId(state.sys.interaction.current as EngineInteractionDescriptor | undefined);
    if (state.core.currentChoiceSourceAbilityId === sourceId) {
        return state;
    }
    return {
        ...state,
        core: {
            ...state.core,
            currentChoiceSourceAbilityId: sourceId,
        },
    };
}

function assertTokenResponseCloseMatchesInteraction(
    interaction: EngineInteractionDescriptor | undefined,
    event: Extract<DiceThroneEvent, { type: 'TOKEN_RESPONSE_CLOSED' }>,
): void {
    const { choiceRequestId, choiceCandidateId, opportunityId, resolutionFrameId } = event.payload;
    if (
        resolutionFrameId
        && interaction?.resolutionFrameId !== resolutionFrameId
    ) {
        throw new Error(
            `TOKEN_RESPONSE_CLOSED 所属 ResolutionFrame ${resolutionFrameId} 与当前交互 ${interaction?.resolutionFrameId ?? 'none'} 不匹配`,
        );
    }
    if (!choiceRequestId) {
        const interactionPendingDamageId = resolveDiceThroneTokenResponseInteractionPendingDamageId(interaction);
        if (
            interaction?.kind !== 'dt:token-response'
            || (
                interactionPendingDamageId
                && interactionPendingDamageId !== event.payload.pendingDamageId
            )
        ) {
            throw new Error(
                `TOKEN_RESPONSE_CLOSED 待处理伤害 ${event.payload.pendingDamageId} 无法匹配当前 dt:token-response 交互`,
            );
        }
        return;
    }

    const contract = readDiceThroneTokenResponseChoiceContract(interaction);
    if (!contract) {
        throw new Error(
            `TOKEN_RESPONSE_CLOSED 来源 ChoiceRequest ${choiceRequestId} 无法匹配当前 dt:token-response 交互`,
        );
    }

    if (contract.requestId !== choiceRequestId) {
        throw new Error(
            `TOKEN_RESPONSE_CLOSED 来源 ChoiceRequest ${choiceRequestId} 与当前交互 ${contract.requestId} 不匹配`,
        );
    }

    if (
        choiceCandidateId
        && !contract.candidates.some((candidate) => candidate.id === choiceCandidateId)
    ) {
        throw new Error(
            `TOKEN_RESPONSE_CLOSED 来源候选 ${choiceCandidateId} 不属于当前 ChoiceRequest ${choiceRequestId}`,
        );
    }

    const currentOpportunityId = typeof contract.metadata?.opportunityId === 'string'
        ? contract.metadata.opportunityId
        : undefined;
    if (opportunityId && currentOpportunityId && opportunityId !== currentOpportunityId) {
        throw new Error(
            `TOKEN_RESPONSE_CLOSED 来源 Opportunity ${opportunityId} 与当前交互 ${currentOpportunityId} 不匹配`,
        );
    }
}

function tokenResponseCloseMatchesInteraction(
    interaction: EngineInteractionDescriptor | undefined,
    event: Extract<DiceThroneEvent, { type: 'TOKEN_RESPONSE_CLOSED' }>,
): boolean {
    if (!interaction || interaction.kind !== 'dt:token-response') return false;

    const { choiceRequestId, choiceCandidateId, opportunityId, resolutionFrameId } = event.payload;
    if (resolutionFrameId && interaction.resolutionFrameId !== resolutionFrameId) {
        return false;
    }
    if (!choiceRequestId) {
        const pendingDamageId = resolveDiceThroneTokenResponseInteractionPendingDamageId(interaction);
        return pendingDamageId === event.payload.pendingDamageId;
    }

    const contract = readDiceThroneTokenResponseChoiceContract(interaction);
    if (!contract || contract.requestId !== choiceRequestId) return false;
    if (
        choiceCandidateId
        && !contract.candidates.some((candidate) => candidate.id === choiceCandidateId)
    ) {
        return false;
    }

    const currentOpportunityId = typeof contract.metadata?.opportunityId === 'string'
        ? contract.metadata.opportunityId
        : undefined;
    return !(opportunityId && currentOpportunityId && opportunityId !== currentOpportunityId);
}

function closeTokenResponseInteraction(
    state: MatchState<DiceThroneCore>,
    event: Extract<DiceThroneEvent, { type: 'TOKEN_RESPONSE_CLOSED' }>,
): MatchState<DiceThroneCore> {
    const current = state.sys.interaction.current as EngineInteractionDescriptor | undefined;
    const { choiceRequestId } = event.payload;

    if (current?.kind === 'dt:token-response') {
        assertTokenResponseCloseMatchesInteraction(current, event);
        const resolved = syncCurrentChoiceAnchorWithInteraction(resolveInteraction(state));
        const frameId = event.payload.resolutionFrameId ?? current.resolutionFrameId;
        return frameId
            ? completeResolutionFrame(resolved, frameId)
            : resolved;
    }

    const queueIndex = state.sys.interaction.queue.findIndex((interaction) => (
        tokenResponseCloseMatchesInteraction(interaction as EngineInteractionDescriptor, event)
    ));
    if (queueIndex === -1) {
        throw new Error(
            choiceRequestId
                ? `TOKEN_RESPONSE_CLOSED 来源 ChoiceRequest ${choiceRequestId} 无法匹配当前或队列中的 dt:token-response 交互`
                : `TOKEN_RESPONSE_CLOSED 待处理伤害 ${event.payload.pendingDamageId} 无法匹配当前或队列中的 dt:token-response 交互`,
        );
    }

    const nextQueue = state.sys.interaction.queue.filter((_, index) => index !== queueIndex);
    const queuedInteraction = state.sys.interaction.queue[queueIndex] as EngineInteractionDescriptor | undefined;
    const nextState = {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...state.sys.interaction,
                queue: nextQueue,
            },
        },
    };
    const frameId = event.payload.resolutionFrameId ?? queuedInteraction?.resolutionFrameId;
    return frameId
        ? completeResolutionFrame(nextState, frameId)
        : nextState;
}

function markCurrentAttackReadyAfterInteraction(
    state: MatchState<DiceThroneCore>,
    interactionData: DtInteractionDescriptor,
): MatchState<DiceThroneCore> {
    const sourceId = interactionData.sourceCardId;
    const pendingAttack = state.core.pendingAttack;
    const resume = interactionData.resumeAttackSettlementOnComplete;
    if (
        !resume
        || !sourceId
        || !pendingAttack
        || pendingAttack.sourceAbilityId !== sourceId
    ) {
        return state;
    }

    return {
        ...state,
        core: {
            ...state.core,
            pendingAttack: updatePendingAttackSettlementStage(pendingAttack, resume.stage) ?? pendingAttack,
        },
    };
}

const isInteractionResolutionSideEffect = (event: DiceThroneEvent): boolean => {
    const sourceCommandType = event.sourceCommandType;
    if (event.type === 'CARD_DISCARDED') {
        return sourceCommandType === 'RESOLVE_INTERACTION';
    }
    if (
        event.type === 'STATUS_REMOVED'
        || event.type === 'TOKEN_CONSUMED'
        || event.type === 'STATUS_APPLIED'
        || event.type === 'TOKEN_GRANTED'
    ) {
        return sourceCommandType === 'REMOVE_STATUS'
            || sourceCommandType === 'TRANSFER_STATUS'
            || sourceCommandType === 'GRANT_TOKENS'
            || sourceCommandType === 'RESOLVE_INTERACTION';
    }
    return false;
};

function applyEmergencySkipFallback(core: DiceThroneCore, context: EmergencySkipContext): DiceThroneCore | null {
    if (!core.pendingAttack) return null;

    if (isDefenderChoiceInteractionData(context.interactionData)) {
        return {
            ...core,
            pendingAttack: null,
            pendingBonusDiceSettlement: undefined,
        };
    }

    const customIds = extractChoiceCustomIds(context.interactionData);
    if (isOffensiveRollEndTokenChoice(customIds, context.sourceId) && core.pendingAttack.offensiveRollEndTokenResolved !== true) {
        return {
            ...core,
            pendingAttack: {
                ...core.pendingAttack,
                offensiveRollEndTokenResolved: true,
            },
        };
    }

    return null;
}

// ============================================================================
// 多步交互类型定义（骰子修改 / 骰子选择）
// ============================================================================

/** 骰子修改累积结果 */
export interface DiceModifyResult {
    /** 骰子修改映射：dieId → newValue */
    modifications: Record<number, number>;
    /** 已修改的骰子数量 */
    modCount: number;
    /** adjust 模式累计调整量 */
    totalAdjustment: number;
}

/** 骰子修改步骤 */
export type DiceModifyStep =
    | { action: 'select'; dieId: number; dieValue: number }
    | { action: 'adjust'; dieId: number; delta: number; currentValue: number }
    | { action: 'setAny'; dieId: number; newValue: number };

/** 骰子选择（重掷）累积结果 */
export interface DiceSelectResult {
    /** 选中的骰子 ID 列表 */
    selectedDiceIds: number[];
}

/** 骰子选择步骤 */
export type DiceSelectStep = { action: 'toggle'; dieId: number };

/**
 * 骰子修改 localReducer
 * 根据模式处理不同的步骤类型
 * 导出供客户端在序列化边界后重新注入（函数无法通过 JSON 传输）
 */
export function diceModifyReducer(
    current: DiceModifyResult,
    step: DiceModifyStep,
    config: DtInteractionDescriptor['dieModifyConfig'],
    maxSelectCount?: number,
): DiceModifyResult {
    const mode = config?.mode;
    const hasReachedSelectionLimit = (dieId: number): boolean => {
        if (typeof maxSelectCount !== 'number' || maxSelectCount <= 0) return false;
        const alreadyTracked = Object.prototype.hasOwnProperty.call(current.modifications, String(dieId));
        return !alreadyTracked && current.modCount >= maxSelectCount;
    };

    if (step.action === 'select') {
        // set 模式：选中骰子，记录目标值
        if (mode === 'set') {
            if (Object.prototype.hasOwnProperty.call(current.modifications, String(step.dieId))) return current;
            if (hasReachedSelectionLimit(step.dieId)) return current;
            const targetValue = config?.targetValue ?? step.dieValue;
            return {
                ...current,
                modifications: { ...current.modifications, [step.dieId]: targetValue },
                modCount: current.modCount + 1,
            };
        }
        // copy 模式：第一颗记录源值，第二颗复制源值
        if (mode === 'copy') {
            const entries = Object.entries(current.modifications);
            if (Object.prototype.hasOwnProperty.call(current.modifications, String(step.dieId))) return current;
            if (entries.length === 0) {
                if (hasReachedSelectionLimit(step.dieId)) return current;
                // 第一颗：记录源骰子（值不变）
                return {
                    ...current,
                    modifications: { [step.dieId]: step.dieValue },
                    modCount: 1,
                };
            }
            if (hasReachedSelectionLimit(step.dieId)) return current;
            // 第二颗：复制第一颗的值
            const sourceValue = Number(entries[0][1]);
            return {
                ...current,
                modifications: { ...current.modifications, [step.dieId]: sourceValue },
                modCount: current.modCount + 1,
            };
        }
        return current;
    }

    if (step.action === 'adjust') {
        // adjust 模式：累加调整量
        if (hasReachedSelectionLimit(step.dieId)) return current;
        const prevValue = current.modifications[step.dieId] ?? step.currentValue;
        const newValue = prevValue + step.delta;
        if (newValue < 1 || newValue > 6) return current;
        return {
            ...current,
            modifications: { ...current.modifications, [step.dieId]: newValue },
            modCount: Object.keys(current.modifications).includes(String(step.dieId))
                ? current.modCount
                : current.modCount + 1,
            totalAdjustment: current.totalAdjustment + step.delta,
        };
    }

    if (step.action === 'setAny') {
        // any 模式：直接设置值
        if (hasReachedSelectionLimit(step.dieId)) return current;
        if (step.newValue < 1 || step.newValue > 6) return current;
        return {
            ...current,
            modifications: { ...current.modifications, [step.dieId]: step.newValue },
            modCount: Object.keys(current.modifications).includes(String(step.dieId))
                ? current.modCount
                : current.modCount + 1,
        };
    }

    return current;
}

/**
 * 骰子修改 toCommands：将累积结果转换为 MODIFY_DIE 命令列表
 * 导出供客户端在序列化边界后重新注入
 */
export function diceModifyToCommands(
    result: DiceModifyResult,
    maxSelectCount?: number,
): Array<{ type: string; payload: unknown }> {
    const modificationEntries = Object.entries(result.modifications)
        .filter(([, newValue]) => newValue !== undefined)
        .slice(0, typeof maxSelectCount === 'number' && maxSelectCount > 0 ? maxSelectCount : undefined);

    return modificationEntries
        .map(([dieId, newValue]) => ({
            type: 'MODIFY_DIE',
            payload: { dieId: Number(dieId), newValue },
        }));
}

/**
 * 骰子选择 localReducer（重掷）
 * 导出供客户端在序列化边界后重新注入
 */
export function diceSelectReducer(
    current: DiceSelectResult,
    step: DiceSelectStep,
    maxSelectCount?: number,
    allowRepeatedDieSelection = false,
): DiceSelectResult {
    if (step.action === 'toggle') {
        const idx = current.selectedDiceIds.indexOf(step.dieId);
        if (idx >= 0 && !allowRepeatedDieSelection) {
            return { selectedDiceIds: current.selectedDiceIds.filter(id => id !== step.dieId) };
        }
        if (typeof maxSelectCount === 'number' && maxSelectCount > 0 && current.selectedDiceIds.length >= maxSelectCount) {
            return current;
        }
        return { selectedDiceIds: [...current.selectedDiceIds, step.dieId] };
    }
    return current;
}

/**
 * 骰子选择 toCommands：将选中骰子转换为 REROLL_DIE 命令列表
 * 导出供客户端在序列化边界后重新注入
 */
export function diceSelectToCommands(
    result: DiceSelectResult,
    maxSelectCount?: number,
): Array<{ type: string; payload: unknown }> {
    const selectedDiceIds = result.selectedDiceIds
        .slice(0, typeof maxSelectCount === 'number' && maxSelectCount > 0 ? maxSelectCount : undefined);

    return selectedDiceIds.map(dieId => ({
        type: 'REROLL_DIE',
        payload: { dieId },
    }));
}

// ============================================================================
// DiceThrone 事件处理系统
// ============================================================================

/**
 * 创建 DiceThrone 事件处理系统
 * 负责将领域事件转换为系统状态更新（如 Prompt）
 */
export function createDiceThroneEventSystem(): EngineSystem<DiceThroneCore> {
    return {
        id: 'dicethrone-events',
        name: 'DiceThrone 事件处理',
        priority: 22, // 在 InteractionSystem(20) 之后、FlowSystem(25) 之前，确保 interaction 状态对 autoContinue 可见

        afterEvents: ({ state, events, random }): HookResult<DiceThroneCore> | void => {
            let newState = state;
            const nextEvents: GameEvent[] = [];
            // 防止同一批事件中多个 STATUS_REMOVED 重复 resolve
            let statusInteractionCompleted = false;
            const cardPlayPlayers = new Set(
                events
                    .filter((event): event is Extract<DiceThroneEvent, { type: 'CARD_PLAYED' }> => event.type === 'CARD_PLAYED')
                    .map(event => event.payload.playerId),
            );

            for (const event of events) {
                const dtEvent = event as DiceThroneEvent;

                if (shouldCarryForwardAfterRollResponseWindowSequence(newState, dtEvent)) {
                    newState = carryForwardAfterRollResponseWindowSequence(newState);
                }
                
                // 处理 CHOICE_REQUESTED 事件 -> 创建 Prompt
                if (dtEvent.type === 'CHOICE_REQUESTED') {
                    const payload = (dtEvent as ChoiceRequestedEvent).payload;

                    // compare-roll-choice：只有真实分支选择才进入主舞台交互；无选项结果直接结算，避免伪确认弹层。
                    if (payload.compareRoll?.contestants?.length === 2) {
                        const compareOptions: PromptOption<{
                            statusId?: string;
                            tokenId?: string;
                            value: number;
                            customId?: string;
                            labelKey?: string;
                            labelParams?: Record<string, string | number>;
                            disabled?: boolean;
                        }>[] = payload.options.map((opt, index) => {
                            const label = opt.labelKey
                                ?? (opt.tokenId ? `tokens.${opt.tokenId}.name`
                                    : opt.statusId ? `statusEffects.${opt.statusId}.name`
                                        : `choices.option-${index}`);
                            return {
                                id: `option-${index}`,
                                label,
                                value: opt,
                                disabled: opt.disabled,
                                labelKey: opt.labelKey,
                                labelParams: opt.labelParams,
                            };
                        });

                        if (compareOptions.length === 0) {
                            const eventTimestamp = typeof dtEvent.timestamp === 'number' ? dtEvent.timestamp : 0;
                            const resolvedEvent = buildAutoResolvedCompareRollEvent(
                                payload,
                                payload.compareRoll.confirmValue ?? { value: 0 },
                                eventTimestamp + 1,
                            );
                            nextEvents.push(resolvedEvent);
                            pushChoiceResolvedFollowups(nextEvents, newState, resolvedEvent, random);
                            continue;
                        }

                        const compareRollInteraction = createCompareRollChoice(
                            buildChoiceInteractionId(newState, 'compare-roll', payload.sourceAbilityId, payload.playerId),
                            payload.playerId,
                            {
                                title: payload.titleKey,
                                sourceId: payload.sourceAbilityId,
                                contestants: [
                                    payload.compareRoll.contestants[0],
                                    payload.compareRoll.contestants[1],
                                ],
                                resultText: payload.compareRoll.resultText,
                                resultTextKey: payload.compareRoll.resultTextKey,
                                resultTextParams: payload.compareRoll.resultTextParams,
                                resultTone: payload.compareRoll.resultTone,
                                options: compareOptions.length > 0 ? compareOptions : undefined,
                                confirmValue: payload.compareRoll.confirmValue,
                                autoConfirmDelayMs: payload.compareRoll.autoConfirmDelayMs,
                            },
                        );

                        newState = syncCurrentChoiceAnchorWithInteraction(queueInteraction(newState, compareRollInteraction));
                        continue;
                    }

                    const choiceInteractionId = buildChoiceInteractionId(
                        newState,
                        'choice',
                        payload.sourceAbilityId,
                        payload.playerId,
                    );
                    const candidates: ChoiceRequestCandidate<DiceThroneChoiceOptionValue>[] = payload.options.map((opt, index) => {
                        const label = opt.labelKey
                            ?? (opt.tokenId ? `tokens.${opt.tokenId}.name`
                                : opt.statusId ? `statusEffects.${opt.statusId}.name`
                                    : `choices.option-${index}`);
                        return {
                            id: `option-${index}`,
                            label,
                            value: opt,
                            disabled: opt.disabled,
                            labelKey: opt.labelKey,
                            labelParams: opt.labelParams,
                        };
                    });

                    const request: ChoiceRequest<DiceThroneChoiceOptionValue> = {
                        requestId: choiceInteractionId,
                        gameId: 'dicethrone',
                        playerId: payload.playerId,
                        kind: payload.slider ? 'modify-value' : 'choose-option',
                        sourceId: payload.sourceAbilityId,
                        candidates,
                        selection: { min: 1, max: 1 },
                        skipPolicy: 'forbidden',
                        resolution: {
                            type: 'interaction-response',
                            interactionId: choiceInteractionId,
                        },
                        ai: {
                            status: 'shared-policy',
                            policyId: 'dicethrone-choice-options',
                        },
                    };

                    const interaction = createSimpleChoiceFromChoiceRequest(request, {
                        title: payload.titleKey,
                        titleKey: payload.titleKey,
                        allowedCommands: payload.allowedCommands,
                    });
                    // 透传 slider 配置到 interaction data
                    if (payload.slider) {
                        (interaction.data as SimpleChoiceData & { slider?: unknown }).slider = payload.slider;
                    }

                    newState = syncCurrentChoiceAnchorWithInteraction(queueInteraction(newState, interaction));
                }

                if (dtEvent.type === 'DEFENDER_SELECTION_REQUESTED') {
                    const payload = dtEvent.payload;
                    const interaction: EngineInteractionDescriptor = {
                        id: `dt-defender-choice-${payload.attackerId}-${payload.targetRollValue}-${typeof dtEvent.timestamp === 'number' ? dtEvent.timestamp : 0}`,
                        kind: 'dt:defender-choice',
                        playerId: payload.chooserPlayerId,
                        data: {
                            ...payload,
                            sourceId: payload.sourceAbilityId,
                        },
                    };
                    newState = syncCurrentChoiceAnchorWithInteraction(queueInteraction(newState, interaction));
                    continue;
                }

                if (dtEvent.type === 'DEFENDER_SELECTION_RESOLVED') {
                    const current = newState.sys.interaction.current;
                    if (current?.kind === 'dt:defender-choice') {
                        newState = syncCurrentChoiceAnchorWithInteraction(resolveInteraction(newState));
                    }
                    continue;
                }

                // ---- INTERACTION_REQUESTED → 根据类型创建不同交互 ----
                if (dtEvent.type === 'INTERACTION_REQUESTED') {
                    const payload = (dtEvent as InteractionRequestedEvent).payload;
                    const pendingInteraction = payload.interaction;
                    const currentPhase = (newState.sys.phase ?? 'main1') as TurnPhase;
                    
                    // 骰子修改类交互 → multistep-choice
                    if (pendingInteraction.type === 'modifyDie') {
                        const config = pendingInteraction.dieModifyConfig;
                        const selectCount = pendingInteraction.selectCount ?? 1;
                        const mode = config?.mode;
                        const allowedDieIds = Array.isArray(pendingInteraction.allowedDieIds) && pendingInteraction.allowedDieIds.length > 0
                            ? Array.from(new Set(pendingInteraction.allowedDieIds.filter((dieId): dieId is number => typeof dieId === 'number')))
                            : getActiveDice(newState.core, currentPhase).map(die => die.id);
                        const completedDieIds = Array.isArray(pendingInteraction.completedDieIds)
                            ? Array.from(new Set(pendingInteraction.completedDieIds.filter((dieId): dieId is number => typeof dieId === 'number')))
                            : [];

                        // DiceThrone 的改骰统一由确认按钮收口：选中/改完后仍保留骰盘，
                        // 方便玩家继续看骰面、改骰或主动确认。
                        const isManualConfirmMode = mode === 'any' || mode === 'adjust';
                        const maxSteps = undefined;
                        const minSteps = pendingInteraction.minSelectCount
                            ?? (isManualConfirmMode ? 1 : selectCount);

                        const multistepData: MultistepChoiceData<DiceModifyStep, DiceModifyResult> & {
                            allowedDieIds?: number[];
                            completedDieIds?: number[];
                        } = {
                            title: pendingInteraction.titleKey,
                            sourceId: pendingInteraction.sourceCardId,
                            maxSteps,
                            minSteps,
                            initialResult: { modifications: {}, modCount: 0, totalAdjustment: 0 },
                            localReducer: (current, step) => diceModifyReducer(current, step, config, selectCount),
                            toCommands: (result) => diceModifyToCommands(result, selectCount),
                            getCompletedSteps: (result) => result.modCount,
                            allowedDieIds,
                            completedDieIds,
                            meta: {
                                dtType: 'modifyDie',
                                dieModifyConfig: config,
                                selectCount,
                                diceOwnerId: pendingInteraction.diceOwnerId,
                                targetOpponentDice: pendingInteraction.targetOpponentDice ?? false,
                            },
                        };

                        const interaction = createMultistepChoice(
                            `dt-dice-modify-${pendingInteraction.id}`,
                            pendingInteraction.playerId,
                            multistepData,
                        );
                        newState = syncCurrentChoiceAnchorWithInteraction(queueDiceThroneInteraction(
                            newState,
                            interaction,
                            { requestedInteractionId: pendingInteraction.id },
                        ));
                        continue;
                    }

                    // 骰子选择（重掷）类交互 → multistep-choice
                    if (pendingInteraction.type === 'selectDie') {
                        const selectCount = pendingInteraction.selectCount ?? 1;
                        const allowRepeatedDieSelection = pendingInteraction.allowRepeatedDieSelection === true;
                        const isRepeatedReroll = allowRepeatedDieSelection;
                        const allowedDieIds = Array.isArray(pendingInteraction.allowedDieIds) && pendingInteraction.allowedDieIds.length > 0
                            ? Array.from(new Set(pendingInteraction.allowedDieIds.filter((dieId): dieId is number => typeof dieId === 'number')))
                            : getActiveDice(newState.core, currentPhase).map(die => die.id);
                        const completedDieIds = Array.isArray(pendingInteraction.completedDieIds)
                            ? (
                                allowRepeatedDieSelection
                                    ? pendingInteraction.completedDieIds.filter((dieId): dieId is number => typeof dieId === 'number')
                                    : Array.from(new Set(pendingInteraction.completedDieIds.filter((dieId): dieId is number => typeof dieId === 'number')))
                            )
                            : [];

                        const multistepData: MultistepChoiceData<DiceSelectStep, DiceSelectResult> & {
                            allowedDieIds?: number[];
                            completedDieIds?: number[];
                            completedSteps?: number;
                            allowRepeatedDieSelection?: boolean;
                        } = {
                            title: pendingInteraction.titleKey,
                            sourceId: pendingInteraction.sourceCardId,
                            maxSteps: isRepeatedReroll ? selectCount : undefined,
                            minSteps: pendingInteraction.minSelectCount ?? 1,
                            initialResult: { selectedDiceIds: [] },
                            localReducer: (current, step) => diceSelectReducer(current, step, selectCount, allowRepeatedDieSelection),
                            toCommands: (result) => diceSelectToCommands(result, selectCount),
                            getCompletedSteps: (result) => result.selectedDiceIds.length,
                            allowedDieIds,
                            completedDieIds,
                            completedSteps: pendingInteraction.completedSteps,
                            ...(isRepeatedReroll ? {
                                confirmationMode: 'submitBatch' as const,
                                allowRepeatedDieSelection,
                            } : {}),
                            meta: {
                                dtType: 'selectDie',
                                selectCount,
                                diceOwnerId: pendingInteraction.diceOwnerId,
                                targetOpponentDice: pendingInteraction.targetOpponentDice ?? false,
                                skipAbilityReselection: pendingInteraction.skipAbilityReselection ?? false,
                                allowRepeatedDieSelection,
                            },
                        };

                        const interaction = createMultistepChoice(
                            `dt-dice-select-${pendingInteraction.id}`,
                            pendingInteraction.playerId,
                            multistepData,
                        );
                        newState = syncCurrentChoiceAnchorWithInteraction(queueDiceThroneInteraction(
                            newState,
                            interaction,
                            { requestedInteractionId: pendingInteraction.id },
                        ));
                        continue;
                    }

                    // 状态选择类交互 → 保持 dt:card-interaction
                    const isStatusType = pendingInteraction.type === 'selectStatus'
                        || pendingInteraction.type === 'selectPlayer'
                        || pendingInteraction.type === 'selectTargetStatus'
                        || pendingInteraction.type === 'selectHandCard';

                    if (isStatusType) {
                        const targetPlayerIds = pendingInteraction.targetPlayerIds || Object.keys(newState.core.players);
                        // 只有明确要求目标有状态的交互（如"移除所有状态"）才检查并跳过
                        const needsTargetWithStatus = pendingInteraction.requiresTargetWithStatus === true
                            || pendingInteraction.type === 'selectStatus'
                            || pendingInteraction.type === 'selectTargetStatus';
                        if (needsTargetWithStatus) {
                            const hasAnyStatus = targetPlayerIds.some(pid => {
                                const player = newState.core.players[pid];
                                if (!player) return false;
                                const hasEffects = Object.entries(player.statusEffects).some(([statusId, value]) => {
                                    return value > 0 && isRemovableStatusId(newState.core, statusId);
                                });
                                const hasTokens = Object.entries(player.tokens ?? {}).some(([statusId, value]) => {
                                    return value > 0 && isRemovableStatusId(newState.core, statusId);
                                });
                                return hasEffects || hasTokens;
                            });
                            if (!hasAnyStatus) {
                                // 无可选项，自动跳过交互（直接 resolve，不生成事件）
                                newState = syncCurrentChoiceAnchorWithInteraction(resolveInteraction(newState));
                                continue;
                            }
                        }
                    }

                    // 创建 dt:card-interaction，data 直接存储 PendingInteraction
                    // 加上 sourceId 字段，让 InteractionSystem 在取消时能正确提取到 payload.sourceId
                    const interaction: EngineInteractionDescriptor = {
                        id: `dt-interaction-${pendingInteraction.id}`,
                        kind: 'dt:card-interaction',
                        playerId: pendingInteraction.playerId,
                        data: { ...pendingInteraction, sourceId: pendingInteraction.sourceCardId },
                    };
                    newState = syncCurrentChoiceAnchorWithInteraction(queueDiceThroneInteraction(
                        newState,
                        interaction,
                        {
                            preemptCurrentStatusInteraction: cardPlayPlayers.has(pendingInteraction.playerId),
                            requestedInteractionId: pendingInteraction.id,
                        },
                    ));
                }

                // ---- 状态/手牌交互自动完成：只在各自权威完成事件出现时 resolve ----
                // 注意：REMOVE_STATUS 移除所有状态时会生成多个 STATUS_REMOVED 事件，
                // 使用 statusInteractionCompleted 标记防止重复 resolve
                if (!statusInteractionCompleted && isInteractionResolutionSideEffect(dtEvent)) {
                    const current = newState.sys.interaction.current;
                    if (current?.kind === 'dt:card-interaction') {
                        const interactionData = current.data as DtInteractionDescriptor;
                        const isStatusSelectionCompleted = (
                            interactionData.type === 'selectStatus'
                            || interactionData.type === 'selectPlayer'
                            || interactionData.type === 'selectTargetStatus'
                        ) && (
                            dtEvent.type === 'STATUS_REMOVED'
                            || dtEvent.type === 'TOKEN_CONSUMED'
                            || dtEvent.type === 'STATUS_APPLIED'
                            || dtEvent.type === 'TOKEN_GRANTED'
                        );
                        const isHandCardSelectionCompleted = interactionData.type === 'selectHandCard'
                            && dtEvent.type === 'CARD_DISCARDED';
                        if (isStatusSelectionCompleted || isHandCardSelectionCompleted) {
                            statusInteractionCompleted = true;
                            const completedInteractionId = current.id;
                            const completedPlayerId = current.playerId;
                            newState = markCurrentAttackReadyAfterInteraction(newState, interactionData);
                            // 状态选择完成和骰子选择完成一样，必须通知响应窗口解除同一交互锁。
                            newState = syncCurrentChoiceAnchorWithInteraction(resolveInteraction(newState));
                            nextEvents.push({
                                type: INTERACTION_EVENTS.CONFIRMED,
                                payload: {
                                    interactionId: completedInteractionId,
                                    playerId: completedPlayerId,
                                    sourceId: interactionData.sourceCardId,
                                },
                                timestamp: dtEvent.timestamp,
                            });
                        }
                    }
                }

                // ---- INTERACTION_COMPLETED（兼容恢复）：显式 resolve ----
                if (dtEvent.type === 'INTERACTION_COMPLETED') {
                    const payload = (dtEvent as DiceThroneEvent & {
                        payload?: { interactionId?: unknown };
                    }).payload;
                    const interactionId = typeof payload?.interactionId === 'string' ? payload.interactionId : null;
                    const current = newState.sys.interaction.current;
                    if (current?.kind === 'dt:card-interaction' && (!interactionId || current.id === interactionId)) {
                        statusInteractionCompleted = true;
                        newState = syncCurrentChoiceAnchorWithInteraction(resolveInteraction(newState));
                    }
                }

                // ---- TOKEN_RESPONSE_CLOSED → resolve ----
                if (dtEvent.type === 'TOKEN_RESPONSE_CLOSED') {
                    const resolvedState = closeTokenResponseInteraction(newState, dtEvent);
                    newState = {
                        ...resolvedState,
                        sys: {
                            ...resolvedState.sys,
                            responseWindow: {
                                current: undefined,
                            },
                        },
                    };
                }

                // ---- BONUS_DICE_REROLL_REQUESTED → right-tray confirmation ----
                // 奖励骰不再打开 afterRollConfirmed 响应窗口；双方仍可通过当前骰区
                // 看到并介入骰面，骰主必须在右侧骰盘主动确认后才结算。
                if (dtEvent.type === 'BONUS_DICE_REROLL_REQUESTED') {
                    const payload = (dtEvent as BonusDiceRerollRequestedEvent).payload;
                    const interaction: EngineInteractionDescriptor = {
                        id: `dt-bonus-dice-${payload.settlement.id}`,
                        kind: 'dt:bonus-dice',
                        playerId: payload.settlement.attackerId,
                        data: null,
                    };
                    newState = syncCurrentChoiceAnchorWithInteraction(queueInteraction(newState, interaction));
                }

                if (shouldQueueBonusDiceAfterResponseWindow(newState, dtEvent)) {
                    const settlement = newState.core.pendingBonusDiceSettlement;
                    if (settlement) {
                        const interaction: EngineInteractionDescriptor = {
                            id: `dt-bonus-dice-${settlement.id}`,
                            kind: 'dt:bonus-dice',
                            playerId: settlement.attackerId,
                            data: null,
                        };
                        newState = syncCurrentChoiceAnchorWithInteraction(queueInteraction(newState, interaction));
                    }
                }

                // ---- BONUS_DICE_SETTLED → resolve ----
                // 临时骰确认后必须释放交互；后续骰盘展示由 settlement continuation 决定。
                if (dtEvent.type === 'BONUS_DICE_SETTLED') {
                    newState = syncCurrentChoiceAnchorWithInteraction(resolveInteraction(newState));
                }

                // ---- SYS_INTERACTION_CANCELLED → 生成领域 INTERACTION_CANCELLED 事件（返还卡牌） ----
                if (event.type === INTERACTION_EVENTS.CANCELLED) {
                    const payload = event.payload as {
                        interactionId: string;
                        playerId: string;
                        sourceId?: string;
                        interactionData?: unknown;
                        reason?: unknown;
                    };

                    const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
                    const shouldApplyEmergencySkip = isDefenderChoiceInteractionData(payload.interactionData)
                        || (reason !== undefined && UNSATISFIABLE_CHOICE_REASONS.has(reason));
                    if (shouldApplyEmergencySkip) {
                        const emergencyCore = applyEmergencySkipFallback(newState.core, {
                            sourceId: typeof payload.sourceId === 'string' ? payload.sourceId : undefined,
                            interactionData: payload.interactionData,
                        });
                        if (emergencyCore) {
                            newState = {
                                ...newState,
                                core: emergencyCore,
                            };
                        }
                    }

                    // InteractionSystem 已从 current.data.sourceId 提取到 payload.sourceId，
                    // 直接使用，无需再挖 interactionData（兼容 dt:card-interaction 和 multistep-choice）
                    const hasCommittedEffect = hasCommittedMultistepEffect(payload.interactionData);
                    const sourceCardId = hasCommittedEffect ? '' : (payload.sourceId ?? '');
                    let cpCost = 0;
                    if (sourceCardId) {
                        const player = newState.core.players[payload.playerId];
                        const card = player?.discard.find((card) => card.id === sourceCardId);
                        cpCost = card?.cpCost ?? 0;
                    }

                    // 始终生成领域 INTERACTION_CANCELLED 事件：
                    // 1. 有 sourceCardId 时：reducer 返还卡牌和 CP
                    // 2. 无 sourceCardId 时：仍需 interactionId 用于 ResponseWindowSystem 解锁 interactionLock
                    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
                    nextEvents.push({
                        type: 'INTERACTION_CANCELLED',
                        payload: {
                            playerId: payload.playerId,
                            sourceCardId,
                            cpCost,
                            interactionId: payload.interactionId,
                        },
                        sourceCommandType: 'SYS_INTERACTION_CANCEL',
                        timestamp: eventTimestamp,
                    } as DiceThroneEvent);
                }

                if (event.type === INTERACTION_EVENTS.EXPIRED || event.type === INTERACTION_EVENTS.FORCE_UNLOCKED) {
                    const payload = event.payload as {
                        interactionId?: string | null;
                        playerId: string;
                        sourceId?: string;
                    };

                    const sourceCardId = event.type === INTERACTION_EVENTS.EXPIRED
                        ? (payload.sourceId ?? '')
                        : '';
                    let cpCost = 0;
                    if (sourceCardId) {
                        const player = newState.core.players[payload.playerId];
                        const card = player?.discard.find((card) => card.id === sourceCardId);
                        cpCost = card?.cpCost ?? 0;
                    }

                    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
                    nextEvents.push({
                        type: 'INTERACTION_CANCELLED',
                        payload: {
                            playerId: payload.playerId,
                            sourceCardId,
                            cpCost,
                            interactionId: typeof payload.interactionId === 'string' ? payload.interactionId : undefined,
                        },
                        sourceCommandType: event.type === INTERACTION_EVENTS.EXPIRED ? 'SYS_INTERACTION_TIMEOUT' : 'SYS_FORCE_UNLOCK',
                        timestamp: eventTimestamp,
                    } as DiceThroneEvent);
                }

                // 处理 Prompt 响应 -> 生成 CHOICE_RESOLVED 领域事件
                const resolvedEvent = handlePromptResolved(event);
                if (resolvedEvent) {
                    if (isStaleOffensiveRollEndChoiceResolved(newState.core, resolvedEvent)) {
                        continue;
                    }
                    const isInteractionBackedChoice = isResolvedPromptBackedByInteraction(event, resolvedEvent);
                    if (isInteractionBackedChoice) {
                        newState = restoreResolvedChoiceAnchorFromInteraction(newState, resolvedEvent.payload.sourceAbilityId);
                    }
                    nextEvents.push(resolvedEvent);
                    const customId = resolvedEvent.payload.customId;
                    if (customId) {
                        const followupHandler = getChoiceResolvedEventHandler(customId);
                        const hasChoiceAnchor = hasCurrentChoiceAnchor(newState.core, resolvedEvent.payload.sourceAbilityId)
                            || isInteractionBackedChoice;
                        if (followupHandler && hasChoiceAnchor) {
                            nextEvents.push(...followupHandler({
                                state: newState.core,
                                playerId: resolvedEvent.payload.playerId,
                                customId,
                                sourceAbilityId: resolvedEvent.payload.sourceAbilityId,
                                value: resolvedEvent.payload.value,
                                timestamp: resolvedEvent.timestamp,
                                random,
                            }));
                        }
                    }
                }

                // ---- 被动能力触发器：ABILITY_ACTIVATED + pray 面 → 获得 CP ----
                if (dtEvent.type === 'ABILITY_ACTIVATED') {
                    const { abilityId, playerId, isDefense } = dtEvent.payload;
                    // 仅在自己的进攻阶段触发（非防御技能）
                    const phase = newState.sys.phase as TurnPhase;
                    if (!isDefense && phase === 'offensiveRoll' && playerId === newState.core.activePlayerId) {
                        const passives = getPlayerPassiveAbilities(newState.core, playerId);
                        for (const passive of passives) {
                            if (!passive.trigger || passive.trigger.on !== 'abilityActivatedWithFace') continue;
                            // 检查激活的技能是否使用了所需骰面
                            const match = findPlayerAbility(newState.core, playerId, abilityId);
                            if (!match) continue;
                            const trigger = match.variant?.trigger ?? match.ability.trigger;
                            if (!trigger) continue;
                            // 检查 trigger 中是否包含所需骰面
                            let hasFace = false;
                            if (trigger.type === 'diceSet' && trigger.faces) {
                                hasFace = (trigger.faces[passive.trigger.requiredFace] ?? 0) > 0;
                            } else if (trigger.type === 'allSymbolsPresent' && trigger.symbols) {
                                hasFace = trigger.symbols.includes(passive.trigger.requiredFace);
                            } else if (trigger.type === 'smallStraight' || trigger.type === 'largeStraight') {
                                // 顺子不声明骰面，需要检查实际骰面中是否包含所需面
                                const activeDice = getActiveDice(newState.core, phase);
                                hasFace = activeDice.some(d => d.symbol === passive.trigger!.requiredFace);
                            }
                            if (hasFace) {
                                const pendingAttack = newState.core.pendingAttack;
                                if (!pendingAttack || pendingAttack.attackerId !== playerId) continue;
                                const deferredCpGrants = [
                                    ...(pendingAttack.deferredCpGrants ?? []),
                                    {
                                        playerId,
                                        amount: passive.trigger.grantCp,
                                        sourceAbilityId: passive.id,
                                    },
                                ];
                                nextEvents.push({
                                    type: 'PENDING_ATTACK_UPDATED',
                                    payload: {
                                        attackerId: playerId,
                                        patch: { deferredCpGrants },
                                    },
                                    sourceCommandType: 'PASSIVE_TRIGGER',
                                    timestamp: typeof dtEvent.timestamp === 'number' ? dtEvent.timestamp + 1 : 1,
                                } as DiceThroneEvent);
                            }
                        }
                    }
                }
            }

            // ---- multistep-choice 自动确认（引擎层）----
            // UI 层的 useMultistepInteraction 也有此逻辑，但测试环境无 React，
            // 需要在引擎层处理：通过 data.completedSteps 追踪累计步骤数，
            // 每次有 DIE_MODIFIED/DIE_REROLLED 事件时递增，达到 maxSteps 时自动 resolve。
            // 注意：每个命令是独立的 pipeline 调用，不能靠单次 afterEvents 的事件数量判断。
            const current = newState.sys.interaction.current;
            if (current?.kind === 'multistep-choice') {
                const data = current.data as MultistepChoiceData & {
                    completedSteps?: number;
                    completedDieIds?: number[];
                    allowRepeatedDieSelection?: boolean;
                    sourceId?: unknown;
                };
                const meta = data.meta as { dtType?: string } | undefined;
                const isDiceInteraction = meta?.dtType === 'modifyDie' || meta?.dtType === 'selectDie';
                const allowRepeatedDieSelection = data.allowRepeatedDieSelection === true
                    && meta?.dtType === 'selectDie';
                const touchedDieIdsRaw = isDiceInteraction
                    ? events
                        .filter(e => e.type === 'DIE_MODIFIED' || e.type === 'DIE_REROLLED')
                        .map(e => {
                            const dieId = (e.payload as { dieId?: unknown } | undefined)?.dieId;
                            return typeof dieId === 'number' ? dieId : null;
                        })
                        .filter((dieId): dieId is number => dieId !== null)
                    : [];
                const touchedDieIds = allowRepeatedDieSelection
                    ? touchedDieIdsRaw
                    : Array.from(new Set(touchedDieIdsRaw));
                const previousCompletedDieIds = isDiceInteraction
                    ? (
                        allowRepeatedDieSelection
                            ? (data.completedDieIds ?? []).filter((dieId): dieId is number => typeof dieId === 'number')
                            : Array.from(new Set((data.completedDieIds ?? []).filter(dieId => typeof dieId === 'number')))
                    )
                    : [];
                const completedDieIds = isDiceInteraction
                    ? (
                        allowRepeatedDieSelection
                            ? [...previousCompletedDieIds, ...touchedDieIds]
                            : Array.from(new Set([...previousCompletedDieIds, ...touchedDieIds]))
                    )
                    : previousCompletedDieIds;
                const newSteps = isDiceInteraction
                    ? (
                        allowRepeatedDieSelection
                            ? touchedDieIds.length
                            : completedDieIds.length - previousCompletedDieIds.length
                    )
                    : events.filter(e => e.type === 'DIE_MODIFIED' || e.type === 'DIE_REROLLED').length;

                if (newSteps > 0) {
                    const completedSteps = isDiceInteraction
                        ? (
                            allowRepeatedDieSelection
                                ? (typeof data.completedSteps === 'number' ? data.completedSteps : previousCompletedDieIds.length) + newSteps
                                : completedDieIds.length
                        )
                        : (data.completedSteps ?? 0) + newSteps;
                    if (data.maxSteps !== undefined && completedSteps >= data.maxSteps) {
                        // 达到最大步骤数，自动 resolve
                        newState = syncCurrentChoiceAnchorWithInteraction(resolveInteraction(newState));
                        nextEvents.push({
                            type: INTERACTION_EVENTS.CONFIRMED,
                            payload: {
                                interactionId: current.id,
                                playerId: current.playerId,
                                sourceId: typeof data.sourceId === 'string' ? data.sourceId : undefined,
                            },
                            timestamp: events[events.length - 1]?.timestamp ?? 0,
                        });
                    } else {
                        // 未达到最大步骤数，或该交互需要手动确认，但仍需记录已完成骰子防止重复消费
                        const nextData = isDiceInteraction
                            ? { ...data, completedSteps, completedDieIds }
                            : { ...data, completedSteps };
                        newState = {
                            ...newState,
                            sys: {
                                ...newState.sys,
                                interaction: {
                                    ...newState.sys.interaction,
                                    current: {
                                        ...current,
                                        data: nextData,
                                    },
                                },
                            },
                        };
                    }
                }
            }

            if (newState !== state || nextEvents.length > 0) {
                return {
                    state: newState,
                    events: nextEvents.length > 0 ? nextEvents : undefined,
                };
            }
        },
    };
}

/**
 * 处理 Prompt 响应事件，生成领域事件
 * 在 pipeline 层通过 domain.execute 处理 RESOLVE_CHOICE 命令时调用
 */
export function handlePromptResolved(
    event: GameEvent
): ChoiceResolvedEvent | null {
    if (event.type !== INTERACTION_EVENTS.RESOLVED) return null;
    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
    
    const payload = event.payload as {
        interactionId: string;
        playerId: string;
        optionId: string | null;
        value: { statusId?: string; tokenId?: string; value: number; customId?: string };
        sourceId?: string;
    };
    const resolvedValue = typeof payload.value?.value === 'number' && Number.isFinite(payload.value.value)
        ? payload.value.value
        : undefined;
    
    const resolvedEvent: ChoiceResolvedEvent = {
        type: 'CHOICE_RESOLVED',
        payload: {
            playerId: payload.playerId,
            statusId: payload.value.statusId,
            tokenId: payload.value.tokenId,
            value: resolvedValue,
            customId: payload.value.customId,
            sourceAbilityId: payload.sourceId,
        },
        sourceCommandType: 'RESOLVE_CHOICE',
        timestamp: eventTimestamp,
    };

    if (!isResolvedPromptBackedByInteraction(event, resolvedEvent)) {
        return resolvedEvent;
    }

    return {
        ...resolvedEvent,
        payload: {
            ...resolvedEvent.payload,
            interactionBacked: true,
        },
    };
}
