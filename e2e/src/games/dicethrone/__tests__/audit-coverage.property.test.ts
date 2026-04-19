// Feature: dicethrone-ability-wiki-audit, Property 1: 审计覆盖完整性
/**
 * 王权骰铸 - 审计覆盖完整性属性测试
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: 审计覆盖完整性
 * 对于任意预定义的角色 ID（barbarian、monk、pyromancer、moon_elf、shadow_thief、paladin），
 * 审计基础设施必须能产出该角色的能力审计、Token 审计和专属卡审计数据。
 * 通用卡审计必须恰好出现一次（18 张）。
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getHeroAbilities,
  getHeroTokens,
  getHeroCards,
  getCommonCards,
  ALL_HERO_IDS,
} from '../__tests__/helpers/auditUtils';
import {
  ABILITY_SNAPSHOTS_BY_HERO,
  TOKEN_SNAPSHOTS_BY_HERO,
  HERO_CARD_SNAPSHOTS_BY_HERO,
  COMMON_CARD_SNAPSHOTS,
  ALL_HERO_IDS as WIKI_HERO_IDS,
} from '../__tests__/fixtures/wikiSnapshots';
import type { HeroId } from '../__tests__/fixtures/wikiSnapshots';

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 1: 审计覆盖完整性', () => {
  it('任意角色的能力、Token、专属卡审计数据均非空，且 Wiki 快照存在', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_HERO_IDS),
        (heroId: string) => {
          // 1. 代码侧：能力定义非空
          const abilities = getHeroAbilities(heroId);
          expect(
            abilities.length,
            `角色 [${heroId}] 的能力定义为空`,
          ).toBeGreaterThan(0);

          // 2. 代码侧：Token 定义非空
          const tokens = getHeroTokens(heroId);
          expect(
            tokens.length,
            `角色 [${heroId}] 的 Token 定义为空`,
          ).toBeGreaterThan(0);

          // 3. 代码侧：专属卡定义非空
          const heroCards = getHeroCards(heroId);
          expect(
            heroCards.length,
            `角色 [${heroId}] 的专属卡定义为空`,
          ).toBeGreaterThan(0);

          // 4. Wiki 快照侧：能力快照存在
          const abilitySnapshots = ABILITY_SNAPSHOTS_BY_HERO[heroId as HeroId];
          expect(
            abilitySnapshots,
            `角色 [${heroId}] 的 Wiki 能力快照不存在`,
          ).toBeDefined();
          expect(
            abilitySnapshots.length,
            `角色 [${heroId}] 的 Wiki 能力快照为空`,
          ).toBeGreaterThan(0);

          // 5. Wiki 快照侧：Token 快照存在
          const tokenSnapshots = TOKEN_SNAPSHOTS_BY_HERO[heroId as HeroId];
          expect(
            tokenSnapshots,
            `角色 [${heroId}] 的 Wiki Token 快照不存在`,
          ).toBeDefined();
          expect(
            tokenSnapshots.length,
            `角色 [${heroId}] 的 Wiki Token 快照为空`,
          ).toBeGreaterThan(0);

          // 6. Wiki 快照侧：专属卡快照存在
          const cardSnapshots = HERO_CARD_SNAPSHOTS_BY_HERO[heroId as HeroId];
          expect(
            cardSnapshots,
            `角色 [${heroId}] 的 Wiki 专属卡快照不存在`,
          ).toBeDefined();
          expect(
            cardSnapshots.length,
            `角色 [${heroId}] 的 Wiki 专属卡快照为空`,
          ).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('通用卡审计恰好包含 18 张卡牌', () => {
    // 代码侧：通用卡恰好 18 张
    const commonCards = getCommonCards();
    expect(commonCards).toHaveLength(18);

    // Wiki 快照侧：通用卡快照恰好 18 条
    expect(COMMON_CARD_SNAPSHOTS).toHaveLength(18);
  });

  it('代码侧与 Wiki 侧的角色 ID 列表一致', () => {
    // 确保两个来源的角色 ID 列表完全一致
    expect([...ALL_HERO_IDS].sort()).toEqual([...WIKI_HERO_IDS].sort());
  });
});
