// Client registration is loaded by Board; game.ts remains server-safe.
import { registerCriticalImageResolver } from '../../core';
import { fantasyRealmsCriticalImageResolver } from './criticalImageResolver';

registerCriticalImageResolver('fantasyrealms', fantasyRealmsCriticalImageResolver);
