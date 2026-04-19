/**
 * 调试面板通用卡牌名称解析器
 * 
 * 用于在调试面板中显示卡牌的国际化名称
 * 支持三种游戏的不同数据结构
 */

import type { TFunction } from 'i18next';

/**
 * SmashUp 卡牌定义（简化）
 */
interface SmashUpCardLike {
  id: string;
  name: string; // i18n key 或原始名称
}

/**
 * DiceThrone 卡牌实例（简化）
 */
interface DiceThroneCardLike {
  id: string;
  i18n?: {
    'zh-CN'?: { name?: string };
    'en'?: { name?: string };
  };
}

/**
 * SummonerWars 卡牌（简化）
 */
interface SummonerWarsCardLike {
  id: string;
  name: string; // 直接是中文名
}

/**
 * 通用卡牌接口
 */
type AnyCard = SmashUpCardLike | DiceThroneCardLike | SummonerWarsCardLike;

/**
 * 解析卡牌名称（通用）
 * 
 * @param card 卡牌对象（可能是定义或实例）
 * @param t i18n 翻译函数（可选，SmashUp 需要）
 * @param locale 语言代码（可选，默认 'zh-CN'）
 * @returns 本地化的卡牌名称
 */
export function resolveCardDisplayName(
  card: AnyCard | undefined,
  t?: TFunction,
  locale: string = 'zh-CN'
): string {
  if (!card) return '';

  // 策略 1: DiceThrone 风格（i18n 字段）
  if ('i18n' in card && card.i18n) {
    const localeData = card.i18n[locale as 'zh-CN' | 'en'];
    if (localeData?.name) return localeData.name;
    // 回退到英文
    if (locale !== 'en' && card.i18n.en?.name) return card.i18n.en.name;
  }

  // 策略 2: SmashUp 风格（i18n key + t 函数）
  if ('name' in card && typeof card.name === 'string' && t) {
    // 如果 name 是 i18n key（以 'cards.' 开头）
    if (card.name.startsWith('cards.')) {
      const resolved = t(card.name);
      if (resolved !== card.name) return resolved;
    }
    // 尝试构造 i18n key
    const key = `cards.${card.id}.name`;
    const resolved = t(key);
    if (resolved !== key) return resolved;
  }

  // 策略 3: SummonerWars 风格（直接 name 字段）
  if ('name' in card && typeof card.name === 'string') {
    return card.name;
  }

  // 回退到 id
  return card.id;
}

/**
 * 批量解析卡牌名称
 */
export function resolveCardDisplayNames(
  cards: AnyCard[],
  t?: TFunction,
  locale?: string
): string[] {
  return cards.map(card => resolveCardDisplayName(card, t, locale));
}
