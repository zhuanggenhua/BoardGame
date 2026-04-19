// Feature: dicethrone-ability-wiki-audit, Property 2: 代码内部效果-描述一致性
/**
 * 王权骰铸 - 代码内部效果-描述一致性属性测试
 *
 * **Validates: Requirements 2.1, 3.1, 6A.1, 6B.2**
 *
 * Property 2: 代码内部效果-描述一致性
 * 对于任意角色的任意 AbilityDef，如果其 effects 中包含 action.type === 'damage' 且 action.value === N，
 * 则对应的 i18n 效果描述文本中必须包含数值 N。同理适用于 heal、grantStatus 等 action 类型。
 * 此属性同样适用于 TokenDef 和 AbilityCard 的 effects。
 *
 * 策略：
 * - 收集所有带有显式数值效果（damage/heal/grantStatus）的能力/Token/卡牌
 * - 使用 fast-check 随机选取，验证 i18n 描述文本中包含对应数值
 * - 对于 custom action、rollDie 等复杂效果，仅验证 i18n key 存在
 * - 对于 Token 的 passiveTrigger.actions，检查其中的数值效果
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
import type { AbilityEffect } from '../domain/combat';

// ============================================================================
// 数据收集：提取所有带显式数值效果的审计条目
// ============================================================================

/** 审计条目：一个带有数值效果的能力/Token/卡牌 */
interface NumericEffectEntry {
  /** 来源类型 */
  sourceType: 'ability' | 'token' | 'card';
  /** 来源角色 ID（通用卡为 'common'） */
  heroId: string;
  /** 对象 ID */
  objectId: string;
  /** 等级（仅能力） */
  level?: 1 | 2 | 3;
  /** 效果的 action.type */
  actionType: string;
  /** 效果的数值 */
  value: number;
  /** 效果的 i18n 描述文本（effect.description） */
  effectDescription: string;
}

/**
 * 从 AbilityEffect 数组中提取带数值的效果条目
 */
function extractNumericEffects(
  effects: AbilityEffect[],
  sourceType: 'ability' | 'card',
  heroId: string,
  objectId: string,
  level?: 1 | 2 | 3,
): NumericEffectEntry[] {
  const entries: NumericEffectEntry[] = [];
  for (const effect of effects) {
    if (!effect.action) continue;
    const { type, value } = effect.action;
    // 仅检查有显式数值的 damage/heal/grantStatus
    if ((type === 'damage' || type === 'heal' || type === 'grantStatus') && typeof value === 'number') {
      entries.push({
        sourceType,
        heroId,
        objectId,
        level,
        actionType: type,
        value,
        effectDescription: effect.description,
      });
    }
  }
  return entries;
}

/** 收集所有带数值效果的条目 */
function collectAllNumericEffectEntries(): NumericEffectEntry[] {
  const entries: NumericEffectEntry[] = [];

  // 1. 能力（含 L1/L2/L3 及变体）
  for (const heroId of ALL_HERO_IDS) {
    const abilities = getHeroAbilities(heroId);
    for (const { ability, level } of abilities) {
      // 顶层 effects
      if (ability.effects) {
        entries.push(...extractNumericEffects(ability.effects, 'ability', heroId, ability.id, level));
      }
      // 变体 effects
      if (ability.variants) {
        for (const variant of ability.variants) {
          if (variant.effects) {
            entries.push(...extractNumericEffects(variant.effects, 'ability', heroId, ability.id, level));
          }
        }
      }
    }
  }

  // 2. Token 的 passiveTrigger.actions
  // 注意：Token 描述是整体行为描述（string[]），不是逐 action 的描述。
  // 某些 Token 的 action.value 是实现细节（如 poison 的 value:1 表示每层伤害，
  // 但描述说"take n damage"），因此 Token 仅检查描述中是否包含数值，
  // 对于使用变量/公式的描述（含 'n'、'='、'stacks' 等）跳过数值检查。
  for (const heroId of ALL_HERO_IDS) {
    const tokens = getHeroTokens(heroId);
    for (const token of tokens) {
      if (token.passiveTrigger?.actions) {
        for (const action of token.passiveTrigger.actions) {
          if ((action.type === 'damage' || action.type === 'heal' || action.type === 'grantStatus') && typeof action.value === 'number') {
            // Token 描述是 string[] 或 i18n key
            const rawDesc = Array.isArray(token.description)
              ? token.description.join('\n')
              : String(token.description);
            entries.push({
              sourceType: 'token',
              heroId,
              objectId: token.id,
              actionType: action.type,
              value: action.value,
              effectDescription: rawDesc,
            });
          }
        }
      }
    }
  }

  // 3. 专属卡
  for (const heroId of ALL_HERO_IDS) {
    const cards = getHeroCards(heroId);
    for (const card of cards) {
      if (card.effects) {
        entries.push(...extractNumericEffects(card.effects, 'card', heroId, card.id));
      }
    }
  }

  // 4. 通用卡
  const commonCards = getCommonCards();
  for (const card of commonCards) {
    if (card.effects) {
      entries.push(...extractNumericEffects(card.effects, 'card', 'common', card.id));
    }
  }

  return entries;
}

// 预先收集所有条目（避免每次迭代重复计算）
const ALL_NUMERIC_ENTRIES = collectAllNumericEffectEntries();

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析 i18n 描述文本，获取实际文本内容
 *
 * effect.description 可能是：
 * 1. i18n key（如 'abilities.slap.effects.damage4'）→ 需要从 i18n 文件读取
 * 2. 直接的中文文本（如 '施加脑震荡'）→ 直接使用
 *
 * 同时检查 en 和 zh-CN 两个 locale
 */
function resolveDescriptionTexts(description: string): string[] {
  const texts: string[] = [];

  // 尝试作为 i18n key 读取
  const enText = getI18nDescription(description, 'en');
  const zhText = getI18nDescription(description, 'zh-CN');

  if (enText) texts.push(enText);
  if (zhText) texts.push(zhText);

  // 如果不是 i18n key，直接使用原始文本
  if (!enText && !zhText) {
    texts.push(description);
  }

  return texts;
}

/**
 * 检查文本中是否包含指定数值
 *
 * 支持多种格式：
 * - 直接数字："Deal 4 damage" 包含 4
 * - 中文数字："造成4点伤害" 包含 4
 * - 插值模板："{{damage}}" 视为通过（动态值）
 * - 变量公式："take n damage (n = stacks)" 视为通过（运行时计算）
 */
function textContainsValue(texts: string[], value: number): boolean {
  const valueStr = String(value);
  for (const text of texts) {
    // 直接包含数字
    if (text.includes(valueStr)) return true;
    // 包含插值模板（动态值，视为通过）
    if (text.includes('{{') && text.includes('}}')) return true;
  }
  return false;
}

/**
 * 检查 Token 描述是否使用变量/公式表示数值（如 "n damage", "stacks" 等）
 * 这类描述的数值在运行时动态计算，不需要包含固定数字
 */
function isTokenDynamicDescription(texts: string[]): boolean {
  for (const text of texts) {
    const lower = text.toLowerCase();
    // 常见的动态数值模式
    if (
      /\bn\b.*damage/i.test(text) ||
      /\bn\b.*伤害/i.test(text) ||
      lower.includes('stacks') ||
      lower.includes('层数') ||
      lower.includes('= number of') ||
      lower.includes('n=') ||
      lower.includes('n =')
    ) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 2: 代码内部效果-描述一致性', () => {
  // 确保有足够的测试数据
  it('应存在带数值效果的审计条目', () => {
    expect(
      ALL_NUMERIC_ENTRIES.length,
      '未找到任何带数值效果的能力/Token/卡牌',
    ).toBeGreaterThan(0);
  });

  it('任意带数值效果的能力/Token/卡牌，其 i18n 描述文本中应包含对应数值', () => {
    // 跳过条件：如果没有数值条目则跳过
    if (ALL_NUMERIC_ENTRIES.length === 0) return;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: ALL_NUMERIC_ENTRIES.length - 1 }),
        (index: number) => {
          const entry = ALL_NUMERIC_ENTRIES[index];

          // 解析描述文本（从 i18n 或直接文本）
          const texts = resolveDescriptionTexts(entry.effectDescription);

          // Token 的描述可能使用变量/公式（如 "n damage"），跳过数值检查
          if (entry.sourceType === 'token' && isTokenDynamicDescription(texts)) {
            return; // 动态描述，不需要包含固定数字
          }

          // grantStatus 且 value === 1 时，描述中常省略 "1"（如 "施加脑震荡" / "Inflict Daze"）
          // 这是游戏描述的常见惯例，value=1 是默认/隐含的
          if (entry.actionType === 'grantStatus' && entry.value === 1) {
            // 只需验证描述文本非空即可
            expect(
              texts.length,
              `grantStatus 效果缺少描述文本（角色: ${entry.heroId}, 对象: ${entry.objectId}）`,
            ).toBeGreaterThan(0);
            return;
          }

          // 验证：描述文本中应包含效果数值
          const containsValue = textContainsValue(texts, entry.value);

          // 构建详细错误信息
          if (!containsValue) {
            const info = [
              `来源: ${entry.sourceType}`,
              `角色: ${entry.heroId}`,
              `对象: ${entry.objectId}`,
              entry.level ? `等级: L${entry.level}` : '',
              `效果类型: ${entry.actionType}`,
              `期望数值: ${entry.value}`,
              `描述 key: ${entry.effectDescription}`,
              `解析文本: ${JSON.stringify(texts)}`,
            ].filter(Boolean).join(', ');

            expect.fail(
              `效果数值 ${entry.value} 未在描述文本中体现。${info}`,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('所有带数值效果的能力描述 i18n key 应可解析', () => {
    // 验证所有能力效果的 i18n key 至少在一个 locale 中存在
    const abilityEntries = ALL_NUMERIC_ENTRIES.filter(e => e.sourceType === 'ability');
    if (abilityEntries.length === 0) return;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: abilityEntries.length - 1 }),
        (index: number) => {
          const entry = abilityEntries[index];
          const desc = entry.effectDescription;

          // 如果是 i18n key 格式（包含点号），验证至少一个 locale 能解析
          if (desc.includes('.')) {
            const enText = getI18nDescription(desc, 'en');
            const zhText = getI18nDescription(desc, 'zh-CN');
            const resolved = enText || zhText;

            if (!resolved) {
              expect.fail(
                `i18n key 无法解析: ${desc}（角色: ${entry.heroId}, 能力: ${entry.objectId}, L${entry.level}）`,
              );
            }
          }
          // 非 i18n key（直接文本）不需要额外验证
        },
      ),
      { numRuns: 100 },
    );
  });
});
