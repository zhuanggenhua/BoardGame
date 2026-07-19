import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import {
    addTempPower,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    getMinionPower,
    grantContextualExtraMinion,
} from '../domain/abilityHelpers';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import type { MinionMetadataUpdatedEvent, MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    cardUid?: string;
    power?: number;
};

type BaseChoice = {
    baseIndex?: number;
    selectedMinions?: MinionChoice[];
    sourceCardUid?: string;
    sourceDefId?: string;
    playerId?: PlayerId;
    putOnDeckTop?: boolean;
};

type ActionChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    baseIndex?: number;
};

type TeachingOrderChoice = {
    cardUid?: string;
    defId?: string;
    selectedCardUid?: string;
    selectedDefId?: string;
    selectedPower?: number;
    baseIndex?: number;
    revealedCards?: Array<{ uid: string; defId: string }>;
};

function minionLabel(minion: MinionOnBase, baseIndex: number, state: SmashUpCore): string {
    const cardName = getCardDef(minion.defId)?.name ?? minion.defId;
    const baseName = getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
    return `${cardName} @ ${baseName}`;
}

function collectMinions(
    state: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): Array<{ minion: MinionOnBase; baseIndex: number }> {
    const result: Array<{ minion: MinionOnBase; baseIndex: number }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (predicate(minion, baseIndex)) result.push({ minion, baseIndex });
        });
    });
    return result;
}

function buildMinionOptions(
    state: SmashUpCore,
    targets: Array<{ minion: MinionOnBase; baseIndex: number }>,
): PromptOption<MinionChoice>[] {
    return targets.map(({ minion, baseIndex }, index) => ({
        id: `minion-${index}`,
        label: minionLabel(minion, baseIndex, state),
        value: { minionUid: minion.uid, baseIndex, defId: minion.defId },
        displayMode: 'card',
    }));
}

function buildBaseOptions(
    state: SmashUpCore,
    predicate: (baseIndex: number) => boolean,
    valueFor: (baseIndex: number) => BaseChoice,
): PromptOption<BaseChoice>[] {
    return state.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ baseIndex }) => predicate(baseIndex))
        .map(({ base, baseIndex }) => ({
            id: `base-${baseIndex}`,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            value: valueFor(baseIndex),
        }));
}

function cardLabel(defId: string, baseIndex: number, state: SmashUpCore): string {
    const cardName = getCardDef(defId)?.name ?? defId;
    const baseName = getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
    return `${cardName} @ ${baseName}`;
}

function buildTeachingDeckOrderEvent(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    revealedCards: Array<{ uid: string; defId: string }>,
    orderedUids: string[],
    timestamp: number,
): SmashUpEvent | undefined {
    const player = state.core.players[playerId];
    if (!player) return undefined;
    const revealedSet = new Set(revealedCards.map(card => card.uid));
    const orderedCards = orderedUids
        .map(uid => revealedCards.find(card => card.uid === uid))
        .filter((card): card is { uid: string; defId: string } => Boolean(card));
    const restOfDeck = player.deck
        .filter(card => !revealedSet.has(card.uid))
        .map(card => card.uid);
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: [...orderedCards.map(card => card.uid), ...restOfDeck],
        },
        timestamp,
    } as SmashUpEvent;
}

function buildTeachingPlayEvent(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selected: TeachingOrderChoice,
    timestamp: number,
): SmashUpEvent | undefined {
    if (!selected.selectedCardUid || !selected.selectedDefId || selected.baseIndex === undefined) return undefined;
    if (!state.core.players[playerId]?.deck.some(card => card.uid === selected.selectedCardUid)) return undefined;
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: selected.selectedCardUid,
            defId: selected.selectedDefId,
            baseIndex: selected.baseIndex,
            baseDefId: state.core.bases[selected.baseIndex]?.defId,
            power: selected.selectedPower ?? 0,
            fromDeck: true,
            consumesNormalLimit: false,
        },
        timestamp,
    } as SmashUpEvent;
}

function buildTeachingResolvedEvents(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selected: TeachingOrderChoice,
    orderedUids: string[],
    timestamp: number,
): SmashUpEvent[] {
    const revealedCards = selected.revealedCards ?? [];
    if (revealedCards.length === 0) return [];
    const playEvent = buildTeachingPlayEvent(state, playerId, selected, timestamp);
    const reorderEvent = buildTeachingDeckOrderEvent(state, playerId, revealedCards, orderedUids, timestamp);
    return [
        ...(playEvent ? [playEvent] : []),
        ...(reorderEvent ? [reorderEvent] : []),
    ];
}

function buildTeachingOrderPrompt(
    _state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selected: TeachingOrderChoice,
    cardsToOrder: Array<{ uid: string; defId: string }>,
    timestamp: number,
) {
    return createSimpleChoice<TeachingOrderChoice>(
        `mythic_horses_teaching_power_order_${timestamp}`,
        playerId,
        '教学之力：按顺序选择其余展示牌放回牌库顶',
        cardsToOrder.map((card, index) => ({
            id: `order-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: {
                cardUid: card.uid,
                defId: card.defId,
                selectedCardUid: selected.selectedCardUid,
                selectedDefId: selected.selectedDefId,
                selectedPower: selected.selectedPower,
                baseIndex: selected.baseIndex,
                revealedCards: selected.revealedCards,
            },
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'mythic_horses_teaching_power_order',
            targetType: 'generic',
            multi: { min: cardsToOrder.length, max: cardsToOrder.length, ordered: true },
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_teaching_power_order_title',
        },
    );
}

function buildMetadataUpdatedEvent(
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

function mythicHorsesRainbow(ctx: AbilityContext): AbilityResult {
    const source = ctx.matchState.core.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!source) return { events: [] };
    const hasFriend = ctx.matchState.core.bases[ctx.baseIndex].minions.some(
        minion => minion.uid !== source.uid && minion.controller === ctx.playerId,
    );
    if (!hasFriend) return { events: [] };
    return { events: buildStandardDrawEvents(ctx.matchState, ctx.playerId, 1, ctx.random, ctx.now) };
}

function mythicHorsesSeastar(ctx: AbilityContext): AbilityResult {
    const hasMinionAtAnotherBase = ctx.matchState.core.bases.some((base, baseIndex) => (
        baseIndex !== ctx.baseIndex
        && base.minions.some(minion => minion.controller === ctx.playerId)
    ));
    if (!hasMinionAtAnotherBase) return { events: [] };
    return { events: [grantContextualExtraMinion(ctx, 'mythic_horses_seastar', ctx.baseIndex)] };
}

function mythicHorsesSeastarPod(ctx: AbilityContext): AbilityResult {
    const base = ctx.matchState.core.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const source = base.minions.find(minion => minion.uid === ctx.cardUid);
    if (!source) return { events: [] };
    const hasOtherOwnMinion = base.minions.some(minion => (
        minion.uid !== source.uid
        && minion.controller === ctx.playerId
    ));
    if (!hasOtherOwnMinion) return { events: [] };
    if (ctx.matchState.core.extraMinionSourcesUsed?.[ctx.playerId]?.includes('mythic_horses_seastar_pod')) {
        return { events: [] };
    }
    return { events: [grantContextualExtraMinion(ctx, 'mythic_horses_seastar_pod')] };
}

function applySuperFutureSpaceArmorPower(
    ctx: AbilityContext,
    sourceDefId: 'mythic_horses_super_future_space_armor_power' | 'mythic_horses_super_future_space_armor_power_pod',
): AbilityResult {
    const events: SmashUpEvent[] = [];
    ctx.matchState.core.bases.forEach((base, baseIndex) => {
        const ownMinions = base.minions.filter(minion => minion.controller === ctx.playerId);
        if (ownMinions.length < 2) return;
        ownMinions.forEach((minion) => {
            events.push(addTempPower(
                minion.uid,
                baseIndex,
                2,
                sourceDefId,
                ctx.now,
            ));
        });
    });
    if (events.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return { events };
}

function mythicHorsesSuperFutureSpaceArmorPower(ctx: AbilityContext): AbilityResult {
    return applySuperFutureSpaceArmorPower(ctx, 'mythic_horses_super_future_space_armor_power');
}

function mythicHorsesSuperFutureSpaceArmorPowerPod(ctx: AbilityContext): AbilityResult {
    return applySuperFutureSpaceArmorPower(ctx, 'mythic_horses_super_future_space_armor_power_pod');
}

function mythicHorsesTeachingPower(ctx: AbilityContext): AbilityResult {
    const base = ctx.matchState.core.bases[ctx.baseIndex];
    const player = ctx.matchState.core.players[ctx.playerId];
    if (!base || !player) return { events: [] };
    const revealCount = base.minions.filter(minion => minion.controller === ctx.playerId).length;
    if (revealCount <= 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const topCards = player.deck.slice(0, revealCount);
    const revealEvent: SmashUpEvent = {
        type: SU_EVENTS.REVEAL_DECK_TOP,
        payload: {
            targetPlayerId: ctx.playerId,
            viewerPlayerId: ctx.playerId,
            cards: topCards.map(card => ({ uid: card.uid, defId: card.defId })),
            count: revealCount,
            sourcePlayerId: ctx.playerId,
            reason: 'mythic_horses_teaching_power',
        },
        timestamp: ctx.now,
    };
    const minionOptions = topCards
        .map(card => ({ card, def: getCardDef(card.defId) }))
        .filter((entry): entry is typeof entry & { def: NonNullable<typeof entry.def> } => entry.def?.type === 'minion')
        .map(({ card, def }, index) => ({
            id: `card-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: {
                cardUid: card.uid,
                defId: card.defId,
                baseIndex: ctx.baseIndex,
                power: 'power' in def ? def.power : 0,
                revealedCards: topCards.map(entry => ({ uid: entry.uid, defId: entry.defId })),
            },
            displayMode: 'card' as const,
        }));
    if (minionOptions.length === 0) {
        const revealedCards = topCards.map(entry => ({ uid: entry.uid, defId: entry.defId }));
        if (revealedCards.length <= 1) return { events: [revealEvent] };
        const prompt = buildTeachingOrderPrompt(
            ctx.matchState,
            ctx.playerId,
            { baseIndex: ctx.baseIndex, revealedCards },
            revealedCards,
            ctx.now,
        );
        return { events: [revealEvent], matchState: queueInteraction(ctx.matchState, prompt) };
    }
    const prompt = createSimpleChoice<TeachingOrderChoice>(
        `mythic_horses_teaching_power_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '教学之力：选择一张展示的随从作为额外随从打出',
        [
            ...minionOptions,
            {
                id: 'skip',
                label: '不打出',
                labelKey: 'ui.mythic_horses_teaching_power_skip_option',
                value: {
                    baseIndex: ctx.baseIndex,
                    revealedCards: topCards.map(entry => ({ uid: entry.uid, defId: entry.defId })),
                },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'mythic_horses_teaching_power',
            targetType: 'deck_minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_teaching_power_title',
        },
    );
    return { events: [revealEvent], matchState: queueInteraction(ctx.matchState, prompt) };
}

function mythicHorsesTogethernessPower(ctx: AbilityContext): AbilityResult {
    const options = buildBaseOptions(
        ctx.matchState.core,
        baseIndex => ctx.matchState.core.bases[baseIndex].minions.some(minion => minion.controller === ctx.playerId),
        baseIndex => ({ baseIndex }),
    );
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const prompt = createSimpleChoice(
        `mythic_horses_togetherness_power_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '同行之力：选择一个你已有随从的基地，获得该基地限定额外随从',
        options,
        {
            sourceId: 'mythic_horses_togetherness_power',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_togetherness_power_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, prompt) };
}

function mythicHorsesAdventurePower(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectMinions(ctx.matchState.core, minion => minion.controller === ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const prompt = createSimpleChoice<MinionChoice>(
        `mythic_horses_adventure_power_minions_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '冒险之力：选择要移动的你的随从',
        buildMinionOptions(ctx.matchState.core, ownMinions),
        {
            sourceId: 'mythic_horses_adventure_power_minions',
            targetType: 'minion',
            multi: { min: 1, max: ownMinions.length },
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_adventure_power_minions_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, prompt) };
}

function mythicHorsesFriendshipPower(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectMinions(ctx.matchState.core, (minion, baseIndex) => {
        if (minion.controller !== ctx.playerId) return false;
        return ctx.matchState.core.bases.some((base, otherBaseIndex) => (
            otherBaseIndex !== baseIndex
            && base.minions.some(other => other.controller === ctx.playerId)
        ));
    });
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const prompt = createSimpleChoice<MinionChoice>(
        `mythic_horses_friendship_power_minion_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '友谊之力：选择要移动的你的一个随从',
        buildMinionOptions(ctx.matchState.core, ownMinions),
        {
            sourceId: 'mythic_horses_friendship_power_minion',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_friendship_power_minion_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, prompt) };
}

function mythicHorsesFreedomPower(ctx: AbilityContext): AbilityResult {
    const options: PromptOption<ActionChoice>[] = [];
    ctx.matchState.core.bases.forEach((base, baseIndex) => {
        base.ongoingActions.forEach((action) => {
            options.push({
                id: `base-action-${action.uid}`,
                label: cardLabel(action.defId, baseIndex, ctx.matchState.core),
                value: { cardUid: action.uid, defId: action.defId, ownerId: action.ownerId, baseIndex },
                displayMode: 'card',
            });
        });
        base.minions.forEach((minion) => {
            minion.attachedActions.forEach((action) => {
                options.push({
                    id: `attached-action-${action.uid}`,
                    label: `${cardLabel(action.defId, baseIndex, ctx.matchState.core)} / ${getCardDef(minion.defId)?.name ?? minion.defId}`,
                    value: { cardUid: action.uid, defId: action.defId, ownerId: action.ownerId, baseIndex },
                    displayMode: 'card',
                });
            });
        });
    });
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const prompt = createSimpleChoice(
        `mythic_horses_freedom_power_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '自由之力：选择一张基地或随从上的行动回到其所有者手牌',
        options,
        {
            sourceId: 'mythic_horses_freedom_power',
            targetType: 'card',
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_freedom_power_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, prompt) };
}

function mythicHorsesSharingPowerOnTurnStart(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base) return [];
    const hasSmallMinion = base.minions.some(minion => getMinionPower(ctx.state, minion, ctx.sourceBaseIndex!) <= 2);
    if (!hasSmallMinion) return [];
    return buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
}

function mythicHorsesSharingPowerPodOnTurnStart(_ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    return [];
}

function mythicHorsesSharingPowerPodOnTurnEnd(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base) return [];
    const ownerId = ctx.sourceControllerId ?? ctx.playerId;
    const ownMinionCount = base.minions.filter(minion => minion.controller === ownerId).length;
    if (ownMinionCount < 2) return [];
    return buildStandardDrawEvents(ctx.state, ownerId, 1, ctx.random, ctx.now);
}

function handleArmorPower(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selected = value as MinionChoice;
    if (!selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [
            addTempPower(
                selected.minionUid,
                selected.baseIndex,
                2,
                'mythic_horses_super_future_space_armor_power',
                timestamp,
            ),
            buildMetadataUpdatedEvent(
                selected.minionUid,
                selected.baseIndex,
                {
                    tempProtectSourcePlayerId: playerId,
                    tempProtectDestroyUntilTurnNumber: state.core.turnNumber,
                    tempProtectMoveUntilTurnNumber: state.core.turnNumber,
                    tempProtectAffectUntilTurnNumber: state.core.turnNumber,
                },
                'mythic_horses_super_future_space_armor_power',
                timestamp,
            ),
        ],
    };
}

function handleTeachingPower(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const choice = value as TeachingOrderChoice;
    const selected: TeachingOrderChoice = {
        selectedCardUid: choice.cardUid,
        selectedDefId: choice.defId,
        selectedPower: choice.power,
        baseIndex: choice.baseIndex,
        revealedCards: choice.revealedCards,
    };
    const revealedCards = selected.revealedCards ?? [];
    if (revealedCards.length === 0) return { state, events: [] };
    const cardsToOrder = revealedCards.filter(card => card.uid !== selected.selectedCardUid);
    if (cardsToOrder.length <= 1) {
        return {
            state,
            events: buildTeachingResolvedEvents(
                state,
                playerId,
                selected,
                cardsToOrder.map(card => card.uid),
                timestamp,
            ),
        };
    }
    const prompt = buildTeachingOrderPrompt(state, playerId, selected, cardsToOrder, timestamp);
    return { state: queueInteraction(state, prompt, { urgent: true }), events: [] };
}

function handleTeachingPowerOrder(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const ordered = Array.isArray(value) ? value as TeachingOrderChoice[] : [];
    const first = ordered[0];
    if (!first?.revealedCards) return { state, events: [] };
    const selected: TeachingOrderChoice = {
        selectedCardUid: first.selectedCardUid,
        selectedDefId: first.selectedDefId,
        selectedPower: first.selectedPower,
        baseIndex: first.baseIndex,
        revealedCards: first.revealedCards,
    };
    return {
        state,
        events: buildTeachingResolvedEvents(
            state,
            playerId,
            selected,
            ordered.map(card => card.cardUid).filter((uid): uid is string => typeof uid === 'string'),
            timestamp,
        ),
    };
}

function handleFreedomPower(
    state: MatchState<SmashUpCore>,
    _playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selected = value as ActionChoice;
    if (!selected.cardUid || !selected.defId || !selected.ownerId) return { state, events: [] };
    return {
        state,
        events: [{
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: {
                cardUid: selected.cardUid,
                defId: selected.defId,
                fromPlayerId: selected.ownerId,
                toPlayerId: selected.ownerId,
                reason: 'mythic_horses_freedom_power',
            },
            timestamp,
        } as SmashUpEvent],
    };
}

function handleTogethernessPower(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selected = value as BaseChoice;
    if (selected.baseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'mythic_horses_togetherness_power', selected.baseIndex)],
    };
}

function handleAdventurePowerMinions(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selectedMinions = Array.isArray(value) ? value as MinionChoice[] : [];
    if (selectedMinions.length === 0) return { state, events: [] };
    const options = buildBaseOptions(
        state.core,
        () => true,
        baseIndex => ({ baseIndex, selectedMinions }),
    );
    const prompt = createSimpleChoice(
        `mythic_horses_adventure_power_base_${timestamp}`,
        playerId,
        '冒险之力：选择目标基地',
        options,
        {
            sourceId: 'mythic_horses_adventure_power_base',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_adventure_power_base_title',
        },
    );
    return { state: queueInteraction(state, prompt, { urgent: true }), events: [] };
}

function handleAdventurePowerBase(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selected = value as BaseChoice;
    if (selected.baseIndex === undefined || !selected.selectedMinions) return { state, events: [] };
    const events = selected.selectedMinions.flatMap(minion => {
        if (!minion.minionUid || minion.baseIndex === undefined || !minion.defId || minion.baseIndex === selected.baseIndex) {
            return [];
        }
        return buildValidatedMoveEvents(state, {
            minionUid: minion.minionUid,
            minionDefId: minion.defId,
            fromBaseIndex: minion.baseIndex,
            toBaseIndex: selected.baseIndex!,
            reason: 'mythic_horses_adventure_power',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'mythic_horses_adventure_power',
            sourceControllerId: playerId,
            sourceKind: 'action',
        });
    });
    return { state, events };
}

function handleFriendshipPowerMinion(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selected = value as MinionChoice;
    if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };
    const options = buildBaseOptions(
        state.core,
        baseIndex => (
            baseIndex !== selected.baseIndex
            && state.core.bases[baseIndex].minions.some(minion => minion.controller === playerId)
        ),
        baseIndex => ({ baseIndex, selectedMinions: [selected] }),
    );
    if (options.length === 0) return { state, events: [] };
    const prompt = createSimpleChoice(
        `mythic_horses_friendship_power_base_${timestamp}`,
        playerId,
        '友谊之力：选择另一个已有你随从的基地',
        options,
        {
            sourceId: 'mythic_horses_friendship_power_base',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_friendship_power_base_title',
        },
    );
    return { state: queueInteraction(state, prompt, { urgent: true }), events: [] };
}

function handleFriendshipPowerBase(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selected = value as BaseChoice;
    const minion = selected.selectedMinions?.[0];
    if (selected.baseIndex === undefined || !minion?.minionUid || minion.baseIndex === undefined || !minion.defId) {
        return { state, events: [] };
    }
    const prompt = createSimpleChoice(
        `mythic_horses_friendship_power_top_${timestamp}`,
        playerId,
        '友谊之力：是否将这张行动放到牌库顶？',
        [
            {
                id: 'top',
                label: '放到牌库顶',
                labelKey: 'ui.mythic_horses_friendship_power_top_option',
                value: { ...selected, sourceCardUid: 'pending', sourceDefId: 'mythic_horses_friendship_power', playerId, putOnDeckTop: true },
                displayMode: 'button' as const,
            },
            {
                id: 'discard',
                label: '留在弃牌堆',
                labelKey: 'ui.mythic_horses_friendship_power_discard_option',
                value: { ...selected, playerId, putOnDeckTop: false },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'mythic_horses_friendship_power_top',
            targetType: 'button',
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_horses_friendship_power_top_title',
        },
    );
    return { state: queueInteraction(state, prompt, { urgent: true }), events: [
        ...buildValidatedMoveEvents(state, {
            minionUid: minion.minionUid,
            minionDefId: minion.defId,
            fromBaseIndex: minion.baseIndex,
            toBaseIndex: selected.baseIndex,
            reason: 'mythic_horses_friendship_power',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'mythic_horses_friendship_power',
            sourceControllerId: playerId,
            sourceKind: 'action',
        }),
    ] };
}

function handleFriendshipPowerTop(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selected = value as BaseChoice;
    if (!selected.putOnDeckTop) return { state, events: [] };
    const card = state.core.players[playerId]?.discard.find(entry => entry.defId === 'mythic_horses_friendship_power');
    if (!card) return { state, events: [] };
    return {
        state,
        events: [{
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: playerId,
                reason: 'mythic_horses_friendship_power',
                sourcePlayerId: playerId,
                sourceCardUid: card.uid,
                sourceDefId: card.defId,
            },
            timestamp,
        } as SmashUpEvent],
    };
}

export function registerMythicHorsesAbilities(): void {
    registerAbility('mythic_horses_seastar', 'talent', mythicHorsesSeastar);
    registerAbility('mythic_horses_seastar_pod', 'onPlay', mythicHorsesSeastarPod);
    registerAbility('mythic_horses_rainbow', 'talent', mythicHorsesRainbow);
    registerAbility('mythic_horses_teaching_power', 'special', mythicHorsesTeachingPower);
    registerAbility('mythic_horses_super_future_space_armor_power', 'onPlay', mythicHorsesSuperFutureSpaceArmorPower);
    registerAbility('mythic_horses_super_future_space_armor_power_pod', 'onPlay', mythicHorsesSuperFutureSpaceArmorPowerPod);
    registerAbility('mythic_horses_togetherness_power', 'onPlay', mythicHorsesTogethernessPower);
    registerAbility('mythic_horses_adventure_power', 'onPlay', mythicHorsesAdventurePower);
    registerAbility('mythic_horses_freedom_power', 'onPlay', mythicHorsesFreedomPower);
    registerAbility('mythic_horses_friendship_power', 'onPlay', mythicHorsesFriendshipPower);
    registerTrigger('mythic_horses_sharing_power', 'onTurnStart', mythicHorsesSharingPowerOnTurnStart, {
        playerContext: 'sourceController',
        perInstance: true,
    });
    registerTrigger('mythic_horses_sharing_power_pod', 'onTurnStart', mythicHorsesSharingPowerPodOnTurnStart, {
        playerContext: 'sourceController',
        perInstance: true,
    });
    registerTrigger('mythic_horses_sharing_power_pod', 'onTurnEnd', mythicHorsesSharingPowerPodOnTurnEnd, {
        playerContext: 'sourceController',
        perInstance: true,
    });
    registerInteractionHandler('mythic_horses_teaching_power', handleTeachingPower);
    registerInteractionHandler('mythic_horses_teaching_power_order', handleTeachingPowerOrder);
    registerInteractionHandler('mythic_horses_super_future_space_armor_power', handleArmorPower);
    registerInteractionHandler('mythic_horses_freedom_power', handleFreedomPower);
    registerInteractionHandler('mythic_horses_togetherness_power', handleTogethernessPower);
    registerInteractionHandler('mythic_horses_adventure_power_minions', handleAdventurePowerMinions);
    registerInteractionHandler('mythic_horses_adventure_power_base', handleAdventurePowerBase);
    registerInteractionHandler('mythic_horses_friendship_power_minion', handleFriendshipPowerMinion);
    registerInteractionHandler('mythic_horses_friendship_power_base', handleFriendshipPowerBase);
    registerInteractionHandler('mythic_horses_friendship_power_top', handleFriendshipPowerTop);
}
