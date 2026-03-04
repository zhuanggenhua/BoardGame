/**
 * 忍者特殊能力限制修复测试
 * 
 * Bug: 所有忍者特殊卡牌共享同一个 specialLimitGroup，导致使用一张后无法使用其他忍者特殊卡牌
 * Fix: 每张忍者特殊卡牌有独立的 specialLimitGroup
 * 
 * 验证：
 * 1. 同一个基地可以使用影舞者 + 便衣忍者（不同卡牌）
 * 2. 同一个基地不能使用 2 个影舞者（相同卡牌）
 * 3. 同一个基地不能使用 2 个便衣忍者（相同卡牌）
 */

import { describe, it, expect } from 'vitest';
import { getCardDef } from '../data/cards';

describe('忍者特殊能力限制修复', () => {
    it('影舞者有独立的 specialLimitGroup', () => {
        const def = getCardDef('ninja_shinobi');
        expect(def).toBeDefined();
        expect((def as any).specialLimitGroup).toBe('ninja_shinobi');
    });

    it('便衣忍者有独立的 specialLimitGroup', () => {
        const def = getCardDef('ninja_hidden_ninja');
        expect(def).toBeDefined();
        expect((def as any).specialLimitGroup).toBe('ninja_hidden_ninja');
    });

    it('忍者侍从有独立的 specialLimitGroup', () => {
        const def = getCardDef('ninja_acolyte');
        expect(def).toBeDefined();
        expect((def as any).specialLimitGroup).toBe('ninja_acolyte');
    });

    it('三张忍者特殊卡牌的 specialLimitGroup 互不相同', () => {
        const shinobi = getCardDef('ninja_shinobi');
        const hidden = getCardDef('ninja_hidden_ninja');
        const acolyte = getCardDef('ninja_acolyte');

        const shinobiGroup = (shinobi as any).specialLimitGroup;
        const hiddenGroup = (hidden as any).specialLimitGroup;
        const acolyteGroup = (acolyte as any).specialLimitGroup;

        // 验证：三个限制组互不相同
        expect(shinobiGroup).not.toBe(hiddenGroup);
        expect(shinobiGroup).not.toBe(acolyteGroup);
        expect(hiddenGroup).not.toBe(acolyteGroup);

        // 验证：不再使用共享的 'ninja_special'
        expect(shinobiGroup).not.toBe('ninja_special');
        expect(hiddenGroup).not.toBe('ninja_special');
        expect(acolyteGroup).not.toBe('ninja_special');
    });
});
