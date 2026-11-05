// Client registration is loaded by Board; game.ts remains server-safe.
import { registerCriticalImageResolver } from '../../core';
import { fateDominationCriticalImageResolver } from './criticalImageResolver';

registerCriticalImageResolver('fate-domination', fateDominationCriticalImageResolver);
