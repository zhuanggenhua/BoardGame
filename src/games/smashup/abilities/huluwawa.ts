import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbility, registerAbilityProgram, registerSimpleAbility, resolveTalent } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import {
    addPowerCounter,
    addPermanentPower,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildSemanticOngoingAttachEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    createSkipOption,
    findMinionByAttachedCard,
    findMinionOnBases,
    getMinionPower,
    getTitanByUid,
    grantContextualExtraAction,
    inspectDeck,
    moveTitan,
    playTitan,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import { registerDiscardActionPlayProvider } from '../domain/discardActionPlayability';
import { registerBaseAbility } from '../domain/baseAbilities';
import { buildFieldSourceActionOptions, buildFieldSourceActionPromptConfig } from '../domain/fieldInteractionOptions';
import { registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import type {
    ProtectionCheckContext,
    RestrictionCheckContext,
    TriggerContext,
    TriggerResult,
} from '../domain/ongoingEffects';
import { validateActionPlaySemantics } from '../domain/playLegality';
import { registerTitanSpecialValidator } from '../domain/titanAbilityValidators';
import {
    type ActionCardDef,
    type CardInstance,
    type CardsDrawnEvent,
    type DeckReorderedEvent,
    type FusionCardDef,
    type MinionPlayedEvent,
    type SmashUpCore,
    type SmashUpEvent,
    type TalentUsedEvent,
    type TitanMetadataUpdatedEvent,
    SU_COMMANDS,
    SU_EVENTS,
} from '../domain/types';
import { actionLikeNeedsPlayBase, actionLikeNeedsPlayMinion } from '../domain/utils';
import { getBaseDef, getCardDef, getMinionDef } from '../data/cards';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { appendResolvedActionAbility } from '../domain/externalActionPlay';

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
};

type BaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    skip?: boolean;
};

type ButtonChoice = {
    choice?: string;
    skip?: boolean;
};

type CardChoice = {
    cardUid?: string;
    defId?: string;
    power?: number;
    type?: 'minion' | 'action';
    ownerId?: PlayerId;
    sourceZone?: 'deck' | 'hand' | 'discard';
    skip?: boolean;
};

type HuluwawaPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceCardUid?: string;
    sourceBaseIndex?: number;
    sourceKind?: 'action' | 'nonAction';
    titleKey?: string;
    titleParams?: Record<string, string | number>;
};

type HuluwawaSelectMinionContext = HuluwawaPromptContext & {
    sourceDefId: string;
    title: string;
    targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    reason: string;
};

type HuluwawaSelectBaseContext = HuluwawaPromptContext & {
    sourceDefId: string;
    title: string;
    bases: Array<{ baseIndex: number; label: string }>;
    reason: string;
    minionUid?: string;
    minionDefId?: string;
    fromBaseIndex?: number;
};

type HuluwawaSearchCardContext = HuluwawaPromptContext & {
    sourceDefId: string;
    title: string;
    options: Array<{ cardUid: string; defId: string; label: string; sourceZone: 'deck' | 'discard' }>;
    reason: string;
};

type HuluwawaErwaContext = HuluwawaPromptContext & {
    sourceDefId: string;
    topCards: CardInstance[];
    playableCards: CardInstance[];
};

type HuluwawaErwaReorderContext = HuluwawaPromptContext & {
    sourceDefId: string;
    chosenCard?: CardInstance;
    remainingCards: CardInstance[];
    playTargets?: { baseIndex?: number; targetBaseIndex?: number; targetMinionUid?: string };
};

type ErwaReorderChoice = {
    topUids: string[];
    bottomUids: string[];
};

type HuluwawaOneAtATimeContext = HuluwawaPromptContext & {
    sourceDefId: string;
    targetBaseIndex: number;
    returnedMinionDefId: string;
    returnedToPlayerId: PlayerId;
    handCandidates: CardInstance[];
};

let huluwawaPromptCounter = 0;

function createHuluwawaPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): HuluwawaPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function queueOrSetCurrentInteraction(
    state: MatchState<SmashUpCore>,
    interaction: ReturnType<typeof createSimpleChoice>,
): MatchState<SmashUpCore> {
    const currentInteraction = state.sys.interaction?.current;
    const queue = state.sys.interaction?.queue ?? [];
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: currentInteraction
                ? {
                    ...state.sys.interaction,
                    current: currentInteraction,
                    queue: [...queue, interaction],
                }
                : {
                    ...(state.sys.interaction ?? {}),
                    current: interaction,
                    queue,
                },
        },
    };
}

function buildTitanMetadataUpdatedEvent(
    titanUid: string,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): TitanMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.TITAN_METADATA_UPDATED,
        payload: {
            titanUid,
            metadataUpdate,
            reason,
        },
        timestamp: now,
    };
}

function collectAllMinions(core: SmashUpCore) {
    const result: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const base = core.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            result.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseName}`,
            });
        }
    }
    return result;
}

function collectOwnMinions(core: SmashUpCore, playerId: PlayerId) {
    return collectAllMinions(core).filter(target => {
        const live = core.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.uid);
        return live?.controller === playerId;
    });
}

function getOtherBaseChoices(core: SmashUpCore, fromBaseIndex: number) {
    return core.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter(candidate => candidate.baseIndex !== fromBaseIndex);
}

function buildShuffleCardIntoDeckEvents(
    core: SmashUpCore,
    ownerId: PlayerId,
    cardUid: string,
    defId: string,
    reason: string,
    now: number,
    random: RandomFn,
    expectedLocation: 'discard' | 'bases' | 'any' = 'discard',
    source?: {
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): SmashUpEvent[] {
    const owner = core.players[ownerId];
    if (!owner) return [];
    const moveToDeckEvents = buildValidatedCardToDeckBottomEvents(core, {
        cardUid,
        defId,
        ownerId,
        ...(source?.sourcePlayerId !== undefined ? { sourcePlayerId: source.sourcePlayerId } : {}),
        ...(source?.sourceCardUid !== undefined ? { sourceCardUid: source.sourceCardUid } : {}),
        ...(source?.sourceDefId !== undefined ? { sourceDefId: source.sourceDefId } : {}),
        ...(source?.sourceControllerId !== undefined ? { sourceControllerId: source.sourceControllerId } : {}),
        ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
        reason,
        now,
        expectedLocation,
    });
    if (moveToDeckEvents.length === 0) return [];
    const shuffledDeck = random.shuffle([
        ...owner.deck.filter(card => card.uid !== cardUid),
        {
            uid: cardUid,
            defId,
            type: (getCardDef(defId)?.type ?? 'minion') as CardInstance['type'],
            owner: ownerId,
        },
    ]);
    return [
        ...moveToDeckEvents,
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ownerId,
                deckUids: shuffledDeck.map(card => card.uid),
            },
            timestamp: now,
        } as DeckReorderedEvent,
    ];
}

function buildDrawFromDeckAndKeepRemainingEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    chosenCard: CardInstance,
    topCards: CardInstance[],
    bottomCards: CardInstance[],
    now: number,
): SmashUpEvent[] {
    const restOfDeck = core.players[playerId]?.deck.filter(card =>
        card.uid !== chosenCard.uid
        && !topCards.some(entry => entry.uid === card.uid)
        && !bottomCards.some(entry => entry.uid === card.uid),
    ) ?? [];
    return [
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [chosenCard.uid] },
            timestamp: now,
        } as CardsDrawnEvent,
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: [...topCards.map(card => card.uid), ...restOfDeck.map(card => card.uid), ...bottomCards.map(card => card.uid)] },
            timestamp: now,
        } as DeckReorderedEvent,
    ];
}

function buildDeckReorderOnlyEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    revealedCards: CardInstance[],
    topCards: CardInstance[],
    bottomCards: CardInstance[],
    now: number,
): SmashUpEvent[] {
    const restOfDeck = core.players[playerId]?.deck.filter(card =>
        !revealedCards.some(entry => entry.uid === card.uid),
    ) ?? [];
    return [{
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids: [...topCards.map(card => card.uid), ...restOfDeck.map(card => card.uid), ...bottomCards.map(card => card.uid)] },
        timestamp: now,
    } as DeckReorderedEvent];
}

function permuteCards(cards: CardInstance[]): CardInstance[][] {
    if (cards.length <= 1) return [cards];
    return cards.flatMap((card, index) =>
        permuteCards([...cards.slice(0, index), ...cards.slice(index + 1)])
            .map(rest => [card, ...rest]),
    );
}

function buildErwaReorderOptions(cards: CardInstance[]): PromptOption<ErwaReorderChoice>[] {
    if (cards.length === 0) {
        return [{
            id: 'no-remaining',
            label: '无剩余牌需要放回',
            labelKey: 'ui.huluwawa_er_wa_reorder_no_remaining_option',
            value: { topUids: [], bottomUids: [] },
            displayMode: 'button' as const,
        }];
    }
    const options: PromptOption<ErwaReorderChoice>[] = [];
    const seen = new Set<string>();
    for (const orderedCards of permuteCards(cards)) {
        for (let splitIndex = 0; splitIndex <= orderedCards.length; splitIndex++) {
            const topCards = orderedCards.slice(0, splitIndex);
            const bottomCards = orderedCards.slice(splitIndex);
            const topUids = topCards.map(card => card.uid);
            const bottomUids = bottomCards.map(card => card.uid);
            const key = `${topUids.join(',')}|${bottomUids.join(',')}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const topLabel = topCards.map(card => getCardDef(card.defId)?.name ?? card.defId).join(' -> ') || '无';
            const bottomLabel = bottomCards.map(card => getCardDef(card.defId)?.name ?? card.defId).join(' -> ') || '无';
            options.push({
                id: `reorder-${options.length}`,
                label: `顶：${topLabel}；底：${bottomLabel}`,
                value: { topUids, bottomUids },
                displayMode: 'button' as const,
            });
        }
    }
    return options;
}

function playCardAsExtra(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    chosenCard: CardInstance,
    targets: { baseIndex?: number; targetBaseIndex?: number; targetMinionUid?: string },
    random: RandomFn,
    now: number,
    prefixEvents: SmashUpEvent[] = [],
): { matchState: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    if (chosenCard.type === 'minion') {
        const baseIndex = targets.baseIndex ?? 0;
        const minionDef = getMinionDef(chosenCard.defId);
        return {
            matchState: state,
            events: [
                ...prefixEvents,
                {
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: {
                        playerId,
                        cardUid: chosenCard.uid,
                        defId: chosenCard.defId,
                        ownerId: chosenCard.owner,
                        baseIndex,
                        baseDefId: state.core.bases[baseIndex]?.defId,
                        power: minionDef?.power ?? 0,
                        consumesNormalLimit: false,
                    },
                    sourceCommandType: SU_COMMANDS.PLAY_MINION,
                    timestamp: now,
                } as MinionPlayedEvent,
            ],
        };
    }

    if (chosenCard.type !== 'action') {
        return { matchState: state, events: prefixEvents };
    }

    const actionDef = getCardDef(chosenCard.defId) as ActionCardDef | FusionCardDef | undefined;
    const actionSubtype = actionDef?.type === 'fusion' ? actionDef.actionSubtype : actionDef?.subtype;
    const actionEvents: SmashUpEvent[] = [
        ...prefixEvents,
        buildActionPlayedEvent({
            playerId,
            cardUid: chosenCard.uid,
            defId: chosenCard.defId,
            ownerId: chosenCard.owner,
            isExtraAction: true,
            targetBaseIndex: targets.targetBaseIndex,
            targetMinionUid: targets.targetMinionUid,
            sourceCommandType: SU_COMMANDS.PLAY_ACTION,
            timestamp: now,
        }) as SmashUpEvent,
    ];

    if (actionSubtype === 'ongoing' && targets.targetBaseIndex !== undefined) {
        actionEvents.push(...buildSemanticOngoingAttachEvents(state, {
            cardUid: chosenCard.uid,
            defId: chosenCard.defId,
            ownerId: chosenCard.owner,
            ...(chosenCard.owner !== playerId ? { sourcePlayerId: playerId } : {}),
            sourceKind: 'action',
            targetBaseIndex: targets.targetBaseIndex,
            targetMinionUid: targets.targetMinionUid,
            onBlockedSourceDestination: 'discard',
            now,
        }));
    }

    const appended = appendResolvedActionAbility({
        state,
        events: actionEvents,
        playerId,
        cardUid: chosenCard.uid,
        defId: chosenCard.defId,
        random,
        timestamp: now,
        baseIndex: targets.targetBaseIndex ?? targets.baseIndex ?? 0,
        targetBaseIndex: targets.targetBaseIndex,
        targetMinionUid: targets.targetMinionUid,
    });

    return { matchState: appended.state, events: appended.events };
}

function huluwawaDaWaTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: [addTempPower(ctx.cardUid, ctx.baseIndex, 2, 'huluwawa_da_wa', ctx.now)],
    };
}

function huluwawaSiWaOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions
        .filter(minion => getMinionPower(ctx.state, minion, ctx.baseIndex) <= 3)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(huluwawaDestroyForCounterProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceDefId: ctx.defId,
        sourceMinionUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
        targets,
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaWuWaTalent(ctx: AbilityContext): AbilityResult {
    const targets = collectAllMinions(ctx.state)
        .filter(target => target.baseIndex !== ctx.baseIndex)
        .filter(target => {
            const live = ctx.state.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.uid);
            return !!live && getMinionPower(ctx.state, live, target.baseIndex) <= 3;
        });
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(huluwawaMoveToSourceBaseProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceBaseIndex: ctx.baseIndex,
        sourceKind: 'nonAction',
        title: '五娃：选择一个力量 3 或更小的仆从移动到这里',
        titleKey: 'ui.huluwawa_wu_wa_title',
        targets,
        targetBaseIndex: ctx.baseIndex,
        reason: 'huluwawa_wu_wa',
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaLiuWaTalent(ctx: AbilityResult extends never ? never : AbilityContext): AbilityResult {
    return {
        events: [addPermanentPower(ctx.cardUid, ctx.baseIndex, -4, 'huluwawa_liu_wa_talent', ctx.now, {
            expiresOnTurnNumber: ctx.matchState.core.turnNumber + ctx.matchState.core.turnOrder.length,
        })],
    };
}

function huluwawaQiWaTalent(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const options = player.deck
        .filter(card => card.type === 'action')
        .map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            label: getCardDef(card.defId)?.name ?? card.defId,
            sourceZone: 'deck' as const,
        }));
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    const result = executeAbilityProgram(huluwawaSearchCardProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceDefId: ctx.defId,
        title: '七娃：从牌库中选择一张行动牌放入手牌',
        titleKey: 'ui.huluwawa_qi_wa_title',
        options,
        reason: 'huluwawa_qi_wa',
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaStrengthInNumbers(ctx: AbilityContext): AbilityResult {
    const base = ctx.targetBaseIndex !== undefined ? ctx.state.bases[ctx.targetBaseIndex] : undefined;
    const baseIndex = ctx.targetBaseIndex;
    if (!base || baseIndex === undefined) return { events: [] };
    const events = base.minions
        .filter(minion => minion.controller === ctx.playerId)
        .map(minion => addTempPower(minion.uid, baseIndex, 1, 'huluwawa_strength_in_numbers', ctx.now));
    return { events };
}

function huluwawaWhereDoYouThinkYoureGoing(ctx: AbilityContext): AbilityResult {
    const destroyTargets = collectAllMinions(ctx.state).filter(target => {
        const live = ctx.state.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.uid);
        return !!live && getMinionPower(ctx.state, live, target.baseIndex) <= 3;
    });
    const moveTargets = collectAllMinions(ctx.state);
    if (destroyTargets.length === 0 && moveTargets.length === 0) return { events: [] };
    const result = executeAbilityProgram(huluwawaWhereDoYouThinkProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
        sourceKind: 'action',
        sourceDefId: ctx.defId,
        destroyTargets,
        moveTargets,
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaJadeRuyi(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const options = [
        ...player.deck.map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            label: `${getCardDef(card.defId)?.name ?? card.defId}（牌库）`,
            sourceZone: 'deck' as const,
        })),
        ...player.discard.map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            label: `${getCardDef(card.defId)?.name ?? card.defId}（弃牌堆）`,
            sourceZone: 'discard' as const,
        })),
    ];
    if (options.length === 0) return { events: [grantContextualExtraAction(ctx, 'huluwawa_jade_ruyi')] };
    const result = executeAbilityProgram(huluwawaSearchCardProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceDefId: ctx.defId,
        title: '玉如意：从牌库和/或弃牌堆中选择一张牌放入手牌',
        titleKey: 'ui.huluwawa_jade_ruyi_title',
        options,
        reason: 'huluwawa_jade_ruyi',
        grantExtraActionAfter: true,
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaPangolinTalent(ctx: AbilityContext): AbilityResult {
    const sourceBaseIndex = findBaseIndexForOngoingAction(ctx.state, ctx.cardUid, ctx.baseIndex);
    if (sourceBaseIndex === undefined) return { events: [] };
    if (ctx.state.bases.length <= 1) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const movable = collectOwnMinions(ctx.state, ctx.playerId)
        .filter(target => target.baseIndex !== undefined);
    if (movable.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(huluwawaPangolinProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceBaseIndex,
        sourceKind: 'nonAction',
        targets: movable,
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaPop(ctx: AbilityContext): AbilityResult {
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now),
    };
}

function huluwawaReleaseMyGrandpa(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraAction(ctx, 'huluwawa_release_my_grandpa'),
            grantContextualExtraAction(ctx, 'huluwawa_release_my_grandpa'),
            ...buildValidatedCardToDeckBottomEvents(ctx.state, {
                cardUid: ctx.cardUid,
                defId: ctx.defId,
                ownerId: ctx.playerId,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                reason: 'huluwawa_release_my_grandpa',
                now: ctx.now,
                expectedLocation: 'any',
            }),
        ],
    };
}

function huluwawaOneVineSevenFlowers(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const uniqueMinions = new Map<string, CardInstance>();
    for (const card of player.discard) {
        if (card.type !== 'minion') continue;
        if (!uniqueMinions.has(card.defId)) {
            uniqueMinions.set(card.defId, card);
        }
    }
    if (uniqueMinions.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const shuffledDeck = ctx.random.shuffle([
        ...player.deck,
        ...Array.from(uniqueMinions.values()),
    ]);
    return {
        events: [
            inspectDeck(ctx.playerId, ctx.playerId, uniqueMinions.size, 'huluwawa_one_vine_seven_flowers', ctx.now),
            {
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ctx.playerId,
                    deckUids: shuffledDeck.map(card => card.uid),
                },
                timestamp: ctx.now,
            } as DeckReorderedEvent,
        ],
    };
}

function huluwawaErWaTalent(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const topCards = player.deck.slice(0, 3);
    if (topCards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    const playableCards = topCards.filter(card => {
        if (card.type === 'minion') return true;
        if (card.type !== 'action') return false;
        const def = getCardDef(card.defId) as ActionCardDef | undefined;
        return !!def && def.subtype !== 'special';
    });
    const result = executeAbilityProgram(huluwawaErWaPromptProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceDefId: ctx.defId,
        topCards,
        playableCards,
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaPurpleGoldGourdTalent(ctx: AbilityContext): AbilityResult {
    const attached = findMinionByAttachedCard(ctx.state, ctx.cardUid);
    if (!attached) return { events: [] };
    const moveTargets = collectAllMinions(ctx.state)
        .filter(target => target.baseIndex !== attached.baseIndex)
        .filter(target => {
            const live = ctx.state.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.uid);
            return !!live && getMinionPower(ctx.state, live, target.baseIndex) <= 3;
        });
    const discardActions = ctx.state.players[ctx.playerId]?.discard.filter(card => card.type === 'action') ?? [];
    const result = executeAbilityProgram(huluwawaPurpleGoldGourdProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceDefId: ctx.defId,
        targetBaseIndex: attached.baseIndex,
        moveTargets,
        discardActions,
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaOneAtATimeTalent(ctx: AbilityContext): AbilityResult {
    const attachedBaseIndex = findBaseIndexForOngoingAction(ctx.state, ctx.cardUid, ctx.baseIndex);
    if (attachedBaseIndex === undefined) return { events: [] };
    const base = ctx.state.bases[attachedBaseIndex];
    if (!base || base.minions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(huluwawaOneAtATimeTargetProgram, createHuluwawaPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceDefId: ctx.defId,
        baseIndex: attachedBaseIndex,
        targets: base.minions.map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: attachedBaseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        })),
    }));
    return { events: result.events, matchState: result.matchState };
}

function huluwawaSanWaReplacement(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.triggerMinionUid || !ctx.triggerMinionDefId || ctx.baseIndex === undefined || !ctx.triggerMinion) return [];
    return buildShuffleCardIntoDeckEvents(
        ctx.state,
        ctx.triggerMinion.owner,
        ctx.triggerMinionUid,
        ctx.triggerMinionDefId,
        'huluwawa_san_wa',
        ctx.now,
        ctx.random,
        'bases',
        {
            sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceCardUid: ctx.sourceCardUid ?? ctx.triggerMinionUid,
            sourceDefId: ctx.sourceDefId ?? ctx.triggerMinionDefId,
            sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        },
    );
}

function huluwawaLiuWaBeforeScoring(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || !ctx.sourceCardUid) return [];
    const source = findMinionOnBases(ctx.state, ctx.sourceCardUid);
    if (!source || source.baseIndex !== ctx.baseIndex) return [];
    const hasEffect = (ctx.state.timedPowerModifiers ?? []).some(modifier =>
        modifier.minionUid === ctx.sourceCardUid && modifier.reason === 'huluwawa_liu_wa_talent',
    );
    if (!hasEffect) return [];
    const sourceDef = getMinionDef(source.minion.defId);
    const interaction = createSimpleChoice(
        `huluwawa_liu_wa_before_scoring_${ctx.sourceCardUid}_${ctx.now}`,
        ctx.sourceControllerId ?? ctx.playerId,
        '六娃：你可以取消自己的天赋效果',
        [
            ...buildFieldSourceActionOptions({
                type: 'minion',
                uid: ctx.sourceCardUid,
                defId: source.minion.defId,
                baseIndex: source.baseIndex,
                label: sourceDef?.name ?? '六娃',
                labelKey: 'ui.huluwawa_liu_wa_cancel_option',
            }, { cancel: true }),
            createSkipOption('保留效果', 'ui.huluwawa_liu_wa_keep_option'),
        ],
        buildFieldSourceActionPromptConfig({
            sourceId: 'huluwawa_liu_wa_before_scoring',
            titleKey: 'ui.huluwawa_liu_wa_before_scoring_title',
        }),
    );
    return {
        events: [],
        matchState: queueOrSetCurrentInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: { minionUid: ctx.sourceCardUid },
            },
        }),
    };
}

function huluwawaQiWaTurnEnd(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.sourceCardUid) return [];
    const source = findMinionOnBases(ctx.state, ctx.sourceCardUid);
    if (!source) return [];
    if ((source.minion.attachedActions?.length ?? 0) === 0) return [];
    return buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
}

function huluwawaNoPresenceScoringRedirect(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.triggerMinionUid || !ctx.triggerMinionDefId || ctx.baseIndex === undefined || !ctx.triggerMinion) return [];
    return buildShuffleCardIntoDeckEvents(
        ctx.state,
        ctx.triggerMinion.owner,
        ctx.triggerMinionUid,
        ctx.triggerMinionDefId,
        'huluwawa_no_presence',
        ctx.now,
        ctx.random,
        'bases',
        {
            sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceCardUid: ctx.sourceCardUid ?? ctx.triggerMinionUid,
            sourceDefId: ctx.sourceDefId ?? ctx.triggerMinionDefId,
            sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        },
    );
}

function huluwawaButterflyDrawOnDetach(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    return buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
}

function huluwawaBaseMountainProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const mountainIndex = ctx.state.bases.findIndex(base => base.defId === 'base_huluwawa_mountain');
    if (mountainIndex === -1 || ctx.targetBaseIndex !== mountainIndex) return false;
    return (ctx.targetMinion.basePower ?? 0) >= 4;
}

function huluwawaWuWaRestriction(ctx: RestrictionCheckContext): boolean {
    if (ctx.restrictionType !== 'play_action') return false;
    return false;
}

function huluwawaOtherPlayerEffectProtection(ctx: ProtectionCheckContext): boolean {
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

function huluwawaSanWaProtection(ctx: ProtectionCheckContext): boolean {
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

function huluwawaLittleKingKongSpecial(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    const base = ctx.state.bases[ctx.baseIndex];
    if (!titan || !base) return { events: [] };
    return {
        events: [playTitan(titan, ctx.playerId, ctx.baseIndex, 'huluwawa_little_king_kong_special', ctx.now, base.defId)],
    };
}

function getLittleKingKongCopyTalentCandidates(core: SmashUpCore, playerId: PlayerId, excludedMinionUid?: string) {
    return collectOwnMinions(core, playerId)
        .filter(target => {
            if (target.uid === excludedMinionUid) return false;
            const live = core.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.uid);
            if (!live || live.talentUsed) return false;
            const def = getMinionDef(live.defId);
            return Boolean(def?.abilityTags?.includes('talent') && resolveTalent(live.defId));
        });
}

function hasLittleKingKongCopiedThisTurn(core: SmashUpCore, titanUid: string): boolean {
    const titan = getTitanByUid(core, titanUid);
    return titan?.metadata?.huluwawaCopiedTalentTurn === core.turnNumber;
}

function huluwawaLittleKingKongOnTalentUsed(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const titanUid = ctx.sourceCardUid;
    if (!titanUid || !ctx.triggerMinionUid || !ctx.matchState) return [];
    if (ctx.sourceControllerId !== ctx.playerId) return [];
    if (hasLittleKingKongCopiedThisTurn(ctx.state, titanUid)) return [];

    const titan = getTitanByUid(ctx.state, titanUid);
    if (!titan || titan.defId !== 'huluwawa_little_king_kong' || titan.location.zone !== 'base') return [];

    const candidates = getLittleKingKongCopyTalentCandidates(ctx.state, ctx.playerId, ctx.triggerMinionUid);
    if (candidates.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `huluwawa_little_king_kong_copy_talent_${ctx.now}`,
        ctx.playerId,
        '葫芦小金刚：你可以令你的另一个仆从发动相同的主动能力',
        [
            createSkipOption('不复制', 'ui.huluwawa_little_king_kong_skip_copy_option'),
            ...candidates.map((target, index) => ({
                id: `copy-talent-${index}`,
                label: target.label,
                value: {
                    minionUid: target.uid,
                    defId: target.defId,
                    minionDefId: target.defId,
                    sourceDefId: target.defId,
                    baseIndex: target.baseIndex,
                    titanUid: titan.uid,
                },
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: 'huluwawa_little_king_kong_copy_talent', targetType: 'minion', titleKey: 'ui.huluwawa_little_king_kong_copy_talent_title' },
    );

    return {
        events: [],
        matchState: queueOrSetCurrentInteraction(ctx.matchState, interaction),
    };
}

const huluwawaDestroyForCounterProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        sourceMinionUid: string;
        sourceBaseIndex: number;
        targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_si_wa',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_si_wa_${huluwawaPromptCounter++}`,
        context.playerId,
        '四娃：你可以摧毁这里一个力量 3 或更小的仆从，为四娃放置 1 个 +1 力量指示物',
        [createSkipOption('跳过', 'ui.skip'), ...buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'destroy',
        })],
        {
            sourceId: 'huluwawa_si_wa',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.huluwawa_si_wa_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [
                ...buildValidatedDestroyEvents(state, {
                    minionUid: selected.minionUid,
                    minionDefId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                    destroyerId: context.playerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.sourceMinionUid,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                    reason: 'huluwawa_si_wa',
                    now: timestamp,
                }),
                addPowerCounter(context.sourceMinionUid, context.sourceBaseIndex, 1, 'huluwawa_si_wa', timestamp),
            ],
        };
    },
});

const huluwawaMoveToSourceBaseProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        title: string;
        targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
        targetBaseIndex: number;
        reason: string;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_move_to_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_move_to_source_${huluwawaPromptCounter++}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'move',
        }),
        {
            sourceId: 'huluwawa_move_to_source',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: context.titleKey,
            titleParams: context.titleParams,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                toBaseIndex: context.targetBaseIndex,
                toBaseDefId: state.core.bases[context.targetBaseIndex]?.defId,
                reason: context.reason,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.sourceBaseIndex ?? context.targetBaseIndex,
                sourceKind: context.sourceKind,
            }),
        };
    },
});

const huluwawaSearchCardProgram = createPromptProgram<
    HuluwawaSearchCardContext & { grantExtraActionAfter?: boolean },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_search_card',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_search_card_${huluwawaPromptCounter++}`,
        context.playerId,
        context.title,
        context.options.map((option, index) => ({
            id: `search-${index}`,
            label: option.label,
            value: option,
            _source: option.sourceZone,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'huluwawa_search_card',
            targetType: 'generic',
            autoResolveIfSingle: false,
            titleKey: context.titleKey,
            titleParams: context.titleParams,
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const selected = value as CardChoice | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.sourceZone) {
            return { matchState: state, events: [] };
        }
        const player = state.core.players[context.playerId];
        if (!player) return { matchState: state, events: [] };

        const events: SmashUpEvent[] = [];
        if (selected.sourceZone === 'deck') {
            const chosen = player.deck.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
            if (!chosen) return { matchState: state, events: [] };
            const shuffledRemaining = random.shuffle(player.deck.filter(card => card.uid !== selected.cardUid));
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: context.playerId, count: 1, cardUids: [selected.cardUid] },
                timestamp,
            } as CardsDrawnEvent);
            if (shuffledRemaining.length > 0) {
                events.push({
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId: context.playerId, deckUids: shuffledRemaining.map(card => card.uid) },
                    timestamp,
                } as DeckReorderedEvent);
            }
        } else {
            events.push(recoverCardsFromDiscard(context.playerId, [selected.cardUid], context.reason, timestamp));
        }
        if (context.grantExtraActionAfter) {
            events.push(grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason));
        }
        return { matchState: state, events };
    },
});

const huluwawaWhereDoYouThinkProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        destroyTargets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
        moveTargets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_where_do_you_think',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_where_do_you_think_${huluwawaPromptCounter++}`,
        context.playerId,
        '妖精哪里逃：选择摧毁一个力量 3 或更小的仆从，或移动一个仆从',
        [
            ...(context.destroyTargets.length > 0
                ? [{ id: 'destroy', label: '摧毁力量 3 或更小的仆从', labelKey: 'ui.huluwawa_where_do_you_think_destroy_option', value: { choice: 'destroy' }, displayMode: 'button' as const }]
                : []),
            ...(context.moveTargets.length > 0
                ? [{ id: 'move', label: '移动一个仆从', labelKey: 'ui.huluwawa_where_do_you_think_move_option', value: { choice: 'move' }, displayMode: 'button' as const }]
                : []),
        ],
        { sourceId: 'huluwawa_where_do_you_think', targetType: 'button', titleKey: 'ui.huluwawa_where_do_you_think_title' },
    ),
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as ButtonChoice | undefined;
        if (selected?.choice === 'destroy') {
            return {
                matchState: state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    playerId,
                    now: timestamp,
                    title: '妖精哪里逃：选择要摧毁的仆从',
                    titleKey: 'ui.huluwawa_where_do_you_think_destroy_title',
                    targets: context.destroyTargets,
                    reason: 'huluwawa_where_do_you_think_destroy',
                },
                nextProgram: huluwawaDestroyAnyProgram,
            };
        }
        if (selected?.choice === 'move') {
            return {
                matchState: state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    playerId,
                    now: timestamp,
                    title: '妖精哪里逃：选择要移动的仆从',
                    titleKey: 'ui.huluwawa_where_do_you_think_move_title',
                    targets: context.moveTargets,
                    reason: 'huluwawa_where_do_you_think_move',
                },
                nextProgram: huluwawaMoveAnyPickProgram,
            };
        }
        return { matchState: state, events: [] };
    },
});

const huluwawaDestroyAnyProgram = createPromptProgram<
    HuluwawaSelectMinionContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_destroy_any',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_destroy_any_${huluwawaPromptCounter++}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'destroy',
        }),
        { sourceId: 'huluwawa_destroy_any', targetType: 'minion', titleKey: context.titleKey, titleParams: context.titleParams },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.playerId,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                reason: context.reason,
                now: timestamp,
            }),
        };
    },
});

const huluwawaMoveAnyPickProgram = createPromptProgram<
    HuluwawaSelectMinionContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_move_any_pick',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_move_any_pick_${huluwawaPromptCounter++}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'move',
        }),
        { sourceId: 'huluwawa_move_any_pick', targetType: 'minion', titleKey: context.titleKey, titleParams: context.titleParams },
    ),
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        const bases = getOtherBaseChoices(state.core, selected.baseIndex);
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
                sourceDefId: context.sourceDefId,
                title: '妖精哪里逃：选择要移动到的基地',
                titleKey: 'ui.huluwawa_where_do_you_think_move_base_title',
                bases,
                reason: context.reason,
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
            },
            nextProgram: huluwawaMoveAnyBaseProgram,
        };
    },
});

const huluwawaMoveAnyBaseProgram = createPromptProgram<
    HuluwawaSelectBaseContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_move_any_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_move_any_base_${huluwawaPromptCounter++}`,
        context.playerId,
        context.title,
        buildBaseTargetOptions(context.bases, context.matchState.core),
        { sourceId: 'huluwawa_move_any_base', targetType: 'base', titleKey: context.titleKey, titleParams: context.titleParams },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined || !context.minionUid || !context.minionDefId || context.fromBaseIndex === undefined) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildValidatedMoveEvents(state, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                toBaseDefId: selected.baseDefId,
                reason: context.reason,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.sourceBaseIndex,
                sourceKind: context.sourceKind,
            }),
        };
    },
});

const huluwawaPangolinProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        sourceBaseIndex: number;
        targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_pangolin',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_pangolin_${huluwawaPromptCounter++}`,
        context.playerId,
        '穿山甲：选择一个你的仆从移动到这里或从这里移动到别处',
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'move',
        }),
        { sourceId: 'huluwawa_pangolin', targetType: 'minion', titleKey: 'ui.huluwawa_pangolin_title' },
    ),
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        if (selected.baseIndex !== context.sourceBaseIndex) {
            return {
                matchState: state,
                events: buildValidatedMoveEvents(state, {
                    minionUid: selected.minionUid,
                    minionDefId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                    toBaseIndex: context.sourceBaseIndex,
                    toBaseDefId: state.core.bases[context.sourceBaseIndex]?.defId,
                    reason: 'huluwawa_pangolin',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: context.sourceCardUid,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: playerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                    sourceKind: context.sourceKind,
                }),
            };
        }
        const bases = getOtherBaseChoices(state.core, context.sourceBaseIndex);
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
                bases,
                reason: 'huluwawa_pangolin',
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                title: '穿山甲：选择要移动到的基地',
                titleKey: 'ui.huluwawa_pangolin_choose_base_title',
            },
            nextProgram: huluwawaMoveAnyBaseProgram,
        };
    },
});

const huluwawaErWaPromptProgram = createPromptProgram<
    HuluwawaErwaContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_er_wa',
    buildInteraction: (context) => {
        const topCards = context.topCards.map((card, index) => ({
            id: `erwa-top-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId, type: card.type, power: getMinionDef(card.defId)?.power },
            _source: 'deck' as const,
            displayMode: 'card' as const,
        }));
        return createAbilityRuntimeSimpleChoice(
            `huluwawa_er_wa_${huluwawaPromptCounter++}`,
            context.playerId,
            '二娃：展示牌库顶三张牌。你可以额外打出其中一张。',
            [createSkipOption('不打出，按原顺序放回牌库顶', 'ui.huluwawa_er_wa_skip_play_option') as PromptOption<CardChoice>, ...topCards],
            {
                sourceId: 'huluwawa_er_wa',
                targetType: 'generic',
                autoResolveIfSingle: false,
                titleKey: 'ui.huluwawa_er_wa_title',
            },
        );
    },
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as CardChoice | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId) {
            return {
                matchState: state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    playerId,
                    now: timestamp,
                    sourceDefId: context.sourceDefId,
                    remainingCards: context.topCards,
                },
                nextProgram: huluwawaErWaReorderProgram,
            };
        }
        const chosenCard = context.topCards.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        if (!chosenCard) return { matchState: state, events: [] };
        const remainingCards = context.topCards.filter(card => card.uid !== chosenCard.uid);
        if (chosenCard.type === 'minion') {
            const bases = state.core.bases
                .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }));
            return {
                matchState: state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    playerId,
                    now: timestamp,
                    sourceDefId: context.sourceDefId,
                    chosenCard,
                    remainingCards,
                    prefixEvents: [],
                    title: '二娃：选择该随从额外打出的基地',
                    titleKey: 'ui.huluwawa_er_wa_extra_minion_base_title',
                    bases,
                },
                nextProgram: huluwawaExtraMinionBaseProgram,
            };
        }
        const actionDef = getCardDef(chosenCard.defId) as ActionCardDef | undefined;
        if (!actionDef) {
            return {
                matchState: state,
                events: [],
                context: { ...context, matchState: state, playerId, now: timestamp, sourceDefId: context.sourceDefId, chosenCard, remainingCards },
                nextProgram: huluwawaErWaReorderProgram,
            };
        }
        if (actionLikeNeedsPlayMinion(actionDef)) {
            const targets = collectAllMinions(state.core).filter(target => validateActionPlaySemantics(state.core, playerId, {
                defId: chosenCard.defId,
                targetBaseIndex: target.baseIndex,
                targetMinionUid: target.uid,
            }).valid);
            return {
                matchState: state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    playerId,
                    now: timestamp,
                    sourceDefId: context.sourceDefId,
                    chosenCard,
                    remainingCards,
                    prefixEvents: [],
                    title: '二娃：选择该行动额外打出的目标随从',
                    titleKey: 'ui.huluwawa_er_wa_extra_action_minion_title',
                    targets,
                },
                nextProgram: huluwawaExtraActionMinionProgram,
            };
        }
        if (actionLikeNeedsPlayBase(actionDef) || actionDef.subtype === 'ongoing') {
            const bases = state.core.bases
                .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
                .filter(base => validateActionPlaySemantics(state.core, playerId, {
                    defId: chosenCard.defId,
                    targetBaseIndex: base.baseIndex,
                }).valid);
            return {
                matchState: state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    playerId,
                    now: timestamp,
                    sourceDefId: context.sourceDefId,
                    chosenCard,
                    remainingCards,
                    prefixEvents: [],
                    title: '二娃：选择该行动额外打出的目标基地',
                    titleKey: 'ui.huluwawa_er_wa_extra_action_base_title',
                    bases,
                },
                nextProgram: huluwawaExtraActionBaseProgram,
            };
        }
        return {
            matchState: state,
            events: [],
            context: { ...context, matchState: state, playerId, now: timestamp, sourceDefId: context.sourceDefId, chosenCard, remainingCards, playTargets: {} },
            nextProgram: huluwawaErWaReorderProgram,
        };
    },
});

const huluwawaErWaReorderProgram = createPromptProgram<
    HuluwawaErwaReorderContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_er_wa_reorder',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_er_wa_reorder_${huluwawaPromptCounter++}`,
        context.playerId,
        '二娃：选择其余牌放回牌库顶和/或牌库底的顺序',
        buildErwaReorderOptions(context.remainingCards),
        {
            sourceId: 'huluwawa_er_wa_reorder',
            targetType: 'generic',
            autoResolveIfSingle: context.remainingCards.length === 0,
            titleKey: 'ui.huluwawa_er_wa_reorder_title',
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const selected = value as { topUids?: string[]; bottomUids?: string[] } | undefined;
        const cardsByUid = new Map(context.remainingCards.map(card => [card.uid, card] as const));
        const topCards = (selected?.topUids ?? [])
            .map(uid => cardsByUid.get(uid))
            .filter((card): card is CardInstance => card !== undefined);
        const bottomCards = (selected?.bottomUids ?? [])
            .map(uid => cardsByUid.get(uid))
            .filter((card): card is CardInstance => card !== undefined);
        const selectedUidSet = new Set([...topCards, ...bottomCards].map(card => card.uid));
        const hasAllCards = selectedUidSet.size === context.remainingCards.length
            && topCards.length + bottomCards.length === context.remainingCards.length;
        const finalTopCards = hasAllCards ? topCards : context.remainingCards;
        const finalBottomCards = hasAllCards ? bottomCards : [];

        const prefixEvents = [
            inspectDeck(context.playerId, context.playerId, context.chosenCard ? context.remainingCards.length + 1 : context.remainingCards.length, 'huluwawa_er_wa', timestamp),
            ...(context.chosenCard
                ? buildDrawFromDeckAndKeepRemainingEvents(state.core, context.playerId, context.chosenCard, finalTopCards, finalBottomCards, timestamp)
                : buildDeckReorderOnlyEvents(state.core, context.playerId, context.remainingCards, finalTopCards, finalBottomCards, timestamp)),
        ];

        if (!context.chosenCard) {
            return { matchState: state, events: prefixEvents };
        }

        const played = playCardAsExtra(
            state,
            context.playerId,
            context.chosenCard,
            context.playTargets ?? {},
            random,
            timestamp,
            prefixEvents,
        );
        return { matchState: played.matchState, events: played.events };
    },
});

const huluwawaExtraMinionBaseProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        chosenCard: CardInstance;
        remainingCards: CardInstance[];
        prefixEvents: SmashUpEvent[];
        title: string;
        bases: Array<{ baseIndex: number; label: string }>;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_extra_minion_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_extra_minion_base_${huluwawaPromptCounter++}`,
        context.playerId,
        context.title,
        buildBaseTargetOptions(context.bases, context.matchState.core),
        { sourceId: 'huluwawa_extra_minion_base', targetType: 'base', titleKey: context.titleKey, titleParams: context.titleParams },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined) return { matchState: state, events: [] };
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                playTargets: { baseIndex: selected.baseIndex },
            },
            nextProgram: huluwawaErWaReorderProgram,
        };
    },
});

const huluwawaExtraActionBaseProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        chosenCard: CardInstance;
        remainingCards: CardInstance[];
        prefixEvents: SmashUpEvent[];
        title: string;
        bases: Array<{ baseIndex: number; label: string }>;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_extra_action_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_extra_action_base_${huluwawaPromptCounter++}`,
        context.playerId,
        context.title,
        buildBaseTargetOptions(context.bases, context.matchState.core),
        { sourceId: 'huluwawa_extra_action_base', targetType: 'base', titleKey: context.titleKey, titleParams: context.titleParams },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined) return { matchState: state, events: [] };
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                playTargets: { targetBaseIndex: selected.baseIndex },
            },
            nextProgram: huluwawaErWaReorderProgram,
        };
    },
});

const huluwawaExtraActionMinionProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        chosenCard: CardInstance;
        remainingCards: CardInstance[];
        prefixEvents: SmashUpEvent[];
        title: string;
        targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_extra_action_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_extra_action_minion_${huluwawaPromptCounter++}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'attach_action',
        }),
        { sourceId: 'huluwawa_extra_action_minion', targetType: 'minion', titleKey: context.titleKey, titleParams: context.titleParams },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { matchState: state, events: [] };
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                playTargets: {
                    targetBaseIndex: selected.baseIndex,
                    targetMinionUid: selected.minionUid,
                },
            },
            nextProgram: huluwawaErWaReorderProgram,
        };
    },
});

const huluwawaPurpleGoldGourdProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        targetBaseIndex: number;
        moveTargets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
        discardActions: CardInstance[];
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_purple_gold_gourd',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_purple_gold_gourd_${huluwawaPromptCounter++}`,
        context.playerId,
        '紫金宝葫芦：选择移动力量 3 或更小的仆从到这里，或将弃牌堆中的一张行动牌置于牌库底',
        [
            ...(context.moveTargets.length > 0
                ? [{ id: 'move', label: '移动一个力量 3 或更小的仆从到这里', labelKey: 'ui.huluwawa_purple_gold_gourd_move_option', value: { choice: 'move' }, displayMode: 'button' as const }]
                : []),
            ...(context.discardActions.length > 0
                ? [{ id: 'bottom', label: '将弃牌堆中的一张行动牌置于牌库底', labelKey: 'ui.huluwawa_purple_gold_gourd_bottom_option', value: { choice: 'bottom' }, displayMode: 'button' as const }]
                : []),
        ],
        { sourceId: 'huluwawa_purple_gold_gourd', targetType: 'button', titleKey: 'ui.huluwawa_purple_gold_gourd_title' },
    ),
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as ButtonChoice | undefined;
        if (selected?.choice === 'move') {
            return {
                matchState: state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    playerId,
                    now: timestamp,
                    sourceDefId: context.sourceDefId,
                    title: '紫金宝葫芦：选择要移动的仆从',
                    titleKey: 'ui.huluwawa_purple_gold_gourd_move_title',
                    targets: context.moveTargets,
                    targetBaseIndex: context.targetBaseIndex,
                    reason: 'huluwawa_purple_gold_gourd_move',
                },
                nextProgram: huluwawaMoveToSourceBaseProgram,
            };
        }
        if (selected?.choice === 'bottom') {
            const actionOptions = context.discardActions.map((card, index) => ({
                id: `discard-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId, sourceZone: 'discard' },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            }));
            const interaction = createSimpleChoice(
                `huluwawa_purple_gold_gourd_bottom_${huluwawaPromptCounter++}`,
                context.playerId,
                '紫金宝葫芦：选择一张行动牌置于牌库底',
                actionOptions,
                { sourceId: 'huluwawa_purple_gold_gourd_bottom', targetType: 'generic', titleKey: 'ui.huluwawa_purple_gold_gourd_bottom_title' },
            );
            return {
                matchState: queueOrSetCurrentInteraction(state, interaction),
                events: [],
            };
        }
        return { matchState: state, events: [] };
    },
});

const huluwawaOneAtATimeTargetProgram = createPromptProgram<
    HuluwawaPromptContext & {
        sourceDefId: string;
        baseIndex: number;
        targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_one_at_a_time_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_one_at_a_time_target_${huluwawaPromptCounter++}`,
        context.playerId,
        '一个一个来：选择这里的一个仆从返回其拥有者手牌',
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'return',
        }),
        { sourceId: 'huluwawa_one_at_a_time_target', targetType: 'minion', titleKey: 'ui.huluwawa_one_at_a_time_target_title' },
    ),
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        const live = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!live) return { matchState: state, events: [] };
        const returnEvents = buildValidatedReturnEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            fromBaseIndex: selected.baseIndex,
            toPlayerId: live.owner,
            reason: 'huluwawa_one_at_a_time',
            now: timestamp,
            sourcePlayerId: playerId,
        });
        const handCandidates = state.core.players[live.owner]?.hand.filter(card =>
            card.type === 'minion' && card.defId !== selected.defId,
        ) ?? [];
        if (handCandidates.length === 0) {
            return { matchState: state, events: returnEvents };
        }
        return {
            matchState: state,
            events: returnEvents,
            context: {
                ...context,
                matchState: state,
                playerId: live.owner,
                now: timestamp,
                sourceDefId: context.sourceDefId,
                targetBaseIndex: context.baseIndex,
                returnedMinionDefId: selected.defId,
                returnedToPlayerId: live.owner,
                handCandidates,
            },
            nextProgram: huluwawaOneAtATimePlayProgram,
        };
    },
});

const huluwawaOneAtATimePlayProgram = createPromptProgram<
    HuluwawaOneAtATimeContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'huluwawa_one_at_a_time_play',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `huluwawa_one_at_a_time_play_${huluwawaPromptCounter++}`,
        context.returnedToPlayerId,
        '一个一个来：你可以立即打出一张不同名字的仆从到这里',
        [
            createSkipOption('不打出', 'ui.huluwawa_one_at_a_time_skip_play_option'),
            ...context.handCandidates.map((card, index) => ({
                id: `hand-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId, type: 'minion', sourceZone: 'hand' },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: 'huluwawa_one_at_a_time_play', targetType: 'hand', titleKey: 'ui.huluwawa_one_at_a_time_play_title' },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const selected = value as CardChoice | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId) return { matchState: state, events: [] };
        const chosen = state.core.players[context.returnedToPlayerId]?.hand.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        if (!chosen) return { matchState: state, events: [] };
        const played = playCardAsExtra(state, context.returnedToPlayerId, chosen, {
            baseIndex: context.targetBaseIndex,
        }, random, timestamp);
        return { matchState: played.matchState, events: played.events };
    },
});

function findBaseIndexForOngoingAction(core: SmashUpCore, cardUid: string, fallbackBaseIndex?: number): number | undefined {
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const base = core.bases[baseIndex];
        if (base.ongoingActions.some(action => action.uid === cardUid)) return baseIndex;
    }
    return fallbackBaseIndex;
}

export function registerHuluwawaAbilities(): void {
    registerSimpleAbility('huluwawa_da_wa', 'talent', huluwawaDaWaTalent);
    registerAbilityProgram('huluwawa_er_wa', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(huluwawaErWaTalent),
    });
    registerSimpleAbility('huluwawa_si_wa', 'onPlay', huluwawaSiWaOnPlay);
    registerSimpleAbility('huluwawa_wu_wa', 'talent', huluwawaWuWaTalent);
    registerSimpleAbility('huluwawa_liu_wa', 'talent', huluwawaLiuWaTalent);
    registerSimpleAbility('huluwawa_qi_wa', 'talent', huluwawaQiWaTalent);

    registerSimpleAbility('huluwawa_one_vine_seven_flowers', 'onPlay', huluwawaOneVineSevenFlowers);
    registerSimpleAbility('huluwawa_strength_in_numbers', 'onPlay', huluwawaStrengthInNumbers);
    registerSimpleAbility('huluwawa_where_do_you_think_youre_going', 'onPlay', huluwawaWhereDoYouThinkYoureGoing);
    registerSimpleAbility('huluwawa_jade_ruyi', 'onPlay', huluwawaJadeRuyi);
    registerSimpleAbility('huluwawa_pangolin', 'talent', huluwawaPangolinTalent);
    registerSimpleAbility('huluwawa_one_at_a_time', 'talent', huluwawaOneAtATimeTalent);
    registerSimpleAbility('huluwawa_pop', 'onPlay', huluwawaPop);
    registerSimpleAbility('huluwawa_release_my_grandpa', 'onPlay', huluwawaReleaseMyGrandpa);
    registerSimpleAbility('huluwawa_purple_gold_gourd', 'talent', huluwawaPurpleGoldGourdTalent);

    registerAbility('huluwawa_little_king_kong', 'special', huluwawaLittleKingKongSpecial);

    registerAbility('huluwawa_pangolin', 'onPlay', () => ({ events: [] }));
    registerAbility('huluwawa_purple_gold_gourd', 'onPlay', () => ({ events: [] }));
    registerAbility('huluwawa_no_presence', 'onPlay', () => ({ events: [] }));
    registerAbility('huluwawa_one_at_a_time', 'onPlay', () => ({ events: [] }));
    registerAbility('huluwawa_butterfly_sisters_help', 'onPlay', () => ({ events: [] }));
    registerAbility('huluwawa_purple_gold_gourd', 'special', () => ({ events: [] }));
    registerAbility('huluwawa_no_presence', 'special', () => ({ events: [] }));
    registerAbility('huluwawa_san_wa', 'special', () => ({ events: [] }));
    registerAbility('huluwawa_butterfly_sisters_help', 'ongoing', () => ({ events: [] }));

    registerInteractionHandler('huluwawa_purple_gold_gourd_bottom', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string; sourceZone?: string; skip?: boolean } | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId || selected.sourceZone !== 'discard') {
            return { state, events: [] };
        }
        const player = state.core.players[playerId];
        const card = player?.discard.find(candidate =>
            candidate.uid === selected.cardUid
            && candidate.defId === selected.defId
            && candidate.type === 'action',
        );
        if (!player || !card) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId,
                    deckUids: [...player.deck.map(candidate => candidate.uid), selected.cardUid],
                },
                timestamp,
            } as DeckReorderedEvent],
        };
    });

    registerInteractionHandler('huluwawa_liu_wa_before_scoring', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { cancel?: boolean; skip?: boolean; sourceUid?: string; minionUid?: string } | undefined;
        if (selected?.skip || !selected?.cancel) return { state, events: [] };
        const continuation = (data as { continuationContext?: { minionUid?: string } } | undefined)?.continuationContext;
        const minionUid = selected.minionUid ?? selected.sourceUid ?? continuation?.minionUid;
        if (!minionUid) return { state, events: [] };
        const found = findMinionOnBases(state.core, minionUid);
        if (!found) return { state, events: [] };
        const modifiers = state.core.timedPowerModifiers ?? [];
        const cancelled = modifiers.filter(modifier =>
            modifier.minionUid === minionUid && modifier.reason === 'huluwawa_liu_wa_talent',
        );
        if (cancelled.length === 0) return { state, events: [] };
        const revertAmount = -cancelled.reduce((sum, modifier) => sum + modifier.amount, 0);
        return {
            state,
            events: [
                {
                    type: SU_EVENTS.TIMED_POWER_MODIFIER_CANCELLED,
                    payload: { minionUid, reason: 'huluwawa_liu_wa_talent' },
                    timestamp,
                } as SmashUpEvent,
                ...(revertAmount === 0
                    ? []
                    : [addPermanentPower(minionUid, found.baseIndex, revertAmount, 'huluwawa_liu_wa_cancel_talent', timestamp)]),
            ],
        };
    });

    registerDiscardActionPlayProvider({
        id: 'huluwawa_purple_gold_gourd',
        getPlayableCards(core, playerId) {
            const currentTurnPlayerId = core.turnOrder[core.currentPlayerIndex];
            if (currentTurnPlayerId !== playerId) return [];
            const player = core.players[playerId];
            if (!player) return [];
            const qiWaTargets = core.bases.flatMap((base, baseIndex) =>
                base.minions
                    .filter(minion => minion.controller === playerId && minion.defId === 'huluwawa_qi_wa')
                    .map(minion => ({ baseIndex, minion })),
            );
            if (qiWaTargets.length === 0) return [];
            return player.discard
                .filter(card => card.defId === 'huluwawa_purple_gold_gourd')
                .flatMap(card => {
                    const legalTargets = qiWaTargets.filter(({ baseIndex, minion }) =>
                        validateActionPlaySemantics(core, playerId, {
                            defId: card.defId,
                            targetBaseIndex: baseIndex,
                            targetMinionUid: minion.uid,
                            effectiveHandSize: player.hand.length,
                        }).valid,
                    );
                    if (legalTargets.length === 0) return [];
                    return [{
                        card,
                        allowedBaseIndices: [...new Set(legalTargets.map(({ baseIndex }) => baseIndex))],
                        allowedMinionUids: legalTargets.map(({ minion }) => minion.uid),
                        sourceId: 'huluwawa_purple_gold_gourd',
                        defId: card.defId,
                        name: getCardDef(card.defId)?.name ?? card.defId,
                    }];
                });
        },
    });

    registerInteractionHandler('huluwawa_little_king_kong_clash', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { skip?: boolean; baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        if (!titan || titan.defId !== 'huluwawa_little_king_kong' || titan.location.zone !== 'base') {
            return { state, events: [] };
        }

        if (
            selected?.baseIndex !== undefined
            && continuation?.fromBaseIndex !== undefined
            && selected.baseIndex !== continuation.fromBaseIndex
        ) {
            return {
                state,
                events: [
                    moveTitan(
                        titan.uid,
                        titan.defId,
                        continuation.fromBaseIndex,
                        selected.baseIndex,
                        'huluwawa_little_king_kong_clash',
                        timestamp,
                        selected.baseDefId,
                    ),
                ],
            };
        }

        return {
            state,
            events: [buildTitanMetadataUpdatedEvent(titan.uid, { huluwawaPendingClashLoss: false }, 'huluwawa_little_king_kong_clash', timestamp)],
        };
    });

    registerInteractionHandler('huluwawa_little_king_kong_copy_talent', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; defId?: string; baseIndex?: number; sourceDefId?: string; titanUid?: string } | undefined;
        if (
            selected?.skip
            || !selected?.minionUid
            || !selected?.sourceDefId
            || !selected?.titanUid
            || selected.baseIndex === undefined
        ) {
            return { state, events: [] };
        }

        const executor = resolveTalent(selected.sourceDefId);
        const liveMinion = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        const titan = getTitanByUid(state.core, selected.titanUid);
        if (
            !executor
            || !liveMinion
            || liveMinion.defId !== selected.sourceDefId
            || liveMinion.controller !== playerId
            || liveMinion.talentUsed
            || !titan
            || titan.defId !== 'huluwawa_little_king_kong'
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || hasLittleKingKongCopiedThisTurn(state.core, titan.uid)
        ) {
            return { state, events: [] };
        }

        const result = executor({
            state: state.core,
            matchState: state,
            playerId,
            cardUid: selected.minionUid,
            defId: selected.sourceDefId,
            baseIndex: selected.baseIndex,
            random,
            now: timestamp,
        });

        return {
            state: result.matchState ?? state,
            events: [
                {
                    type: SU_EVENTS.TALENT_USED,
                    payload: {
                        playerId,
                        minionUid: selected.minionUid,
                        defId: selected.sourceDefId,
                        baseIndex: selected.baseIndex,
                    },
                    sourceCommandType: SU_COMMANDS.USE_TALENT,
                    timestamp,
                } as TalentUsedEvent,
                buildTitanMetadataUpdatedEvent(
                    titan.uid,
                    { huluwawaCopiedTalentTurn: state.core.turnNumber },
                    'huluwawa_little_king_kong_copy_talent',
                    timestamp,
                ),
                ...result.events,
            ],
        };
    });

    registerTrigger('huluwawa_san_wa', 'onMinionDestroyed', huluwawaSanWaReplacement, {
        phase: 'replacement',
        perInstance: true,
    });
    registerTrigger('huluwawa_san_wa', 'onMinionDiscardedFromBase', huluwawaSanWaReplacement, {
        phase: 'replacement',
        perInstance: true,
    });
    registerTrigger('huluwawa_liu_wa', 'beforeScoring', huluwawaLiuWaBeforeScoring, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('huluwawa_qi_wa', 'onTurnEnd', huluwawaQiWaTurnEnd, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('huluwawa_no_presence', 'onMinionDiscardedFromBase', huluwawaNoPresenceScoringRedirect, {
        phase: 'replacement',
        perInstance: true,
    });
    registerTrigger('huluwawa_butterfly_sisters_help', 'onMinionDestroyed', (ctx) => {
        if (!ctx.sourceCardUid) return [];
        return [buildOngoingDetachedEvent({
            cardUid: ctx.sourceCardUid,
            defId: 'huluwawa_butterfly_sisters_help',
            ownerId: ctx.playerId,
            reason: 'huluwawa_butterfly_sisters_help',
            now: ctx.now,
        })];
    }, {
        phase: 'replacement',
        perInstance: true,
    });
    registerTrigger('huluwawa_butterfly_sisters_help', 'onCardReturnedToHand', huluwawaButterflyDrawOnDetach, {
        perInstance: true,
    });
    registerTrigger('huluwawa_little_king_kong', 'onTalentUsed', huluwawaLittleKingKongOnTalentUsed, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });

    registerProtection('huluwawa_san_wa', 'destroy', huluwawaSanWaProtection);
    registerProtection('huluwawa_liu_wa', 'affect', huluwawaOtherPlayerEffectProtection);
    registerProtection('huluwawa_liu_wa', 'move', huluwawaOtherPlayerEffectProtection);
    registerProtection('huluwawa_liu_wa', 'destroy', huluwawaOtherPlayerEffectProtection);
    registerProtection('base_huluwawa_mountain', 'affect', huluwawaBaseMountainProtection);
    registerProtection('base_huluwawa_mountain', 'move', huluwawaBaseMountainProtection);
    registerProtection('base_huluwawa_mountain', 'destroy', huluwawaBaseMountainProtection);

    registerRestriction('huluwawa_wu_wa', 'play_action', huluwawaWuWaRestriction);

    registerInteractionHandler('base_seven_colored_lotus', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; sourceZone?: string } | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId) return { state, events: [] };
        const continuation = (data as {
            continuationContext?: { baseIndex?: number; printedPower?: number };
        } | undefined)?.continuationContext;
        const baseIndex = continuation?.baseIndex;
        if (baseIndex === undefined || !state.core.bases[baseIndex]) return { state, events: [] };
        const player = state.core.players[playerId];
        const card = player?.hand.find(candidate =>
            candidate.uid === selected.cardUid
            && candidate.defId === selected.defId
            && candidate.type === 'minion',
        );
        if (!player || !card) return { state, events: [] };
        if ((getMinionDef(card.defId)?.power ?? -1) !== continuation?.printedPower) {
            return { state, events: [] };
        }
        const played = playCardAsExtra(state, playerId, card, { baseIndex }, random, timestamp);
        return { state: played.matchState, events: played.events };
    });

    registerBaseAbility('base_seven_colored_lotus', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || !ctx.matchState || !ctx.minionDefId) return { events: [] };
        const playedAtBase = player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };
        const printedPower = getMinionDef(ctx.minionDefId)?.power;
        if (printedPower === undefined) return { events: [] };
        const candidates = player.hand.filter(card =>
            card.type === 'minion' && (getMinionDef(card.defId)?.power ?? -1) === printedPower,
        );
        if (candidates.length === 0) return { events: [] };
        const interaction = createSimpleChoice(
            `base_seven_colored_lotus_${ctx.playerId}_${ctx.now}`,
            ctx.playerId,
            '七彩莲蓬：你可以额外打出一个相同印刷力量的仆从到这里',
            [
                createSkipOption('不打出', 'ui.base_seven_colored_lotus_skip_play_option'),
                ...candidates.map((card, index) => ({
                    id: `same-power-${index}`,
                    label: getCardDef(card.defId)?.name ?? card.defId,
                    value: { cardUid: card.uid, defId: card.defId, type: 'minion', sourceZone: 'hand' },
                    _source: 'hand' as const,
                    displayMode: 'card' as const,
                })),
            ],
            { sourceId: 'base_seven_colored_lotus', targetType: 'hand', titleKey: 'ui.base_seven_colored_lotus_title' },
        );
        return {
            events: [],
            matchState: queueOrSetCurrentInteraction(ctx.matchState, {
                ...interaction,
                data: {
                    ...interaction.data,
                    continuationContext: { baseIndex: ctx.baseIndex, printedPower },
                },
            }),
        };
    });

    registerTitanSpecialValidator('huluwawa_little_king_kong', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        if (state.bases[baseIndex]?.minions.length !== 0) return '你只能将其打出到没有随从的基地';
        if ((state.players[playerId]?.minionsPlayed ?? 0) > 0) return '本回合你已打出通常随从';
        return null;
    });
}
