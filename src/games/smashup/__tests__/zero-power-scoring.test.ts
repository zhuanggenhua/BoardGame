/**
 * 战力为0但有随从的玩家应该参与计分
 * 
 * Bug 复现：
 * - 玩家在基地有随从，但战力为0（被 debuff 或基础力量为0）
 * - 旧代码：`.filter(([, p]) => p > 0)` 排除了该玩家，不参与计分
 * - 规则：只要有至少1个随从或至少1点力量，就有资格参与计分
 * 
 * 修复：改为 `.filter(([pid, p]) => p > 0 || playerHasMinions.get(pid))`
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';

const PLAYER_IDS = ['0', '1', '2'] as const;
const systems = smashUpSystemsForTest;

function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: {
            '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['wizards', 'zombies'] as [string, string], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
            '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
            '2': { id: '2', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['robots', 'aliens'] as [string, string], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
        },
        turnOrder: ['0', '1', '2'],
        currentPlayerIndex: 0,
        bases: [
            { defId: 'base_great_library', minions: [], ongoingActions: [] },
        ],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        turnDestroyedMinions: [],
        ...overrides,
    };
}

describe('战力为0但有随从的玩家应该参与计分', () => {
    it('战力为0的玩家有随从，应该参与计分并获得对应名次的 VP', () => {
        // 场景：基地临界点 22
        // P0: 1个随从，战力 12
        // P1: 1个随从，战力 0（被 debuff 或基础力量为0）
        // P2: 1个随从，战力 10
        // 总战力 22，达到临界点
        // 预期排名：P0(12分) > P2(10分) > P1(0分)
        // 基地 VP: [4, 2, 1]
        // 预期得分：P0=4, P2=2, P1=1
        const core = makeState({
            bases: [
                {
                    defId: 'base_great_library', // breakpoint=22, vpAwards=[4,2,1]
                    minions: [
                        { uid: 'c1', defId: 'wizard_archmage', controller: '0', owner: '0', basePower: 5, powerCounters: 7, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 5+7=12
                        { uid: 'c2', defId: 'pirate_buccaneer', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: -3, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 3-3=0
                        { uid: 'c3', defId: 'robot_microbot', controller: '2', owner: '2', basePower: 2, powerCounters: 8, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 2+8=10
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => ({ core, sys: { ...createInitialSystemState(PLAYER_IDS, systems), phase: 'playCards' } }),
        });

        // 推进到 scoreBases 阶段
        const result = runner.run({
            name: '战力为0但有随从参与计分',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        expect(result.steps[0]?.success).toBe(true);

        // 验证 VP 分配
        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].vp).toBe(4); // 第1名
        expect(finalCore.players['2'].vp).toBe(2); // 第2名
        expect(finalCore.players['1'].vp).toBe(1); // 第3名（战力为0但有随从）

        // 验证 BASE_SCORED 事件已发出
        expect(result.steps[0]?.events).toContain('su:base_scored');
    });

    it('只有 ongoing 卡力量贡献（无随从）的玩家应该参与计分', () => {
        // 场景：P0 有随从，P1 无随从但有 ongoing 卡力量贡献
        // 预期：P1 应该参与计分
        const core = makeState({
            bases: [
                {
                    defId: 'base_great_library', // breakpoint=22, vpAwards=[4,2,1]
                    minions: [
                        { uid: 'c1', defId: 'wizard_archmage', controller: '0', owner: '0', basePower: 5, powerCounters: 17, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 5+17=22
                    ],
                    ongoingActions: [
                        { uid: 'c2', defId: 'vampire_summon_wolves', ownerId: '1', talentUsed: false, metadata: { powerCounters: 5 } },
                    ],
                },
            ],
        });

        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => ({ core, sys: { ...createInitialSystemState(PLAYER_IDS, systems), phase: 'playCards' } }),
        });

        const result = runner.run({
            name: 'ongoing 卡力量贡献参与计分',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        expect(result.steps[0]?.success).toBe(true);

        // 验证 VP 分配
        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].vp).toBe(4); // 第1名（22分）
        expect(finalCore.players['1'].vp).toBe(2); // 第2名（5分，无随从但有 ongoing 卡）

        // 验证 BASE_SCORED 事件已发出
        expect(result.steps[0]?.events).toContain('su:base_scored');
    });

    it('无随从且无力量的玩家不应该参与计分', () => {
        // 场景：P0 有随从，P1 和 P2 无随从且无力量
        // 预期：只有 P0 参与计分
        const core = makeState({
            bases: [
                {
                    defId: 'base_great_library', // breakpoint=22, vpAwards=[4,2,1]
                    minions: [
                        { uid: 'c1', defId: 'wizard_archmage', controller: '0', owner: '0', basePower: 5, powerCounters: 17, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 5+17=22
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => ({ core, sys: { ...createInitialSystemState(PLAYER_IDS, systems), phase: 'playCards' } }),
        });

        const result = runner.run({
            name: '无随从且无力量不参与计分',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        expect(result.steps[0]?.success).toBe(true);

        // 验证 VP 分配
        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].vp).toBe(4); // 第1名
        expect(finalCore.players['1'].vp).toBe(0); // 未参与计分
        expect(finalCore.players['2'].vp).toBe(0); // 未参与计分

        // 验证 BASE_SCORED 事件已发出
        expect(result.steps[0]?.events).toContain('su:base_scored');
    });
});
