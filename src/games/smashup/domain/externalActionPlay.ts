import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import {
    requireOnPlay,
    resolveOnPlay,
    resolveSpecial,
    type AbilityContext,
} from './abilityRegistry';
import { getCardDef } from '../data/cards';
import { reduce } from './reduce';
import type { ActionCardDef, FusionCardDef, SmashUpCore, SmashUpEvent } from './types';

function getPlayedActionExecutor(defId: string) {
    const def = getCardDef(defId) as ActionCardDef | FusionCardDef | undefined;
    if (!def) {
        return requireOnPlay(defId, 'externalActionPlay.appendResolvedActionAbility');
    }

    const subtype = def.type === 'fusion' ? def.actionSubtype : def.subtype;

    if (subtype === 'ongoing') {
        return resolveOnPlay(defId) ?? null;
    }

    if (subtype === 'special') {
        return resolveSpecial(defId)
            ?? requireOnPlay(defId, 'externalActionPlay.appendResolvedActionAbility');
    }

    return requireOnPlay(defId, 'externalActionPlay.appendResolvedActionAbility');
}


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
}): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const executor = getPlayedActionExecutor(params.defId);
    if (!executor) {
        return {
            state: params.state,
            events: params.events,
        };
    }

    let simCore = params.state.core;
    for (const evt of params.events) {
        simCore = reduce(simCore, evt);
    }

    if (!executor) {
        return {
            state: params.state,
            events: params.events,
        };
    }

    const baseIndex = params.baseIndex ?? params.targetBaseIndex ?? 0;
    const abilityCtx: AbilityContext = {
        state: simCore,
        matchState: { ...params.state, core: simCore },
        playerId: params.playerId,
        cardUid: params.cardUid,
        defId: params.defId,
        baseIndex,
        targetBaseIndex: params.targetBaseIndex,
        targetMinionUid: params.targetMinionUid,
        random: params.random,
        now: params.timestamp,
        handSizeAfterPlay: params.handSizeAfterPlay ?? (simCore.players[params.playerId]?.hand.length ?? 0),
        fromDiscard: params.fromDiscard === true,
    };
    const result = executor(abilityCtx);
    params.events.push(...result.events);
    return {
        state: result.matchState ?? params.state,
        events: params.events,
    };
}
