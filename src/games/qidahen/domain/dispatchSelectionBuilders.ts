import {
    getNonSiegedCityActionSourceSnapshot,
    materializeNonSiegedCityActionSourceRegion,
} from './actionSourceRegionState';
import {
    getEffectiveDefenderTroops,
    getRegionSiegeAttackerForceSnapshot,
    isRegionControlledByFaction,
    isRegionFriendlyToFaction,
} from './battleState';
import { hasActiveCharacter } from './characterPresenceAccessors';
import { getCurrentFactionId } from './factionTurnAccessors';
import {
    findQidahenReachableRuntimeRegions,
    getQidahenDirectedPassageRule,
    getQidahenMovementProfile,
    type QidahenMovementProfileId,
} from './movement';
import {
    getMovableTroopCountForProfile,
    getQidahenCharacterCommittedTroopLimit,
} from './pendingBattleCommittedTroops';
import { getQidahenEffectivePopulation } from './populationRules';
import {
    isFriendlyDispatchSupportTarget,
    isFriendlySiegedCityTarget,
    isOwnSiegedCityReinforcementTarget,
    isRegionAvailableForNonDispatchAction,
} from './regionSelectionPreferences';
import {
    isQidahenCityRuntimeRegion,
    resolveQidahenPrimaryRuntimeRegionId,
} from './regionConfig';
import {
    getPreferredLogicalRegionDisplayName,
} from './regionRuleSemantics';
import {
    getQidahenExplicitRegionSelectionSemantics,
    getQidahenInteractionFocusRegionId,
    getQidahenLockedRegionSelectionSemantics,
    type QidahenExplicitRegionSelectionSemantics,
} from './regionFocusSemantics';
import { resolvePreferredRegionDisplayAnchor } from './selectionDisplayAnchor';
import {
    formatTroopTransferDetails,
    getSpecialTroopCount,
} from './troopCompat';
import { takeCommittedSpecialTroopStacks } from './movementProfileTroopSelection';
import { toFactionLabel } from './factionLabelSemantics';
import {
    computeQidahenAttackPressure,
    computeQidahenEffectiveCommittedTroops,
    getQidahenAttackRuleConfig,
} from './attackRules';
import { getQidahenBoundaryTypeMeta } from '../ui/mapGraph';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenGaoDiDispatchSelection,
    QidahenInternalDispatchSelection,
    QidahenWheelDispatchCandidate,
    QidahenWheelDispatchSelection,
} from './types';

const DRIVE_TIGER_COMMANDER_FACTION_ID: QidahenFactionId = 'ming';

const getActionRulePathLabel = (
    state: Pick<QidahenCore, 'regions'>,
    pathRegionIds: string[],
    preferredRegionId?: string | null,
): string => (
    pathRegionIds
        .map((regionId) => {
            const region = state.regions.find((candidate) => candidate.id === regionId);
            return region ? getPreferredLogicalRegionDisplayName(region, preferredRegionId) : regionId;
        })
        .join(' → ')
);

const wheelDispatchProfileIdByPosition: Partial<Record<string, QidahenMovementProfileId>> = {
    'wheel-diplomacy': 'dispatch-infantry',
    'wheel-hire': 'dispatch-cavalry',
};

export interface QidahenWheelDispatchSelectionRegionSemantics {
    selectedTargetRegionId: string;
    preferredSourceRegionId: string;
    displayAnchorRegionId: string;
}

export const getQidahenWheelDispatchSelectionRegionSemantics = (
    state: Pick<QidahenCore, 'explicitRegionId' | 'regionFocusState' | 'selectedRegionId'>,
    sourceRegionId: string,
    preferredSourceRegionId?: string | null,
): QidahenWheelDispatchSelectionRegionSemantics => {
    const regionSemantics = getQidahenExplicitRegionSelectionSemantics(state, sourceRegionId);
    return {
        selectedTargetRegionId: regionSemantics.targetRegionId,
        preferredSourceRegionId: sourceRegionId,
        displayAnchorRegionId: preferredSourceRegionId ?? sourceRegionId,
    };
};

export const buildWangHuazhenInternalDispatchSelectionFromRegionSemantics = (
    state: QidahenCore,
    regionSemantics: QidahenExplicitRegionSelectionSemantics,
): QidahenInternalDispatchSelection | null => {
    const preferredSourceRegionId = regionSemantics.targetRegionId;
    const displayAnchorRegionId = regionSemantics.displayAnchorRegionId;
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const buildCandidatesForSource = (sourceRegion: QidahenCore['regions'][number]) => {
        const actionSourceRegion = materializeNonSiegedCityActionSourceRegion(sourceRegion);
        const sourceRegionName = getPreferredLogicalRegionDisplayName(actionSourceRegion, displayAnchorRegionId);
        const maxTroops = Math.max(0, Math.min(2, actionSourceRegion.troops));
        if (maxTroops <= 0) {
            return [];
        }
        return sourceRegion.adjacentRegionIds
            .map((regionId) => runtimeRegions.find((region) => region.id === regionId) ?? null)
            .filter((region): region is NonNullable<typeof region> => isFriendlyDispatchSupportTarget(region, 'ming'))
            .map((targetRegion) => {
                const targetRegionName = getPreferredLogicalRegionDisplayName(targetRegion, displayAnchorRegionId);
                const passage = getQidahenDirectedPassageRule(state, actionSourceRegion.id, targetRegion.id, 'ming');
                if (!passage?.usable) {
                    return null;
                }
                const isSiegeReinforcementTarget = isOwnSiegedCityReinforcementTarget(targetRegion, 'ming');
                const movedSpecialTroops = takeCommittedSpecialTroopStacks(actionSourceRegion, maxTroops);
                const movedSpecialTroopCount = getSpecialTroopCount({ specialTroops: movedSpecialTroops });
                const movedGenericTroops = Math.max(0, maxTroops - movedSpecialTroopCount);
                const detail = formatTroopTransferDetails(movedGenericTroops, movedSpecialTroops);
                return {
                    id: `wang-huazhen:${sourceRegion.id}:${targetRegion.id}`,
                    targetRegionId: targetRegion.id,
                    targetRegionName,
                    totalTravelCost: passage.travelCost,
                    committedTroops: maxTroops,
                    movedGenericTroops,
                    movedSpecialTroops,
                    resolutionHint: `${sourceRegionName} → ${targetRegionName} · ${isSiegeReinforcementTarget ? '增援围城' : '搬运'} ${maxTroops} 部队 · ${detail || '无可搬运部队'} · 耗${passage.travelCost}`,
                    pathRegionIds: [actionSourceRegion.id, targetRegion.id],
                    pathLabel: `${sourceRegionName} → ${targetRegionName}`,
                };
            })
            .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
            .sort((left, right) => (
                left.totalTravelCost - right.totalTravelCost
                || left.targetRegionName.localeCompare(right.targetRegionName, 'zh-CN')
            ));
    };

    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(preferredSourceRegionId);
    const candidateSources = runtimeRegions
        .filter((region) => (
            isRegionControlledByFaction(region, 'ming')
            && isRegionAvailableForNonDispatchAction(region)
            && getNonSiegedCityActionSourceSnapshot(region).troops > 0
        ))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return Number(right.id === selectedRuntimeRegionId) - Number(left.id === selectedRuntimeRegionId)
                || rightSource.troops - leftSource.troops
                || getQidahenEffectivePopulation(right, rightSource.population)
                    - getQidahenEffectivePopulation(left, leftSource.population)
                || left.name.localeCompare(right.name, 'zh-CN');
        });
    const sourceRegion = candidateSources.find((region) => buildCandidatesForSource(region).length > 0) ?? null;
    if (!sourceRegion) {
        return null;
    }
    const candidates = buildCandidatesForSource(sourceRegion);
    if (candidates.length === 0) {
        return null;
    }
    return {
        source: 'wang-huazhen',
        title: '王化贞免费调度',
        summary: '行动前可免费调度 2 个部队。当前实现为友方相邻区域之间的正式内部调度，不走进攻链。',
        sourceRegionId: sourceRegion.id,
        sourceRegionName: getPreferredLogicalRegionDisplayName(sourceRegion, displayAnchorRegionId),
        displayAnchorRegionId: resolvePreferredRegionDisplayAnchor(sourceRegion, displayAnchorRegionId),
        displayAnchorRegionName: getPreferredLogicalRegionDisplayName(
            sourceRegion,
            resolvePreferredRegionDisplayAnchor(sourceRegion, displayAnchorRegionId),
        ),
        maxTroops: Math.max(0, Math.min(2, getNonSiegedCityActionSourceSnapshot(sourceRegion).troops)),
        candidates,
    };
};

export const buildGaoDiDispatchSelectionFromRegionSemantics = (
    state: QidahenCore,
    regionSemantics: QidahenExplicitRegionSelectionSemantics,
    selectedCardId: string | null = null,
): QidahenGaoDiDispatchSelection | null => {
    const preferredSourceRegionId = regionSemantics.targetRegionId;
    const displayAnchorRegionId = regionSemantics.displayAnchorRegionId;
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const candidateCardIds = state.handCards
        .filter((card) => card.faction === 'ming' && card.status !== 'disabled')
        .map((card) => card.id);
    if (candidateCardIds.length <= 0) {
        return null;
    }

    const buildCandidatesForSource = (sourceRegion: QidahenCore['regions'][number]) => {
        const actionSourceRegion = materializeNonSiegedCityActionSourceRegion(sourceRegion);
        const sourceRegionName = getPreferredLogicalRegionDisplayName(actionSourceRegion, displayAnchorRegionId);
        const adjacentTargets = sourceRegion.adjacentRegionIds
            .map((regionId) => runtimeRegions.find((region) => region.id === regionId) ?? null)
            .filter((region): region is NonNullable<typeof region> => isFriendlyDispatchSupportTarget(region, 'ming'));
        const candidates: QidahenGaoDiDispatchSelection['candidates'] = [];

        for (const targetRegion of adjacentTargets) {
            const targetRegionName = getPreferredLogicalRegionDisplayName(targetRegion, displayAnchorRegionId);
            const passage = getQidahenDirectedPassageRule(state, actionSourceRegion.id, targetRegion.id, 'ming');
            if (!passage?.usable) {
                continue;
            }
            const isSiegeReinforcementTarget = isOwnSiegedCityReinforcementTarget(targetRegion, 'ming');

            const maxTroops = Math.max(0, Math.min(6, actionSourceRegion.troops));
            for (let committedTroops = maxTroops; committedTroops >= 1; committedTroops -= 1) {
                const movedSpecialTroops = takeCommittedSpecialTroopStacks(actionSourceRegion, committedTroops);
                const movedSpecialTroopCount = getSpecialTroopCount({ specialTroops: movedSpecialTroops });
                const movedGenericTroops = Math.max(0, committedTroops - movedSpecialTroopCount);
                const detail = formatTroopTransferDetails(movedGenericTroops, movedSpecialTroops);
                candidates.push({
                    id: `gao-di:troops:${sourceRegion.id}:${targetRegion.id}:${committedTroops}`,
                    mode: 'troops',
                    targetRegionId: targetRegion.id,
                    targetRegionName,
                    totalTravelCost: passage.travelCost,
                    committedTroops,
                    committedPopulation: 0,
                    movedGenericTroops,
                    movedSpecialTroops,
                    resolutionHint: `${sourceRegionName} → ${targetRegionName} · ${isSiegeReinforcementTarget ? '增援围城' : '调度'} ${committedTroops} 个部队 · ${detail || '未结构化部队'} · 邻接 1 格`,
                    pathRegionIds: [actionSourceRegion.id, targetRegion.id],
                    pathLabel: `${sourceRegionName} → ${targetRegionName}`,
                });
            }

            if (isSiegeReinforcementTarget) {
                continue;
            }
            const maxPopulation = Math.min(
                6,
                getQidahenEffectivePopulation(actionSourceRegion),
            );
            for (let committedPopulation = maxPopulation; committedPopulation >= 1; committedPopulation -= 1) {
                candidates.push({
                    id: `gao-di:population:${sourceRegion.id}:${targetRegion.id}:${committedPopulation}`,
                    mode: 'population',
                    targetRegionId: targetRegion.id,
                    targetRegionName,
                    totalTravelCost: passage.travelCost,
                    committedTroops: 0,
                    committedPopulation,
                    movedGenericTroops: 0,
                    movedSpecialTroops: [],
                    resolutionHint: `${sourceRegionName} → ${targetRegionName} · 调度 ${committedPopulation} 个人口 · 邻接 1 格`,
                    pathRegionIds: [actionSourceRegion.id, targetRegion.id],
                    pathLabel: `${sourceRegionName} → ${targetRegionName}`,
                });
            }
        }

        return candidates.sort((left, right) => (
            left.targetRegionName.localeCompare(right.targetRegionName, 'zh-CN')
            || Number(right.mode === 'troops') - Number(left.mode === 'troops')
            || (right.committedTroops + right.committedPopulation) - (left.committedTroops + left.committedPopulation)
        ));
    };

    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(preferredSourceRegionId);
    const candidateSources = runtimeRegions
        .filter((region) => (
            isRegionControlledByFaction(region, 'ming')
            && isRegionAvailableForNonDispatchAction(region)
            && (() => {
                const sourceSnapshot = getNonSiegedCityActionSourceSnapshot(region);
                return sourceSnapshot.troops > 0
                    || getQidahenEffectivePopulation(region, sourceSnapshot.population) > 0;
            })()
        ))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return Number(right.id === selectedRuntimeRegionId) - Number(left.id === selectedRuntimeRegionId)
                || Math.max(
                    rightSource.troops,
                    getQidahenEffectivePopulation(right, rightSource.population),
                ) - Math.max(
                    leftSource.troops,
                    getQidahenEffectivePopulation(left, leftSource.population),
                )
                || rightSource.troops - leftSource.troops
                || getQidahenEffectivePopulation(right, rightSource.population)
                    - getQidahenEffectivePopulation(left, leftSource.population)
                || left.name.localeCompare(right.name, 'zh-CN');
        });
    const sourceRegion = candidateSources.find((region) => buildCandidatesForSource(region).length > 0) ?? null;
    if (!sourceRegion) {
        return null;
    }

    const candidates = buildCandidatesForSource(sourceRegion);
    if (candidates.length <= 0) {
        return null;
    }

    return {
        source: 'gao-di',
        title: '高第弃牌调度',
        summary: '行动前弃 1 张手牌，可在友方相邻区域间调度 1 格，数量可在 1-6 之间选择。',
        sourceRegionId: sourceRegion.id,
        sourceRegionName: getPreferredLogicalRegionDisplayName(sourceRegion, displayAnchorRegionId),
        displayAnchorRegionId: resolvePreferredRegionDisplayAnchor(sourceRegion, displayAnchorRegionId),
        displayAnchorRegionName: getPreferredLogicalRegionDisplayName(
            sourceRegion,
            resolvePreferredRegionDisplayAnchor(sourceRegion, displayAnchorRegionId),
        ),
        maxTroops: Math.max(0, Math.min(6, getNonSiegedCityActionSourceSnapshot(sourceRegion).troops)),
        maxPopulation: Math.min(
            6,
            getQidahenEffectivePopulation(
                sourceRegion,
                getNonSiegedCityActionSourceSnapshot(sourceRegion).population,
            ),
        ),
        candidateCardIds,
        selectedCardId: selectedCardId && candidateCardIds.includes(selectedCardId) ? selectedCardId : null,
        candidates,
    };
};

export const getQidahenInternalDispatchSelectionForCore = (
    state: QidahenCore,
): QidahenInternalDispatchSelection | null => {
    if (state.turnPhase !== 'internal-dispatch-choice') {
        return null;
    }
    const currentFactionId = getCurrentFactionId(state);
    if (currentFactionId !== 'ming' || !hasActiveCharacter(state, 'ming', 'ming-wang-huazhen')) {
        return null;
    }
    return buildWangHuazhenInternalDispatchSelectionFromRegionSemantics(
        state,
        getQidahenExplicitRegionSelectionSemantics(state, state.selectedRegionId),
    );
};

export const getPreferredDispatchSourceRegionIdForSemantics = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    movementProfileId: QidahenMovementProfileId,
    dispatchRegionSemantics: Pick<QidahenWheelDispatchSelectionRegionSemantics, 'preferredSourceRegionId'>,
): string => {
    const preferredSourceRegionId = dispatchRegionSemantics.preferredSourceRegionId;
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const getRegionDispatchSourceSnapshot = (
        region: QidahenCore['regions'][number],
    ): Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'> | null => {
        const siegeSource = getRegionSiegeAttackerForceSnapshot(region, factionId);
        if (siegeSource) {
            return siegeSource;
        }
        if (!isRegionControlledByFaction(region, factionId) || !isRegionAvailableForNonDispatchAction(region)) {
            return null;
        }
        return materializeNonSiegedCityActionSourceRegion(region);
    };
    const getDispatchScore = (region: QidahenCore['regions'][number]): number => {
        const sourceSnapshot = getRegionDispatchSourceSnapshot(region);
        return sourceSnapshot ? getMovableTroopCountForProfile(sourceSnapshot, movementProfileId) : 0;
    };
    const compareDispatchRegion = (
        left: QidahenCore['regions'][number],
        right: QidahenCore['regions'][number],
    ) => {
        const leftScore = getDispatchScore(left);
        const rightScore = getDispatchScore(right);
        const leftSiegeTroops = left.siegeState?.attackerFactionId === factionId ? left.siegeState.attackerTroops : 0;
        const rightSiegeTroops = right.siegeState?.attackerFactionId === factionId ? right.siegeState.attackerTroops : 0;
        const leftSource = getNonSiegedCityActionSourceSnapshot(left);
        const rightSource = getNonSiegedCityActionSourceSnapshot(right);
        return rightScore - leftScore
            || rightSiegeTroops - leftSiegeTroops
            || rightSource.troops - leftSource.troops
            || getQidahenEffectivePopulation(right, rightSource.population)
                - getQidahenEffectivePopulation(left, leftSource.population)
            || left.name.localeCompare(right.name, 'zh-CN');
    };

    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(preferredSourceRegionId);
    const selectedRuntimeRegion = runtimeRegions.find((region) => region.id === selectedRuntimeRegionId) ?? null;
    const preferredSiegeSourceRegion = runtimeRegions
        .filter((region) => region.siegeState?.attackerFactionId === factionId && getDispatchScore(region) > 0)
        .sort(compareDispatchRegion)
        .at(0);
    if (state.turnPhase === 'dispatch-targeting' && preferredSiegeSourceRegion) {
        return preferredSiegeSourceRegion.id;
    }
    if (selectedRuntimeRegion && getDispatchScore(selectedRuntimeRegion) > 0) {
        return selectedRuntimeRegion.id;
    }
    if (preferredSiegeSourceRegion) {
        return preferredSiegeSourceRegion.id;
    }

    const preferredControlledSourceRegion = runtimeRegions
        .filter((region) => (
            isRegionControlledByFaction(region, factionId)
            && isRegionAvailableForNonDispatchAction(region)
            && getDispatchScore(region) > 0
        ))
        .sort(compareDispatchRegion)
        .at(0);
    return preferredControlledSourceRegion?.id ?? preferredSourceRegionId;
};

const compareWheelDispatchCandidate = (
    left: QidahenWheelDispatchCandidate,
    right: QidahenWheelDispatchCandidate,
) => {
    const leftEnemy = left.defenderFactionId !== 'neutral' ? 0 : 1;
    const rightEnemy = right.defenderFactionId !== 'neutral' ? 0 : 1;
    return leftEnemy - rightEnemy
        || left.totalTravelCost - right.totalTravelCost
        || left.pathRegionIds.length - right.pathRegionIds.length
        || right.priorityTroops - left.priorityTroops
        || left.targetRegionName.localeCompare(right.targetRegionName, 'zh-CN');
};

const buildSiegeContinueDispatchSelection = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    movementProfileId: QidahenMovementProfileId,
    selectedRegionId: string,
    actionId: NonNullable<QidahenWheelDispatchSelection['sourceActionId']>,
): QidahenWheelDispatchSelection | null => {
    const explicitOrSelectedRegionId = getQidahenInteractionFocusRegionId(state, selectedRegionId);
    const targetRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === resolveQidahenPrimaryRuntimeRegionId(explicitOrSelectedRegionId)
    ));
    if (
        !targetRegion
        || !isQidahenCityRuntimeRegion(targetRegion.id)
        || !targetRegion.siegeState
        || targetRegion.siegeState.attackerFactionId !== attackerFactionId
    ) {
        return null;
    }

    const sourceForce = getRegionSiegeAttackerForceSnapshot(targetRegion, attackerFactionId);
    if (!sourceForce) {
        return null;
    }
    const sourceAvailableTroops = getMovableTroopCountForProfile(sourceForce, movementProfileId);
    if (sourceAvailableTroops <= 0) {
        return null;
    }

    const passage = targetRegion.siegeState?.sourceRegionId
        ? getQidahenDirectedPassageRule(state, targetRegion.siegeState.sourceRegionId, targetRegion.id, attackerFactionId)
        : null;
    const boundaryUnitCap = passage?.unitCap ?? null;
    const battleWidth = passage?.battleWidth ?? 3;
    const attackBoundaryType = passage?.boundaryType ?? 'plain';
    const committedTroops = computeQidahenEffectiveCommittedTroops({
        actionId: actionId === 'drive-tiger' ? 'drive-tiger' : 'wheel-dispatch',
        availableTroops: sourceAvailableTroops,
        boundaryUnitCap,
        characterCommittedTroopLimit: getQidahenCharacterCommittedTroopLimit(
            state,
            attackerFactionId,
            actionId === 'drive-tiger' ? 'drive-tiger' : 'wheel-dispatch',
        ),
    });
    const attackPressure = computeQidahenAttackPressure(committedTroops, battleWidth);
    if (committedTroops <= 0 || attackPressure <= 0) {
        return null;
    }
    const boundaryLabel = passage?.boundaryLabel ?? getQidahenBoundaryTypeMeta(attackBoundaryType).label;
    const targetRegionName = getPreferredLogicalRegionDisplayName(targetRegion, explicitOrSelectedRegionId);

    return {
        attackerFactionId,
        preferredSourceRegionId: resolvePreferredRegionDisplayAnchor(targetRegion, explicitOrSelectedRegionId),
        sourceActionId: actionId,
        sourceRegionId: targetRegion.siegeState.sourceRegionId,
        sourceRegionName: `${targetRegionName}围城军`,
        displayAnchorRegionId: resolvePreferredRegionDisplayAnchor(targetRegion, explicitOrSelectedRegionId),
        displayAnchorRegionName: `${targetRegionName}围城军`,
        movementProfileId,
        movementProfileLabel: getQidahenMovementProfile(movementProfileId).label,
        restriction: `轮盘进攻/调度 · ${getQidahenMovementProfile(movementProfileId).label}`,
        candidates: [{
            targetRegionId: targetRegion.id,
            targetRegionName,
            targetRuntimeRegionId: targetRegion.id,
            attackerPositionRegionId: targetRegion.id,
            defenderFactionId: targetRegion.controller,
            defenderLabel: targetRegion.controlLabel,
            totalTravelCost: 0,
            battleWidth,
            boundaryUnitCap,
            sourceAvailableTroops,
            committedTroops,
            attackPressure,
            attackBoundaryType,
            priorityTroops: targetRegion.siegeState.attackerTroops,
            resolutionHint: `${targetRegionName} 围城续攻 · ${boundaryLabel} ${battleWidth} · 出兵${committedTroops}/战力${attackPressure}${boundaryUnitCap ? `/限${boundaryUnitCap}` : ''}`,
            pathRegionIds: [targetRegion.id],
            pathLabel: `${targetRegionName} 围城续攻`,
        }],
    };
};

export const buildWheelDispatchSelectionFromRegionSemantics = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    movementProfileId: QidahenMovementProfileId,
    dispatchRegionSemantics: QidahenWheelDispatchSelectionRegionSemantics,
    actionId: NonNullable<QidahenWheelDispatchSelection['sourceActionId']> = 'wheel-dispatch',
): QidahenWheelDispatchSelection | null => {
    const selectedTargetRegionId = dispatchRegionSemantics.selectedTargetRegionId;
    const preferredSourceRegionId = dispatchRegionSemantics.preferredSourceRegionId;
    const siegeContinueSelection = buildSiegeContinueDispatchSelection(
        state,
        attackerFactionId,
        movementProfileId,
        selectedTargetRegionId,
        actionId,
    );
    if (siegeContinueSelection) {
        return siegeContinueSelection;
    }
    const sourceRegionBase = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === resolveQidahenPrimaryRuntimeRegionId(preferredSourceRegionId)
        && region.controller === attackerFactionId
    ));
    if (!sourceRegionBase) {
        return null;
    }
    const sourceRegion = materializeNonSiegedCityActionSourceRegion(sourceRegionBase);
    if (sourceRegion.troops <= 0) {
        return null;
    }

    const movementProfile = getQidahenMovementProfile(movementProfileId);
    const sourceAvailableTroops = getMovableTroopCountForProfile(sourceRegion, movementProfileId);
    if (sourceAvailableTroops <= 0) {
        return null;
    }
    const preferredSourceDisplayRegionId = resolvePreferredRegionDisplayAnchor(
        sourceRegion,
        dispatchRegionSemantics.displayAnchorRegionId,
    );
    const attackRule = getQidahenAttackRuleConfig(
        actionId === 'drive-tiger' ? 'drive-tiger' : 'wheel-dispatch',
    );
    const reachableTargets = findQidahenReachableRuntimeRegions(
        state,
        sourceRegion.id,
        attackerFactionId,
        movementProfile.movementBudget,
        { movementProfileId },
    )
        .filter((target) => {
            const targetRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === target.regionId);
            return targetRuntimeRegion
                ? (!isRegionFriendlyToFaction(targetRuntimeRegion, attackerFactionId) || isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId))
                : false;
        });
    if (reachableTargets.length === 0) {
        return null;
    }
    const candidates = reachableTargets
        .map((target): QidahenWheelDispatchCandidate | null => {
            const previousRegionId = target.pathRegionIds.at(-2) ?? sourceRegion.id;
            const finalPassage = getQidahenDirectedPassageRule(state, previousRegionId, target.regionId, attackerFactionId);
            const finalBoundaryType = finalPassage?.boundaryType ?? target.finalBoundaryType;
            const finalBoundaryLabel = finalPassage?.boundaryLabel ?? getQidahenBoundaryTypeMeta(finalBoundaryType).label;
            const targetRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === target.regionId);
            if (!targetRuntimeRegion) {
                return null;
            }
            const battleWidth = finalPassage?.battleWidth ?? sourceRegion.movementCostByRegionId[targetRuntimeRegion.id] ?? 3;
            const boundaryUnitCap = finalPassage?.unitCap ?? null;
            const committedTroops = computeQidahenEffectiveCommittedTroops({
                actionId: attackRule.id,
                availableTroops: sourceAvailableTroops,
                boundaryUnitCap,
                characterCommittedTroopLimit: getQidahenCharacterCommittedTroopLimit(
                    state,
                    attackerFactionId,
                    attackRule.id,
                ),
            });
            const attackPressure = computeQidahenAttackPressure(committedTroops, battleWidth);
            if (committedTroops <= 0 || attackPressure <= 0) {
                return null;
            }
            const pathLabel = getActionRulePathLabel(state, target.pathRegionIds, preferredSourceDisplayRegionId);
            const targetRegionName = getPreferredLogicalRegionDisplayName(targetRuntimeRegion, selectedTargetRegionId);
            const targetKind = isOwnSiegedCityReinforcementTarget(targetRuntimeRegion, attackerFactionId)
                ? 'siege-reinforce' as const
                : isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId)
                    ? 'siege-attacker' as const
                    : 'region' as const;
            const defenderFactionId = targetKind === 'siege-reinforce'
                ? attackerFactionId
                : targetKind === 'siege-attacker'
                    ? targetRuntimeRegion.siegeState!.attackerFactionId
                    : targetRuntimeRegion.controller;
            const priorityTroops = targetKind === 'siege-reinforce'
                ? targetRuntimeRegion.siegeState?.attackerTroops ?? 0
                : targetKind === 'siege-attacker'
                    ? targetRuntimeRegion.siegeState?.attackerTroops ?? 0
                    : getEffectiveDefenderTroops(targetRuntimeRegion, isQidahenCityRuntimeRegion(targetRuntimeRegion.id) ? 'city' : 'field');
            const battleMode = targetKind === 'siege-attacker' || targetKind === 'siege-reinforce'
                ? 'field' as const
                : isQidahenCityRuntimeRegion(targetRuntimeRegion.id) ? 'city' as const : 'field' as const;
            return {
                battleMode,
                targetKind,
                targetRegionId: targetRuntimeRegion.id,
                targetRegionName,
                targetRuntimeRegionId: targetRuntimeRegion.id,
                defenderFactionId,
                defenderLabel: targetKind === 'siege-reinforce'
                    ? `${toFactionLabel(attackerFactionId)}围城军`
                    : isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId)
                        ? `${toFactionLabel(targetRuntimeRegion.siegeState!.attackerFactionId)}围城军`
                        : targetRuntimeRegion.controlLabel,
                totalTravelCost: target.totalTravelCost,
                battleWidth,
                boundaryUnitCap,
                sourceAvailableTroops,
                committedTroops,
                attackPressure,
                attackBoundaryType: finalBoundaryType,
                priorityTroops,
                resolutionHint: `${pathLabel} · 耗${target.totalTravelCost} · ${finalBoundaryLabel} ${battleWidth} · 出兵${committedTroops}/战力${attackPressure}${boundaryUnitCap ? `/限${boundaryUnitCap}` : ''}${targetKind === 'siege-reinforce' ? ' · 增援围城' : isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId) ? ' · 解围' : ''}`,
                pathRegionIds: [...target.pathRegionIds],
                pathLabel,
            };
        })
        .filter((candidate): candidate is QidahenWheelDispatchCandidate => candidate !== null)
        .sort(compareWheelDispatchCandidate);
    if (candidates.length === 0) {
        return null;
    }

    return {
        attackerFactionId,
        sourceActionId: actionId,
        preferredSourceRegionId: preferredSourceDisplayRegionId,
        sourceRegionId: sourceRegion.id,
        sourceRegionName: getPreferredLogicalRegionDisplayName(sourceRegion, preferredSourceDisplayRegionId),
        displayAnchorRegionId: preferredSourceDisplayRegionId,
        displayAnchorRegionName: getPreferredLogicalRegionDisplayName(sourceRegion, preferredSourceDisplayRegionId),
        movementProfileId,
        movementProfileLabel: movementProfile.label,
        restriction: `轮盘进攻/调度 · ${movementProfile.label}`,
        candidates,
    };
};

export const buildWheelDispatchSelectionFromWheel = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    wheelPositionId: string,
    selectedRegionId: string,
): QidahenWheelDispatchSelection | null => {
    const movementProfileId = wheelDispatchProfileIdByPosition[wheelPositionId];
    if (!movementProfileId) {
        return null;
    }
    const initialDispatchRegionSemantics = getQidahenWheelDispatchSelectionRegionSemantics(
        state,
        selectedRegionId,
        selectedRegionId,
    );
    const preferredSourceRegionId = getPreferredDispatchSourceRegionIdForSemantics(
        state,
        attackerFactionId,
        movementProfileId,
        initialDispatchRegionSemantics,
    );
    return buildWheelDispatchSelectionFromRegionSemantics(
        state,
        attackerFactionId,
        movementProfileId,
        getQidahenWheelDispatchSelectionRegionSemantics(
            state,
            preferredSourceRegionId,
            initialDispatchRegionSemantics.displayAnchorRegionId,
        ),
        'wheel-dispatch',
    );
};

export const getQidahenCurrentWheelDispatchSelectionForCore = (
    state: QidahenCore,
): QidahenWheelDispatchSelection | null => {
    const shouldRebuildDriveTigerDispatchSelection = state.lastFactionActionId === 'drive-tiger'
        && !state.wheelActionUsed;
    if (state.turnPhase !== 'dispatch-targeting') {
        return null;
    }
    if (state.wheelDispatchProgress) {
        return state.wheelDispatchProgress;
    }
    if (shouldRebuildDriveTigerDispatchSelection) {
        return buildDriveTigerDispatchSelectionFromRegionSemantics(
            state,
            DRIVE_TIGER_COMMANDER_FACTION_ID,
            getQidahenLockedRegionSelectionSemantics(state),
        );
    }
    return buildWheelDispatchSelectionFromWheel(
        state,
        getCurrentFactionId(state),
        state.actionWheelPosition,
        state.selectedRegionId,
    );
};

const serializeWheelDispatchSelectionForPersistenceCheck = (
    selection: QidahenWheelDispatchSelection | null,
): string | null => {
    if (!selection) {
        return null;
    }
    return JSON.stringify({
        attackerFactionId: selection.attackerFactionId,
        sourceActionId: selection.sourceActionId ?? null,
        preferredSourceRegionId: selection.preferredSourceRegionId ?? null,
        sourceRegionId: selection.sourceRegionId,
        sourceRegionName: selection.sourceRegionName,
        displayAnchorRegionId: selection.displayAnchorRegionId,
        displayAnchorRegionName: selection.displayAnchorRegionName,
        movementProfileId: selection.movementProfileId,
        movementProfileLabel: selection.movementProfileLabel,
        restriction: selection.restriction,
        candidates: selection.candidates.map((candidate) => ({
            targetRegionId: candidate.targetRegionId,
            targetRegionName: candidate.targetRegionName,
            targetRuntimeRegionId: candidate.targetRuntimeRegionId,
            attackerPositionRegionId: candidate.attackerPositionRegionId,
            defenderFactionId: candidate.defenderFactionId,
            defenderLabel: candidate.defenderLabel,
            totalTravelCost: candidate.totalTravelCost,
            battleWidth: candidate.battleWidth,
            boundaryUnitCap: candidate.boundaryUnitCap ?? null,
            sourceAvailableTroops: candidate.sourceAvailableTroops,
            committedTroops: candidate.committedTroops,
            attackPressure: candidate.attackPressure,
            attackBoundaryType: candidate.attackBoundaryType,
            priorityTroops: candidate.priorityTroops,
            resolutionHint: candidate.resolutionHint,
            pathRegionIds: [...candidate.pathRegionIds],
            pathLabel: candidate.pathLabel,
        })),
    });
};

export const shouldPersistExplicitWheelDispatchSelectionForWheelState = (
    state: QidahenCore,
    selection: QidahenWheelDispatchSelection,
    wheelPositionId: string,
): boolean => {
    const sourceAnchoredState: QidahenCore = {
        ...state,
        selectedRegionId: selection.sourceRegionId,
        turnPhase: 'dispatch-targeting',
        wheelDispatchProgress: null,
    };
    const rebuiltSelection = buildWheelDispatchSelectionFromWheel(
        sourceAnchoredState,
        selection.attackerFactionId,
        wheelPositionId,
        selection.sourceRegionId,
    );
    return serializeWheelDispatchSelectionForPersistenceCheck(rebuiltSelection)
        !== serializeWheelDispatchSelectionForPersistenceCheck(selection);
};

export const buildKhanEdictDispatchSelection = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    dispatchRegionSemantics: QidahenWheelDispatchSelectionRegionSemantics,
): QidahenWheelDispatchSelection | null => {
    const preferredRegionId = getPreferredDispatchSourceRegionIdForSemantics(
        state,
        attackerFactionId,
        'dispatch-cavalry',
        dispatchRegionSemantics,
    );
    const selection = buildWheelDispatchSelectionFromRegionSemantics(
        state,
        attackerFactionId,
        'dispatch-cavalry',
        {
            ...dispatchRegionSemantics,
            preferredSourceRegionId: preferredRegionId,
        },
        'khan-edict',
    );
    return selection
        ? {
            ...selection,
            restriction: '大汗令箭 · 调骑 4（免支付）',
        }
        : null;
};

export const buildDriveTigerDispatchSelectionFromRegionSemantics = (
    state: QidahenCore,
    commanderFactionId: QidahenFactionId,
    regionSemantics: QidahenExplicitRegionSelectionSemantics,
    preferredSourceRegionId?: string | null,
): QidahenWheelDispatchSelection | null => {
    const explicitOrSelectedRegionId = regionSemantics.targetRegionId;
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(explicitOrSelectedRegionId);
    const selectedRuntimeRegion = runtimeRegions.find((region) => region.id === selectedRuntimeRegionId) ?? null;
    const directTargetFactionId = selectedRuntimeRegion?.siegeState?.attackerFactionId ?? selectedRuntimeRegion?.controller;
    const targetRegion = (
        directTargetFactionId != null
        && directTargetFactionId !== 'neutral'
        && directTargetFactionId !== commanderFactionId
    )
        ? selectedRuntimeRegion
        : runtimeRegions.find((region) => (
            region.siegeState?.sourceRegionId === selectedRuntimeRegionId
            && region.siegeState.attackerFactionId !== commanderFactionId
        )) ?? null;
    const targetFactionId = targetRegion?.siegeState?.attackerFactionId ?? targetRegion?.controller;
    if (
        targetFactionId == null
        || targetFactionId === 'neutral'
        || targetFactionId === commanderFactionId
        || targetRegion == null
    ) {
        return null;
    }
    const sourceRegionSemantics: QidahenWheelDispatchSelectionRegionSemantics = {
        selectedTargetRegionId: targetRegion.id,
        preferredSourceRegionId: preferredSourceRegionId ?? targetRegion.id,
        displayAnchorRegionId: preferredSourceRegionId ?? (
            targetRegion.id === selectedRuntimeRegionId
                ? targetRegion.id
                : selectedRuntimeRegionId
        ),
    };
    const preferredRegionId = getPreferredDispatchSourceRegionIdForSemantics(
        state,
        targetFactionId,
        'dispatch-cavalry',
        sourceRegionSemantics,
    );
    const selection = buildWheelDispatchSelectionFromRegionSemantics(
        state,
        targetFactionId,
        'dispatch-cavalry',
        {
            ...sourceRegionSemantics,
            preferredSourceRegionId: preferredRegionId,
        },
        'drive-tiger',
    );
    return selection
        ? {
            ...selection,
            restriction: `驱虎吞狼 · 指挥${state.factions[targetFactionId].name}调度进攻`,
        }
        : null;
};
