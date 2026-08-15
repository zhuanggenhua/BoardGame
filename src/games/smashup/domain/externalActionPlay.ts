import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import {
    type AbilityContext,
    requireAbilityDefinition,
    resolveAbilityDefinition,
    type RegisteredAbility,
} from './abilityRegistry';
import {
    createEffectProgram,
    createSequenceProgram,
    executeAbilityProgram,
    type AbilityProgram,
} from './abilityRuntime';
import { getCardDef } from '../data/cards';
import type { ActionCardDef, ActiveDuel, FusionCardDef, SmashUpCore, SmashUpEvent } from './types';

function getPlayedActionDefinition(
    defId: string,
    requirementContext = 'externalActionPlay.appendResolvedActionAbility',
): RegisteredAbility | null {
    const def = getCardDef(defId) as ActionCardDef | FusionCardDef | undefined;
    if (!def) {
        return requireAbilityDefinition(defId, 'onPlay', requirementContext);
    }

    const subtype = def.type === 'fusion' ? def.actionSubtype : def.subtype;

    if (subtype === 'ongoing') {
        return resolveAbilityDefinition(defId, 'onPlay') ?? null;
    }

    if (subtype === 'special') {
        return resolveAbilityDefinition(defId, 'special')
            ?? requireAbilityDefinition(defId, 'onPlay', requirementContext);
    }

    return requireAbilityDefinition(defId, 'onPlay', requirementContext);
}

export interface ExternalActionAbilityContinuationContext {
    matchState?: MatchState<SmashUpCore>;
    random?: RandomFn;
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    timestamp: number;
    baseIndex?: number;
    targetBaseIndex?: number;
    targetMinionUid?: string;
    handSizeAfterPlay?: number;
    fromDiscard?: boolean;
    fromBuried?: boolean;
    duel?: ActiveDuel;
    afterActionContext?: Record<string, unknown>;
    abilityRequirementContext?: string;
}

interface ExternalActionEmitThenResolveContext extends ExternalActionAbilityContinuationContext {
    actionEvents: SmashUpEvent[];
    nextProgram?: AbilityProgram<ExternalActionAbilityContinuationContext, SmashUpCore, SmashUpEvent>;
}

const resolveExternalActionAbilityAfterEventsProgram = createEffectProgram<
    ExternalActionAbilityContinuationContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('externalActionPlay continuation 缺少正式 matchState');
    }
    if (!context.random) {
        throw new Error('externalActionPlay continuation 缺少随机源');
    }

    const definition = getPlayedActionDefinition(context.defId, context.abilityRequirementContext);
    if (!definition) return [];

    const baseIndex = context.baseIndex ?? context.targetBaseIndex ?? 0;
    const abilityCtx: AbilityContext = {
        state: context.matchState.core,
        matchState: context.matchState,
        playerId: context.playerId,
        cardUid: context.cardUid,
        defId: context.defId,
        baseIndex,
        targetBaseIndex: context.targetBaseIndex,
        targetMinionUid: context.targetMinionUid,
        duel: context.duel,
        random: context.random,
        now: context.timestamp,
        handSizeAfterPlay: context.handSizeAfterPlay
            ?? (context.matchState.core.players[context.playerId]?.hand.length ?? 0),
        fromDiscard: context.fromDiscard === true,
        fromBuried: context.fromBuried === true,
    };
    const result = executeAbilityProgram(definition.program, definition.createContext(abilityCtx));
    return {
        events: result.events as SmashUpEvent[],
        matchState: result.matchState,
    };
});

const emitExternalActionEventsThenContinueProgram = createEffectProgram<
    ExternalActionEmitThenResolveContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    const nextContext = {
        matchState: context.matchState,
        random: context.random,
        playerId: context.playerId,
        cardUid: context.cardUid,
        defId: context.defId,
        timestamp: context.timestamp,
        baseIndex: context.baseIndex,
        targetBaseIndex: context.targetBaseIndex,
        targetMinionUid: context.targetMinionUid,
        handSizeAfterPlay: context.handSizeAfterPlay,
        fromDiscard: context.fromDiscard,
        fromBuried: context.fromBuried,
        duel: context.duel,
        afterActionContext: context.afterActionContext,
        abilityRequirementContext: context.abilityRequirementContext,
    } satisfies ExternalActionAbilityContinuationContext;
    if (!context.nextProgram) {
        return { events: context.actionEvents };
    }
    return {
        events: context.actionEvents,
        context: nextContext,
        nextProgram: context.nextProgram,
    };
});

export function getExternalActionEffectiveHandSize(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    cardAlreadyInHand = false,
): number {
    const handSize = state.core.players[playerId]?.hand.length ?? 0;
    return cardAlreadyInHand ? handSize : handSize + 1;
}

export function appendResolvedActionAbility(params: {
    state: MatchState<SmashUpCore>;
    events: SmashUpEvent[];
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    random: RandomFn;
    timestamp: number;
    baseIndex?: number;
    targetBaseIndex?: number;
    targetMinionUid?: string;
    handSizeAfterPlay?: number;
    fromDiscard?: boolean;
    fromBuried?: boolean;
    duel?: ActiveDuel;
    afterActionContext?: Record<string, unknown>;
    abilityRequirementContext?: string;
    afterActionProgram?: AbilityProgram<ExternalActionAbilityContinuationContext, SmashUpCore, SmashUpEvent>;
}): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const definition = getPlayedActionDefinition(params.defId, params.abilityRequirementContext);
    const nextProgram = params.afterActionProgram
        ? (definition
            ? createSequenceProgram(resolveExternalActionAbilityAfterEventsProgram, params.afterActionProgram)
            : params.afterActionProgram)
        : (definition ? resolveExternalActionAbilityAfterEventsProgram : undefined);

    if (!nextProgram) {
        return {
            state: params.state,
            events: params.events,
        };
    }

    const result = executeAbilityProgram(emitExternalActionEventsThenContinueProgram, {
        matchState: params.state,
        random: params.random,
        actionEvents: params.events,
        nextProgram,
        playerId: params.playerId,
        cardUid: params.cardUid,
        defId: params.defId,
        timestamp: params.timestamp,
        baseIndex: params.baseIndex,
        targetBaseIndex: params.targetBaseIndex,
        targetMinionUid: params.targetMinionUid,
        handSizeAfterPlay: params.handSizeAfterPlay,
        fromDiscard: params.fromDiscard === true,
        fromBuried: params.fromBuried === true,
        duel: params.duel,
        afterActionContext: params.afterActionContext,
        abilityRequirementContext: params.abilityRequirementContext,
    });

    return {
        state: result.matchState ?? params.state,
        events: result.events as SmashUpEvent[],
    };
}
