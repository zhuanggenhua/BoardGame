// Feature: smashup-full-faction-audit, Property 1: 能力标签执行器全覆盖
/**
 * 大杀四方 - 能力标签执行器全覆盖属性测试
 *
 * **Validates: Requirements 1.1-1.8, 2.1-2.4, 3.1-3.4, 4.1-4.4**
 *
 * Property 1: 能力标签执行器全覆盖
 * 对于任意派系中的任意卡牌，如果该卡牌声明了 abilityTags（onPlay/talent/onDestroy 等非豁免标签），
 * 则 abilityRegistry 中必须存在对应的 `defId::tag` 执行器注册。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { getAllCardDefs, checkAbilityRegistration } from './helpers/auditUtils';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import type { CardDef, AbilityTag } from '../domain/types';

// ============================================================================
// 初始化：注册所有能力
// ============================================================================

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 常量
// ============================================================================

/**
 * 豁免标签集合：这些标签由其他系统处理，不需要 abilityRegistry 执行器。
 * - ongoing: 由 ongoingEffects / ongoingModifiers 注册表处理
 * - extra: 由出牌限制系统处理（额外出牌次数），不需要独立执行器
 */
const EXEMPT_TAGS = new Set<AbilityTag>(['ongoing', 'extra']);

/**
 * 特定 (defId, tag) 豁免集合：这些卡牌的特定标签通过替代机制实现，不需要 abilityRegistry 执行器。
 * - ninja_shinobi::special: 通过 beforeScoringPlayable 标记在 Me First! 窗口中打出，
 *   不再使用 beforeScoring 触发器和传统 abilityRegistry 执行器。
 */
const EXEMPT_CARD_TAGS = new Set<string>([
    'ninja_shinobi::special',
]);

// ============================================================================
// 数据准备：收集所有声明了非豁免 abilityTags 的卡牌
// ============================================================================

interface CardWithTag {
    defId: string;
    tag: AbilityTag;
    faction: string;
    cardType: 'minion' | 'action';
}

/**
 * 收集所有需要检查的 (卡牌, 标签) 对。
 * 只保留声明了非豁免 abilityTags 的卡牌。
 */
function collectCardTagPairs(): CardWithTag[] {
    const allCards = getAllCardDefs();
    const pairs: CardWithTag[] = [];

    for (const card of allCards) {
        if (!card.abilityTags || card.abilityTags.length === 0) continue;

        for (const tag of card.abilityTags) {
            if (EXEMPT_TAGS.has(tag)) continue;
            if (EXEMPT_CARD_TAGS.has(`${card.id}::${tag}`)) continue;
            pairs.push({
                defId: card.id,
                tag,
                faction: card.faction,
                cardType: card.type,
            });
        }
    }

    return pairs;
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 1: 能力标签执行器全覆盖', () => {
    it('所有声明了非豁免 abilityTags 的卡牌在 abilityRegistry 中有对应执行器', () => {
        const pairs = collectCardTagPairs();

        // 确保有足够的测试数据
        expect(pairs.length).toBeGreaterThan(0);

        fc.assert(
            fc.property(
                fc.constantFrom(...pairs),
                (pair: CardWithTag) => {
                    const result = checkAbilityRegistration(pair.defId, pair.tag);
                    // 属性：非豁免标签必须在 abilityRegistry 中有注册
                    expect(
                        result.registered,
                        `卡牌 [${pair.defId}] (派系: ${pair.faction}, 类型: ${pair.cardType}) ` +
                        `的标签 "${pair.tag}" 未在 abilityRegistry 中注册 (key: ${result.key})`,
                    ).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });
});
