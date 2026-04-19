/**
 * 表达式求值工具
 *
 * 支持算术运算和变量解析的表达式树。
 * 各游戏可用此模块替代自行实现的 damage calc / power calc / Expression 求值器。
 *
 * 设计原则：纯函数，不可变，无副作用
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 字面量 */
export interface LiteralExpr {
  type: 'literal';
  value: number;
}

/** 变量引用 */
export interface VarExpr {
  type: 'var';
  name: string;
}

/** 二元运算 */
export interface BinaryExpr {
  type: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max';
  left: ExpressionNode;
  right: ExpressionNode;
}

/** 一元取反 */
export interface NegateExpr {
  type: 'negate';
  operand: ExpressionNode;
}

/** 条件表达式 */
export interface ConditionalExpr {
  type: 'conditional';
  condition: ExpressionNode;
  /** condition > 0 时取 then，否则取 otherwise */
  then: ExpressionNode;
  otherwise: ExpressionNode;
}

/** 表达式节点联合类型 */
export type ExpressionNode =
  | LiteralExpr
  | VarExpr
  | BinaryExpr
  | NegateExpr
  | ConditionalExpr;

/** 变量上下文（变量名 → 数值） */
export type ExpressionContext = Record<string, number>;

// ============================================================================
// 求值
// ============================================================================

/**
 * 递归求值表达式树
 *
 * @param node 表达式节点
 * @param ctx  变量上下文
 * @returns    计算结果
 * @throws     变量未定义时抛出 Error
 */
export function evaluateExpression(node: ExpressionNode, ctx: ExpressionContext): number {
  switch (node.type) {
    case 'literal':
      return node.value;

    case 'var': {
      const val = ctx[node.name];
      if (val === undefined) {
        throw new Error(`表达式变量未定义: ${node.name}`);
      }
      return val;
    }

    case 'negate':
      return -evaluateExpression(node.operand, ctx);

    case 'conditional': {
      const cond = evaluateExpression(node.condition, ctx);
      return cond > 0
        ? evaluateExpression(node.then, ctx)
        : evaluateExpression(node.otherwise, ctx);
    }

    case 'add':
      return evaluateExpression(node.left, ctx) + evaluateExpression(node.right, ctx);
    case 'sub':
      return evaluateExpression(node.left, ctx) - evaluateExpression(node.right, ctx);
    case 'mul':
      return evaluateExpression(node.left, ctx) * evaluateExpression(node.right, ctx);
    case 'div': {
      const divisor = evaluateExpression(node.right, ctx);
      if (divisor === 0) return 0; // 安全除零
      return evaluateExpression(node.left, ctx) / divisor;
    }
    case 'min':
      return Math.min(
        evaluateExpression(node.left, ctx),
        evaluateExpression(node.right, ctx),
      );
    case 'max':
      return Math.max(
        evaluateExpression(node.left, ctx),
        evaluateExpression(node.right, ctx),
      );
  }
}

// ============================================================================
// 便捷构建函数
// ============================================================================

/** 构建字面量节点 */
export const lit = (value: number): LiteralExpr => ({ type: 'literal', value });

/** 构建变量节点 */
export const ref = (name: string): VarExpr => ({ type: 'var', name });

/** 构建加法节点 */
export const add = (left: ExpressionNode, right: ExpressionNode): BinaryExpr => ({
  type: 'add', left, right,
});

/** 构建乘法节点 */
export const mul = (left: ExpressionNode, right: ExpressionNode): BinaryExpr => ({
  type: 'mul', left, right,
});

/** 构建减法节点 */
export const sub = (left: ExpressionNode, right: ExpressionNode): BinaryExpr => ({
  type: 'sub', left, right,
});
