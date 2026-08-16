import { mergeSpecialTroopStackGroupsAsPieces } from './troopCompat';
import { computeQidahenAttackPressure } from './attackRules';
import {
    getQidahenBattleForceCommitments,
    updateQidahenForceCommitmentsFromOutcomes,
} from './battleForceCommitments';
import {
    buildQidahenBattleForceOutcomes,
    buildQidahenBattleForceRetreatOutcomes,
} from './battleForceOutcomes';
import {
    materializeNonSiegedCityActionSourceRegion,
} from './actionSourceRegionState';
import {
    QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS,
    computeQidahenStructuredBattleCasualties,
} from './attackRules';
import {
    getPostBattlePlunderPopulationCap,
    getEffectivePendingDefenderTroops,
    getPendingActionDefenderForceSnapshot,
    getPendingActionSourceForceSnapshot,
    isRegionFriendlyToFaction,
    resolvePendingBattleMode,
} from './battleState';
import {
    computeQidahenCavalryPlunderCounterPower,
} from './battleRollMath';
import { getQidahenEffectivePopulation } from './populationRules';
import {
    getAttackerDeckPlunderHandBonus,
    hasJinDefeatLossImmunity,
} from './characterAbilitySemantics';
import {
    addTroopsToFriendlyBesiegedCityInterior,
} from './cityInteriorTroopTransfer';
import {
    addDefeatMarkerToFaction,
} from './defeatMarkerState';
import { getRegionControlLabel, toFactionLabel } from './factionLabelSemantics';
import {
    addFactionHandCards,
    buildDrawnHandCards,
    drawFromFactionPile,
    getFactionDrawPileCount,
} from './handCardState';
import {
    applyCasualtiesToSpecialStacks,
    applyCasualtyPriorityToRegion,
    applyCommittedTroopRemovalToRegion,
    computeRetreatLoss,
    computeStructuredAttackerRout,
    computeStructuredDefenderRout,
    findAutoDefenderRetreatRegion,
    getCommittedArtilleryTroopCount,
    getCommittedCavalryTroopStacks,
    getDefenderCavalryEvasion,
    getSurvivingCommittedSpecialTroops,
    getSurvivingDefenderRetreatSpecialTroops,
    pruneUnsupportedRetreatArtillery,
    takePreferredCityGarrison,
} from './pendingBattleCombatSupport';
import {
    isQidahenCityRuntimeRegion,
    isQidahenKoreaRuntimeRegionId,
} from './regionConfig';
import { takeCommittedSpecialTroopStacks } from './movementProfileTroopSelection';
import {
    getActionRuleDisplayRegionName,
} from './regionRuleSemantics';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import {
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
    getSpecialTroopCount,
    subtractSpecialTroopStacks,
} from './troopCompat';
import type {
    QidahenBattleCasualtyPriority,
    QidahenBattleForceOutcome,
    QidahenBattleRolls,
    QidahenCasualtyPriority,
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenPlunderSource,
    QidahenPostBattleChoice,
    QidahenPostBattleSelection,
    QidahenRetreatLossMode,
    QidahenSpecialTroopStack,
} from './types';

type QidahenRuntimeRegion = QidahenCore['regions'][number];

type QidahenPendingActionResolution = Pick<
    QidahenCore,
    'regions' | 'factions' | 'drawPileCount' | 'discardPileCount' | 'handCards'
> & {
    logText: string;
    selectedRegionId: string;
    postBattleSelection: QidahenPostBattleSelection | null;
    pendingTargetAction: QidahenPendingTargetAction | null;
};

const buildPostBattleSelection = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    targetRegion: QidahenRuntimeRegion,
    survivingTroops: number,
    attackerLosses: number,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    attackerBattleCasualtyPriority: QidahenBattleCasualtyPriority = attackerCasualtyPriority,
    battleRollSummary: string | null = null,
    battleRolls: QidahenBattleRolls | null = null,
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        'toFactionLabel' | 'getActionRuleDisplayRegionName'
    > = {
        toFactionLabel,
        getActionRuleDisplayRegionName,
    },
): QidahenPostBattleSelection | null => {
    if (
        (pendingTargetAction.actionId !== 'raid' && pendingTargetAction.actionId !== 'wheel-dispatch' && pendingTargetAction.actionId !== 'drive-tiger')
        || !pendingTargetAction.sourceRegionId
        || survivingTroops <= 0
    ) {
        return null;
    }

    const retreatChoices = targetRegion.adjacentRegionIds
        .map((regionId) => state.regions.find((region) => !region.isLogicalRegion && region.id === regionId))
        .filter((region): region is NonNullable<typeof region> => region != null && isRegionFriendlyToFaction(region, pendingTargetAction.attackerFactionId))
        .sort((left, right) => (
            Number(right.id === pendingTargetAction.sourceRegionId) - Number(left.id === pendingTargetAction.sourceRegionId)
            || left.name.localeCompare(right.name, 'zh-CN')
        ));
    const forceCommitments = getQidahenBattleForceCommitments(pendingTargetAction);
    const forceOutcomes = buildQidahenBattleForceOutcomes(
        state,
        pendingTargetAction,
        attackerLosses,
        attackerBattleCasualtyPriority,
    );
    const isCityRegion = isQidahenCityRuntimeRegion(targetRegion.id);
    const battleMode = pendingTargetAction.battleMode ?? (isCityRegion ? 'city' : 'field');
    const canPlunderDefenderDeck = targetRegion.controller !== 'neutral' && targetRegion.controller !== pendingTargetAction.attackerFactionId;
    const canBesiege = isCityRegion
        && targetRegion.controller !== 'neutral'
        && targetRegion.controller !== pendingTargetAction.attackerFactionId;
    if (pendingTargetAction.targetKind === 'siege-attacker') {
        return {
            actionId: pendingTargetAction.actionId,
            battleMode,
            targetKind: 'siege-attacker',
            attackerFactionId: pendingTargetAction.attackerFactionId,
            sourceRegionId: pendingTargetAction.sourceRegionId,
            sourceRegionName: pendingTargetAction.sourceRegionName ?? pendingTargetAction.sourceRegionId,
            attackerPositionRegionId: pendingTargetAction.attackerPositionRegionId ?? null,
            targetRegionId: pendingTargetAction.targetRegionId,
            targetRegionName: pendingTargetAction.targetRegionName,
            targetRuntimeRegionId: pendingTargetAction.targetRuntimeRegionId,
            committedTroops: pendingTargetAction.committedTroops,
            survivingTroops,
            attackerLosses,
            movementProfileId: pendingTargetAction.movementProfileId,
            attackerCasualtyPriority,
            attackerBattleCasualtyPriority,
            originalController: targetRegion.controller,
            originalControlLabel: targetRegion.controlLabel,
            title: `${pendingTargetAction.targetRegionName} 解围待结算`,
            summary: `${pendingTargetAction.targetRegionName} 围城军已被压制，幸存 ${survivingTroops} 个援军可进驻解围。`,
            battleRollSummary,
            battleRolls,
            forceCommitments,
            forceOutcomes,
            choices: [{
                id: 'occupy',
                mode: 'occupy',
                regionId: pendingTargetAction.targetRuntimeRegionId,
                plunderPopulation: 0,
                plunderSource: null,
                label: '解除围城并进驻',
                detail: `${survivingTroops} 个幸存援军进入 ${pendingTargetAction.targetRegionName}，解除围城。`,
            }],
        };
    }
    const addPlunderChoice = (choice: QidahenPostBattleChoice): QidahenPostBattleChoice[] => (
        (() => {
            const plunderPopulationCap = getPostBattlePlunderPopulationCap(
                targetRegion,
                battleMode,
                choice.mode,
            );
            const plunderPopulationOptions = Array.from(
                { length: Math.max(0, plunderPopulationCap) },
                (_, index) => index + 1,
            );
            return plunderPopulationOptions.length > 0
                ? [
                    choice,
                    ...plunderPopulationOptions.flatMap((plunderPopulation) => {
                        const suffix = choice.mode === 'withdraw' && choice.regionId ? `:${choice.regionId}` : '';
                        const retreatLabel = choice.mode === 'occupy'
                            ? '占领'
                            : choice.mode === 'besiege'
                                ? '围城'
                                : `退回 ${state.regions.find((region) => region.id === choice.regionId)?.name ?? '友方区域'}`;
                        const attackerDeckChoice = {
                            ...choice,
                            id: `${choice.mode}-plunder-${plunderPopulation}${suffix}`,
                            plunderPopulation,
                            plunderSource: 'attacker' as const,
                            label: `劫掠 ${plunderPopulation} 人口并${retreatLabel}`,
                            detail: `移除 ${pendingTargetAction.targetRegionName} ${plunderPopulation} 人口；抽自己普通牌堆 ${plunderPopulation * 2} 张，手牌 +${plunderPopulation}、弃牌堆 +${plunderPopulation}。${choice.detail}`,
                        };
                        if (!canPlunderDefenderDeck) {
                            return [attackerDeckChoice];
                        }
                        return [
                            attackerDeckChoice,
                            {
                                ...choice,
                                id: `${choice.mode}-plunder-defender-${plunderPopulation}${suffix}`,
                                plunderPopulation,
                                plunderSource: 'defender' as const,
                                label: `劫掠 ${plunderPopulation} 人口，抽${dependencies.toFactionLabel(targetRegion.controller)}牌堆并${retreatLabel}`,
                                detail: `移除 ${pendingTargetAction.targetRegionName} ${plunderPopulation} 人口；抽被占领者普通牌堆 ${plunderPopulation} 张进手牌。${choice.detail}`,
                            },
                        ];
                    }),
                ]
                : [choice];
        })()
    );

    const choices = [
        ...addPlunderChoice({
            id: 'occupy',
            mode: 'occupy' as const,
            regionId: pendingTargetAction.targetRuntimeRegionId,
            plunderPopulation: 0,
            plunderSource: null,
            label: '占领该区',
            detail: `${survivingTroops} 个幸存部队留在 ${pendingTargetAction.targetRegionName}`,
        }),
        ...(canBesiege
            ? addPlunderChoice({
                id: 'besiege',
                mode: 'besiege' as const,
                regionId: pendingTargetAction.targetRuntimeRegionId,
                plunderPopulation: 0,
                plunderSource: null,
                label: '围城该区',
                detail: `${survivingTroops} 个幸存部队留在 ${pendingTargetAction.targetRegionName} 外围围城，区域仍由守方控制。`,
            })
            : []),
        ...retreatChoices.flatMap((region) => addPlunderChoice({
            id: `withdraw:${region.id}`,
            mode: 'withdraw' as const,
            regionId: region.id,
            plunderPopulation: 0,
            plunderSource: null,
            label: `退回 ${dependencies.getActionRuleDisplayRegionName(region, region.name)}`,
            detail: `${survivingTroops} 个幸存部队撤回相邻友方区域，${pendingTargetAction.targetRegionName} 不改控`,
        })),
    ];

    return {
        actionId: pendingTargetAction.actionId,
        battleMode,
        targetKind: pendingTargetAction.targetKind ?? 'region',
        attackerFactionId: pendingTargetAction.attackerFactionId,
        sourceRegionId: pendingTargetAction.sourceRegionId,
        sourceRegionName: pendingTargetAction.sourceRegionName ?? pendingTargetAction.sourceRegionId,
        attackerPositionRegionId: pendingTargetAction.attackerPositionRegionId ?? null,
        targetRegionId: pendingTargetAction.targetRegionId,
        targetRegionName: pendingTargetAction.targetRegionName,
        targetRuntimeRegionId: pendingTargetAction.targetRuntimeRegionId,
        committedTroops: pendingTargetAction.committedTroops,
        survivingTroops,
        attackerLosses,
        movementProfileId: pendingTargetAction.movementProfileId ?? null,
        attackerCasualtyPriority,
        attackerBattleCasualtyPriority,
        originalController: targetRegion.controller,
        originalControlLabel: targetRegion.controlLabel,
        title: '战后处理',
        summary: `${pendingTargetAction.targetRegionName} 已被突破，攻方损失 ${attackerLosses}，幸存 ${survivingTroops}，决定是否占领${canBesiege ? '、围城' : ''}或回退。`,
        battleRollSummary,
        battleRolls,
        forceCommitments,
        forceOutcomes,
        choices,
    };
};

interface QidahenPendingTargetResolutionDependencies {
    materializeNonSiegedCityActionSourceRegion: (
        region: QidahenRuntimeRegion,
    ) => QidahenRuntimeRegion;
    getSurvivingCommittedSpecialTroops: (
        sourceRegion: Pick<QidahenRuntimeRegion, 'specialTroops'> | null,
        committedTroops: number,
        attackerLosses: number,
        movementProfileId?: string | null,
        attackerCasualtyPriority?: QidahenCasualtyPriority,
    ) => QidahenSpecialTroopStack[];
    applyCommittedTroopRemovalToRegion: (
        region: QidahenRuntimeRegion,
        committedTroops: number,
        movementProfileId?: string | null,
        selectedSpecialPieceIds?: readonly string[],
    ) => QidahenRuntimeRegion;
    refreshRuntimeRegionRules: (
        runtimeRegions: QidahenRuntimeRegion[],
        fortifications: QidahenCore['fortifications'],
    ) => QidahenCore['regions'];
    getActionRuleDisplayRegionName: (
        region: QidahenRuntimeRegion,
        fallbackName?: string,
    ) => string;
    buildPostBattleSelection: (
        state: QidahenCore,
        pendingTargetAction: QidahenPendingTargetAction,
        targetRegion: QidahenRuntimeRegion,
        survivingTroops: number,
        attackerLosses: number,
        attackerCasualtyPriority?: QidahenCasualtyPriority,
        attackerBattleCasualtyPriority?: QidahenBattleCasualtyPriority,
        battleRollSummary?: string | null,
        battleRolls?: QidahenBattleRolls | null,
    ) => QidahenPostBattleSelection | null;
    toFactionLabel: (
        controller: QidahenRuntimeRegion['controller'],
    ) => string;
    getRegionControlLabel: (
        region: QidahenRuntimeRegion,
    ) => string;
    applyCasualtyPriorityToRegion: (
        region: QidahenRuntimeRegion,
        losses: number,
        movementProfileId?: string | null,
        casualtyPriority?: QidahenBattleCasualtyPriority,
    ) => QidahenRuntimeRegion;
    pruneUnsupportedRetreatArtillery: (
        stacks: QidahenSpecialTroopStack[],
        totalTroops: number,
    ) => { troops: number; specialTroops: QidahenSpecialTroopStack[] };
    addTroopsToFriendlyBesiegedCityInterior: (
        region: QidahenRuntimeRegion,
        troops: number,
        specialTroops: QidahenSpecialTroopStack[],
        note: string,
    ) => QidahenRuntimeRegion;
    isQidahenKoreaRuntimeRegionId: (
        regionId: string,
    ) => boolean;
    getCommittedCavalryTroopStacks: (
        sourceRegion: Pick<QidahenRuntimeRegion, 'specialTroops'> | null,
        committedTroops: number,
        movementProfileId?: string | null,
    ) => QidahenSpecialTroopStack[];
    getSpecialTroopCount: (
        region: Pick<QidahenRuntimeRegion, 'specialTroops'>,
    ) => number;
    getCavalryPlunderCounterPower: (
        region: QidahenRuntimeRegion,
    ) => number;
    getFactionDrawPileCount: (
        state: QidahenCore,
        factionId: QidahenPendingTargetAction['attackerFactionId'],
    ) => number;
    drawFromFactionPile: (
        factions: QidahenCore['factions'],
        sourceFactionId: QidahenPendingTargetAction['attackerFactionId'],
        requestedCards: number,
        discardGain?: number,
    ) => {
        factions: QidahenCore['factions'];
        drawnCards: number;
    };
    addFactionHandCards: (
        factions: QidahenCore['factions'],
        factionId: QidahenPendingTargetAction['attackerFactionId'],
        drawCards: number,
    ) => QidahenCore['factions'];
    buildDrawnHandCards: (
        state: QidahenCore,
        factionId: QidahenPendingTargetAction['attackerFactionId'],
        drawCards: number,
    ) => QidahenCore['handCards'];
    findAutoDefenderRetreatRegion: (
        state: QidahenCore,
        battleRegion: QidahenRuntimeRegion,
        defenderFactionId: QidahenFactionId,
    ) => QidahenRuntimeRegion | null;
    computeStructuredDefenderRout: (
        targetRegion: Pick<QidahenRuntimeRegion, 'specialTroops'>,
        defenderLosses: number,
        remainingTroops: number,
        defenderCasualtyPriority?: QidahenCasualtyPriority,
    ) => {
        damagedTroops: number;
        troopLoss: number;
        survivingTroops: number;
        specialTroops: QidahenSpecialTroopStack[];
    } | null;
    getSurvivingDefenderRetreatSpecialTroops: (
        targetRegion: Pick<QidahenRuntimeRegion, 'specialTroops'>,
        defenderLosses: number,
        retreatLosses: number,
        defenderCasualtyPriority?: QidahenCasualtyPriority,
    ) => QidahenSpecialTroopStack[];
    computeStructuredAttackerRout: (
        sourceRegion: Pick<QidahenRuntimeRegion, 'troops' | 'population' | 'specialTroops'> | null,
        committedTroops: number,
        attackerLosses: number,
        movementProfileId?: string | null,
        attackerCasualtyPriority?: QidahenBattleCasualtyPriority,
    ) => {
        damagedTroops: number;
        troopLoss: number;
        specialTroops: QidahenSpecialTroopStack[];
    } | null;
    computeRetreatLoss: (
        survivingTroops: number,
        retreatLossMode: QidahenRetreatLossMode,
    ) => number;
    isQidahenCityRuntimeRegion: (
        regionId: string,
    ) => boolean;
    takePreferredCityGarrison: (
        region: Pick<QidahenRuntimeRegion, 'troops' | 'specialTroops'>,
        maxTroops: number,
    ) => {
        shelteredTroops: number;
        shelteredSpecialTroops: QidahenSpecialTroopStack[];
        fieldTroops: number;
        fieldSpecialTroops: QidahenSpecialTroopStack[];
    };
    getDefenderCavalryEvasion: (
        state: QidahenCore,
        targetRegion: QidahenRuntimeRegion,
        pendingTargetAction: QidahenPendingTargetAction,
        preferredRetreatRegionId?: string,
    ) => {
        retreatRegion: QidahenRuntimeRegion;
        troops: number;
        specialTroops: QidahenSpecialTroopStack[];
    } | null;
    subtractSpecialTroopStacks: typeof subtractSpecialTroopStacks;
    resolvePendingBattleMode: (
        pendingTargetAction: QidahenPendingTargetAction,
        targetRegion: QidahenRuntimeRegion,
        options: {
            defenderSortieBattle: boolean;
            defenderHoldCity: boolean;
        },
    ) => 'field' | 'city';
    getPendingActionDefenderForceSnapshot: typeof getPendingActionDefenderForceSnapshot;
    getEffectivePendingDefenderTroops: (
        targetRegion: QidahenRuntimeRegion,
        pendingTargetAction: QidahenPendingTargetAction,
        battleMode: 'field' | 'city',
    ) => number;
    getPendingActionSourceForceSnapshot: typeof getPendingActionSourceForceSnapshot;
    getCommittedArtilleryTroopCount: (
        sourceRegion: Pick<QidahenRuntimeRegion, 'specialTroops'> | null,
        committedTroops: number,
        movementProfileId?: string | null,
    ) => number;
    computeStructuredBattleCasualties: typeof computeQidahenStructuredBattleCasualties;
    applyCasualtiesToSpecialStacks: typeof applyCasualtiesToSpecialStacks;
    addDefeatMarkerToFaction: (
        factions: QidahenCore['factions'],
        factionId: QidahenFactionId,
    ) => QidahenCore['factions'];
}

type QidahenCityHoldDefense = {
    shelteredTroops: number;
    shelteredPopulation: number;
    shelteredSpecialTroops: QidahenSpecialTroopStack[];
    fieldTroops: number;
    fieldSpecialTroops: QidahenSpecialTroopStack[];
};

type QidahenPendingTargetAftermathState = {
    sourceTroopLoss: number;
    attackerForceOutcomes: QidahenBattleForceOutcome[] | null;
    attackerRetreatSourceNoteText: string;
    attackerRetreatSpecialTroops: QidahenSpecialTroopStack[] | null;
    defenderCavalryEvasionRegionId: string | null;
    defenderCavalryEvasionTroops: number;
    defenderCavalryEvasionSpecialTroops: QidahenSpecialTroopStack[];
    defenderRetreatRegionId: string | null;
    defenderRetreatTroops: number;
    defenderRetreatSpecialTroops: QidahenSpecialTroopStack[];
};

type QidahenPendingAttackerRetreatResolution = {
    attackerRetreatRearGuardLoss: number;
    sourceTroopLoss: number;
    attackerRetreatSpecialTroops: QidahenSpecialTroopStack[] | null;
    attackerRetreatEffectText: string;
    attackerRetreatSourceNoteText: string;
    attackerForceOutcomes: QidahenBattleForceOutcome[];
};

type QidahenPendingDefenderRetreatResolution = {
    defenderRetreatRegion: QidahenRuntimeRegion | null;
    defenderRetreatRegionId: string | null;
    defenderRetreatTroops: number;
    defenderRetreatSpecialTroops: QidahenSpecialTroopStack[];
    defenderRetreatEffectText: string;
};

type QidahenPendingSiegeAttackerBattleResolution = {
    region: QidahenRuntimeRegion;
    logText: string;
    postBattleSelection: QidahenPostBattleSelection | null;
    sourceTroopLoss: number;
    attackerRetreatSpecialTroops: QidahenSpecialTroopStack[] | null;
    attackerRetreatEffectText: string;
    attackerRetreatSourceNoteText: string;
    attackerForceOutcomes: QidahenBattleForceOutcome[] | null;
    defeatMarkerFactionId: QidahenPendingTargetAction['attackerFactionId'] | null;
};

type QidahenPendingGenericBattleOutcomeResolution = {
    region: QidahenRuntimeRegion;
    logText: string;
    postBattleSelection: QidahenPostBattleSelection | null;
    continuedPendingTargetAction: QidahenPendingTargetAction | null;
    sourceTroopLoss: number;
    attackerRetreatSpecialTroops: QidahenSpecialTroopStack[] | null;
    attackerRetreatEffectText: string;
    attackerRetreatSourceNoteText: string;
    attackerForceOutcomes: QidahenBattleForceOutcome[] | null;
    defenderRetreatRegionId: string | null;
    defenderRetreatTroops: number;
    defenderRetreatSpecialTroops: QidahenSpecialTroopStack[];
    defeatMarkerFactionId: QidahenFactionId | null;
};

type QidahenPendingBattleOutcomeFinalizeArgs = {
    state: QidahenCore;
    pendingTargetAction: QidahenPendingTargetAction;
    battleRegion: QidahenRuntimeRegion;
    currentBattleMode: 'field' | 'city';
    verb: string;
    cavalryEvasionText: string;
    cityHoldDefense: QidahenCityHoldDefense | null;
    captured: boolean;
    remainingTroops: number;
    regionCasualtyLoss: number;
    battleSnapshotPopulation: number;
    loss: number;
    attackerLoss: number;
    attackerRetreatEffectText: string;
    battleOutcomeText: string;
    structuredBattleText: string;
    defeatMarkerText: string;
    neutralGarrisonTroops: number;
    isCityBattle: boolean;
    isCityRegion: boolean;
    defenderSortieBattle: boolean;
    defenderRetreatRegion: QidahenRuntimeRegion | null;
    defenderRetreatTroops: number;
    defenderRetreatEffectText: string;
    fieldSurvivingSpecialTroops: QidahenSpecialTroopStack[];
    defenderSortieCapturedSpecialTroops: QidahenSpecialTroopStack[];
    defenderCasualtyPriority: QidahenCasualtyPriority;
};

const resolvePendingSiegeReinforcementAction = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    sourceRemovalRegionId: string | null,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    dependencies: QidahenPendingTargetResolutionDependencies,
): QidahenPendingActionResolution | null => {
    if (pendingTargetAction.targetKind !== 'siege-reinforce') {
        return null;
    }

    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRegion = runtimeRegions.find((region) => region.id === pendingTargetAction.targetRuntimeRegionId) ?? null;
    const sourceRuntimeRegion = sourceRemovalRegionId
        ? (() => {
            const sourceRegion = runtimeRegions.find((region) => region.id === sourceRemovalRegionId) ?? null;
            return sourceRegion ? dependencies.materializeNonSiegedCityActionSourceRegion(sourceRegion) : null;
        })()
        : null;
    const movedSpecialTroops = dependencies.getSurvivingCommittedSpecialTroops(
        sourceRuntimeRegion,
        pendingTargetAction.committedTroops,
        0,
        pendingTargetAction.movementProfileId,
        attackerCasualtyPriority,
    );
    const reinforcedRuntimeRegions = runtimeRegions.map((region) => {
        if (sourceRemovalRegionId && region.id === sourceRemovalRegionId && sourceRemovalRegionId !== pendingTargetAction.targetRuntimeRegionId) {
            const actionSourceRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return dependencies.applyCommittedTroopRemovalToRegion({
                ...actionSourceRegion,
                troops: Math.max(0, actionSourceRegion.troops - pendingTargetAction.committedTroops),
                note: `${actionSourceRegion.name} 调度 ${pendingTargetAction.committedTroops} 个部队增援 ${pendingTargetAction.targetRegionName} 的围城。`,
            }, pendingTargetAction.committedTroops, pendingTargetAction.movementProfileId);
        }
        if (
            targetRegion
            && region.id === pendingTargetAction.targetRuntimeRegionId
            && region.siegeState
            && region.siegeState.attackerFactionId === pendingTargetAction.attackerFactionId
        ) {
            return {
                ...region,
                siegeState: {
                    ...region.siegeState,
                    attackerTroops: region.siegeState.attackerTroops + pendingTargetAction.committedTroops,
                    attackerSpecialTroops: mergeSpecialTroopStackGroupsAsPieces(
                        region.siegeState.attackerSpecialTroops,
                        movedSpecialTroops,
                    ),
                },
                note: `${region.name} 获得 ${pendingTargetAction.committedTroops} 个围城增援，不进入战斗。`,
            };
        }
        return region;
    });

    return {
        regions: dependencies.refreshRuntimeRegionRules(reinforcedRuntimeRegions, state.fortifications),
        factions: state.factions,
        drawPileCount: state.drawPileCount,
        discardPileCount: state.discardPileCount,
        handCards: state.handCards,
        logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} 调度 ${pendingTargetAction.committedTroops} 个部队增援 ${pendingTargetAction.targetRegionName} 的围城，不进入战斗。`,
        selectedRegionId: pendingTargetAction.targetRuntimeRegionId,
        postBattleSelection: null,
        pendingTargetAction: null,
    };
};

const resolvePendingBattleWithoutDefenders = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    battleRegion: QidahenRuntimeRegion,
    currentBattleMode: 'field' | 'city',
    effectiveDefenderTroops: number,
    battleRegionSnapshotTroops: number,
    verb: string,
    cavalryEvasionText: string,
    cityHoldDefense: QidahenCityHoldDefense | null,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    dependencies: Pick<QidahenPendingTargetResolutionDependencies, 'getActionRuleDisplayRegionName' | 'buildPostBattleSelection'>,
): {
    region: QidahenRuntimeRegion;
    logText: string;
    postBattleSelection: QidahenPostBattleSelection | null;
    pendingTargetAction: QidahenPendingTargetAction | null;
} | null => {
    if (effectiveDefenderTroops > 0 || battleRegionSnapshotTroops > 0) {
        return null;
    }

    if (pendingTargetAction.targetKind === 'siege-attacker') {
        return {
            region: {
                ...battleRegion,
                note: `${battleRegion.name} 围城军已空，等待友军进驻解围。`,
            },
            logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)} 解围，围城军已空，等待战后进驻。`,
            postBattleSelection: dependencies.buildPostBattleSelection(
                state,
                {
                    ...pendingTargetAction,
                    battleMode: currentBattleMode,
                },
                battleRegion,
                pendingTargetAction.committedTroops,
                0,
                attackerCasualtyPriority,
                attackerCasualtyPriority,
                null,
            ),
            pendingTargetAction: null,
        };
    }

    if (cityHoldDefense && cityHoldDefense.shelteredTroops > 0) {
        return {
            region: {
                ...battleRegion,
                troops: 0,
                cityState: {
                    troops: cityHoldDefense.shelteredTroops,
                    population: cityHoldDefense.shelteredPopulation,
                    specialTroops: cityHoldDefense.shelteredSpecialTroops,
                },
                specialTroops: [],
                note: `${battleRegion.name} 守方守城避战后退入城市，直接进入城战。`,
            },
            logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)}，守方守城避战收入城中 ${cityHoldDefense.shelteredTroops} 部队与 ${cityHoldDefense.shelteredPopulation} 人口${cavalryEvasionText}，城外无守军，直接进入城战。`,
            postBattleSelection: null,
            pendingTargetAction: {
                ...pendingTargetAction,
                battleMode: 'city',
                title: `${pendingTargetAction.targetRegionName} 城战待结算`,
                restriction: `${pendingTargetAction.restriction} · 守城避战后直接攻城`,
                resolutionHint: `${pendingTargetAction.targetRegionName} 守军避战入城 ${cityHoldDefense.shelteredTroops}，攻方继续城战`,
            },
        };
    }

    return {
        region: {
            ...battleRegion,
            troops: 0,
            note: `${battleRegion.name} 在${verb}后守军已空${cavalryEvasionText}，等待决定是否占领。`,
        },
        logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)}${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，区域无守军，等待战后处理。`,
        postBattleSelection: dependencies.buildPostBattleSelection(
            state,
            {
                ...pendingTargetAction,
                battleMode: currentBattleMode,
            },
            battleRegion,
            pendingTargetAction.committedTroops,
            0,
            attackerCasualtyPriority,
            attackerCasualtyPriority,
            null,
        ),
        pendingTargetAction: null,
    };
};

const resolvePendingMarriageSubjugationAction = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    region: QidahenRuntimeRegion,
    factions: QidahenCore['factions'],
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        'materializeNonSiegedCityActionSourceRegion' | 'getActionRuleDisplayRegionName' | 'toFactionLabel' | 'getRegionControlLabel'
    >,
): {
    region: QidahenRuntimeRegion;
    factions: QidahenCore['factions'];
    logText: string;
} | null => {
    if (pendingTargetAction.actionId !== 'marriage-subjugation') {
        return null;
    }

    const defenderFactionId = pendingTargetAction.defenderFactionId;
    const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
    const requiredPayCost = pendingTargetAction.defenderPayCost ?? 0;
    const defenderPays = defenderFactionId !== 'neutral'
        && (requiredPayCost === 0 || state.factions[defenderFactionId].handCount >= requiredPayCost);

    if (defenderPays) {
        const nextFactions = {
            ...factions,
            [defenderFactionId]: {
                ...factions[defenderFactionId],
                handCount: Math.max(0, factions[defenderFactionId].handCount - requiredPayCost),
            },
        };
        return {
            factions: nextFactions,
            logText: `${region.controlLabel} 支付 ${requiredPayCost} 张手牌，守住 ${dependencies.getActionRuleDisplayRegionName(region, region.name)}。`,
            region: {
                ...region,
                note: `${dependencies.getActionRuleDisplayRegionName(region, region.name)} 面对联姻诱降后支付代价维持控制。`,
            },
        };
    }

    const convertedTroops = actionTargetRegion.troops > 0 ? 1 : 0;
    let nextFactions = factions;
    if (defenderFactionId !== 'neutral' && actionTargetRegion.troops > 0) {
        nextFactions = {
            ...factions,
            [defenderFactionId]: {
                ...factions[defenderFactionId],
                troops: Math.max(0, factions[defenderFactionId].troops - actionTargetRegion.troops),
            },
            [pendingTargetAction.attackerFactionId]: {
                ...factions[pendingTargetAction.attackerFactionId],
                troops: factions[pendingTargetAction.attackerFactionId].troops + convertedTroops,
            },
        };
    }

    const convertedRegion = {
        ...actionTargetRegion,
        controller: pendingTargetAction.attackerFactionId,
        diplomacyMarkerFaction: null,
        diplomacyMarkerSide: null,
        troops: convertedTroops,
        specialTroops: [],
        note: convertedTroops > 0
            ? `${actionTargetRegion.name} 联姻失败后原守军全灭，仅余 1 个部队转为 ${dependencies.toFactionLabel(pendingTargetAction.attackerFactionId)}。`
            : `${actionTargetRegion.name} 联姻失败后改由 ${dependencies.toFactionLabel(pendingTargetAction.attackerFactionId)} 控制。`,
    };

    return {
        factions: nextFactions,
        logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 对 ${dependencies.getActionRuleDisplayRegionName(region, region.name)} 发动联姻诱降，守军未能支付代价，区域改由其控制，并有 ${convertedTroops} 个部队转为其麾下。`,
        region: {
            ...convertedRegion,
            controlLabel: dependencies.getRegionControlLabel(convertedRegion),
        },
    };
};

const resolvePendingMarriageSubjugationTargetAction = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        | 'materializeNonSiegedCityActionSourceRegion'
        | 'getActionRuleDisplayRegionName'
        | 'toFactionLabel'
        | 'getRegionControlLabel'
        | 'refreshRuntimeRegionRules'
    >,
): QidahenPendingActionResolution | null => {
    if (pendingTargetAction.actionId !== 'marriage-subjugation') {
        return null;
    }

    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    let nextFactions = state.factions;
    let logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 完成 ${pendingTargetAction.title}。`;
    let resolved = false;
    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id !== pendingTargetAction.targetRuntimeRegionId) {
            return region;
        }

        const marriageSubjugationResolution = resolvePendingMarriageSubjugationAction(
            state,
            pendingTargetAction,
            region,
            nextFactions,
            dependencies,
        );
        if (!marriageSubjugationResolution) {
            return region;
        }
        resolved = true;
        nextFactions = marriageSubjugationResolution.factions;
        logText = marriageSubjugationResolution.logText;
        return marriageSubjugationResolution.region;
    });
    if (!resolved) {
        return null;
    }

    return {
        regions: dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications),
        factions: nextFactions,
        drawPileCount: state.drawPileCount,
        discardPileCount: state.discardPileCount,
        handCards: state.handCards,
        logText,
        selectedRegionId: pendingTargetAction.targetRuntimeRegionId,
        postBattleSelection: null,
        pendingTargetAction: null,
    };
};

const resolvePendingCavalryPlunderAction = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    battleRegion: QidahenRuntimeRegion,
    sourceRegion: Pick<QidahenRuntimeRegion, 'troops' | 'population' | 'specialTroops'> | null,
    attackerCavalryPlunder: boolean,
    attackerCavalryPlunderSource: QidahenPlunderSource = 'attacker',
    isCityBattle: boolean,
    factions: QidahenCore['factions'],
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        | 'isQidahenKoreaRuntimeRegionId'
        | 'getCommittedCavalryTroopStacks'
        | 'getSpecialTroopCount'
        | 'getCavalryPlunderCounterPower'
        | 'getFactionDrawPileCount'
        | 'drawFromFactionPile'
        | 'addFactionHandCards'
        | 'buildDrawnHandCards'
        | 'toFactionLabel'
    >,
): {
    region: QidahenRuntimeRegion;
    factions: QidahenCore['factions'];
    drawPileCount: number;
    discardPileCount: number;
    handCards: QidahenCore['handCards'];
    logText: string;
    sourceTroopLoss: number;
} | null => {
    if (
        !attackerCavalryPlunder
        || !sourceRegion
        || isCityBattle
        || dependencies.isQidahenKoreaRuntimeRegionId(battleRegion.id)
        || battleRegion.population <= 0
    ) {
        return null;
    }

    const committedCavalryStacks = dependencies.getCommittedCavalryTroopStacks(
        sourceRegion,
        pendingTargetAction.committedTroops,
        pendingTargetAction.movementProfileId,
    );
    const committedCavalryTroops = dependencies.getSpecialTroopCount({ specialTroops: committedCavalryStacks });
    if (committedCavalryTroops <= 0) {
        return null;
    }

    const counterDamageDisabled = pendingTargetAction.tacticModifiers?.some((modifier) => (
        modifier.side === 'attacker'
        && modifier.cavalryPlunderCounterDamageDisabled
    )) ?? false;
    const counterPower = counterDamageDisabled ? 0 : dependencies.getCavalryPlunderCounterPower(battleRegion);
    const cavalryLoss = counterDamageDisabled ? 0 : Math.min(committedCavalryTroops, Math.ceil(counterPower / 3));
    const survivingCavalry = Math.max(0, committedCavalryTroops - cavalryLoss);
    const plunderPopulation = Math.min(survivingCavalry, battleRegion.population);
    const canPlunderDefenderDeck = (
        attackerCavalryPlunderSource === 'defender'
        && pendingTargetAction.defenderFactionId !== 'neutral'
        && pendingTargetAction.defenderFactionId !== pendingTargetAction.attackerFactionId
    );
    const defenderPlunderFactionId: QidahenFactionId | null = canPlunderDefenderDeck && pendingTargetAction.defenderFactionId !== 'neutral'
        ? pendingTargetAction.defenderFactionId
        : null;
    const plunderSourceFactionId: QidahenFactionId = defenderPlunderFactionId ?? pendingTargetAction.attackerFactionId;
    const requestedCards = canPlunderDefenderDeck
        ? plunderPopulation
        : plunderPopulation * 2;
    const availableCards = dependencies.getFactionDrawPileCount(state, plunderSourceFactionId);
    const drawCards = Math.min(requestedCards, availableCards);
    const attackerDeckPlunderHandBonus = canPlunderDefenderDeck
        ? 0
        : getAttackerDeckPlunderHandBonus(
            state,
            pendingTargetAction.attackerFactionId,
            plunderPopulation,
        );
    const handGain = canPlunderDefenderDeck
        ? drawCards
        : Math.min(plunderPopulation + attackerDeckPlunderHandBonus, drawCards);
    const discardGain = canPlunderDefenderDeck ? 0 : Math.max(0, drawCards - handGain);
    const drawResult = dependencies.drawFromFactionPile(
        factions,
        plunderSourceFactionId,
        drawCards,
        discardGain,
    );
    const nextFactions = dependencies.addFactionHandCards(
        drawResult.factions,
        pendingTargetAction.attackerFactionId,
        handGain,
    );
    const drawPileCount = plunderSourceFactionId === 'ming'
        ? Math.max(0, state.drawPileCount - drawCards)
        : state.drawPileCount;
    const discardPileCount = state.discardPileCount + discardGain;
    const handCards = dependencies.buildDrawnHandCards(
        state,
        pendingTargetAction.attackerFactionId,
        handGain,
    );
    const plunderDeckText = canPlunderDefenderDeck
        ? `抽${dependencies.toFactionLabel(pendingTargetAction.defenderFactionId)}牌堆获得 ${handGain} 张手牌`
        : `抽自己牌堆获得 ${handGain} 张手牌、弃牌堆 +${discardGain}${attackerDeckPlunderHandBonus > 0 ? '（含人物额外摸牌）' : ''}`;
    const counterDamageText = counterDamageDisabled
        ? '打草惊蛇使劫掠部队不受反击伤害'
        : `先承受守方炮骑反击损失 ${cavalryLoss}`;

    return {
        region: {
            ...battleRegion,
            population: Math.max(0, battleRegion.population - plunderPopulation),
            note: `${battleRegion.name} 遭骑兵劫掠，移除 ${plunderPopulation} 人口；守军仍留在原地。`,
        },
        factions: nextFactions,
        drawPileCount,
        discardPileCount,
        handCards,
        logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} 以 ${committedCavalryTroops} 个骑兵劫掠 ${battleRegion.name}，${counterDamageText}，幸存 ${survivingCavalry} 个骑兵劫掠 ${plunderPopulation} 人口，${plunderDeckText} 后撤回。`,
        sourceTroopLoss: cavalryLoss,
    };
};

const applyPendingTargetAftermathAdjustments = (
    runtimeRegions: QidahenRuntimeRegion[],
    pendingTargetAction: QidahenPendingTargetAction,
    sourceRemovalRegionId: string | null,
    attackerCasualtyPriority: QidahenCasualtyPriority,
    attackerBattleCasualtyPriority: QidahenBattleCasualtyPriority,
    aftermath: QidahenPendingTargetAftermathState,
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        | 'materializeNonSiegedCityActionSourceRegion'
        | 'applyCasualtyPriorityToRegion'
        | 'pruneUnsupportedRetreatArtillery'
        | 'addTroopsToFriendlyBesiegedCityInterior'
    >,
): {
    regions: QidahenRuntimeRegion[];
    selectedRegionId: string | null;
} => {
    const actionLabel = pendingTargetAction.actionId === 'raid'
        ? '突袭'
        : pendingTargetAction.actionId === 'drive-tiger'
            ? '驱虎吞狼调度进攻'
            : '调度进攻';
    const applyForceOutcomesToSnapshot = (
        snapshot: Pick<QidahenRuntimeRegion, 'troops' | 'specialTroops'>,
        forceOutcomes: QidahenBattleForceOutcome[],
    ): Pick<QidahenRuntimeRegion, 'troops' | 'specialTroops'> => {
        let nextSnapshot = {
            troops: snapshot.troops,
            specialTroops: snapshot.specialTroops,
        };
        for (const outcome of forceOutcomes) {
            const committedSpecialTroops = outcome.selectedSpecialPieceIds?.length
                ? collapseCompatPiecesToSpecialTroopStacks(
                    expandSpecialTroopStacksToCompatPieces(nextSnapshot.specialTroops)
                        .filter((piece) => outcome.selectedSpecialPieceIds!.includes(piece.id)),
                )
                : takeCommittedSpecialTroopStacks(
                    nextSnapshot,
                    outcome.committedTroops,
                    outcome.movementProfileId,
                );
            nextSnapshot = {
                troops: Math.max(0, nextSnapshot.troops - outcome.attackerLosses),
                specialTroops: mergeSpecialTroopStackGroupsAsPieces(
                    subtractSpecialTroopStacks(nextSnapshot.specialTroops, committedSpecialTroops),
                    outcome.survivingSpecialTroops,
                ),
            };
        }
        return dependencies.pruneUnsupportedRetreatArtillery(
            nextSnapshot.specialTroops,
            nextSnapshot.troops,
        );
    };

    return {
        regions: runtimeRegions.map((region) => {
            const regionForceOutcomes = aftermath.attackerForceOutcomes?.filter((outcome) => (
                outcome.sourceRegionId === region.id
            )) ?? [];
            if (regionForceOutcomes.length > 0) {
                const regionTroopLoss = regionForceOutcomes.reduce(
                    (total, outcome) => total + outcome.attackerLosses,
                    0,
                );
                if (
                    pendingTargetAction.attackerPositionRegionId
                    && region.id === pendingTargetAction.attackerPositionRegionId
                    && region.siegeState?.attackerFactionId === pendingTargetAction.attackerFactionId
                ) {
                    const filteredRetreatForce = applyForceOutcomesToSnapshot({
                        troops: region.siegeState.attackerTroops,
                        specialTroops: region.siegeState.attackerSpecialTroops,
                    }, regionForceOutcomes);
                    return {
                        ...region,
                        note: `${region.name} 在${actionLabel}后损失 ${regionTroopLoss} 个围城部队${aftermath.attackerRetreatSourceNoteText}。`,
                        siegeState: {
                            ...region.siegeState,
                            attackerTroops: filteredRetreatForce.troops,
                            attackerSpecialTroops: filteredRetreatForce.specialTroops,
                        },
                    };
                }
                const materializedRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
                const filteredRetreatForce = applyForceOutcomesToSnapshot(
                    materializedRegion,
                    regionForceOutcomes,
                );
                return {
                    ...materializedRegion,
                    troops: filteredRetreatForce.troops,
                    specialTroops: filteredRetreatForce.specialTroops,
                    note: `${region.name} 在${actionLabel}后损失 ${regionTroopLoss} 个部队${aftermath.attackerRetreatSourceNoteText}。`,
                };
            }
            if (
                !aftermath.attackerForceOutcomes?.length
                && (aftermath.sourceTroopLoss > 0 || aftermath.attackerRetreatSpecialTroops)
                && sourceRemovalRegionId
                && region.id === sourceRemovalRegionId
            ) {
                if (
                    pendingTargetAction.attackerPositionRegionId
                    && region.id === pendingTargetAction.attackerPositionRegionId
                    && region.siegeState?.attackerFactionId === pendingTargetAction.attackerFactionId
                ) {
                    const siegeSourceRegion = {
                        ...region,
                        controller: pendingTargetAction.attackerFactionId,
                        troops: Math.max(0, region.siegeState.attackerTroops - aftermath.sourceTroopLoss),
                        specialTroops: region.siegeState.attackerSpecialTroops,
                        note: `${region.name} 在${actionLabel}后损失 ${aftermath.sourceTroopLoss} 个围城部队${aftermath.attackerRetreatSourceNoteText}。`,
                    };
                    const lostSiegeSourceRegion = aftermath.attackerRetreatSpecialTroops
                        ? {
                            ...siegeSourceRegion,
                            specialTroops: aftermath.attackerRetreatSpecialTroops,
                        }
                        : dependencies.applyCasualtyPriorityToRegion(
                            siegeSourceRegion,
                            aftermath.sourceTroopLoss,
                            pendingTargetAction.movementProfileId,
                            attackerBattleCasualtyPriority,
                        );
                    const filteredRetreatForce = dependencies.pruneUnsupportedRetreatArtillery(
                        lostSiegeSourceRegion.specialTroops,
                        lostSiegeSourceRegion.troops,
                    );
                    return {
                        ...region,
                        note: lostSiegeSourceRegion.note,
                        siegeState: {
                            ...region.siegeState,
                            attackerTroops: filteredRetreatForce.troops,
                            attackerSpecialTroops: filteredRetreatForce.specialTroops,
                        },
                    };
                }
                const materializedRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
                const baseLostRegion = {
                    ...materializedRegion,
                    troops: Math.max(0, materializedRegion.troops - aftermath.sourceTroopLoss),
                    note: `${region.name} 在${actionLabel}后损失 ${aftermath.sourceTroopLoss} 个部队${aftermath.attackerRetreatSourceNoteText}。`,
                };
                const lostRegion = aftermath.attackerRetreatSpecialTroops
                    ? {
                        ...baseLostRegion,
                        specialTroops: aftermath.attackerRetreatSpecialTroops,
                    }
                    : dependencies.applyCasualtyPriorityToRegion(
                        baseLostRegion,
                        aftermath.sourceTroopLoss,
                        pendingTargetAction.movementProfileId,
                        attackerBattleCasualtyPriority,
                    );
                const filteredRetreatForce = dependencies.pruneUnsupportedRetreatArtillery(
                    lostRegion.specialTroops,
                    lostRegion.troops,
                );
                return {
                    ...lostRegion,
                    troops: filteredRetreatForce.troops,
                    specialTroops: filteredRetreatForce.specialTroops,
                };
            }
            let nextRegion = region;
            if (
                aftermath.defenderCavalryEvasionRegionId
                && aftermath.defenderCavalryEvasionTroops > 0
                && nextRegion.id === aftermath.defenderCavalryEvasionRegionId
            ) {
                const actionRetreatRegion = dependencies.materializeNonSiegedCityActionSourceRegion(nextRegion);
                nextRegion = dependencies.addTroopsToFriendlyBesiegedCityInterior(
                    actionRetreatRegion,
                    aftermath.defenderCavalryEvasionTroops,
                    aftermath.defenderCavalryEvasionSpecialTroops,
                    `${actionRetreatRegion.name} 接收 ${aftermath.defenderCavalryEvasionTroops} 个避战骑兵。`,
                );
            }
            if (
                aftermath.defenderRetreatRegionId
                && aftermath.defenderRetreatTroops > 0
                && region.id === aftermath.defenderRetreatRegionId
            ) {
                const actionRetreatRegion = dependencies.materializeNonSiegedCityActionSourceRegion(nextRegion);
                nextRegion = dependencies.addTroopsToFriendlyBesiegedCityInterior(
                    actionRetreatRegion,
                    aftermath.defenderRetreatTroops,
                    aftermath.defenderRetreatSpecialTroops,
                    `${actionRetreatRegion.name} 在相邻战场接收 ${aftermath.defenderRetreatTroops} 个撤退守军。`,
                );
            }
            return nextRegion;
        }),
        selectedRegionId: aftermath.attackerForceOutcomes?.find((outcome) => outcome.attackerLosses > 0)?.sourceRegionId
            ?? (sourceRemovalRegionId && aftermath.sourceTroopLoss > 0
                ? sourceRemovalRegionId
                : null),
    };
};

const resolvePendingBattleTargetAction = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    sourceRemovalRegionId: string | null,
    retreatLossMode: QidahenRetreatLossMode = 'rear-guard',
    defenderSortieBattle = false,
    defenderHoldCity = false,
    defenderCavalryEvasion = false,
    attackerCavalryPlunder = false,
    attackerCavalryPlunderSource: QidahenPlunderSource = 'attacker',
    defenderCavalryEvasionPreferredRegionId: string | undefined,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    battleRolls: QidahenBattleRolls | null | undefined,
    dependencies: QidahenPendingTargetResolutionDependencies,
): QidahenPendingActionResolution | null => {
    if (
        pendingTargetAction.actionId !== 'raid'
        && pendingTargetAction.actionId !== 'wheel-dispatch'
        && pendingTargetAction.actionId !== 'drive-tiger'
    ) {
        return null;
    }

    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRegion = runtimeRegions.find((region) => region.id === pendingTargetAction.targetRuntimeRegionId) ?? null;
    if (!targetRegion) {
        return null;
    }

    const verb = pendingTargetAction.actionId === 'raid'
        ? '突袭'
        : pendingTargetAction.actionId === 'drive-tiger'
            ? '驱虎吞狼调度进攻'
            : '调度进攻';
    const isCityRegion = dependencies.isQidahenCityRuntimeRegion(targetRegion.id);
    const cityHoldDefense = defenderHoldCity && isCityRegion
        ? (() => {
            const shelteredPopulation = Math.min(
                2,
                getQidahenEffectivePopulation(targetRegion),
            );
            const defense = dependencies.takePreferredCityGarrison(targetRegion, 2);
            return {
                ...defense,
                shelteredPopulation,
            };
        })()
        : null;
    const baseBattleRegion = cityHoldDefense
        ? {
            ...targetRegion,
            troops: cityHoldDefense.fieldTroops,
            specialTroops: cityHoldDefense.fieldSpecialTroops,
            population: Math.max(0, targetRegion.population - cityHoldDefense.shelteredPopulation),
            note: `${targetRegion.name} 守城避战，将 ${cityHoldDefense.shelteredTroops} 个部队与 ${cityHoldDefense.shelteredPopulation} 人口收入城中。`,
        }
        : targetRegion;
    const cavalryEvasion = defenderCavalryEvasion
        ? dependencies.getDefenderCavalryEvasion(
            state,
            baseBattleRegion,
            pendingTargetAction,
            defenderCavalryEvasionPreferredRegionId,
        )
        : null;
    const cavalryEvasionText = cavalryEvasion
        ? `，守方骑兵避战 ${cavalryEvasion.troops} 撤至 ${dependencies.getActionRuleDisplayRegionName(cavalryEvasion.retreatRegion, cavalryEvasion.retreatRegion.name)}`
        : '';
    const aftermath: QidahenPendingTargetAftermathState = {
        sourceTroopLoss: 0,
        attackerForceOutcomes: null,
        attackerRetreatSourceNoteText: '',
        attackerRetreatSpecialTroops: null,
        defenderCavalryEvasionRegionId: cavalryEvasion?.retreatRegion.id ?? null,
        defenderCavalryEvasionTroops: cavalryEvasion?.troops ?? 0,
        defenderCavalryEvasionSpecialTroops: cavalryEvasion?.specialTroops ?? [],
        defenderRetreatRegionId: null,
        defenderRetreatTroops: 0,
        defenderRetreatSpecialTroops: [],
    };
    const battleRegion = cavalryEvasion
        ? {
            ...baseBattleRegion,
            troops: Math.max(0, baseBattleRegion.troops - cavalryEvasion.troops),
            specialTroops: dependencies.subtractSpecialTroopStacks(
                baseBattleRegion.specialTroops,
                cavalryEvasion.specialTroops,
            ),
            note: `${dependencies.getActionRuleDisplayRegionName(baseBattleRegion, baseBattleRegion.name)} 守方骑兵 ${cavalryEvasion.troops} 避战撤至 ${dependencies.getActionRuleDisplayRegionName(cavalryEvasion.retreatRegion, cavalryEvasion.retreatRegion.name)}。`,
        }
        : baseBattleRegion;
    const currentBattleMode = dependencies.resolvePendingBattleMode(pendingTargetAction, targetRegion, {
        defenderSortieBattle,
        defenderHoldCity,
    });
    const battleRegionSnapshot = dependencies.getPendingActionDefenderForceSnapshot(
        battleRegion,
        pendingTargetAction,
        currentBattleMode,
    );
    const neutralGarrisonTroops = pendingTargetAction.targetKind === 'siege-attacker'
        ? 0
        : (battleRegion.controller === 'neutral' && battleRegion.troops <= 0
            ? Math.min(
                getQidahenEffectivePopulation(battleRegion),
                QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS,
            )
            : 0);
    const effectiveDefenderTroops = dependencies.getEffectivePendingDefenderTroops(
        battleRegion,
        pendingTargetAction,
        currentBattleMode,
    );
    const noDefenderResolution = resolvePendingBattleWithoutDefenders(
        state,
        pendingTargetAction,
        battleRegion,
        currentBattleMode,
        effectiveDefenderTroops,
        battleRegionSnapshot.troops,
        verb,
        cavalryEvasionText,
        cityHoldDefense,
        attackerCasualtyPriority,
        dependencies,
    );
    if (noDefenderResolution) {
        const regions = runtimeRegions.map((region) => (
            region.id === pendingTargetAction.targetRuntimeRegionId ? noDefenderResolution.region : region
        ));
        const aftermathAdjustments = applyPendingTargetAftermathAdjustments(
            regions,
            pendingTargetAction,
            sourceRemovalRegionId,
            attackerCasualtyPriority,
            attackerCasualtyPriority,
            aftermath,
            dependencies,
        );
        const selectedRegionId = !noDefenderResolution.pendingTargetAction && !noDefenderResolution.postBattleSelection && aftermathAdjustments.selectedRegionId
            ? aftermathAdjustments.selectedRegionId
            : pendingTargetAction.targetRuntimeRegionId;
        return {
            regions: dependencies.refreshRuntimeRegionRules(aftermathAdjustments.regions, state.fortifications),
            factions: state.factions,
            drawPileCount: state.drawPileCount,
            discardPileCount: state.discardPileCount,
            handCards: state.handCards,
            logText: noDefenderResolution.logText,
            selectedRegionId,
            postBattleSelection: noDefenderResolution.postBattleSelection,
            pendingTargetAction: noDefenderResolution.pendingTargetAction,
        };
    }

    const sourceRegion = dependencies.getPendingActionSourceForceSnapshot(state, pendingTargetAction);
    const attackerBattleCasualtyPriority: QidahenBattleCasualtyPriority = pendingTargetAction.tacticModifiers?.some((modifier) => (
        modifier.side === 'attacker'
        && modifier.casualtyPriority === 'artillery-first'
    ))
        ? 'artillery-first'
        : attackerCasualtyPriority;
    const isCityBattle = currentBattleMode === 'city';
    let nextFactions = state.factions;
    let nextDrawPileCount = state.drawPileCount;
    let nextDiscardPileCount = state.discardPileCount;
    let nextHandCards = state.handCards;
    let continuedPendingTargetAction: QidahenPendingTargetAction | null = null;
    let postBattleSelection: QidahenPostBattleSelection | null = null;
    let logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 完成 ${pendingTargetAction.title}。`;
    let resolvedTargetRegion = battleRegion;

    if (pendingTargetAction.targetKind === 'siege-attacker') {
        const committedArtilleryCount = dependencies.getCommittedArtilleryTroopCount(
            sourceRegion,
            pendingTargetAction.committedTroops,
            pendingTargetAction.movementProfileId,
        );
        const committedBattleTroops = Math.max(0, pendingTargetAction.committedTroops - committedArtilleryCount);
        const defenderPressure = Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.battleWidth));
        const fallbackDefenderLoss = effectiveDefenderTroops > 0
            ? Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.attackPressure || pendingTargetAction.battleWidth))
            : 0;
        const fallbackAttackerLoss = Math.max(0, Math.min(committedBattleTroops, defenderPressure));
        const casualties = dependencies.computeStructuredBattleCasualties({
            sourceRegion,
            targetRegion: battleRegionSnapshot,
            committedTroops: pendingTargetAction.committedTroops,
            committedArtilleryTroops: committedArtilleryCount,
            attackPressure: pendingTargetAction.attackPressure || pendingTargetAction.battleWidth,
            effectiveDefenderTroops,
            defenderPressure,
            fallbackDefenderLoss,
            fallbackAttackerLoss,
            battleRolls,
        });
        const loss = casualties.defenderLoss;
        const attackerLoss = casualties.attackerLoss;
        const survivingAttackers = Math.max(0, pendingTargetAction.committedTroops - attackerLoss);
        const survivingAttackersForBattle = Math.max(0, survivingAttackers - committedArtilleryCount);
        const remainingDefenderTroops = Math.max(0, effectiveDefenderTroops - loss);
        const survivingSiegeSpecialTroops = dependencies.applyCasualtiesToSpecialStacks(
            battleRegionSnapshot.specialTroops,
            loss,
            defenderCasualtyPriority,
        );
        const structuredBattleText = casualties.summary ? ` ${casualties.summary}` : '';
        const siegeAttackerResolution = resolvePendingSiegeAttackerBattleOutcome(
            state,
            pendingTargetAction,
            battleRegion,
            sourceRegion,
            verb,
            attackerLoss,
            loss,
            survivingAttackers,
            survivingAttackersForBattle,
            remainingDefenderTroops,
            survivingSiegeSpecialTroops,
            retreatLossMode,
            structuredBattleText,
            battleRolls,
            attackerCasualtyPriority,
            dependencies,
        );
        aftermath.sourceTroopLoss = siegeAttackerResolution.sourceTroopLoss;
        aftermath.attackerForceOutcomes = siegeAttackerResolution.attackerForceOutcomes;
        aftermath.attackerRetreatSpecialTroops = siegeAttackerResolution.attackerRetreatSpecialTroops;
        aftermath.attackerRetreatSourceNoteText = siegeAttackerResolution.attackerRetreatSourceNoteText;
        postBattleSelection = siegeAttackerResolution.postBattleSelection;
        if (siegeAttackerResolution.defeatMarkerFactionId) {
            nextFactions = dependencies.addDefeatMarkerToFaction(nextFactions, siegeAttackerResolution.defeatMarkerFactionId);
        }
        logText = siegeAttackerResolution.logText;
        resolvedTargetRegion = siegeAttackerResolution.region;
    } else {
        const cavalryPlunderResolution = resolvePendingCavalryPlunderAction(
            state,
            pendingTargetAction,
            battleRegion,
            sourceRegion,
            attackerCavalryPlunder,
            attackerCavalryPlunderSource,
            isCityBattle,
            nextFactions,
            dependencies,
        );
        if (cavalryPlunderResolution) {
            nextFactions = cavalryPlunderResolution.factions;
            nextDrawPileCount = cavalryPlunderResolution.drawPileCount;
            nextDiscardPileCount = cavalryPlunderResolution.discardPileCount;
            nextHandCards = cavalryPlunderResolution.handCards;
            aftermath.sourceTroopLoss = cavalryPlunderResolution.sourceTroopLoss;
            logText = cavalryPlunderResolution.logText;
            resolvedTargetRegion = cavalryPlunderResolution.region;
        } else {
            const defenderPressure = Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.battleWidth));
            const fallbackDefenderLoss = effectiveDefenderTroops > 0
                ? Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.attackPressure || pendingTargetAction.battleWidth))
                : 0;
            const committedArtilleryCount = dependencies.getCommittedArtilleryTroopCount(
                sourceRegion,
                pendingTargetAction.committedTroops,
                pendingTargetAction.movementProfileId,
            );
            const committedBattleTroops = Math.max(0, pendingTargetAction.committedTroops - committedArtilleryCount);
            const fallbackAttackerLoss = Math.max(0, Math.min(committedBattleTroops, defenderPressure));
            const casualties = dependencies.computeStructuredBattleCasualties({
                sourceRegion,
                targetRegion: battleRegionSnapshot,
                committedTroops: pendingTargetAction.committedTroops,
                committedArtilleryTroops: committedArtilleryCount,
                attackPressure: pendingTargetAction.attackPressure || pendingTargetAction.battleWidth,
                effectiveDefenderTroops,
                defenderPressure,
                fallbackDefenderLoss,
                fallbackAttackerLoss,
                battleRolls,
            });
            const loss = casualties.defenderLoss;
            const attackerLoss = casualties.attackerLoss;
            const fieldSurvivingSpecialTroops = dependencies.applyCasualtiesToSpecialStacks(
                battleRegionSnapshot.specialTroops,
                loss,
                defenderCasualtyPriority,
            );
            const structuredBattleText = casualties.summary ? ` ${casualties.summary}` : '';
            const genericBattleOutcome = resolvePendingGenericBattleOutcome(
                state,
                pendingTargetAction,
                battleRegion,
                battleRegionSnapshot,
                sourceRegion,
                currentBattleMode,
                verb,
                cavalryEvasionText,
                cityHoldDefense,
                neutralGarrisonTroops,
                effectiveDefenderTroops,
                attackerLoss,
                loss,
                committedArtilleryCount,
                retreatLossMode,
                isCityBattle,
                isCityRegion,
                defenderSortieBattle,
                fieldSurvivingSpecialTroops,
                dependencies.applyCasualtiesToSpecialStacks(
                    battleRegion.specialTroops,
                    loss,
                    defenderCasualtyPriority,
                ),
                attackerCasualtyPriority,
                attackerBattleCasualtyPriority,
                defenderCasualtyPriority,
                structuredBattleText,
                battleRolls,
                dependencies,
            );
            continuedPendingTargetAction = genericBattleOutcome.continuedPendingTargetAction;
            postBattleSelection = genericBattleOutcome.postBattleSelection;
            aftermath.sourceTroopLoss = genericBattleOutcome.sourceTroopLoss;
            aftermath.attackerForceOutcomes = genericBattleOutcome.attackerForceOutcomes;
            aftermath.attackerRetreatSpecialTroops = genericBattleOutcome.attackerRetreatSpecialTroops;
            aftermath.attackerRetreatSourceNoteText = genericBattleOutcome.attackerRetreatSourceNoteText;
            aftermath.defenderRetreatRegionId = genericBattleOutcome.defenderRetreatRegionId;
            aftermath.defenderRetreatTroops = genericBattleOutcome.defenderRetreatTroops;
            aftermath.defenderRetreatSpecialTroops = genericBattleOutcome.defenderRetreatSpecialTroops;
            if (genericBattleOutcome.defeatMarkerFactionId) {
                nextFactions = dependencies.addDefeatMarkerToFaction(nextFactions, genericBattleOutcome.defeatMarkerFactionId);
            }
            logText = genericBattleOutcome.logText;
            resolvedTargetRegion = genericBattleOutcome.region;
        }
    }

    const nextRuntimeRegions = runtimeRegions.map((region) => (
        region.id === pendingTargetAction.targetRuntimeRegionId ? resolvedTargetRegion : region
    ));
    const aftermathAdjustments = applyPendingTargetAftermathAdjustments(
        nextRuntimeRegions,
        pendingTargetAction,
        sourceRemovalRegionId,
        attackerCasualtyPriority,
        attackerBattleCasualtyPriority,
        aftermath,
        dependencies,
    );
    const selectedRegionId = !continuedPendingTargetAction && !postBattleSelection && aftermathAdjustments.selectedRegionId
        ? aftermathAdjustments.selectedRegionId
        : pendingTargetAction.targetRuntimeRegionId;

    return {
        regions: dependencies.refreshRuntimeRegionRules(aftermathAdjustments.regions, state.fortifications),
        factions: nextFactions,
        drawPileCount: nextDrawPileCount,
        discardPileCount: nextDiscardPileCount,
        handCards: nextHandCards,
        logText,
        selectedRegionId,
        postBattleSelection,
        pendingTargetAction: continuedPendingTargetAction,
    };
};

export const resolvePendingTargetActionByActionType = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    retreatLossMode: QidahenRetreatLossMode = 'rear-guard',
    defenderSortieBattle = false,
    defenderHoldCity = false,
    defenderCavalryEvasion = false,
    attackerCavalryPlunder = false,
    attackerCavalryPlunderSource: QidahenPlunderSource = 'attacker',
    defenderCavalryEvasionPreferredRegionId?: string,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    battleRolls: QidahenBattleRolls | null | undefined = undefined,
    dependencies: QidahenPendingTargetResolutionDependencies = {
        materializeNonSiegedCityActionSourceRegion,
        getSurvivingCommittedSpecialTroops,
        applyCommittedTroopRemovalToRegion,
        refreshRuntimeRegionRules,
        getActionRuleDisplayRegionName,
        buildPostBattleSelection,
        toFactionLabel,
        getRegionControlLabel,
        applyCasualtyPriorityToRegion,
        pruneUnsupportedRetreatArtillery,
        addTroopsToFriendlyBesiegedCityInterior,
        isQidahenKoreaRuntimeRegionId,
        getCommittedCavalryTroopStacks,
        getSpecialTroopCount,
        getCavalryPlunderCounterPower: computeQidahenCavalryPlunderCounterPower,
        getFactionDrawPileCount,
        drawFromFactionPile,
        addFactionHandCards,
        buildDrawnHandCards,
        findAutoDefenderRetreatRegion,
        computeStructuredDefenderRout,
        getSurvivingDefenderRetreatSpecialTroops,
        computeStructuredAttackerRout,
        computeRetreatLoss,
        isQidahenCityRuntimeRegion,
        takePreferredCityGarrison,
        getDefenderCavalryEvasion,
        subtractSpecialTroopStacks,
        resolvePendingBattleMode,
        getPendingActionDefenderForceSnapshot,
        getEffectivePendingDefenderTroops,
        getPendingActionSourceForceSnapshot,
        getCommittedArtilleryTroopCount,
        computeStructuredBattleCasualties: computeQidahenStructuredBattleCasualties,
        applyCasualtiesToSpecialStacks,
        addDefeatMarkerToFaction,
    },
): QidahenPendingActionResolution => {
    const sourceRemovalRegionId = pendingTargetAction.attackerPositionRegionId ?? pendingTargetAction.sourceRegionId;

    const siegeReinforcementResolution = resolvePendingSiegeReinforcementAction(
        state,
        pendingTargetAction,
        sourceRemovalRegionId,
        attackerCasualtyPriority,
        dependencies,
    );
    if (siegeReinforcementResolution) {
        return siegeReinforcementResolution;
    }

    const battleResolution = resolvePendingBattleTargetAction(
        state,
        pendingTargetAction,
        sourceRemovalRegionId,
        retreatLossMode,
        defenderSortieBattle,
        defenderHoldCity,
        defenderCavalryEvasion,
        attackerCavalryPlunder,
        attackerCavalryPlunderSource,
        defenderCavalryEvasionPreferredRegionId,
        attackerCasualtyPriority,
        defenderCasualtyPriority,
        battleRolls,
        dependencies,
    );
    if (battleResolution) {
        return battleResolution;
    }

    const marriageSubjugationResolution = resolvePendingMarriageSubjugationTargetAction(
        state,
        pendingTargetAction,
        dependencies,
    );
    if (marriageSubjugationResolution) {
        return marriageSubjugationResolution;
    }

    return {
        regions: state.regions,
        factions: state.factions,
        drawPileCount: state.drawPileCount,
        discardPileCount: state.discardPileCount,
        handCards: state.handCards,
        logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 完成 ${pendingTargetAction.title}。`,
        selectedRegionId: pendingTargetAction.targetRuntimeRegionId,
        postBattleSelection: null,
        pendingTargetAction: null,
    };
};

const resolvePendingDefenderRetreatLoss = (
    state: QidahenCore,
    battleRegion: QidahenRuntimeRegion,
    battleRegionSnapshot: Pick<QidahenRuntimeRegion, 'specialTroops'>,
    captured: boolean,
    remainingTroops: number,
    loss: number,
    retreatLossMode: QidahenRetreatLossMode,
    isCityBattle = false,
    isCityRegion = false,
    defenderSortieBattle = false,
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        | 'findAutoDefenderRetreatRegion'
        | 'computeStructuredDefenderRout'
        | 'computeRetreatLoss'
        | 'getSurvivingDefenderRetreatSpecialTroops'
        | 'pruneUnsupportedRetreatArtillery'
    >,
): QidahenPendingDefenderRetreatResolution => {
    const defenderCanRetreat = captured
        && remainingTroops > 0
        && battleRegion.controller !== 'neutral'
        && !isCityBattle
        && !(isCityRegion && defenderSortieBattle);
    const defenderRetreatFactionId = defenderCanRetreat && battleRegion.controller !== 'neutral'
        ? battleRegion.controller
        : null;
    const defenderRetreatRegion = defenderRetreatFactionId
        ? dependencies.findAutoDefenderRetreatRegion(state, battleRegion, defenderRetreatFactionId)
        : null;
    const defenderSkipsDefeatLoss = hasJinDefeatLossImmunity(state, battleRegion.controller);
    const structuredDefenderRout = defenderRetreatRegion
        && retreatLossMode === 'rout'
        && battleRegionSnapshot.specialTroops.length > 0
        && !defenderSkipsDefeatLoss
        ? dependencies.computeStructuredDefenderRout(
            battleRegionSnapshot,
            loss,
            remainingTroops,
            defenderCasualtyPriority,
        )
        : null;
    const defenderRetreatLoss = defenderSkipsDefeatLoss
        ? 0
        : structuredDefenderRout
            ? structuredDefenderRout.troopLoss
            : defenderRetreatRegion
                ? dependencies.computeRetreatLoss(remainingTroops, retreatLossMode)
                : 0;
    const defenderRetreatEffectText = defenderSkipsDefeatLoss
        ? '不执行部队损失惩罚'
        : structuredDefenderRout
            ? `溃败损伤 ${structuredDefenderRout.damagedTroops}`
            : `${retreatLossMode === 'rout' ? '溃败' : '断后'}损失 ${defenderRetreatLoss}`;

    if (!defenderRetreatRegion) {
        return {
            defenderRetreatRegion: null,
            defenderRetreatRegionId: null,
            defenderRetreatTroops: 0,
            defenderRetreatSpecialTroops: [],
            defenderRetreatEffectText,
        };
    }

    const fallbackDefenderRetreatSurvivors = Math.max(0, remainingTroops - defenderRetreatLoss);
    const effectiveDefenderRetreatSurvivors = structuredDefenderRout
        ? structuredDefenderRout.survivingTroops
        : fallbackDefenderRetreatSurvivors;
    if (effectiveDefenderRetreatSurvivors <= 0) {
        return {
            defenderRetreatRegion,
            defenderRetreatRegionId: null,
            defenderRetreatTroops: 0,
            defenderRetreatSpecialTroops: [],
            defenderRetreatEffectText,
        };
    }

    const retreatSpecialTroops = structuredDefenderRout
        ? structuredDefenderRout.specialTroops
        : dependencies.getSurvivingDefenderRetreatSpecialTroops(
            battleRegionSnapshot,
            loss,
            defenderRetreatLoss,
            defenderCasualtyPriority,
        );
    const filteredRetreatForce = dependencies.pruneUnsupportedRetreatArtillery(
        retreatSpecialTroops,
        effectiveDefenderRetreatSurvivors,
    );
    return {
        defenderRetreatRegion,
        defenderRetreatRegionId: filteredRetreatForce.troops > 0 ? defenderRetreatRegion.id : null,
        defenderRetreatTroops: filteredRetreatForce.troops,
        defenderRetreatSpecialTroops: filteredRetreatForce.troops > 0
            ? filteredRetreatForce.specialTroops
            : [],
        defenderRetreatEffectText,
    };
};

const resolvePendingCapturedBattleFollowup = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    battleRegion: QidahenRuntimeRegion,
    verb: string,
    captured: boolean,
    cityHoldDefense: QidahenCityHoldDefense | null,
    cavalryEvasionText: string,
    fieldSurvivingSpecialTroops: QidahenSpecialTroopStack[],
    attackerLoss: number,
    battleOutcomeText: string,
    structuredBattleText: string,
    battleRolls: QidahenBattleRolls | null | undefined,
    currentBattleMode: 'field' | 'city',
    remainingTroops: number,
    survivingAttackers: number,
    isCityRegion = false,
    defenderSortieBattle = false,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    attackerBattleCasualtyPriority: QidahenBattleCasualtyPriority = attackerCasualtyPriority,
    dependencies: Pick<QidahenPendingTargetResolutionDependencies, 'buildPostBattleSelection'>,
): {
    continuedPendingTargetAction: QidahenPendingTargetAction | null;
    postBattleSelection: QidahenPostBattleSelection | null;
    logText: string | null;
    region: QidahenRuntimeRegion | null;
} => {
    if (!captured) {
        return {
            continuedPendingTargetAction: null,
            postBattleSelection: null,
            logText: null,
            region: null,
        };
    }

    const continuedForceOutcomes = buildQidahenBattleForceOutcomes(
        state,
        pendingTargetAction,
        attackerLoss,
        attackerBattleCasualtyPriority,
    );
    const continuedForceAction = updateQidahenForceCommitmentsFromOutcomes(
        pendingTargetAction,
        continuedForceOutcomes,
    );

    if (cityHoldDefense && cityHoldDefense.shelteredTroops + remainingTroops > 0) {
        const cityDefenderTroops = cityHoldDefense.shelteredTroops + remainingTroops;
        const cityDefenderSpecialTroops = mergeSpecialTroopStackGroupsAsPieces(
            cityHoldDefense.shelteredSpecialTroops,
            fieldSurvivingSpecialTroops,
        );
        return {
            continuedPendingTargetAction: {
                ...continuedForceAction,
                battleMode: 'city',
                title: `${pendingTargetAction.targetRegionName} 城战待结算`,
                restriction: `${pendingTargetAction.restriction} · 守城避战后继续攻城`,
                committedTroops: survivingAttackers,
                sourceAvailableTroops: survivingAttackers,
                attackPressure: computeQidahenAttackPressure(survivingAttackers, pendingTargetAction.battleWidth),
                resolutionHint: `${pendingTargetAction.targetRegionName} 城外野战后仍有 ${cityDefenderTroops} 守军退回城市，攻方幸存 ${survivingAttackers} 继续攻城`,
            },
            postBattleSelection: null,
            logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name}，守方守城避战收入城中 ${cityHoldDefense.shelteredTroops} 部队与 ${cityHoldDefense.shelteredPopulation} 人口${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，损失 ${attackerLoss}，${battleOutcomeText}，城外守军残部 ${remainingTroops} 退回城市，攻方幸存 ${survivingAttackers} 继续攻城。${structuredBattleText}`,
            region: {
                ...battleRegion,
                troops: 0,
                cityState: {
                    troops: cityDefenderTroops,
                    population: cityHoldDefense.shelteredPopulation,
                    specialTroops: cityDefenderSpecialTroops,
                },
                specialTroops: [],
                note: `${battleRegion.name} 守方守城避战后，城外残部退回城市；攻方继续攻城。`,
            },
        };
    }

    if (isCityRegion && defenderSortieBattle) {
        return {
            continuedPendingTargetAction: {
                ...continuedForceAction,
                battleMode: 'city',
                title: `${pendingTargetAction.targetRegionName} 城战待结算`,
                restriction: `${pendingTargetAction.restriction} · 守军出城野战后继续攻城`,
                committedTroops: survivingAttackers,
                sourceAvailableTroops: survivingAttackers,
                attackPressure: computeQidahenAttackPressure(survivingAttackers, pendingTargetAction.battleWidth),
                resolutionHint: `${pendingTargetAction.targetRegionName} 守军出城野战后退入城市，攻方幸存 ${survivingAttackers} 继续攻城`,
            },
            postBattleSelection: null,
            logText: null,
            region: null,
        };
    }

    return {
        continuedPendingTargetAction: null,
        postBattleSelection: dependencies.buildPostBattleSelection(
            state,
            {
                ...pendingTargetAction,
                battleMode: currentBattleMode,
            },
            battleRegion,
            survivingAttackers,
            attackerLoss,
            attackerCasualtyPriority,
            attackerBattleCasualtyPriority,
            structuredBattleText.trim() || null,
            battleRolls ?? null,
        ),
        logText: null,
        region: null,
    };
};

const resolvePendingSiegeAttackerBattleOutcome = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    battleRegion: QidahenRuntimeRegion,
    sourceRegion: Pick<QidahenRuntimeRegion, 'troops' | 'population' | 'specialTroops'> | null,
    verb: string,
    attackerLoss: number,
    loss: number,
    survivingAttackers: number,
    survivingAttackersForBattle: number,
    remainingDefenderTroops: number,
    survivingSiegeSpecialTroops: QidahenSpecialTroopStack[],
    retreatLossMode: QidahenRetreatLossMode,
    structuredBattleText: string,
    battleRolls: QidahenBattleRolls | null | undefined,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        | 'buildPostBattleSelection'
        | 'getActionRuleDisplayRegionName'
        | 'computeStructuredAttackerRout'
        | 'computeRetreatLoss'
    >,
): QidahenPendingSiegeAttackerBattleResolution => {
    const attackerWinsBattle = survivingAttackersForBattle > remainingDefenderTroops;
    if (attackerWinsBattle && survivingAttackersForBattle > 0) {
        return {
            region: {
                ...battleRegion,
                siegeState: {
                    ...battleRegion.siegeState!,
                    attackerTroops: remainingDefenderTroops,
                    attackerSpecialTroops: survivingSiegeSpecialTroops,
                },
                note: `${battleRegion.name} 围城军被击溃，等待友军进驻解围。`,
            },
            logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)} 解围，投入 ${pendingTargetAction.committedTroops} 部队，损失 ${attackerLoss}，击溃围城军，幸存 ${survivingAttackers} 等待进驻。${structuredBattleText}`,
            postBattleSelection: dependencies.buildPostBattleSelection(
                state,
                pendingTargetAction,
                battleRegion,
                survivingAttackers,
                attackerLoss,
                attackerCasualtyPriority,
                attackerCasualtyPriority,
                structuredBattleText.trim() || null,
                battleRolls,
            ),
            sourceTroopLoss: 0,
            attackerRetreatSpecialTroops: null,
            attackerRetreatEffectText: '',
            attackerRetreatSourceNoteText: '',
            attackerForceOutcomes: null,
            defeatMarkerFactionId: null,
        };
    }

    const attackerRetreatResolution = resolvePendingAttackerRetreatLoss(
        state,
        pendingTargetAction,
        sourceRegion,
        survivingAttackers,
        attackerLoss,
        retreatLossMode,
        attackerCasualtyPriority,
        dependencies,
    );
    return {
        region: {
            ...battleRegion,
            siegeState: {
                ...battleRegion.siegeState!,
                attackerTroops: remainingDefenderTroops,
                attackerSpecialTroops: survivingSiegeSpecialTroops,
            },
            note: `${battleRegion.name} 围城军仍在，解围失败。`,
        },
        logText: `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)} 解围失败，围城军减员 ${loss}，攻方损失 ${attackerLoss}${attackerRetreatResolution.attackerRetreatEffectText}；${state.factions[pendingTargetAction.attackerFactionId].name} 获得 1 个战败标记。${structuredBattleText}`,
        postBattleSelection: null,
        sourceTroopLoss: attackerRetreatResolution.sourceTroopLoss,
        attackerRetreatSpecialTroops: attackerRetreatResolution.attackerRetreatSpecialTroops,
        attackerRetreatEffectText: attackerRetreatResolution.attackerRetreatEffectText,
        attackerRetreatSourceNoteText: attackerRetreatResolution.attackerRetreatSourceNoteText,
        attackerForceOutcomes: attackerRetreatResolution.attackerForceOutcomes,
        defeatMarkerFactionId: pendingTargetAction.attackerFactionId,
    };
};

const resolvePendingGenericBattleOutcome = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    battleRegion: QidahenRuntimeRegion,
    battleRegionSnapshot: Pick<QidahenRuntimeRegion, 'troops' | 'population' | 'specialTroops'>,
    sourceRegion: Pick<QidahenRuntimeRegion, 'troops' | 'population' | 'specialTroops'> | null,
    currentBattleMode: 'field' | 'city',
    verb: string,
    cavalryEvasionText: string,
    cityHoldDefense: QidahenCityHoldDefense | null,
    neutralGarrisonTroops: number,
    effectiveDefenderTroops: number,
    attackerLoss: number,
    loss: number,
    committedArtilleryCount: number,
    retreatLossMode: QidahenRetreatLossMode,
    isCityBattle: boolean,
    isCityRegion: boolean,
    defenderSortieBattle: boolean,
    fieldSurvivingSpecialTroops: QidahenSpecialTroopStack[],
    defenderSortieCapturedSpecialTroops: QidahenSpecialTroopStack[],
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    attackerBattleCasualtyPriority: QidahenBattleCasualtyPriority = attackerCasualtyPriority,
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    structuredBattleText = '',
    battleRolls: QidahenBattleRolls | null | undefined,
    dependencies: QidahenPendingTargetResolutionDependencies,
): QidahenPendingGenericBattleOutcomeResolution => {
    const survivingAttackers = Math.max(0, pendingTargetAction.committedTroops - attackerLoss);
    const survivingAttackersForBattle = Math.max(0, survivingAttackers - committedArtilleryCount);
    const remainingBattleTroops = Math.max(0, effectiveDefenderTroops - loss);
    const remainingTroops = Math.max(0, battleRegionSnapshot.troops > 0 ? battleRegionSnapshot.troops - loss : remainingBattleTroops);
    const attackerWinsBattle = survivingAttackersForBattle > remainingBattleTroops;
    const captured = battleRegion.controller !== pendingTargetAction.attackerFactionId && attackerWinsBattle && survivingAttackersForBattle > 0;
    const battleOutcomeText = `以 ${survivingAttackersForBattle} 比 ${remainingBattleTroops} 压倒守军`;
    let defeatMarkerFactionId: QidahenFactionId | null = isCityBattle
        ? null
        : captured && battleRegion.controller !== 'neutral'
            ? battleRegion.controller
            : !captured
                ? pendingTargetAction.attackerFactionId
                : null;
    const defeatMarkerText = defeatMarkerFactionId
        ? `；${state.factions[defeatMarkerFactionId].name} 获得 1 个战败标记`
        : '';

    const defenderRetreatResolution = resolvePendingDefenderRetreatLoss(
        state,
        battleRegion,
        battleRegionSnapshot,
        captured,
        remainingTroops,
        loss,
        retreatLossMode,
        isCityBattle,
        isCityRegion,
        defenderSortieBattle,
        defenderCasualtyPriority,
        dependencies,
    );
    const defenderRetreatRegion = defenderRetreatResolution.defenderRetreatRegion;
    const defenderRetreatEffectText = defenderRetreatResolution.defenderRetreatEffectText;

    let continuedPendingTargetAction: QidahenPendingTargetAction | null = null;
    let postBattleSelection: QidahenPostBattleSelection | null = null;
    let sourceTroopLoss = 0;
    let attackerRetreatSpecialTroops: QidahenSpecialTroopStack[] | null = null;
    let attackerRetreatEffectText = '';
    let attackerRetreatSourceNoteText = '';
    let attackerForceOutcomes: QidahenBattleForceOutcome[] | null = null;
    let logText = '';

    if (captured) {
        const capturedBattleFollowup = resolvePendingCapturedBattleFollowup(
            state,
            pendingTargetAction,
            battleRegion,
            verb,
            captured,
            cityHoldDefense,
            cavalryEvasionText,
            fieldSurvivingSpecialTroops,
            attackerLoss,
            battleOutcomeText,
            structuredBattleText,
            battleRolls,
            currentBattleMode,
            remainingTroops,
            survivingAttackers,
            isCityRegion,
            defenderSortieBattle,
            attackerCasualtyPriority,
            attackerBattleCasualtyPriority,
            dependencies,
        );
        continuedPendingTargetAction = capturedBattleFollowup.continuedPendingTargetAction;
        postBattleSelection = capturedBattleFollowup.postBattleSelection;
        if (cityHoldDefense && continuedPendingTargetAction) {
            defeatMarkerFactionId = null;
        }
        if (capturedBattleFollowup.logText) {
            logText = capturedBattleFollowup.logText;
        }
        if (capturedBattleFollowup.region) {
            return {
                region: capturedBattleFollowup.region,
                logText,
                postBattleSelection,
                continuedPendingTargetAction,
                sourceTroopLoss,
                attackerRetreatSpecialTroops,
                attackerRetreatEffectText,
                attackerRetreatSourceNoteText,
                attackerForceOutcomes,
                defenderRetreatRegionId: defenderRetreatResolution.defenderRetreatRegionId,
                defenderRetreatTroops: defenderRetreatResolution.defenderRetreatTroops,
                defenderRetreatSpecialTroops: defenderRetreatResolution.defenderRetreatSpecialTroops,
                defeatMarkerFactionId,
            };
        }
    } else {
        const attackerRetreatResolution = resolvePendingAttackerRetreatLoss(
            state,
            pendingTargetAction,
            sourceRegion,
            survivingAttackers,
            attackerLoss,
            retreatLossMode,
            attackerCasualtyPriority,
            dependencies,
        );
        sourceTroopLoss = attackerRetreatResolution.sourceTroopLoss;
        attackerRetreatSpecialTroops = attackerRetreatResolution.attackerRetreatSpecialTroops;
        attackerRetreatEffectText = attackerRetreatResolution.attackerRetreatEffectText;
        attackerRetreatSourceNoteText = attackerRetreatResolution.attackerRetreatSourceNoteText;
        attackerForceOutcomes = attackerRetreatResolution.attackerForceOutcomes;
    }

    const finalizedBattleOutcome = finalizePendingBattleOutcome({
        state,
        pendingTargetAction,
        battleRegion,
        currentBattleMode,
        verb,
        cavalryEvasionText,
        cityHoldDefense,
        captured,
        remainingTroops,
        regionCasualtyLoss: captured ? effectiveDefenderTroops : loss,
        battleSnapshotPopulation: battleRegionSnapshot.population,
        loss,
        attackerLoss,
        attackerRetreatEffectText,
        battleOutcomeText,
        structuredBattleText,
        defeatMarkerText,
        neutralGarrisonTroops,
        isCityBattle,
        isCityRegion,
        defenderSortieBattle,
        defenderRetreatRegion,
        defenderRetreatTroops: defenderRetreatResolution.defenderRetreatTroops,
        defenderRetreatEffectText,
        fieldSurvivingSpecialTroops,
        defenderSortieCapturedSpecialTroops,
        defenderCasualtyPriority,
    }, dependencies);
    logText = finalizedBattleOutcome.logText;

    return {
        region: finalizedBattleOutcome.region,
        logText,
        postBattleSelection,
        continuedPendingTargetAction,
        sourceTroopLoss,
        attackerRetreatSpecialTroops,
        attackerRetreatEffectText,
        attackerRetreatSourceNoteText,
        attackerForceOutcomes,
        defenderRetreatRegionId: defenderRetreatResolution.defenderRetreatRegionId,
        defenderRetreatTroops: defenderRetreatResolution.defenderRetreatTroops,
        defenderRetreatSpecialTroops: defenderRetreatResolution.defenderRetreatSpecialTroops,
        defeatMarkerFactionId,
    };
};

const finalizePendingBattleOutcome = (
    args: QidahenPendingBattleOutcomeFinalizeArgs,
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        'getActionRuleDisplayRegionName' | 'applyCasualtyPriorityToRegion'
    >,
): {
    region: QidahenRuntimeRegion;
    logText: string;
} => {
    const {
        state,
        pendingTargetAction,
        battleRegion,
        currentBattleMode,
        verb,
        cavalryEvasionText,
        cityHoldDefense,
        captured,
        remainingTroops,
        regionCasualtyLoss,
        battleSnapshotPopulation,
        loss,
        attackerLoss,
        attackerRetreatEffectText,
        battleOutcomeText,
        structuredBattleText,
        defeatMarkerText,
        neutralGarrisonTroops,
        isCityBattle,
        isCityRegion,
        defenderSortieBattle,
        defenderRetreatRegion,
        defenderRetreatTroops,
        defenderRetreatEffectText,
        fieldSurvivingSpecialTroops,
        defenderSortieCapturedSpecialTroops,
        defenderCasualtyPriority,
    } = args;

    const logText = captured
        ? isCityRegion && defenderSortieBattle
            ? `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)}，守军出城野战${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，损失 ${attackerLoss}，${battleOutcomeText}${remainingTroops > 0 ? `，守军残部 ${remainingTroops} 退回城市` : '，守军城外部队全灭'}，攻方幸存 ${Math.max(0, pendingTargetAction.committedTroops - attackerLoss)} 继续攻城${defeatMarkerText}。${structuredBattleText}`
            : `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)}${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，损失 ${attackerLoss}，${battleOutcomeText}${defenderRetreatRegion ? `，守军${defenderRetreatEffectText} 后${defenderRetreatTroops > 0 ? `撤至 ${dependencies.getActionRuleDisplayRegionName(defenderRetreatRegion, defenderRetreatRegion.name)}` : '无残部可撤'}` : remainingTroops > 0 && isCityBattle ? '，城中守军全灭' : remainingTroops > 0 ? '，守军无处可退被歼灭' : ''}后等待战后处理${defeatMarkerText}。${structuredBattleText}`
        : `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)}${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，守军减员 ${loss}，攻方损失 ${attackerLoss}${attackerRetreatEffectText}${defeatMarkerText}。${structuredBattleText}`;

    if (cityHoldDefense && !captured) {
        return {
            logText,
            region: {
                ...battleRegion,
                troops: remainingTroops,
                cityState: {
                    troops: cityHoldDefense.shelteredTroops,
                    population: cityHoldDefense.shelteredPopulation,
                    specialTroops: cityHoldDefense.shelteredSpecialTroops,
                },
                specialTroops: fieldSurvivingSpecialTroops,
                note: `${battleRegion.name} 守方守城避战后，城内仍有 ${cityHoldDefense.shelteredTroops} 部队与 ${cityHoldDefense.shelteredPopulation} 人口；城外野战后剩余 ${remainingTroops} 部队继续守住该区。`,
            },
        };
    }

    if (captured && isCityRegion && defenderSortieBattle) {
        return {
            logText,
            region: {
                ...battleRegion,
                troops: 0,
                population: 0,
                specialTroops: [],
                cityState: {
                    troops: remainingTroops,
                    population: battleRegion.population,
                    specialTroops: fieldSurvivingSpecialTroops,
                },
                note: `${battleRegion.name} 的守军出城野战后${remainingTroops > 0 ? `残余 ${remainingTroops} 个部队退回城市` : '城外部队全灭'}；攻方继续攻城。`,
            },
        };
    }

    if (currentBattleMode === 'city') {
        const startedWithCityState = battleRegion.cityState != null;
        const waitingCityState = {
            troops: 0,
            population: battleSnapshotPopulation,
            specialTroops: [],
        };
        return {
            logText,
            region: {
                ...battleRegion,
                troops: captured
                    ? startedWithCityState ? battleRegion.troops : 0
                    : startedWithCityState ? battleRegion.troops : remainingTroops,
                population: captured && !startedWithCityState ? 0 : battleRegion.population,
                specialTroops: captured
                    ? startedWithCityState ? battleRegion.specialTroops : []
                    : startedWithCityState ? battleRegion.specialTroops : fieldSurvivingSpecialTroops,
                cityState: captured
                    ? waitingCityState
                    : startedWithCityState
                        ? {
                            troops: remainingTroops,
                            population: battleSnapshotPopulation,
                            specialTroops: fieldSurvivingSpecialTroops,
                        }
                        : null,
                note: captured
                    ? remainingTroops > 0
                        ? `${battleRegion.name} 虽仍有 ${remainingTroops} 个守军残部，但因城战战败被全部移除；攻方等待决定是否占领。`
                        : `${battleRegion.name} 被${verb}突破${cavalryEvasionText}，等待决定是否占领。`
                    : `${battleRegion.name} 城中守军减少 ${loss}，攻方损失 ${attackerLoss}${attackerRetreatEffectText}。`,
            },
        };
    }

    return {
        logText,
        region: dependencies.applyCasualtyPriorityToRegion({
            ...battleRegion,
            troops: captured
                ? isCityRegion && defenderSortieBattle
                    ? remainingTroops
                    : 0
                : remainingTroops,
            specialTroops: captured
                ? isCityRegion && defenderSortieBattle
                    ? defenderSortieCapturedSpecialTroops
                    : []
                : battleRegion.specialTroops,
            controller: battleRegion.controller,
            controlLabel: battleRegion.controlLabel,
            note: captured
                ? isCityRegion && defenderSortieBattle
                    ? `${battleRegion.name} 的守军出城野战后${remainingTroops > 0 ? `残余 ${remainingTroops} 个部队退回城市` : '城外部队全灭'}；攻方继续攻城。`
                    : remainingTroops > 0
                        ? defenderRetreatRegion
                            ? `${dependencies.getActionRuleDisplayRegionName(battleRegion, battleRegion.name)} 的守军虽仍有 ${remainingTroops} 个部队，但兵力劣势${cavalryEvasionText}，撤退${defenderRetreatEffectText} 后${defenderRetreatTroops > 0 ? `撤退至 ${dependencies.getActionRuleDisplayRegionName(defenderRetreatRegion, defenderRetreatRegion.name)}` : '无残部可撤'}；攻方等待决定是否占领。`
                            : isCityBattle
                                ? `${battleRegion.name} 虽仍有 ${remainingTroops} 个守军残部，但因城战战败被全部移除；攻方等待决定是否占领。`
                                : `${battleRegion.name} 的守军虽仍有 ${remainingTroops} 个部队，但兵力劣势且无处可退，被全部移除；攻方等待决定是否占领。`
                        : `${battleRegion.name} 被${verb}突破${cavalryEvasionText}，等待决定是否占领。`
                : neutralGarrisonTroops > 0 && battleRegion.troops <= 0
                    ? `${battleRegion.name} 因人口临时建立 ${neutralGarrisonTroops} 个中立守军，并在${verb}后剩余 ${remainingTroops}。`
                    : `${battleRegion.name} 在${verb}后守军减少 ${loss}${cavalryEvasionText}，攻方损失 ${attackerLoss}${attackerRetreatEffectText}。`,
        }, regionCasualtyLoss, null, defenderCasualtyPriority),
    };
};

const resolvePendingAttackerRetreatLoss = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    sourceRegion: Pick<QidahenRuntimeRegion, 'troops' | 'population' | 'specialTroops'> | null,
    survivingAttackers: number,
    attackerLoss: number,
    retreatLossMode: QidahenRetreatLossMode,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    dependencies: Pick<
        QidahenPendingTargetResolutionDependencies,
        'computeStructuredAttackerRout' | 'computeRetreatLoss'
    >,
): QidahenPendingAttackerRetreatResolution => {
    const attackerSkipsDefeatLoss = hasJinDefeatLossImmunity(
        state,
        pendingTargetAction.attackerFactionId,
    );
    const structuredAttackerRout = retreatLossMode === 'rout' && !attackerSkipsDefeatLoss
        ? dependencies.computeStructuredAttackerRout(
            sourceRegion,
            pendingTargetAction.committedTroops,
            attackerLoss,
            pendingTargetAction.movementProfileId,
            attackerCasualtyPriority,
        )
        : null;

    if (structuredAttackerRout) {
        return {
            attackerRetreatRearGuardLoss: Math.max(0, structuredAttackerRout.troopLoss - attackerLoss),
            sourceTroopLoss: structuredAttackerRout.troopLoss,
            attackerRetreatSpecialTroops: structuredAttackerRout.specialTroops,
            attackerRetreatEffectText: structuredAttackerRout.damagedTroops > 0
                ? `，撤退溃败损伤 ${structuredAttackerRout.damagedTroops}`
                : '',
            attackerRetreatSourceNoteText: structuredAttackerRout.damagedTroops > 0
                ? `，其中撤退溃败损伤 ${structuredAttackerRout.damagedTroops}`
                : '',
            attackerForceOutcomes: buildQidahenBattleForceRetreatOutcomes(
                state,
                pendingTargetAction,
                attackerLoss,
                structuredAttackerRout.troopLoss,
                retreatLossMode,
                false,
                attackerCasualtyPriority,
            ),
        };
    }

    const attackerRetreatRearGuardLoss = attackerSkipsDefeatLoss
        ? 0
        : dependencies.computeRetreatLoss(survivingAttackers, retreatLossMode);

    const sourceTroopLoss = attackerLoss + attackerRetreatRearGuardLoss;
    return {
        attackerRetreatRearGuardLoss,
        sourceTroopLoss,
        attackerRetreatSpecialTroops: null,
        attackerRetreatEffectText: attackerSkipsDefeatLoss
            ? '，撤退不执行部队损失惩罚'
            : attackerRetreatRearGuardLoss > 0
                ? `，撤退${retreatLossMode === 'rout' ? '溃败' : '断后'}损失 ${attackerRetreatRearGuardLoss}`
                : '',
        attackerRetreatSourceNoteText: attackerSkipsDefeatLoss
            ? ''
            : attackerRetreatRearGuardLoss > 0
                ? `，其中撤退${retreatLossMode === 'rout' ? '溃败' : '断后'} ${attackerRetreatRearGuardLoss}`
                : '',
        attackerForceOutcomes: buildQidahenBattleForceRetreatOutcomes(
            state,
            pendingTargetAction,
            attackerLoss,
            sourceTroopLoss,
            retreatLossMode,
            attackerSkipsDefeatLoss,
            attackerCasualtyPriority,
        ),
    };
};
