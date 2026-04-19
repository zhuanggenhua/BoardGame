// Feature: dicethrone-ability-wiki-audit, Property 4: 差异严重程度分类正确性
/**
 * 王权骰铸 - 差异严重程度分类正确性属性测试
 *
 * **Validates: Requirements 4.3**
 *
 * Property 4: 差异严重程度分类正确性
 * 对于任意差异类型（DiscrepancyType），classifySeverity() 的映射结果必须符合设计文档的严重程度分级规则：
 * - 高：value_error, effect_missing, effect_extra, trigger_mismatch, tag_mismatch, item_missing, item_extra
 * - 中：description_mismatch, i18n_missing
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  classifySeverity,
  type DiscrepancyType,
  type Severity,
} from '../__tests__/helpers/auditUtils';

// ============================================================================
// 设计文档中定义的严重程度映射规则
// ============================================================================

/** 高严重程度的差异类型 */
const HIGH_SEVERITY_TYPES: DiscrepancyType[] = [
  'value_error',
  'effect_missing',
  'effect_extra',
  'trigger_mismatch',
  'tag_mismatch',
  'item_missing',
  'item_extra',
];

/** 中严重程度的差异类型 */
const MEDIUM_SEVERITY_TYPES: DiscrepancyType[] = [
  'description_mismatch',
  'i18n_missing',
];

/** 所有差异类型 */
const ALL_DISCREPANCY_TYPES: DiscrepancyType[] = [
  ...HIGH_SEVERITY_TYPES,
  ...MEDIUM_SEVERITY_TYPES,
];

/** 设计文档中的期望映射表 */
const EXPECTED_SEVERITY_MAP: Record<DiscrepancyType, Severity> = {
  value_error: 'high',
  effect_missing: 'high',
  effect_extra: 'high',
  trigger_mismatch: 'high',
  tag_mismatch: 'high',
  item_missing: 'high',
  item_extra: 'high',
  description_mismatch: 'medium',
  i18n_missing: 'medium',
};

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 4: 差异严重程度分类正确性', () => {
  it('任意 DiscrepancyType 的严重程度分类结果符合设计文档规则', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_DISCREPANCY_TYPES),
        (type: DiscrepancyType) => {
          const actual = classifySeverity(type);
          const expected = EXPECTED_SEVERITY_MAP[type];

          expect(
            actual,
            `差异类型 [${type}] 的严重程度应为 [${expected}]，实际为 [${actual}]`,
          ).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('高严重程度类型全部映射为 high', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HIGH_SEVERITY_TYPES),
        (type: DiscrepancyType) => {
          expect(classifySeverity(type)).toBe('high');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('中严重程度类型全部映射为 medium', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MEDIUM_SEVERITY_TYPES),
        (type: DiscrepancyType) => {
          expect(classifySeverity(type)).toBe('medium');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('所有 DiscrepancyType 枚举值均已覆盖（无遗漏）', () => {
    // 确保测试中的 ALL_DISCREPANCY_TYPES 覆盖了所有 9 种差异类型
    expect(ALL_DISCREPANCY_TYPES).toHaveLength(9);

    // 每种类型都能正常调用 classifySeverity 且返回有效 Severity
    for (const type of ALL_DISCREPANCY_TYPES) {
      const severity = classifySeverity(type);
      expect(['high', 'medium', 'low']).toContain(severity);
    }
  });
});
