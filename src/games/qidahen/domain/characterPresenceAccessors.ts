import type { QidahenCore, QidahenFactionId } from './types';

export const hasActiveCharacter = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    characterId: string,
): boolean => state.factions[factionId].characters.some((character) => character.id === characterId && character.inPlay);
