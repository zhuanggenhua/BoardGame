import {
    resolveJinDaisanConflict,
    resolveJinHuangtaijiConflict,
    resolveMingCharacterConflict,
    resolveNurhaciRemovedByYuanChonghuan,
} from './characterConflictState';
import { createInitialCharacterStates, getCharacterNameById } from './characterCatalogState';
import { getChronologyCharacterAvailabilityForYear } from './characterChronologyConfig';
import type { QidahenCharacterState, QidahenCore, QidahenFactionId } from './types';

type QidahenChronologyCharacterAvailability = ReturnType<typeof getChronologyCharacterAvailabilityForYear>;

interface QidahenCharacterChronologyStateDependencies {
    getChronologyCharacterAvailabilityForYear: (
        yearIndex: number,
        factionId: QidahenFactionId,
    ) => QidahenChronologyCharacterAvailability;
    createInitialCharacterStates: (
        factionId: QidahenFactionId,
    ) => QidahenCharacterState[];
    getCharacterNameById: (
        factionId: QidahenFactionId,
        characterId: string,
    ) => string;
}

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const selectChronologyRepresentativeCharacterIds = (
    characters: QidahenCharacterState[],
    rule: Extract<QidahenChronologyCharacterAvailability, { mode: 'representative' }>,
): string[] => {
    const activeCharacterIds = new Set(
        characters
            .filter((character) => character.inPlay || character.removedFromGame)
            .map((character) => character.id),
    );
    const nextCharacterId = rule.characterIds.find((characterId) => !activeCharacterIds.has(characterId));
    return nextCharacterId ? [nextCharacterId] : [];
};

export const applyChronologyCharactersForYear = (
    factions: QidahenCore['factions'],
    yearIndex: number,
    dependencies: QidahenCharacterChronologyStateDependencies = {
        getChronologyCharacterAvailabilityForYear,
        createInitialCharacterStates,
        getCharacterNameById,
    },
): {
    factions: QidahenCore['factions'];
    summaryLines: string[];
} => {
    let nextFactions = factions;
    const summaryLines: string[] = [];

    for (const factionId of factionOrder) {
        const rule = dependencies.getChronologyCharacterAvailabilityForYear(yearIndex, factionId);
        const currentFaction = nextFactions[factionId];
        const currentCharacters = currentFaction.characters.length > 0
            ? currentFaction.characters
            : dependencies.createInitialCharacterStates(factionId);

        let activatedCharacterIds: string[] = [];
        if (rule.mode === 'exact') {
            activatedCharacterIds = rule.characterIds;
        } else if (rule.mode === 'representative') {
            activatedCharacterIds = selectChronologyRepresentativeCharacterIds(currentCharacters, rule);
        }

        const activatedIdSet = new Set(activatedCharacterIds);
        const nextCharacters = currentCharacters.map((character) => (
            activatedIdSet.has(character.id) && !character.removedFromGame
                ? { ...character, inPlay: true }
                : character
        ));
        nextFactions = {
            ...nextFactions,
            [factionId]: {
                ...currentFaction,
                characters: nextCharacters,
            },
        };

        if (rule.mode === 'none') {
            summaryLines.push(`${currentFaction.name} 本年人物：无新增出场。`);
            continue;
        }

        if (rule.mode === 'exact') {
            const names = rule.characterIds.map((characterId) => dependencies.getCharacterNameById(factionId, characterId));
            summaryLines.push(`${currentFaction.name} 本年人物：${names.join('、')}。`);
            continue;
        }

        if (activatedCharacterIds.length === 0) {
            summaryLines.push(`${currentFaction.name} 本年人物：${rule.summary}；候选人物已全部在场，无新增出场。`);
            continue;
        }

        summaryLines.push(`${currentFaction.name} 本年人物：${rule.summary}；当前启用 ${dependencies.getCharacterNameById(factionId, activatedCharacterIds[0])}。`);
    }

    const mingConflictResolution = resolveMingCharacterConflict(nextFactions);
    nextFactions = mingConflictResolution.factions;
    if (mingConflictResolution.removedMaoWenlong) {
        summaryLines.push('大明人物冲突：毛文龙与袁崇焕同场，毛文龙离场。');
    }

    const nurhaciRemoval = resolveNurhaciRemovedByYuanChonghuan(nextFactions);
    nextFactions = nurhaciRemoval.factions;
    if (nurhaciRemoval.removedNurhaci) {
        summaryLines.push('人物克制：袁崇焕在场，努尔哈赤被移出游戏。');
    }

    const jinConflictResolution = resolveJinHuangtaijiConflict(nextFactions);
    nextFactions = jinConflictResolution.factions;
    if (jinConflictResolution.removedHuangtaiji) {
        summaryLines.push('后金人物冲突：皇太极与其他贝勒同场，被拣弃并直接自游戏中移除。');
    }

    const daisanConflictResolution = resolveJinDaisanConflict(nextFactions);
    nextFactions = daisanConflictResolution.factions;
    if (daisanConflictResolution.removedDaisan) {
        summaryLines.push('后金人物冲突：代善与其他贝勒同场，被拣弃并回到后金人物牌堆。');
    }

    return {
        factions: nextFactions,
        summaryLines,
    };
};
