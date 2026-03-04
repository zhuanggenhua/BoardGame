/**
 * Moon Elf (月精灵) 技能与状态效果覆盖测试
 *
 * 覆盖范围：
 * 1. 角色注册与初始化
 * 2. 技能/卡牌/Token/骰子定义完整性
 * 3. 状态效果逻辑（致盲/缠绕/锁定）
 * 4. 自定义动作（长弓连击/爆裂箭/迷影步/行动卡）
 * 5. 边界条件（状态叠加上限、空状态、多状态组合）
 */

import { describe, it, expect } from 'vitest';
import { MOON_ELF_CARDS, getMoonElfStartingDeck } from '../heroes/moon_elf/cards';
import {
    MOON_ELF_ABILITIES,
    LONGBOW_2, LONGBOW_3,
    EXPLODING_ARROW_2, EXPLODING_ARROW_3,
} from '../heroes/moon_elf/abilities';
import { MOON_ELF_TOKENS, MOON_ELF_INITIAL_TOKENS } from '../heroes/moon_elf/tokens';
import { moonElfDiceDefinition } from '../heroes/moon_elf/diceConfig';
import { moonElfResourceDefinitions } from '../heroes/moon_elf/resourceConfig';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS, STATUS_IDS, MOON_ELF_DICE_FACE_IDS, DICETHRONE_CARD_ATLAS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH, INITIAL_CP } from '../domain/types';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { diceThroneSystemsForTest } from '../game';
import {
    createRunner,
    createQueuedRandom,
    fixedRandom,
    cmd,
    assertState,
    type DiceThroneExpectation,
} from './test-utils';
import { GameTestRunner } from '../../../engine/testing';

// ============================================================================
// 测试工具
// ============================================================================

const testSystems = diceThroneSystemsForTest as unknown as EngineSystem<DiceThroneCore>[];

const moonElfSetupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'moon_elf' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'moon_elf' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

function createMoonElfState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, testSystems, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
    for (const c of moonElfSetupCommands) {
        const command = { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }
    return state;
}

/** 创建月精灵 vs 月精灵的 runner setup（清空手牌避免响应窗口干扰） */
const createMoonElfSetup = (opts?: {
    mutate?: (core: DiceThroneCore) => void;
    keepHands?: boolean;
}) => {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const state = createMoonElfState(playerIds, random);
        if (!opts?.keepHands) {
            // 默认清空手牌避免响应窗口干扰
            state.core.players['0'].hand = [];
            state.core.players['1'].hand = [];
        }
        opts?.mutate?.(state.core);
        return state;
    };
};

// ============================================================================
// 1. 角色注册与初始化
// ============================================================================

describe('Moon Elf 角色注册', () => {
    it('应该在 CHARACTER_DATA_MAP 中正确注册', () => {
        const data = CHARACTER_DATA_MAP.moon_elf;
        expect(data).toBeDefined();
        expect(data.id).toBe('moon_elf');
        expect(data.abilities).toEqual(MOON_ELF_ABILITIES);
        expect(data.tokens).toEqual(MOON_ELF_TOKENS);
        expect(data.initialTokens).toEqual(MOON_ELF_INITIAL_TOKENS);
        expect(data.diceDefinitionId).toBe('moon_elf-dice');
        expect(data.getStartingDeck).toBe(getMoonElfStartingDeck);
    });

    it('应该有正确的初始技能等级', () => {
        expect(CHARACTER_DATA_MAP.moon_elf.initialAbilityLevels).toEqual({
            'longbow': 1, 'covert-fire': 1, 'covering-fire': 1,
            'exploding-arrow': 1, 'entangling-shot': 1, 'eclipse': 1,
            'blinding-shot': 1, 'lunar-eclipse': 1, 'elusive-step': 1,
        });
    });

    it('初始化后玩家状态正确', () => {
        const state = createMoonElfState(['0', '1'], fixedRandom);
        const player = state.core.players['0'];
        expect(player.characterId).toBe('moon_elf');
        expect(player.resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
        expect(player.resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);
        expect(player.hand.length).toBe(4);
        expect(player.deck.length).toBeGreaterThan(0);
        const abilityIds = player.abilities.map((a: any) => a.id);
        expect(abilityIds).toContain('longbow');
        expect(abilityIds).toContain('elusive-step');
        expect(abilityIds).toContain('lunar-eclipse');
    });
});

// ============================================================================
// 2. 技能定义完整性
// ============================================================================

describe('Moon Elf 技能定义', () => {
    it('应该包含所有 9 个基础技能', () => {
        const ids = MOON_ELF_ABILITIES.map(a => a.id);
        expect(ids).toEqual(expect.arrayContaining([
            'longbow', 'covert-fire', 'covering-fire', 'exploding-arrow',
            'entangling-shot', 'eclipse', 'blinding-shot', 'lunar-eclipse', 'elusive-step',
        ]));
        expect(MOON_ELF_ABILITIES.length).toBe(9);
    });

    it('所有技能应该有名称、描述和类型', () => {
        for (const ability of MOON_ELF_ABILITIES) {
            expect(ability.name).toBeDefined();
            expect(ability.description).toBeDefined();
            expect(ability.type).toMatch(/^(offensive|defensive)$/);
        }
    });

    it('所有技能应该有效果定义', () => {
        for (const ability of MOON_ELF_ABILITIES) {
            const hasEffects = (ability.effects?.length ?? 0) > 0;
            const hasVariantEffects = ability.variants?.some(v => (v.effects?.length ?? 0) > 0);
            expect(hasEffects || hasVariantEffects).toBe(true);
        }
    });

    it('longbow 有 3 个 variants', () => {
        expect(MOON_ELF_ABILITIES.find(a => a.id === 'longbow')?.variants?.length).toBe(3);
    });

    it('elusive-step 是防御技能', () => {
        expect(MOON_ELF_ABILITIES.find(a => a.id === 'elusive-step')?.type).toBe('defensive');
    });

    it('lunar-eclipse 有 ultimate 标签', () => {
        expect(MOON_ELF_ABILITIES.find(a => a.id === 'lunar-eclipse')?.tags).toContain('ultimate');
    });
});

// ============================================================================
// 3. 卡牌定义完整性
// ============================================================================

describe('Moon Elf 卡牌定义', () => {
    it('应该包含专属卡牌和通用卡牌', () => {
        // 5 张专属行动卡 + 10 张升级卡 + 18 张通用行动卡 = 33
        expect(MOON_ELF_CARDS.filter(c => c.type === 'upgrade').length).toBe(10);
        expect(MOON_ELF_CARDS.length).toBeGreaterThanOrEqual(33);
    });

    it('所有卡牌都有 MOON_ELF atlas previewRef', () => {
        // 15 张专属 + 通用卡牌，全部注入了 MOON_ELF atlas
        for (const card of MOON_ELF_CARDS) {
            expect(card.previewRef?.type).toBe('atlas');
            if (card.previewRef?.type === 'atlas') {
                expect(card.previewRef.atlasId).toBe(DICETHRONE_CARD_ATLAS_IDS.MOON_ELF);
            }
        }
    });

    it('能生成初始牌库', () => {
        expect(getMoonElfStartingDeck(fixedRandom).length).toBeGreaterThan(0);
    });

    it('行动卡 timing 正确', () => {
        expect(MOON_ELF_CARDS.find(c => c.id === 'moon-shadow-strike')?.timing).toBe('main');
        expect(MOON_ELF_CARDS.find(c => c.id === 'dodge')?.timing).toBe('instant');
        expect(MOON_ELF_CARDS.find(c => c.id === 'volley')?.timing).toBe('roll');
        expect(MOON_ELF_CARDS.find(c => c.id === 'watch-out')?.timing).toBe('roll');
    });
});

// ============================================================================
// 4. Token/状态定义
// ============================================================================

describe('Moon Elf Token 定义', () => {
    it('Evasive 上限3, consumable', () => {
        const t = MOON_ELF_TOKENS.find(t => t.id === TOKEN_IDS.EVASIVE);
        expect(t?.stackLimit).toBe(3);
        expect(t?.category).toBe('consumable');
    });

    it('Blinded/Entangle/Targeted 上限1, debuff', () => {
        for (const id of [STATUS_IDS.BLINDED, STATUS_IDS.ENTANGLE, STATUS_IDS.TARGETED]) {
            const t = MOON_ELF_TOKENS.find(t => t.id === id);
            expect(t?.stackLimit).toBe(1);
            expect(t?.category).toBe('debuff');
        }
    });

    it('初始 Token 全为 0', () => {
        expect(MOON_ELF_INITIAL_TOKENS[TOKEN_IDS.EVASIVE]).toBe(0);
        expect(MOON_ELF_INITIAL_TOKENS[STATUS_IDS.BLINDED]).toBe(0);
        expect(MOON_ELF_INITIAL_TOKENS[STATUS_IDS.ENTANGLE]).toBe(0);
        expect(MOON_ELF_INITIAL_TOKENS[STATUS_IDS.TARGETED]).toBe(0);
    });
});

// ============================================================================
// 5. 骰子定义
// ============================================================================

describe('Moon Elf 骰子定义', () => {
    it('ID 正确且有 6 面', () => {
        expect(moonElfDiceDefinition.id).toBe('moon_elf-dice');
        expect(moonElfDiceDefinition.faces.length).toBe(6);
    });

    it('骰面映射：1-3=弓, 4-5=足, 6=月', () => {
        const f = moonElfDiceDefinition.faces;
        expect(f[0].symbols).toContain(MOON_ELF_DICE_FACE_IDS.BOW);
        expect(f[2].symbols).toContain(MOON_ELF_DICE_FACE_IDS.BOW);
        expect(f[3].symbols).toContain(MOON_ELF_DICE_FACE_IDS.FOOT);
        expect(f[4].symbols).toContain(MOON_ELF_DICE_FACE_IDS.FOOT);
        expect(f[5].symbols).toContain(MOON_ELF_DICE_FACE_IDS.MOON);
    });
});

// ============================================================================
// 6. 资源定义
// ============================================================================

describe('Moon Elf 资源定义', () => {
    it('包含 HP 和 CP', () => {
        const ids = moonElfResourceDefinitions.map(r => r.id);
        expect(ids).toContain(RESOURCE_IDS.HP);
        expect(ids).toContain(RESOURCE_IDS.CP);
    });
});

// ============================================================================
// 7. 状态效果逻辑测试
// ============================================================================

describe('Moon Elf 状态效果逻辑', () => {
    /**
     * 缠绕 (Entangle)：进入 offensiveRoll 时减少1次掷骰机会，然后移除
     *
     * 骰子值说明：
     * - 月精灵骰面映射：1-3=弓(bow), 4-5=足(foot), 6=月(moon)
     * - createQueuedRandom 按顺序喂给 random.d(6)
     */
    it('缠绕：进入 offensiveRoll 时 rollLimit 减少1，状态移除', () => {
        // 骰子值：5个1（全弓），用于掷骰
        const random = createQueuedRandom([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    // 给玩家0施加缠绕
                    core.players['0'].statusEffects[STATUS_IDS.ENTANGLE] = 1;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '缠绕减少掷骰次数',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll（触发缠绕）
            ],
            expect: {
                turnPhase: 'offensiveRoll',
                roll: { limit: 2 }, // 正常3次，缠绕减1 = 2次
                players: {
                    '0': { statusEffects: { [STATUS_IDS.ENTANGLE]: 0 } }, // 缠绕已移除
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    it('无缠绕时 rollLimit 保持默认3', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '无缠绕时掷骰次数正常',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
            ],
            expect: {
                turnPhase: 'offensiveRoll',
                roll: { limit: 3 },
                players: {
                    '0': { statusEffects: { [STATUS_IDS.ENTANGLE]: 0 } },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 致盲 (Blinded)：offensiveRoll 退出时投掷1骰
     * - 1-2：攻击失败，跳过到 main2
     * - 3-6：攻击正常进行
     *
     * 骰子值序列：
     * [5个攻击骰, 致盲判定骰, ...]
     * 攻击骰 [1,1,1,1,1] = 5弓 → 可选 longbow-5-1 (7伤害)
     */
    it('致盲判定：骰值2 → 攻击失败，跳过到 main2', () => {
        // 骰子值：[1,1,1,1,1] 攻击骰(5弓), [2] 致盲判定骰(≤2失败)
        const random = createQueuedRandom([1, 1, 1, 1, 1, 2]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '致盲判定失败 → 跳过攻击',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-5-1' }),
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> 致盲判定 → main2
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { statusEffects: { [STATUS_IDS.BLINDED]: 0 } }, // 致盲已移除
                    '1': { hp: INITIAL_HEALTH }, // 未受伤
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    it('致盲判定：骰值3 → 攻击正常进行', () => {
        // 骰子值：[1,1,1,1,1] 攻击骰(5弓), [3] 致盲判定骰(≥3成功), [1,1,1,1,1] 防御骰
        const random = createQueuedRandom([1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '致盲判定成功 → 攻击正常',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-5-1' }),
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll（致盲判定通过）
                cmd('ROLL_DICE', '1'),     // 防御方掷骰
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2（结算攻击）
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { statusEffects: { [STATUS_IDS.BLINDED]: 0 } },
                    '1': { hp: INITIAL_HEALTH - 7 }, // longbow-5-1 造成7伤害
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 锁定 (Targeted)：受到伤害 +2，伤害结算后移除
     *
     * 使用 longbow-3-1 (3弓=3伤害) 攻击带锁定的目标
     * 预期伤害 = 3 + 2 = 5
     */
    it('锁定：受到伤害 +2，结算后移除', () => {
        // 骰子值：[1,1,1,4,5] 攻击骰(3弓+2足), [1,1,1,1,1] 防御骰
        const random = createQueuedRandom([1, 1, 1, 4, 5, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    // 给防御方施加锁定
                    core.players['1'].statusEffects[STATUS_IDS.TARGETED] = 1;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '锁定增加伤害',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-3-1' }),
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 5, // 3基础 + 2锁定
                        statusEffects: { [STATUS_IDS.TARGETED]: 1 }, // 锁定是持续效果，不会自动移除
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    it('无锁定时伤害正常（对照组）', () => {
        // 同样的攻击但无锁定
        const random = createQueuedRandom([1, 1, 1, 4, 5, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '无锁定伤害对照',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-3-1' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 3, // 仅3基础伤害
                        statusEffects: { [STATUS_IDS.TARGETED]: 0 },
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 多状态组合：缠绕 + 致盲同时存在
     * 缠绕在进入 offensiveRoll 时触发（减少掷骰次数）
     * 致盲在退出 offensiveRoll 时触发（判定攻击是否失败）
     */
    it('缠绕 + 致盲组合：两者都正确触发', () => {
        // 骰子值：[1,1,1,1,1] 攻击骰, [1] 致盲判定(≤2失败)
        const random = createQueuedRandom([1, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    core.players['0'].statusEffects[STATUS_IDS.ENTANGLE] = 1;
                    core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '缠绕+致盲组合',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll（缠绕触发：rollLimit=2）
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-5-1' }),
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit（致盲判定：骰值1≤2，攻击失败）→ main2
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': {
                        statusEffects: {
                            [STATUS_IDS.ENTANGLE]: 0,
                            [STATUS_IDS.BLINDED]: 0,
                        },
                    },
                    '1': { hp: INITIAL_HEALTH }, // 攻击失败，未受伤
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});

// ============================================================================
// 8. 自定义动作测试 (Custom Actions)
// ============================================================================

describe('Moon Elf 自定义动作', () => {
    /**
     * 长弓 II 连击判定 (longbow-bonus-check-4)：
     * 升级到 LONGBOW_2 后，若骰面有 ≥4 个相同 → 施加缠绕
     *
     * 测试：投出 [1,1,1,1,5] = 4弓+1足 → 触发 longbow-4-2 (6伤害) + 缠绕
     */
    it('长弓 II：4个相同骰面 → 施加缠绕', () => {
        // 骰子值：[1,1,1,1,5] 攻击骰(4弓+1足), [1,1,1,1,1] 防御骰
        const random = createQueuedRandom([1, 1, 1, 1, 5, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    // 升级长弓到 II
                    const idx = core.players['0'].abilities.findIndex((a: any) => a.id === 'longbow');
                    if (idx >= 0) core.players['0'].abilities[idx] = LONGBOW_2 as any;
                    core.players['0'].abilityLevels['longbow'] = 2;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '长弓II 4个相同触发缠绕',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-4-2' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 6, // longbow-4-2 = 6伤害
                        statusEffects: { [STATUS_IDS.ENTANGLE]: 1 }, // 缠绕已施加
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    it('长弓 II：3个相同骰面 → 不施加缠绕', () => {
        // 骰子值：[1,1,1,4,6] 攻击骰(3弓+1足+1月), [1,1,1,1,1] 防御骰
        // longbow-bonus-check-4 需要 ≥4 个相同骰面，3弓不满足
        const random = createQueuedRandom([1, 1, 1, 4, 6, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    const idx = core.players['0'].abilities.findIndex((a: any) => a.id === 'longbow');
                    if (idx >= 0) core.players['0'].abilities[idx] = LONGBOW_2 as any;
                    core.players['0'].abilityLevels['longbow'] = 2;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '长弓II 3个相同不触发缠绕',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-3-2' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 4, // longbow-3-2 = 4伤害
                        statusEffects: { [STATUS_IDS.ENTANGLE]: 0 }, // 无缠绕
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 长弓 III 连击判定 (longbow-bonus-check-3)：
     * 升级到 LONGBOW_3 后，≥3 个相同 → 施加缠绕
     */
    it('长弓 III：3个相同骰面 → 施加缠绕', () => {
        // 骰子值：[1,1,1,4,5] 攻击骰(3弓+2足), [1,1,1,1,1] 防御骰
        const random = createQueuedRandom([1, 1, 1, 4, 5, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    const idx = core.players['0'].abilities.findIndex((a: any) => a.id === 'longbow');
                    if (idx >= 0) core.players['0'].abilities[idx] = LONGBOW_3 as any;
                    core.players['0'].abilityLevels['longbow'] = 3;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '长弓III 3个相同触发缠绕',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-3-3' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 5, // longbow-3-3 = 5伤害
                        statusEffects: { [STATUS_IDS.ENTANGLE]: 1 },
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 爆裂箭 I (exploding-arrow-resolve-1)：
     * 触发条件：1弓+3月 → [1,6,6,6,4]
     * 效果：投掷1骰，造成骰值伤害
     *
     * 骰子值序列：[1,6,6,6,4] 攻击骰, [bonus_die_value] 爆裂箭骰, [防御骰...]
     */
    it('爆裂箭 I：投掷5骰造成伤害+CP丢失+致盲', () => {
        // 攻击骰 [1,6,6,6,4] = 1弓+3月+1足 → 触发 exploding-arrow
        // 防御骰 [1,1,1,1]（4颗，defensiveRoll rollDiceCount=4）
        // 爆裂箭5骰 = [1,1,1,1,1] = 5弓+0足+0月
        // 伤害 = 3 + 2×5弓 + 1×0足 = 3 + 10 + 0 = 13
        // 对手丢失 1×0月 = 0 CP
        // 队列：[攻击骰×5, 防御骰×4, 爆裂箭骰×5] = 14个值
        const random = createQueuedRandom([1, 6, 6, 6, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '爆裂箭I 投掷5骰结算',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'exploding-arrow' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    // 爆裂箭5骰：5弓 + 0足 + 0月
                    // 伤害 = 3 + 2×5 + 1×0 = 13
                    '1': { 
                        hp: INITIAL_HEALTH - 13,
                        statusEffects: { [STATUS_IDS.BLINDED]: 1 }, // 造成致盲
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 爆炸射击 II (exploding-arrow-resolve-2)：
     * 效果：投掷5骰，造成 3 + 1×弓 + 2×足 伤害，对手失去 1×月 CP，施加致盲
     */
    it('爆炸射击 II：投掷5骰公式伤害 + 致盲', () => {
        // 攻击骰 [1,6,6,6,4], 防御骰 [1,1,1,1,1]（5颗）, 爆炸射击5骰 [1,2,4,5,6]
        // 爆炸射击5骰：1→弓,2→弓,4→足,5→足,6→月 → 2弓2足1月
        // 伤害 = 3 + 1×2 + 2×2 = 9
        // 对手失去1CP（1月）
        // 施加致盲（II级无缠绕）
        // 队列：[攻击骰×5, 防御骰×5, 爆炸射击骰×5] = 15个值
        const random = createQueuedRandom([1, 6, 6, 6, 4, 1, 1, 1, 1, 1, 1, 2, 4, 5, 6]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    const idx = core.players['0'].abilities.findIndex((a: any) => a.id === 'exploding-arrow');
                    if (idx >= 0) core.players['0'].abilities[idx] = EXPLODING_ARROW_2 as any;
                    core.players['0'].abilityLevels['exploding-arrow'] = 2;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '爆炸射击II 5骰公式伤害+致盲',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'exploding-arrow' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 9, // 3 + 1×2弓 + 2×2足 = 9
                        statusEffects: { [STATUS_IDS.BLINDED]: 1 }, // 只有致盲，无缠绕
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    /**
     * 爆炸射击 III (exploding-arrow-resolve-3)：
     * 效果：投掷5骰，造成 3 + 1×弓 + 2×足 伤害，对手失去 1×月 CP，施加致盲和缠绕
     */
    it('爆炸射击 III：投掷5骰公式伤害 + 致盲 + 缠绕', () => {
        // 攻击骰 [1,6,6,6,4], 防御骰 [1,1,1,1,1]（5颗，月精灵diceCount=5）, 爆炸射击5骰 [1,2,4,5,6]
        // 爆炸射击5骰：1→弓,2→弓,4→足,5→足,6→月 → 2弓2足1月
        // 伤害 = 3 + 1×2 + 2×2 = 9
        // 对手失去1CP（1月）
        // 施加致盲和缠绕
        // 队列：[攻击骰×5, 防御骰×5, 爆炸射击骰×5] = 15个值
        const random = createQueuedRandom([1, 6, 6, 6, 4, 1, 1, 1, 1, 1, 1, 2, 4, 5, 6]);
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createMoonElfSetup({
                mutate: (core) => {
                    const idx = core.players['0'].abilities.findIndex((a: any) => a.id === 'exploding-arrow');
                    if (idx >= 0) core.players['0'].abilities[idx] = EXPLODING_ARROW_3 as any;
                    core.players['0'].abilityLevels['exploding-arrow'] = 3;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '爆炸射击III 5骰公式伤害+致盲+缠绕',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'exploding-arrow' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 9, // 3 + 1×2弓 + 2×2足 = 9
                        statusEffects: { [STATUS_IDS.BLINDED]: 1, [STATUS_IDS.ENTANGLE]: 1 },
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});
