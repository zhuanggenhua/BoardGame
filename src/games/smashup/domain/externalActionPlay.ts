import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { resolveOnPlay, resolveSpecial, type AbilityContext } from './abilityRegistry';
import { reduce } from './reduce';
import type { SmashUpCore, SmashUpEvent } from './types';

function resolvePlayedActionExecutor(defId: string) {
    return resolveSpecial(defId) ?? resolveOnPlay(defId);
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
    baseIndex: number;
    targetMinionUid?: string;
    handSizeAfterPlay?: number;
}): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const executor = resolvePlayedActionExecutor(params.defId);
    if (!executor) {
        return { state: params.state, events: params.events };
    }

    let simCore = params.state.core;
    for (const evt of params.events) {
        simCore = reduce(simCore, evt);
    }

    const abilityCtx: AbilityContext = {
        state: simCore,
        matchState: { ...params.state, core: simCore },
        playerId: params.playerId,
        cardUid: params.cardUid,
        defId: params.defId,
        baseIndex: params.baseIndex,
        targetMinionUid: params.targetMinionUid,
        random: params.random,
        now: params.timestamp,
        handSizeAfterPlay: params.handSizeAfterPlay,
    };
    const result = executor(abilityCtx);
    params.events.push(...result.events);
    return {
        state: result.matchState ?? params.state,
        events: params.events,
    };
}
