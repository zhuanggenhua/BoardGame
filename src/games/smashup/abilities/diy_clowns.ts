import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getCardDef } from '../data/cards';
import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler, type InteractionHandler } from '../domain/abilityInteractionHandlers';
import {
    addTempPower,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedBaseMoveEvents,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    recoverCardsFromDiscard,
    revealDeckTop,
} from '../domain/abilityHelpers';
import { registerBaseAbility } from '../domain/baseAbilities';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerDiscardActionPlayProvider } from '../domain/discardActionPlayability';
import { appendResolvedActionAbility } from '../domain/externalActionPlay';
import { collectLegalActionPlayTargets } from '../domain/playLegality';
import { registerTrigger, type TriggerContext, type TriggerResult } from '../domain/ongoingEffects';
import type {
    CardInstance,
    CardsDiscardedEvent,
    CardsDrawnEvent,
    CardsMilledEvent,
    DeckReorderedEvent,
    MinionMetadataUpdatedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type CardChoice = { cardUid?: string; defId?: string };
type MinionChoice = { minionUid?: string; defId?: string; baseIndex?: number };
type BananaPeelContext = {
    fromDiscard?: boolean;
    fromBaseIndex?: number;
    minions?: Array<{ minionUid: string; minionDefId: string }>;
};

function getCardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function isStandardAction(card: CardInstance): boolean {
    const def = getCardDef(card.defId);
    return def?.type === 'action' && def.subtype === 'standard';
}

function isAction(card: CardInstance): boolean {
    return getCardDef(card.defId)?.type === 'action';
}

function controlledMinionSources(core: SmashUpCore, playerId: PlayerId, defId: string) {
    return core.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId && minion.defId === defId)
            .map(minion => ({ minion, baseIndex })),
    );
}

function wasPlayedFromDiscard(ctx: AbilityContext): boolean {
    return ctx.fromDiscard === true;
}

function deckReordered(playerId: PlayerId, deckUids: string[], timestamp: number): DeckReorderedEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids },
        timestamp,
    };
}

function discardFromHand(playerId: PlayerId, cardUids: string[], timestamp: number): CardsDiscardedEvent {
    return {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids },
        timestamp,
    };
}

function millFromDeck(playerId: PlayerId, cardUids: string[], reason: string, timestamp: number): CardsMilledEvent {
    return {
        type: SU_EVENTS.CARDS_MILLED,
        payload: { playerId, cardUids, reason },
        timestamp,
    };
}

function drawSpecificCard(playerId: PlayerId, cardUid: string, timestamp: number): CardsDrawnEvent {
    return {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId, count: 1, cardUids: [cardUid] },
        timestamp,
    };
}

function minionMetadataUpdated(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    timestamp: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp,
    };
}

function buildDiscardStandardActionOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    sourceId: string,
    consumesNormalLimit: boolean,
) {
    const player = core.players[playerId];
    if (!player) return [];
    return player.discard.filter(isStandardAction).flatMap(card => {
        const targets = collectLegalActionPlayTargets(core, playerId, {
            defId: card.defId,
            effectiveHandSize: player.hand.length,
        });
        if (targets.mode === 'none' && targets.firstError) return [];
        if (targets.mode === 'base' && targets.baseIndices.length === 0) return [];
        if (targets.mode === 'minion' && targets.minionUids.length === 0) return [];
        return [{
            card,
            targetMode: targets.mode,
            allowedBaseIndices: targets.mode === 'none' ? [] : targets.baseIndices,
            ...(targets.mode === 'minion' ? { allowedMinionUids: targets.minionUids } : {}),
            consumesNormalLimit,
            sourceId,
            defId: card.defId,
            name: getCardName(card.defId),
        }];
    });
}

function buildCardOptions(cards: CardInstance[], source: 'hand' | 'deck' | 'discard' = 'hand') {
    return cards.map((card, index) => ({
        id: `card-${index}`,
        label: getCardName(card.defId),
        value: { cardUid: card.uid, defId: card.defId },
        _source: source,
        displayMode: 'card' as const,
    }));
}

function buildHandDiscardOptions(core: SmashUpCore, playerId: PlayerId) {
    return buildCardOptions(core.players[playerId]?.hand ?? [], 'hand');
}

function grantExtraActionIfFromDiscard(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    fromDiscard: boolean,
    sourceId: string,
    timestamp: number,
): SmashUpEvent[] {
    return fromDiscard
        ? [grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, sourceId)]
        : [];
}

function ownMinionSourceBases(core: SmashUpCore, playerId: PlayerId) {
    if (core.bases.length <= 1) return [];
    return core.bases
        .map((base, baseIndex) => ({
            base,
            baseIndex,
            ownMinions: base.minions.filter(minion => minion.controller === playerId),
        }))
        .filter(entry => entry.ownMinions.length > 0);
}

function diyClownsBananaPeel(ctx: AbilityContext): AbilityResult {
    const fromDiscard = wasPlayedFromDiscard(ctx);
    const sourceBases = ownMinionSourceBases(ctx.state, ctx.playerId);
    if (sourceBases.length === 0) {
        return {
            events: fromDiscard
                ? [grantContextualExtraAction({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'diy_clowns_banana_peel')]
                : [],
        };
    }

    const interaction = createSimpleChoice(
        `diy_clowns_banana_peel_source_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择香蕉皮移动的来源基地',
        sourceBases.map(({ base, baseIndex, ownMinions }) => ({
            id: `base-${baseIndex}`,
            label: `${base.defId} (${ownMinions.length})`,
            value: { fromBaseIndex: baseIndex },
            displayMode: 'button' as const,
        })),
        { sourceId: 'diy_clowns_banana_peel', targetType: 'base', autoResolveIfSingle: false, titleKey: 'ui.diy_clowns_banana_peel_title' },
    );
    interaction.data.continuationContext = { fromDiscard };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const bananaPeelChooseSourceBase: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const fromDiscard = (data?.continuationContext as BananaPeelContext | undefined)?.fromDiscard === true;
    const selected = value as { fromBaseIndex?: number } | undefined;
    if (selected?.fromBaseIndex === undefined) {
        return { state, events: grantExtraActionIfFromDiscard(state, playerId, fromDiscard, 'diy_clowns_banana_peel', timestamp) };
    }

    const base = state.core.bases[selected.fromBaseIndex];
    if (!base) {
        return { state, events: grantExtraActionIfFromDiscard(state, playerId, fromDiscard, 'diy_clowns_banana_peel', timestamp) };
    }
    const ownMinions = base.minions
        .filter(minion => minion.controller === playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: selected.fromBaseIndex!,
            label: getCardName(minion.defId),
        }));
    if (ownMinions.length === 0) {
        return { state, events: grantExtraActionIfFromDiscard(state, playerId, fromDiscard, 'diy_clowns_banana_peel', timestamp) };
    }

    const interaction = createSimpleChoice(
        `diy_clowns_banana_peel_minions_${timestamp}`,
        playerId,
        '选择至多两个要移动的己方仆从',
        buildMinionTargetOptions(ownMinions, { state: state.core, sourcePlayerId: playerId, effectType: 'move' }),
        {
            sourceId: 'diy_clowns_banana_peel_minions',
            targetType: 'minion',
            multi: { min: 0, max: Math.min(2, ownMinions.length) },
            autoResolveIfSingle: false,
            titleKey: 'ui.diy_clowns_banana_peel_minions_title',
        },
    );
    interaction.data.continuationContext = { fromDiscard, fromBaseIndex: selected.fromBaseIndex };
    return { state: queueInteraction(state, interaction), events: [] };
};

const bananaPeelChooseMinions: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const ctx = (data?.continuationContext as BananaPeelContext | undefined) ?? {};
    const choices = (Array.isArray(value) ? value : value ? [value] : []) as MinionChoice[];
    const picked = choices
        .filter(choice => choice.minionUid && choice.defId && choice.baseIndex === ctx.fromBaseIndex)
        .map(choice => ({ minionUid: choice.minionUid!, minionDefId: choice.defId! }));
    if (picked.length === 0 || ctx.fromBaseIndex === undefined) {
        return {
            state,
            events: grantExtraActionIfFromDiscard(state, playerId, ctx.fromDiscard === true, 'diy_clowns_banana_peel', timestamp),
        };
    }

    const destinationOptions = state.core.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ baseIndex }) => baseIndex !== ctx.fromBaseIndex)
        .map(({ base, baseIndex }) => ({
            id: `base-${baseIndex}`,
            label: base.defId,
            value: {
                fromBaseIndex: ctx.fromBaseIndex,
                toBaseIndex: baseIndex,
                toBaseDefId: base.defId,
            },
            displayMode: 'button' as const,
        }));
    if (destinationOptions.length === 0) {
        return {
            state,
            events: grantExtraActionIfFromDiscard(state, playerId, ctx.fromDiscard === true, 'diy_clowns_banana_peel', timestamp),
        };
    }

    const interaction = createSimpleChoice(
        `diy_clowns_banana_peel_base_${timestamp}`,
        playerId,
        '选择移动目标基地',
        destinationOptions,
        { sourceId: 'diy_clowns_banana_peel_base', targetType: 'base', autoResolveIfSingle: false, titleKey: 'ui.diy_clowns_banana_peel_base_title' },
    );
    interaction.data.continuationContext = {
        fromDiscard: ctx.fromDiscard === true,
        fromBaseIndex: ctx.fromBaseIndex,
        minions: picked,
    };
    return { state: queueInteraction(state, interaction), events: [] };
};

const bananaPeelChooseBase: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const selected = value as {
        fromBaseIndex?: number;
        toBaseIndex?: number;
        toBaseDefId?: string;
    } | undefined;
    const ctx = (data?.continuationContext as BananaPeelContext | undefined) ?? {};
    if (selected?.fromBaseIndex === undefined || selected.toBaseIndex === undefined || !ctx.minions?.length) {
        return { state, events: [] };
    }
    const events: SmashUpEvent[] = ctx.minions.flatMap(minion =>
        buildValidatedBaseMoveEvents(state, {
            minionUid: minion.minionUid,
            minionDefId: minion.minionDefId,
            fromBaseIndex: selected.fromBaseIndex!,
            toBaseIndex: selected.toBaseIndex!,
            toBaseDefId: selected.toBaseDefId,
            reason: 'diy_clowns_banana_peel',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'diy_clowns_banana_peel',
            sourceBaseIndex: selected.fromBaseIndex!,
        }),
    );
    events.push(...grantExtraActionIfFromDiscard(state, playerId, ctx.fromDiscard === true, 'diy_clowns_banana_peel', timestamp));
    return { state, events };
};

function diyClownsClownCar(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const fromDiscard = wasPlayedFromDiscard(ctx);
    const candidates = player.discard.filter(card => card.uid !== ctx.cardUid);
    if (candidates.length === 0) {
        return {
            events: fromDiscard
                ? [grantContextualExtraAction({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'diy_clowns_clown_car')]
                : [],
        };
    }

    const interaction = createSimpleChoice(
        `diy_clowns_clown_car_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择至多两张弃牌洗回牌库',
        buildCardOptions(candidates, 'discard'),
        {
            sourceId: 'diy_clowns_clown_car',
            targetType: 'discard',
            multi: { min: 0, max: Math.min(2, candidates.length) },
            autoResolveIfSingle: false,
            autoRefresh: 'discard',
            titleKey: 'ui.diy_clowns_clown_car_title',
        },
    );
    interaction.data.continuationContext = { fromDiscard };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const clownCarHandler: InteractionHandler = (state, playerId, value, data, random, timestamp) => {
    const fromDiscard = (data?.continuationContext as { fromDiscard?: boolean } | undefined)?.fromDiscard === true;
    const choices = (Array.isArray(value) ? value : value ? [value] : []) as CardChoice[];
    const selectedUids = new Set(choices.map(choice => choice.cardUid).filter((uid): uid is string => !!uid));
    const player = state.core.players[playerId];
    const selectedCards = player.discard.filter(card => selectedUids.has(card.uid));
    const events: SmashUpEvent[] = [];
    if (selectedCards.length > 0) {
        events.push(deckReordered(
            playerId,
            random.shuffle([...player.deck, ...selectedCards]).map(card => card.uid),
            timestamp,
        ));
    }
    events.push(...grantExtraActionIfFromDiscard(state, playerId, fromDiscard, 'diy_clowns_clown_car', timestamp));
    return { state, events };
};

function diyClownsJackInTheBox(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraMinion(
                { playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState },
                'diy_clowns_jack_in_the_box',
                undefined,
                { powerMax: wasPlayedFromDiscard(ctx) ? 4 : 3 },
            ),
        ],
    };
}

function diyClownsClownPyramid(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const ownMinions = base.minions
        .filter(minion => minion.controller === ctx.playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardName(minion.defId),
        }));
    const extra = grantContextualExtraAction({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'diy_clowns_clown_pyramid');
    if (ownMinions.length === 0) return { events: [extra] };
    if (!ctx.matchState) return { events: [extra] };
    const interaction = createSimpleChoice(
        `diy_clowns_clown_pyramid_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择获得小丑金字塔力量的己方仆从',
        buildMinionTargetOptions(ownMinions, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'power_change' }),
        { sourceId: 'diy_clowns_clown_pyramid', targetType: 'minion', autoResolveIfSingle: false, titleKey: 'ui.diy_clowns_clown_pyramid_title' },
    );
    interaction.data.continuationContext = { amount: ownMinions.length };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const clownPyramidHandler: InteractionHandler = (state, playerId, value, data, _random, timestamp) => {
    const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
    const amount = (data?.continuationContext as { amount?: number } | undefined)?.amount ?? 0;
    if (!selected?.minionUid || selected.baseIndex === undefined || amount <= 0) {
        return { state, events: [grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'diy_clowns_clown_pyramid')] };
    }
    return {
        state,
        events: [
            addTempPower(selected.minionUid, selected.baseIndex, amount, 'diy_clowns_clown_pyramid', timestamp),
            grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'diy_clowns_clown_pyramid'),
        ],
    };
};

function diyClownsColorfulScarf(ctx: AbilityContext): AbilityResult {
    const events = buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now);
    if (!wasPlayedFromDiscard(ctx)) return { events };

    const interaction = createSimpleChoice(
        `diy_clowns_colorful_scarf_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '你可以丢弃一张牌来额外抽一张牌',
        [
            ...buildCardOptions(ctx.state.players[ctx.playerId]?.hand.filter(card => card.uid !== ctx.cardUid) ?? [], 'hand'),
            {
                id: 'skip',
                label: '不丢弃',
                labelKey: 'ui.skip',
                value: { skip: true },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'diy_clowns_colorful_scarf', targetType: 'hand', autoRefresh: 'hand', titleKey: 'ui.diy_clowns_colorful_scarf_title' },
    );
    interaction.data.optionsGenerator = latestState => [
        ...buildHandDiscardOptions((latestState.core as SmashUpCore), ctx.playerId),
        {
            id: 'skip',
            label: '不丢弃',
            labelKey: 'ui.skip',
            value: { skip: true },
            displayMode: 'button' as const,
        },
    ];
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

const colorfulScarfHandler: InteractionHandler = (state, playerId, value, _data, random, timestamp) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const selected = value as { cardUid?: string } | undefined;
    if (!selected?.cardUid) return { state, events: [] };
    return {
        state,
        events: [
            discardFromHand(playerId, [selected.cardUid], timestamp),
            ...buildStandardDrawEvents(state, playerId, 1, random, timestamp),
        ],
    };
};

function diyClownsConfettiBucket(ctx: AbilityContext): AbilityResult {
    const hand = ctx.state.players[ctx.playerId]?.hand.filter(card => card.uid !== ctx.cardUid) ?? [];
    if (hand.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_clowns_confetti_bucket_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择至多四张手牌弃掉并抽等量牌',
        buildCardOptions(hand, 'hand'),
        {
            sourceId: 'diy_clowns_confetti_bucket',
            targetType: 'hand',
            multi: { min: 0, max: Math.min(4, hand.length) },
            autoResolveIfSingle: false,
            autoRefresh: 'hand',
            titleKey: 'ui.diy_clowns_confetti_bucket_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const confettiBucketHandler: InteractionHandler = (state, playerId, value, _data, random, timestamp) => {
    const choices = (Array.isArray(value) ? value : value ? [value] : []) as CardChoice[];
    const selectedUids = choices.map(choice => choice.cardUid).filter((uid): uid is string => !!uid);
    if (selectedUids.length === 0) return { state, events: [] };
    return {
        state,
        events: [
            discardFromHand(playerId, selectedUids, timestamp),
            ...buildStandardDrawEvents(state, playerId, selectedUids.length, random, timestamp),
        ],
    };
};

function diyClownsPieInTheFace(ctx: AbilityContext): AbilityResult {
    const amount = wasPlayedFromDiscard(ctx) ? 4 : 2;
    const ownMinions = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardName(minion.defId),
            })),
    );
    if (ownMinions.length === 0) return { events: [] };
    if (!ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_clowns_pie_in_the_face_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择获得力量的己方仆从',
        buildMinionTargetOptions(ownMinions, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'power_change' }),
        { sourceId: 'diy_clowns_pie_in_the_face', targetType: 'minion', autoResolveIfSingle: false, titleKey: 'ui.diy_clowns_pie_in_the_face_title' },
    );
    interaction.data.continuationContext = { amount };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const pieHandler: InteractionHandler = (state, _playerId, value, data, _random, timestamp) => {
    const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
    const amount = (data?.continuationContext as { amount?: number } | undefined)?.amount ?? 2;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [addTempPower(selected.minionUid, selected.baseIndex, amount, 'diy_clowns_pie_in_the_face', timestamp)],
    };
};

function diyClownsClownGirl(ctx: AbilityContext): AbilityResult {
    const actions = ctx.state.players[ctx.playerId]?.deck.filter(isAction) ?? [];
    if (actions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `diy_clowns_clown_girl_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择从牌库丢弃的行动牌',
        buildCardOptions(actions, 'deck'),
        {
            sourceId: 'diy_clowns_clown_girl',
            targetType: 'deck',
            autoResolveIfSingle: false,
            autoRefresh: 'deck',
            responseValidationMode: 'live',
            titleKey: 'ui.diy_clowns_clown_girl_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const clownGirlHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    const selected = value as { cardUid?: string } | undefined;
    if (!selected?.cardUid) return { state, events: [] };
    return { state, events: [millFromDeck(playerId, [selected.cardUid], 'diy_clowns_clown_girl', timestamp)] };
};

function diyClownsMcDonaldClown(ctx: AbilityContext): AbilityResult {
    const deck = ctx.state.players[ctx.playerId]?.deck ?? [];
    const revealed: CardInstance[] = [];
    const actions: CardInstance[] = [];
    for (const card of deck) {
        revealed.push(card);
        if (isAction(card)) actions.push(card);
        if (actions.length >= 2) break;
    }
    if (actions.length === 0) return { events: [] };
    const revealEvents = [
        inspectDeck(ctx.playerId, ctx.playerId, revealed.length, 'diy_clowns_mcdonald_clown', ctx.now),
        revealDeckTop(ctx.playerId, 'all', revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, 'diy_clowns_mcdonald_clown', ctx.now, ctx.playerId),
    ];
    if (!ctx.matchState) return { events: revealEvents };

    const interaction = createSimpleChoice(
        `diy_clowns_mcdonald_clown_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '选择抽取的行动牌，另一张行动牌将被丢弃',
        buildCardOptions(actions, 'deck'),
        { sourceId: 'diy_clowns_mcdonald_clown', targetType: 'deck', autoResolveIfSingle: false, titleKey: 'ui.diy_clowns_mcdonald_clown_title' },
    );
    interaction.data.continuationContext = {
        actionUids: actions.map(card => card.uid),
        revealedUids: revealed.map(card => card.uid),
    };
    return {
        events: revealEvents,
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

const mcDonaldHandler: InteractionHandler = (state, playerId, value, data, random, timestamp) => {
    const selected = value as { cardUid?: string } | undefined;
    const actionUids = (data?.continuationContext as { actionUids?: string[] } | undefined)?.actionUids ?? [];
    if (!selected?.cardUid || !actionUids.includes(selected.cardUid)) return { state, events: [] };
    const discardUids = actionUids.filter(uid => uid !== selected.cardUid);
    const player = state.core.players[playerId];
    const actionSet = new Set(actionUids);
    const rest = player.deck.filter(card => !actionSet.has(card.uid));
    return {
        state,
        events: [
            deckReordered(playerId, [selected.cardUid, ...discardUids, ...random.shuffle(rest).map(card => card.uid)], timestamp),
            drawSpecificCard(playerId, selected.cardUid, timestamp),
            ...(discardUids.length > 0 ? [millFromDeck(playerId, discardUids, 'diy_clowns_mcdonald_clown', timestamp)] : []),
        ],
    };
};

function diyClownsDancingClownTalent(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const candidates = player.discard.filter(isStandardAction);
    if (candidates.length < 2) return { events: [] };
    const picked = ctx.random.shuffle([...candidates])[0];
    if (!picked) return { events: [] };

    const sourceId = `diy_clowns_dancing_clown:${ctx.cardUid}`;
    const events: SmashUpEvent[] = [
        buildActionPlayedEvent({
            playerId: ctx.playerId,
            cardUid: picked.uid,
            defId: picked.defId,
            ownerId: picked.owner,
            timestamp: ctx.now,
            isExtraAction: true,
            fromDiscard: true,
            discardPlaySourceId: sourceId,
        }),
    ];
    const appended = appendResolvedActionAbility({
        state: ctx.matchState,
        events,
        playerId: ctx.playerId,
        cardUid: picked.uid,
        defId: picked.defId,
        random: ctx.random,
        timestamp: ctx.now,
        baseIndex: ctx.baseIndex,
        fromDiscard: true,
    });
    appended.events.push(...buildValidatedCardToDeckBottomEvents(ctx.state, {
        cardUid: picked.uid,
        defId: picked.defId,
        ownerId: picked.owner,
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: 'diy_clowns_dancing_clown',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
        reason: sourceId,
        now: ctx.now,
        expectedLocation: 'discard',
    }));
    return appended;
}

function diyClownsMrsClownTrigger(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId !== ctx.playerId) {
        return { events: [] };
    }
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source || Number(source.metadata?.diyClownsMrsClownUsedTurn ?? -1) === ctx.state.turnNumber) {
        return { events: [] };
    }
    return {
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            minionMetadataUpdated(
                source.uid,
                ctx.sourceBaseIndex,
                { diyClownsMrsClownUsedTurn: ctx.state.turnNumber },
                'diy_clowns_mrs_clown',
                ctx.now,
            ),
        ],
    };
}

function canDiyClownsMrsClownTrigger(ctx: TriggerContext): boolean {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId !== ctx.playerId) {
        return false;
    }
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    return Boolean(source)
        && Number(source?.metadata?.diyClownsMrsClownUsedTurn ?? -1) !== ctx.state.turnNumber;
}

function diyClownsJuggling(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        const deck = ctx.state.players[pid]?.deck ?? [];
        const topCards = deck.slice(0, 3);
        if (topCards.length === 0) continue;
        const action = topCards.find(isAction);
        events.push(inspectDeck(pid, pid, topCards.length, 'diy_clowns_juggling', ctx.now));
        if (action) {
            events.push(revealDeckTop(pid, 'all', [{ uid: action.uid, defId: action.defId }], 1, 'diy_clowns_juggling', ctx.now, ctx.playerId));
            events.push(millFromDeck(pid, [action.uid], 'diy_clowns_juggling', ctx.now));
        } else {
            events.push(revealDeckTop(pid, 'all', topCards.map(card => ({ uid: card.uid, defId: card.defId })), topCards.length, 'diy_clowns_juggling', ctx.now, ctx.playerId));
        }
    }
    return { events };
}

function baseClownAcademy(ctx: { state: SmashUpCore; playerId: PlayerId; baseIndex: number; now: number; random?: { shuffle<T>(arr: T[]): T[] } }): { events: SmashUpEvent[] } {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    if ((player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) !== 1) return { events: [] };
    const candidates = player.discard.filter(isStandardAction);
    if (candidates.length === 0) return { events: [] };
    const picked = (ctx.random?.shuffle([...candidates]) ?? candidates)[0];
    return picked ? { events: [recoverCardsFromDiscard(ctx.playerId, [picked.uid], 'base_diy_clowns_clown_academy', ctx.now)] } : { events: [] };
}

function baseCircusTent(ctx: {
    state: SmashUpCore;
    matchState?: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
}): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const top = ctx.state.players[ctx.playerId]?.deck[0];
    if (!top) return { events: [] };
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, 1, 'base_diy_clowns_circus_tent', ctx.now),
        revealDeckTop(ctx.playerId, 'all', [{ uid: top.uid, defId: top.defId }], 1, 'base_diy_clowns_circus_tent', ctx.now, ctx.playerId),
    ];
    if (!isAction(top) || !ctx.matchState) {
        return { events };
    }
    const interaction = createSimpleChoice(
        `base_diy_clowns_circus_tent_${top.uid}_${ctx.now}`,
        ctx.playerId,
        '马戏篷：是否弃掉展示的行动牌？',
        [
            {
                id: 'discard',
                label: '弃掉行动牌',
                labelKey: 'ui.base_diy_clowns_circus_tent_discard_option',
                value: { discard: true, cardUid: top.uid },
                displayMode: 'button' as const,
            },
            {
                id: 'keep',
                label: '放回牌库顶',
                labelKey: 'ui.base_diy_clowns_circus_tent_keep_option',
                value: { discard: false, cardUid: top.uid },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'base_diy_clowns_circus_tent', targetType: 'button', titleKey: 'ui.base_diy_clowns_circus_tent_title' },
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

const circusTentHandler: InteractionHandler = (state, playerId, value, _data, _random, timestamp) => {
    const selected = value as { discard?: boolean; cardUid?: string } | undefined;
    if (!selected?.discard || !selected.cardUid) return { state, events: [] };
    return { state, events: [millFromDeck(playerId, [selected.cardUid], 'base_diy_clowns_circus_tent', timestamp)] };
};

export function registerDiyClownsAbilities(): void {
    registerDiscardActionPlayProvider({
        id: 'diy_clowns_silent_clown',
        getPlayableCards(core, playerId) {
            if (core.turnOrder[core.currentPlayerIndex] !== playerId) return [];
            const player = core.players[playerId];
            if (!player || player.actionsPlayed !== 0) return [];
            const availableSource = controlledMinionSources(core, playerId, 'diy_clowns_silent_clown')
                .find(({ minion }) => !(player.usedDiscardPlayAbilities ?? []).includes(`diy_clowns_silent_clown:${minion.uid}`));
            if (!availableSource) return [];
            return buildDiscardStandardActionOptions(
                core,
                playerId,
                `diy_clowns_silent_clown:${availableSource.minion.uid}`,
                false,
            );
        },
    });
    registerDiscardActionPlayProvider({
        id: 'diy_clowns_slapstick_clown',
        getPlayableCards(core, playerId) {
            if (core.turnOrder[core.currentPlayerIndex] !== playerId) return [];
            const source = controlledMinionSources(core, playerId, 'diy_clowns_slapstick_clown')[0];
            if (!source) return [];
            return buildDiscardStandardActionOptions(
                core,
                playerId,
                `diy_clowns_slapstick_clown:${source.minion.uid}`,
                true,
            );
        },
    });

    registerAbility('diy_clowns_banana_peel', 'onPlay', diyClownsBananaPeel);
    registerAbility('diy_clowns_clown_car', 'onPlay', diyClownsClownCar);
    registerAbility('diy_clowns_jack_in_the_box', 'onPlay', diyClownsJackInTheBox);
    registerAbility('diy_clowns_clown_pyramid', 'onPlay', diyClownsClownPyramid);
    registerAbility('diy_clowns_colorful_scarf', 'onPlay', diyClownsColorfulScarf);
    registerAbility('diy_clowns_confetti_bucket', 'onPlay', diyClownsConfettiBucket);
    registerAbility('diy_clowns_juggling', 'onPlay', diyClownsJuggling);
    registerAbility('diy_clowns_pie_in_the_face', 'onPlay', diyClownsPieInTheFace);
    registerAbility('diy_clowns_clown_girl', 'onPlay', diyClownsClownGirl);
    registerAbility('diy_clowns_mcdonald_clown', 'onPlay', diyClownsMcDonaldClown);
    registerAbility('diy_clowns_dancing_clown', 'talent', {
        execute: diyClownsDancingClownTalent,
        validateUse: ctx => (ctx.state.players[ctx.playerId]?.discard.filter(isStandardAction).length ?? 0) >= 2
            ? null
            : '弃牌堆中需要至少两张标准行动',
    });
    registerTrigger('diy_clowns_mrs_clown', 'onActionPlayed', diyClownsMrsClownTrigger, {
        optional: true,
        perInstance: true,
        baseScoped: false,
        playerContext: 'sourceController',
        canTrigger: canDiyClownsMrsClownTrigger,
    });

    registerInteractionHandler('diy_clowns_banana_peel', bananaPeelChooseSourceBase);
    registerInteractionHandler('diy_clowns_banana_peel_minions', bananaPeelChooseMinions);
    registerInteractionHandler('diy_clowns_banana_peel_base', bananaPeelChooseBase);
    registerInteractionHandler('diy_clowns_clown_car', clownCarHandler);
    registerInteractionHandler('diy_clowns_clown_pyramid', clownPyramidHandler);
    registerInteractionHandler('diy_clowns_colorful_scarf', colorfulScarfHandler);
    registerInteractionHandler('diy_clowns_confetti_bucket', confettiBucketHandler);
    registerInteractionHandler('diy_clowns_pie_in_the_face', pieHandler);
    registerInteractionHandler('diy_clowns_clown_girl', clownGirlHandler);
    registerInteractionHandler('diy_clowns_mcdonald_clown', mcDonaldHandler);
    registerInteractionHandler('base_diy_clowns_circus_tent', circusTentHandler);

    registerBaseAbility('base_diy_clowns_clown_academy', 'onMinionPlayed', ctx => baseClownAcademy(ctx), {
        mandatory: false,
        canTrigger: ctx => ((ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1)
            && (ctx.state.players[ctx.playerId]?.discard.some(isStandardAction) ?? false),
    });
    registerBaseAbility('base_diy_clowns_circus_tent', 'onMinionPlayed', ctx => baseCircusTent(ctx), {
        mandatory: true,
        canTrigger: ctx => (ctx.state.players[ctx.playerId]?.deck.length ?? 0) > 0,
    });
}

