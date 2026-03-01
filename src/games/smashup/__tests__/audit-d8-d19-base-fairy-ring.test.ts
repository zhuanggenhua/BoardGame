/**
 * base_fairy_ring（仙灵圈）D8 & D19 全维度审计
 * 
 * 审计维度：
 * - D8 子项：写入-消费窗口对齐审计
 * - D19：组合场景审计
 * 
 * 权威描述来源：src/games/smashup/data/cards.ts
 * - 基地能力：在一个玩家首次打出一个随从到这后，该玩家可以额外打出一个随从和一张行动卡牌
 * 
 * 核心审计点：
 * 1. 额度授予时机是否在 playCards 阶段可消费
 * 2. 与其他基地能力（如 base_homeworld）组合时额度互不干扰
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/commands';
import { SU_EVENTS } from '../domain/events';
import { initAllAbilities } from '../abilities';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
        ],
        playerIds: PLAYER_IDS,
        silent: true,
    });
}

describe('base_fairy_ring D8 & D19 审计', () => {
    describe('D8 子项：写入-消费窗口对齐', () => {
        it('首次打出随从后立即可使用额外额度', () => {
            const runner = createRunner();
            
            // 初始化：玩家0有2张随从手牌，基地是仙灵圈
            runner.patchState({
                core: {
                    players: {
                        '0': {
                            id: '0',
                            vp: 0,
                            hand: [
                                { uid: 'c1', defId: 'alien_invader', type: 'minion', owner: '0' },
                                { uid: 'c2', defId: 'alien_invader', type: 'minion', owner: '0' },
                            ],
                            deck: [],
                            discard: [],
                            minionLimit: 1,
                            minionsPlayed: 0,
                            actionLimit: 1,
                            actionsPlayed: 0,
                            factions: ['aliens', 'pirates'] as [string, string],
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
                            factions: ['ninjas', 'robots'] as [string, string],
                        },
                    },
                    bases: [
                        {
                            defId: 'base_fairy_ring',
                            breakpoint: 26,
                            vp: [4, 3, 2],
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                    currentPlayer: '0',
                },
                sys: {
                    phase: 'playCards',
                },
            });

            // 步骤1：打出第一张随从到仙灵圈
            const result1 = runner.runCommand({
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c1',
                baseIndex: 0,
            });

            expect(result1.success).toBe(true);
            const state1 = runner.getState();

            // 验证：首次打出触发，授予额外额度
            const player1 = state1.core.players['0'];
            expect(player1.minionsPlayed).toBe(1);
            expect(player1.minionLimit).toBe(1);
            
            // 关键断言：baseLimitedMinionQuota 被写入（基地限定额度）
            expect(player1.baseLimitedMinionQuota?.[0]).toBe(1);
            
            // 关键断言：actionLimit 增加（额外行动额度）
            expect(player1.actionLimit).toBe(2);

            // 步骤2：立即使用额外随从额度打出第二张随从
            const result2 = runner.runCommand({
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c2',
                baseIndex: 0,
            });

            expect(result2.success).toBe(true);
            const state2 = runner.getState();

            // 验证：额外额度被正确消耗
            const player2 = state2.core.players['0'];
            expect(player2.minionsPlayed).toBe(1); // 全局计数不变（基地限定额度不增加全局计数）
            expect(player2.baseLimitedMinionQuota?.[0]).toBe(0); // 基地限定额度消耗

            // 验证：两张随从都在场上
            expect(state2.core.bases[0].minions.length).toBe(2);
        });

        it('第二次打出随从不触发额度授予', () => {
            const runner = new GameTestRunner(createSmashUpGame());
            
            // 初始化：玩家0已经打出过1个随从（minionsPlayedPerBase[0] = 1）
            const initialState = runner.getInitialState({
                players: {
                    '0': {
                        hand: [
                            { uid: 'c2', defId: 'alien_invader', type: 'minion', owner: '0' },
                        ],
                        deck: [],
                        discard: [],
                        minionLimit: 2,
                        minionsPlayed: 1,
                        minionsPlayedPerBase: { 0: 1 }, // 已经打出过1个到基地0
                        actionLimit: 1,
                        actionsPlayed: 0,
                    },
                    '1': {
                        hand: [],
                        deck: [],
                        discard: [],
                    },
                },
                bases: [
                    {
                        defId: 'base_fairy_ring',
                        minions: [
                            { uid: 'm1', defId: 'alien_invader', controller: '0', power: 2 },
                        ],
                        ongoingActions: [],
                    },
                ],
                currentPlayer: '0',
                phase: 'playCards',
            });

            // 打出第二张随从
            const result = runner.runCommand(initialState, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c2',
                baseIndex: 0,
            });

            expect(result.success).toBe(true);
            const state = result.state!;

            // 验证：第二次打出不触发额度授予
            const player = state.core.players['0'];
            expect(player.minionsPlayed).toBe(2);
            expect(player.baseLimitedMinionQuota?.[0]).toBeUndefined(); // 无额外额度
            expect(player.actionLimit).toBe(1); // 行动额度不变
        });

        it('额度授予后在回合结束时正确清理', () => {
            const runner = new GameTestRunner(createSmashUpGame());
            
            // 初始化：玩家0刚触发仙灵圈能力
            const initialState = runner.getInitialState({
                players: {
                    '0': {
                        hand: [],
                        deck: [],
                        discard: [],
                        minionLimit: 1,
                        minionsPlayed: 1,
                        baseLimitedMinionQuota: { 0: 1 }, // 仙灵圈授予的额度
                        actionLimit: 2, // 仙灵圈授予的额外行动
                        actionsPlayed: 0,
                    },
                    '1': {
                        hand: [],
                        deck: [],
                        discard: [],
                    },
                },
                bases: [
                    {
                        defId: 'base_fairy_ring',
                        minions: [
                            { uid: 'm1', defId: 'alien_invader', controller: '0', power: 2 },
                        ],
                        ongoingActions: [],
                    },
                ],
                currentPlayer: '0',
                phase: 'playCards',
            });

            // 结束回合
            const result = runner.runCommand(initialState, {
                type: SU_COMMANDS.END_TURN,
                playerId: '0',
            });

            expect(result.success).toBe(true);
            const state = result.state!;

            // 验证：回合结束时临时额度被清理
            const player = state.core.players['0'];
            expect(player.baseLimitedMinionQuota).toBeUndefined();
            expect(player.actionLimit).toBe(1); // 恢复默认值
            expect(player.minionsPlayed).toBe(0); // 计数器重置
        });
    });

    describe('D19：组合场景审计', () => {
        it('仙灵圈（基地限定额度）与全局额度独立计算', () => {
            const runner = new GameTestRunner(createSmashUpGame());
            
            // 初始化：玩家0有3张随从手牌，minionLimit=2（全局额度）
            const initialState = runner.getInitialState({
                players: {
                    '0': {
                        hand: [
                            { uid: 'c1', defId: 'alien_invader', type: 'minion', owner: '0' },
                            { uid: 'c2', defId: 'alien_invader', type: 'minion', owner: '0' },
                            { uid: 'c3', defId: 'alien_invader', type: 'minion', owner: '0' },
                        ],
                        deck: [],
                        discard: [],
                        minionLimit: 2, // 全局额度=2
                        minionsPlayed: 0,
                        actionLimit: 1,
                        actionsPlayed: 0,
                    },
                    '1': {
                        hand: [],
                        deck: [],
                        discard: [],
                    },
                },
                bases: [
                    {
                        defId: 'base_fairy_ring',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                currentPlayer: '0',
                phase: 'playCards',
            });

            // 步骤1：打出第一张随从（消耗全局额度1，触发仙灵圈）
            const result1 = runner.runCommand(initialState, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c1',
                baseIndex: 0,
            });

            expect(result1.success).toBe(true);
            const state1 = result1.state!;
            const player1 = state1.core.players['0'];
            
            expect(player1.minionsPlayed).toBe(1); // 全局计数+1
            expect(player1.minionLimit).toBe(2); // 全局额度不变
            expect(player1.baseLimitedMinionQuota?.[0]).toBe(1); // 基地限定额度+1

            // 步骤2：打出第二张随从（消耗全局额度2）
            const result2 = runner.runCommand(state1, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c2',
                baseIndex: 0,
            });

            expect(result2.success).toBe(true);
            const state2 = result2.state!;
            const player2 = state2.core.players['0'];
            
            expect(player2.minionsPlayed).toBe(2); // 全局计数+1
            expect(player2.baseLimitedMinionQuota?.[0]).toBe(1); // 基地限定额度不变

            // 步骤3：打出第三张随从（消耗基地限定额度）
            const result3 = runner.runCommand(state2, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c3',
                baseIndex: 0,
            });

            expect(result3.success).toBe(true);
            const state3 = result3.state!;
            const player3 = state3.core.players['0'];
            
            // 关键断言：基地限定额度消耗，全局计数不变
            expect(player3.minionsPlayed).toBe(2); // 全局计数不变
            expect(player3.baseLimitedMinionQuota?.[0]).toBe(0); // 基地限定额度消耗

            // 验证：三张随从都在场上
            expect(state3.core.bases[0].minions.length).toBe(3);
        });

        it('仙灵圈（基地0限定）不影响其他基地的打出', () => {
            const runner = new GameTestRunner(createSmashUpGame());
            
            // 初始化：玩家0有2张随从手牌，2个基地
            const initialState = runner.getInitialState({
                players: {
                    '0': {
                        hand: [
                            { uid: 'c1', defId: 'alien_invader', type: 'minion', owner: '0' },
                            { uid: 'c2', defId: 'alien_invader', type: 'minion', owner: '0' },
                        ],
                        deck: [],
                        discard: [],
                        minionLimit: 1,
                        minionsPlayed: 0,
                        actionLimit: 1,
                        actionsPlayed: 0,
                    },
                    '1': {
                        hand: [],
                        deck: [],
                        discard: [],
                    },
                },
                bases: [
                    {
                        defId: 'base_fairy_ring',
                        minions: [],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_the_homeworld',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                currentPlayer: '0',
                phase: 'playCards',
            });

            // 步骤1：打出第一张随从到仙灵圈（基地0）
            const result1 = runner.runCommand(initialState, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c1',
                baseIndex: 0,
            });

            expect(result1.success).toBe(true);
            const state1 = result1.state!;
            const player1 = state1.core.players['0'];
            
            expect(player1.minionsPlayed).toBe(1);
            expect(player1.baseLimitedMinionQuota?.[0]).toBe(1); // 基地0有额度

            // 步骤2：尝试打出第二张随从到基地1（全局额度已满，基地1无额度）
            const result2 = runner.runCommand(state1, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c2',
                baseIndex: 1,
            });

            // 验证：打出失败（全局额度已满，基地1无限定额度）
            expect(result2.success).toBe(false);
            
            // 验证：基地0的限定额度不受影响
            const player2 = state1.core.players['0'];
            expect(player2.baseLimitedMinionQuota?.[0]).toBe(1);
        });

        it('仙灵圈额度与同名额度独立计算', () => {
            const runner = new GameTestRunner(createSmashUpGame());
            
            // 初始化：玩家0有同名额度（sameNameMinionRemaining=1）和仙灵圈额度
            const initialState = runner.getInitialState({
                players: {
                    '0': {
                        hand: [
                            { uid: 'c1', defId: 'alien_invader', type: 'minion', owner: '0' },
                            { uid: 'c2', defId: 'alien_invader', type: 'minion', owner: '0' },
                        ],
                        deck: [],
                        discard: [],
                        minionLimit: 1,
                        minionsPlayed: 1, // 全局额度已满
                        sameNameMinionRemaining: 1, // 同名额度
                        sameNameMinionDefId: 'alien_invader',
                        baseLimitedMinionQuota: { 0: 1 }, // 仙灵圈额度
                        actionLimit: 1,
                        actionsPlayed: 0,
                    },
                    '1': {
                        hand: [],
                        deck: [],
                        discard: [],
                    },
                },
                bases: [
                    {
                        defId: 'base_fairy_ring',
                        minions: [
                            { uid: 'm1', defId: 'alien_invader', controller: '0', power: 2 },
                        ],
                        ongoingActions: [],
                    },
                ],
                currentPlayer: '0',
                phase: 'playCards',
            });

            // 步骤1：打出同名随从（消耗同名额度）
            const result1 = runner.runCommand(initialState, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c1',
                baseIndex: 0,
            });

            expect(result1.success).toBe(true);
            const state1 = result1.state!;
            const player1 = state1.core.players['0'];
            
            // 验证：同名额度消耗，仙灵圈额度不变
            expect(player1.sameNameMinionRemaining).toBe(0);
            expect(player1.baseLimitedMinionQuota?.[0]).toBe(1); // 不变
            expect(player1.minionsPlayed).toBe(1); // 全局计数不变

            // 步骤2：打出第二张同名随从（消耗仙灵圈额度）
            const result2 = runner.runCommand(state1, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                cardUid: 'c2',
                baseIndex: 0,
            });

            expect(result2.success).toBe(true);
            const state2 = result2.state!;
            const player2 = state2.core.players['0'];
            
            // 验证：仙灵圈额度消耗，同名额度已清零
            expect(player2.baseLimitedMinionQuota?.[0]).toBe(0);
            expect(player2.sameNameMinionRemaining).toBe(0);
            expect(player2.minionsPlayed).toBe(1); // 全局计数不变
        });
    });
});
