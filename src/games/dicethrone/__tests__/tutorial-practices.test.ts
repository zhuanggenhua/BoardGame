import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MatchState, TutorialManifest } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { TUTORIAL_COMMANDS } from '../../../engine/systems/TutorialSystem';
import { buildLocalDispatchCommand } from '../../../engine/transport/localDispatchCommand';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCommand, DiceThroneCore } from '../domain/types';
import { testSystems, fixedRandom } from './test-utils';
import { DiceThroneDiscardPractice } from '../tutorialPractices';
import DiceThroneTutorials from '../tutorial';

const play = (manifest: TutorialManifest) => {
    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(['0', '1'], fixedRandom),
        sys: createInitialSystemState(['0', '1'], testSystems),
    };
    const dispatch = (type: string, payload: Record<string, unknown> = {}, playerId = '0') => {
        const result = executePipeline({ domain: DiceThroneDomain, systems: testSystems }, state,
            { type, payload, playerId, timestamp: 1 } as DiceThroneCommand, fixedRandom, ['0', '1']);
        if (!result.success) throw new Error(`${state.sys.tutorial.step?.id}: ${type}: ${result.error}`);
        state = result.state as MatchState<DiceThroneCore>;
    };
    dispatch(TUTORIAL_COMMANDS.START, { manifest });
    const visited = new Set<string>();
    for (let count = 0; count < manifest.steps.length + 10; count++) {
        const step = state.sys.tutorial.step!;
        if (!step) return state;
        if (visited.has(step.id)) throw new Error(`Stalled tutorial practice: ${step.id}`);
        visited.add(step.id);
        if (step.aiActions?.length) {
            for (const action of step.aiActions) {
                const { command } = buildLocalDispatchCommand({
                    state, commandType: action.commandType, localPregameControlledPlayerId: null,
                    payload: { ...(action.payload as Record<string, unknown> ?? {}), __tutorialAiCommand: true, __tutorialPlayerId: action.playerId ?? '0' },
                });
                dispatch(command.type, command.payload as Record<string, unknown>, command.playerId);
            }
            dispatch(TUTORIAL_COMMANDS.AI_CONSUMED, { stepId: step.id });
            if (state.sys.tutorial.step?.id !== step.id) continue;
        }
        if (step.infoStep || step.aiActions?.length) {
            dispatch(TUTORIAL_COMMANDS.NEXT, { reason: 'manual' });
            continue;
        }
        switch (step.id) {
            case 'limit-start':
                dispatch('SELL_CARD', { cardId: state.core.players['0'].hand[0].id });
                expect(state.core.players['0'].hand).toHaveLength(6);
                expect(state.core.players['0'].resources.cp).toBe(15);
                dispatch('ADVANCE_PHASE');
                break;
            default: throw new Error(`Unknown tutorial practice action: ${step.id}`);
        }
    }
    throw new Error('Tutorial practice did not finish');
};

describe('骰铸教程只保留无法自然进入主线的机制练习', () => {
    beforeEach(() => { (globalThis as Record<string, unknown>).__BG_GAME_MODE__ = 'tutorial'; });
    afterEach(() => { delete (globalThis as Record<string, unknown>).__BG_GAME_MODE__; });
    it('目录只有连续主线和自然起手无法触发的手牌上限练习', () => {
        expect(Object.keys(DiceThroneTutorials.tutorials)).toEqual([
            'dicethrone-basic',
            'dicethrone-hand-limit',
        ]);
        const basicSteps = DiceThroneTutorials.tutorials['dicethrone-basic'].manifest.steps.map(step => step.id);
        expect(basicSteps).toEqual(expect.arrayContaining([
            'enlightenment-play',
            'double-play',
            'interference-play',
            'response-finish',
        ]));
        expect(basicSteps).not.toContain('interference-pass');
        expect(basicSteps.indexOf('enlightenment-play')).toBeLessThan(basicSteps.indexOf('double-play'));
        expect(basicSteps.indexOf('double-play')).toBeLessThan(basicSteps.indexOf('end-turn'));
        expect(basicSteps.indexOf('end-turn')).toBeLessThan(basicSteps.indexOf('interference-play'));
        expect(basicSteps.indexOf('interference-play')).toBeLessThan(basicSteps.indexOf('response-finish'));
    });
    it('超限出售、CP 上限、牌库耗尽后收入重洗抽牌', () => {
        const state = play(DiceThroneDiscardPractice);
        expect(state.core.activePlayerId).toBe('0');
        expect(state.core.players['0'].hand).toHaveLength(7);
        expect(state.core.players['0'].resources.cp).toBe(15);
        expect(state.core.players['0'].deck.length).toBeGreaterThan(0);
        expect(state.core.players['0'].discard).toHaveLength(0);
    });
});
