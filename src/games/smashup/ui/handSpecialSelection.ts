import type { MatchState } from '../../../engine/types';
import { validate } from '../domain/commands';
import { SU_COMMANDS, type CardInstance, type SmashUpCore } from '../domain/types';

export function getHandSpecialPlayableBaseIndices(
    matchState: MatchState<SmashUpCore>,
    playerId: string,
    handCardUid: string,
): Set<number> {
    const result = new Set<number>();
    for (let baseIndex = 0; baseIndex < matchState.core.bases.length; baseIndex += 1) {
        const validation = validate(matchState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId,
            payload: { handCardUid, baseIndex },
        } as any);
        if (validation.valid) {
            result.add(baseIndex);
        }
    }
    return result;
}

export function shouldPreferHandSpecialSelection(args: {
    matchState: MatchState<SmashUpCore>;
    playerId: string;
    card: CardInstance;
    normalPlayableBaseIndices: Set<number>;
}): boolean {
    if (args.card.type === 'fusion') return false;
    const handSpecialBaseIndices = getHandSpecialPlayableBaseIndices(
        args.matchState,
        args.playerId,
        args.card.uid,
    );
    return handSpecialBaseIndices.size > 0 && args.normalPlayableBaseIndices.size === 0;
}

export function shouldOfferHandSpecialActionChoice(args: {
    matchState: MatchState<SmashUpCore>;
    playerId: string;
    card: CardInstance;
    normalPlayableBaseIndices: Set<number>;
}): boolean {
    if (args.card.type === 'fusion') return false;
    const handSpecialBaseIndices = getHandSpecialPlayableBaseIndices(
        args.matchState,
        args.playerId,
        args.card.uid,
    );
    return handSpecialBaseIndices.size > 0 && args.normalPlayableBaseIndices.size > 0;
}
