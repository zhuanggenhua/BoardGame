import { buildDriveTigerDispatchSelectionFromRegionSemantics } from './dispatchSelectionBuilders';
import { buildPendingTargetAction } from './pendingTargetActionBuilder';
import { getQidahenExplicitRegionSelectionSemantics } from './regionFocusSemantics';
import {
    buildKhanEdictSelectionFromRegionSemantics,
    buildMaShiTradeSelectionFromRegionSemantics,
    buildRecruitSelectionFromRegionSemantics,
} from './selectionBuilders';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenSeasonSummary,
} from './types';

interface QidahenSelectedActionFollowUpDependencies {
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
}

interface QidahenSelectedActionFollowUpResolutionResult {
    driveTigerDispatchSelection: QidahenCore['wheelDispatchProgress'];
    khanEdictSelection: QidahenCore['khanEdictSelection'];
    lastSeasonSummary: QidahenSeasonSummary | null;
    maShiTradeSelection: QidahenCore['maShiTradeSelection'];
    pendingTargetAction: QidahenPendingTargetAction | null;
    recruitSelection: QidahenCore['recruitSelection'];
    selectedRegionId: string;
}

interface QidahenSelectedActionFollowUpResult {
    actionLogText: string;
    khanEdictSelection: QidahenCore['khanEdictSelection'];
    lastSeasonSummary: QidahenSeasonSummary | null;
    maShiTradeSelection: QidahenCore['maShiTradeSelection'];
    pendingTargetAction: QidahenPendingTargetAction | null;
    recruitSelection: QidahenCore['recruitSelection'];
    selectedRegionId: string;
    turnPhase: QidahenCore['turnPhase'];
    wheelDispatchProgress: QidahenCore['wheelDispatchProgress'];
}

interface QidahenSelectedActionFollowUpStateTransition {
    lastSeasonSummary: QidahenSeasonSummary | null;
    pendingTargetAction: QidahenPendingTargetAction | null;
    selectedRegionId: string;
    turnPhase: QidahenCore['turnPhase'];
    wheelDispatchProgress: QidahenCore['wheelDispatchProgress'];
}

interface QidahenSelectedActionSelectionFollowUpResolutionResult {
    driveTigerDispatchSelection: QidahenCore['wheelDispatchProgress'];
    khanEdictSelection: QidahenCore['khanEdictSelection'];
    lastSeasonSummary: QidahenSeasonSummary | null;
    maShiTradeSelection: QidahenCore['maShiTradeSelection'];
    recruitSelection: QidahenCore['recruitSelection'];
    selectedRegionId: string;
}

interface QidahenSelectedActionPendingFollowUpResolutionResult {
    pendingTargetAction: QidahenPendingTargetAction | null;
    selectedRegionId: string;
}

const buildQidahenSelectedActionFollowUpLogText = (
    state: QidahenCore,
    currentFactionName: string,
    actionLabel: string,
    spentCardCount: number,
    resolution: QidahenSelectedActionFollowUpResolutionResult,
): string => {
    if (resolution.recruitSelection) {
        return `${currentFactionName} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入征召军队建军选择。`;
    }
    if (resolution.maShiTradeSelection) {
        return `${currentFactionName} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入马市贸易建兵数量选择。`;
    }
    if (resolution.khanEdictSelection) {
        return `${currentFactionName} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入令箭效果选择。`;
    }
    if (resolution.driveTigerDispatchSelection) {
        return `${currentFactionName} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，等待 ${state.factions[resolution.driveTigerDispatchSelection.attackerFactionId].name} 决定是否同意受大明指挥。`;
    }
    if (resolution.pendingTargetAction) {
        return `${currentFactionName} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入 ${resolution.pendingTargetAction.title}（${resolution.pendingTargetAction.resolutionHint}）。`;
    }
    if (resolution.lastSeasonSummary?.lines[0]) {
        return `${currentFactionName} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌。${resolution.lastSeasonSummary.lines[0]}`;
    }
    return `${currentFactionName} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌。`;
};

const buildQidahenSelectedActionFollowUpStateTransition = (
    resolution: QidahenSelectedActionFollowUpResolutionResult,
): QidahenSelectedActionFollowUpStateTransition => ({
    lastSeasonSummary: resolution.lastSeasonSummary,
    pendingTargetAction: resolution.pendingTargetAction,
    selectedRegionId: resolution.selectedRegionId,
    turnPhase: resolution.khanEdictSelection
        ? 'khan-edict-choice'
        : resolution.recruitSelection
            ? 'recruit-choice'
            : resolution.maShiTradeSelection
                ? 'ma-shi-trade-choice'
                : resolution.driveTigerDispatchSelection
                    ? 'drive-tiger-consent'
                    : resolution.pendingTargetAction
                        ? 'resolve-pending'
                        : 'action-window',
    wheelDispatchProgress: resolution.driveTigerDispatchSelection,
});

const resolveQidahenSelectedActionSelectionFollowUpResolution = (
    state: QidahenCore,
    currentFactionId: QidahenFactionId,
    actionId: string,
    timestamp: number,
    baseSelectedRegionId: string,
    baseLastSeasonSummary: QidahenSeasonSummary | null,
    dependencies: QidahenSelectedActionFollowUpDependencies,
): QidahenSelectedActionSelectionFollowUpResolutionResult => {
    const baseRegionSemantics = getQidahenExplicitRegionSelectionSemantics(state, baseSelectedRegionId);
    const recruitSelection = actionId === 'recruit'
        ? buildRecruitSelectionFromRegionSemantics(state, baseRegionSemantics, currentFactionId)
        : null;
    const maShiTradeSelection = actionId === 'ma-shi-trade'
        ? buildMaShiTradeSelectionFromRegionSemantics(state, baseRegionSemantics)
        : null;
    const khanEdictSelection = actionId === 'khan-edict'
        ? buildKhanEdictSelectionFromRegionSemantics(state, currentFactionId, baseRegionSemantics)
        : null;
    const driveTigerDispatchSelection = actionId === 'drive-tiger'
        ? buildDriveTigerDispatchSelectionFromRegionSemantics(state, currentFactionId, baseRegionSemantics)
        : null;

    let nextLastSeasonSummary = baseLastSeasonSummary;

    if (actionId === 'recruit' && !recruitSelection) {
        nextLastSeasonSummary = dependencies.buildSeasonSummary('征召军队', timestamp, [
            '当前没有可执行征召军队的己方控制区域。',
        ]);
    }
    if (actionId === 'ma-shi-trade' && !maShiTradeSelection) {
        nextLastSeasonSummary = dependencies.buildSeasonSummary('马市贸易', timestamp, [
            '当前没有可执行马市贸易的大明控制区域。',
        ]);
    }

    return {
        driveTigerDispatchSelection,
        khanEdictSelection,
        lastSeasonSummary: nextLastSeasonSummary,
        maShiTradeSelection,
        recruitSelection,
        selectedRegionId: baseSelectedRegionId,
    };
};

const resolveQidahenSelectedActionPendingFollowUpResolution = (
    state: QidahenCore,
    currentFactionId: QidahenFactionId,
    actionId: string,
    baseSelectedRegionId: string,
): QidahenSelectedActionPendingFollowUpResolutionResult => {
    const selectedRegion = state.regions.find((region) => region.id === baseSelectedRegionId);
    const pendingTargetAction = (actionId === 'raid' || actionId === 'marriage-subjugation')
        ? buildPendingTargetAction(
            state,
            currentFactionId,
            actionId,
            selectedRegion,
            baseSelectedRegionId,
        )
        : null;

    return {
        pendingTargetAction,
        selectedRegionId: baseSelectedRegionId,
    };
};

export const resolveQidahenSelectedActionFollowUp = (
    state: QidahenCore,
    currentFactionId: QidahenFactionId,
    actionId: string,
    actionLabel: string,
    spentCardCount: number,
    timestamp: number,
    baseSelectedRegionId: string,
    baseLastSeasonSummary: QidahenSeasonSummary | null,
    dependencies: QidahenSelectedActionFollowUpDependencies,
): QidahenSelectedActionFollowUpResult => {
    const selectionResolution = resolveQidahenSelectedActionSelectionFollowUpResolution(
        state,
        currentFactionId,
        actionId,
        timestamp,
        baseSelectedRegionId,
        baseLastSeasonSummary,
        dependencies,
    );
    const pendingResolution = resolveQidahenSelectedActionPendingFollowUpResolution(
        state,
        currentFactionId,
        actionId,
        selectionResolution.selectedRegionId,
    );
    const resolution: QidahenSelectedActionFollowUpResolutionResult = {
        driveTigerDispatchSelection: selectionResolution.driveTigerDispatchSelection,
        khanEdictSelection: selectionResolution.khanEdictSelection,
        lastSeasonSummary: selectionResolution.lastSeasonSummary,
        maShiTradeSelection: selectionResolution.maShiTradeSelection,
        pendingTargetAction: pendingResolution.pendingTargetAction,
        recruitSelection: selectionResolution.recruitSelection,
        selectedRegionId: pendingResolution.selectedRegionId,
    };
    const actionLogText = buildQidahenSelectedActionFollowUpLogText(
        state,
        state.factions[currentFactionId].name,
        actionLabel,
        spentCardCount,
        resolution,
    );
    const stateTransition = buildQidahenSelectedActionFollowUpStateTransition(resolution);

    return {
        actionLogText,
        khanEdictSelection: selectionResolution.khanEdictSelection,
        lastSeasonSummary: stateTransition.lastSeasonSummary,
        maShiTradeSelection: selectionResolution.maShiTradeSelection,
        pendingTargetAction: stateTransition.pendingTargetAction,
        recruitSelection: selectionResolution.recruitSelection,
        selectedRegionId: stateTransition.selectedRegionId,
        turnPhase: stateTransition.turnPhase,
        wheelDispatchProgress: stateTransition.wheelDispatchProgress,
    };
};
