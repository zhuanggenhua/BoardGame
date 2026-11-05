// Client registration is loaded by Board; game.ts remains server-safe.
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { getSmashUpCardPreviewRef } from './cardPreviewModel';
import { registerCriticalImageResolver } from '../../core';
import { smashUpCriticalImageResolver } from './criticalImageResolver';
import './ui/SmashUpCardRenderer';

registerCardPreviewGetter('smashup', getSmashUpCardPreviewRef, { maxDim: 220 });
registerCriticalImageResolver('smashup', smashUpCriticalImageResolver);
