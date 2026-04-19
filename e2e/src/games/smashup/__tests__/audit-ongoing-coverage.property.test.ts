// Feature: smashup-full-faction-audit, Property 2: 持续效果注册覆盖
/**
 * 大杀四方 - 持续效果注册覆盖属性测试
 *
 * **Validates: Requirements 11.1, 11.2, 11.3**
 *
 * Property 2: 持续效果注册覆盖
 * 对于任意 ongoing 类型的行动卡（subtype === 'ongoing'），在 ongoingEffects 注册表
 * （protection/restriction/trigger/interceptor）或 ongoingModifiers 注册表
 * （powerModifier/breakpointModifier）中必须存在对应的效果注册（白名单豁免的除外）。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { getAllCardDefs, checkOngoingRegistration } from './helpers/auditUtils';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import type { ActionCardDef } from '../domain/types';

// ============================================================================
// 初始化：注册所有能力
// ============================================================================

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 白名单：通过 abilityRegistry 或特殊机制实现的 ongoing 行动卡
// ============================================================================

/**
 * 以下 ongoing 行动卡的效果通过 abilityRegistry（talent 等标签）或特殊机制实现，
 * 不在 ongoingEffects/ongoingModifiers 注册表中注册。
 * 与 abilityBehaviorAudit.test.ts 中的白名单保持一致。
 */
const WHITELIST = new Set([
    'cthulhu_altar',              // 祭坛：天赋效果由 abilityRegistry 处理
    'cthulhu_complete_the_ritual', // 完成仪式：特殊效果
    'innsmouth_sacred_circle',    // 神圣之环：天赋效果
    'innsmouth_in_plain_sight',   // 众目睽睽：保护效果已注册
    'steampunk_zeppelin',         // 飞艇：天赋效果由 abilityRegistry 处理
    'ghost_make_contact',         // 交朋友：控制权转移由特殊逻辑处理
    'zombie_theyre_coming_to_get_you', // 它们为你而来：通过 DiscardPlayProvider 实现弃牌堆出牌
    'miskatonic_lost_knowledge',  // 通往超凡的门：天赋效果由 abilityRegistry 处理（talent）
    'werewolf_leader_of_the_pack', // 狼群领袖：ongoing(minion)+talent 由 abilityRegistry 处理
    'werewolf_moontouched',       // 月之触：ongoing(minion)+talent 由 abilityRegistry 处理
]);

// ============================================================================
// 数据准备：收集所有 ongoing 行动卡（排除白名单）
// ============================================================================

interface OngoingCard {
    defId: string;
    faction: string;
}

/**
 * 收集所有 ongoing 行动卡（abilityTags 包含 'ongoing' 且 subtype === 'ongoing'）。
 * 排除白名单中的卡牌。
 */
function collectOngoingActionCards(): OngoingCard[] {
    const allCards = getAllCardDefs();
    const cards: OngoingCard[] = [];

    for (const card of allCards) {
        if (card.type !== 'action') continue;
        const actionCard = card as ActionCardDef;
        if (actionCard.subtype !== 'ongoing') continue;
        if (WHITELIST.has(card.id)) continue;

        cards.push({
            defId: card.id,
            faction: card.faction,
        });
    }

    return cards;
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 2: 持续效果注册覆盖', () => {
    it('所有 ongoing 行动卡在 ongoingEffects 或 ongoingModifiers 注册表中有对应注册', () => {
        const ongoingCards = collectOngoingActionCards();

        // 确保有足够的测试数据
        expect(ongoingCards.length).toBeGreaterThan(0);

        fc.assert(
            fc.property(
                fc.constantFrom(...ongoingCards),
                (card: OngoingCard) => {
                    const result = checkOngoingRegistration(card.defId);

                    // 属性：ongoing 行动卡必须在至少一个 ongoing 注册表中有注册
                    expect(
                        result.registered,
                        `ongoing 行动卡 [${card.defId}] (派系: ${card.faction}) ` +
                        `未在任何 ongoing 注册表中注册。` +
                        `\n  检查结果: protection=${result.registries.protection}, ` +
                        `restriction=${result.registries.restriction}, ` +
                        `trigger=${result.registries.trigger}, ` +
                        `interceptor=${result.registries.interceptor}, ` +
                        `baseAbilitySuppression=${result.registries.baseAbilitySuppression}, ` +
                        `powerModifier=${result.registries.powerModifier}, ` +
                        `breakpointModifier=${result.registries.breakpointModifier}`,
                    ).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });
});
