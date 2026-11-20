import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { applyPlayerViewToState } from '../../../engine/ai/playerView';
import type { AiDecisionContext } from '../../../engine/ai';
import type { MatchState } from '../../../engine/types';
import { FateDominationDomain } from '../domain';
import type { FateDominationCore } from '../domain';
import { engineConfig } from '../game';
import { buildFateAiLegalActions, chooseFateAiAction, projectFateAiActionOutcome } from '../ai';
import { FATE_EVENTS, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../data';
import { visibleFatePower } from '../domain/playerView';
import { FATE_CHARIOT_CHOICE } from '../domain/chariotChoice';
import { FATE_RIDING_CHOICE_SOURCE } from '../domain/ridingChoice';
import { createRespondToPromptCommand, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import { prepareSaberDayTen, type SaberDayTenCase } from './fixtures/saberDayTen';

const ids = ['0', '1', '2'];
function match(seed: string) {
    const random = createSeededRandom(seed);
    let state: MatchState<FateDominationCore> = { core: FateDominationDomain.setup(ids, random), sys: createInitialSystemState(ids, engineConfig.systems, seed) };
    return {
        get state() { return state; },
        send(type: string, playerId: string, payload: unknown = {}) {
            const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, { type, playerId, payload }, random, ids);
            expect(result.success, `${type}: ${result.error ?? ''}`).toBe(true);
            state = result.state;
        },
    };
}
function context(state: MatchState<FateDominationCore>, playerId: string): AiDecisionContext {
    const visibleState = applyPlayerViewToState(engineConfig, state, playerId);
    return { gameId: 'fate-domination', matchId: 'test', playerId, visibleState, interaction: null, responseWindow: null,
        legalActions: buildFateAiLegalActions({ state: visibleState, playerId }), rulesVersion: null, decisionBudgetMs: 5000, source: 'local',
        difficulty: { level: 'normal', searchDepth: 1, shortlistSize: 8, simulationBudgetMs: 50, randomness: 0, beliefSampleCount: 1, evaluatorProfile: 'basic' } };
}

it('电脑等待当前玩家完成准备，轮到自己时按开局分配的身份完成准备', () => {
    const game = match('fate-ai-setup');
    const offTurn = context(game.state, '1');
    expect(offTurn.legalActions).toEqual([]);
    expect(chooseFateAiAction(offTurn)).toBeNull();
    const current = context(game.state, '0');
    const decision = chooseFateAiAction(current)!;
    expect(current.legalActions.find(action => action.actionId === decision.actionId)?.commands[0].type).toBe('ADVANCE_PHASE');
});

it.each([
    { mana: 6, canFund: true },
    { mana: 2, canFund: false },
])('末日可用魔力 $mana 时，只为实际能打出的更强攻击消耗令咒', ({ mana, canFund }) => {
    const game = match('fate-ai-final-seal');
    for (const id of ids) game.send('ADVANCE_PHASE', id);
    for (const id of ids) {
        game.send('DEPLOY_MASTER', id, { locationId: 'miyama' });
        game.send('ADVANCE_PHASE', id);
    }
    const core = game.state.core;
    core.round = 11;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit13')!;
    core.currentEvents = { miyama: [], shinto: [] };
    core.battlefield.miyama.eventCards = [];
    const player = core.players['0'];
    player.mana = mana;
    player.commandSpells = 1;
    player.isRevealed = true;
    player.hand = [{ id: 'first', definitionId: 'cardB1' }, { id: 'second', definitionId: 'cardB2' }];
    const excalibur = player.skills.find(skill => skill.id.startsWith('sc_saber_np:'))!;
    const decide = () => {
        const ctx = context(game.state, '0');
        const result = chooseFateAiAction(ctx);
        return ctx.legalActions.find(candidate => candidate.actionId === result?.actionId)!.commands[0];
    };
    const first = decide();
    if (canFund) {
        expect(first).toEqual({ type: 'USE_COMMAND_SPELL', payload: { effect: 'mana' } });
        game.send(first.type, '0', first.payload);
        expect(game.state.core.players['0']).toMatchObject({ mana: 10, commandSpells: 0 });
        const followUp = decide();
        expect(followUp).toMatchObject({ type: 'CONFIRM_ATTACK', payload: { cardIds: expect.arrayContaining([excalibur.id]) } });
        game.send(followUp.type, '0', followUp.payload);
        expect(game.state.core.players['0']).toMatchObject({ mana: 2, isRevealed: true, activeSkills: [excalibur.id] });
    } else {
        expect(first).toMatchObject({ type: 'CONFIRM_ATTACK', payload: { cardIds: expect.arrayContaining(['first', 'second']) } });
        game.send(first.type, '0', first.payload);
        expect(game.state.core.players['0']).toMatchObject({ mana, commandSpells: 1, activeSkills: [] });
    }
});

it.each([false, true])('在魔术工房确认攻击时，只为能带入战斗的威力付费（能用战斗续行=%s）', canMove => {
    const game = match('fate-ai-workshop-attack-value');
    if (canMove) {
        game.send('ADVANCE_PHASE', '0', { identities: { masterId: 'm_shinji', servantId: 'servant-cu-chulainn' } });
    } else {
        game.send('ADVANCE_PHASE', '0');
    }
    for (const id of ['1', '2']) game.send('ADVANCE_PHASE', id);
    for (const id of ids) {
        game.send('DEPLOY_MASTER', id, { locationId: id === '0' ? 'workshop' : 'miyama' });
        game.send('ADVANCE_PHASE', id);
    }
    const core = game.state.core;
    core.round = 10;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit12')!;
    core.currentEvents = { miyama: [], shinto: [] };
    core.battlefield.miyama.eventCards = [];
    const player = core.players['0'];
    player.mana = 8;
    player.commandSpells = 0;
    player.normalMoveCompleted = true;
    player.hand = [{ id: 'first', definitionId: 'cardB3' }, { id: 'second', definitionId: 'cardB2' }];
    const abilityId = player.skills.find(skill => skill.id.split(':')[0] === (canMove ? 'sc_cu_2' : 'sc_saber_np'))!.id;
    const decide = () => {
        const ctx = context(game.state, '0');
        const result = chooseFateAiAction(ctx);
        return ctx.legalActions.find(candidate => candidate.actionId === result?.actionId)!.commands[0];
    };
    const confirmation = decide();
    expect(confirmation.type).toBe('CONFIRM_ATTACK');
    game.send(confirmation.type, '0', confirmation.payload);
    const after = game.state.core.players['0'];
    if (canMove) {
        expect(after.activeSkills).toContain(abilityId);
        const move = decide();
        expect(move).toEqual({ type: 'PLAY_SKILL', payload: { skillId: abilityId, targetLocationId: 'miyama' } });
        game.send(move.type, '0', move.payload);
        expect(game.state.core.players['0']).toMatchObject({ locationId: 'miyama', mana: after.mana });
    } else {
        expect(after).toMatchObject({ mana: 8, locationId: 'workshop', activeSkills: [] });
    }
});

it.each([
    { scenario: 'safe', skill: undefined, remainingMana: 8 },
    { scenario: 'counter', skill: 'sc_saber_2', remainingMana: 6 },
    { scenario: 'pressure', skill: 'sc_saber_np', remainingMana: 0 },
    { scenario: 'refill', skill: 'sc_saber_np', remainingMana: 0 },
] satisfies { scenario: SaberDayTenCase; skill?: string; remainingMana: number }[])('第十天在深山町按淘汰风险和次日实得魔力出牌（$scenario）', ({ scenario, skill, remainingMana }) => {
    const game = match(`fate-saber-day-ten-${scenario}`);
    prepareSaberDayTen(game.state.core, scenario, { saberId: '0', rivalId: '1', workshopId: '2' });
    const ctx = context(game.state, '0');
    const visible = ctx.visibleState as MatchState<FateDominationCore>;
    expect(visible.core.players['1'].hand).toEqual([]);
    const decision = chooseFateAiAction(ctx)!;
    const selected = ctx.legalActions.find(candidate => candidate.actionId === decision.actionId)!.commands[0];
    expect(selected.type).toBe('CONFIRM_ATTACK');
    game.send(selected.type, '0', selected.payload);
    const player = game.state.core.players['0'];
    expect(player.activeSkills.map(id => id.split(':')[0])).toEqual(skill ? [skill] : []);
    expect(player.mana).toBe(remainingMana);
});

it('第十天对手还可出牌时，不把目前领先当成已经晋级', () => {
    const game = match('fate-saber-day-ten-open-rival');
    const { core } = game.state;
    prepareSaberDayTen(core, 'pressure', { saberId: '0', rivalId: '1', workshopId: '2' });
    core.turnOrder = ['2', '0', '1'];
    core.currentTurnIndex = 1;
    Object.assign(core.players['1'], { activeAttackIds: [], normalAttackPlayed: false, hasPassedAction: false, mana: 10 });
    const ctx = context(game.state, '0');
    const decision = chooseFateAiAction(ctx)!;
    const selected = ctx.legalActions.find(candidate => candidate.actionId === decision.actionId)!.commands[0];
    expect(selected.type).toBe('CONFIRM_ATTACK');
    game.send(selected.type, '0', selected.payload);
    expect(game.state.core.players['0'].activeSkills[0]).toMatch(/^sc_saber_np:/);
});

it.each([true, false])('美杜莎按实际可追加的手牌价值决定是否打出骑乘（有合法追加牌=%s）', canAdd => {
    const game = match('fate-ai-riding-plan');
    game.send('ADVANCE_PHASE', '0', { identities: { masterId: 'm_shinji', servantId: 'servant-medusa' } });
    for (const id of ['1', '2']) game.send('ADVANCE_PHASE', id);
    for (const id of ids) {
        game.send('DEPLOY_MASTER', id, { locationId: 'miyama' });
        game.send('ADVANCE_PHASE', id);
    }
    const core = game.state.core;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit1')!;
    core.currentEvents = { miyama: [], shinto: [] };
    core.battlefield.miyama.eventCards = [];
    const player = core.players['0'];
    player.mana = 8;
    player.commandSpells = 0;
    const byDefinition = [...player.hand, ...player.deck];
    const wanted = canAdd ? ['cardB1', 'cardB2', 'cardQ2', 'cardSurveil'] : ['cardB4', 'cardQ3', 'cardQ4'];
    player.hand = wanted.map(id => byDefinition.find(card => card.definitionId === id)!);
    player.deck = byDefinition.filter(card => !player.hand.includes(card));
    if (canAdd) {
        const high = player.deck.find(card => card.definitionId === 'cardB4')!;
        player.deck = [high, ...player.deck.filter(card => card.id !== high.id)];
    }
    const paidCard = player.hand.find(card => card.definitionId === 'cardSurveil');
    const riding = player.skills.find(skill => skill.id.startsWith('sc_medusa_1:'))!;
    const decide = () => {
        const ctx = context(game.state, '0');
        const chosen = chooseFateAiAction(ctx);
        return ctx.legalActions.find(candidate => candidate.actionId === chosen?.actionId)!.commands[0];
    };
    const confirm = decide();
    expect(confirm.type).toBe('CONFIRM_ATTACK');
    expect((confirm.payload as { cardIds: string[] }).cardIds.includes(riding.id)).toBe(canAdd);
    game.send(confirm.type, '0', confirm.payload);
    if (!canAdd) return;
    const activate = decide();
    expect(activate).toEqual({ type: 'PLAY_SKILL', payload: { skillId: riding.id } });
    game.send(activate.type, '0', activate.payload);
    expect(getCurrentInteractionSummary(game.state)).toMatchObject({ playerId: '0', sourceId: FATE_RIDING_CHOICE_SOURCE });
    const add = decide();
    const before = game.state.core.players['0'];
    game.send(add.type, '0', add.payload);
    const after = game.state.core.players['0'];
    expect(after.activeAttackIds.length - before.activeAttackIds.length).toBe(3);
    expect(after.activeAttackIds).toContain(paidCard!.id);
    expect(after.mana).toBe(before.mana - 1);
    expect(after.selectedAttackIds).toEqual([]);
    expect(getCurrentInteractionSummary(game.state).id).toBeUndefined();
});

it.each(['fate-ai-natural-1', 'fate-ai-natural-2', 'fate-ai-natural-3'])('三席使用各自私有视图自然推进至终局，无非法动作或重复选择：%s', seed => {
    const game = match(seed);
    const rounds = new Set<number>();
    let count = 0;
    while (!game.state.sys.gameover && count++ < 900) {
        const playerId = game.state.sys.interaction.current?.playerId ?? game.state.core.currentPlayerId;
        const decisionContext = context(game.state, playerId);
        expect(decisionContext.legalActions.length, `round ${game.state.core.round}, ${game.state.core.phase}, ${playerId}`).toBeGreaterThan(0);
        const selected = chooseFateAiAction(decisionContext)!;
        const candidate = decisionContext.legalActions.find(action => action.actionId === selected.actionId)!;
        expect(candidate.commands).toHaveLength(1);
        game.send(candidate.commands[0].type, playerId, candidate.commands[0].payload);
        rounds.add(game.state.core.round);
    }
    expect(game.state.sys.gameover).toBeTruthy();
    expect(rounds.size).toBeGreaterThan(1);
    expect(count).toBeLessThan(900);
}, 30000);

it('合法但零收益的消耗能力不会优先于正式结束行动', () => {
    const game = match('fate-ai-zero-benefit');
    for (const id of ids) game.send('ADVANCE_PHASE', id);
    for (const id of ids) { game.send('DEPLOY_MASTER', id, { locationId: 'miyama' }); game.send('ADVANCE_PHASE', id); }
    const player = game.state.core.players['0'];
    player.normalAttackPlayed = true;
    player.activeAttackIds = [];
    player.activeSkills = [];
    player.hand = [{ id: 'remote', definitionId: 'cardPreparation' }];
    player.activeAttackIds = ['remote'];
    player.deploymentSlot = null;
    game.state.core.battlefield.miyama.eventCards = [];
    game.state.core.currentEvents.miyama = [];
    const ctx = context(game.state, '0');
    const zero = ctx.legalActions.find(action => action.commands[0].type === 'PLAY_SKILL')!;
    expect(zero).toBeTruthy();
    expect(projectFateAiActionOutcome({ context: ctx, action: zero })?.hasMeaningfulEffect).toBe(false);
    const selected = chooseFateAiAction(ctx)!;
    expect(ctx.legalActions.find(action => action.actionId === selected.actionId)?.commands[0].type).not.toBe('PLAY_SKILL');
});

it.each([true, false])('石化之魔眼按已公开的特殊攻击选择发动（对手均已打出=%s）', allProtected => {
    const game = match('fate-ai-medusa-eyes');
    const { core } = game.state;
    const actor = core.players['0'];
    core.phase = 'action';
    core.currentPlayerId = actor.id;
    core.battlefield.miyama.playerIds = ids;
    for (const player of Object.values(core.players)) player.locationId = 'miyama';
    actor.servantId = 'servant-medusa';
    actor.isRevealed = true;
    actor.mana = 0;
    actor.commandSpells = 0;
    actor.normalMoveCompleted = true;
    actor.normalAttackPlayed = true;
    const printed = FATE_SERVANT_BY_ID[actor.servantId].skillCards!.find(skill => skill.id === 'sc_medusa_2')!;
    const eyes = { ...printed, id: `${printed.id}:0` };
    actor.skills = [eyes];
    actor.activeSkills = [eyes.id];
    core.players['1'].playedSpecialAttackThisRound = true;
    core.players['2'].playedSpecialAttackThisRound = allProtected;
    core.players['2'].hand = [{ id: 'private-special', definitionId: 'cardSurveil' }];

    const ctx = context(game.state, actor.id);
    const eyesAction = ctx.legalActions.find(action => action.kind === 'play_skill')!;
    expect(projectFateAiActionOutcome({ context: ctx, action: eyesAction })?.hasMeaningfulEffect).toBe(!allProtected);
    expect(chooseFateAiAction(ctx)?.actionId === eyesAction.actionId).toBe(!allProtected);
});

it.each([true, false])('突穿死翔之枪在战场有对手时预估战果并发动（有对手=%s）', contested => {
    const game = match('fate-ai-cu-spear-score');
    const { core } = game.state;
    const actor = core.players['0'];
    core.phase = 'battle';
    core.currentPlayerId = actor.id;
    core.battlefield.miyama.playerIds = contested ? ['0', '1'] : ['0'];
    actor.locationId = 'miyama';
    core.players['1'].locationId = contested ? 'miyama' : 'workshop';
    actor.servantId = 'servant-cu-chulainn';
    actor.isRevealed = true;
    const printed = FATE_SERVANT_BY_ID[actor.servantId].skillCards!.find(skill => skill.id === 'sc_cu_np')!;
    const spear = { ...printed, id: `${printed.id}:0` };
    actor.skills = [spear];
    actor.activeSkills = [spear.id];

    const ctx = context(game.state, actor.id);
    const spearAction = ctx.legalActions.find(action => action.kind === 'play_skill')!;
    expect(projectFateAiActionOutcome({ context: ctx, action: spearAction })?.hasMeaningfulEffect).toBe(contested);
    expect(chooseFateAiAction(ctx)?.actionId === spearAction.actionId).toBe(contested);
});

it.each([
    { skillId: 'sc_saber_1', definitionId: 'cardA4' },
    { skillId: 'sc_saber_2', definitionId: 'cardB4' },
])('AI 根据公开攻击估算 $skillId 的归零收益', ({ skillId, definitionId }) => {
    const game = match('fate-ai-saber-nullification');
    const { core } = game.state;
    const saber = core.players['0'];
    const opponent = core.players['1'];
    core.phase = 'battle';
    core.currentPlayerId = saber.id;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit1')!;
    core.battlefield.miyama.playerIds = ['0', '1'];
    core.battlefield.miyama.eventCards = [];
    saber.locationId = opponent.locationId = 'miyama';
    saber.servantId = 'servant-saber';
    const printed = FATE_SERVANT_BY_ID[saber.servantId].skillCards!.find(skill => skill.id === skillId)!;
    const skill = { ...printed, id: `${printed.id}:0` };
    saber.skills = [skill];
    saber.activeSkills = [skill.id];
    opponent.hand = [{ id: 'played-rival', definitionId }];
    opponent.activeAttackIds = ['played-rival'];

    const visible = context(game.state, saber.id);
    const activate = visible.legalActions.find(action => action.kind === 'play_skill')!;
    expect(projectFateAiActionOutcome({ context: visible, action: activate })?.hasMeaningfulEffect).toBe(true);
    expect(chooseFateAiAction(visible)?.actionId).toBe(activate.actionId);
    opponent.faceDownAttackIds = ['played-rival'];
    const hidden = context(game.state, saber.id);
    expect(projectFateAiActionOutcome({ context: hidden, action: activate })?.hasMeaningfulEffect).toBe(false);
});

function prepareChariotGame(eventId: string) {
    const game = match('fate-ai-chariot');
    const { core } = game.state;
    const actor = core.players['0'];
    const event = FATE_EVENTS.find(card => card.id === eventId)!;
    const skill = FATE_SERVANT_BY_ID['servant-rider'].skillCards!.find(card => card.id === 'sc_iskandar_2')!;
    const activeId = `${skill.id}:0`;
    Object.assign(actor, { servantId: 'servant-rider', skills: [{ ...skill, id: activeId }], activeSkills: [activeId],
        mana: 0, commandSpells: 0, isRevealed: true, normalAttackPlayed: true, normalMoveCompleted: true, locationId: 'miyama' });
    core.phase = 'action';
    core.currentPlayerId = '0';
    core.battlefield.miyama = { ...core.battlefield.miyama, playerIds: ['0'], eventCards: [event] };
    core.currentEvents.miyama = [event];
    core.eventDeck = [FATE_EVENTS[9], FATE_EVENTS[4]].filter(card => card.id !== eventId);
    core.eventDiscard = [];
    core.eventDeckCount = core.eventDeck.length;
    return game;
}

it('领先时用神威车轮淘汰低战果事件，从实际两张候选选高并结束行动', () => {
    const game = prepareChariotGame('fuyuki_E11');
    const decide = () => {
        const ctx = context(game.state, '0');
        return ctx.legalActions.find(action => action.actionId === chooseFateAiAction(ctx)?.actionId)!.commands[0];
    };
    expect(context(game.state, '0').visibleState.core).toMatchObject({ eventDeck: [] });
    const activation = decide();
    expect(activation).toMatchObject({ type: 'PLAY_SKILL', payload: { targetCardId: 'fuyuki_E11' } });
    game.send(activation.type, '0', activation.payload);
    expect(getCurrentInteractionSummary(game.state).sourceId).toBe(FATE_CHARIOT_CHOICE);
    const choice = decide();
    const expectedChoice = createRespondToPromptCommand(game.state, { playerId: '0', optionId: 'fuyuki_E4' });
    expect(choice).toMatchObject({ type: expectedChoice.type, payload: expectedChoice.payload });
    game.send(choice.type, '0', choice.payload);
    expect(getCurrentInteractionSummary(game.state).id).toBeUndefined();
    expect(game.state.core.currentEvents.miyama.map(event => event.id)).toEqual(['fuyuki_E4']);
    expect(decide().type).toBe('PASS_ACTION');
});

it.each(['已有高战果牌', '当前并列首位'])('%s时保留现有事件，合法的车轮发动仍在候选中', reason => {
    const game = prepareChariotGame(reason === '已有高战果牌' ? 'fuyuki_E0' : 'fuyuki_E11');
    const { core } = game.state;
    if (reason === '当前并列首位') {
        core.players['1'].locationId = 'miyama';
        core.battlefield.miyama.playerIds.push('1');
    }
    const ctx = context(game.state, '0');
    const visible = ctx.visibleState as MatchState<FateDominationCore>;
    if (reason === '当前并列首位') visible.core.players['1'].publicView!.power = visibleFatePower(visible.core, '0', '0');
    expect(ctx.legalActions.some(action => action.commands[0].type === 'PLAY_SKILL')).toBe(true);
    expect(ctx.legalActions.find(action => action.actionId === chooseFateAiAction(ctx)?.actionId)?.commands[0].type).toBe('PASS_ACTION');
});

it('事件牌库与弃牌堆都空时不生成无解选牌，直接结束行动', () => {
    const game = prepareChariotGame('fuyuki_E11');
    game.state.core.eventDeck = [];
    game.state.core.eventDeckCount = 0;
    game.state.core.eventDiscardCount = 0;
    const ctx = context(game.state, '0');
    expect(ctx.legalActions.some(action => action.commands[0].type === 'PLAY_SKILL')).toBe(false);
    expect(ctx.legalActions.find(action => action.actionId === chooseFateAiAction(ctx)?.actionId)?.commands[0].type).toBe('PASS_ACTION');
});
