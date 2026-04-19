/**
 * 王权骰铸 - 审计工具函数模块
 *
 * 提供审计测试所需的数据访问函数：
 * - 获取角色能力定义（含 L1/L2/L3）
 * - 获取角色 Token 定义
 * - 获取角色专属卡和通用卡定义
 * - 读取 i18n 描述文本
 * - 差异严重程度分类
 *
 * 所有函数均为纯查询，不修改任何状态。
 *
 * Requirements: 1.1, 1.2, 1.4, 4.3
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { AbilityDef } from '../../domain/combat';
import type { TokenDef } from '../../domain/tokenTypes';
import type { AbilityCard } from '../../types';
import { HEROES_DATA } from '../../heroes';
import { COMMON_CARDS } from '../../domain/commonCards';

// ============================================================================
// 类型定义
// ============================================================================

/** 差异严重程度 */
export type Severity = 'high' | 'medium' | 'low';

/** 差异类型 */
export type DiscrepancyType =
  | 'value_error'
  | 'effect_missing'
  | 'effect_extra'
  | 'trigger_mismatch'
  | 'description_mismatch'
  | 'tag_mismatch'
  | 'i18n_missing'
  | 'item_missing'
  | 'item_extra';

/** 全部 6 个角色 ID */
export const ALL_HERO_IDS = [
  'barbarian', 'monk', 'pyromancer', 'moon_elf', 'shadow_thief', 'paladin',
] as const;

export type HeroId = typeof ALL_HERO_IDS[number];

/** 带等级信息的能力定义 */
export interface LeveledAbilityDef {
  ability: AbilityDef;
  level: 1 | 2 | 3;
}

// ============================================================================
// Token 导入映射（各角色 tokens.ts 导出名不同，需要逐个映射）
// ============================================================================

import { BARBARIAN_TOKENS } from '../../heroes/barbarian/tokens';
import { MONK_TOKENS } from '../../heroes/monk/tokens';
import { PYROMANCER_TOKENS } from '../../heroes/pyromancer/tokens';
import { MOON_ELF_TOKENS } from '../../heroes/moon_elf/tokens';
import { SHADOW_THIEF_TOKENS } from '../../heroes/shadow_thief/tokens';
import { PALADIN_TOKENS } from '../../heroes/paladin/tokens';

const HERO_TOKENS_MAP: Record<string, TokenDef[]> = {
  barbarian: BARBARIAN_TOKENS,
  monk: MONK_TOKENS,
  pyromancer: PYROMANCER_TOKENS,
  moon_elf: MOON_ELF_TOKENS,
  shadow_thief: SHADOW_THIEF_TOKENS,
  paladin: PALADIN_TOKENS,
};

// ============================================================================
// i18n 数据缓存
// ============================================================================

const i18nCache: Record<string, Record<string, unknown>> = {};

/** 读取指定 locale 的 i18n JSON 数据（懒加载 + 缓存） */
function loadI18n(locale: string): Record<string, unknown> {
  if (!i18nCache[locale]) {
    const filePath = resolve(
      __dirname,
      `../../../../../public/locales/${locale}/game-dicethrone.json`,
    );
    i18nCache[locale] = JSON.parse(readFileSync(filePath, 'utf-8'));
  }
  return i18nCache[locale];
}

// ============================================================================
// 能力定义查询
// ============================================================================

/**
 * 获取指定角色所有等级的能力定义
 *
 * 返回包含 Level 1（基础能力）和 Level 2/3（从升级卡的 replaceAbility 效果中提取）的完整列表。
 * 每个条目附带等级信息。
 */
export function getHeroAbilities(heroId: string): LeveledAbilityDef[] {
  const heroData = HEROES_DATA[heroId];
  if (!heroData) {
    throw new Error(`未找到角色: ${heroId}`);
  }

  const result: LeveledAbilityDef[] = [];

  // Level 1 基础能力
  for (const ability of heroData.abilities) {
    result.push({ ability, level: 1 });
  }

  // Level 2/3 从升级卡的 replaceAbility 效果中提取
  for (const card of heroData.cards) {
    if (card.type !== 'upgrade' || !card.effects) continue;
    for (const effect of card.effects) {
      const action = effect.action;
      if (action?.type === 'replaceAbility' && action.newAbilityDef && action.newAbilityLevel) {
        result.push({
          ability: action.newAbilityDef as AbilityDef,
          level: action.newAbilityLevel as 1 | 2 | 3,
        });
      }
    }
  }

  return result;
}

// ============================================================================
// Token 定义查询
// ============================================================================

/**
 * 获取指定角色所有 Token 定义
 */
export function getHeroTokens(heroId: string): TokenDef[] {
  const tokens = HERO_TOKENS_MAP[heroId];
  if (!tokens) {
    throw new Error(`未找到角色 Token: ${heroId}`);
  }
  return tokens;
}

// ============================================================================
// 卡牌定义查询
// ============================================================================

/**
 * 获取指定角色的专属卡定义（排除通用卡）
 *
 * 通过排除 COMMON_CARDS 中的 ID 来过滤出专属卡。
 */
export function getHeroCards(heroId: string): AbilityCard[] {
  const heroData = HEROES_DATA[heroId];
  if (!heroData) {
    throw new Error(`未找到角色: ${heroId}`);
  }

  const commonCardIds = new Set(COMMON_CARDS.map(c => c.id));
  return heroData.cards.filter(card => !commonCardIds.has(card.id));
}

/**
 * 获取全部 18 张通用卡定义
 */
export function getCommonCards(): AbilityCard[] {
  return COMMON_CARDS;
}

// ============================================================================
// i18n 描述文本查询
// ============================================================================

/**
 * 读取 i18n 描述文本
 *
 * 支持嵌套 key（如 'abilities.slap.name'、'statusEffects.daze.description'）。
 * 如果 key 不存在，返回 undefined。
 *
 * @param key - 点分隔的 i18n key 路径
 * @param locale - 语言代码，默认 'zh-CN'
 */
export function getI18nDescription(
  key: string,
  locale: string = 'zh-CN',
): string | undefined {
  const data = loadI18n(locale);
  const parts = key.split('.');

  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current === 'string') {
    return current;
  }
  // 某些描述是字符串数组（如 Token 描述）
  if (Array.isArray(current) && current.every(item => typeof item === 'string')) {
    return current.join('\n');
  }
  return undefined;
}

// ============================================================================
// 严重程度分类
// ============================================================================

/**
 * 根据差异类型分类严重程度
 *
 * 分类规则（来自设计文档）：
 * - 高：value_error, effect_missing, effect_extra, trigger_mismatch, tag_mismatch, item_missing, item_extra
 * - 中：description_mismatch, i18n_missing
 */
export function classifySeverity(type: DiscrepancyType): Severity {
  switch (type) {
    case 'value_error':
    case 'effect_missing':
    case 'effect_extra':
    case 'trigger_mismatch':
    case 'tag_mismatch':
    case 'item_missing':
    case 'item_extra':
      return 'high';
    case 'description_mismatch':
    case 'i18n_missing':
      return 'medium';
    default: {
      // 穷举检查：确保所有 DiscrepancyType 都被处理
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
