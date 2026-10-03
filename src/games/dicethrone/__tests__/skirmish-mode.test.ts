import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH, SKIRMISH_INITIAL_HEALTH, type DiceThroneCommand, type DiceThroneCore } from '../domain/types';
import { createNoResponseSetup, cmd, fixedRandom, fistAttackAbilityId, testSystems } from './test-utils';
import { buildDiceThroneAiLegalActions } from '../ai';
import { reduce } from '../domain/reducer';
import { getContextualOpponentId, getNextPlayerId, getOpponents, getTargetingRollChoiceOptions } from '../domain/rules';
import { getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';

describe('DiceThrone 三人混战', () => {
    it('三人开局使用 35 生命，且不创建 2v2 队伍状态', () => {
        const state = createNoResponseSetup()(['0', '1', '2'], fixedRandom);

        expect(state.core.teamIdByPlayerId).toBeUndefined();
        expect(state.core.teamHealth).toBeUndefined();
        expect(Object.values(state.core.players).map((player) => player.resources[RESOURCE_IDS.HP]))
            .toEqual([SKIRMISH_INITIAL_HEALTH, SKIRMISH_INITIAL_HEALTH, SKIRMISH_INITIAL_HEALTH]);
    });

    it('只剩一名存活者时结束并判定该玩家获胜', () => {
        const state = createNoResponseSetup()(['0', '1', '2'], fixedRandom);
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 0;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 0;
        state.core.players['2'].resources[RESOURCE_IDS.HP] = SKIRMISH_INITIAL_HEALTH;

        expect(DiceThroneDomain.isGameOver(state.core)).toEqual({ winner: '2' });

        state.core.players['2'].resources[RESOURCE_IDS.HP] = 0;
        expect(DiceThroneDomain.isGameOver(state.core)).toEqual({ draw: true });
    });

    it('出局玩家不会继续占用回合轮转或目标候选', () => {
        const state = createNoResponseSetup()(['0', '1', '2'], fixedRandom);
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 0;
        state.core.activePlayerId = '0';

        expect(getNextPlayerId(state.core)).toBe('2');
        expect(getOpponents(state.core, '0')).toEqual(['2']);
        expect(getTargetingRollChoiceOptions(state.core, '0').map((option) => option.customId))
            .toEqual(['select-target:2']);
        expect(getContextualOpponentId(state.core, '0')).toBe('2');
    });

    it('混战治疗上限按 35 起始生命加 10 计算为 45', () => {
        const state = createNoResponseSetup()(['0', '1', '2'], fixedRandom);
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;

        const healed = reduce(state.core, {
            type: 'HEAL_APPLIED',
            payload: { targetId: '0', amount: 10, sourceAbilityId: 'test-skirmish-heal' },
            sourceCommandType: 'TEST',
            timestamp: 1,
        } as any);

        expect(healed.players['0'].resources[RESOURCE_IDS.HP]).toBe(45);
    });

    it('攻击阶段让攻击者从两名对手中选择目标，命中领袖时额外抽一张牌', () => {
        const playerIds = ['0', '1', '2'] as const;
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        let state = createNoResponseSetup()(Array.from(playerIds), fixedRandom);
        state.core.players['1'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH;
        state.core.players['2'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 5;
        const initialHandSize = state.core.players['0'].hand.length;

        const run = (input: ReturnType<typeof cmd>) => {
            const command = {
                type: input.type,
                playerId: input.playerId,
                payload: input.payload,
                timestamp: Date.now(),
            } as DiceThroneCommand;
            const result = executePipeline(pipelineConfig, state, command, fixedRandom, Array.from(playerIds));
            expect(result.success, `${input.type}: ${result.error ?? 'unknown error'}`).toBe(true);
            state = result.state as typeof state;
        };

        run(cmd('ADVANCE_PHASE', '0'));
        run(cmd('ROLL_DICE', '0'));
        run(cmd('CONFIRM_ROLL', '0'));
        run(cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }));
        run(cmd('ADVANCE_PHASE', '0'));

        expect(state.sys.phase).toBe('targetingRoll');
        expect(getCurrentInteractionSummary(state).kind).toBe('dt:defender-choice');
        const aiTargetActions = buildDiceThroneAiLegalActions({ playerId: '0', state });
        expect(aiTargetActions).toHaveLength(2);
        expect(aiTargetActions.every((action) => action.commands[0]?.type === 'SELECT_DEFENDER_TARGET')).toBe(true);

        run(cmd('SELECT_DEFENDER_TARGET', '0', { defenderId: '1' }));

        expect(state.core.pendingAttack?.defenderId).toBe('1');
        expect(state.core.players['0'].hand.length).toBe(initialHandSize + 1);
        expect(state.core.pendingAttack?.skirmishLeaderBonusDrawn).toBe(true);
    });

});
