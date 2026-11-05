import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { applyPlayerViewToState } from '../../../engine/ai/playerView';
import type { AiDecisionContext } from '../../../engine/ai';
import type { MatchState } from '../../../engine/types';
import { FateDominationDomain } from '../domain';
import type { FateDominationCore } from '../domain';
import { engineConfig } from '../game';
import { buildFateAiLegalActions, chooseFateAiAction, projectFateAiActionOutcome } from '../ai';

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

it('非当前席保留合法选角，当前席优先完成准备而不循环重选', () => {
    const game = match('fate-ai-setup');
    const offTurn = context(game.state, '1');
    expect(offTurn.legalActions.some(action => action.commands[0].type === 'SELECT_MASTER')).toBe(true);
    expect(offTurn.legalActions.some(action => action.commands[0].type === 'ADVANCE_PHASE')).toBe(false);
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
