import type { Command, GameEvent, PlayerId } from '../../../engine/types';
import type { FantasyRealmsFocusInsight, FantasyRealmsScoreLine, TableCard } from '../foundation';

export type FantasyRealmsTurnStage = 'draw' | 'discard';

export interface FantasyRealmsPlayerState {
    id: PlayerId;
    name: string;
    hand: TableCard[];
    score: number;
    scoreBreakdown: FantasyRealmsScoreLine[];
}

export interface FantasyRealmsCore {
    playerIds: PlayerId[];
    currentPlayer: PlayerId;
    turn: number;
    stage: FantasyRealmsTurnStage;
    drawPile: TableCard[];
    discardPile: TableCard[];
    players: Record<PlayerId, FantasyRealmsPlayerState>;
    focusCardId: string | null;
    focusInsight: FantasyRealmsFocusInsight;
}

export interface SetFocusCardCommand extends Command<'SET_FOCUS_CARD'> {
    payload: {
        cardId: string;
    };
}

export interface DrawFromDeckCommand extends Command<'DRAW_FROM_DECK'> {
    payload: Record<string, never>;
}

export interface TakeFromDiscardCommand extends Command<'TAKE_FROM_DISCARD'> {
    payload: {
        cardId: string;
    };
}

export interface DiscardCardCommand extends Command<'DISCARD_CARD'> {
    payload: {
        cardId: string;
    };
}

export type FantasyRealmsCommand =
    | SetFocusCardCommand
    | DrawFromDeckCommand
    | TakeFromDiscardCommand
    | DiscardCardCommand;

export type FantasyRealmsCommandMap = {
    SET_FOCUS_CARD: SetFocusCardCommand['payload'];
    DRAW_FROM_DECK: DrawFromDeckCommand['payload'];
    TAKE_FROM_DISCARD: TakeFromDiscardCommand['payload'];
    DISCARD_CARD: DiscardCardCommand['payload'];
};

export interface FocusCardSetEvent extends GameEvent<'FOCUS_CARD_SET'> {
    payload: {
        cardId: string;
    };
}

export interface CardsDrawnEvent extends GameEvent<'CARDS_DRAWN'> {
    payload: {
        playerId: PlayerId;
        cards: TableCard[];
        nextStage: FantasyRealmsTurnStage;
    };
}

export interface DiscardCardTakenEvent extends GameEvent<'DISCARD_CARD_TAKEN'> {
    payload: {
        playerId: PlayerId;
        card: TableCard;
        nextPlayerId: PlayerId;
        nextTurn: number;
        nextStage: FantasyRealmsTurnStage;
        requiresDiscard: boolean;
    };
}

export interface CardDiscardedEvent extends GameEvent<'CARD_DISCARDED'> {
    payload: {
        playerId: PlayerId;
        card: TableCard;
        nextPlayerId: PlayerId;
        nextTurn: number;
        nextStage: FantasyRealmsTurnStage;
    };
}

export type FantasyRealmsEvent =
    | FocusCardSetEvent
    | CardsDrawnEvent
    | DiscardCardTakenEvent
    | CardDiscardedEvent;
