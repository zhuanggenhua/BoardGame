import { describe, expect, it } from 'vitest';
import {
  canNormalMove,
  resolveMovementCost,
  resolveMovementPath,
  type MovementCheck,
} from '../movement';

const ok: MovementCheck = { valid: true, failures: [] };

describe('movement primitives', () => {
  it('解析有向路径并拒绝循环或原地移动', () => {
    expect(resolveMovementPath('a', 'c', (node) => node === 'a' ? 'b' : node === 'b' ? 'c' : null)).toEqual(['a', 'b', 'c']);
    expect(resolveMovementPath('a', 'a', () => 'a')).toBeNull();
    expect(resolveMovementPath('a', 'c', (node) => node === 'a' ? 'b' : 'a')).toBeNull();
  });

  it('按每步成本和修正计算成本', () => {
    const path = ['a', 'b', 'c'] as const;
    expect(resolveMovementCost(path, (_from, _to, index) => index + 1)).toBe(3);
    expect(resolveMovementCost(path, (_from, _to, index) => index + 1, { perStepModifier: 1, flatModifier: 2 })).toBe(7);
    expect(resolveMovementCost(path, () => 10, { free: true })).toBe(0);
  });

  it('组合进出地点、交战和资源限制，保留结构化失败原因', () => {
    const result = canNormalMove({
      from: 'a',
      to: 'b',
      path: ['a', 'b'],
      cost: 3,
      availableResource: 1,
      enforceResource: true,
      engaged: true,
      ignoreEngagement: false,
      leave: ok,
      enter: ok,
      pathCheck: ok,
    });
    expect(result.valid).toBe(false);
    expect(result.failures.map((failure) => failure.code)).toEqual(['engaged', 'insufficientResource']);
  });
});
