// Client registration is loaded by Board; game.ts remains server-safe.
import { getDiceThroneCardPreviewRef } from './cardPreviewModel';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { registerCriticalImageResolver } from '../../core';
import { diceThroneCriticalImageResolver } from './criticalImageResolver';

registerCardPreviewGetter('dicethrone', (cardId, context) => getDiceThroneCardPreviewRef(cardId, context?.characterId));
registerCriticalImageResolver('dicethrone', diceThroneCriticalImageResolver);
