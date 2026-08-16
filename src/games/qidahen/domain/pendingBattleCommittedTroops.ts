import {
    computeQidahenAttackPressure,
    computeQidahenEffectiveCommittedTroops,
} from './attackRules';
import { updateQidahenPrimaryForceCommittedTroops } from './battleForceCommitments';
import { getPendingActionSourceForceSnapshot } from './battleState';
import { hasActiveCharacter } from './characterPresenceAccessors';
import type { QidahenMovementProfileId } from './movement';
import { countCompatPieces } from './troopCompat';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
} from './types';

type QidahenRuntimeRegion = QidahenCore['regions'][number];

interface QidahenPendingBattleCommittedTroopsDependencies {
    getPendingActionSourceForceSnapshot: typeof getPendingActionSourceForceSnapshot;
}

export const getQidahenCharacterCommittedTroopLimit = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    actionId: 'raid' | 'wheel-dispatch' | 'drive-tiger',
): number | null => {
    const commandingFactionId = actionId === 'drive-tiger' ? 'ming' : attackerFactionId;
    if (commandingFactionId === 'ming' && hasActiveCharacter(state, 'ming', 'ming-yang-gao')) {
        return 10;
    }
    return null;
};

export const getMovableTroopCountForProfile = (
    region: Pick<QidahenRuntimeRegion, 'troops' | 'specialTroops'>,
    movementProfileId: QidahenMovementProfileId | string | null | undefined,
): number => {
    if (region.specialTroops.length === 0) {
        return region.troops;
    }

    const cavalryCount = countCompatPieces(region.specialTroops, (piece) => piece.troopKind === 'cavalry');
    if (movementProfileId === 'cavalry' || movementProfileId === 'dispatch-cavalry') {
        return Math.max(0, Math.min(region.troops, cavalryCount));
    }

    return Math.max(0, region.troops - cavalryCount);
};

export const applyRequestedCommittedTroops = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    requestedCommittedTroops: number | undefined,
    dependencies: QidahenPendingBattleCommittedTroopsDependencies = {
        getPendingActionSourceForceSnapshot,
    },
): QidahenPendingTargetAction => {
    if (
        requestedCommittedTroops == null
        || !Number.isFinite(requestedCommittedTroops)
        || (pendingTargetAction.actionId !== 'raid'
            && pendingTargetAction.actionId !== 'wheel-dispatch'
            && pendingTargetAction.actionId !== 'drive-tiger')
    ) {
        return pendingTargetAction;
    }

    const sourceRegion = dependencies.getPendingActionSourceForceSnapshot(state, pendingTargetAction);
    const sourceAvailableTroops = sourceRegion
        ? pendingTargetAction.movementProfileId
            ? getMovableTroopCountForProfile(
                sourceRegion,
                pendingTargetAction.movementProfileId,
            )
            : sourceRegion.troops
        : pendingTargetAction.sourceAvailableTroops;
    const maxCommittedTroops = computeQidahenEffectiveCommittedTroops({
        actionId: pendingTargetAction.actionId,
        availableTroops: Math.min(pendingTargetAction.sourceAvailableTroops, sourceAvailableTroops),
        boundaryUnitCap: pendingTargetAction.boundaryUnitCap,
        characterCommittedTroopLimit: getQidahenCharacterCommittedTroopLimit(
            state,
            pendingTargetAction.attackerFactionId,
            pendingTargetAction.actionId,
        ),
    });
    if (maxCommittedTroops <= 0) {
        return pendingTargetAction;
    }

    const committedTroops = Math.max(1, Math.min(Math.floor(requestedCommittedTroops), maxCommittedTroops));
    if (committedTroops === pendingTargetAction.committedTroops) {
        return pendingTargetAction;
    }

    const attackPressure = computeQidahenAttackPressure(committedTroops, pendingTargetAction.battleWidth);
    return {
        ...updateQidahenPrimaryForceCommittedTroops(pendingTargetAction, committedTroops),
        attackPressure,
        resolutionHint: `${pendingTargetAction.resolutionHint} · 实出${committedTroops}/战力${attackPressure}`,
    };
};
