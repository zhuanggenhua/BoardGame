import { buildSeasonSummary } from './seasonSummaryBuilder';
import { buildQidahenRegionFocusState } from './regionFocusSemantics';
import type { QidahenPostBattleDecisionResolution } from './postBattleDecisionResolution';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenPostBattleSelection,
    QidahenSeasonSummary,
} from './types';

type QidahenPendingActionResolution = Pick<
    QidahenCore,
    'regions' | 'factions' | 'drawPileCount' | 'discardPileCount' | 'handCards'
> & {
    logText: string;
    selectedRegionId: string;
    postBattleSelection: QidahenPostBattleSelection | null;
    pendingTargetAction: QidahenPendingTargetAction | null;
};

interface QidahenPendingBattleStateTransitionDependencies {
    getFactionIdByPlayerId: (
        state: QidahenCore,
        playerId: string,
    ) => QidahenFactionId;
    getCurrentFactionId: (
        state: QidahenCore,
    ) => QidahenFactionId;
    applyVictoryStatus: (
        state: QidahenCore,
    ) => QidahenCore;
    syncFactionActionWindow: (
        state: QidahenCore,
        factionId: QidahenFactionId,
    ) => QidahenCore;
    advanceTurnIfReady: (
        state: QidahenCore,
        timestamp: number,
    ) => QidahenCore;
}

const buildPendingActionResolutionSummary = (
    pendingTargetAction: QidahenPendingTargetAction,
    resolution: Pick<QidahenPendingActionResolution, 'regions' | 'logText' | 'postBattleSelection'>,
    timestamp: number,
): QidahenSeasonSummary => {
    const targetRegion = resolution.regions.find((region) => (
        !region.isLogicalRegion && region.id === pendingTargetAction.targetRuntimeRegionId
    ));
    const title = pendingTargetAction.actionId === 'marriage-subjugation'
        ? '联姻诱降'
        : pendingTargetAction.actionId === 'drive-tiger'
            ? '驱虎吞狼'
            : pendingTargetAction.actionId === 'wheel-dispatch'
                ? '调度进攻'
                : '突袭作战';
    const lines = [resolution.logText];
    if (targetRegion?.note) {
        lines.push(targetRegion.note);
    }
    if (resolution.postBattleSelection?.summary) {
        lines.push(resolution.postBattleSelection.summary);
    }
    return buildSeasonSummary(title, timestamp, lines);
};

const buildPostBattleDecisionSummary = (
    selection: QidahenPostBattleSelection,
    resolution: Pick<QidahenPostBattleDecisionResolution, 'regions' | 'logText'>,
    timestamp: number,
): QidahenSeasonSummary => {
    const targetRegion = resolution.regions.find((region) => (
        !region.isLogicalRegion && region.id === selection.targetRuntimeRegionId
    ));
    const lines = [resolution.logText];
    if (targetRegion?.note) {
        lines.push(targetRegion.note);
    }
    return buildSeasonSummary(selection.title, timestamp, lines);
};

export const applyPendingActionResolutionToBattleFlowState = (
    state: QidahenCore,
    playerId: string,
    pendingTargetAction: QidahenPendingTargetAction,
    resolution: QidahenPendingActionResolution,
    timestamp: number,
    dependencies: QidahenPendingBattleStateTransitionDependencies,
): QidahenCore => {
    const currentFactionId = dependencies.getFactionIdByPlayerId(state, playerId);
    const lastSeasonSummary = buildPendingActionResolutionSummary(
        pendingTargetAction,
        resolution,
        timestamp,
    );
    const resolvedSelectedRegionId = resolution.selectedRegionId
        ?? resolution.pendingTargetAction?.targetRuntimeRegionId
        ?? resolution.postBattleSelection?.targetRuntimeRegionId
        ?? pendingTargetAction.targetRuntimeRegionId;
    const resolvedExplicitRegionId = state.explicitRegionId ?? resolvedSelectedRegionId;
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: resolvedSelectedRegionId,
        explicitRegionId: resolvedExplicitRegionId,
        regionFocusState: buildQidahenRegionFocusState(resolvedSelectedRegionId, {
            currentTargetRegionId: resolvedSelectedRegionId,
            displayAnchorRegionId: resolvedExplicitRegionId,
        }),
        turnPhase: resolution.pendingTargetAction
            ? 'resolve-pending'
            : resolution.postBattleSelection
                ? 'post-battle-decision'
                : 'action-window',
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        wheelDispatchProgress: null,
        pendingTargetAction: resolution.pendingTargetAction,
        postBattleSelection: resolution.postBattleSelection,
        regions: resolution.regions,
        factions: resolution.factions,
        drawPileCount: resolution.drawPileCount,
        discardPileCount: resolution.discardPileCount,
        handCards: resolution.handCards,
        lastSeasonSummary,
        actionLog: [
            {
                id: `log-${timestamp}`,
                faction: currentFactionId,
                text: resolution.logText,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(
        dependencies.syncFactionActionWindow(
            resolvedState,
            currentFactionId,
        ),
        timestamp,
    );
};

export const applyPostBattleDecisionResolutionToBattleFlowState = (
    state: QidahenCore,
    selection: QidahenPostBattleSelection,
    resolution: QidahenPostBattleDecisionResolution,
    timestamp: number,
    dependencies: QidahenPendingBattleStateTransitionDependencies,
): QidahenCore => {
    const currentFactionId = dependencies.getCurrentFactionId(state);
    const lastSeasonSummary = buildPostBattleDecisionSummary(
        selection,
        resolution,
        timestamp,
    );
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: resolution.selectedRegionId,
        explicitRegionId: state.explicitRegionId ?? resolution.selectedRegionId,
        regionFocusState: buildQidahenRegionFocusState(resolution.selectedRegionId, {
            currentTargetRegionId: resolution.selectedRegionId,
            displayAnchorRegionId: state.explicitRegionId ?? resolution.selectedRegionId,
        }),
        turnPhase: 'action-window',
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        postBattleSelection: null,
        regions: resolution.regions,
        factions: resolution.factions,
        koreaDeckCount: resolution.koreaDeckCount,
        drawPileCount: resolution.drawPileCount,
        discardPileCount: resolution.discardPileCount,
        handCards: resolution.handCards,
        lastSeasonSummary,
        actionLog: [
            {
                id: `log-post-battle-${timestamp}`,
                faction: currentFactionId,
                text: resolution.logText,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(
        dependencies.syncFactionActionWindow(
            resolvedState,
            currentFactionId,
        ),
        timestamp,
    );
};
