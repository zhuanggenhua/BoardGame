/**
 * Token/状态效果 执行逻辑测试
 *
 * 覆盖：
 * - burn（燃烧）upkeep 伤害 + 层数递减
 * - poison（中毒）upkeep 伤害 + 层数递减
 * - concussion（脑震荡）跳过收入阶段
 * - stun（眩晕）跳过进攻掷骰阶段
 * - paladin blessing-prevent（神圣祝福）custom action 注册与执行
 * - accuracy（精准）使攻击不可防御
 * - retribution（神罚）反弹伤害给攻击者
 * - targeted（锁定）受伤+2
 * - blinded（致盲）攻击失败判定
 * - entangle（缠绕）减少掷骰次数
 * - sneak（潜行）免除伤害
 * - sneak_attack（伏击）增加伤害
 */

import { describe, it, expect } from 'vitest';
import {
    fixedRandom,
    createRunner,
    createNoResponseSetupWithEmptyHand,
    cmd,
} from './test-utils';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH, INITIAL_CP } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import { resolveEffectsToEvents } from '../domain/effects';
import { processTokenUsage, shouldOpenTokenResponse } from '../domain/tokenResponse';
import { initializeCustomActions } from '../domain/customActions';
import { BARBARIAN_TOKENS } from '../heroes/barbarian/tokens';
import { ALL_TOKEN_DEFINITIONS } from '../domain/characters';

initializeCustomActions();

// ============================================================================
// 辅助：创建带状态效果的 setup
// ============================================================================

/**
 * 创建 setup：player 0 在 discard 阶段末尾，给 player 1 施加状态效果。
 * ADVANCE_PHASE 会切换到 player 1 的 upkeep。
 */
function createSetupAtPlayer0Discard(
    entries: { playerId: string; statusId: string; stacks: number }[]
) {
    const baseSetup = createNoResponseSetupWithEmptyHand();
    return (playerIds: string[], random: typeof fixedRandom) => {
        const state = baseSetup(playerIds, random);
        state.core.turnPhase = 'discard';
        (state.sys as any).phase = 'discard';
        for (const { playerId, statusId, stacks } of entries) {
            const player = state.core.players[playerId];
            if (player) {
                player.statusEffects[statusId] = stacks;
            }
        }
        return state;
    };
}

/**
 * 创建 setup：player 1 在 upkeep 阶段。
 */
function createSetupAtPlayer1Upkeep(
    entries: { playerId: string; statusId: string; stacks: number }[]
) {
    const baseSetup = createNoResponseSetupWithEmptyHand();
    return (playerIds: string[], random: typeof fixedRandom) => {
        const state = baseSetup(playerIds, random);
        state.core.turnPhase = 'upkeep';
        state.core.activePlayerId = '1';
        state.core.turnNumber = 2;
        (state.sys as any).phase = 'upkeep';
        for (const { playerId, statusId, stacks } of entries) {
            const player = state.core.players[playerId];
            if (player) {
                player.statusEffects[statusId] = stacks;
            }
        }
        return state;
    };
}

// ============================================================================
// 燃烧 (Burn) — upkeep 阶段伤害
// ============================================================================

describe('燃烧 (Burn) upkeep 执行', () => {
    it('1 层燃烧：upkeep 造成 1 点伤害并移除 1 层', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '1层燃烧upkeep',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (player 1)
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 1 },
            ]),
        });

        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 1);
        expect(core.players['1'].statusEffects[STATUS_IDS.BURN] ?? 0).toBe(0);
    });

    it('3 层燃烧：upkeep 造成 3 点伤害并移除 1 层（剩余 2 层）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '3层燃烧upkeep',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 3 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 3);
        expect(core.players['1'].statusEffects[STATUS_IDS.BURN] ?? 0).toBe(2);
    });
});

// ============================================================================
// 中毒 (Poison) — upkeep 阶段伤害
// ============================================================================

describe('中毒 (Poison) upkeep 执行', () => {
    it('1 层中毒：upkeep 造成 1 点伤害并移除 1 层', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '1层中毒upkeep',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.POISON, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 1);
        expect(core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(0);
    });

    it('2 层中毒：upkeep 造成 2 点伤害并移除 1 层（剩余 1 层）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '2层中毒upkeep',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.POISON, stacks: 2 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
        expect(core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(1);
    });
});

// ============================================================================
// 燃烧 + 中毒 同时存在
// ============================================================================

describe('燃烧 + 中毒 同时 upkeep', () => {
    it('1 层燃烧 + 1 层中毒：总共造成 2 点伤害', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '燃烧+中毒同时',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 1 },
                { playerId: '1', statusId: STATUS_IDS.POISON, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
        expect(core.players['1'].statusEffects[STATUS_IDS.BURN] ?? 0).toBe(0);
        expect(core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(0);
    });
});

// ============================================================================
// 脑震荡 (Concussion) — 跳过收入阶段
// ============================================================================

describe('脑震荡 (Concussion) 跳过收入', () => {
    it('有脑震荡时跳过收入阶段（不获得 CP 和抽牌）并移除', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '脑震荡跳过收入',
            commands: [
                cmd('ADVANCE_PHASE', '1'), // upkeep -> income（concussion 触发跳过）
            ],
            setup: createSetupAtPlayer1Upkeep([
                { playerId: '1', statusId: STATUS_IDS.CONCUSSION, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].statusEffects[STATUS_IDS.CONCUSSION] ?? 0).toBe(0);
        expect(core.players['1'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);
    });
});

// ============================================================================
// 眩晕 (Stun) — 跳过进攻掷骰阶段
// ============================================================================

describe('眩晕 (Stun) 跳过进攻掷骰', () => {
    it('有眩晕时进入 offensiveRoll 阶段自动移除', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '眩晕跳过进攻',
            commands: [
                cmd('ADVANCE_PHASE', '1'), // upkeep -> income
                cmd('ADVANCE_PHASE', '1'), // income -> main1
                cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll（stun 触发）
            ],
            setup: createSetupAtPlayer1Upkeep([
                { playerId: '1', statusId: STATUS_IDS.STUN, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].statusEffects[STATUS_IDS.STUN] ?? 0).toBe(0);
    });
});

// ============================================================================
// 圣骑士 神圣祝福 (Blessing of Divinity) — custom action
// ============================================================================

describe('圣骑士 神圣祝福 custom action', () => {
    it('paladin-blessing-prevent handler 已注册', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent');
        expect(handler).toBeDefined();
    });

    it('执行：消耗 token + 防止伤害 + 回复 HP', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 5 },
                },
            },
        } as any;

        const events = handler({
            targetId: '0',
            attackerId: '1',
            sourceAbilityId: 'test',
            state: mockState,
            timestamp: 1000,
            ctx: {} as any,
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent' } as any,
        });

        expect(events.length).toBe(3);
        expect(events[0].type).toBe('TOKEN_CONSUMED');
        expect((events[0] as any).payload.tokenId).toBe(TOKEN_IDS.BLESSING_OF_DIVINITY);
        expect(events[1].type).toBe('PREVENT_DAMAGE');
        expect(events[2].type).toBe('HEAL_APPLIED');
        expect((events[2] as any).payload.amount).toBe(5);
    });

    it('无 blessing token 时不产生事件', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 0 },
                    resources: { [RESOURCE_IDS.HP]: 5 },
                },
            },
        } as any;

        const events = handler({
            targetId: '0',
            attackerId: '1',
            sourceAbilityId: 'test',
            state: mockState,
            timestamp: 1000,
            ctx: {} as any,
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent' } as any,
        });

        expect(events.length).toBe(0);
    });
});


// ============================================================================
// 精准 (Accuracy) — 使攻击不可防御
// ============================================================================

describe('精准 (Accuracy) Token 响应处理', () => {
    it('modifyDamageDealt 处理器返回 makeUndefendable 标志', () => {
        const accuracyDef = {
            id: TOKEN_IDS.ACCURACY,
            name: '精准',
            stackLimit: 3,
            category: 'consumable' as const,
            icon: '🎯',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageDealt' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageDealt' as const, value: 0 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.ACCURACY]: 2 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            accuracyDef as any,
            '0',
            1,
            undefined,
            'beforeDamageDealt'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(0); // 不加伤害
        expect(result.extra?.makeUndefendable).toBe(true); // 使攻击不可防御
    });

    it('crit Token 不返回 makeUndefendable 标志', () => {
        const critDef = {
            id: TOKEN_IDS.CRIT,
            name: '暴击',
            stackLimit: 3,
            category: 'consumable' as const,
            icon: '⚔️',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageDealt' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageDealt' as const, value: 1 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.CRIT]: 2 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            critDef as any,
            '0',
            1,
            undefined,
            'beforeDamageDealt'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(1); // +1 伤害
        expect(result.extra).toBeUndefined(); // 无额外标志
    });
});

// ============================================================================
// 神罚 (Retribution) — 反弹伤害给攻击者
// ============================================================================

describe('神罚 (Retribution) Token 响应处理', () => {
    it('modifyDamageReceived 处理器返回 reflectDamage 标志', () => {
        const retributionDef = {
            id: TOKEN_IDS.RETRIBUTION,
            name: '神罚',
            stackLimit: 3,
            category: 'consumable' as const,
            icon: '⚡',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: 0 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.RETRIBUTION]: 2 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            retributionDef as any,
            '0',
            1,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(0); // 不减伤
        expect(result.extra?.reflectDamage).toBe(2); // 反弹 2 点伤害
    });

    it('消耗 2 层神罚反弹 4 点伤害', () => {
        const retributionDef = {
            id: TOKEN_IDS.RETRIBUTION,
            name: '神罚',
            stackLimit: 3,
            category: 'consumable' as const,
            icon: '⚡',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: 0 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.RETRIBUTION]: 3 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            retributionDef as any,
            '0',
            2,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.extra?.reflectDamage).toBe(4); // 2 层 × 2 = 4 点反弹
    });

    it('protect Token 不返回 reflectDamage 标志', () => {
        const protectDef = {
            id: TOKEN_IDS.PROTECT,
            name: '守护',
            stackLimit: 3,
            category: 'consumable' as const,
            icon: '🛡️',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: -1 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.PROTECT]: 2 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            protectDef as any,
            '0',
            1,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(-1); // -1 伤害
        expect(result.extra).toBeUndefined(); // 无额外标志
    });
});

// ============================================================================
// 锁定 (Targeted) — 受伤+2（effects.ts 中实装）
// ============================================================================

describe('锁定 (Targeted) 伤害修正', () => {
    it('resolveEffectAction 中 damage 类型检查 targeted 状态', () => {
        const effects = [{
            timing: 'withDamage',
            action: { type: 'damage', target: 'opponent', value: 3 },
        }];

        const ctx = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test',
            state: {
                players: {
                    '0': {
                        statusEffects: {},
                        tokens: {},
                        resources: { [RESOURCE_IDS.HP]: 50 },
                    },
                    '1': {
                        statusEffects: { [STATUS_IDS.TARGETED]: 1 },
                        tokens: {},
                        resources: { [RESOURCE_IDS.HP]: 50 },
                    },
                },
                dice: [],
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            },
            damageDealt: 0,
        };

        const events = resolveEffectsToEvents(effects as any, 'withDamage', ctx as any);

        // 应该有 STATUS_REMOVED（移除锁定）+ DAMAGE_DEALT（伤害 3+2=5）
        const statusRemoved = events.find((e: any) => e.type === 'STATUS_REMOVED');
        const damageDealt = events.find((e: any) => e.type === 'DAMAGE_DEALT');

        expect(statusRemoved).toBeDefined();
        expect((statusRemoved as any).payload.statusId).toBe(STATUS_IDS.TARGETED);
        expect(damageDealt).toBeDefined();
        expect((damageDealt as any).payload.amount).toBe(5); // 3 + 2 = 5
    });
});

// ============================================================================
// 致盲 (Blinded) — 攻击失败判定（game.ts onPhaseExit 中实装）
// ============================================================================

describe('致盲 (Blinded) 攻击判定', () => {
    it('致盲掷骰 1-2 时攻击失败（跳过到 main2）', () => {
        // 使用 fixedRandom: d() 总是返回 1，所以致盲判定必定成功（攻击失败）
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '致盲攻击失败',
            commands: [
                cmd('ADVANCE_PHASE', '1'), // offensiveRoll -> 致盲判定 -> main2
            ],
            setup: (playerIds, random) => {
                const state = baseSetup(playerIds, random);
                // 设置 player 1 在 offensiveRoll 阶段，有 pendingAttack 和致盲
                state.core.turnPhase = 'offensiveRoll';
                state.core.activePlayerId = '1';
                state.core.turnNumber = 2;
                (state.sys as any).phase = 'offensiveRoll';
                state.core.players['1'].statusEffects[STATUS_IDS.BLINDED] = 1;
                // 设置 pendingAttack
                state.core.pendingAttack = {
                    attackerId: '1',
                    defenderId: '0',
                    isDefendable: true,
                    sourceAbilityId: 'fist-technique-5',
                    isUltimate: false,
                    damage: 0,
                    bonusDamage: 0,
                    preDefenseResolved: false,
                    damageResolved: false,
                    attackFaceCounts: {},
                } as any;
                state.core.rollConfirmed = true;
                return state;
            },
        });
        const core = result.finalState.core;
        // 致盲被移除
        expect(core.players['1'].statusEffects[STATUS_IDS.BLINDED] ?? 0).toBe(0);
        // fixedRandom.d(6) = 1，1 <= 2 所以攻击失败，跳到 main2
        expect(core.turnPhase).toBe('main2');
    });
});

// ============================================================================
// 缠绕 (Entangle) — 减少掷骰次数（game.ts onPhaseEnter 中实装）
// ============================================================================

describe('缠绕 (Entangle) 掷骰限制', () => {
    it('有缠绕时进入 offensiveRoll 减少 1 次掷骰机会并移除', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '缠绕减少掷骰',
            commands: [
                cmd('ADVANCE_PHASE', '1'), // upkeep -> income
                cmd('ADVANCE_PHASE', '1'), // income -> main1
                cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll（entangle 触发）
            ],
            setup: createSetupAtPlayer1Upkeep([
                { playerId: '1', statusId: STATUS_IDS.ENTANGLE, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        // 缠绕被移除
        expect(core.players['1'].statusEffects[STATUS_IDS.ENTANGLE] ?? 0).toBe(0);
        // 掷骰上限从 3 减少到 2
        expect(core.rollLimit).toBe(2);
    });
});

// ============================================================================
// 潜行 (Sneak) — 免除伤害（effects.ts 中实装）
// ============================================================================

describe('潜行 (Sneak) 伤害免除', () => {
    it('resolveEffectAction 中 damage 类型检查 sneak token', () => {
        const effects = [{
            timing: 'withDamage',
            action: { type: 'damage', target: 'opponent', value: 5 },
        }];

        const ctx = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test',
            state: {
                players: {
                    '0': {
                        statusEffects: {},
                        tokens: {},
                        resources: { [RESOURCE_IDS.HP]: 50 },
                    },
                    '1': {
                        statusEffects: {},
                        tokens: { [TOKEN_IDS.SNEAK]: 1 },
                        resources: { [RESOURCE_IDS.HP]: 50 },
                    },
                },
                dice: [],
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            },
            damageDealt: 0,
        };

        const events = resolveEffectsToEvents(effects as any, 'withDamage', ctx as any);

        // 应该有 TOKEN_CONSUMED（消耗潜行）+ PREVENT_DAMAGE（免除伤害）
        const tokenConsumed = events.find((e: any) => e.type === 'TOKEN_CONSUMED');
        const preventDamage = events.find((e: any) => e.type === 'PREVENT_DAMAGE');
        const damagePrevented = events.find((e: any) => e.type === 'DAMAGE_PREVENTED');
        const damageDealt = events.find((e: any) => e.type === 'DAMAGE_DEALT');

        expect(tokenConsumed).toBeDefined();
        expect((tokenConsumed as any).payload.tokenId).toBe(TOKEN_IDS.SNEAK);
        expect(preventDamage).toBeDefined();
        expect((preventDamage as any).payload.applyImmediately).toBe(true);
        expect(damagePrevented).toBeDefined();
        // 伤害被完全免除，不应有 DAMAGE_DEALT 事件
        expect(damageDealt).toBeUndefined();
    });
});

// ============================================================================
// 伏击 (Sneak Attack) — custom action 注册验证
// ============================================================================

describe('伏击 (Sneak Attack) custom action', () => {
    it('shadow_thief-sneak-attack-use handler 已注册', () => {
        const handler = getCustomActionHandler('shadow_thief-sneak-attack-use');
        expect(handler).toBeDefined();
    });

    it('shadow_thief-sneak-prevent handler 已注册', () => {
        const handler = getCustomActionHandler('shadow_thief-sneak-prevent');
        expect(handler).toBeDefined();
    });
});

// ============================================================================
// 晕眩 (Daze) — 额外攻击执行逻辑
// ============================================================================

/**
 * 创建 setup：player 0 在 offensiveRoll 阶段，有 pendingAttack + rollConfirmed + daze
 * 攻击不可防御，这样 onPhaseExit 会直接结算攻击（不进入 defensiveRoll）
 */
function createSetupAtOffensiveRollWithDaze(
    options: {
        attackerId?: string;
        defenderId?: string;
        isDefendable?: boolean;
        dazeOnAttacker?: boolean;
        dazeStacks?: number;
    } = {}
) {
    const {
        attackerId = '0',
        defenderId = '1',
        isDefendable = false,
        dazeOnAttacker = true,
        dazeStacks = 1,
    } = options;
    const baseSetup = createNoResponseSetupWithEmptyHand();
    return (playerIds: string[], random: typeof fixedRandom) => {
        const state = baseSetup(playerIds, random);
        state.core.turnPhase = 'offensiveRoll';
        state.core.activePlayerId = attackerId;
        state.core.turnNumber = 2;
        (state.sys as any).phase = 'offensiveRoll';
        state.core.rollConfirmed = true;
        state.core.pendingAttack = {
            attackerId,
            defenderId,
            isDefendable,
            sourceAbilityId: 'fist-technique-5',
            isUltimate: false,
            damage: 0,
            bonusDamage: 0,
            preDefenseResolved: false,
            damageResolved: false,
            attackFaceCounts: {},
        } as any;
        if (dazeOnAttacker) {
            state.core.players[attackerId].statusEffects[STATUS_IDS.DAZE] = dazeStacks;
        }
        return state;
    };
}

describe('晕眩 (Daze) 数据定义验证', () => {
    it('daze token 定义存在且配置正确', () => {
        const daze = BARBARIAN_TOKENS.find((t: any) => t.id === STATUS_IDS.DAZE);
        expect(daze).toBeDefined();
        expect(daze!.category).toBe('debuff');
        expect(daze!.passiveTrigger?.timing).toBe('onAttackEnd');
        expect(daze!.passiveTrigger?.actions).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'extraAttack' })])
        );
    });
});

describe('晕眩 (Daze) 额外攻击执行', () => {
    it('不可防御攻击结算后：daze 被移除，进入额外攻击 offensiveRoll', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze额外攻击-不可防御',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit → 攻击结算 → daze 触发 → override offensiveRoll
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
            }),
        });
        const core = result.finalState.core;
        // daze 被移除
        expect(core.players['0'].statusEffects[STATUS_IDS.DAZE] ?? 0).toBe(0);
        // 进入额外攻击的 offensiveRoll
        expect(core.turnPhase).toBe('offensiveRoll');
        // 额外攻击进行中标志已设置
        expect(core.extraAttackInProgress).toBeDefined();
        expect(core.extraAttackInProgress!.attackerId).toBe('1'); // 防御方获得额外攻击
        expect(core.extraAttackInProgress!.originalActivePlayerId).toBe('0'); // 原活跃玩家
        // 活跃玩家切换为额外攻击方（Player 1）
        expect(core.activePlayerId).toBe('1');
    });

    it('额外攻击结束后进入 main2：extraAttackInProgress 清除，活跃玩家恢复', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze额外攻击-结束恢复',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit → daze 触发 → 进入额外攻击 offensiveRoll
                cmd('ADVANCE_PHASE', '1'), // 额外攻击 offensiveRoll exit → 无 pendingAttack → 进入 main2
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
            }),
        });
        const core = result.finalState.core;
        // 进入 main2
        expect(core.turnPhase).toBe('main2');
        // 额外攻击标志已清除
        expect(core.extraAttackInProgress).toBeUndefined();
        // 活跃玩家恢复为原回合玩家（Player 0）
        expect(core.activePlayerId).toBe('0');
    });

    it('额外攻击不会递归触发（daze 已在第一次攻击后移除）', () => {
        // Player 0 有 daze，攻击结算后 daze 移除，Player 1 获得额外攻击
        // Player 1 在额外攻击中不应再触发 daze（因为 Player 0 的 daze 已移除）
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze不递归',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // 第一次攻击 → daze 触发额外攻击
                cmd('ADVANCE_PHASE', '1'), // 额外攻击 → 无 pendingAttack → main2
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
            }),
        });
        const core = result.finalState.core;
        // 最终应在 main2，不会再次进入 offensiveRoll
        expect(core.turnPhase).toBe('main2');
        expect(core.extraAttackInProgress).toBeUndefined();
    });

    it('可防御攻击 + daze：经过 defensiveRoll 后触发额外攻击', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze可防御攻击',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit → 可防御 → 进入 defensiveRoll
                cmd('ADVANCE_PHASE', '1'), // defensiveRoll exit → 攻击结算 → daze 触发 → override offensiveRoll
            ],
            setup: (playerIds, random) => {
                const state = baseSetup(playerIds, random);
                state.core.turnPhase = 'offensiveRoll';
                state.core.activePlayerId = '0';
                state.core.turnNumber = 2;
                (state.sys as any).phase = 'offensiveRoll';
                state.core.rollConfirmed = true;
                state.core.pendingAttack = {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true, // 可防御
                    sourceAbilityId: 'fist-technique-5',
                    isUltimate: false,
                    damage: 0,
                    bonusDamage: 0,
                    preDefenseResolved: false,
                    damageResolved: false,
                    attackFaceCounts: {},
                } as any;
                state.core.players['0'].statusEffects[STATUS_IDS.DAZE] = 1;
                return state;
            },
        });
        const core = result.finalState.core;
        // daze 被移除
        expect(core.players['0'].statusEffects[STATUS_IDS.DAZE] ?? 0).toBe(0);
        // 进入额外攻击的 offensiveRoll
        expect(core.turnPhase).toBe('offensiveRoll');
        expect(core.extraAttackInProgress).toBeDefined();
        expect(core.extraAttackInProgress!.attackerId).toBe('1');
        expect(core.activePlayerId).toBe('1');
    });

    it('无 daze 时攻击结算后正常进入 main2', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '无daze正常流程',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit → 攻击结算 → 无 daze → main2
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
                dazeOnAttacker: false, // 无 daze
            }),
        });
        const core = result.finalState.core;
        expect(core.turnPhase).toBe('main2');
        expect(core.extraAttackInProgress).toBeUndefined();
        expect(core.activePlayerId).toBe('0');
    });

    it('额外攻击的 offensiveRoll 骰子状态正确重置', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze额外攻击骰子重置',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // daze 触发 → 进入额外攻击 offensiveRoll
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
            }),
        });
        const core = result.finalState.core;
        // 额外攻击的 offensiveRoll 骰子状态应被重置
        expect(core.rollCount).toBe(0);
        expect(core.rollLimit).toBe(3);
        expect(core.rollDiceCount).toBe(5);
        expect(core.rollConfirmed).toBe(false);
        // pendingAttack 应被清除（新的 offensiveRoll 开始）
        expect(core.pendingAttack).toBeNull();
    });
});

// ============================================================================
// Token 响应窗口判定（基于 tokenDefinitions）
// ============================================================================

describe('Token 响应窗口判定', () => {
    it('攻击方有暴击 Token 时应打开 attackerBoost', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 3);
        expect(responseType).toBe('attackerBoost');
    });

    it('防御方有守护 Token 时应打开 defenderMitigation', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['1'].tokens[TOKEN_IDS.PROTECT] = 1;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 2);
        expect(responseType).toBe('defenderMitigation');
    });

    it('仅有净化 Token 时不应打开响应窗口', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 2);
        expect(responseType).toBeNull();
    });
});

// ============================================================================
// 净化 (Purify) — TOKEN_USED effectType 语义
// ============================================================================

describe('净化 (Purify) Token 语义', () => {
    it('TOKEN_USED 应标记为 removeDebuff', () => {
        const purifyDef = {
            id: TOKEN_IDS.PURIFY,
            name: '净化',
            stackLimit: 3,
            category: 'consumable' as const,
            icon: '✨',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['anytime' as const],
                consumeAmount: 1,
                effect: { type: 'removeDebuff' as const },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.PURIFY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
        };

        const { events } = processTokenUsage(
            mockState as any,
            purifyDef as any,
            '0',
            1
        );

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('TOKEN_USED');
        expect((events[0] as any).payload.effectType).toBe('removeDebuff');
    });
});
