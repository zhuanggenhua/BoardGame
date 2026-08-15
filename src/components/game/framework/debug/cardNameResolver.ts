/**
 * 调试面板通用卡牌名称解析器
 * 
 * 用于在调试面板中显示卡牌的国际化名称
 * 按卡牌数据形状解析，不绑定具体游戏。
 */

import type { TFunction } from 'i18next';

/**
 * 带 name 字段的卡牌定义。
 */
interface NamedCardLike {
  id: string;
  name: string; // i18n key 或原始名称
}

/**
 * 带多语言 i18n 字段的卡牌定义。
 */
interface LocalizedCardLike {
  id: string;
  i18n?: {
    'zh-CN'?: { name?: string };
    'en'?: { name?: string };
  };
}

/**
 * 通用卡牌接口
 */
type AnyCard = NamedCardLike | LocalizedCardLike;

/**
 * 解析卡牌名称（通用）
 * 
 * @param card 卡牌对象（可能是定义或实例）
 * @param t i18n 翻译函数（可选，用于解析 name 字段中的 i18n key）
 * @param locale 语言代码（可选，默认 'zh-CN'）
 * @returns 本地化的卡牌名称
 */
export function resolveCardDisplayName(
  card: AnyCard | undefined,
  t?: TFunction,
  locale: string = 'zh-CN'
): string {
  if (!card) return '';

  // 策略 1: 优先读取卡牌对象自带的多语言名称。
  if ('i18n' in card && card.i18n) {
    const localeData = card.i18n[locale as 'zh-CN' | 'en'];
    if (localeData?.name) return localeData.name;
    // 回退到英文
    if (locale !== 'en' && card.i18n.en?.name) return card.i18n.en.name;
  }

  // 策略 2: name 可能是 i18n key，优先交给翻译函数解析。
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

  // 策略 3: name 也可能已经是可显示文本。
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
