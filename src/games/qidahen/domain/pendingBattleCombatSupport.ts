import {
    getFriendlyReceivingRegionSnapshot,
    getPendingActionSourceForceSnapshot,
    isRegionControlledByFaction,
    isRegionFriendlyToFaction,
} from './battleState';
import { getQidahenEffectivePopulation } from './populationRules';
import { isQidahenCityRuntimeRegion } from './regionConfig';
import {
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
    filterCompatPiecesToSpecialTroopStacks,
    getArtilleryTroopCount,
    getSpecialTroopCount,
    mergeSpecialTroopStackGroupsAsPieces,
    sortCompatPiecesForSelection,
    sortCompatPiecesForRemoval,
    subtractSpecialTroopStacks,
} from './troopCompat';
import {
    isTroopKindAllowedForMovementProfile,
    takeCommittedSpecialTroopStacks,
} from './movementProfileTroopSelection';
import type {
    QidahenBattleCasualtyPriority,
    QidahenCasualtyPriority,
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenRetreatLossMode,
    QidahenSpecialTroopStack,
    QidahenTroopKind,
} from './types';

export const pendingBattleHasDefenderArtillery = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
): boolean => {
    const targetRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === pendingTargetAction.targetRuntimeRegionId
    ));
    return Boolean(targetRegion?.specialTroops.some((stack) => (
        stack.troopKind === 'artillery'
        && stack.count > 0
    )));
};

export const pendingAttackHasCommittedTroopKind = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    troopKind: QidahenTroopKind,
): boolean => {
    const sourceRegion = getPendingActionSourceForceSnapshot(state, pendingTargetAction);
    if (!sourceRegion) {
        return false;
    }
    const committedSpecialTroops = takeCommittedSpecialTroopStacks(
        sourceRegion,
        pendingTargetAction.committedTroops,
        pendingTargetAction.movementProfileId,
    );
    const committedSpecialCount = getSpecialTroopCount({
        specialTroops: committedSpecialTroops,
    });
    const committedGenericTroops = Math.max(
        0,
        pendingTargetAction.committedTroops - committedSpecialCount,
    );
    return expandSpecialTroopStacksToCompatPieces(committedSpecialTroops)
        .some((piece) => piece.troopKind === troopKind)
        || (troopKind === 'infantry' && committedGenericTroops > 0);
};

export const applyCasualtiesToSpecialStacks = (
    stacks: QidahenSpecialTroopStack[],
    troopLoss: number,
    casualtyPriority: QidahenBattleCasualtyPriority = 'highest-level',
): QidahenSpecialTroopStack[] => {
    const allPieces = expandSpecialTroopStacksToCompatPieces(stacks);
    const casualtyCandidates = casualtyPriority === 'artillery-first'
        ? allPieces
        : allPieces.filter((piece) => piece.troopKind !== 'artillery');
    const removedPieceIds = new Set(
        sortCompatPiecesForRemoval(
            casualtyCandidates,
            casualtyPriority,
        )
            .slice(0, Math.max(0, troopLoss))
            .map((piece) => piece.id),
    );
    return collapseCompatPiecesToSpecialTroopStacks(
        allPieces.filter((piece) => !removedPieceIds.has(piece.id)),
    );
};

export const pruneUnsupportedRetreatArtillery = (
    stacks: QidahenSpecialTroopStack[],
    totalTroops: number,
): { troops: number; specialTroops: QidahenSpecialTroopStack[] } => {
    const compatPieces = expandSpecialTroopStacksToCompatPieces(stacks);
    const artilleryCount = compatPieces.filter((piece) => piece.troopKind === 'artillery').length;
    const normalizedStacks = collapseCompatPiecesToSpecialTroopStacks(compatPieces);

    if (artilleryCount <= 0) {
        return {
            troops: Math.max(0, totalTroops),
            specialTroops: normalizedStacks,
        };
    }

    const hasRetreatEscort = Math.max(0, totalTroops - artilleryCount) > 0;
    if (hasRetreatEscort) {
        return {
            troops: Math.max(0, totalTroops),
            specialTroops: normalizedStacks,
        };
    }

    return {
        troops: Math.max(0, totalTroops - artilleryCount),
        specialTroops: collapseCompatPiecesToSpecialTroopStacks(
            compatPieces.filter((piece) => piece.troopKind !== 'artillery'),
        ),
    };
};

export const applyCasualtyPriorityToRegion = (
    region: QidahenCore['regions'][number],
    troopLoss: number,
    movementProfileId?: string | null,
    casualtyPriority: QidahenBattleCasualtyPriority = 'highest-level',
): QidahenCore['regions'][number] => {
    const remainingLoss = Math.max(0, troopLoss);
    if (remainingLoss <= 0 || region.specialTroops.length === 0) {
        return region;
    }

    const allPieces = expandSpecialTroopStacksToCompatPieces(region.specialTroops);
    const casualtyCandidates = casualtyPriority === 'artillery-first'
        ? allPieces.filter((piece) => isTroopKindAllowedForMovementProfile(piece.troopKind, movementProfileId))
        : allPieces.filter((piece) => (
            piece.troopKind !== 'artillery'
            && isTroopKindAllowedForMovementProfile(piece.troopKind, movementProfileId)
        ));
    const removedPieceIds = new Set(
        sortCompatPiecesForRemoval(
            casualtyCandidates,
            casualtyPriority,
        )
            .slice(0, remainingLoss)
            .map((piece) => piece.id),
    );
    const nextSpecialTroops = collapseCompatPiecesToSpecialTroopStacks(
        allPieces.filter((piece) => !removedPieceIds.has(piece.id)),
    );
    const filteredForce = pruneUnsupportedRetreatArtillery(nextSpecialTroops, region.troops);

    return {
        ...region,
        troops: filteredForce.troops,
        specialTroops: filteredForce.specialTroops,
    };
};

export const applyCommittedTroopRemovalToRegion = <TRegion extends Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>>(
    region: TRegion,
    committedTroops: number,
    movementProfileId?: string | null,
    selectedSpecialPieceIds?: readonly string[],
): TRegion => {
    const remainingRemoval = Math.max(0, committedTroops);
    if (remainingRemoval <= 0 || region.specialTroops.length === 0) {
        return region;
    }

    const allPieces = expandSpecialTroopStacksToCompatPieces(region.specialTroops);
    const explicitPieceIds = new Set(selectedSpecialPieceIds ?? []);
    const removedPieceIds = explicitPieceIds.size > 0
        ? explicitPieceIds
        : new Set(
            sortCompatPiecesForSelection(
                allPieces.filter((piece) => isTroopKindAllowedForMovementProfile(piece.troopKind, movementProfileId)),
                'highest-level',
            )
                .slice(0, remainingRemoval)
                .map((piece) => piece.id),
        );

    return {
        ...region,
        specialTroops: collapseCompatPiecesToSpecialTroopStacks(
            allPieces.filter((piece) => !removedPieceIds.has(piece.id)),
        ),
    };
};

const cityGarrisonTroopKindPriority = (troopKind: QidahenTroopKind): number => (
    troopKind === 'artillery' ? 0 : troopKind === 'cavalry' ? 1 : 2
);

export const takePreferredCityGarrison = (
    region: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
    maxTroops: number,
): {
    shelteredTroops: number;
    shelteredSpecialTroops: QidahenSpecialTroopStack[];
    fieldTroops: number;
    fieldSpecialTroops: QidahenSpecialTroopStack[];
} => {
    let remainingShelterSlots = Math.max(0, maxTroops);
    const shelteredSpecialTroops = expandSpecialTroopStacksToCompatPieces(region.specialTroops)
        .slice()
        .sort((left, right) => (
            right.level - left.level
            || cityGarrisonTroopKindPriority(left.troopKind) - cityGarrisonTroopKindPriority(right.troopKind)
            || left.label.localeCompare(right.label, 'zh-CN')
            || left.stackOrder - right.stackOrder
            || left.pieceOrder - right.pieceOrder
        ));

    const shelteredCompatPieces: ReturnType<typeof expandSpecialTroopStacksToCompatPieces> = [];
    for (const piece of shelteredSpecialTroops) {
        if (remainingShelterSlots <= 0) {
            break;
        }
        shelteredCompatPieces.push(piece);
        remainingShelterSlots -= 1;
    }

    const mergedShelteredSpecialTroops = collapseCompatPiecesToSpecialTroopStacks(shelteredCompatPieces);
    const shelteredSpecialCount = getSpecialTroopCount({ specialTroops: mergedShelteredSpecialTroops });
    const genericTroops = Math.max(0, region.troops - getSpecialTroopCount(region));
    const shelteredGenericTroops = Math.min(genericTroops, Math.max(0, maxTroops - shelteredSpecialCount));
    const shelteredTroops = Math.min(region.troops, shelteredSpecialCount + shelteredGenericTroops);

    return {
        shelteredTroops,
        shelteredSpecialTroops: mergedShelteredSpecialTroops,
        fieldTroops: Math.max(0, region.troops - shelteredTroops),
        fieldSpecialTroops: subtractSpecialTroopStacks(region.specialTroops, mergedShelteredSpecialTroops),
    };
};

export const applyRoutDamageToSpecialStacks = (
    stacks: QidahenSpecialTroopStack[],
): {
    damagedTroops: number;
    removedTroops: number;
    specialTroops: QidahenSpecialTroopStack[];
} => {
    let damagedTroops = 0;
    let removedTroops = 0;
    const specialTroops = collapseCompatPiecesToSpecialTroopStacks(
        expandSpecialTroopStacksToCompatPieces(stacks).flatMap((piece) => {
            if (piece.troopKind === 'artillery') {
                return [piece];
            }
            damagedTroops += 1;
            if (piece.level <= 1) {
                removedTroops += 1;
                return [];
            }
            return [{
                ...piece,
                sourceStackId: `${piece.sourceStackId}-rout-lv${piece.level - 1}`,
                level: piece.level - 1,
            }];
        }),
    );

    return {
        damagedTroops,
        removedTroops,
        specialTroops,
    };
};

const findDefenderRetreatRegions = (
    state: QidahenCore,
    targetRegion: QidahenCore['regions'][number],
    defenderFactionId: QidahenFactionId,
): QidahenCore['regions'][number][] => (
    targetRegion.adjacentRegionIds
        .map((regionId) => state.regions.find((region) => !region.isLogicalRegion && region.id === regionId))
        .filter((region): region is NonNullable<typeof region> => region != null && isRegionFriendlyToFaction(region, defenderFactionId))
        .sort((left, right) => {
            const leftSource = getFriendlyReceivingRegionSnapshot(left);
            const rightSource = getFriendlyReceivingRegionSnapshot(right);
            return Number(isRegionControlledByFaction(right, defenderFactionId)) - Number(isRegionControlledByFaction(left, defenderFactionId))
                || rightSource.troops - leftSource.troops
                || getQidahenEffectivePopulation(right, rightSource.population)
                    - getQidahenEffectivePopulation(left, leftSource.population)
                || left.name.localeCompare(right.name, 'zh-CN');
        })
);

export const findAutoDefenderRetreatRegion = (
    state: QidahenCore,
    targetRegion: QidahenCore['regions'][number],
    defenderFactionId: QidahenFactionId,
): QidahenCore['regions'][number] | null => (
    findDefenderRetreatRegions(state, targetRegion, defenderFactionId)[0] ?? null
);

export const computeStructuredAttackerRout = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'> | null,
    committedTroops: number,
    attackerLosses: number,
    movementProfileId?: string | null,
    attackerCasualtyPriority: QidahenBattleCasualtyPriority = 'highest-level',
): {
    damagedTroops: number;
    troopLoss: number;
    specialTroops: QidahenSpecialTroopStack[];
} | null => {
    if (!sourceRegion || sourceRegion.specialTroops.length === 0) {
        return null;
    }

    const committedSpecialTroops = takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId);
    if (committedSpecialTroops.length === 0) {
        return null;
    }

    const committedSpecialCount = getSpecialTroopCount({ specialTroops: committedSpecialTroops });
    const committedGenericTroops = Math.max(0, committedTroops - committedSpecialCount);
    const afterBattleSpecialTroops = applyCasualtiesToSpecialStacks(
        committedSpecialTroops,
        attackerLosses,
        attackerCasualtyPriority,
    );
    const afterBattleSpecialCount = getSpecialTroopCount({ specialTroops: afterBattleSpecialTroops });
    const removedSpecialByBattle = Math.max(0, committedSpecialCount - afterBattleSpecialCount);
    const genericBattleLoss = Math.min(
        committedGenericTroops,
        Math.max(0, attackerLosses - removedSpecialByBattle),
    );
    const genericRoutLoss = Math.max(0, committedGenericTroops - genericBattleLoss);
    const routDamage = applyRoutDamageToSpecialStacks(afterBattleSpecialTroops);
    const specialTroops = mergeSpecialTroopStackGroupsAsPieces(
        subtractSpecialTroopStacks(sourceRegion.specialTroops, committedSpecialTroops),
        routDamage.specialTroops,
    );

    return {
        damagedTroops: routDamage.damagedTroops + genericRoutLoss,
        troopLoss: attackerLosses + routDamage.removedTroops + genericRoutLoss,
        specialTroops,
    };
};

export const getSurvivingCommittedSpecialTroops = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'specialTroops'> | null,
    committedTroops: number,
    attackerLosses: number,
    movementProfileId?: string | null,
    attackerCasualtyPriority: QidahenBattleCasualtyPriority = 'highest-level',
): QidahenSpecialTroopStack[] => {
    if (!sourceRegion || sourceRegion.specialTroops.length === 0) {
        return [];
    }
    return applyCasualtiesToSpecialStacks(
        takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId),
        attackerLosses,
        attackerCasualtyPriority,
    );
};

export const getCommittedArtilleryTroopCount = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'specialTroops'> | null,
    committedTroops: number,
    movementProfileId?: string | null,
): number => (
    sourceRegion
        ? getArtilleryTroopCount({
            specialTroops: takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId),
        })
        : 0
);

export const getCommittedCavalryTroopStacks = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'specialTroops'> | null,
    committedTroops: number,
    movementProfileId?: string | null,
): QidahenSpecialTroopStack[] => (
    sourceRegion
        ? filterCompatPiecesToSpecialTroopStacks(
            takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId),
            (piece) => piece.troopKind === 'cavalry',
        )
        : []
);

export const getSurvivingDefenderRetreatSpecialTroops = (
    targetRegion: Pick<QidahenCore['regions'][number], 'specialTroops'>,
    defenderLosses: number,
    retreatLosses: number,
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
): QidahenSpecialTroopStack[] => {
    if (targetRegion.specialTroops.length === 0) {
        return [];
    }
    return applyCasualtiesToSpecialStacks(
        targetRegion.specialTroops,
        defenderLosses + retreatLosses,
        defenderCasualtyPriority,
    );
};

export const computeStructuredDefenderRout = (
    targetRegion: Pick<QidahenCore['regions'][number], 'specialTroops'>,
    defenderLosses: number,
    remainingTroops: number,
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
): {
    damagedTroops: number;
    troopLoss: number;
    survivingTroops: number;
    specialTroops: QidahenSpecialTroopStack[];
} => {
    const afterBattleSpecialTroops = applyCasualtiesToSpecialStacks(
        targetRegion.specialTroops,
        defenderLosses,
        defenderCasualtyPriority,
    );
    const afterBattleSpecialCount = getSpecialTroopCount({ specialTroops: afterBattleSpecialTroops });
    const unstructuredRetreatTroops = Math.max(0, remainingTroops - afterBattleSpecialCount);
    const routDamage = applyRoutDamageToSpecialStacks(afterBattleSpecialTroops);
    const troopLoss = routDamage.removedTroops + unstructuredRetreatTroops;

    return {
        damagedTroops: routDamage.damagedTroops + unstructuredRetreatTroops,
        troopLoss,
        survivingTroops: Math.max(0, remainingTroops - troopLoss),
        specialTroops: routDamage.specialTroops,
    };
};

export const getDefenderCavalryEvasion = (
    state: QidahenCore,
    targetRegion: QidahenCore['regions'][number],
    pendingTargetAction: QidahenPendingTargetAction,
    preferredRetreatRegionId?: string,
): {
    retreatRegion: QidahenCore['regions'][number];
    troops: number;
    specialTroops: QidahenSpecialTroopStack[];
} | null => {
    if (
        pendingTargetAction.actionId !== 'raid'
        && pendingTargetAction.actionId !== 'wheel-dispatch'
        && pendingTargetAction.actionId !== 'drive-tiger'
    ) {
        return null;
    }
    if (pendingTargetAction.defenderFactionId === 'neutral') {
        return null;
    }
    if (isQidahenCityRuntimeRegion(targetRegion.id)) {
        return null;
    }

    const specialTroops = filterCompatPiecesToSpecialTroopStacks(
        targetRegion.specialTroops,
        (piece) => piece.troopKind === 'cavalry',
    );
    const troops = getSpecialTroopCount({ specialTroops });
    if (troops <= 0) {
        return null;
    }

    const retreatRegions = findDefenderRetreatRegions(state, targetRegion, pendingTargetAction.defenderFactionId);
    const retreatRegion = retreatRegions.find((region) => region.id === preferredRetreatRegionId)
        ?? retreatRegions[0]
        ?? null;
    if (!retreatRegion) {
        return null;
    }

    return {
        retreatRegion,
        troops,
        specialTroops,
    };
};

export const computeRetreatLoss = (
    survivingTroops: number,
    retreatLossMode: QidahenRetreatLossMode,
): number => (
    retreatLossMode === 'rout'
        ? Math.max(0, survivingTroops)
        : Math.min(1, Math.max(0, survivingTroops))
);
