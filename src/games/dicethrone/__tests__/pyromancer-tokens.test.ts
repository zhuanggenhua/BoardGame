/**
 * 炎术士 Token/状态效果 测试
 *
 * 覆盖范围：
 * 1. Token 定义完整性（fire_mastery、knockdown、burn、stun）
 * 2. 初始状态验证
 * 3. Fire Mastery activeUse 执行逻辑（processTokenUsage）
 *
 * 注意：burn onTurnStart 伤害、stun/knockdown skipPhase 的执行逻辑
 * 尚未在 game.ts onPhaseEnter 中实现，此处仅测试定义属性。
 */

import { describe, it, expect } from 'vitest';
import { PYROMANCER_TOKENS, PYROMANCER_INITIAL_TOKENS } from '../heroes/pyromancer/tokens';
import { TOKEN_IDS, STATUS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { processTokenUsage } from '../domain/tokenResponse';
import { DiceThroneDomain } from '../domain';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { diceThroneSystemsForTest } from '../game';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import type { MatchState, RandomFn } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';

const fixedRandom: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min) => min,
    shuffle: (arr) => [...arr],
};

const testSystems = diceThroneSystemsForTest as unknown as EngineSystem<DiceThroneCore>[];

// ============================================================================
// 1. Token 定义完整性
// ============================================================================

describe('炎术士 Token 定义', () => {
    it('应包含 Fire Mastery（火焰精通）— consumable，无 activeUse（自动消耗）', () => {
        const fm = PYROMANCER_TOKENS.find(t => t.id === TOKEN_IDS.FIRE_MASTERY);
        expect(fm).toBeDefined();
        expect(fm!.category).toBe('consumable');
        expect(fm!.stackLimit).toBe(5);
        // 火焰精通由 custom actions 自动消耗，不通过 Token 响应弹窗交互
        expect(fm!.activeUse).toBeUndefined();
    });

    it('应包含 Knockdown（击倒）— debuff, onPhaseEnter', () => {
        const kd = PYROMANCER_TOKENS.find(t => t.id === STATUS_IDS.KNOCKDOWN);
        expect(kd).toBeDefined();
        expect(kd!.category).toBe('debuff');
        expect(kd!.stackLimit).toBe(1);
        expect(kd!.passiveTrigger).toBeDefined();
        expect(kd!.passiveTrigger!.timing).toBe('onPhaseEnter');
        expect(kd!.passiveTrigger!.removable).toBe(true);
        expect(kd!.passiveTrigger!.removalCost).toEqual({ resource: RESOURCE_IDS.CP, amount: 2 });
    });

    it('应包含 Burn（燃烧）— debuff, onTurnStart, stackLimit=1（不可叠加，持续效果）', () => {
        const burn = PYROMANCER_TOKENS.find(t => t.id === STATUS_IDS.BURN);
        expect(burn).toBeDefined();
        expect(burn!.category).toBe('debuff');
        expect(burn!.stackLimit).toBe(1);
        expect(burn!.passiveTrigger).toBeDefined();
        expect(burn!.passiveTrigger!.timing).toBe('onTurnStart');
        expect(burn!.passiveTrigger!.removable).toBe(true);
        expect(burn!.passiveTrigger!.actions).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'damage', target: 'self', value: 2 })])
        );
    });

    it('应包含 Stun（眩晕）— debuff, onPhaseEnter', () => {
        const stun = PYROMANCER_TOKENS.find(t => t.id === STATUS_IDS.STUN);
        expect(stun).toBeDefined();
        expect(stun!.category).toBe('debuff');
        expect(stun!.stackLimit).toBe(1);
        expect(stun!.passiveTrigger).toBeDefined();
        expect(stun!.passiveTrigger!.timing).toBe('onPhaseEnter');
        expect(stun!.passiveTrigger!.removable).toBe(true);
    });

    it('Token 数量应为 4', () => {
        expect(PYROMANCER_TOKENS).toHaveLength(4);
    });
});

// ============================================================================
// 2. 初始状态验证
// ============================================================================

describe('炎术士初始 Token 状态', () => {
    it('所有状态初始值为 0', () => {
        expect(PYROMANCER_INITIAL_TOKENS[TOKEN_IDS.FIRE_MASTERY]).toBe(0);
        expect(PYROMANCER_INITIAL_TOKENS[STATUS_IDS.KNOCKDOWN]).toBe(0);
        expect(PYROMANCER_INITIAL_TOKENS[STATUS_IDS.BURN]).toBe(0);
        expect(PYROMANCER_INITIAL_TOKENS[STATUS_IDS.STUN]).toBe(0);
    });

    it('初始状态键数量与 Token 定义一致', () => {
        expect(Object.keys(PYROMANCER_INITIAL_TOKENS)).toHaveLength(PYROMANCER_TOKENS.length);
    });
});


// ============================================================================
// 3. Fire Mastery activeUse 执行逻辑（processTokenUsage）
// ============================================================================

/** 创建炎术士 vs 炎术士的初始化状态 */
function createPyromancerState(playerIds: string[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, testSystems, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
    const setupCmds = [
        { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'pyromancer' } },
        { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'pyromancer' } },
        { type: 'PLAYER_READY', playerId: '1', payload: {} },
        { type: 'HOST_START_GAME', playerId: '0', payload: {} },
    ];
    for (const c of setupCmds) {
        const command = { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }
    return state;
}

describe('炎术士 Fire Mastery 执行逻辑', () => {
    it('Fire Mastery 无 activeUse，processTokenUsage 应返回失败', () => {
        // 火焰精通不通过 Token 响应弹窗交互，processTokenUsage 应返回 success=false
        const state = createPyromancerState(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.FIRE_MASTERY] = 3;

        const fmDef = PYROMANCER_TOKENS.find(t => t.id === TOKEN_IDS.FIRE_MASTERY)!;
        const { result, events } = processTokenUsage(
            state.core, fmDef, '0', 1, fixedRandom, 'beforeDamageDealt'
        );

        // 无 activeUse.effect → 处理器找不到 → 返回失败
        expect(result.success).toBe(false);
        expect(events).toHaveLength(0);
    });

    it('持有量为 0 时使用失败', () => {
        const state = createPyromancerState(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.FIRE_MASTERY] = 0;

        const fmDef = PYROMANCER_TOKENS.find(t => t.id === TOKEN_IDS.FIRE_MASTERY)!;
        const { result, events } = processTokenUsage(
            state.core, fmDef, '0', 1, fixedRandom, 'beforeDamageDealt'
        );

        expect(result.success).toBe(false);
        expect(events).toHaveLength(0);
    });
});
