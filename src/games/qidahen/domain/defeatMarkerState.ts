import { createInitialCharacterStates } from './characterCatalogState';
import type {
    QidahenCharacterState,
    QidahenCore,
    QidahenFactionId,
    QidahenFactionState,
} from './types';

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const addDefeatMarkerToCharacters = (characters: QidahenCharacterState[]): QidahenCharacterState[] => {
    const eligibleCharacters = characters
        .filter((character) => character.inPlay && character.canHoldDefeatMarker)
        .sort((left, right) => (
            left.defeatMarkers - right.defeatMarkers
            || Number(left.number === 'X') - Number(right.number === 'X')
            || Number(left.number) - Number(right.number)
            || left.name.localeCompare(right.name, 'zh-CN')
        ));
    const targetCharacterId = eligibleCharacters[0]?.id ?? null;

    return characters.map((character) => (
        character.id === targetCharacterId
            ? {
                ...character,
                defeatMarkers: character.defeatMarkers + 1,
            }
            : character
    ));
};

export const syncFactionCharactersToDefeatMarkerCount = (faction: QidahenFactionState): QidahenFactionState => {
    let nextFaction = {
        ...faction,
        characters: faction.characters.length > 0 ? faction.characters : createInitialCharacterStates(faction.id),
    };
    const characterMarkerCount = nextFaction.characters.reduce(
        (sum, character) => sum + Math.max(0, character.defeatMarkers),
        0,
    );
    const missingMarkers = Math.max(0, (nextFaction.defeatMarkers ?? 0) - characterMarkerCount);

    for (let index = 0; index < missingMarkers; index += 1) {
        nextFaction = {
            ...nextFaction,
            characters: addDefeatMarkerToCharacters(nextFaction.characters),
        };
    }

    return nextFaction;
};

export const listMarkedCharacters = (characters: QidahenCharacterState[]): QidahenCharacterState[] => (
    characters
        .filter((character) => character.defeatMarkers > 0)
        .sort((left, right) => (
            Number(left.number === 'X') - Number(right.number === 'X')
            || Number(left.number) - Number(right.number)
            || left.name.localeCompare(right.name, 'zh-CN')
        ))
);

export const getMidyearDefeatMarkerRoll = (factionId: QidahenFactionId, markerIndex: number): number => {
    const factionIndex = factionOrder.indexOf(factionId);
    return ((factionIndex + 1) * 3 + (markerIndex * 2)) % 6 + 1;
};

export const addDefeatMarkerToFaction = (
    factions: QidahenCore['factions'],
    factionId: QidahenFactionId,
): QidahenCore['factions'] => {
    const faction = factions[factionId];
    const characters = addDefeatMarkerToCharacters(
        faction.characters.length > 0 ? faction.characters : createInitialCharacterStates(factionId),
    );

    return {
        ...factions,
        [factionId]: {
            ...faction,
            defeatMarkers: (faction.defeatMarkers ?? 0) + 1,
            characters,
        },
    };
};
