/**
 * 卡牌名称解析器测试
 */

import { describe, it, expect, vi } from 'vitest';
import { resolveCardDisplayName } from '../cardNameResolver';

describe('resolveCardDisplayName', () => {
  it('应该处理 DiceThrone 风格的卡牌（i18n 字段）', () => {
    const card = {
      id: 'test_card',
      i18n: {
        'zh-CN': { name: '测试卡牌' },
        'en': { name: 'Test Card' },
      },
    };

    expect(resolveCardDisplayName(card)).toBe('测试卡牌');
    expect(resolveCardDisplayName(card, undefined, 'en')).toBe('Test Card');
  });

  it('应该处理 SmashUp 风格的卡牌（i18n key）', () => {
    const card = {
      id: 'alien_invader',
      name: 'cards.alien_invader.name',
    };

    const mockT = vi.fn((key: string) => {
      if (key === 'cards.alien_invader.name') return '外星入侵者';
      return key;
    });

    expect(resolveCardDisplayName(card, mockT)).toBe('外星入侵者');
  });

  it('应该处理 SummonerWars 风格的卡牌（直接 name 字段）', () => {
    const card = {
      id: 'skeleton',
      name: '骷髅战士',
    };

    expect(resolveCardDisplayName(card)).toBe('骷髅战士');
  });

  it('应该回退到 id 当无法解析时', () => {
    const card = {
      id: 'unknown_card',
    };

    expect(resolveCardDisplayName(card as any)).toBe('unknown_card');
  });

  it('应该处理 undefined 输入', () => {
    expect(resolveCardDisplayName(undefined)).toBe('');
  });

  it('应该在 i18n 未命中时回退到原始 name', () => {
    const card = {
      id: 'test_card',
      name: '原始名称',
    };

    const mockT = vi.fn((key: string) => key); // 总是返回 key 本身（未命中）

    expect(resolveCardDisplayName(card, mockT)).toBe('原始名称');
  });

  it('应该在 DiceThrone 风格中回退到英文', () => {
    const card = {
      id: 'test_card',
      i18n: {
        'en': { name: 'Test Card' },
      },
    };

    expect(resolveCardDisplayName(card, undefined, 'zh-CN')).toBe('Test Card');
  });
});
