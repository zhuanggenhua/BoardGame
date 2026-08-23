import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { getBaseDef, getCardDef, getMinionDef } from '../data/cards';
import {
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    inspectDeck,
    recoverCardsFromDiscard,
    revealDeckTop,
} from '../domain/abilityHelpers';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import type {
    ActionCardDef,
    CardInstance,
    CardToDeckTopEvent,
    CardsDrawnEvent,
    DeckReorderedEvent,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

export type RuntimeAbilityResult = { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> };

export type LocatedMinion = {
    minion: MinionOnBase;
    baseIndex: number;
};

export function runtimeToAbilityResult(result: RuntimeAbilityResult): AbilityResult {
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

export function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

export function baseLabel(core: SmashUpCore, baseIndex: number): string {
    const defId = core.bases[baseIndex]?.defId;
    return getBaseDef(defId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

export function isActionCard(defId: string): boolean {
    return getCardDef(defId)?.type === 'action';
}

export function isMinionCard(defId: string): boolean {
    return getCardDef(defId)?.type === 'minion';
}

export function isStandardAction(defId: string): boolean {
    const def = getCardDef(defId) as ActionCardDef | undefined;
    return def?.type === 'action' && def.subtype === 'standard';
}

export function isCharacterModifier(defId: string): boolean {
    const def = getCardDef(defId) as ActionCardDef | undefined;
    return Boolean(def?.type === 'action' && def.subtype === 'ongoing' && def.ongoingTarget === 'minion');
}

export function isBaseModifier(defId: string): boolean {
    const def = getCardDef(defId) as ActionCardDef | undefined;
    return Boolean(def?.type === 'action' && def.subtype === 'ongoing' && (def.ongoingTarget === 'base' || def.playNeedsBase));
}

export function getActionControllerId(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId;
}

export function getAttachedActionControllerId(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return getActionControllerId(action);
}

export function findOwnMinion(ctx: AbilityContext): LocatedMinion | undefined {
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const minion = ctx.state.bases[baseIndex].minions.find(candidate =>
            candidate.uid === ctx.cardUid
            && candidate.controller === ctx.playerId);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

export function collectMinions(
    core: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): LocatedMinion[] {
    return core.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => predicate(minion, baseIndex))
            .map(minion => ({ minion, baseIndex })),
    );
}

export function ownMinionsAtBase(core: SmashUpCore, playerId: PlayerId, baseIndex: number): MinionOnBase[] {
    return core.bases[baseIndex]?.minions.filter(minion => minion.controller === playerId) ?? [];
}

export function firstOtherBaseIndex(core: SmashUpCore, baseIndex: number): number | undefined {
    return core.bases.findIndex((_base, index) => index !== baseIndex);
}

export function wasHandDiscard(ctx: { discardedFromZone?: 'hand' | 'deck' }): boolean {
    return ctx.discardedFromZone === 'hand';
}

export function drawSpecificDeckCard(
    ctx: AbilityContext,
    card: CardInstance,
    reason: string,
): SmashUpEvent[] {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return [];
    const remaining = player.deck.filter(candidate => candidate.uid !== card.uid);
    return [
        revealDeckTop(ctx.playerId, 'all', [{ uid: card.uid, defId: card.defId }], 1, reason, ctx.now, ctx.playerId),
        ...(remaining.length > 0
            ? [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ctx.playerId,
                    deckUids: ctx.random.shuffle(remaining).map(candidate => candidate.uid),
                },
                timestamp: ctx.now,
            } as DeckReorderedEvent]
            : []),
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [card.uid] },
            timestamp: ctx.now,
        } as CardsDrawnEvent,
    ];
}

export function searchDeckOrDiscardToHand(
    ctx: AbilityContext,
    defId: string,
    reason: string,
): { events: SmashUpEvent[]; card?: CardInstance } {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };

    const deckCard = player.deck.find(card => card.defId === defId);
    const discardCard = player.discard.find(card => card.defId === defId);
    const events: SmashUpEvent[] = [];

    if (player.deck.length > 0) {
        events.push(inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, reason, ctx.now));
    }

    if (deckCard) {
        events.push(...drawSpecificDeckCard(ctx, deckCard, reason));
        return { events, card: deckCard };
    }

    if (player.deck.length > 1) {
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId: ctx.playerId, deckUids: ctx.random.shuffle([...player.deck]).map(card => card.uid) },
            timestamp: ctx.now,
        } as DeckReorderedEvent);
    }

    if (discardCard) {
        events.push(recoverCardsFromDiscard(ctx.playerId, [discardCard.uid], reason, ctx.now));
        return { events, card: discardCard };
    }

    events.push(buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now));
    return { events };
}

export function placeDiscardCardOnDeckTop(
    ctx: AbilityContext,
    predicate: (card: CardInstance) => boolean,
    reason: string,
): CardToDeckTopEvent | undefined {
    const card = ctx.state.players[ctx.playerId]?.discard.find(predicate);
    if (!card) return undefined;
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            reason,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        },
        timestamp: ctx.now,
    };
}

export function cardToDeckTop(
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    reason: string,
    now: number,
    sourcePlayerId?: PlayerId,
    sourceCardUid?: string,
    sourceBaseIndex?: number,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid,
            defId,
            ownerId,
            reason,
            ...(sourcePlayerId ? { sourcePlayerId, sourceControllerId: sourcePlayerId } : {}),
            ...(sourceCardUid ? { sourceCardUid } : {}),
            sourceDefId: reason,
            ...(sourceBaseIndex !== undefined ? { sourceBaseIndex } : {}),
        },
        timestamp: now,
    };
}

export function revealTopAndDrawMatches(params: {
    state: SmashUpCore;
    random: RandomFn;
    playerId: PlayerId;
    count?: number;
    untilFirst?: boolean;
    predicate: (card: CardInstance) => boolean;
    maxPick?: number;
    reason: string;
    now: number;
}): { events: SmashUpEvent[]; picked: CardInstance[]; missed: CardInstance[] } {
    const player = params.state.players[params.playerId];
    if (!player) return { events: [], picked: [], missed: [] };

    let deckSim = [...player.deck];
    let discardSim = [...player.discard];
    const revealed: CardInstance[] = [];
    const picked: CardInstance[] = [];
    const missed: CardInstance[] = [];
    const maxPick = params.maxPick ?? Number.POSITIVE_INFINITY;

    while (
        (params.untilFirst ? picked.length === 0 : revealed.length < (params.count ?? 0))
        && picked.length < maxPick
    ) {
        if (deckSim.length === 0) {
            if (discardSim.length === 0) break;
            deckSim = params.random.shuffle([...discardSim]);
            discardSim = [];
        }
        const card = deckSim.shift();
        if (!card) break;
        revealed.push(card);
        if (params.predicate(card) && picked.length < maxPick) {
            picked.push(card);
        } else {
            missed.push(card);
        }
    }

    if (revealed.length === 0) {
        return { events: [buildAbilityFeedback(params.playerId, 'feedback.deck_empty', params.now)], picked, missed };
    }

    const shuffledRest = params.random.shuffle([...deckSim, ...missed, ...picked]);
    const events: SmashUpEvent[] = [
        inspectDeck(params.playerId, params.playerId, revealed.length, params.reason, params.now),
        revealDeckTop(
            params.playerId,
            'all',
            revealed.map(card => ({ uid: card.uid, defId: card.defId })),
            revealed.length,
            params.reason,
            params.now,
            params.playerId,
        ),
    ];

    if (shuffledRest.length > 0) {
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId: params.playerId, deckUids: shuffledRest.map(card => card.uid) },
            timestamp: params.now,
        } as DeckReorderedEvent);
    }

    if (picked.length > 0) {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: params.playerId, count: picked.length, cardUids: picked.map(card => card.uid) },
            timestamp: params.now,
        } as CardsDrawnEvent);
    } else {
        events.push(buildAbilityFeedback(params.playerId, 'feedback.no_valid_target', params.now));
    }

    return { events, picked, missed };
}

export function moveMinionToBase(
    state: MatchState<SmashUpCore> | SmashUpCore,
    minion: MinionOnBase,
    fromBaseIndex: number,
    toBaseIndex: number,
    sourcePlayerId: PlayerId,
    reason: string,
    now: number,
): SmashUpEvent[] {
    return buildValidatedMoveEvents(state, {
        minionUid: minion.uid,
        minionDefId: minion.defId,
        fromBaseIndex,
        toBaseIndex,
        reason,
        now,
        sourcePlayerId,
        sourceDefId: reason,
        sourceControllerId: sourcePlayerId,
        sourceBaseIndex: fromBaseIndex,
        sourceKind: 'nonAction',
    });
}

export function isMinionFaction(minion: MinionOnBase, factionId: string): boolean {
    return getMinionDef(minion.defId)?.faction === factionId;
}

export function collectBaseModifiers(core: SmashUpCore, baseIndex: number): Array<{ action: SmashUpCore['bases'][number]['ongoingActions'][number]; baseIndex: number }> {
    return (core.bases[baseIndex]?.ongoingActions ?? [])
        .filter(action => isBaseModifier(action.defId))
        .map(action => ({ action, baseIndex }));
}

export function collectCharacterModifiers(core: SmashUpCore, baseIndex?: number): Array<{
    action: MinionOnBase['attachedActions'][number];
    host: MinionOnBase;
    baseIndex: number;
}> {
    const entries: Array<{ action: MinionOnBase['attachedActions'][number]; host: MinionOnBase; baseIndex: number }> = [];
    core.bases.forEach((base, index) => {
        if (baseIndex !== undefined && index !== baseIndex) return;
        for (const host of base.minions) {
            for (const action of host.attachedActions) {
                if (isCharacterModifier(action.defId)) entries.push({ action, host, baseIndex: index });
            }
        }
    });
    return entries;
}

export function getActionOwnerId(action: { ownerId?: PlayerId; owner?: PlayerId }): PlayerId {
    return (action.ownerId ?? action.owner) as PlayerId;
}

export function drawCards(core: SmashUpCore, playerId: PlayerId, count: number, random: RandomFn, now: number): SmashUpEvent[] {
    return buildStandardDrawEvents(core, playerId, count, random, now);
}
