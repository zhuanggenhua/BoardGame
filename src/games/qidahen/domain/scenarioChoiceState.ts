import {
    getArmamentNameById,
} from './armamentCatalogState';
import {
    getCharacterNameById,
} from './characterCatalogState';
import {
    getFactionDisplayName,
} from './factionLabelSemantics';
import {
    getFactionIdByPlayerId,
} from './factionTurnAccessors';
import { updateQidahenTurnLabel } from './turnLabelState';
import type {
    QidahenArmamentId,
    QidahenCore,
    QidahenEvent,
    QidahenFactionId,
    QidahenFactionState,
    QidahenScenarioArmamentChoiceGroup,
    QidahenScenarioCharacterChoiceGroup,
    QidahenScenarioChoiceSelections,
    QidahenScenarioId,
    QidahenScenarioPreset,
} from './types';

type QidahenPendingScenarioCharacterChoice = QidahenCore['pendingScenarioCharacterChoices'][number];
type QidahenPendingScenarioArmamentChoice = QidahenCore['pendingScenarioArmamentChoices'][number];

interface QidahenScenarioChoiceStateDependencies {
    getCharacterNameById: (
        factionId: QidahenFactionId,
        characterId: string,
    ) => string;
    getArmamentNameById: (
        armamentId: QidahenArmamentId,
    ) => string;
}

interface QidahenScenarioCharacterChoiceResolution {
    factions: QidahenCore['factions'];
    pendingScenarioCharacterChoices: QidahenCore['pendingScenarioCharacterChoices'];
    logText: string;
}

interface QidahenScenarioArmamentChoiceResolution {
    factions: QidahenCore['factions'];
    pendingScenarioArmamentChoices: QidahenCore['pendingScenarioArmamentChoices'];
    logText: string;
}

interface QidahenScenarioChoiceResolvedEventDependencies {
    getFactionIdByPlayerId: (
        state: QidahenCore,
        playerId: string,
    ) => QidahenFactionId;
    resolveScenarioCharacterChoice: (
        state: QidahenCore,
        groupId: string,
        characterIds: string[],
        dependencies?: QidahenScenarioChoiceStateDependencies,
    ) => QidahenScenarioCharacterChoiceResolution | null;
    resolveScenarioArmamentChoice: (
        state: QidahenCore,
        groupId: string,
        armamentIds: QidahenArmamentId[],
        dependencies?: QidahenScenarioChoiceStateDependencies,
    ) => QidahenScenarioArmamentChoiceResolution | null;
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
}

type QidahenScenarioCharacterChoiceResolvedEvent = Extract<
    QidahenEvent,
    { type: 'SCENARIO_CHARACTER_CHOICE_RESOLVED' }
>;

type QidahenScenarioArmamentChoiceResolvedEvent = Extract<
    QidahenEvent,
    { type: 'SCENARIO_ARMAMENT_CHOICE_RESOLVED' }
>;

const getQidahenScenarioCharacterChoiceGroupId = (
    scenarioId: QidahenScenarioId,
    factionId: QidahenFactionId,
    index: number,
): string => `${scenarioId}:${factionId}:character:${index}`;

const getQidahenScenarioArmamentChoiceGroupId = (
    scenarioId: QidahenScenarioId,
    factionId: QidahenFactionId,
    index: number,
): string => `${scenarioId}:${factionId}:armament:${index}`;

const getResolvedQidahenScenarioCharacterChoiceIds = (
    scenarioId: QidahenScenarioId,
    factionId: QidahenFactionId,
    group: QidahenScenarioCharacterChoiceGroup,
    index: number,
    resolveChoiceGroups: boolean,
    scenarioSelections?: QidahenScenarioChoiceSelections,
): string[] => {
    const groupId = getQidahenScenarioCharacterChoiceGroupId(scenarioId, factionId, index);
    const chosenIds = Array.from(new Set(scenarioSelections?.characterChoiceSelections?.[groupId] ?? []))
        .filter((characterId) => group.characterIds.includes(characterId))
        .slice(0, group.count);
    if (chosenIds.length === group.count) {
        return chosenIds;
    }
    return resolveChoiceGroups ? group.characterIds.slice(0, group.count) : [];
};

const getResolvedQidahenScenarioArmamentChoiceIds = (
    scenarioId: QidahenScenarioId,
    factionId: QidahenFactionId,
    group: QidahenScenarioArmamentChoiceGroup,
    index: number,
    resolveChoiceGroups: boolean,
    scenarioSelections?: QidahenScenarioChoiceSelections,
): QidahenArmamentId[] => {
    const groupId = getQidahenScenarioArmamentChoiceGroupId(scenarioId, factionId, index);
    const chosenIds = Array.from(new Set(scenarioSelections?.armamentChoiceSelections?.[groupId] ?? []))
        .filter((armamentId): armamentId is QidahenArmamentId => group.armamentIds.includes(armamentId))
        .slice(0, group.count);
    if (chosenIds.length === group.count) {
        return chosenIds;
    }
    return resolveChoiceGroups ? group.armamentIds.slice(0, group.count) : [];
};

export const applyQidahenScenarioPresetToFactionState = (
    faction: QidahenFactionState,
    scenarioId: QidahenScenarioId,
    preset: QidahenScenarioPreset['factions'][QidahenFactionId],
    resolveChoiceGroups: boolean,
    scenarioSelections?: QidahenScenarioChoiceSelections,
): QidahenFactionState => ({
    ...faction,
    handCount: preset.handCount,
    armaments: (() => {
        const resolvedChoiceLevels = preset.armamentChoiceGroups.reduce<Partial<Record<QidahenArmamentId, number>>>((acc, group, index) => {
            const chosenIds = getResolvedQidahenScenarioArmamentChoiceIds(
                scenarioId,
                faction.id,
                group,
                index,
                resolveChoiceGroups,
                scenarioSelections,
            );
            for (const armamentId of chosenIds) {
                acc[armamentId] = Math.max(acc[armamentId] ?? 0, 1);
            }
            return acc;
        }, {});
        return faction.armaments.map((armament) => ({
            ...armament,
            level: Math.max(
                preset.guaranteedArmamentLevels[armament.id] ?? 0,
                resolvedChoiceLevels[armament.id] ?? 0,
            ),
        }));
    })(),
    characters: (() => {
        const resolvedCharacterIds = new Set(
            preset.characterChoiceGroups.flatMap((group, index) => getResolvedQidahenScenarioCharacterChoiceIds(
                scenarioId,
                faction.id,
                group,
                index,
                resolveChoiceGroups,
                scenarioSelections,
            )),
        );
        return faction.characters.map((character) => {
            const isRemoved = preset.removedCharacterIds.includes(character.id);
            const isFixedInPlay = preset.fixedCharacterIds.includes(character.id);
            return {
                ...character,
                inPlay: isRemoved ? false : (isFixedInPlay || resolvedCharacterIds.has(character.id)),
                removedFromGame: isRemoved,
                defeatMarkers: 0,
            };
        });
    })(),
});

export const buildPendingQidahenScenarioCharacterChoices = (
    scenarioId: QidahenScenarioId,
    preset: QidahenScenarioPreset,
    dependencies: QidahenScenarioChoiceStateDependencies = {
        getCharacterNameById,
        getArmamentNameById,
    },
    scenarioSelections?: QidahenScenarioChoiceSelections,
): QidahenPendingScenarioCharacterChoice[] => (
    preset.factionOrder.flatMap((factionId) => preset.factions[factionId].characterChoiceGroups.flatMap((group, index) => {
        const resolvedChoiceIds = getResolvedQidahenScenarioCharacterChoiceIds(
            scenarioId,
            factionId,
            group,
            index,
            false,
            scenarioSelections,
        );
        if (resolvedChoiceIds.length === group.count) {
            return [];
        }
        return [{
            id: getQidahenScenarioCharacterChoiceGroupId(scenarioId, factionId, index),
            factionId,
            factionName: getFactionDisplayName(factionId),
            count: group.count,
            characterIds: [...group.characterIds],
            characterNames: group.characterIds.map((characterId) => dependencies.getCharacterNameById(factionId, characterId)),
        }];
    }))
);

export const buildPendingQidahenScenarioArmamentChoices = (
    scenarioId: QidahenScenarioId,
    preset: QidahenScenarioPreset,
    dependencies: QidahenScenarioChoiceStateDependencies = {
        getCharacterNameById,
        getArmamentNameById,
    },
    scenarioSelections?: QidahenScenarioChoiceSelections,
): QidahenPendingScenarioArmamentChoice[] => (
    preset.factionOrder.flatMap((factionId) => preset.factions[factionId].armamentChoiceGroups.flatMap((group, index) => {
        const resolvedChoiceIds = getResolvedQidahenScenarioArmamentChoiceIds(
            scenarioId,
            factionId,
            group,
            index,
            false,
            scenarioSelections,
        );
        if (resolvedChoiceIds.length === group.count) {
            return [];
        }
        return [{
            id: getQidahenScenarioArmamentChoiceGroupId(scenarioId, factionId, index),
            factionId,
            factionName: getFactionDisplayName(factionId),
            count: group.count,
            armamentIds: [...group.armamentIds],
            armamentNames: group.armamentIds.map(dependencies.getArmamentNameById),
        }];
    }))
);

const resolveQidahenScenarioCharacterChoice = (
    state: QidahenCore,
    groupId: string,
    characterIds: string[],
    dependencies: QidahenScenarioChoiceStateDependencies = {
        getCharacterNameById,
        getArmamentNameById,
    },
): QidahenScenarioCharacterChoiceResolution | null => {
    const group = state.pendingScenarioCharacterChoices.find((choice) => choice.id === groupId);
    if (!group) {
        return null;
    }
    const selectedIds = Array.from(new Set(characterIds))
        .filter((characterId) => group.characterIds.includes(characterId))
        .slice(0, group.count);
    if (selectedIds.length !== group.count) {
        return null;
    }
    const selectedNames = selectedIds.map((characterId) => dependencies.getCharacterNameById(group.factionId, characterId));
    return {
        factions: {
            ...state.factions,
            [group.factionId]: {
                ...state.factions[group.factionId],
                characters: state.factions[group.factionId].characters.map((character) => (
                    selectedIds.includes(character.id)
                        ? {
                            ...character,
                            inPlay: true,
                            removedFromGame: false,
                            defeatMarkers: 0,
                        }
                        : character
                )),
            },
        },
        pendingScenarioCharacterChoices: state.pendingScenarioCharacterChoices.filter((choice) => choice.id !== groupId),
        logText: `${group.factionName}确认剧本人物：${selectedNames.join('、')}。`,
    };
};

const resolveQidahenScenarioArmamentChoice = (
    state: QidahenCore,
    groupId: string,
    armamentIds: QidahenArmamentId[],
    dependencies: QidahenScenarioChoiceStateDependencies = {
        getCharacterNameById,
        getArmamentNameById,
    },
): QidahenScenarioArmamentChoiceResolution | null => {
    const group = state.pendingScenarioArmamentChoices.find((choice) => choice.id === groupId);
    if (!group) {
        return null;
    }
    const selectedIds = Array.from(new Set(armamentIds))
        .filter((armamentId): armamentId is QidahenArmamentId => group.armamentIds.includes(armamentId))
        .slice(0, group.count);
    if (selectedIds.length !== group.count) {
        return null;
    }
    const selectedNames = selectedIds.map(dependencies.getArmamentNameById);
    return {
        factions: {
            ...state.factions,
            [group.factionId]: {
                ...state.factions[group.factionId],
                armaments: state.factions[group.factionId].armaments.map((armament) => (
                    selectedIds.includes(armament.id)
                        ? { ...armament, level: Math.max(armament.level, 1) }
                        : armament
                )),
            },
        },
        pendingScenarioArmamentChoices: state.pendingScenarioArmamentChoices.filter((choice) => choice.id !== groupId),
        logText: `${group.factionName}确认剧本军备：${selectedNames.join('、')}。`,
    };
};

type QidahenScenarioChoiceResolvedEvent =
    | QidahenScenarioCharacterChoiceResolvedEvent
    | QidahenScenarioArmamentChoiceResolvedEvent;

export const resolveQidahenScenarioChoiceResolvedEvent = (
    state: QidahenCore,
    event: QidahenScenarioChoiceResolvedEvent,
    dependencies: QidahenScenarioChoiceResolvedEventDependencies = {
        getFactionIdByPlayerId,
        resolveScenarioCharacterChoice: resolveQidahenScenarioCharacterChoice,
        resolveScenarioArmamentChoice: resolveQidahenScenarioArmamentChoice,
        updateTurnLabel: updateQidahenTurnLabel,
    },
): QidahenCore => {
    const currentFactionId = dependencies.getFactionIdByPlayerId(
        state,
        event.payload.playerId,
    );
    switch (event.type) {
        case 'SCENARIO_CHARACTER_CHOICE_RESOLVED': {
            const resolution = dependencies.resolveScenarioCharacterChoice(
                state,
                event.payload.groupId,
                event.payload.characterIds,
            );
            if (!resolution) {
                return state;
            }
            return dependencies.updateTurnLabel({
                ...state,
                factions: resolution.factions,
                pendingScenarioCharacterChoices: resolution.pendingScenarioCharacterChoices,
                actionLog: [
                    {
                        id: `log-scenario-character-${event.timestamp}`,
                        faction: currentFactionId,
                        text: resolution.logText,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            });
        }
        case 'SCENARIO_ARMAMENT_CHOICE_RESOLVED': {
            const resolution = dependencies.resolveScenarioArmamentChoice(
                state,
                event.payload.groupId,
                event.payload.armamentIds,
            );
            if (!resolution) {
                return state;
            }
            return dependencies.updateTurnLabel({
                ...state,
                factions: resolution.factions,
                pendingScenarioArmamentChoices: resolution.pendingScenarioArmamentChoices,
                actionLog: [
                    {
                        id: `log-scenario-armament-${event.timestamp}`,
                        faction: currentFactionId,
                        text: resolution.logText,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            });
        }
    }
};
