import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FATE_ATTACK_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../data';
import { FateDominationDomain } from '../domain';
import { calculateFatePower } from '../domain/power';
import type { FateDominationCommand } from '../domain/types';
import { engineConfig } from '../game';

it('对魔力与风王结界只归零同场对手的对应属性，并在换轮时失效', () => {
    const ids = ['0', '1', '2', '3'];
    const random = createSeededRandom('saber-nullification');
    const core = FateDominationDomain.setup(ids, random);
    let state = { core, sys: createInitialSystemState(ids, engineConfig.systems, 'saber-nullification') };
    core.phase = 'battle';
    core.currentPlayerId = '0';
    core.turnOrder = ids;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit1')!;
    core.currentEvents = { miyama: [], shinto: [] };
    core.battlefield.miyama = { ...core.battlefield.miyama, playerIds: ['0', '1', '2'], eventCards: [] };
    core.battlefield.shinto = { ...core.battlefield.shinto, playerIds: ['3'], eventCards: [] };
    for (const id of ids) {
        const player = core.players[id];
        player.locationId = id === '3' ? 'shinto' : 'miyama';
        player.hand = ['cardA1', 'cardB1', 'cardQ2'].map(definitionId => ({ id: `${id}-${definitionId}`, definitionId }));
        player.activeAttackIds = player.hand.map(card => card.id);
    }
    const saber = core.players['0'];
    saber.isRevealed = true;
    saber.servantId = 'servant-saber';
    saber.skills = FATE_SERVANT_BY_ID[saber.servantId].skillCards!.map((card, index) => ({ ...card, id: `${card.id}:${index}` }));
    const [counterMagic, invisibleAir] = saber.skills;
    saber.activeSkills = [counterMagic.id, invisibleAir.id];
    const power = (id: string) => calculateFatePower(state.core, id, state.core.players[id].activeAttackIds);
    const initial = Object.fromEntries(ids.map(id => [id, power(id)]));
    const submit = (command: FateDominationCommand) => {
        const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, command, random, ids);
        expect(result.success, result.error).toBe(true);
        state = result.state;
    };

    submit({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId: counterMagic.id } });
    expect(['1', '2'].map(id => initial[id] - power(id))).toEqual([FATE_ATTACK_BY_ID.cardA1.basePower, FATE_ATTACK_BY_ID.cardA1.basePower]);
    submit({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId: invisibleAir.id } });
    expect(['1', '2'].map(power)).toEqual([FATE_ATTACK_BY_ID.cardQ2.basePower, FATE_ATTACK_BY_ID.cardQ2.basePower]);
    expect(power('0')).toBe(initial['0']);
    expect(power('3')).toBe(initial['3']);

    for (const playerId of ids) submit({ type: 'ADVANCE_PHASE', playerId, payload: {} });
    for (const locationId of ['miyama', 'shinto', 'recon'] as const) {
        submit({ type: 'RESOLVE_LOCATION', playerId: state.core.currentPlayerId, payload: { locationId } });
    }
    expect(state.core.phase).toBe('preparation');
    expect(state.core.ruleState.modifiers).toHaveLength(0);
});
