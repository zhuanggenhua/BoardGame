import type { PlayerId } from '../../../engine/types';
import {
    qidahenKoreaSpecialPreview,
} from '../ui/cardAtlas';
import {
    buildTurnLabel,
    getActionChoiceById,
} from './factionActionWindow';
import { buildQidahenActionWindowEntryState } from './actionWindowEntryState';
import { getPreferredActionWindowSelectedRegionIdForFaction as getPreferredOpeningActionWindowSelectedRegionId } from './regionSelectionPreferences';
import { applyQidahenScenarioRuntimeRegionPreset } from './scenarioRuntimeRegionPresets';
import {
    buildYearCardSlots,
    getYearLabelByIndex,
} from './characterChronologyConfig';
import { getScenarioPlayableFactionIds } from './factionTurnOrder';
import { getQidahenScenarioPreset } from './scenarioPresets';
import {
    applyQidahenScenarioPresetToFactionState,
    buildPendingQidahenScenarioArmamentChoices,
    buildPendingQidahenScenarioCharacterChoices,
} from './scenarioChoiceState';
import {
    createInitialFactionState,
    createInitialFortifications,
    createInitialRuntimeRegionSummaries,
    getScenarioPlayerIdsByFaction,
} from './initialCoreSeeds';
import { buildInitialHandCards } from './handCardState';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { syncQidahenCorePieceCollections } from './coreDerivedState';
import {
    getQidahenWheelMoveChoices,
} from './wheelMoves';
import type {
    QidahenCore,
    QidahenScenarioChoiceSelections,
    QidahenScenarioId,
} from './types';

export const createInitialCore = (
    playerIds: PlayerId[],
    scenarioId: QidahenScenarioId = 'post-sarhu-1619',
    resolveChoiceGroups = false,
    scenarioSelections?: QidahenScenarioChoiceSelections,
): QidahenCore => {
    const playableFactionIds = getScenarioPlayableFactionIds(scenarioId);
    const normalizedPlayerIds = playableFactionIds.map((_, index) => playerIds[index] ?? String(index));
    const playerIdsByFaction = getScenarioPlayerIdsByFaction(normalizedPlayerIds, scenarioId);
    const fortifications = createInitialFortifications();
    const preset = getQidahenScenarioPreset(scenarioId);
    const regions = refreshRuntimeRegionRules(
        applyQidahenScenarioRuntimeRegionPreset(createInitialRuntimeRegionSummaries(), scenarioId),
        fortifications,
    );
    const currentYearIndex = preset.yearIndex;
    const factions: QidahenCore['factions'] = {
        ming: applyQidahenScenarioPresetToFactionState(
            createInitialFactionState('ming', playerIdsByFaction.ming),
            scenarioId,
            preset.factions.ming,
            resolveChoiceGroups,
            scenarioSelections,
        ),
        mongol: applyQidahenScenarioPresetToFactionState(
            createInitialFactionState('mongol', playerIdsByFaction.mongol),
            scenarioId,
            preset.factions.mongol,
            resolveChoiceGroups,
            scenarioSelections,
        ),
        jin: applyQidahenScenarioPresetToFactionState(
            createInitialFactionState('jin', playerIdsByFaction.jin),
            scenarioId,
            preset.factions.jin,
            resolveChoiceGroups,
            scenarioSelections,
        ),
    };
    const currentFactionOrder = [...preset.factionOrder];
    const openingFactionId = currentFactionOrder[0] ?? 'ming';
    const actionWindowEntryState = buildQidahenActionWindowEntryState(openingFactionId, {
        selectedRegionId: 'song-jin',
        selectedWheelMoveId: 'move-2-one-opponent',
    });
    const selectedActionId = actionWindowEntryState.selectedActionId;
    const pendingScenarioCharacterChoices = resolveChoiceGroups
        ? []
        : buildPendingQidahenScenarioCharacterChoices(
            scenarioId,
            preset,
            undefined,
            scenarioSelections,
        );
    const pendingScenarioArmamentChoices = resolveChoiceGroups
        ? []
        : buildPendingQidahenScenarioArmamentChoices(
            scenarioId,
            preset,
            undefined,
            scenarioSelections,
        );

    const baseCore: QidahenCore = {
        playerIds: normalizedPlayerIds,
        scenarioId,
        scenarioLabel: preset.label,
        pendingScenarioCharacterChoices,
        pendingScenarioArmamentChoices,
        currentFactionOrder,
        currentPlayer: factions[openingFactionId].playerId,
        roundNumber: 1,
        currentYearIndex,
        currentYear: getYearLabelByIndex(currentYearIndex),
        turnLabel: buildTurnLabel(1, factions[openingFactionId].name, 'action-window', false, false, false),
        ...actionWindowEntryState,
        actionWheelPosition: 'wheel-military-farm',
        wheelMoveChoices: getQidahenWheelMoveChoices(),
        lastSeasonSummary: null,
        hanseongPrestigeUnlocked: false,
        victoryStatus: null,
        factions,
        regions,
        fortifications,
        yearCards: buildYearCardSlots(currentYearIndex),
        koreaDeckCount: 12,
        koreaDiscardCount: 5,
        koreaDiscardPreviewRef: qidahenKoreaSpecialPreview(0),
        drawPileCount: 20,
        discardPileCount: 7,
        handCards: buildInitialHandCards(factions),
        nextPieceSerial: 1,
        pieces: [],
        mapTokens: [],
        routeLines: [
            {
                id: 'ming-route',
                tone: 'blue',
                points: [
                    { x: 0.57, y: 0.63 },
                    { x: 0.57, y: 0.73 },
                    { x: 0.76, y: 0.73 },
                    { x: 0.76, y: 0.64 },
                    { x: 0.845, y: 0.64 },
                ],
            },
            {
                id: 'target-route',
                tone: 'red',
                points: [
                    { x: 0.89, y: 0.40 },
                    { x: 0.86, y: 0.47 },
                    { x: 0.84, y: 0.55 },
                    { x: 0.84, y: 0.66 },
                ],
            },
        ],
        actionLog: [
            { id: 'log-1', faction: openingFactionId, text: `${factions[openingFactionId].name} 进入势力行动并锁定 ${getActionChoiceById(selectedActionId)?.label ?? selectedActionId}。` },
            { id: 'log-2', faction: 'jin', text: '后金 在 沿海据点 维持前线兵力。' },
        ],
    };

    const syncedBaseCore = syncQidahenCorePieceCollections(baseCore);
    return {
        ...syncedBaseCore,
        selectedRegionId: getPreferredOpeningActionWindowSelectedRegionId(syncedBaseCore, openingFactionId),
    };
};
