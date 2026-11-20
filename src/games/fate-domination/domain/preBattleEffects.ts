import { fateAbilityUsageKey } from './abilitySource';
import { resolveFatePlayerAbility } from './abilityRegistry';
import { fatePlayedSpecialAttackThisRound } from './attackSelection';
import { fateBattleOpponents } from './battleAwards';
import type { FateDefeatDeclaredEvent, FateDominationCore } from './types';

export function fatePreBattleDefeatEvents(core: FateDominationCore, meta: {
    timestamp: number;
    sourceCommandType: string;
}): FateDefeatDeclaredEvent[] {
    return core.turnOrder.flatMap(actorId => {
        const actor = core.players[actorId];
        if (actor.eliminated) return [];
        return actor.activeSkills.flatMap(sourceId => {
            const used = actor.usedAbilityIds.includes(fateAbilityUsageKey(sourceId, 'action'));
            if (!used || !resolveFatePlayerAbility(core, actorId, sourceId)?.effects.some(effect => effect.type === 'pre-battle-defeat-without-special')) return [];
            return fateBattleOpponents(core, actorId).flatMap(playerId => {
                return fatePlayedSpecialAttackThisRound(core.players[playerId]) ? [] : [{
                    type: 'FATE_DEFEAT_DECLARED' as const,
                    payload: { playerId, sourceId, direct: true, markerId: `${core.round}:${actorId}:${sourceId}:${playerId}` },
                    ...meta,
                }];
            });
        });
    });
}
