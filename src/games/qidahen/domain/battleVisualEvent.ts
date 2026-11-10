import type { GameEvent } from '../../../engine/types';
import type { QidahenCore, QidahenPendingTargetAction, QidahenBattleRolls, QidahenPublicBattleReport } from './types';

/** 与正式战斗同次生成的骰果，只供表现层消费，不是第二次规则结算。 */
export const QIDAHEN_BATTLE_ROLLED = 'QIDAHEN_BATTLE_ROLLED';
export interface QidahenBattleRolledEvent extends GameEvent<typeof QIDAHEN_BATTLE_ROLLED> {
    payload: { report: QidahenPublicBattleReport };
}

export function buildPublicBattleReport(core: QidahenCore, pending: QidahenPendingTargetAction,
    rolls: QidahenBattleRolls, battleId: string): QidahenPublicBattleReport {
    const selectedPieceIds = [...new Set([
        ...(pending.forceCommitments?.flatMap(force => force.selectedSpecialPieceIds ?? []) ?? []),
        ...Object.keys(rolls.attackerMorale.remainingLevels),
    ])];
    const selected = new Set(selectedPieceIds);
    const defenders = new Set(Object.keys(rolls.defenderMorale.remainingLevels));
    const pieces = core.pieces.filter(piece => selected.has(piece.id)
        || defenders.has(piece.id));
    const ids = new Set(pieces.map(piece => piece.id));
    const mapTokens = core.mapTokens.filter(token => token.type === 'army' && token.pieceId && ids.has(token.pieceId));
    return { battleId, sourceRegionId: pending.sourceRegionId, sourceRegionName: pending.sourceRegionName,
        targetRegionId: pending.targetRegionId, targetRuntimeRegionId: pending.targetRuntimeRegionId,
        targetRegionName: pending.targetRegionName, attackerFactionId: pending.attackerFactionId,
        defenderFactionId: pending.defenderFactionId, defenderLabel: pending.defenderLabel,
        selectedPieceIds, battlefield: { pieces, mapTokens }, rolls };
}
