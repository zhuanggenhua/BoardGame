import {
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
    sortCompatPiecesForSelection,
} from './troopCompat';
import type {
    QidahenCasualtyPriority,
    QidahenCore,
    QidahenSpecialTroopStack,
    QidahenTroopKind,
} from './types';

export const isTroopKindAllowedForMovementProfile = (
    troopKind: QidahenTroopKind,
    movementProfileId?: string | null,
): boolean => {
    if (movementProfileId === 'cavalry' || movementProfileId === 'dispatch-cavalry') {
        return troopKind === 'cavalry';
    }
    if (movementProfileId === 'infantry' || movementProfileId === 'dispatch-infantry') {
        return troopKind !== 'cavalry';
    }
    return true;
};

export const takeCommittedSpecialTroopStacks = (
    region: Pick<QidahenCore['regions'][number], 'specialTroops'>,
    committedTroops: number,
    movementProfileId?: string | null,
    casualtyPriority: QidahenCasualtyPriority = 'highest-level',
): QidahenSpecialTroopStack[] => collapseCompatPiecesToSpecialTroopStacks(
    sortCompatPiecesForSelection(
        expandSpecialTroopStacksToCompatPieces(region.specialTroops)
            .filter((piece) => isTroopKindAllowedForMovementProfile(piece.troopKind, movementProfileId)),
        casualtyPriority,
    ).slice(0, Math.max(0, committedTroops)),
);
