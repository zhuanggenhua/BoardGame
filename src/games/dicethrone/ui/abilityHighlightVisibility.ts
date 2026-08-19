import type { PlayerId } from '../../../engine/types';
import type { TurnPhase } from '../types';

export interface OpponentViewAbilityHighlightArgs {
    isSelfView: boolean;
    isSpectator: boolean;
    currentPhase: TurnPhase;
    isViewRolling: boolean;
    hasRolled: boolean;
}

export interface ResponseObservedRollAbilityHighlightArgs {
    isResponseWindowOpen: boolean;
    currentResponderId?: PlayerId;
    rootPlayerId: PlayerId;
    viewPlayerId?: PlayerId;
    rollerId?: PlayerId;
    isRollPhase: boolean;
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

export function shouldShowResponseObservedRollAbilityHighlights({
    isResponseWindowOpen,
    currentResponderId,
    rootPlayerId,
    viewPlayerId,
    rollerId,
    isRollPhase,
}: ResponseObservedRollAbilityHighlightArgs): boolean {
    if (!isResponseWindowOpen || !currentResponderId) return false;
    if (!isRollPhase) return false;
    if (currentResponderId !== rootPlayerId) return false;
    if (!viewPlayerId || !rollerId) return false;
    if (viewPlayerId === currentResponderId) return false;
    return viewPlayerId === rollerId;
}
