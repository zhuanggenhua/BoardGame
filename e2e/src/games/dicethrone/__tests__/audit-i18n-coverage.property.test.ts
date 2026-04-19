// Feature: dicethrone-ability-wiki-audit, Property 3: i18n key 覆盖完整性
/**
 * 王权骰铸 - i18n key 覆盖完整性属性测试
 *
 * **Validates: Requirements 5.1, 5.4**
 *
 * Property 3: i18n key 覆盖完整性
 * 对于任意代码中定义的能力（含 Level 1/2/3）、Token 或卡牌（专属卡+通用卡），
 * 在 en 和 zh-CN 两个 locale 的 i18n JSON 文件中必须存在对应的 name 和 description key。
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getHeroAbilities,
  getHeroTokens,
  getHeroCards,
  getCommonCards,
  getI18nDescription,
  ALL_HERO_IDS,
} from './helpers/auditUtils';

// ============================================================================
// 数据收集：提取所有需要 i18n 覆盖的 key
// ============================================================================

/** i18n key 条目 */
interface I18nKeyEntry {
  /** 来源类型 */
  sourceType: 'ability' | 'token' | 'card';
  /** 来源角色 ID（通用卡为 'common'） */
  heroId: string;
  /** 对象 ID */
  objectId: string;
  /** 等级（仅能力） */
  level?: 1 | 2 | 3;
  /** i18n key 路径 */
  i18nKey: string;
  /** key 用途（name 或 description） */
  field: 'name' | 'description';
}

/**
 * 收集所有需要 i18n 覆盖的 key 条目
 *
 * 从能力的 name/description 字段、Token 的 name/description 字段、
 * 卡牌的 name/description 字段中提取 i18n key 路径。
 * 这些字段的值本身就是 i18n key（如 'abilities.slap.name'）。
 */
function collectAllI18nKeyEntries(): I18nKeyEntry[] {
  const entries: I18nKeyEntry[] = [];

  // 1. 能力（含 L1/L2/L3）
  for (const heroId of ALL_HERO_IDS) {
    const abilities = getHeroAbilities(heroId);
    for (const { ability, level } of abilities) {
      // 能力的 name 字段是 i18n key
      if (ability.name && typeof ability.name === 'string' && ability.name.includes('.')) {
        entries.push({
          sourceType: 'ability',
          heroId,
          objectId: ability.id,
          level,
          i18nKey: ability.name,
          field: 'name',
        });
      }
      // 能力的 description 字段是 i18n key
      if (ability.description && typeof ability.description === 'string' && ability.description.includes('.')) {
        entries.push({
          sourceType: 'ability',
          heroId,
          objectId: ability.id,
          level,
          i18nKey: ability.description,
          field: 'description',
        });
      }
      // 变体可能有自己的 name
      if (ability.variants) {
        for (const variant of ability.variants) {
          if (variant.name && typeof variant.name === 'string' && variant.name.includes('.')) {
            entries.push({
              sourceType: 'ability',
              heroId,
              objectId: variant.id,
              level,
              i18nKey: variant.name,
              field: 'name',
            });
          }
        }
      }
    }
  }

  // 2. Token
  for (const heroId of ALL_HERO_IDS) {
    const tokens = getHeroTokens(heroId);
    for (const token of tokens) {
      // Token 的 name 字段是 i18n key
      if (token.name && typeof token.name === 'string' && token.name.includes('.')) {
        entries.push({
          sourceType: 'token',
          heroId,
          objectId: token.id,
          i18nKey: token.name,
          field: 'name',
        });
      }
      // Token 的 description 字段是 i18n key
      const desc = token.description;
      if (desc && typeof desc === 'string' && desc.includes('.')) {
        entries.push({
          sourceType: 'token',
          heroId,
          objectId: token.id,
          i18nKey: desc,
          field: 'description',
        });
      }
    }
  }

  // 3. 专属卡
  for (const heroId of ALL_HERO_IDS) {
    const cards = getHeroCards(heroId);
    for (const card of cards) {
      if (card.name && typeof card.name === 'string' && card.name.includes('.')) {
        entries.push({
          sourceType: 'card',
          heroId,
          objectId: card.id,
          i18nKey: card.name,
          field: 'name',
        });
      }
      if (card.description && typeof card.description === 'string' && card.description.includes('.')) {
        entries.push({
          sourceType: 'card',
          heroId,
          objectId: card.id,
          i18nKey: card.description,
          field: 'description',
        });
      }
    }
  }

  // 4. 通用卡
  const commonCards = getCommonCards();
  for (const card of commonCards) {
    if (card.name && typeof card.name === 'string' && card.name.includes('.')) {
      entries.push({
        sourceType: 'card',
        heroId: 'common',
        objectId: card.id,
        i18nKey: card.name,
        field: 'name',
      });
    }
    if (card.description && typeof card.description === 'string' && card.description.includes('.')) {
      entries.push({
        sourceType: 'card',
        heroId: 'common',
        objectId: card.id,
        i18nKey: card.description,
        field: 'description',
      });
    }
  }

  return entries;
}

// 预先收集所有条目（避免每次迭代重复计算）
const ALL_I18N_ENTRIES = collectAllI18nKeyEntries();

// 去重：同一个 i18n key 可能被多个角色的 Token 共享（如 knockdown 在多个角色中出现）
const UNIQUE_I18N_ENTRIES = ALL_I18N_ENTRIES.filter((entry, index, arr) =>
  arr.findIndex(e => e.i18nKey === entry.i18nKey) === index,
);

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 3: i18n key 覆盖完整性', () => {
  // 确保有足够的测试数据
  it('应存在需要 i18n 覆盖的 key 条目', () => {
    expect(
      UNIQUE_I18N_ENTRIES.length,
      '未找到任何需要 i18n 覆盖的 key 条目',
    ).toBeGreaterThan(0);
    // 至少应有能力、Token、卡牌三类
    const types = new Set(UNIQUE_I18N_ENTRIES.map(e => e.sourceType));
    expect(types.has('ability'), '缺少能力类型的 i18n key').toBe(true);
    expect(types.has('token'), '缺少 Token 类型的 i18n key').toBe(true);
    expect(types.has('card'), '缺少卡牌类型的 i18n key').toBe(true);
  });

  it('任意 i18n key 在 en locale 中应存在', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: UNIQUE_I18N_ENTRIES.length - 1 }),
        (index: number) => {
          const entry = UNIQUE_I18N_ENTRIES[index];
          const enValue = getI18nDescription(entry.i18nKey, 'en');

          if (enValue === undefined) {
            const info = [
              `来源: ${entry.sourceType}`,
              `角色: ${entry.heroId}`,
              `对象: ${entry.objectId}`,
              entry.level ? `等级: L${entry.level}` : '',
              `字段: ${entry.field}`,
              `i18n key: ${entry.i18nKey}`,
            ].filter(Boolean).join(', ');

            expect.fail(`en locale 缺少 i18n key。${info}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意 i18n key 在 zh-CN locale 中应存在', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: UNIQUE_I18N_ENTRIES.length - 1 }),
        (index: number) => {
          const entry = UNIQUE_I18N_ENTRIES[index];
          const zhValue = getI18nDescription(entry.i18nKey, 'zh-CN');

          if (zhValue === undefined) {
            const info = [
              `来源: ${entry.sourceType}`,
              `角色: ${entry.heroId}`,
              `对象: ${entry.objectId}`,
              entry.level ? `等级: L${entry.level}` : '',
              `字段: ${entry.field}`,
              `i18n key: ${entry.i18nKey}`,
            ].filter(Boolean).join(', ');

            expect.fail(`zh-CN locale 缺少 i18n key。${info}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('任意 i18n key 在两个 locale 中应同时存在', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: UNIQUE_I18N_ENTRIES.length - 1 }),
        (index: number) => {
          const entry = UNIQUE_I18N_ENTRIES[index];
          const enValue = getI18nDescription(entry.i18nKey, 'en');
          const zhValue = getI18nDescription(entry.i18nKey, 'zh-CN');

          // 两个 locale 都必须存在
          const missing: string[] = [];
          if (enValue === undefined) missing.push('en');
          if (zhValue === undefined) missing.push('zh-CN');

          if (missing.length > 0) {
            const info = [
              `来源: ${entry.sourceType}`,
              `角色: ${entry.heroId}`,
              `对象: ${entry.objectId}`,
              entry.level ? `等级: L${entry.level}` : '',
              `字段: ${entry.field}`,
              `i18n key: ${entry.i18nKey}`,
              `缺失 locale: ${missing.join(', ')}`,
            ].filter(Boolean).join(', ');

            expect.fail(`i18n key 在部分 locale 中缺失。${info}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
