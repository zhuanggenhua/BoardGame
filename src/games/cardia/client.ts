// Client registration is loaded by Board; game.ts remains server-safe.
import './assets';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { getCardiaCardPreviewRef } from './cardPreviewModel';
import { registerCriticalImageResolver } from '../../core';
import { cardiaCriticalImageResolver } from './criticalImageResolver';

registerCardPreviewGetter('cardia', getCardiaCardPreviewRef);
registerCriticalImageResolver('cardia', cardiaCriticalImageResolver);
