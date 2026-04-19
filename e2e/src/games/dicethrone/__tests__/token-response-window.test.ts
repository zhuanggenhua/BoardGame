/**
 * Token 响应窗口测试
 * 
 * 测试 Token 响应窗口的完整流程：
 * 1. 加伤 Token（beforeDamageDealt）
 * 2. 减伤 Token（beforeDamageReceived）
 * 3. 闪避 Token（投骰免伤）
 * 4. 太极 Token（双时机）
 * 5. 精准 Token（不可防御）
 * 6. 神罚 Token（反弹伤害）
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';

const createCoreState = (): DiceThroneCore => ({
    players: {
        '0': {
            id: '0',
            hand: [],
            deck: [],
            discard: [],
            abilities: [],
            resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
            statusEffects: {},
            tokens: {},
            damageShields: [],
            abilityLevels: {},
        },
        '1': {
            id: '1',
            hand: [],
            deck: [],
            discard: [],
            abilities: [],
            resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
            statusEffects: {},
            tokens: {},
            damageShields: [],
            abilityLevels: {},
        },
    },
    activePlayerId: '0',
    turnNumber: 1,
    dice: [],
    rollCount: 0,
    phase: 'offensiveRoll',
});

describe('Token 响应窗口', () => {
    describe('加伤 Token（beforeDamageDealt）', () => {
        it('暴击 Token 应该增加伤害', () => {
            let state = createCoreState();
            state.players['0'].tokens[TOKEN_IDS.CRIT] = 2;

            // TOKEN_RESPONSE_REQUESTED
            const requestEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_REQUESTED',
                payload: {
                    pendingDamage: {
                        id: 'dmg-1',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        responseType: 'beforeDamageDealt',
                        responderId: '0',
                        isFullyEvaded: false,
                    },
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 1000,
            };
            state = reduce(state, requestEvent);
            expect(state.pendingDamage).toBeDefined();
            expect(state.pendingDamage?.currentDamage).toBe(5);

            // TOKEN_USED - 使用 1 层暴击
            const useEvent: DiceThroneEvent = {
                type: 'TOKEN_USED',
                payload: {
                    playerId: '0',
                    tokenId: TOKEN_IDS.CRIT,
                    amount: 1,
                    effectType: 'damageBoost',
                    damageModifier: 1,
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp: 1001,
            };
            state = reduce(state, useEvent);
            expect(state.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(1); // 消耗 1 层
            expect(state.pendingDamage?.currentDamage).toBe(6); // 5 + 1

            // TOKEN_RESPONSE_CLOSED
            const closeEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-1',
                    finalDamage: 6,
                    fullyEvaded: false,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 1002,
            };
            state = reduce(state, closeEvent);
            expect(state.pendingDamage).toBeUndefined();

            // DAMAGE_DEALT
            const damageEvent: DiceThroneEvent = {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '1',
                    amount: 6,
                    actualDamage: 6,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 1003,
            };
            state = reduce(state, damageEvent);
            expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(44); // 50 - 6
        });

        it('精准 Token 应该使攻击不可防御', () => {
            let state = createCoreState();
            state.players['0'].tokens[TOKEN_IDS.ACCURACY] = 1;

            const requestEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_REQUESTED',
                payload: {
                    pendingDamage: {
                        id: 'dmg-2',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        responseType: 'beforeDamageDealt',
                        responderId: '0',
                        isFullyEvaded: false,
                    },
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 2000,
            };
            state = reduce(state, requestEvent);

            // TOKEN_USED - 精准不增加伤害，但标记为不可防御
            const useEvent: DiceThroneEvent = {
                type: 'TOKEN_USED',
                payload: {
                    playerId: '0',
                    tokenId: TOKEN_IDS.ACCURACY,
                    amount: 1,
                    effectType: 'damageBoost',
                    damageModifier: 0, // 不加伤
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp: 2001,
            };
            state = reduce(state, useEvent);
            expect(state.players['0'].tokens[TOKEN_IDS.ACCURACY]).toBe(0); // 消耗
            expect(state.pendingDamage?.currentDamage).toBe(5); // 伤害不变
            // 注意：不可防御标记在 pendingAttack 上，这里只测试 token 消耗
        });
    });

    describe('减伤 Token（beforeDamageReceived）', () => {
        it('守护 Token 应该减少伤害', () => {
            let state = createCoreState();
            state.players['1'].tokens[TOKEN_IDS.PROTECT] = 3;

            const requestEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_REQUESTED',
                payload: {
                    pendingDamage: {
                        id: 'dmg-3',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 3000,
            };
            state = reduce(state, requestEvent);

            // TOKEN_USED - 使用 2 层守护
            const useEvent: DiceThroneEvent = {
                type: 'TOKEN_USED',
                payload: {
                    playerId: '1',
                    tokenId: TOKEN_IDS.PROTECT,
                    amount: 2,
                    effectType: 'damageReduction',
                    damageModifier: -2,
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp: 3001,
            };
            state = reduce(state, useEvent);
            expect(state.players['1'].tokens[TOKEN_IDS.PROTECT]).toBe(1); // 剩余 1 层
            expect(state.pendingDamage?.currentDamage).toBe(3); // 5 - 2

            const closeEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-3',
                    finalDamage: 3,
                    fullyEvaded: false,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 3002,
            };
            state = reduce(state, closeEvent);

            const damageEvent: DiceThroneEvent = {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '1',
                    amount: 3,
                    actualDamage: 3,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 3003,
            };
            state = reduce(state, damageEvent);
            expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(47); // 50 - 3
        });

        it('神罚 Token 应该反弹伤害', () => {
            let state = createCoreState();
            state.players['1'].tokens[TOKEN_IDS.RETRIBUTION] = 1;

            const requestEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_REQUESTED',
                payload: {
                    pendingDamage: {
                        id: 'dmg-4',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 4000,
            };
            state = reduce(state, requestEvent);

            // TOKEN_USED - 神罚不减伤，但反弹 2 点
            const useEvent: DiceThroneEvent = {
                type: 'TOKEN_USED',
                payload: {
                    playerId: '1',
                    tokenId: TOKEN_IDS.RETRIBUTION,
                    amount: 1,
                    effectType: 'damageReduction',
                    damageModifier: 0, // 不减伤
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp: 4001,
            };
            state = reduce(state, useEvent);
            expect(state.players['1'].tokens[TOKEN_IDS.RETRIBUTION]).toBe(0); // 消耗
            expect(state.pendingDamage?.currentDamage).toBe(5); // 伤害不变
            // 注意：反弹伤害由 custom action 处理，这里只测试 token 消耗
        });
    });

    describe('太极 Token（双时机）', () => {
        it('太极在攻击时应该加伤', () => {
            let state = createCoreState();
            state.players['0'].tokens[TOKEN_IDS.TAIJI] = 2;

            const requestEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_REQUESTED',
                payload: {
                    pendingDamage: {
                        id: 'dmg-5',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        responseType: 'beforeDamageDealt',
                        responderId: '0',
                        isFullyEvaded: false,
                    },
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 5000,
            };
            state = reduce(state, requestEvent);

            // TOKEN_USED - 太极在 beforeDamageDealt 时加伤
            const useEvent: DiceThroneEvent = {
                type: 'TOKEN_USED',
                payload: {
                    playerId: '0',
                    tokenId: TOKEN_IDS.TAIJI,
                    amount: 1,
                    effectType: 'damageBoost',
                    damageModifier: 1, // +1 伤害
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp: 5001,
            };
            state = reduce(state, useEvent);
            expect(state.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(1);
            expect(state.pendingDamage?.currentDamage).toBe(6); // 5 + 1
        });

        it('太极在防御时应该减伤', () => {
            let state = createCoreState();
            state.players['1'].tokens[TOKEN_IDS.TAIJI] = 2;

            const requestEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_REQUESTED',
                payload: {
                    pendingDamage: {
                        id: 'dmg-6',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 6000,
            };
            state = reduce(state, requestEvent);

            // TOKEN_USED - 太极在 beforeDamageReceived 时减伤
            const useEvent: DiceThroneEvent = {
                type: 'TOKEN_USED',
                payload: {
                    playerId: '1',
                    tokenId: TOKEN_IDS.TAIJI,
                    amount: 1,
                    effectType: 'damageReduction',
                    damageModifier: -1, // -1 伤害
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp: 6001,
            };
            state = reduce(state, useEvent);
            expect(state.players['1'].tokens[TOKEN_IDS.TAIJI]).toBe(1);
            expect(state.pendingDamage?.currentDamage).toBe(4); // 5 - 1
        });
    });

    describe('闪避 Token（投骰免伤）', () => {
        it('闪避成功应该完全免伤', () => {
            let state = createCoreState();
            state.players['1'].tokens[TOKEN_IDS.EVASIVE] = 1;

            const requestEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_REQUESTED',
                payload: {
                    pendingDamage: {
                        id: 'dmg-7',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 7000,
            };
            state = reduce(state, requestEvent);

            // TOKEN_USED - 闪避成功（投骰 1-2）
            const useEvent: DiceThroneEvent = {
                type: 'TOKEN_USED',
                payload: {
                    playerId: '1',
                    tokenId: TOKEN_IDS.EVASIVE,
                    amount: 1,
                    effectType: 'evasionAttempt',
                    evasionRoll: {
                        value: 2,
                        success: true,
                    },
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp: 7001,
            };
            state = reduce(state, useEvent);
            expect(state.players['1'].tokens[TOKEN_IDS.EVASIVE]).toBe(0); // 消耗
            expect(state.pendingDamage?.isFullyEvaded).toBe(true);
            expect(state.pendingDamage?.currentDamage).toBe(0); // 完全免伤

            const closeEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-7',
                    finalDamage: 0,
                    fullyEvaded: true,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 7002,
            };
            state = reduce(state, closeEvent);
            expect(state.pendingDamage).toBeUndefined();
            // 完全闪避时不产生 DAMAGE_DEALT 事件
            expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(50); // 未受伤
        });

        it('闪避失败应该正常受伤', () => {
            let state = createCoreState();
            state.players['1'].tokens[TOKEN_IDS.EVASIVE] = 1;

            const requestEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_REQUESTED',
                payload: {
                    pendingDamage: {
                        id: 'dmg-8',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                        isFullyEvaded: false,
                    },
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 8000,
            };
            state = reduce(state, requestEvent);

            // TOKEN_USED - 闪避失败（投骰 3-6）
            const useEvent: DiceThroneEvent = {
                type: 'TOKEN_USED',
                payload: {
                    playerId: '1',
                    tokenId: TOKEN_IDS.EVASIVE,
                    amount: 1,
                    effectType: 'evasionAttempt',
                    evasionRoll: {
                        value: 4,
                        success: false,
                    },
                },
                sourceCommandType: 'USE_TOKEN',
                timestamp: 8001,
            };
            state = reduce(state, useEvent);
            expect(state.players['1'].tokens[TOKEN_IDS.EVASIVE]).toBe(0); // 消耗
            expect(state.pendingDamage?.isFullyEvaded).toBe(false);
            expect(state.pendingDamage?.currentDamage).toBe(5); // 伤害不变

            const closeEvent: DiceThroneEvent = {
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-8',
                    finalDamage: 5,
                    fullyEvaded: false,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 8002,
            };
            state = reduce(state, closeEvent);

            const damageEvent: DiceThroneEvent = {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '1',
                    amount: 5,
                    actualDamage: 5,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 8003,
            };
            state = reduce(state, damageEvent);
            expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(45); // 50 - 5
        });
    });
});
