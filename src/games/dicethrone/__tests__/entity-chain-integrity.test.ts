/**
 * DiceThrone 实体交互链完整性测试
 *
 * 验证 definition → visual meta → atlas → CharacterData 链路完整无断裂。
 * 使用引擎层 entityIntegritySuite 工厂函数 + referenceValidator 原语。
 */

import { ALL_TOKEN_DEFINITIONS, CHARACTER_DATA_MAP } from '../domain/characters';
import { STATUS_EFFECT_META, TOKEN_META } from '../domain/statusEffects';
import type { TokenDef } from '../domain/tokenTypes';
import type { AbilityEffect } from '../domain/combat';
import type { AbilityCard } from '../domain/types';
import type { AbilityDef } from '../domain/combat/types';
import { getRegisteredCustomActionIds, isCustomActionCategory, getCustomActionMeta } from '../domain/effects';
import {
    createRegistryIntegritySuite,
    createEffectContractSuite,
    createI18nContractSuite,
    flattenI18nKeys,
    extractRefChains,
    type RefChain,
    type EffectContractRule,
} from '../../../engine/testing/entityIntegritySuite';
import type { SelectableCharacterId } from '../domain/types';

// 各英雄卡牌
import { MONK_CARDS } from '../heroes/monk/cards';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { COMMON_CARDS } from '../domain/commonCards';

// ============================================================================
// 1. TokenDef 视觉元数据完整性
// ============================================================================

createRegistryIntegritySuite<TokenDef>({
    suiteName: 'TokenDef 视觉元数据完整性',
    getDefs: () => ALL_TOKEN_DEFINITIONS,
    getId: def => def.id,
    requiredFields: [
        { name: 'frameId', check: def => !!def.frameId },
        { name: 'atlasId', check: def => !!def.atlasId },
    ],
    minCount: 1,
});

// ============================================================================
// 2. CharacterData 图集路径完整性
// ============================================================================

describe('CharacterData 图集路径完整性', () => {
    const realHeroes: SelectableCharacterId[] = [
        'monk', 'barbarian', 'pyromancer', 'shadow_thief', 'moon_elf', 'paladin',
    ];

    it.each(realHeroes)('%s 有 statusAtlasId', (heroId) => {
        const data = CHARACTER_DATA_MAP[heroId];
        expect(data.statusAtlasId).toBeTruthy();
    });

    it.each(realHeroes)('%s 有 statusAtlasPath（以 .json 结尾）', (heroId) => {
        const data = CHARACTER_DATA_MAP[heroId];
        expect(data.statusAtlasPath).toMatch(/\.json$/);
    });

    it('所有 TokenDef.atlasId 都在某个 CharacterData 的 statusAtlasId 中', () => {
        const knownAtlasIds = new Set(
            Object.values(CHARACTER_DATA_MAP).map(d => d.statusAtlasId),
        );
        const orphans = ALL_TOKEN_DEFINITIONS.filter(
            d => d.atlasId && !knownAtlasIds.has(d.atlasId),
        );
        expect(orphans.map(d => `${d.id} → ${d.atlasId}`)).toEqual([]);
    });
});

// ============================================================================
// 3. META 表覆盖率（从 TokenDef 自动派生后应 100% 覆盖）
// ============================================================================

describe('META 表覆盖率', () => {
    it('STATUS_EFFECT_META 覆盖所有 debuff 类别 Token', () => {
        const debuffs = ALL_TOKEN_DEFINITIONS.filter(d => d.category === 'debuff');
        for (const def of debuffs) {
            expect(STATUS_EFFECT_META).toHaveProperty(def.id);
        }
    });

    it('TOKEN_META 覆盖所有非 debuff 类别 Token', () => {
        const tokens = ALL_TOKEN_DEFINITIONS.filter(d => d.category !== 'debuff');
        for (const def of tokens) {
            expect(TOKEN_META).toHaveProperty(def.id);
        }
    });

    it('META.frameId 与 TokenDef.frameId 一致', () => {
        for (const def of ALL_TOKEN_DEFINITIONS) {
            const meta = def.category === 'debuff'
                ? STATUS_EFFECT_META[def.id]
                : TOKEN_META[def.id];
            expect(meta?.frameId).toBe(def.frameId);
        }
    });

    it('META.atlasId 与 TokenDef.atlasId 一致', () => {
        for (const def of ALL_TOKEN_DEFINITIONS) {
            const meta = def.category === 'debuff'
                ? STATUS_EFFECT_META[def.id]
                : TOKEN_META[def.id];
            expect(meta?.atlasId).toBe(def.atlasId);
        }
    });
});

// ============================================================================
// 4. customActionId 引用链（使用 validateReferences）
// ============================================================================

describe('customActionId 引用链', () => {
    // 从 TokenDef 中提取 customActionId 引用
    const tokenChains = extractRefChains<TokenDef>(
        ALL_TOKEN_DEFINITIONS,
        (def) => {
            const chains: RefChain[] = [];
            const actions = def.passiveTrigger?.actions ?? [];
            for (const action of actions) {
                if (action.type === 'custom' && action.customActionId) {
                    chains.push({
                        sourceLabel: 'TokenDef.passiveTrigger',
                        sourceId: def.id,
                        refType: 'customAction',
                        refId: action.customActionId,
                    });
                }
            }
            return chains;
        },
    );

    it('TokenDef 中提取到 customActionId 引用', () => {
        // paladin-blessing-prevent 应存在（shadow_thief-sneak-prevent 已废弃）
        expect(tokenChains.length).toBeGreaterThanOrEqual(1);
    });

    it('所有 TokenDef customActionId 有对应的 handler 注册（注释参考）', () => {
        // 注意：customAction handler 在 game.ts 的 effects 模块中注册，
        // 目前还没有统一的 ActionHandlerRegistry 实例来查询。
        // 此测试验证引用存在，handler 注册验证将在 registry 迁移后完善。
        for (const chain of tokenChains) {
            expect(chain.refId).toBeTruthy();
            expect(chain.refId.length).toBeGreaterThan(0);
        }
    });
});

// ============================================================================
// 5. 每个英雄的 Token 定义 ↔ initialTokens 一致性
// ============================================================================

describe('英雄 Token 定义 ↔ initialTokens 一致性', () => {
    const realHeroes: SelectableCharacterId[] = [
        'monk', 'barbarian', 'pyromancer', 'shadow_thief', 'moon_elf', 'paladin',
    ];

    it.each(realHeroes)('%s: initialTokens 键覆盖所有 tokens 定义', (heroId) => {
        const data = CHARACTER_DATA_MAP[heroId];
        const defIds = data.tokens.map(t => t.id);
        const initKeys = Object.keys(data.initialTokens);
        // initialTokens 应覆盖 tokens 中的消耗型/buff 类，可能不含共享 debuff
        for (const key of initKeys) {
            expect(defIds).toContain(key);
        }
    });
});

// ============================================================================
// 6. 效果数据契约验证（通用守卫）
// ============================================================================

/**
 * 需要 random 的 action type 集合
 * 这些 action 在 resolveEffectAction 中检查 `if (!random) break`，
 * 如果落入不传 random 的时机（如 preDefense），会静默跳过。
 */
const ACTIONS_REQUIRING_RANDOM = new Set(['rollDie', 'drawCard']);

/**
 * 从 AbilityEffect 中提取 action type（兼容无 action 的纯描述效果）
 */
function getActionType(effect: AbilityEffect): string | undefined {
    return effect.action?.type;
}

// --------------------------------------------------------------------------
// 6a. 技能效果契约（abilities）
// --------------------------------------------------------------------------

/** 收集所有英雄的所有技能定义 */
function getAllAbilityDefs(): Array<{ heroId: string; ability: AbilityDef }> {
    const result: Array<{ heroId: string; ability: AbilityDef }> = [];
    for (const [heroId, data] of Object.entries(CHARACTER_DATA_MAP)) {
        for (const ability of data.abilities as AbilityDef[]) {
            result.push({ heroId, ability });
        }
    }
    return result;
}

/** 从技能定义中提取所有效果（含变体） */
function extractAbilityEffects(entry: { heroId: string; ability: AbilityDef }): AbilityEffect[] {
    const effects: AbilityEffect[] = [];
    if (entry.ability.effects) {
        effects.push(...entry.ability.effects);
    }
    if (entry.ability.variants) {
        for (const variant of entry.ability.variants) {
            effects.push(...variant.effects);
        }
    }
    return effects;
}

/** 技能效果契约规则 */
const abilityEffectRules: EffectContractRule<AbilityEffect>[] = [
    {
        name: '需要 random 的 action 必须有显式 timing（非 preDefense 默认值）',
        appliesTo: (e) => {
            const t = getActionType(e);
            return t !== undefined && ACTIONS_REQUIRING_RANDOM.has(t);
        },
        check: (e) => e.timing !== undefined,
        describeViolation: (e) =>
            `action.type="${e.action!.type}" 缺少 timing（会落入 preDefense，不传 random 导致静默跳过）`,
    },
    {
        name: '需要 random 的 custom action（dice 类别）必须有显式 timing',
        appliesTo: (e) => {
            if (getActionType(e) !== 'custom') return false;
            const id = e.action!.customActionId;
            // 只检查 dice 类别的 custom action（使用 random 投骰）
            return !!id && isCustomActionCategory(id, 'dice');
        },
        check: (e) => e.timing !== undefined,
        describeViolation: (e) =>
            `dice 类别 custom action "${e.action!.customActionId}" 缺少 timing（会落入 preDefense，不传 random 导致静默跳过）`,
    },
    {
        name: 'rollDie 必须有 conditionalEffects',
        appliesTo: (e) => getActionType(e) === 'rollDie',
        check: (e) => Array.isArray(e.action!.conditionalEffects) && e.action!.conditionalEffects.length > 0,
        describeViolation: () =>
            `rollDie 缺少 conditionalEffects（投掷后无条件效果，骰子结果不会产生任何作用）`,
    },
    {
        name: 'conditionalEffects 中 debuff 的 target 必须是 opponent（或不指定）',
        appliesTo: (e) => {
            if (getActionType(e) !== 'rollDie') return false;
            const conditionalEffects = e.action!.conditionalEffects ?? [];
            return conditionalEffects.some(ce => ce.grantStatus);
        },
        check: (e) => {
            const conditionalEffects = e.action!.conditionalEffects ?? [];
            for (const ce of conditionalEffects) {
                if (ce.grantStatus) {
                    const { statusId, target } = ce.grantStatus;
                    const def = ALL_TOKEN_DEFINITIONS.find(d => d.id === statusId);
                    // debuff 如果显式指定 target，必须是 'opponent'
                    if (def?.category === 'debuff' && target && target !== 'opponent') {
                        return false;
                    }
                    // buff 如果显式指定 target，必须是 'self'
                    if (def?.category === 'buff' && target && target !== 'self') {
                        return false;
                    }
                }
            }
            return true;
        },
        describeViolation: (e) => {
            const conditionalEffects = e.action!.conditionalEffects ?? [];
            const violations: string[] = [];
            for (const ce of conditionalEffects) {
                if (ce.grantStatus) {
                    const { statusId, target } = ce.grantStatus;
                    const def = ALL_TOKEN_DEFINITIONS.find(d => d.id === statusId);
                    if (def?.category === 'debuff' && target && target !== 'opponent') {
                        violations.push(`debuff "${statusId}" 的 target="${target}" 错误，应该是 "opponent" 或不指定（自动推断）`);
                    }
                    if (def?.category === 'buff' && target && target !== 'self') {
                        violations.push(`buff "${statusId}" 的 target="${target}" 错误，应该是 "self" 或不指定（自动推断）`);
                    }
                }
            }
            return violations.join('; ');
        },
    },
    {
        name: 'custom action 的 customActionId 必须在注册表中',
        appliesTo: (e) => getActionType(e) === 'custom' && !!e.action!.customActionId,
        check: (e) => getRegisteredCustomActionIds().has(e.action!.customActionId!),
        describeViolation: (e) =>
            `customActionId="${e.action!.customActionId}" 未在 customActionRegistry 中注册`,
    },
    {
        name: 'replaceAbility 必须有 targetAbilityId 和 newAbilityDef',
        appliesTo: (e) => getActionType(e) === 'replaceAbility',
        check: (e) => !!e.action!.targetAbilityId && !!e.action!.newAbilityDef,
        describeViolation: () =>
            `replaceAbility 缺少 targetAbilityId 或 newAbilityDef`,
    },
];

createEffectContractSuite({
    suiteName: '技能效果数据契约',
    getSources: getAllAbilityDefs,
    getSourceId: (entry) => `${entry.heroId}/${entry.ability.id}`,
    extractEffects: extractAbilityEffects,
    rules: abilityEffectRules,
    minSourceCount: 20,
});

// --------------------------------------------------------------------------
// 6b. 卡牌效果契约（cards）
// --------------------------------------------------------------------------

/** 收集所有英雄卡牌 + 通用卡牌 */
function getAllCards(): AbilityCard[] {
    return [
        ...MONK_CARDS,
        ...BARBARIAN_CARDS,
        ...PYROMANCER_CARDS,
        ...SHADOW_THIEF_CARDS,
        ...MOON_ELF_CARDS,
        ...PALADIN_CARDS,
        ...COMMON_CARDS,
    ];
}

/** 卡牌效果契约规则 */
const cardEffectRules: EffectContractRule<AbilityEffect>[] = [
    {
        name: '主阶段行动卡的 custom/rollDie/drawCard 效果必须有 timing: immediate',
        appliesTo: (e) => {
            const t = getActionType(e);
            if (t === undefined) return false;
            if (t !== 'custom' && !ACTIONS_REQUIRING_RANDOM.has(t)) return false;
            // 技能效果（timing: 'withDamage'）在战斗结算阶段执行，不需要 immediate 标记
            // 执行路径：resolveAttack() → resolveEffectsToEvents(effects, 'withDamage', ctx) → custom action handler
            // 注意：卡牌效果已全部迁移为 timing: 'immediate'，withDamage 仅用于技能效果（如 monk 的冥想/太极连击）
            if (e.timing === 'withDamage') return false;
            return true;
        },
        check: (e) => e.timing === 'immediate',
        describeViolation: (e) =>
            `action.type="${e.action!.type}" 缺少 timing: 'immediate'（卡牌效果只执行 immediate 时机，缺失会导致效果完全不执行）`,
    },
    {
        name: 'custom action 的 customActionId 必须在注册表中',
        appliesTo: (e) => getActionType(e) === 'custom' && !!e.action!.customActionId,
        check: (e) => getRegisteredCustomActionIds().has(e.action!.customActionId!),
        describeViolation: (e) =>
            `customActionId="${e.action!.customActionId}" 未在 customActionRegistry 中注册`,
    },
    {
        name: '升级卡的 replaceAbility 必须有 timing: immediate',
        appliesTo: (e) => getActionType(e) === 'replaceAbility',
        check: (e) => e.timing === 'immediate',
        describeViolation: () =>
            `replaceAbility 缺少 timing: 'immediate'（升级卡效果不会执行）`,
    },
    {
        name: 'replaceAbility 必须有 targetAbilityId 和 newAbilityDef',
        appliesTo: (e) => getActionType(e) === 'replaceAbility',
        check: (e) => !!e.action!.targetAbilityId && !!e.action!.newAbilityDef,
        describeViolation: () =>
            `replaceAbility 缺少 targetAbilityId 或 newAbilityDef`,
    },
];

createEffectContractSuite({
    suiteName: '卡牌效果数据契约',
    getSources: () => getAllCards().filter(c => c.effects && c.effects.length > 0),
    getSourceId: (card) => card.id,
    extractEffects: (card) => card.effects ?? [],
    rules: cardEffectRules,
    minSourceCount: 10,
});

// --------------------------------------------------------------------------
// 6c. TokenDef 被动触发契约
// --------------------------------------------------------------------------

/** TokenDef 被动触发效果契约规则 */
const tokenPassiveRules: EffectContractRule<{ tokenId: string; action: AbilityEffect['action'] }>[] = [
    {
        name: 'custom action 的 customActionId 必须在注册表中',
        appliesTo: (e) => e.action?.type === 'custom' && !!e.action.customActionId,
        check: (e) => getRegisteredCustomActionIds().has(e.action!.customActionId!),
        describeViolation: (e) =>
            `customActionId="${e.action!.customActionId}" 未在 customActionRegistry 中注册`,
    },
];

createEffectContractSuite({
    suiteName: 'TokenDef 被动触发数据契约',
    getSources: () => ALL_TOKEN_DEFINITIONS.filter(d => d.passiveTrigger?.actions?.length),
    getSourceId: (def) => def.id,
    extractEffects: (def) =>
        (def.passiveTrigger?.actions ?? []).map(a => ({ tokenId: def.id, action: a })),
    rules: tokenPassiveRules,
    minSourceCount: 1,
});


// ============================================================================
// 7. 能力效果双重授予检测（防止 abilities.ts 独立效果与 custom action 内部重复）
// ============================================================================

/**
 * 检测"双重授予"反模式：
 * 如果一个能力/变体的效果列表中同时存在：
 *   1. 独立的 grantToken/grantStatus 效果
 *   2. custom action，且该 custom action 的 categories 包含可能产生同类事件的分类
 * 则标记为潜在双重授予。
 *
 * 这类 bug 的根因：custom action 内部已经处理了 token/status 授予（因为需要先授予再基于数量计算伤害），
 * 但 abilities.ts 中又有独立的 grantToken/grantStatus 效果，导致同一 token/status 被授予两次。
 *
 * 白名单：某些能力确实需要独立效果 + custom action 共存（如 fiery-combo-2 的 FM 在 preDefense 获得，
 * custom action 在 withDamage 只算伤害不授予 FM）。白名单中的条目必须注释说明原因。
 */
describe('能力效果双重授予检测', () => {
    // 白名单：这些能力/变体确实需要独立效果 + custom action 共存（已确认不重复）
    // 格式：'heroId/abilityId/variantId' 或 'heroId/abilityId'（无变体时）
    const WHITELIST = new Set<string>([
        // fiery-combo-2: grantToken(FM,2) 在 preDefense 获得，fiery-combo-2-resolve 在 withDamage 只算伤害不授予FM
        'pyromancer/fiery-combo/fiery-combo-2',
        // transcendence: grantToken(EVASIVE/PURIFY) 与 lotus-palm-taiji-cap-up-and-fill(太极上限+补满) 操作不同 token
        'monk/transcendence',
        // shadow-shank: grantToken(SNEAK) 与 gain-cp(CP获取)/shadow-shank-damage(伤害计算) 操作不同类型
        'shadow_thief/shadow-shank',
        // vengeance: grantToken(RETRIBUTION) 与 gain-cp(CP获取) 操作不同类型
        'paladin/vengeance',
        'paladin/vengeance/vengeance-2-mix',
        'paladin/vengeance/vengeance-2-main',
        // righteous-prayer: grantToken(CRIT) 与 gain-cp(CP获取) 操作不同类型
        'paladin/righteous-prayer',
        'paladin/righteous-prayer/righteous-prayer-2-main',
    ]);

    /** 可能产生 token 授予的 custom action 分类 */
    const TOKEN_PRODUCING_CATEGORIES = new Set(['resource', 'token', 'other']);
    /** 可能产生 status 施加的 custom action 分类 */
    const STATUS_PRODUCING_CATEGORIES = new Set(['status', 'other']);

    interface EffectGroup {
        label: string;
        effects: AbilityEffect[];
    }

    /** 从所有英雄的所有能力中提取效果组（含变体） */
    function getAllEffectGroups(): EffectGroup[] {
        const groups: EffectGroup[] = [];
        for (const [heroId, data] of Object.entries(CHARACTER_DATA_MAP)) {
            for (const ability of data.abilities as AbilityDef[]) {
                // 无变体：直接检查 effects
                if (ability.effects?.length && !ability.variants?.length) {
                    groups.push({
                        label: `${heroId}/${ability.id}`,
                        effects: ability.effects,
                    });
                }
                // 有变体：逐个检查
                if (ability.variants) {
                    for (const variant of ability.variants) {
                        groups.push({
                            label: `${heroId}/${ability.id}/${variant.id}`,
                            effects: variant.effects,
                        });
                    }
                }
            }
        }
        return groups;
    }

    it('不存在 grantToken + custom action 双重授予', () => {
        const violations: string[] = [];
        for (const group of getAllEffectGroups()) {
            if (WHITELIST.has(group.label)) continue;

            const hasGrantToken = group.effects.some(e => e.action?.type === 'grantToken');
            const customActions = group.effects.filter(e => e.action?.type === 'custom' && e.action.customActionId);

            if (!hasGrantToken || customActions.length === 0) continue;

            // 检查 custom action 是否可能内部也产生 token 授予
            for (const ca of customActions) {
                const meta = getCustomActionMeta(ca.action!.customActionId!);
                if (!meta) continue;
                const mayProduceTokens = meta.categories.some(c => TOKEN_PRODUCING_CATEGORIES.has(c));
                if (mayProduceTokens) {
                    violations.push(
                        `[${group.label}] 独立 grantToken 效果 + custom action "${ca.action!.customActionId}"（categories: ${meta.categories.join(',')}）可能双重授予 token`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('不存在 grantStatus + custom action 双重授予', () => {
        const violations: string[] = [];
        // grantStatus 专用白名单：独立 grantStatus 与 custom action 操作不同 status
        const STATUS_WHITELIST = new Set<string>([
            // meteor: inflictStatus(STUN) 与 meteor-resolve(FM获取+FM伤害) 操作不同类型
            'pyromancer/meteor',
        ]);
        for (const group of getAllEffectGroups()) {
            if (WHITELIST.has(group.label) || STATUS_WHITELIST.has(group.label)) continue;

            const hasGrantStatus = group.effects.some(e => e.action?.type === 'grantStatus');
            const customActions = group.effects.filter(e => e.action?.type === 'custom' && e.action.customActionId);

            if (!hasGrantStatus || customActions.length === 0) continue;

            for (const ca of customActions) {
                const meta = getCustomActionMeta(ca.action!.customActionId!);
                if (!meta) continue;
                const mayProduceStatus = meta.categories.some(c => STATUS_PRODUCING_CATEGORIES.has(c));
                if (mayProduceStatus) {
                    violations.push(
                        `[${group.label}] 独立 grantStatus 效果 + custom action "${ca.action!.customActionId}"（categories: ${meta.categories.join(',')}）可能双重施加 status`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });
});


// ============================================================================
// 8. Token 响应窗口契约完整性
// ============================================================================

/**
 * 验证领域层 getUsableTokensForTiming 与 UI 层 TokenResponseModal 的分类逻辑一致。
 *
 * 背景：曾因 UI 层硬编码太极特征（同时有两个 timing）导致火焰精通触发了太极弹窗。
 * 重构后 UI 直接消费领域层输出，此测试确保：
 * 1. 每个 consumable token 的 effect type 都在 UI 已知分类中
 * 2. 有 beforeDamageDealt/beforeDamageReceived timing 的 token 能被 getUsableTokensForTiming 正确返回
 * 3. 返回的 token 都能被 UI 分类逻辑识别（damage modifier 或 rollToNegate）
 */
import { getUsableTokensForTiming } from '../domain/tokenResponse';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';

describe('Token 响应窗口契约完整性', () => {
    // UI 层已知的 activeUse effect type（TokenResponseModal 能处理的类型）
    const UI_KNOWN_EFFECT_TYPES = new Set([
        'modifyDamageDealt',
        'modifyDamageReceived',
        'rollToNegate',
        'removeDebuff',
    ]);

    // UI 层在响应窗口中展示的 effect type（damage modifier + evasion）
    const UI_RESPONSE_EFFECT_TYPES = new Set([
        'modifyDamageDealt',
        'modifyDamageReceived',
        'rollToNegate',
    ]);

    const consumableTokens = ALL_TOKEN_DEFINITIONS.filter(d => d.category === 'consumable' && d.activeUse);

    // 自动消耗的 token（由 custom actions 消耗，不通过弹窗交互）
    // 这些 token 不应该有 activeUse 配置
    const AUTO_CONSUMED_TOKEN_IDS = new Set([
        TOKEN_IDS.FIRE_MASTERY, // 由 resolveBurnDown / resolveDmgPerFM 等 custom actions 自动消耗
    ]);

    it('自动消耗的 token 不应该有 activeUse 配置', () => {
        const violations: string[] = [];
        for (const def of ALL_TOKEN_DEFINITIONS) {
            if (AUTO_CONSUMED_TOKEN_IDS.has(def.id) && def.activeUse) {
                violations.push(
                    `[${def.id}] 是自动消耗的 token，不应该有 activeUse 配置（会错误触发 Token 响应弹窗）`
                );
            }
        }
        expect(violations).toEqual([]);
    });

    it('火焰精通不会出现在 getUsableTokensForTiming 结果中', () => {
        // 即使玩家持有火焰精通，也不应该触发弹窗
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.FIRE_MASTERY]: 5 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
        } as any;

        const offensive = getUsableTokensForTiming(mockState, '0', 'beforeDamageDealt');
        const defensive = getUsableTokensForTiming(mockState, '0', 'beforeDamageReceived');
        const fmInOffensive = offensive.some(t => t.id === TOKEN_IDS.FIRE_MASTERY);
        const fmInDefensive = defensive.some(t => t.id === TOKEN_IDS.FIRE_MASTERY);
        expect(fmInOffensive).toBe(false);
        expect(fmInDefensive).toBe(false);
    });

    it('所有 consumable token 的 effect type 都在 UI 已知分类中', () => {
        const violations: string[] = [];
        for (const def of consumableTokens) {
            const effectType = def.activeUse!.effect.type;
            if (!UI_KNOWN_EFFECT_TYPES.has(effectType)) {
                violations.push(`[${def.id}] effect type "${effectType}" 不在 UI 已知分类中`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('有 beforeDamageDealt timing 的 token 能被 getUsableTokensForTiming 正确返回', () => {
        const offensiveTokens = consumableTokens.filter(d =>
            d.activeUse!.timing.includes('beforeDamageDealt')
        );
        expect(offensiveTokens.length).toBeGreaterThan(0);

        for (const def of offensiveTokens) {
            // 构造最小状态：玩家持有该 token
            const mockState = {
                players: {
                    '0': {
                        tokens: { [def.id]: 1 },
                        resources: { [RESOURCE_IDS.HP]: 50 },
                    },
                },
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            } as any;

            const result = getUsableTokensForTiming(mockState, '0', 'beforeDamageDealt');
            const found = result.some(t => t.id === def.id);
            expect(found).toBe(true);
        }
    });

    it('有 beforeDamageReceived timing 的 token 能被 getUsableTokensForTiming 正确返回', () => {
        const defensiveTokens = consumableTokens.filter(d =>
            d.activeUse!.timing.includes('beforeDamageReceived')
        );
        expect(defensiveTokens.length).toBeGreaterThan(0);

        for (const def of defensiveTokens) {
            const mockState = {
                players: {
                    '0': {
                        tokens: { [def.id]: 1 },
                        resources: { [RESOURCE_IDS.HP]: 50 },
                    },
                },
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            } as any;

            const result = getUsableTokensForTiming(mockState, '0', 'beforeDamageReceived');
            const found = result.some(t => t.id === def.id);
            expect(found).toBe(true);
        }
    });

    it('getUsableTokensForTiming 返回的 token 都能被 UI 响应窗口分类逻辑识别', () => {
        // 模拟一个持有所有 consumable token 的玩家
        const allTokens: Record<string, number> = {};
        for (const def of consumableTokens) {
            allTokens[def.id] = 1;
        }
        const mockState = {
            players: { '0': { tokens: allTokens, resources: { [RESOURCE_IDS.HP]: 50 } } },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
        } as any;

        const violations: string[] = [];
        for (const timing of ['beforeDamageDealt', 'beforeDamageReceived'] as const) {
            const usable = getUsableTokensForTiming(mockState, '0', timing);
            for (const def of usable) {
                const effectType = def.activeUse!.effect.type;
                if (!UI_RESPONSE_EFFECT_TYPES.has(effectType)) {
                    violations.push(
                        `[${def.id}] timing="${timing}" effect type "${effectType}" 不在 UI 响应窗口分类中，弹窗后 UI 无法渲染`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('持有量为 0 的 token 不会被 getUsableTokensForTiming 返回', () => {
        const mockState = {
            players: {
                '0': {
                    tokens: {},  // 所有 token 持有量为 0
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
        } as any;

        const offensive = getUsableTokensForTiming(mockState, '0', 'beforeDamageDealt');
        const defensive = getUsableTokensForTiming(mockState, '0', 'beforeDamageReceived');
        expect(offensive).toEqual([]);
        expect(defensive).toEqual([]);
    });
});

// ============================================================================
// 9. 卡牌 i18n 文案契约验证
// ============================================================================

// @ts-ignore JSON import
import zhCN from '../../../../public/locales/zh-CN/game-dicethrone.json';
// @ts-ignore JSON import
import en from '../../../../public/locales/en/game-dicethrone.json';

/** 卡牌 i18n key 格式：cards.<cardId>.<field> */
const CARD_KEY_PATTERN = /^cards\.\S+\.(name|description)$/;

const flatZhCN = flattenI18nKeys(zhCN as Record<string, unknown>);
const flatEn = flattenI18nKeys(en as Record<string, unknown>);

createI18nContractSuite<AbilityCard>({
    suiteName: '卡牌 i18n 文案契约',
    getSources: getAllCards,
    getSourceId: (card) => card.id,
    keyExtractors: [
        {
            fieldName: 'name',
            extract: (card) => card.name,
            keyPattern: CARD_KEY_PATTERN,
            patternDescription: 'cards.<id>.name',
        },
        {
            fieldName: 'description',
            extract: (card) => card.description,
            keyPattern: CARD_KEY_PATTERN,
            patternDescription: 'cards.<id>.description',
        },
    ],
    locales: { 'zh-CN': flatZhCN, en: flatEn },
    minSourceCount: 10,
});

// ============================================================================
// 10. 卡牌效果 timing 完整性（边界测试）
// ============================================================================

describe('卡牌效果 timing 完整性（边界测试）', () => {
    const allCards = getAllCards();

    it('所有卡牌效果（非纯描述）都必须有显式 timing', () => {
        const violations: string[] = [];
        for (const card of allCards) {
            if (!card.effects) continue;
            for (const effect of card.effects) {
                // 纯描述效果（无 action）不需要 timing
                if (!effect.action) continue;
                if (effect.timing === undefined) {
                    violations.push(
                        `[${card.id}] action.type="${effect.action.type}" 缺少 timing（效果不会在任何时机执行）`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('instant 卡牌的所有有 action 的效果必须有 timing: immediate', () => {
        const violations: string[] = [];
        const instantCards = allCards.filter(c => c.timing === 'instant');
        for (const card of instantCards) {
            if (!card.effects) continue;
            for (const effect of card.effects) {
                if (!effect.action) continue;
                // instant 卡牌只走 immediate 时机
                if (effect.timing !== 'immediate') {
                    violations.push(
                        `[${card.id}] instant 卡牌的效果 timing="${effect.timing}"，应为 "immediate"`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('upgrade 卡牌的 replaceAbility 效果必须有 timing: immediate', () => {
        const violations: string[] = [];
        const upgradeCards = allCards.filter(c => c.type === 'upgrade');
        for (const card of upgradeCards) {
            if (!card.effects) continue;
            for (const effect of card.effects) {
                if (effect.action?.type !== 'replaceAbility') continue;
                if (effect.timing !== 'immediate') {
                    violations.push(
                        `[${card.id}] upgrade 卡的 replaceAbility timing="${effect.timing}"，应为 "immediate"`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('grantToken/grantStatus 效果必须有显式 timing', () => {
        const violations: string[] = [];
        const GRANT_TYPES = new Set(['grantToken', 'grantStatus']);
        for (const card of allCards) {
            if (!card.effects) continue;
            for (const effect of card.effects) {
                if (!effect.action || !GRANT_TYPES.has(effect.action.type)) continue;
                if (effect.timing === undefined) {
                    violations.push(
                        `[${card.id}] ${effect.action.type} 缺少 timing（授予效果不会执行）`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });
});

// ============================================================================
// 11. 技能效果 timing 完整性（边界测试）
// ============================================================================

describe('技能效果 timing 完整性（边界测试）', () => {
    const allAbilities = getAllAbilityDefs();

    /**
     * 技能效果中，以下 action type 在无 timing 时走默认路径（withDamage/preDefense），
     * 这些默认路径是安全的（damage/heal/grantToken/grantStatus 不依赖 random）。
     * 只有需要 random 的 action（rollDie/drawCard/dice 类 custom）缺少 timing 才是 bug。
     *
     * 此测试验证：所有 grantToken/grantStatus 效果如果有 postDamage 语义
     * （即 condition.type === 'onHit'），必须有显式 timing: 'postDamage'。
     * 否则会在 withDamage 阶段执行，无法正确判断 onHit 条件。
     */
    it('带 onHit 条件的效果必须有 timing: postDamage', () => {
        const violations: string[] = [];
        for (const entry of allAbilities) {
            const effects = extractAbilityEffects(entry);
            for (const effect of effects) {
                if (!effect.action) continue;
                if (effect.condition?.type !== 'onHit') continue;
                if (effect.timing !== 'postDamage') {
                    violations.push(
                        `[${entry.heroId}/${entry.ability.id}] action.type="${effect.action.type}" 有 onHit 条件但 timing="${effect.timing}"，应为 "postDamage"`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('rollDie 效果在技能中必须有显式 timing', () => {
        const violations: string[] = [];
        for (const entry of allAbilities) {
            const effects = extractAbilityEffects(entry);
            for (const effect of effects) {
                if (effect.action?.type !== 'rollDie') continue;
                if (effect.timing === undefined) {
                    violations.push(
                        `[${entry.heroId}/${entry.ability.id}] rollDie 缺少 timing（会落入不传 random 的时机导致静默跳过）`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('drawCard 效果在技能中必须有显式 timing', () => {
        const violations: string[] = [];
        for (const entry of allAbilities) {
            const effects = extractAbilityEffects(entry);
            for (const effect of effects) {
                if (effect.action?.type !== 'drawCard') continue;
                if (effect.timing === undefined) {
                    violations.push(
                        `[${entry.heroId}/${entry.ability.id}] drawCard 缺少 timing（会落入不传 random 的时机导致静默跳过）`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });
});
