import { processDestroyTriggers, processMoveTriggers } from './eventFamilies';
import {
    type SmashUpCore,
    type SmashUpEvent,
    type SmashUpCommand,
    SU_EVENTS,
    getCurrentPlayerId,
    type TurnStartedEvent,
    type MinionDestroyedEvent,
    type VpAwardedEvent,
    type BaseScoredEvent,
    type BaseClearedEvent,
    type BaseReplacedEvent,
    type MinionPlayedEvent,
    type ActionPlayedEvent,
    type MunchkinMonsterPlayedEvent,
    type MunchkinMonsterDefeatedEvent,
    type TalentUsedEvent,
    SU_EVENT_TYPES,
    type LimitModifiedEvent,
    type TriggerQueuedEvent,
    type ActionReturnToHandOptionArmedEvent,
    type CardsDrawnEvent,
    type DeckReshuffledEvent,
    type CardInstance,
    type PlayerState,
    type MinionOnBase,
} from './types';
import type { RandomFn, MatchState, PostProcessSystemEventsOptions, PlayerId } from '../../../engine/types';
import {
    claimSmashUpImmediateStartTurnEvent,
    getSmashUpSettlementContext,
    createSmashUpSettlementContext,
    withSmashUpSettlement,
    prepareSmashUpCandidates,
    isSmashUpEventSettled,
    withSmashUpCandidatePreparer,
    withSmashUpSettlementPhase,
    withSmashUpFactBatch,
} from './eventSettlementContext';
import {
    processClydeDetachChoices,
    buildDestroyEventKey,
    buildAffectEventKeys,
    processDestroyMoveCycle,
    processReturnToHandTriggers,
    filterProtectedAffectEvents,
    processAffectTriggers,
    processDeckInspectionTriggers,
} from './eventFamilies';
import type { PrepareEventBatchArgs, PreparedEventBatch } from '../../../engine/eventBatchPlan';
import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent';
import { collectTriggers, fireTriggerForSource } from './ongoingEffects';
import {
    reduceBaseClearedEvent,
    reduceBaseReplacedEvent,
    reduceMinionPlayedEvent,
    reduceMunchkinMonsterPlayedEvent,
    reduceMunchkinMonsterDefeatedEvent,
} from './reduce';
import { collectExtendedBaseAbilityTriggers, collectBaseAbilityTriggers } from './baseAbilityQueue';
import {
    fireMinionPlayedTriggers,
    grantExtraMinion,
    grantExtraAction,
    getTitanByUid,
    getTitansOnBase,
    buildBaseTargetOptions,
    removeTitanFromPlay,
} from './abilityHelpers';
import { applyTriggerQueueFactEvent } from './triggerQueueFacts';
import { isMunchkinUndeadMonster, getMunchkinSpecialCardDescriptor } from '../data/factions/munchkin';
import { getCardDef, getBaseDef } from '../data/cards';
import { queueImmediateExtraPlayInteractions } from './extraPlay';
import { maybeResolveReactionQueue } from './reactionQueue';
import { getActiveResolutionFrame } from '../../../engine/systems/resolutionStack';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from './ongoingModifiers';
import { resolveLiveBaseIndex } from './utils';
import { queueInteraction, createSimpleChoice } from '../../../engine/systems/InteractionSystem';

export type SmashUpRuntimeSystemState = MatchState<SmashUpCore>['sys'] & {
    _smashupStartTurnWindowActive?: boolean;
    _ppseImmediateStartTurnProcessedMinionUids?: string[];
    _processedPlayedEvents?: Set<string>;
    _processedDestroyEvents?: Set<string>;
    _processedAffectEvents?: Set<string>;
    _processedTitanPositionEvents?: Set<string>;
    _processedTitanRemovedEvents?: Set<string>;
    _processedMunchkinMonsterPlayedEvents?: Set<string>;
    _processedMunchkinMonsterDefeatedEvents?: Set<string>;
    _processedImmediateExtraEvents?: Set<string>;
};

export function getSmashUpRuntimeSys(state: MatchState<SmashUpCore>): SmashUpRuntimeSystemState {
    return state.sys as SmashUpRuntimeSystemState;
}

export function createReactionQueueFallbackState(core: SmashUpCore): MatchState<SmashUpCore> {
    return {
        core,
        sys: {
            interaction: { current: undefined, queue: [] },
        } as MatchState<SmashUpCore>['sys'],
    };
}

export function createUnreducedPostProcessEventPredicate(
    alreadyReducedInputEvents: readonly SmashUpEvent[],
    inputEventsAlreadyReduced: boolean,
): (event: SmashUpEvent) => boolean {
    if (!inputEventsAlreadyReduced) {
        return () => true;
    }

    const remainingAlreadyReducedInputs = new Map<SmashUpEvent, number>();
    for (const event of alreadyReducedInputEvents) {
        remainingAlreadyReducedInputs.set(event, (remainingAlreadyReducedInputs.get(event) ?? 0) + 1);
    }

    return (event: SmashUpEvent): boolean => {
        const remaining = remainingAlreadyReducedInputs.get(event) ?? 0;
        if (remaining <= 0) {
            return true;
        }
        if (remaining === 1) {
            remainingAlreadyReducedInputs.delete(event);
        } else {
            remainingAlreadyReducedInputs.set(event, remaining - 1);
        }
        return false;
    };
}

export function materializeReturnedPostProcessEvents(
    matchState: MatchState<SmashUpCore>,
    baseCore: SmashUpCore,
    returnedEvents: readonly SmashUpEvent[],
    alreadyReducedInputEvents: readonly SmashUpEvent[],
    inputEventsAlreadyReduced: boolean,
): MatchState<SmashUpCore> {
    const shouldApplyEvent = createUnreducedPostProcessEventPredicate(
        alreadyReducedInputEvents,
        inputEventsAlreadyReduced,
    );
    let materializedCore = baseCore;

    for (const event of returnedEvents) {
        if (!shouldApplyEvent(event)) continue;
        materializedCore = applyPostProcessPrefixEvent(materializedCore, event);
    }

    if (materializedCore === matchState.core) {
        return matchState;
    }

    return {
        ...matchState,
        core: materializedCore,
    };
}

export function buildActionReturnToHandPromptKey(event: ActionReturnToHandOptionArmedEvent): string {
    return [
        event.type,
        event.payload.playerId,
        event.payload.ownerId,
        event.payload.cardUid,
        event.payload.reason,
        event.timestamp ?? 0,
    ].join(':');
}

export function queueActionReturnToHandPrompts(
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
        const inDiscard =
            owner?.discard.some((card) => card.uid === event.payload.cardUid && card.defId === event.payload.defId) ??
            false;
        if (!inDiscard) continue;

        const actionName = getCardDef(event.payload.defId)?.name ?? event.payload.defId;
        nextState = queueInteraction(
            nextState,
            createSimpleChoice(
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
            ),
        );
    }

    return nextState;
}

export function countDiscardedCardUid(cards: readonly CardInstance[], uid: string): number {
    return cards.filter((card) => card.uid === uid).length;
}

export function queueBaseClearedMinionDiscardTriggers(input: {
    preClearCore: SmashUpCore;
    postClearCore: SmashUpCore;
    clearEvent: BaseClearedEvent;
    random: RandomFn;
    matchState?: MatchState<SmashUpCore>;
}): { events: SmashUpEvent[]; core: SmashUpCore; matchState?: MatchState<SmashUpCore> } {
    const { preClearCore, postClearCore, clearEvent, random } = input;
    const baseIndex = clearEvent.payload.baseIndex;
    const clearedBase = preClearCore.bases[baseIndex];
    if (!clearedBase) {
        return { events: [], core: postClearCore, matchState: input.matchState };
    }

    const events: SmashUpEvent[] = [];
    let core = postClearCore;
    let matchState = input.matchState ? { ...input.matchState, core } : undefined;
    const baseKey = clearEvent.payload.baseInstanceId ?? `${baseIndex}:${clearEvent.payload.baseDefId}`;
    const frameId = `base-cleared-minion-discarded-frame:${baseKey}:${clearEvent.timestamp}`;
    const triggers: TriggerQueuedEvent['payload']['triggers'] = [];
    for (const minion of clearedBase.minions) {
        const ownerDiscardBefore = preClearCore.players[minion.owner]?.discard ?? [];
        const ownerDiscardAfter = postClearCore.players[minion.owner]?.discard ?? [];
        if (
            countDiscardedCardUid(ownerDiscardAfter, minion.uid) <=
            countDiscardedCardUid(ownerDiscardBefore, minion.uid)
        ) {
            continue;
        }

        const sourceEventId = `base-cleared-minion-discarded:${baseKey}:minion:${minion.uid}:${clearEvent.timestamp}`;
        const queued = collectTriggers(preClearCore, 'onMinionDiscardedFromBase', {
            state: preClearCore,
            matchState,
            playerId: minion.controller,
            baseIndex,
            triggerMinionUid: minion.uid,
            triggerMinionDefId: minion.defId,
            triggerMinionPower: getEffectivePower(preClearCore, minion, baseIndex),
            triggerMinion: minion,
            controllerId: minion.controller,
            reason: 'base_cleared',
            frameId,
            sourceEventId,
            random,
            now: clearEvent.timestamp,
        });
        if (!queued) continue;
        triggers.push(...queued.payload.triggers);
    }

    if (triggers.length > 0) {
        const queued: TriggerQueuedEvent = {
            type: SU_EVENTS.TRIGGER_QUEUED,
            payload: { triggers },
            timestamp: clearEvent.timestamp,
        };
        events.push(queued);
        core = applyTriggerQueueFactEvent(core, queued);
        if (matchState) {
            matchState = { ...matchState, core };
        }
    }

    return { events, core, matchState };
}

export function updateStartTurnFactPlayer(
    core: SmashUpCore,
    playerId: PlayerId,
    update: (player: PlayerState) => PlayerState,
): SmashUpCore {
    const player = core.players[playerId];
    if (!player) return core;
    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: update(player),
        },
    };
}

export function removeCardFromZones(cards: CardInstance[], cardUid: string): CardInstance[] {
    return cards.filter((card) => card.uid !== cardUid);
}

export function findCardInPlayerZones(player: PlayerState, cardUid: string): CardInstance | undefined {
    return (
        player.hand.find((card) => card.uid === cardUid) ??
        player.deck.find((card) => card.uid === cardUid) ??
        player.discard.find((card) => card.uid === cardUid) ??
        player.storedCards?.find((card) => card.uid === cardUid)
    );
}

export function applyStartTurnFactCardsDrawn(core: SmashUpCore, event: CardsDrawnEvent): SmashUpCore {
    return updateStartTurnFactPlayer(core, event.payload.playerId, (player) => {
        const drawnCards: CardInstance[] = [];
        let deck = [...player.deck];
        for (const uid of event.payload.cardUids) {
            const index = deck.findIndex((card) => card.uid === uid);
            if (index < 0) continue;
            drawnCards.push(deck[index]);
            deck = [...deck.slice(0, index), ...deck.slice(index + 1)];
        }
        if (drawnCards.length === 0) return player;
        return {
            ...player,
            hand: [...player.hand, ...drawnCards],
            deck,
        };
    });
}

export function applyStartTurnFactDeckReshuffled(core: SmashUpCore, event: DeckReshuffledEvent): SmashUpCore {
    return updateStartTurnFactPlayer(core, event.payload.playerId, (player) => {
        const allCards = [...player.deck, ...player.discard];
        const cardMap = new Map(allCards.map((card) => [card.uid, card]));
        const deckUidSet = new Set(event.payload.deckUids);
        const referencedCards = event.payload.deckUids
            .map((uid) => cardMap.get(uid))
            .filter((card): card is CardInstance => card !== undefined);
        return {
            ...player,
            deck: [...player.deck.filter((card) => !deckUidSet.has(card.uid)), ...referencedCards],
            discard: player.discard.filter((card) => !deckUidSet.has(card.uid)),
        };
    });
}

export function applyStartTurnFactDeckReordered(core: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    const payload = event.payload as {
        playerId: PlayerId;
        sourcePlayerId?: PlayerId;
        deckUids: string[];
    };
    const player = core.players[payload.playerId];
    if (!player) return core;

    const referencedUids = new Set(payload.deckUids);
    const cardLookup = new Map<string, CardInstance>();
    for (const card of [...player.hand, ...player.deck, ...player.discard]) {
        if (referencedUids.has(card.uid) && !cardLookup.has(card.uid)) {
            cardLookup.set(card.uid, card);
        }
    }

    const sourcePlayer =
        payload.sourcePlayerId && payload.sourcePlayerId !== payload.playerId
            ? core.players[payload.sourcePlayerId]
            : undefined;
    if (sourcePlayer) {
        for (const card of [...sourcePlayer.hand, ...sourcePlayer.deck, ...sourcePlayer.discard]) {
            if (referencedUids.has(card.uid) && !cardLookup.has(card.uid)) {
                cardLookup.set(card.uid, card);
            }
        }
    }

    const reorderedDeck = payload.deckUids
        .map((uid) => cardLookup.get(uid))
        .filter((card): card is CardInstance => card !== undefined);
    const stripReferencedCards = (cards: CardInstance[]) => cards.filter((card) => !referencedUids.has(card.uid));

    const players = {
        ...core.players,
        [payload.playerId]: {
            ...player,
            hand: sourcePlayer ? stripReferencedCards(player.hand) : player.hand,
            deck: reorderedDeck,
            discard: stripReferencedCards(player.discard),
        },
    };
    if (sourcePlayer && payload.sourcePlayerId) {
        players[payload.sourcePlayerId] = {
            ...sourcePlayer,
            hand: stripReferencedCards(sourcePlayer.hand),
            deck: stripReferencedCards(sourcePlayer.deck),
            discard: stripReferencedCards(sourcePlayer.discard),
        };
    }

    return { ...core, players };
}

export function buildStartTurnFactPlayedMinion(event: MinionPlayedEvent): MinionOnBase {
    const { cardUid, defId, playerId, ownerId, power, fromDiscard, fromDeck, fromBuried, fromStored } = event.payload;
    return {
        uid: cardUid,
        defId,
        controller: playerId,
        owner: ownerId ?? playerId,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        playedThisTurn: true,
        attachedActions: [],
        metadata:
            fromDiscard || fromDeck || fromBuried || fromStored
                ? { playedFrom: fromDiscard ? 'discard' : fromDeck ? 'deck' : fromBuried ? 'buried' : 'stored' }
                : undefined,
    };
}

export function applyStartTurnFactMinionPlayed(core: SmashUpCore, event: MinionPlayedEvent): SmashUpCore {
    const player = core.players[event.payload.playerId];
    if (!player) return core;
    const resolvedBaseIndex =
        resolveLiveBaseIndex(core, event.payload.baseIndex, event.payload.baseDefId) ?? event.payload.baseIndex;
    if (!core.bases[resolvedBaseIndex]) return core;

    const cardInHand = player.hand.some((card) => card.uid === event.payload.cardUid);
    const cardInDeck = player.deck.some((card) => card.uid === event.payload.cardUid);
    const shouldRemoveFromHand =
        !event.payload.fromDiscard &&
        !event.payload.fromBuried &&
        !event.payload.fromStored &&
        (!event.payload.fromDeck || cardInHand);
    const nextPlayer: PlayerState = {
        ...player,
        hand:
            event.payload.allowImplicitSource || shouldRemoveFromHand
                ? removeCardFromZones(player.hand, event.payload.cardUid)
                : player.hand,
        discard:
            event.payload.allowImplicitSource || event.payload.fromDiscard
                ? removeCardFromZones(player.discard, event.payload.cardUid)
                : player.discard,
        deck:
            event.payload.allowImplicitSource || (event.payload.fromDeck && cardInDeck)
                ? removeCardFromZones(player.deck, event.payload.cardUid)
                : player.deck,
        storedCards:
            event.payload.allowImplicitSource || event.payload.fromStored
                ? removeCardFromZones(player.storedCards ?? [], event.payload.cardUid)
                : player.storedCards,
    };

    return {
        ...core,
        players: {
            ...core.players,
            [event.payload.playerId]: nextPlayer,
        },
        bases: core.bases.map((base, index) => {
            if (index !== resolvedBaseIndex) return base;
            return {
                ...base,
                minions: [...base.minions, buildStartTurnFactPlayedMinion(event)],
                buriedCards: event.payload.fromBuried
                    ? (base.buriedCards ?? []).filter((card) => card.uid !== event.payload.cardUid)
                    : base.buriedCards,
            };
        }),
    };
}

export function applyStartTurnFactMinionDestroyed(core: SmashUpCore, event: MinionDestroyedEvent): SmashUpCore {
    const { minionUid, minionDefId, fromBaseIndex, ownerId } = event.payload;
    const base = core.bases[fromBaseIndex];
    if (!base) return core;
    const minion = base.minions.find((candidate) => candidate.uid === minionUid);
    const owner = core.players[ownerId];
    if (!owner) return core;
    const destroyedCard: CardInstance = {
        uid: minionUid,
        defId: minion?.defId ?? minionDefId,
        type: 'minion',
        owner: ownerId,
    };
    return {
        ...core,
        players: {
            ...core.players,
            [ownerId]: {
                ...owner,
                discard: owner.discard.some((card) => card.uid === minionUid)
                    ? owner.discard
                    : [...owner.discard, destroyedCard],
            },
        },
        bases: core.bases.map((entry, index) =>
            index !== fromBaseIndex
                ? entry
                : { ...entry, minions: entry.minions.filter((candidate) => candidate.uid !== minionUid) },
        ),
    };
}

export function applyStartTurnFactMinionReturned(core: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    const payload = event.payload as {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toPlayerId: PlayerId;
    };
    const base = core.bases[payload.fromBaseIndex];
    const player = core.players[payload.toPlayerId];
    if (!base || !player) return core;
    const minion = base.minions.find((candidate) => candidate.uid === payload.minionUid);
    const returnedCard: CardInstance = {
        uid: payload.minionUid,
        defId: minion?.defId ?? payload.minionDefId,
        type: 'minion',
        owner: minion?.owner ?? payload.toPlayerId,
    };
    return {
        ...core,
        players: {
            ...core.players,
            [payload.toPlayerId]: {
                ...player,
                hand: player.hand.some((card) => card.uid === payload.minionUid)
                    ? player.hand
                    : [...player.hand, returnedCard],
            },
        },
        bases: core.bases.map((entry, index) =>
            index !== payload.fromBaseIndex
                ? entry
                : { ...entry, minions: entry.minions.filter((candidate) => candidate.uid !== payload.minionUid) },
        ),
    };
}

export function applyStartTurnFactBuriedReturnedToHand(core: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    const payload = event.payload as {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        baseIndex: number;
    };
    const player = core.players[payload.playerId];
    const base = core.bases[payload.baseIndex];
    if (!player || !base) return core;
    const buried = (base.buriedCards ?? []).find((card) => card.uid === payload.cardUid);
    const def = getCardDef(buried?.defId ?? payload.defId);
    const returnedCard: CardInstance = {
        uid: payload.cardUid,
        defId: buried?.defId ?? payload.defId,
        type: def?.type === 'minion' ? 'minion' : 'action',
        owner: buried?.trueOwnerId ?? payload.playerId,
    };
    return {
        ...core,
        players: {
            ...core.players,
            [payload.playerId]: {
                ...player,
                hand: player.hand.some((card) => card.uid === payload.cardUid)
                    ? player.hand
                    : [...player.hand, returnedCard],
            },
        },
        bases: core.bases.map((entry, index) =>
            index !== payload.baseIndex
                ? entry
                : { ...entry, buriedCards: (entry.buriedCards ?? []).filter((card) => card.uid !== payload.cardUid) },
        ),
    };
}

export function applyStartTurnFactMinionMoved(core: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    const payload = event.payload as {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
        toBaseDefId?: string;
    };
    const fromBase = core.bases[payload.fromBaseIndex];
    const resolvedToBaseIndex =
        resolveLiveBaseIndex(core, payload.toBaseIndex, payload.toBaseDefId) ?? payload.toBaseIndex;
    const toBase = core.bases[resolvedToBaseIndex];
    if (!fromBase || !toBase) return core;
    const minion = fromBase.minions.find((candidate) => candidate.uid === payload.minionUid);
    if (!minion) return core;
    return {
        ...core,
        bases: core.bases.map((base, index) => {
            if (index === payload.fromBaseIndex) {
                return { ...base, minions: base.minions.filter((candidate) => candidate.uid !== payload.minionUid) };
            }
            if (index === resolvedToBaseIndex) {
                return { ...base, minions: [...base.minions, minion] };
            }
            return base;
        }),
    };
}

export function applyStartTurnFactCardToDeck(
    core: SmashUpCore,
    event: SmashUpEvent,
    placement: 'top' | 'bottom',
): SmashUpCore {
    const payload = event.payload as {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
    };
    return updateStartTurnFactPlayer(core, payload.ownerId, (player) => {
        const existingCard =
            findCardInPlayerZones(player, payload.cardUid) ??
            ({
                uid: payload.cardUid,
                defId: payload.defId,
                type: getCardDef(payload.defId)?.type === 'minion' ? 'minion' : 'action',
                owner: payload.ownerId,
            } satisfies CardInstance);
        const withoutCard = {
            ...player,
            hand: removeCardFromZones(player.hand, payload.cardUid),
            deck: removeCardFromZones(player.deck, payload.cardUid),
            discard: removeCardFromZones(player.discard, payload.cardUid),
            storedCards: removeCardFromZones(player.storedCards ?? [], payload.cardUid),
        };
        return {
            ...withoutCard,
            deck: placement === 'top' ? [existingCard, ...withoutCard.deck] : [...withoutCard.deck, existingCard],
        };
    });
}

export function applyStartTurnFactEvent(core: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    switch (event.type) {
        case SU_EVENTS.CARDS_DRAWN:
            return applyStartTurnFactCardsDrawn(core, event as CardsDrawnEvent);
        case SU_EVENTS.DECK_RESHUFFLED:
            return applyStartTurnFactDeckReshuffled(core, event as DeckReshuffledEvent);
        case SU_EVENTS.DECK_REORDERED:
            return applyStartTurnFactDeckReordered(core, event);
        case SU_EVENTS.MINION_PLAYED:
            return applyStartTurnFactMinionPlayed(core, event as MinionPlayedEvent);
        case SU_EVENTS.MINION_DESTROYED:
            return applyStartTurnFactMinionDestroyed(core, event as MinionDestroyedEvent);
        case SU_EVENTS.MINION_RETURNED:
            return applyStartTurnFactMinionReturned(core, event);
        case SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND:
            return applyStartTurnFactBuriedReturnedToHand(core, event);
        case SU_EVENTS.MINION_MOVED:
            return applyStartTurnFactMinionMoved(core, event);
        case SU_EVENTS.CARD_TO_DECK_TOP:
            return applyStartTurnFactCardToDeck(core, event, 'top');
        case SU_EVENTS.CARD_TO_DECK_BOTTOM:
            return applyStartTurnFactCardToDeck(core, event, 'bottom');
        default:
            return core;
    }
}

export function processImmediateStartTurnMinionTriggers(
    startTurnCore: SmashUpCore,
    events: SmashUpEvent[],
    currentPlayerId: PlayerId,
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    processedPlayedUids: Set<string> = new Set(),
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const finalEvents: SmashUpEvent[] = [];
    let startTurnFactCore = startTurnCore;
    let currentMatchState = matchState ? { ...matchState, core: startTurnCore } : undefined;

    for (const event of events) {
        finalEvents.push(event);
        startTurnFactCore = applyStartTurnFactEvent(startTurnFactCore, event);
        if (!claimSmashUpImmediateStartTurnEvent(event)) continue;
        if (currentMatchState) {
            currentMatchState = { ...currentMatchState, core: startTurnFactCore };
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

        const resolvedBaseIndex =
            resolveLiveBaseIndex(startTurnFactCore, playedEvent.payload.baseIndex, playedEvent.payload.baseDefId) ??
            playedEvent.payload.baseIndex;
        const playedMinion = startTurnFactCore.bases[resolvedBaseIndex]?.minions.find(
            (candidate) => candidate.uid === playedEvent.payload.cardUid,
        );
        if (!playedMinion || playedMinion.controller !== currentPlayerId) continue;

        const immediateResult = fireTriggerForSource(startTurnFactCore, playedEvent.payload.defId, 'onTurnStart', {
            state: startTurnFactCore,
            matchState: currentMatchState,
            playerId: currentPlayerId,
            baseIndex: resolvedBaseIndex,
            triggerMinion: playedMinion,
            triggerMinionUid: playedMinion.uid,
            triggerMinionDefId: playedMinion.defId,
            random,
            now: event.timestamp,
        });

        if (immediateResult.matchState) {
            currentMatchState = { ...immediateResult.matchState, core: startTurnFactCore };
        }
        if (immediateResult.events.length === 0) continue;

        const processedImmediate = postProcessSystemEvents(
            startTurnFactCore,
            immediateResult.events,
            random,
            currentMatchState,
            {
                skipImmediateStartTurnMinionTriggers: true,
                skipReactionQueueResolution: true,
            },
        );
        const processedImmediateMatchState = processedImmediate.matchState
            ? { ...processedImmediate.matchState, core: startTurnFactCore }
            : currentMatchState;

        const recursiveResult = processImmediateStartTurnMinionTriggers(
            startTurnFactCore,
            processedImmediate.events,
            currentPlayerId,
            random,
            processedImmediateMatchState,
            processedPlayedUids,
        );

        finalEvents.push(...recursiveResult.events);
        for (const recursiveEvent of recursiveResult.events) {
            startTurnFactCore = applyStartTurnFactEvent(startTurnFactCore, recursiveEvent);
        }
        if (recursiveResult.matchState) {
            currentMatchState = { ...recursiveResult.matchState, core: startTurnFactCore };
        } else if (currentMatchState) {
            currentMatchState = { ...currentMatchState, core: startTurnFactCore };
        }
    }

    return currentMatchState ? { events: finalEvents, matchState: currentMatchState } : { events: finalEvents };
}

export function getPlayCardsContextForBuriedPlay(
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

export function resolveTitanClashEventsOnBase(
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
        ? titansOnBase.find((titan) => titan.uid === challengerTitanUid)
        : titansOnBase[titansOnBase.length - 1];
    if (!challenger) return { events: [], matchState };

    const defender = titansOnBase.find((titan) => titan.uid !== challenger.uid);
    if (!defender) return { events: [], matchState };

    const challengerPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, challenger.controllerId);
    const defenderPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, defender.controllerId);
    const loser = challengerPower > defenderPower ? defender : challenger;

    if (loser.defId === 'fairies_spirit_of_the_forest' && loser.location.zone === 'base' && matchState) {
        const visitedBaseIndices = new Set(spiritOfForestVisitedBaseIndices);
        const otherBases = state.bases
            .map((candidateBase, index) => ({
                baseIndex: index,
                label: getBaseDef(candidateBase.defId)?.name ?? `基地 ${index + 1}`,
            }))
            .filter((candidate) => candidate.baseIndex !== loser.location.baseIndex);
        if (otherBases.length > 0) {
            const baseTargetOptions = buildBaseTargetOptions(otherBases, state).map((option) => {
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

export function shouldDeferTitanClashForEvent(state: SmashUpCore, event: SmashUpEvent, baseIndex: number): boolean {
    if (!state.activeDuel || state.activeDuel.baseIndex !== baseIndex) return false;
    if (event.type !== SU_EVENT_TYPES.TITAN_PLAYED && event.type !== SU_EVENT_TYPES.TITAN_MOVED) return false;

    const titan = getTitanByUid(state, event.payload.titanUid);
    return (
        titan?.defId === 'pecos_bill' &&
        titan.location.zone === 'base' &&
        titan.location.baseIndex === baseIndex &&
        titan.metadata?.deferClashUntilDuelEnds === true
    );
}

export function resolveTitanClashEvents(
    state: SmashUpCore,
    event: SmashUpEvent,
    matchState?: MatchState<SmashUpCore>,
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (event.type !== SU_EVENT_TYPES.TITAN_PLAYED && event.type !== SU_EVENT_TYPES.TITAN_MOVED) {
        return { events: [], matchState };
    }

    const baseIndex = event.type === SU_EVENT_TYPES.TITAN_PLAYED ? event.payload.baseIndex : event.payload.toBaseIndex;
    if (shouldDeferTitanClashForEvent(state, event, baseIndex)) {
        return { events: [], matchState };
    }

    const spiritOfForestVisitedBaseIndices =
        event.type === SU_EVENT_TYPES.TITAN_MOVED &&
        Array.isArray(event.payload.metadata?.spiritOfTheForestClashVisitedBaseIndices)
            ? event.payload.metadata.spiritOfTheForestClashVisitedBaseIndices.filter(
                  (value): value is number => typeof value === 'number',
              )
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

export function resolveDeferredPecosBillClashEvents(
    state: SmashUpCore,
    now: number,
    matchState?: MatchState<SmashUpCore>,
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (state.activeDuel) return { events: [], matchState };

    const events: SmashUpEvent[] = [];
    let workingState = state;
    let workingMatchState = matchState;
    const processedBases = new Set<number>();
    const deferredTitans = (state.titans ?? []).filter(
        (titan) =>
            titan.defId === 'pecos_bill' &&
            titan.location.zone === 'base' &&
            titan.metadata?.deferClashUntilDuelEnds === true,
    );

    for (const titan of deferredTitans) {
        if (titan.location.zone !== 'base' || processedBases.has(titan.location.baseIndex)) continue;
        processedBases.add(titan.location.baseIndex);

        const clashResult = acceptSmashUpDerivedEvents(
            workingState,
            resolveTitanClashEventsOnBase(workingState, titan.location.baseIndex, now, titan.uid, workingMatchState),
        );
        if (clashResult.matchState) {
            workingMatchState = clashResult.matchState;
        }
        if (clashResult.events.length > 0) {
            events.push(...clashResult.events);
            for (const clashEvent of clashResult.events) {
                workingState = applyPostProcessPrefixEvent(workingState, clashEvent);
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
            workingState = applyPostProcessPrefixEvent(workingState, clearedEvent);
        }
    }

    return { events, matchState: workingMatchState };
}

// ============================================================================

// ============================================================================

export function planSmashUpEventFamilies(
    state: SmashUpCore,
    events: SmashUpEvent[],
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    options?: PostProcessSystemEventsOptions & {
        skipImmediateStartTurnMinionTriggers?: boolean;
        recordImmediateStartTurnProcessedMinionUids?: boolean;
        skipReactionQueueResolution?: boolean;
        actorPlayerId?: PlayerId;
    },
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (events.length > 0 && events.every((event) => event.type === SU_EVENTS.REACTION_PASS_REQUESTED)) {
        return { events, matchState };
    }

    const now = events.length > 0 && typeof events[0].timestamp === 'number' ? events[0].timestamp : 0;
    // 当前玩家作为 trigger 的 sourcePlayerId
    let pid = options?.actorPlayerId ?? getCurrentPlayerId(state);
    const turnStartedEvent = [...events].reverse().find((event) => event.type === SU_EVENTS.TURN_STARTED) as
        TurnStartedEvent | undefined;
    if (turnStartedEvent) {
        pid = turnStartedEvent.payload.playerId;
    }

    let ms = matchState ?? createReactionQueueFallbackState(state);
    const inputEventsAlreadyReduced = !!options?.inputEventsAlreadyReduced;

    const destroySys = getSmashUpRuntimeSys(ms);
    if (!destroySys._processedDestroyEvents || !(destroySys._processedDestroyEvents instanceof Set)) {
        destroySys._processedDestroyEvents = new Set<string>();
    }
    if (!destroySys._processedAffectEvents || !(destroySys._processedAffectEvents instanceof Set)) {
        destroySys._processedAffectEvents = new Set<string>();
    }
    const processedDestroyEventKeys = destroySys._processedDestroyEvents;
    const processedAffectEventKeys = destroySys._processedAffectEvents;
    const destroyEventKeysInBatch = new Set<string>();
    const affectEventKeysInBatch = new Set<string>();
    for (const event of events) {
        if (event.type === SU_EVENTS.MINION_DESTROYED) {
            destroyEventKeysInBatch.add(buildDestroyEventKey(event as MinionDestroyedEvent));
        }
        for (const key of buildAffectEventKeys(ms.core, event as SmashUpEvent, pid)) {
            affectEventKeysInBatch.add(key);
        }
    }
    // 渚濇鎵ц淇濇姢杩囨护 + trigger 鍚庡鐞嗭紙閾惧紡浼犻€?matchState锛?
    // destroy 鈫?move 寰幆鐩村埌绋冲畾锛坢ove 瑙﹀彂鍣ㄥ彲鑳戒骇鐢熸柊鐨?MINION_DESTROYED锛?
    // Every family reconstructs its own prefix from the accepted batch's
    // pre-core. Only sys crosses a family boundary; LKI is never lost to a
    // previous family's whole-batch materialization.
    const familyDerived: SmashUpEvent[] = [];
    for (const process of [
        processDestroyTriggers,
        processMoveTriggers,
        processReturnToHandTriggers,
        processAffectTriggers,
        processDeckInspectionTriggers,
    ]) {
        // The batch owner resolves the reaction queue after all fact families.
        // A nested queued trigger must not re-enter the live queue mid-family.
        const result = process === processDestroyTriggers
            ? processDestroyTriggers(events, { ...ms, core: state }, pid, random, now, { skipReactionQueueResolution: true })
            : process(events, { ...ms, core: state }, pid, random, now);
        if (result.matchState) ms = { ...ms, sys: result.matchState.sys };
        familyDerived.push(...getNewSmashUpEventOccurrences(events, result.events));
    }
    const afterDeckInspection = { events };

    // 先 reduce 到临时 core 中，让 fireMinionPlayedTriggers 拿到最新的牌库/手牌状态。
    // 必须防止同一 MINION_PLAYED 事件被重复处理。去重策略：

    const derivedEvents: SmashUpEvent[] = [...familyDerived];

    const prePlayEvents: SmashUpEvent[] = [];
    let prePlayCore = state;
    const appendPrePlayEvent = (event: SmashUpEvent) => {
        prePlayEvents.push(event);
        prePlayCore = applyPostProcessPrefixEvent(prePlayCore, event);
    };

    // 鍒濆鍖栧凡澶勭悊浜嬩欢闆嗗悎锛堝鏋滀笉瀛樺湪锛?
    // 浣跨敤 any 绫诲瀷鏂█缁曡繃 SystemState 绫诲瀷闄愬埗锛堣繖鏄父鎴忕壒瀹氱殑涓存椂鐘舵€侊級
    // 銆怐45 淇銆戠粺涓€澶勭悊 MINION_PLAYED 鍜?ACTION_PLAYED 鐨勫幓閲?
    const sysState = getSmashUpRuntimeSys(ms);
    if (!sysState._processedPlayedEvents || !(sysState._processedPlayedEvents instanceof Set)) {
        sysState._processedPlayedEvents = new Set<string>();
    }
    const processedSet = sysState._processedPlayedEvents;

    if (!(sysState._processedMunchkinMonsterPlayedEvents instanceof Set)) {
        sysState._processedMunchkinMonsterPlayedEvents = new Set<string>();
    }
    const processedMunchkinMonsterPlayedEvents = sysState._processedMunchkinMonsterPlayedEvents;
    if (!(sysState._processedMunchkinMonsterDefeatedEvents instanceof Set)) {
        sysState._processedMunchkinMonsterDefeatedEvents = new Set<string>();
    }
    const processedMunchkinMonsterDefeatedEvents = sysState._processedMunchkinMonsterDefeatedEvents;

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
        if (isSmashUpEventSettled(event)) {
            appendPrePlayEvent(event);
            continue;
        }
        if (event.type === SU_EVENTS.VP_AWARDED) {
            const vpEvt = event as VpAwardedEvent;
            const tempCore = prePlayCore;
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
            appendPrePlayEvent(event);
        } else if (event.type === SU_EVENTS.BASE_SCORED) {
            const scoreEvt = event as BaseScoredEvent;
            let tempCore = prePlayCore;
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
            appendPrePlayEvent(event);
        } else if (event.type === SU_EVENTS.BASE_CLEARED) {
            const clearEvt = event as BaseClearedEvent;
            const preClearCore = prePlayCore;
            const postClearCore = inputEventsAlreadyReduced ? state : reduceBaseClearedEvent(preClearCore, clearEvt);
            const queuedClearDiscard = queueBaseClearedMinionDiscardTriggers({
                preClearCore,
                postClearCore,
                clearEvent: clearEvt,
                random,
                matchState: { ...ms, core: postClearCore },
            });
            derivedEvents.push(...queuedClearDiscard.events);
            ms = queuedClearDiscard.matchState ?? ms;
            appendPrePlayEvent(event);
        } else if (event.type === SU_EVENTS.BASE_REPLACED) {
            const replaceEvt = event as BaseReplacedEvent;
            const preReplaceCore = prePlayCore;
            const postReplaceCore = inputEventsAlreadyReduced
                ? state
                : reduceBaseReplacedEvent(preReplaceCore, replaceEvt);
            const sourceEventId = `base-replaced:${replaceEvt.payload.baseIndex}:${replaceEvt.payload.newBaseDefId}:${event.timestamp}`;
            const queuedReveal = collectExtendedBaseAbilityTriggers({
                core: postReplaceCore,
                timing: 'onBaseRevealed',
                ownerPlayerId: pid,
                baseIndex: replaceEvt.payload.baseIndex,
                reason: 'base_replaced',
                frameId: sourceEventId,
                sourceEventId,
                now: event.timestamp,
            });
            if (queuedReveal) {
                derivedEvents.push(queuedReveal as unknown as SmashUpEvent);
            }
            appendPrePlayEvent(event);
        } else if (event.type === SU_EVENTS.CARDS_DISCARDED || event.type === SU_EVENTS.CARDS_MILLED) {
            const discardEvt = event as {
                type: string;
                payload: { playerId: PlayerId; cardUids: string[] };
                timestamp: number;
            };
            const tempCore = prePlayCore;
            const sourceZone = event.type === SU_EVENTS.CARDS_MILLED ? 'deck' : 'hand';
            // 初始命令事件在进入这里前可能已经被管线归约；此时卡牌已经离开手牌/牌库，
            // 只能从归约后的各玩家弃牌堆按 UID 回查，才能为弃牌触发保留完整卡牌快照。
            const sourceCards = inputEventsAlreadyReduced
                ? Object.values(tempCore.players).flatMap((player) => player.discard ?? [])
                : sourceZone === 'deck'
                  ? (tempCore.players[discardEvt.payload.playerId]?.deck ?? [])
                  : (tempCore.players[discardEvt.payload.playerId]?.hand ?? []);
            const uidSet = new Set(discardEvt.payload.cardUids);
            const discardedCards = sourceCards
                .filter((card) => uidSet.has(card.uid))
                .map((card) => ({ uid: card.uid, defId: card.defId, ownerId: card.owner }));
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
            appendPrePlayEvent(event);
        } else if (event.type === SU_EVENTS.MINION_PLAYED) {
            const playedEvt = event as MinionPlayedEvent;

            const eventKey = `MINION:${playedEvt.payload.cardUid}@${playedEvt.payload.baseIndex}`;

            if (processedSet.has(eventKey)) {
                appendPrePlayEvent(event);
                continue;
            }

            // 标记为已处理
            processedSet.add(eventKey);

            // 将之前积累的事件 reduce 到临时 core

            let tempCore = prePlayCore;

            const payload = event.payload;
            if (!inputEventsAlreadyReduced) {
                tempCore = reduceMinionPlayedEvent(tempCore, playedEvt);
            } else if (payload.fromDeck || payload.fromDiscard || payload.fromBuried || payload.fromStored) {
                tempCore = reduceMinionPlayedEvent(tempCore, playedEvt);
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
                appendPrePlayEvent(event);
                continue;
            }

            // 标记为已处理
            processedSet.add(eventKey);

            // ACTION_PLAYED 的 onActionPlayed 触发：基底/ongoing 同步入队
            let tempCore = ms.core;
            let tempMatchState = ms;
            const sourceEventId = `action-played:${playedEvt.payload.cardUid}:${event.timestamp}`;
            const frameId = `action-played-frame:${playedEvt.payload.cardUid}:${event.timestamp}`;

            const targetBaseWasReplacedByThisAction =
                playedEvt.payload.targetBaseIndex !== undefined &&
                afterDeckInspection.events.some((candidate) => {
                    if (candidate.type !== SU_EVENTS.BASE_REPLACED) return false;
                    const replaced = candidate as BaseReplacedEvent;
                    return (
                        replaced.timestamp === event.timestamp &&
                        replaced.payload.baseIndex === playedEvt.payload.targetBaseIndex
                    );
                });

            if (playedEvt.payload.targetBaseIndex !== undefined && !targetBaseWasReplacedByThisAction) {
                const queuedBase = collectBaseAbilityTriggers({
                    core: tempCore,
                    timing: 'onActionPlayed',
                    ownerPlayerId: playedEvt.payload.playerId,
                    baseIndex: playedEvt.payload.targetBaseIndex,
                    actionPlayScope: 'targetBase',
                    actionDestinationOverride: playedEvt.payload.destinationOverride,
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
                    tempCore = applyTriggerQueueFactEvent(tempCore, queuedBase as unknown as SmashUpEvent);
                    tempMatchState = { ...tempMatchState, core: tempCore };
                }

                const queuedExtendedBase = collectExtendedBaseAbilityTriggers({
                    core: tempCore,
                    timing: 'onActionPlayed',
                    ownerPlayerId: playedEvt.payload.playerId,
                    baseIndex: playedEvt.payload.targetBaseIndex,
                    reason: 'action-played',
                    actionDestinationOverride: playedEvt.payload.destinationOverride,
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
                    tempCore = applyTriggerQueueFactEvent(tempCore, queuedExtendedBase as unknown as SmashUpEvent);
                    tempMatchState = { ...tempMatchState, core: tempCore };
                }
            }

            for (let baseIndex = 0; baseIndex < tempCore.bases.length; baseIndex += 1) {
                const queuedGlobalBase = collectBaseAbilityTriggers({
                    core: tempCore,
                    timing: 'onActionPlayed',
                    ownerPlayerId: playedEvt.payload.playerId,
                    baseIndex,
                    actionPlayScope: 'allBases',
                    actionDestinationOverride: playedEvt.payload.destinationOverride,
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
                if (queuedGlobalBase) {
                    derivedEvents.push(queuedGlobalBase as unknown as SmashUpEvent);
                    tempCore = applyTriggerQueueFactEvent(tempCore, queuedGlobalBase as unknown as SmashUpEvent);
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
                tempCore = applyTriggerQueueFactEvent(tempCore, queuedActionTriggers);
                tempMatchState = { ...tempMatchState, core: tempCore };
            }

            ms = tempMatchState;
            appendPrePlayEvent(event);
        } else if (event.type === SU_EVENTS.MUNCHKIN_MONSTER_PLAYED) {
            const playedEvt = event as SmashUpEvent & {
                payload: { baseIndex: number; monsterDefId: string; monsterUid: string };
            };
            const eventKey = `MONSTER:${playedEvt.payload.monsterUid}@${playedEvt.payload.baseIndex}`;
            if (processedMunchkinMonsterPlayedEvents.has(eventKey)) {
                appendPrePlayEvent(event);
                continue;
            }
            processedMunchkinMonsterPlayedEvents.add(eventKey);
            let tempCore = prePlayCore;
            if (!inputEventsAlreadyReduced) {
                tempCore = reduceMunchkinMonsterPlayedEvent(tempCore, playedEvt as MunchkinMonsterPlayedEvent);
            }
            const base = tempCore.bases[playedEvt.payload.baseIndex];
            const monster = base?.monsters?.find((candidate) => candidate.uid === playedEvt.payload.monsterUid);
            if (base?.defId === 'base_whack_a_ghoul' && monster && isMunchkinUndeadMonster(monster.defId)) {
                derivedEvents.push({
                    type: SU_EVENTS.MUNCHKIN_MONSTER_TO_DECK_BOTTOM,
                    payload: {
                        baseIndex: playedEvt.payload.baseIndex,
                        monsterUid: monster.uid,
                        monsterDefId: monster.defId,
                        reason: 'base_whack_a_ghoul',
                    },
                    timestamp: event.timestamp,
                } as SmashUpEvent);
            }
            appendPrePlayEvent(event);
        } else if (event.type === SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED) {
            const defeatedEvt = event as SmashUpEvent & {
                payload: {
                    playerId: PlayerId;
                    baseIndex: number;
                    monsterDefId?: string;
                    monsterUid: string;
                    treasureUids?: string[];
                    grantTreasureExtraPlay?: boolean;
                    reason: string;
                };
            };
            const eventKey = `MONSTER_DEFEATED:${defeatedEvt.payload.monsterUid}@${defeatedEvt.payload.baseIndex}:${event.timestamp}`;
            if (processedMunchkinMonsterDefeatedEvents.has(eventKey)) {
                appendPrePlayEvent(event);
                continue;
            }
            processedMunchkinMonsterDefeatedEvents.add(eventKey);

            let tempCore = prePlayCore;
            const baseBeforeDefeat = tempCore.bases[defeatedEvt.payload.baseIndex];
            const monsterBeforeDefeat = baseBeforeDefeat?.monsters?.find(
                (candidate) => candidate.uid === defeatedEvt.payload.monsterUid,
            );
            const monsterDefId = monsterBeforeDefeat?.defId ?? defeatedEvt.payload.monsterDefId;
            const monsterPower = monsterDefId ? (getMunchkinSpecialCardDescriptor(monsterDefId)?.power ?? 0) : 0;
            if (!inputEventsAlreadyReduced) {
                tempCore = reduceMunchkinMonsterDefeatedEvent(tempCore, defeatedEvt as MunchkinMonsterDefeatedEvent);
            }
            let tempMatchState = { ...ms, core: tempCore };
            const sourceEventId = `monster-destroyed:${defeatedEvt.payload.monsterUid}:${defeatedEvt.payload.baseIndex}:${event.timestamp}`;
            const frameId = `monster-destroyed-frame:${defeatedEvt.payload.monsterUid}:${defeatedEvt.payload.baseIndex}:${event.timestamp}`;

            const queuedMonsterTriggers = collectTriggers(tempCore, 'onMonsterDestroyed', {
                state: tempCore,
                matchState: tempMatchState,
                playerId: defeatedEvt.payload.playerId,
                baseIndex: defeatedEvt.payload.baseIndex,
                destroyedMonsterUid: defeatedEvt.payload.monsterUid,
                destroyedMonsterDefId: monsterDefId,
                destroyedMonsterPower: monsterPower,
                destroyerId: defeatedEvt.payload.playerId,
                reason: defeatedEvt.payload.reason,
                frameId,
                sourceEventId,
                random,
                now: event.timestamp,
            });
            if (queuedMonsterTriggers) {
                derivedEvents.push(queuedMonsterTriggers);
                tempCore = applyTriggerQueueFactEvent(tempCore, queuedMonsterTriggers);
                tempMatchState = { ...tempMatchState, core: tempCore };
            }

            const queuedMonsterBaseTriggers = collectExtendedBaseAbilityTriggers({
                core: tempCore,
                timing: 'onMonsterDestroyed',
                ownerPlayerId: defeatedEvt.payload.playerId,
                baseIndex: defeatedEvt.payload.baseIndex,
                triggerMinionDefId: monsterDefId,
                triggerMinionPower: monsterPower,
                destroyerId: defeatedEvt.payload.playerId,
                reason: defeatedEvt.payload.reason,
                frameId,
                sourceEventId,
                now: event.timestamp,
            });
            if (queuedMonsterBaseTriggers) {
                derivedEvents.push(queuedMonsterBaseTriggers);
                tempCore = applyTriggerQueueFactEvent(tempCore, queuedMonsterBaseTriggers);
                tempMatchState = { ...tempMatchState, core: tempCore };
            }

            if (defeatedEvt.payload.grantTreasureExtraPlay) {
                const awardedUids = defeatedEvt.payload.treasureUids ?? [];
                const hand = tempCore.players[defeatedEvt.payload.playerId]?.hand ?? [];
                for (const treasureUid of awardedUids) {
                    const treasure = hand.find((card) => card.uid === treasureUid);
                    if (!treasure) continue;
                    if (getCardDef(treasure.defId)?.type === 'minion') {
                        derivedEvents.push(
                            grantExtraMinion(
                                defeatedEvt.payload.playerId,
                                'munchkin_warriors_cleave',
                                event.timestamp,
                                undefined,
                                { playTiming: 'immediate', specificCardUid: treasure.uid },
                            ),
                        );
                    } else {
                        derivedEvents.push(
                            grantExtraAction(
                                defeatedEvt.payload.playerId,
                                'munchkin_warriors_cleave',
                                event.timestamp,
                                { playTiming: 'immediate', restrictToCardUid: treasure.uid },
                            ),
                        );
                    }
                }
            }

            ms = tempMatchState;
            appendPrePlayEvent(event);
        } else {
            appendPrePlayEvent(event);
        }
    }

    let finalDerived = derivedEvents;

    const combined = afterDeckInspection.events;

    const talentDerived: SmashUpEvent[] = [];
    let talentCore = state;
    const shouldApplyForTalentScan = createUnreducedPostProcessEventPredicate(events, inputEventsAlreadyReduced);
    for (let eventIndex = 0; eventIndex < combined.length; eventIndex++) {
        const event = combined[eventIndex];
        if (shouldApplyForTalentScan(event)) {
            talentCore = applyPostProcessPrefixEvent(talentCore, event);
        }
        if (isSmashUpEventSettled(event) || event.type !== SU_EVENTS.TALENT_USED) continue;
        const talentEvent = event as TalentUsedEvent;
        const { playerId, minionUid, defId, baseIndex } = talentEvent.payload;
        if (!minionUid) continue;
        const triggerMinion = talentCore.bases[baseIndex]?.minions.find((minion) => minion.uid === minionUid);
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
            talentCore = applyTriggerQueueFactEvent(talentCore, queuedTalentTriggers);
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
            talentCore = applyTriggerQueueFactEvent(talentCore, queuedBaseTalent as unknown as SmashUpEvent);
        }
    }
    const combinedWithTalent = combined;

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
    const shouldApplyForTitanScan = createUnreducedPostProcessEventPredicate(events, inputEventsAlreadyReduced);
    for (let eventIndex = 0; eventIndex < combinedWithTalent.length; eventIndex++) {
        const event = combinedWithTalent[eventIndex];
        // state 已经包含了本轮原始领域事件（afterDeckInspection.events）的 reduce 结果；
        // 这里只需要把新增的派生事件继续 reduce 进临时 core，避免原始事件被重复结算。
        if (shouldApplyForTitanScan(event)) {
            titanCore = applyPostProcessPrefixEvent(titanCore, event);
        }
        if (
            event.type !== SU_EVENT_TYPES.TITAN_PLAYED &&
            event.type !== SU_EVENT_TYPES.TITAN_MOVED &&
            event.type !== SU_EVENT_TYPES.TITAN_REMOVED_FROM_PLAY
        )
            continue;

        if (isSmashUpEventSettled(event)) continue;
        if (event.type === SU_EVENT_TYPES.TITAN_PLAYED || event.type === SU_EVENT_TYPES.TITAN_MOVED) {
            const eventBaseIndex =
                event.type === SU_EVENT_TYPES.TITAN_PLAYED ? event.payload.baseIndex : event.payload.toBaseIndex;
            const eventKey = `${event.type}:${event.payload.titanUid}@${eventBaseIndex}`;
            if (processedTitanPositionEvents.has(eventKey)) continue;
            processedTitanPositionEvents.add(eventKey);

            const clashResult = acceptSmashUpDerivedEvents(
                titanCore,
                resolveTitanClashEvents(titanCore, event, titanCore === ms.core ? ms : { ...ms, core: titanCore }),
            );
            if (clashResult.matchState) {
                ms = clashResult.matchState;
            }
            if (clashResult.events.length > 0) {
                titanDerived.push(...clashResult.events);
                for (const clashEvent of clashResult.events) {
                    titanCore = applyPostProcessPrefixEvent(titanCore, clashEvent);
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
                    titanCore = applyTriggerQueueFactEvent(titanCore, queuedTitanMove);
                }
            }
        }

        if (event.type === SU_EVENT_TYPES.TITAN_REMOVED_FROM_PLAY) {
            const eventKey = `${event.type}:${event.payload.titanUid}:${event.payload.reason}:${event.payload.fromBaseIndex ?? 'none'}`;
            if (processedTitanRemovedEvents.has(eventKey)) continue;
            processedTitanRemovedEvents.add(eventKey);

            const queuedTitanRemoved = collectTriggers(
                titanCore,
                'onTitanRemovedFromPlay',
                {
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
                },
                { sourceDefIds: [event.payload.defId] },
            );
            if (queuedTitanRemoved) {
                titanDerived.push(queuedTitanRemoved);
                titanCore = applyTriggerQueueFactEvent(titanCore, queuedTitanRemoved);
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
            titanCore = applyPostProcessPrefixEvent(titanCore, deferredEvent);
        }
    }

    let finalEvents = [...combinedWithTalent, ...finalDerived, ...talentDerived, ...titanDerived];
    const immediateExtraEvents = finalEvents.filter(
        (event): event is LimitModifiedEvent =>
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

    // titanCore already includes the accepted input prefix, including consumed
    // triggers. Historical consumption must not block a newly queued reaction.
    const pendingTriggerIds = new Set((msForQueue.core.triggerQueue ?? []).map((trigger) => trigger.id));
    const hasNewMandatoryTrigger = finalEvents.some(
        (event) =>
            !isSmashUpEventSettled(event) &&
            event.type === SU_EVENTS.TRIGGER_QUEUED &&
            (event.payload.triggers ?? []).some(
                (trigger) =>
                    pendingTriggerIds.has(trigger.id) &&
                    (trigger.resolutionClass === 'mandatory' || trigger.mandatory === true),
            ),
    );
    if (
        !options?.skipReactionQueueResolution &&
        (hasNewMandatoryTrigger || !msForQueue.sys.interaction?.current)
    ) {
        const rq = maybeResolveReactionQueue(msForQueue, random, now, {
            materializeDomainEvents: false,
            suspendCurrentInteraction: hasNewMandatoryTrigger || Boolean(msForQueue.sys.interaction?.current),
        });
        if (rq) {
            finalEvents = [...finalEvents, ...rq.events];
            ms = rq.state;
        }
    }

    const startTurnWindowActive =
        ms.sys.phase === 'startTurn' || Boolean(getSmashUpRuntimeSys(ms)._smashupStartTurnWindowActive);
    const previouslyProcessedStartTurnMinionUids = new Set(
        getSmashUpRuntimeSys(ms)._ppseImmediateStartTurnProcessedMinionUids ?? [],
    );
    if (previouslyProcessedStartTurnMinionUids.size > 0) {
        ms = {
            ...ms,
            sys: {
                ...ms.sys,
                _ppseImmediateStartTurnProcessedMinionUids: undefined,
            } as SmashUpRuntimeSystemState,
        };
    }
    if (!options?.skipImmediateStartTurnMinionTriggers && startTurnWindowActive) {
        const processedPlayedUids = new Set(previouslyProcessedStartTurnMinionUids);
        const immediate = processImmediateStartTurnMinionTriggers(
            state,
            finalEvents,
            pid,
            random,
            ms,
            processedPlayedUids,
        );
        finalEvents = immediate.events;
        if (immediate.matchState) {
            ms = immediate.matchState;
        }
        const newlyProcessedUids = Array.from(processedPlayedUids).filter(
            (uid) => !previouslyProcessedStartTurnMinionUids.has(uid),
        );
        if (options?.recordImmediateStartTurnProcessedMinionUids && newlyProcessedUids.length > 0) {
            ms = {
                ...ms,
                sys: {
                    ...ms.sys,
                    _ppseImmediateStartTurnProcessedMinionUids: Array.from(processedPlayedUids),
                } as SmashUpRuntimeSystemState,
            };
        }
    }

    const hasStartTurnInteraction = !!ms.sys.interaction?.current || (ms.sys.interaction?.queue?.length ?? 0) > 0;

    const activeResolutionFrame = getActiveResolutionFrame(ms);
    const isActualStartTurnWindow =
        activeResolutionFrame?.kind === 'smashup:reaction:turn-start' ||
        (activeResolutionFrame?.metadata as { smashupReactionSession?: { frameKind?: string } } | undefined)
            ?.smashupReactionSession?.frameKind === 'turn-start';
    if (
        getSmashUpRuntimeSys(ms)._smashupStartTurnWindowActive &&
        hasStartTurnInteraction &&
        ms.sys.phase !== 'startTurn' &&
        isActualStartTurnWindow
    ) {
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
            } as SmashUpRuntimeSystemState,
        };
    }

    ms = queueActionReturnToHandPrompts(
        ms,
        events.filter((event) => !isSmashUpEventSettled(event)),
        now,
    );

    return { events: finalEvents, matchState: ms };
}

// Export postProcessSystemEvents for tests

export type SmashUpSettlementOptions = PostProcessSystemEventsOptions & {
    skipImmediateStartTurnMinionTriggers?: boolean;
    recordImmediateStartTurnProcessedMinionUids?: boolean;
    skipReactionQueueResolution?: boolean;
    actorPlayerId?: PlayerId;
};

/** One owner for command, hook, reaction and resumed-frame event settlement. */
export function postProcessSystemEvents(
    state: SmashUpCore,
    events: SmashUpEvent[],
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>,
    options?: SmashUpSettlementOptions,
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const context = getSmashUpSettlementContext() ?? createSmashUpSettlementContext(random);
    return withSmashUpSettlement(context, () => {
        const source = matchState ?? createReactionQueueFallbackState(state);
        const sys: SmashUpRuntimeSystemState = {
            ...source.sys,
            ...Object.fromEntries(Object.entries(source.sys)
                .filter(([, value]) => value instanceof Set)
                .map(([key, value]) => [key, new Set(value as Set<unknown>)])),
        };
        const actor = options?.actorPlayerId ?? context.command?.playerId ?? getCurrentPlayerId(state);
        return withSmashUpCandidatePreparer(
            (batch, prefix) => prepareSmashUpRuleCandidates(batch, prefix, actor, random),
            () => {
                let working = { ...source, sys };
                let current = events;
                for (let round = 0; round < 64; round += 1) {
                    const prepared = prepareSmashUpCandidates(current, { ...working, core: state });
                    current = prepared.events;
                    working = { ...working, sys: prepared.state.sys };
                    if (!current.some((event) => !isSmashUpEventSettled(event))) {
                        const shouldApply = createUnreducedPostProcessEventPredicate(
                            events,
                            Boolean(options?.inputEventsAlreadyReduced),
                        );
                        const core = current.reduce(
                            (prefix, event) =>
                                shouldApply(event) ? applyPostProcessPrefixEvent(prefix, event) : prefix,
                            state,
                        );
                        return { events: current, matchState: { ...working, core } };
                    }
                    const facts = withSmashUpFactBatch(current, () =>
                        withSmashUpSettlementPhase('facts', () =>
                            planSmashUpEventFamilies(state, current, random, working, options),
                        ),
                    );
                    current = facts.events;
                    if (facts.matchState) working = { ...working, sys: facts.matchState.sys };
                }
                throw new Error('SmashUp settlement exceeded 64 fact batches');
            },
        );
    });
}

export function prepareSmashUpEventBatch(
    args: PrepareEventBatchArgs<SmashUpCore, SmashUpCommand, SmashUpEvent>,
): PreparedEventBatch<SmashUpEvent> {
    const context = createSmashUpSettlementContext(args.random, args.command, args.commit);
    return withSmashUpSettlement(context, () => {
        const result = postProcessSystemEvents(args.state.core, args.events, args.random, args.state, {
            actorPlayerId: args.command?.playerId,
        });
        return { events: result.events, sys: result.matchState?.sys, evidence: context.evidence };
    });
}

function getNewSmashUpEventOccurrences(input: SmashUpEvent[], output: SmashUpEvent[]): SmashUpEvent[] {
    const remaining = new Map<SmashUpEvent, number>();
    for (const event of input) remaining.set(event, (remaining.get(event) ?? 0) + 1);
    return output.filter((event) => {
        const count = remaining.get(event) ?? 0;
        if (count > 0) {
            remaining.set(event, count - 1);
            return false;
        }
        return true;
    });
}

function prepareSmashUpRuleCandidates(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    actor: PlayerId,
    random: RandomFn,
): { events: SmashUpEvent[]; state: MatchState<SmashUpCore> } {
    let current = events;
    let working = state;
    const now = events[0]?.timestamp ?? 0;
    for (const process of [
        processDestroyTriggers,
        processMoveTriggers,
        processReturnToHandTriggers,
        processAffectTriggers,
    ]) {
        const result = process(current, { ...working, core: state.core }, actor, random, now);
        current = result.events;
        if (result.matchState) working = { ...working, sys: result.matchState.sys };
    }
    const clyde = processClydeDetachChoices(current, { ...working, core: state.core }, now);
    return { events: clyde.events, state: { ...working, sys: clyde.matchState?.sys ?? working.sys } };
}

function acceptSmashUpDerivedEvents(
    core: SmashUpCore,
    result: { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> },
): typeof result {
    const source = result.matchState ?? createReactionQueueFallbackState(core);
    const prepared = prepareSmashUpCandidates(result.events, { ...source, core });
    return { events: prepared.events, matchState: { ...source, sys: prepared.state.sys } };
}
