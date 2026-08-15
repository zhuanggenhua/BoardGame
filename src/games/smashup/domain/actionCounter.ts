import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { resolveOnPlay, resolveSpecial } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import { buildActionPlayedEvent } from './actionPlayEvent';
import { buildSemanticOngoingAttachEvents } from './abilityHelpers';
import { getBaseDef, getCardDef } from '../data/cards';
import { getSmashUpReactionWindowContext } from './reactionWindowState';
import type {
    ActionCardDef,
    FusionCardDef,
    MatchPhase,
    MinionCardDef,
    MinionPlayedEvent,
    SmashUpCore,
    SmashUpEvent,
} from './types';
import { getCurrentPlayerId, SU_EVENTS } from './types';
import { getActionLikeResponseWindowTiming } from './utils';

const ACTION_COUNTER_CHOOSE_SOURCE_ID = 'smashup_action_counter_choose';
const ACTION_COUNTER_WIL_BASE_SOURCE_ID = 'smashup_action_counter_wil_base';
const ACTION_COUNTER_CONTINUE_SOURCE_ID = 'smashup_action_counter_continue';

type ActionCounterCardType = 'action' | 'minion';

type RegisteredActionCounter = {
    defId: string;
    cardType: ActionCounterCardType;
};

type PendingActionResolutionKind = 'normal' | 'counter_target_action';

export type PendingActionResolution = {
    actionInstanceId: string;
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    targetBaseIndex?: number;
    targetMinionUid?: string;
    fromDiscard?: boolean;
    fromStored?: boolean;
    nextResponderOffset: number;
    resolutionKind: PendingActionResolutionKind;
    cancelTargetActionInstanceId?: string;
    cancelTargetCardUid?: string;
    cancelTargetDefId?: string;
    cancelTargetOwnerId?: PlayerId;
    afterResolutionEvents?: SmashUpEvent[];
};

type ActionCounterStackContext = {
    stack: PendingActionResolution[];
};

type ActionCounterChoiceValue = {
    pass?: boolean;
    cardUid?: string;
    defId?: string;
    cardType?: ActionCounterCardType;
};

type ActionCounterWilBaseChoice = {
    baseIndex?: number;
};

const registeredActionCounters = new Map<string, RegisteredActionCounter>();

export function registerActionCounter(defId: string, config: { cardType: ActionCounterCardType }): void {
    registeredActionCounters.set(defId, { defId, cardType: config.cardType });
}

function getRegisteredActionCounter(defId: string): RegisteredActionCounter | undefined {
    return registeredActionCounters.get(defId);
}

export function buildPendingActionInstanceId(cardUid: string, playerId: PlayerId, now: number): string {
    return `${cardUid}:${playerId}:${now}`;
}

export function createPendingActionResolution(params: {
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    targetBaseIndex?: number;
    targetMinionUid?: string;
    fromDiscard?: boolean;
    fromStored?: boolean;
    now: number;
    resolutionKind?: PendingActionResolutionKind;
    cancelTarget?: PendingActionResolution;
    afterResolutionEvents?: SmashUpEvent[];
}): PendingActionResolution {
    return {
        actionInstanceId: buildPendingActionInstanceId(params.cardUid, params.playerId, params.now),
        playerId: params.playerId,
        cardUid: params.cardUid,
        defId: params.defId,
        ownerId: params.ownerId,
        ...(params.targetBaseIndex !== undefined ? { targetBaseIndex: params.targetBaseIndex } : {}),
        ...(params.targetMinionUid ? { targetMinionUid: params.targetMinionUid } : {}),
        ...(params.fromDiscard ? { fromDiscard: true } : {}),
        ...(params.fromStored ? { fromStored: true } : {}),
        nextResponderOffset: 0,
        resolutionKind: params.resolutionKind ?? 'normal',
        ...(params.cancelTarget
            ? {
                cancelTargetActionInstanceId: params.cancelTarget.actionInstanceId,
                cancelTargetCardUid: params.cancelTarget.cardUid,
                cancelTargetDefId: params.cancelTarget.defId,
                cancelTargetOwnerId: params.cancelTarget.ownerId,
            }
            : {}),
        ...(params.afterResolutionEvents?.length
            ? { afterResolutionEvents: params.afterResolutionEvents }
            : {}),
    };
}

type ActionCounterPromptPlan = {
    responderId: PlayerId;
    nextOffset: number;
    options: Array<{
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        cardType: ActionCounterCardType;
        label: string;
    }>;
};

function getActionCounterResponderOrder(core: SmashUpCore): PlayerId[] {
    const currentPlayerId = getCurrentPlayerId(core);
    const startIndex = core.turnOrder.indexOf(currentPlayerId);
    if (startIndex < 0) {
        return core.turnOrder.filter((playerId) => !!core.players[playerId]);
    }
    return core.turnOrder
        .map((_pid, offset) => core.turnOrder[(startIndex + offset) % core.turnOrder.length])
        .filter((playerId) => !!core.players[playerId]);
}

function buildActionCounterPlan(
    core: SmashUpCore,
    pending: PendingActionResolution,
): ActionCounterPromptPlan | null {
    const responderOrder = getActionCounterResponderOrder(core);
    for (let offset = pending.nextResponderOffset; offset < responderOrder.length; offset += 1) {
        const responderId = responderOrder[offset];
        if (responderId === pending.playerId) continue;
        const hand = core.players[responderId]?.hand ?? [];
        const options = hand.flatMap((card) => {
            const registered = getRegisteredActionCounter(card.defId);
            if (!registered) return [];
            const cardName = getCardDef(card.defId)?.name ?? card.defId;
            return [{
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                cardType: registered.cardType,
                label: cardName,
            }];
        });
        if (options.length === 0) continue;
        return {
            responderId,
            nextOffset: offset + 1,
            options,
        };
    }
    return null;
}

function getActionCounterStackContext(interactionData: Record<string, unknown> | undefined): ActionCounterStackContext | undefined {
    return interactionData?.continuationContext as ActionCounterStackContext | undefined;
}

function getTopPendingAction(stack: PendingActionResolution[]): PendingActionResolution | undefined {
    return stack[stack.length - 1];
}

function cloneStack(stack: PendingActionResolution[]): PendingActionResolution[] {
    return stack.map((entry) => ({ ...entry }));
}

function advanceTopPendingAction(
    core: SmashUpCore,
    stack: PendingActionResolution[],
): PendingActionResolution[] {
    const top = getTopPendingAction(stack);
    if (!top) return cloneStack(stack);
    const promptPlan = buildActionCounterPlan(core, top);
    if (!promptPlan) return cloneStack(stack);
    const nextStack = cloneStack(stack);
    nextStack[nextStack.length - 1] = {
        ...nextStack[nextStack.length - 1],
        nextResponderOffset: promptPlan.nextOffset,
    };
    return nextStack;
}

function queueActionCounterPrompt(
    state: MatchState<SmashUpCore>,
    stack: PendingActionResolution[],
    now: number,
): MatchState<SmashUpCore> {
    const top = getTopPendingAction(stack);
    if (!top) return state;
    const promptPlan = buildActionCounterPlan(state.core, top);
    if (!promptPlan) return state;

    const actionName = getCardDef(top.defId)?.name ?? top.defId;
    const interaction = createSimpleChoice<ActionCounterChoiceValue>(
        `smashup_action_counter_${top.actionInstanceId}_${promptPlan.responderId}_${now}`,
        promptPlan.responderId,
        `${actionName} 即将生效：你可以响应并使其无效`,
        [
            ...promptPlan.options.map((option, index) => ({
                id: `counter-${index}`,
                label: option.label,
                value: {
                    cardUid: option.cardUid,
                    defId: option.defId,
                    cardType: option.cardType,
                },
                displayMode: 'card' as const,
            })),
            {
                id: 'pass',
                label: '让过',
                labelKey: 'ui.me_first_pass',
                value: { pass: true },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: ACTION_COUNTER_CHOOSE_SOURCE_ID,
            targetType: 'generic',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    interaction.data.continuationContext = { stack };
    interaction.data.optionsGenerator = (latestState) => {
        const latestContext = getActionCounterStackContext(interaction.data);
        const latestTop = latestContext ? getTopPendingAction(latestContext.stack) : undefined;
        if (!latestTop) {
            return [{
                id: 'pass',
                label: '让过',
                labelKey: 'ui.me_first_pass',
                value: { pass: true },
                displayMode: 'button' as const,
            }];
        }
        const latestPlan = buildActionCounterPlan(latestState.core as SmashUpCore, latestTop);
        if (!latestPlan || latestPlan.responderId !== promptPlan.responderId) {
            return [{
                id: 'pass',
                label: '让过',
                labelKey: 'ui.me_first_pass',
                value: { pass: true },
                displayMode: 'button' as const,
            }];
        }
        return [
            ...latestPlan.options.map((option, index) => ({
                id: `counter-${index}`,
                label: option.label,
                value: {
                    cardUid: option.cardUid,
                    defId: option.defId,
                    cardType: option.cardType,
                },
                displayMode: 'card' as const,
            })),
            {
                id: 'pass',
                label: '让过',
                labelKey: 'ui.me_first_pass',
                value: { pass: true },
                displayMode: 'button' as const,
            },
        ];
    };
    return queueInteraction(state, interaction);
}

function queueActionCounterContinuePrompt(
    state: MatchState<SmashUpCore>,
    stack: PendingActionResolution[],
    now: number,
): MatchState<SmashUpCore> {
    const interaction = createSimpleChoice<{ continue?: boolean }>(
        `smashup_action_counter_continue_${now}_${stack.length}`,
        getCurrentPlayerId(state.core),
        '继续结算行动响应链',
        [{
            id: 'continue',
            label: '继续',
            labelKey: 'ui.continue',
            value: { continue: true },
            displayMode: 'button',
        }],
        {
            sourceId: ACTION_COUNTER_CONTINUE_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: true,
            titleKey: 'ui.action_counter_continue_title',
        },
    );
    interaction.data.continuationContext = { stack };
    return queueInteraction(state, interaction);
}

function queueWilBasePrompt(
    state: MatchState<SmashUpCore>,
    stack: PendingActionResolution[],
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    now: number,
): MatchState<SmashUpCore> {
    const options = state.core.bases.map((base, baseIndex) => ({
        id: `base-${baseIndex}`,
        label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        value: { baseIndex },
        displayMode: 'button' as const,
    }));
    const interaction = createSimpleChoice<ActionCounterWilBaseChoice>(
        `smashup_action_counter_wil_base_${cardUid}_${now}`,
        playerId,
        '维尔：选择要打出的基地',
        options,
        {
            sourceId: ACTION_COUNTER_WIL_BASE_SOURCE_ID,
            targetType: 'base',
            autoResolveIfSingle: false,
            displayCard: { defId, cardUid },
            titleKey: 'ui.action_counter_wil_base_title',
        },
    );
    interaction.data.continuationContext = {
        stack,
        playerId,
        cardUid,
        defId,
        ownerId,
    };
    interaction.data.optionsGenerator = (latestState) => latestState.core.bases.map((base, baseIndex) => ({
        id: `base-${baseIndex}`,
        label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        value: { baseIndex },
        displayMode: 'button' as const,
    }));
    return queueInteraction(state, interaction);
}

function buildActionCounteredEvent(
    pending: PendingActionResolution,
    counteredByPlayerId: PlayerId,
    counteredByDefId: string,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.ACTION_COUNTERED,
        payload: {
            playerId: pending.playerId,
            cardUid: pending.cardUid,
            defId: pending.defId,
            ownerId: pending.ownerId,
            counteredByPlayerId,
            counteredByDefId,
            reason: 'action_counter',
        },
        timestamp: now,
    } as SmashUpEvent;
}

function trimResolvedCounterStack(
    stack: PendingActionResolution[],
    resolvedActionInstanceId: string,
    canceledActionInstanceId?: string,
): PendingActionResolution[] {
    const trimmed = stack.filter((entry) => (
        entry.actionInstanceId !== resolvedActionInstanceId
        && entry.actionInstanceId !== canceledActionInstanceId
    ));
    if (trimmed.length > 0) {
        trimmed[trimmed.length - 1] = {
            ...trimmed[trimmed.length - 1],
            nextResponderOffset: 0,
        };
    }
    return trimmed;
}

export function maybeQueueActionCounterWindow(
    state: MatchState<SmashUpCore>,
    pending: PendingActionResolution,
    now: number,
): MatchState<SmashUpCore> | undefined {
    const plan = buildActionCounterPlan(state.core, pending);
    if (!plan) return undefined;
    return queueActionCounterPrompt(state, [pending], now);
}

export function resolvePendingActionExecution(
    state: MatchState<SmashUpCore>,
    pending: PendingActionResolution,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const def = getCardDef(pending.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!def) return { state, events: [] };

    const events: SmashUpEvent[] = [];
    let updatedState = state;
    const targetBaseIndex = pending.targetBaseIndex ?? 0;
    const reactionWindow = getSmashUpReactionWindowContext(state);
    const appendAfterResolutionEvents = () => {
        if (pending.afterResolutionEvents?.length) {
            events.push(...pending.afterResolutionEvents);
        }
    };

    const runActionExecutor = (
        executor: ReturnType<typeof resolveOnPlay> | ReturnType<typeof resolveSpecial>,
        baseIndex: number,
    ) => {
        if (!executor) return;
        const ctx: AbilityContext = {
            state: updatedState.core,
            matchState: updatedState,
            playerId: pending.playerId,
            cardUid: pending.cardUid,
            defId: pending.defId,
            baseIndex,
            targetBaseIndex: pending.targetBaseIndex,
            targetMinionUid: pending.targetMinionUid,
            fromDiscard: pending.fromDiscard === true,
            random,
            now,
        };
        const result = executor(ctx);
        events.push(...result.events);
        if (result.matchState) {
            updatedState = result.matchState;
        }
    };

    const subtype = def.type === 'fusion' ? def.actionSubtype : def.subtype;
    if (subtype === 'ongoing') {
        events.push(...buildSemanticOngoingAttachEvents(updatedState, {
            cardUid: pending.cardUid,
            defId: pending.defId,
            ownerId: pending.ownerId,
            sourcePlayerId: pending.playerId,
            sourceKind: 'action',
            targetBaseIndex,
            targetMinionUid: pending.targetMinionUid,
            onBlockedSourceDestination: 'discard',
            now,
        }));
        runActionExecutor(resolveOnPlay(pending.defId), targetBaseIndex);
        appendAfterResolutionEvents();
        return { state: updatedState, events };
    }

    if (subtype === 'special') {
        const specialTiming = getActionLikeResponseWindowTiming(def);
        if (!specialTiming) {
            return { state: updatedState, events };
        }
        if (
            reactionWindow
            && (
                (reactionWindow.windowType === 'meFirst' && specialTiming === 'beforeScoring')
                || (reactionWindow.windowType === 'afterScoring' && specialTiming === 'afterScoring')
            )
        ) {
            const limitGroup = def.type === 'fusion'
                ? def.actionSpecialLimitGroup
                : def.specialLimitGroup;
            if (limitGroup) {
                events.push({
                    type: SU_EVENTS.SPECIAL_LIMIT_USED,
                    payload: {
                        playerId: pending.playerId,
                        baseIndex: targetBaseIndex,
                        limitGroup,
                        abilityDefId: pending.defId,
                    },
                    timestamp: now,
                } as SmashUpEvent);
            }
        }
        if (specialTiming === 'beforeScoring') {
            runActionExecutor(resolveSpecial(pending.defId) ?? resolveOnPlay(pending.defId), targetBaseIndex);
        } else if (specialTiming === 'afterScoring') {
            if (reactionWindow?.windowType === 'afterScoring') {
                runActionExecutor(resolveSpecial(pending.defId) ?? resolveOnPlay(pending.defId), targetBaseIndex);
            } else {
                events.push({
                    type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
                    payload: {
                        sourceDefId: pending.defId,
                        playerId: pending.playerId,
                        baseIndex: targetBaseIndex,
                        cardUid: pending.cardUid,
                    },
                    timestamp: now,
                } as SmashUpEvent);
            }
        }
        appendAfterResolutionEvents();
        return { state: updatedState, events };
    }

    runActionExecutor(resolveOnPlay(pending.defId), targetBaseIndex);
    appendAfterResolutionEvents();
    return { state: updatedState, events };
}

function resolveCounterStackWithLatestState(
    state: MatchState<SmashUpCore>,
    stack: PendingActionResolution[],
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const top = getTopPendingAction(stack);
    if (!top) {
        return { state, events: [] };
    }
    const plan = buildActionCounterPlan(state.core, top);
    if (plan) {
        return {
            state: queueActionCounterPrompt(state, stack, now),
            events: [],
        };
    }

    if (top.resolutionKind === 'counter_target_action') {
        const counterEvent = buildActionCounteredEvent(
            {
                actionInstanceId: top.cancelTargetActionInstanceId ?? '',
                playerId: top.playerId,
                cardUid: top.cancelTargetCardUid ?? '',
                defId: top.cancelTargetDefId ?? '',
                ownerId: top.cancelTargetOwnerId ?? top.ownerId,
                nextResponderOffset: 0,
                resolutionKind: 'normal',
            },
            top.playerId,
            top.defId,
            now,
        );
        const remainingStack = trimResolvedCounterStack(
            stack,
            top.actionInstanceId,
            top.cancelTargetActionInstanceId,
        );
        return {
            state: remainingStack.length > 0
                ? queueActionCounterContinuePrompt(state, remainingStack, now)
                : state,
            events: [counterEvent],
        };
    }

    return resolvePendingActionExecution(state, top, random, now);
}

function buildWilPlayedEvent(
    playerId: PlayerId,
    ownerId: PlayerId,
    cardUid: string,
    defId: string,
    baseIndex: number,
    core: SmashUpCore,
    now: number,
): SmashUpEvent {
    const def = getCardDef(defId) as MinionCardDef | undefined;
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid,
            defId,
            ownerId,
            baseIndex,
            baseDefId: core.bases[baseIndex]?.defId,
            power: def?.power ?? 0,
            consumesNormalLimit: false,
        },
        timestamp: now,
    } as MinionPlayedEvent;
}

export function registerActionCounterInteractionHandlers(): void {
    registerInteractionHandler(ACTION_COUNTER_CHOOSE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const context = getActionCounterStackContext(interactionData);
        const top = context ? getTopPendingAction(context.stack) : undefined;
        if (!context || !top) {
            return { state, events: [] };
        }
        const advancedStack = advanceTopPendingAction(state.core, context.stack);
        const selected = value as ActionCounterChoiceValue | undefined;
        if (selected?.pass) {
            const result = resolveCounterStackWithLatestState(state, advancedStack, _random, timestamp);
            return result;
        }

        if (!selected?.cardUid || !selected.defId || !selected.cardType) {
            return { state, events: [] };
        }

        if (selected.cardType === 'minion') {
            return {
                state: queueWilBasePrompt(
                    state,
                    advancedStack,
                    playerId,
                    selected.cardUid,
                    selected.defId,
                    state.core.players[playerId]?.hand.find((card) => card.uid === selected.cardUid)?.owner ?? playerId,
                    timestamp,
                ),
                events: [],
            };
        }

        const ownerId = state.core.players[playerId]?.hand.find((card) => card.uid === selected.cardUid)?.owner ?? playerId;
        const childPending = createPendingActionResolution({
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            ownerId,
            now: timestamp,
            resolutionKind: 'counter_target_action',
            cancelTarget: top,
        });
        return {
            state: queueActionCounterContinuePrompt(state, [...advancedStack, childPending], timestamp),
            events: [buildActionPlayedEvent({
                playerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId,
                isExtraAction: true,
                timestamp,
            })],
        };
    });

    registerInteractionHandler(ACTION_COUNTER_WIL_BASE_SOURCE_ID, (state, _playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData?.continuationContext as ({
            stack: PendingActionResolution[];
            playerId: PlayerId;
            cardUid: string;
            defId: string;
            ownerId: PlayerId;
        } | undefined);
        const top = data ? getTopPendingAction(data.stack) : undefined;
        const selected = value as ActionCounterWilBaseChoice | undefined;
        if (!data || !top || typeof selected?.baseIndex !== 'number') {
            return { state, events: [] };
        }

        const events: SmashUpEvent[] = [
            buildWilPlayedEvent(
                data.playerId,
                data.ownerId,
                data.cardUid,
                data.defId,
                selected.baseIndex,
                state.core,
                timestamp,
            ),
            buildActionCounteredEvent(top, data.playerId, data.defId, timestamp),
        ];
        const remainingStack = trimResolvedCounterStack(data.stack, top.actionInstanceId);
        return {
            state: remainingStack.length > 0
                ? queueActionCounterContinuePrompt(state, remainingStack, timestamp)
                : state,
            events,
        };
    });

    registerInteractionHandler(ACTION_COUNTER_CONTINUE_SOURCE_ID, (state, _playerId, _value, interactionData, random, timestamp) => {
        const context = getActionCounterStackContext(interactionData);
        if (!context || context.stack.length === 0) {
            return { state, events: [] };
        }
        return resolveCounterStackWithLatestState(state, context.stack, random, timestamp);
    });
}
