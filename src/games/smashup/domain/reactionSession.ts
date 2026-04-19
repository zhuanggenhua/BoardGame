import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getCardDef, getBaseDef } from '../data/cards';
import { getScoringEligibleBaseIndices } from './ongoingModifiers';
import { validate } from './commands';
import { execute } from './reducer';
import { reduce } from './reduce';
import { getTriggerExecutor } from './triggerExecutors';
import type {
    SmashUpCore,
    SmashUpEvent,
    SmashUpReactionPhase,
    SmashUpReactionSession,
    TriggerConsumedEvent,
    TriggerInstance,
} from './types';
import { SU_COMMANDS, SU_EVENTS, getCurrentPlayerId } from './types';

type ReactionSysState = MatchState<SmashUpCore>['sys'] & {
    smashupReactionSession?: SmashUpReactionSession;
    smashupReactionStack?: SmashUpReactionSession[];
};

type ReactionChoiceValue =
    | { kind: 'trigger'; triggerId: string }
    | { kind: 'play_action'; playerId: PlayerId; cardUid: string; targetBaseIndex?: number }
    | { kind: 'play_minion'; playerId: PlayerId; cardUid: string; baseIndex: number }
    | { kind: 'activate_special'; playerId: PlayerId; baseIndex: number; minionUid?: string; titanUid?: string }
    | { kind: 'pass' };

interface ReactionOption {
    id: string;
    label: string;
    value: ReactionChoiceValue;
    displayMode: 'button';
}

type ReactionPostProcessor = (
    state: SmashUpCore,
    events: SmashUpEvent[],
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    options?: { skipImmediateStartTurnMinionTriggers?: boolean },
) => { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> };

let reactionPostProcessor: ReactionPostProcessor | undefined;

function getClockwiseOrder(turnOrder: PlayerId[], startingPlayerId: PlayerId): PlayerId[] {
    const idx = turnOrder.indexOf(startingPlayerId);
    if (idx < 0) return [...turnOrder];
    return [...turnOrder.slice(idx), ...turnOrder.slice(0, idx)];
}

function getReactionSysState(state: MatchState<SmashUpCore>): ReactionSysState {
    return state.sys as ReactionSysState;
}

function buildMirroredResponseWindow(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession | undefined,
) {
    if (!session?.responseWindowType) {
        return undefined;
    }

    const responderQueue = getClockwiseOrder(state.core.turnOrder ?? [], session.currentPlayerId);
    const currentResponderIndex = Math.max(0, responderQueue.indexOf(session.activePlayerId));

    return {
        id: `smashup_reaction_window_${session.frameId}`,
        windowType: session.responseWindowType,
        sourceId: 'smashup_reaction_choose',
        responderQueue,
        currentResponderIndex,
        passedPlayers: [],
    };
}

export function registerSmashUpReactionPostProcessor(postProcessor: ReactionPostProcessor): void {
    reactionPostProcessor = postProcessor;
}

export function getSmashUpReactionSession(state: MatchState<SmashUpCore>): SmashUpReactionSession | undefined {
    return getReactionSysState(state).smashupReactionSession;
}

export function setSmashUpReactionSession(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession | undefined,
): MatchState<SmashUpCore> {
    const sys = getReactionSysState(state);
    const mirroredResponseWindow = buildMirroredResponseWindow(state, session);
    const previousCurrentWindow = state.sys.responseWindow?.current;
    const nextCurrentWindow = mirroredResponseWindow
        ?? (previousCurrentWindow?.sourceId === 'smashup_reaction_choose' ? undefined : previousCurrentWindow);

    return {
        ...state,
        sys: {
            ...sys,
            smashupReactionSession: session,
            responseWindow: {
                ...(state.sys.responseWindow ?? {}),
                current: nextCurrentWindow,
            },
        } as typeof state.sys,
    };
}

function getSuspendedReactionStack(state: MatchState<SmashUpCore>): SmashUpReactionSession[] {
    return [...(getReactionSysState(state).smashupReactionStack ?? [])];
}

function setSuspendedReactionStack(
    state: MatchState<SmashUpCore>,
    stack: SmashUpReactionSession[],
): MatchState<SmashUpCore> {
    const sys = getReactionSysState(state);
    return {
        ...state,
        sys: {
            ...sys,
            smashupReactionStack: stack.length > 0 ? stack : undefined,
        } as typeof state.sys,
    };
}

export function startSmashUpReactionSession(
    state: MatchState<SmashUpCore>,
    session: Omit<SmashUpReactionSession, 'phase' | 'activePlayerId' | 'consecutivePasses' | 'currentPlayerId'> & {
        currentPlayerId?: PlayerId;
        phase?: SmashUpReactionPhase;
        activePlayerId?: PlayerId;
        consecutivePasses?: number;
    },
): MatchState<SmashUpCore> {
    const currentPlayerId = session.currentPlayerId ?? getCurrentPlayerId(state.core);
    return setSmashUpReactionSession(state, {
        frameId: session.frameId,
        frameKind: session.frameKind,
        phase: session.phase ?? 'mandatory',
        activePlayerId: session.activePlayerId ?? currentPlayerId,
        currentPlayerId,
        consecutivePasses: session.consecutivePasses ?? 0,
        sourceBaseIndex: session.sourceBaseIndex,
        responseWindowType: session.responseWindowType,
    });
}

function clearSmashUpReactionSession(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    return setSmashUpReactionSession(state, undefined);
}

function suspendSmashUpReactionSession(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
): MatchState<SmashUpCore> {
    const stack = getSuspendedReactionStack(state);
    stack.push(session);
    return setSuspendedReactionStack(state, stack);
}

function popSuspendedSmashUpReactionSession(
    state: MatchState<SmashUpCore>,
): { state: MatchState<SmashUpCore>; session?: SmashUpReactionSession } {
    const stack = getSuspendedReactionStack(state);
    const session = stack.pop();
    return {
        state: setSuspendedReactionStack(state, stack),
        session,
    };
}

function buildTriggerLabel(trigger: TriggerInstance): string {
    const source = getCardDef(trigger.sourceDefId) ?? getBaseDef(trigger.sourceDefId);
    return source?.name ?? trigger.sourceDefId;
}

function getSessionFrameTriggers(state: MatchState<SmashUpCore>, frameId: string): TriggerInstance[] {
    return (state.core.triggerQueue ?? []).filter(trigger => (trigger.frameId ?? trigger.id) === frameId);
}

function getTriggerResolutionClass(trigger: TriggerInstance): 'mandatory' | 'optional' {
    return trigger.resolutionClass ?? (trigger.mandatory ? 'mandatory' : 'optional');
}

function getMandatoryFrameTriggers(state: MatchState<SmashUpCore>, frameId: string): TriggerInstance[] {
    return getSessionFrameTriggers(state, frameId).filter(
        trigger => getTriggerResolutionClass(trigger) === 'mandatory',
    );
}

function getOptionalFrameTriggers(
    state: MatchState<SmashUpCore>,
    frameId: string,
    playerId: PlayerId,
): TriggerInstance[] {
    return getSessionFrameTriggers(state, frameId).filter(
        trigger => getTriggerResolutionClass(trigger) === 'optional' && trigger.ownerPlayerId === playerId,
    );
}

function nextClockwisePlayer(core: SmashUpCore, playerId: PlayerId): PlayerId {
    const order = getClockwiseOrder(core.turnOrder ?? [], playerId);
    return order.length > 1 ? order[1] : playerId;
}

function buildProbeState(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    playerId: PlayerId,
    now: number,
): MatchState<SmashUpCore> {
    const playerIndex = state.core.turnOrder.indexOf(playerId);
    const responseWindowCurrent = session.responseWindowType
        ? {
            id: `smashup_reaction_probe_${session.frameId}_${playerId}_${now}`,
            windowType: session.responseWindowType,
            sourceId: 'smashup_reaction_choose',
            responderQueue: [playerId],
            currentResponderIndex: 0,
            passedPlayers: [],
        }
        : undefined;

    return {
        ...state,
        core: {
            ...state.core,
            currentPlayerIndex: playerIndex >= 0 ? playerIndex : state.core.currentPlayerIndex,
        },
        sys: {
            ...state.sys,
            responseWindow: {
                ...(state.sys.responseWindow ?? {}),
                current: responseWindowCurrent,
            },
        } as typeof state.sys,
    };
}

function buildPlayableCardOptions(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    playerId: PlayerId,
    now: number,
): ReactionOption[] {
    if (!session.responseWindowType) return [];
    const player = state.core.players[playerId];
    if (!player) return [];

    const eligibleBaseIndices = getScoringEligibleBaseIndices(state.core);
    const probeState = buildProbeState(state, session, playerId, now);
    const options: ReactionOption[] = [];

    for (const card of player.hand) {
        for (const targetBaseIndex of eligibleBaseIndices) {
            const minionValidation = validate(probeState, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId,
                payload: {
                    cardUid: card.uid,
                    baseIndex: targetBaseIndex,
                },
                timestamp: now,
            } as any);
            if (minionValidation.valid) {
                const def = getCardDef(card.defId);
                options.push({
                    id: `play_minion:${card.uid}:${targetBaseIndex}`,
                    label: `${def?.name ?? card.defId} -> 基地 ${targetBaseIndex + 1}`,
                    value: {
                        kind: 'play_minion',
                        playerId,
                        cardUid: card.uid,
                        baseIndex: targetBaseIndex,
                    },
                    displayMode: 'button',
                });
            }

            const actionValidation = validate(probeState, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId,
                payload: {
                    cardUid: card.uid,
                    targetBaseIndex,
                },
                timestamp: now,
            } as any);
            if (actionValidation.valid) {
                const def = getCardDef(card.defId);
                options.push({
                    id: `play_action:${card.uid}:${targetBaseIndex}`,
                    label: `${def?.name ?? card.defId} -> 基地 ${targetBaseIndex + 1}`,
                    value: {
                        kind: 'play_action',
                        playerId,
                        cardUid: card.uid,
                        targetBaseIndex,
                    },
                    displayMode: 'button',
                });
            }
        }

        const actionValidationWithoutBase = validate(probeState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: {
                cardUid: card.uid,
            },
            timestamp: now,
        } as any);
        if (actionValidationWithoutBase.valid) {
            const def = getCardDef(card.defId);
            options.push({
                id: `play_action:${card.uid}:none`,
                label: def?.name ?? card.defId,
                value: {
                    kind: 'play_action',
                    playerId,
                    cardUid: card.uid,
                },
                displayMode: 'button',
            });
        }
    }

    for (const baseIndex of eligibleBaseIndices) {
        const base = state.core.bases[baseIndex];
        if (!base) continue;
        for (const minion of base.minions) {
            const validation = validate(probeState, {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId,
                payload: {
                    minionUid: minion.uid,
                    baseIndex,
                },
                timestamp: now,
            } as any);
            if (!validation.valid) continue;
            const def = getCardDef(minion.defId);
            options.push({
                id: `activate_special:minion:${minion.uid}:${baseIndex}`,
                label: `${def?.name ?? minion.defId} 特殊能力`,
                value: {
                    kind: 'activate_special',
                    playerId,
                    minionUid: minion.uid,
                    baseIndex,
                },
                displayMode: 'button',
            });
        }

        for (const titan of state.core.titans ?? []) {
            const validation = validate(probeState, {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId,
                payload: {
                    titanUid: titan.uid,
                    baseIndex,
                },
                timestamp: now,
            } as any);
            if (!validation.valid) continue;
            const def = getCardDef(titan.defId);
            options.push({
                id: `activate_special:titan:${titan.uid}:${baseIndex}`,
                label: `${def?.name ?? titan.defId} 特殊能力`,
                value: {
                    kind: 'activate_special',
                    playerId,
                    titanUid: titan.uid,
                    baseIndex,
                },
                displayMode: 'button',
            });
        }
    }

    return options;
}

function buildReactionOptions(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    now: number,
): ReactionOption[] {
    if (session.phase === 'mandatory') {
        return getMandatoryFrameTriggers(state, session.frameId).map(trigger => ({
            id: `trigger:${trigger.id}`,
            label: buildTriggerLabel(trigger),
            value: { kind: 'trigger', triggerId: trigger.id },
            displayMode: 'button',
        }));
    }

    const triggerOptions = getOptionalFrameTriggers(state, session.frameId, session.activePlayerId).map(trigger => ({
        id: `trigger:${trigger.id}`,
        label: buildTriggerLabel(trigger),
        value: { kind: 'trigger', triggerId: trigger.id },
        displayMode: 'button' as const,
    }));

    const cardOptions = buildPlayableCardOptions(state, session, session.activePlayerId, now);
    return [
        ...triggerOptions,
        ...cardOptions,
        {
            id: 'pass',
            label: 'Pass',
            value: { kind: 'pass' },
            displayMode: 'button',
        },
    ];
}

function executeQueuedTrigger(
    state: MatchState<SmashUpCore>,
    trigger: TriggerInstance,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const consumed: TriggerConsumedEvent = {
        type: SU_EVENTS.TRIGGER_CONSUMED,
        payload: { triggerId: trigger.id },
        timestamp: now,
    };
    const coreAfterConsume = reduce(state.core, consumed as unknown as SmashUpEvent);
    const exec = getTriggerExecutor(trigger.timing, trigger.sourceDefId);
    const baseState = { ...state, core: coreAfterConsume };
    if (!exec) {
        return { state: baseState, events: [consumed] };
    }

    const result = exec({
        state: coreAfterConsume,
        matchState: baseState,
        timing: trigger.timing,
        frameId: trigger.frameId,
        sourceEventId: trigger.sourceEventId,
        sourceCardUid: trigger.sourceCardUid,
        sourceBaseIndex: trigger.sourceBaseIndex,
        sourceControllerId: trigger.sourceControllerId,
        triggerBaseControllersAtTrigger: trigger.triggerBaseControllersAtTrigger,
        playerId: trigger.ownerPlayerId,
        baseIndex: trigger.baseIndex,
        moveFromBaseIndex: trigger.moveFromBaseIndex,
        moveToBaseIndex: trigger.moveToBaseIndex,
        rankings: trigger.rankings,
        triggerMinionUid: trigger.triggerMinionUid,
        triggerMinionDefId: trigger.triggerMinionDefId,
        triggerMinionPower: trigger.triggerMinionPower,
        destroyerId: trigger.destroyerId,
        triggerMinion: trigger.lkiMinion
            ? {
                uid: trigger.lkiMinion.uid,
                defId: trigger.lkiMinion.defId,
                owner: trigger.lkiMinion.owner,
                controller: trigger.lkiMinion.controller,
                basePower: trigger.lkiMinion.basePower,
                powerCounters: trigger.lkiMinion.powerCounters,
                powerModifier: trigger.lkiMinion.powerModifier,
                tempPowerModifier: trigger.lkiMinion.tempPowerModifier,
                talentUsed: false,
                attachedActions: [],
                metadata: trigger.lkiMinion.metadata ? { ...trigger.lkiMinion.metadata } : undefined,
            }
            : undefined,
        reason: trigger.reason,
        affectType: trigger.affectType,
        actionTargetBaseIndex: trigger.actionTargetBaseIndex,
        actionTargetType: trigger.actionTargetType,
        actionTargetMinionUid: trigger.actionTargetMinionUid,
        buriedCardUid: trigger.buriedCardUid,
        buriedCardDefId: trigger.buriedCardDefId,
        buriedCardControllerId: trigger.buriedCardControllerId,
        buriedFrom: trigger.buriedFrom,
        inspectionCards: trigger.inspectionCards,
        inspectionZone: trigger.inspectionZone,
        inspectionTargetPlayerIds: trigger.inspectionTargetPlayerIds,
        inspectionCausePlayerId: trigger.inspectionCausePlayerId,
        random,
        now,
    } as any);

    const triggerEvents = Array.isArray(result) ? result : result.events;
    const nextState = !Array.isArray(result) && result.matchState ? result.matchState : baseState;
    const postProcessed = applyReactionPostProcessing(nextState, triggerEvents, random);
    return {
        state: postProcessed.state,
        events: [consumed, ...postProcessed.events],
    };
}

function applyReactionPostProcessing(
    state: MatchState<SmashUpCore>,
    rawEvents: SmashUpEvent[],
    random: RandomFn,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const postProcessed = reactionPostProcessor
        ? reactionPostProcessor(
            state.core,
            rawEvents,
            random,
            state,
        )
        : {
            events: rawEvents,
            matchState: state,
        };

    const processedEvents = postProcessed.events;
    let reducedCore = state.core;
    for (const event of processedEvents) {
        reducedCore = reduce(reducedCore, event);
    }

    const nextState = postProcessed.matchState ?? state;
    return {
        state: {
            ...nextState,
            core: reducedCore,
        },
        events: processedEvents,
    };
}

function executeReactionCommand(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    value: Extract<ReactionChoiceValue, { kind: 'play_action' | 'play_minion' | 'activate_special' }>,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const originalResponseWindow = state.sys.responseWindow;
    const originalCurrentPlayerIndex = state.core.currentPlayerIndex;
    const probeState = buildProbeState(state, session, value.playerId, now);

    const command = value.kind === 'play_action'
        ? {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: value.playerId,
            payload: {
                cardUid: value.cardUid,
                ...(value.targetBaseIndex !== undefined ? { targetBaseIndex: value.targetBaseIndex } : {}),
            },
            timestamp: now,
        }
        : value.kind === 'play_minion'
            ? {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: value.playerId,
                payload: {
                    cardUid: value.cardUid,
                    baseIndex: value.baseIndex,
                },
                timestamp: now,
            }
            : {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: value.playerId,
                payload: {
                    ...(value.minionUid ? { minionUid: value.minionUid } : {}),
                    ...(value.titanUid ? { titanUid: value.titanUid } : {}),
                    baseIndex: value.baseIndex,
                },
                timestamp: now,
            };

    const validation = validate(probeState, command as any);
    if (!validation.valid) {
        return { state, events: [] };
    }

    const executionState: MatchState<SmashUpCore> = {
        ...probeState,
        sys: {
            ...probeState.sys,
        } as typeof probeState.sys,
    };
    const rawEvents = execute(executionState, command as any, random);
    const postProcessed = applyReactionPostProcessing(executionState, rawEvents, random);
    const cleanedState = postProcessed.state;

    return {
        state: {
            ...cleanedState,
            core: {
                ...cleanedState.core,
                currentPlayerIndex: originalCurrentPlayerIndex,
            },
            sys: {
                ...cleanedState.sys,
                responseWindow: originalResponseWindow,
            } as typeof cleanedState.sys,
        },
        events: postProcessed.events,
    };
}

function buildReactionInteraction(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    now: number,
) {
    const initialOptions = buildReactionOptions(state, session, now);
    const interaction = createSimpleChoice(
        `smashup_reaction_${session.frameId}_${session.activePlayerId}_${now}`,
        session.activePlayerId,
        session.phase === 'mandatory' ? '选择先结算的强制效果' : '选择一个反应动作',
        initialOptions,
        {
            sourceId: 'smashup_reaction_choose',
            targetType: 'button',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );
    const interactionData = interaction.data as typeof interaction.data & {
        optionsGenerator?: (latestState: MatchState<SmashUpCore>) => ReactionOption[];
    };
    interactionData.optionsGenerator = (latestState: MatchState<SmashUpCore>) => {
        const nextSession = getSmashUpReactionSession(latestState) ?? session;
        return buildReactionOptions(latestState, nextSession, now);
    };
    return interaction;
}

function continueSuspendedReactionIfNeeded(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    if (getSmashUpReactionSession(state)) return undefined;
    const { state: poppedState, session } = popSuspendedSmashUpReactionSession(state);
    if (!session) return undefined;
    const resumedState = setSmashUpReactionSession(poppedState, session);
    return advanceSmashUpReactionSession(resumedState, random, now);
}

function autoAdvanceOptionalWithoutChoices(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    now: number,
): MatchState<SmashUpCore> {
    let currentState = state;
    let currentSession = session;
    const playerCount = currentState.core.turnOrder.length;

    while (true) {
        const options = buildReactionOptions(currentState, currentSession, now);
        const nonPassOptions = options.filter(option => option.id !== 'pass');
        if (nonPassOptions.length > 0) {
            return setSmashUpReactionSession(currentState, currentSession);
        }

        const nextPassCount = currentSession.consecutivePasses + 1;
        if (nextPassCount >= playerCount) {
            return clearSmashUpReactionSession(currentState);
        }

        currentSession = {
            ...currentSession,
            activePlayerId: nextClockwisePlayer(currentState.core, currentSession.activePlayerId),
            consecutivePasses: nextPassCount,
        };
        currentState = setSmashUpReactionSession(currentState, currentSession);
    }
}

function createSessionFromPendingFrame(
    state: MatchState<SmashUpCore>,
): MatchState<SmashUpCore> {
    const pending = state.core.triggerQueue ?? [];
    if (pending.length === 0) return state;
    const first = pending[0];
    const frameId = first.frameId ?? first.id;
    const frameTriggers = getSessionFrameTriggers(state, frameId);
    if (frameTriggers.length === 0) return state;
    const currentPlayerId = getCurrentPlayerId(state.core);
    const phase: SmashUpReactionPhase = frameTriggers.some(
        trigger => getTriggerResolutionClass(trigger) === 'mandatory',
    )
        ? 'mandatory'
        : 'optional';
    return startSmashUpReactionSession(state, {
        frameId,
        frameKind: 'generic',
        currentPlayerId,
        activePlayerId: currentPlayerId,
        phase,
        sourceBaseIndex: first.baseIndex ?? first.sourceBaseIndex,
    });
}

export function advanceSmashUpReactionSession(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    if (state.sys.interaction?.current) return undefined;

    let currentState = state;
    let session = getSmashUpReactionSession(currentState);

    if (!session) {
        const resumed = continueSuspendedReactionIfNeeded(currentState, random, now);
        if (resumed) return resumed;

        currentState = createSessionFromPendingFrame(currentState);
        session = getSmashUpReactionSession(currentState);
        if (!session) return undefined;
    }

    if (session.phase === 'mandatory') {
        const mandatoryTriggers = getMandatoryFrameTriggers(currentState, session.frameId);
        if (mandatoryTriggers.length === 0) {
            currentState = setSmashUpReactionSession(currentState, {
                ...session,
                phase: 'optional',
                activePlayerId: session.currentPlayerId,
                consecutivePasses: 0,
            });
            session = getSmashUpReactionSession(currentState)!;
        }
    }

    if (session.phase === 'optional') {
        currentState = autoAdvanceOptionalWithoutChoices(currentState, session, now);
        session = getSmashUpReactionSession(currentState);
        if (!session) {
            const resumed = continueSuspendedReactionIfNeeded(currentState, random, now);
            if (resumed) return resumed;

            // 若刚结束的 session 属于“空 frame”（例如 resumed session 的 frameId 已无匹配 trigger），
            // 但队列里还有其他 frame 的 pending triggers，则在同一次调用里直接启动下一帧。
            const restarted = createSessionFromPendingFrame(currentState);
            const restartedSession = getSmashUpReactionSession(restarted);
            if (!restartedSession) {
                return { state: currentState, events: [] };
            }
            currentState = restarted;
            session = restartedSession;
        }
    }

    session = getSmashUpReactionSession(currentState);
    if (!session) return undefined;

    const options = buildReactionOptions(currentState, session, now);
    const nonPassOptions = options.filter(option => option.id !== 'pass');
    if (session.phase === 'mandatory' && nonPassOptions.length === 1) {
        return resolveSmashUpReactionChoice(currentState, random, now, nonPassOptions[0].value);
    }

    const interaction = buildReactionInteraction(currentState, session, now);
    return {
        state: queueInteraction(currentState, interaction),
        events: [],
    };
}

export function resolveSmashUpReactionChoice(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
    value: ReactionChoiceValue,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const session = getSmashUpReactionSession(state);
    if (!session) return { state, events: [] };

    if (value.kind === 'pass') {
        const nextPassCount = session.consecutivePasses + 1;
        if (nextPassCount >= state.core.turnOrder.length) {
            const clearedState = clearSmashUpReactionSession(state);
            const resumed = continueSuspendedReactionIfNeeded(clearedState, random, now);
            return resumed ?? { state: clearedState, events: [] };
        }
        const advancedState = setSmashUpReactionSession(state, {
            ...session,
            activePlayerId: nextClockwisePlayer(state.core, session.activePlayerId),
            consecutivePasses: nextPassCount,
        });
        const continued = advanceSmashUpReactionSession(advancedState, random, now);
        return continued ?? { state: advancedState, events: [] };
    }

    const resumedSession: SmashUpReactionSession = session.phase === 'mandatory'
        ? session
        : {
            ...session,
            activePlayerId: nextClockwisePlayer(state.core, session.activePlayerId),
            consecutivePasses: 0,
        };

    let workingState = clearSmashUpReactionSession(state);
    workingState = suspendSmashUpReactionSession(workingState, resumedSession);

    let result: { state: MatchState<SmashUpCore>; events: SmashUpEvent[] };
    if (value.kind === 'trigger') {
        const trigger = (workingState.core.triggerQueue ?? []).find(candidate => candidate.id === value.triggerId);
        if (!trigger) {
            return { state, events: [] };
        }
        result = executeQueuedTrigger(workingState, trigger, random, now);
    } else {
        result = executeReactionCommand(workingState, session, value, random, now);
    }

    if (result.state.sys.interaction?.current) {
        return result;
    }

    const continued = advanceSmashUpReactionSession(result.state, random, now);
    return continued
        ? { state: continued.state, events: [...result.events, ...continued.events] }
        : result;
}
