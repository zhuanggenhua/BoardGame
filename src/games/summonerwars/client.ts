// Client registration is loaded by Board; game.ts remains server-safe.
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { registerCriticalImageResolver } from '../../core';
import { getSummonerWarsCardPreviewRef } from './cardPreviewModel';
import { summonerWarsCriticalImageResolver } from './criticalImageResolver';

registerCardPreviewGetter('summonerwars', getSummonerWarsCardPreviewRef);
registerCriticalImageResolver('summonerwars', summonerWarsCriticalImageResolver);
