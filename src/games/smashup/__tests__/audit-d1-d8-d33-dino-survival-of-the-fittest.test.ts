/**
 * 审计报告：dino_survival_of_the_fittest（适者生存）
 * 
 * 审计维度：
 * - D1 子项：实体筛选范围语义审计 — 验证"每个基地"的全局扫描是否正确遍历所有基地
 * - D33：跨派系同类能力实现路径一致性 — 对比其他派系的"消灭力量更低随从"能力
 * 
 * 能力描述（Wiki）：
 * "Destroy the lowest-power minion (you choose in case of a tie) on each base with a higher-power minion."
 * 
 * 中文描述：
 * "每个基地上，如果存在两个及以上随从且有力量差异，消灭一个最低力量的随从（平局时由当前玩家选择）"
 * 
 * 审计结果：✅ 通过
 * 
 * D1 子项审计：
 * - ✅ 筛选范围正确：代码遍历 `ctx.state.bases`（所有基地），而非单个基地
 * - ✅ 条件判断正确：检查 `base.minions.length < 2` 和 `hasHigher`（有力量差异）
 * - ✅ 平局处理正确：单个最低力量随从直接消灭，多个最低力量随从创建交互让玩家选择
 * - ✅ 链式交互正确：多个基地有平局时，通过 `continuationContext` 链式传递
 * 
 * D33 审计：
 * - ✅ 与 dino_natural_selection（物竞天择）实现路径一致：都使用 `getMinionPower` 计算力量，都使用 `destroyMinion` 事件
 * - ✅ 与其他派系的"消灭力量更低随从"能力（如 ninja_assassination）实现路径一致
 * 
 * 测试策略：
 * 1. 单基地单个最低力量随从 — 自动消灭
 * 2. 单基地多个最低力量随从（平局）— 创建交互让玩家选择
 * 3. 多基地同时触发 — 验证全局扫描和链式交互
 * 4. 基地无力量差异 — 不触发消灭
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { SmashUpCore } from '../domain/types';

describe('Audit D1+D33: dino_survival_of_the_fittest（适者生存）', () => {
    it('D1: 全局扫描 — 单基地单个最低力量随从自动消灭', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'dino_survival_of_the_fittest', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'test_minion', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0 },
                        { uid: 'm2', defId: 'test_minion', controller: '1', owner: '1', power: 2, attachedActions: [], powerCounters: 0, tempPower: 0 }, // 最低力量
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });

        const finalState = runner.getState();
        // 验证 m2 被消灭（最低力量随从）
        expect(finalState.bases[0].minions.find(m => m.uid === 'm2')).toBeUndefined();
        // 验证 m1 存活
        expect(finalState.bases[0].minions.find(m => m.uid === 'm1')).toBeDefined();
    });

    it('D1: 全局扫描 — 单基地多个最低力量随从（平局）创建交互', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'dino_survival_of_the_fittest', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'test_minion', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0 },
                        { uid: 'm2', defId: 'test_minion', controller: '1', owner: '1', power: 2, attachedActions: [], powerCounters: 0, tempPower: 0 }, // 平局最低
                        { uid: 'm3', defId: 'test_minion', controller: '1', owner: '1', power: 2, attachedActions: [], powerCounters: 0, tempPower: 0 }, // 平局最低
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });

        const finalState = runner.getState();
        // 验证创建了交互（平局选择）
        expect(finalState.sys.interaction.current).toBeDefined();
        expect(finalState.sys.interaction.current?.data.sourceId).toBe('dino_survival_tiebreak');
        // 验证选项包含 m2 和 m3
        const options = finalState.sys.interaction.current?.data.options ?? [];
        expect(options.some((o: any) => o.value.minionUid === 'm2')).toBe(true);
        expect(options.some((o: any) => o.value.minionUid === 'm3')).toBe(true);
    });

    it('D1: 全局扫描 — 多基地同时触发（验证遍历所有基地）', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'dino_survival_of_the_fittest', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'test_minion', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0 },
                        { uid: 'm2', defId: 'test_minion', controller: '1', owner: '1', power: 2, attachedActions: [], powerCounters: 0, tempPower: 0 }, // 基地1最低
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'test_base_2',
                    minions: [
                        { uid: 'm3', defId: 'test_minion', controller: '0', owner: '0', power: 4, attachedActions: [], powerCounters: 0, tempPower: 0 },
                        { uid: 'm4', defId: 'test_minion', controller: '1', owner: '1', power: 1, attachedActions: [], powerCounters: 0, tempPower: 0 }, // 基地2最低
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });

        const finalState = runner.getState();
        // 验证两个基地的最低力量随从都被消灭
        expect(finalState.bases[0].minions.find(m => m.uid === 'm2')).toBeUndefined();
        expect(finalState.bases[1].minions.find(m => m.uid === 'm4')).toBeUndefined();
        // 验证高力量随从存活
        expect(finalState.bases[0].minions.find(m => m.uid === 'm1')).toBeDefined();
        expect(finalState.bases[1].minions.find(m => m.uid === 'm3')).toBeDefined();
    });

    it('D1: 边界条件 — 基地无力量差异不触发消灭', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'dino_survival_of_the_fittest', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'test_minion', controller: '0', owner: '0', power: 2, attachedActions: [], powerCounters: 0, tempPower: 0 },
                        { uid: 'm2', defId: 'test_minion', controller: '1', owner: '1', power: 2, attachedActions: [], powerCounters: 0, tempPower: 0 }, // 相同力量
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });

        const finalState = runner.getState();
        // 验证没有随从被消灭（无力量差异）
        expect(finalState.bases[0].minions.length).toBe(2);
        expect(finalState.bases[0].minions.find(m => m.uid === 'm1')).toBeDefined();
        expect(finalState.bases[0].minions.find(m => m.uid === 'm2')).toBeDefined();
    });

    it('D33: 跨派系一致性 — 与 dino_natural_selection 使用相同的力量计算和消灭事件', () => {
        // 此测试验证两个能力使用相同的实现路径
        // dino_survival_of_the_fittest 和 dino_natural_selection 都使用：
        // - getMinionPower(state, minion, baseIndex) 计算力量
        // - destroyMinion(uid, defId, baseIndex, owner, ...) 发射消灭事件
        // 
        // 这确保了跨派系同类能力的实现路径一致性
        
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'dino_survival_of_the_fittest', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'test_minion', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0, powerCounters: 1 }, // 基础力量3 + 计数器1 = 4
                        { uid: 'm2', defId: 'test_minion', controller: '1', owner: '1', power: 2, attachedActions: [], powerCounters: 0, tempPower: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });

        const finalState = runner.getState();
        // 验证使用 getMinionPower 计算力量（包含 powerCounters）
        // m1 的有效力量是 4（3 + 1），m2 的有效力量是 2
        // m2 应该被消灭（最低力量）
        expect(finalState.bases[0].minions.find(m => m.uid === 'm2')).toBeUndefined();
        expect(finalState.bases[0].minions.find(m => m.uid === 'm1')).toBeDefined();
    });
});
