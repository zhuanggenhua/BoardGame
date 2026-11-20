import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FATE_EVENTS, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../data';
import { FateDominationDomain } from '../domain';
import { fateDeploymentTerrain, legalFateDeploymentSlots } from '../domain/deployment';
import { projectFatePlayerView } from '../domain/playerView';
import { fateLocationResults } from '../domain/battleAwards';
import type { FateDominationCommand } from '../domain/types';
import { engineConfig } from '../game';
import { fateFieldAttackSlots } from '../ui/fateMapGeometry';

function setupBellerophon(situationId = 'sit1') {
    const playerIds = ['0', '1', '2'];
    const random = createSeededRandom('bellerophon-terrain');
    const core = FateDominationDomain.setup(playerIds, random);
    const state = { core, sys: createInitialSystemState(playerIds, engineConfig.systems, 'bellerophon-terrain') };
    core.phase = 'action';
    core.currentPlayerId = '0';
    core.situation = FATE_SITUATIONS.find(situation => situation.id === situationId)!;
    core.battlefield.miyama.playerIds = ['0'];
    const medusa = core.players['0'];
    medusa.servantId = 'servant-medusa';
    medusa.isRevealed = true;
    medusa.locationId = 'miyama';
    medusa.deploymentSlot = 0;
    const printed = FATE_SERVANT_BY_ID[medusa.servantId].skillCards!.find(skill => skill.id === 'sc_medusa_np')!;
    const bellerophon = { ...printed, id: `${printed.id}:0` };
    medusa.skills = [bellerophon];
    medusa.activeSkills = [bellerophon.id];

    return { playerIds, random, state, medusa, bellerophon };
}

it('骑英之缰绳一次占领战场的两处地利，原占领者留在场内', () => {
    const { playerIds, random, state: initial, medusa, bellerophon } = setupBellerophon();
    let state = initial;
    const { core } = state;
    core.battlefield.shinto.playerIds = ['1', '2'];
    core.battlefield.shinto.eventCards = [];
    core.currentEvents.shinto = [];
    for (const [index, id] of ['1', '2'].entries()) {
        core.players[id].locationId = 'shinto';
        core.players[id].deploymentSlot = index;
    }

    const submit = (command: FateDominationCommand) => {
        const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, command, random, playerIds);
        expect(result.success, result.error).toBe(true);
        state = result.state;
        return result.events;
    };
    const events = submit({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId: bellerophon.id, targetLocationId: 'shinto' } });
    expect(events.filter(event => event.type === 'PLAYER_MOVED')).toEqual([expect.objectContaining({ payload: expect.objectContaining({
        playerId: '0', from: 'miyama', to: 'shinto', manaSpent: 0, claimBattlefieldTerrain: true,
    }) })]);
    expect(state.core.battlefield.shinto.playerIds).toEqual(['1', '2', '0']);
    expect(state.core.players['0'].mana).toBe(medusa.mana);
    expect(state.core.players['0'].deploymentSlot).toBe(0);
    expect(state.core.players['0'].secondaryDeploymentSlot).toBe(1);
    expect(playerIds.map(id => fateDeploymentTerrain(state.core.players[id]))).toEqual([4, 0, 0]);
    expect(legalFateDeploymentSlots(state.core, 'shinto')).toEqual([null]);
    expect(fateFieldAttackSlots(state.core, 'shinto', [])).toHaveLength(0);
    expect(projectFatePlayerView(state.core, '1').players['0'].secondaryDeploymentSlot).toBe(1);

    submit({ type: 'USE_COMMAND_SPELL', playerId: '0', payload: { effect: 'move', targetLocationId: 'recon' } });
    expect(state.core.players['0'].secondaryDeploymentSlot).toBeUndefined();
    expect(state.core.battlefield.shinto.playerIds).toEqual(['1', '2']);
    expect(fateFieldAttackSlots(state.core, 'shinto', []).map(slot => slot.index)).toEqual([0, 1]);
});

it.each([
    { situationId: 'sit1', denied: 'miyama', reason: 'alreadyThere', allowed: 'recon' },
    { situationId: 'sit1', denied: 'recon', reason: 'locationFull', allowed: 'workshop' },
    { situationId: 'sit13', denied: 'shinto', reason: 'cannotEnterLocation', allowed: 'workshop' },
] as const)('骑英之缰绳于 $situationId 拒绝 $denied 并可改选 $allowed', ({ situationId, denied, reason, allowed }) => {
    const { playerIds, random, state, medusa, bellerophon } = setupBellerophon(situationId);
    const { core } = state;
    core.players['1'].locationId = denied === 'recon' ? 'recon' : 'miyama';
    core.battlefield[core.players['1'].locationId].playerIds.push('1');
    const execute = (targetLocationId: typeof denied | typeof allowed) => executePipeline(
        { domain: FateDominationDomain, systems: engineConfig.systems }, state,
        { type: 'PLAY_SKILL', playerId: '0', payload: { skillId: bellerophon.id, targetLocationId } },
        random, playerIds,
    );

    const rejected = execute(denied);
    expect(rejected).toMatchObject({ success: false, error: reason });
    expect(rejected.state).toEqual(state);

    const moved = execute(allowed);
    expect(moved.success, moved.error).toBe(true);
    expect(moved.state.core.players['0']).toMatchObject({ locationId: allowed, mana: medusa.mana, deploymentSlot: null });
    expect(moved.state.core.players['0'].secondaryDeploymentSlot).toBeUndefined();
    expect(moved.state.core.battlefield[allowed].playerIds).toContain('0');
    expect(moved.state.core.battlefield.miyama.playerIds).not.toContain('0');
    expect(fateDeploymentTerrain(moved.state.core.players['0'])).toBe(0);
});

it.each([
    { eventId: 'fuyuki_E7', label: '占领高地', opponentBefore: 6, power: 16 },
    { eventId: 'fuyuki_E8', label: '归零地', opponentBefore: 0, power: 8 },
])('骑英之缰绳在 $label 仍占两处地利，公开与结算使用事件调整后的威力', ({ eventId, opponentBefore, power }) => {
    const { playerIds, random, state, bellerophon } = setupBellerophon();
    const { core } = state;
    const event = FATE_EVENTS.find(card => card.id === eventId)!;
    core.currentEvents.shinto = [event];
    core.battlefield.shinto.eventCards = [event];
    core.shintoEventFaceDown = false;
    core.battlefield.shinto.playerIds = ['1', '2'];
    for (const [index, id] of ['1', '2'].entries()) {
        core.players[id].locationId = 'shinto';
        core.players[id].deploymentSlot = index;
    }
    expect(projectFatePlayerView(core, '0').players['1'].publicView?.power).toBe(opponentBefore);

    const moved = executePipeline(
        { domain: FateDominationDomain, systems: engineConfig.systems }, state,
        { type: 'PLAY_SKILL', playerId: '0', payload: { skillId: bellerophon.id, targetLocationId: 'shinto' } },
        random, playerIds,
    );
    expect(moved.success, moved.error).toBe(true);
    const after = moved.state.core;
    expect(after.battlefield.shinto.playerIds).toEqual(['1', '2', '0']);
    expect(playerIds.map(id => fateDeploymentTerrain(after.players[id]))).toEqual([4, 0, 0]);
    expect(projectFatePlayerView(after, '1').players['0'].publicView?.power).toBe(power);
    expect(fateLocationResults(after, 'shinto')).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerId: '0', power, status: 'representative-win' }),
        expect.objectContaining({ playerId: '1', power: 0 }),
        expect.objectContaining({ playerId: '2', power: 0 }),
    ]));
});
