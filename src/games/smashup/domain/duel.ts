import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import {
    addPowerCounter,
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    findMinionOnBases,
    getMinionPower,
} from './abilityHelpers';
import { getCardDef, getBaseDef } from '../data/cards';
import { fireTriggers } from './ongoingEffects';
import { validateActionPlaySemantics } from './playLegality';
import { buildActionPlayedEvent } from './actionPlayEvent';
import { createEffectProgram, executeAbilityProgram } from './abilityRuntime';
import { appendResolvedActionAbility, type ExternalActionAbilityContinuationContext } from './externalActionPlay';
import type {
    ActionCardDef,
    ActiveDuel,
    DuelOutcomeKind,
    FusionCardDef,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
    VpAwardedEvent,
} from './types';
import { SU_EVENTS } from './types';

type DuelStage =
    | 'pinkerton_challenger'
    | 'pinkerton_challenged'
    | 'card_challenger'
    | 'card_challenged'
    | 'deputy_challenger'
    | 'deputy_challenged'
    | 'resolve';

function isDuelStage(value: unknown): value is DuelStage {
    return value === 'pinkerton_challenger'
        || value === 'pinkerton_challenged'
        || value === 'card_challenger'
        || value === 'card_challenged'
        || value === 'deputy_challenger'
        || value === 'deputy_challenged'
        || value === 'resolve';
}

function isDeputyStage(value: unknown): value is 'deputy_challenger' | 'deputy_challenged' {
    return value === 'deputy_challenger' || value === 'deputy_challenged';
}

const advanceDuelStageAfterActionProgram = createEffectProgram<
    ExternalActionAbilityContinuationContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('duel action continuation 缺少正式 matchState');
    }
    if (!context.duel) {
        throw new Error('duel action continuation 缺少 duel 上下文');
    }
    const nextStage = context.afterActionContext?.nextStage;
    if (!isDuelStage(nextStage)) {
        throw new Error('duel action continuation 缺少 nextStage');
    }
    return advanceQueuedStage(context.matchState, context.duel, nextStage, context.timestamp);
});

type PinkertonContinuation = {
    duel: ActiveDuel;
    stage: 'pinkerton_challenger' | 'pinkerton_challenged';
};

type DuelCardContinuation = {
    duel: ActiveDuel;
    stage: 'card_challenger' | 'card_challenged';
};

type DuelActionTargetContinuation = {
    duel: ActiveDuel;
    nextStage: DuelStage;
    cardUid: string;
    defId: string;
    targetType: 'base' | 'minion';
};

type DeputyPromptContinuation = {
    duel: ActiveDuel;
    stage: 'deputy_challenger' | 'deputy_challenged';
    consecutivePasses: number;
};

type DeputyTargetContinuation = {
    duel: ActiveDuel;
    nextStage: DuelStage;
    deputyCardUid: string;
};

type StartDuelParams = {
    sourceId: string;
    sourcePlayerId: PlayerId;
    challengerMinionUid: string;
    challengedMinionUid: string;
    outcome: DuelOutcomeKind;
    destroyReason?: string;
};

interface DuelDeputyAdvanceContinuationContext {
    matchState?: MatchState<SmashUpCore>;
    duel: ActiveDuel;
    nextStage: 'deputy_challenger' | 'deputy_challenged';
    consecutivePasses: number;
    timestamp: number;
}

interface EmitDuelEventsThenAdvanceDeputyContext extends DuelDeputyAdvanceContinuationContext {
    events: SmashUpEvent[];
}

interface DuelResolvedTriggerContinuationContext {
    matchState?: MatchState<SmashUpCore>;
    random?: RandomFn;
    duel: ActiveDuel;
    baseIndex: number;
    duelChallenger: MinionOnBase;
    duelChallenged: MinionOnBase;
    duelWinner?: MinionOnBase;
    duelLoser?: MinionOnBase;
    duelTie: boolean;
    timestamp: number;
}

interface EmitDuelResolutionEventsThenTriggerContext extends DuelResolvedTriggerContinuationContext {
    events: SmashUpEvent[];
}

interface DuelStartedAdvanceContinuationContext {
    matchState?: MatchState<SmashUpCore>;
    duel: ActiveDuel;
    timestamp: number;
}

interface EmitDuelStartedEventsThenAdvanceContext extends DuelStartedAdvanceContinuationContext {
    events: SmashUpEvent[];
}

const advanceDeputyStageAfterEventsProgram = createEffectProgram<
    DuelDeputyAdvanceContinuationContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('duel deputy continuation 缺少正式 matchState');
    }
    return advanceDeputyStage(
        context.matchState,
        context.duel,
        context.nextStage,
        context.consecutivePasses,
        context.timestamp,
    );
});

const emitDuelEventsThenAdvanceDeputyProgram = createEffectProgram<
    EmitDuelEventsThenAdvanceDeputyContext,
    SmashUpCore,
    SmashUpEvent
>((context) => ({
    events: context.events,
    context: {
        matchState: context.matchState,
        duel: context.duel,
        nextStage: context.nextStage,
        consecutivePasses: context.consecutivePasses,
        timestamp: context.timestamp,
    } satisfies DuelDeputyAdvanceContinuationContext,
    nextProgram: advanceDeputyStageAfterEventsProgram,
}));

const fireDuelResolvedTriggersAfterEventsProgram = createEffectProgram<
    DuelResolvedTriggerContinuationContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('duel resolved continuation 缺少正式 matchState');
    }
    if (!context.random) {
        throw new Error('duel resolved continuation 缺少随机源');
    }
    const duelResolved = fireTriggers(context.matchState.core, 'onDuelResolved', {
        state: context.matchState.core,
        matchState: context.matchState,
        playerId: context.duel.sourcePlayerId,
        baseIndex: context.baseIndex,
        duel: context.duel,
        duelSourceId: context.duel.sourceId,
        duelOutcome: context.duel.outcome,
        duelChallenger: context.duelChallenger,
        duelChallenged: context.duelChallenged,
        duelWinner: context.duelWinner,
        duelLoser: context.duelLoser,
        duelTie: context.duelTie,
        random: context.random,
        now: context.timestamp,
    });

    return {
        events: duelResolved.events,
        matchState: duelResolved.matchState,
    };
});

const emitDuelResolutionEventsThenTriggerProgram = createEffectProgram<
    EmitDuelResolutionEventsThenTriggerContext,
    SmashUpCore,
    SmashUpEvent
>((context) => ({
    events: context.events,
    context: {
        matchState: context.matchState,
        random: context.random,
        duel: context.duel,
        baseIndex: context.baseIndex,
        duelChallenger: context.duelChallenger,
        duelChallenged: context.duelChallenged,
        duelWinner: context.duelWinner,
        duelLoser: context.duelLoser,
        duelTie: context.duelTie,
        timestamp: context.timestamp,
    } satisfies DuelResolvedTriggerContinuationContext,
    nextProgram: fireDuelResolvedTriggersAfterEventsProgram,
}));

const queueFirstDuelStageAfterStartedEventsProgram = createEffectProgram<
    DuelStartedAdvanceContinuationContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('duel started continuation 缺少正式 matchState');
    }
    return {
        events: [],
        matchState: queueNextDuelStage(context.matchState, context.duel, 'pinkerton_challenger', context.timestamp),
    };
});

const emitDuelStartedEventsThenAdvanceProgram = createEffectProgram<
    EmitDuelStartedEventsThenAdvanceContext,
    SmashUpCore,
    SmashUpEvent
>((context) => ({
    events: context.events,
    context: {
        matchState: context.matchState,
        duel: context.duel,
        timestamp: context.timestamp,
    } satisfies DuelStartedAdvanceContinuationContext,
    nextProgram: queueFirstDuelStageAfterStartedEventsProgram,
}));

function buildDuelEffectSource(
    duel: ActiveDuel,
    options?: {
        sourceDefId?: string;
        sourceKind?: 'action' | 'nonAction';
        sourceBaseIndex?: number;
    },
) {
    return {
        sourcePlayerId: duel.sourcePlayerId,
        sourceDefId: options?.sourceDefId ?? duel.sourceId,
        sourceControllerId: duel.sourcePlayerId,
        sourceBaseIndex: options?.sourceBaseIndex ?? duel.baseIndex,
        ...(options?.sourceKind !== undefined ? { sourceKind: options.sourceKind } : {}),
    };
}

function withActiveDuel(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel | undefined,
): MatchState<SmashUpCore> {
    return {
        ...state,
        core: {
            ...state.core,
            activeDuel: duel,
        },
    };
}

function duelEndedEvent(duel: ActiveDuel, reason: 'resolved' | 'invalid', now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.DUEL_ENDED,
        payload: { duelId: duel.id, reason },
        timestamp: now,
    } as SmashUpEvent;
}

function isPinkertonDefId(defId: string): boolean {
    return defId === 'cowboys_pinkerton' || defId === 'cowboys_pinkerton_pod';
}

function isDeputyDefId(defId: string): boolean {
    return defId === 'cowboys_deputy' || defId === 'cowboys_deputy_pod';
}

function countPinkertons(core: SmashUpCore, playerId: PlayerId): number {
    let count = 0;
    for (const base of core.bases) {
        for (const minion of base.minions) {
            if (minion.controller === playerId && isPinkertonDefId(minion.defId)) {
                count += 1;
            }
        }
    }
    return count;
}

function getDuelMinionUid(duel: ActiveDuel, playerId: PlayerId): string | undefined {
    if (duel.challengerPlayerId === playerId) return duel.challengerMinionUid;
    if (duel.challengedPlayerId === playerId) return duel.challengedMinionUid;
    return undefined;
}

function getStagePlayerId(duel: ActiveDuel, stage: DuelStage): PlayerId | undefined {
    switch (stage) {
        case 'pinkerton_challenger':
        case 'card_challenger':
        case 'deputy_challenger':
            return duel.challengerPlayerId;
        case 'pinkerton_challenged':
        case 'card_challenged':
        case 'deputy_challenged':
            return duel.challengedPlayerId;
        case 'resolve':
        default:
            return undefined;
    }
}

function getStageTitle(stage: DuelStage): string {
    switch (stage) {
        case 'pinkerton_challenger':
        case 'pinkerton_challenged':
            return 'ui.duel_prompt_pinkerton_title';
        case 'card_challenger':
        case 'card_challenged':
            return 'ui.duel_prompt_card_title';
        case 'deputy_challenger':
        case 'deputy_challenged':
            return 'ui.duel_prompt_deputy_title';
        case 'resolve':
        default:
            return 'ui.duel_prompt_resolve_title';
    }
}

function queuePinkertonPrompt(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    stage: 'pinkerton_challenger' | 'pinkerton_challenged',
    now: number,
): MatchState<SmashUpCore> {
    const playerId = getStagePlayerId(duel, stage);
    if (!playerId) return state;
    const pinkertons = countPinkertons(state.core, playerId);
    if (pinkertons <= 0) {
        return queueNextDuelStage(state, duel, stage === 'pinkerton_challenger' ? 'pinkerton_challenged' : 'card_challenger', now);
    }

    const options = Array.from({ length: pinkertons + 1 }, (_, index) => ({
        id: `pinkerton-${index}`,
        label: index === 0 ? '不放置指示物' : `放置 ${index} 个指示物`,
        labelKey: index === 0 ? 'ui.duel_option_no_counters' : 'ui.duel_option_add_counters',
        labelParams: index === 0 ? undefined : { count: index },
        value: { amount: index },
        displayMode: 'button' as const,
    }));
    const interaction = createSimpleChoice(
        `smashup_duel_pinkerton_${duel.id}_${stage}_${now}`,
        playerId,
        getStageTitle(stage),
        options,
        { sourceId: 'smashup_duel_pinkerton', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = {
        duel,
        stage,
    } satisfies PinkertonContinuation;
    return queueInteraction(state, interaction);
}

function buildDuelHandOptions(state: MatchState<SmashUpCore>, playerId: PlayerId) {
    const player = state.core.players[playerId];
    return (player?.hand ?? []).map(card => ({
        id: `duel-card-${card.uid}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function queueDuelCardPrompt(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    stage: 'card_challenger' | 'card_challenged',
    now: number,
): MatchState<SmashUpCore> {
    const playerId = getStagePlayerId(duel, stage);
    if (!playerId) return state;
    const interaction = createSimpleChoice(
        `smashup_duel_card_${duel.id}_${stage}_${now}`,
        playerId,
        getStageTitle(stage),
        [
            ...buildDuelHandOptions(state, playerId),
            {
                ...createSkipOption('跳过（不出决斗牌）', 'ui.duel_option_skip_duel_card'),
                labelKey: 'ui.duel_option_skip_duel_card',
            },
        ] as any[],
        { sourceId: 'smashup_duel_card', targetType: 'hand', autoRefresh: 'hand' },
    );
    (interaction.data as any).continuationContext = {
        duel,
        stage,
    } satisfies DuelCardContinuation;
    return queueInteraction(state, interaction);
}

function collectDeputiesInHand(state: MatchState<SmashUpCore>, playerId: PlayerId) {
    const player = state.core.players[playerId];
    return (player?.hand ?? [])
        .filter(card => isDeputyDefId(card.defId))
        .map(card => ({
            id: `deputy-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        }));
}

function queueDeputyPrompt(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    stage: 'deputy_challenger' | 'deputy_challenged',
    consecutivePasses: number,
    now: number,
): MatchState<SmashUpCore> {
    const playerId = getStagePlayerId(duel, stage);
    if (!playerId) return resolveDuelResult(state, duel, DEFAULT_RANDOM, now).state;
    const deputyOptions = collectDeputiesInHand(state, playerId);
    if (deputyOptions.length === 0) {
        const nextPasses = consecutivePasses + 1;
        if (nextPasses >= 2) return resolveDuelResult(state, duel, DEFAULT_RANDOM, now).state;
        return queueDeputyPrompt(
            state,
            duel,
            stage === 'deputy_challenger' ? 'deputy_challenged' : 'deputy_challenger',
            nextPasses,
            now,
        );
    }

    const interaction = createSimpleChoice(
        `smashup_duel_deputy_${duel.id}_${stage}_${now}`,
        playerId,
        getStageTitle(stage),
        [
            ...deputyOptions,
            {
                ...createSkipOption('跳过（不弃副警长）', 'ui.duel_option_skip_deputy'),
                labelKey: 'ui.duel_option_skip_deputy',
            },
        ] as any[],
        { sourceId: 'smashup_duel_deputy_card', targetType: 'hand', autoRefresh: 'hand' },
    );
    (interaction.data as any).continuationContext = {
        duel,
        stage,
        consecutivePasses,
    } satisfies DeputyPromptContinuation;
    return queueInteraction(state, interaction);
}

function queueDeputyTargetPrompt(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    deputyCardUid: string,
    nextStage: DuelStage,
    playerId: PlayerId,
    now: number,
): MatchState<SmashUpCore> {
    const minionOptions = state.core.bases.flatMap((base, baseIndex) => (
        base.minions.map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }))
    ));
    const interaction = createSimpleChoice(
        `smashup_duel_deputy_target_${duel.id}_${now}`,
        playerId,
        'ui.duel_prompt_deputy_target_title',
        buildMinionTargetOptions(minionOptions, { state: state.core, sourcePlayerId: playerId }) as any[],
        { sourceId: 'smashup_duel_deputy_target', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        duel,
        nextStage,
        deputyCardUid,
    } satisfies DeputyTargetContinuation;
    return queueInteraction(state, interaction);
}

function queueOngoingTargetPrompt(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    nextStage: DuelStage,
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    targetType: 'base' | 'minion',
    now: number,
): MatchState<SmashUpCore> {
    if (targetType === 'base') {
        const baseOptions = state.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            }))
            .filter(candidate => validateActionPlaySemantics(state.core, playerId, {
                defId,
                targetBaseIndex: candidate.baseIndex,
            }).valid);
        const interaction = createSimpleChoice(
            `smashup_duel_action_target_base_${duel.id}_${now}`,
            playerId,
            'ui.duel_prompt_ongoing_base_title',
            buildBaseTargetOptions(baseOptions, state.core),
            { sourceId: 'smashup_duel_action_target_base', targetType: 'base' },
        );
        (interaction.data as any).continuationContext = {
            duel,
            nextStage,
            cardUid,
            defId,
            targetType: 'base',
        } satisfies DuelActionTargetContinuation;
        return queueInteraction(state, interaction);
    }

    const minionOptions = state.core.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter(minion => validateActionPlaySemantics(state.core, playerId, {
                defId,
                targetBaseIndex: baseIndex,
                targetMinionUid: minion.uid,
            }).valid)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }))
    ));
    const interaction = createSimpleChoice(
        `smashup_duel_action_target_minion_${duel.id}_${now}`,
        playerId,
        'ui.duel_prompt_ongoing_minion_title',
        buildMinionTargetOptions(minionOptions, { state: state.core, sourcePlayerId: playerId }) as any[],
        { sourceId: 'smashup_duel_action_target_minion', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        duel,
        nextStage,
        cardUid,
        defId,
        targetType: 'minion',
    } satisfies DuelActionTargetContinuation;
    return queueInteraction(state, interaction);
}

function queueNextDuelStage(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    stage: DuelStage,
    now: number,
): MatchState<SmashUpCore> {
    switch (stage) {
        case 'pinkerton_challenger':
        case 'pinkerton_challenged':
            return queuePinkertonPrompt(state, duel, stage, now);
        case 'card_challenger':
        case 'card_challenged':
            return queueDuelCardPrompt(state, duel, stage, now);
        case 'deputy_challenger':
        case 'deputy_challenged':
            return queueDeputyPrompt(state, duel, stage, 0, now);
        case 'resolve':
        default:
            return state;
    }
}

function advanceDeputyStage(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    stage: 'deputy_challenger' | 'deputy_challenged',
    consecutivePasses: number,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const playerId = getStagePlayerId(duel, stage);
    if (!playerId) return resolveDuelResult(state, duel, DEFAULT_RANDOM, now);

    const deputyOptions = collectDeputiesInHand(state, playerId);
    if (deputyOptions.length === 0) {
        const nextPasses = consecutivePasses + 1;
        if (nextPasses >= 2) return resolveDuelResult(state, duel, DEFAULT_RANDOM, now);
        return advanceDeputyStage(
            state,
            duel,
            stage === 'deputy_challenger' ? 'deputy_challenged' : 'deputy_challenger',
            nextPasses,
            now,
        );
    }

    return {
        state: queueDeputyPrompt(state, duel, stage, consecutivePasses, now),
        events: [],
    };
}

function advanceQueuedStage(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    nextStage: DuelStage,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    switch (nextStage) {
        case 'deputy_challenger':
        case 'deputy_challenged':
            return advanceDeputyStage(state, duel, nextStage, 0, now);
        case 'resolve':
            return resolveDuelResult(state, duel, DEFAULT_RANDOM, now);
        default:
            return { state: queueNextDuelStage(state, duel, nextStage, now), events: [] };
    }
}

function playActionAsDuelCard(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    nextStage: DuelStage,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const player = state.core.players[playerId];
    const card = player?.hand.find(entry => entry.uid === cardUid);
    if (!card) {
        return advanceQueuedStage(state, duel, nextStage, now);
    }

    const def = getCardDef(defId) as ActionCardDef | FusionCardDef | undefined;
    const subtype = (def as any)?.type === 'fusion'
        ? (def as FusionCardDef).actionSubtype
        : (def as ActionCardDef | undefined)?.subtype;

    if (subtype === 'ongoing') {
        const ongoingTarget = (def as any)?.type === 'fusion'
            ? ((def as FusionCardDef).actionOngoingTarget ?? 'base')
            : ((def as ActionCardDef | undefined)?.ongoingTarget ?? 'base');
        return {
            state: queueOngoingTargetPrompt(state, duel, nextStage, playerId, cardUid, defId, ongoingTarget, now),
            events: [],
        };
    }

    const events: SmashUpEvent[] = [buildActionPlayedEvent({
        playerId,
        cardUid,
        defId,
        ownerId: card.owner,
        targetBaseIndex: duel.baseIndex,
        timestamp: now,
    }) as SmashUpEvent];

    return appendResolvedActionAbility({
        state,
        events,
        playerId,
        cardUid,
        defId,
        baseIndex: duel.baseIndex,
        random,
        timestamp: now,
        duel,
        afterActionContext: { nextStage },
        abilityRequirementContext: 'duel.playActionAsDuelCard',
        afterActionProgram: advanceDuelStageAfterActionProgram,
    });
}

function playOngoingActionAsDuelCard(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    duel: ActiveDuel,
    defId: string,
    cardUid: string,
    targetBaseIndex: number,
    targetMinionUid: string | undefined,
    nextStage: DuelStage,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const card = state.core.players[playerId]?.hand.find(entry => entry.uid === cardUid);
    const ownerId = card?.owner ?? playerId;
    const events: SmashUpEvent[] = [
        buildActionPlayedEvent({
            playerId,
            cardUid,
            defId,
            ownerId,
            targetBaseIndex,
            targetMinionUid,
            timestamp: now,
        }) as SmashUpEvent,
        {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid,
                defId,
                ownerId,
                ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
                targetType: targetMinionUid ? 'minion' : 'base',
                targetBaseIndex,
                targetMinionUid,
            },
            timestamp: now,
        } as SmashUpEvent,
    ];

    return appendResolvedActionAbility({
        state,
        events,
        playerId,
        cardUid,
        defId,
        baseIndex: targetBaseIndex,
        targetBaseIndex,
        targetMinionUid,
        random,
        timestamp: now,
        duel,
        afterActionContext: { nextStage },
        abilityRequirementContext: 'duel.playActionAsDuelCard',
        afterActionProgram: advanceDuelStageAfterActionProgram,
    });
}

function buildRunEmOffTieMovePrompts(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const currentPlayerId = state.core.turnOrder[state.core.currentPlayerIndex];
    const orderedPlayers = [duel.challengerPlayerId, duel.challengedPlayerId].sort((a, b) => {
        if (a === currentPlayerId) return -1;
        if (b === currentPlayerId) return 1;
        return 0;
    });

    let nextState = state;
    const events: SmashUpEvent[] = [];
    for (const mover of orderedPlayers) {
        // 平局时双方都要“跑”：每位玩家为自己参与决斗的随从选择逃跑的基地
        const moveUid = mover === duel.challengerPlayerId ? duel.challengerMinionUid : duel.challengedMinionUid;
        const found = findMinionOnBases(state.core, moveUid);
        if (!found) continue;
        const destinationOptions = state.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            }))
            .filter(candidate => candidate.baseIndex !== found.baseIndex);
        if (destinationOptions.length === 0) continue;
        const interaction = createSimpleChoice(
            `smashup_duel_run_em_off_move_${duel.id}_${mover}_${now}`,
            mover,
            'ui.duel_prompt_run_em_off_tie_title',
            buildBaseTargetOptions(destinationOptions, state.core),
            { sourceId: 'smashup_duel_run_em_off_move', targetType: 'base', autoResolveIfSingle: false },
        );
        (interaction.data as any).continuationContext = {
            duel,
            loserUid: moveUid,
            loserDefId: found.minion.defId,
            fromBaseIndex: found.baseIndex,
        };
        nextState = queueInteraction(nextState, interaction);
    }
    return { state: nextState, events };
}

function resolveDuelResult(
    state: MatchState<SmashUpCore>,
    duel: ActiveDuel,
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const challengerFound = findMinionOnBases(state.core, duel.challengerMinionUid);
    const challengedFound = findMinionOnBases(state.core, duel.challengedMinionUid);
    if (!challengerFound || !challengedFound || challengerFound.baseIndex !== challengedFound.baseIndex) {
        return { state, events: [duelEndedEvent(duel, 'invalid', now)] };
    }

    const baseIndex = challengerFound.baseIndex;
    const challengerPower = getMinionPower(state.core, challengerFound.minion, baseIndex);
    const challengedPower = getMinionPower(state.core, challengedFound.minion, baseIndex);
    const isTie = challengerPower === challengedPower;
    const winner = challengerPower > challengedPower ? challengerFound.minion : challengedPower > challengerPower ? challengedFound.minion : undefined;
    const loser = winner?.uid === challengerFound.minion.uid ? challengedFound.minion : winner?.uid === challengedFound.minion.uid ? challengerFound.minion : undefined;
    const events: SmashUpEvent[] = [duelEndedEvent(duel, 'resolved', now)];
    let nextState = state;
    const destroySourceId = duel.destroyReason ?? duel.sourceId;
    const destroySourceKind = getCardDef(destroySourceId)?.type === 'action' ? 'action' : 'nonAction';

    if (duel.outcome === 'destroy_loser') {
        const destroySource = buildDuelEffectSource(duel, {
            sourceDefId: destroySourceId,
            sourceKind: destroySourceKind,
            sourceBaseIndex: baseIndex,
        });
        if (isTie) {
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: challengerFound.minion.uid,
                minionDefId: challengerFound.minion.defId,
                fromBaseIndex: baseIndex,
                destroyerId: duel.sourcePlayerId,
                reason: destroySourceId,
                now,
                sourcePlayerId: destroySource.sourcePlayerId,
                sourceDefId: destroySource.sourceDefId,
                sourceControllerId: destroySource.sourceControllerId,
                sourceBaseIndex: destroySource.sourceBaseIndex,
                sourceKind: destroySource.sourceKind,
            }));
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: challengedFound.minion.uid,
                minionDefId: challengedFound.minion.defId,
                fromBaseIndex: baseIndex,
                destroyerId: duel.sourcePlayerId,
                reason: destroySourceId,
                now,
                sourcePlayerId: destroySource.sourcePlayerId,
                sourceDefId: destroySource.sourceDefId,
                sourceControllerId: destroySource.sourceControllerId,
                sourceBaseIndex: destroySource.sourceBaseIndex,
                sourceKind: destroySource.sourceKind,
            }));
        } else if (loser) {
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: loser.uid,
                minionDefId: loser.defId,
                fromBaseIndex: baseIndex,
                destroyerId: duel.sourcePlayerId,
                reason: destroySourceId,
                now,
                sourcePlayerId: destroySource.sourcePlayerId,
                sourceDefId: destroySource.sourceDefId,
                sourceControllerId: destroySource.sourceControllerId,
                sourceBaseIndex: destroySource.sourceBaseIndex,
                sourceKind: destroySource.sourceKind,
            }));
        }
    } else if (duel.outcome === 'vp_to_winner') {
        if (isTie) {
            events.push({
                type: SU_EVENTS.VP_AWARDED,
                payload: { playerId: duel.challengerPlayerId, amount: 1, reason: duel.sourceId },
                timestamp: now,
            } as VpAwardedEvent);
            events.push({
                type: SU_EVENTS.VP_AWARDED,
                payload: { playerId: duel.challengedPlayerId, amount: 1, reason: duel.sourceId },
                timestamp: now,
            } as VpAwardedEvent);
        } else if (winner) {
            events.push({
                type: SU_EVENTS.VP_AWARDED,
                payload: { playerId: winner.controller, amount: 1, reason: duel.sourceId },
                timestamp: now,
            } as VpAwardedEvent);
        }
    } else if (duel.outcome === 'draw2_to_winner') {
        if (isTie) {
            events.push(...buildStandardDrawEvents(state.core, duel.challengerPlayerId, 2, random, now));
            events.push(...buildStandardDrawEvents(state.core, duel.challengedPlayerId, 2, random, now));
        } else if (winner) {
            events.push(...buildStandardDrawEvents(state.core, winner.controller, 2, random, now));
        }
    } else if (duel.outcome === 'high_noon') {
        const highNoonSource = buildDuelEffectSource(duel, {
            sourceDefId: destroySourceId,
            sourceKind: destroySourceKind,
            sourceBaseIndex: baseIndex,
        });
        if (isTie) {
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: challengerFound.minion.uid,
                minionDefId: challengerFound.minion.defId,
                fromBaseIndex: baseIndex,
                destroyerId: duel.sourcePlayerId,
                reason: 'cowboys_high_noon',
                now,
                sourcePlayerId: highNoonSource.sourcePlayerId,
                sourceDefId: highNoonSource.sourceDefId,
                sourceControllerId: highNoonSource.sourceControllerId,
                sourceBaseIndex: highNoonSource.sourceBaseIndex,
                sourceKind: highNoonSource.sourceKind,
            }));
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: challengedFound.minion.uid,
                minionDefId: challengedFound.minion.defId,
                fromBaseIndex: baseIndex,
                destroyerId: duel.sourcePlayerId,
                reason: 'cowboys_high_noon',
                now,
                sourcePlayerId: highNoonSource.sourcePlayerId,
                sourceDefId: highNoonSource.sourceDefId,
                sourceControllerId: highNoonSource.sourceControllerId,
                sourceBaseIndex: highNoonSource.sourceBaseIndex,
                sourceKind: highNoonSource.sourceKind,
            }));
        } else if (loser) {
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: loser.uid,
                minionDefId: loser.defId,
                fromBaseIndex: baseIndex,
                destroyerId: duel.sourcePlayerId,
                reason: 'cowboys_high_noon',
                now,
                sourcePlayerId: highNoonSource.sourcePlayerId,
                sourceDefId: highNoonSource.sourceDefId,
                sourceControllerId: highNoonSource.sourceControllerId,
                sourceBaseIndex: highNoonSource.sourceBaseIndex,
                sourceKind: highNoonSource.sourceKind,
            }));
        }
        if (winner?.uid === duel.challengerMinionUid && duel.sourcePlayerId === duel.challengerPlayerId) {
            const winnerBaseIndex = findMinionOnBases(state.core, winner.uid)?.baseIndex ?? baseIndex;
            events.push({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: { playerId: duel.sourcePlayerId, limitType: 'minion', delta: 1, restrictToBase: winnerBaseIndex },
                timestamp: now,
            } as SmashUpEvent);
        }
    } else if (duel.outcome === 'run_em_off') {
        if (isTie) {
            events.push(addTempPower(challengerFound.minion.uid, baseIndex, 3, 'cowboys_run_em_off', now));
            events.push(addTempPower(challengedFound.minion.uid, baseIndex, 3, 'cowboys_run_em_off', now));
            const tieMoveResult = buildRunEmOffTieMovePrompts(nextState, duel, now);
            nextState = tieMoveResult.state;
            events.push(...tieMoveResult.events);
        } else if (winner && loser) {
            events.push(addTempPower(winner.uid, baseIndex, 3, 'cowboys_run_em_off', now));
            const destinationOptions = state.core.bases
                .map((base, candidateBaseIndex) => ({
                    baseIndex: candidateBaseIndex,
                    baseDefId: base.defId,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                }))
                .filter(candidate => candidate.baseIndex !== baseIndex);
            if (destinationOptions.length > 0) {
                const mover = loser.controller;
                const interaction = createSimpleChoice(
                    `smashup_duel_run_em_off_move_${duel.id}_${mover}_${now}`,
                    mover,
                    'ui.duel_prompt_run_em_off_title',
                    buildBaseTargetOptions(destinationOptions, state.core),
                    { sourceId: 'smashup_duel_run_em_off_move', targetType: 'base', autoResolveIfSingle: false },
                );
                (interaction.data as any).continuationContext = {
                    duel,
                    loserUid: loser.uid,
                    loserDefId: loser.defId,
                    fromBaseIndex: baseIndex,
                };
                nextState = queueInteraction(nextState, interaction);
            }
        }
    }

    const continuation = executeAbilityProgram(emitDuelResolutionEventsThenTriggerProgram, {
        matchState: nextState,
        random,
        events,
        duel,
        baseIndex,
        duelChallenger: challengerFound.minion,
        duelChallenged: challengedFound.minion,
        duelWinner: winner,
        duelLoser: loser,
        duelTie: isTie,
        timestamp: now,
    });

    return {
        state: continuation.matchState ?? nextState,
        events: continuation.events as SmashUpEvent[],
    };
}

export function canStartDuel(core: SmashUpCore): boolean {
    return !core.activeDuel;
}

export function isMinionInActiveDuel(core: SmashUpCore, minionUid: string): boolean {
    return core.activeDuel?.challengerMinionUid === minionUid
        || core.activeDuel?.challengedMinionUid === minionUid;
}

export function continueActiveDuel(
    state: MatchState<SmashUpCore>,
    now: number,
): MatchState<SmashUpCore> {
    const duel = state.core.activeDuel;
    if (!duel) return state;
    return queueNextDuelStage(state, duel, 'pinkerton_challenger', now);
}

export function startDuelWithEvents(
    state: MatchState<SmashUpCore>,
    params: StartDuelParams,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    if (state.core.activeDuel) return { state, events: [] };
    const challengerFound = findMinionOnBases(state.core, params.challengerMinionUid);
    const challengedFound = findMinionOnBases(state.core, params.challengedMinionUid);
    if (!challengerFound || !challengedFound || challengerFound.baseIndex !== challengedFound.baseIndex) {
        return { state, events: [] };
    }
    const duel: ActiveDuel = {
        id: `${params.sourceId}_${now}_${params.challengerMinionUid}_${params.challengedMinionUid}`,
        baseIndex: challengerFound.baseIndex,
        sourceId: params.sourceId,
        sourcePlayerId: params.sourcePlayerId,
        challengerPlayerId: challengerFound.minion.controller,
        challengerMinionUid: challengerFound.minion.uid,
        challengedPlayerId: challengedFound.minion.controller,
        challengedMinionUid: challengedFound.minion.uid,
        outcome: params.outcome,
        destroyReason: params.destroyReason,
    };
    let duelState = withActiveDuel(state, duel);
    const duelStarted = fireTriggers(duelState.core, 'onDuelStarted', {
        state: duelState.core,
        matchState: duelState,
        playerId: duel.challengerPlayerId,
        baseIndex: duel.baseIndex,
        duel,
        duelSourceId: duel.sourceId,
        duelOutcome: duel.outcome,
        duelChallenger: challengerFound.minion,
        duelChallenged: challengedFound.minion,
        random: DEFAULT_RANDOM,
        now,
    });
    duelState = duelStarted.matchState ?? duelState;

    if (duelStarted.events.length > 0) {
        if (duelState.sys.interaction?.current || (duelState.sys.interaction?.queue?.length ?? 0) > 0) {
            throw new Error('onDuelStarted 同时产生事件和交互；需要拆成明确 continuation 顺序');
        }
        const continuation = executeAbilityProgram(emitDuelStartedEventsThenAdvanceProgram, {
            matchState: duelState,
            duel,
            timestamp: now,
            events: duelStarted.events,
        });
        return {
            state: continuation.matchState ?? duelState,
            events: continuation.events as SmashUpEvent[],
        };
    }

    if (duelState.sys.interaction?.current || (duelState.sys.interaction?.queue?.length ?? 0) > 0) {
        return { state: duelState, events: [] };
    }
    return { state: queueNextDuelStage(duelState, duel, 'pinkerton_challenger', now), events: [] };
}

export function startDuel(
    state: MatchState<SmashUpCore>,
    params: StartDuelParams,
    now: number,
): MatchState<SmashUpCore> {
    const result = startDuelWithEvents(state, params, now);
    if (result.events.length > 0) {
        throw new Error('startDuel 是 state-only 兼容入口；会产生事件的决斗开始必须使用 startDuelWithEvents');
    }
    return result.state;
}

const DEFAULT_RANDOM: RandomFn = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

export function registerDuelInteractionHandlers(): void {
    registerInteractionHandler('smashup_duel_pinkerton', (state, _playerId, value, data, _random, now) => {
        const selected = value as { amount?: number } | undefined;
        const ctx = data?.continuationContext as PinkertonContinuation | undefined;
        if (!ctx) return { state, events: [] };
        const targetPlayerId = getStagePlayerId(ctx.duel, ctx.stage);
        const targetMinionUid = targetPlayerId ? getDuelMinionUid(ctx.duel, targetPlayerId) : undefined;
        const targetFound = targetMinionUid ? findMinionOnBases(state.core, targetMinionUid) : undefined;
        const amount = Math.max(0, selected?.amount ?? 0);
        const events = targetFound
            ? Array.from({ length: amount }, () => addPowerCounter(targetFound.minion.uid, targetFound.baseIndex, 1, 'cowboys_pinkerton', now))
            : [];
        const nextStage = ctx.stage === 'pinkerton_challenger' ? 'pinkerton_challenged' : 'card_challenger';
        const stageResult = advanceQueuedStage(state, ctx.duel, nextStage, now);
        return {
            state: stageResult.state,
            events: [...events, ...stageResult.events],
        };
    });

    registerInteractionHandler('smashup_duel_card', (state, playerId, value, data, random, now) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string } | undefined;
        const ctx = data?.continuationContext as DuelCardContinuation | undefined;
        if (!ctx) return { state, events: [] };
        const nextStage = ctx.stage === 'card_challenger' ? 'card_challenged' : 'deputy_challenger';
        if (selected?.skip || !selected?.cardUid || !selected?.defId) {
            return advanceQueuedStage(state, ctx.duel, nextStage, now);
        }
        const card = state.core.players[playerId]?.hand.find(entry => entry.uid === selected.cardUid);
        if (!card || card.type !== 'action') {
            return advanceQueuedStage(state, ctx.duel, nextStage, now);
        }
        return playActionAsDuelCard(state, ctx.duel, playerId, selected.cardUid, selected.defId, nextStage, random, now);
    });

    const duelActionTargetHandler = (
        state: MatchState<SmashUpCore>,
        playerId: string,
        value: unknown,
        data: any,
        random: RandomFn,
        now: number,
    ) => {
        const ctx = data?.continuationContext as DuelActionTargetContinuation | undefined;
        if (!ctx) return { state, events: [] };
        const selected = value as { baseIndex?: number; minionUid?: string } | undefined;
        const targetBaseIndex = ctx.targetType === 'base'
            ? selected?.baseIndex
            : selected?.baseIndex ?? (selected?.minionUid ? findMinionOnBases(state.core, selected.minionUid)?.baseIndex : undefined);
        if (targetBaseIndex === undefined) return { state, events: [] };
        return playOngoingActionAsDuelCard(
            state,
            playerId,
            ctx.duel,
            ctx.defId,
            ctx.cardUid,
            targetBaseIndex,
            ctx.targetType === 'minion' ? selected?.minionUid : undefined,
            ctx.nextStage,
            random,
            now,
        );
    };
    registerInteractionHandler('smashup_duel_action_target_base', duelActionTargetHandler);
    registerInteractionHandler('smashup_duel_action_target_minion', duelActionTargetHandler);

    registerInteractionHandler('smashup_duel_deputy_card', (state, playerId, value, data, _random, now) => {
        const selected = value as { skip?: boolean; cardUid?: string } | undefined;
        const ctx = data?.continuationContext as DeputyPromptContinuation | undefined;
        if (!ctx) return { state, events: [] };
        const oppositeStage = ctx.stage === 'deputy_challenger' ? 'deputy_challenged' : 'deputy_challenger';
        if (selected?.skip || !selected?.cardUid) {
            const nextPasses = ctx.consecutivePasses + 1;
            if (nextPasses >= 2) {
                return resolveDuelResult(state, ctx.duel, DEFAULT_RANDOM, now);
            }
            return advanceDeputyStage(state, ctx.duel, oppositeStage, nextPasses, now);
        }
        return {
            state: queueDeputyTargetPrompt(state, ctx.duel, selected.cardUid, oppositeStage, playerId, now),
            events: [],
        };
    });

    registerInteractionHandler('smashup_duel_deputy_target', (state, playerId, value, data, _random, now) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        const ctx = data?.continuationContext as DeputyTargetContinuation | undefined;
        if (!ctx || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const events: SmashUpEvent[] = [
            {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [ctx.deputyCardUid] },
                timestamp: now,
            } as SmashUpEvent,
            addTempPower(selected.minionUid, selected.baseIndex, 2, 'cowboys_deputy', now),
        ];
        if (!isDeputyStage(ctx.nextStage)) return { state, events };
        const continuation = executeAbilityProgram(emitDuelEventsThenAdvanceDeputyProgram, {
            matchState: state,
            duel: ctx.duel,
            nextStage: ctx.nextStage,
            consecutivePasses: 0,
            timestamp: now,
            events,
        });
        return {
            state: continuation.matchState ?? state,
            events: continuation.events as SmashUpEvent[],
        };
    });

    registerInteractionHandler('smashup_duel_run_em_off_move', (state, _playerId, value, data, _random, now) => {
        const selected = value as { baseIndex?: number } | undefined;
        const ctx = data?.continuationContext as { loserUid?: string; loserDefId?: string; fromBaseIndex?: number } | undefined;
        if (!ctx?.loserUid || !ctx.loserDefId || ctx.fromBaseIndex === undefined || selected?.baseIndex === undefined) {
            return { state, events: [] };
        }
        const moveSource = buildDuelEffectSource(ctx.duel, { sourceBaseIndex: ctx.fromBaseIndex });
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: ctx.loserUid,
                minionDefId: ctx.loserDefId,
                fromBaseIndex: ctx.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                toBaseDefId: state.core.bases[selected.baseIndex]?.defId,
                reason: 'cowboys_run_em_off',
                now,
                sourcePlayerId: moveSource.sourcePlayerId,
                sourceDefId: moveSource.sourceDefId,
                sourceControllerId: moveSource.sourceControllerId,
                sourceBaseIndex: moveSource.sourceBaseIndex,
            }),
        };
    });
}
