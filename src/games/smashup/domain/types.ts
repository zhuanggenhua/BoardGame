import type { Command, GameEvent, GameOverResult, PlayerId } from '../../../engine/types';

export interface SmashUpCore {
    playerIds: PlayerId[];
    gameResult?: GameOverResult;
}

export interface EndTurnCommand extends Command<'END_TURN'> {
    payload: undefined;
}

export type SmashUpCommand = EndTurnCommand;

export interface TurnEndedEvent extends GameEvent<'TURN_ENDED'> {
    payload: {
        playerId: PlayerId;
    };
}

export type SmashUpEvent = TurnEndedEvent;
