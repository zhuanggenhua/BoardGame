import type { PlayerId } from '../../../engine/types';
import { getCardDef } from '../data/cards';
import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerActiveBaseAbility } from '../domain/baseAbilities';
import {
    registerInterceptor,
    registerProtection,
    registerTrigger,
    type ProtectionCheckContext,
    type TriggerContext,
} from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents, findLiveOngoingCardLocation } from '../domain/ongoingDetach';
import { reduce } from '../domain/reduce';
import {
    addOngoingCardCounter,
    addPowerCounter,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    findMinionByAttachedCard,
    findMinionOnBases,
    grantExtraAction,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import type { BaseInPlay, CardInstance, MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type LocatedMinion = { minion: MinionOnBase; baseIndex: number };
type BaseOngoing = BaseInPlay['ongoingActions'][number] & { baseIndex: number };

const KING_ARTHUR = 'round_table_knights_king_arthur';
const GALAHAD = 'round_table_knights_galahad';
const GAWAIN = 'round_table_knights_gawain';
const GUINEVERE = 'round_table_knights_guinevere';
const LANCELOT = 'round_table_knights_lancelot';
const MERLIN = 'round_table_knights_merlin';
const PERCIVAL = 'round_table_knights_percival';
const A_QUESTING = 'round_table_knights_a_questing';
const EXCALIBUR = 'round_table_knights_excalibur';
const GOOD_DEED = 'round_table_knights_good_deed';
const MERLINS_LIBRARY = 'round_table_knights_merlins_library';
const NOBLE_STEED = 'round_table_knights_noble_steed';
const THE_FISHER_KING = 'round_table_knights_the_fisher_king';
const THE_GRAIL = 'round_table_knights_the_grail';
const THE_GREEN_KNIGHT = 'round_table_knights_the_green_knight';
const THE_LADY_OF_THE_LAKE = 'round_table_knights_the_lady_of_the_lake';
const THE_MISTS_OF_AVALON = 'round_table_knights_the_mists_of_avalon';
const THE_QUESTING_BEAST = 'round_table_knights_the_questing_beast';

function allMinions(state: SmashUpCore, predicate: (minion: MinionOnBase, baseIndex: number) => boolean): LocatedMinion[] {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => predicate(minion, baseIndex))
            .map(minion => ({ minion, baseIndex })),
    );
}

function printedPower(defId: string): number {
    const def = getCardDef(defId);
    return def?.type === 'minion' ? (def.power ?? 0) : 0;
}

function livePowerWithoutOngoing(minion: MinionOnBase): number {
    return minion.basePower
        + (minion.powerCounters ?? 0)
        + (minion.powerModifier ?? 0)
        + (minion.tempPowerModifier ?? 0);
}

function firstOtherBaseIndex(state: SmashUpCore, fromBaseIndex: number): number | undefined {
    const index = state.bases.findIndex((_, candidateIndex) => candidateIndex !== fromBaseIndex);
    return index >= 0 ? index : undefined;
}

function firstOwnBaseAction(state: SmashUpCore, playerId: PlayerId, baseIndex?: number): BaseOngoing | undefined {
    for (const [index, base] of state.bases.entries()) {
        if (baseIndex !== undefined && index !== baseIndex) continue;
        const action = base.ongoingActions.find(candidate => candidate.ownerId === playerId);
        if (action) return { ...action, baseIndex: index };
    }
    return undefined;
}

function ownBaseActionByUid(state: SmashUpCore, playerId: PlayerId, baseIndex: number, cardUid: string): BaseOngoing | undefined {
    const action = state.bases[baseIndex]?.ongoingActions.find(candidate =>
        candidate.uid === cardUid && candidate.ownerId === playerId,
    );
    return action ? { ...action, baseIndex } : undefined;
}

function ownsActionOnBase(base: BaseInPlay, playerId: PlayerId): boolean {
    return base.ongoingActions.some(action => action.ownerId === playerId);
}

function moveMinion(
    state: SmashUpCore,
    minion: MinionOnBase,
    fromBaseIndex: number,
    toBaseIndex: number,
    playerId: PlayerId,
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
        sourcePlayerId: playerId,
        sourceDefId: reason,
        sourceControllerId: playerId,
        sourceBaseIndex: fromBaseIndex,
        sourceKind: 'nonAction',
    });
}

function transferBaseAction(
    state: SmashUpCore,
    action: BaseOngoing,
    toBaseIndex: number,
    playerId: PlayerId,
    reason: string,
    now: number,
    metadataUpdate?: Record<string, unknown>,
): SmashUpEvent[] {
    if (toBaseIndex === action.baseIndex || !state.bases[toBaseIndex]) return [];
    const detach = buildValidatedOngoingDetachEvents(state, {
        cardUid: action.uid,
        reason,
        now,
        expectedLocation: 'base',
        sourcePlayerId: playerId,
        sourceCardUid: action.uid,
        sourceDefId: action.defId,
        sourceControllerId: playerId,
        sourceBaseIndex: action.baseIndex,
    });
    if (detach.length === 0) return [];
    return [
        ...detach,
        {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                sourcePlayerId: playerId,
                targetType: 'base',
                targetBaseIndex: toBaseIndex,
                ...((action.metadata || metadataUpdate) ? { metadata: { ...(action.metadata ?? {}), ...(metadataUpdate ?? {}) } } : {}),
                ...(action.talentUsed !== undefined ? { talentUsed: action.talentUsed } : {}),
            },
            timestamp: now,
        } as SmashUpEvent,
    ];
}

function topDeckReorderedEvent(playerId: PlayerId, card: CardInstance, deck: CardInstance[], reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: [card.uid, ...deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid)],
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function cardToDeckTop(card: CardInstance, ownerId: PlayerId, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: { cardUid: card.uid, defId: card.defId, ownerId, reason },
        timestamp: now,
    } as SmashUpEvent;
}

function removeCardFromGame(playerId: PlayerId, cardUid: string, defId: string, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
        payload: { playerId, cardUid, defId, reason },
        timestamp: now,
    } as SmashUpEvent;
}

function kingArthurTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const candidates = allMinions(ctx.state, (minion, baseIndex) =>
        minion.controller === ctx.playerId && baseIndex !== source.baseIndex,
    );
    const target = (ctx.targetMinionUid
        ? candidates.find(candidate => candidate.minion.uid === ctx.targetMinionUid)
        : candidates[0]);
    if (!target) return { events: [] };
    const moveEvents = moveMinion(ctx.state, target.minion, target.baseIndex, source.baseIndex, ctx.playerId, 'round_table_knights_king_arthur', ctx.now);
    const events = [...moveEvents];
    if (ownsActionOnBase(ctx.state.bases[source.baseIndex], ctx.playerId)) {
        events.push(addPowerCounter(target.minion.uid, source.baseIndex, 1, 'round_table_knights_king_arthur_action_bonus', ctx.now));
    }
    return { events };
}

function galahadOnPlay(ctx: AbilityContext): AbilityResult {
    const deck = ctx.state.players[ctx.playerId]?.deck ?? [];
    const target = deck.find(card => {
        const def = getCardDef(card.defId);
        return def?.type === 'action' && def.ongoingTarget === 'base';
    });
    return target ? { events: [topDeckReorderedEvent(ctx.playerId, target, deck, 'round_table_knights_galahad', ctx.now)] } : { events: [] };
}

function galahadSpecial(ctx: AbilityContext): AbilityResult {
    const action = firstOwnBaseAction(ctx.state, ctx.playerId, ctx.baseIndex);
    const toBaseIndex = ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== ctx.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (!action || toBaseIndex === undefined) return { events: [] };
    return { events: transferBaseAction(ctx.state, action, toBaseIndex, ctx.playerId, 'round_table_knights_galahad', ctx.now) };
}

function guinevereTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const candidates = ctx.state.bases[source.baseIndex].minions.filter(minion =>
        minion.uid !== source.minion.uid && minion.controller === ctx.playerId,
    );
    const target = ctx.targetMinionUid
        ? candidates.find(minion => minion.uid === ctx.targetMinionUid)
        : candidates[0];
    const toBaseIndex = ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== source.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : firstOtherBaseIndex(ctx.state, source.baseIndex);
    if (!target || toBaseIndex === undefined) return { events: [] };
    return { events: moveMinion(ctx.state, target, source.baseIndex, toBaseIndex, ctx.playerId, 'round_table_knights_guinevere', ctx.now) };
}

function lancelotMoved(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.triggerMinion?.defId !== LANCELOT || ctx.moveToBaseIndex === undefined) return [];
    if (ctx.triggerMinion.controller !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.moveToBaseIndex];
    if (!base || !ownsActionOnBase(base, ctx.triggerMinion.controller)) return [];
    return [addPowerCounter(ctx.triggerMinion.uid, ctx.moveToBaseIndex, 1, 'round_table_knights_lancelot', ctx.now)];
}

function merlinTalent(ctx: AbilityContext): AbilityResult {
    const deck = ctx.state.players[ctx.playerId]?.deck ?? [];
    const top = deck[0];
    if (!top) return { events: [] };
    const def = getCardDef(top.defId);
    if (def?.type !== 'action') {
        return {
            events: [{
                type: SU_EVENTS.REVEAL_DECK_TOP,
                payload: { playerId: ctx.playerId, cardUids: [top.uid], reason: 'round_table_knights_merlin' },
                timestamp: ctx.now,
            } as SmashUpEvent],
        };
    }
    return {
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            grantExtraAction(ctx.playerId, 'round_table_knights_merlin_extra_action', ctx.now, {
                playTiming: 'immediate',
                restrictToCardUid: top.uid,
            }),
        ],
    };
}

function percivalTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const candidateBaseIndices = ctx.state.bases
        .map((base, index) => ({ base, index }))
        .filter(({ base, index }) =>
        index !== source.baseIndex && ownsActionOnBase(base, ctx.playerId),
    )
        .map(({ index }) => index);
    const toBaseIndex = ctx.targetBaseIndex !== undefined && candidateBaseIndices.includes(ctx.targetBaseIndex)
        ? ctx.targetBaseIndex
        : candidateBaseIndices[0];
    if (toBaseIndex === undefined) return { events: [] };
    return { events: moveMinion(ctx.state, source.minion, source.baseIndex, toBaseIndex, ctx.playerId, 'round_table_knights_percival', ctx.now) };
}

function aQuestingOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const target = findMinionOnBases(ctx.state, ctx.targetMinionUid);
    if (!target || target.minion.controller !== ctx.playerId) return { events: [] };
    const toBaseIndex = firstOtherBaseIndex(ctx.state, target.baseIndex);
    if (toBaseIndex === undefined) return { events: [] };
    return { events: moveMinion(ctx.state, target.minion, target.baseIndex, toBaseIndex, ctx.playerId, 'round_table_knights_a_questing', ctx.now) };
}

function goodDeedOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function goodDeedOnMove(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    const action = ownBaseActionByUid(ctx.state, ctx.sourceControllerId, ctx.sourceBaseIndex, ctx.sourceCardUid);
    if (!action) return [];
    if (Number(action.metadata?.roundTableGoodDeedUsedTurn ?? -1) === ctx.state.turnNumber) return [];
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.sourceBaseIndex);
    const metadataUpdate = { roundTableGoodDeedUsedTurn: ctx.state.turnNumber };
    return [
        ...buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now),
        ...(toBaseIndex === undefined
            ? [addOngoingCardCounter(action.uid, ctx.sourceBaseIndex, 0, 'round_table_knights_good_deed_once_per_turn', ctx.now, { metadataUpdate })]
            : transferBaseAction(ctx.state, action, toBaseIndex, ctx.sourceControllerId, 'round_table_knights_good_deed', ctx.now, metadataUpdate)),
    ];
}

function merlinsLibraryTalent(ctx: AbilityContext): AbilityResult {
    const action = ownBaseActionByUid(ctx.state, ctx.playerId, ctx.baseIndex, ctx.cardUid);
    if (ctx.targetMinionUid) {
        const movable = allMinions(ctx.state, (minion, baseIndex) =>
            minion.controller === ctx.playerId
            && baseIndex !== ctx.baseIndex
            && minion.uid === ctx.targetMinionUid,
        )[0];
        if (movable) {
            return { events: moveMinion(ctx.state, movable.minion, movable.baseIndex, ctx.baseIndex, ctx.playerId, 'round_table_knights_merlins_library_move', ctx.now) };
        }
    }
    if (ctx.targetBaseIndex !== undefined) {
        if (!action || ctx.targetBaseIndex === ctx.baseIndex || !ctx.state.bases[ctx.targetBaseIndex]) return { events: [] };
        return { events: transferBaseAction(ctx.state, action, ctx.targetBaseIndex, ctx.playerId, 'round_table_knights_merlins_library_transfer', ctx.now) };
    }
    return { events: [grantExtraMinion(ctx.playerId, 'round_table_knights_merlins_library_minion', ctx.now, ctx.baseIndex)] };
}

function nobleSteedTalent(ctx: AbilityContext): AbilityResult {
    const host = findMinionByAttachedCard(ctx.state, ctx.cardUid);
    const toBaseIndex = host && ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== host.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : host ? firstOtherBaseIndex(ctx.state, host.baseIndex) : undefined;
    if (!host || toBaseIndex === undefined || host.minion.controller !== ctx.playerId) return { events: [] };
    return { events: moveMinion(ctx.state, host.minion, host.baseIndex, toBaseIndex, ctx.playerId, 'round_table_knights_noble_steed', ctx.now) };
}

function fisherKingOnMove(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    const events = buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
    const projected = events.reduce((next, event) => reduce(next, event), ctx.state);
    if ((projected.players[ctx.sourceControllerId]?.hand.length ?? 0) >= 8) {
        events.push(
            ...buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: ctx.sourceCardUid,
                reason: 'round_table_knights_the_fisher_king',
                now: ctx.now,
                expectedLocation: 'base',
                sourcePlayerId: ctx.sourceControllerId,
                sourceDefId: THE_FISHER_KING,
                sourceControllerId: ctx.sourceControllerId,
                sourceBaseIndex: ctx.sourceBaseIndex,
            }),
            { type: SU_EVENTS.VP_AWARDED, payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'round_table_knights_the_fisher_king' }, timestamp: ctx.now } as SmashUpEvent,
        );
    }
    return events;
}

function grailOnMove(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    const count = base.minions.filter(minion => minion.controller === ctx.sourceControllerId && livePowerWithoutOngoing(minion) >= 4).length;
    if (count < 3) return [];
    return [
        ...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: ctx.sourceCardUid,
            reason: 'round_table_knights_the_grail',
            now: ctx.now,
            expectedLocation: 'base',
            sourcePlayerId: ctx.sourceControllerId,
            sourceDefId: THE_GRAIL,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
        }),
        removeCardFromGame(ctx.sourceControllerId, ctx.sourceCardUid, THE_GRAIL, 'round_table_knights_the_grail', ctx.now),
        { type: SU_EVENTS.VP_AWARDED, payload: { playerId: ctx.sourceControllerId, amount: 2, reason: 'round_table_knights_the_grail' }, timestamp: ctx.now } as SmashUpEvent,
    ];
}

function greenKnightOnMove(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.triggerMinion) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion.controller !== ctx.sourceControllerId) return [];
    const events: SmashUpEvent[] = [addPowerCounter(ctx.triggerMinion.uid, ctx.sourceBaseIndex, 1, 'round_table_knights_the_green_knight', ctx.now)];
    if (livePowerWithoutOngoing(ctx.triggerMinion) + 1 >= 7) {
        events.push(
            ...buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: ctx.sourceCardUid,
                reason: 'round_table_knights_the_green_knight',
                now: ctx.now,
                expectedLocation: 'base',
                sourcePlayerId: ctx.sourceControllerId,
                sourceDefId: THE_GREEN_KNIGHT,
                sourceControllerId: ctx.sourceControllerId,
                sourceBaseIndex: ctx.sourceBaseIndex,
            }),
            { type: SU_EVENTS.VP_AWARDED, payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'round_table_knights_the_green_knight' }, timestamp: ctx.now } as SmashUpEvent,
        );
    }
    return events;
}

function ladyOfTheLake(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const isMinionAction = (card: CardInstance) => {
        const def = getCardDef(card.defId);
        return def?.type === 'action' && def.ongoingTarget === 'minion';
    };
    const discardCard = player?.discard.find(isMinionAction);
    if (discardCard) {
        return {
            events: [{
                type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
                payload: { playerId: ctx.playerId, cardUids: [discardCard.uid], reason: THE_LADY_OF_THE_LAKE },
                timestamp: ctx.now,
            } as SmashUpEvent, grantExtraAction(ctx.playerId, 'round_table_knights_the_lady_of_the_lake_extra_action', ctx.now, {
                playTiming: 'immediate',
                restrictToCardUid: discardCard.uid,
            })],
        };
    }
    const deckCard = player?.deck.find(isMinionAction);
    if (!player || !deckCard) return { events: [] };
    return {
        events: [
            topDeckReorderedEvent(ctx.playerId, deckCard, player.deck, THE_LADY_OF_THE_LAKE, ctx.now),
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            grantExtraAction(ctx.playerId, 'round_table_knights_the_lady_of_the_lake_extra_action', ctx.now, {
                playTiming: 'immediate',
                restrictToCardUid: deckCard.uid,
            }),
        ],
    };
}

function mistsOfAvalon(ctx: AbilityContext): AbilityResult {
    const minions = (ctx.state.players[ctx.playerId]?.discard ?? [])
        .filter(card => card.type === 'minion')
        .slice(0, 3);
    return { events: minions.map(card => cardToDeckTop(card, ctx.playerId, THE_MISTS_OF_AVALON, ctx.now)) };
}

function questingBeastOnMove(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.triggerMinion) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion.controller !== ctx.sourceControllerId) return [];
    const action = ownBaseActionByUid(ctx.state, ctx.sourceControllerId, ctx.sourceBaseIndex, ctx.sourceCardUid);
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.sourceBaseIndex);
    return [
        addPowerCounter(ctx.triggerMinion.uid, ctx.sourceBaseIndex, 1, 'round_table_knights_the_questing_beast', ctx.now),
        ...(!action || toBaseIndex === undefined
            ? []
            : transferBaseAction(ctx.state, action, toBaseIndex, ctx.sourceControllerId, 'round_table_knights_the_questing_beast', ctx.now)),
    ];
}

function excaliburAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || ctx.baseIndex === undefined) return [];
    const host = findMinionByAttachedCard(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.baseIndex || host.minion.defId !== KING_ARTHUR) return [];
    return [{
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'round_table_knights_excalibur_king_arthur' },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function camelotSelectedMinion(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): MinionOnBase | undefined {
    const minions = ctx.state.bases[ctx.baseIndex]?.minions ?? [];
    return ctx.targetMinionUid
        ? minions.find(candidate => candidate.uid === ctx.targetMinionUid && candidate.controller === ctx.playerId)
        : minions.find(candidate => candidate.controller === ctx.playerId);
}

function camelotDestinationBaseIndex(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): number | undefined {
    if (ctx.targetBaseIndex !== undefined) {
        return ctx.targetBaseIndex !== ctx.baseIndex && ctx.state.bases[ctx.targetBaseIndex] ? ctx.targetBaseIndex : undefined;
    }
    return firstOtherBaseIndex(ctx.state, ctx.baseIndex);
}

function camelotCanUse(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): boolean {
    return Boolean(camelotSelectedMinion(ctx) && camelotDestinationBaseIndex(ctx) !== undefined);
}

function camelotActive(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): { events: SmashUpEvent[] } {
    const minion = camelotSelectedMinion(ctx);
    const toBaseIndex = camelotDestinationBaseIndex(ctx);
    if (!minion || toBaseIndex === undefined) return { events: [] };
    return { events: moveMinion(ctx.state, minion, ctx.baseIndex, toBaseIndex, ctx.playerId, 'base_camelot', ctx.now) };
}

function aQuestingReplacement(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (event.type !== SU_EVENTS.MINION_DESTROYED) return undefined;
    const payload = event.payload as { minionUid: string; fromBaseIndex: number; ownerId: PlayerId };
    const minion = state.bases[payload.fromBaseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
    const quest = minion?.attachedActions.find(action => action.defId === A_QUESTING);
    if (!minion || !quest) return undefined;
    return [
        ...buildValidatedOngoingDetachEvents(state, {
            cardUid: quest.uid,
            reason: 'round_table_knights_a_questing_replacement',
            now: event.timestamp ?? Date.now(),
            expectedLocation: 'minion',
            sourcePlayerId: quest.ownerId,
            sourceDefId: A_QUESTING,
            sourceControllerId: quest.ownerId,
            sourceBaseIndex: payload.fromBaseIndex,
        }),
        cardToDeckTop({ uid: minion.uid, defId: minion.defId, type: 'minion' } as CardInstance, payload.ownerId, 'round_table_knights_a_questing_replacement', event.timestamp ?? Date.now()),
    ];
}

function guinevereActionProtection(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (event.type !== SU_EVENTS.ONGOING_DETACHED) return undefined;
    const payload = event.payload as { cardUid: string; ownerId: PlayerId; sourcePlayerId?: PlayerId };
    if (!payload.sourcePlayerId || payload.sourcePlayerId === payload.ownerId) return undefined;
    const location = findLiveOngoingCardLocation(state, payload.cardUid);
    if (!location || location.targetType !== 'base') return undefined;
    const hasGuinevere = allMinions(state, minion => minion.defId === GUINEVERE && minion.controller === payload.ownerId).length > 0;
    return hasGuinevere ? null : undefined;
}

function excaliburProtection(ctx: ProtectionCheckContext): boolean {
    return ctx.targetMinion.attachedActions.some(action =>
        action.defId === EXCALIBUR && action.ownerId !== ctx.sourcePlayerId && ctx.protectionType === 'destroy',
    );
}

function camelotProtection(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base || base.defId !== 'base_camelot') return false;
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return printedPower(ctx.targetMinion.defId) >= 4;
}

export function registerRoundTableKnightAbilities(): void {
    registerAbility(KING_ARTHUR, 'talent', kingArthurTalent);
    registerAbility(GALAHAD, 'onPlay', galahadOnPlay);
    registerAbility(GALAHAD, 'special', galahadSpecial);
    registerAbility(GUINEVERE, 'talent', guinevereTalent);
    registerAbility(MERLIN, 'talent', merlinTalent);
    registerAbility(PERCIVAL, 'talent', percivalTalent);
    registerAbility(A_QUESTING, 'onPlay', aQuestingOnPlay);
    registerAbility(GOOD_DEED, 'onPlay', goodDeedOnPlay);
    registerAbility(MERLINS_LIBRARY, 'talent', merlinsLibraryTalent);
    registerAbility(NOBLE_STEED, 'talent', nobleSteedTalent);
    registerAbility(THE_LADY_OF_THE_LAKE, 'onPlay', ladyOfTheLake);
    registerAbility(THE_MISTS_OF_AVALON, 'onPlay', mistsOfAvalon);

    for (const ongoingId of [GAWAIN, GUINEVERE, LANCELOT, A_QUESTING, EXCALIBUR, GOOD_DEED, MERLINS_LIBRARY, NOBLE_STEED, THE_FISHER_KING, THE_GRAIL, THE_GREEN_KNIGHT, THE_QUESTING_BEAST]) {
        registerAbility(ongoingId, 'ongoing', () => ({ events: [] }));
    }

    registerTrigger(LANCELOT, 'onMinionMoved', lancelotMoved, { perInstance: true, playerContext: 'sourceController', baseScoped: false });
    registerTrigger(GOOD_DEED, 'onMinionMoved', goodDeedOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(THE_FISHER_KING, 'onMinionMoved', fisherKingOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(THE_GRAIL, 'onMinionMoved', grailOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(THE_GREEN_KNIGHT, 'onMinionMoved', greenKnightOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(THE_QUESTING_BEAST, 'onMinionMoved', questingBeastOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(EXCALIBUR, 'afterScoring', excaliburAfterScoring, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });

    registerProtection(EXCALIBUR, 'destroy', excaliburProtection);
    registerProtection('base_camelot', 'destroy', camelotProtection);
    registerProtection('base_camelot', 'move', camelotProtection);
    registerProtection('base_camelot', 'affect', camelotProtection);
    registerProtection('base_camelot', 'action', camelotProtection);
    registerInterceptor(A_QUESTING, aQuestingReplacement);
    registerInterceptor(GUINEVERE, guinevereActionProtection);
    registerActiveBaseAbility('base_camelot', camelotActive, {
        oncePerTurn: true,
        canUse: camelotCanUse,
    });
}
