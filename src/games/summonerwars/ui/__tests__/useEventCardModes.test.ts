import { describe, expect, it } from 'vitest';
import { CARD_IDS } from '../../domain/ids';
import { requiresEventInteraction } from '../useEventCardModes';

describe('事件卡 UI 交互路由', () => {
  it('冻结应从手牌进入系统目标选择，而不是直接无目标打出', () => {
    expect(requiresEventInteraction(`${CARD_IDS.SHOUREN_FREEZE}-0-1`)).toBe(true);
  });
});
