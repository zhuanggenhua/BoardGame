import { syncQidahenCorePieceCollections } from './coreDerivedState';
import type { QidahenCore, QidahenFactionId } from './types';

/** 只累计正式落盘造成的新实体与已结束的真实战斗，不从VP或现存部队倒推年度成绩。 */
export function recordQidahenChronologyStatistics(before: QidahenCore, after: QidahenCore): QidahenCore {
    if (before === after) return after;
    const next = before.regions !== after.regions ? syncQidahenCorePieceCollections(after) : after;
    if (before.chronology.yearStats !== next.chronology.yearStats) return next;
    const previousIds = new Set(before.pieces.map(piece => piece.id));
    const built: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };
    for (const piece of next.pieces) if (!previousIds.has(piece.id)) built[piece.faction] += 1;
    const oldBattle = before.pendingTargetAction;
    const rolls = oldBattle?.resolvedBattleRolls ?? next.postBattleSelection?.battleRolls;
    const battleFinished = Boolean(oldBattle && rolls && (next.postBattleSelection && next.postBattleSelection !== before.postBattleSelection
        || !next.pendingTargetAction || next.pendingTargetAction.targetRuntimeRegionId !== oldBattle.targetRuntimeRegionId));
    const winner = battleFinished && oldBattle && rolls ? (rolls.attackerMorale.survivingCombatTroops > rolls.defenderMorale.survivingCombatTroops ? oldBattle.attackerFactionId : oldBattle.defenderFactionId) : null;
    let yearStats = next.chronology.yearStats;
    for (const id of ['ming', 'mongol', 'jin'] as const) {
        if (built[id] || winner === id) yearStats = { ...yearStats, [id]: { ...yearStats[id], builtTroops: yearStats[id].builtTroops + built[id], victories: yearStats[id].victories + Number(winner === id) } };
    }
    const factions = before.regions !== next.regions ? Object.fromEntries((['ming', 'mongol', 'jin'] as const).map(id => [id, { ...next.factions[id], troops: next.pieces.filter(piece => piece.faction === id).length }])) as QidahenCore['factions'] : next.factions;
    return yearStats === next.chronology.yearStats && factions === next.factions ? next : { ...next, factions, chronology: { ...next.chronology, yearStats } };
}
