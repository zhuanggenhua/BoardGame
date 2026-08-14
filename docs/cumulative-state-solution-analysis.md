# 引擎层通用解决方案分析

## 问题回顾

DiceThrone 护盾 bug 的根源：
- 日志格式化层依赖累计状态（ttackResolved.payload.totalDamage）
- 撤回后累计状态保留旧值，导致重新执行时计算错误

## 是否需要引擎层通用解决方案？

### 方案 1：累计状态管理器（CumulativeStateManager）

**设计思路**：
- 引擎层提供专门的累计状态容器
- 自动在撤回时重置累计状态
- 提供类型安全的 API

**实现示例**：
\\\	ypescript
// src/engine/primitives/cumulativeState.ts
export interface CumulativeStateContainer<T> {
  __cumulative: true;
  value: T;
  resetOnUndo: boolean;
}

export function createCumulativeState<T>(
  initialValue: T,
  resetOnUndo = true
): CumulativeStateContainer<T> {
  return { __cumulative: true, value: initialValue, resetOnUndo };
}

// 在 UndoSystem 中自动重置
function restoreSnapshot(snapshot: MatchState) {
  return resetCumulativeFields(snapshot);
}
\\\

**优点**：
-  类型安全，编译期检查
-  自动重置，防止污染
-  显式标记，易于识别

**缺点**：
-  需要修改引擎核心（UndoSystem）
-  游戏层需要迁移现有代码
-  增加学习成本
-  当前只有 DiceThrone 需要（YAGNI 违反）

**结论**： 不推荐。成本高，收益低。

---

### 方案 2：日志格式化辅助函数（推荐）

**设计思路**：
- 引擎层提供日志格式化的最佳实践辅助函数
- 强制只依赖当前事件数据
- 不修改引擎核心，只提供工具

**实现示例**：
\\\	ypescript
// src/engine/primitives/actionLogHelpers.ts（已存在）

/**
 * 构建伤害 breakdown segment（已有）
 * 
 * 强制只依赖当前事件数据，不依赖累计状态
 */
export function buildDamageBreakdownSegment(
  rawDamage: number,  // 基础伤害（从当前事件获取）
  eventData: {
    sourceAbilityId?: string;
    breakdown?: any;
    modifiers?: any[];
  },
  resolver: DamageSourceResolver,
  ns: string
): ActionLogSegment {
  // 只使用 rawDamage 和 eventData，不读取任何累计状态
  // ...
}

/**
 * 新增：累计伤害计算辅助函数
 * 
 * 从事件流中计算累计伤害，而不是从状态中读取
 */
export function calculateTotalDamageFromEvents(
  events: GameEvent[],
  targetId: string
): number {
  return events
    .filter((e): e is DamageDealtEvent => 
      e.type === 'DAMAGE_DEALT' && e.payload.targetId === targetId
    )
    .reduce((sum, e) => sum + (e.payload.actualDamage ?? 0), 0);
}
\\\

**优点**：
-  不修改引擎核心，零风险
-  提供最佳实践，防止重复错误
-  游戏层可选使用，不强制
-  文档化最佳实践

**缺点**：
-  不强制，游戏层仍可能犯错
-  需要文档和示例

**结论**： 推荐。低成本，高收益。

---

### 方案 3：静态分析工具（长期）

**设计思路**：
- 编写 ESLint 规则检测反模式
- 在 CI 中自动检查

**实现示例**：
\\\	ypescript
// eslint-plugin-boardgame/rules/no-cumulative-state-in-log.js
module.exports = {
  create(context) {
    return {
      MemberExpression(node) {
        // 检测 game.ts 中是否读取 payload.total* 字段
        if (
          context.getFilename().endsWith('game.ts') &&
          node.property.name.startsWith('total')
        ) {
          context.report({
            node,
            message: '日志格式化层禁止读取累计状态（payload.total*）',
          });
        }
      },
    };
  },
};
\\\

**优点**：
-  编译期检查，零运行时成本
-  强制执行，防止犯错
-  可扩展到其他反模式

**缺点**：
-  需要额外工具链
-  维护成本高
-  当前只有一个案例（YAGNI 违反）

**结论**： 可选。等有更多案例再考虑。

---

## 推荐方案

### 立即实施：方案 2（日志格式化辅助函数）

**1. 扩展 actionLogHelpers.ts**

\\\	ypescript
// src/engine/primitives/actionLogHelpers.ts

/**
 * 从事件流计算累计伤害（替代读取累计状态）
 * 
 * 用途：当需要显示"本次攻击总伤害"时，从事件流计算而非读取 state
 * 
 * @example
 * //  错误：依赖累计状态
 * const totalDamage = attackResolved.payload.totalDamage;
 * 
 * //  正确：从事件流计算
 * const totalDamage = calculateTotalDamageFromEvents(events, defenderId);
 */
export function calculateTotalDamageFromEvents(
  events: GameEvent[],
  targetId: string,
  filter?: (event: GameEvent) => boolean
): number {
  return events
    .filter((e): e is DamageDealtEvent => 
      e.type === 'DAMAGE_DEALT' && 
      e.payload.targetId === targetId &&
      (!filter || filter(e))
    )
    .reduce((sum, e) => sum + (e.payload.actualDamage ?? 0), 0);
}

/**
 * 从事件流计算累计治疗
 */
export function calculateTotalHealingFromEvents(
  events: GameEvent[],
  targetId: string
): number {
  return events
    .filter((e): e is HealAppliedEvent => 
      e.type === 'HEAL_APPLIED' && e.payload.targetId === targetId
    )
    .reduce((sum, e) => sum + e.payload.amount, 0);
}
\\\

**2. 更新文档**

在 \.spec/knowledge/standards/engine-systems.md\ 中添加：

\\\markdown
### ActionLog 最佳实践（强制）

**禁止依赖累计状态**：
-  禁止读取 \ttackResolved.payload.totalDamage\
-  禁止读取 \pendingAttack.resolvedDamage\
-  禁止读取任何跨批次的累计状态

**正确做法**：
-  只依赖当前事件数据（\event.payload\）
-  使用 \calculateTotalDamageFromEvents\ 从事件流计算
-  使用 \uildDamageBreakdownSegment\ 构建 breakdown

**示例**：
\\\	ypescript
//  错误
const dealt = attackResolved.payload.totalDamage;

//  正确
const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);
\\\
\\\

**3. 在 AGENTS.md 中添加检查清单**

\\\markdown
### 日志格式化规范（强制）
- [ ] 是否只依赖当前事件数据？
- [ ] 是否使用 \uildDamageBreakdownSegment\？
- [ ] 是否避免读取 \payload.total*\ 字段？
- [ ] 是否使用 \calculateTotalDamageFromEvents\ 计算累计值？
\\\

---

### 长期考虑：方案 3（静态分析）

**触发条件**：
- 当有 3 个以上游戏出现类似问题时
- 或者有新人频繁犯同样错误时

**实施步骤**：
1. 创建 ESLint 规则
2. 在 CI 中启用
3. 逐步修复现有代码

---

## 总结

**立即实施**：
-  扩展 \ctionLogHelpers.ts\，提供 \calculateTotalDamageFromEvents\
-  更新文档，明确最佳实践
-  在 AGENTS.md 中添加检查清单

**不推荐**：
-  累计状态管理器（成本高，收益低）
-  修改引擎核心（YAGNI 违反）

**长期考虑**：
-  静态分析工具（等有更多案例）

**核心原则**：
- 提供工具和最佳实践，不强制约束
- 文档化反模式，防止重复错误
- 遵循 YAGNI，不做过度设计
