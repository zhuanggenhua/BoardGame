import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { TOKEN_IDS } from '../domain/ids';
import type { DiceThroneCore } from '../domain/types';
import { shouldShowManualPhaseAdvance } from '../ui/viewMode';
import { cmd, createHeroMatchup, createQueuedRandom, fixedRandom, testSystems } from './test-utils';

type TestState = ReturnType<ReturnType<typeof createHeroMatchup>>;

const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
const playerIds = ['0', '1'];

const runCommand = (
    state: TestState,
    command: ReturnType<typeof cmd>,
    random = fixedRandom,
) => executePipeline(
    pipelineConfig,
    state,
    { ...command, timestamp: 0 } as any,
    random,
    playerIds,
);

describe('DiceThrone 开局自动推进门禁', () => {
    it('普通英雄进入 upkeep 后应继续自动推进', () => {
        const state = createHeroMatchup('monk', 'pyromancer')(['0', '1'], fixedRandom);

        const auto = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: { ...state, sys: { ...state.sys, phase: 'upkeep' } },
            events: [{
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'discard', to: 'upkeep' },
            }],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(auto).toEqual({ autoContinue: true, playerId: '0' });
    });

    it('普通英雄进入 income 后应继续自动推进', () => {
        const state = createHeroMatchup('monk', 'pyromancer')(['0', '1'], fixedRandom);

        const auto = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: { ...state, sys: { ...state.sys, phase: 'income' } },
            events: [{
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'upkeep', to: 'income' },
            }],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(auto).toEqual({ autoContinue: true, playerId: '0' });
    });

    it('维护与收入阶段不应给玩家手动阶段推进入口', () => {
        expect(shouldShowManualPhaseAdvance('upkeep', false)).toBe(false);
        expect(shouldShowManualPhaseAdvance('income', false)).toBe(false);
        expect(shouldShowManualPhaseAdvance('main1', false)).toBe(true);
    });

    it('工匠在 upkeep 有可点纳米机器人时应停住等待玩家', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.players['0'].artificerBotState = {
            ...(state.core.players['0'].artificerBotState ?? {}),
            [TOKEN_IDS.NANOBOT]: {
                built: true,
                upgraded: false,
                activationsUsedThisTurn: 0,
            },
        } as DiceThroneCore['players'][string]['artificerBotState'];

        const auto = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: { ...state, sys: { ...state.sys, phase: 'upkeep' } },
            events: [{
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'discard', to: 'upkeep' },
            }],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(auto).toBeUndefined();
    });

    it('选择进攻技能只应创建当前攻击，不应自动跳到防御阶段', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        let state = createHeroMatchup('monk', 'barbarian')(playerIds, random);

        for (const command of [
            cmd('ADVANCE_PHASE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('CONFIRM_ROLL', '0'),
        ]) {
            const result = runCommand(state, command, random);
            expect(result.success, `${command.type} 必须成功：${result.error ?? ''}`).toBe(true);
            state = result.state as TestState;
        }

        const selected = runCommand(state, cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }), random);
        expect(selected.success, selected.error ?? '').toBe(true);
        expect(selected.state?.sys.phase).toBe('offensiveRoll');
        expect(selected.state?.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-5');

        const advanced = runCommand(selected.state as TestState, cmd('ADVANCE_PHASE', '0'), random);
        expect(advanced.success, advanced.error ?? '').toBe(true);
        expect(advanced.state?.sys.phase).toBe('defensiveRoll');
    });

    it('防御技能选择不是阻塞收口事件，不能靠 flowHalted 残留自动离开防御阶段', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1, 2, 2, 2, 2]);
        let state = createHeroMatchup('monk', 'shadow_thief')(playerIds, random);

        for (const command of [
            cmd('ADVANCE_PHASE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('CONFIRM_ROLL', '0'),
            cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
            cmd('ADVANCE_PHASE', '0'),
            cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-defense' }),
            cmd('ROLL_DICE', '1'),
            cmd('CONFIRM_ROLL', '1'),
        ]) {
            const result = runCommand(state, command, random);
            expect(result.success, `${command.type} 必须成功：${result.error ?? ''}`).toBe(true);
            state = result.state as TestState;
        }

        expect(state.sys.phase).toBe('defensiveRoll');
        expect(state.core.pendingAttack?.defenseAbilityId).toBe('shadow-defense');
        state = { ...state, sys: { ...state.sys, flowHalted: true } };

        const selectedDefense = runCommand(state, cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-defense' }), random);
        expect(selectedDefense.success, selectedDefense.error ?? '').toBe(true);
        expect(selectedDefense.state?.sys.phase).toBe('defensiveRoll');
        expect(selectedDefense.state?.core.pendingAttack?.defenseAbilityId).toBe('shadow-defense');

        const advanced = runCommand(selectedDefense.state as TestState, cmd('ADVANCE_PHASE', '1'), random);
        expect(advanced.success, advanced.error ?? '').toBe(true);
        expect(advanced.state?.sys.phase).toBe('main2');
    });
});
