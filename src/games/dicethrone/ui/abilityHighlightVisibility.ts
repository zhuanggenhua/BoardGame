import type { TurnPhase } from '../types';

export interface OpponentViewAbilityHighlightArgs {
    isSelfView: boolean;
    isSpectator: boolean;
    currentPhase: TurnPhase;
    isViewRolling: boolean;
    hasRolled: boolean;
}

export function shouldHighlightOpponentViewAbilities({
    isSelfView,
    isSpectator,
    currentPhase,
    isViewRolling,
    hasRolled,
}: OpponentViewAbilityHighlightArgs): boolean {
    if (isSpectator || isSelfView) return false;
    if (currentPhase !== 'offensiveRoll') return false;
    if (!isViewRolling) return false;
    return hasRolled;
}
