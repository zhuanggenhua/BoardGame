import type { MatchState, PlayerId } from '../../../engine/types';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    buildValidatedCardToDeckBottomEvents,
    createSkipOption,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    recoverCardsFromDiscard,
    revealDeckTop,
    revealHand,
} from '../domain/abilityHelpers';
import {
    type AbilityProgram,
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerActiveBaseAbility, registerBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import type {
    CardInstance,
    CardToDeckTopEvent,
    CardTransferredEvent,
    CardsDiscardedEvent,
    RevealHandEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import {
    cardLabel,
    collectMinions,
    discardFirstHandAction,
    firstOtherBaseIndex,
    isActionCard,
    moveMinionToBase,
    ownMinionsAtBase,
    placeDiscardCardOnDeckTop,
    revealTopAndDrawMatches,
    runtimeToAbilityResult,
    searchDeckOrDiscardToHand,
} from './disney_shared';

type WishMode = 'extraCards' | 'power' | 'draw';
type WishChoice = { mode?: WishMode; skip?: boolean };
type WishPowerChoice = { minionUid?: string; baseIndex?: number };
type CarpetDestinationChoice = { baseIndex?: number };
type CarpetCompanionChoice = { minionUid?: string; baseIndex?: number; skip?: boolean };
type CarpetPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
    defId: string;
    sourceBaseIndex: number;
    targetBaseIndex?: number;
};
type WishPowerPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
    defId: string;
    baseIndex: number;
};
type AgrabahBazaarActionChoice = { cardUid?: string; defId?: string };
type AgrabahBazaarCounterChoice = { minionUid?: string; baseIndex?: number; skip?: boolean };
type AgrabahBazaarPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    baseIndex: number;
    now: number;
    remaining: number;
};
type JafarDiscardChoice = { cardUid?: string; defId?: string };
type JafarExtraActionChoice = {
    cardUid?: string;
    defId?: string;
    fromPlayerId?: PlayerId;
    zone?: 'discarded' | 'hand';
    skip?: boolean;
};
type JafarDiscardedAction = { cardUid: string; defId: string; fromPlayerId: PlayerId };
type JafarPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
    defId: string;
    pendingPlayerIds: PlayerId[];
    discardedActions: JafarDiscardedAction[];
};
type AladdinDiscardActionEffect = 'jasmine' | 'rajah' | 'palace_guard';
type AladdinHandActionChoice = { cardUid?: string; defId?: string };
type AladdinDiscardActionChoice = { cardUid?: string; defId?: string };
type StreetRatActionChoice = { cardUid?: string; defId?: string; fromPlayerId?: PlayerId };
type AladdinDiscardActionCostContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
    defId: string;
    baseIndex: number;
    effect: AladdinDiscardActionEffect;
};
type AladdinOwnDiscardActionContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
    defId: string;
    baseIndex: number;
};
type StreetRatContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
    defId: string;
    baseIndex: number;
};
type AladdinSearchZone = 'hand' | 'deck' | 'discard';
type AladdinSpecificSearchMode = 'toHand' | 'magicCarpetRide' | 'theLamp';
type AladdinSpecificSearchChoice = {
    cardUid?: string;
    defId?: string;
    zone?: AladdinSearchZone;
};
type AladdinSpecificSearchContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    targetDefId: string;
    reason: string;
    title: string;
    zones: AladdinSearchZone[];
    mode: AladdinSpecificSearchMode;
    sourceCardUid?: string;
    sourceDefId?: string;
    sourceBaseIndex?: number;
};

const FALLBACK_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function transferCardToSelf(card: CardInstance, fromPlayerId: PlayerId, toPlayerId: PlayerId, reason: string, now: number): CardTransferredEvent {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            fromPlayerId,
            toPlayerId,
            ownerId: card.owner,
            reason,
        },
        timestamp: now,
    };
}

function discardActionCost(ctx: AbilityContext): SmashUpEvent[] | undefined {
    const discard = discardFirstHandAction(ctx);
    return discard ? [discard] : undefined;
}

function hasActionCost(ctx: AbilityContext): boolean {
    return (ctx.state.players[ctx.playerId]?.hand ?? [])
        .some(card => card.uid !== ctx.cardUid && isActionCard(card.defId));
}

function buildHandActionCostOptions(context: AladdinDiscardActionCostContext) {
    return (context.matchState.core.players[context.playerId]?.hand ?? [])
        .filter(card => card.uid !== context.cardUid && isActionCard(card.defId))
        .map((card, index) => ({
            id: `hand-action-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId } satisfies AladdinHandActionChoice,
            displayMode: 'card' as const,
            displayCard: { cardUid: card.uid, defId: card.defId },
        }));
}

function hasLiveAladdinSource(
    state: SmashUpCore,
    context: Pick<AladdinDiscardActionCostContext, 'playerId' | 'cardUid' | 'baseIndex'>,
    defId: string,
): boolean {
    return state.bases[context.baseIndex]?.minions.some(minion =>
        minion.uid === context.cardUid
        && minion.defId === defId
        && minion.controller === context.playerId,
    ) ?? false;
}

function resolveAladdinDiscardActionEffect(
    context: AladdinDiscardActionCostContext,
    state: MatchState<SmashUpCore>,
    timestamp: number,
): SmashUpEvent[] | undefined {
    if (context.effect === 'jasmine') {
        if (!hasLiveAladdinSource(state.core, context, 'aladdin_jasmine')) return undefined;
        return [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, 'aladdin_jasmine')];
    }

    if (context.effect === 'rajah') {
        if (!hasLiveAladdinSource(state.core, context, 'aladdin_rajah')) return undefined;
        return [addTempPower(context.cardUid, context.baseIndex, 2, 'aladdin_rajah', timestamp, {
            sourcePlayerId: context.playerId,
            sourceCardUid: context.cardUid,
            sourceDefId: context.defId,
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.baseIndex,
        })];
    }

    if (!hasLiveAladdinSource(state.core, context, 'aladdin_palace_guard')) return undefined;
    const guards = ownMinionsAtBase(state.core, context.playerId, context.baseIndex)
        .filter(minion => minion.defId === 'aladdin_palace_guard');
    return guards.map(guard => addPowerCounter(guard.uid, context.baseIndex, 1, 'aladdin_palace_guard', timestamp, {
        sourcePlayerId: context.playerId,
        sourceCardUid: context.cardUid,
        sourceDefId: context.defId,
        sourceControllerId: context.playerId,
        sourceBaseIndex: context.baseIndex,
    }));
}

const discardActionCostPromptProgram = createPromptProgram<AladdinDiscardActionCostContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_discard_action_cost',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `aladdin_discard_action_cost_${context.effect}_${context.now}`,
        context.playerId,
        '阿拉丁：选择要弃掉的行动牌',
        buildHandActionCostOptions(context),
        {
            titleKey: 'ui.aladdin_discard_action_cost_title',
            sourceId: 'aladdin_discard_action_cost',
            targetType: 'hand',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            autoRefresh: 'hand',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as AladdinHandActionChoice | undefined;
        if (!selected?.cardUid || !selected.defId) return { events: [] };
        const card = state.core.players[context.playerId]?.hand.find(candidate =>
            candidate.uid === selected.cardUid
            && candidate.defId === selected.defId
            && isActionCard(candidate.defId),
        );
        if (!card) return { events: [] };
        const effectEvents = resolveAladdinDiscardActionEffect(context, state, timestamp);
        if (!effectEvents) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: context.playerId, cardUids: [card.uid] },
                timestamp,
            } as CardsDiscardedEvent, ...effectEvents],
        };
    },
});

function runDiscardActionCostPrompt(ctx: AbilityContext, effect: AladdinDiscardActionEffect): AbilityResult {
    if (!hasActionCost(ctx)) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    if (!ctx.matchState) return { events: discardActionCost(ctx) ?? [] };
    return runtimeToAbilityResult(executeAbilityProgram(discardActionCostPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        defId: ctx.defId,
        baseIndex: ctx.baseIndex,
        effect,
    }));
}

function hasSpecificSearchCandidate(
    ctx: AbilityContext,
    targetDefId: string,
    zones: AladdinSearchZone[],
): boolean {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return false;
    return zones.some(zone => {
        const cards = zone === 'hand'
            ? player.hand
            : zone === 'deck'
                ? player.deck
                : player.discard;
        return cards.some(card => card.defId === targetDefId);
    });
}

function runSpecificSearchPrompt(
    ctx: AbilityContext,
    params: {
        targetDefId: string;
        reason: string;
        title: string;
        zones: AladdinSearchZone[];
        mode: AladdinSpecificSearchMode;
    },
): AbilityResult {
    if (!hasSpecificSearchCandidate(ctx, params.targetDefId, params.zones)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    const result = executeAbilityProgram(aladdinSpecificSearchPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        targetDefId: params.targetDefId,
        reason: params.reason,
        title: params.title,
        zones: params.zones,
        mode: params.mode,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceBaseIndex: ctx.baseIndex,
    });
    return {
        events: [
            ...(params.zones.includes('deck') && ctx.state.players[ctx.playerId]?.deck.some(card => card.defId === params.targetDefId)
                ? [inspectDeck(ctx.playerId, ctx.playerId, ctx.state.players[ctx.playerId]?.deck.length ?? 0, params.reason, ctx.now)]
                : []),
            ...result.events,
        ],
        matchState: result.matchState,
    };
}

function aladdinOnPlay(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        return runSpecificSearchPrompt(ctx, {
            targetDefId: 'aladdin_the_lamp',
            reason: 'aladdin_aladdin',
            title: '阿拉丁：选择牌库或弃牌堆中的神灯加入手牌',
            zones: ['deck', 'discard'],
            mode: 'toHand',
        });
    }
    return { events: searchDeckOrDiscardToHand(ctx, 'aladdin_the_lamp', 'aladdin_aladdin').events };
}

function aladdinTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: revealTopAndDrawMatches({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            untilFirst: true,
            maxPick: 1,
            predicate: card => isActionCard(card.defId),
            reason: 'aladdin_aladdin',
            now: ctx.now,
        }).events,
    };
}

function jasmineTalent(ctx: AbilityContext): AbilityResult {
    return runDiscardActionCostPrompt(ctx, 'jasmine');
}

function rajahTalent(ctx: AbilityContext): AbilityResult {
    const self = ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex).find(minion => minion.uid === ctx.cardUid);
    if (!self) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return runDiscardActionCostPrompt(ctx, 'rajah');
}

function palaceGuardTalent(ctx: AbilityContext): AbilityResult {
    const guards = ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex)
        .filter(minion => minion.defId === 'aladdin_palace_guard');
    if (guards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return runDiscardActionCostPrompt(ctx, 'palace_guard');
}

function abuOnPlay(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState && hasOwnDiscardAction(ctx.state, ctx.playerId)) {
        return runtimeToAbilityResult(executeAbilityProgram(abuDiscardActionPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            baseIndex: ctx.baseIndex,
        }));
    }
    const event = placeDiscardCardOnDeckTop(ctx, card => isActionCard(card.defId), 'aladdin_abu');
    return { events: event ? [event] : [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
}

function genieTalent(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        return runSpecificSearchPrompt(ctx, {
            targetDefId: 'aladdin_wish',
            reason: 'aladdin_genie',
            title: '精灵：选择牌库或弃牌堆中的愿望加入手牌',
            zones: ['deck', 'discard'],
            mode: 'toHand',
        });
    }
    return { events: searchDeckOrDiscardToHand(ctx, 'aladdin_wish', 'aladdin_genie').events };
}

function carpetTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const self = base.minions.find(minion => minion.uid === ctx.cardUid && minion.controller === ctx.playerId);
    if (!self) return { events: [] };
    const destinationBaseIndex = ctx.targetBaseIndex !== undefined
        && ctx.targetBaseIndex !== ctx.baseIndex
        && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : undefined;
    if (ctx.matchState && destinationBaseIndex === undefined) {
        return runtimeToAbilityResult(executeAbilityProgram(carpetDestinationPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
        }));
    }
    const toBaseIndex = destinationBaseIndex ?? firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (toBaseIndex === undefined) return { events: [] };
    if (ctx.matchState && collectCarpetCompanionTargets(ctx.state, ctx.playerId, ctx.baseIndex, ctx.cardUid).length > 0) {
        return runtimeToAbilityResult(executeAbilityProgram(carpetCompanionPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            targetBaseIndex: toBaseIndex,
        }));
    }
    const companions = base.minions
        .filter(minion => minion.controller === ctx.playerId && minion.uid !== self.uid)
        .slice(0, 2);
    const batch = [self, ...companions];
    return {
        events: batch.flatMap(minion =>
            moveMinionToBase(ctx.matchState, minion, ctx.baseIndex, toBaseIndex, ctx.playerId, 'aladdin_carpet', ctx.now)),
    };
}

function collectSpecificSearchOptions(context: AladdinSpecificSearchContext) {
    const player = context.matchState.core.players[context.playerId];
    if (!player) return [];
    return context.zones.flatMap(zone => {
        const cards = zone === 'hand'
            ? player.hand
            : zone === 'deck'
                ? player.deck
                : player.discard;
        return cards
            .filter(card => card.defId === context.targetDefId)
            .map((card, index) => ({
                id: `${zone}-${index}`,
                label: `${cardLabel(card.defId)}（${zone === 'hand' ? '手牌' : zone === 'deck' ? '牌库' : '弃牌堆'}）`,
                value: { cardUid: card.uid, defId: card.defId, zone } satisfies AladdinSpecificSearchChoice,
                displayMode: 'card' as const,
                displayCard: { cardUid: card.uid, defId: card.defId },
            }));
    });
}

function buildDrawSpecificDeckCardEvents(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    card: CardInstance,
    reason: string,
    timestamp: number,
    random: { shuffle<T>(items: T[]): T[] },
): SmashUpEvent[] {
    const player = state.core.players[playerId];
    if (!player) return [];
    const remaining = player.deck.filter(candidate => candidate.uid !== card.uid);
    return [
        revealDeckTop(playerId, 'all', [{ uid: card.uid, defId: card.defId }], 1, reason, timestamp, playerId),
        ...(remaining.length > 0
            ? [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: random.shuffle(remaining).map(candidate => candidate.uid) },
                timestamp,
            } as SmashUpEvent]
            : []),
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [card.uid] },
            timestamp,
        } as SmashUpEvent,
    ];
}

function collectCarpetCompanionTargets(
    state: SmashUpCore,
    playerId: PlayerId,
    sourceBaseIndex: number,
    carpetUid: string,
) {
    return (state.bases[sourceBaseIndex]?.minions ?? [])
        .filter(minion => minion.controller === playerId && minion.uid !== carpetUid)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: sourceBaseIndex,
            label: cardLabel(minion.defId),
        }));
}

function buildCarpetMoveEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    carpetUid: string,
    sourceBaseIndex: number,
    targetBaseIndex: number | undefined,
    selectedCompanionUids: string[],
    now: number,
): SmashUpEvent[] {
    const sourceBase = state.bases[sourceBaseIndex];
    if (!sourceBase || targetBaseIndex === undefined || !state.bases[targetBaseIndex] || targetBaseIndex === sourceBaseIndex) return [];
    const self = sourceBase.minions.find(minion => minion.uid === carpetUid && minion.controller === playerId);
    if (!self) return [];
    const selected = new Set(selectedCompanionUids);
    const companions = sourceBase.minions
        .filter(minion => selected.has(minion.uid) && minion.controller === playerId && minion.uid !== carpetUid)
        .slice(0, 2);
    return [self, ...companions].flatMap(minion =>
        moveMinionToBase(state, minion, sourceBaseIndex, targetBaseIndex, playerId, 'aladdin_carpet', now));
}

const carpetCompanionPromptProgram = createPromptProgram<CarpetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_carpet_companions',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `aladdin_carpet_companions_${context.now}`,
        context.playerId,
        '魔毯：选择至多两个同行角色',
        buildMinionTargetOptions(
            collectCarpetCompanionTargets(context.matchState.core, context.playerId, context.sourceBaseIndex, context.cardUid),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'aladdin_carpet',
                sourceKind: 'nonAction',
                semanticRole: 'target',
                effectType: 'move',
            },
        ),
        {
            titleKey: 'ui.aladdin_carpet_companions_title',
            sourceId: 'aladdin_carpet_companions',
            targetType: 'minion',
            multi: {
                min: 0,
                max: Math.min(2, collectCarpetCompanionTargets(
                    context.matchState.core,
                    context.playerId,
                    context.sourceBaseIndex,
                    context.cardUid,
                ).length),
            },
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : [value]) as CarpetCompanionChoice[];
        const selectedCompanionUids = choices
            .filter(choice => !choice?.skip && choice?.minionUid && choice.baseIndex === context.sourceBaseIndex)
            .map(choice => choice.minionUid!)
            .slice(0, 2);
        return {
            events: buildCarpetMoveEvents(
                state.core,
                context.playerId,
                context.cardUid,
                context.sourceBaseIndex,
                context.targetBaseIndex,
                selectedCompanionUids,
                timestamp,
            ),
        };
    },
});

const carpetDestinationPromptProgram = createPromptProgram<CarpetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_carpet_destination',
    buildInteraction: (context) => {
        const options = context.matchState.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                label: base.defId,
            }))
            .filter(base => base.baseIndex !== context.sourceBaseIndex);
        return createAbilityRuntimeSimpleChoice(
            `aladdin_carpet_destination_${context.now}`,
            context.playerId,
            '魔毯：选择要移动到的基地',
            buildBaseTargetOptions(options, context.matchState.core),
            {
                titleKey: 'ui.aladdin_carpet_destination_title',
                sourceId: 'aladdin_carpet_destination',
                targetType: 'base',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as CarpetDestinationChoice | undefined;
        const targetBaseIndex = choice?.baseIndex;
        if (targetBaseIndex === undefined || targetBaseIndex === context.sourceBaseIndex || !state.core.bases[targetBaseIndex]) {
            return { events: [] };
        }
        const companions = collectCarpetCompanionTargets(state.core, context.playerId, context.sourceBaseIndex, context.cardUid);
        if (companions.length > 0) {
            return {
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    now: timestamp,
                    targetBaseIndex,
                },
                nextProgram: carpetCompanionPromptProgram,
            };
        }
        return {
            events: buildCarpetMoveEvents(
                state.core,
                context.playerId,
                context.cardUid,
                context.sourceBaseIndex,
                targetBaseIndex,
                [],
                timestamp,
            ),
        };
    },
});

function aFriendLikeMe(ctx: AbilityContext): AbilityResult {
    return {
        events: revealTopAndDrawMatches({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            count: 4,
            predicate: card => isActionCard(card.defId),
            reason: 'aladdin_a_friend_like_me',
            now: ctx.now,
        }).events,
    };
}

function hasOwnDiscardAction(state: SmashUpCore, playerId: PlayerId): boolean {
    return (state.players[playerId]?.discard ?? []).some(card => isActionCard(card.defId));
}

function buildOwnDiscardActionOptions(context: AladdinOwnDiscardActionContext) {
    return (context.matchState.core.players[context.playerId]?.discard ?? [])
        .filter(card => isActionCard(card.defId))
        .map((card, index) => ({
            id: `discard-action-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId } satisfies AladdinDiscardActionChoice,
            displayMode: 'card' as const,
            displayCard: { cardUid: card.uid, defId: card.defId },
        }));
}

function buildAladdinCardToDeckTopEvent(
    context: AladdinOwnDiscardActionContext,
    card: CardInstance,
    reason: string,
    timestamp: number,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            reason,
            sourcePlayerId: context.playerId,
            sourceCardUid: context.cardUid,
            sourceDefId: context.defId,
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.baseIndex,
        },
        timestamp,
    };
}

const abuDiscardActionPromptProgram = createPromptProgram<AladdinOwnDiscardActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_abu_discard_action',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `aladdin_abu_discard_action_${context.now}`,
        context.playerId,
        '阿布：选择弃牌堆中的一张行动牌置于牌库顶',
        buildOwnDiscardActionOptions(context),
        {
            titleKey: 'ui.aladdin_abu_discard_action_title',
            sourceId: 'aladdin_abu_discard_action',
            targetType: 'discard',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            autoRefresh: 'discard',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as AladdinDiscardActionChoice | undefined;
        if (!selected?.cardUid || !selected.defId) return { events: [] };
        const card = state.core.players[context.playerId]?.discard.find(candidate =>
            candidate.uid === selected.cardUid
            && candidate.defId === selected.defId
            && isActionCard(candidate.defId),
        );
        return { events: card ? [buildAladdinCardToDeckTopEvent(context, card, 'aladdin_abu', timestamp)] : [] };
    },
});

const caveOfWondersPromptProgram = createPromptProgram<AladdinOwnDiscardActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_cave_of_wonders',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `aladdin_cave_of_wonders_${context.now}`,
        context.playerId,
        '奇迹之洞：选择弃牌堆中的一张行动牌加入手牌',
        buildOwnDiscardActionOptions(context),
        {
            titleKey: 'ui.aladdin_cave_of_wonders_title',
            sourceId: 'aladdin_cave_of_wonders',
            targetType: 'discard',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            autoRefresh: 'discard',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as AladdinDiscardActionChoice | undefined;
        if (!selected?.cardUid || !selected.defId) return { events: [] };
        const card = state.core.players[context.playerId]?.discard.find(candidate =>
            candidate.uid === selected.cardUid
            && candidate.defId === selected.defId
            && isActionCard(candidate.defId),
        );
        return { events: card ? [recoverCardsFromDiscard(context.playerId, [card.uid], 'aladdin_cave_of_wonders', timestamp)] : [] };
    },
});

function caveOfWonders(ctx: AbilityContext): AbilityResult {
    if (!hasOwnDiscardAction(ctx.state, ctx.playerId)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    }
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(caveOfWondersPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            baseIndex: ctx.baseIndex,
        }));
    }
    return { events: [] };
}

function jafarFallback(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const discardedActions: Array<{ card: CardInstance; playerId: PlayerId }> = [];
    for (const [otherPlayerId, player] of Object.entries(ctx.state.players)) {
        if (otherPlayerId === ctx.playerId) continue;
        const action = player.hand.find(card => isActionCard(card.defId));
        if (action) {
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: otherPlayerId, cardUids: [action.uid] },
                timestamp: ctx.now,
            } as CardsDiscardedEvent);
            discardedActions.push({ card: action, playerId: otherPlayerId });
        } else {
            events.push(revealHand(
                otherPlayerId,
                ctx.playerId,
                player.hand.map(card => ({ uid: card.uid, defId: card.defId })),
                'aladdin_jafar',
                ctx.now,
                ctx.playerId,
            ) as RevealHandEvent);
        }
    }

    const stolen = discardedActions[0];
    if (stolen) {
        events.push(transferCardToSelf(stolen.card, stolen.playerId, ctx.playerId, 'aladdin_jafar', ctx.now));
        events.push(grantContextualExtraAction(ctx, 'aladdin_jafar', { restrictToCardUid: stolen.card.uid }));
        return { events };
    }

    const ownAction = ctx.state.players[ctx.playerId]?.hand.find(card => card.uid !== ctx.cardUid && isActionCard(card.defId));
    if (ownAction) {
        events.push(grantContextualExtraAction(ctx, 'aladdin_jafar', { restrictToCardUid: ownAction.uid }));
    }
    return { events };
}

function getOtherPlayerIds(state: SmashUpCore, playerId: PlayerId): PlayerId[] {
    const ordered = [
        ...state.turnOrder,
        ...Object.keys(state.players).filter(candidate => !state.turnOrder.includes(candidate)),
    ];
    return ordered.filter((candidate, index) =>
        candidate !== playerId
        && ordered.indexOf(candidate) === index
        && !!state.players[candidate]);
}

function buildJafarDiscardOptions(context: JafarPromptContext) {
    const currentPlayerId = context.pendingPlayerIds[0];
    return (context.matchState.core.players[currentPlayerId]?.hand ?? [])
        .filter(card => isActionCard(card.defId))
        .map((card, index) => ({
            id: `action-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId } satisfies JafarDiscardChoice,
            displayMode: 'card' as const,
            displayCard: { cardUid: card.uid, defId: card.defId },
        }));
}

function buildJafarExtraActionOptions(context: JafarPromptContext) {
    const options = context.discardedActions
        .filter(discarded => context.matchState.core.players[discarded.fromPlayerId]?.discard.some(card =>
            card.uid === discarded.cardUid && card.defId === discarded.defId,
        ))
        .map((discarded, index) => ({
            id: `discarded-${index}`,
            label: `打出 ${cardLabel(discarded.defId)}`,
            value: {
                cardUid: discarded.cardUid,
                defId: discarded.defId,
                fromPlayerId: discarded.fromPlayerId,
                zone: 'discarded' as const,
            } satisfies JafarExtraActionChoice,
            displayMode: 'card' as const,
            displayCard: { cardUid: discarded.cardUid, defId: discarded.defId },
        }));
    const ownActions = (context.matchState.core.players[context.playerId]?.hand ?? [])
        .filter(card => card.uid !== context.cardUid && isActionCard(card.defId))
        .map((card, index) => ({
            id: `hand-${index}`,
            label: `打出 ${cardLabel(card.defId)}`,
            value: {
                cardUid: card.uid,
                defId: card.defId,
                fromPlayerId: context.playerId,
                zone: 'hand' as const,
            } satisfies JafarExtraActionChoice,
            displayMode: 'card' as const,
            displayCard: { cardUid: card.uid, defId: card.defId },
        }));
    return [
        createSkipOption('不额外打出行动', 'ui.skip_option'),
        ...options,
        ...ownActions,
    ];
}

const jafarExtraActionPromptProgram = createPromptProgram<JafarPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_jafar_extra_action',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `aladdin_jafar_extra_action_${context.now}`,
        context.playerId,
        '贾方：选择要作为额外行动打出的牌',
        buildJafarExtraActionOptions(context),
        {
            titleKey: 'ui.aladdin_jafar_extra_action_title',
            sourceId: 'aladdin_jafar_extra_action',
            targetType: 'generic',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as JafarExtraActionChoice | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId || !selected.zone) return { events: [] };
        if (selected.zone === 'discarded') {
            const fromPlayerId = selected.fromPlayerId;
            if (!fromPlayerId) return { events: [] };
            const card = state.core.players[fromPlayerId]?.discard.find(candidate =>
                candidate.uid === selected.cardUid && candidate.defId === selected.defId && isActionCard(candidate.defId),
            );
            if (!card) return { events: [] };
            return {
                events: [
                    transferCardToSelf(card, fromPlayerId, context.playerId, 'aladdin_jafar', timestamp),
                    grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, 'aladdin_jafar', { restrictToCardUid: card.uid }),
                ],
            };
        }
        const ownAction = state.core.players[context.playerId]?.hand.find(candidate =>
            candidate.uid === selected.cardUid && candidate.defId === selected.defId && isActionCard(candidate.defId),
        );
        if (!ownAction) return { events: [] };
        return {
            events: [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, 'aladdin_jafar', { restrictToCardUid: ownAction.uid })],
        };
    },
});

let jafarAdvanceProgram: AbilityProgram<JafarPromptContext, SmashUpCore, SmashUpEvent>;

const jafarDiscardPromptProgram = createPromptProgram<JafarPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_jafar_discard_action',
    buildInteraction: (context) => {
        const currentPlayerId = context.pendingPlayerIds[0];
        return createAbilityRuntimeSimpleChoice(
            `aladdin_jafar_discard_action_${context.now}_${currentPlayerId}`,
            currentPlayerId,
            '贾方：选择一张行动牌弃掉',
            buildJafarDiscardOptions(context),
            {
                titleKey: 'ui.aladdin_jafar_discard_action_title',
                sourceId: 'aladdin_jafar_discard_action',
                targetType: 'hand',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as JafarDiscardChoice | undefined;
        if (!selected?.cardUid || !selected.defId || playerId !== context.pendingPlayerIds[0]) return { events: [] };
        const card = state.core.players[playerId]?.hand.find(candidate =>
            candidate.uid === selected.cardUid && candidate.defId === selected.defId && isActionCard(candidate.defId),
        );
        if (!card) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [card.uid] },
                timestamp,
            } as CardsDiscardedEvent],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                pendingPlayerIds: context.pendingPlayerIds.slice(1),
                discardedActions: [
                    ...context.discardedActions,
                    { cardUid: card.uid, defId: card.defId, fromPlayerId: playerId },
                ],
            },
            nextProgram: jafarAdvanceProgram,
        };
    },
});

jafarAdvanceProgram = createEffectProgram<JafarPromptContext, SmashUpCore, SmashUpEvent>((context) => {
    const events: SmashUpEvent[] = [];
    let pendingPlayerIds = [...context.pendingPlayerIds];
    while (pendingPlayerIds.length > 0) {
        const currentPlayerId = pendingPlayerIds[0];
        const player = context.matchState.core.players[currentPlayerId];
        const actions = player?.hand.filter(card => isActionCard(card.defId)) ?? [];
        if (actions.length > 0) {
            return {
                events,
                context: { ...context, pendingPlayerIds },
                nextProgram: jafarDiscardPromptProgram,
            };
        }
        if (player) {
            events.push(revealHand(
                currentPlayerId,
                context.playerId,
                player.hand.map(card => ({ uid: card.uid, defId: card.defId })),
                'aladdin_jafar',
                context.now,
                context.playerId,
            ) as RevealHandEvent);
        }
        pendingPlayerIds = pendingPlayerIds.slice(1);
    }

    const finalContext = { ...context, pendingPlayerIds: [] };
    const hasExtraActionOption = buildJafarExtraActionOptions(finalContext).some(option => !(option.value as JafarExtraActionChoice | undefined)?.skip);
    if (!hasExtraActionOption) return { events };
    return {
        events,
        context: finalContext,
        nextProgram: jafarExtraActionPromptProgram,
    };
});

function jafar(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState) return jafarFallback(ctx);
    const result = executeAbilityProgram(jafarAdvanceProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        defId: ctx.defId,
        pendingPlayerIds: getOtherPlayerIds(ctx.state, ctx.playerId),
        discardedActions: [],
    });
    return runtimeToAbilityResult(result);
}

function magicCarpetRide(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    if (ctx.matchState) {
        return runSpecificSearchPrompt(ctx, {
            targetDefId: 'aladdin_carpet',
            reason: 'aladdin_magic_carpet_ride',
            title: '魔毯之旅：选择手牌、牌库或弃牌堆中的魔毯额外打出',
            zones: ['hand', 'deck', 'discard'],
            mode: 'magicCarpetRide',
        });
    }
    const handCarpet = player.hand.find(card => card.defId === 'aladdin_carpet');
    if (handCarpet) {
        return { events: [grantContextualExtraMinion(ctx, 'aladdin_magic_carpet_ride', undefined, { specificCardUid: handCarpet.uid })] };
    }
    const search = searchDeckOrDiscardToHand(ctx, 'aladdin_carpet', 'aladdin_magic_carpet_ride');
    return {
        events: [
            ...search.events,
            ...(search.card
                ? [grantContextualExtraMinion(ctx, 'aladdin_magic_carpet_ride', undefined, { specificCardUid: search.card.uid })]
                : []),
        ],
    };
}

function collectStreetRatActionOptions(context: StreetRatContext) {
    return Object.entries(context.matchState.core.players)
        .filter(([otherPlayerId]) => otherPlayerId !== context.playerId)
        .flatMap(([fromPlayerId, player]) =>
            player.discard
                .filter(card => isActionCard(card.defId))
                .map((card, index) => ({
                    id: `discard-action-${fromPlayerId}-${index}`,
                    label: `${fromPlayerId}: ${cardLabel(card.defId)}`,
                    value: {
                        cardUid: card.uid,
                        defId: card.defId,
                        fromPlayerId,
                    } satisfies StreetRatActionChoice,
                    displayMode: 'card' as const,
                    displayCard: { cardUid: card.uid, defId: card.defId },
                })),
        );
}

const streetRatPromptProgram = createPromptProgram<StreetRatContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_street_rat',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `aladdin_street_rat_${context.now}`,
        context.playerId,
        '街头混混：选择其他玩家弃牌堆中的一张行动牌',
        collectStreetRatActionOptions(context),
        {
            titleKey: 'ui.aladdin_street_rat_title',
            sourceId: 'aladdin_street_rat',
            targetType: 'generic',
            genericIntent: 'card-pool',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as StreetRatActionChoice | undefined;
        if (!selected?.fromPlayerId || selected.fromPlayerId === context.playerId || !selected.cardUid || !selected.defId) {
            return { events: [] };
        }
        const action = state.core.players[selected.fromPlayerId]?.discard.find(card =>
            card.uid === selected.cardUid
            && card.defId === selected.defId
            && isActionCard(card.defId),
        );
        if (!action) return { events: [] };
        return {
            events: [
                transferCardToSelf(action, selected.fromPlayerId, context.playerId, 'aladdin_street_rat', timestamp),
                grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, 'aladdin_street_rat', { restrictToCardUid: action.uid }),
            ],
        };
    },
});

const aladdinSpecificSearchPromptProgram = createPromptProgram<AladdinSpecificSearchContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_specific_search',
    interactionSourceIds: [
        'aladdin_aladdin_search',
        'aladdin_genie_search',
        'aladdin_magic_carpet_ride_search',
        'aladdin_the_lamp_search',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.reason}_search_${context.now}`,
        context.playerId,
        context.title,
        collectSpecificSearchOptions(context),
        {
            sourceId: `${context.reason}_search`,
            targetType: 'generic',
            genericIntent: 'card-pool',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const selected = value as AladdinSpecificSearchChoice | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.zone || selected.defId !== context.targetDefId) {
            return { events: [] };
        }

        const player = state.core.players[context.playerId];
        if (!player) return { events: [] };
        const sourceCards = selected.zone === 'hand'
            ? player.hand
            : selected.zone === 'deck'
                ? player.deck
                : player.discard;
        const card = sourceCards.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId);
        if (!card) return { events: [] };

        const events: SmashUpEvent[] = [];
        if (selected.zone === 'deck') {
            events.push(...buildDrawSpecificDeckCardEvents(state, context.playerId, card, context.reason, timestamp, random));
        } else if (selected.zone === 'discard') {
            events.push(recoverCardsFromDiscard(context.playerId, [card.uid], context.reason, timestamp));
        }

        if (context.mode === 'magicCarpetRide') {
            events.push(grantContextualExtraMinion(
                { playerId: context.playerId, now: timestamp, matchState: state },
                'aladdin_magic_carpet_ride',
                undefined,
                { specificCardUid: card.uid },
            ));
        }

        if (context.mode === 'theLamp') {
            events.push(...buildValidatedCardToDeckBottomEvents(state.core, {
                cardUid: context.sourceCardUid ?? '',
                defId: context.sourceDefId ?? 'aladdin_the_lamp',
                ownerId: context.playerId,
                reason: 'aladdin_the_lamp',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.sourceBaseIndex,
            }));
        }

        return { events };
    },
});

function streetRat(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState && Object.entries(ctx.state.players).some(([otherPlayerId, player]) =>
        otherPlayerId !== ctx.playerId && player.discard.some(card => isActionCard(card.defId)),
    )) {
        return runtimeToAbilityResult(executeAbilityProgram(streetRatPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            baseIndex: ctx.baseIndex,
        }));
    }
    for (const [otherPlayerId, player] of Object.entries(ctx.state.players)) {
        if (otherPlayerId === ctx.playerId) continue;
        const action = player.discard.find(card => isActionCard(card.defId));
        if (!action) continue;
        return {
            events: [
                transferCardToSelf(action, otherPlayerId, ctx.playerId, 'aladdin_street_rat', ctx.now),
                grantContextualExtraAction(ctx, 'aladdin_street_rat', { restrictToCardUid: action.uid }),
            ],
        };
    }
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
}

function theLamp(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        return runSpecificSearchPrompt(ctx, {
            targetDefId: 'aladdin_genie',
            reason: 'aladdin_the_lamp',
            title: '神灯：选择牌库或弃牌堆中的精灵加入手牌',
            zones: ['deck', 'discard'],
            mode: 'theLamp',
        });
    }
    const search = searchDeckOrDiscardToHand(ctx, 'aladdin_genie', 'aladdin_the_lamp');
    return {
        events: [
            ...search.events,
            ...buildValidatedCardToDeckBottomEvents(ctx.state, {
                cardUid: ctx.cardUid,
                defId: ctx.defId,
                ownerId: ctx.playerId,
                reason: 'aladdin_the_lamp',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
        ],
    };
}

const wishPowerPromptProgram = createPromptProgram<WishPowerPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_wish_power',
    buildInteraction: (context) => {
        const targets = collectMinions(context.matchState.core, () => true).map(({ minion, baseIndex }) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: cardLabel(minion.defId),
        }));
        return createAbilityRuntimeSimpleChoice(
            `aladdin_wish_power_${context.now}`,
            context.playerId,
            '许愿：选择本回合 +5 力量的角色',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'aladdin_wish',
                sourceKind: 'action',
                effectType: 'buff',
            }),
            {
                titleKey: 'ui.aladdin_wish_power_title',
                sourceId: 'aladdin_wish_power',
                targetType: 'minion',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as WishPowerChoice | undefined;
        if (!choice?.minionUid || typeof choice.baseIndex !== 'number') return { events: [] };
        const target = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
        if (!target) return { events: [] };
        return {
            events: [addTempPower(target.uid, choice.baseIndex, 5, 'aladdin_wish', timestamp, {
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: context.defId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
            })],
        };
    },
});

const wishPromptProgram = createPromptProgram<AbilityContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'aladdin_wish',
    buildInteraction: (ctx) => createAbilityRuntimeSimpleChoice(
        `aladdin_wish_${ctx.now}`,
        ctx.playerId,
        '许愿：选择一个效果',
        [
            createSkipOption('不使用许愿', 'ui.aladdin_wish_skip_option'),
            { id: 'extra-cards', label: '额外打出一张角色和一张战术', labelKey: 'ui.aladdin_wish_extra_cards_option', value: { mode: 'extraCards' } satisfies WishChoice, displayMode: 'button' },
            { id: 'power', label: '一个角色本回合 +5 力量', labelKey: 'ui.aladdin_wish_power_option', value: { mode: 'power' } satisfies WishChoice, displayMode: 'button' },
            { id: 'draw', label: '抽四张牌', labelKey: 'ui.aladdin_wish_draw_option', value: { mode: 'draw' } satisfies WishChoice, displayMode: 'button' },
        ],
        {
            sourceId: 'aladdin_wish',
            targetType: 'button',
            autoResolveIfSingle: false,
            titleKey: 'ui.aladdin_wish_title',
        },
    ),
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        const choice = value as WishChoice;
        if (choice.skip || !choice.mode) return { events: [] };
        const events: SmashUpEvent[] = [{
            type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
            payload: {
                playerId: context.playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                reason: 'aladdin_wish',
            },
            timestamp,
        } as SmashUpEvent];
        if (choice.mode === 'draw') {
            events.push(...buildStandardDrawEventsFromRuntimeContext(args, context.playerId, 4));
        } else if (choice.mode === 'extraCards') {
            events.push(grantContextualExtraMinion(context, 'aladdin_wish'));
            events.push(grantContextualExtraAction(context, 'aladdin_wish'));
        } else {
            return {
                events,
                context: {
                    matchState: state,
                    playerId: context.playerId,
                    now: timestamp,
                    cardUid: context.cardUid,
                    defId: context.defId,
                    baseIndex: context.baseIndex,
                },
                nextProgram: wishPowerPromptProgram,
            };
        }
        return { events };
    },
});

function wish(ctx: AbilityContext): AbilityResult {
    const hasGenie = ctx.state.bases.some(base =>
        base.minions.some(minion => minion.controller === ctx.playerId && minion.defId === 'aladdin_genie'));
    if (!hasGenie) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(wishPromptProgram, ctx));
}

function buildAgrabahActionOptions(context: AgrabahBazaarPromptContext) {
    return (context.matchState.core.players[context.playerId]?.hand ?? [])
        .filter(card => isActionCard(card.defId))
        .map((card, index) => ({
            id: `action-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId } satisfies AgrabahBazaarActionChoice,
            _source: 'hand' as const,
            displayMode: 'card' as const,
        }));
}

function buildAgrabahCounterOptions(context: AgrabahBazaarPromptContext) {
    const targets = ownMinionsAtBase(context.matchState.core, context.playerId, context.baseIndex).map(minion => ({
        uid: minion.uid,
        defId: minion.defId,
        baseIndex: context.baseIndex,
        label: cardLabel(minion.defId),
    }));
    return [
        createSkipOption('完成放置', 'ui.base_agrabah_bazaar_done_option'),
        ...buildMinionTargetOptions(targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'base_agrabah_bazaar',
            sourceKind: 'nonAction',
            effectType: 'power_change',
        }),
    ];
}

const agrabahBazaarCounterPromptProgram = createPromptProgram<AgrabahBazaarPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_agrabah_bazaar_counter',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `base_agrabah_bazaar_counter_${context.now}_${context.remaining}`,
        context.playerId,
        `阿格拉巴集市：选择放置 +1 指示物的角色（剩余 ${context.remaining} 个）`,
        buildAgrabahCounterOptions(context),
        {
            sourceId: 'base_agrabah_bazaar_counter',
            targetType: 'minion',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as AgrabahBazaarCounterChoice | undefined;
        if (choice?.skip) return { events: [] };
        if (!choice?.minionUid || typeof choice.baseIndex !== 'number') return { events: [] };
        const target = state.core.bases[choice.baseIndex]?.minions.find(minion =>
            minion.uid === choice.minionUid
            && minion.controller === playerId
            && choice.baseIndex === context.baseIndex,
        );
        if (!target) return { events: [] };
        const events = [addPowerCounter(target.uid, context.baseIndex, 1, 'base_agrabah_bazaar', timestamp, {
            sourcePlayerId: playerId,
            sourceDefId: 'base_agrabah_bazaar',
            sourceControllerId: playerId,
            sourceBaseIndex: context.baseIndex,
        })];
        const remaining = context.remaining - 1;
        if (remaining <= 0) return { events };
        return {
            events,
            context: {
                matchState: state,
                playerId,
                baseIndex: context.baseIndex,
                now: timestamp,
                remaining,
            },
            nextProgram: agrabahBazaarCounterPromptProgram,
        };
    },
});

const agrabahBazaarActionPromptProgram = createPromptProgram<AgrabahBazaarPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_agrabah_bazaar',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `base_agrabah_bazaar_${context.now}`,
        context.playerId,
        '阿格拉巴集市：选择要弃掉的行动牌',
        buildAgrabahActionOptions(context),
        {
            titleKey: 'ui.base_agrabah_bazaar_title',
            sourceId: 'base_agrabah_bazaar',
            targetType: 'hand',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp, context }) => {
        const choice = value as AgrabahBazaarActionChoice | undefined;
        if (!choice?.cardUid) return { events: [] };
        const action = state.core.players[playerId]?.hand.find(card =>
            card.uid === choice.cardUid && isActionCard(card.defId),
        );
        if (!action) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [action.uid] },
                timestamp,
            } as CardsDiscardedEvent],
            context: {
                matchState: state,
                playerId,
                baseIndex: context.baseIndex,
                now: timestamp,
                remaining: 2,
            },
            nextProgram: agrabahBazaarCounterPromptProgram,
        };
    },
});

function agrabahBazaar(ctx: BaseAbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const action = player.hand.some(card => isActionCard(card.defId));
    const targets = ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex);
    if (!action || targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    if (!ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(agrabahBazaarActionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        baseIndex: ctx.baseIndex,
        now: ctx.now,
        remaining: 2,
    }));
}

function sultansPalace(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.minionUid || ctx.playerId === undefined) return { events: [] };
    const playedHereCount = ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
    if (playedHereCount !== 1) return { events: [] };
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random ?? FALLBACK_RANDOM, ctx.now),
    };
}

export function registerAladdinAbilities(): void {
    registerAbilityProgram('aladdin_aladdin', 'onPlay', { program: createEffectProgram(aladdinOnPlay) });
    registerAbilityProgram('aladdin_aladdin', 'talent', { program: createEffectProgram(aladdinTalent) });
    registerAbilityProgram('aladdin_jasmine', 'talent', { program: createEffectProgram(jasmineTalent) });
    registerAbilityProgram('aladdin_rajah', 'talent', { program: createEffectProgram(rajahTalent) });
    registerAbilityProgram('aladdin_rajah', 'special', { program: createEffectProgram(rajahTalent) });
    registerAbilityProgram('aladdin_palace_guard', 'talent', { program: createEffectProgram(palaceGuardTalent) });
    registerAbilityProgram('aladdin_abu', 'onPlay', { program: createEffectProgram(abuOnPlay) });
    registerAbilityProgram('aladdin_genie', 'talent', { program: createEffectProgram(genieTalent) });
    registerAbilityProgram('aladdin_carpet', 'talent', { program: createEffectProgram(carpetTalent) });
    registerAbilityProgram('aladdin_a_friend_like_me', 'onPlay', { program: createEffectProgram(aFriendLikeMe) });
    registerAbilityProgram('aladdin_cave_of_wonders', 'onPlay', { program: createEffectProgram(caveOfWonders) });
    registerAbilityProgram('aladdin_jafar', 'onPlay', { program: createEffectProgram(jafar) });
    registerAbilityProgram('aladdin_magic_carpet_ride', 'onPlay', { program: createEffectProgram(magicCarpetRide) });
    registerAbilityProgram('aladdin_street_rat', 'onPlay', { program: createEffectProgram(streetRat) });
    registerAbilityProgram('aladdin_the_lamp', 'onPlay', { program: createEffectProgram(theLamp) });
    registerAbilityProgram('aladdin_wish', 'onPlay', { program: createEffectProgram(wish) });
    registerActiveBaseAbility('base_agrabah_bazaar', agrabahBazaar, {
        oncePerTurn: false,
        canUse: ctx => (ctx.state.players[ctx.playerId]?.hand.some(card => isActionCard(card.defId)) ?? false)
            && ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex).length > 0,
    });
    registerBaseAbility('base_sultans_palace', 'onMinionPlayed', sultansPalace, {
        mandatory: false,
        canTrigger: ctx => (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1,
    });
}
