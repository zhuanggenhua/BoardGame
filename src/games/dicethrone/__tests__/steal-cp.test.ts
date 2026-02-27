/**
 * 暗影刺客 - 偷窃技能测试
 * 
 * 测试偷窃技能的完整功能：
 * - 无 Shadow：只从银行获得 CP
 * - 有 Shadow：从对手偷取 CP（最多 2）
 * - 对手 CP 不足：只偷取实际拥有的
 * - 偷窃 II：获得更多 CP
 */
import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { SHADOW_THIEF_DICE_FACE_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { diceThroneSystemsForTest } from '../game';
import { fixedRandom } from './test-utils';

const FACE = SHADOW_THIEF_DICE_FACE_IDS;
const testSystems = diceThroneSystemsForTest as unknown as EngineSystem<DiceThroneCore>[];

const setupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'shadow_thief' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'barbarian' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

function createTestState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, testSystems, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
    for (const c of setupCommands) {
        const command = { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }
    // 清空手牌避免响应窗口干扰
    state.core.players['0'].hand = [];
    state.core.players['1'].hand = [];
    return state;
}

function dispatch(state: MatchState<DiceThroneCore>, command: Partial<DiceThroneCommand>, random: RandomFn = fixedRandom): MatchState<DiceThroneCore> {
    const fullCommand = { ...command, timestamp: Date.now() } as DiceThroneCommand;
    const result = executePipeline(
        { domain: DiceThroneDomain, systems: testSystems },
        state,
        fullCommand,
        random,
        ['0', '1']
    );
    return result.success ? result.state as MatchState<DiceThroneCore> : state;
}

describe('暗影刺客 - 偷窃技能', () => {
    it('无 Shadow：只从银行获得 CP', () => {
        let state = createTestState(['0', '1'], fixedRandom);
        
        // 给对手一些 CP
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];
        
        // 进入攻击阶段
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' });
        
        // 投骰子
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' });

        // 修改骰子结果为 2 个 Bag (value 3, 4)，无 Shadow
        state.core.dice = state.core.dice.map((die, i) => ({
            ...die,
            value: i === 0 ? 3 : (i === 1 ? 4 : (i === 2 ? 1 : (i === 3 ? 2 : 5))),
            symbol: i === 0 ? FACE.BAG : (i === 1 ? FACE.BAG : (i === 2 ? FACE.DAGGER : (i === 3 ? FACE.DAGGER : FACE.CARD))),
            symbols: i === 0 ? [FACE.BAG] : (i === 1 ? [FACE.BAG] : (i === 2 ? [FACE.DAGGER] : (i === 3 ? [FACE.DAGGER] : [FACE.CARD]))),
        }));
        
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' });
        
        // 选择偷窃技能并执行
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-2' } });
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' });

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 2); // 只从银行获得 2 CP
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(5); // 对手 CP 不变
    });

    it('有 Shadow：从对手偷取 CP（最多 2）', () => {
        let state = createTestState(['0', '1'], fixedRandom);
        
        // 给对手一些 CP
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];
        
        // 进入攻击阶段
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' });
        
        // 投骰子
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' });

        // 修改骰子结果为 2 个 Bag (value 3, 4) + 1 个 Shadow (value 6)
        state.core.dice = state.core.dice.map((die, i) => ({
            ...die,
            value: i === 0 ? 3 : (i === 1 ? 4 : (i === 2 ? 6 : (i === 3 ? 1 : 2))),
            symbol: i === 0 ? FACE.BAG : (i === 1 ? FACE.BAG : (i === 2 ? FACE.SHADOW : (i === 3 ? FACE.DAGGER : FACE.DAGGER))),
            symbols: i === 0 ? [FACE.BAG] : (i === 1 ? [FACE.BAG] : (i === 2 ? [FACE.SHADOW] : (i === 3 ? [FACE.DAGGER] : [FACE.DAGGER]))),
        }));
        
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' });
        
        // 选择偷窃技能并执行
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-2' } });
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' });

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 2); // 获得 2 CP
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(4); // 对手失去 1 CP (5-1=4, stealLimit=1)
    });

    it('有 Shadow 但对手 CP 不足：只偷取实际拥有的', () => {
        let state = createTestState(['0', '1'], fixedRandom);
        
        // 给对手只有 1 CP
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 1;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];
        
        // 进入攻击阶段
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' });
        
        // 投骰子
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' });

        // 修改骰子结果为 2 个 Bag + 1 个 Shadow
        state.core.dice = state.core.dice.map((die, i) => ({
            ...die,
            value: i === 0 ? 3 : (i === 1 ? 4 : (i === 2 ? 6 : (i === 3 ? 1 : 2))),
            symbol: i === 0 ? FACE.BAG : (i === 1 ? FACE.BAG : (i === 2 ? FACE.SHADOW : (i === 3 ? FACE.DAGGER : FACE.DAGGER))),
            symbols: i === 0 ? [FACE.BAG] : (i === 1 ? [FACE.BAG] : (i === 2 ? [FACE.SHADOW] : (i === 3 ? [FACE.DAGGER] : [FACE.DAGGER]))),
        }));
        
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' });
        
        // 选择偷窃技能并执行
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-2' } });
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' });

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 2); // 仍获得 2 CP（总是获得 amount）
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(0); // 对手失去 1 CP (1-1=0, stealLimit=1)
    });

    it('3 个 Bag：获得 3 CP', () => {
        let state = createTestState(['0', '1'], fixedRandom);
        
        // 给对手一些 CP
        state.core.players['1'].resources[RESOURCE_IDS.CP] = 5;
        const initialP0Cp = state.core.players['0'].resources[RESOURCE_IDS.CP];
        
        // 进入攻击阶段
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' });
        
        // 投骰子
        state = dispatch(state, { type: 'ROLL_DICE', playerId: '0' });

        // 修改骰子结果为 3 个 Bag + 1 个 Shadow
        state.core.dice = state.core.dice.map((die, i) => ({
            ...die,
            value: i === 0 ? 3 : (i === 1 ? 4 : (i === 2 ? 3 : (i === 3 ? 6 : 1))),
            symbol: i === 0 ? FACE.BAG : (i === 1 ? FACE.BAG : (i === 2 ? FACE.BAG : (i === 3 ? FACE.SHADOW : FACE.DAGGER))),
            symbols: i === 0 ? [FACE.BAG] : (i === 1 ? [FACE.BAG] : (i === 2 ? [FACE.BAG] : (i === 3 ? [FACE.SHADOW] : [FACE.DAGGER]))),
        }));
        
        state = dispatch(state, { type: 'CONFIRM_ROLL', playerId: '0' });
        
        // 选择偷窃技能并执行
        state = dispatch(state, { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'steal-3' } });
        state = dispatch(state, { type: 'ADVANCE_PHASE', playerId: '0' });

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(initialP0Cp + 3); // 获得 3 CP
        expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(4); // 对手失去 1 CP (5-1=4, steal-3 的 stealLimit=1)
    });
});
