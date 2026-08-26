import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedControlChangeEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    createSkipOption,
    findMinionByAttachedCard,
    findMinionOnBases,
    grantContextualExtraAction,
    inspectDeck,
    revealDeckTop,
    shuffleHandIntoDeck,
} from '../domain/abilityHelpers';
import {
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { getSmashUpReactionWindowContext } from '../domain/reactionWindowState';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { registerCustomBreakpointModifiers, registerPowerModifier } from '../domain/ongoingModifiers';
import { buildSemanticOngoingAttachEvents } from '../domain/abilityHelpers';
import type {
    BaseMetadataUpdatedEvent,
    CardInstance,
    CardToDeckBottomEvent,
    CardToDeckTopEvent,
    CardTransferredEvent,
    CardsDrawnEvent,
    DeckReorderedEvent,
    HandShuffledIntoDeckEvent,
    MinionOnBase,
    MinionPlayedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
function getVariantScopedDefId(sourceDefId: string | undefined, baseDefId: string): string {
    return sourceDefId?.endsWith('_pod') ? `${baseDefId}_pod` : baseDefId;
}

type CardZone = 'hand' | 'deck' | 'discard';
type CardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    zone?: CardZone;
    mode?: 'toHand' | 'play' | 'draw' | 'deckTop';
    baseIndex?: number;
    placement?: 'top' | 'bottom';
    targetPlayerId?: PlayerId;
    skip?: boolean;
};
type MinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    defId?: string;
    ownerId?: PlayerId;
    controllerId?: PlayerId;
    baseIndex?: number;
    targetPlayerId?: PlayerId;
    skip?: boolean;
};
type BaseChoice = { baseIndex?: number; skip?: boolean };

type TransformContext = {
    sourceDefId: string;
    sourceCardUid?: string;
    sourceBaseIndex?: number;
    playFromPlayerId?: PlayerId;
};

type TransformResult = {
    events: SmashUpEvent[];
    playedMinionUid?: string;
    targetBaseIndex: number;
};

type SearchContext = {
    sourceDefId: string;
    sourceCardUid?: string;
    sourceBaseIndex?: number;
    searchDefId: string;
    playBaseIndices?: number[];
};

type RussianPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type FoolishMagicianContext = RussianPromptContext & {
    random: RandomFn;
};

type SearchPromptRuntimeContext = RussianPromptContext & {
    title: string;
    searchContext: SearchContext;
};

type SearchPromptAfterEventsContext = SearchPromptRuntimeContext & {
    leadingEvents: SmashUpEvent[];
};

type FrogPrincessAttachContext = RussianPromptContext & {
    sourceCardUid: string;
    sourceBaseIndex: number;
    attachOwnerId: PlayerId;
    targetBaseIndex: number;
    targetMinionUid: string;
};

type FrogPrincessAttachAfterEventsContext = FrogPrincessAttachContext & {
    leadingEvents: SmashUpEvent[];
};

type FetchContext = {
    revealedUids: string[];
    actionUids: string[];
};

type FinistContext = {
    sourceCardUid: string;
    sourceBaseIndex: number;
};

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseLabel(core: SmashUpCore, baseIndex: number): string {
    const defId = core.bases[baseIndex]?.defId;
    return getBaseDef(defId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function isMinionCard(card: CardInstance): boolean {
    return getMinionLikePower(card.defId) !== undefined;
}

function isActionCard(card: CardInstance): boolean {
    return getCardDef(card.defId)?.type === 'action';
}

function getTurnOrderPlayers(core: SmashUpCore): PlayerId[] {
    return (core.turnOrder.length ? core.turnOrder : Object.keys(core.players)) as PlayerId[];
}

function getPlayerLabel(core: SmashUpCore, playerId: PlayerId): string {
    return core.players[playerId]?.name ?? `玩家 ${playerId}`;
}

function runtimeToAbilityResult(result: {
    events: SmashUpEvent[];
    matchState?: MatchState<SmashUpCore>;
}): AbilityResult {
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function cardToDeckTop(
    card: CardInstance,
    ownerId: PlayerId,
    reason: string,
    now: number,
    sourcePlayerId: PlayerId,
    source?: { sourceCardUid?: string; sourceControllerId?: PlayerId; sourceBaseIndex?: number },
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId,
            reason,
            sourcePlayerId,
            sourceDefId: reason,
            ...(source?.sourceCardUid ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceControllerId ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
        },
        timestamp: now,
    };
}

function cardTransferredToSelf(card: CardInstance, playerId: PlayerId, reason: string, now: number): CardTransferredEvent {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            fromPlayerId: playerId,
            toPlayerId: playerId,
            ownerId: card.owner,
            reason,
        },
        timestamp: now,
    };
}

function deckReordered(
    playerId: PlayerId,
    deckCards: CardInstance[],
    random: RandomFn,
    reason: string,
    now: number,
    options?: { shuffle?: boolean },
): DeckReorderedEvent {
    const orderedCards = options?.shuffle === false ? deckCards : random.shuffle(deckCards);
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids: orderedCards.map(card => card.uid) },
        timestamp: now,
    };
}

function baseMetadataUpdated(
    core: SmashUpCore,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): BaseMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.BASE_METADATA_UPDATED,
        payload: {
            baseIndex,
            baseInstanceId: core.bases[baseIndex]?.instanceId,
            metadataUpdate,
            reason,
        },
        timestamp: now,
    };
}

function buildCardsDrawn(playerId: PlayerId, cardUids: string[], now: number): CardsDrawnEvent {
    return {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId, count: cardUids.length, cardUids },
        timestamp: now,
    };
}

function playMinionFromZoneEvent(
    core: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    reason: string,
    now: number,
    zone: CardZone,
): MinionPlayedEvent {
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            baseIndex,
            baseDefId: core.bases[baseIndex]?.defId,
            power: getMinionLikePower(card.defId) ?? 0,
            consumesNormalLimit: false,
            discardPlaySourceId: reason,
            ...(zone === 'deck' ? { fromDeck: true } : {}),
            ...(zone === 'discard' ? { fromDiscard: true } : {}),
        },
        timestamp: now,
    };
}

function findPlayerZoneCard(core: SmashUpCore, playerId: PlayerId, selected: CardChoice | undefined): CardInstance | undefined {
    if (!selected?.cardUid || !selected.defId || !selected.zone) return undefined;
    const player = core.players[playerId];
    if (!player) return undefined;
    const zoneCards = selected.zone === 'hand'
        ? player.hand
        : selected.zone === 'deck'
            ? player.deck
            : player.discard;
    return zoneCards.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
}

function collectAllMinions(core: SmashUpCore): Array<MinionChoice & { uid: string; defId: string; label: string }> {
    return core.bases.flatMap((base, baseIndex) => base.minions.map(minion => ({
        uid: minion.uid,
        minionUid: minion.uid,
        defId: minion.defId,
        minionDefId: minion.defId,
        ownerId: minion.owner,
        controllerId: minion.controller,
        baseIndex,
        label: `${cardLabel(minion.defId)} @ ${baseLabel(core, baseIndex)}`,
    })));
}

function findMinionChoice(core: SmashUpCore, choice: MinionChoice | undefined): { minion: MinionOnBase; baseIndex: number } | undefined {
    if (!choice?.minionUid || choice.baseIndex === undefined) return undefined;
    const minion = core.bases[choice.baseIndex]?.minions.find(candidate =>
        candidate.uid === choice.minionUid
        && candidate.defId === (choice.minionDefId ?? choice.defId));
    return minion ? { minion, baseIndex: choice.baseIndex } : undefined;
}

function hasBottomDeckEvent(events: SmashUpEvent[], cardUid: string): boolean {
    return events.some(event =>
        event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM
        && (event as CardToDeckBottomEvent).payload.cardUid === cardUid);
}

function buildPlayMinionOffTopEvents(params: {
    core: SmashUpCore;
    playFromPlayerId: PlayerId;
    baseIndex: number;
    reason: string;
    now: number;
    random: RandomFn;
    sourcePlayerId: PlayerId;
    bottomedCardForPlayDeck?: CardInstance;
}): { events: SmashUpEvent[]; playedMinionUid?: string } {
    const player = params.core.players[params.playFromPlayerId];
    const base = params.core.bases[params.baseIndex];
    if (!player || !base) return { events: [] };
    const virtualDeck = [
        ...player.deck,
        ...(params.bottomedCardForPlayDeck ? [params.bottomedCardForPlayDeck] : []),
    ];
    if (virtualDeck.length === 0) return { events: [] };
    const minionIndex = virtualDeck.findIndex(isMinionCard);
    const revealedCards = minionIndex >= 0 ? virtualDeck.slice(0, minionIndex + 1) : virtualDeck;
    const events: SmashUpEvent[] = [
        revealDeckTop(
            params.playFromPlayerId,
            'all',
            revealedCards.map(card => ({ uid: card.uid, defId: card.defId })),
            revealedCards.length,
            params.reason,
            params.now,
            params.sourcePlayerId,
        ),
    ];
    if (minionIndex < 0) {
        events.push(deckReordered(params.playFromPlayerId, virtualDeck, params.random, params.reason, params.now, { shuffle: false }));
        return { events };
    }
    const played = virtualDeck[minionIndex];
    const remaining = virtualDeck.filter((_card, index) => index !== minionIndex);
    events.push(playMinionFromZoneEvent(
        params.core,
        params.playFromPlayerId,
        played,
        params.baseIndex,
        params.reason,
        params.now,
        'deck',
    ));
    events.push(deckReordered(params.playFromPlayerId, remaining, params.random, params.reason, params.now, { shuffle: false }));
    return { events, playedMinionUid: played.uid };
}

function buildTransformMinionResult(
    state: MatchState<SmashUpCore>,
    selected: { minion: MinionOnBase; baseIndex: number },
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    context: TransformContext,
): TransformResult {
    const sourceDefId = context.sourceDefId;
    const playFromPlayerId = context.playFromPlayerId ?? selected.minion.owner;
    const minionCard: CardInstance = {
        uid: selected.minion.uid,
        defId: selected.minion.defId,
        type: 'minion',
        owner: selected.minion.owner,
    };
    const bottomEvents = buildValidatedCardToDeckBottomEvents(state, {
        cardUid: selected.minion.uid,
        defId: selected.minion.defId,
        ownerId: selected.minion.owner,
        expectedLocation: 'bases',
        sourcePlayerId: playerId,
        sourceCardUid: context.sourceCardUid,
        sourceDefId,
        sourceControllerId: playerId,
        sourceBaseIndex: context.sourceBaseIndex ?? selected.baseIndex,
        reason: sourceDefId,
        now,
    });
    if (!hasBottomDeckEvent(bottomEvents, selected.minion.uid)) {
        return { events: bottomEvents, targetBaseIndex: selected.baseIndex };
    }

    const replacement = buildPlayMinionOffTopEvents({
        core: state.core,
        playFromPlayerId,
        baseIndex: selected.baseIndex,
        reason: sourceDefId,
        now,
        random,
        sourcePlayerId: playerId,
        bottomedCardForPlayDeck: playFromPlayerId === selected.minion.owner ? minionCard : undefined,
    });

    return {
        events: [...bottomEvents, ...replacement.events],
        playedMinionUid: replacement.playedMinionUid,
        targetBaseIndex: selected.baseIndex,
    };
}

function buildTransformMinionEvents(
    state: MatchState<SmashUpCore>,
    selected: { minion: MinionOnBase; baseIndex: number },
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    context: TransformContext,
): SmashUpEvent[] {
    return buildTransformMinionResult(state, selected, playerId, random, now, context).events;
}

function buildShuffleMinionsIntoOwnersDeckEvents(
    state: MatchState<SmashUpCore>,
    targets: Array<{ minion: MinionOnBase; baseIndex: number }>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    sourceDefId: string,
    sourceCardUid?: string,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const movedByOwner = new Map<PlayerId, CardInstance[]>();
    for (const target of targets) {
        const bottomEvents = buildValidatedCardToDeckBottomEvents(state, {
            cardUid: target.minion.uid,
            defId: target.minion.defId,
            ownerId: target.minion.owner,
            expectedLocation: 'bases',
            sourcePlayerId: playerId,
            sourceCardUid,
            sourceDefId,
            sourceControllerId: playerId,
            sourceBaseIndex: target.baseIndex,
            reason: sourceDefId,
            now,
        });
        events.push(...bottomEvents);
        if (hasBottomDeckEvent(bottomEvents, target.minion.uid)) {
            movedByOwner.set(target.minion.owner, [
                ...(movedByOwner.get(target.minion.owner) ?? []),
                { uid: target.minion.uid, defId: target.minion.defId, type: 'minion', owner: target.minion.owner },
            ]);
        }
    }
    for (const [ownerId, movedCards] of movedByOwner) {
        const owner = state.core.players[ownerId];
        if (!owner) continue;
        events.push(deckReordered(ownerId, [...owner.deck, ...movedCards], random, sourceDefId, now));
    }
    return events;
}

function buildSearchCards(core: SmashUpCore, playerId: PlayerId, defId: string): Array<CardInstance & { zone: CardZone }> {
    const player = core.players[playerId];
    if (!player) return [];
    return [
        ...player.hand.map(card => ({ ...card, zone: 'hand' as const })),
        ...player.deck.map(card => ({ ...card, zone: 'deck' as const })),
        ...player.discard.map(card => ({ ...card, zone: 'discard' as const })),
    ].filter(card => card.defId === defId);
}

function queueSearchPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    title: string,
    context: SearchContext,
): AbilityResult {
    const cards = buildSearchCards(matchState.core, playerId, context.searchDefId);
    if (cards.length === 0) return { events: [] };
    const playBaseIndices = context.playBaseIndices ?? matchState.core.bases.map((_base, baseIndex) => baseIndex);
    const options = cards.flatMap((card, index) => {
        const zoneLabel = card.zone === 'hand' ? '手牌' : card.zone === 'deck' ? '牌库' : '弃牌堆';
        const toHand = card.zone === 'hand'
            ? []
            : [{
                id: `card-${index}-hand`,
                label: `${cardLabel(card.defId)}（${zoneLabel}）：加入手牌`,
                value: { cardUid: card.uid, defId: card.defId, zone: card.zone, mode: 'toHand' as const },
                displayMode: 'card' as const,
            }];
        const play = playBaseIndices.map(baseIndex => ({
            id: `card-${index}-play-${baseIndex}`,
            label: `${cardLabel(card.defId)}（${zoneLabel}）：额外打到${baseLabel(matchState.core, baseIndex)}`,
            value: { cardUid: card.uid, defId: card.defId, zone: card.zone, mode: 'play' as const, baseIndex },
            displayMode: 'card' as const,
        }));
        return [...toHand, ...play];
    });
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `${context.sourceDefId}_search_${now}`,
        playerId,
        title,
        options,
        {
            sourceId: 'russian_fairy_tales_search_card',
            targetType: 'card',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: SearchContext }).continuationContext = context;
    return {
        events: cards.some(card => card.zone === 'deck')
            ? [inspectDeck(playerId, playerId, matchState.core.players[playerId]?.deck.length ?? 0, context.sourceDefId, now)]
            : [],
        matchState: queueInteraction(matchState, interaction),
    };
}

const russianSearchPromptProgram = createEffectProgram<SearchPromptRuntimeContext, SmashUpCore, SmashUpEvent>(
    (context) => queueSearchPrompt(
        context.matchState,
        context.playerId,
        context.now,
        context.title,
        context.searchContext,
    ),
);

const russianSearchPromptAfterEventsProgram = createEffectProgram<SearchPromptAfterEventsContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const { leadingEvents: _leadingEvents, ...searchContext } = context;
        return {
            events: context.leadingEvents,
            context: searchContext,
            nextProgram: russianSearchPromptProgram,
        };
    },
);

const foolishMagicianPromptProgram = createPromptProgram<RussianPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'russian_fairy_tales_foolish_magician',
    buildInteraction: (context) => {
        const hand = context.matchState.core.players[context.playerId]?.hand ?? [];
        const count = Math.min(3, hand.length);
        return createSimpleChoice<CardChoice>(
            `russian_fairy_tales_foolish_magician_${context.now}`,
            context.playerId,
            '愚蠢的魔术师：选择三张手牌放到牌库顶和/或底',
            hand.flatMap((card, index) => [
                {
                    id: `top-${index}`,
                    label: `${cardLabel(card.defId)}：放到牌库顶`,
                    value: { cardUid: card.uid, defId: card.defId, zone: 'hand' as const, placement: 'top' as const },
                    displayMode: 'card' as const,
                },
                {
                    id: `bottom-${index}`,
                    label: `${cardLabel(card.defId)}：放到牌库底`,
                    value: { cardUid: card.uid, defId: card.defId, zone: 'hand' as const, placement: 'bottom' as const },
                    displayMode: 'card' as const,
                },
            ]),
            {
                sourceId: 'russian_fairy_tales_foolish_magician',
                targetType: 'hand',
                multi: { min: count, max: count },
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : [value]) as CardChoice[];
        const hand = state.core.players[playerId]?.hand ?? [];
        const requiredCount = Math.min(3, hand.length);
        const seen = new Set<string>();
        const top: CardInstance[] = [];
        const bottom: CardInstance[] = [];
        for (const choice of choices) {
            if (!choice?.cardUid || !choice.defId || (choice.placement !== 'top' && choice.placement !== 'bottom')) continue;
            if (seen.has(choice.cardUid)) {
                return { events: [] };
            }
            const card = hand.find(candidate => candidate.uid === choice.cardUid && candidate.defId === choice.defId);
            if (!card) continue;
            seen.add(card.uid);
            if (choice.placement === 'top') top.push(card);
            if (choice.placement === 'bottom') bottom.push(card);
        }
        if (seen.size !== requiredCount) return { events: [] };
        const events: SmashUpEvent[] = [];
        for (const card of [...top].reverse()) {
            events.push(cardToDeckTop(card, card.owner, 'russian_fairy_tales_foolish_magician', timestamp, playerId));
        }
        for (const card of bottom) {
            events.push(...buildValidatedCardToDeckBottomEvents(state, {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                expectedLocation: 'hand',
                sourcePlayerId: playerId,
                sourceDefId: 'russian_fairy_tales_foolish_magician',
                sourceControllerId: playerId,
                reason: 'russian_fairy_tales_foolish_magician',
                now: timestamp,
            }));
        }
        return { events };
    },
});

const foolishMagicianPromptAfterCommittedDrawProgram = createEffectProgram<FoolishMagicianContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const hand = context.matchState.core.players[context.playerId]?.hand ?? [];
        if (hand.length === 0) return { events: [] };
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: context.now,
            },
            nextProgram: foolishMagicianPromptProgram,
        };
    },
);

const foolishMagicianProgram = createEffectProgram<FoolishMagicianContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: buildStandardDrawEvents(
            context.matchState.core,
            context.playerId,
            3,
            context.random,
            context.now,
        ),
        context,
        nextProgram: foolishMagicianPromptAfterCommittedDrawProgram,
    }),
);

const frogPrincessAttachProgram = createEffectProgram<FrogPrincessAttachContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const target = context.matchState.core.bases[context.targetBaseIndex]?.minions.find(
            minion => minion.uid === context.targetMinionUid,
        );
        if (!target) return { events: [] };
        return {
            events: buildSemanticOngoingAttachEvents(context.matchState, {
                cardUid: context.sourceCardUid,
                defId: 'russian_fairy_tales_the_frog_princess',
                ownerId: context.attachOwnerId,
                ...(context.attachOwnerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                targetBaseIndex: context.targetBaseIndex,
                targetMinionUid: target.uid,
                talentUsed: true,
                removeFromDiscard: true,
                now: context.now,
            }),
        };
    },
);

const frogPrincessAttachAfterEventsProgram = createEffectProgram<FrogPrincessAttachAfterEventsContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const { leadingEvents: _leadingEvents, ...attachContext } = context;
        return {
            events: context.leadingEvents,
            context: attachContext,
            nextProgram: frogPrincessAttachProgram,
        };
    },
);

function transformation(ctx: AbilityContext): AbilityResult {
    const candidates = collectAllMinions(ctx.state);
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `russian_fairy_tales_transformation_${ctx.now}`,
        ctx.playerId,
        '变化：选择一个随从放到牌库底并变形',
        buildMinionTargetOptions(candidates, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            sourceKind: 'action',
            effectType: 'return',
            semanticRole: 'primary',
        }),
        {
            sourceId: 'russian_fairy_tales_transformation',
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: { sourceDefId: string } }).continuationContext = {
        sourceDefId: ctx.defId,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function babaYaga(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const candidates = base.minions
        .filter(minion => minion.uid !== ctx.cardUid)
        .map(minion => ({
            uid: minion.uid,
            minionUid: minion.uid,
            defId: minion.defId,
            minionDefId: minion.defId,
            ownerId: minion.owner,
            controllerId: minion.controller,
            baseIndex: ctx.baseIndex,
            label: cardLabel(minion.defId),
        }));
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `russian_fairy_tales_baba_yaga_${ctx.now}`,
        ctx.playerId,
        '芭芭雅嘎：选择这里另一个随从变形',
        buildMinionTargetOptions(candidates, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            sourceKind: 'nonAction',
            effectType: 'return',
            semanticRole: 'primary',
        }),
        {
            sourceId: 'russian_fairy_tales_baba_yaga',
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: { sourceDefId: string } }).continuationContext = {
        sourceDefId: ctx.defId,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function frogPrincessTalent(ctx: AbilityContext): AbilityResult {
    const host = findMinionByAttachedCard(ctx.state, ctx.cardUid);
    if (!host) return { events: [] };
    const attached = host.minion.attachedActions.find(action => action.uid === ctx.cardUid);
    const transform = buildTransformMinionResult(
        ctx.matchState,
        host,
        ctx.playerId,
        ctx.random,
        ctx.now,
        {
            sourceDefId: 'russian_fairy_tales_the_frog_princess',
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: host.baseIndex,
            playFromPlayerId: ctx.playerId,
        },
    );
    if (!attached || !transform.playedMinionUid) return { events: transform.events };
    return runtimeToAbilityResult(executeAbilityProgram(frogPrincessAttachAfterEventsProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: host.baseIndex,
        attachOwnerId: attached.ownerId,
        targetBaseIndex: transform.targetBaseIndex,
        targetMinionUid: transform.playedMinionUid,
        leadingEvents: transform.events,
    }));
}

function waterOfLife(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const minions = player.discard.filter(isMinionCard);
    if (minions.length === 0) {
        return { events: [grantContextualExtraAction(ctx, 'russian_fairy_tales_the_water_of_life')] };
    }
    const interaction = createSimpleChoice<CardChoice>(
        `russian_fairy_tales_the_water_of_life_${ctx.now}`,
        ctx.playerId,
        '生命之水：选择弃牌堆一个随从放到牌库顶',
        minions.map((card, index) => ({
            id: `discard-minion-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId, zone: 'discard', mode: 'deckTop' },
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'russian_fairy_tales_the_water_of_life',
            targetType: 'discard',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function fetchIKnowNotWhat(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.deck.length === 0) return { events: [] };
    const revealed: CardInstance[] = [];
    const actions: CardInstance[] = [];
    for (const card of player.deck) {
        revealed.push(card);
        if (isActionCard(card)) actions.push(card);
        if (actions.length >= 2) break;
    }
    const events: SmashUpEvent[] = [
        revealDeckTop(
            ctx.playerId,
            'all',
            revealed.map(card => ({ uid: card.uid, defId: card.defId })),
            revealed.length,
            'russian_fairy_tales_fetch_i_know_not_what',
            ctx.now,
            ctx.playerId,
        ),
    ];
    if (actions.length === 0) {
        events.push(deckReordered(ctx.playerId, player.deck, ctx.random, 'russian_fairy_tales_fetch_i_know_not_what', ctx.now));
        return { events };
    }
    const interaction = createSimpleChoice<CardChoice>(
        `russian_fairy_tales_fetch_i_know_not_what_${ctx.now}`,
        ctx.playerId,
        '我不知道要拿什么：选择要加入手牌的行动',
        [
            createSkipOption('不拿行动', 'ui.russian_fairy_tales_skip_take_action_option'),
            ...actions.map((card, index) => ({
                id: `action-${index}`,
                label: cardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId, zone: 'deck', mode: 'toHand' as const },
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: 'russian_fairy_tales_fetch_i_know_not_what',
            targetType: 'deck',
            multi: { min: 0, max: actions.length },
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: FetchContext }).continuationContext = {
        revealedUids: revealed.map(card => card.uid),
        actionUids: actions.map(card => card.uid),
    };
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function goIKnowNotWhither(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[targetBaseIndex];
    if (base) {
        return {
            events: buildRandomOtherPlayerShuffleEvents(ctx.matchState, ctx.playerId, targetBaseIndex, ctx.random, ctx.now),
        };
    }
    if (ctx.state.bases.length === 0) return { events: [] };
    const interaction = createSimpleChoice<BaseChoice>(
        `russian_fairy_tales_go_i_know_not_whither_${ctx.now}`,
        ctx.playerId,
        '我不知道去何处：选择一个基地',
        buildBaseTargetOptions(ctx.state.bases.map((_base, baseIndex) => ({ baseIndex, label: baseLabel(ctx.state, baseIndex) })), ctx.state),
        {
            sourceId: 'russian_fairy_tales_go_i_know_not_whither',
            targetType: 'base',
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildRandomOtherPlayerShuffleEvents(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    baseIndex: number,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    const base = matchState.core.bases[baseIndex];
    if (!base) return [];
    const targets: Array<{ minion: MinionOnBase; baseIndex: number }> = [];
    for (const otherPlayerId of getTurnOrderPlayers(matchState.core).filter(id => id !== playerId)) {
        const candidates = base.minions.filter(minion => minion.controller === otherPlayerId);
        if (candidates.length === 0) continue;
        targets.push({ minion: candidates[random.range(0, candidates.length - 1)], baseIndex });
    }
    return buildShuffleMinionsIntoOwnersDeckEvents(
        matchState,
        targets,
        playerId,
        random,
        now,
        'russian_fairy_tales_go_i_know_not_whither',
    );
}

function tsarEagle(ctx: AbilityContext): AbilityResult {
    const discardMinions = getTurnOrderPlayers(ctx.state)
        .filter(playerId => playerId !== ctx.playerId)
        .flatMap(playerId => (ctx.state.players[playerId]?.discard ?? [])
            .filter(isMinionCard)
            .map(card => ({ playerId, card })));
    const options = [
        {
            id: 'draw',
            label: '抽一张牌',
            value: { mode: 'draw' as const },
            displayMode: 'button' as const,
            labelKey: 'ui.russian_fairy_tales_tsar_eagle_draw_option',
        },
        ...discardMinions.map((entry, index) => ({
            id: `discard-${index}`,
            label: `${getPlayerLabel(ctx.state, entry.playerId)}弃牌堆：${cardLabel(entry.card.defId)}`,
            value: { cardUid: entry.card.uid, defId: entry.card.defId, zone: 'discard' as const, mode: 'deckTop' as const, targetPlayerId: entry.playerId },
            displayMode: 'card' as const,
        })),
    ];
    const interaction = createSimpleChoice<CardChoice>(
        `russian_fairy_tales_tsar_eagle_${ctx.now}`,
        ctx.playerId,
        '沙皇之鹰：选择抽牌或把对手弃牌堆随从放到牌库顶',
        options,
        {
            sourceId: 'russian_fairy_tales_tsar_eagle',
            targetType: 'generic',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function grayWolf(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minions = player?.hand.filter(isMinionCard) ?? [];
    if (!player || minions.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `russian_fairy_tales_the_gray_wolf_${ctx.now}`,
        ctx.playerId,
        '灰色之狼：选择一个手牌随从作为额外随从打到这里',
        minions.map((card, index) => ({
            id: `hand-minion-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId, zone: 'hand', mode: 'play', baseIndex: ctx.baseIndex },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'russian_fairy_tales_the_gray_wolf',
            targetType: 'hand',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: { sourceCardUid: string; sourceBaseIndex: number } }).continuationContext = {
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function foolishMagician(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(foolishMagicianProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        random: ctx.random,
        now: ctx.now,
    }));
}

function toad(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const options = getTurnOrderPlayers(ctx.state)
        .filter(playerId => playerId !== ctx.playerId)
        .flatMap(playerId => base.minions
            .filter(minion => minion.controller === playerId && minion.uid !== ctx.cardUid)
            .map(minion => ({
                id: `${playerId}-${minion.uid}`,
                label: `把蟾蜍交给${getPlayerLabel(ctx.state, playerId)}，洗入${cardLabel(minion.defId)}`,
                value: {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    ownerId: minion.owner,
                    controllerId: minion.controller,
                    baseIndex: ctx.baseIndex,
                    targetPlayerId: playerId,
                },
                displayMode: 'card' as const,
            })));
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `russian_fairy_tales_toad_${ctx.now}`,
        ctx.playerId,
        '蟾蜍：选择另一名玩家及其这里另一个随从',
        [createSkipOption('不交出蟾蜍', 'ui.russian_fairy_tales_skip_give_toad_option'), ...options],
        {
            sourceId: 'russian_fairy_tales_toad',
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: { sourceCardUid: string; sourceBaseIndex: number } }).continuationContext = {
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function massTransformation(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const playerId of getTurnOrderPlayers(ctx.state)) {
        const player = ctx.state.players[playerId];
        if (!player || player.hand.length === 0) continue;
        const newDeck = ctx.random.shuffle([...player.deck, ...player.hand]);
        events.push(shuffleHandIntoDeck(
            playerId,
            newDeck.map(card => card.uid),
            'russian_fairy_tales_mass_transformation',
            ctx.now,
        ) as HandShuffledIntoDeckEvent);
        events.push(buildCardsDrawn(
            playerId,
            newDeck.slice(0, player.hand.length).map(card => card.uid),
            ctx.now,
        ));
    }
    return { events };
}

function transformationSpring(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.matchState || !ctx.minionUid || !ctx.minionDefId) return { events: [] };
    const selected = findMinionOnBases(ctx.state, ctx.minionUid);
    if (!selected || selected.baseIndex !== ctx.baseIndex) return { events: [] };
    const usedKey = `transformationSpringUsedTurn_${ctx.playerId}`;
    if (ctx.state.bases[ctx.baseIndex]?.metadata?.[usedKey] === ctx.state.turnNumber) return { events: [] };
    return {
        events: [
            ...buildTransformMinionEvents(
                ctx.matchState,
                selected,
                ctx.playerId,
                ctx.random ?? { random: () => Math.random(), d: () => 1, range: (min: number) => min, shuffle: <T>(items: T[]) => [...items] },
                ctx.now,
                {
                    sourceDefId: 'base_transformation_spring',
                    sourceBaseIndex: ctx.baseIndex,
                    playFromPlayerId: ctx.playerId,
                },
            ),
            baseMetadataUpdated(ctx.state, ctx.baseIndex, { [usedKey]: ctx.state.turnNumber }, 'base_transformation_spring', ctx.now),
        ],
    };
}

function goSeeMySister(ctx: TriggerContext): AbilityResult {
    if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined) return { events: [] };
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now),
    };
}

function canGoSeeMySisterTrigger(ctx: TriggerContext): boolean {
    if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined) return false;
    if (ctx.triggerMinion?.controller !== ctx.sourceControllerId) return false;
    if (ctx.timing === 'onMinionPlayed') return ctx.baseIndex === ctx.sourceBaseIndex;
    if (ctx.timing === 'onMinionMoved') return ctx.moveToBaseIndex === ctx.sourceBaseIndex;
    return false;
}

function birchWomanTrigger(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceControllerId) return { events: [] };
    const sourceDefId = ctx.sourceDefId ?? 'russian_fairy_tales_the_birch_woman';
    return queueSearchPrompt(
        ctx.matchState,
        ctx.sourceControllerId,
        ctx.now,
        '白桦木女神：寻找白桦木加入手牌或额外打出',
        {
            sourceDefId,
            sourceCardUid: ctx.sourceCardUid,
            sourceBaseIndex: ctx.baseIndex,
            searchDefId: getVariantScopedDefId(sourceDefId, 'russian_fairy_tales_the_birch'),
        },
    );
}

function canBirchWomanTrigger(ctx: TriggerContext): boolean {
    const searchDefId = getVariantScopedDefId(ctx.sourceDefId, 'russian_fairy_tales_the_birch');
    return Boolean(
        ctx.sourceControllerId
        && ctx.triggerMinionUid === ctx.sourceCardUid
        && buildSearchCards(ctx.state, ctx.sourceControllerId, searchDefId).length > 0,
    );
}

function theBirchTurnStart(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceControllerId || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return { events: [] };
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source || ctx.playerId !== ctx.sourceControllerId) return { events: [] };
    const sourceDefId = source.defId;
    const destroyEvents = buildValidatedDestroyEvents(ctx.matchState, {
        minionUid: source.uid,
        minionDefId: source.defId,
        fromBaseIndex: ctx.sourceBaseIndex,
        destroyerId: ctx.sourceControllerId,
        reason: sourceDefId,
        now: ctx.now,
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: source.uid,
        sourceDefId,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
        sourceKind: 'nonAction',
    });
    return runtimeToAbilityResult(executeAbilityProgram(russianSearchPromptAfterEventsProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        title: '白桦木：寻找白桦木女神加入手牌或打到这里',
        leadingEvents: destroyEvents,
        searchContext: {
            sourceDefId,
            sourceCardUid: source.uid,
            sourceBaseIndex: ctx.sourceBaseIndex,
            searchDefId: getVariantScopedDefId(sourceDefId, 'russian_fairy_tales_the_birch_woman'),
            playBaseIndices: [ctx.sourceBaseIndex],
        },
    }));
}

function canTheBirchTurnStart(ctx: TriggerContext): boolean {
    const searchDefId = getVariantScopedDefId(ctx.sourceDefId, 'russian_fairy_tales_the_birch_woman');
    return Boolean(
        ctx.sourceControllerId
        && ctx.playerId === ctx.sourceControllerId
        && buildSearchCards(ctx.state, ctx.sourceControllerId, searchDefId).length > 0,
    );
}

function isDestroyPipelineDiscardTrigger(ctx: TriggerContext): boolean {
    return typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('minion-discarded-from-base:');
}

function bewitchedTransferOnLeave(ctx: TriggerContext): AbilityResult {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) {
        return { events: [] };
    }
    if (!ctx.matchState || !ctx.sourceCardUid || !ctx.sourceControllerId || !ctx.triggerMinionUid) return { events: [] };
    const ownerId = findOngoingOwner(ctx.state, ctx.sourceCardUid)
        ?? ctx.triggerMinion?.attachedActions.find(action => action.uid === ctx.sourceCardUid)?.ownerId
        ?? ctx.sourceControllerId;
    const sourceDefId = ctx.sourceDefId ?? 'russian_fairy_tales_bewitched';
    const options = collectAllMinions(ctx.state).filter(minion => minion.minionUid !== ctx.triggerMinionUid);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `russian_fairy_tales_bewitched_transfer_${ctx.now}_${ctx.sourceCardUid}`,
        ctx.sourceControllerId,
        '着魔：宿主离场，选择另一个随从转移附着',
        buildMinionTargetOptions(options, {
            state: ctx.state,
            sourcePlayerId: ctx.sourceControllerId,
            sourceDefId,
            effectType: 'affect',
            semanticRole: 'primary',
        }),
        {
            sourceId: 'russian_fairy_tales_bewitched_transfer',
            targetType: 'minion',
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: { sourceCardUid: string; sourceDefId: string; ownerId: PlayerId; triggerMinionUid: string } }).continuationContext = {
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId,
        ownerId,
        triggerMinionUid: ctx.triggerMinionUid,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function canTriggerBewitchedTransferOnLeave(ctx: TriggerContext): boolean {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return false;
    if (!ctx.matchState || !ctx.sourceCardUid || !ctx.sourceControllerId || !ctx.triggerMinionUid) return false;
    return collectAllMinions(ctx.state).some(minion => minion.minionUid !== ctx.triggerMinionUid);
}

function findOngoingOwner(core: SmashUpCore, cardUid: string): PlayerId | undefined {
    for (const base of core.bases) {
        const baseOngoing = base.ongoingActions.find(action => action.uid === cardUid);
        if (baseOngoing) return baseOngoing.ownerId;
        for (const minion of base.minions) {
            const attached = minion.attachedActions.find(action => action.uid === cardUid);
            if (attached) return attached.ownerId;
        }
    }
    for (const player of Object.values(core.players)) {
        const card = [...player.hand, ...player.deck, ...player.discard].find(candidate => candidate.uid === cardUid);
        if (card) return card.owner;
    }
    return undefined;
}

function getScoringBaseIndex(matchState: MatchState<SmashUpCore>, fallbackBaseIndex: number): number {
    const reactionWindow = getSmashUpReactionWindowContext(matchState);
    if (typeof reactionWindow?.sourceBaseIndex === 'number') return reactionWindow.sourceBaseIndex;
    const eligible = matchState.core.scoringEligibleBaseIndices;
    if (Array.isArray(eligible) && eligible.length > 0) return eligible[0];
    return fallbackBaseIndex;
}

function finistSpecial(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const scoringBaseIndex = getScoringBaseIndex(ctx.matchState, ctx.baseIndex);
    if (source.baseIndex !== scoringBaseIndex) {
        return {
            events: buildValidatedMoveEvents(ctx.matchState, {
                minionUid: source.minion.uid,
                minionDefId: source.minion.defId,
                fromBaseIndex: source.baseIndex,
                toBaseIndex: scoringBaseIndex,
                reason: 'russian_fairy_tales_finist_the_falcon',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: source.minion.uid,
                sourceDefId: 'russian_fairy_tales_finist_the_falcon',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: source.baseIndex,
                sourceKind: 'nonAction',
            }),
        };
    }
    const destinations = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(ctx.state, baseIndex) }))
        .filter(base => base.baseIndex !== source.baseIndex);
    if (destinations.length === 0) return { events: [] };
    const interaction = createSimpleChoice<BaseChoice>(
        `russian_fairy_tales_finist_the_falcon_${ctx.now}`,
        ctx.playerId,
        '芬尼斯特猎鹰：选择返回手牌后额外打出的基地',
        buildBaseTargetOptions(destinations, ctx.state),
        {
            sourceId: 'russian_fairy_tales_finist_the_falcon',
            targetType: 'base',
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: FinistContext }).continuationContext = {
        sourceCardUid: source.minion.uid,
        sourceBaseIndex: source.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

export function registerRussianFairyTalesAbilities(): void {
    registerPowerModifier('russian_fairy_tales_bewitched', (ctx) => {
        const runtimeDefId = ctx.modifierSourceDefId ?? 'russian_fairy_tales_bewitched';
        return ctx.minion.attachedActions.filter(action => action.defId === runtimeDefId).length * 2;
    });
    registerCustomBreakpointModifiers([{
        sourceDefId: 'base_giant_turnip',
        runtimeIdentity: 'synthetic',
        compute: (ctx) => ctx.base.defId === 'base_giant_turnip' ? -ctx.base.minions.length : 0,
    }]);

    registerSimpleAbility('russian_fairy_tales_transformation', 'onPlay', transformation);
    registerSimpleAbility('russian_fairy_tales_baba_yaga', 'talent', babaYaga);
    registerSimpleAbility('russian_fairy_tales_the_frog_princess', 'talent', frogPrincessTalent);
    registerSimpleAbility('russian_fairy_tales_the_water_of_life', 'onPlay', waterOfLife);
    registerSimpleAbility('russian_fairy_tales_fetch_i_know_not_what', 'onPlay', fetchIKnowNotWhat);
    registerSimpleAbility('russian_fairy_tales_go_i_know_not_whither', 'onPlay', goIKnowNotWhither);
    registerSimpleAbility('russian_fairy_tales_tsar_eagle', 'onPlay', tsarEagle);
    registerSimpleAbility('russian_fairy_tales_the_gray_wolf', 'talent', grayWolf);
    registerSimpleAbility('russian_fairy_tales_foolish_magician', 'onPlay', foolishMagician);
    registerSimpleAbility('russian_fairy_tales_toad', 'onPlay', toad);
    registerSimpleAbility('russian_fairy_tales_mass_transformation', 'onPlay', massTransformation);
    registerSimpleAbility('russian_fairy_tales_finist_the_falcon', 'special', finistSpecial);
    registerSimpleAbility('russian_fairy_tales_bewitched', 'onPlay', () => ({ events: [] }));

    registerBaseAbility('base_transformation_spring', 'onMinionPlayed', transformationSpring, {
        mandatory: false,
        canTrigger: ctx => {
            const usedKey = `transformationSpringUsedTurn_${ctx.playerId}`;
            return Boolean(
                ctx.matchState
                && ctx.minionUid
                && ctx.state.bases[ctx.baseIndex]?.metadata?.[usedKey] !== ctx.state.turnNumber,
            );
        },
    });

    for (const timing of ['onMinionPlayed', 'onMinionMoved'] as const) {
        registerTrigger('russian_fairy_tales_go_see_my_sister', timing, goSeeMySister, {
            optional: true,
            perInstance: true,
            playerContext: 'sourceController',
            baseScoped: false,
            canTrigger: canGoSeeMySisterTrigger,
        });
    }
    registerTrigger('russian_fairy_tales_the_birch_woman', 'onMinionDiscardedFromBase', birchWomanTrigger, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: canBirchWomanTrigger,
    });
    registerTrigger('russian_fairy_tales_the_birch', 'onTurnStart', theBirchTurnStart, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: canTheBirchTurnStart,
    });
    for (const timing of ['onMinionDestroyed', 'onMinionDiscardedFromBase', 'onCardReturnedToHand'] as const) {
        registerTrigger('russian_fairy_tales_bewitched', timing, bewitchedTransferOnLeave, {
            perInstance: true,
            playerContext: 'sourceController',
            baseScoped: false,
            canTrigger: canTriggerBewitchedTransferOnLeave,
        });
    }
}

export function registerRussianFairyTalesInteractionHandlers(): void {
    const transformHandler = (
        state: MatchState<SmashUpCore>,
        playerId: PlayerId,
        value: unknown,
        data: Record<string, unknown> | undefined,
        random: RandomFn,
        timestamp: number,
    ) => {
        const selected = findMinionChoice(state.core, value as MinionChoice | undefined);
        if (!selected) return { state, events: [] };
        const context = (data as { continuationContext?: TransformContext } | undefined)?.continuationContext;
        return {
            state,
            events: buildTransformMinionEvents(
                state,
                selected,
                playerId,
                random,
                timestamp,
                context ?? { sourceDefId: 'russian_fairy_tales_transformation' },
            ),
        };
    };
    registerInteractionHandler('russian_fairy_tales_transformation', transformHandler);
    registerInteractionHandler('russian_fairy_tales_baba_yaga', (state, playerId, value, data, random, timestamp) => {
        const sourceDefId = (data as { continuationContext?: { sourceDefId?: string } } | undefined)?.continuationContext?.sourceDefId
            ?? 'russian_fairy_tales_baba_yaga';
        return transformHandler(state, playerId, value, { ...(data ?? {}), continuationContext: { sourceDefId } }, random, timestamp);
    });

    registerInteractionHandler('russian_fairy_tales_the_water_of_life', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const card = findPlayerZoneCard(state.core, playerId, selected ? { ...selected, zone: 'discard' } : undefined);
        if (!card || !isMinionCard(card)) return { state, events: [grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'russian_fairy_tales_the_water_of_life')] };
        return {
            state,
            events: [
                cardToDeckTop(card, card.owner, 'russian_fairy_tales_the_water_of_life', timestamp, playerId),
                grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'russian_fairy_tales_the_water_of_life'),
            ],
        };
    });

    registerInteractionHandler('russian_fairy_tales_fetch_i_know_not_what', (state, playerId, value, data, random, timestamp) => {
        const choices = (Array.isArray(value) ? value : [value]) as CardChoice[];
        const context = (data as { continuationContext?: FetchContext } | undefined)?.continuationContext;
        const allowedActionUids = new Set(context?.actionUids ?? []);
        const selectedUids = new Set(choices
            .filter(choice => !choice?.skip && choice?.cardUid && allowedActionUids.has(choice.cardUid))
            .map(choice => choice.cardUid!));
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        for (const card of player.deck.filter(card => selectedUids.has(card.uid))) {
            events.push(cardTransferredToSelf(card, playerId, 'russian_fairy_tales_fetch_i_know_not_what', timestamp));
        }
        const remaining = player.deck.filter(card => !selectedUids.has(card.uid));
        events.push(deckReordered(playerId, remaining, random, 'russian_fairy_tales_fetch_i_know_not_what', timestamp));
        return { state, events };
    });

    registerInteractionHandler('russian_fairy_tales_go_i_know_not_whither', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildRandomOtherPlayerShuffleEvents(state, playerId, selected.baseIndex, random, timestamp),
        };
    });

    registerInteractionHandler('russian_fairy_tales_tsar_eagle', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as CardChoice | undefined;
        if (selected?.mode === 'draw' || !selected?.mode) {
            return { state, events: buildStandardDrawEvents(state.core, playerId, 1, random, timestamp) };
        }
        const targetPlayerId = selected.targetPlayerId;
        if (!targetPlayerId) return { state, events: [] };
        const card = findPlayerZoneCard(state.core, targetPlayerId, { ...selected, zone: 'discard' });
        if (!card || !isMinionCard(card)) return { state, events: [] };
        return {
            state,
            events: [cardToDeckTop(card, card.owner, 'russian_fairy_tales_tsar_eagle', timestamp, playerId)],
        };
    });

    registerInteractionHandler('russian_fairy_tales_the_gray_wolf', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const context = (data as { continuationContext?: { sourceCardUid: string; sourceBaseIndex: number } } | undefined)?.continuationContext;
        if (!context || selected?.baseIndex === undefined) return { state, events: [] };
        const wolf = findMinionOnBases(state.core, context.sourceCardUid);
        const card = findPlayerZoneCard(state.core, playerId, selected ? { ...selected, zone: 'hand' } : undefined);
        if (!wolf || !card || !isMinionCard(card)) return { state, events: [] };
        return {
            state,
            events: [
                cardToDeckTop(
                    { uid: wolf.minion.uid, defId: wolf.minion.defId, type: 'minion', owner: wolf.minion.owner },
                    wolf.minion.owner,
                    'russian_fairy_tales_the_gray_wolf',
                    timestamp,
                    playerId,
                    { sourceCardUid: wolf.minion.uid, sourceControllerId: playerId, sourceBaseIndex: wolf.baseIndex },
                ),
                playMinionFromZoneEvent(state.core, playerId, card, selected.baseIndex, 'russian_fairy_tales_the_gray_wolf', timestamp, 'hand'),
                addPowerCounter(card.uid, selected.baseIndex, 1, 'russian_fairy_tales_the_gray_wolf', timestamp, {
                    sourcePlayerId: playerId,
                    sourceDefId: 'russian_fairy_tales_the_gray_wolf',
                    sourceCardUid: wolf.minion.uid,
                    sourceControllerId: playerId,
                    sourceBaseIndex: wolf.baseIndex,
                }),
            ],
        };
    });

    registerInteractionHandler('russian_fairy_tales_toad', (state, playerId, value, data, random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.targetPlayerId || selected.baseIndex === undefined) return { state, events: [] };
        const context = (data as { continuationContext?: { sourceCardUid: string; sourceBaseIndex: number } } | undefined)?.continuationContext;
        if (!context) return { state, events: [] };
        const toadSource = findMinionOnBases(state.core, context.sourceCardUid);
        const target = findMinionChoice(state.core, selected);
        if (!toadSource || !target || target.baseIndex !== toadSource.baseIndex || target.minion.controller !== selected.targetPlayerId) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                ...buildValidatedControlChangeEvents(state, {
                    minionUid: toadSource.minion.uid,
                    minionDefId: toadSource.minion.defId,
                    baseIndex: toadSource.baseIndex,
                    toControllerId: selected.targetPlayerId,
                    sourcePlayerId: playerId,
                    sourceCardUid: toadSource.minion.uid,
                    sourceDefId: 'russian_fairy_tales_toad',
                    sourceControllerId: playerId,
                    sourceBaseIndex: toadSource.baseIndex,
                    reason: 'russian_fairy_tales_toad',
                    now: timestamp,
                }),
                ...buildShuffleMinionsIntoOwnersDeckEvents(
                    state,
                    [target],
                    playerId,
                    random,
                    timestamp,
                    'russian_fairy_tales_toad',
                    toadSource.minion.uid,
                ),
            ],
        };
    });

    registerInteractionHandler('russian_fairy_tales_search_card', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const context = (data as { continuationContext?: SearchContext } | undefined)?.continuationContext;
        if (!context || selected?.skip || !selected?.mode) return { state, events: [] };
        const card = findPlayerZoneCard(state.core, playerId, selected);
        if (!card || card.defId !== context.searchDefId) return { state, events: [] };
        if (selected.mode === 'toHand') {
            return selected.zone === 'hand'
                ? { state, events: [] }
                : { state, events: [cardTransferredToSelf(card, playerId, context.sourceDefId, timestamp)] };
        }
        if (selected.mode === 'play' && selected.baseIndex !== undefined && isMinionCard(card)) {
            return {
                state,
                events: [playMinionFromZoneEvent(state.core, playerId, card, selected.baseIndex, context.sourceDefId, timestamp, selected.zone ?? 'hand')],
            };
        }
        return { state, events: [] };
    });

    registerInteractionHandler('russian_fairy_tales_bewitched_transfer', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        const context = (data as { continuationContext?: { sourceCardUid: string; sourceDefId: string; ownerId: PlayerId; triggerMinionUid: string } } | undefined)?.continuationContext;
        if (!context || !selected?.minionUid || selected.baseIndex === undefined || selected.minionUid === context.triggerMinionUid) {
            return { state, events: [] };
        }
        return {
            state,
            events: buildSemanticOngoingAttachEvents(state, {
                cardUid: context.sourceCardUid,
                defId: context.sourceDefId,
                ownerId: context.ownerId,
                ...(context.ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
                targetBaseIndex: selected.baseIndex,
                targetMinionUid: selected.minionUid,
                removeFromDiscard: true,
                now: timestamp,
            }),
        };
    });

    registerInteractionHandler('russian_fairy_tales_finist_the_falcon', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as BaseChoice | undefined;
        const context = (data as { continuationContext?: FinistContext } | undefined)?.continuationContext;
        if (!context || selected?.baseIndex === undefined || selected.baseIndex === context.sourceBaseIndex) {
            return { state, events: [] };
        }
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion => minion.uid === context.sourceCardUid);
        if (!source) return { state, events: [] };
        const returnEvents = buildValidatedReturnEvents(state, {
            minionUid: source.uid,
            minionDefId: source.defId,
            fromBaseIndex: context.sourceBaseIndex,
            toPlayerId: source.owner,
            reason: 'russian_fairy_tales_finist_the_falcon',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceCardUid: source.uid,
            sourceDefId: 'russian_fairy_tales_finist_the_falcon',
            sourceControllerId: playerId,
            sourceBaseIndex: context.sourceBaseIndex,
            sourceKind: 'nonAction',
        });
        if (returnEvents.length === 0) return { state, events: [] };
        return {
            state,
            events: [
                ...returnEvents,
                playMinionFromZoneEvent(
                    state.core,
                    playerId,
                    { uid: source.uid, defId: source.defId, type: 'minion', owner: source.owner },
                    selected.baseIndex,
                    'russian_fairy_tales_finist_the_falcon',
                    timestamp,
                    'hand',
                ),
            ],
        };
    });
}
