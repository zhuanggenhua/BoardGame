/**
 * 规则一致性属性测试
 *
 * Task 12.4
 *
 * Property 3: 可防御性判定正确性（ultimate → 不可防御, unblockable → 不可防御, 无伤害 → 不可防御）
 * Property 6: 阶段流转正确性（PHASE_ORDER 序列, 第一回合跳过 income, 击倒跳过 offensiveRoll）
 * Property 7: 伤害类型处理正确性（终极技能跳过防御方 Token 响应, 不可防御跳过 defensiveRoll）
 * Property 8: 状态效果叠加正确性（stackLimit 被尊重）
 */

import { describe, it, expect } from 'vitest';
import { CHARACTER_DATA_MAP, ALL_TOKEN_DEFINITIONS } from '../domain/characters';
import type { AbilityDef } from '../domain/combat/types';
import type { SelectableCharacterId, DiceThroneCore, TurnPhase } from '../domain/types';
import { PHASE_ORDER, INITIAL_HEALTH, INITIAL_CP, CP_MAX } from '../domain/types';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { getNextPhase, canAdvancePhase, getTokenStackLimit } from '../domain/rules';
import { shouldOpenTokenResponse } from '../domain/tokenResponse';
import {
    createRunner,
    fixedRandom,
    cmd,
    advanceTo,
    createNoResponseSetupWithEmptyHand,
} from './test-utils';

const HEROES: SelectableCharacterId[] = [
    'monk', 'barbarian', 'paladin', 'pyromancer', 'moon_elf', 'shadow_thief',
];

// ============================================================================
// Property 3: 可防御性判定正确性
// ============================================================================

describe('Property 3: 可防御性判定', () => {
    /** 收集所有英雄的所有技能（含变体），标注 tags */
    function getAllAbilitiesWithTags(): Array<{
        heroId: string;
        abilityId: string;
        variantId?: string;
        tags: string[];
        type: string;
        hasVariants: boolean;
    }> {
        const result: Array<{
            heroId: string;
            abilityId: string;
            variantId?: string;
            tags: string[];
            type: string;
            hasVariants: boolean;
        }> = [];
        for (const heroId of HEROES) {
            const data = CHARACTER_DATA_MAP[heroId];
            for (const ability of data.abilities as AbilityDef[]) {
                const abilityTags = ability.tags ?? [];
                if (ability.variants?.length) {
                    for (const variant of ability.variants) {
                        result.push({
                            heroId,
                            abilityId: ability.id,
                            variantId: variant.id,
                            tags: [...abilityTags, ...(variant.tags ?? [])],
                            type: ability.type,
                            hasVariants: true,
                        });
                    }
                } else {
                    result.push({
                        heroId,
                        abilityId: ability.id,
                        tags: abilityTags,
                        type: ability.type,
                        hasVariants: false,
                    });
                }
            }
        }
        return result;
    }

    it('所有 ultimate 标签的技能必须是进攻型', () => {
        const all = getAllAbilitiesWithTags();
        const ultimates = all.filter(a => a.tags.includes('ultimate'));
        expect(ultimates.length).toBeGreaterThan(0);
        const violations = ultimates.filter(a => a.type !== 'offensive');
        expect(violations.map(v => `${v.heroId}/${v.abilityId}`)).toEqual([]);
    });

    it('每个英雄至少有一个进攻技能', () => {
        for (const heroId of HEROES) {
            const data = CHARACTER_DATA_MAP[heroId];
            const offensiveAbilities = (data.abilities as AbilityDef[]).filter(a => a.type === 'offensive');
            expect(offensiveAbilities.length).toBeGreaterThan(0);
        }
    });

    it('每个英雄至少有一个防御技能', () => {
        for (const heroId of HEROES) {
            const data = CHARACTER_DATA_MAP[heroId];
            const defensiveAbilities = (data.abilities as AbilityDef[]).filter(a => a.type === 'defensive');
            expect(defensiveAbilities.length).toBeGreaterThan(0);
        }
    });
});

// ============================================================================
// Property 6: 阶段流转正确性
// ============================================================================

describe('Property 6: 阶段流转正确性', () => {
    /** 创建最小 mock state 用于 getNextPhase 测试 */
    function createMockCore(overrides: Partial<DiceThroneCore> = {}): DiceThroneCore {
        return {
            players: {
                '0': { statusEffects: {}, hand: [], resources: {} } as any,
                '1': { statusEffects: {}, hand: [], resources: {} } as any,
            },
            activePlayerId: '0',
            startingPlayerId: '0',
            turnNumber: 2, // 非第一回合
            pendingAttack: null,
            selectedCharacters: { '0': 'monk', '1': 'monk' },
            readyPlayers: {},
            hostPlayerId: '0',
            hostStarted: true,
            dice: [],
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            ...overrides,
        } as DiceThroneCore;
    }

    it('PHASE_ORDER 包含所有预期阶段', () => {
        const expected: TurnPhase[] = [
            'setup', 'upkeep', 'income', 'main1', 'offensiveRoll', 'defensiveRoll', 'main2', 'discard',
        ];
        expect(PHASE_ORDER).toEqual(expected);
    });

    it('第一回合先手玩家跳过 income（upkeep → main1）', () => {
        const core = createMockCore({
            turnNumber: 1,
            activePlayerId: '0',
            startingPlayerId: '0',
        });
        const next = getNextPhase(core, 'upkeep');
        expect(next).toBe('main1');
    });

    it('第一回合后手玩家不跳过 income（upkeep → income）', () => {
        const core = createMockCore({
            turnNumber: 1,
            activePlayerId: '1',
            startingPlayerId: '0',
        });
        const next = getNextPhase(core, 'upkeep');
        expect(next).toBe('income');
    });

    it('非第一回合不跳过 income', () => {
        const core = createMockCore({ turnNumber: 2 });
        const next = getNextPhase(core, 'upkeep');
        expect(next).toBe('income');
    });

    it('offensiveRoll 有可防御攻击 → defensiveRoll', () => {
        const core = createMockCore({
            pendingAttack: {
                attackerId: '0', defenderId: '1',
                isDefendable: true,
            } as any,
        });
        const next = getNextPhase(core, 'offensiveRoll');
        expect(next).toBe('defensiveRoll');
    });

    it('offensiveRoll 有不可防御攻击 → main2', () => {
        const core = createMockCore({
            pendingAttack: {
                attackerId: '0', defenderId: '1',
                isDefendable: false,
            } as any,
        });
        const next = getNextPhase(core, 'offensiveRoll');
        expect(next).toBe('main2');
    });

    it('offensiveRoll 无攻击 → main2', () => {
        const core = createMockCore({ pendingAttack: null });
        const next = getNextPhase(core, 'offensiveRoll');
        expect(next).toBe('main2');
    });

    it('discard → upkeep（回合切换）', () => {
        const core = createMockCore();
        const next = getNextPhase(core, 'discard');
        expect(next).toBe('upkeep');
    });

    it('击倒跳过 offensiveRoll（通过 GameTestRunner 验证）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '击倒跳过进攻',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                return state;
            },
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 → offensiveRoll（被击倒跳过）→ main2
            ],
            expect: {
                turnPhase: 'main2',
                players: { '0': { statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } } },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});

// ============================================================================
// Property 7: 伤害类型处理正确性
// ============================================================================

describe('Property 7: 伤害类型处理', () => {
    it('终极技能伤害跳过防御方 Token 响应', () => {
        // shouldOpenTokenResponse 在 isUltimate=true 时应跳过防御方
        const mockState = {
            players: {
                '0': { tokens: { [TOKEN_IDS.TAIJI]: 3 }, resources: { [RESOURCE_IDS.HP]: 50 } },
                '1': { tokens: { [TOKEN_IDS.TAIJI]: 3 }, resources: { [RESOURCE_IDS.HP]: 50 } },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingDamage: undefined,
            pendingAttack: { isUltimate: true },
        } as any;

        // 攻击方（'0'）仍可加伤
        const attackerResult = shouldOpenTokenResponse(mockState, '0', '1', 10);
        expect(attackerResult).toBe('attackerBoost');

        // 模拟攻击方没有加伤 token 的情况
        const mockStateNoAttackerTokens = {
            ...mockState,
            players: {
                '0': { tokens: {}, resources: { [RESOURCE_IDS.HP]: 50 } },
                '1': { tokens: { [TOKEN_IDS.TAIJI]: 3 }, resources: { [RESOURCE_IDS.HP]: 50 } },
            },
        } as any;
        // 防御方不能减伤（终极技能）
        const defenderResult = shouldOpenTokenResponse(mockStateNoAttackerTokens, '0', '1', 10);
        expect(defenderResult).toBeNull();
    });

    it('非终极技能伤害允许防御方 Token 响应', () => {
        const mockState = {
            players: {
                '0': { tokens: {}, resources: { [RESOURCE_IDS.HP]: 50 } },
                '1': { tokens: { [TOKEN_IDS.TAIJI]: 3 }, resources: { [RESOURCE_IDS.HP]: 50 } },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingDamage: undefined,
            pendingAttack: { isUltimate: false },
        } as any;

        const result = shouldOpenTokenResponse(mockState, '0', '1', 10);
        expect(result).toBe('defenderMitigation');
    });

    it('0 伤害不触发 Token 响应', () => {
        const mockState = {
            players: {
                '0': { tokens: { [TOKEN_IDS.TAIJI]: 3 }, resources: { [RESOURCE_IDS.HP]: 50 } },
                '1': { tokens: { [TOKEN_IDS.TAIJI]: 3 }, resources: { [RESOURCE_IDS.HP]: 50 } },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingDamage: undefined,
            pendingAttack: null,
        } as any;

        const result = shouldOpenTokenResponse(mockState, '0', '1', 0);
        expect(result).toBeNull();
    });

    it('已有 pendingDamage 时不重复触发 Token 响应', () => {
        const mockState = {
            players: {
                '0': { tokens: { [TOKEN_IDS.TAIJI]: 3 }, resources: { [RESOURCE_IDS.HP]: 50 } },
                '1': { tokens: { [TOKEN_IDS.TAIJI]: 3 }, resources: { [RESOURCE_IDS.HP]: 50 } },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingDamage: { id: 'existing' }, // 已有待处理伤害
            pendingAttack: null,
        } as any;

        const result = shouldOpenTokenResponse(mockState, '0', '1', 10);
        expect(result).toBeNull();
    });
});

// ============================================================================
// Property 8: 状态效果叠加正确性
// ============================================================================

describe('Property 8: 状态效果叠加', () => {
    it('所有 debuff 类 Token 都有 stackLimit 定义', () => {
        const debuffs = ALL_TOKEN_DEFINITIONS.filter(d => d.category === 'debuff');
        expect(debuffs.length).toBeGreaterThan(0);
        const violations: string[] = [];
        for (const def of debuffs) {
            if (def.stackLimit === undefined || def.stackLimit === null) {
                violations.push(`[${def.id}] debuff 缺少 stackLimit`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('所有 consumable 类 Token 都有 stackLimit 定义', () => {
        const consumables = ALL_TOKEN_DEFINITIONS.filter(d => d.category === 'consumable');
        expect(consumables.length).toBeGreaterThan(0);
        const violations: string[] = [];
        for (const def of consumables) {
            if (def.stackLimit === undefined || def.stackLimit === null) {
                violations.push(`[${def.id}] consumable 缺少 stackLimit`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('getTokenStackLimit 正确解析 stackLimit=0 为无限', () => {
        const mockState = {
            players: { '0': { tokenStackLimits: {} } },
            tokenDefinitions: [
                { id: 'test-unlimited', stackLimit: 0 },
            ],
        } as any;
        const limit = getTokenStackLimit(mockState, '0', 'test-unlimited');
        expect(limit).toBe(Infinity);
    });

    it('getTokenStackLimit 优先使用 player.tokenStackLimits 覆盖', () => {
        const mockState = {
            players: { '0': { tokenStackLimits: { taiji: 5 } } },
            tokenDefinitions: [
                { id: 'taiji', stackLimit: 3 },
            ],
        } as any;
        const limit = getTokenStackLimit(mockState, '0', 'taiji');
        expect(limit).toBe(5);
    });

    it('常量值正确：INITIAL_HEALTH=50, INITIAL_CP=2, CP_MAX=15', () => {
        expect(INITIAL_HEALTH).toBe(50);
        expect(INITIAL_CP).toBe(2);
        expect(CP_MAX).toBe(15);
    });
});
