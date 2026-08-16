import {
    materializeNonSiegedCityActionSourceRegion,
} from './actionSourceRegionState';
import {
    getCityPopulationState,
    getPendingActionSourceForceSnapshot,
    getPostBattlePlunderPopulationCap,
} from './battleState';
import { getAttackerDeckPlunderHandBonus } from './characterAbilitySemantics';
import { getRegionControlLabel, toFactionLabel } from './factionLabelSemantics';
import {
    addFactionHandCards,
    buildDrawnHandCards,
    drawFromFactionPile,
    drawKoreaCardsForFaction,
    getFactionDrawPileCount,
} from './handCardState';
import { getEffectiveKoreaTributeCardsForFaction } from './koreaTributeRules';
import {
    applyCasualtyPriorityToRegion,
    applyCommittedTroopRemovalToRegion,
    getSurvivingCommittedSpecialTroops,
} from './pendingBattleCombatSupport';
import {
    getActionRuleDisplayRegionName,
} from './regionRuleSemantics';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import {
    addSpecialTroopStacksToRegion,
    cloneCityStateAsPieceSnapshot,
    mergeSpecialTroopStackGroupsAsPieces,
} from './troopCompat';
import type {
    QidahenBattleCasualtyPriority,
    QidahenBattleForceOutcome,
    QidahenCore,
    QidahenFactionId,
    QidahenPostBattleSelection,
    QidahenSpecialTroopStack,
} from './types';
import { isQidahenCityRuntimeRegion } from './regionConfig';

type QidahenRuntimeRegion = QidahenCore['regions'][number];

interface QidahenPostBattleResolutionDependencies {
    toFactionLabel: (
        controller: QidahenFactionId | 'neutral',
    ) => string;
    getActionRuleDisplayRegionName: (
        region: QidahenRuntimeRegion,
        fallbackName?: string,
    ) => string;
    getFactionDrawPileCount: (
        state: QidahenCore,
        factionId: QidahenFactionId,
    ) => number;
    getSurvivingCommittedSpecialTroops: (
        sourceRegion: Pick<QidahenRuntimeRegion, 'specialTroops'> | null,
        committedTroops: number,
        attackerLosses: number,
        movementProfileId?: string | null,
        attackerCasualtyPriority?: QidahenBattleCasualtyPriority,
    ) => QidahenSpecialTroopStack[];
    applyCommittedTroopRemovalToRegion: (
        region: QidahenRuntimeRegion,
        committedTroops: number,
        movementProfileId?: string | null,
        selectedSpecialPieceIds?: readonly string[],
    ) => QidahenRuntimeRegion;
    applyCasualtyPriorityToRegion: (
        region: QidahenRuntimeRegion,
        losses: number,
        movementProfileId?: string | null,
        casualtyPriority?: QidahenBattleCasualtyPriority,
    ) => QidahenRuntimeRegion;
    getRegionControlLabel: (
        region: QidahenRuntimeRegion,
    ) => string;
    refreshRuntimeRegionRules: (
        runtimeRegions: QidahenRuntimeRegion[],
        fortifications: QidahenCore['fortifications'],
    ) => QidahenCore['regions'];
    materializeNonSiegedCityActionSourceRegion: (
        region: QidahenRuntimeRegion,
    ) => QidahenRuntimeRegion;
    drawFromFactionPile: (
        factions: QidahenCore['factions'],
        sourceFactionId: QidahenFactionId,
        requestedCards: number,
        discardGain?: number,
    ) => {
        factions: QidahenCore['factions'];
        drawnCards: number;
    };
    buildDrawnHandCards: (
        state: QidahenCore,
        factionId: QidahenFactionId,
        drawCards: number,
    ) => QidahenCore['handCards'];
    addFactionHandCards: (
        factions: QidahenCore['factions'],
        factionId: QidahenFactionId,
        drawCards: number,
    ) => QidahenCore['factions'];
    drawKoreaCardsForFaction: (
        factions: QidahenCore['factions'],
        koreaDeckCount: number,
        factionId: QidahenFactionId,
        requestedCards: number,
    ) => {
        factions: QidahenCore['factions'];
        koreaDeckCount: number;
        drawnCards: number;
    };
    getEffectiveKoreaTributeCardsForFaction: (
        state: QidahenCore,
        factionId: QidahenFactionId,
        regionId: string,
    ) => number;
}

export type QidahenPostBattleDecisionResolution = Pick<
    QidahenCore,
    'regions' | 'factions' | 'koreaDeckCount' | 'drawPileCount' | 'discardPileCount' | 'handCards'
> & {
    logText: string;
    selectedRegionId: string;
};

export const resolvePostBattleDecision = (
    state: QidahenCore,
    selection: QidahenPostBattleSelection,
    choiceId: string,
    dependencies: QidahenPostBattleResolutionDependencies = {
        toFactionLabel,
        getActionRuleDisplayRegionName,
        getFactionDrawPileCount,
        getSurvivingCommittedSpecialTroops,
        applyCommittedTroopRemovalToRegion,
        applyCasualtyPriorityToRegion,
        getRegionControlLabel,
        refreshRuntimeRegionRules,
        materializeNonSiegedCityActionSourceRegion,
        drawFromFactionPile,
        buildDrawnHandCards,
        addFactionHandCards,
        drawKoreaCardsForFaction,
        getEffectiveKoreaTributeCardsForFaction,
    },
): QidahenPostBattleDecisionResolution => {
    const choice = selection.choices.find((item) => item.id === choiceId) ?? selection.choices[0];
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRegion = runtimeRegions.find((region) => region.id === selection.targetRuntimeRegionId);
    if (!choice || !targetRegion) {
        return {
            regions: state.regions,
            factions: state.factions,
            koreaDeckCount: state.koreaDeckCount,
            drawPileCount: state.drawPileCount,
            discardPileCount: state.discardPileCount,
            handCards: state.handCards,
            logText: `${state.factions[selection.attackerFactionId].name} 完成战后处理。`,
            selectedRegionId: state.selectedRegionId,
        };
    }

    const withdrawRegionId = choice.mode === 'withdraw' ? choice.regionId : null;
    const battleMode = selection.battleMode ?? (isQidahenCityRuntimeRegion(targetRegion.id) ? 'city' : 'field');
    const cityPopulationState = getCityPopulationState(targetRegion, battleMode);
    const plunderPopulationCap = getPostBattlePlunderPopulationCap(targetRegion, battleMode, choice.mode);
    const plunderPopulation = Math.min(choice.plunderPopulation, plunderPopulationCap);
    const occupiedPopulation = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? Math.max(0, cityPopulationState.totalPopulation - plunderPopulation)
        : Math.max(0, targetRegion.population - plunderPopulation);
    const besiegedOutsidePopulation = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? Math.max(0, cityPopulationState.outsidePopulation - plunderPopulation)
        : Math.max(0, targetRegion.population - plunderPopulation);
    const besiegedCityPopulation = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? cityPopulationState.insidePopulation
        : Math.max(0, Math.min(2, targetRegion.population));
    const withdrawnCityPopulation = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? Math.max(0, cityPopulationState.totalPopulation - plunderPopulation)
        : Math.max(0, targetRegion.population - plunderPopulation);
    const preservedCityState = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? cloneCityStateAsPieceSnapshot(targetRegion) ?? {
            troops: 0,
            population: 0,
            specialTroops: [],
        }
        : null;
    const plunderSourceFactionId = choice.plunderSource === 'defender' && selection.originalController !== 'neutral'
        ? selection.originalController
        : selection.attackerFactionId;
    const plunderRequestedCards = plunderPopulation > 0
        ? choice.plunderSource === 'defender' ? plunderPopulation : plunderPopulation * 2
        : 0;
    const plunderAvailableCards = dependencies.getFactionDrawPileCount(state, plunderSourceFactionId);
    const plunderDrawCards = Math.min(plunderRequestedCards, plunderAvailableCards);
    const attackerDeckPlunderHandBonus = choice.plunderSource === 'attacker'
        ? getAttackerDeckPlunderHandBonus(state, selection.attackerFactionId, plunderPopulation)
        : 0;
    const plunderHandGain = choice.plunderSource === 'defender'
        ? plunderDrawCards
        : Math.min(plunderPopulation + attackerDeckPlunderHandBonus, plunderDrawCards);
    const plunderDiscardGain = Math.max(0, plunderDrawCards - plunderHandGain);
    const plunderText = plunderPopulation > 0
        ? choice.plunderSource === 'defender'
            ? `并劫掠 ${selection.targetRegionName} ${plunderPopulation} 人口，抽${dependencies.toFactionLabel(selection.originalController)}牌堆获得 ${plunderHandGain} 张手牌`
            : `并劫掠 ${selection.targetRegionName} ${plunderPopulation} 人口，获得 ${plunderHandGain} 张手牌、弃牌堆 +${plunderDiscardGain}${attackerDeckPlunderHandBonus > 0 ? '（含人物额外摸牌）' : ''}`
        : '';
    const sourceRemovalRegionId = selection.attackerPositionRegionId ?? selection.sourceRegionId;
    const sourceRegion = selection.attackerPositionRegionId
        ? getPendingActionSourceForceSnapshot(state, {
            actionId: selection.actionId,
            title: selection.title,
            attackerFactionId: selection.attackerFactionId,
            sourceRegionId: selection.sourceRegionId,
            sourceRegionName: selection.sourceRegionName,
            attackerPositionRegionId: selection.attackerPositionRegionId,
            targetRegionId: selection.targetRegionId,
            targetRegionName: selection.targetRegionName,
            targetRuntimeRegionId: selection.targetRuntimeRegionId,
            defenderFactionId: selection.originalController,
            defenderLabel: selection.originalControlLabel,
            restriction: '',
            battleWidth: selection.survivingTroops,
            boundaryUnitCap: null,
            sourceAvailableTroops: selection.committedTroops,
            committedTroops: selection.committedTroops,
            attackPressure: selection.survivingTroops,
            attackBoundaryType: 'plain',
            resolutionHint: '',
            defenderPayCost: null,
            ...(selection.battleMode ? { battleMode: selection.battleMode } : {}),
            ...(selection.targetKind ? { targetKind: selection.targetKind } : {}),
            ...(selection.movementProfileId != null ? { movementProfileId: selection.movementProfileId } : {}),
        })
        : (() => {
            const sourceRuntimeRegion = runtimeRegions.find((region) => region.id === sourceRemovalRegionId) ?? null;
            return sourceRuntimeRegion ? dependencies.materializeNonSiegedCityActionSourceRegion(sourceRuntimeRegion) : null;
        })();
    const survivingSpecialTroops = dependencies.getSurvivingCommittedSpecialTroops(
        sourceRegion,
        selection.committedTroops,
        selection.attackerLosses,
        selection.movementProfileId,
        selection.attackerBattleCasualtyPriority ?? selection.attackerCasualtyPriority,
    );
    const forceOutcomes: QidahenBattleForceOutcome[] = selection.forceOutcomes?.length
        ? selection.forceOutcomes.map((outcome) => ({
            ...outcome,
            survivingSpecialTroops: outcome.survivingSpecialTroops.map((stack) => ({ ...stack })),
        }))
        : [{
            id: `force-${sourceRemovalRegionId}`,
            sourceRegionId: sourceRemovalRegionId,
            sourceRegionName: state.regions.find((region) => region.id === sourceRemovalRegionId)?.name
                ?? selection.sourceRegionName,
            sourceAvailableTroops: selection.committedTroops,
            committedTroops: selection.committedTroops,
            movementProfileId: selection.movementProfileId ?? null,
            battleWidth: selection.committedTroops,
            boundaryUnitCap: null,
            attackBoundaryType: 'plain',
            attackerLosses: selection.attackerLosses,
            survivingTroops: selection.survivingTroops,
            survivingSpecialTroops,
        }];
    const mergedSurvivingSpecialTroops = mergeSpecialTroopStackGroupsAsPieces(
        ...forceOutcomes.map((outcome) => outcome.survivingSpecialTroops),
    );
    const nextRuntimeRegions = runtimeRegions.map((region) => {
        const sourceOutcomes = forceOutcomes.filter((outcome) => outcome.sourceRegionId === region.id);
        if (sourceOutcomes.length > 0 && region.id !== selection.targetRuntimeRegionId) {
            let sourceActionRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            const committedTroops = sourceOutcomes.reduce((total, outcome) => total + outcome.committedTroops, 0);
            const attackerLosses = sourceOutcomes.reduce((total, outcome) => total + outcome.attackerLosses, 0);
            const survivingTroops = sourceOutcomes.reduce((total, outcome) => total + outcome.survivingTroops, 0);
            if (choice.mode === 'occupy' || choice.mode === 'besiege') {
                for (const outcome of sourceOutcomes) {
                    sourceActionRegion = dependencies.applyCommittedTroopRemovalToRegion({
                        ...sourceActionRegion,
                        troops: Math.max(0, sourceActionRegion.troops - outcome.committedTroops),
                    }, outcome.committedTroops, outcome.movementProfileId, outcome.selectedSpecialPieceIds);
                }
                return {
                    ...sourceActionRegion,
                    note: `${sourceActionRegion.name} 战后派出 ${survivingTroops} 个幸存部队${choice.mode === 'occupy' ? '占领' : '围困'} ${selection.targetRegionName}；本来源投入 ${committedTroops}，损失 ${attackerLosses}。`,
                };
            }
            if (choice.mode === 'withdraw' && withdrawRegionId === region.id) {
                for (const outcome of sourceOutcomes) {
                    sourceActionRegion = dependencies.applyCasualtyPriorityToRegion({
                        ...sourceActionRegion,
                        troops: Math.max(0, sourceActionRegion.troops - outcome.attackerLosses),
                    }, outcome.attackerLosses, outcome.movementProfileId, selection.attackerBattleCasualtyPriority ?? selection.attackerCasualtyPriority);
                }
                const incomingOutcomes = forceOutcomes.filter((outcome) => outcome.sourceRegionId !== region.id);
                const incomingTroops = incomingOutcomes.reduce((total, outcome) => total + outcome.survivingTroops, 0);
                const incomingSpecialTroops = mergeSpecialTroopStackGroupsAsPieces(
                    ...incomingOutcomes.map((outcome) => outcome.survivingSpecialTroops),
                );
                if (incomingTroops > 0) {
                    sourceActionRegion = addSpecialTroopStacksToRegion({
                        ...sourceActionRegion,
                        troops: sourceActionRegion.troops + incomingTroops,
                    }, incomingSpecialTroops);
                }
                return {
                    ...sourceActionRegion,
                    note: `${sourceActionRegion.name} 战后保留本来源 ${survivingTroops} 个幸存部队${incomingTroops > 0 ? `，并接收其他来源 ${incomingTroops} 个幸存部队` : ''}；本来源损失 ${attackerLosses}。`,
                };
            }
            if (choice.mode === 'withdraw' && withdrawRegionId !== region.id) {
                for (const outcome of sourceOutcomes) {
                    sourceActionRegion = dependencies.applyCommittedTroopRemovalToRegion({
                        ...sourceActionRegion,
                        troops: Math.max(0, sourceActionRegion.troops - outcome.committedTroops),
                    }, outcome.committedTroops, outcome.movementProfileId, outcome.selectedSpecialPieceIds);
                }
                return {
                    ...sourceActionRegion,
                    note: `${sourceActionRegion.name} 战后撤出 ${survivingTroops} 个幸存部队，改退回 ${state.regions.find((item) => item.id === withdrawRegionId)?.name ?? '友方区域'}；本来源损失 ${attackerLosses}。`,
                };
            }
            return region;
        }
        if (region.id === selection.targetRuntimeRegionId) {
            if (selection.targetKind === 'siege-attacker') {
                const relievedRegion = {
                    ...region,
                    controller: selection.originalController,
                    controlLabel: selection.originalControlLabel,
                    troops: selection.survivingTroops,
                    specialTroops: mergedSurvivingSpecialTroops,
                    siegeState: null,
                    note: `${region.name} 围城已解除，${selection.survivingTroops} 个幸存援军进驻城外。`,
                };
                return {
                    ...relievedRegion,
                    controlLabel: dependencies.getRegionControlLabel(relievedRegion),
                };
            }
            if (choice.mode === 'occupy') {
                const occupiedRegion = {
                    ...region,
                    controller: selection.attackerFactionId,
                    diplomacyMarkerFaction: selection.originalController === 'neutral' ? selection.attackerFactionId : null,
                    diplomacyMarkerSide: selection.originalController === 'neutral' ? 'vassal' as const : null,
                    population: occupiedPopulation,
                    troops: selection.survivingTroops,
                    siegeState: null,
                    cityState: null,
                    specialTroops: mergedSurvivingSpecialTroops,
                    note: `${region.name} 被攻下后由 ${selection.originalController === 'neutral' ? `${dependencies.toFactionLabel(selection.attackerFactionId)}附庸` : dependencies.toFactionLabel(selection.attackerFactionId)} 占领，并进驻 ${selection.survivingTroops} 个幸存部队${plunderPopulation > 0 ? `，劫掠移除 ${plunderPopulation} 人口` : ''}。`,
                };
                return {
                    ...occupiedRegion,
                    controlLabel: dependencies.getRegionControlLabel(occupiedRegion),
                };
            }
            if (choice.mode === 'besiege') {
                const besiegedRegion = {
                    ...region,
                    population: besiegedOutsidePopulation,
                    troops: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: selection.attackerFactionId,
                        attackerTroops: selection.survivingTroops,
                        attackerSpecialTroops: mergedSurvivingSpecialTroops,
                        sourceRegionId: selection.sourceRegionId,
                    },
                    cityState: isQidahenCityRuntimeRegion(region.id)
                        ? {
                            troops: preservedCityState?.troops ?? 0,
                            population: besiegedCityPopulation,
                            specialTroops: preservedCityState?.specialTroops ?? [],
                        }
                        : null,
                    note: `${region.name} 仍由${dependencies.toFactionLabel(selection.originalController)}控制，但已被${dependencies.toFactionLabel(selection.attackerFactionId)}围城；围城兵力 ${selection.survivingTroops}${plunderPopulation > 0 ? `，城外人口被劫掠 ${plunderPopulation}` : ''}。`,
                };
                return {
                    ...besiegedRegion,
                    controlLabel: dependencies.getRegionControlLabel(besiegedRegion),
                };
            }
            const resetRegion = {
                ...region,
                controller: selection.originalController,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
                population: battleMode === 'city' && isQidahenCityRuntimeRegion(region.id) ? 0 : Math.max(0, region.population - plunderPopulation),
                troops: 0,
                siegeState: null,
                cityState: battleMode === 'city' && isQidahenCityRuntimeRegion(region.id)
                    ? {
                        troops: preservedCityState?.troops ?? 0,
                        population: withdrawnCityPopulation,
                        specialTroops: preservedCityState?.specialTroops ?? [],
                    }
                    : null,
                specialTroops: [],
                note: `${region.name} 守军溃散，但攻方选择不占领并战后回退${plunderPopulation > 0 ? `，劫掠移除 ${plunderPopulation} 人口` : ''}。`,
            };
            return {
                ...resetRegion,
                controlLabel: dependencies.getRegionControlLabel(resetRegion),
            };
        }
        if (choice.mode === 'withdraw' && region.id === withdrawRegionId && withdrawRegionId !== sourceRemovalRegionId) {
            if (region.siegeState?.attackerFactionId === selection.attackerFactionId) {
                return {
                    ...region,
                    siegeState: {
                        ...region.siegeState,
                        attackerTroops: region.siegeState.attackerTroops + selection.survivingTroops,
                        attackerSpecialTroops: mergeSpecialTroopStackGroupsAsPieces(
                            region.siegeState.attackerSpecialTroops,
                            mergedSurvivingSpecialTroops,
                        ),
                    },
                    note: `${region.name} 在战后接收 ${selection.survivingTroops} 个撤回围城增援部队。`,
                };
            }
            const actionWithdrawRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStacksToRegion({
                ...actionWithdrawRegion,
                troops: actionWithdrawRegion.troops + selection.survivingTroops,
                note: `${actionWithdrawRegion.name} 在战后接收 ${selection.survivingTroops} 个撤回部队。`,
            }, mergedSurvivingSpecialTroops);
        }
        return region;
    });

    const nextRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const plunderDrawResult = dependencies.drawFromFactionPile(
        state.factions,
        plunderSourceFactionId,
        plunderDrawCards,
        plunderDiscardGain,
    );
    const nextFactions = dependencies.addFactionHandCards(
        plunderDrawResult.factions,
        selection.attackerFactionId,
        plunderHandGain,
    );
    const koreaOccupationCards = choice.mode === 'occupy'
        ? dependencies.getEffectiveKoreaTributeCardsForFaction(state, selection.attackerFactionId, selection.targetRuntimeRegionId)
        : 0;
    const koreaDrawResult = dependencies.drawKoreaCardsForFaction(
        nextFactions,
        state.koreaDeckCount,
        selection.attackerFactionId,
        koreaOccupationCards,
    );
    const koreaText = koreaDrawResult.drawnCards > 0
        ? `，攻陷朝鲜区域并抽朝鲜牌 ${koreaDrawResult.drawnCards} 张`
        : '';
    const selectedRegionId = choice.mode === 'withdraw'
        ? withdrawRegionId ?? selection.targetRuntimeRegionId
        : selection.targetRuntimeRegionId;
    return {
        regions: nextRegions,
        factions: koreaDrawResult.factions,
        koreaDeckCount: koreaDrawResult.koreaDeckCount,
        drawPileCount: plunderSourceFactionId === 'ming' ? state.drawPileCount - plunderDrawCards : state.drawPileCount,
        discardPileCount: state.discardPileCount + plunderDiscardGain,
        handCards: dependencies.buildDrawnHandCards(state, selection.attackerFactionId, plunderHandGain),
        selectedRegionId,
        logText: choice.mode === 'occupy'
            ? `${state.factions[selection.attackerFactionId].name} 战后占领 ${selection.targetRegionName}${plunderText ? `，${plunderText}` : ''}${koreaText}。`
            : choice.mode === 'besiege'
                ? `${state.factions[selection.attackerFactionId].name} 战后围城 ${selection.targetRegionName}${plunderText ? `，${plunderText}` : ''}。`
                : `${state.factions[selection.attackerFactionId].name} 战后放弃占领，撤回 ${state.regions.find((region) => region.id === withdrawRegionId)?.name ?? selection.sourceRegionName}${plunderText ? `，${plunderText}` : ''}。`,
    };
};
