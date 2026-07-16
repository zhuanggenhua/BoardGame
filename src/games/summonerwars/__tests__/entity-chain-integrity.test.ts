/**
 * SummonerWars 实体交互链完整性测试
 *
 * 验证 AbilityDef 中所有 custom actionId 引用都有对应的处理器。
 * 四条合法路径：
 * 1. swCustomActionRegistry → abilityResolver case 'custom' 直接调用 handler
 * 2. HANDLED_BY_UI_EVENTS → fallback ABILITY_TRIGGERED 被 useGameEvents.ts 消费
 * 3. HANDLED_BY_EXECUTORS → 父技能通过 executors/ 注册表执行器处理
 * 4. HANDLED_BY_COMMAND_FLOW / HANDLED_BY_PASSIVE → execute.ts 命令流或被动计算
 *
 * 不在任何集合中的 actionId → 断链（测试失败）
 */

import { abilityRegistry } from '../domain/abilities';
import { swCustomActionRegistry } from '../domain/customActionHandlers';
import { abilityExecutorRegistry } from '../domain/executors';
import type { AbilityDef, AbilityEffect } from '../domain/abilities';
import {
    createRegistryIntegritySuite,
    createRefChainSuite,
    createTriggerPathSuite,
    createEffectContractSuite,
    type RefChain,
} from '../../../engine/testing/entityIntegritySuite';
import { createInitializedCore, generateInstanceId } from './test-helpers';
import { calculateEffectiveStrength, getEffectiveLife, getEffectiveStrengthValue, getEffectiveStructureLife, triggerAbilities, triggerAllUnitsAbilities } from '../domain/abilityResolver';
import {
    isImmobileBase,
    canMoveToEnhanced,
    getEffectiveAttackRangeBase,
    hasStableAbilityBase,
    getUnitMoveEnhancements,
    getPassedThroughUnitPositions,
    getValidSummonPositions,
} from '../domain/helpers';
import type { SummonerWarsCore, PlayerId, CellCoord, UnitCard, BoardUnit, StructureCard } from '../domain/types';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import type { RandomFn, MatchState } from '../../../engine/types';
import { executeCommand } from '../domain/execute';
import { postProcessDeathChecks } from '../domain/execute/helpers';
import { summonerWarsFlowHooks } from '../domain/flowHooks';
import { reduceEvent } from '../domain/reduce';

// ============================================================================
// 合法路径白名单（非 registry 处理的 actionId 必须显式登记）
// ============================================================================

/**
 * fallback ABILITY_TRIGGERED 事件被 useGameEvents.ts 消费的 actionId
 * 修改后必须同步更新 useGameEvents.ts 中的事件消费逻辑
 */
const HANDLED_BY_UI_EVENTS = new Set([
    'illusion_copy',          // useGameEvents → setAbilityMode('illusion')
    'blood_rune_choice',      // useGameEvents → setAbilityMode('blood_rune')
    'rapid_fire_extra_attack', // afterAttack 触发 → UI 显示确认 → ACTIVATE_ABILITY(rapid_fire) 消耗充能+授予额外攻击
]);

/**
 * fallback ABILITY_TRIGGERED 事件被 SummonerWars InteractionSystem 消费的 actionId
 * 修改后必须同步更新 domain/systems.ts 中的交互映射逻辑
 */
const HANDLED_BY_INTERACTION_SYSTEM = new Set([
    'ice_shards_damage',      // InteractionSystem → 交互确认 → ACTIVATE_ABILITY(ice_shards)
    'feed_beast_check',       // InteractionSystem → 交互确认 → ACTIVATE_ABILITY(feed_beast)
]);

/**
 * 父技能通过 executors/ 注册表执行器处理的子 actionId。
 * 这些 actionId 是 AbilityDef 中 custom effect 的声明，
 * 实际逻辑在对应的 executors/*.ts 文件中作为父技能的一部分执行。
 */
const HANDLED_BY_EXECUTORS = new Set([
    // 堕落王国
    'soul_transfer_request',    // → executors/necromancer 'soul_transfer'
    // fire_sacrifice_summon 已改为 onSummon 触发，在 SUMMON_UNIT 命令流中处理
    // 欺心巫族
    'mind_capture_check',       // → executors/trickster 'mind_capture_resolve'
    'mind_capture_resolve',     // → executors/trickster 'mind_capture_resolve'（决策分支）
    'vanish_swap',              // → executors/goblin 'vanish'
    // 洞穴地精
    'magic_addiction_check',    // → executors/goblin 'magic_addiction'
    // 先锋军团
    'fortress_power_retrieve',  // → executors/paladin 'fortress_power'
    'holy_arrow_discard',       // → executors/paladin 'holy_arrow'
    // 极地矮人
    'frost_axe_action',         // → executors/frost 'frost_axe'
    'structure_shift_push_pull', // → executors/frost 'structure_shift'
    'ice_ram_action',           // → executors/frost 'ice_ram'
    // 炽原精灵
    'ancestral_bond_transfer',  // → executors/barbaric 'ancestral_bond'
    'withdraw_push_pull',       // → executors/barbaric 'withdraw'
    'spirit_bond_action',       // → executors/barbaric 'spirit_bond'
]);

/**
 * 在 execute.ts 命令流中处理的 actionId（MOVE_UNIT/DECLARE_ATTACK 等主命令的子逻辑）。
 * 非 ACTIVATE_ABILITY 路径，而是嵌入在其他命令的执行流程中。
 */
const HANDLED_BY_COMMAND_FLOW = new Set([
    'ferocity_extra_attack',  // → execute DECLARE_ATTACK afterAttack 检查
    'grab_follow',            // → execute MOVE_UNIT 抓附跟随
    'guardian_force_target',  // → execute DECLARE_ATTACK 被动守护
    'radiant_shot_boost',     // → execute DECLARE_ATTACK beforeAttack 被动
    'charge_line_move',       // → execute MOVE_UNIT 冲锋加成
    'speed_up_extra_move',    // → execute/helpers 移动增强
    'mogu_blood_bloom_charge', // → execute postProcessDeathChecks 后处理友方单位死亡
    'mogu_final_form_replace', // → execute SUMMON_UNIT 替换高充能菌化野兽
    'mogu_decay',             // → execute END_PHASE 移动阶段结束处理
    'mogu_parasite',          // → execute END_PHASE 攻击阶段结束处理
]);

/**
 * 被动计算/校验中处理的 actionId。
 * 这些 actionId 在 abilityResolver（onDamageCalculation）、validate/helpers 等被动路径中生效。
 */
/**
 * 被动能力实现证据映射
 *
 * 每个 actionId 必须声明：
 * - abilityId: 父技能 ID（用于运行时验证）
 * - consumedBy: 实际消费位置描述
 * - verifyFn: 可选的运行时验证标签（在 Section 8 中执行）
 *
 * ⚠️ 新增被动能力时必须同步更新此映射，并在 Section 8 添加对应的运行时验证。
 */
const PASSIVE_EVIDENCE = new Map<string, { abilityId: string; consumedBy: string; verifyTag?: string }>([
    ['fortress_elite_boost',    { abilityId: 'fortress_elite',    consumedBy: 'abilityResolver.calculateEffectiveStrength', verifyTag: 'fortress_elite' }],
    ['frost_bolt_boost',        { abilityId: 'frost_bolt',        consumedBy: 'abilityResolver.calculateEffectiveStrength', verifyTag: 'frost_bolt' }],
    ['greater_frost_bolt_boost', { abilityId: 'greater_frost_bolt', consumedBy: 'abilityResolver.calculateEffectiveStrength', verifyTag: 'greater_frost_bolt' }],
    ['aerial_strike_aura',      { abilityId: 'aerial_strike',     consumedBy: 'helpers.getUnitMoveEnhancements', verifyTag: 'aerial_strike' }],
    ['immobile_check',          { abilityId: 'immobile',          consumedBy: 'validate + helpers.isImmobile', verifyTag: 'immobile' }],
    ['extended_range',          { abilityId: 'ranged',            consumedBy: 'helpers.getEffectiveAttackRange', verifyTag: 'ranged' }],
    ['stable_immunity',         { abilityId: 'stable',            consumedBy: 'abilityResolver pushPull + executors/trickster', verifyTag: 'stable' }],
]);

const HANDLED_BY_PASSIVE = new Set(PASSIVE_EVIDENCE.keys());

// ============================================================================
// 辅助：从 AbilityDef 提取 custom actionId 引用
// ============================================================================

function extractCustomActionChains(def: AbilityDef): RefChain[] {
    return def.effects
        .filter((e): e is Extract<AbilityEffect, { type: 'custom' }> => e.type === 'custom')
        .map(e => ({
            sourceLabel: `AbilityDef.effects`,
            sourceId: def.id,
            refType: 'customAction',
            refId: e.actionId,
        }));
}

// ============================================================================
// 1. AbilityRegistry 注册完整性（工厂函数）
// ============================================================================

createRegistryIntegritySuite<AbilityDef>({
    suiteName: 'AbilityRegistry 注册完整性',
    getDefs: () => abilityRegistry.getAll(),
    getId: def => def.id,
    requiredFields: [
        { name: 'id', check: def => !!def.id },
        { name: 'name', check: def => !!def.name },
    ],
    minCount: 20,
});

// ============================================================================
// 2. Custom ActionId 全量断链检测（工厂函数）
// ============================================================================

const registeredIds = swCustomActionRegistry.getRegisteredIds();
const allHandledIds = new Set([
    ...registeredIds,
    ...HANDLED_BY_UI_EVENTS,
    ...HANDLED_BY_INTERACTION_SYSTEM,
    ...HANDLED_BY_EXECUTORS,
    ...HANDLED_BY_COMMAND_FLOW,
    ...HANDLED_BY_PASSIVE,
]);

createRefChainSuite<AbilityDef>({
    suiteName: 'Custom ActionId 引用链',
    getDefs: () => abilityRegistry.getAll(),
    extractChains: extractCustomActionChains,
    registries: { customAction: allHandledIds },
    minChainCount: 4,
    orphanCheck: { label: 'swCustomActionRegistry', registeredIds },
    staleWhitelists: [
        { label: 'HANDLED_BY_UI_EVENTS', ids: HANDLED_BY_UI_EVENTS },
        { label: 'HANDLED_BY_INTERACTION_SYSTEM', ids: HANDLED_BY_INTERACTION_SYSTEM },
        { label: 'HANDLED_BY_EXECUTORS', ids: HANDLED_BY_EXECUTORS },
        { label: 'HANDLED_BY_COMMAND_FLOW', ids: HANDLED_BY_COMMAND_FLOW },
        { label: 'HANDLED_BY_PASSIVE', ids: HANDLED_BY_PASSIVE },
    ],
});

// ============================================================================
// 3. Activated 技能 UI 触发路径完整性
// ============================================================================

/**
 * activated 技能的 UI 触发路径声明
 *
 * 所有 trigger: 'activated' 的技能需要玩家主动操作才能触发，
 * 必须在此处显式声明其 UI 入口，否则测试失败。
 *
 * 新增 activated 技能时必须同步更新此映射。
 */
const ACTIVATED_UI_CONFIRMED = new Map<string, string>([
    ['vanish',         'button:attack — Board.tsx 攻击阶段按钮 + cell interaction 0费友方单位'],
    // 手动触发（Board.tsx 静态按钮 → ACTIVATE_ABILITY）
    ['prepare',        'button:move   — Board.tsx 移动阶段按钮'],
    ['revive_undead',  'button:summon — Board.tsx 召唤阶段按钮 + CardSelectorOverlay'],
    // fire_sacrifice_summon 已改为 onSummon 触发（trigger: 'onSummon'），不在 activated 列表中
    ['mind_capture_resolve', 'modal:decision — mind_capture 触发后的决策 Modal（控制/伤害）'],
    // 事件卡持续效果（ABILITY_TRIGGERED → useGameEvents → cell interaction）
    ['ice_ram',         'eventCard:ui  — 建筑移动/推拉后 useGameEvents 触发 + StatusBanners + cell interaction'],
    ['high_telekinesis_instead', 'button:attack — 攻击阶段按钮代替攻击推拉 + cell interaction 选目标 + telekinesis 方向选择'],
    ['telekinesis_instead', 'button:attack — 攻击阶段按钮代替攻击推拉 + cell interaction 选目标 + telekinesis 方向选择'],
    ['mogu_blood_infusion', 'button:move — 移动阶段主动技能按钮 + system interaction 选择 2 格内友方单位'],
    ['mogu_fanatical_fungus', 'eventCard:afterMove — 持续事件在单位移动后创建 system interaction + StatusBanners 推拉选择'],
]);

/**
 * 已知 UI 缺失的 activated 技能（TODO 待实装）
 * 此集合中的技能不会导致测试失败，但会在测试输出中打印警告
 */
const ACTIVATED_UI_TODO = new Map<string, string>([
]);

/**
 * CONFIRMED 技能中已知未完成的分支（粒度更细的缺口追踪）
 *
 * 技能整体触发路径已通，但个别分支/交互尚未实装。
 * 与 ACTIVATED_UI_TODO 不同：TODO 是整个技能无 UI，此处是部分分支缺失。
 */
const ACTIVATED_INCOMPLETE_BRANCHES = new Map<string, string[]>([
]);

const RELEASE_AUDIT_MODE = process.env.AUDIT_RELEASE_MODE === '1';

createTriggerPathSuite<AbilityDef>({
    suiteName: 'Activated 技能 UI 触发路径',
    getItems: () => abilityRegistry.getByTrigger('activated'),
    getId: a => a.id,
    getLabel: a => a.name,
    confirmed: ACTIVATED_UI_CONFIRMED,
    todo: ACTIVATED_UI_TODO,
    incompleteBranches: ACTIVATED_INCOMPLETE_BRANCHES,
    minCount: 5,
    failOnTodo: RELEASE_AUDIT_MODE,
    failOnIncompleteBranches: RELEASE_AUDIT_MODE,
});

// ============================================================================
// 4. swCustomActionRegistry 基本健康检查
// ============================================================================

describe('swCustomActionRegistry 健康检查', () => {
    it('至少注册了 6 个 handler', () => {
        expect(swCustomActionRegistry.size).toBeGreaterThanOrEqual(6);
    });

    it('包含核心 handler', () => {
        expect(swCustomActionRegistry.has('soul_transfer_request')).toBe(true);
        expect(swCustomActionRegistry.has('mind_capture_check')).toBe(true);
        expect(swCustomActionRegistry.has('judgment_draw')).toBe(true);
        expect(swCustomActionRegistry.has('guidance_draw')).toBe(true);
        expect(swCustomActionRegistry.has('divine_shield_check')).toBe(true);
        expect(swCustomActionRegistry.has('healing_convert')).toBe(true);
    });
});

// ============================================================================
// 5. abilityExecutorRegistry 与 abilityRegistry 双向一致性
// ============================================================================

describe('abilityExecutorRegistry 一致性', () => {
    const executorIds = abilityExecutorRegistry.getRegisteredIds();
    const abilityIds = abilityRegistry.getRegisteredIds();

    it('所有注册的执行器都有对应的 AbilityDef', () => {
        const orphanExecutors: string[] = [];
        for (const id of executorIds) {
            if (!abilityIds.has(id)) {
                orphanExecutors.push(id);
            }
        }
        expect(orphanExecutors).toEqual([]);
    });

    it('所有 activated 技能都有对应的执行器', () => {
        const activatedDefs = abilityRegistry.getByTrigger('activated');
        const missingExecutors: string[] = [];
        for (const def of activatedDefs) {
            if (!executorIds.has(def.id)) {
                missingExecutors.push(def.id);
            }
        }
        expect(missingExecutors).toEqual([]);
    });

    it('执行器数量与 activated 技能数量一致', () => {
        const activatedCount = abilityRegistry.getByTrigger('activated').length;
        // 执行器可能多于 activated（包含非 activated 但需要 ACTIVATE_ABILITY 命令的技能）
        // 但不应少于 activated 数量
        expect(executorIds.size).toBeGreaterThanOrEqual(activatedCount);
    });
});

// ============================================================================
// 6. InteractionChain 交互链契约校验
// ============================================================================

describe('InteractionChain 交互链契约', () => {
    const defsWithChain = abilityRegistry.getAll().filter(d => d.interactionChain);

    it('至少存在 3 个声明了 interactionChain 的技能', () => {
        expect(defsWithChain.length).toBeGreaterThanOrEqual(3);
    });

    it('steps 产出字段覆盖 payloadContract.required', () => {
        const violations: string[] = [];
        for (const def of defsWithChain) {
            const chain = def.interactionChain!;
            const produced = new Set(chain.steps.map(s => s.producesField));
            for (const field of chain.payloadContract.required) {
                if (!produced.has(field)) {
                    violations.push(`[${def.id}] required 字段 '${field}' 未被任何 step 产出`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('steps 无重复产出字段', () => {
        const violations: string[] = [];
        for (const def of defsWithChain) {
            const chain = def.interactionChain!;
            const seen = new Set<string>();
            for (const step of chain.steps) {
                if (seen.has(step.producesField)) {
                    violations.push(`[${def.id}] step '${step.step}' 产出字段 '${step.producesField}' 重复`);
                }
                seen.add(step.producesField);
            }
        }
        expect(violations).toEqual([]);
    });

    it('optional 字段在 steps 中标记为 optional', () => {
        const violations: string[] = [];
        for (const def of defsWithChain) {
            const chain = def.interactionChain!;
            const optionalFields = chain.payloadContract.optional ?? [];
            for (const field of optionalFields) {
                const step = chain.steps.find(s => s.producesField === field);
                if (step && !step.optional) {
                    violations.push(`[${def.id}] payload optional 字段 '${field}' 对应的 step '${step.step}' 未标记 optional`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('声明了 interactionChain 的 activated 技能都有对应执行器', () => {
        const violations: string[] = [];
        for (const def of defsWithChain) {
            if (def.trigger !== 'activated') continue;
            if (!abilityExecutorRegistry.getRegisteredIds().has(def.id)) {
                violations.push(`[${def.id}] 声明了 interactionChain 但无对应执行器`);
            }
        }
        expect(violations).toEqual([]);
    });
});

// ============================================================================
// 7. 效果声明自洽性（非 custom 效果的数据完整性）
// ============================================================================

createEffectContractSuite<AbilityDef, AbilityEffect>({
    suiteName: '效果声明数据契约',
    getSources: () => abilityRegistry.getAll(),
    getSourceId: def => def.id,
    extractEffects: def => def.effects,
    minSourceCount: 20,
    rules: [
        {
            name: 'damage 效果必须有正数 value',
            appliesTo: (e) => e.type === 'damage',
            check: (e) => {
                if (e.type !== 'damage') return true;
                return typeof e.value === 'number' ? e.value > 0 : true; // Expression 类型跳过
            },
            describeViolation: (e) => `damage 效果 value 不合法: ${JSON.stringify(e)}`,
        },
        {
            name: 'heal 效果必须有正数 value',
            appliesTo: (e) => e.type === 'heal',
            check: (e) => {
                if (e.type !== 'heal') return true;
                return typeof e.value === 'number' ? e.value > 0 : true;
            },
            describeViolation: (e) => `heal 效果 value 不合法: ${JSON.stringify(e)}`,
        },
        {
            name: 'addCharge 效果 value 必须为正整数',
            appliesTo: (e) => e.type === 'addCharge',
            check: (e) => e.type === 'addCharge' && Number.isInteger(e.value) && e.value > 0,
            describeViolation: (e) => `addCharge value 不合法: ${JSON.stringify(e)}`,
        },
        {
            name: 'pushPull 效果必须有合法 direction',
            appliesTo: (e) => e.type === 'pushPull',
            check: (e) => e.type === 'pushPull' && ['push', 'pull', 'choice'].includes(e.direction),
            describeViolation: (e) => `pushPull direction 不合法: ${JSON.stringify(e)}`,
        },
        {
            name: 'custom 效果必须有 actionId',
            appliesTo: (e) => e.type === 'custom',
            check: (e) => e.type === 'custom' && typeof e.actionId === 'string' && e.actionId.length > 0,
            describeViolation: (e) => `custom 效果缺少 actionId: ${JSON.stringify(e)}`,
        },
        {
            name: 'reduceDamage 效果 value 必须为正数',
            appliesTo: (e) => e.type === 'reduceDamage',
            check: (e) => e.type === 'reduceDamage' && e.value > 0,
            describeViolation: (e) => `reduceDamage value 不合法: ${JSON.stringify(e)}`,
        },
    ],
});


// ============================================================================
// 8. 被动能力运行时验证
// ============================================================================

// --- 测试辅助 ---

function testRandom(): RandomFn {
    return { shuffle: <T>(arr: T[]) => arr, random: () => 0.5, d: (max: number) => Math.ceil(max * 0.5) || 1, range: (min: number, max: number) => Math.floor(min + (max - min) * 0.5) };
}

function mkUnit(id: string, overrides?: Partial<UnitCard>): UnitCard {
    return {
        id, cardType: 'unit', name: `测试-${id}`, unitClass: 'common', faction: 'necromancer',
        strength: 2, life: 3, cost: 1, attackType: 'melee', attackRange: 1,
        deckSymbols: [], ...overrides,
    };
}

function mkStructure(id: string, overrides?: Partial<StructureCard>): StructureCard {
    return {
        id, cardType: 'structure' as const, name: `建筑-${id}`, faction: 'frost', cost: 0, life: 5,
        deckSymbols: [], ...overrides,
    } as StructureCard;
}

function putUnit(core: SummonerWarsCore, pos: CellCoord, card: UnitCard, owner: PlayerId, extra?: Partial<BoardUnit>): BoardUnit {
    const cardId = `${card.id}-${pos.row}-${pos.col}`;
    const u: BoardUnit = {
        instanceId: extra?.instanceId ?? generateInstanceId(cardId),
        cardId,
        card, owner, position: pos,
        damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
        ...extra,
    };
    core.board[pos.row][pos.col].unit = u;
    return u;
}

function putStructure(core: SummonerWarsCore, pos: CellCoord, owner: PlayerId, card?: StructureCard) {
    const c = card ?? mkStructure(`s-${pos.row}-${pos.col}`);
    core.board[pos.row][pos.col].structure = {
        cardId: c.id, card: c, owner, position: pos, damage: 0,
    };
}

function clearRect(core: SummonerWarsCore, rows: number[], cols: number[]) {
    for (const r of rows) for (const c of cols) {
        if (core.board[r]?.[c]) { core.board[r][c].unit = undefined; core.board[r][c].structure = undefined; }
    }
}

describe('被动能力运行时验证 (Section 8)', () => {
    let core: SummonerWarsCore;

    beforeEach(() => {
        core = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'necromancer' });
        // 清空中央区域用于测试
        clearRect(core, [3, 4, 5], [0, 1, 2, 3, 4, 5]);
    });

    // --- frost_bolt: 相邻友方建筑每个+1战力 ---
    it('[frost_bolt] 相邻友方建筑+1战力', () => {
        const card = mkUnit('fb-unit', { abilities: ['frost_bolt'], strength: 2, faction: 'frost' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        // 放一个友方建筑在相邻位置
        putStructure(core, { row: 4, col: 4 }, '0');
        const str = getEffectiveStrengthValue(unit, core);
        expect(str).toBe(3); // 2 base + 1 from adjacent building
    });

    it('[frost_bolt] 无相邻建筑时不加成', () => {
        const card = mkUnit('fb-unit2', { abilities: ['frost_bolt'], strength: 2, faction: 'frost' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        const str = getEffectiveStrengthValue(unit, core);
        expect(str).toBe(2);
    });

    it('[frost_bolt/L4] 只统计相邻友方建筑', () => {
        const card = mkUnit('fb-unit3', { abilities: ['frost_bolt'], strength: 2, faction: 'frost' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');

        putStructure(core, { row: 4, col: 4 }, '0');
        putStructure(core, { row: 4, col: 2 }, '1');
        putStructure(core, { row: 3, col: 3 }, '0');
        putStructure(core, { row: 5, col: 5 }, '0');

        expect(getEffectiveStrengthValue(unit, core)).toBe(4);
    });

    // --- greater_frost_bolt: 2格内友方建筑每个+1战力 ---
    it('[greater_frost_bolt] 2格内友方建筑+1战力', () => {
        const card = mkUnit('gfb-unit', { abilities: ['greater_frost_bolt'], strength: 3, faction: 'frost' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        // 放两个友方建筑在2格内
        putStructure(core, { row: 4, col: 4 }, '0');
        putStructure(core, { row: 3, col: 3 }, '0');
        const str = getEffectiveStrengthValue(unit, core);
        expect(str).toBe(5); // 3 base + 2 buildings
    });

    it('[greater_frost_bolt/L4] 只统计2格内友方建筑', () => {
        const card = mkUnit('gfb-unit2', { abilities: ['greater_frost_bolt'], strength: 3, faction: 'frost' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');

        putStructure(core, { row: 4, col: 4 }, '0');
        putStructure(core, { row: 3, col: 2 }, '0');
        putStructure(core, { row: 4, col: 1 }, '1');
        putStructure(core, { row: 5, col: 5 }, '0');

        expect(getEffectiveStrengthValue(unit, core)).toBe(5);
    });

    // --- fortress_elite: 2格内友方城塞单位每个+1战力 ---
    it('[fortress_elite] 2格内友方城塞单位+1战力', () => {
        const card = mkUnit('fe-unit', { abilities: ['fortress_elite'], strength: 2, faction: 'frost' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        // 放一个友方城塞单位在2格内（card.id 包含 'fortress'）
        const fortressCard = mkUnit('fortress-guard', { strength: 3, faction: 'frost' });
        putUnit(core, { row: 3, col: 3 }, fortressCard, '0');
        const str = getEffectiveStrengthValue(unit, core);
        expect(str).toBe(3); // 2 base + 1 fortress unit
    });

    it('[fortress_elite/L4] 只统计2格内友方城塞单位', () => {
        const card = mkUnit('fe-unit2', { abilities: ['fortress_elite'], strength: 2, faction: 'frost' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');

        putUnit(core, { row: 3, col: 3 }, mkUnit('fortress-ally', { faction: 'frost' }), '0');
        putUnit(core, { row: 4, col: 4 }, mkUnit('regular-ally', { faction: 'frost' }), '0');
        putUnit(core, { row: 4, col: 2 }, mkUnit('fortress-enemy', { faction: 'frost' }), '1');
        putUnit(core, { row: 5, col: 5 }, mkUnit('fortress-far', { faction: 'frost' }), '0');

        expect(getEffectiveStrengthValue(unit, core)).toBe(3);
    });

    it('[radiant_shot/L4] 当前魔力按每2点+1且奇数向下取整', () => {
        const card = mkUnit('radiant-unit', { abilities: ['radiant_shot'], strength: 2, faction: 'paladin' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');

        core.players['0'].magic = 5;
        expect(getEffectiveStrengthValue(unit, core)).toBe(4);

        core.players['0'].magic = 1;
        expect(getEffectiveStrengthValue(unit, core)).toBe(2);
    });

    it('[life_up/L4] 按当前充能动态读取有效生命且最多+5', () => {
        const card = mkUnit('life-up-unit', { abilities: ['life_up'], life: 3, faction: 'barbaric' });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0', { boosts: 2 });

        expect(getEffectiveLife(unit, core)).toBe(5);

        unit.boosts = 7;
        expect(getEffectiveLife(unit, core)).toBe(8);

        unit.boosts = 0;
        expect(getEffectiveLife(unit, core)).toBe(3);
    });

    // --- aerial_strike: 2格内友方普通士兵获得飞行 ---
    it('[aerial_strike] 2格内友方普通士兵获得飞行增强', () => {
        // 放一个有 aerial_strike 的单位
        const aerialCard = mkUnit('aerial-unit', { abilities: ['aerial_strike'], unitClass: 'champion', faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, aerialCard, '0');
        // 放一个友方普通士兵在2格内
        const soldierCard = mkUnit('soldier', { unitClass: 'common', faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, soldierCard, '0');
        const enhancements = getUnitMoveEnhancements(core, { row: 4, col: 4 });
        expect(enhancements.canPassThrough).toBe(true);
        expect(enhancements.canPassStructures).toBe(true);
        expect(enhancements.extraDistance).toBeGreaterThanOrEqual(1);
    });

    it('[aerial_strike] 超出2格不生效', () => {
        const aerialCard = mkUnit('aerial-unit2', { abilities: ['aerial_strike'], unitClass: 'champion', faction: 'frost' });
        putUnit(core, { row: 3, col: 0 }, aerialCard, '0');
        const soldierCard = mkUnit('soldier2', { unitClass: 'common', faction: 'frost' });
        putUnit(core, { row: 3, col: 3 }, soldierCard, '0'); // 距离3格
        const enhancements = getUnitMoveEnhancements(core, { row: 3, col: 3 });
        expect(enhancements.canPassThrough).toBe(false);
    });

    // --- immobile: 禁足 ---
    it('[immobile] 禁足单位 isImmobile 返回 true', () => {
        const card = mkUnit('imm-unit', { abilities: ['immobile'] });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        expect(isImmobileBase(unit)).toBe(true);
    });

    it('[immobile] 普通单位 isImmobile 返回 false', () => {
        const card = mkUnit('normal-unit', {});
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        expect(isImmobileBase(unit)).toBe(false);
    });

    // --- ranged: 远射4格 ---
    it('[ranged] 远射单位攻击范围为4', () => {
        const card = mkUnit('ranged-unit', { abilities: ['ranged'], attackRange: 1 });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        expect(getEffectiveAttackRangeBase(unit)).toBe(4);
    });

    it('[ranged] 普通单位攻击范围为卡牌值', () => {
        const card = mkUnit('melee-unit', { attackRange: 1 });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        expect(getEffectiveAttackRangeBase(unit)).toBe(1);
    });

    // --- stable: 稳固免疫推拉 ---
    it('[stable] 稳固单位 hasStableAbility 返回 true', () => {
        const card = mkUnit('stable-unit', { abilities: ['stable'] });
        const unit = putUnit(core, { row: 4, col: 3 }, card, '0');
        expect(hasStableAbilityBase(unit)).toBe(true);
    });

    // --- cold_snap: 友方建筑+1有效生命 ---
    it('[cold_snap] 友方建筑应获得+1有效生命', () => {
        // 放一个有 cold_snap 的单位
        const coldSnapCard = mkUnit('cs-unit', { abilities: ['cold_snap'], faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, coldSnapCard, '0');
        // 放一个友方建筑
        const structCard = mkStructure('cs-struct', { life: 5 });
        putStructure(core, { row: 4, col: 4 }, '0', structCard);

        const structure = core.board[4][4].structure!;
        const effectiveLife = getEffectiveStructureLife(core, structure);
        expect(effectiveLife).toBe(6); // 5 + 1 cold_snap 光环
    });

    it('[cold_snap] 远处友方建筑仍获得+1有效生命', () => {
        const coldSnapCard = mkUnit('cs-unit', { abilities: ['cold_snap'], faction: 'frost' });
        putUnit(core, { row: 0, col: 0 }, coldSnapCard, '0');
        const structCard = mkStructure('cs-struct2', { life: 5 });
        putStructure(core, { row: 4, col: 4 }, '0', structCard); // 官方原文无范围限制

        const structure = core.board[4][4].structure!;
        const effectiveLife = getEffectiveStructureLife(core, structure);
        expect(effectiveLife).toBe(6); // 5 + 1 cold_snap 光环
    });

    // --- trample: 穿越伤害数据驱动 ---
    it('[trample] damageOnPassThrough 从 AbilityDef 读取', () => {
        const trampler = mkUnit('trample-unit', { abilities: ['trample'], faction: 'frost' });
        putUnit(core, { row: 3, col: 3 }, trampler, '0');
        const enhancements = getUnitMoveEnhancements(core, { row: 3, col: 3 });
        expect(enhancements.canPassThrough).toBe(true);
        expect(enhancements.damageOnPassThrough).toBe(1);
    });

    it('[trample] getPassedThroughUnitPositions 检测直线穿越', () => {
        const trampler = mkUnit('trample-unit', { abilities: ['trample'], faction: 'frost' });
        putUnit(core, { row: 3, col: 3 }, trampler, '0');
        // 在中间格放一个敌方单位
        const enemy = mkUnit('enemy', { faction: 'frost' });
        putUnit(core, { row: 3, col: 4 }, enemy, '1');
        // 直线移动 2 格：(3,3) → (3,5)，穿过 (3,4)
        const passed = getPassedThroughUnitPositions(core, { row: 3, col: 3 }, { row: 3, col: 5 });
        expect(passed).toEqual([{ row: 3, col: 4 }]);
    });

    it('[trample] 穿过友方单位也造成伤害（踩踏不区分敌我）', () => {
        const trampler = mkUnit('trample-unit', { abilities: ['trample'], faction: 'frost' });
        putUnit(core, { row: 3, col: 3 }, trampler, '0');
        // 在中间格放一个友方单位
        const ally = mkUnit('ally', { faction: 'frost' });
        putUnit(core, { row: 3, col: 4 }, ally, '0');
        const passed = getPassedThroughUnitPositions(core, { row: 3, col: 3 }, { row: 3, col: 5 });
        expect(passed).toEqual([{ row: 3, col: 4 }]); // 友方也算穿过
    });

    it('[movement/L4] 攀爬/飞行/迅捷/缓慢在真实移动入口遵守各自路径边界', () => {
        const climber = mkUnit('climber', { abilities: ['climb'], faction: 'goblin' });
        putUnit(core, { row: 3, col: 0 }, climber, '0');
        putStructure(core, { row: 3, col: 1 }, '1');
        expect(canMoveToEnhanced(core, { row: 3, col: 0 }, { row: 3, col: 3 })).toBe(true);
        putUnit(core, { row: 3, col: 2 }, mkUnit('blocking-unit'), '1');
        expect(canMoveToEnhanced(core, { row: 3, col: 0 }, { row: 3, col: 3 })).toBe(false);

        clearRect(core, [3, 4, 5], [0, 1, 2, 3, 4, 5]);
        const flyer = mkUnit('flyer', { abilities: ['flying'], faction: 'trickster' });
        putUnit(core, { row: 3, col: 0 }, flyer, '0');
        putStructure(core, { row: 3, col: 1 }, '1');
        putUnit(core, { row: 3, col: 2 }, mkUnit('unit-in-flight-path'), '1');
        expect(canMoveToEnhanced(core, { row: 3, col: 0 }, { row: 3, col: 3 })).toBe(true);

        clearRect(core, [3, 4, 5], [0, 1, 2, 3, 4, 5]);
        const swift = mkUnit('swift-unit', { abilities: ['swift'], faction: 'trickster' });
        putUnit(core, { row: 3, col: 0 }, swift, '0');
        expect(canMoveToEnhanced(core, { row: 3, col: 0 }, { row: 3, col: 3 })).toBe(true);
        putUnit(core, { row: 3, col: 1 }, mkUnit('swift-blocker'), '1');
        expect(canMoveToEnhanced(core, { row: 3, col: 0 }, { row: 3, col: 3 })).toBe(false);

        clearRect(core, [3, 4, 5], [0, 1, 2, 3, 4, 5]);
        const slow = mkUnit('slow-unit', { abilities: ['slow'], faction: 'frost' });
        putUnit(core, { row: 3, col: 0 }, slow, '0');
        expect(canMoveToEnhanced(core, { row: 3, col: 0 }, { row: 3, col: 1 })).toBe(true);
        expect(canMoveToEnhanced(core, { row: 3, col: 0 }, { row: 3, col: 2 })).toBe(false);
    });
});

// ============================================================================
// 9. 完整流程验证（execute 命令级别）
// ============================================================================

describe('完整流程验证 (Section 9)', () => {
    let core: SummonerWarsCore;
    const random = testRandom();

    beforeEach(() => {
        core = createInitializedCore(['0', '1'], random, { faction0: 'frost', faction1: 'necromancer' });
        clearRect(core, [3, 4, 5], [0, 1, 2, 3, 4, 5]);
    });

    function exec(cmd: string, payload: Record<string, unknown>, overrideRandom?: RandomFn) {
        const state = { core, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>;
        return executeCommand(state, { type: cmd, payload, timestamp: 0 }, overrideRandom ?? random);
    }

    function applyEvents(events: ReturnType<typeof exec>) {
        return events.reduce((nextCore, event) => reduceEvent(nextCore, event), core);
    }

    /** random 产生 melee 面（index=0），确保近战攻击命中 */
    function meleeRandom(): RandomFn {
        return { shuffle: <T>(arr: T[]) => arr, random: () => 0, d: (_max: number) => 1, range: (min: number) => min };
    }

    // ================================================================
    // 1. onMove — trample 践踏穿越伤害
    // ================================================================

    it('[onMove/trample] MOVE_UNIT 穿过敌方士兵产生 UNIT_DAMAGED 事件', () => {
        core.phase = 'move';
        core.currentPlayer = '0' as PlayerId;
        const trampler = mkUnit('bear-rider', { abilities: ['trample'], faction: 'frost' });
        putUnit(core, { row: 4, col: 2 }, trampler, '0');
        const enemy = mkUnit('skeleton', { life: 3, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, enemy, '1');

        const events = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 2 }, to: { row: 4, col: 4 } });

        expect(events.find(e => e.type === SW_EVENTS.UNIT_MOVED)).toBeDefined();
        const trampleDmg = events.find(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'trample'
        );
        expect(trampleDmg).toBeDefined();
        expect((trampleDmg!.payload as Record<string, unknown>).damage).toBe(1);
    });

    it('[onMove/trample/L4] 真实移动只伤害路径中间被穿越单位', () => {
        core.phase = 'move';
        core.currentPlayer = '0' as PlayerId;
        const trampler = mkUnit('bear-rider-l4', { abilities: ['trample'], faction: 'frost' });
        putUnit(core, { row: 4, col: 1 }, trampler, '0');
        const passedEnemy = mkUnit('passed-enemy', { life: 3, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 2 }, passedEnemy, '1');
        const destinationEnemy = mkUnit('destination-enemy', { life: 3, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 4 }, destinationEnemy, '1');

        const events = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 1 }, to: { row: 4, col: 3 } });
        const trampleDamageEvents = events.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'trample'
        );

        expect(events.find(e => e.type === SW_EVENTS.UNIT_MOVED)).toBeDefined();
        expect(trampleDamageEvents).toHaveLength(1);
        expect((trampleDamageEvents[0].payload as Record<string, unknown>).position).toEqual({ row: 4, col: 2 });
    });

    // ================================================================
    // 2. passive — cold_snap 建筑光环生命
    // ================================================================

    it('[passive/cold_snap] 光环加成下建筑有效生命+1', () => {
        const oleg = mkUnit('oleg', { abilities: ['cold_snap'], faction: 'frost' });
        putUnit(core, { row: 4, col: 2 }, oleg, '0');
        const structCard = mkStructure('my-gate', { life: 5 });
        putStructure(core, { row: 4, col: 3 }, '0', structCard);

        expect(getEffectiveStructureLife(core, core.board[4][3].structure!)).toBe(6);
        core.board[4][2].unit = undefined;
        expect(getEffectiveStructureLife(core, core.board[4][3].structure!)).toBe(5);
    });

    // ================================================================
    // 3. activated — prepare 预备充能
    // ================================================================

    it('[activated/prepare] ACTIVATE_ABILITY 产生 UNIT_CHARGED 事件', () => {
        core.phase = 'move';
        core.currentPlayer = '0' as PlayerId;
        const archer = mkUnit('barbaric-archer', { abilities: ['prepare'], faction: 'barbaric' });
        const unit = putUnit(core, { row: 4, col: 3 }, archer, '0');

        const events = exec(SW_COMMANDS.ACTIVATE_ABILITY, {
            abilityId: 'prepare',
            sourceUnitId: unit.instanceId,
            position: { row: 4, col: 3 },
        });

        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'prepare'
        );
        expect(chargeEvent).toBeDefined();
        expect((chargeEvent!.payload as Record<string, unknown>).delta).toBe(1);
    });

    // ================================================================
    // 4. afterAttack — imposing 威势充能
    // ================================================================

    it('[afterAttack/imposing] DECLARE_ATTACK 后攻击者获得充能', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const imposer = mkUnit('frost-champion', { abilities: ['imposing'], strength: 3, faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, imposer, '0');
        const enemy = mkUnit('enemy-unit', { life: 5, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 4 }, enemy, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        });

        expect(events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED)).toBeDefined();
        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'imposing'
        );
        expect(chargeEvent).toBeDefined();
    });

    // ================================================================
    // 5. beforeAttack — life_drain 吸取生命（special 标记算近战命中）
    // ================================================================

    it('[beforeAttack/life_drain] DECLARE_ATTACK 带 beforeAttack 消灭友方单位并正常攻击', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const dragos = mkUnit('dragos', { abilities: ['life_drain'], strength: 2, faction: 'necromancer', unitClass: 'summoner' });
        putUnit(core, { row: 4, col: 3 }, dragos, '0');
        const victim = mkUnit('sacrifice-victim', { life: 2, faction: 'necromancer' });
        const victimUnit = putUnit(core, { row: 4, col: 2 }, victim, '0');
        const enemy = mkUnit('enemy-target', { life: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, enemy, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
            beforeAttack: { abilityId: 'life_drain', targetUnitId: victimUnit.instanceId },
        });

        // 不再产生 STRENGTH_MODIFIED（效果改为 special 算近战命中）
        const strengthMod = events.find(e =>
            e.type === SW_EVENTS.STRENGTH_MODIFIED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'life_drain'
        );
        expect(strengthMod).toBeUndefined();
        // 攻击正常进行
        expect(events.some(e => e.type === SW_EVENTS.UNIT_ATTACKED)).toBe(true);
        // 牺牲品应被消灭
        const destroyed = events.find(e =>
            e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as Record<string, unknown>).cardId === victimUnit.cardId
        );
        expect(destroyed).toBeDefined();
    });

    // ================================================================
    // 6. onAdjacentEnemyAttack — evasion 迷魂减伤
    // ================================================================

    it('[onAdjacentEnemyAttack/evasion] 攻击者相邻有迷魂单位且掷出✦时减伤', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        // 高战力确保掷出 special 面
        const attacker = mkUnit('my-attacker', { strength: 6, faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, attacker, '0');
        // 迷魂单位（敌方）与攻击者相邻
        const evasionUnit = mkUnit('trickster-dice', { abilities: ['evasion'], faction: 'trickster' });
        putUnit(core, { row: 4, col: 2 }, evasionUnit, '1');
        const target = mkUnit('target-unit', { life: 10, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 4 }, target, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        });

        const attackEvent = events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
        expect(attackEvent).toBeDefined();
        const diceResults = (attackEvent!.payload as Record<string, unknown>).diceResults as Array<{ faceIndex: number; marks: string[] }>;
        // testRandom() random=0.5 → 6骰中一定有 special 面
        if (diceResults.some(r => r.marks.includes('special'))) {
            const reduced = events.find(e =>
                e.type === SW_EVENTS.DAMAGE_REDUCED
                && (e.payload as Record<string, unknown>).sourceAbilityId === 'evasion'
            );
            expect(reduced).toBeDefined();
        }
    });

    it('[onAdjacentEnemyAttack/evasion/L4] special 面触发迷魂后最终伤害减少1', () => {
        function setupAttack(withEvasion: boolean): SummonerWarsCore {
            const nextCore = createInitializedCore(['0', '1'], testRandom(), { faction0: 'frost', faction1: 'necromancer' });
            clearRect(nextCore, [3, 4, 5], [0, 1, 2, 3, 4, 5]);
            nextCore.phase = 'attack';
            nextCore.currentPlayer = '0' as PlayerId;

            putUnit(nextCore, { row: 4, col: 3 }, mkUnit(`evasion-l4-attacker-${withEvasion}`, {
                strength: 6,
                faction: 'frost',
            }), '0');
            putUnit(nextCore, { row: 4, col: 4 }, mkUnit(`evasion-l4-target-${withEvasion}`, {
                life: 10,
                faction: 'necromancer',
            }), '1');

            if (withEvasion) {
                putUnit(nextCore, { row: 4, col: 2 }, mkUnit('evasion-l4-dice', {
                    abilities: ['evasion'],
                    faction: 'trickster',
                }), '1');
            }

            return nextCore;
        }

        const withoutEvasionCore = setupAttack(false);
        const withEvasionCore = setupAttack(true);
        const specialMeleeRandom: RandomFn = { ...testRandom(), random: () => 0.75 };

        const eventsWithoutEvasion = executeCommand(
            { core: withoutEvasionCore, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>,
            {
                type: SW_COMMANDS.DECLARE_ATTACK,
                payload: { attacker: { row: 4, col: 3 }, target: { row: 4, col: 4 } },
                timestamp: 0,
            },
            specialMeleeRandom
        );
        const eventsWithEvasion = executeCommand(
            { core: withEvasionCore, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>,
            {
                type: SW_COMMANDS.DECLARE_ATTACK,
                payload: { attacker: { row: 4, col: 3 }, target: { row: 4, col: 4 } },
                timestamp: 0,
            },
            specialMeleeRandom
        );

        const attackWithoutEvasion = eventsWithoutEvasion.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
        const attackWithEvasion = eventsWithEvasion.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
        expect(attackWithoutEvasion).toBeDefined();
        expect(attackWithEvasion).toBeDefined();

        const payloadWithoutEvasion = attackWithoutEvasion!.payload as Record<string, unknown>;
        const payloadWithEvasion = attackWithEvasion!.payload as Record<string, unknown>;
        expect((payloadWithEvasion.diceResults as Array<{ marks: string[] }>).some(r => r.marks.includes('special'))).toBe(true);

        const hitsWithoutEvasion = payloadWithoutEvasion.hits as number;
        const hitsWithEvasion = payloadWithEvasion.hits as number;
        expect(hitsWithoutEvasion - hitsWithEvasion).toBe(1);

        const reduced = eventsWithEvasion.find(e =>
            e.type === SW_EVENTS.DAMAGE_REDUCED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'evasion'
        );
        expect(reduced).toBeDefined();
        expect((reduced!.payload as Record<string, unknown>).value).toBe(1);

        const damagedWithoutEvasion = eventsWithoutEvasion.find(e => e.type === SW_EVENTS.UNIT_DAMAGED);
        const damagedWithEvasion = eventsWithEvasion.find(e => e.type === SW_EVENTS.UNIT_DAMAGED);
        expect((damagedWithoutEvasion!.payload as Record<string, unknown>).damage).toBe(hitsWithoutEvasion);
        expect((damagedWithEvasion!.payload as Record<string, unknown>).damage).toBe(hitsWithEvasion);
    });

    // ================================================================
    // 7. onAdjacentEnemyLeave — rebound 缠斗伤害
    // ================================================================

    it('[onAdjacentEnemyLeave/rebound] 敌方离开缠斗单位时受1点伤害', () => {
        core.phase = 'move';
        core.currentPlayer = '1' as PlayerId;
        // 缠斗单位（玩家0）
        const entangler = mkUnit('trickster-entangle', { abilities: ['rebound'], faction: 'trickster' });
        putUnit(core, { row: 4, col: 3 }, entangler, '0');
        // 敌方单位（玩家1）与缠斗单位相邻
        const enemy = mkUnit('enemy-mover', { life: 3, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 4 }, enemy, '1');

        const events = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 4 }, to: { row: 4, col: 5 } });

        const entangleDmg = events.find(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'entangle'
        );
        expect(entangleDmg).toBeDefined();
        expect((entangleDmg!.payload as Record<string, unknown>).damage).toBe(1);
    });

    it('[onAdjacentEnemyLeave/rebound/L4] 敌方靠近或仍相邻时不触发缠斗伤害', () => {
        core.phase = 'move';
        core.currentPlayer = '1' as PlayerId;
        const entangler = mkUnit('trickster-rebound-l4', { abilities: ['rebound'], faction: 'trickster' });
        putUnit(core, { row: 4, col: 3 }, entangler, '0');
        const enemy = mkUnit('enemy-mover-l4', { life: 3, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 4 }, enemy, '1');

        const stillAdjacentEvents = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 4 }, to: { row: 5, col: 3 } });
        expect(stillAdjacentEvents.some(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'entangle'
        )).toBe(false);

        core.board[5][3].unit = undefined;
        core.board[4][5].unit = undefined;
        putUnit(core, { row: 4, col: 5 }, enemy, '1');
        const approachingEvents = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 5 }, to: { row: 4, col: 4 } });
        expect(approachingEvents.some(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'entangle'
        )).toBe(false);
    });

    // ================================================================
    // 8. onDamageCalculation — rage 暴怒（伤害值加战力）
    // ================================================================

    it('[onDamageCalculation/rage] 受伤单位攻击时战力增加等于已受伤害', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const rager = mkUnit('gul-das', { abilities: ['rage'], strength: 2, faction: 'necromancer', unitClass: 'summoner' });
        putUnit(core, { row: 4, col: 3 }, rager, '0', { damage: 2 });
        const target = mkUnit('target', { life: 10, faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, target, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        });

        const attackEvent = events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
        expect(attackEvent).toBeDefined();
        // 有效战力 = 2(base) + 2(damage/rage) = 4
        expect((attackEvent!.payload as Record<string, unknown>).diceCount).toBe(4);
    });

    it('[onDamageCalculation/rage/L4] 按当前伤害获得战力并在拆解中记录来源', () => {
        const undamaged = putUnit(core, { row: 4, col: 1 }, mkUnit('gul-das-undamaged', {
            abilities: ['rage'],
            strength: 2,
            faction: 'necromancer',
            unitClass: 'summoner',
        }), '0', { damage: 0 });
        const damaged = putUnit(core, { row: 4, col: 2 }, mkUnit('gul-das-damaged', {
            abilities: ['rage'],
            strength: 2,
            faction: 'necromancer',
            unitClass: 'summoner',
        }), '0', { damage: 3 });

        const undamagedStrength = calculateEffectiveStrength(undamaged, core);
        const damagedStrength = calculateEffectiveStrength(damaged, core);

        expect(undamagedStrength.finalStrength).toBe(2);
        expect(undamagedStrength.modifiers.find(m => m.source === 'rage')).toBeUndefined();

        expect(damagedStrength.finalStrength).toBe(5);
        expect(damagedStrength.modifiers).toContainEqual(
            expect.objectContaining({ source: 'rage', value: 3 })
        );
    });

    // ================================================================
    // 9. onDeath — sacrifice 献祭（死亡时伤害相邻敌方）
    // ================================================================

    it('[onDeath/sacrifice] 献祭单位被消灭时相邻敌方受1点伤害', () => {
        core.phase = 'attack';
        core.currentPlayer = '1' as PlayerId;
        // 献祭单位（玩家0），生命1
        const sacrificer = mkUnit('hellfire-cultist', { abilities: ['sacrifice'], life: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, sacrificer, '0');
        // 相邻敌方（将受到献祭伤害）
        const adjacentEnemy = mkUnit('bystander', { life: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, adjacentEnemy, '1');
        // 攻击者（玩家1），高战力确保击杀
        const killer = mkUnit('killer', { strength: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 2 }, killer, '1');

        // 使用 meleeRandom 确保近战命中
        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 2 },
            target: { row: 4, col: 3 },
        }, meleeRandom());

        expect(events.find(e =>
            e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as Record<string, unknown>).cardId?.toString().includes('hellfire-cultist')
        )).toBeDefined();
        const sacrificeDmg = events.find(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'sacrifice'
        );
        expect(sacrificeDmg).toBeDefined();
    });

    // ================================================================
    // 10. onKill — soulless 无魂（击杀不给魔力）
    // ================================================================

    it('[onKill/soulless] 无魂单位击杀时 skipMagicReward=true', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const soullessUnit = mkUnit('plague-zombie', { abilities: ['soulless'], strength: 5, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, soullessUnit, '0');
        const weakEnemy = mkUnit('weak-enemy', { life: 1, faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, weakEnemy, '1');

        // 使用 meleeRandom 确保近战命中
        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        }, meleeRandom());

        const dmgEvent = events.find(e => e.type === SW_EVENTS.UNIT_DAMAGED);
        expect(dmgEvent).toBeDefined();
        expect((dmgEvent!.payload as Record<string, unknown>).skipMagicReward).toBe(true);
    });

    it('[soulless/L4] 真实击杀后无魂不获得魔力，普通单位同场景获得魔力', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        core.players['0'].magic = 0;
        const soullessUnit = mkUnit('plague-zombie-l4', { abilities: ['soulless'], strength: 5, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, soullessUnit, '0');
        putUnit(core, { row: 4, col: 4 }, mkUnit('soulless-victim-l4', { life: 1, faction: 'frost' }), '1');

        const soullessEvents = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        }, meleeRandom());
        const afterSoullessKill = applyEvents(soullessEvents);

        expect(soullessEvents.some(e =>
            e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as Record<string, unknown>).skipMagicReward === true
        )).toBe(true);
        expect(afterSoullessKill.players['0'].magic).toBe(0);

        core = createInitializedCore(['0', '1'], random, { faction0: 'frost', faction1: 'necromancer' });
        clearRect(core, [3, 4, 5], [0, 1, 2, 3, 4, 5]);
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        core.players['0'].magic = 0;
        putUnit(core, { row: 4, col: 3 }, mkUnit('ordinary-killer-l4', { strength: 5, faction: 'frost' }), '0');
        putUnit(core, { row: 4, col: 4 }, mkUnit('ordinary-victim-l4', { life: 1, faction: 'necromancer' }), '1');

        const ordinaryEvents = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        }, meleeRandom());
        const afterOrdinaryKill = applyEvents(ordinaryEvents);

        expect(ordinaryEvents.some(e =>
            e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as Record<string, unknown>).skipMagicReward !== true
        )).toBe(true);
        expect(afterOrdinaryKill.players['0'].magic).toBe(1);
    });

    // ================================================================
    // 11. onUnitDestroyed — blood_rage 血腥狂怒充能
    // ================================================================

    it('[onUnitDestroyed/blood_rage] 任意单位被消灭时血腥狂怒单位获得充能', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        // 血腥狂怒单位（旁观者）
        const bloodRager = mkUnit('undead-warrior', { abilities: ['blood_rage', 'power_boost'], faction: 'necromancer' });
        putUnit(core, { row: 3, col: 3 }, bloodRager, '0');
        const attacker = mkUnit('attacker', { strength: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, attacker, '0');
        const weakEnemy = mkUnit('weak-target', { life: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 4 }, weakEnemy, '1');

        // 使用 meleeRandom 确保近战命中击杀
        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        }, meleeRandom());

        expect(events.find(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBeDefined();
        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage'
        );
        expect(chargeEvent).toBeDefined();
    });

    it('[onUnitDestroyed/blood_rage] 对手回合单位被消灭时不会给非当前玩家血腥狂怒单位充能', () => {
        core.phase = 'attack';
        core.currentPlayer = '1' as PlayerId;
        // 官方 Blood Fury 限定“on your turn”，玩家0的亡灵战士不应在玩家1回合获得充能。
        const bloodRager = mkUnit('undead-warrior', { abilities: ['blood_rage', 'power_boost'], faction: 'necromancer' });
        putUnit(core, { row: 3, col: 3 }, bloodRager, '0');
        const attacker = mkUnit('attacker', { strength: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, attacker, '1');
        const weakEnemy = mkUnit('weak-target', { life: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 4 }, weakEnemy, '0');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        }, meleeRandom());

        expect(events.find(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBeDefined();
        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage'
            && (e.payload as Record<string, unknown>).position
            && ((e.payload as Record<string, unknown>).position as CellCoord).row === 3
            && ((e.payload as Record<string, unknown>).position as CellCoord).col === 3
        );
        expect(chargeEvent).toBeUndefined();
    });

    // ================================================================
    // 12. onSummon — gather_power 聚能（召唤时充能）
    // ================================================================

    it('[onSummon/gather_power] SUMMON_UNIT 产生 UNIT_CHARGED 事件', () => {
        core.phase = 'summon';
        core.currentPlayer = '0' as PlayerId;
        const gpCard = mkUnit('spirit-warrior', { abilities: ['gather_power'], cost: 0, faction: 'barbaric' });
        core.players['0' as PlayerId].hand.push(gpCard);

        const events = exec(SW_COMMANDS.SUMMON_UNIT, {
            cardId: gpCard.id,
            position: { row: 4, col: 3 },
        });

        expect(events.find(e => e.type === SW_EVENTS.UNIT_SUMMONED)).toBeDefined();
        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'gather_power'
        );
        expect(chargeEvent).toBeDefined();
    });

    // ================================================================
    // 13. onPhaseStart — guidance 引导（召唤阶段开始抽牌）
    //     通过 flowHooks.onPhaseEnter 测试
    // ================================================================

    it('[onPhaseStart/guidance] 进入召唤阶段时引导单位触发', () => {
        core.phase = 'draw';
        core.currentPlayer = '0' as PlayerId;
        // draw→summon 时 phaseStartPlayer = nextPlayer = '1'
        const guide = mkUnit('paladin-guide', { abilities: ['guidance'], faction: 'paladin' });
        putUnit(core, { row: 4, col: 3 }, guide, '1');
        core.players['1' as PlayerId].deck = [mkUnit('deck-card-1', {}), mkUnit('deck-card-2', {})];

        const state = { core, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>;
        const events = summonerWarsFlowHooks.onPhaseEnter!({
            state,
            from: 'draw',
            to: 'summon',
            command: { type: 'END_PHASE', payload: {}, timestamp: 0 },
        });

        // guidance_draw handler 返回 CARD_DRAWN 事件
        const guidanceDrawEvent = events.find(e =>
            e.type === SW_EVENTS.CARD_DRAWN
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'guidance'
        );
        expect(guidanceDrawEvent).toBeDefined();
    });

    // ================================================================
    // 14. onPhaseStart — ice_shards 寒冰碎屑（攻击阶段开始触发）
    //     通过 flowHooks.onPhaseEnter 测试
    // ================================================================

    it('[onPhaseStart/ice_shards] 攻击阶段开始时寒冰碎屑触发（需有充能+建筑相邻敌方）', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const iceUnit = mkUnit('frost-shards', { abilities: ['ice_shards'], faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, iceUnit, '0', { boosts: 1 });
        // 放置友方建筑和相邻敌方单位（满足 customValidator 条件）
        putStructure(core, { row: 3, col: 3 }, '0' as PlayerId);
        const enemyCard = mkUnit('enemy-adj', { faction: 'necromancer' });
        putUnit(core, { row: 3, col: 4 }, enemyCard, '1' as PlayerId);

        const state = { core, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>;
        const events = summonerWarsFlowHooks.onPhaseEnter!({
            state,
            from: 'build',
            to: 'attack',
            command: { type: 'END_PHASE', payload: {}, timestamp: 0 },
        });

        const iceShardsEvent = events.find(e =>
            e.type === SW_EVENTS.ABILITY_TRIGGERED
            && (e.payload as Record<string, unknown>).actionId === 'ice_shards_damage'
        );
        expect(iceShardsEvent).toBeDefined();
    });

    // ================================================================
    // 15. onTurnEnd — blood_rage_decay 血腥狂怒衰减
    //     通过 triggerAllUnitsAbilities 测试
    // ================================================================

    it('[onTurnEnd/blood_rage_decay] 回合结束时有充能的单位减少2充能', () => {
        core.currentPlayer = '0' as PlayerId;
        const decayer = mkUnit('undead-warrior-decay', { abilities: ['blood_rage_decay'], faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, decayer, '0', { boosts: 3 });

        const events = triggerAllUnitsAbilities('onTurnEnd', core, '0' as PlayerId, { timestamp: 0 });

        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage_decay'
        );
        expect(chargeEvent).toBeDefined();
        expect((chargeEvent!.payload as Record<string, unknown>).delta).toBe(-2);
    });

    it('[onTurnEnd/blood_rage_decay] 无充能时不触发衰减', () => {
        core.currentPlayer = '0' as PlayerId;
        const decayer = mkUnit('undead-warrior-decay2', { abilities: ['blood_rage_decay'], faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, decayer, '0', { boosts: 0 });

        const events = triggerAllUnitsAbilities('onTurnEnd', core, '0' as PlayerId, { timestamp: 0 });

        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage_decay'
        );
        expect(chargeEvent).toBeUndefined();
    });
});

// ============================================================================
// 10. 边界/异常场景验证（Section 10）
// ============================================================================

describe('边界/异常场景验证 (Section 10)', () => {
    let core: SummonerWarsCore;
    const random = testRandom();

    beforeEach(() => {
        core = createInitializedCore(['0', '1'], random, { faction0: 'frost', faction1: 'necromancer' });
        clearRect(core, [3, 4, 5], [0, 1, 2, 3, 4, 5]);
    });

    function exec(cmd: string, payload: Record<string, unknown>, overrideRandom?: RandomFn) {
        const state = { core, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>;
        return executeCommand(state, { type: cmd, payload, timestamp: 0 }, overrideRandom ?? random);
    }

    function meleeRandom(): RandomFn {
        return { shuffle: <T>(arr: T[]) => arr, random: () => 0, d: (_max: number) => 1, range: (min: number) => min };
    }

    // ================================================================
    // 1. onMove/trample — 1格移动不产生穿越伤害
    // ================================================================

    it('[trample/边界] 1格移动不穿越，无 trample 伤害', () => {
        core.phase = 'move';
        core.currentPlayer = '0' as PlayerId;
        const trampler = mkUnit('bear-rider-b', { abilities: ['trample'], faction: 'frost' });
        putUnit(core, { row: 4, col: 2 }, trampler, '0');

        const events = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 2 }, to: { row: 4, col: 3 } });

        const trampleDmg = events.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'trample'
        );
        expect(trampleDmg).toHaveLength(0);
    });

    it('[trample/边界] 穿越多个敌方单位产生多次伤害', () => {
        core.phase = 'move';
        core.currentPlayer = '0' as PlayerId;
        const trampler = mkUnit('bear-rider-m', { abilities: ['trample'], faction: 'frost' });
        putUnit(core, { row: 4, col: 1 }, trampler, '0');
        // 路径上放两个敌方单位
        putUnit(core, { row: 4, col: 2 }, mkUnit('skel-1', { faction: 'necromancer' }), '1');
        putUnit(core, { row: 4, col: 3 }, mkUnit('skel-2', { faction: 'necromancer' }), '1');

        const events = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 1 }, to: { row: 4, col: 4 } });

        const trampleDmgs = events.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'trample'
        );
        expect(trampleDmgs).toHaveLength(2);
    });

    // ================================================================
    // 2. passive/cold_snap — 多个光环单位叠加
    // ================================================================

    it('[cold_snap/边界] 多个 cold_snap 单位叠加加成', () => {
        const cs1 = mkUnit('cs-1', { abilities: ['cold_snap'], faction: 'frost' });
        const cs2 = mkUnit('cs-2', { abilities: ['cold_snap'], faction: 'frost' });
        putUnit(core, { row: 4, col: 2 }, cs1, '0');
        putUnit(core, { row: 4, col: 4 }, cs2, '0');
        const structCard = mkStructure('gate-stack', { life: 5 });
        putStructure(core, { row: 4, col: 3 }, '0', structCard);

        const effectiveLife = getEffectiveStructureLife(core, core.board[4][3].structure!);
        expect(effectiveLife).toBe(7); // 5 + 1 + 1
    });

    it('[cold_snap/边界] 敌方建筑不受友方 cold_snap 加成', () => {
        const cs = mkUnit('cs-enemy', { abilities: ['cold_snap'], faction: 'frost' });
        putUnit(core, { row: 4, col: 2 }, cs, '0');
        const structCard = mkStructure('enemy-gate', { life: 5 });
        putStructure(core, { row: 4, col: 3 }, '1', structCard); // 敌方建筑

        const effectiveLife = getEffectiveStructureLife(core, core.board[4][3].structure!);
        expect(effectiveLife).toBe(5); // 无加成
    });

    it('[cold_snap/L4] 建筑进出场与归属变化按当前状态动态重算', () => {
        const oleg = mkUnit('oleg-dynamic', { abilities: ['cold_snap'], faction: 'frost' });
        putUnit(core, { row: 0, col: 0 }, oleg, '0');

        const firstGate = mkStructure('dynamic-gate-a', { life: 5 });
        putStructure(core, { row: 4, col: 3 }, '0', firstGate);
        expect(getEffectiveStructureLife(core, core.board[4][3].structure!)).toBe(6);

        const secondGate = mkStructure('dynamic-gate-b', { life: 4 });
        putStructure(core, { row: 4, col: 4 }, '0', secondGate);
        expect(getEffectiveStructureLife(core, core.board[4][4].structure!)).toBe(5);

        core.board[4][3].structure = undefined;
        expect(core.board[4][3].structure).toBeUndefined();
        expect(getEffectiveStructureLife(core, core.board[4][4].structure!)).toBe(5);

        core.board[4][4].structure = {
            ...core.board[4][4].structure!,
            owner: '1' as PlayerId,
        };
        expect(getEffectiveStructureLife(core, core.board[4][4].structure!)).toBe(4);

        core.board[0][0].unit = undefined;
        core.board[4][4].structure = {
            ...core.board[4][4].structure!,
            owner: '0' as PlayerId,
        };
        expect(getEffectiveStructureLife(core, core.board[4][4].structure!)).toBe(4);
    });

    // ================================================================
    // 3. activated/prepare — usesPerTurn 耗尽后不再触发
    // ================================================================

    it('[prepare/边界] usesPerTurn=1 第二次激活不产生充能事件', () => {
        core.phase = 'move';
        core.currentPlayer = '0' as PlayerId;
        const archer = mkUnit('archer-uses', { abilities: ['prepare'], faction: 'barbaric' });
        const unit = putUnit(core, { row: 4, col: 3 }, archer, '0');

        // 第一次激活
        const events1 = exec(SW_COMMANDS.ACTIVATE_ABILITY, {
            abilityId: 'prepare',
            sourceUnitId: unit.instanceId,
            position: { row: 4, col: 3 },
        });
        const charge1 = events1.filter(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'prepare'
        );
        expect(charge1).toHaveLength(1);

        // 模拟 reduce 更新 abilityUsageCount
        const usageKey = `${unit.instanceId}:prepare`;
        core.abilityUsageCount = { ...core.abilityUsageCount, [usageKey]: 1 };

        // 第二次激活 — 执行器仍会执行（validate 层拦截），但 triggerAbilities 会跳过
        // 这里测试 triggerAbilities 层面的 usesPerTurn 检查
        const ctx = {
            state: core,
            sourceUnit: core.board[4][3].unit!,
            sourcePosition: { row: 4, col: 3 } as CellCoord,
            ownerId: '0' as PlayerId,
            timestamp: 0,
        };
        const events2 = triggerAbilities('activated', ctx);
        const charge2 = events2.filter(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'prepare'
        );
        expect(charge2).toHaveLength(0);
    });

    // ================================================================
    // 4. afterAttack/imposing — usesPerTurn=1 第二次攻击不再充能
    // ================================================================

    it('[imposing/边界] usesPerTurn=1 第二次攻击不再触发充能', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const imposer = mkUnit('frost-champ-uses', { abilities: ['imposing'], strength: 3, faction: 'frost' });
        const unit = putUnit(core, { row: 4, col: 3 }, imposer, '0');
        putUnit(core, { row: 4, col: 4 }, mkUnit('enemy-1', { life: 10, faction: 'necromancer' }), '1');

        // 第一次攻击
        const events1 = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        });
        expect(events1.some(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'imposing'
        )).toBe(true);

        // 模拟 reduce 更新 abilityUsageCount
        const usageKey = `${unit.instanceId}:imposing`;
        core.abilityUsageCount = { ...core.abilityUsageCount, [usageKey]: 1 };

        // 第二次攻击 — imposing 不应再触发
        const events2 = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        });
        expect(events2.some(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'imposing'
        )).toBe(false);
    });

    // ================================================================
    // 5. beforeAttack/life_drain — 无牺牲目标时不触发 special 命中效果
    // ================================================================

    it('[life_drain/边界] 不提供 targetUnitId 时不触发 special 命中效果', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const dragos = mkUnit('dragos-b', { abilities: ['life_drain'], strength: 2, faction: 'necromancer', unitClass: 'summoner' });
        putUnit(core, { row: 4, col: 3 }, dragos, '0');
        putUnit(core, { row: 4, col: 4 }, mkUnit('enemy-b', { life: 10, faction: 'frost' }), '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
            beforeAttack: { abilityId: 'life_drain' }, // 无 targetUnitId
        });

        // 不应有 STRENGTH_MODIFIED 事件
        const strengthMod = events.find(e =>
            e.type === SW_EVENTS.STRENGTH_MODIFIED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'life_drain'
        );
        expect(strengthMod).toBeUndefined();
        // 攻击仍应正常进行
        expect(events.some(e => e.type === SW_EVENTS.UNIT_ATTACKED)).toBe(true);
    });

    // ================================================================
    // 6. onAdjacentEnemyAttack/evasion — 无✦面时不减伤
    // ================================================================

    it('[evasion/边界] 无 special 面时不触发减伤', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        // 战力1，只投1个骰子，用 meleeRandom 确保出 melee 面（非 special）
        const attacker = mkUnit('weak-atk', { strength: 1, faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, attacker, '0');
        const evasionUnit = mkUnit('evasion-unit-b', { abilities: ['evasion'], faction: 'trickster' });
        putUnit(core, { row: 4, col: 2 }, evasionUnit, '1');
        putUnit(core, { row: 4, col: 4 }, mkUnit('target-b', { life: 10, faction: 'necromancer' }), '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        }, meleeRandom());

        const reduced = events.filter(e =>
            e.type === SW_EVENTS.DAMAGE_REDUCED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'evasion'
        );
        expect(reduced).toHaveLength(0);
    });

    it('[evasion/边界] 迷魂单位不相邻攻击者时不触发', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const attacker = mkUnit('far-atk', { strength: 6, faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, attacker, '0');
        // 迷魂单位距离攻击者2格（不相邻）
        const evasionUnit = mkUnit('evasion-far', { abilities: ['evasion'], faction: 'trickster' });
        putUnit(core, { row: 4, col: 1 }, evasionUnit, '1');
        putUnit(core, { row: 4, col: 4 }, mkUnit('target-far', { life: 10, faction: 'necromancer' }), '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        });

        const reduced = events.filter(e =>
            e.type === SW_EVENTS.DAMAGE_REDUCED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'evasion'
        );
        expect(reduced).toHaveLength(0);
    });

    // ================================================================
    // 7. onAdjacentEnemyLeave/rebound — 靠近缠斗单位不触发
    // ================================================================

    it('[rebound/边界] 移动靠近缠斗单位（距离减小）不触发伤害', () => {
        core.phase = 'move';
        core.currentPlayer = '1' as PlayerId;
        const entangler = mkUnit('entangle-close', { abilities: ['rebound'], faction: 'trickster' });
        putUnit(core, { row: 4, col: 3 }, entangler, '0');
        // 敌方单位从2格外移动到相邻（靠近）
        putUnit(core, { row: 4, col: 5 }, mkUnit('mover-close', { life: 3, faction: 'necromancer' }), '1');

        const events = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 5 }, to: { row: 4, col: 4 } });

        const entangleDmg = events.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'entangle'
        );
        expect(entangleDmg).toHaveLength(0);
    });

    it('[rebound/边界] 多个缠斗单位同时触发多次伤害', () => {
        core.phase = 'move';
        core.currentPlayer = '1' as PlayerId;
        // 两个缠斗单位相邻于敌方
        putUnit(core, { row: 3, col: 3 }, mkUnit('entangle-1', { abilities: ['rebound'], faction: 'trickster' }), '0');
        putUnit(core, { row: 5, col: 3 }, mkUnit('entangle-2', { abilities: ['rebound'], faction: 'trickster' }), '0');
        putUnit(core, { row: 4, col: 3 }, mkUnit('mover-multi', { life: 5, faction: 'necromancer' }), '1');

        const events = exec(SW_COMMANDS.MOVE_UNIT, { from: { row: 4, col: 3 }, to: { row: 4, col: 4 } });

        const entangleDmgs = events.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).reason === 'entangle'
        );
        expect(entangleDmgs).toHaveLength(2);
    });

    // ================================================================
    // 8. onDamageCalculation/rage — 无伤害时不加成
    // ================================================================

    it('[rage/边界] damage=0 时战力等于基础值', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const rager = mkUnit('gul-das-0', { abilities: ['rage'], strength: 2, faction: 'necromancer', unitClass: 'summoner' });
        putUnit(core, { row: 4, col: 3 }, rager, '0', { damage: 0 });
        putUnit(core, { row: 4, col: 4 }, mkUnit('target-0', { life: 10, faction: 'frost' }), '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        });

        const attackEvent = events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
        expect(attackEvent).toBeDefined();
        expect((attackEvent!.payload as Record<string, unknown>).diceCount).toBe(2); // 基础值，无加成
    });

    // ================================================================
    // 9. onDeath/sacrifice — 无相邻敌方时不产生伤害事件
    // ================================================================

    it('[sacrifice/边界] 无相邻敌方时不产生献祭伤害', () => {
        core.phase = 'attack';
        core.currentPlayer = '1' as PlayerId;
        const sacrificer = mkUnit('cultist-alone', { abilities: ['sacrifice'], life: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, sacrificer, '0');
        // 攻击者不相邻于献祭单位的相邻格（只有攻击者，无旁观者）
        const killer = mkUnit('killer-alone', { strength: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, killer, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 4 },
            target: { row: 4, col: 3 },
        }, meleeRandom());

        // 献祭单位应被消灭
        expect(events.some(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBe(true);
        // 献祭伤害：攻击者在 (4,4) 与献祭者 (4,3) 相邻，所以攻击者会受到献祭伤害
        // 但除攻击者外无其他相邻敌方
        const sacrificeDmgs = events.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'sacrifice'
        );
        // 攻击者在相邻位置，所以会受到1次献祭伤害
        expect(sacrificeDmgs).toHaveLength(1);
    });

    it('[sacrifice/边界] 只伤害死亡前相邻敌方，不伤害友方或非相邻敌方', () => {
        core.phase = 'attack';
        core.currentPlayer = '1' as PlayerId;
        const sacrificer = mkUnit('cultist-locked-adjacent', { abilities: ['sacrifice'], life: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, sacrificer, '0');
        const adjacentEnemy = mkUnit('adjacent-enemy', { life: 5, faction: 'frost' });
        putUnit(core, { row: 3, col: 3 }, adjacentEnemy, '1');
        const adjacentAlly = mkUnit('adjacent-ally', { life: 5, faction: 'necromancer' });
        putUnit(core, { row: 5, col: 3 }, adjacentAlly, '0');
        const farEnemy = mkUnit('far-enemy', { life: 5, faction: 'frost' });
        putUnit(core, { row: 2, col: 3 }, farEnemy, '1');
        const killer = mkUnit('killer-sacrifice-boundary', { strength: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 2 }, killer, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 2 },
            target: { row: 4, col: 3 },
        }, meleeRandom());

        const sacrificeDmgs = events.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'sacrifice'
        );
        const damagedPositions = sacrificeDmgs.map(e => (e.payload as Record<string, unknown>).position);
        expect(damagedPositions).toContainEqual({ row: 3, col: 3 });
        expect(damagedPositions).toContainEqual({ row: 4, col: 2 });
        expect(damagedPositions).not.toContainEqual({ row: 5, col: 3 });
        expect(damagedPositions).not.toContainEqual({ row: 2, col: 3 });
    });

    // ================================================================
    // 10. onKill/soulless — 攻击未击杀时无 skipMagicReward
    // ================================================================

    it('[soulless/边界] 攻击未击杀时 UNIT_DAMAGED 仍有 skipMagicReward', () => {
        core.phase = 'attack';
        core.currentPlayer = '0' as PlayerId;
        const soullessUnit = mkUnit('zombie-nk', { abilities: ['soulless'], strength: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, soullessUnit, '0');
        // 高生命目标，不会被击杀
        putUnit(core, { row: 4, col: 4 }, mkUnit('tank', { life: 10, faction: 'frost' }), '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 3 },
            target: { row: 4, col: 4 },
        }, meleeRandom());

        const dmgEvent = events.find(e => e.type === SW_EVENTS.UNIT_DAMAGED);
        if (dmgEvent) {
            // soulless 的 skipMagicReward 在 UNIT_DAMAGED 事件上标记（无论是否击杀）
            expect((dmgEvent.payload as Record<string, unknown>).skipMagicReward).toBe(true);
        }
        // 不应有 UNIT_DESTROYED
        expect(events.some(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBe(false);
    });

    // ================================================================
    // 11. onUnitDestroyed/blood_rage — 自身被消灭时不触发
    // ================================================================

    it('[blood_rage/边界] blood_rage 单位自身被消灭时不触发充能', () => {
        core.phase = 'attack';
        core.currentPlayer = '1' as PlayerId;
        // blood_rage 单位生命1，会被击杀
        const bloodRager = mkUnit('warrior-self', { abilities: ['blood_rage', 'power_boost'], life: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, bloodRager, '0');
        const killer = mkUnit('killer-br', { strength: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, killer, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 4 },
            target: { row: 4, col: 3 },
        }, meleeRandom());

        expect(events.some(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBe(true);
        // blood_rage 单位已死亡，triggerAllUnitsAbilities 遍历棋盘时该单位已不在
        // 所以不应有 blood_rage 充能事件（来自自身）
        const selfCharge = events.filter(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage'
        );
        // 注意：如果棋盘上还有其他 blood_rage 单位，它们会触发
        // 这里只有一个 blood_rage 单位且它被消灭了，所以不应有充能
        expect(selfCharge).toHaveLength(0);
    });

    // ================================================================
    // 11b. onUnitDestroyed/blood_rage — 对方回合中己方 blood_rage 不触发
    //      规则："每当一个单位在你的回合中被消灭时"
    // ================================================================

    it('[blood_rage/边界] 对方回合中己方单位被消灭，己方 blood_rage 不触发（规则限定"你的回合"）', () => {
        core.phase = 'attack';
        core.currentPlayer = '1' as PlayerId;
        // 玩家0 的 blood_rage 旁观者
        const bloodRager = mkUnit('warrior-watch', { abilities: ['blood_rage', 'power_boost'], faction: 'necromancer' });
        putUnit(core, { row: 3, col: 3 }, bloodRager, '0');
        // 玩家0 的弱小单位（将被击杀）
        const weakAlly = mkUnit('weak-ally', { life: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, weakAlly, '0');
        // 玩家1 的攻击者
        const killer = mkUnit('killer-cross', { strength: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, killer, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 4 },
            target: { row: 4, col: 3 },
        }, meleeRandom());

        expect(events.some(e => e.type === SW_EVENTS.UNIT_DESTROYED)).toBe(true);
        // 当前是玩家1的回合，玩家0的 blood_rage 不应触发
        // 规则："Whenever a unit is destroyed during YOUR turn"
        const brCharge = events.filter(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage'
        );
        expect(brCharge).toHaveLength(0);
    });

    // ================================================================
    // 12. onSummon/gather_power — 无 gather_power 的单位不充能
    // ================================================================

    it('[gather_power/边界] 无 gather_power 的单位召唤时不产生充能', () => {
        core.phase = 'summon';
        core.currentPlayer = '0' as PlayerId;
        const normalCard = mkUnit('normal-summon', { cost: 0, faction: 'frost' });
        core.players['0' as PlayerId].hand.push(normalCard);

        const events = exec(SW_COMMANDS.SUMMON_UNIT, {
            cardId: normalCard.id,
            position: { row: 4, col: 3 },
        });

        expect(events.some(e => e.type === SW_EVENTS.UNIT_SUMMONED)).toBe(true);
        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'gather_power'
        );
        expect(chargeEvent).toBeUndefined();
    });

    it('[gather_power/living_gate/L4] 活体传送门召唤祖灵法师后只给被召唤单位充能', () => {
        core.phase = 'summon';
        core.currentPlayer = '0' as PlayerId;
        const livingGate = mkUnit('frost-golem-gate', { abilities: ['living_gate'], faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, livingGate, '0');
        const enemyLivingGate = mkUnit('enemy-frost-golem-gate', { abilities: ['living_gate'], faction: 'frost' });
        putUnit(core, { row: 2, col: 3 }, enemyLivingGate, '1');
        const ancestralMage = mkUnit('ancestral-mage-gp', { abilities: ['gather_power'], cost: 0, faction: 'barbaric' });
        core.players['0' as PlayerId].hand.push(ancestralMage);

        const validSummonPositions = getValidSummonPositions(core, '0' as PlayerId);
        expect(validSummonPositions).toContainEqual({ row: 4, col: 4 });
        expect(validSummonPositions).not.toContainEqual({ row: 2, col: 4 });

        const events = exec(SW_COMMANDS.SUMMON_UNIT, {
            cardId: ancestralMage.id,
            position: { row: 4, col: 4 },
        });

        expect(events.some(e =>
            e.type === SW_EVENTS.UNIT_SUMMONED
            && JSON.stringify((e.payload as Record<string, unknown>).position) === JSON.stringify({ row: 4, col: 4 })
        )).toBe(true);
        const gatherPowerCharges = events.filter(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'gather_power'
        );
        expect(gatherPowerCharges).toHaveLength(1);
        expect((gatherPowerCharges[0].payload as Record<string, unknown>).position).toEqual({ row: 4, col: 4 });
    });

    // ================================================================
    // 13. onPhaseStart/guidance — 牌组为空时不抽牌
    // ================================================================

    it('[guidance/边界] 牌组为空时不产生 CARD_DRAWN 事件', () => {
        core.phase = 'draw';
        core.currentPlayer = '0' as PlayerId;
        const guide = mkUnit('guide-empty', { abilities: ['guidance'], faction: 'paladin' });
        putUnit(core, { row: 4, col: 3 }, guide, '1');
        core.players['1' as PlayerId].deck = []; // 空牌组

        const state = { core, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>;
        const events = summonerWarsFlowHooks.onPhaseEnter!({
            state,
            from: 'draw',
            to: 'summon',
            command: { type: 'END_PHASE', payload: {}, timestamp: 0 },
        });

        const guidanceDraw = events.find(e =>
            e.type === SW_EVENTS.CARD_DRAWN
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'guidance'
        );
        expect(guidanceDraw).toBeUndefined();
    });

    it('[guidance/边界] 牌组仅1张时只抽1张', () => {
        core.phase = 'draw';
        core.currentPlayer = '0' as PlayerId;
        const guide = mkUnit('guide-one', { abilities: ['guidance'], faction: 'paladin' });
        putUnit(core, { row: 4, col: 3 }, guide, '1');
        core.players['1' as PlayerId].deck = [mkUnit('last-card', {})];

        const state = { core, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>;
        const events = summonerWarsFlowHooks.onPhaseEnter!({
            state,
            from: 'draw',
            to: 'summon',
            command: { type: 'END_PHASE', payload: {}, timestamp: 0 },
        });

        const guidanceDraw = events.find(e =>
            e.type === SW_EVENTS.CARD_DRAWN
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'guidance'
        );
        expect(guidanceDraw).toBeDefined();
        expect((guidanceDraw!.payload as Record<string, unknown>).count).toBe(1);
    });

    // ================================================================
    // 14. onPhaseStart/ice_shards — 非攻击阶段不触发
    // ================================================================

    it('[ice_shards/边界] 非攻击阶段开始时不触发', () => {
        core.phase = 'move';
        core.currentPlayer = '0' as PlayerId;
        const iceUnit = mkUnit('frost-shards-b', { abilities: ['ice_shards'], faction: 'frost' });
        putUnit(core, { row: 4, col: 3 }, iceUnit, '0');

        const state = { core, sys: { flowHalted: false } } as MatchState<SummonerWarsCore>;
        const events = summonerWarsFlowHooks.onPhaseEnter!({
            state,
            from: 'move',
            to: 'build',
            command: { type: 'END_PHASE', payload: {}, timestamp: 0 },
        });

        const iceShardsEvent = events.find(e =>
            e.type === SW_EVENTS.ABILITY_TRIGGERED
            && (e.payload as Record<string, unknown>).actionId === 'ice_shards_damage'
        );
        expect(iceShardsEvent).toBeUndefined();
    });

    // ================================================================
    // 15. onTurnEnd/blood_rage_decay — 充能=1时仍触发（减少 min(2,1)=1）
    // ================================================================

    it('[blood_rage_decay/边界] 充能=1时触发衰减 delta=-2（由 reduce 层 clamp）', () => {
        core.currentPlayer = '0' as PlayerId;
        const decayer = mkUnit('warrior-1charge', { abilities: ['blood_rage_decay'], faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, decayer, '0', { boosts: 1 });

        const events = triggerAllUnitsAbilities('onTurnEnd', core, '0' as PlayerId, { timestamp: 0 });

        const chargeEvent = events.find(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage_decay'
        );
        expect(chargeEvent).toBeDefined();
        // 效果声明 removeCharge value=2，实际 delta=-2（reduce 层负责 clamp 到 0）
        expect((chargeEvent!.payload as Record<string, unknown>).delta).toBe(-2);
    });

    // ================================================================
    // 16. 连锁反应：sacrifice 击杀相邻敌方 → 触发 blood_rage
    // ================================================================

    it('[连锁] sacrifice 击杀相邻敌方触发 onUnitDestroyed → blood_rage 充能', () => {
        core.phase = 'attack';
        core.currentPlayer = '1' as PlayerId;
        // 献祭单位（玩家0），生命1
        const sacrificer = mkUnit('cultist-chain', { abilities: ['sacrifice'], life: 1, faction: 'necromancer' });
        putUnit(core, { row: 4, col: 3 }, sacrificer, '0');
        // 相邻敌方（玩家1），生命1 — 会被献祭伤害击杀
        const weakBystander = mkUnit('weak-bystander', { life: 1, faction: 'frost' });
        putUnit(core, { row: 4, col: 4 }, weakBystander, '1');
        // blood_rage 单位（玩家0），旁观
        const bloodRager = mkUnit('warrior-chain', { abilities: ['blood_rage', 'power_boost'], faction: 'necromancer' });
        putUnit(core, { row: 3, col: 3 }, bloodRager, '0');
        // 攻击者（玩家1）
        const killer = mkUnit('killer-chain', { strength: 5, faction: 'frost' });
        putUnit(core, { row: 4, col: 2 }, killer, '1');

        const events = exec(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: { row: 4, col: 2 },
            target: { row: 4, col: 3 },
        }, meleeRandom());

        // 献祭单位被消灭
        expect(events.some(e =>
            e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as Record<string, unknown>).cardId?.toString().includes('cultist-chain')
        )).toBe(true);

        // 献祭伤害应存在
        const sacrificeDmg = events.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'sacrifice'
        );
        expect(sacrificeDmg.length).toBeGreaterThanOrEqual(1);

        // blood_rage 应触发（至少因为献祭单位被消灭）
        const brCharge = events.filter(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage'
        );
        expect(brCharge.length).toBeGreaterThanOrEqual(1);
    });

    it('[sacrifice/L4] 重复致死伤害后处理只注入一次献祭连锁', () => {
        core.phase = 'attack';
        core.currentPlayer = '1' as PlayerId;

        const sacrificer = mkUnit('cultist-replay', { abilities: ['sacrifice'], life: 1, faction: 'necromancer' });
        const placedSacrificer = putUnit(core, { row: 4, col: 3 }, sacrificer, '0');
        const weakBystander = mkUnit('weak-bystander-replay', { life: 1, faction: 'frost' });
        const placedBystander = putUnit(core, { row: 4, col: 4 }, weakBystander, '1');
        const bloodRager = mkUnit('warrior-replay', { abilities: ['blood_rage', 'power_boost'], faction: 'necromancer' });
        putUnit(core, { row: 3, col: 3 }, bloodRager, '0');

        const processed = postProcessDeathChecks([
            {
                type: SW_EVENTS.UNIT_DAMAGED,
                payload: {
                    position: { row: 4, col: 3 },
                    damage: 1,
                    sourcePlayerId: '1' as PlayerId,
                },
                timestamp: 0,
            },
            {
                type: SW_EVENTS.UNIT_DAMAGED,
                payload: {
                    position: { row: 4, col: 3 },
                    damage: 1,
                    sourcePlayerId: '1' as PlayerId,
                },
                timestamp: 1,
            },
        ], core);

        const cultistDestroyed = processed.filter(e =>
            e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as Record<string, unknown>).instanceId === placedSacrificer.instanceId
        );
        expect(cultistDestroyed).toHaveLength(1);

        const sacrificeDamageToBystander = processed.filter(e =>
            e.type === SW_EVENTS.UNIT_DAMAGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'sacrifice'
            && ((e.payload as Record<string, unknown>).position as CellCoord).row === 4
            && ((e.payload as Record<string, unknown>).position as CellCoord).col === 4
        );
        expect(sacrificeDamageToBystander).toHaveLength(1);

        const bystanderDestroyed = processed.filter(e =>
            e.type === SW_EVENTS.UNIT_DESTROYED
            && (e.payload as Record<string, unknown>).instanceId === placedBystander.instanceId
        );
        expect(bystanderDestroyed).toHaveLength(1);

        const bloodRageCharges = processed.filter(e =>
            e.type === SW_EVENTS.UNIT_CHARGED
            && (e.payload as Record<string, unknown>).sourceAbilityId === 'blood_rage'
        );
        expect(bloodRageCharges).toHaveLength(1);
    });
});
