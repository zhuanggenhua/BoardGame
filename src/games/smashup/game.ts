import { createDefaultSystems, createGameAdapter } from '../../engine';
import { SmashUpDomain, type SmashUpCommand, type SmashUpCore, type SmashUpEvent } from './domain';

const systems = createDefaultSystems<SmashUpCore>();

export const SmashUp = createGameAdapter<SmashUpCore, SmashUpCommand, SmashUpEvent>({
    domain: SmashUpDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 4,
    commandTypes: ['END_TURN'],
});

export default SmashUp;
