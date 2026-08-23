import { getQidahenBoundaryTypeMeta } from '../ui/mapGraph';
import {
    isQidahenCityRuntimeRegion,
    isQidahenKoreaRuntimeRegionId,
    isQidahenRuleRegionEquivalent,
    resolveQidahenPrimaryRuntimeRegionId,
    resolveQidahenRuleRegionConfig,
} from './regionConfig';
import {
    isRegionFriendlyToFaction,
    getBattleRegionSnapshot,
} from './battleState';
import {
    getNonSiegedCityActionSourceSnapshot,
    materializeNonSiegedCityActionSourceRegion,
} from './actionSourceRegionState';
import { getPreferredLogicalRegionDisplayName } from './regionRuleSemantics';
import { toFactionLabel } from './factionLabelSemantics';
import {
    isFriendlySiegedCityTarget,
    isRegionAvailableForNonDispatchAction,
    isRegionUnderSiege,
} from './regionSelectionPreferences';
import { getQidahenDirectedPassageRule } from './movement';
import { getQidahenCharacterCommittedTroopLimit } from './pendingBattleCommittedTroops';
import { getQidahenEffectivePopulation } from './populationRules';
import {
    computeQidahenAttackPressure,
    computeQidahenEffectiveCommittedTroops,
} from './attackRules';
import { createQidahenBattleForceCommitment } from './battleForceCommitments';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
} from './types';

const computeMarriageSubjugationPayCost = (
    state: QidahenCore,
    targetRegion: QidahenCore['regions'][number],
): number => {
    const shanhaiguanAlive = !state.fortifications.find((fortification) => fortification.id === 'shanhaiguan')?.ruined;
    const exemptTroops = isQidahenRuleRegionEquivalent(targetRegion.id, 'liao-xi') && shanhaiguanAlive ? 2 : 0;
    const targetBattleRegion = getBattleRegionSnapshot(targetRegion, 'city');
    return Math.max(0, (targetBattleRegion.troops - exemptTroops) * 2);
};

export const getMarriageSubjugationBlockedReason = (
    state: QidahenCore,
    selectedRegion: QidahenCore['regions'][number] | undefined,
): string | null => {
    if (!selectedRegion) {
        return '当前没有选中可执行联姻诱降的目标区域。';
    }
    const targetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegion.id);
    const targetRuleRegionConfig = resolveQidahenRuleRegionConfig(targetRuntimeRegionId);
    const targetRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === targetRuntimeRegionId);
    const targetDisplayName = targetRuntimeRegion
        ? getPreferredLogicalRegionDisplayName(targetRuntimeRegion, selectedRegion.id)
        : selectedRegion.name;
    if (targetRuntimeRegion && isRegionUnderSiege(targetRuntimeRegion)) {
        return `${targetDisplayName} 当前处于围城状态，只允许调度进攻，不能执行联姻诱降。`;
    }
    if (targetRuleRegionConfig.capitalOf != null) {
        return `${targetDisplayName} 属于首都区域，当前联姻诱降不能指定首都。`;
    }
    if (isQidahenKoreaRuntimeRegionId(targetRuntimeRegionId)) {
        return `${targetDisplayName} 位于朝鲜/长城以南区域，当前联姻诱降不能指定该区域。`;
    }
    if (targetRuleRegionConfig.tags.includes('south-of-wall')) {
        return `${targetDisplayName} 位于长城以南区域，当前联姻诱降不能指定该区域。`;
    }
    return null;
};

export const buildPendingTargetAction = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    actionId: 'raid' | 'marriage-subjugation',
    selectedRegion: QidahenCore['regions'][number] | undefined,
    selectedRegionId: string,
): QidahenPendingTargetAction | null => {
    if (!selectedRegion) {
        return null;
    }
    if (actionId === 'marriage-subjugation' && getMarriageSubjugationBlockedReason(state, selectedRegion)) {
        return null;
    }

    const resolvedSelectedRegion = (() => {
        if (actionId !== 'raid') {
            return selectedRegion;
        }
        const getRaidFallbackTargetSnapshot = (
            region: QidahenCore['regions'][number],
        ): Pick<QidahenCore['regions'][number], 'troops' | 'population'> => {
            if (isFriendlySiegedCityTarget(region, attackerFactionId) && region.siegeState) {
                return {
                    troops: region.siegeState.attackerTroops,
                    population: 0,
                };
            }
            const regionSnapshot = getNonSiegedCityActionSourceSnapshot(region);
            return {
                troops: regionSnapshot.troops,
                population: getQidahenEffectivePopulation(region, regionSnapshot.population),
            };
        };
        const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegion.id);
        const selectedRuntimeRegion = state.regions.find((region) => region.id === selectedRuntimeRegionId && !region.isLogicalRegion);
        if (
            !selectedRuntimeRegion
            || selectedRuntimeRegion.controller !== attackerFactionId
            || !isRegionAvailableForNonDispatchAction(selectedRuntimeRegion)
        ) {
            return selectedRegion;
        }
        const fallbackTarget = selectedRuntimeRegion.adjacentRegionIds
            .map((regionId) => state.regions.find((region) => region.id === regionId && !region.isLogicalRegion))
            .filter((region): region is NonNullable<typeof region> => {
                if (region == null) {
                    return false;
                }
                const isFriendlySiegeTarget = isFriendlySiegedCityTarget(region, attackerFactionId);
                if (!isFriendlySiegeTarget && isRegionFriendlyToFaction(region, attackerFactionId)) {
                    return false;
                }
                if (!isFriendlySiegeTarget && !isRegionAvailableForNonDispatchAction(region)) {
                    return false;
                }
                const passage = getQidahenDirectedPassageRule(state, selectedRuntimeRegion.id, region.id, attackerFactionId);
                return Boolean(passage?.usable);
            })
            .sort((left, right) => {
                const leftSource = getRaidFallbackTargetSnapshot(left);
                const rightSource = getRaidFallbackTargetSnapshot(right);
                return rightSource.troops - leftSource.troops
                    || rightSource.population - leftSource.population
                    || left.name.localeCompare(right.name, 'zh-CN');
            })[0];
        return fallbackTarget ?? selectedRegion;
    })();

    const targetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(resolvedSelectedRegion.id);
    const targetRuntimeRegion = state.regions.find((region) => region.id === targetRuntimeRegionId && !region.isLogicalRegion);
    const isFriendlySiegeTarget = isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId);
    if (
        !targetRuntimeRegion
        || (!isFriendlySiegeTarget && isRegionFriendlyToFaction(targetRuntimeRegion, attackerFactionId))
        || (!isFriendlySiegeTarget && !isRegionAvailableForNonDispatchAction(targetRuntimeRegion))
    ) {
        return null;
    }

    const sourceRegion = targetRuntimeRegion.adjacentRegionIds
        .map((regionId) => state.regions.find((region) => region.id === regionId && !region.isLogicalRegion))
        .filter((region): region is NonNullable<typeof region> => {
            if (
                region == null
                || !isRegionFriendlyToFaction(region, attackerFactionId)
                || !isRegionAvailableForNonDispatchAction(region)
            ) {
                return false;
            }
            const passage = getQidahenDirectedPassageRule(state, region.id, targetRuntimeRegionId, attackerFactionId);
            return Boolean(passage?.usable);
        })
        .map((region) => materializeNonSiegedCityActionSourceRegion(region))
        .sort((left, right) => right.troops - left.troops || left.name.localeCompare(right.name, 'zh-CN'))[0];
    if (!sourceRegion) {
        return null;
    }

    const directedPassage = getQidahenDirectedPassageRule(state, sourceRegion.id, targetRuntimeRegionId, attackerFactionId);
    if (!directedPassage) {
        return null;
    }
    const battleWidth = directedPassage.battleWidth ?? sourceRegion.movementCostByRegionId[targetRuntimeRegionId] ?? 3;
    const attackBoundaryType = directedPassage.boundaryType ?? sourceRegion.boundaryTypeByRegionId[targetRuntimeRegionId] ?? 'plain';
    const attackBoundaryLabel = directedPassage.boundaryLabel ?? getQidahenBoundaryTypeMeta(attackBoundaryType).label;
    const defenderPayCost = actionId === 'marriage-subjugation'
        ? computeMarriageSubjugationPayCost(state, targetRuntimeRegion)
        : null;
    const boundaryUnitCap = directedPassage.unitCap ?? null;
    const committedTroops = actionId === 'raid'
        ? computeQidahenEffectiveCommittedTroops({
            actionId: 'raid',
            availableTroops: sourceRegion.troops,
            boundaryUnitCap,
            characterCommittedTroopLimit: getQidahenCharacterCommittedTroopLimit(
                state,
                attackerFactionId,
                'raid',
            ),
        })
        : 0;
    const attackPressure = actionId === 'raid'
        ? computeQidahenAttackPressure(committedTroops, battleWidth)
        : 0;
    if (actionId === 'raid' && (committedTroops <= 0 || attackPressure <= 0)) {
        return null;
    }
    const targetKind = isFriendlySiegeTarget ? 'siege-attacker' as const : 'region' as const;
    const battleMode = targetKind === 'siege-attacker'
        ? 'field' as const
        : isQidahenCityRuntimeRegion(targetRuntimeRegionId) ? 'city' as const : 'field' as const;
    const defenderFactionId = targetKind === 'siege-attacker'
        ? targetRuntimeRegion.siegeState!.attackerFactionId
        : targetRuntimeRegion.controller;
    const defenderLabel = targetKind === 'siege-attacker'
        ? `${toFactionLabel(targetRuntimeRegion.siegeState!.attackerFactionId)}围城军`
        : targetRuntimeRegion.controlLabel;
    const sourceRegionName = getPreferredLogicalRegionDisplayName(sourceRegion, selectedRegionId);
    const targetRegionName = getPreferredLogicalRegionDisplayName(resolvedSelectedRegion, selectedRegionId);
    const resolutionHint = actionId === 'raid'
        ? `${sourceRegionName} → ${targetRegionName} · ${attackBoundaryLabel} ${battleWidth} · 出兵${committedTroops}/战力${attackPressure}${boundaryUnitCap ? `/限${boundaryUnitCap}` : ''}${targetKind === 'siege-attacker' ? ' · 解围' : ''}`
        : `${sourceRegionName} → ${targetRegionName} · ${attackBoundaryLabel} ${battleWidth}`;

    return {
        actionId,
        battleMode,
        targetKind,
        title: actionId === 'raid' ? '突袭待结算' : '联姻待结算',
        attackerFactionId,
        sourceRegionId: sourceRegion.id,
        sourceRegionName,
        targetRegionId: resolvedSelectedRegion.id,
        targetRegionName,
        targetRuntimeRegionId,
        defenderFactionId,
        defenderLabel,
        restriction: actionId === 'raid' ? '仅进攻行动' : '邻近控制区域',
        battleWidth,
        boundaryUnitCap,
        sourceAvailableTroops: sourceRegion.troops,
        committedTroops,
        movementProfileId: null,
        attackPressure,
        attackBoundaryType,
        resolutionHint,
        defenderPayCost,
        forceCommitments: [createQidahenBattleForceCommitment({
            sourceRegionId: sourceRegion.id,
            sourceRegionName,
            sourceAvailableTroops: sourceRegion.troops,
            committedTroops,
            movementProfileId: null,
            battleWidth,
            boundaryUnitCap,
            attackBoundaryType,
        })],
    };
};
