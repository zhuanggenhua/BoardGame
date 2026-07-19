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
import {
    DEFAULT_QIDAHEN_SCENARIO_ID,
    getQidahenScenarioIdsForPlayerCount,
    getQidahenScenarioVoteMeta,
} from '../roomSetup';

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
        scenarioVote: null,
        factionSelection: null,
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
        activeEventCards: [],
        hanseongPrestigeUnlocked: false,
        guihuaPrestigeMarkerController: null,
        victoryStatus: null,
        pincerAdvanceSelection: null,
        infantryCavalryCombinedSelection: null,
        raidAndAmbushSelection: null,
        feignedRetreatSelection: null,
        instigateDefectionSelection: null,
        wuzhenChaohaSelection: null,
        openGateSurrenderSelection: null,
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
            { id: 'log-1', faction: openingFactionId, text: `${factions[openingFactionId].name} 进入行动窗口，当前聚焦 ${getActionChoiceById(selectedActionId)?.label ?? selectedActionId}。` },
            { id: 'log-2', faction: 'jin', text: '后金 在 沿海据点 维持前线兵力。' },
        ],
    };

    const syncedBaseCore = syncQidahenCorePieceCollections(baseCore);
    const openingSelectedRegionId = getPreferredOpeningActionWindowSelectedRegionId(syncedBaseCore, openingFactionId);
    return {
        ...syncedBaseCore,
        selectedRegionId: openingSelectedRegionId,
        explicitRegionId: null,
        regionFocusState: {
            defaultFocusRegionId: openingSelectedRegionId,
            lockedSourceRegionId: null,
            currentTargetRegionId: null,
            displayAnchorRegionId: openingSelectedRegionId,
        },
    };
};

export const createInitialCoreForInMatchScenarioVote = (
    playerIds: PlayerId[],
): QidahenCore => {
    const allowedScenarioIds = getQidahenScenarioIdsForPlayerCount(playerIds.length);
    const placeholderScenarioId = allowedScenarioIds[0] ?? DEFAULT_QIDAHEN_SCENARIO_ID;
    const baseCore = createInitialCore(playerIds, placeholderScenarioId, true);
    return {
        ...baseCore,
        scenarioVote: {
            playerCount: playerIds.length,
            hostPlayerId: playerIds[0] ?? '0',
            options: allowedScenarioIds.map((scenarioId) => {
                const meta = getQidahenScenarioVoteMeta(scenarioId);
                return {
                    scenarioId,
                    label: meta.label,
                    supportedPlayerCounts: [...meta.supportedPlayerCounts],
                    intro: meta.intro,
                    overview: meta.overview,
                };
            }),
            votes: Object.fromEntries(playerIds.map((playerId) => [playerId, null])) as Record<PlayerId, QidahenScenarioId | null>,
        },
        actionLog: [
            {
                id: 'log-scenario-vote-intro',
                faction: baseCore.currentFactionOrder[0] ?? 'ming',
                text: '进入局内剧本介绍与房主选择阶段，房主选择后才会进入正式开局前置。',
            },
        ],
    };
};
