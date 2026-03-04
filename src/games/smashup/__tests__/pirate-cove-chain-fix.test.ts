/**
 * 海盗湾计分链路修复测试
 * 
 * 验证：
 * 1. Me First! 窗口打开时，ADVANCE_PHASE 命令应该被阻止
 * 2. 所有玩家 pass 后，窗口关闭，自动执行计分
 * 3. 海盗湾 afterScoring 交互正确创建
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../types';
import { smashUpSystemsForTest } from '../game';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';

beforeAll(() => {
    // 系统已在 game.ts 中初始化
});

const systems = smashUpSystemsForTest;

function makeTestCore(): MatchState<SmashUpCore> {
    const core: SmashUpCore = {
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['dinosaurs', 'aliens'],
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['pirates', 'steampunks'],
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_pirate_cove',
                minions: [
                    {
                        uid: 'm1',
                        defId: 'dino_war_raptor',
                        controller: '0',
                        owner: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'm2',
                        defId: 'dino_king_rex',
                        controller: '0',
                        owner: '0',
                        basePower: 7,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'm3',
                        defId: 'pirate_king',
                        controller: '1',
                        owner: '1',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'm4',
                        defId: 'pirate_first_mate',
                        controller: '1',
                        owner: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_tortuga',
                minions: [],
                ongoingActions: [],
            },
            {
                defId: 'base_the_jungle',
                minions: [],
                ongoingActions: [],
            },
        ],
        baseDeck: ['base_inventors_salon'],
        turnNumber: 1,
        nextUid: 100,
        turnDestroyedMinions: [],
    };

    return {
        core,
        sys: {
            ...createInitialSystemState(systems, ['0', '1']),
            phase: 'playCards',
        },
    };
}

describe('海盗湾计分链路', () => {
    it('Me First! 窗口打开时，ADVANCE_PHASE 应该被阻止', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: ['0', '1'],
            setup: () => {
                const state = makeTestCore();
                // 给 P1 一张特殊行动卡（全速航行），让 Me First! 窗口保持打开
                state.core.players['1'].hand.push({
                    uid: 'special1',
                    defId: 'pirate_full_sail',
                    type: 'action',
                    owner: '1',
                });
                return state;
            },
        });

        const result = runner.run({
            name: '推进到 scoreBases，尝试再次 ADVANCE_PHASE',
            commands: [
                // P0 推进阶段：playCards → scoreBases（打开 Me First! 窗口）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 尝试再次推进（应该被阻止）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 验证：仍然停在 scoreBases，Me First! 窗口仍然打开
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.sys.responseWindow?.current).toBeDefined();
        expect(result.finalState.sys.responseWindow?.current?.windowType).toBe('meFirst');
        
        // 验证：第二个 ADVANCE_PHASE 命令被阻止，没有产生新事件
        const steps = result.steps;
        expect(steps).toHaveLength(2); // 只有第一个 ADVANCE_PHASE 成功
    });

    it('所有玩家都没有特殊牌时，Me First! 窗口应该自动关闭', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: ['0', '1'],
            setup: () => makeTestCore(),
        });

        const result = runner.run({
            name: '推进到 scoreBases（无特殊牌）',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 验证：Me First! 窗口应该自动关闭（因为没有人有特殊牌）
        expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
        
        // 验证：应该停在 scoreBases，海盗湾交互已创建
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.sys.interaction?.current).toBeDefined();
        expect(result.finalState.sys.interaction?.current?.playerId).toBe('1');
        expect(result.finalState.sys.interaction?.current?.data?.sourceId).toBe('base_pirate_cove');
    });

    it('所有玩家 pass 后，应该创建海盗湾交互', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: ['0', '1'],
            setup: () => makeTestCore(),
        });

        const result = runner.run({
            name: '完整流程：推进 → pass → 计分 → 交互',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                { type: 'RESPONSE_PASS', playerId: '0', payload: undefined },
                { type: 'RESPONSE_PASS', playerId: '1', payload: undefined },
            ] as any[],
        });

        // 验证：停在 scoreBases，海盗湾交互已创建
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.sys.responseWindow?.current).toBeUndefined(); // 窗口已关闭
        expect(result.finalState.sys.interaction?.current).toBeDefined();
        expect(result.finalState.sys.interaction?.current?.playerId).toBe('1'); // P1 是亚军
        expect(result.finalState.sys.interaction?.current?.data?.sourceId).toBe('base_pirate_cove');
    });
});
