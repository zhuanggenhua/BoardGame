/**
 * 审计报告：dino_armor_stego_pod（装甲剑龙 POD版 Talent）
 * 
 * 审计维度：
 * - D8：时序正确性审计 — 验证"在其他玩家的回合中+2力量"的持续修正是否正确判断当前回合玩家
 * 
 * 能力描述（Wiki）：
 * "Ongoing: Has +2 power during other players' turns."
 * 
 * 中文描述：
 * "持续：在其他玩家的回合拥有+2力量"
 * 
 * POD版实现：
 * - Talent 执行体为空操作（引擎层自动设置 talentUsed=true）
 * - +2 力量加成由 ongoingModifiers 系统中的 dino_armor_stego modifier 根据 talentUsed 判断
 * - 判断逻辑：`ctx.state.turnOrder[ctx.state.currentPlayerIndex] !== ctx.minion.controller`
 * 
 * 审计结果：✅ 通过
 * 
 * D8 审计：
 * - ✅ 回合判断正确：使用 `currentPlayerIndex` 获取当前回合玩家，与随从控制者比较
 * - ✅ 不使用 `ctx.playerId`：避免了 afterScoring 回调中的常见错误（ctx.playerId 是触发玩家而非当前回合玩家）
 * - ✅ 持续效果正确：通过 ongoingModifiers 系统实现，每次力量查询时动态计算
 * - ✅ Talent 标记正确：talentUsed 在回合开始时重置，匹配"直到你下个回合开始"的持续时间
 * 
 * 测试策略：
 * 1. 己方回合 — 无力量加成
 * 2. 对手回合 — +2 力量加成
 * 3. Talent 未使用 — 无力量加成（即使在对手回合）
 * 4. 多个剑龙 — 各自独立计算
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { SmashUpCore } from '../domain/types';
import { getMinionPower } from '../domain/abilityHelpers';

describe('Audit D8: dino_armor_stego_pod（装甲剑龙 POD版）', () => {
    it('D8: 回合判断 — 己方回合无力量加成', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'dino_armor_stego_pod', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0, talentUsed: true },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0, // 玩家0的回合
        });

        const state = runner.getState();
        const minion = state.bases[0].minions[0];
        const effectivePower = getMinionPower(state, minion, 0);
        
        // 验证己方回合无力量加成（基础力量3）
        expect(effectivePower).toBe(3);
    });

    it('D8: 回合判断 — 对手回合+2力量加成', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'dino_armor_stego_pod', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0, talentUsed: true },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1, // 玩家1的回合（对手回合）
        });

        const state = runner.getState();
        const minion = state.bases[0].minions[0];
        const effectivePower = getMinionPower(state, minion, 0);
        
        // 验证对手回合+2力量加成（基础力量3 + 2 = 5）
        expect(effectivePower).toBe(5);
    });

    it('D8: Talent 标记 — 未使用 Talent 时无力量加成', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'dino_armor_stego_pod', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0, talentUsed: false }, // 未使用 Talent
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1, // 玩家1的回合（对手回合）
        });

        const state = runner.getState();
        const minion = state.bases[0].minions[0];
        const effectivePower = getMinionPower(state, minion, 0);
        
        // 验证未使用 Talent 时无力量加成（即使在对手回合）
        expect(effectivePower).toBe(3);
    });

    it('D8: 多个剑龙 — 各自独立计算', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'dino_armor_stego_pod', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0, talentUsed: true },
                        { uid: 'm2', defId: 'dino_armor_stego_pod', controller: '1', owner: '1', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0, talentUsed: true },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0, // 玩家0的回合
        });

        const state = runner.getState();
        const minion0 = state.bases[0].minions.find(m => m.uid === 'm1')!;
        const minion1 = state.bases[0].minions.find(m => m.uid === 'm2')!;
        const power0 = getMinionPower(state, minion0, 0);
        const power1 = getMinionPower(state, minion1, 0);
        
        // 验证各自独立计算
        // m1 是玩家0的随从，在己方回合，无加成：3
        // m2 是玩家1的随从，在对手回合，+2加成：5
        expect(power0).toBe(3);
        expect(power1).toBe(5);
    });

    it('D8: 原版 dino_armor_stego — 永久被动无需 Talent', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { uid: 'm1', defId: 'dino_armor_stego', controller: '0', owner: '0', power: 3, attachedActions: [], powerCounters: 0, tempPower: 0 }, // 原版无 talentUsed 字段
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1, // 玩家1的回合（对手回合）
        });

        const state = runner.getState();
        const minion = state.bases[0].minions[0];
        const effectivePower = getMinionPower(state, minion, 0);
        
        // 验证原版在对手回合+2力量加成（无需 Talent）
        expect(effectivePower).toBe(5);
    });
});
