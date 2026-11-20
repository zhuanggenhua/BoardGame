import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../data';
import { createFateAttackDeck, FateDominationDomain, type FateDominationCore } from '../domain';
import { fateAttackManaCost } from '../domain/attackSelection';
import { fateLocationResults } from '../domain/battleAwards';
import { FATE_BATTLE_LOCATION_ORDER, type FateDominationCommand } from '../domain/types';
import { engineConfig } from '../game';
import { buildFateAiLegalActions } from '../ai';

const playerIds = ['0', '1', '2'];

function setupHeart() {
    const random = createSeededRandom('piercing-heart');
    const core = FateDominationDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, engineConfig.systems, 'piercing-heart');
    const lancer = core.players['0'];
    lancer.servantId = 'servant-cu-chulainn';
    lancer.isRevealed = true;
    lancer.skills = FATE_SERVANT_BY_ID[lancer.servantId].skillCards!.map((skill, i) => ({ ...skill, id: `${skill.id}:${i}` }));
    const spear = lancer.skills[0].id;
    lancer.activeSkills = [spear];
    lancer.locationId = 'miyama';
    core.players['1'].locationId = 'miyama';
    core.battlefield.miyama.playerIds = ['0', '1'];
    core.phase = 'battle';
    core.currentPlayerId = '0';
    const activate: FateDominationCommand = { type: 'PLAY_SKILL', playerId: '0', payload: { skillId: spear } };
    const execute = (current: { core: FateDominationCore; sys: typeof sys }, command: FateDominationCommand) => executePipeline(
        { domain: FateDominationDomain, systems: engineConfig.systems }, current, command, random, playerIds,
    );
    return { state: { core, sys }, activate, execute };
}

it('贯穿心脏对同战场唯一对手施加败北，并让战果结算跳过该玩家', () => {
    const { state, activate, execute } = setupHeart();
    expect(buildFateAiLegalActions({ playerId: '0', state }).flatMap(action => action.commands))
        .toContainEqual(expect.objectContaining({ type: 'PLAY_SKILL', payload: activate.payload }));

    const result = execute(state, activate);
    expect(result.success).toBe(true);
    expect(result.state.core.players['1'].defeatMarkers).toEqual([
        expect.objectContaining({ direct: true, sourceId: activate.payload.skillId }),
    ]);
    expect(result.state.core.players['2'].defeatMarkers).toEqual([]);
    expect(fateLocationResults(result.state.core, 'miyama')).toEqual([
        expect.objectContaining({ playerId: '0', status: 'representative-win' }),
    ]);
    expect(execute(result.state, activate).success).toBe(false);
});

it('同战场出现第二名对手时，真人与 AI 都不能发动贯穿心脏', () => {
    const { state, activate, execute } = setupHeart();
    state.core.players['2'].locationId = 'miyama';
    state.core.battlefield.miyama.playerIds.push('2');
    expect(execute(state, activate)).toMatchObject({ success: false, error: 'soleBattleOpponentRequired' });
    expect(buildFateAiLegalActions({ playerId: '0', state }).flatMap(action => action.commands))
        .not.toContainEqual(expect.objectContaining({ type: 'PLAY_SKILL', payload: activate.payload }));
});

it('对手先发动幸运时，贯穿心脏走正式保护结算并消耗本轮发动机会', () => {
    const { state, activate, execute } = setupHeart();
    const opponent = state.core.players['1'];
    opponent.hand = [{ id: 'lucky-attack', definitionId: 'cardluck' }];
    opponent.activeAttackIds = ['lucky-attack'];
    state.core.currentPlayerId = '1';

    const lucky = execute(state, { type: 'PLAY_SKILL', playerId: '1', payload: { skillId: 'lucky-attack' } });
    expect(lucky.success).toBe(true);
    const advanced = execute(lucky.state, { type: 'ADVANCE_PHASE', playerId: '1', payload: {} });
    expect(advanced.success).toBe(true);
    expect(advanced.state.core.currentPlayerId).toBe('0');

    const result = execute(advanced.state, activate);
    expect(result.success).toBe(true);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'FATE_DEFEAT_PREVENTED' }));
    expect(result.state.core.players['1'].defeatMarkers).toEqual([]);
    expect(result.state.sys.actionLog.entries.filter(entry => entry.kind === 'FATE_DEFEAT_PREVENTED')).toEqual([
        expect.objectContaining({ actorId: '1', segments: [expect.objectContaining({ key: 'log.battleDefeatPrevented' })] }),
    ]);
    expect(execute(result.state, activate).success).toBe(false);
});

it('穿刺死棘之枪同局跨轮重新可用，每次确认后永久增加下次实付费用', () => {
    const { state: initial, activate, execute } = setupHeart();
    let state = initial;
    const skillId = activate.payload.skillId;
    const lancer = state.core.players['0'];
    // 代表态从第 4 天最后一个行动席开始，第 5 天完整走准备与部署。
    const neutral = FATE_SITUATIONS.find(situation => situation.id === 'sit2')!;
    Object.assign(state.core, {
        phase: 'action', round: 4, turnOrder: ['1', '2', '0'], currentTurnIndex: 2,
        situation: FATE_SITUATIONS.find(situation => situation.id === 'sit1')!,
        situationDeck: [neutral], currentEvents: { miyama: [], shinto: [] },
    });
    for (const location of Object.values(state.core.battlefield)) location.eventCards = [];
    state.core.battlefield.workshop.playerIds = ['2'];
    Object.assign(state.core.players['1'], { normalAttackPlayed: true, hasPassedAction: true });
    Object.assign(state.core.players['2'], { locationId: 'workshop', deploymentSlot: 0, normalAttackPlayed: true, hasPassedAction: true });
    const deck = createFateAttackDeck(lancer.id, lancer.servantId);
    const first = deck.find(card => card.definitionId === 'cardB1')!;
    const second = deck.find(card => card.definitionId === 'cardB2')!;
    Object.assign(lancer, {
        activeSkills: [], isRevealed: false, mana: 12, deploymentSlot: 0,
        hand: [first, second], deck: deck.filter(card => card !== first && card !== second),
    });
    const submit = (command: FateDominationCommand) => {
        const result = execute(state, command);
        expect(result.success, `${command.type}: ${result.error ?? ''}`).toBe(true);
        state = result.state;
    };
    const confirmSpear = (basicId: string, cost: number) => {
        const before = state.core.players['0'];
        expect(fateAttackManaCost(before, skillId, false, state.core.round)).toBe(cost);
        submit({ type: 'CONFIRM_ATTACK', playerId: '0', payload: {
            cardIds: [skillId, basicId], faceDownIds: [], round: state.core.round,
        } });
        expect(state.core.players['0'].mana).toBe(before.mana - cost);
    };
    const advanceCurrent = () => submit({ type: 'ADVANCE_PHASE', playerId: state.core.currentPlayerId, payload: {} });
    confirmSpear(first.id, 3);
    expect(state.core.players['0'].isRevealed).toBe(true);
    submit({ type: 'PASS_ACTION', playerId: '0', payload: {} });
    advanceCurrent();
    advanceCurrent();
    submit(activate);
    expect(state.core.players['1'].defeatMarkers).toHaveLength(1);
    advanceCurrent();
    for (const locationId of FATE_BATTLE_LOCATION_ORDER) {
        submit({ type: 'RESOLVE_LOCATION', playerId: state.core.currentPlayerId, payload: { locationId } });
    }
    expect(state.core).toMatchObject({ phase: 'preparation', round: 5 });
    expect(state.core.players['1'].defeatMarkers).toEqual([]);
    expect(state.core.players['0']).toMatchObject({ activeSkills: [], usedAbilityIds: [], piercingSpearPlays: 1 });
    for (const _ of playerIds) advanceCurrent();
    for (const _ of playerIds) {
        const playerId = state.core.currentPlayerId;
        submit({ type: 'DEPLOY_MASTER', playerId, payload: { locationId: playerId === '2' ? 'workshop' : 'miyama' } });
        advanceCurrent();
    }
    expect(state.core.phase).toBe('action');
    const priorActor = state.core.currentPlayerId;
    const attack = buildFateAiLegalActions({ state, playerId: priorActor }).find(candidate => candidate.commands[0].type === 'CONFIRM_ATTACK');
    expect(attack).toBeDefined();
    submit({ ...attack!.commands[0], playerId: priorActor } as FateDominationCommand);
    submit({ type: 'PASS_ACTION', playerId: priorActor, payload: {} });
    expect(state.core.currentPlayerId).toBe('0');
    confirmSpear(second.id, 5);
    expect(state.core.players['0'].piercingSpearPlays).toBe(2);
    expect(fateAttackManaCost(state.core.players['0'], skillId, false, state.core.round)).toBe(7);
});
