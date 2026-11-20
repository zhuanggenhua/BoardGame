import type { BattleResult, FateBattleScoreAdjustedEvent, FateDominationCore, FateGameResult, LocationId, PlayerState } from './types';
import { calculateFatePower } from './power';
import { normalizeFateRuleState } from './mechanics';
import { fateAbilityUsageKey } from './abilitySource';
import { resolveFatePlayerAbility } from './abilityRegistry';

export function fateBattleOpponents(core: FateDominationCore, playerId: string): string[] {
    const location = core.players[playerId]?.locationId;
    if (location !== 'miyama' && location !== 'shinto') return [];
    return core.battlefield[location].playerIds.filter(id => id !== playerId && !core.players[id].eliminated);
}

export function fatePostBattleScoreEvents(core: FateDominationCore, results: readonly Pick<BattleResult, 'playerId' | 'status'>[], meta: {
    timestamp: number;
    sourceCommandType?: string;
}): FateBattleScoreAdjustedEvent[] {
    return core.turnOrder.flatMap(playerId => {
        const player = core.players[playerId];
        if (player.eliminated) return [];
        const opponents = fateBattleOpponents(core, playerId);
        if (!opponents.length) return [];
        const won = results.some(result => result.playerId === playerId && result.status === 'representative-win');
        return player.activeSkills.flatMap(sourceId => {
            const used = player.usedAbilityIds.includes(fateAbilityUsageKey(sourceId, 'battle'));
            if (!used || !resolveFatePlayerAbility(core, playerId, sourceId)?.effects.some(effect => effect.type === 'post-battle-score-per-opponent')) return [];
            return [{
                type: 'FATE_BATTLE_SCORE_ADJUSTED' as const,
                payload: {
                    sourceId,
                    changes: [{ playerId, amount: opponents.length },
                        ...(won ? opponents.map(id => ({ playerId: id, amount: -opponents.length })) : [])],
                },
                ...meta,
            }];
        });
    });
}

export function applyFateBattleScoreAdjustment(core: FateDominationCore, event: FateBattleScoreAdjustedEvent): FateDominationCore {
    const players = { ...core.players };
    for (const { playerId, amount } of event.payload.changes) {
        const player = players[playerId];
        players[playerId] = { ...player, victoryPoints: player.victoryPoints + amount };
    }
    return { ...core, players };
}

/** CHM: event and competition VP are shared, personal win rewards are not. */
export function fateLocationResults(core: FateDominationCore, locationId: LocationId,
    powerFor = (id: string) => calculateFatePower(core, id, core.players[id].activeAttackIds)): BattleResult[] {
    if (locationId === 'workshop') return [];
    const location = core.battlefield[locationId];
    const participants = location.playerIds.filter(id => !core.players[id].eliminated);
    const eligible = participants.filter(id => locationId === 'recon' || !core.players[id].defeatMarkers.length);
    const powers = eligible.map(id => ({ id, power: powerFor(id) }));
    const highest = Math.max(...powers.map(item => item.power));
    const winnerCount = powers.filter(item => item.power === highest).length;
    const events = location.eventCards.length ? location.eventCards : locationId === 'recon' ? [] : core.currentEvents[locationId];
    const eventVP = events.reduce((sum, event) => sum + event.victoryPoints, 0);
    const competitionVP = participants.length > 1 ? location.competitionVictoryPoints : 0;
    return powers.map(({ id, power }) => {
        const won = locationId !== 'recon' && power === highest;
        const personalVP = won ? normalizeFateRuleState(core.ruleState).modifiers.reduce((sum, modifier) => sum + (modifier.kind === 'battle-win-reward' && modifier.playerId === id ? modifier.victoryPoints : 0), 0) : 0;
        return {
            playerId: id, locationId, power,
            eventVictoryPoints: won ? eventVP : 0,
            competitionVictoryPoints: won ? competitionVP : 0,
            commandSpellVictoryPoints: personalVP,
            totalVictoryPoints: locationId === 'recon' ? 2 : won ? Math.ceil((eventVP + competitionVP) / winnerCount) + personalVP : 0,
            status: locationId === 'recon' ? 'recon' : won ? 'representative-win' : 'deferred',
        };
    });
}

export function fateFinalResult(core: FateDominationCore, results: BattleResult[]): FateGameResult {
    const scores = Object.fromEntries(core.playerIds.map(id => [id, core.players[id].victoryPoints + results.filter(result => result.playerId === id).reduce((sum, result) => sum + result.totalVictoryPoints, 0)]));
    const eligible = core.playerIds.filter(id => !core.players[id].eliminated);
    const excaliburWinner = core.round === 11 && results.find(result => {
        const player = core.players[result.playerId];
        return result.status === 'representative-win' && !player.eliminated && fateExcaliburWasInvoked(player);
    });
    if (excaliburWinner) return { winner: excaliburWinner.playerId, scores, victoryCondition: 'excalibur' };
    const highest = Math.max(...eligible.map(id => scores[id]));
    const tied = eligible.filter(id => scores[id] === highest);
    if (tied.length === 1) return { winner: tied[0], scores };
    const miyamaWinners = tied.filter(id => results.some(result => result.playerId === id && result.locationId === 'miyama' && result.status === 'representative-win'));
    return miyamaWinners.length === 1 ? { winner: miyamaWinners[0], scores } : { winners: [], draw: false, scores };
}

export function fateExcaliburWasInvoked(player: PlayerState): boolean {
    return player.servantId === 'servant-saber' && player.activeSkills.some(id =>
        id.split(':')[0] === 'sc_saber_np' && player.usedAbilityIds.includes(fateAbilityUsageKey(id, 'battle')));
}

/** Empty battle still needs a cleanup carrier, never an invented victory. */
export const emptyFateBattleResult = (playerId: string): BattleResult => ({ playerId, locationId: 'workshop', power: 0, eventVictoryPoints: 0, competitionVictoryPoints: 0, totalVictoryPoints: 0, status: 'deferred' });
