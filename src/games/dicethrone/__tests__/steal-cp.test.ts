/**
 * 暗影刺客 - 偷窃技能测试
 * 
 * 测试偷窃技能的完整功能：
 * - 无 Shadow：只从银行获得 CP
 * - 有 Shadow：一级从对手偷取 CP（最多 1）
 * - 对手 CP 不足：只偷取实际拥有的
 * - 偷窃 II：获得更多 CP
 */
import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { diceThroneSystemsForTest } from '../game';
import { createQueuedRandom, fixedRandom, getDefenderChoicePrompt } from './test-utils';

const testSystems = diceThroneSystemsForTest as unknown as EngineSystem<DiceThroneCore>[];

const setupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'shadow_thief' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'barbarian' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

const teamSetupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'shadow_thief' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'barbarian' } },
    { type: 'SELECT_CHARACTER', playerId: '2', payload: { characterId: 'samurai' } },
    { type: 'SELECT_CHARACTER', playerId: '3', payload: { characterId: 'monk' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'PLAYER_READY', playerId: '2', payload: {} },
    { type: 'PLAYER_READY', playerId: '3', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

function createTestState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, testSystems, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
    const commands = playerIds.length === 4 ? teamSetupCommands : setupCommands;
    for (const c of commands) {
        const command = { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }
    // 清空手牌避免响应窗口干扰
    for (const playerId of playerIds) {
        state.core.players[playerId].hand = [];
    }
    return state;
}

function dispatch(
    state: MatchState<DiceThroneCore>,
    command: Partial<DiceThroneCommand>,
    random: RandomFn = fixedRandom,
    playerIds: PlayerId[] = ['0', '1']
): MatchState<DiceThroneCore> {
    const fullCommand = { ...command, timestamp: Date.now() } as DiceThroneCommand;
    const result = executePipeline(
        { domain: DiceThroneDomain, systems: testSystems },
        state,
        fullCommand,
        random,
        playerIds
    );
    return result.success ? result.state as MatchState<DiceThroneCore> : state;
}

describe('暗影刺客 - 偷窃技能', () => {
    it('无 Shadow：只从银行获得 CP', () => {
        const random = createQueuedRandom([3, 4, 1, 2, 5]);
        let state = createTestState(['0', '1'], random);
        
        // 给对手一些 CP
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];
        
        // 进入攻击阶段
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random);
        
        // 投骰子
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' }, random);
        
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' }, random);
        
        // 选择偷窃技能并执行
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-2' } }, random);
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random);

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 2); // 只从银行获得 2 CP
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(5); // 对手 CP 不变
        expect(state.core.pendingAttack).toBeNull();
        expect(state.sys.phase).toBe('main2');
    });

    it('有 Shadow：一级扒窃至多 1 CP 来自对手，其余从银行获得', () => {
        const random = createQueuedRandom([3, 4, 6, 1, 2]);
        let state = createTestState(['0', '1'], random);
        
        // 给对手一些 CP
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];
        
        // 进入攻击阶段
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random);
        
        // 投骰子
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' }, random);
        
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' }, random);
        
        // 选择偷窃技能并执行
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-2' } }, random);
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random);

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 2); // 获得 2 CP
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(4); // 对手只失去 1 CP (5-1=4)
        expect(state.core.pendingAttack).toBeNull();
        expect(state.sys.phase).toBe('main2');
    });

    it('有 Shadow 但对手 CP 不足：只偷取实际拥有的', () => {
        const random = createQueuedRandom([3, 4, 6, 1, 2]);
        let state = createTestState(['0', '1'], random);
        
        // 给对手只有 1 CP
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 1;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];
        
        // 进入攻击阶段
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random);
        
        // 投骰子
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' }, random);
        
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' }, random);
        
        // 选择偷窃技能并执行
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-2' } }, random);
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random);

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 2); // 仍获得 2 CP（1 偷取 + 1 银行）
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(0); // 对手失去 1 CP (1-1=0)
    });

    it('3 个 Bag：一级扒窃获得 3 CP，至多 1 CP 来自对手', () => {
        const random = createQueuedRandom([3, 4, 3, 6, 1]);
        let state = createTestState(['0', '1'], random);
        
        // 给对手一些 CP
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];
        
        // 进入攻击阶段
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random);
        
        // 投骰子
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' }, random);
        
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' }, random);
        
        // 选择偷窃技能并执行
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-3' } }, random);
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random);

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 3); // 获得 3 CP
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(4); // 一级扒窃对手只失去 1 CP (5-1=4)
    });

    it('4 人模式：扒窃通过索敌选择一名对手失去 CP', () => {
        const playerIds: PlayerId[] = ['0', '1', '2', '3'];
        const random = createQueuedRandom([3, 4, 6, 1, 2, 6]);
        let state = createTestState(playerIds, random);
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        state.core.players['3'].resources[RESOURCE_IDS.CP] = 5;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];

        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random, playerIds);
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' }, random, playerIds);
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' }, random, playerIds);
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-2' } }, random, playerIds);
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random, playerIds);
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' }, random, playerIds);
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' }, random, playerIds);
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' }, random, playerIds);

        expect(state.sys.phase).toBe('targetingRoll');
        const defenderPrompt = getDefenderChoicePrompt(state);
        const options = defenderPrompt.options as Array<{ customId: string }>;
        expect(options.map((option) => option.customId).sort()).toEqual(['select-target:1', 'select-target:3']);

        state = dispatch(state, { type: 'SELECT_DEFENDER_TARGET', playerId: '0', payload: { defenderId: '3' } }, random, playerIds);

        expect(state.sys.phase).toBe('main2');
        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 2);
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(5);
        expect(state.core.players['3'].resources[RESOURCE_IDS.CP]).toBe(4);
    });
});
