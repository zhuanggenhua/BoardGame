import type {
 MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    queueMinionPlayEffect,
    recoverCardsFromDiscard,
    removePowerCounter,
    revealHand,
    revealAndPickFromDeck,
    revealDeckTop,
    shuffleHandIntoDeck,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeContinuation,
    type AbilityProgram,
    type AbilityRuntimePromptResumeResult,
    createAbilityRuntimeSimpleChoice,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerBaseAbility, registerExtended as registerExtendedBase } from '../domain/baseAbilities';
import { getBaseDef, getCardDef, getMinionDef } from '../data/cards';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import {
    registerProtection,
    registerRestriction,
    registerTrigger,
} from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import {
    registerCustomBasePowerModifiers,
    registerCustomPowerModifiers,
} from '../domain/ongoingModifiers';
import type {
    CardInstance,
    CardsDrawnEvent,
    CardsDiscardedEvent,
    CardsMilledEvent,
    CardToDeckTopEvent,
    DeckReorderedEvent,
    DeckReshuffledEvent,
    MinionMetadataUpdatedEvent,
    MinionOnBase,
    MinionPlayedEvent,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { matchesDefId } from '../domain/utils';

const DISNEY_PROMPT_SOURCE = 'disney_four_factions_prompt';
const MICROBOT_SWARM = 'big_hero_6_microbot_swarm';
const MUFASA = 'lion_king_mufasa';
const HAKUNA_MATATA = 'lion_king_hakuna_matata';
const TIMON_AND_PUMBAA = 'lion_king_timon_and_pumbaa';
const MULAN_COUNTER_TURN_KEY = 'mulan_mulan_power_counter_turn';

const DETERMINISTIC_RANDOM: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

type MinionChoice = {
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
};

type BaseChoice = {
    baseIndex: number;
};

type CardChoice = {
    cardUid: string;
    defId: string;
    ownerId?: PlayerId;
    zone?: 'hand' | 'deck' | 'discard';
};

type ModeChoice = {
    mode: string;
};

type DisneyPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceId: string;
    title: string;
    kind:
        | 'addCounters'
        | 'addTempPower'
        | 'destroyMinion'
        | 'destroyOwnThenPlayDeckMinion'
        | 'returnMinion'
        | 'moveMinionTarget'
        | 'moveMinionDestination'
        | 'moveCountersSource'
        | 'moveCountersTarget'
        | 'baseDrawCounters'
        | 'baseDrawOwnMinions'
        | 'baseTempPowerOtherPlayers'
        | 'discardThenDestroyLowPower'
        | 'mode'
        | 'destroyOngoing'
        | 'protectMinionAffect'
        | 'playDeckMinion'
        | 'searchPlayMinion'
        | 'recoverDiscard'
        | 'recoverCards'
        | 'playFrozenMinion'
        | 'playDiscardMinion'
        | 'destroyOwnThenPlayDiscardMinion'
        | 'discardThenRecoverMinion'
        | 'deckTopChooseDiscard'
        | 'deckTopPickOne'
        | 'deckTopChooseTop'
        | 'deckTopOrder'
        | 'deckTopAction'
        | 'hansReveal'
        | 'scarDestroy'
        | 'yokaiReceiver'
        | 'shanYuDestroy';
    minions?: Array<MinionChoice & { label: string; counters?: number }>;
    bases?: Array<BaseChoice & { label: string }>;
    cards?: Array<CardChoice & { label: string }>;
    modes?: Array<ModeChoice & { label: string }>;
    amount?: number;
    maxChoices?: number;
    multiMin?: number;
    optional?: boolean;
    baseIndex?: number;
    targetBaseIndex?: number;
    targetMinion?: MinionChoice;
    destinationBaseIndex?: number;
    sourceMinion?: MinionChoice & { counters?: number };
    sourceCardUid?: string;
    sourceBaseIndex?: number;
    sourceDefId?: string;
    sourceKind?: 'action' | 'nonAction';
    requireOwnTarget?: boolean;
    drawAfterMove?: number;
    extraActionAfter?: boolean;
    deckTopCards?: Array<CardChoice & { label: string }>;
    pendingCards?: Array<CardChoice & { label: string }>;
    discardOthersImmediately?: boolean;
    excludeCardUid?: string;
    targetPlayerIds?: PlayerId[];
    sourcePlayerId?: PlayerId;
    hansRevealed?: Array<{ playerId: PlayerId; card?: CardChoice }>;
    reason: string;
};

function abilityFromRuntime(result: { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> }): AbilityResult {
    return result.matchState ? { events: result.events, matchState: result.matchState } : { events: result.events };
}

function runPrompt(context: DisneyPromptContext): AbilityResult {
    return abilityFromRuntime(executeAbilityProgram(disneyPromptProgram, context));
}

function promptOptionsForMinions(
    state: SmashUpCore,
    playerId: PlayerId,
    minions: Array<MinionChoice & { label: string }>,
): PromptOption<MinionChoice>[] {
    return buildMinionTargetOptions(
        minions.map(target => ({
            uid: target.minionUid,
            defId: target.minionDefId,
            baseIndex: target.baseIndex,
            label: target.label,
        })),
        { state, sourcePlayerId: playerId },
    ) as PromptOption<MinionChoice>[];
}

function makeSkipOption<T extends object = Record<string, never>>(): PromptOption<T & { skip: true }> {
    return {
        id: 'skip',
        label: '跳过',
        labelKey: 'ui.common.skip',
        value: { skip: true } as T & { skip: true },
        displayMode: 'button',
    };
}

function currentBaseName(state: SmashUpCore, baseIndex: number): string {
    const def = getBaseDef(state.bases[baseIndex]?.defId);
    return def?.name ?? `基地 ${baseIndex + 1}`;
}

function minionLabel(state: SmashUpCore, minion: MinionOnBase, baseIndex: number): string {
    const def = getCardDef(minion.defId);
    return `${def?.name ?? minion.defId} @ ${currentBaseName(state, baseIndex)}（力量 ${getMinionPower(state, minion, baseIndex)}）`;
}

function collectMinions(
    state: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): Array<MinionChoice & { label: string; counters: number }> {
    const result: Array<MinionChoice & { label: string; counters: number }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (!predicate(minion, baseIndex)) return;
            result.push({
                minionUid: minion.uid,
                minionDefId: minion.defId,
                baseIndex,
                label: minionLabel(state, minion, baseIndex),
                counters: minion.powerCounters ?? 0,
            });
        });
    });
    return result;
}

function collectOwnMinions(state: SmashUpCore, playerId: PlayerId): Array<MinionChoice & { label: string; counters: number }> {
    return collectMinions(state, minion => minion.controller === playerId);
}

function collectOtherBases(state: SmashUpCore, baseIndex: number): Array<BaseChoice & { label: string }> {
    return state.bases
        .map((base, index) => ({ baseIndex: index, label: getBaseDef(base.defId)?.name ?? `基地 ${index + 1}` }))
        .filter(base => base.baseIndex !== baseIndex);
}

function getLiveMinion(state: SmashUpCore, choice: MinionChoice | undefined): { minion: MinionOnBase; baseIndex: number } | undefined {
    if (!choice) return undefined;
    const minion = state.bases[choice.baseIndex]?.minions.find(candidate => candidate.uid === choice.minionUid);
    return minion ? { minion, baseIndex: choice.baseIndex } : undefined;
}

function hasMufasaInDiscard(state: SmashUpCore, playerId: PlayerId): boolean {
    return state.players[playerId]?.discard.some(card => matchesDefId(card.defId, MUFASA)) ?? false;
}

function hasDefInPlay(state: SmashUpCore, defId: string): boolean {
    return state.bases.some(base => base.minions.some(minion => matchesDefId(minion.defId, defId)));
}

function getActionController(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId;
}

function buildMinionMetadataEvent(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp: now,
    };
}

function buildDiscardCardEvent(playerId: PlayerId, cardUid: string, now: number): CardsDiscardedEvent {
    return {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids: [cardUid] },
        timestamp: now,
    };
}

function playDeckMinionEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const base = state.bases[baseIndex];
    const player = state.players[playerId];
    const power = getMinionDef(card.defId)?.power;
    if (!base || !player || power === undefined) return [];
    const deckUids = [card.uid, ...player.deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid)];
    return [
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids },
            timestamp: now,
        } as DeckReorderedEvent,
        {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                baseIndex,
                baseDefId: base.defId,
                power,
                fromDeck: true,
                consumesNormalLimit: false,
                discardPlaySourceId: reason,
            },
            timestamp: now,
        } as MinionPlayedEvent,
    ];
}

function collectDiscardCards(
    state: SmashUpCore,
    playerId: PlayerId,
    predicate: (card: CardInstance) => boolean,
): Array<CardChoice & { label: string }> {
    return (state.players[playerId]?.discard ?? [])
        .filter(predicate)
        .map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            zone: 'discard' as const,
            label: getCardDef(card.defId)?.name ?? card.defId,
        }));
}

function collectHandCards(
    state: SmashUpCore,
    playerId: PlayerId,
    predicate: (card: CardInstance) => boolean,
): Array<CardChoice & { label: string }> {
    return (state.players[playerId]?.hand ?? [])
        .filter(predicate)
        .map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            zone: 'hand' as const,
            label: getCardDef(card.defId)?.name ?? card.defId,
        }));
}

function topDeckChoices(
    state: SmashUpCore,
    playerId: PlayerId,
    count: number,
    reason: string,
    now: number,
): { cards: Array<CardChoice & { label: string }>; events: SmashUpEvent[] } {
    const player = state.players[playerId];
    if (!player || player.deck.length === 0) return { cards: [], events: [] };
    const cards = player.deck.slice(0, count).map(card => ({
        cardUid: card.uid,
        defId: card.defId,
        ownerId: card.owner,
        zone: 'deck' as const,
        label: getCardDef(card.defId)?.name ?? card.defId,
    }));
    return {
        cards,
        events: [
            inspectDeck(playerId, playerId, cards.length, reason, now),
            revealDeckTop(
                playerId,
                'all',
                cards.map(card => ({ uid: card.cardUid, defId: card.defId })),
                cards.length,
                reason,
                now,
                playerId,
            ),
        ],
    };
}

function cardToDeckTopEvent(
    card: CardChoice,
    playerId: PlayerId,
    reason: string,
    now: number,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.cardUid,
            defId: card.defId,
            ownerId: card.ownerId ?? playerId,
            reason,
            sourcePlayerId: playerId,
            sourceDefId: reason,
            sourceControllerId: playerId,
        },
        timestamp: now,
    };
}

function cardChoicesFromInstances(cards: CardInstance[], zone: 'hand' | 'deck' | 'discard'): Array<CardChoice & { label: string }> {
    return cards.map(card => ({
        cardUid: card.uid,
        defId: card.defId,
        ownerId: card.owner,
        zone,
        label: getCardDef(card.defId)?.name ?? card.defId,
    }));
}

function collectDeckCards(
    state: SmashUpCore,
    playerId: PlayerId,
    predicate: (card: CardInstance) => boolean,
): Array<CardChoice & { label: string }> {
    return (state.players[playerId]?.deck ?? [])
        .filter(predicate)
        .map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            zone: 'deck' as const,
            label: getCardDef(card.defId)?.name ?? card.defId,
        }));
}

function collectSearchableMinions(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<CardChoice & { label: string }> {
    return [
        ...collectDeckCards(state, playerId, card => getMinionDef(card.defId) !== undefined)
            .map(card => ({ ...card, label: `${card.label}（牌库）` })),
        ...collectDiscardCards(state, playerId, card => getMinionDef(card.defId) !== undefined)
            .map(card => ({ ...card, label: `${card.label}（弃牌堆）` })),
    ];
}

function recoverDeckCardsToHandEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    cards: CardInstance[],
    reason: string,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    if (cards.length === 0) return [];
    const player = state.players[playerId];
    if (!player) return [];
    const selectedUids = new Set(cards.map(card => card.uid));
    const liveCards = player.deck.filter(card => selectedUids.has(card.uid));
    if (liveCards.length === 0) return [];
    const remainingDeck = player.deck.filter(card => !selectedUids.has(card.uid));
    return [
        revealDeckTop(
            playerId,
            'all',
            liveCards.map(card => ({ uid: card.uid, defId: card.defId })),
            liveCards.length,
            reason,
            now,
            playerId,
        ),
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: [...liveCards.map(card => card.uid), ...random.shuffle(remainingDeck).map(card => card.uid)],
                reason,
            },
            timestamp: now,
        } as DeckReorderedEvent,
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: liveCards.length, cardUids: liveCards.map(card => card.uid) },
            timestamp: now,
        } as CardsDrawnEvent,
    ];
}

function recoverSelectedCardsFromZones(
    context: DisneyPromptContext,
    state: SmashUpCore,
    rawValue: unknown,
    random: RandomFn,
    timestamp: number,
): SmashUpEvent[] {
    const choices = (Array.isArray(rawValue) ? rawValue : [rawValue]) as CardChoice[];
    const selectedUids = new Set(choices
        .map(choice => choice?.cardUid)
        .filter((cardUid): cardUid is string => typeof cardUid === 'string'));
    if (selectedUids.size === 0) return [];
    const allowed = new Set((context.cards ?? []).map(card => card.cardUid));
    const player = state.players[context.playerId];
    if (!player) return [];
    const discardCards = player.discard
        .filter(card => selectedUids.has(card.uid) && allowed.has(card.uid))
        .slice(0, context.maxChoices ?? selectedUids.size);
    const remainingSlots = Math.max(0, (context.maxChoices ?? selectedUids.size) - discardCards.length);
    const deckCards = player.deck
        .filter(card => selectedUids.has(card.uid) && allowed.has(card.uid))
        .slice(0, remainingSlots);
    return [
        ...(discardCards.length > 0
            ? [recoverCardsFromDiscard(context.playerId, discardCards.map(card => card.uid), context.reason, timestamp)]
            : []),
        ...recoverDeckCardsToHandEvents(state, context.playerId, deckCards, context.reason, random, timestamp),
    ];
}

function detachOngoingEvent(
    action: { uid: string; defId: string; ownerId: PlayerId; metadata?: Record<string, unknown> },
    reason: string,
    now: number,
): OngoingDetachedEvent {
    return buildOngoingDetachedEvent({
        cardUid: action.uid,
        defId: action.defId,
        ownerId: action.ownerId,
        reason,
        sourcePlayerId: getActionController(action),
        sourceCardUid: action.uid,
        sourceDefId: reason,
        sourceControllerId: getActionController(action),
        now,
    });
}

function collectOngoingCardsAtBase(state: SmashUpCore, baseIndex: number): Array<CardChoice & { label: string }> {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return [
        ...base.ongoingActions.map(action => ({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            label: getCardDef(action.defId)?.name ?? action.defId,
        })),
        ...base.minions.flatMap(minion => minion.attachedActions.map(action => ({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            label: `${getCardDef(action.defId)?.name ?? action.defId} @ ${getCardDef(minion.defId)?.name ?? minion.defId}`,
        }))),
    ];
}

function resolvePromptChoice(
    context: DisneyPromptContext,
    state: MatchState<SmashUpCore>,
    rawValue: unknown,
    random: RandomFn,
    timestamp: number,
): AbilityRuntimePromptResumeResult<DisneyPromptContext, SmashUpCore, SmashUpEvent> {
    const value = rawValue as (MinionChoice | BaseChoice | CardChoice | ModeChoice | { skip?: true }) | Array<MinionChoice | CardChoice>;
    const skipped = typeof value === 'object' && !Array.isArray(value) && value && 'skip' in value && value.skip;
    if (skipped && context.kind === 'deckTopChooseDiscard') {
        const remaining = context.deckTopCards ?? context.cards ?? [];
        if (remaining.length <= 1) {
            return { events: remaining.map(card => cardToDeckTopEvent(card, context.playerId, context.reason, timestamp)) };
        }
        return {
            events: [],
            continuation: createAbilityRuntimeContinuation({
                ...context,
                kind: 'deckTopOrder',
                title: '雪宝：选择剩余牌库顶牌的顺序',
                cards: remaining,
                deckTopCards: remaining,
                pendingCards: [],
            }, disneyPromptProgram),
        };
    }
    if (skipped && context.kind === 'deckTopChooseTop') {
        const pending = context.pendingCards ?? context.cards ?? [];
        return {
            events: pending.length > 0 ? [{
                type: SU_EVENTS.CARDS_MILLED,
                payload: { playerId: context.playerId, cardUids: pending.map(card => card.cardUid), reason: context.reason },
                timestamp,
            } as CardsMilledEvent] : [],
        };
    }
    if (!value || (skipped && context.kind !== 'hansReveal')) {
        return { events: [] };
    }

    switch (context.kind) {
        case 'addCounters': {
            const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
            return {
                events: choices.flatMap(choice => {
                    const live = getLiveMinion(state.core, choice);
                    if (!live) return [];
                    return [addPowerCounter(live.minion.uid, live.baseIndex, context.amount ?? 1, context.reason, timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: context.targetBaseIndex,
                    })];
                }),
            };
        }
        case 'addTempPower': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            return {
                events: [addTempPower(live.minion.uid, live.baseIndex, context.amount ?? 1, context.reason, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.targetBaseIndex,
                })],
            };
        }
        case 'destroyOwnThenPlayDiscardMinion': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live || live.minion.controller !== context.playerId) return { events: [] };
            const destroyEvents = buildValidatedDestroyEvents(state, {
                minionUid: live.minion.uid,
                minionDefId: live.minion.defId,
                fromBaseIndex: live.baseIndex,
                destroyerId: context.playerId,
                reason: context.reason,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: context.reason,
                sourceControllerId: context.playerId,
                sourceBaseIndex: live.baseIndex,
                sourceKind: 'action',
            });
            if (destroyEvents.length === 0) return { events: [] };
            return {
                events: destroyEvents,
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'playDiscardMinion',
                    title: '真爱的行为：选择弃牌堆中的另一个角色作为额外角色打出',
                    cards: collectDiscardCards(
                        state.core,
                        context.playerId,
                        card => getMinionDef(card.defId) !== undefined && card.uid !== live.minion.uid,
                    ),
                    excludeCardUid: live.minion.uid,
                }, disneyPromptProgram),
            };
        }
        case 'discardThenRecoverMinion': {
            const choice = (Array.isArray(value) ? value[0] : value) as CardChoice;
            const liveHand = state.core.players[context.playerId]?.hand.find(card => card.uid === choice.cardUid);
            if (!liveHand) return { events: [] };
            const discardMinions = collectDiscardCards(state.core, context.playerId, card => getMinionDef(card.defId) !== undefined);
            const selectedAsMinion = getMinionDef(liveHand.defId)
                ? [{
                    cardUid: liveHand.uid,
                    defId: liveHand.defId,
                    ownerId: liveHand.owner,
                    zone: 'discard' as const,
                    label: `${getCardDef(liveHand.defId)?.name ?? liveHand.defId}（刚弃置）`,
                }]
                : [];
            const discardEvent = buildDiscardCardEvent(context.playerId, liveHand.uid, timestamp);
            const recoverableCards = [...discardMinions, ...selectedAsMinion];
            if (recoverableCards.length === 0) return { events: [discardEvent] };
            return {
                events: [discardEvent],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'recoverDiscard',
                    title: '夏天大盛宴：选择弃牌堆中的一个角色置入手牌',
                    cards: recoverableCards,
                    maxChoices: 1,
                }, disneyPromptProgram),
            };
        }
        case 'playFrozenMinion': {
            const choice = value as CardChoice;
            const allowed = new Set((context.cards ?? []).map(card => card.cardUid));
            const card = state.core.players[context.playerId]?.[choice.zone === 'discard' ? 'discard' : 'hand']
                .find(candidate => candidate.uid === choice.cardUid);
            if (!card || !allowed.has(card.uid) || getMinionDef(card.defId) === undefined) return { events: [] };
            return {
                events: [grantContextualExtraMinion(
                    { playerId: context.playerId, now: timestamp, matchState: state },
                    context.reason,
                    undefined,
                    {
                        specificCardUid: card.uid,
                        allowFromDiscard: choice.zone === 'discard',
                        playTiming: 'immediate',
                    },
                )],
            };
        }
        case 'playDiscardMinion': {
            const choice = value as CardChoice;
            const player = state.core.players[context.playerId];
            const allowed = new Set((context.cards ?? []).map(card => card.cardUid));
            const card = player?.discard.find(candidate => candidate.uid === choice.cardUid);
            if (
                !card
                || !allowed.has(card.uid)
                || getMinionDef(card.defId) === undefined
                || card.uid === context.excludeCardUid
            ) return { events: [] };
            return {
                events: [grantContextualExtraMinion(
                    { playerId: context.playerId, now: timestamp, matchState: state },
                    context.reason,
                    undefined,
                    { specificCardUid: card.uid, allowFromDiscard: true, playTiming: 'immediate' },
                )],
            };
        }
        case 'deckTopChooseDiscard': {
            const selected = (Array.isArray(value) ? value : [value]) as CardChoice[];
            const topCards = context.deckTopCards ?? context.cards ?? [];
            const selectedIds = new Set(selected.map(card => card.cardUid));
            const discarded = topCards.filter(card => selectedIds.has(card.cardUid));
            const remaining = topCards.filter(card => !selectedIds.has(card.cardUid));
            const events: SmashUpEvent[] = discarded.length > 0
                ? [{
                    type: SU_EVENTS.CARDS_MILLED,
                    payload: { playerId: context.playerId, cardUids: discarded.map(card => card.cardUid), reason: context.reason },
                    timestamp,
                } as CardsMilledEvent]
                : [];
            if (remaining.length <= 1) {
                return {
                    events: [...events, ...remaining.map(card => cardToDeckTopEvent(card, context.playerId, context.reason, timestamp))],
                };
            }
            return {
                events,
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'deckTopOrder',
                    title: '雪宝：选择剩余牌库顶牌的顺序',
                    cards: remaining,
                    deckTopCards: remaining,
                    pendingCards: [],
                }, disneyPromptProgram),
            };
        }
        case 'deckTopPickOne': {
            const selected = value as CardChoice;
            const topCards = context.deckTopCards ?? context.cards ?? [];
            const picked = topCards.find(card => card.cardUid === selected.cardUid);
            if (!picked) return { events: [] };
            const remaining = topCards.filter(card => card.cardUid !== picked.cardUid);
            const events: SmashUpEvent[] = [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: context.playerId, count: 1, cardUids: [picked.cardUid] },
                timestamp,
            } as CardsDrawnEvent];
            if (context.discardOthersImmediately) {
                return {
                    events: remaining.length > 0
                        ? [...events, {
                            type: SU_EVENTS.CARDS_MILLED,
                            payload: { playerId: context.playerId, cardUids: remaining.map(card => card.cardUid), reason: context.reason },
                            timestamp,
                        } as CardsMilledEvent]
                        : events,
                };
            }
            return {
                events,
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'deckTopChooseTop',
                    title: '放手吧：选择哪些剩余牌放回牌库顶（其余进入弃牌堆）',
                    cards: remaining,
                    deckTopCards: remaining,
                    pendingCards: remaining,
                    maxChoices: remaining.length,
                    multiMin: 0,
                }, disneyPromptProgram),
            };
        }
        case 'deckTopChooseTop': {
            const pending = context.pendingCards ?? context.cards ?? [];
            const selectedIds = new Set((Array.isArray(value) ? value : [value])
                .map(entry => (entry as CardChoice)?.cardUid)
                .filter((uid): uid is string => typeof uid === 'string'));
            const toTop = pending.filter(card => selectedIds.has(card.cardUid));
            const toDiscard = pending.filter(card => !selectedIds.has(card.cardUid));
            const discardEvents: SmashUpEvent[] = toDiscard.length > 0
                ? [{
                    type: SU_EVENTS.CARDS_MILLED,
                    payload: { playerId: context.playerId, cardUids: toDiscard.map(card => card.cardUid), reason: context.reason },
                    timestamp,
                } as CardsMilledEvent]
                : [];
            if (toTop.length <= 1) {
                return {
                    events: [...discardEvents, ...toTop.map(card => cardToDeckTopEvent(card, context.playerId, context.reason, timestamp))],
                };
            }
            return {
                events: discardEvents,
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'deckTopOrder',
                    title: '放手吧：选择放回牌库顶的顺序',
                    cards: toTop,
                    deckTopCards: toTop,
                    pendingCards: [],
                }, disneyPromptProgram),
            };
        }
        case 'deckTopOrder': {
            const cards = context.cards ?? [];
            const orderedIds = typeof (value as ModeChoice)?.mode === 'string'
                ? (value as ModeChoice).mode.replace(/^deck_top_order:/, '').split(',').filter(Boolean)
                : cards.map(card => card.cardUid);
            const ordered = orderedIds
                .map(uid => cards.find(card => card.cardUid === uid))
                .filter((card): card is CardChoice & { label: string } => Boolean(card));
            const topOrder = ordered.length === cards.length ? ordered : cards;
            return {
                events: [
                    ...((context.pendingCards ?? []).length > 0 ? [{
                        type: SU_EVENTS.CARDS_MILLED,
                        payload: { playerId: context.playerId, cardUids: (context.pendingCards ?? []).map(card => card.cardUid), reason: context.reason },
                        timestamp,
                    } as CardsMilledEvent] : []),
                    ...topOrder.slice().reverse().map(card => cardToDeckTopEvent(card, context.playerId, context.reason, timestamp)),
                ],
            };
        }
        case 'deckTopAction': {
            const card = (context.cards ?? [])[0];
            if (!card) return { events: [] };
            if ((value as ModeChoice).mode === 'deck_top_discard') {
                return {
                    events: [{
                        type: SU_EVENTS.CARDS_MILLED,
                        payload: { playerId: context.playerId, cardUids: [card.cardUid], reason: context.reason },
                        timestamp,
                    } as CardsMilledEvent],
                };
            }
            return { events: [] };
        }
        case 'hansReveal': {
            const index = context.hansRevealed?.length ?? 0;
            const targetPlayerId = context.targetPlayerIds?.[index];
            if (!targetPlayerId) return { events: [] };
            const selected = !Array.isArray(value) && typeof value === 'object' && value && 'skip' in value
                ? undefined
                : value as CardChoice;
            const liveCard = selected
                ? state.core.players[targetPlayerId]?.hand.find(card => card.uid === selected.cardUid && getMinionDef(card.defId) !== undefined)
                : undefined;
            if (selected && !liveCard) return { events: [] };
            const revealed = [...(context.hansRevealed ?? []), liveCard ? {
                playerId: targetPlayerId,
                card: { cardUid: liveCard.uid, defId: liveCard.defId, ownerId: liveCard.owner, zone: 'hand' as const, label: getCardDef(liveCard.defId)?.name ?? liveCard.defId },
            } : { playerId: targetPlayerId }];
            const revealEvent = revealHand(
                targetPlayerId,
                'all',
                liveCard ? [{ uid: liveCard.uid, defId: liveCard.defId }] : [],
                context.reason,
                timestamp,
                context.sourcePlayerId ?? context.playerId,
            );
            if (revealed.length < (context.targetPlayerIds?.length ?? 0)) {
                const nextPlayerId = context.targetPlayerIds?.[revealed.length];
                return {
                    events: [revealEvent],
                    continuation: createAbilityRuntimeContinuation({
                        ...context,
                        playerId: nextPlayerId ?? context.playerId,
                        title: `汉斯：${nextPlayerId} 展示手牌中的一个角色，或展示没有角色`,
                        cards: nextPlayerId ? collectHandCards(state.core, nextPlayerId, card => getMinionDef(card.defId) !== undefined) : [],
                        hansRevealed: revealed,
                    }, disneyPromptProgram),
                };
            }
            const shuffleEvents = revealed
                .flatMap(entry => {
                    const player = state.core.players[entry.playerId];
                    const revealedCard = entry.card;
                    if (!player || !revealedCard) return [];
                    return [shuffleHandIntoDeck(
                        entry.playerId,
                        random.shuffle([...player.deck.map(card => card.uid), revealedCard.cardUid]),
                        context.reason,
                        timestamp,
                    )];
                });
            return { events: [revealEvent, ...shuffleEvents] };
        }
        case 'scarDestroy': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            const destroyedPower = getMinionPower(state.core, live.minion, live.baseIndex);
            const destroyEvents = buildValidatedDestroyEvents(state, {
                minionUid: live.minion.uid,
                minionDefId: live.minion.defId,
                fromBaseIndex: live.baseIndex,
                destroyerId: context.playerId,
                reason: context.reason,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: context.reason,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.targetBaseIndex ?? live.baseIndex,
                sourceKind: 'action',
            });
            return {
                events: [
                    ...destroyEvents,
                    ...(live.minion.controller === context.playerId
                        ? buildStandardDrawEvents(state.core, context.playerId, destroyedPower, random, timestamp)
                        : []),
                ],
            };
        }
        case 'destroyMinion':
        case 'shanYuDestroy': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            return {
                events: buildValidatedDestroyEvents(state, {
                    minionUid: live.minion.uid,
                    minionDefId: live.minion.defId,
                    fromBaseIndex: live.baseIndex,
                    destroyerId: context.playerId,
                    reason: context.reason,
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.targetBaseIndex ?? live.baseIndex,
                    sourceKind: 'action',
                }),
            };
        }
        case 'returnMinion': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            return {
                events: [
                    ...buildValidatedReturnEvents(state, {
                        minionUid: live.minion.uid,
                        minionDefId: live.minion.defId,
                        fromBaseIndex: live.baseIndex,
                        reason: context.reason,
                        now: timestamp,
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: live.baseIndex,
                        sourceKind: 'action',
                    }),
                    ...(context.extraActionAfter
                        ? [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason)]
                        : []),
                ],
            };
        }
        case 'destroyOwnThenPlayDeckMinion': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live || live.minion.controller !== context.playerId) return { events: [] };
            const destroyEvents = buildValidatedDestroyEvents(state, {
                minionUid: live.minion.uid,
                minionDefId: live.minion.defId,
                fromBaseIndex: live.baseIndex,
                destroyerId: context.playerId,
                reason: context.reason,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: context.reason,
                sourceControllerId: context.playerId,
                sourceBaseIndex: live.baseIndex,
                sourceKind: 'action',
            });
            return {
                events: destroyEvents,
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'playDeckMinion',
                    title: '牛羚踩踏：选择从牌库额外打出的角色',
                    targetBaseIndex: live.baseIndex,
                }, disneyPromptProgram),
            };
        }
        case 'moveMinionTarget': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            if (context.requireOwnTarget && live.minion.controller !== context.playerId) return { events: [] };
            const bases = (context.bases ?? collectOtherBases(state.core, live.baseIndex))
                .filter(base => base.baseIndex !== live.baseIndex);
            if (bases.length === 0) {
                return {
                    events: context.drawAfterMove
                        ? buildStandardDrawEvents(state.core, context.playerId, context.drawAfterMove, random, timestamp)
                        : [],
                };
            }
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'moveMinionDestination',
                    title: '选择目标基地',
                    targetMinion: {
                        minionUid: live.minion.uid,
                        minionDefId: live.minion.defId,
                        baseIndex: live.baseIndex,
                    },
                    bases,
                }, disneyPromptProgram),
            };
        }
        case 'moveMinionDestination': {
            const baseChoice = value as BaseChoice;
            const target = context.targetMinion;
            const live = getLiveMinion(state.core, target);
            if (!live) return { events: [] };
            if (context.requireOwnTarget && live.minion.controller !== context.playerId) return { events: [] };
            const moveEvents = buildValidatedMoveEvents(state, {
                minionUid: live.minion.uid,
                minionDefId: live.minion.defId,
                fromBaseIndex: live.baseIndex,
                toBaseIndex: baseChoice.baseIndex,
                reason: context.reason,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId ?? context.reason,
                sourceControllerId: context.playerId,
                sourceBaseIndex: live.baseIndex,
                sourceKind: context.sourceKind ?? 'action',
            });
            return {
                events: [
                    ...moveEvents,
                    ...(context.drawAfterMove
                        ? buildStandardDrawEvents(state.core, context.playerId, context.drawAfterMove, random, timestamp)
                        : []),
                ],
            };
        }
        case 'moveCountersSource': {
            const source = value as MinionChoice;
            const live = getLiveMinion(state.core, source);
            const counters = live?.minion.powerCounters ?? 0;
            if (!live || counters <= 0) return { events: [] };
            const targets = collectOwnMinions(state.core, context.playerId)
                .filter(target => target.minionUid !== live.minion.uid);
            if (targets.length === 0) return { events: [] };
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'moveCountersTarget',
                    title: '选择接收力量标记的角色',
                    sourceMinion: { ...source, counters },
                    minions: targets,
                }, disneyPromptProgram),
            };
        }
        case 'moveCountersTarget': {
            const target = value as MinionChoice;
            const source = getLiveMinion(state.core, context.sourceMinion);
            const liveTarget = getLiveMinion(state.core, target);
            const amount = Math.max(0, context.sourceMinion?.counters ?? source?.minion.powerCounters ?? 0);
            if (!source || !liveTarget || amount <= 0) return { events: [] };
            return {
                events: [
                    removePowerCounter(source.minion.uid, source.baseIndex, amount, context.reason, timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                    }),
                    addPowerCounter(liveTarget.minion.uid, liveTarget.baseIndex, amount, context.reason, timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                    }),
                ],
            };
        }
        case 'yokaiReceiver': {
            const receiver = getLiveMinion(state.core, value as MinionChoice);
            const baseIndex = context.targetBaseIndex;
            if (!receiver || receiver.minion.controller !== context.playerId || baseIndex === undefined) return { events: [] };
            const base = state.core.bases[baseIndex];
            if (!base) return { events: [] };
            const events: SmashUpEvent[] = [];
            for (const minion of base.minions) {
                if (minion.controller !== context.playerId || (minion.powerCounters ?? 0) <= 0 || minion.uid === receiver.minion.uid) continue;
                events.push(removePowerCounter(minion.uid, baseIndex, 1, context.reason, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: baseIndex,
                }));
                events.push(addPowerCounter(receiver.minion.uid, receiver.baseIndex, 1, context.reason, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: baseIndex,
                }));
            }
            return { events };
        }
        case 'baseDrawCounters': {
            const baseIndex = (value as BaseChoice).baseIndex;
            const count = state.core.bases[baseIndex]?.minions.filter(
                minion => minion.controller === context.playerId && (minion.powerCounters ?? 0) > 0,
            ).length ?? 0;
            return { events: buildStandardDrawEvents(state, context.playerId, count, random, timestamp) };
        }
        case 'baseDrawOwnMinions': {
            const baseIndex = (value as BaseChoice).baseIndex;
            const count = state.core.bases[baseIndex]?.minions.filter(minion => minion.controller === context.playerId).length ?? 0;
            return { events: buildStandardDrawEvents(state, context.playerId, count, random, timestamp) };
        }
        case 'baseTempPowerOtherPlayers': {
            const baseIndex = (value as BaseChoice).baseIndex;
            const base = state.core.bases[baseIndex];
            if (!base) return { events: [] };
            return {
                events: base.minions
                    .filter(minion => minion.controller !== context.playerId)
                    .map(minion => addTempPower(minion.uid, baseIndex, context.amount ?? -1, context.reason, timestamp, {
                        sourcePlayerId: context.playerId,
                        ...(context.sourceCardUid !== undefined ? { sourceCardUid: context.sourceCardUid } : {}),
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: context.sourceBaseIndex,
                    })),
            };
        }
        case 'discardThenDestroyLowPower': {
            const cardChoice = value as CardChoice;
            const baseIndex = context.targetBaseIndex;
            if (baseIndex === undefined) return { events: [] };
            const base = state.core.bases[baseIndex];
            if (!base) return { events: [] };
            const destroyEvents = base.minions
                .filter(minion => getMinionPower(state.core, minion, baseIndex) <= 3)
                .flatMap(minion => buildValidatedDestroyEvents(state, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: baseIndex,
                    destroyerId: context.playerId,
                    reason: context.reason,
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: baseIndex,
                    sourceKind: 'action',
                }));
            return { events: [buildDiscardCardEvent(context.playerId, cardChoice.cardUid, timestamp), ...destroyEvents] };
        }
        case 'recoverDiscard':
        case 'recoverCards':
            return { events: recoverSelectedCardsFromZones(context, state.core, value, random, timestamp) };
        case 'destroyOngoing': {
            const card = value as CardChoice;
            const events: SmashUpEvent[] = [];
            for (const base of state.core.bases) {
                const action = base.ongoingActions.find(candidate => candidate.uid === card.cardUid);
                if (action) events.push(detachOngoingEvent(action, context.reason, timestamp));
                for (const minion of base.minions) {
                    const attached = minion.attachedActions.find(candidate => candidate.uid === card.cardUid);
                    if (attached) events.push(detachOngoingEvent(attached, context.reason, timestamp));
                }
            }
            return { events };
        }
        case 'protectMinionAffect': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            return {
                events: [buildMinionMetadataEvent(live.minion.uid, live.baseIndex, {
                    tempProtectAffectUntilTurnNumber: state.core.turnNumber,
                    tempProtectSourcePlayerId: context.playerId,
                }, context.reason, timestamp)],
            };
        }
        case 'playDeckMinion': {
            const card = value as CardChoice;
            const found = state.core.players[context.playerId]?.deck.find(candidate => candidate.uid === card.cardUid);
            const baseIndex = context.targetBaseIndex ?? 0;
            return { events: found ? playDeckMinionEvents(state.core, context.playerId, found, baseIndex, context.reason, timestamp) : [] };
        }
        case 'searchPlayMinion': {
            const choice = value as CardChoice;
            if (!choice?.cardUid || (choice.zone !== 'deck' && choice.zone !== 'discard')) return { events: [] };
            const player = state.core.players[context.playerId];
            if (!player) return { events: [] };
            const sourceCards = choice.zone === 'deck' ? player.deck : player.discard;
            const card = sourceCards.find(candidate => candidate.uid === choice.cardUid && candidate.defId === choice.defId);
            const power = card ? getMinionDef(card.defId)?.power : undefined;
            if (!card || power === undefined) return { events: [] };

            if (power <= 3) {
                const deckPreparation = choice.zone === 'deck'
                    ? {
                        type: SU_EVENTS.DECK_REORDERED,
                        payload: {
                            playerId: context.playerId,
                            deckUids: [
                                card.uid,
                                ...random.shuffle(player.deck.filter(candidate => candidate.uid !== card.uid)).map(candidate => candidate.uid),
                            ],
                            reason: context.reason,
                        },
                        timestamp,
                    } as DeckReorderedEvent
                    : undefined;
                return {
                    events: [
                        ...(deckPreparation ? [deckPreparation] : []),
                        grantContextualExtraMinion(
                            { playerId: context.playerId, now: timestamp, matchState: state },
                            context.reason,
                            undefined,
                            {
                                specificCardUid: card.uid,
                                allowFromDiscard: choice.zone === 'discard',
                                playTiming: 'immediate',
                                powerMax: 3,
                            },
                        ),
                    ],
                };
            }

            return choice.zone === 'deck'
                ? {
                    events: [
                        {
                            type: SU_EVENTS.CARDS_MILLED,
                            payload: { playerId: context.playerId, cardUids: [card.uid], reason: context.reason },
                            timestamp,
                        } as CardsMilledEvent,
                        {
                            type: SU_EVENTS.DECK_RESHUFFLED,
                            payload: {
                                playerId: context.playerId,
                                deckUids: random.shuffle(player.deck.filter(candidate => candidate.uid !== card.uid)).map(candidate => candidate.uid),
                            },
                            timestamp,
                        } as DeckReshuffledEvent,
                    ],
                }
                : { events: [] };
        }
        case 'mode':
            return resolveMode(context, state, value as ModeChoice, random, timestamp);
        default:
            return { events: [] };
    }
}

const disneyPromptProgram: AbilityProgram<DisneyPromptContext, SmashUpCore, SmashUpEvent> = createPromptProgram<DisneyPromptContext>({
    sourceId: DISNEY_PROMPT_SOURCE,
    buildInteraction: (context) => {
        const state = context.matchState.core;
        const options = (() => {
            if (context.kind.startsWith('base')) {
                return buildBaseTargetOptions(context.bases ?? [], state);
            }
            if (
                context.kind === 'discardThenDestroyLowPower'
                || context.kind === 'playDeckMinion'
                || context.kind === 'searchPlayMinion'
                || context.kind === 'recoverDiscard'
                || context.kind === 'recoverCards'
                || context.kind === 'playFrozenMinion'
                || context.kind === 'playDiscardMinion'
                || context.kind === 'discardThenRecoverMinion'
                || context.kind === 'deckTopChooseDiscard'
                || context.kind === 'deckTopPickOne'
                || context.kind === 'deckTopChooseTop'
                || context.kind === 'hansReveal'
            ) {
                const cards = (context.cards ?? []).filter(card => {
                    if (context.kind !== 'playDiscardMinion') return true;
                    const liveCard = state.players[context.playerId]?.discard.find(candidate => candidate.uid === card.cardUid);
                    return liveCard !== undefined
                        && getMinionDef(liveCard.defId) !== undefined
                        && liveCard.uid !== context.excludeCardUid;
                });
                return cards.map((card, index) => ({
                    id: `card-${index}`,
                    label: card.label,
                    value: { cardUid: card.cardUid, defId: card.defId, ownerId: card.ownerId, zone: card.zone },
                    displayMode: 'card' as const,
                    displayCard: { cardUid: card.cardUid, defId: card.defId },
                }));
            }
            if (context.kind === 'mode') {
                return (context.modes ?? []).map(mode => ({
                    id: mode.mode,
                    label: mode.label,
                    value: { mode: mode.mode },
                    displayMode: 'button' as const,
                }));
            }
            if (context.kind === 'deckTopAction') {
                return [
                    { mode: 'deck_top_discard', label: '弃掉这张牌' },
                    { mode: 'deck_top_keep', label: '放回牌库顶' },
                ].map(mode => ({
                    id: mode.mode,
                    label: mode.label,
                    value: { mode: mode.mode },
                    displayMode: 'button' as const,
                }));
            }
            if (context.kind === 'deckTopOrder') {
                const cards = context.cards ?? [];
                const modes = cards.length === 2
                    ? [
                        { mode: `deck_top_order:${cards[0].cardUid},${cards[1].cardUid}`, label: `${cards[0].label} 在前` },
                        { mode: `deck_top_order:${cards[1].cardUid},${cards[0].cardUid}`, label: `${cards[1].label} 在前` },
                    ]
                    : [{ mode: `deck_top_order:${cards.map(card => card.cardUid).join(',')}`, label: '按当前顺序放回' }];
                return modes.map(mode => ({
                    id: mode.mode,
                    label: mode.label,
                    value: { mode: mode.mode },
                    displayMode: 'button' as const,
                }));
            }
            if (context.kind === 'moveMinionDestination') {
                return buildBaseTargetOptions(context.bases ?? [], state);
            }
            if (context.kind === 'destroyOngoing') {
                return (context.cards ?? []).map((card, index) => ({
                    id: `ongoing-${index}`,
                    label: card.label,
                    value: { cardUid: card.cardUid, defId: card.defId, ownerId: card.ownerId },
                    displayMode: 'card' as const,
                }));
            }
            return promptOptionsForMinions(state, context.playerId, context.minions ?? []);
        })();
        const finalOptions = context.optional ? [...options, makeSkipOption()] : options;
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.kind}_${context.now}`,
            context.playerId,
            context.title,
            finalOptions as PromptOption<unknown>[],
            {
                sourceId: DISNEY_PROMPT_SOURCE,
                targetType: context.kind.startsWith('base') || context.kind === 'moveMinionDestination' ? 'base'
                    : context.kind === 'mode' || context.kind === 'deckTopAction' || context.kind === 'deckTopOrder' ? 'button'
                        : context.kind === 'discardThenDestroyLowPower' ? 'hand'
                            : context.kind === 'recoverDiscard' ? 'discard'
                                : context.kind === 'playDeckMinion'
                                    || context.kind === 'searchPlayMinion'
                                    || context.kind === 'recoverCards'
                                    || context.kind === 'playFrozenMinion'
                                    || context.kind === 'playDiscardMinion'
                                    || context.kind === 'discardThenRecoverMinion'
                                    || context.kind === 'deckTopChooseDiscard'
                                    || context.kind === 'deckTopPickOne'
                                    || context.kind === 'deckTopChooseTop'
                                    || context.kind === 'hansReveal' ? 'generic'
                                    : context.kind === 'destroyOngoing' ? 'ongoing'
                                        : 'minion',
                ...(context.kind === 'playDeckMinion'
                    || context.kind === 'searchPlayMinion'
                    || context.kind === 'recoverCards'
                    || context.kind === 'playFrozenMinion'
                    || context.kind === 'playDiscardMinion'
                    || context.kind === 'discardThenRecoverMinion'
                    || context.kind === 'deckTopChooseDiscard'
                    || context.kind === 'deckTopPickOne'
                    || context.kind === 'deckTopChooseTop'
                    || context.kind === 'hansReveal'
                    ? { genericIntent: 'card-pool' as const }
                    : {}),
                ...(context.kind === 'recoverDiscard' ? { autoRefresh: 'discard' as const } : {}),
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
                ...(context.maxChoices !== undefined ? { multi: { min: context.multiMin ?? (context.optional ? 0 : 1), max: context.maxChoices } } : {}),
            },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => resolvePromptChoice(
        context,
        state,
        value,
        random,
        timestamp,
    ),
});

function resolveMode(
    context: DisneyPromptContext,
    state: MatchState<SmashUpCore>,
    value: ModeChoice,
    random: RandomFn,
    timestamp: number,
): AbilityRuntimePromptResumeResult<DisneyPromptContext, SmashUpCore, SmashUpEvent> {
    switch (value.mode) {
        case 'sven_move_here': {
            const sourceBaseIndex = context.baseIndex ?? context.targetBaseIndex;
            if (sourceBaseIndex === undefined) return { events: [] };
            const targets = collectMinions(state.core, (minion, baseIndex) =>
                minion.controller === context.playerId && baseIndex !== sourceBaseIndex,
            );
            const destination = [{ baseIndex: sourceBaseIndex, label: currentBaseName(state.core, sourceBaseIndex) }];
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'moveMinionTarget',
                    title: '斯文：选择要移动到这里的己方角色',
                    minions: targets,
                    bases: destination,
                    requireOwnTarget: true,
                    sourceDefId: 'frozen_sven',
                    sourceKind: 'nonAction',
                }, disneyPromptProgram),
            };
        }
        case 'sven_search_kristoff':
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'recoverCards',
                    title: '斯文：选择要置入手牌的克里斯托弗',
                    cards: frozenSearchCards(state.core, context.playerId, ['frozen_kristoff']),
                    maxChoices: 1,
                }, disneyPromptProgram),
            };
        case 'kristoff_extra_minion':
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'playFrozenMinion',
                    title: '克里斯托弗：选择要额外打出的角色',
                    cards: [
                        ...collectHandCards(state.core, context.playerId, card => (getMinionDef(card.defId)?.power ?? 99) <= 5),
                        ...collectDiscardCards(state.core, context.playerId, card => (getMinionDef(card.defId)?.power ?? 99) <= 5)
                            .map(card => ({ ...card, label: `${card.label}（弃牌堆）` })),
                    ],
                }, disneyPromptProgram),
            };
        case 'kristoff_recover_marshmallow':
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'recoverDiscard',
                    title: '克里斯托弗：选择要置入手牌的棉花糖',
                    cards: collectDiscardCards(state.core, context.playerId, card => matchesDefId(card.defId, 'frozen_marshmallow')),
                    maxChoices: 1,
                }, disneyPromptProgram),
            };
        case 'elsa_extra_minion':
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'playFrozenMinion',
                    title: '艾莎：选择要额外打出的雪宝或迷你雪人',
                    cards: [
                        ...collectHandCards(state.core, context.playerId, card => matchesDefId(card.defId, 'frozen_olaf') || matchesDefId(card.defId, 'frozen_snowgie')),
                        ...collectDiscardCards(state.core, context.playerId, card => matchesDefId(card.defId, 'frozen_olaf') || matchesDefId(card.defId, 'frozen_snowgie'))
                            .map(card => ({ ...card, label: `${card.label}（弃牌堆）` })),
                    ],
                }, disneyPromptProgram),
            };
        case 'elsa_recover_marshmallow':
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'recoverDiscard',
                    title: '艾莎：选择要置入手牌的棉花糖',
                    cards: collectDiscardCards(state.core, context.playerId, card => matchesDefId(card.defId, 'frozen_marshmallow')),
                    maxChoices: 1,
                }, disneyPromptProgram),
            };
        case 'deck_top_keep_original':
        case 'deck_top_reverse': {
            const cards = context.deckTopCards ?? context.cards ?? [];
            const ordered = value.mode === 'deck_top_reverse' ? [...cards].reverse() : cards;
            return {
                events: ordered.slice().reverse().map(card => cardToDeckTopEvent(card, context.playerId, context.reason, timestamp)),
            };
        }
        case 'deck_top_discard': {
            const card = (context.cards ?? [])[0];
            return card ? { events: [{
                type: SU_EVENTS.CARDS_MILLED,
                payload: { playerId: context.playerId, cardUids: [card.cardUid], reason: context.reason },
                timestamp,
            } as CardsMilledEvent] } : { events: [] };
        }
        case 'add_counter_here': {
            const baseIndex = context.targetBaseIndex ?? 0;
            const targets = collectOwnMinions(state.core, context.playerId).filter(target => target.baseIndex === baseIndex);
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({ ...context, kind: 'addCounters', title: '选择放置 +1 力量标记的角色', minions: targets, amount: 1 }, disneyPromptProgram),
            };
        }
        case 'move_counters':
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'moveCountersSource',
                    title: '选择移出力量标记的角色',
                    minions: collectOwnMinions(state.core, context.playerId).filter(target => (target.counters ?? 0) > 0),
                }, disneyPromptProgram),
            };
        case 'extra_action':
            return { events: [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason)] };
        case 'destroy_upgrade': {
            const baseIndex = context.targetBaseIndex ?? 0;
            const cards = collectOngoingCardsAtBase(state.core, baseIndex);
            if (cards.length === 0) return { events: [] };
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'destroyOngoing',
                    title: '选择要摧毁的行动或装备',
                    cards,
                    targetBaseIndex: baseIndex,
                }, disneyPromptProgram),
            };
        }
        case 'add_temp_power_here_2': {
            const baseIndex = context.targetBaseIndex ?? 0;
            const sourceUid = context.targetMinion?.minionUid;
            const targets = collectMinions(state.core, (minion, minionBaseIndex) =>
                minionBaseIndex === baseIndex && minion.uid !== sourceUid,
            );
            return {
                events: [],
                continuation: createAbilityRuntimeContinuation({
                    ...context,
                    kind: 'addTempPower',
                    title: '选择这里另一个角色',
                    minions: targets,
                    amount: 2,
                }, disneyPromptProgram),
            };
        }
        case 'draw_card':
            return { events: buildStandardDrawEvents(state, context.playerId, 1, random, timestamp) };
        case 'draw_two':
            return { events: buildStandardDrawEvents(state, context.playerId, 2, random, timestamp) };
        case 'extra_minion_power_2':
            return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason, context.targetBaseIndex, { powerMax: 2 })] };
        case 'extra_minion_power_3':
            return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason, context.targetBaseIndex, { powerMax: 3 })] };
        case 'extra_minion_power_4':
            return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason, context.targetBaseIndex, { powerMax: 4 })] };
        case 'play_microbot':
            return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason, undefined, { sameNameOnly: true, sameNameDefId: MICROBOT_SWARM })] };
        case 'move_microbots': {
            const source = context.targetBaseIndex ?? 0;
            const destination = state.core.bases.findIndex((_base, index) => index !== source);
            if (destination < 0) return { events: [] };
            const base = state.core.bases[source];
            const batchId = `${context.reason}_${timestamp}`;
            return {
                events: base.minions
                    .filter(minion => minion.controller === context.playerId && matchesDefId(minion.defId, MICROBOT_SWARM))
                    .flatMap(minion => buildValidatedMoveEvents(state, {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        fromBaseIndex: source,
                        toBaseIndex: destination,
                        reason: context.reason,
                        now: timestamp,
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: source,
                        sourceKind: 'action',
                        batchId,
                    })),
            };
        }
        default:
            return { events: [] };
    }
}

function promptMinion(
    ctx: AbilityContext,
    params: Omit<DisneyPromptContext, 'matchState' | 'playerId' | 'now' | 'kind'> & { kind: DisneyPromptContext['kind'] },
): AbilityResult {
    const candidates = params.minions ?? [];
    const requiresMinionCandidates = ![
        'mode',
        'moveMinionDestination',
        'discardThenDestroyLowPower',
        'playDeckMinion',
        'destroyOngoing',
    ].includes(params.kind) && !params.kind.startsWith('base');
    if (requiresMinionCandidates && candidates.length === 0) return { events: [] };
    return runPrompt({ matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now, ...params });
}

function addCountersToTargets(
    targets: Array<MinionChoice & { label: string }>,
    ctx: AbilityContext,
    amount: number,
    reason: string,
    title = '选择放置 +1 力量标记的角色',
    maxChoices?: number,
): AbilityResult {
    return promptMinion(ctx, {
        sourceId: reason,
        title,
        kind: 'addCounters',
        minions: targets,
        amount,
        maxChoices,
        reason,
    });
}

function addCounterToOwnMinion(ctx: AbilityContext, amount: number, reason: string): AbilityResult {
    return addCountersToTargets(collectOwnMinions(ctx.state, ctx.playerId), ctx, amount, reason);
}

function recoverFirstDiscard(
    ctx: AbilityContext,
    predicate: (card: CardInstance) => boolean,
    reason: string,
    title: string,
    optional = false,
): AbilityResult {
    const cards = collectDiscardCards(ctx.state, ctx.playerId, predicate);
    if (cards.length === 0) return { events: [] };
    if (ctx.matchState) {
        return runPrompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: reason,
            title,
            kind: 'recoverDiscard',
            cards,
            maxChoices: 1,
            optional,
            reason,
        });
    }
    return { events: [] };
}

function recoverDiscardByPower(ctx: AbilityContext, maxPower: number, reason: string, title: string, optional = false): AbilityResult {
    return recoverFirstDiscard(
        ctx,
        card => (getMinionDef(card.defId)?.power ?? Number.POSITIVE_INFINITY) <= maxPower,
        reason,
        title,
        optional,
    );
}

function searchDeckByDef(ctx: AbilityContext, defId: string, maxPick: number, reason: string, title: string): AbilityResult {
    const cards = collectDeckCards(ctx.state, ctx.playerId, card => matchesDefId(card.defId, defId));
    if (cards.length === 0) return { events: [] };
    if (ctx.matchState) {
        return runPrompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: reason,
            title,
            kind: 'recoverCards',
            cards,
            maxChoices: maxPick,
            reason,
        });
    }
    return { events: revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        predicate: card => matchesDefId(card.defId, defId),
        maxPick,
        revealTo: 'all',
        reason,
        now: ctx.now,
    }).events };
}

function lionCubSearch(ctx: AbilityContext | TriggerContext): AbilityResult {
    const cards = collectDeckCards(
        ctx.state,
        ctx.playerId,
        card => (getMinionDef(card.defId)?.power ?? Number.POSITIVE_INFINITY) <= 4,
    );
    if (cards.length === 0) return { events: [] };
    if (ctx.matchState) {
        return runPrompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'lion_king_lion_cub',
            title: '幼狮：选择牌库中力量 4 或以下角色加入手牌',
            kind: 'recoverCards',
            cards,
            maxChoices: 1,
            reason: 'lion_king_lion_cub',
        });
    }
    return {
        events: revealAndPickFromDeck({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            predicate: card => (getMinionDef(card.defId)?.power ?? Number.POSITIVE_INFINITY) <= 4,
            maxPick: 1,
            revealTo: 'all',
            reason: 'lion_king_lion_cub',
            now: ctx.now,
        }).events,
    };
}

function microbotSwarmOnPlay(ctx: AbilityContext): AbilityResult {
    return recoverFirstDiscard(
        ctx,
        card => matchesDefId(card.defId, MICROBOT_SWARM),
        'big_hero_6_microbot_swarm',
        '微型机器群：选择弃牌堆中的一张微型机器群回手',
    );
}

function microbotSwarmTalent(ctx: AbilityContext): AbilityResult {
    return { events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'big_hero_6_microbot_swarm', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    })] };
}

function fredTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    const events = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
    if (!self || (self.powerCounters ?? 0) <= 0) return { events };
    const targets = collectMinions(ctx.state, (minion, baseIndex) => baseIndex === ctx.baseIndex && minion.uid !== ctx.cardUid);
    const prompt = promptMinion(ctx, {
        sourceId: 'big_hero_6_fred_frederickson_iv',
        title: '弗雷德IV世：选择获得 -2 力量的角色',
        kind: 'addTempPower',
        minions: targets,
        amount: -2,
        optional: true,
        reason: 'big_hero_6_fred_frederickson_iv',
    });
    return prompt.matchState ? { events, matchState: prompt.matchState } : { events: [...events, ...prompt.events] };
}

function goGoTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    const bases = collectOtherBases(ctx.state, ctx.baseIndex);
    if (!self || bases.length === 0) return { events: [] };
    return promptMinion(ctx, {
        sourceId: 'big_hero_6_go_go_tomago',
        title: '神行御姐：选择移动到的基地',
        kind: 'moveMinionDestination',
        bases,
        targetMinion: { minionUid: self.uid, minionDefId: self.defId, baseIndex: ctx.baseIndex },
        reason: 'big_hero_6_go_go_tomago',
    });
}

function hiroTalent(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'big_hero_6_hiro_hamada',
        title: '小宏：选择效果',
        kind: 'mode',
        targetBaseIndex: ctx.baseIndex,
        modes: [
            { mode: 'add_counter_here', label: '在这里的一个角色上放置 +1 力量标记' },
            { mode: 'move_counters', label: '移动你的力量标记' },
        ],
        reason: 'big_hero_6_hiro_hamada',
    });
}

function honeyLemonTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (self && (self.powerCounters ?? 0) > 0) {
        const canDestroyUpgrade = collectOngoingCardsAtBase(ctx.state, ctx.baseIndex).length > 0;
        return runPrompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'big_hero_6_honey_lemon',
            title: '哈妮柠檬：选择效果',
            kind: 'mode',
            targetBaseIndex: ctx.baseIndex,
            modes: [
                { mode: 'extra_action', label: '打出一个额外行动' },
                ...(canDestroyUpgrade ? [{ mode: 'destroy_upgrade', label: '摧毁这里的行动/装备' }] : []),
            ],
            reason: 'big_hero_6_honey_lemon',
        });
    }
    return destroyOngoingHere(ctx, 'big_hero_6_honey_lemon');
}

function destroyOngoingHere(ctx: AbilityContext, reason: string): AbilityResult {
    const cards = collectOngoingCardsAtBase(ctx.state, ctx.baseIndex);
    if (cards.length === 0) return { events: [] };
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: reason,
        title: '选择要摧毁的行动或装备',
        kind: 'destroyOngoing',
        cards,
        reason,
    });
}

function wasabiTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    const counters = self?.powerCounters ?? 0;
    const amount = counters > 0 ? Math.min(5, counters) : 1;
    return { events: [addTempPower(ctx.cardUid, ctx.baseIndex, amount, 'big_hero_6_wasabi', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    })] };
}

function controlMaskOnPlay(ctx: AbilityContext): AbilityResult {
    return searchDeckByDef(
        ctx,
        MICROBOT_SWARM,
        1,
        'big_hero_6_control_mask',
        '控制面具：选择牌库中的一张微型机器群加入手牌',
    );
}

function controlMaskTalent(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'big_hero_6_control_mask',
        title: '控制面具：选择效果',
        kind: 'mode',
        targetBaseIndex: ctx.baseIndex,
        modes: [
            { mode: 'play_microbot', label: '额外打出一张微型机器群' },
            { mode: 'move_microbots', label: '移动这里的微型机器群到另一个基地' },
        ],
        reason: 'big_hero_6_control_mask',
    });
}

function controlTheSwarm(ctx: AbilityContext): AbilityResult {
    const targets = collectOwnMinions(ctx.state, ctx.playerId).filter(target => (target.counters ?? 0) === 0);
    if (targets.length > 0) {
        return { events: targets.map(target => addPowerCounter(target.minionUid, target.baseIndex, 1, 'big_hero_6_control_the_swarm', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
        })) };
    }
    return hiroTalent({ ...ctx, defId: 'big_hero_6_control_the_swarm' });
}

function microbotMakerOnPlay(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const targets = collectOwnMinions(ctx.state, ctx.playerId).filter(target => target.baseIndex === baseIndex);
    return { events: targets.map(target => addPowerCounter(target.minionUid, target.baseIndex, 1, 'big_hero_6_microbot_maker', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: baseIndex,
    })) };
}

function microbotMakerTalent(ctx: AbilityContext): AbilityResult {
    const targets = collectOwnMinions(ctx.state, ctx.playerId).filter(target => target.baseIndex === ctx.baseIndex);
    return addCountersToTargets(targets, ctx, 1, 'big_hero_6_microbot_maker');
}

function newStudent(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            queueMinionPlayEffect(ctx.playerId, 'addPowerCounter', 1, ctx.now, 'big_hero_6_new_student'),
            grantContextualExtraMinion(ctx, 'big_hero_6_new_student', undefined, { powerMax: 3 }),
        ],
    };
}

function teamEffort(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'big_hero_6_team_effort',
        title: '团队的努力：选择基地',
        kind: 'baseDrawCounters',
        bases: ctx.state.bases.map((_base, baseIndex) => ({ baseIndex, label: currentBaseName(ctx.state, baseIndex) })),
        reason: 'big_hero_6_team_effort',
    });
}

function upgrades(ctx: AbilityContext): AbilityResult {
    const counters = addCounterToOwnMinion(ctx, 2, 'big_hero_6_upgrades');
    return { events: [grantContextualExtraAction(ctx, 'big_hero_6_upgrades'), ...counters.events], matchState: counters.matchState };
}

function versionTwo(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.controller === ctx.playerId && (minion.powerCounters ?? 0) > 0)
            .map(minion => addTempPower(minion.uid, baseIndex, 2, 'big_hero_6_version_2_0', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
            })),
    };
}

function baymaxAfterScoring(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!self || (self.powerCounters ?? 0) <= 0) return { events: [] };
    const targets = collectMinions(
        ctx.state,
        (minion, baseIndex) => baseIndex === ctx.baseIndex && minion.controller === ctx.playerId && minion.uid !== ctx.cardUid,
    );
    const destinations = collectOtherBases(ctx.state, ctx.baseIndex);
    if (targets.length === 0 || destinations.length === 0) return { events: [] };
    if (ctx.matchState) {
        return promptMinion(ctx, {
            sourceId: 'big_hero_6_baymax',
            title: '大白：选择要移动的另一个己方角色',
            kind: 'moveMinionTarget',
            minions: targets,
            bases: destinations,
            requireOwnTarget: true,
            sourceDefId: ctx.defId,
            sourceKind: 'nonAction',
            reason: 'big_hero_6_baymax',
        });
    }
    return { events: [] };
}

function yokaiAfterScoring(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const sourceUids = new Set(base.minions
        .filter(minion => minion.controller === ctx.playerId && (minion.powerCounters ?? 0) > 0)
        .map(minion => minion.uid));
    if (sourceUids.size === 0) return { events: [] };
    const receivers = collectOwnMinions(ctx.state, ctx.playerId)
        .filter(target => !sourceUids.has(target.minionUid));
    if (receivers.length === 0) return { events: [] };
    if (!ctx.matchState) return { events: [] };
    return promptMinion(ctx, {
        sourceId: 'big_hero_6_yokai',
        title: '妖怪：选择接收 +1 力量标记的角色',
        kind: 'yokaiReceiver',
        minions: receivers,
        optional: true,
        targetBaseIndex: ctx.baseIndex,
        reason: 'big_hero_6_yokai',
    });
}

function snowgie(ctx: AbilityContext): AbilityResult {
    return addCountersToTargets(
        collectMinions(ctx.state, (minion, baseIndex) =>
            baseIndex === ctx.baseIndex
            && minion.controller === ctx.playerId
            && getMinionPower(ctx.state, minion, baseIndex) >= 5,
        ),
        ctx,
        1,
        'frozen_snowgie',
        '迷你雪人：选择这里力量 5 或更高的角色',
    );
}

function olaf(ctx: AbilityContext): AbilityResult {
    const top = topDeckChoices(ctx.state, ctx.playerId, 2, 'frozen_olaf', ctx.now);
    if (top.cards.length === 0) return { events: [] };
    const prompt = runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_olaf',
        title: '雪宝：选择要弃置的牌库顶牌（可不选）',
        kind: 'deckTopChooseDiscard',
        cards: top.cards,
        deckTopCards: top.cards,
        maxChoices: top.cards.length,
        optional: true,
        reason: 'frozen_olaf',
    });
    return { ...prompt, events: [...top.events, ...prompt.events] };
}

function sven(ctx: AbilityContext): AbilityResult {
    const moveTargets = collectMinions(ctx.state, (minion, baseIndex) =>
        minion.controller === ctx.playerId && baseIndex !== ctx.baseIndex,
    );
    const kristoffCards = [
        ...collectDeckCards(ctx.state, ctx.playerId, card => matchesDefId(card.defId, 'frozen_kristoff')),
        ...collectDiscardCards(ctx.state, ctx.playerId, card => matchesDefId(card.defId, 'frozen_kristoff')),
    ];
    const modes: Array<ModeChoice & { label: string }> = [];
    if (moveTargets.length > 0) modes.push({ mode: 'sven_move_here', label: '将你的一个角色移动到这里' });
    if (kristoffCards.length > 0) modes.push({ mode: 'sven_search_kristoff', label: '搜索克里斯托弗并置入手牌' });
    if (modes.length === 0) return { events: [] };
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_sven',
        title: '斯文：选择天赋效果',
        kind: 'mode',
        baseIndex: ctx.baseIndex,
        modes,
        reason: 'frozen_sven',
    });
}

function frozenSearchCards(
    state: SmashUpCore,
    playerId: PlayerId,
    defIds: string[],
): Array<CardChoice & { label: string }> {
    const predicate = (card: CardInstance) => defIds.some(defId => matchesDefId(card.defId, defId));
    return [
        ...collectDeckCards(state, playerId, predicate).map(card => ({ ...card, label: `${card.label}（牌库）` })),
        ...collectDiscardCards(state, playerId, predicate).map(card => ({ ...card, label: `${card.label}（弃牌堆）` })),
    ];
}

function searchFrozenToHand(ctx: AbilityContext, sourceId: string, title: string, defIds: string[]): AbilityResult {
    const cards = frozenSearchCards(ctx.state, ctx.playerId, defIds);
    if (cards.length === 0 || !ctx.matchState) return { events: [] };
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        kind: 'recoverCards',
        cards,
        maxChoices: 1,
        reason: sourceId,
    });
}

function annaOnPlay(ctx: AbilityContext): AbilityResult {
    return searchFrozenToHand(ctx, 'frozen_anna', '安娜：搜索艾莎或克里斯托弗并置入手牌', ['frozen_elsa', 'frozen_kristoff']);
}

function kristoffTalent(ctx: AbilityContext): AbilityResult {
    const extraMinions = [
        ...collectHandCards(ctx.state, ctx.playerId, card => (getMinionDef(card.defId)?.power ?? 99) <= 5),
        ...collectDiscardCards(ctx.state, ctx.playerId, card => (getMinionDef(card.defId)?.power ?? 99) <= 5)
            .map(card => ({ ...card, label: `${card.label}（弃牌堆）` })),
    ];
    const marshmallow = collectDiscardCards(ctx.state, ctx.playerId, card => matchesDefId(card.defId, 'frozen_marshmallow'));
    const modes: Array<ModeChoice & { label: string }> = [];
    if (extraMinions.length > 0) modes.push({ mode: 'kristoff_extra_minion', label: '额外打出一张力量 5 或更低的角色' });
    if (marshmallow.length > 0) modes.push({ mode: 'kristoff_recover_marshmallow', label: '从弃牌堆取回棉花糖' });
    if (modes.length === 0) return { events: [] };
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_kristoff',
        title: '克里斯托弗：选择天赋效果',
        kind: 'mode',
        modes,
        reason: 'frozen_kristoff',
    });
}

function elsaTalent(ctx: AbilityContext): AbilityResult {
    const extraMinions = [
        ...collectHandCards(ctx.state, ctx.playerId, card => matchesDefId(card.defId, 'frozen_olaf') || matchesDefId(card.defId, 'frozen_snowgie')),
        ...collectDiscardCards(ctx.state, ctx.playerId, card => matchesDefId(card.defId, 'frozen_olaf') || matchesDefId(card.defId, 'frozen_snowgie'))
            .map(card => ({ ...card, label: `${card.label}（弃牌堆）` })),
    ];
    const marshmallow = collectDiscardCards(ctx.state, ctx.playerId, card => matchesDefId(card.defId, 'frozen_marshmallow'));
    const modes: Array<ModeChoice & { label: string }> = [];
    if (extraMinions.length > 0) modes.push({ mode: 'elsa_extra_minion', label: '额外打出雪宝或迷你雪人' });
    if (marshmallow.length > 0) modes.push({ mode: 'elsa_recover_marshmallow', label: '从弃牌堆取回棉花糖' });
    if (modes.length === 0) return { events: [] };
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_elsa',
        title: '艾莎：选择天赋效果',
        kind: 'mode',
        modes,
        reason: 'frozen_elsa',
    });
}

function actOfTrueLove(ctx: AbilityContext): AbilityResult {
    return promptMinion(ctx, {
        sourceId: 'frozen_act_of_true_love',
        title: '真爱的行为：选择要摧毁的己方角色',
        kind: 'destroyOwnThenPlayDiscardMinion',
        minions: collectOwnMinions(ctx.state, ctx.playerId),
        reason: 'frozen_act_of_true_love',
    });
}

function bigSummerBlowout(ctx: AbilityContext): AbilityResult {
    const handCards = cardChoicesFromInstances(ctx.state.players[ctx.playerId]?.hand ?? [], 'hand');
    if (handCards.length === 0) return { events: [] };
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_big_summer_blowout',
        title: '夏天大盛宴：选择一张手牌弃置',
        kind: 'discardThenRecoverMinion',
        cards: handCards,
        maxChoices: 1,
        reason: 'frozen_big_summer_blowout',
    });
}

function buildSnowman(ctx: AbilityContext): AbilityResult {
    const cards = collectDiscardCards(ctx.state, ctx.playerId, card =>
        matchesDefId(card.defId, 'frozen_marshmallow')
        || matchesDefId(card.defId, 'frozen_olaf')
        || matchesDefId(card.defId, 'frozen_snowgie'),
    ).map(card => ({ ...card, label: `${card.label}（弃牌堆）` }));
    if (cards.length === 0) return { events: [] };
    if (ctx.matchState) {
        return runPrompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'frozen_do_you_want_to_build_a_snowman',
            title: '你想和我堆个雪人吗：选择要额外打出的角色',
            kind: 'playDiscardMinion',
            cards,
            reason: 'frozen_do_you_want_to_build_a_snowman',
        });
    }
    return { events: [] };
}

function hans(ctx: AbilityContext): AbilityResult {
    const targetPlayerIds = (ctx.state.seatOrder?.length
        ? ctx.state.seatOrder
        : Object.keys(ctx.state.players)) as PlayerId[];
    if (targetPlayerIds.length === 0) return { events: [] };
    const firstPlayerId = targetPlayerIds[0];
    return runPrompt({
        matchState: ctx.matchState,
        playerId: firstPlayerId,
        now: ctx.now,
        sourceId: 'frozen_hans_westergaard',
        title: `汉斯：${firstPlayerId} 展示手牌中的一个角色，或展示没有角色`,
        kind: 'hansReveal',
        targetPlayerIds,
        sourcePlayerId: ctx.playerId,
        cards: collectHandCards(ctx.state, firstPlayerId, card => getMinionDef(card.defId) !== undefined),
        hansRevealed: [],
        optional: true,
        reason: 'frozen_hans_westergaard',
    });
}

function letItGo(ctx: AbilityContext): AbilityResult {
    const top = topDeckChoices(ctx.state, ctx.playerId, 3, 'frozen_let_it_go', ctx.now);
    if (top.cards.length === 0) return { events: [] };
    const prompt = runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_let_it_go',
        title: '放手吧：从牌库顶三张中选择一张抽取',
        kind: 'deckTopPickOne',
        cards: top.cards,
        deckTopCards: top.cards,
        optional: true,
        reason: 'frozen_let_it_go',
    });
    return { ...prompt, events: [...top.events, ...prompt.events] };
}

function reindeers(ctx: AbilityContext): AbilityResult {
    const cards = collectSearchableMinions(ctx.state, ctx.playerId);
    if (cards.length === 0 || !ctx.matchState) return { events: [] };
    const result = runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_reindeers_are_better_than_people',
        title: '驯鹿的心地比人好：选择要搜索的角色',
        kind: 'searchPlayMinion',
        cards,
        reason: 'frozen_reindeers_are_better_than_people',
    });
    return {
        ...result,
        events: [
            inspectDeck(ctx.playerId, ctx.playerId, ctx.state.players[ctx.playerId]?.deck.length ?? 0, 'frozen_reindeers_are_better_than_people', ctx.now),
            ...result.events,
        ],
    };
}

function rafiki(ctx: AbilityContext): AbilityResult {
    return recoverDiscardByPower(ctx, 2, 'lion_king_rafiki', '拉飞奇：选择弃牌堆中力量 2 或更低的角色回手');
}

function timonAndPumbaa(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const foundIndex = player.deck.findIndex(card => matchesDefId(card.defId, HAKUNA_MATATA));
    if (foundIndex < 0) return { events: [] };
    const discarded = player.deck.slice(0, foundIndex);
    const found = player.deck[foundIndex];
    return {
        events: [
            ...(discarded.length > 0 ? [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: ctx.playerId, cardUids: discarded.map(card => card.uid), reason: 'lion_king_timon_and_pumbaa' },
                timestamp: ctx.now,
            } as CardsDiscardedEvent] : []),
            {
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId: ctx.playerId, deckUids: [found.uid, ...player.deck.slice(foundIndex + 1).map(card => card.uid)] },
                timestamp: ctx.now,
            } as DeckReorderedEvent,
            ...buildStandardDrawEvents({ ...ctx.state, players: { ...ctx.state.players, [ctx.playerId]: { ...player, deck: [found, ...player.deck.slice(foundIndex + 1)] } } }, ctx.playerId, 1, ctx.random, ctx.now),
        ],
    };
}

function zazu(ctx: AbilityContext): AbilityResult {
    if (hasMufasaInDiscard(ctx.state, ctx.playerId)) {
        return promptMinion(ctx, {
            sourceId: 'lion_king_zazu',
            title: '沙祖：选择效果',
            kind: 'mode',
            targetBaseIndex: ctx.baseIndex,
            targetMinion: { minionUid: ctx.cardUid, minionDefId: ctx.defId, baseIndex: ctx.baseIndex },
            modes: [
                { mode: 'add_temp_power_here_2', label: '这里另一个角色本回合 +2 力量' },
                { mode: 'draw_card', label: '抽 1 张牌' },
            ],
            reason: 'lion_king_zazu',
        });
    }
    return promptMinion(ctx, {
        sourceId: 'lion_king_zazu',
        title: '沙祖：选择这里另一个角色',
        kind: 'addTempPower',
        minions: collectMinions(ctx.state, (minion, baseIndex) => baseIndex === ctx.baseIndex && minion.uid !== ctx.cardUid),
        amount: 2,
        reason: 'lion_king_zazu',
    });
}

function nala(ctx: AbilityContext): AbilityResult {
    if (!hasMufasaInDiscard(ctx.state, ctx.playerId)) return { events: [] };
    return { events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'lion_king_nala', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    })] };
}

function simba(ctx: AbilityContext): AbilityResult {
    if (!hasMufasaInDiscard(ctx.state, ctx.playerId)) return { events: [] };
    return { events: [
        ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'lion_king_simba', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }),
    ] };
}

function hakunaMatata(ctx: AbilityContext): AbilityResult {
    const drawEvents = buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now);
    const recover = recoverFirstDiscard(
        ctx,
        card => matchesDefId(card.defId, TIMON_AND_PUMBAA),
        'lion_king_hakuna_matata',
        '哈库那玛塔塔：选择弃牌堆中的丁满和彭彭回手',
        true,
    );
    return { events: [...drawEvents, ...recover.events], matchState: recover.matchState };
}

function justCantWait(ctx: AbilityContext): AbilityResult {
    return addCounterToOwnMinion(ctx, hasMufasaInDiscard(ctx.state, ctx.playerId) ? 4 : 2, 'lion_king_just_cant_wait_to_be_king');
}

function scar(ctx: AbilityContext): AbilityResult {
    const targets = collectMinions(ctx.state, (minion, baseIndex) =>
        (minion.controller !== ctx.playerId && getMinionPower(ctx.state, minion, baseIndex) <= 5)
        || minion.controller === ctx.playerId,
    );
    return promptMinion(ctx, {
        sourceId: 'lion_king_scar',
        title: '刀疤：选择要摧毁的角色',
        kind: 'scarDestroy',
        minions: targets,
        reason: 'lion_king_scar',
    });
}

function theHyenas(ctx: AbilityContext): AbilityResult {
    const prompt = promptMinion(ctx, {
        sourceId: 'lion_king_the_hyenas',
        title: '鬣狗：选择力量 3 或更低的角色',
        kind: 'destroyMinion',
        minions: collectMinions(ctx.state, (minion, baseIndex) => getMinionPower(ctx.state, minion, baseIndex) <= 3),
        reason: 'lion_king_the_hyenas',
    });
    const bonus = hasMufasaInDiscard(ctx.state, ctx.playerId)
        ? [...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now), grantContextualExtraAction(ctx, 'lion_king_the_hyenas')]
        : [];
    return { events: [...bonus, ...prompt.events], matchState: prompt.matchState };
}

function wildebeestStampede(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    const deckMinions = ctx.state.players[ctx.playerId]?.deck
        .filter(card => getMinionDef(card.defId))
        .map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: getCardDef(card.defId)?.name ?? card.defId })) ?? [];
    if (ownMinions.length === 0 || deckMinions.length === 0) return { events: [] };
    if (!ctx.matchState) return { events: [] };
    return promptMinion(ctx, {
        sourceId: 'lion_king_wildebeest_stampede_destroy',
        title: '牛羚踩踏：选择要摧毁的己方角色',
        kind: 'destroyOwnThenPlayDeckMinion',
        minions: ownMinions,
        cards: deckMinions,
        reason: 'lion_king_wildebeest_stampede',
    });
}

function criKee(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base?.minions.some(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)) return { events: [] };
    return { events: [grantContextualExtraMinion(ctx, 'mulan_cri_kee', undefined, { powerMax: 3 })] };
}

function mushu(ctx: AbilityContext): AbilityResult {
    return addCountersToTargets(
        collectMinions(ctx.state, (minion, baseIndex) => baseIndex === ctx.baseIndex && minion.uid !== ctx.cardUid),
        ctx,
        1,
        'mulan_mushu',
        '木须：选择这里另一个角色',
        undefined,
    );
}

function ling(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraMinion(ctx, 'mulan_ling', ctx.baseIndex, { powerMax: 2 })] };
}

function yao(ctx: AbilityContext): AbilityResult {
    return promptMinion(ctx, {
        sourceId: 'mulan_yao',
        title: '尧：选择这里力量 2 或更低的角色',
        kind: 'destroyMinion',
        minions: collectMinions(ctx.state, (minion, baseIndex) => baseIndex === ctx.baseIndex && getMinionPower(ctx.state, minion, baseIndex) <= 2),
        optional: true,
        reason: 'mulan_yao',
    });
}

function liShang(ctx: AbilityContext): AbilityResult {
    return addCountersToTargets(
        collectOwnMinions(ctx.state, ctx.playerId).filter(target => target.baseIndex === ctx.baseIndex && target.minionUid !== ctx.cardUid),
        ctx,
        1,
        'mulan_li_shang',
    );
}

function mulan(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'mulan_mulan',
        title: '木兰：选择效果',
        kind: 'mode',
        modes: [
            { mode: 'extra_action', label: '打出一个额外行动' },
            { mode: 'draw_card', label: '抽 1 张牌' },
        ],
        reason: 'mulan_mulan',
    });
}

function avalanche(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const cards = player?.hand
        .filter(card => card.uid !== ctx.cardUid)
        .map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: getCardDef(card.defId)?.name ?? card.defId })) ?? [];
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'mulan_avalanche',
        title: '雪崩：选择弃掉的手牌',
        kind: 'discardThenDestroyLowPower',
        cards,
        targetBaseIndex: baseIndex,
        reason: 'mulan_avalanche',
    });
}

function beAMan(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    return addCountersToTargets(
        collectMinions(ctx.state, (minion, index) => index === baseIndex && minion.controller === ctx.playerId),
        ctx,
        1,
        'mulan_be_a_man',
        '成为一个男人：选择至多两个角色',
        2,
    );
}

function callUpNewRecruits(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'mulan_call_up_new_recruits',
        title: '招收新兵：选择效果',
        kind: 'mode',
        modes: [
            { mode: 'extra_minion_power_4', label: '额外打出力量 4 或更低的角色' },
            { mode: 'draw_two', label: '抽 2 张牌' },
        ],
        reason: 'mulan_call_up_new_recruits',
    });
}

function dragonCannon(ctx: AbilityContext): AbilityResult {
    return promptMinion(ctx, {
        sourceId: 'mulan_dragon_cannon',
        title: '飞龙巨炮：选择力量 3 或更低的角色',
        kind: 'destroyMinion',
        minions: collectMinions(ctx.state, (minion, baseIndex) => getMinionPower(ctx.state, minion, baseIndex) <= 3),
        reason: 'mulan_dragon_cannon',
    });
}

function groupTraining(ctx: AbilityContext): AbilityResult {
    return { events: collectOwnMinions(ctx.state, ctx.playerId).map(target => addPowerCounter(target.minionUid, target.baseIndex, 1, 'mulan_group_training', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
    })) };
}

function prepareToFight(ctx: AbilityContext): AbilityResult {
    const counters = addCounterToOwnMinion(ctx, 2, 'mulan_prepare_to_fight');
    return { events: [...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now), ...counters.events], matchState: counters.matchState };
}

function shanYu(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const ownMax = Math.max(0, ...ctx.state.bases[baseIndex]?.minions
        .filter(minion => minion.controller === ctx.playerId)
        .map(minion => getMinionPower(ctx.state, minion, baseIndex)) ?? []);
    return promptMinion(ctx, {
        sourceId: 'mulan_shan_yu',
        title: '单于：选择计分前摧毁的角色',
        kind: 'shanYuDestroy',
        minions: collectMinions(ctx.state, (minion, index) => index === baseIndex && getMinionPower(ctx.state, minion, index) <= ownMax),
        targetBaseIndex: baseIndex,
        reason: 'mulan_shan_yu',
    });
}

function drawOnPowerCounterHere(ctx: TriggerContext, onceKey: string): SmashUpEvent[] {
    if (
        ctx.affectType !== 'power_change'
        || ctx.counterChangeKind !== 'added'
        || (ctx.counterDelta ?? 0) <= 0
        || ctx.baseIndex === undefined
        || !ctx.triggerMinion
    ) return [];
    if (ctx.triggerMinion.controller !== ctx.playerId) return [];
    const already = Number(ctx.triggerMinion.metadata?.[onceKey] ?? -1) === ctx.state.turnNumber;
    if (already) return [];
    return [
        ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        buildMinionMetadataEvent(ctx.triggerMinion.uid, ctx.baseIndex, { [onceKey]: ctx.state.turnNumber }, onceKey, ctx.now),
    ];
}

function markMulanPowerCounterThisTurn(ctx: TriggerContext): SmashUpEvent[] {
    if (
        ctx.affectType !== 'power_change'
        || ctx.counterChangeKind !== 'added'
        || (ctx.counterDelta ?? 0) <= 0
        || ctx.baseIndex === undefined
        || !ctx.triggerMinion
        || ctx.triggerMinion.uid !== ctx.sourceCardUid
        || ctx.triggerMinion.controller !== ctx.sourceControllerId
    ) return [];
    const counterSourcePlayerId = (ctx.affectEvent?.payload as { sourcePlayerId?: PlayerId } | undefined)?.sourcePlayerId;
    if (counterSourcePlayerId !== ctx.sourceControllerId) return [];
    return [buildMinionMetadataEvent(
        ctx.triggerMinion.uid,
        ctx.baseIndex,
        { [MULAN_COUNTER_TURN_KEY]: ctx.state.turnNumber },
        MULAN_COUNTER_TURN_KEY,
        ctx.now,
    )];
}

function jungleParadiseAfterMinionDiscarded(ctx: TriggerContext): AbilityResult {
    const baseIndex = ctx.sourceBaseIndex ?? ctx.baseIndex;
    const playerId = ctx.triggerMinion?.controller ?? ctx.playerId;
    if (baseIndex === undefined || ctx.baseIndex !== baseIndex || !ctx.triggerMinion) return { events: [] };
    if (ctx.triggerMinion.controller !== playerId) return { events: [] };
    const targets = collectMinions(ctx.state, (minion) =>
        minion.controller === playerId,
    );
    if (targets.length === 0 || !ctx.matchState) return { events: [] };
    return promptMinion({
        state: ctx.state,
        matchState: ctx.matchState,
        playerId,
        cardUid: ctx.triggerMinionUid ?? '',
        defId: 'base_jungle_paradise',
        baseIndex,
        random: ctx.random,
        now: ctx.now,
    }, {
        sourceId: 'base_jungle_paradise',
        title: '丛林乐园：选择放置 +1 力量标记的角色',
        kind: 'addCounters',
        minions: targets,
        amount: 1,
        optional: true,
        reason: 'base_jungle_paradise',
    });
}

function jungleParadiseAfterMinionPlayed(ctx: TriggerContext): AbilityResult {
    const baseIndex = ctx.baseIndex;
    const playerId = ctx.triggerMinion?.controller ?? ctx.playerId;
    if (baseIndex === undefined || !ctx.triggerMinion || !ctx.matchState) return { events: [] };
    if (ctx.state.bases[baseIndex]?.defId !== 'base_jungle_paradise') return { events: [] };
    if (ctx.triggerMinion.controller !== playerId) return { events: [] };
    const targets = collectMinions(ctx.state, (minion, minionBaseIndex) =>
        minionBaseIndex === baseIndex && minion.controller === playerId,
    );
    if (targets.length === 0) return { events: [] };
    return promptMinion({
        state: ctx.state,
        matchState: ctx.matchState,
        playerId,
        cardUid: ctx.triggerMinionUid ?? '',
        defId: 'base_jungle_paradise',
        baseIndex,
        random: ctx.random,
        now: ctx.now,
    }, {
        sourceId: 'base_jungle_paradise',
        title: '丛林乐园：选择放置 +1 力量标记的角色',
        kind: 'addCounters',
        minions: targets,
        amount: 1,
        optional: true,
        reason: 'base_jungle_paradise',
    });
}

function validateMulanTalent(ctx: AbilityContext): string | null {
    const source = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!source || source.defId !== 'mulan_mulan') return '木兰不在这个基地';
    return Number(source.metadata?.[MULAN_COUNTER_TURN_KEY] ?? -1) === ctx.state.turnNumber
        ? null
        : '本回合需要先在木兰身上放置 +1 力量标记';
}

function bigHeroProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.minions.some(minion =>
        matchesDefId(minion.defId, 'big_hero_6_baymax')
        && minion.controller === ctx.targetMinion.controller
        && minion.uid !== ctx.targetMinion.uid,
    ) ?? false;
}

function annaProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.protectionType !== 'destroy') return false;
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.minions.some(minion =>
        minion.uid !== ctx.targetMinion.uid
        && minion.controller === ctx.targetMinion.controller
        && matchesDefId(minion.defId, 'frozen_anna'),
    );
}

function lockTheGatesProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.protectionType !== 'destroy' || ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.ongoingActions.some(action =>
        matchesDefId(action.defId, 'frozen_lock_the_gates')
        && getActionController(action) === ctx.targetMinion.controller,
    ) ?? false;
}

function icePalaceProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    if (ctx.protectionType !== 'destroy' && ctx.protectionType !== 'move') return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.defId === 'base_ice_palace';
}

function chienPoProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.minions.some(minion =>
        minion.controller === ctx.targetMinion.controller && matchesDefId(minion.defId, 'mulan_chien_po'),
    ) ?? false;
}

function forbiddenCityProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    if ((ctx.targetMinion.powerCounters ?? 0) <= 0) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.defId === 'base_forbidden_city';
}

function frozenPortRestriction(ctx: RestrictionCheckContext): boolean {
    const basePower = ctx.extra?.basePower as number | undefined;
    if (ctx.restrictionType !== 'play_minion') return false;
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    if (basePower === undefined) return false;
    if (!ctx.state.bases.some((_candidate, index) => index !== ctx.baseIndex)) return false;
    const port = base.ongoingActions.find(action => matchesDefId(action.defId, 'frozen_frozen_port'));
    if (!port || getActionController(port) === ctx.playerId) return false;
    const played = Object.values(ctx.state.players[ctx.playerId]?.minionsPlayedPerBase ?? {})
        .reduce((total, count) => total + (Number(count) || 0), 0);
    return played === 0;
}

function arendelleAfterMinionPlayed(ctx: TriggerContext): AbilityResult {
    const baseIndex = ctx.baseIndex;
    const playerId = ctx.triggerMinion?.controller ?? ctx.playerId;
    if (baseIndex === undefined || !ctx.matchState || !ctx.triggerMinion) return { events: [] };
    if (ctx.state.bases[baseIndex]?.defId !== 'base_arendelle') return { events: [] };
    const top = topDeckChoices(ctx.state, playerId, 2, 'base_arendelle', ctx.now);
    if (top.cards.length === 0) return { events: [] };
    const prompt = runPrompt({
        matchState: ctx.matchState,
        playerId,
        now: ctx.now,
        sourceId: 'base_arendelle',
        title: '阿伦黛尔：选择要抽取的牌库顶牌',
        kind: 'deckTopPickOne',
        cards: top.cards,
        deckTopCards: top.cards,
        discardOthersImmediately: true,
        optional: true,
        reason: 'base_arendelle',
    });
    return { ...prompt, events: [...top.events, ...prompt.events] };
}

function lockTheGatesTalent(ctx: AbilityContext): AbilityResult {
    const top = topDeckChoices(ctx.state, ctx.playerId, 1, 'frozen_lock_the_gates', ctx.now);
    if (top.cards.length === 0) return { events: [] };
    const prompt = runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_lock_the_gates',
        title: '锁上大门：弃掉牌库顶牌或放回牌库顶',
        kind: 'deckTopAction',
        cards: top.cards,
        reason: 'frozen_lock_the_gates',
    });
    return { ...prompt, events: [...top.events, ...prompt.events] };
}

function frozenPortTalent(ctx: AbilityContext): AbilityResult {
    const top = topDeckChoices(ctx.state, ctx.playerId, 1, 'frozen_frozen_port', ctx.now);
    if (top.cards.length === 0) return { events: [] };
    const prompt = runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_frozen_port',
        title: '冻结的港口：弃掉牌库顶牌或放回牌库顶',
        kind: 'deckTopAction',
        cards: top.cards,
        reason: 'frozen_frozen_port',
    });
    return { ...prompt, events: [...top.events, ...prompt.events] };
}

export function registerDisneyFourFactionsAbilities(): void {
    registerSimpleAbility('big_hero_6_microbot_swarm', 'onPlay', microbotSwarmOnPlay);
    registerSimpleAbility('big_hero_6_microbot_swarm', 'talent', microbotSwarmTalent);
    registerSimpleAbility('big_hero_6_baymax', 'special', baymaxAfterScoring);
    registerSimpleAbility('big_hero_6_fred_frederickson_iv', 'talent', fredTalent);
    registerSimpleAbility('big_hero_6_go_go_tomago', 'talent', goGoTalent);
    registerSimpleAbility('big_hero_6_hiro_hamada', 'talent', hiroTalent);
    registerSimpleAbility('big_hero_6_honey_lemon', 'talent', honeyLemonTalent);
    registerSimpleAbility('big_hero_6_wasabi', 'talent', wasabiTalent);
    registerSimpleAbility('big_hero_6_control_mask', 'onPlay', controlMaskOnPlay);
    registerSimpleAbility('big_hero_6_control_mask', 'talent', controlMaskTalent);
    registerSimpleAbility('big_hero_6_control_the_swarm', 'onPlay', controlTheSwarm);
    registerSimpleAbility('big_hero_6_microbot_maker', 'onPlay', microbotMakerOnPlay);
    registerSimpleAbility('big_hero_6_microbot_maker', 'talent', microbotMakerTalent);
    registerSimpleAbility('big_hero_6_new_student', 'onPlay', newStudent);
    registerSimpleAbility('big_hero_6_team_effort', 'onPlay', teamEffort);
    registerSimpleAbility('big_hero_6_upgrades', 'onPlay', upgrades);
    registerSimpleAbility('big_hero_6_version_2_0', 'onPlay', versionTwo);
    registerSimpleAbility('big_hero_6_yokai', 'special', yokaiAfterScoring);

    registerSimpleAbility('frozen_snowgie', 'onPlay', snowgie);
    registerSimpleAbility('frozen_olaf', 'talent', olaf);
    registerSimpleAbility('frozen_sven', 'talent', sven);
    registerSimpleAbility('frozen_anna', 'onPlay', annaOnPlay);
    registerSimpleAbility('frozen_kristoff', 'talent', kristoffTalent);
    registerSimpleAbility('frozen_elsa', 'talent', elsaTalent);
    registerSimpleAbility('frozen_act_of_true_love', 'onPlay', actOfTrueLove);
    registerSimpleAbility('frozen_big_summer_blowout', 'onPlay', bigSummerBlowout);
    registerSimpleAbility('frozen_do_you_want_to_build_a_snowman', 'onPlay', buildSnowman);
    registerSimpleAbility('frozen_frozen_port', 'talent', frozenPortTalent);
    registerSimpleAbility('frozen_hans_westergaard', 'onPlay', hans);
    registerSimpleAbility('frozen_let_it_go', 'onPlay', letItGo);
    registerSimpleAbility('frozen_lock_the_gates', 'talent', lockTheGatesTalent);
    registerSimpleAbility('frozen_reindeers_are_better_than_people', 'onPlay', reindeers);

    registerSimpleAbility('lion_king_rafiki', 'onPlay', rafiki);
    registerSimpleAbility('lion_king_timon_and_pumbaa', 'onPlay', timonAndPumbaa);
    registerSimpleAbility('lion_king_zazu', 'talent', zazu);
    registerSimpleAbility('lion_king_nala', 'onPlay', nala);
    registerSimpleAbility('lion_king_simba', 'onPlay', simba);
    registerSimpleAbility('lion_king_hakuna_matata', 'onPlay', hakunaMatata);
    registerSimpleAbility('lion_king_just_cant_wait_to_be_king', 'onPlay', justCantWait);
    registerSimpleAbility('lion_king_scar', 'onPlay', scar);
    registerSimpleAbility('lion_king_the_hyenas', 'onPlay', theHyenas);
    registerSimpleAbility('lion_king_wildebeest_stampede', 'onPlay', wildebeestStampede);
    registerSimpleAbility('lion_king_lion_cub', 'special', lionCubSearch);
    registerTrigger('lion_king_lion_cub', 'onMinionDiscardedFromBase', lionCubSearch, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => ctx.triggerMinionDefId === 'lion_king_lion_cub'
            && ctx.sourceCardUid === ctx.triggerMinionUid,
    });
    registerSimpleAbility('lion_king_mufasa', 'special', ctx => addCounterToOwnMinion(ctx, 2, 'lion_king_mufasa'));
    registerSimpleAbility('lion_king_hyenas_den', 'special', (ctx) => {
        if (!hasMufasaInDiscard(ctx.state, ctx.playerId)) return { events: [] };
        const targets = collectMinions(ctx.state, (minion, baseIndex) =>
            baseIndex === ctx.baseIndex && minion.controller === ctx.playerId,
        );
        const destinations = collectOtherBases(ctx.state, ctx.baseIndex);
        if (targets.length === 0 || destinations.length === 0) return { events: [] };
        return promptMinion(ctx, {
            sourceId: 'lion_king_hyenas_den',
            title: '鬣狗巢穴：选择要移动的角色',
            kind: 'moveMinionTarget',
            minions: targets,
            bases: destinations,
            requireOwnTarget: true,
            sourceDefId: ctx.defId,
            sourceKind: 'action',
            reason: 'lion_king_hyenas_den',
        });
    });
    registerSimpleAbility('lion_king_hyenas_den', 'talent', (ctx) => {
        const targets = collectMinions(ctx.state, (minion, baseIndex) =>
            baseIndex === ctx.baseIndex && minion.controller === ctx.playerId,
        );
        return promptMinion(ctx, {
            sourceId: 'lion_king_hyenas_den_talent',
            title: '鬣狗巢穴：选择这里一个己方角色',
            kind: 'addTempPower',
            minions: targets,
            amount: 2,
            reason: 'lion_king_hyenas_den_talent',
        });
    });

    registerSimpleAbility('mulan_cri_kee', 'onPlay', criKee);
    registerSimpleAbility('mulan_mushu', 'onPlay', mushu);
    registerSimpleAbility('mulan_ling', 'onPlay', ling);
    registerSimpleAbility('mulan_yao', 'onPlay', yao);
    registerSimpleAbility('mulan_li_shang', 'onPlay', liShang);
    registerSimpleAbility('mulan_mulan', 'talent', { execute: mulan, validateUse: validateMulanTalent });
    registerSimpleAbility('mulan_avalanche', 'onPlay', avalanche);
    registerSimpleAbility('mulan_be_a_man', 'talent', beAMan);
    registerSimpleAbility('mulan_call_up_new_recruits', 'onPlay', callUpNewRecruits);
    registerSimpleAbility('mulan_dragon_cannon', 'onPlay', dragonCannon);
    registerSimpleAbility('mulan_group_training', 'onPlay', groupTraining);
    registerSimpleAbility('mulan_prepare_to_fight', 'onPlay', prepareToFight);
    registerSimpleAbility('mulan_shan_yu', 'special', shanYu);

    registerProtection('big_hero_6_baymax', 'affect', bigHeroProtection);
    registerProtection('frozen_anna', 'destroy', annaProtection);
    registerProtection('frozen_lock_the_gates', 'destroy', lockTheGatesProtection);
    registerProtection('base_ice_palace', 'destroy', icePalaceProtection);
    registerProtection('base_ice_palace', 'move', icePalaceProtection);
    registerProtection('mulan_chien_po', 'affect', chienPoProtection);
    registerProtection('base_forbidden_city', 'affect', forbiddenCityProtection);
    registerRestriction('frozen_frozen_port', 'play_minion', frozenPortRestriction);

    registerTrigger('lion_king_circle_of_life', 'onMinionDiscardedFromBase', (ctx) => {
        if (ctx.sourceCardUid === undefined) return [];
        return [grantContextualExtraMinion({ playerId: ctx.sourceControllerId ?? ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'lion_king_circle_of_life', undefined, { powerMax: 3 })];
    }, { optional: true, playerContext: 'sourceController', canTrigger: ctx => ctx.sourceCardUid !== undefined });

    registerTrigger('base_jungle_paradise', 'onMinionDiscardedFromBase', jungleParadiseAfterMinionDiscarded, {
        optional: true,
        sourceScope: 'triggerBase',
        playerContext: 'eventPlayer',
        canTrigger: ctx => (ctx.sourceBaseIndex ?? ctx.baseIndex) !== undefined
            && ctx.state.bases[ctx.sourceBaseIndex ?? ctx.baseIndex!]?.defId === 'base_jungle_paradise'
            && ctx.triggerMinion?.controller === ctx.playerId,
    });
    registerTrigger('base_jungle_paradise', 'onMinionPlayed', jungleParadiseAfterMinionPlayed, {
        optional: true,
        sourceScope: 'triggerBase',
        playerContext: 'eventPlayer',
        canTrigger: ctx => ctx.baseIndex !== undefined
            && ctx.state.bases[ctx.baseIndex]?.defId === 'base_jungle_paradise'
            && ctx.triggerMinion?.controller === ctx.playerId,
    });

    for (const defId of ['mulan_chien_po', 'mulan_ling', 'mulan_yao']) {
        registerTrigger(defId, 'onMinionAffected', ctx => drawOnPowerCounterHere(ctx, `${defId}_counter_draw_turn`), {
            optional: false,
            perInstance: true,
            sourceScope: 'triggerBase',
            playerContext: 'sourceController',
            canTrigger: ctx => ctx.affectType === 'power_change' && ctx.counterChangeKind === 'added',
        });
    }

    registerTrigger('mulan_mulan', 'onMinionAffected', markMulanPowerCounterThisTurn, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    registerExtendedBase('base_sfit_robotics_lab', 'onMinionAffected', (ctx) => ({
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random ?? DETERMINISTIC_RANDOM, ctx.now),
    }));
    registerExtendedBase('base_training_camp', 'onMinionAffected', (ctx) => {
        if (ctx.reason === 'base_training_camp_used') return { events: [] };
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const usedKey = `base_training_camp_${ctx.playerId}_turn`;
        if (base.metadata?.[usedKey] === ctx.state.turnNumber) return { events: [] };
        return {
            events: [
                ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random ?? DETERMINISTIC_RANDOM, ctx.now),
                {
                    type: SU_EVENTS.BASE_METADATA_UPDATED,
                    payload: { baseIndex: ctx.baseIndex, metadataUpdate: { [usedKey]: ctx.state.turnNumber }, reason: 'base_training_camp_used' },
                    timestamp: ctx.now,
                } as SmashUpEvent,
            ],
        };
    }, {
        canTrigger: ctx => ctx.reason !== 'base_training_camp_used',
    });

    registerTrigger('base_arendelle', 'onMinionPlayed', arendelleAfterMinionPlayed, {
        optional: true,
        mandatory: false,
        sourceScope: 'triggerBase',
        playerContext: 'eventPlayer',
        canTrigger: ctx => ctx.baseIndex !== undefined
            && ctx.state.bases[ctx.baseIndex]?.defId === 'base_arendelle'
            && ctx.triggerMinion !== undefined
            && (ctx.state.players[ctx.triggerMinion.controller]?.deck.length ?? 0) > 0,
    });

    registerCustomPowerModifiers([
        {
            sourceDefId: 'frozen_marshmallow',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => {
                const hasElsa = ctx.base.minions.some(minion =>
                    helpers.matchesRuntimeDefId(minion.defId, 'frozen_elsa')
                    && minion.controller === ctx.minion.controller,
                );
                return hasElsa && helpers.matchesRuntimeDefId(ctx.minion.defId, 'frozen_marshmallow') ? 2 : 0;
            },
        },
        {
            sourceDefId: 'frozen_kristoff',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'frozen_kristoff')) return 0;
                return ctx.base.minions.some(minion =>
                    minion.controller === ctx.minion.controller
                    && (helpers.matchesRuntimeDefId(minion.defId, 'frozen_anna') || helpers.matchesRuntimeDefId(minion.defId, 'frozen_elsa')),
                ) ? 2 : 0;
            },
        },
        {
            sourceDefId: 'big_hero_6_yokai',
            runtimeIdentity: 'actionFamily',
            compute: (ctx) => ctx.base.ongoingActions.some(action => action.defId === 'big_hero_6_yokai') && (ctx.minion.powerCounters ?? 0) <= 0 ? -1 : 0,
        },
        {
            sourceDefId: 'mulan_family_sword',
            runtimeIdentity: 'actionFamily',
            compute: (ctx) => ctx.minion.attachedActions.some(action => action.defId === 'mulan_family_sword') ? 3 : 0,
        },
        {
            sourceDefId: 'base_krei_tech',
            runtimeIdentity: 'synthetic',
            compute: (ctx) => ctx.base.defId === 'base_krei_tech' && (ctx.minion.powerCounters ?? 0) > 0 ? 1 : 0,
        },
    ]);

    registerCustomBasePowerModifiers([
        {
            defId: 'lion_king_he_lives_in_you',
            variantPolicy: 'baseOnly',
            compute: (ctx) => ctx.ongoing && getActionController(ctx.ongoing) === ctx.playerId
                ? (hasMufasaInDiscard(ctx.state, ctx.playerId) ? 2 : 1)
                : 0,
        },
        {
            defId: 'lion_king_hyenas_den',
            variantPolicy: 'baseOnly',
            compute: (ctx) => ctx.ongoing && getActionController(ctx.ongoing) === ctx.playerId && hasMufasaInDiscard(ctx.state, ctx.playerId) ? 2 : 0,
        },
        {
            defId: 'base_pride_rock',
            variantPolicy: 'baseOnly',
            compute: (ctx) => ctx.base.defId === 'base_pride_rock' && hasMufasaInDiscard(ctx.state, ctx.playerId) ? 2 : 0,
        },
    ]);
}
