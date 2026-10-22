import type { GameOverResult } from '../../../engine/types';
import type { BattleResult, FateDominationCore, LocationId } from './types';
import { calculateFatePower } from './power';
import { normalizeFateRuleState } from './mechanics';

/** CHM: event and competition VP are shared, personal win rewards are not. */
export function fateLocationResults(core: FateDominationCore, locationId: LocationId): BattleResult[] {
    if (locationId === 'workshop') return [];
    const location = core.battlefield[locationId];
    const participants = location.playerIds.filter(id => !core.players[id].eliminated);
    const eligible = participants.filter(id => locationId === 'recon' || !core.players[id].defeatMarkers.length);
    const powers = eligible.map(id => ({ id, power: calculateFatePower(core, id, core.players[id].activeAttackIds) }));
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

export function fateFinalResult(core: FateDominationCore, results: BattleResult[]): GameOverResult {
    const scores = Object.fromEntries(core.playerIds.map(id => [id, core.players[id].victoryPoints + results.filter(result => result.playerId === id).reduce((sum, result) => sum + result.totalVictoryPoints, 0)]));
    const eligible = core.playerIds.filter(id => !core.players[id].eliminated);
    const highest = Math.max(...eligible.map(id => scores[id]));
    const tied = eligible.filter(id => scores[id] === highest);
    if (tied.length === 1) return { winner: tied[0], scores };
    const miyamaWinners = tied.filter(id => results.some(result => result.playerId === id && result.locationId === 'miyama' && result.status === 'representative-win'));
    return miyamaWinners.length === 1 ? { winner: miyamaWinners[0], scores } : { winners: [], draw: false, scores };
}

/** Empty battle still needs a cleanup carrier, never an invented victory. */
export const emptyFateBattleResult = (playerId: string): BattleResult => ({ playerId, locationId: 'workshop', power: 0, eventVictoryPoints: 0, competitionVictoryPoints: 0, totalVictoryPoints: 0, status: 'deferred' });
