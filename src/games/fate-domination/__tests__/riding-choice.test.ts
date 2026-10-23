import { expect, it } from 'vitest';
import { applyPlayerViewToState } from '../../../engine/ai/playerView';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FATE_SERVANTS } from '../data';
import { FateDominationDomain } from '../domain';
import type { FateDominationCore } from '../domain';
import { emptyFateBattleResult } from '../domain/battleAwards';
import { engineConfig } from '../game';
import type { Command, MatchState } from '../../../engine/types';

const playerIds = ['0', '1', '2'];
const rideSource = 'sc_iskandar_1';

function ridingGame(seed = 'iskandar-riding') {
    const random = createSeededRandom(seed);
    let state: MatchState<FateDominationCore> = {
        core: FateDominationDomain.setup(playerIds, random),
        sys: createInitialSystemState(playerIds, engineConfig.systems, seed),
    };
    state.core.round = 4;
    state.core.phase = 'action';
    state.core.currentPlayerId = '0';
    const rider = FATE_SERVANTS.find(servant => servant.trueName === '伊斯坎达尔')!;
    const player = state.core.players['0'];
    player.servantId = rider.id;
    player.skills = (rider.skillCards ?? []).map((skill, index) => ({ ...skill, id: `${skill.id}:${index}` }));
    const ridingSkill = player.skills.find(skill => skill.id.split(':')[0] === rideSource)!;
    player.activeSkills = [ridingSkill.id];
    player.usedAbilityIds = [];
    player.locationId = 'miyama';
    player.mana = 5;
    player.hand = [
        { id: 'b1', definitionId: 'cardB1' },
        { id: 'b2', definitionId: 'cardB2' },
        { id: 'magic3', definitionId: 'cardA2' },
        { id: 'remote2', definitionId: 'cardPreparation' },
        { id: 'rush3', definitionId: 'cardSurveil' },
        { id: 'power4', definitionId: 'cardB3' },
        { id: 'luck4', definitionId: 'cardluck' },
        { id: 'other0', definitionId: 'Card_Avenger' },
    ];
    player.deck = [{ id: 'drawn', definitionId: 'cardB1' }, { id: 'drawn2', definitionId: 'cardB2' }];
    player.discard = [];
    player.selectedAttackIds = [];
    player.selectedFaceDownIds = [];
    player.activeAttackIds = [];
    player.normalAttackPlayed = false;
    state.core.battlefield.miyama.playerIds = ['0'];

    const run = (command: Command) => executePipeline(
        { domain: FateDominationDomain, systems: engineConfig.systems },
        state,
        command,
        random,
        playerIds,
    );
    const apply = (command: Command) => {
        const result = run(command);
        expect(result.success, `${command.type}: ${result.error ?? ''}`).toBe(true);
        state = result.state;
        return result;
    };
    const useRiding = () => apply({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId: ridingSkill.id } });
    const respond = (optionIds: string[], playerId = '0', interactionId = state.sys.interaction.current?.id) => {
        const result = run({ type: 'SYS_INTERACTION_RESPOND', playerId, payload: { interactionId, optionIds } });
        if (result.success) state = result.state;
        return result;
    };
    return {
        apply, run, useRiding, respond, get state() { return state; },
        ridingSkillId: ridingSkill.id,
    };
}

it('发动骑乘只打开绑定到 ResolutionFrame 的 0–3 手牌选择，不提前消耗次数或魔力', () => {
    const game = ridingGame();
    const result = game.useRiding();
    const interaction = result.state.sys.interaction.current;
    expect(interaction).toMatchObject({ playerId: '0', kind: 'simple-choice' });
    expect(interaction?.resolutionFrameId).toBeTruthy();
    expect((interaction?.data as { multi?: { min?: number; max?: number } }).multi).toEqual({ min: 0, max: 3 });
    expect((interaction?.data as { options: Array<{ id: string }> }).options.map(option => option.id)).toEqual(
        expect.arrayContaining(['b1', 'b2', 'magic3', 'remote2', 'rush3']),
    );
    expect((interaction?.data as { options: Array<{ id: string }> }).options.map(option => option.id)).not.toContain('power4');
    expect(game.state.core.players['0'].mana).toBe(5);
    expect(game.state.core.players['0'].usedAbilityIds).toEqual([]);
    expect(game.state.sys.resolution?.activeFrameId).toBe(interaction?.resolutionFrameId);
    expect(JSON.stringify(game.state.sys.resolution)).not.toContain('remote2');
    expect(game.state.sys.actionLog.entries.at(-1)?.segments).toEqual([{ type: 'text', text: '选择坐骑召唤手牌' }]);
});

it.each([
    { label: '0', ids: [], cost: 0 },
    { label: '1', ids: ['remote2'], cost: 1 },
    { label: '3', ids: ['b1', 'remote2', 'rush3'], cost: 2 },
])('确认 $label 张后一次性扣除印刷费用，不消耗常规两张额度，也不结束行动', ({ ids, cost }) => {
    const game = ridingGame(`riding-confirm-${ids.length}`);
    game.useRiding();
    const interactionId = game.state.sys.interaction.current!.id;
    const result = game.respond(ids, '0', interactionId);
    expect(result.success).toBe(true);
    const player = result.state.core.players['0'];
    expect(player.mana).toBe(5 - cost);
    expect(player.activeAttackIds).toEqual(ids);
    expect(player.normalAttackPlayed).toBe(false);
    expect(player.selectedAttackIds).toEqual([]);
    expect(player.usedAbilityIds).toContain(`${game.ridingSkillId}:action`);
    expect(result.state.core.phase).toBe('action');
    expect(result.state.core.currentPlayerId).toBe('0');
    expect(result.state.sys.interaction.current).toBeUndefined();
    expect(result.state.sys.resolution?.activeFrameId).toBeUndefined();
    const repeatedUse = game.run({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId: game.ridingSkillId } });
    expect(repeatedUse.success).toBe(false);
    expect(repeatedUse.events).toEqual([]);
});

it('未激活的骑乘来源不能发动行动能力', () => {
    const game = ridingGame('riding-inactive-source');
    game.state.core.players['0'].activeSkills = [];
    const result = game.run({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId: game.ridingSkillId } });
    expect(result.success).toBe(false);
    expect(result.events).toEqual([]);
    expect(result.state.sys.interaction.current).toBeUndefined();
});

it('骑乘效果出牌后仍可完成常规两张攻击', () => {
    const game = ridingGame();
    game.useRiding();
    const response = game.respond(['remote2']);
    expect(response.success).toBe(true);
    game.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'b1' } });
    game.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'b2' } });
    const confirmed = game.apply({ type: 'CONFIRM_ATTACK', playerId: '0', payload: {} });
    expect(confirmed.state.core.players['0'].normalAttackPlayed).toBe(true);
    expect(confirmed.state.core.players['0'].activeAttackIds).toEqual(['remote2', 'b1', 'b2']);
    expect(confirmed.state.core.phase).toBe('action');
});

it('取消只关闭本次选择，不消费骑乘；取消后可重新发动', () => {
    const game = ridingGame();
    game.useRiding();
    const interactionId = game.state.sys.interaction.current!.id;
    game.apply({ type: 'SYS_INTERACTION_CANCEL', playerId: '0', payload: { interactionId } });
    expect(game.state.core.players['0'].mana).toBe(5);
    expect(game.state.core.players['0'].usedAbilityIds).toEqual([]);
    expect(game.state.sys.interaction.current).toBeUndefined();
    expect(game.state.sys.resolution?.activeFrameId).toBeUndefined();
    expect(game.state.sys.actionLog.entries.some(entry => entry.segments.some(segment => segment.type === 'text' && segment.text.startsWith('发动技能：')))).toBe(false);
    game.useRiding();
    expect(game.state.sys.interaction.current).toBeDefined();
});

it('待选期间原子拒绝非法、越权和陈旧响应，并阻塞普通命令', () => {
    const game = ridingGame();
    game.useRiding();
    const before = game.state;
    const interactionId = before.sys.interaction.current!.id;
    const invalid: Command[] = [
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId, optionIds: ['b1', 'b2', 'magic3', 'rush3'] } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId, optionIds: ['b1', 'b1'] } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '1', payload: { interactionId, optionIds: ['b1'] } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId, optionIds: ['power4'] } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId, optionIds: ['old-id'] } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId, optionIds: ['b1'], faceDownIds: [] } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId, optionIds: [], mergedValue: { mana: 0 } } },
        { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { interactionId: 'stale', optionIds: [] } },
        { type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'b1' } },
        { type: 'PASS_ACTION', playerId: '0', payload: {} },
        { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
        { type: 'SYS_REQUEST_UNDO', playerId: '0', payload: { localAutoApprove: true } },
    ];
    for (const command of invalid) {
        const result = game.run(command);
        expect(result.success, command.type).toBe(false);
        expect(result.events).toEqual([]);
        expect(result.state.sys.interaction.current?.id).toBe(interactionId);
        expect(result.state.core.players['0'].mana).toBe(before.core.players['0'].mana);
        expect(result.state.core.players['0'].activeAttackIds).toEqual([]);
        expect(result.state.sys.resolution?.activeFrameId).toBe(before.sys.resolution?.activeFrameId);
        expect(result.state.sys.undo).toEqual(before.sys.undo);
    }
});

it('确认会重验候选牌是否仍在可用手牌且整批费用仍可支付', () => {
    const game = ridingGame();
    game.useRiding();
    const interactionId = game.state.sys.interaction.current!.id;
    game.state.core.players['0'].hand = game.state.core.players['0'].hand.filter(card => card.id !== 'remote2');
    const stale = game.respond(['remote2'], '0', interactionId);
    expect(stale.success).toBe(false);
    expect(stale.state.sys.interaction.current?.id).toBe(interactionId);

    game.state.core.players['0'].hand = [
        { id: 'b1', definitionId: 'cardB1' },
        { id: 'remote2', definitionId: 'cardPreparation' },
    ];
    game.state.core.players['0'].mana = 0;
    const unaffordable = game.respond(['remote2'], '0', interactionId);
    expect(unaffordable.success).toBe(false);
    expect(unaffordable.state.sys.interaction.current?.id).toBe(interactionId);
    expect(unaffordable.state.core.players['0'].activeAttackIds).toEqual([]);
});

it('固有结界与败退状态会按通用攻击规则排除骑乘候选', () => {
    const bounded = ridingGame('riding-solid-field-candidate');
    bounded.state.core.battlefield.miyama.eventCards = [{
        id: 'fuyuki_E16', name: '固有结界', assetPath: 'test', victoryPoints: 2, sourceStatus: 'verified',
    }];
    bounded.useRiding();
    const boundedOptions = (bounded.state.sys.interaction.current!.data as { options: Array<{ id: string }> }).options;
    expect(boundedOptions.map(option => option.id)).not.toContain('remote2');
    expect(bounded.respond(['remote2']).success).toBe(false);

    const defeated = ridingGame('riding-defeat-candidate');
    defeated.state.core.players['0'].defeatMarkers = [{ id: 'defeated', direct: true, duration: 'round-end' }];
    defeated.useRiding();
    const defeatedOptions = (defeated.state.sys.interaction.current!.data as { options: Array<{ id: string }> }).options;
    expect(defeatedOptions).toEqual([]);
    expect(defeated.respond(['b1']).success).toBe(false);
    expect(defeated.respond([]).success).toBe(true);
});

it('选择打开后若通用出牌状态变化，提交会原子拒绝并保留交互', () => {
    const game = ridingGame('riding-live-legality');
    game.useRiding();
    const before = game.state;
    const interactionId = before.sys.interaction.current!.id;
    game.state.core.battlefield.miyama.eventCards = [{
        id: 'fuyuki_E16', name: '固有结界', assetPath: 'test', victoryPoints: 2, sourceStatus: 'verified',
    }];

    const rejected = game.respond(['remote2'], '0', interactionId);
    expect(rejected.success).toBe(false);
    expect(rejected.events).toEqual([]);
    expect(rejected.state.sys.interaction.current?.id).toBe(interactionId);
    expect(rejected.state.core.players['0'].mana).toBe(before.core.players['0'].mana);
    expect(rejected.state.core.players['0'].activeAttackIds).toEqual([]);
    expect(rejected.state.core.players['0'].usedAbilityIds).toEqual([]);
});

it('取消后重开会生成新事务标识；旧响应和旧取消都不能作用于新选择', () => {
    const responseGame = ridingGame('riding-stale-response-generation');
    // Isolate interaction-generation behavior from random events dealt during setup.
    responseGame.state.core.currentEvents.miyama = [];
    responseGame.state.core.battlefield.miyama.eventCards = [];
    responseGame.useRiding();
    const oldResponseId = responseGame.state.sys.interaction.current!.id;
    responseGame.apply({ type: 'SYS_INTERACTION_CANCEL', playerId: '0', payload: { interactionId: oldResponseId } });
    responseGame.useRiding();
    const currentResponseId = responseGame.state.sys.interaction.current!.id;
    expect(currentResponseId).not.toBe(oldResponseId);
    const staleResponse = responseGame.respond(['remote2'], '0', oldResponseId);
    expect(staleResponse.success).toBe(false);
    expect(staleResponse.events).toEqual([]);
    expect(staleResponse.state.sys.interaction.current?.id).toBe(currentResponseId);
    expect(staleResponse.state.core.players['0'].mana).toBe(5);
    expect(staleResponse.state.core.players['0'].usedAbilityIds).toEqual([]);

    const cancelGame = ridingGame('riding-stale-cancel-generation');
    cancelGame.state.core.currentEvents.miyama = [];
    cancelGame.state.core.battlefield.miyama.eventCards = [];
    cancelGame.useRiding();
    const oldCancelId = cancelGame.state.sys.interaction.current!.id;
    cancelGame.apply({ type: 'SYS_INTERACTION_CANCEL', playerId: '0', payload: { interactionId: oldCancelId } });
    cancelGame.useRiding();
    const currentCancelId = cancelGame.state.sys.interaction.current!.id;
    expect(currentCancelId).not.toBe(oldCancelId);
    const staleCancel = cancelGame.run({ type: 'SYS_INTERACTION_CANCEL', playerId: '0', payload: { interactionId: oldCancelId } });
    expect(staleCancel.success).toBe(false);
    expect(staleCancel.events).toEqual([]);
    expect(staleCancel.state.sys.interaction.current?.id).toBe(currentCancelId);
    expect(staleCancel.state.core.players['0'].mana).toBe(5);
    expect(staleCancel.state.core.players['0'].usedAbilityIds).toEqual([]);
    expect(cancelGame.respond(['remote2'], '0', currentCancelId).success).toBe(true);
});

it('撤回恢复事件序号后仍由 rollbackRevision 隔离旧骑乘事务', () => {
    const game = ridingGame('riding-stale-undo-generation');
    game.state.sys.matchId = 'local:riding-undo-generation';
    const openingEventId = game.state.sys.eventStream.nextId;
    game.useRiding();
    const oldInteractionId = game.state.sys.interaction.current!.id;
    game.apply({ type: 'SYS_INTERACTION_CANCEL', playerId: '0', payload: { interactionId: oldInteractionId } });

    const undo = game.apply({ type: 'SYS_REQUEST_UNDO', playerId: '0', payload: { localAutoApprove: true } });
    expect(undo.state.sys.eventStream.nextId).toBe(openingEventId);
    expect(undo.state.sys.undo.rollbackRevision).toBe(1);
    expect(undo.state.sys.interaction.current).toBeUndefined();

    game.useRiding();
    const currentInteractionId = game.state.sys.interaction.current!.id;
    expect(currentInteractionId).not.toBe(oldInteractionId);

    const staleResponse = game.respond(['remote2'], '0', oldInteractionId);
    expect(staleResponse.success).toBe(false);
    expect(staleResponse.events).toEqual([]);
    expect(staleResponse.state.sys.interaction.current?.id).toBe(currentInteractionId);

    const staleCancel = game.run({ type: 'SYS_INTERACTION_CANCEL', playerId: '0', payload: { interactionId: oldInteractionId } });
    expect(staleCancel.success).toBe(false);
    expect(staleCancel.events).toEqual([]);
    expect(staleCancel.state.sys.interaction.current?.id).toBe(currentInteractionId);
    expect(staleCancel.state.core.players['0'].mana).toBe(5);
    expect(staleCancel.state.core.players['0'].usedAbilityIds).toEqual([]);
});

it('确认会拒绝已经暂选、已经明置或已被压制/使用的骑乘状态', () => {
    const staged = ridingGame('riding-staged');
    staged.useRiding();
    staged.state.core.players['0'].selectedAttackIds = ['b1'];
    expect(staged.respond(['b1']).success).toBe(false);

    const active = ridingGame('riding-active');
    active.useRiding();
    active.state.core.players['0'].activeAttackIds = ['b2'];
    expect(active.respond(['b2']).success).toBe(false);

    const suppressed = ridingGame('riding-suppressed');
    suppressed.useRiding();
    suppressed.state.core.ruleState.modifiers.push({
        id: 'suppress-riding', kind: 'ability-suppression', phases: ['action'], scope: 'players', playerIds: ['0'],
        source: { sourceId: 'test', sourceKind: 'rule', ownerId: '0', controllerId: '0' },
    });
    expect(suppressed.respond([]).success).toBe(false);

    const alreadyUsed = ridingGame('riding-already-used');
    alreadyUsed.useRiding();
    alreadyUsed.state.core.players['0'].usedAbilityIds = [`${alreadyUsed.ridingSkillId}:action`];
    expect(alreadyUsed.respond([]).success).toBe(false);
});

it('回合归位后清除骑乘本回合使用记录', () => {
    const game = ridingGame('riding-round-reset');
    game.useRiding();
    expect(game.respond([]).state.core.players['0'].usedAbilityIds).toContain(`${game.ridingSkillId}:action`);
    const nextRound = FateDominationDomain.reduce(game.state.core, {
        type: 'BATTLE_RESOLVED', timestamp: 1,
        payload: { result: emptyFateBattleResult('0'), nextRound: game.state.core.round + 1 },
    });
    expect(nextRound.players['0'].usedAbilityIds).toEqual([]);
    expect(nextRound.players['0'].activeSkills).toEqual([]);
});

it.each([
    { label: '力量', definitionId: 'cardB1' },
    { label: '敏捷', definitionId: 'cardQ1' },
    { label: '魔术（数据别名“魔法”）', definitionId: 'cardA2' },
    { label: '远隔操作', definitionId: 'cardPreparation' },
    { label: '疾行', definitionId: 'cardSurveil' },
    { label: '幸运', definitionId: 'cardluck' },
])('骑乘与同批明置的$label基础攻击一起使用时抽 1 张', ({ definitionId }) => {
    const game = ridingGame(`riding-basic-${definitionId}`);
    const rider = game.state.core.players['0'];
    rider.activeSkills = [];
    rider.mana = 8;
    rider.hand = [{ id: 'basic', definitionId }];
    rider.deck = [{ id: 'trigger-draw', definitionId: 'cardB1' }];
    game.state.core.currentEvents.miyama = [];
    game.state.core.battlefield.miyama.eventCards = [];
    game.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: game.ridingSkillId } });
    game.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'basic' } });
    const confirmed = game.apply({ type: 'CONFIRM_ATTACK', playerId: '0', payload: {} });
    expect(confirmed.events.filter(event => event.type === 'FATE_CARDS_DRAWN')).toHaveLength(1);
    expect(confirmed.state.core.players['0'].hand.map(card => card.id)).toContain('trigger-draw');
});

it('只在骑乘与同批明置基础攻击共同确认时抽 1 张；暗置、旧批次和非基础牌不触发', () => {
    const game = ridingGame('riding-trigger');
    const rider = game.state.core.players['0'];
    rider.activeSkills = [];
    rider.mana = 8;
    rider.deck = [{ id: 'trigger-draw', definitionId: 'cardB1' }];
    const skillId = game.ridingSkillId;
    game.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: skillId } });
    game.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'b1' } });
    const confirmed = game.apply({ type: 'CONFIRM_ATTACK', playerId: '0', payload: {} });
    expect(confirmed.events.filter(event => event.type === 'FATE_CARDS_DRAWN')).toHaveLength(1);
    expect(confirmed.state.core.players['0'].hand.map(card => card.id)).toContain('trigger-draw');
    expect(confirmed.state.core.players['0'].usedAbilityIds).not.toContain(`${skillId}:action`);
    expect(confirmed.state.sys.undo.snapshots).toEqual([]);
    for (const viewerId of ['1', null]) {
        const view = applyPlayerViewToState(engineConfig, confirmed.state, viewerId) as MatchState<FateDominationCore>;
        expect(JSON.stringify(view)).not.toContain('trigger-draw');
    }
    const ownerView = applyPlayerViewToState(engineConfig, confirmed.state, '0') as MatchState<FateDominationCore>;
    expect(JSON.stringify(ownerView)).toContain('trigger-draw');

    const dark = ridingGame('riding-trigger-dark');
    dark.state.core.players['0'].activeSkills = [];
    dark.state.core.players['0'].mana = 8;
    dark.state.core.currentEvents.miyama = [];
    dark.state.core.battlefield.miyama.eventCards = [];
    dark.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: dark.ridingSkillId } });
    dark.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'b1', faceDown: true } });
    expect(dark.apply({ type: 'CONFIRM_ATTACK', playerId: '0', payload: {} }).events.filter(event => event.type === 'FATE_CARDS_DRAWN')).toHaveLength(0);

    const otherBatch = ridingGame('riding-trigger-prior');
    otherBatch.state.core.players['0'].mana = 8;
    otherBatch.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'b1' } });
    otherBatch.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'b2' } });
    expect(otherBatch.apply({ type: 'CONFIRM_ATTACK', playerId: '0', payload: {} }).events.filter(event => event.type === 'FATE_CARDS_DRAWN')).toHaveLength(0);

    const nonBasic = ridingGame('riding-trigger-special');
    nonBasic.state.core.players['0'].activeSkills = [];
    nonBasic.state.core.players['0'].mana = 8;
    nonBasic.state.core.currentEvents.miyama = [];
    nonBasic.state.core.battlefield.miyama.eventCards = [];
    nonBasic.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: nonBasic.ridingSkillId } });
    nonBasic.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'other0' } });
    expect(nonBasic.apply({ type: 'CONFIRM_ATTACK', playerId: '0', payload: {} }).events.filter(event => event.type === 'FATE_CARDS_DRAWN')).toHaveLength(0);

    const magicSpecial = ridingGame('riding-trigger-nonbasic-magic');
    magicSpecial.state.core.players['0'].activeSkills = [];
    magicSpecial.state.core.players['0'].mana = 8;
    magicSpecial.state.core.players['0'].hand = [{ id: 'magic-special', definitionId: 'Card_YinQi' }];
    magicSpecial.state.core.currentEvents.miyama = [];
    magicSpecial.state.core.battlefield.miyama.eventCards = [];
    magicSpecial.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: magicSpecial.ridingSkillId } });
    magicSpecial.apply({ type: 'SELECT_ATTACK_CARD', playerId: '0', payload: { cardId: 'magic-special' } });
    expect(magicSpecial.apply({ type: 'CONFIRM_ATTACK', playerId: '0', payload: {} }).events.filter(event => event.type === 'FATE_CARDS_DRAWN')).toHaveLength(0);
});

it('非本人和旁观者看不到骑乘候选或抽到的牌', () => {
    const game = ridingGame('riding-privacy');
    game.useRiding();
    for (const viewerId of ['1', null]) {
        const view = applyPlayerViewToState(engineConfig, game.state, viewerId) as MatchState<FateDominationCore>;
        expect(view.sys.interaction.current).toBeUndefined();
        expect(JSON.stringify(view.sys)).not.toContain('remote2');
        expect(JSON.stringify(view.sys.eventStream)).not.toContain('drawn');
    }
    const owner = applyPlayerViewToState(engineConfig, game.state, '0') as MatchState<FateDominationCore>;
    expect(owner.sys.interaction.current?.id).toBe(game.state.sys.interaction.current?.id);
});
