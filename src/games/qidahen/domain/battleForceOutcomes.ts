import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';
import { getQidahenBattleForceCommitments } from './battleForceCommitments';
import { getRegionSiegeAttackerForceSnapshot } from './battleState';
import { takeCommittedSpecialTroopStacks } from './movementProfileTroopSelection';
import { applyRoutDamageToSpecialStacks } from './pendingBattleCombatSupport';
import {
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
    getSpecialTroopCount,
    sortCompatPiecesForRemoval,
} from './troopCompat';
import type {
    QidahenBattleCasualtyPriority,
    QidahenBattleForceOutcome,
    QidahenCore,
    QidahenPendingTargetAction,
    QidahenRetreatLossMode,
} from './types';

export const buildQidahenBattleForceOutcomes = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    attackerLosses: number,
    casualtyPriority: QidahenBattleCasualtyPriority = 'highest-level',
): QidahenBattleForceOutcome[] => {
    const positionedRegion = pendingTargetAction.attackerPositionRegionId
        ? state.regions.find((region) => (
            !region.isLogicalRegion
            && region.id === pendingTargetAction.attackerPositionRegionId
        )) ?? null
        : null;
    const forceCommitments = positionedRegion
        ? [{
            id: `force-${positionedRegion.id}`,
            sourceRegionId: positionedRegion.id,
            sourceRegionName: positionedRegion.name,
            sourceAvailableTroops: pendingTargetAction.sourceAvailableTroops,
            committedTroops: pendingTargetAction.committedTroops,
            movementProfileId: pendingTargetAction.movementProfileId ?? null,
            battleWidth: pendingTargetAction.battleWidth,
            boundaryUnitCap: pendingTargetAction.boundaryUnitCap,
            attackBoundaryType: pendingTargetAction.attackBoundaryType,
        }]
        : getQidahenBattleForceCommitments(pendingTargetAction);
    const committedForces = forceCommitments
        .map((commitment, forceIndex) => {
            const sourceRegion = state.regions.find((region) => (
                !region.isLogicalRegion
                && region.id === commitment.sourceRegionId
            )) ?? null;
            const sourceSnapshot = sourceRegion
                ? getRegionSiegeAttackerForceSnapshot(
                    sourceRegion,
                    pendingTargetAction.attackerFactionId,
                ) ?? getNonSiegedCityActionSourceSnapshot(sourceRegion)
                : null;
            const hasExactSelection = commitment.selectedSpecialPieceIds != null
                || commitment.selectedGenericTroops != null;
            const committedSpecialTroops = sourceSnapshot
                ? hasExactSelection
                    ? collapseCompatPiecesToSpecialTroopStacks(
                        expandSpecialTroopStacksToCompatPieces(sourceSnapshot.specialTroops)
                            .filter((piece) => commitment.selectedSpecialPieceIds?.includes(piece.id)),
                    )
                    : takeCommittedSpecialTroopStacks(
                        sourceSnapshot,
                        commitment.committedTroops,
                        commitment.movementProfileId,
                    )
                : [];
            const taggedSpecialPieces = expandSpecialTroopStacksToCompatPieces(committedSpecialTroops)
                .map((piece) => ({
                    ...piece,
                    id: `${commitment.id}\u0000${piece.id}`,
                    originalPieceId: piece.id,
                    forceCommitmentId: commitment.id,
                    stackOrder: forceIndex * 100_000 + piece.stackOrder,
                }));
            return {
                commitment,
                taggedSpecialPieces,
            };
        });
    const allSpecialPieces = committedForces.flatMap((force) => force.taggedSpecialPieces);
    const casualtyCandidates = casualtyPriority === 'artillery-first'
        ? allSpecialPieces
        : allSpecialPieces.filter((piece) => piece.troopKind !== 'artillery');
    const removedSpecialPieceIds = new Set(
        sortCompatPiecesForRemoval(casualtyCandidates, casualtyPriority)
            .slice(0, Math.max(0, attackerLosses))
            .map((piece) => piece.id),
    );
    const removedSpecialTroops = allSpecialPieces.filter((piece) => removedSpecialPieceIds.has(piece.id)).length;
    let remainingGenericLosses = Math.max(0, attackerLosses - removedSpecialTroops);

    return committedForces.map(({ commitment, taggedSpecialPieces }) => {
        const specialLosses = taggedSpecialPieces.filter((piece) => removedSpecialPieceIds.has(piece.id)).length;
        const committedGenericTroops = Math.max(0, commitment.committedTroops - taggedSpecialPieces.length);
        const genericLosses = Math.min(committedGenericTroops, remainingGenericLosses);
        remainingGenericLosses -= genericLosses;
        const forceLosses = specialLosses + genericLosses;
        const survivingSpecialTroops = collapseCompatPiecesToSpecialTroopStacks(
            taggedSpecialPieces
                .filter((piece) => !removedSpecialPieceIds.has(piece.id))
                .map((piece) => ({
                    ...piece,
                    id: piece.originalPieceId,
                })),
        );
        return {
            ...commitment,
            attackerLosses: forceLosses,
            survivingTroops: Math.max(0, commitment.committedTroops - forceLosses),
            survivingSpecialTroops,
        };
    });
};

export const buildQidahenBattleForceRetreatOutcomes = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    battleLosses: number,
    totalSourceTroopLoss: number,
    retreatLossMode: QidahenRetreatLossMode,
    skipsDefeatLoss: boolean,
    casualtyPriority: QidahenBattleCasualtyPriority = 'highest-level',
): QidahenBattleForceOutcome[] => {
    if (retreatLossMode !== 'rout' || skipsDefeatLoss) {
        return buildQidahenBattleForceOutcomes(
            state,
            pendingTargetAction,
            totalSourceTroopLoss,
            casualtyPriority,
        );
    }

    return buildQidahenBattleForceOutcomes(
        state,
        pendingTargetAction,
        battleLosses,
        casualtyPriority,
    ).map((outcome) => {
        const survivingSpecialTroopCount = getSpecialTroopCount({
            specialTroops: outcome.survivingSpecialTroops,
        });
        const survivingGenericTroops = Math.max(
            0,
            outcome.survivingTroops - survivingSpecialTroopCount,
        );
        const routDamage = applyRoutDamageToSpecialStacks(outcome.survivingSpecialTroops);
        const routTroopLoss = survivingGenericTroops + routDamage.removedTroops;
        return {
            ...outcome,
            attackerLosses: outcome.attackerLosses + routTroopLoss,
            survivingTroops: Math.max(0, outcome.survivingTroops - routTroopLoss),
            survivingSpecialTroops: routDamage.specialTroops,
        };
    });
};
