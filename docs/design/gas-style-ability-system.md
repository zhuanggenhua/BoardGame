# 能力系统事实索引

本文只保留当前通用能力原语的事实入口。能力系统的执行规范和跨游戏抽象边界以 [engine-ability-framework](../../.spec/knowledge/standards/engine-ability-framework.md) 为准。

## 当前结构

| 能力 | 文件 |
| --- | --- |
| 能力定义与执行注册 | [ability.ts](../../src/engine/primitives/ability.ts) |
| 能力约束 | [abilityConstraints.ts](../../src/engine/primitives/abilityConstraints.ts) |
| 条件原语 | [condition.ts](../../src/engine/primitives/condition.ts) |
| 效果原语 | [effects.ts](../../src/engine/primitives/effects.ts) |
| 目标原语 | [target.ts](../../src/engine/primitives/target.ts) |
| 表达式原语 | [expression.ts](../../src/engine/primitives/expression.ts) |
| 标签系统 | [tags.ts](../../src/engine/primitives/tags.ts) |
| 修改器管线 | [modifier.ts](../../src/engine/primitives/modifier.ts) |
| 属性集合 | [attribute.ts](../../src/engine/primitives/attribute.ts) |

## 当前口径

- `src/engine/primitives/` 只提供无游戏语义的原语和注册表。
- 游戏专属的阶段、骰面、伤害、卡牌、角色、token 和 UI 入口都下沉到 `src/games/<gameId>/domain/`。
- 不再维护全局战斗预设；需要预设时由具体游戏在自己的领域层组合。
- 旧 GAS 风格概念、长示例和具体游戏样例已删除，避免被误当成当前实现指南。

## 验证入口

- 原语单测：`src/engine/primitives/__tests__/`
- 实体引用链：`src/engine/testing/referenceValidator.ts`
- 新增能力或实体后，按对应游戏现有测试和 [testing-tdd](../../.spec/knowledge/standards/testing-tdd.md) 补最窄验证。
