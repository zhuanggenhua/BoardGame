import { describe, it, expect } from 'vitest';
import {
  evaluateExpression,
  lit,
  ref,
  add,
  mul,
  sub,
  type ExpressionNode,
  type ExpressionContext,
} from '../expression';

describe('engine/primitives/expression', () => {
  describe('literal', () => {
    it('应返回字面量值', () => {
      expect(evaluateExpression(lit(5), {})).toBe(5);
      expect(evaluateExpression(lit(-3), {})).toBe(-3);
      expect(evaluateExpression(lit(0), {})).toBe(0);
    });
  });

  describe('var', () => {
    it('应从上下文取变量值', () => {
      const ctx: ExpressionContext = { damage: 10, bonus: 2 };
      expect(evaluateExpression(ref('damage'), ctx)).toBe(10);
      expect(evaluateExpression(ref('bonus'), ctx)).toBe(2);
    });

    it('变量未定义时应抛出异常', () => {
      expect(() => evaluateExpression(ref('missing'), {})).toThrowError('表达式变量未定义: missing');
    });
  });

  describe('arithmetic', () => {
    it('add', () => {
      const expr: ExpressionNode = add(lit(5), lit(3));
      expect(evaluateExpression(expr, {})).toBe(8);
    });

    it('sub', () => {
      const expr: ExpressionNode = sub(lit(10), lit(4));
      expect(evaluateExpression(expr, {})).toBe(6);
    });

    it('mul', () => {
      const expr: ExpressionNode = mul(lit(3), lit(4));
      expect(evaluateExpression(expr, {})).toBe(12);
    });

    it('div', () => {
      const expr: ExpressionNode = { type: 'div', left: lit(10), right: lit(2) };
      expect(evaluateExpression(expr, {})).toBe(5);
    });

    it('div by zero should return 0', () => {
      const expr: ExpressionNode = { type: 'div', left: lit(10), right: lit(0) };
      expect(evaluateExpression(expr, {})).toBe(0);
    });

    it('min', () => {
      const expr: ExpressionNode = { type: 'min', left: lit(5), right: lit(3) };
      expect(evaluateExpression(expr, {})).toBe(3);
    });

    it('max', () => {
      const expr: ExpressionNode = { type: 'max', left: lit(5), right: lit(3) };
      expect(evaluateExpression(expr, {})).toBe(5);
    });
  });

  describe('nested expressions', () => {
    it('10 + 2*3 = 16', () => {
      const ctx: ExpressionContext = { base: 10, bonus: 3 };
      const expr: ExpressionNode = add(ref('base'), mul(lit(2), ref('bonus')));
      expect(evaluateExpression(expr, ctx)).toBe(16);
    });

    it('(5 + 3) * 2 = 16', () => {
      const expr: ExpressionNode = mul(add(lit(5), lit(3)), lit(2));
      expect(evaluateExpression(expr, {})).toBe(16);
    });
  });

  describe('negate', () => {
    it('应取相反数', () => {
      const expr: ExpressionNode = { type: 'negate', operand: lit(5) };
      expect(evaluateExpression(expr, {})).toBe(-5);
    });
  });

  describe('conditional', () => {
    it('condition > 0 时取 then', () => {
      const expr: ExpressionNode = {
        type: 'conditional',
        condition: lit(1),
        then: lit(10),
        otherwise: lit(20),
      };
      expect(evaluateExpression(expr, {})).toBe(10);
    });

    it('condition <= 0 时取 otherwise', () => {
      const expr: ExpressionNode = {
        type: 'conditional',
        condition: lit(0),
        then: lit(10),
        otherwise: lit(20),
      };
      expect(evaluateExpression(expr, {})).toBe(20);
    });
  });
});
