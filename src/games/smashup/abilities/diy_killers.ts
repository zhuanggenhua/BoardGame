import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getCardDef } from '../data/cards';
import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler, type InteractionHandler } from '../domain/abilityInteractionHandlers';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import {
    addPermanentPower,
    addPowerCounter,
    addTempPower,
    buildFieldSourceTargetPromptConfig,
    buildFieldSourceToMinionTargetOptions,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildStandardDrawEvents,
    buildValidatedBaseMoveEvents,
    buildValidatedDestroyEvents,
    createSkipOption,
    findMinionByAttachedCard,
    grantContextualExtraAction,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { registerCardAbilitySuppression, registerTrigger, type TriggerContext, type TriggerResult } from '../domain/ongoingEffects';
import { registerBaseAbility, registerExtended, type BaseAbilityContext, type BaseAbilityResult } from '../domain/baseAbilities';
import { appendResolvedActionAbility } from '../domain/externalActionPlay';
import type {
    CardInstance,
    CardsDiscardedEvent,
    CardToDeckTopEvent,
    CardsDrawnEvent,
    DeckReorderedEvent,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.DIY_KILLERS;

function isKillerMinion(defId: string): boolean {
    const def = getCardDef(defId);
    return def?.type === 'minion' && def.faction === FACTION;
}

function getCardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function getAttachedActionControllerId(action: MinionOnBase['attachedActions'][number]): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId;
}

function getOngoingActionControllerId(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId;
}

function countPlayerCardsAtBase(core: SmashUpCore, playerId: PlayerId, baseIndex: number): number {
    const base = core.bases[baseIndex];
    if (!base) return 0;
    const minionCards = base.minions.filter(minion => minion.controller === playerId).length;
    const attachedActions = base.minions.reduce(
        (total, minion) => total + minion.attachedActions.filter(action => getAttachedActionControllerId(action) === playerId).length,
        0,
    );
    const baseActions = base.ongoingActions.filter(action => getOngoingActionControllerId(action) === playerId).length;
    return minionCards + attachedActions + baseActions;
}

function baseHasKiller(core: SmashUpCore, baseIndex: number): boolean {
    return core.bases[baseIndex]?.minions.some(minion => isKillerMinion(minion.defId)) ?? false;
}

function discardFromHand(playerId: PlayerId, cardUids: string[], timestamp: number): CardsDiscardedEvent {
    return {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids },
        timestamp,
    };
}

function nextPlayerTurnStartExpiration(state: SmashUpCore, playerId: PlayerId): number {
    const turnOrder = state.turnOrder ?? [];
    const currentIndex = Number.isInteger(state.currentPlayerIndex)
        ? state.currentPlayerIndex
        : turnOrder.indexOf((state as { currentPlayer?: PlayerId }).currentPlayer ?? '');
    const playerIndex = turnOrder.indexOf(playerId);
    if (turnOrder.length === 0 || currentIndex < 0 || playerIndex < 0) return state.turnNumber + 1;
    return state.turnNumber + (playerIndex > currentIndex ? 0 : 1);
}

function minionMetadataUpdated(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp: now,
    } as SmashUpEvent;
}

function baseAbilityUsed(playerId: PlayerId, baseIndex: number, baseDefId: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.BASE_ABILITY_USED,
        payload: { playerId, baseIndex, baseDefId },
        timestamp: now,
    } as SmashUpEvent;
}

function findMinionByUid(core: SmashUpCore, minionUid: string): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (const [baseIndex, base] of core.bases.entries()) {
        const minion = base.minions.find(candidate => candidate.uid === minionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function findHostByAttachedCardUid(
    core: SmashUpCore,
    attachedCardUid: string | undefined,
): { minion: MinionOnBase; baseIndex: number; action: MinionOnBase['attachedActions'][number] } | undefined {
    if (!attachedCardUid) return undefined;
    for (const [baseIndex, base] of core.bases.entries()) {
        for (const minion of base.minions) {
            const action = minion.attachedActions.find(candidate => candidate.uid === attachedCardUid);
            if (action) return { minion, baseIndex, action };
        }
    }
    return undefined;
}

function markMacheteHostDestroyedIfAttached(
    core: SmashUpCore,
    hostMinionUid: string | undefined,
    hostBaseIndex: number | undefined,
    now: number,
): SmashUpEvent[] {
    if (!hostMinionUid || hostBaseIndex === undefined) return [];
    const host = core.bases[hostBaseIndex]?.minions.find(minion => minion.uid === hostMinionUid);
    if (!host?.attachedActions.some(action => action.defId === 'diy_killers_machete')) return [];
    return [minionMetadataUpdated(
        hostMinionUid,
        hostBaseIndex,
        { diyKillersMacheteHostDestroyedTurn: core.turnNumber },
        'diy_killers_machete',
        now,
    )];
}

function cardToDeckTop(
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    reason: string,
    now: number,
    sourcePlayerId?: PlayerId,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid,
            defId,
            ownerId,
            reason,
            sourcePlayerId,
            sourceDefId: reason,
            sourceControllerId: sourcePlayerId,
        },
        timestamp: now,
    };
}

function deckReordered(playerId: PlayerId, deckUids: string[], now: number): DeckReorderedEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids },
        timestamp: now,
    };
}

function buildCardOptions(cards: CardInstance[]) {
    return cards.map((card, index) => ({
        id: `card-${index}`,
        label: getCardName(card.defId),
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'discard' as const,
        displayMode: 'card' as const,
    }));
}

function getPlayOnMinionActions(cards: CardInstance[]): CardInstance[] {
    return cards.filter(card => {
        const def = getCardDef(card.defId);
        return def?.type === 'action'
            && def.subtype === 'ongoing'
            && def.ongoingTarget === 'minion'
            && def.playNeedsMinion === true;
    });
}

function findOwnMovableMinions(core: SmashUpCore, playerId: PlayerId): Array<{ minion: MinionOnBase; baseIndex: number }> {
    if (core.bases.length <= 1) return [];
    return core.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId)
            .map(minion => ({ minion, baseIndex })),
    );
}

function queueKillerFollowupChoice(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceId: string,
    now: number,
): MatchState<SmashUpCore> {
    const interaction = createSimpleChoice(
        `${sourceId}_followup_${now}`,
        playerId,
        '选择后续效果',
        [
            {
                id: 'deck-top',
                label: '放到牌库顶',
                labelKey: 'ui.diy_killers_followup_deck_top_option',
                value: { mode: 'deckTop' },
                displayMode: 'button' as const,
            },
            {
                id: 'extra-action',
                label: '打出一个额外行动',
                labelKey: 'ui.diy_killers_followup_extra_action_option',
                value: { mode: 'extraAction' },
                displayMode: 'button' as const,
            },
        ],
        { sourceId, targetType: 'button', titleKey: `ui.${sourceId}_followup_title` },
    );
    return queueInteraction(matchState, interaction);
}

function resolveDeckTopOrExtraAction(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    sourceDefId: string,
    cardUid: string | undefined,
    timestamp: number,
): SmashUpEvent[] {
    const mode = (value as { mode?: string } | undefined)?.mode;
    if (mode === 'deckTop' && cardUid) {
        return [cardToDeckTop(cardUid, sourceDefId, playerId, sourceDefId, timestamp, playerId)];
    }
    if (mode === 'extraAction') {
        return [grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, sourceDefId)];
    }
    return [];
}

function queueChachaFollowup(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    cardUid: string,
    timestamp: number,
): MatchState<SmashUpCore> {
    const next = queueKillerFollowupChoice(state, playerId, 'diy_killers_cha_cha_cha_ha_ha_ha_followup', timestamp);
    const current = next.sys.interaction?.current;
    if (!current) return next;
    return {
        ...next,
        sys: {
            ...next.sys,
            interaction: {
                ...next.sys.interaction,
                current: {
                    ...current,
                    data: {
                        ...(current.data as Record<string, unknown>),
                        continuationContext: { cardUid },
                    },
                },
            },
        },
    };
}

function diyKillersChacha(ctx: AbilityContext): AbilityResult {
    const movable = findOwnMovableMinions(ctx.state, ctx.playerId);
    if (movable.length === 0) {
        return { events: [], matchState: queueChachaFollowup(ctx.matchState, ctx.playerId, ctx.cardUid, ctx.now) };
    }
    const interaction = createSimpleChoice(
        `diy_killers_cha_cha_cha_ha_ha_ha_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择要移动的己方仆从',
        buildMinionTargetOptions(
            movable.map(({ minion, baseIndex }) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardName(minion.defId)} @ ${ctx.state.bases[baseIndex]?.defId ?? baseIndex}`,
            })),
            { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'move' },
        ),
        { sourceId: 'diy_killers_cha_cha_cha_ha_ha_ha', targetType: 'minion', titleKey: 'ui.diy_killers_chacha_choose_minion_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = { cardUid: ctx.cardUid };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const chachaChooseMinion: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) {
        return { state, events: [] };
    }
    const fromBaseIndex = selected.baseIndex;
    const options = state.core.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ baseIndex }) => baseIndex !== fromBaseIndex)
        .map(({ base, baseIndex }) => ({
            id: `base-${baseIndex}`,
            label: base.defId,
            value: {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex,
                toBaseIndex: baseIndex,
                toBaseDefId: base.defId,
            },
            displayMode: 'card' as const,
        }));
    if (options.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `diy_killers_cha_cha_cha_ha_ha_ha_base_${timestamp}`,
        playerId,
        '选择移动目标基地',
        options,
        { sourceId: 'diy_killers_cha_cha_cha_ha_ha_ha_base', targetType: 'base', titleKey: 'ui.diy_killers_chacha_choose_base_title' },
    );
    const continuation = (_data?.continuationContext as { cardUid?: string } | undefined) ?? {};
    (interaction.data as Record<string, unknown>).continuationContext = continuation;
    return { state: queueInteraction(state, interaction), events: [] };
};

const chachaChooseBase: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const selected = value as {
        minionUid?: string;
        minionDefId?: string;
        fromBaseIndex?: number;
        toBaseIndex?: number;
        toBaseDefId?: string;
    } | undefined;
    if (!selected?.minionUid || !selected.minionDefId || selected.fromBaseIndex === undefined || selected.toBaseIndex === undefined) {
        return { state, events: [] };
    }
    const events = buildValidatedBaseMoveEvents(state, {
        minionUid: selected.minionUid,
        minionDefId: selected.minionDefId,
        fromBaseIndex: selected.fromBaseIndex,
        toBaseIndex: selected.toBaseIndex,
        toBaseDefId: selected.toBaseDefId,
        reason: 'diy_killers_cha_cha_cha_ha_ha_ha',
        now: timestamp,
        sourcePlayerId: playerId,
        sourceDefId: 'diy_killers_cha_cha_cha_ha_ha_ha',
        sourceBaseIndex: selected.fromBaseIndex,
    });
    const cardUid = (data?.continuationContext as { cardUid?: string } | undefined)?.cardUid;
    return {
        state: queueChachaFollowup(state, playerId, cardUid ?? '', timestamp),
        events,
    };
};

const chachaFollowup: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const cardUid = (data?.continuationContext as { cardUid?: string } | undefined)?.cardUid;
    return {
        state,
        events: resolveDeckTopOrExtraAction(state, playerId, value, 'diy_killers_cha_cha_cha_ha_ha_ha', cardUid, timestamp),
    };
};

function diyKillersGoodBoy(ctx: AbilityContext): AbilityResult {
    const minions = ctx.state.players[ctx.playerId]?.discard.filter(card => getCardDef(card.defId)?.type === 'minion') ?? [];
    const extra = grantContextualExtraAction({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'diy_killers_good_boy');
    if (minions.length === 0) return { events: [extra] };
    if (minions.length === 1) {
        return { events: [recoverCardsFromDiscard(ctx.playerId, [minions[0].uid], 'diy_killers_good_boy', ctx.now), extra] };
    }
    const interaction = createSimpleChoice(
        `diy_killers_good_boy_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择从弃牌堆回手的仆从',
        buildCardOptions(minions),
        { sourceId: 'diy_killers_good_boy', targetType: 'discard_minion', titleKey: 'ui.diy_killers_good_boy_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const goodBoyHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    const selected = value as { cardUid?: string } | undefined;
    const events: SmashUpEvent[] = [];
    if (selected?.cardUid) {
        events.push(recoverCardsFromDiscard(playerId, [selected.cardUid], 'diy_killers_good_boy', timestamp));
    }
    events.push(grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'diy_killers_good_boy'));
    return { state, events };
};

function diyKillersIsItOver(ctx: AbilityContext): AbilityResult {
    const actions = getPlayOnMinionActions(ctx.state.players[ctx.playerId]?.discard ?? []);
    if (actions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_killers_is_it_over_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择从弃牌堆回手的附着行动',
        buildCardOptions(actions),
        { sourceId: 'diy_killers_is_it_over', targetType: 'discard', titleKey: 'ui.diy_killers_is_it_over_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const isItOverHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    const selected = value as { cardUid?: string; defId?: string } | undefined;
    if (!selected?.cardUid || !selected.defId) return { state, events: [] };
    return {
        state,
        events: [
            recoverCardsFromDiscard(playerId, [selected.cardUid], 'diy_killers_is_it_over', timestamp),
            grantContextualExtraAction(
                { playerId, now: timestamp, matchState: state },
                'diy_killers_is_it_over',
                { restrictToCardUid: selected.cardUid, restrictToCardDefId: selected.defId },
            ),
        ],
    };
};

const SIGNATURE_ACTION_BY_KILLER: Record<string, string> = {
    diy_killers_leatherface: 'diy_killers_chainsaw',
    diy_killers_freddy_krueger: 'diy_killers_clawed_glove',
    diy_killers_jason: 'diy_killers_machete',
    diy_killers_michael_myers: 'diy_killers_captain_kirk_mask',
    diy_killers_pinhead: 'diy_killers_hell_puzzle_box',
};

function drawDeckCardByUid(
    core: SmashUpCore,
    playerId: PlayerId,
    cardUid: string,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const player = core.players[playerId];
    const card = player?.deck.find(candidate => candidate.uid === cardUid);
    if (!player || !card) return [];
    const rest = player.deck.filter(candidate => candidate.uid !== cardUid);
    return [
        deckReordered(playerId, [card.uid, ...rest.map(candidate => candidate.uid)], now),
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [card.uid] },
            timestamp: now,
        } as CardsDrawnEvent,
    ];
}

function resolveSignatureActionSearch(
    core: SmashUpCore,
    playerId: PlayerId,
    value: unknown,
    timestamp: number,
): SmashUpEvent[] {
    const selected = value as { skip?: boolean; zone?: 'deck' | 'discard'; cardUid?: string } | undefined;
    if (selected?.skip || !selected?.zone || !selected.cardUid) return [];
    if (selected.zone === 'discard') {
        return [recoverCardsFromDiscard(playerId, [selected.cardUid], 'diy_killers_signature_search', timestamp)];
    }
    return drawDeckCardByUid(core, playerId, selected.cardUid, 'diy_killers_signature_search', timestamp);
}

function diyKillersSignatureSearch(ctx: AbilityContext): AbilityResult {
    const signatureDefId = SIGNATURE_ACTION_BY_KILLER[ctx.defId];
    const player = ctx.state.players[ctx.playerId];
    if (!signatureDefId || !player) return { events: [] };
    const candidates = [
        ...player.deck
            .filter(card => card.defId === signatureDefId)
            .map(card => ({ card, zone: 'deck' as const })),
        ...player.discard
            .filter(card => card.defId === signatureDefId)
            .map(card => ({ card, zone: 'discard' as const })),
    ];
    if (candidates.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `diy_killers_signature_search_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        `${getCardName(ctx.defId)}：选择是否抽取${getCardName(signatureDefId)}`,
        [
            createSkipOption('不抽取装备', 'ui.skip'),
            ...candidates.map(({ card, zone }, index) => ({
                id: `${zone}-${index}`,
                label: `${getCardName(card.defId)}（${zone === 'deck' ? '牌库' : '弃牌堆'}）`,
                value: { zone, cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: 'diy_killers_signature_search', targetType: 'generic', titleKey: 'ui.diy_killers_signature_search_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const signatureSearchHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => ({
    state,
    events: resolveSignatureActionSearch(state.core, playerId, value, timestamp),
});

function drawFirstMatchingDeckCard(
    core: SmashUpCore,
    playerId: PlayerId,
    predicate: (card: CardInstance) => boolean,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const player = core.players[playerId];
    if (!player) return [];
    const target = player.deck.find(predicate);
    if (!target) return [];
    const rest = player.deck.filter(card => card.uid !== target.uid);
    return [
        deckReordered(playerId, [target.uid, ...rest.map(card => card.uid)], now),
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [target.uid] },
            timestamp: now,
        } as CardsDrawnEvent,
    ];
}

function diyKillersImprovisedWeapon(ctx: AbilityContext): AbilityResult {
    const events = drawFirstMatchingDeckCard(
        ctx.state,
        ctx.playerId,
        card => getPlayOnMinionActions([card]).length > 0,
        'diy_killers_improvised_weapon',
        ctx.now,
    );
    const drawn = events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as CardsDrawnEvent | undefined;
    const cardUid = drawn?.payload.cardUids[0];
    const card = cardUid ? ctx.state.players[ctx.playerId]?.deck.find(candidate => candidate.uid === cardUid) : undefined;
    if (!card) return { events };
    return {
        events: [
            ...events,
            grantContextualExtraAction(
                { playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState },
                'diy_killers_improvised_weapon',
                { restrictToCardUid: card.uid, restrictToCardDefId: card.defId },
            ),
        ],
    };
}

function hasKillerInPlay(core: SmashUpCore, playerId: PlayerId): boolean {
    return core.bases.some(base => base.minions.some(minion => minion.controller === playerId && isKillerMinion(minion.defId)));
}

function diyKillersOriginStory(ctx: AbilityContext): AbilityResult {
    const mustDrawKiller = !hasKillerInPlay(ctx.state, ctx.playerId);
    const drawEvents = drawFirstMatchingDeckCard(
        ctx.state,
        ctx.playerId,
        card => {
            const def = getCardDef(card.defId);
            return def?.type === 'minion' && (!mustDrawKiller || def.faction === FACTION);
        },
        'diy_killers_origin_story',
        ctx.now,
    );
    return {
        events: [
            ...drawEvents,
            grantContextualExtraAction({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'diy_killers_origin_story'),
        ],
    };
}

function diyKillersOhNo(ctx: AbilityContext): AbilityResult {
    const ownMinions = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardName(minion.defId)} @ ${base.defId}`,
            })),
    );
    if (ownMinions.length === 0) return { events: [] };
    if (ownMinions.length === 1) {
        return { events: [addTempPower(ownMinions[0].uid, ownMinions[0].baseIndex, 3, 'diy_killers_oh_no', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `diy_killers_oh_no_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择获得 +3 力量的己方仆从',
        buildMinionTargetOptions(ownMinions, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'power_change' }),
        { sourceId: 'diy_killers_oh_no', targetType: 'minion', titleKey: 'ui.diy_killers_oh_no_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const ohNoHandler: InteractionHandler = (state, _playerId, value, _data, _random, timestamp) => {
    const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    return { state, events: [addTempPower(selected.minionUid, selected.baseIndex, 3, 'diy_killers_oh_no', timestamp)] };
};

function diyKillersOhNoSpecialTrigger(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || !ctx.matchState) return { events: [] };
    if (ctx.destroyerId !== ctx.sourceControllerId || ctx.controllerId === ctx.sourceControllerId) return { events: [] };
    const player = ctx.state.players[ctx.sourceControllerId];
    const card = player?.hand.find(candidate => candidate.uid === ctx.sourceCardUid && candidate.defId === 'diy_killers_oh_no');
    if (!card) return { events: [] };

    const events: SmashUpEvent[] = [buildActionPlayedEvent({
        playerId: ctx.sourceControllerId,
        cardUid: card.uid,
        defId: card.defId,
        ownerId: card.owner,
        timestamp: ctx.now,
        isExtraAction: true,
        sourceCommandType: 'diy_killers_oh_no_special',
    })];
    return appendResolvedActionAbility({
        state: ctx.matchState,
        events,
        playerId: ctx.sourceControllerId,
        cardUid: card.uid,
        defId: card.defId,
        random: ctx.random,
        timestamp: ctx.now,
    });
}

type LaundryRoomContext = {
    attachedCardUid: string;
    sourceControllerId: PlayerId;
    sourceBaseIndex: number;
    hostMinionUid: string;
    hostMinionDefId: string;
    hostControllerId: PlayerId;
};

function diyKillersLaundryRoom(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantContextualExtraAction({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'diy_killers_laundry_room')],
    };
}

function queueLaundryRoomDestroyPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    context: LaundryRoomContext,
    timestamp: number,
): MatchState<SmashUpCore> {
    const interaction = createSimpleChoice(
        `diy_killers_laundry_room_destroy_${context.attachedCardUid}_${timestamp}`,
        playerId,
        '躲藏在洗衣间：选择是否摧毁附着的仆从',
        [
            createSkipOption('不摧毁', 'ui.skip'),
            {
                id: 'destroy',
                label: `摧毁${getCardName(context.hostMinionDefId)}`,
                value: {
                    mode: 'destroy',
                    minionUid: context.hostMinionUid,
                    defId: context.hostMinionDefId,
                    baseIndex: context.sourceBaseIndex,
                },
                displayMode: 'card' as const,
            },
        ],
        { sourceId: 'diy_killers_laundry_room_destroy', targetType: 'minion', titleKey: 'ui.diy_killers_laundry_room_destroy_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = context;
    return queueInteraction(state, interaction);
}

function diyKillersLaundryRoomTrigger(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.matchState) return { events: [] };
    if (!ctx.triggerMinionDefId || !isKillerMinion(ctx.triggerMinionDefId)) return { events: [] };
    if (ctx.timing === 'onMinionMoved' && ctx.moveToBaseIndex !== ctx.sourceBaseIndex) return { events: [] };
    const host = findHostByAttachedCardUid(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.sourceBaseIndex || host.minion.controller === ctx.sourceControllerId) return { events: [] };

    const context: LaundryRoomContext = {
        attachedCardUid: ctx.sourceCardUid,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: host.baseIndex,
        hostMinionUid: host.minion.uid,
        hostMinionDefId: host.minion.defId,
        hostControllerId: host.minion.controller,
    };
    const hand = ctx.state.players[host.minion.controller]?.hand ?? [];
    const safeBases = ctx.state.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ baseIndex }) => baseIndex !== host.baseIndex && !baseHasKiller(ctx.state, baseIndex));
    if (hand.length === 0 || safeBases.length === 0) {
        return { events: [], matchState: queueLaundryRoomDestroyPrompt(ctx.matchState, ctx.sourceControllerId, context, ctx.now) };
    }

    const interaction = createSimpleChoice(
        `diy_killers_laundry_room_escape_${ctx.sourceCardUid}_${ctx.now}`,
        host.minion.controller,
        '躲藏在洗衣间：弃置一张手牌并移动该仆从，或让其面临摧毁',
        [
            createSkipOption('不弃牌移动', 'ui.skip'),
            ...hand.flatMap(card => safeBases.map(({ base, baseIndex }) => ({
                id: `escape-${card.uid}-${baseIndex}`,
                label: `弃置${getCardName(card.defId)}，移动到${base.defId}`,
                value: {
                    mode: 'escape',
                    discardCardUid: card.uid,
                    minionUid: host.minion.uid,
                    minionDefId: host.minion.defId,
                    fromBaseIndex: host.baseIndex,
                    toBaseIndex: baseIndex,
                    toBaseDefId: base.defId,
                },
                displayMode: 'card' as const,
            }))),
        ],
        { sourceId: 'diy_killers_laundry_room_escape', targetType: 'generic', titleKey: 'ui.diy_killers_laundry_room_escape_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = context;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const laundryRoomEscapeHandler: InteractionHandler = (state, _playerId, value, data, _random, timestamp) => {
    const context = data?.continuationContext as LaundryRoomContext | undefined;
    if (!context) return { state, events: [] };
    const selected = value as {
        skip?: boolean;
        mode?: 'escape';
        discardCardUid?: string;
        minionUid?: string;
        minionDefId?: string;
        fromBaseIndex?: number;
        toBaseIndex?: number;
        toBaseDefId?: string;
    } | undefined;
    if (
        selected?.mode === 'escape'
        && selected.discardCardUid
        && selected.minionUid === context.hostMinionUid
        && selected.minionDefId === context.hostMinionDefId
        && selected.fromBaseIndex === context.sourceBaseIndex
        && selected.toBaseIndex !== undefined
        && state.core.players[context.hostControllerId]?.hand.some(card => card.uid === selected.discardCardUid)
    ) {
        return {
            state,
            events: [
                discardFromHand(context.hostControllerId, [selected.discardCardUid], timestamp),
                ...buildValidatedBaseMoveEvents(state, {
                    minionUid: context.hostMinionUid,
                    minionDefId: context.hostMinionDefId,
                    fromBaseIndex: context.sourceBaseIndex,
                    toBaseIndex: selected.toBaseIndex,
                    toBaseDefId: selected.toBaseDefId,
                    reason: 'diy_killers_laundry_room_escape',
                    now: timestamp,
                    sourcePlayerId: context.hostControllerId,
                    sourceDefId: 'diy_killers_laundry_room',
                    sourceControllerId: context.sourceControllerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                }),
            ],
        };
    }
    return {
        state: queueLaundryRoomDestroyPrompt(state, context.sourceControllerId, context, timestamp),
        events: [],
    };
};

const laundryRoomDestroyHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const context = data?.continuationContext as LaundryRoomContext | undefined;
    const selected = value as { mode?: 'destroy'; minionUid?: string; defId?: string; baseIndex?: number } | undefined;
    const live = context ? findMinionByUid(state.core, context.hostMinionUid) : undefined;
    if (!context || !live || selected?.mode !== 'destroy' || selected.minionUid !== context.hostMinionUid) {
        return { state, events: [] };
    }
    return {
        state,
        events: buildValidatedDestroyEvents(state, {
            minionUid: live.minion.uid,
            minionDefId: live.minion.defId,
            fromBaseIndex: live.baseIndex,
            destroyerId: playerId,
            reason: 'diy_killers_laundry_room',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceCardUid: context.attachedCardUid,
            sourceDefId: 'diy_killers_laundry_room',
            sourceControllerId: playerId,
            sourceBaseIndex: live.baseIndex,
            sourceKind: 'action',
        }),
    };
};

function savageAttackTargets(core: SmashUpCore, playerId: PlayerId) {
    return core.bases.flatMap((base, baseIndex) => {
        const hasOwnMinion = base.minions.some(minion => minion.controller === playerId);
        if (!hasOwnMinion) return [];
        return base.minions
            .filter(minion => minion.basePower <= 3)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardName(minion.defId)} (印刷力量 ${minion.basePower})`,
            }));
    });
}

function diyKillersSavageAttack(ctx: AbilityContext): AbilityResult {
    const targets = savageAttackTargets(ctx.state, ctx.playerId);
    if (targets.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_killers_savage_attack_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择要摧毁的印刷力量≤3仆从',
        [
            ...buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
            createSkipOption('跳过（不摧毁）', 'ui.skip_destroy_minion'),
        ],
        { sourceId: 'diy_killers_savage_attack', targetType: 'minion', titleKey: 'ui.diy_killers_savage_attack_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function queueSavageAttackBoostPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    baseIndex: number,
    destroyedMinionUid: string | undefined,
    timestamp: number,
): MatchState<SmashUpCore> | undefined {
    const base = state.core.bases[baseIndex];
    if (!base) return undefined;
    const killers = base.minions
        .filter(minion => minion.uid !== destroyedMinionUid && minion.controller === playerId && isKillerMinion(minion.defId))
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardName(minion.defId),
        }));
    if (killers.length === 0) return undefined;
    const interaction = createSimpleChoice(
        `diy_killers_savage_attack_boost_${timestamp}`,
        playerId,
        '选择获得 +3 力量的杀人狂',
        [
            ...buildMinionTargetOptions(killers, { state: state.core, sourcePlayerId: playerId, effectType: 'power_change' }),
            createSkipOption('跳过（不加力量）', 'ui.skip'),
        ],
        { sourceId: 'diy_killers_savage_attack_boost', targetType: 'minion', titleKey: 'ui.diy_killers_savage_attack_boost_title' },
    );
    return queueInteraction(state, interaction);
}

const savageAttackHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { state, events: [] };
    const events = buildValidatedDestroyEvents(state, {
        minionUid: selected.minionUid,
        minionDefId: selected.defId,
        fromBaseIndex: selected.baseIndex,
        destroyerId: playerId,
        reason: 'diy_killers_savage_attack',
        now: timestamp,
        sourcePlayerId: playerId,
        sourceDefId: 'diy_killers_savage_attack',
        sourceControllerId: playerId,
        sourceBaseIndex: selected.baseIndex,
        sourceKind: 'action',
    });
    const nextState = events.length > 0
        ? queueSavageAttackBoostPrompt(state, playerId, selected.baseIndex, selected.minionUid, timestamp)
        : undefined;
    return { state: nextState ?? state, events };
};

const savageAttackBoostHandler: InteractionHandler = (state, _playerId, value, _data, _random, timestamp) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    return { state, events: [addTempPower(selected.minionUid, selected.baseIndex, 3, 'diy_killers_savage_attack', timestamp)] };
};

function diyKillersMacheteTalent(ctx: AbilityContext): AbilityResult {
    const host = findMinionByAttachedCard(ctx.state, ctx.cardUid);
    if (!host || host.minion.controller !== ctx.playerId) return { events: [] };
    const targetBases = ctx.state.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ base, baseIndex }) => baseIndex !== host.baseIndex && base.minions.some(minion => minion.controller !== ctx.playerId));
    if (targetBases.length === 0) return { events: [] };
    if (targetBases.length === 1) {
        return {
            events: buildValidatedBaseMoveEvents(ctx.matchState, {
                minionUid: host.minion.uid,
                minionDefId: host.minion.defId,
                fromBaseIndex: host.baseIndex,
                toBaseIndex: targetBases[0].baseIndex,
                toBaseDefId: targetBases[0].base.defId,
                reason: 'diy_killers_machete',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'diy_killers_machete',
                sourceBaseIndex: host.baseIndex,
            }),
        };
    }
    const interaction = createSimpleChoice(
        `diy_killers_machete_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择大砍刀移动目标基地',
        targetBases.map(({ base, baseIndex }) => ({
            id: `base-${baseIndex}`,
            label: base.defId,
            value: {
                minionUid: host.minion.uid,
                minionDefId: host.minion.defId,
                fromBaseIndex: host.baseIndex,
                toBaseIndex: baseIndex,
                toBaseDefId: base.defId,
            },
            displayMode: 'card' as const,
        })),
        { sourceId: 'diy_killers_machete', targetType: 'base', titleKey: 'ui.diy_killers_machete_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const macheteHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    const selected = value as {
        minionUid?: string;
        minionDefId?: string;
        fromBaseIndex?: number;
        toBaseIndex?: number;
        toBaseDefId?: string;
    } | undefined;
    if (!selected?.minionUid || !selected.minionDefId || selected.fromBaseIndex === undefined || selected.toBaseIndex === undefined) {
        return { state, events: [] };
    }
    return {
        state,
        events: buildValidatedBaseMoveEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId,
            fromBaseIndex: selected.fromBaseIndex,
            toBaseIndex: selected.toBaseIndex,
            toBaseDefId: selected.toBaseDefId,
            reason: 'diy_killers_machete',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'diy_killers_machete',
            sourceBaseIndex: selected.fromBaseIndex,
        }),
    };
};

function minionsOnBaseAtOrBelowPower(core: SmashUpCore, baseIndex: number, maxPower: number, excludeUid?: string) {
    const base = core.bases[baseIndex];
    if (!base) return [];
    return base.minions
        .filter(minion => minion.uid !== excludeUid && getEffectivePower(core, minion, baseIndex) <= maxPower)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardName(minion.defId)} (力量 ${getEffectivePower(core, minion, baseIndex)})`,
        }));
}

function diyKillersFreddyTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const expiresOnTurnNumber = nextPlayerTurnStartExpiration(ctx.state, ctx.playerId);
    const events = base.minions
        .filter(minion => minion.controller !== ctx.playerId)
        .map(minion => addPermanentPower(minion.uid, ctx.baseIndex, -1, 'diy_killers_freddy_krueger', ctx.now, {
            expiresOnTurnNumber,
            expiresOnPlayerId: ctx.playerId,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: 'diy_killers_freddy_krueger',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }));
    const targets = base.minions
        .filter(minion => getEffectivePower(ctx.state, minion, ctx.baseIndex) + (minion.controller !== ctx.playerId ? -1 : 0) <= 1)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: `${getCardName(minion.defId)} (力量 ${getEffectivePower(ctx.state, minion, ctx.baseIndex)})`,
        }));
    if (targets.length === 0) return { events };
    const interaction = createSimpleChoice(
        `diy_killers_freddy_krueger_destroy_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '弗莱迪·克鲁格：选择是否摧毁这里力量≤1的仆从',
        [
            createSkipOption('不摧毁', 'ui.skip'),
            ...buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        ],
        { sourceId: 'diy_killers_freddy_krueger_destroy', targetType: 'minion', titleKey: 'ui.diy_killers_freddy_krueger_destroy_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = {
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    };
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

const freddyDestroyHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const context = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
    const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { state, events: [] };
    const events = buildValidatedDestroyEvents(state, {
        minionUid: selected.minionUid,
        minionDefId: selected.defId,
        fromBaseIndex: selected.baseIndex,
        destroyerId: playerId,
        reason: 'diy_killers_freddy_krueger',
        now: timestamp,
        sourcePlayerId: playerId,
        sourceCardUid: context?.sourceCardUid,
        sourceDefId: 'diy_killers_freddy_krueger',
        sourceControllerId: playerId,
        sourceBaseIndex: selected.baseIndex,
        sourceKind: 'nonAction',
    });
    events.push(...markMacheteHostDestroyedIfAttached(state.core, context?.sourceCardUid, context?.sourceBaseIndex, timestamp));
    return {
        state,
        events,
    };
};

function diyKillersClawedGloveTalent(ctx: AbilityContext): AbilityResult {
    const host = findMinionByAttachedCard(ctx.state, ctx.cardUid);
    if (!host) return { events: [] };
    const targets = ctx.state.bases[host.baseIndex]?.minions.map(minion => ({
        uid: minion.uid,
        defId: minion.defId,
        baseIndex: host.baseIndex,
        label: getCardName(minion.defId),
    })) ?? [];
    if (targets.length === 0) return { events: [] };
    if (targets.length === 1) {
        return {
            events: [addPermanentPower(targets[0].uid, host.baseIndex, -1, 'diy_killers_clawed_glove', ctx.now, {
                expiresOnTurnNumber: nextPlayerTurnStartExpiration(ctx.state, ctx.playerId),
                expiresOnPlayerId: ctx.playerId,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: 'diy_killers_clawed_glove',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: host.baseIndex,
            })],
        };
    }
    const interaction = createSimpleChoice(
        `diy_killers_clawed_glove_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '爪子手套：选择获得 -1 力量直到你下回合开始的仆从',
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'power_change' }),
        { sourceId: 'diy_killers_clawed_glove', targetType: 'minion', titleKey: 'ui.diy_killers_clawed_glove_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const clawedGloveHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [addPermanentPower(selected.minionUid, selected.baseIndex, -1, 'diy_killers_clawed_glove', timestamp, {
            expiresOnTurnNumber: nextPlayerTurnStartExpiration(state.core, playerId),
            expiresOnPlayerId: playerId,
            sourcePlayerId: playerId,
            sourceDefId: 'diy_killers_clawed_glove',
            sourceControllerId: playerId,
            sourceBaseIndex: selected.baseIndex,
        })],
    };
};

function diyKillersPinheadTalent(ctx: AbilityContext): AbilityResult {
    const transferOptions = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions.flatMap(sourceMinion =>
            sourceMinion.attachedActions
                .filter(action => getAttachedActionControllerId(action) === ctx.playerId)
                .flatMap(action =>
                    ctx.state.bases.flatMap((targetBase, targetBaseIndex) =>
                        targetBase.minions
                            .filter(targetMinion => targetMinion.uid !== sourceMinion.uid)
                            .map(targetMinion => ({
                                id: `transfer-${action.uid}-${targetMinion.uid}`,
                                label: `转移${getCardName(action.defId)}到${getCardName(targetMinion.defId)}`,
                                value: {
                                    mode: 'transfer',
                                    cardUid: action.uid,
                                    defId: action.defId,
                                    ownerId: action.ownerId,
                                    fromBaseIndex: baseIndex,
                                    targetBaseIndex,
                                    targetMinionUid: targetMinion.uid,
                                },
                                displayMode: 'card' as const,
                            })),
                    ),
                ),
        ),
    );
    const destroyOptions = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.attachedActions.some(action => action.defId === 'diy_killers_hell_puzzle_box'))
            .map(minion => ({
                id: `destroy-${minion.uid}`,
                label: `摧毁${getCardName(minion.defId)}`,
                value: { mode: 'destroy', minionUid: minion.uid, defId: minion.defId, baseIndex },
                displayMode: 'card' as const,
            })),
    );
    const options = [...transferOptions, ...destroyOptions];
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_killers_pinhead_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '钉子头：转移一个你的行动，或摧毁带有地狱魔盒的仆从',
        options,
        { sourceId: 'diy_killers_pinhead', targetType: 'generic', titleKey: 'ui.diy_killers_pinhead_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = {
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const pinheadHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const context = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
    const selected = value as {
        mode?: 'transfer' | 'destroy';
        cardUid?: string;
        defId?: string;
        ownerId?: PlayerId;
        targetBaseIndex?: number;
        targetMinionUid?: string;
        minionUid?: string;
        baseIndex?: number;
    } | undefined;
    if (selected?.mode === 'transfer' && selected.cardUid && selected.defId && selected.ownerId && selected.targetBaseIndex !== undefined && selected.targetMinionUid) {
        return {
            state,
            events: buildSemanticOngoingAttachEvents(state, {
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: selected.ownerId,
                sourcePlayerId: playerId,
                sourceKind: 'nonAction',
                targetBaseIndex: selected.targetBaseIndex,
                targetMinionUid: selected.targetMinionUid,
                now: timestamp,
            }),
        };
    }
    if (selected?.mode === 'destroy' && selected.minionUid && selected.defId && selected.baseIndex !== undefined) {
        const events = buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId,
            reason: 'diy_killers_pinhead',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceCardUid: context?.sourceCardUid,
            sourceDefId: 'diy_killers_pinhead',
            sourceControllerId: playerId,
            sourceBaseIndex: selected.baseIndex,
            sourceKind: 'nonAction',
        });
        events.push(...markMacheteHostDestroyedIfAttached(state.core, context?.sourceCardUid, context?.sourceBaseIndex, timestamp));
        return {
            state,
            events,
        };
    }
    return { state, events: [] };
};

function leatherfaceCounterTrigger(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return { events: [] };
    if (ctx.triggerMinionUid !== ctx.sourceCardUid || ctx.counterChangeKind !== 'added' || (ctx.counterDelta ?? 0) <= 0) return { events: [] };
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source || Number(source.metadata?.diyKillersLeatherfaceUsedTurn ?? -1) === ctx.state.turnNumber || !ctx.matchState) {
        return { events: [] };
    }
    const targets = minionsOnBaseAtOrBelowPower(ctx.state, ctx.sourceBaseIndex, 3, ctx.sourceCardUid);
    if (targets.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_killers_leatherface_destroy_${ctx.sourceCardUid}_${ctx.now}`,
        ctx.sourceControllerId,
        '人皮脸：选择是否摧毁这里力量≤3的仆从',
        [
            createSkipOption('不摧毁', 'ui.skip'),
            ...buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.sourceControllerId, effectType: 'destroy' }),
        ],
        { sourceId: 'diy_killers_leatherface_destroy', targetType: 'minion', titleKey: 'ui.diy_killers_leatherface_destroy_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = {
        sourceCardUid: ctx.sourceCardUid,
        sourceBaseIndex: ctx.sourceBaseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const leatherfaceDestroyHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const context = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
    const events: SmashUpEvent[] = [];
    if (context?.sourceCardUid && context.sourceBaseIndex !== undefined) {
        events.push(minionMetadataUpdated(
            context.sourceCardUid,
            context.sourceBaseIndex,
            { diyKillersLeatherfaceUsedTurn: state.core.turnNumber },
            'diy_killers_leatherface',
            timestamp,
        ));
    }
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events };
    const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { state, events };
    events.push(...buildValidatedDestroyEvents(state, {
        minionUid: selected.minionUid,
        minionDefId: selected.defId,
        fromBaseIndex: selected.baseIndex,
        destroyerId: playerId,
        reason: 'diy_killers_leatherface',
        now: timestamp,
        sourcePlayerId: playerId,
        sourceCardUid: context?.sourceCardUid,
        sourceDefId: 'diy_killers_leatherface',
        sourceControllerId: playerId,
        sourceBaseIndex: selected.baseIndex,
        sourceKind: 'nonAction',
    }));
    events.push(...markMacheteHostDestroyedIfAttached(state.core, context?.sourceCardUid, context?.sourceBaseIndex, timestamp));
    return { state, events };
};

function jasonMoveTrigger(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || ctx.moveToBaseIndex === undefined || !ctx.matchState) return { events: [] };
    if (ctx.triggerMinionUid !== ctx.sourceCardUid) return { events: [] };
    const source = ctx.state.bases[ctx.moveToBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source || Number(source.metadata?.diyKillersJasonUsedTurn ?? -1) === ctx.state.turnNumber) return { events: [] };
    const targets = minionsOnBaseAtOrBelowPower(ctx.state, ctx.moveToBaseIndex, 3, ctx.sourceCardUid);
    if (targets.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_killers_jason_destroy_${ctx.sourceCardUid}_${ctx.now}`,
        ctx.sourceControllerId,
        '杰森：选择是否摧毁这里力量≤3的仆从',
        [
            createSkipOption('不摧毁', 'ui.skip'),
            ...buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.sourceControllerId, effectType: 'destroy' }),
        ],
        { sourceId: 'diy_killers_jason_destroy', targetType: 'minion', titleKey: 'ui.diy_killers_jason_destroy_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = {
        sourceCardUid: ctx.sourceCardUid,
        sourceBaseIndex: ctx.moveToBaseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const jasonDestroyHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const context = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
    const events: SmashUpEvent[] = [];
    if (context?.sourceCardUid && context.sourceBaseIndex !== undefined) {
        events.push(minionMetadataUpdated(
            context.sourceCardUid,
            context.sourceBaseIndex,
            { diyKillersJasonUsedTurn: state.core.turnNumber },
            'diy_killers_jason',
            timestamp,
        ));
    }
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events };
    const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined || !context?.sourceCardUid || context.sourceBaseIndex === undefined) {
        return { state, events };
    }
    events.push(...buildValidatedDestroyEvents(state, {
        minionUid: selected.minionUid,
        minionDefId: selected.defId,
        fromBaseIndex: selected.baseIndex,
        destroyerId: playerId,
        reason: 'diy_killers_jason',
        now: timestamp,
        sourcePlayerId: playerId,
        sourceCardUid: context.sourceCardUid,
        sourceDefId: 'diy_killers_jason',
        sourceControllerId: playerId,
        sourceBaseIndex: selected.baseIndex,
        sourceKind: 'nonAction',
    }));
    events.push(...markMacheteHostDestroyedIfAttached(state.core, context.sourceCardUid, context.sourceBaseIndex, timestamp));
    events.push(addTempPower(context.sourceCardUid, context.sourceBaseIndex, 2, 'diy_killers_jason', timestamp, {
        sourcePlayerId: playerId,
        sourceCardUid: context.sourceCardUid,
        sourceDefId: 'diy_killers_jason',
        sourceControllerId: playerId,
        sourceBaseIndex: context.sourceBaseIndex,
    }));
    return { state, events };
};

function captainKirkMaskTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    const host = findHostByAttachedCardUid(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.sourceBaseIndex || host.minion.uid === ctx.triggerMinionUid) return [];
    const amount = ctx.triggerMinionPower ?? (ctx.triggerMinion ? getEffectivePower(ctx.state, ctx.triggerMinion, ctx.sourceBaseIndex) : 0);
    if (amount <= 0) return [];
    return [addTempPower(host.minion.uid, host.baseIndex, amount, 'diy_killers_captain_kirk_mask', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'diy_killers_captain_kirk_mask',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: host.baseIndex,
    })];
}

function chainsawTurnStart(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    const host = findHostByAttachedCardUid(ctx.state, ctx.sourceCardUid);
    if (!host) return [];
    return [addPowerCounter(host.minion.uid, host.baseIndex, 1, 'diy_killers_chainsaw', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'diy_killers_chainsaw',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: host.baseIndex,
    })];
}

function chainsawDestroyTrigger(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || ctx.baseIndex === undefined || !ctx.matchState) return { events: [] };
    const host = findHostByAttachedCardUid(ctx.state, ctx.sourceCardUid);
    if (!host || ctx.state.bases.length <= 1) return { events: [] };
    const targets = host.baseIndex === ctx.baseIndex
        ? ctx.state.bases
            .map((base, baseIndex) => ({ base, baseIndex }))
            .filter(({ baseIndex }) => baseIndex !== host.baseIndex)
        : [{ base: ctx.state.bases[ctx.baseIndex], baseIndex: ctx.baseIndex }];
    if (targets.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_killers_chainsaw_move_${ctx.sourceCardUid}_${ctx.now}`,
        ctx.sourceControllerId,
        '电锯：选择是否移动宿主',
        [
            createSkipOption('不移动', 'ui.skip'),
            ...targets.map(({ base, baseIndex }) => ({
                id: `base-${baseIndex}`,
                label: base.defId,
                value: {
                    minionUid: host.minion.uid,
                    minionDefId: host.minion.defId,
                    fromBaseIndex: host.baseIndex,
                    toBaseIndex: baseIndex,
                    toBaseDefId: base.defId,
                },
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: 'diy_killers_chainsaw_move', targetType: 'base', titleKey: 'ui.diy_killers_chainsaw_move_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const chainsawMoveHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const selected = value as {
        minionUid?: string;
        minionDefId?: string;
        fromBaseIndex?: number;
        toBaseIndex?: number;
        toBaseDefId?: string;
    } | undefined;
    if (!selected?.minionUid || !selected.minionDefId || selected.fromBaseIndex === undefined || selected.toBaseIndex === undefined) {
        return { state, events: [] };
    }
    return {
        state,
        events: buildValidatedBaseMoveEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId,
            fromBaseIndex: selected.fromBaseIndex,
            toBaseIndex: selected.toBaseIndex,
            toBaseDefId: selected.toBaseDefId,
            reason: 'diy_killers_chainsaw',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'diy_killers_chainsaw',
            sourceBaseIndex: selected.fromBaseIndex,
        }),
    };
};

function clawedGloveDestroyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    const host = findHostByAttachedCardUid(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.sourceBaseIndex) return [];
    return [addPowerCounter(host.minion.uid, host.baseIndex, 1, 'diy_killers_clawed_glove', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'diy_killers_clawed_glove',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: host.baseIndex,
    })];
}

function macheteDestroyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    const host = findHostByAttachedCardUid(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.sourceBaseIndex) return [];
    const base = ctx.state.bases[host.baseIndex];
    const events = base.minions
        .filter(minion => minion.controller === ctx.sourceControllerId)
        .map(minion => addTempPower(minion.uid, host.baseIndex, 1, 'diy_killers_machete', ctx.now, {
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: 'diy_killers_machete',
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: host.baseIndex,
        }));
    if (ctx.destroyerId === host.minion.controller && ctx.reason?.startsWith('diy_killers_') && ctx.sourceCardUid === host.minion.uid) {
        events.push(minionMetadataUpdated(
            host.minion.uid,
            host.baseIndex,
            { diyKillersMacheteHostDestroyedTurn: ctx.state.turnNumber },
            'diy_killers_machete',
            ctx.now,
        ));
    }
    return events;
}

function macheteTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    const host = findHostByAttachedCardUid(ctx.state, ctx.sourceCardUid);
    if (!host || host.minion.metadata?.diyKillersMacheteHostDestroyedTurn !== ctx.state.turnNumber) return [];
    return buildValidatedOngoingDetachEvents(ctx.state, {
        cardUid: ctx.sourceCardUid,
        reason: 'diy_killers_machete_return',
        destination: 'hand',
        sourcePlayerId: ctx.sourceControllerId ?? host.minion.controller,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'diy_killers_machete',
        sourceControllerId: ctx.sourceControllerId ?? host.minion.controller,
        sourceBaseIndex: host.baseIndex,
        now: ctx.now,
    });
}

function hellPuzzleBoxSuppression(state: SmashUpCore): string[] {
    const suppressed: string[] = [];
    for (const base of state.bases) {
        for (const minion of base.minions) {
            const box = minion.attachedActions.find(action => action.defId === 'diy_killers_hell_puzzle_box');
            if (!box) continue;
            const controllerId = getAttachedActionControllerId(box);
            if (minion.controller !== controllerId) suppressed.push(minion.uid);
        }
    }
    return suppressed;
}

function hellPuzzleBoxDestroyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function michaelMyersBeforeScoring(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.matchState) return { events: [] };
    const targets = (ctx.state.bases[ctx.sourceBaseIndex]?.minions ?? [])
        .filter(minion => minion.basePower <= 3)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.sourceBaseIndex!,
            label: `${getCardName(minion.defId)} (印刷力量 ${minion.basePower})`,
        }));
    if (targets.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_killers_michael_myers_${ctx.sourceCardUid}_${ctx.now}`,
        ctx.sourceControllerId,
        '麦克尔·麦尔斯：选择是否摧毁这里印刷力量≤3的仆从',
        [
            createSkipOption('不摧毁', 'ui.skip'),
            ...buildFieldSourceToMinionTargetOptions(
                {
                    type: 'minion',
                    uid: ctx.sourceCardUid,
                    defId: 'diy_killers_michael_myers',
                    baseIndex: ctx.sourceBaseIndex,
                },
                targets,
                { state: ctx.state, sourcePlayerId: ctx.sourceControllerId, effectType: 'destroy' },
            ),
        ],
        buildFieldSourceTargetPromptConfig({
            sourceId: 'diy_killers_michael_myers',
            titleKey: 'ui.diy_killers_michael_myers_title',
        }),
    );
    (interaction.data as Record<string, unknown>).continuationContext = {
        sourceCardUid: ctx.sourceCardUid,
        sourceBaseIndex: ctx.sourceBaseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const michaelMyersHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const context = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
    const selected = value as {
        minionUid?: string;
        targetMinionUid?: string;
        targetUid?: string;
        defId?: string;
        minionDefId?: string;
        targetMinionDefId?: string;
        targetDefId?: string;
        baseIndex?: number;
    } | undefined;
    const targetMinionUid = selected?.targetMinionUid ?? selected?.targetUid ?? selected?.minionUid;
    const targetDefId = selected?.targetMinionDefId ?? selected?.targetDefId ?? selected?.minionDefId ?? selected?.defId;
    if (!targetMinionUid || !targetDefId || selected?.baseIndex === undefined) return { state, events: [] };
    const events = buildValidatedDestroyEvents(state, {
        minionUid: targetMinionUid,
        minionDefId: targetDefId,
        fromBaseIndex: selected.baseIndex,
        destroyerId: playerId,
        reason: 'diy_killers_michael_myers',
        now: timestamp,
        sourcePlayerId: playerId,
        sourceCardUid: context?.sourceCardUid,
        sourceDefId: 'diy_killers_michael_myers',
        sourceControllerId: playerId,
        sourceBaseIndex: context?.sourceBaseIndex ?? selected.baseIndex,
        sourceKind: 'nonAction',
    });
    events.push(...markMacheteHostDestroyedIfAttached(state.core, context?.sourceCardUid, context?.sourceBaseIndex, timestamp));
    return {
        state,
        events,
    };
};

function campCrystalLakePowerTargets(core: SmashUpCore, baseIndex: number) {
    const base = core.bases[baseIndex];
    if (!base) return [];
    return base.minions.map(minion => ({
        uid: minion.uid,
        defId: minion.defId,
        baseIndex,
        label: getCardName(minion.defId),
    }));
}

function campCrystalLakeDestroyTargets(core: SmashUpCore, playerId: PlayerId, baseIndex: number) {
    const maxPower = countPlayerCardsAtBase(core, playerId, baseIndex);
    const base = core.bases[baseIndex];
    if (!base || maxPower <= 0) return [];
    return base.minions
        .filter(minion => getEffectivePower(core, minion, baseIndex) <= maxPower)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardName(minion.defId)} (力量 ${getEffectivePower(core, minion, baseIndex)} / 牌数 ${maxPower})`,
        }));
}

function campCrystalLakeAfterDestroy(ctx: BaseAbilityContext): BaseAbilityResult {
    const amount = ctx.minionPower ?? 0;
    if (!ctx.destroyerId || amount <= 0) return { events: [] };
    const targets = campCrystalLakePowerTargets(ctx.state, ctx.baseIndex);
    if (targets.length === 0) return { events: [] };
    if (targets.length === 1) {
        return {
            events: [addTempPower(targets[0].uid, ctx.baseIndex, amount, 'base_diy_killers_camp_crystal_lake', ctx.now, {
                sourcePlayerId: ctx.destroyerId,
                sourceDefId: 'base_diy_killers_camp_crystal_lake',
                sourceControllerId: ctx.destroyerId,
                sourceBaseIndex: ctx.baseIndex,
            })],
        };
    }
    if (!ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice(
        `base_diy_killers_camp_crystal_lake_power_${ctx.baseIndex}_${ctx.now}`,
        ctx.destroyerId,
        `水晶湖营地：选择获得 +${amount} 力量的仆从`,
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.destroyerId, effectType: 'power_change' }),
        { sourceId: 'base_diy_killers_camp_crystal_lake_power', targetType: 'minion', titleKey: 'ui.base_diy_killers_camp_crystal_lake_power_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = {
        amount,
        baseIndex: ctx.baseIndex,
        sourcePlayerId: ctx.destroyerId,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const campCrystalLakePowerHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const context = data?.continuationContext as { amount?: number; baseIndex?: number; sourcePlayerId?: PlayerId } | undefined;
    const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
    const amount = context?.amount ?? 0;
    const sourcePlayerId = context?.sourcePlayerId ?? playerId;
    if (!selected?.minionUid || selected.baseIndex === undefined || amount <= 0) return { state, events: [] };
    return {
        state,
        events: [addTempPower(selected.minionUid, selected.baseIndex, amount, 'base_diy_killers_camp_crystal_lake', timestamp, {
            sourcePlayerId,
            sourceDefId: 'base_diy_killers_camp_crystal_lake',
            sourceControllerId: sourcePlayerId,
            sourceBaseIndex: context?.baseIndex ?? selected.baseIndex,
        })],
    };
};

function campCrystalLakeCardPlayed(ctx: BaseAbilityContext): BaseAbilityResult {
    if ((ctx.state.usedBaseAbilitiesThisTurn ?? []).some(entry =>
        entry.playerId === ctx.playerId && entry.baseIndex === ctx.baseIndex && entry.baseDefId === ctx.baseDefId,
    )) {
        return { events: [] };
    }
    const targets = campCrystalLakeDestroyTargets(ctx.state, ctx.playerId, ctx.baseIndex);
    if (targets.length === 0 || !ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice(
        `base_diy_killers_camp_crystal_lake_destroy_${ctx.baseIndex}_${ctx.now}`,
        ctx.playerId,
        '水晶湖营地：选择是否摧毁这里的仆从',
        [
            createSkipOption('不摧毁', 'ui.skip'),
            ...buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        ],
        { sourceId: 'base_diy_killers_camp_crystal_lake_destroy', targetType: 'minion', titleKey: 'ui.base_diy_killers_camp_crystal_lake_destroy_title' },
    );
    (interaction.data as Record<string, unknown>).continuationContext = {
        playerId: ctx.playerId,
        baseIndex: ctx.baseIndex,
        baseDefId: ctx.baseDefId,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const campCrystalLakeDestroyHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const context = data?.continuationContext as { playerId?: PlayerId; baseIndex?: number; baseDefId?: string } | undefined;
    const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined || context?.baseIndex === undefined || !context.baseDefId) {
        return { state, events: [] };
    }
    return {
        state,
        events: [
            baseAbilityUsed(context.playerId ?? playerId, context.baseIndex, context.baseDefId, timestamp),
            ...buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.playerId ?? playerId,
                reason: 'base_diy_killers_camp_crystal_lake',
                now: timestamp,
                sourcePlayerId: context.playerId ?? playerId,
                sourceDefId: 'base_diy_killers_camp_crystal_lake',
                sourceControllerId: context.playerId ?? playerId,
                sourceBaseIndex: context.baseIndex,
                sourceKind: 'nonAction',
            }),
        ],
    };
};

function nightmareWorldBeforeScoring(ctx: { state: SmashUpCore; baseIndex: number; now: number; playerId: PlayerId }): { events: SmashUpEvent[] } {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || base.minions.length === 0) return { events: [] };
    const minPower = Math.min(...base.minions.map(minion => getEffectivePower(ctx.state, minion, ctx.baseIndex)));
    const targets = base.minions.filter(minion => getEffectivePower(ctx.state, minion, ctx.baseIndex) === minPower);
    return {
        events: targets.flatMap(minion => buildValidatedDestroyEvents(ctx.state, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: ctx.baseIndex,
            destroyerId: ctx.playerId,
            reason: 'base_diy_killers_nightmare_world',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'base_diy_killers_nightmare_world',
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'nonAction',
        })),
    };
}

export function registerDiyKillersAbilities(): void {
    registerAbility('diy_killers_leatherface', 'onPlay', diyKillersSignatureSearch);
    registerAbility('diy_killers_freddy_krueger', 'onPlay', diyKillersSignatureSearch);
    registerAbility('diy_killers_jason', 'onPlay', diyKillersSignatureSearch);
    registerAbility('diy_killers_michael_myers', 'onPlay', diyKillersSignatureSearch);
    registerAbility('diy_killers_pinhead', 'onPlay', diyKillersSignatureSearch);
    registerAbility('diy_killers_freddy_krueger', 'talent', diyKillersFreddyTalent);
    registerAbility('diy_killers_pinhead', 'talent', diyKillersPinheadTalent);

    registerAbility('diy_killers_savage_attack', 'onPlay', diyKillersSavageAttack);
    registerAbility('diy_killers_cha_cha_cha_ha_ha_ha', 'onPlay', diyKillersChacha);
    registerAbility('diy_killers_good_boy', 'onPlay', diyKillersGoodBoy);
    registerAbility('diy_killers_laundry_room', 'onPlay', diyKillersLaundryRoom);
    registerAbility('diy_killers_improvised_weapon', 'onPlay', diyKillersImprovisedWeapon);
    registerAbility('diy_killers_oh_no', 'onPlay', diyKillersOhNo);
    registerAbility('diy_killers_origin_story', 'onPlay', diyKillersOriginStory);
    registerAbility('diy_killers_is_it_over', 'onPlay', diyKillersIsItOver);
    registerAbility('diy_killers_clawed_glove', 'talent', diyKillersClawedGloveTalent);
    registerAbility('diy_killers_machete', 'talent', diyKillersMacheteTalent);

    registerInteractionHandler('diy_killers_signature_search', signatureSearchHandler);
    registerInteractionHandler('diy_killers_savage_attack', savageAttackHandler);
    registerInteractionHandler('diy_killers_savage_attack_boost', savageAttackBoostHandler);
    registerInteractionHandler('diy_killers_cha_cha_cha_ha_ha_ha', chachaChooseMinion);
    registerInteractionHandler('diy_killers_cha_cha_cha_ha_ha_ha_base', chachaChooseBase);
    registerInteractionHandler('diy_killers_cha_cha_cha_ha_ha_ha_followup', chachaFollowup);
    registerInteractionHandler('diy_killers_good_boy', goodBoyHandler);
    registerInteractionHandler('diy_killers_is_it_over', isItOverHandler);
    registerInteractionHandler('diy_killers_oh_no', ohNoHandler);
    registerInteractionHandler('diy_killers_laundry_room_escape', laundryRoomEscapeHandler);
    registerInteractionHandler('diy_killers_laundry_room_destroy', laundryRoomDestroyHandler);
    registerInteractionHandler('diy_killers_freddy_krueger_destroy', freddyDestroyHandler);
    registerInteractionHandler('diy_killers_clawed_glove', clawedGloveHandler);
    registerInteractionHandler('diy_killers_pinhead', pinheadHandler);
    registerInteractionHandler('diy_killers_leatherface_destroy', leatherfaceDestroyHandler);
    registerInteractionHandler('diy_killers_jason_destroy', jasonDestroyHandler);
    registerInteractionHandler('diy_killers_chainsaw_move', chainsawMoveHandler);
    registerInteractionHandler('diy_killers_machete', macheteHandler);
    registerInteractionHandler('diy_killers_michael_myers', michaelMyersHandler);
    registerInteractionHandler('base_diy_killers_camp_crystal_lake_power', campCrystalLakePowerHandler);
    registerInteractionHandler('base_diy_killers_camp_crystal_lake_destroy', campCrystalLakeDestroyHandler);

    registerTrigger('diy_killers_leatherface', 'onMinionAffected', leatherfaceCounterTrigger, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('diy_killers_jason', 'onMinionMoved', jasonMoveTrigger, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('diy_killers_michael_myers', 'beforeScoring', michaelMyersBeforeScoring, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger('diy_killers_oh_no', 'onMinionDestroyed', diyKillersOhNoSpecialTrigger, {
        optional: true,
        global: true,
        globalZones: ['hand'],
        playerContext: 'sourceController',
        canTrigger: ctx => !!ctx.sourceControllerId
            && ctx.destroyerId === ctx.sourceControllerId
            && ctx.controllerId !== ctx.sourceControllerId,
    });
    registerTrigger('diy_killers_captain_kirk_mask', 'onMinionDestroyed', captainKirkMaskTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('diy_killers_chainsaw', 'onTurnStart', chainsawTurnStart, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('diy_killers_chainsaw', 'onMinionDestroyed', chainsawDestroyTrigger, {
        optional: true,
        perInstance: true,
    });
    registerTrigger('diy_killers_clawed_glove', 'onMinionDestroyed', clawedGloveDestroyTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('diy_killers_laundry_room', 'onMinionPlayed', diyKillersLaundryRoomTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        canTrigger: ctx => !!ctx.triggerMinionDefId && isKillerMinion(ctx.triggerMinionDefId),
    });
    registerTrigger('diy_killers_laundry_room', 'onMinionMoved', diyKillersLaundryRoomTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        canTrigger: ctx => !!ctx.triggerMinionDefId
            && isKillerMinion(ctx.triggerMinionDefId)
            && ctx.moveToBaseIndex === ctx.sourceBaseIndex,
    });
    registerTrigger('diy_killers_machete', 'onMinionDestroyed', macheteDestroyTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('diy_killers_machete', 'onTurnEnd', macheteTurnEnd, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('diy_killers_hell_puzzle_box', 'onMinionDestroyed', hellPuzzleBoxDestroyTrigger, {
        perInstance: true,
    });
    registerCardAbilitySuppression('diy_killers_hell_puzzle_box', hellPuzzleBoxSuppression);

    const crystalLakeCanTrigger = (ctx: BaseAbilityContext) => (
        !(ctx.state.usedBaseAbilitiesThisTurn ?? []).some(entry =>
            entry.playerId === ctx.playerId && entry.baseIndex === ctx.baseIndex && entry.baseDefId === ctx.baseDefId,
        )
        && campCrystalLakeDestroyTargets(ctx.state, ctx.playerId, ctx.baseIndex).length > 0
    );

    registerBaseAbility(
        'base_diy_killers_camp_crystal_lake',
        'onMinionPlayed',
        campCrystalLakeCardPlayed,
        {
            mandatory: false,
            canTrigger: crystalLakeCanTrigger,
        },
    );
    registerBaseAbility(
        'base_diy_killers_camp_crystal_lake',
        'onActionPlayed',
        campCrystalLakeCardPlayed,
        {
            mandatory: false,
            canTrigger: crystalLakeCanTrigger,
        },
    );
    registerExtended(
        'base_diy_killers_camp_crystal_lake',
        'onMinionDestroyed',
        campCrystalLakeAfterDestroy,
        {
            ownerPlayerId: ctx => ctx.destroyerId,
            canTrigger: ctx => !!ctx.destroyerId
                && (ctx.minionPower ?? 0) > 0
                && campCrystalLakePowerTargets(ctx.state, ctx.baseIndex).length > 0,
        },
    );

    registerBaseAbility(
        'base_diy_killers_nightmare_world',
        'beforeScoring',
        ctx => nightmareWorldBeforeScoring(ctx),
        {
            mandatory: true,
            canTrigger: ctx => {
                const base = ctx.state.bases[ctx.baseIndex];
                return Boolean(base && base.minions.length > 0);
            },
        },
    );
}

