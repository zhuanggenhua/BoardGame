import type { MatchState, RandomFn } from '../../../engine/types';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent, TurnEndedEvent } from './types';

export function execute(
    _state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    _random: RandomFn
): SmashUpEvent[] {
    const now = Date.now();
    switch (command.type) {
        case 'END_TURN': {
            const event: TurnEndedEvent = {
                type: 'TURN_ENDED',
                payload: { playerId: command.playerId },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return [event];
        }
        default:
            return [];
    }
}

export function reduce(state: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    switch (event.type) {
        case 'TURN_ENDED':
            return state;
        default:
            return state;
    }
}
