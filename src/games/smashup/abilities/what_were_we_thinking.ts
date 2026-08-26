import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    findMinionOnBases,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    grantExtraMinion,
    inspectDeck,
    recoverCardsFromDiscard,
    revealDeckTop,
    shuffleBaseDeck,
} from '../domain/abilityHelpers';
import { registerBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext, BaseAbilityResult } from '../domain/baseAbilities';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerCardAbilitySuppression, registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext, TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { getEffectiveBreakpoint, getEffectivePower } from '../domain/ongoingModifiers';
import { getBaseDef, getCardDef } from '../data/cards';
import { SU_EVENTS } from '../domain/types';
import type {
    CardInstance,
    CardsDrawnEvent,
    DeckReorderedEvent,
    MinionCardDef,
    MinionPlayedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';

type RockStarsPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type CardSearchOption = {
    cardUid?: string;
    defId?: string;
    zone?: 'deck' | 'discard';
    skip?: boolean;
};

type MinionMoveChoice = {
    minionUid?: string;
    minionDefId?: string;
    baseIndex?: number;
    skip?: boolean;
};

type BaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    skip?: boolean;
};

type RockOfLuuvContext = RockStarsPromptContext & {
    options: Array<{ cardUid: string; defId: string; label: string }>;
};

type ReunionTourContext = RockStarsPromptContext & {
    options: Array<{ cardUid: string; defId: string; label: string }>;
};

type GroupieSearchContext = RockStarsPromptContext & {
    sourceId: 'rock_stars_guest_star' | 'rock_stars_the_monarch';
    grantExtraGroupie: boolean;
    options: Array<{ cardUid: string; defId: string; zone: 'deck' | 'discard'; label: string }>;
};

type MoveToBaseContext = RockStarsPromptContext & {
    sourceId: 'rock_stars_rick_roll' | 'rock_stars_tour_bus';
    sourceCardUid?: string;
    targetBaseIndex: number;
    targetBaseDefId?: string;
};

type TourBusBaseContext = RockStarsPromptContext;

type PaloozaContext = {
    targetBaseIndex: number;
    remainingPlayerIds: PlayerId[];
};

type TeddyHandMinionChoice = {
    cardUid?: string;
    defId?: string;
    power?: number;
    skip?: boolean;
};

type TeddyGroupHugContext = RockStarsPromptContext & {
    options: Array<{ minionUid: string; defId: string; baseIndex: number; label: string }>;
};

type TeddySirSqueezesContext = RockStarsPromptContext & {
    targetBaseIndex: number;
    options: Array<{ cardUid: string; defId: string; ownerId: PlayerId; power: number; label: string }>;
};

const GROUPIE_DEF_ID = 'rock_stars_groupie';

function getCardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function getBaseName(state: SmashUpCore, baseIndex: number): string {
    const baseDefId = state.bases[baseIndex]?.defId;
    return getBaseDef(baseDefId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function getPrintedPower(defId: string): number | undefined {
    const def = getCardDef(defId);
    return def?.type === 'minion' ? (def as MinionCardDef).power : undefined;
}

function buildCardOption(
    card: CardInstance,
    index: number,
    zone: 'deck' | 'discard',
): PromptOption<CardSearchOption> {
    return {
        id: `${zone}-${index}`,
        label: `${getCardName(card.defId)}（${zone === 'deck' ? '牌库' : '弃牌堆'}）`,
        value: { cardUid: card.uid, defId: card.defId, zone },
        _source: zone,
        displayMode: 'card',
    };
}

function buildDeckShuffleEvent(
    playerId: PlayerId,
    deck: CardInstance[],
    random: RandomFn,
    reason: string,
    timestamp: number,
): DeckReorderedEvent {
    const shuffledDeck = random.shuffle([...deck]);
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids: shuffledDeck.map(card => card.uid), reason },
        timestamp,
    } as DeckReorderedEvent;
}

function buildMoveCardsToHandEvents(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selections: Array<{ cardUid: string; defId: string; zone: 'deck' | 'discard' }>,
    random: RandomFn,
    reason: string,
    timestamp: number,
): SmashUpEvent[] {
    const player = state.core.players[playerId];
    if (!player) return [];
    const deckUidSet = new Set(selections.filter(card => card.zone === 'deck').map(card => card.cardUid));
    const discardUids = selections.filter(card => card.zone === 'discard').map(card => card.cardUid);
    const events: SmashUpEvent[] = [];

    if (deckUidSet.size > 0) {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: deckUidSet.size, cardUids: Array.from(deckUidSet) },
            timestamp,
        } as CardsDrawnEvent);
        events.push(buildDeckShuffleEvent(
            playerId,
            player.deck.filter(card => !deckUidSet.has(card.uid)),
            random,
            reason,
            timestamp,
        ));
    }

    if (discardUids.length > 0) {
        events.push(recoverCardsFromDiscard(playerId, discardUids, reason, timestamp));
    }

    return events;
}

function buildOwnLowerBreakpointMinionOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    targetBaseIndex: number,
    sourceId: string,
) {
    const targetBreakpoint = getEffectiveBreakpoint(state, targetBaseIndex);
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        if (baseIndex === targetBaseIndex) return;
        if (getEffectiveBreakpoint(state, baseIndex) >= targetBreakpoint) return;
        base.minions.forEach((minion) => {
            if (minion.controller !== playerId) return;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardName(minion.defId)} @ ${getBaseName(state, baseIndex)}`,
            });
        });
    });
    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: playerId,
        sourceDefId: sourceId,
        sourceKind: 'nonAction',
        effectType: 'move',
    });
}

const reunionTourPromptProgram = createPromptProgram<ReunionTourContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'rock_stars_reunion_tour',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `rock_stars_reunion_tour_${context.now}`,
        context.playerId,
        '重聚巡演：选择任意数量的己方弃牌堆随从洗回牌库',
        context.options.map((option, index) => ({
            id: `discard-${index}`,
            label: option.label,
            value: { cardUid: option.cardUid, defId: option.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'rock_stars_reunion_tour',
            targetType: 'discard',
            multi: { min: 0, max: context.options.length },
            titleKey: 'ui.rock_stars_reunion_tour_title',
        },
    ),
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const selections = Array.isArray(value) ? value as CardSearchOption[] : [];
        const selectedUids = new Set(selections.map(selection => selection.cardUid).filter((uid): uid is string => !!uid));
        if (selectedUids.size === 0) return { events: [] };
        const player = state.core.players[playerId];
        const selectedCards = player.discard.filter(card => selectedUids.has(card.uid) && card.type === 'minion');
        if (selectedCards.length === 0) return { events: [] };
        return {
            events: [buildDeckShuffleEvent(
                playerId,
                [...player.deck, ...selectedCards],
                random,
                'rock_stars_reunion_tour',
                timestamp,
            )],
        };
    },
});

const rockOfLuuvPromptProgram = createPromptProgram<RockOfLuuvContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'rock_stars_rock_of_luuv',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `rock_stars_rock_of_luuv_${context.now}`,
        context.playerId,
        '爱之摇滚：选择至多 3 张同名、力量不高于 2 的随从加入手牌',
        [
            ...context.options.map((option, index) => ({
                id: `deck-${index}`,
                label: option.label,
                value: { cardUid: option.cardUid, defId: option.defId, zone: 'deck' as const },
                _source: 'deck' as const,
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: 'rock_stars_rock_of_luuv',
            targetType: 'deck',
            multi: { min: 0, max: Math.min(3, context.options.length) },
            titleKey: 'ui.rock_stars_rock_of_luuv_title',
        },
    ),
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const rawSelections = Array.isArray(value) ? value as CardSearchOption[] : [];
        const firstDefId = rawSelections.find(selection => selection.defId)?.defId;
        if (!firstDefId) return { events: [] };
        const selections = rawSelections
            .filter(selection => selection.cardUid && selection.defId === firstDefId)
            .slice(0, 3)
            .map(selection => ({ cardUid: selection.cardUid!, defId: selection.defId!, zone: 'deck' as const }));
        return { events: buildMoveCardsToHandEvents(state, playerId, selections, random, 'rock_stars_rock_of_luuv', timestamp) };
    },
});

const groupieSearchPromptProgram = createPromptProgram<GroupieSearchContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'rock_stars_groupie_search',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.sourceId === 'rock_stars_guest_star'
            ? '嘉宾明星：选择一张追星族加入手牌，并获得额外打出追星族的机会'
            : '帝王：选择一张追星族加入手牌',
        [
            ...context.options.map((option, index) => buildCardOption(
                { uid: option.cardUid, defId: option.defId, type: 'minion', owner: context.playerId },
                index,
                option.zone,
            )),
            createSkipOption(),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'generic',
            titleKey: context.sourceId === 'rock_stars_guest_star'
                ? 'ui.rock_stars_guest_star_title'
                : 'ui.rock_stars_the_monarch_title',
        },
    ),
    onResolve: ({ state, context, playerId, value, random, timestamp }) => {
        const selected = value as CardSearchOption;
        if (selected.skip || !selected.cardUid || !selected.defId || !selected.zone) return { events: [] };
        const events = buildMoveCardsToHandEvents(
            state,
            playerId,
            [{ cardUid: selected.cardUid, defId: selected.defId, zone: selected.zone }],
            random,
            context.sourceId,
            timestamp,
        );
        if (context.grantExtraGroupie) {
            events.push(grantContextualExtraMinion(
                { playerId, now: timestamp, matchState: state },
                'rock_stars_guest_star',
                undefined,
                { sameNameOnly: true, sameNameDefId: GROUPIE_DEF_ID },
            ));
        }
        return { events };
    },
});

const moveToBasePromptProgram = createPromptProgram<MoveToBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'rock_stars_move_to_base',
    buildInteraction: (context) => {
        const options = buildOwnLowerBreakpointMinionOptions(
            context.matchState.core,
            context.playerId,
            context.targetBaseIndex,
            context.sourceId,
        );
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_move_${context.now}`,
            context.playerId,
            context.sourceId === 'rock_stars_tour_bus'
                ? '巡演巴士：选择至多 3 个低爆破点基地上的己方随从移动到目标基地'
                : '瑞克摇滚：选择至多 3 个低爆破点基地上的己方随从移动到这里',
            options,
            {
                sourceId: context.sourceId,
                targetType: 'minion',
                multi: { min: 0, max: Math.min(3, options.length) },
                titleKey: context.sourceId === 'rock_stars_tour_bus'
                    ? 'ui.rock_stars_tour_bus_move_title'
                    : 'ui.rock_stars_rick_roll_title',
            },
        );
    },
    onResolve: ({ state, context, playerId, value, timestamp }) => {
        const picks = Array.isArray(value) ? value as MinionMoveChoice[] : [];
        const unique = new Map<string, MinionMoveChoice>();
        for (const pick of picks) {
            if (!pick.minionUid || !pick.minionDefId || pick.baseIndex === undefined) continue;
            unique.set(pick.minionUid, pick);
        }
        const batchId = `${context.sourceId}_${timestamp}`;
        return {
            events: Array.from(unique.values()).slice(0, 3).flatMap(pick => buildValidatedMoveEvents(state, {
                minionUid: pick.minionUid!,
                minionDefId: pick.minionDefId!,
                fromBaseIndex: pick.baseIndex!,
                toBaseIndex: context.targetBaseIndex,
                toBaseDefId: context.targetBaseDefId,
                reason: context.sourceId,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceId,
                sourceControllerId: playerId,
                sourceBaseIndex: context.targetBaseIndex,
                sourceKind: 'nonAction',
                batchId,
            })),
        };
    },
});

const tourBusChooseBasePromptProgram = createPromptProgram<TourBusBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'rock_stars_tour_bus_choose_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `rock_stars_tour_bus_base_${context.now}`,
        context.playerId,
        '巡演巴士：选择目标基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            })),
            context.matchState.core,
        ),
        { sourceId: 'rock_stars_tour_bus_choose_base', targetType: 'base', titleKey: 'ui.rock_stars_tour_bus_base_title' },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as BaseChoice;
        if (selected.baseIndex === undefined) return { events: [] };
        return {
            events: [],
            context: {
                ...context,
                now: timestamp,
                sourceId: 'rock_stars_tour_bus',
                targetBaseIndex: selected.baseIndex,
                targetBaseDefId: selected.baseDefId,
            } satisfies MoveToBaseContext,
            nextProgram: moveToBasePromptProgram,
        };
    },
});

function rockStarsReunionTour(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const options = player.discard
        .filter(card => card.type === 'minion')
        .map(card => ({ cardUid: card.uid, defId: card.defId, label: getCardName(card.defId) }));
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    }
    return executeAbilityProgram(reunionTourPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        options,
    });
}

function rockStarsRockOfLuuv(ctx: AbilityContext): AbilityResult {
    const options = ctx.state.players[ctx.playerId].deck
        .filter(card => card.type === 'minion' && (getPrintedPower(card.defId) ?? 99) <= 2)
        .map(card => ({ cardUid: card.uid, defId: card.defId, label: `${getCardName(card.defId)}（力量 ${getPrintedPower(card.defId) ?? 0}）` }));
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_search_no_match', ctx.now)] };
    }
    return executeAbilityProgram(rockOfLuuvPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        options,
    });
}

function rockStarsGroupieSearch(ctx: AbilityContext, sourceId: GroupieSearchContext['sourceId'], grantExtraGroupie: boolean): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const deckGroupies = player.deck
        .filter(card => card.defId === GROUPIE_DEF_ID)
        .map(card => ({ cardUid: card.uid, defId: card.defId, zone: 'deck' as const, label: '追星族（牌库）' }));
    const discardGroupies = player.discard
        .filter(card => card.defId === GROUPIE_DEF_ID)
        .map(card => ({ cardUid: card.uid, defId: card.defId, zone: 'discard' as const, label: '追星族（弃牌堆）' }));
    const options = [...deckGroupies, ...discardGroupies];
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_search_no_match', ctx.now)] };
    }
    return executeAbilityProgram(groupieSearchPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        grantExtraGroupie,
        options,
    });
}

function rockStarsGuestStar(ctx: AbilityContext): AbilityResult {
    return rockStarsGroupieSearch(ctx, 'rock_stars_guest_star', true);
}

function rockStarsTheMonarch(ctx: AbilityContext): AbilityResult {
    return rockStarsGroupieSearch(ctx, 'rock_stars_the_monarch', false);
}

function rockStarsClassicRocker(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || getEffectiveBreakpoint(ctx.state, ctx.baseIndex) < 21) return { events: [] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function validateClassicRockerUse(ctx: AbilityContext): string | null {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || getEffectiveBreakpoint(ctx.state, ctx.baseIndex) < 21) {
        return '当前基地爆破点低于 21';
    }
    const alreadyUsed = ctx.state.bases.some(candidateBase =>
        candidateBase.minions.some(minion =>
            minion.controller === ctx.playerId
            && minion.defId === 'rock_stars_classic_rocker'
            && minion.talentUsed,
        ),
    );
    return alreadyUsed ? '每回合只能使用一个经典摇滚客能力' : null;
}

function rockStarsRickRoll(ctx: AbilityContext): AbilityResult {
    const current = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!current) return { events: [] };
    return executeAbilityProgram(moveToBasePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'rock_stars_rick_roll',
        sourceCardUid: ctx.cardUid,
        targetBaseIndex: current.baseIndex,
        targetBaseDefId: ctx.state.bases[current.baseIndex]?.defId,
    });
}

function rockStarsTourBus(ctx: AbilityContext): AbilityResult {
    return executeAbilityProgram(tourBusChooseBasePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    });
}

function rockStarsGroupie(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantContextualExtraMinion(
            { playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState },
            'rock_stars_groupie',
            ctx.baseIndex,
            { sameNameOnly: true, sameNameDefId: GROUPIE_DEF_ID },
        )],
    };
}

function rockStarsPowerBallad(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[targetBaseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => addTempPower(
                minion.uid,
                targetBaseIndex,
                1,
                'rock_stars_power_ballad',
                ctx.now,
                {
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: 'rock_stars_power_ballad',
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: targetBaseIndex,
                },
            )),
    };
}

function rockStarsTotalSellout(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    if (!ctx.state.bases[baseIndex]) return { events: [] };
    const drawCount = getEffectiveBreakpoint(ctx.state, baseIndex) >= 21 ? 3 : 2;
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now) };
}

function rockStarsHotVenueTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || ctx.sourceControllerId === undefined) return [];
    const player = ctx.state.players[ctx.sourceControllerId];
    if (!player || (player.minionsPlayedPerBase?.[ctx.sourceBaseIndex] ?? 0) <= 0) return [];
    if (getEffectiveBreakpoint(ctx.state, ctx.sourceBaseIndex) < 21) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function canTriggerRockStarsHotVenueTurnEnd(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || ctx.sourceControllerId === undefined) return false;
    const player = ctx.state.players[ctx.sourceControllerId];
    if (!player || (player.minionsPlayedPerBase?.[ctx.sourceBaseIndex] ?? 0) <= 0) return false;
    return getEffectiveBreakpoint(ctx.state, ctx.sourceBaseIndex) >= 21;
}

function lakeMinnetonkaOnMinionPlayed(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.minionUid) return { events: [] };
    return {
        events: [addTempPower(ctx.minionUid, ctx.baseIndex, 1, 'base_lake_minnetonka', ctx.now)],
    };
}

function lakeMinnetonkaOnMinionMoved(ctx: TriggerContext): SmashUpEvent[] {
    if (
        ctx.sourceBaseIndex === undefined
        || ctx.moveToBaseIndex !== ctx.sourceBaseIndex
        || !ctx.triggerMinionUid
    ) {
        return [];
    }
    return [addTempPower(ctx.triggerMinionUid, ctx.sourceBaseIndex, 1, 'base_lake_minnetonka', ctx.now)];
}

function collectPaloozaCandidates(state: SmashUpCore, playerId: PlayerId, targetBaseIndex: number) {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        if (baseIndex === targetBaseIndex) return;
        base.minions.forEach((minion) => {
            if (minion.controller !== playerId) return;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardName(minion.defId)} @ ${getBaseName(state, baseIndex)}`,
            });
        });
    });
    return candidates;
}

function buildPaloozaPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    context: PaloozaContext,
    now: number,
) {
    const candidates = collectPaloozaCandidates(matchState.core, playerId, context.targetBaseIndex);
    const interaction = createSimpleChoice(
        `base_palooza_${playerId}_${now}`,
        playerId,
        '演唱会：你可以移动一个自己的随从到这里',
        [
            ...buildMinionTargetOptions(candidates, {
                state: matchState.core,
                sourcePlayerId: playerId,
                sourceDefId: 'base_palooza',
                sourceKind: 'nonAction',
                effectType: 'move',
            }),
            createSkipOption(),
        ],
        { sourceId: 'base_palooza', targetType: 'minion', titleKey: 'ui.base_palooza_title' },
    );
    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: context,
            optionsGenerator: (state: MatchState<SmashUpCore>) => [
                ...buildMinionTargetOptions(
                    collectPaloozaCandidates(state.core, playerId, context.targetBaseIndex),
                    {
                        state: state.core,
                        sourcePlayerId: playerId,
                        sourceDefId: 'base_palooza',
                        sourceKind: 'nonAction',
                        effectType: 'move',
                    },
                ),
                createSkipOption(),
            ],
        },
    };
}

function getPaloozaPlayerQueue(state: SmashUpCore, targetBaseIndex: number): PlayerId[] {
    return state.turnOrder.filter(playerId => collectPaloozaCandidates(state, playerId, targetBaseIndex).length > 0);
}

function basePaloozaBeforeScoring(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState) return { events: [] };
    const remainingPlayerIds = getPaloozaPlayerQueue(ctx.state, ctx.baseIndex);
    const [firstPlayerId, ...rest] = remainingPlayerIds;
    if (!firstPlayerId) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(
            ctx.matchState,
            buildPaloozaPrompt(ctx.matchState, firstPlayerId, { targetBaseIndex: ctx.baseIndex, remainingPlayerIds: rest }, ctx.now),
        ),
    };
}

function handlePaloozaPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as MinionMoveChoice;
    const context = interactionData?.continuationContext as PaloozaContext | undefined;
    if (!context) return { state, events: [] };

    const events = selected.skip || !selected.minionUid || !selected.minionDefId || selected.baseIndex === undefined
        ? []
        : buildValidatedMoveEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId,
            fromBaseIndex: selected.baseIndex,
            toBaseIndex: context.targetBaseIndex,
            reason: 'base_palooza',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'base_palooza',
            sourceControllerId: playerId,
            sourceBaseIndex: context.targetBaseIndex,
            sourceKind: 'nonAction',
        });

    const [nextPlayerId, ...rest] = context.remainingPlayerIds
        .filter(nextId => nextId !== playerId);
    if (!nextPlayerId) return { state, events };

    return {
        state: queueInteraction(
            state,
            buildPaloozaPrompt(state, nextPlayerId, {
                targetBaseIndex: context.targetBaseIndex,
                remainingPlayerIds: rest,
            }, timestamp),
            { urgent: true },
        ),
        events,
    };
}

function getActionController(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId;
}

function teddyBearsSquareDeal(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const otherHandCounts = Object.values(ctx.state.players)
        .filter(candidate => candidate.id !== ctx.playerId)
        .map(candidate => candidate.hand.length);
    if (otherHandCounts.length === 0) return { events: [] };
    const lowestOtherHand = Math.min(...otherHandCounts);
    const drawCount = Math.max(0, lowestOtherHand - player.hand.length + 1);
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now) };
}

function teddyBearsLoveOverload(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base || base.minions.length === 0) return { events: [] };
    const ranked = base.minions.map(minion => ({
        minion,
        power: getEffectivePower(ctx.state, minion, baseIndex),
    }));
    const highest = Math.max(...ranked.map(candidate => candidate.power));
    return {
        events: ranked
            .filter(candidate => candidate.power === highest)
            .flatMap(candidate => buildValidatedDestroyEvents(ctx.state, {
                minionUid: candidate.minion.uid,
                minionDefId: candidate.minion.defId,
                fromBaseIndex: baseIndex,
                destroyerId: ctx.playerId,
                reason: 'teddy_bears_love_overload',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: 'teddy_bears_love_overload',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
                sourceKind: 'action',
            })),
    };
}

const teddyGroupHugPromptProgram = createPromptProgram<TeddyGroupHugContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'teddy_bears_group_hug',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `teddy_bears_group_hug_${context.now}`,
        context.playerId,
        '集体拥抱：选择一个己方随从获得临时力量',
        [
            ...buildMinionTargetOptions(context.options.map(option => ({
                uid: option.minionUid,
                defId: option.defId,
                baseIndex: option.baseIndex,
                label: option.label,
            })), {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'teddy_bears_group_hug',
                sourceKind: 'action',
                effectType: 'buff',
            }),
            createSkipOption(),
        ],
        { sourceId: 'teddy_bears_group_hug', targetType: 'minion', titleKey: 'ui.teddy_bears_group_hug_title' },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as MinionMoveChoice;
        if (choice.skip || !choice.minionUid || choice.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[choice.baseIndex];
        const target = base?.minions.find(minion => minion.uid === choice.minionUid);
        if (!base || !target || target.controller !== playerId) return { events: [] };
        const amount = Math.max(0, base.minions.length - 1);
        return { events: amount > 0 ? [addTempPower(choice.minionUid, choice.baseIndex, amount, 'teddy_bears_group_hug', timestamp, {
            sourcePlayerId: playerId,
            sourceDefId: 'teddy_bears_group_hug',
            sourceControllerId: playerId,
            sourceBaseIndex: choice.baseIndex,
        })] : [] };
    },
});

function teddyBearsGroupHug(ctx: AbilityContext): AbilityResult {
    const options: TeddyGroupHugContext['options'] = [];
    ctx.state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (minion.controller !== ctx.playerId) return;
            options.push({
                minionUid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardName(minion.defId)} @ ${getBaseName(ctx.state, baseIndex)}`,
            });
        });
    });
    if (options.length === 0) return { events: [] };
    return executeAbilityProgram(teddyGroupHugPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        options,
    });
}

function teddyBearsCarePackage(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            grantContextualExtraMinion(ctx, 'teddy_bears_care_package'),
        ],
    };
}

const teddySirSqueezesPromptProgram = createPromptProgram<TeddySirSqueezesContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'teddy_bears_sir_squeezes',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `teddy_bears_sir_squeezes_${context.now}`,
        context.playerId,
        '挤挤爵士：选择至多 3 个总力量不超过 5 的低力量随从打到本基地',
        context.options.map((option, index) => ({
            id: `hand-${index}`,
            label: option.label,
            value: { cardUid: option.cardUid, defId: option.defId, ownerId: option.ownerId, power: option.power },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'teddy_bears_sir_squeezes',
            targetType: 'hand',
            multi: { min: 0, max: Math.min(3, context.options.length) },
            titleKey: 'ui.teddy_bears_sir_squeezes_title',
        },
    ),
    onResolve: ({ state, context, playerId, value, timestamp }) => {
        const choices = Array.isArray(value) ? value as TeddyHandMinionChoice[] : [];
        const validOptions = new Map(context.options.map(option => [option.cardUid, option]));
        const selected: TeddySirSqueezesContext['options'] = [];
        let totalPower = 0;
        for (const choice of choices) {
            if (!choice.cardUid || selected.some(existing => existing.cardUid === choice.cardUid)) continue;
            const option = validOptions.get(choice.cardUid);
            if (!option) continue;
            if (selected.length >= 3 || totalPower + option.power > 5) continue;
            selected.push(option);
            totalPower += option.power;
        }
        return {
            events: selected.map((option) => ({
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId,
                    cardUid: option.cardUid,
                    defId: option.defId,
                    baseIndex: context.targetBaseIndex,
                    ownerId: option.ownerId,
                    baseDefId: state.core.bases[context.targetBaseIndex]?.defId,
                    power: option.power,
                    consumesNormalLimit: false,
                },
                timestamp,
            }) as MinionPlayedEvent),
        };
    },
});

function teddyBearsSirSqueezes(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const options = player.hand
        .filter(card => card.type === 'minion')
        .map(card => ({ card, power: getPrintedPower(card.defId) ?? 99 }))
        .filter(entry => entry.power <= 3)
        .map(entry => ({
            cardUid: entry.card.uid,
            defId: entry.card.defId,
            ownerId: entry.card.owner,
            power: entry.power,
            label: `${getCardName(entry.card.defId)}（力量 ${entry.power}）`,
        }));
    if (options.length === 0) return { events: [] };
    return executeAbilityProgram(teddySirSqueezesPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        targetBaseIndex: ctx.baseIndex,
        options,
    });
}

function teddyBearsTeaParty(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || base.minions.length < 2) return { events: [] };
    if (!base.minions.some(minion => minion.controller === ctx.playerId)) return { events: [] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function teddyBearsFunBearTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    if (ctx.playerId === ctx.sourceControllerId) return [];
    return [addPowerCounter(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'teddy_bears_fun_bear', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'teddy_bears_fun_bear',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

function teddyBearsSnugglyBearTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || ctx.sourceControllerId !== ctx.playerId) return [];
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.minionsPlayed !== 1) return [];
    return [grantExtraMinion(ctx.playerId, 'teddy_bears_snuggly_bear', ctx.now, ctx.baseIndex, {
        sameNameOnly: true,
        sameNameDefId: 'teddy_bears_snuggly_bear',
        playTiming: 'immediate',
    })];
}

function baseOutInTheWoodsBeforeScoring(ctx: BaseAbilityContext): BaseAbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions.map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, 'base_out_in_the_woods', ctx.now)),
    };
}

function baseUnderTheBedOnMinionPlayed(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex === undefined) return [];
    if (ctx.baseIndex === ctx.sourceBaseIndex) return [];
    const currentPlayerId = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
    if (ctx.playerId !== currentPlayerId) return [];
    return [grantExtraMinion(ctx.playerId, 'base_under_the_bed', ctx.now, ctx.sourceBaseIndex, {
        powerMax: 2,
        playTiming: 'immediate',
    })];
}

function teddyBearsTooCuteProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(action => (
        action.defId === 'teddy_bears_too_cute'
        && getActionController(action) === ctx.targetMinion.controller
    ));
}

function teddyBearsBearPicnicRestriction(ctx: RestrictionCheckContext): boolean {
    const basePower = ctx.extra?.basePower as number | undefined;
    const minionDefId = ctx.extra?.minionDefId as string | undefined;
    if (!minionDefId || basePower === undefined || basePower > 2) return false;
    const cardUid = ctx.extra?.cardUid as string | undefined;
    const player = ctx.state.players[ctx.playerId];
    const playedCard = cardUid
        ? [...(player?.hand ?? []), ...(player?.discard ?? []), ...(player?.deck ?? [])].find(card => card.uid === cardUid)
        : undefined;
    if (playedCard && playedCard.owner !== ctx.playerId) return false;
    return ctx.state.bases.some((base, picnicBaseIndex) => {
        if (picnicBaseIndex === ctx.baseIndex) return false;
        return base.ongoingActions.some(action => (
            action.defId === 'teddy_bears_bear_picnic'
            && getActionController(action) !== ctx.playerId
        ));
    });
}

function teddyBearsCuddleSuppression(
    state: SmashUpCore,
    turnScopedSuppressedCardUids: ReadonlySet<string>,
): string[] {
    const suppressed = new Set<string>();
    for (const base of state.bases) {
        for (const minion of base.minions) {
            if (minion.attachedActions.some(action => (
                action.defId === 'teddy_bears_cuddle'
                && !turnScopedSuppressedCardUids.has(action.uid)
            ))) {
                suppressed.add(minion.uid);
            }
        }
    }
    return Array.from(suppressed);
}

type DeckPlacementMode = 'top' | 'bottom';

type GranniesPlacementChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    baseIndex?: number;
    mode?: DeckPlacementMode;
    skip?: boolean;
};

type GranniesDrawOrPlayChoice = {
    mode?: 'draw' | 'return' | 'play';
};

type RetirementCommunityContext = {
    targetBaseIndex: number;
    remainingPlayerIds: PlayerId[];
};

type ExplorerMinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    baseIndex?: number;
    baseDefId?: string;
    toBaseIndex?: number;
    toBaseDefId?: string;
    controllerId?: PlayerId;
    ownerId?: PlayerId;
    skip?: boolean;
    mode?: 'play';
};

type ExplorerBaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    defId?: string;
    skip?: boolean;
    mode?: 'counters' | 'draw';
};

type ExplorerMoveOneContext = {
    sourceId: 'explorers_you_call_this_archaeology';
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
};

type ExplorerFortuneContext = {
    sourceBaseIndex: number;
    destinationBaseIndex?: number;
    destinationBaseDefId?: string;
};

type ExplorerForgottenHorrorsContext = {
    cardUid: string;
    ownerId: PlayerId;
    sourceBaseIndex: number;
    metadata?: Record<string, unknown>;
    talentUsed?: boolean;
};

function withContinuation<T extends { data?: Record<string, unknown> }>(
    interaction: T,
    continuationContext: unknown,
): T {
    return {
        ...interaction,
        data: {
            ...(interaction.data ?? {}),
            continuationContext,
        },
    };
}

function cardInstanceFromMinion(minion: SmashUpCore['bases'][number]['minions'][number]): CardInstance {
    return { uid: minion.uid, defId: minion.defId, type: 'minion', owner: minion.owner };
}

function cardToDeckPlacementEvent(
    card: Pick<CardInstance, 'uid' | 'defId' | 'owner'>,
    mode: DeckPlacementMode,
    reason: string,
    now: number,
    sourcePlayerId: PlayerId,
    sourceDefId: string,
    sourceCardUid?: string,
    sourceBaseIndex?: number,
): SmashUpEvent {
    return {
        type: mode === 'top' ? SU_EVENTS.CARD_TO_DECK_TOP : SU_EVENTS.CARD_TO_DECK_BOTTOM,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            reason,
            sourcePlayerId,
            sourceDefId,
            ...(sourceCardUid ? { sourceCardUid } : {}),
            ...(sourceBaseIndex !== undefined ? { sourceBaseIndex } : {}),
        },
        timestamp: now,
    } as SmashUpEvent;
}

function reorderDeckCardWithinDeck(
    state: SmashUpCore,
    playerId: PlayerId,
    cardUid: string,
    mode: DeckPlacementMode,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const player = state.players[playerId];
    const card = player?.deck.find(candidate => candidate.uid === cardUid);
    if (!player || !card) return [];
    if (mode === 'top' && player.deck[0]?.uid === cardUid) return [];
    if (mode === 'bottom' && player.deck[player.deck.length - 1]?.uid === cardUid) return [];
    const rest = player.deck.filter(candidate => candidate.uid !== cardUid).map(candidate => candidate.uid);
    return [{
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: mode === 'top' ? [cardUid, ...rest] : [...rest, cardUid],
            reason,
        },
        timestamp: now,
    } as DeckReorderedEvent];
}

function buildDeckTopBottomPrompt(
    playerId: PlayerId,
    sourceId: string,
    title: string,
    titleKey: string,
    card: CardInstance,
    now: number,
) {
    const interaction = createSimpleChoice(
        `${sourceId}_${now}`,
        playerId,
        title,
        [
            {
                id: 'top',
                label: '留在牌库顶',
                labelKey: 'ui.what_were_we_thinking_deck_place_top_option',
                value: { mode: 'top' },
                displayMode: 'button' as const,
            },
            {
                id: 'bottom',
                label: '置于牌库底',
                labelKey: 'ui.what_were_we_thinking_deck_place_bottom_option',
                value: { mode: 'bottom' },
                displayMode: 'button' as const,
            },
        ],
        { sourceId, targetType: 'button', displayCard: { defId: card.defId, cardUid: card.uid }, titleKey },
    );
    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: { cardUid: card.uid },
        },
    };
}

function queueDeckTopBottomChoice(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    titleKey: string,
): AbilityResult {
    const top = ctx.state.players[ctx.playerId]?.deck[0];
    if (!top) return { events: [] };
    return {
        events: [
            inspectDeck(ctx.playerId, ctx.playerId, 1, sourceId, ctx.now),
            revealDeckTop(ctx.playerId, ctx.playerId, [{ uid: top.uid, defId: top.defId }], 1, sourceId, ctx.now, ctx.playerId),
        ],
        matchState: queueInteraction(ctx.matchState, buildDeckTopBottomPrompt(ctx.playerId, sourceId, title, titleKey, top, ctx.now)),
    };
}

function handleDeckTopBottomPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
    reason: string,
) {
    const selected = value as { mode?: DeckPlacementMode } | undefined;
    const cardUid = (interactionData?.continuationContext as { cardUid?: string } | undefined)?.cardUid;
    if (!cardUid || !selected?.mode) return { state, events: [] };
    return {
        state,
        events: reorderDeckCardWithinDeck(state.core, playerId, cardUid, selected.mode, reason, timestamp),
    };
}

function granniesGranny(ctx: AbilityContext): AbilityResult {
    return queueDeckTopBottomChoice(ctx, 'grannies_granny', '外婆：将牌库顶牌留在牌库顶或置底', 'ui.grannies_granny_title');
}

function granniesGrandma(ctx: AbilityContext): AbilityResult {
    return queueDeckTopBottomChoice(ctx, 'grannies_grandma', '祖母：将牌库顶牌留在牌库顶或置底', 'ui.grannies_grandma_title');
}

function granniesGrannysPurse(ctx: AbilityContext): AbilityResult {
    const top = ctx.state.players[ctx.playerId]?.deck[0];
    const extraAction = grantContextualExtraAction(ctx, 'grannies_grannys_purse');
    if (!top) return { events: [extraAction] };
    const revealEvents: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, 1, 'grannies_grannys_purse', ctx.now),
        revealDeckTop(ctx.playerId, 'all', [{ uid: top.uid, defId: top.defId }], 1, 'grannies_grannys_purse', ctx.now, ctx.playerId),
    ];
    if (top.type !== 'action') {
        return {
            events: [
                ...revealEvents,
                ...reorderDeckCardWithinDeck(ctx.state, ctx.playerId, top.uid, 'bottom', 'grannies_grannys_purse', ctx.now),
                extraAction,
            ],
        };
    }
    const interaction = createSimpleChoice(
        `grannies_grannys_purse_${ctx.now}`,
        ctx.playerId,
        '外婆的钱包：抓取该行动或放回牌库顶',
        [
            {
                id: 'draw',
                label: '抓至手牌',
                labelKey: 'ui.what_were_we_thinking_draw_to_hand_option',
                value: { mode: 'draw' },
                displayMode: 'button' as const,
            },
            {
                id: 'return',
                label: '放回牌库顶',
                labelKey: 'ui.what_were_we_thinking_return_to_deck_top_option',
                value: { mode: 'return' },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'grannies_grannys_purse', targetType: 'button', displayCard: { defId: top.defId, cardUid: top.uid }, titleKey: 'ui.grannies_grannys_purse_title' },
    );
    return {
        events: [...revealEvents, extraAction],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { cardUid: top.uid } },
        }),
    };
}

function handleGrannysPursePrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as GranniesDrawOrPlayChoice | undefined;
    const cardUid = (interactionData?.continuationContext as { cardUid?: string } | undefined)?.cardUid;
    if (!cardUid || selected?.mode !== 'draw') return { state, events: [] };
    return {
        state,
        events: [{
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [cardUid] },
            timestamp,
        } as CardsDrawnEvent],
    };
}

function granniesNana(ctx: AbilityContext): AbilityResult {
    const top = ctx.state.players[ctx.playerId]?.deck[0];
    if (!top) return { events: [] };
    const revealEvents: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, 1, 'grannies_nana', ctx.now),
        revealDeckTop(ctx.playerId, 'all', [{ uid: top.uid, defId: top.defId }], 1, 'grannies_nana', ctx.now, ctx.playerId),
    ];
    if (top.type !== 'action') {
        return {
            events: [
                ...revealEvents,
                ...reorderDeckCardWithinDeck(ctx.state, ctx.playerId, top.uid, 'bottom', 'grannies_nana', ctx.now),
            ],
        };
    }
    const interaction = createSimpleChoice(
        `grannies_nana_${ctx.now}`,
        ctx.playerId,
        '奶奶：抓取该行动或作为额外行动打出',
        [
            {
                id: 'draw',
                label: '抓至手牌',
                labelKey: 'ui.what_were_we_thinking_draw_to_hand_option',
                value: { mode: 'draw' },
                displayMode: 'button' as const,
            },
            {
                id: 'play',
                label: '作为额外行动打出',
                labelKey: 'ui.what_were_we_thinking_play_as_extra_action_option',
                value: { mode: 'play' },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'grannies_nana', targetType: 'button', displayCard: { defId: top.defId, cardUid: top.uid }, titleKey: 'ui.grannies_nana_title' },
    );
    return {
        events: revealEvents,
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { cardUid: top.uid, defId: top.defId } },
        }),
    };
}

function handleGranniesNanaPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as GranniesDrawOrPlayChoice | undefined;
    const context = interactionData?.continuationContext as { cardUid?: string; defId?: string } | undefined;
    if (!context?.cardUid || !context.defId || (selected?.mode !== 'draw' && selected?.mode !== 'play')) {
        return { state, events: [] };
    }
    const events: SmashUpEvent[] = [{
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId, count: 1, cardUids: [context.cardUid] },
        timestamp,
    } as CardsDrawnEvent];
    if (selected.mode === 'play') {
        events.push(grantContextualExtraAction(
            { playerId, now: timestamp, matchState: state },
            'grannies_nana',
            { restrictToCardUid: context.cardUid, restrictToCardDefId: context.defId },
        ));
    }
    return { state, events };
}

function granniesHushMyStoriesAreOn(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const bottom = player?.deck[player.deck.length - 1];
    if (!player || !bottom) return { events: [] };
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, 1, 'grannies_hush_my_stories_are_on', ctx.now),
        revealDeckTop(ctx.playerId, 'all', [{ uid: bottom.uid, defId: bottom.defId }], 1, 'grannies_hush_my_stories_are_on', ctx.now, ctx.playerId),
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [bottom.uid] },
            timestamp: ctx.now,
        } as CardsDrawnEvent,
    ];
    if (bottom.type === 'minion') {
        events.push(grantContextualExtraMinion(ctx, 'grannies_hush_my_stories_are_on', undefined, {
            specificCardUid: bottom.uid,
        }));
    }
    return { events };
}

function granniesMatriarch(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const bottomCards = player?.deck.slice(-2) ?? [];
    if (!player || bottomCards.length === 0) return { events: [] };
    const minions = bottomCards.filter(card => card.type === 'minion');
    const nonMinions = bottomCards.filter(card => card.type !== 'minion');
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, bottomCards.length, 'grannies_matriarch', ctx.now),
        revealDeckTop(ctx.playerId, 'all', bottomCards.map(card => ({ uid: card.uid, defId: card.defId })), bottomCards.length, 'grannies_matriarch', ctx.now, ctx.playerId),
    ];
    if (minions.length > 0) {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: minions.length, cardUids: minions.map(card => card.uid) },
            timestamp: ctx.now,
        } as CardsDrawnEvent);
    }
    if (nonMinions.length > 0) {
        events.push({
            type: SU_EVENTS.CARDS_MILLED,
            payload: { playerId: ctx.playerId, cardUids: nonMinions.map(card => card.uid), reason: 'grannies_matriarch' },
            timestamp: ctx.now,
        } as SmashUpEvent);
    }
    return { events };
}

function granniesChickenSoup(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const discard = player?.discard ?? [];
    if (discard.length === 0) return { events: [] };
    const options = discard.flatMap(card => ([
        {
            id: `${card.uid}-top`,
            label: `${getCardName(card.defId)} → 牌库顶`,
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner, mode: 'top' as const },
            displayMode: 'card' as const,
        },
        {
            id: `${card.uid}-bottom`,
            label: `${getCardName(card.defId)} → 牌库底`,
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner, mode: 'bottom' as const },
            displayMode: 'card' as const,
        },
    ]));
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `grannies_chicken_soup_${ctx.now}`,
            ctx.playerId,
            '鸡汤：选择至多两张弃牌堆牌放到牌库顶或底',
            options,
            {
                sourceId: 'grannies_chicken_soup',
                targetType: 'generic',
                multi: { min: 0, max: Math.min(2, discard.length) },
                titleKey: 'ui.grannies_chicken_soup_title',
            },
        )),
    };
}

function handleGranniesPlacementPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    timestamp: number,
    sourceId: string,
    maxCount: number,
) {
    const choices = (Array.isArray(value) ? value : []) as GranniesPlacementChoice[];
    const selected = new Map<string, GranniesPlacementChoice>();
    for (const choice of choices) {
        if (!choice.cardUid || !choice.defId || !choice.ownerId || !choice.mode || selected.has(choice.cardUid)) continue;
        selected.set(choice.cardUid, choice);
        if (selected.size >= maxCount) break;
    }
    const picked = Array.from(selected.values());
    const top = picked.filter(choice => choice.mode === 'top').reverse();
    const bottom = picked.filter(choice => choice.mode === 'bottom');
    const events = [...top, ...bottom].map(choice => cardToDeckPlacementEvent(
        { uid: choice.cardUid!, defId: choice.defId!, owner: choice.ownerId! },
        choice.mode!,
        sourceId,
        timestamp,
        playerId,
        sourceId,
        undefined,
        choice.baseIndex,
    ));
    return { state, events };
}

function granniesAlwaysRoomAtGrannys(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const minions = base.minions.filter(minion => minion.controller === ctx.playerId);
    if (minions.length === 0) return { events: [] };
    const options = minions.flatMap(minion => ([
        {
            id: `${minion.uid}-top`,
            label: `${getCardName(minion.defId)} → 牌库顶`,
            value: { cardUid: minion.uid, defId: minion.defId, ownerId: minion.owner, baseIndex: ctx.baseIndex, mode: 'top' as const },
            displayMode: 'card' as const,
        },
        {
            id: `${minion.uid}-bottom`,
            label: `${getCardName(minion.defId)} → 牌库底`,
            value: { cardUid: minion.uid, defId: minion.defId, ownerId: minion.owner, baseIndex: ctx.baseIndex, mode: 'bottom' as const },
            displayMode: 'card' as const,
        },
    ]));
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `grannies_always_room_at_grannys_${ctx.now}`,
            ctx.playerId,
            '外婆家总有地方：选择至多 3 个己方随从放到牌库顶或底',
            options,
            {
                sourceId: 'grannies_always_room_at_grannys',
                targetType: 'generic',
                multi: { min: 0, max: Math.min(3, minions.length) },
                titleKey: 'ui.grannies_always_room_at_grannys_title',
            },
        )),
    };
}

function granniesAtticTreasures(ctx: AbilityContext): AbilityResult {
    const hand = ctx.state.players[ctx.playerId]?.hand ?? [];
    if (hand.length < 3) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `grannies_attic_treasures_${ctx.now}`,
            ctx.playerId,
            '阁楼宝藏：选择 3 张手牌置于牌库底',
            hand.map(card => ({
                id: card.uid,
                label: getCardName(card.defId),
                value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            })),
            { sourceId: 'grannies_attic_treasures', targetType: 'hand', multi: { min: 3, max: 3 }, titleKey: 'ui.grannies_attic_treasures_title' },
        )),
    };
}

function handleGranniesAtticTreasuresPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    random: RandomFn,
    timestamp: number,
) {
    const choices = (Array.isArray(value) ? value : []) as GranniesPlacementChoice[];
    const unique = new Map<string, GranniesPlacementChoice>();
    for (const choice of choices) {
        if (!choice.cardUid || !choice.defId || !choice.ownerId || unique.has(choice.cardUid)) continue;
        unique.set(choice.cardUid, choice);
        if (unique.size >= 3) break;
    }
    if (unique.size !== 3) return { state, events: [] };
    const events: SmashUpEvent[] = Array.from(unique.values()).map(choice => cardToDeckPlacementEvent(
        { uid: choice.cardUid!, defId: choice.defId!, owner: choice.ownerId! },
        'bottom',
        'grannies_attic_treasures',
        timestamp,
        playerId,
        'grannies_attic_treasures',
    ));
    events.push(...buildStandardDrawEvents(state.core, playerId, 3, random, timestamp));
    return { state, events };
}

function granniesFamilyReunionTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || ctx.playerId !== ctx.sourceControllerId) return [];
    const player = ctx.state.players[ctx.playerId];
    const bottom = player?.deck[player.deck.length - 1];
    if (!player || !bottom) return [];
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, 1, 'grannies_family_reunion', ctx.now),
        revealDeckTop(ctx.playerId, 'all', [{ uid: bottom.uid, defId: bottom.defId }], 1, 'grannies_family_reunion', ctx.now, ctx.playerId),
    ];
    if (bottom.type === 'minion') {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [bottom.uid] },
            timestamp: ctx.now,
        } as CardsDrawnEvent);
    } else {
        events.push(...reorderDeckCardWithinDeck(ctx.state, ctx.playerId, bottom.uid, 'top', 'grannies_family_reunion', ctx.now));
    }
    return events;
}

function granniesDontMessProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(action => (
        action.defId === 'grannies_dont_mess_with_my_babies'
        && getActionController(action) === ctx.targetMinion.controller
    ));
}

function collectPlayedActionChoices(state: SmashUpCore): GranniesPlacementChoice[] {
    const choices: GranniesPlacementChoice[] = [];
    state.bases.forEach((base, baseIndex) => {
        base.ongoingActions.forEach(action => choices.push({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            baseIndex,
        }));
        base.minions.forEach(minion => {
            minion.attachedActions.forEach(action => choices.push({
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                baseIndex,
            }));
        });
    });
    return choices;
}

function granniesKnittingCircle(ctx: AbilityContext): AbilityResult {
    const choices = collectPlayedActionChoices(ctx.state);
    if (choices.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `grannies_knitting_circle_${ctx.now}`,
            ctx.playerId,
            '编织小组：选择至多 3 个场上行动牌消灭',
            choices.map(choice => ({
                id: choice.cardUid!,
                label: `${getCardName(choice.defId!)} @ ${getBaseName(ctx.state, choice.baseIndex ?? 0)}`,
                value: choice,
                displayMode: 'card' as const,
            })),
            { sourceId: 'grannies_knitting_circle', targetType: 'card', multi: { min: 0, max: Math.min(3, choices.length) }, titleKey: 'ui.grannies_knitting_circle_title' },
        )),
    };
}

function handleGranniesKnittingCirclePrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    random: RandomFn,
    timestamp: number,
) {
    const choices = (Array.isArray(value) ? value : []) as GranniesPlacementChoice[];
    const valid = new Map(collectPlayedActionChoices(state.core).map(choice => [choice.cardUid, choice]));
    const selected: GranniesPlacementChoice[] = [];
    for (const choice of choices) {
        if (!choice.cardUid || selected.some(existing => existing.cardUid === choice.cardUid)) continue;
        const live = valid.get(choice.cardUid);
        if (!live) continue;
        selected.push(live);
        if (selected.length >= 3) break;
    }
    const events: SmashUpEvent[] = selected.flatMap(choice => buildValidatedOngoingDetachEvents(state, {
        cardUid: choice.cardUid!,
        reason: 'grannies_knitting_circle',
        now: timestamp,
        expectedLocation: 'any',
        sourcePlayerId: playerId,
        sourceDefId: 'grannies_knitting_circle',
        sourceBaseIndex: choice.baseIndex,
    }));
    events.push(...buildStandardDrawEvents(state.core, playerId, events.length, random, timestamp));
    return { state, events };
}

function baseGrandmasHouseOnMinionPlayed(ctx: BaseAbilityContext): BaseAbilityResult {
    const top = ctx.state.players[ctx.playerId]?.deck[0];
    if (!top || !ctx.matchState) return { events: [] };
    return {
        events: [
            inspectDeck(ctx.playerId, ctx.playerId, 1, 'base_grandmas_house', ctx.now),
            revealDeckTop(ctx.playerId, ctx.playerId, [{ uid: top.uid, defId: top.defId }], 1, 'base_grandmas_house', ctx.now, ctx.playerId),
        ],
        matchState: queueInteraction(ctx.matchState, buildDeckTopBottomPrompt(
            ctx.playerId,
            'base_grandmas_house',
            '奶奶家：将牌库顶牌留在牌库顶或置底',
            'ui.base_grandmas_house_title',
            top,
            ctx.now,
        )),
    };
}

function collectRetirementCandidates(state: SmashUpCore, playerId: PlayerId, targetBaseIndex: number) {
    return (state.bases[targetBaseIndex]?.minions ?? [])
        .filter(minion => minion.controller === playerId)
        .flatMap(minion => ([
            {
                id: `${minion.uid}-top`,
                label: `${getCardName(minion.defId)} → 牌库顶`,
                value: { cardUid: minion.uid, defId: minion.defId, ownerId: minion.owner, baseIndex: targetBaseIndex, mode: 'top' as const },
                displayMode: 'card' as const,
            },
            {
                id: `${minion.uid}-bottom`,
                label: `${getCardName(minion.defId)} → 牌库底`,
                value: { cardUid: minion.uid, defId: minion.defId, ownerId: minion.owner, baseIndex: targetBaseIndex, mode: 'bottom' as const },
                displayMode: 'card' as const,
            },
        ]));
}

function getRetirementPlayerQueue(state: SmashUpCore, targetBaseIndex: number): PlayerId[] {
    return state.turnOrder.filter(playerId => (state.bases[targetBaseIndex]?.minions ?? []).some(minion => minion.controller === playerId));
}

function buildRetirementPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    context: RetirementCommunityContext,
    now: number,
) {
    const interaction = createSimpleChoice(
        `base_retirement_community_${playerId}_${now}`,
        playerId,
        '退休社区：你可以将这里自己的一个随从放到牌库顶或底',
        [
            ...collectRetirementCandidates(matchState.core, playerId, context.targetBaseIndex),
            createSkipOption(),
        ],
        { sourceId: 'base_retirement_community', targetType: 'generic', titleKey: 'ui.base_retirement_community_title' },
    );
    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: context,
        },
    };
}

function baseRetirementCommunityAfterScoring(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState) return { events: [] };
    const remainingPlayerIds = getRetirementPlayerQueue(ctx.state, ctx.baseIndex);
    const [firstPlayerId, ...rest] = remainingPlayerIds;
    if (!firstPlayerId) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, buildRetirementPrompt(ctx.matchState, firstPlayerId, {
            targetBaseIndex: ctx.baseIndex,
            remainingPlayerIds: rest,
        }, ctx.now)),
    };
}

function handleRetirementCommunityPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as GranniesPlacementChoice;
    const context = interactionData?.continuationContext as RetirementCommunityContext | undefined;
    if (!context) return { state, events: [] };
    const liveMinion = selected.cardUid === undefined || selected.baseIndex === undefined
        ? undefined
        : state.core.bases[selected.baseIndex]?.minions.find(minion =>
            minion.uid === selected.cardUid
            && minion.controller === playerId
            && selected.baseIndex === context.targetBaseIndex);
    const events = selected.skip || !selected.mode || !liveMinion
        ? []
        : [cardToDeckPlacementEvent(
            cardInstanceFromMinion(liveMinion),
            selected.mode,
            'base_retirement_community',
            timestamp,
            playerId,
            'base_retirement_community',
            undefined,
            context.targetBaseIndex,
        )];
    const [nextPlayerId, ...rest] = context.remainingPlayerIds.filter(nextId => nextId !== playerId);
    if (!nextPlayerId) return { state, events };
    return {
        state: queueInteraction(state, buildRetirementPrompt(state, nextPlayerId, {
            targetBaseIndex: context.targetBaseIndex,
            remainingPlayerIds: rest,
        }, timestamp), { urgent: true }),
        events,
    };
}

function removeFirstBaseDefId(list: string[], defId: string | undefined): string[] {
    if (!defId) return [...list];
    const index = list.indexOf(defId);
    return index < 0 ? [...list] : [...list.slice(0, index), ...list.slice(index + 1)];
}

function buildExplorerBaseOptions(
    state: SmashUpCore,
    excludedBaseIndex?: number,
): PromptOption<ExplorerBaseChoice>[] {
    return buildBaseTargetOptions(
        state.bases
            .map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            }))
            .filter(option => option.baseIndex !== excludedBaseIndex),
        state,
    ) as PromptOption<ExplorerBaseChoice>[];
}

function buildExplorerMinionOptions(
    state: SmashUpCore,
    predicate: (minion: SmashUpCore['bases'][number]['minions'][number], baseIndex: number) => boolean,
) {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (!predicate(minion, baseIndex)) return;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardName(minion.defId)} @ ${getBaseName(state, baseIndex)}`,
            });
        });
    });
    return buildMinionTargetOptions(candidates, {
        state,
        sourceKind: 'action',
        effectType: 'move',
    }) as PromptOption<ExplorerMinionChoice>[];
}

function buildExplorerMoveEvent(
    state: MatchState<SmashUpCore>,
    minion: Pick<ExplorerMinionChoice, 'minionUid' | 'minionDefId' | 'baseIndex' | 'baseDefId'>,
    toBaseIndex: number,
    toBaseDefId: string | undefined,
    sourceId: string,
    playerId: PlayerId,
    sourceCardUid: string | undefined,
    timestamp: number,
    batchId?: string,
    allowMissingTargetBase = false,
): SmashUpEvent[] {
    if (!minion.minionUid || !minion.minionDefId || minion.baseIndex === undefined) return [];
    return buildValidatedMoveEvents(state, {
        minionUid: minion.minionUid,
        minionDefId: minion.minionDefId,
        fromBaseIndex: minion.baseIndex,
        toBaseIndex,
        toBaseDefId,
        reason: sourceId,
        now: timestamp,
        sourcePlayerId: playerId,
        sourceCardUid,
        sourceDefId: sourceId,
        sourceControllerId: playerId,
        sourceBaseIndex: minion.baseIndex,
        batchId,
        allowMissingTargetBase,
    });
}

function explorersGuideTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const controllerId = ctx.sourceControllerId;
    if (!controllerId || !ctx.triggerMinionUid || ctx.moveToBaseIndex === undefined) return [];
    const moved = ctx.triggerMinion
        ?? ctx.state.bases[ctx.moveToBaseIndex]?.minions.find(minion => minion.uid === ctx.triggerMinionUid);
    if (!moved || moved.controller !== controllerId) return [];
    const currentPlayerId = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
    const moveCount = ctx.state.minionMovesThisTurnByPlayer?.[currentPlayerId];
    if (moveCount !== undefined && moveCount !== 1) return [];
    return [addTempPower(ctx.triggerMinionUid, ctx.moveToBaseIndex, 1, 'explorers_guide', ctx.now, {
        sourcePlayerId: controllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'explorers_guide',
        sourceControllerId: controllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

function explorersIdahoSmith(ctx: AbilityContext): AbilityResult {
    const newBaseDefId = ctx.state.baseDeck[0];
    const sourceBase = ctx.state.bases[ctx.baseIndex];
    if (!newBaseDefId || !sourceBase) return { events: [] };
    const otherOwnMinions = sourceBase.minions
        .filter(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)
        .map(minion => ({
            id: minion.uid,
            label: getCardName(minion.defId),
            value: {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                baseIndex: ctx.baseIndex,
                baseDefId: sourceBase.defId,
            } satisfies ExplorerMinionChoice,
            displayMode: 'card' as const,
        }));
    const baseContext = {
        sourceBaseIndex: ctx.baseIndex,
        newBaseDefId,
        sourceCardUid: ctx.cardUid,
    };
    if (otherOwnMinions.length === 0) {
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, withContinuation(
                createSimpleChoice(
                    `explorers_idaho_smith_${ctx.now}`,
                    ctx.playerId,
                    '爱达荷·史密斯：是否打出基地牌库顶基地并移动爱达荷·史密斯？',
                    [
                        {
                            id: 'play',
                            label: '打出新基地',
                            labelKey: 'ui.explorers_idaho_smith_play_new_base_option',
                            value: { mode: 'play' },
                            displayMode: 'button' as const,
                        },
                        createSkipOption(),
                    ],
                    { sourceId: 'explorers_idaho_smith_confirm', targetType: 'button', titleKey: 'ui.explorers_idaho_smith_confirm_title' },
                ),
                baseContext,
            )),
        };
    }
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, withContinuation(
            createSimpleChoice(
                `explorers_idaho_smith_${ctx.now}`,
                ctx.playerId,
                '爱达荷·史密斯：选择任意数量同基地己方其他随从一同移至新基地',
                [...otherOwnMinions, createSkipOption()],
                {
                    sourceId: 'explorers_idaho_smith',
                    targetType: 'minion',
                    multi: { min: 0, max: otherOwnMinions.length },
                    titleKey: 'ui.explorers_idaho_smith_title',
                },
            ),
            baseContext,
        )),
    };
}

function handleExplorersIdahoSmithPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const context = interactionData?.continuationContext as { sourceBaseIndex?: number; newBaseDefId?: string; sourceCardUid?: string } | undefined;
    if (context?.sourceBaseIndex === undefined || !context.newBaseDefId) return { state, events: [] };
    const rawChoices = Array.isArray(value) ? value as ExplorerMinionChoice[] : [value as ExplorerMinionChoice];
    if (rawChoices.some(choice => choice?.skip)) return { state, events: [] };

    const sourceBase = state.core.bases[context.sourceBaseIndex];
    if (!sourceBase) return { state, events: [] };
    const idaho = sourceBase.minions.find(minion =>
        minion.uid === context.sourceCardUid
        && minion.controller === playerId);
    if (!idaho) return { state, events: [] };
    const newBaseIndex = state.core.bases.length;
    const batchId = `explorers_idaho_smith_${timestamp}`;
    const selected = new Map<string, ExplorerMinionChoice>();
    for (const choice of rawChoices) {
        if (!choice?.minionUid || choice.baseIndex !== context.sourceBaseIndex || selected.has(choice.minionUid)) continue;
        const live = sourceBase.minions.find(minion => minion.uid === choice.minionUid && minion.controller === playerId);
        if (!live) continue;
        selected.set(choice.minionUid, {
            minionUid: live.uid,
            minionDefId: live.defId,
            baseIndex: context.sourceBaseIndex,
            baseDefId: sourceBase.defId,
        });
    }
    const moving: ExplorerMinionChoice[] = [
        { minionUid: idaho.uid, minionDefId: idaho.defId, baseIndex: context.sourceBaseIndex, baseDefId: sourceBase.defId },
        ...Array.from(selected.values()),
    ];
    const moveEvents = moving
        .flatMap(minion => buildExplorerMoveEvent(
            state,
            minion,
            newBaseIndex,
            context.newBaseDefId,
            'explorers_idaho_smith',
            playerId,
            context.sourceCardUid,
            timestamp,
            batchId,
            true,
        ))
        .filter((event): event is SmashUpEvent => !!event);
    return {
        state,
        events: [
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: newBaseIndex,
                    oldBaseDefId: '',
                    newBaseDefId: context.newBaseDefId,
                },
                timestamp,
            } as SmashUpEvent,
            ...moveEvents,
        ],
    };
}

function explorersLostCity(ctx: AbilityContext): AbilityResult {
    const topBases = ctx.state.baseDeck.slice(0, 2);
    if (topBases.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, withContinuation(
            createSimpleChoice(
                `explorers_lost_city_${ctx.now}`,
                ctx.playerId,
                '失落之城：选择一张展示的基地替换已计分基地',
                topBases.map((defId, index) => ({
                    id: `base-${index}`,
                    label: getBaseDef(defId)?.name ?? defId,
                    value: { defId } satisfies ExplorerBaseChoice,
                    _source: 'base' as const,
                })),
                { sourceId: 'explorers_lost_city', targetType: 'generic', titleKey: 'ui.explorers_lost_city_title' },
            ),
            { baseIndex: ctx.baseIndex },
        )),
    };
}

function handleExplorersLostCityPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as ExplorerBaseChoice | undefined;
    const context = interactionData?.continuationContext as { baseIndex?: number } | undefined;
    const currentTop = state.core.baseDeck.slice(0, 2);
    const chosen = selected?.defId && currentTop.includes(selected.defId) ? selected.defId : undefined;
    if (!chosen || context?.baseIndex === undefined) return { state, events: [] };
    const other = currentTop.find(defId => defId !== chosen);
    const remaining = removeFirstBaseDefId(removeFirstBaseDefId(state.core.baseDeck, chosen), other);
    return {
        state,
        events: [
            shuffleBaseDeck(
                [chosen, ...remaining],
                'explorers_lost_city',
                timestamp,
                other
                    ? { newBaseDiscardDefIds: [...(state.core.baseDiscard ?? []), other] }
                    : undefined,
            ) as SmashUpEvent,
            grantContextualExtraMinion(
                { playerId, now: timestamp, matchState: state },
                'explorers_lost_city',
                context.baseIndex,
            ),
        ],
    };
}

function explorersMoveOneOwnMinion(ctx: AbilityContext): AbilityResult {
    const options = buildExplorerMinionOptions(ctx.state, minion => minion.controller === ctx.playerId);
    if (options.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `explorers_you_call_this_archaeology_${ctx.now}`,
            ctx.playerId,
            '你管这叫考古？：选择一个己方随从移动',
            options,
            { sourceId: 'explorers_you_call_this_archaeology', targetType: 'minion', titleKey: 'ui.explorers_you_call_this_archaeology_title' },
        )),
    };
}

function handleExplorersMoveOneMinionPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as ExplorerMinionChoice | undefined;
    if (!selected?.minionUid || !selected.minionDefId || selected.baseIndex === undefined) return { state, events: [] };
    const options = buildExplorerBaseOptions(state.core, selected.baseIndex);
    if (options.length === 0) return { state, events: [] };
    return {
        state: queueInteraction(state, withContinuation(
            createSimpleChoice(
                `explorers_you_call_this_archaeology_base_${timestamp}`,
                playerId,
                '你管这叫考古？：选择目标基地',
                options,
                { sourceId: 'explorers_you_call_this_archaeology_choose_base', targetType: 'base', titleKey: 'ui.explorers_you_call_this_archaeology_base_title' },
            ),
            {
                sourceId: 'explorers_you_call_this_archaeology',
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId,
                fromBaseIndex: selected.baseIndex,
            } satisfies ExplorerMoveOneContext,
        ), { urgent: true }),
        events: [],
    };
}

function handleExplorersMoveOneBasePrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as ExplorerBaseChoice | undefined;
    const context = interactionData?.continuationContext as ExplorerMoveOneContext | undefined;
    if (!context || selected?.baseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: buildValidatedMoveEvents(state, {
            minionUid: context.minionUid,
            minionDefId: context.minionDefId,
            fromBaseIndex: context.fromBaseIndex,
            toBaseIndex: selected.baseIndex,
            toBaseDefId: selected.baseDefId,
            reason: context.sourceId,
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: context.sourceId,
            sourceControllerId: playerId,
            sourceBaseIndex: context.fromBaseIndex,
            sourceKind: 'action',
        }),
    };
}

function explorersFortuneAndGlory(ctx: AbilityContext): AbilityResult {
    const options = buildExplorerBaseOptions(ctx.state);
    if (options.length < 2) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `explorers_fortune_and_glory_${ctx.now}`,
            ctx.playerId,
            '财富与荣耀：选择来源基地',
            options,
            { sourceId: 'explorers_fortune_and_glory', targetType: 'base', titleKey: 'ui.explorers_fortune_and_glory_source_title' },
        )),
    };
}

function handleExplorersFortuneSourcePrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as ExplorerBaseChoice | undefined;
    if (selected?.baseIndex === undefined) return { state, events: [] };
    const options = buildExplorerBaseOptions(state.core, selected.baseIndex);
    if (options.length === 0) return { state, events: [] };
    return {
        state: queueInteraction(state, withContinuation(
            createSimpleChoice(
                `explorers_fortune_and_glory_destination_${timestamp}`,
                playerId,
                '财富与荣耀：选择目标基地',
                options,
                { sourceId: 'explorers_fortune_and_glory_destination', targetType: 'base', titleKey: 'ui.explorers_fortune_and_glory_destination_title' },
            ),
            {
                sourceBaseIndex: selected.baseIndex,
            } satisfies ExplorerFortuneContext,
        ), { urgent: true }),
        events: [],
    };
}

function handleExplorersFortuneDestinationPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as ExplorerBaseChoice | undefined;
    const context = interactionData?.continuationContext as ExplorerFortuneContext | undefined;
    if (!context || selected?.baseIndex === undefined) return { state, events: [] };
    const sourceBase = state.core.bases[context.sourceBaseIndex];
    if (!sourceBase) return { state, events: [] };
    const options = sourceBase.minions.map(minion => ({
        id: minion.uid,
        label: getCardName(minion.defId),
        value: {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            baseIndex: context.sourceBaseIndex,
            baseDefId: sourceBase.defId,
        } satisfies ExplorerMinionChoice,
        displayMode: 'card' as const,
    }));
    return {
        state: queueInteraction(state, withContinuation(
            createSimpleChoice(
                `explorers_fortune_and_glory_minions_${timestamp}`,
                playerId,
                '财富与荣耀：选择至多两个随从移动',
                options,
                {
                    sourceId: 'explorers_fortune_and_glory_minions',
                    targetType: 'minion',
                    multi: { min: 0, max: Math.min(2, options.length) },
                    titleKey: 'ui.explorers_fortune_and_glory_minions_title',
                },
            ),
            {
                sourceBaseIndex: context.sourceBaseIndex,
                destinationBaseIndex: selected.baseIndex,
                destinationBaseDefId: selected.baseDefId,
            } satisfies ExplorerFortuneContext,
        ), { urgent: true }),
        events: [],
    };
}

function handleExplorersFortuneMinionsPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const context = interactionData?.continuationContext as ExplorerFortuneContext | undefined;
    if (!context || context.destinationBaseIndex === undefined) return { state, events: [] };
    const choices = (Array.isArray(value) ? value : []) as ExplorerMinionChoice[];
    const selected = new Map<string, ExplorerMinionChoice>();
    for (const choice of choices) {
        if (!choice.minionUid || choice.baseIndex !== context.sourceBaseIndex || selected.has(choice.minionUid)) continue;
        selected.set(choice.minionUid, choice);
        if (selected.size >= 2) break;
    }
    const batchId = `explorers_fortune_and_glory_${timestamp}`;
    return {
        state,
        events: Array.from(selected.values()).flatMap(choice => buildValidatedMoveEvents(state, {
            minionUid: choice.minionUid!,
            minionDefId: choice.minionDefId!,
            fromBaseIndex: context.sourceBaseIndex,
            toBaseIndex: context.destinationBaseIndex!,
            toBaseDefId: context.destinationBaseDefId,
            reason: 'explorers_fortune_and_glory',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'explorers_fortune_and_glory',
            sourceControllerId: playerId,
            sourceBaseIndex: context.sourceBaseIndex,
            sourceKind: 'action',
            batchId,
        })),
    };
}

function explorersGloryHound(ctx: AbilityContext): AbilityResult {
    const topBases = ctx.state.baseDeck.slice(0, 2);
    if (topBases.length < 2) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `explorers_glory_hound_${ctx.now}`,
            ctx.playerId,
            '逐名猎犬：选择留在基地牌库顶的基地',
            topBases.map((defId, index) => ({
                id: `base-${index}`,
                label: getBaseDef(defId)?.name ?? defId,
                    value: { defId } satisfies ExplorerBaseChoice,
                    _source: 'base' as const,
                })),
            { sourceId: 'explorers_glory_hound', targetType: 'generic', titleKey: 'ui.explorers_glory_hound_title' },
        )),
    };
}

function handleExplorersGloryHoundPrompt(
    state: MatchState<SmashUpCore>,
    _playerId: PlayerId,
    value: unknown,
    _interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as ExplorerBaseChoice | undefined;
    const topBases = state.core.baseDeck.slice(0, 2);
    const chosen = selected?.defId && topBases.includes(selected.defId) ? selected.defId : undefined;
    if (!chosen) return { state, events: [] };
    const bottom = topBases.find(defId => defId !== chosen);
    const remaining = removeFirstBaseDefId(removeFirstBaseDefId(state.core.baseDeck, chosen), bottom);
    return {
        state,
        events: [shuffleBaseDeck(
            bottom ? [chosen, ...remaining, bottom] : [chosen, ...remaining],
            'explorers_glory_hound',
            timestamp,
        ) as SmashUpEvent],
    };
}

function explorersItBelongsInAMuseum(ctx: AbilityContext): AbilityResult {
    const options = buildExplorerMinionOptions(ctx.state, () => true);
    if (options.length < 2) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `explorers_it_belongs_in_a_museum_${ctx.now}`,
            ctx.playerId,
            '它该进博物馆：选择两个处于不同基地的随从交换基地',
            options,
            {
                sourceId: 'explorers_it_belongs_in_a_museum',
                targetType: 'minion',
                multi: { min: 2, max: 2 },
                titleKey: 'ui.explorers_it_belongs_in_a_museum_title',
            },
        )),
    };
}

function handleExplorersMuseumPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const [first, second] = (Array.isArray(value) ? value : []) as ExplorerMinionChoice[];
    if (
        !first?.minionUid || !first.minionDefId || first.baseIndex === undefined
        || !second?.minionUid || !second.minionDefId || second.baseIndex === undefined
        || first.baseIndex === second.baseIndex
    ) {
        return { state, events: [] };
    }
    const batchId = `explorers_it_belongs_in_a_museum_${timestamp}`;
    return {
        state,
        events: [
            ...buildExplorerMoveEvent(state, first, second.baseIndex, second.baseDefId, 'explorers_it_belongs_in_a_museum', playerId, undefined, timestamp, batchId),
            ...buildExplorerMoveEvent(state, second, first.baseIndex, first.baseDefId, 'explorers_it_belongs_in_a_museum', playerId, undefined, timestamp, batchId),
        ],
    };
}

function explorersXNeverMarksTheSpot(ctx: AbilityContext): AbilityResult {
    const options: PromptOption<ExplorerMinionChoice>[] = [];
    ctx.state.bases.forEach((base, baseIndex) => {
        base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .forEach((minion) => {
                ctx.state.bases.forEach((targetBase, targetBaseIndex) => {
                    if (targetBaseIndex === baseIndex) return;
                    options.push({
                        id: `${minion.uid}-to-${targetBaseIndex}`,
                        label: `${getCardName(minion.defId)} → ${getBaseName(ctx.state, targetBaseIndex)}`,
                        value: {
                            minionUid: minion.uid,
                            minionDefId: minion.defId,
                            baseIndex,
                            baseDefId: base.defId,
                            controllerId: minion.controller,
                            ownerId: minion.owner,
                            mode: 'play',
                            toBaseIndex: targetBaseIndex,
                            toBaseDefId: targetBase.defId,
                        } as ExplorerMinionChoice & { toBaseIndex: number; toBaseDefId: string },
                        displayMode: 'card' as const,
                    });
                });
            });
    });
    if (options.length === 0) return { events: [] };
    const ownMinionCount = new Set(options.map(option => option.value.minionUid).filter(Boolean)).size;
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `explorers_x_never_marks_the_spot_${ctx.now}`,
            ctx.playerId,
            'X 从不标记地点：为每个己方随从选择移动目标',
            options,
            {
                sourceId: 'explorers_x_never_marks_the_spot',
                targetType: 'generic',
                multi: { min: 0, max: ownMinionCount },
                titleKey: 'ui.explorers_x_never_marks_the_spot_title',
            },
        )),
    };
}

function handleExplorersXPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const choices = (Array.isArray(value) ? value : []) as Array<ExplorerMinionChoice & { toBaseIndex?: number; toBaseDefId?: string }>;
    const selected = new Map<string, ExplorerMinionChoice & { toBaseIndex?: number; toBaseDefId?: string }>();
    for (const choice of choices) {
        if (!choice.minionUid || choice.baseIndex === undefined || choice.toBaseIndex === undefined || selected.has(choice.minionUid)) continue;
        selected.set(choice.minionUid, choice);
    }
    const batchId = `explorers_x_never_marks_the_spot_${timestamp}`;
    return {
        state,
        events: Array.from(selected.values()).flatMap(choice => buildValidatedMoveEvents(state, {
            minionUid: choice.minionUid!,
            minionDefId: choice.minionDefId!,
            fromBaseIndex: choice.baseIndex!,
            toBaseIndex: choice.toBaseIndex!,
            toBaseDefId: choice.toBaseDefId,
            reason: 'explorers_x_never_marks_the_spot',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'explorers_x_never_marks_the_spot',
            sourceControllerId: playerId,
            sourceBaseIndex: choice.baseIndex,
            sourceKind: 'action',
            batchId,
        })),
    };
}

function explorersISaidNoCamels(ctx: AbilityContext): AbilityResult {
    const options: PromptOption<ExplorerBaseChoice>[] = [];
    ctx.state.bases.forEach((base, baseIndex) => {
        const ownCount = base.minions.filter(minion => minion.controller === ctx.playerId).length;
        options.push({
            id: `${baseIndex}-counters`,
            label: `${getBaseName(ctx.state, baseIndex)}：放置 ${ownCount} 个 +1 指示物`,
            value: { baseIndex, baseDefId: base.defId, mode: 'counters' },
            _source: 'base' as const,
            displayMode: 'card',
        });
        options.push({
            id: `${baseIndex}-draw`,
            label: `${getBaseName(ctx.state, baseIndex)}：抓 ${ownCount} 张牌`,
            value: { baseIndex, baseDefId: base.defId, mode: 'draw' },
            _source: 'base' as const,
            displayMode: 'card',
        });
    });
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `explorers_i_said_no_camels_${ctx.now}`,
            ctx.playerId,
            '我说了不要骆驼！：选择基地与收益',
            options,
            { sourceId: 'explorers_i_said_no_camels', targetType: 'generic', titleKey: 'ui.explorers_i_said_no_camels_title' },
        )),
    };
}

function handleExplorersCamelsPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) {
    const selected = value as ExplorerBaseChoice | undefined;
    if (selected?.baseIndex === undefined || !selected.mode) return { state, events: [] };
    const ownMinions = (state.core.bases[selected.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === playerId);
    if (selected.mode === 'draw') {
        return { state, events: buildStandardDrawEvents(state.core, playerId, ownMinions.length, random, timestamp) };
    }
    return {
        state,
        events: ownMinions.map(minion => addPowerCounter(minion.uid, selected.baseIndex!, 1, 'explorers_i_said_no_camels', timestamp, {
            sourcePlayerId: playerId,
            sourceDefId: 'explorers_i_said_no_camels',
            sourceControllerId: playerId,
            sourceBaseIndex: selected.baseIndex,
        })),
    };
}

function explorersDrLivingstone(ctx: AbilityContext): AbilityResult {
    const options = buildExplorerMinionOptions(ctx.state, (_minion, baseIndex) => (
        ctx.state.bases[baseIndex]?.minions.length === 1
    ));
    if (options.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice(
            `explorers_dr_livingstone_i_presume_${ctx.now}`,
            ctx.playerId,
            '利文斯通医生，想必是你？：选择唯一随从洗回其拥有者牌库',
            options,
            { sourceId: 'explorers_dr_livingstone_i_presume', targetType: 'minion', titleKey: 'ui.explorers_dr_livingstone_i_presume_title' },
        )),
    };
}

function handleExplorersDrLivingstonePrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) {
    const selected = value as ExplorerMinionChoice | undefined;
    if (!selected?.minionUid || !selected.minionDefId || selected.baseIndex === undefined) return { state, events: [] };
    const base = state.core.bases[selected.baseIndex];
    const minion = base?.minions.find(candidate => candidate.uid === selected.minionUid);
    if (!base || base.minions.length !== 1 || !minion) return { state, events: [] };
    const owner = state.core.players[minion.owner];
    const deckUids = random.shuffle([...owner.deck.map(card => card.uid), minion.uid]);
    return {
        state,
        events: [
            cardToDeckPlacementEvent(
                cardInstanceFromMinion(minion),
                'bottom',
                'explorers_dr_livingstone_i_presume',
                timestamp,
                playerId,
                'explorers_dr_livingstone_i_presume',
                undefined,
                selected.baseIndex,
            ),
            {
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: minion.owner,
                    deckUids,
                    reason: 'explorers_dr_livingstone_i_presume',
                },
                timestamp,
            } as DeckReorderedEvent,
        ],
    };
}

function buildForgottenHorrorsTransferPrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    context: ExplorerForgottenHorrorsContext,
    now: number,
) {
    return withContinuation(
        createSimpleChoice(
            `explorers_forgotten_horrors_${now}`,
            playerId,
            '被遗忘的恐怖：选择要转移到的另一个基地',
            buildExplorerBaseOptions(matchState.core, context.sourceBaseIndex),
            { sourceId: 'explorers_forgotten_horrors', targetType: 'base', titleKey: 'ui.explorers_forgotten_horrors_title' },
        ),
        context,
    );
}

function explorersForgottenHorrorsTrigger(ctx: TriggerContext): TriggerResult {
    if (ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) return { events: [] };
    const targetBaseIndex = ctx.timing === 'onMinionMoved' ? ctx.moveToBaseIndex : ctx.baseIndex;
    if (targetBaseIndex !== ctx.sourceBaseIndex) return { events: [] };
    const movedOrPlayed = ctx.state.bases[targetBaseIndex]?.minions.find(minion => minion.uid === ctx.triggerMinionUid);
    if (!movedOrPlayed || movedOrPlayed.controller !== ctx.sourceControllerId) return { events: [] };
    if (ctx.timing === 'onMinionMoved' && ctx.playerId !== ctx.sourceControllerId) return { events: [] };
    if (ctx.timing === 'onMinionPlayed' && ctx.playerId !== ctx.sourceControllerId) return { events: [] };
    const action = ctx.state.bases[ctx.sourceBaseIndex]?.ongoingActions.find(candidate => candidate.uid === ctx.sourceCardUid);
    if (!action) return { events: [] };
    const events = buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
    const otherBaseOptions = buildExplorerBaseOptions(ctx.state, ctx.sourceBaseIndex);
    if (!ctx.matchState || otherBaseOptions.length === 0) return { events };
    return {
        events,
        matchState: queueInteraction(ctx.matchState, buildForgottenHorrorsTransferPrompt(ctx.matchState, ctx.sourceControllerId, {
            cardUid: action.uid,
            ownerId: action.ownerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            metadata: action.metadata,
            talentUsed: action.talentUsed,
        }, ctx.now)),
    };
}

function canTriggerExplorersForgottenHorrors(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) return false;
    const targetBaseIndex = ctx.timing === 'onMinionMoved' ? ctx.moveToBaseIndex : ctx.baseIndex;
    if (targetBaseIndex !== ctx.sourceBaseIndex) return false;
    const movedOrPlayed = ctx.state.bases[targetBaseIndex]?.minions.find(minion => minion.uid === ctx.triggerMinionUid);
    if (!movedOrPlayed || movedOrPlayed.controller !== ctx.sourceControllerId) return false;
    if (ctx.playerId !== ctx.sourceControllerId) return false;
    return !!ctx.state.bases[ctx.sourceBaseIndex]?.ongoingActions.find(candidate => candidate.uid === ctx.sourceCardUid);
}

function handleExplorersForgottenHorrorsPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
) {
    const selected = value as ExplorerBaseChoice | undefined;
    const context = interactionData?.continuationContext as ExplorerForgottenHorrorsContext | undefined;
    if (!context || selected?.baseIndex === undefined || selected.baseIndex === context.sourceBaseIndex) return { state, events: [] };
    const detachEvents = buildValidatedOngoingDetachEvents(state, {
        cardUid: context.cardUid,
        reason: 'explorers_forgotten_horrors',
        now: timestamp,
        expectedLocation: 'base',
        sourcePlayerId: playerId,
        sourceDefId: 'explorers_forgotten_horrors',
        sourceControllerId: playerId,
        sourceBaseIndex: context.sourceBaseIndex,
    });
    if (detachEvents.length === 0) return { state, events: [] };
    return {
        state,
        events: [
            ...detachEvents,
            {
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: context.cardUid,
                    defId: 'explorers_forgotten_horrors',
                    ownerId: context.ownerId,
                    sourcePlayerId: playerId,
                    targetType: 'base',
                    targetBaseIndex: selected.baseIndex,
                    ...(context.metadata ? { metadata: context.metadata } : {}),
                    ...(context.talentUsed !== undefined ? { talentUsed: context.talentUsed } : {}),
                },
                timestamp,
            } as SmashUpEvent,
        ],
    };
}

function explorersCryptLooterTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    return [grantContextualExtraMinion(
        {
            playerId: ctx.sourceControllerId,
            now: ctx.now,
            matchState: ctx.matchState ?? { core: ctx.state } as MatchState<SmashUpCore>,
        },
        'explorers_crypt_looter',
        ctx.baseIndex,
        { specificCardUid: ctx.sourceCardUid },
    )];
}

function canTriggerExplorersCryptLooter(ctx: TriggerContext): boolean {
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) return false;
    return ctx.state.players[ctx.sourceControllerId]?.hand.some(card => card.uid === ctx.sourceCardUid) === true;
}

function baseAncientTempleOnTurnStart(ctx: BaseAbilityContext): BaseAbilityResult {
    const ownMinions = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === ctx.playerId);
    if (ownMinions.length !== 1) return { events: [] };
    return {
        events: [addTempPower(ownMinions[0].uid, ctx.baseIndex, 5, 'base_ancient_temple', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'base_ancient_temple',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        })],
    };
}

function baseCityOfGoldOnTurnStart(ctx: BaseAbilityContext): BaseAbilityResult {
    const hasOwnMinion = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .some(minion => minion.controller === ctx.playerId);
    if (!hasOwnMinion) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.VP_AWARDED,
            payload: {
                playerId: ctx.playerId,
                amount: 1,
                reason: 'base_city_of_gold',
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}
export function registerWhatWereWeThinkingAbilities(): void {
    registerAbilityProgram('rock_stars_reunion_tour', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(rockStarsReunionTour) });
    registerAbilityProgram('rock_stars_rock_of_luuv', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(rockStarsRockOfLuuv) });
    registerAbilityProgram('rock_stars_guest_star', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(rockStarsGuestStar) });
    registerAbilityProgram('rock_stars_tour_bus', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(rockStarsTourBus) });
    registerAbility('rock_stars_power_ballad', 'onPlay', rockStarsPowerBallad);
    registerAbility('rock_stars_power_ballad', 'special', rockStarsPowerBallad);
    registerAbility('rock_stars_total_sellout', 'special', rockStarsTotalSellout);
    registerAbilityProgram('rock_stars_the_monarch', 'talent', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(rockStarsTheMonarch) });
    registerAbilityProgram('rock_stars_classic_rocker', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(rockStarsClassicRocker),
        validateUse: validateClassicRockerUse,
    });
    registerAbilityProgram('rock_stars_rick_roll', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(rockStarsRickRoll) });
    registerAbility('rock_stars_groupie', 'onPlay', rockStarsGroupie);

    registerAbility('teddy_bears_square_deal', 'onPlay', teddyBearsSquareDeal);
    registerAbility('teddy_bears_love_overload', 'special', teddyBearsLoveOverload);
    registerAbilityProgram('teddy_bears_group_hug', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(teddyBearsGroupHug) });
    registerAbility('teddy_bears_care_package', 'onPlay', teddyBearsCarePackage);
    registerAbilityProgram('teddy_bears_sir_squeezes', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(teddyBearsSirSqueezes) });
    registerAbility('teddy_bears_tea_party', 'talent', teddyBearsTeaParty);

    registerAbility('grannies_chicken_soup', 'onPlay', granniesChickenSoup);
    registerAbility('grannies_grannys_purse', 'onPlay', granniesGrannysPurse);
    registerAbility('grannies_always_room_at_grannys', 'special', granniesAlwaysRoomAtGrannys);
    registerAbility('grannies_attic_treasures', 'onPlay', granniesAtticTreasures);
    registerAbility('grannies_hush_my_stories_are_on', 'onPlay', granniesHushMyStoriesAreOn);
    registerAbility('grannies_knitting_circle', 'onPlay', granniesKnittingCircle);
    registerAbility('grannies_matriarch', 'talent', granniesMatriarch);
    registerAbility('grannies_granny', 'talent', granniesGranny);
    registerAbility('grannies_nana', 'onPlay', granniesNana);
    registerAbility('grannies_grandma', 'onPlay', granniesGrandma);

    registerAbility('explorers_idaho_smith', 'onPlay', explorersIdahoSmith);
    registerAbility('explorers_lost_city', 'special', explorersLostCity);
    registerAbility('explorers_you_call_this_archaeology', 'onPlay', explorersMoveOneOwnMinion);
    registerAbility('explorers_you_call_this_archaeology', 'special', explorersMoveOneOwnMinion);
    registerAbility('explorers_fortune_and_glory', 'onPlay', explorersFortuneAndGlory);
    registerAbility('explorers_glory_hound', 'onPlay', explorersGloryHound);
    registerAbility('explorers_it_belongs_in_a_museum', 'onPlay', explorersItBelongsInAMuseum);
    registerAbility('explorers_x_never_marks_the_spot', 'onPlay', explorersXNeverMarksTheSpot);
    registerAbility('explorers_i_said_no_camels', 'onPlay', explorersISaidNoCamels);
    registerAbility('explorers_dr_livingstone_i_presume', 'onPlay', explorersDrLivingstone);

    registerTrigger('rock_stars_hot_venue', 'onTurnEnd', rockStarsHotVenueTurnEnd, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canTriggerRockStarsHotVenueTurnEnd,
    });

    registerBaseAbility('base_lake_minnetonka', 'onMinionPlayed', lakeMinnetonkaOnMinionPlayed);
    registerTrigger('base_lake_minnetonka', 'onMinionMoved', lakeMinnetonkaOnMinionMoved, {
        mandatory: true,
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerBaseAbility('base_palooza', 'beforeScoring', basePaloozaBeforeScoring, {
        mandatory: false,
        canTrigger: (ctx) => getPaloozaPlayerQueue(ctx.state, ctx.baseIndex).length > 0,
    });

    registerTrigger('teddy_bears_fun_bear', 'onMinionPlayed', teddyBearsFunBearTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('teddy_bears_fun_bear', 'onMinionMoved', teddyBearsFunBearTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('teddy_bears_snuggly_bear', 'onMinionPlayed', teddyBearsSnugglyBearTrigger, {
        global: true,
        globalZones: ['hand'],
        playerContext: 'sourceController',
        canTrigger: ctx => ctx.sourceControllerId === ctx.playerId,
    });
    registerBaseAbility('base_out_in_the_woods', 'beforeScoring', baseOutInTheWoodsBeforeScoring);
    registerTrigger('base_under_the_bed', 'onMinionPlayed', baseUnderTheBedOnMinionPlayed, {
        perInstance: true,
    });
    registerProtection('teddy_bears_too_cute', 'destroy', teddyBearsTooCuteProtection);
    registerRestriction('teddy_bears_bear_picnic', 'play_minion', teddyBearsBearPicnicRestriction, {
        global: true,
    });
    registerCardAbilitySuppression('teddy_bears_cuddle', teddyBearsCuddleSuppression);

    registerTrigger('grannies_family_reunion', 'onMinionPlayed', granniesFamilyReunionTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerProtection('grannies_dont_mess_with_my_babies', 'destroy', granniesDontMessProtection);
    registerProtection('grannies_dont_mess_with_my_babies', 'move', granniesDontMessProtection);
    registerProtection('grannies_dont_mess_with_my_babies', 'affect', granniesDontMessProtection);
    registerProtection('grannies_dont_mess_with_my_babies', 'action', granniesDontMessProtection);
    registerBaseAbility('base_grandmas_house', 'onMinionPlayed', baseGrandmasHouseOnMinionPlayed);
    registerBaseAbility('base_retirement_community', 'afterScoring', baseRetirementCommunityAfterScoring, {
        mandatory: false,
        canTrigger: (ctx) => getRetirementPlayerQueue(ctx.state, ctx.baseIndex).length > 0,
    });

    registerTrigger('explorers_guide', 'onMinionMoved', explorersGuideTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerTrigger('explorers_forgotten_horrors', 'onMinionPlayed', explorersForgottenHorrorsTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        canTrigger: canTriggerExplorersForgottenHorrors,
    });
    registerTrigger('explorers_forgotten_horrors', 'onMinionMoved', explorersForgottenHorrorsTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        canTrigger: canTriggerExplorersForgottenHorrors,
    });
    registerTrigger('explorers_crypt_looter', 'onBaseRevealed', explorersCryptLooterTrigger, {
        optional: true,
        global: true,
        globalZones: ['hand'],
        playerContext: 'sourceController',
        canTrigger: canTriggerExplorersCryptLooter,
    });
    registerBaseAbility('base_ancient_temple', 'onTurnStart', baseAncientTempleOnTurnStart, {
        canTrigger: ctx => (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
            .filter(minion => minion.controller === ctx.playerId).length === 1,
    });
    registerBaseAbility('base_city_of_gold', 'onTurnStart', baseCityOfGoldOnTurnStart, {
        canTrigger: ctx => (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
            .some(minion => minion.controller === ctx.playerId),
    });
}

export function registerWhatWereWeThinkingInteractionHandlers(): void {
    registerInteractionHandler('base_palooza', (state, playerId, value, interactionData, _random, timestamp) =>
        handlePaloozaPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('grannies_granny', (state, playerId, value, interactionData, _random, timestamp) =>
        handleDeckTopBottomPrompt(state, playerId, value, interactionData, timestamp, 'grannies_granny'));
    registerInteractionHandler('grannies_grandma', (state, playerId, value, interactionData, _random, timestamp) =>
        handleDeckTopBottomPrompt(state, playerId, value, interactionData, timestamp, 'grannies_grandma'));
    registerInteractionHandler('base_grandmas_house', (state, playerId, value, interactionData, _random, timestamp) =>
        handleDeckTopBottomPrompt(state, playerId, value, interactionData, timestamp, 'base_grandmas_house'));
    registerInteractionHandler('grannies_grannys_purse', (state, playerId, value, interactionData, _random, timestamp) =>
        handleGrannysPursePrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('grannies_nana', (state, playerId, value, interactionData, _random, timestamp) =>
        handleGranniesNanaPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('grannies_chicken_soup', (state, playerId, value, _interactionData, _random, timestamp) =>
        handleGranniesPlacementPrompt(state, playerId, value, timestamp, 'grannies_chicken_soup', 2));
    registerInteractionHandler('grannies_always_room_at_grannys', (state, playerId, value, _interactionData, _random, timestamp) =>
        handleGranniesPlacementPrompt(state, playerId, value, timestamp, 'grannies_always_room_at_grannys', 3));
    registerInteractionHandler('grannies_attic_treasures', (state, playerId, value, _interactionData, random, timestamp) =>
        handleGranniesAtticTreasuresPrompt(state, playerId, value, random, timestamp));
    registerInteractionHandler('grannies_knitting_circle', (state, playerId, value, _interactionData, random, timestamp) =>
        handleGranniesKnittingCirclePrompt(state, playerId, value, random, timestamp));
    registerInteractionHandler('base_retirement_community', (state, playerId, value, interactionData, _random, timestamp) =>
        handleRetirementCommunityPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_idaho_smith', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersIdahoSmithPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_idaho_smith_confirm', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersIdahoSmithPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_lost_city', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersLostCityPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_you_call_this_archaeology', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersMoveOneMinionPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_you_call_this_archaeology_choose_base', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersMoveOneBasePrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_fortune_and_glory', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersFortuneSourcePrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_fortune_and_glory_destination', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersFortuneDestinationPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_fortune_and_glory_minions', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersFortuneMinionsPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_glory_hound', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersGloryHoundPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_it_belongs_in_a_museum', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersMuseumPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_x_never_marks_the_spot', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersXPrompt(state, playerId, value, interactionData, timestamp));
    registerInteractionHandler('explorers_i_said_no_camels', (state, playerId, value, interactionData, random, timestamp) =>
        handleExplorersCamelsPrompt(state, playerId, value, interactionData, random, timestamp));
    registerInteractionHandler('explorers_dr_livingstone_i_presume', (state, playerId, value, interactionData, random, timestamp) =>
        handleExplorersDrLivingstonePrompt(state, playerId, value, interactionData, random, timestamp));
    registerInteractionHandler('explorers_forgotten_horrors', (state, playerId, value, interactionData, _random, timestamp) =>
        handleExplorersForgottenHorrorsPrompt(state, playerId, value, interactionData, timestamp));
}
