import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { createRespondToPromptCommand, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import { FateDominationDomain } from '../domain';
import { FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../data';
import { calculateFatePower } from '../domain/power';
import { fateAttackManaCost } from '../domain/attackSelection';
import { emptyFateBattleResult } from '../domain/battleAwards';
import { engineConfig } from '../game';

function fixture() {
    const ids = ['0', '1', '2'];
    const random = createSeededRandom('fate-field-attack');
    const state = { core: FateDominationDomain.setup(ids, random), sys: createInitialSystemState(ids, engineConfig.systems, 'fate-field-attack') };
    const { core } = state;
    const player = core.players['0'];
    core.phase = 'action';
    core.round = 3;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit1')!;
    core.currentPlayerId = '0';
    core.battlefield.miyama.playerIds = ['0'];
    core.battlefield.miyama.eventCards = [];
    player.servantId = 'servant-gilles';
    player.skills = FATE_SERVANT_BY_ID[player.servantId].skillCards!.map(skill => ({ ...skill, id: `${skill.id}:0` }));
    player.locationId = 'miyama';
    player.mana = 12;
    player.hand = [{ id: 'basic', definitionId: 'cardB1' }];
    const run = (input: typeof state, playerId: string, type: string, payload: object) =>
        executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, input, { type, playerId, payload }, random, ids);
    const confirm = (skillId: string) => run(state, '0', 'CONFIRM_ATTACK', { cardIds: [skillId, 'basic'], faceDownIds: [], round: core.round });
    return { state, run, confirm };
}

it('海魔使用真实交互付款，拒绝他席和重放，放置后随地点结算', () => {
    const { run, confirm } = fixture();
    const skillId = 'sc_gilles_np:0';
    const started = confirm(skillId);
    expect(started.success, started.error).toBe(true);
    expect(started.state.core.players['0'].mana).toBe(4);
    const interactionId = getCurrentInteractionSummary(started.state).id;
    expect(interactionId).toContain('fate:field-attack:');
    const respond = createRespondToPromptCommand(started.state, { playerId: '0', optionId: 'place' });
    expect(run(started.state, '1', respond.type, respond.payload).success).toBe(false);
    expect(run(started.state, '0', respond.type, { ...respond.payload, interactionId: 'stale' }).success).toBe(false);
    const resolved = run(started.state, '0', respond.type, respond.payload);
    expect(resolved.success, resolved.error).toBe(true);
    expect(run(resolved.state, '0', respond.type, respond.payload).success).toBe(false);
    const { core } = resolved.state;
    const expected = [{ playerId: '0', skillId, locationId: 'miyama' }];
    expect(core.battlefieldAttacks).toEqual(expected);
    expect(core.players['0'].activeSkills).not.toContain(skillId);
    const power = calculateFatePower(core, '0', []);
    expect(power).toBeGreaterThan(calculateFatePower({ ...core, battlefieldAttacks: [] }, '0', []));
    const result = { ...emptyFateBattleResult('1'), locationId: 'miyama' as const };
    const remote = structuredClone(core);
    remote.battlefield.miyama.playerIds = ['1'];
    remote.players['0'].locationId = 'shinto';
    expect(FateDominationDomain.reduce(remote, { type: 'LOCATION_RESOLVED', payload: { locationId: 'miyama', results: [result] }, timestamp: 1 }).battlefieldAttacks).toEqual(expected);
    expect(FateDominationDomain.reduce(remote, { type: 'BATTLE_RESOLVED', payload: { result, nextRound: 4 }, timestamp: 2 }).battlefieldAttacks).toEqual(expected);
    expect(FateDominationDomain.reduce(core, { type: 'LOCATION_RESOLVED', payload: { locationId: 'miyama', results: [result] }, timestamp: 1 }).battlefieldAttacks).toEqual([]);

    const close = createRespondToPromptCommand(started.state, { playerId: '0', optionId: 'close' });
    const closed = run(started.state, '0', close.type, close.payload);
    expect(closed.success, closed.error).toBe(true);
    expect(closed.state.core.battlefieldAttacks ?? []).toEqual([]);
    expect(closed.state.core.players['0'].activeSkills).not.toContain(skillId);
});

it.each(['workshop', 'recon'] as const)('螺湮城教本在非战场 %s 打出后立即关闭', (locationId) => {
    const { state, run, confirm } = fixture();
    const player = state.core.players['0'];
    const skillId = 'sc_gilles_np:0';
    player.locationId = locationId;
    state.core.battlefield.miyama.playerIds = [];
    state.core.battlefield[locationId].playerIds = ['0'];

    const played = confirm(skillId);
    expect(played.success, played.error).toBe(true);
    expect(played.state.core.players['0'].mana).toBe(4);
    expect(played.state.core.players['0'].isRevealed).toBe(true);
    expect(played.state.core.players['0'].activeSkills).not.toContain(skillId);
    expect(played.state.core.battlefieldAttacks ?? []).toEqual([]);
    expect(played.state.sys.interaction.current).toBeUndefined();

    if (locationId === 'workshop') {
        const moved = run(played.state, '0', 'MOVE_PLAYER', { locationId: 'miyama' });
        expect(moved.success, moved.error).toBe(true);
        expect(moved.state.core.players['0'].activeSkills).not.toContain(skillId);
        expect(moved.state.core.battlefieldAttacks ?? []).toEqual([]);
    }
});

it.each(['workshop', 'recon'] as const)('螺湮城教本在非战场 %s 打出后立即关闭', (locationId) => {
    const { state, run, confirm } = fixture();
    const skillId = 'sc_gilles_np:0';
    state.core.players['0'].locationId = locationId;
    state.core.players['0'].hand = [{ id: 'basic', definitionId: 'cardSurveil' }];
    state.core.battlefield.miyama.playerIds = [];
    state.core.battlefield[locationId].playerIds = ['0'];
    state.core.currentEvents = { miyama: [], shinto: [] };

    const played = confirm(skillId);
    expect(played.success, played.error).toBe(true);
    expect(played.state.core.players['0'].mana).toBe(3);
    expect(played.state.core.players['0'].isRevealed).toBe(true);
    expect(played.state.core.players['0'].activeSkills).not.toContain(skillId);
    expect(played.state.core.battlefieldAttacks ?? []).toEqual([]);
    expect(played.state.sys.interaction.current).toBeFalsy();

    if (locationId === 'workshop') {
        const moved = run(played.state, '0', 'PLAY_SKILL', { skillId: 'basic', targetLocationId: 'miyama' });
        expect(moved.success, moved.error).toBe(true);
        expect(moved.state.core.players['0'].locationId).toBe('miyama');
        expect(moved.state.core.players['0'].activeSkills).not.toContain(skillId);
        expect(moved.state.core.battlefieldAttacks ?? []).toEqual([]);
    }
});

it('阵地建造按回合扣费，留在攻击区并在次回合进工房领取收益', () => {
    const { confirm } = fixture();
    const skillId = 'sc_gilles_2:0';
    const result = confirm(skillId);
    expect(result.success, result.error).toBe(true);
    const { core } = result.state;
    expect(fateAttackManaCost(core.players['0'], skillId, false, 3)).toBe(10);
    expect(core.players['0'].mana).toBe(2);
    expect(core.players['0'].activeSkills).toContain(skillId);
    const next = FateDominationDomain.reduce(core, { type: 'BATTLE_RESOLVED', payload: { result: emptyFateBattleResult('0'), nextRound: 4 }, timestamp: 2 });
    expect(next.players['0'].activeSkills).toEqual([skillId]);
    expect(next.players['0'].activeAttackIds).toEqual([]);
    const values = { mana: next.players['0'].mana, victoryPoints: next.players['0'].victoryPoints };
    const deployed = FateDominationDomain.reduce(next, { type: 'MASTER_DEPLOYED', payload: { playerId: '0', locationId: 'workshop', manaGain: 1, deploymentSlot: 1 }, timestamp: 3 });
    expect(deployed.players['0'].mana).toBe(values.mana + 2);
    expect(deployed.players['0'].victoryPoints).toBe(values.victoryPoints + 2);
});

it.each([
    { locationId: 'shinto', remains: false },
    { locationId: 'miyama', remains: true },
] as const)('螺湮城教本保留到第9回合，第10回合仅在未关闭的战场保留（$locationId）', ({ locationId, remains }) => {
    const { state, run, confirm } = fixture();
    const { core } = state;
    const skillId = 'sc_gilles_np:0';
    core.round = 8;
    core.battlefield.miyama.playerIds = [];
    core.battlefield[locationId].playerIds = ['0'];
    core.battlefield[locationId].eventCards = [];
    core.players['0'].locationId = locationId;

    const started = confirm(skillId);
    expect(started.success, started.error).toBe(true);
    const place = createRespondToPromptCommand(started.state, { playerId: '0', optionId: 'place' });
    const placed = run(started.state, '0', place.type, place.payload);
    expect(placed.success, placed.error).toBe(true);
    const attack = { playerId: '0', skillId, locationId };
    expect(placed.state.core.battlefieldAttacks).toEqual([attack]);
    const result = emptyFateBattleResult('0');
    const ninth = FateDominationDomain.reduce(placed.state.core, {
        type: 'BATTLE_RESOLVED', payload: { result, nextRound: 9 }, timestamp: 1,
    });
    expect(ninth.situation.id).toBe('sit11');
    expect(ninth.battlefieldAttacks).toEqual([attack]);
    const tenth = FateDominationDomain.reduce(ninth, {
        type: 'BATTLE_RESOLVED', payload: { result, nextRound: 10 }, timestamp: 2,
    });
    expect(tenth.situation.id).toBe('sit12');
    expect(tenth.battlefieldAttacks).toEqual(remains ? [attack] : []);
    expect(tenth.players['0'].skills.map(skill => skill.id)).toContain(skillId);

    const legacy = { ...placed.state, core: { ...tenth, battlefieldAttacks: [attack] } };
    expect(FateDominationDomain.normalizeRuntimeState!(legacy).core.battlefieldAttacks).toEqual(remains ? [attack] : []);
});
