import { buildPaymentState, syncFactionActionWindow } from './factionActionWindow';
import { getCurrentFactionId } from './factionTurnAccessors';
import { resolveQidahenGrantPardonExecution } from './grantPardonExecution';
import {
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenInteractionSelectionStateForCore,
} from './interactionSelectionAccessors';
import { materializeNonSiegedCityActionSourceRegion } from './actionSourceRegionState';
import { getActionRuleDisplayRegionName, getEffectiveHomelandController } from './regionRuleSemantics';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import {
    addFactionHandCards,
    buildDrawnHandCards,
    drawFromFactionPile,
    getFactionDrawPileCount,
} from './handCardState';
import { toFactionLabel } from './factionLabelSemantics';
import {
    buildDiplomacySelectionFromRegionSemantics,
    buildQidahenDiplomacyProgress,
    getQidahenCurrentDiplomacySelectionForCore,
    getQidahenGrantPardonSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './selectionBuilders';
import {
    buildQidahenRegionFocusState,
    getQidahenExplicitRegionSelectionSemantics,
    getQidahenLockedRegionSelectionSemantics,
} from './regionFocusSemantics';
import { updateQidahenTurnLabel } from './turnLabelState';
import {
    addSpecialTroopStackToRegion,
    cloneRuntimeRegionAsPieceSnapshot,
    removeMercenarySpecialTroops,
} from './troopCompat';
import { buildArtilleryTroopStack, buildRegularTroopStack } from './troopStacks';
import { advanceQidahenTurnIfReady } from './turnAdvance';
import { getQidahenWheelImmediateEffectConfig } from './wheelRules';
import { applyQidahenVictoryStatus } from './victoryResolution';
import type {
    QidahenCore,
    QidahenDiplomacyChoice,
    QidahenDiplomacyResolvedStep,
    QidahenDiplomacySelection,
    QidahenDriveTigerConsentSelection,
    QidahenFactionId,
    QidahenGrantPardonChoice,
    QidahenGrantPardonSelection,
    QidahenKhanEdictChoice,
    QidahenKhanEdictSelection,
    QidahenMaShiTradeSelection,
    QidahenRecruitChoice,
    QidahenRecruitSelection,
    QidahenSeasonSummary,
} from './types';

interface QidahenActionWindowChoiceDependencies {
    applyVictoryStatus: (
        state: QidahenCore,
        options?: {
            allowHegemony?: boolean;
        },
    ) => QidahenCore;
    advanceTurnIfReady: (
        state: QidahenCore,
        timestamp: number,
    ) => QidahenCore;
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
    getFactionDrawPileCount: (
        state: QidahenCore,
        factionId: QidahenFactionId,
    ) => number;
    drawFromFactionPile: (
        factions: QidahenCore['factions'],
        sourceFactionId: QidahenFactionId,
        requestedCards: number,
        discardGain?: number,
    ) => {
        factions: QidahenCore['factions'];
        drawnCards: number;
    };
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
    materializeNonSiegedCityActionSourceRegion: (
        region: QidahenCore['regions'][number],
    ) => QidahenCore['regions'][number];
    refreshRuntimeRegionRules: (
        regions: QidahenCore['regions'],
        fortifications: QidahenCore['fortifications'],
    ) => QidahenCore['regions'];
    getEffectiveHomelandController: (
        state: QidahenCore,
        regionId: string,
    ) => QidahenFactionId | 'neutral';
    toFactionLabel: (
        controller: QidahenFactionId | 'neutral',
    ) => string;
    getActionRuleDisplayRegionName: (
        region: QidahenCore['regions'][number],
        fallbackName: string,
    ) => string;
    resolveGrantPardonExecution: (
        state: QidahenCore,
        factions: QidahenCore['factions'],
        timestamp: number,
        choice?: QidahenGrantPardonChoice | null,
        executorFactionId?: QidahenFactionId,
    ) => {
        factions: QidahenCore['factions'];
        lastSeasonSummary: QidahenSeasonSummary | null;
        regions: QidahenCore['regions'];
        selectedRegionId: string;
    };
}

export const resolveQidahenRecruitInteractionChoice = (
    state: QidahenCore,
    choiceId: QidahenRecruitChoice['id'],
    timestamp: number,
    interactionSelection?: QidahenRecruitSelection | null,
    dependencies: QidahenActionWindowChoiceDependencies = {
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        updateTurnLabel: updateQidahenTurnLabel,
        buildSeasonSummary,
        getFactionDrawPileCount,
        drawFromFactionPile,
        addFactionHandCards,
        buildDrawnHandCards,
        materializeNonSiegedCityActionSourceRegion,
        refreshRuntimeRegionRules,
        getEffectiveHomelandController,
        toFactionLabel,
        getActionRuleDisplayRegionName,
        resolveGrantPardonExecution: resolveQidahenGrantPardonExecution,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenRecruitSelectionForCore,
    );
    if (!selection?.targetRegionId) {
        return state;
    }
    const currentFactionId = getCurrentFactionId(state);
    const choice = selection.choices.find((item) => item.id === choiceId);
    if (!choice) {
        return state;
    }
    const isChuanbing = choice.id === 'level-4-chuanbing';
    const isArtillery = choice.id === 'level-1-artillery';
    const grantedTroops = choice.troopDelta;
    const nextRuntimeRegions = state.regions
        .filter((region) => !region.isLogicalRegion)
        .map((region) => {
            if (region.id !== selection.targetRegionId) {
                return region;
            }
            const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            const nextRegion = {
                ...actionTargetRegion,
                troops: actionTargetRegion.troops + grantedTroops,
                note: isArtillery
                    ? `${actionTargetRegion.name} 执行征召军队后加入炮兵 x1（1级）；炮兵不能承受战斗损伤，也不计入胜负。`
                    : isChuanbing
                    ? `${actionTargetRegion.name} 执行征召军队后加入川兵 x2（4级），战斗会按结构化部队等级估算损伤。`
                    : `${actionTargetRegion.name} 执行征召军队后加入 ${grantedTroops} 个等级 2 大明步兵，战斗会按结构化部队等级估算损伤。`,
            };
            return isArtillery
                ? addSpecialTroopStackToRegion(nextRegion, buildArtilleryTroopStack('ming', 'recruit', grantedTroops, 1))
                : isChuanbing
                ? addSpecialTroopStackToRegion(nextRegion, {
                    id: 'ming-chuanbing-lv4',
                    label: '川兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 4,
                })
                : addSpecialTroopStackToRegion(nextRegion, buildRegularTroopStack('ming', 'recruit', grantedTroops));
        });
    const nextRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const chuanbingLine = '川兵 x2（4级），战斗会按结构化部队等级估算损伤。';
    const artilleryLine = '炮兵 x1（1级）；火炮技术允许建立炮兵，炮兵不能承受战斗损伤，也不计入胜负。';
    const summaryLines = isArtillery
        ? [
            `${state.factions[currentFactionId].name} 在 ${selection.targetRegionName ?? '当前区域'} 征召军队，建立 1 个等级 1 炮兵。`,
            artilleryLine,
        ]
        : isChuanbing
        ? [
            `${state.factions[currentFactionId].name} 在 ${selection.targetRegionName ?? '当前区域'} 征召军队，建立 2 个等级 4 川兵部队。`,
            chuanbingLine,
        ]
        : [
            `${state.factions[currentFactionId].name} 在 ${selection.targetRegionName ?? '当前区域'} 征召军队，建立 6 个等级 2 部队。`,
        ];
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: selection.targetRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(selection.targetRegionId),
        turnPhase: 'action-window',
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        regions: nextRegions,
        factions: {
            ...state.factions,
            [currentFactionId]: {
                ...state.factions[currentFactionId],
                troops: state.factions[currentFactionId].troops + grantedTroops,
            },
        },
        lastSeasonSummary: dependencies.buildSeasonSummary('征召军队', timestamp, summaryLines),
        actionLog: [
            {
                id: `log-recruit-${timestamp}`,
                faction: currentFactionId,
                text: isChuanbing
                    ? `${state.factions[currentFactionId].name} 完成征召军队，${selection.targetRegionName ?? '目标区域'} 已记录 ${chuanbingLine}`
                    : isArtillery
                    ? `${state.factions[currentFactionId].name} 完成征召军队，${selection.targetRegionName ?? '目标区域'} 已记录 ${artilleryLine}`
                    : `${state.factions[currentFactionId].name} 完成征召军队，${selection.targetRegionName ?? '目标区域'} 建立 6 个等级 2 部队。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), timestamp);
};

export const resolveQidahenGrantPardonInteractionChoice = (
    state: QidahenCore,
    choiceId: QidahenGrantPardonChoice['id'],
    timestamp: number,
    interactionSelection?: QidahenGrantPardonSelection | null,
    dependencies: QidahenActionWindowChoiceDependencies = {
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        updateTurnLabel: updateQidahenTurnLabel,
        buildSeasonSummary,
        getFactionDrawPileCount,
        drawFromFactionPile,
        addFactionHandCards,
        buildDrawnHandCards,
        materializeNonSiegedCityActionSourceRegion,
        refreshRuntimeRegionRules,
        getEffectiveHomelandController,
        toFactionLabel,
        getActionRuleDisplayRegionName,
        resolveGrantPardonExecution: resolveQidahenGrantPardonExecution,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenGrantPardonSelectionForCore,
    );
    const choice = selection?.choices.find((item) => item.id === choiceId) ?? null;
    if (!selection || !choice) {
        return state;
    }
    const executorFactionId = selection.executorFactionId ?? 'ming';
    if (selection.executionSource === 'tribute-edict') {
        const resolution = dependencies.resolveGrantPardonExecution(
            state,
            state.factions,
            timestamp,
            choice,
            executorFactionId,
        );
        return dependencies.advanceTurnIfReady(dependencies.updateTurnLabel({
            ...state,
            selectedRegionId: resolution.selectedRegionId,
            explicitRegionId: null,
            regionFocusState: buildQidahenRegionFocusState(resolution.selectedRegionId),
            selectedActionId: 'grant-pardon',
            confirmedActionId: 'grant-pardon',
            selectedPaymentCardIds: [],
            payment: buildPaymentState('grant-pardon', 0, 0),
            turnPhase: 'action-window',
            grantPardonSelection: null,
            recruitSelection: null,
            maShiTradeSelection: null,
            khanEdictSelection: null,
            diplomacyProgress: null,
            factions: resolution.factions,
            regions: resolution.regions,
            lastSeasonSummary: dependencies.buildSeasonSummary('封贡敕书', timestamp, [
                `${state.factions[executorFactionId].name}选择执行赐印招安。`,
                ...(resolution.lastSeasonSummary?.lines.map((line) => `赐印招安：${line}`) ?? [
                    '赐印招安：当前没有可招安的相邻敌军。',
                ]),
            ]),
        }), timestamp);
    }
    const resolution = dependencies.resolveGrantPardonExecution(
        state,
        state.factions,
        timestamp,
        choice,
        executorFactionId,
    );
    return dependencies.advanceTurnIfReady(dependencies.updateTurnLabel({
        ...state,
        selectedRegionId: resolution.selectedRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(resolution.selectedRegionId),
        selectedActionId: 'grant-pardon',
        confirmedActionId: 'grant-pardon',
        selectedPaymentCardIds: [],
        turnPhase: 'action-window',
        grantPardonSelection: null,
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        factions: resolution.factions,
        regions: resolution.regions,
        lastSeasonSummary: resolution.lastSeasonSummary ?? dependencies.buildSeasonSummary('赐印招安', timestamp, [
            '当前没有可招安的相邻敌军。',
        ]),
    }), timestamp);
};

export const resolveQidahenDriveTigerConsentInteractionChoice = (
    state: QidahenCore,
    choiceId: 'accept' | 'decline',
    timestamp: number,
    interactionSelection?: QidahenDriveTigerConsentSelection | null,
    dependencies: QidahenActionWindowChoiceDependencies = {
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        updateTurnLabel: updateQidahenTurnLabel,
        buildSeasonSummary,
        getFactionDrawPileCount,
        drawFromFactionPile,
        addFactionHandCards,
        buildDrawnHandCards,
        materializeNonSiegedCityActionSourceRegion,
        refreshRuntimeRegionRules,
        getEffectiveHomelandController,
        toFactionLabel,
        getActionRuleDisplayRegionName,
        resolveGrantPardonExecution: resolveQidahenGrantPardonExecution,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenDriveTigerConsentSelectionForCore,
    );
    if (!selection) {
        return state;
    }
    const responderFactionId = selection.targetFactionId;
    if (choiceId === 'decline') {
        const declinedState = dependencies.applyVictoryStatus({
            ...state,
            turnPhase: 'action-window',
            diplomacyProgress: null,
            wheelDispatchProgress: null,
            lastSeasonSummary: dependencies.buildSeasonSummary('驱虎吞狼', timestamp, [
                `${state.factions[selection.targetFactionId].name} 拒绝接受${state.factions[selection.commanderFactionId].name}指挥，本次驱虎吞狼不生效。`,
            ]),
            actionLog: [
                {
                    id: `log-drive-tiger-consent-${timestamp}`,
                    faction: responderFactionId,
                    text: `${state.factions[selection.targetFactionId].name} 拒绝接受 ${state.factions[selection.commanderFactionId].name} 指挥，驱虎吞狼未执行。`,
                },
                ...state.actionLog,
            ].slice(0, 6),
        });
        return dependencies.advanceTurnIfReady(syncFactionActionWindow(declinedState, responderFactionId), timestamp);
    }

    const acceptedSelection = selection.dispatchSelection;
    const drawCards = Math.max(0, Math.min(dependencies.getFactionDrawPileCount(state, acceptedSelection.attackerFactionId), 6));
    const drawResult = dependencies.drawFromFactionPile(state.factions, acceptedSelection.attackerFactionId, drawCards);
    const nextFactions = dependencies.addFactionHandCards(drawResult.factions, acceptedSelection.attackerFactionId, drawResult.drawnCards);
        const acceptedState = dependencies.applyVictoryStatus({
            ...state,
            selectedRegionId: acceptedSelection.sourceRegionId,
            explicitRegionId: null,
            regionFocusState: buildQidahenRegionFocusState(acceptedSelection.sourceRegionId, {
                lockedSourceRegionId: acceptedSelection.sourceRegionId,
                displayAnchorRegionId: acceptedSelection.displayAnchorRegionId ?? acceptedSelection.sourceRegionId,
            }),
            selectedActionId: 'drive-tiger',
            confirmedActionId: 'drive-tiger',
            turnPhase: 'dispatch-targeting',
        diplomacyProgress: null,
        wheelDispatchProgress: null,
        drawPileCount: acceptedSelection.attackerFactionId === 'ming' ? state.drawPileCount - drawResult.drawnCards : state.drawPileCount,
        handCards: dependencies.buildDrawnHandCards(state, acceptedSelection.attackerFactionId, drawResult.drawnCards),
        factions: nextFactions,
        lastSeasonSummary: dependencies.buildSeasonSummary('驱虎吞狼', timestamp, [
            `${state.factions[selection.targetFactionId].name} 同意接受${state.factions[selection.commanderFactionId].name}指挥，并获得 ${drawResult.drawnCards} 张手牌。`,
            `进入调度目标选择，由${state.factions[selection.commanderFactionId].name}指挥其执行进攻。`,
        ]),
        actionLog: [
            {
                id: `log-drive-tiger-consent-${timestamp}`,
                faction: responderFactionId,
                text: `${state.factions[selection.targetFactionId].name} 同意接受 ${state.factions[selection.commanderFactionId].name} 指挥，获得 ${drawResult.drawnCards} 张手牌，进入指挥调度目标选择。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(syncFactionActionWindow(acceptedState, responderFactionId), timestamp);
};

export const resolveQidahenMaShiTradeInteractionChoice = (
    state: QidahenCore,
    troopCount: 1 | 2 | 3,
    timestamp: number,
    interactionSelection?: QidahenMaShiTradeSelection | null,
    dependencies: QidahenActionWindowChoiceDependencies = {
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        updateTurnLabel: updateQidahenTurnLabel,
        buildSeasonSummary,
        getFactionDrawPileCount,
        drawFromFactionPile,
        addFactionHandCards,
        buildDrawnHandCards,
        materializeNonSiegedCityActionSourceRegion,
        refreshRuntimeRegionRules,
        getEffectiveHomelandController,
        toFactionLabel,
        getActionRuleDisplayRegionName,
        resolveGrantPardonExecution: resolveQidahenGrantPardonExecution,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenMaShiTradeSelectionForCore,
    );
    if (!selection?.targetRegionId) {
        return state;
    }
    const currentFactionId = getCurrentFactionId(state);
    const drawCards = Math.max(0, Math.min(dependencies.getFactionDrawPileCount(state, currentFactionId), troopCount * 2));
    const drawResult = dependencies.drawFromFactionPile(state.factions, currentFactionId, drawCards);
    const nextRuntimeRegions = state.regions
        .filter((region) => !region.isLogicalRegion)
        .map((region) => {
            if (region.id !== selection.targetRegionId) {
                return region;
            }
            const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStackToRegion({
                ...actionTargetRegion,
                troops: actionTargetRegion.troops + troopCount,
                note: `${actionTargetRegion.name} 因马市贸易获得 ${troopCount} 个等级 2 大明步兵。`,
            }, buildRegularTroopStack('ming', 'ma-shi-trade', troopCount));
        });
    const nextRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: selection.targetRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(selection.targetRegionId),
        turnPhase: 'action-window',
        recruitSelection: null,
        maShiTradeSelection: null,
        diplomacyProgress: null,
        regions: nextRegions,
        drawPileCount: currentFactionId === 'ming' ? state.drawPileCount - drawResult.drawnCards : state.drawPileCount,
        handCards: dependencies.buildDrawnHandCards(state, currentFactionId, drawResult.drawnCards),
        factions: {
            ...drawResult.factions,
            ming: {
                ...drawResult.factions.ming,
                troops: state.factions.ming.troops + troopCount,
            },
            mongol: {
                ...drawResult.factions.mongol,
                handCount: state.factions.mongol.handCount + drawResult.drawnCards,
            },
        },
        lastSeasonSummary: dependencies.buildSeasonSummary('马市贸易', timestamp, [
            `蒙古在 ${selection.targetRegionName ?? '目标区域'} 发动马市贸易，大明选择建立 ${troopCount} 个部队。`,
            drawResult.drawnCards > 0
                ? `蒙古因马市贸易获得 ${drawResult.drawnCards} 张手牌。`
                : '当前牌堆不足，蒙古未额外获得手牌。',
        ]),
        actionLog: [
            {
                id: `log-ma-shi-trade-${timestamp}`,
                faction: currentFactionId,
                text: `${state.factions[currentFactionId].name} 完成马市贸易，${selection.targetRegionName ?? '目标区域'} 部队 +${troopCount}，蒙古抽 ${drawResult.drawnCards} 张牌。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), timestamp);
};

export const resolveQidahenKhanEdictInteractionChoice = (
    state: QidahenCore,
    choiceId: QidahenKhanEdictChoice['id'],
    timestamp: number,
    interactionSelection?: QidahenKhanEdictSelection | null,
    dependencies: QidahenActionWindowChoiceDependencies = {
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        updateTurnLabel: updateQidahenTurnLabel,
        buildSeasonSummary,
        getFactionDrawPileCount,
        drawFromFactionPile,
        addFactionHandCards,
        buildDrawnHandCards,
        materializeNonSiegedCityActionSourceRegion,
        refreshRuntimeRegionRules,
        getEffectiveHomelandController,
        toFactionLabel,
        getActionRuleDisplayRegionName,
        resolveGrantPardonExecution: resolveQidahenGrantPardonExecution,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenKhanEdictSelectionForCore,
    );
    if (!selection) {
        return state;
    }
    const currentFactionId = getCurrentFactionId(state);
    if (choiceId === 'hire-dispatch') {
        const diplomacySelection = buildDiplomacySelectionFromRegionSemantics(
            state,
            currentFactionId,
            selection.hireTargetRegionId
                ? getQidahenExplicitRegionSelectionSemantics(state, selection.hireTargetRegionId)
                : getQidahenLockedRegionSelectionSemantics(state),
            'khan-edict',
            selection.hireTargetRegionId,
            selection.preferredSourceRegionId,
        );
        if (!diplomacySelection) {
            return dependencies.updateTurnLabel({
                ...state,
                recruitSelection: null,
                maShiTradeSelection: null,
                khanEdictSelection: null,
                diplomacyProgress: null,
                lastSeasonSummary: dependencies.buildSeasonSummary('大汗令箭', timestamp, [
                    '当前没有可执行外交雇佣的蒙古控制区域。',
                ]),
            });
        }

        return dependencies.updateTurnLabel({
            ...state,
            selectedRegionId: state.selectedRegionId,
            explicitRegionId: null,
            regionFocusState: buildQidahenRegionFocusState(
                state.selectedRegionId,
                {
                    lockedSourceRegionId: diplomacySelection.sourceRegionId,
                    displayAnchorRegionId: diplomacySelection.displayAnchorRegionId
                        ?? diplomacySelection.sourceRegionId
                        ?? selection.displayAnchorRegionId,
                },
            ),
            turnPhase: 'diplomacy-choice',
            recruitSelection: null,
            maShiTradeSelection: null,
            khanEdictSelection: null,
            diplomacyProgress: null,
            actionLog: [
                {
                    id: `log-khan-edict-${timestamp}`,
                    faction: currentFactionId,
                    text: `${state.factions[currentFactionId].name} 选择大汗令箭的外交雇佣，进入外交目标选择。`,
                },
                ...state.actionLog,
            ].slice(0, 6),
        });
    }

    const recruitTargetRegionId = selection.recruitTargetRegionId;
    if (!recruitTargetRegionId) {
        return dependencies.updateTurnLabel({
            ...state,
            recruitSelection: null,
            maShiTradeSelection: null,
            khanEdictSelection: null,
            diplomacyProgress: null,
            lastSeasonSummary: dependencies.buildSeasonSummary('大汗令箭', timestamp, [
                '当前没有可执行征兵训练的蒙古控制区域。',
            ]),
        });
    }
    const recruitConfig = getQidahenWheelImmediateEffectConfig('wheel-recruit-train');
    const troopDelta = recruitConfig?.troopDelta ?? 2;
    const nextRuntimeRegions = state.regions
        .filter((region) => !region.isLogicalRegion)
        .map((region) => {
            if (region.id !== recruitTargetRegionId) {
                return region;
            }
            const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStackToRegion({
                ...actionTargetRegion,
                troops: actionTargetRegion.troops + troopDelta,
                note: `${actionTargetRegion.name} 经大汗令箭执行征兵训练后建立 ${troopDelta} 个等级 2 蒙古骑兵。`,
            }, buildRegularTroopStack('mongol', 'khan-edict-recruit-train', troopDelta));
        });
    const nextRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: recruitTargetRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(recruitTargetRegionId),
        turnPhase: 'action-window',
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        regions: nextRegions,
        factions: {
            ...state.factions,
            mongol: {
                ...state.factions.mongol,
                troops: state.factions.mongol.troops + troopDelta,
            },
        },
        lastSeasonSummary: dependencies.buildSeasonSummary('大汗令箭', timestamp, [
            `${state.factions[currentFactionId].name} 选择征兵训练，${selection.recruitTargetRegionName ?? '当前控制区'} 建立 ${troopDelta} 个等级 2 蒙古骑兵。`,
        ]),
        actionLog: [
            {
                id: `log-khan-edict-${timestamp}`,
                faction: currentFactionId,
                text: `${state.factions[currentFactionId].name} 选择大汗令箭的征兵训练，${selection.recruitTargetRegionName ?? '当前控制区'} 建立 ${troopDelta} 个等级 2 蒙古骑兵。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), timestamp);
};

const resolveDiplomacyChoice = (
    state: QidahenCore,
    actingFactionId: QidahenFactionId,
    selection: QidahenDiplomacySelection,
    choiceId: QidahenDiplomacyChoice['id'],
    dependencies: QidahenActionWindowChoiceDependencies,
): Pick<QidahenCore, 'regions' | 'factions'> & {
    logText: string;
    summaryLines: string[] | null;
    selectedRegionId: string;
    diplomacySelection: QidahenDiplomacySelection | null;
} => {
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRegion = selection.targetRegionId
        ? runtimeRegions.find((region) => region.id === selection.targetRegionId) ?? null
        : null;
    const diplomacyFocusRegionId = selection.hireRegionId ?? selection.sourceRegionId ?? state.selectedRegionId;
    let selectedRegionId = diplomacyFocusRegionId;
    let nextFactions = {
        ...state.factions,
    };
    let nextRuntimeRegions = runtimeRegions.map(cloneRuntimeRegionAsPieceSnapshot);
    const resolvedSteps = selection.resolvedSteps.map((step) => ({ ...step }));

    const finalizeResolution = (
        finalizedRegions: typeof nextRuntimeRegions,
        finalizedFactions: typeof nextFactions,
        finalSelectedRegionId: string,
        finalResolvedSteps: QidahenDiplomacyResolvedStep[],
    ) => {
        const sourceName = selection.hireRegionName ?? selection.sourceRegionName ?? '当前控制区';
        const hiredRegions = finalizedRegions.map((region) => {
            if (region.id !== selection.hireRegionId) {
                return region;
            }
            const actionHireRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStackToRegion({
                ...actionHireRegion,
                troops: actionHireRegion.troops + 2,
                note: `${actionHireRegion.name} 经${selection.title}建立 2 个等级 2 雇佣军。`,
            }, {
                id: `${actingFactionId}-mercenary-lv2`,
                label: '雇佣军',
                faction: actingFactionId,
                troopKind: 'infantry',
                count: 2,
                level: 2,
            });
        });
        const nextRegions = dependencies.refreshRuntimeRegionRules(hiredRegions, state.fortifications);
        const summaryLines = [
            `${state.factions[actingFactionId].name} 在 ${sourceName} 建立 2 个等级 2 雇佣军。`,
            ...(finalResolvedSteps.length > 0
                ? finalResolvedSteps.map((step) => `外交 ${step.index}：${step.summary}`)
                : ['当前未对相邻区域执行外交标记。']),
        ];
        const nextFinalFactions = {
            ...finalizedFactions,
            [actingFactionId]: {
                ...finalizedFactions[actingFactionId],
                troops: finalizedFactions[actingFactionId].troops + 2,
            },
        };
        const finalLogTail = finalResolvedSteps.length > 0
            ? finalResolvedSteps.map((step) => `外交${step.index}${step.summary}`).join('；')
            : '未对相邻区域执行外交标记';
        return {
            selectedRegionId: finalSelectedRegionId,
            regions: nextRegions,
            factions: nextFinalFactions,
            summaryLines,
            diplomacySelection: null,
            logText: `${state.factions[actingFactionId].name} 完成${selection.title}：${finalLogTail}。`,
        };
    };

    if (choiceId === 'hire-only') {
        return finalizeResolution(nextRuntimeRegions, nextFactions, selectedRegionId, resolvedSteps);
    }

    if (!targetRegion) {
        return finalizeResolution(nextRuntimeRegions, nextFactions, selectedRegionId, resolvedSteps);
    }

    selectedRegionId = targetRegion.id;
    let stepSummary = '';
    let removedMercenaryTroops = 0;
    nextRuntimeRegions = nextRuntimeRegions.map((region) => {
        if (region.id !== targetRegion.id) {
            return region;
        }
        if (choiceId === 'place-friendly') {
            stepSummary = `${dependencies.getActionRuleDisplayRegionName(targetRegion, targetRegion.name)} 已放置 ${dependencies.toFactionLabel(actingFactionId)}友好标记，可供通行与驻守。`;
            return {
                ...region,
                diplomacyMarkerFaction: actingFactionId,
                diplomacyMarkerSide: 'friendly',
                note: `${dependencies.getActionRuleDisplayRegionName(region, region.name)} 经${selection.title}转为 ${dependencies.toFactionLabel(actingFactionId)}友好区域。`,
            };
        }
        if (choiceId === 'flip-vassal') {
            stepSummary = `${dependencies.getActionRuleDisplayRegionName(targetRegion, targetRegion.name)} 已翻为 ${dependencies.toFactionLabel(actingFactionId)}附庸，并视为控制区域。`;
            return {
                ...region,
                controller: actingFactionId,
                diplomacyMarkerFaction: actingFactionId,
                diplomacyMarkerSide: 'vassal',
                note: `${dependencies.getActionRuleDisplayRegionName(region, region.name)} 经${selection.title}转为 ${dependencies.toFactionLabel(actingFactionId)}附庸。`,
            };
        }

        const initialController = dependencies.getEffectiveHomelandController(state, region.id);
        const topLevelMercenaryRemoval = region.diplomacyMarkerSide === 'friendly'
            ? removeMercenarySpecialTroops(region.specialTroops)
            : { specialTroops: region.specialTroops, removedTroops: 0 };
        const cityStateMercenaryRemoval = region.diplomacyMarkerSide === 'friendly' && region.cityState
            ? removeMercenarySpecialTroops(region.cityState.specialTroops)
            : { specialTroops: region.cityState?.specialTroops ?? [], removedTroops: 0 };
        const topLevelRemovedMercenaryTroops = topLevelMercenaryRemoval.removedTroops;
        const cityStateRemovedMercenaryTroops = cityStateMercenaryRemoval.removedTroops;
        removedMercenaryTroops = topLevelRemovedMercenaryTroops + cityStateRemovedMercenaryTroops;
        if (removedMercenaryTroops > 0 && region.diplomacyMarkerFaction) {
            nextFactions = {
                ...nextFactions,
                [region.diplomacyMarkerFaction]: {
                    ...nextFactions[region.diplomacyMarkerFaction],
                    troops: Math.max(0, nextFactions[region.diplomacyMarkerFaction].troops - removedMercenaryTroops),
                },
            };
        }
        const clearedRegion = {
            ...region,
            controller: initialController,
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            troops: Math.max(0, region.troops - topLevelRemovedMercenaryTroops),
            specialTroops: topLevelMercenaryRemoval.specialTroops,
            cityState: region.cityState
                ? {
                    ...region.cityState,
                    troops: Math.max(0, region.cityState.troops - cityStateRemovedMercenaryTroops),
                    specialTroops: cityStateMercenaryRemoval.specialTroops,
                }
                : null,
            note: removedMercenaryTroops > 0
                ? `${dependencies.getActionRuleDisplayRegionName(region, region.name)} 的控制标记被移除，并连带移除了 ${removedMercenaryTroops} 个雇佣军。`
                : `${dependencies.getActionRuleDisplayRegionName(region, region.name)} 的控制标记已被移除。`,
        };
        stepSummary = initialController === 'neutral'
            ? `${dependencies.getActionRuleDisplayRegionName(targetRegion, targetRegion.name)} 的控制标记已移除，区域回到中立。${removedMercenaryTroops > 0 ? ` 并移除 ${removedMercenaryTroops} 个雇佣军。` : ''}`
            : `${dependencies.getActionRuleDisplayRegionName(targetRegion, targetRegion.name)} 的控制标记已移除，区域回归 ${dependencies.toFactionLabel(initialController)}本土。${removedMercenaryTroops > 0 ? ` 并移除 ${removedMercenaryTroops} 个雇佣军。` : ''}`;
        return clearedRegion;
    });

    const refreshedRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const nextResolvedSteps: QidahenDiplomacyResolvedStep[] = [
        ...resolvedSteps,
        {
            index: resolvedSteps.length + 1,
            targetRegionId: targetRegion.id,
            targetRegionName: dependencies.getActionRuleDisplayRegionName(targetRegion, targetRegion.name),
            choiceId,
            summary: stepSummary,
        },
    ];
    const remainingTargetCount = Math.max(0, selection.remainingTargetCount - 1);
    if (remainingTargetCount <= 0) {
        return finalizeResolution(
            refreshedRegions
                .filter((region) => !region.isLogicalRegion)
                .map(cloneRuntimeRegionAsPieceSnapshot),
            nextFactions,
            selectedRegionId,
            nextResolvedSteps,
        );
    }

    const nextSelection = buildDiplomacySelectionFromRegionSemantics(
        {
            ...state,
            regions: refreshedRegions,
        },
        actingFactionId,
        getQidahenExplicitRegionSelectionSemantics(state, targetRegion.id),
        selection.source,
        selection.sourceRegionId,
        selection.preferredSourceRegionId,
        {
            remainingTargetCount,
            resolvedSteps: nextResolvedSteps,
        },
    );
    const continuedSelection: QidahenDiplomacySelection = nextSelection ? {
        ...nextSelection,
        hireRegionId: selection.hireRegionId,
        hireRegionName: selection.hireRegionName,
    } : {
        ...selection,
        targetRegionId: null,
        targetRegionName: null,
        targetHint: `当前还可执行 ${remainingTargetCount} 次外交操作，或直接结束并结算雇佣。`,
        choices: [{
            id: 'hire-only',
            label: '结束并结算雇佣',
            detail: `${selection.hireRegionName ?? selection.sourceRegionName ?? '当前控制区'} 建立 2 个等级 2 雇佣军，并结束本次外交。`,
        }],
        remainingTargetCount,
        resolvedSteps: nextResolvedSteps,
    };
    return {
            selectedRegionId: diplomacyFocusRegionId,
            regions: refreshedRegions,
            factions: nextFactions,
            summaryLines: null,
            diplomacySelection: continuedSelection,
            logText: `${state.factions[actingFactionId].name} 完成第 ${nextResolvedSteps.length} 次外交：${stepSummary} 当前还可继续 ${remainingTargetCount} 次，或直接结束结算雇佣。`,
    };
};

export const resolveQidahenDiplomacyInteractionChoice = (
    state: QidahenCore,
    choiceId: QidahenDiplomacyChoice['id'],
    timestamp: number,
    interactionSelection?: QidahenDiplomacySelection | null,
    dependencies: QidahenActionWindowChoiceDependencies = {
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
        updateTurnLabel: updateQidahenTurnLabel,
        buildSeasonSummary,
        getFactionDrawPileCount,
        drawFromFactionPile,
        addFactionHandCards,
        buildDrawnHandCards,
        materializeNonSiegedCityActionSourceRegion,
        refreshRuntimeRegionRules,
        getEffectiveHomelandController,
        toFactionLabel,
        getActionRuleDisplayRegionName,
        resolveGrantPardonExecution: resolveQidahenGrantPardonExecution,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenCurrentDiplomacySelectionForCore,
    );
    if (!selection) {
        return state;
    }
    const currentFactionId = getCurrentFactionId(state);
    const resolution = resolveDiplomacyChoice(
        state,
        currentFactionId,
        selection,
        choiceId,
        dependencies,
    );
    if (resolution.diplomacySelection) {
        return dependencies.updateTurnLabel({
            ...state,
            selectedRegionId: resolution.selectedRegionId,
            explicitRegionId: resolution.diplomacySelection.targetRegionId ?? state.explicitRegionId,
            regionFocusState: buildQidahenRegionFocusState(resolution.selectedRegionId, {
                lockedSourceRegionId: resolution.selectedRegionId,
                currentTargetRegionId: resolution.diplomacySelection.targetRegionId ?? state.regionFocusState.currentTargetRegionId,
                displayAnchorRegionId: resolution.diplomacySelection.displayAnchorRegionId ?? resolution.selectedRegionId,
            }),
            turnPhase: 'diplomacy-choice',
            recruitSelection: null,
            maShiTradeSelection: null,
            khanEdictSelection: null,
            diplomacyProgress: buildQidahenDiplomacyProgress(resolution.diplomacySelection),
            wheelDispatchProgress: null,
            regions: resolution.regions,
            factions: resolution.factions,
            actionLog: [
                {
                    id: `log-diplomacy-${timestamp}`,
                    faction: currentFactionId,
                    text: resolution.logText,
                },
                ...state.actionLog,
            ].slice(0, 6),
        });
    }
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: resolution.selectedRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(resolution.selectedRegionId),
        turnPhase: 'action-window',
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        wheelDispatchProgress: null,
        regions: resolution.regions,
        factions: resolution.factions,
        lastSeasonSummary: dependencies.buildSeasonSummary(selection.title, timestamp, resolution.summaryLines ?? []),
        actionLog: [
            {
                id: `log-diplomacy-${timestamp}`,
                faction: currentFactionId,
                text: resolution.logText,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), timestamp);
};
