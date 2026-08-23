# 伤害计算管线迁移索引

项目伤害合同主源是 [`engine-damage-pipeline`](../../.spec/knowledge/standards/engine-damage-pipeline.md)。本文只保留迁移入口、API 位置和历史注意事项。

## 当前口径

- 新游戏涉及伤害、护盾、减伤、防止、生命值或等价扣减时，直接使用伤害管线生成正式伤害事件。
- 旧游戏触碰伤害、生命值、日志、动画或 AI 消费时，先判断是否迁入同一管线；不要继续扩散手写 `DAMAGE_DEALT` 主链。
- 具体游戏迁移经验只作为历史样例，不是通用规则来源。

## 代码入口

- 管线实现：[`src/engine/primitives/damageCalculation.ts`](../../src/engine/primitives/damageCalculation.ts)。
- 管线测试：[`src/engine/primitives/__tests__/damageCalculation.test.ts`](../../src/engine/primitives/__tests__/damageCalculation.test.ts)。
- 迁移样例：用 `rg -n "createDamageCalculation|toEvents\\(" src/games src/engine` 查当前真实消费点。
- 游戏迁移测试：优先查对应 `src/games/<gameId>/__tests__/` 或领域测试目录。

## 迁移判断

- 基础伤害：用 `createDamageCalculation(...)` 传入来源、目标、基础值、当前状态和时间戳，再用 `toEvents()` 产出事件。
- 自动修正：只有 Token / 状态 / 护盾已经写入当前 state，且定义字段完整时，才启用自动收集。
- 本链路先授予资源再造成伤害：state 尚未写入时，必须用 `additionalModifiers` 显式传入本次确认的修正，并关闭会读取旧 state 的自动收集。
- 展示层、日志、动画和 AI 只能读取 reducer 已提交的正式 `actualDamage` / breakdown；不能自己重算最终伤害。

## 验收

- 数值结果、`actualDamage`、breakdown、ActionLog 和动画消费必须来自同一正式结果。
- 改共享管线时跑管线单测；改某个游戏时再跑该游戏的窄集成测试或真实入口 E2E。
- 历史迁移状态、未迁完的技能和一次性例外写入对应游戏记录或 evidence，不写进项目标准正文。
