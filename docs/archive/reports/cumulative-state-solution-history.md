# 引擎层累计状态方案分析归档

本文是 DiceThrone 护盾/日志问题后的历史方案分析，不作为当前引擎规范。当前日志、撤回、伤害和事件消费以 `.spec` 标准、现有引擎代码和测试为准。本文保留当时“为什么不新增一套累计状态管理器”的设计取舍。

## 当时问题

DiceThrone 护盾问题暴露出一个通用风险：日志格式化层读取了跨批次累计状态，例如旧记录里的 `attackResolved.payload.totalDamage`。撤回后累计状态保留旧值，重新执行时日志或伤害展示可能读到过期结果。

现实含义是：玩家看到的伤害、护盾消耗或日志说明可能来自旧状态，而不是本次结算产生的真实事件。

## 方案 1：累计状态管理器

旧方案设想在引擎层新增 `CumulativeStateManager` 或类似容器，显式标记哪些状态需要在撤回时自动重置。

当时优点：

- 类型上能标出累计状态。
- 撤回时可自动重置，降低污染概率。
- 容器化后更容易搜索和审查。

当时否决理由：

- 需要修改引擎核心和 undo 机制。
- 游戏层要迁移既有状态。
- 增加学习成本。
- 当时只有 DiceThrone 一个明确案例，直接上引擎级抽象属于过度设计。

## 方案 2：日志格式化辅助函数

旧文档推荐的立即方向是：不改引擎核心，而是让日志格式化只依赖当前事件数据，必要时从事件流计算累计值。

当时建议的辅助函数方向：

```ts
export function calculateTotalDamageFromEvents(
  events: GameEvent[],
  targetId: string,
  filter?: (event: GameEvent) => boolean,
): number {
  return events
    .filter((event): event is DamageDealtEvent =>
      event.type === 'DAMAGE_DEALT' &&
      event.payload.targetId === targetId &&
      (!filter || filter(event)))
    .reduce((sum, event) => sum + (event.payload.actualDamage ?? 0), 0);
}
```

当时优点：

- 不改引擎核心，风险低。
- 只约束日志消费方式，能直接修当时问题。
- 可配合 `buildDamageBreakdownSegment` 复用已有伤害 breakdown。

当时缺点：

- 不强制；游戏层仍可能再次读取累计状态。
- 需要文档、示例或后续静态检查补强。

## 方案 3：静态分析规则

旧方案把 ESLint 规则列为长期方向：当同类问题在多个游戏反复出现时，再考虑检测 `game.ts` 或日志格式化层读取 `payload.total*`、`pendingAttack.resolvedDamage` 等反模式。

当时没有立即做，理由是工具链成本高，且案例数量不足。

## 保留裁决

当时裁决是：

- 立即修复：日志格式化只读当前事件或从同一批事件流计算，不读跨批次累计状态。
- 暂不新增：引擎级累计状态容器。
- 暂不新增：专用 ESLint 规则，除非同类问题扩散。

## 当前使用口径

- 如果当前再次出现撤回后日志/伤害显示错误，先找现实症状对应的事件和状态来源。
- 先证明错误来自跨批次累计状态，再决定是否需要引擎抽象。
- 能用唯一事件结果和现有伤害管线解决时，不新增第二套累计状态真相源。
- 若同类问题已扩散到多个游戏，再考虑把静态检查或规范补到当前 `.spec` 主源。
