import type {
    QidahenBattleForceCommitment,
    QidahenBattleForceOutcome,
    QidahenPendingTargetAction,
} from './types';
import { expandSpecialTroopStacksToCompatPieces, getSpecialTroopCount } from './troopCompat';

export const createQidahenBattleForceCommitment = (
    input: Omit<QidahenBattleForceCommitment, 'id'> & { id?: string },
): QidahenBattleForceCommitment => ({
    ...input,
    id: input.id ?? `force-${input.sourceRegionId}`,
});

export const getQidahenBattleForceCommitments = (
    pendingTargetAction: QidahenPendingTargetAction,
): QidahenBattleForceCommitment[] => {
    const explicitCommitments = pendingTargetAction.forceCommitments
        ?.filter((commitment) => commitment.committedTroops > 0)
        .map((commitment) => ({ ...commitment }));
    if (explicitCommitments && explicitCommitments.length > 0) {
        return explicitCommitments;
    }
    if (!pendingTargetAction.sourceRegionId) {
        return [];
    }
    return [createQidahenBattleForceCommitment({
        sourceRegionId: pendingTargetAction.sourceRegionId,
        sourceRegionName: pendingTargetAction.sourceRegionName ?? pendingTargetAction.sourceRegionId,
        sourceAvailableTroops: pendingTargetAction.sourceAvailableTroops,
        committedTroops: pendingTargetAction.committedTroops,
        movementProfileId: pendingTargetAction.movementProfileId ?? null,
        battleWidth: pendingTargetAction.battleWidth,
        boundaryUnitCap: pendingTargetAction.boundaryUnitCap,
        attackBoundaryType: pendingTargetAction.attackBoundaryType,
    })];
};

export const updateQidahenPrimaryForceCommittedTroops = (
    pendingTargetAction: QidahenPendingTargetAction,
    primaryCommittedTroops: number,
): QidahenPendingTargetAction => {
    const commitments = getQidahenBattleForceCommitments(pendingTargetAction);
    const primaryCommitment = commitments[0];
    if (!primaryCommitment) {
        return pendingTargetAction;
    }
    const nextCommitments = [
        {
            ...primaryCommitment,
            committedTroops: primaryCommittedTroops,
        },
        ...commitments.slice(1),
    ];
    return {
        ...pendingTargetAction,
        sourceAvailableTroops: primaryCommitment.sourceAvailableTroops,
        committedTroops: nextCommitments.reduce((total, commitment) => total + commitment.committedTroops, 0),
        forceCommitments: nextCommitments,
    };
};

export const updateQidahenForceCommitmentsFromOutcomes = (
    pendingTargetAction: QidahenPendingTargetAction,
    forceOutcomes: QidahenBattleForceOutcome[],
): QidahenPendingTargetAction => {
    const nextCommitments = forceOutcomes
        .filter((outcome) => outcome.survivingTroops > 0)
        .map((outcome): QidahenBattleForceCommitment => ({
            id: outcome.id,
            sourceRegionId: outcome.sourceRegionId,
            sourceRegionName: outcome.sourceRegionName,
            sourceAvailableTroops: outcome.survivingTroops,
            committedTroops: outcome.survivingTroops,
            movementProfileId: outcome.movementProfileId ?? null,
            battleWidth: outcome.battleWidth,
            boundaryUnitCap: outcome.boundaryUnitCap,
            attackBoundaryType: outcome.attackBoundaryType,
            selectedSpecialPieceIds: expandSpecialTroopStacksToCompatPieces(outcome.survivingSpecialTroops).map((piece) => piece.id),
            selectedGenericTroops: Math.max(0, outcome.survivingTroops - getSpecialTroopCount({ specialTroops: outcome.survivingSpecialTroops })),
        }));
    const primaryCommitment = nextCommitments[0];
    const committedTroops = nextCommitments.reduce(
        (total, commitment) => total + commitment.committedTroops,
        0,
    );

    return {
        ...pendingTargetAction,
        sourceRegionId: primaryCommitment?.sourceRegionId ?? pendingTargetAction.sourceRegionId,
        sourceRegionName: primaryCommitment?.sourceRegionName ?? pendingTargetAction.sourceRegionName,
        sourceAvailableTroops: committedTroops,
        committedTroops,
        movementProfileId: primaryCommitment?.movementProfileId ?? pendingTargetAction.movementProfileId,
        forceCommitments: nextCommitments,
    };
};

// 正式规则p5：每条攻城战线宽度为1，多条战线相加；仍保留各来源的真实参战集合。
export const updateQidahenForceCommitmentsForCityBattle = (
    pending: QidahenPendingTargetAction,
): QidahenPendingTargetAction => {
    const forceCommitments = getQidahenBattleForceCommitments(pending).map((force) => ({
        ...force, battleWidth: 1, attackBoundaryType: 'city' as const,
    }));
    const battleWidth = Math.max(1, forceCommitments.length);
    return { ...pending, battleMode: 'city', battleWidth, attackBoundaryType: 'city', forceCommitments,
        attackPressure: Math.min(pending.committedTroops, battleWidth) };
};
