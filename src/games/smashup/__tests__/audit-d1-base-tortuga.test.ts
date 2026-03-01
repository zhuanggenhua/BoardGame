/**
 * D1 审计：base_tortuga（托尔图加）范围限定验证
 * 
 * 验证点：
 * 1. 只有亚军玩家可以移动随从
 * 2. 只能移动其他基地上的随从（非托尔图加本身）
 * 3. 目标基地是替换进来的新基地
 * 4. 不存在 D8 时序问题（afterScoring 不误用 ctx.playerId）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makeMinion, triggerBaseAbilityWithMS, getInteractionsFromResult } from './helpers';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import type { BaseInPlay, MinionOnBase } from '../domain/types';

// ============================================================================
// 初始化
// ============================================================================

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeBase(defId: string, overrides?: Partial<BaseInPlay>): BaseInPlay {
    return { defId, minions: [], ongoingActions: [], ...overrides };
}

function makeCtx(overrides: Partial<BaseAbilityContext>): BaseAbilityContext {
    return {
        state: makeState(),
        baseDefId: 'base_test',
        baseIndex: 0,
        playerId: '0',
        now: Date.now(),
        matchState: undefined,
        rankings: undefined,
        ...overrides,
    };
}

describe('D1 审计: base_tortuga 范围限定', () => {
    describe('亚军身份验证', () => {
        it('只有亚军（第2名）可以移动随从', () => {
            const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
                state: makeState({
                    bases: [
                        makeBase('base_tortuga', {
                            minions: [
                                makeMinion('m1', 'test_minion', '0', 20), // 冠军
                                makeMinion('m2', 'test_minion', '1', 10), // 亚军
                            ],
                        }),
                        makeBase('base_other', {
                            minions: [
                                makeMinion('m3', 'test_minion', '1', 5), // 亚军在其他基地的随从（关键！）
                            ],
                        }),
                    ],
                }),
                baseDefId: 'base_tortuga',
                baseIndex: 0,
                rankings: [
                    { playerId: '0', power: 20, vp: 4 }, // 冠军
                    { playerId: '1', power: 10, vp: 2 }, // 亚军
                ],
            }));

            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
            expect(interactions[0].playerId).toBe('1'); // 必须是亚军
        });

        it('冠军不能移动随从（即使有随从在其他基地）', () => {
            const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
                state: makeState({
                    bases: [
                        makeBase('base_tortuga', {
                            minions: [
                                makeMinion('m1', 'test_minion', '0', 20), // 冠军
                                makeMinion('m2', 'test_minion', '1', 10), // 亚军
                            ],
                        }),
                        makeBase('base_other', {
                            minions: [
                                makeMinion('m3', 'test_minion', '0', 5), // 冠军在其他基地的随从
                                makeMinion('m4', 'test_minion', '1', 3), // 亚军在其他基地的随从（关键！）
                            ],
                        }),
                    ],
                }),
                baseDefId: 'base_tortuga',
                baseIndex: 0,
                rankings: [
                    { playerId: '0', power: 20, vp: 4 }, // 冠军
                    { playerId: '1', power: 10, vp: 2 }, // 亚军
                ],
            }));

            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
            // 验证选项中不包含冠军的随从
            const options = interactions[0].data.options;
            const minionOptions = options.filter((opt: any) => opt.value.minionUid);
            expect(minionOptions).toHaveLength(1); // 只有亚军的 m4
            expect(minionOptions[0].value.minionUid).toBe('m4');
        });
    });

    describe('范围限定：只能移动其他基地上的随从', () => {
        it('不能移动托尔图加本身的随从', () => {
            const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
                state: makeState({
                    bases: [
                        makeBase('base_tortuga', {
                            minions: [
                                makeMinion('m1', 'test_minion', '0', 20), // 冠军
                                makeMinion('m2', 'test_minion', '1', 10), // 亚军在托尔图加的随从
                            ],
                        }),
                        makeBase('base_other', {
                            minions: [
                                makeMinion('m3', 'test_minion', '1', 5), // 亚军在其他基地的随从（关键！）
                            ],
                        }),
                    ],
                }),
                baseDefId: 'base_tortuga',
                baseIndex: 0,
                rankings: [
                    { playerId: '0', power: 20, vp: 4 }, // 冠军
                    { playerId: '1', power: 10, vp: 2 }, // 亚军
                ],
            }));

            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
            const options = interactions[0].data.options;
            const minionOptions = options.filter((opt: any) => opt.value.minionUid);
            
            // 验证：只有 m3（其他基地的随从），不包含 m2（托尔图加本身的随从）
            expect(minionOptions).toHaveLength(1);
            expect(minionOptions[0].value.minionUid).toBe('m3');
            expect(minionOptions[0].value.fromBaseIndex).toBe(1); // 来自其他基地
        });

        it('可以移动多个其他基地上的随从（选项包含所有符合条件的随从）', () => {
            const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
                state: makeState({
                    bases: [
                        makeBase('base_tortuga', {
                            minions: [
                                makeMinion('m1', 'test_minion', '0', 20), // 冠军
                                makeMinion('m2', 'test_minion', '1', 10), // 亚军在托尔图加的随从
                            ],
                        }),
                        makeBase('base_other1', {
                            minions: [
                                makeMinion('m3', 'test_minion', '1', 5), // 亚军在基地1的随从
                            ],
                        }),
                        makeBase('base_other2', {
                            minions: [
                                makeMinion('m4', 'test_minion', '1', 3), // 亚军在基地2的随从
                            ],
                        }),
                    ],
                }),
                baseDefId: 'base_tortuga',
                baseIndex: 0,
                rankings: [
                    { playerId: '0', power: 20, vp: 4 }, // 冠军
                    { playerId: '1', power: 10, vp: 2 }, // 亚军
                ],
            }));

            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
            const options = interactions[0].data.options;
            const minionOptions = options.filter((opt: any) => opt.value.minionUid);
            
            // 验证：包含 m3 和 m4，不包含 m2
            expect(minionOptions).toHaveLength(2);
            const uids = minionOptions.map((opt: any) => opt.value.minionUid);
            expect(uids).toContain('m3');
            expect(uids).toContain('m4');
            expect(uids).not.toContain('m2'); // 托尔图加本身的随从不在选项中
        });
    });

    describe('边界条件', () => {
        it('亚军在其他基地没有随从时不触发', () => {
            const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
                state: makeState({
                    bases: [
                        makeBase('base_tortuga', {
                            minions: [
                                makeMinion('m1', 'test_minion', '0', 20), // 冠军
                                makeMinion('m2', 'test_minion', '1', 10), // 亚军只在托尔图加有随从
                            ],
                        }),
                        makeBase('base_other', {
                            minions: [
                                makeMinion('m3', 'test_minion', '0', 5), // 其他基地只有冠军的随从
                            ],
                        }),
                    ],
                }),
                baseDefId: 'base_tortuga',
                baseIndex: 0,
                rankings: [
                    { playerId: '0', power: 20, vp: 4 }, // 冠军
                    { playerId: '1', power: 10, vp: 2 }, // 亚军
                ],
            }));

            const interactions = getInteractionsFromResult(result);
            // 亚军在其他基地没有随从，不应触发交互
            expect(interactions).toHaveLength(0);
        });

        it('只有一个玩家时不触发（无亚军）', () => {
            const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
                state: makeState({
                    bases: [
                        makeBase('base_tortuga', {
                            minions: [
                                makeMinion('m1', 'test_minion', '0', 20), // 只有冠军
                            ],
                        }),
                    ],
                }),
                baseDefId: 'base_tortuga',
                baseIndex: 0,
                rankings: [
                    { playerId: '0', power: 20, vp: 4 }, // 只有冠军
                ],
            }));

            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(0);
        });
    });

    describe('D8 时序验证：不误用 ctx.playerId', () => {
        it('afterScoring 使用 rankings[1].playerId 而非 ctx.playerId', () => {
            // 这个测试验证代码中使用的是 rankings[1].playerId（亚军）
            // 而不是 ctx.playerId（可能是冠军或其他玩家）
            const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
                state: makeState({
                    bases: [
                        makeBase('base_tortuga', {
                            minions: [
                                makeMinion('m1', 'test_minion', '0', 20), // 冠军
                                makeMinion('m2', 'test_minion', '1', 10), // 亚军
                            ],
                        }),
                        makeBase('base_other', {
                            minions: [
                                makeMinion('m3', 'test_minion', '1', 5), // 亚军在其他基地的随从（关键！）
                            ],
                        }),
                    ],
                }),
                baseDefId: 'base_tortuga',
                baseIndex: 0,
                rankings: [
                    { playerId: '0', power: 20, vp: 4 }, // 冠军
                    { playerId: '1', power: 10, vp: 2 }, // 亚军
                ],
                // 注意：即使 ctx.playerId 是 '0'（冠军），也应该给亚军 '1' 创建交互
                playerId: '0', // 模拟 ctx.playerId 是冠军的情况
            }));

            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
            // 关键验证：交互的 playerId 必须是亚军 '1'，而不是 ctx.playerId '0'
            expect(interactions[0].playerId).toBe('1');
        });
    });
});
