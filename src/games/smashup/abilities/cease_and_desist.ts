import type { MatchState, PlayerId } from '../../../engine/types';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    applySemanticMinionEffectBatch,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    createSkipOption,
    findMinionByAttachedCard,
    findMinionOnBases,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    revealDeckTop,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import {
    getActionControllerId,
    registerCustomPowerModifiers,
    registerOngoingPowerModifier,
    registerPowerModifier,
} from '../domain/ongoingModifiers';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef, getMinionDef } from '../data/cards';
import { reduce } from '../domain/reduce';
import { matchesDefId } from '../domain/utils';
import type {
    CardInstance,
    CardsDrawnEvent,
    DeckReorderedEvent,
    MinionControlChangedEvent,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
    BaseReplacedEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type RuntimeResult = ReturnType<typeof executeAbilityProgram<any, SmashUpCore, SmashUpEvent>>;
type MinionChoice = { minionUid: string; minionDefId?: string; defId?: string; baseIndex: number };
type BaseChoice = { baseIndex: number; baseDefId?: string };
type ActionChoice = { cardUid: string; defId: string; ownerId?: PlayerId; baseIndex?: number; hostMinionUid?: string };
type ReturnReplacementChoice = { replace?: boolean; skip?: boolean };
type PlayerChoice = { playerId?: PlayerId; skip?: boolean };
type BaseAbilityPromptContext<T extends Record<string, unknown> = Record<string, never>> = PromptContext<T & { sourceId: string }>;

type PromptContext<T extends Record<string, unknown> = Record<string, never>> = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
} & T;

function runtimeToAbilityResult(result: RuntimeResult): AbilityResult {
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function applyPreview(matchState: MatchState<SmashUpCore>, events: SmashUpEvent[]): MatchState<SmashUpCore> {
    if (events.length === 0) return matchState;
    return {
        ...matchState,
        core: events.reduce((core, event) => reduce(core, event), matchState.core),
    };
}

function isSkip(value: unknown): boolean {
    return !!value && typeof value === 'object' && (value as { skip?: unknown }).skip === true;
}

function getAllMinionCandidates(
    state: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    return state.bases.flatMap((base, baseIndex) =>
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

function ownMinionsAtBase(state: SmashUpCore, playerId: PlayerId, baseIndex: number): MinionOnBase[] {
    return state.bases[baseIndex]?.minions.filter(minion => minion.controller === playerId) ?? [];
}

function actionController(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return getActionControllerId(action);
}

function controlChangeEvent(params: {
    minion: MinionOnBase;
    baseIndex: number;
    toControllerId: PlayerId;
    sourcePlayerId: PlayerId;
    sourceDefId: string;
    reason: string;
    now: number;
}): MinionControlChangedEvent {
    return {
        type: SU_EVENTS.MINION_CONTROL_CHANGED,
        payload: {
            minionUid: params.minion.uid,
            minionDefId: params.minion.defId,
            baseIndex: params.baseIndex,
            ownerId: params.minion.owner,
            fromControllerId: params.minion.controller,
            toControllerId: params.toControllerId,
            sourcePlayerId: params.sourcePlayerId,
            sourceControllerId: params.sourcePlayerId,
            sourceBaseIndex: params.baseIndex,
            sourceDefId: params.sourceDefId,
            reason: params.reason,
        },
        timestamp: params.now,
    };
}

function findAnotherPlayer(state: SmashUpCore, playerId: PlayerId): PlayerId | undefined {
    return state.turnOrder.find(candidate => candidate !== playerId)
        ?? Object.keys(state.players).find(candidate => candidate !== playerId);
}

function firstOtherBaseIndex(state: SmashUpCore, fromBaseIndex: number): number | undefined {
    return state.bases.findIndex((_base, index) => index !== fromBaseIndex);
}

function findLiveActionAtBase(
    state: SmashUpCore,
    baseIndex: number,
    cardUid: string,
): ActionChoice | undefined {
    const base = state.bases[baseIndex];
    if (!base) return undefined;
    const baseAction = base.ongoingActions.find(action => action.uid === cardUid);
    if (baseAction) {
        return { cardUid: baseAction.uid, defId: baseAction.defId, ownerId: baseAction.ownerId, baseIndex };
    }
    for (const minion of base.minions) {
        const attached = minion.attachedActions.find(action => action.uid === cardUid);
        if (attached) {
            return {
                cardUid: attached.uid,
                defId: attached.defId,
                ownerId: attached.ownerId,
                baseIndex,
                hostMinionUid: minion.uid,
            };
        }
    }
    return undefined;
}

function detachActionEvent(action: ActionChoice, reason: string, playerId: PlayerId, now: number): SmashUpEvent[] {
    if (!action.ownerId) return [];
    return [buildOngoingDetachedEvent({
        cardUid: action.cardUid,
        defId: action.defId,
        ownerId: action.ownerId,
        reason,
        destination: 'discard',
        sourcePlayerId: playerId,
        sourceControllerId: playerId,
        sourceBaseIndex: action.baseIndex,
        sourceDefId: reason,
        now,
    })];
}

const chooseAnyMinionPowerPrompt = createPromptProgram<
    PromptContext<{ sourceId: string; amount: number; candidates: ReturnType<typeof getAllMinionCandidates> }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'cease_and_desist_choose_any_minion_power',
    interactionSourceIds: [
        'astroknights_block_the_probe',
        'astroknights_use_the_fours',
        'astroknights_yield_to_rage',
        'changerbots_leader_two',
    ],
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.sourceId,
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceId,
            sourceKind: 'action',
            effectType: 'power_change',
            respectActionProtection: true,
        }),
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        const live = selected?.minionUid ? findMinionOnBases(state.core, selected.minionUid) : undefined;
        if (!live) return { events: [] };
        const result = applySemanticMinionEffectBatch(state.core, [{ minion: live.minion, baseIndex: live.baseIndex }], {
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceId,
            sourceKind: 'action',
            effectType: 'power_change',
            respectActionProtection: true,
            now: timestamp,
            feedbackPlayerId: context.playerId,
            buildEvents: candidate => [
                addTempPower(candidate.minion.uid, candidate.baseIndex, context.amount, context.sourceId, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: candidate.baseIndex,
                }),
            ],
        });
        return { events: result.events };
    },
});

function promptForPower(ctx: AbilityContext, sourceId: string, amount: number, selfOnly: boolean): AbilityResult {
    const candidates = getAllMinionCandidates(ctx.state, minion =>
        !selfOnly || minion.controller === ctx.playerId);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(chooseAnyMinionPowerPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        amount,
        candidates,
    }));
}

function blockTheProbe(ctx: AbilityContext): AbilityResult {
    return promptForPower(ctx, 'astroknights_block_the_probe', 2, false);
}

function useTheFours(ctx: AbilityContext): AbilityResult {
    return promptForPower(ctx, 'astroknights_use_the_fours', 4, true);
}

function yieldToRage(ctx: AbilityContext): AbilityResult {
    const result = applyTheFoursLike(ctx, 'astroknights_yield_to_rage', 2);
    return {
        events: [
            ...result.events,
            grantContextualExtraAction(ctx, 'astroknights_yield_to_rage'),
        ],
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function applyTheFoursLike(ctx: AbilityContext, sourceId: string, amount: number): AbilityResult {
    if (ctx.targetMinionUid) {
        const target = findMinionOnBases(ctx.state, ctx.targetMinionUid);
        if (!target || target.minion.controller !== ctx.playerId) return { events: [] };
        return {
            events: [addTempPower(target.minion.uid, target.baseIndex, amount, sourceId, ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: sourceId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: target.baseIndex,
            })],
        };
    }
    return promptForPower(ctx, sourceId, amount, true);
}

function recycleTheTrash(ctx: AbilityContext): AbilityResult {
    const actions = (ctx.state.players[ctx.playerId]?.discard ?? []).filter(card => card.type === 'action').slice(0, 2);
    if (actions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    return {
        events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ctx.playerId,
                deckUids: ctx.random.shuffle([...ctx.state.players[ctx.playerId].deck, ...actions]).map(card => card.uid),
            },
            timestamp: ctx.now,
        } as DeckReorderedEvent],
    };
}

const prepareForBattlePrompt = createPromptProgram<
    PromptContext<{ topCards: Array<{ cardUid: string; defId: string }>; selected: string[] }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'astroknights_prepare_for_battle',
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `astroknights_prepare_for_battle_${context.now}_${context.selected.length}`,
        context.playerId,
        '战斗准备：选择要加入手牌的牌',
        context.topCards
            .filter(card => !context.selected.includes(card.cardUid))
            .map(card => ({
                id: card.cardUid,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: card,
                _source: 'hand' as const,
            })),
        {
            sourceId: 'astroknights_prepare_for_battle',
            targetType: 'generic',
            titleKey: 'ui.astroknights_prepare_for_battle_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as { cardUid?: string } | undefined;
        if (!choice?.cardUid || !context.topCards.some(card => card.cardUid === choice.cardUid)) return { events: [] };
        const selected = [...context.selected, choice.cardUid];
        if (selected.length < Math.min(2, context.topCards.length)) {
            return {
                events: [],
                context: { ...context, matchState: state, selected },
                nextProgram: prepareForBattlePrompt,
            };
        }
        const selectedSet = new Set(selected);
        const tracked = new Set(context.topCards.map(card => card.cardUid));
        const liveDeck = state.core.players[context.playerId]?.deck ?? [];
        const middle = liveDeck.filter(card => !tracked.has(card.uid));
        const unselected = context.topCards
            .filter(card => !selectedSet.has(card.cardUid))
            .map(card => liveDeck.find(candidate => candidate.uid === card.cardUid))
            .filter((card): card is CardInstance => !!card);
        return {
            events: [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: context.playerId, count: selected.length, cardUids: selected },
                timestamp,
            } as CardsDrawnEvent, {
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: context.playerId,
                    deckUids: [...unselected.map(card => card.uid), ...middle.map(card => card.uid)],
                },
                timestamp,
            } as DeckReorderedEvent],
        };
    },
});

function prepareForBattle(ctx: AbilityContext): AbilityResult {
    const topCards = (ctx.state.players[ctx.playerId]?.deck ?? [])
        .slice(0, 3)
        .map(card => ({ cardUid: card.uid, defId: card.defId }));
    if (topCards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    const inspect = inspectDeck(ctx.playerId, ctx.playerId, topCards.length, 'astroknights_prepare_for_battle', ctx.now);
    if (topCards.length <= 2) {
        return {
            events: [
                inspect,
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId: ctx.playerId, count: topCards.length, cardUids: topCards.map(card => card.cardUid) },
                    timestamp: ctx.now,
                } as CardsDrawnEvent,
            ],
        };
    }
    const prompt = executeAbilityProgram(prepareForBattlePrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        topCards,
        selected: [],
    });
    return {
        events: [inspect, ...prompt.events],
        ...(prompt.matchState ? { matchState: prompt.matchState } : {}),
    };
}

function mannersbot(ctx: AbilityContext): AbilityResult {
    const top = ctx.state.players[ctx.playerId]?.deck[0];
    if (!top) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    const events: SmashUpEvent[] = [
        revealDeckTop(ctx.playerId, ctx.playerId, [{ uid: top.uid, defId: top.defId }], 1, 'astroknights_mannersbot', ctx.now, ctx.playerId),
    ];
    if (top.type === 'action') {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [top.uid] },
            timestamp: ctx.now,
        } as CardsDrawnEvent);
    }
    return { events };
}

const pickActionFromTopThreePrompt = createPromptProgram<
    PromptContext<{ sourceId: string; topCards: Array<{ cardUid: string; defId: string }> }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'cease_and_desist_pick_action_from_top_three',
    interactionSourceIds: ['astroknights_space_knight', 'astroknights_its_a_trap'],
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.sourceId,
        [
            createSkipOption(),
            ...context.topCards.map(card => ({
                id: card.cardUid,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: card,
                _source: 'hand' as const,
            })),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'generic',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        if (isSkip(value)) return { events: [] };
        const choice = value as { cardUid?: string } | undefined;
        if (!choice?.cardUid || !context.topCards.some(card => card.cardUid === choice.cardUid)) return { events: [] };
        const liveDeck = state.core.players[context.playerId]?.deck ?? [];
        const tracked = new Set(context.topCards.map(card => card.cardUid));
        return {
            events: [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: context.playerId, count: 1, cardUids: [choice.cardUid] },
                timestamp,
            } as CardsDrawnEvent, {
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: context.playerId,
                    deckUids: [
                        ...liveDeck.filter(card => tracked.has(card.uid) && card.uid !== choice.cardUid).map(card => card.uid),
                        ...liveDeck.filter(card => !tracked.has(card.uid)).map(card => card.uid),
                    ],
                },
                timestamp,
            } as DeckReorderedEvent],
        };
    },
});

function spaceKnight(ctx: AbilityContext): AbilityResult {
    const top = (ctx.state.players[ctx.playerId]?.deck ?? []).slice(0, 3);
    const actions = top.filter(card => card.type === 'action').map(card => ({ cardUid: card.uid, defId: card.defId }));
    const inspect = inspectDeck(ctx.playerId, ctx.playerId, top.length, 'astroknights_space_knight', ctx.now);
    if (actions.length === 0) return { events: [inspect] };
    const prompt = executeAbilityProgram(pickActionFromTopThreePrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'astroknights_space_knight',
        topCards: actions,
    });
    return {
        events: [inspect, ...prompt.events],
        ...(prompt.matchState ? { matchState: prompt.matchState } : {}),
    };
}

function itsATrap(ctx: AbilityContext): AbilityResult {
    const deck = ctx.state.players[ctx.playerId]?.deck ?? [];
    const revealed = deck.slice(0, Math.max(1, deck.findIndex(card => card.type === 'action') + 1 || deck.length));
    const action = revealed.find(card => card.type === 'action');
    if (!action) return { events: [inspectDeck(ctx.playerId, ctx.playerId, deck.length, 'astroknights_its_a_trap', ctx.now)] };
    const prompt = executeAbilityProgram(pickActionFromTopThreePrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'astroknights_its_a_trap',
        topCards: [{ cardUid: action.uid, defId: action.defId }],
    });
    return {
        events: [
            revealDeckTop(ctx.playerId, 'all', revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, 'astroknights_its_a_trap', ctx.now, ctx.playerId),
            ...prompt.events,
        ],
        ...(prompt.matchState ? { matchState: prompt.matchState } : {}),
    };
}

function pupoks(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.vp <= 0) return { events: [] };
    const top = player.deck.slice(0, 3);
    const events: SmashUpEvent[] = [{
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.playerId, amount: -1, reason: 'astroknights_pupoks' },
        timestamp: ctx.now,
    } as SmashUpEvent];
    events.push(...buildStandardDrawEvents(ctx.state, ctx.playerId, top.length, ctx.random, ctx.now));
    events.push(grantContextualExtraMinion(ctx, 'astroknights_pupoks'));
    events.push(grantContextualExtraAction(ctx, 'astroknights_pupoks'));
    return { events };
}

const scoundrelChooseBasePrompt = createPromptProgram<
    PromptContext<{
        sourceBaseIndex: number;
        sourceMinionUid: string;
        sourceMinionDefId: string;
        companionUid: string;
        companionDefId: string;
    }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'astroknights_scoundrel_choose_base',
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `astroknights_scoundrel_choose_base_${context.sourceMinionUid}_${context.companionUid}_${context.now}`,
        context.playerId,
        '恶棍：选择移动到的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, baseIndex) => ({
                    baseIndex,
                    label: getCardDef(base.defId)?.name ?? base.defId,
                }))
                .filter(base => base.baseIndex !== context.sourceBaseIndex),
            context.matchState.core,
        ),
        {
            sourceId: 'astroknights_scoundrel_choose_base',
            targetType: 'base',
            titleKey: 'ui.astroknights_scoundrel_choose_base_title',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const destinationBaseIndex = (value as BaseChoice | undefined)?.baseIndex;
        if (
            destinationBaseIndex === undefined
            || destinationBaseIndex === context.sourceBaseIndex
            || !state.core.bases[destinationBaseIndex]
        ) {
            return { events: [] };
        }

        const sourceBase = state.core.bases[context.sourceBaseIndex];
        const self = sourceBase?.minions.find(minion =>
            minion.uid === context.sourceMinionUid
            && minion.controller === context.playerId);
        const companion = sourceBase?.minions.find(minion =>
            minion.uid === context.companionUid
            && minion.controller === context.playerId);
        if (!self || !companion) return { events: [] };

        return {
            events: [
                ...buildValidatedMoveEvents(state.core, {
                    minionUid: self.uid,
                    minionDefId: self.defId,
                    fromBaseIndex: context.sourceBaseIndex,
                    toBaseIndex: destinationBaseIndex,
                    reason: 'astroknights_scoundrel',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'astroknights_scoundrel',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                    sourceKind: 'nonAction',
                }),
                ...buildValidatedMoveEvents(state.core, {
                    minionUid: companion.uid,
                    minionDefId: companion.defId,
                    fromBaseIndex: context.sourceBaseIndex,
                    toBaseIndex: destinationBaseIndex,
                    reason: 'astroknights_scoundrel',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'astroknights_scoundrel',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                    sourceKind: 'nonAction',
                }),
            ],
        };
    },
});

const scoundrelChooseMinionPrompt = createPromptProgram<
    PromptContext<{
        sourceBaseIndex: number;
        sourceMinionUid: string;
        sourceMinionDefId: string;
        candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'astroknights_scoundrel_choose_minion',
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `astroknights_scoundrel_choose_minion_${context.sourceMinionUid}_${context.now}`,
        context.playerId,
        '恶棍：选择这里你的另一个随从',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'astroknights_scoundrel',
            sourceKind: 'nonAction',
            effectType: 'move',
        }),
        {
            sourceId: 'astroknights_scoundrel_choose_minion',
            targetType: 'minion',
            titleKey: 'ui.astroknights_scoundrel_choose_minion_title',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || !context.candidates.some(candidate => candidate.uid === selected.minionUid)) {
            return { events: [] };
        }

        const sourceBase = state.core.bases[context.sourceBaseIndex];
        const self = sourceBase?.minions.find(minion =>
            minion.uid === context.sourceMinionUid
            && minion.controller === context.playerId);
        const companion = sourceBase?.minions.find(minion =>
            minion.uid === selected.minionUid
            && minion.uid !== context.sourceMinionUid
            && minion.controller === context.playerId);
        if (!self || !companion) return { events: [] };

        return {
            events: [],
            context: {
                ...context,
                matchState: state,
                companionUid: companion.uid,
                companionDefId: companion.defId,
            },
            nextProgram: scoundrelChooseBasePrompt,
        };
    },
});

function scoundrel(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || ctx.state.bases.length <= 1) return { events: [] };
    const self = base.minions.find(minion => minion.uid === ctx.cardUid && minion.controller === ctx.playerId);
    if (!self) return { events: [] };

    const candidates = base.minions
        .filter(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: getMinionDef(minion.defId)?.name ?? minion.defId,
        }));
    if (candidates.length === 0) return { events: [] };

    return runtimeToAbilityResult(executeAbilityProgram(scoundrelChooseMinionPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceBaseIndex: ctx.baseIndex,
        sourceMinionUid: self.uid,
        sourceMinionDefId: self.defId,
        candidates,
    }));
}

const astroRobotPrompt = createPromptProgram<
    PromptContext<{ baseIndex: number; actions: ActionChoice[] }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'astroknights_astro_robot',
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `astroknights_astro_robot_${context.now}`,
        context.playerId,
        '宇航机器人：你可以消灭一个行动',
        [
            createSkipOption(),
            ...context.actions.map(action => ({
                id: action.cardUid,
                label: getCardDef(action.defId)?.name ?? action.defId,
                value: action,
                _source: action.hostMinionUid ? 'field' as const : 'base' as const,
            })),
        ],
        {
            sourceId: 'astroknights_astro_robot',
            targetType: 'generic',
            titleKey: 'ui.astroknights_astro_robot_title',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        if (isSkip(value)) return { events: [] };
        const selected = value as ActionChoice | undefined;
        const live = selected?.cardUid ? findLiveActionAtBase(state.core, context.baseIndex, selected.cardUid) : undefined;
        return { events: live ? detachActionEvent(live, 'astroknights_astro_robot', context.playerId, timestamp) : [] };
    },
});

function astroRobot(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const actions: ActionChoice[] = [
        ...base.ongoingActions.map(action => ({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            baseIndex: ctx.baseIndex,
        })),
        ...base.minions.flatMap(minion => minion.attachedActions.map(action => ({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            baseIndex: ctx.baseIndex,
            hostMinionUid: minion.uid,
        }))),
    ];
    if (actions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(astroRobotPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        actions,
    }));
}

function annoyingAlien(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const source = base?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!base || !source) return { events: [] };
    const name = base.minions.find(minion => minion.uid !== source.uid)?.defId;
    if (!name) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.defId === name)
            .map(minion => addTempPower(minion.uid, ctx.baseIndex, -2, 'astroknights_annoying_alien', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'astroknights_annoying_alien',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            })),
    };
}

function walkingCarpet(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, 'astroknights_walking_carpet', { restrictToCardDefId: 'astroknights_block_the_probe' })] };
}

function hiddenBaseOnTurnStart(ctx: any): SmashUpEvent[] {
    const baseIndex = ctx.sourceBaseIndex as number | undefined;
    const playerId = ctx.sourceControllerId as PlayerId | undefined;
    if (baseIndex === undefined || !playerId) return [];
    const base = ctx.state.bases[baseIndex];
    if (!base?.minions.some((minion: MinionOnBase) => minion.controller === playerId)) return [];
    return buildStandardDrawEvents(ctx.state, playerId, 1, ctx.random, ctx.now);
}

function alienGuruOnActionPlayed(ctx: any): SmashUpEvent[] {
    if (ctx.actionTargetType !== 'minion' || !ctx.actionTargetMinionUid) return [];
    const sourceControllerId = ctx.sourceControllerId as PlayerId | undefined;
    if (!sourceControllerId || sourceControllerId !== ctx.playerId) return [];
    const sourceDefId = ctx.triggerCardDefId as string | undefined;
    if (!sourceDefId || !DIRECT_POWER_ACTIONS.has(sourceDefId)) return [];
    const target = findMinionOnBases(ctx.state, ctx.actionTargetMinionUid);
    if (!target) return [];
    return [addPowerCounter(target.minion.uid, target.baseIndex, 1, 'astroknights_alien_guru', ctx.now, {
        sourcePlayerId: sourceControllerId,
        sourceDefId: 'astroknights_alien_guru',
        sourceControllerId,
        sourceBaseIndex: target.baseIndex,
    })];
}

const DIRECT_POWER_ACTIONS = new Set([
    'astroknights_block_the_probe',
    'astroknights_laser_sword',
    'astroknights_use_the_fours',
    'astroknights_yield_to_rage',
    'changerbots_cesium_armor',
    'changerbots_form_mergacon',
    'changerbots_matrix_of_bossiness',
]);

const giveControlPrompt = createPromptProgram<
    PromptContext<{ sourceId: string; minionUid: string; baseIndex: number; afterGive: 'draw2_extra_minion' | 'draw1_extra_action' | 'extra_minion' | 'none' }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'ignobles_give_control',
    interactionSourceIds: ['ignobles_repaying_debts', 'ignobles_aunt_of_drakes', 'ignobles_sneaky_squire', 'ignobles_betrothed'],
    buildInteraction: context => {
        const options = Object.keys(context.matchState.core.players)
            .filter(playerId => playerId !== context.playerId)
            .map(playerId => ({
                id: playerId,
                label: playerId,
                value: { playerId },
                _source: 'player' as const,
            }));
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            context.sourceId,
            [createSkipOption(), ...options],
            {
                sourceId: context.sourceId,
                targetType: 'generic',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        if (isSkip(value)) return { events: [] };
        const targetPlayerId = (value as { playerId?: PlayerId } | undefined)?.playerId;
        const minion = state.core.bases[context.baseIndex]?.minions.find(candidate => candidate.uid === context.minionUid);
        if (!targetPlayerId || !minion || minion.controller !== context.playerId) return { events: [] };
        const control = controlChangeEvent({
            minion,
            baseIndex: context.baseIndex,
            toControllerId: targetPlayerId,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceId,
            reason: context.sourceId,
            now: timestamp,
        });
        const preview = applyPreview(state, [control]);
        const events: SmashUpEvent[] = [control];
        if (context.afterGive === 'draw2_extra_minion') {
            events.push(...buildStandardDrawEventsFromRuntimeContext({ ...args, state: preview }, context.playerId, 2));
            events.push(grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: preview }, context.sourceId));
        }
        if (context.afterGive === 'draw1_extra_action') {
            events.push(...buildStandardDrawEventsFromRuntimeContext({ ...args, state: preview }, context.playerId, 1));
            events.push(grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: preview }, context.sourceId));
        }
        if (context.afterGive === 'extra_minion') {
            events.push(grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: preview }, context.sourceId));
        }
        return { events };
    },
});

function giveControlAbility(ctx: AbilityContext, sourceId: string, afterGive: 'draw2_extra_minion' | 'draw1_extra_action' | 'extra_minion' | 'none'): AbilityResult {
    const target = ctx.targetMinionUid
        ? findMinionOnBases(ctx.state, ctx.targetMinionUid)
        : undefined;
    const selected = target ?? ctx.state.bases
        .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
        .find(candidate => candidate.minion.controller === ctx.playerId);
    if (!selected || selected.minion.controller !== ctx.playerId) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(giveControlPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        minionUid: selected.minion.uid,
        baseIndex: selected.baseIndex,
        afterGive,
    }));
}

function repayingDebts(ctx: AbilityContext): AbilityResult {
    return giveControlAbility(ctx, 'ignobles_repaying_debts', 'draw2_extra_minion');
}

function auntOfDrakes(ctx: AbilityContext): AbilityResult {
    return giveControlAbility(ctx, 'ignobles_aunt_of_drakes', 'draw1_extra_action');
}

function sneakySquire(ctx: AbilityContext): AbilityResult {
    return giveControlAbility(ctx, 'ignobles_sneaky_squire', 'extra_minion');
}

function betrothed(ctx: AbilityContext): AbilityResult {
    return giveControlAbility(ctx, 'ignobles_betrothed', 'none');
}

function takeControlOwned(ctx: AbilityContext, sourceId: string, baseOnly = false): AbilityResult {
    const candidates = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.owner === ctx.playerId && minion.controller !== ctx.playerId && (!baseOnly || baseIndex === ctx.baseIndex))
            .map(minion => ({ minion, baseIndex })),
    );
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    const target = candidates[0];
    return {
        events: [controlChangeEvent({
            minion: target.minion,
            baseIndex: target.baseIndex,
            toControllerId: ctx.playerId,
            sourcePlayerId: ctx.playerId,
            sourceDefId: sourceId,
            reason: sourceId,
            now: ctx.now,
        })],
    };
}

function activateTheSpy(ctx: AbilityContext): AbilityResult {
    const take = takeControlOwned(ctx, 'ignobles_activate_the_spy');
    return { events: [...take.events, grantContextualExtraAction(ctx, 'ignobles_activate_the_spy')] };
}

function bannerCall(ctx: AbilityContext): AbilityResult {
    const events = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.owner === ctx.playerId && minion.controller !== ctx.playerId)
            .map(minion => controlChangeEvent({
                minion,
                baseIndex,
                toControllerId: ctx.playerId,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'ignobles_banner_call',
                reason: 'ignobles_banner_call',
                now: ctx.now,
            })),
    );
    return { events };
}

function inevitableBetrayal(ctx: AbilityContext): AbilityResult {
    return takeControlOwned(ctx, 'ignobles_inevitable_betrayal', true);
}

function fateOfTheFavorites(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const playerId of Object.keys(ctx.state.players)) {
        const owned = ctx.state.bases
            .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
            .find(candidate => candidate.minion.owner === playerId);
        if (!owned) continue;
        events.push(...buildValidatedDestroyEvents(ctx.state, {
            minionUid: owned.minion.uid,
            minionDefId: owned.minion.defId,
            fromBaseIndex: owned.baseIndex,
            destroyerId: ctx.playerId,
            reason: 'ignobles_fate_of_the_favorites',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'ignobles_fate_of_the_favorites',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: owned.baseIndex,
            sourceKind: 'action',
        }));
    }
    return { events };
}

function outOfSight(ctx: AbilityContext): AbilityResult {
    return {
        events: Object.keys(ctx.state.players).flatMap(playerId => {
            const owned = ctx.state.bases
                .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
                .find(candidate => candidate.minion.owner === playerId);
            if (!owned) return [];
            return buildValidatedReturnEvents(ctx.state, {
                minionUid: owned.minion.uid,
                minionDefId: owned.minion.defId,
                fromBaseIndex: owned.baseIndex,
                toPlayerId: owned.minion.owner,
                reason: 'ignobles_out_of_sight',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'ignobles_out_of_sight',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: owned.baseIndex,
                sourceKind: 'action',
            });
        }),
    };
}

function redBirthdayParty(ctx: AbilityContext): AbilityResult {
    const target = ctx.targetMinionUid ? findMinionOnBases(ctx.state, ctx.targetMinionUid) : undefined;
    const selected = target ?? ctx.state.bases
        .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
        .find(candidate => candidate.minion.owner === ctx.playerId);
    if (!selected || selected.minion.owner !== ctx.playerId) return { events: [] };
    const targetPower = getMinionPower(ctx.state, selected.minion, selected.baseIndex);
    return {
        events: ctx.state.bases[selected.baseIndex].minions
            .filter(minion => minion.uid === selected.minion.uid || getMinionPower(ctx.state, minion, selected.baseIndex) < targetPower)
            .flatMap(minion => buildValidatedDestroyEvents(ctx.state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'ignobles_red_birthday_party',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'ignobles_red_birthday_party',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: selected.baseIndex,
                sourceKind: 'action',
            })),
    };
}

function hostageExchange(ctx: AbilityContext): AbilityResult {
    const own = ctx.state.bases
        .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
        .find(candidate => candidate.minion.controller === ctx.playerId);
    const otherPlayer = findAnotherPlayer(ctx.state, ctx.playerId);
    if (!own || !otherPlayer) return { events: [] };
    const maxPower = getMinionPower(ctx.state, own.minion, own.baseIndex);
    const target = ctx.state.bases
        .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
        .find(candidate => candidate.minion.controller === otherPlayer && getMinionPower(ctx.state, candidate.minion, candidate.baseIndex) <= maxPower);
    if (!target) return { events: [] };
    return {
        events: [
            controlChangeEvent({
                minion: own.minion,
                baseIndex: own.baseIndex,
                toControllerId: otherPlayer,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'ignobles_hostage_exchange',
                reason: 'ignobles_hostage_exchange',
                now: ctx.now,
            }),
            controlChangeEvent({
                minion: target.minion,
                baseIndex: target.baseIndex,
                toControllerId: ctx.playerId,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'ignobles_hostage_exchange',
                reason: 'ignobles_hostage_exchange',
                now: ctx.now,
            }),
        ],
    };
}

function footOfTheKing(ctx: any): SmashUpEvent[] {
    const playerId = ctx.sourceControllerId as PlayerId | undefined;
    if (!playerId) return [];
    const candidates = ctx.state.bases.flatMap((base: any, baseIndex: number) =>
        base.minions
            .filter((minion: MinionOnBase) => minion.owner === playerId && minion.controller !== playerId)
            .map((minion: MinionOnBase) => ({ minion, baseIndex })),
    );
    if (candidates.length === 0) return [];
    const target = candidates[0];
    return [controlChangeEvent({
        minion: target.minion,
        baseIndex: target.baseIndex,
        toControllerId: playerId,
        sourcePlayerId: playerId,
        sourceDefId: 'ignobles_foot_of_the_king',
        reason: 'ignobles_foot_of_the_king',
        now: ctx.now,
    })];
}

function starReturn(ctx: AbilityContext, sourceId: string): AbilityResult {
    const target = ctx.targetMinionUid ? findMinionOnBases(ctx.state, ctx.targetMinionUid) : undefined;
    const selected = target ?? ctx.state.bases
        .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
        .find(candidate => candidate.minion.controller === ctx.playerId);
    if (!selected || selected.minion.controller !== ctx.playerId) return { events: [] };
    return {
        events: buildValidatedReturnEvents(ctx.state, {
            minionUid: selected.minion.uid,
            minionDefId: selected.minion.defId,
            fromBaseIndex: selected.baseIndex,
            toPlayerId: selected.minion.owner,
            reason: sourceId,
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceDefId: sourceId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: selected.baseIndex,
            sourceKind: 'action',
        }),
    };
}

function portMeUp(ctx: AbilityContext): AbilityResult {
    return starReturn(ctx, 'star_roamers_port_me_up');
}

function teleportOverflow(ctx: AbilityContext): AbilityResult {
    const returned = starReturn(ctx, 'star_roamers_teleport_overflow');
    return { events: [...returned.events, grantContextualExtraMinion(ctx, 'star_roamers_teleport_overflow')] };
}

function massTeleport(ctx: AbilityContext): AbilityResult {
    return {
        events: Object.keys(ctx.state.players).flatMap(playerId => {
            const controlled = ctx.state.bases
                .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
                .find(candidate => candidate.minion.controller === playerId);
            if (!controlled) return [];
            return buildValidatedReturnEvents(ctx.state, {
                minionUid: controlled.minion.uid,
                minionDefId: controlled.minion.defId,
                fromBaseIndex: controlled.baseIndex,
                toPlayerId: controlled.minion.owner,
                reason: 'star_roamers_mass_teleport',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'star_roamers_mass_teleport',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: controlled.baseIndex,
                sourceKind: 'action',
            });
        }),
    };
}

function teleportError(ctx: AbilityContext): AbilityResult {
    const target = ctx.targetMinionUid ? findMinionOnBases(ctx.state, ctx.targetMinionUid) : undefined;
    if (!target) return { events: [] };
    const destinations = ctx.state.bases.map((_base, index) => index).filter(index => index !== target.baseIndex);
    if (destinations.length === 0) return { events: [] };
    const toBaseIndex = destinations[ctx.random.range(0, destinations.length - 1)] ?? destinations[0];
    return {
        events: buildValidatedMoveEvents(ctx.state, {
            minionUid: target.minion.uid,
            minionDefId: target.minion.defId,
            fromBaseIndex: target.baseIndex,
            toBaseIndex,
            reason: 'star_roamers_teleport_error',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'star_roamers_teleport_error',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: target.baseIndex,
            sourceKind: 'action',
        }),
    };
}

const chooseDestBasePrompt = createPromptProgram<
    PromptContext<{ sourceId: string; minions: Array<{ minionUid: string; minionDefId: string; fromBaseIndex: number }> }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'cease_and_desist_choose_dest_base',
    interactionSourceIds: ['star_roamers_hyperspeed_10', 'changerbots_huffie', 'changerbots_change_up_and_roll_on', 'changerbots_passengers'],
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.sourceId,
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((_base, baseIndex) => ({ baseIndex, label: getCardDef(context.matchState.core.bases[baseIndex].defId)?.name ?? context.matchState.core.bases[baseIndex].defId }))
                .filter(base => !context.minions.some(minion => minion.fromBaseIndex === base.baseIndex) || context.sourceId === 'star_roamers_hyperspeed_10'),
            context.matchState.core,
        ),
        {
            sourceId: context.sourceId,
            targetType: 'base',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const baseIndex = (value as BaseChoice | undefined)?.baseIndex;
        if (baseIndex === undefined || !state.core.bases[baseIndex]) return { events: [] };
        return {
            events: context.minions.flatMap(minion => {
                if (minion.fromBaseIndex === baseIndex) return [];
                return buildValidatedMoveEvents(state.core, {
                    minionUid: minion.minionUid,
                    minionDefId: minion.minionDefId,
                    fromBaseIndex: minion.fromBaseIndex,
                    toBaseIndex: baseIndex,
                    reason: context.sourceId,
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: minion.fromBaseIndex,
                    sourceKind: 'action',
                });
            }),
        };
    },
});

const starRoamersReturnReplacementPrompt = createPromptProgram<
    PromptContext<{
        sourceId: 'star_roamers_whiplash_maneuver' | 'star_roamers_ships_engineer';
        sourceBaseIndex: number;
        sourceCardUid?: string;
        returnEvent: SmashUpEvent;
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        destinationBaseIndex: number;
    }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'star_roamers_return_replacement',
    interactionSourceIds: ['star_roamers_whiplash_maneuver', 'star_roamers_ships_engineer'],
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.minionUid}_${context.now}`,
        context.playerId,
        context.sourceId,
        [
            createSkipOption(),
            {
                id: 'replace',
                label: '改为移动到另一基地',
                labelKey: 'ui.star_roamers_return_replacement_move_option',
                value: { replace: true } satisfies ReturnReplacementChoice,
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: context.sourceId,
            targetType: 'generic',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as ReturnReplacementChoice | undefined;
        if (!choice?.replace || choice.skip) {
            return {
                events: [{
                    ...context.returnEvent,
                    payload: {
                        ...(context.returnEvent as any).payload,
                        skipReturnReplacement: true,
                    },
                } as SmashUpEvent],
            };
        }
        const fromBase = state.core.bases[context.fromBaseIndex];
        if (!fromBase?.minions.some(minion => minion.uid === context.minionUid)) {
            return { events: [] };
        }
        return {
            events: buildValidatedMoveEvents(state.core, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: context.destinationBaseIndex,
                reason: context.sourceId,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.sourceBaseIndex,
                sourceKind: context.sourceId === 'star_roamers_whiplash_maneuver' ? 'action' : 'nonAction',
            }),
        };
    },
});

function buildStarRoamersReturnReplacement(ctx: TriggerContext, sourceId: 'star_roamers_whiplash_maneuver' | 'star_roamers_ships_engineer'): AbilityResult {
    if (!ctx.matchState || ctx.triggerMinionUid === undefined || ctx.triggerMinionDefId === undefined) return { events: [] };
    if (ctx.baseIndex === undefined) return { events: [] };
    const returnEvent = ctx.affectEvent as SmashUpEvent | undefined;
    if (!returnEvent || returnEvent.type !== SU_EVENTS.MINION_RETURNED) return { events: [] };
    const destinationBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (destinationBaseIndex === undefined) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(starRoamersReturnReplacementPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId ?? ctx.playerId,
        now: ctx.now,
        sourceId,
        sourceBaseIndex: ctx.sourceBaseIndex ?? ctx.baseIndex,
        sourceCardUid: ctx.sourceCardUid,
        returnEvent,
        minionUid: ctx.triggerMinionUid,
        minionDefId: ctx.triggerMinionDefId,
        fromBaseIndex: ctx.baseIndex,
        destinationBaseIndex,
    }));
}

function hyperspeed10(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base || base.minions.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(chooseDestBasePrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'star_roamers_hyperspeed_10',
        minions: base.minions.map(minion => ({
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: baseIndex,
        })),
    }));
}

function shipsCaptain(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const minion = player.deck.find(card => card.type === 'minion');
    if (!minion) return { events: [inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, 'star_roamers_ships_captain', ctx.now)] };
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, 'star_roamers_ships_captain', ctx.now),
        revealDeckTop(ctx.playerId, 'all', [{ uid: minion.uid, defId: minion.defId }], 1, 'star_roamers_ships_captain', ctx.now, ctx.playerId),
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [minion.uid] },
            timestamp: ctx.now,
        } as CardsDrawnEvent,
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ctx.playerId,
                deckUids: ctx.random.shuffle(player.deck.filter(card => card.uid !== minion.uid)).map(card => card.uid),
            },
            timestamp: ctx.now,
        } as DeckReorderedEvent,
    ];
    const power = getMinionDef(minion.defId)?.power ?? 99;
    if (power <= 3) {
        events.push(grantContextualExtraMinion(ctx, 'star_roamers_ships_captain', ctx.baseIndex, { powerMax: 3 }));
    }
    return { events };
}

function scienceOfficer(ctx: AbilityContext): AbilityResult {
    const own = ctx.state.bases
        .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
        .find(candidate => candidate.minion.controller === ctx.playerId && getMinionPower(ctx.state, candidate.minion, candidate.baseIndex) <= 4);
    if (!own) return { events: [] };
    return {
        events: [
            ...buildValidatedReturnEvents(ctx.state, {
                minionUid: own.minion.uid,
                minionDefId: own.minion.defId,
                fromBaseIndex: own.baseIndex,
                toPlayerId: own.minion.owner,
                reason: 'star_roamers_science_officer',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'star_roamers_science_officer',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: own.baseIndex,
                sourceKind: 'nonAction',
            }),
            grantContextualExtraMinion(ctx, 'star_roamers_science_officer'),
        ],
    };
}

function weirdNewWorlds(ctx: AbilityContext): AbilityResult {
    const newBaseDefId = ctx.state.baseDeck[0];
    if (!newBaseDefId) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex: ctx.state.bases.length,
                oldBaseDefId: '',
                newBaseDefId,
                allowMissingFromBaseDeck: false,
            },
            timestamp: ctx.now,
        } as BaseReplacedEvent, grantContextualExtraMinion(ctx, 'star_roamers_weird_new_worlds', ctx.state.bases.length)],
    };
}

function medicalOfficerOnReturn(ctx: any): SmashUpEvent[] {
    const controllerId = ctx.sourceControllerId as PlayerId | undefined;
    if (!controllerId || !ctx.triggerMinionUid || ctx.playerId !== controllerId) return [];
    return buildStandardDrawEvents(ctx.state, controllerId, 1, ctx.random, ctx.now);
}

function formMergacon(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    return {
        events: ownMinionsAtBase(ctx.state, ctx.playerId, baseIndex)
            .map(minion => addTempPower(minion.uid, baseIndex, 1, 'changerbots_form_mergacon', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'changerbots_form_mergacon',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
            })),
    };
}

function changeIntoAGun(ctx: AbilityContext): AbilityResult {
    const host = ctx.targetMinionUid ? findMinionOnBases(ctx.state, ctx.targetMinionUid) : undefined;
    const selectedHost = host ?? findMinionOnBases(ctx.state, ctx.cardUid);
    if (!selectedHost || selectedHost.minion.controller !== ctx.playerId) return { events: [] };
    const victim = ctx.state.bases[selectedHost.baseIndex].minions.find(minion =>
        minion.uid !== selectedHost.minion.uid && getMinionPower(ctx.state, minion, selectedHost.baseIndex) <= 4);
    return {
        events: [
            ...(victim ? buildValidatedDestroyEvents(ctx.state, {
                minionUid: victim.uid,
                minionDefId: victim.defId,
                fromBaseIndex: selectedHost.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'changerbots_change_into_a_gun',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'changerbots_change_into_a_gun',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: selectedHost.baseIndex,
                sourceKind: 'action',
            }) : []),
            addTempPower(selectedHost.minion.uid, selectedHost.baseIndex, -2, 'changerbots_change_into_a_gun', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'changerbots_change_into_a_gun',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: selectedHost.baseIndex,
            }),
        ],
    };
}

function leaderTwo(ctx: AbilityContext): AbilityResult {
    const candidates = getAllMinionCandidates(ctx.state, minion =>
        minion.controller === ctx.playerId && minion.uid !== ctx.cardUid);
    if (candidates.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(chooseAnyMinionPowerPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'changerbots_leader_two',
        amount: 2,
        candidates,
    }));
}

function solarshout(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraAction(ctx, 'changerbots_solarshout'),
            addTempPower(ctx.cardUid, ctx.baseIndex, -2, 'changerbots_solarshout', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'changerbots_solarshout',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
        ],
    };
}

function huffieLike(ctx: AbilityContext, sourceId: string, minionUid = ctx.cardUid): AbilityResult {
    const located = findMinionOnBases(ctx.state, minionUid);
    if (!located || ctx.state.bases.length <= 1) return { events: [] };
    const prompt = executeAbilityProgram(chooseDestBasePrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        minions: [{ minionUid: located.minion.uid, minionDefId: located.minion.defId, fromBaseIndex: located.baseIndex }],
    });
    return {
        events: [
            addTempPower(located.minion.uid, located.baseIndex, -1, sourceId, ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: sourceId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: located.baseIndex,
            }),
            ...prompt.events,
        ],
        ...(prompt.matchState ? { matchState: prompt.matchState } : {}),
    };
}

function huffie(ctx: AbilityContext): AbilityResult {
    return huffieLike(ctx, 'changerbots_huffie');
}

function bruiser(ctx: AbilityContext): AbilityResult {
    return {
        events: [addTempPower(ctx.cardUid, ctx.baseIndex, 2, 'changerbots_bruiser', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'changerbots_bruiser',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        })],
    };
}

function theTouch(ctx: AbilityContext): AbilityResult {
    const target = findMinionOnBases(ctx.state, ctx.targetMinionUid ?? ctx.cardUid);
    if (!target) return { events: [] };
    return {
        events: [addTempPower(target.minion.uid, target.baseIndex, 3, 'changerbots_the_touch', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'changerbots_the_touch',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: target.baseIndex,
        })],
    };
}

function changeUpAndRollOn(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.baseIndex;
    const movable = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === ctx.playerId && baseIndex !== targetBaseIndex)
            .map(minion => ({ minionUid: minion.uid, minionDefId: minion.defId, fromBaseIndex: baseIndex })),
    );
    return {
        events: movable.flatMap(minion => [
            ...buildValidatedMoveEvents(ctx.state, {
                ...minion,
                toBaseIndex: targetBaseIndex,
                reason: 'changerbots_change_up_and_roll_on',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'changerbots_change_up_and_roll_on',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: minion.fromBaseIndex,
                sourceKind: 'action',
            }),
            addTempPower(minion.minionUid, targetBaseIndex, -1, 'changerbots_change_up_and_roll_on', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'changerbots_change_up_and_roll_on',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: targetBaseIndex,
            }),
        ]),
    };
}

function passengers(ctx: AbilityContext): AbilityResult {
    const host = findMinionByAttachedCard(ctx.state, ctx.cardUid);
    if (!host || host.minion.controller !== ctx.playerId) return { events: [] };
    const originalBaseIndex = host.minion.metadata?.passengersOriginalBaseIndex;
    const movedTurnNumber = host.minion.metadata?.passengersMovedTurnNumber;
    if (movedTurnNumber !== ctx.state.turnNumber) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    const fromBaseIndex = typeof originalBaseIndex === 'number' ? originalBaseIndex : undefined;
    if (fromBaseIndex === undefined || fromBaseIndex === host.baseIndex) return { events: [] };
    const sourceBase = ctx.state.bases[fromBaseIndex];
    const passenger = sourceBase?.minions.find(minion =>
        minion.controller === ctx.playerId
        && minion.uid !== host.minion.uid);
    if (!passenger) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(chooseDestBasePrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'changerbots_passengers',
        minions: [{
            minionUid: passenger.uid,
            minionDefId: passenger.defId,
            fromBaseIndex,
        }],
    }));
}

function flighterizer(ctx: AbilityContext): AbilityResult {
    return huffieLike(ctx, 'changerbots_flighterizer', ctx.targetMinionUid ?? ctx.cardUid);
}

function noOpScoped(sourceId: string) {
    return (ctx: AbilityContext): AbilityResult => ({
        events: [buildAbilityFeedback(ctx.playerId, 'feedback.ability_not_implemented', ctx.now, { source: sourceId })],
    });
}


function firstOtherPlayerId(state: SmashUpCore, playerId: PlayerId): PlayerId | undefined {
    return state.turnOrder.find(candidate => candidate !== playerId)
        ?? Object.keys(state.players).find(candidate => candidate !== playerId);
}

function chooseOtherPlayerOptions(state: SmashUpCore, playerId: PlayerId) {
    return Object.keys(state.players)
        .filter(candidate => candidate !== playerId)
        .map(candidate => ({ id: candidate, label: candidate, value: { playerId: candidate }, _source: 'player' as const }));
}

const baseGiveControlPrompt = createPromptProgram<
    BaseAbilityPromptContext<{ minionUid: string; baseIndex: number }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'cease_and_desist_base_give_control',
    interactionSourceIds: ['base_wintersquashed'],
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.sourceId,
        [createSkipOption(), ...chooseOtherPlayerOptions(context.matchState.core, context.playerId)],
        {
            sourceId: context.sourceId,
            targetType: 'generic',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        if (isSkip(value)) return { events: [] };
        const playerId = (value as PlayerChoice | undefined)?.playerId;
        const minion = state.core.bases[context.baseIndex]?.minions.find(candidate => candidate.uid === context.minionUid);
        if (!playerId || !minion || minion.controller !== context.playerId) return { events: [] };
        return {
            events: [controlChangeEvent({
                minion,
                baseIndex: context.baseIndex,
                toControllerId: playerId,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceId,
                reason: context.sourceId,
                now: timestamp,
            })],
        };
    },
});

const baseMoveMinionPrompt = createPromptProgram<
    BaseAbilityPromptContext<{ minions: MinionChoice[]; fromBaseIndex?: number; toBaseIndex?: number }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'cease_and_desist_base_move_minion',
    interactionSourceIds: ['base_uss_undertaking'],
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.sourceId,
        [
            createSkipOption(),
            ...context.minions.map(minion => ({
                id: minion.minionUid,
                label: getCardDef(minion.minionDefId ?? minion.defId ?? '')?.name ?? minion.minionUid,
                value: minion,
                _source: 'field' as const,
            })),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        if (isSkip(value)) return { events: [] };
        const selected = value as MinionChoice | undefined;
        if (!selected) return { events: [] };
        const fromBaseIndex = context.fromBaseIndex ?? selected.baseIndex;
        const toBaseIndex = context.toBaseIndex ?? (selected.baseIndex === context.baseIndex
            ? firstOtherBaseIndex(state.core, context.baseIndex)
            : context.baseIndex);
        if (toBaseIndex === undefined || fromBaseIndex === toBaseIndex) return { events: [] };
        const live = state.core.bases[fromBaseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!live || live.controller !== context.playerId) return { events: [] };
        return {
            events: buildValidatedMoveEvents(state.core, {
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex,
                toBaseIndex,
                reason: context.sourceId,
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
                sourceKind: 'nonAction',
            }),
        };
    },
});

const baseDestroyForDrawPrompt = createPromptProgram<
    BaseAbilityPromptContext<{ minions: MinionChoice[] }>
, SmashUpCore, SmashUpEvent>({
    sourceId: 'cease_and_desist_base_destroy_for_draw',
    interactionSourceIds: ['base_spikey_chair_room'],
    buildInteraction: context => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.sourceId,
        [
            createSkipOption(),
            ...context.minions.map(minion => ({
                id: minion.minionUid,
                label: getCardDef(minion.minionDefId ?? minion.defId ?? '')?.name ?? minion.minionUid,
                value: minion,
                _source: 'field' as const,
            })),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        if (isSkip(value)) return { events: [] };
        const selected = value as MinionChoice | undefined;
        if (!selected) return { events: [] };
        const live = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!live || live.owner !== context.playerId) return { events: [] };
        const destroyEvents = buildValidatedDestroyEvents(state.core, {
            minionUid: live.uid,
            minionDefId: live.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: context.sourceId,
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceId,
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.baseIndex,
            sourceKind: 'nonAction',
        });
        const preview = applyPreview(state, destroyEvents);
        return { events: [...destroyEvents, ...buildStandardDrawEventsFromRuntimeContext({ ...args, state: preview }, context.playerId, 1)] };
    },
});

function baseWintersquashedOnMinionPlayed(ctx: BaseAbilityContext) {
    if (!ctx.matchState || !ctx.minionUid || ctx.playerId === undefined) return { events: [] };
    const minion = ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.minionUid);
    if (!minion || minion.controller !== ctx.playerId) return { events: [] };
    if (!firstOtherPlayerId(ctx.state, ctx.playerId)) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(baseGiveControlPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_wintersquashed',
        minionUid: ctx.minionUid,
        baseIndex: ctx.baseIndex,
    }));
}

function baseUssUndertakingOnTurnStart(ctx: BaseAbilityContext) {
    if (!ctx.matchState) return { events: [] };
    const candidates: MinionChoice[] = ctx.state.bases.flatMap((base, baseIndex) => base.minions
        .filter(minion => minion.controller === ctx.playerId)
        .filter(_minion => baseIndex === ctx.baseIndex || ctx.state.bases.some((_candidate, index) => index !== baseIndex))
        .map(minion => ({ minionUid: minion.uid, minionDefId: minion.defId, baseIndex })));
    if (candidates.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(baseMoveMinionPrompt, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_uss_undertaking',
        baseIndex: ctx.baseIndex,
        minions: candidates,
    }));
}

function baseNoMoonBeforeScoring(ctx: BaseAbilityContext) {
    const candidates = ctx.state.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(candidate => candidate.baseIndex !== ctx.baseIndex);
    if (candidates.length === 0 || ctx.state.baseDeck.length === 0) return { events: [] };
    const selected = candidates[Math.floor((ctx.random?.random?.() ?? 0) * candidates.length)] ?? candidates[0];
    const newBaseDefId = ctx.state.baseDeck[0];
    return {
        events: [{
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex: selected.baseIndex,
                oldBaseDefId: selected.base.defId,
                newBaseDefId,
                keepCards: false,
            },
            timestamp: ctx.now,
        } as BaseReplacedEvent],
    };
}

function baseUnicraveBeforeScoring(ctx: BaseAbilityContext) {
    const newBaseDefId = ctx.state.baseDeck[0];
    if (!newBaseDefId) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex: ctx.baseIndex,
                oldBaseDefId: ctx.baseDefId,
                newBaseDefId,
                keepCards: true,
            },
            timestamp: ctx.now,
        } as BaseReplacedEvent],
    };
}

function baseChangingRoomOnTalentUsed(ctx: BaseAbilityContext): SmashUpEvent[] {
    const baseIndex = ctx.baseIndex;
    const minionUid = ctx.minionUid;
    if (baseIndex === undefined || !minionUid) return [];
    const minion = ctx.state.bases[baseIndex]?.minions.find(candidate => candidate.uid === minionUid);
    if (!minion) return [];
    return [addTempPower(minionUid, baseIndex, 1, 'base_changing_room', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceDefId: 'base_changing_room',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: baseIndex,
    })];
}

function baseHiveOnActionPlayed(ctx: BaseAbilityContext) {
    const targetBaseIndex = ctx.actionTargetBaseIndex;
    if (targetBaseIndex !== ctx.baseIndex) return { events: [] };
    if (!ctx.actionTargetMinionUid) return { events: [] };
    const sourceDefId = ctx.triggerCardDefId;
    if (!sourceDefId || !DIRECT_POWER_ACTIONS.has(sourceDefId)) return { events: [] };
    if ((ctx.state.usedBaseAbilitiesThisTurn ?? []).some(entry =>
        entry.playerId === ctx.playerId
        && entry.baseIndex === ctx.baseIndex
        && entry.baseDefId === 'base_hive_of_scum_and_villainy',
    )) return { events: [] };
    return {
        events: [
            {
                type: SU_EVENTS.BASE_ABILITY_USED,
                payload: {
                    playerId: ctx.playerId,
                    baseIndex: ctx.baseIndex,
                    baseDefId: 'base_hive_of_scum_and_villainy',
                },
                timestamp: ctx.now,
            } as SmashUpEvent,
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        ],
    };
}

function registerCeaseAndDesistBaseAbilities(): void {
    registerBaseAbility('base_spikey_chair_room', 'onTurnEnd', (ctx) => {
        const playedHere = (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) > 0;
        if (!playedHere || !ctx.matchState) return { events: [] };
        const minions = ctx.state.bases.flatMap((base, baseIndex) => base.minions
            .filter(minion => minion.owner === ctx.playerId)
            .map(minion => ({ minionUid: minion.uid, minionDefId: minion.defId, baseIndex })));
        if (minions.length === 0) return { events: [] };
        return runtimeToAbilityResult(executeAbilityProgram(baseDestroyForDrawPrompt, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'base_spikey_chair_room',
            minions,
        }));
    });
    registerBaseAbility('base_no_moon', 'beforeScoring', baseNoMoonBeforeScoring);
    registerBaseAbility('base_uss_undertaking', 'onTurnStart', baseUssUndertakingOnTurnStart);
    registerBaseAbility('base_unicrave', 'beforeScoring', baseUnicraveBeforeScoring);
    registerBaseAbility('base_wintersquashed', 'onMinionPlayed', baseWintersquashedOnMinionPlayed);
    registerBaseAbility('base_changing_room', 'onTalentUsed', ctx => ({ events: baseChangingRoomOnTalentUsed(ctx) }));
    registerProtection('base_neutral_space', 'affect', ctx => {
        const base = ctx.state.bases[ctx.targetBaseIndex];
        if (!base || base.defId !== 'base_neutral_space') return false;
        if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
        if (ctx.sourceKind === 'action') return false;
        if (ctx.sourceBaseIndex !== ctx.targetBaseIndex) return false;
        return true;
    });
    registerBaseAbility('base_hive_of_scum_and_villainy', 'onActionPlayed', baseHiveOnActionPlayed);
}
function registerOngoingPieces(): void {
    registerOngoingPowerModifier('astroknights_laser_sword', 'minion', 'self', 2);
    registerCustomPowerModifiers([{
        sourceDefId: 'astroknights_ghost_knight',
        compute: (ctx, helpers) => (
            helpers.countMinionsOnBaseMatchingRuntimeDefId(ctx, 'astroknights_ghost_knight', {
                controllerId: ctx.minion.controller,
                excludeSelf: true,
            }) > 0 ? 2 : 0
        ),
    }]);
    registerPowerModifier('changerbots_cesium_armor', (ctx) =>
        ctx.minion.attachedActions.filter(action => matchesDefId(action.defId, 'changerbots_cesium_armor')).length);
    registerPowerModifier('changerbots_matrix_of_bossiness', (ctx) =>
        ctx.minion.attachedActions.some(action => matchesDefId(action.defId, 'changerbots_matrix_of_bossiness'))
            ? 5 - ctx.minion.basePower
            : 0);
    registerPowerModifier('star_roamers_ensign', (ctx) => {
        if (!matchesDefId(ctx.minion.defId, 'star_roamers_ensign')) return 0;
        return ctx.base.minions.some(minion =>
            minion.uid !== ctx.minion.uid
            && minion.controller === ctx.minion.controller
            && matchesDefId(minion.defId, 'star_roamers_ensign')) ? 1 : 0;
    });

    registerProtection('astroknights_ghost_knight', 'destroy', ctx =>
        matchesDefId(ctx.targetMinion.defId, 'astroknights_ghost_knight'));
    registerProtection('changerbots_bruiser', 'destroy', ctx =>
        matchesDefId(ctx.targetMinion.defId, 'changerbots_bruiser'));
    registerProtection('changerbots_cesium_armor', 'destroy', ctx =>
        ctx.targetMinion.attachedActions.some(action => matchesDefId(action.defId, 'changerbots_cesium_armor')));
    registerProtection('astroknights_laser_sword', 'affect', ctx =>
        ctx.sourcePlayerId !== ctx.targetMinion.controller
        && ctx.sourceKind === 'nonAction'
        && ctx.targetMinion.attachedActions.some(action => matchesDefId(action.defId, 'astroknights_laser_sword')));
    registerProtection('star_roamers_protector_fields', 'action', ctx => {
        const base = ctx.state.bases[ctx.targetBaseIndex];
        if (!base || ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
        return base.ongoingActions.some(action =>
            matchesDefId(action.defId, 'star_roamers_protector_fields')
            && actionController(action) === ctx.targetMinion.controller);
    });
}

export function registerCeaseAndDesistAbilities(): void {
    registerSimpleAbility('astroknights_block_the_probe', 'onPlay', blockTheProbe);
    registerSimpleAbility('astroknights_block_the_probe', 'special', blockTheProbe);
    registerSimpleAbility('astroknights_recycle_the_trash', 'onPlay', recycleTheTrash);
    registerSimpleAbility('astroknights_yield_to_rage', 'onPlay', yieldToRage);
    registerSimpleAbility('astroknights_prepare_for_battle', 'onPlay', prepareForBattle);
    registerSimpleAbility('astroknights_use_the_fours', 'onPlay', useTheFours);
    registerSimpleAbility('astroknights_its_a_trap', 'special', itsATrap);
    registerSimpleAbility('astroknights_annoying_alien', 'talent', annoyingAlien);
    registerSimpleAbility('astroknights_pupoks', 'talent', pupoks);
    registerSimpleAbility('astroknights_walking_carpet', 'special', walkingCarpet);
    registerSimpleAbility('astroknights_scoundrel', 'talent', scoundrel);
    registerSimpleAbility('astroknights_mannersbot', 'talent', mannersbot);
    registerSimpleAbility('astroknights_space_prince', 'talent', ctx => ({
        events: [grantContextualExtraAction(ctx, 'astroknights_space_prince', { restrictToCardDefId: 'astroknights_use_the_fours' })],
    }));
    registerSimpleAbility('astroknights_space_knight', 'talent', spaceKnight);
    registerSimpleAbility('astroknights_astro_robot', 'onPlay', astroRobot);

    registerSimpleAbility('ignobles_repaying_debts', 'onPlay', repayingDebts);
    registerSimpleAbility('ignobles_fate_of_the_favorites', 'onPlay', fateOfTheFavorites);
    registerSimpleAbility('ignobles_red_birthday_party', 'onPlay', redBirthdayParty);
    registerSimpleAbility('ignobles_hostage_exchange', 'onPlay', hostageExchange);
    registerSimpleAbility('ignobles_inevitable_betrayal', 'special', inevitableBetrayal);
    registerSimpleAbility('ignobles_activate_the_spy', 'onPlay', activateTheSpy);
    registerSimpleAbility('ignobles_out_of_sight', 'onPlay', outOfSight);
    registerSimpleAbility('ignobles_banner_call', 'onPlay', bannerCall);
    registerSimpleAbility('ignobles_sneaky_squire', 'onPlay', sneakySquire);
    registerSimpleAbility('ignobles_betrothed', 'onPlay', betrothed);
    registerSimpleAbility('ignobles_aunt_of_drakes', 'talent', auntOfDrakes);

    registerSimpleAbility('star_roamers_weird_new_worlds', 'onPlay', weirdNewWorlds);
    registerSimpleAbility('star_roamers_teleport_overflow', 'onPlay', teleportOverflow);
    registerSimpleAbility('star_roamers_teleport_error', 'onPlay', teleportError);
    registerSimpleAbility('star_roamers_hyperspeed_10', 'onPlay', hyperspeed10);
    registerSimpleAbility('star_roamers_port_me_up', 'onPlay', portMeUp);
    registerSimpleAbility('star_roamers_port_me_up', 'special', portMeUp);
    registerSimpleAbility('star_roamers_mass_teleport', 'onPlay', massTeleport);
    registerSimpleAbility('star_roamers_science_officer', 'talent', scienceOfficer);
    registerSimpleAbility('star_roamers_ships_captain', 'onPlay', shipsCaptain);

    registerSimpleAbility('changerbots_change_into_a_gun', 'onPlay', changeIntoAGun);
    registerSimpleAbility('changerbots_passengers', 'talent', passengers);
    registerSimpleAbility('changerbots_the_touch', 'talent', theTouch);
    registerSimpleAbility('changerbots_flighterizer', 'talent', flighterizer);
    registerSimpleAbility('changerbots_change_up_and_roll_on', 'special', changeUpAndRollOn);
    registerSimpleAbility('changerbots_form_mergacon', 'onPlay', formMergacon);
    registerSimpleAbility('changerbots_leader_two', 'talent', leaderTwo);
    registerSimpleAbility('changerbots_solarshout', 'talent', solarshout);
    registerSimpleAbility('changerbots_huffie', 'talent', huffie);
    registerSimpleAbility('changerbots_bruiser', 'talent', bruiser);

    registerSimpleAbility('astroknights_hidden_base', 'ongoing', noOpScoped('astroknights_hidden_base'));
    registerSimpleAbility('astroknights_laser_sword', 'ongoing', noOpScoped('astroknights_laser_sword'));
    registerSimpleAbility('star_roamers_whiplash_maneuver', 'ongoing', noOpScoped('star_roamers_whiplash_maneuver'));
    registerSimpleAbility('star_roamers_protector_fields', 'ongoing', noOpScoped('star_roamers_protector_fields'));
    registerSimpleAbility('changerbots_matrix_of_bossiness', 'ongoing', noOpScoped('changerbots_matrix_of_bossiness'));
    registerSimpleAbility('changerbots_cesium_armor', 'ongoing', noOpScoped('changerbots_cesium_armor'));

    registerTrigger('astroknights_hidden_base', 'onTurnStart', hiddenBaseOnTurnStart, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('astroknights_alien_guru', 'onActionPlayed', alienGuruOnActionPlayed, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerTrigger('ignobles_foot_of_the_king', 'onTurnEnd', footOfTheKing, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('star_roamers_medical_officer', 'onCardReturnedToHand', medicalOfficerOnReturn, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerTrigger('star_roamers_whiplash_maneuver', 'onCardReturnedToHand', ctx =>
        buildStarRoamersReturnReplacement(ctx, 'star_roamers_whiplash_maneuver'), {
        phase: 'replacement',
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: true,
    });
    registerTrigger('star_roamers_ships_engineer', 'onCardReturnedToHand', ctx =>
        buildStarRoamersReturnReplacement(ctx, 'star_roamers_ships_engineer'), {
        phase: 'replacement',
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });

    registerOngoingPieces();
    registerCeaseAndDesistBaseAbilities();
}
