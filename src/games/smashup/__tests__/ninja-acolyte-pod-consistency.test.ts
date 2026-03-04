/**
 * 测试：ninja_acolyte POD 版本与基础版一致性
 * 
 * 问题：POD 版 abilityTags 是 'talent'，基础版是 'special'
 * 修复：统一为 'special'，并添加 specialLimitGroup
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

        // 两个版本的 abilityTags 应该一致
        expect(pod.abilityTags).toEqual(base.abilityTags);
        expect(pod.abilityTags).toContain('special');
    });

    test('基础版和 POD 版的 specialLimitGroup 应该一致', () => {
        const base = getCardDef('ninja_acolyte') as MinionCardDef;
        const pod = getCardDef('ninja_acolyte_pod') as MinionCardDef;

        expect(base.specialLimitGroup).toBe('ninja_acolyte');
        expect(pod.specialLimitGroup).toBe('ninja_acolyte');
    });

    test('基础版和 POD 版的 power 应该一致', () => {
        const base = getCardDef('ninja_acolyte') as MinionCardDef;
        const pod = getCardDef('ninja_acolyte_pod') as MinionCardDef;

        expect(base.power).toBe(2);
        expect(pod.power).toBe(2);
    });
});
