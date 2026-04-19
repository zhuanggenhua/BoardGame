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
import { getNextPhase, canAdvancePhase, getPlayerOrder, getNextPlayerId, getTokenStackLimit } from '../domain/rules';
import { validateCommand } from '../domain/commandValidation';
import { resolveEffectsToEvents, type EffectContext } from '../domain/effects';
import { resolveOffensivePreDefenseEffects } from '../domain/attack';
import { shouldOpenTokenResponse } from '../domain/tokenResponse';
import { VENGEANCE_2 } from '../heroes/paladin/abilities';
import { METEOR_2, PYROMANCER_ABILITIES } from '../heroes/pyromancer/abilities';
import { CORNUCOPIA_2 } from '../heroes/shadow_thief/abilities';
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
            'setup', 'upkeep', 'income', 'main1', 'offensiveRoll', 'targetingRoll', 'defensiveRoll', 'main2', 'discard',
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

    it('4 人模式 offensiveRoll 有待结算攻击 → targetingRoll', () => {
        const core = createMockCore({
            players: {
                '0': { abilities: CHARACTER_DATA_MAP.monk.abilities } as any,
                '1': {} as any,
                '2': {} as any,
                '3': {} as any,
            },
            seatingOrder: ['0', '1', '2', '3'],
            teamIdByPlayerId: {
                '0': 'A',
                '1': 'B',
                '2': 'A',
                '3': 'B',
            },
            pendingAttack: {
                attackerId: '0',
                defenderId: undefined,
                sourceAbilityId: 'fist-technique-5',
                isDefendable: true,
            } as any,
        });
        const next = getNextPhase(core, 'offensiveRoll');
        expect(next).toBe('targetingRoll');
    });

    it('4 人模式无单一敌方目标的无伤害技能不进入 targetingRoll', () => {
        const core = createMockCore({
            players: {
                '0': { abilities: [structuredClone(VENGEANCE_2)] } as any,
                '1': {} as any,
                '2': {} as any,
                '3': {} as any,
            },
            seatingOrder: ['0', '1', '2', '3'],
            teamIdByPlayerId: {
                '0': 'A',
                '1': 'B',
                '2': 'A',
                '3': 'B',
            },
            pendingAttack: {
                attackerId: '0',
                defenderId: undefined,
                sourceAbilityId: 'vengeance-2-main',
                isDefendable: false,
            } as any,
        });
        const next = getNextPhase(core, 'offensiveRoll');
        expect(next).toBe('main2');
    });

    it('4 人模式无伤害但依赖单一敌方目标的技能也会进入 targetingRoll', () => {
        const core = createMockCore({
            players: {
                '0': { abilities: [structuredClone(CORNUCOPIA_2)] } as any,
                '1': {} as any,
                '2': {} as any,
                '3': {} as any,
            },
            seatingOrder: ['0', '1', '2', '3'],
            teamIdByPlayerId: {
                '0': 'A',
                '1': 'B',
                '2': 'A',
                '3': 'B',
            },
            pendingAttack: {
                attackerId: '0',
                defenderId: undefined,
                sourceAbilityId: 'cornucopia',
                isDefendable: false,
            } as any,
        });
        const next = getNextPhase(core, 'offensiveRoll');
        expect(next).toBe('targetingRoll');
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

    it('4 人模式起始玩家为 1 号位时仍按环桌座位敌我交替轮转', () => {
        const core = createMockCore({
            players: {
                '0': {} as any,
                '1': {} as any,
                '2': {} as any,
                '3': {} as any,
            },
            seatingOrder: ['0', '1', '2', '3'],
            teamIdByPlayerId: {
                '0': 'A',
                '1': 'B',
                '2': 'A',
                '3': 'B',
            },
            startingPlayerId: '1',
            activePlayerId: '1',
        });

        expect(getPlayerOrder(core)).toEqual(['1', '2', '3', '0']);
        expect(getNextPlayerId(core)).toBe('2');
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

describe('Property 9: 4 人玩家目标交互验证', () => {
    const createFourPlayerCore = (overrides: Partial<DiceThroneCore> = {}): DiceThroneCore => ({
        players: {
            '0': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
            '1': { statusEffects: { poison: 1 }, tokens: {}, hand: [], resources: {} } as any,
            '2': { statusEffects: {}, tokens: { crit: 1 }, hand: [], resources: {} } as any,
            '3': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
        },
        activePlayerId: '0',
        startingPlayerId: '0',
        turnNumber: 2,
        pendingAttack: null,
        selectedCharacters: { '0': 'paladin', '1': 'barbarian', '2': 'monk', '3': 'pyromancer' },
        readyPlayers: {},
        hostPlayerId: '0',
        hostStarted: true,
        dice: [],
        rollCount: 0,
        rollLimit: 3,
        rollDiceCount: 5,
        rollConfirmed: false,
        tokenDefinitions: ALL_TOKEN_DEFINITIONS,
        seatingOrder: ['0', '1', '2', '3'],
        teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
        ...overrides,
    } as DiceThroneCore);

    const createFourPlayerEffectContext = (
        state: DiceThroneCore,
        overrides: Partial<EffectContext> = {}
    ): EffectContext => ({
        attackerId: '0',
        defenderId: '1',
        sourceAbilityId: 'batch2-test',
        state,
        damageDealt: 0,
        timestamp: 123,
        ...overrides,
    });

    it('GRANT_TOKENS 只允许命中交互候选集中的玩家', () => {
        const core = createFourPlayerCore();
        const result = validateCommand(
            core,
            {
                type: 'GRANT_TOKENS',
                playerId: '0',
                payload: {
                    targetPlayerId: '3',
                    tokens: [{ tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 }],
                },
            } as any,
            'main2',
            {
                id: 'grant-retribution',
                playerId: '0',
                sourceCardId: 'vengeance',
                type: 'selectPlayer',
                titleKey: 'interaction.selectPlayerForRetribution',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0', '2'],
                tokenGrantConfig: { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
            },
        );
        expect(result.valid).toBe(false);
        expect(result.error).toBe('invalid_target_player');
    });

    it('REMOVE_STATUS 在 self-only selectStatus 交互下拒绝其他玩家', () => {
        const core = createFourPlayerCore({
            players: {
                '0': { resources: {}, statusEffects: { poison: 1 }, tokens: {} } as any,
                '1': { resources: {}, statusEffects: { burn: 1 }, tokens: {} } as any,
                '2': { resources: {}, statusEffects: {}, tokens: {} } as any,
                '3': { resources: {}, statusEffects: {}, tokens: {} } as any,
            },
        });
        const result = validateCommand(
            core,
            {
                type: 'REMOVE_STATUS',
                playerId: '0',
                payload: {
                    targetPlayerId: '1',
                    statusId: STATUS_IDS.BURN,
                },
            } as any,
            'main2',
            {
                id: 'remove-status-self',
                playerId: '0',
                sourceCardId: 'steadfast-2',
                type: 'selectStatus',
                titleKey: 'interaction.selectStatusToRemove',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0'],
            },
        );
        expect(result.valid).toBe(false);
        expect(result.error).toBe('invalid_target_player');
    });

    it('GRANT_TOKENS 在 4 人模式下允许多 token 配置授予给合法队友目标', () => {
        const core = createFourPlayerCore();
        const result = validateCommand(
            core,
            {
                type: 'GRANT_TOKENS',
                playerId: '0',
                payload: {
                    targetPlayerId: '2',
                    tokens: [
                        { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
                        { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
                        { tokenId: TOKEN_IDS.CRIT, amount: 1 },
                        { tokenId: TOKEN_IDS.ACCURACY, amount: 1 },
                    ],
                },
            } as any,
            'main2',
            {
                id: 'consecrate',
                playerId: '0',
                sourceCardId: 'card-consecrate',
                type: 'selectPlayer',
                titleKey: 'interaction.selectPlayerForConsecrate',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0', '1', '2', '3'],
                tokenGrantConfigs: [
                    { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
                    { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
                    { tokenId: TOKEN_IDS.CRIT, amount: 1 },
                    { tokenId: TOKEN_IDS.ACCURACY, amount: 1 },
                ],
            },
        );
        expect(result.valid).toBe(true);
    });

    it('GRANT_TOKENS 在 4 人模式下允许单 token 配置授予给合法队友目标', () => {
        const core = createFourPlayerCore();
        const result = validateCommand(
            core,
            {
                type: 'GRANT_TOKENS',
                playerId: '0',
                payload: {
                    targetPlayerId: '2',
                    tokens: [{ tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 }],
                },
            } as any,
            'offensiveRoll',
            {
                id: 'vengeance',
                playerId: '0',
                sourceCardId: 'vengeance',
                type: 'selectPlayer',
                titleKey: 'interaction.selectPlayerForRetribution',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0', '1', '2', '3'],
                tokenGrantConfig: { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
            },
        );
        expect(result.valid).toBe(true);
    });

    it('无默认 defender 的 4 人无伤害技能仍会执行 preDefense 交互效果', () => {
        const core = createFourPlayerCore({
            players: {
                '0': {
                    statusEffects: {},
                    tokens: {},
                    hand: [],
                    resources: {},
                    abilities: [structuredClone(VENGEANCE_2)],
                } as any,
                '1': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
                '2': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
                '3': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
            },
            pendingAttack: {
                attackerId: '0',
                defenderId: undefined,
                sourceAbilityId: 'vengeance-2-main',
                preDefenseResolved: false,
                isDefendable: false,
            } as any,
        });

        const events = resolveOffensivePreDefenseEffects(core, undefined, 123);
        const interactionEvent = events.find((event) => event.type === 'INTERACTION_REQUESTED') as any;
        const resolvedEvent = events.find((event) => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED') as any;

        expect(interactionEvent).toBeTruthy();
        expect(interactionEvent.payload.interaction.type).toBe('selectPlayer');
        expect(interactionEvent.payload.interaction.targetPlayerIds).toEqual(['0', '1', '2', '3']);
        expect(interactionEvent.payload.interaction.tokenGrantConfig).toEqual({
            tokenId: TOKEN_IDS.RETRIBUTION,
            amount: 1,
        });
        expect(resolvedEvent).toBeTruthy();
        expect(resolvedEvent.payload.defenderId).toBeUndefined();
    });

    it('TRANSFER_STATUS 禁止把状态或 token 转移回来源玩家自己', () => {
        const core = createFourPlayerCore();
        const result = validateCommand(
            core,
            {
                type: 'TRANSFER_STATUS',
                playerId: '0',
                payload: {
                    fromPlayerId: '2',
                    toPlayerId: '2',
                    statusId: TOKEN_IDS.CRIT,
                },
            } as any,
            'main2',
            {
                id: 'transfer-status',
                playerId: '0',
                sourceCardId: 'card-transfer-status',
                type: 'selectTargetStatus',
                titleKey: 'interaction.selectStatusToTransfer',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0', '1', '2', '3'],
                transferConfig: {
                    sourcePlayerId: '2',
                    statusId: TOKEN_IDS.CRIT,
                },
            },
        );
        expect(result.valid).toBe(false);
        expect(result.error).toBe('invalid_target_player');
    });

    it('TRANSFER_STATUS 在在线双阶段 UI 的 selectStatus 权威态下仍允许合法 4 人 token 转移', () => {
        const core = createFourPlayerCore({
            players: {
                '0': { resources: {}, statusEffects: {}, tokens: {} } as any,
                '1': { resources: {}, statusEffects: {}, tokens: { [TOKEN_IDS.CRIT]: 1 } } as any,
                '2': { resources: {}, statusEffects: {}, tokens: {} } as any,
                '3': { resources: {}, statusEffects: {}, tokens: {} } as any,
            },
        });
        const result = validateCommand(
            core,
            {
                type: 'TRANSFER_STATUS',
                playerId: '0',
                payload: {
                    fromPlayerId: '1',
                    toPlayerId: '2',
                    statusId: TOKEN_IDS.CRIT,
                },
            } as any,
            'main2',
            {
                id: 'transfer-status-live',
                playerId: '0',
                sourceCardId: 'card-transfer-status',
                type: 'selectStatus',
                titleKey: 'interaction.selectStatusToTransfer',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0', '1', '2', '3'],
                transferConfig: {},
            },
        );
        expect(result.valid).toBe(true);
    });

    it('Meteor 的 collateral 在 4 人 / 2v2 下只命中敌方集合', () => {
        const core = createFourPlayerCore();
        const meteor = PYROMANCER_ABILITIES.find((ability) => ability.id === 'meteor');
        const collateralEffect = meteor?.effects[2];
        expect(collateralEffect).toBeDefined();

        const events = resolveEffectsToEvents(
            [collateralEffect!],
            'withDamage',
            createFourPlayerEffectContext(core, { sourceAbilityId: 'meteor' }),
        );

        const damageTargets = events
            .filter((event) => event.type === 'DAMAGE_DEALT')
            .map((event: any) => event.payload.targetId);

        expect(damageTargets).toEqual(['1', '3']);
        expect(damageTargets).not.toContain('2');
    });

    it('Meteor II 的 collateral 在 4 人 / 2v2 下只命中敌方集合', () => {
        const core = createFourPlayerCore();
        const collateralEffect = METEOR_2.variants?.find((variant) => variant.id === 'meteor-2')?.effects[2];
        expect(collateralEffect).toBeDefined();

        const events = resolveEffectsToEvents(
            [collateralEffect!],
            'withDamage',
            createFourPlayerEffectContext(core, { sourceAbilityId: 'meteor-2' }),
        );

        const damageTargets = events
            .filter((event) => event.type === 'DAMAGE_DEALT')
            .map((event: any) => event.payload.targetId);

        expect(damageTargets).toEqual(['1', '3']);
        expect(damageTargets).not.toContain('2');
    });

    it('Ultimate Inferno 的 collateral 在 4 人 / 2v2 下只命中敌方集合', () => {
        const core = createFourPlayerCore();
        const ultimateInferno = PYROMANCER_ABILITIES.find((ability) => ability.id === 'ultimate-inferno');
        const collateralEffect = ultimateInferno?.effects[4];
        expect(collateralEffect).toBeDefined();

        const events = resolveEffectsToEvents(
            [collateralEffect!],
            'withDamage',
            createFourPlayerEffectContext(core, { sourceAbilityId: 'ultimate-inferno' }),
        );

        const damageTargets = events
            .filter((event) => event.type === 'DAMAGE_DEALT')
            .map((event: any) => event.payload.targetId);

        expect(damageTargets).toEqual(['1', '3']);
        expect(damageTargets).not.toContain('2');
    });

    it('Soul Burn 在 4 人 / 2v2 下只命中当前 defender', () => {
        const core = createFourPlayerCore({
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'soul-burn',
                attackDiceFaceCounts: {
                    [TOKEN_IDS.FIRE_MASTERY]: 0,
                    [STATUS_IDS.BURN]: 0,
                    fiery_soul: 2,
                } as any,
            } as any,
        });
        const soulBurn = PYROMANCER_ABILITIES.find((ability) => ability.id === 'soul-burn');
        const damageEffect = soulBurn?.effects[1];
        expect(damageEffect).toBeDefined();

        const events = resolveEffectsToEvents(
            [damageEffect!],
            'withDamage',
            createFourPlayerEffectContext(core, { sourceAbilityId: 'soul-burn' }),
        );

        const damageTargets = events
            .filter((event) => event.type === 'DAMAGE_DEALT')
            .map((event: any) => event.payload.targetId);

        expect(damageTargets).toEqual(['1']);
        expect(damageTargets).not.toContain('2');
        expect(damageTargets).not.toContain('3');
    });

    it('REMOVE_STATUS 在 requiresTargetWithStatus=true 时拒绝空目标', () => {
        const core = createFourPlayerCore();
        const result = validateCommand(
            core,
            {
                type: 'REMOVE_STATUS',
                playerId: '0',
                payload: {
                    targetPlayerId: '3',
                },
            } as any,
            'main2',
            {
                id: 'remove-all-status',
                playerId: '0',
                sourceCardId: 'card-what-status',
                type: 'selectPlayer',
                titleKey: 'interaction.selectPlayerToRemoveAllStatus',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0', '1', '2', '3'],
                requiresTargetWithStatus: true,
            },
        );
        expect(result.valid).toBe(false);
        expect(result.error).toBe('target_has_no_status');
    });
});
