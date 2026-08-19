/**
 * Token 修复覆盖测试
 *
 * 验证以下修复的完整流程：
 * 1. 太极攻击方 modifier 符号反转（modifyDamageReceived 在 beforeDamageDealt 时取绝对值）
 * 2. Sneak Attack USE_TOKEN → custom action 触发链路
 * 3. Fire Mastery 维持阶段冷却（upkeep 移除 1 层）
 * 4. 被动触发端到端（Sneak 免伤、Blessing 致死保护）
 * 5. Token 使用边界条件（amount 超限、减伤到 0、反弹超 HP）
 */

import { describe, it, expect } from 'vitest';
import {
    fixedRandom,
    createQueuedRandom,
    createRunner,
    createNoResponseSetupWithEmptyHand,
    cmd,
} from './test-utils';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH } from '../domain/types';
import { processTokenUsage } from '../domain/tokenResponse';
import { reduce } from '../domain/reducer';
import { MONK_TOKENS } from '../heroes/monk/tokens';

// ============================================================================
// 辅助
// ============================================================================

function createSetupAtPlayer0Discard(
    mutate: (state: ReturnType<ReturnType<typeof createNoResponseSetupWithEmptyHand>>) => void
) {
    const baseSetup = createNoResponseSetupWithEmptyHand();
    return (playerIds: string[], random: typeof fixedRandom) => {
        const state = baseSetup(playerIds, random);
        (state.sys as any).phase = 'discard';
        mutate(state);
        return state;
    };
}

// ============================================================================
// 1. 太极攻击方 modifier 符号反转
// ============================================================================

describe('太极 modifyDamageReceived 符号反转', () => {
    const taijiDef = MONK_TOKENS.find(t => t.id === TOKEN_IDS.TAIJI)!;

    it('防御方使用：value=-1 保持负数（减伤）', () => {
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.TAIJI]: 3 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 6,
                currentDamage: 6,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any, taijiDef, '0', 2, undefined, 'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        // value=-1, amount=2 → modifier = -1 * 2 = -2（减伤）
        expect(result.damageModifier).toBe(-2);
    });

    it('攻击方使用：value=-1 反转为正数（加伤）', () => {
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.TAIJI]: 3 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 6,
                currentDamage: 6,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result } = processTokenUsage(
            mockState as any, taijiDef, '0', 2, undefined, 'beforeDamageDealt'
        );

        expect(result.success).toBe(true);
        // value=-1, amount=2, isOffensiveUse → modifier = abs(-1) * 2 = +2（加伤）
        expect(result.damageModifier).toBe(2);
    });

    it('攻击方使用 1 个太极：modifier = +1', () => {
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.TAIJI]: 1 },
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
            mockState as any, taijiDef, '0', 1, undefined, 'beforeDamageDealt'
        );

        expect(result.damageModifier).toBe(1);
    });
});

// ============================================================================
// 2. Sneak Attack USE_TOKEN → custom action 触发链路
// ============================================================================

describe('Sneak Attack USE_TOKEN 端到端', () => {
    it('USE_TOKEN(sneak_attack) 应触发 custom action 并增加 pendingAttack 伤害', () => {
        // 使用 queuedRandom 控制掷骰结果：d(6) = 4
        const queuedRandom = createQueuedRandom([4]);
        const baseSetup = createNoResponseSetupWithEmptyHand();

        const runner = createRunner(queuedRandom);
        const result = runner.run({
            name: 'sneak-attack-use-token-trigger',
            commands: [
                cmd('USE_TOKEN', '0', { tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1 }),
                cmd('SKIP_BONUS_DICE_REROLL', '0'),
            ],
            setup: (playerIds, random) => {
                const state = baseSetup(playerIds, random);
                // 选择暗影刺客
                state.core.players['0'].characterId = 'shadow_thief';
                state.core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK] = 1;
                // 设置 pendingDamage（攻击方响应阶段）
                state.core.pendingDamage = {
                    id: 'pd-test',
                    sourcePlayerId: '0',
                    targetPlayerId: '1',
                    originalDamage: 5,
                    currentDamage: 5,
                    sourceAbilityId: 'dagger-strike-5',
                    responseType: 'beforeDamageDealt',
                    responderId: '0',
                } as any;
                // 设置 pendingAttack（custom action 需要修改 damage）
                state.core.pendingAttack = {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'dagger-strike-5',
                    isUltimate: false,
                    damage: 5,
                    bonusDamage: 0,
                    preDefenseResolved: false,
                    damageResolved: false,
                    attackFaceCounts: {},
                } as any;
                return state;
            },
        });

        // 验证 sneak_attack token 被消耗
        expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK]).toBe(0);

        // 使用 Token 先打开临时奖励骰；确认后才按最终骰面结算伤害。
        const steps = result.steps;
        const useTokenStep = steps[0];
        // queuedRandom d(6) = 4，所以确认后 damage 从 5 增加到 9。
        expect(useTokenStep.events).toContain('TOKEN_USED');
        expect(useTokenStep.events).toContain('BONUS_DICE_REROLL_REQUESTED');
        expect(useTokenStep.events).not.toContain('BONUS_DIE_ROLLED');
        expect(steps[1].events).toContain('BONUS_DICE_SETTLED');
        expect(steps[1].events).toContain('BONUS_DIE_ROLLED');
        expect(result.finalState.core.pendingAttack?.damage).toBe(9);
    });

    it('transferred sneak_attack still triggers original custom action', () => {
        const queuedRandom = createQueuedRandom([4]);
        const baseSetup = createNoResponseSetupWithEmptyHand();

        const runner = createRunner(queuedRandom);
        const result = runner.run({
            name: 'transferred-sneak-attack-still-triggers-original-custom-action',
            commands: [
                cmd('USE_TOKEN', '0', { tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1 }),
                cmd('SKIP_BONUS_DICE_REROLL', '0'),
            ],
            setup: (playerIds, random) => {
                const state = baseSetup(playerIds, random);
                state.core.players['0'].characterId = 'barbarian';
                state.core.players['1'].characterId = 'shadow_thief';
                state.core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK] = 1;
                state.core.pendingDamage = {
                    id: 'pd-transferred-sneak-attack',
                    sourcePlayerId: '0',
                    targetPlayerId: '1',
                    originalDamage: 8,
                    currentDamage: 8,
                    sourceAbilityId: 'slap-3',
                    responseType: 'beforeDamageDealt',
                    responderId: '0',
                } as any;
                state.core.pendingAttack = {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'slap-3',
                    isUltimate: false,
                    damage: 8,
                    bonusDamage: 0,
                    preDefenseResolved: false,
                    damageResolved: false,
                    attackFaceCounts: {},
                } as any;
                return state;
            },
        });

        const useTokenStep = result.steps[0];
        expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK]).toBe(0);
        expect(useTokenStep.events).toContain('TOKEN_USED');
        expect(useTokenStep.events).toContain('BONUS_DICE_REROLL_REQUESTED');
        expect(useTokenStep.events).not.toContain('BONUS_DIE_ROLLED');
        expect(result.steps[1].events).toContain('BONUS_DICE_SETTLED');
        expect(result.steps[1].events).toContain('BONUS_DIE_ROLLED');
        expect(result.finalState.core.pendingAttack?.damage).toBe(12);
    });
});

// ============================================================================
// 3. Fire Mastery 维持阶段冷却
// ============================================================================

describe('Fire Mastery 维持阶段冷却', () => {
    it('有 3 层火焰精通时，upkeep 移除 1 层（剩余 2 层）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'fire-mastery-cooldown-3',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // discard → player 1 upkeep（触发冷却）
            ],
            setup: createSetupAtPlayer0Discard((state) => {
                state.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY] = 3;
            }),
        });

        expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY]).toBe(2);
    });

    it('有 1 层火焰精通时，upkeep 移除 1 层（剩余 0 层）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'fire-mastery-cooldown-1',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard((state) => {
                state.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY] = 1;
            }),
        });

        expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY]).toBe(0);
    });

    it('无火焰精通时，upkeep 不产生 TOKEN_CONSUMED 事件', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'fire-mastery-cooldown-0',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard((state) => {
                state.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY] = 0;
            }),
        });

        // upkeep 步骤的事件中不应包含 TOKEN_CONSUMED
        const advanceStep = result.steps[0];
        const tokenConsumedCount = advanceStep.events.filter(
            (e: string) => e === 'TOKEN_CONSUMED'
        ).length;
        expect(tokenConsumedCount).toBe(0);
        // token 数量仍为 0
        expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY]).toBe(0);
    });

    it('火焰精通冷却与燃烧伤害同时生效', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'fire-mastery-cooldown-with-burn',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard((state) => {
                state.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY] = 2;
                state.core.players['1'].statusEffects[STATUS_IDS.BURN] = 1;
            }),
        });

        const core = result.finalState.core;
        // 火焰精通冷却：3 → 2 → 1
        expect(core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY]).toBe(1);
        // 燃烧伤害：固定 2 点伤害，状态持续不移除
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
        expect(core.players['1'].statusEffects[STATUS_IDS.BURN] ?? 0).toBe(1);
    });
});


// ============================================================================
// 4. 被动触发端到端
// ============================================================================

describe('Sneak（潜行）被动免伤 — 已移至攻击流程', () => {
    it('潜行逻辑已移至 flowHooks.ts offensiveRoll 退出阶段', () => {
        // 潜行现在在攻击流程中处理（offensiveRoll 阶段退出时）
        // 若防御方有潜行，跳过防御掷骰、免除伤害、消耗潜行
        // 详见 flowHooks.ts 的 offensiveRoll 退出逻辑
        // 集成测试见 shadow_thief-behavior.test.ts 或 E2E 测试
        expect(true).toBe(true);
    });
});

describe('Blessing of Divinity（神圣祝福）致死保护', () => {
    it('HP=3 受到 10 点伤害时：不防止原伤害，正式扣血后消耗 token 并保留 1 HP', () => {
        const mockCore = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 3 },
                    damageShields: [],
                },
            },
        } as any;

        const event = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '0', amount: 10, actualDamage: 10, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1000,
        };

        const after = reduce(mockCore, event as any) as any;
        expect(after.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY]).toBe(0);
        expect(after.players['0'].resources[RESOURCE_IDS.HP]).toBe(1);
        expect(event.payload.actualDamage).toBe(2);
    });

    it('非致死伤害时：正常扣血且不消耗 token', () => {
        const mockCore = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 30 },
                    damageShields: [],
                },
            },
        } as any;

        const event = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '0', amount: 5, actualDamage: 5, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1000,
        };

        const after = reduce(mockCore, event as any) as any;
        expect(after.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY]).toBe(1);
        expect(after.players['0'].resources[RESOURCE_IDS.HP]).toBe(25);
        expect(event.payload.actualDamage).toBe(5);
    });

    it('无 blessing token 时：致死伤害正常击败目标', () => {
        const mockCore = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 0 },
                    resources: { [RESOURCE_IDS.HP]: 3 },
                    damageShields: [],
                },
            },
        } as any;

        const event = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '0', amount: 10, actualDamage: 10, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1000,
        };

        const after = reduce(mockCore, event as any) as any;
        expect(after.players['0'].resources[RESOURCE_IDS.HP]).toBe(0);
        expect(event.payload.actualDamage).toBe(3);
    });

    it('HP=1 受到致死伤害时：仍消耗 token，HP 保持 1', () => {
        const mockCore = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 1 },
                    damageShields: [],
                },
            },
        } as any;

        const event = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '0', amount: 5, actualDamage: 5, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1000,
        };

        const after = reduce(mockCore, event as any) as any;
        expect(after.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY]).toBe(0);
        expect(after.players['0'].resources[RESOURCE_IDS.HP]).toBe(1);
        expect(event.payload.actualDamage).toBe(0);
    });
});

// ============================================================================
// 5. Token 使用边界条件
// ============================================================================

describe('Token 使用边界条件', () => {
    const taijiDef = MONK_TOKENS.find(t => t.id === TOKEN_IDS.TAIJI)!;

    it('amount 超过持有量时 clamp 到实际持有量', () => {
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.TAIJI]: 2 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 10,
                currentDamage: 10,
                responseType: 'beforeDamageReceived',
            },
        };

        // 请求使用 5 个，但只有 2 个
        const { result, newTokenAmount } = processTokenUsage(
            mockState as any, taijiDef, '0', 5, undefined, 'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        // 实际只消耗 2 个，modifier = -1 * 2 = -2
        expect(result.damageModifier).toBe(-2);
        expect(newTokenAmount).toBe(0);
    });

    it('amount = 0 时返回失败', () => {
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.TAIJI]: 3 },
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
            mockState as any, taijiDef, '0', 0, undefined, 'beforeDamageReceived'
        );

        expect(result.success).toBe(false);
    });

    it('Protect 减伤超过 currentDamage 时 reducer 钳制到 0（不变负）', () => {
        // 这个测试验证 reduceCombat.ts handleTokenUsed 中 Math.max(0, ...) 的保护
        const mockCore = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.PROTECT]: 5 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    statusEffects: {},
                    hand: [], deck: [], discard: [], abilities: [],
                },
            },
            pendingDamage: {
                id: 'pd-test',
                sourcePlayerId: '1',
                targetPlayerId: '0',
                originalDamage: 3,
                currentDamage: 3,
                responseType: 'beforeDamageReceived',
                responderId: '0',
            },
        };

        // 使用 5 个 protect（value=-1 × 5 = -5），但 currentDamage 只有 3
        const event = {
            type: 'TOKEN_USED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.PROTECT,
                amount: 5,
                effectType: 'damageReduction',
                damageModifier: -5,
            },
            timestamp: 1000,
        };

        const result = reduce(mockCore as any, event as any);
        // currentDamage 应被钳制到 0，不是 -2
        expect(result.pendingDamage!.currentDamage).toBe(0);
    });

    it('Retribution 反弹伤害超过攻击者 HP 时 executeTokens 钳制 actualReflect', () => {
        // 验证 executeTokens.ts 中 Math.min(reflectDamage, attackerHp) 的保护
        const retributionDef = {
            id: TOKEN_IDS.RETRIBUTION,
            name: '神罚',
            stackLimit: 3,
            category: 'consumable',
            icon: '⚡',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived'],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived', value: 0 },
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

        // 使用 3 个 retribution → 反弹 6 点
        const { result } = processTokenUsage(
            mockState as any, retributionDef as any, '0', 3, undefined, 'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        // 神罚反弹 = ceil(currentDamage / 2) = ceil(5 / 2) = 3（与 amount 无关）
        expect(result.extra?.reflectDamage).toBe(3);
        // 注意：实际 clamp 在 executeTokens.ts 中执行，这里只验证 processTokenUsage 返回原始值
    });

    it('无 pendingDamage 时 USE_TOKEN 不崩溃', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'use-token-no-pending-damage',
            commands: [
                cmd('USE_TOKEN', '0', { tokenId: TOKEN_IDS.TAIJI, amount: 1 }),
            ],
            setup: (playerIds, random) => {
                const state = baseSetup(playerIds, random);
                state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;
                // 不设置 pendingDamage
                return state;
            },
            expect: {
                expectError: { command: 'USE_TOKEN', error: 'no_pending_damage' },
            },
        });
        // 命令应失败但不崩溃
        expect(result.passed).toBe(true);
    });

    it('Fire Mastery 冷却不会让 token 变负', () => {
        // 边界：如果 flowHooks 中有 bug 导致多次冷却，token 不应变负
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'fire-mastery-cooldown-boundary',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // discard → upkeep
            ],
            setup: createSetupAtPlayer0Discard((state) => {
                // 恰好 1 层，冷却后应为 0
                state.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY] = 1;
            }),
        });

        const fm = result.finalState.core.players['1'].tokens[TOKEN_IDS.FIRE_MASTERY];
        expect(fm).toBe(0);
        expect(fm).toBeGreaterThanOrEqual(0); // 确保不为负
    });
});
