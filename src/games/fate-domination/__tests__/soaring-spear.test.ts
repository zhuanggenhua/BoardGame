import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import type { Command } from '../../../engine/types';
import { FATE_EVENTS, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../data';
import { FateDominationDomain } from '../domain';
import { fateLocationResults } from '../domain/battleAwards';
import { engineConfig } from '../game';

it.each([
    { won: true, withChoice: false },
    { won: false, withChoice: false },
    { won: true, withChoice: true },
])('突穿死翔之枪按交战人数加战果（胜利=$won，战后选择=$withChoice）', ({ won, withChoice }) => {
    const playerIds = ['0', '1', '2'];
    const random = createSeededRandom('soaring-spear');
    const core = FateDominationDomain.setup(playerIds, random);
    let state = { core, sys: createInitialSystemState(playerIds, engineConfig.systems, 'soaring-spear') };
    core.round = 11;
    core.phase = 'battle';
    core.currentPlayerId = '0';
    core.turnOrder = playerIds;
    core.situation = FATE_SITUATIONS.find(card => card.id === 'sit13')!;
    core.currentEvents = { miyama: [], shinto: [] };
    for (const location of Object.values(core.battlefield)) location.eventCards = [];
    core.battlefield.miyama.playerIds = playerIds;
    for (const player of Object.values(core.players)) {
        player.locationId = 'miyama';
        player.victoryPoints = 12;
        player.commandSpells = 2;
    }
    if (withChoice) {
        const event = FATE_EVENTS.find(card => card.id === 'fuyuki_E12')!;
        core.currentEvents.miyama = [event];
        core.battlefield.miyama.eventCards = [event];
    }
    const lancer = core.players['0'];
    lancer.servantId = 'servant-cu-chulainn';
    lancer.isRevealed = true;
    const printed = FATE_SERVANT_BY_ID[lancer.servantId].skillCards!.find(skill => skill.id === 'sc_cu_np')!;
    const spear = { ...printed, id: `${printed.id}:2` };
    lancer.skills = [spear];
    lancer.activeSkills = [spear.id];
    const opponent = core.players['1'];
    if (!won) {
        opponent.hand = Array.from({ length: 3 }, (_, i) => ({ id: `strong-${i}`, definitionId: 'cardB4' }));
        opponent.activeAttackIds = opponent.hand.map(card => card.id);
    }
    const expectedAwards = fateLocationResults(core, 'miyama');
    expect(expectedAwards.find(result => result.playerId === '0')?.status).toBe(won ? 'representative-win' : 'deferred');

    const submit = (command: Command) => {
        const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, command, random, playerIds);
        expect(result.success, result.error).toBe(true);
        state = result.state;
        return result.events;
    };
    const use = submit({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId: spear.id } });
    expect(use.some(event => event.type === 'FATE_BATTLE_SCORE_ADJUSTED')).toBe(false);
    expect(state.core.players['0'].victoryPoints).toBe(12);
    for (const playerId of playerIds) submit({ type: 'ADVANCE_PHASE', playerId, payload: {} });
    const finish = (['miyama', 'shinto', 'recon'] as const).flatMap(locationId =>
        submit({ type: 'RESOLVE_LOCATION', playerId: state.core.currentPlayerId, payload: { locationId } }));
    if (withChoice) {
        expect(state.core.battleResolution?.step).toBe('after-battle');
        expect(state.core.players['0'].victoryPoints).toBe(12);
        expect(finish.some(event => event.type === 'FATE_BATTLE_SCORE_ADJUSTED')).toBe(false);
        const choice = state.sys.interaction.current!;
        expect(choice.playerId).toBe('0');
        finish.push(...submit({ type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId: choice.id, optionId: 'restore' } }));
        expect(state.core.players['0'].commandSpells).toBe(3);
    }

    expect(finish.filter(event => event.type === 'FATE_BATTLE_SCORE_ADJUSTED')).toEqual([expect.objectContaining({ payload: {
        sourceId: spear.id,
        changes: [{ playerId: '0', amount: 2 }, ...(won ? [{ playerId: '1', amount: -2 }, { playerId: '2', amount: -2 }] : [])],
    } })]);
    expect(state.core.phase).toBe('complete');
    const scores = Object.fromEntries(playerIds.map(id => [id,
        12 + (expectedAwards.find(result => result.playerId === id)?.totalVictoryPoints ?? 0)
        + (id === '0' ? 2 : won ? -2 : 0),
    ]));
    expect(Object.fromEntries(playerIds.map(id => [id, state.core.players[id].victoryPoints]))).toEqual(scores);
    expect(state.core.gameResult?.scores).toEqual(scores);
    expect(state.sys.actionLog.entries.filter(entry => entry.kind === 'FATE_BATTLE_SCORE_ADJUSTED').map(entry => entry.actorId))
        .toEqual(won ? playerIds : ['0']);
});
