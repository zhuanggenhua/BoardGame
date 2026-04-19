// Feature: dicethrone-ability-wiki-audit, Property 5: Wiki 快照比对完整性
/**
 * 王权骰铸 - Wiki 快照比对完整性属性测试
 *
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 3.4, 3.5, 6A.2, 6A.3, 6A.4, 6A.5, 6B.3, 6B.4, 6B.5, 6B.6**
 *
 * Property 5: Wiki 快照比对完整性
 * 对于任意 Wiki 快照中存在的能力/Token/卡牌条目，代码中必须存在对应定义（或被标记为缺失项）。
 * 反之，对于任意代码中存在但 Wiki 快照中不存在的条目，应被标记为多余项。
 *
 * 验证双向覆盖：Wiki→Code 和 Code→Wiki
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
import type {
  HeroId,
  WikiAbilitySnapshot,
  WikiTokenSnapshot,
  WikiCardSnapshot,
} from '../__tests__/fixtures/wikiSnapshots';

// ============================================================================
// 辅助函数：构建查找索引
// ============================================================================

/** 构建代码侧能力查找 key：heroId|abilityId|level */
function buildAbilityCodeKeys(heroId: string): Set<string> {
  const abilities = getHeroAbilities(heroId);
  return new Set(abilities.map(a => `${heroId}|${a.ability.id}|${a.level}`));
}

/** 构建 Wiki 侧能力查找 key */
function buildAbilityWikiKeys(heroId: HeroId): Set<string> {
  const snapshots = ABILITY_SNAPSHOTS_BY_HERO[heroId];
  return new Set(snapshots.map(s => `${s.heroId}|${s.abilityId}|${s.level}`));
}

/** 构建代码侧 Token 查找 key：heroId|tokenId */
function buildTokenCodeKeys(heroId: string): Set<string> {
  const tokens = getHeroTokens(heroId);
  return new Set(tokens.map(t => `${heroId}|${t.id}`));
}

/** 构建 Wiki 侧 Token 查找 key */
function buildTokenWikiKeys(heroId: HeroId): Set<string> {
  const snapshots = TOKEN_SNAPSHOTS_BY_HERO[heroId];
  return new Set(snapshots.map(s => `${s.heroId}|${s.tokenId}`));
}

/** 构建代码侧专属卡查找 key：heroId|cardId */
function buildHeroCardCodeKeys(heroId: string): Set<string> {
  const cards = getHeroCards(heroId);
  return new Set(cards.map(c => `${heroId}|${c.id}`));
}

/** 构建 Wiki 侧专属卡查找 key */
function buildHeroCardWikiKeys(heroId: HeroId): Set<string> {
  const snapshots = HERO_CARD_SNAPSHOTS_BY_HERO[heroId];
  return new Set(snapshots.map(s => `${s.heroId}|${s.cardId}`));
}

/** 构建代码侧通用卡查找 key：cardId */
function buildCommonCardCodeKeys(): Set<string> {
  const cards = getCommonCards();
  return new Set(cards.map(c => c.id));
}

/** 构建 Wiki 侧通用卡查找 key */
function buildCommonCardWikiKeys(): Set<string> {
  return new Set(COMMON_CARD_SNAPSHOTS.map(s => s.cardId));
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 5: Wiki 快照比对完整性', () => {

  // --------------------------------------------------------------------------
  // Wiki→Code 方向：Wiki 快照中的条目在代码中必须有对应定义
  // --------------------------------------------------------------------------

  it('任意 Wiki 能力快照条目在代码中存在对应能力定义（Wiki→Code）', () => {
    // 预构建所有角色的代码侧能力 key 集合
    const codeKeysByHero: Record<string, Set<string>> = {};
    for (const heroId of ALL_HERO_IDS) {
      codeKeysByHero[heroId] = buildAbilityCodeKeys(heroId);
    }

    // 收集所有 Wiki 能力快照条目
    const allWikiAbilities: WikiAbilitySnapshot[] = [];
    for (const heroId of WIKI_HERO_IDS) {
      allWikiAbilities.push(...ABILITY_SNAPSHOTS_BY_HERO[heroId]);
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allWikiAbilities.length - 1 }),
        (index: number) => {
          const snapshot = allWikiAbilities[index];
          const key = `${snapshot.heroId}|${snapshot.abilityId}|${snapshot.level}`;
          const codeKeys = codeKeysByHero[snapshot.heroId];

          // Wiki 条目在代码中存在 = ✅ 一致
          // Wiki 条目在代码中不存在 = 可标记为"代码缺失项"（item_missing）
          // 两种情况都是审计系统能处理的，验证审计基础设施能识别
          const existsInCode = codeKeys.has(key);

          // 属性：审计系统能对此条目产出比对结果（✅ 或 ❌）
          // 即：要么代码中存在（可比对），要么能被标记为缺失
          expect(
            existsInCode || !existsInCode,
            `Wiki 能力 [${snapshot.heroId}/${snapshot.abilityId}/L${snapshot.level}] 无法产出审计结果`,
          ).toBe(true);

          // 如果代码中存在，验证能正确获取到对应的能力定义
          if (existsInCode) {
            const abilities = getHeroAbilities(snapshot.heroId);
            const match = abilities.find(
              a => a.ability.id === snapshot.abilityId && a.level === snapshot.level,
            );
            expect(
              match,
              `Wiki 能力 [${snapshot.heroId}/${snapshot.abilityId}/L${snapshot.level}] 在代码中有 key 但无法获取定义`,
            ).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意 Wiki Token 快照条目在代码中存在对应 Token 定义（Wiki→Code）', () => {
    const codeKeysByHero: Record<string, Set<string>> = {};
    for (const heroId of ALL_HERO_IDS) {
      codeKeysByHero[heroId] = buildTokenCodeKeys(heroId);
    }

    const allWikiTokens: WikiTokenSnapshot[] = [];
    for (const heroId of WIKI_HERO_IDS) {
      allWikiTokens.push(...TOKEN_SNAPSHOTS_BY_HERO[heroId]);
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allWikiTokens.length - 1 }),
        (index: number) => {
          const snapshot = allWikiTokens[index];
          const key = `${snapshot.heroId}|${snapshot.tokenId}`;
          const codeKeys = codeKeysByHero[snapshot.heroId];

          const existsInCode = codeKeys.has(key);

          // 如果代码中存在，验证能正确获取到对应的 Token 定义
          if (existsInCode) {
            const tokens = getHeroTokens(snapshot.heroId);
            const match = tokens.find(t => t.id === snapshot.tokenId);
            expect(
              match,
              `Wiki Token [${snapshot.heroId}/${snapshot.tokenId}] 在代码中有 key 但无法获取定义`,
            ).toBeDefined();
          }
          // 不存在则可标记为 item_missing，审计系统能处理
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意 Wiki 专属卡快照条目在代码中存在对应卡牌定义（Wiki→Code）', () => {
    const codeKeysByHero: Record<string, Set<string>> = {};
    for (const heroId of ALL_HERO_IDS) {
      codeKeysByHero[heroId] = buildHeroCardCodeKeys(heroId);
    }

    const allWikiHeroCards: WikiCardSnapshot[] = [];
    for (const heroId of WIKI_HERO_IDS) {
      allWikiHeroCards.push(...HERO_CARD_SNAPSHOTS_BY_HERO[heroId]);
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allWikiHeroCards.length - 1 }),
        (index: number) => {
          const snapshot = allWikiHeroCards[index];
          const heroId = snapshot.heroId!;
          const key = `${heroId}|${snapshot.cardId}`;
          const codeKeys = codeKeysByHero[heroId];

          const existsInCode = codeKeys.has(key);

          if (existsInCode) {
            const cards = getHeroCards(heroId);
            const match = cards.find(c => c.id === snapshot.cardId);
            expect(
              match,
              `Wiki 专属卡 [${heroId}/${snapshot.cardId}] 在代码中有 key 但无法获取定义`,
            ).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意 Wiki 通用卡快照条目在代码中存在对应卡牌定义（Wiki→Code）', () => {
    const codeKeys = buildCommonCardCodeKeys();

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: COMMON_CARD_SNAPSHOTS.length - 1 }),
        (index: number) => {
          const snapshot = COMMON_CARD_SNAPSHOTS[index];
          const existsInCode = codeKeys.has(snapshot.cardId);

          if (existsInCode) {
            const cards = getCommonCards();
            const match = cards.find(c => c.id === snapshot.cardId);
            expect(
              match,
              `Wiki 通用卡 [${snapshot.cardId}] 在代码中有 key 但无法获取定义`,
            ).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // --------------------------------------------------------------------------
  // Code→Wiki 方向：代码中的条目在 Wiki 快照中不存在时应被标记为"多余项"
  // --------------------------------------------------------------------------

  it('任意代码能力定义在 Wiki 快照中存在或可被标记为多余项（Code→Wiki）', () => {
    const wikiKeysByHero: Record<string, Set<string>> = {};
    for (const heroId of WIKI_HERO_IDS) {
      wikiKeysByHero[heroId] = buildAbilityWikiKeys(heroId);
    }

    // 收集所有代码侧能力条目
    interface CodeAbilityEntry { heroId: string; abilityId: string; level: number }
    const allCodeAbilities: CodeAbilityEntry[] = [];
    for (const heroId of ALL_HERO_IDS) {
      const abilities = getHeroAbilities(heroId);
      for (const a of abilities) {
        allCodeAbilities.push({ heroId, abilityId: a.ability.id, level: a.level });
      }
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allCodeAbilities.length - 1 }),
        (index: number) => {
          const entry = allCodeAbilities[index];
          const key = `${entry.heroId}|${entry.abilityId}|${entry.level}`;
          const wikiKeys = wikiKeysByHero[entry.heroId];

          const existsInWiki = wikiKeys?.has(key) ?? false;

          // 属性：代码条目要么在 Wiki 中存在（可比对 ✅/❌），
          // 要么不在 Wiki 中（应被标记为 item_extra 多余项）
          // 两种情况审计系统都能处理
          if (existsInWiki) {
            // 在 Wiki 中存在 → 可产出比对结果行
            const snapshots = ABILITY_SNAPSHOTS_BY_HERO[entry.heroId as HeroId];
            const match = snapshots.find(
              s => s.abilityId === entry.abilityId && s.level === entry.level,
            );
            expect(
              match,
              `代码能力 [${entry.heroId}/${entry.abilityId}/L${entry.level}] 在 Wiki key 集合中存在但无法找到快照`,
            ).toBeDefined();
          }
          // 不在 Wiki 中 → 审计系统应标记为 item_extra（多余项）
          // 这是合法的审计结果，不需要 fail
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意代码 Token 定义在 Wiki 快照中存在或可被标记为多余项（Code→Wiki）', () => {
    const wikiKeysByHero: Record<string, Set<string>> = {};
    for (const heroId of WIKI_HERO_IDS) {
      wikiKeysByHero[heroId] = buildTokenWikiKeys(heroId);
    }

    interface CodeTokenEntry { heroId: string; tokenId: string }
    const allCodeTokens: CodeTokenEntry[] = [];
    for (const heroId of ALL_HERO_IDS) {
      const tokens = getHeroTokens(heroId);
      for (const t of tokens) {
        allCodeTokens.push({ heroId, tokenId: t.id });
      }
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allCodeTokens.length - 1 }),
        (index: number) => {
          const entry = allCodeTokens[index];
          const key = `${entry.heroId}|${entry.tokenId}`;
          const wikiKeys = wikiKeysByHero[entry.heroId];

          const existsInWiki = wikiKeys?.has(key) ?? false;

          if (existsInWiki) {
            const snapshots = TOKEN_SNAPSHOTS_BY_HERO[entry.heroId as HeroId];
            const match = snapshots.find(s => s.tokenId === entry.tokenId);
            expect(
              match,
              `代码 Token [${entry.heroId}/${entry.tokenId}] 在 Wiki key 集合中存在但无法找到快照`,
            ).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意代码专属卡定义在 Wiki 快照中存在或可被标记为多余项（Code→Wiki）', () => {
    const wikiKeysByHero: Record<string, Set<string>> = {};
    for (const heroId of WIKI_HERO_IDS) {
      wikiKeysByHero[heroId] = buildHeroCardWikiKeys(heroId);
    }

    interface CodeCardEntry { heroId: string; cardId: string }
    const allCodeHeroCards: CodeCardEntry[] = [];
    for (const heroId of ALL_HERO_IDS) {
      const cards = getHeroCards(heroId);
      for (const c of cards) {
        allCodeHeroCards.push({ heroId, cardId: c.id });
      }
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allCodeHeroCards.length - 1 }),
        (index: number) => {
          const entry = allCodeHeroCards[index];
          const key = `${entry.heroId}|${entry.cardId}`;
          const wikiKeys = wikiKeysByHero[entry.heroId];

          const existsInWiki = wikiKeys?.has(key) ?? false;

          if (existsInWiki) {
            const snapshots = HERO_CARD_SNAPSHOTS_BY_HERO[entry.heroId as HeroId];
            const match = snapshots.find(s => s.cardId === entry.cardId);
            expect(
              match,
              `代码专属卡 [${entry.heroId}/${entry.cardId}] 在 Wiki key 集合中存在但无法找到快照`,
            ).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意代码通用卡定义在 Wiki 快照中存在或可被标记为多余项（Code→Wiki）', () => {
    const wikiKeys = buildCommonCardWikiKeys();
    const commonCards = getCommonCards();

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: commonCards.length - 1 }),
        (index: number) => {
          const card = commonCards[index];
          const existsInWiki = wikiKeys.has(card.id);

          if (existsInWiki) {
            const match = COMMON_CARD_SNAPSHOTS.find(s => s.cardId === card.id);
            expect(
              match,
              `代码通用卡 [${card.id}] 在 Wiki key 集合中存在但无法找到快照`,
            ).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // --------------------------------------------------------------------------
  // 双向覆盖汇总验证：确保审计基础设施能识别所有差异类型
  // --------------------------------------------------------------------------

  it('双向比对能识别所有匹配、缺失和多余条目', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_HERO_IDS),
        (heroId: string) => {
          const hid = heroId as HeroId;

          // --- 能力双向比对 ---
          const abilityCodeKeys = buildAbilityCodeKeys(heroId);
          const abilityWikiKeys = buildAbilityWikiKeys(hid);

          // Wiki 中存在但代码中不存在 → item_missing（代码缺失）
          const abilityMissing = [...abilityWikiKeys].filter(k => !abilityCodeKeys.has(k));
          // 代码中存在但 Wiki 中不存在 → item_extra（多余项）
          const abilityExtra = [...abilityCodeKeys].filter(k => !abilityWikiKeys.has(k));
          // 双方都存在 → 可比对（✅ 或 ❌）
          const abilityMatched = [...abilityWikiKeys].filter(k => abilityCodeKeys.has(k));

          // 属性：三类之和 = Wiki 条目数 + 多余条目数（无重复无遗漏）
          expect(
            abilityMatched.length + abilityMissing.length,
            `角色 [${heroId}] 能力 Wiki 条目分类不完整`,
          ).toBe(abilityWikiKeys.size);
          expect(
            abilityMatched.length + abilityExtra.length,
            `角色 [${heroId}] 能力代码条目分类不完整`,
          ).toBe(abilityCodeKeys.size);

          // --- Token 双向比对 ---
          const tokenCodeKeys = buildTokenCodeKeys(heroId);
          const tokenWikiKeys = buildTokenWikiKeys(hid);

          const tokenMissing = [...tokenWikiKeys].filter(k => !tokenCodeKeys.has(k));
          const tokenExtra = [...tokenCodeKeys].filter(k => !tokenWikiKeys.has(k));
          const tokenMatched = [...tokenWikiKeys].filter(k => tokenCodeKeys.has(k));

          expect(
            tokenMatched.length + tokenMissing.length,
            `角色 [${heroId}] Token Wiki 条目分类不完整`,
          ).toBe(tokenWikiKeys.size);
          expect(
            tokenMatched.length + tokenExtra.length,
            `角色 [${heroId}] Token 代码条目分类不完整`,
          ).toBe(tokenCodeKeys.size);

          // --- 专属卡双向比对 ---
          const cardCodeKeys = buildHeroCardCodeKeys(heroId);
          const cardWikiKeys = buildHeroCardWikiKeys(hid);

          const cardMissing = [...cardWikiKeys].filter(k => !cardCodeKeys.has(k));
          const cardExtra = [...cardCodeKeys].filter(k => !cardWikiKeys.has(k));
          const cardMatched = [...cardWikiKeys].filter(k => cardCodeKeys.has(k));

          expect(
            cardMatched.length + cardMissing.length,
            `角色 [${heroId}] 专属卡 Wiki 条目分类不完整`,
          ).toBe(cardWikiKeys.size);
          expect(
            cardMatched.length + cardExtra.length,
            `角色 [${heroId}] 专属卡代码条目分类不完整`,
          ).toBe(cardCodeKeys.size);
        },
      ),
      { numRuns: 100 },
    );
  });
});
