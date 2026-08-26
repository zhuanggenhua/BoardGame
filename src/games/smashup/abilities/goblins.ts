import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerTrigger, type TriggerContext, type TriggerResult } from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import {
    addPowerCounter,
    addTempPower,
    buildBaseTargetOptions,
    buildFieldSourceActionOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    emitSpecialLimitUsed,
    findMinionByAttachedCard,
    findMinionOnBases,
    grantExtraAction,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import { getCardDef } from '../data/cards';
import type { CardInstance, MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type LocatedMinion = { minion: MinionOnBase; baseIndex: number };
type GoblinAfterCoinEffect =
    | { kind: 'chaos_lord'; sourceCardUid: string; sourceBaseIndex: number }
    | { kind: 'diviner_draw'; sourceCardUid: string; sourceBaseIndex: number }
    | { kind: 'recruiters'; sourceCardUid: string; sourceBaseIndex: number };
type GoblinCoinStage = 'start' | 'after-change' | 'after-effects' | 'post-coin';
type GoblinCoinPurpose =
    | { kind: 'a_little_help' }
    | { kind: 'blaster'; sourceCardUid: string; targetBaseIndex?: number }
    | { kind: 'bushwhacking'; sourceCardUid: string; sourceDefId: string; sourceBaseIndex: number; targetMinionUid?: string; targetBaseIndex?: number }
    | { kind: 'goblin_town'; minionUid: string; baseIndex: number }
    | { kind: 'magic_helmet'; sourceCardUid: string; sourceControllerId: PlayerId; sourceBaseIndex: number }
    | { kind: 'gobbo'; targetMinionUid: string; remainingFlips: number; headsCount: number }
    | { kind: 'demolition'; sourceCardUid: string; sourceDefId: string; sourceBaseIndex: number; remainingFlips: number; targetMinionUid?: string; targetBaseIndex?: number }
    | { kind: 'he_who_smelt_it'; flipIndex: number; targetMinionUid?: string }
    | { kind: 'revving_up'; minionUids: string[]; baseIndex: number; index: number }
    | { kind: 'goblin_caves'; playerIds: PlayerId[]; baseIndex: number; index: number };
type GoblinCoinProgramContext = {
    matchState?: MatchState<SmashUpCore>;
    random?: RandomFn;
    playerId: PlayerId;
    now: number;
    reason: string;
    preferredResult?: CoinPreference;
    stage?: GoblinCoinStage;
    heads?: boolean;
    initialEvents?: SmashUpEvent[];
    afterEffects?: GoblinAfterCoinEffect[];
    purpose: GoblinCoinPurpose;
};

type GoblinChoicePromptKind =
    | 'diviner_change_discard'
    | 'chaos_lord_counter_target'
    | 'discard_hand_cards'
    | 'recruiters_shuffle_discard'
    | 'blaster_heads_confirm'
    | 'blaster_tails_destination'
    | 'bushwhacking_tails_destination'
    | 'demolition_counter_target'
    | 'demolition_destroy_action'
    | 'he_who_smelt_it_next_target';

type GoblinChoicePromptContext = GoblinCoinProgramContext & {
    choiceKind: GoblinChoicePromptKind;
    choiceCount?: number;
};

type GoblinMinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    defId?: string;
    baseIndex?: number;
    skip?: boolean;
};

type GoblinCardChoice = {
    cardUid?: string;
    defId?: string;
    skip?: boolean;
};

type GoblinBaseChoice = {
    baseIndex?: number;
    skip?: boolean;
};

const CHAOS_LORD = 'goblins_chaos_lord';
const DIVINER = 'goblins_diviner';
const BLASTER = 'goblins_blaster';
const GOBBO = 'goblins_gobbo';
const MAGIC_HELMET = 'goblins_magic_helmet';
const RECRUITERS = 'goblins_recruiters';
const MAKE_YOUR_OWN_LUCK = 'goblins_make_your_own_luck';

type CoinPreference = 'heads' | 'tails' | undefined;

function flip(random: AbilityContext['random'] | BaseAbilityContext['random'] | TriggerContext['random']): boolean {
    return (random?.random?.() ?? 0.5) >= 0.5;
}

function allMinions(state: SmashUpCore, predicate: (minion: MinionOnBase, baseIndex: number) => boolean): LocatedMinion[] {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => predicate(minion, baseIndex))
            .map(minion => ({ minion, baseIndex })),
    );
}

function cardLabel(card: CardInstance): string {
    return getCardDef(card.defId)?.name ?? card.defId;
}

function minionLabel(minion: MinionOnBase): string {
    return getCardDef(minion.defId)?.name ?? minion.defId;
}

function handCardOptions(state: SmashUpCore, playerId: PlayerId) {
    return (state.players[playerId]?.hand ?? []).map((card, index) => ({
        id: `card-${index}`,
        label: cardLabel(card),
        value: { cardUid: card.uid, defId: card.defId },
        displayMode: 'card' as const,
    }));
}

function discardCardOptions(state: SmashUpCore, playerId: PlayerId) {
    return (state.players[playerId]?.discard ?? []).map((card, index) => ({
        id: `discard-${index}`,
        label: cardLabel(card),
        value: { cardUid: card.uid, defId: card.defId },
        displayMode: 'card' as const,
    }));
}

function minionTargetOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
    sourceDefId: string,
) {
    return buildMinionTargetOptions(
        allMinions(state, predicate).map(({ minion, baseIndex }) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: minionLabel(minion),
        })),
        {
            state,
            sourcePlayerId: playerId,
            sourceDefId,
            sourceKind: 'nonAction',
            effectType: 'affect',
        },
    );
}

function ongoingActionOptions(state: SmashUpCore) {
    return state.bases.flatMap((base, baseIndex) => {
        const baseActions = base.ongoingActions.flatMap(action =>
            buildFieldSourceActionOptions({
                type: 'ongoing',
                uid: action.uid,
                defId: action.defId,
                baseIndex,
                label: getCardDef(action.defId)?.name ?? action.defId,
            }, { cardUid: action.uid, baseIndex }),
        );
        const attachedActions = base.minions.flatMap(minion =>
            minion.attachedActions.flatMap(action =>
                buildFieldSourceActionOptions({
                    type: 'ongoing',
                    uid: action.uid,
                    defId: action.defId,
                    baseIndex,
                    label: getCardDef(action.defId)?.name ?? action.defId,
                }, { cardUid: action.uid, baseIndex, minionUid: minion.uid }),
            ),
        );
        return [...baseActions, ...attachedActions];
    });
}

function actionPlayedFromHand(card: CardInstance, playerId: PlayerId, now: number): SmashUpEvent {
    return buildActionPlayedEvent({
        playerId,
        cardUid: card.uid,
        defId: card.defId,
        ownerId: card.owner,
        isExtraAction: true,
        consumesNormalLimit: false,
        timestamp: now,
    });
}

function shuffleDiscardCardIntoDeck(
    state: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    random: AbilityContext['random'] | BaseAbilityContext['random'] | TriggerContext['random'],
    reason: string,
    now: number,
): SmashUpEvent {
    const deckUids = state.players[playerId]?.deck.map(deckCard => deckCard.uid) ?? [];
    const insertion = Math.floor((random?.random?.() ?? 0.5) * (deckUids.length + 1));
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: [
                ...deckUids.slice(0, insertion),
                card.uid,
                ...deckUids.slice(insertion),
            ],
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function markDivinerChangeUsed(source: LocatedMinion, turnNumber: number, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
            minionUid: source.minion.uid,
            baseIndex: source.baseIndex,
            metadataUpdate: { goblinsDivinerChangeTurn: turnNumber },
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function requireGoblinMatchState(context: GoblinCoinProgramContext): MatchState<SmashUpCore> {
    if (!context.matchState) {
        throw new Error('goblins coin continuation 缺少正式 matchState');
    }
    return context.matchState;
}

function requireGoblinRandom(context: GoblinCoinProgramContext): RandomFn {
    if (!context.random) {
        throw new Error('goblins coin continuation 缺少随机源');
    }
    return context.random;
}

function continueGoblinCoin(
    context: GoblinCoinProgramContext,
    events: SmashUpEvent[],
    nextContext?: GoblinCoinProgramContext,
) {
    return {
        events,
        ...(nextContext ? { context: nextContext, nextProgram: goblinCoinProgram } : {}),
    };
}

function stripChoiceContext(context: GoblinChoicePromptContext, state: MatchState<SmashUpCore>, now: number): GoblinCoinProgramContext {
    const { choiceKind: _choiceKind, choiceCount: _choiceCount, ...rest } = context;
    return {
        ...rest,
        matchState: state,
        now,
    };
}

function continueAfterPrompt(
    context: GoblinChoicePromptContext,
    state: MatchState<SmashUpCore>,
    timestamp: number,
    events: SmashUpEvent[],
) {
    const baseContext = stripChoiceContext(context, state, timestamp);
    const purpose = baseContext.purpose;

    if (purpose.kind === 'demolition' && (
        context.choiceKind === 'demolition_counter_target'
        || context.choiceKind === 'demolition_destroy_action'
    )) {
        if (purpose.remainingFlips <= 1) {
            return { events, matchState: state };
        }
        return {
            events,
            matchState: state,
            context: {
                ...baseContext,
                stage: 'start' as const,
                heads: undefined,
                afterEffects: undefined,
                purpose: { ...purpose, remainingFlips: purpose.remainingFlips - 1 },
            },
            nextProgram: goblinCoinProgram,
        };
    }

    if (purpose.kind === 'he_who_smelt_it' && context.choiceKind === 'he_who_smelt_it_next_target') {
        return { events, matchState: state };
    }

    if (purpose.kind === 'goblin_caves' && context.choiceKind === 'discard_hand_cards') {
        if (purpose.index + 1 >= purpose.playerIds.length) {
            return { events, matchState: state };
        }
        return {
            events,
            matchState: state,
            context: {
                ...baseContext,
                stage: 'start' as const,
                playerId: purpose.playerIds[purpose.index + 1],
                heads: undefined,
                afterEffects: undefined,
                purpose: { ...purpose, index: purpose.index + 1 },
            },
            nextProgram: goblinCoinProgram,
        };
    }

    return {
        events,
        matchState: state,
        context: baseContext,
        nextProgram: goblinCoinProgram,
    };
}

function discardSelectedHandCards(
    state: SmashUpCore,
    playerId: PlayerId,
    choices: GoblinCardChoice[],
    count: number,
    timestamp: number,
): SmashUpEvent[] {
    const allowed = new Set((state.players[playerId]?.hand ?? []).map(card => card.uid));
    const selected = choices
        .map(choice => choice.cardUid)
        .filter((uid): uid is string => !!uid && allowed.has(uid))
        .slice(0, count);
    if (selected.length === 0) return [];
    return [{
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids: selected },
        timestamp,
    } as SmashUpEvent];
}

function buildBlasterHeadsEvents(context: GoblinCoinProgramContext, state: SmashUpCore): SmashUpEvent[] {
    if (context.purpose.kind !== 'blaster') return [];
    const source = findMinionOnBases(state, context.purpose.sourceCardUid);
    if (!source) return [];
    return [addTempPower(source.minion.uid, source.baseIndex, 2, 'goblins_blaster_heads', context.now, {
        sourcePlayerId: context.playerId,
        sourceDefId: BLASTER,
        sourceControllerId: context.playerId,
        sourceBaseIndex: source.baseIndex,
    })];
}

function buildBlasterMoveEvents(
    context: GoblinCoinProgramContext,
    state: SmashUpCore,
    selectedBaseIndex: number | undefined,
): SmashUpEvent[] {
    if (context.purpose.kind !== 'blaster') return [];
    const source = findMinionOnBases(state, context.purpose.sourceCardUid);
    if (!source || selectedBaseIndex === undefined || selectedBaseIndex === source.baseIndex || !state.bases[selectedBaseIndex]) return [];
    return buildValidatedMoveEvents(state, {
        minionUid: source.minion.uid,
        minionDefId: source.minion.defId,
        fromBaseIndex: source.baseIndex,
        toBaseIndex: selectedBaseIndex,
        reason: 'goblins_blaster_tails',
        now: context.now,
        sourcePlayerId: context.playerId,
        sourceDefId: BLASTER,
        sourceControllerId: context.playerId,
        sourceBaseIndex: source.baseIndex,
        sourceKind: 'nonAction',
    });
}

function buildBushwhackingMoveEvents(
    context: GoblinCoinProgramContext,
    state: SmashUpCore,
    selectedBaseIndex: number | undefined,
): SmashUpEvent[] {
    if (context.purpose.kind !== 'bushwhacking') return [];
    const target = findMinionOnBases(state, context.purpose.targetMinionUid ?? '');
    if (!target || selectedBaseIndex === undefined || selectedBaseIndex === target.baseIndex || !state.bases[selectedBaseIndex]) return [];
    return buildValidatedMoveEvents(state, {
        minionUid: target.minion.uid,
        minionDefId: target.minion.defId,
        fromBaseIndex: target.baseIndex,
        toBaseIndex: selectedBaseIndex,
        reason: 'goblins_bushwhacking_tails',
        now: context.now,
        sourcePlayerId: context.playerId,
        sourceCardUid: context.purpose.sourceCardUid,
        sourceDefId: context.purpose.sourceDefId,
        sourceControllerId: context.playerId,
        sourceBaseIndex: context.purpose.sourceBaseIndex,
        sourceKind: 'action',
    });
}

function buildDemolitionDestroyEvents(
    context: GoblinCoinProgramContext,
    state: SmashUpCore,
    cardUid: string | undefined,
): SmashUpEvent[] {
    if (context.purpose.kind !== 'demolition' || !cardUid) return [];
    return buildValidatedOngoingDetachEvents(state, {
        cardUid,
        reason: 'goblins_demolition_tails',
        now: context.now,
        expectedLocation: 'any',
        sourcePlayerId: context.playerId,
        sourceCardUid: context.purpose.sourceCardUid,
        sourceDefId: context.purpose.sourceDefId,
        sourceControllerId: context.playerId,
        sourceBaseIndex: context.purpose.sourceBaseIndex,
    });
}

const goblinChoicePromptProgram = createPromptProgram<GoblinChoicePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'goblins_choice',
    interactionSourceIds: [
        'goblins_diviner',
        'goblins_chaos_lord',
        'goblins_recruiters',
        'goblins_blaster',
        'goblins_bushwhacking',
        'goblins_demolition',
        'goblins_he_who_smelt_it',
        'base_goblin_caves',
    ],
    buildInteraction: (context) => {
        const state = context.matchState!.core;
        switch (context.choiceKind) {
            case 'diviner_change_discard':
                return createAbilityRuntimeSimpleChoice(
                    `goblins_diviner_discard_${context.now}`,
                    context.playerId,
                    '占卜师：选择弃掉一张牌来改变硬币结果',
                    [createSkipOption(), ...handCardOptions(state, context.playerId)],
                    {
                        titleKey: 'ui.goblins_diviner_discard_title',
                        sourceId: 'goblins_diviner',
                        targetType: 'generic',
                        genericIntent: 'mixed-card-and-control',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            case 'chaos_lord_counter_target':
                return createAbilityRuntimeSimpleChoice(
                    `goblins_chaos_lord_target_${context.now}`,
                    context.playerId,
                    '混沌领主：选择一个你的随从放置 +1 指示物',
                    minionTargetOptions(state, context.playerId, minion => minion.controller === context.playerId, CHAOS_LORD),
                    {
                        titleKey: 'ui.goblins_chaos_lord_target_title',
                        sourceId: 'goblins_chaos_lord',
                        targetType: 'minion',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            case 'discard_hand_cards': {
                const count = Math.min(context.choiceCount ?? 1, state.players[context.playerId]?.hand.length ?? 0);
                return createAbilityRuntimeSimpleChoice(
                    `goblins_discard_${context.playerId}_${context.now}`,
                    context.playerId,
                    count > 1 ? `选择弃掉 ${count} 张牌` : '选择弃掉一张牌',
                    handCardOptions(state, context.playerId),
                    {
                        sourceId: context.purpose.kind === 'goblin_caves' ? 'base_goblin_caves' : 'goblins_chaos_lord',
                        targetType: 'generic',
                        genericIntent: 'card-pool',
                        multi: { min: count, max: count },
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            }
            case 'recruiters_shuffle_discard':
                return createAbilityRuntimeSimpleChoice(
                    `goblins_recruiters_discard_${context.now}`,
                    context.playerId,
                    '哥布林招募员：选择弃牌堆一张牌洗回牌库',
                    [createSkipOption(), ...discardCardOptions(state, context.playerId)],
                    {
                        titleKey: 'ui.goblins_recruiters_discard_title',
                        sourceId: 'goblins_recruiters',
                        targetType: 'generic',
                        genericIntent: 'mixed-card-and-control',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            case 'blaster_heads_confirm':
                return createAbilityRuntimeSimpleChoice(
                    `goblins_blaster_heads_${context.now}`,
                    context.playerId,
                    '爆破手：是否让此随从直到回合结束 +2 力量？',
                    [
                        { id: 'confirm', label: '+2 力量', labelKey: 'ui.goblins_blaster_plus_power_option', value: { confirm: true }, displayMode: 'button' as const },
                        createSkipOption(),
                    ],
                    {
                        titleKey: 'ui.goblins_blaster_heads_title',
                        sourceId: 'goblins_blaster',
                        targetType: 'button',
                        buttonIntent: 'confirm-known-object',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            case 'blaster_tails_destination': {
                const source = context.purpose.kind === 'blaster'
                    ? findMinionOnBases(state, context.purpose.sourceCardUid)
                    : undefined;
                const candidates = state.bases
                    .map((base, baseIndex) => ({ baseIndex, label: base.defId }))
                    .filter(candidate => candidate.baseIndex !== source?.baseIndex);
                return createAbilityRuntimeSimpleChoice(
                    `goblins_blaster_tails_${context.now}`,
                    context.playerId,
                    '爆破手：选择要移动到的基地',
                    [createSkipOption(), ...buildBaseTargetOptions(candidates, state)],
                    {
                        titleKey: 'ui.goblins_blaster_tails_title',
                        sourceId: 'goblins_blaster',
                        targetType: 'generic',
                        genericIntent: 'mixed-card-and-control',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            }
            case 'bushwhacking_tails_destination': {
                const target = context.purpose.kind === 'bushwhacking'
                    ? findMinionOnBases(state, context.purpose.targetMinionUid ?? '')
                    : undefined;
                const candidates = state.bases
                    .map((base, baseIndex) => ({ baseIndex, label: base.defId }))
                    .filter(candidate => candidate.baseIndex !== target?.baseIndex);
                return createAbilityRuntimeSimpleChoice(
                    `goblins_bushwhacking_tails_${context.now}`,
                    context.playerId,
                    '伏击：选择要移动到的基地',
                    [createSkipOption(), ...buildBaseTargetOptions(candidates, state)],
                    {
                        titleKey: 'ui.goblins_bushwhacking_tails_title',
                        sourceId: 'goblins_bushwhacking',
                        targetType: 'generic',
                        genericIntent: 'mixed-card-and-control',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            }
            case 'demolition_counter_target':
                return createAbilityRuntimeSimpleChoice(
                    `goblins_demolition_counter_${context.now}`,
                    context.playerId,
                    '爆破：选择你的一个随从放置 +1 指示物',
                    minionTargetOptions(state, context.playerId, minion => minion.controller === context.playerId, 'goblins_demolition'),
                    {
                        titleKey: 'ui.goblins_demolition_counter_title',
                        sourceId: 'goblins_demolition',
                        targetType: 'minion',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            case 'demolition_destroy_action':
                return createAbilityRuntimeSimpleChoice(
                    `goblins_demolition_action_${context.now}`,
                    context.playerId,
                    '爆破：选择一个基地或随从上的行动摧毁',
                    [createSkipOption(), ...ongoingActionOptions(state)],
                    {
                        titleKey: 'ui.goblins_demolition_action_title',
                        sourceId: 'goblins_demolition',
                        targetType: 'generic',
                        genericIntent: 'mixed-card-and-control',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            case 'he_who_smelt_it_next_target': {
                const previousTarget = context.purpose.kind === 'he_who_smelt_it' ? context.purpose.targetMinionUid : undefined;
                return createAbilityRuntimeSimpleChoice(
                    `goblins_he_who_smelt_it_next_${context.now}`,
                    context.playerId,
                    '谁放的屁：是否选择另一个随从继续投硬币？',
                    [
                        createSkipOption(),
                        ...minionTargetOptions(
                            state,
                            context.playerId,
                            minion => minion.uid !== previousTarget,
                            'goblins_he_who_smelt_it',
                        ),
                    ],
                    {
                        titleKey: 'ui.goblins_he_who_smelt_it_next_title',
                        sourceId: 'goblins_he_who_smelt_it',
                        targetType: 'generic',
                        genericIntent: 'mixed-card-and-control',
                        responseValidationMode: 'live',
                        autoResolveIfSingle: false,
                    },
                );
            }
            default:
                return createAbilityRuntimeSimpleChoice(
                    `goblins_choice_${context.now}`,
                    context.playerId,
                    '哥布林：选择',
                    [createSkipOption()],
                    {
                        titleKey: 'ui.goblins_choice_title',
                        sourceId: 'goblins_choice',
                        targetType: 'button',
                        autoResolveIfSingle: false,
                    },
                );
        }
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const values = (Array.isArray(value) ? value : [value]) as Array<GoblinMinionChoice & GoblinCardChoice & GoblinBaseChoice & { confirm?: boolean; cardUid?: string }>;
        const selected = values.find(entry => !entry?.skip);
        const events = (() => {
            switch (context.choiceKind) {
                case 'diviner_change_discard': {
                    if (!selected?.cardUid) return [];
                    const preferredHeads = context.preferredResult === 'heads';
                    const diviner = allMinions(state.core, minion => minion.defId === DIVINER && minion.controller === context.playerId)
                        .find(source => source.minion.metadata?.goblinsDivinerChangeTurn !== state.core.turnNumber);
                    const card = state.core.players[context.playerId]?.hand.find(candidate => candidate.uid === selected.cardUid);
                    if (!diviner || !card) return [];
                    context.heads = preferredHeads;
                    return [
                        {
                            type: SU_EVENTS.CARDS_DISCARDED,
                            payload: { playerId: context.playerId, cardUids: [card.uid] },
                            timestamp,
                        } as SmashUpEvent,
                        markDivinerChangeUsed(diviner, state.core.turnNumber, context.reason + '_diviner_change', timestamp),
                    ];
                }
                case 'chaos_lord_counter_target':
                case 'demolition_counter_target': {
                    if (!selected?.minionUid || selected.baseIndex === undefined) return [];
                    const target = state.core.bases[selected.baseIndex]?.minions.find(minion =>
                        minion.uid === selected.minionUid
                        && (context.choiceKind !== 'demolition_counter_target' || minion.controller === context.playerId));
                    if (!target) return [];
                    return [addPowerCounter(
                        target.uid,
                        selected.baseIndex,
                        1,
                        context.choiceKind === 'chaos_lord_counter_target' ? context.reason + '_chaos_lord' : 'goblins_demolition_heads',
                        timestamp,
                    )];
                }
                case 'discard_hand_cards':
                    return discardSelectedHandCards(state.core, context.playerId, values, context.choiceCount ?? 1, timestamp);
                case 'recruiters_shuffle_discard': {
                    if (!selected?.cardUid) return [];
                    const card = state.core.players[context.playerId]?.discard.find(candidate => candidate.uid === selected.cardUid);
                    return card ? [shuffleDiscardCardIntoDeck(state.core, context.playerId, card, context.random, context.reason + '_goblin_recruiters', timestamp)] : [];
                }
                case 'blaster_heads_confirm':
                    return selected?.confirm ? buildBlasterHeadsEvents({ ...context, now: timestamp }, state.core) : [];
                case 'blaster_tails_destination':
                    return buildBlasterMoveEvents({ ...context, now: timestamp }, state.core, selected?.baseIndex);
                case 'bushwhacking_tails_destination':
                    return buildBushwhackingMoveEvents({ ...context, now: timestamp }, state.core, selected?.baseIndex);
                case 'demolition_destroy_action':
                    return buildDemolitionDestroyEvents({ ...context, now: timestamp }, state.core, selected?.cardUid);
                case 'he_who_smelt_it_next_target':
                    return [];
                default:
                    return [];
            }
        })();

        if (context.choiceKind === 'he_who_smelt_it_next_target') {
            if (!selected?.minionUid) return { events, matchState: state };
            const nextContext = stripChoiceContext(context, state, timestamp);
            if (nextContext.purpose.kind !== 'he_who_smelt_it') return { events, matchState: state };
            return {
                events,
                matchState: state,
                context: {
                    ...nextContext,
                    stage: 'start' as const,
                    heads: undefined,
                    afterEffects: undefined,
                    purpose: {
                        ...nextContext.purpose,
                        flipIndex: nextContext.purpose.flipIndex + 1,
                        targetMinionUid: selected.minionUid,
                    },
                },
                nextProgram: goblinCoinProgram,
            };
        }

        return continueAfterPrompt(context, state, timestamp, events);
    },
});

function buildCoinResultChangeEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    heads: boolean,
    now: number,
    reason: string,
    preferredResult?: CoinPreference,
): { heads: boolean; events: SmashUpEvent[] } {
    if (preferredResult === undefined) return { heads, events: [] };
    const preferredHeads = preferredResult === 'heads';
    if (heads === preferredHeads) return { heads, events: [] };

    const events: SmashUpEvent[] = [];
    const luckCard = state.players[playerId]?.hand.find(card => card.defId === MAKE_YOUR_OWN_LUCK);
    if (luckCard) {
        const play = actionPlayedFromHand(luckCard, playerId, now);
        events.push(play, {
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId,
                messageKey: 'feedback.goblins_make_your_own_luck_changed',
                level: 'info',
                metadata: { from: heads ? 'heads' : 'tails', to: preferredResult, reason },
            },
            timestamp: now,
        } as SmashUpEvent);
        return { heads: preferredHeads, events };
    }

    return { heads, events };
}

function canPromptDivinerChange(state: SmashUpCore, playerId: PlayerId): boolean {
    const diviner = allMinions(state, minion => minion.defId === DIVINER && minion.controller === playerId)
        .find(source => source.minion.metadata?.goblinsDivinerChangeTurn !== state.turnNumber);
    return !!diviner && (state.players[playerId]?.hand.length ?? 0) > 0;
}

function buildAfterOwnCoinFlipQueue(
    state: SmashUpCore,
    playerId: PlayerId,
): GoblinAfterCoinEffect[] {
    const effects: GoblinAfterCoinEffect[] = [];
    for (const source of allMinions(state, minion => minion.defId === CHAOS_LORD && minion.controller === playerId)) {
        effects.push({ kind: 'chaos_lord', sourceCardUid: source.minion.uid, sourceBaseIndex: source.baseIndex });
    }
    for (const source of allMinions(state, minion => minion.defId === DIVINER && minion.controller === playerId)) {
        if (source.minion.metadata?.goblinsDivinerDrawTurn === state.turnNumber) continue;
        effects.push({ kind: 'diviner_draw', sourceCardUid: source.minion.uid, sourceBaseIndex: source.baseIndex });
    }
    for (const [baseIndex, base] of state.bases.entries()) {
        for (const action of base.ongoingActions) {
            if (action.defId !== RECRUITERS || action.ownerId !== playerId) continue;
            effects.push({ kind: 'recruiters', sourceCardUid: action.uid, sourceBaseIndex: baseIndex });
        }
    }
    return effects;
}

function buildAfterOwnCoinFlipEffectEvents(
    state: SmashUpCore,
    effect: GoblinAfterCoinEffect,
    playerId: PlayerId,
    heads: boolean,
    random: RandomFn,
    now: number,
    reason: string,
): SmashUpEvent[] {
    switch (effect.kind) {
        case 'chaos_lord':
            return [];
        case 'diviner_draw': {
            const source = state.bases[effect.sourceBaseIndex]?.minions.find(minion => minion.uid === effect.sourceCardUid && minion.defId === DIVINER);
            if (!source || source.metadata?.goblinsDivinerDrawTurn === state.turnNumber) return [];
            return [
                ...buildStandardDrawEvents(state, playerId, 1, random, now),
                {
                    type: SU_EVENTS.MINION_METADATA_UPDATED,
                    payload: {
                        minionUid: source.uid,
                        baseIndex: effect.sourceBaseIndex,
                        metadataUpdate: { goblinsDivinerDrawTurn: state.turnNumber },
                        reason: reason + '_diviner_first_coin',
                    },
                    timestamp: now,
                } as SmashUpEvent,
            ];
        }
        case 'recruiters': {
            const active = state.bases[effect.sourceBaseIndex]?.ongoingActions.some(action => action.uid === effect.sourceCardUid && action.defId === RECRUITERS && action.ownerId === playerId);
            if (!active) return [];
            if (heads) return buildStandardDrawEvents(state, playerId, 1, random, now);
            return [];
        }
        default:
            return [];
    }
}

function executeGoblinPostCoinPurpose(context: GoblinCoinProgramContext, state: SmashUpCore) {
    const heads = context.heads === true;
    const purpose = context.purpose;
    switch (purpose.kind) {
        case 'a_little_help':
            return continueGoblinCoin(context, [
                heads
                    ? grantExtraMinion(context.playerId, 'goblins_a_little_help_heads', context.now)
                    : grantExtraAction(context.playerId, 'goblins_a_little_help_tails', context.now),
                ...(heads ? [] : [grantExtraAction(context.playerId, 'goblins_a_little_help_tails_second', context.now)]),
            ]);
        case 'blaster': {
            const source = findMinionOnBases(state, purpose.sourceCardUid);
            if (!source) return continueGoblinCoin(context, []);
            if (heads) {
                return {
                    events: [],
                    context: { ...context, choiceKind: 'blaster_heads_confirm' as const },
                    nextProgram: goblinChoicePromptProgram,
                };
            }
            if (purpose.targetBaseIndex === undefined) {
                return {
                    events: [],
                    context: { ...context, choiceKind: 'blaster_tails_destination' as const },
                    nextProgram: goblinChoicePromptProgram,
                };
            }
            return continueGoblinCoin(context, buildBlasterMoveEvents(context, state, purpose.targetBaseIndex));
        }
        case 'bushwhacking': {
            const target = findMinionOnBases(state, purpose.targetMinionUid ?? '');
            if (!target) return continueGoblinCoin(context, []);
            if (heads) {
                return continueGoblinCoin(context, buildValidatedDestroyEvents(state, {
                    minionUid: target.minion.uid,
                    minionDefId: target.minion.defId,
                    fromBaseIndex: target.baseIndex,
                    destroyerId: context.playerId,
                    reason: 'goblins_bushwhacking_heads',
                    now: context.now,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: purpose.sourceCardUid,
                    sourceDefId: purpose.sourceDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: purpose.sourceBaseIndex,
                    sourceKind: 'action',
                }));
            }
            if (purpose.targetBaseIndex === undefined) {
                if (!context.matchState) return continueGoblinCoin(context, []);
                return {
                    events: [],
                    context: { ...context, choiceKind: 'bushwhacking_tails_destination' as const },
                    nextProgram: goblinChoicePromptProgram,
                };
            }
            return continueGoblinCoin(context, buildBushwhackingMoveEvents(context, state, purpose.targetBaseIndex));
        }
        case 'goblin_town': {
            const minion = findMinionOnBases(state, purpose.minionUid);
            return continueGoblinCoin(context, heads && minion
                ? [addPowerCounter(minion.minion.uid, minion.baseIndex, 1, 'base_goblin_town_heads', context.now)]
                : []);
        }
        case 'magic_helmet':
            return continueGoblinCoin(context, heads ? [] : buildValidatedOngoingDetachEvents(state, {
                cardUid: purpose.sourceCardUid,
                reason: 'goblins_magic_helmet_tails',
                now: context.now,
                expectedLocation: 'minion',
                sourcePlayerId: purpose.sourceControllerId,
                sourceDefId: MAGIC_HELMET,
                sourceControllerId: purpose.sourceControllerId,
                sourceBaseIndex: purpose.sourceBaseIndex,
            }));
        case 'gobbo': {
            const headsCount = purpose.headsCount + (heads ? 1 : 0);
            if (purpose.remainingFlips > 1) {
                return continueGoblinCoin(context, [], {
                    ...context,
                    stage: 'start',
                    heads: undefined,
                    afterEffects: undefined,
                    purpose: { ...purpose, remainingFlips: purpose.remainingFlips - 1, headsCount },
                });
            }
            const target = findMinionOnBases(state, purpose.targetMinionUid);
            return continueGoblinCoin(context, headsCount > 0 && target
                ? [addPowerCounter(target.minion.uid, target.baseIndex, headsCount, 'goblins_gobbo', context.now)]
                : []);
        }
        case 'demolition': {
            const hasChoice = heads
                ? allMinions(state, minion => minion.controller === context.playerId).length > 0
                : ongoingActionOptions(state).length > 0;
            if (hasChoice) {
                return {
                    events: [],
                    context: {
                        ...context,
                        choiceKind: heads ? 'demolition_counter_target' as const : 'demolition_destroy_action' as const,
                    },
                    nextProgram: goblinChoicePromptProgram,
                };
            }
            return continueGoblinCoin(context, [], purpose.remainingFlips > 1 ? {
                ...context,
                stage: 'start',
                heads: undefined,
                afterEffects: undefined,
                purpose: { ...purpose, remainingFlips: purpose.remainingFlips - 1 },
            } : undefined);
        }
        case 'he_who_smelt_it':
            if (!heads) {
                return continueGoblinCoin(context, [grantExtraAction(context.playerId, 'goblins_he_who_smelt_it_tails', context.now)]);
            }
            if (purpose.flipIndex >= 50) return continueGoblinCoin(context, []);
            {
                const targets = allMinions(state, () => true);
                const target = purpose.targetMinionUid
                    ? targets.find(candidate => candidate.minion.uid === purpose.targetMinionUid)
                    : undefined;
                if (!target) return continueGoblinCoin(context, []);
                const remainingTargets = targets.filter(candidate => candidate.minion.uid !== target.minion.uid);
                if (remainingTargets.length === 0) {
                    return continueGoblinCoin(context, [addPowerCounter(target.minion.uid, target.baseIndex, 1, 'goblins_he_who_smelt_it_heads', context.now)]);
                }
                return {
                    events: [addPowerCounter(target.minion.uid, target.baseIndex, 1, 'goblins_he_who_smelt_it_heads', context.now)],
                    context: {
                        ...context,
                        choiceKind: 'he_who_smelt_it_next_target' as const,
                        purpose: { ...purpose, targetMinionUid: target.minion.uid },
                    },
                    nextProgram: goblinChoicePromptProgram,
                };
            }
        case 'revving_up': {
            const minionUid = purpose.minionUids[purpose.index];
            const events = minionUid
                ? [heads
                    ? addPowerCounter(minionUid, purpose.baseIndex, 1, 'goblins_revving_up_heads', context.now)
                    : addTempPower(minionUid, purpose.baseIndex, 2, 'goblins_revving_up_tails', context.now)]
                : [];
            return continueGoblinCoin(context, events, purpose.index + 1 < purpose.minionUids.length ? {
                ...context,
                stage: 'start',
                heads: undefined,
                afterEffects: undefined,
                purpose: { ...purpose, index: purpose.index + 1 },
            } : undefined);
        }
        case 'goblin_caves': {
            const playerId = purpose.playerIds[purpose.index];
            if (!playerId) return continueGoblinCoin(context, []);
            if (heads) {
                return continueGoblinCoin(context, [{
                    type: SU_EVENTS.VP_AWARDED,
                    payload: { playerId, amount: 1, reason: 'base_goblin_caves_heads' },
                    timestamp: context.now,
                } as SmashUpEvent], purpose.index + 1 < purpose.playerIds.length ? {
                    ...context,
                    stage: 'start',
                    playerId: purpose.playerIds[purpose.index + 1],
                    heads: undefined,
                    afterEffects: undefined,
                    purpose: { ...purpose, index: purpose.index + 1 },
                } : undefined);
            }
            const discardCount = Math.min(2, state.players[playerId]?.hand.length ?? 0);
            if (discardCount > 0) {
                return {
                    events: [],
                    context: {
                        ...context,
                        playerId,
                        choiceKind: 'discard_hand_cards' as const,
                        choiceCount: discardCount,
                    },
                    nextProgram: goblinChoicePromptProgram,
                };
            }
            return continueGoblinCoin(context, [], purpose.index + 1 < purpose.playerIds.length ? {
                ...context,
                stage: 'start',
                playerId: purpose.playerIds[purpose.index + 1],
                heads: undefined,
                afterEffects: undefined,
                purpose: { ...purpose, index: purpose.index + 1 },
            } : undefined);
        }
        default:
            return continueGoblinCoin(context, []);
    }
}

const goblinCoinProgram = createEffectProgram<
    GoblinCoinProgramContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    const matchState = requireGoblinMatchState(context);
    const random = requireGoblinRandom(context);
    const stage = context.stage ?? 'start';
    if (stage === 'start') {
        if (context.initialEvents && context.initialEvents.length > 0) {
            return continueGoblinCoin(context, context.initialEvents, {
                ...context,
                initialEvents: undefined,
            });
        }
        const rawHeads = flip(random);
        const changed = buildCoinResultChangeEvents(matchState.core, context.playerId, rawHeads, context.now, context.reason, context.preferredResult);
        if (
            context.preferredResult !== undefined
            && changed.heads !== (context.preferredResult === 'heads')
            && canPromptDivinerChange(matchState.core, context.playerId)
        ) {
            return {
                events: changed.events,
                context: {
                    ...context,
                    stage: 'after-change' as const,
                    heads: changed.heads,
                    initialEvents: undefined,
                    choiceKind: 'diviner_change_discard' as const,
                },
                nextProgram: goblinChoicePromptProgram,
            };
        }
        return continueGoblinCoin(context, changed.events, {
            ...context,
            stage: 'after-change',
            heads: changed.heads,
            initialEvents: undefined,
        });
    }
    if (stage === 'after-change') {
        return continueGoblinCoin(context, [], {
            ...context,
            stage: 'after-effects',
            afterEffects: buildAfterOwnCoinFlipQueue(matchState.core, context.playerId),
        });
    }
    if (stage === 'after-effects') {
        const [effect, ...remainingEffects] = context.afterEffects ?? [];
        if (!effect) {
            return continueGoblinCoin(context, [], { ...context, stage: 'post-coin' });
        }
        if (effect.kind === 'chaos_lord') {
            const active = matchState.core.bases[effect.sourceBaseIndex]?.minions.some(minion =>
                minion.uid === effect.sourceCardUid && minion.defId === CHAOS_LORD);
            if (!active) return continueGoblinCoin(context, [], { ...context, afterEffects: remainingEffects });
            if (context.heads === true) {
                if (allMinions(matchState.core, minion => minion.controller === context.playerId).length === 0) {
                    return continueGoblinCoin(context, [], { ...context, afterEffects: remainingEffects });
                }
                return {
                    events: [],
                    context: {
                        ...context,
                        afterEffects: remainingEffects,
                        choiceKind: 'chaos_lord_counter_target' as const,
                    },
                    nextProgram: goblinChoicePromptProgram,
                };
            }
            const drawEvents = buildStandardDrawEvents(matchState.core, context.playerId, 1, random, context.now);
            const canDiscardAfterDraw = (matchState.core.players[context.playerId]?.hand.length ?? 0) > 0
                || drawEvents.some(event => event.type === SU_EVENTS.CARDS_DRAWN);
            if (!canDiscardAfterDraw) {
                return continueGoblinCoin(context, drawEvents, { ...context, afterEffects: remainingEffects });
            }
            return {
                events: drawEvents,
                context: {
                    ...context,
                    afterEffects: remainingEffects,
                    choiceKind: 'discard_hand_cards' as const,
                    choiceCount: 1,
                },
                nextProgram: goblinChoicePromptProgram,
            };
        }
        if (effect.kind === 'recruiters' && context.heads !== true) {
            const active = matchState.core.bases[effect.sourceBaseIndex]?.ongoingActions.some(action =>
                action.uid === effect.sourceCardUid && action.defId === RECRUITERS && action.ownerId === context.playerId);
            if (!active || (matchState.core.players[context.playerId]?.discard.length ?? 0) === 0) {
                return continueGoblinCoin(context, [], { ...context, afterEffects: remainingEffects });
            }
            return {
                events: [],
                context: {
                    ...context,
                    afterEffects: remainingEffects,
                    choiceKind: 'recruiters_shuffle_discard' as const,
                },
                nextProgram: goblinChoicePromptProgram,
            };
        }
        return continueGoblinCoin(
            context,
            buildAfterOwnCoinFlipEffectEvents(matchState.core, effect, context.playerId, context.heads === true, random, context.now, context.reason),
            {
                ...context,
                afterEffects: remainingEffects,
            },
        );
    }
    return executeGoblinPostCoinPurpose(context, matchState.core);
});

function runGoblinCoin(context: GoblinCoinProgramContext): AbilityResult {
    const result = executeAbilityProgram(goblinCoinProgram, context);
    return {
        events: result.events as SmashUpEvent[],
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function gobboOnPlay(ctx: AbilityContext): AbilityResult {
    const target = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!target) return { events: [] };
    const gobboCount = allMinions(ctx.state, minion => minion.defId === GOBBO).length;
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_gobbo',
        preferredResult: 'heads',
        purpose: { kind: 'gobbo', targetMinionUid: target.minion.uid, remainingFlips: gobboCount, headsCount: 0 },
    });
}

function blasterBeforeScoring(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const limitEvent = emitSpecialLimitUsed(ctx.playerId, BLASTER, source.baseIndex, ctx.now);
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_blaster',
        preferredResult: ctx.targetBaseIndex !== undefined ? 'tails' : 'heads',
        initialEvents: limitEvent ? [limitEvent] : undefined,
        purpose: { kind: 'blaster', sourceCardUid: source.minion.uid, targetBaseIndex: ctx.targetBaseIndex },
    });
}

function aLittleHelp(ctx: AbilityContext): AbilityResult {
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_a_little_help',
        purpose: { kind: 'a_little_help' },
    });
}

function findTargetMinion(ctx: AbilityContext): LocatedMinion | undefined {
    if (ctx.targetMinionUid) return findMinionOnBases(ctx.state, ctx.targetMinionUid);
    return undefined;
}

function bushwhacking(ctx: AbilityContext): AbilityResult {
    const target = findTargetMinion(ctx);
    if (!target) return { events: [] };
    if (!ctx.matchState && target.minion.controller === ctx.playerId && ctx.targetBaseIndex === undefined) {
        return { events: [] };
    }
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_bushwhacking',
        preferredResult: target.minion.controller === ctx.playerId ? 'tails' : 'heads',
        purpose: {
            kind: 'bushwhacking',
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            targetMinionUid: target.minion.uid,
            targetBaseIndex: ctx.targetBaseIndex,
        },
    });
}

function demolition(ctx: AbilityContext): AbilityResult {
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_demolition',
        purpose: {
            kind: 'demolition',
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            remainingFlips: 3,
            targetMinionUid: ctx.targetMinionUid,
            targetBaseIndex: ctx.targetBaseIndex,
        },
    });
}

function heWhoSmeltIt(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid || !findMinionOnBases(ctx.state, ctx.targetMinionUid)) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_he_who_smelt_it',
        purpose: { kind: 'he_who_smelt_it', flipIndex: 0, targetMinionUid: ctx.targetMinionUid },
    });
}

function makeYourOwnLuck(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: { playerId: ctx.playerId, messageKey: 'feedback.goblins_make_your_own_luck_ready', level: 'info' },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function revvingUp(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const minionUids = base.minions.filter(candidate => candidate.controller === ctx.playerId).map(minion => minion.uid);
    if (minionUids.length === 0) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.playerId,
        now: ctx.now,
        reason: 'goblins_revving_up',
        purpose: { kind: 'revving_up', minionUids, baseIndex, index: 0 },
    });
}

function magicHelmetBeforeScoring(ctx: TriggerContext): TriggerResult {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId) return { events: [] };
    const host = findMinionByAttachedCard(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.baseIndex) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        reason: 'goblins_magic_helmet',
        preferredResult: 'heads',
        purpose: {
            kind: 'magic_helmet',
            sourceCardUid: ctx.sourceCardUid,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: host.baseIndex,
        },
    });
}

function canTriggerMagicHelmetBeforeScoring(ctx: TriggerContext): boolean {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId) return false;
    const host = findMinionByAttachedCard(ctx.state, ctx.sourceCardUid);
    return !!host && host.baseIndex === ctx.baseIndex;
}

function goblinTownOnMinionPlayed(ctx: BaseAbilityContext) {
    if (!ctx.minionUid || ctx.baseDefId !== 'base_goblin_town') return { events: [] };
    const minion = ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.minionUid);
    if (!minion) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: minion.controller,
        now: ctx.now,
        reason: 'base_goblin_town',
        preferredResult: 'heads',
        purpose: { kind: 'goblin_town', minionUid: minion.uid, baseIndex: ctx.baseIndex },
    });
}

function goblinCavesAfterScoring(ctx: BaseAbilityContext) {
    const playerIds = [...new Set((ctx.state.bases[ctx.baseIndex]?.minions ?? []).map(minion => minion.controller))];
    if (playerIds.length === 0) return { events: [] };
    return runGoblinCoin({
        matchState: ctx.matchState,
        random: ctx.random,
        playerId: playerIds[0],
        now: ctx.now,
        reason: 'base_goblin_caves',
        purpose: { kind: 'goblin_caves', playerIds, baseIndex: ctx.baseIndex, index: 0 },
    });
}

export function registerGoblinAbilities(): void {
    registerAbility(CHAOS_LORD, 'ongoing', () => ({ events: [] }));
    registerAbility(DIVINER, 'ongoing', () => ({ events: [] }));
    registerAbility(BLASTER, 'special', blasterBeforeScoring);
    registerAbility(GOBBO, 'onPlay', gobboOnPlay);
    registerAbility('goblins_a_little_help', 'onPlay', aLittleHelp);
    registerAbility('goblins_bushwhacking', 'onPlay', bushwhacking);
    registerAbility('goblins_demolition', 'onPlay', demolition);
    registerAbility(RECRUITERS, 'ongoing', () => ({ events: [] }));
    registerAbility('goblins_he_who_smelt_it', 'onPlay', heWhoSmeltIt);
    registerAbility('goblins_make_your_own_luck', 'special', makeYourOwnLuck);
    registerAbility('goblins_revving_up', 'onPlay', revvingUp);

    registerTrigger(MAGIC_HELMET, 'beforeScoring', magicHelmetBeforeScoring, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerMagicHelmetBeforeScoring,
    });
    registerBaseAbility('base_goblin_town', 'onMinionPlayed', goblinTownOnMinionPlayed);
    registerBaseAbility('base_goblin_caves', 'afterScoring', goblinCavesAfterScoring, {
        mandatory: false,
        canTrigger: ctx => (ctx.state.bases[ctx.baseIndex]?.minions ?? []).length > 0,
    });
}
