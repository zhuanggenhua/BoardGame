// Feature: smashup-full-faction-audit, Property 9: 疯狂牌终局惩罚正确性
/**
 * 大杀四方 - 疯狂牌终局惩罚正确性属性测试
 *
 * **Validates: Requirements 3.5**
 *
 * Property 9: 疯狂牌终局惩罚正确性
 * 对于任意非负整数 N 表示玩家持有的疯狂卡数量，终局 VP 扣除值必须等于 `Math.floor(N / 2)`。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { madnessVpPenalty } from '../domain/abilityHelpers';

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 9: 疯狂牌终局惩罚正确性', () => {
    it('任意疯狂卡数量 N，VP 扣除值 === Math.floor(N / 2)', () => {
        fc.assert(
            fc.property(
                fc.nat({ max: 30 }),
                (madnessCount: number) => {
                    const penalty = madnessVpPenalty(madnessCount);
                    // 属性：VP 扣除值必须等于 Math.floor(N / 2)
                    expect(
                        penalty,
                        `疯狂卡数量 ${madnessCount} 的 VP 扣除值应为 ${Math.floor(madnessCount / 2)}，实际为 ${penalty}`,
                    ).toBe(Math.floor(madnessCount / 2));
                },
            ),
            { numRuns: 100 },
        );
    });
});
