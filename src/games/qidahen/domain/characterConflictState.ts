import type { QidahenCore } from './types';

const JIN_BEILE_CHARACTER_IDS = new Set([
    'jin-daisan',
    'jin-amin',
    'jin-manggultai',
    'jin-huangtaiji',
]);

export const resolveMingCharacterConflict = (
    factions: QidahenCore['factions'],
): { factions: QidahenCore['factions']; removedMaoWenlong: boolean } => {
    const hasMaoWenlong = factions.ming.characters.some((character) => character.id === 'ming-mao-wenlong' && character.inPlay);
    const hasYuanChonghuan = factions.ming.characters.some((character) => character.id === 'ming-yuan-chonghuan' && character.inPlay);
    if (!hasMaoWenlong || !hasYuanChonghuan) {
        return { factions, removedMaoWenlong: false };
    }

    return {
        factions: {
            ...factions,
            ming: {
                ...factions.ming,
                characters: factions.ming.characters.map((character) => (
                    character.id === 'ming-mao-wenlong'
                        ? { ...character, inPlay: false }
                        : character
                )),
            },
        },
        removedMaoWenlong: true,
    };
};

export const resolveJinHuangtaijiConflict = (
    factions: QidahenCore['factions'],
): { factions: QidahenCore['factions']; removedHuangtaiji: boolean } => {
    const jinCharacters = factions.jin.characters;
    const hasNurhaciInPlay = jinCharacters.some((character) => character.id === 'jin-nurhaci' && character.inPlay);
    const huangtaiji = jinCharacters.find((character) => character.id === 'jin-huangtaiji');
    if (hasNurhaciInPlay || !huangtaiji?.inPlay || huangtaiji.removedFromGame) {
        return { factions, removedHuangtaiji: false };
    }

    const hasOtherBeileInPlay = jinCharacters.some((character) => (
        character.id !== 'jin-huangtaiji'
        && JIN_BEILE_CHARACTER_IDS.has(character.id)
        && character.inPlay
    ));
    if (!hasOtherBeileInPlay) {
        return { factions, removedHuangtaiji: false };
    }

    return {
        factions: {
            ...factions,
            jin: {
                ...factions.jin,
                characters: jinCharacters.map((character) => (
                    character.id === 'jin-huangtaiji'
                        ? {
                            ...character,
                            inPlay: false,
                            removedFromGame: true,
                            defeatMarkers: 0,
                        }
                        : character
                )),
            },
        },
        removedHuangtaiji: true,
    };
};

export const resolveJinDaisanConflict = (
    factions: QidahenCore['factions'],
): { factions: QidahenCore['factions']; removedDaisan: boolean } => {
    const jinCharacters = factions.jin.characters;
    const hasNurhaciInPlay = jinCharacters.some((character) => character.id === 'jin-nurhaci' && character.inPlay);
    const daisan = jinCharacters.find((character) => character.id === 'jin-daisan');
    if (hasNurhaciInPlay || !daisan?.inPlay) {
        return { factions, removedDaisan: false };
    }

    const hasOtherBeileInPlay = jinCharacters.some((character) => (
        character.id !== 'jin-daisan'
        && JIN_BEILE_CHARACTER_IDS.has(character.id)
        && character.inPlay
    ));
    if (!hasOtherBeileInPlay) {
        return { factions, removedDaisan: false };
    }

    return {
        factions: {
            ...factions,
            jin: {
                ...factions.jin,
                characters: jinCharacters.map((character) => (
                    character.id === 'jin-daisan'
                        ? {
                            ...character,
                            inPlay: false,
                            removedFromGame: false,
                            defeatMarkers: 0,
                        }
                        : character
                )),
            },
        },
        removedDaisan: true,
    };
};

export const resolveNurhaciRemovedByYuanChonghuan = (
    factions: QidahenCore['factions'],
): { factions: QidahenCore['factions']; removedNurhaci: boolean } => {
    const hasYuanChonghuan = factions.ming.characters.some((character) => character.id === 'ming-yuan-chonghuan' && character.inPlay);
    const hasNurhaci = factions.jin.characters.some((character) => character.id === 'jin-nurhaci' && character.inPlay);
    if (!hasYuanChonghuan || !hasNurhaci) {
        return { factions, removedNurhaci: false };
    }

    return {
        factions: {
            ...factions,
            jin: {
                ...factions.jin,
                characters: factions.jin.characters.map((character) => (
                    character.id === 'jin-nurhaci'
                        ? {
                            ...character,
                            inPlay: false,
                            removedFromGame: true,
                            defeatMarkers: 0,
                        }
                        : character
                )),
            },
        },
        removedNurhaci: true,
    };
};
