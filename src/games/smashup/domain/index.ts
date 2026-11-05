
import { type SmashUpCore, type SmashUpEvent, type BaseInPlay, SU_EVENTS, type TriggerQueuedEvent, type TurnEndedEvent, getCurrentPlayerId, type MunchkinTreasureRewardDistributedEvent, type BaseClearedEvent, type BaseDeckShuffledEvent, type BaseReplacedEvent, type BaseScoredEvent, type AbilityFeedbackEvent, SU_EVENT_TYPES, type SpecialAfterScoringConsumedEvent, type MinionPowerBreakdown, type MunchkinTreasureRewardRevealedEvent, type StoredCardInstance, type GamePhase, type PlayerState, PHASE_ORDER, type TurnStartedEvent, type LimitModifiedEvent, DRAW_PER_TURN, type DeckReshuffledEvent, type CardsDrawnEvent, HAND_LIMIT, type CardInstance, type SmashUpCommand } from './types';
import type { PlayerId, MatchState, RandomFn, GameEvent, GameOverResult, DomainCore } from '../../../engine/types';
import { grantExtraAction, grantExtraMinion, buildBaseTargetOptions, grantImmediateExtraPlayForStoredCard, countMadnessCardsForPlayer, madnessVpPenalty } from './abilityHelpers';
import { getPlayerEffectivePowerOnBase, getRealtimeScoringEligibleBaseIndices, getTotalEffectivePowerOnBase, getEffectiveBreakpoint, getEffectivePowerBreakdown } from './ongoingModifiers';
import { hasSmashUpResponderDrivenReactionOptions, getSmashUpReactionSession, startSmashUpReactionSession, registerSmashUpReactionPostProcessor } from './reactionSession';
import { EARLY_SCORING_CLEANUP_DISCARD_TRIGGER_UIDS_KEY, finalizeCurrentScoringBase } from './scoringFinalization';
import { getModifiedBaseVp, hasRegisteredTrigger, collectTriggers, isBaseScoringSuppressed, interceptEvent as ongoingInterceptEvent } from './ongoingEffects';
import { getScoringSession, setScoringSession, createScoringSession, createScoringBaseRef, type SmashUpScoringBaseRef, isSameScoringBaseRef, updateScoringSession, resolveScoringBaseRefSlotIndex, getDeferredPostScoringEvents, appendScoringFrameDeferredPayload, serializePostScoringEvents, getRemainingScoringBaseRefs, clearScoringSession, markScoringBaseCompleted } from './scoringSession';
import { getBaseDef, getAllBaseDefIds, isBaseDefAvailableForRuntimeBasePool, getCardDef } from '../data/cards';
import { type PromptOption, queueInteraction, createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { createAbilityRuntimeSimpleChoice, registerAbilityRuntimePrompt } from './abilityRuntime';
import { maybeResolveReactionQueue } from './reactionQueue';
import { collectBaseAbilityTriggers } from './baseAbilityQueue';
import { getMunchkinSpecialCardDescriptor } from '../data/factions/munchkin';
import { readSmashUpRuntimeSetupConfig } from '../roomSetup';
import { createEntityId } from '../../../engine/primitives';
import { buildSmashUpPlayerCandidatePools, buildSmashUpSharedCandidatePool, getSmashUpSelectableFactionIds, resolveSmashUpSupportedBanPolicy, getSmashUpInitialFactionSelectionPhase } from './pregameDraft';
import type { FlowHooks, PhaseExitResult, PhaseEnterResult } from '../../../engine/systems/FlowSystem';
import { applyTriggerQueueFactEvent } from './triggerQueueFacts';
import { processDestroyMoveCycle } from './eventFamilies';
import { type SmashUpRuntimeSystemState, getSmashUpRuntimeSys, postProcessSystemEvents, prepareSmashUpEventBatch } from './eventSettlement';
import { reduceTurnStartedEvent, reduce } from './reduce';
import { queueImmediateExtraPlayInteractions } from './extraPlay';
import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent';
import { drawCards } from './utils';
import { getSmashUpReactionWindowContext } from './reactionWindowState';
import { getSmashUpVictoryTarget, isSmashUpTwoVsTwoMode, getSmashUpRawTeamVpTotals, getSmashUpTeamScores, getSmashUpTeamMembers } from './teamMode';
import { statePersistence } from './statePersistence';
import { validate } from './commands';
import { execute, planSmashUpCommand } from './commandPlan';
import { discoverSmashUpTimingOpportunities } from './timingOpportunities';

export { postProcessSystemEvents, prepareSmashUpEventBatch } from './eventSettlement';

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

function getPlayersWithPlayableAfterScoringResponses(
    state: MatchState<SmashUpCore>,
    sourceBaseIndex: number,
    now: number,
): PlayerId[] {
    const playablePlayers: PlayerId[] = [];

    for (const playerId of Object.keys(state.core.players) as PlayerId[]) {
        const player = state.core.players[playerId];
        if (!player) continue;

        const probeSession = {
            frameId: `afterScoring_probe_${playerId}_${now}`,
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: playerId,
            currentPlayerId: playerId,
            consecutivePasses: 0,
            passedPlayerIds: [],
            sourceBaseIndex,
            responseWindowType: 'afterScoring',
        } as const;

        if (hasSmashUpResponderDrivenReactionOptions(state, probeSession, now)) {
            playablePlayers.push(playerId);
        }
    }

    return playablePlayers;
}

function getEarlyScoringCleanupDiscardTriggerUids(state: MatchState<SmashUpCore>): Set<string> {
    const raw = (state.sys as Record<string, unknown>)[EARLY_SCORING_CLEANUP_DISCARD_TRIGGER_UIDS_KEY];
    return new Set(Array.isArray(raw) ? raw.filter((uid): uid is string => typeof uid === 'string') : []);
}

function markEarlyScoringCleanupDiscardTriggerUids(
    state: MatchState<SmashUpCore>,
    triggerUids: string[],
): MatchState<SmashUpCore> {
    if (triggerUids.length === 0) return state;
    const existing = getEarlyScoringCleanupDiscardTriggerUids(state);
    for (const uid of triggerUids) {
        existing.add(uid);
    }
    return {
        ...state,
        sys: {
            ...state.sys,
            [EARLY_SCORING_CLEANUP_DISCARD_TRIGGER_UIDS_KEY]: [...existing],
        } as typeof state.sys,
    };
}

function getQueuedTriggerMinionUids(eventsToInspect: SmashUpEvent[]): string[] {
    return eventsToInspect.flatMap((event) => {
        if (event.type !== SU_EVENTS.TRIGGER_QUEUED) return [];
        const triggers = (event as TriggerQueuedEvent).payload.triggers;
        if (!Array.isArray(triggers)) return [];
        return triggers
            .map((trigger) => trigger.triggerMinionUid)
            .filter((uid: unknown): uid is string => typeof uid === 'string');
    });
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

        const awardSlot = index;
        const printedVp = awardSlot < 3 ? (baseDef.vpAwards[awardSlot] ?? 0) : 0;

        for (let i = index; i <= groupEnd; i += 1) {
            const playerId = sorted[i][0];
            rankings.push({
                playerId,
                power,
                vp: getModifiedBaseVp(core, baseIndex, playerId, printedVp),
            });
        }

        index = groupEnd + 1;
    }

    return rankings;
}

function getLockedScoringBaseIndices(core: SmashUpCore): number[] {
    return getRealtimeScoringEligibleBaseIndices(core);
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

function refreshPendingScoringBaseRefs(state: MatchState<SmashUpCore>): MatchState<SmashUpCore> {
    const session = getScoringSession(state);
    if (!session || session.currentBaseRef) {
        return state;
    }
    const liveRefs = getRealtimeScoringEligibleBaseIndices(state.core)
        .map((baseIndex) => createScoringBaseRef(state.core, baseIndex))
        .filter((baseRef): baseRef is SmashUpScoringBaseRef => !!baseRef)
        .filter((baseRef) => !session.completedBaseRefs.some((completedRef) => isSameScoringBaseRef(completedRef, baseRef)));

    return updateScoringSession(state, (currentSession) => currentSession
        ? {
            ...currentSession,
            lockedBaseRefs: liveRefs,
        }
        : currentSession);
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

function buildDeferredPostScoringEvents(input: {
    updatedCore: SmashUpCore;
    scoringBase: BaseInPlay;
    base: BaseInPlay;
    baseIndex: number;
    newBaseDeck: string[];
    now: number;
    random?: RandomFn;
}): { postScoringEvents: SmashUpEvent[]; newBaseDeck: string[] } {
    const {
        updatedCore,
        scoringBase,
        base,
        baseIndex,
        now,
        random,
    } = input;
    let newBaseDeck = [...(updatedCore.baseDeck ?? input.newBaseDeck)];
    const postScoringEvents: SmashUpEvent[] = [];

    if (updatedCore.pendingMunchkinTreasureReward) {
        const distributeTreasureRewardEvt: MunchkinTreasureRewardDistributedEvent = {
            type: SU_EVENTS.MUNCHKIN_TREASURE_REWARD_DISTRIBUTED,
            payload: {
                baseIndex,
                ...(scoringBase.instanceId ? { baseInstanceId: scoringBase.instanceId } : {}),
                reason: 'munchkin_scoring_treasure_reward',
            },
            timestamp: now,
        };
        postScoringEvents.push(distributeTreasureRewardEvt);
    }

    const clearEvt: BaseClearedEvent = {
        type: SU_EVENTS.BASE_CLEARED,
        payload: { baseIndex, baseDefId: scoringBase.defId, baseInstanceId: scoringBase.instanceId },
        timestamp: now,
    };
    postScoringEvents.push(clearEvt);

    if (newBaseDeck.length === 0) {
        const pool = [...(updatedCore.baseDiscard ?? []), base.defId];
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
    }

    return { postScoringEvents, newBaseDeck };
}

function ensureScoringFramePostScoringEventsRegistered(input: {
    matchState: MatchState<SmashUpCore> | undefined;
    currentBaseRef: SmashUpScoringBaseRef | undefined;
    updatedCore: SmashUpCore;
    scoringBase: BaseInPlay;
    base: BaseInPlay;
    baseIndex: number;
    newBaseDeck: string[];
    now: number;
    random?: RandomFn;
}): { matchState: MatchState<SmashUpCore> | undefined; newBaseDeck: string[]; registered: boolean } {
    const { matchState, currentBaseRef } = input;
    if (!matchState || !currentBaseRef) {
        return { matchState, newBaseDeck: input.newBaseDeck, registered: false };
    }
    if ((getDeferredPostScoringEvents(matchState) ?? []).length > 0) {
        return { matchState, newBaseDeck: input.newBaseDeck, registered: true };
    }

    const built = buildDeferredPostScoringEvents(input);
    return {
        matchState: appendScoringFrameDeferredPayload(matchState, {
            deferredEvents: serializePostScoringEvents(built.postScoringEvents),
        }),
        newBaseDeck: built.newBaseDeck,
        registered: true,
    };
}

function continueScoringAfterAwardCommitted(input: {
    events: SmashUpEvent[];
    updatedCore: SmashUpCore;
    scoringBase: BaseInPlay;
    base: BaseInPlay;
    baseDef: NonNullable<ReturnType<typeof getBaseDef>>;
    baseIndex: number;
    baseDeck: string[];
    newBaseDeck: string[];
    pid: PlayerId;
    now: number;
    rng: RandomFn;
    random?: RandomFn;
    matchState?: MatchState<SmashUpCore>;
    currentBaseRef?: SmashUpScoringBaseRef;
    rankings: BaseScoredEvent['payload']['rankings'];
}): { events: SmashUpEvent[]; newBaseDeck: string[]; matchState?: MatchState<SmashUpCore> } {
    const {
        events,
        base,
        baseIndex,
        pid,
        now,
        rng,
        random,
        currentBaseRef,
        rankings,
    } = input;
    const { scoringBase } = input;
    let { updatedCore, newBaseDeck } = input;
    let ms = input.matchState;
    if (!ms || !currentBaseRef || !getScoringSession(ms)) {
        throw new Error('SmashUp scoreBases after-award continuation requires an active scoring session/baseRef');
    }
    const resolveScoringReactionQueue = (state: MatchState<SmashUpCore>) =>
        maybeResolveReactionQueue(state, rng, now);

    const scoringSessionAtEntry = ms ? getScoringSession(ms) : undefined;
    const afterScoringCore = updatedCore;
    const interactionBeforeAfterScoring = ms?.sys?.interaction?.current?.id ?? null;
    const queueLenBeforeAfterScoring = ms?.sys?.interaction?.queue?.length ?? 0;

    const alreadyTriggeredAfterScoring = updatedCore.afterScoringTriggeredBases?.includes(baseIndex) ?? false;
    const afterScoringFrameId = `score-after:${baseIndex}:${now}`;

    if (
        ms
        && currentBaseRef
        && (
            scoringSessionAtEntry?.currentStep === 'awaiting-after-scoring-reduce'
            || scoringSessionAtEntry?.currentStep === 'awaiting-after-reaction-reduce'
        )
    ) {
        ms = updateScoringSession({ ...ms, core: updatedCore }, (session) => session
            ? {
                ...session,
                currentBaseRef,
                currentStep: 'resolving-base',
            }
            : session,
        );
        const registeredPostScoring = ensureScoringFramePostScoringEventsRegistered({
            matchState: ms,
            currentBaseRef,
            updatedCore,
            scoringBase,
            base,
            baseIndex,
            newBaseDeck,
            now,
            random,
        });
        ms = registeredPostScoring.matchState;
        newBaseDeck = registeredPostScoring.newBaseDeck;
        if (!getSmashUpReactionSession(ms)) {
            ms = startSmashUpReactionSession(ms, {
                frameId: afterScoringFrameId,
                frameKind: 'score-after',
                responseWindowType: 'afterScoring',
                sourceBaseIndex: baseIndex,
            });
        }
        const resumedAfterScoring = resolveScoringReactionQueue(ms);
        if (resumedAfterScoring) {
            events.push(...resumedAfterScoring.events);
            ms = resumedAfterScoring.state;
            updatedCore = resumedAfterScoring.state.core;

            if (resumedAfterScoring.events.length > 0) {
                ms = updateScoringSession(ms, (session) => session
                    ? {
                        ...session,
                        currentBaseRef,
                        currentStep: 'awaiting-after-reaction-reduce',
                    }
                    : session,
                );
                return { events, newBaseDeck, matchState: ms };
            }
        }
        if (ms.sys.interaction?.current || getSmashUpReactionSession(ms)) {
            ms = updateScoringSession(ms, (session) => session
                ? {
                    ...session,
                    currentBaseRef,
                    currentStep: getSmashUpReactionSession(ms!)
                        ? 'awaiting-response-window'
                        : 'awaiting-interactions',
                }
                : session,
            );
            // 不能在这里直接返回：清场 / 换基地的 deferred payload 也必须由
            // scoring frame 在打开 After Scoring 反应窗口的这一轮登记。否则窗口
            // 结束后虽然不会重复 BASE_SCORED，但也没有可执行的 BASE_CLEARED /
            // BASE_REPLACED。
        }
    }

    if (!alreadyTriggeredAfterScoring) {
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
        }

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
        }
        const hasAfterScoringTriggerWork = armedSpecials.length > 0 || !!queuedAfterBase || !!queuedAfterOngoing;

        const markEvent = {
            type: SU_EVENT_TYPES.AFTER_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(markEvent as unknown as SmashUpEvent);
        const hasAfterScoringResponseCards =
            getPlayersWithPlayableAfterScoringResponses({ ...ms, core: afterScoringCore }, baseIndex, now).length > 0;
        if (hasAfterScoringTriggerWork || hasAfterScoringResponseCards) {
            ms = updateScoringSession(ms, (session) => session
                ? {
                    ...session,
                    currentBaseRef,
                    currentStep: 'awaiting-after-scoring-reduce',
                }
                : session,
            );
            const registeredPostScoring = ensureScoringFramePostScoringEventsRegistered({
                matchState: ms,
                currentBaseRef,
                updatedCore,
                scoringBase,
                base,
                baseIndex,
                newBaseDeck,
                now,
                random,
            });
            ms = registeredPostScoring.matchState;
            newBaseDeck = registeredPostScoring.newBaseDeck;
            return { events, newBaseDeck, matchState: ms };
        }
    }

    const interactionAfter = ms?.sys?.interaction?.current?.id ?? null;
    const queueLenAfter = ms?.sys?.interaction?.queue?.length ?? 0;
    const afterScoringCreatedInteraction =
        (interactionAfter !== null && interactionAfter !== interactionBeforeAfterScoring) ||
        (queueLenAfter > queueLenBeforeAfterScoring) ||
        !!(ms && getSmashUpReactionSession(ms));

    const playersWithAfterScoringCards = ms
        ? getPlayersWithPlayableAfterScoringResponses({ ...ms, core: afterScoringCore }, baseIndex, now)
        : [];

    const postScoringPayloadAlreadyRegistered = Boolean(ms && (getDeferredPostScoringEvents(ms) ?? []).length > 0);
    const builtPostScoring = postScoringPayloadAlreadyRegistered
        ? { postScoringEvents: [] as SmashUpEvent[], newBaseDeck }
        : buildDeferredPostScoringEvents({
            updatedCore,
            scoringBase,
            base,
            baseIndex,
            newBaseDeck,
            now,
            random,
        });
    const postScoringEvents = builtPostScoring.postScoringEvents;
    newBaseDeck = builtPostScoring.newBaseDeck;

    const serializedDeferredEvents = serializePostScoringEvents(postScoringEvents);
    const waitingStep = afterScoringCreatedInteraction || playersWithAfterScoringCards.length > 0
        ? getSmashUpReactionSession(ms)
            ? 'awaiting-response-window'
            : 'awaiting-interactions'
        : 'awaiting-post-scoring-finalize';
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
    return { events, newBaseDeck, matchState: ms };
}

function scoreCurrentBaseInSession(
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
    if (!matchState || !getScoringSession(matchState)) {
        throw new Error('SmashUp scoring executor requires an active scoring session');
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
    const resolveScoringReactionQueue = (state: MatchState<SmashUpCore>) =>
        maybeResolveReactionQueue(state, rng, now);
    let shouldOpenBeforeScoringWindow = false;
    const base = core.bases[baseIndex];
    if (!base) {
        throw new Error(`SmashUp scoring executor missing scoring base at slot ${baseIndex}`);
    }
    const baseDef = getBaseDef(base.defId)!;
    const currentBaseRef = createScoringBaseRef(core, baseIndex);
    if (!currentBaseRef) {
        throw new Error(`SmashUp scoring executor missing current scoring base ref at slot ${baseIndex}`);
    }
    const scoringSessionAtEntry = getScoringSession(ms);
    const beforeScoringFrameId = `score-before:${baseIndex}:${now}`;
    const whenScoringFrameId = `score-when:${baseIndex}:${now}`;

    if (scoringSessionAtEntry?.currentStep === 'awaiting-score-award-reduce') {
        const scoringBase = core.bases[baseIndex] ?? base;
        const finalPlayerPowers = collectQualifiedPlayerPowers(core, scoringBase, baseIndex);
        const rankings = buildBaseRankings(core, baseIndex, baseDef, finalPlayerPowers);
        const resumedState = currentBaseRef
            ? updateScoringSession(ms!, (session) => session
                ? {
                    ...session,
                    currentBaseRef,
                    currentStep: 'resolving-base',
                }
                : session)
            : ms;
        return continueScoringAfterAwardCommitted({
            events,
            updatedCore: core,
            scoringBase,
            base,
            baseDef,
            baseIndex,
            baseDeck,
            newBaseDeck: baseDeck,
            pid,
            now,
            rng,
            random,
            matchState: resumedState,
            currentBaseRef,
            rankings,
        });
    }

    if (
        scoringSessionAtEntry?.currentStep === 'awaiting-after-scoring-reduce'
        || scoringSessionAtEntry?.currentStep === 'awaiting-after-reaction-reduce'
    ) {
        const scoringBase = core.bases[baseIndex] ?? base;
        const finalPlayerPowers = collectQualifiedPlayerPowers(core, scoringBase, baseIndex);
        const rankings = buildBaseRankings(core, baseIndex, baseDef, finalPlayerPowers);
        return continueScoringAfterAwardCommitted({
            events,
            updatedCore: core,
            scoringBase,
            base,
            baseDef,
            baseIndex,
            baseDeck,
            newBaseDeck: baseDeck,
            pid,
            now,
            rng,
            random,
            matchState: ms,
            currentBaseRef,
            rankings,
        });
    }

    if (
        ms
        && currentBaseRef
        && (
            scoringSessionAtEntry?.currentStep === 'awaiting-before-scoring-reduce'
            || scoringSessionAtEntry?.currentStep === 'awaiting-before-reaction-reduce'
            || scoringSessionAtEntry?.currentStep === 'awaiting-before-response-window'
        )
    ) {
        ms = updateScoringSession({ ...ms, core }, (session) => session
            ? {
                ...session,
                currentBaseRef,
                currentStep: 'awaiting-before-response-window',
            }
            : session,
        );

        const resumedBeforeScoring = resolveScoringReactionQueue(ms);
        if (resumedBeforeScoring) {
            events.push(...resumedBeforeScoring.events);
            ms = resumedBeforeScoring.state;
            core = resumedBeforeScoring.state.core;

            if (resumedBeforeScoring.events.length > 0) {
                ms = updateScoringSession(ms, (session) => session
                    ? {
                        ...session,
                        currentBaseRef,
                        currentStep: 'awaiting-before-reaction-reduce',
                    }
                    : session,
                );
                return { events, newBaseDeck: baseDeck, matchState: ms };
            }

            if (ms.sys.interaction?.current || getSmashUpReactionSession(ms)) {
                return { events, newBaseDeck: baseDeck, matchState: ms };
            }
        }

        ms = updateScoringSession(ms, (session) => session
            ? {
                ...session,
                currentBaseRef,
                currentStep: 'resolving-base',
            }
            : session,
        );
        shouldOpenBeforeScoringWindow = true;
    }

    if (
        ms
        && currentBaseRef
        && (
            scoringSessionAtEntry?.currentStep === 'awaiting-when-scoring-reduce'
            || scoringSessionAtEntry?.currentStep === 'awaiting-when-reaction-reduce'
        )
    ) {
        ms = updateScoringSession({ ...ms, core }, (session) => session
            ? {
                ...session,
                currentBaseRef,
                currentStep: 'resolving-base',
            }
            : session,
        );

        const resumedWhenScoring = resolveScoringReactionQueue(ms);
        if (resumedWhenScoring) {
            events.push(...resumedWhenScoring.events);
            ms = resumedWhenScoring.state;
            core = resumedWhenScoring.state.core;

            if (resumedWhenScoring.events.length > 0) {
                ms = updateScoringSession(ms, (session) => session
                    ? {
                        ...session,
                        currentBaseRef,
                        currentStep: 'awaiting-when-reaction-reduce',
                    }
                    : session,
                );
                return { events, newBaseDeck: baseDeck, matchState: ms };
            }

            if (ms.sys.interaction?.current || getSmashUpReactionSession(ms)) {
                return { events, newBaseDeck: baseDeck, matchState: ms };
            }
        }
    }

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
    const currentBaseSelectedForScoring = !!(
        ms
        && currentBaseRef
        && isSameScoringBaseRef(getScoringSession(ms)?.currentBaseRef, currentBaseRef)
    );
    if (
        currentBaseSelectedForScoring
        && (
            !Array.isArray(core.scoringEligibleBaseIndices)
            || core.scoringEligibleBaseIndices.length !== 1
            || core.scoringEligibleBaseIndices[0] !== baseIndex
        )
    ) {
        const currentBaseLockEvent = {
            type: SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED,
            payload: { baseIndices: [baseIndex] },
            timestamp: now,
        } as unknown as SmashUpEvent;
        events.push(currentBaseLockEvent);
    }
    const newBaseDeck = baseDeck;

    const alreadyTriggeredBeforeScoring = core.beforeScoringTriggeredBases?.includes(baseIndex) ?? false;

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
        }

        const queuedBeforeBase = collectBaseAbilityTriggers({
            core,
            timing: 'beforeScoring',
            ownerPlayerId: pid,
            baseIndex,
            frameId: beforeScoringFrameId,
            sourceEventId: beforeScoringFrameId,
            now,
        });
        if (queuedBeforeBase) {
            events.push(queuedBeforeBase as unknown as SmashUpEvent);
        }
        const hasBeforeScoringTriggerWork = !!queuedBefore || !!queuedBeforeBase;

        // 发送事件标记该基地已触发 beforeScoring
        const markEvent = {
            type: SU_EVENT_TYPES.BEFORE_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(markEvent as unknown as SmashUpEvent);

        if (hasBeforeScoringTriggerWork) {
            ms = updateScoringSession(ms, (session) => session
                ? {
                    ...session,
                    currentBaseRef,
                    currentStep: 'awaiting-before-scoring-reduce',
                }
                : session,
            );
            return { events, newBaseDeck: baseDeck, matchState: ms };
        }

        if (ms?.sys?.interaction?.current) {
            return { events, newBaseDeck: baseDeck, matchState: ms };
        }
    }

    let updatedCore = core;

    // 计分前响应窗口：允许 beforeScoring 交互与响应窗口优先完成
    if ((!alreadyTriggeredBeforeScoring || shouldOpenBeforeScoringWindow) && ms) {
        ms = { ...ms, core: updatedCore };
        if (shouldOpenBeforeScoringWindow && currentBaseRef) {
            ms = updateScoringSession(ms, (session) => session
                ? {
                    ...session,
                    currentBaseRef,
                    currentStep: 'resolving-base',
                }
                : session,
            );
        }
        ms = startSmashUpReactionSession(ms, {
            frameId: beforeScoringFrameId,
            frameKind: 'score-before',
            responseWindowType: 'meFirst',
            sourceBaseIndex: baseIndex,
        });
        const beforeSession = resolveScoringReactionQueue(ms);
        if (beforeSession) {
            events.push(...beforeSession.events);
            ms = beforeSession.state;
            updatedCore = beforeSession.state.core;
            if (beforeSession.events.length > 0) {
                ms = updateScoringSession(ms, (session) => session
                    ? {
                        ...session,
                        currentBaseRef,
                        currentStep: 'awaiting-before-reaction-reduce',
                    }
                    : session,
                );
                return { events, newBaseDeck: baseDeck, matchState: ms };
            }
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
    const selectedBaseLocked = currentBaseSelectedForScoring
        || (updatedCore.scoringEligibleBaseIndices?.includes(baseIndex) ?? false);
    // 规则：只有已经被选择并开始结算的当前基地，即使 beforeScoring 链路中力量
    // 被压到 breakpoint 以下，也会继续完成本次计分。
    if (!selectedBaseLocked && totalPowerAfterBefore < effectiveBreakpointAfterBefore) {
        if (ms) ms = { ...ms, core: updatedCore };
        return { events, newBaseDeck: baseDeck, matchState: ms };
    }

    const updatedBase = updatedCore.bases[baseIndex];
    const playerPowers = collectQualifiedPlayerPowers(updatedCore, updatedBase, baseIndex);
    const preliminaryRankings = buildBaseRankings(updatedCore, baseIndex, baseDef, playerPowers);

    const alreadyTriggeredWhenScoring = updatedCore.whenScoringTriggeredBases?.includes(baseIndex) ?? false;
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
        }
        const hasWhenScoringTriggerWork = !!queuedWhenScoringBase;

        const whenScoringTriggeredEvent = {
            type: SU_EVENT_TYPES.WHEN_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(whenScoringTriggeredEvent as unknown as SmashUpEvent);
        if (hasWhenScoringTriggerWork) {
            ms = updateScoringSession(ms, (session) => session
                ? {
                    ...session,
                    currentBaseRef,
                    currentStep: 'awaiting-when-scoring-reduce',
                }
                : session,
            );
            return { events, newBaseDeck: baseDeck, matchState: ms };
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

    const monsterTreasureRewardCount = (scoringBase.monsters ?? []).reduce((sum, monster) => (
        sum + (getMunchkinSpecialCardDescriptor(monster.defId)?.treasureReward ?? 0)
    ), 0);
    const secretStashTreasureRewardCount = scoringBase.ongoingActions
        .filter(action => action.defId === 'munchkin_thieves_secret_stash')
        .length * 2;
    const munchkinTreasureRewardCount = Math.min(
        monsterTreasureRewardCount + secretStashTreasureRewardCount,
        updatedCore.treasureDeck?.length ?? 0,
    );
    const eligibleMunchkinRewardPlayerIds = rankings.map(ranking => ranking.playerId);
    if (
        munchkinTreasureRewardCount > 0
        && eligibleMunchkinRewardPlayerIds.length > 0
        && (updatedCore.treasureDeck?.length ?? 0) > 0
    ) {
        const revealEvent: MunchkinTreasureRewardRevealedEvent = {
            type: SU_EVENTS.MUNCHKIN_TREASURE_REWARD_REVEALED,
            payload: {
                baseIndex,
                baseDefId: scoringBase.defId,
                ...(scoringBase.instanceId ? { baseInstanceId: scoringBase.instanceId } : {}),
                count: munchkinTreasureRewardCount,
                eligiblePlayerIds: eligibleMunchkinRewardPlayerIds,
                nextRecipientIndex: 0,
                reason: 'munchkin_scoring_treasure_reward',
            },
            timestamp: now,
        };
        events.push(revealEvent);
    }

    ms = updateScoringSession(ms, (session) => session
        ? {
            ...session,
            currentBaseRef,
            currentStep: 'awaiting-score-award-reduce',
        }
        : session,
    );
    return { events, newBaseDeck, matchState: ms };
}

function scoreCurrentSessionBase(
    state: MatchState<SmashUpCore>,
    baseIndex: number,
    pid: PlayerId,
    now: number,
    random?: RandomFn,
): { events: SmashUpEvent[]; newBaseDeck: string[]; matchState?: MatchState<SmashUpCore> } {
    const session = getScoringSession(state);
    const currentBaseRef = session?.currentBaseRef;
    if (!session || !currentBaseRef) {
        throw new Error('SmashUp scoreBases 生产计分缺少当前 scoring session/baseRef');
    }

    const resolvedBaseIndex = resolveScoringBaseRefSlotIndex(state, currentBaseRef);
    if (resolvedBaseIndex !== baseIndex) {
        throw new Error('SmashUp scoreBases 生产计分 baseIndex 与当前 scoring session/baseRef 不一致');
    }

    const liveBaseRef = createScoringBaseRef(state.core, baseIndex);
    if (!isSameScoringBaseRef(liveBaseRef, currentBaseRef)) {
        throw new Error('SmashUp scoreBases 生产计分当前基地引用已失效');
    }

    return scoreCurrentBaseInSession(
        state.core,
        baseIndex,
        state.core.baseDeck,
        pid,
        now,
        random,
        state,
    );
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

const BACKTIMERS_STASIS_REASON = 'backtimers_stasis';

function isBacktimersStasisCard(card: StoredCardInstance): boolean {
    return card.reason === BACKTIMERS_STASIS_REASON;
}

function buildBacktimersStartTurnStasisEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    now: number,
): SmashUpEvent[] {
    const stasisCards = (core.players[playerId]?.storedCards ?? []).filter(isBacktimersStasisCard);
    return stasisCards.flatMap(card => {
        const counters = card.counters ?? 0;
        if (counters <= 0) return [];
        const counterEvent = {
            type: SU_EVENTS.STORED_CARD_COUNTER_CHANGED,
            payload: {
                playerId,
                cardUid: card.uid,
                delta: -1,
                reason: 'backtimers_start_turn_stasis',
            },
            timestamp: now,
        } as SmashUpEvent;
        return counters === 1
            ? [
                counterEvent,
                grantImmediateExtraPlayForStoredCard(playerId, card, 'backtimers_start_turn_stasis', now),
            ]
            : [counterEvent];
    });
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

// ============================================================================
// Setup
// ============================================================================

function isAiSeatControllerType(type: unknown): boolean {
    return type === 'local-ai' || type === 'remote-ai';
}

function getSetupBaseDefIds(enabledExpansions: readonly string[]): string[] {
    return getAllBaseDefIds().filter((defId) => isBaseDefAvailableForRuntimeBasePool(defId, enabledExpansions));
}

function hasPregameDraftSetupField(setupData: Record<string, unknown> | undefined, fieldKey: string): boolean {
    if (!setupData) return false;
    if (setupData[fieldKey] !== undefined) return true;
    const setupSelections = setupData.setupSelections;
    return Boolean(
        setupSelections
        && typeof setupSelections === 'object'
        && !Array.isArray(setupSelections)
        && (setupSelections as Record<string, unknown>)[fieldKey] !== undefined,
    );
}

function setup(playerIds: PlayerId[], random: RandomFn, setupData?: Record<string, unknown>): SmashUpCore {
    const nextUid = 1;
    const runtimeSetup = readSmashUpRuntimeSetupConfig(setupData, { playerCount: playerIds.length });
    const {
        enabledExpansions,
        includedFactionIds,
        deckQueryEnabled,
        victoryTarget,
        teamMode,
        factionSelectionMode,
        factionCandidatePoolSize,
        banPolicy,
        firstPlayerPolicy,
        basePoolPolicy,
    } = runtimeSetup;
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

    const playTurnOrder = firstPlayerPolicy === 'nextSeatPlaysFirst' && initialTurnOrder.length > 1
        ? [...initialTurnOrder.slice(1), initialTurnOrder[0]]
        : [...initialTurnOrder];
    const playerCandidatePools = factionSelectionMode === 'individualPools'
        ? buildSmashUpPlayerCandidatePools(
            initialTurnOrder,
            factionCandidatePoolSize,
            random,
            enabledExpansions,
            includedFactionIds,
        )
        : {};
    const usesExplicitSharedDraftPool = (
        hasPregameDraftSetupField(setupData, 'factionSelectionMode')
        || hasPregameDraftSetupField(setupData, 'factionCandidatePoolSize')
        || hasPregameDraftSetupField(setupData, 'banPolicy')
        || hasPregameDraftSetupField(setupData, 'smashupIncludedFactionIds')
    );
    const sharedCandidatePool = usesExplicitSharedDraftPool
    && (factionSelectionMode === 'snakeDraft' || factionSelectionMode === 'straightDraft')
        ? buildSmashUpSharedCandidatePool(
            initialTurnOrder,
            factionCandidatePoolSize,
            random,
            enabledExpansions,
            includedFactionIds,
        )
        : [];
    const availableFactionIdsForBanPolicy = getSmashUpSelectableFactionIds(enabledExpansions, includedFactionIds);
    const resolvedBanPolicy = resolveSmashUpSupportedBanPolicy(
        banPolicy,
        factionSelectionMode,
        initialTurnOrder,
        2,
        availableFactionIdsForBanPolicy,
    );
    const effectiveBanPolicy = resolvedBanPolicy.banPolicy;
    const initialFactionSelectionPhase = getSmashUpInitialFactionSelectionPhase(effectiveBanPolicy);

    return {
        players,
        seatOrder,
        turnOrder: initialTurnOrder,
        currentPlayerIndex: 0,
        teamMode,
        factionSelectionMode,
        factionCandidatePoolSize,
        banPolicy: effectiveBanPolicy,
        firstPlayerPolicy,
        basePoolPolicy,
        bases: activeBases,
        titans: [],
        enabledExpansions,
        includedFactionIds,
        deckQueryEnabled,
        victoryTarget,
        baseDeck,
        baseDiscard: [],
        triggerQueue: undefined,
        turnNumber: 1,
        nextUid,
        nextBaseInstanceId: activeBases.length + 1,
        gameResult: undefined,
        factionSelection: {
            mode: factionSelectionMode,
            factionsPerPlayer: 2,
            candidatePoolSize: factionCandidatePoolSize,
            banPolicy: effectiveBanPolicy,
            requestedBanPolicy: banPolicy,
            banPolicyDowngradeReason: resolvedBanPolicy.reason,
            phase: initialFactionSelectionPhase.phase,
            banStage: initialFactionSelectionPhase.banStage,
            completedBanStages: [],
            banSelections: {},
            bannedFactions: [],
            sharedCandidatePool,
            playerCandidatePools,
            readyPlayers: [],
            lockedPlayers: [],
            firstPlayerPolicy,
            draftTurnOrder: [...initialTurnOrder],
            playTurnOrder,
            basePoolPolicy,
            takenFactions: [],
            playerSelections,
            completedPlayers: [],
        },
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
    };
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
                const gameResult = evaluateSmashUpVictory(core);
                if (gameResult) {
                    return {
                        events: [],
                        halt: true,
                        updatedState: {
                            ...state,
                            core: { ...core, gameResult },
                        },
                    } as PhaseExitResult;
                }

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
                    core: applyTriggerQueueFactEvent(currentMatchState.core, queuedBaseTurnEnd as unknown as SmashUpEvent),
                };
            }
            if (queuedTurnEnd) {
                hasQueuedTurnEndResolution = true;
                events.push(queuedTurnEnd);
                // Seed an explicit turn-end reaction frame so onTurnEnd follows the same Step 3/4 session model as startTurn.
                currentMatchState = {
                    ...currentMatchState,
                    core: applyTriggerQueueFactEvent(currentMatchState.core, queuedTurnEnd as unknown as SmashUpEvent),
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
                    const afterDestroyMove = processDestroyMoveCycle(rq.events, rq.state, pid, random, now, {
                        skipReactionQueueResolution: true,
                    });
                    events.push(...afterDestroyMove.events);
                    currentMatchState = afterDestroyMove.matchState ?? rq.state;
                }

                if (currentMatchState.sys.interaction?.current || getSmashUpReactionSession(currentMatchState)) {
                    hasPendingTurnEndResolution = true;
                }
            }

            // 即使 onTurnEnd 触发已自动结算，也先让 pipeline 真正归约这一批事件；
            // 下一轮 endTurn 会走 resumed 分支，再基于最终 core 判胜。
            if (hasPendingTurnEndResolution || hasQueuedTurnEndResolution) {
                return {
                    events,
                    halt: true,
                    updatedState: keepSysUpdatesOnly(state, currentMatchState),
                } as PhaseExitResult;
            }

            const gameResult = evaluateSmashUpVictory(currentMatchState.core);
            if (gameResult) {
                return {
                    events: [],
                    halt: true,
                    updatedState: {
                        ...state,
                        core: { ...core, gameResult },
                    },
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
                currentState = {
                    ...currentState,
                    sys: {
                        ...currentState.sys,
                        flowHalted: false,
                        interaction: normalizedInteraction ?? currentState.sys.interaction,
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

            if (currentSession.currentStep === 'awaiting-post-scoring-finalize') {
                const finalized = finalizeCurrentScoringBase(currentState, now);
                return { events: finalized.events, halt: true, updatedState: finalized.updatedState } as PhaseExitResult;
            }

            if (currentSession.currentBaseRef && (
                currentSession.currentStep === 'awaiting-interactions'
                || currentSession.currentStep === 'awaiting-response-window'
            )) {
                const finalized = finalizeCurrentScoringBase(currentState, now);
                return { events: finalized.events, halt: true, updatedState: finalized.updatedState } as PhaseExitResult;
            }

            if (!currentSession.currentBaseRef) {
                currentState = refreshPendingScoringBaseRefs(currentState);
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
                        (session) => session ? { ...session, currentStep: 'idle' } : session,
                    );
                    return {
                        events: [],
                        halt: true,
                        updatedState: missingBaseState,
                    } as PhaseExitResult;
                }
                return events;
            }

            const result = scoreCurrentSessionBase(currentState, activeBaseIndex, pid, now, random);
            const pipelineReadyState = result.matchState ?? currentState;

            if (pipelineReadyState.sys.interaction?.current || getSmashUpReactionSession(pipelineReadyState)) {
                return { events: result.events, halt: true, updatedState: pipelineReadyState } as PhaseExitResult;
            }

            if (getScoringSession(pipelineReadyState)?.currentStep === 'awaiting-post-scoring-finalize') {
                return { events: result.events, halt: true, updatedState: pipelineReadyState } as PhaseExitResult;
            }

            if (getScoringSession(pipelineReadyState)?.currentStep === 'awaiting-score-award-reduce') {
                return { events: result.events, halt: true, updatedState: pipelineReadyState } as PhaseExitResult;
            }

            const currentScoringStep = getScoringSession(pipelineReadyState)?.currentStep;
            if (
                currentScoringStep === 'awaiting-before-scoring-reduce'
                || currentScoringStep === 'awaiting-before-reaction-reduce'
                || currentScoringStep === 'awaiting-before-response-window'
                || currentScoringStep === 'awaiting-when-scoring-reduce'
                || currentScoringStep === 'awaiting-when-reaction-reduce'
                || currentScoringStep === 'awaiting-after-scoring-reduce'
                || currentScoringStep === 'awaiting-after-reaction-reduce'
            ) {
                return { events: result.events, halt: true, updatedState: pipelineReadyState } as PhaseExitResult;
            }

            const completedState = updateScoringSession(
                markScoringBaseCompleted(pipelineReadyState, activeBaseRef),
                (session) => session
                    ? { ...session, currentStep: 'idle' }
                    : session,
            );
            return {
                events: result.events,
                halt: true,
                updatedState: completedState,
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
            const startTurnCore = reduceTurnStartedEvent(core, turnStarted);
            currentMatchState = { ...currentMatchState, core: startTurnCore };

            const startTurnStasisEvents = buildBacktimersStartTurnStasisEvents(
                currentMatchState.core,
                nextPlayerId,
                now,
            );
            const startTurnStasisImmediateEvents = startTurnStasisEvents.filter((event): event is LimitModifiedEvent =>
                event.type === SU_EVENTS.LIMIT_MODIFIED,
            );
            if (startTurnStasisEvents.length > 0) {
                events.push(...startTurnStasisEvents);
                currentMatchState = {
                    ...currentMatchState,
                    core: startTurnStasisEvents.reduce(
                        (nextCore, event) => reduce(nextCore, event),
                        currentMatchState.core,
                    ),
                };
                hasSysUpdate = true;
            }

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
                    core: applyTriggerQueueFactEvent(currentMatchState.core, queuedBase as unknown as SmashUpEvent),
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
                    core: applyTriggerQueueFactEvent(currentMatchState.core, queuedTurnStart as unknown as SmashUpEvent),
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

            if (startTurnStasisImmediateEvents.length > 0) {
                currentMatchState = queueImmediateExtraPlayInteractions(
                    currentMatchState,
                    startTurnStasisImmediateEvents,
                );
                hasSysUpdate = true;
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

            const eligibleIndices = getRealtimeScoringEligibleBaseIndices(core);
            currentMatchState = eligibleIndices.length > 0
                ? setScoringSession(currentMatchState, createScoringSession(core, eligibleIndices))
                : clearScoringSession(currentMatchState);
            hasSysUpdate = true;

            return { events, updatedState: currentMatchState } as PhaseEnterResult;
        }

        if (to === 'draw') {
            if (from === 'scoreBases' && exitEvents && exitEvents.length > 0) {
                core = exitEvents.reduce(
                    (currentCore, event) => applyPostProcessPrefixEvent(currentCore, event as SmashUpEvent),
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
        const hasLiveScoringOrReactionFrame = Boolean(
            getSmashUpReactionSession(state)
            || getScoringSession(state)?.currentBaseRef,
        );
        const justResolvedSmashUpReactionChoice = events.some((event) => {
            if (event.type !== 'SYS_INTERACTION_RESOLVED' && event.type !== 'SYS_INTERACTION_CANCELLED') {
                return false;
            }
            const payload = event.payload as { sourceId?: unknown } | undefined;
            return payload?.sourceId === 'smashup_reaction_choose';
        });

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
            if (hasPendingPhaseReactionFrame(core, phase, state)) {
                return undefined;
            }
            return { autoContinue: true, playerId: pid };
        }

        if (phase === 'scoreBases') {
            if (getSmashUpReactionSession(state)) {
                return undefined;
            }
            if (getSmashUpReactionWindowContext(state)) {
                return undefined;
            }

            const scoringSession = getScoringSession(state);

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
        storedCards: player.storedCards?.map((card, index) => (
            isBacktimersStasisCard(card)
                ? card
                : maskStoredCard(player.id, index)
        )),
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

function evaluateSmashUpVictory(state: SmashUpCore): GameOverResult | undefined {
    const victoryTarget = getSmashUpVictoryTarget(state);

    if (isSmashUpTwoVsTwoMode(state)) {
        const rawTeamTotals = getSmashUpRawTeamVpTotals(state);
        const candidateTeams = Object.entries(rawTeamTotals)
            .filter(([, total]) => total >= victoryTarget)
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

    const rawScores = Object.fromEntries(
        state.turnOrder.map((pid) => [pid, state.players[pid]?.vp ?? 0]),
    ) as Record<PlayerId, number>;
    const highestRawScore = Math.max(...Object.values(rawScores));
    if (highestRawScore < victoryTarget) return undefined;
    const rawLeaders = state.turnOrder.filter(pid => rawScores[pid] === highestRawScore);
    if (rawLeaders.length !== 1) return undefined;

    const scores = getScores(state);
    if (state.madnessDeck === undefined) {
        return { winner: rawLeaders[0], scores };
    }

    const highestScore = Math.max(...state.turnOrder.map(pid => scores[pid] ?? 0));
    const finalists = state.turnOrder.filter(pid => scores[pid] === highestScore);
    if (finalists.length === 1) return { winner: finalists[0], scores };

    const minMadness = Math.min(...finalists.map(pid => countMadnessCardsForPlayer(state, pid)));
    const winners = finalists.filter(pid => countMadnessCardsForPlayer(state, pid) === minMadness);
    if (winners.length === 1) return { winner: winners[0], scores };

    return { winner: winners[0], winners, scores };
}

function isGameOver(state: SmashUpCore): GameOverResult | undefined {
    if (state.gameResult) return state.gameResult;

    // 正常运行态只发布 endTurn 收口后锁定的结果，避免 draw/endTurn 能力尚未结算时抢跑。
    // 无 turnPhase 的旧快照/纯规则测试保留直接计算兼容路径。
    if (state.turnPhase !== undefined) return undefined;
    return evaluateSmashUpVictory(state);
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

registerSmashUpReactionPostProcessor(postProcessSystemEvents);

// ============================================================================
// 棰嗗煙鍐呮牳瀵煎嚭
// ============================================================================

export const SmashUpDomain: DomainCore<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
    gameId: 'smashup',
    statePersistence,
    setup,

    validate,
    execute,
    reduce,
    discoverTimingOpportunities: discoverSmashUpTimingOpportunities,
    planCommand: planSmashUpCommand,
    prepareEventBatch: prepareSmashUpEventBatch,
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
