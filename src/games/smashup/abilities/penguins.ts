import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import {
    createSimpleChoice,
    getCurrentTrackedCardTopSnapshot,
    queueInteraction,
    type PromptOption,
} from '../../../engine/systems/InteractionSystem';
import { registerAbility, registerSimpleAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerActiveBaseAbility, registerBaseAbility, type BaseAbilityContext, type BaseAbilityResult } from '../domain/baseAbilities';
import {
    addTempPower,
    appendMinionPlayedTriggersAfterEvents,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedMoveEvents,
    canControllerPlayTitan,
    createSkipOption,
    inspectDeck,
    peekDeckTop,
    playTitan,
    revealDeckTop,
} from '../domain/abilityHelpers';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { appendPendingPostScoringActions, getDeferredReplacementBaseDefId } from '../domain/scoringSession';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { SU_EVENTS } from '../domain/types';
import type {
    CardInstance,
    CardsDrawnEvent,
    DeckReorderedEvent,
    HandShuffledIntoDeckEvent,
    MinionOnBase,
    MinionPlayedEvent,
    PendingPostScoringAction,
    SmashUpCore,
    SmashUpEvent,
    TitanState,
} from '../domain/types';

const EMPEROR_PENGUIN = 'penguins_emperor_penguin';

const FALLBACK_RANDOM: RandomFn = {
    shuffle: <T>(arr: T[]) => [...arr],
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.floor(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
};

type BaseChoice = { skip?: boolean; baseIndex?: number; baseDefId?: string };
type MinionChoice = {
    skip?: boolean;
    minionUid?: string;
    minionDefId?: string;
    defId?: string;
    baseIndex?: number;
    ownerId?: PlayerId;
    controllerId?: PlayerId;
};
type CardChoice = {
    skip?: boolean;
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    power?: number;
};
type OrderChoice = { cardUid?: string; defId?: string };
type PromptContinuation<T> = { data: { continuationContext?: T } };
type SurfingPenguinBaseContinuation = {
    minionUid?: string;
    minionDefId?: string;
    fromBaseIndex?: number;
    sourceCardUid?: string;
    sourceBaseIndex?: number;
};
type RegurgitatingPenguinOrderContinuation = {
    remainingCards?: Array<Pick<CardInstance, 'uid' | 'defId'>>;
};

function cardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseName(defId: string): string {
    return getBaseDef(defId)?.name ?? defId;
}

function isMinionCard(card: CardInstance | undefined): card is CardInstance {
    if (!card) return false;
    return getCardDef(card.defId)?.type === 'minion';
}

function isActionCard(card: CardInstance | undefined): card is CardInstance {
    if (!card) return false;
    return getCardDef(card.defId)?.type === 'action';
}

function playMinionEventFromCard(
    state: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    now: number,
    options: {
        fromDeck?: boolean;
        reason?: string;
        ownerId?: PlayerId;
    } = {},
): MinionPlayedEvent | undefined {
    const base = state.bases[baseIndex];
    if (!base) return undefined;
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: options.ownerId ?? card.owner,
            baseIndex,
            baseDefId: base.defId,
            power: getMinionLikePower(card.defId) ?? 0,
            ...(options.fromDeck ? { fromDeck: true } : {}),
            consumesNormalLimit: false,
            ...(options.reason ? { discardPlaySourceId: options.reason } : {}),
        },
        timestamp: now,
    };
}

function buildPlayTopDeckMinionEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
    random: RandomFn,
    now: number,
    reason: string,
): SmashUpEvent[] {
    const peek = peekDeckTop(state, random, playerId, 'all', reason, now, playerId);
    if (!peek) return [];
    const events: SmashUpEvent[] = [...peek.events];
    if (!isMinionCard(peek.card)) return events;
    const played = playMinionEventFromCard(state, playerId, peek.card, baseIndex, now, { fromDeck: true, reason });
    if (played) events.push(played);
    return events;
}

function buildPlayTopDeckMinionResult(
    state: SmashUpCore,
    matchState: MatchState<SmashUpCore> | undefined,
    playerId: PlayerId,
    baseIndex: number,
    random: RandomFn,
    now: number,
    reason: string,
): AbilityResult {
    const peek = peekDeckTop(state, random, playerId, 'all', reason, now, playerId);
    if (!peek) return { events: [] };
    const events: SmashUpEvent[] = [...peek.events];
    if (!isMinionCard(peek.card)) return { events };
    const played = playMinionEventFromCard(state, playerId, peek.card, baseIndex, now, { fromDeck: true, reason });
    if (!played) return { events };
    events.push(played);
    return appendMinionPlayedTriggersAfterEvents({
        state: matchState,
        events,
        playedEvt: played,
        random,
    });
}

function buildPlayDeckMinionsFromOrderedDeckEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
    orderedDeck: CardInstance[],
    count: number,
    now: number,
    reason: string,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const attempts = orderedDeck.slice(0, count);
    for (const card of attempts) {
        events.push(inspectDeck(playerId, playerId, 1, reason, now));
        events.push(revealDeckTop(playerId, 'all', [{ uid: card.uid, defId: card.defId }], 1, reason, now, playerId));
        if (!isMinionCard(card)) break;
        const played = playMinionEventFromCard(state, playerId, card, baseIndex, now, { fromDeck: true, reason });
        if (played) events.push(played);
    }
    return events;
}

function ownMinionsAtBase(state: SmashUpCore, playerId: PlayerId, baseIndex: number): Array<MinionOnBase & { baseIndex: number }> {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return base.minions
        .filter(minion => minion.controller === playerId)
        .map(minion => ({ ...minion, baseIndex }));
}

function ownMinionTargetOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
): PromptOption<MinionChoice>[] {
    return buildMinionTargetOptions(
        ownMinionsAtBase(state, playerId, baseIndex).map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: cardName(minion.defId),
        })),
        { state, sourcePlayerId: playerId, semanticRole: 'reference' },
    ).map(option => ({
        ...option,
        value: {
            ...option.value,
            ownerId: state.bases[baseIndex]?.minions.find(minion => minion.uid === option.value.minionUid)?.owner,
            controllerId: playerId,
        },
    }));
}

function otherBaseOptions(state: SmashUpCore, fromBaseIndex: number): PromptOption<BaseChoice>[] {
    return buildBaseTargetOptions(
        state.bases.flatMap((base, baseIndex) => (
            baseIndex === fromBaseIndex
                ? []
                : [{ baseIndex, label: baseName(base.defId) }]
        )),
        state,
    );
}

function queueChoice<T>(
    matchState: MatchState<SmashUpCore> | undefined,
    playerId: PlayerId,
    id: string,
    title: string,
    options: PromptOption<T>[],
    config: {
        sourceId: string;
        targetType: 'base' | 'minion' | 'hand' | 'button' | 'generic';
        titleKey?: string;
        autoResolveIfSingle?: boolean;
        multi?: { min?: number; max?: number; ordered?: boolean };
        continuationContext?: Record<string, unknown>;
    },
): AbilityResult {
    if (!matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        id,
        playerId,
        title,
        options,
        {
            sourceId: config.sourceId,
            targetType: config.targetType,
            titleKey: config.titleKey,
            autoResolveIfSingle: config.autoResolveIfSingle,
            multi: config.multi,
        },
    );
    if (config.continuationContext) {
        (interaction.data as { continuationContext?: Record<string, unknown> }).continuationContext = config.continuationContext;
    }
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function queueChoiceFromBase<T>(
    ctx: BaseAbilityContext,
    id: string,
    title: string,
    options: PromptOption<T>[],
    config: Parameters<typeof queueChoice<T>>[5],
): BaseAbilityResult {
    const result = queueChoice(ctx.matchState, ctx.playerId, id, title, options, config);
    return { events: result.events, matchState: result.matchState };
}

function surfingPenguin(ctx: AbilityContext): AbilityResult {
    const options = [
        createSkipOption('不移动伙伴', 'ui.penguins_surfing_penguin_skip_move_option'),
        ...ownMinionTargetOptions(ctx.state, ctx.playerId, ctx.baseIndex),
    ];
    return queueChoice(
        ctx.matchState,
        ctx.playerId,
        `penguins_surfing_penguin_${ctx.cardUid}_${ctx.now}`,
        '冲浪企鹅：选择要移动的你的伙伴',
        options,
        {
            sourceId: 'penguins_surfing_penguin',
            targetType: 'minion',
            titleKey: 'ui.penguins_surfing_penguin_title',
            autoResolveIfSingle: false,
            continuationContext: {
                sourceCardUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
            },
        },
    );
}

function snazzyPenguin(ctx: AbilityContext): AbilityResult {
    if (!ctx.fromDeck) return { events: [] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) };
}

function commandPenguin(ctx: AbilityContext): AbilityResult {
    return buildPlayTopDeckMinionResult(
        ctx.state,
        ctx.matchState,
        ctx.playerId,
        ctx.baseIndex,
        ctx.random,
        ctx.now,
        'penguins_command_penguin',
    );
}

function disguisePenguinTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) return { events: [] };
    return {
        events: [
            ...buildValidatedCardToDeckBottomEvents(ctx.state, {
                cardUid: self.uid,
                defId: self.defId,
                ownerId: self.owner,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: self.uid,
                sourceDefId: 'penguins_disguise_penguin',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                expectedLocation: 'bases',
                reason: 'penguins_disguise_penguin',
                now: ctx.now,
            }),
            ...buildPlayTopDeckMinionEvents(
                ctx.state,
                ctx.playerId,
                ctx.baseIndex,
                ctx.random,
                ctx.now,
                'penguins_disguise_penguin',
            ),
        ],
    };
}

function secretMission(ctx: AbilityContext): AbilityResult {
    const hand = ctx.state.players[ctx.playerId]?.hand ?? [];
    const options: PromptOption<CardChoice>[] = hand.map((card, index) => ({
        id: `card-${index}`,
        label: cardName(card.defId),
        value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
        displayMode: 'card',
        _source: 'hand' as const,
    }));
    return queueChoice(
        ctx.matchState,
        ctx.playerId,
        `penguins_secret_mission_${ctx.cardUid}_${ctx.now}`,
        '秘密任务：选择任意数量的手牌放到牌库底',
        options,
        {
            sourceId: 'penguins_secret_mission',
            targetType: 'hand',
            titleKey: 'ui.penguins_secret_mission_title',
            autoResolveIfSingle: false,
            multi: { min: 0, max: hand.length },
        },
    );
}

function theHatching(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    return buildPlayTopDeckMinionResult(
        ctx.state,
        ctx.matchState,
        ctx.playerId,
        baseIndex,
        ctx.random,
        ctx.now,
        'penguins_the_hatching',
    );
}

function regurgitatingPenguin(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const top = player.deck.slice(0, 3);
    if (top.length === 0) return { events: [] };
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, top.length, 'penguins_regurgitating_penguin', ctx.now),
        revealDeckTop(
            ctx.playerId,
            ctx.playerId,
            top.map(card => ({ uid: card.uid, defId: card.defId })),
            top.length,
            'penguins_regurgitating_penguin',
            ctx.now,
            ctx.playerId,
        ),
    ];
    const actionOptions: PromptOption<CardChoice>[] = top
        .filter(isActionCard)
        .map((card, index) => ({
            id: `action-${index}`,
            label: cardName(card.defId),
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
            displayMode: 'card',
    }));
    if (actionOptions.length === 0) return { events };
    if (!ctx.matchState) return { events };
    const interaction = createSimpleChoice(
        `penguins_regurgitating_penguin_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '反刍企鹅：选择一张行动加入手牌',
        [createSkipOption('不拿行动', 'ui.penguins_regurgitating_penguin_skip_take_action_option'), ...actionOptions],
        {
            sourceId: 'penguins_regurgitating_penguin',
            targetType: 'generic',
            titleKey: 'ui.penguins_regurgitating_penguin_title',
            autoResolveIfSingle: false,
        },
    );
    (interaction.data as { continuationContext?: Record<string, unknown> }).continuationContext = {
        topCards: top.map(card => ({ uid: card.uid, defId: card.defId })),
    };
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function babyPenguin(ctx: AbilityContext): AbilityResult {
    if (!ctx.fromDeck) return { events: [] };
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const options: PromptOption<CardChoice>[] = player.hand
        .filter(card => isMinionCard(card) && (getMinionLikePower(card.defId) ?? 0) <= 3)
        .map((card, index) => ({
            id: `card-${index}`,
            label: cardName(card.defId),
            value: {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                power: getMinionLikePower(card.defId) ?? 0,
            },
            displayMode: 'card',
            _source: 'hand' as const,
        }));
    if (options.length === 0) return { events: [] };
    return queueChoice(
        ctx.matchState,
        ctx.playerId,
        `penguins_baby_penguin_${ctx.cardUid}_${ctx.now}`,
        '企鹅宝宝：选择一张力量 3 或更少的伙伴额外打出到这里',
        [createSkipOption('不打出伙伴', 'ui.penguins_baby_penguin_skip_play_option'), ...options],
        {
            sourceId: 'penguins_baby_penguin',
            targetType: 'hand',
            titleKey: 'ui.penguins_baby_penguin_title',
            autoResolveIfSingle: false,
            continuationContext: { baseIndex: ctx.baseIndex },
        },
    );
}

function wishForWings(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const titan = findPlayableEmperorPenguin(ctx.state, ctx.playerId);
    const ownMinions = ownMinionsAtBase(ctx.state, ctx.playerId, baseIndex);
    if (!titan) {
        return { events: buildWishPowerEvents(ctx.state, ctx.playerId, baseIndex, ctx.cardUid, ctx.now) };
    }
    const options: PromptOption<{ mode: 'titan' | 'power' }>[] = [
        {
            id: 'titan',
            label: '打出企鹅帝皇',
            labelKey: 'ui.penguins_a_wish_for_wings_that_work_play_titan_option',
            value: { mode: 'titan' },
            displayMode: 'button',
        },
        ...(ownMinions.length > 0
            ? [{
                id: 'power',
                label: '这里你的伙伴本回合 +1',
                labelKey: 'ui.penguins_a_wish_for_wings_that_work_power_option',
                value: { mode: 'power' as const },
                displayMode: 'button' as const,
            }]
            : []),
    ];
    return queueChoice(
        ctx.matchState,
        ctx.playerId,
        `penguins_a_wish_for_wings_that_work_${ctx.cardUid}_${ctx.now}`,
        '渴望飞翔的工作：选择效果',
        options,
        {
            sourceId: 'penguins_a_wish_for_wings_that_work',
            targetType: 'button',
            titleKey: 'ui.penguins_a_wish_for_wings_that_work_title',
            autoResolveIfSingle: false,
            continuationContext: { baseIndex, sourceCardUid: ctx.cardUid },
        },
    );
}

function iCantTellThemApart(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const options = ownMinionTargetOptions(ctx.state, ctx.playerId, baseIndex);
    return queueChoice(
        ctx.matchState,
        ctx.playerId,
        `penguins_i_cant_tell_them_apart_${ctx.cardUid}_${ctx.now}`,
        '我不能区分他们：选择任意数量这里你的伙伴洗回牌库',
        options,
        {
            sourceId: 'penguins_i_cant_tell_them_apart',
            targetType: 'minion',
            titleKey: 'ui.penguins_i_cant_tell_them_apart_title',
            autoResolveIfSingle: false,
            multi: { min: 0, max: options.length },
            continuationContext: { baseIndex, sourceCardUid: ctx.cardUid },
        },
    );
}

function underTheIce(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const revealed = player.deck.slice(0, 5);
    if (revealed.length === 0) return { events: [] };
    const minions = revealed.filter(isMinionCard);
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, revealed.length, 'penguins_under_the_ice', ctx.now),
        revealDeckTop(
            ctx.playerId,
            'all',
            revealed.map(card => ({ uid: card.uid, defId: card.defId })),
            revealed.length,
            'penguins_under_the_ice',
            ctx.now,
            ctx.playerId,
        ),
    ];
    const remainingDeck = player.deck.slice(revealed.length);
    if (minions.length === 0) {
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId: ctx.playerId, deckUids: [...remainingDeck, ...revealed].map(card => card.uid) },
            timestamp: ctx.now,
        } as DeckReorderedEvent);
        return { events };
    }
    const selected = (ctx.random.shuffle(minions)[0] ?? minions[0]) as CardInstance;
    const restRevealed = revealed.filter(card => card.uid !== selected.uid);
    const orderedDeck = [selected, ...remainingDeck, ...restRevealed];
    events.push({
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId: ctx.playerId, deckUids: orderedDeck.map(card => card.uid) },
        timestamp: ctx.now,
    } as DeckReorderedEvent);
    const played = playMinionEventFromCard(ctx.state, ctx.playerId, selected, ctx.targetBaseIndex ?? ctx.baseIndex, ctx.now, {
        fromDeck: true,
        reason: 'penguins_under_the_ice',
    });
    if (played) events.push(played);
    return { events };
}

function findPlayableEmperorPenguin(state: SmashUpCore, playerId: PlayerId): TitanState | undefined {
    return (state.titans ?? []).find(titan =>
        titan.defId === EMPEROR_PENGUIN
        && titan.controllerId === playerId
        && titan.location.zone === 'setaside'
        && canControllerPlayTitan(state, playerId, titan.uid),
    );
}

function buildWishPowerEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
    sourceCardUid: string | undefined,
    now: number,
): SmashUpEvent[] {
    return ownMinionsAtBase(state, playerId, baseIndex).map(minion =>
        addTempPower(minion.uid, baseIndex, 1, 'penguins_a_wish_for_wings_that_work', now, {
            sourcePlayerId: playerId,
            sourceCardUid,
            sourceDefId: 'penguins_a_wish_for_wings_that_work',
            sourceControllerId: playerId,
            sourceBaseIndex: baseIndex,
        }) as SmashUpEvent,
    );
}

function leapingAboardAfterScoring(ctx: TriggerContext): AbilityResult {
    const sourceBaseIndex = ctx.sourceBaseIndex ?? ctx.baseIndex;
    if (sourceBaseIndex === undefined) return { events: [] };
    const playerId = ctx.sourceControllerId ?? ctx.playerId;
    const player = ctx.state.players[playerId];
    if (!player) return { events: [] };
    const top = player.deck[0];
    if (!isMinionCard(top)) return { events: [] };
    const targetBaseDefId = (ctx.matchState ? getDeferredReplacementBaseDefId(ctx.matchState) : undefined)
        ?? ctx.state.bases[sourceBaseIndex]?.defId;
    if (!targetBaseDefId) return { events: [] };
    const pending: PendingPostScoringAction = {
        kind: 'playMinionOnReplacementBase',
        playerId,
        cardUid: top.uid,
        defId: top.defId,
        ownerId: top.owner,
        fromZone: 'deck',
        allowImplicitSource: true,
        baseIndex: sourceBaseIndex,
        targetBaseDefId,
        power: getMinionLikePower(top.defId) ?? 0,
    };
    const matchState = ctx.matchState;
    if (!matchState) return { events: [] };
    const updatedMatchState = appendPendingPostScoringActions(matchState, [pending]);
    if (updatedMatchState === matchState) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.CARD_REMOVED_FROM_DECK,
            payload: {
                playerId,
                cardUid: top.uid,
                defId: top.defId,
                reason: 'penguins_leaping_aboard',
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
        matchState: updatedMatchState,
    };
}

function pebbleGiftTrigger(ctx: TriggerContext): AbilityResult {
    if (!canTriggerPebbleGift(ctx)) return { events: [] };
    const playerId = ctx.sourceControllerId ?? ctx.playerId;
    return {
        events: buildStandardDrawEvents(ctx.state, playerId, 1, ctx.random ?? FALLBACK_RANDOM, ctx.now),
    };
}

function canTriggerPebbleGift(ctx: TriggerContext): boolean {
    const sourceBaseIndex = ctx.sourceBaseIndex;
    if (sourceBaseIndex === undefined || ctx.baseIndex !== sourceBaseIndex) return false;
    if (ctx.triggerMinionFromDeck !== true) return false;
    const playerId = ctx.sourceControllerId ?? ctx.playerId;
    return ctx.playerId === playerId;
}

function iceSlideAfterScoring(ctx: TriggerContext): AbilityResult {
    const sourceBaseIndex = ctx.sourceBaseIndex ?? ctx.baseIndex;
    if (sourceBaseIndex === undefined) return { events: [] };
    const playerId = ctx.sourceControllerId ?? ctx.playerId;
    const count = ctx.state.bases[sourceBaseIndex]?.minions.filter(minion => minion.controller === playerId).length ?? 0;
    return { events: buildStandardDrawEvents(ctx.state, playerId, count, ctx.random ?? FALLBACK_RANDOM, ctx.now) };
}

function iceFloe(ctx: BaseAbilityContext): BaseAbilityResult {
    const options = ownMinionTargetOptions(ctx.state, ctx.playerId, ctx.baseIndex);
    if (options.length === 0) return { events: [] };
    return queueChoiceFromBase(
        ctx,
        `base_ice_floe_${ctx.playerId}_${ctx.now}`,
        '浮冰：选择这里你的一个伙伴放到牌库底',
        [createSkipOption('不使用浮冰', 'ui.base_ice_floe_skip_option'), ...options],
        {
            sourceId: 'base_ice_floe',
            targetType: 'minion',
            titleKey: 'ui.base_ice_floe_title',
            autoResolveIfSingle: false,
            continuationContext: { baseIndex: ctx.baseIndex },
        },
    );
}

function theColony(ctx: BaseAbilityContext): BaseAbilityResult {
    const playedHereCount = ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
    if (playedHereCount !== 1) return { events: [] };
    return buildPlayTopDeckMinionResult(
        ctx.state,
        ctx.matchState,
        ctx.playerId,
        ctx.baseIndex,
        ctx.random ?? FALLBACK_RANDOM,
        ctx.now,
        'base_the_colony',
    );
}

function registerNoopSpecial(defId: string, error: string): void {
    registerAbility(defId, 'special', {
        execute: () => ({ events: [] }),
        validateUse: () => error,
    });
}

export function registerPenguinAbilities(): void {
    registerSimpleAbility('penguins_surfing_penguin', 'onPlay', surfingPenguin);
    registerNoopSpecial('penguins_dancing_penguin', '跳舞企鹅通过替代普通手牌伙伴打出的流程发动');
    registerSimpleAbility('penguins_snazzy_penguin', 'onPlay', snazzyPenguin);
    registerSimpleAbility('penguins_command_penguin', 'onPlay', commandPenguin);
    registerSimpleAbility('penguins_disguise_penguin', 'talent', disguisePenguinTalent);
    registerSimpleAbility('penguins_secret_mission', 'onPlay', secretMission);
    registerSimpleAbility('penguins_the_hatching', 'onPlay', theHatching);
    registerSimpleAbility('penguins_regurgitating_penguin', 'onPlay', regurgitatingPenguin);
    registerSimpleAbility('penguins_baby_penguin', 'onPlay', babyPenguin);
    registerSimpleAbility('penguins_a_wish_for_wings_that_work', 'onPlay', wishForWings);
    registerNoopSpecial('penguins_leaping_aboard', '跳上船在计分后通过持续效果自动触发');
    registerSimpleAbility('penguins_i_cant_tell_them_apart', 'onPlay', iCantTellThemApart);
    registerSimpleAbility('penguins_under_the_ice', 'onPlay', underTheIce);
    registerNoopSpecial('penguins_ice_slide', '冰滑道在计分后通过持续效果自动触发');

    registerTrigger('penguins_leaping_aboard', 'afterScoring', leapingAboardAfterScoring, {
        mandatory: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('penguins_pebble_gift', 'onMinionPlayed', pebbleGiftTrigger, {
        mandatory: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerPebbleGift,
    });
    registerTrigger('penguins_ice_slide', 'afterScoring', iceSlideAfterScoring, {
        mandatory: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });

    registerActiveBaseAbility('base_ice_floe', iceFloe, {
        oncePerTurn: true,
        canUse: ctx => ownMinionsAtBase(ctx.state, ctx.playerId, ctx.baseIndex).length > 0,
    });
    registerBaseAbility('base_the_colony', 'onMinionPlayed', theColony, {
        mandatory: false,
        canTrigger: ctx => (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1,
    });
}

export function registerPenguinInteractionHandlers(): void {
    registerInteractionHandler('penguins_surfing_penguin', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        const options = otherBaseOptions(state.core, selected.baseIndex);
        if (options.length === 0) return { state, events: [] };
        const next = createSimpleChoice(
            `penguins_surfing_penguin_choose_base_${timestamp}`,
            playerId,
            '冲浪企鹅：选择目的基地',
            options,
            {
                sourceId: 'penguins_surfing_penguin_choose_base',
                targetType: 'base',
                titleKey: 'ui.penguins_surfing_penguin_choose_base_title',
                autoResolveIfSingle: false,
            },
        );
        const nextWithContext = next as typeof next & PromptContinuation<SurfingPenguinBaseContinuation>;
        nextWithContext.data.continuationContext = {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId ?? selected.defId,
            fromBaseIndex: selected.baseIndex,
            sourceCardUid: continuation?.sourceCardUid,
            sourceBaseIndex: continuation?.sourceBaseIndex,
        };
        return { state: queueInteraction(state, nextWithContext, { urgent: true }), events: [] };
    });

    registerInteractionHandler('penguins_surfing_penguin_choose_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as BaseChoice | undefined;
        const context = data?.continuationContext as {
            minionUid?: string;
            minionDefId?: string;
            fromBaseIndex?: number;
            sourceCardUid?: string;
            sourceBaseIndex?: number;
        } | undefined;
        if (selected?.skip || selected?.baseIndex === undefined || !context?.minionUid || context.fromBaseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId ?? '',
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                toBaseDefId: selected.baseDefId,
                reason: 'penguins_surfing_penguin',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: 'penguins_surfing_penguin',
                sourceControllerId: playerId,
                sourceBaseIndex: context.sourceBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('penguins_secret_mission', (state, playerId, value, _data, random, timestamp) => {
        const selections = (Array.isArray(value) ? value : []) as CardChoice[];
        const player = state.core.players[playerId];
        if (!player || selections.length === 0) return { state, events: [] };
        const selectedUids = selections
            .map(selection => selection.cardUid)
            .filter((uid): uid is string => typeof uid === 'string');
        const selectedSet = new Set(selectedUids);
        const selectedCards = player.hand.filter(card => selectedSet.has(card.uid));
        if (selectedCards.length === 0) return { state, events: [] };
        const deckAfterBottom = [...player.deck, ...selectedCards];
        const drawCards = deckAfterBottom.slice(0, selectedCards.length);
        const remainingAfterDraw = deckAfterBottom.filter(card => !drawCards.some(drawn => drawn.uid === card.uid));
        const shuffledRemaining = random.shuffle(remainingAfterDraw);
        return {
            state,
            events: [
                {
                    type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
                    payload: {
                        playerId,
                        newDeckUids: deckAfterBottom.map(card => card.uid),
                        reason: 'penguins_secret_mission_bottom',
                    },
                    timestamp,
                } as HandShuffledIntoDeckEvent,
                ...(drawCards.length > 0
                    ? [{
                        type: SU_EVENTS.CARDS_DRAWN,
                        payload: { playerId, count: drawCards.length, cardUids: drawCards.map(card => card.uid) },
                        timestamp,
                    } as CardsDrawnEvent]
                    : []),
                {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids: shuffledRemaining.map(card => card.uid) },
                    timestamp,
                } as DeckReorderedEvent,
            ],
        };
    });

    registerInteractionHandler('penguins_regurgitating_penguin', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const tracked = (data?.continuationContext as { topCards?: CardInstance[] } | undefined)?.topCards ?? [];
        const player = state.core.players[playerId];
        if (!player || tracked.length === 0) return { state, events: [] };
        const currentTop = getCurrentTrackedCardTopSnapshot(player.deck, tracked);
        const chosenUid = selected?.skip ? undefined : selected?.cardUid;
        const chosen = currentTop.find(card => card.uid === chosenUid && isActionCard(card));
        const remaining = currentTop.filter(card => card.uid !== chosen?.uid);
        const events: SmashUpEvent[] = chosen
            ? [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: 1, cardUids: [chosen.uid] },
                timestamp,
            } as CardsDrawnEvent]
            : [];
        if (remaining.length <= 1) return { state, events };
        const options: PromptOption<OrderChoice>[] = remaining.map((card, index) => ({
            id: `card-${index}`,
            label: cardName(card.defId),
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card',
        }));
        const next = createSimpleChoice(
            `penguins_regurgitating_penguin_order_${timestamp}`,
            playerId,
            '反刍企鹅：决定其余牌放回牌库顶的顺序',
            options,
            {
                sourceId: 'penguins_regurgitating_penguin_order',
                targetType: 'generic',
                titleKey: 'ui.penguins_regurgitating_penguin_order_title',
                multi: { min: remaining.length, max: remaining.length, ordered: true },
                autoResolveIfSingle: false,
            },
        );
        const nextWithContext = next as typeof next & PromptContinuation<RegurgitatingPenguinOrderContinuation>;
        nextWithContext.data.continuationContext = { remainingCards: remaining.map(card => ({ uid: card.uid, defId: card.defId })) };
        return { state: queueInteraction(state, nextWithContext, { urgent: true }), events };
    });

    registerInteractionHandler('penguins_regurgitating_penguin_order', (state, playerId, value, data, _random, timestamp) => {
        const ordered = (Array.isArray(value) ? value : []) as OrderChoice[];
        const context = data?.continuationContext as RegurgitatingPenguinOrderContinuation | undefined;
        const tracked = context?.remainingCards ?? [];
        const player = state.core.players[playerId];
        if (!player || tracked.length === 0 || ordered.length === 0) return { state, events: [] };
        const currentTop = getCurrentTrackedCardTopSnapshot(player.deck, tracked);
        if (currentTop.length === 0) return { state, events: [] };
        const byUid = new Map(currentTop.map(card => [card.uid, card]));
        const orderedCards = ordered
            .map(choice => choice.cardUid ? byUid.get(choice.cardUid) : undefined)
            .filter((card): card is CardInstance => card !== undefined);
        const missing = currentTop.filter(card => !orderedCards.some(orderedCard => orderedCard.uid === card.uid));
        const restDeck = player.deck.filter(card => !currentTop.some(topCard => topCard.uid === card.uid));
        return {
            state,
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: [...orderedCards, ...missing, ...restDeck].map(card => card.uid) },
                timestamp,
            } as DeckReorderedEvent],
        };
    });

    registerInteractionHandler('penguins_baby_penguin', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const baseIndex = (data?.continuationContext as { baseIndex?: number } | undefined)?.baseIndex;
        if (selected?.skip || !selected?.cardUid || !selected.defId || baseIndex === undefined) return { state, events: [] };
        const card = state.core.players[playerId]?.hand.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId);
        if (!card || !isMinionCard(card) || (getMinionLikePower(card.defId) ?? 0) > 3) return { state, events: [] };
        const played = playMinionEventFromCard(state.core, playerId, card, baseIndex, timestamp, { reason: 'penguins_baby_penguin' });
        return { state, events: played ? [played] : [] };
    });

    registerInteractionHandler('penguins_a_wish_for_wings_that_work', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { mode?: 'titan' | 'power' } | undefined;
        const context = data?.continuationContext as { baseIndex?: number; sourceCardUid?: string } | undefined;
        if (!selected?.mode || context?.baseIndex === undefined) return { state, events: [] };
        if (selected.mode === 'power') {
            return {
                state,
                events: buildWishPowerEvents(state.core, playerId, context.baseIndex, context.sourceCardUid, timestamp),
            };
        }
        const titan = findPlayableEmperorPenguin(state.core, playerId);
        if (!titan) return { state, events: [] };
        return {
            state,
            events: [playTitan(titan, playerId, context.baseIndex, 'penguins_a_wish_for_wings_that_work', timestamp, state.core.bases[context.baseIndex]?.defId)],
        };
    });

    registerInteractionHandler('penguins_i_cant_tell_them_apart', (state, playerId, value, data, random, timestamp) => {
        const selected = (Array.isArray(value) ? value : []) as MinionChoice[];
        const context = data?.continuationContext as { baseIndex?: number; sourceCardUid?: string } | undefined;
        if (context?.baseIndex === undefined || selected.length === 0) return { state, events: [] };
        const base = state.core.bases[context.baseIndex];
        const player = state.core.players[playerId];
        if (!base || !player) return { state, events: [] };
        const selectedMinions = selected.flatMap(choice => {
            if (!choice.minionUid) return [];
            const minion = base.minions.find(candidate => candidate.uid === choice.minionUid && candidate.controller === playerId);
            return minion ? [minion] : [];
        });
        if (selectedMinions.length === 0) return { state, events: [] };
        const selectedCards: CardInstance[] = selectedMinions.map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            type: 'minion',
            owner: minion.owner,
        }));
        const deckAfterReturn = [...player.deck, ...selectedCards];
        const shuffledDeck = random.shuffle(deckAfterReturn);
        const events: SmashUpEvent[] = selectedMinions.flatMap(minion =>
            buildValidatedCardToDeckBottomEvents(state.core, {
                cardUid: minion.uid,
                defId: minion.defId,
                ownerId: minion.owner,
                sourcePlayerId: playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: 'penguins_i_cant_tell_them_apart',
                sourceControllerId: playerId,
                sourceBaseIndex: context.baseIndex,
                expectedLocation: 'bases',
                reason: 'penguins_i_cant_tell_them_apart',
                now: timestamp,
            }),
        );
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: shuffledDeck.map(card => card.uid) },
            timestamp,
        } as DeckReorderedEvent);
        events.push(...buildPlayDeckMinionsFromOrderedDeckEvents(
            state.core,
            playerId,
            context.baseIndex,
            shuffledDeck,
            selectedMinions.length,
            timestamp,
            'penguins_i_cant_tell_them_apart',
        ));
        return { state, events };
    });

    registerInteractionHandler('base_ice_floe', (state, playerId, value, data, random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        const baseIndex = (data?.continuationContext as { baseIndex?: number } | undefined)?.baseIndex;
        if (selected?.skip || !selected?.minionUid || baseIndex === undefined) return { state, events: [] };
        const base = state.core.bases[baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === selected.minionUid && candidate.controller === playerId);
        if (!base || !minion) return { state, events: [] };
        return {
            state,
            events: [
                ...buildValidatedCardToDeckBottomEvents(state.core, {
                    cardUid: minion.uid,
                    defId: minion.defId,
                    ownerId: minion.owner,
                    sourcePlayerId: playerId,
                    sourceDefId: 'base_ice_floe',
                    sourceControllerId: playerId,
                    sourceBaseIndex: baseIndex,
                    expectedLocation: 'bases',
                    reason: 'base_ice_floe',
                    now: timestamp,
                }),
                ...buildPlayTopDeckMinionEvents(state.core, playerId, baseIndex, random, timestamp, 'base_ice_floe'),
            ],
        };
    });
}
