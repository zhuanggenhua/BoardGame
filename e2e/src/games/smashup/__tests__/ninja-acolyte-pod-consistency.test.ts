/**
 * 测试：ninja_acolyte POD 版本一致性（以 POD 规则为准）
 */

import { describe, test, expect } from 'vitest';
import { getCardDef } from '../data/cards';
import type { MinionCardDef } from '../domain/types';

describe('ninja_acolyte POD 版本一致性', () => {
    test('基础版和 POD 版的 abilityTags 应该一致', () => {
        const base = getCardDef('ninja_acolyte') as MinionCardDef;
        const pod = getCardDef('ninja_acolyte_pod') as MinionCardDef;

        expect(base).toBeDefined();
        expect(pod).toBeDefined();

        // 两个版本机制不同：基础版是 special（响应型），POD 版是 talent（主动型）
        expect(base.abilityTags).toContain('special');
        expect(pod.abilityTags).toContain('talent');
    });

    test('基础版应有 specialLimitGroup，POD 版不需要', () => {
        const base = getCardDef('ninja_acolyte') as MinionCardDef;
        const pod = getCardDef('ninja_acolyte_pod') as MinionCardDef;

        expect(base.specialLimitGroup).toBe('ninja_acolyte');
        expect(pod.specialLimitGroup).toBeUndefined();
    });

    test('基础版和 POD 版的 power 应该一致', () => {
        const base = getCardDef('ninja_acolyte') as MinionCardDef;
        const pod = getCardDef('ninja_acolyte_pod') as MinionCardDef;

        expect(base.power).toBe(2);
        expect(pod.power).toBe(2);
    });
});
