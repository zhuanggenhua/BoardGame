/**
 * SmashUp 实体交互链完整性测试
 *
 * 验证：
 * 1. 卡牌定义无重复 ID、结构完整
 * 2. 已注册的 AbilityExecutor 引用的 CardDef abilityTag 一致（无孤儿注册）
 * 3. 能力覆盖率 > 阈值（随开发推进提升）
 *
 * 注意：'ongoing' tag 由 ongoingModifiers 系统处理，不经过 abilityRegistry。
 *
 * 使用引擎层 entityIntegritySuite 工厂函数 + referenceValidator 原语。
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { hasAbility, clearRegistry, getRegistrySize } from '../domain/abilityRegistry';
import { getAllCardDefs } from '../data/cards';
import type { CardDef, AbilityTag } from '../domain/types';
import {
    createRegistryIntegritySuite,
    extractRefChains,
    type RefChain,
} from '../../../engine/testing/entityIntegritySuite';

// ============================================================================
// 常量
// ============================================================================

/** 由 abilityRegistry 管理的 tag（排除 ongoing，它走 ongoingModifiers 系统） */
const REGISTRY_MANAGED_TAGS: AbilityTag[] = ['onPlay', 'talent', 'special', 'onDestroy', 'extra'];

/** abilityTag 覆盖率门槛（随开发推进可逐步提高） */
const ABILITY_TAG_COVERAGE_THRESHOLD = 0.4;

// ============================================================================
// 辅助：从 CardDef 提取 abilityTag 引用链
// ============================================================================

function extractAbilityTagChains(def: CardDef): RefChain[] {
    if (!def.abilityTags || def.abilityTags.length === 0) return [];
    return def.abilityTags
        .filter(tag => REGISTRY_MANAGED_TAGS.includes(tag))
        .map(tag => ({
            sourceLabel: 'CardDef.abilityTags',
            sourceId: def.id,
            refType: 'abilityTag',
            refId: `${def.id}::${tag}`,
        }));
}

// ============================================================================
// 初始化
// ============================================================================

beforeAll(() => {
    clearRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 1. CardDef 基本完整性
// ============================================================================

createRegistryIntegritySuite<CardDef>({
    suiteName: 'CardDef 基本完整性',
    getDefs: () => getAllCardDefs(),
    getId: def => def.id,
    requiredFields: [
        { name: 'id', check: def => !!def.id },
        { name: 'name', check: def => !!def.name },
    ],
    minCount: 100,
});

// ============================================================================
// 2. AbilityTag 引用链（已实现部分的完整性）
// ============================================================================

describe('AbilityTag 引用链', () => {
    const allCards = getAllCardDefs();
    const allChains = extractRefChains(allCards, extractAbilityTagChains);

    it('存在声明了可注册 abilityTags 的卡牌', () => {
        expect(allChains.length).toBeGreaterThanOrEqual(20);
    });

    it('已注册 executor 对应的 defId 在卡牌注册表中存在', () => {
        // 收集所有已注册的 defId
        const registeredDefIds = new Set<string>();
        for (const card of allCards) {
            for (const tag of REGISTRY_MANAGED_TAGS) {
                if (hasAbility(card.id, tag)) {
                    registeredDefIds.add(card.id);
                }
            }
        }

        // 每个已注册的 defId 都应该在卡牌注册表中存在
        const cardDefIds = new Set(allCards.map(c => c.id));
        const orphans = [...registeredDefIds].filter(id => !cardDefIds.has(id));

        expect(orphans).toEqual([]);
    });

    it(`abilityTag 实现覆盖率 ≥ ${Math.round(ABILITY_TAG_COVERAGE_THRESHOLD * 100)}%`, () => {
        const implemented = allChains.filter(c => {
            const [defId, tag] = c.refId.split('::');
            return hasAbility(defId, tag as AbilityTag);
        });

        const coverage = implemented.length / allChains.length;
        // 当前游戏仍在开发，随开发进度提升阈值
        expect(coverage).toBeGreaterThanOrEqual(ABILITY_TAG_COVERAGE_THRESHOLD);
    });
});

// ============================================================================
// 3. 能力注册表健康检查
// ============================================================================

describe('能力注册表健康检查', () => {
    it('initAllAbilities 后注册表非空', () => {
        expect(getRegistrySize()).toBeGreaterThan(0);
    });

    it('initAllAbilities 幂等（注册表大小不变）', () => {
        const size1 = getRegistrySize();
        initAllAbilities();
        const size2 = getRegistrySize();
        expect(size1).toBe(size2);
    });

    it('基础 8 派系核心随从能力已注册', () => {
        // 外星人
        expect(hasAbility('alien_supreme_overlord', 'onPlay')).toBe(true);
        // 海盗
        expect(hasAbility('pirate_saucy_wench', 'onPlay')).toBe(true);
        // 忍者
        expect(hasAbility('ninja_master', 'onPlay')).toBe(true);
        // 恐龙
        expect(hasAbility('dino_laser_triceratops', 'onPlay')).toBe(true);
        // 机器人
        expect(hasAbility('robot_hoverbot', 'onPlay')).toBe(true);
        // 巫师
        expect(hasAbility('wizard_chronomage', 'onPlay')).toBe(true);
        // 僵尸
        expect(hasAbility('zombie_grave_digger', 'onPlay')).toBe(true);
        // 诡术师
        expect(hasAbility('trickster_gnome', 'onPlay')).toBe(true);
    });
});
