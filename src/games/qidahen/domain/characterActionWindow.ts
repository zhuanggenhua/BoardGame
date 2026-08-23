import {
    materializeNonSiegedCityActionSourceRegion,
} from './actionSourceRegionState';
import { getArmamentLevel } from './armamentStateAccessors';
import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';
import {
    resolveJinDaisanConflict,
    resolveJinHuangtaijiConflict,
    resolveMingCharacterConflict,
    resolveNurhaciRemovedByYuanChonghuan,
} from './characterConflictState';
import { hasActiveCharacter } from './characterPresenceAccessors';
import {
    buildGaoDiDispatchSelectionFromRegionSemantics,
    buildWangHuazhenInternalDispatchSelectionFromRegionSemantics,
} from './dispatchSelectionBuilders';
import { getCurrentFactionId } from './factionTurnAccessors';
import { getQidahenEffectivePopulation } from './populationRules';
import { resolveQidahenPrimaryRuntimeRegionId } from './regionConfig';
import {
    type QidahenExplicitRegionSelectionSemantics,
    withQidahenRegionFocusState,
} from './regionFocusSemantics';
import { canPlaceRegularTroopsInRegion } from './regionSelectionPreferences';
import { getActionRuleDisplayRegionName } from './regionRuleSemantics';
import { buildQidahenSunYuanhuaTechSelection } from './selectionInputState';
import {
    addSpecialTroopStackToRegion,
    cloneRuntimeRegionAsPieceSnapshot,
    hasNonMercenaryTroops,
    someCompatPieces,
} from './troopCompat';
import {
    trainSpecialTroopsOneStepForFaction,
    trainTroopsOneStepForFactionWithLimit,
} from './troopTraining';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import type { QidahenCore, QidahenFactionId } from './types';

interface QidahenCharacterActionWindowDependencies {
    resolveMingCharacterConflict: typeof resolveMingCharacterConflict;
    resolveNurhaciRemovedByYuanChonghuan: typeof resolveNurhaciRemovedByYuanChonghuan;
    resolveJinHuangtaijiConflict: typeof resolveJinHuangtaijiConflict;
    resolveJinDaisanConflict: typeof resolveJinDaisanConflict;
    hasActiveCharacter: (
        state: QidahenCore,
        factionId: QidahenFactionId,
        characterId: string,
    ) => boolean;
    materializeNonSiegedCityActionSourceRegion: (
        region: QidahenCore['regions'][number],
    ) => QidahenCore['regions'][number];
    getArmamentLevel: typeof getArmamentLevel;
    refreshRuntimeRegionRules: (
        regions: QidahenCore['regions'],
        fortifications: QidahenCore['fortifications'],
    ) => QidahenCore['regions'];
    buildSunYuanhuaTechSelection: (
        state: QidahenCore,
        selectedCardIds: string[],
    ) => QidahenCore['sunYuanhuaTechSelection'];
    buildGaoDiDispatchSelection: (
        state: QidahenCore,
        regionSemantics: QidahenExplicitRegionSelectionSemantics,
        selectedCardId?: string | null,
    ) => QidahenCore['gaoDiDispatchSelection'];
    getActionRuleDisplayRegionName: (
        region: Pick<QidahenCore['regions'][number], 'id' | 'name'> | null | undefined,
        fallbackName?: string,
    ) => string;
}

const LINDAN_HUTUKTU_INFLUENCE_REGION_IDS = new Set([
    'city-region-1',
    'city-region-2',
    'city-region-3',
    'city-region-6',
    'city-region-8',
    'city-region-10',
    'city-region-14',
    'city-region-16',
    'city-region-17',
    'city-region-19',
    'city-region-19-liaoxi',
    'city-region-20',
    'city-region-26',
]);

const LINDAN_HUTUKTU_INFLUENCE_PRIORITY: string[] = [
    'city-region-8',
    'city-region-16',
    'city-region-6',
    'city-region-10',
    'city-region-17',
    'city-region-19',
    'city-region-19-liaoxi',
    'city-region-1',
    'city-region-2',
    'city-region-3',
    'city-region-20',
    'city-region-26',
    'city-region-14',
];

const DONGJIANG_RUNTIME_REGION_ID = 'city-region-22';

const getLindanHutuktuInfluencePriority = (regionId: string): number => {
    const index = LINDAN_HUTUKTU_INFLUENCE_PRIORITY.indexOf(regionId);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
};

const isEligibleForLindanFriendlyInfluence = (
    region: Pick<QidahenCore['regions'][number], 'id' | 'controller' | 'diplomacyMarkerFaction' | 'diplomacyMarkerSide' | 'troops' | 'specialTroops' | 'population' | 'siegeState' | 'cityState'>,
): boolean => (
    LINDAN_HUTUKTU_INFLUENCE_REGION_IDS.has(region.id)
    && region.controller === 'neutral'
    && region.diplomacyMarkerFaction == null
    && region.diplomacyMarkerSide == null
    && !hasNonMercenaryTroops(getNonSiegedCityActionSourceSnapshot(region as QidahenCore['regions'][number]))
);

const isEligibleForLindanVassalUpgrade = (
    region: Pick<QidahenCore['regions'][number], 'id' | 'diplomacyMarkerFaction' | 'diplomacyMarkerSide' | 'troops' | 'specialTroops' | 'population' | 'siegeState' | 'cityState' | 'controller'>,
): boolean => (
    LINDAN_HUTUKTU_INFLUENCE_REGION_IDS.has(region.id)
    && region.diplomacyMarkerFaction === 'mongol'
    && region.diplomacyMarkerSide === 'friendly'
    && !hasNonMercenaryTroops(getNonSiegedCityActionSourceSnapshot(region as QidahenCore['regions'][number]))
);

const findLindanHutuktuInfluenceTarget = (
    state: QidahenCore,
): {
    regionId: string;
    mode: 'place-friendly' | 'flip-vassal';
} | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(state.selectedRegionId);
    const selectedRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === selectedRuntimeRegionId);
    if (selectedRegion && isEligibleForLindanFriendlyInfluence(selectedRegion)) {
        return { regionId: selectedRegion.id, mode: 'place-friendly' };
    }
    if (selectedRegion && isEligibleForLindanVassalUpgrade(selectedRegion)) {
        return { regionId: selectedRegion.id, mode: 'flip-vassal' };
    }

    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const friendlyTarget = runtimeRegions
        .filter(isEligibleForLindanFriendlyInfluence)
        .sort((left, right) => (
            getLindanHutuktuInfluencePriority(left.id) - getLindanHutuktuInfluencePriority(right.id)
            || left.name.localeCompare(right.name, 'zh-CN')
        ))[0];
    if (friendlyTarget) {
        return { regionId: friendlyTarget.id, mode: 'place-friendly' };
    }

    const vassalTarget = runtimeRegions
        .filter(isEligibleForLindanVassalUpgrade)
        .sort((left, right) => (
            getLindanHutuktuInfluencePriority(left.id) - getLindanHutuktuInfluencePriority(right.id)
            || left.name.localeCompare(right.name, 'zh-CN')
        ))[0];
    return vassalTarget
        ? { regionId: vassalTarget.id, mode: 'flip-vassal' }
        : null;
};

type QidahenXiongTingbiFreeTrainingResolution = {
    regions: QidahenCore['regions'];
    selectedRegionId: string;
    logText: string;
};

const resolveQidahenXiongTingbiFreeTraining = (
    state: QidahenCore,
    dependencies: Pick<
        QidahenCharacterActionWindowDependencies,
        'getActionRuleDisplayRegionName' | 'getArmamentLevel' | 'materializeNonSiegedCityActionSourceRegion' | 'refreshRuntimeRegionRules'
    >,
): QidahenXiongTingbiFreeTrainingResolution | null => {
    const artilleryMaxLevel = dependencies.getArmamentLevel(state, 'ming', 'artillery-tech');
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(state.selectedRegionId);
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const nextRuntimeRegions = runtimeRegions.map(cloneRuntimeRegionAsPieceSnapshot);
    const candidateRegions = nextRuntimeRegions
        .filter((region) => {
            const sourceSnapshot = getNonSiegedCityActionSourceSnapshot(region);
            return region.controller === 'ming'
                || someCompatPieces(sourceSnapshot.specialTroops, (piece) => piece.faction === 'ming');
        })
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return Number(right.id === selectedRuntimeRegionId) - Number(left.id === selectedRuntimeRegionId)
                || rightSource.troops - leftSource.troops
                || getQidahenEffectivePopulation(right, rightSource.population)
                    - getQidahenEffectivePopulation(left, leftSource.population)
                || left.name.localeCompare(right.name, 'zh-CN');
        });

    let remainingTroops = 4;
    let totalTrainedCount = 0;
    let selectedRegionId: string | null = null;
    const summaryLines: string[] = [];
    for (const candidateRegion of candidateRegions) {
        if (remainingTroops <= 0) {
            break;
        }
        const actionTrainingRegion = dependencies.materializeNonSiegedCityActionSourceRegion(candidateRegion);
        const trainingResult = trainTroopsOneStepForFactionWithLimit(
            actionTrainingRegion,
            'ming',
            artilleryMaxLevel,
            remainingTroops,
            {
                upgradedRegularTroopSourceId: `${actionTrainingRegion.id}-xiong-tingbi`,
            },
        );
        if (trainingResult.trainedCount <= 0) {
            continue;
        }
        const runtimeRegionIndex = nextRuntimeRegions.findIndex((region) => region.id === candidateRegion.id);
        if (runtimeRegionIndex >= 0) {
            nextRuntimeRegions[runtimeRegionIndex] = {
                ...actionTrainingRegion,
                note: `${actionTrainingRegion.note} 部队经熊廷弼免费训练后提升 1 级。`.trim(),
                specialTroops: trainingResult.specialTroops,
            };
        }
        remainingTroops -= trainingResult.trainedCount;
        totalTrainedCount += trainingResult.trainedCount;
        selectedRegionId ??= candidateRegion.id;
        summaryLines.push(`${dependencies.getActionRuleDisplayRegionName(candidateRegion, candidateRegion.name)}：${trainingResult.trainedDetails.join('、')}`);
    }

    if (totalTrainedCount <= 0) {
        return null;
    }

    return {
        regions: dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications),
        selectedRegionId: selectedRegionId ?? state.selectedRegionId,
        logText: `熊廷弼在行动前免费训练 ${totalTrainedCount} 个部队：${summaryLines.join('；')}。`,
    };
};

export const applyQidahenCharacterActionWindowEffectsWithFocus = (
    state: QidahenCore,
    dependencies: QidahenCharacterActionWindowDependencies = {
        resolveMingCharacterConflict,
        resolveNurhaciRemovedByYuanChonghuan,
        resolveJinHuangtaijiConflict,
        resolveJinDaisanConflict,
        hasActiveCharacter,
        materializeNonSiegedCityActionSourceRegion,
        getArmamentLevel,
        refreshRuntimeRegionRules,
        buildSunYuanhuaTechSelection: buildQidahenSunYuanhuaTechSelection,
        buildGaoDiDispatchSelection: buildGaoDiDispatchSelectionFromRegionSemantics,
        getActionRuleDisplayRegionName,
    },
): { state: QidahenCore; forcedSelectedRegionId: string | null } => {
    if (state.turnPhase !== 'action-window') {
        return { state, forcedSelectedRegionId: null };
    }
    const triggerKey = `${state.currentPlayer}:${state.roundNumber}:${Number(state.wheelActionUsed)}:${Number(state.factionActionUsed)}`;
    if (state.lastCharacterActionWindowTriggerKey === triggerKey) {
        return { state, forcedSelectedRegionId: null };
    }

    const progressKey = state.lastCharacterActionWindowTriggerKey;
    const handledEffectIds = !progressKey?.startsWith(`${triggerKey}|`)
        ? new Set<string>()
        : new Set(progressKey.slice(triggerKey.length + 1).split(',').filter(Boolean));
    const syncProgress = (nextState: QidahenCore): QidahenCore => ({
        ...nextState,
        lastCharacterActionWindowTriggerKey: `${triggerKey}|${[...handledEffectIds].sort().join(',')}`,
    });

    let nextState = syncProgress(state);
    let forcedSelectedRegionId: string | null = null;

    const currentFactionId = getCurrentFactionId(nextState);
    if (currentFactionId === 'ming') {
        if (!handledEffectIds.has('ming-conflict')) {
            const mingConflictResolution = dependencies.resolveMingCharacterConflict(nextState.factions);
            if (mingConflictResolution.removedMaoWenlong) {
                nextState = {
                    ...nextState,
                    factions: mingConflictResolution.factions,
                    actionLog: [
                        {
                            id: `log-mao-wenlong-conflict-${triggerKey}`,
                            faction: 'ming' as const,
                            text: '毛文龙与袁崇焕同场，毛文龙离场。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
            handledEffectIds.add('ming-conflict');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('ming-mao-wenlong')) {
            if (dependencies.hasActiveCharacter(nextState, 'ming', 'ming-mao-wenlong')) {
                const dongjiangRegion = nextState.regions.find((region) => !region.isLogicalRegion && region.id === DONGJIANG_RUNTIME_REGION_ID);
                if (dongjiangRegion) {
                    const actionDongjiangRegion = dependencies.materializeNonSiegedCityActionSourceRegion(dongjiangRegion);
                    const trainingResult = trainSpecialTroopsOneStepForFaction(
                        actionDongjiangRegion,
                        'ming',
                        dependencies.getArmamentLevel(nextState, 'ming', 'artillery-tech'),
                    );
                    if (trainingResult.trainedCount > 0) {
                        const updatedRegions = dependencies.refreshRuntimeRegionRules(nextState.regions.map((region) => {
                            if (region.isLogicalRegion || region.id !== DONGJIANG_RUNTIME_REGION_ID) {
                                return region;
                            }
                            return {
                                ...actionDongjiangRegion,
                                note: `${region.name} 因毛文龙免费训练东江部队 1 次。`,
                                specialTroops: trainingResult.specialTroops,
                            };
                        }), nextState.fortifications);
                        nextState = {
                            ...nextState,
                            regions: updatedRegions,
                            actionLog: [
                                {
                                    id: `log-mao-wenlong-training-${triggerKey}`,
                                    faction: 'ming' as const,
                                    text: `毛文龙在东江免费训练 ${trainingResult.trainedCount} 个部队：${trainingResult.trainedDetails.join('、')}。`,
                                },
                                ...nextState.actionLog,
                            ].slice(0, 6),
                        };
                        forcedSelectedRegionId = DONGJIANG_RUNTIME_REGION_ID;
                    }
                }
            }
            handledEffectIds.add('ming-mao-wenlong');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('ming-xiong-tingbi')) {
            if (dependencies.hasActiveCharacter(nextState, 'ming', 'ming-xiong-tingbi')) {
                const trainingResolution = resolveQidahenXiongTingbiFreeTraining(nextState, dependencies);
                if (trainingResolution) {
                    nextState = {
                        ...nextState,
                        regions: trainingResolution.regions,
                        actionLog: [
                            {
                                id: `log-xiong-tingbi-training-${triggerKey}`,
                                faction: 'ming' as const,
                                text: trainingResolution.logText,
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    };
                    forcedSelectedRegionId = trainingResolution.selectedRegionId;
                }
            }
            handledEffectIds.add('ming-xiong-tingbi');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('ming-sun-yuanhua')) {
            const sunYuanhuaTechSelection = dependencies.buildSunYuanhuaTechSelection(
                nextState,
                nextState.sunYuanhuaTechSelection?.selectedCardIds ?? [],
            );
            handledEffectIds.add('ming-sun-yuanhua');
            nextState = syncProgress(nextState);
            if (sunYuanhuaTechSelection) {
                return {
                    state: {
                        ...nextState,
                        turnPhase: 'sun-yuanhua-tech-choice',
                        sunYuanhuaTechSelection,
                        actionLog: [
                            {
                                id: `log-sun-yuanhua-tech-${triggerKey}`,
                                faction: 'ming' as const,
                                text: '孙元化可在行动前弃 2 张手牌，推进 1 项科技。',
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    },
                    forcedSelectedRegionId,
                };
            }
        }

        if (!handledEffectIds.has('ming-gao-di')) {
            const preferredGaoDiRegionId = forcedSelectedRegionId ?? nextState.selectedRegionId;
            const gaoDiRegionSemantics: QidahenExplicitRegionSelectionSemantics = {
                defaultFocusRegionId: nextState.regionFocusState.defaultFocusRegionId,
                lockedFocusRegionId: nextState.selectedRegionId,
                lockedSourceRegionId: nextState.regionFocusState.lockedSourceRegionId,
                targetRegionId: preferredGaoDiRegionId,
                currentTargetRegionId: preferredGaoDiRegionId,
                displayAnchorRegionId: preferredGaoDiRegionId,
            };
            const gaoDiDispatchSelection = dependencies.hasActiveCharacter(nextState, 'ming', 'ming-gao-di')
                ? dependencies.buildGaoDiDispatchSelection(nextState, gaoDiRegionSemantics, nextState.gaoDiDispatchSelection?.selectedCardId ?? null)
                : null;
            handledEffectIds.add('ming-gao-di');
            nextState = syncProgress(nextState);
            if (gaoDiDispatchSelection) {
                return {
                    state: {
                        ...nextState,
                        ...withQidahenRegionFocusState(nextState, gaoDiDispatchSelection.sourceRegionId, {
                            lockedSourceRegionId: gaoDiDispatchSelection.sourceRegionId,
                            currentTargetRegionId: nextState.explicitRegionId ?? preferredGaoDiRegionId,
                            displayAnchorRegionId: gaoDiDispatchSelection.displayAnchorRegionId ?? gaoDiDispatchSelection.sourceRegionId,
                        }),
                        turnPhase: 'gao-di-dispatch-choice',
                        gaoDiDispatchSelection,
                        actionLog: [
                            {
                                id: `log-gao-di-dispatch-${triggerKey}`,
                                faction: 'ming' as const,
                                text: `高第可在行动前弃 1 张手牌；弃牌后再选择调度目标，最多调 6 个人口或部队。`,
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    },
                    forcedSelectedRegionId,
                };
            }
        }

        if (!handledEffectIds.has('ming-wang-huazhen')) {
            const preferredWangHuazhenRegionId = forcedSelectedRegionId ?? nextState.selectedRegionId;
            const wangHuazhenRegionSemantics: QidahenExplicitRegionSelectionSemantics = {
                defaultFocusRegionId: nextState.regionFocusState.defaultFocusRegionId,
                lockedFocusRegionId: nextState.selectedRegionId,
                lockedSourceRegionId: nextState.regionFocusState.lockedSourceRegionId,
                targetRegionId: preferredWangHuazhenRegionId,
                currentTargetRegionId: preferredWangHuazhenRegionId,
                displayAnchorRegionId: preferredWangHuazhenRegionId,
            };
            const internalDispatchSelection = dependencies.hasActiveCharacter(nextState, 'ming', 'ming-wang-huazhen')
                ? buildWangHuazhenInternalDispatchSelectionFromRegionSemantics(nextState, wangHuazhenRegionSemantics)
                : null;
            handledEffectIds.add('ming-wang-huazhen');
            nextState = syncProgress(nextState);
            if (internalDispatchSelection) {
                return {
                    state: {
                        ...nextState,
                        ...withQidahenRegionFocusState(nextState, internalDispatchSelection.sourceRegionId, {
                            lockedSourceRegionId: internalDispatchSelection.sourceRegionId,
                            currentTargetRegionId: nextState.explicitRegionId ?? preferredWangHuazhenRegionId,
                            displayAnchorRegionId: internalDispatchSelection.displayAnchorRegionId ?? internalDispatchSelection.sourceRegionId,
                        }),
                        turnPhase: 'internal-dispatch-choice',
                        actionLog: [
                            {
                                id: `log-wang-huazhen-dispatch-${triggerKey}`,
                                faction: 'ming' as const,
                                text: `王化贞可在行动前免费调度 2 个部队；直接在地图上选择调度目标。`,
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    },
                    forcedSelectedRegionId,
                };
            }
        }
        return { state: nextState, forcedSelectedRegionId };
    }

    if (currentFactionId === 'jin') {
        if (!handledEffectIds.has('jin-nurhaci-removed-by-yuan')) {
            const nurhaciRemoval = dependencies.resolveNurhaciRemovedByYuanChonghuan(nextState.factions);
            if (nurhaciRemoval.removedNurhaci) {
                nextState = {
                    ...nextState,
                    factions: nurhaciRemoval.factions,
                    actionLog: [
                        {
                            id: `log-jin-nurhaci-removed-by-yuan-${triggerKey}`,
                            faction: 'jin' as const,
                            text: '袁崇焕在场，努尔哈赤被移出游戏。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
            handledEffectIds.add('jin-nurhaci-removed-by-yuan');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('jin-huangtaiji-conflict')) {
            const jinConflictResolution = dependencies.resolveJinHuangtaijiConflict(nextState.factions);
            if (jinConflictResolution.removedHuangtaiji) {
                nextState = {
                    ...nextState,
                    factions: jinConflictResolution.factions,
                    actionLog: [
                        {
                            id: `log-jin-huangtaiji-conflict-${triggerKey}`,
                            faction: 'jin' as const,
                            text: '皇太极与其他后金贝勒同场，被拣弃并直接自游戏中移除。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
            handledEffectIds.add('jin-huangtaiji-conflict');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('jin-daisan-conflict')) {
            const daisanConflictResolution = dependencies.resolveJinDaisanConflict(nextState.factions);
            if (daisanConflictResolution.removedDaisan) {
                nextState = {
                    ...nextState,
                    factions: daisanConflictResolution.factions,
                    actionLog: [
                        {
                            id: `log-jin-daisan-conflict-${triggerKey}`,
                            faction: 'jin' as const,
                            text: '代善与其他后金贝勒同场，被拣弃并回到后金人物牌堆。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
            handledEffectIds.add('jin-daisan-conflict');
            nextState = syncProgress(nextState);
        }
        return { state: nextState, forcedSelectedRegionId };
    }

    if (currentFactionId !== 'mongol') {
        return { state: nextState, forcedSelectedRegionId };
    }

    if (!handledEffectIds.has('mongol-lindan-hutuktu')) {
        if (dependencies.hasActiveCharacter(nextState, 'mongol', 'mongol-lindan-hutuktu')) {
            const influenceTarget = findLindanHutuktuInfluenceTarget(nextState);
            if (influenceTarget) {
                const updatedRegions = dependencies.refreshRuntimeRegionRules(nextState.regions.map((region) => {
                    if (region.isLogicalRegion || region.id !== influenceTarget.regionId) {
                        return region;
                    }
                    if (influenceTarget.mode === 'place-friendly') {
                        return {
                            ...region,
                            diplomacyMarkerFaction: 'mongol',
                            diplomacyMarkerSide: 'friendly',
                            note: `${dependencies.getActionRuleDisplayRegionName(region, region.name)} 因林丹·乎图克图的大汗天威放置了蒙古友好标记。`,
                        };
                    }
                    return {
                        ...region,
                        controller: 'mongol',
                        diplomacyMarkerFaction: 'mongol',
                        diplomacyMarkerSide: 'vassal',
                        note: `${dependencies.getActionRuleDisplayRegionName(region, region.name)} 因林丹·乎图克图的大汗天威将蒙古友好标记翻为附庸。`,
                    };
                }), nextState.fortifications);
                const targetRegion = updatedRegions.find((region) => !region.isLogicalRegion && region.id === influenceTarget.regionId);
                nextState = {
                    ...nextState,
                    regions: updatedRegions,
                    actionLog: [
                        {
                            id: `log-lindan-hutuktu-${triggerKey}`,
                            faction: 'mongol' as const,
                            text: influenceTarget.mode === 'place-friendly' && targetRegion
                                ? `林丹·乎图克图在 ${dependencies.getActionRuleDisplayRegionName(targetRegion, targetRegion.name)} 放置了蒙古友好标记。`
                                : targetRegion
                                    ? `林丹·乎图克图将 ${dependencies.getActionRuleDisplayRegionName(targetRegion, targetRegion.name)} 的蒙古友好标记翻为附庸。`
                                    : '林丹·乎图克图发动大汗天威，强化了蒙古区域影响力。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
                forcedSelectedRegionId = influenceTarget.regionId;
            }
        }
        handledEffectIds.add('mongol-lindan-hutuktu');
        nextState = syncProgress(nextState);
    }

    if (!handledEffectIds.has('mongol-choghtu-taiji')) {
        if (dependencies.hasActiveCharacter(nextState, 'mongol', 'mongol-choghtu-taiji')) {
            const targetRegion = nextState.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-2');
            if (targetRegion && canPlaceRegularTroopsInRegion(targetRegion, 'mongol')) {
                const updatedRegions = dependencies.refreshRuntimeRegionRules(nextState.regions.map((region) => {
                    if (region.isLogicalRegion || region.id !== targetRegion.id) {
                        return region;
                    }
                    const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
                    return addSpecialTroopStackToRegion({
                        ...actionTargetRegion,
                        troops: actionTargetRegion.troops + 2,
                        note: `${actionTargetRegion.name} 因绰克图台吉的漠北援军建立 2 个等级 2 骑兵。`,
                    }, {
                        id: 'mongol-choghtu-taiji-cavalry-lv2',
                        label: '蒙古骑兵',
                        faction: 'mongol' as const,
                        troopKind: 'cavalry',
                        count: 2,
                        level: 2,
                    });
                }), nextState.fortifications);

                nextState = {
                    ...nextState,
                    selectedRegionId: nextState.selectedRegionId === targetRegion.id ? targetRegion.id : nextState.selectedRegionId,
                    factions: {
                        ...nextState.factions,
                        mongol: {
                            ...nextState.factions.mongol,
                            troops: nextState.factions.mongol.troops + 2,
                        },
                    },
                    regions: updatedRegions,
                    actionLog: [
                        {
                            id: `log-choghtu-taiji-${triggerKey}`,
                            faction: 'mongol' as const,
                            text: '绰克图台吉在外喀尔喀部发动漠北援军，免费建立 2 个蒙古骑兵。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
        }
        handledEffectIds.add('mongol-choghtu-taiji');
        nextState = syncProgress(nextState);
    }
    return { state: nextState, forcedSelectedRegionId };
};

export function applyQidahenCharacterActionWindowEffects(
    state: QidahenCore,
    dependencies: QidahenCharacterActionWindowDependencies = {
        resolveMingCharacterConflict,
        resolveNurhaciRemovedByYuanChonghuan,
        resolveJinHuangtaijiConflict,
        resolveJinDaisanConflict,
        hasActiveCharacter,
        materializeNonSiegedCityActionSourceRegion,
        getArmamentLevel,
        refreshRuntimeRegionRules,
        buildSunYuanhuaTechSelection: buildQidahenSunYuanhuaTechSelection,
        buildGaoDiDispatchSelection: buildGaoDiDispatchSelectionFromRegionSemantics,
        getActionRuleDisplayRegionName,
    },
): QidahenCore {
    return applyQidahenCharacterActionWindowEffectsWithFocus(state, dependencies).state;
}
