import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerAbility, registerSimpleAbility, requireAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    findMinionOnBases,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    recoverCardsFromDiscard,
    revealDeckTop,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerBaseAbility, registerExtended as registerExtendedBase, type BaseAbilityContext } from '../domain/baseAbilities';
import { appendResolvedActionAbility, getExternalActionEffectiveHandSize } from '../domain/externalActionPlay';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { registerOngoingPowerModifier, registerPowerModifier, type PowerModifierContext } from '../domain/ongoingModifiers';
import { collectLegalActionPlayTargets, validateActionPlaySemantics } from '../domain/playLegality';
import type {
    ActionCardDef,
    CardInstance,
    CardToDeckTopEvent,
    CardsDiscardedEvent,
    DeckReorderedEvent,
    MinionOnBase,
    MinionPlayedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type MinionChoice = { minionUid?: string; defId?: string; baseIndex?: number; skip?: boolean };
type ActionChoice = { cardUid?: string; defId?: string; ownerId?: PlayerId; targetBaseIndex?: number; targetMinionUid?: string; skip?: boolean };
type CardChoice = { cardUid?: string; defId?: string; skip?: boolean };
type ModeChoice = { mode?: 'draw' | 'action'; skip?: boolean };

type RuntimeResult = { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> };
type PromptContext<T extends Record<string, unknown> = Record<string, never>> = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
} & T;
type EnsignRedirectChoice = { redirect?: boolean; skip?: boolean };

const ALL_STARS_POD_ABILITY_ALIASES = [
    ['all_stars_seeing_stars_pod', 'onPlay', 'ninja_seeing_stars'],
    ['all_stars_begin_the_summoning_pod', 'onPlay', 'elder_thing_begin_the_summoning_pod'],
    ['all_stars_non_infinite_loop_pod', 'onPlay', 'geeks_non_infinite_loop'],
    ['all_stars_ghostly_arrival_pod', 'onPlay', 'ghost_ghostly_arrival'],
    ['all_stars_favor_of_dionysus_pod', 'onPlay', 'mythic_greeks_favor_of_dionysus'],
    ['all_stars_servitor_of_cthulhu_pod', 'talent', 'cthulhu_servitor'],
    ['all_stars_fan_pod', 'special', 'geeks_fan'],
    ['all_stars_puck_pod', 'onPlay', 'fairies_puck'],
    ['all_stars_lab_assistant_pod', 'onPlay', 'frankenstein_lab_assistant'],
] as const;

function registerAbilityAlias(
    targetDefId: string,
    tag: Parameters<typeof requireAbility>[1],
    sourceDefId: string,
): void {
    registerAbility(targetDefId, tag, requireAbility(sourceDefId, tag, `All-Stars POD reprint ${targetDefId}`));
}

function runtimeToAbilityResult(result: RuntimeResult): AbilityResult {
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function withEnsignRedirectSkip(event: SmashUpEvent): SmashUpEvent {
    return {
        ...event,
        payload: {
            ...((event as { payload?: Record<string, unknown> }).payload ?? {}),
            skipEnsignRedirect: true,
        },
    } as SmashUpEvent;
}

function buildEnsignRedirectedAffectEvent(
    event: SmashUpEvent,
    ensign: MinionOnBase,
    ensignBaseIndex: number,
): SmashUpEvent | undefined {
    const payload = ((event as { payload?: Record<string, unknown> }).payload ?? {}) as Record<string, unknown>;
    const basePayload = { ...payload, skipEnsignRedirect: true };
    switch (event.type) {
        case SU_EVENTS.MINION_DESTROYED:
            return {
                ...event,
                payload: {
                    ...basePayload,
                    minionUid: ensign.uid,
                    minionDefId: ensign.defId,
                    fromBaseIndex: ensignBaseIndex,
                    ownerId: ensign.owner,
                    controllerId: ensign.controller,
                },
            } as SmashUpEvent;
        case SU_EVENTS.MINION_RETURNED:
            return {
                ...event,
                payload: {
                    ...basePayload,
                    minionUid: ensign.uid,
                    minionDefId: ensign.defId,
                    fromBaseIndex: ensignBaseIndex,
                    toPlayerId: ensign.owner,
                },
            } as SmashUpEvent;
        case SU_EVENTS.MINION_MOVED:
            return {
                ...event,
                payload: {
                    ...basePayload,
                    minionUid: ensign.uid,
                    minionDefId: ensign.defId,
                    fromBaseIndex: ensignBaseIndex,
                },
            } as SmashUpEvent;
        case SU_EVENTS.POWER_COUNTER_ADDED:
        case SU_EVENTS.POWER_COUNTER_REMOVED:
        case SU_EVENTS.TEMP_POWER_ADDED:
        case SU_EVENTS.PERMANENT_POWER_ADDED:
            return {
                ...event,
                payload: {
                    ...basePayload,
                    minionUid: ensign.uid,
                    baseIndex: ensignBaseIndex,
                },
            } as SmashUpEvent;
        case SU_EVENTS.ONGOING_ATTACHED:
            if (payload.targetType !== 'minion') return undefined;
            return {
                ...event,
                payload: {
                    ...basePayload,
                    targetBaseIndex: ensignBaseIndex,
                    targetMinionUid: ensign.uid,
                },
            } as SmashUpEvent;
        default:
            return undefined;
    }
}

const ensignRedirectPrompt = createPromptProgram<
    PromptContext<{
        ensignUid: string;
        originalEvent: SmashUpEvent;
    }>,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'all_stars_ensign_redirect',
    interactionSourceIds: ['all_stars_ensign'],
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `all_stars_ensign_${context.ensignUid}_${context.now}`,
        context.playerId,
        '少尉：是否改为影响少尉？',
        [
            createSkipOption(),
            {
                id: 'redirect',
                label: '改为影响少尉',
                labelKey: 'ui.all_stars_ensign_redirect_option',
                value: { redirect: true } satisfies EnsignRedirectChoice,
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'all_stars_ensign',
            titleKey: 'ui.all_stars_ensign_redirect_title',
            targetType: 'generic',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value }) => {
        const choice = value as EnsignRedirectChoice | undefined;
        if (!choice?.redirect || choice.skip) {
            return { events: [withEnsignRedirectSkip(context.originalEvent)] };
        }
        const live = state.core.bases
            .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
            .find(candidate => candidate.minion.uid === context.ensignUid);
        if (!live) return { events: [] };
        const redirected = buildEnsignRedirectedAffectEvent(context.originalEvent, live.minion, live.baseIndex);
        return { events: redirected ? [redirected] : [] };
    },
});

function isActionAffectSource(ctx: TriggerContext): boolean {
    const payload = ((ctx.affectEvent as { payload?: Record<string, unknown> } | undefined)?.payload ?? {}) as Record<string, unknown>;
    if (payload.sourceKind === 'action') return true;
    const sourceDefId = (ctx.sourceDefId as string | undefined) ?? (payload.sourceDefId as string | undefined);
    return !!sourceDefId && getCardDef(sourceDefId)?.type === 'action';
}

function canBuildEnsignRedirect(event: SmashUpEvent | undefined): boolean {
    if (!event) return false;
    return event.type === SU_EVENTS.MINION_DESTROYED
        || event.type === SU_EVENTS.MINION_RETURNED
        || event.type === SU_EVENTS.MINION_MOVED
        || event.type === SU_EVENTS.POWER_COUNTER_ADDED
        || event.type === SU_EVENTS.POWER_COUNTER_REMOVED
        || event.type === SU_EVENTS.TEMP_POWER_ADDED
        || event.type === SU_EVENTS.PERMANENT_POWER_ADDED
        || event.type === SU_EVENTS.ONGOING_ATTACHED;
}

function ensignRedirectReplacement(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceCardUid || !ctx.sourceControllerId) return { events: [] };
    if (!canBuildEnsignRedirect(ctx.affectEvent)) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(ensignRedirectPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        ensignUid: ctx.sourceCardUid,
        originalEvent: ctx.affectEvent!,
    }));
}

function allMinionCandidates(core: SmashUpCore, predicate: (minion: MinionOnBase, baseIndex: number) => boolean) {
    return core.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => predicate(minion, baseIndex))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })),
    );
}

function cardToDeckTop(card: CardInstance, ownerId: PlayerId, reason: string, now: number, sourcePlayerId?: PlayerId): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId,
            reason,
            sourcePlayerId,
            sourceDefId: reason,
            sourceControllerId: sourcePlayerId,
        },
        timestamp: now,
    };
}

function actionSelfToDeckTop(ctx: AbilityContext, reason: string): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            ownerId: ctx.playerId,
            reason,
            sourcePlayerId: ctx.playerId,
            sourceDefId: reason,
            sourceControllerId: ctx.playerId,
        },
        timestamp: ctx.now,
    };
}

function playDeckMinionEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const player = core.players[playerId];
    const base = core.bases[baseIndex];
    if (!player || !base) return [];
    const rest = player.deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid);
    return [
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: [card.uid, ...rest] },
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
                power: getMinionLikePower(card.defId) ?? 0,
                fromDeck: true,
                consumesNormalLimit: false,
                discardPlaySourceId: reason,
            },
            timestamp: now,
        } as MinionPlayedEvent,
    ];
}

function buildStandardHandActionOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    cards: CardInstance[],
    effectiveHandSize: number,
    excludedCardUid?: string,
): Array<{ id: string; label: string; value: ActionChoice; displayMode: 'card' }> {
    return cards.flatMap((card) => {
        if (card.uid === excludedCardUid) return [];
        const def = getCardDef(card.defId) as ActionCardDef | undefined;
        if (def?.type !== 'action' || def.subtype !== 'standard') return [];

        const actionName = def.name ?? card.defId;
        const targets = collectLegalActionPlayTargets(core, playerId, {
            defId: card.defId,
            effectiveHandSize,
        });
        const baseValue = {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
        };

        if (targets.mode === 'none') {
            if (targets.firstError) return [];
            return [{
                id: card.uid,
                label: actionName,
                value: baseValue satisfies ActionChoice,
                displayMode: 'card' as const,
            }];
        }

        if (targets.mode === 'base') {
            return targets.baseIndices.map(baseIndex => ({
                id: `${card.uid}_base_${baseIndex}`,
                label: `${actionName} → ${getBaseDef(core.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`}`,
                value: { ...baseValue, targetBaseIndex: baseIndex } satisfies ActionChoice,
                displayMode: 'card' as const,
            }));
        }

        const legalMinionUids = new Set(targets.minionUids);
        return core.bases.flatMap((base, baseIndex) => {
            const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
            return base.minions
                .filter(minion => legalMinionUids.has(minion.uid))
                .map(minion => ({
                    id: `${card.uid}_minion_${minion.uid}`,
                    label: `${actionName} → ${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseName}`,
                    value: {
                        ...baseValue,
                        targetBaseIndex: baseIndex,
                        targetMinionUid: minion.uid,
                    } satisfies ActionChoice,
                    displayMode: 'card' as const,
                }));
        });
    });
}

function executeNonInfiniteLoopAction(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    card: CardInstance,
    timestamp: number,
    random: AbilityContext['random'],
    targetBaseIndex?: number,
    targetMinionUid?: string,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const def = getCardDef(card.defId) as ActionCardDef | undefined;
    if (def?.type !== 'action' || def.subtype !== 'standard') {
        return { state, events: [] };
    }

    const effectiveHandSize = getExternalActionEffectiveHandSize(state, playerId, true);
    const validation = validateActionPlaySemantics(state.core, playerId, {
        defId: card.defId,
        targetBaseIndex,
        targetMinionUid,
        effectiveHandSize,
    });
    if (!validation.valid) {
        return { state, events: [] };
    }

    const events: SmashUpEvent[] = [
        grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'all_stars_non_infinite_loop'),
        buildActionPlayedEvent({
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            isExtraAction: true,
            targetBaseIndex,
            targetMinionUid,
            timestamp,
        }) as SmashUpEvent,
    ];
    const appended = appendResolvedActionAbility({
        state,
        events,
        playerId,
        cardUid: card.uid,
        defId: card.defId,
        random,
        timestamp,
        baseIndex: targetBaseIndex ?? 0,
        targetBaseIndex,
        targetMinionUid,
    });
    appended.events.push({
        type: SU_EVENTS.ACTION_RETURN_TO_HAND_OPTION_ARMED,
        payload: {
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            reason: 'all_stars_non_infinite_loop',
        },
        timestamp,
    } as SmashUpEvent);
    return appended;
}

function squareDeal(ctx: AbilityContext): AbilityResult {
    const hand = ctx.state.players[ctx.playerId]?.hand.length ?? 0;
    const otherCounts = Object.entries(ctx.state.players)
        .filter(([playerId]) => playerId !== ctx.playerId)
        .map(([, player]) => player.hand.length);
    if (otherCounts.length === 0) return { events: [] };
    const minimumOtherHand = Math.min(...otherCounts);
    const drawCount = Math.max(0, minimumOtherHand - hand + 1);
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now) };
}

function favorOfDionysus(ctx: AbilityContext): AbilityResult {
    const candidates = allMinionCandidates(ctx.state, minion => minion.controller === ctx.playerId);
    const events: SmashUpEvent[] = [grantContextualExtraAction(ctx, 'all_stars_favor_of_dionysus'), actionSelfToDeckTop(ctx, 'all_stars_favor_of_dionysus')];
    if (candidates.length === 0) return { events };
    const interaction = createSimpleChoice(
        `all_stars_favor_of_dionysus_${ctx.now}`,
        ctx.playerId,
        '狄俄尼索斯的青睐：选择你的一个随从 +1',
        [
            createSkipOption(),
            ...buildMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'all_stars_favor_of_dionysus',
                sourceKind: 'action',
                effectType: 'power_change',
            }),
        ],
        { sourceId: 'all_stars_favor_of_dionysus', titleKey: 'ui.all_stars_favor_of_dionysus_title', targetType: 'minion', responseValidationMode: 'live' },
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function gelfTalent(ctx: AbilityContext): AbilityResult {
    const live = findMinionOnBases(ctx.state, ctx.cardUid);
    const player = ctx.state.players[ctx.playerId];
    if (!live || live.minion.controller !== ctx.playerId || !player) return { events: [] };
    const candidates = player.deck.filter(card => {
        if (card.defId === 'all_stars_gelf') return false;
        const power = getMinionLikePower(card.defId);
        return power !== undefined && power <= 4;
    });
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `all_stars_gelf_${ctx.now}`,
        ctx.playerId,
        '基因工程生命体：选择牌库中力量 4 或以下的非 G.E.L.F. 随从',
        [
            createSkipOption(),
            ...candidates.map(card => ({
                id: card.uid,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId } satisfies CardChoice,
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: 'all_stars_gelf', titleKey: 'ui.all_stars_gelf_title', targetType: 'deck', responseValidationMode: 'live' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        minionUid: live.minion.uid,
        defId: live.minion.defId,
        ownerId: live.minion.owner,
        baseIndex: live.baseIndex,
    };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function grannyTalent(ctx: AbilityContext): AbilityResult {
    const top = ctx.state.players[ctx.playerId]?.deck[0];
    if (!top) return { events: [] };
    const interaction = createSimpleChoice(
        `all_stars_granny_${ctx.now}`,
        ctx.playerId,
        '老奶奶：将牌库顶牌留在牌库顶或置底',
        [
            { id: 'top', label: '留在牌库顶', labelKey: 'ui.all_stars_granny_top_option', value: { mode: 'top' }, displayMode: 'button' as const },
            { id: 'bottom', label: '置于牌库底', labelKey: 'ui.all_stars_granny_bottom_option', value: { mode: 'bottom' }, displayMode: 'button' as const },
        ],
        { sourceId: 'all_stars_granny', titleKey: 'ui.all_stars_granny_title', targetType: 'button', displayCard: { defId: top.defId, cardUid: top.uid } },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = { cardUid: top.uid };
    return {
        events: [
            inspectDeck(ctx.playerId, ctx.playerId, 1, 'all_stars_granny', ctx.now),
            revealDeckTop(ctx.playerId, ctx.playerId, [{ uid: top.uid, defId: top.defId }], 1, 'all_stars_granny', ctx.now, ctx.playerId),
        ],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function seeingStars(ctx: AbilityContext): AbilityResult {
    const candidates = allMinionCandidates(ctx.state, (minion, baseIndex) => getMinionPower(ctx.state, minion, baseIndex) <= 3);
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `all_stars_seeing_stars_${ctx.now}`,
        ctx.playerId,
        '看星星：选择力量 3 或以下的随从',
        buildMinionTargetOptions(candidates, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'all_stars_seeing_stars',
            sourceKind: 'action',
            effectType: 'destroy',
        }),
        { sourceId: 'all_stars_seeing_stars', titleKey: 'ui.all_stars_seeing_stars_title', targetType: 'minion', responseValidationMode: 'live' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function beginTheSummoning(ctx: AbilityContext): AbilityResult {
    const minion = ctx.state.players[ctx.playerId]?.discard.find(card => getMinionLikePower(card.defId) !== undefined);
    return {
        events: [
            ...(minion ? [cardToDeckTop(minion, minion.owner, 'all_stars_begin_the_summoning', ctx.now, ctx.playerId)] : []),
            grantContextualExtraAction(ctx, 'all_stars_begin_the_summoning'),
        ],
    };
}

function ghostlyArrival(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraMinion(ctx, 'all_stars_ghostly_arrival'),
            grantContextualExtraAction(ctx, 'all_stars_ghostly_arrival'),
        ],
    };
}

function friendshipPower(ctx: AbilityContext): AbilityResult {
    const candidates = allMinionCandidates(ctx.state, minion => minion.controller === ctx.playerId);
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `all_stars_friendship_power_${ctx.now}`,
        ctx.playerId,
        '友情的力量：选择要移动的随从',
        [
            createSkipOption(),
            ...buildMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'all_stars_friendship_power',
                sourceKind: 'action',
                semanticRole: 'reference',
                effectType: 'move',
            }),
        ],
        { sourceId: 'all_stars_friendship_power', titleKey: 'ui.all_stars_friendship_power_title', targetType: 'minion', responseValidationMode: 'live' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = { actionCardUid: ctx.cardUid };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function nonInfiniteLoop(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const actionOptions = buildStandardHandActionOptions(
        ctx.state,
        ctx.playerId,
        player.hand,
        getExternalActionEffectiveHandSize(ctx.matchState, ctx.playerId, true),
        ctx.cardUid,
    );
    if (actionOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `all_stars_non_infinite_loop_${ctx.now}`,
        ctx.playerId,
        '非无穷循环：选择手牌中的一个行动',
        [createSkipOption(), ...actionOptions],
        { sourceId: 'all_stars_non_infinite_loop', titleKey: 'ui.all_stars_non_infinite_loop_title', targetType: 'hand', responseValidationMode: 'live' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function itsAstounding(ctx: AbilityContext): AbilityResult {
    const action = ctx.state.players[ctx.playerId]?.discard.find(card => getCardDef(card.defId)?.type === 'action');
    if (!action) return { events: [] };
    return {
        events: [buildActionPlayedEvent({
            playerId: ctx.playerId,
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.owner,
            isExtraAction: true,
            fromDiscard: true,
            timestamp: ctx.now,
        }) as SmashUpEvent],
    };
}

function puck(ctx: AbilityContext): AbilityResult {
    const interaction = createSimpleChoice(
        `all_stars_puck_${ctx.now}`,
        ctx.playerId,
        '小精灵：选择效果',
        [
            { id: 'action', label: '额外打出一个行动', labelKey: 'ui.all_stars_puck_action_option', value: { mode: 'action' }, displayMode: 'button' as const },
            { id: 'draw', label: '抽 1 张牌', labelKey: 'ui.all_stars_puck_draw_option', value: { mode: 'draw' }, displayMode: 'button' as const },
        ],
        { sourceId: 'all_stars_puck', titleKey: 'ui.all_stars_puck_title', targetType: 'button' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function labAssistant(ctx: AbilityContext): AbilityResult {
    const candidates = allMinionCandidates(ctx.state, minion =>
        minion.controller === ctx.playerId && minion.uid !== ctx.cardUid);
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `all_stars_lab_assistant_${ctx.now}`,
        ctx.playerId,
        '实验室助理：选择你的另一个随从',
        buildMinionTargetOptions(candidates, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'all_stars_lab_assistant',
            sourceKind: 'nonAction',
            effectType: 'power_change',
        }),
        { sourceId: 'all_stars_lab_assistant', titleKey: 'ui.all_stars_lab_assistant_title', targetType: 'minion', responseValidationMode: 'live' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function prepareForBattle(ctx: AbilityContext): AbilityResult {
    const top = ctx.state.players[ctx.playerId]?.deck.slice(0, 2) ?? [];
    if (top.length === 0) return { events: [] };
    const revealEvents = [
        inspectDeck(ctx.playerId, ctx.playerId, top.length, 'all_stars_prepare_for_battle', ctx.now),
        revealDeckTop(ctx.playerId, 'all', top.map(card => ({ uid: card.uid, defId: card.defId })), top.length, 'all_stars_prepare_for_battle', ctx.now, ctx.playerId),
    ];
    if (top.length === 1) {
        return {
            events: [
                ...revealEvents,
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId: ctx.playerId, count: 1, cardUids: [top[0].uid] },
                    timestamp: ctx.now,
                } as SmashUpEvent,
            ],
        };
    }
    const interaction = createSimpleChoice(
        `all_stars_prepare_for_battle_${ctx.now}`,
        ctx.playerId,
        '准备战斗：选择加入手牌的牌',
        top.map(card => ({
            id: card.uid,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId } satisfies CardChoice,
            displayMode: 'card' as const,
        })),
        { sourceId: 'all_stars_prepare_for_battle', titleKey: 'ui.all_stars_prepare_for_battle_title', targetType: 'hand', responseValidationMode: 'live' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        cardUids: top.map(card => card.uid),
    };
    return {
        events: revealEvents,
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function sproutTurnStart(ctx: import('../domain/ongoingEffects').TriggerContext) {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceOwnerPlayerId) return [];
    const target = ctx.state.players[ctx.sourceOwnerPlayerId]?.deck.find(card => {
        const power = getMinionLikePower(card.defId);
        return power !== undefined && power <= 3;
    });
    return [
        ...buildValidatedDestroyEvents(ctx.matchState ?? ctx.state, {
            minionUid: ctx.sourceCardUid,
            minionDefId: ctx.sourceDefId ?? 'all_stars_sprout',
            fromBaseIndex: ctx.sourceBaseIndex,
            destroyerId: ctx.sourceOwnerPlayerId,
            reason: 'all_stars_sprout',
            now: ctx.now,
            sourcePlayerId: ctx.sourceOwnerPlayerId,
            sourceDefId: 'all_stars_sprout',
            sourceControllerId: ctx.sourceOwnerPlayerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            sourceKind: 'nonAction',
        }),
        ...(target ? playDeckMinionEvents(ctx.state, ctx.sourceOwnerPlayerId, target, ctx.sourceBaseIndex, 'all_stars_sprout', ctx.now) : []),
    ];
}

function fanSpecial(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: ctx.playerId, cardUids: [ctx.cardUid] },
                timestamp: ctx.now,
            } as CardsDiscardedEvent,
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        ],
    };
}

function servitorTalent(ctx: AbilityContext): AbilityResult {
    const live = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!live || live.minion.controller !== ctx.playerId) return { events: [] };
    const action = ctx.state.players[ctx.playerId]?.discard.find(card => getCardDef(card.defId)?.type === 'action');
    return {
        events: [
            ...buildValidatedDestroyEvents(ctx.matchState, {
                minionUid: live.minion.uid,
                minionDefId: live.minion.defId,
                fromBaseIndex: live.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'all_stars_servitor_of_cthulhu',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'all_stars_servitor_of_cthulhu',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: live.baseIndex,
                sourceKind: 'nonAction',
            }),
            ...(action ? [cardToDeckTop(action, action.owner, 'all_stars_servitor_of_cthulhu', ctx.now, ctx.playerId)] : []),
        ],
    };
}

function lockerRoom(ctx: BaseAbilityContext) {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random ?? { random: Math.random, shuffle: <T>(items: T[]) => items }, ctx.now) };
}

function stadium(ctx: BaseAbilityContext) {
    const controller = ctx.controllerId ?? ctx.playerId;
    return { events: buildStandardDrawEvents(ctx.state, controller, 1, ctx.random ?? { random: Math.random, shuffle: <T>(items: T[]) => items }, ctx.now) };
}


function allStarsPodItsAstounding(ctx: AbilityContext): AbilityResult {
    const baseAbility = requireAbility('time_travelers_its_astounding', 'onPlay', 'All-Stars POD reprint');
    return baseAbility({ ...ctx, defId: 'time_travelers_its_astounding' });
}

function allStarsPodFriendshipPower(ctx: AbilityContext): AbilityResult {
    const baseAbility = requireAbility('mythic_horses_friendship_power', 'onPlay', 'All-Stars POD reprint');
    return baseAbility({ ...ctx, defId: 'mythic_horses_friendship_power' });
}

function allStarsPodSquareDeal(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };

    const otherHandSizes = Object.entries(ctx.state.players)
        .filter(([playerId]) => playerId !== ctx.playerId)
        .map(([, otherPlayer]) => otherPlayer.hand.length);
    let drawCount = 0;
    let simulatedHandSize = player.hand.length;
    let simulatedDeckSize = player.deck.length;
    let simulatedDiscardSize = player.discard.length;
    const hasOtherPlayerWithFewerCards = () => otherHandSizes.some(handSize => handSize < simulatedHandSize);

    while (!hasOtherPlayerWithFewerCards() && (simulatedDeckSize > 0 || simulatedDiscardSize > 0)) {
        drawCount += 1;
        simulatedHandSize += 1;
        if (simulatedDeckSize > 0) {
            simulatedDeckSize -= 1;
        } else {
            simulatedDeckSize = Math.max(0, simulatedDiscardSize - 1);
            simulatedDiscardSize = 0;
        }
    }

    if (drawCount === 0) return { events: [] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now) };
}

function allStarsPodPrepareForBattle(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const topCards = player.deck.slice(0, 3);
    if (topCards.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }

    const drawCount = Math.min(2, topCards.length);
    const events: SmashUpEvent[] = buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now);
    const returnedCard = topCards[drawCount];
    if (returnedCard) {
        events.push(...buildValidatedCardToDeckBottomEvents(ctx.state, {
            cardUid: returnedCard.uid,
            defId: returnedCard.defId,
            ownerId: returnedCard.owner,
            sourcePlayerId: ctx.playerId,
            reason: 'all_stars_prepare_for_battle_pod',
            now: ctx.now,
            expectedLocation: 'deck',
        }));
    }
    return { events };
}

function allStarsPodGelf(ctx: AbilityContext): AbilityResult {
    const baseAbility = requireAbility('shapeshifters_gelf', 'talent', 'All-Stars POD reprint');
    return baseAbility({ ...ctx, defId: 'shapeshifters_gelf' });
}

function allStarsPodGranny(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const topCard = player?.deck[0];
    if (!topCard) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    return {
        events: buildValidatedCardToDeckBottomEvents(ctx.state, {
            cardUid: topCard.uid,
            defId: topCard.defId,
            ownerId: topCard.owner,
            sourcePlayerId: ctx.playerId,
            reason: 'all_stars_granny_pod',
            now: ctx.now,
            expectedLocation: 'deck',
        }),
    };
}

function allStarsPodFullMoonModifier(ctx: PowerModifierContext): number {
    if (ctx.base.ongoingActions.some(action => action.defId === 'all_stars_full_moon_pod' && action.ownerId === ctx.minion.controller)) {
        return 1;
    }
    return 0;
}

function allStarsPodImperialDragonTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}
function registerAllStarsTriggers(): void {
    registerTrigger('all_stars_imperial_dragon', 'onMinionPlayed', (ctx) => {
        const controller = ctx.sourceControllerId;
        if (!controller) return [];
        return buildStandardDrawEvents(ctx.state, controller, 1, ctx.random, ctx.now);
    }, {
        perInstance: true,
        mandatory: true,
        canTrigger: ctx => ctx.baseIndex === ctx.sourceBaseIndex
            && ctx.playerId !== ctx.sourceControllerId
            && ctx.triggerMinionUid !== ctx.sourceCardUid,
    });

    registerTrigger('all_stars_imperial_dragon', 'onMinionMoved', (ctx) => {
        const controller = ctx.sourceControllerId;
        if (!controller) return [];
        return buildStandardDrawEvents(ctx.state, controller, 1, ctx.random, ctx.now);
    }, {
        perInstance: true,
        mandatory: true,
        canTrigger: ctx => ctx.moveToBaseIndex === ctx.sourceBaseIndex
            && ctx.playerId !== ctx.sourceControllerId
            && ctx.triggerMinionUid !== ctx.sourceCardUid,
    });

    registerTrigger('all_stars_ensign', 'onMinionAffected', ensignRedirectReplacement, {
        phase: 'replacement',
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: true,
        canTrigger: ctx => !!ctx.sourceControllerId
            && !!ctx.sourceCardUid
            && ctx.playerId !== ctx.sourceControllerId
            && ctx.baseIndex === ctx.sourceBaseIndex
            && ctx.triggerMinionUid !== undefined
            && ctx.triggerMinionUid !== ctx.sourceCardUid
            && ctx.controllerId === ctx.sourceControllerId
            && isActionAffectSource(ctx)
            && canBuildEnsignRedirect(ctx.affectEvent),
    });

    registerTrigger('all_stars_sprout', 'onTurnStart', sproutTurnStart, {
        perInstance: true,
        mandatory: true,
        playerContext: 'sourceController',
    });
    registerTrigger('all_stars_sprout_pod', 'onTurnStart', sproutTurnStart, {
        perInstance: true,
        mandatory: true,
        playerContext: 'sourceController',
    });
    registerTrigger('all_stars_imperial_dragon_pod', 'onMinionPlayed', allStarsPodImperialDragonTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: ctx => !!ctx.sourceControllerId && ctx.playerId !== ctx.sourceControllerId,
    });
    registerTrigger('all_stars_imperial_dragon_pod', 'onMinionMoved', allStarsPodImperialDragonTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: ctx => (
            !!ctx.sourceControllerId
            && ctx.playerId !== ctx.sourceControllerId
            && ctx.baseIndex !== undefined
            && ctx.moveToBaseIndex !== undefined
            && ctx.baseIndex === ctx.moveToBaseIndex
        ),
    });
}

export function registerAllStarsAbilities(): void {
    registerSimpleAbility('all_stars_square_deal', 'onPlay', squareDeal);
    registerSimpleAbility('all_stars_favor_of_dionysus', 'onPlay', favorOfDionysus);
    registerSimpleAbility('all_stars_gelf', 'onPlay', gelfTalent);
    registerSimpleAbility('all_stars_gelf', 'talent', gelfTalent);
    registerSimpleAbility('all_stars_granny', 'talent', grannyTalent);
    registerSimpleAbility('all_stars_seeing_stars', 'onPlay', seeingStars);
    registerSimpleAbility('all_stars_begin_the_summoning', 'onPlay', beginTheSummoning);
    registerSimpleAbility('all_stars_ghostly_arrival', 'onPlay', ghostlyArrival);
    registerSimpleAbility('all_stars_friendship_power', 'onPlay', friendshipPower);
    registerSimpleAbility('all_stars_non_infinite_loop', 'onPlay', nonInfiniteLoop);
    registerSimpleAbility('all_stars_its_astounding', 'onPlay', itsAstounding);
    registerSimpleAbility('all_stars_puck', 'onPlay', puck);
    registerSimpleAbility('all_stars_lab_assistant', 'onPlay', labAssistant);
    registerSimpleAbility('all_stars_prepare_for_battle', 'onPlay', prepareForBattle);
    registerSimpleAbility('all_stars_fan', 'special', fanSpecial);
    registerSimpleAbility('all_stars_servitor_of_cthulhu', 'talent', servitorTalent);
    for (const [targetDefId, tag, sourceDefId] of ALL_STARS_POD_ABILITY_ALIASES) {
        registerAbilityAlias(targetDefId, tag, sourceDefId);
    }
    registerAbility('all_stars_its_astounding_pod', 'onPlay', allStarsPodItsAstounding);
    registerAbility('all_stars_friendship_power_pod', 'onPlay', allStarsPodFriendshipPower);
    registerAbility('all_stars_square_deal_pod', 'onPlay', allStarsPodSquareDeal);
    registerAbility('all_stars_prepare_for_battle_pod', 'onPlay', allStarsPodPrepareForBattle);
    registerAbility('all_stars_gelf_pod', 'talent', allStarsPodGelf);
    registerAbility('all_stars_granny_pod', 'talent', allStarsPodGranny);
    registerPowerModifier('all_stars_full_moon_pod', allStarsPodFullMoonModifier, { podStrategy: 'override' });

    registerOngoingPowerModifier('all_stars_full_moon', 'base', 'ownerMinions', 1);
    registerBaseAbility('base_locker_room', 'onTurnStart', lockerRoom, {
        mandatory: false,
        canTrigger: ctx => ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.controller === ctx.playerId) ?? false,
    });
    registerExtendedBase('base_stadium', 'onMinionDestroyed', stadium, {
        mandatory: false,
        ownerPlayerId: ctx => ctx.controllerId ?? ctx.playerId,
    });
    registerAllStarsTriggers();
}

export function registerAllStarsInteractionHandlers(): void {
    registerInteractionHandler('all_stars_favor_of_dionysus', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: [addTempPower(selected.minionUid, selected.baseIndex, 1, 'all_stars_favor_of_dionysus', timestamp, {
                sourcePlayerId: playerId,
                sourceDefId: 'all_stars_favor_of_dionysus',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
            })],
        };
    });

    registerInteractionHandler('all_stars_granny', (state, playerId, value, data) => {
        const selected = value as { mode?: 'top' | 'bottom' } | undefined;
        const cardUid = (data as { continuationContext?: { cardUid?: string } } | undefined)?.continuationContext?.cardUid;
        const player = state.core.players[playerId];
        if (selected?.mode !== 'bottom' || !cardUid || !player) return { state, events: [] };
        const rest = player.deck.filter(card => card.uid !== cardUid).map(card => card.uid);
        return {
            state,
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: [...rest, cardUid] },
                timestamp: Date.now(),
            } as DeckReorderedEvent],
        };
    });

    registerInteractionHandler('all_stars_gelf', (state, playerId, value, data, random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const context = (data as {
            continuationContext?: { minionUid?: string; defId?: string; ownerId?: PlayerId; baseIndex?: number };
        } | undefined)?.continuationContext;
        if (selected?.skip || !selected?.cardUid || !selected.defId || !context?.minionUid || !context.defId || context.baseIndex === undefined) {
            return { state, events: [] };
        }
        const player = state.core.players[playerId];
        const target = player?.deck.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        const live = state.core.bases[context.baseIndex]?.minions.find(minion =>
            minion.uid === context.minionUid && minion.controller === playerId);
        if (!player || !target || !live) return { state, events: [] };
        const power = getMinionLikePower(target.defId);
        if (power === undefined || power > 4 || target.defId === 'all_stars_gelf') return { state, events: [] };

        const selfToDeck = buildValidatedCardToDeckBottomEvents(state, {
            cardUid: live.uid,
            defId: live.defId,
            ownerId: live.owner,
            sourcePlayerId: playerId,
            sourceDefId: 'all_stars_gelf',
            sourceControllerId: playerId,
            sourceBaseIndex: context.baseIndex,
            reason: 'all_stars_gelf',
            now: timestamp,
            expectedLocation: 'bases',
        });
        if (!selfToDeck.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)) {
            return { state, events: selfToDeck };
        }

        const deckUidsAfterShuffle = random.shuffle([
            ...player.deck.map(card => card.uid),
            live.uid,
        ]);
        return {
            state,
            events: [
                ...selfToDeck,
                {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids: deckUidsAfterShuffle },
                    timestamp,
                } as DeckReorderedEvent,
                {
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: {
                        playerId,
                        cardUid: target.uid,
                        defId: target.defId,
                        ownerId: target.owner,
                        baseIndex: context.baseIndex,
                        baseDefId: state.core.bases[context.baseIndex]?.defId,
                        power,
                        fromDeck: true,
                        consumesNormalLimit: false,
                        discardPlaySourceId: 'all_stars_gelf',
                    },
                    timestamp,
                } as MinionPlayedEvent,
            ],
        };
    });

    registerInteractionHandler('all_stars_seeing_stars', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'all_stars_seeing_stars',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'all_stars_seeing_stars',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
                sourceKind: 'action',
            }),
        };
    });

    registerInteractionHandler('all_stars_friendship_power', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || !selected.defId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const actionCardUid = (data as { continuationContext?: { actionCardUid?: string } } | undefined)
            ?.continuationContext?.actionCardUid;
        const destination = state.core.bases.findIndex((base, baseIndex) =>
            baseIndex !== selected.baseIndex && base.minions.some(minion => minion.controller === playerId));
        if (destination < 0) return { state, events: [] };
        return {
            state,
            events: [
                ...buildValidatedMoveEvents(state, {
                    minionUid: selected.minionUid,
                    minionDefId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                    toBaseIndex: destination,
                    reason: 'all_stars_friendship_power',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceDefId: 'all_stars_friendship_power',
                    sourceControllerId: playerId,
                    sourceBaseIndex: selected.baseIndex,
                    sourceKind: 'action',
                }),
                ...(actionCardUid
                    ? [recoverCardsFromDiscard(playerId, [actionCardUid], 'all_stars_friendship_power', timestamp)]
                    : []),
            ],
        };
    });

    registerInteractionHandler('all_stars_non_infinite_loop', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ActionChoice | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId) return { state, events: [] };
        const player = state.core.players[playerId];
        const card = player?.hand.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId);
        if (!player || !card) return { state, events: [] };
        const resolved = executeNonInfiniteLoopAction(
            state,
            playerId,
            card,
            timestamp,
            _random,
            selected.targetBaseIndex,
            selected.targetMinionUid,
        );
        return { state: resolved.state, events: resolved.events };
    });

    registerInteractionHandler('all_stars_puck', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as ModeChoice | undefined;
        return {
            state,
            events: selected?.mode === 'action'
                ? [grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'all_stars_puck')]
                : buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
        };
    });

    registerInteractionHandler('all_stars_lab_assistant', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'all_stars_lab_assistant', timestamp, {
                sourcePlayerId: playerId,
                sourceDefId: 'all_stars_lab_assistant',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
            })],
        };
    });

    registerInteractionHandler('all_stars_prepare_for_battle', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const player = state.core.players[playerId];
        if (!player || !selected?.cardUid) return { state, events: [] };
        const lockedCardUids = (data as { continuationContext?: { cardUids?: string[] } } | undefined)
            ?.continuationContext?.cardUids ?? player.deck.slice(0, 2).map(card => card.uid);
        if (!lockedCardUids.includes(selected.cardUid)) return { state, events: [] };
        const selectedCard = player.deck.find(card => card.uid === selected.cardUid);
        if (!selectedCard) return { state, events: [] };
        const bottomCard = player.deck.find(card =>
            lockedCardUids.includes(card.uid) && card.uid !== selected.cardUid);
        const rest = player.deck
            .filter(card => !lockedCardUids.includes(card.uid))
            .map(card => card.uid);
        return {
            state,
            events: [
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: 1, cardUids: [selectedCard.uid] },
                    timestamp,
                } as SmashUpEvent,
                ...(bottomCard ? [{
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids: [...rest, bottomCard.uid] },
                    timestamp,
                } as DeckReorderedEvent] : []),
            ],
        };
    });
}
