/**
 * 大杀四方 (Smash Up) - 领域内核组装
 *

 */

import type { DomainCore, GameEvent, GameOverResult, PlayerId, RandomFn, MatchState } from '../../../engine/types';
import { createEntityId } from '../../../engine/primitives';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import {
    processDestroyMoveCycle,
    processAffectTriggers,
    processDeckInspectionTriggers,
    processReturnToHandTriggers,
    filterProtectedAffectEvents,
    buildDestroyEventKey,
} from './reducer';
import type { FlowHooks, PhaseEnterResult } from '../../../engine/systems/FlowSystem';
import type {
    SmashUpCommand,
    SmashUpCore,
    SmashUpEvent,
    AbilityFeedbackEvent,
    GamePhase,
    PlayerState,
    CardInstance,
    StoredCardInstance,
    BaseInPlay,
    TurnStartedEvent,
    TurnEndedEvent,
    CardsDrawnEvent,
    BaseScoredEvent,
    BaseClearedEvent,
    BaseReplacedEvent,
    DeckReshuffledEvent,
    LimitModifiedEvent,
    ActionPlayedEvent,
    MinionPlayedEvent,
    MinionDestroyedEvent,
    MinionPowerBreakdown,
    MinionOnBase,
    TalentUsedEvent,
    VpAwardedEvent,
    ActionReturnToHandOptionArmedEvent,
    SpecialAfterScoringConsumedEvent,
} from './types';
import {
    PHASE_ORDER,
    SU_EVENTS,
    SU_EVENT_TYPES,
    SU_COMMANDS,
    TEAM_VP_TO_WIN_2V2,
    DRAW_PER_TURN,
    HAND_LIMIT,
    VP_TO_WIN,
    getCurrentPlayerId,
} from './types';
import { getEffectivePower, getTotalEffectivePowerOnBase, getEffectiveBreakpoint, getEffectivePowerBreakdown, getPlayerEffectivePowerOnBase, getScoringEligibleBaseIndices } from './ongoingModifiers';
import { collectTriggers, fireTriggerForSource, getModifiedBaseVp, hasRegisteredTrigger, interceptEvent as ongoingInterceptEvent, isBaseScoringSuppressed } from './ongoingEffects';
import { maybeResolveReactionQueue } from './reactionQueue';
import {
    getSmashUpReactionSession,
    registerSmashUpReactionPostProcessor,
    startSmashUpReactionSession,
} from './reactionSession';
import { getSmashUpReactionWindowContext } from './reactionWindowState';
import { readSmashUpRuntimeSetupConfig } from '../roomSetup';
import { normalizeSmashUpMatchStateForUi } from '../ui/normalizeRuntimeState';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import { getAllBaseDefIds, getBaseDef, getCardDef, isBaseDefAvailableForRuntimeBasePool } from '../data/cards';
import { drawCards } from './utils';
import {
    countMadnessCardsForPlayer,
    grantExtraAction,
    grantExtraMinion,
    madnessVpPenalty,
    fireMinionPlayedTriggers,
    getTitanByUid,
    getTitansOnBase,
    removeTitanFromPlay,
} from './abilityHelpers';
import {
    getSmashUpRawTeamVpTotals,
    getSmashUpTeamMembers,
    getSmashUpTeamScores,
    isSmashUpTwoVsTwoMode,
} from './teamMode';
import { collectBaseAbilityTriggers, collectExtendedBaseAbilityTriggers } from './baseAbilityQueue';
import { buildBaseTargetOptions } from './abilityHelpers';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import { createAbilityRuntimeSimpleChoice, registerAbilityRuntimePrompt } from './abilityRuntime';
import { queueImmediateExtraPlayInteractions } from './extraPlay';
import {
    appendScoringFrameDeferredPayload,
    buildPendingPostScoringActionEvents,
    clearScoringSession,
    consumeScoringFrameDeferredPayload,
    createScoringBaseRef,
    createScoringSession,
    getRemainingScoringBaseRefs,
    getScoringSession,
    isSameScoringBaseRef,
    markScoringBaseCompleted,
    resolveScoringBaseRefSlotIndex,
    serializePostScoringEvents,
    setScoringSession,
    updateScoringSession,
    type SmashUpScoringBaseRef,
} from './scoringSession';
import { getActiveResolutionFrame } from '../../../engine/systems/resolutionStack';

const POST_SCORING_BASE_REVEAL_DELAY_MS = 2000;
const POST_SCORING_BASE_REVEAL_DELAY_UNTIL_KEY = '_smashupPostScoringBaseRevealDelayUntil';

type SmashUpRuntimeSystemState = MatchState<SmashUpCore>['sys'] & {
    _smashupStartTurnWindowActive?: boolean;
    _waitForStartTurnInteractionReduce?: boolean;
    _waitForScoreBasesInteractionReduce?: boolean;
    _waitForPostScoringReduce?: boolean;
    _ppseInputEventsReduced?: boolean;
    _processedTitanPositionEvents?: Set<string>;
    _processedTitanRemovedEvents?: Set<string>;
};

function getSmashUpRuntimeSys(state: MatchState<SmashUpCore>): SmashUpRuntimeSystemState {
    return state.sys as SmashUpRuntimeSystemState;
}

function createReactionQueueFallbackState(core: SmashUpCore): MatchState<SmashUpCore> {
    return {
        core,
        sys: {
            interaction: { current: undefined, queue: [] },
        } as MatchState<SmashUpCore>['sys'],
    };
}

function buildActionReturnToHandPromptKey(event: ActionReturnToHandOptionArmedEvent): string {
    return [
        event.type,
        event.payload.playerId,
        event.payload.ownerId,
        event.payload.cardUid,
        event.payload.reason,
        event.timestamp ?? 0,
    ].join(':');
}

function queueActionReturnToHandPrompts(
    state: MatchState<SmashUpCore>,
    events: SmashUpEvent[],
    now: number,
): MatchState<SmashUpCore> {
    const sysAny = state.sys as Record<string, unknown>;
    if (!(sysAny._processedActionReturnToHandPromptEvents instanceof Set)) {
        sysAny._processedActionReturnToHandPromptEvents = new Set<string>();
    }
    const processedKeys = sysAny._processedActionReturnToHandPromptEvents as Set<string>;

    let nextState = state;
    for (const rawEvent of events) {
        if (rawEvent.type !== SU_EVENTS.ACTION_RETURN_TO_HAND_OPTION_ARMED) continue;
        const event = rawEvent as ActionReturnToHandOptionArmedEvent;
        const promptKey = buildActionReturnToHandPromptKey(event);
        if (processedKeys.has(promptKey)) continue;
        processedKeys.add(promptKey);

        const owner = nextState.core.players[event.payload.ownerId];
        const inDiscard = owner?.discard.some((card) => card.uid === event.payload.cardUid && card.defId === event.payload.defId) ?? false;
        if (!inDiscard) continue;

        const actionName = getCardDef(event.payload.defId)?.name ?? event.payload.defId;
        nextState = queueInteraction(nextState, createSimpleChoice(
            `smashup_action_return_to_hand_${event.payload.cardUid}_${event.timestamp ?? now}`,
            event.payload.playerId,
            `无限循环：是否将${actionName}收入手牌？`,
            [
                {
                    id: 'return',
                    label: '收入手牌',
                    labelKey: 'ui.geeks_non_infinite_loop_return_option',
                    value: {
                        returnToHand: true,
                        cardUid: event.payload.cardUid,
                        defId: event.payload.defId,
                        ownerId: event.payload.ownerId,
                        reason: event.payload.reason,
                    },
                },
                {
                    id: 'leave',
                    label: '留在原处',
                    labelKey: 'ui.geeks_non_infinite_loop_leave_option',
                    value: {
                        returnToHand: false,
                        cardUid: event.payload.cardUid,
                        defId: event.payload.defId,
                        ownerId: event.payload.ownerId,
                        reason: event.payload.reason,
                    },
                },
            ],
            {
                sourceId: 'geeks_non_infinite_loop_return',
                autoResolveIfSingle: false,
                titleKey: 'ui.geeks_non_infinite_loop_return_title',
                titleParams: { actionName },
            },
        ));
    }

    return nextState;
}

// ============================================================================

// ============================================================================

function collectPhaseTwoOngoingExtraEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    now: number,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];

    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        const base = core.bases[baseIndex];

        for (const minion of base.minions) {
            if (minion.defId === 'wizard_archmage' && minion.controller === playerId) {
                events.push(grantExtraAction(playerId, 'wizard_archmage', now, { playTiming: 'banked' }));
            }
        }

        for (const ongoing of base.ongoingActions) {
            const ongoingControllerId = (ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ongoing.ownerId;
            if (ongoing.defId === 'trickster_enshrouding_mist' && ongoingControllerId === playerId) {
                events.push(grantExtraMinion(playerId, 'trickster_enshrouding_mist', now, baseIndex, { playTiming: 'banked' }));
            }
        }

    }

    return events;
}

function collectQualifiedPlayerPowers(
    core: SmashUpCore,
    base: BaseInPlay,
    baseIndex: number,
): Map<PlayerId, number> {
    const playersWithMinions = new Set<PlayerId>(
        base.minions.map(minion => minion.controller),
    );
    const playerPowers = new Map<PlayerId, number>();

    for (const playerId of Object.keys(core.players) as PlayerId[]) {
        const power = getPlayerEffectivePowerOnBase(core, base, baseIndex, playerId);
        if (power > 0 || playersWithMinions.has(playerId)) {
            playerPowers.set(playerId, power);
        }
    }

    return playerPowers;
}

function getPlayersWithPlayableAfterScoringResponses(state: MatchState<SmashUpCore>, now: number): PlayerId[] {
    const eligibleBaseIndices = getScoringEligibleBaseIndices(state.core);
    const playablePlayers: PlayerId[] = [];

    for (const playerId of Object.keys(state.core.players) as PlayerId[]) {
        const player = state.core.players[playerId];
        if (!player) continue;

        const probeState: MatchState<SmashUpCore> = {
            ...state,
            sys: {
                ...state.sys,
                responseWindow: {
                    ...state.sys.responseWindow,
                    current: {
                        id: `afterScoring_probe_${playerId}_${now}`,
                        windowType: 'afterScoring',
                        sourceId: 'scoreBases',
                        responderQueue: [playerId],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            },
        };

        const hasPlayableResponse = player.hand.some(card => {
            const baseCandidates = [undefined, ...eligibleBaseIndices];
            return baseCandidates.some(targetBaseIndex => {
                const result = validate(probeState, {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId,
                    payload: {
                        cardUid: card.uid,
                        ...(targetBaseIndex !== undefined ? { targetBaseIndex } : {}),
                    },
                });
                return result.valid;
            });
        });

        if (hasPlayableResponse) {
            playablePlayers.push(playerId);
        }
    }

    return playablePlayers;
}

type TurnEndAdvancePayload = Omit<TurnEndedEvent['payload'], 'playerId'>;

function buildTurnEndAdvancePayload(core: SmashUpCore): TurnEndAdvancePayload {
    const currentPlayerId = getCurrentPlayerId(core);
    const activeExtraTurn = core.activeExtraTurn;
    if (activeExtraTurn && activeExtraTurn.playerId === currentPlayerId) {
        return {
            nextPlayerIndex: activeExtraTurn.returnToPlayerIndex,
            completedExtraTurn: true,
        };
    }

    const queuedExtraTurn = core.pendingExtraTurns?.[0];
    if (queuedExtraTurn) {
        const queuedPlayerIndex = core.turnOrder.indexOf(queuedExtraTurn.playerId);
        if (queuedPlayerIndex >= 0) {
            return {
                nextPlayerIndex: queuedPlayerIndex,
                extraTurnPlayerId: queuedExtraTurn.playerId,
                extraTurnReturnToPlayerIndex: queuedExtraTurn.returnToPlayerIndex,
                extraTurnReason: queuedExtraTurn.reason,
            };
        }
    }

    return {
        nextPlayerIndex: (core.currentPlayerIndex + 1) % core.turnOrder.length,
    };
}

function buildBaseRankings(
    core: SmashUpCore,
    baseIndex: number,
    baseDef: { vpAwards: number[] },
    playerPowers: Map<PlayerId, number>,
): { playerId: PlayerId; power: number; vp: number }[] {
    const sorted = Array.from(playerPowers.entries())
        .sort((a, b) => b[1] - a[1]);
    const rankings: { playerId: PlayerId; power: number; vp: number }[] = [];
    let index = 0;

    while (index < sorted.length) {
        const [, power] = sorted[index];
        let groupEnd = index;
        while (groupEnd + 1 < sorted.length && sorted[groupEnd + 1][1] === power) {
            groupEnd += 1;
        }

        const awardSlot = groupEnd;
        const printedVp = awardSlot < 3 ? (baseDef.vpAwards[awardSlot] ?? 0) : 0;
        const vp = getModifiedBaseVp(
            core,
            baseIndex,
            sorted[index][0],
            printedVp,
        );

        for (let i = index; i <= groupEnd; i += 1) {
            rankings.push({
                playerId: sorted[i][0],
                power,
                vp,
            });
        }

        index = groupEnd + 1;
    }

    return rankings;
}

function getLockedScoringBaseIndices(core: SmashUpCore): number[] {
    return getScoringEligibleBaseIndices(core);
}

function ensureScoreBasesSession(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    if (getScoringSession(state)) {
        return state;
    }
    const lockedIndices = getLockedScoringBaseIndices(state.core);
    if (lockedIndices.length === 0) {
        return state;
    }
    return setScoringSession(state, createScoringSession(state.core, lockedIndices));
}

function buildMultiBaseScoringInteraction(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    baseRefs: SmashUpScoringBaseRef[],
) {
    const candidates = baseRefs
        .map((ref) => {
            const baseIndex = resolveScoringBaseRefSlotIndex(state, ref);
            if (baseIndex === undefined) return null;
            const base = state.core.bases[baseIndex];
            if (!base) return null;
            const baseDef = getBaseDef(base.defId);
            const totalPower = getTotalEffectivePowerOnBase(state.core, base, baseIndex);
            const ownPower = getPlayerEffectivePowerOnBase(state.core, base, baseIndex, playerId);
            const bestOpponentPower = Object.keys(state.core.players)
                .filter(candidatePlayerId => candidatePlayerId !== playerId)
                .reduce((best, candidatePlayerId) => {
                    const power = getPlayerEffectivePowerOnBase(state.core, base, baseIndex, candidatePlayerId as PlayerId);
                    return Math.max(best, power);
                }, 0);
            return {
                baseIndex,
                label: `${baseDef?.name ?? `基地 ${baseIndex + 1}`} (力量 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
                estimatedSwing: ownPower - bestOpponentPower,
            };
        })
        .filter(Boolean) as Array<{ baseIndex: number; label: string; estimatedSwing: number }>;

    if (candidates.length === 0) {
        return undefined;
    }

    const hintByBaseIndex = new Map(candidates.map(candidate => [candidate.baseIndex, candidate.estimatedSwing]));

    const options: PromptOption<{ baseIndex: number; baseDefId?: string }>[] = buildBaseTargetOptions(candidates, state.core).map((option) => ({
        ...option,
        _ai: {
            targetKind: 'base',
            relationToActor: 'self',
            derivedFrom: 'explicit',
            estimatedSwing: hintByBaseIndex.get(option.value?.baseIndex ?? -1),
        },
    }));

    return createAbilityRuntimeSimpleChoice(
        `multi_base_scoring_${now}`,
        playerId,
        candidates.length === 1 ? '计分最后一个基地' : '选择先计分的基地',
        options,
        { sourceId: 'multi_base_scoring', targetType: 'base' },
    );
}

function finalizeCurrentScoringBase(
    state: MatchState<SmashUpCore>,
    now: number,
): { updatedState: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const consumedDeferred = consumeScoringFrameDeferredPayload(state);
    const workingState = consumedDeferred.state;
    const session = getScoringSession(workingState);
    const currentBaseRef = session?.currentBaseRef;
    if (!session || !currentBaseRef) {
        return { updatedState: workingState, events: [] };
    }
    const events: SmashUpEvent[] = [];

    const deferredEvents = consumedDeferred.deferredEvents;
    if (deferredEvents.length > 0) {
        events.push(...deferredEvents.map((event) => ({
            type: event.type,
            payload: event.payload,
            timestamp: event.timestamp,
        })) as SmashUpEvent[]);
    }
    const postDeferredCore = events.reduce(
        (core, event) => reduce(core, event),
        workingState.core,
    );

    events.push(
        ...buildPendingPostScoringActionEvents(
            { core: postDeferredCore },
            consumedDeferred.deferredActions,
            now,
        ),
    );

    let completedState = updateScoringSession(
        markScoringBaseCompleted(workingState, currentBaseRef),
        (currentSession) => currentSession
            ? {
                ...currentSession,
                currentStep: 'awaiting-post-reduce',
            }
            : currentSession,
    );
    const completedSession = getScoringSession(completedState);
    if (completedSession) {
        const discoveredEligibleRefs = getScoringEligibleBaseIndices(postDeferredCore)
            .map((baseIndex) => createScoringBaseRef({ ...postDeferredCore }, baseIndex))
            .filter((baseRef): baseRef is SmashUpScoringBaseRef => !!baseRef)
            .filter((baseRef) => !completedSession.completedBaseRefs.some((completedRef) => isSameScoringBaseRef(completedRef, baseRef)))
            .filter((baseRef) => !completedSession.lockedBaseRefs.some((lockedRef) => isSameScoringBaseRef(lockedRef, baseRef)));

        if (discoveredEligibleRefs.length > 0) {
            completedState = updateScoringSession(completedState, (currentSession) => currentSession
                ? {
                    ...currentSession,
                    lockedBaseRefs: [...currentSession.lockedBaseRefs, ...discoveredEligibleRefs],
                }
                : currentSession);

            const futureState = { ...completedState, core: postDeferredCore };
            const futureSession = getScoringSession(futureState);
            const remainingLockedIndices = futureSession
                ? futureSession.lockedBaseRefs
                    .filter((baseRef) => !futureSession.completedBaseRefs.some((completedRef) => isSameScoringBaseRef(completedRef, baseRef)))
                    .map((baseRef) => resolveScoringBaseRefSlotIndex(futureState, baseRef))
                    .filter((baseIndex): baseIndex is number => baseIndex !== undefined)
                : [];

            events.push({
                type: SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED,
                payload: { baseIndices: remainingLockedIndices },
                timestamp: now,
            } as SmashUpEvent);
        }
    }
    const awaitingReduceState = {
        ...completedState,
        sys: {
            ...completedState.sys,
            _waitForPostScoringReduce: true,
        } as typeof completedState.sys,
    };

    return {
        updatedState: awaitingReduceState,
        events,
    };
}

function beginPostScoringBaseRevealDelay(
    state: MatchState<SmashUpCore>,
    now: number,
): MatchState<SmashUpCore> {
    const delayStart = now > 0 ? now : Date.now();
    const delayedState = updateScoringSession(state, (session) => session
        ? {
            ...session,
            currentStep: 'awaiting-post-scoring-delay',
        }
        : session,
    );
    return {
        ...delayedState,
        sys: {
            ...delayedState.sys,
            [POST_SCORING_BASE_REVEAL_DELAY_UNTIL_KEY]: delayStart + POST_SCORING_BASE_REVEAL_DELAY_MS,
        } as typeof delayedState.sys,
    };
}

function isPostScoringBaseRevealDelayActive(
    state: MatchState<SmashUpCore>,
    now: number,
): boolean {
    const delayUntil = (state.sys as Record<string, unknown>)[POST_SCORING_BASE_REVEAL_DELAY_UNTIL_KEY];
    const currentTime = now > 0 ? now : Date.now();
    return typeof delayUntil === 'number' && delayUntil > currentTime;
}

function clearPostScoringBaseRevealDelay(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    if ((state.sys as Record<string, unknown>)[POST_SCORING_BASE_REVEAL_DELAY_UNTIL_KEY] === undefined) {
        return state;
    }
    return {
        ...state,
        sys: {
            ...state.sys,
            [POST_SCORING_BASE_REVEAL_DELAY_UNTIL_KEY]: undefined,
        } as typeof state.sys,
    };
}

/**

 * 

 */
export function scoreOneBase(
    core: SmashUpCore,
    baseIndex: number,
    baseDeck: string[],
    pid: PlayerId,
    now: number,
    random?: RandomFn,
    matchState?: MatchState<SmashUpCore>,
): { events: SmashUpEvent[]; newBaseDeck: string[]; matchState?: MatchState<SmashUpCore> } {
    // 响应窗口/交互在 matchState.core 上推进时，调用方传入的 core 可能还是旧快照。
    // 计分必须以最新 core 为准，否则会把计分前已销毁/移动的随从继续算进排名。
    if (matchState?.core) {
        core = matchState.core;
    }

    // 默认 random（确定性回放，计分中大多数 trigger 不需要随机）
    const rng: RandomFn = random ?? {
        random: () => 0.5,
        d: () => 1,
        range: (min: number) => min,
        shuffle: <T>(arr: T[]) => [...arr],
    };
    const events: SmashUpEvent[] = [];
    let ms = matchState;
    const base = core.bases[baseIndex];
    const baseDef = getBaseDef(base.defId)!;
    const currentBaseRef = createScoringBaseRef(core, baseIndex);

    if (ms && currentBaseRef) {
        ms = updateScoringSession(ms, (session) => session
            ? {
                ...session,
                currentBaseRef,
                currentStep: 'resolving-base',
            }
            : session,
        );
    }
    let newBaseDeck = baseDeck;

    

    const alreadyTriggeredBeforeScoring = core.beforeScoringTriggeredBases?.includes(baseIndex) ?? false;
    const beforeScoringFrameId = `score-before:${baseIndex}:${now}`;
    
    
    if (!alreadyTriggeredBeforeScoring) {
        const queuedBefore = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: ms,
            playerId: pid,
            baseIndex,
            frameId: beforeScoringFrameId,
            sourceEventId: beforeScoringFrameId,
            random: rng,
            now,
        });
        if (queuedBefore) {
            events.push(queuedBefore);
            core = reduce(core, queuedBefore as unknown as SmashUpEvent);
        }

        // Try to resolve reaction queue now so scoreOneBase can halt on interactions.
        const rq0 = maybeResolveReactionQueue(ms ? { ...ms, core } : createReactionQueueFallbackState(core), rng, now);
        if (rq0) {
            events.push(...rq0.events);
            ms = rq0.state;
            core = rq0.state.core;
        }
        

        // 发送事件标记该基地已触发 beforeScoring
        const markEvent = {
            type: SU_EVENT_TYPES.BEFORE_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(markEvent as unknown as SmashUpEvent);
        

        // 

        // 2. 杩欎簺浜嬩欢瑕佺瓑鍒版暣涓?onPhaseExit 杩斿洖鍚庯紝鎵嶄細琚?pipeline 閫愪釜 reduce

        // 

        // 

        // - 绗竴娆¤皟鐢細妫€鏌?beforeScoringTriggeredBases 鈫?undefined 鈫?瑙﹀彂 beforeScoring 鈫?鍒涘缓娴风洍鐜嬩氦浜?鈫?halt

        core = reduce(core, markEvent as unknown as SmashUpEvent);

        if (ms?.sys?.interaction?.current) {
            return { events, newBaseDeck: baseDeck, matchState: ms };
        }
    }

    let updatedCore = core;

    const queuedBeforeBase = collectBaseAbilityTriggers({
        core: updatedCore,
        timing: 'beforeScoring',
        ownerPlayerId: pid,
        baseIndex,
        frameId: beforeScoringFrameId,
        sourceEventId: beforeScoringFrameId,
        now,
    });
    if (queuedBeforeBase) {
        events.push(queuedBeforeBase as unknown as SmashUpEvent);
        updatedCore = reduce(updatedCore, queuedBeforeBase as unknown as SmashUpEvent);
        if (ms) ms = { ...ms, core: updatedCore };
        if (ms?.sys?.interaction?.current) {
            return { events, newBaseDeck: baseDeck, matchState: ms };
        }
    }

    // 计分前响应窗口：允许 beforeScoring 交互与响应窗口优先完成
    if (!alreadyTriggeredBeforeScoring && ms) {
        ms = { ...ms, core: updatedCore };
        ms = startSmashUpReactionSession(ms, {
            frameId: beforeScoringFrameId,
            frameKind: 'score-before',
            responseWindowType: 'meFirst',
            sourceBaseIndex: baseIndex,
        });
        const beforeSession = maybeResolveReactionQueue(ms, rng, now);
        if (beforeSession) {
            events.push(...beforeSession.events);
            ms = beforeSession.state;
            updatedCore = beforeSession.state.core;
        }
        if (ms.sys.interaction?.current || getSmashUpReactionSession(ms)) {
            return { events, newBaseDeck: baseDeck, matchState: ms };
        }
    }

    const updatedBaseAfterBefore = updatedCore.bases[baseIndex];
    // beforeScoring 处理后，如果该基地已不再达标，则本次计分直接跳过
    // （例如 pirate_king 移走随从导致基地力量降到 breakpoint 以下）
    if (!updatedBaseAfterBefore) {
        if (ms) ms = { ...ms, core: updatedCore };
        return { events, newBaseDeck: baseDeck, matchState: ms };
    }
    if (isBaseScoringSuppressed(updatedCore, baseIndex)) {
        if (ms) ms = { ...ms, core: updatedCore };
        return { events, newBaseDeck: baseDeck, matchState: ms };
    }
    const effectiveBreakpointAfterBefore = getEffectiveBreakpoint(updatedCore, baseIndex);
    const totalPowerAfterBefore = getTotalEffectivePowerOnBase(updatedCore, updatedBaseAfterBefore, baseIndex);
    const lockedAtScoreBasesEnter = updatedCore.scoringEligibleBaseIndices?.includes(baseIndex) ?? false;
    // 规则（Wiki Phase 3 Step 4）：进入 scoreBases 阶段时达到 breakpoint 的基地会被锁定，
    // 即便在 Me First! / beforeScoring 链路中力量被压到 breakpoint 以下，仍应继续计分。
    if (!lockedAtScoreBasesEnter && totalPowerAfterBefore < effectiveBreakpointAfterBefore) {
        if (ms) ms = { ...ms, core: updatedCore };
        return { events, newBaseDeck: baseDeck, matchState: ms };
    }

    const updatedBase = updatedCore.bases[baseIndex];
    const playerPowers = collectQualifiedPlayerPowers(updatedCore, updatedBase, baseIndex);
    const preliminaryRankings = buildBaseRankings(updatedCore, baseIndex, baseDef, playerPowers);

    const alreadyTriggeredWhenScoring = updatedCore.whenScoringTriggeredBases?.includes(baseIndex) ?? false;
    const whenScoringFrameId = `score-when:${baseIndex}:${now}`;
    if (!alreadyTriggeredWhenScoring) {
        const queuedWhenScoringBase = collectBaseAbilityTriggers({
            core: updatedCore,
            timing: 'whenScoring',
            ownerPlayerId: pid,
            baseIndex,
            rankings: preliminaryRankings,
            frameId: whenScoringFrameId,
            sourceEventId: whenScoringFrameId,
            now,
        });
        if (queuedWhenScoringBase) {
            events.push(queuedWhenScoringBase as unknown as SmashUpEvent);
            updatedCore = reduce(updatedCore, queuedWhenScoringBase as unknown as SmashUpEvent);
            if (ms) ms = { ...ms, core: updatedCore };
        }

        const whenScoringTriggeredEvent = {
            type: SU_EVENT_TYPES.WHEN_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(whenScoringTriggeredEvent as unknown as SmashUpEvent);
        updatedCore = reduce(updatedCore, whenScoringTriggeredEvent as unknown as SmashUpEvent);
        if (ms) {
            ms = { ...ms, core: updatedCore };
            ms = startSmashUpReactionSession(ms, {
                frameId: whenScoringFrameId,
                frameKind: 'score-when',
                sourceBaseIndex: baseIndex,
            });
            const whenSession = maybeResolveReactionQueue(ms, rng, now);
            if (whenSession) {
                events.push(...whenSession.events);
                ms = whenSession.state;
                updatedCore = whenSession.state.core;
            }
            if (ms.sys.interaction?.current || getSmashUpReactionSession(ms)) {
                return { events, newBaseDeck: baseDeck, matchState: ms };
            }
        }
    }

    const scoringBase = updatedCore.bases[baseIndex] ?? updatedBase;
    const totalPower = getTotalEffectivePowerOnBase(updatedCore, scoringBase, baseIndex);
    const effectiveBreakpoint = getEffectiveBreakpoint(updatedCore, scoringBase, baseIndex);
    const scoredByLockedEligibility = totalPower < effectiveBreakpoint;
    const finalPlayerPowers = collectQualifiedPlayerPowers(updatedCore, scoringBase, baseIndex);
    const rankings = buildBaseRankings(updatedCore, baseIndex, baseDef, finalPlayerPowers);

    const minionBreakdowns: Record<PlayerId, MinionPowerBreakdown[]> = {};
    for (const m of scoringBase.minions) {
        const bd = getEffectivePowerBreakdown(updatedCore, m, baseIndex);
        if (!minionBreakdowns[m.controller]) minionBreakdowns[m.controller] = [];
        minionBreakdowns[m.controller].push({
            defId: m.defId,
            basePower: bd.basePower,
            finalPower: bd.finalPower,
            modifiers: [
                ...(bd.permanentModifier !== 0 ? [{ sourceDefId: m.defId, sourceName: 'actionLog.powerModifier.permanent', value: bd.permanentModifier }] : []),
                ...(bd.tempModifier !== 0 ? [{ sourceDefId: m.defId, sourceName: 'actionLog.powerModifier.temp', value: bd.tempModifier }] : []),
                ...bd.ongoingDetails.map(d => ({ sourceDefId: d.sourceDefId, sourceName: d.sourceName, value: d.value })),
            ],
        });
    }

    const scoreEvt: BaseScoredEvent = {
        type: SU_EVENTS.BASE_SCORED,
        payload: {
            baseIndex,
            baseDefId: scoringBase.defId,
            rankings,
            minionBreakdowns,
            totalPower,
            baseBreakpoint: baseDef.breakpoint,
            effectiveBreakpoint,
            scoredByLockedEligibility,
        },
        timestamp: now,
    };
    events.push(scoreEvt);

    for (const m of scoringBase.minions) {
        const queued = collectTriggers(updatedCore, 'onMinionDiscardedFromBase', {
            state: updatedCore,
            matchState: ms,
            playerId: m.controller,
            baseIndex,
            triggerMinionUid: m.uid,
            triggerMinionDefId: m.defId,
            triggerMinionPower: getEffectivePower(updatedCore, m, baseIndex),
            triggerMinion: m,
            random: rng,
            now,
        });
        if (queued) {
            events.push(queued);
            updatedCore = reduce(updatedCore, queued as unknown as SmashUpEvent);
            if (ms) ms = { ...ms, core: updatedCore };
            const rq = maybeResolveReactionQueue(ms ? ms : createReactionQueueFallbackState(updatedCore), rng, now);
            if (rq) {
                events.push(...rq.events);
                ms = rq.state;
                updatedCore = rq.state.core;
            }
        }
    }

    // 璁板綍 afterScoring 鍓嶇殑浜や簰鐘舵€侊紝鐢ㄤ簬鍒ゆ柇 afterScoring 鏄惁鏂板浜嗕氦浜?
    const afterScoringCore = updatedCore;
    const interactionBeforeAfterScoring = ms?.sys?.interaction?.current?.id ?? null;
    const queueLenBeforeAfterScoring = ms?.sys?.interaction?.queue?.length ?? 0;

    const alreadyTriggeredAfterScoring = updatedCore.afterScoringTriggeredBases?.includes(baseIndex) ?? false;
    const afterScoringFrameId = `score-after:${baseIndex}:${now}`;

    if (!alreadyTriggeredAfterScoring) {
        // 统一 afterScoring special 已迁到 trigger 模型；这里只对漏注册条目做反馈并清理。
        const armedSpecials = (updatedCore.pendingAfterScoringSpecials ?? []).filter(
            s => s.baseIndex === baseIndex
        );
        
        for (const armed of armedSpecials) {
            if (hasRegisteredTrigger(armed.sourceDefId, 'afterScoring')) {
                continue;
            }
            const feedbackEvt: AbilityFeedbackEvent = {
                type: SU_EVENT_TYPES.ABILITY_FEEDBACK,
                payload: {
                    playerId: armed.playerId,
                    sourceDefId: armed.sourceDefId,
                    message: 'actionLog.ability_not_implemented',
                },
                timestamp: now,
            };
            events.push(feedbackEvt);
            
            // 鏍囪涓哄凡娑堣垂
            const consumedEvt: SpecialAfterScoringConsumedEvent = {
                type: SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_CONSUMED,
                payload: {
                    sourceDefId: armed.sourceDefId,
                    playerId: armed.playerId,
                    baseIndex,
                    cardUid: armed.cardUid,
                },
                timestamp: now,
            };
            events.push(consumedEvt);
            updatedCore = reduce(updatedCore, consumedEvt);
        }
        
        // Queue afterScoring base ability + ongoing afterScoring triggers into the same reaction window,
        // so moving/destroying one trigger's source doesn't prevent the others from being queued.
        const queuedAfterBase = collectBaseAbilityTriggers({
            core: updatedCore,
            timing: 'afterScoring',
            ownerPlayerId: pid,
            baseIndex,
            rankings,
            frameId: afterScoringFrameId,
            sourceEventId: afterScoringFrameId,
            now,
        });
        if (queuedAfterBase) {
            events.push(queuedAfterBase as unknown as SmashUpEvent);
            updatedCore = reduce(updatedCore, queuedAfterBase as unknown as SmashUpEvent);
            if (ms) ms = { ...ms, core: updatedCore };
        }

        const queuedAfterOngoing = collectTriggers(updatedCore, 'afterScoring', {
            state: updatedCore,
            playerId: pid,
            baseIndex,
            rankings,
            matchState: ms,
            frameId: afterScoringFrameId,
            sourceEventId: afterScoringFrameId,
            random: rng,
            now,
        });
        if (queuedAfterOngoing) {
            events.push(queuedAfterOngoing);
            updatedCore = reduce(updatedCore, queuedAfterOngoing as unknown as SmashUpEvent);
            if (ms) ms = { ...ms, core: updatedCore };
        }

        // Mark afterScoring as triggered immediately (even if it creates an interaction),
        // so re-entering scoreOneBase after resolving an interaction won't re-queue it.
        const markEvent = {
            type: SU_EVENT_TYPES.AFTER_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(markEvent as unknown as SmashUpEvent);
        updatedCore = reduce(updatedCore, markEvent as unknown as SmashUpEvent);
        if (ms) ms = { ...ms, core: updatedCore };

        if (ms) {
            ms = { ...ms, core: updatedCore };
            ms = startSmashUpReactionSession(ms, {
                frameId: afterScoringFrameId,
                frameKind: 'score-after',
                responseWindowType: 'afterScoring',
            });
            const rq = maybeResolveReactionQueue(ms, rng, now);
            if (rq) {
                events.push(...rq.events);
                ms = rq.state;
                updatedCore = rq.state.core;
            }
        }
        // NOTE: If an interaction was created here (e.g. smashup_reaction_choose),
        // we must still continue so scoreOneBase can defer BASE_CLEARED/BASE_REPLACED into continuationContext.
    }

    // 鍒ゆ柇 afterScoring 鏄惁鏂板浜嗕氦浜?
    const interactionAfter = ms?.sys?.interaction?.current?.id ?? null;
    const queueLenAfter = ms?.sys?.interaction?.queue?.length ?? 0;
    const afterScoringCreatedInteraction =
        (interactionAfter !== null && interactionAfter !== interactionBeforeAfterScoring) ||
        (queueLenAfter > queueLenBeforeAfterScoring) ||
        !!(ms && getSmashUpReactionSession(ms));

    const playersWithAfterScoringCards = ms
        ? getPlayersWithPlayableAfterScoringResponses({ ...ms, core: afterScoringCore }, now)
        : [];
    // afterScoring 可能已经通过 BASE_DECK_REORDERED / 其他补发事件改写了基地牌库；
    // 后续换基地与空牌库 reshuffle 必须以最新 core 为准，而不是沿用函数入参的旧 baseDeck 快照。
    newBaseDeck = [...(updatedCore.baseDeck ?? newBaseDeck)];

    // 构建清场 + 换基地 + onBaseRevealed 触发队列（延迟到当前基地彻底结算后再补发）
    const postScoringEvents: SmashUpEvent[] = [];
    const clearEvt: BaseClearedEvent = {
        type: SU_EVENTS.BASE_CLEARED,
        payload: { baseIndex, baseDefId: scoringBase.defId, baseInstanceId: scoringBase.instanceId },
        timestamp: now,
    };
    postScoringEvents.push(clearEvt);

    if (newBaseDeck.length === 0) {
        const pool = [...(core.baseDiscard ?? []), base.defId];
        const rebuiltDeck = (random?.shuffle ? random.shuffle(pool) : [...pool]);
        const shuffleEvt: BaseDeckShuffledEvent = {
            type: SU_EVENTS.BASE_DECK_SHUFFLED,
            payload: {
                newBaseDeckDefIds: rebuiltDeck,
                reason: 'base_deck_empty_reshuffle_discard',
                clearBaseDiscard: true,
            },
            timestamp: now,
        };
        postScoringEvents.push(shuffleEvt);
        newBaseDeck = rebuiltDeck;
    }

    if (newBaseDeck.length > 0) {
        const newBaseDefId = newBaseDeck[0];
        const replaceEvt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex,
                oldBaseDefId: scoringBase.defId,
                newBaseDefId,
                oldBaseInstanceId: scoringBase.instanceId,
            },
            timestamp: now,
        };
        postScoringEvents.push(replaceEvt);
        newBaseDeck = newBaseDeck.slice(1);
        const revealCore = postScoringEvents.reduce(
            (nextCore, event) => reduce(nextCore, event),
            updatedCore,
        );

        const queuedReveal = collectExtendedBaseAbilityTriggers({
            core: revealCore,
            timing: 'onBaseRevealed',
            ownerPlayerId: pid,
            baseIndex,
            now,
        });
        if (queuedReveal) {
            postScoringEvents.push(queuedReveal as unknown as SmashUpEvent);
        }
    }

    const serializedDeferredEvents = serializePostScoringEvents(postScoringEvents);
    if (ms && currentBaseRef) {
        const waitingStep = afterScoringCreatedInteraction || playersWithAfterScoringCards.length > 0
            ? getSmashUpReactionSession(ms)
                ? 'awaiting-response-window'
                : 'awaiting-interactions'
            : 'awaiting-post-scoring-delay';
        ms = updateScoringSession(ms, (session) => session
            ? {
                ...session,
                currentBaseRef,
                currentStep: waitingStep,
            }
            : session,
        );
        ms = appendScoringFrameDeferredPayload(ms, {
            deferredEvents: serializedDeferredEvents,
        });
        if (waitingStep === 'awaiting-post-scoring-delay') {
            ms = beginPostScoringBaseRevealDelay(ms, now);
        }
    }
    return { events, newBaseDeck, matchState: ms };
}

export function registerMultiBaseScoringInteractionHandler(): void {
    // `multi_base_scoring` 已由 ability runtime prompt 接管。
    // 保留该入口作为幂等初始化点，避免旧初始化流程重复注册第二条续链。
}

registerAbilityRuntimePrompt('multi_base_scoring', (state, _playerId, value) => {
    const { baseIndex } = value as { baseIndex?: number };
    if (baseIndex === undefined) {
        return { state, events: [] };
    }

    const baseRef = createScoringBaseRef(state.core, baseIndex);
    if (!baseRef) {
        return { state, events: [] };
    }

    const nextState = ensureScoreBasesSession(state);
    return {
        state: updateScoringSession(nextState, (session) => session
            ? {
                ...session,
                currentBaseRef: baseRef,
                currentStep: 'resolving-base',
            }
            : session,
        ),
        events: [],
    };
});

function applyEventsForStartTurnSimulation(
    core: SmashUpCore,
    events: SmashUpEvent[],
): SmashUpCore {
    let nextCore = core;
    for (const event of events) {
        const intercepted = domainInterceptEvent(nextCore, event);
        if (intercepted === null) continue;

        const appliedEvents = Array.isArray(intercepted) ? intercepted : [intercepted];
        for (const appliedEvent of appliedEvents) {
            nextCore = reduce(nextCore, appliedEvent);
        }
    }
    return nextCore;
}

function findMinionOnBaseByUid(
    core: SmashUpCore,
    minionUid: string,
): { baseIndex: number; minion: MinionOnBase } | undefined {
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const minion = core.bases[baseIndex].minions.find(entry => entry.uid === minionUid);
        if (minion) {
            return { baseIndex, minion };
        }
    }
    return undefined;
}

function keepSysUpdatesOnly(
    baseState: MatchState<SmashUpCore>,
    updatedState: MatchState<SmashUpCore>,
): MatchState<SmashUpCore> {
    if (updatedState.core === baseState.core) return updatedState;
    return {
        ...updatedState,
        core: baseState.core,
    };
}

function hasPendingPhaseReactionFrame(
    core: SmashUpCore,
    phase: GamePhase,
    state: MatchState<SmashUpCore>,
): boolean {
    const activeSession = getSmashUpReactionSession(state);
    if (activeSession) {
        if (phase === 'startTurn' && activeSession.frameId.startsWith('turn-start:')) {
            return true;
        }
        if (phase === 'endTurn' && activeSession.frameId.startsWith('turn-end:')) {
            return true;
        }
    }

    const framePrefix = phase === 'startTurn' ? 'turn-start:' : phase === 'endTurn' ? 'turn-end:' : '';
    if (!framePrefix) return false;

    return (core.triggerQueue ?? []).some(trigger => trigger.frameId?.startsWith(framePrefix));
}

function processImmediateStartTurnMinionTriggers(
    startTurnCore: SmashUpCore,
    events: SmashUpEvent[],
    currentPlayerId: PlayerId,
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    processedPlayedUids: Set<string> = new Set(),
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const finalEvents: SmashUpEvent[] = [];
    let simulatedCore = startTurnCore;
    let currentMatchState = matchState ? { ...matchState, core: startTurnCore } : undefined;

    for (const event of events) {
        finalEvents.push(event);
        simulatedCore = applyEventsForStartTurnSimulation(simulatedCore, [event]);
        if (currentMatchState) {
            currentMatchState = { ...currentMatchState, core: simulatedCore };
        }

        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const returnedEvent = event as SmashUpEvent & { payload: { minionUid: string } };
            processedPlayedUids.delete(returnedEvent.payload.minionUid);
            continue;
        }

        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const returnedEvent = event as SmashUpEvent & { payload: { cardUid: string } };
            processedPlayedUids.delete(returnedEvent.payload.cardUid);
            continue;
        }

        if (event.type !== SU_EVENTS.MINION_PLAYED) continue;

        const playedEvent = event as MinionPlayedEvent;
        if (playedEvent.payload.playerId !== currentPlayerId) continue;
        if (processedPlayedUids.has(playedEvent.payload.cardUid)) continue;
        processedPlayedUids.add(playedEvent.payload.cardUid);

        const playedMinion = findMinionOnBaseByUid(simulatedCore, playedEvent.payload.cardUid);
        if (!playedMinion || playedMinion.minion.controller !== currentPlayerId) continue;

        const immediateResult = fireTriggerForSource(
            simulatedCore,
            playedEvent.payload.defId,
            'onTurnStart',
            {
                state: simulatedCore,
                matchState: currentMatchState,
                playerId: currentPlayerId,
                baseIndex: playedMinion.baseIndex,
                triggerMinion: playedMinion.minion,
                triggerMinionUid: playedMinion.minion.uid,
                triggerMinionDefId: playedMinion.minion.defId,
                random,
                now: event.timestamp,
            },
        );

        if (immediateResult.matchState) {
            currentMatchState = { ...immediateResult.matchState, core: simulatedCore };
        }
        if (immediateResult.events.length === 0) continue;

        const processedImmediate = postProcessSystemEvents(
            simulatedCore,
            immediateResult.events,
            random,
            currentMatchState,
            { skipImmediateStartTurnMinionTriggers: true },
        );
        const processedImmediateMatchState = processedImmediate.matchState
            ? { ...processedImmediate.matchState, core: simulatedCore }
            : currentMatchState;

        const recursiveResult = processImmediateStartTurnMinionTriggers(
            simulatedCore,
            processedImmediate.events,
            currentPlayerId,
            random,
            processedImmediateMatchState,
            processedPlayedUids,
        );

        finalEvents.push(...recursiveResult.events);
        simulatedCore = applyEventsForStartTurnSimulation(simulatedCore, recursiveResult.events);
        if (recursiveResult.matchState) {
            currentMatchState = { ...recursiveResult.matchState, core: simulatedCore };
        } else if (currentMatchState) {
            currentMatchState = { ...currentMatchState, core: simulatedCore };
        }
    }

    return currentMatchState
        ? { events: finalEvents, matchState: currentMatchState }
        : { events: finalEvents };
}

function getPlayCardsContextForBuriedPlay(
    matchState: MatchState<SmashUpCore>,
    fromBuried: boolean | undefined,
): MatchState<SmashUpCore> {
    if (!fromBuried) return matchState;
    if (matchState.sys.phase !== 'startTurn' && !getSmashUpRuntimeSys(matchState)._smashupStartTurnWindowActive) {
        return matchState;
    }
    return {
        ...matchState,
        sys: {
            ...matchState.sys,
            phase: 'playCards',
        },
    };
}

// ============================================================================
// Setup
// ============================================================================

function isAiSeatControllerType(type: unknown): boolean {
    return type === 'local-ai' || type === 'remote-ai';
}

function getSetupBaseDefIds(enabledExpansions: readonly string[]): string[] {
    return getAllBaseDefIds().filter((defId) => isBaseDefAvailableForRuntimeBasePool(defId, enabledExpansions));
}

function setup(playerIds: PlayerId[], random: RandomFn, setupData?: Record<string, unknown>): SmashUpCore {
    const nextUid = 1;
    const runtimeSetup = readSmashUpRuntimeSetupConfig(setupData, { playerCount: playerIds.length });
    const { enabledExpansions, deckQueryEnabled, teamMode } = runtimeSetup;
    const seatOrder = [...playerIds];

    const players: Record<PlayerId, PlayerState> = {};
    const playerSelections: Record<PlayerId, string[]> = {};
    for (const pid of playerIds) {
        players[pid] = {
            id: pid,
            vp: 0,
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            factions: ['', ''],
        };
        playerSelections[pid] = [];
    }

    let shuffledBaseIds = random.shuffle(getSetupBaseDefIds(enabledExpansions));
    const baseCount = playerIds.length + 1;
    const activeBases: BaseInPlay[] = [];

    while (activeBases.length < baseCount && shuffledBaseIds.length > 0) {
        const defId = shuffledBaseIds.shift()!;
        const def = getBaseDef(defId);
        if (def?.replaceOnSetup) {
            shuffledBaseIds.push(defId);
            shuffledBaseIds = random.shuffle(shuffledBaseIds);
            continue;
        }
        activeBases.push({
            instanceId: createEntityId('smashup:base', activeBases.length + 1),
            defId,
            minions: [],
            ongoingActions: [],
        });
    }
    const baseDeck = shuffledBaseIds;

    let initialTurnOrder = [...playerIds];
    let hasExplicitTurnOrder = false;
    let hasExplicitFirstPlayer = false;
    if (
        Array.isArray(setupData?.turnOrder)
        && setupData.turnOrder.length === playerIds.length
        && setupData.turnOrder.every((id: unknown) => typeof id === 'string' && playerIds.includes(id as PlayerId))
    ) {
        initialTurnOrder = setupData.turnOrder as PlayerId[];
        hasExplicitTurnOrder = true;
    } else if (typeof setupData?.firstPlayerId === 'string' && playerIds.includes(setupData.firstPlayerId)) {
        const first = setupData.firstPlayerId;
        initialTurnOrder = [first, ...playerIds.filter(id => id !== first)];
        hasExplicitFirstPlayer = true;
    }

    if (!hasExplicitTurnOrder && !hasExplicitFirstPlayer) {
        const rawSeatControllers = setupData?.seatControllers;
        if (rawSeatControllers && typeof rawSeatControllers === 'object' && !Array.isArray(rawSeatControllers)) {
            const seatControllers = rawSeatControllers as Record<string, { type?: unknown } | undefined>;
            const hasAiSeat = initialTurnOrder.some((playerId) => isAiSeatControllerType(seatControllers[playerId]?.type));
            const hasHumanSeat = initialTurnOrder.some((playerId) => !isAiSeatControllerType(seatControllers[playerId]?.type));
            if (hasAiSeat && hasHumanSeat) {
                const firstHumanIndex = initialTurnOrder.findIndex(
                    (playerId) => !isAiSeatControllerType(seatControllers[playerId]?.type),
                );
                if (firstHumanIndex > 0) {
                    initialTurnOrder = [
                        ...initialTurnOrder.slice(firstHumanIndex),
                        ...initialTurnOrder.slice(0, firstHumanIndex),
                    ];
                }
            }
        }
    }

    return {
        players,
        seatOrder,
        turnOrder: initialTurnOrder,
        currentPlayerIndex: 0,
        teamMode,
        bases: activeBases,
        titans: [],
        enabledExpansions,
        deckQueryEnabled,
        baseDeck,
        baseDiscard: [],
        triggerQueue: undefined,
        turnNumber: 1,
        nextUid,
        nextBaseInstanceId: activeBases.length + 1,
        gameResult: undefined,
        factionSelection: {
            takenFactions: [],
            playerSelections,
            completedPlayers: [],
        },
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
    };
}

function normalizeSmashUpRuntimeObjectArray<T extends object>(
    value: T[] | null | undefined,
): T[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];

    let changed = false;
    const normalized: T[] = [];
    value.forEach((entry) => {
        if (entry && typeof entry === 'object') {
            normalized.push(entry);
            return;
        }
        changed = true;
    });

    return changed ? normalized : value;
}

function normalizeSmashUpRuntimeStringArray(
    value: string[] | null | undefined,
): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return undefined;

    let changed = false;
    const normalized: string[] = [];
    value.forEach((entry) => {
        if (typeof entry === 'string') {
            normalized.push(entry);
            return;
        }
        changed = true;
    });

    return changed ? normalized : value;
}

function normalizeSmashUpRuntimeMadnessDeck(
    value: SmashUpCore['madnessDeck'],
): SmashUpCore['madnessDeck'] {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];

    let changed = false;
    const normalized: string[] = [];
    value.forEach((entry) => {
        if (typeof entry === 'string') {
            normalized.push(entry);
            return;
        }
        if (entry && typeof entry === 'object' && typeof (entry as { defId?: unknown }).defId === 'string') {
            normalized.push((entry as { defId: string }).defId);
            changed = true;
            return;
        }
        changed = true;
    });

    return changed ? normalized : value;
}

function normalizeLegacySmashUpMatchState(
    state: MatchState<SmashUpCore>,
): MatchState<SmashUpCore> {
    const core = state.core;
    let changed = false;

    const normalizedPlayers = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => {
            const pendingMinionPlayEffects = normalizeSmashUpRuntimeObjectArray(
                player.pendingMinionPlayEffects,
            );
            const usedDiscardPlayAbilities = normalizeSmashUpRuntimeStringArray(
                player.usedDiscardPlayAbilities,
            );

            if (
                pendingMinionPlayEffects === player.pendingMinionPlayEffects
                && usedDiscardPlayAbilities === player.usedDiscardPlayAbilities
            ) {
                return [playerId, player];
            }

            changed = true;
            return [playerId, {
                ...player,
                pendingMinionPlayEffects,
                usedDiscardPlayAbilities,
            }];
        }),
    ) as SmashUpCore['players'];

    const normalizedBases = core.bases.map((base) => {
        const buriedCards = normalizeSmashUpRuntimeObjectArray(base.buriedCards);
        if (buriedCards === base.buriedCards) {
            return base;
        }
        changed = true;
        return {
            ...base,
            buriedCards,
        };
    });

    const normalizedMadnessDeck = normalizeSmashUpRuntimeMadnessDeck(core.madnessDeck);
    if (normalizedMadnessDeck !== core.madnessDeck) {
        changed = true;
    }

    const normalizedState = changed ? {
        ...state,
        core: {
            ...core,
            players: normalizedPlayers,
            bases: normalizedBases,
            madnessDeck: normalizedMadnessDeck,
        },
    } : state;

    return normalizeSmashUpMatchStateForUi(normalizedState);
}

export const smashUpFlowHooks: FlowHooks<SmashUpCore> = {
    initialPhase: 'factionSelect',

    getCurrentPlayerId({ state }): PlayerId {
        return getCurrentPlayerId(state.core);
    },

    getNextPhase({ from }): string {
        const idx = PHASE_ORDER.indexOf(from as GamePhase);
        if (idx === -1 || idx >= PHASE_ORDER.length - 1) {

            return 'startTurn';
        }
        return PHASE_ORDER[idx + 1];
    },

    getActivePlayerId({ state }): PlayerId {
        return getCurrentPlayerId(state.core);
    },

    onPhaseExit({ state, from, command, random }): GameEvent[] | PhaseExitResult {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const now = typeof command.timestamp === 'number' ? command.timestamp : 0;

        if (from === 'endTurn') {
            const resumedAfterTurnEndReactionResolution =
                !!state.sys.flowHalted
                && !state.sys.interaction?.current
                && !getSmashUpReactionSession(state)
                && !(state.core.triggerQueue ?? []).some(trigger => trigger.frameId?.startsWith('turn-end:'));

            if (resumedAfterTurnEndReactionResolution) {
                const advance = buildTurnEndAdvancePayload(core);
                return [{
                    type: SU_EVENTS.TURN_ENDED,
                    payload: { playerId: pid, ...advance },
                    timestamp: now,
                } as TurnEndedEvent];
            }

            const events: SmashUpEvent[] = [];
            let currentMatchState: MatchState<SmashUpCore> = state;
            let hasPendingTurnEndResolution = false;
            let hasQueuedTurnEndResolution = false;
            const turnEndFrameId = `turn-end:${pid}:${core.turnNumber}:${now}`;

            // 触发 onTurnEnd（与 startTurn 统一的入队时序）
            const queuedTurnEnd = collectTriggers(currentMatchState.core, 'onTurnEnd', {
                state: currentMatchState.core,
                matchState: currentMatchState,
                playerId: pid,
                frameId: turnEndFrameId,
                sourceEventId: turnEndFrameId,
                random,
                now,
            });
            for (let baseIndex = 0; baseIndex < currentMatchState.core.bases.length; baseIndex += 1) {
                const queuedBaseTurnEnd = collectBaseAbilityTriggers({
                    core: currentMatchState.core,
                    timing: 'onTurnEnd',
                    ownerPlayerId: pid,
                    baseIndex,
                    frameId: turnEndFrameId,
                    sourceEventId: turnEndFrameId,
                    now,
                });
                if (!queuedBaseTurnEnd) continue;
                hasQueuedTurnEndResolution = true;
                events.push(queuedBaseTurnEnd as unknown as SmashUpEvent);
                currentMatchState = {
                    ...currentMatchState,
                    core: reduce(currentMatchState.core, queuedBaseTurnEnd as unknown as SmashUpEvent),
                };
            }
            if (queuedTurnEnd) {
                hasQueuedTurnEndResolution = true;
                events.push(queuedTurnEnd);
                // Seed an explicit turn-end reaction frame so onTurnEnd follows the same Step 3/4 session model as startTurn.
                currentMatchState = {
                    ...currentMatchState,
                    core: reduce(currentMatchState.core, queuedTurnEnd as unknown as SmashUpEvent),
                };
            }

            if (hasQueuedTurnEndResolution) {
                currentMatchState = startSmashUpReactionSession(currentMatchState, {
                    frameId: turnEndFrameId,
                    frameKind: 'turn-end',
                });
                const rq = maybeResolveReactionQueue(currentMatchState, random, now);
                if (rq) {
                    // onTurnEnd 触发器可能产生 MINION_DESTROYED 等，需要经过 destroy→move 循环处理
                    const afterDestroyMove = processDestroyMoveCycle(rq.events, rq.state, pid, random, now);
                    events.push(...afterDestroyMove.events);
                    currentMatchState = afterDestroyMove.matchState ?? rq.state;
                }

                if (currentMatchState.sys.interaction?.current || getSmashUpReactionSession(currentMatchState)) {
                    hasPendingTurnEndResolution = true;
                }
            }

            // 鍒囨崲鍒颁笅涓€涓帺瀹?
            if (hasPendingTurnEndResolution) {
                return {
                    events,
                    halt: true,
                    updatedState: keepSysUpdatesOnly(state, currentMatchState),
                } as PhaseExitResult;
            }

            const advance = buildTurnEndAdvancePayload(core);
            const evt: TurnEndedEvent = {
                type: SU_EVENTS.TURN_ENDED,
                payload: { playerId: pid, ...advance },
                timestamp: now,
            };
            events.push(evt);
            return events;
        }

        if (from === 'scoreBases') {
            const events: SmashUpEvent[] = [];
            let currentState = ensureScoreBasesSession(state);

            if (currentState.sys.flowHalted) {
                if (currentState.sys.interaction.current) {
                    return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
                }
                const normalizedInteraction = currentState.sys.interaction?.current === null
                    ? { ...currentState.sys.interaction, current: undefined }
                    : currentState.sys.interaction;
                const normalizedResponseWindow = currentState.sys.responseWindow?.current === null
                    ? { ...currentState.sys.responseWindow, current: undefined }
                    : currentState.sys.responseWindow;
                currentState = {
                    ...currentState,
                    sys: {
                        ...currentState.sys,
                        flowHalted: false,
                        interaction: normalizedInteraction ?? currentState.sys.interaction,
                        responseWindow: normalizedResponseWindow ?? currentState.sys.responseWindow,
                    },
                };
            }

            const currentSession = getScoringSession(currentState);
            if (!currentSession) {
                return events;
            }

            if (getSmashUpReactionSession(currentState) || currentState.sys.interaction?.current) {
                return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
            }

            if (currentSession.currentStep === 'awaiting-post-reduce') {
                return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
            }

            if (currentSession.currentStep === 'awaiting-post-scoring-delay') {
                if (isPostScoringBaseRevealDelayActive(currentState, now)) {
                    return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
                }
                const finalized = finalizeCurrentScoringBase(clearPostScoringBaseRevealDelay(currentState), now);
                return { events: finalized.events, halt: true, updatedState: finalized.updatedState } as PhaseExitResult;
            }

            if (currentSession.currentBaseRef && (
                currentSession.currentStep === 'awaiting-interactions'
                || currentSession.currentStep === 'awaiting-response-window'
            )) {
                const delayedState = beginPostScoringBaseRevealDelay(currentState, now);
                if (!isPostScoringBaseRevealDelayActive(delayedState, now)) {
                    const finalized = finalizeCurrentScoringBase(clearPostScoringBaseRevealDelay(delayedState), now);
                    return { events: finalized.events, halt: true, updatedState: finalized.updatedState } as PhaseExitResult;
                }
                return { events: [], halt: true, updatedState: delayedState } as PhaseExitResult;
            }

            if (!currentSession.currentBaseRef) {
                const remainingBaseRefs = getRemainingScoringBaseRefs(currentState);

                if (remainingBaseRefs.length === 0) {
                    const cleanedState = clearScoringSession(currentState);
                    events.push({
                        type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
                        payload: {},
                        timestamp: now,
                    } as SmashUpEvent);
                    events.push({
                        type: SU_EVENT_TYPES.WHEN_SCORING_CLEARED,
                        payload: {},
                        timestamp: now,
                    } as SmashUpEvent);
                    events.push({
                        type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
                        payload: {},
                        timestamp: now,
                    } as SmashUpEvent);
                    return { events, updatedState: cleanedState } as PhaseExitResult;
                }

                if (remainingBaseRefs.length > 1) {
                    const currentIsMultiBaseScoring =
                        (currentState.sys.interaction.current?.data as { sourceId?: string } | undefined)?.sourceId === 'multi_base_scoring';
                    const hasMultiBaseScoringInQueue = currentState.sys.interaction.queue.some(
                        (interaction: { data?: { sourceId?: string } }) => interaction.data?.sourceId === 'multi_base_scoring',
                    );
                    if (!currentIsMultiBaseScoring && !hasMultiBaseScoringInQueue) {
                        const interaction = buildMultiBaseScoringInteraction(currentState, pid, now, remainingBaseRefs);
                        if (interaction) {
                            return {
                                events: [],
                                halt: true,
                                updatedState: queueInteraction(currentState, interaction),
                            } as PhaseExitResult;
                        }
                    }
                    return { events: [], halt: true, updatedState: currentState } as PhaseExitResult;
                }

                currentState = updateScoringSession(currentState, (session) => session
                    ? {
                        ...session,
                        currentBaseRef: remainingBaseRefs[0],
                        currentStep: 'resolving-base',
                    }
                    : session,
                );
            }

            const activeBaseRef = getScoringSession(currentState)?.currentBaseRef;
            const activeBaseIndex = resolveScoringBaseRefSlotIndex(currentState, activeBaseRef);
            if (!activeBaseRef || activeBaseIndex === undefined) {
                if (activeBaseRef) {
                    const missingBaseState = updateScoringSession(
                        markScoringBaseCompleted(currentState, activeBaseRef),
                        (session) => session ? { ...session, currentStep: 'awaiting-post-reduce' } : session,
                    );
                    return {
                        events: [],
                        halt: true,
                        updatedState: {
                            ...missingBaseState,
                            sys: {
                                ...missingBaseState.sys,
                                _waitForPostScoringReduce: true,
                            } as typeof missingBaseState.sys,
                        },
                    } as PhaseExitResult;
                }
                return events;
            }

            const preScoreCore = currentState.core;
            const result = scoreOneBase(
                currentState.core,
                activeBaseIndex,
                currentState.core.baseDeck,
                pid,
                now,
                random,
                currentState,
            );
            const nextState = result.matchState ?? currentState;
            // scoreOneBase / reaction queue 会在 matchState.core 上做内部 reduce 以便继续计算。
            // 但这些领域事件同时会通过 result.events 交给 pipeline 再 reduce 一次。
            // 这里必须把 updatedState.core 回退到“事件应用前”快照，避免 VP/计数类效果双重结算。
            const pipelineReadyState = result.events.length > 0
                ? { ...nextState, core: preScoreCore }
                : nextState;

            if (pipelineReadyState.sys.interaction?.current || getSmashUpReactionSession(pipelineReadyState)) {
                return { events: result.events, halt: true, updatedState: pipelineReadyState } as PhaseExitResult;
            }

            if (getScoringSession(pipelineReadyState)?.currentStep === 'awaiting-post-scoring-delay') {
                return { events: result.events, halt: true, updatedState: pipelineReadyState } as PhaseExitResult;
            }

            const completedState = updateScoringSession(
                markScoringBaseCompleted(pipelineReadyState, activeBaseRef),
                (session) => session ? { ...session, currentStep: 'awaiting-post-reduce' } : session,
            );
            return {
                events: result.events,
                halt: true,
                updatedState: {
                    ...completedState,
                    sys: {
                        ...completedState.sys,
                        _waitForPostScoringReduce: true,
                    } as typeof completedState.sys,
                },
            } as PhaseExitResult;
        }

        return [];
    },

    onPhaseEnter({ state, from, to, random, command, exitEvents }): GameEvent[] | PhaseEnterResult {
        let core = state.core;
        const pid = getCurrentPlayerId(core);
        const now = typeof command.timestamp === 'number' ? command.timestamp : 0;
        const events: GameEvent[] = [];

        let currentMatchState: MatchState<SmashUpCore> = state;
        let hasSysUpdate = false;

        if (to === 'startTurn') {
            let nextPlayerId = pid;
            let nextTurnNumber = core.turnNumber;
            let nextPlayerIndex = core.currentPlayerIndex;
            if (from === 'endTurn') {
                const turnEndedEvent = exitEvents?.find(event => event.type === SU_EVENTS.TURN_ENDED) as TurnEndedEvent | undefined;
                const nextIndex = turnEndedEvent?.payload.nextPlayerIndex
                    ?? ((core.currentPlayerIndex + 1) % core.turnOrder.length);
                nextPlayerId = core.turnOrder[nextIndex];
                nextPlayerIndex = nextIndex;
                if (nextIndex === 0) {
                    nextTurnNumber = core.turnNumber + 1;
                }
            }
            if (from === 'endTurn' && nextPlayerIndex !== core.currentPlayerIndex) {
                currentMatchState = {
                    ...currentMatchState,
                    core: {
                        ...currentMatchState.core,
                        currentPlayerIndex: nextPlayerIndex,
                    },
                };
                core = currentMatchState.core;
                hasSysUpdate = true;
            }
            currentMatchState = {
                ...currentMatchState,
                sys: {
                    ...currentMatchState.sys,
                    _smashupStartTurnWindowActive: true,
                } as SmashUpRuntimeSystemState,
            };
            hasSysUpdate = true;
            const turnStarted: TurnStartedEvent = {
                type: SU_EVENTS.TURN_STARTED,
                payload: {
                    playerId: nextPlayerId,
                    turnNumber: nextTurnNumber,
                },
                timestamp: now,
            };
            events.push(turnStarted);
            const startTurnCore = reduce(core, turnStarted);
            currentMatchState = { ...currentMatchState, core: startTurnCore };

            const startTurnTriggeredEvents: SmashUpEvent[] = [];
            const startTurnFrameId = `turn-start:${nextPlayerId}:${nextTurnNumber}:${now}`;

            // 触发基地 onTurnStart 能力（入队，按 Wiki 同时触发顺序处理）
            for (let baseIndex = 0; baseIndex < currentMatchState.core.bases.length; baseIndex++) {
                const queuedBase = collectBaseAbilityTriggers({
                    core: currentMatchState.core,
                    timing: 'onTurnStart',
                    ownerPlayerId: nextPlayerId,
                    baseIndex,
                    frameId: startTurnFrameId,
                    sourceEventId: startTurnFrameId,
                    now,
                });
                if (!queuedBase) continue;
                startTurnTriggeredEvents.push(queuedBase as unknown as SmashUpEvent);
                currentMatchState = {
                    ...currentMatchState,
                    core: reduce(currentMatchState.core, queuedBase as unknown as SmashUpEvent),
                };
                hasSysUpdate = true;
            }

            // 触发 ongoing onTurnStart（入队，按 Wiki 同时触发顺序处理）
            const queuedTurnStart = collectTriggers(currentMatchState.core, 'onTurnStart', {
                state: currentMatchState.core,
                matchState: currentMatchState,
                playerId: nextPlayerId,
                frameId: startTurnFrameId,
                sourceEventId: startTurnFrameId,
                random,
                now,
            });
            if (queuedTurnStart) {
                startTurnTriggeredEvents.push(queuedTurnStart);
                currentMatchState = {
                    ...currentMatchState,
                    core: reduce(currentMatchState.core, queuedTurnStart as unknown as SmashUpEvent),
                };
                hasSysUpdate = true;
            }

            if (startTurnTriggeredEvents.length > 0) {
                events.push(...startTurnTriggeredEvents);
                currentMatchState = startSmashUpReactionSession(currentMatchState, {
                    frameId: startTurnFrameId,
                    frameKind: 'turn-start',
                });
                const rq = maybeResolveReactionQueue(currentMatchState, random, now);
                if (rq) {
                    hasSysUpdate = hasSysUpdate || rq.state.sys !== currentMatchState.sys;
                    currentMatchState = rq.state;
                    events.push(...rq.events);
                }
            }

            const coreForUncover = currentMatchState.core;
            const buriedChoices: { cardUid: string; baseIndex: number; label: string }[] = [];
            for (let bi = 0; bi < coreForUncover.bases.length; bi++) {
                const b = coreForUncover.bases[bi];
                const buried = (b.buriedCards ?? []).filter(c => c.controllerId === nextPlayerId);
                for (const bc of buried) {
                    const def = getCardDef(bc.defId);
                    buriedChoices.push({
                        cardUid: bc.uid,
                        baseIndex: bi,
                        label: `${def?.name ?? bc.defId} @ ${(getBaseDef(b.defId)?.name ?? ('基地 #' + (bi + 1)))}`,
                    });
                }
            }
            if (buriedChoices.length > 0) {
                const options: PromptOption<{ cardUid: string; baseIndex: number } | { skip: true }>[] = buriedChoices.map((c, i) => ({
                    id: `u-${i}`,
                    label: c.label,
                    value: { cardUid: c.cardUid, baseIndex: c.baseIndex },
                    displayMode: 'button' as const,
                }));
                options.push({
                    id: 'skip',
                    label: '跳过（不揭开）',
                    labelKey: 'ui.bury_uncover_start_turn_skip_option',
                    value: { skip: true },
                    displayMode: 'button' as const,
                });
                const interaction = createSimpleChoice(
                    `bury_uncover_start_turn_${now}`,
                    nextPlayerId,
                    '你可以揭开一张你控制的埋葬牌，并立刻作为额外牌打出',
                    options,
                    {
                        sourceId: 'bury_uncover_start_turn',
                        targetType: 'generic',
                        autoRefresh: 'buried',
                        responseValidationMode: 'live',
                        titleKey: 'ui.bury_uncover_start_turn_title',
                    },
                );
                currentMatchState = queueInteraction(currentMatchState, interaction);
                hasSysUpdate = true;
            }

            if (hasSysUpdate) {
                return {
                    events,
                    updatedState: keepSysUpdatesOnly(state, currentMatchState),
                } as PhaseEnterResult;
            }
            return events;
        }

        if (to === 'scoreBases') {
            events.push({
                type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as GameEvent);
            events.push({
                type: SU_EVENT_TYPES.WHEN_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as GameEvent);
            events.push({
                type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as GameEvent);

            const eligibleIndices = getScoringEligibleBaseIndices(core);
            currentMatchState = eligibleIndices.length > 0
                ? setScoringSession(currentMatchState, createScoringSession(core, eligibleIndices))
                : clearScoringSession(currentMatchState);
            hasSysUpdate = true;

            if (eligibleIndices.length > 0) {
                events.push({
                    type: SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED,
                    payload: { baseIndices: eligibleIndices },
                    timestamp: now,
                } as GameEvent);
            }

            return { events, updatedState: currentMatchState } as PhaseEnterResult;
        }

        if (to === 'draw') {
            if (from === 'scoreBases' && exitEvents && exitEvents.length > 0) {
                core = exitEvents.reduce(
                    (currentCore, event) => reduce(currentCore, event as SmashUpEvent),
                    core,
                );
            }
            const player = core.players[pid];
            if (player) {
                const { drawnUids, reshuffledDeckUids } = drawCards(player, DRAW_PER_TURN, random);
                if (drawnUids.length > 0) {
                    if (reshuffledDeckUids && reshuffledDeckUids.length > 0) {
                        const reshuffleEvt: DeckReshuffledEvent = {
                            type: SU_EVENTS.DECK_RESHUFFLED,
                            payload: { playerId: pid, deckUids: reshuffledDeckUids },
                            timestamp: now,
                        };
                        events.push(reshuffleEvt);
                    }
                    const drawEvt: CardsDrawnEvent = {
                        type: SU_EVENTS.CARDS_DRAWN,
                        payload: { playerId: pid, count: drawnUids.length, cardUids: drawnUids },
                        timestamp: now,
                    };
                    events.push(drawEvt);
                }
            }
        }

        if (to === 'playCards' && from === 'startTurn' && getSmashUpRuntimeSys(state)._smashupStartTurnWindowActive) {
            return {
                events: [
                    ...events,
                    ...collectPhaseTwoOngoingExtraEvents(state.core, getCurrentPlayerId(state.core), now),
                ],
                updatedState: {
                    ...state,
                    sys: {
                        ...state.sys,
                        _smashupStartTurnWindowActive: undefined,
                        _waitForStartTurnInteractionReduce: undefined,
                    } as SmashUpRuntimeSystemState,
                },
            } as PhaseEnterResult;
        }

        if (to === 'playCards') {
            events.push(...collectPhaseTwoOngoingExtraEvents(state.core, getCurrentPlayerId(state.core), now));
        }

        return events;
    },

    onAutoContinueCheck({ state, events }): { autoContinue: boolean; playerId: PlayerId } | void {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const phase = state.sys.phase as GamePhase;
        const isFactionDraftReadyToStart = core.turnOrder.length > 0 && core.turnOrder.every((playerId) => {
            const player = core.players[playerId];
            const factions = Array.isArray(player?.factions) ? player.factions : [];
            const hand = Array.isArray(player?.hand) ? player.hand : [];
            const deck = Array.isArray(player?.deck) ? player.deck : [];
            return Boolean(
                player
                && factions.length === 2
                && (hand.length > 0 || deck.length > 0),
            );
        });
        const justResolvedSmashUpReactionChoice = events.some((event) => {
            if (event.type !== 'SYS_INTERACTION_RESOLVED' && event.type !== 'SYS_INTERACTION_CANCELLED') {
                return false;
            }
            const payload = event.payload as { sourceId?: unknown } | undefined;
            return payload?.sourceId === 'smashup_reaction_choose';
        });

        const hasLiveScoringOrReactionFrame = Boolean(
            getSmashUpReactionSession(state)
            || getScoringSession(state)?.currentBaseRef,
        );

        // factionSelect -> startTurn 不应被起手重抽 Prompt 卡住。
        // 选秀完成后先离开选秀阶段，后续再由 startTurn 等待重抽交互收口。
        if (phase === 'factionSelect') {
            if (!core.factionSelection) {
                return isFactionDraftReadyToStart ? { autoContinue: true, playerId: pid } : undefined;
            }
        }

        if (state.sys.interaction?.current) {
            return undefined;
        }

        // startTurn 鑷姩鎺ㄨ繘鍒?playCards
        if (phase === 'startTurn') {
            if (hasLiveScoringOrReactionFrame) {
                return undefined;
            }
            if (getSmashUpRuntimeSys(state)._waitForStartTurnInteractionReduce) {
                return undefined;
            }
            if (justResolvedSmashUpReactionChoice && getSmashUpRuntimeSys(state)._waitForStartTurnInteractionReduce) {
                return undefined;
            }
            if (hasPendingPhaseReactionFrame(core, phase, state)) {
                return undefined;
            }
            return { autoContinue: true, playerId: pid };
        }

        if (phase === 'scoreBases') {
            if (isPostScoringBaseRevealDelayActive(state, Date.now())) {
                return undefined;
            }
            if (getSmashUpReactionSession(state)) {
                return undefined;
            }
            if (getSmashUpReactionWindowContext(state)) {
                return undefined;
            }
            if (getSmashUpRuntimeSys(state)._waitForScoreBasesInteractionReduce) {
                return undefined;
            }

            if (getSmashUpRuntimeSys(state)._waitForPostScoringReduce) {
                return undefined;
            }

            const scoringSession = getScoringSession(state);
            if (scoringSession?.currentStep === 'awaiting-post-reduce') {
                if (getSmashUpRuntimeSys(state)._waitForPostScoringReduce) {
                    return { autoContinue: true, playerId: pid };
                }
                return undefined;
            }

            if (state.sys.flowHalted && !state.sys.interaction.current) {
                return { autoContinue: true, playerId: pid };
            }

            if (scoringSession) {
                const hasRemainingWork = !!scoringSession.currentBaseRef || getRemainingScoringBaseRefs(state).length > 0;
                if (hasRemainingWork) {
                    return { autoContinue: true, playerId: pid };
                }
                return { autoContinue: true, playerId: pid };
            }

            const eligibleIndices = getLockedScoringBaseIndices(core);
            if (eligibleIndices.length === 0) {
                return { autoContinue: true, playerId: pid };
            }

            return { autoContinue: true, playerId: pid };
        }

        if (phase === 'draw') {
            if (hasLiveScoringOrReactionFrame) {
                return undefined;
            }
            const player = core.players[pid];
            if (player && player.hand.length <= HAND_LIMIT) {
                return { autoContinue: true, playerId: pid };
            }
        }

        if (phase === 'endTurn') {
            if (hasLiveScoringOrReactionFrame) {
                return undefined;
            }
            if (justResolvedSmashUpReactionChoice) {
                return undefined;
            }
            if (hasPendingPhaseReactionFrame(core, phase, state)) {
                return undefined;
            }
            return { autoContinue: true, playerId: pid };
        }
    },
};

// ============================================================================

const HIDDEN_PRIVATE_CARD_DEF_ID = 'hidden_private_card';

function maskPrivateCard(ownerId: PlayerId, zone: 'hand' | 'deck' | 'stored', index: number): CardInstance {
    return {
        uid: `hidden_${ownerId}_${zone}_${index}`,
        defId: HIDDEN_PRIVATE_CARD_DEF_ID,
        type: 'action',
        owner: ownerId,
    };
}

function maskStoredCard(ownerId: PlayerId, index: number): StoredCardInstance {
    return {
        ...maskPrivateCard(ownerId, 'stored', index),
        storedByPlayerId: ownerId,
        reason: HIDDEN_PRIVATE_CARD_DEF_ID,
    };
}

function maskPlayerPrivateZones(player: PlayerState, playerId: PlayerId): PlayerState {
    if (player.id === playerId) return player;
    return {
        ...player,
        hand: player.hand.map((_, index) => maskPrivateCard(player.id, 'hand', index)),
        deck: player.deck.map((_, index) => maskPrivateCard(player.id, 'deck', index)),
        storedCards: player.storedCards?.map((_, index) => maskStoredCard(player.id, index)),
    };
}

// ============================================================================

function playerView(state: SmashUpCore, playerId: PlayerId): Partial<SmashUpCore> {

    const maskedBases = state.bases.map(b => {
        if (!b.buriedCards || b.buriedCards.length === 0) return b;
        return {
            ...b,
            buriedCards: b.buriedCards.map(c => {
                if (c.controllerId === playerId) return c;
                return {
                    uid: c.uid,
                    defId: 'buried_unknown',
                    trueOwnerId: c.trueOwnerId,
                    controllerId: c.controllerId,
                    buriedFrom: c.buriedFrom,
                };
            }),
        };
    });
    const maskedPlayers = Object.fromEntries(
        Object.entries(state.players).map(([id, player]) => [
            id,
            maskPlayerPrivateZones(player, playerId),
        ]),
    ) as SmashUpCore['players'];
    return { bases: maskedBases, players: maskedPlayers };
}

// ============================================================================
// isGameOver
// ============================================================================

function isGameOver(state: SmashUpCore): GameOverResult | undefined {
    if (state.gameResult) return state.gameResult;
    if (state.turnPhase && state.turnPhase !== 'draw' && state.turnPhase !== 'endTurn') return undefined;

    if (isSmashUpTwoVsTwoMode(state)) {
        const rawTeamTotals = getSmashUpRawTeamVpTotals(state);
        const candidateTeams = Object.entries(rawTeamTotals)
            .filter(([, total]) => total >= TEAM_VP_TO_WIN_2V2)
            .map(([teamId]) => teamId as import('./types').SmashUpTeamId);
        if (candidateTeams.length === 0) {
            return undefined;
        }

        const scores = getScores(state);
        const teamScores = getSmashUpTeamScores(state, scores);

        if (candidateTeams.length === 1) {
            const winners = getSmashUpTeamMembers(state, candidateTeams[0]);
            return {
                winner: winners[0],
                winners,
                scores,
            };
        }

        const sortedTeams = [...candidateTeams].sort((left, right) => teamScores[right] - teamScores[left]);
        if (teamScores[sortedTeams[0]] > teamScores[sortedTeams[1]]) {
            const winners = getSmashUpTeamMembers(state, sortedTeams[0]);
            return {
                winner: winners[0],
                winners,
                scores,
            };
        }

        return undefined;
    }

    if (isSmashUpTwoVsTwoMode(state)) {
        const rawTeamTotals = getSmashUpRawTeamVpTotals(state);
        const candidateTeams = Object.entries(rawTeamTotals)
            .filter(([, total]) => total >= TEAM_VP_TO_WIN_2V2)
            .map(([teamId]) => teamId as import('./types').SmashUpTeamId);
        if (candidateTeams.length === 0) {
            return undefined;
        }

        const scores = getScores(state);
        const teamScores = getSmashUpTeamScores(state, scores);

        if (candidateTeams.length === 1) {
            const winners = getSmashUpTeamMembers(state, candidateTeams[0]);
            return {
                winner: winners[0],
                winners,
                scores,
            };
        }

        const sortedTeams = [...candidateTeams].sort((left, right) => teamScores[right] - teamScores[left]);
        if (teamScores[sortedTeams[0]] > teamScores[sortedTeams[1]]) {
            const winners = getSmashUpTeamMembers(state, sortedTeams[0]);
            return {
                winner: winners[0],
                winners,
                scores,
            };
        }

        return undefined;
    }
    const winners = state.turnOrder.filter(pid => state.players[pid]?.vp >= VP_TO_WIN);
    if (winners.length === 0) return undefined;

    // 璁＄畻鍚柉鐙傚崱鎯╃綒鐨勬渶缁堝垎鏁?
    const scores = getScores(state);

    if (winners.length === 1) {
        return { winner: winners[0], scores };
    }

    const sorted = winners.sort((a, b) => scores[b] - scores[a]);
    if (scores[sorted[0]] > scores[sorted[1]]) {
        return { winner: sorted[0], scores };
    }

    if (state.madnessDeck !== undefined) {
        const madnessA = countMadnessCardsForPlayer(state, sorted[0]);
        const madnessB = countMadnessCardsForPlayer(state, sorted[1]);
        if (madnessA !== madnessB) {
            return { winner: madnessA < madnessB ? sorted[0] : sorted[1], scores };
        }
    }

    return undefined;
}

export function getScores(state: SmashUpCore): Record<PlayerId, number> {
    const scores: Record<PlayerId, number> = {};
    for (const pid of state.turnOrder) {
        const player = state.players[pid];
        if (!player) continue;
        let vp = player.vp;

        if (state.madnessDeck !== undefined) {
            vp -= madnessVpPenalty(countMadnessCardsForPlayer(state, pid));
        }
        scores[pid] = vp;
    }
    return scores;
}

// ============================================================================

// ============================================================================

function domainInterceptEvent(
    state: SmashUpCore,
    event: SmashUpEvent
): SmashUpEvent | SmashUpEvent[] | null {
    const result = ongoingInterceptEvent(state, event);
    if (result !== undefined) return result;
    return event;
}

function resolveTitanClashEventsOnBase(
    state: SmashUpCore,
    baseIndex: number,
    now: number,
    challengerTitanUid?: string,
    matchState?: MatchState<SmashUpCore>,
    spiritOfForestVisitedBaseIndices: number[] = [],
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const base = state.bases[baseIndex];
    const baseDef = base ? getBaseDef(base.defId) : undefined;
    if (!base || baseDef?.allowMultipleTitans) return { events: [], matchState };

    const titansOnBase = getTitansOnBase(state, baseIndex);
    if (titansOnBase.length <= 1) return { events: [], matchState };

    const challenger = challengerTitanUid
        ? titansOnBase.find(titan => titan.uid === challengerTitanUid)
        : titansOnBase[titansOnBase.length - 1];
    if (!challenger) return { events: [], matchState };

    const defender = titansOnBase.find(titan => titan.uid !== challenger.uid);
    if (!defender) return { events: [], matchState };

    const challengerPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, challenger.controllerId);
    const defenderPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, defender.controllerId);
    const loser = challengerPower > defenderPower ? defender : challenger;

    if (
        loser.defId === 'fairies_spirit_of_the_forest'
        && loser.location.zone === 'base'
        && matchState
    ) {
        const visitedBaseIndices = new Set(spiritOfForestVisitedBaseIndices);
        const otherBases = state.bases
            .map((candidateBase, index) => ({
                baseIndex: index,
                label: getBaseDef(candidateBase.defId)?.name ?? `基地 ${index + 1}`,
            }))
            .filter(candidate => candidate.baseIndex !== loser.location.baseIndex);
        if (otherBases.length > 0) {
            const baseTargetOptions = buildBaseTargetOptions(otherBases, state).map(option => {
                if (!visitedBaseIndices.has(option.value.baseIndex)) return option;
                return {
                    ...option,
                    _ai: {
                        ...(option._ai ?? {}),
                        tags: [...(option._ai?.tags ?? []), 'spirit-of-forest-clash-chain-visited-base'],
                        effectIntent: 'move' as const,
                        targetKind: 'base' as const,
                        forcedTargetPolicy: 'must-avoid' as const,
                        priorityHint: -120,
                        derivedFrom: 'inferred' as const,
                    },
                };
            });
            const interaction = createSimpleChoice(
                `titan_fairies_spirit_of_the_forest_clash_move_${now}`,
                loser.controllerId,
                '丛林之灵：你可以改为将其移动到另一个基地',
                [
                    {
                        id: 'skip',
                        label: '照常移除',
                        labelKey: 'ui.titan_fairies_spirit_of_the_forest_clash_move_skip_option',
                        value: { skip: true },
                        displayMode: 'button' as const,
                    },
                    ...baseTargetOptions,
                ],
                {
                    sourceId: 'titan_fairies_spirit_of_the_forest_clash_move',
                    targetType: 'base',
                    autoResolveIfSingle: false,
                    titleKey: 'ui.titan_fairies_spirit_of_the_forest_clash_move_title',
                },
            );
            return {
                events: [],
                matchState: queueInteraction(matchState, {
                    ...interaction,
                    data: {
                        ...interaction.data,
                        continuationContext: {
                            titanUid: loser.uid,
                            fromBaseIndex: loser.location.baseIndex,
                            visitedBaseIndices: [...visitedBaseIndices],
                        },
                    },
                }),
            };
        }
    }

    return {
        events: [removeTitanFromPlay(loser, 'titan_clash', now)],
        matchState,
    };
}

function shouldDeferTitanClashForEvent(
    state: SmashUpCore,
    event: SmashUpEvent,
    baseIndex: number,
): boolean {
    if (!state.activeDuel || state.activeDuel.baseIndex !== baseIndex) return false;
    if (event.type !== SU_EVENT_TYPES.TITAN_PLAYED && event.type !== SU_EVENT_TYPES.TITAN_MOVED) return false;

    const titan = getTitanByUid(state, event.payload.titanUid);
    return titan?.defId === 'pecos_bill'
        && titan.location.zone === 'base'
        && titan.location.baseIndex === baseIndex
        && titan.metadata?.deferClashUntilDuelEnds === true;
}

function resolveTitanClashEvents(
    state: SmashUpCore,
    event: SmashUpEvent,
    matchState?: MatchState<SmashUpCore>,
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (event.type !== SU_EVENT_TYPES.TITAN_PLAYED && event.type !== SU_EVENT_TYPES.TITAN_MOVED) {
        return { events: [], matchState };
    }

    const baseIndex = event.type === SU_EVENT_TYPES.TITAN_PLAYED
        ? event.payload.baseIndex
        : event.payload.toBaseIndex;
    if (shouldDeferTitanClashForEvent(state, event, baseIndex)) {
        return { events: [], matchState };
    }

    const spiritOfForestVisitedBaseIndices = event.type === SU_EVENT_TYPES.TITAN_MOVED
        && Array.isArray(event.payload.metadata?.spiritOfTheForestClashVisitedBaseIndices)
        ? event.payload.metadata.spiritOfTheForestClashVisitedBaseIndices
            .filter((value): value is number => typeof value === 'number')
        : [];

    return resolveTitanClashEventsOnBase(
        state,
        baseIndex,
        event.timestamp ?? 0,
        event.payload.titanUid,
        matchState,
        spiritOfForestVisitedBaseIndices,
    );
}

function resolveDeferredPecosBillClashEvents(
    state: SmashUpCore,
    now: number,
    matchState?: MatchState<SmashUpCore>,
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (state.activeDuel) return { events: [], matchState };

    const events: SmashUpEvent[] = [];
    let workingState = state;
    let workingMatchState = matchState;
    const processedBases = new Set<number>();
    const deferredTitans = (state.titans ?? []).filter((titan) =>
        titan.defId === 'pecos_bill'
        && titan.location.zone === 'base'
        && titan.metadata?.deferClashUntilDuelEnds === true,
    );

    for (const titan of deferredTitans) {
        if (titan.location.zone !== 'base' || processedBases.has(titan.location.baseIndex)) continue;
        processedBases.add(titan.location.baseIndex);

        const clashResult = resolveTitanClashEventsOnBase(
            workingState,
            titan.location.baseIndex,
            now,
            titan.uid,
            workingMatchState,
        );
        if (clashResult.matchState) {
            workingMatchState = clashResult.matchState;
        }
        if (clashResult.events.length > 0) {
            events.push(...clashResult.events);
            for (const clashEvent of clashResult.events) {
                workingState = reduce(workingState, clashEvent);
            }
        }

        const pecosAfterClash = getTitanByUid(workingState, titan.uid);
        if (pecosAfterClash?.location.zone === 'base' && pecosAfterClash.metadata?.deferClashUntilDuelEnds === true) {
            const clearedEvent: SmashUpEvent = {
                type: SU_EVENTS.TITAN_METADATA_UPDATED,
                payload: {
                    titanUid: pecosAfterClash.uid,
                    metadataUpdate: { deferClashUntilDuelEnds: false },
                    reason: 'pecos_bill_duel_end',
                },
                timestamp: now,
            };
            events.push(clearedEvent);
            workingState = reduce(workingState, clearedEvent);
        }
    }

    return { events, matchState: workingMatchState };
}

// ============================================================================

// ============================================================================

function postProcessSystemEvents(
    state: SmashUpCore,
    events: SmashUpEvent[],
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    options?: { skipImmediateStartTurnMinionTriggers?: boolean },
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {

    const now = events.length > 0 && typeof events[0].timestamp === 'number' ? events[0].timestamp : 0;
    // 当前玩家作为 trigger 的 sourcePlayerId
    let pid = getCurrentPlayerId(state);
    const turnStartedEvent = [...events].reverse().find(event => event.type === SU_EVENTS.TURN_STARTED) as TurnStartedEvent | undefined;
    if (turnStartedEvent) {
        pid = turnStartedEvent.payload.playerId;
    }

    let ms = matchState ?? createReactionQueueFallbackState(state);
    const inputEventsAlreadyReduced = !!getSmashUpRuntimeSys(ms)._ppseInputEventsReduced;
    if (inputEventsAlreadyReduced) {
        ms = {
            ...ms,
            sys: {
                ...ms.sys,
                _ppseInputEventsReduced: undefined,
            } as typeof ms.sys,
        };
    }

    const destroySys = getSmashUpRuntimeSys(ms);
    if (!destroySys._processedDestroyEvents || !(destroySys._processedDestroyEvents instanceof Set)) {
        destroySys._processedDestroyEvents = new Set<string>();
    }
    const processedDestroyEventKeys = destroySys._processedDestroyEvents;
    const destroyEventKeysInBatch = new Set<string>();
    for (const event of events) {
        if (event.type === SU_EVENTS.MINION_DESTROYED) {
            destroyEventKeysInBatch.add(buildDestroyEventKey(event as MinionDestroyedEvent));
        }
    }
    // 如果输入事件已在 execute 阶段完成 destroy→move→affect 链，
    // 则这些 MINION_DESTROYED 不应在 PPSE 再次触发（避免 onDestroy 重复结算）。
    // 通过提前写入去重集合，让本轮 processDestroyMoveCycle 跳过。
    if (inputEventsAlreadyReduced) {
        for (const key of destroyEventKeysInBatch) {
            processedDestroyEventKeys.add(key);
        }
    }

    // 渚濇鎵ц淇濇姢杩囨护 + trigger 鍚庡鐞嗭紙閾惧紡浼犻€?matchState锛?
    // destroy 鈫?move 寰幆鐩村埌绋冲畾锛坢ove 瑙﹀彂鍣ㄥ彲鑳戒骇鐢熸柊鐨?MINION_DESTROYED锛?
    const afterDestroyMove = processDestroyMoveCycle(events, ms, pid, random, now, {
        skipDestroyEventKeys: processedDestroyEventKeys,
    });
    if (afterDestroyMove.matchState) ms = afterDestroyMove.matchState;
    const afterReturnToHand = processReturnToHandTriggers(afterDestroyMove.events, ms, pid, random, now);
    if (afterReturnToHand.matchState) ms = afterReturnToHand.matchState;
    // 杩斿洖鎵嬬墝/鏀剧墝搴撳簳淇濇姢杩囨护锛堜笌 execute() 鍚庡鐞嗗榻愶級
    const afterProtectedAffect = filterProtectedAffectEvents(afterReturnToHand.events, ms.core, pid);
    const afterAffect = processAffectTriggers(afterProtectedAffect, ms, pid, random, now);
    if (afterAffect.matchState) ms = afterAffect.matchState;
    const afterDeckInspection = processDeckInspectionTriggers(afterAffect.events, ms, pid, random, now);
    if (afterDeckInspection.matchState) ms = afterDeckInspection.matchState;

    for (const key of destroyEventKeysInBatch) {
        processedDestroyEventKeys.add(key);
    }

    // 先 reduce 到临时 core 中，让 fireMinionPlayedTriggers 拿到最新的牌库/手牌状态。
    // 必须防止同一 MINION_PLAYED 事件被重复处理。去重策略：

    const derivedEvents: SmashUpEvent[] = [];

    const prePlayEvents: SmashUpEvent[] = [];
    
    // 鍒濆鍖栧凡澶勭悊浜嬩欢闆嗗悎锛堝鏋滀笉瀛樺湪锛?
    // 浣跨敤 any 绫诲瀷鏂█缁曡繃 SystemState 绫诲瀷闄愬埗锛堣繖鏄父鎴忕壒瀹氱殑涓存椂鐘舵€侊級
    // 銆怐45 淇銆戠粺涓€澶勭悊 MINION_PLAYED 鍜?ACTION_PLAYED 鐨勫幓閲?
    const sysState = getSmashUpRuntimeSys(ms);
    if (!sysState._processedPlayedEvents || !(sysState._processedPlayedEvents instanceof Set)) {
        sysState._processedPlayedEvents = new Set<string>();
    }
    const processedSet = sysState._processedPlayedEvents;
    
    // 【修复】清理返回手牌的随从的去重标记
    // 当随从返回手牌后再次打出时，应该重新触发 onPlay 能力
    for (const event of afterDeckInspection.events) {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const returnedEvt = event as { type: string; payload: { minionUid: string; fromBaseIndex: number } };
            const eventKey = `MINION:${returnedEvt.payload.minionUid}@${returnedEvt.payload.fromBaseIndex}`;
            processedSet.delete(eventKey);
        }
        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const returnedEvt = event as { type: string; payload: { cardUid: string; baseIndex: number } };
            const eventKey = `MINION:${returnedEvt.payload.cardUid}@${returnedEvt.payload.baseIndex}`;
            processedSet.delete(eventKey);
        }
    }
    
    for (const event of afterDeckInspection.events) {
        if (event.type === SU_EVENTS.VP_AWARDED) {
            const vpEvt = event as VpAwardedEvent;
            let tempCore = state;
            for (const preEvt of prePlayEvents) {
                tempCore = reduce(tempCore, preEvt);
            }
            if (!inputEventsAlreadyReduced) {
                tempCore = reduce(tempCore, event);
            }
            const sourceEventId = `vp-awarded:${vpEvt.payload.playerId}:${event.timestamp}`;
            const frameId = `vp-awarded-frame:${vpEvt.payload.playerId}:${event.timestamp}`;
            const queued = collectTriggers(tempCore, 'onVpAwarded', {
                state: tempCore,
                matchState: tempCore === ms.core ? ms : { ...ms, core: tempCore },
                playerId: vpEvt.payload.playerId,
                vpAmount: vpEvt.payload.amount,
                reason: vpEvt.payload.reason,
                frameId,
                sourceEventId,
                random,
                now: event.timestamp,
            });
            if (queued) {
                derivedEvents.push(queued);
                ms = queued.matchState ?? ms;
            }
            prePlayEvents.push(event);
        } else if (event.type === SU_EVENTS.BASE_SCORED) {
            const scoreEvt = event as BaseScoredEvent;
            let tempCore = state;
            for (const preEvt of prePlayEvents) {
                tempCore = reduce(tempCore, preEvt);
            }
            if (!inputEventsAlreadyReduced) {
                tempCore = reduce(tempCore, event);
            }
            for (const ranking of scoreEvt.payload.rankings) {
                if (ranking.vp <= 0) continue;
                const sourceEventId = `base-scored-vp:${scoreEvt.payload.baseIndex}:${ranking.playerId}:${event.timestamp}`;
                const frameId = `base-scored-vp-frame:${scoreEvt.payload.baseIndex}:${ranking.playerId}:${event.timestamp}`;
                const queued = collectTriggers(tempCore, 'onVpAwarded', {
                    state: tempCore,
                    matchState: tempCore === ms.core ? ms : { ...ms, core: tempCore },
                    playerId: ranking.playerId,
                    vpAmount: ranking.vp,
                    reason: 'base_scored',
                    baseIndex: scoreEvt.payload.baseIndex,
                    frameId,
                    sourceEventId,
                    random,
                    now: event.timestamp,
                });
                if (queued) {
                    derivedEvents.push(queued);
                    ms = queued.matchState ?? ms;
                    tempCore = queued.matchState?.core ?? tempCore;
                }
            }
            prePlayEvents.push(event);
        } else if (event.type === SU_EVENTS.CARDS_DISCARDED || event.type === SU_EVENTS.CARDS_MILLED) {
            const discardEvt = event as { type: string; payload: { playerId: PlayerId; cardUids: string[] }; timestamp: number };
            const tempCore = prePlayEvents.reduce((acc, preEvt) => reduce(acc, preEvt), state);
            const sourceZone = event.type === SU_EVENTS.CARDS_MILLED ? 'deck' : 'hand';
            const sourceCards = sourceZone === 'deck'
                ? tempCore.players[discardEvt.payload.playerId]?.deck ?? []
                : tempCore.players[discardEvt.payload.playerId]?.hand ?? [];
            const uidSet = new Set(discardEvt.payload.cardUids);
            const discardedCards = sourceCards
                .filter(card => uidSet.has(card.uid))
                .map(card => ({ uid: card.uid, defId: card.defId, ownerId: card.owner }));
            const queued = collectTriggers(tempCore, 'onCardsDiscarded', {
                state: tempCore,
                matchState: ms,
                playerId: discardEvt.payload.playerId,
                discardedCards,
                discardedFromZone: sourceZone,
                frameId: `cards-discarded-frame:${event.type}:${discardEvt.payload.playerId}:${event.timestamp}`,
                sourceEventId: `cards-discarded:${event.type}:${discardEvt.payload.playerId}:${event.timestamp}`,
                random,
                now: event.timestamp,
            });
            if (queued) {
                derivedEvents.push(queued);
            }
            prePlayEvents.push(event);
        } else if (event.type === SU_EVENTS.MINION_PLAYED) {
            const playedEvt = event as MinionPlayedEvent;
            

            const eventKey = `MINION:${playedEvt.payload.cardUid}@${playedEvt.payload.baseIndex}`;
            

            if (processedSet.has(eventKey)) {
                prePlayEvents.push(event);
                continue;
            }
            
            // 标记为已处理
            processedSet.add(eventKey);
            
            // 将之前积累的事件 reduce 到临时 core

            let tempCore = state;
            for (const preEvt of prePlayEvents) {
                tempCore = reduce(tempCore, preEvt);
            }

            const payload = event.payload;
            if (!inputEventsAlreadyReduced) {
                tempCore = reduce(tempCore, event);
            } else if (payload.fromDeck || payload.fromDiscard || payload.fromBuried) {
                tempCore = reduce(tempCore, event);
            }
            
            const triggers = fireMinionPlayedTriggers({
                core: tempCore,
                matchState: getPlayCardsContextForBuriedPlay(ms, playedEvt.payload.fromBuried),
                playerId: payload.playerId,
                cardUid: payload.cardUid,
                defId: payload.defId,
                baseIndex: payload.baseIndex,
                power: payload.power,
                random,
                now: event.timestamp,
                playedEvt: event as MinionPlayedEvent,
            });
            derivedEvents.push(...triggers.events);
            if (triggers.matchState) ms = triggers.matchState;
        } else if (event.type === SU_EVENTS.ACTION_PLAYED) {
            // ACTION_PLAYED 事件也要去重，防止 action onPlay 被重复触发
            // 典型场景：传送门创建交互后，pipeline 重新进入 postProcessSystemEvents
            const playedEvt = event as ActionPlayedEvent & {
                payload: ActionPlayedEvent['payload'] & {
                    targetBaseIndex?: number;
                    targetType?: 'base' | 'minion';
                    targetMinionUid?: string;
                };
            };
            

            const eventKey = `ACTION:${playedEvt.payload.cardUid}@${playedEvt.payload.playerId}`;
            

            if (processedSet.has(eventKey)) {
                prePlayEvents.push(event);
                continue;
            }
            
            // 标记为已处理
            processedSet.add(eventKey);
            
            // ACTION_PLAYED 的 onActionPlayed 触发：基底/ongoing 同步入队
            let tempCore = ms.core;
            let tempMatchState = ms;
            const sourceEventId = `action-played:${playedEvt.payload.cardUid}:${event.timestamp}`;
            const frameId = `action-played-frame:${playedEvt.payload.cardUid}:${event.timestamp}`;

            const targetBaseWasReplacedByThisAction = playedEvt.payload.targetBaseIndex !== undefined
                && afterDeckInspection.events.some(candidate => {
                    if (candidate.type !== SU_EVENTS.BASE_REPLACED) return false;
                    const replaced = candidate as BaseReplacedEvent;
                    return replaced.timestamp === event.timestamp
                        && replaced.payload.baseIndex === playedEvt.payload.targetBaseIndex;
                });

            if (playedEvt.payload.targetBaseIndex !== undefined && !targetBaseWasReplacedByThisAction) {
                const queuedBase = collectBaseAbilityTriggers({
                    core: tempCore,
                    timing: 'onActionPlayed',
                    ownerPlayerId: playedEvt.payload.playerId,
                    baseIndex: playedEvt.payload.targetBaseIndex,
                    actionTargetBaseIndex: playedEvt.payload.targetBaseIndex,
                    actionTargetType: playedEvt.payload.targetType,
                    actionTargetMinionUid: playedEvt.payload.targetMinionUid,
                    triggerCardUid: playedEvt.payload.cardUid,
                    triggerCardDefId: playedEvt.payload.defId,
                    triggerCardOwnerId: playedEvt.payload.ownerId ?? playedEvt.payload.playerId,
                    frameId,
                    sourceEventId,
                    now: event.timestamp,
                });
                if (queuedBase) {
                    derivedEvents.push(queuedBase as unknown as SmashUpEvent);
                    tempCore = reduce(tempCore, queuedBase as unknown as SmashUpEvent);
                    tempMatchState = { ...tempMatchState, core: tempCore };
                }

                const queuedExtendedBase = collectExtendedBaseAbilityTriggers({
                    core: tempCore,
                    timing: 'onActionPlayed',
                    ownerPlayerId: playedEvt.payload.playerId,
                    baseIndex: playedEvt.payload.targetBaseIndex,
                    reason: 'action-played',
                    actionTargetBaseIndex: playedEvt.payload.targetBaseIndex,
                    actionTargetType: playedEvt.payload.targetType,
                    actionTargetMinionUid: playedEvt.payload.targetMinionUid,
                    triggerCardUid: playedEvt.payload.cardUid,
                    triggerCardDefId: playedEvt.payload.defId,
                    triggerCardOwnerId: playedEvt.payload.ownerId ?? playedEvt.payload.playerId,
                    frameId,
                    sourceEventId,
                    now: event.timestamp,
                });
                if (queuedExtendedBase) {
                    derivedEvents.push(queuedExtendedBase as unknown as SmashUpEvent);
                    tempCore = reduce(tempCore, queuedExtendedBase as unknown as SmashUpEvent);
                    tempMatchState = { ...tempMatchState, core: tempCore };
                }
            }

            const queuedActionTriggers = collectTriggers(tempCore, 'onActionPlayed', {
                state: tempCore,
                matchState: getPlayCardsContextForBuriedPlay(tempMatchState, playedEvt.payload.fromBuried),
                playerId: playedEvt.payload.playerId,
                baseIndex: playedEvt.payload.targetBaseIndex,
                actionTargetBaseIndex: playedEvt.payload.targetBaseIndex,
                actionTargetType: playedEvt.payload.targetType,
                actionTargetMinionUid: playedEvt.payload.targetMinionUid,
                triggerCardUid: playedEvt.payload.cardUid,
                triggerCardDefId: playedEvt.payload.defId,
                triggerCardOwnerId: playedEvt.payload.ownerId ?? playedEvt.payload.playerId,
                frameId,
                sourceEventId,
                random,
                now: event.timestamp,
            });
            if (queuedActionTriggers) {
                derivedEvents.push(queuedActionTriggers);
                tempCore = reduce(tempCore, queuedActionTriggers);
                tempMatchState = { ...tempMatchState, core: tempCore };
            }

            ms = tempMatchState;
            prePlayEvents.push(event);
        } else {
            prePlayEvents.push(event);
        }
    }

    let finalDerived = derivedEvents;
    if (derivedEvents.length > 0) {
        for (const event of derivedEvents) {
            if (event.type === SU_EVENTS.MINION_DESTROYED) {
                destroyEventKeysInBatch.add(buildDestroyEventKey(event as MinionDestroyedEvent));
            }
        }
        const afterDerivedDestroyMove = processDestroyMoveCycle(derivedEvents, ms, pid, random, now, {
            skipDestroyEventKeys: processedDestroyEventKeys,
        });
        if (afterDerivedDestroyMove.matchState) ms = afterDerivedDestroyMove.matchState;
        const afterDerivedReturnToHand = processReturnToHandTriggers(afterDerivedDestroyMove.events, ms, pid, random, now);
        if (afterDerivedReturnToHand.matchState) ms = afterDerivedReturnToHand.matchState;
        // 杩斿洖鎵嬬墝/鏀剧墝搴撳簳淇濇姢杩囨护锛堜笌 execute() 鍚庡鐞嗗榻愶級
        const afterDerivedProtectedAffect = filterProtectedAffectEvents(afterDerivedReturnToHand.events, ms.core, pid);
        const afterDerivedAffect = processAffectTriggers(afterDerivedProtectedAffect, ms, pid, random, now);
        if (afterDerivedAffect.matchState) ms = afterDerivedAffect.matchState;
        const afterDerivedDeckInspection = processDeckInspectionTriggers(afterDerivedAffect.events, ms, pid, random, now);
        if (afterDerivedDeckInspection.matchState) ms = afterDerivedDeckInspection.matchState;
        finalDerived = afterDerivedDeckInspection.events;
    }

    const combined = [...afterDeckInspection.events, ...finalDerived];
    const alreadyReducedEventCount = inputEventsAlreadyReduced ? afterDeckInspection.events.length : 0;

    const talentDerived: SmashUpEvent[] = [];
    let talentCore = state;
    for (let eventIndex = 0; eventIndex < combined.length; eventIndex++) {
        const event = combined[eventIndex];
        if (eventIndex >= alreadyReducedEventCount) {
            talentCore = reduce(talentCore, event);
        }
        if (event.type !== SU_EVENTS.TALENT_USED) continue;
        const talentEvent = event as TalentUsedEvent;
        const { playerId, minionUid, defId, baseIndex } = talentEvent.payload;
        if (!minionUid) continue;
        const triggerMinion = talentCore.bases[baseIndex]?.minions.find(minion => minion.uid === minionUid);
        const sourceEventId = `onTalentUsed:${minionUid}:${event.timestamp}`;
        const queuedTalentTriggers = collectTriggers(talentCore, 'onTalentUsed', {
            state: talentCore,
            matchState: talentCore === ms.core ? ms : { ...ms, core: talentCore },
            playerId,
            baseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: defId,
            triggerMinion,
            frameId: sourceEventId,
            sourceEventId,
            random,
            now: event.timestamp,
        });
        if (queuedTalentTriggers) {
            talentDerived.push(queuedTalentTriggers);
            talentCore = reduce(talentCore, queuedTalentTriggers);
        }
        const queuedBaseTalent = collectBaseAbilityTriggers({
            core: talentCore,
            timing: 'onTalentUsed',
            ownerPlayerId: playerId,
            baseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: defId,
            triggerMinionPower: triggerMinion?.basePower,
            frameId: sourceEventId,
            sourceEventId,
            now: event.timestamp,
        });
        if (queuedBaseTalent) {
            talentDerived.push(queuedBaseTalent as unknown as SmashUpEvent);
            talentCore = reduce(talentCore, queuedBaseTalent as unknown as SmashUpEvent);
        }
    }
    const combinedWithTalent = [...combined, ...talentDerived];

    // 泰坦位置事件后处理：标准基地双泰坦自动 clash。
    // 使用 sys 上的去重集合，避免 pipeline 多次调用 postProcessSystemEvents 时重复追加同一批 clash 结果。
    const titanSys = getSmashUpRuntimeSys(ms);
    if (!titanSys._processedTitanPositionEvents || !(titanSys._processedTitanPositionEvents instanceof Set)) {
        titanSys._processedTitanPositionEvents = new Set<string>();
    }
    const processedTitanPositionEvents = titanSys._processedTitanPositionEvents;
    if (!titanSys._processedTitanRemovedEvents || !(titanSys._processedTitanRemovedEvents instanceof Set)) {
        titanSys._processedTitanRemovedEvents = new Set<string>();
    }
    const processedTitanRemovedEvents = titanSys._processedTitanRemovedEvents;

    const titanDerived: SmashUpEvent[] = [];
    let titanCore = state;
    for (let eventIndex = 0; eventIndex < combinedWithTalent.length; eventIndex++) {
        const event = combinedWithTalent[eventIndex];
        // state 已经包含了本轮原始领域事件（afterDeckInspection.events）的 reduce 结果；
        // 这里只需要把新增的派生事件继续 reduce 进临时 core，避免原始事件被重复结算。
        if (eventIndex >= alreadyReducedEventCount) {
            titanCore = reduce(titanCore, event);
        }
        if (
            event.type !== SU_EVENT_TYPES.TITAN_PLAYED
            && event.type !== SU_EVENT_TYPES.TITAN_MOVED
            && event.type !== SU_EVENT_TYPES.TITAN_REMOVED_FROM_PLAY
        ) continue;

        if (event.type === SU_EVENT_TYPES.TITAN_PLAYED || event.type === SU_EVENT_TYPES.TITAN_MOVED) {
            const eventBaseIndex = event.type === SU_EVENT_TYPES.TITAN_PLAYED
                ? event.payload.baseIndex
                : event.payload.toBaseIndex;
            const eventKey = `${event.type}:${event.payload.titanUid}@${eventBaseIndex}`;
            if (processedTitanPositionEvents.has(eventKey)) continue;
            processedTitanPositionEvents.add(eventKey);

            const clashResult = resolveTitanClashEvents(
                titanCore,
                event,
                titanCore === ms.core ? ms : { ...ms, core: titanCore },
            );
            if (clashResult.matchState) {
                ms = clashResult.matchState;
            }
            if (clashResult.events.length > 0) {
                titanDerived.push(...clashResult.events);
                for (const clashEvent of clashResult.events) {
                    titanCore = reduce(titanCore, clashEvent);
                }
            }
        }

        if (event.type === SU_EVENT_TYPES.TITAN_MOVED) {
            const movedTitan = getTitanByUid(titanCore, event.payload.titanUid);
            if (movedTitan?.location.zone === 'base' && movedTitan.location.baseIndex === event.payload.toBaseIndex) {
                const queuedTitanMove = collectTriggers(titanCore, 'onTitanMoved', {
                    state: titanCore,
                    matchState: ms,
                    playerId: movedTitan.controllerId,
                    baseIndex: event.payload.toBaseIndex,
                    reason: event.payload.reason,
                    random,
                    now,
                });
                if (queuedTitanMove) {
                    titanDerived.push(queuedTitanMove);
                    titanCore = reduce(titanCore, queuedTitanMove);
                }
            }
        }

        if (event.type === SU_EVENT_TYPES.TITAN_REMOVED_FROM_PLAY) {
            const eventKey = `${event.type}:${event.payload.titanUid}:${event.payload.reason}:${event.payload.fromBaseIndex ?? 'none'}`;
            if (processedTitanRemovedEvents.has(eventKey)) continue;
            processedTitanRemovedEvents.add(eventKey);

            const queuedTitanRemoved = collectTriggers(titanCore, 'onTitanRemovedFromPlay', {
                state: titanCore,
                matchState: ms,
                playerId: event.payload.controllerId,
                baseIndex: event.payload.fromBaseIndex,
                sourceEventId: `titan-removed:${event.payload.titanUid}:${eventIndex}:${now}`,
                frameId: `titan-removed-frame:${event.payload.titanUid}:${eventIndex}:${now}`,
                sourceCardUid: event.payload.titanUid,
                sourceDefId: event.payload.defId,
                sourceBaseIndex: event.payload.fromBaseIndex,
                sourceControllerId: event.payload.controllerId,
                sourceOwnerPlayerId: event.payload.ownerId,
                random,
                now,
            }, { sourceDefIds: [event.payload.defId] });
            if (queuedTitanRemoved) {
                titanDerived.push(queuedTitanRemoved);
                titanCore = reduce(titanCore, queuedTitanRemoved);
            }
        }
    }

    const deferredClashResult = resolveDeferredPecosBillClashEvents(
        titanCore,
        now,
        titanCore === ms.core ? ms : { ...ms, core: titanCore },
    );
    if (deferredClashResult.matchState) {
        ms = deferredClashResult.matchState;
    }
    if (deferredClashResult.events.length > 0) {
        titanDerived.push(...deferredClashResult.events);
        for (const deferredEvent of deferredClashResult.events) {
            titanCore = reduce(titanCore, deferredEvent);
        }
    }

    let finalEvents = [...combinedWithTalent, ...titanDerived];
    const immediateExtraEvents = finalEvents.filter((event): event is LimitModifiedEvent =>
        event.type === SU_EVENTS.LIMIT_MODIFIED && event.payload.playTiming === 'immediate',
    );
    if (immediateExtraEvents.length > 0) {
        const msForImmediateExtra = titanCore === ms.core ? ms : { ...ms, core: titanCore };
        ms = queueImmediateExtraPlayInteractions(msForImmediateExtra, immediateExtraEvents);
    }

    // === Global reaction queue resolution (Wiki simultaneous ordering) ===
    // Important: the resolver must see the latest temporary core, including
    // movement/position events that happened in this post-process pass.
    // Otherwise a queued trigger like onTitanMoved still executes against the
    // old base position and silently fizzles.
    const msForQueue = titanCore === ms.core ? ms : { ...ms, core: titanCore };

    const rq = maybeResolveReactionQueue(msForQueue, random, now);
    if (rq) {
        finalEvents = [...finalEvents, ...rq.events];
        ms = rq.state;
    }

    const startTurnWindowActive = ms.sys.phase === 'startTurn' || Boolean(getSmashUpRuntimeSys(ms)._smashupStartTurnWindowActive);
    if (!options?.skipImmediateStartTurnMinionTriggers && startTurnWindowActive) {
        const immediate = processImmediateStartTurnMinionTriggers(
            state,
            finalEvents,
            pid,
            random,
            ms,
        );
        finalEvents = immediate.events;
        if (immediate.matchState) {
            ms = immediate.matchState;
        }
    }

    const hasStartTurnInteraction =
        !!ms.sys.interaction?.current
        || (ms.sys.interaction?.queue?.length ?? 0) > 0;

    const activeResolutionFrame = getActiveResolutionFrame(ms);
    const isActualStartTurnWindow = activeResolutionFrame?.kind === 'smashup:reaction:turn-start'
        || (activeResolutionFrame?.metadata as { smashupReactionSession?: { frameKind?: string } } | undefined)?.smashupReactionSession?.frameKind === 'turn-start';
    if (getSmashUpRuntimeSys(ms)._smashupStartTurnWindowActive && hasStartTurnInteraction && ms.sys.phase !== 'startTurn' && isActualStartTurnWindow) {
        ms = {
            ...ms,
            sys: {
                ...ms.sys,
                phase: 'startTurn',
            },
        };
    }

    if (getSmashUpRuntimeSys(ms)._smashupStartTurnWindowActive && !hasStartTurnInteraction) {
        ms = {
            ...ms,
            sys: {
                ...ms.sys,
                _smashupStartTurnWindowActive: undefined,
                _waitForStartTurnInteractionReduce: undefined,
            } as SmashUpRuntimeSystemState,
        };
    }

    ms = queueActionReturnToHandPrompts(ms, finalEvents, now);

    return { events: finalEvents, matchState: ms };
}

registerSmashUpReactionPostProcessor(postProcessSystemEvents);

// ============================================================================
// 棰嗗煙鍐呮牳瀵煎嚭
// ============================================================================

export const SmashUpDomain: DomainCore<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
    gameId: 'smashup',
    setup,
    normalizeRuntimeState: normalizeLegacySmashUpMatchState,
    validate,
    execute,
    reduce,
    interceptEvent: domainInterceptEvent,
    postProcessSystemEvents,
    playerView,
    isGameOver,
};

export type { SmashUpCommand, SmashUpCore, SmashUpEvent } from './types';
export { SU_COMMANDS, SU_EVENTS } from './types';
export {
    DEFAULT_SMASHUP_TEAM_MODE,
    SMASHUP_TEAM_IDS,
    SMASHUP_TEAM_MODE_OPTIONS,
    getSmashUpSeatOrder,
    getSmashUpTeamIdForPlayer,
    getSmashUpTeamMembers,
    getSmashUpTeamScores,
    getSmashUpVictoryTarget,
    getSmashUpRawTeamVpTotals,
    isSmashUpTwoVsTwoMode,
    readSmashUpTeamMode,
} from './teamMode';
export { registerAbility, resolveAbility, resolveOnPlay, resolveTalent, resolveSpecial, resolveOngoingActivation, resolveOnDestroy, clearRegistry } from './abilityRegistry';
export type { AbilityContext, AbilityResult, AbilityExecutor } from './abilityRegistry';
export {
    registerBaseAbility,
    triggerBaseAbility,
    triggerAllBaseAbilities,
    hasBaseAbility,
    clearBaseAbilityRegistry,
    registerBaseAbilities,
    triggerExtendedBaseAbility,
} from './baseAbilities';
export type { BaseTriggerTiming, BaseAbilityContext, BaseAbilityResult, BaseAbilityExecutor } from './baseAbilities';
export {
    registerPowerModifier,
    clearPowerModifierRegistry,
    getOngoingPowerModifier,
    getEffectivePower,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
} from './ongoingModifiers';
export type { PowerModifierFn, PowerModifierContext } from './ongoingModifiers';

// Export postProcessSystemEvents for tests
export { postProcessSystemEvents };
