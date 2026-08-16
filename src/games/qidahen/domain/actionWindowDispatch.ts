import { syncFactionActionWindow } from './factionActionWindow';
import { buildQidahenRegionFocusState } from './regionFocusSemantics';
import { getCurrentFactionId } from './factionTurnAccessors';
import { isOwnSiegedCityReinforcementTarget } from './regionSelectionPreferences';
import { isQidahenCityRuntimeRegion } from './regionConfig';
import {
    getQidahenCurrentWheelDispatchSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
} from './dispatchSelectionBuilders';
import { getQidahenInteractionSelectionStateForCore } from './interactionSelectionAccessors';
import { materializeNonSiegedCityActionSourceRegion } from './actionSourceRegionState';
import { applyCommittedTroopRemovalToRegion } from './pendingBattleCombatSupport';
import { applyRequestedCommittedTroops } from './pendingBattleCommittedTroops';
import { createQidahenBattleForceCommitment } from './battleForceCommitments';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import { updateQidahenTurnLabel } from './turnLabelState';
import {
    addSpecialTroopStacksToRegion,
    formatTroopTransferDetails,
    mergeSpecialTroopStackGroupsAsPieces,
} from './troopCompat';
import { advanceQidahenTurnIfReady } from './turnAdvance';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenGaoDiDispatchSelection,
    QidahenInternalDispatchSelection,
    QidahenPendingTargetAction,
    QidahenSeasonSummary,
    QidahenWheelDispatchCandidate,
    QidahenWheelDispatchSelection,
} from './types';
import { applyQidahenVictoryStatus } from './victoryResolution';

interface QidahenActionWindowDispatchDependencies {
    materializeNonSiegedCityActionSourceRegion: (
        region: QidahenCore['regions'][number],
    ) => QidahenCore['regions'][number];
    applyCommittedTroopRemovalToRegion: (
        region: QidahenCore['regions'][number],
        committedTroops: number,
    ) => QidahenCore['regions'][number];
    refreshRuntimeRegionRules: (
        regions: QidahenCore['regions'],
        fortifications: QidahenCore['fortifications'],
    ) => QidahenCore['regions'];
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
    applyVictoryStatus: (state: QidahenCore) => QidahenCore;
    advanceTurnIfReady: (state: QidahenCore, timestamp: number) => QidahenCore;
    getCurrentWheelDispatchSelectionForCore: (
        state: QidahenCore,
    ) => QidahenWheelDispatchSelection | null;
}

const markCharacterActionWindowEffectHandled = (
    state: QidahenCore,
    effectId: string,
): string => {
    const triggerKey = `${state.currentPlayer}:${state.roundNumber}:${Number(state.wheelActionUsed)}:${Number(state.factionActionUsed)}`;
    const progressKey = state.lastCharacterActionWindowTriggerKey;
    const handledEffectIds = !progressKey?.startsWith(`${triggerKey}|`)
        ? new Set<string>()
        : new Set(progressKey.slice(triggerKey.length + 1).split(',').filter(Boolean));
    handledEffectIds.add(effectId);
    return `${triggerKey}|${[...handledEffectIds].sort().join(',')}`;
};

const buildPendingTargetActionFromWheelDispatchChoice = (
    selection: QidahenWheelDispatchSelection,
    candidate: QidahenWheelDispatchCandidate,
    options: {
        actionId?: 'wheel-dispatch' | 'drive-tiger';
        title?: string;
    } = {},
): QidahenPendingTargetAction => ({
    actionId: options.actionId ?? (selection.sourceActionId === 'drive-tiger' ? 'drive-tiger' : 'wheel-dispatch'),
    battleMode: candidate.battleMode ?? (isQidahenCityRuntimeRegion(candidate.targetRuntimeRegionId) ? 'city' : 'field'),
    targetKind: candidate.targetKind ?? 'region',
    title: options.title ?? (selection.sourceActionId === 'drive-tiger' ? '驱虎吞狼待结算' : '调度进攻待结算'),
    attackerFactionId: selection.attackerFactionId,
    sourceRegionId: selection.sourceRegionId,
    sourceRegionName: selection.sourceRegionName,
    attackerPositionRegionId: candidate.attackerPositionRegionId ?? null,
    targetRegionId: candidate.targetRegionId,
    targetRegionName: candidate.targetRegionName,
    targetRuntimeRegionId: candidate.targetRuntimeRegionId,
    defenderFactionId: candidate.defenderFactionId,
    defenderLabel: candidate.defenderLabel,
    restriction: selection.restriction,
    battleWidth: candidate.battleWidth,
    boundaryUnitCap: candidate.boundaryUnitCap,
    sourceAvailableTroops: candidate.sourceAvailableTroops,
    committedTroops: candidate.committedTroops,
    movementProfileId: selection.movementProfileId,
    attackPressure: candidate.attackPressure,
    attackBoundaryType: candidate.attackBoundaryType,
    resolutionHint: candidate.resolutionHint,
    defenderPayCost: null,
    forceCommitments: [createQidahenBattleForceCommitment({
        sourceRegionId: selection.sourceRegionId,
        sourceRegionName: selection.sourceRegionName,
        sourceAvailableTroops: candidate.sourceAvailableTroops,
        committedTroops: candidate.committedTroops,
        movementProfileId: selection.movementProfileId,
        battleWidth: candidate.battleWidth,
        boundaryUnitCap: candidate.boundaryUnitCap,
        attackBoundaryType: candidate.attackBoundaryType,
    })],
});

const resolveGaoDiDispatch = (
    state: QidahenCore,
    selection: QidahenGaoDiDispatchSelection,
    choiceId: string,
    dependencies: QidahenActionWindowDispatchDependencies,
): Pick<QidahenCore, 'regions' | 'factions' | 'handCards' | 'discardPileCount'> & {
    selectedRegionId: string;
    summaryLines: string[];
    logText: string;
} => {
    if (choiceId === 'skip') {
        return {
            regions: state.regions,
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: selection.sourceRegionId,
            summaryLines: ['高第本次放弃行动前调度。'],
            logText: '高第本次放弃行动前调度。',
        };
    }

    const choice = selection.candidates.find((candidate) => candidate.id === choiceId) ?? null;
    const selectedCardId = selection.selectedCardId;
    if (!choice || !selectedCardId) {
        return {
            regions: state.regions,
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: selection.sourceRegionId,
            summaryLines: ['高第本次未完成弃牌调度。'],
            logText: '高第本次未完成弃牌调度。',
        };
    }

    const removedCardIds = new Set([selectedCardId]);
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRuntimeRegion = runtimeRegions.find((region) => region.id === choice.targetRegionId) ?? null;
    const isSiegeReinforcementTarget = isOwnSiegedCityReinforcementTarget(targetRuntimeRegion, 'ming');
    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id === selection.sourceRegionId) {
            const actionSourceRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            if (choice.mode === 'population') {
                return {
                    ...actionSourceRegion,
                    population: Math.max(0, actionSourceRegion.population - choice.committedPopulation),
                    note: `${actionSourceRegion.name} 因高第弃牌调度，向 ${choice.targetRegionName} 调出 ${choice.committedPopulation} 个人口。`,
                };
            }
            return {
                ...dependencies.applyCommittedTroopRemovalToRegion({
                    ...actionSourceRegion,
                    troops: Math.max(0, actionSourceRegion.troops - choice.committedTroops),
                    note: `${actionSourceRegion.name} 因高第弃牌调度，向 ${choice.targetRegionName} 调出 ${choice.committedTroops} 个部队。`,
                }, choice.committedTroops),
            };
        }
        if (region.id === choice.targetRegionId) {
            if (isSiegeReinforcementTarget && region.siegeState) {
                return {
                    ...region,
                    siegeState: {
                        ...region.siegeState,
                        attackerTroops: region.siegeState.attackerTroops + choice.committedTroops,
                        attackerSpecialTroops: mergeSpecialTroopStackGroupsAsPieces(
                            region.siegeState.attackerSpecialTroops,
                            choice.movedSpecialTroops,
                        ),
                    },
                    note: `${region.name} 因高第弃牌调度，自 ${selection.sourceRegionName} 获得 ${choice.committedTroops} 个围城增援。`,
                };
            }
            const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            if (choice.mode === 'population') {
                return {
                    ...actionTargetRegion,
                    population: actionTargetRegion.population + choice.committedPopulation,
                    note: `${actionTargetRegion.name} 因高第弃牌调度，自 ${selection.sourceRegionName} 接收 ${choice.committedPopulation} 个人口。`,
                };
            }
            return addSpecialTroopStacksToRegion({
                ...actionTargetRegion,
                troops: actionTargetRegion.troops + choice.committedTroops,
                note: `${actionTargetRegion.name} 因高第弃牌调度，自 ${selection.sourceRegionName} 接收 ${choice.committedTroops} 个部队。`,
            }, choice.movedSpecialTroops);
        }
        return region;
    });
    const nextRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const detail = choice.mode === 'troops'
        ? (formatTroopTransferDetails(choice.movedGenericTroops, choice.movedSpecialTroops) || '未结构化部队')
        : `${choice.committedPopulation} 个人口`;
    const dispatchAmountLabel = choice.mode === 'troops'
        ? `${choice.committedTroops + choice.committedPopulation} 个部队`
        : `${choice.committedTroops + choice.committedPopulation} 个人口`;
    const dispatchSummaryLabel = choice.mode === 'troops' && isSiegeReinforcementTarget
        ? ` 增援围城部队 ${dispatchAmountLabel}`
        : ` 调度 ${dispatchAmountLabel}`;
    return {
        selectedRegionId: choice.targetRegionId,
        regions: nextRegions,
        factions: {
            ...state.factions,
            ming: {
                ...state.factions.ming,
                handCount: Math.max(0, state.factions.ming.handCount - 1),
                discardPileCount: Math.max(0, state.factions.ming.discardPileCount ?? 0) + 1,
            },
        },
        handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
        discardPileCount: state.discardPileCount + 1,
        summaryLines: [
            `大明因高第弃 1 张手牌，自 ${selection.sourceRegionName} 向 ${choice.targetRegionName}${dispatchSummaryLabel}。`,
            `调度细节：${detail}。`,
        ],
        logText: `高第令 ${selection.sourceRegionName} 向 ${choice.targetRegionName}${dispatchSummaryLabel}，并弃 1 张手牌。`,
    };
};

const resolveInternalDispatch = (
    state: QidahenCore,
    selection: QidahenInternalDispatchSelection,
    choiceId: string,
    dependencies: QidahenActionWindowDispatchDependencies,
): Pick<QidahenCore, 'regions' | 'factions'> & {
    selectedRegionId: string;
    summaryLines: string[];
    logText: string;
} => {
    const choice = selection.candidates.find((candidate) => candidate.id === choiceId) ?? selection.candidates[0];
    if (!choice) {
        return {
            regions: state.regions,
            factions: state.factions,
            selectedRegionId: selection.sourceRegionId,
            summaryLines: ['王化贞本次未完成内部调度。'],
            logText: '王化贞本次未完成内部调度。',
        };
    }
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRuntimeRegion = runtimeRegions.find((region) => region.id === choice.targetRegionId) ?? null;
    const isSiegeReinforcementTarget = isOwnSiegedCityReinforcementTarget(targetRuntimeRegion, 'ming');
    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id === selection.sourceRegionId) {
            const actionSourceRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return {
                ...dependencies.applyCommittedTroopRemovalToRegion({
                    ...actionSourceRegion,
                    troops: Math.max(0, actionSourceRegion.troops - choice.committedTroops),
                    note: `${actionSourceRegion.name} 因王化贞免费调度，向 ${choice.targetRegionName} 调出 ${choice.committedTroops} 个部队。`,
                }, choice.committedTroops),
            };
        }
        if (region.id === choice.targetRegionId) {
            if (isSiegeReinforcementTarget && region.siegeState) {
                return {
                    ...region,
                    siegeState: {
                        ...region.siegeState,
                        attackerTroops: region.siegeState.attackerTroops + choice.committedTroops,
                        attackerSpecialTroops: mergeSpecialTroopStackGroupsAsPieces(
                            region.siegeState.attackerSpecialTroops,
                            choice.movedSpecialTroops,
                        ),
                    },
                    note: `${region.name} 因王化贞免费调度，自 ${selection.sourceRegionName} 获得 ${choice.committedTroops} 个围城增援。`,
                };
            }
            const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStacksToRegion({
                ...actionTargetRegion,
                troops: actionTargetRegion.troops + choice.committedTroops,
                note: `${actionTargetRegion.name} 因王化贞免费调度，自 ${selection.sourceRegionName} 接收 ${choice.committedTroops} 个部队。`,
            }, choice.movedSpecialTroops);
        }
        return region;
    });
    const nextRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const detail = formatTroopTransferDetails(choice.movedGenericTroops, choice.movedSpecialTroops);
    const dispatchSummaryLabel = isSiegeReinforcementTarget
        ? ` 增援围城 ${choice.committedTroops} 个部队`
        : ` 调动 ${choice.committedTroops} 个部队`;
    return {
        selectedRegionId: choice.targetRegionId,
        regions: nextRegions,
        factions: state.factions,
        summaryLines: [
            `大明因王化贞免费调度，自 ${selection.sourceRegionName} 向 ${choice.targetRegionName}${dispatchSummaryLabel}。`,
            detail ? `调度细节：${detail}。` : '调度细节：未结构化部队移动。',
        ],
        logText: `王化贞令 ${selection.sourceRegionName} 向 ${choice.targetRegionName}${isSiegeReinforcementTarget ? ` 免费增援围城 ${choice.committedTroops} 个部队` : ` 免费调度 ${choice.committedTroops} 个部队`}。`,
    };
};

export const resolveQidahenGaoDiDispatchChoice = (
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
    interactionSelection?: QidahenGaoDiDispatchSelection | null,
    factionId?: QidahenFactionId,
    dependencies: QidahenActionWindowDispatchDependencies = {
        materializeNonSiegedCityActionSourceRegion,
        applyCommittedTroopRemovalToRegion,
        refreshRuntimeRegionRules,
        buildSeasonSummary,
        updateTurnLabel: updateQidahenTurnLabel,
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        getCurrentWheelDispatchSelectionForCore: getQidahenCurrentWheelDispatchSelectionForCore,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        (core) => core.gaoDiDispatchSelection,
    );
    if (!selection) {
        return state;
    }
    const currentFactionId = factionId ?? getCurrentFactionId(state);
    const resolution = resolveGaoDiDispatch(state, selection, choiceId, dependencies);
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: resolution.selectedRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(resolution.selectedRegionId),
        turnPhase: 'action-window',
        lastCharacterActionWindowTriggerKey: markCharacterActionWindowEffectHandled(state, 'ming-gao-di'),
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        handLimitDiscardSelection: null,
        gaoDiDispatchSelection: null,
        wheelDispatchProgress: null,
        pendingTargetAction: null,
        postBattleSelection: null,
        regions: resolution.regions,
        factions: resolution.factions,
        handCards: resolution.handCards,
        discardPileCount: resolution.discardPileCount,
        lastSeasonSummary: dependencies.buildSeasonSummary(selection.title, timestamp, resolution.summaryLines),
        actionLog: [
            {
                id: `log-gao-di-dispatch-${timestamp}`,
                faction: currentFactionId,
                text: resolution.logText,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), timestamp);
};

export const resolveQidahenInternalDispatchInteractionChoice = (
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
    interactionSelection?: QidahenInternalDispatchSelection | null,
    dependencies: QidahenActionWindowDispatchDependencies = {
        materializeNonSiegedCityActionSourceRegion,
        applyCommittedTroopRemovalToRegion,
        refreshRuntimeRegionRules,
        buildSeasonSummary,
        updateTurnLabel: updateQidahenTurnLabel,
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        getCurrentWheelDispatchSelectionForCore: getQidahenCurrentWheelDispatchSelectionForCore,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenInternalDispatchSelectionForCore,
    );
    if (!selection) {
        return state;
    }
    const currentFactionId = getCurrentFactionId(state);
    const resolution = resolveInternalDispatch(state, selection, choiceId, dependencies);
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: resolution.selectedRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(resolution.selectedRegionId),
        turnPhase: 'action-window',
        lastCharacterActionWindowTriggerKey: markCharacterActionWindowEffectHandled(state, 'ming-wang-huazhen'),
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        handLimitDiscardSelection: null,
        gaoDiDispatchSelection: null,
        wheelDispatchProgress: null,
        pendingTargetAction: null,
        postBattleSelection: null,
        regions: resolution.regions,
        factions: resolution.factions,
        lastSeasonSummary: dependencies.buildSeasonSummary(
            selection.title,
            timestamp,
            resolution.summaryLines,
        ),
        actionLog: [
            {
                id: `log-internal-dispatch-${timestamp}`,
                faction: currentFactionId,
                text: resolution.logText,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), timestamp);
};

export const resolveQidahenWheelDispatchInteractionChoice = (
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
    interactionSelection?: QidahenWheelDispatchSelection | null,
    requestedCommittedTroops?: number,
    dependencies: QidahenActionWindowDispatchDependencies = {
        materializeNonSiegedCityActionSourceRegion,
        applyCommittedTroopRemovalToRegion,
        refreshRuntimeRegionRules,
        buildSeasonSummary,
        updateTurnLabel: updateQidahenTurnLabel,
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        getCurrentWheelDispatchSelectionForCore: getQidahenCurrentWheelDispatchSelectionForCore,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        dependencies.getCurrentWheelDispatchSelectionForCore,
    );
    if (!selection) {
        return state;
    }

    const chosenTarget = selection.candidates.find((candidate) => (
        candidate.targetRuntimeRegionId === choiceId
        || candidate.targetRegionId === choiceId
    ));
    if (!chosenTarget) {
        return state;
    }

    const selectionSourceActionId = selection.sourceActionId ?? 'wheel-dispatch';
    const pendingActionMeta = selectionSourceActionId === 'drive-tiger'
        ? {
            actionId: 'drive-tiger' as const,
            title: '驱虎吞狼待结算',
        }
        : {
            actionId: 'wheel-dispatch' as const,
            title: '调度进攻待结算',
        };
    const pendingTargetAction = applyRequestedCommittedTroops(
        state,
        buildPendingTargetActionFromWheelDispatchChoice(
            selection,
            chosenTarget,
            pendingActionMeta,
        ),
        requestedCommittedTroops,
    );
    return dependencies.updateTurnLabel({
        ...state,
        selectedRegionId: chosenTarget.targetRegionId,
        explicitRegionId: chosenTarget.targetRegionId,
        regionFocusState: buildQidahenRegionFocusState(chosenTarget.targetRegionId, {
            lockedSourceRegionId: selection.sourceRegionId,
            currentTargetRegionId: chosenTarget.targetRegionId,
            displayAnchorRegionId: chosenTarget.targetRegionId,
        }),
        turnPhase: 'resolve-pending',
        wheelDispatchProgress: null,
        pendingTargetAction,
        actionLog: [
            {
                id: `log-wheel-dispatch-target-${timestamp}`,
                faction: selectionSourceActionId === 'drive-tiger'
                    ? getCurrentFactionId(state)
                    : selection.attackerFactionId,
                text: selectionSourceActionId === 'drive-tiger'
                    ? `${state.factions[getCurrentFactionId(state)].name} 为 ${state.factions[selection.attackerFactionId].name} 锁定调度目标 ${chosenTarget.targetRegionName}（${chosenTarget.resolutionHint}）。`
                    : `${state.factions[selection.attackerFactionId].name} 锁定调度目标 ${chosenTarget.targetRegionName}（${chosenTarget.resolutionHint}）。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
};
