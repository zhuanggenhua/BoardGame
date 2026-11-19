import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { applyPlayerViewToState } from '../../../engine/ai/playerView';
import type { AiDecisionContext } from '../../../engine/ai';
import type { MatchState } from '../../../engine/types';
import { FateDominationDomain } from '../domain';
import type { FateDominationCore } from '../domain';
import { engineConfig } from '../game';
import { buildFateAiLegalActions, chooseFateAiAction, projectFateAiActionOutcome } from '../ai';
import { FATE_EVENTS, FATE_SERVANT_BY_ID } from '../data';
import { visibleFatePower } from '../domain/playerView';
import { FATE_CHARIOT_CHOICE } from '../domain/chariotChoice';
import { createRespondToPromptCommand, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';

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
