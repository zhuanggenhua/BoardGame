import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';
import { getQidahenBattleForceCommitments } from './battleForceCommitments';
import { getRegionSiegeAttackerForceSnapshot } from './battleState';
import { takeCommittedSpecialTroopStacks } from './movementProfileTroopSelection';
import { applyRoutDamageToSpecialStacks, pruneUnsupportedRetreatArtillery } from './pendingBattleCombatSupport';
import { applyQidahenBattleMoraleToStacks } from './battleMorale';
import {
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
    getSpecialTroopCount,
    sortCompatPiecesForRemoval,
} from './troopCompat';
import type {
    QidahenBattleCasualtyPriority,
    QidahenBattleForceOutcome,
    QidahenBattleMoraleResult,
    QidahenCore,
    QidahenPendingTargetAction,
    QidahenRetreatLossMode,
} from './types';

export const buildQidahenBattleForceOutcomes = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    attackerLosses: number,
    casualtyPriority: QidahenBattleCasualtyPriority = 'highest-level',
    morale?: QidahenBattleMoraleResult,
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
    const removedSpecialPieceIds = morale ? new Set(
        allSpecialPieces.filter((piece) => morale.remainingLevels[piece.originalPieceId] === 0).map((piece) => piece.id),
    ) : new Set(
        sortCompatPiecesForRemoval(casualtyCandidates, casualtyPriority)
            .slice(0, Math.max(0, attackerLosses))
            .map((piece) => piece.id),
    );
    const removedSpecialTroops = allSpecialPieces.filter((piece) => removedSpecialPieceIds.has(piece.id)).length;
    let remainingGenericLosses = Math.max(0, attackerLosses - removedSpecialTroops);

    return committedForces.map(({ commitment, taggedSpecialPieces }) => {
        if (morale) {
            const originalPieces = taggedSpecialPieces.map((piece) => ({ ...piece, id: piece.originalPieceId }));
            const survivingSpecialTroops = applyQidahenBattleMoraleToStacks(
                collapseCompatPiecesToSpecialTroopStacks(originalPieces), morale,
            );
            const specialLosses = originalPieces.length - getSpecialTroopCount({ specialTroops: survivingSpecialTroops });
            const genericTroops = Math.max(0, commitment.committedTroops - originalPieces.length);
            const genericLosses = Math.min(genericTroops, Math.max(0, remainingGenericLosses));
            remainingGenericLosses -= genericLosses;
            return {
                ...commitment,
                selectedSpecialPieceIds: originalPieces.map((piece) => piece.id),
                selectedGenericTroops: genericTroops,
                attackerLosses: specialLosses + genericLosses,
                survivingTroops: commitment.committedTroops - specialLosses - genericLosses,
                survivingSpecialTroops,
            };
        }
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
    morale?: QidahenBattleMoraleResult,
): QidahenBattleForceOutcome[] => {
    if (morale) {
        const pruneRetreatForce = (outcome: QidahenBattleForceOutcome): QidahenBattleForceOutcome => {
            const surviving = pruneUnsupportedRetreatArtillery(outcome.survivingSpecialTroops, outcome.survivingTroops);
            return { ...outcome, attackerLosses: outcome.attackerLosses + outcome.survivingTroops - surviving.troops,
                survivingTroops: surviving.troops, survivingSpecialTroops: surviving.specialTroops };
        };
        const outcomes = buildQidahenBattleForceOutcomes(state, pendingTargetAction, battleLosses, casualtyPriority, morale);
        if (skipsDefeatLoss) return outcomes.map(pruneRetreatForce);
        if (retreatLossMode === 'rout') {
            return outcomes.map((outcome) => {
                const rout = applyRoutDamageToSpecialStacks(outcome.survivingSpecialTroops);
                const genericLoss = Math.max(0, outcome.survivingTroops - getSpecialTroopCount({ specialTroops: outcome.survivingSpecialTroops }));
                const loss = rout.removedTroops + genericLoss;
                return { ...outcome, attackerLosses: outcome.attackerLosses + loss, survivingTroops: outcome.survivingTroops - loss, survivingSpecialTroops: rout.specialTroops };
            }).map(pruneRetreatForce);
        }
        const candidates = outcomes.flatMap((outcome, forceIndex) => expandSpecialTroopStacksToCompatPieces(outcome.survivingSpecialTroops)
            .filter((piece) => piece.troopKind !== 'artillery').map((piece) => ({ ...piece, forceIndex })));
        const rearGuardPiece = sortCompatPiecesForRemoval(candidates, 'highest-level')[0];
        const rearGuard = candidates.find((piece) => piece.id === rearGuardPiece?.id);
        const genericForceIndex = outcomes.findIndex((outcome) => outcome.survivingTroops > getSpecialTroopCount({ specialTroops: outcome.survivingSpecialTroops }));
        return outcomes.map((outcome, forceIndex) => {
            const losesSpecial = rearGuard?.forceIndex === forceIndex;
            const loss = losesSpecial || (!rearGuard && genericForceIndex === forceIndex) ? 1 : 0;
            return { ...outcome, attackerLosses: outcome.attackerLosses + loss, survivingTroops: outcome.survivingTroops - loss,
                survivingSpecialTroops: losesSpecial ? collapseCompatPiecesToSpecialTroopStacks(expandSpecialTroopStacksToCompatPieces(outcome.survivingSpecialTroops).filter((piece) => piece.id !== rearGuard.id)) : outcome.survivingSpecialTroops };
        }).map(pruneRetreatForce);
    }
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
