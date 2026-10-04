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
    isSpectator: _isSpectator,
}: CanInteractHandForCurrentBoardParams): boolean => true;

export const canPlayHandCardsForCurrentBoard = (_params: CanPlayHandCardsForCurrentBoardParams): boolean => {
    // 所有视角都保留同一套拖拽/点击交互。观战端的 moves 由引擎层统一变成 no-op，
    // 因而不会产生实际命令或效果，不在每个游戏的 UI policy 里重复实现 spectator 规则。
    return true;
};

export const canSellHandCardsForCurrentBoard = ({
    isSpectator,
    isActivePlayer,
}: Pick<CanPlayHandCardsForCurrentBoardParams, 'isSpectator' | 'isActivePlayer'>): boolean => (
    isSpectator || isActivePlayer
);
