import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    createSkipOption,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    modifyBreakpoint,
    peekDeckTop,
    recoverCardsFromDiscard,
    revealDeckTop,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import type { CardInstance, CardToDeckTopEvent, DeckReorderedEvent, MinionMetadataUpdatedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getCardDef } from '../data/cards';
import {
    SHAYU_TRIGGER_CONTRACT,
    type BaseChoice,
    type CardChoice,
    type MinionChoice,
    type MinionTarget,
    type PromptContext,
    collectBaseTargets,
    collectMinionTargets,
    runtimeToAbilityResult,
    runtimeToTriggerResult,
} from './shayu_common';

type GreekMinionPromptContext = PromptContext & {
    sourceId: string;
    title: string;
    targets: MinionTarget[];
    amount: number;
    mode: 'counter' | 'temp';
    optional?: boolean;
    maxSelections?: number;
    nextBasePrompt?: Omit<GreekBasePromptContext, keyof PromptContext>;
};

type GreekBasePromptContext = PromptContext & {
    sourceUid?: string;
    sourceBaseIndex?: number;
    sourceDefId: string;
    bases: Array<{ baseIndex: number; label: string }>;
};

type SpartanPromptContext = PromptContext & {
    sourceUid: string;
    sourceBaseIndex: number;
    sourceDefId: string;
};

type HadesContext = PromptContext & { cards: Array<{ cardUid: string; defId: string; label: string }> };
type PoseidonContext = PromptContext & { cards: Array<{ cardUid: string; defId: string; ownerId: string; label: string }> };
type DionysusTopContext = PromptContext & { cardUid: string; defId: string; ownerId: string };
type DionysusMinionContext = PromptContext & { targets: MinionTarget[]; cardUid: string; defId: string; ownerId: string };
type AthenaRevealedCard = Pick<CardInstance, 'uid' | 'defId' | 'type' | 'owner'>;
type AthenaPickContext = PromptContext & { revealed: AthenaRevealedCard[] };
type AthenaOrderContext = PromptContext & {
    remaining: Array<{ uid: string; defId: string; owner: string }>;
    ordered: Array<{ uid: string; defId: string; owner: string }>;
};

function metadataTurnUsed(uid: string, baseIndex: number, key: string, turnNumber: number, now: number): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid: uid, baseIndex, metadataUpdate: { [key]: turnNumber }, reason: key },
        timestamp: now,
    };
}

function ownMinionTargets(state: SmashUpCore, playerId: string): MinionTarget[] {
    return collectMinionTargets(state, minion => minion.controller === playerId);
}

function allMinionTargets(state: SmashUpCore): MinionTarget[] {
    return collectMinionTargets(state, () => true);
}

function findCardOwnerAcrossPlayerZones(state: SmashUpCore, cardUid: string, defId: string, fallbackPlayerId: string): string {
    for (const player of Object.values(state.players)) {
        const inHand = player.hand.find(card => card.uid === cardUid && card.defId === defId);
        if (inHand) return inHand.owner;
        const inDiscard = player.discard.find(card => card.uid === cardUid && card.defId === defId);
        if (inDiscard) return inDiscard.owner;
        const inDeck = player.deck.find(card => card.uid === cardUid && card.defId === defId);
        if (inDeck) return inDeck.owner;
    }
    return fallbackPlayerId;
}

function buildAthenaCardOptions(cards: Array<{ uid: string; defId: string }>) {
    return cards.map((card, index) => ({
        id: `card-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        displayMode: 'card' as const,
    }));
}

function buildAthenaRevealEvents(
    state: SmashUpCore,
    playerId: string,
    random: AbilityContext['random'],
    now: number,
): { events: SmashUpEvent[]; revealed: AthenaRevealedCard[] } {
    const player = state.players[playerId];
    if (!player) return { events: [], revealed: [] };

    let deckSim = [...player.deck];
    const revealed: AthenaRevealedCard[] = [];
    const events: SmashUpEvent[] = [];

    if (deckSim.length < 5 && player.discard.length > 0) {
        const shuffledDiscard = random.shuffle([...player.discard]);
        const sourceDiscardCards: CardInstance[] = [];
        const borrowedByOwner = new Map<PlayerId, CardInstance[]>();
        for (const card of shuffledDiscard) {
            if (card.owner === playerId || !state.players[card.owner]) {
                sourceDiscardCards.push(card);
                continue;
            }
            borrowedByOwner.set(card.owner, [...(borrowedByOwner.get(card.owner) ?? []), card]);
        }

        for (const [ownerId, cards] of borrowedByOwner) {
            const owner = state.players[ownerId];
            if (!owner) continue;
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: [...owner.deck.map(card => card.uid), ...cards.map(card => card.uid)],
                    sourcePlayerId: playerId,
                },
                timestamp: now,
            } as DeckReorderedEvent);
        }

        deckSim = [...deckSim, ...sourceDiscardCards];
        if (sourceDiscardCards.length > 0) {
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId,
                    deckUids: deckSim.map(card => card.uid),
                },
                timestamp: now,
            } as DeckReorderedEvent);
        }
    }

    for (const card of deckSim.slice(0, 5)) {
        revealed.push({ uid: card.uid, defId: card.defId, type: card.type, owner: card.owner });
    }

    if (revealed.length === 0) return { events, revealed };

    events.push(inspectDeck(playerId, playerId, revealed.length, 'mythic_greeks_favor_of_athena', now));
    events.push(revealDeckTop(
        playerId,
        'all',
        revealed.map(card => ({ uid: card.uid, defId: card.defId })),
        revealed.length,
        'mythic_greeks_favor_of_athena',
        now,
        playerId,
    ));

    return { events, revealed };
}

const greekMinionPromptProgram = createPromptProgram<GreekMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_minion_prompt',
    interactionSourceIds: ['mythic_greeks_odysseus', 'mythic_greeks_favor_of_ares', 'mythic_greeks_favor_of_dionysus', 'mythic_greeks_favor_of_hera'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...buildMinionTargetOptions(context.targets, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'action', effectType: 'buff' }),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
            ...(context.maxSelections !== undefined ? { multi: { min: 0, max: context.maxSelections } } : {}),
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const buildResult = (events: SmashUpEvent[]) => {
            if (!context.nextBasePrompt) return { events };
            return {
                events,
                context: {
                    ...context.nextBasePrompt,
                    matchState: state,
                    playerId: context.playerId,
                    now: timestamp,
                } satisfies GreekBasePromptContext,
                nextProgram: greekBasePromptProgram,
            };
        };
        const choices = Array.isArray(value) ? value as MinionChoice[] : undefined;
        if (choices) {
            return buildResult(
                choices
                    .filter(choice => !choice.skip && choice.minionUid && choice.baseIndex !== undefined)
                    .map(choice => context.mode === 'counter'
                        ? addPowerCounter(choice.minionUid!, choice.baseIndex!, context.amount, context.sourceId, timestamp)
                        : addTempPower(choice.minionUid!, choice.baseIndex!, context.amount, context.sourceId, timestamp)),
            );
        }
        const choice = value as MinionChoice;
        if (choice.skip || !choice.minionUid || choice.baseIndex === undefined) return buildResult([]);
        const event = context.mode === 'counter'
            ? addPowerCounter(choice.minionUid, choice.baseIndex, context.amount, context.sourceId, timestamp)
            : addTempPower(choice.minionUid, choice.baseIndex, context.amount, context.sourceId, timestamp);
        return buildResult([event]);
    },
});

const spartanCounterPromptProgram = createPromptProgram<SpartanPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_spartan',
    interactionSourceIds: ['mythic_greeks_spartan', 'mythic_greeks_spartan_pod'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceDefId}_${context.now}`,
        context.playerId,
        '斯巴达人：是否在此随从上放置 +1 力量指示物？',
        [
            createSkipOption('跳过（不放置）', 'ui.mythic_greeks_spartan_skip_option'),
            {
                id: 'apply',
                label: '放置 +1 指示物',
                labelKey: 'ui.mythic_greeks_spartan_apply_option',
                value: { apply: true },
                displayMode: 'button' as const,
            },
        ],
        {
            titleKey: 'ui.mythic_greeks_spartan_title',
            sourceId: context.sourceDefId,
            targetType: 'button',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as { apply?: boolean; skip?: boolean } | undefined;
        if (!selected?.apply || selected.skip) return { events: [] };
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion =>
            minion.uid === context.sourceUid && minion.defId === context.sourceDefId);
        if (!source) return { events: [] };
        if (Number(source.metadata?.mythicGreeksSpartanTriggeredTurn ?? -1) === state.core.turnNumber) {
            return { events: [] };
        }
        return {
            events: [
                addPowerCounter(source.uid, context.sourceBaseIndex, 1, context.sourceDefId, timestamp),
                metadataTurnUsed(source.uid, context.sourceBaseIndex, 'mythicGreeksSpartanTriggeredTurn', state.core.turnNumber, timestamp),
            ],
        };
    },
});

function runGreekMinionPrompt(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    amount: number,
    mode: 'counter' | 'temp',
    targets = ownMinionTargets(ctx.state, ctx.playerId),
    options: { optional?: boolean; maxSelections?: number } = {},
): AbilityResult {
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(greekMinionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        targets,
        amount,
        mode,
        ...options,
    }));
}

const greekBasePromptProgram = createPromptProgram<GreekBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_jason_base',
    interactionSourceIds: ['mythic_greeks_jason', 'mythic_greeks_favor_of_zeus'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceDefId}_${context.now}`,
        context.playerId,
        context.sourceDefId === 'mythic_greeks_favor_of_zeus' ? '宙斯的恩惠：选择降低爆破点的基地' : '伊阿宋：选择一个基地，你在那里的随从 +1',
        buildBaseTargetOptions(context.bases, context.matchState.core),
        { sourceId: context.sourceDefId, targetType: 'base' },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        if (context.sourceDefId === 'mythic_greeks_favor_of_zeus') {
            return { events: [modifyBreakpoint(choice.baseIndex, -5, 'mythic_greeks_favor_of_zeus', timestamp)] };
        }
        const events: SmashUpEvent[] = [];
        for (const minion of state.core.bases[choice.baseIndex]?.minions ?? []) {
            if (minion.controller === playerId) {
                events.push(addTempPower(minion.uid, choice.baseIndex, 1, 'mythic_greeks_jason', timestamp));
            }
        }
        if (context.sourceUid) {
            events.push(metadataTurnUsed(
                context.sourceUid,
                context.sourceBaseIndex ?? choice.baseIndex,
                'mythicGreeksJasonTriggeredTurn',
                state.core.turnNumber,
                timestamp,
            ));
        }
        return { events };
    },
});

const hadesPromptProgram = createPromptProgram<HadesContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_favor_of_hades',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mythic_greeks_favor_of_hades_${context.now}`,
        context.playerId,
        '哈迪斯的恩惠：选择一张弃牌堆行动卡返回手牌',
        context.cards.map((card, index) => ({ id: `card-${index}`, label: card.label, value: card, displayMode: 'card' as const })),
        {
            sourceId: 'mythic_greeks_favor_of_hades',
            targetType: 'generic',
            titleKey: 'ui.mythic_greeks_favor_of_hades_title',
        },
    ),
    onResolve: ({ playerId, value, timestamp }) => {
        const choice = value as { cardUid?: string };
        if (!choice.cardUid) return { events: [] };
        return { events: [recoverCardsFromDiscard(playerId, [choice.cardUid], 'mythic_greeks_favor_of_hades', timestamp)] };
    },
});

function favorOfHades(ctx: AbilityContext): AbilityResult {
    const cards = ctx.state.players[ctx.playerId].discard
        .filter(card => card.type === 'action')
        .map(card => ({ cardUid: card.uid, defId: card.defId, label: getCardDef(card.defId)?.name ?? card.defId }));
    if (cards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(hadesPromptProgram, { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now, cards }));
}

function favorOfAres(ctx: AbilityContext): AbilityResult {
    const targets = ctx.targetMinionUid
        ? collectMinionTargets(ctx.state, minion => minion.uid === ctx.targetMinionUid && minion.controller === ctx.playerId)
        : ownMinionTargets(ctx.state, ctx.playerId);
    return runGreekMinionPrompt(ctx, 'mythic_greeks_favor_of_ares', '阿瑞斯的恩惠：选择你的一个随从 +3 直到回合结束', 3, 'temp', targets);
}

function favorOfAphrodite(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraMinion(ctx, 'mythic_greeks_favor_of_aphrodite')] };
}

function favorOfDionysus(ctx: AbilityContext): AbilityResult {
    const targets = ctx.targetMinionUid
        ? collectMinionTargets(ctx.state, minion => minion.uid === ctx.targetMinionUid && minion.controller === ctx.playerId)
        : ownMinionTargets(ctx.state, ctx.playerId);
    const ownerId = findCardOwnerAcrossPlayerZones(ctx.state, ctx.cardUid, ctx.defId, ctx.playerId);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(dionysusMinionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        targets,
        cardUid: ctx.cardUid,
        defId: ctx.defId,
        ownerId,
    }));
}

const dionysusMinionPromptProgram = createPromptProgram<DionysusMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_favor_of_dionysus_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mythic_greeks_favor_of_dionysus_minion_${context.now}`,
        context.playerId,
        '狄俄尼索斯的恩惠：选择你的一个随从 +1 到回合结束',
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceKind: 'action',
            effectType: 'buff',
        }),
        {
            sourceId: 'mythic_greeks_favor_of_dionysus_minion',
            targetType: 'minion',
            titleKey: 'ui.mythic_greeks_favor_of_dionysus_minion_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined) return { events: [] };
        return {
            events: [
                addTempPower(choice.minionUid, choice.baseIndex, 1, 'mythic_greeks_favor_of_dionysus', timestamp),
                grantContextualExtraAction({
                    matchState: state,
                    playerId: context.playerId,
                    now: timestamp,
                }, 'mythic_greeks_favor_of_dionysus'),
            ],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
            },
            nextProgram: dionysusTopPromptProgram,
        };
    },
});

const dionysusTopPromptProgram = createPromptProgram<DionysusTopContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_favor_of_dionysus_top',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mythic_greeks_favor_of_dionysus_top_${context.now}`,
        context.playerId,
        '狄俄尼索斯的恩惠：是否将此卡放到牌库顶？',
        [
            createSkipOption('放入弃牌堆', 'ui.mythic_greeks_favor_of_dionysus_top_discard_option'),
            {
                id: 'deck-top',
                label: '放到牌库顶',
                labelKey: 'ui.mythic_greeks_favor_of_dionysus_top_deck_top_option',
                value: { choice: 'deck-top' },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'mythic_greeks_favor_of_dionysus_top',
            targetType: 'button',
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_greeks_favor_of_dionysus_top_title',
        },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const choice = value as { choice?: string; skip?: boolean };
        if (choice.skip || choice.choice !== 'deck-top') return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARD_TO_DECK_TOP,
                payload: {
                    cardUid: context.cardUid,
                    defId: context.defId,
                    ownerId: context.ownerId,
                    ...(context.ownerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                    reason: 'mythic_greeks_favor_of_dionysus',
                },
                timestamp,
            } as CardToDeckTopEvent],
        };
    },
});

function favorOfHera(ctx: AbilityContext): AbilityResult {
    const targets = allMinionTargets(ctx.state);
    return runGreekMinionPrompt(
        ctx,
        'mythic_greeks_favor_of_hera',
        '赫拉的恩惠：选择至多两个随从放置 +1 指示物',
        1,
        'counter',
        targets,
        { optional: true, maxSelections: Math.min(2, targets.length) },
    );
}

const athenaOrderPromptProgram = createPromptProgram<AthenaOrderContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_favor_of_athena_order',
    buildInteraction: (context) => {
        const title = context.ordered.length === 0
            ? '雅典娜的恩惠：选择放回牌库顶的第一张牌（最先选的在最上面）'
            : `雅典娜的恩惠：选择下一张放回牌库顶的牌（已选 ${context.ordered.length} 张）`;
        return createAbilityRuntimeSimpleChoice(
            `mythic_greeks_favor_of_athena_order_${context.now}_${context.ordered.length}`,
            context.playerId,
            title,
            buildAthenaCardOptions(context.remaining),
            { sourceId: 'mythic_greeks_favor_of_athena_order', targetType: 'generic' },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const choice = value as CardChoice;
        if (!choice.cardUid || !choice.defId) return { events: [] };
        const selected = context.remaining.find(card => card.uid === choice.cardUid && card.defId === choice.defId);
        if (!selected) return { events: [] };
        const ordered = [...context.ordered, selected];
        const remaining = context.remaining.filter(card => card.uid !== selected.uid);
        if (remaining.length <= 1) {
            const allCards = remaining.length === 1 ? [...ordered, remaining[0]] : ordered;
            const events: SmashUpEvent[] = [];
            for (let index = allCards.length - 1; index >= 0; index -= 1) {
                events.push({
                    type: SU_EVENTS.CARD_TO_DECK_TOP,
                    payload: {
                        cardUid: allCards[index].uid,
                        defId: allCards[index].defId,
                        ownerId: allCards[index].owner,
                        ...(allCards[index].owner !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                        reason: 'mythic_greeks_favor_of_athena',
                    },
                    timestamp,
                } as CardToDeckTopEvent);
            }
            return { events };
        }
        return {
            events: [],
            context: {
                ...context,
                now: timestamp,
                ordered,
                remaining,
            },
            nextProgram: athenaOrderPromptProgram,
        };
    },
});

const athenaPickPromptProgram = createPromptProgram<AthenaPickContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_favor_of_athena_pick',
    buildInteraction: (context) => {
        const actionCards = context.revealed.filter(card => card.type === 'action');
        return createAbilityRuntimeSimpleChoice(
            `mythic_greeks_favor_of_athena_pick_${context.now}`,
            context.playerId,
            '雅典娜的恩惠：你可以选择其中一张行动牌加入手牌',
            [
                createSkipOption('不加入手牌', 'ui.mythic_greeks_favor_of_athena_pick_skip_option'),
                ...buildAthenaCardOptions(actionCards),
            ],
            {
                sourceId: 'mythic_greeks_favor_of_athena_pick',
                targetType: 'generic',
                autoResolveIfSingle: false,
                titleKey: 'ui.mythic_greeks_favor_of_athena_pick_title',
            },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const choice = value as CardChoice;
        const actionCards = context.revealed.filter(card => card.type === 'action');
        const picked = choice.skip
            ? undefined
            : actionCards.find(card => card.uid === choice.cardUid && card.defId === choice.defId);
        const events: SmashUpEvent[] = [];
        if (picked) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: context.playerId, count: 1, cardUids: [picked.uid] },
                timestamp,
            } as SmashUpEvent);
        }

        const remaining = context.revealed
            .filter(card => card.uid !== picked?.uid)
            .map(card => ({ uid: card.uid, defId: card.defId, owner: card.owner }));
        if (remaining.length <= 1) return { events };
        return {
            events,
            context: {
                ...context,
                now: timestamp,
                remaining,
                ordered: [],
            } as AthenaOrderContext,
            nextProgram: athenaOrderPromptProgram,
        };
    },
});

function favorOfAthena(ctx: AbilityContext): AbilityResult {
    const result = buildAthenaRevealEvents(ctx.state, ctx.playerId, ctx.random, ctx.now);
    if (result.revealed.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }

    const hasAction = result.revealed.some(card => card.type === 'action');
    if (hasAction) {
        const promptResult = executeAbilityProgram(athenaPickPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            revealed: result.revealed,
        });
        return runtimeToAbilityResult({
            events: [...result.events, ...promptResult.events],
            matchState: promptResult.matchState,
        });
    }

    if (result.revealed.length <= 1) {
        return { events: result.events };
    }
    const promptResult = executeAbilityProgram(athenaOrderPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        remaining: result.revealed.map(card => ({ uid: card.uid, defId: card.defId, owner: card.owner })),
        ordered: [],
    });
    return runtimeToAbilityResult({
        events: [...result.events, ...promptResult.events],
        matchState: promptResult.matchState,
    });
}

function favorOfApollo(ctx: AbilityContext): AbilityResult {
    return { events: [...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now), grantContextualExtraAction(ctx, 'mythic_greeks_favor_of_apollo')] };
}

function favorOfHermes(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, 'mythic_greeks_favor_of_hermes'), grantContextualExtraAction(ctx, 'mythic_greeks_favor_of_hermes')] };
}

function favorOfPoseidon(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const cards = player.discard
        .filter(card => card.uid !== ctx.cardUid)
        .map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: getCardDef(card.defId)?.name ?? card.defId }));
    if (cards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(poseidonPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cards,
    }));
}

const poseidonPromptProgram = createPromptProgram<PoseidonContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mythic_greeks_favor_of_poseidon',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mythic_greeks_favor_of_poseidon_${context.now}`,
        context.playerId,
        '波塞冬的恩惠：选择至多 3 张弃牌洗回牌库',
        context.cards.map((card, index) => ({
            id: `card-${index}`,
            label: card.label,
            value: card,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'mythic_greeks_favor_of_poseidon',
            targetType: 'generic',
            multi: { min: 0, max: Math.min(3, context.cards.length) },
            autoResolveIfSingle: false,
            titleKey: 'ui.mythic_greeks_favor_of_poseidon_title',
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choices = (Array.isArray(value) ? value : []) as CardChoice[];
        const selectedUids = new Set(choices.map(choice => choice.cardUid).filter(Boolean));
        if (selectedUids.size === 0) return { events: [] };
        const player = state.core.players[context.playerId];
        const selectedCards = player.discard.filter(card => selectedUids.has(card.uid));
        const cardsByOwner = new Map<string, CardInstance[]>();
        for (const card of selectedCards) {
            const ownerCards = cardsByOwner.get(card.owner) ?? [];
            ownerCards.push(card);
            cardsByOwner.set(card.owner, ownerCards);
        }
        const events: DeckReorderedEvent[] = [];
        for (const [ownerId, cards] of cardsByOwner) {
            const owner = state.core.players[ownerId];
            if (!owner) continue;
            const shuffled = random.shuffle(cards);
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: [...shuffled.map(card => card.uid), ...owner.deck.map(card => card.uid)],
                    ...(ownerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                },
                timestamp,
            } as DeckReorderedEvent);
        }
        return { events };
    },
});

function favorOfZeus(ctx: AbilityContext): AbilityResult {
    return { events: [modifyBreakpoint(ctx.targetBaseIndex ?? ctx.baseIndex, -5, 'mythic_greeks_favor_of_zeus', ctx.now)] };
}

function heraclesActionTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    return [addTempPower(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'mythic_greeks_heracles', ctx.now)];
}

function odysseusActionTrigger(ctx: TriggerContext) {
    if (!ctx.matchState) return { events: [] };
    if (ctx.sourceControllerId !== ctx.playerId) return { events: [] };
    const targets = ownMinionTargets(ctx.state, ctx.playerId);
    if (targets.length === 0) return { events: [] };
    const abilityCtx: AbilityContext = { state: ctx.state, matchState: ctx.matchState, playerId: ctx.playerId, cardUid: ctx.sourceCardUid ?? '', defId: 'mythic_greeks_odysseus', baseIndex: ctx.sourceBaseIndex ?? 0, random: ctx.random, now: ctx.now };
    return runtimeToTriggerResult(executeAbilityProgram(greekMinionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'mythic_greeks_odysseus',
        title: '奥德修斯：选择你的一个随从放置 +1 指示物',
        targets,
        amount: 1,
        mode: 'counter',
    }), abilityCtx.matchState);
}

function spartanActionTrigger(ctx: TriggerContext) {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId !== ctx.playerId) return [];
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source) return [];
    if (Number(source.metadata?.mythicGreeksSpartanTriggeredTurn ?? -1) === ctx.state.turnNumber) return [];
    if (ctx.matchState) {
        return runtimeToTriggerResult(executeAbilityProgram(spartanCounterPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceUid: source.uid,
            sourceBaseIndex: ctx.sourceBaseIndex,
            sourceDefId: source.defId,
        }), ctx.matchState);
    }
    return [
        addPowerCounter(source.uid, ctx.sourceBaseIndex, 1, source.defId, ctx.now),
        metadataTurnUsed(source.uid, ctx.sourceBaseIndex, 'mythicGreeksSpartanTriggeredTurn', ctx.state.turnNumber, ctx.now),
    ];
}

function jasonActionTrigger(ctx: TriggerContext) {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId !== ctx.playerId) return { events: [] };
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source || Number(source.metadata?.mythicGreeksJasonTriggeredTurn ?? -1) === ctx.state.turnNumber) return { events: [] };
    const bases = collectBaseTargets(ctx.state, baseIndex => ctx.state.bases[baseIndex].minions.some(minion => minion.controller === ctx.playerId));
    if (bases.length === 0) return { events: [] };
    return runtimeToTriggerResult(executeAbilityProgram(greekBasePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceUid: source.uid,
        sourceBaseIndex: ctx.sourceBaseIndex,
        sourceDefId: 'mythic_greeks_jason',
        bases,
    }), ctx.matchState);
}

function argonautOnPlay(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    let hasOwnOdysseus = false;
    let jasonSource: { uid: string; baseIndex: number } | undefined;
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        for (const minion of ctx.state.bases[baseIndex].minions) {
            if (minion.controller !== ctx.playerId) continue;
            if (isMythicGreeksDefId(minion.defId, 'mythic_greeks_odysseus')) {
                hasOwnOdysseus = true;
            }
            if (
                isMythicGreeksDefId(minion.defId, 'mythic_greeks_jason')
                && Number(minion.metadata?.mythicGreeksJasonTriggeredTurn ?? -1) !== ctx.state.turnNumber
            ) {
                jasonSource = { uid: minion.uid, baseIndex };
            }
            if (isMythicGreeksDefId(minion.defId, 'mythic_greeks_heracles')) {
                events.push(addTempPower(minion.uid, baseIndex, 1, 'mythic_greeks_argonaut_heracles', ctx.now));
            }
            if (
                isMythicGreeksDefId(minion.defId, 'mythic_greeks_spartan')
                && Number(minion.metadata?.mythicGreeksSpartanTriggeredTurn ?? -1) !== ctx.state.turnNumber
            ) {
                events.push(addPowerCounter(minion.uid, baseIndex, 1, 'mythic_greeks_argonaut_spartan', ctx.now));
                events.push(metadataTurnUsed(minion.uid, baseIndex, 'mythicGreeksSpartanTriggeredTurn', ctx.state.turnNumber, ctx.now));
            }
        }
    }
    const jasonBases = jasonSource
        ? collectBaseTargets(ctx.state, baseIndex => ctx.state.bases[baseIndex].minions.some(minion => minion.controller === ctx.playerId))
        : [];
    const nextBasePrompt = jasonSource && jasonBases.length > 0
        ? {
            sourceUid: jasonSource.uid,
            sourceBaseIndex: jasonSource.baseIndex,
            sourceDefId: 'mythic_greeks_jason',
            bases: jasonBases,
        }
        : undefined;
    if (!hasOwnOdysseus) {
        if (!nextBasePrompt) return { events };
        const jasonPrompt = executeAbilityProgram(greekBasePromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            ...nextBasePrompt,
        });
        return runtimeToAbilityResult({
            events: [...events, ...jasonPrompt.events],
            matchState: jasonPrompt.matchState,
        });
    }

    const targets = ownMinionTargets(ctx.state, ctx.playerId);
    if (targets.length === 0) {
        if (!nextBasePrompt) return { events };
        const jasonPrompt = executeAbilityProgram(greekBasePromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            ...nextBasePrompt,
        });
        return runtimeToAbilityResult({
            events: [...events, ...jasonPrompt.events],
            matchState: jasonPrompt.matchState,
        });
    }
    const odysseusPrompt = executeAbilityProgram(greekMinionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'mythic_greeks_argonaut_odysseus',
        title: '阿尔戈英雄：触发奥德修斯，选择你的一个随从放置 +1 指示物',
        targets,
        amount: 1,
        mode: 'counter',
        ...(nextBasePrompt ? { nextBasePrompt } : {}),
    });
    return {
        events,
        ...(odysseusPrompt.matchState ? { matchState: odysseusPrompt.matchState } : {}),
    };
}

function oracleAtDelphi(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.random) return { events: [] };
    const peek = peekDeckTop(ctx.state, ctx.random, ctx.playerId, 'all', 'base_oracle_at_delphi', ctx.now, ctx.playerId);
    if (!peek) return { events: [] };
    if (peek.card.type !== 'action') return { events: peek.events };
    return {
        events: [
            ...peek.events,
            {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: 1, cardUids: [peek.card.uid] },
                timestamp: ctx.now,
            } as SmashUpEvent,
        ],
    };
}

function woodenHorse(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const targets = collectMinionTargets(ctx.state, (_minion, baseIndex) => baseIndex === ctx.baseIndex);
    if (targets.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(greekMinionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_wooden_horse',
        title: '特洛伊木马：你可以选择这里一个随从 +2 到回合结束',
        targets,
        amount: 2,
        mode: 'temp',
        optional: true,
    }));
}

function isMythicGreeksDefId(defId: string, baseDefId: string): boolean {
    return defId === baseDefId || defId === `${baseDefId}_pod`;
}

export function registerMythicGreeksAbilities(): void {
    registerSimpleAbility('mythic_greeks_argonaut', 'onPlay', argonautOnPlay);
    registerSimpleAbility('mythic_greeks_argonaut_pod', 'onPlay', argonautOnPlay);
    registerSimpleAbility('mythic_greeks_favor_of_hades', 'onPlay', favorOfHades);
    registerSimpleAbility('mythic_greeks_favor_of_hades_pod', 'onPlay', favorOfHades);
    registerSimpleAbility('mythic_greeks_favor_of_ares', 'onPlay', favorOfAres);
    registerSimpleAbility('mythic_greeks_favor_of_ares_pod', 'onPlay', favorOfAres);
    registerSimpleAbility('mythic_greeks_favor_of_aphrodite', 'onPlay', favorOfAphrodite);
    registerSimpleAbility('mythic_greeks_favor_of_aphrodite_pod', 'onPlay', favorOfAphrodite);
    registerSimpleAbility('mythic_greeks_favor_of_dionysus', 'onPlay', favorOfDionysus);
    registerSimpleAbility('mythic_greeks_favor_of_dionysus_pod', 'onPlay', favorOfDionysus);
    registerSimpleAbility('mythic_greeks_favor_of_hera', 'onPlay', favorOfHera);
    registerSimpleAbility('mythic_greeks_favor_of_hera_pod', 'onPlay', favorOfHera);
    registerSimpleAbility('mythic_greeks_favor_of_athena', 'onPlay', favorOfAthena);
    registerSimpleAbility('mythic_greeks_favor_of_athena_pod', 'onPlay', favorOfAthena);
    registerSimpleAbility('mythic_greeks_favor_of_apollo', 'onPlay', favorOfApollo);
    registerSimpleAbility('mythic_greeks_favor_of_apollo_pod', 'onPlay', favorOfApollo);
    registerSimpleAbility('mythic_greeks_favor_of_hermes', 'onPlay', favorOfHermes);
    registerSimpleAbility('mythic_greeks_favor_of_hermes_pod', 'onPlay', favorOfHermes);
    registerSimpleAbility('mythic_greeks_favor_of_poseidon', 'onPlay', favorOfPoseidon);
    registerSimpleAbility('mythic_greeks_favor_of_poseidon_pod', 'onPlay', favorOfPoseidon);
    registerSimpleAbility('mythic_greeks_favor_of_zeus', 'onPlay', favorOfZeus);
    registerSimpleAbility('mythic_greeks_favor_of_zeus_pod', 'onPlay', favorOfZeus);
    registerTrigger('mythic_greeks_odysseus', 'onActionPlayed', odysseusActionTrigger, { perInstance: true, playerContext: 'sourceController', effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('mythic_greeks_odysseus_pod', 'onActionPlayed', odysseusActionTrigger, { perInstance: true, playerContext: 'sourceController', effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('mythic_greeks_heracles', 'onActionPlayed', heraclesActionTrigger, { perInstance: true, playerContext: 'sourceController', effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('mythic_greeks_heracles_pod', 'onActionPlayed', heraclesActionTrigger, { perInstance: true, playerContext: 'sourceController', effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('mythic_greeks_spartan', 'onActionPlayed', spartanActionTrigger, { perInstance: true, playerContext: 'sourceController', effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('mythic_greeks_spartan_pod', 'onActionPlayed', spartanActionTrigger, { perInstance: true, playerContext: 'sourceController', effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('mythic_greeks_jason', 'onActionPlayed', jasonActionTrigger, { perInstance: true, playerContext: 'sourceController', effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('mythic_greeks_jason_pod', 'onActionPlayed', jasonActionTrigger, { perInstance: true, playerContext: 'sourceController', effectContract: SHAYU_TRIGGER_CONTRACT });
    registerBaseAbility('base_oracle_at_delphi', 'onMinionPlayed', oracleAtDelphi, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerBaseAbility('base_wooden_horse', 'onActionPlayed', woodenHorse, { effectContract: SHAYU_TRIGGER_CONTRACT });
}
