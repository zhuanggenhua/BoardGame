import type { PlayerId } from '../../../engine/types';
import type { TurnPhase } from '../domain/types';

export interface CanPlayHandCardsForCurrentBoardParams {
    isSpectator: boolean;
    isActivePlayer: boolean;
    isResponder: boolean;
    isDirectDiceActor: boolean;
    currentPhase: TurnPhase;
    rootPid: PlayerId;
    rollerId?: PlayerId;
}

export interface CanInteractHandForCurrentBoardParams {
    isSpectator: boolean;
}

export const canInteractHandForCurrentBoard = ({
    isSpectator,
}: CanInteractHandForCurrentBoardParams): boolean => !isSpectator;

export const canPlayHandCardsForCurrentBoard = ({
    isSpectator,
    isActivePlayer,
    isResponder,
    isDirectDiceActor,
    currentPhase,
    rootPid,
    rollerId,
}: CanPlayHandCardsForCurrentBoardParams): boolean => {
    if (isSpectator) {
        return false;
    }

    if (isActivePlayer || isResponder || isDirectDiceActor) {
        return true;
    }

    return currentPhase === 'defensiveRoll' && rollerId === rootPid;
};
