import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { queueInteraction, resolveInteraction } from '../../../engine/systems/InteractionSystem';
import {
    completeResolutionFrame,
    getActiveResolutionFrame,
    getResolutionFrameById,
    pushResolutionFrame,
    upsertResolutionFrame,
} from '../../../engine/systems/resolutionStack';
import { getCardDef, getBaseDef } from '../data/cards';
import { validate, getManualSpecialScoringBaseIndices } from './commands';
import { execute } from './reducer';
import { reduce } from './reduce';
import { createAbilityRuntimeSimpleChoice, registerAbilityRuntimePrompt } from './abilityRuntime';
import { executeTriggerProgramExecutor } from './triggerExecutors';
import { partitionMandatoryReactionOrderingComponents } from './reactionOrdering';
import {
    getDeferredReplacementBaseDefIdFromBaseDeckReorderEvents,
    replaceDeferredPostScoringReplacementBase,
} from './scoringSession';
import type {
    ActionCardDef,
    FusionCardDef,
    SmashUpCore,
    SmashUpEvent,
    SmashUpReactionPhase,
    SmashUpReactionSession,
    TriggerConsumedEvent,
    TriggerInstance,
} from './types';
import { SU_COMMANDS, SU_EVENTS, getCurrentPlayerId } from './types';
import { getActionPlayTargetMode } from './playLegality';

export type ReactionChoiceValue =
    | { kind: 'trigger'; triggerId: string }
    | { kind: 'play_action'; playerId: PlayerId; cardUid: string; targetBaseIndex?: number; targetMinionUid?: string }
    | { kind: 'play_minion'; playerId: PlayerId; cardUid: string; baseIndex: number }
    | { kind: 'activate_special'; playerId: PlayerId; baseIndex: number; minionUid?: string; titanUid?: string }
    | { kind: 'pass' };

interface ReactionOption {
    id: string;
    label: string;
    labelKey?: string;
    labelParams?: Record<string, string | number>;
    value: ReactionChoiceValue;
    displayMode: 'button';
}

export interface ResolvedSmashUpReactionChoice {
    session: SmashUpReactionSession;
    options: ReactionOption[];
    value: ReactionChoiceValue;
    wasStale: boolean;
}

type ReactionPostProcessor = (
    state: SmashUpCore,
    events: SmashUpEvent[],
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    options?: {
        skipImmediateStartTurnMinionTriggers?: boolean;
        recordImmediateStartTurnProcessedMinionUids?: boolean;
    },
) => { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> };

let reactionPostProcessor: ReactionPostProcessor | undefined;
const queuedTriggerRuntimeSharedState = new Map<string, Record<string, unknown>>();

function getQueuedTriggerRuntimeSharedState(frameId: string | undefined, triggerId: string): Record<string, unknown> {
    const key = frameId ?? triggerId;
    const existing = queuedTriggerRuntimeSharedState.get(key);
    if (existing) {
        return existing;
    }
    const created: Record<string, unknown> = {};
    queuedTriggerRuntimeSharedState.set(key, created);
    return created;
}

function clearQueuedTriggerRuntimeSharedState(frameId: string | undefined, triggerId: string): void {
    queuedTriggerRuntimeSharedState.delete(frameId ?? triggerId);
}

function getClockwiseOrder(turnOrder: PlayerId[], startingPlayerId: PlayerId): PlayerId[] {
    const idx = turnOrder.indexOf(startingPlayerId);
    if (idx < 0) return [...turnOrder];
    return [...turnOrder.slice(idx), ...turnOrder.slice(0, idx)];
}

function getValidReactionPlayerId(
    turnOrder: PlayerId[],
    preferredPlayerId: PlayerId | undefined,
    fallbackPlayerId: PlayerId | undefined,
): PlayerId | undefined {
    if (preferredPlayerId && turnOrder.includes(preferredPlayerId)) return preferredPlayerId;
    if (fallbackPlayerId && turnOrder.includes(fallbackPlayerId)) return fallbackPlayerId;
    return turnOrder[0];
}

function normalizeReactionSessionPlayers(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
): SmashUpReactionSession {
    const turnOrder = state.core.turnOrder ?? [];
    if (turnOrder.length === 0) return session;

    const currentPlayerId = getValidReactionPlayerId(
        turnOrder,
        session.currentPlayerId,
        getCurrentPlayerId(state.core),
    );
    const activePlayerId = getValidReactionPlayerId(
        turnOrder,
        session.activePlayerId,
        currentPlayerId,
    );

    if (currentPlayerId === session.currentPlayerId && activePlayerId === session.activePlayerId) {
        return session;
    }

    return {
        ...session,
        currentPlayerId: currentPlayerId ?? session.currentPlayerId,
        activePlayerId: activePlayerId ?? session.activePlayerId,
    };
}

function getReactionSessionFromFrameId(
    state: MatchState<SmashUpCore>,
    frameId?: string,
): SmashUpReactionSession | undefined {
    const frame = frameId ? getResolutionFrameById(state, frameId) : getActiveResolutionFrame(state);
    const session = frame?.metadata?.smashupReactionSession as SmashUpReactionSession | undefined;
    if (!session) {
        return undefined;
    }
    return {
        ...session,
        phase: (frame?.step as SmashUpReactionPhase | undefined) ?? session.phase,
    };
}

function getReactionSessionFromFrame(state: MatchState<SmashUpCore>): SmashUpReactionSession | undefined {
    const responseWindowFrameId = state.sys.responseWindow?.current?.resolutionFrameId;
    const activeFrameId = getActiveResolutionFrame(state)?.id;
    return getReactionSessionFromFrameId(state, responseWindowFrameId)
        ?? getReactionSessionFromFrameId(state, activeFrameId)
        ?? [...(state.sys.resolution?.frames ?? [])]
            .reverse()
            .map((frame) => getReactionSessionFromFrameId(state, frame.id))
            .find((session): session is SmashUpReactionSession => !!session);
}

function buildReactionResolutionFrame(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
) {
    const existingFrame = getResolutionFrameById(state, session.frameId);
    return {
        ...(existingFrame ?? {}),
        id: session.frameId,
        kind: `smashup:reaction:${session.frameKind}`,
        ownerGame: 'smashup',
        ownerSystem: 'smashup-reaction',
        ownerToken: `smashup:reaction:${session.frameId}`,
        ordering: session.phase === 'optional' ? 'responder-round' as const : 'nested-body' as const,
        status: existingFrame?.status === 'suspended' ? 'suspended' as const : 'running' as const,
        step: session.phase,
        phase: state.sys.phase,
        phaseGate: 'block-advance-when-blocked' as const,
        blockedBy: existingFrame?.blockedBy,
        suspendedByFrameId: existingFrame?.suspendedByFrameId,
        deferredEvents: existingFrame?.deferredEvents,
        deferredActions: existingFrame?.deferredActions,
        metadata: {
            ...(existingFrame?.metadata ?? {}),
            smashupReactionSession: session,
        },
    };
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
        resolutionFrameId: session.frameId,
        responderQueue,
        currentResponderIndex,
        passedPlayers: responderQueue.filter(playerId => session.passedPlayerIds?.includes(playerId)),
    };
}

export function registerSmashUpReactionPostProcessor(postProcessor: ReactionPostProcessor): void {
    reactionPostProcessor = postProcessor;
}

export function getSmashUpReactionSession(state: MatchState<SmashUpCore>): SmashUpReactionSession | undefined {
    return getReactionSessionFromFrame(state);
}

export function setSmashUpReactionSession(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession | undefined,
): MatchState<SmashUpCore> {
    let nextState = state;
    if (session) {
        const normalizedSession = normalizeReactionSessionPlayers(state, session);
        const existingFrame = getResolutionFrameById(state, normalizedSession.frameId);
        const activeFrame = getActiveResolutionFrame(state);
        const frame = buildReactionResolutionFrame(state, normalizedSession);
        nextState = !existingFrame && activeFrame && activeFrame.id !== normalizedSession.frameId
            ? pushResolutionFrame(state, frame)
            : upsertResolutionFrame(state, frame, { setActive: true });
    }

    const mirroredResponseWindow = buildMirroredResponseWindow(nextState, session);
    const previousCurrentWindow = nextState.sys.responseWindow?.current;
    const nextCurrentWindow = mirroredResponseWindow
        ?? (previousCurrentWindow?.sourceId === 'smashup_reaction_choose' ? undefined : previousCurrentWindow);

    return {
        ...nextState,
        sys: {
            ...nextState.sys,
            responseWindow: {
                ...(nextState.sys.responseWindow ?? {}),
                current: nextCurrentWindow,
            },
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
        passedPlayerIds: session.passedPlayerIds ?? [],
        sourceBaseIndex: session.sourceBaseIndex,
        responseWindowType: session.responseWindowType,
    });
}

function clearSmashUpReactionSession(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    return setSmashUpReactionSession(state, undefined);
}

function buildReactionSourceNameLabel(defId: string): string {
    const source = getCardDef(defId) ?? getBaseDef(defId);
    return source ? `cards.${defId}.name` : defId;
}

function isActionLikeCardDef(def: unknown): def is ActionCardDef | FusionCardDef {
    return !!def
        && typeof def === 'object'
        && (((def as { type?: string }).type === 'action') || ((def as { type?: string }).type === 'fusion'));
}

function buildTriggerLabel(trigger: TriggerInstance): string {
    const source = getCardDef(trigger.sourceDefId) ?? getBaseDef(trigger.sourceDefId);
    return source ? buildReactionSourceNameLabel(trigger.sourceDefId) : trigger.sourceDefId;
}

function isTriggerSourceStillPresentDuringScoring(
    state: MatchState<SmashUpCore>,
    trigger: TriggerInstance,
): boolean {
    if (trigger.timing !== 'beforeScoring' && trigger.timing !== 'whenScoring' && trigger.timing !== 'afterScoring') {
        return true;
    }
    if (
        trigger.timing === 'afterScoring'
        && (trigger.sourceDefId === 'pirate_first_mate' || trigger.sourceDefId === 'pirate_first_mate_pod')
    ) {
        return true;
    }
    if (!trigger.sourceCardUid) {
        return true;
    }

    for (const special of state.core.pendingAfterScoringSpecials ?? []) {
        if (special.cardUid === trigger.sourceCardUid) {
            return true;
        }
    }

    for (const base of state.core.bases) {
        if (base.ongoingActions.some(action => action.uid === trigger.sourceCardUid)) {
            return true;
        }
        if (base.minions.some(minion => minion.uid === trigger.sourceCardUid)) {
            return true;
        }
        if (base.minions.some(minion => minion.attachedActions?.some(action => action.uid === trigger.sourceCardUid))) {
            return true;
        }
    }

    return (state.core.titans ?? []).some(titan => (
        titan.uid === trigger.sourceCardUid
        && (titan.location.zone === 'base' || titan.location.zone === 'setaside')
    ));
}

function shouldKeepQueuedScoringTriggerFromSnapshot(trigger: TriggerInstance): boolean {
    return Boolean(
        trigger.lkiMinion
        || trigger.lkiBase,
    );
}

function pruneUnavailableScoringFrameTriggers(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const staleTriggers = getSessionFrameTriggers(state, session.frameId).filter(
        (trigger) => (
            !(trigger.witnessRequirement === 'inPlayAtTriggerTime' && trigger.witnessed)
            &&
            !isTriggerSourceStillPresentDuringScoring(state, trigger)
            && !shouldKeepQueuedScoringTriggerFromSnapshot(trigger)
        ),
    );
    if (staleTriggers.length === 0) {
        return { state, events: [] };
    }

    let nextCore = state.core;
    const events: SmashUpEvent[] = [];
    for (const trigger of staleTriggers) {
        const consumed: TriggerConsumedEvent = {
            type: SU_EVENTS.TRIGGER_CONSUMED,
            payload: { triggerId: trigger.id },
            timestamp: now,
        };
        events.push(consumed);
        nextCore = reduce(nextCore, consumed as unknown as SmashUpEvent);
    }

    return {
        state: {
            ...state,
            core: nextCore,
        },
        events,
    };
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

function inferSessionFrameContext(
    frameId: string,
): Pick<SmashUpReactionSession, 'frameKind' | 'responseWindowType'> {
    if (frameId.startsWith('score-before:')) {
        return {
            frameKind: 'score-before',
            responseWindowType: 'meFirst',
        };
    }
    if (frameId.startsWith('score-after:')) {
        return {
            frameKind: 'score-after',
            responseWindowType: 'afterScoring',
        };
    }
    if (frameId.startsWith('score-when:')) {
        return {
            frameKind: 'score-when',
            responseWindowType: undefined,
        };
    }
    if (frameId.startsWith('turn-start:')) {
        return {
            frameKind: 'turn-start',
            responseWindowType: undefined,
        };
    }
    if (frameId.startsWith('turn-end:')) {
        return {
            frameKind: 'turn-end',
            responseWindowType: undefined,
        };
    }
    return {
        frameKind: 'generic',
        responseWindowType: undefined,
    };
}

function getReactionSessionForTrigger(
    state: MatchState<SmashUpCore>,
    trigger: TriggerInstance,
): SmashUpReactionSession | undefined {
    const frameId = trigger.frameId ?? trigger.id;
    const existingSession = getReactionSessionFromFrameId(state, frameId);
    if (existingSession) {
        return existingSession;
    }

    const activeSession = getSmashUpReactionSession(state);
    const phase: SmashUpReactionPhase = getMandatoryFrameTriggers(state, frameId).length > 0
        ? 'mandatory'
        : 'optional';
    const inferredContext = inferSessionFrameContext(frameId);
    const currentPlayerId = activeSession?.currentPlayerId ?? getCurrentPlayerId(state.core);
    const activePlayerId = phase === 'mandatory'
        ? currentPlayerId
        : (trigger.ownerPlayerId ?? trigger.sourceControllerId ?? currentPlayerId);

    return normalizeReactionSessionPlayers(state, {
        frameId,
        frameKind: activeSession?.frameKind ?? inferredContext.frameKind,
        phase,
        activePlayerId,
        currentPlayerId,
        consecutivePasses: 0,
        sourceBaseIndex: trigger.baseIndex ?? trigger.sourceBaseIndex ?? activeSession?.sourceBaseIndex,
        responseWindowType: activeSession?.responseWindowType ?? inferredContext.responseWindowType,
    });
}

function consumeRemainingFrameTriggers(
    state: MatchState<SmashUpCore>,
    frameId: string,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const triggers = getSessionFrameTriggers(state, frameId);
    if (triggers.length === 0) {
        return { state, events: [] };
    }

    let nextCore = state.core;
    const events: SmashUpEvent[] = [];
    for (const trigger of triggers) {
        const event: TriggerConsumedEvent = {
            type: SU_EVENTS.TRIGGER_CONSUMED,
            payload: { triggerId: trigger.id },
            timestamp: now,
        };
        events.push(event);
        nextCore = reduce(nextCore, event as unknown as SmashUpEvent);
    }

    return {
        state: {
            ...state,
            core: nextCore,
        },
        events,
    };
}

function completeReactionFrameAfterPass(
    state: MatchState<SmashUpCore>,
    frameId: string,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const consumed = consumeRemainingFrameTriggers(state, frameId, now);
    return {
        state: completeResolutionFrame(clearSmashUpReactionSession(consumed.state), frameId),
        events: consumed.events,
    };
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

function getMandatoryResolutionGroup(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    random?: RandomFn,
    now?: number,
): TriggerInstance[] {
    const triggers = getMandatoryFrameTriggers(state, session.frameId);
    return partitionMandatoryReactionOrderingComponents(triggers, state, random, now)[0] ?? [];
}

function nextClockwisePlayer(core: SmashUpCore, playerId: PlayerId): PlayerId {
    const order = getClockwiseOrder(core.turnOrder ?? [], playerId);
    return order.length > 1 ? order[1] : playerId;
}

function hasExplicitlyPassed(session: SmashUpReactionSession, playerId: PlayerId): boolean {
    return session.passedPlayerIds?.includes(playerId) ?? false;
}

function markPlayerPassed(session: SmashUpReactionSession, playerId: PlayerId): SmashUpReactionSession {
    if (hasExplicitlyPassed(session, playerId)) {
        return session;
    }
    return {
        ...session,
        passedPlayerIds: [...(session.passedPlayerIds ?? []), playerId],
    };
}

function getNextUnpassedResponder(
    core: SmashUpCore,
    session: SmashUpReactionSession,
    fromPlayerId: PlayerId,
): PlayerId | undefined {
    const order = getClockwiseOrder(core.turnOrder ?? [], fromPlayerId);
    for (let index = 1; index < order.length; index += 1) {
        const candidate = order[index];
        if (!hasExplicitlyPassed(session, candidate)) {
            return candidate;
        }
    }
    return hasExplicitlyPassed(session, fromPlayerId) ? undefined : fromPlayerId;
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

function withConsumedSpecialCardUid(
    session: SmashUpReactionSession,
    cardUid: string | undefined,
): SmashUpReactionSession {
    if (!cardUid) return session;
    if (session.consumedSpecialCardUids?.includes(cardUid)) return session;
    return {
        ...session,
        consumedSpecialCardUids: [...(session.consumedSpecialCardUids ?? []), cardUid],
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

    const eligibleBaseIndices = getManualSpecialScoringBaseIndices(state);
    const probeState = buildProbeState(state, session, playerId, now);
    const options: ReactionOption[] = [];

    for (const card of player.hand) {
        for (const targetBaseIndex of eligibleBaseIndices) {
            const def = getCardDef(card.defId);
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
                options.push({
                    id: `play_minion:${card.uid}:${targetBaseIndex}`,
                    label: `${def?.name ?? card.defId} -> 基地 ${targetBaseIndex + 1}`,
                    labelKey: 'ui.reaction_choose_play_to_base',
                    labelParams: {
                        name: buildReactionSourceNameLabel(card.defId),
                        baseNumber: targetBaseIndex + 1,
                    },
                    value: {
                        kind: 'play_minion',
                        playerId,
                        cardUid: card.uid,
                        baseIndex: targetBaseIndex,
                    },
                    displayMode: 'button',
                });
            }

            if (isActionLikeCardDef(def) && getActionPlayTargetMode(def) === 'minion') {
                const targetBase = probeState.core.bases[targetBaseIndex];
                for (const targetMinion of targetBase?.minions ?? []) {
                    const actionValidation = validate(probeState, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId,
                        payload: {
                            cardUid: card.uid,
                            targetBaseIndex,
                            targetMinionUid: targetMinion.uid,
                        },
                        timestamp: now,
                    } as any);
                    if (!actionValidation.valid) continue;

                    const targetDef = getCardDef(targetMinion.defId);
                    options.push({
                        id: `play_action:${card.uid}:${targetBaseIndex}:${targetMinion.uid}`,
                        label: `${def.name ?? card.defId} -> ${targetDef?.name ?? targetMinion.defId}（基地 ${targetBaseIndex + 1}）`,
                        value: {
                            kind: 'play_action',
                            playerId,
                            cardUid: card.uid,
                            targetBaseIndex,
                            targetMinionUid: targetMinion.uid,
                        },
                        displayMode: 'button',
                    });
                }
            } else {
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
                    options.push({
                        id: `play_action:${card.uid}:${targetBaseIndex}`,
                        label: `${def?.name ?? card.defId} -> 基地 ${targetBaseIndex + 1}`,
                        labelKey: 'ui.reaction_choose_play_to_base',
                        labelParams: {
                            name: buildReactionSourceNameLabel(card.defId),
                            baseNumber: targetBaseIndex + 1,
                        },
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
            options.push({
                id: `play_action:${card.uid}:none`,
                label: buildReactionSourceNameLabel(card.defId),
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
            if (session.consumedSpecialCardUids?.includes(minion.uid)) continue;
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
                labelKey: 'ui.reaction_choose_activate_special',
                labelParams: {
                    name: buildReactionSourceNameLabel(minion.defId),
                },
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
            if (session.consumedSpecialCardUids?.includes(titan.uid)) continue;
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
                labelKey: 'ui.reaction_choose_activate_special',
                labelParams: {
                    name: buildReactionSourceNameLabel(titan.defId),
                },
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

export function buildReactionOptions(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    now: number,
    random?: RandomFn,
): ReactionOption[] {
    if (session.phase === 'mandatory') {
        return getMandatoryResolutionGroup(state, session, random, now).map(trigger => ({
            id: `trigger:${trigger.id}`,
            label: buildTriggerLabel(trigger),
            value: { kind: 'trigger', triggerId: trigger.id },
            displayMode: 'button',
        }));
    }

    // Optional phase 里若仍残留同 frame 的 mandatory trigger，必须继续暴露它们，
    // 否则 live refresh 会把这类 trigger 误判成 stale，进而被 pass 吃掉。
    const mandatoryOptions = getMandatoryFrameTriggers(state, session.frameId).map(trigger => ({
        id: `trigger:${trigger.id}`,
        label: buildTriggerLabel(trigger),
        value: { kind: 'trigger', triggerId: trigger.id },
        displayMode: 'button' as const,
    }));

    const triggerOptions = getOptionalFrameTriggers(state, session.frameId, session.activePlayerId).map(trigger => ({
        id: `trigger:${trigger.id}`,
        label: buildTriggerLabel(trigger),
        value: { kind: 'trigger', triggerId: trigger.id },
        displayMode: 'button' as const,
    }));

    const cardOptions = buildPlayableCardOptions(state, session, session.activePlayerId, now);
    return dedupeReactionOptions([
        ...mandatoryOptions,
        ...triggerOptions,
        ...cardOptions,
        {
            id: 'pass',
            label: 'Pass',
            labelKey: 'ui.me_first_pass',
            value: { kind: 'pass' },
            displayMode: 'button',
        },
    ]);
}

export function hasSmashUpResponderDrivenReactionOptions(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
    now: number,
): boolean {
    if (session.phase !== 'optional') {
        return false;
    }
    return buildPlayableCardOptions(state, session, session.activePlayerId, now).length > 0;
}

function isSameReactionChoiceValue(left: ReactionChoiceValue, right: ReactionChoiceValue): boolean {
    if (left.kind !== right.kind) return false;

    switch (left.kind) {
        case 'trigger':
            return left.triggerId === (right as Extract<ReactionChoiceValue, { kind: 'trigger' }>).triggerId;
        case 'play_action':
            return left.playerId === (right as Extract<ReactionChoiceValue, { kind: 'play_action' }>).playerId
                && left.cardUid === (right as Extract<ReactionChoiceValue, { kind: 'play_action' }>).cardUid
                && left.targetBaseIndex === (right as Extract<ReactionChoiceValue, { kind: 'play_action' }>).targetBaseIndex
                && left.targetMinionUid === (right as Extract<ReactionChoiceValue, { kind: 'play_action' }>).targetMinionUid;
        case 'play_minion':
            return left.playerId === (right as Extract<ReactionChoiceValue, { kind: 'play_minion' }>).playerId
                && left.cardUid === (right as Extract<ReactionChoiceValue, { kind: 'play_minion' }>).cardUid
                && left.baseIndex === (right as Extract<ReactionChoiceValue, { kind: 'play_minion' }>).baseIndex;
        case 'activate_special':
            return left.playerId === (right as Extract<ReactionChoiceValue, { kind: 'activate_special' }>).playerId
                && left.baseIndex === (right as Extract<ReactionChoiceValue, { kind: 'activate_special' }>).baseIndex
                && left.minionUid === (right as Extract<ReactionChoiceValue, { kind: 'activate_special' }>).minionUid
                && left.titanUid === (right as Extract<ReactionChoiceValue, { kind: 'activate_special' }>).titanUid;
        case 'pass':
            return true;
        default:
            return false;
    }
}

function dedupeReactionOptions(options: ReactionOption[]): ReactionOption[] {
    const deduped: ReactionOption[] = [];
    for (const option of options) {
        const hasDuplicate = deduped.some((existing) =>
            existing.id === option.id || isSameReactionChoiceValue(existing.value, option.value),
        );
        if (!hasDuplicate) {
            deduped.push(option);
        }
    }
    return deduped;
}

export function resolveLiveSmashUpReactionChoice(
    state: MatchState<SmashUpCore>,
    value: ReactionChoiceValue,
    now: number,
    random?: RandomFn,
): ResolvedSmashUpReactionChoice | undefined {
    let session = getSmashUpReactionSession(state);
    if (!session) return undefined;

    if (value.kind === 'trigger') {
        const trigger = (state.core.triggerQueue ?? []).find(candidate => candidate.id === value.triggerId);
        const triggerFrameId = trigger?.frameId ?? trigger?.id;
        if (trigger && triggerFrameId && triggerFrameId !== session.frameId) {
            session = getReactionSessionForTrigger(state, trigger) ?? session;
        }
    }

    const options = buildReactionOptions(state, session, now, random);
    const matchedOption = options.find(option => isSameReactionChoiceValue(option.value, value));
    if (matchedOption) {
        return {
            session,
            options,
            value: matchedOption.value,
            wasStale: false,
        };
    }

    const passOption = options.find(option => option.value.kind === 'pass');
    return {
        session,
        options,
        value: session.phase === 'optional' && passOption
            ? passOption.value
            : value,
        wasStale: true,
    };
}

function executeQueuedTrigger(
    state: MatchState<SmashUpCore>,
    trigger: TriggerInstance,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const runtimeSharedState = getQueuedTriggerRuntimeSharedState(trigger.frameId, trigger.id);
    // queued trigger 的归属/响应顺序继续看 ownerPlayerId，但 callback 里的 ctx.playerId
    // 必须恢复为原始事件玩家；来源控制者语义通过 sourceControllerId/sourceHostController 另传。
    const runtimePlayerId = trigger.eventPlayerId ?? trigger.ownerPlayerId;
    const consumed: TriggerConsumedEvent = {
        type: SU_EVENTS.TRIGGER_CONSUMED,
        payload: { triggerId: trigger.id },
        timestamp: now,
    };
    const coreAfterConsume = reduce(state.core, consumed as unknown as SmashUpEvent);
    const baseState = { ...state, core: coreAfterConsume };
    const result = executeTriggerProgramExecutor(trigger.timing, trigger.sourceDefId, {
        state: coreAfterConsume,
        matchState: baseState,
        timing: trigger.timing,
        sourceDefId: trigger.sourceDefId,
        frameId: trigger.frameId,
        sourceEventId: trigger.sourceEventId,
        sourceCardUid: trigger.sourceCardUid,
        sourceBaseIndex: trigger.sourceBaseIndex,
        sourceControllerId: trigger.sourceControllerId,
        triggerBaseControllersAtTrigger: trigger.triggerBaseControllersAtTrigger,
        playerId: runtimePlayerId,
        baseIndex: trigger.baseIndex,
        moveFromBaseIndex: trigger.moveFromBaseIndex,
        moveToBaseIndex: trigger.moveToBaseIndex,
        simultaneousMoveBatchMinionUids: trigger.simultaneousMoveBatchMinionUids
            ? [...trigger.simultaneousMoveBatchMinionUids]
            : undefined,
        duel: trigger.duel ? structuredClone(trigger.duel) : undefined,
        duelSourceId: trigger.duelSourceId,
        duelOutcome: trigger.duelOutcome,
        duelChallenger: trigger.duelChallenger ? structuredClone(trigger.duelChallenger) : undefined,
        duelChallenged: trigger.duelChallenged ? structuredClone(trigger.duelChallenged) : undefined,
        duelWinner: trigger.duelWinner ? structuredClone(trigger.duelWinner) : undefined,
        duelLoser: trigger.duelLoser ? structuredClone(trigger.duelLoser) : undefined,
        duelTie: trigger.duelTie,
        rankings: trigger.rankings ? structuredClone(trigger.rankings) : undefined,
        triggerMinionUid: trigger.triggerMinionUid,
        triggerMinionDefId: trigger.triggerMinionDefId,
        triggerMinionPower: trigger.triggerMinionPower,
        destroyedMonsterUid: trigger.destroyedMonsterUid,
        destroyedMonsterDefId: trigger.destroyedMonsterDefId,
        destroyedMonsterPower: trigger.destroyedMonsterPower,
        triggerCardUid: trigger.triggerCardUid,
        triggerCardDefId: trigger.triggerCardDefId,
        triggerCardOwnerId: trigger.triggerCardOwnerId,
        triggerCardKind: trigger.triggerCardKind,
        transferredCardUid: trigger.transferredCardUid,
        transferredCardDefId: trigger.transferredCardDefId,
        transferredCardOwnerId: trigger.transferredCardOwnerId,
        transferredFromPlayerId: trigger.transferredFromPlayerId,
        transferredToPlayerId: trigger.transferredToPlayerId,
        discardedCards: trigger.discardedCards ? structuredClone(trigger.discardedCards) : undefined,
        discardedFromZone: trigger.discardedFromZone,
        destroyerId: trigger.destroyerId,
        controllerId: trigger.controllerId,
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
                attachedActions: trigger.lkiMinion.attachedActions?.map(action => ({
                    uid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    metadata: action.metadata ? structuredClone(action.metadata) : undefined,
                })) ?? (() => {
                    const matchingSourceDefCount = (trigger.lkiMinion.attachedActionDefIds ?? [])
                        .filter(defId => defId === trigger.sourceDefId)
                        .length;
                    return (trigger.lkiMinion.attachedActionDefIds ?? []).map((defId, index) => ({
                        uid: defId === trigger.sourceDefId && trigger.sourceCardUid && matchingSourceDefCount === 1
                            ? trigger.sourceCardUid
                            : `${defId}:lki:${index}`,
                        defId,
                        ownerId: defId === trigger.sourceDefId && matchingSourceDefCount === 1
                            ? (trigger.sourceOwnerPlayerId ?? trigger.sourceControllerId ?? trigger.ownerPlayerId)
                            : (trigger.sourceControllerId ?? trigger.ownerPlayerId),
                    }));
                })(),
                metadata: trigger.lkiMinion.metadata ? structuredClone(trigger.lkiMinion.metadata) : undefined,
            }
            : undefined,
        reason: trigger.reason,
        affectType: trigger.affectType,
        counterChangeKind: trigger.counterChangeKind,
        counterDelta: trigger.counterDelta,
        affectEvent: trigger.affectEvent ? structuredClone(trigger.affectEvent) : undefined,
        affectBatchTargets: trigger.affectBatchTargets ? structuredClone(trigger.affectBatchTargets) : undefined,
        actionTargetBaseIndex: trigger.actionTargetBaseIndex,
        actionTargetType: trigger.actionTargetType,
        actionTargetMinionUid: trigger.actionTargetMinionUid,
        buriedCardUid: trigger.buriedCardUid,
        buriedCardDefId: trigger.buriedCardDefId,
        buriedCardControllerId: trigger.buriedCardControllerId,
        buriedFrom: trigger.buriedFrom,
        inspectionCards: trigger.inspectionCards ? structuredClone(trigger.inspectionCards) : undefined,
        inspectionZone: trigger.inspectionZone,
        inspectionTargetPlayerIds: trigger.inspectionTargetPlayerIds ? structuredClone(trigger.inspectionTargetPlayerIds) : undefined,
        inspectionCausePlayerId: trigger.inspectionCausePlayerId,
        triggerSharedState: runtimeSharedState,
        random,
        now,
    } as any);

    const triggerEvents = Array.isArray(result) ? result : result.events;
    const nextState = !Array.isArray(result) && result.matchState ? result.matchState : baseState;
    const normalizedCore = (nextState.core.triggerQueue ?? []).some((candidate) => candidate.id === trigger.id)
        ? reduce(nextState.core, consumed as unknown as SmashUpEvent)
        : nextState.core;
    const postProcessed = applyReactionPostProcessing(
        {
            ...nextState,
            core: normalizedCore,
        },
        triggerEvents,
        random,
        { recordImmediateStartTurnProcessedMinionUids: true },
    );
    const frameId = trigger.frameId ?? trigger.id;
    const hasRemainingFrameTriggers = (postProcessed.state.core.triggerQueue ?? []).some(
        (candidate) => (candidate.frameId ?? candidate.id) === frameId,
    );
    if (!hasRemainingFrameTriggers) {
        clearQueuedTriggerRuntimeSharedState(trigger.frameId, trigger.id);
    }
    return {
        state: postProcessed.state,
        events: [consumed, ...postProcessed.events],
    };
}

function applyReactionPostProcessing(
    state: MatchState<SmashUpCore>,
    rawEvents: SmashUpEvent[],
    random: RandomFn,
    options?: {
        skipImmediateStartTurnMinionTriggers?: boolean;
        recordImmediateStartTurnProcessedMinionUids?: boolean;
    },
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const postProcessed = reactionPostProcessor
        ? reactionPostProcessor(
            state.core,
            rawEvents,
            random,
            state,
            options,
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
                ...(value.targetMinionUid ? { targetMinionUid: value.targetMinionUid } : {}),
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
            interaction: probeState.sys.interaction
                ? {
                    ...probeState.sys.interaction,
                    current: undefined,
                }
                : probeState.sys.interaction,
        } as typeof probeState.sys,
    };
    const rawEvents = execute(executionState, command as any, random);
    const postProcessed = applyReactionPostProcessing(executionState, rawEvents, random);
    let cleanedState = postProcessed.state;
    const replacementBaseDefId = getDeferredReplacementBaseDefIdFromBaseDeckReorderEvents(postProcessed.events);
    if (replacementBaseDefId) {
        cleanedState = replaceDeferredPostScoringReplacementBase(cleanedState, replacementBaseDefId);
    }

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
    random: RandomFn,
) {
    const initialOptions = buildReactionOptions(state, session, now, random);
    const interaction = createAbilityRuntimeSimpleChoice(
        `smashup_reaction_${session.frameId}_${session.activePlayerId}_${now}`,
        session.activePlayerId,
        session.phase === 'mandatory'
            ? 'ui.reaction_choose_mandatory_title'
            : 'ui.reaction_choose_optional_title',
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
        const nextSession = getReactionSessionFromFrameId(latestState, session.frameId) ?? session;
        return buildReactionOptions(latestState, nextSession, now, random);
    };
    return interaction;
}

registerAbilityRuntimePrompt('smashup_reaction_choose', (state, _playerId, value, _interactionData, random, timestamp) => {
    return resolveSmashUpReactionChoice(
        state,
        random,
        timestamp,
        (value ?? { kind: 'pass' }) as ReactionChoiceValue,
    );
});

function continueSuspendedReactionIfNeeded(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    if (getSmashUpReactionSession(state)) return undefined;
    const session = getReactionSessionFromFrame(state);
    if (!session) return undefined;
    const resumedState = setSmashUpReactionSession(state, session);
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
        if (hasExplicitlyPassed(currentSession, currentSession.activePlayerId)) {
            const nextActivePlayerId = getNextUnpassedResponder(
                currentState.core,
                currentSession,
                currentSession.activePlayerId,
            );
            if (!nextActivePlayerId) {
                return completeReactionFrameAfterPass(currentState, currentSession.frameId, now).state;
            }
            currentSession = {
                ...currentSession,
                activePlayerId: nextActivePlayerId,
            };
            currentState = setSmashUpReactionSession(currentState, currentSession);
            continue;
        }

        const options = buildReactionOptions(currentState, currentSession, now);
        const nonPassOptions = options.filter(option => option.id !== 'pass');
        if (nonPassOptions.length > 0) {
            return setSmashUpReactionSession(currentState, currentSession);
        }

        const nextPassCount = currentSession.consecutivePasses + 1;
        if (nextPassCount >= playerCount) {
            return completeReactionFrameAfterPass(currentState, currentSession.frameId, now).state;
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
    const inferredContext = inferSessionFrameContext(frameId);
    return startSmashUpReactionSession(state, {
        frameId,
        frameKind: inferredContext.frameKind,
        currentPlayerId,
        activePlayerId: currentPlayerId,
        phase,
        sourceBaseIndex: first.baseIndex ?? first.sourceBaseIndex,
        responseWindowType: inferredContext.responseWindowType,
    });
}

export function advanceSmashUpReactionSession(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    if (state.sys.interaction?.current) return undefined;

    let currentState = state;
    const emittedEvents: SmashUpEvent[] = [];
    let session = getSmashUpReactionSession(currentState);

    if (!session) {
        const resumed = continueSuspendedReactionIfNeeded(currentState, random, now);
        if (resumed) return resumed;

        currentState = createSessionFromPendingFrame(currentState);
        session = getSmashUpReactionSession(currentState);
        if (!session) return undefined;
    }

    const normalizedSession = normalizeReactionSessionPlayers(currentState, session);
    if (
        normalizedSession.currentPlayerId !== session.currentPlayerId
        || normalizedSession.activePlayerId !== session.activePlayerId
    ) {
        currentState = setSmashUpReactionSession(currentState, normalizedSession);
        session = getSmashUpReactionSession(currentState) ?? normalizedSession;
    }

    const pruned = pruneUnavailableScoringFrameTriggers(currentState, session, now);
    if (pruned.events.length > 0) {
        currentState = pruned.state;
        emittedEvents.push(...pruned.events);
        session = getSmashUpReactionSession(currentState) ?? session;
    }

    if (session.phase === 'mandatory') {
        const mandatoryTriggers = getMandatoryFrameTriggers(currentState, session.frameId);
        if (mandatoryTriggers.length === 0) {
            currentState = setSmashUpReactionSession(currentState, {
                ...session,
                phase: 'optional',
                activePlayerId: session.currentPlayerId,
                consecutivePasses: 0,
                passedPlayerIds: [],
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
                return { state: currentState, events: emittedEvents };
            }
            currentState = restarted;
            session = restartedSession;
        }
    }

    session = getSmashUpReactionSession(currentState);
    if (!session) return undefined;

    const options = buildReactionOptions(currentState, session, now, random);
    const nonPassOptions = options.filter(option => option.id !== 'pass');
    if (session.phase === 'mandatory' && nonPassOptions.length === 0) {
        const optionalState = setSmashUpReactionSession(currentState, {
            ...session,
            phase: 'optional',
            activePlayerId: session.currentPlayerId,
            consecutivePasses: 0,
            passedPlayerIds: [],
        });
        const continued = advanceSmashUpReactionSession(optionalState, random, now);
        return continued
            ? {
                state: continued.state,
                events: [...emittedEvents, ...continued.events],
            }
            : {
                state: optionalState,
                events: emittedEvents,
            };
    }
    if (session.phase === 'optional' && nonPassOptions.length === 0) {
        const autoAdvancedState = autoAdvanceOptionalWithoutChoices(currentState, session, now);
        const autoAdvancedSession = getSmashUpReactionSession(autoAdvancedState);
        if (!autoAdvancedSession) {
            const resumed = continueSuspendedReactionIfNeeded(autoAdvancedState, random, now);
            return resumed ?? {
                state: autoAdvancedState,
                events: emittedEvents,
            };
        }
        currentState = autoAdvancedState;
        session = autoAdvancedSession;
    }
    if (session.phase === 'mandatory' && nonPassOptions.length === 1) {
        const resolved = resolveSmashUpReactionChoice(currentState, random, now, nonPassOptions[0].value);
        return {
            state: resolved.state,
            events: [...emittedEvents, ...resolved.events],
        };
    }
    const interaction = buildReactionInteraction(currentState, session, now, random);
    return {
        state: queueInteraction(currentState, interaction),
        events: emittedEvents,
    };
}

export function resolveSmashUpReactionChoice(
    state: MatchState<SmashUpCore>,
    random: RandomFn,
    now: number,
    value: ReactionChoiceValue,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const resolvedChoice = resolveLiveSmashUpReactionChoice(state, value, now, random);
    if (!resolvedChoice) return { state, events: [] };
    const { session, value: liveValue, wasStale } = resolvedChoice;
    const originInteractionSourceId = state.sys.interaction?.current
        ? ((state.sys.interaction.current.data ?? {}) as { sourceId?: string }).sourceId
        : undefined;

    if (wasStale) {
        const refreshed = advanceSmashUpReactionSession(state, random, now);
        return refreshed ?? { state, events: [] };
    }

    if (liveValue.kind === 'pass') {
        const passedSession = markPlayerPassed(session, session.activePlayerId);
        const nextPassCount = passedSession.consecutivePasses + 1;
        const nextActivePlayerId = getNextUnpassedResponder(state.core, passedSession, session.activePlayerId);
        if (!nextActivePlayerId || nextPassCount >= state.core.turnOrder.length) {
            const completed = completeReactionFrameAfterPass(state, session.frameId, now);
            const resumed = continueSuspendedReactionIfNeeded(completed.state, random, now);
            return resumed
                ? { state: resumed.state, events: [...completed.events, ...resumed.events] }
                : completed;
        }
        const advancedState = setSmashUpReactionSession(resolveInteraction(state), {
            ...passedSession,
            activePlayerId: nextActivePlayerId,
            consecutivePasses: nextPassCount,
        });
        const continued = advanceSmashUpReactionSession(advancedState, random, now);
        return continued ?? { state: advancedState, events: [] };
    }

    const baseContinuationSession: SmashUpReactionSession = session.phase === 'mandatory'
        ? session
        : {
            ...session,
            activePlayerId: getNextUnpassedResponder(state.core, session, session.activePlayerId)
                ?? session.activePlayerId,
            consecutivePasses: 0,
            passedPlayerIds: session.responseWindowType ? (session.passedPlayerIds ?? []) : [],
        };
    const continuationSession = liveValue.kind === 'activate_special'
        ? withConsumedSpecialCardUid(baseContinuationSession, liveValue.minionUid ?? liveValue.titanUid)
        : baseContinuationSession;

    const workingState = state;

    let result: { state: MatchState<SmashUpCore>; events: SmashUpEvent[] };
    if (liveValue.kind === 'trigger') {
        const trigger = (workingState.core.triggerQueue ?? []).find(candidate => candidate.id === liveValue.triggerId);
        if (!trigger) {
            return { state, events: [] };
        }
        result = executeQueuedTrigger(workingState, trigger, random, now);
    } else {
        result = executeReactionCommand(workingState, session, liveValue, random, now);
    }

    const resultSession = getSmashUpReactionSession(result.state);
    if (resultSession && resultSession.frameId !== session.frameId) {
        return result;
    }
    const producedDomainEvents = result.events.some(
        event => typeof event.type === 'string' && !event.type.startsWith('SYS_'),
    );
    const continuationBaseState = originInteractionSourceId === 'smashup_reaction_choose' && producedDomainEvents
        ? clearSmashUpReactionSession(result.state)
        : result.state;

    const currentInteraction = continuationBaseState.sys.interaction?.current;
    const currentInteractionSourceId = currentInteraction
        ? ((currentInteraction.data ?? {}) as { sourceId?: string }).sourceId
        : undefined;
    if (currentInteraction) {
        const queuedFollowup = currentInteractionSourceId === 'smashup_reaction_choose'
            ? continuationBaseState.sys.interaction?.queue?.[0]
            : undefined;
        const queuedFollowupSourceId = queuedFollowup
            ? ((queuedFollowup.data ?? {}) as { sourceId?: string }).sourceId
            : undefined;
        if (queuedFollowup && queuedFollowupSourceId && queuedFollowupSourceId !== 'smashup_reaction_choose') {
            const promotedState = resolveInteraction(continuationBaseState);
            const parkedState = continuationSession === session
                ? promotedState
                : setSmashUpReactionSession(promotedState, continuationSession);
            return {
                ...result,
                state: clearSmashUpReactionSession(parkedState),
            };
        }
        if (currentInteractionSourceId === 'smashup_reaction_choose') {
            if (originInteractionSourceId === 'smashup_reaction_choose' && producedDomainEvents) {
                const projectedMandatory = getMandatoryFrameTriggers(continuationBaseState, session.frameId);
                const resumed = projectedMandatory.length === 1
                    ? resolveSmashUpReactionChoice(continuationBaseState, random, now, {
                        kind: 'trigger',
                        triggerId: projectedMandatory[0].id,
                    })
                    : advanceSmashUpReactionSession(continuationBaseState, random, now);
                return resumed?.state.sys.interaction?.current
                    ? {
                        state: resumed.state,
                        events: [...result.events, ...resumed.events],
                    }
                    : {
                        ...result,
                        state: continuationBaseState,
                    };
            }
            return {
                ...result,
                state: continuationBaseState,
            };
        }
        const parkedState = continuationSession === session
            ? continuationBaseState
            : setSmashUpReactionSession(continuationBaseState, continuationSession);
        return {
            ...result,
            state: clearSmashUpReactionSession(parkedState),
        };
    }

    const continuedBaseState = setSmashUpReactionSession(continuationBaseState, continuationSession);
    const continued = advanceSmashUpReactionSession(continuedBaseState, random, now);
    return continued
        ? { state: continued.state, events: [...result.events, ...continued.events] }
        : { ...result, state: continuedBaseState };
}
