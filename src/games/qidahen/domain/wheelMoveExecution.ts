import {
    addFactionHandCards,
    buildDrawnHandCards,
    drawFromFactionPile,
} from './handCardState';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import { resolveQidahenMidyear } from './seasonResolution';
import { getCurrentFactionId } from './factionTurnAccessors';
import {
    buildWheelDispatchSelectionFromWheel,
    shouldPersistExplicitWheelDispatchSelectionForWheelState,
} from './dispatchSelectionBuilders';
import {
    buildQidahenRegionFocusState,
    getQidahenLockedRegionSelectionSemantics,
} from './regionFocusSemantics';
import { buildDiplomacySelectionFromRegionSemantics } from './selectionBuilders';
import {
    buildQidahenWheelMoveSummary,
    getQidahenWheelMoveById,
} from './wheelMoves';
import { applyQidahenWheelImmediateEffect } from './wheelImmediateEffect';
import {
    advanceQidahenTurnIfReady,
} from './turnAdvance';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenSeasonSummary,
} from './types';
import { applyQidahenVictoryStatus } from './victoryResolution';

const wheelSectorOrder = [
    'wheel-reclaim',
    'wheel-military-farm',
    'wheel-recruit-train',
    'wheel-diplomacy',
    'wheel-hire',
    'wheel-attack',
    'wheel-midyear',
    'wheel-new-year',
];

interface QidahenWheelMoveExecutionDependencies {
    drawFromFactionPile: (
        factions: QidahenCore['factions'],
        sourceFactionId: QidahenFactionId,
        requestedCards: number,
        discardGain?: number,
    ) => { factions: QidahenCore['factions']; drawnCards: number };
    addFactionHandCards: (
        factions: QidahenCore['factions'],
        factionId: QidahenFactionId,
        handGain: number,
    ) => QidahenCore['factions'];
    buildDrawnHandCards: (
        state: QidahenCore,
        factionId: QidahenFactionId,
        drawCards: number,
    ) => QidahenCore['handCards'];
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
    resolveMidyear: (
        state: QidahenCore,
        timestamp: number,
    ) => Pick<QidahenCore, 'factions' | 'lastSeasonSummary'>;
    applyVictoryStatus: (
        state: QidahenCore,
        options?: { allowHegemony?: boolean },
    ) => QidahenCore;
    advanceTurnIfReady: (
        state: QidahenCore,
        timestamp: number,
    ) => QidahenCore;
}

export const resolveQidahenWheelMoveExecuted = (
    state: QidahenCore,
    moveId: string,
    timestamp: number,
    dependencies: QidahenWheelMoveExecutionDependencies = {
        drawFromFactionPile,
        addFactionHandCards,
        buildDrawnHandCards,
        buildSeasonSummary,
        resolveMidyear: resolveQidahenMidyear,
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
    },
): QidahenCore => {
    const move = getQidahenWheelMoveById(moveId);
    if (!move) return state;

    const currentWheelPositionIndex = Math.max(0, wheelSectorOrder.indexOf(state.actionWheelPosition));
    const nextWheelPosition = wheelSectorOrder[
        (currentWheelPositionIndex + move.steps) % wheelSectorOrder.length
    ];
    if (!nextWheelPosition) {
        return state;
    }
    let wheelDrawFactions = state.factions;
    let wheelDrawHandCards = state.handCards;
    if (move.steps >= 2) {
        const mongolDraw = dependencies.drawFromFactionPile(wheelDrawFactions, 'mongol', 2);
        wheelDrawFactions = dependencies.addFactionHandCards(mongolDraw.factions, 'mongol', mongolDraw.drawnCards);
        wheelDrawHandCards = dependencies.buildDrawnHandCards(
            { ...state, factions: wheelDrawFactions, handCards: wheelDrawHandCards },
            'mongol',
            mongolDraw.drawnCards,
        );
    }
    if (move.steps >= 3) {
        const jinDraw = dependencies.drawFromFactionPile(wheelDrawFactions, 'jin', 2);
        wheelDrawFactions = dependencies.addFactionHandCards(jinDraw.factions, 'jin', jinDraw.drawnCards);
        wheelDrawHandCards = dependencies.buildDrawnHandCards(
            { ...state, factions: wheelDrawFactions, handCards: wheelDrawHandCards },
            'jin',
            jinDraw.drawnCards,
        );
    }

    let nextState: QidahenCore = {
        ...state,
        selectedWheelMoveId: move.id,
        wheelActionUsed: true,
        actionWheelPosition: nextWheelPosition,
        wheelMoveSummary: buildQidahenWheelMoveSummary(move.id),
        lastSeasonSummary: null,
        diplomacyProgress: null,
        wheelDispatchProgress: null,
        postBattleSelection: null,
        factions: wheelDrawFactions,
        handCards: wheelDrawHandCards,
    };
    const currentFactionId = getCurrentFactionId(nextState);

    if (nextWheelPosition === 'wheel-midyear') {
        const midyearResolution = dependencies.resolveMidyear(nextState, timestamp);
        nextState = {
            ...nextState,
            factions: midyearResolution.factions,
            lastSeasonSummary: midyearResolution.lastSeasonSummary,
            actionLog: [
                {
                    id: `log-midyear-${timestamp}`,
                    faction: currentFactionId,
                    text: '轮盘停在年中，已执行土地税赋与人物判定摘要。',
                },
                ...state.actionLog,
            ].slice(0, 6),
        };
    } else if (nextWheelPosition === 'wheel-new-year') {
        nextState = {
            ...nextState,
            turnPhase: 'season-resolution',
            selectedRegionId: 'song-jin',
            lastSeasonSummary: dependencies.buildSeasonSummary('新年结算', timestamp, [
                '轮盘停在新年，等待大明选择防线维护方式。',
                `大明当前手牌 ${nextState.factions.ming.handCount} 张。`,
            ]),
            actionLog: [
                {
                    id: `log-new-year-${timestamp}`,
                    faction: currentFactionId,
                    text: '轮盘停在新年，等待大明选择防线维护方式。',
                },
                ...state.actionLog,
            ].slice(0, 6),
        };
    }

    if (nextWheelPosition === 'wheel-attack') {
        const diplomacySelection = buildDiplomacySelectionFromRegionSemantics(
            nextState,
            currentFactionId,
            getQidahenLockedRegionSelectionSemantics(nextState),
            'wheel-hire',
        );
        if (diplomacySelection) {
            const diplomacySourceRegionId = diplomacySelection.sourceRegionId
                ?? diplomacySelection.displayAnchorRegionId
                ?? nextState.selectedRegionId;
            nextState = {
                ...nextState,
                selectedRegionId: diplomacySourceRegionId,
                explicitRegionId: null,
                regionFocusState: buildQidahenRegionFocusState(diplomacySourceRegionId, {
                    lockedSourceRegionId: diplomacySourceRegionId,
                    displayAnchorRegionId: diplomacySelection.displayAnchorRegionId ?? diplomacySourceRegionId,
                }),
                turnPhase: 'diplomacy-choice',
                diplomacyProgress: null,
                actionLog: [
                    {
                        id: `log-wheel-diplomacy-${timestamp}`,
                        faction: currentFactionId,
                        text: `${nextState.factions[currentFactionId].name} 轮盘进入外交/雇佣，等待选择外交目标。`,
                    },
                    ...nextState.actionLog,
                ].slice(0, 6),
            };
        } else {
            nextState = {
                ...nextState,
                lastSeasonSummary: dependencies.buildSeasonSummary('轮盘外交/雇佣', timestamp, [
                    `${nextState.factions[currentFactionId].name} 当前没有可执行外交/雇佣的己方控制区域。`,
                ]),
            };
        }
    } else {
        nextState = applyQidahenWheelImmediateEffect(
            nextState,
            currentFactionId,
            nextWheelPosition,
            timestamp,
        );
    }

    const wheelDispatchSelection = buildWheelDispatchSelectionFromWheel(
        nextState,
        currentFactionId,
        nextWheelPosition,
        nextState.selectedRegionId,
    );
    if (wheelDispatchSelection) {
        const shouldPersistExplicitWheelDispatchSelection = shouldPersistExplicitWheelDispatchSelectionForWheelState(
            nextState,
            wheelDispatchSelection,
            nextWheelPosition,
        );
        nextState = {
            ...nextState,
            selectedRegionId: wheelDispatchSelection.sourceRegionId,
            explicitRegionId: null,
            regionFocusState: buildQidahenRegionFocusState(wheelDispatchSelection.sourceRegionId, {
                lockedSourceRegionId: wheelDispatchSelection.sourceRegionId,
                displayAnchorRegionId: wheelDispatchSelection.displayAnchorRegionId ?? wheelDispatchSelection.sourceRegionId,
            }),
            turnPhase: 'dispatch-targeting',
            wheelDispatchProgress: shouldPersistExplicitWheelDispatchSelection ? wheelDispatchSelection : null,
            pendingTargetAction: null,
            actionLog: [
                {
                    id: `log-wheel-dispatch-${timestamp}`,
                    faction: currentFactionId,
                    text: `${nextState.factions[currentFactionId].name} 轮盘进入进攻/调度，等待选择目标 · ${wheelDispatchSelection.movementProfileLabel}。`,
                },
                ...nextState.actionLog,
            ].slice(0, 6),
        };
    }

    return dependencies.advanceTurnIfReady(
        dependencies.applyVictoryStatus(nextState, { allowHegemony: nextWheelPosition === 'wheel-new-year' }),
        timestamp,
    );
};
