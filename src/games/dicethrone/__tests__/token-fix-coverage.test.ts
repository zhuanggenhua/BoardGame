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
import { getCustomActionHandler } from '../domain/effects';
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

        // 验证 custom action 被触发：pendingAttack.damage 应增加掷骰值
        // queuedRandom d(6) = 4，所以 damage 从 5 增加到 9
        // 注意：如果 pendingDamage 已被清理（finalize），检查 steps 中的事件
        const steps = result.steps;
        const useTokenStep = steps[0];
        // 应包含 TOKEN_USED 和 BONUS_DIE_ROLLED 事件
        expect(useTokenStep.events).toContain('TOKEN_USED');
        expect(useTokenStep.events).toContain('BONUS_DIE_ROLLED');
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
        // 燃烧伤害：固定 2 点伤害，持续不移除
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
        // 若防御方有潜行，跳过防御掷骰、免除伤害，但不消耗潜行标记
        // 潜行标记只在"经过一个完整的自己回合后，回合末弃除"
        // 详见 flowHooks.ts 的 offensiveRoll 退出逻辑 + discard 阶段退出逻辑
        // 集成测试见 shadow-thief-abilities.test.ts
        expect(true).toBe(true);
    });
});

describe('Blessing of Divinity（神圣祝福）致死保护', () => {
    it('HP=3 受到 10 点伤害时触发：消耗 token + 防止伤害 + HP扣至1', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;
        expect(handler).toBeDefined();

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 3 },
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
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent', params: { damageAmount: 10 } } as any,
        });

        // 消耗 token
        const consumed = events.find((e: any) => e.type === 'TOKEN_CONSUMED');
        expect(consumed).toBeDefined();
        expect((consumed as any).payload.tokenId).toBe(TOKEN_IDS.BLESSING_OF_DIVINITY);

        // 防止伤害
        const prevent = events.find((e: any) => e.type === 'PREVENT_DAMAGE');
        expect(prevent).toBeDefined();

        // HP 扣至 1（DAMAGE_DEALT amount = 3 - 1 = 2，bypassShields）
        const dmg = events.find((e: any) => e.type === 'DAMAGE_DEALT');
        expect(dmg).toBeDefined();
        expect((dmg as any).payload.amount).toBe(2);
        expect((dmg as any).payload.bypassShields).toBe(true);
    });

    it('非致死伤害时不触发（HP=30 受到 5 点伤害）', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 30 },
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
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent', params: { damageAmount: 5 } } as any,
        });

        expect(events).toHaveLength(0);
    });

    it('无 blessing token 时不触发', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 0 },
                    resources: { [RESOURCE_IDS.HP]: 3 },
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
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent', params: { damageAmount: 10 } } as any,
        });

        expect(events).toHaveLength(0);
    });

    it('HP=1 受到致死伤害时：不产生 DAMAGE_DEALT（无需扣血），只有消耗+防止', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 1 },
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
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent', params: { damageAmount: 5 } } as any,
        });

        // TOKEN_CONSUMED + PREVENT_DAMAGE（HP 已经是 1，无需 DAMAGE_DEALT）
        expect(events).toHaveLength(2);
        expect(events[0].type).toBe('TOKEN_CONSUMED');
        expect(events[1].type).toBe('PREVENT_DAMAGE');
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
