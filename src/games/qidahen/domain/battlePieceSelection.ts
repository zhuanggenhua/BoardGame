import { getPendingActionSourceForceSnapshot } from './battleState';
import { getQidahenBattleForceCommitments } from './battleForceCommitments';
import { expandSpecialTroopStacksToCompatPieces } from './troopCompat';
import { isTroopKindAllowedForMovementProfile } from './movementProfileTroopSelection';
import { getQidahenCharacterCommittedTroopLimit } from './pendingBattleCommittedTroops';
import type { QidahenCore, QidahenPendingTargetAction } from './types';

export function getQidahenBattleSelectablePieces(core: QidahenCore, pending: QidahenPendingTargetAction) {
    const source = getPendingActionSourceForceSnapshot(core, pending);
    return source ? expandSpecialTroopStacksToCompatPieces(source.specialTroops)
        .filter(piece => piece.faction === pending.attackerFactionId
            && isTroopKindAllowedForMovementProfile(piece.troopKind, pending.movementProfileId)) : [];
}

export function isQidahenBattlePieceSelectionValid(core: QidahenCore, pending: QidahenPendingTargetAction, ids: readonly string[]): boolean {
    if (pending.actionId === 'marriage-subjugation') return false;
    const candidates = getQidahenBattleSelectablePieces(core, pending);
    const selected = candidates.filter(piece => ids.includes(piece.id));
    const commandLimit = getQidahenCharacterCommittedTroopLimit(core, pending.attackerFactionId, pending.actionId) ?? 6;
    return ids.length > 0 && ids.length <= commandLimit
        && new Set(ids).size === ids.length && selected.length === ids.length
        && selected.filter(piece => piece.troopKind !== 'artillery').length <= pending.battleWidth
        && (pending.boundaryUnitCap == null || ids.length <= pending.boundaryUnitCap);
}

/** 玩家明确选择的兵牌写入现有参战集合，掷骰、伤亡与战后移动继续消费同一集合。 */
export function applyQidahenBattlePieceSelection(core: QidahenCore, pending: QidahenPendingTargetAction, ids: readonly string[]): QidahenPendingTargetAction {
    if (!isQidahenBattlePieceSelectionValid(core, pending, ids)) return pending;
    const commitments = getQidahenBattleForceCommitments(pending);
    const primary = commitments[0];
    if (!primary) return pending;
    const forceCommitments = [{ ...primary, committedTroops: ids.length, selectedSpecialPieceIds: [...ids], selectedGenericTroops: 0 }, ...commitments.slice(1)];
    return { ...pending, forceCommitments, committedTroops: forceCommitments.reduce((sum, force) => sum + force.committedTroops, 0), attackPressure: Math.min(ids.length, pending.battleWidth) };
}
