import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FATE_SERVANT_BY_ID } from '../data';
import { FateDominationDomain } from '../domain';
import { fateFinalResult, fateLocationResults } from '../domain/battleAwards';
import { calculateFatePower } from '../domain/power';
import { engineConfig } from '../game';
import { FATE_BATTLE_LOCATION_ORDER, type LocationResolvedEvent } from '../domain/types';

const playerIds = ['0', '1', '2'];

function fightWithExcalibur(round: number) {
    const random = createSeededRandom('excalibur');
    const core = FateDominationDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, engineConfig.systems, 'excalibur');
    const saber = core.players['0'];
    saber.servantId = 'servant-saber';
    saber.isRevealed = true;
    const card = FATE_SERVANT_BY_ID[saber.servantId].skillCards!.find(skill => skill.id === 'sc_saber_np')!;
    const skill = { ...card, id: `${card.id}:2` };
    saber.skills = [skill];
    saber.activeSkills = [skill.id];
    saber.locationId = 'miyama';
    core.players['1'].victoryPoints = 40;
    core.players['1'].locationId = 'miyama';
    core.phase = 'battle';
    core.round = round;
    core.currentPlayerId = '0';
    core.battlefield.miyama.playerIds = ['0', '1'];
    const activate = () => executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems },
        { core, sys }, { type: 'PLAY_SKILL', playerId: '0', payload: { skillId: skill.id } }, random, playerIds);
    const resolve = (state = { core, sys }) => executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, {
        ...state,
        core: { ...state.core, battleResolution: { frameId: 'test-excalibur-locations', round, step: 'locations',
            locationIds: [...FATE_BATTLE_LOCATION_ORDER], resolvedLocationIds: [] } },
    }, { type: 'RESOLVE_LOCATION', playerId: '0', payload: { locationId: 'miyama' } }, random, playerIds);
    return { core, activate, resolve };
}

it('第8天无法发动誓约胜利之剑的战斗能力，第9天发动后合计威力加4', () => {
    expect(fightWithExcalibur(8).activate()).toMatchObject({ success: false, error: 'climaxRoundRequired' });
    const { core, activate } = fightWithExcalibur(9);
    const previous = calculateFatePower(core, '0', []);
    const result = activate();
    expect(result.success).toBe(true);
    expect(calculateFatePower(result.state.core, '0', [])).toBe(previous + 4);
});

it('第11天发动誓约胜利之剑并赢得战斗后，即使战果落后也赢得游戏', () => {
    const { core, activate } = fightWithExcalibur(11);
    expect(fateFinalResult(core, fateLocationResults(core, 'miyama')).winner).toBe('1');
    const result = activate();
    expect(result.success).toBe(true);
    const active = result.state.core;
    const outcome = fateFinalResult(active, fateLocationResults(active, 'miyama'));
    expect(outcome).toMatchObject({ winner: '0', victoryCondition: 'excalibur' });
    expect(outcome.scores?.['0']).toBeLessThan(outcome.scores?.['1'] ?? 0);

    active.players['1'].hand = Array.from({ length: 5 }, (_, i) => ({ id: `attack-${i}`, definitionId: 'cardB4' }));
    active.players['1'].activeAttackIds = active.players['1'].hand.map(card => card.id);
    const ordinary = fateFinalResult(active, fateLocationResults(active, 'miyama'));
    expect(ordinary.winner).toBe('1');
    expect(ordinary.victoryCondition).toBeUndefined();
});

it('宝具演出只由已发动的誓约胜利之剑触发，明置打出和解放真名不足以触发', () => {
    const { activate, resolve } = fightWithExcalibur(11);
    const stages = [resolve(), resolve(activate().state)];
    for (const result of stages) expect(result.success, result.error).toBe(true);
    const cues = stages.map(result => (result.events.find(event => event.type === 'LOCATION_RESOLVED') as LocationResolvedEvent).payload.noblePlayerIds);
    expect(cues).toEqual([[], ['0']]);
});
