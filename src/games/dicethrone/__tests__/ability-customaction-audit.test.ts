/**
 * CustomAction 输出与 AbilityDef 声明一致性审计
 *
 * Tasks 1.5, 2.5, 4.5, 5.5, 7.5, 8.5, 13.2
 *
 * Property 2: 每个 AbilityDef 中引用的 customActionId 必须：
 *   1. 在 customActionRegistry 中注册
 *   2. 有对应的元数据（categories）
 *   3. 在测试文件中有引用覆盖
 *
 * Property 11: 所有注册的 customAction 都应在测试中被引用
 */

import { describe, it, expect } from 'vitest';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import type { AbilityDef } from '../domain/combat/types';
import type { AbilityEffect } from '../domain/combat';
import type { AbilityCard } from '../domain/types';
import {
    getRegisteredCustomActionIds,
    getCustomActionHandler,
    getCustomActionMeta,
} from '../domain/effects';
import type { SelectableCharacterId } from '../domain/types';

// 各英雄卡牌
import { MONK_CARDS } from '../heroes/monk/cards';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { COMMON_CARDS } from '../domain/commonCards';
import { ALL_TOKEN_DEFINITIONS } from '../domain/characters';

const HEROES: SelectableCharacterId[] = [
    'monk', 'barbarian', 'paladin', 'pyromancer', 'moon_elf', 'shadow_thief',
];

const ALL_CARDS: AbilityCard[] = [
    ...MONK_CARDS, ...BARBARIAN_CARDS, ...PYROMANCER_CARDS,
    ...SHADOW_THIEF_CARDS, ...MOON_ELF_CARDS, ...PALADIN_CARDS,
    ...COMMON_CARDS,
];

// ============================================================================
// 辅助函数
// ============================================================================

/** 从 AbilityDef 中提取所有 customActionId（含变体） */
function extractCustomActionIds(ability: AbilityDef): string[] {
    const ids: string[] = [];
    const collect = (effects: AbilityEffect[] | undefined) => {
        if (!effects) return;
        for (const e of effects) {
            if (e.action?.type === 'custom' && e.action.customActionId) {
                ids.push(e.action.customActionId);
            }
            // rollDie 的 conditionalEffects 中也可能有 custom action
            if (e.action?.type === 'rollDie' && e.action.conditionalEffects) {
                for (const ce of e.action.conditionalEffects) {
                    if (ce.triggerChoice?.options) {
                        // choice options 中可能引用 custom action
                    }
                }
            }
        }
    };
    collect(ability.effects);
    if (ability.variants) {
        for (const v of ability.variants) {
            collect(v.effects);
        }
    }
    return ids;
}

/** 从卡牌中提取所有 customActionId（含升级卡 newAbilityDef 中的引用） */
function extractCardCustomActionIds(card: AbilityCard): string[] {
    const ids: string[] = [];
    if (!card.effects) return ids;
    for (const e of card.effects) {
        if (e.action?.type === 'custom' && e.action.customActionId) {
            ids.push(e.action.customActionId);
        }
        // 升级卡的 replaceAbility 效果中包含 newAbilityDef，其中也可能引用 customAction
        if (e.action?.type === 'replaceAbility' && e.action.newAbilityDef) {
            const newDef = e.action.newAbilityDef as AbilityDef;
            ids.push(...extractCustomActionIds(newDef));
        }
    }
    return ids;
}

/** 从 TokenDef 被动触发中提取 customActionId */
function extractTokenCustomActionIds(): string[] {
    const ids: string[] = [];
    for (const def of ALL_TOKEN_DEFINITIONS) {
        const actions = def.passiveTrigger?.actions ?? [];
        for (const a of actions) {
            if (a.type === 'custom' && a.customActionId) {
                ids.push(a.customActionId);
            }
        }
    }
    return ids;
}

// ============================================================================
// 1. 每个英雄的 CustomAction 注册完整性
// ============================================================================

describe.each(HEROES)('%s: CustomAction 注册完整性', (heroId) => {
    const data = CHARACTER_DATA_MAP[heroId];
    const abilities = data.abilities as AbilityDef[];

    it('所有技能引用的 customActionId 都已注册', () => {
        const violations: string[] = [];
        for (const ability of abilities) {
            const ids = extractCustomActionIds(ability);
            for (const id of ids) {
                if (!getCustomActionHandler(id)) {
                    violations.push(`${ability.id} → customActionId "${id}" 未注册`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('所有技能引用的 customActionId 都有元数据', () => {
        const violations: string[] = [];
        for (const ability of abilities) {
            const ids = extractCustomActionIds(ability);
            for (const id of ids) {
                if (!getCustomActionMeta(id)) {
                    violations.push(`${ability.id} → customActionId "${id}" 缺少元数据`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('所有技能引用的 customActionId 的 categories 非空', () => {
        const violations: string[] = [];
        for (const ability of abilities) {
            const ids = extractCustomActionIds(ability);
            for (const id of ids) {
                const meta = getCustomActionMeta(id);
                if (meta && meta.categories.length === 0) {
                    violations.push(`${ability.id} → customActionId "${id}" categories 为空`);
                }
            }
        }
        expect(violations).toEqual([]);
    });
});

// ============================================================================
// 2. 卡牌 CustomAction 注册完整性
// ============================================================================

describe('卡牌 CustomAction 注册完整性', () => {
    it('所有卡牌引用的 customActionId 都已注册', () => {
        const violations: string[] = [];
        for (const card of ALL_CARDS) {
            const ids = extractCardCustomActionIds(card);
            for (const id of ids) {
                if (!getCustomActionHandler(id)) {
                    violations.push(`${card.id} → customActionId "${id}" 未注册`);
                }
            }
        }
        expect(violations).toEqual([]);
    });
});

// ============================================================================
// 3. TokenDef 被动触发 CustomAction 注册完整性
// ============================================================================

describe('TokenDef 被动触发 CustomAction 注册完整性', () => {
    it('所有 TokenDef 被动触发引用的 customActionId 都已注册', () => {
        const ids = extractTokenCustomActionIds();
        const violations: string[] = [];
        for (const id of ids) {
            if (!getCustomActionHandler(id)) {
                violations.push(`TokenDef → customActionId "${id}" 未注册`);
            }
        }
        expect(violations).toEqual([]);
    });
});

// ============================================================================
// 4. CustomAction 覆盖完整性审计（Task 13.2）
// ============================================================================

describe('CustomAction 覆盖完整性审计', () => {
    const registeredIds = getRegisteredCustomActionIds();

    // 收集所有被引用的 customActionId（技能 + 卡牌 + TokenDef）
    const referencedIds = new Set<string>();
    for (const heroId of HEROES) {
        const data = CHARACTER_DATA_MAP[heroId];
        for (const ability of data.abilities as AbilityDef[]) {
            extractCustomActionIds(ability).forEach(id => referencedIds.add(id));
        }
    }
    for (const card of ALL_CARDS) {
        extractCardCustomActionIds(card).forEach(id => referencedIds.add(id));
    }
    extractTokenCustomActionIds().forEach(id => referencedIds.add(id));

    // 已知的非声明式引用 customAction（通过 flowHooks/attack.ts/直接调用等路径使用）
    // 这些 customAction 不在 AbilityDef/Card/TokenDef 的 effects 中声明，但在运行时被调用
    const KNOWN_NON_DECLARATIVE_IDS = new Set([
        // 通用卡牌效果：增加投掷次数（由 flowHooks 或 card 系统直接调用）
        'grant-extra-roll-defense',
        'grant-extra-roll-offense',
        // 火法师 L2/L3 升级变体（通过 flowHooks 中的状态效果处理调用）
        'burning-soul-2-resolve',
        'hot-streak-2-resolve',
        'meteor-2-resolve',
        'pyro-increase-fm-limit',
        // 月精灵状态效果钩子（通过 flowHooks 中的致盲/缠绕处理调用）
        'moon_elf-blinded-check',
        'moon_elf-entangle-effect',
        // 暗影盗贼（通过 TokenDef passiveTrigger 或 flowHooks 调用）
        'shadow_thief-steal-cp',
        'shadow_thief-sneak-attack-use',
        'shadow_thief-cornucopia-discard', // 聚宝盆旧版 handler（向后兼容）
        // 僧侣（通用状态移除，由卡牌系统直接调用）
        'remove-status-self',
    ]);

    it('所有注册的 customAction 都被声明式引用或在已知非声明式列表中', () => {
        const unknownOrphans: string[] = [];
        for (const id of registeredIds) {
            if (!referencedIds.has(id) && !KNOWN_NON_DECLARATIVE_IDS.has(id)) {
                unknownOrphans.push(id);
            }
        }
        // 未知的孤立 customAction 可能是死代码
        expect(unknownOrphans).toEqual([]);
    });

    it('已知非声明式 customAction 确实已注册', () => {
        const missing: string[] = [];
        for (const id of KNOWN_NON_DECLARATIVE_IDS) {
            if (!registeredIds.has(id)) {
                missing.push(id);
            }
        }
        expect(missing).toEqual([]);
    });

    it('所有被引用的 customActionId 都已注册', () => {
        const missing: string[] = [];
        for (const id of referencedIds) {
            if (!registeredIds.has(id)) {
                missing.push(id);
            }
        }
        expect(missing).toEqual([]);
    });

    it('注册的 customAction 数量 >= 50（完整性基线）', () => {
        expect(registeredIds.size).toBeGreaterThanOrEqual(50);
    });
});
